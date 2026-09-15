import { currentDateKey } from '@/lib/daily/reset';
import { createStore } from '@/lib/db/factory';
import { publicEnv } from '@/lib/env';
import { sendEmail } from './email';

export interface ReminderResult {
  considered: number;
  sent: number;
}

/** Email linked accounts that opted in and have not finished today. */
export async function sendDailyReminders(): Promise<ReminderResult> {
  const store = createStore();
  const today = currentDateKey();
  const manifest = await store.getManifestByDate(today);
  if (!manifest) return { considered: 0, sent: 0 };

  const linked = await store.listLinkedPlayers();
  let sent = 0;
  for (const player of linked) {
    if (player.settings.notifications === 'off' || !player.email) continue;
    const run = await store.getOfficialRun(player.id, manifest.id);
    if (run?.status === 'finished') continue;
    const ok = await sendEmail(
      player.email,
      "Today's five are live",
      `You have not played HUMAN today. ${publicEnv.siteUrl}`,
    );
    if (ok) sent += 1;
  }
  return { considered: linked.length, sent };
}
