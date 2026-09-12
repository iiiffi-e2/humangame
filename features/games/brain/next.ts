import { createRng } from '@/lib/rng';
import { categoricalScore, finalize } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

/** A tile is a 3x3 bitmask, drawn as filled cells. */
export interface NextTile {
  id: string;
  cells: number[];
  rotation: number;
}

export interface NextConfig {
  /** The visible run of tiles. */
  sequence: NextTile[];
  /** Four answer tiles, one of which continues the run. */
  options: NextTile[];
  answerId: string;
  parMs: number;
  slowMs: number;
}

export interface NextResult {
  pickedId: string;
  elapsedMs: number;
}

const BASE_SHAPES: readonly number[][] = [
  [0, 1, 2, 4],
  [0, 4, 8, 6],
  [1, 3, 4, 5],
  [0, 1, 4, 7],
  [0, 2, 4, 6],
  [3, 4, 5, 7],
];

/** Rotate a 3x3 bitmask 90 degrees clockwise, `times` times. */
export function rotateCells(cells: readonly number[], times: number): number[] {
  let current = [...cells];
  const steps = ((times % 4) + 4) % 4;
  for (let step = 0; step < steps; step += 1) {
    current = current.map((index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      return col * 3 + (2 - row);
    });
  }
  return [...new Set(current)].sort((a, b) => a - b);
}

export const next: GameDefinition<NextConfig, NextResult> = {
  id: 'brain.next',
  pillar: 'brain',
  name: 'Next',
  instruction: () => 'Which tile comes next?',
  hint: () => 'The run turns the same way every step.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:brain.next`);
    const base = rng.pick(BASE_SHAPES);
    const step = rng.pick([1, 3]);
    const start = rng.int(0, 3);
    const length = difficulty > 0.6 ? 4 : 3;

    const tileAt = (position: number, id: string): NextTile => {
      const rotation = (start + step * position) % 4;
      return { id, cells: rotateCells(base, rotation), rotation };
    };

    const sequenceTiles = Array.from({ length }, (_, index) => tileAt(index, `s${index}`));
    const answer = tileAt(length, 'o0');
    const distractors: NextTile[] = [];
    const usedRotations = new Set([answer.rotation]);
    for (let rotation = 0; rotation < 4 && distractors.length < 2; rotation += 1) {
      if (usedRotations.has(rotation)) continue;
      usedRotations.add(rotation);
      distractors.push({
        id: `o${distractors.length + 1}`,
        cells: rotateCells(base, rotation),
        rotation,
      });
    }
    // One distractor from a different shape family, same rotation as the answer.
    const otherShape = rng.pick(BASE_SHAPES.filter((shape) => shape !== base));
    distractors.push({
      id: `o${distractors.length + 1}`,
      cells: rotateCells(otherShape, answer.rotation),
      rotation: answer.rotation,
    });

    return {
      sequence: sequenceTiles,
      options: rng.shuffle([answer, ...distractors]),
      answerId: answer.id,
      parMs: 4200,
      slowMs: 15_000,
    };
  },

  validateConfig(config) {
    if (config.options.length < 3) throw new Error('next: too few options');
    if (!config.options.some((option) => option.id === config.answerId)) {
      throw new Error('next: answer not among options');
    }
  },

  redactConfig(config) {
    return { ...config, answerId: '' };
  },

  validateResult(config, result) {
    const value = result as Partial<NextResult> | null;
    if (typeof value?.pickedId !== 'string') throw new Error('next: pickedId missing');
    if (!config.options.some((option) => option.id === value.pickedId)) {
      throw new Error('next: unknown pickedId');
    }
    const elapsedMs = typeof value.elapsedMs === 'number' && Number.isFinite(value.elapsedMs)
      ? Math.max(0, Math.min(180_000, Math.round(value.elapsedMs)))
      : config.slowMs;
    return { pickedId: value.pickedId, elapsedMs };
  },

  score(config, result) {
    const normalized = categoricalScore({
      correct: result.pickedId === config.answerId,
      elapsedMs: result.elapsedMs,
      parMs: config.parMs,
      slowMs: config.slowMs,
      speedWeight: 0.32,
    });
    return finalize(result.elapsedMs, normalized);
  },

  timingWindow: () => [400, 120_000],
};
