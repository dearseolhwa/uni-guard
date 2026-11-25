/* UniGuard · One-Tap SOS
 *
 * Floating button (citizen mobile) + dedicated screen on the desktop shell.
 * One tap sends the current GPS position, the caller's profile snapshot
 * (name + contact number) and a timestamp to the LGU/LDRRMO duty officers
 * through the submit_sos RPC (migration 016). The RPC also fans out a
 * notification to every LGU account.
 *
 * Offline: the request is queued the same way an offline report is, using the
 * existing UG_PWA enqueue path; the queue flushes when the connection comes
 * back.
 */
const UG_SOS = (function () {
  const esc = UG_UTIL.esc, I = UG.icon, U = UG;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');

  /* the SOS types: [kind, label, icon, who is sent]. The server maps each
     kind to its team (submit_sos, migration 060); the Barangay Response Team
     goes with every SOS, and is the default team for 'other'. */
  const KINDS = [
    ['medical', 'Medical', 'plus', 'Ambulance + Barangay'],
    ['fire', 'Fire', 'flame', 'BFP + Barangay'],
    ['crime', 'Crime / Violence', 'shield', 'PNP + Barangay'],
    ['rescue', 'Rescue', 'flood', 'Rescue + Barangay']
  ];
  const KIND_LABEL = { medical: 'Medical', fire: 'Fire', crime: 'Crime / Violence', rescue: 'Rescue', other: 'Other' };
  function kindLabel(k) { return KIND_LABEL[k] || KIND_LABEL.other; }

  /* the floating button itself, rendered as part of the mobile frame */
  function floatingButton(st) {
    if (!st.session || st.session.role !== 'citizen') return '';
    if (st.view !== 'mobile') return '';
    /* don't show on the SOS confirmation screen, where it's already primary */
    if (st.route === 'sos') return '';
    return '<button class="ug-sos-fab" data-act="sos-trigger" aria-label="Send SOS to LGU / LDRRMO">' +
      '<span class="sos-ico">' + I('alert', 24) + '</span>' +
      '<span class="sos-label">SOS</span></button>';
  }

  /* the citizen SOS confirmation screen. The outcome of the last tap is shown
     inline here (sent / waiting for signal / refused), not as toasts. */
  function mSos(st) {
    const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
    const last = st.lastSos;
    const sending = st.sosSending;
    const status = last ? (last.status || 'sent') : '';
    /* a real tel: link, so the call works even if every script action fails */
    const hotline = '<div class="ug-card"><div class="ug-card-h"><h3>Backup Hotline</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:10px">' +
          '<p class="ug-dim" style="font-size:12px;line-height:1.55">If you cannot reach the LGU through the app, call the LDRRMO hotline directly. The call works even when the data signal is too weak for the SOS to send.</p>' +
          '<a class="ug-btn ug-btn--signal ug-btn--block" href="tel:0756322222" style="text-decoration:none">' + I('phone', 16) + 'Call Lingayen LDRRMO</a>' +
        '</div></div>';
    const hotlineFirst = status === 'queued' || status === 'error';
    const statusLine = !last ? ''
      : status === 'queued'
        ? '<div class="ug-col" style="gap:8px;align-items:center">' +
            '<div class="ug-badge ug-badge--warning">' + esc(T('sos.waitingForSignal')) + '</div>' +
            '<p style="font-size:12px;line-height:1.5;max-width:320px;color:var(--ug-warning)">' + esc(T('sos.savedOffline')) + '</p></div>'
        : status === 'error'
          ? '<div class="ug-col" style="gap:8px;align-items:center">' +
              '<div class="ug-badge ug-badge--emergency">' + esc(T('sos.notSent')) + '</div>' +
              '<p style="font-size:12px;line-height:1.5;max-width:320px;color:var(--ug-warning)">' + esc(last.message || '') + '</p></div>'
          : '<div class="ug-col" style="gap:6px;align-items:center"><div class="ug-badge ug-badge--resolved">Sent · ' + esc(last.at) + '</div>' +
              '</div>';
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">One-Tap Emergency</div>' +
      '<h2 style="font-size:18px;margin-top:3px">SOS</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Tap the kind of emergency. Your GPS position, name and contact number go to the LGU/LDRRMO duty officer, and the system requests a matching response team when one is available. Use only when you are in immediate danger.</p></div>' +

      (hotlineFirst ? hotline : '') +
      tracking(st) +

      '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:14px;align-items:center;text-align:center;padding:20px 16px">' +
        '<h3 style="font-size:16px">' + (sending ? 'Sending SOS…' : 'What is the emergency?') + '</h3>' +
        '<div class="ug-sos-kinds">' + KINDS.map((k) =>
          '<button class="ug-sos-kind kind-' + k[0] + '" data-act="sos-trigger" data-kind="' + k[0] + '"' + (sending ? ' disabled' : '') + '>' +
            I(k[2], 26) + '<span class="k-l">' + esc(k[1]) + '</span><span class="k-t">Requests: ' + esc(k[3]) + '</span></button>').join('') +
        '</div>' +
        '<button class="ug-btn ug-btn--block" data-act="sos-trigger" data-kind="other"' + (sending ? ' disabled' : '') + '>' + I('help', 16) + 'Other / not sure · Barangay Response Team</button>' +
        '<p class="ug-dim" style="font-size:12px;line-height:1.5;max-width:300px">Hold still for a moment so we can read your GPS. If GPS is unavailable, the app can use your registered barangay to route the request. Call the hotline to confirm your exact location.</p>' +
        statusLine +
      '</div></div>' +

      (last && status === 'sent' ? '<div class="ug-card"><div class="ug-card-h"><h3>Last SOS</h3>' + U.badge('id', last.id || 'PENDING') + '</div>' +
        '<div class="ug-card-b ug-col" style="gap:11px">' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Type</span>' +
            '<span class="ug-mono">' + esc(kindLabel(last.kind)) + '</span></div>' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Initially assigned</span>' +
            '<span class="ug-mono">' + esc(last.team || 'Duty officer reviewing') + '</span></div>' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Position</span>' +
            '<span class="ug-mono">' + esc(last.lat != null ? UG_GEO.fmt(last.lat, last.lng) : 'No GPS fix') + '</span></div>' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Accuracy</span>' +
            '<span class="ug-mono">' + (last.accuracy != null ? last.accuracy + ' m' : '—') + '</span></div>' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Sent at</span>' +
            '<span class="ug-mono">' + esc(last.at) + '</span></div>' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">In-app alerts sent</span>' +
            '<span class="ug-mono">' + esc((last.reach != null ? last.reach : '—') + ' staff alerts') + '</span></div>' +
        '</div></div>' : '') +

      (hotlineFirst ? '' : hotline) +

      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-warning);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-note">SOS is rate-limited to 5 calls per 10 minutes. False alarms take the duty officer away from real emergencies.</div></div></div>' +
    '</div>';
  }

  /* Where responders are going, for the sender (migration 091). With location
     off: a reminder with the steps and "Share my location now". Always: a
     landmark box the sender can fill in or correct. Live GPS, then the
     landmark, then the registered home, then the barangay. */
  function locationBlock(st, recent, last) {
    if (recent && recent.status === 'resolved') return '';
    const s = st.session || {};
    const src = recent ? recent.location_source : (last && last.noGps ? 'barangay' : 'gps');
    const off = src !== 'gps';
    const home = [s.home_address, s.home_landmark].filter(Boolean).join(' · ');
    const going = src === 'gps' ? ['Your live location', '']
      : src === 'landmark' ? ['Your landmark', recent.landmark]
      : src === 'home' ? ['Your registered home', (recent && recent.landmark) || home]
      : ['Your barangay', (recent && recent.barangay) || s.barangay || ''];
    const id = (recent && recent.id) || (last && last.status === 'sent' && last.id) || null;
    const value = st.sosLandmark != null ? st.sosLandmark : (recent && src !== 'gps' && src !== 'home' ? recent.landmark : '');
    return (off
      ? '<div class="sos-locoff" role="alert">' + I('alert', 18) + '<div><b>Your location is off</b>' +
          '<p>Your SOS was sent. Turn on location so responders can find you:</p>' +
          '<ol><li>Turn on <b>Location</b> (GPS) in your phone settings.</li><li>Allow location for this site when your browser asks.</li><li>Tap <b>Share my location now</b>.</li></ol>' +
          (id ? '<button class="ug-btn ug-btn--signal ug-btn--block"' + A('sos-share-location', attr({ id: id })) + (st.sosLocating ? ' disabled' : '') + '>' +
                  I('target', 15) + (st.sosLocating ? 'Finding your location…' : 'Share my location now') + '</button>'
              : '<p class="ug-dim" style="font-size:12px;margin:0">You can share it as soon as your SOS reaches the server.</p>') +
        '</div></div>'
      : '') +
      '<p class="sos-going">' + I('pin', 14) + '<span>Responders are going to: <b>' + esc(going[0]) + '</b>' +
        (going[1] ? ' · ' + esc(going[1]) : '') + '</span></p>' +
      (id
        ? '<div class="sos-landmark"><label for="sos-landmark-in">' + (off ? 'Add a landmark or exact address' : 'Add a landmark (optional)') + '</label>' +
            '<div><input id="sos-landmark-in" class="ug-in" data-field="rw.sosLandmark" maxlength="200" value="' + esc(value || '') +
              '" placeholder="For example: blue gate beside the chapel, 2nd floor">' +
            '<button class="ug-btn"' + A('sos-save-landmark', attr({ id: id })) + '>Save</button></div></div>'
        : '');
  }

  /* the citizen's own open SOS, and the teams sent to it with their live GPS
     position (shared by the responders, migration 057) */
  function tracking(st) {
    const last = st.lastSos;
    const mine = (UG.DATA.sosLog || []).filter((row) => row.user_id === st.session?.id);
    const recent = mine.find((row) => row.id === last?.id)
      || mine.find((row) => row.status !== 'resolved') || (!last ? mine[0] : null);
    const reportId = recent?.report_id || (last?.status === 'sent' ? last.report_id : null);
    if (!recent && !reportId) return '';
    const inc = (UG.DATA.incidents || []).find((i) => i.uuid === reportId);
    const teams = (UG.DATA.dispatches || {})[reportId] || [];
    const waiting = recent?.status !== 'resolved' && teams.length && teams.every((d) => d.dispatch_status === 'declined');
    const units = UG.DATA.unitsById || {};
    const stepLabel = { sent: 'Sent', acknowledged: 'Acknowledged', en_route: 'On the way', on_scene: 'Arrived',
      done: 'Done', declined: 'Declined', under_control: 'Under control', fire_out: 'Fire out', on_hold: 'On hold',
      transporting: 'Transporting', arrived_hospital: 'At the hospital' };
    const clock = (v) => v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const rows = teams.map((d) => {
      const unit = units[d.unit_id];
      const active = !['declined', 'done'].includes(d.dispatch_status);
      const far = (active && d.last_lat != null && d.last_lng != null && inc?.lat != null && inc.lng != null) ? UG_UTIL.distanceM(d.last_lat, d.last_lng, inc.lat, inc.lng) : null;
      return '<div class="ug-col" style="gap:4px;padding:9px 0;border-bottom:1px solid var(--ug-line)">' +
        '<div class="ug-rowf ug-between" style="gap:8px;font-size:13px"><span style="font-weight:700">' + I('truck', 13) + ' ' + esc(d.team) +
          (unit ? '<span class="ug-dim" style="font-weight:600"> · ' + esc(unit.name) + '</span>' : '') + '</span>' +
          '<span class="ug-badge ug-badge--' + (d.dispatch_status === 'declined' ? 'closed' : 'dispatched') + '">' + esc(stepLabel[d.dispatch_status] || d.dispatch_status || 'Sent') + '</span></div>' +
        '<div class="ug-rowf ug-wrap" style="gap:4px 12px;font-size:12px">' +
          (far != null
            ? '<span style="font-weight:600;color:var(--ug-st-dispatched)">' + I('radar', 12) + ' ' + esc(UG_UTIL.fmtDistance(far)) + ' away</span>' +
              '<span class="ug-dimmer">updated ' + esc(UG_UTIL.relTime({ created_at: d.last_loc_at })) + '</span>'
            : active ? '<span class="ug-dimmer">Waiting for the team\'s GPS</span>' : '') +
          (d.eta && ['sent', 'acknowledged', 'en_route'].includes(d.dispatch_status) ? '<span class="ug-dim">ETA ' + esc(clock(d.eta)) + '</span>' : '') +
        '</div>' +
        (active && unit && unit.contact_number ? '<a class="ug-dim" style="font-size:12px" href="tel:' + esc(unit.contact_number.replace(/\s+/g, '')) + '">' + I('phone', 12) + ' ' + esc(unit.contact_number) + '</a>' : '') +
      '</div>';
    }).join('');
    return '<div class="ug-card" style="border-left:3px solid var(--ug-st-dispatched)"><div class="ug-card-h"><h3>SOS response status</h3></div>' +
      '<div class="ug-card-b ug-col" style="gap:8px">' +
        locationBlock(st, recent, last) +
        /* has a person seen it yet? (migration 064 records who) */
        (() => {
          const me = recent;
          if (!me) return '';
          if (me.status === 'resolved') return '<p class="sos-seen is-ok">' + I('check', 13) + '<span>Resolved' +
            (me.resolved_by_name ? ' by ' + esc(me.resolved_by_name) : '') + '</span></p>';
          return me.status === 'sent'
            ? '<p class="sos-seen is-wait">' + I('clock', 13) + '<span>Sent. Waiting for an official to see it…</span></p>'
            : '<p class="sos-seen is-ok">' + I('check', 13) + '<span>Seen by ' + esc(me.acknowledged_by_office || 'an official') +
                (me.acknowledged_by_name ? ' (' + esc(me.acknowledged_by_name) + ')' : '') +
                (me.acknowledged_at ? ' · ' + esc(UG_UTIL.relTime({ created_at: me.acknowledged_at })) : '') + '</span></p>';
        })() +
        (waiting ? '<p class="ug-note">The assigned teams couldn’t respond. LDRRMO staff have been notified to assign a replacement. Call the LDRRMO if you still need immediate help.</p>' : '') +
        (rows || (recent?.status === 'resolved' ? '' : '<p class="ug-dim" style="font-size:12px;line-height:1.5">A responding team will appear here when an assignment is available.</p>')) +
        /* watch help coming: your SOS pin, each team's car, the road it drove
           and the road still ahead (js/map.js drawTracks) */
        (inc && recent?.status !== 'resolved' && UG_GEO.isNum(inc.lat) && UG_GEO.isNum(inc.lng)
          ? '<div class="ug-map sos-trackmap" data-map="detail" data-response-report="' + esc(reportId) + '" aria-label="Map of your SOS and the teams on their way">' + UG.mapSVG({}) + '</div>' +
            '<p class="sos-mapkey"><span><i class="is-done"></i>Road driven</span><span><i class="is-ahead"></i>Road ahead</span></p>'
          : '') +
        (reportId ? '<button class="ug-btn ug-btn--signal ug-btn--block" style="margin-top:4px"' + A('open-linked-report', attr({ id: reportId })) + '>' + I('pin', 15) + 'View the linked report</button>' : '') +
      '</div></div>';
  }

  /* Duty officers (barangay officials, LDRRMO staff) acknowledge and resolve
     SOS. The Super Admin follows them read-only (migration 092). */
  const answersSos = (st) => !(st && st.session && st.session.superAdmin);

  /* the strip on top of every console screen: the "enable alarm sound"
     prompt while the browser still blocks sound, and open and personally unacknowledged SOS requests */
  function activeStrip(st) {
    const role = st && st.session && st.session.role;
    if (role !== 'lgu_ldrrmc' && role !== 'barangay_official') return '';
    const needSound = typeof UG_ALARM !== 'undefined' && !UG_ALARM.muted() && UG_ALARM.needsUnlock();
    const sound = needSound
      ? UG.note('alarm', 'off', 'bell', 'Alarm sound is off', 'Tap here once so SOS and new reports can ring on this screen.',
          { session: true, act: 'alarm-unlock', btn: '<button class="n2-go n2-go--q"' + A('alarm-sound-help') + '>Always allow</button><button class="n2-go"' + A('alarm-unlock') + '>Turn on sound</button>' })
      : '';
    /* what the floating panel shows (everything stays in the SOS Log): every
       SOS nobody has answered, however old (migration 069: an unanswered SOS
       never closes by itself), and an acknowledged one for 24 h. Resolved and
       expired ones leave it. */
    const ageH = (x) => x.created_at ? (Date.now() - Date.parse(x.created_at)) / 3600000 : 0;
    const open = (UG.DATA.sosLog || []).filter((x) => !x.expired && x.status !== 'resolved' &&
      (x.status === 'sent' || ageH(x) < 24));
    if (!open.length) return sound;
    /* the SOS Log page already lists every SOS: no floating button there */
    if (st.route === 'sos') return sound;
    /* Built for a crisis: the requests nobody has answered come first and
       turn solid red, then the longest wait. Each card says what is wrong,
       who and where, how long they have waited, and gives the next step in
       one tap (call, acknowledge, route), so no one has to open the log. */
    const now = Date.now();
    const waitMin = (x) => x.created_at ? Math.max(0, Math.floor((now - Date.parse(x.created_at)) / 60000)) : 0;
    const dur = (m) => m < 1 ? 'just now' : m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
    /* newest first; the header names the oldest one still waiting */
    /* waiting: an SOS this officer still owes a receipt for; for the Super
       Admin, who follows but does not answer, an SOS nobody has answered */
    const answers = answersSos(st);
    const owes = (x) => answers ? !!x.needs_receipt : x.status === 'sent';
    const sorted = open.slice().sort((p, q) => waitMin(p) - waitMin(q));   /* newest first */
    const waiting = sorted.filter(owes);
    const longestWait = waiting.reduce((m, x) => Math.max(m, waitMin(x)), 0);
    const KIND_ICON = { medical: 'plus', fire: 'flame', crime: 'shield', rescue: 'flood', other: 'alert' };
    const OVERDUE = 5;   /* minutes without an answer before a card is flagged */
    const card = (x) => {
      const m = waitMin(x);
      const isNew = owes(x);
      const late = x.status === 'sent' && m >= OVERDUE;
      const tel = String(x.profile_phone || '').replace(/[^\d+]/g, '');
      const where = x.barangay ? 'Brgy. ' + x.barangay : x.lat != null ? UG_GEO.fmt(x.lat, x.lng) : 'No location yet';
      /* one structure for every card (new or acknowledged): type · status and
         time, name, place · "No team sent", then a bottom row with the main
         action (or who acknowledged it) and round Call / Route */
      return '<article class="sx-card sxc' + (isNew ? ' is-new' : ' is-ack') + (late ? ' is-late' : '') + '">' +
        '<button class="sxc-main"' + A('open-sos-detail', attr({ id: x.id })) + ' aria-label="Open SOS from ' + esc(x.profile_name || 'Resident') + '">' +
          '<span class="sxc-top"><span class="sxc-k">' + I(KIND_ICON[x.kind] || 'alert', 13) + esc(kindLabel(x.kind)) + '</span>' +
            /* a status chip only for an SOS nobody has answered; once someone
               has, the bottom row says who, so a chip would repeat it */
            (x.status === 'sent' ? '<span class="sxc-st"><i></i>' + (late ? 'No response' : 'New') + '</span>' : '') +
            '<span class="sxc-time">' + dur(m) + (isNew ? '' : ' ago') + '</span></span>' +
          '<b class="sxc-name">' + esc(x.profile_name || 'Resident') + '</b>' +
          '<span class="sxc-meta"><span>' + esc(where) + '</span>' +
            (isNew && x.status !== 'sent' ? '<span>Seen by ' + esc(x.acknowledged_by_name || x.acknowledged_by_office || 'another officer') + '</span>' : '') +
            (!x.report_id ? '<span class="sxc-warn">No team sent</span>' : '') + '</span>' +
        '</button>' +
        '<div class="sxc-foot">' +
          (isNew && answers ? '<button class="sxc-go"' + A('sos-ack', attr({ id: x.id })) + '>' + I('check', 14) +
              (x.status === 'sent' ? 'Acknowledge' : 'Mark as seen') + '</button>'
            : isNew ? '<span class="sxc-by is-wait">' + I('clock', 12) + 'Waiting for a duty officer</span>'
            : '<span class="sxc-by">' + I('check', 12) + (x.acknowledged_by_name ? 'By ' + esc(x.acknowledged_by_name) : 'Help is on it') + '</span>') +
          (tel ? '<a class="sxc-ic" href="tel:' + esc(tel) + '" aria-label="Call" title="Call ' + esc(x.profile_phone) + '">' + I('phone', 15) + '</a>' : '') +
          (x.lat != null ? '<a class="sxc-ic" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(x.lat, x.lng) + '" aria-label="Directions" title="Directions">' + I('route', 15) + '</a>' : '') +
        '</div></article>';
    };
    const oldest = waiting.length ? dur(longestWait) : '';
    /* A floating panel over the page (bottom right; a sheet on phones), so
       the dashboard keeps its layout. It can be folded into a pill, and it
       opens itself again the moment a new unanswered SOS arrives. */
    const sig = waiting.map((x) => x.id).sort().join(',');
    if (dock.min && sig && sig !== dock.sig && waiting.some((x) => dock.sig.split(',').indexOf(String(x.id)) < 0)) dock.min = false;
    dock.sig = sig;
    /* phones: a blurred backdrop behind the open sheet; tapping it folds the sheet */
    return '<div class="sx-scrim"' + A('sos-dock') + ' aria-hidden="true"></div>' +
      /* it keeps pulsing until every open SOS is resolved (not only acknowledged) */
      '<aside class="ug-sosx' + (open.length ? ' is-hot' : '') + (waiting.length ? ' is-waiting' : '') + (dock.min ? ' is-min' : '') + '" role="region" aria-label="Open SOS requests">' +
      /* folded: one pill */
      '<button class="sx-pill"' + A('sos-dock') + ' aria-expanded="false" aria-label="Show open SOS requests">' +
        '<span class="sx-siren" aria-hidden="true">' + I('alert', 15) + '</span>' +
        /* phones show the folded state as a round button with this count */
        '<i class="sx-pill-n" aria-hidden="true">' + (waiting.length || open.length) + '</i>' +
        '<b>' + open.length + ' SOS</b>' + (waiting.length ? '<em>' + waiting.length + ' waiting · ' + oldest + '</em>' : '<em>All acknowledged</em>') +
        I('chevron', 14) + '</button>' +
      '<div class="sx-panel">' +
        '<div class="sx-head">' +
          '<span class="sx-siren" aria-hidden="true">' + I('alert', 16) + '</span>' +
          /* one count in the title, one fact under it */
          '<div class="sx-title"><b>' + open.length + ' open SOS</b>' +
            '<span>' + (!waiting.length ? 'All acknowledged · responders on it'
              : (waiting.length === open.length ? 'All need ' + (answers ? 'you' : 'a duty officer') : waiting.length + ' need ' + (answers ? 'you' : 'a duty officer')) + ' · oldest ' + oldest) + '</span></div>' +
          '<button class="sx-x"' + A('sos-dock') + ' aria-expanded="true" aria-label="Minimise" title="Minimise (opens again on a new SOS)">' + I('chevdn', 16) + '</button>' +
        '</div>' +
        (needSound ? '<button class="sx-sound"' + A('alarm-unlock') + ' title="The browser keeps the alarm silent until you tap once on this screen">' + I('bell', 13) + 'Alarm is silent · tap to turn on sound</button>' : '') +
        '<div class="sx-list" data-sx-list>' + sorted.slice(0, 8).map(card).join('') + '</div>' +
        /* phones: one SOS per swipe, with a dot per card and a View all link */
        (Math.min(sorted.length, 8) > 1 ? '<div class="sx-dots" aria-hidden="true">' + sorted.slice(0, 8).map((x, n) => '<i class="' + (n ? '' : 'is-on') + '"></i>').join('') + '</div>' : '') +
        '<button class="sx-log"' + A('nav', attr({ route: 'sos' })) + '><span class="sx-log-d">Open SOS Log</span><span class="sx-log-m">View all ' + sorted.length + ' SOS</span>' +
          (sorted.length > 8 ? '<span class="sx-log-d">&nbsp;· +' + (sorted.length - 8) + ' more</span>' : '') + I('chevron', 13) + '</button>' +
      '</div>' +
    '</aside>';
  }
  /* phones start folded into the top banner; a new unanswered SOS opens it */
  const dock = { min: typeof window !== 'undefined' && window.innerWidth <= 767, sig: '' };
  function toggleDock() {
    dock.min = !dock.min;
    const el = document.querySelector('.ug-sosx');
    if (el) el.classList.toggle('is-min', dock.min);
  }

  /* the LGU view: list of recent SOS events. Rows are clickable and open the
     full detail (sender, time, location on a map, status, contact) with the
     acknowledge / resolve actions — the detail view that was missing. */
  function dSos(st) {
    const all = UG.DATA.sosLog || [];
    /* status filter + search (Nov 2026); the list itself is the original one */
    const stat = (x) => (x.status === 'resolved' || x.status === 'acknowledged') ? x.status : 'sent';
    const n = { all: all.length, sent: 0, acknowledged: 0, resolved: 0 };
    all.forEach((x) => { n[stat(x)]++; });
    const f = st.sosFilter || 'all';
    const q = String(st.sosSearch || '').trim().toLowerCase();
    const rows = all
      .filter((x) => f === 'all' || stat(x) === f)
      .filter((x) => !q || [x.profile_name, x.profile_phone, x.barangay, kindLabel(x.kind)].some((v) => String(v || '').toLowerCase().indexOf(q) >= 0));
    const TABS = [['all', 'All'], ['sent', 'New'], ['acknowledged', 'Acknowledged'], ['resolved', 'Resolved']];
    /* nothing loaded because the server cannot be reached: say so, not "no SOS" */
    const offlineNow = typeof Repo !== 'undefined' && Repo.state && (Repo.state.source !== 'supabase' || (typeof navigator !== 'undefined' && navigator.onLine === false));
    const statusBadge = (s) => s === 'resolved'
      ? U.badge('resolved', 'Resolved')
      : s === 'acknowledged' ? U.badge('warning', 'Acknowledged') : U.badge('emergency', 'New');
    return '<div class="ug-col" style="gap:18px">' +
      head('SOS Log', (st.session && st.session.role === 'barangay_official'
          ? 'Every one-tap SOS from a resident of your barangay, newest first.'
          : 'Every one-tap SOS received from a citizen, newest first.') + ' Tap a row for the full record and the response actions.',
        '<span class="ug-chip is-on">' + all.length + ' events</span>') +
      (typeof Repo !== 'undefined' && Repo.state.sosInboxIncomplete
        ? '<p role="status">Some SOS records or acknowledgement actions are unavailable. <button type="button"' + A('refresh-data') + '>Retry</button></p>' : '') +
      '<div class="sos-tool">' +
        /* phones: the status filter as a dropdown (the tabs hide there) */
        '<div class="ug-wmore inc-dd sos-dd"><button class="inc-dd-btn"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Filter by status">' +
          '<span>' + (f === 'all' ? 'All statuses' : (TABS.find((t) => t[0] === f) || TABS[0])[1]) + '</span><b>' + n[f] + '</b>' + I('chevdn', 16) + '</button>' +
          '<div class="inc-dd-panel" data-more-panel hidden role="listbox">' + TABS.map((t) =>
            '<button role="option" class="' + (f === t[0] ? 'is-on' : '') + (t[0] === 'sent' && n.sent ? ' is-esc' : '') + '"' + A('sos-filter', attr({ v: t[0] })) + '>' +
              '<span>' + (t[0] === 'all' ? 'All statuses' : t[1]) + '</span><b>' + n[t[0]] + '</b>' + (f === t[0] ? I('check', 14) : '') + '</button>').join('') +
          '</div></div>' +
        '<div class="sos-tabs" role="tablist" aria-label="SOS status">' + TABS.map((t) =>
          '<button role="tab" aria-selected="' + (f === t[0]) + '" class="' + (f === t[0] ? 'is-on' : '') + '"' + A('sos-filter', attr({ v: t[0] })) + '>' + t[1] + '<i>' + n[t[0]] + '</i></button>').join('') + '</div>' +
        '<span class="sos-search">' + I('search', 14) +
          '<input data-field="rw.sosSearch" value="' + esc(st.sosSearch || '') + '" placeholder="Search SOS" aria-label="Search SOS by name, number or barangay">' +
          (st.sosSearch ? '<button' + A('sos-search-clear') + ' aria-label="Clear search">' + I('x', 11) + '</button>' : '') + '</span>' +
      '</div>' +
      /* the list: newest first; each row says what kind, who, where, how long,
         who answered it, and offers Call / Acknowledge without opening it */
      /* the list, after a social notification feed: "New" (waiting for an
         answer) then "Earlier"; a round avatar with the sender's initial and
         a small badge with the SOS type; one sentence; the time in crimson;
         a dot while it is new; Call / Acknowledge on the right */
      '<div class="ug-card sl-card sf-card"><div class="sl-list">' + (rows.length ? (() => {
        const KI = { medical: 'plus', fire: 'flame', crime: 'shield', rescue: 'flood', other: 'alert' };
        const sorted = rows.slice().sort((p, q) => Date.parse(q.created_at || 0) - Date.parse(p.created_at || 0));
        const item = (s) => {
          const st0 = stat(s);
          const tel = String(s.profile_phone || '').replace(/[^\d+]/g, '');
          const where = s.barangay ? 'Brgy. ' + s.barangay : s.lat != null ? UG_GEO.fmt(s.lat, s.lng) : '';
          const mins = s.created_at ? Math.max(0, Math.floor((Date.now() - Date.parse(s.created_at)) / 60000)) : 0;
          const late = st0 === 'sent' && mins >= 5;
          const name = s.profile_name || 'A resident';
          const what = st0 === 'sent' ? (late ? 'No response yet' : 'New')
            : st0 === 'acknowledged' ? 'Acknowledged' + (s.acknowledged_by_name ? ' by ' + s.acknowledged_by_name : '')
            : s.expired ? 'Unanswered · closed automatically after 12 h'
            : 'Resolved' + (s.resolved_by_name ? ' by ' + s.resolved_by_name : '');
          return '<div class="sf-row is-' + st0 + (s.expired ? ' is-expired' : '') + '" role="button" tabindex="0" data-act="open-sos-detail" data-id="' + esc(s.id) + '">' +
            '<span class="sf-av">' + esc(name.trim().charAt(0).toUpperCase()) + '<i class="sf-badge is-' + esc(s.kind || 'other') + '">' + I(KI[s.kind] || 'alert', 11) + '</i></span>' +
            '<div class="sf-main"><p class="sf-txt"><b>' + esc(name) + '</b> sent a <b>' + esc(kindLabel(s.kind)) + ' SOS</b>' + (where ? ' from ' + esc(where) : '') + '.' +
              (!s.report_id && st0 !== 'resolved' ? ' <span class="sf-warn">No team sent.</span>' : '') + '</p>' +
              '<span class="sf-time">' + esc(s.time || '') + ' · ' + esc(what) + '</span>' +
              (s.needs_receipt && answersSos(st) ? '<div class="sf-acts">' +
                  /* already answered by someone else: you are only recording that you saw it */
                  '<button class="sf-go"' + A('sos-ack', attr({ id: s.id })) + '>' + (st0 === 'sent' ? 'Acknowledge' : 'Mark as seen') + '</button>' +
                  (tel ? '<a class="sf-call" href="tel:' + esc(tel) + '">Call</a>' : '') + '</div>' : '') +
            '</div>' +
            (st0 === 'sent' ? '<i class="sf-dot" aria-label="New"></i>' : tel ? '<a class="sf-tel" href="tel:' + esc(tel) + '" onclick="event.stopPropagation()" aria-label="Call">' + I('phone', 15) + '</a>' : '') +
          '</div>';
        };
        /* by time, like a notification feed: "New" is the last 24 hours,
           "Earlier" is anything older (an unanswered older SOS still keeps
           its dot and Acknowledge button) */
        const recent = (x) => x.created_at && Date.now() - Date.parse(x.created_at) < 24 * 3600000;
        const fresh = sorted.filter(recent);
        const older = sorted.filter((x) => !recent(x));
        return (fresh.length ? '<h4 class="sf-h">New</h4>' + fresh.map(item).join('') : '') +
          (older.length ? '<h4 class="sf-h">Earlier</h4>' + older.map(item).join('') : '');
      })() :
        '<div class="ug-empty"><span class="e-ico">' + I(all.length ? 'search' : 'alert', 20) + '</span>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">' + (all.length ? 'No SOS matches this filter' : offlineNow ? 'Can\'t reach the server' : 'No SOS events yet') + '</div>' +
        '<div class="ug-dim" style="font-size:11px">' + (all.length ? 'Try another status or clear the search.' : offlineNow ? 'Check your connection. SOS events load again as soon as you are back online.' : 'When a citizen sends one, it appears here in real time.') + '</div></div>') + '</div></div>' +
    '</div>';
  }

  /* the SOS detail modal: sender, contact, time, status, map location and the
     acknowledge / resolve actions, scoped per barangay by migration 029. */
  function sosDetailModal(st, id) {
    const s = (UG.DATA.sosLog || []).find((x) => x.id === id);
    if (!s) return;
    const KIND = {
      medical: ['Medical emergency', 'plus', ['Ambulance', 'Barangay Response Team']],
      fire:    ['Fire', 'flame', ['BFP', 'Barangay Response Team']],
      crime:   ['Crime / violence', 'shield', ['PNP', 'Barangay Response Team']],
      rescue:  ['Rescue needed', 'flood', ['Rescue Unit', 'Barangay Response Team']],
      other:   ['Other / not sure', 'alert', ['Barangay Response Team']]
    };
    const k = KIND[s.kind] || KIND.other;
    const st8 = s.status === 'resolved' ? 'resolved' : s.status === 'acknowledged' ? 'acknowledged' : 'sent';
    const STATE = {
      sent: ['New', answersSos(st) ? 'Nobody has acknowledged this SOS yet. Acknowledging tells the sender that help has seen it.'
        : 'Waiting for a duty officer to acknowledge it. Duty officers acknowledge and resolve SOS; you can follow it here.'],
      acknowledged: ['Acknowledged', 'The sender has been told that help has seen their SOS.'],
      resolved: s.expired ? ['Unanswered', 'No one acknowledged this SOS within 12 hours, so it was closed automatically and the sender was told to call the hotline. Follow up with them if you can.']
        : ['Resolved', 'This emergency has been closed.']
    }[st8];
    /* who answered it and when (migration 064) */
    const whoAck = s.acknowledged_by_name ? 'Acknowledged by ' + s.acknowledged_by_name + (s.acknowledged_by_office ? ' (' + s.acknowledged_by_office + ')' : '') +
      (s.acknowledged_at ? ' · ' + UG_UTIL.absTime(s.acknowledged_at) : '') : '';
    const whoRes = s.expired ? (s.expired_at ? 'Closed ' + UG_UTIL.absTime(s.expired_at) : '') : s.resolved_by_name ? 'Resolved by ' + s.resolved_by_name + (s.resolved_at ? ' · ' + UG_UTIL.absTime(s.resolved_at) : '') : '';
    if (whoAck || whoRes) STATE[1] = [STATE[1], whoAck, whoRes].filter(Boolean).join(' · ');
    const hasFix = s.lat != null && s.lng != null;
    const inc = s.report_id ? (UG.DATA.incidents || []).find((r) => r.uuid === s.report_id || r.id === s.report_id) : null;
    const tel = s.profile_phone ? 'tel:' + String(s.profile_phone).replace(/[^+\d]/g, '') : '';
    const teamsHtml = (list) => list.map((t) => '<span class="sd-team">' + esc(t) + '</span>').join('');
    const sent = s.report_id ? ((UG.DATA.dispatches || {})[s.report_id] || []).filter((d) => d.dispatch_status !== 'declined') : [];

    const session = typeof Auth !== 'undefined' && Auth.state.session;
    const canLink = !s.report_id && st8 !== 'resolved' && session &&
      session.role === 'lgu_ldrrmc' && !session.superAdmin;
    const response = s.report_id
      ? '<div class="sd-box is-ok"><span class="sd-box-i">' + I('truck', 15) + '</span><div>' +
          '<b>Linked incident response</b>' +
          '<p>The linked incident report' + (inc && inc.id ? ' (' + esc(inc.id) + ')' : '') + ' tracks teams assigned to this SOS.</p>' +
          '<div class="sd-teams" data-sos-teams>' + teamsHtml(sent.map((d) => d.team)) + '</div>' +
          (sent.length ? '' : '<small class="sd-fine" data-sos-teams-note>Open the linked report to view or assign response teams.</small>') +
        '</div></div>'
      : '<div class="sd-box is-warn"><span class="sd-box-i">' + I('warning', 15) + '</span><div>' +
          '<b>No team has been sent</b>' +
          '<p>' + (hasFix
            ? 'The SOS could not be turned into a report automatically (for example, it was sent from outside Lingayen). Call the sender and send a team from the Incident Queue.'
            : 'An incident could not be linked using the available location. Call the sender to confirm the address and arrange a response.') + '</p>' +
          '<div class="sd-teams">' + teamsHtml(k[2]) + '</div>' +
          '<small class="sd-fine">Teams normally sent for this type of SOS.</small>' +
        '</div></div>';

    /* where responders go (migration 091): live GPS, a landmark, the
       sender's registered home, or only the barangay; officials can correct
       the landmark after calling the sender */
    const SRC = { gps: 'Live GPS from the phone', landmark: 'Landmark (no live location)', home: 'Registered home of the sender (no live location)', barangay: 'Registered barangay only (no live location)' };
    const src = s.location_source || (hasFix ? 'gps' : 'barangay');
    const source = '<p class="sd-src' + (src === 'gps' ? '' : ' is-off') + '">' + I(src === 'gps' ? 'target' : 'alert', 13) + '<span>' + esc(SRC[src] || SRC.gps) + '</span></p>' +
      (s.landmark ? '<p class="sd-landmark">' + I('pin', 13) + '<span>' + esc(s.landmark) + '</span></p>' : '');
    const editLandmark = s.status !== 'resolved'
      ? '<div class="sos-landmark"><label for="sd-landmark-in">' + (src === 'gps' ? 'Landmark' : 'Landmark or exact address (after calling the sender)') + '</label>' +
          '<div><input id="sd-landmark-in" class="ug-in" maxlength="200" value="' + esc(src === 'landmark' ? s.landmark : '') + '" placeholder="For example: 2nd floor, blue gate beside the chapel">' +
          '<button class="ug-btn" data-keep-modal' + A('sos-save-landmark', attr({ id: s.id })) + '>Save</button></div></div>'
      : '';
    const where = (hasFix
      ? '<div class="sd-map ug-map" data-map="sos-detail"></div>' +
        '<div class="sd-where"><span>' + I('pin', 13) + esc(UG_GEO.fmt(s.lat, s.lng)) + (s.accuracy != null ? ' <em>± ' + Math.round(s.accuracy) + ' m</em>' : '') + '</span>' +
          '<a class="sd-link" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(s.lat, s.lng) + '">' + I('route', 13) + 'Route in Waze</a></div>'
      : '<div class="sd-nofix">' + I('pin', 15) + '<span>No GPS location and no home pin. Use the landmark or call the sender.</span></div>') +
      source + editLandmark;

    UG_FEATURES.modal({
      title: 'SOS · ' + k[0],
      body:
        '<div class="sd-top">' +
          '<span class="sd-ico is-' + st8 + '">' + I(k[1], 18) + '</span>' +
          '<div class="sd-who"><b>' + esc(s.profile_name || 'Resident') + '</b>' +
            '<small>' + esc(s.barangay ? 'Brgy. ' + s.barangay : 'Barangay unknown') + ' · ' + esc(s.time || '') + ' · ' + esc(UG_UTIL.absTime(s.created_at) || '') + '</small></div>' +
          '<span class="sd-state is-' + st8 + '"><i></i>' + STATE[0] + '</span>' +
        '</div>' +
        '<p class="sd-statehint">' + esc(STATE[1]) + '</p>' +
        (tel
          ? '<a class="sd-call" href="' + esc(tel) + '">' + I('phone', 16) + '<span><b>Call ' + esc(s.profile_name ? s.profile_name.split(' ')[0] : 'the sender') + '</b><small>' + esc(s.profile_phone) + '</small></span></a>'
          : '<div class="sd-nofix">' + I('phone', 15) + '<span>The sender has no phone number on their profile.</span></div>') +
        (s.note ? '<div class="sd-sec"><h4>Message from the sender</h4><p class="sd-note">' + esc(s.note) + '</p></div>' : '') +
        '<div class="sd-sec"><h4>Response</h4>' + response + '</div>' +
        '<div class="sd-sec"><h4>Location</h4>' + where +
          '<p class="sd-fine">The barangay comes from the GPS location, or from the sender\'s profile when there is no location.</p></div>',
      footer:
        '<button class="ug-btn" data-modal-close>Close</button>' +
        (s.report_id ? '<button class="ug-btn" data-act="open-incident" data-id="' + esc(s.report_id) + '">' + I('doc', 14) + 'Open report</button>' : '') +
        (canLink ? '<button class="ug-btn" data-act="sos-link-report" data-id="' + esc(s.id) + '">Link incident report</button>' : '') +
        (st8 === 'acknowledged' && !s.needs_receipt && answersSos(st) ? '<button class="ug-btn" data-act="sos-resolve" data-id="' + esc(s.id) + '">' + I('check', 14) + 'Mark resolved</button>' : '') +
        (s.needs_receipt && answersSos(st) ? '<button class="ug-btn ug-btn--signal sd-ack" data-act="sos-ack" data-id="' + esc(s.id) + '">' + I('check', 14) + 'Acknowledge</button>' : ''),
      /* MapView holds one map at a time, so the mini map replaced the page's
         map; re-render on close to bring the page map back */
      onClose: () => {
        if (hasFix && typeof MapView !== 'undefined') {
          try { MapView.destroy(); } catch (e) {}
          try { (window.APP_RENDER || function () {})(); } catch (e) {}
        }
      },
      onMount: (wrap) => {
        wrap.classList.add('sd-modal');
        /* the teams actually on the report, once loaded */
        if (s.report_id && typeof Repo !== 'undefined' && Repo.loadDispatches) {
          Repo.loadDispatches(s.report_id).then((rows) => {
            const live = (rows || []).filter((d) => d.dispatch_status !== 'declined');
            const box = wrap.querySelector('[data-sos-teams]');
            if (!box || !live.length) return;
            box.innerHTML = teamsHtml(live.map((d) => (d.assignment_role === 'lead' ? 'Lead · ' : d.assignment_role === 'support' ? 'Support · ' : '') + d.team + (d.dispatch_status ? ' · ' + String(d.dispatch_status).replace(/_/g, ' ') : '')));
            const note = wrap.querySelector('[data-sos-teams-note]');
            if (note) note.remove();
          }).catch(() => {});
        }
        /* mount the mini map after the modal is in the DOM. Unbounded: an SOS
           sent from outside Lingayen must still show where it came from. */
        if (hasFix && typeof MapView !== 'undefined' && window.L) {
          const el = wrap.querySelector('[data-map="sos-detail"]');
          /* the SOS pin, and the teams on their way with their trail and the
             road ahead (js/map.js drawTracks) */
          const KIND = { medical: 'Medical', fire: 'Fire', crime: 'Crime / violence', rescue: 'Rescue', other: 'Other' };
          const pin = [{ id: s.id, lat: s.lat, lng: s.lng, name: s.profile_name || '', kind: KIND[s.kind] || '', at: s.created_at }];
          const model = s.report_id && window.UG_APP && UG_APP.responseFor ? UG_APP.responseFor(s.report_id) : null;
          const incident = model ? model.incident : { uuid: 'sos-' + s.id, lat: s.lat, lng: s.lng, sev: 'emergency', id: 'SOS', brgy: s.barangay || '', hazard: 'SOS', status: 'reported', corr: 0 };
          if (el) MapView.mount(el, { center: [s.lat, s.lng], zoom: 16, unbounded: true, tracking: true,
              incidents: [incident], units: model ? model.units : [], sos: pin }).then(() => {
            const units = model ? model.units : [];
            const m = MapView.getMap();
            if (m && units.length) {
              const pts = [[s.lat, s.lng]].concat(units.map((u) => [u.lat, u.lng]), units.filter((u) => u.trail && u.trail[0]).map((u) => u.trail[0]));
              try { m.fitBounds(pts, { paddingTopLeft: [30, 30], paddingBottomRight: [30, 52], maxZoom: 16 }); } catch (e) {}
            }
          });
        }
      }
    });
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap ug-phead" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { kindLabel, floatingButton, mSos, dSos, sosDetailModal, activeStrip, toggleDock, tracking, head };
})();
