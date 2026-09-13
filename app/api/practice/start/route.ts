import { NextResponse } from 'next/server';
import { z } from 'zod';
import { startPracticeReplay } from '@/features/game-engine/practice-service';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({});

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'practice', limit: 120, windowSeconds: 3600 },
  },
  async ({ player }) => {
    return NextResponse.json(await startPracticeReplay(player.id));
  },
);
