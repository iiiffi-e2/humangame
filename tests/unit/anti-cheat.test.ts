import { describe, expect, it } from 'vitest';
import { assessTrust, checkTiming, countsForPublicBoards, telemetryHash } from '@/lib/anti-cheat';
import {
  issueRunToken,
  readRunToken,
  shortToken,
  signToken,
  verifyToken,
} from '@/lib/anti-cheat/tokens';
import { generateManifest } from '@/lib/daily/manifest';

const SECRET = 'a-test-secret-that-is-long-enough';

describe('signed tokens', () => {
  it('round-trips a payload', () => {
    const token = signToken({ hello: 'world' }, SECRET);
    expect(verifyToken<{ hello: string }>(token, SECRET)?.hello).toBe('world');
  });

  it('refuses a token signed with a different secret', () => {
    const token = signToken({ hello: 'world' }, SECRET);
    expect(verifyToken(token, 'other-secret')).toBeNull();
  });

  it('refuses a tampered payload', () => {
    const token = signToken({ admin: false }, SECRET);
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ admin: true })).toString('base64url')}.${signature}`;
    expect(verifyToken(forged, SECRET)).toBeNull();
  });

  it('refuses malformed input', () => {
    expect(verifyToken('', SECRET)).toBeNull();
    expect(verifyToken('one-part', SECRET)).toBeNull();
    expect(verifyToken('a.b.c', SECRET)).toBeNull();
  });
});

describe('run tokens', () => {
  const base = {
    runId: 'run-1',
    playerId: 'player-1',
    manifestId: 'manifest-1',
    mode: 'official' as const,
  };

  it('carries a single-use id', () => {
    const first = issueRunToken(base, SECRET);
    const second = issueRunToken(base, SECRET);
    expect(first.payload.jti).not.toBe(second.payload.jti);
  });

  it('reads back what it issued', () => {
    const { token, payload } = issueRunToken(base, SECRET);
    expect(readRunToken(token, SECRET)?.jti).toBe(payload.jti);
  });

  it('expires', () => {
    const now = Date.now();
    const { token } = issueRunToken(base, SECRET, now);
    expect(readRunToken(token, SECRET, now + 60 * 60 * 1000)).toBeNull();
  });

  it('mints short, distinct challenge tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => shortToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[a-f0-9]{10}$/);
  });
});

describe('timing plausibility', () => {
  const manifest = generateManifest('2026-09-12', { secret: 'timing-test' });

  it('accepts a normal play', () => {
    for (const event of manifest.events) {
      const [minMs] = event.index >= 0 ? [1_000] : [1_000];
      expect(
        checkTiming(event, { index: event.index, result: {}, durationMs: Math.max(minMs, 6_000) }),
      ).toBeNull();
    }
  });

  it('rejects an instant submission', () => {
    const event = manifest.events[0];
    expect(event).toBeDefined();
    expect(checkTiming(event!, { index: 0, result: {}, durationMs: 5 })).not.toBeNull();
  });

  it('rejects a field that was open for an hour', () => {
    const event = manifest.events[0];
    expect(checkTiming(event!, { index: 0, result: {}, durationMs: 3_600_000 })).not.toBeNull();
  });

  it('rejects a missing duration', () => {
    const event = manifest.events[0];
    expect(checkTiming(event!, { index: 0, result: {}, durationMs: Number.NaN })).not.toBeNull();
  });
});

describe('trust', () => {
  const clean = {
    issues: [],
    totalScore: 6000,
    runDurationMs: 80_000,
    eventPoints: [1200, 1300, 1100, 1200, 1200],
  };

  it('trusts an ordinary run', () => {
    const { trust } = assessTrust(clean);
    expect(trust).toBe('ok');
    expect(countsForPublicBoards(trust)).toBe(true);
  });

  it('flags a run that finished impossibly fast', () => {
    const { trust, reasons } = assessTrust({ ...clean, runDurationMs: 900 });
    expect(trust).toBe('excluded');
    expect(reasons.join(' ')).toContain('implausibly fast');
  });

  it('notes near-perfection but still ranks it, because elite players exist', () => {
    const { trust, reasons } = assessTrust({
      ...clean,
      eventPoints: [2000, 2000, 2000, 2000, 1200],
    });
    expect(trust).toBe('ok');
    expect(countsForPublicBoards(trust)).toBe(true);
    expect(reasons.join(' ')).toContain('near-perfect');
  });

  it('downgrades near-perfection once something impossible is in the run', () => {
    const { trust } = assessTrust({
      ...clean,
      eventPoints: [2000, 2000, 2000, 2000, 1200],
      issues: [{ index: 2, reason: 'too fast to be real' }],
    });
    expect(trust).toBe('suspect');
    expect(countsForPublicBoards(trust)).toBe(false);
  });

  it('flags a single impossible event as doubtful, not fraudulent', () => {
    const { trust } = assessTrust({
      ...clean,
      issues: [{ index: 0, reason: 'field was open too long' }],
    });
    expect(trust).toBe('suspect');
  });

  it('excludes a run with several impossible events', () => {
    const { trust } = assessTrust({
      ...clean,
      issues: [
        { index: 0, reason: 'too fast to be real' },
        { index: 1, reason: 'too fast to be real' },
      ],
    });
    expect(trust).toBe('excluded');
  });
});

describe('telemetry hashes', () => {
  it('is stable for the same submission and different for another', () => {
    const first = telemetryHash('run-1', 0, { heldMs: 3270 });
    expect(telemetryHash('run-1', 0, { heldMs: 3270 })).toBe(first);
    expect(telemetryHash('run-1', 1, { heldMs: 3270 })).not.toBe(first);
    expect(telemetryHash('run-2', 0, { heldMs: 3270 })).not.toBe(first);
  });
});
