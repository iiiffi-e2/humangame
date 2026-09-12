import 'server-only';
import { randomUUID } from 'node:crypto';
import { getGame } from '@/features/game-engine/registry';
import type { DailyEvent, DailyManifest, Pillar } from '@/features/game-engine/types';
import { percentileOf } from '@/features/results/percentile';
import { applyRun, emptyStats } from '@/features/results/stats';
import {
  assessTrust,
  checkTiming,
  countsForPublicBoards,
  telemetryHash,
  type PlausibilityIssue,
} from '@/lib/anti-cheat';
import { issueRunToken, readRunToken, shortToken } from '@/lib/anti-cheat/tokens';
import { ensureManifest } from '@/lib/daily/service';
import { getStore } from '@/lib/db';
import type { CrowdTallyRow, Run, RunEventRecord } from '@/lib/db/types';
import { serverEnv } from '@/lib/env';
import { EVENTS_PER_RUN, totalScore, type ScoreResult } from '@/lib/scoring';

/**
 * The official run lifecycle.
 *
 * Three rules hold this together:
 *
 *  1. The client never sends a score. It sends what the player did, and the
 *     server re-runs the same deterministic scoring function against the
 *     config stored in the manifest.
 *  2. One official run per player per manifest, enforced by the store (a
 *     partial unique index in Postgres).
 *  3. A run token is single-use: its `jti` is written onto the run and
 *     rotated whenever a token is reissued, so an old token cannot be
 *     replayed to submit a second set of events.
 */

export class RunError extends Error {
  constructor(
    override readonly message: string,
    readonly code:
      | 'ALREADY_PLAYED'
      | 'NO_RUN'
      | 'BAD_TOKEN'
      | 'BAD_EVENT'
      | 'OUT_OF_ORDER'
      | 'INCOMPLETE'
      | 'PRACTICE_LOCKED',
    readonly status = 400,
  ) {
    super(message);
    this.name = 'RunError';
  }
}

export interface StartRunResult {
  run: Run;
  token: string;
  manifest: DailyManifest;
  resumed: boolean;
}

export async function startOfficialRun(
  playerId: string,
  dateKey: string,
  options: { fromChallengeToken?: string | null } = {},
): Promise<StartRunResult> {
  const store = getStore();
  const manifest = await ensureManifest(dateKey);
  const existing = await store.getOfficialRun(playerId, manifest.id);

  if (existing?.status === 'finished') {
    throw new RunError('This player already has an official run today.', 'ALREADY_PLAYED', 409);
  }

  const secret = serverEnv().runSecret;

  if (existing) {
    // Recovery: the player navigated away mid-run. Reissue a token for the
    // same run, which rotates the jti and kills the old one.
    const { token, payload } = issueRunToken(
      { runId: existing.id, playerId, manifestId: manifest.id, mode: 'official' },
      secret,
    );
    const run = await store.updateRun(existing.id, { tokenJti: payload.jti });
    return { run, token, manifest, resumed: true };
  }

  const runId = randomUUID();
  const { token, payload } = issueRunToken(
    { runId, playerId, manifestId: manifest.id, mode: 'official' },
    secret,
  );

  const run: Run = {
    id: runId,
    playerId,
    manifestId: manifest.id,
    date: manifest.date,
    dayNumber: manifest.dayNumber,
    mode: 'official',
    status: 'active',
    totalScore: 0,
    percentile: null,
    trust: 'ok',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    tokenJti: payload.jti,
    shareToken: null,
    fromChallengeToken: options.fromChallengeToken ?? null,
    events: [],
  };

  const created = await store.createRun(run);
  return { run: created, token, manifest, resumed: false };
}

