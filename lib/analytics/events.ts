import type { Pillar } from '@/features/game-engine/types';

/**
 * The analytics contract. Every event the product emits is declared here, so
 * adding a call site without adding a type is a compile error and the
 * property names cannot drift between screens.
 */
export interface AnalyticsEvents {
  home_viewed: { dayNumber: number; hasPlayed: boolean; streak: number };
  daily_started: { dayNumber: number; fromChallenge: boolean };
  event_started: { dayNumber: number; index: number; pillar: Pillar; gameId: string };
  event_completed: {
    dayNumber: number;
    index: number;
    pillar: Pillar;
    gameId: string;
    points: number;
    durationMs: number;
  };
  daily_completed: { dayNumber: number; totalScore: number; percentile: number; streak: number };
  result_shared: { dayNumber: number; surface: 'native' | 'clipboard' | 'story' };
  challenge_opened: { token: string; dayNumber: number };
  challenge_completed: { token: string; dayNumber: number; won: boolean; margin: number };
  username_claimed: { dayNumber: number };
  rivalry_requested: { target: string };
  rivalry_accepted: { target: string };
  crew_created: { crewId: string };
  crew_joined: { crewId: string };
  practice_started: { dayNumber: number };
  practice_completed: { dayNumber: number; firstScore: number; thisRun: number };
  leaderboard_viewed: { tab: 'friends' | 'crews' | 'global' | 'country' | 'month' };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
