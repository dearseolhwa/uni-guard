-- ============================================================================
--  UniGuard · 049 · Dispatch Team Features (per the Oct 24 2026 LDRRMO PDF)
--
--  Implements the 23 dispatch-team feature items (A1..G1) in ONE additive,
--  idempotent migration. Never edits a previous file.
--
--  Shared changes:
--    · report_dispatches.dispatch_status gains: declined, under_control,
--      fire_out, on_hold, transporting, arrived_hospital
--    · new columns: decline_reason, hold_reason, field_data
--    · declined counts as closed; sync_unit_status and release_on_close
--      now treat any status not in ('done','declined') as open
--    · dispatch_respond gains per-team actions:
--         BFP    : on_scene -> under_control -> fire_out -> done
--         Rescue : en_route/on_scene -> on_hold (reason required) -> resume
--         Ambulance: on_scene -> transporting (hospital_id required) ->
--                    arrived_hospital -> done
--      New: under_control, fire_out, on_hold, transporting, arrived_hospital,
--      resume
--    · update_dispatch_field_data writes live field_data (checklist, tallies,
--      rescue details) once the dispatch is acknowledged and before it closes
--
--  Per-team:
--    A1  decline_dispatch(p_dispatch_id, p_reason)
--    A2  dispatch_help_requests + create_help_request + update_help_request
--    A4  submit_after_action now validates allowed meta keys per team
--    D1  road_status.dispatch_id + post_road_closure + reopen_road_closure
--    D2  evacuation_centers.needs_patrol + needs_patrol_at (toggle through
--        the existing updateCenter path; no new RPC needed)
--    D3  relief_distributions.escort_status + escort_note + escort_unit_id
--        + request_relief_escort + confirm_relief_escort
--    F2  send_patient_notice now rejects a hospital that is not accepting
--    F1  ack_patient_notice now allows 'arrived'/'cancelled' only from
--        'sent' or 'acknowledged'
--
--  NOTES / FLAGS for the implementer:
--    · Migration 038 uses `ALTER TABLE … ADD CONSTRAINT IF NOT EXISTS`
--      (lines ~496-499). That clause is NOT valid in PostgreSQL (only the
--      index form `CREATE INDEX IF NOT EXISTS` is). The two foreign keys
--      it targets therefore failed to add on the live project — they are
--      re-added here inside DO $$ guards. See DISPATCH_FEATURES_RESULT.md.
--    · All writes go through SECURITY DEFINER RPCs with set search_path =
--      public that re-check role, unit and barangay scope server-side and
--      call write_audit. No client timestamps are trusted; the database
--      stamps everything with now().
--    · New tables are added to supabase_realtime. New strings live in
--      js/i18n.js (en + fil). sw.js VERSION is bumped v12 -> v13.
--
--  Additive + idempotent. Begin/commit so it applies atomically.
-- ============================================================================

begin;

-- ============================================================================
--  SHARED DATA CHANGES
-- ============================================================================

-- --------------------------------------------------------- report_dispatches
-- Widen the dispatch_status check to include the new team-specific statuses.
-- 'declined' counts as closed (treated like 'done' for unit-status sync and
-- for release_on_close). 'under_control','fire_out' (BFP), 'on_hold'
-- (Rescue) and 'transporting','arrived_hospital' (Ambulance) are
-- intermediate open statuses the unit stays On duty through.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'report_dispatches_status_check') then
    alter table public.report_dispatches drop constraint report_dispatches_status_check;
  end if;
  alter table public.report_dispatches add constraint report_dispatches_status_check
    check (dispatch_status in (
      'sent','acknowledged','en_route','on_scene','done',
      'declined','under_control','fire_out','on_hold','transporting','arrived_hospital'
    ));
end $$;

alter table public.report_dispatches add column if not exists decline_reason text not null default '';
alter table public.report_dispatches add column if not exists hold_reason   text not null default '';
alter table public.report_dispatches add column if not exists field_data    jsonb not null default '{}'::jsonb;

create index if not exists report_dispatches_decline_idx
  on public.report_dispatches (dispatch_status) where dispatch_status = 'declined';

-- Re-add the foreign keys 038 tried to add with the unsupported
-- ADD CONSTRAINT IF NOT EXISTS form. DO $$ guard so re-runs are safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'report_dispatches_unit_fkey'
  ) then
    alter table public.report_dispatches add constraint report_dispatches_unit_fkey
      foreign key (unit_id) references public.dispatch_units(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'report_dispatches_target_brgy_fkey'
  ) then
    alter table public.report_dispatches add constraint report_dispatches_target_brgy_fkey
      foreign key (target_barangay_id) references public.barangays(id) on delete set null;
  end if;
end $$;

-- ------------------------------------------------------ sync_unit_status (v2)
-- Treat any dispatch_status NOT in ('done','declined') as open. A declined
-- dispatch releases the unit the same way 'done' does. (shared item 3)
create or replace function public.sync_unit_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_open int;
begin
  if new.unit_id is not null then
    select count(*) into v_open from public.report_dispatches d
     where d.unit_id = new.unit_id
       and d.dispatch_status not in ('done','declined');
    if v_open > 0 then
      update public.dispatch_units set status = 'on_duty' where id = new.unit_id;
    else
      update public.dispatch_units set status = 'available' where id = new.unit_id;
    end if;
  end if;
  return new;
end;
$$;

-- drop & re-create the existing trigger so the new function body is in effect
drop trigger if exists report_dispatches_sync_unit on public.report_dispatches;
create trigger report_dispatches_sync_unit
  after insert or update of dispatch_status on public.report_dispatches
  for each row execute function public.sync_unit_status();

-- ---------------------------------------------------- release_on_close (v2)
-- Treat any dispatch_status NOT in ('done','declined') as still open. When
-- the report closes, force every open dispatch to 'done' (declined ones are
-- already terminal). (shared item 3)
create or replace function public.release_on_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('resolved','rejected') and old.status not in ('resolved','rejected') then
    -- mark every open dispatch on this report done (declined ones stay declined)
    update public.report_dispatches
       set dispatch_status = 'done',
           done_at = coalesce(done_at, now())
     where report_id = new.id
       and dispatch_status not in ('done','declined');
    -- release equipment
    update public.dispatch_equipment_use
       set released_at = now()
     where released_at is null
       and dispatch_id in (select id from public.report_dispatches where report_id = new.id);
    update public.dispatch_equipment
       set status = 'available'
     where id in (
       select equipment_id from public.dispatch_equipment_use
        where dispatch_id in (select id from public.report_dispatches where report_id = new.id)
     );
    -- responders back to available
    update public.responders set status = 'available'
     where id in (select responder_id from public.report_assignments
                   where report_id = new.id and released_at is null);
    update public.report_assignments set released_at = now()
     where report_id = new.id and released_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_release_on_close on public.reports;
