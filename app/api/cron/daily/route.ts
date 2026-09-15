import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/cron';
import { freezeUpcomingManifests } from '@/lib/daily/generate';
import { sendDailyReminders } from '@/lib/notify/reminders';
import { shouldEnforceProduction } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily operator job: freeze a month of manifests and send “you have not
 * played” emails for linked accounts that opted in.
 *
 * Vercel Cron hits this with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const allowed = authorizeCron(request, {
    secret: process.env.CRON_SECRET ?? '',
    enforce: shouldEnforceProduction(),
  });
  if (!allowed) {
    return NextResponse.json({ error: 'Unauthorized.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const manifests = await freezeUpcomingManifests(45);
  const reminders = await sendDailyReminders();
  return NextResponse.json({ ok: true, manifests, reminders });
}
