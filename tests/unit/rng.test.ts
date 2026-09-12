import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '@/lib/rng';

describe('seeded randomness', () => {
  it('is identical for identical seeds', () => {
    const a = createRng('human:2026-09-12:0');
    const b = createRng('human:2026-09-12:0');
    for (let i = 0; i < 200; i += 1) expect(a.next()).toBe(b.next());
  });

  it('diverges for seeds that differ by one character', () => {
    const a = createRng('human:2026-09-12:0');
    const b = createRng('human:2026-09-12:1');
    const first = Array.from({ length: 10 }, () => a.next());
    const second = Array.from({ length: 10 }, () => b.next());
    expect(first).not.toEqual(second);
  });

  it('stays inside [0, 1)', () => {
    const rng = createRng('bounds');
    for (let i = 0; i < 5_000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces integers inside the requested inclusive range', () => {
    const rng = createRng('ints');
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i += 1) {
      const value = rng.int(3, 7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      seen.add(value);
    }
    expect(seen.size).toBe(5);
  });

  it('shuffles without losing or duplicating items', () => {
    const rng = createRng('shuffle');
    const input = ['a', 'b', 'c', 'd', 'e'];
    const output = rng.shuffle(input);
    expect(output).toHaveLength(input.length);
    expect([...output].sort()).toEqual([...input].sort());
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('samples distinct items and refuses impossible requests', () => {
    const rng = createRng('sample');
    expect(new Set(rng.sample([1, 2, 3, 4, 5], 3)).size).toBe(3);
    expect(() => rng.sample([1, 2], 3)).toThrow();
  });

  it('hashes a seed to four distinct 32-bit values', () => {
    const parts = hashSeed('human');
    expect(parts).toHaveLength(4);
    for (const part of parts) {
      expect(Number.isInteger(part)).toBe(true);
      expect(part).toBeGreaterThanOrEqual(0);
      expect(part).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('is roughly uniform', () => {
    const rng = createRng('uniform');
    const buckets = new Array(10).fill(0);
    const samples = 50_000;
    for (let i = 0; i < samples; i += 1) {
      buckets[Math.floor(rng.next() * 10)] += 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(samples / 10 - samples * 0.01);
      expect(count).toBeLessThan(samples / 10 + samples * 0.01);
    }
  });
});
