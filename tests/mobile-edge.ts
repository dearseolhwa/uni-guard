import assert from 'node:assert/strict';
import webpush from 'npm:web-push@3.6.7';

type Handler = (request: Request) => Response | Promise<Response>;
const database = 'https://db.fixture.test';
const gateway = 'https://sms.fixture.test';
const service = 'fixture-service';
const actorId = '10000000-0000-4000-8000-000000000001';
const alertId = '10000000-0000-4000-8000-000000000002';
const people = [
  { id: '10000000-0000-4000-8000-000000000003', phone: '09123456780' },
  { id: '10000000-0000-4000-8000-000000000004', phone: '09123456781' }
];
const keys = webpush.generateVAPIDKeys();
for (const [name, value] of Object.entries({
  SUPABASE_URL: database, SUPABASE_ANON_KEY: 'fixture-public', SUPABASE_SERVICE_ROLE_KEY: service,
  VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey,
  SMS_GATEWAY_URL: gateway, SMS_GATEWAY_KEY: 'fixture-gateway-key'
})) Deno.env.set(name, value);

let handler: Handler | undefined;
const realServe = Deno.serve;
Deno.serve = ((action: Handler) => { handler = action; }) as unknown as typeof Deno.serve;
await import('../supabase/functions/push-dispatch/index.ts');
const push = handler!;
await import('../supabase/functions/sms-fallback/index.ts');
const sms = handler!;
Deno.serve = realServe;

const rows = Array.from({ length: 225 }, (_, i) => ({
  id: String(i + 1).padStart(3, '0'), endpoint: 'https://fcm.googleapis.com/fixture/' + (i + 1), p256dh: 'fixture', auth: 'fixture'
}));
let inFlight = 0, peak = 0, sent = 0;
const oldSend = webpush.sendNotification;
webpush.sendNotification = (async (subscription: { endpoint: string }) => {
  inFlight++;
  peak = Math.max(peak, inFlight);
  await Promise.resolve();
  inFlight--;
  if (subscription.endpoint.endsWith('/1')) throw { statusCode: 410 };
  sent++;
  return { statusCode: 201, body: '', headers: {} };
}) as typeof webpush.sendNotification;

const invoke = (fn: Handler, token: string, body: object) => fn(new Request('https://functions.fixture.test', {
  method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}));
const deliveries = new Set<string>();
const requests: string[] = [];
const audits: Array<Record<string, unknown>> = [];
const oldFetch = fetch;
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.origin === gateway) {
    requests.push(req.headers.get('Idempotency-Key') || '');
    return Response.json({ ok: true });
  }
  assert.equal(url.origin, database);
  const body = req.body ? await req.json() : {};
  switch (url.pathname) {
    case '/auth/v1/user': return Response.json({ id: actorId, role: 'authenticated' });
    case '/rest/v1/profiles':
      return Response.json(url.searchParams.get('id') === 'eq.' + actorId
        ? [{ id: actorId, role: 'lgu_ldrrmc', disabled: false }] : people);
    case '/rest/v1/push_subscriptions': {
      if (req.method === 'DELETE') {
        assert.equal(url.searchParams.get('id'), 'eq.001');
        assert.equal(url.searchParams.get('endpoint'), 'eq.' + rows[0].endpoint);
        return Response.json([{ id: '001' }]);
      }
      if (url.searchParams.get('select') === 'user_id') return Response.json([]);
      assert.equal(url.searchParams.get('profiles.disabled'), 'eq.false');
      const after = url.searchParams.get('id')?.slice(3) || '';
      return Response.json(rows.filter((row) => row.id > after).slice(0, Number(url.searchParams.get('limit'))));
    }
    case '/functions/v1/sms-fallback':
      assert.equal(body.actorId, actorId);
      return await invoke(sms, service, body);
    case '/rest/v1/rpc/claim_advisory_sms':
      assert.equal(body.p_alert_id, alertId);
      return Response.json(deliveries.has(body.p_user_id) ? null : 'fixture-lease');
    case '/rest/v1/rpc/finish_advisory_sms':
      assert.equal(body.p_lease_id, 'fixture-lease');
      if (body.p_sent) deliveries.add(body.p_user_id);
      return new Response(null, { status: 204 });
    case '/rest/v1/audit_log':
      audits.push(body);
      return new Response(null, { status: 201 });
    default: throw Error('Unmocked endpoint ' + url.pathname);
  }
};

