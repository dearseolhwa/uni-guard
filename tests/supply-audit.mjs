import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifySupplyAudit(db) {
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  const first = async (...args) => (await rows(...args))[0];
  const local = await first("select id,name from public.barangays where name='Poblacion'");
  const other = await first("select id,name from public.barangays where name='Malawa'");
  const pnpUnit = await first("insert into public.dispatch_units(name,unit_type) values ('Fixture audit police','PNP') returning id");
  const secondUnit = await first("insert into public.dispatch_units(name,unit_type) values ('Second audit police','PNP') returning id");
  const bfpUnit = await first("insert into public.dispatch_units(name,unit_type) values ('Fixture audit fire','BFP') returning id");
  const users = {};
  for (const [name, role, area, unit] of [
    ['duty','lgu_ldrrmc',local], ['local','barangay_official',local], ['other','barangay_official',other],
    ['resident','citizen',local], ['pnp','dispatch_team',null,pnpUnit],
    ['second','dispatch_team',null,secondUnit], ['bfp','dispatch_team',null,bfpUnit]
  ]) {
    users[name] = randomUUID();
    await rows('insert into auth.users(id,email) values ($1,$2)', [users[name],users[name]+'@example.test']);
    await rows('update public.profiles set role=$1,barangay=$2,barangay_id=$3,dispatch_unit_id=$4,unit_role=$6 where id=$5',
      [role,area?.name || '',area?.id || null,unit?.id || null,users[name],unit ? 'member' : '']);
  }
  const as = (name, sql, params = []) => db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({sub:users[name],role:'authenticated'})]);
    return (await tx.query(sql,params)).rows;
  });
  const relief = await first("insert into public.relief_distributions(title,barangay,barangay_id,distribution_at) values ('Fixture escort audit',$1,$2,now()) returning id",
    [local.name,local.id]);
  const request = "select public.request_relief_escort($1,'Fixture staffing support') as value";
  const confirm = 'select public.confirm_relief_escort($1) as value';
  const escortStatus = 'select escort_status from public.relief_distributions where id=$1';
  await assert.rejects(as('pnp',confirm,[relief.id]), /no pending escort request/);
  await assert.rejects(as('other',request,[relief.id]), /unavailable/);
  await assert.rejects(as('resident',request,[relief.id]), /staff|barangay officials/);
  assert.deepEqual(await as('pnp',escortStatus,[relief.id]),[]);
  await as('duty',request,[relief.id]);
  await as('local',request,[relief.id]);
  assert.deepEqual(await as('pnp',escortStatus,[relief.id]),[{escort_status:'requested'}]);
  assert.deepEqual(await as('bfp',escortStatus,[relief.id]),[]);
  const alerts = "select count(*)::int as n from public.notifications where type='relief_escort' and user_id=$1";
  assert.equal((await first(alerts,[users.pnp])).n,1);
  assert.equal((await first(alerts,[users.bfp])).n,0);
  await assert.rejects(as('bfp',confirm,[relief.id]), /active PNP/);
  assert.equal((await as('pnp',confirm,[relief.id]))[0].value.unit_id,pnpUnit.id);
  await as('pnp',confirm,[relief.id]);
  await assert.rejects(as('second',confirm,[relief.id]), /no pending escort request/);
  assert.equal((await as('duty',request,[relief.id]))[0].value.escort_status,'confirmed');
  assert.equal((await first(alerts,[users.duty])).n,1);
  assert.deepEqual(await as('second',escortStatus,[relief.id]),[]);

  const equipment = (await as('local', "select public.add_equipment(p_owner_barangay_id=>$1,p_custom_label=>'Fixture service winch') as item", [local.id]))[0].item;
  const check = "select public.record_equipment_check($1,$2,'Full','Fixture service history')";
  await as('local',check,[equipment.id,'ready']);
  assert.equal((await as('local','select notes from public.equipment_checks where equipment_id=$1',[equipment.id])).length,1);
  assert.deepEqual(await as('other','select notes from public.equipment_checks where equipment_id=$1',[equipment.id]),[]);
  await assert.rejects(as('local','select public.remove_equipment($1,false)',[equipment.id]), /service history/);
  const hazard = (await as('resident',`insert into public.reports(hazard_type,hazard_other_text,description,lat,lng)
    values ('Others','Fixture equipment lock','Fixture equipment lock',16.0223,120.2312) returning id`))[0];
  await as('duty',"select public.advance_report_status($1,'verified','Fixture verified')",[hazard.id]);
  const assignment = (await as('local',`select public.dispatch_report_v2(
    $1,'Barangay Response Team','Bring the winch',now()+interval '15 minutes',null,null,array[$2::uuid]
  ) as dispatch`,[hazard.id,equipment.id]))[0].dispatch;
  await assert.rejects(as('local',"select public.set_equipment_status($1,'available')",[equipment.id]), /deployed/);
  await assert.rejects(as('local',check,[equipment.id,'needs_repair']), /deployed/);
  assert.equal((await first('select count(*)::int as n from public.equipment_checks where equipment_id=$1',[equipment.id])).n,1);
  await as('local',"select public.decline_dispatch($1,'Fixture unavailable')",[assignment.id]);
  await as('local',check,[equipment.id,'needs_repair']);
  assert.equal((await first('select status from public.dispatch_equipment where id=$1',[equipment.id])).status,'maintenance');

  const item = randomUUID(), record = randomUUID();
  const lowAlerts = "select count(*)::int as n from public.notifications where type='relief_low_stock' and body like 'Fixture audit stock%' and user_id=$1";
  await as('duty',"select public.save_relief_item($1,'Fixture audit stock','Food','packs',10,3,'','')",[item]);
  await as('local',"select public.record_relief_stock_distribution($1,$2,7,$3,'Fixture family')",[record,item,local.name]);
  const adjust = "select public.adjust_relief_stock($1,$2,$3)";
  await as('duty',adjust,[item,-1,randomUUID()]);
  assert.equal((await first(lowAlerts,[users.duty])).n,1);
  assert.equal((await first(lowAlerts,[users.local])).n,0);
  await as('duty',adjust,[item,6,randomUUID()]);
  await as('duty',adjust,[item,-8,randomUUID()]);
  assert.equal((await first(lowAlerts,[users.duty])).n,2);
  const ledger = 'select barangay,barangay_id from public.relief_distribution_log where id=$1';
  await rows('update public.barangays set name=$1 where id=$2',['Fixture renamed barangay',local.id]);
  try {
    assert.deepEqual(await as('local',ledger,[record]),[{barangay:local.name,barangay_id:local.id}]);
    assert.deepEqual(await as('other',ledger,[record]),[]);
    const snapshot = (await as('local','select public.read_relief_stock() as stock'))[0].stock;
    assert.equal(snapshot.records.find(r => r.id===record).barangay,'Fixture renamed barangay');
  } finally {
    await rows('update public.barangays set name=$1 where id=$2',[local.name,local.id]);
  }
  console.log('PASS Scoped escort request and confirmation, booked equipment locks and service history, low-stock notifications, and ledger scope after a barangay rename.');
}
