-- ============================================================================
--  UniGuard · 057 · Automatic dispatch, GPS tracking, ratings, typed SOS
--
--  1) AUTOMATIC DISPATCH
--     When a barangay official or the LGU verifies a report, the response
--     teams are sent without a separate Dispatch step. The teams come from
--     the hazard (the same mapping as js/hazard-types.js `teams`), and an
--     Emergency-severity report also gets an Ambulance. For every municipal
--     team the nearest active unit of that type is chosen, preferring units
--     that are Available. A team with no usable unit is skipped and the LGU
--     is told to dispatch it by hand. Reports auto-verified by three
--     residents' confirmations are NOT auto-dispatched; the LGU or the
--     barangay sends them with auto_dispatch_report() (one tap).
--
--  2) GPS TRACKING
--     Responders share their position (update_dispatch_location). The status
--     moves by itself: acknowledged on the first fix, en route once the team
--     has moved 50 m, on scene within 100 m of the report. Every step keeps
--     its timestamp (ack_at, en_route_at, on_scene_at, done_at) for the
--     response-time monitoring. Responders only press Done.
--
--  3) RATINGS
--     The reporter rates a resolved report 1-5 stars with an optional
--     comment (rate_report). LGU sees every rating, a barangay official the
--     ratings in their barangay.
--
--  4) TYPED SOS
--     submit_sos takes a kind: medical, fire, crime, rescue or other. A typed
--     SOS with a GPS fix becomes an emergency report that is dispatched at
--     once to the matching team (medical -> Ambulance, fire -> BFP,
--     crime -> PNP, rescue -> Rescue Unit). 'other' goes to the duty officers
--     only, as before.
--
--  Safe to re-run. Run after 056.
-- ============================================================================

-- ============================================================== shared bits
alter table public.report_dispatches add column if not exists last_lat      double precision;
alter table public.report_dispatches add column if not exists last_lng      double precision;
alter table public.report_dispatches add column if not exists last_accuracy double precision;
alter table public.report_dispatches add column if not exists last_loc_at   timestamptz;
alter table public.report_dispatches add column if not exists start_lat     double precision;
alter table public.report_dispatches add column if not exists start_lng     double precision;
alter table public.report_dispatches add column if not exists auto_dispatched boolean not null default false;

-- server-side workflow paths that run inside a citizen session (typed SOS,
-- the auto-dispatch it triggers) may move the status and the verification
-- stamp only. Same as 051 otherwise.
create or replace function public.guard_report_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text;
  v_reason text := coalesce(current_setting('uniguard.reason', true), '');
  v_free   text[] := array['status','verified_at','verified_by','verified_by_name','verified_by_role',
                           'updated_at','escalation_status'];
begin
  if auth.uid() is null then
    return new;
  end if;

  if v_reason in ('auto_corroboration', 'all_declined', 'sos', 'auto_dispatch')
     and (to_jsonb(new) - v_free) = (to_jsonb(old) - v_free) then
    return new;
  end if;

  select coalesce(role, 'citizen') into v_role from public.profiles where id = auth.uid();

  if v_role in ('barangay_official', 'lgu_ldrrmc') then
    if new.reporter_id is distinct from old.reporter_id then
      raise exception 'reporter_id cannot be reassigned';
    end if;
    if new.code is distinct from old.code then
      raise exception 'The report code cannot be changed';
    end if;
    return new;
  end if;

  if new.reporter_id is distinct from auth.uid() or old.reporter_id is distinct from auth.uid() then
    raise exception 'You can only edit your own report';
  end if;
  if old.created_at <= now() - interval '15 minutes' then
    raise exception 'The 15-minute edit window for this report has closed';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Status changes go through the official workflow, not the edit form';
  end if;
  if new.barangay_id is distinct from old.barangay_id
     or new.barangay is distinct from old.barangay then
    raise exception 'The barangay is assigned from the report coordinates and cannot be edited';
  end if;
  if new.reporter_id is distinct from old.reporter_id then
    raise exception 'reporter_id cannot be reassigned';
  end if;
  if new.code is distinct from old.code then
    raise exception 'The report code cannot be changed';
  end if;
  if new.resolved_at is distinct from old.resolved_at then
    raise exception 'resolved_at is managed by the workflow';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at cannot be edited';
  end if;

  return new;
