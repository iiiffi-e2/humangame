import 'server-only';
import { getGame } from '@/features/game-engine/registry';
import { RunError } from '@/features/game-engine/run-service';
import type { DailyEvent, DailyManifest, Pillar } from '@/features/game-engine/types';
import { checkTiming } from '@/lib/anti-cheat';
import { issuePracticeToken, readPracticeToken } from '@/lib/anti-cheat/tokens';
import { publicEvent } from '@/lib/daily/manifest';
import { ensureManifest, todayKey } from '@/lib/daily/service';
import { getStore } from '@/lib/db';
import type { CrowdTallyRow, Run } from '@/lib/db/types';
import { serverEnv } from '@/lib/env';
import { EVENTS_PER_RUN, totalScore, type ScoreResult } from '@/lib/scoring';

export interface StartPracticeOutput {
  token: string;
  firstScore: number;
  manifest: {
    id: string;
    date: string;
    dayNumber: number;
    events: DailyEvent[];
  };
}

export interface SubmitPracticeOutput {
  score: ScoreResult;
  pillar: Pillar;
  gameId: string;
  index: number;
  nextIndex: number | null;
  token: string;
}

export interface FinishPracticeOutput {
  thisRun: number;
  firstScore: number;
  events: Array<{ index: number; pillar: Pillar; gameId: string; points: number }>;
}

async function requireFinishedOfficial(playerId: string): Promise<{
  manifest: DailyManifest;
  official: Run;
}> {
  const manifest = await ensureManifest(todayKey());
  const official = await getStore().getOfficialRun(playerId, manifest.id);
  if (official?.status !== 'finished') {
    throw new RunError('Finish today first.', 'PRACTICE_LOCKED', 403);
  }
  return { manifest, official };
}

function readOwnedToken(token: string, playerId: string) {
  const payload = readPracticeToken(token, serverEnv().runSecret);
  if (!payload) throw new RunError('Practice token is missing or expired.', 'BAD_TOKEN', 401);
  if (payload.playerId !== playerId) {
    throw new RunError('Practice token does not match this player.', 'BAD_TOKEN', 401);
  }
  return payload;
}

async function crowdContext(
  manifestId: string,
  event: DailyEvent,
): Promise<CrowdTallyRow | undefined> {
  if (event.pillar !== 'crowd') return undefined;
  return getStore().getCrowdTally(manifestId, event.index);
}

export async function startPracticeReplay(playerId: string): Promise<StartPracticeOutput> {
  const { manifest, official } = await requireFinishedOfficial(playerId);
  const { token } = issuePracticeToken(
    { playerId, manifestId: manifest.id, nextIndex: 0, points: [], mode: 'practice' },
    serverEnv().runSecret,
  );
  return {
    token,
    firstScore: official.totalScore,
    manifest: {
      id: manifest.id,
      date: manifest.date,
      dayNumber: manifest.dayNumber,
      events: manifest.events.map(publicEvent),
    },
  };
}

export async function submitPracticeEvent(
  playerId: string,
  input: { token: string; index: number; result: unknown; durationMs: number },
): Promise<SubmitPracticeOutput> {
  const payload = readOwnedToken(input.token, playerId);
  const { manifest } = await requireFinishedOfficial(playerId);
  if (payload.manifestId !== manifest.id) {
    throw new RunError('Practice token is missing or expired.', 'BAD_TOKEN', 401);
  }
  if (input.index !== payload.nextIndex || input.index < 0 || input.index > 4) {
    throw new RunError(
      `Expected event ${payload.nextIndex}, received ${input.index}.`,
      'OUT_OF_ORDER',
      409,
    );
  }

  const event = manifest.events[input.index];
  if (!event) throw new RunError('No such event in today.', 'BAD_EVENT', 400);

  const definition = getGame(event.gameId);
  let validated: unknown = null;
  if (!event.voided) {
    try {
      validated = definition.validateResult(event.config, input.result);
    } catch (error) {
      throw new RunError(
        error instanceof Error ? error.message : 'Result rejected.',
        'BAD_EVENT',
        400,
      );
    }
    const timing = checkTiming(event, {
      index: event.index,
      result: validated,
      durationMs: input.durationMs,
    });
    if (timing) throw new RunError(timing, 'BAD_EVENT', 400);
  }

  const crowd = await crowdContext(manifest.id, event);
  const score = event.voided
    ? { rawMetric: 0, normalized: 0, points: 0, label: 'Voided' }
    : definition.score(event.config, validated, crowd ? { crowd } : undefined);

  const nextIndex = payload.nextIndex + 1;
  const points = [...payload.points, score.points];
  const { token } = issuePracticeToken(
    { playerId, manifestId: manifest.id, nextIndex, points, mode: 'practice' },
    serverEnv().runSecret,
  );

  return {
    score,
    pillar: event.pillar,
    gameId: event.gameId,
    index: event.index,
    nextIndex: nextIndex < EVENTS_PER_RUN ? nextIndex : null,
    token,
  };
}

export async function finishPracticeReplay(
  playerId: string,
  token: string,
): Promise<FinishPracticeOutput> {
  const payload = readOwnedToken(token, playerId);
  const { manifest, official } = await requireFinishedOfficial(playerId);
  if (payload.manifestId !== manifest.id) {
    throw new RunError('Practice token is missing or expired.', 'BAD_TOKEN', 401);
  }
  if (payload.nextIndex !== EVENTS_PER_RUN || payload.points.length !== EVENTS_PER_RUN) {
    throw new RunError(
      `Replay has ${payload.points.length} of ${EVENTS_PER_RUN} events.`,
      'INCOMPLETE',
      400,
    );
  }

  const voidedIndexes = manifest.events
    .filter((event) => event.voided)
    .map((event) => event.index);
  const thisRun = totalScore(payload.points, voidedIndexes);

  return {
    thisRun,
    firstScore: official.totalScore,
    events: manifest.events.map((event, index) => ({
      index: event.index,
      pillar: event.pillar,
      gameId: event.gameId,
      points: payload.points[index] as number,
    })),
  };
}
