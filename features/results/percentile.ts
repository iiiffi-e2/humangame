/**
 * Percentile — the number the whole product is built around.
 *
 * `YOU BEAT X% OF HUMANS TODAY` is the share of today's ranked runs the
 * player's score is strictly greater than, plus half of the runs that tied.
 * Splitting ties keeps the statement symmetric: if everybody scored the same,
 * everybody beat 50% rather than everybody beating 0%.
 */

export interface PercentileInput {
  score: number;
  /** Scores of every ranked run for the same day, in any order. */
  population: readonly number[];
}

export function percentileOf({ score, population }: PercentileInput): number {
  if (population.length === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const value of population) {
    if (value < score) below += 1;
    else if (value === score) equal += 1;
  }
  const beaten = (below + equal / 2) / population.length;
  return Math.round(beaten * 1000) / 10;
}

/** `Top 6%` — the inverse framing used on badges. */
export function topPercent(percentile: number): number {
  return Math.max(1, Math.round(100 - percentile));
}

export function rankOf(score: number, population: readonly number[]): number {
  let above = 0;
  for (const value of population) if (value > score) above += 1;
  return above + 1;
}

/**
 * Whether a percentile should be shown as settled. Early in the day the
 * denominator is small and the number moves; the UI says "provisional" until
 * enough humans have finished.
 */
export const SETTLED_THRESHOLD = 500;

export function isProvisional(populationSize: number): boolean {
  return populationSize < SETTLED_THRESHOLD;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return Math.round((((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2));
}

/** Buckets for the score histogram on the desktop rail and the admin page. */
export function histogram(values: readonly number[], buckets = 16): number[] {
  const out = new Array<number>(buckets).fill(0);
  for (const value of values) {
    const index = Math.min(buckets - 1, Math.max(0, Math.floor((value / 10_000) * buckets)));
    out[index] = (out[index] ?? 0) + 1;
  }
  return out;
}
