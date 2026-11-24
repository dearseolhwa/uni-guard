begin;

-- Keep the existing feed contract and append fields used by newer clients.
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
    case when access.is_sos and not access.has_details then 'Emergency SOS reported in this barangay.'
         else r.description end as description,
    case when not access.is_sos or access.has_details then r.lat end as lat,
    case when not access.is_sos or access.has_details then r.lng end as lng,
    case when access.has_details then r.photo_path end as photo_path,
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
    r.expired_at,
    case when access.has_details then r.location_note else '' end as location_note,
    access.is_sos as is_sos
from public.reports r
cross join lateral (
    select (
        coalesce(r.verified_by_name = 'SOS', false)
        or exists (select 1 from public.sos_log s where s.report_id = r.id)
    ) as is_sos,
    coalesce((
        r.reporter_id = (select auth.uid())
        or public.owns_linked_sos(r.id)
        or (select public.is_lgu())
        or ((select public.is_official()) and r.barangay_id = (select public.my_barangay_id()))
    ), false) as has_details
) access
where (select public.is_active_user())
  and not (select public.account_session_blocked())
  and (access.has_details or r.barangay_id = (select public.my_barangay_id()));
alter view public.reports_feed set (security_invoker = false);
grant select on public.reports_feed to authenticated;

-- New SOS reports carry a neutral description. Contact and notes remain in the SOS log.
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
begin
  if not public.is_active_user() or public.account_session_blocked() then
    raise insufficient_privilege using message='Sign in with an active account to send an SOS';
  end if;
  if v_kind not in ('medical', 'fire', 'crime', 'rescue', 'other') then
    raise exception 'Unknown SOS type: %', p_kind;
  end if;

  perform public.check_rate_limit('sos', 5, interval '10 minutes');

  select full_name, phone, barangay, barangay_id into v_prof from public.profiles where id = auth.uid();

  -- the barangay where the emergency is; the profile's when that is unknown
  if p_lat is not null and p_lng is not null then
    begin
      v_brgy_id := public.resolve_barangay(p_lat, p_lng);
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

  insert into public.sos_log (user_id, profile_name, profile_phone, barangay, barangay_id, lat, lng, accuracy, note, kind)
  values (auth.uid(),
          coalesce(v_prof.full_name, ''),
          coalesce(v_prof.phone, ''),
          v_brgy,
          v_brgy_id,
          p_lat, p_lng, p_accuracy, coalesce(p_note, ''), v_kind)
  returning * into v_row;
  v_id := v_row.id;

  -- duty officers + the officials of the barangay of the emergency
  with targets as (
    select p.id from public.profiles p
     where p.disabled = false
       and (p.role = 'lgu_ldrrmc'
            or (v_brgy_id is not null and p.role = 'barangay_official' and p.barangay_id = v_brgy_id))
  ), ins as (
    insert into public.notifications (user_id, title, body, tone, icon, type, sos_id)
    select id,
           'SOS · ' || v_label || ' · ' || coalesce(v_prof.full_name, 'a resident'),
           coalesce(v_prof.phone, '') || ' · ' || v_brgy ||
           ' · ' || coalesce(round(p_accuracy::numeric)::text || ' m', 'no GPS fix'),
           'emergency', 'alert', 'sos', v_id
      from targets
    returning 1
  )
  select count(*) into v_reach from ins;

  -- an SOS with a position becomes an emergency report and its teams are
  -- sent at once. If that fails (outside Lingayen, report limit) the SOS
  -- itself still stands and the duty officers handle it.
  if p_lat is not null and p_lng is not null then
    begin
      insert into public.reports (hazard_type, hazard_other_text, barangay, description, severity, urgency, lat, lng)
      values (case when v_kind = 'fire' then 'Fire' else 'Others' end,
              case when v_kind = 'fire' then null else 'SOS: ' || v_label end,
              v_brgy,
              'SOS (' || v_label || ')',
              'emergency', 'emergency', p_lat, p_lng)
      returning id into v_rep;

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
                       'dispatched', v_sent, 'report_error', nullif(v_err, '')));

  return jsonb_build_object('id', v_id, 'reach', v_reach, 'kind', v_kind,
                            'report_id', v_rep, 'dispatched', v_sent, 'team', v_names);
end;
$$;

revoke all on function public.submit_sos(double precision, double precision, double precision, text, text) from public;
grant execute on function public.submit_sos(double precision, double precision, double precision, text, text) to authenticated;

