/* UniGuard · application controller
 *
 * Single state object, one render(S) entry point, delegated events. Every
 * database call goes through Repo; every privileged action is authorised again
 * by RLS or a server function, never by hiding a button.
 */
(function () {
  const root = document.getElementById('ug-root');
  const toasts = document.getElementById('ug-toasts');
  const devBar = document.getElementById('ug-demo');
  const isWide = () => window.innerWidth >= 1024;

  const blankAuth = () => ({
    screen: 'signin',
    form: { email: '', password: '', name: '', phone: '', barangay_id: '', confirm: '' },
    error: '', notice: '', loading: false, showPassword: false, consent: false,
    pendingEmail: '', barangays: [], phoneError: ''
  });

  const S = {
    screen: 'auth',
    auth: blankAuth(),
    session: null,
    role: 'citizen', view: 'mobile', route: 'home', openId: null,
    offline: false, sevFilter: 'all', centerFilter: 'all', readNotifs: false,
    corr: {}, declareArmed: false, loading: false, error: null, syncNote: '',
    barangays: [], users: [], audit: [], responders: [],
    draft: { title: '', sev: 'warning', type: 'Emergency', area: UG_GEO.PLACE.areaAll, msg: '' },
    lastReport: null,
    report: {
      hazard: UG_HAZARDS.LIST[0].label, hazardOther: '', brgy: UG_GEO.BARANGAYS[0], urg: 'warning', desc: '',
      photo: false, photoBlob: null, photoName: '', gps: false, lat: null, lng: null,
      accuracy: null, error: '', busy: false
    }
  };

  const q = (sel, el) => (el || document).querySelector(sel);
  const qa = (sel, el) => Array.prototype.slice.call((el || document).querySelectorAll(sel));

  /* ------------------------------------------------------------------ toast */
  function toast(msg, tone) {
    tone = tone || 'info';
    if (!toasts) return;
    const el = document.createElement('div');
    el.className = 'ug-toast ug-toast--' + tone;
    const ic = tone === 'emergency' ? 'alert' : tone === 'prepared' ? 'check' : tone === 'warning' ? 'clock' : 'info';
    el.innerHTML = UG.icon(ic, 16) + '<span>' + UG_UTIL.esc(msg) + '</span>';
    toasts.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  /* ------------------------------------------------------------------ render */
  function viewFor() {
    if (!S.session) return 'mobile';
    if (S.session.role !== 'citizen') return 'console';
    return isWide() ? 'desktop' : 'mobile';
  }

  function render(focusField) {
    const prev = q('.ug-scroll');
    const top = prev ? prev.scrollTop : 0;
    S.view = viewFor();
    S.role = S.session ? S.session.role : 'citizen';
    S.offline = !UG_PWA.state.online || Repo.state.source === 'offline';
    UG.DATA.queueCount = UG_PWA.state.queued;

    if (!S.session) {
      root.innerHTML = '<div class="ug-stage ug-stage--auth">' + UG_AUTH.authScreen(S) + '</div>';
    } else {
      const st = Object.assign({}, S, { fixed: false });
      const stage = (S.session.role === 'citizen' && !isWide()) ? 'ug-stage ug-stage--m' : 'ug-stage ug-stage--d';
      root.innerHTML = '<div class="' + stage + '">' + UG_SCREENS.frame(st) + '</div>';
    }

    const sc = q('.ug-scroll');
    if (sc) sc.scrollTop = top;
    if (focusField) {
      const el = q('[data-field="' + focusField + '"]');
      if (el && el.focus) {
        el.focus();
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {}
      }
    }
    paintChrome();
    mountMaps();
    syncNavButton();
  }

  function paintChrome() {
    const showBar = !!(UG_CONFIG.DEV && S.session);
    if (devBar) devBar.classList.toggle('ug-hidden', !showBar);
    document.body.classList.toggle('ug-dev', !!UG_CONFIG.DEV);
    /* the stage only reserves room for the preview bar while it is on screen */
    document.body.classList.toggle('ug-dev-bar', showBar);
  }

  /* --------------------------------------------------------------- live maps */
  let mapKey = '';
  async function mountMaps() {
    const live = q('[data-map="live"]');
    const detail = q('[data-map="detail"]');
    if (!live && !detail) return;

    const targets = [];
    if (live) targets.push({ el: live, key: 'live:' + (UG.DATA.incidents || []).length + ':' + (S.offline ? 'o' : 'n'), centers: true });
    if (detail && S.openId) {
      const inc = (UG.DATA.incidents || []).find((i) => i.id === S.openId || i.uuid === S.openId);
      targets.push({ el: detail, key: 'detail:' + S.openId + ':' + (S.offline ? 'o' : 'n'), only: inc });
    }

    for (const t of targets) {
      if (t.el.dataset.mounted === t.key) continue;
      t.el.dataset.mounted = t.key;
      t.el.innerHTML = '';
      const ctx = await MapView.mount(t.el, {
        incidents: t.only ? [t.only] : (UG.DATA.incidents || []),
        centers: t.centers ? (UG.DATA.centers || []) : [],
        zoom: t.only ? 15 : 13
      });
      if (ctx && !ctx.fallback) {
        t.el.insertAdjacentHTML('beforeend', (t.centers ? UG.mapLegend() : '') + '<div class="map-scale">1 : 25 000</div>');
      }
      MapView.invalidate();
    }
  }

  /* ------------------------------------------------------------ data loading */
  async function loadRouteData(route) {
    if (route === 'users') {
      S.loading = true; S.error = null; render();
      try {
        S.users = await Repo.listUsers();
      } catch (e) { S.error = e.message || 'Could not load accounts'; }
      S.loading = false; render();
      return;
    }
    if (route === 'audit') {
      S.loading = true; S.error = null; render();
      try {
        S.audit = await Repo.listAudit(200);
      } catch (e) { S.error = e.message || 'Could not load the audit log'; }
      S.loading = false; render();
      return;
    }
  }

  async function bootstrapData() {
    await Repo.loadAll();
    UG.DATA.users = S.users;
    UG.DATA.audit = S.audit;
    UG.DATA.responders = S.responders;
    S.barangays = await Repo.listBarangays();
    S.auth.barangays = S.barangays;
    /* the advisory composer and the report form offer the live barangay list */
    if (S.barangays.length) UG.DATA.barangays = S.barangays.map((b) => b.name);
    render();
  }

  /* ----------------------------------------------------------------- helpers */
  /* Hash routes make the manifest shortcuts work and let a reload land back on the
     screen you were on. They are not a permission mechanism: the database decides
     what you may actually see. */
  const HASH_ROUTES = ['home', 'report', 'reports', 'report-done', 'report-detail',
    'advisories', 'advisory-detail', 'centers', 'hotlines', 'notifications', 'offline',
    'dashboard', 'incidents', 'incident', 'analytics', 'users', 'audit'];

  function routeFromHash() {
    const h = String((window.location && window.location.hash) || '').replace(/^#\/?/, '').split('?')[0];
    return (h && HASH_ROUTES.indexOf(h) !== -1) ? h : null;
  }

  function setHash(route) {
    const want = '#' + route;
    if (window.location.hash === want) return;
    try { window.history.replaceState(null, '', want); }
    catch (e) { try { window.location.hash = route; } catch (e2) {} }
  }

  const go = (route) => { S.route = route; S.openId = null; setHash(route); };

  /* ---------------------------------------------------- console navigation */
  /* The console navigation is a drawer behind a three bar button. Closed by
     default because a permanent sidebar wastes screen space, and the choice is
     remembered per device. */
  const NAV_KEY = 'uniguard.nav';
  function readNavPref() {
    try { return localStorage.getItem(NAV_KEY) === '1'; } catch (e) { return false; }
  }
  function setNav(open) {
    document.body.classList.toggle('ug-nav-open', !!open);
    try { localStorage.setItem(NAV_KEY, open ? '1' : '0'); } catch (e) {}
    const b = document.querySelector('[data-act="toggle-nav"]');
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function syncNavButton() {
    const b = document.querySelector('[data-act="toggle-nav"]');
    if (b) b.setAttribute('aria-expanded', document.body.classList.contains('ug-nav-open') ? 'true' : 'false');
  }

  /* Captured before boot: enterApp() writes the home route into the hash, so the
     route we arrived with has to be read now or it is lost. */
  const INITIAL_ROUTE = routeFromHash();
  const homeRoute = () => (S.session && UG_WEB.ROLE_INFO[S.session.role].home) || 'home';

  function enterApp(session, message) {
    S.session = session;
    S.screen = 'app';
    S.auth = blankAuth();
    S.declareArmed = false;
    go(homeRoute());
    toast(message || ('Signed in as ' + UG_WEB.ROLE_INFO[session.role].label + ' · ' + session.scope), 'prepared');
    render();
    bootstrapData();
  }

  function requireRole(roles) {
    if (!S.session) return false;
    return roles.indexOf(S.session.role) !== -1;
  }

  /* ------------------------------------------------------------ auth actions */
  const AUTH_ACTIONS = {
    'auth-go': (d, el) => {
      S.auth.screen = d.to || 'signin';
      S.auth.error = ''; S.auth.notice = ''; S.auth.phoneError = '';
      if (S.auth.screen === 'signup' && !S.auth.barangays.length) {
        Repo.listBarangays().then((list) => { S.auth.barangays = list; render(); });
      }
      render();
    },
    'toggle-reveal': (d) => {
      S.auth.showPassword = !S.auth.showPassword;
      render(d.for);
    },
    'toggle-consent': () => {
      S.auth.consent = !S.auth.consent;
      S.auth.error = /privacy notice/i.test(S.auth.error) ? '' : S.auth.error;
      render();
    },
    signin: async () => {
      const f = S.auth.form;
      S.auth.error = '';
      if (!f.email || !f.password) { S.auth.error = 'Enter your email address and password.'; return render(); }
      S.auth.loading = true; render();
      try {
        const session = await Auth.signIn(f.email.trim(), f.password);
        S.auth.loading = false;
        enterApp(session);
      } catch (e) {
        S.auth.loading = false;
        S.auth.error = UG_UTIL.authError(e.message);
        render();
      }
    },
    signup: async () => {
      const f = S.auth.form;
      S.auth.error = ''; S.auth.phoneError = '';
      if (!f.name.trim()) { S.auth.error = 'Enter your full name.'; return render(); }
      if (!f.email.trim()) { S.auth.error = 'Enter your email address.'; return render(); }

      const phone = UG_UTIL.normalisePhone(f.phone);
      if (!phone) { S.auth.phoneError = 'Use a Philippine mobile number, for example 0917 123 4567.'; return render(); }
      if (!f.barangay_id) { S.auth.error = 'Select your barangay.'; return render(); }
      if (!f.password || f.password.length < 8) { S.auth.error = 'Use at least 8 characters for the password.'; return render(); }
      if (f.password !== f.confirm) { S.auth.error = 'The two passwords do not match.'; return render(); }
      if (!S.auth.consent) { S.auth.error = 'Consent to the Privacy Notice is required to create an account.'; return render(); }

      const brgy = (S.auth.barangays || []).find((b) => String(b.id) === String(f.barangay_id));
      S.auth.loading = true; render();
      try {
        const res = await Auth.signUp({
          fullName: f.name.trim(), email: f.email.trim(), phone: phone,
          barangayId: f.barangay_id, barangay: brgy ? brgy.name : '', password: f.password
        });
        S.auth.loading = false;
        if (res && res.needsConfirmation) {
          S.auth.screen = 'confirm';
          S.auth.pendingEmail = f.email.trim();
          render();
        } else {
          enterApp(res);
        }
      } catch (e) {
        S.auth.loading = false;
        S.auth.error = UG_UTIL.authError(e.message);
        render();
      }
    },
    resend: async () => {
      S.auth.loading = true; S.auth.error = ''; S.auth.notice = ''; render();
      try {
        await Auth.resendConfirmation(S.auth.pendingEmail);
        S.auth.notice = 'Confirmation email sent again to ' + S.auth.pendingEmail + '.';
      } catch (e) {
        S.auth.error = UG_UTIL.authError(e.message);
      }
      S.auth.loading = false; render();
    },
    forgot: async () => {
      const f = S.auth.form;
      S.auth.error = '';
      if (!f.email.trim()) { S.auth.error = 'Enter the email address on your account.'; return render(); }
      S.auth.loading = true; render();
      await Auth.resetPassword(f.email.trim());
      S.auth.loading = false;
      S.auth.screen = 'forgot-sent';
      render();
    },
    'set-password': async () => {
      const f = S.auth.form;
      S.auth.error = '';
      if (!f.password || f.password.length < 8) { S.auth.error = 'Use at least 8 characters for the new password.'; return render(); }
      if (f.password !== f.confirm) { S.auth.error = 'The two passwords do not match.'; return render(); }
      S.auth.loading = true; render();
      try {
        await Auth.updatePassword(f.password);
        S.auth = blankAuth();
        S.auth.notice = 'Password updated. Sign in with your new password.';
        render();
        toast('Password updated. Sign in with your new password.', 'prepared');
      } catch (e) {
        S.auth.loading = false;
        S.auth.error = UG_UTIL.authError(e.message);
        render();
      }
    },
    logout: async () => {
      const ok = await UG_FEATURES.confirm({
        title: 'Sign out',
        message: 'Sign out of UniGuard on this device?',
        confirmLabel: 'Sign out'
      });
      if (!ok) return;
      MapView.destroy();
      await Auth.signOut();
      S.session = null;
      S.auth = blankAuth();
      S.auth.notice = 'You have been signed out.';
      go('home');
      render();
    }
  };

  /* ------------------------------------------------------------- app actions */
  const APP_ACTIONS = {
    nav: (d) => {
      go(d.route);
      /* on a phone the drawer is in the way after a choice */
      if (window.innerWidth < 1200) setNav(false);
      render();
      loadRouteData(d.route);
    },
    'open-advisory': (d) => { S.openId = d.id; S.route = 'advisory-detail'; render(); },
    'open-incident': (d) => { S.openId = d.id; S.route = S.role === 'citizen' ? 'report-detail' : 'incident'; render(); },
    'open-report': (d) => { S.openId = d.id; S.route = 'report-detail'; render(); },
    'sev-filter': (d) => { S.sevFilter = d.v; render(); },
    'center-filter': (d) => { S.centerFilter = d.v; render(); },
    'set-urg': (d) => { S.report.urg = d.v; render(); },

    gps: async () => {
      toast('Reading your position...', 'info');
      try {
        const p = await UG_FEATURES.locate();
        S.report.lat = p.lat; S.report.lng = p.lng; S.report.accuracy = p.accuracy; S.report.gps = true;
        toast('Position acquired, accuracy ' + p.accuracy + ' m', 'prepared');
      } catch (e) {
        const manual = await UG_FEATURES.prompt({
          title: 'Enter coordinates',
          label: 'Latitude, longitude',
          placeholder: UG_GEO.EXAMPLE,
          help: e.message
        });
        const parsed = UG_FEATURES.parseCoords(manual);
        if (parsed) {
          S.report.lat = parsed.lat; S.report.lng = parsed.lng; S.report.gps = true;
          toast(parsed.outside ? 'Coordinates set, but they look outside Lingayen — double-check them' : 'Coordinates set manually', parsed.outside ? 'warning' : 'prepared');
        } else if (manual) {
          toast('That does not look like a coordinate pair', 'warning');
        }
      }
      render();
    },

    'add-photo': async () => {
      const file = await UG_FEATURES.pickPhoto();
      if (!file) return;
      try {
        const out = await UG_FEATURES.compressImage(file);
        S.report.photoBlob = out.blob;
        S.report.photoName = file.name || 'hazard.jpg';
        S.report.photo = true;
        toast('Photo attached, ' + UG_UTIL.bytes(out.bytes) + ' after compression', 'prepared');
      } catch (e) {
        toast(e.message, 'warning');
      }
      render();
    },
    'rm-photo': () => { S.report.photo = false; S.report.photoBlob = null; S.report.photoName = ''; render(); },

    'submit-report': async () => {
      const r = S.report;
      if (!r.desc.trim()) { toast('Add a short description before submitting', 'warning'); return; }
      const hz = UG_HAZARDS.classify(r.hazard);
      if (hz.key === 'other' && !(r.hazardOther || '').trim()) {
        toast('Tell us what the hazard is before submitting', 'warning');
        return;
      }
      if (r.busy) return;
      r.busy = true;
      try {
        if (!UG_PWA.state.online || !Repo.online()) {
          await UG_PWA.enqueue({
            hazard_type: r.hazard, hazard_other_text: r.hazardOther || '', barangay: r.brgy, description: r.desc.trim(),
            severity: r.urg || 'advisory', urgency: r.urg, lat: r.lat, lng: r.lng
          });
          toast('Saved on this device. It uploads when you are back online.', 'warning');
          S.lastReport = { id: null, brgy: r.brgy };
        } else {
          const res = await Repo.createReport({
            hazard_type: r.hazard, hazard_other_text: r.hazardOther || '', barangay: r.brgy, description: r.desc.trim(),
            severity: r.urg || 'advisory', urgency: r.urg, lat: r.lat, lng: r.lng,
            photoBlob: r.photoBlob, reportCodeHint: 'draft'
          });
          toast(res.queued ? 'Saved for upload' : 'Report ' + res.row.id + ' submitted to the ' + r.brgy + ' queue', 'prepared');
          S.lastReport = { id: res.row ? res.row.id : null, brgy: r.brgy };
        }
        S.route = 'report-done';
        S.report = { hazard: r.hazard, hazardOther: '', brgy: r.brgy, urg: 'warning', desc: '', photo: false, photoBlob: null, photoName: '', gps: false, lat: null, lng: null, accuracy: null, error: '', busy: false };
      } catch (e) {
        r.busy = false;
        toast(e.message || 'Could not submit the report', 'warning');
      }
      render();
    },

    'confirm-corr': async (d) => {
      try {
        const res = await Repo.corroborate(d.id);
        if (res && res.verified) toast('Three corroborations reached. This report is verified.', 'prepared');
        else toast('Corroboration logged: ' + ((res && res.corroborations) || 0) + ' of ' + UG_CONFIG.CORROBORATION_THRESHOLD, 'warning');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    advance: async (d) => {
      const order = ['reported', 'verified', 'dispatched', 'resolved'];
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (!inc) return;
      const next = order.indexOf(inc.status) + 1;
      if (next >= order.length) { toast('This incident is already resolved', 'info'); return; }
      const label = UG.STAGES[next].label;
      const ok = await UG_FEATURES.confirm({
        title: 'Advance status',
        message: 'Move ' + inc.id + ' to "' + label + '"?',
        detail: '<div class="ug-kv"><dt>From</dt><dd>' + UG_UTIL.esc(inc.status) + '</dd><dt>To</dt><dd>' + UG_UTIL.esc(label) + '</dd></div>',
        confirmLabel: 'Move to ' + label
      });
      if (!ok) return;
      try {
        await Repo.advanceStatus(inc.uuid || inc.id, order[next]);
        toast(inc.id + ' moved to ' + label, next === order.length - 1 ? 'prepared' : 'warning');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    reject: async (d) => {
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (!inc) return;
      const reason = await UG_FEATURES.prompt({
        title: 'Reject report', label: 'Reason (shown in the audit log)', placeholder: 'e.g. Duplicate of UG-2026-0140'
      });
      if (reason === null) return;
      try {
        await Repo.advanceStatus(inc.uuid || inc.id, 'rejected', reason || '');
        toast(inc.id + ' marked rejected', 'warning');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'center-status': async (d) => {
      try {
        const patch = { status: d.s };
        if (d.s === 'closed') patch.occupancy = 0;
        await Repo.updateCenter(d.id, patch);
        toast('Shelter marked ' + d.s, d.s === 'open' ? 'prepared' : d.s === 'full' ? 'warning' : 'emergency');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'add-center': async () => {
      const name = (q('[data-field="centerName"]') || {}).value || '';
      const brgy = (q('[data-field="centerBarangay"]') || {}).value || '';
      const cap = parseInt((q('[data-field="centerCapacity"]') || {}).value || '0', 10) || 0;
      const latRaw = (q('[data-field="centerLat"]') || {}).value || '';
      const lngRaw = (q('[data-field="centerLng"]') || {}).value || '';
      if (!name.trim() || !cap) { toast('A name and a capacity are required', 'warning'); return; }
      let lat = null, lng = null;
      if (latRaw.trim() || lngRaw.trim()) {
        lat = UG_GEO.toNum(latRaw); lng = UG_GEO.toNum(lngRaw);
        const state = UG_GEO.classify(lat, lng);
        if (state !== 'ok') {
          toast(UG_GEO.message(state) || 'Those coordinates do not look right', 'warning');
          return;
        }
      }
      const brgyRow = (S.barangays || []).find((b) => b.name === brgy);
      try {
        await Repo.createCenter({ name: name.trim(), barangay: brgy, barangay_id: brgyRow ? brgyRow.id : null, capacity: cap, occupancy: 0, status: 'open', lat: lat, lng: lng });
        toast('Evacuation centre added to the directory' + (lat === null ? ' — add coordinates later so Waze navigation works' : ''), 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'center-locate': async () => {
      try {
        const pos = await UG_FEATURES.locate();
        const latEl = q('[data-field="centerLat"]'), lngEl = q('[data-field="centerLng"]');
        if (latEl) latEl.value = pos.lat;
        if (lngEl) lngEl.value = pos.lng;
        const state = UG_GEO.classify(pos.lat, pos.lng);
        toast(state === 'ok' ? 'Location captured' : (UG_GEO.message(state) || 'Location captured, but check it looks right'), state === 'ok' ? 'prepared' : 'warning');
      } catch (e) { toast(e.message, 'warning'); }
    },

    'add-hotline': async () => {
      const agency = ((q('[data-field="hotlineAgency"]') || {}).value || '').trim();
      const number = ((q('[data-field="hotlineNumber"]') || {}).value || '').trim();
      const scope = ((q('[data-field="hotlineScope"]') || {}).value || '').trim() || UG_GEO.PLACE.areaAll;
      if (!agency || !number) { toast('An agency and a contact number are required', 'warning'); return; }
      try {
        await Repo.createHotline({ agency_name: agency, contact_number: number, scope: scope });
        toast('Hotline added and cached for offline use', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'edit-hotline': async (d) => {
      const h = (UG.DATA.hotlines || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (!h) return;
      const value = await UG_FEATURES.prompt({ title: 'Update hotline', label: h.agency, value: h.number, placeholder: '(075) 000-0000' });
      if (!value) return;
      try { await Repo.updateHotline(d.id, { contact_number: value }); toast('Hotline updated', 'prepared'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'verify-hotline': async (d) => {
      try { await Repo.updateHotline(d.id, { active: true }); toast('Hotline marked verified today', 'prepared'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'export-hotlines': () => {
      const rows = (UG.DATA.hotlines || []).map((h) => ({
        agency: h.agency, contact_number: h.number, scope: h.scope
      }));
      if (!rows.length) { toast('Nothing to export', 'info'); return; }
      UG_UTIL.download('uniguard-hotlines.csv', UG_UTIL.toCSV(rows, ['agency', 'contact_number', 'scope']));
      toast('Hotline directory exported', 'info');
    },

    'export-analytics': async () => {
      try {
        const a = await Repo.analytics();
        const rows = Object.keys(a.byHazard || {}).map((k) => ({ hazard_type: k, total: a.byHazard[k] }));
        (Object.keys(a.stages || {})).forEach((k) => rows.push({ hazard_type: 'STATUS: ' + k, total: a.stages[k] }));
        if (!rows.length) { toast('No analytics data yet', 'info'); return; }
        UG_UTIL.download('uniguard-analytics.csv', UG_UTIL.toCSV(rows, ['hazard_type', 'total']));
        toast('Analytics exported', 'info');
      } catch (e) { toast(e.message, 'warning'); }
    },

    declare: async () => {
      if (!requireRole(['lgu_ldrrmc'])) { toast('Only LGU / LDRRMC can declare an emergency', 'warning'); return; }
      const devices = await Repo.subscribedDeviceCount();
      const ok = await UG_FEATURES.confirm({
        title: 'Declare emergency',
        message: 'Broadcast a municipality-wide emergency alert to every subscribed device?',
        detail: '<div class="ug-kv"><dt>Reach</dt><dd>' + devices + ' subscribed devices</dd>' +
                '<dt>SMS fallback</dt><dd>queued for devices without push</dd>' +
                '<dt>Audit</dt><dd>this action is recorded</dd></div>',
        confirmLabel: 'Broadcast now',
        danger: true
      });
      if (!ok) return;
      try {
        const res = await Repo.declareEmergency({ title: 'Emergency declaration: municipality-wide response activated' });
        toast('Emergency declaration broadcast to ' + ((res && res.devices) != null ? res.devices : devices) + ' devices', 'emergency');
        if (S.role !== 'citizen') S.route = 'advisories';
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    publish: async () => {
      if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can publish advisories', 'warning'); return; }
      if (!S.draft.title.trim() || !S.draft.msg.trim()) { toast('Add a title and a message before publishing', 'warning'); return; }
      const ok = await UG_FEATURES.confirm({
        title: 'Publish advisory',
        message: 'Publish "' + S.draft.title.trim() + '" to ' + S.draft.area + '?',
        confirmLabel: 'Publish'
      });
      if (!ok) return;
      try {
        await Repo.createAdvisory({
          title: S.draft.title.trim(), body: S.draft.msg.trim(), severity: S.draft.sev,
          kind: S.draft.type === 'Preparedness' ? 'preparedness' : 'emergency',
          affected_area: S.draft.area, citywide: /citywide|municipality-wide|municipality wide/i.test(S.draft.area),
          /* a targeted advisory is fanned out to exactly the barangay it names */
          barangayIds: (S.barangays || []).filter((b) => b.name === S.draft.area).map((b) => b.id)
        });
        toast('Broadcast published to ' + S.draft.area + ' residents', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'clear-draft': () => {
      S.draft = { title: '', sev: 'warning', type: 'Emergency', area: UG_GEO.PLACE.areaAll, msg: '' };
      toast('Composer cleared', 'info');
      render();
    },

    'read-all': async () => {
      try { await Repo.markAllRead(); toast('All notifications marked as read', 'info'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'open-notification': async (d) => {
      try { await Repo.markRead(d.id); } catch (e) {}
      if (d.advisory) { S.openId = d.advisory; S.route = 'advisory-detail'; }
      render();
    },

    'save-advisory': async () => {
      await UG_PWA.storeSnapshot(UG.DATA);
      toast('Critical advisories saved for offline reading', 'info');
    },

    'share-advisory': async () => {
      const a = (UG.DATA.advisories || []).find((x) => x.id === S.openId);
      const res = await UG_FEATURES.shareOrCopy(a ? a.title : 'UniGuard advisory', a ? a.body : '', location.href);
      toast(res === 'shared' ? 'Shared' : res === 'copied' ? 'Link copied to clipboard' : 'Sharing is not available here',
        res === 'failed' ? 'warning' : 'info');
    },

    directions: (d) => {
      const c = (UG.DATA.centers || []).find((x) => x.uuid === d.id || x.id === d.id);
      const lat = c && typeof c.lat === 'number' ? c.lat : null;
      const lng = c && typeof c.lng === 'number' ? c.lng : null;
      if (lat !== null && lng !== null && UG_GEO.canNavigate(lat, lng)) {
        /* Waze universal link: opens the Waze app if installed, otherwise its
           web page / app store. Chosen over the old in-app OSM directions
           widget (see project notes) because it needs no location permission
           dance and gives real turn-by-turn guidance on the device people
           already have open during a hazard. */
        window.open(UG_GEO.wazeUrl(lat, lng), '_blank', 'noopener,noreferrer');
        toast('Opening Waze directions to ' + (c.name || d.name || 'the evacuation center'), 'info');
      } else {
        toast((c ? UG_GEO.message(UG_GEO.classify(c.lat, c.lng)) : 'This evacuation center has no coordinates yet') || 'Navigation is unavailable for this location.', 'warning');
      }
    },

    'save-center-offline': async () => {
      await UG_PWA.storeSnapshot(UG.DATA);
      toast('Shelter list saved for offline use', 'info');
    },

    call: (d) => {
      window.location.href = 'tel:' + String(d.num || '').replace(/[^\d+]/g, '');
      toast('Calling ' + (d.agency || d.num), 'prepared');
    },

    /* A live connection is decided by the browser, so in production this control
       retries for real instead of silently doing nothing. */
    'toggle-offline': async () => {
      if (!UG_CONFIG.DEV) { await APP_ACTIONS.reconnect(); return; }
      S.offline = !S.offline;
      toast(S.offline ? 'Offline preview on' : 'Back online', S.offline ? 'warning' : 'prepared');
      render();
    },

    reconnect: async () => {
      const r = await UG_PWA.retryNow();
      if (r.online) {
        toast('Back online. Data refreshed' +
          (r.uploaded ? ', ' + r.uploaded + ' queued report' + (r.uploaded > 1 ? 's' : '') + ' uploaded' : '') + '.',
          'prepared');
      } else {
        toast('Still offline. ' + (r.queued || 0) + ' report' + (r.queued === 1 ? '' : 's') +
          ' waiting. They send by themselves when the connection returns.', 'warning');
      }
      render();
    },

    'toggle-nav': () => {
      setNav(!document.body.classList.contains('ug-nav-open'));
      render();
    },

    'close-nav': () => { setNav(false); render(); },

    'sign-out': () => AUTH_ACTIONS.logout(),

    toast: (d) => toast(d.msg, d.tone || 'info'),

    'retry-load': async () => { await Repo.loadAll(); render(); },

    'force-refresh': async () => {
      toast('Clearing the offline cache and reloading the newest build...', 'info');
      await UG_PWA.forceRefresh();
    },

    'enable-push': async () => {
      try {
        await UG_PWA.enablePush();
        toast('This device will receive emergency alerts', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'sync-now': async () => {
      const n = await UG_PWA.flushQueue();
      toast(n ? n + ' queued reports uploaded' : 'Nothing waiting to upload', n ? 'prepared' : 'info');
      render();
    },

    'admin-load': async () => {
      S.loading = true; S.error = null; render();
      try {
        if (S.route === 'users') S.users = await Repo.listUsers();
        if (S.route === 'audit') S.audit = await Repo.listAudit(200);
        UG.DATA.users = S.users; UG.DATA.audit = S.audit;
      } catch (e) { S.error = e.message; }
      S.loading = false; render();
    },

    'admin-create': async () => {
      if (!requireRole(['lgu_ldrrmc'])) { toast('Only LGU can create officials', 'warning'); return; }
      const email = await UG_FEATURES.prompt({ title: 'Create an official account', label: 'Email address', placeholder: 'official@lingayen.gov.ph' });
      if (!email) return;
      try {
        await Repo.adminUsers('create', { email: email, role: 'barangay_official' });
        toast('Invitation sent to ' + email, 'prepared');
        S.users = await Repo.listUsers(); UG.DATA.users = S.users;
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'admin-role': async (d, el) => {
      try {
        await Repo.adminUsers('set-role', { userId: d.id, role: el.value });
        toast('Role updated', 'prepared');
        S.users = await Repo.listUsers(); UG.DATA.users = S.users;
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'admin-barangay': async (d, el) => {
      try {
        await Repo.adminUsers('set-barangay', { userId: d.id, barangayId: el.value || null });
        toast('Barangay assignment updated', 'prepared');
        S.users = await Repo.listUsers(); UG.DATA.users = S.users;
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'admin-disable': async (d) => {
      const disable = d.next === 'true';
      const ok = await UG_FEATURES.confirm({
        title: disable ? 'Disable account' : 'Enable account',
        message: disable ? 'The account can no longer sign in until it is enabled again.' : 'The account can sign in again.',
        confirmLabel: disable ? 'Disable' : 'Enable',
        danger: disable
      });
      if (!ok) return;
      try {
        await Repo.adminUsers('set-disabled', { userId: d.id, disabled: disable });
        toast(disable ? 'Account disabled' : 'Account enabled', 'prepared');
        S.users = await Repo.listUsers(); UG.DATA.users = S.users;
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'admin-export-users': () => {
      const rows = (S.users || []).map((u) => ({
        name: u.full_name, email: u.email, role: u.role, barangay: u.barangay || '',
        status: u.disabled ? 'disabled' : 'active', created_at: u.created_at
      }));
      if (!rows.length) { toast('Nothing to export', 'info'); return; }
      UG_UTIL.download('uniguard-users.csv', UG_UTIL.toCSV(rows, ['name', 'email', 'role', 'barangay', 'status', 'created_at']));
      toast('User list exported', 'info');
    },

    'admin-export-audit': () => {
      const rows = (S.audit || []).map((a) => ({
        created_at: a.created_at, actor_id: a.actor_id, action: a.action, entity: a.entity, entity_id: a.entity_id
      }));
      if (!rows.length) { toast('Nothing to export', 'info'); return; }
      UG_UTIL.download('uniguard-audit-log.csv', UG_UTIL.toCSV(rows, ['created_at', 'actor_id', 'action', 'entity', 'entity_id']));
      toast('Audit log exported', 'info');
    },

    'load-responders': async () => {
      try {
        S.responders = await Repo.listResponders();
        UG.DATA.responders = S.responders;
        toast(S.responders.length ? S.responders.length + ' responder units available' : 'No responder units configured yet',
          S.responders.length ? 'info' : 'warning');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'assign-responder': async (d) => {
      const sel = q('[data-field="assignResponder"]');
      if (!sel || !sel.value) { toast('Pick a responder unit first', 'warning'); return; }
      try {
        await Repo.assignResponder(d.id, sel.value);
        toast('Responder assigned', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    }
  };

  const ALL = Object.assign({}, AUTH_ACTIONS, APP_ACTIONS);

  /* --------------------------------------------------------------- listeners */
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    /* a submit button belongs to the form: let the submit handler run, and do not
       cancel the default action or the form never fires */
    if (t.getAttribute('type') === 'submit') return;
    const fn = ALL[t.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(t.dataset, t);
  });

  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-field]');
    if (!el) return;
    const f = el.dataset.field, v = el.value;
    if (!S.session) {
      if (f === 'email' || f === 'password' || f === 'confirm' || f === 'name' || f === 'phone') S.auth.form[f] = v;
      return;
    }
    if (f === 'advTitle') { S.draft.title = v; render(f); return; }
    if (f === 'advMsg') { S.draft.msg = v; render(f); return; }
    if (f === 'desc') { S.report.desc = v; render(f); return; }
    if (f === 'hazardOther') { S.report.hazardOther = v; render(f); return; }
    if (f === 'assignResponder') return;
  });

  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-field]');
    if (!el) return;
    const f = el.dataset.field, v = el.value;
    if (!S.session) {
      if (f === 'barangay_id') { S.auth.form.barangay_id = v; return; }
      return;
    }
    if (f === 'advSev') S.draft.sev = v;
    else if (f === 'advType') S.draft.type = v;
    else if (f === 'advArea') S.draft.area = v;
    else if (f === 'hazard') S.report.hazard = v;
    else if (f === 'brgy') S.report.brgy = v;
    else if (f === 'assignResponder') return;
    else return;
    render();
  });

  /* Enter submits the account forms. */
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const form = e.target.closest('[data-form="auth"]');
    if (!form) return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const a = S.auth.screen;
    if (a === 'signin') AUTH_ACTIONS.signin();
    else if (a === 'signup') AUTH_ACTIONS.signup();
    else if (a === 'forgot') AUTH_ACTIONS.forgot();
    else if (a === 'set-password') AUTH_ACTIONS['set-password']();
  });

  root.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form="auth"]');
    if (!form) return;
    e.preventDefault();
    const a = S.auth.screen;
    if (a === 'signin') AUTH_ACTIONS.signin();
    else if (a === 'signup') AUTH_ACTIONS.signup();
    else if (a === 'forgot') AUTH_ACTIONS.forgot();
    else if (a === 'set-password') AUTH_ACTIONS['set-password']();
  });

  /* the live map asks the app to open an incident */
  document.addEventListener('ug:open-incident', (e) => {
    const id = e.detail && e.detail.id;
    if (!id) return;
    APP_ACTIONS['open-incident']({ id: id });
  });

  /* DEV preview controls */
  if (devBar) {
    devBar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.off) APP_ACTIONS['toggle-offline']();
      else if (b.dataset.signout) AUTH_ACTIONS.logout();
      else if (b.dataset.reset) { S.route = homeRoute(); S.openId = null; S.sevFilter = 'all'; S.centerFilter = 'all'; render(); }
    });
  }

  window.addEventListener('resize', UG_UTIL.debounce(() => {
    if (viewFor() !== S.view) render();
    else MapView.invalidate();
  }, 180));

  window.addEventListener('hashchange', () => {
    const hr = routeFromHash();
    if (hr && S.session && hr !== S.route) {
      go(hr);
      render();
      loadRouteData(hr);
    }
  });

  Repo.onChange(() => { if (S.session) render(); });
  UG_PWA.onChange(() => { if (S.session) render(); });

  /* -------------------------------------------------------------- DEV deep links */
  function applyDevDeepLink() {
    if (!UG_CONFIG.DEV) return false;
    try {
      const p = new URLSearchParams(location.search);
      const as = p.get('role') || p.get('as');
      if (!as || !UG_WEB.ROLE_INFO[as]) return false;
      const seeded = UG.DATA.sessions[as];
      const session = {
        id: 'dev', email: seeded.email, name: seeded.name, initials: seeded.initials,
        role: as, title: UG_WEB.ROLE_INFO[as].label, barangay: seeded.barangay, barangay_id: null,
        scope: seeded.scope
      };
      S.session = session;
      S.screen = 'app';
      go(p.get('route') || UG_WEB.ROLE_INFO[as].home);
      if (p.get('open')) S.openId = p.get('open');
      return true;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------- boot */
  function installConnectivityBanner() {
    const strip = document.getElementById('ug-conn');
    if (!strip) return;
    const paint = () => {
      const off = !UG_PWA.state.online || Repo.state.source === 'offline';
      const queued = UG_PWA.state.queued || 0;
      if (off) {
        strip.className = 'ug-banner-strip is-offline';
        strip.innerHTML = UG.icon('wifioff', 14) +
          '<span>Offline. Showing the last synced hotlines, shelters and advisories' +
          (queued ? ', and ' + queued + ' report' + (queued > 1 ? 's' : '') + ' waiting to upload' : '') + '.</span>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto" data-act="retry-load">Retry</button>';
        strip.hidden = false;
      } else if (queued) {
        strip.className = 'ug-banner-strip is-sync';
        strip.innerHTML = UG.icon('download', 14) +
          '<span>' + queued + ' report' + (queued > 1 ? 's' : '') + ' waiting to upload.</span>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto" data-act="sync-now">Upload now</button>';
        strip.hidden = false;
      } else {
        strip.hidden = true;
      }
    };
    UG_PWA.onChange(paint);
    Repo.onChange(paint);
    paint();
  }

  async function boot() {
    UG_PWA.init();
    installConnectivityBanner();
    setNav(readNavPref());
    render();

    UG_PWA.hydrateFromCache()
      .then(function (hit) { if (hit && S.session) render(); })
      .catch(function () { /* the cache is best effort */ });

    if (applyDevDeepLink()) {
      render();
      bootstrapData();
      return;
    }

    let session = null;
    try { session = await Auth.restore(); }
    catch (e) { session = null; }

    if (Auth.state.recovery) {
      S.session = null;
      S.auth = blankAuth();
      S.auth.screen = 'set-password';
      render();
      return;
    }
    if (session) enterApp(session);
    else render();

    /* a manifest shortcut or a reload arrives with a route in the hash */
    if (INITIAL_ROUTE && S.session && INITIAL_ROUTE !== S.route) {
      go(INITIAL_ROUTE);
      render();
      loadRouteData(INITIAL_ROUTE);
    }
  }

  /* ------------------------------------------------------- error reporting */
  function reportClientError(message, context) {
    try {
      if (window.console) console.warn('[UniGuard]', message, context || {});
      if (Repo.client && Repo.client() && Repo.logClientError) Repo.logClientError(message, context || {});
    } catch (e) { /* never let reporting throw */ }
  }
  window.addEventListener('error', (e) => reportClientError(e.message, { type: 'error', source: e.filename, line: e.lineno }));
  window.addEventListener('unhandledrejection', (e) => reportClientError(
    (e.reason && e.reason.message) || String(e.reason), { type: 'unhandledrejection' }));

  window.UG_App = { S: S, render: render, toast: toast, actions: ALL };
  boot();
})();