try {
  const payload = { title: 'Fixture warning', severity: 'warning', advisoryId: alertId };
  const result = await invoke(push, 'fixture-caller', payload);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, sent: 224, failed: 1, removed: 1, smsQueued: 2 });
  assert.equal(sent, 224);
  assert.equal(peak, 20);
  const expired = await invoke(push, 'fixture-caller', { ...payload, expiresAt: '2000-01-01T00:00:00Z' });
  assert.deepEqual(await expired.json(), { ok: true, sent: 0, failed: 0, removed: 0, smsQueued: 0 });
  assert.equal(sent, 224);
  const repeated = await invoke(sms, service, { ...payload, actorId });
  assert.equal((await repeated.json()).queued, 0);
  assert.deepEqual(requests, people.map(({ id }) => alertId + ':' + id));
  assert.deepEqual(audits.map(({ actor_id }) => actor_id), [actorId, actorId, actorId]);
  console.log('PASS Push delivery paginates 225 fixtures with at most 20 concurrent sends. Sender audit and SMS deduplication also passed.');
} finally {
  globalThis.fetch = oldFetch;
  webpush.sendNotification = oldSend;
}

Deno.serve = ((action: Handler) => { handler = action; }) as unknown as typeof Deno.serve;
await import('../supabase/functions/emergency-delivery/index.ts');
const emergency = handler!;
Deno.serve = realServe;
Deno.env.delete('EMERGENCY_WORKER_SECRET');

const unit = 'fixture-bfp', barangay = 'fixture-barangay';
const staff = {
  bfp: { role: 'dispatch_team', dispatch_unit_id: unit },
  duty: { role: 'lgu_ldrrmc', phone: '09123456781' },
  reliefDuty: { role: 'lgu_ldrrmc' },
  reliefSuper: { role: 'lgu_ldrrmc', is_super_admin: true },
  local: { role: 'barangay_official', barangay_id: barangay },
  alternate: { role: 'dispatch_team', dispatch_unit_id: 'other-bfp-unit' },
  foreign: { role: 'barangay_official', barangay_id: 'other-barangay' },
  removed: { role: 'dispatch_team', dispatch_unit_id: unit, removed_at: '2000-01-01' }
};
const rowsToSend = [
  ['bfp-job', 'dispatch', 'assignment', 'bfp'],
  ['sos-job', 'sos', 'sos-log', 'duty'],
  ['review-job', 'report_review', 'intake', 'local'],
  ['gap-job', 'dispatch_gap', 'verified', 'duty'],
  ['confirmed-job', 'hazard_confirmed', 'verified', 'bfp', unit],
  ['alternate-job', 'hazard_confirmed', 'verified', 'alternate', unit],
  ['foreign-job', 'report_review', 'intake', 'foreign'],
  ['removed-job', 'dispatch', 'assignment', 'removed'],
  ['stale-job', 'report_review', 'verified', 'duty'],
  ['acknowledged-job', 'sos', 'sos-log', 'local'],
  ['stock-push', 'relief_low_stock', 'stock-fresh', 'reliefDuty'],
  ['stock-no-push', 'relief_low_stock', 'stock-unsubscribed', 'duty'],
  ['stock-read', 'relief_low_stock', 'stock-read', 'reliefDuty'],
  ['stock-unauthorized', 'relief_low_stock', 'stock-fresh', 'reliefSuper']
].map(([id, kind, event_id, user_id, unit_id = null]) => ({
  id, kind, event_id, user_id, unit_id, lease_id: 'lease-' + id, urgent: kind !== 'report_review'
}));
const pushPayloads: Array<{ recipient_id: string; url: string; title: string; tag: string }> = [];
const finished = new Map<string, { channel: string; outcome: string }>();
const smsJobs: string[] = [];
let claims = 0;
webpush.sendNotification = (async (_subscription: unknown, payload: string) => {
  pushPayloads.push(JSON.parse(typeof payload === 'string' ? payload : String(payload)));
  return { statusCode: 201, body: '', headers: {} };
}) as typeof webpush.sendNotification;
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  if (url.origin === gateway) {
    smsJobs.push(req.headers.get('Idempotency-Key') || '');
    return Response.json({ ok: true });
  }
  assert.equal(url.origin, database);
  const body = req.body ? await req.json() : {};
  const id = url.searchParams.get('id')?.slice(3);
  switch (url.pathname) {
    case '/rest/v1/rpc/emergency_worker_token_ok':
      return Response.json(body.p_token === 'fixture-emergency-token');
    case '/rest/v1/rpc/claim_emergency_delivery':
      claims++;
      return Response.json(rowsToSend);
    case '/rest/v1/rpc/finish_emergency_delivery':
      assert.equal(body.p_lease, 'lease-' + body.p_id);
      finished.set(body.p_id, { channel: body.p_channel, outcome: body.p_outcome });
      return new Response(null, { status: 204 });
    case '/rest/v1/profiles':
      return Response.json([staff[id as keyof typeof staff]]);
    case '/rest/v1/sos_log':
      return Response.json([{ status: 'sent', barangay_id: barangay }]);
    case '/rest/v1/sos_staff_receipts':
      return Response.json(url.searchParams.get('staff_id') === 'eq.local' ? [{ sos_id: 'sos-log' }] : []);
    case '/rest/v1/report_dispatches':
      return Response.json([{ team: 'BFP', unit_id: unit, dispatch_status: 'sent', report_id: 'intake' }]);
    case '/rest/v1/reports':
      return Response.json([{ status: id === 'verified' ? 'verified' : 'reported', barangay_id: barangay, severity: 'emergency' }]);
    case '/rest/v1/notifications':
      assert.equal(url.searchParams.get('type'), 'eq.relief_low_stock');
      return Response.json([{ title: 'Relief stock needs attention', read_at: id === 'stock-read' ? '2000-01-01' : null }]);
    case '/rest/v1/push_subscriptions':
      if (url.searchParams.get('user_id') === 'eq.duty') return Response.json([]);
      return Response.json([{ id: 'sub', endpoint: 'https://fcm.googleapis.com/fixture/1', p256dh: 'fixture', auth: 'fixture' }]);
    default: throw Error('Unmocked emergency endpoint ' + url.pathname);
  }
};

