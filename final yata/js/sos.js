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

  /* the citizen SOS confirmation screen */
  function mSos(st) {
    const last = st.lastSos;
    const sending = st.sosSending;
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">One-Tap Emergency</div>' +
      '<h2 style="font-size:19px;margin-top:3px">SOS</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">One tap sends your current GPS position, your name and your contact number to the LGU/LDRRMO duty officer. Use only when you are in immediate danger.</p></div>' +

      '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:14px;align-items:center;text-align:center;padding:22px 18px">' +
        '<span class="ug-sos-circle' + (sending ? ' is-sending' : '') + '" data-act="sos-trigger">' + I('alert', 36) + '</span>' +
        '<h3 style="font-size:18px">' + (sending ? 'Sending SOS…' : 'Tap to Send SOS') + '</h3>' +
        '<p class="ug-dim" style="font-size:12px;line-height:1.5;max-width:300px">Hold still for a moment so we can read your GPS. A confirmation will appear here when the SOS has been logged.</p>' +
        (last ? '<div class="ug-badge ug-badge--resolved">Sent · ' + esc(last.at) + '</div>' : '') +
      '</div></div>' +

      (last ? '<div class="ug-card"><div class="ug-card-h"><h3>Last SOS</h3>' + U.badge('id', last.id || 'PENDING') + '</div>' +
        '<div class="ug-card-b ug-col" style="gap:11px">' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Position</span>' +
            '<span class="ug-mono">' + esc(last.lat != null ? UG_GEO.fmt(last.lat, last.lng) : 'pending') + '</span></div>' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Accuracy</span>' +
            '<span class="ug-mono">' + (last.accuracy != null ? last.accuracy + ' m' : '—') + '</span></div>' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Sent at</span>' +
            '<span class="ug-mono">' + esc(last.at) + '</span></div>' +
          '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Reached</span>' +
            '<span class="ug-mono">' + esc((last.reach != null ? last.reach : '—') + ' duty officers') + '</span></div>' +
        '</div></div>' : '') +

      '<div class="ug-card"><div class="ug-card-h"><h3>Backup Hotline</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:10px">' +
          '<p class="ug-dim" style="font-size:11.5px;line-height:1.55">If you cannot reach the LGU through the app, call the MDRRMO hotline directly. The call works even when the data signal is too weak for the SOS to send.</p>' +
          '<button class="ug-btn ug-btn--signal ug-btn--block"' + A('call', attr({ num: '(075) 632-2222', agency: 'Lingayen MDRRMO' })) + '>' + I('phone', 16) + 'Call Lingayen MDRRMO</button>' +
        '</div></div>' +

      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-warning);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-note">SOS is rate-limited to 5 calls per 10 minutes. False alarms take the duty officer away from real emergencies.</div></div></div>' +
    '</div>';
  }

  /* the LGU view: list of recent SOS events */
  function dSos(st) {
    const rows = UG.DATA.sosLog || [];
    return '<div class="ug-col" style="gap:18px">' +
      head('SOS Log', 'Every one-tap SOS received from a citizen, newest first.',
        '<span class="ug-chip is-on">' + rows.length + ' events</span>') +
      '<div class="ug-card"><div class="ug-rows ug-scroll" style="max-height:540px">' + (rows.length ? rows.map((s) =>
        '<div class="ug-row"><span class="r-dot" style="background:var(--ug-emergency)"></span>' +
          '<div class="r-main"><div class="r-t">' + esc(s.profile_name || 'Resident') + '</div>' +
            '<div class="r-m"><span class="ug-mono">' + esc(s.profile_phone || '') + '</span>' +
              '<span>' + I('pin', 12) + (s.lat != null ? UG_GEO.fmt(s.lat, s.lng) : 'no fix') + '</span>' +
              '<span>' + I('clock', 12) + esc(s.time || '') + '</span></div></div>' +
            U.badge('emergency', 'SOS') +
            (s.lat != null ? '<a class="ug-waze-btn" style="margin-left:6px" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(s.lat, s.lng) + '">' + I('route', 13) + '</a>' : '') +
          '</div>').join('') :
        '<div class="ug-empty"><span class="e-ico">' + I('alert', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No SOS events yet</div>' +
        '<div class="ug-dim" style="font-size:11px">When a citizen sends one, it appears here in real time.</div></div>') + '</div></div>' +
    '</div>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { floatingButton, mSos, dSos, head };
})();
