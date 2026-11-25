-- ============================================================================
--  UniGuard · 066 · Alert when an SOS could not dispatch a team
--
--  submit_sos (060) sends teams automatically only when the SOS has a GPS
--  position inside Lingayen. Without one (location off, no fix, outside the
--  service area) no report is made and nobody is sent, and the officials only
--  got the general "SOS · …" alert. Now, the moment such an SOS is saved, the
--  duty officers and the officials of the sender's barangay get a second,
--  urgent alert that says no team went out and what to do:
--
--    "NO TEAM SENT — SOS · Medical · Juan Dela Cruz"
--    "No GPS location, so no team was dispatched. Call 0917… to find out
--     where they are, then send a team from the Incident Queue."
--
--  It is a notification of type 'sos', so it rings the alarm in the consoles
--  in real time. It also fires when the SOS had a position but every team
--  had no free unit.
--
--  A deferred trigger checks at the end of the SOS transaction, after
--  submit_sos has tried to dispatch, so it sees the final result.
--  Safe to re-run. Run after 065.
-- ============================================================================

create or replace function public.ug_sos_no_team_alert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_row    public.sos_log;
  v_label  text;
  v_why    text;
  v_teams  int := 0;
begin
  select * into v_row from public.sos_log where id = new.id;
  if v_row.id is null or v_row.status = 'resolved' then
    return null;
  end if;

  if v_row.report_id is not null then
    select count(*) into v_teams from public.report_dispatches d
     where d.report_id = v_row.report_id and d.dispatch_status not in ('done', 'declined');
    if v_teams > 0 then
      return null;   -- teams are on the way: nothing extra to say
    end if;
    v_why := 'No free unit could be sent automatically.';
  elsif v_row.lat is null or v_row.lng is null then
    v_why := 'No GPS location, so no team was dispatched.';
  else
    v_why := 'The location could not be turned into a report (for example, outside Lingayen), so no team was dispatched.';
  end if;

  v_label := case v_row.kind when 'medical' then 'Medical' when 'fire' then 'Fire'
                             when 'crime' then 'Crime / violence' when 'rescue' then 'Rescue' else 'Emergency' end;

  insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
  select p.id,
         left('NO TEAM SENT — SOS · ' || v_label || ' · ' || coalesce(nullif(v_row.profile_name, ''), 'a resident'), 120),
         left(v_why || ' Call ' || coalesce(nullif(v_row.profile_phone, ''), 'the sender') ||
              ' to find out where they are, then send a team from the Incident Queue.', 240),
         'emergency', 'alert', 'sos', v_row.id
    from public.profiles p
   where p.disabled = false
     and (p.role = 'lgu_ldrrmc'
          or (v_row.barangay_id is not null and p.role = 'barangay_official' and p.barangay_id = v_row.barangay_id));

  perform public.write_audit('sos.no_team', 'sos_log', v_row.id, jsonb_build_object('reason', v_why));
  return null;
end;
$$;
revoke all on function public.ug_sos_no_team_alert() from public, anon, authenticated;

drop trigger if exists sos_no_team_alert on public.sos_log;
create constraint trigger sos_no_team_alert
  after insert on public.sos_log
  deferrable initially deferred
  for each row execute function public.ug_sos_no_team_alert();
