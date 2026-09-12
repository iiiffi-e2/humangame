import type { Run } from '@/lib/db/types';

/**
 * Head-to-head records.
 *
 * Derived from the two players' runs rather than stored as counters: a
 * voided day or a re-scored run then corrects the record automatically, and
 * the rules are testable without touching the database.
 */

export interface DailyOutcome {
  date: string;
  dayNumber: number;
  /** `a`, `b`, `tie`, or `none` when at least one of them did not play. */
  winner: 'a' | 'b' | 'tie' | 'none';
  scoreA: number | null;
  scoreB: number | null;
  margin: number | null;
}

export interface RivalryRecord {
  outcomes: DailyOutcome[];
  seasonWinsA: number;
  seasonWinsB: number;
  allTimeWinsA: number;
  allTimeWinsB: number;
  ties: number;
  /** Positive means A is on a run, negative means B is. */
  currentStreak: number;
  streakHolder: 'a' | 'b' | null;
  /** Mean absolute margin across days both played. */
  averageMargin: number;
  longestStreakA: number;
  longestStreakB: number;
}

export interface BuildRecordInput {
  runsA: readonly Run[];
  runsB: readonly Run[];
  /** `YYYY-MM` — days outside it count for all-time only. */
  seasonKey: string;
}

export function seasonKeyFor(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function buildRivalryRecord({
  runsA,
  runsB,
  seasonKey,
}: BuildRecordInput): RivalryRecord {
  const byDateA = new Map(runsA.filter((run) => run.status === 'finished').map((run) => [run.date, run]));
  const byDateB = new Map(runsB.filter((run) => run.status === 'finished').map((run) => [run.date, run]));
  const dates = [...new Set([...byDateA.keys(), ...byDateB.keys()])].sort();

  const outcomes: DailyOutcome[] = [];
  let seasonWinsA = 0;
  let seasonWinsB = 0;
  let allTimeWinsA = 0;
  let allTimeWinsB = 0;
  let ties = 0;
  let margins = 0;
  let contested = 0;
  let streak = 0;
  let holder: 'a' | 'b' | null = null;
  let longestA = 0;
  let longestB = 0;

  for (const date of dates) {
    const runA = byDateA.get(date);
    const runB = byDateB.get(date);
    const scoreA = runA?.totalScore ?? null;
    const scoreB = runB?.totalScore ?? null;

    let winner: DailyOutcome['winner'] = 'none';
    let margin: number | null = null;
    if (scoreA !== null && scoreB !== null) {
      margin = Math.abs(scoreA - scoreB);
      contested += 1;
      margins += margin;
      if (scoreA > scoreB) winner = 'a';
      else if (scoreB > scoreA) winner = 'b';
      else winner = 'tie';
    }

    const inSeason = seasonKeyFor(date) === seasonKey;
    if (winner === 'a') {
      allTimeWinsA += 1;
      if (inSeason) seasonWinsA += 1;
      streak = holder === 'a' ? streak + 1 : 1;
      holder = 'a';
      longestA = Math.max(longestA, streak);
    } else if (winner === 'b') {
      allTimeWinsB += 1;
      if (inSeason) seasonWinsB += 1;
      streak = holder === 'b' ? streak + 1 : 1;
      holder = 'b';
      longestB = Math.max(longestB, streak);
    } else if (winner === 'tie') {
      ties += 1;
      // A tie does not break a streak, but it does not extend one either.
    }

    outcomes.push({
      date,
      dayNumber: runA?.dayNumber ?? runB?.dayNumber ?? 0,
      winner,
      scoreA,
      scoreB,
      margin,
    });
  }

  return {
    outcomes,
    seasonWinsA,
    seasonWinsB,
    allTimeWinsA,
    allTimeWinsB,
    ties,
    currentStreak: holder === null ? 0 : streak,
    streakHolder: holder,
    averageMargin: contested === 0 ? 0 : Math.round(margins / contested),
    longestStreakA: longestA,
    longestStreakB: longestB,
  };
}

/** The last `count` days, oldest first, padded with "not played" days. */
export function recentOutcomes(record: RivalryRecord, count: number): DailyOutcome[] {
  return record.outcomes.slice(-count);
}
