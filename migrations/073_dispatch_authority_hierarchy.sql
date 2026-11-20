begin;

create or replace function public.is_mdrrmo_duty_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id=auth.uid()
    and role='lgu_ldrrmc' and not is_super_admin and not disabled)
    and not public.account_session_blocked();
$$;
revoke all on function public.is_mdrrmo_duty_staff() from public, anon;
grant execute on function public.is_mdrrmo_duty_staff() to authenticated;

create table if not exists public.barangay_dispatch_requests (
  report_id uuid primary key references public.reports(id) on delete cascade,
  barangay_id uuid not null references public.barangays(id),
  requested_by uuid references public.profiles(id) on delete set null,
  details text not null check(char_length(details) between 1 and 500),
  requested_at timestamptz not null default now(),
  assigned_dispatch_id uuid references public.report_dispatches(id) on delete set null
);
alter table public.barangay_dispatch_requests enable row level security;
drop policy if exists barangay_dispatch_requests_read on public.barangay_dispatch_requests;
create policy barangay_dispatch_requests_read on public.barangay_dispatch_requests for select to authenticated using (
  not public.account_session_blocked() and
  (public.is_lgu() or (public.is_official() and barangay_id=public.my_barangay_id()))
);
grant select on public.barangay_dispatch_requests to authenticated;

create or replace function public.request_municipal_dispatch(p_report_id uuid,p_details text)
returns void language plpgsql security definer set search_path=public as $$
declare incident public.reports;
begin
  if not public.is_official() or public.account_session_blocked() then
    raise insufficient_privilege using message='Only active barangay officials may request municipal dispatch';
  end if;
  select * into incident from public.reports where id=p_report_id for update;
  if incident.id is null or incident.barangay_id is null or incident.barangay_id is distinct from public.my_barangay_id() then
    raise exception 'Choose a report in your own barangay';
  end if;
  if incident.status not in ('verified','dispatched') then raise exception 'Verify the report before requesting municipal dispatch'; end if;
  if coalesce(char_length(btrim(p_details)),0) not between 1 and 500 then raise exception 'Enter a reason of 1 to 500 characters'; end if;

  insert into public.barangay_dispatch_requests(report_id,barangay_id,requested_by,details)
  values (p_report_id,incident.barangay_id,auth.uid(),btrim(p_details))
  on conflict(report_id) do nothing;
  if not found then raise exception 'This incident already has a municipal dispatch request'; end if;
  insert into public.notifications(user_id,title,body,tone,icon,type,report_id)
  select id,'Municipal dispatch requested',left(btrim(p_details),240),
    'warning','truck','dispatch_request',p_report_id
  from public.profiles where role='lgu_ldrrmc' and not disabled and not is_super_admin;
  perform public.write_audit('dispatch.municipal_requested','reports',p_report_id,
    jsonb_build_object('barangay_id',incident.barangay_id));
end $$;
revoke all on function public.request_municipal_dispatch(uuid,text) from public, anon;
grant execute on function public.request_municipal_dispatch(uuid,text) to authenticated;

-- Associate the request with the first staff-issued municipal assignment after submission.
create or replace function public.assign_municipal_dispatch_request()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.unit_id is not null and public.is_mdrrmo_duty_staff() then
    update public.barangay_dispatch_requests set assigned_dispatch_id=new.id
      where report_id=new.report_id and assigned_dispatch_id is null;
    if found then
      insert into public.notifications(user_id,title,body,tone,icon,type,report_id)
      select p.id,'Municipal team assigned',new.team || ' was assigned to the incident.',
        'warning','truck','dispatch',new.report_id
      from public.profiles p join public.barangay_dispatch_requests r on r.barangay_id=p.barangay_id
      where r.report_id=new.report_id and p.role='barangay_official' and not p.disabled;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists report_dispatch_assign_municipal_request on public.report_dispatches;
create trigger report_dispatch_assign_municipal_request after insert on public.report_dispatches
for each row execute function public.assign_municipal_dispatch_request();

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

  if public.account_session_blocked() or (v_role = 'lgu_ldrrmc' and not public.is_mdrrmo_duty_staff()) then
    raise insufficient_privilege using message='Only MDRRMO duty staff may issue municipal dispatches';
  end if;
  if v_role = 'barangay_official' and p_team is distinct from 'Barangay Response Team' then
    raise insufficient_privilege using message='Request municipal dispatch through MDRRMO';
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

