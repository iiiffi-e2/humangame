import { NextResponse } from 'next/server';
import { z } from 'zod';
import { submitPracticeEvent } from '@/features/game-engine/practice-service';
import { handler } from '@/lib/api';
import { EVENTS_PER_RUN } from '@/lib/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(10).max(2048),
  index: z.number().int().min(0).max(EVENTS_PER_RUN - 1),
  durationMs: z.number().min(0).max(3_600_000),
  /** Shape is validated by the game family, which knows its own result type. */
  result: z.unknown(),
});

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'practice-event', limit: 300, windowSeconds: 3600 },
    perIp: { name: 'practice-event', limit: 1000, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    return NextResponse.json(await submitPracticeEvent(player.id, body));
  },
);
