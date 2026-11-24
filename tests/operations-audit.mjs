import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyOperationsAudit(db) {
  const rows = async (sql, params) => (await db.query(sql, params)).rows;
  const [local, remote] = await rows("select id,name from public.barangays where name in ('Poblacion','Malawa') order by name desc");
  const accounts = {};
  for (const [key, role, barangay] of [
    ['citizen', 'citizen', local], ['otherCitizen', 'citizen', remote],
    ['official', 'barangay_official', local], ['otherOfficial', 'barangay_official', remote],
    ['duty', 'lgu_ldrrmc', local], ['disabled', 'citizen', local]
  ]) {
    const id = randomUUID();
    accounts[key] = id;
    await db.query('insert into auth.users (id,email) values ($1,$2)', [id, id + '@example.test']);
    await db.query('update public.profiles set role=$1,barangay_id=$2,barangay=$3,disabled=$4 where id=$5',
      [role, barangay.id, barangay.name, key === 'disabled', id]);
  }
  await db.exec('grant select on public.advisories, public.advisory_targets, public.evacuation_centers to authenticated');
  await db.exec('grant update on public.evacuation_centers to authenticated');
  const as = (account, sql, params) => db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({sub: accounts[account], role: 'authenticated'})]);
    return (await tx.query(sql, params)).rows;
  });

  const id = randomUUID();
  const draft = {title: 'Fixture warning', body: 'Use the posted detour.', severity: 'warning', citywide: false, delivery_mode: 'in_app'};
  const publish = 'select public.publish_advisory($1,$2::jsonb,$3::uuid[]) as item';
  await assert.rejects(as('citizen', publish, [id, draft, [local.id]]), {code: '42501'});
  await assert.rejects(as('official', publish, [id, draft, [remote.id]]), /only publish to your own barangay/);
  await assert.rejects(as('official', publish, [id, {...draft, citywide: true}, []]), {code: '42501'});
  await assert.rejects(as('duty', publish, [id, draft, []]), /Choose a valid barangay/);
  assert.deepEqual(await rows('select id from public.advisories where id=$1', [id]), []);
  const [{item}] = await as('official', publish, [id, draft, [local.id, local.id]]);
  assert.deepEqual(item.barangay_ids, [local.id]);
  assert.equal(item.affected_area, local.name);
  assert.ok(item.reached > 0);
  assert.deepEqual(await as('official', publish, [id, draft, [local.id]]), [{item}]);
  const notice = await rows('select user_id from public.notifications where advisory_id=$1', [id]);
  assert.equal(notice.length, item.reached);
  assert.equal(new Set(notice.map((row) => row.user_id)).size, item.reached);
  assert.ok(notice.some((row) => row.user_id === accounts.citizen));
  assert.ok(!notice.some((row) => [accounts.otherCitizen, accounts.disabled].includes(row.user_id)));
  assert.deepEqual(await as('citizen', 'select id from public.advisories where id=$1', [id]), [{id}]);
  assert.deepEqual(await as('otherCitizen', 'select id from public.advisories where id=$1', [id]), []);

  const failedId = randomUUID();
  await db.exec(`
    create function public.fixture_fail_notification() returns trigger language plpgsql as $$
      begin raise exception 'Fixture notification write failed'; end;
    $$;
    create trigger fixture_fail_notification before insert on public.notifications for each row
      when (new.advisory_id = '${failedId}'::uuid) execute function public.fixture_fail_notification();
  `);
  try {
    await assert.rejects(as('official', publish, [failedId, draft, [local.id]]), /Fixture notification write failed/);
    assert.deepEqual(await rows('select id from public.advisories where id=$1', [failedId]), []);
    assert.deepEqual(await rows('select barangay_id from public.advisory_targets where advisory_id=$1', [failedId]), []);
  } finally {
    await db.exec('drop trigger fixture_fail_notification on public.notifications; drop function public.fixture_fail_notification()');
  }

  await db.query(`insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values
    ($1, 'https://push.example.test/eligible', 'fixture', 'fixture'),
    ($2, 'https://push.example.test/disabled', 'fixture', 'fixture')`, [accounts.citizen, accounts.disabled]);
  const expectedCount = (await rows(`select count(*)::int as n from public.push_subscriptions s
    join public.profiles p on p.id=s.user_id where not p.disabled and p.removed_at is null`))[0].n;
  await assert.rejects(as('official', 'select public.emergency_push_device_count()'), {code: '42501'});
  assert.deepEqual(await as('duty', 'select public.emergency_push_device_count() as count'), [{count: expectedCount}]);
  const [{ declaration }] = await as('duty', "select public.declare_emergency('Fixture declaration', 'A test') as declaration");
  assert.equal(declaration.devices, expectedCount);
  assert.ok(declaration.notified > 0);

  const shelter = randomUUID();
  await db.query(`insert into public.evacuation_centers(id,name,barangay_id,barangay,capacity,occupancy,needs_patrol)
    values ($1,'Fixture shelter',$2,$3,3,1,true)`, [shelter, local.id, local.name]);
  const occupancy = 'select public.set_shelter_occupancy($1,$2,$3) as center';
  await assert.rejects(as('citizen', occupancy, [shelter, 1, true]), {code: '42501'});
  await assert.rejects(as('otherOfficial', occupancy, [shelter, 1, true]), {code: '42501'});
  const [{center: first}] = await as('official', occupancy, [shelter, 1, true]);
  assert.equal(first.occupancy, 2);
  const [{center: second}] = await as('duty', occupancy, [shelter, 1, true]);
  assert.equal(second.occupancy, 3);
  assert.equal(second.status, 'full');
  assert.equal(second.needs_patrol, true);
  const [{center: reopened}] = await as('official', occupancy, [shelter, -1, true]);
  assert.equal(reopened.status, 'open');
  await assert.rejects(as('official', occupancy, [shelter, 4, false]), /between zero and the shelter capacity/);
  await db.query("update public.evacuation_centers set status='closed' where id=$1", [shelter]);
  await assert.rejects(as('official', occupancy, [shelter, 1, true]), /Open the shelter/);

  await db.exec('alter table public.reports disable trigger user');
  try {
    await db.query(`insert into public.reports(hazard_type,description,barangay,barangay_id,created_at)
      values ('flood','Before Philippine midnight',$1,$2,'2024-01-17T15:59:59Z'),
      ('flood','After Philippine midnight',$1,$2,'2024-01-17T16:00:00Z')`, [local.name, local.id]);
  } finally { await db.exec('alter table public.reports enable trigger user'); }
  const [day] = await as('official', "select day::text,total::int from public.analytics_daily('2024-01-18','2024-01-18')");
  assert.deepEqual(day, {day: '2024-01-18', total: 1});
  console.log('PASS Atomic and repeatable advisory publishing, real emergency device count, shelter occupancy and Philippine date cutoffs.');
}
