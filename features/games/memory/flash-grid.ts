import { createRng } from '@/lib/rng';
import { finalizeTimed, readElapsedMs, sequenceScore, SPEED_BAND } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface FlashGridConfig {
  /** Grid is `size` x `size`. */
  size: number;
  /** Indexes (row-major) of the lit cells, ascending. */
  cells: number[];
  /** How long the cells stay lit. */
  flashMs: number;
}

export interface FlashGridResult {
  picked: number[];
  elapsedMs: number;
}

export const flashGrid: GameDefinition<FlashGridConfig, FlashGridResult> = {
  id: 'memory.flash-grid',
  pillar: 'memory',
  name: 'Flash grid',
  instruction: (config) => `Tap the ${config.cells.length} lit tiles.`,
  hint: () => 'Locks automatically on the last tap.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:memory.flash-grid`);
    const size = difficulty > 0.66 ? 5 : 4;
    const count = Math.round(5 + difficulty * 3);
    const all = Array.from({ length: size * size }, (_, index) => index);
    return {
      size,
      cells: rng.sample(all, count).sort((a, b) => a - b),
      flashMs: Math.round(1500 - difficulty * 550),
    };
  },

  validateConfig(config) {
    if (config.size < 3 || config.size > 6) throw new Error('flash-grid: bad size');
    const max = config.size * config.size;
    if (config.cells.length < 3 || config.cells.length > max) {
      throw new Error('flash-grid: bad cell count');
    }
    if (new Set(config.cells).size !== config.cells.length) {
      throw new Error('flash-grid: duplicate cells');
    }
    for (const cell of config.cells) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= max) {
        throw new Error('flash-grid: cell out of range');
      }
    }
  },

  validateResult(config, result) {
    const picked = (result as Partial<FlashGridResult> | null)?.picked;
    if (!Array.isArray(picked)) throw new Error('flash-grid: picked missing');
    if (picked.length > config.cells.length) throw new Error('flash-grid: too many picks');
    const max = config.size * config.size;
    for (const cell of picked) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= max) {
        throw new Error('flash-grid: pick out of range');
      }
    }
    return {
      picked: [...new Set(picked)],
      elapsedMs: readElapsedMs((result as Partial<FlashGridResult> | null)?.elapsedMs, SPEED_BAND.memory.slowMs),
    };
  },

  score(config, result) {
    // Order does not matter here, only the set of tiles.
    const expected = [...config.cells].sort((a, b) => a - b);
    const actual = [...result.picked].sort((a, b) => a - b);
    const accuracy = sequenceScore({ expected, actual, setWeight: 1 });
    const hits = actual.filter((cell) => config.cells.includes(cell)).length;
    return finalizeTimed(hits, accuracy, result.elapsedMs, SPEED_BAND.memory);
  },

  timingWindow: (config) => [config.flashMs, config.flashMs + 60_000],
};
