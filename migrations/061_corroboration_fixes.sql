-- ============================================================================
--  UniGuard · 061 · Corroboration: stop reports verifying too early
--
--  A report auto-verifies when 3 different residents back the same hazard
--  nearby within 6 hours (the reporter counts as one). The rule is right; the
--  way it was counted let reports verify after a single confirmation:
--
--  1) NO RADIUS ON THE NEW-REPORT PATH
--     evaluate_corroboration (051, runs when a report is filed) counted every
--     same-hazard report in the WHOLE barangay. Two other "Flood" reports
--     anywhere in Poblacion within 6 hours, plus one confirmation, verified
--     everything. Both paths now use the 500 m rule.
--
--  2) MISSING COORDINATES SKIPPED THE RADIUS
--     "lat is null or ..." made a report (or a neighbouring report) without
--     coordinates match the whole barangay. A report with no coordinates is
--     now judged on its own: its reporter plus the confirmations given on it.
--     Reports without coordinates never join a cluster.
--
--  3) CONFIRMING WITHOUT GPS FROM ANYWHERE
--     With location off, corroborate_report skipped the 500 m check, so any
--     signed-in resident of any barangay could confirm. The app already tells
--     residents "no GPS: the barangay rule applies"; that rule is now enforced:
--     without a GPS fix, only residents of the report's barangay can confirm.
--
--  4) REJECTED AND CLOSED REPORTS
--     The confirm path still counted reporters of rejected reports, and a
--     resolved or rejected report could still be confirmed. Rejected reports
--     never count, and closed reports cannot be confirmed.
--
--  Both paths now share one function, so they can no longer drift apart.
--  The threshold (3), the radius (500 m) and the window (±6 h) are unchanged.
--  Reports that were already verified are left as they are.
--
--  Safe to re-run. Run after 060.
-- ============================================================================

-- how many different residents back this report's hazard (reporter included)
create or replace function public.corroboration_count(p_report_id uuid)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  c_radius constant double precision := 500;
  v_barangay_id uuid;
  v_hazard      text;
  v_created     timestamptz;
  v_lat         double precision;
  v_lng         double precision;
  v_reporter    uuid;
  v_count       int;
begin
  select barangay_id, hazard_type, created_at, lat, lng, reporter_id
    into v_barangay_id, v_hazard, v_created, v_lat, v_lng, v_reporter
    from public.reports where id = p_report_id;

  if v_hazard is null or v_hazard = '' then return 0; end if;

  if v_lat is null or v_lng is null then
    -- no coordinates: this report on its own
    select count(distinct u) into v_count from (
      select v_reporter as u
      union
      select c.user_id from public.report_corroborations c where c.report_id = p_report_id
    ) s where u is not null;
    return coalesce(v_count, 0);
  end if;

  -- same hazard, same barangay, within 6 hours and 500 m, not rejected
  select count(distinct u) into v_count from (
    select r.reporter_id as u
      from public.reports r
     where r.hazard_type = v_hazard
       and (r.barangay_id is not distinct from v_barangay_id)
       and r.status <> 'rejected'
       and r.created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
       and r.lat is not null and r.lng is not null
       and public.distance_m(v_lat, v_lng, r.lat, r.lng) <= c_radius
    union
    select c.user_id
      from public.report_corroborations c
      join public.reports r2 on r2.id = c.report_id
     where r2.hazard_type = v_hazard
       and (r2.barangay_id is not distinct from v_barangay_id)
       and r2.status <> 'rejected'
       and r2.created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
       and r2.lat is not null and r2.lng is not null
       and public.distance_m(v_lat, v_lng, r2.lat, r2.lng) <= c_radius
       and (c.lat is null or public.distance_m(v_lat, v_lng, c.lat, c.lng) <= c_radius)
  ) s where u is not null;

  return coalesce(v_count, 0);
end;
$$;

