begin;

-- Older receipts may contain duplicates. The receipt lock makes future RPC
-- retries idempotent without rewriting the existing audit records.
create or replace function public.acknowledge_emergency_advisory(p_advisory_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then
    raise insufficient_privilege using message = 'Sign in with an active account to acknowledge this advisory';
  end if;
  if not exists (select 1 from public.advisories where id = p_advisory_id and severity = 'emergency') then
    raise insufficient_privilege using message = 'This emergency advisory is unavailable for your account';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('advisory-receipt:' || v_user::text || ':' || p_advisory_id::text, 0));
  insert into public.alert_acknowledgments(user_id, advisory_id)
    select v_user, p_advisory_id
    where not exists (
      select 1 from public.alert_acknowledgments where user_id = v_user and advisory_id = p_advisory_id
    );
end;
$$;
revoke all on function public.acknowledge_emergency_advisory(uuid) from public, anon;
grant execute on function public.acknowledge_emergency_advisory(uuid) to authenticated;

-- Number reports against the full register, including entries outside a
-- barangay user's read scope and entries older than the console history.
create index if not exists situation_reports_normalized_event_idx
  on public.situation_reports(lower(btrim(event_name)), sitrep_no desc);

create or replace function public.number_situation_report()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event text;
begin
  new.event_name := btrim(new.event_name);
  v_event := lower(new.event_name);
  if nullif(v_event, '') is null then
    raise invalid_parameter_value using message = 'Enter an event name before issuing a situation report';
  end if;
  if new.period_from > new.period_to then
    raise invalid_parameter_value using message = 'The reporting period must start on or before its end date';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('situation-report-event:' || v_event, 0));
  select coalesce(max(sitrep_no), 0) + 1 into new.sitrep_no
    from public.situation_reports where lower(btrim(event_name)) = v_event;
  return new;
end;
$$;

drop trigger if exists situation_reports_number on public.situation_reports;
create trigger situation_reports_number before insert on public.situation_reports
  for each row execute function public.number_situation_report();

create or replace function public.issue_situation_report(p_request_id uuid, p_report jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_barangay_id uuid := nullif(p_report->>'barangay_id', '')::uuid;
  v_barangay text := '';
  v_saved public.situation_reports;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked()
     or not (public.is_lgu() or (public.is_official() and v_barangay_id is not null and v_barangay_id = public.my_barangay_id())) then
    raise insufficient_privilege using message = 'You can only issue situation reports within your assigned scope';
  end if;
  if p_request_id is null then
    raise invalid_parameter_value using message = 'The situation report is missing its request ID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('situation-report-request:' || p_request_id::text, 0));
  select * into v_saved from public.situation_reports where id = p_request_id and created_by = v_user;
  if found then return to_jsonb(v_saved); end if;
  if v_barangay_id is not null then
    select name into v_barangay from public.barangays where id = v_barangay_id;
    if not found then raise invalid_parameter_value using message = 'Choose a valid barangay'; end if;
  end if;

  insert into public.situation_reports (
    id, event_name, period_from, period_to, barangay_id, barangay, summary, remarks, prepared_by_name, created_by
  ) values (
    p_request_id, coalesce(p_report->>'event_name', ''), (p_report->>'period_from')::date, (p_report->>'period_to')::date,
    v_barangay_id, v_barangay, coalesce(p_report->'summary', '{}'::jsonb), coalesce(p_report->>'remarks', ''),
    coalesce((select full_name from public.profiles where id = v_user), ''), v_user
  ) returning * into v_saved;
  return to_jsonb(v_saved);
end;
$$;
revoke all on function public.issue_situation_report(uuid, jsonb) from public, anon;
grant execute on function public.issue_situation_report(uuid, jsonb) to authenticated;

-- A declaration retried after a lost response keeps the bulletin, audit
-- entry and alert count from its first successful publication.
create or replace function public.declare_emergency_once(p_request_id uuid, p_title text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_devices integer := public.emergency_push_device_count();
  v_audit jsonb;
  v_advisory jsonb;
begin
  if p_request_id is null then
    raise invalid_parameter_value using message = 'The emergency declaration is missing its request ID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('declare-emergency:' || p_request_id::text, 0));
  select meta into v_audit from public.audit_log
   where actor_id = auth.uid() and entity = 'advisories' and entity_id = p_request_id and action = 'emergency.declared'
   limit 1;
  if found then
    return jsonb_build_object('advisory_id', p_request_id, 'devices', v_audit->'subscribed_devices', 'notified', v_audit->'notified');
  end if;
  if exists (select 1 from public.advisories where id = p_request_id) then
    raise unique_violation using message = 'This declaration reference is already in use';
  end if;

  perform public.check_rate_limit('declare', 3, interval '30 minutes');
  v_advisory := public.publish_advisory(p_request_id, jsonb_build_object(
    'title', p_title, 'body', p_body, 'citywide', true, 'severity', 'emergency', 'kind', 'emergency'
  ));
  perform public.write_audit('emergency.declared', 'advisories', p_request_id,
    jsonb_build_object('title', p_title, 'area', 'Municipality-wide', 'subscribed_devices', v_devices, 'notified', v_advisory->'reached'));
  return jsonb_build_object('advisory_id', p_request_id, 'devices', v_devices, 'notified', v_advisory->'reached');
end;
$$;
revoke all on function public.declare_emergency_once(uuid, text, text) from public, anon;
grant execute on function public.declare_emergency_once(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
