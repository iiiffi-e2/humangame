import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  finishPracticeReplay,
  startPracticeReplay,
  submitPracticeEvent,
} from '@/features/game-engine/practice-service';
import { getGame } from '@/features/game-engine/registry';
import {
  issuePracticeToken,
  issueRunToken,
  readPracticeToken,
} from '@/lib/anti-cheat/tokens';
import { publicEvent } from '@/lib/daily/manifest';
import { createStore, resetStore } from '@/lib/db/factory';
import { goodAnswer, playFullRun, seedPlayer } from './helpers/official-run';

const SECRET = 'a-test-secret-that-is-long-enough';
const PLAYER = '11111111-1111-4111-8111-111111111111';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('practice tokens', () => {
  const base = {
    playerId: 'player-1',
    manifestId: 'manifest-1',
    mode: 'practice' as const,
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

describe('practice replay', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'human-test-'));
    process.env.HUMAN_DEV_DB = path.join(directory, 'db.json');
    process.env.HUMAN_RUN_SECRET = 'test-run-secret-test-run-secret-01';
    process.env.HUMAN_MANIFEST_SECRET = 'test-manifest-secret';
    resetStore();
    await seedPlayer(PLAYER);
  });

  afterEach(async () => {
    resetStore();
    await rm(directory, { recursive: true, force: true });
  });

  it('refuses start before the official run is finished', async () => {
    await expect(startPracticeReplay(PLAYER)).rejects.toMatchObject({
      code: 'PRACTICE_LOCKED',
      status: 403,
    });
  });

  it("returns today's five redacted events after the official run", async () => {
    const { finished, manifest } = await playFullRun(PLAYER);
    const started = await startPracticeReplay(PLAYER);
    expect(started.firstScore).toBe(finished.run.totalScore);
    expect(started.manifest.events.map((event) => event.gameId)).toEqual(
      manifest.events.map((event) => event.gameId),
    );
    expect(started.manifest.events).toEqual(manifest.events.map(publicEvent));
  });

  it('scores a non-crowd event the same way official would', async () => {
    const { manifest } = await playFullRun(PLAYER);
    const started = await startPracticeReplay(PLAYER);
    let token = started.token;
    for (const event of manifest.events) {
      const out = await submitPracticeEvent(PLAYER, {
        token,
        index: event.index,
        result: goodAnswer(event),
        durationMs: 8_000,
      });
      if (event.pillar !== 'crowd') {
        const definition = getGame(event.gameId);
        const result = definition.validateResult(event.config, goodAnswer(event));
        const expected = definition.score(event.config, result);
        expect(out.score.points).toBe(expected.points);
        break;
      }
      token = out.token;
    }
  });

  it('does not write crowd tallies, official score, or extra runs', async () => {
    const { finished, manifest } = await playFullRun(PLAYER);
    const store = createStore();
    const crowdEvent = manifest.events.find((event) => event.pillar === 'crowd')!;
    const before = await store.getCrowdTally(manifest.id, crowdEvent.index);
    const started = await startPracticeReplay(PLAYER);
    let token = started.token;
    for (const event of manifest.events) {
      const out = await submitPracticeEvent(PLAYER, {
        token,
        index: event.index,
        result: goodAnswer(event),
        durationMs: 8_000,
      });
      token = out.token;
    }
    const after = await store.getCrowdTally(manifest.id, crowdEvent.index);
    expect(after).toEqual(before);
    const official = await store.getOfficialRun(PLAYER, manifest.id);
    expect(official?.totalScore).toBe(finished.run.totalScore);
    const runs = await store.listFinishedRuns(manifest.id);
    expect(runs).toHaveLength(1);
  });

  it('finish totals token points and returns the official first score', async () => {
    const { finished, manifest } = await playFullRun(PLAYER);
    const started = await startPracticeReplay(PLAYER);
    let token = started.token;
    const unofficial: number[] = [];
    for (const event of manifest.events) {
      const out = await submitPracticeEvent(PLAYER, {
        token,
        index: event.index,
        result: goodAnswer(event),
        durationMs: 8_000,
      });
      unofficial.push(out.score.points);
      token = out.token;
    }
    const done = await finishPracticeReplay(PLAYER, token);
    expect(done.firstScore).toBe(finished.run.totalScore);
    expect(done.thisRun).toBeGreaterThan(0);
    expect(done.events.map((event) => event.points)).toEqual(unofficial);
  });

  it('rejects a submit for the wrong index', async () => {
    await playFullRun(PLAYER);
    const started = await startPracticeReplay(PLAYER);
    await expect(
      submitPracticeEvent(PLAYER, {
        token: started.token,
        index: 1,
        result: {},
        durationMs: 8_000,
      }),
    ).rejects.toMatchObject({ code: 'OUT_OF_ORDER', status: 409 });
  });
});

describe('removed scout route', () => {
  it('does not ship /api/practice/score', () => {
    expect(existsSync(path.join(REPO_ROOT, 'app/api/practice/score/route.ts'))).toBe(false);
  });
});

describe('admin family catalog', () => {
  it('points PracticeBoard at admin start and score', () => {
    const source = readFileSync(path.join(REPO_ROOT, 'features/practice/PracticeBoard.tsx'), 'utf8');
    expect(source).toContain("'/api/admin/practice/start'");
    expect(source).toContain("'/api/admin/practice/score'");
    expect(source).not.toMatch(/track\(\s*'practice_started'/);
  });

  it('returns 404 JSON when the caller is not an admin', () => {
    const start = readFileSync(path.join(REPO_ROOT, 'app/api/admin/practice/start/route.ts'), 'utf8');
    const score = readFileSync(path.join(REPO_ROOT, 'app/api/admin/practice/score/route.ts'), 'utf8');
    for (const source of [start, score]) {
      expect(source).toContain('if (!isAdmin(player))');
      expect(source).toContain("code: 'NO_PAGE'");
      expect(source).toContain('status: 404');
    }
  });

  it('still requires a finished official run before admin start', () => {
    const start = readFileSync(path.join(REPO_ROOT, 'app/api/admin/practice/start/route.ts'), 'utf8');
    expect(start).toContain('PRACTICE_LOCKED');
    expect(start).toContain('practiceEvent');
  });
});
