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
webpush.sendNotification = (async (subscription) => {
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
  const repeated = await invoke(sms, service, { ...payload, actorId });
  assert.equal((await repeated.json()).queued, 0);
  assert.deepEqual(requests, people.map(({ id }) => alertId + ':' + id));
  assert.deepEqual(audits.map(({ actor_id }) => actor_id), [actorId, actorId, actorId]);
  console.log('PASS Push delivery paginates 225 fixtures with at most 20 concurrent sends. Sender audit and SMS deduplication also passed.');
} finally {
  globalThis.fetch = oldFetch;
  webpush.sendNotification = oldSend;
}
