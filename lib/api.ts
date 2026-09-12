import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIp, rateLimit } from '@/lib/anti-cheat/rate-limit';
import { playerFromRequest } from '@/lib/auth/session';
import type { Player } from '@/lib/db/types';
import { publicEnv } from '@/lib/env';
import { CSRF_HEADER } from '@/lib/client/constants';
import { reportError } from '@/lib/observability';

/**
 * Shared plumbing for every route handler: payload validation, CSRF, rate
 * limiting and a single error shape. Handlers stay about the domain.
 */

export { CSRF_HEADER } from '@/lib/client/constants';

export interface ApiError {
  error: string;
  code: string;
}

export function jsonError(message: string, code: string, status: number): NextResponse<ApiError> {
  return NextResponse.json({ error: message, code }, { status });
}

/**
 * Mutations must carry a custom header and, when the browser sends one, an
 * Origin that matches the site. A cross-site form post cannot set a custom
 * header without a preflight, which same-origin policy will refuse.
 */
export function checkCsrf(request: Request): NextResponse<ApiError> | null {
  if (request.method === 'GET' || request.method === 'HEAD') return null;
  if (request.headers.get(CSRF_HEADER) !== '1') {
    return jsonError('Missing request header.', 'CSRF', 403);
  }

  const origin = request.headers.get('origin');
  if (!origin) return null;

  try {
    const originHost = new URL(origin).host;
    const allowed = [
      new URL(publicEnv.siteUrl).host,
      request.headers.get('x-forwarded-host'),
      request.headers.get('host'),
    ].filter((host): host is string => Boolean(host));
    if (!allowed.includes(originHost)) {
      return jsonError('Cross-origin request refused.', 'CSRF', 403);
    }
  } catch {
    return jsonError('Bad origin.', 'CSRF', 403);
  }

  return null;
}

export interface RateLimitSpec {
  /** Bucket name, e.g. `run-start`. */
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface HandlerContext<T> {
  body: T;
  player: Player;
  request: Request;
}

export interface HandlerOptions<TSchema extends z.ZodType> {
  schema: TSchema;
  perPlayer?: RateLimitSpec;
  perIp?: RateLimitSpec;
}

/**
 * Wrap a mutation handler. Anything that throws is logged and returned as a
 * generic 500 — internal messages never reach the client.
 */
export function handler<TSchema extends z.ZodType>(
  options: HandlerOptions<TSchema>,
  run: (context: HandlerContext<z.infer<TSchema>>) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request): Promise<NextResponse> => {
    const csrf = checkCsrf(request);
    if (csrf) return csrf;

    let player: Player;
    try {
      player = await playerFromRequest(request);
    } catch {
      return jsonError('No player identity on this request.', 'UNAUTHENTICATED', 401);
    }

    if (options.perIp) {
      const ip = clientIp(request.headers);
      const result = await rateLimit(
        `${options.perIp.name}:ip:${ip}`,
        options.perIp.limit,
        options.perIp.windowSeconds,
      );
      if (!result.ok) return jsonError('Too many requests.', 'RATE_LIMITED', 429);
    }

    if (options.perPlayer) {
      const result = await rateLimit(
        `${options.perPlayer.name}:player:${player.id}`,
        options.perPlayer.limit,
        options.perPlayer.windowSeconds,
      );
      if (!result.ok) return jsonError('Slow down.', 'RATE_LIMITED', 429);
    }

    let body: unknown = {};
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const text = await request.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        return jsonError('Body is not valid JSON.', 'BAD_JSON', 400);
      }
    }

    const parsed = options.schema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return jsonError(
        first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid payload.',
        'BAD_PAYLOAD',
        400,
      );
    }

    try {
      return await run({ body: parsed.data, player, request });
    } catch (error) {
      if (isDomainError(error)) {
        return jsonError(error.message, error.code, error.status);
      }
      reportError(error, { where: `api:${new URL(request.url).pathname}`, playerId: player.id });
      return jsonError('Something went wrong.', 'INTERNAL', 500);
    }
  };
}

interface DomainError {
  message: string;
  code: string;
  status: number;
}

function isDomainError(error: unknown): error is DomainError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'status' in error &&
    typeof (error as DomainError).status === 'number'
  );
}
