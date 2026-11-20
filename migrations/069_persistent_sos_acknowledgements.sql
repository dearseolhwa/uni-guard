begin;

alter table public.sos_log add column if not exists requires_staff_receipt boolean not null default false;
alter table public.sos_log alter column requires_staff_receipt set default true;
update public.sos_log set requires_staff_receipt = true where status = 'sent';

create table if not exists public.sos_staff_receipts (
  sos_id uuid not null references public.sos_log(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (staff_id, sos_id)
);

alter table public.sos_staff_receipts enable row level security;
drop policy if exists sos_staff_receipts_own on public.sos_staff_receipts;
create policy sos_staff_receipts_own on public.sos_staff_receipts for select to authenticated
  using (staff_id = auth.uid() and public.is_active_user());
grant select on public.sos_staff_receipts to authenticated;

create or replace function public.is_sos_duty_staff(p_barangay uuid, p_barangay_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and not p.disabled
    and (p.role = 'lgu_ldrrmc' or (
      p.role = 'barangay_official' and (
        (p_barangay is not null and p.barangay_id = p_barangay)
        or (p_barangay is null and nullif(p_barangay_name, '') = p.barangay)
      )
    ))
  );
$$;
revoke all on function public.is_sos_duty_staff(uuid, text) from public, anon;
grant execute on function public.is_sos_duty_staff(uuid, text) to authenticated;

create or replace function public.list_pending_sos_receipts()
returns setof public.sos_log language sql stable security definer set search_path = public as $$
  select s.* from public.sos_log s
  where s.requires_staff_receipt and s.user_id is distinct from auth.uid()
    and public.is_sos_duty_staff(s.barangay_id, s.barangay)
    and not exists (select 1 from public.sos_staff_receipts r where r.staff_id = auth.uid() and r.sos_id = s.id)
  order by s.created_at;
$$;
revoke all on function public.list_pending_sos_receipts() from public, anon;
grant execute on function public.list_pending_sos_receipts() to authenticated;

do $$
declare watched text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach watched in array array['sos_log', 'notifications', 'sos_staff_receipts', 'report_dispatches'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                       and schemaname = 'public' and tablename = watched) then
        execute format('alter publication supabase_realtime add table public.%I', watched);
      end if;
    end loop;
  end if;
end $$;

create or replace function public.update_sos_status(p_sos_id uuid, p_status text)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare
  v_row    public.sos_log;
  v_role   text;
  v_name   text;
  v_brgy   text;
  v_office text;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_status not in ('acknowledged', 'resolved') then
    raise exception 'Unknown SOS status: %', p_status;
  end if;

  select role, coalesce(nullif(full_name, ''), 'An official'), coalesce(barangay, '')
    into v_role, v_name, v_brgy
    from public.profiles where id = auth.uid() and not disabled;
  if v_role is null or v_role not in ('barangay_official', 'lgu_ldrrmc') then
    raise exception 'Only officials and LGU can update an SOS';
  end if;
  v_office := case when v_role = 'lgu_ldrrmc' then 'Lingayen LDRRMO'
                   when v_brgy <> '' then 'Barangay ' || v_brgy
                   else 'your barangay' end;

  select * into v_row from public.sos_log where id = p_sos_id for update;
  if v_row.id is null then raise exception 'That SOS entry does not exist'; end if;

  if not public.is_sos_duty_staff(v_row.barangay_id, v_row.barangay) then
    raise exception 'That SOS entry is outside your duty area';
  end if;
  if p_status = 'acknowledged' then
    insert into public.sos_staff_receipts (sos_id, staff_id) values (p_sos_id, auth.uid())
    on conflict do nothing;
    if found then
      perform public.write_audit('sos.staff_acknowledged', 'sos_log', p_sos_id, '{}'::jsonb);
    end if;
  elsif v_row.status = 'sent' or (v_row.requires_staff_receipt and not exists (
    select 1 from public.sos_staff_receipts where staff_id = auth.uid() and sos_id = p_sos_id
  )) then
    raise exception 'Acknowledge this SOS before resolving it';
  end if;

  -- already answered: say who did it first, change nothing, notify no one
  if p_status = 'acknowledged' and v_row.status <> 'sent' then
    return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'already', true,
      'by', v_row.acknowledged_by_name, 'office', v_row.acknowledged_by_office, 'at', v_row.acknowledged_at);
  end if;
  if p_status = 'resolved' and v_row.status = 'resolved' then
    return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'already', true,
      'by', v_row.resolved_by_name, 'at', v_row.resolved_at);
  end if;

  if p_status = 'acknowledged' then
    update public.sos_log
       set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now(),
           acknowledged_by_name = v_name, acknowledged_by_office = v_office
     where id = p_sos_id returning * into v_row;
  else
    update public.sos_log
       set status = 'resolved', resolved_by = auth.uid(), resolved_at = now(), resolved_by_name = v_name,
           -- resolving straight from "sent" also counts as answering it
           acknowledged_by = coalesce(acknowledged_by, auth.uid()),
           acknowledged_at = coalesce(acknowledged_at, now()),
           acknowledged_by_name = case when acknowledged_by_name = '' then v_name else acknowledged_by_name end,
           acknowledged_by_office = case when acknowledged_by_office = '' then v_office else acknowledged_by_office end
     where id = p_sos_id returning * into v_row;
  end if;

  perform public.write_audit('sos.status_changed', 'sos_log', p_sos_id,
    jsonb_build_object('to', p_status, 'by', v_name, 'office', v_office));

  -- tell the sender who picked it up / closed it
  if v_row.user_id is not null then
    insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
    values (v_row.user_id,
            case p_status when 'acknowledged' then 'Your SOS was received — help is being arranged'
                          else 'Your SOS is resolved' end,
            case p_status
              when 'acknowledged' then 'Received by ' || v_office || ' (' || v_name || '). Stay where you are if it is safe; help is being arranged.'
              else 'Closed by ' || v_office || ' (' || v_name || '). If you still need help, send a new SOS or call the hotline.' end,
            case p_status when 'acknowledged' then 'warning' else 'prepared' end,
            'check', 'sos', v_row.id);
  end if;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'by', v_name, 'office', v_office,
    'at', case p_status when 'acknowledged' then v_row.acknowledged_at else v_row.resolved_at end);
end;
$$;

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
  n_over   int := 0;
  n_rexp   int := 0;
  v_hot    constant text := '(075) 632-2222';
begin
  -- ------------------------------------------------------------ SOS · 5 min
  for x in
    select * from public.sos_log
     where status = 'sent' and expired_at is null and reminded_at is null
       and created_at <= now() - interval '5 minutes'
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

  return jsonb_build_object('sos_reminded', n_rem, 'sos_escalated', n_esc, 'sos_expired', 0,
                            'reports_overdue_notified', n_over, 'reports_expired', n_rexp);
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
     where p.disabled = false
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
           'warning', 'truck', 'unit_dispatch', v_row.id
      from public.profiles p
     where p.disabled = false
       and p.role = 'dispatch_team'
       and p.dispatch_unit_id = p_unit_id;
  end if;

  return v_count;
end;
$$;

commit;
