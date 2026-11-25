/* UniGuard · Urgent alerts overlay
 *
 * Full-screen, dismissible banner that fires ONLY for severity === 'emergency'
 * advisories. Sounds the hazard's alarm and vibrates the device (js/alarm.js,
 * gated by user permission / capability), and logs an acknowledgment row through the
 * alert_acknowledgments table (migration 015) so the LGU can prove a resident
 * saw the alert.
 *
 * Routine advisories (warning, advisory, preparedness) never trigger this —
 * they only land in the notification inbox, so citizens do not get alert
 * fatigue.
 *
 * The overlay is a single element appended to <body>, driven by a small
 * pending queue. Each emergency gets its own card and acknowledgment.
 */
const UG_URGENT = (function () {
  const esc = UG_UTIL.esc, I = UG.icon;
  let host = null;
  const ACKED_KEY = 'uniguard.urgent.acked.';
  const ownerId = () => window.UG_APP?.S.session?.id;
  const receipts = (owner) => {
    try {
      const value = JSON.parse(localStorage.getItem(ACKED_KEY + owner) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (e) { return {}; }
  };
  function storeReceipt(owner, id, status) {
    const all = receipts(owner);
    all[id] = status;
    try { localStorage.setItem(ACKED_KEY + owner, JSON.stringify(all)); } catch (e) {}
  }
  const isAcked = (id) => !!ownerId() && Object.hasOwn(receipts(ownerId()), id);

  const syncing = new Set();
  async function flushReceipts() {
    const owner = ownerId();
    if (!owner || owner !== Auth.state.session?.id || navigator.onLine === false || syncing.has(owner)) return;
    const waiting = Object.entries(receipts(owner)).filter(([, status]) => status === 'pending');
    if (!waiting.length) return;
    syncing.add(owner);
    try {
      const upload = await Repo.queueUploadSession(owner);
      if (!upload) return;
      for (const [id] of waiting) {
        if (ownerId() !== owner || Auth.state.session?.id !== owner) break;
        const { error } = await upload.client.rpc('acknowledge_emergency_advisory', { p_advisory_id: id });
        if (error) continue;
        storeReceipt(owner, id, 'saved');
      }
    } finally { syncing.delete(owner); }
  }
  const syncReceipts = () => flushReceipts().catch(() => {});
  window.addEventListener('online', syncReceipts);

  let current = null;
  let expiryTimer = null;
  const closed = new Set();
  const pending = new Map();
  function isActive(advisory) {
    return !!advisory?.id && advisory.severity === 'emergency' &&
      advisory.active !== false && advisory.status !== 'draft' &&
      !(Date.parse(advisory.expires_at) <= Date.now());
  }

  /* ----------------------------------------------------------- audio */
  /* the hazard's own alarm (js/alarm.js), read from the advisory text; the
     overlay is forced audible even right after another alarm */
  let toneAt = 0;
  function playTone(advisory) {
    if (!isActive(advisory) || Date.now() - toneAt < 1500) return;   /* never two alarms on top of each other */
    toneAt = Date.now();
    try { UG_ALARM.play((advisory.title || '') + ' ' + (advisory.body || ''), { force: true }); } catch (e) { }
  }

  /* the alarm keeps sounding while the alert is on screen (every 6 s, for up
     to two minutes) until it is acknowledged, closed or muted. A browser that
     blocked sound until the first tap starts the alarm on that tap. */
  let loop = null, loopAd = null, loopLeft = 0, mutedNow = false;
  function startLoop(advisory) {
    stopLoop();
    loopAd = advisory; loopLeft = 20; mutedNow = false;
    playTone(advisory);
    loop = setInterval(() => {
      if (mutedNow || --loopLeft <= 0) { stopLoop(); return; }
      playTone(loopAd);
    }, 6000);
    syncSound();
  }
  function stopLoop() { if (loop) clearInterval(loop); loop = null; syncSound(); }
  function syncSound() {
    if (!host) return;
    const blocked = (typeof UG_ALARM !== 'undefined' && UG_ALARM.needsUnlock && UG_ALARM.needsUnlock());
    host.querySelectorAll('[data-ux-sound]').forEach((el) => {
      const on = !!loop && !mutedNow;
      el.classList.toggle('is-on', on && !blocked);
      el.classList.toggle('is-blocked', on && blocked);
      el.querySelector('span').textContent = mutedNow ? 'Alarm muted' : !loop ? 'Alarm stopped' : blocked ? 'Tap anywhere to sound the alarm' : 'Alarm sounding';
      const b = el.querySelector('button');
      if (b) { b.textContent = mutedNow || !loop ? 'Play again' : 'Mute'; b.dataset.act = mutedNow || !loop ? 'urgent-sound' : 'urgent-mute'; }
    });
  }
  document.addEventListener('ug:alarm-unlocked', () => { if (loop && loopAd && !mutedNow) { playTone(loopAd); syncSound(); } });
  /* belt and braces for browsers that resume audio a beat after the tap */
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, () => {
    if (!loop || !loopAd || mutedNow) return;
    setTimeout(() => { try { if (!UG_ALARM.needsUnlock()) { playTone(loopAd); syncSound(); } } catch (e) { } }, 120);
  }, { passive: true, capture: true }));

  /* ----------------------------------------------------------- rendering */
  function ensureHost() {
    if (host) return host;
    host = document.createElement('div');
    host.className = 'ug-urgent-host';
    host.setAttribute('aria-live', 'assertive');
    /* the overlay lives on document.body (outside #ug-root), so the existing
       delegated click handler in app.js does NOT reach it. Bind a direct
       listener here for the dismiss / view actions. */
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      e.stopPropagation();
      const act = btn.dataset.act;
      const id = btn.dataset.id || '';
      if (act === 'urgent-mute') { mutedNow = true; stopLoop(); return; }
      if (act === 'urgent-sound-help') { try { UG_ALARM.soundHelp(); } catch (err) { } return; }
      if (act === 'urgent-sound') { if (loopAd) startLoop(loopAd); return; }
      if (act === 'urgent-dismiss') {
        dismiss(id || btn.closest('.ug-urgent')?.dataset.id, !!id);
      } else if (act === 'urgent-view') {
        dismiss(id, true);
        /* notify the app to navigate to the advisory */
        try { document.dispatchEvent(new CustomEvent('ug:urgent-view', { detail: { id: id } })); } catch (e) {}
      }
    });
    document.body.appendChild(host);
    return host;
  }

  function fire(advisory) {
    if (current && current.advisory.id === advisory?.id) {
      current.advisory.expires_at = advisory.expires_at ?? current.advisory.expires_at;
      clearTimeout(expiryTimer);
      if (!isActive(current.advisory)) dismiss(advisory.id);
      else scheduleExpiry();
      return;
    }
    if (!ownerId() || !isActive(advisory) || isAcked(advisory.id) || closed.has(advisory.id)) return;
    if (current) {
      if (current.advisory.id !== advisory.id) pending.set(advisory.id, advisory);
      return;
    }
    const h = ensureHost();
    h.style.display = '';   /* dismiss() hides the host once it empties */
    const tone = 'emergency';
    const hz = (typeof UG_HAZARDS !== 'undefined') ? UG_HAZARDS.classify((advisory.title || '') + ' ' + (advisory.body || '')) : null;
    const hzIcon = hz && hz.key !== 'other' ? hz.icon : 'alert';
    const card = document.createElement('div');
    card.className = 'ug-urgent ug-urgent--' + tone + ' ux';
    card.dataset.id = advisory.id;
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-label', 'Emergency alert: ' + (advisory.title || ''));
    card.innerHTML =
      '<header class="ux-top">' +
        '<span class="ux-ico"><i></i><i></i>' + I(hzIcon, 26) + '</span>' +
        '<div class="ux-ht"><div class="ux-kick">' + I('alert', 12) + 'Emergency alert</div>' +
          '<h3 class="ux-title">' + esc(advisory.title || 'Active emergency') + '</h3></div>' +
        '<button class="ux-x" data-act="urgent-dismiss" aria-label="Close without acknowledging" title="Close">' + I('x', 16) + '</button>' +
      '</header>' +
      '<div class="ux-body">' +
        (advisory.body ? '<p class="ux-text">' + esc(advisory.body) + '</p>' : '') +
        '<div class="ux-meta">' +
          '<span>' + I('pin', 13) + esc(advisory.area || UG_GEO.PLACE.areaAll) + '</span>' +
          '<span>' + I('clock', 13) + esc(advisory.time || 'just now') + '</span>' +
          '<span>' + I('shield', 13) + 'Official advisory' + (advisory.code ? ' · ' + esc(advisory.code) : '') + '</span>' +
        '</div>' +
        '<div class="ux-sound" data-ux-sound><i aria-hidden="true"></i><span role="status">Alarm stopped</span>' +
          '<button type="button" data-act="urgent-sound">Play again</button></div>' +
        '<div class="ux-acts">' +
          '<button class="ux-ack" data-act="urgent-dismiss" data-id="' + esc(advisory.id) + '"><span class="ux-ack-i">' + I('check', 14) + '</span>Acknowledge</button>' +
          '<button class="ux-view" data-act="urgent-view" data-id="' + esc(advisory.id) + '">View advisory' + I('chevron', 14) + '</button>' +
        '</div>' +
      '</div>';
    current = { advisory, card };
    h.appendChild(card);
    /* animate in */
    requestAnimationFrame(() => card.classList.add('is-on'));
    /* fire sound + vibration only here, not for routine advisories; it
       repeats until the alert is acknowledged, closed or muted */
    startLoop(advisory);
    scheduleExpiry();
  }

  function scheduleExpiry() {
    const expiry = Date.parse(current?.advisory.expires_at);
    if (!Number.isFinite(expiry)) return;
    const delay = expiry - Date.now();
    if (delay <= 0) { dismiss(current.advisory.id); return; }
    expiryTimer = setTimeout(scheduleExpiry, Math.min(delay, 2147483647));
  }

  function removeCurrent() {
    if (!current) return;
    const { advisory, card } = current;
    closed.add(advisory.id);
    clearTimeout(expiryTimer);
    expiryTimer = null;
    stopLoop();
    loopAd = null;
    current = null;
    card.remove();
    if (!host.children.length) host.style.display = 'none';
  }

  function dismiss(id, acknowledge = false) {
    if (!id) {
      for (const key of pending.keys()) closed.add(key);
      pending.clear();
      removeCurrent();
      return;
    }
    if (current?.advisory.id !== id) return;
    const owner = ownerId();
    if (acknowledge && owner) {
      storeReceipt(owner, id, 'pending');
      syncReceipts();
    }
    removeCurrent();
    scan();
  }

  function reset() {
    dismiss();
    closed.clear();
  }

  function scan() {
    syncReceipts();
    if (!ownerId() || window.UG_APP?.S.session?.role === 'dispatch_team') return;
    if (current && !isActive(current.advisory)) removeCurrent();
    if (current) return;
    const ads = UG.DATA.advisories || [];
    for (const advisory of [...pending.values(), ...ads]) {
      pending.delete(advisory.id);
      fire(advisory);
      if (current) return;
    }
  }

  return { fire, dismiss, scan, isAcked, reset };
})();
