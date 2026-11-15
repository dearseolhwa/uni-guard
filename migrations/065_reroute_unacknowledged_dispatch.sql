-- ============================================================================
--  UniGuard · 065 · Re-send a dispatch nobody acknowledges
--
--  Auto-dispatch (057 / 060) picks the nearest unit marked "available". If
--  that unit is in fact busy, off-shift or out of signal, nobody answers and
--  the emergency waits. Now, every minute:
--
--    · a municipal unit (BFP, PNP, Rescue Unit, Ambulance) that has not
--      acknowledged its dispatch within 3 minutes is taken off it (status
--      "declined", reason "No acknowledgement within 3 min"), and
--    · the same team is sent to the next nearest unit that has not been tried
--      on this report yet, with the same instructions; the new unit is
--      alerted exactly like a normal dispatch;
--    · the LGU is told either way: "Re-sent: <unit A> did not respond, sent
--      to <unit B>", or "No response and no other unit: dispatch by hand";
--    · if no team is left on the report at all, the report returns to
--      "verified" so it shows up as needing a dispatch again (and the
--      reporter is told a new team is being arranged).
--
--  The Barangay Response Team has no unit to swap, so it is never re-routed.
--  A unit that is re-routed is not picked again for the same report.
--  Uses pg_cron like 063 (enable it under Database → Extensions).
--
--  Safe to re-run. Run after 064.
-- ============================================================================

alter table public.report_dispatches add column if not exists rerouted_from      uuid references public.report_dispatches(id) on delete set null;
alter table public.report_dispatches add column if not exists no_ack_rerouted_at timestamptz;

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
     where u.active = true and u.unit_type = v_type and u.status <> 'off_duty'
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
revoke all on function public.ug_reroute_unacknowledged(int) from public, anon, authenticated;

-- run it every minute (pg_cron; see 063)
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron could not be enabled (%). Enable it under Database → Extensions, then run 065 again.', sqlerrm;
    return;
  end;
  begin
    perform cron.unschedule(jobid) from cron.job where jobname = 'uniguard-reroute-unacknowledged';
  exception when others then null;
  end;
  perform cron.schedule('uniguard-reroute-unacknowledged', '* * * * *', 'select public.ug_reroute_unacknowledged(3)');
end $$;

-- check:  select jobname, schedule, active from cron.job where jobname like 'uniguard-%';
