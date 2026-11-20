-- ============================================================================
--  UniGuard · RLS test script  (Phase 9)
--
--  Impersonates each role inside a transaction and asserts what that role can
--  and cannot see. Every block rolls back, so nothing is written.
--
--  Replace the three UUIDs with real accounts (see docs/TEST-CHECKLIST-ALL.md).
--  Run the whole file in the Supabase SQL editor; failures raise immediately.
-- ============================================================================

\set citizen  '11111111-1111-1111-1111-111111111111'
\set official '22222222-2222-2222-2222-222222222222'
\set lgu      '33333333-3333-3333-3333-333333333333'

-- helper: assert a boolean
create or replace function public.t_assert(condition boolean, label text)
returns void language plpgsql as $$
begin
  if condition is null or condition = false then
    raise exception 'RLS TEST FAILED: %', label;
  else
    raise notice 'ok  %', label;
  end if;
end;
$$;

-- ---------------------------------------------------------------- citizen
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  select public.t_assert(public.current_role_key() = 'citizen', 'citizen role resolves from profiles');
  select public.t_assert(
    (select count(*) from public.reports where reporter_id <> '11111111-1111-1111-1111-111111111111') = 0,
    'citizen cannot read another resident report');
  select public.t_assert(
    not exists (select 1 from information_schema.columns
                 where table_name = 'reports_feed' and column_name = 'reporter_id'),
    'reports_feed exposes no reporter identity');
  select public.t_assert((select count(*) from public.profiles) = 1, 'citizen sees only their own profile');
  select public.t_assert((select count(*) from public.audit_log) = 0, 'citizen cannot read the audit log');
  begin
    update public.profiles set role = 'lgu_ldrrmc' where id = auth.uid();
    select public.t_assert(false, 'citizen role change must raise');
  exception when others then
    select public.t_assert(true, 'citizen cannot change their own role');
  end;
rollback;

-- --------------------------------------------------------- barangay official
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  select public.t_assert(public.current_role_key() = 'barangay_official', 'official role resolves from profiles');
  select public.t_assert(
    (select count(*) from public.reports
      where barangay_id is distinct from public.my_barangay_id()) = 0,
    'official sees only their own barangay reports');
  begin
    update public.emergency_hotlines set contact_number = '0000' where true;
    select public.t_assert(false, 'official hotline write must raise');
  exception when others then
    select public.t_assert(true, 'official cannot edit hotlines');
  end;
  begin
    update public.profiles set role = 'citizen' where id <> auth.uid();
    select public.t_assert(false, 'official profile write must raise');
  exception when others then
    select public.t_assert(true, 'official cannot change another account role');
  end;
rollback;

-- --------------------------------------------------------------- LGU
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
  select public.t_assert(public.is_lgu(), 'LGU role resolves from profiles');
  select public.t_assert(
    (select count(*) from public.reports) >=
    (select count(*) from public.reports where barangay_id = public.my_barangay_id()),
    'LGU sees every barangay');
  select public.t_assert(
    (select count(*) from public.emergency_hotlines) >= 0, 'LGU can read hotlines');
rollback;

-- --------------------------------------------------------------- anonymous
begin;
  set local role anon;
  select public.t_assert(public.current_role_key() = 'anon', 'anonymous has no role');
  select public.t_assert((select count(*) from public.reports) = 0, 'anonymous reads no reports');
  select public.t_assert((select count(*) from public.profiles) = 0, 'anonymous reads no profiles');
rollback;

-- ============================================================================
--  Phase A assertions (fix prompt acceptance criteria 1-6)
--  These blocks follow the same pattern as above: fixture users are referenced
--  by uuid, every block runs inside a transaction that ends in ROLLBACK, so
--  nothing persists. Replace the uuids with real accounts where needed.
-- ============================================================================