try {
  assert.equal((await invoke(emergency, 'invalid-token', {})).status, 403);
  assert.equal(claims, 0);
  const result = await invoke(emergency, 'fixture-emergency-token', {});
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { claimed: rowsToSend.length, writeFailures: 0 });
  assert.deepEqual(pushPayloads.sort((a, b) => a.tag.localeCompare(b.tag)), [
    { title: 'BFP dispatch needs acknowledgment', body: 'Open UniGuard to review the alert.', severity: 'emergency',
      url: './index.html?dispatch=assignment#dispatch', recipient_id: 'bfp', tag: 'dispatch-assignment' },
    { title: 'Confirmed hazard for your response team', body: 'Open UniGuard to review the alert.', severity: 'emergency',
      url: './index.html#notifications', recipient_id: 'bfp', tag: 'hazard_confirmed-verified' },
    { title: 'Relief stock needs attention', body: 'Open UniGuard to review the alert.', severity: 'warning',
      url: './index.html?relief=inventory#relief', recipient_id: 'reliefDuty', tag: 'relief_low_stock-stock-fresh' },
    { title: 'New hazard report needs review', body: 'Open UniGuard to review the alert.', severity: 'warning',
      url: './index.html?incident=intake#incidents', recipient_id: 'local', tag: 'report_review-intake' }
  ]);
  assert.deepEqual(smsJobs.sort(), ['gap-job', 'sos-job']);
  for (const [id, channel] of [['bfp-job', 'push'], ['review-job', 'push'], ['confirmed-job', 'push'], ['sos-job', 'sms'], ['gap-job', 'sms'], ['stock-push', 'push']]) {
    assert.deepEqual(finished.get(id), { channel, outcome: 'sent' });
  }
  for (const id of ['foreign-job', 'alternate-job', 'removed-job', 'stale-job', 'acknowledged-job', 'stock-no-push', 'stock-read', 'stock-unauthorized']) {
    assert.deepEqual(finished.get(id), { channel: null, outcome: 'cancelled' });
  }
  console.log('PASS Delivery worker scopes emergency and relief push, reserves SMS for incident alerts, and skips handled or unauthorized jobs.');
} finally {
  globalThis.fetch = oldFetch;
  webpush.sendNotification = oldSend;
}
