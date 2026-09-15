# Today's Practice Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the official run, `/practice` replays today's exact five events, shows an unofficial total next to the first score, and never exposes families that are not in today.

**Architecture:** Practice is not a run. A signed practice token carries `nextIndex` and accepted unofficial `points`. Start / event / finish live in a new `practice-service` that scores against the stored manifest, reads the current CROWD blend, and writes nothing. `/practice` drives a five-event client loop; the old fifteen-family board moves to `/admin/practice`.

**Tech Stack:** Next.js 16 App Router, Vitest, Playwright, existing HMAC tokens in `lib/anti-cheat/tokens.ts`, `RunError` from `features/game-engine/run-service.ts`.

## Global Constraints

- Practice is not a run: no practice row, no stats, no leaderboard, no streak, no crowd tally write.
- Only today's five events, exact stored configs, same order as the official run.
- Only the first official score counts; the replay number is shown, never stored as official.
- Families that are not in today never appear on `/practice` and are not startable or scoreable.
- The client never sends a score. Token `points` are server-signed.
- CROWD scores against the current blend (prior + official responses). Practice picks do not enter the tally.
- Practice is locked until today's official run is `finished`.
- Refresh mid-replay starts over. No `localStorage` for practice.
- `POST /api/practice/score` (arbitrary `gameId` + seed) is removed.

## File map

- Create: `features/game-engine/practice-service.ts` — start / submit / finish
- Create: `tests/unit/helpers/official-run.ts` — shared `goodAnswer`, `seedPlayer`, `playFullRun`
- Create: `tests/unit/practice.test.ts` — token + service lifecycle
- Create: `app/api/practice/event/route.ts`
- Create: `app/api/practice/finish/route.ts`
- Create: `app/api/admin/practice/start/route.ts`
- Create: `app/api/admin/practice/score/route.ts`
- Create: `app/admin/practice/page.tsx`
- Create: `features/practice/PracticeReplay.tsx` — five-event loop + compare
- Modify: `lib/anti-cheat/tokens.ts` — `PracticeTokenPayload`, issue/read
- Modify: `app/api/practice/start/route.ts` — no `gameId`, today's five
- Delete: `app/api/practice/score/route.ts`
- Modify: `app/practice/page.tsx` — landing / replay instead of catalog
- Modify: `features/practice/PracticeBoard.tsx` — admin-only API paths
- Modify: `features/game-engine/run-service.ts` — move `practiceEvent` out or keep exported for admin
- Modify: `lib/analytics/events.ts` — `practice_started` / `practice_completed`
- Modify: `tests/e2e/daily.spec.ts`, `docs/admin.md`, `README.md`

`practiceEvent` stays in `run-service.ts` (already exported). Admin start calls it. Do not invent a second random-seed helper.

---

### Task 1: Practice tokens

**Files:**
- Modify: `lib/anti-cheat/tokens.ts`
- Test: `tests/unit/practice.test.ts` (token describe block; service tests land in Task 2 in the same file)

**Interfaces:**
- Consumes: existing `signToken`, `verifyToken`, `RUN_TOKEN_TTL_MS`
- Produces:
  - `PracticeTokenPayload` `{ jti, playerId, manifestId, mode: 'practice', nextIndex: number, points: number[], iat, exp }`
  - `issuePracticeToken(input: Omit<PracticeTokenPayload, 'jti' | 'iat' | 'exp'>, secret: string, now?: number): { token: string; payload: PracticeTokenPayload }`
  - `readPracticeToken(token: string, secret: string, now?: number): PracticeTokenPayload | null`

- [ ] **Step 1: Write the failing token tests**

Create `tests/unit/practice.test.ts` with only the token describe for now:

```ts
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
```

- [ ] **Step 2: Run the token tests and confirm they fail**

Run: `npx vitest run tests/unit/practice.test.ts`
Expected: FAIL — `issuePracticeToken` / `readPracticeToken` are not exported.

- [ ] **Step 3: Implement practice tokens**

Append to `lib/anti-cheat/tokens.ts` (do not change `RunTokenPayload` or `issueRunToken`):

