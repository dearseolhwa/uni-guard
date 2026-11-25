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
    (11, '011_relief_assistance.sql',
      (select count(*)=2 and bool_and(relrowsecurity) from pg_class
       where oid in (to_regclass('public.relief_distributions'),to_regclass('public.authorized_beneficiaries'))),
      'Relief schedules and beneficiaries with row-level security enabled'),
    (19, '019_beneficiaries_privacy.sql',
      exists (select 1 from pg_policies where schemaname='public' and tablename='authorized_beneficiaries'
              and policyname in ('authorized_beneficiaries_read','authorized_beneficiaries_manage')
              and qual like '%is_lgu%' and qual like '%is_official%')
      and not exists (select 1 from pg_policies where schemaname='public' and tablename='authorized_beneficiaries'
                      and cmd in ('SELECT','ALL') and (qual is null or qual='true')),
      'Staff-only beneficiary policy, including the replacement installed by 077'),
    (26, '026_scope_reads_by_barangay.sql',
      (select count(*)=2 from pg_trigger where not tgisinternal and tgenabled in ('O','A') and
       (tgrelid, tgname) in ((to_regclass('public.relief_distributions'),'relief_distributions_fill_brgy'),
                            (to_regclass('public.authorized_beneficiaries'),'authorized_beneficiaries_fill_brgy'))) and
      exists (select 1 from pg_policies where schemaname='public' and tablename='relief_distributions'
              and policyname='relief_distributions_read' and qual like '%my_barangay_id%'),
      'Barangay ID assignment triggers and schedule read scope'),
    (41, '041_core_modules_def_settings.sql',
      (select count(*)=2 and bool_and(relrowsecurity) from pg_class
       where oid in (to_regclass('public.relief_inventory'),to_regclass('public.relief_distribution_log'))) and
      exists (select 1 from pg_policies where schemaname='public' and tablename='relief_inventory' and policyname='relief_inventory read') and
      exists (select 1 from pg_policies where schemaname='public' and tablename='relief_distribution_log' and policyname='relief_dist_log read'),
      'Inventory and distribution ledger read policies and active row-level security'),
    (43, '043_super_admin.sql',
      to_regprocedure('public.is_super_admin()') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_super_admin'),
      'is_super_admin() and profiles.is_super_admin'),
    (44, '044_reports_documentation.sql',
      to_regclass('public.damage_assessments') is not null and to_regclass('public.situation_reports') is not null,
      'damage_assessments and situation_reports'),
    (45, '045_super_admin_improvements.sql',
      to_regclass('public.audit_log_with_actor') is not null,
      'audit_log_with_actor'),
    (46, '046_super_admin_verify_block_and_change_requests.sql',
      to_regclass('public.change_requests') is not null,
      'change_requests'),
    (47, '047_one_hour_lgu_escalation.sql',
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='escalation_status') and
      to_regclass('public.lgu_escalation_queue') is not null,
      'reports.escalation_status and lgu_escalation_queue'),
    (49, '049_dispatch_team_features.sql',
      to_regclass('public.dispatch_help_requests') is not null and
      to_regprocedure('public.request_relief_escort(uuid,text)') is not null and
      to_regprocedure('public.confirm_relief_escort(uuid)') is not null,
      'Dispatch support requests and relief escort request and confirmation RPCs'),
    (50, '050_equipment_management.sql',
      to_regprocedure('public.add_equipment(uuid,uuid,uuid,text,text,text,text)') is not null,
      'add_equipment(...)'),
    (53, '053_barangay_boundaries.sql',
      to_regclass('public.barangay_boundaries') is not null and to_regprocedure('public.barangay_at(double precision,double precision)') is not null,
      'barangay_boundaries and barangay_at(...)'),
    (56, '056_realtime_core_tables.sql',
      (select count(*)=2 from pg_publication_tables where pubname='supabase_realtime'
       and schemaname='public' and tablename in ('relief_distributions','authorized_beneficiaries')),
      'Schedules and authorized beneficiaries published to Realtime'),
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
      exists (select 1 from pg_proc where oid=to_regprocedure('public.read_relief_stock()') and not prosecdef) and
      to_regclass('public.relief_stock_adjustments') is not null and
      to_regprocedure('public.save_relief_item(text,text,text,text,integer,integer,text,text,timestamptz)') is not null and
      to_regprocedure('public.adjust_relief_stock(text,integer,uuid)') is not null and
      to_regprocedure('public.record_relief_stock_distribution(text,text,integer,text,text)') is not null and
      to_regprocedure('public.void_relief_stock_distribution(text)') is not null and
      not exists (
        select 1 from (values (to_regclass('public.relief_inventory')), (to_regclass('public.relief_distribution_log'))) stock(rel)
        where stock.rel is null or not has_table_privilege('authenticated',stock.rel,'SELECT')
          or has_table_privilege('authenticated',stock.rel,'INSERT, UPDATE, DELETE')
          or has_table_privilege('anon',stock.rel,'INSERT, UPDATE, DELETE')
      ) and
      (select count(*)=2 from pg_publication_tables where pubname='supabase_realtime'
       and schemaname='public' and tablename in ('relief_inventory','relief_distribution_log')),
      'Shared stock RPCs, adjustment ledger, Realtime and no direct stock writes by browser roles'),
    (75, '075_super_admin_audit_fixes.sql',
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='change_requests' and column_name='requester_id' and is_nullable='YES'),
      'change_requests.requester_id is nullable'),
    (76, '076_super_admin_notifications.sql',
      to_regprocedure('public.claim_admin_push(integer)') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='audience'),
      'Super Admin notification queue'),
    (77, '077_relief_scope_and_support_completion.sql',
      exists (select 1 from pg_policies where schemaname='public' and tablename='relief_distributions' and policyname='relief_distributions_manage') and
      exists (select 1 from pg_policies where schemaname='public' and tablename='authorized_beneficiaries' and policyname='authorized_beneficiaries_manage'),
      'Barangay-scoped relief and beneficiary policies'),
    (78, '078_report_access_and_reliable_submissions.sql',
      to_regclass('public.submission_receipts') is not null and
      to_regclass('public.dispatch_replacement_queue') is not null and
      to_regprocedure('public.submit_hazard_report(uuid,jsonb)') is not null and
      to_regprocedure('public.submit_sos_once(uuid,double precision,double precision,double precision,text,text)') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports_feed' and column_name='location_note'),
      'Scoped report feed, landmarks and idempotent submissions'),
    (79, '079_mobile_delivery_reliability.sql',
      to_regprocedure('public.sync_mobile_push_device(text,text,text,text,uuid,text)') is not null and
      to_regprocedure('public.renew_mobile_push_device(text,uuid,text,text,text)') is not null and
      to_regprocedure('public.claim_advisory_sms(uuid,uuid)') is not null and
      to_regclass('public.advisory_sms_deliveries') is not null,
      'Device renewal RPCs and per-advisory SMS ledger'),
    (80, '080_backend_audit_fixes.sql',
      exists (select 1 from pg_class where oid=to_regclass('public.others_hazard_review') and 'security_invoker=true'=any(reloptions)) and
      exists (select 1 from pg_policies where schemaname='public' and tablename='advisory_sms_deliveries'
              and policyname='reject_removed_account' and permissive='RESTRICTIVE') and
      exists (select 1 from pg_proc where oid=to_regprocedure('public.update_equipment(uuid,text,text,text,text)')
              and position('coalesce(left(trim(p_notes), 1000), notes)' in prosrc)>0) and
      to_regprocedure('public.lgu_verify_overdue_report(uuid)') is null,
      'Equipment note preservation, scoped review and account policy guards'),
    (81, '081_advisory_publishing.sql',
      to_regprocedure('public.publish_advisory(uuid,jsonb,uuid[])') is not null and
      to_regprocedure('public.emergency_push_device_count()') is not null,
      'Atomic advisory publication and eligible device count'),
    (82, '082_shelter_occupancy_and_analytics.sql',
      to_regprocedure('public.set_shelter_occupancy(uuid,integer,boolean)') is not null and
      exists (select 1 from pg_proc where oid=to_regprocedure('public.analytics_daily(date,date)')
              and 'TimeZone=Asia/Manila'=any(proconfig)),
      'Concurrent occupancy updates and Philippine analytics dates'),
    (83, '083_alert_receipts_and_report_register.sql',
      to_regprocedure('public.acknowledge_emergency_advisory(uuid)') is not null and
      to_regprocedure('public.issue_situation_report(uuid,jsonb)') is not null and
      to_regprocedure('public.declare_emergency_once(uuid,text,text)') is not null and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.situation_reports') and tgname='situation_reports_number'),
      'Alert receipts, server-issued situation report numbers and declaration retries'),
    (84, '084_sos_and_dispatch_delivery.sql',
      exists (select 1 from pg_policies where schemaname='public' and tablename='reports'
              and policyname='reports_read_assigned_dispatch') and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.reports') and tgname='reports_notify_review') and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.emergency_delivery') and tgname='emergency_delivery_wake'),
      'Assigned report visibility, staffed routing and immediate emergency worker wake'),
    (85, '085_corroboration_reliability.sql',
      to_regprocedure('public.corroboration_nearby_reports(uuid)') is not null and
      exists (select 1 from pg_proc where oid = to_regprocedure('public.corroborate_report(uuid,text,double precision,double precision)')
            and position('already_confirmed' in prosrc) > 0),
      'Shared corroboration count and retry-safe confirmations'),
    (86, '086_relief_supply_units.sql',
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.relief_inventory') and tgname='relief_stock_guard_unit'),
      'Supply units preserved for recorded distributions'),
    (87, '087_relief_equipment_audit.sql',
      to_regprocedure('public.my_active_pnp_unit()') is not null and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.dispatch_equipment') and tgname='dispatch_equipment_guard_booking') and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.relief_inventory') and tgname='relief_inventory_low_stock_alert'),
      'Escort confirmation, booked equipment guards and server-side low-stock alerts'),
    (88, '088_relief_stock_push.sql',
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.notifications')
              and tgname='notifications_queue_relief_stock_push' and tgenabled in ('O','A')) and
      exists (select 1 from pg_constraint where conrelid=to_regclass('public.emergency_delivery')
              and conname='emergency_delivery_kind_check' and pg_get_constraintdef(oid) like '%relief_low_stock%'),
      'Normal-priority push queue for relief stock notifications')
)
select migration,
       case when installed then 'INSTALLED' else 'MISSING' end as status,
       evidence