async function loadRunForToken(token: string): Promise<{ run: Run; manifest: DailyManifest }> {
  const payload = readRunToken(token, serverEnv().runSecret);
  if (!payload) throw new RunError('Run token is missing or expired.', 'BAD_TOKEN', 401);

  const store = getStore();
  const run = await store.getRun(payload.runId);
  if (!run) throw new RunError('No such run.', 'NO_RUN', 404);
  if (run.playerId !== payload.playerId) {
    throw new RunError('Run token does not match this player.', 'BAD_TOKEN', 403);
  }
  if (run.tokenJti !== payload.jti) {
    throw new RunError('Run token has been superseded.', 'BAD_TOKEN', 401);
  }
  const manifest = await store.getManifestById(run.manifestId);
  if (!manifest) throw new RunError('Manifest is missing.', 'NO_RUN', 404);
  return { run, manifest };
}

async function crowdContext(
  manifestId: string,
  event: DailyEvent,
): Promise<CrowdTallyRow | undefined> {
  if (event.pillar !== 'crowd') return undefined;
  return getStore().getCrowdTally(manifestId, event.index);
}

/** Extract the crowd response to persist, so the next player sees it. */
function crowdResponseFrom(event: DailyEvent, result: unknown): { optionId: string | null; value: number | null } | null {
  if (event.pillar !== 'crowd') return null;
  const record = result as Record<string, unknown>;
  if (typeof record.pickedId === 'string') return { optionId: record.pickedId, value: null };
  if (typeof record.predicted === 'number') return { optionId: null, value: record.predicted };
  return null;
}

export interface SubmitEventInput {
  token: string;
  index: number;
  result: unknown;
  durationMs: number;
}

export interface SubmitEventOutput {
  score: ScoreResult;
  pillar: Pillar;
  gameId: string;
  index: number;
  nextIndex: number | null;
  runId: string;
}

export async function submitEvent(input: SubmitEventInput): Promise<SubmitEventOutput> {
  const { run, manifest } = await loadRunForToken(input.token);
  if (run.status !== 'active') {
    throw new RunError('This run is already finished.', 'ALREADY_PLAYED', 409);
  }

  const expectedIndex = run.events.length;
  if (input.index !== expectedIndex) {
    throw new RunError(
      `Expected event ${expectedIndex}, received ${input.index}.`,
      'OUT_OF_ORDER',
      409,
    );
  }

  const event = manifest.events[input.index];
  if (!event) throw new RunError('No such event in today.', 'BAD_EVENT', 400);

  const definition = getGame(event.gameId);
  // A voided event is skipped rather than played, so there is nothing to
  // validate and nothing to score.
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
  }

  // Store the crowd response before scoring so the player's own answer is
  // part of the distribution they are scored against.
  const crowdResponse = crowdResponseFrom(event, validated);
  if (crowdResponse) {
    await getStore().addCrowdResponse({
      id: randomUUID(),
      manifestId: manifest.id,
      eventIndex: event.index,
      playerId: run.playerId,
      optionId: crowdResponse.optionId,
      value: crowdResponse.value,
      createdAt: new Date().toISOString(),
    });
  }

  const crowd = await crowdContext(manifest.id, event);
  const score = event.voided
    ? { rawMetric: 0, normalized: 0, points: 0, label: 'Voided' }
    : definition.score(event.config, validated, crowd ? { crowd } : undefined);

  const record: RunEventRecord = {
    index: event.index,
    pillar: event.pillar,
    gameId: event.gameId,
    result: validated,
    rawMetric: score.rawMetric,
    normalized: score.normalized,
    points: score.points,
    label: score.label,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    telemetryHash: telemetryHash(run.id, event.index, validated),
    voided: Boolean(event.voided),
  };

  await getStore().updateRun(run.id, { events: [...run.events, record] });

  const nextIndex = record.index + 1 < manifest.events.length ? record.index + 1 : null;
  return {
    score,
    pillar: event.pillar,
    gameId: event.gameId,
    index: event.index,
    nextIndex,
    runId: run.id,
  };
}

export interface FinishRunOutput {
  run: Run;
  percentile: number;
  populationSize: number;
  shareToken: string;
  trustReasons: string[];
}

