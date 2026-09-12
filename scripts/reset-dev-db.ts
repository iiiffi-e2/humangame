/**
 * Wipe the local development database.
 *
 *   npm run db:reset
 *
 * Only ever touches the file-backed store — if Supabase is configured this
 * refuses to run rather than deleting anything real.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { hasSupabase, serverEnv } from '@/lib/env';

async function main(): Promise<void> {
  if (hasSupabase()) {
    console.error('Supabase is configured. Reset it with the Supabase CLI, not this script.');
    process.exit(1);
  }
  const target = path.resolve(serverEnv().devDbPath);
  await rm(target, { force: true });
  console.log(`Removed ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
