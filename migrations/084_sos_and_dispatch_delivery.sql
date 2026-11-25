-- Give active dispatch staff access to the incident attached to an assignment for their unit.
-- The definer lookup avoids a policy cycle with report_dispatches_read.
begin;

-- An automatic assignment has no meaningful ETA without an incident location.
alter table public.report_dispatches alter column eta drop not null;

alter table public.emergency_delivery
  add column if not exists urgent boolean not null default true,
  add column if not exists unit_id uuid references public.dispatch_units(id) on delete cascade;
alter table public.emergency_delivery drop constraint if exists emergency_delivery_kind_check;
alter table public.emergency_delivery add constraint emergency_delivery_kind_check
  check (kind in ('sos', 'dispatch', 'report_review', 'dispatch_gap', 'hazard_confirmed'));

create index if not exists profiles_active_dispatch_unit_idx
  on public.profiles (dispatch_unit_id)
  where role = 'dispatch_team' and not disabled and removed_at is null;

create or replace function public.unit_has_report_assignment(p_report_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.account_session_blocked() and exists (
    select 1
      from public.profiles p
      join public.report_dispatches d on d.unit_id = p.dispatch_unit_id
     where p.id = (select auth.uid()) and p.role = 'dispatch_team'
       and not p.disabled and p.removed_at is null and d.report_id = p_report_id
  );
$$;
revoke all on function public.unit_has_report_assignment(uuid) from public, anon;
grant execute on function public.unit_has_report_assignment(uuid) to authenticated;

drop policy if exists reports_read_assigned_dispatch on public.reports;
create policy reports_read_assigned_dispatch on public.reports
  for select to authenticated using (public.unit_has_report_assignment(id));

create or replace function public.dispatch_unit_has_active_staff(p_unit_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
     where dispatch_unit_id = p_unit_id and role = 'dispatch_team'
       and not disabled and removed_at is null
  );
$$;
revoke all on function public.dispatch_unit_has_active_staff(uuid) from public, anon, authenticated;

-- Staff can use radio/phone while arranging a team. The in-app dispatch must have recipients.
create or replace function public.guard_dispatch_recipients()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.unit_id is not null and new.dispatch_status = 'sent'
     and not public.dispatch_unit_has_active_staff(new.unit_id) then
    raise exception 'This unit has no active UniGuard dispatch accounts. Select a staffed unit or confirm the response by phone or radio.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_dispatch_recipients() from public, anon, authenticated;

drop trigger if exists report_dispatches_guard_recipients on public.report_dispatches;
create trigger report_dispatches_guard_recipients before insert on public.report_dispatches
for each row execute function public.guard_dispatch_recipients();

-- The SOS RPC creates the source row and supplies its ID only for the linked report insert.
create or replace function public.pending_sos_report_source(
  p_lat double precision, p_lng double precision
)
returns public.sos_log language sql stable security definer set search_path = public as $$
  select s from public.sos_log s
   where s.id = nullif(current_setting('uniguard.sos_report_id', true), '')::uuid
     and s.user_id = (select auth.uid()) and s.status = 'sent' and s.report_id is null
     and s.lat is not distinct from p_lat and s.lng is not distinct from p_lng;
$$;
revoke all on function public.pending_sos_report_source(double precision, double precision)
  from public, anon, authenticated;

create or replace function public.guard_report_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_barangay_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to file a report';
  end if;
  new.reporter_id := auth.uid();

  if new.lat is null and new.lng is null and new.severity = 'emergency' then
    v_barangay_id := (public.pending_sos_report_source(new.lat, new.lng)).barangay_id;
  end if;
  if v_barangay_id is null then
    perform public.validate_report_coords(new.lat, new.lng);
    v_barangay_id := public.resolve_barangay(new.lat, new.lng);
  end if;
  if v_barangay_id is null then
    raise exception 'No barangay matched the report location. Contact the MDRRMO.';
  end if;
  new.barangay_id := v_barangay_id;
  select name into new.barangay from public.barangays where id = v_barangay_id;
  return new;
end;
$$;

create or replace function public.guard_report_rate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- SOS already has its own rate limit. A full report quota cannot block an emergency.
  if new.severity is distinct from 'emergency'
     or (public.pending_sos_report_source(new.lat, new.lng)).id is null then
    perform public.check_rate_limit('report', 5, interval '10 minutes');
  end if;
  return new;
end;
$$;

-- The order sets the primary responder. Severity controls urgency, not team selection.
create or replace function public.auto_dispatch_teams(p_hazard text, p_severity text)
returns text[] language sql immutable as $$
  select case
    when lower(trim(coalesce(p_hazard, ''))) in ('fire', 'electrical / power line hazard', 'power_line')
      then array['BFP', 'Barangay Response Team']
    when lower(trim(coalesce(p_hazard, ''))) in ('flood', 'river overflow', 'river_overflow',
           'drainage blockage', 'drainage_blockage', 'storm surge', 'storm_surge',
           'coastal erosion', 'coastal_erosion')
      then array['Rescue Unit', 'Barangay Response Team']
    when lower(trim(coalesce(p_hazard, ''))) in ('strong wind / typhoon damage', 'strong_wind',
           'fallen tree', 'fallen_tree')
      then array['Barangay Response Team']
    when lower(trim(coalesce(p_hazard, ''))) in ('landslide / soil erosion', 'landslide', 'earthquake')
      then array['Rescue Unit', 'Ambulance', 'Barangay Response Team']
    when lower(trim(coalesce(p_hazard, ''))) in ('vehicular accident', 'vehicular_accident')
      then array['PNP', 'Ambulance']
    when lower(trim(coalesce(p_hazard, ''))) in ('road damage', 'road_damage')
      then array['PNP', 'Barangay Response Team']
    else array[]::text[]
  end;
$$;

create or replace function public.report_is_life_safety(p_hazard text)
returns boolean language sql immutable set search_path = public as $$
  select lower(trim(coalesce(p_hazard, ''))) in (
    'fire', 'electrical / power line hazard', 'power_line',
    'vehicular accident', 'vehicular_accident', 'landslide / soil erosion', 'landslide'
  );
$$;

create or replace view public.reports_feed as
select
    r.id,
    r.code,
    r.barangay_id,
    r.barangay,
    r.hazard_type,
    r.hazard_other_text,
    r.severity,
    r.urgency,
    r.status,
    case when access.is_sos and not access.has_details then 'Emergency SOS reported in this barangay.'
         else r.description end as description,
    case when not access.is_sos or access.has_details then r.lat end as lat,
    case when not access.is_sos or access.has_details then r.lng end as lng,
    case when access.has_details then r.photo_path end as photo_path,
    r.created_at,
    r.updated_at,
    r.resolved_at,
    r.verified_by,
    r.verified_by_name,
    r.verified_by_role,
    r.verified_at,
    (
        select count(*)
        from public.report_corroborations c
        where c.report_id = r.id
    ) as corroborations,
    (r.reporter_id = auth.uid()) as is_mine,
    ( r.status = 'reported'
      and r.verified_at is null
      and r.created_at < now() - interval '30 minutes'
    ) as is_stale,
    ( r.status = 'reported'
      and public.report_is_life_safety(r.hazard_type)
    ) as is_severity_bypass,
    ( r.status = 'reported'
      and (
        ( r.verified_at is null
          and r.created_at < now() - interval '30 minutes' )
        or public.report_is_life_safety(r.hazard_type)
      )
    ) as escalates_to_lgu,
    r.expired_at,
    case when access.has_details then r.location_note else '' end as location_note,
    access.is_sos as is_sos
from public.reports r
cross join lateral (
    select (
        coalesce(r.verified_by_name = 'SOS', false)
        or exists (select 1 from public.sos_log s where s.report_id = r.id)
    ) as is_sos,
    coalesce((
        r.reporter_id = (select auth.uid())
        or public.owns_linked_sos(r.id)
        or (select public.is_lgu())
        or ((select public.is_official()) and r.barangay_id = (select public.my_barangay_id()))
    ), false) as has_details
) access
where (select public.is_active_user())
  and not (select public.account_session_blocked())
  and (access.has_details or r.barangay_id = (select public.my_barangay_id()));
alter view public.reports_feed set (security_invoker = false);
grant select on public.reports_feed to authenticated;

-- An SOS is independently verified by the SOS path and does not need intake corroboration.
create or replace function public.apply_report_corroboration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (public.pending_sos_report_source(new.lat, new.lng)).id is null then
    perform public.evaluate_corroboration(new.id);
  end if;
  return new;
end;
$$;

-- Ordinary reports go to the reviewing offices first. Specialized responders
-- receive deployment notifications when the verified incident is assigned.
create or replace function public.notify_report_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_urgent boolean;
  v_escalate boolean;
begin
  if new.status <> 'reported' or (public.pending_sos_report_source(new.lat, new.lng)).id is not null then
    return new;
  end if;

  v_urgent := (new.severity is not distinct from 'emergency') or public.report_is_life_safety(new.hazard_type);
  v_escalate := v_urgent
    or cardinality(public.auto_dispatch_teams(new.hazard_type, 'advisory')) = 0
    or not exists (
      select 1 from public.profiles p
       where p.role = 'barangay_official' and p.barangay_id = new.barangay_id
         and not p.disabled and p.removed_at is null
    );
  with queued as (
    insert into public.emergency_delivery (kind, event_id, user_id, urgent)
    select 'report_review', new.id, p.id, v_urgent from public.profiles p
     where not p.disabled and p.removed_at is null and p.id is distinct from new.reporter_id
       and ((p.role = 'barangay_official' and p.barangay_id = new.barangay_id)
         or (v_escalate and p.role = 'lgu_ldrrmc' and not p.is_super_admin))
    on conflict do nothing
    returning user_id
  )
  insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
  select user_id, case when v_urgent then 'Urgent hazard report needs review' else 'New hazard report needs review' end,
         left(concat_ws(' · ', new.code, new.hazard_type, nullif(new.barangay, '')), 240),
         case when v_urgent then 'emergency' else 'warning' end, 'alert', 'report_review', new.id
    from queued;
  return new;
end;
$$;
revoke all on function public.notify_report_review() from public, anon, authenticated;

drop trigger if exists reports_notify_review on public.reports;
create trigger reports_notify_review after insert on public.reports
for each row execute function public.notify_report_review();

create or replace function public.enqueue_dispatch_gap(p_report_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.emergency_delivery (kind, event_id, user_id)
  select 'dispatch_gap', p_report_id, p.id from public.profiles p
   where p.role = 'lgu_ldrrmc' and not p.is_super_admin and not p.disabled and p.removed_at is null
  on conflict do nothing;
$$;
revoke all on function public.enqueue_dispatch_gap(uuid) from public, anon, authenticated;

-- A team that declines still leaves duty staff responsible for the response.
create or replace function public.queue_declined_dispatch_followup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.enqueue_dispatch_gap(new.report_id);
  return new;
end;
$$;
revoke all on function public.queue_declined_dispatch_followup() from public, anon, authenticated;

drop trigger if exists report_dispatches_decline_followup on public.report_dispatches;
create trigger report_dispatches_decline_followup after update of dispatch_status on public.report_dispatches
for each row when (old.dispatch_status is distinct from new.dispatch_status
  and new.dispatch_status = 'declined' and new.no_ack_rerouted_at is null)
execute function public.queue_declined_dispatch_followup();

create or replace function public.pick_staffed_dispatch_unit(
  p_team text, p_lat double precision, p_lng double precision
)
returns table (unit_id uuid, distance double precision)
language sql stable security definer set search_path = public as $$
  select u.id, case when u.lat is not null and u.lng is not null and p_lat is not null and p_lng is not null
                    then public.distance_m(u.lat, u.lng, p_lat, p_lng) end as dist
    from public.dispatch_units u
   where u.active and u.status <> 'off_duty'
     and u.unit_type = case p_team when 'BFP' then 'BFP' when 'PNP' then 'PNP'
                                 when 'Rescue Unit' then 'Rescue' when 'Ambulance' then 'Hospital' end
     and (p_team <> 'Ambulance' or u.ambulance_available)
     and public.dispatch_unit_has_active_staff(u.id)
   order by (u.status = 'available') desc, dist asc nulls last, u.created_at, u.id
   limit 1;
$$;
revoke all on function public.pick_staffed_dispatch_unit(text, double precision, double precision)
  from public, anon, authenticated;

-- Alert the specific response unit about the confirmation while duty staff
-- retain authority to make the assignment.
create or replace function public.notify_confirmed_hazard(p_report_id uuid, p_teams text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_report public.reports;
  v_urgent boolean;
  v_team text;
  v_unit uuid;
begin
  select * into v_report from public.reports where id = p_report_id;
  if v_report.status is distinct from 'verified' then return; end if;
  v_urgent := v_report.severity is not distinct from 'emergency' or public.report_is_life_safety(v_report.hazard_type);
  foreach v_team in array p_teams loop
    select unit_id into v_unit from public.pick_staffed_dispatch_unit(v_team, v_report.lat, v_report.lng);
    with queued as (
      insert into public.emergency_delivery (kind, event_id, user_id, unit_id, urgent)
      select 'hazard_confirmed', p_report_id, p.id, v_unit, v_urgent from public.profiles p
       where not p.disabled and p.removed_at is null
         and ((v_team = 'Barangay Response Team' and p.role = 'barangay_official' and p.barangay_id = v_report.barangay_id)
           or (p.role = 'dispatch_team' and p.dispatch_unit_id = v_unit))
      on conflict do nothing
      returning user_id
    )
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select user_id, 'Confirmed hazard for ' || v_team,
           left(concat_ws(' · ', v_report.code, v_report.hazard_type, nullif(v_report.barangay, '')) ||
             case when v_unit is not null then '. Wait for an MDRRMO assignment.' else '. Review the incident in UniGuard.' end, 240),
           case when v_urgent then 'emergency' else 'warning' end,
           'alert', 'hazard_confirmed', p_report_id
      from queued;
  end loop;
end;
$$;
revoke all on function public.notify_confirmed_hazard(uuid, text[]) from public, anon, authenticated;

create or replace function public.ug_auto_dispatch(p_report_id uuid, p_teams text[], p_source text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_row      public.reports;
  v_team     text;
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
    coalesce(v_row.description, '') ||
    case when v_row.lat is null or v_row.lng is null
      then ' No GPS location. Confirm the incident address with the duty officer before traveling.'
      else '' end, 480);

  if p_teams is null or cardinality(p_teams) = 0 then
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select p.id, 'Dispatch needed: ' || coalesce(v_row.code, ''),
           'No automatic team for ' || coalesce(v_row.hazard_type, 'this hazard') || '. Choose a team and dispatch it.',
           'warning', 'truck', 'dispatch', v_row.id
      from public.profiles p where p.disabled = false and p.role = 'lgu_ldrrmc';
    perform public.enqueue_dispatch_gap(p_report_id);
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
      if v_row.barangay_id is null or not exists (
        select 1 from public.profiles p
         where p.role = 'barangay_official' and p.barangay_id = v_row.barangay_id
           and not p.disabled and p.removed_at is null
      ) then
        v_missing := v_missing || v_team;
        continue;
      end if;
      v_unit_id := null;
      v_eta := case when v_row.lat is not null and v_row.lng is not null then now() + interval '15 minutes' end;
    else
      select unit_id, distance into v_unit_id, v_dist
        from public.pick_staffed_dispatch_unit(v_team, v_row.lat, v_row.lng);
      if v_unit_id is null then
        v_missing := v_missing || v_team;
        continue;
      end if;
      -- 30 km/h through town, never under 5 minutes; 15 min when unknown
      v_eta := case when v_row.lat is not null and v_row.lng is not null then
        now() + make_interval(mins => case when v_dist is null then 15 else greatest(5, ceil(v_dist / 500.0)::int) end)
      end;
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
    perform public.enqueue_dispatch_gap(p_report_id);
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select p.id, 'No unit available: ' || coalesce(v_row.code, ''),
           'No available unit for ' || array_to_string(v_missing, ', ') || ' could be sent to ' ||
             coalesce(v_row.barangay, 'the barangay') || '. Confirm with the duty phone or radio and arrange a response.',
           'warning', 'truck', 'dispatch', v_row.id
      from public.profiles p where p.disabled = false and p.role = 'lgu_ldrrmc';
  end if;

  return v_n;
end;
$$;

-- A barangay verification does not authorize a municipal deployment. Put it
-- directly in the duty officer's queue when specialized response is needed.
create or replace function public.ug_auto_dispatch_on_verify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_teams text[] := public.auto_dispatch_teams(new.hazard_type, new.severity);
begin
  if new.verified_by_role = 'lgu_ldrrmc' and public.is_mdrrmo_duty_staff() then
    begin
      perform public.ug_auto_dispatch(new.id, v_teams, 'verify');
    exception when others then
      insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
      select p.id, 'Auto-dispatch failed: ' || coalesce(new.code, ''),
             'Open the incident and arrange a response by phone or radio.',
             'warning', 'truck', 'dispatch', new.id
        from public.profiles p
       where p.role = 'lgu_ldrrmc' and not p.is_super_admin and not p.disabled and p.removed_at is null;
      perform public.enqueue_dispatch_gap(new.id);
      perform public.write_audit('dispatch.auto_failed', 'reports', new.id, jsonb_build_object('reason', sqlerrm));
    end;
  elsif (new.verified_by_role = 'barangay_official' and public.is_official())
     or current_setting('uniguard.reason', true) = 'auto_corroboration' then
    perform public.notify_confirmed_hazard(new.id, v_teams);
    if cardinality(v_teams) = 0 or cardinality(array_remove(v_teams, 'Barangay Response Team')) > 0
       or current_setting('uniguard.reason', true) = 'auto_corroboration' then
      insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
      select p.id, case when new.verified_by_role = 'barangay_official'
                       then 'Barangay-verified report needs MDRRMO review'
                       else 'Corroborated report needs MDRRMO review' end,
             left(concat_ws(' · ', new.code, new.hazard_type, nullif(array_to_string(v_teams, ', '), '')), 240),
             'warning', 'truck', 'dispatch_request', new.id
        from public.profiles p
       where p.role = 'lgu_ldrrmc' and not p.is_super_admin and not p.disabled and p.removed_at is null;
      perform public.enqueue_dispatch_gap(new.id);
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.ug_reroute_unacknowledged(p_minutes int default 3)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  d          record;
  v_row      public.reports;
  v_type     text;
  v_new      uuid;
  v_dist     double precision;
  v_eta      timestamptz;
  v_disp     uuid;
  v_old_name text;
  v_new_name text;
  v_why      text := 'No acknowledgement within ' || p_minutes || ' min — re-sent automatically';
  v_n        int := 0;
begin
  for d in
    select rd.*
      from public.report_dispatches rd
      join public.reports r on r.id = rd.report_id
     where rd.dispatch_status = 'sent'
       and rd.ack_at is null
       and rd.unit_id is not null
       and rd.no_ack_rerouted_at is null
       and rd.team in ('BFP', 'PNP', 'Rescue Unit', 'Ambulance')
       and rd.dispatched_at < now() - make_interval(mins => p_minutes)
       and r.status not in ('resolved', 'rejected')
     order by rd.dispatched_at
     for update of rd skip locked
  loop
    select * into v_row from public.reports where id = d.report_id for update;
    select name into v_old_name from public.dispatch_units where id = d.unit_id;
    v_type := case d.team when 'BFP' then 'BFP' when 'PNP' then 'PNP'
                          when 'Rescue Unit' then 'Rescue' when 'Ambulance' then 'Hospital' end;

    -- 1) take the silent unit off this dispatch
    update public.report_dispatches
       set dispatch_status = 'declined', decline_reason = v_why, no_ack_rerouted_at = now()
     where id = d.id;
    insert into public.report_dispatch_events (dispatch_id, actor, actor_name, action, note)
    values (d.id, null, 'Auto-reroute', 'declined', v_why);
    begin
      perform public.release_dispatch_equipment(array[d.id]);
    exception when undefined_function then null;
    end;

    -- 2) the next nearest unit of the same team not yet tried on this report
    v_new := null;
    select u.id,
           case when u.lat is null or u.lng is null or v_row.lat is null or v_row.lng is null then null
                else public.distance_m(u.lat, u.lng, v_row.lat, v_row.lng) end as dist,
           u.name
      into v_new, v_dist, v_new_name
      from public.dispatch_units u
     where u.active = true and u.unit_type = v_type
       and (v_type <> 'Hospital' or u.ambulance_available) and u.status <> 'off_duty'
       and public.dispatch_unit_has_active_staff(u.id)
       and u.id not in (select x.unit_id from public.report_dispatches x
                         where x.report_id = d.report_id and x.team = d.team and x.unit_id is not null)
     order by (u.status = 'available') desc, dist asc nulls last, u.created_at
     limit 1;

    if v_new is null then
      perform public.enqueue_dispatch_gap(d.report_id);
      insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
      select p.id, 'No response, no other unit: ' || coalesce(v_row.code, ''),
             left(coalesce(v_old_name, d.team) || ' did not acknowledge within ' || p_minutes ||
               ' minutes and no other ' || d.team || ' unit is free. Dispatch ' || coalesce(v_row.code, 'this report') || ' by hand.', 240),
             'warning', 'truck', 'dispatch', v_row.id
        from public.profiles p where p.disabled = false and p.role = 'lgu_ldrrmc';

      -- no team left at all: back to verified so it is dispatched again
      if v_row.status = 'dispatched' and not exists (
           select 1 from public.report_dispatches x
            where x.report_id = v_row.id and x.dispatch_status <> 'declined') then
        perform set_config('uniguard.reason', 'all_declined', true);
        perform set_config('uniguard.note', left(d.team || ': no unit acknowledged', 240), true);
        update public.reports set status = 'verified' where id = v_row.id;
        if v_row.reporter_id is not null then
          insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
          values (v_row.reporter_id, 'Responder reassignment',
                  'The team assigned to ' || coalesce(v_row.code, 'your report') || ' could not respond. A new team is being arranged.',
                  'warning', 'truck', 'report_status', v_row.id);
        end if;
      end if;

      perform public.write_audit('dispatch.no_ack_unrouted', 'report_dispatches', d.id,
        jsonb_build_object('team', d.team, 'unit_id', d.unit_id, 'minutes', p_minutes));
      continue;
    end if;

    -- 3) send the same team to the new unit
    v_eta := case when v_row.lat is not null and v_row.lng is not null then
      now() + make_interval(mins => case when v_dist is null then 15 else greatest(5, ceil(v_dist / 500.0)::int) end)
    end;
    insert into public.report_dispatches
      (report_id, team, instructions, eta, dispatched_by, dispatched_by_name,
       unit_id, target_barangay_id, dispatch_status, auto_dispatched, rerouted_from)
    values
      (d.report_id, d.team, d.instructions, v_eta, null,
       left('Auto-reroute (no response from ' || coalesce(v_old_name, 'the first unit') || ')', 120),
       v_new, coalesce(d.target_barangay_id, v_row.barangay_id), 'sent', true, d.id)
    returning id into v_disp;

    insert into public.report_dispatch_events (dispatch_id, actor, actor_name, action, note)
    values (v_disp, null, 'Auto-reroute', 'dispatched',
            left('Re-sent: ' || coalesce(v_old_name, 'the first unit') || ' did not acknowledge within ' || p_minutes || ' min.', 240));

    perform public.fanout_dispatch(d.report_id, v_disp, d.team, coalesce(d.target_barangay_id, v_row.barangay_id), v_new,
                                   d.instructions, true);

    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select p.id, 'Re-sent: ' || coalesce(v_row.code, ''),
           left(coalesce(v_old_name, d.team) || ' did not acknowledge within ' || p_minutes || ' minutes, so ' ||
             d.team || ' was re-sent to ' || coalesce(v_new_name, 'the next nearest unit') || '.', 240),
           'warning', 'truck', 'dispatch', v_row.id
      from public.profiles p where p.disabled = false and p.role = 'lgu_ldrrmc';

    perform public.write_audit('dispatch.no_ack_rerouted', 'report_dispatches', v_disp,
      jsonb_build_object('from_dispatch', d.id, 'from_unit', d.unit_id, 'to_unit', v_new, 'team', d.team, 'minutes', p_minutes));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

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
  v_brgy    text;
  v_kind    text := lower(coalesce(nullif(trim(p_kind), ''), 'other'));
  v_label   text;
  v_teams   text[];
  v_rep     uuid;
  v_sent    int := 0;
  v_err     text := '';
  v_names   text;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then
    raise insufficient_privilege using message='Sign in with an active account to send an SOS';
  end if;
  if v_kind not in ('medical', 'fire', 'crime', 'rescue', 'other') then
    raise exception 'Unknown SOS type: %', p_kind;
  end if;

  perform public.check_rate_limit('sos', 5, interval '10 minutes');

  select full_name, phone, barangay, barangay_id into v_prof from public.profiles where id = auth.uid();

  -- the barangay where the emergency is; the profile's when that is unknown
  if p_lat is not null and p_lng is not null then
    begin
      perform public.validate_report_coords(p_lat, p_lng);
      v_brgy_id := public.resolve_barangay(p_lat, p_lng);
    exception when others then
      v_brgy_id := null;   -- outside Lingayen
    end;
  end if;
  if v_brgy_id is null then
    v_brgy_id := v_prof.barangay_id;
    if v_brgy_id is null and coalesce(v_prof.barangay, '') <> '' then
      select id into v_brgy_id from public.barangays where name = v_prof.barangay limit 1;
    end if;
  end if;
  select name into v_brgy from public.barangays where id = v_brgy_id;
  v_brgy := coalesce(v_brgy, v_prof.barangay, '');

  v_label := case v_kind when 'medical' then 'Medical emergency' when 'fire' then 'Fire'
                         when 'crime' then 'Crime / violence' when 'rescue' then 'Rescue needed'
                         else 'Other / not sure' end;
  v_teams := case v_kind when 'medical' then array['Ambulance', 'Barangay Response Team']
                         when 'fire'    then array['BFP', 'Barangay Response Team']
                         when 'crime'   then array['PNP', 'Barangay Response Team']
                         when 'rescue'  then array['Rescue Unit', 'Barangay Response Team']
                         else array['Barangay Response Team'] end;

  insert into public.sos_log (user_id, profile_name, profile_phone, barangay, barangay_id, lat, lng, accuracy, note, kind)
  values (auth.uid(),
          coalesce(v_prof.full_name, ''),
          coalesce(v_prof.phone, ''),
          v_brgy,
          v_brgy_id,
          p_lat, p_lng, p_accuracy, coalesce(p_note, ''), v_kind)
  returning * into v_row;
  v_id := v_row.id;

  -- duty officers + the officials of the barangay of the emergency
  with targets as (
    select p.id from public.profiles p
     where not p.disabled and p.removed_at is null
       and (p.role = 'lgu_ldrrmc'
            or (v_brgy_id is not null and p.role = 'barangay_official' and p.barangay_id = v_brgy_id))
  ), ins as (
    insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
    select id,
           'SOS · ' || v_label || ' · ' || coalesce(v_prof.full_name, 'a resident'),
           coalesce(v_prof.phone, '') || ' · ' || v_brgy ||
           ' · ' || coalesce(round(p_accuracy::numeric)::text || ' m', 'no GPS fix'),
           'emergency', 'alert', 'sos', v_id
      from targets
    returning 1
  )
  select count(*) into v_reach from ins;

  -- No GPS: use the registered barangay as a routing hint and leave the map pin empty.
  -- Coordinates outside the service area still go to duty staff for review.
  if v_brgy_id is not null then
    begin
      perform set_config('uniguard.sos_report_id', v_id::text, true);
      insert into public.reports (hazard_type, hazard_other_text, barangay, description, severity, urgency, lat, lng, location_note)
      values (case when v_kind = 'fire' then 'Fire' else 'Others' end,
              case when v_kind = 'fire' then null else 'SOS: ' || v_label end,
              v_brgy,
              'SOS (' || v_label || ')',
              'emergency', 'emergency', p_lat, p_lng,
              case when p_lat is null and p_lng is null then
                'Exact location unavailable. Registered barangay is a routing hint. Confirm the incident address with the duty officer.'
              else '' end)
      returning id into v_rep;
      perform set_config('uniguard.sos_report_id', '', true);

      perform set_config('uniguard.reason', 'sos', true);
      update public.reports
         set status = 'verified', verified_at = now(), verified_by_name = 'SOS', verified_by_role = ''
       where id = v_rep and status = 'reported';

      v_sent := public.ug_auto_dispatch(v_rep, v_teams, 'sos');
      -- stays 'sent' (New) until a duty officer or official acknowledges it
      update public.sos_log set report_id = v_rep where id = v_id;
    exception when others then
      v_err := sqlerrm;
      v_rep := null;
      v_sent := 0;
    end;
  end if;

  -- the teams actually on the report (a team with no free unit is skipped)
  if v_rep is not null then
    select string_agg(d.team, ', ' order by d.dispatched_at) into v_names
      from public.report_dispatches d
     where d.report_id = v_rep and d.dispatch_status not in ('done', 'declined');
  end if;

  perform public.write_audit('sos.received', 'sos_log', v_id,
    jsonb_build_object('lat', p_lat, 'lng', p_lng, 'accuracy', p_accuracy, 'reach', v_reach,
                       'kind', v_kind, 'barangay_id', v_brgy_id, 'report_id', v_rep,
                       'dispatched', v_sent, 'report_error', nullif(v_err, '')));

  return jsonb_build_object('id', v_id, 'reach', v_reach, 'kind', v_kind,
                            'report_id', v_rep, 'dispatched', v_sent, 'team', v_names);
