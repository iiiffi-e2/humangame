import { describe, expect, it } from 'vitest';
import {
  issuePracticeToken,
  issueRunToken,
  readPracticeToken,
} from '@/lib/anti-cheat/tokens';

const SECRET = 'a-test-secret-that-is-long-enough';

describe('practice tokens', () => {
  const base = {
    playerId: 'player-1',
    manifestId: 'manifest-1',
    nextIndex: 0,
    points: [] as number[],
  };

  it('round-trips nextIndex and points', () => {
    const { token, payload } = issuePracticeToken(base, SECRET);
    expect(payload.mode).toBe('practice');
    expect(payload.jti).toBeTruthy();
    const read = readPracticeToken(token, SECRET);
    expect(read).toEqual(payload);
  });

  it('refuses an official run token', () => {
    const { token } = issueRunToken(
      { runId: 'run-1', playerId: 'player-1', manifestId: 'manifest-1', mode: 'official' },
      SECRET,
    );
    expect(readPracticeToken(token, SECRET)).toBeNull();
  });

  it('refuses a tampered points array', () => {
    const { token } = issuePracticeToken({ ...base, nextIndex: 1, points: [1800] }, SECRET);
    const [body, signature] = token.split('.') as [string, string];
    const forged = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    forged.points = [2000];
    const fake = `${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`;
    expect(readPracticeToken(fake, SECRET)).toBeNull();
  });

  it('refuses an expired token', () => {
    const now = 1_700_000_000_000;
    const { token } = issuePracticeToken(base, SECRET, now);
    expect(readPracticeToken(token, SECRET, now + 46 * 60 * 1000)).toBeNull();
  });
});
