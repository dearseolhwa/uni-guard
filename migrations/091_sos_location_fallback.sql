-- =============================================================================
--  UniGuard · 091 · SOS without live location: landmark, home address, updates
-- =============================================================================
--  Run after 090.
--
--  An SOS always sends at once, location or not. Where responders go is the
--  best place known, in this order:
--    1. live GPS from the phone                         (location_source 'gps')
--    2. a landmark the sender (or an official) adds     ('landmark')
--    3. the sender's registered home address / pin      ('home')
--    4. the sender's registered barangay                ('barangay')
--  The Barangay Response Team goes with every SOS type already (084); that
--  does not change.
--
--  · profiles: home_address, home_landmark and an optional home pin
--    (home_lat, home_lng), from sign-up and Settings (set_my_home).
--  · submit_sos: with no GPS it uses the home pin for the map, and puts the
--    home address in the report so every team's instructions carry it.
--  · update_sos_location: the sender shares their GPS later or adds a
--    landmark; duty officers can edit the landmark (after a call, say). The
--    linked report moves with it and the officials and teams are told.
-- =============================================================================
begin;

-- --------------------------------------------------------------- the columns
alter table public.profiles add column if not exists home_address  text not null default '';
alter table public.profiles add column if not exists home_landmark text not null default '';
alter table public.profiles add column if not exists home_lat      double precision;
alter table public.profiles add column if not exists home_lng      double precision;

alter table public.sos_log add column if not exists landmark            text not null default '';
alter table public.sos_log add column if not exists location_source     text not null default 'gps';
alter table public.sos_log add column if not exists location_updated_at timestamptz;
update public.sos_log set location_source = 'barangay' where location_source = 'gps' and (lat is null or lng is null);
alter table public.sos_log drop constraint if exists sos_log_location_source_check;
alter table public.sos_log add constraint sos_log_location_source_check
  check (location_source in ('gps', 'landmark', 'home', 'barangay'));

-- the place in words, for notes and instructions
create or replace function public.sos_home_text(p_address text, p_landmark text)
returns text language sql immutable as $$
  select nullif(concat_ws(' · ', nullif(trim(coalesce(p_address, '')), ''), nullif(trim(coalesce(p_landmark, '')), '')), '');
$$;

-- --------------------------------------------------- the resident's home
create or replace function public.set_my_home(
  p_address  text,
  p_landmark text default '',
  p_lat      double precision default null,
  p_lng      double precision default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active_user() then
    raise insufficient_privilege using message = 'Sign in with an active account';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'Give both latitude and longitude for the home pin, or neither';
  end if;
  if p_lat is not null then perform public.validate_report_coords(p_lat, p_lng); end if;
  update public.profiles
     set home_address = left(trim(coalesce(p_address, '')), 200),
         home_landmark = left(trim(coalesce(p_landmark, '')), 200),
         home_lat = p_lat, home_lng = p_lng, updated_at = now()
   where id = auth.uid();
  return jsonb_build_object('home_address', left(trim(coalesce(p_address, '')), 200), 'home_lat', p_lat, 'home_lng', p_lng);
end;
$$;
revoke all on function public.set_my_home(text, text, double precision, double precision) from public, anon;
grant execute on function public.set_my_home(text, text, double precision, double precision) to authenticated;

-- sign-up: keep the home address and pin given on the form (metadata is
-- convenience only; the role is still forced to citizen)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_barangay text;
  v_barangay_id uuid;
  v_lat double precision;
  v_lng double precision;
begin
  v_barangay := coalesce(new.raw_user_meta_data->>'barangay', '');
  if v_barangay <> '' then
    select id into v_barangay_id from public.barangays where name = v_barangay limit 1;
  end if;
  begin
    v_lat := nullif(new.raw_user_meta_data->>'home_lat', '')::double precision;
    v_lng := nullif(new.raw_user_meta_data->>'home_lng', '')::double precision;
    if v_lat is null or v_lng is null then v_lat := null; v_lng := null;
    else perform public.validate_report_coords(v_lat, v_lng); end if;
  exception when others then
    v_lat := null; v_lng := null;
  end;

  insert into public.profiles (id, full_name, email, phone, barangay, barangay_id, role,
                               home_address, home_landmark, home_lat, home_lng)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    v_barangay,
    v_barangay_id,
    /* role is never taken from the client or from user metadata */
    'citizen',
    left(trim(coalesce(new.raw_user_meta_data->>'home_address', '')), 200),
    left(trim(coalesce(new.raw_user_meta_data->>'home_landmark', '')), 200),
    v_lat, v_lng
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ------------------------------------------- reports: the SOS location step
-- 057's edit guard, plus one case: update_sos_location may move an SOS
-- report's pin and location note (and, through route_report_update, its
-- barangay) after the reporter's 15-minute edit window.
create or replace function public.guard_report_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text;
  v_reason text := coalesce(current_setting('uniguard.reason', true), '');
  v_free   text[] := array['status','verified_at','verified_by','verified_by_name','verified_by_role',
                           'updated_at','escalation_status'];
  v_place  text[] := array['lat','lng','location_note','barangay','barangay_id','updated_at'];
