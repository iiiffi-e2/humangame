/**
 * Deterministic scoring primitives.
 *
 * Every event is worth 0..2000 points and every helper here is a pure
 * function of (config, result). Nothing in this file may read the clock,
 * the network, or any player identity — the server re-runs these exact
 * functions on submit and must land on the same integer the client showed.
 *
 * See `docs/scoring.md` for the maths and the reasoning behind each curve.
 */

export const MAX_EVENT_POINTS = 2000;
export const EVENTS_PER_RUN = 5;
export const MAX_RUN_POINTS = MAX_EVENT_POINTS * EVENTS_PER_RUN;

export interface ScoreResult {
  /** The human-readable raw measurement, e.g. milliseconds off target. */
  rawMetric: number;
  /** 0..1 quality of the attempt. */
  normalized: number;
  /** Integer 0..2000. */
  points: number;
  /** Short tier word shown on the interstitial. */
  label: string;
  /** Accuracy before the speed multiplier. Equals normalized when unused. */
  accuracy?: number;
  /** Player-facing closeness chip. Omitted for Nerve (exact metric instead). */
  closeness?: string;
  /** Player-facing pace chip. Omitted for Nerve. */
  pace?: Pace;
}

export type Pace = 'Quick' | 'On pace' | 'A bit slow' | 'Slow';

/** Medium-time bands. Scoring reads these constants, not stored config. */
export const SPEED_BAND = {
  eye: { parMs: 5_000, slowMs: 22_000, speedWeight: 0.28 },
  memory: { parMs: 8_000, slowMs: 25_000, speedWeight: 0.28 },
  order: { parMs: 12_000, slowMs: 40_000, speedWeight: 0.25 },
  crowd: { parMs: 5_000, slowMs: 20_000, speedWeight: 0.25 },
} as const;

export type SpeedBand = {
  parMs: number;
  slowMs: number;
  speedWeight: number;
};

export type ScoreTier =
  | 'Flawless'
  | 'Unreal'
  | 'Elite'
  | 'Solid'
  | 'Human'
  | 'Shaky'
  | 'Cooked';

const TIERS: ReadonlyArray<readonly [number, ScoreTier]> = [
  [0.995, 'Flawless'],
  [0.93, 'Unreal'],
  [0.82, 'Elite'],
  [0.64, 'Solid'],
  [0.42, 'Human'],
  [0.18, 'Shaky'],
  [-1, 'Cooked'],
];

export function tierFor(normalized: number): ScoreTier {
  for (const [floor, tier] of TIERS) {
    if (normalized >= floor) return tier;
  }
  return 'Cooked';
}

export function headlineFor(normalized: number): string {
  const tier = tierFor(normalized);
  switch (tier) {
    case 'Flawless':
      return 'Perfect.';
    case 'Unreal':
      return 'Nailed it.';
    case 'Elite':
      return 'Sharp.';
    case 'Solid':
      return 'Solid.';
    case 'Human':
      return 'Human.';
    case 'Shaky':
      return 'Shaky.';
    default:
      return 'Cooked.';
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Convert a 0..1 quality into the integer points for one event. */
export function toPoints(normalized: number): number {
  return Math.round(clamp01(normalized) * MAX_EVENT_POINTS);
}

export function finalize(
  rawMetric: number,
  normalized: number,
  label?: string,
): ScoreResult {
  const n = clamp01(normalized);
  return {
    rawMetric: Number.isFinite(rawMetric) ? rawMetric : 0,
    normalized: n,
    points: toPoints(n),
    label: label ?? tierFor(n),
  };
}

/**
 * Accuracy, then a bounded speed multiplier. A slow perfect still beats a
 * fast miss; sitting on the event can no longer pay a full 2,000.
 */
export function applySpeed(
  accuracy: number,
  options: {
    elapsedMs: number;
    parMs: number;
    slowMs: number;
    speedWeight?: number;
  },
): number {
  const { elapsedMs, parMs, slowMs, speedWeight = 0.28 } = options;
  const quality = clamp01(accuracy);
  if (quality === 0) return 0;
  const speed = distanceScore({
    error: Math.max(0, elapsedMs - parMs),
    perfect: 0,
    zero: Math.max(1, slowMs - parMs),
    falloff: 1.1,
  });
  return clamp01(quality * (1 - speedWeight + speedWeight * speed));
}

export function paceFor(elapsedMs: number, parMs: number, slowMs: number): Pace {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= parMs) return 'Quick';
  const span = Math.max(1, slowMs - parMs);
  const t = (elapsedMs - parMs) / span;
  if (t < 0.4) return 'On pace';
  if (t < 1) return 'A bit slow';
  return 'Slow';
}

export function closenessLabel(accuracy: number): string {
  const quality = clamp01(accuracy);
  if (quality >= 0.995) return 'Spot on';
  if (quality >= 0.82) return 'Close';
  if (quality >= 0.42) return 'Off';
  return 'Missed';
}

/** Client omitted the clock → no speed bonus. */
export function readElapsedMs(value: unknown, fallbackMs: number, maxMs = 180_000): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallbackMs;
  return Math.max(0, Math.min(maxMs, Math.round(value)));
}

