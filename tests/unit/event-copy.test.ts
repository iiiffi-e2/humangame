import { describe, expect, it } from 'vitest';
import { eventChips, exactMetric } from '@/features/results/event-copy';
import type { ScoreResult } from '@/lib/scoring';

const timed: ScoreResult = {
  rawMetric: 2.4,
  normalized: 0.85,
  points: 1700,
  label: 'Elite',
  accuracy: 0.96,
  closeness: 'Close',
  pace: 'A bit slow',
};

describe('eventChips', () => {
  it('keeps the exact miss on Nerve — the clock is the puzzle', () => {
    const nerve: ScoreResult = {
      rawMetric: -40,
      normalized: 0.9,
      points: 1800,
      label: 'Unreal',
    };
    const chips = eventChips('nerve.dead-stop', nerve);
    expect(chips.primary).toBe('40 ms early');
    expect(chips.secondary).toBe('Unreal');
  });

  it('hides copyable measurements mid-run on Eye', () => {
    const chips = eventChips('eye.percent', timed);
    expect(chips.primary).toBe('Close');
    expect(chips.secondary).toBe('A bit slow');
    expect(chips.primary).not.toMatch(/%/);
  });
});

describe('exactMetric', () => {
  it('still knows the precise miss for the final reveal', () => {
    expect(exactMetric('eye.percent', 2.4)).toBe('2.4% off');
    expect(exactMetric('eye.angle', -3.5)).toBe('3.5° off');
    expect(exactMetric('memory.sequence', 4)).toBe('4 in a row');
  });
});
