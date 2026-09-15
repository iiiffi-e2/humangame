import { createStore } from '@/lib/db/factory';
import { serverEnv } from '@/lib/env';
import { generateManifest, validateManifest } from './manifest';
import { addDays, currentDateKey } from './reset';

export interface FreezeUpcomingResult {
  created: number;
  skipped: number;
  dates: string[];
}

/** Idempotent pre-generation used by the CLI and the daily cron. */
export async function freezeUpcomingManifests(
  days = 45,
  options: { from?: string; force?: boolean; dryRun?: boolean } = {},
): Promise<FreezeUpcomingResult> {
  const store = createStore();
  const secret = serverEnv().manifestSecret;
  const from = options.from ?? currentDateKey();
  let created = 0;
  let skipped = 0;
  const dates: string[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(from, offset);
    const existing = await store.getManifestByDate(date);
    if (existing && !options.force) {
      skipped += 1;
      continue;
    }
    const manifest = generateManifest(date, {
      secret,
      version: existing ? existing.version + 1 : 1,
    });
    validateManifest(manifest);
    dates.push(date);
    if (!options.dryRun) {
      await store.saveManifest({ ...manifest, status: 'frozen' });
    }
    created += 1;
  }

  return { created, skipped, dates };
}
