import { createRng } from '@/lib/rng';
import { finalizeTimed } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface WhatMovedItem {
  id: string;
  /** 0..1 field coordinates, before the shift. */
  x: number;
  y: number;
  shape: 'square' | 'circle' | 'triangle' | 'bar';
}

export interface WhatMovedConfig {
  items: WhatMovedItem[];
  movedId: string;
  /** How far the moved item shifts, in 0..1 field units. */
  shift: { dx: number; dy: number };
  previewMs: number;
  parMs: number;
  slowMs: number;
}

export interface WhatMovedResult {
  pickedId: string;
  elapsedMs: number;
}

const SHAPES = ['square', 'circle', 'triangle', 'bar'] as const;

export const whatMoved: GameDefinition<WhatMovedConfig, WhatMovedResult> = {
  id: 'memory.what-moved',
  pillar: 'memory',
  name: 'What moved',
  instruction: () => 'One thing moved. Tap it.',
  hint: () => 'Only one. Everything else is exactly where it was.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:memory.what-moved`);
    const count = Math.round(6 + difficulty * 5);
    const items: WhatMovedItem[] = [];
    // Reject-sample onto a loose grid so nothing overlaps.
    const taken = new Set<string>();
    const cols = 4;
    const rows = 5;
    while (items.length < count) {
      const col = rng.int(0, cols - 1);
      const row = rng.int(0, rows - 1);
      const key = `${col},${row}`;
      if (taken.has(key)) continue;
      taken.add(key);
      items.push({
        id: `i${items.length}`,
        x: Math.round(((col + rng.float(0.25, 0.75)) / cols) * 1000) / 1000,
        y: Math.round(((row + rng.float(0.25, 0.75)) / rows) * 1000) / 1000,
        shape: rng.pick(SHAPES),
      });
    }
    const moved = rng.pick(items);
    const magnitude = 0.075 - difficulty * 0.035;
    const theta = rng.float(0, Math.PI * 2);
    return {
      items,
      movedId: moved.id,
      shift: {
        dx: Math.round(Math.cos(theta) * magnitude * 1000) / 1000,
        dy: Math.round(Math.sin(theta) * magnitude * 1000) / 1000,
      },
      previewMs: Math.round(2400 - difficulty * 700),
      parMs: 2600,
      slowMs: 11_000,
    };
  },

  validateConfig(config) {
    if (config.items.length < 4) throw new Error('what-moved: too few items');
    if (!config.items.some((item) => item.id === config.movedId)) {
      throw new Error('what-moved: movedId not in items');
    }
  },

  validateResult(config, result) {
    const value = result as Partial<WhatMovedResult> | null;
    if (typeof value?.pickedId !== 'string') throw new Error('what-moved: pickedId missing');
    if (!config.items.some((item) => item.id === value.pickedId)) {
      throw new Error('what-moved: unknown pickedId');
    }
    const elapsedMs = typeof value.elapsedMs === 'number' && Number.isFinite(value.elapsedMs)
      ? Math.max(0, Math.min(120_000, Math.round(value.elapsedMs)))
      : config.slowMs;
    return { pickedId: value.pickedId, elapsedMs };
  },

  score(config, result) {
    const correct = result.pickedId === config.movedId;
    return finalizeTimed(result.elapsedMs, correct ? 1 : 0, result.elapsedMs, {
      parMs: config.parMs,
      slowMs: config.slowMs,
      speedWeight: 0.28,
    });
  },

  timingWindow: (config) => [config.previewMs, config.previewMs + 60_000],
};
