import { createRng } from '@/lib/rng';
import { finalizeTimed, percentageScore, readElapsedMs, SPEED_BAND } from '@/lib/scoring';
import { blendPercentage } from '@/lib/scoring/crowd';
import type { GameDefinition } from '@/features/game-engine/types';
import { SPLIT_QUESTIONS } from './content';

export interface SplitConfig {
  questionId: string;
  question: string;
  subjectA: string;
  subjectB: string;
  priorPercent: number;
  priorWeight: number;
  perfect: number;
  zero: number;
}

export interface SplitResult {
  predicted: number;
  elapsedMs: number;
}

export const split: GameDefinition<SplitConfig, SplitResult> = {
  id: 'crowd.split',
  pillar: 'crowd',
  name: 'Split',
  instruction: (config) =>
    config.question.replace('{a}', config.subjectA).replace('{b}', config.subjectB),
  hint: () => 'Slide to your call. Closer is better than bold.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:crowd.split`);
    const question = rng.pick(SPLIT_QUESTIONS);
    return {
      questionId: question.id,
      question: question.question,
      subjectA: question.subjectA,
      subjectB: question.subjectB,
      priorPercent: question.priorPercent,
      priorWeight: question.priorWeight,
      perfect: 2,
      zero: 38 - difficulty * 8,
    };
  },

  validateConfig(config) {
    if (config.priorPercent < 0 || config.priorPercent > 100) {
      throw new Error('split: prior out of range');
    }
    if (config.zero <= config.perfect) throw new Error('split: bad tolerance band');
  },

  validateResult(_config, result) {
    const value = (result as Partial<SplitResult> | null)?.predicted;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('split: predicted out of range');
    }
    return {
      predicted: Math.round(value),
      elapsedMs: readElapsedMs((result as Partial<SplitResult> | null)?.elapsedMs, SPEED_BAND.crowd.slowMs),
    };
  },

  score(config, result, context) {
    const actual = blendPercentage(config.priorPercent, config.priorWeight, context?.crowd);
    const accuracy = percentageScore({
      predicted: result.predicted,
      actual,
      perfect: config.perfect,
      zero: config.zero,
    });
    return finalizeTimed(
      Math.round((result.predicted - actual) * 10) / 10,
      accuracy,
      result.elapsedMs,
      SPEED_BAND.crowd,
    );
  },

  timingWindow: () => [400, 120_000],
};
