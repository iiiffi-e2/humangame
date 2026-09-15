import { createRng } from '@/lib/rng';
import { finalizeTimed, readElapsedMs, SPEED_BAND } from '@/lib/scoring';
import { blendShares, crowdAlignment, crowdWinner } from '@/lib/scoring/crowd';
import type { GameDefinition } from '@/features/game-engine/types';
import { MAJORITY_QUESTIONS, type CrowdOption } from './content';

export interface MajorityConfig {
  questionId: string;
  question: string;
  options: CrowdOption[];
  priorShares: Record<string, number>;
  priorWeight: number;
}

export interface MajorityResult {
  pickedId: string;
  elapsedMs: number;
}

export const majority: GameDefinition<MajorityConfig, MajorityResult> = {
  id: 'crowd.majority',
  pillar: 'crowd',
  name: 'Majority',
  instruction: (config) => config.question,
  hint: () => 'Not what you would pick. What they will pick.',

  createConfig(seed, _difficulty) {
    const rng = createRng(`${seed}:crowd.majority`);
    const question = rng.pick(MAJORITY_QUESTIONS);
    return {
      questionId: question.id,
      question: question.question,
      options: rng.shuffle(question.options),
      priorShares: question.priorShares,
      priorWeight: question.priorWeight,
    };
  },

  validateConfig(config) {
    if (config.options.length < 2) throw new Error('majority: too few options');
    for (const option of config.options) {
      if (config.priorShares[option.id] === undefined) {
        throw new Error(`majority: no prior for ${option.id}`);
      }
    }
  },

  validateResult(config, result) {
    const value = (result as Partial<MajorityResult> | null)?.pickedId;
    if (typeof value !== 'string' || !config.options.some((option) => option.id === value)) {
      throw new Error('majority: unknown pickedId');
    }
    return {
      pickedId: value,
      elapsedMs: readElapsedMs((result as Partial<MajorityResult> | null)?.elapsedMs, SPEED_BAND.crowd.slowMs),
    };
  },

  score(config, result, context) {
    const shares = blendShares(
      { shares: config.priorShares, weight: config.priorWeight },
      context?.crowd,
    );
    const accuracy = crowdAlignment(shares, result.pickedId, 'most');
    const pickedShare = Math.round((shares[result.pickedId] ?? 0) * 1000) / 10;
    const winner = crowdWinner(shares, 'most');
    const label = winner === result.pickedId ? 'With the crowd' : undefined;
    return finalizeTimed(pickedShare, accuracy, result.elapsedMs, SPEED_BAND.crowd, label);
  },

  timingWindow: () => [300, 120_000],
};