end;
$$;

create or replace function public.fanout_dispatch(
  p_report_id          uuid,
  p_dispatch_id        uuid,
  p_team               text,
  p_target_barangay_id uuid,
  p_unit_id            uuid,
  p_instructions       text,
  p_skip_reporter      boolean default false
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       public.reports;
  v_title     text;
  v_body      text;
  v_unit_tone text;
  v_count     int := 0;
begin
  select * into v_row from public.reports where id = p_report_id;
  if v_row.id is null then
    return 0;
  end if;

  v_title := 'Response dispatched to ' || coalesce(v_row.barangay, 'your barangay');
  v_body  := left(p_team || ': ' || coalesce(p_instructions, ''), 240);

  if p_team = 'Barangay Response Team' then
    v_unit_tone := 'warning';  -- action alert, the barangay's team is going
  else
    v_unit_tone := 'advisory'; -- info, a municipality unit is coming
  end if;

  -- reporter + LGU + the report's barangay. Never another barangay. The
  -- reporter is skipped when advance_report_status already told them.
  with targets as (
    select p.id
      from public.profiles p
     where not p.disabled and p.removed_at is null
       and (
         (p.id = v_row.reporter_id and not p_skip_reporter)
         or p.role in ('lgu_ldrrmc')
         or (p.role = 'barangay_official' and p.barangay_id = coalesce(p_target_barangay_id, v_row.barangay_id))
       )
       and not (p_skip_reporter and p.id is not distinct from v_row.reporter_id)
  ), ins as (
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select id, v_title, v_body, v_unit_tone, 'truck', 'dispatch', v_row.id from targets
    returning 1
  )
  select count(*) into v_count from ins;

  -- the dispatched unit's users (municipality-wide teams only)
  if p_unit_id is not null and p_team <> 'Barangay Response Team' then
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select p.id, 'Incoming dispatch: ' || p_team,
           left(p_team || ' · ' || coalesce(p_instructions, '') ||
                ' · ' || coalesce(v_row.barangay, 'unknown barangay'), 240),
           case when v_row.severity = 'emergency' then 'emergency' else 'warning' end, 'truck', 'unit_dispatch', v_row.id
      from public.profiles p
     where not p.disabled and p.removed_at is null
       and p.role = 'dispatch_team'
       and p.dispatch_unit_id = p_unit_id;
  end if;

  return v_count;
end;
$$;

create or replace function public.queue_emergency_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'sos_log' then
    if new.status = 'sent' then
      insert into public.emergency_delivery(kind,event_id,user_id)
      select 'sos', new.id, p.id from public.profiles p
       where not p.disabled and p.removed_at is null and p.id is distinct from new.user_id
       and (p.role = 'lgu_ldrrmc' or (p.role = 'barangay_official' and
         (p.barangay_id = new.barangay_id or (new.barangay_id is null and nullif(new.barangay,'') = p.barangay))))
      on conflict do nothing;
    end if;
  elsif new.dispatch_status = 'sent' then
    insert into public.emergency_delivery(kind,event_id,user_id)
    select 'dispatch', new.id, p.id from public.profiles p where not p.disabled and p.removed_at is null and
      ((new.unit_id is not null and p.role = 'dispatch_team' and p.dispatch_unit_id = new.unit_id)
       or (new.unit_id is null and p.role = 'barangay_official' and p.barangay_id = new.target_barangay_id))
    on conflict do nothing;
  end if;
  return new;
end $$;

create or replace function public.kick_emergency_delivery()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then return; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'uniguard_emergency_worker_url'$q$ into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'uniguard_emergency_worker_secret'$q$ into v_secret;
  if v_url is null or v_secret is null then return; end if;
  execute 'select net.http_post(url := $1, headers := $2, body := $3)'
    using v_url, jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret), '{}'::jsonb;