```ts
export interface PracticeTokenPayload {
  jti: string;
  playerId: string;
  manifestId: string;
  mode: 'practice';
  nextIndex: number;
  points: number[];
  iat: number;
  exp: number;
}

export function issuePracticeToken(
  input: Omit<PracticeTokenPayload, 'jti' | 'iat' | 'exp'>,
  secret: string,
  now: number = Date.now(),
): { token: string; payload: PracticeTokenPayload } {
  const payload: PracticeTokenPayload = {
    ...input,
    mode: 'practice',
    jti: randomUUID(),
    iat: now,
    exp: now + RUN_TOKEN_TTL_MS,
  };
  return { token: signToken(payload, secret), payload };
}

export function readPracticeToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): PracticeTokenPayload | null {
  const payload = verifyToken<PracticeTokenPayload>(token, secret);
  if (!payload) return null;
  if (payload.mode !== 'practice') return null;
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  if (!payload.jti || !payload.playerId || !payload.manifestId) return null;
  if (!Number.isInteger(payload.nextIndex) || payload.nextIndex < 0 || payload.nextIndex > 5) {
    return null;
  }
  if (!Array.isArray(payload.points) || payload.points.length !== payload.nextIndex) return null;
  if (payload.points.some((value) => !Number.isInteger(value))) return null;
  return payload;
}
```

- [ ] **Step 4: Re-run token tests**

Run: `npx vitest run tests/unit/practice.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/anti-cheat/tokens.ts tests/unit/practice.test.ts
git commit -m "Add signed practice tokens that carry unofficial points."
```

---

### Task 2: Practice service

**Files:**
- Create: `features/game-engine/practice-service.ts`
- Modify: `tests/unit/practice.test.ts`
- Reuse: `RunError` from `features/game-engine/run-service.ts` (already has `PRACTICE_LOCKED`)

**Interfaces:**
- Consumes: `issuePracticeToken`, `readPracticeToken`, `ensureManifest`, `todayKey`, `publicEvent`, `getGame`, `checkTiming`, `totalScore`, `EVENTS_PER_RUN`
- Produces:
  - `startPracticeReplay(playerId: string): Promise<StartPracticeOutput>`
  - `submitPracticeEvent(playerId: string, input: { token: string; index: number; result: unknown; durationMs: number }): Promise<SubmitPracticeOutput>`
  - `finishPracticeReplay(playerId: string, token: string): Promise<FinishPracticeOutput>`
  - `StartPracticeOutput` `{ token, firstScore, manifest: { id, date, dayNumber, events } }`
  - `SubmitPracticeOutput` `{ score, pillar, gameId, index, nextIndex: number | null, token }`
  - `FinishPracticeOutput` `{ thisRun, firstScore, events: Array<{ index, pillar, gameId, points }> }`

- [ ] **Step 1: Add failing service tests to `tests/unit/practice.test.ts`**

Extract `goodAnswer`, `seedPlayer`, and `playFullRun` from `tests/unit/run-lifecycle.test.ts` into `tests/unit/helpers/official-run.ts`. Point `run-lifecycle.test.ts` at that module. Import the same helpers from `practice.test.ts`. Do not duplicate the helper bodies. Then add:

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { finishRun, startOfficialRun, submitEvent } from '@/features/game-engine/run-service';
import {
  finishPracticeReplay,
  startPracticeReplay,
  submitPracticeEvent,
} from '@/features/game-engine/practice-service';
import { getGame } from '@/features/game-engine/registry';
import type { DailyEvent } from '@/features/game-engine/types';
import { createStore, resetStore } from '@/lib/db/factory';
import { DEFAULT_SETTINGS } from '@/lib/db/types';
import { currentDateKey } from '@/lib/daily/reset';
import { publicEvent } from '@/lib/daily/manifest';

const PLAYER = '11111111-1111-4111-8111-111111111111';

// Import goodAnswer, seedPlayer, playFullRun from tests/unit/helpers/official-run.ts

