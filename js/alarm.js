/* UniGuard · alarm sounds
 *
 * One loud, unmistakable alarm per kind of hazard, so the person on duty can
 * tell what came in before they look at the screen:
 *   fire        fast rising-and-falling siren
 *   water       slow wail (flood, river, storm surge, coastal)
 *   wind        pulsing horn (typhoon, strong wind, fallen tree)
 *   earth       low heavy pulses (earthquake, landslide)
 *   infra       hi-lo ambulance tone (road damage, vehicular accident)
 *   sos         rapid triple beeps, repeated
 *   dispatch    rising three-note call (a new assignment for a unit)
 *   help        bright rising chime (help is on the way / has arrived)
 *   attention   low-high double horn (something needs a person's decision)
 *   admin       three-note chime (an approval is waiting)
 *   other       two-tone alert
 *
 * Which events ring depends on the portal (ROLE_ALARMS below): a resident
 * hears help coming, an official hears their barangay, the LGU hears the
 * whole town, the Super Admin hears what needs oversight, a unit hears its
 * assignments.
 *
 * Built with Web Audio, so there is no sound file to download or cache.
 * Browsers only allow sound after the person has touched the page once;
 * unlock() runs on the first tap or key press. The on/off choice lives on
 * this device (Settings → Notifications → Alarm sound).
 */
