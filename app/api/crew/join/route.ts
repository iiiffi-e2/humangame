import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';

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
    return NextResponse.json({ crew });
  },
);
