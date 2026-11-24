import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Job = { id: string; kind: 'sos' | 'dispatch' | 'report_review' | 'dispatch_gap' | 'hazard_confirmed'; event_id: string; user_id: string; lease_id: string; urgent: boolean; unit_id: string | null };
type Outcome = { outcome: 'sent' | 'failed' | 'retry' | 'cancelled'; channel?: string; reason?: string };

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return new Response(null, { status: 403 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const secret = Deno.env.get('EMERGENCY_WORKER_SECRET');
  if (secret ? token !== secret : !(await admin.rpc('emergency_worker_token_ok', { p_token: token })).data) {
    return new Response(null, { status: 403 });
  }
  const gateway = Deno.env.get('SMS_GATEWAY_URL');
  const gatewayKey = Deno.env.get('SMS_GATEWAY_KEY');
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapid = vapidPublic && vapidPrivate ? {
    subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:drrmo@example.gov.ph',
    publicKey: vapidPublic, privateKey: vapidPrivate
  } : undefined;

  const { data, error } = await admin.rpc('claim_emergency_delivery');
  if (error) return Response.json({ error: 'Queue claim failed' }, { status: 500 });

  async function deliver(job: Job): Promise<Outcome> {
    const { data: profile, error } = await admin.from('profiles')
      .select('disabled,removed_at,role,is_super_admin,barangay_id,barangay,dispatch_unit_id,phone').eq('id', job.user_id).maybeSingle();
    if (error) return { outcome: 'retry', reason: 'Recipient lookup failed' };
    if (!profile || profile.disabled || profile.removed_at) return { outcome: 'cancelled', reason: 'Recipient inactive' };

    let title: string;
    let url: string;
    const urgent = job.urgent !== false;
    if (job.kind === 'sos') {
      const { data: sos, error } = await admin.from('sos_log').select('barangay_id,barangay,status')
        .eq('id', job.event_id).maybeSingle();
      if (error) return { outcome: 'retry', reason: 'SOS lookup failed' };
      if (!sos || sos.status === 'resolved') return { outcome: 'cancelled', reason: 'SOS closed' };
      const inBarangay = sos.barangay_id ? profile.barangay_id === sos.barangay_id :
        !!sos.barangay && profile.barangay === sos.barangay;
      if (profile.role !== 'lgu_ldrrmc' && !(profile.role === 'barangay_official' && inBarangay)) {
        return { outcome: 'cancelled', reason: 'Recipient changed roles or coverage' };
      }
      const { data: receipt, error: receiptError } = await admin.from('sos_staff_receipts')
        .select('sos_id').eq('sos_id', job.event_id).eq('staff_id', job.user_id).maybeSingle();
      if (receiptError) return { outcome: 'retry', reason: 'Acknowledgment lookup failed' };
      if (receipt) return { outcome: 'cancelled', reason: 'Already acknowledged' };
      title = 'New SOS needs acknowledgment';
      url = './index.html?sos=' + encodeURIComponent(job.event_id) + '#sos';
    } else if (job.kind === 'dispatch') {
      const { data: assignment, error } = await admin.from('report_dispatches')
        .select('team,report_id,unit_id,target_barangay_id,dispatch_status').eq('id', job.event_id).maybeSingle();
      if (error) return { outcome: 'retry', reason: 'Assignment lookup failed' };
      if (!assignment || assignment.dispatch_status !== 'sent') return { outcome: 'cancelled', reason: 'Assignment no longer waiting' };
      const eligible = assignment.unit_id
        ? profile.role === 'dispatch_team' && profile.dispatch_unit_id === assignment.unit_id
        : profile.role === 'barangay_official' && !!assignment.target_barangay_id && profile.barangay_id === assignment.target_barangay_id;
      if (!eligible) return { outcome: 'cancelled', reason: 'Recipient changed roles or coverage' };
      title = assignment.team + ' dispatch needs acknowledgment';
      url = assignment.unit_id
        ? './index.html?dispatch=' + encodeURIComponent(job.event_id) + '#dispatch'
        : './index.html?incident=' + encodeURIComponent(assignment.report_id) + '#incidents';
    } else {
      const { data: report, error } = await admin.from('reports').select('status,barangay_id')
        .eq('id', job.event_id).maybeSingle();
      if (error) return { outcome: 'retry', reason: 'Report lookup failed' };
      const review = job.kind === 'report_review';
      if (!report || (review ? report.status !== 'reported' : !['verified', 'dispatched'].includes(report.status))) {
        return { outcome: 'cancelled', reason: 'Report no longer needs this alert' };
      }
      const localStaff = profile.role === 'barangay_official' &&
        report.barangay_id && profile.barangay_id === report.barangay_id;
      const incidentUrl = './index.html?incident=' + encodeURIComponent(job.event_id) + '#incidents';
      if (job.kind === 'hazard_confirmed') {
        const unitMember = job.unit_id && profile.role === 'dispatch_team' && profile.dispatch_unit_id === job.unit_id;
        if (job.unit_id ? !unitMember : !localStaff) {
          return { outcome: 'cancelled', reason: 'Recipient changed roles or coverage' };
        }
        title = 'Confirmed hazard for your response team';
        url = job.unit_id ? './index.html#notifications' : incidentUrl;
      } else {
        const dutyStaff = profile.role === 'lgu_ldrrmc' && !profile.is_super_admin;
        if (!dutyStaff && !(review && localStaff)) return { outcome: 'cancelled', reason: 'Recipient changed roles or coverage' };
        title = review ? 'New hazard report needs review' : 'Response team needs duty follow-up';
        url = incidentUrl;
      }
    }

    const body = 'Open UniGuard to review the alert.';
    let retry = false;
    if (vapid) {
      const { data: subscriptions, error } = await admin.from('push_subscriptions')
        .select('id,endpoint,p256dh,auth').eq('user_id', job.user_id);
      if (error) retry = true;
      const replies = await Promise.allSettled((subscriptions || []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title, body, severity: urgent ? 'emergency' : 'warning', url,
              recipient_id: job.user_id, tag: job.kind + '-' + job.event_id }),
            { TTL: 180, urgency: urgent ? 'high' : 'normal', timeout: 5000, vapidDetails: vapid }
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id).eq('endpoint', sub.endpoint);
          else retry = true;
          throw err;
        }
      }));
      if (replies.some(reply => reply.status === 'fulfilled')) return { outcome: 'sent', channel: 'push' };
    }

    const to = String(profile.phone || '').trim().replace(/[()\s-]/g, '');
    if (gateway && gatewayKey && /^\+?\d{10,15}$/.test(to)) {
      try {
        const response = await fetch(gateway, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + gatewayKey,
            'Content-Type': 'application/json',
            'Idempotency-Key': job.id
          },
          body: JSON.stringify({ sender: Deno.env.get('SMS_SENDER') || 'UniGuard', to, message: title + '. ' + body }),
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) return { outcome: 'sent', channel: 'sms' };
        retry ||= response.status === 429 || response.status >= 500;
      } catch {
        retry = true;
      }
    }
    return { outcome: retry ? 'retry' : 'failed', reason: 'No push or SMS provider accepted the alert' };
  }

  const results = await Promise.allSettled(((data || []) as Job[]).map(async (job) => {
    let result: Outcome;
    try { result = await deliver(job); }
    catch { result = { outcome: 'retry', reason: 'Delivery attempt interrupted' }; }
    const { error } = await admin.rpc('finish_emergency_delivery', {
      p_id: job.id, p_lease: job.lease_id, p_outcome: result.outcome,
      p_channel: result.channel || null, p_reason: result.reason || null
    });
    if (error) throw error;
  }));
  const writeFailures = results.filter((result) => result.status === 'rejected').length;
  return Response.json({ claimed: results.length, writeFailures }, { status: writeFailures ? 500 : 200 });
});