begin
  if auth.uid() is null then
    return new;
  end if;

  if v_reason in ('auto_corroboration', 'all_declined', 'sos', 'auto_dispatch')
     and (to_jsonb(new) - v_free) = (to_jsonb(old) - v_free) then
    return new;
  end if;

  if v_reason = 'sos_location' and (to_jsonb(new) - v_place) = (to_jsonb(old) - v_place) then
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

-- ------------------------------------------------------------- submit_sos
-- 084's submit_sos, plus the home fallback when the phone shares no GPS.
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
  v_lat     double precision := p_lat;
  v_lng     double precision := p_lng;
  v_source  text := 'gps';
  v_home    text;
  v_note    text := '';
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then
    raise insufficient_privilege using message='Sign in with an active account to send an SOS';
  end if;
  if v_kind not in ('medical', 'fire', 'crime', 'rescue', 'other') then
    raise exception 'Unknown SOS type: %', p_kind;
  end if;

  perform public.check_rate_limit('sos', 5, interval '10 minutes');

  select full_name, phone, barangay, barangay_id, home_address, home_landmark, home_lat, home_lng
    into v_prof from public.profiles where id = auth.uid();
  v_home := public.sos_home_text(v_prof.home_address, v_prof.home_landmark);

  -- no live location: the registered home pin, then the home address in words,
  -- then the registered barangay
  if p_lat is null or p_lng is null then
    v_lat := null; v_lng := null;
    if v_prof.home_lat is not null and v_prof.home_lng is not null then
      v_lat := v_prof.home_lat; v_lng := v_prof.home_lng; v_source := 'home';
    elsif v_home is not null then
      v_source := 'home';
    else
      v_source := 'barangay';
    end if;
  end if;

  -- the barangay where the emergency is; the profile's when that is unknown
  if v_lat is not null and v_lng is not null then
    begin
      perform public.validate_report_coords(v_lat, v_lng);
      v_brgy_id := public.resolve_barangay(v_lat, v_lng);
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

  v_note := case v_source
    when 'gps' then ''
    when 'home' then 'No live location. Go to the registered home: ' || coalesce(v_home, 'pin on the map') ||
                     '. Confirm the incident address with the sender.'
    else 'Exact location unavailable. Registered barangay is a routing hint. Confirm the incident address with the duty officer.'
  end;

  insert into public.sos_log (user_id, profile_name, profile_phone, barangay, barangay_id, lat, lng, accuracy, note, kind,
                              landmark, location_source, location_updated_at)
  values (auth.uid(),
          coalesce(v_prof.full_name, ''),
          coalesce(v_prof.phone, ''),
          v_brgy,
          v_brgy_id,
          v_lat, v_lng, case when v_source = 'gps' then p_accuracy end, coalesce(p_note, ''), v_kind,
          case when v_source = 'home' then coalesce(v_home, '') else '' end, v_source, now())
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
           coalesce(v_prof.phone, '') || ' · ' || v_brgy || ' · ' ||
           case v_source when 'gps' then coalesce(round(p_accuracy::numeric)::text || ' m', 'GPS')
                         when 'home' then 'no GPS · registered home: ' || coalesce(v_home, 'pin')
                         else 'no GPS fix' end,
           'emergency', 'alert', 'sos', v_id
      from targets
    returning 1
  )
  select count(*) into v_reach from ins;

  -- No GPS and no home pin: use the registered barangay as a routing hint and
  -- leave the map pin empty. Coordinates outside the service area still go to
  -- duty staff for review.
  if v_brgy_id is not null then
    begin
      perform set_config('uniguard.sos_report_id', v_id::text, true);
      insert into public.reports (hazard_type, hazard_other_text, barangay, description, severity, urgency, lat, lng, location_note)
      values (case when v_kind = 'fire' then 'Fire' else 'Others' end,
              case when v_kind = 'fire' then null else 'SOS: ' || v_label end,
              v_brgy,
              -- the description goes into every team's instructions
              'SOS (' || v_label || ')' ||
                case when v_source = 'home' then ' · No live location: go to the registered home, ' || coalesce(v_home, 'pinned on the map') || '.' else '' end,
              'emergency', 'emergency', v_lat, v_lng, v_note)
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
                       'dispatched', v_sent, 'report_error', nullif(v_err, ''), 'location_source', v_source));

  return jsonb_build_object('id', v_id, 'reach', v_reach, 'kind', v_kind,
                            'report_id', v_rep, 'dispatched', v_sent, 'team', v_names,
                            'location_source', v_source);
end;
$$;