describe('practice replay', () => {
  it('refuses start before the official run is finished', async () => {
    await expect(startPracticeReplay(PLAYER)).rejects.toMatchObject({
      code: 'PRACTICE_LOCKED',
      status: 403,
    });
  });

  it('returns today\'s five redacted events after the official run', async () => {
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
    const event = manifest.events.find((item) => item.pillar !== 'crowd') as DailyEvent;
    const definition = getGame(event.gameId);
    const result = definition.validateResult(event.config, goodAnswer(event));
    const expected = definition.score(event.config, result);
    const submitted = await submitPracticeEvent(PLAYER, {
      token: started.token,
      index: event.index,
      result: goodAnswer(event),
      durationMs: 8_000,
    });
    expect(submitted.score.points).toBe(expected.points);
    expect(submitted.nextIndex).toBe(event.index + 1);
  });

  it('does not write crowd tallies, official score, or extra runs', async () => {
    const { finished, manifest } = await playFullRun(PLAYER);
    const store = createStore();
    const crowdEvent = manifest.events.find((event) => event.pillar === 'crowd') as DailyEvent;
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
```

Keep the Task 1 token describe in the same file.

The non-crowd test submits `event.index` first. If that index is not 0, it will fail `OUT_OF_ORDER`. **Fix the test:** walk events in order and only assert equality on the first non-crowd event you actually submit in sequence (always start at 0). Replace that test body with:

```ts
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
```

NERVE is always first, so this asserts on event 0 and never needs a crowd context.

- [ ] **Step 2: Run service tests and confirm they fail**

Run: `npx vitest run tests/unit/practice.test.ts`
Expected: FAIL — `practice-service` module missing.

- [ ] **Step 3: Implement `features/game-engine/practice-service.ts`**

```ts
import 'server-only';
import { getGame } from '@/features/game-engine/registry';
import { RunError } from '@/features/game-engine/run-service';
import type { DailyEvent, DailyManifest, Pillar } from '@/features/game-engine/types';
import { checkTiming } from '@/lib/anti-cheat';
import { issuePracticeToken, readPracticeToken } from '@/lib/anti-cheat/tokens';
import { publicEvent } from '@/lib/daily/manifest';
import { ensureManifest, todayKey } from '@/lib/daily/service';
import { getStore } from '@/lib/db';
import type { CrowdTallyRow, Run } from '@/lib/db/types';
import { serverEnv } from '@/lib/env';
import { EVENTS_PER_RUN, totalScore, type ScoreResult } from '@/lib/scoring';

export interface StartPracticeOutput {
  token: string;
  firstScore: number;
  manifest: {
    id: string;
    date: string;
    dayNumber: number;
    events: DailyEvent[];
  };
}

export interface SubmitPracticeOutput {
  score: ScoreResult;
  pillar: Pillar;
  gameId: string;
  index: number;
  nextIndex: number | null;
  token: string;
}

export interface FinishPracticeOutput {
  thisRun: number;
  firstScore: number;
  events: Array<{ index: number; pillar: Pillar; gameId: string; points: number }>;
}

async function requireFinishedOfficial(playerId: string): Promise<{
  manifest: DailyManifest;
  official: Run;
}> {
  const manifest = await ensureManifest(todayKey());
  const official = await getStore().getOfficialRun(playerId, manifest.id);
  if (official?.status !== 'finished') {
    throw new RunError('Finish today first.', 'PRACTICE_LOCKED', 403);
  }
  return { manifest, official };
}

function readOwnedToken(token: string, playerId: string) {
  const payload = readPracticeToken(token, serverEnv().runSecret);
  if (!payload) throw new RunError('Practice token is missing or expired.', 'BAD_TOKEN', 401);
  if (payload.playerId !== playerId) {
    throw new RunError('Practice token does not match this player.', 'BAD_TOKEN', 401);
  }
  return payload;
}

async function crowdContext(
  manifestId: string,
  event: DailyEvent,
): Promise<CrowdTallyRow | undefined> {
  if (event.pillar !== 'crowd') return undefined;
  return getStore().getCrowdTally(manifestId, event.index);
}

export async function startPracticeReplay(playerId: string): Promise<StartPracticeOutput> {
  const { manifest, official } = await requireFinishedOfficial(playerId);
  const { token } = issuePracticeToken(
    { playerId, manifestId: manifest.id, nextIndex: 0, points: [] },
    serverEnv().runSecret,
  );
  return {
    token,
    firstScore: official.totalScore,
    manifest: {
      id: manifest.id,
      date: manifest.date,
      dayNumber: manifest.dayNumber,
      events: manifest.events.map(publicEvent),
    },
  };
}

export async function submitPracticeEvent(
  playerId: string,
  input: { token: string; index: number; result: unknown; durationMs: number },
): Promise<SubmitPracticeOutput> {
  const payload = readOwnedToken(input.token, playerId);
  const { manifest } = await requireFinishedOfficial(playerId);
  if (payload.manifestId !== manifest.id) {
    throw new RunError('Practice token is missing or expired.', 'BAD_TOKEN', 401);
  }
  if (input.index !== payload.nextIndex || input.index < 0 || input.index > 4) {
    throw new RunError(
      `Expected event ${payload.nextIndex}, received ${input.index}.`,
      'OUT_OF_ORDER',
      409,
    );
  }

  const event = manifest.events[input.index];
  if (!event) throw new RunError('No such event in today.', 'BAD_EVENT', 400);

  const definition = getGame(event.gameId);
  let validated: unknown = null;
  if (!event.voided) {
    try {
      validated = definition.validateResult(event.config, input.result);
    } catch (error) {
      throw new RunError(
        error instanceof Error ? error.message : 'Result rejected.',
        'BAD_EVENT',
        400,
      );
    }
    const timing = checkTiming(event, {
      index: event.index,
      result: validated,
      durationMs: input.durationMs,
    });
    if (timing) throw new RunError(timing, 'BAD_EVENT', 400);
  }

  const crowd = await crowdContext(manifest.id, event);
  const score = event.voided
    ? { rawMetric: 0, normalized: 0, points: 0, label: 'Voided' }
    : definition.score(event.config, validated, crowd ? { crowd } : undefined);

  const nextIndex = payload.nextIndex + 1;
  const points = [...payload.points, score.points];
  const { token } = issuePracticeToken(
    { playerId, manifestId: manifest.id, nextIndex, points },
    serverEnv().runSecret,
  );

  return {
    score,
    pillar: event.pillar,
    gameId: event.gameId,
    index: event.index,
    nextIndex: nextIndex < EVENTS_PER_RUN ? nextIndex : null,
    token,
  };
}

export async function finishPracticeReplay(
  playerId: string,
  token: string,
): Promise<FinishPracticeOutput> {
  const payload = readOwnedToken(token, playerId);
  const { manifest, official } = await requireFinishedOfficial(playerId);
  if (payload.manifestId !== manifest.id) {
    throw new RunError('Practice token is missing or expired.', 'BAD_TOKEN', 401);
  }
  if (payload.nextIndex !== EVENTS_PER_RUN || payload.points.length !== EVENTS_PER_RUN) {
    throw new RunError(
      `Replay has ${payload.points.length} of ${EVENTS_PER_RUN} events.`,
      'INCOMPLETE',
      400,
    );
  }

  const voidedIndexes = manifest.events
    .filter((event) => event.voided)
    .map((event) => event.index);
  const thisRun = totalScore(payload.points, voidedIndexes);

  return {
    thisRun,
    firstScore: official.totalScore,
    events: manifest.events.map((event, index) => ({
      index: event.index,
      pillar: event.pillar,
      gameId: event.gameId,
      points: payload.points[index] as number,
    })),
  };
}
```

Do not call `addCrowdResponse`. Do not call `createRun` / `updateRun` / `saveStats`.

- [ ] **Step 4: Re-run practice tests**

Run: `npx vitest run tests/unit/practice.test.ts`
Expected: PASS (token tests + 6 service tests)

If a timing rejection fires on `durationMs: 8_000`, raise it to a value inside that family's window (official lifecycle uses 8_000 and passes finish-time checks; submit-time `checkTiming` is stricter on the low end, not the high end, so 8_000 should pass).

- [ ] **Step 5: Commit**

```bash
git add features/game-engine/practice-service.ts tests/unit/practice.test.ts
git commit -m "Score today's practice replay without writing a run."
```

---

### Task 3: Practice HTTP routes

**Files:**
- Modify: `app/api/practice/start/route.ts`
- Create: `app/api/practice/event/route.ts`
- Create: `app/api/practice/finish/route.ts`
- Delete: `app/api/practice/score/route.ts`

**Interfaces:**
- Consumes: `startPracticeReplay`, `submitPracticeEvent`, `finishPracticeReplay`
- Produces: JSON shapes matching those return types. Start body is `{}` (no `gameId`).

- [ ] **Step 1: Write a failing test that the seed-based score route is gone**

Add to `tests/unit/practice.test.ts`:

```ts
describe('removed scout route', () => {
  it('does not ship /api/practice/score', async () => {
    await expect(import('../../app/api/practice/score/route')).rejects.toThrow();
  });
});
```

(Vitest resolves from `tests/unit/`, so that relative path is `app/api/practice/score/route.ts`.)

- [ ] **Step 2: Run that test**

Run: `npx vitest run tests/unit/practice.test.ts -t "does not ship"`
Expected: FAIL — the module still exists.

- [ ] **Step 3: Replace the public practice routes**

`app/api/practice/start/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { startPracticeReplay } from '@/features/game-engine/practice-service';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({});

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'practice', limit: 120, windowSeconds: 3600 },
  },
  async ({ player }) => {
    return NextResponse.json(await startPracticeReplay(player.id));
  },
);
```

`app/api/practice/event/route.ts` — same schema as `app/api/run/event/route.ts`, call `submitPracticeEvent(player.id, body)`, rate limit names `practice-event` 300/hour player and 1000/hour IP.

`app/api/practice/finish/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { finishPracticeReplay } from '@/features/game-engine/practice-service';
import { handler } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ token: z.string().min(10).max(2048) });