create trigger reports_release_on_close
  after update on public.reports
  for each row execute function public.release_on_close();

-- ============================================================================
--  SHARED RPC: dispatch_respond (extended)
-- ============================================================================
--  Actions:
--    acknowledged, en_route, on_scene, done        (all teams, original flow)
--    under_control, fire_out                       (BFP only)
--    on_hold, resume                              (Rescue Unit / MDRRMO Rescue)
--    transporting, arrived_hospital               (Ambulance only)
--
--  Per-team one-step guards:
--    BFP     : on_scene -> under_control -> fire_out -> done
--              (done still allowed from either under_control or fire_out)
--    Rescue  : en_route OR on_scene -> on_hold (reason required)
--              on_hold -> resume -> on_scene
--    Ambulance: on_scene -> transporting (hospital_id in field_data required)
--               transporting -> arrived_hospital -> done
--
--  The reporter can already read report_dispatches; the new statuses appear
--  in the incident dispatch timeline as well (handled client-side in
--  js/screens.js dispatchRecords).
--
--  Notifies barangay officials, LGU and the reporter exactly like on_scene
--  does for the new statuses. Never another unit or barangay.
-- ----------------------------------------------------------------------------
drop function if exists public.dispatch_respond(uuid, text, text);
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
  v_row     public.report_dispatches;
  v_unit_id uuid;
  v_target  uuid;
  v_role    text;
  v_name    text;
  v_report  public.reports;
  v_now     timestamptz := now();
  v_tone    text;
  v_title   text;
  v_body    text;
  v_team    text;
  v_hospital uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_action not in (
      'acknowledged','en_route','on_scene','done',
      'under_control','fire_out','on_hold','resume',
      'transporting','arrived_hospital'
    ) then
    raise exception 'Unknown action: %', p_action;
  end if;

  select role, coalesce(full_name, '') into v_role, v_name
    from public.profiles where id = auth.uid();

  select * into v_row from public.report_dispatches where id = p_dispatch_id;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;

  -- A declined dispatch is terminal: no further action is allowed.
  if v_row.dispatch_status = 'declined' then
    raise exception 'That dispatch was declined; no further action is allowed';
  end if;

  -- Scope: only the dispatched unit's users OR (for Barangay Response Team
  -- dispatches) the report's barangay officials may update. LGU may always.
  if v_role <> 'lgu_ldrrmc' then
    if v_row.unit_id is not null then
      if v_role <> 'dispatch_team' or v_row.unit_id is distinct from public.my_unit_id() then
        raise exception 'Only this unit''s users may respond to this dispatch';
      end if;
    else
      if v_role <> 'barangay_official' then
        raise exception 'Only the barangay official may respond to this dispatch';
      end if;
      select * into v_report from public.reports where id = v_row.report_id;
      if v_report.barangay_id is distinct from public.my_barangay_id() then
        raise exception 'This dispatch is outside your barangay';
      end if;
    end if;
  end if;

  v_team := v_row.team;

  -- -- Per-team one-step guard -----------------------------------------------
  if not (
    -- generic flow (all teams)
    (v_row.dispatch_status = 'sent'         and p_action = 'acknowledged')
    or (v_row.dispatch_status = 'acknowledged' and p_action in ('en_route','on_scene','done'))
    or (v_row.dispatch_status = 'en_route'   and p_action in ('on_scene','done'))
    or (v_row.dispatch_status = 'on_scene'   and p_action = 'done')
    -- BFP: on_scene -> under_control -> fire_out -> done
    or (v_team = 'BFP' and v_row.dispatch_status = 'on_scene'      and p_action = 'under_control')
    or (v_team = 'BFP' and v_row.dispatch_status = 'under_control' and p_action in ('fire_out','done'))
    or (v_team = 'BFP' and v_row.dispatch_status = 'fire_out'      and p_action = 'done')
    -- Rescue Unit / MDRRMO Rescue: en_route OR on_scene -> on_hold -> resume -> on_scene
    or (v_team in ('Rescue Unit','MDRRMO Rescue')
        and v_row.dispatch_status in ('en_route','on_scene')
        and p_action = 'on_hold')
    or (v_team in ('Rescue Unit','MDRRMO Rescue')
        and v_row.dispatch_status = 'on_hold'
        and p_action = 'resume')
    -- Ambulance: on_scene -> transporting -> arrived_hospital -> done
    or (v_team = 'Ambulance' and v_row.dispatch_status = 'on_scene'        and p_action = 'transporting')
    or (v_team = 'Ambulance' and v_row.dispatch_status = 'transporting'    and p_action = 'arrived_hospital')
    or (v_team = 'Ambulance' and v_row.dispatch_status = 'arrived_hospital' and p_action = 'done')
  ) then
    raise exception 'A dispatch in "%" (team %) cannot move to "%"', v_row.dispatch_status, v_team, p_action;
  end if;

  -- -- on_hold requires a reason (shared item 4 / E2) -----------------------
  if p_action = 'on_hold' and coalesce(trim(p_note), '') = '' then
    raise exception 'A hold reason is required';
  end if;

  -- -- transporting requires an accepting hospital in field_data (F3) ------
  if p_action = 'transporting' then
    v_hospital := coalesce(v_row.field_data->>'hospital_id', '')::uuid;
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

  -- -- apply the transition --------------------------------------------------
  update public.report_dispatches
     set dispatch_status = p_action,
         ack_at           = case when p_action = 'acknowledged'   then v_now else ack_at end,
         en_route_at      = case when p_action = 'en_route'      then v_now else en_route_at end,
         on_scene_at      = case when p_action in ('on_scene','resume') then v_now else on_scene_at end,
         done_at          = case when p_action = 'done'           then v_now else done_at end,
         hold_reason      = case when p_action = 'on_hold' then left(coalesce(trim(p_note), ''), 500)
                                 when p_action = 'resume'  then ''
                                 else hold_reason end
   where id = p_dispatch_id;

  insert into public.report_dispatch_events (dispatch_id, actor, actor_name, action, note)
  values (p_dispatch_id, auth.uid(), v_name, p_action, left(coalesce(p_note, ''), 240));

  perform public.write_audit('dispatch.responded', 'report_dispatches', p_dispatch_id,
    jsonb_build_object('action', p_action, 'note', left(coalesce(p_note, ''), 240)));

  -- -- notify: report's barangay officials + LGU (+ reporter on the new
  --    terminal-ish statuses, same as on_scene). Never another unit/barangay.
  select * into v_report from public.reports where id = v_row.report_id;
  v_unit_id := v_row.unit_id;
  v_target  := v_report.barangay_id;

  v_tone  := case p_action
    when 'acknowledged'    then 'advisory'
    when 'en_route'        then 'advisory'
    when 'on_scene'        then 'warning'
    when 'under_control'   then 'warning'
    when 'fire_out'        then 'prepared'
    when 'on_hold'         then 'warning'
    when 'resume'          then 'warning'
    when 'transporting'    then 'warning'
    when 'arrived_hospital' then 'prepared'
    when 'done'            then 'prepared'
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

  -- barangay officials + LGU
  insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
  select p.id, v_title, v_body, v_tone, 'truck', 'dispatch_status', v_report.id
    from public.profiles p
   where p.disabled = false
     and (
       p.role = 'lgu_ldrrmc'
       or (v_target is not null and p.barangay_id = v_target and p.role = 'barangay_official')
     );

  -- reporter: on the original triggers (on_scene, done) AND on every new
  -- progress status (under_control, fire_out, on_hold, transporting,
  -- arrived_hospital). resume also notifies so the reporter sees activity.
  if p_action in ('on_scene','under_control','fire_out','on_hold','resume',
                  'transporting','arrived_hospital','done')
     and v_report.reporter_id is not null then
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    values (v_report.reporter_id, v_title, v_body, v_tone, 'check', 'dispatch_status', v_report.id);
  end if;

  -- When done, release the equipment (the sync_unit_status trigger handles
  -- the unit). Declined is handled by decline_dispatch below.
  if p_action = 'done' then
    update public.dispatch_equipment_use
       set released_at = v_now
     where dispatch_id = p_dispatch_id and released_at is null;
    update public.dispatch_equipment
       set status = 'available'
     where id in (select equipment_id from public.dispatch_equipment_use where dispatch_id = p_dispatch_id);
  end if;

  return jsonb_build_object('dispatch_id', p_dispatch_id, 'action', p_action, 'at', v_now);