from checks
order by sort_order;

with current_state as (
  select
    to_regclass('public.audit_log_with_actor') is not null as has_045,
    to_regprocedure('public.ug_unanswered_sweep()') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='expired_at') as has_067,
    to_regprocedure('public.remove_staff_account(uuid)') is not null as has_068,
    to_regclass('public.sos_staff_receipts') is not null as has_069,
    to_regprocedure('public.owns_linked_sos(uuid)') is not null as has_070,
    to_regclass('public.emergency_delivery') is not null as has_071,
    to_regprocedure('public.account_session_blocked()') is not null as has_072,
    to_regclass('public.barangay_dispatch_requests') is not null as has_073,
    exists (select 1 from pg_proc where oid=to_regprocedure('public.read_relief_stock()') and not prosecdef) and
      to_regclass('public.relief_stock_adjustments') is not null and
      to_regprocedure('public.save_relief_item(text,text,text,text,integer,integer,text,text,timestamptz)') is not null and
      to_regprocedure('public.adjust_relief_stock(text,integer,uuid)') is not null and
      to_regprocedure('public.record_relief_stock_distribution(text,text,integer,text,text)') is not null and
      to_regprocedure('public.void_relief_stock_distribution(text)') is not null as has_074,
    not exists (
        select 1 from (values (to_regclass('public.relief_inventory')), (to_regclass('public.relief_distribution_log'))) stock(rel)
        where stock.rel is null or not has_table_privilege('authenticated',stock.rel,'SELECT')
          or has_table_privilege('authenticated',stock.rel,'INSERT, UPDATE, DELETE')
          or has_table_privilege('anon',stock.rel,'INSERT, UPDATE, DELETE')
      ) and
      (select count(*)=2 from pg_publication_tables where pubname='supabase_realtime'
       and schemaname='public' and tablename in ('relief_inventory','relief_distribution_log')) as has_074_protection,
    (select count(*)=2 and bool_and(relrowsecurity) from pg_class
       where oid in (to_regclass('public.relief_distributions'),to_regclass('public.authorized_beneficiaries'))) and
      exists (select 1 from pg_policies where schemaname='public' and tablename='authorized_beneficiaries'
              and policyname in ('authorized_beneficiaries_read','authorized_beneficiaries_manage')
              and qual like '%is_lgu%' and qual like '%is_official%')
      and not exists (select 1 from pg_policies where schemaname='public' and tablename='authorized_beneficiaries'
                      and cmd in ('SELECT','ALL') and (qual is null or qual='true')) and
      (select count(*)=2 from pg_trigger where not tgisinternal and tgenabled in ('O','A') and
       (tgrelid, tgname) in ((to_regclass('public.relief_distributions'),'relief_distributions_fill_brgy'),
                            (to_regclass('public.authorized_beneficiaries'),'authorized_beneficiaries_fill_brgy'))) and
      exists (select 1 from pg_policies where schemaname='public' and tablename='relief_distributions'
              and policyname='relief_distributions_read' and qual like '%my_barangay_id%') and
      (select count(*)=2 and bool_and(relrowsecurity) from pg_class
       where oid in (to_regclass('public.relief_inventory'),to_regclass('public.relief_distribution_log'))) and
      exists (select 1 from pg_policies where schemaname='public' and tablename='relief_inventory' and policyname='relief_inventory read') and
      exists (select 1 from pg_policies where schemaname='public' and tablename='relief_distribution_log' and policyname='relief_dist_log read') and
      to_regprocedure('public.request_relief_escort(uuid,text)') is not null and
      to_regprocedure('public.confirm_relief_escort(uuid)') is not null and
      (select count(*)=2 from pg_publication_tables where pubname='supabase_realtime'
       and schemaname='public' and tablename in ('relief_distributions','authorized_beneficiaries')) as has_relief_foundation,
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='change_requests' and column_name='requester_id' and is_nullable='YES') as has_075,
    to_regprocedure('public.claim_admin_push(integer)') is not null as has_076,
    exists (select 1 from pg_policies where schemaname='public' and tablename='relief_distributions' and policyname='relief_distributions_manage') and
      exists (select 1 from pg_policies where schemaname='public' and tablename='authorized_beneficiaries' and policyname='authorized_beneficiaries_manage') as has_077,
    to_regclass('public.submission_receipts') is not null and
      to_regclass('public.dispatch_replacement_queue') is not null and
      to_regprocedure('public.submit_hazard_report(uuid,jsonb)') is not null and
      to_regprocedure('public.submit_sos_once(uuid,double precision,double precision,double precision,text,text)') is not null and
      exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports_feed' and column_name='location_note') as has_078,
    to_regprocedure('public.sync_mobile_push_device(text,text,text,text,uuid,text)') is not null and
      to_regprocedure('public.renew_mobile_push_device(text,uuid,text,text,text)') is not null and
      to_regprocedure('public.claim_advisory_sms(uuid,uuid)') is not null and
      to_regclass('public.advisory_sms_deliveries') is not null as has_079,
      exists (select 1 from pg_class where oid=to_regclass('public.others_hazard_review') and 'security_invoker=true'=any(reloptions)) and
      exists (select 1 from pg_policies where schemaname='public' and tablename='advisory_sms_deliveries'
              and policyname='reject_removed_account' and permissive='RESTRICTIVE') and
      exists (select 1 from pg_proc where oid=to_regprocedure('public.update_equipment(uuid,text,text,text,text)')
              and position('coalesce(left(trim(p_notes), 1000), notes)' in prosrc)>0) and
      to_regprocedure('public.lgu_verify_overdue_report(uuid)') is null as has_080,
    to_regprocedure('public.publish_advisory(uuid,jsonb,uuid[])') is not null and
      to_regprocedure('public.emergency_push_device_count()') is not null as has_081,
    to_regprocedure('public.set_shelter_occupancy(uuid,integer,boolean)') is not null and
      exists (select 1 from pg_proc where oid=to_regprocedure('public.analytics_daily(date,date)')
              and 'TimeZone=Asia/Manila'=any(proconfig)) as has_082,
    to_regprocedure('public.acknowledge_emergency_advisory(uuid)') is not null and
      to_regprocedure('public.issue_situation_report(uuid,jsonb)') is not null and
      to_regprocedure('public.declare_emergency_once(uuid,text,text)') is not null and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.situation_reports') and tgname='situation_reports_number') as has_083,
    exists (select 1 from pg_policies where schemaname='public' and tablename='reports'
            and policyname='reports_read_assigned_dispatch') and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.reports') and tgname='reports_notify_review') and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.emergency_delivery') and tgname='emergency_delivery_wake') as has_084,
    to_regprocedure('public.corroboration_nearby_reports(uuid)') is not null and
      exists (select 1 from pg_proc where oid = to_regprocedure('public.corroborate_report(uuid,text,double precision,double precision)')
            and position('already_confirmed' in prosrc) > 0) as has_085,
    exists (select 1 from pg_trigger where tgrelid=to_regclass('public.relief_inventory') and tgname='relief_stock_guard_unit') as has_086,
    to_regprocedure('public.my_active_pnp_unit()') is not null and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.dispatch_equipment') and tgname='dispatch_equipment_guard_booking') and
      exists (select 1 from pg_trigger where tgrelid=to_regclass('public.relief_inventory') and tgname='relief_inventory_low_stock_alert') as has_087,
    exists (select 1 from pg_trigger where tgrelid=to_regclass('public.notifications')
              and tgname='notifications_queue_relief_stock_push' and tgenabled in ('O','A')) and
      exists (select 1 from pg_constraint where conrelid=to_regclass('public.emergency_delivery')
              and conname='emergency_delivery_kind_check' and pg_get_constraintdef(oid) like '%relief_low_stock%') as has_088
)
select case
  when has_067 and not has_relief_foundation then 'STOP: relief security or publication evidence is missing. Review the listed relief milestones.'
  when not has_067 then 'STOP: the database is behind 067 or has gaps. Share the full results before applying the update.'
  when not has_045 then 'STOP: the Super Admin improvements from 045 are missing. Review the full milestone results.'
  when not has_068 then 'NEXT: apply 068, then continue in filename order through 088.'
  when not has_069 then 'NEXT: apply 069, then continue in filename order through 088.'
  when not has_070 then 'NEXT: apply 070, then continue in filename order through 088.'
  when not has_071 then 'NEXT: apply 071, then continue in filename order through 088.'
  when not has_072 then 'NEXT: apply 072, then continue in filename order through 088.'
  when not has_073 then 'NEXT: apply 073, then continue in filename order through 088.'
  when not has_074 then 'NEXT: apply 074, then 075 through 088.'
  when not has_074_protection then 'STOP: stock write permissions or Realtime publication are incomplete. Review migration 074.'
  when not has_075 then 'READY: apply 075 through 088.'
  when not has_076 then 'READY: apply 076 through 088.'
  when not has_077 then 'READY: apply 077 through 088.'
  when not has_078 then 'READY: apply 078 through 088.'
  when not has_079 then 'READY: apply 079 through 088.'
  when not has_080 then 'READY: apply 080 through 088.'
  when not has_081 then 'READY: apply 081 through 088.'
  when not has_082 then 'READY: apply 082 through 088.'
  when not has_083 then 'READY: apply 083 through 088.'
  when not has_084 then 'READY: apply 084 through 088.'
  when not has_085 then 'READY: apply 085 through 088.'
  when not has_086 then 'READY: apply 086 through 088.'
  when not has_087 then 'READY: apply 087 through 088.'
  when not has_088 then 'READY: apply 088.'
  else 'CURRENT: schema features through 088 are installed.'
end as recommendation
from current_state;

-- A MISSING milestone after an INSTALLED later milestone means the database has
-- a gap. Do not infer that every earlier file ran from the largest installed
-- number. Share the full result grid before applying anything in that case.
