import { createRng } from '@/lib/rng';
import { finalize } from '@/lib/scoring';
import { blendShares, crowdAlignment, crowdWinner } from '@/lib/scoring/crowd';
import type { GameDefinition } from '@/features/game-engine/types';
import { AVOID_QUESTIONS, type CrowdOption } from './content';

export interface AvoidConfig {
  questionId: string;
  question: string;
  options: CrowdOption[];
  priorShares: Record<string, number>;
  priorWeight: number;
}

export interface AvoidResult {
  pickedId: string;
}

export const avoid: GameDefinition<AvoidConfig, AvoidResult> = {
  id: 'crowd.avoid',
  pillar: 'crowd',
  name: 'Avoid the crowd',
  instruction: (config) => config.question,
  hint: () => 'You win by being alone.',

  createConfig(seed, _difficulty) {
    const rng = createRng(`${seed}:crowd.avoid`);
    const question = rng.pick(AVOID_QUESTIONS);
    return {
      questionId: question.id,
      question: question.question,
      options: rng.shuffle(question.options),
      priorShares: question.priorShares,
      priorWeight: question.priorWeight,
    };
  },

  validateConfig(config) {
    if (config.options.length < 3) throw new Error('avoid: too few options');
    for (const option of config.options) {
      if (config.priorShares[option.id] === undefined) {
        throw new Error(`avoid: no prior for ${option.id}`);
      }
    }
  },

  validateResult(config, result) {
    const value = (result as Partial<AvoidResult> | null)?.pickedId;
    if (typeof value !== 'string' || !config.options.some((option) => option.id === value)) {
      throw new Error('avoid: unknown pickedId');
    }
    return { pickedId: value };
  },

  score(config, result, context) {
    const shares = blendShares(
      { shares: config.priorShares, weight: config.priorWeight },
      context?.crowd,
    );
    const normalized = crowdAlignment(shares, result.pickedId, 'least');
    const pickedShare = Math.round((shares[result.pickedId] ?? 0) * 1000) / 10;
    const loneliest = crowdWinner(shares, 'least');
    const label = loneliest === result.pickedId ? 'Alone at the top' : undefined;
    return finalize(pickedShare, normalized, label);
  },

  timingWindow: () => [300, 120_000],
};
