import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GAME_REGISTRY } from '@/features/game-engine/registry';
import { generateManifest, validateManifest } from '@/lib/daily/manifest';
import type { DailyManifest, Pillar } from '@/features/game-engine/types';
import { getStore } from '@/lib/db';
import { serverEnv } from '@/lib/env';
import { handler } from '@/lib/api';
import { isAdmin } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum([
    'regenerate',
    'replace-family',
    'freeze',
    'unfreeze',
    'void-event',
    'void-day',
    'set-crowd-prior',
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pillar: z.enum(['nerve', 'eye', 'memory', 'brain', 'crowd']).optional(),
  gameId: z.string().min(3).max(64).optional(),
  eventIndex: z.number().int().min(0).max(4).optional(),
  /** `set-crowd-prior`: replacement prior. Shares are renormalised on save. */
  prior: z
    .object({
      weight: z.number().min(1).max(100_000),
      shares: z.record(z.string(), z.number().min(0).max(1)).optional(),
      percent: z.number().min(0).max(100).optional(),
    })
    .optional(),
});

/**
 * Admin manifest operations.
 *
 * Editing a *frozen* manifest is refused except for voiding, which is the one
 * operation that has to work after a day has gone live — a defective event is
 * removed from scoring and the day is still ranked out of 10,000.
 */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'admin', limit: 200, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    if (!isAdmin(player)) {
      return NextResponse.json({ error: 'Not an admin.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const store = getStore();
    const existing = await store.getManifestByDate(body.date);
    const frozen = existing?.status === 'frozen';
    const editing =
      body.action !== 'void-event' &&
      body.action !== 'void-day' &&
      body.action !== 'set-crowd-prior';

    if (frozen && editing && body.action !== 'unfreeze') {
      return NextResponse.json(
        { error: 'That day is frozen. Unfreeze it first.', code: 'FROZEN' },
        { status: 409 },
      );
    }

    let manifest: DailyManifest;
    switch (body.action) {
      case 'regenerate': {
        manifest = generateManifest(body.date, {
          secret: serverEnv().manifestSecret,
          version: (existing?.version ?? 0) + 1,
        });
        break;
      }
      case 'replace-family': {
        if (!body.pillar || !body.gameId || !GAME_REGISTRY.has(body.gameId)) {
          return NextResponse.json({ error: 'Pick a family.', code: 'BAD_PAYLOAD' }, { status: 400 });
        }
        const overrides: Partial<Record<Pillar, string>> = {};
        for (const event of existing?.events ?? []) overrides[event.pillar] = event.gameId;
        overrides[body.pillar] = body.gameId;
        manifest = generateManifest(body.date, {
          secret: serverEnv().manifestSecret,
          version: (existing?.version ?? 1),
          familyOverrides: overrides,
          seed: existing?.seed,
        });
        break;
      }
      case 'freeze':
      case 'unfreeze': {
        if (!existing) {
          return NextResponse.json({ error: 'Nothing there yet.', code: 'NO_MANIFEST' }, { status: 404 });
        }
        manifest = { ...existing, status: body.action === 'freeze' ? 'frozen' : 'draft' };
        break;
      }
      case 'void-event': {
        if (!existing || body.eventIndex === undefined) {
          return NextResponse.json({ error: 'Pick an event.', code: 'BAD_PAYLOAD' }, { status: 400 });
        }
        manifest = {
          ...existing,
          events: existing.events.map((event) =>
            event.index === body.eventIndex ? { ...event, voided: true } : event,
          ),
        };
        break;
      }
      case 'set-crowd-prior': {
        if (!existing || body.eventIndex === undefined || !body.prior) {
          return NextResponse.json({ error: 'Pick an event.', code: 'BAD_PAYLOAD' }, { status: 400 });
        }
        manifest = {
          ...existing,
          events: existing.events.map((event) => {
            if (event.index !== body.eventIndex || event.pillar !== 'crowd') return event;
            const config = { ...(event.config as Record<string, unknown>) };
            config.priorWeight = body.prior?.weight;
            if (body.prior?.shares) config.priorShares = body.prior.shares;
            if (body.prior?.percent !== undefined) config.priorPercent = body.prior.percent;
            return { ...event, config };
          }),
        };
        break;
      }
      case 'void-day': {
        if (!existing) {
          return NextResponse.json({ error: 'Nothing there yet.', code: 'NO_MANIFEST' }, { status: 404 });
        }
        manifest = {
          ...existing,
          events: existing.events.map((event) => ({ ...event, voided: true })),
        };
        break;
      }
    }

    validateManifest(manifest);
    const saved = await store.saveManifest(manifest);
    return NextResponse.json({ manifest: saved });
  },
);
