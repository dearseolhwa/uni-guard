// UniGuard · Edge Function: sms-fallback
//
// Provider-agnostic SMS gateway interface for residents who have no push
// capable device. Nothing is hard-coded to one vendor: point SMS_GATEWAY_URL at
// your Philippine gateway and adapt `buildRequest` if its payload differs.
//
// Extended (migration 038+): now respects the same audience filters as
// push-dispatch (barangayId, unitId). When neither is set the function
// targets the whole municipality (LGU only — the caller is the push-dispatch
// function, which has already authorised the call).
//
// With no gateway configured the function records the messages it would have
// sent and returns, so the alert pipeline can be tested end to end before a
// commercial gateway is in place.
//
// Deploy:
//   supabase functions deploy sms-fallback
//   supabase secrets set SMS_GATEWAY_URL=https://... SMS_GATEWAY_KEY=... SMS_SENDER=UniGuard

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Build the provider request. Adapt this one function to your gateway. */
function buildRequest(gatewayUrl: string, key: string, sender: string, to: string, text: string, deliveryKey: string) {
  return new Request(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'Idempotency-Key': deliveryKey },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ sender, to, message: text })
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!service) return json({ error: 'Service role key is not configured on this function' }, 500);

  // Only push-dispatch may call this function: it has already checked who is
  // sending and to whom, and it calls with the service role key. Anyone else
  // (including a browser holding the public anon key) is refused.
  if ((req.headers.get('Authorization') || '') !== `Bearer ${service}`) {
    return json({ error: 'Not allowed' }, 401);
  }

  const gatewayUrl = Deno.env.get('SMS_GATEWAY_URL') || '';
  const gatewayKey = Deno.env.get('SMS_GATEWAY_KEY') || '';
  const sender = Deno.env.get('SMS_SENDER') || 'UniGuard';

  const admin = createClient(url, service, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* allow an empty body */ }

  const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : null;
  const actorId = uuid(body.actorId);
  const advisoryId = uuid(body.advisoryId);
  const alertId = advisoryId || crypto.randomUUID();
  const title = String(body.title || 'UniGuard alert');
  const message = String(body.message || '');
  const severity = String(body.severity || 'advisory');
  const area = String(body.area || 'Municipality-wide');
  const barangayId = (body.barangayId as string) || null;
  const barangayIds: string[] = Array.isArray(body.barangayIds)
    ? (body.barangayIds as unknown[]).map(String).filter(Boolean)
    : (barangayId ? [barangayId] : []);
  const unitId = (body.unitId as string) || null;

  // Text messages cost money: only urgent alerts (emergency, warning) go by SMS.
  if (severity !== 'emergency' && severity !== 'warning') {
    return json({ ok: true, queued: 0, skipped: 'SMS is only sent for emergency and warning alerts' });
  }

  const text = `${title}${area ? ' (' + area + ')' : ''}: ${message}`.slice(0, 480);
  const pageSize = 100;
  let afterId = '';
  let wouldSend = 0, queued = 0, failed = 0;
  while (true) {
    let query = admin.from('profiles').select('id, phone').not('phone', 'is', null)
      .eq('disabled', false).order('id').limit(pageSize);
    if (afterId) query = query.gt('id', afterId);
    if (barangayIds.length) query = query.in('barangay_id', barangayIds);
    else if (unitId) query = query.eq('dispatch_unit_id', unitId).eq('role', 'dispatch_team');
    const { data: people, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!people?.length) break;
    afterId = people[people.length - 1].id;

    const { data: subs, error: subsError } = await admin.from('push_subscriptions')
      .select('user_id').in('user_id', people.map((p) => p.id));
    if (subsError) return json({ error: subsError.message }, 500);
    const hasPush = new Set((subs || []).map((sub) => sub.user_id));
    const recipients = people.filter((p) => p.phone && p.phone.length >= 10 && !hasPush.has(p.id));
    wouldSend += recipients.length;
    if (gatewayUrl && gatewayKey) {
      for (const recipient of recipients) {
        const args = { p_alert_id: alertId, p_user_id: recipient.id };
        const { data: lease, error: claimError } = await admin.rpc('claim_advisory_sms', args);
        if (claimError) { failed++; continue; }
        if (!lease) continue;
        try {
          const response = await fetch(buildRequest(
            gatewayUrl, gatewayKey, sender, recipient.phone, text, alertId + ':' + recipient.id
          ));
          const { error: saveError } = await admin.rpc('finish_advisory_sms', {
            ...args, p_lease_id: lease, p_sent: response.ok
          });
          if (response.ok && !saveError) queued++;
          else failed++;
        } catch {
          // The provider may have accepted the request. Hold the lease until
          // it expires and use the same gateway idempotency key on a retry.
          failed++;
        }
      }
    }
    if (people.length < pageSize) break;
  }

  if (!gatewayUrl || !gatewayKey) {
    await admin.from('audit_log').insert({
      actor_id: actorId, action: 'sms.skipped_no_gateway', entity: 'advisories', entity_id: advisoryId,
      meta: { wouldSend, severity, barangayIds, unitId }
    });
    return json({ ok: true, queued: 0, wouldSend, note: 'No SMS gateway configured' });
  }

  await admin.from('audit_log').insert({
    actor_id: actorId, action: 'sms.dispatched', entity: 'advisories', entity_id: advisoryId,
    meta: { queued, failed, severity, area, barangayIds, unitId }
  });
  return json({ ok: true, queued, failed });
});
