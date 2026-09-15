import { describe, expect, it } from 'vitest';
import {
  DEV_MANIFEST_SECRET,
  DEV_RUN_SECRET,
  ProductionEnvError,
  assertProductionEnv,
  productionRedisWarning,
  shouldEnforceProduction,
} from '@/lib/env';

const ready = {
  runSecret: 'prod-run-secret-prod-run-secret-0001',
  manifestSecret: 'prod-manifest-secret-prod-manifest-01',
  supabaseUrl: 'https://example.supabase.co',
  supabaseServiceKey: 'service-role-key',
  adminEmails: ['ops@example.com'],
  adminUsernames: [] as string[],
};

describe('assertProductionEnv', () => {
  it('accepts a fully configured production envelope', () => {
    expect(() => assertProductionEnv(ready)).not.toThrow();
  });

  it('refuses the in-repo development run secret', () => {
    expect(() => assertProductionEnv({ ...ready, runSecret: DEV_RUN_SECRET })).toThrow(
      ProductionEnvError,
    );
    expect(() => assertProductionEnv({ ...ready, runSecret: '' })).toThrow(/HUMAN_RUN_SECRET/);
  });

  it('refuses the in-repo development manifest secret', () => {
    expect(() => assertProductionEnv({ ...ready, manifestSecret: DEV_MANIFEST_SECRET })).toThrow(
      /HUMAN_MANIFEST_SECRET/,
    );
  });

  it('refuses a production deploy without Supabase', () => {
    expect(() => assertProductionEnv({ ...ready, supabaseUrl: '', supabaseServiceKey: '' })).toThrow(
      /Supabase/,
    );
  });

  it('refuses a production deploy with empty admin allowlists', () => {
    expect(() =>
      assertProductionEnv({ ...ready, adminEmails: [], adminUsernames: [] }),
    ).toThrow(/HUMAN_ADMIN_/);
  });
});

describe('productionRedisWarning', () => {
  it('warns when Redis is missing and stays quiet when it is set', () => {
    expect(productionRedisWarning({ upstashUrl: '', upstashToken: '' })).toMatch(/Redis/);
    expect(
      productionRedisWarning({
        upstashUrl: 'https://example.upstash.io',
        upstashToken: 'token',
      }),
    ).toBeNull();
  });
});

describe('shouldEnforceProduction', () => {
  it('does not enforce on a file-backed e2e or local next start', () => {
    expect(
      shouldEnforceProduction({
        NODE_ENV: 'production',
        HUMAN_DEV_DB: '.data/e2e-db.json',
      }),
    ).toBe(false);
  });

  it('enforces when NODE_ENV is production and no file store is named', () => {
    expect(shouldEnforceProduction({ NODE_ENV: 'production' })).toBe(true);
  });

  it('can be forced on or off', () => {
    expect(shouldEnforceProduction({ NODE_ENV: 'test', HUMAN_ENFORCE_PROD: '1' })).toBe(true);
    expect(
      shouldEnforceProduction({
        NODE_ENV: 'production',
        HUMAN_ENFORCE_PROD: '0',
      }),
    ).toBe(false);
  });
});