export async function finishRun(token: string): Promise<FinishRunOutput> {
  const { run, manifest } = await loadRunForToken(token);
  const store = getStore();

  if (run.status === 'finished') {
    const population = await rankedScores(manifest.id);
    return {
      run,
      percentile: run.percentile ?? percentileOf({ score: run.totalScore, population }),
      populationSize: population.length,
      shareToken: run.shareToken ?? '',
      trustReasons: [],
    };
  }

  if (run.events.length !== EVENTS_PER_RUN) {
    throw new RunError(
      `Run has ${run.events.length} of ${EVENTS_PER_RUN} events.`,
      'INCOMPLETE',
      400,
    );
  }

  const issues: PlausibilityIssue[] = [];
  for (const record of run.events) {
    const event = manifest.events[record.index];
    if (!event) continue;
    const reason = checkTiming(event, {
      index: record.index,
      result: record.result,
      durationMs: record.durationMs,
    });
    if (reason) issues.push({ index: record.index, reason });
  }

  const voidedIndexes = manifest.events
    .filter((event) => event.voided)
    .map((event) => event.index);
  const points = run.events.map((event) => event.points);
  const finalScore = totalScore(points, voidedIndexes);

  const runDurationMs = Date.now() - new Date(run.startedAt).getTime();
  const { trust, reasons } = assessTrust({
    issues,
    totalScore: finalScore,
    runDurationMs,
    eventPoints: points,
  });

  // The player's own run belongs in its own denominator: "184,302 played"
  // has to include you, and a mid-rank tie split keeps the statement fair.
  // An untrusted run is ranked against the honest field but never joins it.
  const others = await rankedScores(manifest.id);
  const population = countsForPublicBoards(trust) ? [...others, finalScore] : others;
  const percentile = percentileOf({ score: finalScore, population });
  const shareToken = shortToken();

  const finished = await store.updateRun(run.id, {
    status: 'finished',
    totalScore: finalScore,
    percentile,
    trust,
    finishedAt: new Date().toISOString(),
    shareToken,
  });

  // A run opened from a challenge link records the play, which is what turns
  // "someone clicked my link" into a head-to-head.
  if (finished.fromChallengeToken) {
    await store.recordChallengePlay({
      id: randomUUID(),
      token: finished.fromChallengeToken,
      playerId: finished.playerId,
      runId: finished.id,
      createdAt: new Date().toISOString(),
    });
  }

  // Streaks and lifetime stats move in the same step as the run so a crash
  // between the two cannot leave a finished run that never counted.
  const existingStats = (await store.getStats(run.playerId)) ?? emptyStats(run.playerId);
  await store.saveStats(
    applyRun({
      stats: existingStats,
      run: {
        date: finished.date,
        dayNumber: finished.dayNumber,
        totalScore: finalScore,
        percentile,
        events: finished.events,
      },
    }),
  );

  return {
    run: finished,
    percentile,
    populationSize: population.length,
    shareToken,
    trustReasons: reasons,
  };
}

/** Scores that are allowed to set percentiles: finished, ranked, trusted. */
export async function rankedScores(manifestId: string): Promise<number[]> {
  const runs = await getStore().listFinishedRuns(manifestId);
  return runs.filter((run) => countsForPublicBoards(run.trust)).map((run) => run.totalScore);
}

/** Practice runs: random seed, never written to the official tables. */
export function practiceEvent(gameId: string): DailyEvent {
  const definition = getGame(gameId);
  const seed = `practice:${randomUUID()}`;
  const difficulty = 0.55;
  const config = definition.createConfig(seed, difficulty);
  definition.validateConfig(config);
  return {
    index: 0,
    pillar: definition.pillar,
    gameId,
    difficulty,
    seed,
    // Practice never reveals an answer key the official run would hide.
    config: definition.redactConfig ? definition.redactConfig(config) : config,
    voided: false,
  };
}

