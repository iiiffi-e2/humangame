'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/analytics';

/**
 * Client-side app shell. Boots analytics (a no-op without a key) and
 * registers the service worker outside development, where an aggressively
 * cached bundle makes iteration painful.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // A failed registration must never break gameplay.
    });
  }, []);

  return <>{children}</>;
}
