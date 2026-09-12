import type { ScoreResult } from '@/lib/scoring';

export const PILLARS = ['nerve', 'eye', 'memory', 'brain', 'crowd'] as const;
export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABEL: Record<Pillar, string> = {
  nerve: 'Nerve',
  eye: 'Eye',
  memory: 'Memory',
  brain: 'Brain',
  crowd: 'Crowd',
};

/** Extra information a CROWD game needs in order to be scored. */
export interface CrowdContext {
  /** Live tally of responses, keyed by option id (or `value` bucket). */
  counts: Record<string, number>;
  /** Total responses behind `counts`. */
  total: number;
}

export interface ScoreContext {
  crowd?: CrowdContext;
}

export interface GameDefinition<TConfig, TResult> {
  id: string;
  pillar: Pillar;
  /** Short name shown in the event shell, e.g. "Dead stop". */
  name: string;
  /** The single sentence of instruction shown above the play field. */
  instruction(config: TConfig): string;
  /** Supporting line under the instruction. Optional. */
  hint?(config: TConfig): string;
  createConfig(seed: string, difficulty: number): TConfig;
  validateConfig(config: TConfig): void;
  /**
   * Strip anything the play field does not need to render. The server keeps
   * the full config and always scores against that, so an answer key that is
   * not needed for drawing never reaches the browser.
   */
  redactConfig?(config: TConfig): TConfig;
  /** Rejects results that could not have come from real play. */
  validateResult(config: TConfig, result: unknown): TResult;
  score(config: TConfig, result: TResult, context?: ScoreContext): ScoreResult;
  /**
   * Plausible wall time for the interaction, used by the anti-cheat timing
   * window. `[minMs, maxMs]`.
   */
  timingWindow(config: TConfig): [number, number];
}

export interface GameProps<TConfig, TResult> {
  config: TConfig;
  /** Called once, when the player commits their answer. */
  onComplete: (result: TResult) => void;
  /** The shell honours prefers-reduced-motion and passes it down. */
  reducedMotion: boolean;
}

/** A single event as it appears inside a frozen daily manifest. */
export interface DailyEvent {
  index: number;
  pillar: Pillar;
  gameId: string;
  difficulty: number;
  seed: string;
  config: unknown;
  voided?: boolean;
}

export interface DailyManifest {
  id: string;
  /** YYYY-MM-DD, UTC in v1. */
  date: string;
  dayNumber: number;
  seed: string;
  version: number;
  status: 'draft' | 'frozen';
  events: DailyEvent[];
}
