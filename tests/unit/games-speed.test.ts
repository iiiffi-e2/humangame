import { describe, expect, it } from 'vitest';
import { percent } from '@/features/games/eye/percent';
import { half } from '@/features/games/eye/half';
import { angle } from '@/features/games/eye/angle';
import { flashGrid } from '@/features/games/memory/flash-grid';
import { sequence } from '@/features/games/memory/sequence';
import { order } from '@/features/games/brain/order';
import { next } from '@/features/games/brain/next';
import { majority } from '@/features/games/crowd/majority';
import { split } from '@/features/games/crowd/split';
import { SPEED_BAND, toPoints } from '@/lib/scoring';

describe('medium time on non-Nerve families', () => {
  it('pays a slow perfect Percent less than a fast one', () => {
    const config = percent.createConfig('speed-seed', 0);
    const fast = percent.score(config, {
      valuePercent: config.targetPercent,
      elapsedMs: 2_000,
    });
    const slow = percent.score(config, {
      valuePercent: config.targetPercent,
      elapsedMs: 40_000,
    });
    expect(fast.points).toBe(2000);
    expect(slow.points).toBe(toPoints(1 - SPEED_BAND.eye.speedWeight));
    expect(fast.closeness).toBe('Spot on');
    expect(slow.pace).toBe('Slow');
  });

  it('treats a missing Percent clock as slow, not as a free perfect', () => {
    const config = percent.createConfig('speed-seed', 0);
    const omitted = percent.score(config, percent.validateResult(config, {
      valuePercent: config.targetPercent,
    }));
    const slow = percent.score(config, {
      valuePercent: config.targetPercent,
      elapsedMs: SPEED_BAND.eye.slowMs,
    });
    expect(omitted.points).toBeLessThan(2000);
    expect(omitted.points).toBe(slow.points);
  });

  it('applies the same rule across Eye, Memory, Order, and Crowd', () => {
    const halfConfig = half.createConfig('speed-seed', 0);
    expect(
      half.score(halfConfig, { fraction: halfConfig.target, elapsedMs: 40_000 }).points,
    ).toBeLessThan(2000);

    const angleConfig = angle.createConfig('speed-seed', 0);
    expect(
      angle.score(angleConfig, { deg: angleConfig.targetDeg, elapsedMs: 40_000 }).points,
    ).toBeLessThan(2000);

    const grid = flashGrid.createConfig('speed-seed', 0);
    expect(
      flashGrid.score(grid, { picked: grid.cells, elapsedMs: 40_000 }).points,
    ).toBeLessThan(2000);

    const seq = sequence.createConfig('speed-seed', 0);
    expect(
      sequence.score(seq, { entered: seq.sequence, elapsedMs: 40_000 }).points,
    ).toBeLessThan(2000);

    const orderConfig = order.createConfig('speed-seed', 0);
    expect(
      order.score(orderConfig, { order: orderConfig.solution, elapsedMs: 50_000 }).points,
    ).toBeLessThan(2000);

    const nextConfig = next.createConfig('speed-seed', 0);
    const slowNext = next.score(nextConfig, {
      pickedId: nextConfig.answerId,
      elapsedMs: nextConfig.slowMs,
    });
    expect(slowNext.pace).toBe('Slow');

    const majorityConfig = majority.createConfig('speed-seed', 0);
    const crowdPick = majorityConfig.options[0]!.id;
    expect(
      majority.score(majorityConfig, { pickedId: crowdPick, elapsedMs: 40_000 }).pace,
    ).toBe('Slow');

    const splitConfig = split.createConfig('speed-seed', 0);
    expect(
      split.score(splitConfig, { predicted: splitConfig.priorPercent, elapsedMs: 40_000 }).points,
    ).toBeLessThan(2000);
  });
});
