import { createRng } from '@/lib/rng';
import { distanceScore, finalizeTimed, readElapsedMs, SPEED_BAND } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface AngleConfig {
  /** Angle the player must reach, 0..359 degrees, clockwise from 12 o'clock. */
  targetDeg: number;
  /** Where the ray starts. */
  startDeg: number;
  perfect: number;
  zero: number;
}

export interface AngleResult {
  deg: number;
  elapsedMs: number;
}

/** Shortest signed distance between two bearings, in -180..180. */
export function angleDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180;
}

export const angle: GameDefinition<AngleConfig, AngleResult> = {
  id: 'eye.angle',
  pillar: 'eye',
  name: 'Angle',
  instruction: (config) => `Swing the ray to ${config.targetDeg}°.`,
  hint: () => 'Zero is straight up. Clockwise is positive.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:eye.angle`);
    const candidates: number[] = [];
    for (let value = 5; value < 360; value += 1) {
      if (value % 15 !== 0) candidates.push(value);
    }
    const targetDeg = rng.pick(candidates);
    return {
      targetDeg,
      startDeg: (targetDeg + rng.int(70, 290)) % 360,
      perfect: 1.5,
      zero: 58 - difficulty * 18,
    };
  },

  validateConfig(config) {
    if (config.targetDeg < 0 || config.targetDeg >= 360) {
      throw new Error('angle: target out of range');
    }
    if (config.zero <= config.perfect) throw new Error('angle: bad tolerance band');
  },

  validateResult(_config, result) {
    const value = (result as Partial<AngleResult> | null)?.deg;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('angle: deg missing');
    }
    return {
      deg: ((value % 360) + 360) % 360,
      elapsedMs: readElapsedMs((result as Partial<AngleResult> | null)?.elapsedMs, SPEED_BAND.eye.slowMs),
    };
  },

  score(config, result) {
    const error = angleDelta(result.deg, config.targetDeg);
    const accuracy = distanceScore({
      error,
      perfect: config.perfect,
      zero: config.zero,
      falloff: 1.5,
    });
    return finalizeTimed(Math.round(error * 10) / 10, accuracy, result.elapsedMs, SPEED_BAND.eye);
  },

  timingWindow: () => [300, 45_000],
};