export const POST = handler(
  {
    schema,
    perPlayer: { name: 'practice-finish', limit: 120, windowSeconds: 3600 },
  },
  async ({ body, player }) => {
    return NextResponse.json(await finishPracticeReplay(player.id, body.token));
  },
);
```

Delete `app/api/practice/score/route.ts`.

- [ ] **Step 4: Re-run unit tests**

Run: `npx vitest run tests/unit/practice.test.ts`
Expected: PASS, including the missing-module test.

- [ ] **Step 5: Commit**

```bash
git add app/api/practice tests/unit/practice.test.ts
git commit -m "Expose start, event, and finish for today's practice replay."
```

(`git add app/api/practice` stages the delete of `score/route.ts`.)

---

### Task 4: Player practice UI

**Files:**
- Create: `features/practice/PracticeReplay.tsx`
- Modify: `app/practice/page.tsx`
- Modify: `lib/analytics/events.ts`

**Interfaces:**
- Consumes: `POST /api/practice/start` → `StartPracticeOutput`; `POST /api/practice/event` → `SubmitPracticeOutput`; `POST /api/practice/finish` → `FinishPracticeOutput`
- Produces: locked page unchanged; unlocked page is landing → five events → compare (first score vs this run)

Do not add `mode` to `RunShell`. Official recovery/`localStorage`/share routing must stay out of practice. Reuse `EventShell` and `GameField` only.

- [ ] **Step 1: Update analytics types (compile-fail for old `gameId` callers)**

In `lib/analytics/events.ts` replace:

```ts
practice_started: { gameId: string };
```

with:

```ts
practice_started: { dayNumber: number };
practice_completed: { dayNumber: number; firstScore: number; thisRun: number };
```

`PracticeBoard.tsx` still calls `track('practice_started', { gameId })`. Leave that broken until Task 5 so the typecheck points at the catalog.

- [ ] **Step 2: Run typecheck and confirm PracticeBoard fails**

Run: `npm run typecheck`
Expected: FAIL on `features/practice/PracticeBoard.tsx` (`gameId` is not assignable).

- [ ] **Step 3: Implement the unlocked `/practice` UI**

`app/practice/page.tsx` — keep the locked "Today first." branch exactly. After `unlocked`, render:

```tsx
return <PracticeReplay reducedMotion={player.settings.reduceMotion} />;
```

Remove `GAMES_BY_PILLAR` / `PILLARS` / `PracticeBoard` imports from this page. Do not pass a family list.

`features/practice/PracticeReplay.tsx` is a client component with phases:

`landing | playing | interstitial | finishing | compare | error`

Behaviour:

1. **Landing** (default; do not call start on mount): heading `Practice`, line `Today's five again. This run does not count.`, button `Play today's five again`.
2. On click: `POST /api/practice/start` with `{}`. Store `token`, `firstScore`, `manifest`. `track('practice_started', { dayNumber })`. Phase `playing`, `index = 0`.
3. Playing: `EventShell` + `GameField` like `RunShell`, footer `Practice. This one doesn't count.` Do not write `localStorage`. Voided events: continue with `null` result, same as `RunShell`.
4. Submit: `POST /api/practice/event` with `{ token, index, durationMs, result }`. Replace `token` with `response.token`. Show an interstitial that matches official (chartreuse, `data-testid="interstitial"`, points `/ 2,000`, tap to continue). Auto-advance after 1400ms.
5. When `nextIndex === null`, `POST /api/practice/finish` with `{ token }`. `track('practice_completed', { dayNumber, firstScore, thisRun })`. Phase `compare`.
6. **Compare:** two numbers labelled `First score` and `This run` (`data-testid="practice-compare"`). Buttons: `Play today's five again` (back to landing and start over) and a `BackLink` to `/` labelled `Today`. No share, no percentile, no streak, no `/result` redirect.
7. 401 / `BAD_TOKEN`: return to landing with a short error. 403: show the same "Today first" copy as the server-rendered lock (or `router.replace('/practice')`).

