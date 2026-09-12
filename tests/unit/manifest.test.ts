import { describe, expect, it } from 'vitest';
import { getGame, GAME_IDS } from '@/features/game-engine/registry';
import { PILLARS } from '@/features/game-engine/types';
import {
  deriveSeed,
  generateManifest,
  manifestFingerprint,
  publicEvent,
  validateManifest,
} from '@/lib/daily/manifest';
import {
  addDays,
  dateKeyForDayNumber,
  dayNumberFor,
  formatCountdown,
  isNextDay,
  msUntilReset,
} from '@/lib/daily/reset';

const SECRET = 'test-manifest-secret';

describe('daily reset', () => {
  it('numbers days from the epoch', () => {
    expect(dayNumberFor('2026-03-13')).toBe(1);
    expect(dayNumberFor('2026-09-12')).toBe(184);
  });

  it('round-trips a day number through its date', () => {
    for (const dayNumber of [1, 42, 184, 999]) {
      expect(dayNumberFor(dateKeyForDayNumber(dayNumber))).toBe(dayNumber);
    }
  });

  it('recognises consecutive days, including across a month end', () => {
    expect(isNextDay('2026-09-12', '2026-09-13')).toBe(true);
    expect(isNextDay('2026-09-30', '2026-10-01')).toBe(true);
    expect(isNextDay('2026-09-12', '2026-09-14')).toBe(false);
    expect(isNextDay('2026-09-13', '2026-09-12')).toBe(false);
  });

  it('adds and subtracts days across a leap boundary', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts down to midnight UTC', () => {
    const at = new Date('2026-09-12T22:00:00.000Z');
    expect(msUntilReset(at)).toBe(2 * 60 * 60 * 1000);
    expect(formatCountdown(msUntilReset(at))).toBe('2h 0m');
  });

  it('rejects a malformed date key', () => {
    expect(() => dayNumberFor('12/09/2026')).toThrow();
  });
});

describe('manifest generation', () => {
  it('derives a stable seed from the secret and the date', () => {
    expect(deriveSeed('2026-09-12', SECRET)).toBe(deriveSeed('2026-09-12', SECRET));
    expect(deriveSeed('2026-09-12', SECRET)).not.toBe(deriveSeed('2026-09-13', SECRET));
    expect(deriveSeed('2026-09-12', SECRET)).not.toBe(deriveSeed('2026-09-12', 'other'));
  });

  it('produces the same five events for the same day, every time', () => {
    const first = generateManifest('2026-09-12', { secret: SECRET });
    const second = generateManifest('2026-09-12', { secret: SECRET });
    expect(manifestFingerprint(first)).toBe(manifestFingerprint(second));
    expect(JSON.stringify(first.events)).toBe(JSON.stringify(second.events));
  });

  it('always runs the five pillars in order', () => {
    for (let offset = 0; offset < 40; offset += 1) {
      const manifest = generateManifest(addDays('2026-09-12', offset), { secret: SECRET });
      expect(manifest.events.map((event) => event.pillar)).toEqual([...PILLARS]);
      expect(() => validateManifest(manifest)).not.toThrow();
    }
  });

  it('uses every registered family across a long enough stretch', () => {
    const used = new Set<string>();
    for (let offset = 0; offset < 200; offset += 1) {
      for (const event of generateManifest(addDays('2026-03-13', offset), { secret: SECRET }).events) {
        used.add(event.gameId);
      }
    }
    expect([...used].sort()).toEqual([...GAME_IDS].sort());
  });

  it('honours an admin family override', () => {
    const manifest = generateManifest('2026-09-12', {
      secret: SECRET,
      familyOverrides: { brain: 'brain.order' },
    });
    expect(manifest.events[3]?.gameId).toBe('brain.order');
  });

  it('refuses an override from the wrong pillar', () => {
    expect(() =>
      generateManifest('2026-09-12', {
        secret: SECRET,
        familyOverrides: { brain: 'crowd.split' },
      }),
    ).toThrow();
  });

  it('strips answer keys before an event reaches the browser', () => {
    const manifest = generateManifest('2026-09-12', {
      secret: SECRET,
      familyOverrides: { brain: 'brain.order' },
    });
    const stored = manifest.events[3];
    expect(stored).toBeDefined();
    const solution = (stored?.config as { solution: string[] }).solution;
    expect(solution.length).toBe(5);
    const sent = publicEvent(stored!);
    expect((sent.config as { solution: string[] }).solution).toEqual([]);
  });
});

describe('every registered family', () => {
  it('creates a valid config and scores a well-formed result', () => {
    for (const id of GAME_IDS) {
      const definition = getGame(id);
      const config = definition.createConfig(`seed:${id}`, 0.5);
      expect(() => definition.validateConfig(config)).not.toThrow();
      expect(definition.instruction(config).length).toBeGreaterThan(3);
      const [minMs, maxMs] = definition.timingWindow(config);
      expect(maxMs).toBeGreaterThan(minMs);
    }
  });

  it('refuses a result that could not have come from real play', () => {
    for (const id of GAME_IDS) {
      const definition = getGame(id);
      const config = definition.createConfig(`seed:${id}`, 0.5);
      expect(() => definition.validateResult(config, null)).toThrow();
      expect(() => definition.validateResult(config, { nonsense: true })).toThrow();
    }
  });
});
