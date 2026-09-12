import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';
import { hasSupabase, publicEnv, serverEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  /** Supabase access token, obtained in the browser after an OTP or OAuth sign-in. */
  accessToken: z.string().min(10).max(4096).optional(),
  /** Dev-mode only: link this guest to an email with no provider configured. */
  email: z.string().email().max(254).optional(),
});

/**
 * Link the current guest identity to an account.
 *
 * With Supabase configured, the browser completes the sign-in (email OTP,
 * Google, Apple or a passkey — whatever the project enables) and posts the
 * resulting access token here. The server verifies it with Supabase and
 * attaches the auth user to the *existing* player row, so a guest keeps every
 * run, streak and rivalry they earned before signing up.
 *
 * With no provider configured — a clean local checkout — a dev-mode path
 * accepts an email directly. It is refused in production.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'auth-link', limit: 20, windowSeconds: 3600 },
    perIp: { name: 'auth-link', limit: 60, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const store = getStore();
    const env = serverEnv();

    if (hasSupabase()) {
      if (!body.accessToken) {
        return NextResponse.json(
          { error: 'Sign in first, then send the token.', code: 'NO_TOKEN' },
          { status: 400 },
        );
      }
      const client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const { data, error } = await client.auth.getUser(body.accessToken);
      if (error || !data.user) {
        return NextResponse.json({ error: 'That sign-in is not valid.', code: 'BAD_TOKEN' }, { status: 401 });
      }

      const already = await store.getPlayerByAuthUser(data.user.id);
      if (already && already.id !== player.id) {
        return NextResponse.json(
          { error: 'That account is already linked to another player.', code: 'TAKEN' },
          { status: 409 },
        );
      }

      const provider = (data.user.app_metadata.provider ?? 'email') as
        | 'email'
        | 'google'
        | 'apple'
        | 'passkey';
      const updated = await store.updatePlayer(player.id, {
        authUserId: data.user.id,
        email: data.user.email ?? null,
        isGuest: false,
        authProvider: provider,
      });
      return NextResponse.json({ linked: true, provider: updated.authProvider });
    }

    if (env.isProduction) {
      return NextResponse.json(
        { error: 'No sign-in provider is configured.', code: 'NO_PROVIDER' },
        { status: 503 },
      );
    }

    if (!body.email) {
      return NextResponse.json({ error: 'Enter an email.', code: 'BAD_PAYLOAD' }, { status: 400 });
    }
    const updated = await store.updatePlayer(player.id, {
      email: body.email.toLowerCase(),
      isGuest: false,
      authProvider: 'email',
    });
    return NextResponse.json({ linked: true, provider: updated.authProvider, devMode: true });
  },
);
