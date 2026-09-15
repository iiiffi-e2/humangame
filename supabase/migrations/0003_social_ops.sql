-- Blocks, notifications, and admin hide flags. Not a ban hammer: hidden
-- players and crews can still play; they just leave named boards.

alter table public.players
  add column if not exists hidden_from_boards boolean not null default false;

alter table public.crews
  add column if not exists hidden_from_boards boolean not null default false;

create table if not exists public.player_blocks (
  blocker_id uuid not null references public.players (id) on delete cascade,
  blocked_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists player_blocks_blocked_idx on public.player_blocks (blocked_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null check (
    kind in ('rival_finished', 'rival_beat_you', 'rivalry_accepted', 'crew_joined')
  ),
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_player_idx
  on public.notifications (player_id, created_at desc);

alter table public.player_blocks enable row level security;
alter table public.notifications enable row level security;

drop policy if exists player_blocks_read on public.player_blocks;
create policy player_blocks_read on public.player_blocks
  for select using (blocker_id = public.current_player_id());

drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select using (player_id = public.current_player_id());
