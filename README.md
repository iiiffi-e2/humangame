# HUMAN

A 75-second daily competition. Every player on Earth gets the same five
microgames each day — NERVE, EYE, MEMORY, BRAIN, CROWD — and exactly one
official ranked run. Each event is worth 2,000 points, so a day is scored out
of 10,000, and the number that matters is the one underneath it:

> **YOU BEAT 94% OF HUMANS TODAY.**

HUMAN is a game. It is not an IQ test, a cognitive assessment, or a measure of
anything about your health, and nothing in the product is allowed to imply
otherwise.

---

## Running it

```bash
npm install
npm run seed      # 100 players, 30 days of history, a rivalry and a crew
npm run dev       # http://localhost:3000
```

That is the whole setup. With no `.env` at all the app runs on a local
file-backed store, generates today's manifest from a development secret, and
every screen works — including leaderboards, history and crews, because the
seed fills them. See `.env.example` for what to add as you connect Supabase,
Redis, PostHog or Sentry.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run seed` | Rebuild the demo world (idempotent; skips what exists) |
| `npm run db:reset` | Delete the local development store |
| `npm run manifest:generate -- --days 45` | Generate and freeze future days |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run verify` | Typecheck, lint and unit tests |

The seed prints a ready-made challenge link — `/c/demo01` — which is the
fastest way to see the recipient side of the share loop.

### Playing locally

The first page view mints a guest identity, so you can play immediately with
no account. One official run per day is enforced; to play again while
developing, run `npm run db:reset && npm run seed`, or use `/practice`, which
unlocks after the official run and never writes to a leaderboard.

---

## What is where

```
app/                    routes, pages and API handlers
components/             shared UI vocabulary
features/
  game-engine/          run lifecycle, event shell, family registry
  games/<pillar>/       the fifteen families: logic (.ts) and field (.tsx)
  results/              percentile, stats, the final reveal
  leaderboards/ challenges/ rivalries/ crews/ history/ profile/ admin/
lib/
  rng/                  deterministic seeded randomness
  scoring/              the five scoring curves, plus the CROWD blend
  daily/                reset boundary, manifest generation
  db/                   DataStore interface, Supabase and file-backed stores
  auth/ anti-cheat/ analytics/
supabase/migrations/    schema, indexes and row-level security
scripts/                seed, manifest generation, reset
tests/unit/ tests/e2e/
docs/                   architecture, scoring, content, deployment, admin
```

Further reading:

- [`docs/architecture.md`](docs/architecture.md) — how a run flows through the
  system, and why the data layer has two implementations.
- [`docs/scoring.md`](docs/scoring.md) — every curve, with the maths and the
  reasoning, including the Bayesian CROWD blend.
- [`docs/content-authoring.md`](docs/content-authoring.md) — writing CROWD
  questions and ORDER sets, and setting priors.
- [`docs/deployment.md`](docs/deployment.md) — Supabase, secrets, scheduled
  manifest generation.
- [`docs/admin.md`](docs/admin.md) — the daily console, and what to do when an
  event is broken.

---

## The three rules the code is built around

**1. The day is deterministic.** Every config comes from
`HMAC(manifest secret, date)` through a seeded PRNG. The same secret and the
same date always produce the same five events, so a manifest can be
regenerated from scratch and a run can be re-scored years later.

**2. The client never sends a score.** It sends what the player did. The
server re-runs the same pure scoring function against the config stored in the
manifest. A payload claiming `points: 2000` is simply not read.

**3. One official run per player per day.** Enforced by a partial unique index
in Postgres, not by application logic. A run that is interrupted resumes; a
run that is finished cannot be replayed, because the run token's single-use id
is rotated on every reissue.

---

## Testing

Unit tests cover the parts where a bug is invisible until it has already
scored someone wrong: the scoring curves, seeded generation, manifest
determinism, streaks, rivalry records, percentiles and the CROWD prior blend.
The run lifecycle is tested end to end against the file-backed store,
including replay protection and one-run-per-day.

The Playwright suite drives the real UI: a guest completing a daily, the
refusal of a second run, mid-run recovery, the challenge compare flow,
username claim, crew create/join, reduced motion, and a phone viewport with no
horizontal overflow.

```bash
npm test
npm run test:e2e
```

If your environment ships a pre-installed Chromium that does not match this
Playwright version, point at it rather than downloading another:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```
