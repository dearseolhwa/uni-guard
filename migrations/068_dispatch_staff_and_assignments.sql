begin;

alter table public.profiles add column if not exists removed_at timestamptz;
alter table public.dispatch_units
  add column if not exists response_capabilities text not null default '',
  add column if not exists ambulance_available boolean not null default true;
-- Preserve existing hospital dispatch eligibility. New hospitals explicitly
-- opt in to ambulance deployment during setup.

create or replace function public.guard_staff_account_lifecycle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.removed_at is not null and
       (new.removed_at is distinct from old.removed_at or new.disabled is distinct from true
        or new.role is distinct from 'citizen' or new.is_super_admin) then
      raise exception 'This account has been removed';
    end if;
    if new.removed_at is distinct from old.removed_at and
       (not public.is_super_admin() or not new.disabled or new.role <> 'citizen') then
      raise exception 'Only a Super Admin may remove an account';
    end if;
    if new.role = 'lgu_ldrrmc' and new.is_super_admin and not new.disabled then
      return new;
    end if;
  end if;
  if old.role = 'lgu_ldrrmc' and old.is_super_admin and not old.disabled then
    perform pg_advisory_xact_lock(68001);
    if not exists (select 1 from public.profiles p where p.id <> old.id
                   and p.role = 'lgu_ldrrmc' and p.is_super_admin and not p.disabled) then
      raise exception 'The last active Super Admin cannot be disabled, demoted, or removed';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists profiles_account_lifecycle on public.profiles;
create trigger profiles_account_lifecycle before update or delete on public.profiles
for each row execute function public.guard_staff_account_lifecycle();

create or replace function public.remove_staff_account(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(68001);
  if not public.is_super_admin() or auth.uid() = p_user_id then
    raise exception 'Another active Super Admin must remove this account';
  end if;
  update public.profiles
     set disabled = true, removed_at = now(), role = 'citizen', is_super_admin = false,
         dispatch_unit_id = null, unit_role = '', barangay_id = null, barangay = '', updated_at = now()
   where id = p_user_id and removed_at is null;
  if not found then
    if exists (select 1 from public.profiles where id = p_user_id and removed_at is not null) then
      return;
    end if;
    raise exception 'Account not found';
  end if;
  update auth.users set banned_until = '9999-12-31 00:00:00+00', updated_at = now() where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  perform public.write_audit('user.removed', 'profiles', p_user_id, '{}'::jsonb);
end $$;

revoke all on function public.remove_staff_account(uuid) from public, anon;
grant execute on function public.remove_staff_account(uuid) to authenticated;

-- Restrict existing sessions with unexpired JWTs as soon as removal commits.
create or replace function public.account_is_removed()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and removed_at is not null);
$$;
revoke all on function public.account_is_removed() from public;
grant execute on function public.account_is_removed() to authenticated;

do $$
declare target record;
begin
  for target in select tablename from pg_tables where schemaname = 'public' and rowsecurity loop
    execute format('drop policy if exists reject_removed_account on public.%I', target.tablename);
    execute format('create policy reject_removed_account on public.%I as restrictive for all to authenticated using (not (select public.account_is_removed())) with check (not (select public.account_is_removed()))', target.tablename);
  end loop;
end $$;

alter table public.report_dispatches add column if not exists assignment_role text
  check (assignment_role in ('lead', 'support'));

with ranked as (
  select id, row_number() over (
    partition by report_id order by dispatched_at, id
  ) as position from public.report_dispatches
)
update public.report_dispatches d
   set assignment_role = case when ranked.position = 1 then 'lead' else 'support' end
  from ranked where d.id = ranked.id and d.assignment_role is null;

alter table public.report_dispatches alter column assignment_role set not null;

create unique index if not exists report_dispatches_one_lead_idx
  on public.report_dispatches(report_id) where assignment_role = 'lead';

create or replace function public.classify_report_dispatch()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.reports where id = new.report_id for update;

  if new.team = 'Ambulance' and new.unit_id is not null and not exists (
    select 1 from public.dispatch_units
    where id = new.unit_id and active and unit_type = 'Hospital' and ambulance_available
  ) then raise exception 'That hospital has no ambulance available for dispatch'; end if;

  new.assignment_role := case when exists (
    select 1 from public.report_dispatches where report_id = new.report_id and assignment_role = 'lead'
  ) then 'support' else 'lead' end;
  return new;
end $$;

drop trigger if exists report_dispatches_classify on public.report_dispatches;
create trigger report_dispatches_classify before insert on public.report_dispatches
for each row execute function public.classify_report_dispatch();

