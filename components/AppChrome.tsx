'use client';

import { useEffect } from 'react';
import { identify, initAnalytics } from '@/lib/analytics';

/**
 * Client-side app shell. Boots analytics (a no-op without a key) and
 * registers the service worker outside development, where an aggressively
 * cached bundle makes iteration painful.
 */
export function AppChrome({
  children,
  playerId,
}: {
  children: React.ReactNode;
  playerId: string | null;
}) {
  useEffect(() => {
    initAnalytics();
    if (playerId) identify(playerId);
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed registration must never break gameplay.
    });
  }, [playerId]);

  return <>{children}</>;
}