const UG_ALARM = (function () {
  const MUTE_KEY = 'uniguard.alarm.muted';
  let ctx = null;
  let lastAt = 0;
  let pendingSosTone = null;
  let pendingDispatchTone = null;

  function stopPendingDispatch() {
    if (!pendingDispatchTone) return;
    pendingDispatchTone.disconnect();
    pendingDispatchTone = null;
  }

  function stopPendingSos() {
    if (!pendingSosTone) return;
    pendingSosTone.disconnect();
    pendingSosTone = null;
  }

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
    return ctx;
  }
  /* a console left open without a tap stays silent (browser autoplay rule);
     the app shows an "enable alarm sound" banner until this fires */
  function unlock() {
    const was = !needsUnlock();
    try { audio(); } catch (e) { }
    if (!was && ctx) {
      const done = () => { if (!needsUnlock()) { try { document.dispatchEvent(new CustomEvent('ug:alarm-unlocked')); } catch (e) { } } };
      if (ctx.state === 'running') done(); else setTimeout(done, 150);
    }
  }
  function needsUnlock() {
    if (!(window.AudioContext || window.webkitAudioContext)) return false;
    return !ctx || ctx.state !== 'running';
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
    document.addEventListener(ev, unlock, { passive: true });
  });

  /* the alarm is always on (no mute): an old saved "muted" is cleared */
  try { localStorage.removeItem(MUTE_KEY); } catch (e) { }
  function muted() {
    return false;
  }
  function setMuted(on) {
    try { localStorage.removeItem(MUTE_KEY); } catch (e) { }   /* always on: muting is not offered */
  }

  /* each pattern is a list of [startHz, endHz, seconds, wave] steps (endHz 0
     = silence), played `times` times in a row */
  const PATTERNS = {
    fire:     { times: 6, steps: [[650, 1450, 0.28, 'square'], [1450, 650, 0.28, 'square']] },
    water:    { times: 2, steps: [[420, 920, 1.0, 'sawtooth'], [920, 420, 1.0, 'sawtooth']] },
    wind:     { times: 6, steps: [[520, 520, 0.22, 'square'], [0, 0, 0.14], [620, 620, 0.22, 'square'], [0, 0, 0.14]] },
    earth:    { times: 5, steps: [[180, 140, 0.38, 'sawtooth'], [0, 0, 0.14], [240, 180, 0.24, 'sawtooth'], [0, 0, 0.1]] },
    infra:    { times: 5, steps: [[960, 960, 0.36, 'square'], [770, 770, 0.36, 'square']] },
    sos:      { times: 4, steps: [[1050, 1050, 0.12, 'square'], [0, 0, 0.07], [1050, 1050, 0.12, 'square'], [0, 0, 0.07],
                                  [1050, 1050, 0.12, 'square'], [0, 0, 0.35]] },
    dispatch: { times: 3, steps: [[660, 660, 0.18, 'square'], [880, 880, 0.18, 'square'], [1100, 1100, 0.3, 'square'], [0, 0, 0.3]] },
    help:      { times: 3, steps: [[523, 523, 0.16, 'triangle'], [659, 659, 0.16, 'triangle'], [784, 784, 0.16, 'triangle'], [1047, 1047, 0.34, 'triangle'], [0, 0, 0.3]] },
    attention: { times: 4, steps: [[392, 392, 0.3, 'sawtooth'], [0, 0, 0.06], [587, 587, 0.42, 'sawtooth'], [0, 0, 0.22]] },
    admin:     { times: 2, steps: [[784, 784, 0.2, 'triangle'], [988, 988, 0.2, 'triangle'], [1175, 1175, 0.4, 'triangle'], [0, 0, 0.4]] },
    other:    { times: 4, steps: [[880, 880, 0.3, 'square'], [660, 660, 0.3, 'square']] }
  };

  /* what rings in each portal, shown in Settings → Notifications; `test` is
     the sound the Test alarm button plays there */
  const ROLE_ALARMS = {
    citizen: { test: 'help', events: [
      'Emergency alerts for Lingayen: the hazard\'s own alarm',
      'A response team dispatched to your report or SOS',
      'The team arriving at the scene'] },
    barangay_official: { test: 'water', events: [
      'A new report in your barangay: the hazard\'s own alarm',
      'An SOS from a resident of your barangay',
      'Your Barangay Response Team being dispatched'] },
    lgu_ldrrmc: { test: 'fire', events: [
      'A new report anywhere in Lingayen: the hazard\'s own alarm',
      'Every SOS',
      'A team that could not be sent automatically (no free unit, no team for the hazard)'] },
    super_admin: { test: 'admin', events: [
      'Every SOS',
      'A new Emergency-severity report: the hazard\'s own alarm',
      'A team that could not be sent automatically',
      'A change request waiting for your approval'] },
    dispatch_team: { test: 'dispatch', events: [
      'A new dispatch for your unit: the hazard\'s own alarm',
      'A patient notice for your hospital'] }
  };
  function roleAlarms(role, superAdmin) {
    return ROLE_ALARMS[superAdmin ? 'super_admin' : role] || ROLE_ALARMS.citizen;
  }

  /* which pattern a hazard label, a hazard key or a free-text alert title
     belongs to. Known hazards use their group from js/hazard-types.js; free
     text (an advisory title) is matched on keywords, English and Filipino. */
  function groupFor(text) {
    const raw = String(text || '').trim();
    if (!raw) return 'other';
    if (PATTERNS[raw]) return raw;
    if (typeof UG_HAZARDS !== 'undefined') {
      const h = UG_HAZARDS.classify(raw);
      if (h && h.key !== 'other') return h.group === 'coastal' ? 'water' : h.group;
    }
    const t = raw.toLowerCase();
    if (/\bsos\b/.test(t)) return 'sos';
    if (/fire|sunog|power line|electric|kuryente/.test(t)) return 'fire';
    if (/flood|baha|river|ilog|storm surge|tsunami|rain|ulan|dam|coastal|tide/.test(t)) return 'water';
    if (/typhoon|bagyo|wind|hangin|signal no|tree|puno/.test(t)) return 'wind';
    if (/earthquake|lindol|landslide|guho|erosion/.test(t)) return 'earth';
    if (/accident|aksidente|road|kalsada|vehicle|traffic/.test(t)) return 'infra';
    return 'other';
  }

  /* play the alarm for a hazard / 'sos' / 'dispatch'. Overlapping calls (a
     burst of new reports) play one alarm, not a pile-up; an SOS is never
     swallowed by an alarm that just played. */
  function play(kind, opts) {
    opts = opts || {};
    if (muted() && !opts.force) return false;
    const now = Date.now();
    if (!opts.force && kind !== 'sos' && now - lastAt < 4000) return false;
    lastAt = now;
    try { if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 800]); } catch (e) { }
    const ac = audio();
    if (!ac) return false;
    try {
      const p = PATTERNS[groupFor(kind)] || PATTERNS.other;
      const master = ac.createGain();
      master.gain.value = opts.pendingDispatch ? 0.52 : 0.32;
      if (opts.pendingSos) {
        stopPendingSos();
        pendingSosTone = master;
      }
      if (opts.pendingDispatch) {
        stopPendingDispatch();
        pendingDispatchTone = master;
      }
      master.connect(ac.destination);
      let t = ac.currentTime + 0.02;
      for (let n = 0; n < p.times; n++) {
        p.steps.forEach((s) => {
          const [f0, f1, dur, wave] = s;
          if (f0 > 0) {
            const osc = ac.createOscillator();
            const g = ac.createGain();
            osc.type = wave || 'square';
            osc.frequency.setValueAtTime(f0, t);
            if (f1 !== f0) osc.frequency.linearRampToValueAtTime(f1, t + dur);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(1, t + 0.02);
            g.gain.setValueAtTime(1, t + Math.max(0.02, dur - 0.03));
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.connect(g).connect(master);
            osc.start(t);
            osc.stop(t + dur + 0.02);
          }
          t += dur;
        });
      }
      return true;
    } catch (e) { return false; }   /* sound is an enhancement, never a blocker */
  }

  /* "Always allow alarm sound": browsers block sound until the page is
     tapped; this shows how to let UniGuard ring right away, with the steps
     for the browser the person is using. Opens above the emergency card. */
  function soundHelp() {
    if (typeof UG_FEATURES === 'undefined' || !UG_FEATURES.modal) return;
    const ua = navigator.userAgent || '';
    const b = /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : (/Safari\//.test(ua) && !/Chrome\//.test(ua)) ? 'safari' : 'chrome';
    const phone = /Android|iPhone|iPad/i.test(ua);
    const installed = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const I = (n) => (typeof UG !== 'undefined' && UG.icon) ? UG.icon(n, 15) : '';
    const steps = {
      chrome: ['Click the icon to the left of the web address (the slider or lock).', 'Choose <b>Site settings</b>.', 'Find <b>Sound</b> and set it to <b>Allow</b>.', 'Come back to UniGuard and reload once.'],
      edge: ['Click the lock icon to the left of the web address.', 'Choose <b>Permissions for this site</b>.', 'Set <b>Media autoplay</b> to <b>Allow</b>.', 'Reload UniGuard once.'],
      firefox: ['Click the icon to the left of the web address.', 'Next to <b>Autoplay</b>, choose <b>Allow Audio and Video</b>.', 'Reload UniGuard once.'],
      safari: ['In the menu bar, choose <b>Safari</b> then <b>Settings for This Website</b>.', 'Set <b>Auto-Play</b> to <b>Allow All Auto-Play</b>.', 'Reload UniGuard once.']
    }[b];
    const name = { chrome: 'Chrome', edge: 'Microsoft Edge', firefox: 'Firefox', safari: 'Safari' }[b];
    const ol = (list) => '<ol class="sh-steps">' + list.map((x, n) => '<li><b>' + (n + 1) + '</b><span>' + x + '</span></li>').join('') + '</ol>';
    UG_FEATURES.modal({
      title: 'Always allow alarm sound',
      body:
        '<p class="sh-lead">Browsers keep websites quiet until you tap the page. Do this once so emergency and SOS alarms ring the moment they arrive.</p>' +
        (!installed && (b === 'chrome' || b === 'edge') ? '<section class="sh-sec sh-best"><h4>' + I('download') + 'Best: install UniGuard as an app</h4>' +
          ol(phone ? ['Open the browser menu (⋮).', 'Choose <b>Install app</b> or <b>Add to Home screen</b>.', 'Open UniGuard from its new icon from now on.']
                   : ['Click the install icon at the right end of the address bar, or the menu (⋯) then <b>Apps</b> then <b>Install UniGuard</b>.', 'Open UniGuard from its own window from now on.']) + '</section>' : '') +
        '<section class="sh-sec"><h4>' + I('settings') + 'Allow sound in ' + name + '</h4>' + ol(steps) + '</section>' +
        '<section class="sh-sec"><h4>' + I('bell') + 'Also turn on push alerts</h4><p>Device notifications play your phone or computer\'s own sound, even when UniGuard is closed. Turn them on in <b>Settings</b> → <b>Alerts</b>.</p></section>' +
        '<p class="sh-fine">On office computers, your IT staff can allow sound for UniGuard on every machine at once (Chrome\'s AutoplayAllowlist policy).</p>',
      footer: '<button class="ug-btn" data-modal-close>Got it</button>',
      onMount: (wrap) => { wrap.classList.add('sh-modal'); }
    });
  }

  return { play, stopPendingSos, stopPendingDispatch, groupFor, muted, setMuted, roleAlarms, needsUnlock, unlock, soundHelp };
})();
window.UG_ALARM = UG_ALARM;
