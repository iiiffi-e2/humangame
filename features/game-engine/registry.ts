import type { GameDefinition, Pillar } from './types';
import { PILLARS } from './types';
import { deadStop } from '@/features/games/nerve/dead-stop';
import { crosshair } from '@/features/games/nerve/crosshair';
import { grow } from '@/features/games/nerve/grow';
import { half } from '@/features/games/eye/half';
import { percent } from '@/features/games/eye/percent';
import { angle } from '@/features/games/eye/angle';
import { flashGrid } from '@/features/games/memory/flash-grid';
import { whatMoved } from '@/features/games/memory/what-moved';
import { sequence } from '@/features/games/memory/sequence';
import { order } from '@/features/games/brain/order';
import { next } from '@/features/games/brain/next';
import { rotate } from '@/features/games/brain/rotate';
import { majority } from '@/features/games/crowd/majority';
import { split } from '@/features/games/crowd/split';
import { avoid } from '@/features/games/crowd/avoid';

/**
 * A game definition with its config and result types erased. The interface
 * declares its hooks as methods, which makes them bivariant, so a concrete
 * definition is assignable here and the engine can hold all fifteen in one
 * list. Callers must pass configs that came out of the same definition.
 */
export type AnyGameDefinition = GameDefinition<unknown, unknown>;

const ALL: readonly AnyGameDefinition[] = [
  deadStop,
  crosshair,
  grow,
  half,
  percent,
  angle,
  flashGrid,
  whatMoved,
  sequence,
  order,
  next,
  rotate,
  majority,
  split,
  avoid,
];

export const GAME_REGISTRY: ReadonlyMap<string, AnyGameDefinition> = new Map(
  ALL.map((definition) => [definition.id, definition]),
);

export const GAME_IDS: readonly string[] = ALL.map((definition) => definition.id);

export const GAMES_BY_PILLAR: Readonly<Record<Pillar, readonly AnyGameDefinition[]>> =
  PILLARS.reduce(
    (accumulator, pillar) => {
      accumulator[pillar] = ALL.filter((definition) => definition.pillar === pillar);
      return accumulator;
    },
    {} as Record<Pillar, readonly AnyGameDefinition[]>,
  );

export function getGame(id: string): AnyGameDefinition {
  const definition = GAME_REGISTRY.get(id);
  if (!definition) throw new Error(`Unknown game family: ${id}`);
  return definition;
}

export function isKnownGame(id: string): boolean {
  return GAME_REGISTRY.has(id);
}
