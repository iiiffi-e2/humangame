import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStore, resetStore } from '@/lib/db/factory';
import { seedPlayer } from './helpers/official-run';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'human-block-'));
  process.env.HUMAN_DEV_DB = path.join(directory, 'db.json');
  resetStore();
  await seedPlayer(A);
  await seedPlayer(B);
});

afterEach(async () => {
  resetStore();
  await rm(directory, { recursive: true, force: true });
});

describe('player blocks', () => {
  it('records a block and sees it from either side', async () => {
    const store = createStore();
    await store.blockPlayer(A, B);
    expect(await store.listBlockedIds(A)).toEqual([B]);
    expect(await store.isEitherBlocked(A, B)).toBe(true);
    expect(await store.isEitherBlocked(B, A)).toBe(true);
  });

  it('unblocks', async () => {
    const store = createStore();
    await store.blockPlayer(A, B);
    await store.unblockPlayer(A, B);
    expect(await store.listBlockedIds(A)).toEqual([]);
    expect(await store.isEitherBlocked(A, B)).toBe(false);
  });
});
