import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { finishRun, startOfficialRun, submitEvent } from '@/features/game-engine/run-service';
import { getGame } from '@/features/game-engine/registry';
import { createStore, resetStore } from '@/lib/db/factory';
import { currentDateKey } from '@/lib/daily/reset';
import { goodAnswer, playFullRun, seedPlayer } from './helpers/official-run';

/**
 * End-to-end exercise of the official run lifecycle against the file-backed
 * store: start, submit five events, finish, and the rules that must hold
 * around all of it.
 */

let directory: string;
const PLAYER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

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

describe('official run lifecycle', () => {
  it('scores a perfect run at or near 10,000', async () => {
    const { finished } = await playFullRun(PLAYER);
    expect(finished.run.status).toBe('finished');
    expect(finished.run.trust).toBe('ok');
    expect(finished.run.events).toHaveLength(5);
    expect(finished.run.totalScore).toBeGreaterThan(7_000);
    expect(finished.run.totalScore).toBeLessThanOrEqual(10_000);
  });

  it('refuses a second official run on the same day', async () => {
    await playFullRun(PLAYER);
    await expect(startOfficialRun(PLAYER, currentDateKey())).rejects.toMatchObject({
      code: 'ALREADY_PLAYED',
    });
  });

  it('resumes an unfinished run and invalidates the old token', async () => {
    const first = await startOfficialRun(PLAYER, currentDateKey());
    const firstEvent = first.manifest.events[0];
    expect(firstEvent).toBeDefined();
    await submitEvent({ token: first.token, index: 0, result: goodAnswer(firstEvent!), durationMs: 8000 });

    const resumed = await startOfficialRun(PLAYER, currentDateKey());
    expect(resumed.resumed).toBe(true);
    expect(resumed.run.id).toBe(first.run.id);
    expect(resumed.run.events).toHaveLength(1);

    // The first token is now dead — this is the replay protection.
    const secondEvent = first.manifest.events[1];
    await expect(
      submitEvent({ token: first.token, index: 1, result: goodAnswer(secondEvent!), durationMs: 8000 }),
    ).rejects.toMatchObject({ code: 'BAD_TOKEN' });
  });

  it('refuses events submitted out of order', async () => {
    const { token, manifest } = await startOfficialRun(PLAYER, currentDateKey());
    const third = manifest.events[2];
    await expect(
      submitEvent({ token, index: 2, result: goodAnswer(third!), durationMs: 8000 }),
    ).rejects.toMatchObject({ code: 'OUT_OF_ORDER' });
  });

  it('refuses to finish an incomplete run', async () => {
    const { token, manifest } = await startOfficialRun(PLAYER, currentDateKey());
    const first = manifest.events[0];
    await submitEvent({ token, index: 0, result: goodAnswer(first!), durationMs: 8000 });
    await expect(finishRun(token)).rejects.toMatchObject({ code: 'INCOMPLETE' });
  });

  it('rejects a result the family says is impossible', async () => {
    const { token, manifest } = await startOfficialRun(PLAYER, currentDateKey());
    const first = manifest.events[0];
    expect(first).toBeDefined();
    await expect(
      submitEvent({ token, index: 0, result: { nonsense: true }, durationMs: 8000 }),
    ).rejects.toMatchObject({ code: 'BAD_EVENT' });
  });

  it('scores from the stored config, not from anything the client claims', async () => {
    const { token, manifest } = await startOfficialRun(PLAYER, currentDateKey());
    const first = manifest.events[0];
    const definition = getGame(first!.gameId);
    const outcome = await submitEvent({
      token,
      index: 0,
      // A "points: 2000" field in the payload is simply not read.
      result: { ...(goodAnswer(first!) as object), points: 2000, normalized: 1 },
      durationMs: 8000,
    });
    const expected = definition.score(
      first!.config,
      definition.validateResult(first!.config, goodAnswer(first!)),
      undefined,
    );
    expect(outcome.score.points).toBe(expected.points);
  });

  it('flags an implausibly fast run instead of ranking it', async () => {
    const { token, manifest } = await startOfficialRun(PLAYER, currentDateKey());
    for (const event of manifest.events) {
      await submitEvent({ token, index: event.index, result: goodAnswer(event), durationMs: 20 });
    }
    const finished = await finishRun(token);
    expect(finished.run.trust).toBe('excluded');
    expect(finished.trustReasons.length).toBeGreaterThan(0);
  });

  it('keeps suspicious runs out of everyone else’s percentile', async () => {
    // A cheat posts an excluded run; an honest player is unaffected by it.
    const { token, manifest } = await startOfficialRun(PLAYER, currentDateKey());
    for (const event of manifest.events) {
      await submitEvent({ token, index: event.index, result: goodAnswer(event), durationMs: 20 });
    }
    await finishRun(token);

    await seedPlayer(OTHER);
    const { finished } = await playFullRun(OTHER);
    expect(finished.populationSize).toBe(1);
    expect(finished.percentile).toBe(50);
  });

  it('finishing twice is idempotent', async () => {
    const { token, run } = await startOfficialRun(PLAYER, currentDateKey());
    const store = createStore();
    const manifest = (await store.getManifestByDate(currentDateKey()))!;
    for (const event of manifest.events) {
      await submitEvent({ token, index: event.index, result: goodAnswer(event), durationMs: 8000 });
    }
    await store.updateRun(run.id, { startedAt: new Date(Date.now() - 90_000).toISOString() });
    const first = await finishRun(token);
    const second = await finishRun(token);
    expect(second.run.totalScore).toBe(first.run.totalScore);
    const stats = await store.getStats(PLAYER);
    expect(stats?.runsPlayed).toBe(1);
    expect(stats?.streak).toBe(1);
  });

  it('records the crowd answer so the next player is scored against it', async () => {
    const { manifest } = await playFullRun(PLAYER);
    const crowdEvent = manifest.events.find((event) => event.pillar === 'crowd');
    expect(crowdEvent).toBeDefined();
    const tally = await createStore().getCrowdTally(manifest.id, crowdEvent!.index);
    expect(tally.total).toBe(1);
  });
});