create or replace function public.save_dispatch_unit(
  p_id uuid, p_name text, p_type text, p_contact text, p_address text,
  p_active boolean, p_capabilities text, p_ambulance boolean, p_accepting boolean
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_unit public.dispatch_units;
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Only an active Super Admin may save dispatch units';
  end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'Enter a unit name'; end if;
  if p_id is null then
    perform pg_advisory_xact_lock(68002);
    v_result := public.create_dispatch_unit(p_name, p_type, p_contact, p_address);
    if coalesce((v_result ->> 'already_exists')::boolean, false) then
      raise exception 'An active unit already uses that name';
    end if;
    p_id := (v_result ->> 'id')::uuid;
  end if;
  update public.dispatch_units
     set name = btrim(p_name), contact_number = p_contact, address = p_address,
         active = p_active, response_capabilities = coalesce(btrim(p_capabilities), ''),
         ambulance_available = case when unit_type = 'Hospital' then coalesce(p_ambulance, false) else false end
   where id = p_id returning * into v_unit;
  if not found then raise exception 'Dispatch unit not found'; end if;
  if v_unit.unit_type = 'Hospital' and p_accepting is not null then
    insert into public.hospital_capacity (unit_id, accepting) values (p_id, p_accepting)
    on conflict (unit_id) do update set accepting = excluded.accepting, updated_at = now();
  end if;
  perform public.write_audit('dispatch_unit.updated', 'dispatch_units', p_id,
    jsonb_build_object('active', v_unit.active, 'type', v_unit.unit_type, 'ambulance_available', v_unit.ambulance_available));
  return p_id;
end $$;

revoke all on function public.save_dispatch_unit(uuid, text, text, text, text, boolean, text, boolean, boolean) from public, anon;
grant execute on function public.save_dispatch_unit(uuid, text, text, text, text, boolean, text, boolean, boolean) to authenticated;

-- Dispatches originating from an acknowledged help request link both records.
alter table public.dispatch_help_requests
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists support_dispatch_id uuid references public.report_dispatches(id) on delete set null;

create or replace function public.dispatch_requested_support(
  p_request_id uuid, p_report_id uuid, p_team text, p_instructions text,
  p_eta timestamptz, p_unit_id uuid, p_target_barangay_id uuid, p_equipment_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_request public.dispatch_help_requests;
  v_result jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()
    and role = 'lgu_ldrrmc' and not disabled and not is_super_admin) then
    raise exception 'Only active LDRRMO staff may assign requested backup';
  end if;
  select * into v_request from public.dispatch_help_requests where id = p_request_id for update;
  if v_request.id is null or v_request.status <> 'acknowledged' or v_request.support_dispatch_id is not null
    or not exists (select 1 from public.report_dispatches where id = v_request.dispatch_id and report_id = p_report_id)
  then raise exception 'Choose an acknowledged request for this incident that has no backup assigned'; end if;
  v_result := public.dispatch_report_v2(p_report_id, p_team, p_instructions, p_eta, p_unit_id, p_target_barangay_id, p_equipment_ids);
  update public.dispatch_help_requests set support_dispatch_id = (v_result ->> 'id')::uuid where id = p_request_id;
  return v_result;
end $$;

revoke all on function public.dispatch_requested_support(uuid, uuid, text, text, timestamptz, uuid, uuid, uuid[]) from public, anon;
grant execute on function public.dispatch_requested_support(uuid, uuid, text, text, timestamptz, uuid, uuid, uuid[]) to authenticated;

-- Keep the existing dispatch and reroute APIs available to older clients.

create or replace function public.create_dispatch_unit(
  p_name           text,
  p_unit_type      text,
  p_contact_number text default '',
  p_address        text default '',
  p_lat            double precision default null,
  p_lng            double precision default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_id       uuid;
  v_existing uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if not public.is_super_admin() then raise exception 'Only a Super Admin can create dispatch units'; end if;
  perform pg_advisory_xact_lock(68002);
  if p_unit_type is null or p_unit_type not in ('BFP','PNP','Rescue','Hospital') then
    raise exception 'Unknown unit type';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'A unit name is required'; end if;

  -- dedup: if a unit with this exact name already exists, return its id
  -- instead of creating a duplicate. The UI can then invite the admin
  -- into the existing unit.
  select id into v_existing
    from public.dispatch_units
   where name = trim(p_name)
     and active = true
   limit 1;

  if v_existing is not null then
    perform public.write_audit('dispatch_unit.duplicate_attempt', 'dispatch_units', v_existing,
      jsonb_build_object('name', p_name, 'unit_type', p_unit_type, 'note', 'Unit already exists; returned existing id'));
    return jsonb_build_object('id', v_existing, 'name', p_name, 'unit_type', p_unit_type, 'already_exists', true);
  end if;

  insert into public.dispatch_units (name, unit_type, contact_number, address, lat, lng, created_by, status, active)
  values (trim(p_name), p_unit_type, p_contact_number, p_address, p_lat, p_lng, auth.uid(), 'available', true)
  returning id into v_id;

  perform public.write_audit('dispatch_unit.created', 'dispatch_units', v_id,
    jsonb_build_object('name', p_name, 'unit_type', p_unit_type));

  return jsonb_build_object('id', v_id, 'name', p_name, 'unit_type', p_unit_type);
end;
$$;

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
       where u.active = true and u.unit_type = v_type
         and (v_type <> 'Hospital' or u.ambulance_available) and u.status <> 'off_duty'
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
       and u.id not in (select x.unit_id from public.report_dispatches x
                         where x.report_id = d.report_id and x.team = d.team and x.unit_id is not null)
     order by (u.status = 'available') desc, dist asc nulls last, u.created_at
     limit 1;

    if v_new is null then
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
    v_eta := now() + make_interval(mins => case when v_dist is null then 15 else greatest(5, ceil(v_dist / 500.0)::int) end);
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

create or replace function public.dispatch_report_v2(
  p_report_id          uuid,
  p_team               text,
  p_instructions       text,
  p_eta                timestamptz,
  p_unit_id            uuid default null,
  p_target_barangay_id uuid default null,
  p_equipment_ids      uuid[] default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_role        text;
  v_brgy        uuid;
  v_name        text;
  v_row         public.reports;
  v_disp_id     uuid;
  v_team        text;
  v_unit_id     uuid;
  v_unit_type   text;
  v_target_brgy uuid;
  v_notified    int := 0;
  v_eq          uuid;
  v_eq_ids      uuid[];
  v_first       boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  select role, barangay_id, coalesce(full_name, '')
    into v_role, v_brgy, v_name
    from public.profiles where id = auth.uid() and not disabled;

  if v_role is null or v_role not in ('barangay_official', 'lgu_ldrrmc') then
    raise exception 'Only officials and LGU can dispatch a response';
  end if;

  if p_team is null or p_team not in ('MDRRMO Rescue','BFP','PNP','Barangay Response Team','Ambulance','Rescue Unit') then
    raise exception 'Choose a responder team from the list';
  end if;
  if coalesce(trim(p_instructions), '') = '' then
    raise exception 'Write what the responders are supposed to do';
  end if;
  if p_eta is null or p_eta < now() - interval '5 minutes' then
    raise exception 'The ETA must be a time from now onward';
  end if;

  -- lock the report so two dispatchers cannot both run the first-dispatch step
  select * into v_row from public.reports where id = p_report_id for update;
  if v_row.id is null then
    raise exception 'That report does not exist';
  end if;

  if v_role = 'barangay_official' and v_row.barangay_id is distinct from v_brgy then
    raise exception 'That report is outside your barangay';
  end if;
  if v_row.status not in ('verified', 'dispatched') then
    raise exception 'Verify the report before dispatching a response (it is "%")', v_row.status;
  end if;

  v_team := p_team;

  if v_team = 'Barangay Response Team' then
    v_target_brgy := v_row.barangay_id;
    if v_target_brgy is null then raise exception 'This report has no barangay response team'; end if;
    if p_target_barangay_id is not null and p_target_barangay_id is distinct from v_row.barangay_id then
      raise exception 'A Barangay Response Team dispatch can only target the report''s barangay';
    end if;
    if v_role = 'barangay_official' and v_target_brgy is distinct from v_brgy then
      raise exception 'You cannot dispatch another barangay''s Response Team';
    end if;
    v_unit_id := null;
  else
    if p_unit_id is null then
      raise exception 'Pick a unit to dispatch';
    end if;
    select id, unit_type into v_unit_id, v_unit_type from public.dispatch_units
     where id = p_unit_id and active = true;
    if v_unit_id is null then
      raise exception 'That unit does not exist or is not active';
    end if;
    if not (
      (v_team = 'BFP'       and v_unit_type = 'BFP') or
      (v_team = 'PNP'       and v_unit_type = 'PNP') or
      (v_team in ('Rescue Unit','MDRRMO Rescue') and v_unit_type = 'Rescue') or
      (v_team = 'Ambulance' and v_unit_type = 'Hospital')
    ) then
      raise exception 'The unit type does not match the team you picked';
    end if;
    v_target_brgy := v_row.barangay_id;
  end if;

  if exists (
    select 1 from public.report_dispatches d where d.report_id = p_report_id
      and d.unit_id is not distinct from v_unit_id
      and d.target_barangay_id is not distinct from v_target_brgy
      and d.dispatch_status not in ('done', 'declined')
  ) then raise exception 'That team already has an open assignment for this incident'; end if;

  -- equipment: each id once, owned by the chosen team, available + deployable.
  -- FOR UPDATE so the same item cannot be deployed by two dispatches at once.
  if p_equipment_ids is not null then
    v_eq_ids := array(select distinct e from unnest(p_equipment_ids) as e where e is not null);
    foreach v_eq in array v_eq_ids loop
      perform 1 from public.dispatch_equipment e
       where e.id = v_eq
         and e.status = 'available'
         and e.condition not in ('needs_repair','missing','out_of_service')
         and (
           (v_team = 'Barangay Response Team' and e.owner_barangay_id = v_target_brgy)
           or (v_team <> 'Barangay Response Team' and e.owner_unit_id = v_unit_id)
         )
       for update;
      if not found then
        raise exception 'Equipment % is not available, not in a deployable condition, or not owned by the chosen team', v_eq;
      end if;
    end loop;
  end if;

  insert into public.report_dispatches
    (report_id, team, instructions, eta, dispatched_by, dispatched_by_name,
     unit_id, target_barangay_id, dispatch_status)
  values
    (p_report_id, v_team, trim(p_instructions), p_eta, auth.uid(), v_name,
     v_unit_id, v_target_brgy, 'sent')
  returning id into v_disp_id;

  if v_eq_ids is not null then
    foreach v_eq in array v_eq_ids loop
      insert into public.dispatch_equipment_use (dispatch_id, equipment_id)
      values (v_disp_id, v_eq);
      update public.dispatch_equipment
         set status = 'deployed', last_checked_at = now()
       where id = v_eq;
    end loop;
  end if;

  -- first dispatch moves the report to dispatched (and tells the reporter);
  -- extra teams add a record only.
  v_first := (v_row.status = 'verified');
  if v_first then
    perform public.advance_report_status(
      p_report_id, 'dispatched', v_team || ': ' || left(trim(p_instructions), 120));
  end if;

  perform public.write_audit('report.dispatched', 'reports', p_report_id,
    jsonb_build_object('dispatch_id', v_disp_id, 'team', v_team,
                       'unit_id', v_unit_id, 'target_barangay_id', v_target_brgy,
                       'eta', p_eta, 'instructions', left(trim(p_instructions), 300),
                       'equipment_ids', to_jsonb(coalesce(v_eq_ids, '{}'::uuid[]))));

  insert into public.report_dispatch_events (dispatch_id, actor, actor_name, action, note)
  values (v_disp_id, auth.uid(), v_name, 'dispatched', left(trim(p_instructions), 240));

  v_notified := public.fanout_dispatch(p_report_id, v_disp_id, v_team, v_target_brgy, v_unit_id,
                                       trim(p_instructions), v_first);

  return jsonb_build_object('id', v_disp_id, 'team', v_team, 'eta', p_eta,
                            'dispatched_by', v_name, 'dispatched_at', now(),
                            'unit_id', v_unit_id, 'target_barangay_id', v_target_brgy,
                            'notified', v_notified);
end;
$$;

-- An SOS without a usable GPS fix can be routed once staff have confirmed
-- the location and opened a matching incident report.
create or replace function public.link_sos_response_report(p_sos_id uuid, p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid()
                 and role = 'lgu_ldrrmc' and not disabled and not is_super_admin) then
    raise exception 'Only active LDRRMO staff may link an SOS response';
  end if;
  if not exists (select 1 from public.reports where id = p_report_id
                 and status in ('reported', 'verified', 'dispatched')) then
    raise exception 'Choose an open incident report';
  end if;
  update public.sos_log set report_id = p_report_id
   where id = p_sos_id and report_id is null and status <> 'resolved';
  if not found then raise exception 'This SOS no longer needs a report link'; end if;
  perform public.write_audit('sos.report_linked', 'sos_log', p_sos_id, jsonb_build_object('report_id', p_report_id));
end $$;

revoke all on function public.link_sos_response_report(uuid, uuid) from public, anon;
grant execute on function public.link_sos_response_report(uuid, uuid) to authenticated;

commit;
