import { NextResponse } from 'next/server';
import { z } from 'zod';
import { submitEvent } from '@/features/game-engine/run-service';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(10).max(2048),
  index: z.number().int().min(0).max(4),
  durationMs: z.number().min(0).max(3_600_000),
  /** Shape is validated by the game family, which knows its own result type. */
  result: z.unknown(),
});

/**
 * Submit one event. The server re-scores it from the stored manifest config
 * and returns the points for the interstitial — the client's own arithmetic
 * is never trusted or even sent.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'run-event', limit: 200, windowSeconds: 3600 },
    perIp: { name: 'run-event', limit: 1000, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const outcome = await submitEvent({
      token: body.token,
      playerId: player.id,
      index: body.index,
      result: body.result,
      durationMs: body.durationMs,
    });
    return NextResponse.json(outcome);
  },
);
