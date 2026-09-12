/**
 * Environment access. Anything secret is read through `serverEnv()`, which is
 * never imported from a client component; public values are inlined by Next
 * at build time and live in `publicEnv`.
 *
 * HUMAN runs with zero configuration: when Supabase, Redis, PostHog or Sentry
 * are not configured the app falls back to a local file-backed store and
 * no-op wrappers, so `npm run dev` works on a clean checkout.
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

const DEV_RUN_SECRET = 'human-dev-run-secret-do-not-use-in-production';
const DEV_MANIFEST_SECRET = 'human-dev-manifest-secret-do-not-use-in-production';

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

  return {
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
}

/** True when a real Supabase project is configured for server-side writes. */
export function hasSupabase(): boolean {
  const env = serverEnv();
  return Boolean(env.supabaseUrl && env.supabaseServiceKey);
}

export function hasRedis(): boolean {
  const env = serverEnv();
  return Boolean(env.upstashUrl && env.upstashToken);
}
