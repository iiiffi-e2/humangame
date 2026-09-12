import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkCrewName, crewSlug, generateInviteCode } from '@/lib/auth/username';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ name: z.string().min(2).max(32) });

/** Crews are private by design: you get in through a code or a link, not search. */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'crew-create', limit: 10, windowSeconds: 3600 },
    perIp: { name: 'crew-create', limit: 30, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const name = checkCrewName(body.name);
    if (!name.ok) {
      return NextResponse.json({ error: name.error, code: 'BAD_NAME' }, { status: 400 });
    }

    const store = getStore();
    const slug = crewSlug(name.value);
    if (await store.getCrewBySlug(slug)) {
      return NextResponse.json({ error: 'That crew name is taken.', code: 'TAKEN' }, { status: 409 });
    }

    const crew = await store.createCrew({
      id: randomUUID(),
      name: name.value,
      slug,
      inviteCode: generateInviteCode(),
      ownerId: player.id,
      createdAt: new Date().toISOString(),
    });
    await store.addCrewMember({
      crewId: crew.id,
      playerId: player.id,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    });

    return NextResponse.json({ crew });
  },
);
