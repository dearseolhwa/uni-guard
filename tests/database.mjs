import { verifySupplyAudit } from './supply-audit.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyRoles as verifyReportAccess } from './report-access.mjs';
import { verifyRoles as verifyDispatchReplacement } from './dispatch-replacement.mjs';
import { verifyMobileDelivery } from './mobile-delivery.mjs';
import { verifyBackendAudit } from './backend-audit.mjs';
import { verifyOperationsAudit } from './operations-audit.mjs';
const db = await PGlite.create({extensions:{pgcrypto,pg_trgm}});
const root = fileURLToPath(new URL('../', import.meta.url));
const migrations = resolve(root, 'migrations');
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls; create role authenticator;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'sub')::uuid
    $$;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}', banned_until timestamptz,
      updated_at timestamptz, invited_at timestamptz, last_sign_in_at timestamptz);
    create table auth.sessions (id uuid primary key, user_id uuid references auth.users(id) on delete cascade);
    create schema storage;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
  `);
  const readMigration = (file) => fs.readFile(resolve(migrations, file), 'utf8');
  const checkerSql = await fs.readFile(resolve(root, 'docs/CHECK-SUPABASE-MIGRATIONS.sql'), 'utf8');
  const recommendation = (results) => results.find(result => result.rows?.[0]?.recommendation)?.rows[0].recommendation;
  const files = (await fs.readdir(migrations)).sort().filter(file => file.endsWith('.sql') && !file.startsWith('000'));
  assert.equal(new Set(files.map(file => file.split('_')[0])).size, files.length);
  const legacyReport = '00000000-0000-4000-8000-000000000099';
  const stageDispatch = '00000000-0000-4000-8000-000000000098';
  for (const file of files) {
    const version = file.split('_')[0];
    if (version === '010') {
      await db.exec('alter table public.reports disable trigger user');
      await db.query("insert into public.reports(id,hazard_type,description) values ($1,'Others','Legacy description')", [legacyReport]);
      await db.exec('alter table public.reports enable trigger user');
    }
    if (version === '031') {
      await db.exec("insert into public.road_status(road_name,status) values ('Fixture Road','caution')");
    }
    if (version === '081') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 081 through 092.');
    if (version === '082') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 082 through 092.');
    if (version === '083') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 083 through 092.');
    if (version === '084') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 084 through 092.');
    if (version === '085') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 085 through 092.');
    if (version === '086') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 086 through 092.');
    if (version === '087') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 087 through 092.');
    if (version === '088') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 088 through 092.');
    if (version === '089') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 089 through 092.');
    if (version === '090') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 090 through 092.');
    if (version === '091') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 091 through 092.');
    if (version === '092') assert.equal(recommendation(await db.exec(checkerSql)), 'READY: apply 092.');
    try { await db.exec(await readMigration(file)); }
    catch (error) { throw Error(file + ': ' + error.message, { cause: error }); }
    if (version === '010') {
      const { rows } = await db.query('select hazard_other_text,description from public.reports where id=$1', [legacyReport]);
      assert.deepEqual(rows, [{ hazard_other_text: 'Unspecified legacy hazard', description: 'Legacy description' }]);
      await db.query('delete from public.reports where id=$1', [legacyReport]);
    }
    if (version === '011') {
      const { rows } = await db.query("select indexdef from pg_indexes where indexname='authorized_beneficiaries_name_trgm'");
      assert.match(rows[0].indexdef, /gin_trgm_ops/);
    }
    if (version === '031') {
      const { rows } = await db.query("delete from public.road_status where road_name='Fixture Road' returning status");
      assert.deepEqual(rows, [{ status: 'one_lane' }]);
    }
    if (version === '049') {
      await db.exec('alter table public.reports disable trigger user');
      await db.query("insert into public.reports(id,hazard_type,description) values ($1,'Flood','Help request fixture')", [legacyReport]);
      await db.exec('alter table public.reports enable trigger user');
      await db.query("insert into public.report_dispatches(id,report_id,team,eta) values ($1,$2,'BFP',now())", [stageDispatch, legacyReport]);
      await db.query("insert into public.dispatch_help_requests(dispatch_id,updated_at) values ($1,'2000-01-01')", [stageDispatch]);
      const { rows } = await db.query("update public.dispatch_help_requests set status='acknowledged' where dispatch_id=$1 returning updated_at>'2000-01-01' as touched", [stageDispatch]);
      assert.deepEqual(rows, [{ touched: true }]);
      await db.query('delete from public.reports where id=$1', [legacyReport]);
    }
  }
  const queueDefinition = "select pg_get_viewdef('public.lgu_escalation_queue'::regclass) as definition";
  const oldQueue = (await db.query(queueDefinition)).rows;
  await db.exec(await readMigration('047_one_hour_lgu_escalation.sql'));
  assert.deepEqual((await db.query(queueDefinition)).rows, oldQueue);
  assert.equal((await db.query("select to_regprocedure('public.lgu_verify_overdue_report(uuid)') as obsolete")).rows[0].obsolete, null);
  await db.exec(await readMigration('079_mobile_delivery_reliability.sql'));
  await db.exec(await readMigration('080_backend_audit_fixes.sql'));
  await db.exec(await readMigration('081_advisory_publishing.sql'));
  await db.exec(await readMigration('082_shelter_occupancy_and_analytics.sql'));
  await db.exec(await readMigration('083_alert_receipts_and_report_register.sql'));
  await db.exec(await readMigration('084_sos_and_dispatch_delivery.sql'));
  await db.exec(await readMigration('085_corroboration_reliability.sql'));
  await db.exec(await readMigration('086_relief_supply_units.sql'));
  await db.exec(await readMigration('087_relief_equipment_audit.sql'));
  await db.exec(await readMigration('088_relief_stock_push.sql'));
  await db.exec(await readMigration('089_resident_ack_notifications.sql'));
  await db.exec(await readMigration('090_dispatch_track_points.sql'));
  await db.exec(await readMigration('091_sos_location_fallback.sql'));
  await db.exec(await readMigration('092_super_admin_sos_read_only.sql'));
  console.log('PASS Fresh migration chain, legacy hazard and road records, staged help requests and escalation replay.');
  const checkerResults = await db.exec(checkerSql);
  const milestones = checkerResults.find((result) => result.rows?.some((row) => row.migration === '076_super_admin_notifications.sql'))?.rows || [];
  assert.ok(milestones.length > 0);
  assert.deepEqual(milestones.filter((row) => row.status !== 'INSTALLED'), []);
  assert.equal(recommendation(checkerResults),
    'CURRENT: schema features through 092 are installed.');
  await db.transaction(async tx => {
    await tx.exec('grant update on public.relief_inventory to authenticated');
    assert.equal(recommendation(await tx.exec(checkerSql)),
      'STOP: stock write permissions or Realtime publication are incomplete. Review migration 074.');
    await tx.exec('revoke update on public.relief_inventory from authenticated');
    await tx.exec('alter table public.authorized_beneficiaries disable row level security');
    assert.equal(recommendation(await tx.exec(checkerSql)),
      'STOP: relief security or publication evidence is missing. Review the listed relief milestones.');
    await tx.exec('alter table public.authorized_beneficiaries enable row level security');
  });
  console.log('Applied the entire 001–092 chain in embedded PostgreSQL with Auth/Storage fixtures.');
  await db.exec(`
    insert into auth.users(id,email) values
      ('00000000-0000-4000-8000-000000000001', 'actor@example.test'),
      ('00000000-0000-4000-8000-000000000002', 'recipient@example.test'),
      ('00000000-0000-4000-8000-000000000003', 'requester@example.test');
    update public.profiles set role='lgu_ldrrmc', is_super_admin=true
      where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
    insert into public.audit_log(actor_id,action,entity,entity_id) values
      ('00000000-0000-4000-8000-000000000001','user.account_updated','profiles','00000000-0000-4000-8000-000000000003');
    insert into public.change_requests(id,requester_id,target_table,target_id,action) values
      ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','emergency_hotlines','00000000-0000-4000-8000-000000000005','edit');
  `);
  const {rows: notices} = await db.query("select user_id, type, push_status from public.notifications where audience='super_admin' order by type,user_id");
  assert.equal(notices.length,3);
  assert.equal(notices.filter(n=>n.type==='sa.account')[0].user_id,'00000000-0000-4000-8000-000000000002');
  assert.ok(notices.every(n=>n.push_status==='pending'));
  await db.exec("select set_config('request.jwt.claims','{\"sub\":\"00000000-0000-4000-8000-000000000002\"}',false)");
  await assert.rejects(db.exec("select public.approve_change_request('00000000-0000-4000-8000-000000000004','')"), /Target record no longer exists/);
  assert.equal((await db.query("select status from public.change_requests")).rows[0].status,'pending');
  await db.exec("select set_config('request.jwt.claims','',false); delete from auth.users where id='00000000-0000-4000-8000-000000000003'");
  assert.equal((await db.query("select requester_id from public.change_requests")).rows[0].requester_id,null);
  assert.equal((await db.query("select count(*)::int as n from pg_policies where policyname='reject_revoked_session' and tablename='barangay_dispatch_requests'")).rows[0].n,1);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.claim_admin_push(integer)','EXECUTE') as allowed")).rows[0].allowed,false);
  const {rows: claimed} = await db.query('select id,push_lease from public.claim_admin_push(50)');
  assert.equal(claimed.length,3);
  await db.query("select public.finish_admin_push($1,$2,'sent')", [claimed[0].id,claimed[0].push_lease]);
  assert.equal((await db.query('select push_status from public.notifications where id=$1',[claimed[0].id])).rows[0].push_status,'sent');
  await db.exec("create schema vault; create table vault.decrypted_secrets(name text,decrypted_secret text); insert into vault.decrypted_secrets values ('uniguard_admin_notify_secret','fixture-token')");
  assert.deepEqual((await db.query("select public.admin_notify_token_ok('fixture-token') as valid, public.admin_notify_token_ok('wrong-token') as invalid")).rows[0],{valid:true,invalid:false});
  console.log('Passed Super Admin triggers, requester deletion, missing hotline approval, policy presence, push queue, and Vault token SQL checks.');
  await verifyReportAccess(db);
  await verifyDispatchReplacement(db);
  await verifyMobileDelivery(db);
  await verifyBackendAudit(db);
  await verifyOperationsAudit(db);
  await verifySupplyAudit(db);
  const seed = await fs.readFile(resolve(root, 'seed/003_dispatch_units.sql'), 'utf8');
  await assert.rejects(db.exec(seed), /requires the uniguard.demo_seed setting/);
  await db.exec('rollback');
} finally { await db.close(); }