/** Score a non-Nerve event: closeness from accuracy, points after speed. */
export function finalizeTimed(
  rawMetric: number,
  accuracy: number,
  elapsedMs: number,
  band: SpeedBand,
  label?: string,
): ScoreResult {
  const normalized = applySpeed(accuracy, { elapsedMs, ...band });
  return {
    ...finalize(rawMetric, normalized, label),
    accuracy: clamp01(accuracy),
    closeness: closenessLabel(accuracy),
    pace: paceFor(elapsedMs, band.parMs, band.slowMs),
  };
}

/* ------------------------------------------------------------------ */
/* Curve 1 — continuous error                                          */
/* ------------------------------------------------------------------ */

export interface DistanceScoreOptions {
  /** Absolute error in the game's own unit. */
  error: number;
  /** Error at which the player still scores `perfectBand` quality. */
  perfect: number;
  /** Error at which quality reaches zero. */
  zero: number;
  /**
   * Curve shape. >1 is forgiving near the target then falls away fast,
   * <1 punishes small errors immediately. 1.6 is the house default.
   */
  falloff?: number;
}

/**
 * Nonlinear error score. Inside `perfect` the player gets a full 1.0; from
 * there it decays to 0 at `zero` following `(1 - t)^falloff`.
 */
export function distanceScore(options: DistanceScoreOptions): number {
  const { error, perfect, zero, falloff = 1.6 } = options;
  const magnitude = Math.abs(error);
  if (!Number.isFinite(magnitude)) return 0;
  if (magnitude <= perfect) return 1;
  if (magnitude >= zero) return 0;
  const span = zero - perfect;
  if (span <= 0) return 0;
  const t = (magnitude - perfect) / span;
  return clamp01((1 - t) ** falloff);
}

/* ------------------------------------------------------------------ */
/* Curve 2 — right/wrong plus a speed bonus                            */
/* ------------------------------------------------------------------ */

export interface CategoricalScoreOptions {
  correct: boolean;
  /** Time the player took, measured by the client's monotonic clock. */
  elapsedMs: number;
  /** Time that still earns the full speed bonus. */
  parMs: number;
  /** Time at which the speed bonus is fully gone. */
  slowMs: number;
  /** Fraction of the score that comes from speed. Default 0.3. */
  speedWeight?: number;
  /** Quality awarded for a wrong answer. Default 0. */
  wrongFloor?: number;
}

/**
 * Correctness dominates; speed is a bounded bonus so a fast wrong answer can
 * never beat a slow right one. Elapsed time is the in-page monotonic
 * measurement of the interaction itself, never wall-clock network latency.
 */
export function categoricalScore(options: CategoricalScoreOptions): number {
  const {
    correct,
    elapsedMs,
    parMs,
    slowMs,
    speedWeight = 0.3,
    wrongFloor = 0,
  } = options;
  if (!correct) return clamp01(wrongFloor);
  return applySpeed(1, { elapsedMs, parMs, slowMs, speedWeight });
}

/* ------------------------------------------------------------------ */
/* Curve 3 — sequences with partial credit                             */
/* ------------------------------------------------------------------ */

export interface SequenceScoreOptions<T> {
  expected: readonly T[];
  actual: readonly T[];
  /** Weight of "right items, wrong order" credit. Default 0.35. */
  setWeight?: number;
}

/**
 * Blends two ideas: how far the player got before the first mistake
 * (position credit) and how many of the right items they produced at all
 * (set credit). Getting every item in the wrong order still beats guessing.
 */
