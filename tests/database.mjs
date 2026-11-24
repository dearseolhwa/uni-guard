import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyRoles as verifyReportAccess } from './report-access.mjs';
import { verifyRoles as verifyDispatchReplacement } from './dispatch-replacement.mjs';
const db = await PGlite.create({extensions:{pgcrypto,pg_trgm}});
const root = fileURLToPath(new URL('../', import.meta.url));
const migrations = resolve(root, 'migrations');
try {
  await db.exec(`
    create extension pg_trgm;
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
  for (const f of (await fs.readdir(migrations)).sort().filter(f=>f.endsWith('.sql')&&!f.startsWith('000'))) {
    try { await db.exec(await fs.readFile(migrations+'/'+f, 'utf8')); }
    catch (e) { throw Error(f+': '+e.message, {cause:e}); }
  }
  await db.exec(await fs.readFile(resolve(migrations,'078_report_access_and_reliable_submissions.sql'),'utf8'));
  const checkerResults = await db.exec(await fs.readFile(resolve(root, 'docs/CHECK-SUPABASE-MIGRATIONS.sql'), 'utf8'));
  const milestones = checkerResults.find((result) => result.rows?.some((row) => row.migration === '076_super_admin_notifications.sql'))?.rows || [];
  assert.ok(milestones.length > 0);
  assert.deepEqual(milestones.filter((row) => row.status !== 'INSTALLED'), []);
  assert.equal(checkerResults.find((result) => result.rows?.[0]?.recommendation)?.rows[0].recommendation,
    'CURRENT: schema features through 078 are installed.');
  console.log('Applied the entire 001–078 chain in embedded PostgreSQL with Auth/Storage fixtures.');
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
} finally { await db.close(); }
