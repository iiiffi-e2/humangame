import 'server-only';
import { cookies, headers } from 'next/headers';
import { GUEST_COOKIE, GUEST_HEADER } from '@/lib/auth/constants';
import { readGuestToken } from '@/lib/anti-cheat/tokens';
import { getStore } from '@/lib/db';
import { DEFAULT_SETTINGS, type Player } from '@/lib/db/types';
import { currentDateKey, dayNumberFor } from '@/lib/daily/reset';
import { serverEnv } from '@/lib/env';

/**
 * Reads the guest identity the middleware issued and materialises the player
 * row the first time it is needed. Everything in the product hangs off this:
 * the first page view is already a player, with no signup and no account gate
 * before the first result.
 */

function playerIdFromRequest(
  cookieValue: string | undefined,
  headerValue: string | null,
): string | null {
  if (cookieValue) {
    const payload = readGuestToken(cookieValue, serverEnv().runSecret);
    if (payload?.playerId) return payload.playerId;
  }
  // The proxy forwards the id it just minted, before the cookie has made a
  // round trip.
  return headerValue;
}

async function materialise(playerId: string): Promise<Player> {
  const store = getStore();
  const existing = await store.getPlayer(playerId);
  if (existing) return existing;
  const env = serverEnv();
  return store.createPlayer({
    id: playerId,
    username: null,
    displayName: 'Guest',
    country: null,
    isGuest: true,
    authUserId: null,
    email: null,
    authProvider: 'guest',
    // In development with no admin list configured, the first identity gets
    // the admin console so the manifest tools are reachable on a clean
    // checkout. In production an admin is named explicitly.
    isAdmin: env.adminEmails.length === 0 && env.adminUsernames.length === 0 && !env.isProduction,
    settings: { ...DEFAULT_SETTINGS },
    firstDayNumber: dayNumberFor(currentDateKey()),
  });
}

/** The current player, creating the row on first use. Never returns null. */
export async function requirePlayer(): Promise<Player> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const playerId = playerIdFromRequest(
    cookieStore.get(GUEST_COOKIE)?.value,
    headerStore.get(GUEST_HEADER),
  );
  if (!playerId) {
    throw new Error('No guest identity on the request - is the proxy matcher too narrow?');
  }
  return materialise(playerId);
}

/** The current player if one exists, without creating a row. */
export async function currentPlayer(): Promise<Player | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const playerId = playerIdFromRequest(
    cookieStore.get(GUEST_COOKIE)?.value,
    headerStore.get(GUEST_HEADER),
  );
  if (!playerId) return null;
  return getStore().getPlayer(playerId);
}

/** Player resolution inside a route handler, where `Request` is available. */
export async function playerFromRequest(request: Request): Promise<Player> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GUEST_COOKIE}=`));
  const cookieValue = match ? decodeURIComponent(match.slice(GUEST_COOKIE.length + 1)) : undefined;
  const playerId = playerIdFromRequest(cookieValue, request.headers.get(GUEST_HEADER));
  if (!playerId) throw new Error('UNAUTHENTICATED');
  return materialise(playerId);
}

/**
 * Admin access. A player is an admin if the database says so, or if their
 * claimed handle or linked email is named in the environment — which is how
 * the first admin is granted on a fresh deployment.
 */
export function isAdmin(player: Player): boolean {
  if (player.isAdmin) return true;
  const env = serverEnv();
  if (player.username && env.adminUsernames.includes(player.username.toLowerCase())) return true;
  if (player.email && env.adminEmails.includes(player.email.toLowerCase())) return true;
  return false;
}
