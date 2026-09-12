import { createRng } from '@/lib/rng';
import { finalize, rankingScore } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';
import { ORDER_SETS } from './content';

export interface OrderConfig {
  setId: string;
  prompt: string;
  hint: string;
  /** Items in the order they are first presented (deliberately scrambled). */
  items: Array<{ id: string; label: string }>;
  /** The correct ordering, as ids. */
  solution: string[];
}

export interface OrderResult {
  order: string[];
}

export const order: GameDefinition<OrderConfig, OrderResult> = {
  id: 'brain.order',
  pillar: 'brain',
  name: 'Order',
  instruction: (config) => config.prompt,
  hint: (config) => `${config.hint} Drag to reorder.`,

  createConfig(seed, _difficulty) {
    const rng = createRng(`${seed}:brain.order`);
    const set = rng.pick(ORDER_SETS);
    const solution = [...set.items].sort((a, b) => a.value - b.value).map((item) => item.id);
    let scrambled = rng.shuffle(set.items);
    // Never hand the player the answer.
    let guard = 0;
    while (scrambled.map((item) => item.id).join() === solution.join() && guard < 10) {
      scrambled = rng.shuffle(set.items);
      guard += 1;
    }
    return {
      setId: set.id,
      prompt: set.prompt,
      hint: set.hint,
      items: scrambled.map((item) => ({ id: item.id, label: item.label })),
      solution,
    };
  },

  validateConfig(config) {
    if (config.items.length !== config.solution.length) {
      throw new Error('order: solution length mismatch');
    }
    for (const id of config.solution) {
      if (!config.items.some((item) => item.id === id)) {
        throw new Error('order: solution references unknown item');
      }
    }
  },

  redactConfig(config) {
    return { ...config, solution: [] };
  },

  validateResult(config, result) {
    const value = (result as Partial<OrderResult> | null)?.order;
    if (!Array.isArray(value) || value.length !== config.items.length) {
      throw new Error('order: wrong number of items');
    }
    for (const id of value) {
      if (typeof id !== 'string' || !config.items.some((item) => item.id === id)) {
        throw new Error('order: unknown item id');
      }
    }
    if (new Set(value).size !== value.length) throw new Error('order: duplicate item');
    return { order: value as string[] };
  },

  score(config, result) {
    const normalized = rankingScore({ expected: config.solution, actual: result.order });
    const exact = result.order.filter((id, index) => config.solution[index] === id).length;
    return finalize(exact, normalized);
  },

  timingWindow: () => [800, 90_000],
};
