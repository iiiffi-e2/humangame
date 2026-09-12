import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';
import type { Rivalry } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['request', 'accept', 'nemesis', 'unnemesis']),
  /** The other player, by id or by handle. */
  target: z.string().min(1).max(64),
});

function pairKey(a: string, b: string): [string, string] {
  return [a, b].sort() as [string, string];
}

/**
 * Rivalries are mutual: one side asks, the other accepts. A Nemesis is a
 * one-sided pin on top of an accepted rivalry — you can make someone your
 * Nemesis without them making you theirs.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'rivalry', limit: 60, windowSeconds: 3600 },
    perIp: { name: 'rivalry', limit: 200, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const store = getStore();
    const target =
      (await store.getPlayer(body.target)) ?? (await store.getPlayerByUsername(body.target));
    if (!target) {
      return NextResponse.json({ error: 'No such player.', code: 'NO_PLAYER' }, { status: 404 });
    }
    if (target.id === player.id) {
      return NextResponse.json(
        { error: 'You cannot be your own nemesis.', code: 'SELF' },
        { status: 400 },
      );
    }

    const [a, b] = pairKey(player.id, target.id);
    const existing = await store.getRivalry(a, b);

    if (body.action === 'request') {
      if (existing?.status === 'active') return NextResponse.json({ rivalry: existing });
      const rivalry: Rivalry = existing ?? {
        id: randomUUID(),
        playerAId: a,
        playerBId: b,
        status: 'pending',
        requestedBy: player.id,
        nemesisFor: [],
        createdAt: new Date().toISOString(),
      };
      return NextResponse.json({ rivalry: await store.saveRivalry(rivalry) });
    }

    if (!existing) {
      return NextResponse.json({ error: 'No rivalry yet.', code: 'NO_RIVALRY' }, { status: 404 });
    }

    if (body.action === 'accept') {
      if (existing.requestedBy === player.id) {
        return NextResponse.json(
          { error: 'The other player has to accept.', code: 'SELF' },
          { status: 400 },
        );
      }
      return NextResponse.json({
        rivalry: await store.saveRivalry({ ...existing, status: 'active' }),
      });
    }

    const nemesisFor = new Set(existing.nemesisFor);
    if (body.action === 'nemesis') nemesisFor.add(player.id);
    else nemesisFor.delete(player.id);

    return NextResponse.json({
      rivalry: await store.saveRivalry({ ...existing, nemesisFor: [...nemesisFor] }),
    });
  },
);
