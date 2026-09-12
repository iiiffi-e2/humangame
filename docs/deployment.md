# Deployment

## What has to exist

| Thing | Required? | What happens without it |
| --- | --- | --- |
| `HUMAN_MANIFEST_SECRET` | **Yes** | Days are generated from a development secret that is in the repository |
| `HUMAN_RUN_SECRET` | **Yes** | Run tokens and guest cookies are signed with a public value |
| Supabase project | **Yes** | Data lives in a file on one instance's disk |
| Upstash Redis | Recommended | Rate limits are per-process, so they do not hold across instances |
| PostHog / Sentry | Optional | Analytics and error reporting are no-ops |

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

## Manifests

Manifests generate on demand, so a deployment cannot fail to have a day. But
generating them ahead of time is how you get to *look* at them before they go
live:

```bash
npm run manifest:generate -- --days 45
```

Run it daily from a scheduled job (Vercel Cron, GitHub Actions, whatever the
platform offers) so there is always a month of frozen days ahead. It is
idempotent — an existing day is left alone unless `--force` is passed — and
`--dry` prints what it would do.

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
- [ ] Migrations applied, and RLS confirmed on in the Supabase dashboard
- [ ] `HUMAN_ADMIN_USERNAMES` or `HUMAN_ADMIN_EMAILS` set — otherwise nobody
      can reach `/admin` in production
- [ ] A month of manifests generated and eyeballed in the console
- [ ] Redis configured if running more than one instance
- [ ] A scheduled job running `manifest:generate`
- [ ] `npm run verify` and `npm run test:e2e` green against the build
