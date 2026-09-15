import { NextResponse } from 'next/server';
import { z } from 'zod';
import { finishRun } from '@/features/game-engine/run-service';
import { buildResultPayload } from '@/features/results/build';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().min(10).max(2048),
});

/**
 * Finalise the run: total, percentile, trust, streak and share token, all in
 * one step so a finished run can never exist without its stats.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'run-finish', limit: 30, windowSeconds: 3600 },
    perIp: { name: 'run-finish', limit: 200, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const outcome = await finishRun(body.token, player.id);
    const payload = await buildResultPayload(outcome.run, player);
    return NextResponse.json({
      ...payload,
      resultId: outcome.run.id,
      shareToken: outcome.shareToken,
      populationSize: outcome.populationSize,
    });
  },
);
