import { describe, expect, it } from 'vitest';
import { authorizeCron } from '@/lib/cron';

describe('authorizeCron', () => {
  it('accepts a matching bearer secret', () => {
    expect(
      authorizeCron(
        new Request('http://localhost/api/cron/daily', {
          headers: { authorization: 'Bearer cron-secret' },
        }),
        { secret: 'cron-secret', enforce: true },
      ),
    ).toBe(true);
  });

  it('refuses a missing or wrong secret when enforcement is on', () => {
    expect(
      authorizeCron(new Request('http://localhost/api/cron/daily'), {
        secret: 'cron-secret',
        enforce: true,
      }),
    ).toBe(false);
    expect(
      authorizeCron(
        new Request('http://localhost/api/cron/daily', {
          headers: { authorization: 'Bearer nope' },
        }),
        { secret: 'cron-secret', enforce: true },
      ),
    ).toBe(false);
    expect(
      authorizeCron(new Request('http://localhost/api/cron/daily'), {
        secret: '',
        enforce: true,
      }),
    ).toBe(false);
  });

  it('allows local and e2e when no secret is set and enforcement is off', () => {
    expect(
      authorizeCron(new Request('http://localhost/api/cron/daily'), {
        secret: '',
        enforce: false,
      }),
    ).toBe(true);
  });
});