exception when others then
  raise warning 'Emergency delivery worker could not be reached (SQLSTATE %)', sqlstate;
end $$;

create or replace function public.emergency_worker_token_ok(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  if coalesce(p_token, '') = '' or to_regnamespace('vault') is null then return false; end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'uniguard_emergency_worker_secret'$q$ into v_secret;
  return v_secret is not null and v_secret = p_token;
exception when others then
  return false;
end $$;

revoke all on function public.kick_emergency_delivery() from public, anon, authenticated;
revoke all on function public.emergency_worker_token_ok(text) from public, anon, authenticated;
grant execute on function public.emergency_worker_token_ok(text) to service_role;

create or replace function public.wake_emergency_delivery_after_enqueue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from queued_jobs) then
    perform public.kick_emergency_delivery();
  end if;
  return null;
end;
$$;
revoke all on function public.wake_emergency_delivery_after_enqueue() from public, anon, authenticated;

drop trigger if exists emergency_delivery_wake on public.emergency_delivery;
create trigger emergency_delivery_wake after insert on public.emergency_delivery
referencing new table as queued_jobs for each statement
execute function public.wake_emergency_delivery_after_enqueue();

create or replace function public.claim_emergency_delivery()
returns setof public.emergency_delivery language sql security definer set search_path = public as $$
  with ready as (
    select id from public.emergency_delivery where status in ('pending','processing')
      and next_attempt_at <= now()
      order by urgent desc, next_attempt_at, id
      limit 20 for update skip locked
  )
  update public.emergency_delivery j set status='processing', attempts=j.attempts+1,
    next_attempt_at=now()+interval '5 minutes', lease_id=gen_random_uuid()
  from ready where j.id=ready.id returning j.*;
