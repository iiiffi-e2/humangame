import { describe, expect, it } from 'vitest';
import {
  MAX_EVENT_POINTS,
  MAX_RUN_POINTS,
  applySpeed,
  categoricalScore,
  closenessLabel,
  distanceScore,
  headlineFor,
  paceFor,
  percentageScore,
  pillarPercent,
  rankingScore,
  readElapsedMs,
  sequenceScore,
  tierFor,
  toPoints,
  totalScore,
} from '@/lib/scoring';

describe('distanceScore', () => {
  it('pays full marks inside the perfect band', () => {
    expect(distanceScore({ error: 0, perfect: 20, zero: 500 })).toBe(1);
    expect(distanceScore({ error: -19, perfect: 20, zero: 500 })).toBe(1);
  });

  it('pays nothing at or beyond the zero point', () => {
    expect(distanceScore({ error: 500, perfect: 20, zero: 500 })).toBe(0);
    expect(distanceScore({ error: 9000, perfect: 20, zero: 500 })).toBe(0);
  });

  it('is symmetric around the target', () => {
    const early = distanceScore({ error: -120, perfect: 20, zero: 500 });
    const late = distanceScore({ error: 120, perfect: 20, zero: 500 });
    expect(early).toBe(late);
  });

  it('decreases monotonically as error grows', () => {
    let previous = 1;
    for (let error = 0; error <= 500; error += 25) {
      const value = distanceScore({ error, perfect: 20, zero: 500 });
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('rejects nonsense without throwing', () => {
    expect(distanceScore({ error: Number.NaN, perfect: 1, zero: 2 })).toBe(0);
  });
});

describe('applySpeed', () => {
  const band = { elapsedMs: 0, parMs: 5_000, slowMs: 22_000, speedWeight: 0.28 };

  it('leaves accuracy alone when the player is at or under par', () => {
    expect(applySpeed(0.9, { ...band, elapsedMs: 4_000 })).toBe(0.9);
    expect(applySpeed(1, { ...band, elapsedMs: 5_000 })).toBe(1);
  });

  it('keeps a floor of accuracy × (1 − speedWeight) when the clock is gone', () => {
    expect(applySpeed(1, { ...band, elapsedMs: 60_000 })).toBeCloseTo(0.72, 5);
  });

  it('never lets a fast miss beat a slow hit', () => {
    const fastMiss = applySpeed(0.4, { ...band, elapsedMs: 800 });
    const slowHit = applySpeed(1, { ...band, elapsedMs: 21_999 });
    expect(slowHit).toBeGreaterThan(fastMiss);
  });

  it('stays zero when accuracy is zero, no matter how fast', () => {
    expect(applySpeed(0, { ...band, elapsedMs: 200 })).toBe(0);
  });
});

describe('pace and closeness copy', () => {
  it('names pace from the same par/slow band the points use', () => {
    expect(paceFor(3_000, 5_000, 22_000)).toBe('Quick');
    expect(paceFor(9_000, 5_000, 22_000)).toBe('On pace');
    expect(paceFor(18_000, 5_000, 22_000)).toBe('A bit slow');
    expect(paceFor(30_000, 5_000, 22_000)).toBe('Slow');
  });

  it('names closeness from accuracy, not from the speed-adjusted score', () => {
    expect(closenessLabel(1)).toBe('Spot on');
    expect(closenessLabel(0.9)).toBe('Close');
    expect(closenessLabel(0.5)).toBe('Off');
    expect(closenessLabel(0.1)).toBe('Missed');
  });
});

describe('readElapsedMs', () => {
  it('clamps a real clock and falls back to slow when the client omits it', () => {
    expect(readElapsedMs(1234.8, 22_000)).toBe(1235);
    expect(readElapsedMs(undefined, 22_000)).toBe(22_000);
    expect(readElapsedMs(-40, 22_000)).toBe(0);
  });
});

describe('categoricalScore', () => {
  it('never lets a fast wrong answer beat a slow right one', () => {
    const fastWrong = categoricalScore({ correct: false, elapsedMs: 100, parMs: 3000, slowMs: 12000 });
    const slowRight = categoricalScore({ correct: true, elapsedMs: 11_999, parMs: 3000, slowMs: 12000 });
    expect(slowRight).toBeGreaterThan(fastWrong);
  });

  it('gives the full speed bonus at or under par', () => {
    expect(categoricalScore({ correct: true, elapsedMs: 1200, parMs: 3000, slowMs: 12000 })).toBe(1);
  });

  it('keeps the base score when the bonus is gone', () => {
    const value = categoricalScore({
      correct: true,
      elapsedMs: 60_000,
      parMs: 3000,
      slowMs: 12_000,
      speedWeight: 0.3,
    });
    expect(value).toBeCloseTo(0.7, 5);
  });
});

describe('sequenceScore', () => {
  it('is 1 for an exact reproduction', () => {
    expect(sequenceScore({ expected: ['a', 'b', 'c'], actual: ['a', 'b', 'c'] })).toBe(1);
  });

  it('gives partial credit for a correct prefix', () => {
    const value = sequenceScore({ expected: ['a', 'b', 'c', 'd'], actual: ['a', 'b', 'x', 'y'] });
    expect(value).toBeGreaterThan(0.2);
    expect(value).toBeLessThan(0.7);
  });

  it('rewards the right items in the wrong order, but less', () => {
    const rightOrder = sequenceScore({ expected: ['a', 'b', 'c'], actual: ['a', 'b', 'c'] });
    const wrongOrder = sequenceScore({ expected: ['a', 'b', 'c'], actual: ['c', 'b', 'a'] });
    expect(wrongOrder).toBeGreaterThan(0);
    expect(wrongOrder).toBeLessThan(rightOrder);
  });

  it('penalises spamming more answers than there are slots', () => {
    const honest = sequenceScore({ expected: ['a', 'b'], actual: ['a', 'b'] });
    const spam = sequenceScore({ expected: ['a', 'b'], actual: ['a', 'b', 'a', 'b', 'a', 'b'] });
    expect(spam).toBeLessThan(honest);
  });
});

describe('rankingScore', () => {
  const expected = ['a', 'b', 'c', 'd', 'e'];

  it('is 1 for the right order and 0 for the reverse', () => {
    expect(rankingScore({ expected, actual: [...expected] })).toBe(1);
    expect(rankingScore({ expected, actual: [...expected].reverse() })).toBe(0);
  });

  it('squeezes a random ordering below half marks', () => {
    // One adjacent swap out of ten pairs: 90% agreement.
    const value = rankingScore({ expected, actual: ['b', 'a', 'c', 'd', 'e'] });
    expect(value).toBeGreaterThan(0.7);
    expect(value).toBeLessThan(1);
  });

  it('refuses an answer with missing or unknown ids', () => {
    expect(rankingScore({ expected, actual: ['a', 'b', 'c'] })).toBe(0);
    expect(rankingScore({ expected, actual: ['a', 'b', 'c', 'd', 'z'] })).toBe(0);
  });
});

describe('percentageScore', () => {
  it('is exact within the perfect band', () => {
    expect(percentageScore({ predicted: 62, actual: 63 })).toBe(1);
  });

  it('falls to zero at the far edge', () => {
    expect(percentageScore({ predicted: 10, actual: 63, zero: 40 })).toBe(0);
  });
});

describe('totalScore', () => {
  it('sums five events into 0..10,000', () => {
    expect(totalScore([2000, 2000, 2000, 2000, 2000])).toBe(MAX_RUN_POINTS);
    expect(totalScore([0, 0, 0, 0, 0])).toBe(0);
    expect(totalScore([1000, 1000, 1000, 1000, 1000])).toBe(5000);
  });

  it('rescales a day with a voided event so it is still out of 10,000', () => {
    // Four perfect events with the fifth voided is still a perfect day.
    expect(totalScore([2000, 2000, 0, 2000, 2000], [2])).toBe(MAX_RUN_POINTS);
    expect(totalScore([1000, 1000, 0, 1000, 1000], [2])).toBe(5000);
  });

  it('never exceeds the cap even with bad input', () => {
    expect(totalScore([9999, 9999, 9999, 9999, 9999])).toBe(MAX_RUN_POINTS);
  });
});

describe('labels', () => {
  it('maps quality to a tier and a headline', () => {
    expect(tierFor(1)).toBe('Flawless');
    expect(tierFor(0)).toBe('Cooked');
    expect(headlineFor(0.95)).toBe('Nailed it.');
  });

  it('converts points to whole percentages for the bars', () => {
    expect(pillarPercent(MAX_EVENT_POINTS)).toBe(100);
    expect(pillarPercent(1000)).toBe(50);
    expect(toPoints(0.5)).toBe(1000);
  });
});
