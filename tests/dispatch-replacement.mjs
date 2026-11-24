import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyRoles(db) {
  const query = (sql, params = []) => db.query(sql, params);
  const first = async (sql, params) => (await query(sql, params)).rows[0];
  const runAs = (who, sql, params = []) => db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub:who.id, role:'authenticated' })]);
    return (await tx.query(sql, params)).rows;
  });
  const value = async (who, sql, params) => (await runAs(who, sql, params))[0]?.value;
  await db.exec(`
    grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on public.reports, public.profiles to anon;
    grant usage, select on all sequences in schema public to authenticated;
  `);

  const locality = await first("select id, name from public.barangays where name='Poblacion'");
  const other = await first("select id, name from public.barangays where name='Malawa'");
  assert.ok(locality && other, 'Both barangays are available for the scope test');
  async function account(role, barangay, unit, unitRole = '', superAdmin = false) {
    const id = randomUUID();
    await query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)", [
      id, id+'@example.test', { full_name:'Fixture '+role, barangay:barangay?.name || '', role:'lgu_ldrrmc' }
    ]);
    assert.equal((await first('select role from public.profiles where id=$1', [id])).role, 'citizen');
    await query('update public.profiles set role=$2,is_super_admin=$3,dispatch_unit_id=$4,unit_role=$5 where id=$1', [
      id,role,superAdmin,unit?.id || null,unitRole
    ]);
    return { id };
  }
  const citizen = await account('citizen', locality);
  const otherCitizen = await account('citizen', other);
  const official = await account('barangay_official', locality);
  const otherOfficial = await account('barangay_official', other);
  const lgu = await account('lgu_ldrrmc');
  const superAdmin = await account('lgu_ldrrmc', null, null, '', true);
  const teams = [];
  for (const [type,name] of [['BFP','BFP'],['PNP','PNP'],['Rescue','Rescue Unit'],['Hospital','Ambulance']]) {
    const unit = await first('insert into public.dispatch_units(name,unit_type) values ($1,$2) returning id', ['Fixture '+type,type]);
    const admin = await account('dispatch_team', null, unit, 'unit_admin');
    const member = await account('dispatch_team', null, unit, 'member');
    teams.push({type,name,unit,admin,member});
  }


  const bfp = teams.find(team => team.type === 'BFP');
  await query("update public.dispatch_units set status='off_duty' where unit_type='BFP' and id<>$1", [bfp.unit.id]);
  const unstaffed = await first("insert into public.dispatch_units(name,unit_type,lat,lng,created_at) values ('Unstaffed closer BFP','BFP',16.0223,120.2312,now()-interval '1 day') returning id");
  const disabled = await account('dispatch_team', null, unstaffed, 'member');
  await query('update public.profiles set disabled=true where id=$1', [disabled.id]);
  const sent = await value(citizen, "select public.submit_sos(16.0223,120.2312,10,'Synthetic fire SOS','fire') as value", []);
  assert.ok(sent.report_id);
  assert.equal(sent.dispatched, 2);
  const status = async () => ({
    report: (await first('select status from public.reports where id=$1', [sent.report_id])).status,
    sos: (await first('select status from public.sos_log where id=$1', [sent.id])).status
  });
  const unit = await first("select * from public.report_dispatches where report_id=$1 and team='BFP'", [sent.report_id]);
  const barangay = await first("select * from public.report_dispatches where report_id=$1 and team='Barangay Response Team'", [sent.report_id]);
  assert.equal(unit.unit_id, bfp.unit.id);
  const reportFromAssignment = `select r.hazard_type, r.description from public.report_dispatches d
    left join public.reports r on r.id = d.report_id where d.id = $1`;
  for (const who of [bfp.admin, bfp.member]) {
    assert.deepEqual(await runAs(who, reportFromAssignment, [unit.id]), [
      {hazard_type:'Fire',description:'SOS (Fire)'}
    ]);
    assert.equal((await runAs(who, "select id from public.notifications where type='unit_dispatch' and report_id=$1", [sent.report_id])).length,1);
  }
  for (const who of [otherCitizen, otherOfficial, teams[1].member, disabled]) {
    assert.deepEqual(await runAs(who, 'select id from public.reports where id=$1', [sent.report_id]), []);
    assert.deepEqual(await runAs(who, reportFromAssignment, [unit.id]), []);
  }
  await runAs(bfp.member, "select public.decline_dispatch($1,'Fixture equipment unavailable')", [unit.id]);
  assert.deepEqual(await status(), { report:'dispatched', sos:'sent' });
  assert.equal((await first('select dispatch_status from public.report_dispatches where id=$1',[barangay.id])).dispatch_status,'sent');
  await runAs(official, "select public.update_sos_status($1,'acknowledged')", [sent.id]);
  await runAs(official, "select public.decline_dispatch($1,'Fixture team unavailable')", [barangay.id]);
  assert.deepEqual(await status(), { report:'verified', sos:'acknowledged' });
  assert.deepEqual((await query("select dispatch_status from public.report_dispatches where report_id=$1", [sent.report_id])).rows,
    [{dispatch_status:'declined'}, {dispatch_status:'declined'}]);
  assert.equal((await first("select count(*)::int as total from public.notifications where user_id=$1 and report_id=$2 and type='dispatch_declined'",[lgu.id,sent.report_id])).total,2);
  assert.ok(await first("select id from public.emergency_delivery where kind='dispatch_gap' and event_id=$1 and user_id=$2",[sent.report_id,lgu.id]));
  assert.equal((await first("select count(*)::int as total from public.notifications where user_id=$1 and report_id=$2 and title='Responder reassignment'",[citizen.id,sent.report_id])).total,1);
  const replacement = "select report_id, is_overdue from public.dispatch_replacement_queue where report_id=$1";
  assert.deepEqual(await runAs(lgu,replacement,[sent.report_id]),[{report_id:sent.report_id,is_overdue:false}]);
  assert.equal((await runAs(official,replacement,[sent.report_id])).length,1);
  for (const who of [otherOfficial,citizen,superAdmin,bfp.member]) {
    assert.deepEqual(await runAs(who,replacement,[sent.report_id]),[]);
  }
  await query("update public.report_status_history set created_at = now() - interval '4 minutes' where report_id=$1 and reason='all_declined'",[sent.report_id]);
  assert.deepEqual(await runAs(lgu,replacement,[sent.report_id]),[{report_id:sent.report_id,is_overdue:true}]);
  const rescue = teams.find(team => team.type === 'Rescue');
  await runAs(lgu,"select public.dispatch_report_v2($1,'Rescue Unit','Fixture replacement',now()+interval '15 minutes',$2)",[sent.report_id,rescue.unit.id]);
  assert.deepEqual(await status(), { report:'dispatched', sos:'acknowledged' });
  assert.deepEqual(await runAs(lgu,replacement,[sent.report_id]),[]);
  assert.equal((await runAs(rescue.member, 'select id from public.reports where id=$1', [sent.report_id])).length, 1);

  // Newly queued jobs wake the worker even if nobody has the web app open.
  await db.exec(`
    insert into vault.decrypted_secrets values
      ('uniguard_emergency_worker_url','https://worker.example.test'),
      ('uniguard_emergency_worker_secret','fixture-emergency-token');
    create schema net;
    create table net.fixture_calls (url text, headers jsonb);
    create function net.http_post(url text, headers jsonb, body jsonb) returns bigint
    language sql as $$ insert into net.fixture_calls values (url, headers) returning 1::bigint $$;
  `);
  assert.equal((await first("select public.emergency_worker_token_ok('fixture-emergency-token') as allowed")).allowed, true);
  assert.equal((await first("select public.emergency_worker_token_ok('invalid') as allowed")).allowed, false);
  await assert.rejects(runAs(citizen, "select public.emergency_worker_token_ok('fixture-emergency-token')"), /permission denied/);
  await query(`insert into public.rate_limits(user_id,action,window_start,hits)
    values ($1,'report',to_timestamp(floor(extract(epoch from now()) / 600) * 600),5)
    on conflict (user_id,action,window_start) do update set hits = 5`, [citizen.id]);
  const noGPS = await value(citizen, "select public.submit_sos(null,null,null,'Private fixture note','fire') as value");
  assert.ok(noGPS.report_id, 'An SOS with a registered barangay still routes without GPS after the report quota is reached');
  const report = (await runAs(bfp.member, 'select barangay_id,lat,lng,location_note,description from public.reports where id=$1', [noGPS.report_id]))[0];
  assert.equal(report.barangay_id, locality.id);
  assert.equal(report.lat, null);
  assert.equal(report.lng, null);
  assert.match(report.location_note, /Confirm the incident address/);
  assert.equal(report.description, 'SOS (Fire)');
  const noGPSAssignment = await first("select id, eta, instructions from public.report_dispatches where report_id=$1 and unit_id=$2", [noGPS.report_id,bfp.unit.id]);
  assert.equal(noGPSAssignment.eta,null);
  assert.match(noGPSAssignment.instructions,/No GPS location/);
  const deliveries = async (eventId) => (await query('select user_id from public.emergency_delivery where event_id=$1',[eventId])).rows.map(r => r.user_id).sort();
  assert.deepEqual(await deliveries(noGPSAssignment.id), [bfp.admin.id, bfp.member.id].sort());
  const dutyRecipients = (await query("select id from public.profiles where not disabled and removed_at is null and (role='lgu_ldrrmc' or (role='barangay_official' and barangay_id=$1))",[locality.id])).rows.map(r=>r.id).sort();
  assert.deepEqual(await deliveries(noGPS.id), dutyRecipients);
  assert.equal((await first("select count(*)::int as n from net.fixture_calls where url='https://worker.example.test' and headers->>'Authorization'='Bearer fixture-emergency-token'")).n,3);
  // Removing the oldest unit's staff did not silently block or redirect a fire assignment.
  const outside = await value(otherCitizen, "select public.submit_sos(14.6,120.98,10,'Outside service area','fire') as value");
  assert.equal(outside.report_id, null);
  assert.equal(outside.dispatched, 0);
  await assert.rejects(runAs(otherCitizen, "insert into public.reports(hazard_type,description,severity) values ('Fire','Fixture standard report without position','emergency')"), /location|GPS|coordinates/i);

  for (const [kind, target] of [['crime', teams[1]], ['rescue', teams[2]], ['medical', teams[3]]]) {
    const result = await value(citizen, "select public.submit_sos(16.0223,120.2312,10,'Fixture SOS',$1) as value", [kind]);
    assert.ok(result.report_id);
    const routed = (await query('select team from public.report_dispatches where report_id=$1',[result.report_id])).rows.map(row => row.team).sort();
    assert.deepEqual(routed, [target.name,'Barangay Response Team'].sort(), kind);
    const assignment = await first('select id,unit_id from public.report_dispatches where report_id=$1 and team=$2',[result.report_id,target.name]);
    assert.equal(assignment.unit_id,target.unit.id);
    assert.equal((await runAs(target.member, reportFromAssignment, [assignment.id])).length, 1);
    assert.deepEqual(await deliveries(assignment.id), [target.admin.id, target.member.id].sort());
  }

  const unsureSender = await account('citizen', locality);
  const unsure = await value(unsureSender,"select public.submit_sos(16.0223,120.2312,10,'Fixture unknown SOS','other') as value");
  assert.deepEqual((await query('select team from public.report_dispatches where report_id=$1',[unsure.report_id])).rows,
    [{team:'Barangay Response Team'}]);
  assert.deepEqual(await deliveries(unsure.id),dutyRecipients);

  const ordinary = (await runAs(otherCitizen, `insert into public.reports(hazard_type,description,severity,urgency,lat,lng)
    values ('Fire','Fixture hazard report','emergency','emergency',16.0223,120.2312) returning id`))[0];
  assert.deepEqual(await runAs(bfp.member,'select id from public.reports where id=$1',[ordinary.id]),[]);
  await runAs(lgu,"select public.advance_report_status($1,'verified','Fixture verified fire')",[ordinary.id]);
  const ordinaryAssignment = await first("select id from public.report_dispatches where report_id=$1 and unit_id=$2",[ordinary.id,bfp.unit.id]);
  assert.ok(ordinaryAssignment);
  assert.deepEqual(await runAs(bfp.member,reportFromAssignment,[ordinaryAssignment.id]),[{hazard_type:'Fire',description:'Fixture hazard report'}]);
  assert.deepEqual(await deliveries(ordinaryAssignment.id),[bfp.admin.id,bfp.member.id].sort());
  await assert.rejects(runAs(lgu,"select public.dispatch_report_v2($1,'BFP','Fixture manual assignment',now()+interval '15 minutes',$2)",
    [ordinary.id,unstaffed.id]), /no active UniGuard dispatch accounts/);

  await query("update public.report_dispatches set dispatched_at=now()-interval '4 minutes' where id=$1",[ordinaryAssignment.id]);
  assert.equal((await first('select public.ug_reroute_unacknowledged(3) as n')).n,0);
  assert.equal((await first("select count(*)::int as n from public.report_dispatches where report_id=$1 and unit_id=$2",[ordinary.id,unstaffed.id])).n,0);
  assert.ok(await first("select id from public.notifications where user_id=$1 and report_id=$2 and title like 'No response, no other unit:%'",[lgu.id,ordinary.id]));
  assert.ok((await deliveries(ordinary.id)).includes(lgu.id));
  assert.ok(await first("select id from public.emergency_delivery where kind='dispatch_gap' and event_id=$1 and user_id=$2",[ordinary.id,lgu.id]));

  const secondBfp = await first("insert into public.dispatch_units(name,unit_type,status,created_at) values ('Alternate staffed BFP','BFP','on_duty',now()+interval '1 day') returning id");
  const alternateBfpStaff = await account('dispatch_team', null, secondBfp, 'member');
  const local = 'Barangay Response Team';
  const water = ['Rescue Unit', local];
  const earth = ['Rescue Unit', 'Ambulance', local];
  const fire = ['BFP', local];
  const routes = [
    ['flood', 'Flood', water],
    ['river_overflow', 'River Overflow', water],
    ['drainage_blockage', 'Drainage Blockage', water],
    ['storm_surge', 'Storm Surge', water],
    ['coastal_erosion', 'Coastal Erosion', water],
    ['strong_wind', 'Strong Wind / Typhoon Damage', [local]],
    ['fallen_tree', 'Fallen Tree', [local]],
    ['landslide', 'Landslide / Soil Erosion', earth],
    ['earthquake', 'Earthquake', earth],
    ['road_damage', 'Road Damage', ['PNP', local]],
    ['vehicular_accident', 'Vehicular Accident', ['PNP', 'Ambulance']],
    ['fire', 'Fire', fire],
    ['power_line', 'Electrical / Power Line Hazard', fire],
    ['other', 'Others', []]
  ];
  const localRecipients = (await query(`select id from public.profiles where barangay_id=$1
    and role='barangay_official' and not disabled and removed_at is null`, [locality.id])).rows.map(r=>r.id).sort();
  for (const [key, label, expected] of routes) {
    assert.deepEqual((await first("select public.auto_dispatch_teams($1,'warning') as teams",[key])).teams,expected);
    const sender = await account('citizen', locality);
    const incident = (await runAs(sender, `insert into public.reports (hazard_type,hazard_other_text,description,severity,lat,lng,created_at)
      values ($1,$2,'Fixture hazard','emergency',16.0223,120.2312,now()-interval '1 day') returning id`,
      [label, key === 'other' ? 'Fixture unclassified hazard' : null]))[0];
    const queued = await query("select user_id from public.emergency_delivery where kind='report_review' and event_id=$1",[incident.id]);
    assert.ok(queued.rows.some(row => row.user_id === official.id), label);
    assert.ok(queued.rows.some(row => row.user_id === lgu.id), label);
    assert.ok(!queued.rows.some(row => [otherOfficial.id, superAdmin.id, bfp.member.id, alternateBfpStaff.id].includes(row.user_id)), label);
    assert.ok((await runAs(official,"select id from public.notifications where report_id=$1 and type='report_review'",[incident.id])).length, label);
    assert.equal((await runAs(lgu,"select is_severity_bypass from public.reports_feed where id=$1",[incident.id]))[0].is_severity_bypass,
      ['fire','power_line','vehicular_accident','landslide'].includes(key), label);
    await runAs(lgu,"select public.advance_report_status($1,'verified','Fixture verified hazard')",[incident.id]);
    const assignments = (await query('select id,team,assignment_role from public.report_dispatches where report_id=$1',[incident.id])).rows;
    const ordered = expected;
    assert.deepEqual(assignments.map(row => row.team).sort(), [...ordered].sort(), label);
    assert.equal(assignments.find(row => row.assignment_role==='lead')?.team,ordered[0],label);
    for (const assignment of assignments) {
      const team = teams.find(item => item.name === assignment.team);
      const recipients = await deliveries(assignment.id);
      assert.deepEqual(recipients, team ? [team.admin.id,team.member.id].sort() : localRecipients, label);
    }
  }
  const forwarded = (await runAs(otherCitizen, `insert into public.reports(hazard_type,description,severity,lat,lng)
    values ('Electrical / Power Line Hazard','Fixture forwarded hazard','warning',16.0223,120.2312) returning id`))[0];
  await runAs(official,"select public.advance_report_status($1,'verified','Fixture barangay verified')",[forwarded.id]);
  assert.equal((await first('select count(*)::int as n from public.report_dispatches where report_id=$1',[forwarded.id])).n,0);
  const confirmed = (await query("select user_id from public.emergency_delivery where kind='hazard_confirmed' and event_id=$1",[forwarded.id])).rows.map(row => row.user_id).sort();
  assert.deepEqual(confirmed,[...localRecipients,bfp.member.id,bfp.admin.id].sort());
  assert.equal((await runAs(bfp.member,"select id from public.notifications where report_id=$1 and type='hazard_confirmed'",[forwarded.id])).length,1);
  assert.deepEqual(await runAs(bfp.member,'select id from public.reports where id=$1',[forwarded.id]),[]);

  assert.ok(await first("select id from public.emergency_delivery where kind='dispatch_gap' and event_id=$1 and user_id=$2",[forwarded.id,lgu.id]));
  await runAs(lgu,'select public.auto_dispatch_report($1)',[forwarded.id]);
  assert.ok(await first("select id from public.report_dispatches where report_id=$1 and team='BFP'",[forwarded.id]));
  assert.ok(await first("select id from public.emergency_delivery where kind='report_review' and event_id=$1 and user_id=$2 and urgent",[forwarded.id,lgu.id]));
  const routine = (await runAs(unsureSender, `insert into public.reports(hazard_type,description,severity,lat,lng)
    values ('Fallen Tree','Fixture routine local hazard','advisory',16.0223,120.2312) returning id`))[0];
  assert.ok(await first("select id from public.emergency_delivery where kind='report_review' and event_id=$1 and user_id=$2 and not urgent",[routine.id,official.id]));
  assert.equal(await first("select id from public.emergency_delivery where kind='report_review' and event_id=$1 and user_id=$2",[routine.id,lgu.id]),undefined);
  const corroborated = (await runAs(otherCitizen, `insert into public.reports(hazard_type,description,severity,lat,lng)
    values ('Earthquake','Fixture resident verified hazard','warning',16.0223,120.2312) returning id`))[0];
  const firstWitness = await account('citizen', locality);
  const secondWitness = await account('citizen', locality);
  for (const witness of [firstWitness, secondWitness]) {
    await runAs(witness,"select public.corroborate_report($1,'Fixture confirmation',16.0223,120.2312)",[corroborated.id]);
  }
  assert.equal((await first('select status from public.reports where id=$1',[corroborated.id])).status,'verified');
  assert.ok(await first("select id from public.emergency_delivery where kind='dispatch_gap' and event_id=$1 and user_id=$2",[corroborated.id,lgu.id]));
  assert.ok(await first("select id from public.notifications where title='Corroborated report needs MDRRMO review' and report_id=$1 and user_id=$2",[corroborated.id,lgu.id]));
  const corroboratedTarget = (await query("select user_id from public.emergency_delivery where kind='hazard_confirmed' and event_id=$1",[corroborated.id])).rows.map(row => row.user_id).sort();
  assert.deepEqual(corroboratedTarget,[...localRecipients,...[teams[2],teams[3]].flatMap(team => [team.admin.id,team.member.id])].sort());

  console.log('PASS Every hazard label routes to the expected teams, required review offices receive scoped alerts, and a barangay-verified hazard reaches MDRRMO before municipal dispatch.');

  await db.exec('drop schema net cascade');
  console.log('PASS Assigned BFP, PNP, rescue and ambulance staff can open reports and receive queued alerts. Staffless units are skipped, verified hazards reach BFP, and no-GPS SOS leaves no fake coordinates or ETA.');
  console.log('PASS BFP decline leaves Barangay dispatch active, final decline reopens the report and leaves SOS acknowledged, and duty staff can dispatch a replacement.');
}
