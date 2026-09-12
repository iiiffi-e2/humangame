'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';
import type { LeaderboardTab } from '@/lib/queries';

/** Fires `leaderboard_viewed` on tab change. Renders nothing. */
export function BoardTracker({ tab }: { tab: LeaderboardTab }) {
  useEffect(() => {
    track('leaderboard_viewed', { tab });
  }, [tab]);
  return null;
}
