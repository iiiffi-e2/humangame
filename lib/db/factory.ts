import { hasSupabase, serverEnv } from '@/lib/env';
import { MemoryStore } from './memory-store';
import { SupabaseStore } from './supabase-store';
import type { DataStore } from './types';

declare global {
  var __humanStore: DataStore | undefined;
}

/**
 * The single data store for the process.
 *
 * Cached on `globalThis` so Next's dev server does not hand out a fresh (and,
 * for the file-backed store, divergent) instance on every hot reload.
 *
 * This module is deliberately free of `server-only` so the CLI scripts and
 * the unit tests can use exactly the same store the app uses. `lib/db`
 * re-exports it for application code and adds the server-only guard there.
 */
export function createStore(): DataStore {
  if (globalThis.__humanStore) return globalThis.__humanStore;
  const env = serverEnv();
  const store: DataStore = hasSupabase()
    ? new SupabaseStore(env.supabaseUrl, env.supabaseServiceKey)
    : new MemoryStore(env.devDbPath);
  globalThis.__humanStore = store;
  return store;
}

/** Drop the cached store. Used by tests that need a clean file per case. */
export function resetStore(): void {
  globalThis.__humanStore = undefined;
}