Copy the interstitial markup from `features/game-engine/RunShell.tsx` (`Interstitial`, ~lines 330–410) into this file rather than exporting it. Keep `data-testid="interstitial"` so e2e `playOneEvent` works.

Use `apiPost` from `@/lib/client/api`.

- [ ] **Step 4: Typecheck the practice page**

Run: `npx tsc --noEmit --pretty false 2>&1 | findstr PracticeReplay app/practice`
On Unix: `npx tsc --noEmit | rg "PracticeReplay|app/practice"`

Expected: no errors in the new files. `PracticeBoard.tsx` may still fail until Task 5.

- [ ] **Step 5: Commit**

```bash
git add features/practice/PracticeReplay.tsx app/practice/page.tsx lib/analytics/events.ts
git commit -m "Replay today's five on /practice with an unofficial compare."
```

---

### Task 5: Admin-only family catalog

**Files:**
- Create: `app/api/admin/practice/start/route.ts`
- Create: `app/api/admin/practice/score/route.ts`
- Create: `app/admin/practice/page.tsx`
- Modify: `features/practice/PracticeBoard.tsx`
- Modify: `docs/admin.md`

**Interfaces:**
- Consumes: existing `practiceEvent(gameId)` from `run-service.ts`; `isAdmin`
- Produces: `/admin/practice` — same random-seed single-family loop as the old public board

