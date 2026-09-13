import { NextResponse } from 'next/server';
import { z } from 'zod';
import { practiceEvent } from '@/features/game-engine/run-service';
import { isKnownGame } from '@/features/game-engine/registry';
import { todayKey } from '@/lib/daily/service';
import { getStore } from '@/lib/db';
import { ensureManifest } from '@/lib/daily/service';
import { handler } from '@/lib/api';
import { isAdmin } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ gameId: z.string().min(3).max(64) });

/**
 * Admin-only random-seed family practice. Unlocked only once today's official
 * run is done — it must never be a way to scout the daily before it counts.
 * Practice configs come from a random seed and nothing here touches the
 * official tables.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'practice', limit: 120, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    if (!isAdmin(player)) {
      return NextResponse.json({ error: 'Not found.', code: 'NO_PAGE' }, { status: 404 });
    }
    if (!isKnownGame(body.gameId)) {
      return NextResponse.json({ error: 'Unknown game.', code: 'NO_GAME' }, { status: 404 });
    }
    const manifest = await ensureManifest(todayKey());
    const official = await getStore().getOfficialRun(player.id, manifest.id);
    if (official?.status !== 'finished') {
      return NextResponse.json(
        { error: 'Finish today first.', code: 'PRACTICE_LOCKED' },
        { status: 403 },
      );
    }
    return NextResponse.json({ event: practiceEvent(body.gameId) });
  },
);
