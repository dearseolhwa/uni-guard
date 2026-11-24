import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyRoles(db) {
  await db.exec('grant usage on schema public to authenticated; grant select on public.reports, public.reports_feed, public.sos_log to authenticated;');
  const rows = async (sql, parameters) => (await db.query(sql, parameters)).rows;
  assert.equal((await rows("select has_table_privilege('authenticated','public.submission_receipts','SELECT') as allowed"))[0].allowed,false);
  const [local] = await rows("select id,name from public.barangays where name='Poblacion'");
  const [other] = await rows("select id,name from public.barangays where name='Malawa'");
  const users = {};
  for (const [name, area, role] of [['sender', local, 'citizen'], ['peer', local, 'citizen'],
    ['other', other, 'citizen'], ['duty', local, 'barangay_official']]) {
    const id = randomUUID();
    await db.query('insert into auth.users (id,email) values ($1,$2)', [id,id + '@example.test']);
    await db.query('update public.profiles set barangay=$1,barangay_id=$2,role=$3,full_name=$4,phone=$5 where id=$6',
      [area.name,area.id,role,'Fixture ' + name,'09000000000',id]);
    users[name] = id;
  }
  const as = (name, sql, parameters, sessionId) => db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claims',$1,true)",
      [JSON.stringify({sub:users[name],role:'authenticated',session_id:sessionId})]);
    return (await tx.query(sql,parameters)).rows;
  });
  const key = randomUUID();
  const args = [key,'Fixture private SOS note'];
  const send = "select public.submit_sos_once($1,16.0223,120.2312,10,$2,'other') as value";
  const [first] = await as('sender',send,args);
  const [retry] = await as('sender',send,args);
  assert.deepEqual(retry,first);
  const id = first.value.report_id;
  assert.ok(id);
  assert.equal((await rows('select count(*)::int as n from public.sos_log where user_id=$1',[users.sender]))[0].n,1);
  const feed = 'select description,lat,lng,location_note,is_sos from public.reports_feed where id=$1';
  const [newFeed] = await as('sender',feed,[id]);
  assert.equal(newFeed.description,'SOS (Other / not sure)');
  const [privateLog] = await as('duty','select profile_name,profile_phone,note from public.sos_log where id=$1',[first.value.id]);
  assert.deepEqual(privateLog,{profile_name:'Fixture sender',profile_phone:'09000000000',note:args[1]});
  assert.deepEqual(await as('peer','select id from public.sos_log where id=$1',[first.value.id]),[]);

  // Represent a legacy record already saved by releases through 077.
  await db.exec('alter table public.reports disable trigger user');
  await db.query('update public.reports set description=$1, location_note=$2 where id=$3',['Legacy ' + args[1],'Private landmark',id]);
  await db.exec('alter table public.reports enable trigger user');
  for (const name of ['sender','duty']) {
    assert.deepEqual((await as(name,feed,[id]))[0],
      {description:'Legacy ' + args[1],lat:16.0223,lng:120.2312,location_note:'Private landmark',is_sos:true});
  }
  assert.deepEqual((await as('peer',feed,[id]))[0],
    {description:'Emergency SOS reported in this barangay.',lat:null,lng:null,location_note:'',is_sos:true});
  assert.deepEqual(await as('peer','select id from public.reports where id=$1',[id]),[]);
  assert.deepEqual(await as('other',feed,[id]),[]);
  console.log('PASS Legacy and new SOS privacy, sender and duty details, landmark, and duplicate SOS receipt');

  await db.query('update public.profiles set disabled=true where id=$1',[users.sender]);
  assert.deepEqual(await as('sender',feed,[id]),[]);
  await assert.rejects(as('sender',send,args),{code:'42501'});
  await db.query('update public.profiles set disabled=false, sessions_revoked_at=now() where id=$1',[users.sender]);
  assert.deepEqual(await as('sender',feed,[id]),[]);
  await assert.rejects(as('sender',send,args),{code:'42501'});
  const newSession = randomUUID();
  await db.query('insert into auth.sessions (id,user_id) values ($1,$2)',[newSession,users.sender]);
  assert.deepEqual(await as('sender',send,args,newSession),[first]);
  console.log('PASS Disabled and revoked requests blocked, with access restored by a new session');

  const reportKey = randomUUID();
  const details = { hazard_type:'Flood', barangay:'Poblacion', description:'Fixture flood',
    severity:'warning',urgency:'warning',location_note:'Near fixture school',lat:16.0223,lng:120.2312 };
  const submit = 'select public.submit_hazard_report($1,$2::jsonb) as value';
  const [created] = await as('sender',submit,[reportKey,JSON.stringify(details)],newSession);
  const [again] = await as('sender',submit,[reportKey,JSON.stringify(details)],newSession);
  assert.equal(created.value.id,again.value.id);
  const [peerCreated] = await as('peer',submit,[reportKey,JSON.stringify(details)]);
  assert.notEqual(created.value.id,peerCreated.value.id);
  const [landmark] = await as('duty',feed,[created.value.id]);
  assert.equal(landmark.location_note,details.location_note);
  assert.equal(landmark.is_sos,false);
  assert.equal((await as('peer',feed,[created.value.id]))[0].location_note,'');
  assert.deepEqual(await as('sender','select id from public.reports_feed where is_mine order by created_at desc,id desc',[],newSession),
    [{id:created.value.id},{id}]);
  console.log('PASS Report retry returns original, receipts are account-scoped, and personal history retains both report types');
}
