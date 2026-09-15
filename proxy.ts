import { NextResponse, type NextRequest } from 'next/server';
import { GUEST_COOKIE, GUEST_COOKIE_MAX_AGE, GUEST_HEADER } from '@/lib/auth/constants';
import { signTokenEdge, verifyTokenEdge } from '@/lib/auth/edge-token';
import { DEV_RUN_SECRET } from '@/lib/env';

/**
 * Guest-first identity.
 *
 * Every visitor gets an opaque, signed player id on their first request, so
 * the home page can render a real (empty) profile and the first run can be
 * recorded without an account. The cookie holds only the id and an issue
 * time; the player row itself is created server-side on first use.
 *
 * This proxy (Next's middleware layer) is the only place that can set the
 * cookie *and* have the very first server render see it, which is why the id
 * is forwarded on a request header.
 */
export default async function proxy(request: NextRequest) {
  const secret = process.env.HUMAN_RUN_SECRET ?? DEV_RUN_SECRET;
  const existing = request.cookies.get(GUEST_COOKIE)?.value;

  if (existing) {
    const payload = await verifyTokenEdge<{ playerId: string }>(existing, secret);
    if (payload?.playerId) {
      const headers = new Headers(request.headers);
      headers.set(GUEST_HEADER, payload.playerId);
      return NextResponse.next({ request: { headers } });
    }
  }

  const playerId = crypto.randomUUID();
  const token = await signTokenEdge({ playerId, iat: Date.now() }, secret);
  const headers = new Headers(request.headers);
  headers.set(GUEST_HEADER, playerId);

  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE,
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/|__nextjs|favicon.ico|icons/|manifest.webmanifest|sw.js).*)'],
};
