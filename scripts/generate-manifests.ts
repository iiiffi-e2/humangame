/**
 * Generate and freeze daily manifests ahead of time.
 *
 *   npm run manifest:generate -- --days 45
 *   npm run manifest:generate -- --from 2026-10-01 --days 7 --dry
 *
 * Manifests are deterministic in the secret plus the date, so re-running this
 * is safe: an existing day is left alone unless `--force` is passed.
 */
import { freezeUpcomingManifests } from '@/lib/daily/generate';
import { currentDateKey } from '@/lib/daily/reset';

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

  if (!Number.isFinite(days) || days < 1 || days > 400) {
    throw new Error('--days must be between 1 and 400');
  }

  const result = await freezeUpcomingManifests(days, { from, force, dryRun });
  console.log(
    `${dryRun ? '?' : '+'} ${result.created} created, ${result.skipped} already present${
      result.dates.length ? ` (${result.dates[0]}…)` : ''
    }`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
