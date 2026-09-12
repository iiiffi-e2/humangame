# Architecture

## The shape of a day

```
  midnight UTC                                       next midnight UTC
       │                                                      │
       ├─ manifest for the date is generated and frozen ──────┤
       │      HMAC(secret, date) → seed → five event configs
       │
       ├─ a player opens the app
       │      proxy mints a signed guest id (no account)
       │      POST /api/run/start  → run row + signed run token
       │
       ├─ five events, one at a time
       │      POST /api/run/event  → server re-scores from the stored config
       │
       ├─ POST /api/run/finish
       │      total → percentile → trust → streak, in one step
       │
       └─ share, challenge, leaderboards, rivalry, crew
```

## Determinism

`lib/rng` is a seeded sfc32 generator with a cyrb128 string hash. Nothing that
produces a game config is allowed to call `Math.random`. `lib/daily/manifest`
derives the day's seed as `HMAC-SHA256(HUMAN_MANIFEST_SECRET, "human:v1:" +
date)` and then derives a per-event seed from it.

Two consequences worth stating plainly:

- A manifest is recoverable. Lose the database and
  `npm run manifest:generate -- --from <date>` reproduces every day byte for
  byte.
- A run is re-scorable. The result the player submitted is stored alongside
  the points, so a scoring bug can be diagnosed — and, if a curve is corrected,
  a day can be re-scored from the same inputs.

Knowing one day's seed tells you nothing about the next, because the HMAC has
the secret in it.

## The game engine contract

Every family implements `GameDefinition` (`features/game-engine/types.ts`):

```ts
createConfig(seed, difficulty) → TConfig      // deterministic
validateConfig(config)                        // run before a day is frozen
redactConfig?(config) → TConfig               // strip answers before sending
validateResult(config, unknown) → TResult     // reject impossible payloads
score(config, result, context?) → ScoreResult // pure, server-authoritative
timingWindow(config) → [minMs, maxMs]         // plausibility band
```

Logic lives in `.ts` files with no React import, so the server can score
without pulling in a component; the play fields live beside them in `.tsx`
files and are loaded on demand, one chunk per family. The shell
(`EventShell`) owns the category, progress, instruction and footer; a family
owns nothing but its field. That split is what makes fifteen games cost
roughly the same as one.

`redactConfig` matters more than it looks: BRAIN/ORDER's solution and the
answer ids for NEXT and ROTATE never leave the server, because the field does
not need them to draw itself.

## The data layer

`lib/db/types.ts` declares one `DataStore` interface. Two implementations
satisfy it:

- **`SupabaseStore`** — Postgres through Supabase, using the service role key.
  It is server-only and bypasses RLS deliberately: the policies in
  `supabase/migrations` exist to constrain the *browser* client, while
  finalising a run has to write rows the player themselves may not.
- **`MemoryStore`** — the whole dataset in memory, persisted to one JSON file.
  All writes are serialised through a single promise chain, which is enough
  for one Node process and keeps the one-run-per-day invariant honest without
  a transaction manager.

The file-backed store is not a toy. It is what makes a clean checkout run the
entire product, what the E2E suite runs against, and what the unit tests use
to exercise the run lifecycle. It is selected automatically when Supabase
environment variables are absent.

`lib/db/factory.ts` holds the selection logic and is free of `server-only` so
scripts and tests can use exactly the same store the app uses; `lib/db`
re-exports it with the server-only guard for application code.

## Identity

A visitor is a player before they are a user. `proxy.ts` (Next's middleware
layer) issues a signed, opaque guest id on the first request and forwards it
on a request header so the very first server render already has it. The
player row is created lazily on first use.

Account linking attaches a Supabase auth user to the *existing* player row, so
a guest who signs up keeps every run, streak and rivalry. With no provider
configured, `/profile/link` takes a documented dev-mode path that is refused
in production.

## Anti-cheat

In order of how much work they actually do:

1. **Server-side scoring.** The only defence that matters.
2. **Single-use run tokens.** The token carries a `jti` written onto the run;
   reissuing a token rotates it, which kills the previous one.
3. **Answer redaction** for families that do not need their key client-side.
4. **Timing plausibility.** Each family declares a window; a submission
   outside it is an issue.
5. **Rate limits**, per player and per IP, Redis-backed when available.
6. **Trust flags.** A run with impossible events is `excluded`; a doubtful one
   is `suspect`. Both still count for the player — they see their score and
   keep their streak — but neither appears on a public board or in anyone
   else's percentile denominator.

Near-perfection on its own is recorded as a reason but does **not** downgrade
trust. Elite players exist, and a rule that quietly deletes the best runs of
the day would make the leaderboard wrong in the one place people look hardest.

No fingerprinting, no canvas probes, no device identification.

## Percentile

`YOU BEAT X%` is the share of today's ranked runs the score is strictly above,
plus half the ties. Splitting ties keeps the statement symmetric: if everyone
scored the same, everyone beat 50%.

The denominator includes the player's own run and excludes untrusted ones.
Below 500 finishers the number is labelled provisional in the UI — the score
is final from the moment the run ends, the percentile keeps settling.

## Performance

- No game engine. Fields are DOM and a little SVG; the only per-frame work is
  a `requestAnimationFrame` loop in the three NERVE families.
- One chunk per family, loaded when the event starts, so a run downloads five
  of fifteen.
- Server components everywhere except where interaction requires otherwise;
  the home page ships almost no JavaScript beyond the analytics shim.
- Fonts come from the CDN with a real fallback stack, and the headline
  numerals measure themselves and shrink to fit (`components/FitText.tsx`), so
  a slow or blocked font changes how the page looks but never whether it
  works — and never causes a horizontal overflow.

## Accessibility

Keyboard play throughout: space or enter is a press for the hold families,
arrow keys adjust the EYE estimates, every option is a real button. Minimum
44px targets. No status is carried by colour alone — the rivalry calendar,
the leaderboard movement column and the pillar bars all carry text or a label.
`prefers-reduced-motion` and the in-app preference collapse every animation,
and the settled state is the same markup as the animated one, so nothing is
hidden behind an animation that might not run. Instructions render before any
timed interaction begins, and the families that are time-sensitive gate
themselves behind a READY press.
