import { createRng } from '@/lib/rng';
import { distanceScore, finalize } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface GrowConfig {
  /** Target size as a fraction of the play field, 0..1. */
  targetSize: number;
  /** Size at t=0. */
  startSize: number;
  /** Growth per second, in fractions of the field. */
  growthPerSecond: number;
  perfect: number;
  zero: number;
}

export interface GrowResult {
  /** Milliseconds the shape was allowed to grow. */
  releaseMs: number;
}

export function sizeAt(config: GrowConfig, ms: number): number {
  return config.startSize + (config.growthPerSecond * ms) / 1000;
}

export const grow: GameDefinition<GrowConfig, GrowResult> = {
  id: 'nerve.grow',
  pillar: 'nerve',
  name: 'Grow',
  instruction: () => 'Release the moment it fills the ring.',
  hint: () => 'It only grows. There is no going back.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:nerve.grow`);
    return {
      targetSize: rng.round(0.52, 0.86, 3),
      startSize: 0.06,
      growthPerSecond: rng.round(0.22 + difficulty * 0.1, 0.36 + difficulty * 0.18, 3),
      perfect: 0.008,
      zero: 0.26 - difficulty * 0.07,
    };
  },

  validateConfig(config) {
    if (config.targetSize <= config.startSize) throw new Error('grow: target below start');
    if (config.growthPerSecond <= 0) throw new Error('grow: no growth');
    if (config.zero <= config.perfect) throw new Error('grow: bad tolerance band');
  },

  validateResult(_config, result) {
    const value = (result as Partial<GrowResult> | null)?.releaseMs;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 60_000) {
      throw new Error('grow: releaseMs out of range');
    }
    return { releaseMs: Math.round(value) };
  },

  score(config, result) {
    const size = sizeAt(config, result.releaseMs);
    const error = size - config.targetSize;
    const normalized = distanceScore({
      error,
      perfect: config.perfect,
      zero: config.zero,
      falloff: 1.6,
    });
    return finalize(Math.round(error * 1000) / 10, normalized);
  },

  timingWindow: () => [150, 45_000],
};
