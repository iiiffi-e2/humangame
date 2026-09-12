import { createRng } from '@/lib/rng';
import { distanceScore, finalize } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface DeadStopConfig {
  /** Hold duration the player is asked to hit, in milliseconds. */
  targetMs: number;
  /** Error that still counts as perfect, in milliseconds. */
  perfectMs: number;
  /** Error at which the event scores zero. */
  zeroMs: number;
}

export interface DeadStopResult {
  heldMs: number;
}

export const deadStop: GameDefinition<DeadStopConfig, DeadStopResult> = {
  id: 'nerve.dead-stop',
  pillar: 'nerve',
  name: 'Dead stop',
  instruction: (config) =>
    `Hold for exactly ${(config.targetMs / 1000).toFixed(2)} seconds.`,
  hint: () => 'Clock disappears while you hold.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:nerve.dead-stop`);
    // Longer holds are harder to judge without a clock.
    const targetMs = Math.round(rng.float(1800 + difficulty * 900, 3600 + difficulty * 1400));
    return {
      targetMs,
      perfectMs: Math.round(28 - difficulty * 12),
      zeroMs: Math.round(760 - difficulty * 230),
    };
  },

  validateConfig(config) {
    if (config.targetMs < 500 || config.targetMs > 8000) {
      throw new Error('dead-stop: targetMs out of range');
    }
    if (config.perfectMs <= 0 || config.zeroMs <= config.perfectMs) {
      throw new Error('dead-stop: bad tolerance band');
    }
  },

  validateResult(_config, result) {
    const value = (result as Partial<DeadStopResult> | null)?.heldMs;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 60_000) {
      throw new Error('dead-stop: heldMs out of range');
    }
    return { heldMs: Math.round(value) };
  },

  score(config, result) {
    const error = result.heldMs - config.targetMs;
    const normalized = distanceScore({
      error,
      perfect: config.perfectMs,
      zero: config.zeroMs,
      falloff: 1.7,
    });
    return finalize(Math.round(error), normalized);
  },

  timingWindow: (config) => [200, config.targetMs + 20_000],
};
