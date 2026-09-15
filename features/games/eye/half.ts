import { createRng } from '@/lib/rng';
import { distanceScore, finalizeTimed, readElapsedMs, SPEED_BAND } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface HalfConfig {
  /** Rotation of the line in degrees, -30..30. */
  angleDeg: number;
  /** Length of the line as a fraction of the field width, 0..1. */
  length: number;
  /** Fraction along the line the player must hit. Always 0.5 in v1. */
  target: number;
  perfect: number;
  zero: number;
}

export interface HalfResult {
  /** Where the player tapped, as a fraction along the line. */
  fraction: number;
  elapsedMs: number;
}

export const half: GameDefinition<HalfConfig, HalfResult> = {
  id: 'eye.half',
  pillar: 'eye',
  name: 'Half',
  instruction: () => 'Tap the exact middle of the line.',
  hint: () => 'No marks, no second try.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:eye.half`);
    return {
      angleDeg: rng.round(-24 * difficulty - 3, 24 * difficulty + 3, 1),
      length: rng.round(0.68, 0.94, 3),
      target: 0.5,
      perfect: 0.004,
      zero: 0.16 - difficulty * 0.05,
    };
  },

  validateConfig(config) {
    if (config.target < 0 || config.target > 1) throw new Error('half: target out of range');
    if (config.length <= 0.2) throw new Error('half: line too short');
    if (config.zero <= config.perfect) throw new Error('half: bad tolerance band');
  },

  validateResult(_config, result) {
    const value = (result as Partial<HalfResult> | null)?.fraction;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -0.5 || value > 1.5) {
      throw new Error('half: fraction out of range');
    }
    return {
      fraction: Math.round(value * 10_000) / 10_000,
      elapsedMs: readElapsedMs((result as Partial<HalfResult> | null)?.elapsedMs, SPEED_BAND.eye.slowMs),
    };
  },

  score(config, result) {
    const error = result.fraction - config.target;
    const accuracy = distanceScore({
      error,
      perfect: config.perfect,
      zero: config.zero,
      falloff: 1.5,
    });
    return finalizeTimed(Math.round(error * 1000) / 10, accuracy, result.elapsedMs, SPEED_BAND.eye);
  },

  timingWindow: () => [200, 40_000],
};
