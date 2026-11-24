// UniGuard · Edge Function: push-dispatch
//
// Sends a Web Push notification to every subscribed device, optionally narrowed
// to the audience the caller names, then hands recipients without a push
// subscription to sms-fallback.
//
// Extended (migration 038+): the audience can be narrowed with
//   · barangayId  → residents + officials of that barangay (only an LGU may
//                   broadcast municipality-wide; an official may target only
//                   their own barangay; the server re-checks here)
//   · unitId       → only the dispatch team accounts of that unit
//
// Deploy:
//   supabase functions deploy push-dispatch
//   supabase secrets set VAPID_PUBLIC_KEY=*** VAPID_PRIVATE_KEY=***
//                        VAPID_SUBJECT=mailto:drrmo@example.gov.ph
//
// Only an authenticated LGU / LDRRMC account may broadcast municipality-wide.
// A barangay_official may call this with their own barangay as the audience.
// Residents and dispatch teams are refused. `barangayIds` (an array) narrows
// the audience to several barangays at once.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:drrmo@example.gov.ph';

  if (!service) return json({ error: 'Service role key is not configured on this function' }, 500);
  if (!vapidPublic || !vapidPrivate) return json({ error: 'VAPID keys are not configured' }, 500);

  // ---- who is calling -----------------------------------------------------
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401);

  const asCaller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Not signed in' }, 401);

  const { data: profile } = await asCaller
    .from('profiles').select('role, barangay_id, dispatch_unit_id, disabled').eq('id', userData.user.id).maybeSingle();

  if (!profile) return json({ error: 'Profile not found' }, 403);
  // only LGU / LDRRMC (Super Admin included) and barangay officials send
  // alerts; residents and dispatch teams never can
  if (profile.disabled) return json({ error: 'This account is disabled' }, 403);
  if (profile.role !== 'lgu_ldrrmc' && profile.role !== 'barangay_official') {
    return json({ error: 'Only LGU / LDRRMC and barangay officials can send alerts' }, 403);
  }

  // ---- read the request ---------------------------------------------------
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* an empty body is allowed */ }

  const title = String(body.title || 'UniGuard alert');
  const message = String(body.body || '');
  const severity = String(body.severity || 'advisory');
  const advisoryId = (body.advisoryId as string) || null;
  const area = String(body.area || 'Municipality-wide');
  const urlTarget = String(body.url || './index.html');
  const barangayId = (body.barangayId as string) || null;
  const unitId = (body.unitId as string) || null;
  // several barangays at once (an advisory aimed at more than one)
  const barangayIds: string[] = Array.isArray(body.barangayIds)
    ? (body.barangayIds as unknown[]).map(String).filter(Boolean)
    : (barangayId ? [barangayId] : []);

  // audience authorisation
  //   · LGU can broadcast municipality-wide (no audience) OR target any
  //     barangay or unit.
  //   · barangay_official can ONLY target their own barangay.
  //   · dispatch_team cannot broadcast through this function.
  if (profile.role === 'barangay_official') {
    if (unitId) return json({ error: 'Only LGU / LDRRMC can alert a dispatch unit' }, 403);
    if (!barangayIds.length) return json({ error: 'Only LGU / LDRRMC can broadcast municipality-wide' }, 403);
    if (barangayIds.some((b) => b !== profile.barangay_id)) {
      return json({ error: 'You can only target your own barangay' }, 403);
    }
  }

  const payload = JSON.stringify({
    title, body: message, severity, advisory_id: advisoryId, url: urlTarget,
    tag: advisoryId || 'uniguard', renotify: severity === 'emergency'
  });

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const batchSize = 20;
  const pageSize = 200;
  let afterId = '';
  let sent = 0, failed = 0, removed = 0;
  while (true) {
    let query = admin.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, profiles!inner(disabled, barangay_id, dispatch_unit_id, role)')
      .eq('profiles.disabled', false).order('id').limit(pageSize);
    if (afterId) query = query.gt('id', afterId);
    if (barangayIds.length) query = query.in('profiles.barangay_id', barangayIds);
    else if (unitId) query = query.eq('profiles.dispatch_unit_id', unitId).eq('profiles.role', 'dispatch_team');
    const { data: subs, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!subs?.length) break;
    afterId = subs[subs.length - 1].id;

    for (let start = 0; start < subs.length; start += batchSize) {
      const batch = subs.slice(start, start + batchSize);
      const results = await Promise.allSettled(batch.map(async (device) => webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        payload,
        { TTL: severity === 'emergency' ? 3600 : 900, urgency: severity === 'emergency' ? 'high' : 'normal', timeout: 8000 }
      )));
      const stale = [];
      for (const [i, result] of results.entries()) {
        if (result.status === 'fulfilled') sent++;
        else {
          failed++;
          if ([404, 410].includes(result.reason?.statusCode)) stale.push(batch[i]);
        }
      }
      await Promise.all(stale.map(async (device) => {
        // A device might have renewed the endpoint since this send began.
        const { data } = await admin.from('push_subscriptions').delete()
          .eq('id', device.id).eq('endpoint', device.endpoint).select('id');
        removed += data?.length || 0;
      }));
    }
    if (subs.length < pageSize) break;
  }

  // ---- SMS fallback for accounts with no push device ----------------------
  let smsQueued = 0;
  if (body.alsoSms !== false) {
    try {
      // sms-fallback only accepts this function (service key) as its caller
      const { data: smsResult } = await admin.functions.invoke('sms-fallback', {
        body: { title, message, severity, area, advisoryId, barangayIds, unitId, actorId: userData.user.id }
      }) as { data: { queued?: number } | null };
      smsQueued = smsResult?.queued ?? 0;
    } catch {
      smsQueued = 0; // SMS is a fallback; never let it fail the alert
    }
  }

  await admin.from('audit_log').insert({
    actor_id: userData.user.id,
    action: 'push.dispatched',
    entity: 'advisories',
    entity_id: advisoryId,
    meta: { sent, failed, removed, smsQueued, area, severity, barangayIds, unitId, by: userData.user.id }
  });

  return json({ ok: true, sent, failed, removed, smsQueued });
});
