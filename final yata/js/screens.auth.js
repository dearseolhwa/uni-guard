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
    const toggle = opts.reveal
      ? '<button type="button" class="ug-auth-reveal" data-act="toggle-reveal" data-for="' + id + '" ' +
        'aria-pressed="' + (opts.revealed ? 'true' : 'false') + '" aria-label="' + (opts.revealed ? 'Hide password' : 'Show password') + '">' +
        I(opts.revealed ? 'x' : 'eye', 16) + '</button>'
      : '';
    return '<div class="ug-field" style="margin-bottom:14px"><label class="ug-lab">' + esc(label) + '</label>' +
      '<div class="ug-auth-inwrap">' + input + toggle + '</div>' +
      (opts.help ? '<div class="ug-help">' + esc(opts.help) + '</div>' : '') +
      (opts.error ? '<div class="ug-help ug-auth-fielderror">' + esc(opts.error) + '</div>' : '') +
      '</div>';
  }

  function selectField(id, label, options, value, help) {
    return '<div class="ug-field" style="margin-bottom:14px"><label class="ug-lab">' + esc(label) + '</label>' +
      '<select class="ug-sel" data-field="' + id + '" aria-label="' + esc(label) + '">' +
      '<option value="">Select ' + esc(label.toLowerCase()) + '</option>' +
      options.map((o) => '<option value="' + esc(o.id) + '"' + (String(value) === String(o.id) ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') +
      '</select>' + (help ? '<div class="ug-help">' + esc(help) + '</div>' : '') + '</div>';
  }

  function message(a) {
    if (!a.error && !a.notice) return '';
    return '<div class="ug-auth-msg ' + (a.error ? 'is-error' : 'is-ok') + '">' +
      I(a.error ? 'alert' : 'check', 16) + '<span>' + esc(a.error || a.notice) + '</span></div>';
  }

  function shell(a, title, step, sub, body, foot) {
    const bullets = [
      ['alert', 'Report a hazard with photo and GPS in under a minute'],
      ['megaphone', 'Official advisories pushed straight to your device'],
      ['shelter', 'Live shelter availability and emergency hotlines offline']
    ];
    return '<div class="ug ug-auth">' +
      '<div class="ug-auth-art" aria-hidden="true">' + UG.mapSVG({}) + '</div>' +
      '<div class="ug-auth-grid">' +
        '<div class="ug-auth-brand">' +
          '<div class="ug-brand" style="margin-bottom:24px">' + UG.brandMark(42) +
            '<span class="ug-col" style="gap:0"><span class="ug-wordmark" style="font-size:23px">Uni<em>Guard</em></span>' +
            '<span class="ug-dimmer" style="font-size:10.5px;letter-spacing:.13em;text-transform:uppercase">Unified DRRM System</span></span></div>' +
          '<h1 class="ug-auth-h1">One account for disaster reporting and response.</h1>' +
          '<p class="ug-dim ug-auth-lead">Sign in with the account registered to you. Your account decides whether you open the resident app or the command console.</p>' +
          '<div class="ug-auth-list">' + bullets.map((b) =>
            '<div class="ug-rowf" style="gap:11px;align-items:flex-start"><span class="ug-auth-bico">' + I(b[0], 17) + '</span>' +
            '<span class="ug-dim" style="font-size:12.5px;line-height:1.5">' + esc(b[1]) + '</span></div>').join('') + '</div>' +
          '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px;margin-top:22px">' +
            '<span class="ug-chip">' + I('users', 13) + 'Citizen</span>' +
            '<span class="ug-chip">' + I('shield', 13) + 'Barangay Official</span>' +
            '<span class="ug-chip">' + I('radar', 13) + 'LGU / LDRRMC</span></div>' +
        '</div>' +
        '<div class="ug-auth-card ug-tick">' +
          '<div class="ug-auth-head">' +
            '<span class="ug-auth-step">' + esc(step) + '</span>' +
            '<h2 style="font-size:21px;margin-top:6px">' + esc(title) + '</h2>' +
            '<p class="ug-dim" style="font-size:12.5px;margin-top:6px;line-height:1.5">' + esc(sub) + '</p>' +
          '</div>' +
          message(a) +
          '<form class="ug-auth-form" data-form="auth" novalidate>' + body + '</form>' +
          (foot ? '<div class="ug-auth-foot">' + foot + '</div>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function signIn(a) {
    const f = a.form || {};
    const body =
      (a.notice === '__signedout' ? '' : '') +
      field('email', 'Email Address', { type: 'email', value: f.email, ph: 'name@example.ph', ac: 'email' }) +
      field('password', 'Password', { type: 'password', value: f.password, ph: 'Your password', ac: 'current-password', reveal: true, revealed: a.showPassword }) +
      '<button type="submit" class="ug-btn ug-btn--signal ug-btn--block' + (a.loading ? ' is-disabled' : '') + '" data-act="signin"' +
        (a.loading ? ' disabled' : '') + '>' + I('shield', 16) + (a.loading ? 'Signing in...' : 'Sign In') + '</button>' +
      '<div class="ug-auth-actions">' +
        '<button type="button" class="ug-auth-link" data-act="auth-go" data-to="signup">Create Account</button>' +
        '<span class="ug-auth-dot">&middot;</span>' +
        '<button type="button" class="ug-auth-link" data-act="auth-go" data-to="forgot">Forgot Password?</button>' +
      '</div>';

    const foot = '<div class="ug-auth-note">' + I('info', 14) +
      '<span>Barangay officials and LGU staff: accounts are issued by your LGU administrator.</span></div>';

    return shell(a, 'Sign In', 'Account access', 'Enter the email and password registered to your UniGuard account.', body, foot);
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
      field('name', 'Full Name', { value: f.name, ph: 'Juan Dela Cruz', ac: 'name' }) +
      field('email', 'Email Address', { type: 'email', value: f.email, ph: 'name@example.ph', ac: 'email' }) +
      field('phone', 'Mobile Number', {
        type: 'tel', value: f.phone, ph: '0917 123 4567', ac: 'tel', inputmode: 'tel', maxlength: '13',
        help: 'Philippine mobile format, for example 0917 123 4567.',
        error: a.phoneError || ''
      }) +
      selectField('barangay_id', 'Barangay', barangays, f.barangay_id, 'Your barangay decides which queue your reports enter.') +
      '<div class="ug-auth-2col">' +
        field('password', 'Password', { type: 'password', value: f.password, ph: 'At least 8 characters', ac: 'new-password', reveal: true, revealed: a.showPassword }) +
        field('confirm', 'Confirm Password', { type: 'password', value: f.confirm, ph: 'Repeat password', ac: 'new-password' }) +
      '</div>' + strength +
      '<label class="ug-auth-consent' + (consentError ? ' is-error' : '') + '">' +
        '<input type="checkbox" data-act="toggle-consent"' + (a.consent ? ' checked' : '') + '>' +
        '<span>I have read and consent to the <a href="privacy.html" target="_blank" rel="noopener">Privacy Notice</a> and to the processing of my personal data under the Data Privacy Act of 2012.</span>' +
      '</label>' +
      '<button type="submit" class="ug-btn ug-btn--signal ug-btn--block' + (a.loading ? ' is-disabled' : '') + '" data-act="signup"' +
        (a.loading ? ' disabled' : '') + '>' + I('plus', 16) + (a.loading ? 'Creating account...' : 'Create Account') + '</button>' +
      '<div class="ug-dimmer" style="font-size:10.5px;text-align:center;margin-top:10px">New accounts are resident accounts. Official and LGU access is issued by your city administrator.</div>';

    const foot = '<button type="button" class="ug-auth-link" data-act="auth-go" data-to="signin">Back to Sign In</button>';
    return shell(a, 'Create Account', 'New account', 'Resident accounts are created here. Official and LGU access is issued by your LGU administrator.', body, foot);
  }

  function confirmEmail(a) {
    const email = a.pendingEmail || (a.form && a.form.email) || '';
    const body =
      '<div class="ug-auth-done">' + I('megaphone', 24) + '</div>' +
      '<div class="ug-rowf ug-between" style="gap:10px;font-size:12.5px;padding:11px 13px;border:1px solid var(--ug-line);border-radius:10px;background:rgba(0,0,0,.24)">' +
        '<span class="ug-dim">Confirmation sent to</span><span class="ug-mono">' + esc(email) + '</span></div>' +
      '<div class="ug-dim" style="font-size:11.5px;line-height:1.55;margin-top:12px">Open the link in that email to activate your account, then come back and sign in.</div>' +
      '<button type="button" class="ug-btn ug-btn--block" style="margin-top:14px" data-act="resend"' + (a.loading ? ' disabled' : '') + '>' +
        I('bell', 15) + (a.loading ? 'Sending...' : 'Resend Email') + '</button>' +
      '<button type="button" class="ug-btn ug-btn--block ug-btn--ghost" style="margin-top:8px" data-act="auth-go" data-to="signin">Back to Sign In</button>';
    return shell(a, 'Check Your Email to Confirm Your Account', 'Confirm email', 'One more step before you can sign in.', body, '');
  }

  function forgot(a) {
    const f = a.form || {};
    const body =
      field('email', 'Email Address', { type: 'email', value: f.email, ph: 'name@example.ph', ac: 'email' }) +
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
      '<div class="ug-dim" style="font-size:11.5px;line-height:1.55;margin-top:14px">Check your spam folder if it does not arrive within a few minutes.</div>' +
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

  function authScreen(st) {
    const a = st.auth || {};
    switch (a.screen) {
      case 'signup': return signUp(a);
      case 'confirm': return confirmEmail(a);
      case 'forgot': return forgot(a);
      case 'forgot-sent': return forgotSent(a);
      case 'set-password': return setPassword(a);
      default: return signIn(a);
    }
  }

  return { authScreen, field, selectField };
})();