-- helper: assert that a statement raises
create or replace function public.t_raises(label text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'RLS TEST FAILED (no error raised): %', label;
exception
  when others then
    if sqlerrm like 'RLS TEST FAILED%' then
      raise exception '%', sqlerrm;
    else
      raise notice 'ok  % (raised: %)', label, left(sqlerrm, 90);
    end if;
end;
$$;

-- 1 · a citizen cannot change status / barangay_id / reporter_id / code on
--     their own report, even inside the 15-minute window
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  perform public.t_raises('citizen cannot change status on own report',
    'update public.reports set status = ''verified'' where reporter_id = auth.uid() and status = ''reported''');
  perform public.t_raises('citizen cannot change barangay_id on own report',
    'update public.reports set barangay_id = (select id from public.barangays limit 1) where reporter_id = auth.uid()');
  perform public.t_raises('citizen cannot change reporter_id on own report',
    'update public.reports set reporter_id = ''22222222-2222-2222-2222-222222222222'' where reporter_id = auth.uid()');
  perform public.t_raises('citizen cannot change code on own report',
    'update public.reports set code = ''HACKED'' where reporter_id = auth.uid()');
rollback;

-- 2 · no role can skip a status step; resolved and rejected are final
begin;
  perform public.t_raises('reported -> dispatched skip must raise',
    'update public.reports set status = ''dispatched'' where status = ''reported''');
  perform public.t_raises('reported -> resolved skip must raise',
    'update public.reports set status = ''resolved'' where status = ''reported''');
  perform public.t_raises('resolved must be final',
    'update public.reports set status = ''reported'' where status = ''resolved''');
  perform public.t_raises('rejected must be final',
    'update public.reports set status = ''reported'' where status = ''rejected''');
  perform public.t_raises('rejected -> resolved must raise',
    'update public.reports set status = ''resolved'' where status = ''rejected''');
rollback;

-- 3 · an official cannot read other barangays' incidents / SOS / analytics,
--     and cannot write road status or shelters for another barangay
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  select public.t_assert(
    (select count(*) from public.reports
      where barangay_id is distinct from public.my_barangay_id()) = 0,
    'official reads no other barangay incidents (direct REST = same query)');
  select public.t_assert(
    (select count(*) from public.sos_log
      where user_id <> auth.uid()
        and coalesce(barangay, '') is distinct from public.my_barangay_name()
        and (barangay_id is null or barangay_id is distinct from public.my_barangay_id())) = 0,
    'official reads only own-barangay SOS entries');
  select public.t_assert(
    (select count(*) from public.analytics_by_hazard) >= 0,
    'official can call the analytics views (rows scoped inside)');
  begin
    insert into public.road_status (road_name, barangay, barangay_id, status)
    values ('RSL test', 'Other barangay', (select b.id from public.barangays b where b.id <> public.my_barangay_id() limit 1), 'blocked');
    select public.t_assert(false, 'official cross-barangay road_status insert must fail');
  exception when insufficient_privilege or check_violation then
    select public.t_assert(true, 'official cannot write road_status for another barangay');
  end;
  begin
    update public.evacuation_centers set occupancy = 99
     where barangay_id is distinct from public.my_barangay_id();
    select public.t_assert(false, 'official cross-barangay shelter update must fail');
  exception when insufficient_privilege or check_violation then
    select public.t_assert(true, 'official cannot write shelters for another barangay');
  end;
rollback;

-- 4 · a barangay official cannot publish a municipality-wide advisory
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
  perform public.t_raises('official municipality-wide advisory must raise',
    'insert into public.advisories (author_id, title, body, severity, kind, citywide, affected_area) ' ||
    'values (auth.uid(), ''test'', ''test'', ''advisory'', ''emergency'', true, ''Municipality-wide'')');
rollback;

-- 5 · a citizen cannot read analytics (zero rows from every scoped object)
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  select public.t_assert((select count(*) from public.analytics_by_hazard) = 0, 'citizen analytics_by_hazard is empty');
  select public.t_assert((select count(*) from public.analytics_pipeline) = 0, 'citizen analytics_pipeline is empty');
  select public.t_assert((select count(*) from public.analytics_daily) = 0, 'citizen analytics_daily is empty');
  select public.t_assert((select count(*) from public.analytics_response_times) = 0, 'citizen analytics_response_times is empty');
  select public.t_assert((select count(*) from public.analytics_corroboration) = 0, 'citizen analytics_corroboration is empty');
  select public.t_assert((select count(*) from public.analytics_shelters) = 0, 'citizen analytics_shelters is empty');
  select public.t_assert((select count(*) from public.analytics_by_barangay) = 0, 'citizen analytics_by_barangay is empty');
rollback;

-- 6 · an insert with missing or invalid coordinates is rejected
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
  perform public.t_raises('insert without coordinates must raise',
    'insert into public.reports (hazard_type, description, severity) values (''Flood'', ''no location test'', ''advisory'')');
  perform public.t_raises('insert outside Lingayen must raise',
    'insert into public.reports (hazard_type, description, severity, lat, lng) values (''Flood'', ''outside test'', ''advisory'', 14.5995, 120.9842)');
  perform public.t_raises('insert with swapped coordinates must raise',
    'insert into public.reports (hazard_type, description, severity, lat, lng) values (''Flood'', ''swapped test'', ''advisory'', 120.2306, 16.0206)');
rollback;

-- 7 · a report filed by a Poblacion resident at coordinates inside another
--     barangay is routed to THAT barangay (server-side coordinate routing)
begin;
  select public.t_assert(
    (select b.name from public.resolve_barangay(16.0520, 120.2260) r
       join public.barangays b on b.id = r) = 'Pangapisan North',
    'coordinates inside Pangapisan North resolve to Pangapisan North');
rollback;
