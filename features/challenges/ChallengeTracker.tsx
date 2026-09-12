'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Fires `challenge_opened` on arrival, and `challenge_completed` once the
 * recipient has a run of their own to compare. Renders nothing.
 */
export function ChallengeTracker({
  token,
  dayNumber,
  margin,
}: {
  token: string;
  dayNumber: number;
  /** Viewer's score minus the challenger's, or null if they have not played. */
  margin: number | null;
}) {
  useEffect(() => {
    track('challenge_opened', { token, dayNumber });
  }, [token, dayNumber]);

  useEffect(() => {
    if (margin === null) return;
    track('challenge_completed', { token, dayNumber, won: margin > 0, margin });
  }, [token, dayNumber, margin]);

  return null;
}
