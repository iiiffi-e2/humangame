import { describe, expect, it } from 'vitest';
import {
  blendPercentage,
  blendShares,
  crowdAlignment,
  crowdWinner,
  normalizeShares,
} from '@/lib/scoring/crowd';
import { majority, type MajorityConfig } from '@/features/games/crowd/majority';
import { split, type SplitConfig } from '@/features/games/crowd/split';
import { avoid, type AvoidConfig } from '@/features/games/crowd/avoid';

const PRIOR = { shares: { a: 0.6, b: 0.3, c: 0.1 }, weight: 100 };

describe('prior and live blending', () => {
  it('is the prior when nobody has answered yet', () => {
    const shares = blendShares(PRIOR, { counts: {}, total: 0 });
    expect(shares.a).toBeCloseTo(0.6, 6);
    expect(shares.b).toBeCloseTo(0.3, 6);
  });

  it('weights the prior and the live data equally at the prior weight', () => {
    // 100 live responses, all for `c`, against a prior worth 100.
    const shares = blendShares(PRIOR, { counts: { c: 100 }, total: 100 });
    expect(shares.c).toBeCloseTo((0.1 * 100 + 100) / 200, 6);
  });

  it('lets real data swamp the prior once there is ten times as much', () => {
    const shares = blendShares(PRIOR, { counts: { c: 1000 }, total: 1000 });
    expect(shares.c).toBeGreaterThan(0.9);
    expect(shares.a).toBeLessThan(0.06);
  });

  it('always returns shares that sum to 1', () => {
    for (const total of [0, 1, 37, 100, 10_000]) {
      const shares = blendShares(PRIOR, { counts: { a: total * 0.4, b: total * 0.6 }, total });
      const sum = Object.values(shares).reduce((acc, value) => acc + value, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it('normalises a prior that does not sum to 1', () => {
    const shares = normalizeShares({ a: 2, b: 2 });
    expect(shares.a).toBe(0.5);
    expect(shares.b).toBe(0.5);
  });

  it('blends a single percentage the same way', () => {
    expect(blendPercentage(60, 100, { counts: {}, total: 0 })).toBe(60);
    // 100 responses averaging 100% against a prior of 60 at weight 100.
    expect(blendPercentage(60, 100, { counts: { yes: 100 }, total: 100 })).toBe(80);
  });
});

describe('crowd alignment', () => {
  const shares = { a: 0.5, b: 0.45, c: 0.05 };

  it('pays full marks for picking the majority', () => {
    expect(crowdAlignment(shares, 'a', 'most')).toBe(1);
  });

  it('barely punishes a near-tie', () => {
    expect(crowdAlignment(shares, 'b', 'most')).toBeGreaterThan(0.8);
  });

  it('punishes the lonely option under "most"', () => {
    expect(crowdAlignment(shares, 'c', 'most')).toBeLessThan(0.05);
  });

  it('inverts cleanly for "avoid the crowd"', () => {
    expect(crowdAlignment(shares, 'c', 'least')).toBe(1);
    expect(crowdAlignment(shares, 'a', 'least')).toBeLessThan(0.05);
  });

  it('names the winner in both directions', () => {
    expect(crowdWinner(shares, 'most')).toBe('a');
    expect(crowdWinner(shares, 'least')).toBe('c');
  });
});

describe('crowd families score against the blend', () => {
  it('majority moves as the population moves', () => {
    const config = majority.createConfig('seed', 0.5) as MajorityConfig;
    const outsider = Object.entries(config.priorShares).sort((a, b) => a[1] - b[1])[0]?.[0] as string;

    const cold = majority.score(config, { pickedId: outsider, elapsedMs: 1_000 }, { crowd: { counts: {}, total: 0 } });
    const warm = majority.score(
      config,
      { pickedId: outsider, elapsedMs: 1_000 },
      { crowd: { counts: { [outsider]: 5_000 }, total: 5_000 } },
    );
    expect(warm.points).toBeGreaterThan(cold.points);
    expect(warm.points).toBe(2000);
  });

  it('split scores the distance from the blended figure', () => {
    const config = split.createConfig('seed', 0.5) as SplitConfig;
    const spotOn = split.score(config, { predicted: config.priorPercent, elapsedMs: 1_000 }, undefined);
    const wild = split.score(config, { predicted: (config.priorPercent + 50) % 100, elapsedMs: 1_000 }, undefined);
    expect(spotOn.points).toBe(2000);
    expect(wild.points).toBeLessThan(spotOn.points);
  });

  it('avoid rewards the option nobody took', () => {
    const config = avoid.createConfig('seed', 0.5) as AvoidConfig;
    const first = config.options[0]?.id as string;
    const rest = config.options.slice(1).map((option) => option.id);
    const counts = Object.fromEntries(rest.map((id) => [id, 3_000]));
    const alone = avoid.score(config, { pickedId: first, elapsedMs: 1_000 }, { crowd: { counts, total: 9_000 } });
    const crowded = avoid.score(config, { pickedId: rest[0] as string, elapsedMs: 1_000 }, { crowd: { counts, total: 9_000 } });
    expect(alone.points).toBe(2000);
    expect(crowded.points).toBeLessThan(alone.points);
  });

  it('gives every player a scoreable result even as the first player of the day', () => {
    const config = majority.createConfig('seed-2', 0.5) as MajorityConfig;
    const result = majority.score(config, { pickedId: config.options[0]?.id as string, elapsedMs: 1_000 }, undefined);
    expect(result.points).toBeGreaterThan(0);
    expect(Number.isInteger(result.points)).toBe(true);
  });
});
