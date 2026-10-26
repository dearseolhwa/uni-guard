-- ============================================================================
--  UniGuard · 051 · Report → Resolved workflow fixes
--
--  Fixes every defect found in the end-to-end audit of the reporting flow
--  (reported → verified → dispatched → resolved). Never edits a previous
--  file's live behaviour except by create-or-replace here.
--
--   1. Auto-verification by corroboration blocked report submission.
--      guard_report_edit (027) treated the auto-verify UPDATE — which runs
--      inside the 3rd citizen's session — as a citizen editing someone
--      else's report, so the 3rd nearby report (or 3rd Confirm) failed with
--      "You can only edit your own report". It also blocked every backend
--      update (SQL editor / service role), e.g. the 045/047 backfill.
--      → guard_report_edit lets backend sessions (no auth.uid(); RLS only
--        lets `authenticated` update reports) and the two server-side
--        workflow paths (auto_corroboration, all_declined) through, the
--        latter only for a status/verified_at change.
--      → both corroboration evaluators stamp verified_at and notify.
--   2. dispatch_report_v2 failed whenever equipment was picked ("cannot
--      assign non-composite value to a record variable").
--      → typed loop variable, de-duplicated ids, row lock on the report.
--   3. Rescue "Resume" wrote dispatch_status =  'resume' (not allowed by the
--      check constraint), so a held rescue could never finish.
--      → resume returns the dispatch to on_scene (event row still says resume).
--   4. resolve_barangay took the first overlapping bounding box with no
--      ordering, so 15 of 32 barangay centres routed to a neighbour.
--      → among bbox hits, the nearest centroid wins.
--   5. advance_report_status (046) dropped the one-step pre-check, the
--      verified_* stamping (036) and the audit "from" value, and accepted
--      'reported' as a target; same-status calls succeeded and re-notified.
--      → restored + row lock (FOR UPDATE) so concurrent clicks cannot both
--        pass; reject reason and resolve closing note are required.
--   6. lgu_verify_overdue_report accepted any reported report, discarded the
--      note, stamped no verified_by_role/name and notified nobody.
--      → only for reports older than 1 hour, delegates to lgu_verify_report.
--   7. escalation_status only flipped to 'overdue' on a write, so an idle
--      report never reached the LGU queue; the queue view ran with owner
--      rights (readable by every user) and policy reports_lgu_escalation_read
--      let any barangay official read every barangay's overdue reports.
--      → lgu_escalation_queue is computed from the clock and is
--        security_invoker; the leaky policy is dropped;
--        refresh_overdue_reports() persists the flag for an optional cron.
--   8. fanout_dispatch was executable by any signed-in user (fake alerts).
--      → internal only; also takes p_skip_reporter so the reporter is not
--        notified twice for the first dispatch.
--   9. Declining the only dispatch left the report "dispatched" with no team
--      and the reporter uninformed.
--      → the report returns to verified (logged, reason all_declined) and the
--        reporter is told a new team is being arranged.
--  10. release_on_close / dispatch done / decline marked every item a report
--      ever used as available, even if it had since been redeployed.
--      → only items released by that action, and only if still 'deployed'.
--
--  Additive + idempotent. Begin/commit so it applies atomically.
-- ============================================================================

begin;

-- ============================================================================
--  1 · edit guard + corroboration
-- ============================================================================
create or replace function public.guard_report_edit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role   text;
  v_reason text := coalesce(current_setting('uniguard.reason', true), '');
begin
  -- backend sessions (SQL editor, service role, migrations): RLS only lets
  -- the `authenticated` role update reports, so a null auth.uid() here is
  -- always a trusted server-side caller.
  if auth.uid() is null then
    return new;
  end if;

  -- server-side workflow paths that run inside a citizen / responder session
  -- (security definer RPCs and triggers set uniguard.reason). They may only
  -- move the status and stamp verified_at; every other column must match.
  if v_reason in ('auto_corroboration', 'all_declined')
     and (to_jsonb(new) - array['status','verified_at','updated_at','escalation_status'])
       = (to_jsonb(old) - array['status','verified_at','updated_at','escalation_status']) then
    return new;
  end if;

  select coalesce(role, 'citizen') into v_role from public.profiles where id = auth.uid();

  -- officials / LGU are governed by their own policies and the status RPC
  if v_role in ('barangay_official', 'lgu_ldrrmc') then
    -- ...but even they may never reassign identity columns silently
    if new.reporter_id is distinct from old.reporter_id then
      raise exception 'reporter_id cannot be reassigned';
    end if;
    if new.code is distinct from old.code then
      raise exception 'The report code cannot be changed';
    end if;
    return new;
  end if;

  -- a citizen may only touch their OWN row, inside the window
  if new.reporter_id is distinct from auth.uid() or old.reporter_id is distinct from auth.uid() then
    raise exception 'You can only edit your own report';
  end if;
  if old.created_at <= now() - interval '15 minutes' then
    raise exception 'The 15-minute edit window for this report has closed';
  end if;

  -- protected columns
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

-- new-report path (trigger reports_verify, migration 022)
create or replace function public.evaluate_corroboration(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_barangay_id uuid;
  v_hazard      text;
  v_created     timestamptz;
  v_count       int;
  v_row         record;
begin
  select barangay_id, hazard_type, created_at
    into v_barangay_id, v_hazard, v_created
    from public.reports where id = p_report_id;

  if v_hazard is null or v_hazard = '' then return; end if;

  select count(distinct u) into v_count from (
    select r.reporter_id as u
      from public.reports r
     where r.hazard_type = v_hazard
       and (r.barangay_id is not distinct from v_barangay_id)
       and r.status <> 'rejected'
       and r.created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
    union
    select c.user_id
      from public.report_corroborations c
      join public.reports r2 on r2.id = c.report_id
     where r2.hazard_type = v_hazard
       and (r2.barangay_id is not distinct from v_barangay_id)
       and r2.status <> 'rejected'
       and r2.created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
  ) s
  where u is not null;

  if v_count >= 3 then
    perform set_config('uniguard.reason', 'auto_corroboration', true);
    for v_row in
      update public.reports
         set status = 'verified', verified_at = now()
       where hazard_type = v_hazard
         and (barangay_id is not distinct from v_barangay_id)
         and status = 'reported'
         and created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
      returning id, reporter_id, code
    loop
      if v_row.reporter_id is not null then
        insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
        values (v_row.reporter_id,
                'Your report was auto-verified',
                'Report ' || coalesce(v_row.code, '') || ' reached 3 independent confirmations in your barangay.',
                'prepared', 'check', 'report_status', v_row.id);
      end if;
    end loop;
  end if;
end;
$$;

-- confirm-button path (trigger on report_corroborations, migration 025 radius rule)
create or replace function public.apply_corroboration()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c_radius constant double precision := 500;
  v_barangay_id uuid;
  v_hazard      text;
  v_created     timestamptz;
  v_lat         double precision;
  v_lng         double precision;
  v_count       int;
  v_row         record;
begin
  select barangay_id, hazard_type, created_at, lat, lng
    into v_barangay_id, v_hazard, v_created, v_lat, v_lng
    from public.reports where id = new.report_id;

  if v_hazard is null then
    return new;
  end if;

  select count(distinct u) into v_count from (
    select r.reporter_id as u
      from public.reports r
     where r.hazard_type = v_hazard
       and (r.barangay_id is not distinct from v_barangay_id)
       and r.created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
       and (v_lat is null or r.lat is null
            or public.distance_m(v_lat, v_lng, r.lat, r.lng) <= c_radius)
    union
    select c.user_id
      from public.report_corroborations c
      join public.reports r2 on r2.id = c.report_id
     where r2.hazard_type = v_hazard
       and (r2.barangay_id is not distinct from v_barangay_id)
       and r2.created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
       and (v_lat is null or coalesce(c.lat, r2.lat) is null
            or public.distance_m(v_lat, v_lng, coalesce(c.lat, r2.lat), coalesce(c.lng, r2.lng)) <= c_radius)
  ) s;

  if v_count >= 3 then
    perform set_config('uniguard.reason', 'auto_corroboration', true);
    for v_row in
      update public.reports
         set status = 'verified', verified_at = now()
       where hazard_type = v_hazard
         and (barangay_id is not distinct from v_barangay_id)
         and status = 'reported'
         and created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
         and (v_lat is null or lat is null
              or public.distance_m(v_lat, v_lng, lat, lng) <= c_radius)
      returning id, reporter_id, code
    loop
      if v_row.reporter_id is not null then
        insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
        values (v_row.reporter_id,
                'Your report was auto-verified',
                'Report ' || coalesce(v_row.code, '') || ' reached 3 independent confirmations nearby.',
                'prepared', 'check', 'report_status', v_row.id);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- ============================================================================
--  9 · status guard: allow the all-declined step back (server path only)
-- ============================================================================
create or replace function public.guard_report_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  if new.status is distinct from old.status then
    v_ok := case
      when old.status = 'reported'   and new.status = 'verified'   then true
      when old.status = 'verified'   and new.status = 'dispatched' then true
      when old.status = 'dispatched' and new.status = 'resolved'   then true
      when old.status in ('reported','verified','dispatched') and new.status = 'rejected' then true
      -- every dispatch on the report was declined (decline_dispatch only)
      when old.status = 'dispatched' and new.status = 'verified'
           and coalesce(current_setting('uniguard.reason', true), '') = 'all_declined' then true
      else false
    end;

    if not v_ok then
      raise exception 'Illegal status change from % to %. The flow is reported -> verified -> dispatched -> resolved, one step at a time; rejected is allowed from any open state; resolved and rejected are final.',
        old.status, new.status;
    end if;
  end if;

  if new.status = 'resolved' and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  -- reopening guard: resolved/rejected rows must keep their resolved_at
  if new.resolved_at is distinct from old.resolved_at and new.status <> 'resolved' then
    raise exception 'resolved_at can only be set when the status becomes resolved';
  end if;
  return new;
end;
$$;

-- ============================================================================
--  4 · barangay routing: nearest centroid among overlapping boxes
-- ============================================================================
create or replace function public.resolve_barangay(p_lat double precision, p_lng double precision)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform public.validate_report_coords(p_lat, p_lng);

  -- bounding boxes overlap, so a point can sit in several: the nearest
  -- centroid among them wins
  select g.barangay_id into v_id
    from public.barangay_geoms g
   where p_lat between g.min_lat and g.max_lat
     and p_lng between g.min_lng and g.max_lng
   order by public.distance_m(p_lat, p_lng, g.centroid_lat, g.centroid_lng)
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select g.barangay_id into v_id
    from public.barangay_geoms g
   order by public.distance_m(p_lat, p_lng, g.centroid_lat, g.centroid_lng)
   limit 1;
  return v_id;
end;
$$;

-- ============================================================================
--  5 · advance_report_status (036 behaviour + 046 Super Admin block)
-- ============================================================================
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

  if v_is_super and v_row.status = 'reported' and p_next = 'verified' then
    raise exception 'Super Admin cannot verify reports. Use Edit to correct the record instead.';
  end if;

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

revoke all on function public.advance_report_status(uuid, text, text) from public, anon;
grant execute on function public.advance_report_status(uuid, text, text) to authenticated;

-- ============================================================================
--  6 · LGU verify paths
-- ============================================================================
create or replace function public.lgu_verify_report(p_report_id uuid, p_note text default '')
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row      public.reports;
  v_role     text;
  v_name     text;
  v_is_super boolean := false;
  v_note     text := trim(coalesce(p_note, ''));
  v_reporter uuid;
  v_code     text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  select role, coalesce(full_name, ''), coalesce(is_super_admin, false)
    into v_role, v_name, v_is_super
    from public.profiles where id = auth.uid();

  if v_role is null then
    raise exception 'Your account could not be loaded';
  end if;
  if v_role <> 'lgu_ldrrmc' then
    raise exception 'Only LGU / LDRRMC can LGU-verify a report';
  end if;
  if v_is_super then
    raise exception 'Super Admin cannot verify reports. Use Edit to correct the record instead.';
  end if;

  select * into v_row from public.reports where id = p_report_id for update;
  if v_row.id is null then
    raise exception 'That report does not exist';
  end if;
  if v_row.status <> 'reported' then
    raise exception 'Only a report still in "reported" can be LGU-verified (it is "%")', v_row.status;
  end if;

  perform set_config('uniguard.reason', 'lgu_verify', true);
  perform set_config('uniguard.note',  v_note, true);

  update public.reports
     set status           = 'verified',
         verified_by      = auth.uid(),
         verified_by_name = v_name,
         verified_by_role = 'lgu_ldrrmc',
         verified_at      = now()
   where id = p_report_id
   returning * into v_row;

  perform public.write_audit('report.lgu_verified', 'reports', p_report_id,
    jsonb_build_object('note', left(v_note, 300), 'verified_by', v_name));

  v_reporter := v_row.reporter_id;
  v_code     := coalesce(v_row.code, '');
  if v_reporter is not null then
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    values (v_reporter,
            'Your report was LGU-verified',
            'Report ' || v_code || ' was verified by the Municipal DRRMO' ||
              case when v_note <> '' then ' — ' || left(v_note, 140) else '' end,
            'prepared', 'shield', 'report_status', v_row.id);
  end if;

  return jsonb_build_object('id', v_row.id, 'code', v_row.code, 'status', v_row.status,
                            'verified_by', v_name, 'verified_by_role', 'lgu_ldrrmc');
end;
$$;

revoke all on function public.lgu_verify_report(uuid, text) from public, anon;
grant execute on function public.lgu_verify_report(uuid, text) to authenticated;

-- the overdue path is now a thin, stricter wrapper around lgu_verify_report
drop function if exists public.lgu_verify_overdue_report(uuid);
create or replace function public.lgu_verify_overdue_report(p_report_id uuid, p_note text default '')
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row  public.reports;
  v_role text;
  v_res  jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'lgu_ldrrmc' then
    raise exception 'Only LGU staff can verify overdue reports' using errcode = '42501';
  end if;

  select * into v_row from public.reports where id = p_report_id for update;
  if v_row.id is null then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if v_row.status in ('verified', 'dispatched', 'resolved') then
    return jsonb_build_object('ok', true, 'already_verified', true, 'report_id', p_report_id,
                              'status', v_row.status);
  end if;
  if v_row.status <> 'reported' then
    raise exception 'This report is "%" and cannot be verified', v_row.status;
  end if;
  if v_row.created_at > now() - interval '1 hour' then
    raise exception 'This report is not overdue yet. Use LGU-Verify instead.';
  end if;

  v_res := public.lgu_verify_report(p_report_id,
    trim('Overdue: not verified by the barangay within 1 hour. ' || coalesce(p_note, '')));

  return v_res || jsonb_build_object('ok', true, 'report_id', p_report_id,
    'overdue_minutes', round((extract(epoch from (now() - v_row.created_at)) / 60.0)::numeric, 1));
end;
$$;

revoke all on function public.lgu_verify_overdue_report(uuid, text) from public, anon;
grant execute on function public.lgu_verify_overdue_report(uuid, text) to authenticated;

-- ============================================================================
--  7 · escalation queue computed from the clock
-- ============================================================================
drop policy if exists "reports_lgu_escalation_read" on public.reports;

drop view if exists public.lgu_escalation_queue;
create view public.lgu_escalation_queue
with (security_invoker = true) as
select
  r.id, r.code, r.hazard_type, r.barangay, r.barangay_id,
  r.severity, r.description, r.status,
  r.created_at,
  extract(epoch from (now() - r.created_at)) / 60.0 as minutes_since_submission,
  'overdue'::text as escalation_status
from public.reports r
where r.status = 'reported'
  and r.created_at <= now() - interval '1 hour'
order by r.created_at asc;

comment on view public.lgu_escalation_queue is
  'Reports still unverified 1 hour after submission, computed at read time. security_invoker: each caller sees only the reports RLS lets them read (the LGU sees all).';

revoke all on public.lgu_escalation_queue from anon;
grant select on public.lgu_escalation_queue to authenticated;

-- keeps the persisted reports.escalation_status in step with the clock.
-- Optional: schedule with pg_cron, e.g.
--   select cron.schedule('ug-overdue', '*/5 * * * *', 'select public.refresh_overdue_reports()');
create or replace function public.refresh_overdue_reports()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  perform set_config('uniguard.reason', 'escalation', true);
  update public.reports
     set escalation_status = 'overdue'
   where status = 'reported'
     and escalation_status = 'pending'
     and created_at <= now() - interval '1 hour';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.refresh_overdue_reports() from public, anon, authenticated;

-- ============================================================================
--  8 · fanout_dispatch: internal only, optional reporter skip
-- ============================================================================
drop function if exists public.fanout_dispatch(uuid, uuid, text, uuid, uuid, text);
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
     where p.disabled = false
       and (
         (p.id = v_row.reporter_id and not p_skip_reporter)
         or p.role in ('lgu_ldrrmc')
         or (v_row.barangay_id is not null and p.barangay_id = v_row.barangay_id)
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
           'warning', 'truck', 'unit_dispatch', v_row.id
      from public.profiles p
     where p.disabled = false
       and p.role = 'dispatch_team'
       and p.dispatch_unit_id = p_unit_id;
  end if;

  return v_count;
end;
$$;

-- only called from dispatch_report_v2 (security definer); never by a client
revoke all on function public.fanout_dispatch(uuid, uuid, text, uuid, uuid, text, boolean) from public, anon, authenticated;

-- ============================================================================
--  2 · dispatch_report_v2: equipment loop + row lock + single reporter notice
-- ============================================================================
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
    from public.profiles where id = auth.uid();

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

revoke all on function public.dispatch_report_v2(uuid, text, text, timestamptz, uuid, uuid, uuid[]) from public, anon;
grant execute on function public.dispatch_report_v2(uuid, text, text, timestamptz, uuid, uuid, uuid[]) to authenticated;

-- ============================================================================
--  10 · equipment release helper (only items this action releases)
-- ============================================================================
create or replace function public.release_dispatch_equipment(p_dispatch_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  with released as (
    update public.dispatch_equipment_use
       set released_at = now()
     where released_at is null
       and dispatch_id = any(p_dispatch_ids)
    returning equipment_id
  )
  update public.dispatch_equipment e
     set status = 'available'
   where e.id in (select equipment_id from released)
     and e.status = 'deployed';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.release_dispatch_equipment(uuid[]) from public, anon, authenticated;

create or replace function public.release_on_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('resolved','rejected') and old.status not in ('resolved','rejected') then
    -- close every open dispatch on this report (declined ones stay declined)
    update public.report_dispatches
       set dispatch_status = 'done',
           done_at = coalesce(done_at, now())
     where report_id = new.id
       and dispatch_status not in ('done','declined');
    perform public.release_dispatch_equipment(
      array(select id from public.report_dispatches where report_id = new.id));
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

-- ============================================================================
--  3 · dispatch_respond: resume returns to on_scene
-- ============================================================================
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

revoke all on function public.dispatch_respond(uuid, text, text) from public, anon;
grant execute on function public.dispatch_respond(uuid, text, text) to authenticated;

-- ============================================================================
--  9 + 10 · decline_dispatch
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
  v_row      public.report_dispatches;
  v_role     text;
  v_name     text;
  v_unit     uuid;
  v_brgy     uuid;
  v_report   public.reports;
  v_reverted boolean := false;
begin
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

revoke all on function public.decline_dispatch(uuid, text) from public, anon;
grant execute on function public.decline_dispatch(uuid, text) to authenticated;

commit;
