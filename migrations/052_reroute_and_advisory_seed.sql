-- ============================================================================
--  UniGuard · 052 · Re-route misrouted reports + backend advisory targets
--
--  1. RE-ROUTE REPORTS THE OLD ROUTING PUT IN THE WRONG BARANGAY
--     Before 051, resolve_barangay took the first overlapping bounding box,
--     so some reports landed in a neighbouring barangay. 051 fixed routing
--     for new reports; this moves existing ones — but ONLY those nobody has
--     acted on yet:
--       · status 'reported' only. Verified / dispatched / resolved / rejected
--         reports keep their barangay: a barangay official already verified
--         them or a team was sent, and moving them would split that history.
--         They are counted in the result as held_for_review (the review query
--         is in docs/TEST-CHECKLIST-ALL.md section 31).
--       · each row is locked first (FOR UPDATE SKIP LOCKED); a report an
--         official is verifying at that moment is skipped, not overwritten,
--         and the status is re-checked under the lock.
--       · coordinates must be valid and inside Lingayen; any row that still
--         fails is skipped and counted, never aborting the run.
--       · only barangay_id + barangay change. Status, coordinates, reporter,
--         corroborations and timestamps are untouched, so the status guard,
--         the pin-move trigger and the edit guard (backend session) all pass.
--       · every move writes audit_log 'report.rerouted' with the old and new
--         barangay, so it can be traced and reversed by hand if needed.
--       · the officials of the new barangay are told the report is now theirs;
--         the officials of the old barangay are told it moved away.
--     reroute_misrouted_reports() stays available for the backend (e.g. after
--     centroids are corrected) and is not callable by app users. Re-running
--     it moves nothing that is already correct.
--
--  2. SAMPLE ADVISORY TARGETS FROM THE BACKEND
--     guard_advisory_target (029) rejected inserts with no signed-in user, so
--     seed/001_sample_data.sql (run from the SQL editor) failed. The write
--     policy advisory_targets_write is `to authenticated` only, so a null
--     auth.uid() here is always a trusted backend session — the same rule
--     051 applies to reports. App users are checked exactly as before.
--
--  Additive + idempotent. Begin/commit so it applies atomically.
-- ============================================================================

begin;

-- ============================================================================
--  2 · advisory targets: let backend sessions through
-- ============================================================================
create or replace function public.guard_advisory_target()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- backend sessions (SQL editor, service role, seeds): RLS only lets the
  -- `authenticated` role write advisory_targets
  if auth.uid() is null then
    return new;
  end if;
  if public.is_lgu() then
    return new;
  end if;
  if public.is_official() and new.barangay_id is distinct from public.my_barangay_id() then
    raise exception 'A barangay official can target only their own barangay';
  end if;
  if not public.is_lgu() and not public.is_official() then
    raise exception 'Only officials can change advisory targets';
  end if;
  return new;
end;
$$;

-- ============================================================================
--  1 · re-route untouched misrouted reports
-- ============================================================================
create or replace function public.reroute_misrouted_reports()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  b          record;
  v_id       uuid;
  v_row      public.reports;
  v_new_id   uuid;
  v_new_name text;
  v_moved    int := 0;
  v_skipped  int := 0;
  v_errors   jsonb := '[]'::jsonb;
  v_held     int := 0;
begin
  if auth.uid() is not null then
    raise exception 'Re-routing runs from the backend only';
  end if;

  select * into b from public.lingayen_bounds();

  for v_id in
    select r.id
      from public.reports r
     where r.status = 'reported'
       and r.lat between b.min_lat and b.max_lat
       and r.lng between b.min_lng and b.max_lng
     order by r.created_at
  loop
    begin
      -- lock; skip a row someone is updating right now
      select * into v_row from public.reports where id = v_id for update skip locked;
      if not found then
        v_skipped := v_skipped + 1;
        continue;
      end if;
      -- re-check under the lock: it may have been verified meanwhile
      if v_row.status <> 'reported' then
        continue;
      end if;

      v_new_id := public.resolve_barangay(v_row.lat, v_row.lng);
      if v_new_id is null or v_new_id is not distinct from v_row.barangay_id then
        continue;
      end if;
      select name into v_new_name from public.barangays where id = v_new_id;

      perform set_config('uniguard.reason', 'reroute', true);
      update public.reports
         set barangay_id = v_new_id,
             barangay    = coalesce(v_new_name, barangay)
       where id = v_row.id;

      perform public.write_audit('report.rerouted', 'reports', v_row.id,
        jsonb_build_object('from_barangay_id', v_row.barangay_id, 'from_barangay', v_row.barangay,
                           'to_barangay_id', v_new_id, 'to_barangay', v_new_name,
                           'reason', 'barangay routing fix (migration 051/052)'));

      -- new barangay's officials: the report is now in their queue
      insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
      select p.id, 'Report moved to your barangay',
             'Report ' || coalesce(v_row.code, '') || ' (' || coalesce(v_row.hazard_type, '') ||
               ') is located in ' || coalesce(v_new_name, 'your barangay') ||
               ' and is now in your verification queue.',
             'advisory', 'check', 'report_status', v_row.id
        from public.profiles p
       where p.disabled = false and p.role = 'barangay_official' and p.barangay_id = v_new_id;

      -- old barangay's officials: it left their queue
      if v_row.barangay_id is not null then
        insert into public.notifications (user_id, title, body, tone, icon, type, report_id)
        select p.id, 'Report moved to another barangay',
               'Report ' || coalesce(v_row.code, '') || ' is located in ' || coalesce(v_new_name, 'another barangay') ||
                 ' and was moved to that barangay''s queue.',
               'advisory', 'check', 'report_status', v_row.id
          from public.profiles p
         where p.disabled = false and p.role = 'barangay_official' and p.barangay_id = v_row.barangay_id;
      end if;

      v_moved := v_moved + 1;
    exception when others then
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('id', v_id, 'error', sqlerrm));
    end;
  end loop;

  -- reports already acted on whose location points elsewhere: left as-is
  -- (materialized: the bounds filter runs before resolve_barangay, which
  --  raises on invalid coordinates)
  with acted as materialized (
    select r.barangay_id, r.lat, r.lng
      from public.reports r
     where r.status in ('verified', 'dispatched')
       and r.lat between b.min_lat and b.max_lat
       and r.lng between b.min_lng and b.max_lng
  )
  select count(*) into v_held
    from acted a
   where a.barangay_id is distinct from public.resolve_barangay(a.lat, a.lng);

  return jsonb_build_object('moved', v_moved, 'skipped', v_skipped,
                            'held_for_review', v_held, 'errors', v_errors);
end;
$$;

revoke all on function public.reroute_misrouted_reports() from public, anon, authenticated;

-- run it once now; the result is printed in the SQL editor
select public.reroute_misrouted_reports() as reroute_result;

commit;
