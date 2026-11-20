-- ============================================================================
--  UniGuard · 059 · Rate only the roles that handled the report
--
--  058 offered the barangay officials and the LDRRMO for rating on every
--  report, whether they worked on it or not. A report the LGU verified
--  straight away (the barangay never acted) must not ask the resident to
--  rate the barangay, and a report the barangay handled alone must not ask
--  about the LDRRMO.
--
--  report_handlers(report) reads what was recorded:
--    barangay   a barangay official verified the report, changed its status,
--               sent a team, or acted on a dispatch (their Response Team)
--    lgu        LGU staff did any of the same
--    teams      every team that was sent and did not decline
--    responders the report reached "dispatched" with no team on record
--               (older reports), so its responders are rated as one
--  Changes made by a resident's session (three-confirmation auto-verify, an
--  SOS) count for nobody. rate_report() accepts a role rating only for a
--  role report_handlers() returns.
--
--  Safe to re-run. Run after 058.
-- ============================================================================

create or replace function public.report_handlers(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_row   public.reports;
  v_roles text[];
  v_teams jsonb;
  v_any   boolean;
  v_disp  boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  select * into v_row from public.reports where id = p_report_id;
  if v_row.id is null then
    raise exception 'That report does not exist';
  end if;
  if not (v_row.reporter_id = auth.uid()
          or public.is_lgu()
          or (public.is_official() and v_row.barangay_id = public.my_barangay_id())) then
    raise exception 'You cannot see this report';
  end if;

  -- every staff role that acted on the report
  select array_agg(distinct p.role) into v_roles
    from (
      select h.changed_by as who from public.report_status_history h where h.report_id = p_report_id
      union all
      select d.dispatched_by from public.report_dispatches d where d.report_id = p_report_id
      union all
      select e.actor from public.report_dispatch_events e
        join public.report_dispatches d on d.id = e.dispatch_id
       where d.report_id = p_report_id
    ) a
    join public.profiles p on p.id = a.who
   where p.role in ('barangay_official', 'lgu_ldrrmc');
  v_roles := coalesce(v_roles, array[]::text[]);
  if v_row.verified_by_role in ('barangay_official', 'lgu_ldrrmc') then
    v_roles := v_roles || v_row.verified_by_role;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'target', 'dispatch:' || d.id,
           'label', d.team || coalesce(' · ' || u.name, ''))
         order by d.dispatched_at), '[]'::jsonb)
    into v_teams
    from public.report_dispatches d
    left join public.dispatch_units u on u.id = d.unit_id
   where d.report_id = p_report_id and d.dispatch_status <> 'declined';

  select exists (select 1 from public.report_dispatches where report_id = p_report_id) into v_any;
  v_disp := v_row.status in ('dispatched', 'resolved')
            or exists (select 1 from public.report_status_history
                        where report_id = p_report_id and to_status = 'dispatched');

  return jsonb_build_object(
    'barangay',   'barangay_official' = any (v_roles),
    'lgu',        'lgu_ldrrmc' = any (v_roles),
    'teams',      v_teams,
    'responders', (not v_any) and v_disp
  );
end;
$$;

revoke all on function public.report_handlers(uuid) from public, anon;
grant execute on function public.report_handlers(uuid) to authenticated;

-- same as 058, but a role rating is kept only for a role that handled it
create or replace function public.rate_report(
  p_report_id uuid,
  p_stars     int,
  p_comment   text default '',
  p_details   jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_row      public.reports;
  v_item     jsonb;
  v_target   text;
  v_stars    int;
  v_label    text;
  v_handlers jsonb;
  v_details  jsonb := '[]'::jsonb;
  v_seen     text[] := array[]::text[];
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'Choose 1 to 5 stars for the overall response';
  end if;
  select * into v_row from public.reports where id = p_report_id;
  if v_row.id is null then
    raise exception 'That report does not exist';
  end if;
  if v_row.reporter_id is distinct from auth.uid() then
    raise exception 'Only the person who filed the report can rate it';
  end if;
  if v_row.status <> 'resolved' then
    raise exception 'You can rate the response once the report is resolved';
  end if;

  v_handlers := public.report_handlers(p_report_id);

  if jsonb_typeof(coalesce(p_details, '[]'::jsonb)) = 'array' then
    for v_item in select * from jsonb_array_elements(coalesce(p_details, '[]'::jsonb)) limit 20 loop
      continue when jsonb_typeof(v_item) <> 'object';
      v_target := coalesce(v_item->>'target', '');
      v_stars  := case when (v_item->>'stars') ~ '^[1-5]$' then (v_item->>'stars')::int end;
      continue when v_stars is null or v_target = any (v_seen);

      v_label := null;
      if v_target = 'barangay' and (v_handlers->>'barangay')::boolean then
        v_label := 'Barangay ' || coalesce(v_row.barangay, '') || ' officials';
      elsif v_target = 'lgu' and (v_handlers->>'lgu')::boolean then
        v_label := 'LDRRMO (Municipal DRRM Office)';
      elsif v_target = 'responders' and (v_handlers->>'responders')::boolean then
        v_label := 'Response team';
      elsif v_target like 'dispatch:%' then
        select t->>'label' into v_label
          from jsonb_array_elements(v_handlers->'teams') t
         where t->>'target' = v_target;
      end if;
      continue when v_label is null;

      v_seen := v_seen || v_target;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'target', v_target, 'label', v_label, 'stars', v_stars,
        'comment', left(trim(coalesce(v_item->>'comment', '')), 500)));
    end loop;
  end if;

  insert into public.report_ratings (report_id, user_id, stars, comment, details)
  values (p_report_id, auth.uid(), p_stars, left(trim(coalesce(p_comment, '')), 500), v_details)
  on conflict (report_id) do update
     set stars = excluded.stars, comment = excluded.comment, details = excluded.details, created_at = now();

  perform public.write_audit('report.rated', 'reports', p_report_id,
    jsonb_build_object('stars', p_stars, 'roles_rated', jsonb_array_length(v_details)));

  return jsonb_build_object('report_id', p_report_id, 'stars', p_stars, 'details', v_details);
end;
$$;

revoke all on function public.rate_report(uuid, int, text, jsonb) from public, anon;
grant execute on function public.rate_report(uuid, int, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
