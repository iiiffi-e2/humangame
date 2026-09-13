import { NextResponse } from 'next/server';
import { z } from 'zod';
import { finishPracticeReplay } from '@/features/game-engine/practice-service';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ token: z.string().min(10).max(2048) });

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'practice-finish', limit: 120, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    return NextResponse.json(await finishPracticeReplay(player.id, body.token));
  },
);
