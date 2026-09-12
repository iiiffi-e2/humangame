import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkDisplayName } from '@/lib/auth/username';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  displayName: z.string().min(1).max(48).optional(),
  country: z.string().length(2).nullish(),
  settings: z
    .object({
      sound: z.boolean(),
      haptics: z.boolean(),
      reduceMotion: z.boolean(),
      notifications: z.enum(['off', 'rivals', 'all']),
      privacy: z.enum(['private', 'friends', 'public']),
    })
    .partial()
    .optional(),
});

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'settings', limit: 120, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const patch: Parameters<ReturnType<typeof getStore>['updatePlayer']>[1] = {};

    if (body.displayName !== undefined) {
      const name = checkDisplayName(body.displayName);
      if (!name.ok) {
        return NextResponse.json({ error: name.error, code: 'BAD_NAME' }, { status: 400 });
      }
      patch.displayName = name.value;
    }
    if (body.country !== undefined) {
      patch.country = body.country ? body.country.toUpperCase() : null;
    }
    if (body.settings) {
      patch.settings = { ...player.settings, ...body.settings };
    }

    const updated = await getStore().updatePlayer(player.id, patch);
    return NextResponse.json({
      displayName: updated.displayName,
      country: updated.country,
      settings: updated.settings,
    });
  },
);
