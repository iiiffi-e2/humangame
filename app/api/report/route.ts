import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/db';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  subjectType: z.enum(['player', 'crew']),
  subjectId: z.string().min(1).max(64),
  reason: z.string().min(3).max(500),
});

/** Report hook. Reports land in the admin queue; nothing is auto-actioned. */
export const POST = handler(
  {
    schema,
    perPlayer: { name: 'report', limit: 20, windowSeconds: 3600 },
    perIp: { name: 'report', limit: 60, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    const report = await getStore().createReport({
      id: randomUUID(),
      reporterId: player.id,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      reason: body.reason.slice(0, 500),
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: report.id, status: report.status });
  },
);
