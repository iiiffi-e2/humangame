import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler } from '@/lib/api';
import { getStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['block', 'unblock']),
  target: z.string().min(1).max(64),
});

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'block', limit: 60, windowSeconds: 3600 },
    perIp: { name: 'block', limit: 120, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const store = getStore();
    const target =
      (await store.getPlayer(body.target)) ?? (await store.getPlayerByUsername(body.target));
    if (!target) {
      return NextResponse.json({ error: 'No such player.', code: 'NO_PLAYER' }, { status: 404 });
    }
    if (target.id === player.id) {
      return NextResponse.json({ error: 'You cannot block yourself.', code: 'SELF' }, { status: 400 });
    }
    if (body.action === 'block') {
      await store.blockPlayer(player.id, target.id);
    } else {
      await store.unblockPlayer(player.id, target.id);
    }
    return NextResponse.json({
      ok: true,
      blockedIds: await store.listBlockedIds(player.id),
    });
  },
);
