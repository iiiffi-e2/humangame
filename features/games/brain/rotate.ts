import { createRng } from '@/lib/rng';
import { categoricalScore, finalize } from '@/lib/scoring';
import type { GameDefinition } from '@/features/game-engine/types';

export interface RotateShape {
  id: string;
  /** Points of a closed polygon in a -1..1 box. */
  points: Array<[number, number]>;
  mirrored: boolean;
  rotationDeg: number;
}

export interface RotateConfig {
  prompt: RotateShape;
  options: RotateShape[];
  answerId: string;
  parMs: number;
  slowMs: number;
}

export interface RotateResult {
  pickedId: string;
  elapsedMs: number;
}

function rotatePoints(
  points: ReadonlyArray<readonly [number, number]>,
  deg: number,
  mirror: boolean,
): Array<[number, number]> {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map(([x0, y0]) => {
    const x = mirror ? -x0 : x0;
    const y = y0;
    return [
      Math.round((x * cos - y * sin) * 1000) / 1000,
      Math.round((x * sin + y * cos) * 1000) / 1000,
    ] as [number, number];
  });
}

export const rotate: GameDefinition<RotateConfig, RotateResult> = {
  id: 'brain.rotate',
  pillar: 'brain',
  name: 'Rotate',
  instruction: () => 'Same shape, just turned. Which one?',
  hint: () => 'One is a mirror image. It does not count.',

  createConfig(seed, difficulty) {
    const rng = createRng(`${seed}:brain.rotate`);
    const vertexCount = difficulty > 0.55 ? 7 : 6;
    const base: Array<[number, number]> = [];
    for (let i = 0; i < vertexCount; i += 1) {
      const theta = (i / vertexCount) * Math.PI * 2;
      const radius = rng.round(0.42, 1, 3);
      base.push([
        Math.round(Math.cos(theta) * radius * 1000) / 1000,
        Math.round(Math.sin(theta) * radius * 1000) / 1000,
      ]);
    }

    const promptRotation = rng.int(0, 359);
    const prompt: RotateShape = {
      id: 'prompt',
      points: rotatePoints(base, promptRotation, false),
      mirrored: false,
      rotationDeg: promptRotation,
    };

    const answerRotation = (promptRotation + rng.int(60, 300)) % 360;
    const options: RotateShape[] = [
      {
        id: 'a',
        points: rotatePoints(base, answerRotation, false),
        mirrored: false,
        rotationDeg: answerRotation,
      },
      {
        id: 'b',
        points: rotatePoints(base, (answerRotation + rng.int(40, 320)) % 360, true),
        mirrored: true,
        rotationDeg: 0,
      },
    ];
    // Two near-misses: same silhouette family, one vertex nudged.
    for (let i = 0; i < 2; i += 1) {
      const tweaked = base.map((point, index): [number, number] =>
        index === (i * 2) % base.length
          ? [Math.round(point[0] * 0.55 * 1000) / 1000, Math.round(point[1] * 1.35 * 1000) / 1000]
          : point,
      );
      options.push({
        id: `c${i}`,
        points: rotatePoints(tweaked, rng.int(0, 359), false),
        mirrored: false,
        rotationDeg: 0,
      });
    }

    return {
      prompt,
      options: rng.shuffle(options),
      answerId: 'a',
      parMs: 4800,
      slowMs: 16_000,
    };
  },

  validateConfig(config) {
    if (config.options.length < 3) throw new Error('rotate: too few options');
    if (!config.options.some((option) => option.id === config.answerId)) {
      throw new Error('rotate: answer not among options');
    }
  },

  redactConfig(config) {
    return { ...config, answerId: '' };
  },

  validateResult(config, result) {
    const value = result as Partial<RotateResult> | null;
    if (typeof value?.pickedId !== 'string') throw new Error('rotate: pickedId missing');
    if (!config.options.some((option) => option.id === value.pickedId)) {
      throw new Error('rotate: unknown pickedId');
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
      speedWeight: 0.3,
    });
    return finalize(result.elapsedMs, normalized);
  },

  timingWindow: () => [400, 120_000],
};