end;
$$;

-- ======================================================= 1 · automatic dispatch
-- reports.hazard_type stores the label ("Fire", "Others"); keys are accepted
-- too. Keep in step with js/hazard-types.js.
create or replace function public.auto_dispatch_teams(p_hazard text, p_severity text)
returns text[] language sql immutable as $$
  select array(
    select distinct t from unnest(
      case
        when lower(coalesce(p_hazard, '')) in ('fire', 'electrical / power line hazard', 'power_line')
          then array['BFP', 'Barangay Response Team']
        when lower(coalesce(p_hazard, '')) in ('flood', 'river overflow', 'river_overflow',
               'drainage blockage', 'drainage_blockage', 'storm surge', 'storm_surge',
               'coastal erosion', 'coastal_erosion')
          then array['Rescue Unit', 'Barangay Response Team']
        when lower(coalesce(p_hazard, '')) in ('strong wind / typhoon damage', 'strong_wind',
               'fallen tree', 'fallen_tree')
          then array['Barangay Response Team']
        when lower(coalesce(p_hazard, '')) in ('landslide / soil erosion', 'landslide', 'earthquake')
          then array['Rescue Unit', 'Ambulance', 'Barangay Response Team']
        when lower(coalesce(p_hazard, '')) in ('vehicular accident', 'vehicular_accident')
          then array['PNP', 'Ambulance']
        when lower(coalesce(p_hazard, '')) in ('road damage', 'road_damage')
          then array['PNP', 'Barangay Response Team']
        else array[]::text[]
      end
      || case when p_severity = 'emergency' then array['Ambulance'] else array[]::text[] end
    ) as t
  );
$$;

