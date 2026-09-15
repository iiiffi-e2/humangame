import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler, jsonError } from '@/lib/api';
import { isAdmin } from '@/lib/auth/session';
import { getStore } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  id: z.string().min(1).max(64),
  action: z.enum(['dismiss', 'hide']),
});

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'admin-reports', limit: 200, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    if (!isAdmin(player)) return jsonError('Not an admin.', 'FORBIDDEN', 403);
    const store = getStore();
    const reports = await store.listReports();
    const report = reports.find((entry) => entry.id === body.id);
    if (!report) return jsonError('No such report.', 'NOT_FOUND', 404);

    if (body.action === 'dismiss') {
      return NextResponse.json({ report: await store.updateReport(report.id, { status: 'reviewed' }) });
    }

    if (report.subjectType === 'player') {
      const subject =
        (await store.getPlayer(report.subjectId)) ??
        (await store.getPlayerByUsername(report.subjectId));
      if (subject) await store.updatePlayer(subject.id, { hiddenFromBoards: true });
    } else {
      const crew =
        (await store.getCrew(report.subjectId)) ?? (await store.getCrewBySlug(report.subjectId));
      if (crew) await store.updateCrew(crew.id, { hiddenFromBoards: true });
    }
    return NextResponse.json({
      report: await store.updateReport(report.id, { status: 'actioned' }),
    });
  },
);
