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

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
    return ctx;
  }
  function unlock() { try { audio(); } catch (e) { } }
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
    document.addEventListener(ev, unlock, { passive: true });
  });

  function muted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }
  function setMuted(on) {
    try { localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch (e) { }
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
     burst of new reports) play one alarm, not a pile-up. */
  function play(kind, opts) {
    opts = opts || {};
    if (muted() && !opts.force) return false;
    const now = Date.now();
    if (!opts.force && now - lastAt < 4000) return false;
    lastAt = now;
    try { if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 800]); } catch (e) { }
    const ac = audio();
    if (!ac) return false;
    try {
      const p = PATTERNS[groupFor(kind)] || PATTERNS.other;
      const master = ac.createGain();
      master.gain.value = 0.32;
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

  return { play, groupFor, muted, setMuted, roleAlarms };
})();
window.UG_ALARM = UG_ALARM;
