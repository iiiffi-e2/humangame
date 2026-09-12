import 'server-only';
import { buildRivalryRecord, seasonKeyFor } from '@/features/rivalries/record';
import { PILLARS, type Pillar } from '@/features/game-engine/types';
import { isProvisional, percentileOf, topPercent } from '@/features/results/percentile';
import { liveStreak } from '@/features/results/stats';
import { rankedScores } from '@/features/game-engine/run-service';
import { getStore } from '@/lib/db';
import type { Player, Run } from '@/lib/db/types';
import { pillarPercent, tierFor } from '@/lib/scoring';

/**
 * Everything the final reveal needs, in one shape.
 *
 * Assembled on the server so the reveal screen is a pure render: the client
 * never recomputes a score, a percentile or a head-to-head record.
 */

export interface PillarRow {
  pillar: Pillar;
  points: number;
  /** 0..100 for the bar. */
  value: number;
  label: string;
  voided: boolean;
}

export interface RivalComparison {
  playerId: string;
  displayName: string;
  username: string | null;
  /** Null until the rival has finished today. */
  score: number | null;
  played: boolean;
  /** Positive when the viewer is ahead. */
  delta: number | null;
  seasonWinsViewer: number;
  seasonWinsRival: number;
  isNemesis: boolean;
}

export interface ResultPayload {
  runId: string;
  dayNumber: number;
  date: string;
  totalScore: number;
  percentile: number;
  topPercent: number;
  provisional: boolean;
  tier: string;
  pillars: PillarRow[];
  streak: number;
  populationSize: number;
  shareToken: string | null;
  rival: RivalComparison | null;
  voidedPillars: Pillar[];
}

export async function buildResultPayload(run: Run, viewer: Player): Promise<ResultPayload> {
  const store = getStore();
  const population = await rankedScores(run.manifestId);
  const percentile = run.percentile ?? percentileOf({ score: run.totalScore, population });
  const stats = await store.getStats(run.playerId);

  const byPillar = new Map(run.events.map((event) => [event.pillar, event]));
  const pillars: PillarRow[] = PILLARS.map((pillar) => {
    const event = byPillar.get(pillar);
    return {
      pillar,
      points: event?.points ?? 0,
      value: pillarPercent(event?.points ?? 0),
      label: event?.label ?? '—',
      voided: event?.voided ?? false,
    };
  });

  return {
    runId: run.id,
    dayNumber: run.dayNumber,
    date: run.date,
    totalScore: run.totalScore,
    percentile,
    topPercent: topPercent(percentile),
    provisional: isProvisional(population.length),
    tier: tierFor(run.totalScore / 10_000),
    pillars,
    streak: liveStreak(stats, run.date),
    populationSize: population.length,
    shareToken: run.shareToken,
    rival: await primaryRival(run, viewer),
    voidedPillars: pillars.filter((row) => row.voided).map((row) => row.pillar),
  };
}

/**
 * The rival worth putting on the reveal: the pinned Nemesis if there is one,
 * otherwise whichever active rival is closest to the player today.
 */
export async function primaryRival(run: Run, viewer: Player): Promise<RivalComparison | null> {
  const store = getStore();
  const rivalries = (await store.listRivalries(viewer.id)).filter(
    (rivalry) => rivalry.status === 'active',
  );
  if (rivalries.length === 0) return null;

  const rivalIds = rivalries.map((rivalry) =>
    rivalry.playerAId === viewer.id ? rivalry.playerBId : rivalry.playerAId,
  );
  const [rivalPlayers, todaysRuns, viewerHistory] = await Promise.all([
    store.getPlayers(rivalIds),
    store.listRunsForPlayers(rivalIds, run.manifestId),
    store.listRunsForPlayer(viewer.id, 400),
  ]);

  const nemesisRivalry = rivalries.find((rivalry) => rivalry.nemesisFor.includes(viewer.id));
  const chosenId =
    (nemesisRivalry
      ? nemesisRivalry.playerAId === viewer.id
        ? nemesisRivalry.playerBId
        : nemesisRivalry.playerAId
      : null) ??
    [...todaysRuns]
      .filter((rivalRun) => rivalRun.status === 'finished')
      .sort(
        (a, b) =>
          Math.abs(a.totalScore - run.totalScore) - Math.abs(b.totalScore - run.totalScore),
      )[0]?.playerId ??
    rivalIds[0];

  if (!chosenId) return null;
  const rivalPlayer = rivalPlayers.find((player) => player.id === chosenId);
  if (!rivalPlayer) return null;

  const rivalRun = todaysRuns.find(
    (entry) => entry.playerId === chosenId && entry.status === 'finished',
  );
  const rivalHistory = await store.listRunsForPlayer(chosenId, 400);
  const record = buildRivalryRecord({
    runsA: viewerHistory,
    runsB: rivalHistory,
    seasonKey: seasonKeyFor(run.date),
  });

  const rivalry = rivalries.find(
    (entry) => entry.playerAId === chosenId || entry.playerBId === chosenId,
  );

  return {
    playerId: rivalPlayer.id,
    displayName: rivalPlayer.displayName,
    username: rivalPlayer.username,
    score: rivalRun?.totalScore ?? null,
    played: Boolean(rivalRun),
    delta: rivalRun ? run.totalScore - rivalRun.totalScore : null,
    seasonWinsViewer: record.seasonWinsA,
    seasonWinsRival: record.seasonWinsB,
    isNemesis: Boolean(rivalry?.nemesisFor.includes(viewer.id)),
  };
}
