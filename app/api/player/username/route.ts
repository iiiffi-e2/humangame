import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkDisplayName, checkUsername } from '@/lib/auth/username';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  username: z.string().min(1).max(32),
  displayName: z.string().min(1).max(48).optional(),
});

/** Claim a handle. Guests keep playing either way; this is what makes them findable. */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'username', limit: 12, windowSeconds: 3600 },
    perIp: { name: 'username', limit: 40, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const username = checkUsername(body.username);
    if (!username.ok) {
      return NextResponse.json({ error: username.error, code: 'BAD_USERNAME' }, { status: 400 });
    }

    const store = getStore();
    const taken = await store.getPlayerByUsername(username.value);
    if (taken && taken.id !== player.id) {
      return NextResponse.json({ error: 'Already taken.', code: 'TAKEN' }, { status: 409 });
    }

    const display = body.displayName ? checkDisplayName(body.displayName) : null;
    if (display && !display.ok) {
      return NextResponse.json({ error: display.error, code: 'BAD_NAME' }, { status: 400 });
    }

    const updated = await store.updatePlayer(player.id, {
      username: username.value,
      displayName: display?.value ?? (player.displayName === 'Guest' ? username.value : player.displayName),
    });

    return NextResponse.json({ username: updated.username, displayName: updated.displayName });
  },
);