export function sequenceScore<T>(options: SequenceScoreOptions<T>): number {
  const { expected, actual, setWeight = 0.35 } = options;
  if (expected.length === 0) return 1;

  let prefix = 0;
  for (let i = 0; i < expected.length; i += 1) {
    if (i < actual.length && actual[i] === expected[i]) prefix += 1;
    else break;
  }
  const positionCredit = prefix / expected.length;

  const remaining = new Map<T, number>();
  for (const item of expected) remaining.set(item, (remaining.get(item) ?? 0) + 1);
  let overlap = 0;
  for (const item of actual.slice(0, expected.length)) {
    const count = remaining.get(item) ?? 0;
    if (count > 0) {
      overlap += 1;
      remaining.set(item, count - 1);
    }
  }
  const setCredit = overlap / expected.length;

  // An over-long answer is a guess-spam attempt; scale it back.
  const lengthPenalty =
    actual.length > expected.length
      ? expected.length / actual.length
      : 1;

  return clamp01(
    ((1 - setWeight) * positionCredit + setWeight * setCredit) * lengthPenalty,
  );
}

/* ------------------------------------------------------------------ */
/* Curve 4 — orderings                                                 */
/* ------------------------------------------------------------------ */

export interface RankingScoreOptions {
  /** The correct ordering, as item ids. */
  expected: readonly string[];
  /** The player's ordering of the same ids. */
  actual: readonly string[];
  /** Quality awarded at a fully reversed ordering. Default 0. */
  reversedFloor?: number;
}

/**
 * Normalized Kendall tau: the share of item pairs the player placed in the
 * right relative order. A perfect ordering is 1, a reversal is 0, random
 * guessing lands near 0.5 — which is why the payout curve below squeezes
 * the bottom half.
 */
export function rankingScore(options: RankingScoreOptions): number {
  const { expected, actual, reversedFloor = 0 } = options;
  const n = expected.length;
  if (n < 2) return 1;

  const target = new Map<string, number>();
  expected.forEach((id, index) => target.set(id, index));

  // Unknown or missing ids make the answer unusable.
  if (actual.length !== n || new Set(actual).size !== n) return reversedFloor;
  for (const id of actual) if (!target.has(id)) return reversedFloor;

  let concordant = 0;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      total += 1;
      const a = target.get(actual[i] as string) as number;
      const b = target.get(actual[j] as string) as number;
      if (a < b) concordant += 1;
    }
  }
  const agreement = total === 0 ? 1 : concordant / total;
  // Squeeze: random ordering (agreement 0.5) should not pay half marks.
  const squeezed = agreement <= 0.5 ? agreement * 0.4 : 0.2 + (agreement - 0.5) * 1.6;
  return clamp01(Math.max(squeezed, reversedFloor));
}

/* ------------------------------------------------------------------ */
/* Curve 5 — percentage predictions                                    */
/* ------------------------------------------------------------------ */

export interface PercentageScoreOptions {
  /** The player's 0..100 guess. */
  predicted: number;
  /** The population's actual 0..100 figure. */
  actual: number;
  /** Points-of-percentage that still count as spot on. Default 2. */
  perfect?: number;
  /** Points-of-percentage at which quality hits zero. Default 40. */
  zero?: number;
}

export function percentageScore(options: PercentageScoreOptions): number {
  const { predicted, actual, perfect = 2, zero = 40 } = options;
  return distanceScore({
    error: predicted - actual,
    perfect,
    zero,
    falloff: 1.45,
  });
}

/* ------------------------------------------------------------------ */
/* Run totals                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sum of event points, clamped into 0..10,000. `voidedIndexes` are events a
 * moderator invalidated: they are excluded and the remainder is scaled back
 * up so a voided day is still ranked out of 10,000.
 */
export function totalScore(
  eventPoints: readonly number[],
  voidedIndexes: readonly number[] = [],
): number {
  const voided = new Set(voidedIndexes);
  const counted = eventPoints.filter((_, index) => !voided.has(index));
  if (counted.length === 0) return 0;
  const sum = counted.reduce((acc, points) => acc + clamp01(points / MAX_EVENT_POINTS) * MAX_EVENT_POINTS, 0);
  const scaled = (sum / (counted.length * MAX_EVENT_POINTS)) * MAX_RUN_POINTS;
  return Math.min(MAX_RUN_POINTS, Math.max(0, Math.round(scaled)));
}

/** Pillar score shown on the reveal: 0..100 from 0..2000 points. */
export function pillarPercent(points: number): number {
  return Math.round((clamp01(points / MAX_EVENT_POINTS) * 100));
}
