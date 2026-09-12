import { publicEnv } from '@/lib/env';

/**
 * Error reporting wrapper.
 *
 * Sentry is optional: when no DSN is configured this logs and moves on, so
 * the app never depends on an external service being reachable. The wrapper
 * exists so call sites never import a vendor SDK directly, and swapping the
 * backend is one file.
 */

export interface ErrorContext {
  where: string;
  playerId?: string;
  runId?: string;
  extra?: Record<string, unknown>;
}

export function reportError(error: unknown, context: ErrorContext): void {
  const payload = {
    ...context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };

  if (!publicEnv.sentryDsn) {
    console.error('[human]', payload);
    return;
  }

  // Sentry's SDK is loaded lazily so it never lands in the critical path of a
  // gameplay bundle.
  void import('@sentry/nextjs')
    .then((sentry) => {
      sentry.captureException(error, { extra: { ...context } });
    })
    .catch(() => {
      console.error('[human]', payload);
    });
}

export function reportMessage(message: string, context: ErrorContext): void {
  if (!publicEnv.sentryDsn) {
    console.warn('[human]', message, context);
    return;
  }
  void import('@sentry/nextjs')
    .then((sentry) => sentry.captureMessage(message, { extra: { ...context } }))
    .catch(() => console.warn('[human]', message, context));
}