$$;

create or replace function public.finish_emergency_delivery(
  p_id uuid, p_lease uuid, p_outcome text, p_channel text, p_reason text
)
returns void language plpgsql security definer set search_path = public as $$
declare j public.emergency_delivery;
begin
  if p_outcome is null or p_outcome not in ('sent','failed','retry','cancelled') then
    raise exception 'Invalid delivery outcome';
  end if;
  update public.emergency_delivery set
    status = case when p_outcome='retry' then case when attempts < 3 then 'pending' else 'failed' end else p_outcome end,
    channel=p_channel, reason=left(p_reason,160), next_attempt_at=now()+interval '30 seconds'
  where id=p_id and lease_id=p_lease and status='processing' returning * into j;
  if j.status='failed' then
    insert into public.notifications(user_id,title,body,tone,icon,type,sos_id,report_id)
    select p.id, 'Emergency alert delivery failed',
      'A staff member could not be reached by push or SMS. Open the incident and confirm receipt by duty phone or radio.',
      'emergency','alert','emergency_delivery_failure',
      case when j.kind='sos' then j.event_id end,
      case when j.kind='dispatch' then (select report_id from public.report_dispatches where id=j.event_id)
           when j.kind in ('report_review','dispatch_gap','hazard_confirmed') then j.event_id end
    from public.profiles p where p.role='lgu_ldrrmc' and not p.is_super_admin and not p.disabled and p.removed_at is null;
    perform public.write_audit('emergency_delivery.failed','emergency_delivery',j.id,
      jsonb_build_object('event_id',j.event_id,'kind',j.kind,'recipient_id',j.user_id,'reason',j.reason));
  end if;
end $$;

commit;