-- --------------------------------------------- update an SOS's location later
-- The sender may share GPS once it is on, or add / correct a landmark. Duty
-- officers of the SOS's barangay and the LGU may edit the landmark. The
-- linked report follows (pin, note and, through route_report_update, its
-- barangay), and the officials, the teams on it and the sender are told.
create or replace function public.update_sos_location(
  p_sos_id   uuid,
  p_lat      double precision default null,
  p_lng      double precision default null,
  p_accuracy double precision default null,
  p_landmark text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row      public.sos_log;
  v_sender   boolean;
  v_gps      boolean := p_lat is not null and p_lng is not null;
  v_in       boolean := false;
  v_landmark text := nullif(left(trim(coalesce(p_landmark, '')), 200), '');
  v_source   text;
  v_note     text;
  v_by       text;
  v_body     text;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then
    raise insufficient_privilege using message = 'Sign in with an active account';
  end if;
  select * into v_row from public.sos_log where id = p_sos_id for update;
  if v_row.id is null then raise exception 'That SOS does not exist'; end if;
  v_sender := v_row.user_id = auth.uid();
  if not v_sender and not public.is_sos_duty_staff(v_row.barangay_id, v_row.barangay) then
    raise insufficient_privilege using message = 'Only the sender or the duty officers can update this SOS';
  end if;
  if v_gps and not v_sender then
    raise insufficient_privilege using message = 'Only the sender can share their live location';
  end if;
  if not v_gps and v_landmark is null then
    raise exception 'Share a location or type a landmark';
  end if;
  if v_gps then
    begin
      perform public.validate_report_coords(p_lat, p_lng);
      v_in := true;
    exception when others then
      v_in := false;   -- outside Lingayen: kept on the SOS for the duty officer, not moved on the report
    end;
  end if;

  v_source := case when v_gps then 'gps'
                   when v_row.location_source = 'gps' then 'gps'
                   else 'landmark' end;
  update public.sos_log
     set lat = case when v_gps then p_lat else lat end,
         lng = case when v_gps then p_lng else lng end,
         accuracy = case when v_gps then p_accuracy else accuracy end,
         landmark = coalesce(v_landmark, landmark),
         location_source = v_source,
         location_updated_at = now()
   where id = p_sos_id
  returning * into v_row;

  v_note := case
    when v_row.location_source = 'gps' then coalesce('Landmark: ' || nullif(v_row.landmark, ''), '')
    else 'No live location. Landmark from the ' || case when v_sender then 'sender' else 'duty officer' end || ': ' ||
         v_row.landmark || '. Confirm the incident address with the sender.'
  end;

  if v_row.report_id is not null then
    perform set_config('uniguard.reason', 'sos_location', true);
    update public.reports
       set lat = case when v_gps and v_in then p_lat else lat end,
           lng = case when v_gps and v_in then p_lng else lng end,
           location_note = left(v_note, 500)
     where id = v_row.report_id;
    perform set_config('uniguard.reason', '', true);
  end if;

  select full_name into v_by from public.profiles where id = auth.uid();
  v_body := case when v_gps then 'Live location shared' ||
                   case when v_in then '' else ' (outside Lingayen: call the sender)' end
                 else 'Landmark: ' || v_row.landmark end ||
            case when v_sender then '' else ' · by ' || coalesce(v_by, 'a duty officer') end;

  -- officials, the users of every unit on the report, and the sender (when
  -- someone else changed it); never the person who made the change
  insert into public.notifications (user_id, title, body, tone, icon, type, sos_id, report_id)
  select p.id, 'SOS location updated · ' || coalesce(nullif(v_row.profile_name, ''), 'resident'),
         left(v_body, 240), 'emergency', 'pin', 'sos', v_row.id, v_row.report_id
    from public.profiles p
   where not p.disabled and p.removed_at is null and p.id is distinct from auth.uid()
     and (p.role = 'lgu_ldrrmc'
          or (p.role = 'barangay_official' and v_row.barangay_id is not null and p.barangay_id = v_row.barangay_id)
          or (p.role = 'dispatch_team' and v_row.report_id is not null and p.dispatch_unit_id in (
                select d.unit_id from public.report_dispatches d
                 where d.report_id = v_row.report_id and d.dispatch_status not in ('done', 'declined')))
          or (p.id = v_row.user_id and not v_sender));

  perform public.write_audit('sos.location_updated', 'sos_log', v_row.id,
    jsonb_build_object('gps', v_gps, 'inside', v_in, 'landmark', v_row.landmark, 'by_sender', v_sender));

  return jsonb_build_object('id', v_row.id, 'lat', v_row.lat, 'lng', v_row.lng, 'landmark', v_row.landmark,
                            'location_source', v_row.location_source, 'report_moved', v_gps and v_in);
end;
$$;
revoke all on function public.update_sos_location(uuid, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.update_sos_location(uuid, double precision, double precision, double precision, text) to authenticated;

commit;
