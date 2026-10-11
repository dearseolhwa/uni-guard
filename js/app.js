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
    offline: false, sevFilter: 'all', incBrgyFilter: 'All', centerFilter: 'all', readNotifs: false,
    corr: {}, declareArmed: false, loading: false, error: null, syncNote: '',
    barangays: [], users: [], audit: [], responders: [],
    /* incident queue sort: 'default' (newest first) or 'priority' (severity,
       then corroboration count, then recency) */
    incidentSort: 'default',
    /* analytics date range (ISO yyyy-mm-dd) */
    anFrom: '', anTo: '',
    /* shelters: 'all' (default) or 'mine' */
    shelterScope: 'all',
    /* new slices for the integrated features */
    reliefFilter: 'All', benSearch: '', benSearchLgu: '', benBarangayFilter: 'All',
    guideHazard: UG_HAZARDS.LIST[0].label, guidePhase: 'before',
    faqSearch: '',
    reportStatusFilter: 'all',
    roadDraft: { title: '', description: '', barangay: UG_GEO.PLACE.areaAll, road_name: '', address: '', lat: null, lng: null, expected_hours: 6, citywide: false },
    sosSending: false, lastSos: null,
    mapLayers: { hazards: true, relief: true, centers: true, roadStatus: true },
    mapPanelOpen: false,
    draft: { title: '', sev: 'warning', type: 'Emergency', area: UG_GEO.PLACE.areaAll, msg: '' },
    lastReport: null,
    report: {
      hazard: UG_HAZARDS.LIST[0].label, hazardOther: '', brgy: UG_GEO.BARANGAYS[0], urg: 'warning', desc: '',
      photo: false, photoBlob: null, photoName: '', gps: false, lat: null, lng: null,
      accuracy: null, error: '', busy: false, address: '', locationNote: '', mapDragging: false
    }
  };

  const q = (sel, el) => (el || document).querySelector(sel);
  const qa = (sel, el) => Array.prototype.slice.call((el || document).querySelectorAll(sel));
    const myBrgyName = () =>
    (S.session && S.session.role === 'barangay_official' && S.session.barangay)
      ? S.session.barangay
      : (S.barangays[0] ? S.barangays[0].name : '');
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

  /* Trigger a client-side file download from a string (used by the relief CSV
     export). Works without any server round-trip and is safe offline. */
  function downloadText(filename, text) {
    try {
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    } catch (e) { toast('Could not start the download', 'warning'); }
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
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { }
      }
    }
    paintChrome();
    mountMaps();
    syncNavButton();
    /* auto-acquire GPS the first time a citizen opens the report form, so the
       pin is already in place before they have to think about it. Never blocks:
       a failure silently leaves the form ready for the manual Acquire button. */
    if (S.session && S.route === 'report' && !S.report.gps && !S.report._autoTriggered) {
      S.report._autoTriggered = true;
      APP_ACTIONS.gps().catch(() => { });
    }
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
    const report = q('[data-map="report-pin"]');
    if (!live && !detail && !report) return;

    const targets = [];
    if (live) targets.push({ el: live, key: 'live:' + (UG.DATA.incidents || []).length + ':' + (S.offline ? 'o' : 'n'), centers: true });
    if (detail && S.openId) {
      const inc = (UG.DATA.incidents || []).find((i) => i.id === S.openId || i.uuid === S.openId);
      targets.push({ el: detail, key: 'detail:' + S.openId + ':' + (S.offline ? 'o' : 'n'), only: inc });
    }
    if (report) {
      /* the citizen report form's mini drag-to-adjust pin */
      targets.push({ el: report, key: 'report-pin:' + (S.report.lat || '') + ',' + (S.report.lng || ''), report: true });
    }

    for (const t of targets) {
      if (t.el.dataset.mounted === t.key) continue;
      t.el.dataset.mounted = t.key;
      t.el.innerHTML = '';
      if (t.report) {
        /* mount a draggable Leaflet pin that updates S.report on drop */
        const ctx = await MapView.mount(t.el, {
          reportPin: { lat: S.report.lat, lng: S.report.lng },
          zoom: 16,
          onPinDrop: (lat, lng) => APP_ACTIONS['report-pin-drop']({ lat: String(lat), lng: String(lng) })
        });
        continue;
      }
      const ctx = await MapView.mount(t.el, {
        incidents: t.only ? [t.only] : (UG.DATA.incidents || []),
        centers: t.centers ? (UG.DATA.centers || []) : [],
        relief: UG.DATA.relief || [],
        roadStatus: UG.DATA.roadStatus || [],
        layers: t.centers ? S.mapLayers : null,
        zoom: t.only ? 15 : 13
      });
      if (ctx && !ctx.fallback) {
        /* data-toggles: "inline" = the screen draws its own chip row, so no
           floating panel; "chip" = the panel opens from the header Layers chip */
        const mode = t.el.dataset.toggles;
        const panel = (t.centers && mode !== 'inline') ? layerToggleHtml(mode === 'chip' && !S.mapPanelOpen) : '';
        t.el.insertAdjacentHTML('beforeend', panel + '<div class="map-scale">1 : 25 000</div>');
      }
      MapView.invalidate();
    }
  }

  /* the small floating control that lets a citizen / LGU toggle the four
     overlay layers on the live map. Drawn after the map so it sits on top. */
  function layerToggleHtml(hidden) {
    if (!S.mapLayers) return '';
    const items = [
      ['hazards', 'Hazards', 'octagon', 'var(--ug-emergency)'],
      ['relief', 'Relief', 'square', '#8B5CF6'],
      ['centers', 'Shelters', 'square', 'var(--ug-shelter-open)'],
      ['roadStatus', 'Road status', 'diamond', 'var(--ug-warning)']
    ];
    return '<div class="ug-layer-toggle" role="group" aria-label="Map layers"' + (hidden ? ' hidden' : '') + '>' + items.map((it) =>
      '<button class="' + (S.mapLayers[it[0]] ? 'is-on' : '') + '" aria-pressed="' + !!S.mapLayers[it[0]] + '" data-act="map-layer-toggle" data-layer="' + it[0] + '">' +
      '<span class="swatch shape-' + it[2] + '" style="background:' + it[3] + '"></span>' + it[1] + '</button>').join('') + '</div>';
  }

  /* ------------------------------------------------------------ data loading */
  async function loadRouteData(route) {
    /* Dispatch team: their data comes from UG_DISPATCH, not Repo. */
    if (S.session && S.session.role === 'dispatch_team' && typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.loadRoute) {
      await UG_DISPATCH.loadRoute(route);
      return;
    }
    /* Barangay Response Team + LGU Dispatch Units: preload the dispatch
       directory + unit list + open support requests so the screens have
       data without a separate RPC per render. */
    if (route === 'response-team' || route === 'dispatch-units') {
      try {
        if (typeof Repo !== 'undefined' && Repo.loadDispatchDirectory) {
          await Repo.loadDispatchDirectory();
        }
      } catch (e) {}
      render();
      return;
    }
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
    if (route === 'sos') {
      /* the LGU console SOS screen reads the recent SOS log; refresh on entry */
      try { UG.DATA.sosLog = await Repo.listSos(); } catch (e) { UG.DATA.sosLog = []; }
      render();
      return;
    }
    if (route === 'others-review') {
      try { UG.DATA.othersReview = await Repo.listOthersReview(); } catch (e) { UG.DATA.othersReview = []; }
      render();
      return;
    }
    /* the operations dashboard, incident queue and command view all surface
       dispatched incidents, so preload their dispatch records (team + ETA) so
       the deployed response is visible without opening each incident first. */
    if (route === 'dashboard' || route === 'incidents' || route === 'command') {
      try { await loadDispatchesForDashboard(); } catch (e) { }
      return;
    }
  }

  async function bootstrapData() {
    /* Dispatch team: skip Repo.loadAll (the dispatch team has its own data
       shape and read scopes; the barangay/LGU dataset is not theirs). */
    if (S.session && S.session.role === 'dispatch_team' && typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.loadAll) {
      try { await UG_DISPATCH.loadAll(); } catch (e) {}
      render();
      return;
    }
    await Repo.loadAll();
    UG.DATA.users = S.users;
    UG.DATA.audit = S.audit;
    UG.DATA.responders = S.responders;
    S.barangays = await Repo.listBarangays();
    S.auth.barangays = S.barangays;
    /* the advisory composer and the report form offer the live barangay list */
    if (S.barangays.length) UG.DATA.barangays = S.barangays.map((b) => b.name);
    /* merge the freshly loaded notifications into the local store so a citizen
       who closes the app and reopens it still sees the alerts that came in
       between; then fire any emergency overlay that has not been acknowledged. */
    try { UG_NOTIF_STORE.mergeAll(UG.DATA.notifications || []); } catch (e) { }
    try { UG_URGENT.scan(); } catch (e) { }
    render();
  }

  /* ----------------------------------------------------------------- helpers */
  /* Hash routes make the manifest shortcuts work and let a reload land back on the
     screen you were on. They are not a permission mechanism: the database decides
     what you may actually see. */
  const HASH_ROUTES = ['home', 'report', 'reports', 'report-done', 'report-detail',
    'advisories', 'advisory-detail', 'centers', 'hotlines', 'notifications', 'offline',
    'dashboard', 'incidents', 'incident', 'analytics', 'users', 'audit', 'command', 'more',
    'relief', 'relief-verify', 'guides', 'faqs', 'roadwork', 'map', 'sos',
    'others-review', 'response-team', 'dispatch-units', 'dispatch',
    'equipment', 'roster', 'hospital', 'requests', 'contacts', 'dispatch-detail'];

  function routeFromHash() {
    const h = String((window.location && window.location.hash) || '').replace(/^#\/?/, '').split('?')[0];
    return (h && HASH_ROUTES.indexOf(h) !== -1) ? h : null;
  }

  function setHash(route) {
    const want = '#' + route;
    if (window.location.hash === want) return;
    try { window.history.replaceState(null, '', want); }
    catch (e) { try { window.location.hash = route; } catch (e2) { } }
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
    try { localStorage.setItem(NAV_KEY, open ? '1' : '0'); } catch (e) { }
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
    if (session.barangay && UG_GEO.BARANGAYS.indexOf(session.barangay) !== -1) {
      S.report.brgy = session.barangay;
    }
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

  /* ------------------------------------------------------- barangay combo */
  /* Helpers for the custom Barangay picker. The DOM is recreated on every
     render, so these always operate on the live element tree. */
  function closeAllBarangayCombos() {
    const combos = document.querySelectorAll('.ug-combo.is-open');
    for (let i = 0; i < combos.length; i++) {
      const combo = combos[i];
      const panel = combo.querySelector('.ug-combo-panel');
      const btn = combo.querySelector('.ug-combo-btn');
      if (panel) {
        panel.hidden = true;
        /* Reset the inline max-height set by maybeFlipCombo so the next
           open re-measures from the CSS default. */
        panel.style.maxHeight = '';
      }
      combo.classList.remove('is-open', 'is-flipped');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  }
  function visibleComboOptions(combo) {
    return Array.prototype.slice.call(combo.querySelectorAll('.ug-combo-option:not([hidden])'));
  }
  function activeComboIndex(combo) {
    const items = visibleComboOptions(combo);
    const active = combo.querySelector('.ug-combo-option.is-active');
    return active ? items.indexOf(active) : -1;
  }
  function setActiveComboOption(combo, opt, scroll) {
    if (!opt) return;
    combo.querySelectorAll('.ug-combo-option').forEach((it) => it.classList.remove('is-active'));
    opt.classList.add('is-active');
    if (scroll && opt.scrollIntoView) {
      try { opt.scrollIntoView({ block: 'nearest' }); } catch (e) { }
    }
  }
  function filterBarangayCombo(combo, query) {
    const q = (query || '').trim().toLowerCase();
    const items = combo.querySelectorAll('.ug-combo-option');
    let visible = 0;
    for (let i = 0; i < items.length; i++) {
      const name = (items[i].getAttribute('data-name') || '').toLowerCase();
      const show = !q || name.indexOf(q) !== -1;
      items[i].hidden = !show;
      if (show) visible++;
    }
    const empty = combo.querySelector('.ug-combo-empty');
    if (empty) empty.hidden = visible > 0;
    /* Reset the keyboard highlight to the first visible option so the next
       ArrowDown / Enter always targets something on screen. */
    const firstVis = visibleComboOptions(combo)[0];
    if (firstVis) setActiveComboOption(combo, firstVis, true);
    else combo.querySelectorAll('.ug-combo-option').forEach((it) => it.classList.remove('is-active'));
  }
  /* Decide whether to open the panel above (is-flipped) or below the
     trigger. With position:absolute anchoring, CSS handles the actual
     placement (top:calc(100% + 4px) or bottom:calc(100% + 4px)); JS only
     needs to pick the side with more viewport room so the panel never
     overflows the visible area.

     Preference is to open BELOW (the standard combobox pattern). The
     panel only flips up when there is critically little room below AND
     more room above. If the panel doesn't fit fully on either side, we
     shrink the inline max-height to fit the available space so the user
     never has to scroll the page to see the bottom of the list — the
     list itself scrolls internally. */
  function maybeFlipCombo(combo, panel) {
    if (!panel) return;
    const trigger = combo.querySelector('.ug-combo-btn');
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const gap = 6;
    /* Measure the panel's natural intended height: it's the smaller of
       its content-driven offsetHeight and the CSS max-height cap. */
    const cssMaxH = Math.min(panel.offsetHeight || 320, 360);
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    /* Flip only when there is critically little room below (<180px) AND
       there is more room above. Otherwise we keep the default (below)
       and let the inline max-height shrink the panel to fit. */
    const flip = spaceBelow < 180 && spaceAbove > spaceBelow;
    combo.classList.toggle('is-flipped', flip);
    const avail = flip ? spaceAbove : spaceBelow;
    /* Constrain the inline max-height so the panel fits inside the
       viewport, but never shrink it below 160px (still shows ~5 items
       + the search box). The CSS max-height of 360px stays as a
       ceiling — we only tighten it for tight viewports. */
    const inlineMaxH = Math.max(160, Math.min(cssMaxH, avail));
    panel.style.maxHeight = inlineMaxH + 'px';
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
    /* Open / close the Barangay combo. The DOM is recreated on every render,
       so the open state lives on the element itself, not in S. */
    'toggle-barangay-combo': (d, el) => {
      const combo = el.closest('.ug-combo');
      if (!combo) return;
      const panel = combo.querySelector('.ug-combo-panel');
      if (!panel) return;
      const wasOpen = !panel.hidden;
      closeAllBarangayCombos();
      if (wasOpen) {
        el.focus();
        return;
      }
      panel.hidden = false;
      combo.classList.add('is-open');
      el.setAttribute('aria-expanded', 'true');
      /* Flip the panel up if there is not enough room below the trigger. */
      maybeFlipCombo(combo, panel);
      comboJustOpened = Date.now();
      const search = combo.querySelector('.ug-combo-search');
      if (search) {
        search.value = '';
        filterBarangayCombo(combo, '');
        /* preventScroll stops the browser from scrolling the page to bring
           the focused input into view, which would otherwise trip the
           scroll-close handler and immediately close the dropdown. */
        try { search.focus({ preventScroll: true }); } catch (e) { search.focus(); }
      }
      /* Highlight the already-selected option (if any) so the next ArrowDown
         starts from there. Falls back to the first visible option. */
      const selected = combo.querySelector('.ug-combo-option.is-selected');
      const firstVis = visibleComboOptions(combo)[0];
      setActiveComboOption(combo, selected || firstVis, true);
    },
    /* Select a barangay from the list. Updates the hidden input and fires a
       synthetic change event so the existing form-collection handler still
       stores the value in S.auth.form.barangay_id. */
    'select-barangay': (d, el) => {
      const combo = el.closest('.ug-combo');
      if (!combo) return;
      const id = el.getAttribute('data-id');
      const name = el.getAttribute('data-name');
      const hidden = combo.querySelector('input[type="hidden"][data-field="barangay_id"]');
      const val = combo.querySelector('.ug-combo-val');
      const btn = combo.querySelector('.ug-combo-btn');
      if (hidden) {
        hidden.value = id;
        try { hidden.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) { }
      }
      if (val) {
        val.textContent = name;
        val.classList.add('is-selected');
      }
      if (btn) btn.classList.add('is-filled');
      combo.querySelectorAll('.ug-combo-option').forEach((it) => {
        it.classList.toggle('is-selected', it.getAttribute('data-id') === id);
      });
      closeAllBarangayCombos();
      if (btn) btn.focus();
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
      try { await UG_PWA.clearSnapshot(); } catch (e) { /* cleanup must never block signing out */ }
      S.session = null;
      S.auth = blankAuth();
      S.auth.notice = 'You have been signed out.';
      go('home');
      render();
    }
  };
    async function setOccupancy(c, n) {
    n = Math.max(0, Math.min(c.cap || 0, n));
    const patch = { occupancy: n };
    if (c.status !== 'closed') patch.status = (c.cap > 0 && n >= c.cap) ? 'full' : 'open';
    try {
      await Repo.updateCenter(c.uuid || c.id, patch);
      toast(c.name + ': ' + n + ' / ' + c.cap, patch.status === 'full' ? 'warning' : 'prepared');
    } catch (e) { toast(e.message, 'warning'); }
    render();
  }

  /* The full road-status form used by both Add and Edit. Fields: road name,
     barangay, from/to segment, status, cause, severity, start time, estimated
     reopening, map pin (lat/lng captured via GPS or typed from the map) and
     notes. Barangay Officials can only create/edit inside their own barangay
     (enforced by migration 029); the picker reflects that. */
  function roadStatusForm(existing) {
    const st = S.session || {};
    const isOfficial = st.role === 'barangay_official';
    const brgyList = (S.barangays && S.barangays.length) ? S.barangays.map((b) => b.name) : UG.DATA.barangays;
    const brgyOpts = (isOfficial && st.barangay ? [st.barangay] : brgyList)
      .map((b) => '<option' + (existing && existing.barangay === b ? ' selected' : '') + '>' + UG_UTIL.esc(b) + '</option>').join('');
    const statusOpts = [['passable', 'Open'], ['one_lane', 'One lane'], ['blocked', 'Closed'], ['under_repair', 'Under repair']]
      .map((s) => '<option value="' + s[0] + '"' + (existing && existing.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('');
    const causeOpts = [['', '—'], ['flood', 'Flood'], ['landslide', 'Landslide'], ['repair', 'Road repair'], ['accident', 'Accident'], ['other', 'Other']]
      .map((c2) => '<option value="' + c2[0] + '"' + (existing && existing.cause === c2[0] ? ' selected' : '') + '>' + c2[1] + '</option>').join('');
    const sevOpts = [['advisory', 'Moderate'], ['warning', 'High'], ['emergency', 'Critical']]
      .map((s) => '<option value="' + s[0] + '"' + (existing && existing.severity === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('');
    const val = (v) => (existing && existing[v] != null) ? UG_UTIL.esc(String(existing[v])) : '';
    UG_FEATURES.modal({
      title: existing ? 'Edit road status' : 'Add road status',
      body:
        '<div class="ug-rowf ug-gap12" style="gap:12px">' +
          '<div class="ug-field" style="flex:2"><label class="ug-lab">Road name</label><input class="ug-in" data-rs-road value="' + val('road_name') + '" placeholder="e.g. Aguila Rd"></div>' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Barangay</label><select class="ug-sel" data-rs-brgy>' + brgyOpts + '</select></div>' +
        '</div>' +
        '<div class="ug-rowf ug-gap12" style="gap:12px">' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">From (segment or landmark)</label><input class="ug-in" data-rs-from value="' + val('segment_from') + '" placeholder="e.g. Brgy hall"></div>' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">To</label><input class="ug-in" data-rs-to value="' + val('segment_to') + '" placeholder="e.g. national highway junction"></div>' +
        '</div>' +
        '<div class="ug-rowf ug-gap12" style="gap:12px">' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Status</label><select class="ug-sel" data-rs-status>' + statusOpts + '</select></div>' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Cause</label><select class="ug-sel" data-rs-cause>' + causeOpts + '</select></div>' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Severity</label><select class="ug-sel" data-rs-sev>' + sevOpts + '</select></div>' +
        '</div>' +
        '<div class="ug-rowf ug-gap12" style="gap:12px">' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Start time</label><input class="ug-in" type="datetime-local" data-rs-start value="' + val('started_at') + '"></div>' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Estimated reopening</label><input class="ug-in" type="datetime-local" data-rs-reopen value="' + val('estimated_reopen') + '"></div>' +
        '</div>' +
        '<div class="ug-field"><label class="ug-lab">Map pin</label>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px;align-items:center">' +
            '<input class="ug-in" style="flex:1" data-rs-lat placeholder="lat" value="' + val('lat') + '">' +
            '<input class="ug-in" style="flex:1" data-rs-lng placeholder="lng" value="' + val('lng') + '">' +
            '<button class="ug-btn ug-btn--sm" type="button" data-act="rs-pin">Use my location</button>' +
          '</div>' +
          '<div class="ug-help">Tap the map on the Road Status screen and pick “Set pin here”, or type coordinates from it (latitude first). The pin powers the map overlay and navigation.</div></div>' +
        '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Notes</label><textarea class="ug-ta" rows="2" data-rs-note>' + val('note') + '</textarea></div>',
      footer:
        '<button class="ug-btn" data-modal-close>Cancel</button>' +
        '<button class="ug-btn ug-btn--signal" data-save>' + (existing ? 'Save changes' : 'Publish status') + '</button>',
      onMount: (wrap, close) => {
        wrap.querySelector('[data-save]').addEventListener('click', async () => {
          const roadName = wrap.querySelector('[data-rs-road]').value.trim();
          if (!roadName) { toast('The road name is required', 'warning'); return; }
          const lat = UG_GEO.toNum(wrap.querySelector('[data-rs-lat]').value);
          const lng = UG_GEO.toNum(wrap.querySelector('[data-rs-lng]').value);
          if ((wrap.querySelector('[data-rs-lat]').value || wrap.querySelector('[data-rs-lng]').value)) {
            const state = UG_GEO.classify(lat, lng);
            if (state !== 'ok') { toast(UG_GEO.message(state) || 'Those coordinates do not look right', 'warning'); return; }
          }
          const toISO = (v) => v ? new Date(v).toISOString() : null;
          const payload = {
            road_name: roadName,
            barangay: wrap.querySelector('[data-rs-brgy]').value,
            status: wrap.querySelector('[data-rs-status]').value,
            cause: wrap.querySelector('[data-rs-cause]').value,
            severity: wrap.querySelector('[data-rs-sev]').value,
            segment_from: wrap.querySelector('[data-rs-from]').value.trim(),
            segment_to: wrap.querySelector('[data-rs-to]').value.trim(),
            started_at: toISO(wrap.querySelector('[data-rs-start]').value),
            estimated_reopen: toISO(wrap.querySelector('[data-rs-reopen]').value),
            note: wrap.querySelector('[data-rs-note]').value.trim(),
            lat: isFinite(lat) ? lat : null,
            lng: isFinite(lng) ? lng : null
          };
          try {
            if (existing) await Repo.updateRoadStatus(existing.id, payload);
            else await Repo.createRoadStatus(payload);
            toast(existing ? 'Road status updated' : 'Road status published', 'prepared');
            close();
            render();
          } catch (e) { toast(e.message, 'warning'); }
        });
      }
    });
  }

  /* Citizen edit of their own report inside the 15-minute window. Same
     validation rules as submit; the server (migration 027) enforces the window
     and the protected columns again. */
  function editOwnReport(inc) {
    const r = S.report;
    S.route = 'report';
    S.editing = { id: inc.uuid || inc.id, code: inc.id, desc: inc.desc, hazard: inc.hazard_type, hazardOther: inc.hazard_other_text || '', sev: inc.sev, lat: inc.lat, lng: inc.lng, locationNote: inc.location_note || '' };
    r.hazard = inc.hazard_type || r.hazard;
    r.hazardOther = inc.hazard_other_text || '';
    r.urg = inc.sev || r.urg;
    r.desc = inc.desc || '';
    r.lat = inc.lat; r.lng = inc.lng; r.gps = (typeof inc.lat === 'number');
    r.locationNote = inc.location_note || '';
    toast('Editing ' + inc.id + '. Save before the 15-minute window closes.', 'info');
    render();
  }
    /* ------------------------------------------------------------ dispatch form */
  /* "Barangay Tanod" was renamed to "Barangay Response Team" per LGU request —
     the team is now an organized per-barangay response unit rather than a
     watchman. The DB constraint (migration 035) accepts the new name. */
  const DISPATCH_TEAMS = ['MDRRMO Rescue', 'BFP', 'PNP', 'Barangay Response Team', 'Ambulance', 'Rescue Unit'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const toLocalInput = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());

  function loadDispatchesFor(id) {
    const inc = (UG.DATA.incidents || []).find((i) => i.id === id || i.uuid === id);
    if (!inc || !inc.uuid) return;
    Repo.loadDispatches(inc.uuid).then(() => { if (S.session) render(); }).catch(() => { });
  }

  /* Preload dispatch records for every dispatched incident so the dashboard,
     incident queue and command view can show the deployed team/ETA without the
     duty officer first having to open each incident. Capped so a very busy day
     does not fire dozens of queries. */
  function loadDispatchesForDashboard() {
    const dispatched = (UG.DATA.incidents || []).filter((i) => i.status === 'dispatched' && i.uuid);
    const slice = dispatched.slice(0, 30);
    if (!slice.length) return Promise.resolve();
    return Promise.all(slice.map((i) => Repo.loadDispatches(i.uuid).catch(() => null)))
      .then(() => { if (S.session) render(); })
      .catch(() => { });
  }

  function dispatchModal(inc) {
    if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can dispatch a response', 'warning'); return; }
    if (inc.status !== 'verified' && inc.status !== 'dispatched') {
      toast('Verify the report before dispatching a response', 'warning'); return;
    }
    const me = S.session;
    const roleLabel = (UG_WEB.ROLE_INFO[me.role] || {}).label || '';
    const esc = UG_UTIL.esc;

    /* The team list now includes municipality-wide units. The pickable
       unit list comes from the directory loader (Repo.loadDispatchDirectory).
       For the barangay Response Team there is no unit_id — the team IS the
       report's barangay's own team. */
    const units = UG.DATA.dispatchUnits || [];
    const unitByType = (type) => units.filter((u) => u.unit_type === type && u.active);
    const teamOpts = DISPATCH_TEAMS.map((t) => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');

    const defaultEta = toLocalInput(new Date(Date.now() + 30 * 60000));
    const kv = (k, v, attrs) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--ug-line)">' +
      '<span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600"' + (attrs || '') + '>' + esc(v) + '</span></div>';

    /* Equipment picker: populated based on the team. For municipality-wide
       units, the available equipment of the chosen unit. For the Response
       Team, the available equipment of the report's barangay. */
    const equipmentOpts = (team, unitId) => {
      const list = (UG.DATA.dispatchEquipment || []).filter((e) => {
        if (e.status !== 'available') return false;
        if (e.condition && ['needs_repair', 'missing', 'out_of_service'].indexOf(e.condition) !== -1) return false;
        if (team === 'Barangay Response Team') return e.owner_barangay_id === (inc.brgy_id || inc.barangay_id);
        return unitId && e.owner_unit_id === unitId;
      });
      if (!list.length) return '<option value="">(no equipment available)</option>';
      return '<option value="">(none)</option>' + list.map((e) =>
        '<option value="' + esc(e.id) + '">' + esc(e.identifier || e.custom_label || 'equipment') + '</option>').join('');
    };

    UG_FEATURES.modal({
      title: (inc.status === 'dispatched' ? 'Add another team · ' : 'Dispatch response · ') + inc.id,
      body:
        '<div class="ug-field"><label class="ug-lab">Responder or team</label>' +
          '<select class="ug-sel" data-dp-team>' + teamOpts + '</select></div>' +
        '<div class="ug-field" data-dp-unit-field hidden><label class="ug-lab">Unit (municipality-wide)</label>' +
          '<select class="ug-sel" data-dp-unit><option value="">Select a unit</option>' +
          units.map((u) => '<option value="' + esc(u.id) + '" data-type="' + esc(u.unit_type) + '">' + esc(u.name) + ' · ' + esc(u.unit_type) + '</option>').join('') +
          '</select></div>' +
        '<div class="ug-field"><label class="ug-lab">Equipment to deploy (optional)</label>' +
          '<select class="ug-sel" data-dp-equipment>' + equipmentOpts('Barangay Response Team', null) + '</select>' +
          '<div class="ug-help">Equipment that is not Available or in a deployable condition is absent from the picker.</div></div>' +
        '<div class="ug-field"><label class="ug-lab">Action or instructions</label>' +
          '<textarea class="ug-ta" rows="3" data-dp-instr placeholder="e.g. Evacuate Purok 3, bring boat"></textarea>' +
          '<div class="ug-help">Say exactly what the team should do and what to bring.</div></div>' +
        '<div class="ug-field"><label class="ug-lab">ETA (estimated arrival)</label>' +
          '<input class="ug-in" type="datetime-local" data-dp-eta value="' + defaultEta + '">' +
          '<div class="ug-rowf ug-gap8" style="gap:6px;margin-top:8px">' +
            [15, 30, 60, 120].map((m) => '<button type="button" class="ug-chip" data-dp-quick="' + m + '">' + (m < 60 ? m + ' min' : (m / 60) + ' h') + '</button>').join('') +
          '</div></div>' +
        '<div style="margin-top:4px">' +
          kv('Dispatched by', me.name + (roleLabel ? ' · ' + roleLabel : '')) +
          kv('Dispatch time', new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), ' data-dp-now') +
        '</div>' +
        '<div class="ug-help">Dispatcher and time are recorded automatically by the server.</div>',
      footer:
        '<button class="ug-btn" data-modal-close>Cancel</button>' +
        '<button class="ug-btn ug-btn--signal" data-dp-confirm>' + UG.icon('truck', 15) + 'Confirm Dispatch</button>',
      onMount: (wrap, close) => {
        const etaEl = wrap.querySelector('[data-dp-eta]');
        wrap.querySelectorAll('[data-dp-quick]').forEach((b) => b.addEventListener('click', () => {
          etaEl.value = toLocalInput(new Date(Date.now() + parseInt(b.getAttribute('data-dp-quick'), 10) * 60000));
        }));
        const teamSel = wrap.querySelector('[data-dp-team]');
        const unitField = wrap.querySelector('[data-dp-unit-field]');
        const unitSel = wrap.querySelector('[data-dp-unit]');
        const eqSel = wrap.querySelector('[data-dp-equipment]');
        const refreshEquipment = () => {
          const team = teamSel.value;
          const unitId = unitSel.value || null;
          // map the team to a unit type
          let mappedUnitId = unitId;
          if (team === 'Barangay Response Team') mappedUnitId = null;
          eqSel.innerHTML = equipmentOpts(team, mappedUnitId);
        };
        const refreshUnitField = () => {
          const team = teamSel.value;
          // Show the unit picker for the municipality-wide teams
          const needsUnit = team !== 'Barangay Response Team';
          unitField.hidden = !needsUnit;
          if (needsUnit) {
            // restrict the unit options to ones matching the team type
            const type = team === 'BFP' ? 'BFP' : team === 'PNP' ? 'PNP'
              : (team === 'Rescue Unit' || team === 'MDRRMO Rescue') ? 'Rescue'
              : team === 'Ambulance' ? 'Hospital' : null;
            Array.prototype.forEach.call(unitSel.options, (o) => {
              if (!o.value) { o.hidden = false; return; }
              o.hidden = type && o.getAttribute('data-type') !== type;
            });
            // default-select the first matching unit
            const firstMatch = Array.prototype.find.call(unitSel.options, (o) => o.value && !o.hidden);
            if (firstMatch && !unitSel.value) unitSel.value = firstMatch.value;
          }
          refreshEquipment();
        };
        teamSel.addEventListener('change', refreshUnitField);
        unitSel.addEventListener('change', refreshEquipment);

        const btn = wrap.querySelector('[data-dp-confirm]');
        btn.addEventListener('click', async () => {
          const team = wrap.querySelector('[data-dp-team]').value;
          const instructions = wrap.querySelector('[data-dp-instr]').value.trim();
          const etaVal = etaEl.value;
          const unitId = wrap.querySelector('[data-dp-unit]').value || null;
          const eqId = wrap.querySelector('[data-dp-equipment]').value || null;
          if (!instructions) { toast('Write what the team is supposed to do', 'warning'); return; }
          if (!etaVal) { toast('Set an estimated arrival time', 'warning'); return; }
          if (team !== 'Barangay Response Team' && !unitId) { toast('Pick a unit to dispatch', 'warning'); return; }
          const eta = new Date(etaVal);
          if (isNaN(eta.getTime()) || eta.getTime() < Date.now() - 5 * 60000) {
            toast('The ETA must be a time from now onward', 'warning'); return;
          }
          btn.disabled = true;
          try {
            await Repo.dispatchReportV2(inc.uuid || inc.id, {
              team: team, instructions: instructions, eta: eta.toISOString(),
              unit_id: unitId, equipment_ids: eqId ? [eqId] : null
            });
            toast(team + ' dispatched to ' + inc.id, 'prepared');
            try {
              if (!Repo.client || !Repo.client()) {
                UG.DATA.notifications = UG.DATA.notifications || [];
                UG.DATA.notifications.unshift({
                  id: 'local-disp-' + Date.now(), title: 'Response team dispatched to ' + (inc.brgy || 'barangay'),
                  body: team + ' · ' + instructions, tone: 'warning', icon: 'truck',
                  type: 'dispatch', report_id: inc.uuid || inc.id, created_at: new Date().toISOString(),
                  time: 'just now', unread: true
                });
              }
            } catch (e2) {}
            toast(inc.brgy ? ('Barangay ' + inc.brgy + ' notified a response team is en route') : 'The barangay has been notified', 'info');
            close();
            render();
          } catch (e) {
            btn.disabled = false;
            toast(e.message || 'Could not dispatch', 'warning');
          }
        });
      }
    });
  }
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
    'open-incident': (d) => { S.openId = d.id; S.route = S.role === 'citizen' ? 'report-detail' : 'incident'; render(); loadDispatchesFor(d.id); },
    'open-report': (d) => { S.openId = d.id; S.route = 'report-detail'; render(); loadDispatchesFor(d.id); },
    'open-sos-detail': (d) => { UG_SOS.sosDetailModal(S, d.id); },
    'open-road-detail': (d) => { UG_ROADWORK.roadDetailModal(d.id); },

    'rw-manual-pin': () => {
      /* replaced the single-line "Latitude, longitude" prompt with a proper
         modal: the LGU can now type a barangay and/or street name (the human
         description residents will read) AND optionally coordinates. If
         coordinates are given they win; otherwise the pin is left null and the
         address text is stored so the notification still carries a readable
         location. */
      const d = S.roadDraft || {};
      UG_FEATURES.modal({
        title: 'Set road work location',
        body:
          '<div class="ug-field"><label class="ug-lab">Barangay</label>' +
            '<input class="ug-in" data-rw-modal-brgy value="' + UG_UTIL.esc(d.barangay || '') + '" placeholder="e.g. Poblacion" list="rw-brgy-list">' +
            '<datalist id="rw-brgy-list">' + UG.DATA.barangays.map((b) => '<option value="' + UG_UTIL.esc(b) + '">').join('') + '</datalist>' +
            '<div class="ug-help">Type or pick a barangay. This is what residents see in the notification.</div></div>' +
          '<div class="ug-field"><label class="ug-lab">Street / road name</label>' +
            '<input class="ug-in" data-rw-modal-road value="' + UG_UTIL.esc(d.road_name || '') + '" placeholder="e.g. Aguila Rd, near the Capitol">' +
            '<div class="ug-help">A landmark or cross-street helps citizens find the spot.</div></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Coordinates (optional)</label>' +
            '<div class="ug-rowf ug-gap8" style="gap:8px">' +
              '<input class="ug-in" style="flex:1" data-rw-modal-lat placeholder="lat" value="' + (d.lat != null ? UG_UTIL.esc(String(d.lat)) : '') + '">' +
              '<input class="ug-in" style="flex:1" data-rw-modal-lng placeholder="lng" value="' + (d.lng != null ? UG_UTIL.esc(String(d.lng)) : '') + '">' +
            '</div>' +
            '<div class="ug-help">Optional. If you skip these, the pin shows the text address only (Waze navigation stays hidden until coords are added). Example: ' + UG_GEO.EXAMPLE + '</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Save location</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', () => {
            const brgy = (wrap.querySelector('[data-rw-modal-brgy]') || {}).value || '';
            const road = (wrap.querySelector('[data-rw-modal-road]') || {}).value || '';
            const latRaw = (wrap.querySelector('[data-rw-modal-lat]') || {}).value || '';
            const lngRaw = (wrap.querySelector('[data-rw-modal-lng]') || {}).value || '';
            /* barangay + street always save as the address text */
            if (brgy.trim()) S.roadDraft.barangay = brgy.trim();
            if (road.trim()) S.roadDraft.road_name = road.trim();
            /* build a readable address from whatever was typed */
            const addrParts = [road.trim(), brgy.trim(), 'Lingayen, Pangasinan'].filter(Boolean);
            if (addrParts.length > 1) S.roadDraft.address = addrParts.join(', ');
            /* coordinates: only set if both are valid numbers */
            if (latRaw.trim() || lngRaw.trim()) {
              const lat = UG_GEO.toNum(latRaw), lng = UG_GEO.toNum(lngRaw);
              if (isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0)) {
                const state = UG_GEO.classify(lat, lng);
                if (state === 'ok') {
                  S.roadDraft.lat = lat; S.roadDraft.lng = lng;
                  toast('Location set: ' + (S.roadDraft.address || UG_GEO.fmt(lat, lng)), 'prepared');
                } else {
                  toast('Address saved, but coordinates are ' + UG_GEO.message(state) + ' — pin stays empty', 'warning');
                  S.roadDraft.lat = null; S.roadDraft.lng = null;
                }
              } else {
                toast('Address saved without coordinates', 'info');
                S.roadDraft.lat = null; S.roadDraft.lng = null;
              }
            } else {
              /* no coordinates typed: clear any stale pin so the text address
                 is what shows, not a wrong old pin */
              S.roadDraft.lat = null; S.roadDraft.lng = null;
              toast(brgy.trim() || road.trim() ? 'Location set: ' + (S.roadDraft.address || road.trim() || brgy.trim()) : 'Location cleared', 'info');
            }
            close();
            render();
          });
        }
      });
    },

    'toggle-more': (d, el) => {
      const wrap = el.closest('.ug-wmore');
      if (!wrap) return;
      const panel = wrap.querySelector('[data-more-panel]');
      if (panel) panel.hidden = !panel.hidden;
    },

    /* shelter detail view: the full record, occupancy, contact and Waze */
    'open-center-detail': (d, el) => {
      const c = (UG.DATA.centers || []).find((x) => (x.uuid || x.id) === d.id || x.id === d.id);
      if (!c) return;
      const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + UG_UTIL.esc(k) + '</span><span style="text-align:right;font-weight:600">' + UG_UTIL.esc(v) + '</span></div>';
      const pct = c.cap ? Math.min(100, Math.round((c.occ || 0) / c.cap * 100)) : 0;
      UG_FEATURES.modal({
        title: c.name || 'Evacuation center',
        body:
          '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">' + UG.badge(c.status, (c.status || 'open').charAt(0).toUpperCase() + (c.status || '').slice(1)) +
            '<span class="ug-mono" style="font-size:12px">' + (c.occ || 0) + ' / ' + (c.cap || 0) + ' slots</span></div>' +
          '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;margin-bottom:12px">' +
            '<div style="height:100%;width:' + pct + '%;background:' + (pct >= 100 ? 'var(--ug-warning)' : 'var(--ug-prepared)') + '"></div></div>' +
          kv('Barangay', c.brgy || '—') +
          kv('Address / notes', c.note || '—') +
          kv('Capacity', String(c.cap || 0)) +
          kv('Current occupancy', String(c.occ || 0)) +
          kv('Coordinates', (typeof c.lat === 'number' && typeof c.lng === 'number') ? UG_GEO.fmt(c.lat, c.lng) : 'Not recorded') +
          (typeof c.lat === 'number' && typeof c.lng === 'number' && UG_GEO.canNavigate(c.lat, c.lng)
            ? '<a class="ug-waze-btn" style="margin-top:12px;display:inline-flex" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(c.lat, c.lng) + '">' + UG.icon('route', 13) + ' Navigate with Waze</a>' : ''),
        footer: '<button class="ug-btn" data-modal-close>Close</button>'
      });
    },
    'sev-filter': (d) => { S.sevFilter = d.v; render(); },
    'inc-brgy-clear': () => { S.incBrgyFilter = 'All'; render(); },
    'center-filter': (d) => { S.centerFilter = d.v; render(); },
    'set-urg': (d) => { S.report.urg = d.v; render(); },

    gps: async () => {
      toast('Reading your position...', 'info');
      try {
        const p = await UG_FEATURES.locate();
        S.report.lat = p.lat; S.report.lng = p.lng; S.report.accuracy = p.accuracy; S.report.gps = true;
        /* reverse-geocode so a citizen can verify the pin against a real address, and
           so the LGU sees something more human-readable than lat/lng on the dispatch view.
           Also try to guess the barangay from it and pre-fill the dropdown — the citizen
           can still change it, this is a best-effort suggestion, not a locked value. */
        try {
          const geo = await UG_FEATURES.reverseGeocode(p.lat, p.lng);
          S.report.address = geo.address || '';
          if (geo.barangay) {
            S.report.brgy = geo.barangay;
            toast('Position acquired, accuracy ' + p.accuracy + ' m · barangay set to ' + geo.barangay, 'prepared');
          } else {
            toast('Position acquired, accuracy ' + p.accuracy + ' m' + (S.report.address ? ' · ' + S.report.address : '') + ' — please confirm your barangay', 'prepared');
          }
        } catch (e) { S.report.address = ''; }
      } catch (e) {
        /* Plain explanation + the map pin is the fallback. The pin on the report
           map is already live: dragging or tapping it sets the location. A manual
           coordinate entry stays available as a small secondary control. */
        S.report.gpsDenied = true;
        toast('We could not read your GPS (' + (e.message || 'unavailable') + '). ' +
          'Drop the pin on the map below at the hazard location — the report needs a location so it reaches the right barangay.', 'warning');
      }
      render();
    },

    /* manual coordinate fallback for when GPS AND the map are impractical */
    'manual-coords': async () => {
      const manual = await UG_FEATURES.prompt({
        title: 'Enter coordinates',
        label: 'Latitude, longitude',
        placeholder: UG_GEO.EXAMPLE,
        help: 'Example: 16.0206, 120.2306 — latitude first.'
      });
      const parsed = UG_FEATURES.parseCoords(manual);
      if (parsed) {
        S.report.lat = parsed.lat; S.report.lng = parsed.lng; S.report.gps = true; S.report.accuracy = null;
        try {
          const geo = await UG_FEATURES.reverseGeocode(parsed.lat, parsed.lng);
          S.report.address = geo.address || '';
          if (geo.barangay) S.report.brgy = geo.barangay;
        } catch (er) { S.report.address = ''; }
        toast(parsed.outside ? 'Coordinates set, but they look outside Lingayen — double-check them' : 'Coordinates set manually', parsed.outside ? 'warning' : 'prepared');
      } else if (manual) {
        toast('That does not look like a coordinate pair', 'warning');
      }
      render();
    },

    /* drag-adjustment of the GPS pin: the report screen hosts a small Leaflet
       map that the citizen can drag the marker on. This action receives the new
       {lat,lng} and stores it on S.report. */
    'report-pin-drop': async (d) => {
      const lat = parseFloat(d.lat), lng = parseFloat(d.lng);
      if (!isFinite(lat) || !isFinite(lng)) return;
      S.report.lat = lat; S.report.lng = lng; S.report.gps = true;
      try {
        const geo = await UG_FEATURES.reverseGeocode(lat, lng);
        S.report.address = geo.address || '';
        if (geo.barangay) S.report.brgy = geo.barangay;
      } catch (e) { S.report.address = ''; }
      render();
      const sc = q('.ug-scroll');
      if (sc) {
        const addr = sc.querySelector('[data-field="geoAddress"]');
        if (addr) addr.textContent = S.report.address || 'Reverse-geocoding…';
        const coords = sc.querySelector('[data-field="geoCoords"]');
        if (coords) coords.textContent = UG_GEO.fmt(lat, lng);
      }
    },

    'add-photo': async () => {
      const file = await UG_FEATURES.pickPhoto();
      if (!file) return;
      try {
        const out = await UG_FEATURES.compressImage(file);
        S.report.photoBlob = out.blob;
        S.report.photoName = file.name || 'hazard.jpg';
        S.report.photo = true;
        if (S.report.photoPreview) { try { URL.revokeObjectURL(S.report.photoPreview); } catch (e) {} }
        S.report.photoPreview = URL.createObjectURL(out.blob);
        S.report.photoBytes = out.bytes;
        toast('Photo attached, ' + UG_UTIL.bytes(out.bytes) + ' after compression', 'prepared');
      } catch (e) {
        toast(e.message, 'warning');
      }
      render();
    },
        'rm-photo': () => {
      if (S.report.photoPreview) { try { URL.revokeObjectURL(S.report.photoPreview); } catch (e) {} }
      S.report.photo = false; S.report.photoBlob = null; S.report.photoName = '';
      S.report.photoPreview = null; S.report.photoBytes = null;
      render();
    },

    'start-edit-report': (d) => {
      if (S.role !== 'citizen') { APP_ACTIONS['edit-report'](d); return; }
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (!inc) return;
      const age = Date.now() - Date.parse(inc.created_at || '');
      if (age > 15 * 60000) {
        toast('The 15-minute edit window for this report has closed. An official can still help you.', 'warning');
        return;
      }
      editOwnReport(inc);
    },

    'cancel-edit': () => {
      S.editing = null;
      go(S.role === 'citizen' ? 'reports' : 'incidents');
      render();
    },

    'submit-report': async () => {
      const r = S.report;
      if (!r.desc.trim()) { toast('Add a short description before submitting', 'warning'); return; }
      const hz = UG_HAZARDS.classify(r.hazard);
      if (hz.key === 'other' && !(r.hazardOther || '').trim()) {
        toast('Tell us what the hazard is before submitting', 'warning');
        return;
      }
      /* Location is MANDATORY: the server routes the report to the barangay that
         contains its coordinates, so a report without a valid in-Lingayen fix
         cannot be accepted. This client check mirrors migration 030. */
      const locState = UG_GEO.classify(r.lat, r.lng);
      if (locState !== 'ok') {
        toast(UG_GEO.message(locState) || 'A location is required. Acquire your GPS or drop the pin on the map before submitting.', 'warning');
        return;
      }
      if (r.busy) return;
      r.busy = true;
      try {
        if (S.editing) {
          /* citizen edit of an existing report (15-minute window) */
          await Repo.updateReport(S.editing.id, {
            description: r.desc.trim(), hazard_type: r.hazard,
            hazard_other_text: r.hazardOther || null,
            severity: r.urg || 'advisory', urgency: r.urg,
            location_note: r.locationNote || '',
            lat: r.lat, lng: r.lng
          });
          toast(S.editing.code + ' updated. The change was recorded in the audit log.', 'prepared');
          S.editing = null;
          S.route = 'reports';
          S.report = { hazard: r.hazard, hazardOther: '', brgy: r.brgy, urg: 'warning', desc: '', photo: false, photoBlob: null, photoName: '', gps: false, lat: null, lng: null, accuracy: null, error: '', busy: false, address: '', locationNote: '', _autoTriggered: false };
        } else if (!UG_PWA.state.online || !Repo.online()) {
          /* the queue refuses null coordinates too — a queued report without a
             location would be rejected by the server on upload anyway */
          await UG_PWA.enqueue({
            hazard_type: r.hazard, hazard_other_text: r.hazardOther || '', barangay: r.brgy, description: r.desc.trim(),
            severity: r.urg || 'advisory', urgency: r.urg, lat: r.lat, lng: r.lng,
            location_note: r.locationNote || '',
            photoBlob: r.photoBlob || null
          });
          toast('Saved on this device. It uploads when you are back online.', 'warning');
          S.lastReport = { id: null, brgy: r.brgy };
        } else {
          const res = await Repo.createReport({
            hazard_type: r.hazard, hazard_other_text: r.hazardOther || '', barangay: r.brgy, description: r.desc.trim(),
            severity: r.urg || 'advisory', urgency: r.urg, lat: r.lat, lng: r.lng,
            location_note: r.locationNote || '',
            photoBlob: r.photoBlob, reportCodeHint: 'draft'
          });
          toast(res.queued ? 'Saved for upload' : 'Report ' + res.row.id + ' submitted to the ' + r.brgy + ' queue', 'prepared');
          S.lastReport = { id: res.row ? res.row.id : null, brgy: r.brgy };
        }
        S.route = 'report-done';
        S.report = { hazard: r.hazard, hazardOther: '', brgy: r.brgy, urg: 'warning', desc: '', photo: false, photoBlob: null, photoName: '', gps: false, lat: null, lng: null, accuracy: null, error: '', busy: false, address: '', locationNote: '', _autoTriggered: false };
      } catch (e) {
        r.busy = false;
        toast(e.message || 'Could not submit the report', 'warning');
      }
      render();
    },

        'confirm-corr': async (d) => {
      let pos = null;
      try { pos = await UG_FEATURES.locate(); } catch (e) { /* no GPS: the barangay rule applies */ }
      try {
        const res = await Repo.corroborate(d.id, '', pos);
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
      if (order[next] === 'dispatched') { dispatchModal(inc); return; }
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

    'dispatch-open': (d) => {
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (inc) dispatchModal(inc);
    },

    /* LGU-only second verification path (migration 036). When a barangay is
       inactive, LGU/LDRRMC can mark a reported incident as LGU-verified so the
       response can move forward. The RPC records verified_by_role='lgu_ldrrmc'
       + the verifier's name so both verify levels stay distinguishable. */
    'lgu-verify': async (d) => {
      if (!requireRole(['lgu_ldrrmc'])) { toast('Only LGU / LDRRMC can LGU-verify a report', 'warning'); return; }
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (!inc) return;
      if (inc.status !== 'reported') { toast('Only a report still in "reported" can be LGU-verified', 'warning'); return; }
      const note = await UG_FEATURES.prompt({
        title: 'LGU-verify ' + inc.id,
        label: 'Note (optional, shown in the audit log)',
        placeholder: 'e.g. Barangay official unreachable; LGU verifying on their behalf.'
      });
      if (note === null) return;
      try {
        await Repo.lguVerify(inc.uuid || inc.id, note || '');
        toast(inc.id + ' LGU-verified', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'center-status': async (d) => {
      try {
        const c = (UG.DATA.centers || []).find((x) => (x.uuid || x.id) === d.id || x.id === d.id);
        const patch = { status: d.s };
        if (d.s === 'closed') patch.occupancy = 0;
        /* When a shelter is marked "full", snap occupancy to its full capacity
           so the directory immediately reads e.g. 1000/1000 instead of 0/1000.
           The dashboard and citizen shelter list both read occupancy from the
           same record, so they all update together. */
        if (d.s === 'full' && c && c.cap) patch.occupancy = c.cap;
        await Repo.updateCenter(d.id, patch);
        toast('Shelter marked ' + d.s, d.s === 'open' ? 'prepared' : d.s === 'full' ? 'warning' : 'emergency');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

        'center-occ': async (d) => {
      const c = (UG.DATA.centers || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (c) await setOccupancy(c, (c.occ || 0) + parseInt(d.d, 10));
    },
    'center-occ-set': async (d) => {
      const c = (UG.DATA.centers || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (!c) return;
      const v = await UG_FEATURES.prompt({ title: 'Set occupancy', label: c.name + ' (capacity ' + c.cap + ')', value: String(c.occ || 0) });
      if (v === null) return;
      const n = parseInt(v, 10);
      if (isNaN(n)) { toast('Enter a whole number', 'warning'); return; }
      await setOccupancy(c, n);
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
      UG_FEATURES.modal({
        title: 'Edit hotline',
        body:
          '<div class="ug-field"><label class="ug-lab">Agency</label>' +
          '<input class="ug-in" data-hl-agency value="' + UG_UTIL.esc(h.agency) + '"></div>' +
          '<div class="ug-field"><label class="ug-lab">Contact number</label>' +
          '<input class="ug-in" data-hl-number value="' + UG_UTIL.esc(h.number) + '"></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Scope</label>' +
          '<input class="ug-in" data-hl-scope value="' + UG_UTIL.esc(h.scope) + '"></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Save</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const agency = wrap.querySelector('[data-hl-agency]').value.trim();
            const number = wrap.querySelector('[data-hl-number]').value.trim();
            const scope = wrap.querySelector('[data-hl-scope]').value.trim();
            if (!agency || !number) { toast('An agency and a contact number are required', 'warning'); return; }
            try {
              await Repo.updateHotline(h.uuid || h.id, { agency_name: agency, contact_number: number, scope: scope });
              toast('Hotline updated', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    'delete-hotline': async (d) => {
      const h = (UG.DATA.hotlines || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (!h) return;
      const ok = await UG_FEATURES.confirm({
        title: 'Delete hotline', message: 'Remove ' + h.agency + ' from the directory on every device?',
        confirmLabel: 'Delete', danger: true
      });
      if (!ok) return;
      try { await Repo.deleteHotline(h.uuid || h.id); toast('Hotline deleted', 'warning'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'export-hotlines': async () => {
      const rows = (UG.DATA.hotlines || []).map((h) => [
        h.agency || '', h.number || '', h.scope || ''
      ]);
      if (!rows.length) { toast('Nothing to export', 'info'); return; }
      try {
        UG_PDF.exportDoc({
          title: 'Emergency Hotline Directory',
          subtitle: 'Every agency contact cached offline on resident devices.',
          kind: 'Directory export',
          generatedBy: (S.session ? S.session.name + ' · ' + (UG_WEB.ROLE_INFO[S.session.role] || {}).label : 'UniGuard'),
          scope: UG_GEO.PLACE.scope,
          filename: 'uniguard-hotlines.pdf',
          tables: [{ name: 'Hotlines', note: 'Numbers are listed exactly as published by each agency.', head: ['Agency', 'Contact number', 'Scope'], rows: rows }]
        });
        toast('Hotline directory exported as PDF', 'info');
      } catch (e) { toast(e.message, 'warning'); }
    },

    'export-analytics': async () => {
      try {
        const a = await Repo.analytics(S.anFrom || null, S.anTo || null);
        const hazardRows = Object.keys(a.byHazard || {}).map((k) => [k, a.byHazard[k]]);
        const statusRows = Object.keys(a.stages || {}).map((k) => [UG_THEME.status(k).label, a.stages[k]]);
        if (!hazardRows.length && !statusRows.length) { toast('No analytics data yet', 'info'); return; }
        const fmtDur = (s) => s == null ? '—' : (s >= 3600 ? (s / 3600).toFixed(1) + ' h' : Math.round(s / 60) + ' min');
        try {
          UG_PDF.exportDoc({
            title: 'Analytics Report',
            subtitle: 'Incident volume, response performance and verification quality.',
            kind: 'Analytics',
            generatedBy: (S.session ? S.session.name + ' · ' + (UG_WEB.ROLE_INFO[S.session.role] || {}).label : 'UniGuard'),
            scope: (S.session && S.session.role === 'barangay_official') ? 'Barangay ' + (S.session.barangay || '') : UG_GEO.PLACE.scope,
            meta: 'Date range: ' + (a.from || '') + ' to ' + (a.to || ''),
            filename: 'uniguard-analytics.pdf',
            tables: [
              { name: 'Incidents by hazard type', note: 'Number of reports filed per hazard type in the selected range.', head: ['Hazard type', 'Reports'], rows: hazardRows },
              { name: 'Incidents by status', note: 'Where reports in the range sit in the status pipeline right now.', head: ['Status', 'Reports'], rows: statusRows },
              { name: 'Response performance', note: 'Average time from report to dispatch, and report to resolution.', head: ['Measure', 'Average'], rows: [
                ['Report → Response Dispatched', fmtDur(a.avgDispatchSeconds)],
                ['Report → Resolved', fmtDur(a.avgResolveSeconds)],
                ['Auto-verified by corroboration', (a.corroborationRate || 0) + '% of reports']
              ] }
            ].filter((t) => t.rows.length)
          });
          toast('Analytics exported as PDF', 'info');
        } catch (err) { toast(err.message, 'warning'); }
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
        const res = await Repo.declareEmergency({
  title: 'Emergency declaration: municipality-wide response activated',
  body: 'The Municipal DRRMO has declared a municipality-wide emergency. Follow official instructions, move to the nearest open evacuation center if advised, and keep monitoring UniGuard advisories.'
});
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
      try {
        await Repo.markAllRead();
        try { UG_NOTIF_STORE.markAllReadLocal(); } catch (e) { }
        toast('All notifications marked as read', 'info');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'open-notification': async (d) => {
      try { await Repo.markRead(d.id); } catch (e) { }
      try { UG_NOTIF_STORE.markReadLocal(d.id); } catch (e) { }
      /* a notification may deep-link to one of several destinations depending on
         its type / FK; pick the right one so the citizen lands where they expect. */
      if (d.advisory) { S.openId = d.advisory; S.route = 'advisory-detail'; }
      else if (d.report) {
        S.openId = d.report;
        S.route = S.role === 'citizen' ? 'report-detail' : 'incident';
      }
      else if (d.roadWork) {
        S.openId = d.roadWork;
        S.route = 'roadwork';
      }
      else if (d.sos) {
        S.openId = d.sos;
        S.route = 'sos';
      }
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

    'retry-load': async () => {
      /* The old version called Repo.loadAll() directly, which silently caught
         auth/network errors and reseeded sample data — so the offline banner
         never cleared. forceReload() revives the session, flushes the queue,
         then reloads, and returns the actual reason it failed. */
      toast('Reconnecting and syncing the latest data...', 'info');
      const r = await Repo.forceReload();
      if (r && r.ok) {
        toast(Repo.state.source === 'supabase' ? 'Back online — live data synced' : 'Data refreshed', 'prepared');
      } else {
        const msg = (r && r.error) || 'Could not reconnect';
        if (r && r.reason === 'no-session') {
          toast('Your session expired. Signing you out so you can sign back in.', 'warning');
          setTimeout(() => { try { AUTH_ACTIONS.logout(); } catch (e) {} }, 1200);
        } else {
          toast(msg, 'warning');
        }
      }
      render();
    },

    /* dashboard "Refresh data" button — same as retry-load but with a
       friendlier toast for the success case. */
    'refresh-data': async () => {
      const r = await Repo.forceReload();
      if (r && r.ok && Repo.state.source === 'supabase') {
        toast('Data synced with the server', 'prepared');
      } else if (r && r.ok) {
        toast('Refreshed from the local cache', 'info');
      } else {
        toast((r && r.error) || 'Could not refresh right now', 'warning');
      }
      render();
    },

    'force-refresh': async () => {
      toast('Clearing the offline cache and reloading the newest build...', 'info');
      await UG_PWA.forceRefresh();
    },

    'enable-push': async () => {
      try {
        await UG_PWA.enablePush();
        toast('This device will receive emergency alerts', 'prepared');
        /* refresh the subscribed-devices count so the advisory composer's
           reach indicator flips from "no devices" to "1 device" immediately,
           instead of waiting for the next loadAll(). */
        try {
          UG.DATA.subscribedDevices = await Repo.subscribedDeviceCount();
        } catch (e) { /* count is best-effort */ }
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'sync-now': async () => {
      /* Old version only flushed the queue; it never reloaded the data, so the
         dashboard kept showing stale rows even after the queued reports
         uploaded. Now flush + reload together. */
      let n = 0;
      try { n = await UG_PWA.flushQueue(); } catch (e) { n = 0; }
      if (n) {
        toast(n + ' queued report' + (n > 1 ? 's' : '') + ' uploaded — syncing the latest data...', 'prepared');
        try { await Repo.loadAll(); } catch (e) {}
      } else {
        toast('Nothing waiting to upload — refreshing from the server', 'info');
        try { await Repo.loadAll(); } catch (e) {}
      }
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

      let list = S.barangays || [];
      if (!list.length) { list = await Repo.listBarangays(); S.barangays = list; }
      const opts = list.map((b) =>
        '<option value="' + UG_UTIL.esc(b.id) + '">' + UG_UTIL.esc(b.name) + '</option>').join('');

      UG_FEATURES.modal({
        title: 'Create a barangay official',
        body:
          '<div class="ug-field"><label class="ug-lab">Full name</label>' +
          '<input class="ug-in" type="text" data-invite-name placeholder="Juan Dela Cruz" autocomplete="off"></div>' +
          '<div class="ug-field"><label class="ug-lab">Email address</label>' +
          '<input class="ug-in" type="email" data-invite-email placeholder="official@lingayen.gov.ph"></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Barangay</label>' +
          '<select class="ug-sel" data-invite-brgy><option value="">Select a barangay</option>' + opts + '</select>' +
          '<div class="ug-help">This official will only see and manage reports from this barangay.</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-send>Send Invitation</button>',
        onMount: (wrap, close) => {
          const nameEl = wrap.querySelector('[data-invite-name]');
          const emailEl = wrap.querySelector('[data-invite-email]');
          const brgyEl = wrap.querySelector('[data-invite-brgy]');
          const sendBtn = wrap.querySelector('[data-send]');
          setTimeout(() => nameEl.focus(), 30);

          sendBtn.addEventListener('click', async () => {
            const fullName = nameEl.value.trim();
            const email = emailEl.value.trim();
            const barangayId = brgyEl.value;
            if (!fullName) { toast('Enter the official\'s full name', 'warning'); return; }
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter a valid email address', 'warning'); return; }
            if (!barangayId) { toast('Select the barangay this official will manage', 'warning'); return; }

            sendBtn.disabled = true;
            try {
              await Repo.adminUsers('create', { email: email, fullName: fullName, role: 'barangay_official', barangayId: barangayId })
              close();
              const name = (list.find((b) => String(b.id) === String(barangayId)) || {}).name || '';
              toast('Invitation sent to ' + email + ' for ' + name, 'prepared');
              S.users = await Repo.listUsers(); UG.DATA.users = S.users;
              render();
            } catch (e) {
              sendBtn.disabled = false;
              toast(e.message, 'warning');
            }
          });
        }
      });
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

    /* ----------------------------------------------- dispatch unit CRUD (LGU)
     * The "New unit" button on the Dispatch Units screen opens a modal that
     * creates the dispatch_units row (create_dispatch_unit RPC) AND invites
     * the first unit_admin through the admin-users edge function in one go.
     * Without the admin email the unit exists but no one can sign in to
     * manage it.
     */
    'admin-create-unit': async () => {
      if (!requireRole(['lgu_ldrrmc'])) { toast('Only the LGU can create dispatch units', 'warning'); return; }
      const esc = UG_UTIL.esc;
      const typeOpts = ['BFP', 'PNP', 'Rescue', 'Hospital']
        .map((t) => '<option value="' + t + '">' + t + '</option>').join('');

      UG_FEATURES.modal({
        title: 'Create a dispatch unit',
        body:
          '<div class="ug-field"><label class="ug-lab">Unit name</label>' +
            '<input class="ug-in" type="text" data-u-name placeholder="e.g. Lingayen BFP" autocomplete="off"></div>' +
          '<div class="ug-field"><label class="ug-lab">Unit type</label>' +
            '<select class="ug-sel" data-u-type>' + typeOpts + '</select>' +
            '<div class="ug-help">BFP = fire, PNP = police, Rescue = search and rescue, Hospital = ambulance + ER/ICU capacity.</div></div>' +
          '<div class="ug-field"><label class="ug-lab">Contact number</label>' +
            '<input class="ug-in" type="text" data-u-contact placeholder="(075) 632-2333"></div>' +
          '<div class="ug-field"><label class="ug-lab">Address</label>' +
            '<input class="ug-in" type="text" data-u-address placeholder="Poblacion, Lingayen"></div>' +
          '<div class="ug-field"><label class="ug-lab">First unit admin email</label>' +
            '<input class="ug-in" type="email" data-u-email placeholder="bfp.admin@lingayen.gov.ph">' +
            '<div class="ug-help">This person receives the invitation email, sets a password, then signs in to manage the unit. They can invite further members themselves.</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-u-save>Create unit + invite admin</button>',
        onMount: (wrap, close) => {
          const nameEl = wrap.querySelector('[data-u-name]');
          const typeEl = wrap.querySelector('[data-u-type]');
          const contactEl = wrap.querySelector('[data-u-contact]');
          const addressEl = wrap.querySelector('[data-u-address]');
          const emailEl = wrap.querySelector('[data-u-email]');
          const saveBtn = wrap.querySelector('[data-u-save]');
          setTimeout(() => nameEl.focus(), 30);

          saveBtn.addEventListener('click', async () => {
            const name = nameEl.value.trim();
            const type = typeEl.value;
            const contact = contactEl.value.trim();
            const address = addressEl.value.trim();
            const email = emailEl.value.trim();
            if (!name) { toast('Enter a unit name', 'warning'); return; }
            if (!type) { toast('Pick a unit type', 'warning'); return; }
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter a valid email for the first unit admin', 'warning'); return; }

            saveBtn.disabled = true;
            try {
              /* 1. create the dispatch_units row */
              const c = Repo.client();
              const { data: unitData, error: unitErr } = await c.rpc('create_dispatch_unit', {
                p_name: name, p_unit_type: type, p_contact_number: contact,
                p_address: address, p_lat: null, p_lng: null
              });
              if (unitErr) throw new Error(unitErr.message);
              const unitId = (unitData && unitData.id) || unitData;

              /* 2. invite the first unit_admin into the new unit */
              await Repo.adminUsers('create', {
                email: email, role: 'dispatch_team',
                unitId: unitId, unitRole: 'unit_admin'
              });

              toast('Unit "' + name + '" created. Invitation sent to ' + email, 'prepared');
              /* refresh the directory so the new unit appears in the list */
              try { await Repo.loadDispatchDirectory(); } catch (e) {}
              close();
              render();
            } catch (e) {
              saveBtn.disabled = false;
              toast(e.message || 'Could not create the unit', 'warning');
            }
          });
        }
      });
    },

    /* ----------------------------------------- edit a dispatch unit (LGU / unit_admin) */
    'admin-edit-unit': async (d) => {
      const unit = (UG.DATA.dispatchUnits || []).find((u) => u.id === d.id);
      if (!unit) { toast('That unit no longer exists', 'warning'); return; }
      const esc = UG_UTIL.esc;
      UG_FEATURES.modal({
        title: 'Edit unit · ' + unit.name,
        body:
          '<div class="ug-field"><label class="ug-lab">Unit name</label>' +
            '<input class="ug-in" type="text" data-eu-name value="' + esc(unit.name || '') + '"></div>' +
          '<div class="ug-field"><label class="ug-lab">Contact number</label>' +
            '<input class="ug-in" type="text" data-eu-contact value="' + esc(unit.contact_number || '') + '"></div>' +
          '<div class="ug-field"><label class="ug-lab">Address</label>' +
            '<input class="ug-in" type="text" data-eu-address value="' + esc(unit.address || '') + '"></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Active</label>' +
            '<select class="ug-sel" data-eu-active><option value="true"' + (unit.active ? ' selected' : '') + '>Active</option>' +
              '<option value="false"' + (!unit.active ? ' selected' : '') + '>Inactive</option></select>' +
            '<div class="ug-help">An inactive unit cannot be dispatched to.</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-eu-save>Save</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-eu-save]').addEventListener('click', async () => {
            const patch = {
              p_unit_id: unit.id,
              p_name: wrap.querySelector('[data-eu-name]').value.trim() || null,
              p_contact_number: wrap.querySelector('[data-eu-contact]').value.trim() || null,
              p_address: wrap.querySelector('[data-eu-address]').value.trim() || null,
              p_active: wrap.querySelector('[data-eu-active]').value === 'true'
            };
            try {
              const c = Repo.client();
              const { error } = await c.rpc('update_dispatch_unit', patch);
              if (error) throw new Error(error.message);
              toast('Unit updated', 'prepared');
              try { await Repo.loadDispatchDirectory(); } catch (e) {}
              close(); render();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    /* --------------------------------------- invite a member into a unit (unit_admin / LGU) */
    'admin-invite-unit-member': async (d) => {
      const unitId = d.unitId || (UG.DATA.dispatchUnits && UG.DATA.dispatchUnits[0] && UG.DATA.dispatchUnits[0].id);
      if (!unitId) { toast('No unit to invite into', 'warning'); return; }
      UG_FEATURES.modal({
        title: 'Invite a unit member',
        body:
          '<div class="ug-field"><label class="ug-lab">Email address</label>' +
            '<input class="ug-in" type="email" data-iv-email placeholder="member@lingayen.gov.ph">' +
            '<div class="ug-help">The new member receives an invitation email and joins this unit as a member (not admin).</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-iv-send>Send invitation</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-iv-send]').addEventListener('click', async () => {
            const email = wrap.querySelector('[data-iv-email]').value.trim();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter a valid email', 'warning'); return; }
            try {
              await Repo.adminUsers('unit-invite', { unitId: unitId, email: email });
              toast('Invitation sent to ' + email, 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    /* ----------------------------------------------- LGU decides a support request */
    'admin-decide-request': async (d) => {
      try {
        const c = Repo.client();
        const { error } = await c.rpc('decide_unit_request', {
          p_request_id: d.id, p_decision: d.decision, p_note: ''
        });
        if (error) throw new Error(error.message);
        toast('Request ' + d.decision, 'prepared');
        try { await Repo.loadDispatchDirectory(); } catch (e) {}
        render();
      } catch (e) { toast(e.message, 'warning'); }
    },

    /* ---------------------- barangay official toggles a responder's duty status */
    'admin-responders-toggle': async (d) => {
      try {
        /* Responders do not have a dedicated RPC; the official updates the row
           directly through RLS (responders_write policy, scoped to their
           barangay). */
        const c = Repo.client();
        if (!c) { toast('Connect to the server to update the roster', 'warning'); return; }
        const { error } = await c.from('responders').update({ status: d.next })
          .eq('id', d.id);
        if (error) throw new Error(error.message);
        toast('Responder status updated', 'prepared');
        S.responders = await Repo.listResponders(); UG.DATA.responders = S.responders;
        render();
      } catch (e) { toast(e.message, 'warning'); }
    },

    'admin-export-users': () => {
      const rows = (S.users || []).map((u) => [
        u.full_name || '', u.email || '',
        (UG_ADMIN.ROLE_LABEL[u.role] || u.role || ''),
        u.barangay || '',
        u.disabled ? 'disabled' : 'active',
        UG_UTIL.absTime(u.created_at) || ''
      ]);
      if (!rows.length) { toast('Nothing to export', 'info'); return; }
      try {
        UG_PDF.exportDoc({
          title: 'User Accounts',
          subtitle: 'Every account, its role and barangay assignment.',
          kind: 'User export',
          generatedBy: (S.session ? S.session.name + ' · ' + (UG_WEB.ROLE_INFO[S.session.role] || {}).label : 'UniGuard'),
          scope: UG_GEO.PLACE.scope,
          filename: 'uniguard-users.pdf',
          tables: [{ name: 'Accounts', note: 'Roles are enforced by row level security; this list mirrors the console.', head: ['Name', 'Email', 'Role', 'Barangay', 'Status', 'Created'], rows: rows }]
        });
        toast('User list exported as PDF', 'info');
      } catch (e) { toast(e.message, 'warning'); }
    },

    'admin-export-audit': () => {
      const rows = (S.audit || []).map((a) => [
        UG_UTIL.absTime(a.created_at) || '',
        a.actor_name || (a.actor_id ? String(a.actor_id).slice(0, 8) : 'system'),
        a.action || '', a.entity || '', a.entity_id || '',
        JSON.stringify(a.meta || {}).slice(0, 160)
      ]);
      if (!rows.length) { toast('Nothing to export', 'info'); return; }
      try {
        UG_PDF.exportDoc({
          title: 'Audit Log',
          subtitle: 'Every privileged action, newest first.',
          kind: 'Audit export',
          landscape: true,
          generatedBy: (S.session ? S.session.name + ' · ' + (UG_WEB.ROLE_INFO[S.session.role] || {}).label : 'UniGuard'),
          scope: UG_GEO.PLACE.scope,
          filename: 'uniguard-audit-log.pdf',
          tables: [{ name: 'Audit entries', note: 'Actor, action, entity and the change details recorded at write time.', head: ['When', 'Actor', 'Action', 'Entity', 'Entity id', 'Detail'], rows: rows }]
        });
        toast('Audit log exported as PDF', 'info');
      } catch (e) { toast(e.message, 'warning'); }
    },

    'open-audit': (d) => {
      const a = (S.audit || []).find((x) => x.id === d.id);
      if (!a) return;
      const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + UG_UTIL.esc(k) + '</span><span style="text-align:right;max-width:60%">' + UG_UTIL.esc(v) + '</span></div>';
      let changed = '';
      try {
        const m = a.meta || {};
        if (m.changed) {
          changed = Object.keys(m.changed).map((k) =>
            '<div style="font-size:11.5px;padding:6px 0;border-bottom:1px solid var(--ug-line)"><b>' + UG_UTIL.esc(k) + '</b>: ' +
            UG_UTIL.esc(String(m.changed[k].from)) + ' → ' + UG_UTIL.esc(String(m.changed[k].to)) + '</div>').join('');
        }
      } catch (e) { changed = ''; }
      UG_FEATURES.modal({
        title: 'Audit entry',
        body:
          kv('When', UG_UTIL.absTime(a.created_at) || '') +
          kv('Actor', a.actor_name || (a.actor_id ? String(a.actor_id).slice(0, 8) : 'system')) +
          kv('Action', a.action || '') +
          kv('Entity', a.entity || '') +
          kv('Entity id', a.entity_id || '') +
          (changed ? '<div style="margin-top:10px"><div class="ug-lab">Changed</div>' + changed + '</div>' : '') +
          (a.meta && !changed ? '<div style="margin-top:10px"><div class="ug-lab">Detail</div><pre class="ug-note" style="white-space:pre-wrap">' + UG_UTIL.esc(JSON.stringify(a.meta, null, 2)) + '</pre></div>' : ''),
        footer: '<button class="ug-btn" data-modal-close>Close</button>'
      });
    },

    'sos-ack': async (d) => {
      try { await Repo.updateSosStatus(d.id, 'acknowledged'); toast('SOS acknowledged — the sender has been notified', 'prepared'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'sos-resolve': async (d) => {
      try { await Repo.updateSosStatus(d.id, 'resolved'); toast('SOS marked resolved', 'prepared'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    /* Priority Sort: toggles the incident queue between newest-first and
       severity → corroboration → recency. */
    'sort-toggle': () => {
      S.incidentSort = (S.incidentSort === 'priority') ? 'default' : 'priority';
      render();
    },

    'shelter-scope': (d) => { S.shelterScope = d.v || 'all'; render(); },

    /* analytics date range: date inputs land in S via the change handler */
    'an-apply': async () => {
      render();
      try {
        const a = await Repo.analytics(S.anFrom || null, S.anTo || null);
        UG.DATA.analytics = Object.assign({ live: true }, a);
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    /* ------------------------------------------ edit an incident (officials) */
    'edit-report': async (d) => {
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (!inc) return;
      const hazardOpts = UG.DATA.hazards.map((h) => '<option value="' + UG_UTIL.esc(h) + '"' + (h === inc.hazard_type ? ' selected' : '') + '>' + UG_UTIL.esc(h) + '</option>').join('');
      const sevOpts = ['advisory', 'warning', 'emergency'].map((sv) => '<option value="' + sv + '"' + (sv === inc.sev ? ' selected' : '') + '>' + UG_UTIL.esc(UG_THEME.sev(sv).label) + '</option>').join('');
      UG_FEATURES.modal({
        title: 'Edit incident ' + inc.id,
        body:
          '<div class="ug-field"><label class="ug-lab">Hazard type</label><select class="ug-sel" data-er-hazard>' + hazardOpts + '</select></div>' +
          '<div class="ug-field"><label class="ug-lab">Severity</label><select class="ug-sel" data-er-sev>' + sevOpts + '</select></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Description</label>' +
          '<textarea class="ug-ta" rows="4" data-er-desc>' + UG_UTIL.esc(inc.desc || '') + '</textarea>' +
          '<div class="ug-help">Status, barangay and reporter identity are workflow-managed and cannot be edited here. Every change is written to the audit log.</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Save changes</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const patch = {
              hazard_type: wrap.querySelector('[data-er-hazard]').value,
              severity: wrap.querySelector('[data-er-sev]').value,
              description: wrap.querySelector('[data-er-desc]').value.trim()
            };
            if (!patch.description) { toast('The description cannot be empty', 'warning'); return; }
            try {
              await Repo.updateReport(inc.uuid || inc.id, patch);
              toast('Incident updated and logged to the audit trail', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
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
    },

    /* -------------------------------------------- relief / guides / faqs / roadwork / sos */
    'relief-filter': (d) => { S.reliefFilter = d.v; render(); },
    'relief-verify': (d) => { S.openId = d.id; S.route = 'relief-verify'; render(); },
    'report-status-filter': (d) => { S.reportStatusFilter = d.v; render(); },

    /* Download the authorized-beneficiary list or the relief schedule list as a
       CSV file. Exports exactly the rows the duty officer sees after the barangay
       filter + search, so a printed copy matches the screen. */
    'relief-download': (d) => {
      const what = (d && d.what) || 'beneficiaries';
      const csvCell = (v) => {
        const s = String(v == null ? '' : v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? '"' + s + '"' : s;
      };
      const stamp = new Date().toISOString().slice(0, 10);
      if (what === 'distributions') {
        const mine = (S.session && S.session.role === 'barangay_official') ? S.session.barangay : null;
        const rows = (UG.DATA.relief || []).filter((r) => !mine || r.barangay === mine);
        const header = ['ID', 'Barangay', 'Title', 'Location', 'Address', 'Schedule', 'Contact person', 'Contact phone', 'Eligibility', 'Required docs', 'Active'];
        const body = rows.map((r) => [
          r.id, r.barangay, r.title, r.location_name, r.address,
          r.distribution_at ? new Date(r.distribution_at).toLocaleString() : '',
          r.contact_person, r.contact_phone,
          (r.eligibility || []).join('; '), (r.required_docs || []).join('; '),
          r.active === false ? 'No' : 'Yes'
        ].map(csvCell).join(','));
        const csv = header.map(csvCell).join(',') + '\n' + body.join('\n');
        downloadText('uniguard-relief-schedules-' + stamp + '.csv', csv);
        toast(rows.length + ' distribution(s) exported to CSV', 'prepared');
        return;
      }
      /* default: beneficiaries */
      const mine = (S.session && S.session.role === 'barangay_official') ? S.session.barangay : null;
      const benFilter = mine || S.benBarangayFilter;
      const qStr = (S.benSearchLgu || '').toLowerCase().trim();
      const rows = (UG.DATA.beneficiaries || [])
        .filter((b) => !mine || b.barangay === mine)
        .filter((b) => (!benFilter || benFilter === 'All' || b.barangay === benFilter))
        .filter((b) => !qStr ||
          (b.beneficiary_name || '').toLowerCase().indexOf(qStr) >= 0 ||
          (b.claimant_name || '').toLowerCase().indexOf(qStr) >= 0 ||
          (b.claimant_id || '').toLowerCase().indexOf(qStr) >= 0);
      const header = ['ID', 'Barangay', 'Beneficiary name', 'Claimant name', 'Claimant ID', 'Category'];
      const body = rows.map((b) => [b.id, b.barangay, b.beneficiary_name, b.claimant_name, b.claimant_id, b.category].map(csvCell).join(','));
      const csv = header.map(csvCell).join(',') + '\n' + body.join('\n');
      downloadText('uniguard-beneficiaries-' + stamp + '.csv', csv);
      toast(rows.length + ' beneficiary record(s) exported to CSV', 'prepared');
    },

    'relief-add': async () => {
      const fields = await UG_FEATURES.prompt({
        title: 'Add a relief distribution',
        label: 'Title', placeholder: 'e.g. Family Food Pack Distribution'
      });
      if (!fields) return;
      try {
        await Repo.createRelief({
          title: fields, barangay: myBrgyName(), active: true,
          eligibility: [], required_docs: []
        });
        toast('Relief distribution added', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },
    'relief-edit': async (d) => {
      const r = (UG.DATA.relief || []).find((x) => x.id === d.id);
      if (!r) return;
      const title = await UG_FEATURES.prompt({ title: 'Edit distribution', label: 'Title', value: r.title });
      if (title === null) return;
      try { await Repo.updateRelief(d.id, { title: title || r.title }); toast('Distribution updated', 'prepared'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },
    'beneficiary-add': async () => {
      const name = await UG_FEATURES.prompt({ title: 'Add authorized beneficiary', label: 'Beneficiary name', placeholder: 'Last, First' });
      if (!name) return;
      const claimant = await UG_FEATURES.prompt({ title: 'Claimant', label: 'Who will claim on their behalf?', placeholder: 'Same as beneficiary' });
      const claimantId = await UG_FEATURES.prompt({ title: 'Claimant ID', label: 'ID number', placeholder: 'ID-2026-000000' });
      try {
        await Repo.createBeneficiary({
          beneficiary_name: name, claimant_name: claimant || name,
          claimant_id: claimantId || '', barangay: myBrgyName(), category: 'Affected household'
        });
        toast('Beneficiary added', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },
    'beneficiary-del': async (d) => {
      try { await Repo.deleteBeneficiary(d.id); toast('Beneficiary removed', 'warning'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'guide-hazard': (d) => { S.guideHazard = d.v; render(); },
    'guide-phase': (d) => { S.guidePhase = d.v; render(); },
    'guide-open': (d) => { S.openId = d.id; S.route = 'guide-detail'; render(); },

    /* Download the preparedness guides as a PDF. Citizens get a printable
       copy of either the selected hazard (Before / During / After) or every
       guide in the system. Uses the existing UG_PDF engine so the document
       carries the UniGuard header, generated-by and page numbers. */
    'guide-download': (d) => {
      const hazard = (d && d.hazard) || 'all';
      const all = (UG.DATA.guides || []).slice();
      const scoped = hazard === 'all' ? all : all.filter((g) => g.hazard_type === hazard);
      if (!scoped.length) { toast('No guides to export yet', 'warning'); return; }
      /* group by hazard, then phase, so the PDF reads in a logical order */
      const order = ['before', 'during', 'after'];
      scoped.sort((a, b) =>
        (a.hazard_type < b.hazard_type ? -1 : a.hazard_type > b.hazard_type ? 1 : 0) ||
        (order.indexOf(a.phase) - order.indexOf(b.phase)));
      const phaseLabel = (p) => p === 'before' ? 'Before' : p === 'during' ? 'During' : 'After';
      const wrap = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
      const tables = scoped.map((g) => ({
        name: wrap(g.hazard_type) + ' · ' + phaseLabel(g.phase),
        note: wrap(g.title),
        head: ['Section', 'Instructions'],
        rows: [['Guide', wrap(g.body).slice(0, 1800)]
          /* keep the row readable; very long bodies wrap inside the cell */
        ]
      }));
      try {
        UG_PDF.exportDoc({
          kind: 'Preparedness Guide',
          title: hazard === 'all' ? 'Disaster Preparedness Guides' : (hazard + ' Preparedness Guide'),
          subtitle: 'What to do before, during and after a hazard in ' + UG_GEO.PLACE.label + '.',
          scope: UG_GEO.PLACE.label,
          generatedBy: (S.session && S.session.name) || 'UniGuard',
          filename: 'uniguard-guides-' + (hazard === 'all' ? 'all' : hazard.toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '.pdf',
          tables: tables
        });
        toast(scoped.length + ' guide' + (scoped.length === 1 ? '' : 's') + ' exported to PDF', 'prepared');
      } catch (e) { toast(e.message || 'Could not generate the PDF', 'warning'); }
    },

    /* one guide = title + hazard category + summary + Before/During/After + PDF.
       A real modal form replaces the old one-line prompt() dialog. */
    'guide-add': () => {
      if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can manage guides', 'warning'); return; }
      const hazardOpts = UG.DATA.hazards.map((h) => '<option>' + UG_UTIL.esc(h) + '</option>').join('');
      UG_FEATURES.modal({
        title: 'Add a preparedness guide',
        body:
          '<div class="ug-field"><label class="ug-lab">Title</label><input class="ug-in" data-g-title placeholder="e.g. Typhoon safety for coastal households"></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px"><div class="ug-field" style="flex:1"><label class="ug-lab">Hazard category</label><select class="ug-sel" data-g-hazard>' + hazardOpts + '</select></div></div>' +
          '<div class="ug-field"><label class="ug-lab">Brief summary</label><input class="ug-in" data-g-summary placeholder="One or two sentences shown in the list"></div>' +
          '<div class="ug-field"><label class="ug-lab">Before — what to do in advance</label><textarea class="ug-ta" rows="3" data-g-before></textarea></div>' +
          '<div class="ug-field"><label class="ug-lab">During — what to do while it happens</label><textarea class="ug-ta" rows="3" data-g-during></textarea></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">After — what to do to recover</label><textarea class="ug-ta" rows="3" data-g-after></textarea>' +
          '<div class="ug-help">Fill at least one section. Citizens see the guide as soon as you save.</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Publish guide</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const title = wrap.querySelector('[data-g-title]').value.trim();
            const before = wrap.querySelector('[data-g-before]').value.trim();
            const during = wrap.querySelector('[data-g-during]').value.trim();
            const after = wrap.querySelector('[data-g-after]').value.trim();
            if (!title) { toast('Give the guide a title', 'warning'); return; }
            if (!before && !during && !after) { toast('Fill at least one of the three sections', 'warning'); return; }
            try {
              await Repo.createGuide({
                hazard_type: wrap.querySelector('[data-g-hazard]').value,
                phase: 'all', title: title,
                summary: wrap.querySelector('[data-g-summary]').value.trim(),
                body: before || during || after,
                body_before: before, body_during: during, body_after: after
              });
              toast('Guide published', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    'guide-edit': async (d) => {
      const g = (UG.DATA.guides || []).find((x) => x.id === d.id);
      if (!g) return;
      UG_FEATURES.modal({
        title: 'Edit guide',
        body:
          '<div class="ug-field"><label class="ug-lab">Title</label><input class="ug-in" data-g-title value="' + UG_UTIL.esc(g.title) + '"></div>' +
          '<div class="ug-field"><label class="ug-lab">Brief summary</label><input class="ug-in" data-g-summary value="' + UG_UTIL.esc(g.summary || '') + '"></div>' +
          '<div class="ug-field"><label class="ug-lab">Before</label><textarea class="ug-ta" rows="3" data-g-before>' + UG_UTIL.esc(g.body_before || g.body || '') + '</textarea></div>' +
          '<div class="ug-field"><label class="ug-lab">During</label><textarea class="ug-ta" rows="3" data-g-during>' + UG_UTIL.esc(g.body_during || '') + '</textarea></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">After</label><textarea class="ug-ta" rows="3" data-g-after>' + UG_UTIL.esc(g.body_after || '') + '</textarea></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Save changes</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const before = wrap.querySelector('[data-g-before]').value.trim();
            const during = wrap.querySelector('[data-g-during]').value.trim();
            const after = wrap.querySelector('[data-g-after]').value.trim();
            try {
              await Repo.updateGuide(g.id, {
                title: wrap.querySelector('[data-g-title]').value.trim(),
                summary: wrap.querySelector('[data-g-summary]').value.trim(),
                body: before || during || after,
                body_before: before, body_during: during, body_after: after
              });
              toast('Guide updated', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    'guide-del': async (d) => {
      const ok = await UG_FEATURES.confirm({ title: 'Delete guide', message: 'Citizens will no longer see this guide.', danger: true, confirmLabel: 'Delete' });
      if (!ok) return;
      const c = Repo.client();
      try {
        if (c) { await c.from('preparedness_guides').delete().eq('id', d.id); }
        UG.DATA.guides = (UG.DATA.guides || []).filter((g) => g.id !== d.id);
        toast('Guide deleted', 'warning');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'faq-add': () => {
      if (!requireRole(['lgu_ldrrmc'])) { toast('Only LGU can manage FAQs', 'warning'); return; }
      UG_FEATURES.modal({
        title: 'Add an FAQ',
        body:
          '<div class="ug-field"><label class="ug-lab">Question</label><input class="ug-in" data-f-q placeholder="e.g. How do I update my address?"></div>' +
          '<div class="ug-field"><label class="ug-lab">Category</label><select class="ug-sel" data-f-cat>' +
            ['Reports', 'Relief', 'Evacuation', 'SOS', 'Roads', 'General'].map((c) => '<option>' + c + '</option>').join('') + '</select></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Answer</label>' +
          '<textarea class="ug-ta" rows="5" data-f-a placeholder="Write the full answer citizens will read."></textarea>' +
          '<div class="ug-help">Published FAQs appear in every resident\'s Help Center immediately.</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Publish FAQ</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const question = wrap.querySelector('[data-f-q]').value.trim();
            const answer = wrap.querySelector('[data-f-a]').value.trim();
            if (!question || !answer) { toast('A question and an answer are required', 'warning'); return; }
            try {
              await Repo.createFaq({ question: question, answer: answer, category: wrap.querySelector('[data-f-cat]').value, active: true });
              toast('FAQ published', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    'faq-edit': async (d) => {
      const f = (UG.DATA.faqs || []).find((x) => x.id === d.id);
      if (!f) return;
      UG_FEATURES.modal({
        title: 'Edit FAQ',
        body:
          '<div class="ug-field"><label class="ug-lab">Question</label><input class="ug-in" data-f-q value="' + UG_UTIL.esc(f.question) + '"></div>' +
          '<div class="ug-field"><label class="ug-lab">Category</label><select class="ug-sel" data-f-cat>' +
            ['Reports', 'Relief', 'Evacuation', 'SOS', 'Roads', 'General'].map((c) => '<option' + (c === f.category ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Answer</label>' +
          '<textarea class="ug-ta" rows="6" data-f-a>' + UG_UTIL.esc(f.answer || '') + '</textarea>' +
          '<div class="ug-help">The complete existing answer is loaded above — edit any part of it.</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Save changes</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const question = wrap.querySelector('[data-f-q]').value.trim();
            const answer = wrap.querySelector('[data-f-a]').value.trim();
            if (!question || !answer) { toast('A question and an answer are required', 'warning'); return; }
            try {
              await Repo.updateFaq(f.id, { question: question, answer: answer, category: wrap.querySelector('[data-f-cat]').value });
              toast('FAQ updated', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },
    'faq-del': async (d) => {
      const ok = await UG_FEATURES.confirm({ title: 'Delete FAQ', message: 'This FAQ will be removed for every resident.', danger: true, confirmLabel: 'Delete' });
      if (!ok) return;
      try { await Repo.deleteFaq(d.id); toast('FAQ deleted', 'warning'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    /* road work composer fields live in S.roadDraft; the input/change handlers
       below push field values into the draft so publish can read them off the
       state object directly. */
    'rw-publish': async () => {
      const d = S.roadDraft;
      if (!d.title.trim() || !d.description.trim()) { toast('Add a title and description before publishing', 'warning'); return; }
      const citywide = d.barangay === UG_GEO.PLACE.areaAll;
      const start = new Date().toISOString();
      const end = new Date(Date.now() + (parseFloat(d.expected_hours) || 6) * 3600000).toISOString();
      try {
        await Repo.createRoadWork({
          title: d.title.trim(), description: d.description.trim(),
          barangay: citywide ? '' : d.barangay, road_name: d.road_name || '',
          address: d.address || '', lat: d.lat || null, lng: d.lng || null,
          expected_start: start, expected_end: end, citywide: citywide
        });
        toast('Road work published and residents notified', 'prepared');
        S.roadDraft = { title: '', description: '', barangay: UG_GEO.PLACE.areaAll, road_name: '', address: '', lat: null, lng: null, expected_hours: 6, citywide: false };
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },
    'rw-clear': () => {
      S.roadDraft = { title: '', description: '', barangay: UG_GEO.PLACE.areaAll, road_name: '', address: '', lat: null, lng: null, expected_hours: 6, citywide: false };
      toast('Composer cleared', 'info');
      render();
    },
    'rw-locate': async () => {
      try {
        const pos = await UG_FEATURES.locate();
        S.roadDraft.lat = pos.lat; S.roadDraft.lng = pos.lng;
        toast('Location captured, accuracy ' + pos.accuracy + ' m', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },
    /* Road status: the full form (road, barangay, segment, status, cause,
       severity, timing, pin, note) replaces the old road-name-only prompt. */
    'rs-add': () => roadStatusForm(null),
    'rs-edit': (d) => {
      const r = (UG.DATA.roadStatus || []).find((x) => x.id === d.id);
      if (r) roadStatusForm(r);
    },
    'rs-pin': async () => {
      try {
        const pos = await UG_FEATURES.locate();
        const latEl = q('[data-rs-lat]'), lngEl = q('[data-rs-lng]');
        if (latEl) latEl.value = pos.lat;
        if (lngEl) lngEl.value = pos.lng;
        toast('Pin set to your current position', 'prepared');
      } catch (e) {
        toast(e.message + ' — you can also type coordinates from the map.', 'warning');
      }
    },
    /* rs-add / rs-edit open the full road-status form (roadStatusForm above) */
    'rs-del': async (d) => {
      const ok = await UG_FEATURES.confirm({ title: 'Remove road status', message: 'This entry will be removed from the map and the road status list.', confirmLabel: 'Remove' });
      if (!ok) return;
      try { await Repo.deleteRoadStatus(d.id); toast('Road status removed', 'warning'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    /* SOS — one tap sends GPS + profile to LGU/LDRRMO via the submit_sos RPC. */
    'sos-trigger': async () => {
      if (S.sosSending) return;
      if (!S.session) { toast('Sign in to send an SOS', 'warning'); return; }
      S.sosSending = true; S.route = 'sos'; render();
      let pos = null;
      try { pos = await UG_FEATURES.locate(); }
      catch (e) { toast('GPS unavailable: ' + e.message + ' — sending without coordinates', 'warning'); }
      try {
        const res = await Repo.submitSos({
          lat: pos ? pos.lat : null, lng: pos ? pos.lng : null, accuracy: pos ? pos.accuracy : null
        });
        S.lastSos = {
          id: res && res.id ? res.id : ('PENDING-' + Date.now()),
          lat: pos ? pos.lat : null, lng: pos ? pos.lng : null,
          accuracy: pos ? pos.accuracy : null,
          reach: res && typeof res.reach === 'number' ? res.reach : null,
          at: new Date().toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
        };
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) { }
        toast('SOS sent. Duty officers have been notified.', 'emergency');
      } catch (e) {
        toast(e.message || 'Could not send SOS', 'warning');
      }
      S.sosSending = false;
      render();
    },

    'map-layer-toggle': (d) => {
      const k = d.layer;
      if (!k || !(k in S.mapLayers)) return;
      S.mapLayers[k] = !S.mapLayers[k];
      /* updated in place: a full render() would rebuild the map and lose the view */
      MapView.setLayers(S.mapLayers);
      document.querySelectorAll('[data-act="map-layer-toggle"][data-layer="' + k + '"]').forEach((b) => {
        b.classList.toggle('is-on', S.mapLayers[k]);
        b.setAttribute('aria-pressed', String(S.mapLayers[k]));
      });
    },

    'map-layers-panel': (d, el) => {
      S.mapPanelOpen = !S.mapPanelOpen;
      el.classList.toggle('is-on', S.mapPanelOpen);
      el.setAttribute('aria-expanded', String(S.mapPanelOpen));
      const panel = q('[data-map="live"] .ug-layer-toggle');
      if (panel) panel.hidden = !S.mapPanelOpen;
    },

    'urgent-dismiss': (d) => { UG_URGENT.dismiss(d.id || ''); },
    'urgent-view': (d) => {
      UG_URGENT.dismiss(d.id || '');
      if (d.id) {
        const a = (UG.DATA.advisories || []).find((x) => x.id === d.id);
        if (a) { S.openId = a.id; S.route = 'advisory-detail'; render(); }
      }
    }
  };

  const ALL = Object.assign({},
    AUTH_ACTIONS,
    APP_ACTIONS,
    /* Dispatch team module actions. The module is loaded before app.js in
       index.html, so UG_DISPATCH.actions is available here. */
    (typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.actions) ? UG_DISPATCH.actions : {}
  );

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
    /* new search/filter inputs update state but don't trigger a full re-render
       on every keystroke (the screen reads the state directly when its own
       filter chips are pressed; the search box itself re-renders only its own
       filter view). */
    if (f === 'benSearch') { S.benSearch = v; render(f); return; }
    if (f === 'benSearchLgu') { S.benSearchLgu = v; render(f); return; }
    if (f === 'faqSearch') { S.faqSearch = v; render(f); return; }
    if (f === 'reportAddress') { S.report.locationNote = v; return; }
    /* road work composer fields */
    if (f === 'rwTitle') { S.roadDraft.title = v; return; }
    if (f === 'rwDescription') { S.roadDraft.description = v; return; }
    if (f === 'rwRoad') { S.roadDraft.road_name = v; return; }
    if (f === 'rwLat') { S.roadDraft.lat = parseFloat(v); return; }
    if (f === 'rwLng') { S.roadDraft.lng = parseFloat(v); return; }
    if (f === 'rwHours') { S.roadDraft.expected_hours = parseFloat(v); return; }
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
    else if (f === 'anFrom') { S.anFrom = v; return; }
    else if (f === 'anTo') { S.anTo = v; return; }
    else if (f === 'hazard') S.report.hazard = v;
    else if (f === 'brgy') S.report.brgy = v;
    else if (f === 'rwBarangay') { S.roadDraft.barangay = v; render(); return; }
    else if (f === 'benBarangayFilter') { S.benBarangayFilter = v; render(); return; }
    else if (f === 'incBrgyFilter') { S.incBrgyFilter = v; render(); return; }
    else if (f === 'assignResponder') return;
    else return;
    render();
  });

  /* Barangay combo — search filtering. The existing input listener only acts
     on [data-field], so the search input (which uses data-act instead) needs
     its own handler. */
  root.addEventListener('input', (e) => {
    const search = e.target.closest('[data-act="search-barangay"]');
    if (!search) return;
    const combo = search.closest('.ug-combo');
    if (!combo) return;
    filterBarangayCombo(combo, search.value || '');
  });

  /* Click outside any open combo closes it. Fires after the [data-act] click
     handler, which already returned without preventing default for clicks
     that are not on a ug-combo-option. Also closes the citizen "More" panel. */
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.ug-combo')) return;
    closeAllBarangayCombos();
    if (e.target.closest && !e.target.closest('.ug-wmore')) {
      document.querySelectorAll('[data-more-panel]').forEach((p) => { p.hidden = true; });
    }
  });

  /* The panel is anchored to its trigger via position:absolute, so scrolling
     the page would leave the panel in a stale position. Closing on page
     scroll keeps the experience clean. Scrolling INSIDE the panel (the
     barangay list itself) is allowed and does not close the combo. */
  let comboJustOpened = 0;
  window.addEventListener('scroll', (e) => {
    if (e.target && e.target.closest && e.target.closest('.ug-combo-panel')) return;
    /* Ignore scroll events that happen within 250ms of opening, which can
       be triggered by focus() on the search input even with preventScroll. */
    if (Date.now() - comboJustOpened < 250) return;
    closeAllBarangayCombos();
  }, { capture: true, passive: true });

  /* Keyboard navigation inside the open dropdown: ArrowUp / ArrowDown move
     the highlight, Enter selects, Escape closes. Tab falls through to the
     browser so users can leave the field. Captured in capture phase so it
     fires before the Enter-submits-form handler below, which would otherwise
     submit the auth form whenever the user pressed Enter on the search box. */
  root.addEventListener('keydown', (e) => {
    const search = e.target.closest('[data-act="search-barangay"]');
    if (!search) return;
    const combo = search.closest('.ug-combo');
    if (!combo) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        closeAllBarangayCombos();
        const btn = combo.querySelector('.ug-combo-btn');
        if (btn) btn.focus();
        return;
      }
      if (e.key === 'Enter') {
        const active = combo.querySelector('.ug-combo-option.is-active');
        if (active) AUTH_ACTIONS['select-barangay'](active.dataset, active);
        return;
      }
      const items = visibleComboOptions(combo);
      if (!items.length) return;
      let idx = activeComboIndex(combo);
      if (e.key === 'ArrowDown') idx = idx < 0 ? 0 : Math.min(idx + 1, items.length - 1);
      else idx = idx <= 0 ? 0 : idx - 1;
      setActiveComboOption(combo, items[idx], true);
    }
  }, true);

  /* Enter submits the account forms — but not when the focus is on the
     barangay search input (handled above) or on a non-submit button inside
     the form. */
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const form = e.target.closest('[data-form="auth"]');
    if (!form) return;
    if (e.target.tagName === 'TEXTAREA') return;
    /* The combo trigger is type="button", so pressing Enter on it should
       toggle the panel, not submit the form. preventDefault stops the
       browser's own click activation; we then toggle manually. */
    const comboBtn = e.target.closest('.ug-combo-btn');
    if (comboBtn) {
      e.preventDefault();
      AUTH_ACTIONS['toggle-barangay-combo'](comboBtn.dataset, comboBtn);
      return;
    }
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

  /* the urgent alert overlay (appended to <body>, outside #ug-root) asks the
     app to navigate to the emergency advisory when a citizen taps "View". */
  document.addEventListener('ug:urgent-view', (e) => {
    const id = e.detail && e.detail.id;
    if (!id) return;
    APP_ACTIONS['urgent-view']({ id: id });
  });

  /* DEV preview controls */
  if (devBar) {
    devBar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.off) APP_ACTIONS['toggle-offline']();
      else if (b.dataset.signout) AUTH_ACTIONS.logout();
      else if (b.dataset.reset) { S.route = homeRoute(); S.openId = null; S.sevFilter = 'all'; S.incBrgyFilter = 'All'; S.centerFilter = 'all'; render(); }
    });
  }

  window.addEventListener('resize', UG_UTIL.debounce(() => {
    /* Closing open combos on resize keeps the dropdown anchored to its
       trigger instead of floating in a stale position. */
    closeAllBarangayCombos();
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
      const lastError = Repo.state.lastError || '';
      const lastSync = Repo.state.lastSync ? UG_UTIL.absTime(Repo.state.lastSync) : '';
      if (off) {
        strip.className = 'ug-banner-strip is-offline';
        const msg = lastError ? lastError : 'Offline. Showing the last synced hotlines, shelters and advisories';
        strip.innerHTML = UG.icon('wifioff', 14) +
          '<span>' + UG_UTIL.esc(msg) +
          (queued ? ' · ' + queued + ' report' + (queued > 1 ? 's' : '') + ' waiting to upload' : '') +
          (lastSync ? ' · last sync ' + UG_UTIL.esc(lastSync) : '') + '.</span>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto" data-act="retry-load">' + UG.icon('wave', 13) + 'Retry</button>';
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

  window.UG_App = {
    S: S, render: render, toast: toast, actions: ALL,
    /* small handle used by the dispatch module to drive navigation and
       re-render without reaching into app.js private state */
    go: function (route) { try { go(route); } catch (e) {} }
  };
  boot();
})();
