# Today's practice replay

After the official run, `/practice` is a second pass at **today's exact five
events**. It shows an unofficial total so the player can see what they could
have gotten. Only the first official score counts. Families that are not in
today never appear.

## Why

The current practice board lists all fifteen families on random seeds. That
lets a player scout games that are not in the day — and therefore what
future days might serve. The official rule is already one ranked run; people
still want to play again. Those two facts meet here: replay today, hide
tomorrow.

## Player flow

`/practice` stays the entry point (results, history, and any other existing
link). Until today's official run is `finished`, the page is unchanged:
"Today first." and a link to `/play`. Nobody warms up on the day that
counts, and the locked state still reveals nothing about today's families.

After they finish:

1. The catalog of fifteen families is gone.
2. One action: play today's five again. Copy states that this run does not
   count.
3. They play the same five events, in the same order, with the same stored
   configs as the official run (same hold target, same sequence, same CROWD
   question).
4. Each event shows unofficial points on the interstitial.
5. The end screen shows two numbers: **first score** (the one that counts)
   and **this run** (the unofficial total). No percentile, no streak, no
   share card for the replay.
6. They can start another replay immediately. Refresh mid-replay starts
   over.

## Server contract

Practice is not a run. There is no practice row, no `tokenJti` on a run
record, nothing written to stats, leaderboards, rivalries, streaks, or
crowd tallies.

### Token

`POST /api/practice/start` (no `gameId`) requires a finished official run
for today's manifest. It issues a short-lived practice token signed like
the official run token:

- `playerId`, `manifestId`, `mode: 'practice'`
- `nextIndex` (0 at start, 5 when all five are scored)
- `points` — unofficial integer points accepted so far (empty at start)
- `jti`, `iat`, `exp` (same TTL as official run tokens)
- no `runId`

`points` lives on the token so finish can total without a stored session
and without reading a score from the client. The signature is what makes
those integers trustworthy.

The response is the token plus today's five events, redacted the same way
`/play` redacts them. Starting again issues a new token. Unused tokens
stay valid until `exp`; there is no revocation list. Two tabs can replay
at once because neither writes anything. A refresh drops the in-memory
token and starts over, which is acceptable for a ~75 second replay.

Order is enforced by the token: each accepted submit returns a rotated
token with `nextIndex + 1` and the new points appended. Finish is allowed
only when `nextIndex === 5` and `points.length === 5`.

### Submit

`POST /api/practice/event` accepts `{ token, index, durationMs, result }`.
The server:

1. Verifies the token (`mode === 'practice'`, not expired, player matches).
2. Confirms the official run is still finished (so a token minted after
   finish cannot outlive a voided-day edge case where we still want the
   lock).
3. Requires `index === token.nextIndex` and `index` in `0..4`.
4. Scores against `manifest.events[index]` — the stored config, never a
   client-supplied seed or `gameId`.
5. Applies the same result validation and timing window as official.
6. Does **not** persist the event, increment crowd tallies, or write trust
   flags.

Response: unofficial `ScoreResult`, `nextIndex`, and a rotated token.

The existing `POST /api/practice/score` path that accepts `{ gameId, seed,
difficulty, result }` is removed. That endpoint is how a client would
scout a family that is not in today.

### Finish

`POST /api/practice/finish` accepts the token at `nextIndex === 5` and
returns:

- `thisRun`: unofficial total, using `totalScore` so voided events are
  dropped and the remainder scaled to 10,000
- `firstScore`: the player's official `totalScore` for today
- per-event unofficial points (for the compare screen, if shown)

Nothing is written.

CROWD is scored against the **current** blend (prior + official
responses). A practice pick does not enter the tally. "What I could have
gotten" means *if I submitted this pick now*, not a reconstruction of the
blend at the moment of the official run.

## What must never leak

- Families not in today's manifest: not on `/practice`, not startable, not
  scoreable.
- Future manifests: practice always uses `ensureManifest(today)`.
- Answer keys: same `redactConfig` as official.
- Official tables: no practice writes.

## Admin

`/practice` is no longer the way an admin tries an arbitrary family.
Admin-only path: `/admin/practice`, gated like the rest of `/admin`. Same
random-seed, single-family loop the old public board had. Players never
see it. Update `docs/admin.md` accordingly.

## UI reuse

`/practice` after unlock renders a thin wrapper around the existing
`RunShell` / `EventShell` loop, in a `mode: 'practice'` that:

- calls the practice endpoints instead of `/api/run/*`
- does not persist progress to `localStorage` (refresh starts over)
- ends on a compare screen instead of `FinalReveal`
- never routes to share or leaderboards from that screen

The locked page stays a server-rendered gate, same as today.

## Errors

| Case | Response |
| --- | --- |
| Official not finished | 403 `PRACTICE_LOCKED` |
| Bad / expired / other-player token | 401 `BAD_TOKEN` |
| Wrong `index` | 409 `OUT_OF_ORDER` |
| Impossible result or duration | 400 `BAD_EVENT` |
| Unknown / not-today `gameId` | cannot happen; `gameId` is not accepted |

The UI treats 401 as "start over" and 403 as the locked page.

Rate limits stay in the same family as today's practice routes.

## Tests

Unit:

- Start is refused until the official run is finished.
- Start returns exactly today's five `gameId`s, in order, redacted.
- Submit scores against the stored config (same points as official would
  for the same result).
- Submit does not change crowd tallies, official run, stats, or
  percentile.
- Finish returns `firstScore` equal to the official total and `thisRun`
  from the five unofficial event points on the token, not from the client.
- The removed seed-based score route is gone (or 404).

E2E (extend `tests/e2e/daily.spec.ts`):

- Practice locked until official is done.
- After official, `/practice` shows the replay, not a fifteen-family list.
- Completing a replay shows first score and this run.
- The official result page still shows the first score.

## Out of scope

- Persisting practice runs or a replay history.
- Practicing families that are not in today (except admin).
- Replacing or averaging the official score.
- Reconstructing CROWD at the exact official-submit instant.
- Mid-replay resume across refresh.
