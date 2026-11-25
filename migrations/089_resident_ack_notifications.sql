-- =============================================================================
--  UniGuard · 089 · Resident acknowledgement notices; old SOS stop nagging
-- =============================================================================
--  Run after 088.
--
--  dispatch_respond() (073) notifies the reporter from "on scene" onwards, and
--  fanout_dispatch() (084) when a team is sent. The two steps in between, a
--  unit acknowledging the dispatch and heading out, reached only staff, so a
--  resident who sent a report or SOS heard nothing until the team arrived.
--
--  This trigger fills that gap for every way the status can change: the
--  dispatch portal, the GPS tracker (update_dispatch_location) and staff.
--  Only 'acknowledged' and 'en_route' are handled here; every other status
--  already notifies the reporter, so nothing is sent twice.
-- =============================================================================
begin;

create or replace function public.notify_reporter_dispatch_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_report public.reports;
  v_title  text;
  v_body   text;
begin
  if new.dispatch_status is not distinct from old.dispatch_status
     or new.dispatch_status not in ('acknowledged', 'en_route') then
    return null;
  end if;
  select * into v_report from public.reports where id = new.report_id;
  if v_report.id is null or v_report.reporter_id is null then return null; end if;

  v_title := case new.dispatch_status
    when 'acknowledged' then new.team || ' received your report'
    else new.team || ' is on the way'
  end;
  v_body := case new.dispatch_status
    when 'acknowledged' then 'Help for ' || coalesce(v_report.code, 'your report') || ' has been acknowledged.'
    else 'Responders are heading to ' || coalesce(v_report.code, 'your report') || '.'
  end;

  insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
  values (v_report.reporter_id, left(v_title, 120), v_body, 'prepared', 'truck', 'dispatch_status', v_report.id);
  return null;
end;
$$;

revoke all on function public.notify_reporter_dispatch_progress() from public, anon, authenticated;

drop trigger if exists report_dispatches_notify_reporter on public.report_dispatches;
create trigger report_dispatches_notify_reporter
  after update of dispatch_status on public.report_dispatches
  for each row execute function public.notify_reporter_dispatch_progress();

-- -----------------------------------------------------------------------------
--  A finished SOS no longer asks every officer for a receipt
-- -----------------------------------------------------------------------------
--  069 asks each duty officer to acknowledge every SOS personally, and kept
--  asking after the SOS was over: one resolved or expired days ago still showed
--  as "waiting" (and rang) on the console of anyone who had not tapped it.
--  Now only an SOS that is still open asks for a receipt. An SOS nobody has
--  answered still stays open until someone does (069's rule is unchanged).
create or replace function public.list_pending_sos_receipts()
returns setof public.sos_log language sql stable security definer set search_path = public as $$
  select s.* from public.sos_log s
  where s.requires_staff_receipt and s.user_id is distinct from auth.uid()
    and s.status <> 'resolved' and s.expired_at is null
    and public.is_sos_duty_staff(s.barangay_id, s.barangay)
    and not exists (select 1 from public.sos_staff_receipts r where r.staff_id = auth.uid() and r.sos_id = s.id)
  order by s.created_at;
$$;
revoke all on function public.list_pending_sos_receipts() from public, anon;
grant execute on function public.list_pending_sos_receipts() to authenticated;

-- a finished SOS needs no receipts at all
update public.sos_log set requires_staff_receipt = false
 where requires_staff_receipt and (status = 'resolved' or expired_at is not null);

commit;
