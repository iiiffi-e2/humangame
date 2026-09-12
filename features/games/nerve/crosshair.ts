import { createRng } from '@/lib/rng';
import { distanceScore, finalize } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface CrosshairConfig {
  /** Milliseconds for one full sweep of the horizontal bar. */
  periodXMs: number;
  periodYMs: number;
  /** Starting offsets, 0..1 of a period. */
  phaseX: number;
  phaseY: number;
  /** Distance (in 0..1 field units) that still counts as perfect. */
  perfect: number;
  zero: number;
}

export interface CrosshairResult {
  /** Milliseconds from the start of the sweep to the tap. */
  tapMs: number;
}

/** Triangle wave in 0..1 — a bar bouncing between the two edges. */
export function barPosition(tMs: number, periodMs: number, phase: number): number {
  const t = ((tMs / periodMs + phase) % 1 + 1) % 1;
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

export const crosshair: GameDefinition<CrosshairConfig, CrosshairResult> = {
  id: 'nerve.crosshair',
  pillar: 'nerve',
  name: 'Crosshair',
  instruction: () => 'Tap when the two bars cross.',
  hint: () => 'They only line up for a moment.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:nerve.crosshair`);
    return {
      periodXMs: Math.round(rng.float(1500 - difficulty * 420, 2300 - difficulty * 560)),
      periodYMs: Math.round(rng.float(1150 - difficulty * 320, 1900 - difficulty * 470)),
      phaseX: rng.round(0, 1, 4),
      phaseY: rng.round(0, 1, 4),
      perfect: 0.012,
      zero: 0.42 - difficulty * 0.1,
    };
  },

  validateConfig(config) {
    if (config.periodXMs < 300 || config.periodYMs < 300) {
      throw new Error('crosshair: period too short');
    }
    if (config.zero <= config.perfect) throw new Error('crosshair: bad tolerance band');
  },

  validateResult(_config, result) {
    const value = (result as Partial<CrosshairResult> | null)?.tapMs;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 120_000) {
      throw new Error('crosshair: tapMs out of range');
    }
    return { tapMs: Math.round(value) };
  },

  score(config, result) {
    const x = barPosition(result.tapMs, config.periodXMs, config.phaseX);
    const y = barPosition(result.tapMs, config.periodYMs, config.phaseY);
    const error = Math.abs(x - y);
    const normalized = distanceScore({
      error,
      perfect: config.perfect,
      zero: config.zero,
      falloff: 1.5,
    });
    return finalize(Math.round(error * 1000) / 10, normalized);
  },

  timingWindow: () => [150, 40_000],
};