- [ ] **Step 1: Point PracticeBoard at admin routes and drop the broken track call**

In `features/practice/PracticeBoard.tsx`:

- `POST /api/admin/practice/start` with `{ gameId }`
- `POST /api/admin/practice/score` with `{ gameId, seed, difficulty, result }`
- Remove `track('practice_started', { gameId })` (type no longer matches)

- [ ] **Step 2: Typecheck — PracticeBoard should be clean; admin routes still missing**

Run: `npm run typecheck`
Expected: FAIL on unresolved `/api/admin/practice/*` only if the client strings do not need those modules at compile time. If typecheck passes (API paths are strings), continue. If `PracticeBoard` is the last error, it should now be gone.

- [ ] **Step 3: Add admin routes and page**

`app/api/admin/practice/start/route.ts` — copy the **old** `app/api/practice/start/route.ts` body (`gameId`, `isKnownGame`, `practiceEvent`) and add at the top of the handler:

```ts
import { isAdmin } from '@/lib/auth/session';
import { notFound } from 'next/navigation';
```

Do not use `notFound()` in a route handler. Return 404 JSON if `!isAdmin(player)`:

```ts
if (!isAdmin(player)) {
  return NextResponse.json({ error: 'Not found.', code: 'NO_PAGE' }, { status: 404 });
}
```

Still require a finished official run (`PRACTICE_LOCKED`) so an admin cannot scout today through this path before they play. (Admin who needs to inspect a live family after playing can use this; before playing they use the official run.)

`app/api/admin/practice/score/route.ts` — copy the deleted `app/api/practice/score/route.ts` and add the same `isAdmin` 404.

`app/admin/practice/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { PracticeBoard } from '@/features/practice/PracticeBoard';
import { GAMES_BY_PILLAR } from '@/features/game-engine/registry';
import { PILLARS } from '@/features/game-engine/types';
import { isAdmin, requirePlayer } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin practice', robots: { index: false } };

export default async function AdminPracticePage() {
  const player = await requirePlayer();
  if (!isAdmin(player)) notFound();
  const families = PILLARS.flatMap((pillar) =>
    GAMES_BY_PILLAR[pillar].map((definition) => ({
      id: definition.id,
      name: definition.name,
      pillar: definition.pillar,
    })),
  );
  return <PracticeBoard families={families} reducedMotion={player.settings.reduceMotion} />;
}
```

