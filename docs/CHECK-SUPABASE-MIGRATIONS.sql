-- UniGuard · read-only Supabase migration checker
--
-- Paste this entire file into Supabase Dashboard -> SQL Editor and choose Run.
-- It does not create, update, or delete persistent data. The first block prints
-- the latest CLI migration record when Supabase has one. The result tables then
-- inspect the schema itself, which also works when migrations were pasted into
-- the SQL Editor and no migration history was recorded.

do $$
declare
  v_version text;
  v_name text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'No Supabase CLI migration history table was found. Use the feature checks below.';
    return;
  end if;

  begin
    execute 'select version::text, name::text from supabase_migrations.schema_migrations order by version desc limit 1'
      into v_version, v_name;
    raise notice 'Latest recorded CLI migration: % (%)', coalesce(v_version, 'none'), coalesce(v_name, 'unnamed');
  exception when undefined_column then
    execute 'select max(version::text) from supabase_migrations.schema_migrations' into v_version;
    raise notice 'Latest recorded CLI migration version: %', coalesce(v_version, 'none');
  end;
end $$;

with checks(sort_order, migration, installed, evidence) as (
  values
    (43, '043_super_admin.sql',
      to_regprocedure('public.is_super_admin()') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_super_admin'),
      'is_super_admin() and profiles.is_super_admin'),
    (44, '044_reports_documentation.sql',
      to_regclass('public.damage_assessments') is not null and to_regclass('public.situation_reports') is not null,
      'damage_assessments and situation_reports'),
    (46, '046_super_admin_verify_block_and_change_requests.sql',
      to_regclass('public.change_requests') is not null,
      'change_requests'),
    (47, '047_one_hour_lgu_escalation.sql',
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='escalation_status') and
      to_regclass('public.lgu_escalation_queue') is not null,
      'reports.escalation_status and lgu_escalation_queue'),
    (49, '049_dispatch_team_features.sql',
      to_regclass('public.dispatch_help_requests') is not null,
      'dispatch_help_requests'),
    (50, '050_equipment_management.sql',
      to_regprocedure('public.add_equipment(uuid,uuid,uuid,text,text,text,text)') is not null,
      'add_equipment(...)'),
    (53, '053_barangay_boundaries.sql',
      to_regclass('public.barangay_boundaries') is not null and to_regprocedure('public.barangay_at(double precision,double precision)') is not null,
      'barangay_boundaries and barangay_at(...)'),
    (57, '057_auto_dispatch_tracking_ratings_sos.sql',
      to_regclass('public.report_ratings') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='report_dispatches' and column_name='last_lat'),
      'report_ratings and dispatch location columns'),
    (61, '061_corroboration_fixes.sql',
      to_regprocedure('public.my_corroborations()') is not null,
      'my_corroborations()'),
    (64, '064_sos_acknowledged_by.sql',
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='sos_log' and column_name='acknowledged_by'),
      'sos_log.acknowledged_by'),
    (65, '065_reroute_unacknowledged_dispatch.sql',
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='report_dispatches' and column_name='rerouted_from'),
      'report_dispatches.rerouted_from'),
    (66, '066_sos_no_team_alert.sql',
      to_regprocedure('public.ug_sos_no_team_alert()') is not null,
      'ug_sos_no_team_alert()'),
    (67, '067_unanswered_escalation_and_expiry.sql',
      to_regprocedure('public.ug_unanswered_sweep()') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='sos_log' and column_name='expired_at') and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='expired_at'),
      'unanswered sweep and expiry columns'),
    (68, '068_dispatch_staff_and_assignments.sql',
      to_regprocedure('public.remove_staff_account(uuid)') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='removed_at'),
      'remove_staff_account(...) and profiles.removed_at'),
    (69, '069_persistent_sos_acknowledgements.sql',
      to_regclass('public.sos_staff_receipts') is not null and to_regprocedure('public.list_pending_sos_receipts()') is not null,
      'sos_staff_receipts and pending receipt RPC'),
    (70, '070_resident_response_tracking.sql',
      to_regprocedure('public.owns_linked_sos(uuid)') is not null,
      'owns_linked_sos(...)'),
    (71, '071_emergency_delivery_and_lead_handoff.sql',
      to_regclass('public.emergency_delivery') is not null and to_regprocedure('public.claim_emergency_delivery()') is not null,
      'emergency_delivery and queue RPC'),
    (72, '072_super_admin_account_reliability.sql',
      to_regprocedure('public.account_session_blocked()') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='sessions_revoked_at'),
      'account_session_blocked() and session revocation'),
    (73, '073_dispatch_authority_hierarchy.sql',
      to_regclass('public.barangay_dispatch_requests') is not null and to_regprocedure('public.is_mdrrmo_duty_staff()') is not null,
      'barangay_dispatch_requests and duty role RPC'),
    (74, '074_shared_relief_inventory.sql',
      to_regprocedure('public.read_relief_stock()') is not null and to_regclass('public.relief_stock_adjustments') is not null,
      'shared relief stock RPC and adjustment ledger'),
    (75, '075_super_admin_audit_fixes.sql',
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='change_requests' and column_name='requester_id' and is_nullable='YES'),
      'change_requests.requester_id is nullable'),
    (76, '076_super_admin_notifications.sql',
      to_regprocedure('public.claim_admin_push(integer)') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='audience'),
      'Super Admin notification queue')
)
select migration,
       case when installed then 'INSTALLED' else 'MISSING' end as status,
       evidence
from checks
order by sort_order;

with current_state as (
  select
    to_regprocedure('public.ug_unanswered_sweep()') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='expired_at') as has_067,
    to_regprocedure('public.remove_staff_account(uuid)') is not null as has_068,
    to_regclass('public.sos_staff_receipts') is not null as has_069,
    to_regprocedure('public.owns_linked_sos(uuid)') is not null as has_070,
    to_regclass('public.emergency_delivery') is not null as has_071,
    to_regprocedure('public.account_session_blocked()') is not null as has_072,
    to_regclass('public.barangay_dispatch_requests') is not null as has_073,
    to_regprocedure('public.read_relief_stock()') is not null as has_074,
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='change_requests' and column_name='requester_id' and is_nullable='YES') as has_075,
    to_regprocedure('public.claim_admin_push(integer)') is not null as has_076
)
select case
  when not has_067 then 'STOP: the database is behind 067 or has gaps. Share the full results before applying the update.'
  when not has_068 then 'NEXT: apply 068, then continue in filename order through 076.'
  when not has_069 then 'NEXT: apply 069, then continue in filename order through 076.'
  when not has_070 then 'NEXT: apply 070, then continue in filename order through 076.'
  when not has_071 then 'NEXT: apply 071, then continue in filename order through 076.'
  when not has_072 then 'NEXT: apply 072, then continue in filename order through 076.'
  when not has_073 then 'NEXT: apply 073, then continue in filename order through 076.'
  when not has_074 then 'NEXT: apply 074, then 075 and 076.'
  when not has_075 then 'READY: apply 075, then 076.'
  when not has_076 then 'READY: apply 076.'
  else 'CURRENT: schema features through 076 are installed.'
end as recommendation
from current_state;

-- A MISSING milestone after an INSTALLED later milestone means the database has
-- a gap. Do not infer that every earlier file ran from the largest installed
-- number. Share the full result grid before applying anything in that case.
