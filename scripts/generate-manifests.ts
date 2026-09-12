/**
 * Generate and freeze daily manifests ahead of time.
 *
 *   npm run manifest:generate -- --days 45
 *   npm run manifest:generate -- --from 2026-10-01 --days 7 --dry
 *
 * Manifests are deterministic in the secret plus the date, so re-running this
 * is safe: an existing day is left alone unless `--force` is passed.
 */
import { generateManifest, manifestFingerprint, validateManifest } from '@/lib/daily/manifest';
import { addDays, currentDateKey } from '@/lib/daily/reset';
import { createStore as getStore } from '@/lib/db/factory';
import { serverEnv } from '@/lib/env';

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function main(): Promise<void> {
  const days = Number(arg('days', '30'));
  const from = arg('from', currentDateKey()) as string;
  const dryRun = process.argv.includes('--dry');
  const force = process.argv.includes('--force');
  const freeze = !process.argv.includes('--draft');
  const store = getStore();
  const secret = serverEnv().manifestSecret;

  if (!Number.isFinite(days) || days < 1 || days > 400) {
    throw new Error('--days must be between 1 and 400');
  }

  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(from, offset);
    const existing = await store.getManifestByDate(date);
    if (existing && !force) {
      console.log(`· ${date} #${existing.dayNumber} already ${existing.status}`);
      continue;
    }

    const manifest = generateManifest(date, {
      secret,
      version: existing ? existing.version + 1 : 1,
    });
    validateManifest(manifest);
    const families = manifest.events.map((event) => event.gameId.split('.')[1]).join(' · ');
    console.log(
      `${dryRun ? '?' : '+'} ${date} #${manifest.dayNumber} ${families} [${manifestFingerprint(manifest)}]`,
    );
    if (!dryRun) {
      await store.saveManifest({ ...manifest, status: freeze ? 'frozen' : 'draft' });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