create or replace function public.auto_dispatch_report(p_report_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row  public.reports;
  v_n    int;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if not public.is_mdrrmo_duty_staff() then
    raise insufficient_privilege using message='Only MDRRMO duty staff can run municipal auto-dispatch';
  end if;
  select * into v_row from public.reports where id = p_report_id;
  if v_row.id is null then
    raise exception 'That report does not exist';
  end if;
  if v_row.status <> 'verified' then
    raise exception 'Only a verified report can be auto-dispatched (it is "%")', v_row.status;
  end if;
  v_n := public.ug_auto_dispatch(p_report_id, public.auto_dispatch_teams(v_row.hazard_type, v_row.severity), 'manual');
  return jsonb_build_object('report_id', p_report_id, 'dispatched', v_n);
end;
$$;

create or replace function public.ug_auto_dispatch_on_verify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verified_by_role = 'lgu_ldrrmc' and public.is_mdrrmo_duty_staff() then
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

create or replace function public.advance_report_status(p_report_id uuid, p_next text, p_note text default '')
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row      public.reports;
  v_from     text;
  v_role     text;
  v_brgy     uuid;
  v_name     text;
  v_is_super boolean := false;
  v_note     text := trim(coalesce(p_note, ''));
  v_reporter uuid;
  v_code     text;
  v_tone     text;
  v_title    text;
  v_body     text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_next is null or p_next not in ('verified', 'dispatched', 'resolved', 'rejected') then
    raise exception 'Unknown status: %', p_next;
  end if;

  select role, barangay_id, coalesce(full_name, ''), coalesce(is_super_admin, false)
    into v_role, v_brgy, v_name, v_is_super
    from public.profiles where id = auth.uid();

  -- lock the row so two officials clicking at once cannot both pass the
  -- one-step check below
  select * into v_row from public.reports where id = p_report_id for update;
  if v_row.id is null then
    raise exception 'That report does not exist';
  end if;

  if v_role = 'barangay_official' and v_row.barangay_id is distinct from v_brgy then
    raise exception 'That report is outside your barangay';
  end if;
  if v_role is null or v_role not in ('barangay_official', 'lgu_ldrrmc') then
    raise exception 'Only officials and LGU can change an incident status';
  end if;

  if v_is_super or public.account_session_blocked() then
    raise insufficient_privilege using message='Operational incident changes require duty staff access';
  end if;

  if v_role='barangay_official' and p_next in ('resolved','rejected') and exists (
    select 1 from public.report_dispatches where report_id=p_report_id and unit_id is not null
      and dispatch_status not in ('done','declined')
  ) then raise insufficient_privilege using message='MDRRMO must close reports with a municipal unit still assigned'; end if;

  if v_row.status = p_next then
    raise exception 'This report is already "%".', p_next;
  end if;
  if not (
       (v_row.status = 'reported'   and p_next in ('verified', 'rejected'))
    or (v_row.status = 'verified'   and p_next in ('dispatched', 'rejected'))
    or (v_row.status = 'dispatched' and p_next in ('resolved', 'rejected'))
  ) then
    raise exception 'A report in "%" cannot move to "%". Move one step at a time; resolved and rejected are final.', v_row.status, p_next;
  end if;

  if p_next = 'rejected' and v_note = '' then
    raise exception 'Write the reason for rejecting this report';
  end if;
  if p_next = 'resolved' and v_note = '' then
    raise exception 'Write a closing note before resolving this report';
  end if;

  v_from := v_row.status;
  perform set_config('uniguard.reason', 'rpc', true);
  perform set_config('uniguard.note', v_note, true);

  if p_next = 'verified' then
    update public.reports
       set status           = 'verified',
           verified_by      = auth.uid(),
           verified_by_name = v_name,
           verified_by_role = v_role,
           verified_at      = now()
     where id = p_report_id
     returning * into v_row;
  else
    update public.reports set status = p_next where id = p_report_id returning * into v_row;
  end if;

  perform public.write_audit('report.status_changed', 'reports', p_report_id,
    jsonb_build_object('from', v_from, 'to', p_next, 'note', v_note,
                       'verified_by_role', case when p_next = 'verified' then v_role else null end));

  v_reporter := v_row.reporter_id;
  v_code     := coalesce(v_row.code, '');
  if v_reporter is not null then
    v_tone  := case p_next when 'dispatched' then 'warning' when 'resolved' then 'prepared'
                            when 'rejected'  then 'warning' else 'advisory' end;
    v_title := case p_next
      when 'verified'   then 'Your report was verified'
      when 'dispatched' then 'Response dispatched to your report'
      when 'resolved'   then 'Your report is resolved'
      when 'rejected'   then 'Your report was rejected'
    end;
    v_body  := case p_next
      when 'verified'   then 'Report ' || v_code || ' was reviewed and verified' ||
                            case when v_role = 'lgu_ldrrmc' then ' by the Municipal DRRMO.' else '.' end
      when 'dispatched' then 'A responder unit has been dispatched for ' || v_code || '.'
      when 'resolved'   then 'Report ' || v_code || ' is resolved. Closing note: ' || left(v_note, 140)
      when 'rejected'   then 'Report ' || v_code || ' was rejected: ' || left(v_note, 140)
    end;
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    values (v_reporter, v_title, v_body, v_tone, 'check', 'report_status', v_row.id);
  end if;

  return jsonb_build_object('id', v_row.id, 'code', v_row.code, 'status', v_row.status,
                            'resolved_at', v_row.resolved_at);
end;
$$;

create or replace function public.dispatch_respond(
  p_dispatch_id uuid,
  p_action      text,
  p_note        text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row      public.report_dispatches;
  v_target   uuid;
  v_role     text;
  v_name     text;
  v_report   public.reports;
  v_now      timestamptz := now();
  v_tone     text;
  v_title    text;
  v_body     text;
  v_team     text;
  v_hospital uuid;
  v_new      text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_action is null or p_action not in (
      'acknowledged','en_route','on_scene','done',
      'under_control','fire_out','on_hold','resume',
      'transporting','arrived_hospital'
    ) then
    raise exception 'Unknown action: %', p_action;
  end if;

  if public.is_super_admin() or public.account_session_blocked() then
    raise insufficient_privilege using message='Operational response updates require duty staff access';
  end if;

  select role, coalesce(full_name, '') into v_role, v_name
    from public.profiles where id = auth.uid();

  select * into v_row from public.report_dispatches where id = p_dispatch_id for update;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;

  if v_row.dispatch_status = 'declined' then
    raise exception 'That dispatch was declined; no further action is allowed';
  end if;

  if v_role is distinct from 'lgu_ldrrmc' then
    if v_row.unit_id is not null then
      if v_role is distinct from 'dispatch_team' or v_row.unit_id is distinct from public.my_unit_id() then
        raise exception 'Only this unit''s users may respond to this dispatch';
      end if;
    else
      if v_role is distinct from 'barangay_official' then
        raise exception 'Only the barangay official may respond to this dispatch';
      end if;
      select * into v_report from public.reports where id = v_row.report_id;
      if v_report.barangay_id is distinct from public.my_barangay_id() then
        raise exception 'This dispatch is outside your barangay';
      end if;
    end if;
  end if;

  v_team := v_row.team;

  if not (
    (v_row.dispatch_status = 'sent'         and p_action = 'acknowledged')
    or (v_row.dispatch_status = 'acknowledged' and p_action in ('en_route','on_scene','done'))
    or (v_row.dispatch_status = 'en_route'   and p_action in ('on_scene','done'))
    or (v_row.dispatch_status = 'on_scene'   and p_action = 'done')
    -- BFP: on_scene -> under_control -> fire_out -> done
    or (v_team = 'BFP' and v_row.dispatch_status = 'on_scene'      and p_action = 'under_control')
    or (v_team = 'BFP' and v_row.dispatch_status = 'under_control' and p_action in ('fire_out','done'))
    or (v_team = 'BFP' and v_row.dispatch_status = 'fire_out'      and p_action = 'done')
    -- Rescue: en_route/on_scene -> on_hold -> resume (back to on_scene)
    or (v_team in ('Rescue Unit','MDRRMO Rescue')
        and v_row.dispatch_status in ('en_route','on_scene')
        and p_action = 'on_hold')
    or (v_team in ('Rescue Unit','MDRRMO Rescue')
        and v_row.dispatch_status = 'on_hold'
        and p_action = 'resume')
    -- Ambulance: on_scene -> transporting -> arrived_hospital -> done
    or (v_team = 'Ambulance' and v_row.dispatch_status = 'on_scene'         and p_action = 'transporting')
    or (v_team = 'Ambulance' and v_row.dispatch_status = 'transporting'     and p_action = 'arrived_hospital')
    or (v_team = 'Ambulance' and v_row.dispatch_status = 'arrived_hospital' and p_action = 'done')
  ) then
    raise exception 'A dispatch in "%" (team %) cannot move to "%"', v_row.dispatch_status, v_team, p_action;
  end if;

  if p_action = 'on_hold' and coalesce(trim(p_note), '') = '' then
    raise exception 'A hold reason is required';
  end if;

  if p_action = 'transporting' then
    v_hospital := nullif(v_row.field_data->>'hospital_id', '')::uuid;
    if v_hospital is null then
      raise exception 'Choose an accepting hospital before transporting';
    end if;
    if not exists (
      select 1 from public.hospital_capacity h
        join public.dispatch_units u on u.id = h.unit_id
       where h.unit_id = v_hospital and h.accepting = true and u.active = true
    ) then
      raise exception 'The chosen hospital is not accepting patients';
    end if;
  end if;

  -- 'resume' is an event, not a stored status: the rescue is back on scene
  v_new := case when p_action = 'resume' then 'on_scene' else p_action end;

  update public.report_dispatches
     set dispatch_status = v_new,
         ack_at      = case when p_action = 'acknowledged' then v_now else ack_at end,
         en_route_at = case when p_action = 'en_route'     then v_now else en_route_at end,
         on_scene_at = case when p_action = 'on_scene' or (p_action = 'resume' and on_scene_at is null)
                            then v_now else on_scene_at end,
         done_at     = case when p_action = 'done'         then v_now else done_at end,
         hold_reason = case when p_action = 'on_hold' then left(coalesce(trim(p_note), ''), 500)
                            when p_action = 'resume'  then ''
                            else hold_reason end
   where id = p_dispatch_id;

  insert into public.report_dispatch_events (dispatch_id, actor, actor_name, action, note)
  values (p_dispatch_id, auth.uid(), v_name, p_action, left(coalesce(p_note, ''), 240));

  perform public.write_audit('dispatch.responded', 'report_dispatches', p_dispatch_id,
    jsonb_build_object('action', p_action, 'status', v_new, 'note', left(coalesce(p_note, ''), 240)));

  select * into v_report from public.reports where id = v_row.report_id;
  v_target := v_report.barangay_id;

  v_tone  := case p_action
    when 'acknowledged'     then 'advisory'
    when 'en_route'         then 'advisory'
    when 'on_scene'         then 'warning'
    when 'under_control'    then 'warning'
    when 'fire_out'         then 'prepared'
    when 'on_hold'          then 'warning'
    when 'resume'           then 'warning'
    when 'transporting'     then 'warning'
    when 'arrived_hospital' then 'prepared'
    when 'done'             then 'prepared'
  end;
  v_title := case p_action
    when 'acknowledged'     then 'Dispatch acknowledged'
    when 'en_route'         then 'Responder en route'
    when 'on_scene'         then 'Responder on scene'
    when 'under_control'    then 'Fire under control'
    when 'fire_out'         then 'Fire out'
    when 'on_hold'          then 'Rescue on hold'
    when 'resume'           then 'Rescue resumed'
    when 'transporting'     then 'Ambulance transporting'
    when 'arrived_hospital' then 'Patient arrived at hospital'
    when 'done'             then 'Dispatch complete'
  end;
  v_body  := case p_action
    when 'acknowledged'     then 'Response to ' || coalesce(v_report.code, '') || ' is acknowledged.'
    when 'en_route'         then 'Response to ' || coalesce(v_report.code, '') || ' is en route.'
    when 'on_scene'         then 'Response to ' || coalesce(v_report.code, '') || ' is on scene.'
    when 'under_control'    then 'Response to ' || coalesce(v_report.code, '') || ': fire is under control.'
    when 'fire_out'         then 'Response to ' || coalesce(v_report.code, '') || ': fire is out.'
    when 'on_hold'          then 'Response to ' || coalesce(v_report.code, '') || ' is on hold. Reason: ' || coalesce(trim(p_note), '')
    when 'resume'           then 'Response to ' || coalesce(v_report.code, '') || ' resumed operations.'
    when 'transporting'     then 'Ambulance for ' || coalesce(v_report.code, '') || ' is transporting.'
    when 'arrived_hospital' then 'Ambulance for ' || coalesce(v_report.code, '') || ' arrived at hospital.'
    when 'done'             then 'Response to ' || coalesce(v_report.code, '') || ' is done.'
  end;

  insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
  select p.id, v_title, v_body, v_tone, 'truck', 'dispatch_status', v_report.id
    from public.profiles p
   where p.disabled = false
     and (
       p.role = 'lgu_ldrrmc'
       or (v_target is not null and p.barangay_id = v_target and p.role = 'barangay_official')
     );

  if p_action in ('on_scene','under_control','fire_out','on_hold','resume',
                  'transporting','arrived_hospital','done')
     and v_report.reporter_id is not null then
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    values (v_report.reporter_id, v_title, v_body, v_tone, 'check', 'dispatch_status', v_report.id);
  end if;

  if p_action = 'done' then
    perform public.release_dispatch_equipment(array[p_dispatch_id]);
  end if;

  return jsonb_build_object('dispatch_id', p_dispatch_id, 'action', p_action,
                            'status', v_new, 'at', v_now);
end;
$$;

create or replace function public.decline_dispatch(
  p_dispatch_id uuid,
  p_reason      text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row      public.report_dispatches;
  v_role     text;
  v_name     text;
  v_unit     uuid;
  v_brgy     uuid;
  v_report   public.reports;
  v_reverted boolean := false;
begin
  if public.is_super_admin() or public.account_session_blocked() then
    raise insufficient_privilege using message='Operational response updates require duty staff access';
  end if;

  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required to decline a dispatch';
  end if;
  select * into v_row from public.report_dispatches where id = p_dispatch_id for update;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.dispatch_status not in ('sent','acknowledged') then
    raise exception 'A dispatch in "%" cannot be declined', v_row.dispatch_status;
  end if;

  select role, coalesce(full_name, ''), dispatch_unit_id, barangay_id
    into v_role, v_name, v_unit, v_brgy
    from public.profiles where id = auth.uid();

  if v_role is distinct from 'lgu_ldrrmc' then
    if v_row.unit_id is not null then
      if v_role is distinct from 'dispatch_team' or v_row.unit_id is distinct from v_unit then
        raise exception 'Only this unit''s users may decline this dispatch';
      end if;
    else
      if v_role is distinct from 'barangay_official' then
        raise exception 'Only the barangay official may decline this dispatch';
      end if;
      select * into v_report from public.reports where id = v_row.report_id;
      if v_report.barangay_id is distinct from v_brgy then
        raise exception 'This dispatch is outside your barangay';
      end if;
    end if;
  end if;

  update public.report_dispatches
     set dispatch_status = 'declined',
         decline_reason  = left(trim(p_reason), 500)
   where id = p_dispatch_id;

  insert into public.report_dispatch_events (dispatch_id, actor, actor_name, action, note)
  values (p_dispatch_id, auth.uid(), v_name, 'declined', left(trim(p_reason), 240));

  perform public.write_audit('dispatch.declined', 'report_dispatches', p_dispatch_id,
    jsonb_build_object('reason', left(trim(p_reason), 500), 'by', v_name));

  perform public.release_dispatch_equipment(array[p_dispatch_id]);

  -- lock the report, then: if no other dispatch is still active or done, the
  -- report has no team — return it to verified so it is dispatched again.
  select * into v_report from public.reports where id = v_row.report_id for update;
  if v_report.status = 'dispatched' and not exists (
       select 1 from public.report_dispatches d
        where d.report_id = v_report.id and d.dispatch_status <> 'declined'
     ) then
    perform set_config('uniguard.reason', 'all_declined', true);
    perform set_config('uniguard.note', left(coalesce(v_row.team, '') || ' declined: ' || trim(p_reason), 240), true);
    update public.reports set status = 'verified' where id = v_report.id;
    v_reverted := true;

    if v_report.reporter_id is not null then
      insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
      values (v_report.reporter_id,
              'Responder reassignment',
              'The team assigned to ' || coalesce(v_report.code, 'your report') ||
                ' could not respond. A new team is being arranged.',
              'warning', 'truck', 'report_status', v_report.id);
    end if;
  end if;

  -- notify the dispatcher and the LGU so they re-dispatch
  if v_row.dispatched_by is not null then
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    values (v_row.dispatched_by,
      'Dispatch declined: ' || coalesce(v_row.team, 'team'),
      left(coalesce(v_row.team, '') || ' declined: ' || trim(p_reason) ||
           ' — pick another team for ' || coalesce(v_report.code, ''), 240),
      'warning', 'alert', 'dispatch_declined', v_report.id);
  end if;

  insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
  select p.id, 'Dispatch declined: ' || coalesce(v_row.team, 'team'),
         left(coalesce(v_row.team, '') || ' declined ' || coalesce(v_report.code, '') ||
              ' — pick another team.', 240),
         'warning', 'alert', 'dispatch_declined', v_report.id
    from public.profiles p
   where p.disabled = false and p.role = 'lgu_ldrrmc'
     and p.id is distinct from v_row.dispatched_by;

  return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', 'declined', 'at', now(),
                            'report_status', case when v_reverted then 'verified' else v_report.status end);
end;
$$;

create or replace function public.decide_unit_request(
  p_request_id uuid,
  p_decision   text,
  p_note       text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.unit_requests;
  v_role text;
  v_name text;
begin
  if public.is_super_admin() or public.account_session_blocked() then
    raise insufficient_privilege using message='Operational response updates require duty staff access';
  end if;

  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_decision not in ('approved','declined','done') then
    raise exception 'Decision must be approved, declined or done';
  end if;
  select * into v_row from public.unit_requests where id = p_request_id;
  if v_row.id is null then raise exception 'That request does not exist'; end if;

  select role, coalesce(full_name, '') into v_role, v_name
    from public.profiles where id = auth.uid();
  -- only the LGU may decide; a unit_admin may close a request to 'done'
  -- when they consider it delivered
  if v_role = 'lgu_ldrrmc' then
    null;
  elsif v_role = 'dispatch_team' and public.is_unit_admin() and p_decision = 'done' and v_row.unit_id = public.my_unit_id() then
    null;
  else
    raise exception 'Only the LGU may decide a support request';
  end if;

  update public.unit_requests
     set status = p_decision, decided_by = auth.uid(), decided_at = now()
   where id = p_request_id;

  -- notify the unit's users
  insert into public.notifications (user_id, title, body, tone, icon, type)
  select p.id, 'Support request ' || p_decision,
         left(coalesce(p_note, '') || ' · ' || v_row.kind, 240),
         case when p_decision = 'approved' then 'prepared' when p_decision = 'done' then 'prepared' else 'warning' end,
         'check', 'unit_request'
    from public.profiles p
   where p.disabled = false and p.role = 'dispatch_team' and p.dispatch_unit_id = v_row.unit_id;

  perform public.write_audit('unit_request.decided', 'unit_requests', p_request_id,
    jsonb_build_object('decision', p_decision, 'note', left(coalesce(p_note, ''), 240), 'by', v_name));

  return jsonb_build_object('id', p_request_id, 'status', p_decision);
end;
$$;

create or replace function public.update_help_request(
  p_id     uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row  public.dispatch_help_requests;
  v_name text;
  v_dispatch public.report_dispatches;
  v_report   public.reports;
begin
  if public.is_super_admin() or public.account_session_blocked() then
    raise insufficient_privilege using message='Operational response updates require duty staff access';
  end if;

  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_status not in ('acknowledged','resolved') then
    raise exception 'Help request can only move to acknowledged or resolved';
  end if;
  if not public.is_lgu() then
    raise exception 'Only the LGU may update a help request';
  end if;
  select * into v_row from public.dispatch_help_requests where id = p_id;
  if v_row.id is null then
    raise exception 'That help request does not exist';
  end if;
  -- forward-only: sent -> acknowledged -> resolved
  if not (
    (v_row.status = 'sent'         and p_status = 'acknowledged')
    or (v_row.status = 'acknowledged' and p_status = 'resolved')
  ) then
    raise exception 'A help request in "%" cannot move to "%"', v_row.status, p_status;
  end if;

  select coalesce(full_name, '') into v_name from public.profiles where id = auth.uid();

  update public.dispatch_help_requests
     set status = p_status,
         acknowledged_by = case when p_status = 'acknowledged' then auth.uid() else acknowledged_by end,
         acknowledged_at = case when p_status = 'acknowledged' then now() else acknowledged_at end,
         resolved_by     = case when p_status = 'resolved'     then auth.uid() else resolved_by end,
         resolved_at     = case when p_status = 'resolved'     then now() else resolved_at end
   where id = p_id;

  -- notify the requester
  if v_row.created_by is not null then
    select * into v_dispatch from public.report_dispatches where id = v_row.dispatch_id;
    select * into v_report from public.reports where id = v_dispatch.report_id;
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    values (v_row.created_by,
      'Help request ' || p_status,
      left(coalesce(v_row.kind, '') || ' for ' || coalesce(v_report.code, '') || ' · ' || coalesce(v_row.message, ''), 240),
      case when p_status = 'resolved' then 'prepared' else 'advisory' end,
      'check', 'dispatch_help', v_report.id);
  end if;

  perform public.write_audit('dispatch.help_updated', 'dispatch_help_requests', p_id,
    jsonb_build_object('status', p_status, 'by', v_name));

  return jsonb_build_object('id', p_id, 'status', p_status);
end;
$$;

create or replace function public.send_patient_notice(
  p_unit_id    uuid,
  p_report_id  uuid default null,
  p_patients   int default 1,
  p_condition  text default '',
  p_eta        timestamptz default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
  v_name text;
  v_id uuid;
begin
  if public.is_super_admin() or public.account_session_blocked() then
    raise insufficient_privilege using message='Operational response updates require duty staff access';
  end if;

  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if not exists (select 1 from public.dispatch_units where id = p_unit_id and unit_type = 'Hospital' and active = true) then
    raise exception 'That hospital does not exist';
  end if;
  -- F2: must be accepting
  if not exists (select 1 from public.hospital_capacity where unit_id = p_unit_id and accepting = true) then
    raise exception 'That hospital is not accepting patients';
  end if;

  select role, coalesce(full_name, '') into v_role, v_name
    from public.profiles where id = auth.uid();
  if v_role not in ('lgu_ldrrmc','barangay_official','dispatch_team') then
    raise exception 'Only officials, LGU or responders may send a patient notice';
  end if;

  insert into public.patient_notices (unit_id, report_id, patients, condition, eta, sent_by, status)
  values (p_unit_id, p_report_id, greatest(p_patients, 1), left(coalesce(p_condition, ''), 240), p_eta, auth.uid(), 'sent')
  returning id into v_id;

  insert into public.notifications (user_id, title, body, tone, icon, type)
  select p.id, 'Incoming patient notice', left(p_patients || ' patient(s) · ' || p_condition, 240),
         'warning', 'truck', 'patient_notice'
    from public.profiles p
   where p.disabled = false
     and p.role = 'dispatch_team'
     and p.dispatch_unit_id = p_unit_id;

  perform public.write_audit('patient.notice_sent', 'patient_notices', v_id,
    jsonb_build_object('unit_id', p_unit_id, 'patients', p_patients, 'sent_by', v_name));

  return jsonb_build_object('id', v_id, 'unit_id', p_unit_id);
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime' and not puballtables)
    and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='barangay_dispatch_requests') then
    alter publication supabase_realtime add table public.barangay_dispatch_requests;
  end if;
end $$;

commit;
