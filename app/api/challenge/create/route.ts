import { NextResponse } from 'next/server';
import { z } from 'zod';
import { shortToken } from '@/lib/anti-cheat/tokens';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';
import { publicEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ runId: z.string().min(8).max(64) });

/**
 * Mint a challenge link for a finished run. The token is short and
 * unguessable; the landing page it points at shows the score and percentile
 * but never the day's answers.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'challenge-create', limit: 60, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const store = getStore();
    const run = await store.getRun(body.runId);
    if (!run || run.playerId !== player.id) {
      return NextResponse.json({ error: 'No such run.', code: 'NO_RUN' }, { status: 404 });
    }
    if (run.status !== 'finished') {
      return NextResponse.json(
        { error: 'Finish the run first.', code: 'INCOMPLETE' },
        { status: 400 },
      );
    }

    const existing = await store.getChallengeForRun(run.id);
    const link =
      existing ??
      (await store.createChallenge({
        token: shortToken(),
        runId: run.id,
        playerId: player.id,
        manifestId: run.manifestId,
        createdAt: new Date().toISOString(),
      }));

    return NextResponse.json({
      token: link.token,
      url: `${publicEnv.siteUrl}/c/${link.token}`,
    });
  },
);
