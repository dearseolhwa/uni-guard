import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyBackendAudit(db) {
  const rows = async (sql, args) => (await db.query(sql, args)).rows;
  const [local, other] = await rows("select id,name from public.barangays where name in ('Poblacion','Malawa') order by name desc");
  const users = {};
  for (const [name, role, area] of [
    ['resident', 'citizen', local], ['official', 'barangay_official', local],
    ['otherOfficial', 'barangay_official', other], ['duty', 'lgu_ldrrmc', local],
    ['removed', 'citizen', local]
  ]) {
    const id = randomUUID();
    users[name] = id;
    await db.query('insert into auth.users(id,email) values ($1,$2)', [id, id + '@example.test']);
    await db.query('update public.profiles set role=$1,barangay=$2,barangay_id=$3 where id=$4', [role, area.name, area.id, id]);
  }
  users.admin = '00000000-0000-4000-8000-000000000001';
  async function useAccount(tx, name) {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({sub: users[name], role: 'authenticated'})]);
  }
  const as = (name, sql, args) => db.transaction(async tx => {
    await useAccount(tx, name);
    return (await tx.query(sql, args)).rows;
  });

  const [{ equipment }] = await as('official', "select public.add_equipment(p_owner_barangay_id=>$1,p_custom_label=>'Fixture generator',p_notes=>'Oil checked') as equipment", [local.id]);
  const equipmentRow = 'select notes,condition from public.dispatch_equipment where id=$1';
  await as('official', "select public.update_equipment($1,p_condition=>'ready')", [equipment.id]);
  assert.deepEqual(await rows(equipmentRow, [equipment.id]), [{notes: 'Oil checked', condition: 'ready'}]);
  await as('official', "select public.update_equipment($1,p_notes=>'  Service due  ')", [equipment.id]);
  assert.equal((await rows(equipmentRow, [equipment.id]))[0].notes, 'Service due');
  await assert.rejects(as('otherOfficial', "select public.update_equipment($1,p_notes=>'Test')", [equipment.id]), /only the LGU or this barangay/i);
  await as('official', "select public.update_equipment($1,p_notes=>'')", [equipment.id]);
  assert.equal((await rows(equipmentRow, [equipment.id]))[0].notes, '');

  const label = 'Fixture unusual hazard';
  await as('resident', 'select public.submit_hazard_report($1,$2::jsonb)', [randomUUID(), JSON.stringify({
    hazard_type: 'Others', hazard_other_text: label, barangay: local.name,
    description: 'Fixture hazard', severity: 'warning', urgency: 'warning', lat: 16.0223, lng: 120.2312
  })]);
  const review = 'select description,occurrences::int from public.others_hazard_review where description=$1';
  assert.deepEqual(await as('duty', review, [label]), [{description: label, occurrences: 1}]);
  assert.deepEqual(await as('resident', review, [label]), []);
  assert.deepEqual(await as('official', review, [label]), []);
  const protectedTables = ['sos_staff_receipts', 'emergency_delivery', 'barangay_dispatch_requests', 'relief_stock_adjustments',
    'submission_receipts', 'advisory_sms_deliveries'];
  const [policies] = await rows(`select count(*)::int as checked from pg_policies
    where schemaname='public' and tablename = any($1::text[]) and permissive='RESTRICTIVE' and cmd='ALL'
      and roles = array['authenticated']::name[] and policyname in ('reject_removed_account','reject_revoked_session')`, [protectedTables]);
  assert.equal(policies.checked, protectedTables.length * 2);

  const stockId = 'fixture-audit-stock';
  const distributionId = 'fixture-audit-distribution';
  const addStock = "select public.save_relief_item($1,'Fixture relief stock',$2,'units',20,1,'','')";
  const distribute = "select public.record_relief_stock_distribution($1,$2,2,$3,'Fixture family')";
  const distribution = [distributionId, stockId, local.name];
  await assert.rejects(as('duty', addStock, [stockId, 'Invalid']), /Choose a valid relief stock category/);
  await as('duty', addStock, [stockId, 'Hygiene']);
  await assert.rejects(as('official', distribute, [distributionId, stockId, other.name]), {code: '42501'});
  await assert.rejects(as('duty', distribute, [distributionId, stockId, 'Unknown fixture barangay']), /Choose a valid barangay/);
  await assert.rejects(db.transaction(async tx => {
    await tx.exec('alter table public.barangays drop constraint barangays_name_key');
    await tx.query('insert into public.barangays(name) values ($1)', [local.name]);
    await useAccount(tx, 'duty');
    await tx.query(distribute, distribution);
  }), /matches more than one record/);
  await as('official', distribute, distribution);
  const ledger = `select i.stock,l.voided_at is not null as voided
    from public.relief_inventory i join public.relief_distribution_log l on l.item_id=i.id where l.id=$1`;
  assert.deepEqual(await rows(ledger, [distributionId]), [{stock: 18, voided: false}]);
  await db.query('update public.relief_inventory set stock=2147483647 where id=$1', [stockId]);
  const voidStock = 'select public.void_relief_stock_distribution($1)';
  await assert.rejects(as('duty', voidStock, [distributionId]), /outside its supported range/);
  assert.deepEqual(await rows(ledger, [distributionId]), [{stock: 2147483647, voided: false}]);
  await db.query('update public.relief_inventory set stock=18 where id=$1', [stockId]);
  await as('duty', voidStock, [distributionId]);
  await as('duty', voidStock, [distributionId]);
  assert.deepEqual(await rows(ledger, [distributionId]), [{stock: 20, voided: true}]);

  await db.query('insert into auth.sessions(id,user_id) values ($1,$2)', [randomUUID(), users.removed]);
  await as('admin', 'select public.remove_staff_account($1)', [users.removed]);
  assert.deepEqual(await rows(`select u.banned_until='9999-12-30T00:00:00Z' as banned, p.removed_at is not null as removed,
    (select count(*)::int from auth.sessions where user_id=u.id) as sessions
    from auth.users u join public.profiles p using(id) where u.id=$1`, [users.removed]), [{banned: true, removed: true, sessions: 0}]);

  const [sos] = await rows(`insert into public.sos_log(user_id,barangay,barangay_id,created_at,requires_staff_receipt)
    values ($1,$2,$3,now()-interval '13 hours',true) returning id`, [users.resident, local.name, local.id]);
  const [{ sweep }] = await rows('select public.ug_unanswered_sweep() as sweep');
  assert.equal(sweep.sos_expired, 0);
  assert.deepEqual(await as('official', 'select status,expired_at from public.list_pending_sos_receipts() where id=$1', [sos.id]),
    [{status: 'sent', expired_at: null}]);

  for (const signature of ['public.fanout_road_work(uuid)', 'public.log_client_error(text,jsonb)']) {
    const [permission] = await rows(`select has_function_privilege('anon',$1,'EXECUTE') as anon,
      has_function_privilege('authenticated',$1,'EXECUTE') as authenticated`, [signature]);
    assert.deepEqual(permission, {anon: false, authenticated: true});
  }
  await as('resident', "select public.log_client_error('Fixture diagnostic')");
  assert.deepEqual(await rows('select user_id from public.client_errors where message=$1', ['Fixture diagnostic']), [{user_id: users.resident}]);
  const [post] = await rows("insert into public.road_work_posts(title,barangay,barangay_id) values ('Fixture road delay',$1,$2) returning id", [local.name, local.id]);
  const notify = 'select public.fanout_road_work($1) as sent';
  await assert.rejects(as('otherOfficial', notify, [post.id]), {code: '42501'});
  const [first] = await as('official', notify, [post.id]);
  assert.ok(first.sent > 0);
  assert.deepEqual(await as('official', notify, [post.id]), [{sent: 0}]);
  assert.deepEqual(await rows('select user_id from public.notifications where road_work_id=$1 and user_id=any($2::uuid[])',
    [post.id, [users.resident, users.otherOfficial, users.removed]]), [{user_id: users.resident}]);
  console.log('PASS Equipment notes, hazard review permissions, account guards, relief validation and rollback, staff removal, persistent SOS, diagnostics and road-notification retries.');
}
