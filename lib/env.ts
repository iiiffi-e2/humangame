/**
 * Environment access. Anything secret is read through `serverEnv()`, which is
 * never imported from a client component; public values are inlined by Next
 * at build time and live in `publicEnv`.
 *
 * HUMAN runs with zero configuration: when Supabase, Redis, PostHog or Sentry
 * are not configured the app falls back to a local file-backed store and
 * no-op wrappers, so `npm run dev` works on a clean checkout.
 *
 * Production is fail-closed. `next start` on a real host without secrets,
 * Supabase, or an admin allowlist throws rather than signing tokens with
 * the in-repo development values. File-backed e2e sets `HUMAN_DEV_DB` and
 * is exempt; `HUMAN_ENFORCE_PROD=0` is the explicit override.
 */

export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
} as const;

export interface ServerEnv {
  supabaseUrl: string;
  supabaseServiceKey: string;
  /** Signs run tokens. Required in production. */
  runSecret: string;
  /** Seeds daily manifests. Required in production. */
  manifestSecret: string;
  upstashUrl: string;
  upstashToken: string;
  adminEmails: string[];
  adminUsernames: string[];
  devDbPath: string;
  isProduction: boolean;
}

export const DEV_RUN_SECRET = 'human-dev-run-secret-do-not-use-in-production';
export const DEV_MANIFEST_SECRET = 'human-dev-manifest-secret-do-not-use-in-production';

export class ProductionEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionEnvError';
  }
}

export interface ProductionEnvInput {
  runSecret: string;
  manifestSecret: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  adminEmails: string[];
  adminUsernames: string[];
}

export function assertProductionEnv(env: ProductionEnvInput): void {
  if (!env.runSecret || env.runSecret === DEV_RUN_SECRET) {
    throw new ProductionEnvError(
      'HUMAN_RUN_SECRET must be set to a non-development value in production.',
    );
  }
  if (!env.manifestSecret || env.manifestSecret === DEV_MANIFEST_SECRET) {
    throw new ProductionEnvError(
      'HUMAN_MANIFEST_SECRET must be set to a non-development value in production.',
    );
  }
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new ProductionEnvError(
      'Supabase URL and SUPABASE_SERVICE_ROLE_KEY are required in production.',
    );
  }
  if (env.adminEmails.length === 0 && env.adminUsernames.length === 0) {
    throw new ProductionEnvError(
      'HUMAN_ADMIN_EMAILS or HUMAN_ADMIN_USERNAMES must be set in production.',
    );
  }
}

export function productionRedisWarning(env: {
  upstashUrl: string;
  upstashToken: string;
}): string | null {
  if (env.upstashUrl && env.upstashToken) return null;
  return 'Upstash Redis is not configured. Rate limits are per-process and will not hold across instances.';
}

export function shouldEnforceProduction(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.HUMAN_ENFORCE_PROD === '0') return false;
  if (env.HUMAN_ENFORCE_PROD === '1') return true;
  if (env.HUMAN_DEV_DB) return false;
  return env.NODE_ENV === 'production';
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function serverEnv(): ServerEnv {
  const isProduction = process.env.NODE_ENV === 'production';
  const runSecret = process.env.HUMAN_RUN_SECRET ?? '';
  const manifestSecret = process.env.HUMAN_MANIFEST_SECRET ?? '';
  const env: ServerEnv = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    runSecret: runSecret || DEV_RUN_SECRET,
    manifestSecret: manifestSecret || DEV_MANIFEST_SECRET,
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL ?? '',
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    adminEmails: list(process.env.HUMAN_ADMIN_EMAILS),
    adminUsernames: list(process.env.HUMAN_ADMIN_USERNAMES),
    devDbPath: process.env.HUMAN_DEV_DB ?? '.data/human-dev.json',
    isProduction,
  };

  if (shouldEnforceProduction()) {
    assertProductionEnv(env);
    const redisWarning = productionRedisWarning(env);
    if (redisWarning) console.warn(`[human] ${redisWarning}`);
  }

  return env;
}

/** True when a real Supabase project is configured for server-side writes. */
export function hasSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasRedis(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
