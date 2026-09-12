'use client';

import posthog from 'posthog-js';
import { publicEnv } from '@/lib/env';
import type { AnalyticsEventName, AnalyticsEvents } from './events';

/**
 * Typed PostHog wrapper.
 *
 * If no key is configured — the default on a clean checkout — every call is a
 * no-op, so analytics never blocks local development or leaks a dev session
 * into a real project.
 */

let started = false;

export function initAnalytics(): void {
  if (started || typeof window === 'undefined' || !publicEnv.posthogKey) return;
  started = true;
  posthog.init(publicEnv.posthogKey, {
    api_host: publicEnv.posthogHost,
    capture_pageview: false,
    persistence: 'localStorage',
    autocapture: false,
  });
}

export function track<K extends AnalyticsEventName>(
  name: K,
  properties: AnalyticsEvents[K],
): void {
  if (typeof window === 'undefined') return;
  if (!publicEnv.posthogKey) {
    if (process.env.NODE_ENV === 'development') {
      // Visible in development so event wiring can be checked without a key.
      console.debug('[analytics]', name, properties);
    }
    return;
  }
  posthog.capture(name, properties as Record<string, unknown>);
}

export function identify(playerId: string, traits?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !publicEnv.posthogKey) return;
  posthog.identify(playerId, traits);
}

export type { AnalyticsEvents, AnalyticsEventName } from './events';