end;
$$;

revoke all on function public.dispatch_respond(uuid, text, text) from public;
grant execute on function public.dispatch_respond(uuid, text, text) to authenticated;

-- ============================================================================
--  SHARED RPC: update_dispatch_field_data
-- ----------------------------------------------------------------------------
--  Writes a JSON patch into report_dispatches.field_data for the live
--  checklist, evacuation tally and rescue details. Allowed for:
--    · the dispatch's own unit's users
--    · the report's barangay officials
--    · the LGU
--  Only allowed once the dispatch is acknowledged and before it is closed
--  (done or declined). The patch is a small jsonb object; whitelisted keys
--  per team are enforced below. Unknown keys are rejected.
-- ============================================================================
create or replace function public.update_dispatch_field_data(
  p_dispatch_id uuid,
  p_patch       jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row    public.report_dispatches;
  v_role   text;
  v_unit   uuid;
  v_brgy   uuid;
  v_team   text;
  v_keys   text[];
  v_k      text;
  v_merged jsonb;
  v_allowed text[];
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_patch is null or p_patch = '{}'::jsonb then
    raise exception 'Nothing to update';
  end if;

  select * into v_row from public.report_dispatches where id = p_dispatch_id;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.dispatch_status not in ('acknowledged','en_route','on_scene','under_control','fire_out','on_hold','transporting','arrived_hospital') then
    raise exception 'Field data can only be updated while the dispatch is open and acknowledged';
  end if;

  select role, dispatch_unit_id, barangay_id into v_role, v_unit, v_brgy
    from public.profiles where id = auth.uid();

  -- scope
  if v_role <> 'lgu_ldrrmc' then
    if v_row.unit_id is not null then
      if v_role <> 'dispatch_team' or v_row.unit_id is distinct from v_unit then
        raise exception 'Only this unit''s users may update field data';
      end if;
    else
      if v_role <> 'barangay_official' then
        raise exception 'Only the barangay official may update field data';
      end if;
      if v_row.target_barangay_id is distinct from v_brgy then
        raise exception 'This dispatch is outside your barangay';
      end if;
    end if;
  end if;

  v_team := v_row.team;

  -- Per-team whitelist of top-level keys. Common keys are available to all
  -- teams (people_assisted, equipment_used, follow_up_needed, follow_up_note
  -- are after-action keys validated in submit_after_action, NOT here; here
  -- we only validate live field_data keys).
  v_allowed := array(
    select k from (values
      -- common live field_data keys (used by the after-action form's
      -- prefill too, but they live in field_data while the form is in
      -- progress)
      ('hospital_id'),
      -- B1/B2: barangay first-response checklist
      ('checklist_done'),
      -- B3: evacuation tally
      ('evac_tally'),
      -- E1: rescue details
      ('rescue_details'),
      -- E3: rescue tally
      ('rescue_tally')
    ) as v(k)
  );

  v_keys := array(select jsonb_object_keys(p_patch));
  foreach v_k in array v_keys loop
    if v_k <> 'hospital_id' and v_k <> 'checklist_done' and v_k <> 'evac_tally'
       and v_k <> 'rescue_details' and v_k <> 'rescue_tally' then
      raise exception 'Unknown field_data key: %', v_k;
    end if;
  end loop;

  -- Per-team gating (the prompt: B2 checklist + B3 evac tally are Barangay
  -- Response Team; E1 rescue_details + E3 rescue_tally are Rescue Unit).
  -- hospital_id is allowed on any team's dispatch (Ambulance sets it on
  -- transporting; the others may set it as a destination for downstream
  -- rescue tally entries).
  if v_team = 'Barangay Response Team' then
    -- only checklist_done + evac_tally (+ hospital_id) allowed
    foreach v_k in array v_keys loop
      if v_k not in ('checklist_done','evac_tally','hospital_id') then
        raise exception 'Barangay Response Team field_data does not allow key: %', v_k;
      end if;
    end loop;
  elsif v_team in ('Rescue Unit','MDRRMO Rescue') then
    foreach v_k in array v_keys loop
      if v_k not in ('rescue_details','rescue_tally','hospital_id') then
        raise exception 'Rescue Unit field_data does not allow key: %', v_k;
      end if;
    end loop;
  end if;

  v_merged := coalesce(v_row.field_data, '{}'::jsonb) || p_patch;

  update public.report_dispatches
     set field_data = v_merged
   where id = p_dispatch_id;

  perform public.write_audit('dispatch.field_data', 'report_dispatches', p_dispatch_id,
    jsonb_build_object('patch', p_patch));

  return jsonb_build_object('dispatch_id', p_dispatch_id, 'field_data', v_merged);