In `docs/admin.md`, replace the bullet that says `/practice` runs a random seed with: `/admin/practice` runs the same family on a random seed. Players never see that catalog.

- [ ] **Step 4: Typecheck and unit tests**

Run: `npm run typecheck` then `npx vitest run tests/unit/practice.test.ts`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/practice app/admin/practice/page.tsx features/practice/PracticeBoard.tsx docs/admin.md
git commit -m "Move the fifteen-family practice catalog behind admin."
```

---

### Task 6: E2E and player-facing docs

**Files:**
- Modify: `tests/e2e/daily.spec.ts`
- Modify: `README.md` (the sentence about `/practice`)

**Interfaces:**
- Consumes: landing button `Play today's five again`, `data-testid="practice-compare"`, existing `playOneEvent`
- Produces: e2e coverage for lock, no catalog, compare, official score unchanged

- [ ] **Step 1: Extend the Playwright spec**

Replace the existing practice test and add a replay test:

```ts
test('practice is locked until the official run is done', async ({ page }) => {
  await asNewGuest(page);
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: /today first/i })).toBeVisible();

  await playWholeRun(page);
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: /^practice$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /play today's five again/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /dead stop/i })).toHaveCount(0);
});

test('a practice replay shows an unofficial compare and leaves the official score', async ({
  page,
}) => {
  await asNewGuest(page);
  await playWholeRun(page);

  const official = await page.getByRole('heading', { name: /you beat .* of humans today/i }).textContent();

  await page.goto('/practice');
  await page.getByRole('button', { name: /play today's five again/i }).click();

  for (let index = 0; index < 5; index += 1) {
    await playOneEvent(page);
    const interstitial = page.getByTestId('interstitial');
    await expect(interstitial).toBeVisible({ timeout: 15_000 });
    await interstitial.click();
  }

  const compare = page.getByTestId('practice-compare');
  await expect(compare).toBeVisible({ timeout: 15_000 });
  await expect(compare.getByText(/first score/i)).toBeVisible();
  await expect(compare.getByText(/this run/i)).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: /see your result/i }).click();
  await expect(page.getByRole('heading', { name: /you beat .* of humans today/i })).toHaveText(
    official ?? /you beat/i,
  );
});
```

If the official heading assertion is brittle (same text anyway), asserting the result heading is still visible is enough — the unit tests already pin that `totalScore` did not change.

In `README.md`, change the `/practice` sentence from "unlocks after the official run and never writes to a leaderboard" to: unlocks after the official run, replays today's five, and never writes to a leaderboard.

- [ ] **Step 2: Run the daily e2e file**

Run: `npx playwright test tests/e2e/daily.spec.ts`
Expected: PASS, including the two practice tests.

- [ ] **Step 3: Run the full unit suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/daily.spec.ts README.md
git commit -m "Cover today's practice replay in the daily e2e suite."
```

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Locked until official finished; no family leak on the lock screen | 2, 4, 6 |
| Replay today's exact five, same order/configs | 2, 4 |
| Unofficial interstitial points + end compare | 4, 6 |
| First score wins; nothing written | 2 |
| Signed token carries `points`; client score ignored | 1, 2 |
| CROWD current blend, no tally write | 2 |
| Voided events scaled via `totalScore` | 2 (`finishPracticeReplay`) |
| Remove `/api/practice/score` scout path | 3 |
| Admin random-seed catalog at `/admin/practice` | 5 |
| Refresh starts over (no localStorage) | 4 |
| Errors: 403 / 401 / 409 / 400 | 2, 4 |
| Unit + e2e tests listed in the spec | 2, 3, 6 |

## Self-review notes

- `submitPracticeEvent` must score `manifest.events[index].config` from the store, not the redacted client copy.
- The first non-crowd equality test walks from index 0 so `nextIndex` stays aligned.
- Official run tokens cannot be reused as practice tokens (`mode !== 'practice'`).
- No placeholders, no "similar to Task N" without the actual code.
