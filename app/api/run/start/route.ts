import { NextResponse } from 'next/server';
import { z } from 'zod';
import { startOfficialRun } from '@/features/game-engine/run-service';
import { publicEvent } from '@/lib/daily/manifest';
import { todayKey } from '@/lib/daily/service';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  challengeToken: z.string().min(1).max(64).nullish(),
});

/**
 * Open today's official run.
 *
 * Returns the five events with any answer key stripped, plus a signed run
 * token. If the player already has an unfinished run the same one is resumed
 * and the old token is invalidated.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'run-start', limit: 20, windowSeconds: 3600 },
    perIp: { name: 'run-start', limit: 120, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const challengeToken = body.challengeToken ?? null;
    if (challengeToken) {
      const challenge = await getStore().getChallenge(challengeToken);
      if (!challenge) {
        return NextResponse.json({ error: 'Unknown challenge.', code: 'NO_CHALLENGE' }, { status: 404 });
      }
    }

    const { run, token, manifest, resumed } = await startOfficialRun(player.id, todayKey(), {
      fromChallengeToken: challengeToken,
    });

    return NextResponse.json({
      token,
      runId: run.id,
      resumed,
      completedEvents: run.events.length,
      manifest: {
        id: manifest.id,
        date: manifest.date,
        dayNumber: manifest.dayNumber,
        events: manifest.events.map(publicEvent),
      },
    });
  },
);
