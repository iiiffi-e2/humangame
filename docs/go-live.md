# Go-live: what you do on your side

The app code is production-ready. This is the operator work: accounts,
secrets, the database, and a first deploy that will not start unless the
required values are real.

Assumed host: **Vercel** (Node runtime). Database and auth: **Supabase**.
Rate limits: **Upstash Redis**. Optional: PostHog, Sentry, Resend.

Do **not** set `HUMAN_DEV_DB` on the production project. That flag exempts
the fail-closed env guard and is only for local / Playwright.

---

## Map of services

```
Browser
  → Vercel (Next.js: pages, API, Edge proxy for guest cookie)
      → Supabase Postgres (service role, server-only writes)
      → Supabase Auth (email OTP / Google / Apple — browser, then /api/auth/link)
      → Upstash Redis (rate limits across instances)
      → PostHog (optional, browser analytics)
      → Sentry (optional, errors)
      → Resend (optional, “you have not played” email)
  Vercel Cron 00:15 UTC → GET /api/cron/daily
      → freeze 45 days of manifests in Postgres
      → send reminder emails if Resend is configured
```

Nothing else is required. No separate Redis for sessions, no CMS, no Stripe.

---

## 0. Accounts to create

| Service | Required? | What it is |
| --- | --- | --- |
| [Vercel](https://vercel.com) | Yes | Host, env vars, Cron |
| [Supabase](https://supabase.com) | Yes | Postgres + Auth |
| [Upstash](https://upstash.com) | Strongly recommended | Redis REST for rate limits |
| Domain registrar / DNS | Yes if not using `*.vercel.app` | Custom origin for share/OG |
| [Resend](https://resend.com) | Only if you want reminder email | SMTP-like API |
| [PostHog](https://posthog.com) | Optional | Product analytics |
| [Sentry](https://sentry.io) | Optional | Error reporting |
| Google Cloud console | Only if Google sign-in | OAuth client |
| Apple Developer | Only if Apple sign-in | Sign in with Apple |

PostHog and Sentry: no signup needed for the app to run. Skip until a public launch.

---

## 1. Generate the two HUMAN secrets

On your machine (Git Bash, WSL, or macOS/Linux):

```bash
openssl rand -base64 48
openssl rand -base64 48
openssl rand -base64 48
```

Save three values:

| Name | Use |
| --- | --- |
| `HUMAN_RUN_SECRET` | Guest cookie + run tokens. Rotating it logs everyone out. |
| `HUMAN_MANIFEST_SECRET` | Seeds every future day. **Guard this.** Leak = anyone can compute tomorrow’s five. Rotating it changes all *future* days; already-frozen rows keep their stored seed. |
| `CRON_SECRET` | Vercel Cron sends `Authorization: Bearer <this>` to `/api/cron/daily`. |

Never commit them. Never reuse the in-repo defaults
`human-dev-run-secret-do-not-use-in-production` /
`human-dev-manifest-secret-do-not-use-in-production`. Production **refuses to
start** if you do.

---

## 2. Supabase (database + auth)

### 2a. Project

1. Create a project (region close to Vercel).
2. **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

The service role key **must never** go in a `NEXT_PUBLIC_*` variable. Only the
server store (`lib/db/supabase-store.ts`) uses it. The anon key is public by
design (RLS).

### 2b. Schema

Apply **all three** migrations, in order:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_players_privacy.sql
supabase/migrations/0003_social_ops.sql
```

From a machine with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste each file into the SQL editor, 0001 then 0002 then 0003.

What they do:

- **0001** — players, manifests, runs, events, crews, rivalries, challenges, crowd, stats, reports. RLS on; no client writes.
- **0002** — anon/authenticated can `select` only display columns on `players` (no email, no auth ids).
- **0003** — `player_blocks`, `notifications`, `hidden_from_boards` on players and crews.

### 2c. Confirm RLS (5 minutes)

In the SQL editor, as a sanity check (this uses the dashboard role, not anon):

1. Table Editor → `players` → confirm columns include `email`, `hidden_from_boards`.
2. Authentication is not enough: in **SQL**, you cannot easily become `anon`. Instead, in a throwaway script or the API docs, call REST with the **anon** key:

   `GET /rest/v1/players?select=email`

   Expect a permission error or empty columns — **not** a list of emails.

3. Confirm `runs` has no insert policy for anon (Table Editor → RLS).

### 2d. Auth providers

**Authentication → URL configuration**

- Site URL: `https://your-domain.com`
- Redirect allow list: `https://your-domain.com/profile/link` and `https://your-domain.com/**`

**Email (default, no extra signup)**

- Authentication → Providers → Email: enabled.
- Confirm email / OTP. `/profile/link` sends a six-digit code via Supabase.

If emails do not arrive: Authentication → SMTP, or use Supabase’s built-in email (rate-limited on free tier). For production volume, point Supabase SMTP at Resend.

**Google (optional)**

1. Google Cloud Console → OAuth client (Web).
2. Authorized redirect: the callback URL Supabase shows
   (`https://<project>.supabase.co/auth/v1/callback`).
3. Paste Client ID + Secret into Supabase → Providers → Google.

**Apple (optional)**

1. Apple Developer → Services ID + key.
2. Same pattern: callback is Supabase’s, not yours.
3. Enable in Supabase → Providers → Apple.

The HUMAN UI already has “Continue with Google / Apple”. If a provider is
disabled in Supabase, the button will error when clicked. Email OTP still works.

Do **not** seed the production database with `npm run seed`. That is a local
demo world.

---

## 3. Upstash Redis (rate limits)

1. Create a Redis database (global or same region).
2. Copy **REST URL** and **REST TOKEN**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Without this, limits are an in-process `Map`. Fine for one Vercel instance
during a friends-and-family test; not fine once you have more than one
serverless instance. Production **warns** and still starts.

---

## 4. Vercel project

1. Import the GitHub repo. Framework: Next.js. **Node** (not Edge) for the
   default function runtime — API routes already declare `nodejs`.
2. Root directory: repo root. Build: `npm run build`. Output: Next default.
3. Add a production domain. Set `NEXT_PUBLIC_SITE_URL` to that exact origin
   (`https://play.example.com`, no trailing slash). Share cards, challenge
   links, OG images, and CSRF origin checks use this.
4. **Do not** set `HUMAN_DEV_DB` or `HUMAN_ENFORCE_PROD=0` on Production.

Cron is already in `vercel.json`:

```json
{ "path": "/api/cron/daily", "schedule": "15 0 * * *" }
```

That is **00:15 UTC** every day (the day boundary is UTC). Hobby Vercel Cron
may only run daily — this job is daily, so that is fine. Vercel automatically
sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set.

After the first Production deploy, open the Vercel Cron logs and confirm
`GET /api/cron/daily` returns `{ ok: true, ... }`. If you get 401, the secret
is missing or does not match.

---

## 5. Environment variables (paste into Vercel → Settings → Environment Variables)

Mark Production (and Preview only if you want a staging Supabase).

`NEXT_PUBLIC_*` values are baked in at **build** time. After changing them,
redeploy.

### Required — process will not start without these

| Variable | Where it comes from | Public? |
| --- | --- | --- |
| `HUMAN_RUN_SECRET` | `openssl rand -base64 48` | **No** |
| `HUMAN_MANIFEST_SECRET` | `openssl rand -base64 48` | **No** |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role | **No** |
| `HUMAN_ADMIN_EMAILS` and/or `HUMAN_ADMIN_USERNAMES` | You. Comma-separated, lowercase. Example: `you@example.com` or `yourhandle` | **No** |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` | Yes |

Admin: the list is checked against the **linked email** or **claimed
username**. A guest with no handle and no linked email will not match
`HUMAN_ADMIN_EMAILS`. First time in: play or open any page (guest cookie),
go to Settings → Link account, use the email you put on the allowlist, then
open `/admin`. Or claim the username you put on `HUMAN_ADMIN_USERNAMES`.

### Required for a real multi-instance host

| Variable | Source |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token |
| `CRON_SECRET` | Third `openssl` value. Vercel Cron uses this automatically. |

### Optional — reminder email

| Variable | Source |
| --- | --- |
| `RESEND_API_KEY` | Resend → API Keys |
| `EMAIL_FROM` | Verified sender, e.g. `HUMAN <hello@your-domain.com>` |

Without both, daily reminders are skipped (`sent: 0`). In-app inbox still works.

### Optional — analytics / errors (public launch)

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | Default `https://us.i.posthog.com` (or `https://eu.i.posthog.com`) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry → Project → DSN |
| `SENTRY_AUTH_TOKEN` | Only if you want source maps uploaded at build |

### Never set in production

| Variable | Why |
| --- | --- |
| `HUMAN_DEV_DB` | Turns off the production guard; uses a file store |
| `HUMAN_ENFORCE_PROD=0` | Same |
| `SUPABASE_SERVICE_ROLE_KEY` as `NEXT_PUBLIC_*` | Leaks the database |

---

## 6. First deploy

1. Push the branch Vercel tracks. Wait for a green Production build.
2. If the build succeeds but the site 500s on first request, the env guard
   fired: check the function logs for `ProductionEnvError` (missing secret,
   Supabase, or admin list).
3. Open `https://your-domain.com`. You should get a guest cookie and the home
   screen with no signup.
4. Play a run end to end. Confirm `/result/...` and that a second visit to
   `/play` is refused.
5. Settings → claim a handle (if you used `HUMAN_ADMIN_USERNAMES`) or Link
   account with the allowlisted email.
6. Open `/admin`. You should see today + the next 30 days.
7. Open `/admin/reports` (empty is fine). `/admin/practice` is the family catalog.
8. Hit cron once yourself if the 00:15 UTC job has not run:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/daily
   ```

   Expect `created` / `skipped` totaling 45 days.
9. In `/admin`, click through the next ~30 days. Look for broken or
   repetitive CROWD/ORDER. Void or replace **before** a day is live. After
   freeze + players, you can only void.

---

## 7. Auth and email smoke tests

- Settings → Link → email OTP: code arrives, “Account linked.”
- If Google/Apple enabled: OAuth returns to `/profile/link` and the same
  guest row is attached (streak/runs survive). If a second player row appears,
  stop — that is a misconfigured link; the server is supposed to attach
  `auth_user_id` to the existing guest.
- Share a result; the OG image at `/api/og/<token>` should load (rate-limited
  per IP).
- `/privacy` and `/terms` load; footer/settings link to them.

---

## 8. What each service is connected to (file map)

| Concern | Code |
| --- | --- |
| Env + fail-closed guard | `lib/env.ts` |
| Guest cookie | `proxy.ts` |
| Postgres / file store switch | `lib/db/factory.ts` |
| All writes | `lib/db/supabase-store.ts` (service role) |
| Rate limits | `lib/anti-cheat/rate-limit.ts` |
| Daily cron | `app/api/cron/daily/route.ts`, `vercel.json` |
| Account link | `app/api/auth/link/route.ts`, `features/profile/LinkAccount.tsx` |
| Admin gate | `lib/auth/session.ts` `isAdmin()` |
| PostHog | `lib/analytics/index.ts`, `components/AppChrome.tsx` |
| Sentry | `instrumentation.ts`, `lib/observability.ts` |
| Reminder email | `lib/notify/email.ts`, `lib/notify/reminders.ts` |

---

## 9. Ongoing (after go-live)

- Cron keeps ~45 frozen days ahead. You only intervene when `/admin` shows a
  bad upcoming event.
- Reports: `/admin/reports` → Dismiss or Hide from boards (not a ban).
- Broken live event: void it in `/admin`. Do not edit a frozen day’s config.
- Rotate `HUMAN_RUN_SECRET` only between days. Never rotate
  `HUMAN_MANIFEST_SECRET` unless you intend to change all future days.

---

## 10. Launch checklist

- [ ] `HUMAN_RUN_SECRET` and `HUMAN_MANIFEST_SECRET` set, not the dev defaults
- [ ] `NEXT_PUBLIC_SITE_URL` is the real `https://` origin
- [ ] `HUMAN_DEV_DB` unset on Production
- [ ] Supabase project live; `0001` + `0002` + `0003` applied
- [ ] Anon cannot `select email` from `players`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-only
- [ ] Email auth enabled; redirect URLs include `/profile/link`
- [ ] Google/Apple configured in Supabase **or** left disabled
- [ ] `HUMAN_ADMIN_EMAILS` or `HUMAN_ADMIN_USERNAMES` set; you can open `/admin`
- [ ] Upstash Redis set if more than a toy deploy
- [ ] `CRON_SECRET` set; `/api/cron/daily` returns 200 with auth
- [ ] ~30 days eyeballed in `/admin`
- [ ] Guest play + one-run rule + share OG work on the real domain
- [ ] Optional: Resend + `EMAIL_FROM` for reminders
- [ ] Optional: PostHog + Sentry before a public URL
- [ ] `npm run verify` green locally before you tagged the deploy