-- verify the report (and its nearby matching reports) once 3 residents back it
create or replace function public.evaluate_corroboration(p_report_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c_radius constant double precision := 500;
  v_barangay_id uuid;
  v_hazard      text;
  v_created     timestamptz;
  v_lat         double precision;
  v_lng         double precision;
  v_row         record;
begin
  if public.corroboration_count(p_report_id) < 3 then return; end if;

  select barangay_id, hazard_type, created_at, lat, lng
    into v_barangay_id, v_hazard, v_created, v_lat, v_lng
    from public.reports where id = p_report_id;

  perform set_config('uniguard.reason', 'auto_corroboration', true);
  for v_row in
    update public.reports r
       set status = 'verified', verified_at = now()
     where r.status = 'reported'
       and (
         r.id = p_report_id
         or (v_lat is not null and v_lng is not null
             and r.hazard_type = v_hazard
             and (r.barangay_id is not distinct from v_barangay_id)
             and r.created_at between v_created - interval '6 hours' and v_created + interval '6 hours'
             and r.lat is not null and r.lng is not null
             and public.distance_m(v_lat, v_lng, r.lat, r.lng) <= c_radius)
       )
    returning r.id, r.reporter_id, r.code
  loop
    if v_row.reporter_id is not null then
      insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
      values (v_row.reporter_id,
              'Your report was auto-verified',
              'Report ' || coalesce(v_row.code, '') || ' reached 3 independent confirmations nearby.',
              'prepared', 'check', 'report_status', v_row.id);
    end if;
  end loop;
end;
$$;

-- confirm-button path: same rule as the new-report path
create or replace function public.apply_corroboration()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.evaluate_corroboration(new.report_id);
  return new;
end;
$$;

-- the confirm button: 500 m with GPS, own barangay without it, open reports only
create or replace function public.corroborate_report(
  p_report_id uuid, p_note text default '',
  p_lat double precision default null, p_lng double precision default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_status   text;
  v_count    int;
  v_rlat     double precision;
  v_rlng     double precision;
  v_brgy     uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to corroborate a report';
  end if;
  if not public.is_active_user() then
    raise exception 'This account cannot corroborate reports';
  end if;

  select lat, lng, barangay_id, status into v_rlat, v_rlng, v_brgy, v_status
    from public.reports where id = p_report_id;
  if v_status is null then
    raise exception 'That report does not exist';
  end if;
  if v_status in ('resolved', 'rejected') then
    raise exception 'This report is already closed, so it cannot be confirmed.';
  end if;

  if p_lat is not null and p_lng is not null then
    if v_rlat is not null and v_rlng is not null
       and public.distance_m(p_lat, p_lng, v_rlat, v_rlng) > 500 then
      raise exception 'You are too far from this hazard to confirm it. Confirmations must come from within 500 m.';
    end if;
  elsif v_brgy is not null and v_brgy is distinct from public.my_barangay_id() then
    raise exception 'Turn on your location to confirm a hazard outside your barangay.';
  end if;

  insert into public.report_corroborations (report_id, user_id, note, lat, lng)
  values (p_report_id, auth.uid(), coalesce(p_note, ''), p_lat, p_lng);

  select status into v_status from public.reports where id = p_report_id;
  v_count := public.corroboration_count(p_report_id);

  return jsonb_build_object('corroborations', greatest(coalesce(v_count, 1), 1),
    'status', v_status, 'verified', v_status = 'verified', 'threshold', 3);
end;
$$;

revoke all on function public.corroborate_report (uuid, text, double precision, double precision) from public;
grant execute on function public.corroborate_report (uuid, text, double precision, double precision) to authenticated;
revoke all on function public.corroboration_count (uuid) from public;
grant execute on function public.corroboration_count (uuid) to authenticated;

-- the reports this account has confirmed, so "Confirmed" follows the account
-- to every device (the app reads it on each refresh)
create or replace function public.my_corroborations()
returns setof uuid language sql stable security definer set search_path = public as $$
  select report_id from public.report_corroborations where user_id = auth.uid();
$$;

revoke all on function public.my_corroborations () from public;
grant execute on function public.my_corroborations () to authenticated;
