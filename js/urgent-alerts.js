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
 * pending queue. Multiple emergencies stack in reverse-chronological order.
 */
const UG_URGENT = (function () {
  const esc = UG_UTIL.esc, I = UG.icon;
  let host = null;
  const ACKED_KEY = 'uniguard.urgent.acked';

  /* the IDs we've already shown so a refresh doesn't re-fire the same one */
  function ackedIds() {
    try { return JSON.parse(localStorage.getItem(ACKED_KEY) || '[]'); } catch (e) { return []; }
  }
  function markAcked(id) {
    if (!id) return;
    const arr = ackedIds();
    if (arr.indexOf(id) === -1) { arr.push(id); try { localStorage.setItem(ACKED_KEY, JSON.stringify(arr.slice(-60))); } catch (e) {} }
  }
  function isAcked(id) { return ackedIds().indexOf(id) !== -1; }

  /* scan() runs after every live refresh, not just at boot: never stack a
     second card for an alert already on screen, and keep one closed with the
     X (which does not acknowledge) from popping back until the next page load */
  const shown = new Set();
  const closed = new Set();

  /* ----------------------------------------------------------- audio */
  /* the hazard's own alarm (js/alarm.js), read from the advisory text; the
     overlay is forced audible even right after another alarm */
  let toneAt = 0;
  function playTone(advisory) {
    if (Date.now() - toneAt < 1500) return;   /* never two alarms on top of each other */
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
      const act = btn.dataset.act;
      const id = btn.dataset.id || '';
      if (act === 'urgent-mute') { mutedNow = true; stopLoop(); return; }
      if (act === 'urgent-sound-help') { try { UG_ALARM.soundHelp(); } catch (err) { } return; }
      if (act === 'urgent-sound') { if (loopAd) startLoop(loopAd); return; }
      if (act === 'urgent-dismiss') {
        dismiss(id);
      } else if (act === 'urgent-view') {
        dismiss(id);
        /* notify the app to navigate to the advisory */
        try { document.dispatchEvent(new CustomEvent('ug:urgent-view', { detail: { id: id } })); } catch (e) {}
      }
    });
    document.body.appendChild(host);
    return host;
  }

  function fire(advisory) {
    if (!advisory || !advisory.id) return;
    if (advisory.severity !== 'emergency') return;
    if (isAcked(advisory.id)) return;
    if (shown.has(advisory.id) || closed.has(advisory.id)) return;
    shown.add(advisory.id);
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
        '<div class="ux-acts">' +
          '<button class="ux-ack" data-act="urgent-dismiss" data-id="' + esc(advisory.id) + '"><span class="ux-ack-i">' + I('check', 14) + '</span>Acknowledge</button>' +
          '<button class="ux-view" data-act="urgent-view" data-id="' + esc(advisory.id) + '">View advisory' + I('chevron', 14) + '</button>' +
        '</div>' +
      '</div>';
    h.appendChild(card);
    /* animate in */
    requestAnimationFrame(() => card.classList.add('is-on'));
    /* fire sound + vibration only here, not for routine advisories; it
       repeats until the alert is acknowledged, closed or muted */
    startLoop(advisory);
  }

  function dismiss(id) {
    stopLoop(); loopAd = null;
    if (id) markAcked(id);
    shown.forEach((s) => closed.add(s));
    shown.clear();
    if (!host) return;
    const cards = host.querySelectorAll('.ug-urgent');
    cards.forEach((c) => { c.classList.remove('is-on'); });
    setTimeout(() => {
      if (!host) return;
      host.querySelectorAll('.ug-urgent').forEach((c) => c.remove());
      if (!host.children.length) host.style.display = 'none';
    }, 280);

    /* log the acknowledgment through Repo, best-effort */
    try {
      if (typeof Repo !== 'undefined' && Repo.client && id) {
        const c = Repo.client();
        if (c) c.from('alert_acknowledgments').insert({ advisory_id: id }).then(() => {}, () => {});
      }
    } catch (e) {}
  }

  /* called from app.js after every loadAll: scan advisories, fire any
     emergency ones that haven't been acknowledged on this device yet */
  function scan() {
    const ads = (typeof UG !== 'undefined' && UG.DATA && UG.DATA.advisories) || [];
    /* newest first; only the most recent emergency fires at a time so the
       overlay doesn't pile up if multiple emergencies are live */
    const newest = ads.find((a) => a.severity === 'emergency' && !isAcked(a.id));
    if (newest) fire(newest);
  }

  return { fire, dismiss, scan, isAcked };
})();
