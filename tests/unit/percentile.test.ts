import { describe, expect, it } from 'vitest';
import { histogram, isProvisional, median, percentileOf, rankOf, topPercent } from '@/features/results/percentile';

describe('percentileOf', () => {
  it('splits ties so an all-equal field beats 50%', () => {
    expect(percentileOf({ score: 5000, population: [5000, 5000, 5000] })).toBe(50);
  });

  it('is 0 for the worst score and near 100 for the best', () => {
    const population = [1000, 2000, 3000, 4000, 5000];
    expect(percentileOf({ score: 1000, population })).toBe(10);
    expect(percentileOf({ score: 5000, population })).toBe(90);
  });

  it('places a score above everyone at the top', () => {
    expect(percentileOf({ score: 9999, population: [1, 2, 3, 4] })).toBe(100);
  });

  it('defaults to the middle when there is no population yet', () => {
    expect(percentileOf({ score: 8000, population: [] })).toBe(50);
  });

  it('inverts cleanly into a "top N%" badge', () => {
    expect(topPercent(94)).toBe(6);
    expect(topPercent(100)).toBe(1);
  });

  it('ranks by how many scored higher', () => {
    expect(rankOf(8000, [9000, 8500, 8000, 100])).toBe(3);
    expect(rankOf(9999, [9000, 8500])).toBe(1);
  });
});

describe('day statistics', () => {
  it('takes the median of an odd and an even field', () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBe(0);
  });

  it('buckets scores across the full range', () => {
    const buckets = histogram([0, 5000, 9999], 10);
    expect(buckets).toHaveLength(10);
    expect(buckets[0]).toBe(1);
    expect(buckets[5]).toBe(1);
    expect(buckets[9]).toBe(1);
  });

  it('calls a thin day provisional', () => {
    expect(isProvisional(10)).toBe(true);
    expect(isProvisional(5000)).toBe(false);
  });
});
