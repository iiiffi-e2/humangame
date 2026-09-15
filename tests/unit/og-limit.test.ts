import { afterEach, describe, expect, it } from 'vitest';
import { allowOgRequest } from '@/lib/og-limit';

afterEach(() => {
  globalThis.__humanRateLimit?.clear();
});

describe('allowOgRequest', () => {
  it('allows a small burst and then refuses', async () => {
    const request = new Request('http://localhost/api/og/demo01', {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    const results: boolean[] = [];
    for (let i = 0; i < 40; i += 1) {
      results.push(await allowOgRequest(request));
    }
    expect(results[0]).toBe(true);
    expect(results[results.length - 1]).toBe(false);
    expect(results.filter(Boolean).length).toBeLessThanOrEqual(30);
  });
});