end;
$$;

revoke all on function public.update_dispatch_field_data(uuid, jsonb) from public;
grant execute on function public.update_dispatch_field_data(uuid, jsonb) to authenticated;


-- ============================================================================
--  A1 · decline_dispatch  (every team)
-- ----------------------------------------------------------------------------
--  Allowed only when dispatch_status is 'sent' or 'acknowledged'. Caller must
--  be the dispatch's own unit user (for a unit dispatch), the report's
--  barangay official (for a Barangay Response Team dispatch) or the LGU.
--  Reason is required. Sets dispatch_status='declined', decline_reason, writes
--  a report_dispatch_events row, audits, and notifies dispatched_by + LGU
--  ("pick another team"). The dispatcher re-dispatches via dispatch_report_v2.
-- ============================================================================
create or replace function public.decline_dispatch(
  p_dispatch_id uuid,
  p_reason      text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row     public.report_dispatches;
  v_role    text;
  v_name    text;
  v_unit    uuid;
  v_brgy    uuid;
  v_report  public.reports;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required to decline a dispatch';
  end if;
  select * into v_row from public.report_dispatches where id = p_dispatch_id;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.dispatch_status not in ('sent','acknowledged') then
    raise exception 'A dispatch in "%" cannot be declined', v_row.dispatch_status;
  end if;

  select role, coalesce(full_name, ''), dispatch_unit_id, barangay_id
    into v_role, v_name, v_unit, v_brgy
    from public.profiles where id = auth.uid();

  -- same scope block as dispatch_respond: unit's own users OR (for Barangay
  -- Response Team dispatches) the report's barangay officials OR LGU.
  if v_role <> 'lgu_ldrrmc' then
    if v_row.unit_id is not null then
      if v_role <> 'dispatch_team' or v_row.unit_id is distinct from v_unit then
        raise exception 'Only this unit''s users may decline this dispatch';
      end if;
    else
      if v_role <> 'barangay_official' then
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
         decline_reason = left(trim(p_reason), 500)
   where id = p_dispatch_id;

  insert into public.report_dispatch_events (dispatch_id, actor, actor_name, action, note)
  values (p_dispatch_id, auth.uid(), v_name, 'declined', left(trim(p_reason), 240));

  perform public.write_audit('dispatch.declined', 'report_dispatches', p_dispatch_id,
    jsonb_build_object('reason', left(trim(p_reason), 500), 'by', v_name));

  -- Notify dispatched_by (the dispatcher) and the LGU so they re-dispatch.
  -- The reporter is intentionally NOT notified here (decline is internal
  -- coordination); they get the next dispatch's fanout.
  select * into v_report from public.reports where id = v_row.report_id;

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
   where p.disabled = false and p.role = 'lgu_ldrrmc' and p.id <> coalesce(v_row.dispatched_by, '00000000-0000-0000-0000-000000000000'::uuid);

  -- The declined dispatch's unit returns to available (the sync_unit_status
  -- trigger handles it because 'declined' is not in ('done','declined') is
  -- false, so the open count drops to 0).
  -- Equipment is released (no equipment should be deployed on a declined
  -- dispatch, but be defensive).
  update public.dispatch_equipment_use
     set released_at = now()
     where dispatch_id = p_dispatch_id and released_at is null;
  update public.dispatch_equipment
     set status = 'available'
     where id in (select equipment_id from public.dispatch_equipment_use where dispatch_id = p_dispatch_id);

  return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', 'declined', 'at', now());
end;
$$;

revoke all on function public.decline_dispatch(uuid, text) from public;
grant execute on function public.decline_dispatch(uuid, text) to authenticated;

