import { createRng } from '@/lib/rng';
import { finalizeTimed, percentageScore, readElapsedMs, SPEED_BAND } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface PercentConfig {
  /** The fill level the player has to reproduce, 0..100. */
  targetPercent: number;
  /** Fill the tank starts at, so nobody gets a free hit. */
  startPercent: number;
  perfect: number;
  zero: number;
}

export interface PercentResult {
  valuePercent: number;
  elapsedMs: number;
}

export const percent: GameDefinition<PercentConfig, PercentResult> = {
  id: 'eye.percent',
  pillar: 'eye',
  name: 'Percent',
  instruction: (config) => `Fill this to ${config.targetPercent}%.`,
  hint: () => 'Drag up or down. No markings. Tap LOCK when set.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:eye.percent`);
    // Avoid the visually obvious quarters — they are free points.
    const candidates: number[] = [];
    for (let value = 8; value <= 92; value += 1) {
      if (value % 25 !== 0 && value % 10 !== 0) candidates.push(value);
    }
    return {
      targetPercent: rng.pick(candidates),
      startPercent: rng.int(20, 80),
      perfect: 1,
      zero: 34 - difficulty * 10,
    };
  },

  validateConfig(config) {
    if (config.targetPercent < 0 || config.targetPercent > 100) {
      throw new Error('percent: target out of range');
    }
    if (config.zero <= config.perfect) throw new Error('percent: bad tolerance band');
  },

  validateResult(_config, result) {
    const value = (result as Partial<PercentResult> | null)?.valuePercent;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('percent: value out of range');
    }
    return {
      valuePercent: Math.round(value * 10) / 10,
      elapsedMs: readElapsedMs((result as Partial<PercentResult> | null)?.elapsedMs, SPEED_BAND.eye.slowMs),
    };
  },

  score(config, result) {
    const accuracy = percentageScore({
      predicted: result.valuePercent,
      actual: config.targetPercent,
      perfect: config.perfect,
      zero: config.zero,
    });
    return finalizeTimed(
      Math.round((result.valuePercent - config.targetPercent) * 10) / 10,
      accuracy,
      result.elapsedMs,
      SPEED_BAND.eye,
    );
  },

  timingWindow: () => [300, 45_000],
};
