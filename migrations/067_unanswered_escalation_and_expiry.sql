-- ============================================================================
--  UniGuard · 067 · Unanswered SOS and unverified reports: escalate, then expire
--
--  Before: an SOS nobody acknowledged stayed "sent" for ever (the consoles
--  stopped ringing after 24 h), and a report nobody verified was only flagged
--  "overdue" after an hour, with no notification and no end.
--
--  Now one job runs every minute (pg_cron, like 063 / 065):
--
--  SOS still "sent" (nobody acknowledged it)
--    ·  5 min  reminder to the sender's barangay officials and the LGU:
--              "Still waiting — SOS · Medical · Juan Dela Cruz"
--    · 15 min  urgent alert to every LGU account (Super Admin included):
--              "UNANSWERED 15 MIN — SOS · …"
--    · 12 h    closed automatically: status "resolved" with expired_at set
--              (the consoles show it as "Unanswered"; it stays in the SOS
--              log). The sender is told no one confirmed it and to call
--              911 / the LDRRMO hotline or send a new SOS. Officials are told.
--
--  Report still "reported" (nobody verified it)
--    ·  1 h    (already flagged overdue by refresh_overdue_reports, 051/063)
--              now the LGU and the barangay's officials are notified once.
--    ·  3 days closed automatically: status "rejected" with expired_at set
--              (shown as "Expired", reason "expired" in its history), and the
--              reporter is told to report again if the hazard is still there.
--
--  Closed items reuse the existing final statuses so every open / closed
--  count, filter and rule keeps working; expired_at is what marks them as
--  closed automatically. Each step happens once (a timestamp per step).
--  Safe to re-run. Run after 066. Needs pg_cron (Database → Extensions).
-- ============================================================================

alter table public.sos_log add column if not exists reminded_at  timestamptz;
alter table public.sos_log add column if not exists escalated_at timestamptz;
alter table public.sos_log add column if not exists expired_at   timestamptz;

alter table public.reports add column if not exists overdue_notified_at timestamptz;
alter table public.reports add column if not exists expired_at          timestamptz;

-- the app reads reports through reports_feed (036): the same view, with
-- expired_at added at the end so an expired report can show as "Expired"
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
    r.description,
    r.lat,
    r.lng,
    r.photo_path,
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
      and r.hazard_type in ('fire','power_line','vehicular_accident','landslide')
    ) as is_severity_bypass,
    ( r.status = 'reported'
      and (
        ( r.verified_at is null
          and r.created_at < now() - interval '30 minutes' )
        or r.hazard_type in ('fire','power_line','vehicular_accident','landslide')
      )
    ) as escalates_to_lgu,
    r.expired_at
from public.reports r
where
    r.reporter_id = auth.uid()
    or public.is_lgu()
    or (
        public.is_official()
        and r.barangay_id = public.my_barangay_id()
    )
    or (
        r.barangay_id is not null
        and r.barangay_id = public.my_barangay_id()
    );
alter view public.reports_feed set (security_invoker = false);
grant select on public.reports_feed to authenticated;

create or replace function public.ug_unanswered_sweep()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  x        record;
  v_label  text;
  v_who    text;
  v_phone  text;
  n_rem    int := 0;
  n_esc    int := 0;
  n_sexp   int := 0;
  n_over   int := 0;
  n_rexp   int := 0;
  v_hot    constant text := '(075) 632-2222';
