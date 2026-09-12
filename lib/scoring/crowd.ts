/**
 * CROWD scoring — blending an authored prior with the live population.
 *
 * A CROWD event asks the player to predict what everyone else will do, so it
 * cannot be scored from the config alone. The first player of the day would
 * otherwise be scored against nothing, and the ten-thousandth against a very
 * different distribution.
 *
 * The fix is a Bayesian blend. Each authored question carries a prior: a set
 * of expected shares plus a `weight` expressed in pseudo-responses. The
 * effective share of option `i` is
 *
 *     share(i) = (prior.shares[i] * prior.weight + counts[i])
 *                / (prior.weight + total)
 *
 * With no responses yet the prior is the answer. As real responses arrive
 * they swamp it: at `total = prior.weight` the two contribute equally, and by
 * ten times the weight the prior is worth under 10%.
 *
 * The points a player is shown at run completion are frozen into the run.
 * Their *percentile* keeps moving as the day fills in, but the number on the
 * card never changes underneath them. `docs/scoring.md` works through the
 * numbers.
 */

export interface CrowdPrior {
  /** Expected share per option id. Values should sum to ~1. */
  shares: Record<string, number>;
  /** Strength of the prior, in pseudo-responses. */
  weight: number;
}

export interface CrowdTally {
  counts: Record<string, number>;
  total: number;
}

/** Normalize a share map so the values sum to 1. */
export function normalizeShares(shares: Record<string, number>): Record<string, number> {
  const entries = Object.entries(shares);
  const sum = entries.reduce((acc, [, value]) => acc + Math.max(0, value), 0);
  if (sum <= 0) {
    const even = entries.length === 0 ? 0 : 1 / entries.length;
    return Object.fromEntries(entries.map(([key]) => [key, even]));
  }
  return Object.fromEntries(entries.map(([key, value]) => [key, Math.max(0, value) / sum]));
}

/**
 * Posterior share per option id, from the prior blended with live counts.
 * Returns values that sum to 1.
 */
export function blendShares(prior: CrowdPrior, tally: CrowdTally | undefined): Record<string, number> {
  const shares = normalizeShares(prior.shares);
  const weight = Math.max(1, prior.weight);
  const counts = tally?.counts ?? {};
  const observed = Object.keys(shares).reduce(
    (acc, key) => acc + Math.max(0, counts[key] ?? 0),
    0,
  );
  const denominator = weight + observed;
  const out: Record<string, number> = {};
  for (const [key, share] of Object.entries(shares)) {
    out[key] = (share * weight + Math.max(0, counts[key] ?? 0)) / denominator;
  }
  return normalizeShares(out);
}

/**
 * Blended value for a single-number prediction (the SPLIT family), returned
 * on a 0..100 scale. `prior.shares.yes` is the authored expectation.
 */
export function blendPercentage(
  priorPercent: number,
  priorWeight: number,
  tally: CrowdTally | undefined,
): number {
  const weight = Math.max(1, priorWeight);
  const yes = Math.max(0, tally?.counts.yes ?? 0);
  const total = Math.max(yes, tally?.total ?? 0);
  const blended = (priorPercent * weight + yes * 100) / (weight + total);
  return Math.max(0, Math.min(100, Math.round(blended * 10) / 10));
}

/**
 * How well a chosen option matches the crowd. `direction` is `most` for
 * "pick the majority" and `least` for "avoid the crowd".
 *
 * The result is a smooth ratio rather than a right/wrong flag: predicting an
 * option that ties with the winner should not be punished like predicting the
 * one nobody chose.
 */
export function crowdAlignment(
  shares: Record<string, number>,
  pickedId: string,
  direction: 'most' | 'least',
): number {
  const values = Object.values(shares);
  if (values.length === 0) return 0;
  const picked = shares[pickedId];
  if (picked === undefined) return 0;
  if (direction === 'most') {
    const best = Math.max(...values);
    if (best <= 0) return 0;
    return Math.min(1, (picked / best) ** 1.6);
  }
  const worst = Math.min(...values);
  if (picked <= 0) return worst <= 0 ? 1 : 0;
  return Math.min(1, (worst / picked) ** 1.6);
}

/** The option the crowd actually picked most / least often. */
export function crowdWinner(
  shares: Record<string, number>,
  direction: 'most' | 'least',
): string | null {
  let bestId: string | null = null;
  let bestValue = direction === 'most' ? -Infinity : Infinity;
  for (const [id, value] of Object.entries(shares)) {
    if (direction === 'most' ? value > bestValue : value < bestValue) {
      bestValue = value;
      bestId = id;
    }
  }
  return bestId;
}
