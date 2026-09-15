-- Lock down player PII.
--
-- `players_read using (true)` let any client with the anon key `select *`
-- including email and auth ids. Row policy stays public for display fields;
-- column grants hide everything else. Service role bypasses RLS and grants.

revoke all on table public.players from anon, authenticated;

grant select (
  id,
  username,
  display_name,
  country,
  first_day_number,
  created_at
) on table public.players to anon, authenticated;

drop policy if exists players_read on public.players;
create policy players_read on public.players for select using (true);

-- Self-update still cannot touch is_admin. Email and auth ids stay
-- service-role only.
drop policy if exists players_self_update on public.players;
create policy players_self_update on public.players
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and is_admin = false);
