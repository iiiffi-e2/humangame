import 'server-only';
import type { DailyManifest } from '@/features/game-engine/types';
import { getStore } from '@/lib/db';
import { serverEnv } from '@/lib/env';
import { generateManifest, validateManifest } from './manifest';
import { addDays, currentDateKey } from './reset';

/**
 * Manifest access.
 *
 * Manifests are meant to be generated ahead of time by
 * `npm run manifest:generate` and frozen before the day goes live. If a day
 * is missing when someone asks for it — a fresh checkout, or a scheduled job
 * that did not run — one is generated on demand from the same secret, which
 * produces exactly the same five events.
 */
export async function ensureManifest(dateKey: string): Promise<DailyManifest> {
  const store = getStore();
  const existing = await store.getManifestByDate(dateKey);
  if (existing) return existing;

  const manifest = generateManifest(dateKey, { secret: serverEnv().manifestSecret });
  validateManifest(manifest);
  // A manifest that is being played is frozen by definition.
  return store.saveManifest({ ...manifest, status: 'frozen' });
}

export function todayKey(): string {
  return currentDateKey();
}

export async function todayManifest(): Promise<DailyManifest> {
  return ensureManifest(todayKey());
}

export async function yesterdayManifest(): Promise<DailyManifest | null> {
  return getStore().getManifestByDate(addDays(todayKey(), -1));
}
