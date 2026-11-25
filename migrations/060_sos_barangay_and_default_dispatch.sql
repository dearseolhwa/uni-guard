-- ============================================================================
--  UniGuard · 060 · SOS reaches the barangay, default dispatch for every SOS
--
--  1) THE BARANGAY OF THE EMERGENCY
--     057 routed an SOS to the barangay in the sender's profile. An SOS is
--     about where the person IS, so the barangay is now taken from the GPS
--     fix (resolve_barangay), falling back to the profile's barangay when
--     there is no fix or the fix is outside Lingayen. sos_log.barangay_id is
--     what the officials' read policy (029) and the console SOS log use, so
--     the barangay now sees the SOS and its officials are notified.
--
--  2) DEFAULT DISPATCH
--     Every SOS with a GPS fix becomes an emergency report and is dispatched
--     at once:
--        medical -> Ambulance + Barangay Response Team
--        fire    -> BFP       + Barangay Response Team
--        crime   -> PNP       + Barangay Response Team
--        rescue  -> Rescue Unit + Barangay Response Team
--        other   -> Barangay Response Team (the default team)
--     A municipal team with no free unit is reported to the LGU as before
--     (ug_auto_dispatch, 057). `team` in the result lists the teams sent.
--     The SOS stays New (status 'sent') until someone acknowledges it; 057
--     marked it acknowledged on dispatch, so the console never asked anyone
--     to look at it.
--
--  Safe to re-run. Run after 059.
-- ============================================================================

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
  if auth.uid() is null then
    raise exception 'You must be signed in to send an SOS';
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
              left('SOS (' || v_label || ') from ' || coalesce(v_prof.full_name, 'a resident') ||
                   ', ' || coalesce(nullif(v_prof.phone, ''), 'no number') ||
                   case when coalesce(trim(p_note), '') <> '' then '. ' || trim(p_note) else '' end, 1000),
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

notify pgrst, 'reload schema';