-- the worker: sends each team once, picks units, moves the report to
-- dispatched. Internal only (security definer callers below).
create or replace function public.ug_auto_dispatch(p_report_id uuid, p_teams text[], p_source text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_row      public.reports;
  v_team     text;
  v_type     text;
  v_unit_id  uuid;
  v_dist     double precision;
  v_eta      timestamptz;
  v_disp     uuid;
  v_instr    text;
  v_by_name  text;
  v_by       uuid;
  v_n        int := 0;
  v_first    boolean := true;
  v_missing  text[] := array[]::text[];
begin
  select * into v_row from public.reports where id = p_report_id for update;
  if v_row.id is null or v_row.status <> 'verified' then
    return 0;
  end if;

  v_by      := case when p_source = 'sos' then null else auth.uid() end;
  v_by_name := case p_source when 'sos' then 'Auto-dispatch (SOS)'
                             when 'manual' then 'Auto-dispatch (' || coalesce((select full_name from public.profiles where id = auth.uid()), '') || ')'
                             else 'Auto-dispatch on verification' end;
  v_instr   := left(
    'Respond to ' || coalesce(nullif(v_row.hazard_other_text, ''), v_row.hazard_type, 'the reported hazard') ||
    ' (' || coalesce(v_row.severity, 'advisory') || ') in ' || coalesce(v_row.barangay, 'the barangay') || '. ' ||
    coalesce(v_row.description, ''), 480);

  if p_teams is null or cardinality(p_teams) = 0 then
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select p.id, 'Dispatch needed: ' || coalesce(v_row.code, ''),
           'No automatic team for ' || coalesce(v_row.hazard_type, 'this hazard') || '. Choose a team and dispatch it.',
           'warning', 'truck', 'dispatch', v_row.id
      from public.profiles p where p.disabled = false and p.role = 'lgu_ldrrmc';
    return 0;
  end if;

  foreach v_team in array p_teams loop
    -- a team already on this report is not sent twice
    if exists (select 1 from public.report_dispatches d
                where d.report_id = p_report_id and d.team = v_team
                  and d.dispatch_status not in ('done', 'declined')) then
      continue;
    end if;

    if v_team = 'Barangay Response Team' then
      if v_row.barangay_id is null then
        continue;
      end if;
      v_unit_id := null;
      v_eta     := now() + interval '15 minutes';
    else
      v_type := case v_team when 'BFP' then 'BFP' when 'PNP' then 'PNP'
                            when 'Rescue Unit' then 'Rescue' when 'Ambulance' then 'Hospital' end;
      v_unit_id := null;
      select u.id,
             case when u.lat is null or u.lng is null or v_row.lat is null or v_row.lng is null then null
                  else public.distance_m(u.lat, u.lng, v_row.lat, v_row.lng) end as dist
        into v_unit_id, v_dist
        from public.dispatch_units u
       where u.active = true and u.unit_type = v_type and u.status <> 'off_duty'
       order by (u.status = 'available') desc, dist asc nulls last, u.created_at
       limit 1;
      if v_unit_id is null then
        v_missing := v_missing || v_team;
        continue;
      end if;
      -- 30 km/h through town, never under 5 minutes; 15 min when unknown
      v_eta := now() + make_interval(mins => case when v_dist is null then 15
                                                 else greatest(5, ceil(v_dist / 500.0)::int) end);
    end if;

    insert into public.report_dispatches
      (report_id, team, instructions, eta, dispatched_by, dispatched_by_name,
       unit_id, target_barangay_id, dispatch_status, auto_dispatched)
    values
      (p_report_id, v_team, v_instr, v_eta, v_by, v_by_name,
       v_unit_id, v_row.barangay_id, 'sent', true)
    returning id into v_disp;

    insert into public.report_dispatch_events (dispatch_id, actor, actor_name, action, note)
    values (v_disp, v_by, v_by_name, 'dispatched', left(v_instr, 240));

    perform public.write_audit('report.auto_dispatched', 'reports', p_report_id,
      jsonb_build_object('dispatch_id', v_disp, 'team', v_team, 'unit_id', v_unit_id,
                         'source', p_source, 'eta', v_eta));

    -- the reporter hears it once, from the first team
    perform public.fanout_dispatch(p_report_id, v_disp, v_team, v_row.barangay_id, v_unit_id,
                                   v_instr, not v_first);
    v_first := false;
    v_n := v_n + 1;
  end loop;

  if v_n > 0 then
    perform set_config('uniguard.reason', 'auto_dispatch', true);
    perform set_config('uniguard.note', 'Auto-dispatched ' || v_n || ' team(s)', true);
    update public.reports set status = 'dispatched' where id = p_report_id;
  end if;

  if cardinality(v_missing) > 0 then
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select p.id, 'No unit available: ' || coalesce(v_row.code, ''),
           'No available unit for ' || array_to_string(v_missing, ', ') || ' could be sent to ' ||
             coalesce(v_row.barangay, 'the barangay') || '. Dispatch it by hand.',
           'warning', 'truck', 'dispatch', v_row.id
      from public.profiles p where p.disabled = false and p.role = 'lgu_ldrrmc';
  end if;

  return v_n;
end;
$$;

revoke all on function public.ug_auto_dispatch(uuid, text[], text) from public, anon, authenticated;

-- verification by an official or the LGU dispatches at once. A failure here
-- never undoes the verification: the LGU is told to dispatch by hand.
create or replace function public.ug_auto_dispatch_on_verify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verified_by_role in ('barangay_official', 'lgu_ldrrmc') then
    begin
      perform public.ug_auto_dispatch(new.id, public.auto_dispatch_teams(new.hazard_type, new.severity), 'verify');
    exception when others then
      insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
      select p.id, 'Auto-dispatch failed: ' || coalesce(new.code, ''),
             left('Dispatch this report by hand. Reason: ' || sqlerrm, 240),
             'warning', 'truck', 'dispatch', new.id
        from public.profiles p where p.disabled = false and p.role = 'lgu_ldrrmc';
    end;
  end if;
  return null;
end;
$$;

drop trigger if exists reports_auto_dispatch on public.reports;
create trigger reports_auto_dispatch
  after update of status on public.reports
  for each row
  when (old.status = 'reported' and new.status = 'verified')
  execute function public.ug_auto_dispatch_on_verify();

-- one tap for a verified report that was not dispatched automatically
-- (auto-verified by residents, or a team that had no free unit)
create or replace function public.auto_dispatch_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
  v_brgy uuid;
  v_row  public.reports;
  v_n    int;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  select role, barangay_id into v_role, v_brgy from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('barangay_official', 'lgu_ldrrmc') then
    raise exception 'Only officials and LGU can dispatch a response';
  end if;
  select * into v_row from public.reports where id = p_report_id;
  if v_row.id is null then
    raise exception 'That report does not exist';
  end if;
  if v_role = 'barangay_official' and v_row.barangay_id is distinct from v_brgy then
    raise exception 'That report is outside your barangay';
  end if;
  if v_row.status <> 'verified' then
    raise exception 'Only a verified report can be auto-dispatched (it is "%")', v_row.status;
  end if;
  v_n := public.ug_auto_dispatch(p_report_id, public.auto_dispatch_teams(v_row.hazard_type, v_row.severity), 'manual');
  return jsonb_build_object('report_id', p_report_id, 'dispatched', v_n);
end;
$$;

revoke all on function public.auto_dispatch_report(uuid) from public, anon;
grant execute on function public.auto_dispatch_report(uuid) to authenticated;

-- =========================================================== 2 · GPS tracking
create or replace function public.update_dispatch_location(
  p_dispatch_id uuid,
  p_lat         double precision,
  p_lng         double precision,
  p_accuracy    double precision default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row    public.report_dispatches;
  v_rep    public.reports;
  v_status text;
  v_scene  double precision;
  v_moved  double precision;
  c_scene  constant double precision := 100;   -- metres: "on scene"
  c_moved  constant double precision := 50;    -- metres: "en route"
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  select * into v_row from public.report_dispatches where id = p_dispatch_id for update;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.unit_id is null or v_row.unit_id is distinct from public.my_unit_id()
     or not public.is_dispatch() then
    raise exception 'Only this unit''s users may share its location';
  end if;
  if v_row.dispatch_status in ('done', 'declined') then
    return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', v_row.dispatch_status, 'tracking', false);
  end if;

  update public.report_dispatches
     set last_lat = p_lat, last_lng = p_lng, last_accuracy = p_accuracy, last_loc_at = now(),
         start_lat = coalesce(start_lat, p_lat), start_lng = coalesce(start_lng, p_lng)
   where id = p_dispatch_id
   returning * into v_row;

  v_status := v_row.dispatch_status;
  select * into v_rep from public.reports where id = v_row.report_id;

  -- opening the dispatch with location on is the acknowledgement
  if v_status = 'sent' then
    perform public.dispatch_respond(p_dispatch_id, 'acknowledged', 'Automatic: location sharing started');
    v_status := 'acknowledged';
  end if;

  -- a poor fix moves nothing
  if p_accuracy is null or p_accuracy <= 150 then
    if v_rep.lat is not null and v_rep.lng is not null then
      v_scene := public.distance_m(p_lat, p_lng, v_rep.lat, v_rep.lng);
    end if;
    v_moved := public.distance_m(v_row.start_lat, v_row.start_lng, p_lat, p_lng);

    if v_status in ('acknowledged', 'en_route') and v_scene is not null and v_scene <= c_scene then
      perform public.dispatch_respond(p_dispatch_id, 'on_scene',
        'Automatic: arrived (GPS, ' || round(v_scene::numeric) || ' m from the report)');
      v_status := 'on_scene';
    elsif v_status = 'acknowledged' and v_moved >= c_moved then
      perform public.dispatch_respond(p_dispatch_id, 'en_route', 'Automatic: moving (GPS)');
      v_status := 'en_route';
    end if;
  end if;

  return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', v_status,
                            'distance_m', case when v_scene is null then null else round(v_scene::numeric) end,
                            'tracking', true);
end;
$$;

revoke all on function public.update_dispatch_location(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.update_dispatch_location(uuid, double precision, double precision, double precision) to authenticated;

-- ================================================================ 3 · ratings
create table if not exists public.report_ratings (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  stars      int  not null,
  comment    text not null default '',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'report_ratings_stars_check') then
    alter table public.report_ratings add constraint report_ratings_stars_check check (stars between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'report_ratings_report_key') then
    alter table public.report_ratings add constraint report_ratings_report_key unique (report_id);
  end if;
end $$;

alter table public.report_ratings enable row level security;

drop policy if exists report_ratings_read on public.report_ratings;
create policy report_ratings_read on public.report_ratings
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_lgu()
    or (public.is_official() and exists (
      select 1 from public.reports r
       where r.id = report_id and r.barangay_id = public.my_barangay_id()))
  );
-- no insert/update policy: rate_report() is the only writer

create or replace function public.rate_report(p_report_id uuid, p_stars int, p_comment text default '')
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.reports;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'Choose 1 to 5 stars';
  end if;
  select * into v_row from public.reports where id = p_report_id;
  if v_row.id is null then
    raise exception 'That report does not exist';
  end if;
  if v_row.reporter_id is distinct from auth.uid() then
    raise exception 'Only the person who filed the report can rate it';
  end if;
  if v_row.status <> 'resolved' then
    raise exception 'You can rate the response once the report is resolved';
  end if;

  insert into public.report_ratings (report_id, user_id, stars, comment)
  values (p_report_id, auth.uid(), p_stars, left(trim(coalesce(p_comment, '')), 500))
  on conflict (report_id) do update
     set stars = excluded.stars, comment = excluded.comment, created_at = now();

  perform public.write_audit('report.rated', 'reports', p_report_id,
    jsonb_build_object('stars', p_stars));

  return jsonb_build_object('report_id', p_report_id, 'stars', p_stars);
end;
$$;

revoke all on function public.rate_report(uuid, int, text) from public, anon;
grant execute on function public.rate_report(uuid, int, text) to authenticated;

-- ============================================================== 4 · typed SOS
alter table public.sos_log add column if not exists kind      text not null default 'other';
alter table public.sos_log add column if not exists report_id uuid references public.reports(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sos_log_kind_check') then
    alter table public.sos_log add constraint sos_log_kind_check
      check (kind in ('medical', 'fire', 'crime', 'rescue', 'other'));
  end if;
end $$;

-- the 4-argument version would make named calls ambiguous
drop function if exists public.submit_sos(double precision, double precision, double precision, text);

create or replace function public.submit_sos(
  p_lat      double precision,
  p_lng      double precision,
  p_accuracy double precision default null,
  p_note     text default '',
  p_kind     text default 'other'
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_id      uuid;
  v_row     public.sos_log;
  v_prof    record;
  v_reach   int := 0;
  v_brgy_id uuid;
  v_kind    text := lower(coalesce(nullif(trim(p_kind), ''), 'other'));
  v_label   text;
  v_team    text;
  v_rep     uuid;
  v_sent    int := 0;
  v_err     text := '';
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to send an SOS';
  end if;
  if v_kind not in ('medical', 'fire', 'crime', 'rescue', 'other') then
    raise exception 'Unknown SOS type: %', p_kind;
  end if;

  perform public.check_rate_limit('sos', 5, interval '10 minutes');

  select full_name, phone, barangay, barangay_id into v_prof from public.profiles where id = auth.uid();

  if v_prof.barangay_id is null and coalesce(v_prof.barangay, '') <> '' then
    select id into v_brgy_id from public.barangays where name = v_prof.barangay limit 1;
  else
    v_brgy_id := v_prof.barangay_id;
  end if;

  v_label := case v_kind when 'medical' then 'Medical emergency' when 'fire' then 'Fire'
                         when 'crime' then 'Crime / violence' when 'rescue' then 'Rescue needed'
                         else 'Other / not sure' end;
  v_team  := case v_kind when 'medical' then 'Ambulance' when 'fire' then 'BFP'
                         when 'crime' then 'PNP' when 'rescue' then 'Rescue Unit' end;

  insert into public.sos_log (user_id, profile_name, profile_phone, barangay, barangay_id, lat, lng, accuracy, note, kind)
  values (auth.uid(),
          coalesce(v_prof.full_name, ''),
          coalesce(v_prof.phone, ''),
          coalesce(v_prof.barangay, ''),
          v_brgy_id,
          p_lat, p_lng, p_accuracy, coalesce(p_note, ''), v_kind)
  returning * into v_row;
  v_id := v_row.id;

  -- duty officers + the sender's barangay officials
  with targets as (
    select p.id from public.profiles p
     where p.disabled = false
       and (p.role = 'lgu_ldrrmc'
            or (v_brgy_id is not null and p.role = 'barangay_official' and p.barangay_id = v_brgy_id))
  ), ins as (
    insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
    select id,
           'SOS · ' || v_label || ' · ' || coalesce(v_prof.full_name, 'a resident'),
           coalesce(v_prof.phone, '') || ' · ' || coalesce(v_prof.barangay, '') ||
           ' · ' || coalesce(round(p_accuracy::numeric)::text || ' m', 'no GPS fix'),
           'emergency', 'alert', 'sos', v_id
      from targets
    returning 1
  )
  select count(*) into v_reach from ins;

  -- a typed SOS with a position becomes an emergency report and the matching
  -- team is sent at once. If that fails (outside Lingayen, report limit) the
  -- SOS itself still stands and the duty officers handle it.
  if v_team is not null and p_lat is not null and p_lng is not null then
    begin
      insert into public.reports (hazard_type, hazard_other_text, barangay, description, severity, urgency, lat, lng)
      values (case when v_kind = 'fire' then 'Fire' else 'Others' end,
              case when v_kind = 'fire' then null else 'SOS: ' || v_label end,
              coalesce(v_prof.barangay, ''),
              left('SOS (' || v_label || ') from ' || coalesce(v_prof.full_name, 'a resident') ||
                   ', ' || coalesce(v_prof.phone, 'no number') ||
                   case when coalesce(trim(p_note), '') <> '' then '. ' || trim(p_note) else '' end, 1000),
              'emergency', 'emergency', p_lat, p_lng)
      returning id into v_rep;

      perform set_config('uniguard.reason', 'sos', true);
      update public.reports
         set status = 'verified', verified_at = now(), verified_by_name = 'SOS', verified_by_role = ''
       where id = v_rep and status = 'reported';

      v_sent := public.ug_auto_dispatch(v_rep, array[v_team], 'sos');
      update public.sos_log set report_id = v_rep, status = 'acknowledged' where id = v_id;
    exception when others then
      v_err := sqlerrm;
      v_rep := null;
      v_sent := 0;
    end;
  end if;

  perform public.write_audit('sos.received', 'sos_log', v_id,
    jsonb_build_object('lat', p_lat, 'lng', p_lng, 'accuracy', p_accuracy, 'reach', v_reach,
                       'kind', v_kind, 'report_id', v_rep, 'dispatched', v_sent,
                       'report_error', nullif(v_err, '')));

  return jsonb_build_object('id', v_id, 'reach', v_reach, 'kind', v_kind,
                            'report_id', v_rep, 'dispatched', v_sent, 'team', v_team);
end;
$$;

revoke all on function public.submit_sos(double precision, double precision, double precision, text, text) from public;
grant execute on function public.submit_sos(double precision, double precision, double precision, text, text) to authenticated;

-- ======================================================== realtime + reload
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach t in array array['report_dispatches', 'report_ratings'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