-- ============================================================================
--  A2 · dispatch_help_requests  (every team)
-- ----------------------------------------------------------------------------
--  Table: dispatch_help_requests(id, dispatch_id, unit_id null, barangay_id
--  null, kind, message, status, created_by, created_at, acknowledged_by,
--  acknowledged_at, resolved_by, resolved_at)
--
--  kind    in (general, water_tanker, extra_personnel, beyond_capacity)
--  status in (sent, acknowledged, resolved)  -- forward-only
--
--  create_help_request(p_dispatch_id, p_kind, p_message):
--    · caller must be a unit user of the dispatch's unit OR the report's
--      barangay official OR the LGU
--    · sets unit_id / barangay_id from the caller's profile
--    · notifies the LGU
--
--  update_help_request(p_id, p_status):
--    · LGU only, forward-only sent -> acknowledged -> resolved
--    · notifies the requester (created_by)
-- ============================================================================
create table if not exists public.dispatch_help_requests (
  id              uuid primary key default gen_random_uuid(),
  dispatch_id     uuid not null references public.report_dispatches(id) on delete cascade,
  unit_id         uuid references public.dispatch_units(id) on delete set null,
  barangay_id     uuid references public.barangays(id) on delete set null,
  kind            text not null default 'general',
  message         text not null default '',
  status          text not null default 'sent',
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by     uuid references public.profiles(id) on delete set null,
  resolved_at     timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dispatch_help_requests_kind_check') then
    alter table public.dispatch_help_requests add constraint dispatch_help_requests_kind_check
      check (kind in ('general','water_tanker','extra_personnel','beyond_capacity'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dispatch_help_requests_status_check') then
    alter table public.dispatch_help_requests add constraint dispatch_help_requests_status_check
      check (status in ('sent','acknowledged','resolved'));
  end if;
end $$;

create index if not exists dispatch_help_requests_dispatch_idx
  on public.dispatch_help_requests (dispatch_id, created_at desc);
create index if not exists dispatch_help_requests_unit_idx
  on public.dispatch_help_requests (unit_id, status);
create index if not exists dispatch_help_requests_brgy_idx
  on public.dispatch_help_requests (barangay_id, status);
create index if not exists dispatch_help_requests_status_idx
  on public.dispatch_help_requests (status, created_at desc);

alter table public.dispatch_help_requests enable row level security;

-- Read: LGU, the dispatch's own unit members, the report's barangay
-- officials. No direct writes (everything goes through the RPCs).
drop policy if exists dispatch_help_requests_read on public.dispatch_help_requests;
create policy dispatch_help_requests_read on public.dispatch_help_requests
  for select to authenticated using (
    public.is_lgu()
    or (public.is_dispatch() and unit_id = public.my_unit_id())
    or (
      public.is_official()
      and exists (
        select 1 from public.report_dispatches d
          join public.reports r on r.id = d.report_id
         where d.id = dispatch_help_requests.dispatch_id
           and r.barangay_id = public.my_barangay_id()
      )
    )
  );

create or replace function public.create_help_request(
  p_dispatch_id uuid,
  p_kind        text,
  p_message     text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row   public.report_dispatches;
  v_role  text;
  v_name  text;
  v_unit  uuid;
  v_brgy  uuid;
  v_id    uuid;
  v_report public.reports;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_kind not in ('general','water_tanker','extra_personnel','beyond_capacity') then
    raise exception 'Unknown help request kind';
  end if;
  if coalesce(trim(p_message), '') = '' then
    raise exception 'Write a short message';
  end if;

  select * into v_row from public.report_dispatches where id = p_dispatch_id;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.dispatch_status in ('done','declined') then
    raise exception 'This dispatch is closed';
  end if;

  select role, coalesce(full_name, ''), dispatch_unit_id, barangay_id
    into v_role, v_name, v_unit, v_brgy
    from public.profiles where id = auth.uid();

  -- scope: same block as dispatch_respond (LGU, unit's own users, report's
  -- barangay officials). The LGU never needs to send itself a help request
  -- but is allowed for symmetry.
  if v_role not in ('lgu_ldrrmc','dispatch_team','barangay_official') then
    raise exception 'Only responders, officials or the LGU may request help';
  end if;
  if v_role <> 'lgu_ldrrmc' then
    if v_row.unit_id is not null then
      if v_role <> 'dispatch_team' or v_row.unit_id is distinct from v_unit then
        raise exception 'You can only request help for your own unit''s dispatch';
      end if;
    else
      if v_role <> 'barangay_official' then
        raise exception 'Only the barangay official may request help for this dispatch';
      end if;
      select * into v_report from public.reports where id = v_row.report_id;
      if v_report.barangay_id is distinct from v_brgy then
        raise exception 'This dispatch is outside your barangay';
      end if;
    end if;
  end if;

  -- unit_id / barangay_id auto-fill: unit user sets unit_id; official sets
  -- barangay_id; LGU leaves both null (the dispatch row is the source of
  -- truth for which unit/barangay this concerns).
  insert into public.dispatch_help_requests
    (dispatch_id, unit_id, barangay_id, kind, message, status, created_by)
  values
    (p_dispatch_id,
     case when v_role = 'dispatch_team' then v_row.unit_id else null end,
     case when v_role = 'barangay_official' then v_brgy else null end,
     p_kind, left(trim(p_message), 1000), 'sent', auth.uid())
  returning id into v_id;

  -- notify every LGU user
  select * into v_report from public.reports where id = v_row.report_id;
  insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
  select p.id,
    'Help request: ' || p_kind,
    left(coalesce(v_row.team, '') || ' · ' || coalesce(v_report.code, '') || ' — ' || trim(p_message), 240),
    'warning', 'inbox', 'dispatch_help', v_report.id
    from public.profiles p
   where p.disabled = false and p.role = 'lgu_ldrrmc';

  perform public.write_audit('dispatch.help_requested', 'dispatch_help_requests', v_id,
    jsonb_build_object('kind', p_kind, 'dispatch_id', p_dispatch_id, 'by', v_name));

  return jsonb_build_object('id', v_id, 'status', 'sent');
end;
$$;

revoke all on function public.create_help_request(uuid, text, text) from public;
grant execute on function public.create_help_request(uuid, text, text) to authenticated;

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

revoke all on function public.update_help_request(uuid, text) from public;
grant execute on function public.update_help_request(uuid, text) to authenticated;


-- ============================================================================
--  A4 · submit_after_action  (extended with per-team meta validation)
-- ----------------------------------------------------------------------------
--  The existing RPC writes after_action_meta. The UI currently sends `{}`.
--  Per the PDF the after-action form now fills meta with per-team fields:
--
--  Common keys (all teams):
--    people_assisted    int
--    equipment_used    jsonb   (prefilled from dispatch_equipment_use)
--    times             jsonb   (read-only: ack_at, en_route_at, on_scene_at, done_at)
--    follow_up_needed  bool
--    follow_up_note    text
--
--  BFP-only keys:
--    families_displaced int
--    people_injured      int
--
--  No new schema; only the RPC widens its meta-key validation.
-- ============================================================================
drop function if exists public.submit_after_action(uuid, text, jsonb);
create or replace function public.submit_after_action(
  p_dispatch_id uuid,
  p_text        text,
  p_meta        jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row  public.report_dispatches;
  v_role text;
  v_name text;
  v_unit uuid;
  v_brgy uuid;
  v_team text;
  v_k    text;
  v_keys text[];
  v_clean jsonb;
  v_allowed_common text[] := array['people_assisted','equipment_used','times','follow_up_needed','follow_up_note'];
  v_allowed_bfp   text[] := array['families_displaced','people_injured'];
  v_use_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if coalesce(trim(p_text), '') = '' then
    raise exception 'Write a short after-action summary';
  end if;
  select * into v_row from public.report_dispatches where id = p_dispatch_id;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.dispatch_status not in ('done') then
    -- declined dispatches cannot file an after-action either; the form
    -- only renders for 'done' rows.
    raise exception 'The after-action report can be filed only after the dispatch is Done';
  end if;

  select role, coalesce(full_name, ''), dispatch_unit_id, barangay_id
    into v_role, v_name, v_unit, v_brgy
    from public.profiles where id = auth.uid();

  if v_role <> 'lgu_ldrrmc' then
    if v_row.unit_id is not null then
      if v_role <> 'dispatch_team' or v_row.unit_id is distinct from v_unit then
        raise exception 'Only this unit''s users may file this after-action report';
      end if;
    else
      if v_role <> 'barangay_official' then
        raise exception 'Only the barangay official may file this after-action report';
      end if;
      if v_row.target_barangay_id is distinct from v_brgy then
        raise exception 'This dispatch is outside your barangay';
      end if;
    end if;
  end if;

  v_team := v_row.team;
  v_keys := array(select jsonb_object_keys(coalesce(p_meta, '{}'::jsonb)));

  -- Validate each key against the team's whitelist. Anything else is rejected.
  foreach v_k in array v_keys loop
    if v_k = any(v_allowed_common) then
      null;
    elsif v_team = 'BFP' and v_k = any(v_allowed_bfp) then
      null;
    else
      raise exception 'After-action key "%" is not allowed for team %', v_k, v_team;
    end if;
  end loop;

  -- Build a clean meta object: keep the validated keys + prefill equipment_used
  -- from dispatch_equipment_use if the caller did not send it.
  if p_meta is null or p_meta = '{}'::jsonb then
    v_clean := '{}'::jsonb;
  else
    v_clean := p_meta;
  end if;

  -- prefill equipment_used if missing
  if not (v_clean ? 'equipment_used') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'equipment_id', eu.equipment_id,
      'identifier', coalesce(e.identifier, e.custom_label, '')
    )), '[]'::jsonb)
      into v_use_rows
      from public.dispatch_equipment_use eu
      left join public.dispatch_equipment e on e.id = eu.equipment_id
     where eu.dispatch_id = p_dispatch_id;
    v_clean := v_clean || jsonb_build_object('equipment_used', v_use_rows);
  end if;

  -- prefill times if missing
  if not (v_clean ? 'times') then
    v_clean := v_clean || jsonb_build_object(
      'times', jsonb_build_object(
        'ack_at', v_row.ack_at,
        'en_route_at', v_row.en_route_at,
        'on_scene_at', v_row.on_scene_at,
        'done_at', v_row.done_at
      )
    );
  end if;

  update public.report_dispatches
     set after_action      = left(trim(p_text), 4000),
         after_action_at   = now(),
         after_action_by   = auth.uid(),
         after_action_meta = v_clean
   where id = p_dispatch_id;

  perform public.write_audit('dispatch.after_action', 'report_dispatches', p_dispatch_id,
    jsonb_build_object('by', v_name, 'meta', v_clean));

  return jsonb_build_object('id', p_dispatch_id, 'at', now());
end;
$$;

revoke all on function public.submit_after_action(uuid, text, jsonb) from public;
grant execute on function public.submit_after_action(uuid, text, jsonb) to authenticated;

-- ============================================================================
--  B5 · equipment_catalog additions (Barangay Response Team)
-- ----------------------------------------------------------------------------
--  Adds Life vests, Sandbags, Flashlights, Megaphone, Generator to the
--  'Barangay' catalog with a short readiness checklist. Same form as
--  seed/003_dispatch_units.sql. Mirrored in the seed file for fresh installs.
--  ON CONFLICT (unit_type,label) DO NOTHING keeps re-runs safe.
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and tablename = 'equipment_catalog'
       and indexname = 'equipment_catalog_type_label_key'
  ) then
    create unique index equipment_catalog_type_label_key
      on public.equipment_catalog (unit_type, label);
  end if;
end $$;

insert into public.equipment_catalog (unit_type, label, checklist)
select v.unit_type, v.label, v.checklist::jsonb
  from (values
    ('Barangay', 'Life Vests',  '["Count","Buckles","Straps","Tear check"]'::text),
    ('Barangay', 'Sandbags',    '["Stock count","Tie integrity","Mould check"]'::text),
    ('Barangay', 'Flashlights', '["Battery","Beam test","Spare batteries","Count"]'::text),
    ('Barangay', 'Megaphone',   '["Battery","Volume test","Microphone","Siren"]'::text),
    ('Barangay', 'Generator',   '["Fuel level","Oil level","Start test","Output V"]'::text)
  ) as v(unit_type, label, checklist)
on conflict (unit_type, label) do nothing;

-- ============================================================================
--  D1 · road_status.dispatch_id + post_road_closure + reopen_road_closure
-- ----------------------------------------------------------------------------
--  PNP-only road status writes coming from a dispatch. The existing
--  road_status_write policy is is_lgu() or is_official() only, so the new
--  permission for PNP goes through SECURITY DEFINER RPCs (which write with
--  the function's privileges, not the caller's). The table RLS is unchanged.
-- ============================================================================
alter table public.road_status add column if not exists dispatch_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'road_status_dispatch_id_fkey'
  ) then
    alter table public.road_status add constraint road_status_dispatch_id_fkey
      foreign key (dispatch_id) references public.report_dispatches(id) on delete set null;
  end if;
