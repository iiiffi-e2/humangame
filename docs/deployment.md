# Deployment

Operator walkthrough (accounts, keys, first deploy):
[`docs/go-live.md`](go-live.md).

## What has to exist

| Thing | Required? | What happens without it |
| --- | --- | --- |
| `HUMAN_MANIFEST_SECRET` | **Yes** | Days are generated from a development secret that is in the repository |
| `HUMAN_RUN_SECRET` | **Yes** | Run tokens and guest cookies are signed with a public value |
| Supabase project | **Yes** | Data lives in a file on one instance's disk |
| Upstash Redis | Recommended | Rate limits are per-process, so they do not hold across instances. Production warns; it does not refuse to start. Single-instance only without Redis. |
| Admin allowlist | **Yes** | Process refuses to start. In development both empty makes the local guest an admin. |
| PostHog / Sentry | Optional | Analytics and error reporting are no-ops |

`serverEnv()` is fail-closed in production: missing or in-repo secrets, missing Supabase, or empty admin lists throw `ProductionEnvError` rather than signing tokens with a public value. File-backed e2e and a local `next start` that sets `HUMAN_DEV_DB` are exempt. Set `HUMAN_ENFORCE_PROD=0` only if you must override that.

Generate the two secrets with `openssl rand -base64 48`. Store them in the
platform's secret manager, never in the repository.

`HUMAN_MANIFEST_SECRET` is the one to guard. It defines every future day; if it
leaks, tomorrow's five events are computable by anyone who has it, and every
subsequent day with it. Rotating it changes all future days (already-frozen
manifests keep the seed stored on their row, so past days are unaffected).

## Supabase

1. Create a project.
2. Apply the schema:
   ```bash
   supabase link --project-ref <ref>
   supabase db push          # applies supabase/migrations/*.sql
   ```
   Or paste `supabase/migrations/0001_init.sql` into the SQL editor.
3. Copy the project URL, the anon key and the service role key into the
   environment. The service role key is server-only — it must never be exposed
   to the browser, and it is only ever imported by `lib/db/supabase-store.ts`,
   which is behind `server-only`.
4. Enable the auth providers you want under Authentication → Providers. Email
   OTP works with no extra configuration; Google, Apple and passkeys need their
   own setup. `/profile/link` adapts to whatever is enabled.

The migration turns RLS on for every table and defines **read** policies only.
There are deliberately no insert or update policies for `anon` or
`authenticated`: all writes go through the server with the service role key,
which is what keeps a final score out of the client's hands.

`0002_players_privacy.sql` revokes `select *` on `players` from `anon` /
`authenticated` and grants only display columns (id, username, display_name,
country, first_day_number, created_at). Email and auth ids stay service-role.

## Manifests

Manifests generate on demand, so a deployment cannot fail to have a day. But
generating them ahead of time is how you get to *look* at them before they go
live:

```bash
npm run manifest:generate -- --days 45
```

Run it daily from the checked-in Vercel Cron (`/api/cron/daily`, see
`vercel.json`) or `npm run manifest:generate -- --days 45` so there is always
a month of frozen days ahead. The cron route also sends “you have not played”
emails for linked accounts that opted in. It is idempotent — an existing day
is left alone unless `--force` is passed — and `--dry` prints what it would do.
Set `CRON_SECRET` and send it as `Authorization: Bearer <secret>`.

A frozen manifest is what players get. The admin console refuses to edit one
except to void an event, which is the operation that has to work after a day
has started.

## Build and run

```bash
npm ci
npm run build
npm start
```

The app is entirely dynamic — every page reads the current player — so there
is nothing to pre-render and no ISR to configure. Node runtime is required for
the API routes (they use `node:crypto`); the proxy runs on the Edge runtime
and uses Web Crypto for the same token format.

### Headers and caching

`next.config.ts` sets `X-Content-Type-Options`, `Referrer-Policy` and
`X-Frame-Options`, and marks `/sw.js` as never cached so a service worker
update is picked up on the next visit. The service worker itself never caches
anything under `/api`, so a stale run is impossible.

## Checklist before a real launch

- [ ] Both secrets set, and different from the development defaults
- [ ] `NEXT_PUBLIC_SITE_URL` set to the real origin (share and OG links use it)
- [ ] Migrations applied (`0001_init` and `0002_players_privacy`), and RLS confirmed on in the Supabase dashboard. Confirm `anon` cannot `select email` from `players`.
- [ ] `HUMAN_ADMIN_USERNAMES` or `HUMAN_ADMIN_EMAILS` set — otherwise nobody
      can reach `/admin` in production
- [ ] A month of manifests generated and eyeballed in the console
- [ ] Redis configured if running more than one instance
- [ ] A scheduled job running `/api/cron/daily` (Vercel Cron in `vercel.json`) or `manifest:generate`
- [ ] PostHog and Sentry keys set before a public launch
- [ ] A month of manifests reviewed in `/admin` for repeats and broken events
- [ ] `npm run verify` and `npm run test:e2e` green against the build
