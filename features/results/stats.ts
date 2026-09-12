import { PILLARS, type Pillar } from '@/features/game-engine/types';
import { isNextDay } from '@/lib/daily/reset';
import type { PlayerStats, Run } from '@/lib/db/types';

/**
 * Streaks and lifetime stats.
 *
 * Kept as a pure reducer so the same function runs when a live run finishes
 * and when the seed script builds thirty days of history, and so the rules
 * are testable without a database.
 */

export function emptyStats(playerId: string): PlayerStats {
  return {
    playerId,
    streak: 0,
    longestStreak: 0,
    lastPlayedDate: null,
    runsPlayed: 0,
    bestScore: 0,
    bestDayNumber: null,
    totalScore: 0,
    pillarTotals: Object.fromEntries(PILLARS.map((pillar) => [pillar, 0])) as Record<Pillar, number>,
    top50Streak: 0,
    top10Streak: 0,
    longestTop10Streak: 0,
  };
}

export interface ApplyRunInput {
  stats: PlayerStats;
  run: Pick<Run, 'date' | 'dayNumber' | 'totalScore' | 'events'> & { percentile: number | null };
}

/**
 * Fold one finished official run into a player's stats.
 *
 * Replaying the same date is a no-op: a player has one official run per day,
 * and making this idempotent means a retried finish request cannot inflate a
 * streak.
 */
export function applyRun({ stats, run }: ApplyRunInput): PlayerStats {
  if (stats.lastPlayedDate === run.date) return stats;

  const continues = stats.lastPlayedDate !== null && isNextDay(stats.lastPlayedDate, run.date);
  const streak = continues ? stats.streak + 1 : 1;

  const pillarTotals = { ...stats.pillarTotals };
  for (const event of run.events) {
    pillarTotals[event.pillar] = (pillarTotals[event.pillar] ?? 0) + event.points;
  }

  const percentile = run.percentile ?? 0;
  const top50 = percentile >= 50 ? (continues ? stats.top50Streak + 1 : 1) : 0;
  const top10 = percentile >= 90 ? (continues ? stats.top10Streak + 1 : 1) : 0;

  return {
    ...stats,
    streak,
    longestStreak: Math.max(stats.longestStreak, streak),
    lastPlayedDate: run.date,
    runsPlayed: stats.runsPlayed + 1,
    bestScore: Math.max(stats.bestScore, run.totalScore),
    bestDayNumber: run.totalScore > stats.bestScore ? run.dayNumber : stats.bestDayNumber,
    totalScore: stats.totalScore + run.totalScore,
    pillarTotals,
    top50Streak: top50,
    top10Streak: top10,
    longestTop10Streak: Math.max(stats.longestTop10Streak, top10),
  };
}

/**
 * A streak is only alive if the last run was today or yesterday — otherwise
 * the player is looking at a number they already lost.
 */
export function liveStreak(stats: PlayerStats | null, today: string): number {
  if (!stats?.lastPlayedDate) return 0;
  if (stats.lastPlayedDate === today) return stats.streak;
  if (isNextDay(stats.lastPlayedDate, today)) return stats.streak;
  return 0;
}

export function strongestPillar(stats: PlayerStats | null): Pillar | null {
  if (!stats || stats.runsPlayed === 0) return null;
  let best: Pillar | null = null;
  let bestValue = -1;
  for (const pillar of PILLARS) {
    const value = stats.pillarTotals[pillar] ?? 0;
    if (value > bestValue) {
      bestValue = value;
      best = pillar;
    }
  }
  return best;
}

export function pillarAverages(runs: readonly Run[]): Record<Pillar, number> {
  const totals = Object.fromEntries(PILLARS.map((pillar) => [pillar, 0])) as Record<Pillar, number>;
  const counts = Object.fromEntries(PILLARS.map((pillar) => [pillar, 0])) as Record<Pillar, number>;
  for (const run of runs) {
    for (const event of run.events) {
      totals[event.pillar] += event.points;
      counts[event.pillar] += 1;
    }
  }
  return Object.fromEntries(
    PILLARS.map((pillar) => [
      pillar,
      counts[pillar] === 0 ? 0 : Math.round((totals[pillar] / counts[pillar] / 2000) * 100),
    ]),
  ) as Record<Pillar, number>;
}
