/* UniGuard · resident portal pages (Nov 2026)
 *
 * The rest of the resident portal in the look of the React build
 * (uniguard/src/components): Report a Hazard (ReportModal), My Reports
 * (ResidentMyReportsView), Relief / Guides / FAQs (ResidentContentTabs), the
 * Hazard Map (ResidentHazardMapView), Settings (SettingsView), Offline
 * (OfflineSyncCenter) and SOS (the SOS panel in DashboardHeader), plus the
 * phone navigation (ResidentMobileNav). Data, rules and actions are this
 * app's own: Repo, the APP_ACTIONS in js/app.js and the existing modules.
 * Rendered inside the resident shell (js/screens.web.js), styled by
 * css/resident.css.
 */
const UG_RW = (() => {
  const U = UG, I = U.icon, esc = U.esc;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map((k) => ' data-' + k + '="' + esc(o[k]) + '"').join('');
  const telOf = (n) => 'tel:' + esc(String(n || '').replace(/[^\d+]/g, ''));

  function lead(sub, actions) {
    return '<div class="rw-lead"><p>' + sub + '</p>' + (actions ? '<div class="rw-acts">' + actions + '</div>' : '') + '</div>';
  }
  function panelHead(title, sub, right) {
    return '<div class="rw-ph"><div style="min-width:0"><h3>' + esc(title) + '</h3>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</div>';
  }
  const optional = '<span class="rw-opt">Optional</span>';
  /* the LDRRMO line from the hotline directory, with the office number as a fallback */
  function mdrrmo() {
    const h = (U.DATA.hotlines || []).find((x) => /mdrrmo|ldrrmo/i.test(x.agency));
    return h ? h.number : '(075) 632-2222';
  }

  /* ================================================================ report */
  const URGENCY = [
    ['advisory', 'Looks Minor', 'No one is in danger yet.', 1],
    ['warning', 'Getting Worse', 'It is spreading, rising or getting bigger.', 2],
    ['emergency', 'People at Risk', 'Someone could get hurt, or is trapped.', 3]
  ];

  function report(st) {
    const r = st.report;
    const brgy = r.brgy || (st.session && st.session.barangay) || '';
    const urg = URGENCY.find((u) => u[0] === r.urg) || URGENCY[1];
    const isOther = UG_HAZARDS.classify(r.hazard).key === 'other';
    const near = (U.DATA.incidents || []).filter((i) => !i.mine && i.brgy === brgy && i.hazard_type === r.hazard &&
      i.status !== 'resolved' && i.status !== 'rejected');
    const hasPos = r.gps && UG_GEO.isNum(r.lat);
    const ready = !!r.desc.trim();

    const details = '<section class="rw-panel rw-panel--flush">' +
      panelHead('What is happening?', 'Tell us what kind of hazard it is and how bad it looks.') +
      '<div class="rw-pb ug-col" style="gap:20px">' +
        '<div class="rw-two">' +
          '<div class="rw-field"><label class="rw-label" for="rw-type">Type of hazard</label>' +
            '<div class="rw-selwrap"><select id="rw-type" class="rw-in" data-field="hazard">' + U.DATA.hazards.map((h) =>
              '<option value="' + esc(h) + '"' + (r.hazard === h ? ' selected' : '') + '>' + esc(h) + '</option>').join('') + '</select>' + I('chevdn', 16) + '</div>' +
            (isOther ? '<input class="rw-in" data-field="hazardOther" placeholder="What is the hazard?" value="' + esc(r.hazardOther || '') + '">' : '') +
          '</div>' +
          '<div class="rw-field"><label class="rw-label" for="rw-brgy">Barangay</label>' +
            '<div class="rw-selwrap"><select id="rw-brgy" class="rw-in" data-field="brgy"' + (st.editing ? ' disabled' : '') + '>' + U.DATA.barangays.map((b) =>
              '<option value="' + esc(b) + '"' + (brgy === b ? ' selected' : '') + '>Brgy. ' + esc(b) + '</option>').join('') + '</select>' + I('chevdn', 16) + '</div>' +
            '<p class="rw-help">' + (st.editing ? 'The barangay stays as filed.' : 'Follows the pin on the map.') + '</p></div>' +
        '</div>' +
        '<fieldset class="rw-field"><legend class="rw-label" style="margin-bottom:8px">How urgent does it look?</legend>' +
          '<div class="rw-urg" role="radiogroup">' + URGENCY.map((u) => {
            const on = r.urg === u[0];
            return '<button type="button" role="radio" aria-checked="' + on + '" class="rw-urg-i' + (on ? ' is-on' : '') + '"' + A('set-urg', attr({ v: u[0] })) + '>' +
              '<span class="rw-bars" aria-hidden="true">' + [1, 2, 3].map((n) => '<i class="b' + n + (n <= u[3] ? ' is-lit' : '') + '"></i>').join('') + '</span>' +
              '<span>' + u[1] + '</span>' + (on ? I('check', 16) : '') + '</button>';
          }).join('') + '</div>' +
          '<p class="rw-help">' + esc(urg[2]) + '</p></fieldset>' +
        '<div class="rw-field"><label class="rw-label" for="rw-desc">What do you see?</label>' +
          '<textarea id="rw-desc" class="rw-in" rows="5" data-field="desc" placeholder="For example: water is knee-deep on the main road, two families are stuck on their roof.">' + esc(r.desc) + '</textarea>' +
          '<p class="rw-help">Include how deep, how big, and if anyone needs help.</p></div>' +
      '</div></section>';

    const photo = '<section class="rw-panel rw-panel--flush">' +
      panelHead('Photo', 'A photo helps responders see the problem.', optional) +
      '<div class="rw-pb">' + (r.photo
        ? '<div class="rw-photo">' + (r.photoPreview ? '<img src="' + esc(r.photoPreview) + '" alt="Hazard preview">' : '<div class="rw-photo-ph">' + I('camera', 22) + esc(r.photoName || 'Photo attached') + '</div>') +
            '<button type="button"' + A('rm-photo') + '>' + I('x', 14) + 'Remove</button></div>' +
          (r.photoBytes ? '<p class="rw-help" style="margin-top:8px">' + esc(UG_UTIL.bytes(r.photoBytes)) + ' after compression</p>' : '')
        : '<button type="button" class="rw-drop"' + A('add-photo') + '>' + I('camera', 24) +
            '<b>Take or attach a photo</b><span>JPG or PNG up to 10 MB</span></button>') +
        (st.offline ? '<p class="rw-help" style="margin-top:8px">Photos are sent when you are back online.</p>' : '') +
      '</div></section>';

    const where = '<section class="rw-panel rw-panel--flush">' +
      panelHead('Where is it?', 'Put the pin exactly where the hazard is.') +
      '<div class="rw-pb ug-col" style="gap:16px">' +
        (r.gpsDenied && !r.gps ? '<p class="rw-warn">' + I('info', 16) + '<span>We could not read your GPS. Drag the pin on the map to the hazard spot.</span></p>' : '') +
        '<div class="rw-geo">' + I('pin', 20) +
          '<div style="min-width:0;flex:1"><b>' + esc(hasPos ? (r.address || 'Pin placed') : 'No location yet') + '</b>' +
            '<span class="rw-mono">' + esc(hasPos ? UG_GEO.fmt(r.lat, r.lng) : 'Use your location or drag the pin') + '</span></div>' +
          '<button type="button" class="rw-gps"' + A('gps') + '>' + I('target', 16) + (hasPos ? 'Update' : 'Use my location') + '</button></div>' +
        '<div class="ug-map rw-pinmap" data-map="report-pin">' + U.mapSVG({}) + '</div>' +
        '<p class="rw-help" data-pin-outside' + (r.pinOutside ? '' : ' hidden') + ' style="color:var(--rw-red);font-weight:600">The pin must be inside Lingayen.</p>' +
        '<p class="rw-help">Drag the pin or tap the map to move it.</p>' +
        '<div class="rw-field"><label class="rw-label rw-label--opt" for="rw-landmark">Landmark or exact address' + optional + '</label>' +
          '<input id="rw-landmark" class="rw-in" data-field="reportAddress" maxlength="200" value="' + esc(r.locationNote || '') + '" placeholder="For example: beside the seawall, near the chapel">' +
          '<p class="rw-help">Landmarks help responders find the exact spot.</p></div>' +
      '</div></section>';

    return '<div class="ug-col" style="gap:16px">' +
      lead(st.editing
          ? 'Editing <b>' + esc(st.editing.code || '') + '</b>. The location and barangay stay as filed.'
          : 'Goes to the Lingayen LDRRMO and Brgy. ' + esc(brgy) + '.',
        st.editing
          ? '<button class="rw-btn rw-btn--line" style="border-radius:999px"' + A('cancel-edit') + '>Cancel edit</button>'
          : '<button class="rw-btn rw-btn--line" style="border-radius:999px"' + A('nav', attr({ route: 'home' })) + '>' + I('x', 14) + 'Cancel</button>') +
      (st.offline ? '<p class="rw-warn rw-warn--amber">' + I('wifioff', 16) + '<span>You are offline. Your report is saved on this device and sent automatically when you are back online.</span></p>' : '') +
      (near.length && !st.editing ? '<p class="rw-warn rw-warn--plain">' + I('users', 16) + '<span>' + (near.length === 1 ? 'Someone already reported' : near.length + ' people already reported') +
        ' a ' + esc(r.hazard.toLowerCase()) + ' in Brgy. ' + esc(brgy) + '. Send yours too. More reports help confirm it faster.</span></p>' : '') +
      '<div class="rw-form-grid"><div class="ug-col" style="gap:16px">' + details + photo + '</div>' +
        '<div class="ug-col" style="gap:16px">' + where + '</div></div>' +
      '<p class="rw-quiet">' + I('info', 14) + 'Your report counts once. Other residents can confirm the same nearby hazard.</p>' +
      '<div class="rw-submit">' +
        (r.error ? '<p class="rw-alert" role="alert">' + I('alert', 16) + '<span>' + esc(r.error) + '</span></p>' : '') +
        '<button class="rw-send' + (ready && !r.busy ? '' : ' is-disabled') + '"' + A('submit-report') + (r.busy ? ' disabled' : '') + '>' +
          (r.busy ? 'Sending…' : I('check', 16) + (st.editing ? 'Save changes' : st.offline ? 'Save and send later' : 'Send Report')) + '</button>' +
        '<p class="rw-help" style="text-align:center">' + (st.editing ? 'Changes are saved to the report history.' : 'You can still edit your report for 15 minutes after sending.') + '</p>' +
      '</div>' +
    '</div>';
  }

  function reportDone(st) {
    const last = st.lastReport || {};
    const steps = [['Reported', 'Your report reached the barangay queue.'], ['Verified', 'An official can verify the hazard. It also verifies after three independent residents report or confirm it, including the original reporter.'],
      ['Help on the way', 'A response team is sent.'], ['Resolved', 'The hazard is cleared.']];
    return '<div class="ug-col" style="gap:20px;max-width:760px">' +
      '<section class="rw-done">' +
        '<span class="rw-done-ico">' + I('check', 28) + '</span>' +
        '<h2>' + (last.id ? 'Report sent' : 'Report saved offline') + '</h2>' +
        '<p>' + (last.id ? 'Brgy. ' + esc(last.brgy || '') + ' can review your hazard report.' : 'UniGuard will send your report when you reconnect.') + '</p>' +
        '<span class="rw-pill rw-pill--soft rw-mono">' + esc(last.id || 'Waiting to sync') + '</span>' +
      '</section>' +
      '<section class="rw-card"><div class="rw-card-h"><h3>What happens next</h3>' +
        (last.id ? '<span class="rw-live">' + Math.min(last.corr ?? 1, UG_CONFIG.CORROBORATION_THRESHOLD) +
          ' of ' + UG_CONFIG.CORROBORATION_THRESHOLD + ' confirmations</span>' : '') + '</div>' +
        '<ol class="rw-next">' + steps.map((s, n) => '<li class="' + (n === 0 ? 'is-on' : '') + '"><b>' + (n + 1) + '</b><span><strong>' + s[0] + '</strong>' + s[1] + '</span></li>').join('') + '</ol></section>' +
      '<div class="rw-row-acts">' +
        '<button class="rw-btn rw-btn--red" style="padding:12px 22px"' + A('nav', attr({ route: 'reports' })) + '>Track my report</button>' +
        '<button class="rw-btn rw-btn--line" style="padding:12px 22px"' + A('nav', attr({ route: 'home' })) + '>Back to Home</button>' +
      '</div>' +
    '</div>';
  }

  /* ============================================================ my reports */
  const STEPS = ['reported', 'verified', 'dispatched', 'resolved'];
  const STATUS = {
    reported: ['Reported', 'rw-pill--light'], verified: ['Verified', 'rw-pill--soft'],
    dispatched: ['Help on the way', 'rw-pill--amber'], resolved: ['Resolved', 'rw-pill--dark'],
    rejected: ['Not confirmed', 'rw-pill--grey'],
    expired: ['Expired', 'rw-pill--grey']
  };
  const HISTORY_LABEL = { reported: 'Reported', verified: 'Verified', dispatched: 'Help on the way', resolved: 'Resolved', rejected: 'Not confirmed' };

  function myReports(st) {
    const page = st.myReportPage || {};
    const mine = (page.loaded ? U.DATA.myReportRows : (U.DATA.incidents || []).filter((i) => i.mine)) || [];
    const rows = mine.map((row) => Repo.findReport(row.uuid || row.id) || row)
      .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
    const queued = U.DATA.queuedReports || [];
    const history = U.DATA.reportHistory || {};
    const when = (v) => v ? new Date(v).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const row = (i) => {
      const s = STATUS[i.expired ? 'expired' : i.status] || STATUS.reported;
      const open = st.rwReport === i.uuid;
      const reached = STEPS.indexOf(i.status);
      const left = Date.parse(i.created_at || 0) + 15 * 60000 - Date.now();
      const canEdit = i.status === 'reported' && left > 0;
      const hist = history[i.uuid] || [];
      return '<li class="' + (open ? 'is-open' : '') + '">' +
        '<div class="rw-mr" role="button" tabindex="0" aria-expanded="' + open + '"' + A('rw-report', attr({ id: i.uuid })) + '>' +
          '<div class="rw-main"><div class="rw-t"><b>' + esc(i.hazard) + '</b><span class="rw-code">' + esc(i.id) + '</span></div>' +
            (i.desc ? '<p class="rw-mr-desc' + (open ? '' : ' rw-clamp2') + '">' + esc(i.desc) + '</p>' : '') +
            (open && i.location_note ? '<p class="rw-mr-desc">' + I('pin', 14) + ' <strong>Landmark:</strong> ' + esc(i.location_note) + '</p>' : '') +
            '<div class="rw-meta"><span>' + I('clock', 14) + esc(i.time) + '</span><span>' + I('pin', 14) + (i.brgy ? 'Brgy. ' + esc(i.brgy) : '—') + '</span>' +
              '<span>' + I('shield', 14) + (i.corr || 0) + ' confirmed</span></div></div>' +
          '<div class="rw-mr-r"><span class="rw-pill ' + s[1] + '">' + s[0] + '</span><span class="rw-chev">' + I('chevdn', 16) + '</span></div>' +
        '</div>' +
        (open ? '<div class="rw-mr-body">' +
          (i.status !== 'rejected' ? '<ol class="rw-prog" aria-label="Progress">' + STEPS.map((p, n) =>
            '<li class="' + (n <= reached ? 'is-on' : '') + '"><i></i><span>' + STATUS[p][0] + '</span></li>').join('') + '</ol>' : '') +
          (i.photo_url ? '<a href="' + esc(i.photo_url) + '" target="_blank" rel="noopener noreferrer" class="rw-mr-photo"><img src="' + esc(i.photo_url) + '" alt="Photo you attached"></a>' : '') +
          '<dl class="rw-dl"><div><dt>Filed</dt><dd>' + esc(when(i.created_at)) + '</dd></div>' +
            (i.verified_by_name ? '<div><dt>Verified by</dt><dd>' + esc(i.verified_by_name) + '</dd></div>' : '') +
            (i.resolved_at ? '<div><dt>Resolved</dt><dd>' + esc(UG_UTIL.relTime({ created_at: i.resolved_at })) + '</dd></div>' : '') + '</dl>' +
          (hist.length ? '<div class="rw-act"><p class="rw-kicker">Activity</p><ol>' + hist.map((h) =>
            '<li><b>' + esc(HISTORY_LABEL[h.to_status] || h.to_status || '') + '</b><span> · ' + esc(UG_UTIL.relTime(h)) + '</span>' +
              (h.reason === 'auto_corroboration' ? '<em>Verified automatically: three neighbours confirmed it</em>' : h.note ? '<em>' + esc(h.note) + '</em>' : '') + '</li>').join('') + '</ol></div>' : '') +
          (canEdit ? '<p class="rw-help">You can edit it for ' + Math.max(1, Math.ceil(left / 60000)) + ' more min.</p>'
            : i.status === 'reported' ? '<p class="rw-help">The 15-minute edit window has closed. An official can still help you.</p>' : '') +
          '<div class="rw-row-acts">' +
            '<button class="rw-btn rw-btn--red"' + A('open-report', attr({ id: i.id })) + '>' + I('truck', 14) + 'Response and details</button>' +
            (canEdit ? '<button class="rw-btn rw-btn--line"' + A('start-edit-report', attr({ id: i.uuid })) + '>Edit this report</button>' : '') +
            (UG_GEO.isNum(i.lat) ? '<button class="rw-btn rw-btn--line rw-mapbtn" title="Show on map" aria-label="Show on map"' + A('rw-map-show', attr({ lat: i.lat, lng: i.lng })) + '>' + I('map', 17) + '<span>Show on map</span></button>' : '') +
          '</div>' +
        '</div>' : '') +
      '</li>';
    };
    return '<div class="ug-col" style="gap:24px">' +
      (queued.length ? '<section class="rw-card"><div class="rw-card-h"><h3>Waiting to send</h3><span class="rw-live" style="color:#92400E;background:#FFFBEB;border-color:#FCD34D">' + queued.length + ' saved on this device</span></div>' +
        '<ul class="rw-mrlist">' + queued.map((q) => '<li><div class="rw-mr" style="cursor:default"><div class="rw-main"><div class="rw-t"><b>' + esc(q.hazard || 'Hazard') + '</b></div>' +
          (q.description ? '<p class="rw-mr-desc rw-clamp2">' + esc(q.description) + '</p>' : '') +
          '<div class="rw-meta">' + (q.brgy ? '<span>' + I('pin', 14) + 'Brgy. ' + esc(q.brgy) + '</span>' : '') +
          '<span class="rw-pill rw-pill--soft">' + I('wifioff', 14) +
          (q.failed ? 'Could not send' : q.kind === 'sos' ? 'Waiting for signal' : 'Sends when you are online') +
          '</span></div>' + (q.failed ? '<div class="rw-row-acts"><button class="rw-btn rw-btn--line"' + A('queue-retry') + '>Retry</button>' +
            (q.kind === 'sos' ? '<a class="rw-btn rw-btn--red" href="' + telOf(mdrrmo()) + '">Call the LDRRMO</a>' : '') + '</div>' : '') +
          '</div></div></li>').join('') + '</ul></section>' : '') +
      '<section class="rw-card"><div class="rw-card-h rw-nhead"><div><h3>My reports</h3>' +
          (page.total != null ? '<span class="rw-hint">' + page.total + ' total</span>' : rows.length ? '<span class="rw-hint">' + rows.length + ' available</span>' : '') + '</div>' +
          '<button class="rw-newrep"' + A('nav', attr({ route: 'report' })) + '>' + I('plus', 14) + 'New report</button></div>' +
        (rows.length ? '<ul class="rw-mrlist">' + rows.map(row).join('') + '</ul>'
        : !page.loading && !page.error ? '<div class="rw-empty" style="padding:40px"><p style="color:#404040;font-weight:600">' +
          (st.offline ? 'No saved reports are available on this device.' : 'You haven\'t submitted any incident reports yet.') + '</p>' +
          '<button' + A('nav', attr({ route: 'report' })) + '>+ Submit a ground hazard report</button></div>' : '') +
        (page.loading || page.error || page.next ? '<div class="rw-card-b">' +
          (page.loading ? '<p role="status">Loading report history…</p>' :
            (page.error ? '<p role="status">We could not refresh your full report history.</p>' : '') +
            '<button type="button" class="rw-btn rw-btn--line"' + A('my-report-history', attr({ more: page.error ? !!page.retryMore : true })) + '>' +
            (page.error ? 'Retry loading reports' : 'Load older reports') + '</button>') + '</div>' : '') + '</section>' +
    '</div>';
  }

  /* one report's full record (dispatch tracking, ratings, corroboration) stays
     the shared detail screen, with a way back to the list */
  function reportDetail(st) {
    const back = st.reportBackRoute || 'reports';
    const label = back === 'map' ? 'Hazard Map' : back === 'sos' ? 'SOS' : back === 'home' ? 'Home' : 'My Reports';
    return '<div class="ug-col" style="gap:20px">' +
      '<button class="rw-back"' + A('nav', attr({ route: back })) + '><span style="display:flex;transform:rotate(180deg)">' + I('chevron', 16) + '</span>Back to ' + label + '</button>' +
      '<div class="rw-legacy">' + UG_SCREENS.mobileBody(Object.assign({}, st, { route: 'report-detail' })) + '</div>' +
    '</div>';
  }

  /* ================================================================ relief */
  function schedState(iso) {
    if (!iso) return 'Scheduled';
    const day = new Date(iso), today = new Date();
    if (day.toDateString() === today.toDateString()) return 'Distributing Now';
    return day.getTime() > today.getTime() ? 'Scheduled' : 'Completed';
  }
  function documentExample(label) {
    if (/authori[sz]ation|representative letter|sulat ng pahintulot/i.test(label)) {
      return '<p>Include the date, both full names, the relief program and claim date, and the beneficiary’s signature. Add the representative’s signature or ID copies if the organizer asks for them.</p>' +
        '<div class="rw-doc-sample"><strong>Sample authorization letter</strong>' +
          '<p>[Date]</p><p>To the relief distribution desk:</p>' +
          '<p>I, [beneficiary’s full name], authorize [representative’s full name] to claim my [name of relief assistance] at [distribution site] on [claim date].</p>' +
          '<p>[Beneficiary’s signature over printed name]<br>[Representative’s signature over printed name, if required]</p></div>';
    }
    if (/indigen/i.test(label)) {
      return '<p>Ask your barangay hall for a Certificate of Indigency for the relief program.</p>' +
        '<div class="rw-doc-sample"><strong>Example of what to check</strong><p>Barangay name · Your full name · Purpose or program · Date issued · Signature of the issuing official</p></div>';
    }
    if (/residenc|proof of address/i.test(label)) {
      return '<p>Examples include a barangay certificate of residency or a recent utility bill showing the household address. Ask the relief desk which proof it accepts and what to bring if the bill is under someone else’s name.</p>';
    }
    if (/\bid\b|identification|passport|lisensiya/i.test(label)) {
      const examples = /government/i.test(label) ? 'National ID, Philippine passport, or driver’s license' : 'National ID, Philippine passport, or driver’s license. Ask if a barangay or school ID is also accepted';
      return '<p>Examples: ' + esc(examples) + '.</p>' +
        '<div class="rw-doc-sample rw-id-sample"><div aria-hidden="true">' + I('users', 22) + '</div><div>' +
          '<strong>Sample photo ID</strong><p>Full name · [Your name]<br>Valid until · [Expiry date, if shown]</p></div></div>' +
        '<p>Check that the details are readable and that the ID is still valid.</p>';
    }
    return '<p>Ask the relief desk for an example of this document and where to get it.</p>';
  }

  function reliefDocuments(docs, section) {
    return '<div class="rw-doc-list">' + docs.map((label) =>
      '<details class="rw-doc" data-relief-disclosure="' + esc(section + '|' + label) + '">' +
        '<summary>' + I('doc', 15) + '<span>' + esc(label) + '</span>' + I('chevdn', 14) + '</summary>' +
        '<div class="rw-doc-example">' + documentExample(label) +
          '<p class="rw-help">Check the schedule or call the relief desk to confirm which documents it accepts and whether to bring originals or copies.</p></div>' +
      '</details>').join('') + '</div>';
  }

  function hubCard(r) {
    const state = schedState(r.distribution_at);
    const elig = r.eligibility || [], docs = r.required_docs || [];
    const hasPos = UG_GEO.classify(r.lat, r.lng) === 'ok';
    const at = r.distribution_at ? new Date(r.distribution_at) : null;
    const ok = at && !isNaN(at);
    const where = [r.location_name, r.address].filter(Boolean).join(', ');
    /* one schedule: a date tile, what and where, when and who to call, who can
       claim and what to bring as short chips, then Navigate / Call */
    return '<article class="rw-hub rw-hub2">' +
      '<div class="rw-hub2-top">' +
        '<div class="rw-hub2-date' + (state === 'Distributing Now' ? ' is-now' : '') + '"><small>' + (ok ? esc(at.toLocaleDateString([], { month: 'short' })) : 'TBA') + '</small><b>' + (ok ? at.getDate() : '–') + '</b>' +
          (ok ? '<em>' + esc(at.toLocaleDateString([], { weekday: 'short' })) + '</em>' : '') + '</div>' +
        '<div class="rw-hub2-t"><div class="rw-hub2-tags"><span class="rw-hub-b">' + (r.barangay ? 'Brgy. ' + esc(r.barangay) : 'Municipality-wide') + '</span>' +
            '<span class="rw-hub2-s' + (state === 'Distributing Now' ? ' is-now' : '') + '"><i></i>' + esc(state) + '</span></div>' +
          '<h4>' + esc(r.title || 'Relief distribution') + '</h4>' +
          (where ? '<p class="rw-hub2-w">' + I('pin', 14) + '<span>' + esc(where) + '</span></p>' : '') + '</div>' +
      '</div>' +
      '<div class="rw-hub2-facts">' +
        '<div><span>' + I('clock', 14) + 'When</span><b>' + esc(UG_RELIEF.fmtDate(r.distribution_at) || 'To be announced') + '</b></div>' +
        (r.contact_person || r.contact_phone ? '<div><span>' + I('phone', 14) + 'Contact</span><b>' + esc([r.contact_person, r.contact_phone].filter(Boolean).join(' · ')) + '</b></div>' : '') +
      '</div>' +
      /* phone: when/contact as two icon lines */
      '<div class="rw-hub2-m">' +
        '<p>' + I('clock', 15) + '<span>' + esc(UG_RELIEF.fmtDate(r.distribution_at) || 'To be announced') + '</span></p>' +
        (r.contact_person || r.contact_phone ? '<p>' + I('phone', 15) + '<span>' + esc([r.contact_person, r.contact_phone].filter(Boolean).join(' · ')) + '</span></p>' : '') +
      '</div>' +
      (elig.length ? '<div class="rw-hub2-requirements"><p class="rw-kicker">Who can claim</p><div class="rw-chips">' + elig.map((e) => '<span>' + I('check', 12) + esc(e) + '</span>').join('') + '</div></div>' : '') +
      (docs.length ? '<div class="rw-hub2-requirements"><p class="rw-kicker">Bring these</p>' + reliefDocuments(docs, 'schedule-' + r.id) + '</div>' : '') +
      (r.note ? '<p class="rw-hub2-note">' + I('info', 14) + '<span>' + esc(r.note) + '</span></p>' : '') +
      '<div class="rw-hub-acts">' +
        (hasPos ? '<a class="rw-sbtn rw-sbtn--red" style="flex:1" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(r.lat, r.lng) + '">' + I('route', 14) + 'Navigate with Waze</a>'
          : '<span class="rw-help" style="flex:1">No map location on file for this distribution.</span>') +
        (r.contact_phone ? '<a class="rw-callbtn" href="' + telOf(r.contact_phone) + '">' + I('phone', 14) + '<span>Call</span></a>' : '') +
      '</div>' +
    '</article>';
  }
  function hubsFor(st) {
    const mine = String((st.session && st.session.barangay) || '').toLowerCase();
    return (U.DATA.relief || []).filter((r) => r.active !== false)
      .filter((r) => !r.barangay || !mine || String(r.barangay).toLowerCase() === mine);
  }
  function relief(st) {
    const hubs = hubsFor(st);
    const min = !!st.rwReliefMin;
    const tab = st.rwCriteria || 'all';
    const uniq = (a) => Array.from(new Set(a));
    const elig = uniq(hubs.reduce((a, h) => a.concat(h.eligibility || []), []));
    const docs = uniq(hubs.reduce((a, h) => a.concat(h.required_docs || []), []));
    const seg = (v, label) => '<button class="' + (tab === v ? 'is-on' : '') + '"' + A('rw-set', attr({ k: 'rwCriteria', v: v })) + '>' + label + '</button>';
    return '<div class="ug-col rw-relief" style="gap:32px">' +
      UG_RELIEF.savedScheduleNote() +
      '<section class="rw-card rw-relief-main">' +
        '<div class="rw-card-h"><div class="rw-iconhead"><span class="rw-ico">' + I('relief', 20) + '</span><div><h3>Relief Distribution Schedules</h3>' +
            '<p class="rw-hint" style="margin:2px 0 0">' + hubs.length + ' active for your barangay · where and when to claim relief</p></div></div>' +
          '<div class="rw-acts" style="gap:12px">' +
            '<button class="rw-btn rw-btn--line" style="padding:8px 16px"' + A('rw-relief-all') + '>' + I('layers', 14) + 'View all schedules</button>' +
          '</div></div>' +
        '<div class="rw-relief-mh"><div><h3>Relief schedules</h3><p>' + hubs.length + ' active for ' + (st.session && st.session.barangay ? 'Brgy. ' + esc(st.session.barangay) : 'your barangay') + '</p></div>' +
          '<button class="rw-relief-all"' + A('rw-relief-all') + '>View all</button></div>' +
        (min
          ? '<div class="rw-minbar"><span>Relief schedules minimized (' + hubs.length + ' distribution ' + (hubs.length === 1 ? 'hub' : 'hubs') + ' active for your barangay)</span>' +
              '<button class="rw-linkbtn"' + A('rw-set', attr({ k: 'rwReliefMin', v: '' })) + '>Expand to View Cards</button></div>'
          : '<div class="rw-card-b">' + (hubs.length
              ? '<div class="rw-grid ' + (hubs.length > 1 ? 'rw-grid--2' : '') + '">' + hubs.map(hubCard).join('') + '</div>'
              : '<div class="rw-zero"><span class="rw-zero-ico">' + I('info', 28) + '</span><h3>No relief distribution scheduled for your barangay yet</h3>' +
                  '<p>New schedules appear here and in your notifications. Your barangay desk can tell you about pending distributions.</p></div>') + '</div>') +
      '</section>' +

      '<div class="ug-col rw-rules-wrap" style="gap:16px">' +
        '<div class="rw-rules-h"><div class="rw-iconhead" style="gap:10px"><span class="rw-ico rw-ico--sm">' + I('users', 16) + '</span><h3 class="rw-caps">Claiming Rules &amp; Guidelines</h3></div>' +
          '<div class="rw-seg2">' + seg('all', 'All Requirements') + seg('eligibility', 'Eligibility') + seg('documents', 'Documents') + '</div></div>' +
        '<div class="rw-grid ' + (tab === 'all' ? 'rw-grid--2' : '') + '" style="gap:24px">' +
          (tab !== 'documents' ? '<section class="rw-rule"><div class="rw-iconhead rw-rule-h"><span class="rw-ico">' + I('users', 20) + '</span><div><h4>Eligibility &amp; Allocation Criteria</h4><p>Lingayen MSWDO Calamity Guidelines</p></div></div>' +
            '<ul class="rw-ticks rw-ticks--lg">' + (elig.length ? elig.map((e) => '<li>' + I('check', 16) + '<span>' + esc(e) + '</span></li>').join('')
              : '<li class="rw-none">No eligibility criteria published for this barangay yet.</li>') + '</ul></section>' : '') +
          (tab !== 'eligibility' ? '<section class="rw-rule"><div class="rw-iconhead rw-rule-h"><span class="rw-ico rw-ico--grey">' + I('doc', 20) + '</span><div><h4>Required Documents for Claiming</h4><p>Open a document to see an example.</p></div></div>' +
            (docs.length ? reliefDocuments(docs, 'guide') : '<p class="rw-none">No required documents published for this barangay yet.</p>') + '</section>' : '') +
        '</div>' +
      '</div>' +

      '<details class="rw-details" data-relief-disclosure="representative"><summary>' + I('info', 20) + '<span>Claiming for someone else?</span>' + I('chevdn', 16) + '</summary>' +
        '<div><p>Ask the relief desk if representatives can claim for this schedule and how to register. Open the documents below to see what to prepare.</p>' +
          reliefDocuments(['Signed authorization letter from the beneficiary', 'Your valid ID'], 'representative') + '</div></details>' +
    '</div>';
  }
  function reliefAllModal(st) {
    const hubs = hubsFor(st);
    UG_FEATURES.modal({
      title: 'Available Relief Distribution Schedules',
      body: '<div class="ug-rw rw-modal-body"><p class="rw-hint" style="margin:0 0 14px">Every schedule for your barangay and the municipality</p>' +
        UG_RELIEF.savedScheduleNote() +
        (hubs.length ? '<div class="rw-grid rw-grid--2">' + hubs.map(hubCard).join('') + '</div>' : '<p class="rw-hint">No active distributions right now.</p>') +
        '</div>',
      footer: '<button class="ug-btn" data-modal-close>Close</button>'
    });
  }

  function reliefDetailModal(st, id) {
    const schedule = hubsFor(st).find((row) => String(row.id) === id);
    if (!schedule) return false;
    UG_FEATURES.modal({
      title: 'Relief schedule',
      body: '<div class="ug-rw rw-modal-body">' + UG_RELIEF.savedScheduleNote() + hubCard(schedule) + '</div>',
      footer: '<button class="ug-btn" data-modal-close>Close</button>'
    });
    return true;
  }

  /* ================================================================ guides */
  function guides(st) {
    const hazard = st.guideHazard || UG_HAZARDS.LIST[0].label;
    const phase = st.guidePhase || 'before';
    const P = UG_GUIDES.phaseLabel(phase);
    const list = UG_GUIDES.guidesFor(U.DATA.guides, hazard, phase);
    const q = (st.rwGuideQ || '').toLowerCase().trim();
    const all = UG_GUIDES.guideHazards();
    const hazards = all.filter((h) => !q || h.toLowerCase().indexOf(q) !== -1);
    const iconOf = (label) => { const h = UG_HAZARDS.LIST.find((x) => x.label === label); return h ? h.icon : 'guide'; };
    const has = (h, p) => UG_GUIDES.guidesFor(U.DATA.guides, h, p).length > 0;
    const PH = { before: ['Before', 'Get ready'], during: ['During', 'Stay safe'], after: ['After', 'Recover'] };
    /* Layout (Nov 2026): a light intro, hazards as icon chips you can scroll
       and search, soft Before / During / After tabs, then the guide as one
       clean card of numbered steps. Same data, actions and PDFs. */
    return '<div class="ug-col rg" style="gap:20px">' +
      '<section class="rg-intro"><div><h3>Know what to do</h3><p>Pick a hazard, then read what to do before, during and after it. Save a guide as a PDF to read without signal.</p></div>' +
        '<div class="rg-intro-a"><button class="rw-pdf"' + A('guide-download', attr({ hazard: hazard })) + ' title="Save this guide as a PDF to read offline">' + I('download', 14) + 'This guide</button>' +
          '<button class="rw-pdf"' + A('guide-download', attr({ hazard: 'all' })) + ' title="Save every guide as one PDF">' + I('doc', 14) + 'All guides</button></div></section>' +

      /* the hazard picker is a dropdown: the current hazard with its icon;
         open it to search and pick (toggle-more opens, a tap outside closes) */
      '<section class="rg-pick"><h4>Choose a hazard</h4>' +
        '<div class="ug-wmore rg-dd">' +
          '<button class="rg-dd-btn"' + A('toggle-more') + ' aria-haspopup="listbox"><span class="rg-dd-i">' + I(iconOf(hazard), 16) + '</span>' +
            '<span class="rg-dd-v"><b>' + esc(hazard) + '</b><small>' + UG_GUIDES.PHASES.filter((p) => has(hazard, p)).length + ' of 3 phases written</small></span>' + I('chevdn', 16) + '</button>' +
          '<div class="rg-dd-panel" data-more-panel' + (st.rwGuideQ ? '' : ' hidden') + '>' +
            '<div class="rg-find">' + I('search', 14) + '<input data-field="rw.rwGuideQ" placeholder="Find a hazard" value="' + esc(st.rwGuideQ || '') + '" aria-label="Find a hazard"></div>' +
            '<div class="rg-dd-list" role="listbox">' + (hazards.length ? hazards.map((h) =>
              '<button role="option" aria-selected="' + (h === hazard) + '" class="' + (h === hazard ? 'is-on' : '') + '"' + A('rw-guide-pick', attr({ v: h })) + '>' +
                '<span class="rg-dd-i">' + I(iconOf(h), 15) + '</span><span>' + esc(h) + '</span>' + (h === hazard ? I('check', 14) : '') + '</button>').join('')
              : '<p class="rw-hint" style="padding:10px 12px;margin:0">No hazard matches.</p>') + '</div>' +
          '</div></div>' +
        '<button class="rg-pdf-ico"' + A('guide-download', attr({ hazard: hazard })) + ' title="Save this guide as a PDF" aria-label="Save this guide as a PDF">' + I('download', 18) + '</button>' +
      '</section>' +

      '<div class="rg-phases" role="tablist" aria-label="Phase">' + UG_GUIDES.PHASES.map((p) =>
        '<button role="tab" aria-selected="' + (p === phase) + '" class="' + (p === phase ? 'is-on' : '') + '"' + A('guide-phase', attr({ v: p })) + '>' +
          '<b>' + PH[p][0] + '</b><small>' + PH[p][1] + '</small>' + (has(hazard, p) ? '' : '<em>soon</em>') + '</button>').join('') + '</div>' +

      '<section class="rg-card">' +
        '<header class="rg-card-h"><span class="rg-card-i">' + I(iconOf(hazard), 20) + '</span>' +
          '<div><p>' + esc(PH[phase][1]) + ' · ' + P + ' a ' + esc(hazard.toLowerCase()) + '</p><h3>' + esc(hazard) + '</h3></div></header>' +
        (list.length ? list.map((g) => {
          const raw = UG_GUIDES.phaseText(g, phase);
          const body = UG_GUIDES.contentHtml(raw);
          /* phone: a guide written as one paragraph reads as short steps,
             one sentence each, so it is easy to scan */
          /* every format (numbered steps, bullets, paragraphs) becomes the
             same list of short items; paragraphs split one sentence each */
          const sentences = (t) => {
            /* break after . ! ? when the next word starts a new sentence;
               keeps "3.5", "e.g." and "Brgy. Poblacion" whole */
            const words = String(t || '').replace(/\s+/g, ' ').trim().split(' ');
            const out = []; let cur = [];
            words.forEach((w, k) => {
              cur.push(w);
              const next = words[k + 1];
              const ends = /[.!?]["”)]?$/.test(w) && !/^(e\.g|i\.e|etc|brgy|st|no|mr|mrs|ms|dr|vs)\.$/i.test(w.replace(/["”)]$/, '')) && !/^[A-Z]\.$/.test(w);
              if (ends && next && /^["“(]?[A-Z0-9]/.test(next)) { out.push(cur.join(' ')); cur = []; }
            });
            if (cur.length) out.push(cur.join(' '));
            return out.filter(Boolean);
          };
          /* ALL-CAPS lines read as shouting: show them in sentence case */
          const calm = (t) => /[A-Z]/.test(t) && t === t.toUpperCase()
            ? t.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (m, p1, c) => p1 + c.toUpperCase()).replace(/\b(lingayen|uniguard|ldrrmo|mdrrmo|pagasa|phivolcs|brgy)\b/gi, (w) => /ldrrmo|mdrrmo|pagasa|phivolcs/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
            : t;
          const intro = [], items = [];
          let stepped = false;
          UG_GUIDES.parseSteps(raw).blocks.forEach((b) => {
            if (b.type === 'step') stepped = true;
            /* the lines before the first step are the lead-in, not steps */
            if (b.type !== 'step' && !stepped && UG_GUIDES.parseSteps(raw).steps.length) { intro.push(calm(String(b.text).replace(/\s+/g, ' ').trim())); return; }
            sentences(calm(b.text)).forEach((x) => items.push(x));
          });
          /* "Know your flood risk: low-lying ..." → bold lead, quieter rest */
          const item = (x, n) => {
            const m = x.match(/^([^:]{3,48}):\s+(.+)$/);
            return '<li><em>' + String(n + 1).padStart(2, '0') + '</em><div>' +
              (m ? '<b>' + esc(m[1]) + '</b><span>' + esc(m[2].charAt(0).toUpperCase() + m[2].slice(1)) + '</span>' : '<b class="solo">' + esc(x) + '</b>') + '</div></li>';
          };
          const FIRST = 4;
          const easy = body && items.length
            ? '<div class="rg-steps2"><div class="rg-steps2-h"><b>What to do</b><span>' + items.length + ' step' + (items.length === 1 ? '' : 's') + '</span></div>' +
              '<ol class="rg-easy">' + items.slice(0, FIRST).map((x, n) => item(x, n)).join('') + '</ol>' +
              (items.length > FIRST ? '<details class="rg-moresteps"><summary><span class="m">Show ' + (items.length - FIRST) + ' more step' + (items.length - FIRST === 1 ? '' : 's') + '</span><span class="l">Show fewer</span>' + I('chevdn', 14) + '</summary>' +
                '<ol class="rg-easy">' + items.slice(FIRST).map((x, n) => item(x, n + FIRST)).join('') + '</ol></details>' : '') + '</div>'
            : '';
          return '<article class="rg-guide' + (easy ? ' has-easy' : '') + '"><h4>' + esc(g.title) + '</h4>' + (g.summary ? '<p class="rg-sum">' + esc(g.summary) + '</p>' : '') +
            '<div class="rg-body">' + (body || '<p class="rw-hint">No steps written for this phase yet.</p>') + '</div>' + easy + '</article>';
        }).join('')
          : '<div class="rg-empty">' + I('guide', 28) + '<b>No ' + P.toLowerCase() + ' guide for ' + esc(hazard) + ' yet</b><p>Your LGU is still writing it. Try another phase or hazard.</p></div>') +
      '</section>' +
      '<button class="rg-all-pdf"' + A('guide-download', attr({ hazard: 'all' })) + '>' + I('doc', 14) + 'Download all guides (PDF)</button>' +
    '</div>';
  }

  /* ================================================================== faqs */
  function faqs(st) {
    const all = (U.DATA.faqs || []).filter((f) => f.active !== false);
    const raw = (st.faqSearch || '').trim();
    const q = raw.toLowerCase();
    const cat = st.rwFaqCat || 'All';
    const match = (f) => !q || (f.question + ' ' + f.answer + ' ' + f.category).toLowerCase().indexOf(q) !== -1;
    const names = Array.from(new Set(all.map((f) => f.category || 'General'))).sort();
    const searched = all.filter(match);
    const list = searched.filter((f) => cat === 'All' || (f.category || 'General') === cat);
    const groups = {};
    list.forEach((f) => { const c = f.category || 'General'; (groups[c] = groups[c] || []).push(f); });
    const open = st.rwFaqOpen || {};
    const isOpen = (f) => open[f.id] === true || (open[f.id] !== false && !!q && f.answer.toLowerCase().indexOf(q) !== -1);
    const mark = (text) => {
      const t = esc(text);
      if (!q) return t;
      const re = new RegExp('(' + esc(raw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return t.replace(re, '<mark>$1</mark>');
    };
    const hot = mdrrmo();
    return '<div class="ug-col rw-faqp" style="gap:32px">' +
      '<section class="rw-gbox ug-col" style="gap:12px">' +
        '<div class="rw-fsearch">' +
          '<div class="rw-fs">' + I('search', 16) + '<input type="search" data-field="faqSearch" placeholder="Search FAQs..." aria-label="Search FAQs" value="' + esc(raw) + '"></div>' +
          '<div class="rw-fc' + (cat !== 'All' ? ' is-on' : '') + '">' + I('layers', 16) +
            '<select data-field="rw.rwFaqCat" aria-label="FAQ categories">' + [['All', searched.length]].concat(names.map((n) => [n, searched.filter((f) => (f.category || 'General') === n).length])).map((c) =>
              '<option value="' + esc(c[0]) + '"' + (cat === c[0] ? ' selected' : '') + '>' + esc(c[0] === 'All' ? 'All topics' : c[0]) + ' (' + c[1] + ')</option>').join('') + '</select>' + I('chevdn', 16) + '</div>' +
        '</div>' +
        (q || cat !== 'All' ? '<div class="rw-fstat"><span role="status">' + list.length + (list.length === 1 ? ' answer' : ' answers') +
            (q ? ' for <strong>“' + esc(raw) + '”</strong>' : '') + (cat !== 'All' ? ' in <strong>' + esc(cat) + '</strong>' : '') + '</span>' +
          '<button class="rw-linkbtn"' + A('rw-faq-clear') + '>Clear</button></div>' : '') +
      '</section>' +
      (list.length
        ? '<div class="ug-col" style="gap:16px">' + Object.keys(groups).sort().map((c) =>
          '<section class="rw-fgroup"><div class="rw-fgroup-h"><h3>' + esc(c) + '</h3><span>' + groups[c].length + '</span></div><ul>' + groups[c].map((f) => {
            const o = isOpen(f);
            return '<li><button class="rw-fq' + (o ? ' is-open' : '') + '" aria-expanded="' + o + '"' + A('rw-faq', attr({ id: f.id, open: o ? '1' : '' })) + '><i>+</i><span>' + mark(f.question) + '</span>' + I('chevdn', 16) + '</button>' +
              (o ? '<div class="rw-fa">' + mark(f.answer) + '</div>' : '') + '</li>';
          }).join('') + '</ul></section>').join('') + '</div>'
        : '<section class="rw-gbox rw-zero" style="padding:48px"><span class="rw-zero-ico" style="background:#fff">' + I('help', 28) + '</span>' +
            '<h3>' + (all.length ? 'No answers match' : 'No FAQs yet') + '</h3>' +
            '<p>' + (all.length ? 'Try another word, pick a different category, or call the LDRRMO desk below.' : 'The LGU has not published any FAQs yet.') + '</p>' +
            (all.length ? '<button class="rw-btn rw-btn--dark"' + A('rw-faq-clear') + '>Show all questions</button>' : '') + '</section>') +
      '<section class="rw-support"><div><p class="rw-support-t">Still have questions or need immediate assistance?</p>' +
          '<p>The Lingayen LDRRMO emergency hotline desk is open 24/7 for resident inquiries.</p></div>' +
        '<a href="' + telOf(hot) + '">Call LDRRMO ' + esc(hot) + '</a></section>' +
    '</div>';
  }

  /* =================================================================== map */
  /* colours and words come from the map's own pins (js/map.js), so the
     pills, the list and the legend always match the markers */
  const LAYERS = [['hazards', 'Hazards', '#B91C1C'], ['centers', 'Shelters', '#15803D'], ['relief', 'Relief', '#6D28D9'], ['roadStatus', 'Road status', '#B45309']];
  const SEV_RANK = { emergency: 0, warning: 1, advisory: 2, prepared: 3 };

  function mapPlaces(st) {
    const L = st.mapLayers || {};
    const me = st.rwMe;
    const out = [];
    const push = (o) => {
      o.mapped = UG_GEO.classify(o.lat, o.lng) === 'ok';
      o.dist = o.mapped && me ? UG_UTIL.distanceM(me.lat, me.lng, o.lat, o.lng) : null;
      out.push(o);
    };
    const brgy = (n) => n ? 'Brgy. ' + n : '';
    if (L.hazards) (U.DATA.incidents || []).filter((i) => i.status !== 'resolved' && i.status !== 'rejected').forEach((i) => {
      const lv = MapView.PIN_LEVEL[i.sev] || MapView.PIN_LEVEL.advisory;
      push({ action: 'open-incident', id: i.uuid || i.id, lat: i.lat, lng: i.lng, icon: 'hazard', color: lv.color, title: i.hazard,
        detail: [lv.word + ' danger', MapView.REPORT_STATUS[i.status] || i.status, brgy(i.brgy)].filter(Boolean).join(' · '),
        rank: SEV_RANK[i.sev] != null ? SEV_RANK[i.sev] : 3 });
    });
    if (L.roadStatus) (U.DATA.roadStatus || []).filter((r) => r.status && r.status !== 'passable').forEach((r) => {
      const rd = MapView.PIN_ROAD[r.status] || MapView.PIN_ROAD.under_repair;
      push({ action: 'open-road-detail', id: r.id, lat: r.lat, lng: r.lng, icon: rd.icon, color: rd.color, title: r.road_name || 'Road',
        detail: [rd.word, brgy(r.barangay)].filter(Boolean).join(' · '), rank: r.status === 'blocked' ? 3 : 4 });
    });
    if (L.centers) (U.DATA.centers || []).forEach((c) => {
      const sh = MapView.PIN_SHELTER[c.status] || MapView.PIN_SHELTER.closed;
      const left = Math.max(0, (c.cap || 0) - (c.occ || 0));
      push({ action: 'open-center-detail', id: c.uuid || c.id, lat: c.lat, lng: c.lng, icon: 'shelter', color: sh.color, title: c.name,
        detail: [sh.word, c.status === 'open' ? left + ' of ' + c.cap + ' spaces left' : '', brgy(c.brgy)].filter(Boolean).join(' · '),
        rank: c.status === 'open' ? 5 : 6 });
    });
    if (L.relief) (U.DATA.relief || []).filter((r) => r.active !== false).forEach((r) =>
      push({ action: 'rw-relief-detail', id: r.id, lat: r.lat, lng: r.lng, icon: 'relief', color: MapView.PIN_RELIEF, title: r.title || 'Relief distribution',
        detail: [r.location_name, r.distribution_at ? UG_RELIEF.fmtDate(r.distribution_at) : ''].filter(Boolean).join(' · '), rank: 7 }));
    out.sort((a, b) => {
      if (me && a.mapped !== b.mapped) return a.mapped ? -1 : 1;
      return a.dist != null && b.dist != null ? a.dist - b.dist || a.rank - b.rank : a.rank - b.rank;
    });
    return out;
  }
  function counts() {
    return {
      hazards: (U.DATA.incidents || []).filter((i) => i.status !== 'resolved' && i.status !== 'rejected').length,
      relief: (U.DATA.relief || []).filter((r) => r.active !== false).length,
      centers: (U.DATA.centers || []).length,
      roadStatus: (U.DATA.roadStatus || []).filter((r) => r.status && r.status !== 'passable').length
    };
  }
  function map(st) {
    const L = st.mapLayers || {};
    const n = counts();
    const allOn = LAYERS.every((l) => L[l[0]]);
    const places = mapPlaces(st);
    const PREVIEW = 6;
    /* the legend draws the very pin the map uses */
    const legendRow = (icon, color, size, label, text) => '<li><span class="rw-lg-pin">' + MapView.pinHtml(icon, color, size) + '</span><span><b>' + esc(label) + '</b><small>' + esc(text) + '</small></span></li>';
    const lvl = MapView.PIN_LEVEL, shl = MapView.PIN_SHELTER, rd = MapView.PIN_ROAD;
    return '<div class="ug-col rw-mapp" style="gap:20px">' +
      '<p class="rw-lead-p">See dangers, shelters, relief and road closures near you. Tap a marker to learn more, or use the list below the map.</p>' +
      /* phone: layers as a dropdown of checkboxes (stays open while toggling;
         the map updates in place) */
      (() => {
        const on = LAYERS.filter((l) => L[l[0]]).length;
        return '<div class="rw-map-bar"><div class="ug-wmore rw-shdd rw-lay-dd">' +
          '<button class="rw-shdd-btn"' + A('toggle-more') + ' aria-haspopup="true" aria-label="Map layers"><b data-lay-sum>' +
            (on === LAYERS.length ? 'All' : on + ' of ' + LAYERS.length) + '</b>' + I('chevdn', 14) + '</button>' +
          '<div class="rw-shdd-panel" data-more-panel hidden role="group" aria-label="Map layers">' + LAYERS.map((l) =>
            '<button class="rw-lay-opt' + (L[l[0]] ? ' is-on' : '') + '" style="--c:' + l[2] + '" aria-pressed="' + !!L[l[0]] + '" data-act="map-layer-toggle" data-layer="' + l[0] + '">' +
              '<i></i><span>' + l[1] + '</span><b>' + n[l[0]] + '</b><em>' + I('check', 12) + '</em></button>').join('') +
          '</div></div></div>';
      })() +
      '<div class="rw-lay-row"><div class="rw-seg" role="group" aria-label="Map layers">' + LAYERS.map((l) =>
          '<button class="rw-lay' + (L[l[0]] ? ' is-on' : '') + '" style="--c:' + l[2] + '" aria-pressed="' + !!L[l[0]] + '" data-act="map-layer-toggle" data-layer="' + l[0] + '">' +
            '<i></i><span>' + l[1] + '</span><b>' + n[l[0]] + '</b></button>').join('') + '</div>' +
        (allOn ? '' : '<button class="rw-linkbtn" style="color:#525252"' + A('rw-map-all') + '>Show all</button>') + '</div>' +
      '<div class="rw-mapbox">' +
        '<div class="ug-map" data-map="live" data-toggles="inline" data-centers="1">' + U.mapSVG({ animated: true }) + '</div>' +
        '<div class="rw-zoom"><button' + A('rw-map-zoom', attr({ d: '1' })) + ' aria-label="Zoom in">' + I('plus', 20) + '</button>' +
          '<button' + A('rw-map-zoom', attr({ d: '-1' })) + ' aria-label="Zoom out"><span style="font-size:20px;line-height:1">−</span></button></div>' +
        '<button class="rw-locate"' + A('rw-map-locate') + '>' + I('target', 16) + (st.rwLocating ? 'Finding you…' : st.rwMe ? 'Update my location' : 'Show my location') + '</button>' +
      '</div>' +
      '<div class="rw-map-grid">' +
        '<section class="rw-panel rw-panel--flush"><div class="rw-ph"><div><h3 style="display:flex;align-items:center;gap:10px">Hazards and places <span class="rw-cnt-red rw-mono">' + places.length + '</span></h3>' +
            '<p>' + (st.rwMe ? 'Sorted by distance when a location is available.' : 'Most urgent first. Show your location to sort by distance.') + ' Select any entry for details.</p></div></div>' +
          (places.length
            ? '<ul class="rw-places" id="rw-places" data-rw-places>' + places.map((p, k) =>
                '<li' + (k >= PREVIEW ? ' class="rw-more"' + (st.rwPlacesExpanded ? '' : ' hidden') : '') + '><button type="button"' + A(p.action, attr({ id: p.id })) + '>' +
                  '<span class="rw-pl-ico rw-lg-pin">' + MapView.pinHtml(p.icon, p.color, 24) + '</span>' +
                  '<span class="rw-pl-t"><b>' + esc(p.title) + '</b><small>' + esc([p.detail, p.mapped ? '' : 'Location not pinned'].filter(Boolean).join(' · ')) + '</small></span>' +
                  (p.dist != null ? '<span class="rw-pl-d rw-mono">' + esc(UG_UTIL.fmtDistance(p.dist)) + '</span>' : '') +
                  '<span class="rw-pl-pin" aria-hidden="true">' + I('chevron', 16) + '</span></button></li>').join('') + '</ul>' +
              (places.length > PREVIEW ? '<button class="rw-showall"' + A('rw-places-all') + ' aria-controls="rw-places" aria-expanded="' + !!st.rwPlacesExpanded + '" data-more="Show all (' + places.length + ')" data-less="Show fewer">' + (st.rwPlacesExpanded ? 'Show fewer' : 'Show all (' + places.length + ')') + '</button>' : '')
            : '<div class="rw-zero" style="padding:40px 24px">' + I('pin', 32) + '<p>' + (allOn ? 'Nothing to show right now. No open hazards, closures, shelters or relief points.' : 'Nothing to show. Turn on more items above.') + '</p></div>') +
        '</section>' +
        '<section class="rw-panel rw-panel--flush rw-legend' + (st.rwLegendClosed ? '' : ' is-open') + '">' +
          '<button class="rw-legend-h"' + A('rw-legend') + '><span><h3>What the markers mean</h3><small>Each pin has its own symbol. Tap a pin for details.</small></span>' +
            '<span class="rw-legend-c">' + I('chevdn', 16) + '</span></button>' +
          '<div class="rw-legend-b">' +
            '<div><p class="rw-kicker">Hazards</p><ul>' + ['emergency', 'warning', 'advisory'].map((k) =>
              legendRow('hazard', lvl[k].color, lvl[k].size, lvl[k].word + ' danger', lvl[k].meaning)).join('') + '</ul></div>' +
            '<div><p class="rw-kicker">Shelters</p><ul>' + ['open', 'full', 'closed'].map((k) =>
              legendRow('shelter', shl[k].color, MapView.PIN_SIZE, shl[k].word, shl[k].meaning)).join('') + '</ul></div>' +
            '<div><p class="rw-kicker">Relief and roads</p><ul>' + legendRow('relief', MapView.PIN_RELIEF, MapView.PIN_SIZE, 'Relief', 'Food and supplies are handed out here.') +
              legendRow(rd.blocked.icon, rd.blocked.color, MapView.PIN_SIZE, rd.blocked.word, rd.blocked.meaning) +
              legendRow(rd.one_lane.icon, rd.one_lane.color, MapView.PIN_SIZE, rd.one_lane.word, rd.one_lane.meaning) + '</ul></div>' +
            '<div><p class="rw-kicker">Groups and you</p><ul>' +
              '<li><span class="rw-lg-pin"><div class="ug-cluster rw-lg-cluster"><span class="n">3</span><span class="dots" aria-hidden="true"><i style="background:' + lvl.emergency.color + '"></i><i style="background:' + shl.open.color + '"></i><i style="background:' + MapView.PIN_RELIEF + '"></i></span></div></span>' +
                '<span><b>Several markers close together</b><small>The number is how many. The dots show what kinds. Tap it to zoom in.</small></span></li>' +
              '<li><span class="rw-lg-me"></span><span><b>Your location</b><small>Shows after you tap "Show my location".</small></span></li></ul></div>' +
          '</div></section>' +
      '</div>' +
    '</div>';
  }

  /* ============================================================== settings */
  function settings(st) {
    const tabs = [['notifications', 'Alerts', 'bell'], ['offline', 'Offline & Sync', 'wave'], ['language', 'Language', 'flag']];
    let tab = st.settingsTab;
    if (!tabs.some((t) => t[0] === tab)) tab = 'notifications';
    const pill = (state) => {
      const P = { on: ['On', 'rw-st--ok'], off: ['Off', ''], blocked: ['Blocked', 'rw-st--warn'], unsupported: ['Not supported', ''] }[state] || ['…', ''];
      return '<span class="rw-st ' + P[1] + '"><i></i>' + P[0] + '</span>';
    };
    let body = '';
    if (tab === 'notifications') {
      const status = (UG_SETTINGS.alertsStatus || (() => 'unsupported'))();
      try { UG_SETTINGS.refreshPushState(); } catch (e) { }
      const muted = typeof UG_ALARM !== 'undefined' && UG_ALARM.muted();
      const ra = (typeof UG_ALARM !== 'undefined') ? UG_ALARM.roleAlarms('citizen') : { events: [] };
      body = '<section class="rw-panel rw-panel--flush">' + panelHead('Alerts on this device', 'Get warnings and evacuation notices even when UniGuard is closed.', pill(status)) +
          '<div class="rw-pb ug-col" style="gap:16px">' +
            (status === 'on' ? '<p class="rw-okline">' + I('check', 16) + 'You will get alerts on this device.</p>'
              : status === 'unsupported' ? '<p class="rw-p">This browser cannot show alerts. Alerts still appear inside the app.</p>'
              : status === 'blocked' ? '<p class="rw-p" style="color:#78350F">Alerts are blocked. Allow notifications for this site in your browser settings and they turn on by themselves.</p>'
              : '<p class="rw-p">Alerts turn on by themselves. Tap <b>Allow</b> when your browser asks.</p>') +
            '<p class="rw-fine">' + I('info', 14) + 'Emergency alerts may also be sent by text message to your registered mobile number.</p>' +
          '</div></section>' +
        '<section class="rw-panel rw-panel--flush">' + panelHead('Alarm sound', 'A loud alarm when help is sent to your report or SOS, and for emergency alerts.', '<span class="rw-st rw-st--ok"><i></i>Always on</span>') +
          '<div class="rw-pb ug-col" style="gap:16px">' +
            '<div class="rw-toggle-row"><span><b>The alarm always sounds on this device</b><small>Each hazard has its own alarm. Keep the volume up during typhoon season.</small></span></div>' +
            '<div><p class="rw-kicker">This portal rings for</p><ul class="rw-ticks">' + ra.events.map((e) => '<li>' + I('check', 14) + '<span>' + esc(e) + '</span></li>').join('') + '</ul></div>' +
            '<button class="rw-pbtn rw-pbtn--line rw-pbtn--auto"' + A('alarm-test') + '>' + I('bell', 16) + 'Test alarm</button>' +
          '</div></section>';
    } else if (tab === 'offline') {
      const online = navigator.onLine !== false && !st.offline;
      const cache = U.DATA.offlineCache || {};
      const rows = [['clock', 'Last updated', cache.synced || 'Not yet'], ['inbox', 'Reports waiting to send', String(UG.DATA.queueCount || 0)],
        ['download', 'Works without internet', ('serviceWorker' in navigator) ? 'Yes' : 'No'], ['settings', 'App version', (UG_CONFIG && UG_CONFIG.BUILD) || 'dev']];
      body = '<section class="rw-panel rw-panel--flush">' + panelHead('Offline & Sync', 'UniGuard keeps the essentials on your device so they still open without a signal.',
            '<span class="rw-st ' + (online ? 'rw-st--ok' : '') + '">' + I(online ? 'wave' : 'wifioff', 12) + (online ? 'Online' : 'Offline') + '</span>') +
          '<ul class="rw-kvlist">' + rows.map((r) => '<li><span>' + I(r[0], 16) + esc(r[1]) + '</span><b class="rw-mono">' + esc(r[2]) + '</b></li>').join('') + '</ul>' +
          '<div class="rw-pb rw-pb--top"><div class="rw-row-acts">' +
            '<button class="rw-pbtn rw-pbtn--red rw-pbtn--auto"' + A('refresh-data') + '>' + I('wave', 16) + 'Sync now</button>' +
            '<button class="rw-pbtn rw-pbtn--line rw-pbtn--auto"' + A('save-center-offline', attr({ id: 'hotlines' })) + '>' + I('download', 16) + 'Save for offline</button></div>' +
            (UG.DATA.queueCount ? '<button class="rw-linkbtn" style="margin-top:10px;color:#171717"' + A('nav', attr({ route: 'offline' })) + '>See the reports waiting to send</button>' : '') +
          '</div></section>' +
        '<section class="rw-panel"><div class="rw-trouble"><div><h3>Something not loading?</h3><p>Reload the app to get the latest version. Reports waiting to send are kept.</p></div>' +
          '<button class="rw-pbtn rw-pbtn--line rw-pbtn--auto"' + A('force-refresh') + '>' + I('wave', 16) + 'Reload app</button></div></section>';
    } else {
      const cur = (typeof UG_I18N !== 'undefined' ? UG_I18N.getLang() : 'en');
      body = '<section class="rw-panel rw-panel--flush">' + panelHead('Language', 'Changes every screen right away. Saved on this device.') +
        '<div class="rw-pb ug-col" style="gap:16px"><div class="rw-langs" role="radiogroup" aria-label="Language">' +
          [['en', 'EN', 'English', 'Use UniGuard in English'], ['fil', 'FIL', 'Filipino', 'Gamitin ang UniGuard sa Filipino']].map((l) =>
            '<button role="radio" aria-checked="' + (cur === l[0]) + '" class="rw-lang' + (cur === l[0] ? ' is-on' : '') + '"' + A('lang-ui', attr({ v: l[0] })) + '>' +
              '<i class="rw-mono">' + l[1] + '</i><span><b>' + l[2] + '</b><small>' + l[3] + '</small></span>' + (cur === l[0] ? I('check', 16) : '') + '</button>').join('') + '</div>' +
          '<p class="rw-fine">' + I('info', 14) + 'Official advisories appear in the language the LDRRMO wrote them in.</p></div></section>';
    }
    /* Layout (Nov 2026): big soft tabs with a hint, then the section's cards
       side by side on wide screens */
    const HINT = { notifications: 'Warnings and the alarm', offline: 'Use without signal', language: 'English or Filipino' };
    return '<div class="ug-col rs" style="gap:20px">' +
      lead('Alerts, language and offline use on this device.') +
      '<div class="rg-phases rs-tabs" role="tablist">' + tabs.map((t) =>
        '<button class="' + (tab === t[0] ? 'is-on' : '') + '" role="tab" aria-selected="' + (tab === t[0]) + '"' + A('settings-tab', attr({ v: t[0] })) + '>' +
          '<b>' + I(t[2], 15) + t[1] + '</b><small>' + HINT[t[0]] + '</small></button>').join('') + '</div>' +
      '<div class="rs-grid">' + body + '</div>' +
    '</div>';
  }

  /* =============================================================== offline */
  function offline(st) {
    const online = navigator.onLine !== false && !st.offline;
    const cache = U.DATA.offlineCache || {};
    const queued = U.DATA.queuedReports || [];
    const ua = navigator.userAgent || '';
    const device = /iphone|ipad/i.test(ua) ? 'iPhone or iPad' : /android/i.test(ua) ? 'Android phone' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows computer' : 'this device';
    return '<div class="ug-col rw-offp" style="gap:28px">' +
      lead('Progressive web app caching keeps the essentials available when networks fail.') +
      /* phone: one compact status line instead of the big hero */
      '<section class="rw-off-st' + (online ? '' : ' is-off') + '"><i></i><div><b>' + (online ? 'Offline copy ready' : 'You are offline') + '</b>' +
        '<span>' + (online ? 'Hotlines, shelters and advisories open without signal.' : 'Showing what was saved on this device.') + '</span></div>' +
        '<button' + A('reconnect') + '>' + (online ? 'Check' : 'Retry') + '</button></section>' +
      '<div class="rw-off-grid">' +
        '<section class="rw-panel rw-off-hero"><i class="tl"></i><i class="br"></i>' +
          '<span class="rw-off-ico">' + I(online ? 'download' : 'wifioff', 28) + '</span>' +
          '<h3>' + (online ? 'Offline Copy Ready' : 'You Are Offline') + '</h3>' +
          '<p>Cellular networks often fail during a disaster. UniGuard keeps hotlines, shelters and critical advisories on this device so they still open without a signal.</p>' +
          '<button class="rw-btn rw-btn--dark" style="border-radius:999px;padding:11px 24px"' + A('reconnect') + '>' + I('wave', 16) + (online ? 'Check Connection' : 'Back Online') + '</button>' +
        '</section>' +
        '<section class="rw-panel rw-off-side"><h3 class="rw-off-h">Saved on this device</h3>' +
          '<dl class="rw-off-kv">' + [['Device', device], ['Last saved', cache.synced || 'Not yet'], ['Waiting to send', (UG.DATA.queueCount || 0) + ' waiting'],
            ['Works without internet', ('serviceWorker' in navigator) ? 'Yes' : 'No'], ['App version', (UG_CONFIG && UG_CONFIG.BUILD) || 'dev']].map((r) =>
            '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl>' +
          '<button class="rw-pbtn rw-pbtn--line"' + A('force-refresh') + '>' + I('wave', 16) + 'Reload app</button>' +
        '</section>' +
      '</div>' +
      '<section class="rw-card rw-off-avail"><div class="rw-card-h"><h3>Available with no signal</h3><span class="rw-hint">Last saved ' + esc(cache.synced || '—') + '</span></div>' +
        '<div class="rw-rows">' + [['Emergency Hotlines', cache.hotlines, 'phone', 'hotlines'], ['Evacuation Centers', cache.centers, 'shelter', 'centers'], ['Critical Advisories', cache.advisories, 'megaphone', 'advisories']].map((x) =>
          '<button class="rw-row"' + A('nav', attr({ route: x[3] })) + '><div class="rw-t" style="gap:14px"><span class="rw-ico rw-ico--sm">' + I(x[2], 16) + '</span><h4>' + x[0] + '</h4></div>' +
            '<span class="rw-pill rw-pill--soft" style="padding:4px 12px">' + (x[1] || 0) + ' ready</span><span class="rw-off-n">' + (x[1] || 0) + ' saved</span>' + I('chevron', 15) + '</button>').join('') + '</div></section>' +
      '<section class="rw-card rw-off-wait"><div class="rw-card-h"><h3>Reports waiting to send</h3><span class="rw-live">' + queued.length + '</span></div>' +
        (UG_PWA.state.unassigned ? '<p class="rw-warn rw-warn--amber" role="status">Older reports or SOS messages without an account are held on this device. If you still need help, send a new report or call the LDRRMO.</p>' : '') +
        (queued.length ? '<div class="rw-rows">' + queued.map((q) => '<div class="rw-row" style="cursor:default"><div class="rw-main"><div class="rw-t"><h4>' + esc(q.hazard || 'Hazard') + '</h4></div>' +
            '<div class="rw-meta">' + (q.brgy ? '<span>' + I('pin', 14) + 'Brgy. ' + esc(q.brgy) + '</span>' : '') +
              '<span>' + I('clock', 14) + (q.failed ? 'Could not send' : 'Sends automatically when you are online') + '</span></div></div></div>').join('') + '</div>'
          : '<p class="rw-empty rw-empty--row" style="margin:0;font-size:14px">Nothing waiting. Every report has been sent.</p>') + '</section>' +
    '</div>';
  }

  /* =================================================================== sos */
  const KINDS = [['medical', 'Medical', 'plus', 'Ambulance'], ['fire', 'Fire', 'flame', 'BFP'], ['crime', 'Crime / Violence', 'shield', 'PNP'], ['rescue', 'Rescue', 'flood', 'Rescue team']];
  function sos(st) {
    const last = st.lastSos;
    const sending = st.sosSending;
    const status = last ? (last.status || 'sent') : '';
    const hot = mdrrmo();
    const call = '<a class="rw-callcard" href="' + telOf(hot) + '"><span class="rw-callcard-ico">' + I('phone', 20) + '</span>' +
      '<span><b>Call the Lingayen LDRRMO</b><span class="rw-mono">' + esc(hot) + '</span></span>' + I('chevron', 16) + '</a>';
    const failed = status === 'queued' || status === 'error';
    const title = sending ? 'Sending your SOS…' : status === 'queued' ? 'Saved. It will send when you have signal.'
      : status === 'sent' ? 'Help has been alerted' : 'What is the emergency?';
    const sub = status === 'error' ? (last.message || 'Could not send the SOS. Call the LDRRMO now.')
      : sending ? 'Finding your location. Keep your phone still.'
      : status === 'sent' ? 'Stay where you are if it is safe. Responders may call you. Follow the response status below.'
      : 'Tap the kind of emergency. We send your location right away.';
    return '<div class="ug-col rw-sos-page" style="gap:16px">' +
      lead('Sends your location to the Lingayen LDRRMO and your barangay responders.') +
      (failed ? call : '') +
      (status === 'queued' ? '<div class="rw-warn rw-warn--amber" role="status"><span><b style="display:block">Waiting for signal</b>No internet connection. Your SOS is saved on this device and will be sent automatically as soon as you are back online. If you are in danger, call the LDRRMO now.</span></div>' : '') +
      (status === 'sent' ? '<div class="rw-warn rw-warn--ok" role="status">' + I('check', 16) + '<span>Your SOS was delivered to the LDRRMO.</span></div>' : '') +
      '<section class="rw-sos-card">' +
        '<span class="rw-sos-orb' + (sending ? ' is-busy' : status === 'sent' ? ' is-done' : '') + '">' + I(status === 'sent' ? 'check' : 'alert', 32) +
          '<b>' + (sending ? 'Sending' : status === 'sent' ? 'Sent' : 'SOS') + '</b></span>' +
        '<div aria-live="polite"><h3>' + esc(title) + '</h3><p>' + esc(sub) + '</p></div>' +
        '<div class="rw-sos-kinds">' + KINDS.map((k) =>
          '<button' + A('sos-trigger', attr({ kind: k[0] })) + (sending ? ' disabled' : '') + '>' + I(k[2], 22) + '<b>' + k[1] + '</b><small>Sends ' + k[3] + ' + Barangay</small></button>').join('') + '</div>' +
        '<button class="rw-sos-other"' + A('sos-trigger', attr({ kind: 'other' })) + (sending ? ' disabled' : '') + '>' + I('help', 16) + 'Other / not sure · Barangay Response Team</button>' +
      '</section>' +
      (UG_SOS.tracking ? UG_SOS.tracking(st) : '') +
      (last && status === 'sent' ? '<section class="rw-panel rw-panel--flush"><div class="rw-ph"><div><h3>Your SOS</h3></div></div><ul class="rw-kvlist">' +
        [['Type', UG_SOS.kindLabel(last.kind)], ['Sent', last.at], ['Your location', last.lat != null ? (last.accuracy != null ? 'Found, within ' + Math.round(last.accuracy) + ' m' : 'Found') : 'Not found. Say where you are if you call.'],
         ['Who was alerted', last.reach != null ? (last.reach === 1 ? '1 duty officer' : last.reach + ' duty officers') : 'LDRRMO duty officers']].map((r) =>
          '<li><span>' + esc(r[0]) + '</span><b' + (r[0] === 'Who was alerted' ? ' style="color:var(--rw-red)"' : '') + '>' + esc(r[1]) + '</b></li>').join('') + '</ul></section>' : '') +
      (failed ? '' : call) +
      '<p class="rw-quiet">' + I('info', 14) + 'Use SOS only in a real emergency. False alarms take responders away from people who need them. SOS is limited to 5 calls per 10 minutes.</p>' +
    '</div>';
  }

  /* ========================================================= phone navigation */
  const TOP_TABS = [['relief', 'Relief'], ['advisories', 'Advisories'], ['map', 'Map'], ['guides', 'Guides'], ['faqs', 'FAQs']];
  function phoneTabs(st) {
    const active = st.route === 'advisory-detail' ? 'advisories' : st.route === 'relief-verify' ? 'relief' : st.route;
    return '<nav class="rw-ptabs" aria-label="Sections"><div>' + TOP_TABS.map((t) =>
      '<button class="' + (active === t[0] ? 'is-on' : '') + '"' + (active === t[0] ? ' aria-current="page"' : '') + A('nav', attr({ route: t[0] })) + '>' + t[1] + '<i></i></button>').join('') + '</div></nav>';
  }
  function phoneBar(st) {
    const r = st.route;
    const menuOn = ['notifications', 'offline', 'settings', 'reports', 'report-detail'].indexOf(r) !== -1;
    const item = (route, label, icon, on) => '<button class="rw-pb-i' + (on ? ' is-on' : '') + '"' + A('nav', attr({ route: route })) + '><span>' + I(icon, 22) + '</span><b>' + label + '</b></button>';
    return '<nav class="rw-pbar" aria-label="Emergency essentials"><div class="rw-pbar-in">' +
      item('home', 'Home', 'home', r === 'home') + item('centers', 'Shelters', 'shelter', r === 'centers') +
      '<button class="rw-pb-sos"' + A('nav', attr({ route: 'sos' })) + '><i></i><span>' + I('alert', 22) + '</span><b>SOS</b></button>' +
      item('hotlines', 'Hotlines', 'phone', r === 'hotlines') +
      '<button class="rw-pb-i' + (menuOn ? ' is-on' : '') + '"' + A('rw-pmenu') + '><span>' + I('grid', 22) + '</span><b>Menu</b></button>' +
    '</div></nav>';
  }
  function phoneMenu(st) {
    const s = st.session || {};
    const unread = (U.DATA.notifications || []).filter((n) => n.unread).length;
    /* grouped: what is yours, then the app; each row has a soft chevron */
    const groups = [
      ['Your activity', [['notifications', 'Notifications', 'bell'], ['reports', 'My Reports', 'doc']]],
      ['App', [['offline', 'Offline Sync', 'download'], ['settings', 'Settings', 'settings']]]
    ];
    const row = (it) => '<button class="' + (st.route === it[0] || (it[0] === 'reports' && st.route === 'report-detail') ? 'is-on' : '') + '"' + A('nav', attr({ route: it[0] })) + '>' +
      I(it[2], 20) + '<span>' + it[1] + '</span>' +
      (it[0] === 'notifications' && unread ? '<em>' + unread + '</em>' : '') + '<i class="rw-pm-chev">' + I('chevron', 16) + '</i></button>';
    return '<div class="rw-pm-scrim"' + A('rw-pmenu') + '></div>' +
      '<aside class="rw-pm" aria-label="Menu">' +
        '<div class="rw-pm-h"><span class="rw-pm-av">' + esc((s.name || 'R').trim().charAt(0).toUpperCase()) + '</span>' +
          '<div class="rw-pm-who"><b>' + esc(s.name || 'Resident') + '</b><small>' + (s.barangay ? 'Brgy. ' + esc(s.barangay) : 'Resident') + '</small></div>' +
          '<button class="rw-pm-x"' + A('rw-pmenu') + ' aria-label="Close menu">' + I('x', 20) + '</button></div>' +
        '<div class="rw-pm-list">' + groups.map((g) => '<p class="rw-pm-g">' + g[0] + '</p><div class="rw-pm-card">' + g[1].map(row).join('') + '</div>').join('') + '</div>' +
        '<div class="rw-pm-f"><button' + A('logout') + '>' + I('logout', 16) + 'Sign out</button>' +
          '<small>UniGuard · Lingayen LDRRMO' + ((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) ? ' · ' + esc(UG_CONFIG.BUILD) : '') + '</small></div>' +
      '</aside>';
  }

  return { report, reportDone, myReports, reportDetail, relief, reliefAllModal, reliefDetailModal, guides, faqs, map, settings, offline, sos, phoneTabs, phoneBar, phoneMenu };
})();
window.UG_RW = UG_RW;