end $$;

create index if not exists road_status_dispatch_idx
  on public.road_status (dispatch_id) where dispatch_id is not null;

create or replace function public.post_road_closure(
  p_dispatch_id       uuid,
  p_road_name         text,
  p_note              text,
  p_lat               double precision default null,
  p_lng               double precision default null,
  p_segment_from      text default '',
  p_segment_to        text default '',
  p_estimated_reopen  timestamptz default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row    public.report_dispatches;
  v_unit   public.dispatch_units;
  v_role   text;
  v_name   text;
  v_unit_id uuid;
  v_id     uuid;
  v_brgy   uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if coalesce(trim(p_road_name), '') = '' then
    raise exception 'A road name is required';
  end if;

  select role, coalesce(full_name, ''), dispatch_unit_id
    into v_role, v_name, v_unit_id
    from public.profiles where id = auth.uid();

  if v_role <> 'dispatch_team' then
    raise exception 'Only a PNP unit member may post a road closure from a dispatch';
  end if;

  select * into v_row from public.report_dispatches where id = p_dispatch_id;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.unit_id is distinct from v_unit_id then
    raise exception 'You can only post a closure from your own unit''s dispatch';
  end if;
  if v_row.dispatch_status in ('done','declined') then
    raise exception 'This dispatch is closed';
  end if;

  -- The unit must be PNP
  select * into v_unit from public.dispatch_units where id = v_unit_id;
  if v_unit.unit_type <> 'PNP' then
    raise exception 'Only a PNP unit may post a road closure from a dispatch';
  end if;

  -- barangay_id from the report
  select barangay_id into v_brgy from public.reports where id = v_row.report_id;

  insert into public.road_status
    (road_name, barangay, barangay_id, status, note, lat, lng,
     segment_from, segment_to, cause, severity, estimated_reopen,
     updated_by, created_by, updater_name, started_at)
  values
    (left(trim(p_road_name), 200),
     coalesce((select name from public.barangays where id = v_brgy), ''),
     v_brgy,
     'blocked',
     left(coalesce(p_note, ''), 1000),
     p_lat, p_lng,
     left(coalesce(p_segment_from, ''), 200),
     left(coalesce(p_segment_to, ''), 200),
     'accident',
     'warning',
     p_estimated_reopen,
     auth.uid(),
     auth.uid(),
     coalesce(v_name, ''),
     now())
  returning id into v_id;

  perform public.write_audit('road_status.posted_from_dispatch', 'road_status', v_id,
    jsonb_build_object('dispatch_id', p_dispatch_id, 'road_name', p_road_name, 'by', v_name));

  return jsonb_build_object('id', v_id, 'status', 'blocked', 'dispatch_id', p_dispatch_id);
end;
$$;

revoke all on function public.post_road_closure(uuid, text, text, double precision, double precision, text, text, timestamptz) from public;
grant execute on function public.post_road_closure(uuid, text, text, double precision, double precision, text, text, timestamptz) to authenticated;

create or replace function public.reopen_road_closure(
  p_dispatch_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row    public.report_dispatches;
  v_unit_id uuid;
  v_unit   public.dispatch_units;
  v_role   text;
  v_name   text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  select role, coalesce(full_name, ''), dispatch_unit_id
    into v_role, v_name, v_unit_id
    from public.profiles where id = auth.uid();
  if v_role <> 'dispatch_team' then
    raise exception 'Only a PNP unit member may reopen their own road closure';
  end if;

  select * into v_row from public.report_dispatches where id = p_dispatch_id;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.unit_id is distinct from v_unit_id then
    raise exception 'You can only reopen a closure posted from your own unit''s dispatch';
  end if;
  select * into v_unit from public.dispatch_units where id = v_unit_id;
  if v_unit.unit_type <> 'PNP' then
    raise exception 'Only a PNP unit may reopen a road closure';
  end if;

  update public.road_status
     set status = 'passable',
         updated_by = auth.uid(),
         updater_name = coalesce(v_name, updater_name),
         updated_at = now()
   where dispatch_id = p_dispatch_id
     and status = 'blocked'
     and created_by = auth.uid();

  if not found then
    raise exception 'No open closure posted by you was found for this dispatch';
  end if;

  perform public.write_audit('road_status.reopened', 'road_status', null,
    jsonb_build_object('dispatch_id', p_dispatch_id, 'by', v_name));

  return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', 'passable');
end;
$$;

revoke all on function public.reopen_road_closure(uuid) from public;
grant execute on function public.reopen_road_closure(uuid) to authenticated;

-- ============================================================================
--  D2 · evacuation_centers.needs_patrol + needs_patrol_at
-- ----------------------------------------------------------------------------
--  Two columns added; the existing evacuation_center_write policy already
--  limits writers to LGU + the barangay's officials, so the toggle goes
--  through Repo.updateCenter (no new RPC). PNP reads the list directly.
-- ============================================================================
alter table public.evacuation_centers add column if not exists needs_patrol    boolean not null default false;
alter table public.evacuation_centers add column if not exists needs_patrol_at timestamptz;

create index if not exists evacuation_centers_needs_patrol_idx
  on public.evacuation_centers (needs_patrol) where needs_patrol = true;

-- ============================================================================
--  D3 · relief_distributions.escort + request_relief_escort + confirm_relief_escort
-- ----------------------------------------------------------------------------
--  Columns: escort_status text default 'none' (none, requested, confirmed),
--  escort_note text, escort_unit_id uuid (the PNP unit that confirmed).
--
--  request_relief_escort(p_distribution_id, p_note):
--    · LGU or the distribution's barangay official
--    · notifies the PNP unit users (every active PNP unit's members)
--  confirm_relief_escort(p_distribution_id):
--    · caller must be a dispatch_team user of a PNP unit
--    · sets escort_status='confirmed', escort_unit_id = caller's unit
-- ============================================================================
alter table public.relief_distributions add column if not exists escort_status  text not null default 'none';
alter table public.relief_distributions add column if not exists escort_note    text not null default '';
alter table public.relief_distributions add column if not exists escort_unit_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'relief_distributions_escort_status_check') then
    alter table public.relief_distributions add constraint relief_distributions_escort_status_check
      check (escort_status in ('none','requested','confirmed'));
  end if;
end $$;

create index if not exists relief_distributions_escort_idx
  on public.relief_distributions (escort_status) where escort_status <> 'none';

create or replace function public.request_relief_escort(
  p_distribution_id uuid,
  p_note             text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row  public.relief_distributions;
  v_role text;
  v_brgy uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  select * into v_row from public.relief_distributions where id = p_distribution_id;
  if v_row.id is null then
    raise exception 'That distribution does not exist';
  end if;
  select role, coalesce(full_name, ''), barangay_id into v_role, v_name, v_brgy
    from public.profiles where id = auth.uid();
  if v_role not in ('lgu_ldrrmc','barangay_official') then
    raise exception 'Only the LGU or a barangay official may request an escort';
  end if;
  if v_role = 'barangay_official' and v_row.barangay_id is distinct from v_brgy then
    raise exception 'This distribution is outside your barangay';
  end if;
  if v_row.escort_status = 'confirmed' then
    raise exception 'This escort is already confirmed';
  end if;

  update public.relief_distributions
     set escort_status = 'requested',
         escort_note   = left(coalesce(p_note, ''), 1000)
   where id = p_distribution_id;

  -- notify every PNP unit member
  insert into public.notifications (user_id, title, body, tone, icon, type)
  select p.id,
    'Relief escort requested',
    left(coalesce(v_row.title, '') || ' · ' || coalesce(v_row.barangay, '') ||
         ' — ' || coalesce(p_note, ''), 240),
    'warning', 'shield', 'relief_escort'
    from public.profiles p
   where p.disabled = false and p.role = 'dispatch_team'
     and p.dispatch_unit_id in (
       select id from public.dispatch_units where unit_type = 'PNP' and active = true
     );

  perform public.write_audit('relief.escort_requested', 'relief_distributions', p_distribution_id,
    jsonb_build_object('by', v_name, 'note', left(coalesce(p_note, ''), 500)));

  return jsonb_build_object('id', p_distribution_id, 'escort_status', 'requested');
end;
$$;

revoke all on function public.request_relief_escort(uuid, text) from public;
grant execute on function public.request_relief_escort(uuid, text) to authenticated;

create or replace function public.confirm_relief_escort(
  p_distribution_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row     public.relief_distributions;
  v_role    text;
  v_name    text;
  v_unit_id uuid;
  v_unit    public.dispatch_units;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  select role, coalesce(full_name, ''), dispatch_unit_id
    into v_role, v_name, v_unit_id
    from public.profiles where id = auth.uid();
  if v_role <> 'dispatch_team' then
    raise exception 'Only a PNP unit member may confirm an escort';
  end if;
  select * into v_unit from public.dispatch_units where id = v_unit_id;
  if v_unit.unit_type <> 'PNP' then
    raise exception 'Only a PNP unit may confirm an escort';
  end if;
  select * into v_row from public.relief_distributions where id = p_distribution_id;
  if v_row.id is null then
    raise exception 'That distribution does not exist';
  end if;
  if v_row.escort_status = 'confirmed' then
    raise exception 'This escort is already confirmed';
  end if;

  update public.relief_distributions
     set escort_status = 'confirmed',
         escort_unit_id = v_unit_id
   where id = p_distribution_id;

  perform public.write_audit('relief.escort_confirmed', 'relief_distributions', p_distribution_id,
    jsonb_build_object('unit_id', v_unit_id, 'by', v_name));

  return jsonb_build_object('id', p_distribution_id, 'escort_status', 'confirmed', 'unit_id', v_unit_id);
end;
$$;

revoke all on function public.confirm_relief_escort(uuid) from public;
grant execute on function public.confirm_relief_escort(uuid) to authenticated;

-- ============================================================================
--  F2 · send_patient_notice (reject non-accepting hospital)
-- ----------------------------------------------------------------------------
--  Drop the existing function and re-create it with the accepting check.
--  Same signature; new body.
-- ============================================================================
drop function if exists public.send_patient_notice(uuid, uuid, int, text, timestamptz);
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

revoke all on function public.send_patient_notice(uuid, uuid, int, text, timestamptz) from public;
grant execute on function public.send_patient_notice(uuid, uuid, int, text, timestamptz) to authenticated;

-- ============================================================================
--  F1 · ack_patient_notice (allow arrived / cancelled only from sent/ack)
-- ============================================================================
drop function if exists public.ack_patient_notice(uuid, text);
create or replace function public.ack_patient_notice(
  p_notice_id uuid,
  p_status    text default 'acknowledged'
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.patient_notices;
  v_role text;
  v_unit uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_status not in ('acknowledged','arrived','cancelled') then
    raise exception 'Invalid status';
  end if;
  select * into v_row from public.patient_notices where id = p_notice_id;
  if v_row.id is null then raise exception 'That notice does not exist'; end if;
  select role, dispatch_unit_id into v_role, v_unit
    from public.profiles where id = auth.uid();
  if v_role <> 'lgu_ldrrmc' and (v_role <> 'dispatch_team' or v_unit is distinct from v_row.unit_id) then
    raise exception 'Only this hospital''s users may acknowledge the notice';
  end if;

  -- F1: arrived or cancelled are only allowed from 'sent' or 'acknowledged'
  if p_status in ('arrived','cancelled') and v_row.status not in ('sent','acknowledged') then
    raise exception 'A notice in "%" cannot move to "%"', v_row.status, p_status;
  end if;

  update public.patient_notices
     set status = p_status, ack_at = case when p_status = 'acknowledged' then now() else ack_at end
   where id = p_notice_id;

  perform public.write_audit('patient.notice_acked', 'patient_notices', p_notice_id,
    jsonb_build_object('status', p_status));

  return jsonb_build_object('id', p_notice_id, 'status', p_status);
end;
$$;

revoke all on function public.ack_patient_notice(uuid, text) from public;
grant execute on function public.ack_patient_notice(uuid, text) to authenticated;

-- ============================================================================
--  realtime + grants + schema reload
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'dispatch_help_requests'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when others then null;
    end;
  end loop;
end $$;

-- housekeeping triggers for the new table
do $$
begin
  if not exists (
    select 1 from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'dispatch_help_requests' and tg.tgname = 'dispatch_help_requests_touch'
  ) then
    execute 'create trigger dispatch_help_requests_touch before update on public.dispatch_help_requests for each row execute function public.touch_updated_at()';
  end if;
  execute 'drop trigger if exists dispatch_help_requests_audit on public.dispatch_help_requests';
  execute 'create trigger dispatch_help_requests_audit after insert or update or delete on public.dispatch_help_requests for each row execute function public.audit_row_change()';
end $$;

-- updated_at + audit for relief_distributions (escort_status changes)
do $$
begin
  if not exists (
    select 1 from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'relief_distributions' and tg.tgname = 'relief_distributions_touch'
  ) then
    execute 'create trigger relief_distributions_touch before update on public.relief_distributions for each row execute function public.touch_updated_at()';
  end if;
  execute 'drop trigger if exists relief_distributions_audit on public.relief_distributions';
  execute 'create trigger relief_distributions_audit after insert or update or delete on public.relief_distributions for each row execute function public.audit_row_change()';
end $$;

-- audit trigger for evacuation_centers (was not always on)
do $$
begin
  execute 'drop trigger if exists evacuation_centers_audit on public.evacuation_centers';
  execute 'create trigger evacuation_centers_audit after insert or update or delete on public.evacuation_centers for each row execute function public.audit_row_change()';
end $$;

-- audit trigger for road_status
do $$
begin
  execute 'drop trigger if exists road_status_audit on public.road_status';
  execute 'create trigger road_status_audit after insert or update or delete on public.road_status for each row execute function public.audit_row_change()';
end $$;

grant select on public.dispatch_help_requests to authenticated;
-- road_status, evacuation_centers and relief_distributions are already
-- grant-select'd in earlier migrations; no change needed.

commit;

notify pgrst, 'reload schema';
