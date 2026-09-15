import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';
import { notifyPlayer } from '@/lib/notify/deliver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().min(4).max(12) });

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'crew-join', limit: 30, windowSeconds: 3600 },
    perIp: { name: 'crew-join', limit: 100, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const store = getStore();
    const crew = await store.getCrewByInviteCode(body.code.trim());
    if (!crew) {
      return NextResponse.json({ error: 'No crew with that code.', code: 'NO_CREW' }, { status: 404 });
    }
    if (await store.isEitherBlocked(player.id, crew.ownerId)) {
      return NextResponse.json({ error: 'You cannot join that crew.', code: 'BLOCKED' }, { status: 403 });
    }
    const members = await store.listCrewMembers(crew.id);
    if (members.length >= 50) {
      return NextResponse.json({ error: 'That crew is full.', code: 'FULL' }, { status: 409 });
    }
    await store.addCrewMember({
      crewId: crew.id,
      playerId: player.id,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });
    const owner = await store.getPlayer(crew.ownerId);
    if (owner) {
      await notifyPlayer(owner, {
        kind: 'crew_joined',
        body: `${player.displayName} joined ${crew.name}.`,
        href: `/crew/${crew.slug}`,
      });
    }
    return NextResponse.json({ crew });
  },
);
