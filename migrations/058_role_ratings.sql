-- ============================================================================
--  UniGuard · 058 · Rate each role that handled a report
--
--  057 let the reporter rate the response as a whole. The reporter can now
--  also rate, separately and optionally, everyone who handled the report:
--    barangay           the barangay officials (queue, verification)
--    lgu                the LDRRMO (verification, municipal teams)
--    dispatch:<uuid>    each team that was sent (BFP, Ambulance, ...)
--  Stored in report_ratings.details as
--    [{ "target": "...", "label": "...", "stars": 1-5, "comment": "..." }]
--  rate_report() rebuilds the array server side: unknown targets, a team
--  that was not on this report, and stars outside 1-5 are dropped.
--
--  Safe to re-run. Run after 057.
-- ============================================================================

alter table public.report_ratings add column if not exists details jsonb not null default '[]'::jsonb;

-- the 3-argument version would make named calls ambiguous
drop function if exists public.rate_report(uuid, int, text);

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
  v_row     public.reports;
  v_item    jsonb;
  v_target  text;
  v_stars   int;
  v_label   text;
  v_disp    public.report_dispatches;
  v_details jsonb := '[]'::jsonb;
  v_seen    text[] := array[]::text[];
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

  if jsonb_typeof(coalesce(p_details, '[]'::jsonb)) = 'array' then
    for v_item in select * from jsonb_array_elements(coalesce(p_details, '[]'::jsonb)) limit 20 loop
      continue when jsonb_typeof(v_item) <> 'object';
      v_target := coalesce(v_item->>'target', '');
      v_stars  := case when (v_item->>'stars') ~ '^[1-5]$' then (v_item->>'stars')::int end;
      continue when v_stars is null or v_target = any (v_seen);

      if v_target = 'barangay' then
        v_label := 'Barangay ' || coalesce(v_row.barangay, '') || ' officials';
      elsif v_target = 'lgu' then
        v_label := 'LDRRMO (Municipal DRRM Office)';
      elsif v_target ~ '^dispatch:[0-9a-f-]{36}$' then
        select * into v_disp from public.report_dispatches
         where id = substr(v_target, 10)::uuid and report_id = p_report_id;
        continue when v_disp.id is null;
        v_label := v_disp.team || coalesce(' · ' || (select name from public.dispatch_units where id = v_disp.unit_id), '');
      else
        continue;
      end if;

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
