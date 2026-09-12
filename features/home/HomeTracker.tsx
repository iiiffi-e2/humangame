'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/** Fires `home_viewed` once per mount. Renders nothing. */
export function HomeTracker({
  dayNumber,
  hasPlayed,
  streak,
}: {
  dayNumber: number;
  hasPlayed: boolean;
  streak: number;
}) {
  useEffect(() => {
    track('home_viewed', { dayNumber, hasPlayed, streak });
  }, [dayNumber, hasPlayed, streak]);
  return null;
}
