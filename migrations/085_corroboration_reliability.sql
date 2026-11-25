begin;

-- Use the same set of reports for the count and for deciding which reports to verify.
create or replace function public.corroboration_nearby_reports(p_report_id uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select nearby.id
  from public.reports target
  join public.reports nearby on nearby.status <> 'rejected'
    and nearby.barangay_id is not distinct from target.barangay_id
    and nearby.hazard_type = target.hazard_type
    and nearby.created_at between target.created_at - interval '6 hours' and target.created_at + interval '6 hours'
    and (
      nearby.id = target.id
      or (target.lat is not null and target.lng is not null and nearby.lat is not null and nearby.lng is not null
          and public.distance_m(target.lat, target.lng, nearby.lat, nearby.lng) <= 500)
    )
  where target.id = p_report_id and target.status <> 'rejected'
    and nullif(btrim(target.hazard_type), '') is not null
    and (lower(btrim(target.hazard_type)) not in ('other', 'others')
      or (nullif(lower(btrim(target.hazard_other_text)), '') = nullif(lower(btrim(nearby.hazard_other_text)), '')))
    and target.verified_by_name is distinct from 'SOS'
    and nearby.verified_by_name is distinct from 'SOS'
    and not exists (select 1 from public.sos_log s where s.report_id = target.id or s.report_id = nearby.id);
$$;
revoke all on function public.corroboration_nearby_reports(uuid) from public, anon, authenticated;

create or replace function public.corroboration_count(p_report_id uuid)
returns int language sql stable security definer set search_path = public as $$
  with reports_in_range as materialized (
    select public.corroboration_nearby_reports(p_report_id) as id
  )
  select count(*)::int
  from (
    select r.reporter_id as resident
      from reports_in_range near join public.reports r on r.id = near.id
    union
    select c.user_id
      from reports_in_range near join public.report_corroborations c on c.report_id = near.id
      join public.reports target on target.id = p_report_id
     where c.lat is null or c.lng is null or target.lat is null or target.lng is null
       or public.distance_m(target.lat, target.lng, c.lat, c.lng) <= 500
  ) evidence
  where resident is not null;
$$;

create or replace function public.evaluate_corroboration(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_barangay uuid;
  v_reason text := current_setting('uniguard.reason', true);
  verified record;
begin
  select barangay_id into v_barangay from public.reports where id = p_report_id;
  if not found then return; end if;
  -- Serialize evaluations in the same barangay so overlapping reports and
  -- confirmations can see preceding commits before deciding on a threshold.
  perform pg_advisory_xact_lock(hashtextextended('uniguard.corroboration:' || coalesce(v_barangay, p_report_id)::text, 0));
  perform set_config('uniguard.reason', 'auto_corroboration', true);
  for verified in
    update public.reports r
       set status = 'verified', verified_at = now()
     where r.status = 'reported'
       and r.id in (select public.corroboration_nearby_reports(p_report_id))
       and public.corroboration_count(r.id) >= 3
    returning r.id, r.reporter_id, r.code
  loop
    insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
    select verified.reporter_id, 'Your report was auto-verified',
           'Report ' || coalesce(verified.code, '') || ' reached 3 independent confirmations nearby.',
           'prepared', 'check', 'report_status', verified.id
    where verified.reporter_id is not null;
  end loop;
  perform set_config('uniguard.reason', coalesce(v_reason, ''), true);
end;
$$;
revoke all on function public.evaluate_corroboration(uuid) from public, anon, authenticated;

-- Every submission path uses the same eligibility checks.
create or replace function public.guard_corroboration()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_report public.reports;
begin
  if not public.is_active_user() or public.account_is_removed() or public.account_session_blocked() then
    raise insufficient_privilege using message = 'Sign in with an active account to confirm this report.';
  end if;

  new.user_id := auth.uid();
  select * into v_report from public.reports where id = new.report_id;
  if v_report.reporter_id is null then raise exception 'That report does not exist'; end if;
  if v_report.reporter_id = new.user_id then raise exception 'You cannot corroborate your own report'; end if;
  if v_report.status in ('resolved', 'rejected') then
    raise exception 'This report is closed and cannot be confirmed.';
  end if;
  if v_report.verified_by_name = 'SOS' or exists (select 1 from public.sos_log where report_id = new.report_id) then
    raise exception 'Use the SOS response status for this incident.';
  end if;

  if new.lat is not null and new.lng is not null and v_report.lat is not null and v_report.lng is not null then
    if not (new.lat between -90 and 90 and new.lng between -180 and 180)
       or public.distance_m(new.lat, new.lng, v_report.lat, v_report.lng) > 500 then
      raise exception 'Confirmations must come from within 500 m of the hazard.';
    end if;
  else
    if v_report.barangay_id is null or v_report.barangay_id is distinct from public.my_barangay_id() then
      raise exception 'A GPS fix is required to confirm a hazard outside your barangay.';
    end if;
    new.lat := null;
    new.lng := null;
  end if;
  return new;
end;
$$;

create or replace function public.corroborate_report(
  p_report_id uuid, p_note text default '',
  p_lat double precision default null, p_lng double precision default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_previous text;
  v_status text;
  v_added boolean;
begin
  select status into v_previous from public.reports where id = p_report_id;
  insert into public.report_corroborations (report_id, user_id, note, lat, lng)
  values (p_report_id, auth.uid(), coalesce(p_note, ''), p_lat, p_lng)
  on conflict (report_id, user_id) do nothing;
  v_added := found;

  select status into v_status from public.reports where id = p_report_id;
  return jsonb_build_object('corroborations', public.corroboration_count(p_report_id),
    'status', v_status, 'verified', v_status = 'verified', 'threshold', 3,
    'already_confirmed', not v_added, 'auto_verified_now', v_added and v_previous = 'reported' and v_status = 'verified');
end;
$$;

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
    public.corroboration_count(r.id)::bigint as corroborations,
    (r.reporter_id = auth.uid()) as is_mine,
    ( r.status = 'reported'
      and r.verified_at is null
      and r.created_at < now() - interval '30 minutes'
    ) as is_stale,
    ( r.status = 'reported'
      and public.report_is_life_safety(r.hazard_type)
    ) as is_severity_bypass,
    ( r.status = 'reported'
      and (
        ( r.verified_at is null
          and r.created_at < now() - interval '30 minutes' )
        or public.report_is_life_safety(r.hazard_type)
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

commit;
