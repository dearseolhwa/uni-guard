-- ============================================================================
--  UniGuard · 056 · Realtime for the core tables
--
--  A report a resident filed only reached the Barangay Official, LDRRMO and
--  Super Admin queues after they reloaded the page. js/repo.js listens for
--  changes on reports and the other core tables, but Supabase only streams
--  changes for tables in the supabase_realtime publication, and no migration
--  ever added them (038 and 049 added the dispatch tables only). So the
--  listeners were connected and never heard anything.
--
--  This adds every table js/repo.js watches (WATCHED) to the publication.
--  Row Level Security still applies: each portal is only sent changes to rows
--  it is allowed to read.
--
--  Safe to re-run. Tables that are already published, or that do not exist
--  in this database yet, are skipped.
-- ============================================================================

do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  /* a FOR ALL TABLES publication already covers them and refuses ADD TABLE */
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    return;
  end if;

  foreach t in array array[
    'reports','report_corroborations','report_assignments','advisories','notifications',
    'evacuation_centers','relief_distributions','authorized_beneficiaries','preparedness_guides','faqs',
    'road_work_posts','road_status','sos_log','change_requests'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'realtime: public.% does not exist, skipped', t;
      continue;
    end if;
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;

-- what is published now (read-only check)
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
