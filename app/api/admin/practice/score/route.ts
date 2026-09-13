import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGame, isKnownGame } from '@/features/game-engine/registry';
import { handler } from '@/lib/api';
import { isAdmin } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  gameId: z.string().min(3).max(64),
  seed: z.string().min(3).max(128),
  difficulty: z.number().min(0).max(1),
  result: z.unknown(),
});

/**
 * Score an admin practice attempt.
 *
 * The config is regenerated from the seed rather than accepted from the
 * client, which is what lets practice hide the same answer keys the official
 * run hides while still scoring honestly. Practice writes nothing.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'practice-score', limit: 300, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    if (!isAdmin(player)) {
      return NextResponse.json({ error: 'Not found.', code: 'NO_PAGE' }, { status: 404 });
    }
    if (!isKnownGame(body.gameId)) {
      return NextResponse.json({ error: 'Unknown game.', code: 'NO_GAME' }, { status: 404 });
    }
    const definition = getGame(body.gameId);
    const config = definition.createConfig(body.seed, body.difficulty);
    definition.validateConfig(config);
    try {
      const result = definition.validateResult(config, body.result);
      return NextResponse.json({ score: definition.score(config, result) });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Rejected.', code: 'BAD_EVENT' },
        { status: 400 },
      );
    }
  },
);
