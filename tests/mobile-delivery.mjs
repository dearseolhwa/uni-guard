import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyMobileDelivery(db) {
  const owner = randomUUID();
  const nextOwner = randomUUID();
  for (const id of [owner, nextOwner]) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, id + '@example.test']);
  }
  const firstSession = randomUUID();
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [firstSession, owner]);
  const callAs = (role, user, session, sql, params) => db.transaction(async (tx) => {
    await tx.exec('set local role ' + role);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: user, session_id: session })]);
    return (await tx.query(sql, params)).rows[0]?.value;
  });
  const key = 'A'.repeat(87);
  const auth = 'B'.repeat(22);
  const old = 'https://fcm.googleapis.com/fcm/send/fixture-one';
  const rotated = 'https://updates.push.services.mozilla.com/wpush/v2/fixture-two';
  const next = 'https://web.push.apple.com/fixture-three';
  const token = randomUUID();
  const register = 'select public.sync_mobile_push_device($1,$2,$3,$4,$5) as value';
  const renew = 'select public.renew_mobile_push_device($1,$2,$3,$4,$5) as value';
  assert.equal(await callAs('authenticated', owner, firstSession, register, [old,key,auth,'fixture',token]), true);
  assert.equal(await callAs('authenticated', nextOwner, null, register, [old,key,auth,'fixture',randomUUID()]), false);
  assert.equal(await callAs('anon', null, null, renew, [old,randomUUID(),rotated,key,auth]), false);
  assert.equal(await callAs('anon', null, null, renew, [old,token,rotated,key,auth]), true);
  assert.equal((await db.query('select user_id from public.push_subscriptions where endpoint=$1',[rotated])).rows[0].user_id, owner);
  assert.equal(await callAs('authenticated', nextOwner, null, register, [next,key,auth,'fixture',randomUUID()]), true);
  assert.equal(await callAs('anon', null, null, renew, [rotated,token,next,key,auth]), false);
  await assert.rejects(callAs('authenticated', owner, firstSession, register, ['https://example.test/fixture',key,auth,'fixture',token]),
    /Invalid push subscription/);
  await db.query('update public.profiles set disabled=true where id=$1',[owner]);
  assert.equal(await callAs('anon', null, null, renew, [rotated,token,old,key,auth]), false);
  await db.query('update public.profiles set disabled=false where id=$1',[owner]);
  assert.equal(await callAs('anon', null, null, renew, [rotated,token,old,key,auth]), false);
  console.log('PASS Push endpoint ownership, proof-based renewal, provider validation, and disabled or revoked session checks.');

  const alert = randomUUID();
  const claim = 'select public.claim_advisory_sms($1,$2) as value';
  const finish = 'select public.finish_advisory_sms($1,$2,$3,$4)';
  const asWorker = (sql, args) => callAs('service_role', null, null, sql, args);
  await assert.rejects(callAs('authenticated', owner, null, claim, [alert,owner]), /permission denied/);
  const first = await asWorker(claim, [alert,owner]);
  assert.ok(first);
  assert.equal(await asWorker(claim, [alert,owner]), null);
  const otherRecipient = await asWorker(claim, [alert,nextOwner]);
  assert.ok(otherRecipient);
  await asWorker(finish, [alert,owner,first,false]);
  const retry = await asWorker(claim, [alert,owner]);
  assert.ok(retry && retry !== first);
  await asWorker(finish, [alert,owner,first,true]);
  assert.equal((await db.query('select sent_at from public.advisory_sms_deliveries where alert_id=$1 and user_id=$2',[alert,owner])).rows[0].sent_at, null);
  await asWorker(finish, [alert,owner,retry,true]);
  assert.equal(await asWorker(claim, [alert,owner]), null);
  console.log('PASS Advisory SMS claims are recipient-scoped, single-flight and retry-safe after acceptance.');
}
