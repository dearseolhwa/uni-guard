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
  await runAs(bfp.member, "select public.decline_dispatch($1,'Fixture equipment unavailable')", [unit.id]);
  assert.deepEqual(await status(), { report:'dispatched', sos:'sent' });
  assert.equal((await first('select dispatch_status from public.report_dispatches where id=$1',[barangay.id])).dispatch_status,'sent');
  await runAs(official, "select public.update_sos_status($1,'acknowledged')", [sent.id]);
  await runAs(official, "select public.decline_dispatch($1,'Fixture team unavailable')", [barangay.id]);
  assert.deepEqual(await status(), { report:'verified', sos:'acknowledged' });
  assert.deepEqual((await query("select dispatch_status from public.report_dispatches where report_id=$1", [sent.report_id])).rows,
    [{dispatch_status:'declined'}, {dispatch_status:'declined'}]);
  assert.equal((await first("select count(*)::int as total from public.notifications where user_id=$1 and report_id=$2 and type='dispatch_declined'",[lgu.id,sent.report_id])).total,2);
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
  console.log('PASS BFP decline leaves Barangay dispatch active, final decline reopens the report and leaves SOS acknowledged, and duty staff can dispatch a replacement.');
}
