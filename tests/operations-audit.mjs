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
  const declarationId = randomUUID();
  const declare = "select public.declare_emergency_once($1,'Fixture retrying declaration','Fixture details') as declaration";
  const firstDeclaration = await as('duty', declare, [declarationId]);
  assert.deepEqual(await as('duty', declare, [declarationId]), firstDeclaration);
  assert.equal(firstDeclaration[0].declaration.advisory_id, declarationId);
  assert.deepEqual(await rows("select count(*)::int as count from public.audit_log where entity_id=$1 and action='emergency.declared'", [declarationId]),
    [{count: 1}]);

  await db.exec('grant select, insert on public.alert_acknowledgments, public.situation_reports to authenticated');
  await db.exec('grant select on public.barangays, public.profiles to authenticated');
  const acknowledge = 'select public.acknowledge_emergency_advisory($1)';
  await as('citizen', acknowledge, [declarationId]);
  await as('citizen', acknowledge, [declarationId]);
  await as('otherCitizen', acknowledge, [declarationId]);
  assert.equal((await rows('select count(*)::int as count from public.alert_acknowledgments where advisory_id=$1', [declarationId]))[0].count, 2);
  await assert.rejects(as('disabled', acknowledge, [declarationId]), {code: '42501'});

  const issue = 'select public.issue_situation_report($1,$2::jsonb) as report';
  const report = {event_name: 'Fixture River Flood', barangay_id: remote.id, period_from: '2024-01-17', period_to: '2024-01-18'};
  const firstId = randomUUID();
  assert.equal((await as('otherOfficial', issue, [firstId, report]))[0].report.sitrep_no, 1);
  assert.deepEqual(await as('official', 'select id from public.situation_reports where id=$1', [firstId]), []);
  const secondId = randomUUID();
  const secondDraft = {...report, event_name: '  fixture river flood ', barangay_id: local.id, remarks: 'Original notes'};
  const secondIssue = await as('official', issue, [secondId, secondDraft]);
  assert.equal(secondIssue[0].report.sitrep_no, 2);
  assert.deepEqual(await as('official', issue, [secondId, {...secondDraft, remarks: 'Retry payload'}]), secondIssue);
  await assert.rejects(as('official', issue, [randomUUID(), report]), {code: '42501'});
  await assert.rejects(as('duty', issue, [randomUUID(), {...report, period_from: '2024-01-20'}]), {code: '22023'});
  const [legacy] = await rows("insert into public.situation_reports(event_name,sitrep_no) values ('FIXTURE RIVER FLOOD',1) returning sitrep_no");
  assert.equal(legacy.sitrep_no, 3);
  console.log('PASS Independent alert receipts, declaration retries and server-issued event-wide situation report numbers.');
  console.log('PASS Atomic and repeatable advisory publishing, real emergency device count, shelter occupancy and Philippine date cutoffs.');
}
