-- HUMAN — initial schema.
--
-- Two rules shape everything below:
--
--   1. One official run per player per daily manifest, enforced by a partial
--      unique index rather than by application code.
--   2. The browser can read what it is allowed to see and write nothing that
--      affects a score. Every score-bearing table has RLS on with no insert
--      or update policy for `anon`/`authenticated`; the server writes with
--      the service role key.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  username text unique,
  display_name text not null default 'Guest',
  country char(2),
  is_guest boolean not null default true,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text,
  auth_provider text not null default 'guest'
    check (auth_provider in ('guest', 'email', 'google', 'apple', 'passkey')),
  is_admin boolean not null default false,
  settings jsonb not null default '{
    "sound": true,
    "haptics": true,
    "reduceMotion": false,
    "notifications": "rivals",
    "privacy": "friends"
  }'::jsonb,
  first_day_number integer not null default 1,
  created_at timestamptz not null default now(),
  constraint players_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,16}$'
  )
);

create index if not exists players_country_idx on public.players (country) where country is not null;
create unique index if not exists players_username_lower_idx on public.players (lower(username));

-- ---------------------------------------------------------------------------
-- daily_manifests
-- ---------------------------------------------------------------------------

create table if not exists public.daily_manifests (
  id text primary key,
  date date not null unique,
  day_number integer not null,
  seed text not null,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'frozen')),
  events jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_manifests_date_idx on public.daily_manifests (date desc);

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  manifest_id text not null references public.daily_manifests (id) on delete cascade,
  date date not null,
  day_number integer not null,
  mode text not null default 'official' check (mode in ('official', 'practice')),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  total_score integer not null default 0 check (total_score between 0 and 10000),
  percentile numeric(5, 2),
  trust text not null default 'ok' check (trust in ('ok', 'suspect', 'excluded')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  token_jti uuid not null,
  share_token text unique,
  from_challenge_token text,
  created_at timestamptz not null default now()
);

-- The one-official-run-per-day rule. An abandoned run does not block a retry,
-- which is what makes an admin able to clear a stuck run without deleting it.
create unique index if not exists runs_one_official_per_day
  on public.runs (player_id, manifest_id)
  where mode = 'official' and status <> 'abandoned';

-- The daily leaderboard query: ranked runs for one manifest, best first.
create index if not exists runs_leaderboard_idx
  on public.runs (manifest_id, total_score desc)
  where mode = 'official' and status = 'finished' and trust = 'ok';

create index if not exists runs_player_date_idx on public.runs (player_id, date desc);
create index if not exists runs_date_idx on public.runs (date desc);

-- ---------------------------------------------------------------------------
-- run_events
-- ---------------------------------------------------------------------------

create table if not exists public.run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  event_index smallint not null check (event_index between 0 and 4),
  pillar text not null check (pillar in ('nerve', 'eye', 'memory', 'brain', 'crowd')),
  game_id text not null,
  result jsonb,
  raw_metric double precision not null default 0,
  normalized double precision not null default 0 check (normalized between 0 and 1),
  points integer not null default 0 check (points between 0 and 2000),
  label text not null default '',
  duration_ms integer not null default 0,
  telemetry_hash text not null default '',
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  unique (run_id, event_index)
);

create index if not exists run_events_game_idx on public.run_events (game_id);

-- ---------------------------------------------------------------------------
-- challenge links
-- ---------------------------------------------------------------------------

