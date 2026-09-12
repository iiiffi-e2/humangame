/**
 * Deterministic, isomorphic pseudo-random number generation.
 *
 * Everything a player sees in an official run is derived from the daily
 * manifest seed through these helpers, so the server and the client always
 * agree and a run can be re-scored from the seed alone. No `Math.random`
 * anywhere in game config generation.
 */

/** cyrb128 — string -> four 32-bit seeds. */
export function hashSeed(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i += 1) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/** A small, fast, well-distributed 32-bit generator (sfc32). */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** Float in [min, max) rounded to `decimals` places. */
  round(min: number, max: number, decimals: number): number;
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates; returns a new array. */
  shuffle<T>(items: readonly T[]): T[];
  /** `count` distinct items. Throws when count exceeds the pool. */
  sample<T>(items: readonly T[], count: number): T[];
  bool(probability?: number): boolean;
}

export function createRng(seed: string): Rng {
  const [s0, s1, s2, s3] = hashSeed(seed);
  let a = s0;
  let b = s1;
  let c = s2;
  let d = s3;

  const next = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  // Discard the first few values so closely-related seeds diverge.
  for (let i = 0; i < 12; i += 1) next();

  const rng: Rng = {
    next,
    int: (min, max) => {
      if (max < min) throw new Error(`rng.int: max (${max}) < min (${min})`);
      return min + Math.floor(next() * (max - min + 1));
    },
    float: (min, max) => min + next() * (max - min),
    round: (min, max, decimals) => {
      const factor = 10 ** decimals;
      return Math.round((min + next() * (max - min)) * factor) / factor;
    },
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('rng.pick: empty list');
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffle: <T,>(items: readonly T[]): T[] => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
    sample: <T,>(items: readonly T[], count: number): T[] => {
      if (count > items.length) {
        throw new Error(`rng.sample: need ${count} of ${items.length}`);
      }
      return rng.shuffle(items).slice(0, count);
    },
    bool: (probability = 0.5) => next() < probability,
  };

  return rng;
}
