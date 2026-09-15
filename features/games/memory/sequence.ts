import { createRng } from '@/lib/rng';
import { finalizeTimed, readElapsedMs, sequenceScore, SPEED_BAND } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export const SEQUENCE_ICONS = ['bolt', 'moon', 'eye', 'wave', 'ring', 'cross'] as const;
export type SequenceIcon = (typeof SEQUENCE_ICONS)[number];

export interface SequenceConfig {
  /** The icons available on the keypad, in the order they are laid out. */
  keypad: SequenceIcon[];
  /** The sequence to reproduce. */
  sequence: SequenceIcon[];
  /** How long each icon is shown during playback. */
  stepMs: number;
}

export interface SequenceResult {
  entered: string[];
  elapsedMs: number;
}

export const sequence: GameDefinition<SequenceConfig, SequenceResult> = {
  id: 'memory.sequence',
  pillar: 'memory',
  name: 'Sequence',
  instruction: (config) => `Play back all ${config.sequence.length} in order.`,
  hint: () => 'Order counts. Watch it once.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:memory.sequence`);
    const keypadSize = difficulty > 0.5 ? 6 : 4;
    const keypad = rng.sample(SEQUENCE_ICONS, keypadSize);
    const length = Math.round(5 + difficulty * 3);
    const out: SequenceIcon[] = [];
    for (let i = 0; i < length; i += 1) {
      // Never repeat an icon back to back — that is a rhythm test, not recall.
      let next = rng.pick(keypad);
      let guard = 0;
      while (next === out[out.length - 1] && guard < 8) {
        next = rng.pick(keypad);
        guard += 1;
      }
      out.push(next);
    }
    return { keypad, sequence: out, stepMs: Math.round(620 - difficulty * 200) };
  },

  validateConfig(config) {
    if (config.keypad.length < 3) throw new Error('sequence: keypad too small');
    if (config.sequence.length < 3) throw new Error('sequence: sequence too short');
    for (const icon of config.sequence) {
      if (!config.keypad.includes(icon)) throw new Error('sequence: icon not on keypad');
    }
  },

  validateResult(config, result) {
    const entered = (result as Partial<SequenceResult> | null)?.entered;
    if (!Array.isArray(entered)) throw new Error('sequence: entered missing');
    if (entered.length > config.sequence.length + 2) {
      throw new Error('sequence: too many entries');
    }
    for (const icon of entered) {
      if (typeof icon !== 'string' || !config.keypad.includes(icon as SequenceIcon)) {
        throw new Error('sequence: unknown icon');
      }
    }
    return {
      entered: entered as string[],
      elapsedMs: readElapsedMs((result as Partial<SequenceResult> | null)?.elapsedMs, SPEED_BAND.memory.slowMs),
    };
  },

  score(config, result) {
    const accuracy = sequenceScore({
      expected: config.sequence as readonly string[],
      actual: result.entered,
      setWeight: 0.25,
    });
    let correctPrefix = 0;
    for (let i = 0; i < config.sequence.length; i += 1) {
      if (result.entered[i] === config.sequence[i]) correctPrefix += 1;
      else break;
    }
    return finalizeTimed(correctPrefix, accuracy, result.elapsedMs, SPEED_BAND.memory);
  },

  timingWindow: (config) => [
    config.stepMs * config.sequence.length,
    config.stepMs * config.sequence.length + 60_000,
  ],
};
