// UniGuard · Edge Function: admin-notify
//
// Push worker for Super Admin notifications (migration 076). The database
// writes one notifications row per Super Admin (audience = 'super_admin',
// push_status = 'pending') and wakes this function through pg_net; a pg_cron
// job also wakes it every two minutes for retries. Each run claims the
// waiting rows, re-checks that the recipient is still an active Super Admin,
// and sends a Web Push to that person's subscribed devices.
//
// Deploy (once):
//   supabase secrets set ADMIN_NOTIFY_SECRET='<a-long-random-secret>'
//   supabase functions deploy admin-notify --no-verify-jwt
// It uses the VAPID keys push-dispatch already uses. Then store the URL and
// the same secret in Vault (docs/DEPLOY.md, "Super Admin push").

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Row = { id: string; user_id: string; title: string; body: string; tone: string; type: string | null;
  push_lease: string; target_profile_id: string | null; change_request_id: string | null };

Deno.serve(async (request) => {
  const secret = Deno.env.get('ADMIN_NOTIFY_SECRET');
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (!secret || request.headers.get('Authorization') !== 'Bearer ' + secret) return new Response(null, { status: 403 });

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidPublic || !vapidPrivate) return Response.json({ error: 'VAPID keys are not configured' }, { status: 500 });
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:drrmo@example.gov.ph', vapidPublic, vapidPrivate);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('claim_admin_push', { p_limit: 50 });
  if (error) return Response.json({ error: 'Queue claim failed' }, { status: 500 });
  const rows = (data ?? []) as Row[];

  const finish = (row: Row, outcome: 'sent' | 'none' | 'retry' | 'failed') =>
    admin.rpc('finish_admin_push', { p_id: row.id, p_lease: row.push_lease, p_outcome: outcome });

  let sent = 0, none = 0, retry = 0;
  for (const row of rows) {
    try {
      // the role may have changed since the notification was written
      const { data: who } = await admin.from('profiles').select('role, is_super_admin, disabled').eq('id', row.user_id).maybeSingle();
      if (!who || who.disabled || who.role !== 'lgu_ldrrmc' || !who.is_super_admin) { await finish(row, 'none'); none++; continue; }

      const { data: subs, error: subsError } = await admin.from('push_subscriptions')
        .select('id, endpoint, p256dh, auth').eq('user_id', row.user_id);
      if (subsError) { await finish(row, 'retry'); retry++; continue; }
      if (!subs || !subs.length) { await finish(row, 'none'); none++; continue; }

      const payload = JSON.stringify({
        title: row.title || 'UniGuard · Super Admin', body: row.body || '',
        severity: row.tone === 'warning' ? 'warning' : 'advisory',
        url: './index.html#admin-home', tag: 'sa-' + row.id
      });
      let delivered = 0, transient = 0;
      const stale: string[] = [];
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'normal' });
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) stale.push(s.id); else transient++;
        }
      }
      if (stale.length) await admin.from('push_subscriptions').delete().in('id', stale);
      if (delivered) { await finish(row, 'sent'); sent++; }
      else if (transient) { await finish(row, 'retry'); retry++; }
      else { await finish(row, 'none'); none++; }
    } catch {
      await finish(row, 'retry'); retry++;
    }
  }
  return Response.json({ ok: true, claimed: rows.length, sent, none, retry });
});
