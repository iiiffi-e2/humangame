import type { Run } from '@/lib/db/types';

/**
 * Crew standings.
 *
 * Daily standings are just today's scores. Monthly standings use placement
 * points so a crew member who shows up every day and places mid-table beats
 * someone who posts one huge score and disappears:
 *
 *   1st 10 · 2nd 8 · 3rd 6 · 4th 5 · 5th 4 · everyone else who played 2
 */

export const PLACEMENT_POINTS: readonly number[] = [10, 8, 6, 5, 4];
export const PARTICIPATION_POINTS = 2;

export function pointsForPlacement(placement: number): number {
  return PLACEMENT_POINTS[placement - 1] ?? PARTICIPATION_POINTS;
}

export interface DailyStanding {
  playerId: string;
  score: number;
  placement: number;
  points: number;
}

/** Rank one day inside a crew. Ties share the better placement. */
export function rankDay(entries: ReadonlyArray<{ playerId: string; score: number }>): DailyStanding[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId));
  const out: DailyStanding[] = [];
  let placement = 0;
  let previousScore: number | null = null;
  sorted.forEach((entry, index) => {
    if (previousScore === null || entry.score !== previousScore) placement = index + 1;
    previousScore = entry.score;
    out.push({
      playerId: entry.playerId,
      score: entry.score,
      placement,
      points: pointsForPlacement(placement),
    });
  });
  return out;
}

export interface MonthlyStanding {
  playerId: string;
  points: number;
  daysPlayed: number;
  bestScore: number;
  wins: number;
}

export function monthlyStandings(
  memberIds: readonly string[],
  runs: readonly Run[],
  monthKey: string,
): MonthlyStanding[] {
  const members = new Set(memberIds);
  const byDate = new Map<string, Array<{ playerId: string; score: number }>>();
  for (const run of runs) {
    if (run.status !== 'finished' || run.mode !== 'official') continue;
    if (!members.has(run.playerId)) continue;
    if (run.date.slice(0, 7) !== monthKey) continue;
    const list = byDate.get(run.date) ?? [];
    list.push({ playerId: run.playerId, score: run.totalScore });
    byDate.set(run.date, list);
  }

  const totals = new Map<string, MonthlyStanding>();
  for (const id of memberIds) {
    totals.set(id, { playerId: id, points: 0, daysPlayed: 0, bestScore: 0, wins: 0 });
  }

  for (const entries of byDate.values()) {
    for (const standing of rankDay(entries)) {
      const total = totals.get(standing.playerId);
      if (!total) continue;
      total.points += standing.points;
      total.daysPlayed += 1;
      total.bestScore = Math.max(total.bestScore, standing.score);
      if (standing.placement === 1) total.wins += 1;
    }
  }

  return [...totals.values()].sort(
    (a, b) => b.points - a.points || b.bestScore - a.bestScore || a.playerId.localeCompare(b.playerId),
  );
}