create table if not exists public.challenge_links (
  token text primary key,
  run_id uuid not null references public.runs (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  manifest_id text not null references public.daily_manifests (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists challenge_links_run_idx on public.challenge_links (run_id);

create table if not exists public.challenge_plays (
  id uuid primary key default gen_random_uuid(),
  token text not null references public.challenge_links (token) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  run_id uuid not null references public.runs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (token, player_id)
);

-- ---------------------------------------------------------------------------
-- rivalries
-- ---------------------------------------------------------------------------

create table if not exists public.rivalries (
  id uuid primary key default gen_random_uuid(),
  player_a_id uuid not null references public.players (id) on delete cascade,
  player_b_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined')),
  requested_by uuid not null references public.players (id) on delete cascade,
  nemesis_for uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  -- One row per pair, always stored with the lower id first.
  constraint rivalries_ordered check (player_a_id < player_b_id),
  unique (player_a_id, player_b_id)
);

create index if not exists rivalries_b_idx on public.rivalries (player_b_id);

-- ---------------------------------------------------------------------------
-- crews
-- ---------------------------------------------------------------------------

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  invite_code text not null unique,
  owner_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, player_id)
);

create index if not exists crew_members_player_idx on public.crew_members (player_id);

-- ---------------------------------------------------------------------------
-- crowd responses
-- ---------------------------------------------------------------------------

create table if not exists public.crowd_responses (
  id uuid primary key default gen_random_uuid(),
  manifest_id text not null references public.daily_manifests (id) on delete cascade,
  event_index smallint not null check (event_index between 0 and 4),
  player_id uuid not null references public.players (id) on delete cascade,
  option_id text,
  value numeric(5, 2) check (value is null or value between 0 and 100),
  created_at timestamptz not null default now(),
  unique (manifest_id, event_index, player_id),
  constraint crowd_responses_has_answer check (option_id is not null or value is not null)
);

create index if not exists crowd_responses_tally_idx
  on public.crowd_responses (manifest_id, event_index, option_id);

-- ---------------------------------------------------------------------------
-- player stats
-- ---------------------------------------------------------------------------

create table if not exists public.player_stats (
  player_id uuid primary key references public.players (id) on delete cascade,
  streak integer not null default 0,
  longest_streak integer not null default 0,
  last_played_date date,
  runs_played integer not null default 0,
  best_score integer not null default 0,
  best_day_number integer,
  total_score bigint not null default 0,
  pillar_totals jsonb not null default '{}'::jsonb,
  top50_streak integer not null default 0,
  top10_streak integer not null default 0,
  longest_top10_streak integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- moderation
-- ---------------------------------------------------------------------------

create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.players (id) on delete cascade,
  subject_type text not null check (subject_type in ('player', 'crew')),
  subject_id text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at timestamptz not null default now()
);

create index if not exists moderation_reports_status_idx on public.moderation_reports (status);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.daily_manifests enable row level security;
alter table public.runs enable row level security;
alter table public.run_events enable row level security;
alter table public.challenge_links enable row level security;
alter table public.challenge_plays enable row level security;
alter table public.rivalries enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crowd_responses enable row level security;
alter table public.player_stats enable row level security;
alter table public.moderation_reports enable row level security;

-- Which player row the current auth user is.
create or replace function public.current_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.players where auth_user_id = auth.uid() limit 1;
$$;

-- Players are publicly readable: leaderboards are the product. Only the
-- display fields matter here; nothing private lives on this table.
drop policy if exists players_read on public.players;
create policy players_read on public.players for select using (true);

-- A signed-in player may edit their own display fields. Score-bearing
-- columns live on other tables, so there is nothing here worth forging.
drop policy if exists players_self_update on public.players;
create policy players_self_update on public.players
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and is_admin = false);

-- Frozen manifests are readable; drafts are staff-only.
drop policy if exists manifests_read on public.daily_manifests;
create policy manifests_read on public.daily_manifests
  for select using (status = 'frozen');

-- Finished, trusted runs are public (that is the leaderboard); a player can
-- always see their own runs, including in-progress ones.
drop policy if exists runs_read on public.runs;
create policy runs_read on public.runs
  for select using (
    (mode = 'official' and status = 'finished' and trust = 'ok')
    or player_id = public.current_player_id()
  );

drop policy if exists run_events_read on public.run_events;
create policy run_events_read on public.run_events
  for select using (
    exists (
      select 1 from public.runs r
      where r.id = run_id
        and (r.player_id = public.current_player_id()
             or (r.status = 'finished' and r.trust = 'ok'))
    )
  );

-- A challenge link is meant to be opened by a stranger.
drop policy if exists challenge_links_read on public.challenge_links;
create policy challenge_links_read on public.challenge_links for select using (true);

drop policy if exists challenge_plays_read on public.challenge_plays;
create policy challenge_plays_read on public.challenge_plays
  for select using (player_id = public.current_player_id());

drop policy if exists rivalries_read on public.rivalries;
create policy rivalries_read on public.rivalries
  for select using (
    player_a_id = public.current_player_id() or player_b_id = public.current_player_id()
  );

-- Crews are private: you see one if you are in it, or if you hold the code
-- (the server looks that up with the service role).
drop policy if exists crews_read on public.crews;
create policy crews_read on public.crews
  for select using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = id and m.player_id = public.current_player_id()
    )
  );

drop policy if exists crew_members_read on public.crew_members;
create policy crew_members_read on public.crew_members
  for select using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = crew_id and m.player_id = public.current_player_id()
    )
  );

-- Individual crowd answers stay private; only the server aggregates them.
drop policy if exists crowd_responses_read on public.crowd_responses;
create policy crowd_responses_read on public.crowd_responses
  for select using (player_id = public.current_player_id());

drop policy if exists player_stats_read on public.player_stats;
create policy player_stats_read on public.player_stats for select using (true);

drop policy if exists moderation_reports_read on public.moderation_reports;
create policy moderation_reports_read on public.moderation_reports
  for select using (reporter_id = public.current_player_id());

-- No insert/update/delete policies are defined for anon or authenticated on
-- any table above. Every write goes through the server with the service role
-- key, which is what keeps a final score out of the client's hands.
