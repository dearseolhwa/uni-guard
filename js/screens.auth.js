/* UniGuard · account screens
 *
 * Sign in, create account, confirm email, forgot password and set new password.
 * The layout, map art, brand block and ug-field / ug-in / ug-btn styles are the
 * same ones the approved prototype used. There are no demo accounts and no
 * prefilled credentials anywhere.
 */
const UG_AUTH = (function () {
  const esc = UG_UTIL.esc;
  const I = UG.icon;

  function field(id, label, opts) {
    opts = opts || {};
    const type = opts.type || 'text';
    const reveal = opts.reveal ? (opts.revealed ? 'text' : 'password') : null;
    const inputType = reveal || type;
    const input = opts.textarea
      ? '<textarea class="ug-ta" rows="' + (opts.rows || 3) + '" data-field="' + id + '" placeholder="' + esc(opts.ph || '') + '" aria-label="' + esc(label) + '">' + esc(opts.value || '') + '</textarea>'
      : '<input class="ug-in" type="' + inputType + '" data-field="' + id + '" value="' + esc(opts.value || '') +
        '" placeholder="' + esc(opts.ph || '') + '" aria-label="' + esc(label) + '" autocomplete="' + (opts.ac || 'off') +
        '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') +
        (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : '') + '>';
    const ICON = {
      mail: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
      lock: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
      user: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
      phone: I('phone', 17)
    };
    const lead = opts.icon && ICON[opts.icon] ? '<span class="ua3-ico">' + ICON[opts.icon] + '</span>' : '';
    const toggle = opts.reveal
      ? '<button type="button" class="ug-auth-reveal" data-act="toggle-reveal" data-for="' + id + '" ' +
        'aria-pressed="' + (opts.revealed ? 'true' : 'false') + '" aria-label="' + (opts.revealed ? 'Hide password' : 'Show password') + '">' +
        I(opts.revealed ? 'x' : 'eye', 16) + '</button>'
      : '';
    return '<div class="ug-field" style="margin-bottom:14px"><label class="ug-lab">' + esc(label) + '</label>' +
      '<div class="ug-auth-inwrap' + (lead ? ' has-ico' : '') + '">' + lead + input + toggle + '</div>' +
      (opts.help ? '<div class="ug-help">' + esc(opts.help) + '</div>' : '') +
      (opts.error ? '<div class="ug-help ug-auth-fielderror">' + esc(opts.error) + '</div>' : '') +
      '</div>';
  }

  /* Custom UniGuard combo box. Renders as a button that opens a styled panel
   * with a search field and a scrollable list. A hidden input with the same
   * data-field keeps the existing form-collection logic working unchanged. */
  function selectField(id, label, options, value, help) {
    const v = String(value || '');
    const selectedOpt = options.find((o) => String(o.id) === v) || null;
    const displayText = selectedOpt ? selectedOpt.name : ('Select ' + label.toLowerCase());

    const listHtml = options.map((o, i) => {
      const sel = String(o.id) === v ? ' is-selected' : '';
      return '<button type="button" class="ug-combo-option' + sel + '" role="option" ' +
        'data-act="select-barangay" data-id="' + esc(String(o.id)) + '" data-name="' + esc(o.name) + '" tabindex="-1">' +
        '<span class="ug-combo-opt-label">' + esc(o.name) + '</span>' +
        '<span class="ug-combo-opt-check" aria-hidden="true">' + I('check', 14) + '</span>' +
        '</button>';
    }).join('');

    return '<div class="ug-field" style="margin-bottom:14px">' +
      '<label class="ug-lab" for="ug-combo-trigger-' + esc(id) + '">' + esc(label) + '</label>' +
      '<div class="ug-combo" data-combo="' + esc(id) + '">' +
        '<input type="hidden" data-field="' + esc(id) + '" value="' + esc(v) + '">' +
        '<button type="button" id="ug-combo-trigger-' + esc(id) + '" class="ug-combo-btn' + (selectedOpt ? ' is-filled' : '') + '" ' +
          'data-act="toggle-barangay-combo" aria-haspopup="listbox" aria-expanded="false" aria-controls="ug-combo-panel-' + esc(id) + '">' +
          '<span class="ug-combo-val' + (selectedOpt ? ' is-selected' : '') + '">' + esc(displayText) + '</span>' +
          '<span class="ug-combo-caret" aria-hidden="true">' + I('chevdn', 16) + '</span>' +
        '</button>' +
        '<div class="ug-combo-panel" id="ug-combo-panel-' + esc(id) + '" role="listbox" aria-label="' + esc(label) + '" hidden>' +
          '<div class="ug-combo-searchwrap">' +
            '<span class="ug-combo-searchico" aria-hidden="true">' + I('search', 15) + '</span>' +
            '<input type="text" class="ug-combo-search" data-act="search-barangay" ' +
              'placeholder="Search barangay..." aria-label="Search ' + esc(label.toLowerCase()) + '" autocomplete="off" spellcheck="false">' +
          '</div>' +
          '<div class="ug-combo-list" role="presentation">' + listHtml + '</div>' +
          '<div class="ug-combo-empty" hidden>No barangays found</div>' +
        '</div>' +
      '</div>' +
      (help ? '<div class="ug-help">' + esc(help) + '</div>' : '') +
      '</div>';
  }

  function message(a) {
    if (!a.error && !a.notice) return '';
    return '<div class="ug-auth-msg ' + (a.error ? 'is-error' : 'is-ok') + '">' +
      I(a.error ? 'alert' : 'check', 16) + '<span>' + esc(a.error || a.notice) + '</span></div>';
  }

  /* Sign-in layout (Nov 2026). Desktop: the flood photo full height on the
     left under a deep crimson shade, with the brand, a headline and what the
     system does; the form on a clean white panel on the right. Phone: the
     photo becomes a header band and the form rises over it on a sheet. An
     emergency strip (911 + the LDRRMO hotline) is always there, so someone
     in danger without an account can still call. Every auth screen uses it. */
  /* desktop keeps the original card (rose backdrop, watermarks, the photo
     cut in a wave), now with motion; phones use the new layout below */
  const isWide = () => !!(window.matchMedia && window.matchMedia('(min-width: 768px)').matches);
  /* ambient loops continue across redraws: each starts at the clock's phase */
  const ph = (sec) => '-' + ((Date.now() / 1000) % sec).toFixed(2) + 's';
  let enteredAt = 0;
  /* gentle mouse parallax for the backdrop (set on <html>, survives redraws) */
  if (!window.__uaParallax) {
    window.__uaParallax = true;
    let raf = 0;
    document.addEventListener('mousemove', (e) => {
      if (raf || !document.querySelector('.ua-fx')) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = (e.clientX / window.innerWidth - .5).toFixed(3), y = (e.clientY / window.innerHeight - .5).toFixed(3);
        document.documentElement.style.setProperty('--ua-mx', x);
        document.documentElement.style.setProperty('--ua-my', y);
      });
    }, { passive: true });
  }
  function shellWide(a, title, step, sub, body, foot) {
    /* the entrance plays over its first 2.6 s; a redraw in that window
       continues it from where it is (negative delay) instead of cutting it */
    if (!enteredAt) enteredAt = Date.now();
    const since = (Date.now() - enteredAt) / 1000;
    const first = since < 2.6;
    /* water: the wave edge flows (three shapes, one structure), rain falls
       on the photo, ripples spread on the floodwater. SMIL loops start at
       the clock's phase (negative begin) so a redraw continues them. */
    const motionOff = (function () { if (typeof window.__uaMotionOff === 'boolean') return window.__uaMotionOff; try { return localStorage.getItem('uniguard.login.motion') === 'off'; } catch (e) { return false; } })();
    const still = motionOff || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const W1 = '175 0 C 112 46 72 104 86 182 C 100 262 162 296 136 378 C 110 456 46 486 56 546 C 61 576 82 593 104 600';
    const W2 = '192 0 C 130 54 86 114 100 192 C 114 272 150 308 122 386 C 98 452 60 494 72 550 C 78 580 96 595 118 600';
    const W3 = '166 0 C 102 38 62 94 78 174 C 94 252 172 286 148 370 C 122 462 38 478 48 540 C 54 573 74 591 96 600';
    const mask = (w) => 'M 500 0 L ' + w + ' L 500 600 Z';
    const flow = (fn, begin) => still ? '' : '<animate attributeName="d" dur="11s" begin="' + begin + '" repeatCount="indefinite" calcMode="spline" keyTimes="0;.33;.66;1"' +
      ' keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" values="' + [W1, W2, W3, W1].map(fn).join(';') + '"/>';
    const b11 = ph(11);
    const ripple = (cx, cy, d) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="4" ry="1.5" fill="none" stroke="rgba(255,236,236,.55)" stroke-width="1.2">' +
      (still ? '' : '<animate attributeName="rx" values="4;46" dur="4.5s" begin="' + d + '" repeatCount="indefinite"/>' +
        '<animate attributeName="ry" values="1.5;12" dur="4.5s" begin="' + d + '" repeatCount="indefinite"/>' +
        '<animate attributeName="opacity" values=".9;0" dur="4.5s" begin="' + d + '" repeatCount="indefinite"/>') + '</ellipse>';
    const rp = (off) => '-' + (((Date.now() / 1000) + off) % 4.5).toFixed(2) + 's';
    const wave = '<svg class="ua4-wave" viewBox="0 0 500 600" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><clipPath id="ua4Mask"><path d="' + mask(W1) + '">' + flow(mask, b11) + '</path></clipPath>' +
        '<linearGradient id="ua4Tone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7F1D1D" stop-opacity=".55"/><stop offset=".55" stop-color="#450A0A" stop-opacity=".35"/><stop offset="1" stop-color="#0B0B0F" stop-opacity=".8"/></linearGradient>' +
        '<linearGradient id="ua4Fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></linearGradient>' +
        '<radialGradient id="ua4Glint"><stop offset="0" stop-color="#FFE4E6" stop-opacity=".35"/><stop offset="1" stop-color="#FFE4E6" stop-opacity="0"/></radialGradient>' +
        '<pattern id="ua4Rain" width="90" height="140" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">' +
          '<line x1="10" y1="0" x2="10" y2="14" stroke="rgba(255,255,255,.16)" stroke-width="1"/><line x1="58" y1="74" x2="58" y2="84" stroke="rgba(255,255,255,.11)" stroke-width=".9"/>' +
          (still ? '' : '<animateTransform attributeName="patternTransform" type="translate" additive="sum" from="0 0" to="0 140" dur="1.6s" begin="' + ph(1.6) + '" repeatCount="indefinite"/>') +
        '</pattern></defs>' +
      '<g clip-path="url(#ua4Mask)">' +
        '<image class="ua-kb" style="animation-delay:' + ph(26) + '" href="img/baha.jpg" x="0" y="0" width="500" height="600" preserveAspectRatio="xMidYMid slice"/>' +
        '<rect width="500" height="600" fill="url(#ua4Tone)" style="mix-blend-mode:multiply"/><rect width="500" height="600" fill="url(#ua4Fade)"/>' +
        '<ellipse class="ua-glint" style="animation-delay:' + ph(14) + '" cx="340" cy="190" rx="190" ry="130" fill="url(#ua4Glint)"/>' +
        '<rect class="ua4-rain" width="520" height="620" x="-10" y="-10" fill="url(#ua4Rain)"/>' +
        '<g class="ua4-ripples">' + ripple(205, 470, rp(0)) + ripple(270, 520, rp(1.5)) + ripple(175, 565, rp(3)) + ripple(320, 460, rp(2.2)) + ripple(240, 585, rp(.8)) + ripple(150, 505, rp(3.6)) + '</g>' +
      '</g>' +
      '<path class="ua4-edge" d="M ' + W1 + '" fill="none">' + flow((w) => 'M ' + w, b11) + '</path>' +
    '</svg>';
    /* water at the foot of the form side */
    const sea = '<svg class="ua4-sea" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="ua4-sea1" style="animation-delay:' + ph(16) + '" d="M0 60 C 150 30 300 90 450 60 C 600 30 750 90 900 60 C 1050 30 1200 90 1350 60 C 1500 30 1650 90 1800 60 C 1950 30 2100 90 2400 60 L 2400 120 L 0 120 Z"/>' +
      '<path class="ua4-sea2" style="animation-delay:' + ph(22) + '" d="M0 78 C 200 50 400 100 600 78 C 800 56 1000 100 1200 78 C 1400 56 1600 100 1800 78 C 2000 56 2200 100 2400 78 L 2400 120 L 0 120 Z"/>' +
    '</svg>';
    const feats = [['pin', 'Report with your exact location'], ['sos', 'One-tap SOS to responders'], ['truck', 'Track the team sent to you']];
    return '<div class="ug ug-auth ua4 ua-fx' + (first && !still ? ' ua-enter' : '') + (still ? ' ua-still' : '') + '"' + (first ? ' style="--e:-' + since.toFixed(2) + 's"' : '') + '>' +
      '<div class="ua4-bg" aria-hidden="true">' +
        '<i class="ua4-orb ua4-orb--a" style="animation-delay:' + ph(19) + '"></i><i class="ua4-orb ua4-orb--b" style="animation-delay:' + ph(23) + '"></i>' +
        '<i class="ua4-orb ua4-orb--c" style="animation-delay:' + ph(29) + '"></i><i class="ua4-grain"></i>' +
      '</div>' +
      '<div class="ua4-card">' +
        '<i class="ua-sheen" aria-hidden="true"></i>' + sea +
          '<button type="button" class="ua4-motion" role="switch" data-act="auth-motion" aria-checked="' + motionOff + '" aria-label="Stop motion">' +
            '<span>Stop motion</span><i class="ua4-sw' + (motionOff ? ' is-on' : '') + '" aria-hidden="true"><b></b></i></button>' +
        '<section class="ua4-form">' +
          '<div class="ua4-brand ua-in" style="--d:.15s">' + UG.brandMark(40) +
            '<span><b>Uni<em>Guard</em></b><small>Unified DRRM System</small></span><i class="ua4-chip">Lingayen</i></div>' +
          '<div class="ua4-head ua-in" style="--d:.25s"><span class="ua4-step">' + esc(step) + '</span><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' +
          message(a) +
          '<form class="ug-auth-form ua4-f ua-in" style="--d:.35s" data-form="auth" novalidate>' + body + '</form>' +
          '<div class="ua4-bottom ua-in" style="--d:.5s">' +
            (foot ? '<div class="ua4-foot">' + foot + '</div>' : '') +
            '<div class="ua4-sos">' + I('alert', 14) + '<span>In an emergency?</span><a href="tel:911">Call 911</a><a href="tel:0756322222">LDRRMO (075) 632-2222</a></div>' +
          '</div>' +
        '</section>' +
        '<section class="ua4-art" aria-hidden="true">' + wave +
          '<div class="ua4-cap"><h2>Report. Respond.<br>Recover, together.</h2>' +
            '<ul>' + feats.map((f) => '<li>' + I(f[0], 16) + '<span>' + esc(f[1]) + '</span></li>').join('') + '</ul></div>' +
        '</section>' +
      '</div>' +
    '</div>';
  }

  function shell(a, title, step, sub, body, foot) {
    if (isWide() && a.__wide !== false) return shellWide(a, a.__wTitle || title, a.__wStep || step, a.__wSub != null ? a.__wSub : sub, a.__wBody || body, a.__wFoot != null ? a.__wFoot : foot);
    const feats = [['pin', 'Report a hazard with your exact location'], ['sos', 'One-tap SOS to the right responders'],
      ['truck', 'Follow the team sent to you, live'], ['wifioff', 'Keeps working when the signal drops']];
    return '<div class="ug ug-auth ug-auth3">' +
      '<aside class="ua3-hero" aria-hidden="true">' +
        '<img class="ua3-photo" src="img/baha.jpg" alt="">' +
        '<i class="ua3-shade"></i>' +
        '<div class="ua3-top">' +
          '<span class="ua3-brand">' + UG.brandMark(40) + '<span><b>Uni<em>Guard</em></b><small>Lingayen · Unified DRRM System</small></span></span>' +
          '<img class="ua3-seal" src="img/ldrrmo-lingayen.png" alt="" onerror="this.remove()">' +
        '</div>' +
        '<div class="ua3-copy">' +
          '<span class="ua3-kicker">Lingayen LDRRMO</span>' +
          '<h2>Report. Respond.<br>Recover, together.</h2>' +
          '<p>One account for residents, barangay officials, the LDRRMO and every response unit in Lingayen.</p>' +
          '<ul class="ua3-feats">' + feats.map((f) => '<li>' + I(f[0], 18) + '<span>' + esc(f[1]) + '</span></li>').join('') + '</ul>' +
        '</div>' +
      '</aside>' +
      '<main class="ua3-panel"><div class="ua3-box">' +
        '<div class="ua3-mbrand">' + UG.brandMark(34) + '<span><b>Uni<em>Guard</em></b><small>Lingayen</small></span></div>' +
        '<div class="ua3-head"><span class="ua3-step">' + esc(step) + '</span><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' +
        message(a) +
        '<form class="ug-auth-form ua3-form" data-form="auth" novalidate>' + body + '</form>' +
        (foot ? '<div class="ua3-foot">' + foot + '</div>' : '') +
        '<div class="ua3-sos"><span>' + I('alert', 16) + 'In an emergency?</span>' +
          '<a href="tel:911">Call 911</a><a href="tel:0756322222">LDRRMO (075) 632-2222</a></div>' +
      '</div></main>' +
    '</div>';
  }

  function signIn(a) {
    const f = a.form || {};
    const body =
      field('email', 'Email', { type: 'email', value: f.email, ph: 'name@example.ph', ac: 'email', icon: 'mail' }) +
      field('password', 'Password', { type: 'password', value: f.password, ph: 'Your password', ac: 'current-password', reveal: true, revealed: a.showPassword, icon: 'lock' }) +
      '<div class="ua-forgot"><button type="button" class="ug-auth-link" data-act="auth-go" data-to="forgot">Forgot password?</button></div>' +
      '<button type="submit" class="ug-btn ug-btn--signal ua-submit ua3-go' + (a.loading ? ' is-disabled' : '') + '" data-act="signin"' +
        (a.loading ? ' disabled' : '') + '>' + (a.loading ? 'Signing in…' : 'Login' + I('chevron', 16)) + '</button>' +
      (a.restoreFailed
        ? '<button type="button" class="ug-btn ua-alt" data-act="retry-restore"' + (a.loading ? ' disabled' : '') + '>' +
          I('wave', 15) + esc(UG_I18N.t('action.tryAgain')) + '</button>'
        : '') +
      (a.linkExpired
        ? '<button type="button" class="ug-btn ua-alt" data-act="resend"' + (a.loading ? ' disabled' : '') + '>' +
          I('bell', 15) + esc(UG_I18N.t('auth.requestNewLink')) + '</button>'
        : '') +
      '<div class="ua3-or"><span>Don’t have an account?</span></div>' +
      '<button type="button" class="ug-btn ua3-alt2" data-act="auth-go" data-to="signup">Sign Up</button>';

    const foot = '';

    return shell(a, 'One account for disaster reporting and response.', 'Account access', 'The system automatically routes you to the resident app or command console.', body, foot);
  }

  function signUp(a) {
    const f = a.form || {};
    const pw = UG_UTIL.passwordStrength(f.password || '');
    const barangays = (a.barangays || []).map((b) => ({ id: b.id, name: b.name }));
    const consentError = a.error && /privacy notice/i.test(a.error);

    const strength = f.password
      ? '<div class="ug-auth-strength"><div class="bars">' +
        [0, 1, 2, 3, 4].map((i) => '<i class="' + (i < pw.score ? 'on' : '') + '"></i>').join('') +
        '</div><span>' + esc(pw.label) + '</span></div>'
      : '<div class="ug-help">Use at least 8 characters, mixing letters, numbers and a symbol.</div>';

    const body =
      '<div class="ug-auth-2col">' +
        field('lastName', 'Last Name', { value: f.lastName, ph: 'Dela Cruz', ac: 'family-name' }) +
        field('firstName', 'First Name', { value: f.firstName, ph: 'Juan', ac: 'given-name' }) +
      '</div>' +
      field('email', 'Email Address', { type: 'email', value: f.email, ph: 'name@example.ph', ac: 'email', icon: 'mail' }) +
      field('phone', 'Mobile Number', { icon: 'phone',
        type: 'tel', value: f.phone, ph: '0917 123 4567', ac: 'tel', inputmode: 'tel', maxlength: '13',
        help: 'Philippine mobile format, for example 0917 123 4567.',
        error: a.phoneError || ''
      }) +
      selectField('barangay_id', 'Barangay', barangays, f.barangay_id, 'Select your barangay so your reports can be routed to the appropriate response team.') +
      '<div class="ug-auth-2col">' +
        field('password', 'Password', { type: 'password', value: f.password, ph: 'At least 8 characters', ac: 'new-password', reveal: true, revealed: a.showPassword }) +
        field('confirm', 'Confirm Password', { type: 'password', value: f.confirm, ph: 'Repeat password', ac: 'new-password' }) +
      '</div>' + strength +
      '<label class="ug-auth-consent' + (consentError ? ' is-error' : '') + '">' +
        '<input type="checkbox" data-act="toggle-consent"' + (a.consent ? ' checked' : '') + '>' +
        '<span>I have read and consent to the <a href="privacy.html" target="_blank" rel="noopener">Privacy Notice</a> and to the processing of my personal data under the Data Privacy Act of 2012.</span>' +
      '</label>' +
      '<button type="submit" class="ug-btn ug-btn--signal ug-btn--block' + (a.loading ? ' is-disabled' : '') + '" data-act="signup"' +
        (a.loading ? ' disabled' : '') + '>' + I('plus', 16) + (a.loading ? 'Creating account...' : 'Create Account') + '</button>';

    const foot = '<p class="ua-staffnote"><b>Officials, LDRRMO staff and response units:</b> your account is issued by the Lingayen LDRRMO administrator. Check your email for the invitation.</p>' +
      '<button type="button" class="ug-auth-link" data-act="auth-go" data-to="signin">Back to Sign In</button>';
    return shell(a, 'Create Resident Account', 'New account', 'Resident accounts are created here. Official and LGU access is issued by your LGU administrator.', body, foot);
  }

  function confirmEmail(a) {
    const email = a.pendingEmail || (a.form && a.form.email) || '';
    const body =
      '<div class="ug-auth-done">' + I('megaphone', 24) + '</div>' +
      '<div class="ug-rowf ug-between" style="gap:10px;font-size:13px;padding:11px 13px;border:1px solid var(--ug-line);border-radius:10px;background:var(--ug-field-bg, rgba(0,0,0,.24))">' +
        '<span class="ug-dim">Confirmation sent to</span><span class="ug-mono">' + esc(email) + '</span></div>' +
      '<div class="ug-dim" style="font-size:12px;line-height:1.55;margin-top:12px">Open the link in that email to activate your account, then come back and sign in.</div>' +
      '<button type="button" class="ug-btn ug-btn--block" style="margin-top:14px" data-act="resend"' + (a.loading ? ' disabled' : '') + '>' +
        I('bell', 15) + (a.loading ? 'Sending...' : 'Resend Email') + '</button>' +
      '<button type="button" class="ug-btn ug-btn--block ug-btn--ghost" style="margin-top:8px" data-act="auth-go" data-to="signin">Back to Sign In</button>';
    return shell(a, 'Check Your Email to Confirm Your Account', 'Confirm email', 'One more step before you can sign in.', body, '');
  }

  function forgot(a) {
    const f = a.form || {};
    const body =
      field('email', 'Email Address', { type: 'email', value: f.email, ph: 'name@example.ph', ac: 'email', icon: 'mail' }) +
      '<button type="submit" class="ug-btn ug-btn--signal ug-btn--block' + (a.loading ? ' is-disabled' : '') + '" data-act="forgot"' +
        (a.loading ? ' disabled' : '') + '>' + I('megaphone', 16) + (a.loading ? 'Sending...' : 'Send Reset Link') + '</button>' +
      '<div class="ug-help" style="margin-top:12px;text-align:center">We send a link that lets you choose a new password. The link expires in 60 minutes.</div>';
    const foot = '<button type="button" class="ug-auth-link" data-act="auth-go" data-to="signin">Back to Sign In</button>';
    return shell(a, 'Reset Password', 'Account recovery', 'Enter the email on your account and we will send a reset link.', body, foot);
  }

  function forgotSent(a) {
    const email = (a.form && a.form.email) || '';
    const body =
      '<div class="ug-auth-done">' + I('check', 26) + '</div>' +
      '<div class="ug-dim" style="font-size:13px;line-height:1.6;text-align:center">' +
        'If an account exists for <span class="ug-mono">' + esc(email) + '</span>, a reset link has been sent.</div>' +
      '<div class="ug-dim" style="font-size:12px;line-height:1.55;margin-top:14px">Check your spam folder if it does not arrive within a few minutes.</div>' +
      '<button type="button" class="ug-btn ug-btn--block" style="margin-top:16px" data-act="auth-go" data-to="signin">Back to Sign In</button>';
    return shell(a, 'Check Your Email', 'Account recovery', 'The link expires in 60 minutes.', body, '');
  }

  function setPassword(a) {
    const f = a.form || {};
    const pw = UG_UTIL.passwordStrength(f.password || '');
    const body =
      field('password', 'New Password', { type: 'password', value: f.password, ph: 'At least 8 characters', ac: 'new-password', reveal: true, revealed: a.showPassword }) +
      field('confirm', 'Confirm New Password', { type: 'password', value: f.confirm, ph: 'Repeat new password', ac: 'new-password' }) +
      '<div class="ug-auth-strength"><div class="bars">' +
        [0, 1, 2, 3, 4].map((i) => '<i class="' + (i < pw.score ? 'on' : '') + '"></i>').join('') +
      '</div><span>' + esc(pw.label) + '</span></div>' +
      '<button type="submit" class="ug-btn ug-btn--signal ug-btn--block' + (a.loading ? ' is-disabled' : '') + '" data-act="set-password"' +
        (a.loading ? ' disabled' : '') + '>' + I('check', 16) + (a.loading ? 'Saving...' : 'Set New Password') + '</button>';
    return shell(a, 'Set a New Password', 'Account recovery', 'Choose a new password for your UniGuard account.', body, '');
  }

  /* ------------------------------------------------------- onboarding screen
   * Shown the first time an invited user signs in (after accepting the email
   * invitation). They set their password and fill in their real name, phone
   * and barangay (for officials) — the edge function auto-set full_name to
   * the email prefix, so this is where they replace it with their actual name.
   *
   * The password field is OPTIONAL: if the user already has a password (e.g.
   * they accepted an old invitation on a previous deployment and set one),
   * they can leave it blank to keep their current password. If they don't
   * have one yet (the normal case for a fresh invite), they must set one. */
  function onboarding(a) {
    const f = a.form || {};
    const pw = UG_UTIL.passwordStrength(f.password || '');
    const role = (a.pendingProfile && a.pendingProfile.role) || 'citizen';
    const isOfficial = role === 'barangay_official';
    const isDispatch = role === 'dispatch_team';
    const roleName = UG_WEB.ROLE_INFO[role] ? UG_WEB.ROLE_INFO[role].label : role;
    const unitName = (a.pendingProfile && a.pendingProfile.unit_name) || '';

    const body =
      /* password — optional (leave blank to keep current password if you
         already have one; required if this is a fresh invitation) */
      field('password', 'Set Your Password', { type: 'password', value: f.password, ph: a.requirePassword ? 'At least 8 characters' : 'At least 8 characters (leave blank to keep current)', ac: 'new-password', reveal: true, revealed: a.showPassword }) +
      (f.password ?
        '<div class="ug-auth-strength"><div class="bars">' +
          [0, 1, 2, 3, 4].map((i) => '<i class="' + (i < pw.score ? 'on' : '') + '"></i>').join('') +
        '</div><span>' + esc(pw.label) + '</span></div>'
        : '<div class="ug-help" style="margin-bottom:14px">' +
          (a.requirePassword ? 'Set a password so you can sign back in after accepting this invitation.'
            : 'Leave blank to keep your current password.') + '</div>') +
      field('confirm', 'Confirm Password', { type: 'password', value: f.confirm, ph: 'Repeat your password (if setting a new one)', ac: 'new-password' }) +
      /* name, last then first (the edge function set it to the email prefix; this fixes it) */
      '<div class="ug-auth-2col">' +
        field('lastName', 'Last Name', { value: f.lastName, ph: 'Dela Cruz', ac: 'family-name' }) +
        field('firstName', 'First Name', { value: f.firstName, ph: 'Juan', ac: 'given-name' }) +
      '</div>' +
      /* phone — optional but useful for dispatch/official accounts */
      field('phone', 'Mobile Number', { value: f.phone, ph: '0917 123 4567', ac: 'tel', inputmode: 'tel' }) +
      (isOfficial ? '<p class="ug-note">' +
        (a.pendingProfile.barangay_id ? 'Assigned barangay · ' + esc(a.pendingProfile.barangay || 'See your administrator')
          : 'Ask your administrator to assign your barangay before completing setup.') + '</p>' : '') +
      /* dispatch team info — read-only context so they know which unit they're joining */
      (isDispatch
        ? '<div class="ug-card ug-card--flat" style="margin-bottom:14px"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
            '<span style="color:var(--ug-signal);display:flex">' + I('truck', 17) + '</span>' +
            '<div class="ug-note">You are the <strong>' + esc(a.pendingProfile.unit_role === 'unit_admin' ? 'Unit Administrator' : 'Unit Member') + '</strong> of <strong>' + esc(unitName) + '</strong>. You can update your name and phone here; the unit assignment is managed by your LGU.</div>' +
          '</div></div>'
        : '') +
      '<button type="submit" class="ug-btn ug-btn--signal ug-btn--block' + (a.loading ? ' is-disabled' : '') + '" data-act="complete-onboarding"' +
        (a.loading ? ' disabled' : '') + '>' + I('check', 16) + (a.loading ? 'Saving...' : 'Complete Setup & Sign In') + '</button>';

    const sub = 'You\'re joining as a ' + esc(roleName) + '. Fill in your details to finish setting up your account.';
    return shell(a, 'Complete Your Account', 'Invitation accepted', sub, body, '');
  }

  function authScreen(st) {
    const a = st.auth || {};
    switch (a.screen) {
      case 'signup': return signUp(a);
      case 'confirm': return confirmEmail(a);
      case 'forgot': return forgot(a);
      case 'forgot-sent': return forgotSent(a);
      case 'set-password': return setPassword(a);
      case 'onboarding': return onboarding(a);
      default: return signIn(a);
    }
  }

  return { authScreen, field, selectField, isWide };
})();
