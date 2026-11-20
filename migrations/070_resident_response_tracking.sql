begin;

create or replace function public.owns_linked_sos(p_report_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user() and exists (
    select 1 from public.sos_log where report_id = p_report_id and user_id = auth.uid()
  );
$$;
revoke all on function public.owns_linked_sos(uuid) from public, anon;
grant execute on function public.owns_linked_sos(uuid) to authenticated;

create index if not exists sos_log_report_sender_idx on public.sos_log(report_id, user_id)
where report_id is not null;

-- The SOS sender can follow the response even if an official filed the report.
drop policy if exists report_dispatches_sos_sender on public.report_dispatches;
create policy report_dispatches_sos_sender on public.report_dispatches
  for select to authenticated using (public.owns_linked_sos(report_id));

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
    or public.owns_linked_sos(r.id)
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

create or replace function public.update_dispatch_location(
  p_dispatch_id uuid,
  p_lat         double precision,
  p_lng         double precision,
  p_accuracy    double precision default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row    public.report_dispatches;
  v_rep    public.reports;
  v_status text;
  v_scene  double precision;
  v_moved  double precision;
  c_scene  constant double precision := 100;   -- metres: "on scene"
  c_moved  constant double precision := 50;    -- metres: "en route"
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  select * into v_row from public.report_dispatches where id = p_dispatch_id for update;
  if v_row.id is null then
    raise exception 'That dispatch does not exist';
  end if;
  if v_row.unit_id is null or v_row.unit_id is distinct from public.my_unit_id()
     or not public.is_dispatch() or not public.is_active_user() then
    raise exception 'Only this unit''s users may share its location';
  end if;
  if v_row.dispatch_status in ('sent', 'done', 'declined') then
    return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', v_row.dispatch_status, 'tracking', false);
  end if;

  select * into v_rep from public.reports where id = v_row.report_id;
  if v_rep.status in ('resolved', 'rejected') then
    return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', v_row.dispatch_status, 'tracking', false);
  end if;
  if p_accuracy > 150 then
    return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', v_row.dispatch_status, 'tracking', true, 'poor_fix', true);
  end if;

  update public.report_dispatches
     set last_lat = p_lat, last_lng = p_lng, last_accuracy = p_accuracy, last_loc_at = now(),
         start_lat = coalesce(start_lat, p_lat), start_lng = coalesce(start_lng, p_lng)
   where id = p_dispatch_id
   returning * into v_row;

  v_status := v_row.dispatch_status;

  -- a poor fix moves nothing
  if p_accuracy is null or p_accuracy <= 150 then
    if v_rep.lat is not null and v_rep.lng is not null then
      v_scene := public.distance_m(p_lat, p_lng, v_rep.lat, v_rep.lng);
    end if;
    v_moved := public.distance_m(v_row.start_lat, v_row.start_lng, p_lat, p_lng);

    if v_status in ('acknowledged', 'en_route') and v_scene is not null and v_scene <= c_scene then
      perform public.dispatch_respond(p_dispatch_id, 'on_scene',
        'Automatic: arrived (GPS, ' || round(v_scene::numeric) || ' m from the report)');
      v_status := 'on_scene';
    elsif v_status = 'acknowledged' and v_moved >= c_moved then
      perform public.dispatch_respond(p_dispatch_id, 'en_route', 'Automatic: moving (GPS)');
      v_status := 'en_route';
    end if;
  end if;

  return jsonb_build_object('dispatch_id', p_dispatch_id, 'status', v_status,
                            'distance_m', case when v_scene is null then null else round(v_scene::numeric) end,
                            'tracking', true);
end;
$$;

commit;
