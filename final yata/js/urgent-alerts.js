/* UniGuard · Urgent alerts overlay
 *
 * Full-screen, dismissible banner that fires ONLY for severity === 'emergency'
 * advisories. Plays a short alert tone and vibrates the device (both gated by
 * user permission / capability), and logs an acknowledgment row through the
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
  let audioCtx = null;
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

  /* ----------------------------------------------------------- audio */
  /* Web Audio is widely available and needs no asset. Two short beeps, only
     for emergency severity. */
  function playTone() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [0, 0.35].forEach((delay, k) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(k === 0 ? 880 : 660, now + delay);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.25);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.3);
      });
    } catch (e) { /* audio is enhancement, never a blocker */ }
  }

  function vibrate() {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
  }

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
    const h = ensureHost();
    const tone = 'emergency';
    const card = document.createElement('div');
    card.className = 'ug-urgent ug-urgent--' + tone;
    card.innerHTML =
      '<div class="ug-urgent-strip"></div>' +
      '<div class="ug-urgent-body">' +
        '<div class="ug-urgent-head">' +
          '<span class="ug-urgent-icon">' + I('alert', 28) + '</span>' +
          '<div><div class="ug-urgent-kicker">EMERGENCY ALERT</div>' +
          '<h3 class="ug-urgent-title">' + esc(advisory.title || 'Active emergency') + '</h3></div>' +
          '<button class="ug-urgent-close" data-act="urgent-dismiss" aria-label="Dismiss"></button>' +
        '</div>' +
        '<p class="ug-urgent-text">' + esc(advisory.body || '') + '</p>' +
        '<div class="ug-urgent-meta">' + I('pin', 14) + ' ' + esc(advisory.area || UG_GEO.PLACE.areaAll) +
          ' &middot; ' + I('clock', 14) + ' ' + esc(advisory.time || 'just now') + '</div>' +
        '<div class="ug-urgent-actions">' +
          '<button class="ug-btn ug-btn--signal" data-act="urgent-dismiss" data-id="' + esc(advisory.id) + '">Acknowledge</button>' +
          '<button class="ug-btn ug-btn--ghost" data-act="urgent-view" data-id="' + esc(advisory.id) + '">View advisory</button>' +
        '</div>' +
      '</div>';
    h.appendChild(card);
    /* animate in */
    requestAnimationFrame(() => card.classList.add('is-on'));
    /* fire sound + vibration only here, not for routine advisories */
    playTone();
    vibrate();
  }

  function dismiss(id) {
    if (id) markAcked(id);
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
