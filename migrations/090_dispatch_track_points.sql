-- =============================================================================
--  UniGuard · 090 · The path a responding team drove
-- =============================================================================
--  Run after 089.
--
--  update_dispatch_location() (057 / 070) keeps only a team's latest position
--  on report_dispatches (last_lat, last_lng), so the maps could show where a
--  team is but not the road it took. Every position the team's phone shares is
--  now also kept here, in order, so the maps can draw the trail behind the
--  moving unit (solid) ahead of the route still to drive (faint), and the trail
--  stays on record to review after the response.
--
--  Rows are written only by the trigger below, never by the app. Whoever may
--  read the dispatch (report_dispatches RLS: duty staff, the unit, and the
--  resident who sent the report or SOS, 070) may read its trail.
-- =============================================================================
begin;

create table if not exists public.dispatch_track_points (
  id          bigint generated always as identity primary key,
  dispatch_id uuid not null references public.report_dispatches(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy    double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists dispatch_track_points_dispatch_idx
  on public.dispatch_track_points (dispatch_id, recorded_at);

alter table public.dispatch_track_points enable row level security;
drop policy if exists dispatch_track_points_read on public.dispatch_track_points;
create policy dispatch_track_points_read on public.dispatch_track_points for select to authenticated
  using (public.is_active_user() and exists (select 1 from public.report_dispatches d where d.id = dispatch_id));
revoke all on public.dispatch_track_points from public, anon, authenticated;
grant select on public.dispatch_track_points to authenticated;

-- one point each time the team's shared position changes
create or replace function public.record_dispatch_track_point()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.last_lat is null or new.last_lng is null then return null; end if;
  if new.last_lat is not distinct from old.last_lat and new.last_lng is not distinct from old.last_lng then return null; end if;
  insert into public.dispatch_track_points (dispatch_id, lat, lng, accuracy, recorded_at)
  values (new.id, new.last_lat, new.last_lng, new.last_accuracy, coalesce(new.last_loc_at, now()));
  return null;
end;
$$;
revoke all on function public.record_dispatch_track_point() from public, anon, authenticated;

drop trigger if exists report_dispatches_track_point on public.report_dispatches;
create trigger report_dispatches_track_point
  after update of last_lat, last_lng on public.report_dispatches
  for each row execute function public.record_dispatch_track_point();

-- the maps redraw the trail as points arrive
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables)
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                       and schemaname = 'public' and tablename = 'dispatch_track_points') then
    alter publication supabase_realtime add table public.dispatch_track_points;
  end if;
end $$;

commit;