create index if not exists reports_reporter_history_idx
  on public.reports (reporter_id, created_at desc, id desc);

create index if not exists report_status_history_replacement_idx
  on public.report_status_history (report_id, created_at desc)
  where reason = 'all_declined';

-- A report with no remaining team stays on the duty queue until it is
-- assigned or closed. Staff make the assignment decision.
create or replace view public.dispatch_replacement_queue as
select r.id as report_id, r.code, r.barangay, r.severity,
       h.created_at as waiting_since, h.created_at + interval '3 minutes' as review_by,
       now() >= h.created_at + interval '3 minutes' as is_overdue
from public.reports r
cross join lateral (
  select created_at from public.report_status_history
  where report_id = r.id and reason = 'all_declined'
  order by created_at desc limit 1
) h
where r.status = 'verified'
  and (select public.is_active_user())
  and not (select public.account_session_blocked())
  and ((select public.is_mdrrmo_duty_staff())
    or ((select public.is_official()) and r.barangay_id = (select public.my_barangay_id())))
  and not exists (
    select 1 from public.report_dispatches d where d.report_id = r.id and d.dispatch_status <> 'declined'
  );
revoke all on public.dispatch_replacement_queue from public, anon;
grant select on public.dispatch_replacement_queue to authenticated;

-- A receipt is written in the same transaction as the submission and its notifications.
create table if not exists public.submission_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('report', 'sos')),
  request_id uuid not null,
  response jsonb not null,
  primary key (user_id, kind, request_id)
);
alter table public.submission_receipts enable row level security;
revoke all on public.submission_receipts from public, anon, authenticated;

create or replace function public.submit_sos_once(
  p_request_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_note text default '',
  p_kind text default 'other'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_response jsonb;
begin
  if not public.is_active_user() or public.account_session_blocked() then
    raise insufficient_privilege using message='Sign in with an active account to send an SOS';
  end if;
  if p_request_id is null then raise exception 'An SOS request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':sos:' || p_request_id::text, 0));

  select response into v_response from public.submission_receipts
    where user_id=v_user and kind='sos' and request_id=p_request_id;
  if found then return v_response; end if;

  v_response := public.submit_sos(p_lat, p_lng, p_accuracy, p_note, p_kind);
  insert into public.submission_receipts values (v_user, 'sos', p_request_id, v_response);
  return v_response;
end;
$$;

create or replace function public.submit_hazard_report(p_request_id uuid, p_report jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_row public.reports;
  v_photo text := nullif(p_report->>'photo_path','');
begin
  if not public.is_active_user() or public.account_session_blocked() then
    raise insufficient_privilege using message='Sign in with an active account to file a report';
  end if;
  if p_request_id is null then raise exception 'A report request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':report:' || p_request_id::text, 0));

  select (response->>'id')::uuid into v_id from public.submission_receipts
    where user_id=v_user and kind='report' and request_id=p_request_id;
  if found then
    select * into v_row from public.reports where id=v_id and reporter_id=v_user;
    if not found then raise no_data_found using message='This report was submitted and is no longer available'; end if;
    return to_jsonb(v_row);
  end if;

  if v_photo is not null and v_photo <> (v_user::text || '/requests/' || p_request_id::text || '.jpg') then
    raise exception 'The photo does not belong to this submission';
  end if;
  insert into public.reports(
    reporter_id, hazard_type, hazard_other_text, barangay, description, severity,
    urgency, location_note, lat, lng, photo_path
  ) values (
    v_user, p_report->>'hazard_type', nullif(p_report->>'hazard_other_text',''),
    coalesce(p_report->>'barangay',''), p_report->>'description', p_report->>'severity',
    coalesce(p_report->>'urgency',p_report->>'severity'), coalesce(p_report->>'location_note',''),
    (p_report->>'lat')::double precision, (p_report->>'lng')::double precision, v_photo
  ) returning * into v_row;
  insert into public.submission_receipts values (v_user, 'report', p_request_id, jsonb_build_object('id',v_row.id));
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.submit_sos_once(uuid, double precision, double precision, double precision, text, text) from public, anon;
grant execute on function public.submit_sos_once(uuid, double precision, double precision, double precision, text, text) to authenticated;
revoke all on function public.submit_hazard_report(uuid, jsonb) from public, anon;
grant execute on function public.submit_hazard_report(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
