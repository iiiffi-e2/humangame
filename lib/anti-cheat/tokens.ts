import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Compact signed tokens: `base64url(payload).base64url(hmac)`.
 *
 * Used for run tokens, guest identity cookies and challenge links. A JWT
 * library would do the same job; this is 30 lines, has no algorithm-confusion
 * surface, and keeps the signing secret in one place.
 */

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signToken(payload: object, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken<T>(token: string, secret: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];
  const expected = sign(body, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export interface RunTokenPayload {
  /** Single-use id. A finished run records it, so a token cannot be replayed. */
  jti: string;
  runId: string;
  playerId: string;
  manifestId: string;
  mode: 'official' | 'practice';
  /** Issued-at, epoch ms. */
  iat: number;
  /** Expiry, epoch ms. */
  exp: number;
}

export const RUN_TOKEN_TTL_MS = 45 * 60 * 1000;

export function issueRunToken(
  input: Omit<RunTokenPayload, 'jti' | 'iat' | 'exp'>,
  secret: string,
  now: number = Date.now(),
): { token: string; payload: RunTokenPayload } {
  const payload: RunTokenPayload = {
    ...input,
    jti: randomUUID(),
    iat: now,
    exp: now + RUN_TOKEN_TTL_MS,
  };
  return { token: signToken(payload, secret), payload };
}

export function readRunToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): RunTokenPayload | null {
  const payload = verifyToken<RunTokenPayload>(token, secret);
  if (!payload) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  if (!payload.jti || !payload.runId || !payload.playerId) return null;
  return payload;
}

export interface GuestTokenPayload {
  playerId: string;
  iat: number;
}

export function issueGuestToken(playerId: string, secret: string): string {
  return signToken({ playerId, iat: Date.now() } satisfies GuestTokenPayload, secret);
}

export function readGuestToken(token: string, secret: string): GuestTokenPayload | null {
  const payload = verifyToken<GuestTokenPayload>(token, secret);
  if (!payload?.playerId) return null;
  return payload;
}

/** Short, URL-safe, unguessable id for challenge and share links. */
export function shortToken(bytes = 6): string {
  return randomUUID().replace(/-/g, '').slice(0, bytes * 2).slice(0, 10);
}
