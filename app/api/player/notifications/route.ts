import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler } from '@/lib/api';
import { getStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ action: z.enum(['read']) });

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'notifications-read', limit: 60, windowSeconds: 3600 },
  },
  async ({ player }) => {
    await getStore().markNotificationsRead(player.id);
    return NextResponse.json({ ok: true });
  },
);