begin
  -- ------------------------------------------------------------ SOS · 5 min
  for x in
    select * from public.sos_log
     where status = 'sent' and expired_at is null and reminded_at is null
       and created_at <= now() - interval '5 minutes'
       and created_at >  now() - interval '12 hours'
     for update skip locked
  loop
    v_label := case x.kind when 'medical' then 'Medical' when 'fire' then 'Fire'
                           when 'crime' then 'Crime / violence' when 'rescue' then 'Rescue' else 'Emergency' end;
    v_who   := coalesce(nullif(x.profile_name, ''), 'a resident');
    v_phone := coalesce(nullif(x.profile_phone, ''), 'the sender');
    insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
    select p.id,
           left('Still waiting — SOS · ' || v_label || ' · ' || v_who, 120),
           left('No one has acknowledged this SOS for 5 minutes. Open the SOS Log, acknowledge it, then call ' || v_phone || '.', 240),
           'warning', 'alert', 'sos', x.id
      from public.profiles p
     where p.disabled = false
       and (p.role = 'lgu_ldrrmc'
            or (x.barangay_id is not null and p.role = 'barangay_official' and p.barangay_id = x.barangay_id));
    update public.sos_log set reminded_at = now() where id = x.id;
    n_rem := n_rem + 1;
  end loop;

  -- ----------------------------------------------------------- SOS · 15 min
  for x in
    select * from public.sos_log
     where status = 'sent' and expired_at is null and escalated_at is null
       and created_at <= now() - interval '15 minutes'
       and created_at >  now() - interval '12 hours'
     for update skip locked
  loop
    v_label := case x.kind when 'medical' then 'Medical' when 'fire' then 'Fire'
                           when 'crime' then 'Crime / violence' when 'rescue' then 'Rescue' else 'Emergency' end;
    v_who   := coalesce(nullif(x.profile_name, ''), 'a resident');
    v_phone := coalesce(nullif(x.profile_phone, ''), 'the sender');
    insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
    select p.id,
           left('UNANSWERED 15 MIN — SOS · ' || v_label || ' · ' || v_who, 120),
           left('This SOS' || coalesce(' from Barangay ' || nullif(x.barangay, ''), '') ||
                ' has had no answer for 15 minutes. Acknowledge it now and call ' || v_phone || '.', 240),
           'emergency', 'alert', 'sos', x.id
      from public.profiles p
     where p.disabled = false and p.role = 'lgu_ldrrmc';
    update public.sos_log set escalated_at = now() where id = x.id;
    perform public.write_audit('sos.unanswered_escalated', 'sos_log', x.id, jsonb_build_object('minutes', 15));
    n_esc := n_esc + 1;
  end loop;

  -- ------------------------------------------------------------ SOS · 12 h
  for x in
    select * from public.sos_log
     where status = 'sent' and expired_at is null
       and created_at <= now() - interval '12 hours'
     for update skip locked
  loop
    v_label := case x.kind when 'medical' then 'Medical' when 'fire' then 'Fire'
                           when 'crime' then 'Crime / violence' when 'rescue' then 'Rescue' else 'Emergency' end;
    v_who   := coalesce(nullif(x.profile_name, ''), 'a resident');
    update public.sos_log
       set status = 'resolved', expired_at = now(), resolved_at = now(),
           resolved_by_name = 'Closed automatically (unanswered)'
     where id = x.id;
    if x.user_id is not null then
      insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
      values (x.user_id, 'Your SOS was not answered',
              'No official confirmed your SOS within 12 hours, so it was closed. If you still need help, call 911 or the Lingayen LDRRMO at ' || v_hot || ', or send a new SOS.',
              'warning', 'alert', 'sos', x.id);
    end if;
    insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
    select p.id,
           left('SOS closed unanswered · ' || v_label || ' · ' || v_who, 120),
           'No one acknowledged this SOS within 12 hours, so it was closed automatically. Follow up with the sender if you can.',
           'warning', 'alert', 'sos', x.id
      from public.profiles p
     where p.disabled = false
       and (p.role = 'lgu_ldrrmc'
            or (x.barangay_id is not null and p.role = 'barangay_official' and p.barangay_id = x.barangay_id));
    perform public.write_audit('sos.expired_unanswered', 'sos_log', x.id, jsonb_build_object('hours', 12));
    n_sexp := n_sexp + 1;
  end loop;

  -- ------------------------------------------------- reports · overdue (1 h)
  for x in
    select * from public.reports
     where status = 'reported' and expired_at is null and overdue_notified_at is null
       and created_at <= now() - interval '1 hour'
       and created_at >  now() - interval '3 days'
     for update skip locked
  loop
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select p.id,
           left('Overdue: ' || coalesce(x.code, 'a report') || ' not verified for 1 hour', 120),
           left(coalesce(nullif(x.hazard_type, ''), 'A report') || coalesce(' in Barangay ' || nullif(x.barangay, ''), '') ||
                ' is still waiting for verification. Verify or reject it from the Incident Queue.', 240),
           'warning', 'alert', 'report_status', x.id
      from public.profiles p
     where p.disabled = false
       and (p.role = 'lgu_ldrrmc'
            or (x.barangay_id is not null and p.role = 'barangay_official' and p.barangay_id = x.barangay_id));
    update public.reports set overdue_notified_at = now() where id = x.id;
    n_over := n_over + 1;
  end loop;

  -- -------------------------------------------------- reports · expire (3 d)
  for x in
    select * from public.reports
     where status = 'reported' and expired_at is null
       and created_at <= now() - interval '3 days'
     for update skip locked
  loop
    perform set_config('uniguard.reason', 'expired', true);
    update public.reports
       set status = 'rejected', expired_at = now(), escalation_status = 'cancelled'
     where id = x.id;
    if x.reporter_id is not null then
      insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
      values (x.reporter_id, 'Your report expired: ' || coalesce(x.code, ''),
              'It was not verified within 3 days, so it was closed. If the hazard is still there, please report it again.',
              'advisory', 'info', 'report_status', x.id);
    end if;
    perform public.write_audit('report.expired_unverified', 'reports', x.id, jsonb_build_object('days', 3));
    n_rexp := n_rexp + 1;
  end loop;

  return jsonb_build_object('sos_reminded', n_rem, 'sos_escalated', n_esc, 'sos_expired', n_sexp,
                            'reports_overdue_notified', n_over, 'reports_expired', n_rexp);
end;
$$;
revoke all on function public.ug_unanswered_sweep() from public, anon, authenticated;

-- every minute (pg_cron; see 063)
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron could not be enabled (%). Enable it under Database → Extensions, then run 067 again.', sqlerrm;
    return;
  end;
  begin
    perform cron.unschedule(jobid) from cron.job where jobname = 'uniguard-unanswered-sweep';
  exception when others then null;
  end;
  perform cron.schedule('uniguard-unanswered-sweep', '* * * * *', 'select public.ug_unanswered_sweep()');
end $$;

-- check:  select jobname, schedule, active from cron.job where jobname like 'uniguard-%';
