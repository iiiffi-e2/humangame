import 'server-only';
import { hasRedis, serverEnv } from '@/lib/env';

/**
 * Fixed-window rate limiting.
 *
 * Backed by Upstash Redis when the environment provides it, and by a
 * per-process map otherwise. The in-process fallback is genuinely useful in
 * development and honest about its limits: it does not survive a restart and
 * does not coordinate across instances.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

interface Window {
  count: number;
  resetAt: number;
}

declare global {
  var __humanRateLimit: Map<string, Window> | undefined;
}

function localBuckets(): Map<string, Window> {
  if (!globalThis.__humanRateLimit) globalThis.__humanRateLimit = new Map();
  return globalThis.__humanRateLimit;
}

async function redisIncrement(key: string, windowSeconds: number): Promise<number | null> {
  const env = serverEnv();
  try {
    const response = await fetch(`${env.upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSeconds), 'NX'],
      ]),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Array<{ result?: number }>;
    const count = payload[0]?.result;
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000));
  const bucketKey = `human:rl:${key}:${windowStart}`;
  const resetAt = (windowStart + 1) * windowSeconds * 1000;

  if (hasRedis()) {
    const count = await redisIncrement(bucketKey, windowSeconds);
    if (count !== null) {
      return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt };
    }
    // Redis unreachable — fall through to the local bucket rather than
    // failing open completely.
  }

  const buckets = localBuckets();
  const existing = buckets.get(bucketKey);
  const window: Window = existing && existing.resetAt > now ? existing : { count: 0, resetAt };
  window.count += 1;
  buckets.set(bucketKey, window);

  // Keep the map from growing without bound in a long-lived dev server.
  if (buckets.size > 5_000) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(entryKey);
    }
  }

  return { ok: window.count <= limit, remaining: Math.max(0, limit - window.count), resetAt };
}

/** Best-effort client address for per-IP limits behind a proxy. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return headers.get('x-real-ip') ?? 'unknown';
}
