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
  const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);

  /* Supabase email links (sign-up confirmation, invite, magic link, recovery)
     come back with their result in the URL. Read it now, before supabase-js
     consumes the hash: 'confirmed', 'error' (expired / used link) or 'recovery'. */
  const EMAIL_LINK = (function () {
    try {
      const raw = String(location.hash || '').replace(/^#\/?/, '') + '&' + String(location.search || '').replace(/^\?/, '');
      if (!/(^|&)(type|access_token|code|error|error_code|error_description)=/.test(raw)) return null;
      const p = new URLSearchParams(raw);
      const type = p.get('type') || '';
      if (type === 'recovery') return { kind: 'recovery' };
      if (p.get('error') || p.get('error_code') || p.get('error_description')) {
        return { kind: 'error', code: p.get('error_code') || p.get('error') || '' };
      }
      if (/^(signup|email|invite|magiclink)$/.test(type) || p.get('access_token') || p.get('code')) {
        return { kind: 'confirmed', type: type };
      }
    } catch (e) { }
    return null;
  })();

  const blankAuth = () => ({
    screen: 'signin',
    form: { email: '', password: '', lastName: '', firstName: '', phone: '', barangay_id: '', confirm: '' },
    error: '', notice: '', loading: false, showPassword: false, consent: false,
    pendingEmail: '', barangays: [], phoneError: ''
  });

  const S = {
    screen: 'auth',
    auth: blankAuth(),
    session: null,
    role: 'citizen', view: 'mobile', route: 'home', openId: null,
    offline: false, sevFilter: 'all', incBrgyFilter: 'All', incHazardFilter: 'All', centerFilter: 'all', readNotifs: false,
    corr: {}, declareArmed: false, loading: false, error: null, syncNote: '',
    barangays: [], users: [], audit: [], responders: [],
    /* activity log filters (module H) */
    auditQ: '', auditEntity: 'All', auditActor: 'All', auditFrom: '', auditTo: '',
    /* incident queue sort: 'default' (newest first) or 'priority' (severity,
       then corroboration count, then recency) */
    incidentSort: 'default',
    /* analytics date range (ISO yyyy-mm-dd) */
    anFrom: '', anTo: '',
    /* analytics barangay filter (LGU only) */
    anBrgyFilter: 'All',
    /* shelters: 'all' (default) or 'mine' */
    shelterScope: 'all',
    /* new slices for the integrated features */
    reliefFilter: 'All', benSearch: '', benSearchLgu: '', benBarangayFilter: 'All',
    /* inventory search box (module E) + LGU barangay filter on the
       inventory tab (barangay_official is locked to their own barangay) */
    invSearch: '', invBrgyFilter: 'All',
    /* search boxes for other admin modules (dispatch units, users, shelters, road status) */
    unitSearch: '', userSearch: '', shelterSearch: '', rsSearch: '',
    /* audit log filters: extra fields for the enhanced Activity Log */
    auditRole: 'All', auditAction: 'All', auditBarangay: 'All',
    auditPage: 1, auditPageSize: 25,
    guideHazard: UG_HAZARDS.LIST[0].label, guidePhase: 'before',
    faqSearch: '',
    reportStatusFilter: 'all',
    roadDraft: { title: '', description: '', barangay: UG_GEO.PLACE.areaAll, road_name: '', address: '', lat: null, lng: null, expected_hours: 6, citywide: false },
    sosSending: false, lastSos: null,
    mapLayers: { hazards: true, relief: true, centers: true, roadStatus: true },
    mapPanelOpen: false,
    draft: { title: '', sev: 'warning', type: 'Emergency', area: UG_GEO.PLACE.areaAll, msg: '', lang: 'en', alertType: 'general', deliveryMode: 'push' },
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
    /* an Error object, or a raw server / browser message, never reaches the
       screen as-is: log it, show plain language. Our own sentences pass. */
    if ((msg && typeof msg === 'object') || UG_UTIL.looksTechnical(msg)) {
      console.error('[UniGuard]', msg);
      msg = UG_UTIL.friendlyError(msg);
    }
    if (!toasts) return;
    msg = String(msg == null ? '' : msg);
    const live = Array.prototype.filter.call(toasts.children, (x) => !x.__leaving);
    /* the same message again: refresh its timer and count it, don't stack */
    const same = live.find((x) => x.__msg === msg);
    if (same) {
      same.__count = (same.__count || 1) + 1;
      const n = same.querySelector('.ug-toast-count');
      if (n) n.textContent = '\u00d7' + same.__count;
      armToast(same);
      return;
    }
    /* at most three on screen; the oldest goes first */
    while (live.length >= 3) dismissToast(live.shift());
    const el = document.createElement('div');
    el.className = 'ug-toast ug-toast--' + tone;
    el.__msg = msg;
    const ic = tone === 'emergency' ? 'alert' : tone === 'prepared' ? 'check' : tone === 'warning' ? 'clock' : 'info';
    el.innerHTML = UG.icon(ic, 16) + '<span>' + UG_UTIL.esc(msg) + '</span><span class="ug-toast-count"></span>';
    toasts.appendChild(el);
    armToast(el);
  }
  function armToast(el) {
    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => dismissToast(el), 3200);
  }
  function dismissToast(el) {
    if (!el || el.__leaving) return;
    el.__leaving = true;
    clearTimeout(el.__timer);
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => el.remove(), 320);
  }
  /* expose the controller hooks the feature modules (settings, relief) reach
     for. These are assigned once on boot; the modules guard with typeof so a
     missed assignment never throws. */
  window.UG_TOAST = toast;

  /* ------------------------------------------------------------------ render */
  function viewFor() {
    if (!S.session) return 'mobile';
    if (S.session.role !== 'citizen') return 'console';
    return isWide() ? 'desktop' : 'mobile';
  }

  /* Oct 2026 design: each role gets its own palette (css/design.css). The
     portal key matches the React app's brandTokens.ts: auth, resident,
     barangay, command (LDRRMO staff), admin (Super Admin), dispatch. */
  const PORTAL_THEME = {
    auth: '#0E2243', resident: '#991B1B', barangay: '#052659',
    command: '#18181B', admin: '#F2B21B', dispatch: '#EA580C'
  };
  function portalFor() {
    const sess = S.session; /* render() shows the sign-in screens when there is no session */
    if (!sess) return 'auth';
    if (sess.role === 'citizen') return 'resident';
    if (sess.role === 'barangay_official') return 'barangay';
    if (sess.role === 'dispatch_team') return 'dispatch';
    if (sess.role === 'lgu_ldrrmc') return sess.superAdmin ? 'admin' : 'command';
    return 'auth';
  }
  /* only when css/design.css is linked: without it there is no data-portal,
     so theme.js's light shades stay off and the previous dark design is intact */
  const DESIGN_ON = !!document.querySelector('link[href$="css/design.css"]');
  function applyPortal() {
    if (!DESIGN_ON) return;
    const portal = portalFor();
    const html = document.documentElement;
    if (html.dataset.portal === portal) return;
    html.dataset.portal = portal;
    /* phone status bar / browser chrome follows the role's colour */
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', PORTAL_THEME[portal]);
  }

  function render(focusField) {
    applyPortal();
    /* Sidebar scroll position preservation. The DOCX reports a recurring
       bug: clicking a lower sidebar item snaps the sidebar back to the top
       on every re-render. Root cause: render() rebuilds the entire #ug-root
       innerHTML, which replaces the .ug-side / .ug-nav list — so its
       scrollTop resets to 0. Capture both the main scroll container and the
       sidebar (and dispatch sidebar) scroll positions before the rebuild
       and restore them after. The main .ug-scroll keeps the route-change
       reset-to-top behaviour from revision 1 (Section 12 fix). */
    const prev = q('.ug-scroll');
    const prevRoute = (prev && prev.dataset && prev.dataset.route) || null;
    const top = prev ? prev.scrollTop : 0;
    const prevSide = q('.ug-side');
    const prevDispatchNav = q('#ug-dispatch-nav');
    const sideTop = prevSide ? prevSide.scrollTop : 0;
    const dispatchTop = prevDispatchNav ? prevDispatchNav.scrollTop : 0;
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
    if (sc) {
      /* If the route changed, scroll to the top of the new section so the
         user is not stranded at the bottom after picking a navigation item
         (Section 12). Otherwise restore the previous scroll position so
         filter changes don't jump the view. */
      if (prevRoute && S.route && prevRoute !== S.route) {
        sc.scrollTop = 0;
        if (sc.dataset) sc.dataset.route = S.route;
      } else {
        sc.scrollTop = top;
        if (sc.dataset) sc.dataset.route = S.route;
      }
    }
    /* restore sidebar scroll position so the active item stays in view. */
    const newSide = q('.ug-side');
    if (newSide && sideTop) newSide.scrollTop = sideTop;
    const newDispatchNav = q('#ug-dispatch-nav');
    if (newDispatchNav && dispatchTop) newDispatchNav.scrollTop = dispatchTop;
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
  /* APP_RENDER is the re-render hook the feature modules call after a local-only
     mutation (a settings toggle, a template edit). Defined after render() exists. */
  window.APP_RENDER = render;

  /* The report form's barangay follows the pin. The server files a report
     under the barangay whose official boundary contains its coordinates
     (migration 053), so ask it; only when that is unavailable (offline, RPC
     not deployed) fall back to the address-based guess. S.report.pinBrgy is
     the authoritative value the form compares the dropdown against. */
  async function setReportBarangayFromPin(lat, lng, guess) {
    const srv = await Repo.barangayAt(lat, lng);
    if (srv && srv.name) {
      S.report.pinBrgy = srv.name;
      S.report.brgy = srv.name;
      return srv.name;
    }
    S.report.pinBrgy = null;
    if (guess) S.report.brgy = guess;
    return guess || null;
  }

  /* --------------------------------------------------------------- live maps */
  let mapKey = '';
  /* responding teams with a GPS fix, for the map's unit markers; `only`
     limits them to one incident */
  const UNIT_STATUS = { sent: 'Sent', acknowledged: 'Acknowledged', en_route: 'En route', on_scene: 'On scene',
    under_control: 'Under control', fire_out: 'Fire out', on_hold: 'On hold', transporting: 'Transporting',
    arrived_hospital: 'Arrived at hospital' };
  function respondingUnits(only) {
    const byReport = UG.DATA.dispatches || {};
    const units = UG.DATA.unitsById || {};
    const incs = only ? [only] : (UG.DATA.incidents || []);
    const out = [];
    incs.forEach((i) => {
      (byReport[i.uuid] || []).forEach((d) => {
        if (d.last_lat == null || d.last_lng == null) return;
        if (d.dispatch_status === 'done' || d.dispatch_status === 'declined') return;
        out.push({ lat: d.last_lat, lng: d.last_lng, team: d.team, name: (units[d.unit_id] || {}).name || '',
          statusLabel: UNIT_STATUS[d.dispatch_status] || d.dispatch_status, code: i.id, at: d.last_loc_at });
      });
    });
    return out;
  }

  async function mountMaps() {
    const live = q('[data-map="live"]');
    const detail = q('[data-map="detail"]');
    const report = q('[data-map="report-pin"]');
    if (!live && !detail && !report) return;

    const targets = [];
    if (live) targets.push({ el: live, key: 'live', centers: true });
    if (detail && S.openId) {
      const inc = (UG.DATA.incidents || []).find((i) => i.id === S.openId || i.uuid === S.openId);
      targets.push({ el: detail, key: 'detail:' + S.openId + ':' + (S.offline ? 'o' : 'n'), only: inc });
    }
    if (report) {
      /* the citizen report form's mini drag-to-adjust pin */
      targets.push({ el: report, key: 'report-pin:' + (S.report.lat || '') + ',' + (S.report.lng || ''), report: true });
    }

    for (const t of targets) {
      if (t.report) {
        if (t.el.dataset.mounted === t.key) continue;
        t.el.dataset.mounted = t.key;
        t.el.innerHTML = '';
        /* mount a draggable Leaflet pin that updates S.report on drop */
        const ctx = await MapView.mount(t.el, {
          reportPin: { lat: S.report.lat, lng: S.report.lng },
          zoom: 16,
          onPinDrop: (lat, lng) => APP_ACTIONS['report-pin-drop']({ lat: String(lat), lng: String(lng) }),
          /* GPS fix outside Lingayen: the pin starts in town; show the notice
             in place (a re-render here would remount the map in a loop) */
          onPinOutside: () => {
            S.report.pinOutside = true;
            qa('[data-pin-outside]').forEach((el) => { el.hidden = false; });
          }
        });
        continue;
      }
      if (t.only) {
        if (t.el.dataset.mounted === t.key) {
          /* already showing: move the responding teams in place */
          if (MapView.owns(t.el)) MapView.setUnits(respondingUnits(t.only));
          continue;
        }
        t.el.dataset.mounted = t.key;
        t.el.innerHTML = '';
        await MapView.mount(t.el, {
          incidents: [t.only],
          units: t.only ? respondingUnits(t.only) : [],
          relief: UG.DATA.relief || [],
          roadStatus: UG.DATA.roadStatus || [],
          zoom: 15
        });
        MapView.invalidate();
        continue;
      }
      /* the live operations map: mount once, then refresh the overlays in
         place. A full remount on every data change (a new report arriving,
         a status change) threw away the user's pan/zoom and reloaded the
         tiles; the setters redraw only the marker layer instead. */
      if (t.el.dataset.mounted === 'live' && MapView.owns(t.el)) {
        MapView.setIncidents(UG.DATA.incidents || []);
        MapView.setCenters(UG.DATA.centers || []);
        MapView.setRelief(UG.DATA.relief || []);
        MapView.setRoadStatus(UG.DATA.roadStatus || []);
        MapView.setUnits(respondingUnits());
        MapView.setLayers(S.mapLayers);
        MapView.invalidate();
        continue;
      }
      t.el.dataset.mounted = 'live';
      t.el.innerHTML = '';
      await MapView.mount(t.el, {
        incidents: UG.DATA.incidents || [],
        centers: UG.DATA.centers || [],
        relief: UG.DATA.relief || [],
        roadStatus: UG.DATA.roadStatus || [],
        units: respondingUnits(),
        layers: S.mapLayers,
        zoom: 13,
        /* dedicated map screens fit the view to the records once; dashboard
           mini-maps keep the plain town-centre overview */
        fit: t.centers
      });
      if (ctx0(t.el)) {
        /* data-toggles: "inline" = the screen draws its own chip row, so no
           floating panel; "chip" = the panel opens from the header Layers chip */
        const mode = t.el.dataset.toggles;
        const panel = (t.centers && mode !== 'inline') ? layerToggleHtml(mode === 'chip' && !S.mapPanelOpen) : '';
        t.el.insertAdjacentHTML('beforeend', panel + '<div class="map-scale">1 : 25 000</div>');
      }
      MapView.invalidate();
    }
  }
  /* mount() resolves to the mounted context; a fallback (no Leaflet) has no map */
  function ctx0(el) {
    try {
      return el.querySelector('.leaflet-container') ? true : false;
    } catch (e) { return false; }
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
    /* Super Admin home: accounts, activity, SOS, change requests, units,
       responders and push devices, each read on its own */
    if (route === 'admin-home') {
      if (isSuperAdmin() && typeof UG_SUPERADMIN !== 'undefined') await UG_SUPERADMIN.load();
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
    }
    /* Hotlines page: load pending change requests so the Super Admin queue
       and the LGU/BO "Your pending requests" section both render with live
       data. (Master prompt · Emergency Hotlines approval.) */
    if (route === 'hotlines') {
      try {
        if (typeof Repo !== 'undefined' && Repo.loadChangeRequests) {
          await Repo.loadChangeRequests();
        }
      } catch (e) {}
      render();
      return;
    }
    /* Module G: reports and documentation loads its own register */
    if (route === 'reporting') {
      if (typeof UG_REPORTING !== 'undefined') { try { await UG_REPORTING.loadRoute(); } catch (e) { } }
      return;
    }
    /* Module H: accounts and the activity log belong to the Super Admin. The
       database refuses the read for anyone else; skipping it here just avoids
       showing LDRRMO staff an error for a screen they are not offered. */
    if ((route === 'users' || route === 'audit') && !isSuperAdmin()) { render(); return; }
    /* The screens read UG.DATA.users / UG.DATA.audit, so every load must
       write there too (it used to fill only S.users / S.audit, which left the
       Users and Activity Log screens empty although the request succeeded).
       Each loader runs on its own and reports its own failure via S.error. */
    if (route === 'users') {
      S.loading = true; S.error = null; render();
      try {
        S.users = await Repo.listUsers();
        UG.DATA.users = S.users;
      } catch (e) {
        console.error('[UniGuard] load accounts failed', e);
        S.error = (e && e.message) || 'Could not load accounts';
      }
      S.loading = false; render();
      return;
    }
    if (route === 'audit') {
      S.loading = true; S.error = null; render();
      try {
        S.audit = await Repo.listAudit(200);
        UG.DATA.audit = S.audit;
      } catch (e) {
        console.error('[UniGuard] load activity log failed', e);
        S.error = (e && e.message) || 'Could not load the audit log';
      }
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
    'others-review', 'response-team', 'dispatch-units', 'dispatch', 'reporting',
    'equipment', 'roster', 'hospital', 'requests', 'contacts', 'dispatch-detail', 'settings',
    'admin-home'];

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
  /* the Super Admin starts on their own home screen (js/screens.superadmin.js) */
  const homeRoute = () => (S.session && S.session.role === 'lgu_ldrrmc' && S.session.superAdmin && typeof UG_SUPERADMIN !== 'undefined')
    ? UG_SUPERADMIN.ROUTE
    : ((S.session && UG_WEB.ROLE_INFO[S.session.role].home) || 'home');
  function enterApp(session, message) {
    S.session = session;
    S.screen = 'app';
    if (session.barangay && UG_GEO.BARANGAYS.indexOf(session.barangay) !== -1) {
      S.report.brgy = session.barangay;
    }
    S.auth = blankAuth();
    S.declareArmed = false;
    /* publish the current user id so the settings module can load per-user
       preferences (language, notifications, offline) keyed by this id.
       Different users on the same device now get their own preferences. */
    window.__UG_CURRENT_UID = session.id || session.email || '';
    if (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.reloadUserPrefs) {
      UG_SETTINGS.reloadUserPrefs();
      /* sync the i18n layer so the very first render after login is in the
         user's chosen language */
      if (typeof UG_I18N !== 'undefined' && UG_SETTINGS.getUserPrefs().language) {
        UG_I18N.setLang(UG_SETTINGS.getUserPrefs().language.ui || 'en');
      }
    }
    go(homeRoute());
    toast(message || ('Signed in as ' + (session.title || UG_WEB.ROLE_INFO[session.role].label) + ' · ' + session.scope), 'prepared');
    render();
    bootstrapData();
    if (S.route === 'admin-home') loadRouteData('admin-home');
  }

  function requireRole(roles) {
    if (!S.session) return false;
    return roles.indexOf(S.session.role) !== -1;
  }
  const isSuperAdmin = () => !!(S.session && S.session.role === 'lgu_ldrrmc' && S.session.superAdmin);

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
      if (!(f.lastName || '').trim()) { S.auth.error = 'Enter your last name.'; return render(); }
      if (!(f.firstName || '').trim()) { S.auth.error = 'Enter your first name.'; return render(); }
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
          fullName: UG_UTIL.joinName(f.lastName, f.firstName), email: f.email.trim(), phone: phone,
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
      /* from the expired-link notice on the sign-in screen there is no pending
         email yet, so use the address typed into the form */
      if (!S.auth.pendingEmail) {
        const typed = (S.auth.form.email || '').trim();
        if (!typed) { S.auth.error = 'Enter your email address, then tap Request a new link.'; return render(); }
        S.auth.pendingEmail = typed;
      }
      S.auth.loading = true; S.auth.error = ''; S.auth.notice = ''; render();
      try {
        await Auth.resendConfirmation(S.auth.pendingEmail);
        S.auth.linkExpired = false;
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
      try {
        await Auth.resetPassword(f.email.trim());
        S.auth.loading = false;
        S.auth.screen = 'forgot-sent';
      } catch (e) {
        /* rate-limit errors surface here so the user knows the email didn't
           go through; other errors are swallowed inside resetPassword() */
        S.auth.loading = false;
        S.auth.error = UG_UTIL.authError(e.message);
      }
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

    /* Onboarding — the invited user fills in name/phone/barangay. The password
       field is OPTIONAL: if they already have a password (set by the LGU in the
       Supabase dashboard), they can leave it blank to keep it. If they don't
       have one yet, they must set one here. Auth.completeOnboarding handles
       both cases. */
    'complete-onboarding': async () => {
      const f = S.auth.form;
      S.auth.error = '';
      /* password is only required if they typed something in the confirm
         field but not the password field, OR vice versa. If both are blank,
         we skip the password update and keep their current one. */
      if (f.password || f.confirm) {
        if (!f.password || f.password.length < 8) { S.auth.error = 'Use at least 8 characters for the password.'; return render(); }
        if (f.password !== f.confirm) { S.auth.error = 'The two passwords do not match.'; return render(); }
      }
      if (!(f.lastName || '').trim()) { S.auth.error = 'Enter your last name.'; return render(); }
      if (!(f.firstName || '').trim()) { S.auth.error = 'Enter your first name.'; return render(); }
      const role = (S.auth.pendingProfile && S.auth.pendingProfile.role) || 'citizen';
      if (role === 'barangay_official' && !f.barangay_id) { S.auth.error = 'Select your barangay.'; return render(); }
      S.auth.loading = true; render();
      try {
        const session = await Auth.completeOnboarding({
          password: f.password || '',  /* empty string = skip password update */
          name: UG_UTIL.joinName(f.lastName, f.firstName),
          phone: (f.phone || '').trim(),
          barangay_id: f.barangay_id || null
        });
        S.auth = blankAuth();
        enterApp(session, 'Account complete. Welcome to UniGuard.');
      } catch (e) {
        S.auth.loading = false;
        S.auth.error = UG_UTIL.authError(e.message);
        render();
      }
    },

    /* boot could not confirm the account (no connection, server error):
       try again without signing out */
    'retry-restore': async () => {
      S.auth.loading = true; S.auth.error = ''; render();
      try {
        const session = await Auth.restore();
        S.auth.loading = false;
        if (session) { enterApp(session); return; }
        S.auth.restoreFailed = false;
      } catch (e) {
        S.auth.loading = false;
        S.auth.error = UG_UTIL.friendlyError(e);
      }
      render();
    },

    logout: async () => {
      const ok = await UG_FEATURES.confirm({
        title: T('action.signout'),
        message: 'Sign out of UniGuard on this device?',
        confirmLabel: 'Sign out'
      });
      if (!ok) return;
      MapView.destroy();
      /* a signed-out device must not keep sharing a responder's position */
      try { UG_DISPATCH.signedOut(); } catch (e) { }
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
            '<button class="ug-btn ug-btn--sm" type="button" data-act="rs-pin" data-keep-modal>Use my location</button>' +
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
     watchman. The DB constraint (migration 035) accepts the new name.
     G1 (Oct 24 2026): "MDRRMO Rescue" is removed from the form's pickable
     list so dispatchers see only "Rescue Unit". The DB check still accepts
     the old name and routes it through the same Rescue logic
     (migration 039 maps it to unit_type 'Rescue'); old rows keep rendering. */
  const DISPATCH_TEAMS = ['BFP', 'PNP', 'Barangay Response Team', 'Ambulance', 'Rescue Unit'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const toLocalInput = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());

  function loadDispatchesFor(id) {
    const inc = (UG.DATA.incidents || []).find((i) => i.id === id || i.uuid === id);
    if (!inc || !inc.uuid) return;
    Repo.loadDispatches(inc.uuid).then(() => { if (S.session) render(); }).catch(() => { });
    loadHistoryFor(inc);
  }

  /* the report's recorded status changes for its History / Activity Log
     card; `status` remembers which status they were loaded at, so a live
     change to the open report reloads them */
  function loadHistoryFor(inc) {
    UG.DATA.reportHistory = UG.DATA.reportHistory || {};
    UG.DATA.reportHistoryAt = UG.DATA.reportHistoryAt || {};
    UG.DATA.reportHistoryAt[inc.uuid] = inc.status;
    Repo.reportHistory(inc.uuid).then((rows) => {
      if (rows && rows.length) UG.DATA.reportHistory[inc.uuid] = rows;
      if (S.session) render();
    }).catch(() => { });
    /* the rating card offers only the roles that handled this report */
    if (inc.status === 'resolved') {
      UG.DATA.reportHandlers = UG.DATA.reportHandlers || {};
      Repo.reportHandlers(inc.uuid).then((h) => {
        UG.DATA.reportHandlers[inc.uuid] = h || { failed: true };
        if (S.session) render();
      }).catch(() => { });
    }
  }

  /* after a verification, say whether the response went out by itself
     (migration 057 auto-dispatches on verification) */
  function verifiedToast(inc) {
    const now = (UG.DATA.incidents || []).find((i) => i.uuid === inc.uuid) || inc;
    const teams = ((UG.DATA.dispatches || {})[inc.uuid] || []).filter((x) => x.auto_dispatched).map((x) => x.team);
    if (now.status === 'dispatched' && teams.length) {
      toast(inc.id + ' verified · dispatched automatically: ' + teams.join(', '), 'prepared');
    } else {
      toast(inc.id + ' verified · no team went out automatically, use Dispatch Response', 'warning');
    }
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

  /* The units and equipment lists were only loaded on the Dispatch Units /
     Response Team screens, so from the dashboard or the incident queue this
     form showed no units and "(no equipment available)". Load them first;
     the flag keeps a double click to one form. */
  let dispatchOpening = false;
  function dispatchModal(inc) {
    if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can dispatch a response', 'warning'); return; }
    if (inc.status !== 'verified' && inc.status !== 'dispatched') {
      toast('Verify the report before dispatching a response', 'warning'); return;
    }
    if (dispatchOpening) return;
    dispatchOpening = true;
    Promise.resolve(Repo.loadDispatchDirectory ? Repo.loadDispatchDirectory() : null)
      .catch(() => { })
      .then(() => { dispatchOpening = false; openDispatchModal(inc); });
  }
  function openDispatchModal(inc) {
    const me = S.session;
    const roleLabel = (UG_WEB.ROLE_INFO[me.role] || {}).label || '';
    const esc = UG_UTIL.esc;

    /* The team list now includes municipality-wide units. The pickable
       unit list comes from the directory loader (Repo.loadDispatchDirectory).
       For the barangay Response Team there is no unit_id — the team IS the
       report's barangay's own team. */
    const units = UG.DATA.dispatchUnits || [];
    const unitByType = (type) => units.filter((u) => u.unit_type === type && u.active);
    /* A3: suggested teams for this hazard, sorted first with a "Suggested"
       badge in the option text. All teams remain pickable. */
    const suggested = (typeof UG_HAZARDS !== 'undefined' && UG_HAZARDS.suggestedTeams)
      ? UG_HAZARDS.suggestedTeams(inc.hazard_type || inc.hazard)
      : [];
    const sortedTeams = DISPATCH_TEAMS.slice().sort((a, b) => {
      const ai = suggested.indexOf(a); const bi = suggested.indexOf(b);
      const an = ai === -1 ? 99 : ai; const bn = bi === -1 ? 99 : bi;
      return an - bn;
    });
    const teamOpts = sortedTeams.map((t) => {
      const isSugg = suggested.indexOf(t) !== -1;
      return '<option value="' + esc(t) + '"' + (isSugg ? ' data-suggested="1"' : '') + '>' +
        esc(t) + (isSugg ? '  (Suggested)' : '') + '</option>';
    }).join('');

    const defaultEta = toLocalInput(new Date(Date.now() + 30 * 60000));
    const kv = (k, v, attrs) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--ug-line)">' +
      '<span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600"' + (attrs || '') + '>' + esc(v) + '</span></div>';

    /* Equipment picker: populated based on the team. For municipality-wide
       units, the available equipment of the chosen unit. For the Response
       Team, the available equipment of the report's barangay. */
    const equipmentList = (team, unitId) => {
      const list = (UG.DATA.dispatchEquipment || []).filter((e) => {
        if (e.status !== 'available') return false;
        if (e.condition && ['needs_repair', 'missing', 'out_of_service'].indexOf(e.condition) !== -1) return false;
        /* a report without a barangay id must not match equipment that has
           no barangay (every unit's equipment), so require a real id */
        if (team === 'Barangay Response Team') { const bid = inc.brgy_id || inc.barangay_id; return !!bid && e.owner_barangay_id === bid; }
        return unitId && e.owner_unit_id === unitId;
      });
      if (!list.length) {
        return '<div class="ug-eq-empty">' + (team !== 'Barangay Response Team' && !unitId
          ? 'Pick a unit to see its equipment.'
          : 'No available equipment for this team. You can still dispatch without equipment.') + '</div>';
      }
      const catalog = UG.DATA.equipmentCatalog || [];
      /* one tick box per piece (the multi-select needed Ctrl / Cmd);
         the type is shown with the tag so two trucks can be told apart */
      return list.map((e) => {
        const c = catalog.find((x) => x.id === e.catalog_id);
        const type = c ? c.label : (e.custom_label || '');
        const tag = e.identifier || e.custom_label || 'Equipment';
        return '<label class="ug-eq-item"><input type="checkbox" value="' + esc(e.id) + '">' +
          '<span class="ug-eq-name">' + esc(tag) + '</span>' +
          (type && type !== tag ? '<span class="ug-eq-type">' + esc(type) + '</span>' : '') + '</label>';
      }).join('');
    };

    UG_FEATURES.modal({
      title: (inc.status === 'dispatched' ? 'Add another team · ' : 'Dispatch response · ') + inc.id,
      body:
        '<div class="ug-field"><label class="ug-lab">Responder or team</label>' +
          '<select class="ug-sel" data-dp-team>' + teamOpts + '</select></div>' +
        '<div class="ug-field" data-dp-unit-field hidden><label class="ug-lab">Unit (municipality-wide)</label>' +
          '<select class="ug-sel" data-dp-unit><option value="">Select a unit</option>' +
          units.filter((u) => u.active !== false).map((u) => '<option value="' + esc(u.id) + '" data-type="' + esc(u.unit_type) + '">' + esc(u.name) + ' · ' + esc(u.unit_type) + '</option>').join('') +
          '</select></div>' +
        '<div class="ug-field"><label class="ug-lab">Equipment to deploy (optional)</label>' +
          '<div class="ug-eq-list" data-dp-equipment>' + equipmentList('Barangay Response Team', null) + '</div>' +
          '<div class="ug-help">Tick each piece to send. Only equipment that is available and in working condition is listed. Leave all unticked to dispatch with no equipment.</div></div>' +
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
          eqSel.innerHTML = equipmentList(team, mappedUnitId);
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
        /* match the form to the team it opens with (the suggested team can be
           BFP, PNP, ...), not only after the first change */
        refreshUnitField();

        const btn = wrap.querySelector('[data-dp-confirm]');
        btn.addEventListener('click', async () => {
          const team = wrap.querySelector('[data-dp-team]').value;
          const instructions = wrap.querySelector('[data-dp-instr]').value.trim();
          const etaVal = etaEl.value;
          const unitId = wrap.querySelector('[data-dp-unit]').value || null;
          /* every ticked piece of equipment */
          const eqIds = Array.prototype.map.call(wrap.querySelectorAll('[data-dp-equipment] input:checked'), (o) => o.value).filter(Boolean);
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
              unit_id: unitId, equipment_ids: eqIds.length ? eqIds : null
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
    'history-all': (d) => { S.historyAll = S.historyAll === d.id ? null : d.id; render(); },
    'auto-dispatch': async (d) => {
      try {
        const res = await Repo.autoDispatch(d.id);
        const n = (res && res.dispatched) || 0;
        toast(n ? n + (n === 1 ? ' team dispatched' : ' teams dispatched') : 'No team could be sent automatically. Use Dispatch Response.', n ? 'prepared' : 'warning');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },
    /* stars update in place (a re-render would drop a comment being typed):
       the row's word, and the faint example in its comment box, follow the
       stars picked. S.rateDraft keeps the picks across a live refresh. */
    'rate-star': (d, el) => {
      const n = parseInt(d.n, 10) || 0;
      const target = d.target || 'overall';
      if (!S.rateDraft || S.rateDraft.id !== d.id) S.rateDraft = { id: d.id, stars: {} };
      S.rateDraft.stars[target] = n;
      const group = el && el.closest('.ug-stars');
      if (!group) return;
      group.dataset.value = String(n);
      group.querySelectorAll('.ug-star').forEach((b, k) => {
        b.classList.toggle('is-on', k < n);
        b.setAttribute('aria-checked', String(k + 1 === n));
      });
      const word = group.parentElement && group.parentElement.querySelector('.ug-star-word');
      if (word) word.textContent = UG_SCREENS.STAR_WORDS[n] || '';
      const card = group.closest('[data-rate-card]');
      const box = card && Array.prototype.find.call(card.querySelectorAll('[data-rate-comment]'), (t) => t.dataset.target === target);
      const hints = UG_SCREENS.RATE_HINTS[group.dataset.kind] || UG_SCREENS.RATE_HINTS.overall;
      if (box) box.placeholder = hints[n] || hints[0];
    },
    'rate-submit': async (d, el) => {
      const card = el && el.closest('.ug-card') && el.closest('.ug-card').querySelector('[data-rate-card]');
      if (!card) return;
      const comments = {};
      card.querySelectorAll('[data-rate-comment]').forEach((t) => { comments[t.dataset.target] = t.value; });
      let overall = 0;
      const details = [];
      card.querySelectorAll('.ug-stars[data-rate-target]').forEach((g) => {
        const t = g.dataset.rateTarget, n = parseInt(g.dataset.value, 10) || 0;
        if (t === 'overall') overall = n;
        else if (n) details.push({ target: t, stars: n, comment: comments[t] || '' });
      });
      if (!overall) { toast('Choose 1 to 5 stars for the overall response', 'warning'); return; }
      try {
        await Repo.rateReport(d.id, overall, comments.overall || '', details);
        S.rateDraft = null;
        toast('Thank you. Your rating was sent.', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },
    'open-road-detail': (d) => { UG_ROADWORK.roadDetailModal(d.id, S); },

    'rw-manual-pin': () => {
      /* replaced the single-line "Latitude, longitude" prompt with a proper
         modal: the LGU can now type a barangay and/or street name (the human
         description residents will read) AND optionally coordinates. If
         coordinates are given they win; otherwise the pin is left null and the
         address text is stored so the notification still carries a readable
         location. */
      const d = S.roadDraft || {};
      UG_FEATURES.modal({
        title: T('roadwork.roadPin'),
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
          '<div style="height:6px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.08);overflow:hidden;margin-bottom:12px">' +
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
    'inc-hazard-clear': () => { S.incHazardFilter = 'All'; render(); },
    'center-filter': (d) => { S.centerFilter = d.v; render(); },
    'set-urg': (d) => { S.report.urg = d.v; render(); },

    gps: async () => {
      toast('Reading your position...', 'info');
      try {
        const p = await UG_FEATURES.locate();
        S.report.lat = p.lat; S.report.lng = p.lng; S.report.accuracy = p.accuracy; S.report.gps = true;
        S.report.pinOutside = false;   /* the map re-flags it if this fix is outside Lingayen */
        /* reverse-geocode so a citizen can verify the pin against a real address, and
           so the LGU sees something more human-readable than lat/lng on the dispatch view.
           The barangay comes from the server's official boundaries (the one the
           report will be filed under); the address-based guess is only a fallback. */
        let guess = null;
        try {
          const geo = await UG_FEATURES.reverseGeocode(p.lat, p.lng);
          S.report.address = geo.address || '';
          guess = geo.barangay || null;
        } catch (e) { S.report.address = ''; }
        const brgy = await setReportBarangayFromPin(p.lat, p.lng, guess);
        if (brgy) {
          toast('Position acquired, accuracy ' + p.accuracy + ' m · barangay ' + brgy, 'prepared');
        } else {
          toast('Position acquired, accuracy ' + p.accuracy + ' m' + (S.report.address ? ' · ' + S.report.address : '') + ' — please confirm your barangay', 'prepared');
        }
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
        title: T('action.type'),
        label: 'Latitude, longitude',
        placeholder: UG_GEO.EXAMPLE,
        help: 'Example: 16.0206, 120.2306 — latitude first.'
      });
      const parsed = UG_FEATURES.parseCoords(manual);
      if (parsed) {
        S.report.lat = parsed.lat; S.report.lng = parsed.lng; S.report.gps = true; S.report.accuracy = null;
        let guess = null;
        try {
          const geo = await UG_FEATURES.reverseGeocode(parsed.lat, parsed.lng);
          S.report.address = geo.address || '';
          guess = geo.barangay || null;
        } catch (er) { S.report.address = ''; }
        await setReportBarangayFromPin(parsed.lat, parsed.lng, guess);
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
      S.report.lat = lat; S.report.lng = lng; S.report.gps = true; S.report.pinOutside = false;
      let guess = null;
      try {
        const geo = await UG_FEATURES.reverseGeocode(lat, lng);
        S.report.address = geo.address || '';
        guess = geo.barangay || null;
      } catch (e) { S.report.address = ''; }
      await setReportBarangayFromPin(lat, lng, guess);
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
      /* The server files the report under the barangay containing the pin, not
         the dropdown. If they differ, say so before sending instead of after. */
      if (r.pinBrgy && r.brgy !== r.pinBrgy) {
        const go = await UG_FEATURES.confirm({
          title: 'Pin is in ' + r.pinBrgy,
          message: 'You chose ' + r.brgy + ', but the pin is in ' + r.pinBrgy + '. The report will be filed under ' + r.pinBrgy + '. ' +
            'If the hazard is in ' + r.brgy + ', cancel and move the pin to the hazard location.',
          confirmLabel: 'Submit to ' + r.pinBrgy
        });
        if (!go) return;
        r.brgy = r.pinBrgy;
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
          /* the barangay the server actually filed it under */
          const filed = (res.row && res.row.brgy) || r.brgy;
          toast(res.queued ? 'Saved for upload' : 'Report ' + res.row.id + ' submitted to the ' + filed + ' queue', 'prepared');
          S.lastReport = { id: res.row ? res.row.id : null, brgy: filed };
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
      /* Client-side role check: only barangay_official and lgu_ldrrmc may
         advance a report's status. The server-side advance_report_status
         RPC also enforces this (migration 046), but the client check gives
         a clean rejection instead of a raw server error for citizens who
         somehow trigger the action. */
      if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can change an incident status', 'warning'); return; }
      /* Super Admin must not verify reports (Section 1 of the spec). The
         advance action moves reported → verified (i.e. verifies it), so block
         the Super Admin from using it. Edit-report is the Super Admin's
         override path. The server-side RPC enforces this independently. */
      if (isSuperAdmin() && !UG_CONFIG.SUPER_ADMIN_VERIFY_OVERRIDE) {
        const inc0 = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
        if (inc0 && inc0.status === 'reported') {
          toast('Super Admin cannot verify reports. Use Edit to correct the record instead.', 'warning');
          return;
        }
      }
      const order = ['reported', 'verified', 'dispatched', 'resolved'];
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (!inc) return;
      const next = order.indexOf(inc.status) + 1;
      if (next >= order.length) { toast('This incident is already resolved', 'info'); return; }
      if (order[next] === 'dispatched') { dispatchModal(inc); return; }
      const label = UG.STAGES[next].label;
      /* Resolving needs a closing note: the reporter's notification and the
         audit log both carry it (advance_report_status rejects an empty one). */
      if (order[next] === 'resolved') {
        const closing = await UG_FEATURES.prompt({
          title: 'Resolve ' + inc.id,
          label: 'Closing note (required, sent to the reporter)',
          placeholder: 'e.g. Water receded; road passable again.',
          required: true, requiredMessage: 'Write a closing note before resolving.'
        });
        if (closing === null) return;
        try {
          await Repo.advanceStatus(inc.uuid || inc.id, 'resolved', closing);
          toast(inc.id + ' moved to ' + label, 'prepared');
        } catch (e) { toast(e.message, 'warning'); }
        render();
        return;
      }
      const ok = await UG_FEATURES.confirm({
        title: T('action.update'),
        message: 'Move ' + inc.id + ' to "' + label + '"?',
        detail: '<div class="ug-kv"><dt>From</dt><dd>' + UG_UTIL.esc(inc.status) + '</dd><dt>To</dt><dd>' + UG_UTIL.esc(label) + '</dd></div>',
        confirmLabel: 'Move to ' + label
      });
      if (!ok) return;
      try {
        await Repo.advanceStatus(inc.uuid || inc.id, order[next]);
        if (order[next] === 'verified') verifiedToast(inc);
        else toast(inc.id + ' moved to ' + label, next === order.length - 1 ? 'prepared' : 'warning');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    reject: async (d) => {
      if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can reject a report', 'warning'); return; }
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (!inc) return;
      const reason = await UG_FEATURES.prompt({
        title: 'Reject report', label: 'Reason (required, sent to the reporter)', placeholder: 'e.g. Duplicate of UG-2026-0140',
        required: true, requiredMessage: 'Write the reason for rejecting this report.'
      });
      if (reason === null) return;
      try {
        await Repo.advanceStatus(inc.uuid || inc.id, 'rejected', reason);
        toast(inc.id + ' marked rejected', 'warning');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    /* "Add Team" on a dispatched incident. It was named 'dispatch-open',
       which the dispatch team module (js/dispatch.js) also defines for a
       different screen; that one was merged later and won, so this button
       never opened the dispatch form. */
    'incident-add-team': (d) => {
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (inc) dispatchModal(inc);
    },

    /* LGU-only second verification path (migration 036 + migration 047 for
       the 1-hour overdue queue). When a barangay is inactive OR the 1-hour
       verification window has elapsed, LGU/LDRRMC can mark a reported
       incident as LGU-verified so the response can move forward. The RPC
       records verified_by_role='lgu_ldrrmc' + the verifier's name so both
       verify levels stay distinguishable. */
    'lgu-verify': async (d) => {
      if (!requireRole(['lgu_ldrrmc'])) { toast('Only LGU / LDRRMC can LGU-verify a report', 'warning'); return; }
      /* The Super Admin inherits the lgu_ldrrmc role but must not verify reports.
         They have read + edit permission only — no verify, no LGU-verify. */
      if (isSuperAdmin() && !UG_CONFIG.SUPER_ADMIN_VERIFY_OVERRIDE) {
        toast('Super Admin cannot verify reports. Use Edit to correct the record instead.', 'warning');
        return;
      }
      const inc = (UG.DATA.incidents || []).find((i) => i.id === d.id || i.uuid === d.id);
      if (!inc) return;
      if (inc.status !== 'reported') { toast('Only a report still in "reported" can be LGU-verified', 'warning'); return; }
      const note = await UG_FEATURES.prompt({
        title: 'LGU-verify ' + inc.id,
        label: 'Note (optional, shown in the audit log)',
        placeholder: 'e.g. Barangay official unreachable; LGU verifying on their behalf.',
        /* Save with no note must still verify (it used to cancel silently) */
        allowEmpty: true
      });
      if (note === null) return;
      try {
        /* lgu_verify_report keeps the note, stamps verified_by_role and
           notifies the reporter. It works for any report still in
           "reported", overdue or not (migration 051). */
        await Repo.lguVerify(inc.uuid || inc.id, note || '');
        verifiedToast(inc);
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
      /* Module D additions: facilities (comma-separated -> array), contact
         person, contact phone and an optional note. All are passed through to
         Repo.createCenter so the same shape lands whether the row is stored
         locally or in Postgres. */
      const facRaw = (q('[data-field="centerFacilities"]') || {}).value || '';
      const facilities = facRaw ? facRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const contact_person = (q('[data-field="centerContact"]') || {}).value || '';
      const contact_phone = (q('[data-field="centerPhone"]') || {}).value || '';
      const note = (q('[data-field="centerNote"]') || {}).value || '';
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
        await Repo.createCenter({
          name: name.trim(), barangay: brgy, barangay_id: brgyRow ? brgyRow.id : null,
          capacity: cap, occupancy: 0, status: 'open', lat: lat, lng: lng,
          facilities: facilities, contact_person: contact_person.trim(),
          contact_phone: contact_phone.trim(), note: note.trim()
        });
        toast('Evacuation centre added to the directory' + (lat === null ? ' — add coordinates later so Waze navigation works' : ''), 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'center-edit': async (d) => {
      const c = (UG.DATA.centers || []).find((x) => (x.uuid || x.id) === d.id || x.id === d.id);
      if (!c) return;
      const brgyOpts = UG.DATA.barangays.map((b) => '<option' + (b === c.brgy ? ' selected' : '') + '>' + UG_UTIL.esc(b) + '</option>').join('');
      UG_FEATURES.modal({
        title: 'Edit evacuation centre · ' + c.name,
        body:
          '<div class="ug-field"><label class="ug-lab">Center Name</label>' +
            '<input class="ug-in" data-ce-name value="' + UG_UTIL.esc(c.name) + '"></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Barangay</label><select class="ug-sel" data-ce-brgy>' + brgyOpts + '</select></div>' +
            '<div class="ug-field" style="flex:0 0 130px"><label class="ug-lab">Capacity</label><input class="ug-in" data-ce-cap value="' + (c.cap || 0) + '" inputmode="numeric"></div>' +
          '</div>' +
          '<div class="ug-field"><label class="ug-lab">Facilities (comma-separated)</label>' +
            '<input class="ug-in" data-ce-fac value="' + UG_UTIL.esc(Array.isArray(c.facilities) ? c.facilities.join(', ') : (c.facilities || '')) + '"></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Contact person</label><input class="ug-in" data-ce-contact value="' + UG_UTIL.esc(c.contact_person || '') + '"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Contact phone</label><input class="ug-in" data-ce-phone value="' + UG_UTIL.esc(c.contact_phone || '') + '"></div>' +
          '</div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Notes</label>' +
            '<input class="ug-in" data-ce-note value="' + UG_UTIL.esc(c.note || '') + '"></div>' +
          /* D2: needs_patrol toggle. Already limited by RLS to LGU + the
             barangay's officials. Stored on evacuation_centers. */
          '<div class="ug-field" style="margin-bottom:0;margin-top:8px"><label class="ug-lab">Security</label>' +
            '<label class="ug-rowf ug-gap8" style="gap:8px;align-items:center;font-size:12px">' +
              '<input type="checkbox" data-ce-patrol' + (c.needs_patrol ? ' checked' : '') + '>' +
              '<span class="ug-dim">Flag this shelter as needing PNP patrol</span>' +
            '</label></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Save</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const name = wrap.querySelector('[data-ce-name]').value.trim();
            const brgy = wrap.querySelector('[data-ce-brgy]').value;
            const cap = parseInt(wrap.querySelector('[data-ce-cap]').value || '0', 10) || 0;
            const fac = wrap.querySelector('[data-ce-fac]').value;
            const facilities = fac ? fac.split(',').map((s) => s.trim()).filter(Boolean) : [];
            const patrolEl = wrap.querySelector('[data-ce-patrol]');
            const needsPatrol = patrolEl ? !!patrolEl.checked : !!c.needs_patrol;
            if (!name || !cap) { toast('A name and a capacity are required', 'warning'); return; }
            try {
              await Repo.updateCenter(c.uuid || c.id, {
                name: name, barangay: brgy, capacity: cap,
                facilities: facilities,
                contact_person: wrap.querySelector('[data-ce-contact]').value.trim(),
                contact_phone: wrap.querySelector('[data-ce-phone]').value.trim(),
                note: wrap.querySelector('[data-ce-note]').value.trim(),
                needs_patrol: needsPatrol,
                needs_patrol_at: needsPatrol ? (c.needs_patrol_at || new Date().toISOString()) : null
              });
              toast('Evacuation centre updated', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
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

    /* Section 5 + 7: full shelter details modal + dedicated Edit Location
       action (replacing the "Open Waze" / "Navigate with Waze" control on
       the admin card). The Edit Location modal updates lat/lng, and the
       change goes through Repo.updateCenter so it lands in the same column
       the rest of the system reads, and the audit trigger logs it. */
    'center-detail': (d) => {
      const c = (UG.DATA.centers || []).find((x) => (x.uuid || x.id) === d.id || x.id === d.id);
      if (!c) return;
      const pct = c.cap ? Math.min(100, Math.round(c.occ / c.cap * 100)) : 0;
      const geoState = UG_GEO.classify(c.lat, c.lng);
      const facList = Array.isArray(c.facilities) ? c.facilities
        : (c.facilities ? String(c.facilities).split(',').map((s) => s.trim()).filter(Boolean) : []);
      const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + UG_UTIL.esc(k) + '</span><span style="text-align:right;max-width:60%">' + UG_UTIL.esc(v == null || v === '' ? '—' : v) + '</span></div>';
      UG_FEATURES.modal({
        title: c.name || 'Evacuation center',
        body:
          '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:12px">' +
            '<div class="ug-rowf ug-between" style="gap:10px;align-items:center">' +
              UG.badge(c.status, c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : '—') +
              '<span class="ug-mono" style="font-size:11px;color:var(--ug-ink-3)">' + UG_UTIL.esc(c.id) + '</span>' +
            '</div>' +
            '<div>' +
              '<div class="ug-rowf ug-between" style="font-size:11.5px;margin-bottom:5px"><span class="ug-dim">Occupancy</span>' +
                '<span class="ug-mono">' + (c.occ || 0) + ' / ' + (c.cap || 0) + ' &middot; ' + pct + '%</span></div>' +
              '<div style="height:8px;border-radius:4px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + (pct >= 100 ? 'var(--ug-emergency)' : pct >= 80 ? 'var(--ug-warning)' : 'var(--ug-prepared)') + '"></div></div>' +
            '</div>' +
            (facList.length ? '<div class="ug-rowf ug-gap6 ug-wrap" style="gap:5px">' + facList.map((x) => '<span class="ug-chip ug-chip--soft">' + UG.icon('check', 11) + UG_UTIL.esc(x) + '</span>').join('') + '</div>' : '') +
          '</div></div>' +
          '<div style="margin-top:14px">' +
            kv('Center name', c.name) +
            kv('Barangay', c.brgy) +
            kv('Status', c.status) +
            kv('Capacity', c.cap) +
            kv('Current occupancy', c.occ) +
            kv('Coordinates', (typeof c.lat === 'number' && typeof c.lng === 'number') ? UG_GEO.fmt(c.lat, c.lng) : '—') +
            kv('Contact person', c.contact_person) +
            kv('Contact phone', c.contact_phone) +
            (c.note ? kv('Notes', c.note) : '') +
            (c.created_at ? kv('Created', UG_UTIL.absTime(c.created_at) || '') : '') +
            (c.updated_at ? kv('Last updated', UG_UTIL.absTime(c.updated_at) || '') : '') +
          '</div>',
        footer:
          '<button class="ug-btn" data-modal-close>Close</button>' +
          (c.contact_phone ? '<a class="ug-btn" href="tel:' + UG_UTIL.esc(String(c.contact_phone).replace(/[^\\d+]/g, '')) + '" style="text-decoration:none">' + UG.icon('phone', 13) + 'Call</a>' : '') +
          '<button class="ug-btn ug-btn--ghost" data-act="center-edit-location" data-id="' + UG_UTIL.esc(d.id) + '">' + UG.icon('pin', 13) + 'Edit Location</button>' +
          '<button class="ug-btn ug-btn--signal" data-act="center-edit" data-id="' + UG_UTIL.esc(d.id) + '">' + UG.icon('settings', 13) + 'Edit</button>'
      });
    },

    'center-edit-location': async (d) => {
      const c = (UG.DATA.centers || []).find((x) => (x.uuid || x.id) === d.id || x.id === d.id);
      if (!c) return;
      UG_FEATURES.modal({
        title: 'Edit location · ' + c.name,
        body:
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Coordinates (latitude, longitude)</label>' +
            '<div class="ug-rowf ug-gap8" style="gap:8px;align-items:flex-end">' +
              '<div class="ug-field" style="flex:1;margin:0"><label class="ug-lab">Latitude</label>' +
                '<input class="ug-in" data-loc-lat value="' + (typeof c.lat === 'number' ? c.lat : '') + '" placeholder="16.0206" inputmode="decimal"></div>' +
              '<div class="ug-field" style="flex:1;margin:0"><label class="ug-lab">Longitude</label>' +
                '<input class="ug-in" data-loc-lng value="' + (typeof c.lng === 'number' ? c.lng : '') + '" placeholder="120.2306" inputmode="decimal"></div>' +
            '</div>' +
            '<div class="ug-help">Coordinates are used for the shelter\'s map pin and Waze navigation. Use the map on the citizen Hazard Map screen to verify the location.</div></div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px;margin-top:12px">' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-loc-use>' + UG.icon('pin', 13) + 'Use my location</button>' +
            (typeof c.lat === 'number' && typeof c.lng === 'number'
              ? '<a class="ug-btn ug-btn--sm ug-btn--ghost" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(c.lat, c.lng) + '" style="text-decoration:none">' + UG.icon('route', 13) + 'Open in Waze</a>'
              : '') +
          '</div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-save>Save location</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-loc-use]').addEventListener('click', async () => {
            try {
              const pos = await UG_FEATURES.locate();
              wrap.querySelector('[data-loc-lat]').value = pos.lat;
              wrap.querySelector('[data-loc-lng]').value = pos.lng;
              toast('Location captured', 'prepared');
            } catch (e) { toast(e.message, 'warning'); }
          });
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const lat = parseFloat(wrap.querySelector('[data-loc-lat]').value);
            const lng = parseFloat(wrap.querySelector('[data-loc-lng]').value);
            if (isNaN(lat) || isNaN(lng)) { toast('Enter a valid latitude and longitude', 'warning'); return; }
            const state = UG_GEO.classify(lat, lng);
            if (state !== 'ok') {
              const ok = await UG_FEATURES.confirm({
                title: 'Coordinates look unusual',
                message: UG_GEO.message(state) + ' Save anyway?'
              });
              if (!ok) return;
            }
            try {
              await Repo.updateCenter(c.uuid || c.id, { lat: lat, lng: lng });
              toast('Location updated and logged to the audit trail', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    'add-hotline': async () => {
      /* Master prompt · Emergency Hotlines Management. Only the Super Admin
         can directly add an official hotline. LGU / BO use request-hotline-add. */
      if (!isSuperAdmin()) { toast('Only the Super Admin can add official hotlines. Use "Request a new hotline" instead.', 'warning'); return; }
      const agency = ((q('[data-field="hotlineAgency"]') || {}).value || '').trim();
      const number = ((q('[data-field="hotlineNumber"]') || {}).value || '').trim();
      const scope = ((q('[data-field="hotlineScope"]') || {}).value || '').trim() || UG_GEO.PLACE.areaAll;
      if (!agency || !number) { toast('An agency and a contact number are required', 'warning'); return; }
      try {
        await Repo.createHotline({ agency_name: agency, contact_number: number, scope: scope });
        toast('Hotline added and logged to the audit trail', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
      render();
    },

    'edit-hotline': async (d) => {
      if (!isSuperAdmin()) { toast('Only the Super Admin can directly edit official hotlines.', 'warning'); return; }
      const h = (UG.DATA.hotlines || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (!h) return;
      UG_FEATURES.modal({
        title: T('action.edit') + ' hotline',
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
              toast('Hotline updated and logged to the audit trail', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    'delete-hotline': async (d) => {
      /* Super Admin only. The confirmation dialog already existed; we keep it
         and add a second confirmation prompt for the reason, so the audit log
         captures why an official hotline was removed. */
      if (!isSuperAdmin()) { toast('Only the Super Admin can delete official hotlines.', 'warning'); return; }
      const h = (UG.DATA.hotlines || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (!h) return;
      const ok = await UG_FEATURES.confirm({
        title: T('action.delete') + ' hotline', message: 'Remove ' + h.agency + ' from the directory on every device? This cannot be undone.',
        confirmLabel: 'Delete', danger: true
      });
      if (!ok) return;
      try { await Repo.deleteHotline(h.uuid || h.id); toast('Hotline deleted and logged to the audit trail', 'warning'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    /* hotline detail modal — Super Admin + LGU/BO both see the full record;
       Super Admin gets Edit + Delete in the footer, LGU/BO get Request Change */
    'open-hotline-detail': (d) => {
      const h = (UG.DATA.hotlines || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (!h) return;
      const isSuper = isSuperAdmin();
      const canRequest = !!S.session && (S.session.role === 'lgu_ldrrmc' && !isSuper || S.session.role === 'barangay_official');
      const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + UG_UTIL.esc(k) + '</span><span style="text-align:right;max-width:60%">' + UG_UTIL.esc(v == null || v === '' ? '—' : v) + '</span></div>';
      UG_FEATURES.modal({
        title: h.agency || 'Hotline',
        body:
          '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-between" style="gap:10px;align-items:center">' +
            '<span class="ug-mono" style="font-size:17px;color:var(--ug-signal)">' + UG_UTIL.esc(h.number) + '</span>' +
            '<a class="ug-btn ug-btn--sm" href="tel:' + UG_UTIL.esc(String(h.number).replace(/[^\d+]/g, '')) + '" style="text-decoration:none">' + UG.icon('phone', 13) + 'Call</a>' +
          '</div></div>' +
          '<div style="margin-top:14px">' +
            kv('Agency', h.agency) +
            kv('Category', h.type) +
            kv('Contact number', h.number) +
            kv('Scope', h.scope) +
            kv('Description', h.description) +
            (h.barangay ? kv('Barangay', h.barangay) : '') +
            kv('Active', h.active === false ? 'No' : 'Yes') +
            (h.created_at ? kv('Created', UG_UTIL.absTime(h.created_at) || '') : '') +
            (h.updated_at ? kv('Last updated', UG_UTIL.absTime(h.updated_at) || '') : '') +
          '</div>',
        footer:
          '<button class="ug-btn" data-modal-close>Close</button>' +
          (isSuper
            ? '<button class="ug-btn ug-btn--ghost" data-act="edit-hotline" data-id="' + UG_UTIL.esc(h.id) + '">' + UG.icon('settings', 13) + 'Edit</button>' +
              '<button class="ug-btn ug-btn--danger" data-act="delete-hotline" data-id="' + UG_UTIL.esc(h.id) + '">' + UG.icon('x', 13) + 'Delete</button>'
            : canRequest
              ? '<button class="ug-btn ug-btn--signal" data-act="request-hotline-edit" data-id="' + UG_UTIL.esc(h.id) + '">' + UG.icon('edit', 13) + 'Request Change</button>'
              : '')
      });
    },

    /* LGU/BO: open the request-a-new-hotline form */
    'request-hotline-add': () => {
      if (!S.session) return;
      const isSuper = isSuperAdmin();
      if (isSuper) { toast('You can add hotlines directly — use the Add Hotline form below.', 'info'); return; }
      hotlineRequestModal('add', null);
    },

    /* LGU/BO: open the request-a-change form for an existing hotline */
    'request-hotline-edit': (d) => {
      if (!S.session) return;
      const h = (UG.DATA.hotlines || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (!h) return;
      /* show a small chooser: edit or delete this hotline? */
      UG_FEATURES.modal({
        title: 'Request a change · ' + h.agency,
        body:
          '<div class="ug-col" style="gap:10px">' +
            '<div class="ug-dim" style="font-size:11.5px;line-height:1.5">Pick the kind of change you want to request. The Super Admin will review it before the official directory is updated.</div>' +
            '<button class="ug-btn ug-btn--signal" data-act="request-hotline-form" data-action="edit" data-id="' + UG_UTIL.esc(h.id) + '">' + UG.icon('settings', 14) + 'Edit this hotline</button>' +
            '<button class="ug-btn ug-btn--danger" data-act="request-hotline-form" data-action="delete" data-id="' + UG_UTIL.esc(h.id) + '">' + UG.icon('x', 14) + 'Request deletion of this hotline</button>' +
          '</div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button>'
      });
    },

    'request-hotline-form': (d) => {
      const action = d.action; // 'edit' or 'delete'
      const h = (UG.DATA.hotlines || []).find((x) => x.uuid === d.id || x.id === d.id);
      if (!h) return;
      hotlineRequestModal(action, h);
    },

    /* Super Admin: open the change request review modal */
    'open-change-request': (d) => {
      const r = (UG.DATA.changeRequests || []).find((x) => x.id === d.id);
      if (!r) return;
      const isSuper = isSuperAdmin();
      const isOwn = r.requester_id === (S.session && S.session.id);
      const esc = UG_UTIL.esc;
      const fmtData = (data) => {
        if (!data || typeof data !== 'object') return '—';
        const keys = Object.keys(data);
        if (!keys.length) return '—';
        return keys.map((k) => '<div class="ug-rowf ug-between" style="gap:8px;font-size:11.5px;padding:4px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;max-width:60%">' + esc(String(data[k] == null ? '—' : data[k])) + '</span></div>').join('');
      };
      const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;max-width:60%">' + esc(v == null || v === '' ? '—' : v) + '</span></div>';
      UG_FEATURES.modal({
        title: 'Change request · ' + r.action.toUpperCase(),
        body:
          kv('Submitted by', r.requester_name || '—') +
          kv('Role', r.requester_role || '—') +
          kv('Barangay', r.requester_barangay || '—') +
          kv('Target table', r.target_table) +
          (r.target_id ? kv('Target record id', r.target_id) : '') +
          kv('Action', r.action) +
          kv('Status', r.status) +
          kv('Submitted', UG_UTIL.absTime(r.created_at) || '') +
          (r.decided_at ? kv('Decided', UG_UTIL.absTime(r.decided_at) || '') : '') +
          (r.decision_note ? kv('Decision note', r.decision_note) : '') +
          (r.reason ? kv('Reason for request', r.reason) : '') +
          '<div style="margin-top:12px"><div class="ug-lab">Existing information</div>' + fmtData(r.current_data) + '</div>' +
          '<div style="margin-top:12px"><div class="ug-lab">Proposed information</div>' + fmtData(r.proposed_data) + '</div>',
        footer:
          '<button class="ug-btn" data-modal-close>Close</button>' +
          (isSuper && r.status === 'pending'
            ? '<button class="ug-btn ug-btn--danger" data-act="reject-change-request" data-id="' + esc(r.id) + '">' + UG.icon('x', 13) + 'Reject</button>' +
              '<button class="ug-btn ug-btn--signal" data-act="approve-change-request" data-id="' + esc(r.id) + '">' + UG.icon('check', 13) + 'Approve</button>'
            : isOwn && r.status === 'pending'
              ? '<span class="ug-dimmer" style="font-size:11px">Pending Super Admin review</span>'
              : '')
      });
    },

    'approve-change-request': async (d) => {
      if (!isSuperAdmin()) { toast('Only the Super Admin can approve a change request', 'warning'); return; }
      const r = (UG.DATA.changeRequests || []).find((x) => x.id === d.id);
      if (!r) return;
      const note = await UG_FEATURES.prompt({
        title: 'Approve ' + r.action + ' request',
        label: 'Decision note (optional, shown to the requester and in the audit log)',
        placeholder: 'e.g. Verified against the official BFP directory.'
      });
      if (note === null) return;
      try {
        await Repo.approveChangeRequest(r.id, note || '');
        toast('Request approved. The official record is updated and the requester has been notified.', 'prepared');
        if (Repo.loadChangeRequests) await Repo.loadChangeRequests();
        if (Repo.loadAll) await Repo.loadAll(); // refresh hotlines list
        render();
      } catch (e) { toast(e.message, 'warning'); }
    },

    'reject-change-request': async (d) => {
      if (!isSuperAdmin()) { toast('Only the Super Admin can reject a change request', 'warning'); return; }
      const r = (UG.DATA.changeRequests || []).find((x) => x.id === d.id);
      if (!r) return;
      const note = await UG_FEATURES.prompt({
        title: 'Reject ' + r.action + ' request',
        label: 'Reason (shown to the requester and in the audit log)',
        placeholder: 'e.g. Duplicate of an existing hotline.',
        required: true
      });
      if (note === null) return;
      if (!note || !note.trim()) { toast('A reason is required when rejecting a request', 'warning'); return; }
      try {
        await Repo.rejectChangeRequest(r.id, note || '');
        toast('Request rejected. The official record is unchanged; the requester has been notified.', 'warning');
        if (Repo.loadChangeRequests) await Repo.loadChangeRequests();
        render();
      } catch (e) { toast(e.message, 'warning'); }
    },

    'export-hotlines': () => UG_EXPORTS.run('export-hotlines'),

    'export-analytics': () => UG_EXPORTS.run('export-analytics'),

    /* Analytics exports (js/exports.js) read UG_SCREENS.analyticsModel, the same
       figures the screen draws, so the files always match what is shown. */
    'analytics-export-csv': () => UG_EXPORTS.run('analytics-export-csv'),

    declare: async () => {
      if (!requireRole(['lgu_ldrrmc'])) { toast(T('error.permission'), 'warning'); return; }
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
          barangayIds: (S.barangays || []).filter((b) => b.name === S.draft.area).map((b) => b.id),
          /* Module F: the alert type (weather advisory / evacuation order /
             road closure / general) and the language are carried through so
             the published list and the citizen inbox can render the right
             category icon and language label. */
          alert_type: S.draft.alertType || 'general',
          language: S.draft.lang || 'en',
          /* Module F: delivery preference — push (emergency) or in-app only
             (informational). Push is the default so existing behaviour is
             unchanged; selecting in-app skips the Web Push step entirely. */
          delivery_mode: S.draft.deliveryMode || 'push'
        });
        toast('Broadcast published to ' + S.draft.area + ' residents', 'prepared');
      } catch (e) {
        console.error('[UniGuard] publish advisory failed', e);
        /* a missing column / stale schema cache is a deploy problem, not the officer's */
        const m = String((e && e.message) || '');
        toast(/schema cache|column|relation|does not exist/i.test(m) ? T('error.advisoryNeedsUpdate') : m, 'warning');
      }
      render();
    },

    'clear-draft': () => {
      S.draft = { title: '', sev: 'warning', type: 'Emergency', area: UG_GEO.PLACE.areaAll, msg: '', lang: 'en', alertType: 'general', deliveryMode: 'push' };
      toast('Composer cleared', 'info');
      render();
    },

    /* Module F: alert type, severity level and language are chip-driven so
       the duty officer taps instead of typing. The template picker loads the
       matching category from the Settings module and fills the composer in
       the currently selected language. */
    'adv-alert-type': (d) => { S.draft.alertType = d.v; render(); },
    'adv-sev': (d) => { S.draft.sev = d.v; render(); },
    'adv-lang': (d) => { S.draft.lang = d.v; render(); },
    /* Module F: delivery preference — push (emergency) or in-app only
       (informational). Honoured by Repo.createAdvisory so the Web Push
       step is skipped when in-app only is selected. */
    'adv-delivery': (d) => { S.draft.deliveryMode = d.v; render(); },

    'adv-use-template': () => {
      if (typeof UG_SETTINGS === 'undefined') { toast('Templates are not available', 'warning'); return; }
      const cat = S.draft.alertType || 'general';
      const lang = S.draft.lang || 'en';
      const list = UG_SETTINGS.templatesByCategory(cat);
      /* if the chosen alert type has no templates yet, fall back to the full
         list so the duty officer is never stuck with an empty picker. */
      const pool = list.length ? list : UG_SETTINGS.loadTemplates();
      if (!pool.length) { toast('No templates yet — add some in Settings', 'warning'); return; }
      const titleKey = lang === 'fil' ? 'title_fil' : 'title_en';
      const bodyKey = lang === 'fil' ? 'body_fil' : 'body_en';
      UG_FEATURES.modal({
        title: 'Pick a template · ' + (lang === 'fil' ? 'Filipino' : 'English'),
        body: '<div class="ug-rows">' + pool.map((t) => {
          const title = t[titleKey] || t.title_en || t.title_fil || t.label;
          const body = t[bodyKey] || t.body_en || t.body_fil || '';
          const cat2 = UG_SETTINGS.CATEGORY[t.category] || { color: 'var(--ug-signal)', icon: 'megaphone' };
          return '<button class="ug-row ug-tpl-pick" style="cursor:pointer;text-align:left;width:100%;background:none;border:0;color:inherit"' + A('adv-apply-template', attr({ id: t.id })) + '>' +
            '<span class="r-dot" style="background:' + cat2.color + '"></span>' +
            '<div class="r-main"><div class="r-t" style="font-size:12.5px">' + esc(title) + '</div>' +
            '<div class="r-m ug-clamp2" style="font-size:11px;line-height:1.45">' + esc(body) + '</div></div>' +
            UG.icon('chevron', 14) + '</button>';
        }).join('') + '</div>',
        footer: '<button class="ug-btn" data-modal-close>Close</button>',
        onMount: () => {}
      });
    },

    'adv-apply-template': (d) => {
      if (typeof UG_SETTINGS === 'undefined') return;
      const t = UG_SETTINGS.templateById(d.id);
      if (!t) return;
      const lang = S.draft.lang || 'en';
      const titleKey = lang === 'fil' ? 'title_fil' : 'title_en';
      const bodyKey = lang === 'fil' ? 'body_fil' : 'body_en';
      S.draft.title = t[titleKey] || t.title_en || t.title_fil || t.label || '';
      S.draft.msg = t[bodyKey] || t.body_en || t.body_fil || '';
      /* if the template belongs to a category, sync the alert type too so the
         chip row reflects the template that was applied. */
      if (t.category) S.draft.alertType = t.category;
      /* close any open modal (the template picker) and re-render */
      document.querySelectorAll('.ug-modal').forEach((m) => m.remove());
      toast('Template applied — review and publish', 'prepared');
      render('advTitle');
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
      /* every tap marks the row read; a row with a link also opens it */
      const n = (UG.DATA.notifications || []).find((x) => x.id === d.id);
      if (n) n.unread = false;
      if (d.id) {
        Repo.markRead(d.id).catch(() => { });
        try { UG_NOTIF_STORE.markReadLocal(d.id); } catch (e) { }
      }
      const staff = S.role !== 'citizen';
      const open = (route, id) => { go(route); S.openId = id || null; render(); Promise.resolve(loadRouteData(route)).catch(() => { }); };
      if (d.report) {
        open(staff ? 'incident' : 'report-detail', d.report);
        loadDispatchesFor(d.report);
      } else if (d.advisory) {
        open('advisory-detail', d.advisory);
      } else if (d.roadWork) {
        open('roadwork', d.roadWork);
      } else if (d.relief) {
        open('relief', d.relief);
      } else if (d.sos) {
        /* staff: the SOS log, then that SOS's detail; resident: their SOS screen */
        go('sos'); render();
        if (staff) {
          try { UG.DATA.sosLog = await Repo.listSos(); } catch (e) { }
          render();
          if ((UG.DATA.sosLog || []).some((x) => x.id === d.sos)) UG_SOS.sosDetailModal(S, d.sos);
        }
      } else {
        render();
      }
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
      if (r.online && Auth.state.needsRevalidate) revalidateSession();
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

    /* PRIORITY 0 fix (Oct 24 2026): the dispatch console's sidebar and
       topbar both use data-act="logout", but APP_ACTIONS only registered
       "sign-out". So clicking Sign Out on the dispatch console silently
       no-op'd (the global click delegate found ALL["logout"] === undefined
       and returned). Alias "logout" to AUTH_ACTIONS.logout so both names
       work. */
    'logout': () => AUTH_ACTIONS.logout(),

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
        if (Auth.state.needsRevalidate) revalidateSession();
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

    /* "Reload app" (residents) / "Force Refresh" (staff): reloads the newest
       build. Reports and SOS waiting to send are kept (UG_PWA.forceRefresh
       never clears the queue); say so before reloading. */
    'force-refresh': async () => {
      const n = UG_PWA.state.queued || 0;
      if (n > 0) {
        const ok = await UG_FEATURES.confirm({
          title: T('offline.reloadApp'),
          message: T('offline.reloadKeepQueue').replace('{n}', n),
          confirmLabel: T('offline.reloadApp')
        });
        if (!ok) return;
      }
      toast(T('offline.reloading'), 'info');
      await UG_PWA.forceRefresh();
    },

    /* My Reports: a queued report the server kept refusing */
    'queue-retry': async () => {
      if (navigator.onLine === false) { toast(T('error.network'), 'warning'); return; }
      const sent = await UG_PWA.flushQueue({ retryFailed: true });
      await refreshQueuedList();
      toast(sent ? T('offline.queueSent') : T('offline.queueStillFailing'), sent ? 'prepared' : 'warning');
    },
    'queue-delete': async (d) => {
      const ok = await UG_FEATURES.confirm({
        title: T('offline.deleteQueuedTitle'),
        message: T('offline.deleteQueuedMsg'),
        confirmLabel: T('action.delete'),
        danger: true
      });
      if (!ok) return;
      await UG_PWA.removeFromQueue(Number(d.qid));
      await refreshQueuedList();
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
      } catch (e) { toast(e, 'warning'); }
      if (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.refreshPushState) UG_SETTINGS.refreshPushState();
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

    /* "Try Again" on the Users / Activity Log error panel */
    'admin-load': async () => { await loadRouteData(S.route); },

    'admin-create': async () => {
      if (!isSuperAdmin()) { toast('Only the Super Admin can create accounts', 'warning'); return; }

      let list = S.barangays || [];
      if (!list.length) { list = await Repo.listBarangays(); S.barangays = list; }
      const opts = list.map((b) =>
        '<option value="' + UG_UTIL.esc(b.id) + '">' + UG_UTIL.esc(b.name) + '</option>').join('');

      UG_FEATURES.modal({
        title: 'Create a barangay official',
        body:
          '<div class="ug-rowf ug-gap8" style="gap:8px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Last name</label>' +
            '<input class="ug-in" type="text" data-invite-last placeholder="Dela Cruz" autocomplete="off"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">First name</label>' +
            '<input class="ug-in" type="text" data-invite-first placeholder="Juan" autocomplete="off"></div>' +
          '</div>' +
          '<div class="ug-field"><label class="ug-lab">Email address</label>' +
          '<input class="ug-in" type="email" data-invite-email placeholder="official@lingayen.gov.ph"></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Barangay</label>' +
          '<select class="ug-sel" data-invite-brgy><option value="">Select a barangay</option>' + opts + '</select>' +
          '<div class="ug-help">This official will only see and manage reports from this barangay.</div></div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-send>Send Invitation</button>',
        onMount: (wrap, close) => {
          const nameEl = wrap.querySelector('[data-invite-last]');
          const firstEl = wrap.querySelector('[data-invite-first]');
          const emailEl = wrap.querySelector('[data-invite-email]');
          const brgyEl = wrap.querySelector('[data-invite-brgy]');
          const sendBtn = wrap.querySelector('[data-send]');
          setTimeout(() => nameEl.focus(), 30);

          sendBtn.addEventListener('click', async () => {
            const fullName = UG_UTIL.joinName(nameEl.value, firstEl.value);
            const email = emailEl.value.trim();
            const barangayId = brgyEl.value;
            if (!nameEl.value.trim() || !firstEl.value.trim()) { toast('Enter the official\'s last name and first name', 'warning'); return; }
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
      if (!isSuperAdmin()) { toast('Only the Super Admin can change roles', 'warning'); render(); return; }
      /* granting full administration is deliberate: confirm it */
      if (el.value === 'super_admin') {
        const u = (S.users || []).find((x) => x.id === d.id) || {};
        const ok = await UG_FEATURES.confirm({
          title: 'Make this account a Super Admin?',
          message: (u.full_name || u.email || 'This account') + ' will be able to create accounts, change roles, disable users and read the full activity log.',
          confirmLabel: 'Grant Super Admin'
        });
        if (!ok) { render(); return; }
      }
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
      if (!isSuperAdmin()) { toast('Only the Super Admin can create a dispatch unit and invite its admin', 'warning'); return; }
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
              /* 1. create the dispatch_units row (dedup: if a unit with this
                 name already exists, the RPC returns its id + already_exists=true
                 instead of creating a duplicate) */
              const c = Repo.client();
              if (!c) throw new Error('Connect Supabase first — dispatch units cannot be created without a database.');
              const { data: unitData, error: unitErr } = await c.rpc('create_dispatch_unit', {
                p_name: name, p_unit_type: type, p_contact_number: contact,
                p_address: address, p_lat: null, p_lng: null
              });
              if (unitErr) throw new Error(unitErr.message);
              const unitId = (unitData && unitData.id) || unitData;
              const alreadyExists = !!(unitData && unitData.already_exists);

              /* 2. invite the first unit_admin into the unit. This calls the
                 admin-users edge function, which calls Supabase Auth's
                 inviteUserByEmail. If the email doesn't arrive, the cause is
                 almost always one of:
                   a) the admin-users edge function isn't deployed — run
                      `supabase functions deploy admin-users`
                   b) the SUPABASE_SERVICE_ROLE_KEY secret isn't set on the
                      function — check Dashboard → Edge Functions → admin-users
                   c) Supabase Auth email sending is rate-limited or SMTP is
                      not configured — check Dashboard → Authentication →
                      Email Templates
                 The edge function returns its error in the body; the catch
                 block below surfaces it. */
              await Repo.adminUsers('create', {
                email: email, role: 'dispatch_team',
                unitId: unitId, unitRole: 'unit_admin'
              });

              toast((alreadyExists
                ? 'Unit "' + name + '" already exists. '
                : 'Unit "' + name + '" created. ')
                + 'Invitation sent to ' + email + '. '
                + 'If the email doesn\'t arrive within a few minutes, check the Edge Function is deployed and Auth email is configured.', 'prepared');
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

    /* Section 9: open a unit's full details. Shows team name, assigned unit,
       personnel, contact, status and other stored fields. Includes a
       "Manage Accounts" footer button so the Super Admin can deactivate or
       reactivate a member account. */
    'open-unit': (d) => {
      const unit = (UG.DATA.dispatchUnits || []).find((u) => u.id === d.id);
      if (!unit) { toast('That unit no longer exists', 'warning'); return; }
      const esc = UG_UTIL.esc;
      /* list of dispatch_team accounts that belong to this unit, if profiles
         have been loaded into S.users; otherwise fall back to an empty roster. */
      const members = (S.users || []).filter((u) => u.role === 'dispatch_team' && u.dispatch_unit_id === unit.id);
      const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;max-width:60%">' + esc(v == null || v === '' ? '—' : v) + '</span></div>';
      UG_FEATURES.modal({
        title: 'Dispatch unit · ' + unit.name,
        body:
          '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:12px">' +
            '<div class="ug-rowf ug-between" style="gap:10px;align-items:center">' +
              (unit.active ? UG.icon('shield', 18) : UG.icon('shieldx', 18)) +
              '<span class="ug-mono" style="font-size:11px;color:var(--ug-ink-3)">' + esc(unit.id) + '</span>' +
            '</div>' +
            (members.length ? '<div class="ug-col" style="gap:6px"><div class="ug-lab">Members (' + members.length + ')</div>' +
              members.slice(0, 5).map((m) => '<div class="ug-rowf ug-between" style="font-size:11.5px;gap:8px"><span>' + esc(m.full_name || m.email) + '</span>' +
                '<span class="ug-dim">' + esc(m.unit_role || 'member') + (m.disabled ? ' · disabled' : '') + '</span></div>').join('') +
              (members.length > 5 ? '<div class="ug-dimmer" style="font-size:11px">+' + (members.length - 5) + ' more</div>' : '') + '</div>' : '') +
          '</div></div>' +
          '<div style="margin-top:14px">' +
            kv('Unit name', unit.name) +
            kv('Unit type', unit.unit_type) +
            kv('Contact number', unit.contact_number) +
            kv('Address', unit.address) +
            kv('Status', unit.status) +
            kv('Active', unit.active ? 'Yes' : 'No') +
            (unit.created_at ? kv('Created', UG_UTIL.absTime(unit.created_at) || '') : '') +
            (unit.updated_at ? kv('Last updated', UG_UTIL.absTime(unit.updated_at) || '') : '') +
          '</div>',
        footer:
          '<button class="ug-btn" data-modal-close>Close</button>' +
          '<button class="ug-btn ug-btn--ghost" data-act="admin-unit-accounts" data-id="' + esc(unit.id) + '">' + UG.icon('users', 13) + 'Manage Accounts</button>' +
          '<button class="ug-btn ug-btn--signal" data-act="admin-edit-unit" data-id="' + esc(unit.id) + '">' + UG.icon('settings', 13) + 'Edit</button>'
      });
    },

    /* Section 9: Manage Accounts modal for a dispatch unit. Lists all members
       with their role + status, and lets the Super Admin deactivate or
       reactivate any member. Uses the existing admin-users edge function
       (action: 'set-disabled') so the change lands in the database, signs the
       user out, and writes an audit_log entry. */
    'admin-unit-accounts': async (d) => {
      const unit = (UG.DATA.dispatchUnits || []).find((u) => u.id === d.id);
      if (!unit) { toast('That unit no longer exists', 'warning'); return; }
      /* refresh S.users so the roster is current before opening the modal */
      try {
        if (Repo.client()) { S.users = await Repo.listUsers(); UG.DATA.users = S.users; }
      } catch (e) { /* fall back to the cached list */ }
      const members = (S.users || []).filter((u) => u.role === 'dispatch_team' && u.dispatch_unit_id === unit.id);
      const esc = UG_UTIL.esc;
      const memberRow = (m) => '<tr>' +
        '<td><div style="font-weight:600">' + esc(m.full_name || '(no name)') + '</div>' +
          '<div class="ug-dimmer" style="font-size:10.5px">' + esc(m.email || '') + '</div></td>' +
        '<td>' + esc(m.unit_role || 'member') + '</td>' +
        '<td>' + (m.disabled ? UG.icon('x', 13) + ' Disabled' : UG.icon('check', 13) + ' Active') + '</td>' +
        '<td class="t-right"><div class="ug-rowf ug-gap6" style="gap:6px;justify-content:flex-end">' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="admin-edit-account" data-id="' + esc(m.id) + '">Edit</button>' +
          (m.disabled
            ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="admin-disable" data-id="' + esc(m.id) + '" data-next="false">Enable</button>'
            : '<button class="ug-btn ug-btn--sm ug-btn--danger" data-act="admin-disable" data-id="' + esc(m.id) + '" data-next="true">Deactivate</button>') +
        '</div></td>' +
      '</tr>';
      UG_FEATURES.modal({
        title: 'Manage accounts · ' + unit.name,
        body:
          '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:10px">' +
            '<div class="ug-rowf ug-between" style="gap:8px;font-size:12px"><span class="ug-dim">Unit</span><span style="font-weight:600">' + esc(unit.name) + '</span></div>' +
            '<div class="ug-rowf ug-between" style="gap:8px;font-size:12px"><span class="ug-dim">Type</span><span>' + esc(unit.unit_type) + '</span></div>' +
            '<div class="ug-rowf ug-between" style="gap:8px;font-size:12px"><span class="ug-dim">Members</span><span class="ug-mono">' + members.length + '</span></div>' +
          '</div></div>' +
          '<div class="ug-card" style="overflow:hidden;margin-top:14px"><table class="ug-table">' +
            '<thead><tr><th>Account</th><th>Role</th><th>Status</th><th class="t-right">Action</th></tr></thead>' +
            '<tbody>' + (members.length ? members.map(memberRow).join('') :
              '<tr><td colspan="4" style="text-align:center;padding:20px">No members yet. Use "Invite member" below.</td></tr>') + '</tbody>' +
          '</table></div>' +
          '<div class="ug-help" style="margin-top:10px">Deactivating an account immediately signs the user out and prevents further sign-in. The account\'s history and related dispatch records are preserved — only access is revoked. The action is recorded in the centralized Activity Log.</div>',
        footer:
          '<button class="ug-btn" data-modal-close>Close</button>' +
          '<button class="ug-btn ug-btn--ghost" data-act="admin-invite-unit-member" data-unit-id="' + esc(unit.id) + '">' + UG.icon('plus', 13) + 'Invite member</button>'
      });
    },

    'unit-clear-search': () => { S.unitSearch = ''; render(); },
    'user-clear-search': () => { S.userSearch = ''; render(); },

    /* Section 9: edit an account profile (name, phone, email) — opens the
       existing profile editor. For Super Admin only. */
    'admin-edit-account': (d) => {
      const u = (S.users || []).find((x) => x.id === d.id);
      if (!u) { toast('That account no longer exists', 'warning'); return; }
      const esc = UG_UTIL.esc;
      const nm = UG_UTIL.splitName(u.full_name);
      UG_FEATURES.modal({
        title: 'Edit account · ' + (u.full_name || u.email),
        body:
          '<div class="ug-rowf ug-gap8" style="gap:8px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Last name</label><input class="ug-in" data-acc-last value="' + esc(nm.last) + '"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">First name</label><input class="ug-in" data-acc-first value="' + esc(nm.first) + '"></div>' +
          '</div>' +
          '<div class="ug-field"><label class="ug-lab">Email</label><input class="ug-in" type="email" data-acc-email value="' + esc(u.email || '') + '"></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Phone</label><input class="ug-in" data-acc-phone value="' + esc(u.phone || '') + '"></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-save>Save</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const last = wrap.querySelector('[data-acc-last]').value;
            const first = wrap.querySelector('[data-acc-first]').value;
            if (!last.trim() || !first.trim()) { toast('Enter the last name and first name', 'warning'); return; }
            const patch = {
              full_name: UG_UTIL.joinName(last, first),
              phone: wrap.querySelector('[data-acc-phone]').value.trim(),
              updated_at: new Date().toISOString()
            };
            try {
              const c = Repo.client();
              if (!c) { toast('Connect to the server to edit accounts', 'warning'); return; }
              const { error } = await c.from('profiles').update(patch).eq('id', u.id);
              if (error) throw new Error(error.message);
              toast('Account updated and logged to the audit trail', 'prepared');
              try { S.users = await Repo.listUsers(); UG.DATA.users = S.users; } catch (e) {}
              close();
              render();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },
    /* ----------------------------------------- edit a dispatch unit (LGU / unit_admin) */
    /* 050 (Oct 25 2026) — manage a unit's equipment (LGU). Opens a modal
       that lists the unit's equipment with Add / Edit / Retire / Remove
       buttons. The actual modal logic + RPC calls are reused from
       UG_DISPATCH (openAddEquipmentModal / openEditEquipmentModal /
       openRemoveEquipmentModal). */
    'admin-unit-equipment': (d) => {
      const unit = (UG.DATA.dispatchUnits || []).find((u) => u.id === d.id);
      if (!unit) { toast('That unit no longer exists', 'warning'); return; }
      if (!Repo.client()) { toast('No connection to the server. Reconnect and try again.', 'warning'); return; }
      /* Refresh the dispatch directory so UG.DATA.dispatchEquipment is
         up to date before opening the modal. */
      Repo.loadDispatchDirectory().then(() => {
        /* UG_FEATURES is a top-level const, which is never a window property:
           `window.UG_FEATURES` was always undefined, so this pop-up never opened */
        if (typeof UG_FEATURES !== 'undefined' && UG_FEATURES.modal) {
          UG_FEATURES.modal({
            title: 'Equipment · ' + (d.unitName || unit.name || ''),
            body: '<div data-unit-equipment-list data-unit-id="' + UG_UTIL.esc(unit.id) + '" data-unit-type="' + UG_UTIL.esc(unit.unit_type) + '">Loading…</div>',
            footer: '<button class="ug-btn" data-modal-close>Close</button>' +
                    '<button class="ug-btn ug-btn--signal" data-unit-equipment-add data-unit-id="' + UG_UTIL.esc(unit.id) + '" data-unit-type="' + UG_UTIL.esc(unit.unit_type) + '">' + UG.icon('plus', 14) + 'Add equipment</button>',
            onMount: (wrap, close) => {
              const listEl = wrap.querySelector('[data-unit-equipment-list]');
              const refresh = () => {
                const unitId = listEl.getAttribute('data-unit-id');
                const unitType = listEl.getAttribute('data-unit-type');
                const rows = (UG.DATA.dispatchEquipment || []).filter((e) => e.owner_unit_id === unitId);
                if (!rows.length) {
                  listEl.innerHTML = '<div class="ug-note">No equipment yet for this unit. Use "Add equipment" to register a piece.</div>';
                  return;
                }
                const catalog = UG.DATA.equipmentCatalog || [];
                const rowHtml = rows.map((r) => {
                  const c = catalog.find((x) => x.id === r.catalog_id);
                  const label = c ? c.label : (r.custom_label || r.identifier || 'Equipment');
                  return '<tr>' +
                    '<td><div style="font-weight:600">' + UG_UTIL.esc(r.identifier || label) + '</div>' +
                      '<div class="ug-dimmer" style="font-size:10.5px">' + UG_UTIL.esc(r.notes || '') + '</div></td>' +
                    '<td>' + UG_UTIL.esc(label) + '</td>' +
                    '<td>' + UG_UTIL.esc((typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.statusLabel ? UG_DISPATCH.statusLabel(r.status) : r.status)) + '</td>' +
                    '<td>' + UG_UTIL.esc((typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.conditionLabel ? UG_DISPATCH.conditionLabel(r.condition) : r.condition)) + '</td>' +
                    '<td class="t-right"><div class="ug-rowf ug-gap6" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
                      '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="equipment-edit" data-id="' + UG_UTIL.esc(r.id) + '">Edit</button>' +
                      '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="equipment-remove" data-id="' + UG_UTIL.esc(r.id) + '">' + (r.status === 'unavailable' ? 'Remove' : 'Retire / remove') + '</button>' +
                    '</div></td>' +
                  '</tr>';
                }).join('');
                listEl.innerHTML = '<div class="ug-card" style="overflow:hidden;margin:0"><table class="ug-table">' +
                  '<thead><tr><th>Equipment</th><th>Type</th><th>Status</th><th>Condition</th><th class="t-right">Action</th></tr></thead>' +
                  '<tbody>' + rowHtml + '</tbody></table></div>';
              };
              refresh();
              /* Fix (Oct 28 2026): Edit / Retire / Remove inside this list
                 reloaded the data but never redrew the list, so it showed
                 the old values until the modal was reopened. The shared
                 equipment modals fire ug:equipment-changed after a save. */
              const onEqChange = () => { if (listEl.isConnected) refresh(); else window.removeEventListener('ug:equipment-changed', onEqChange); };
              window.addEventListener('ug:equipment-changed', onEqChange);
              /* Add button: open the same Add modal as the dispatch_team
                 console, but with the LGU's owner_unit_id. The UG_DISPATCH
                 openAddEquipmentModal reads opts.ownerUnitId. */
              wrap.querySelector('[data-unit-equipment-add]').addEventListener('click', () => {
                if (typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.openAddEquipmentModal) {
                  UG_DISPATCH.openAddEquipmentModal({
                    ownerUnitId: unit.id,
                    ownerBarangayId: null,
                    unitType: unit.unit_type,
                    onSaved: async function () {
                      try { await Repo.loadDispatchDirectory(); } catch (e) {}
                      refresh();
                    }
                  });
                } else {
                  toast('Equipment module not loaded. Reload the page.', 'warning');
                }
              });
            }
          });
        }
      }).catch(() => { toast('Could not load the equipment list. Try again.', 'warning'); });
    },

    /* NOTE (Oct 28 2026): ALL merges UG_DISPATCH.actions after these, so
       equipment-add / equipment-edit / equipment-remove below are shadowed
       by the js/dispatch.js versions, which now handle the barangay and LGU
       paths too. Kept only as a fallback if dispatch.js is missing.

       050 (Oct 25 2026) — equipment actions shared by the dispatch console,
       the barangay Response Team screen, and the LGU's per-unit modal. The
       dispatch_team console defines its own (in UG_DISPATCH.actions) for the
       unit_admin path; these app.js versions serve the barangay_official
       and LGU paths (their data-act buttons live in screens.admin.js). */
    'equipment-add': (d) => {
      /* The data-act button carries the owner via data-owner-brgy or
         data-owner-unit. For the barangay_official it's data-owner-brgy;
         for the LGU's per-unit modal it's the per-unit Add button which
         calls UG_DISPATCH.openAddEquipmentModal directly (not this action).
         So this action's main job is the barangay path. */
      if (typeof UG_DISPATCH === 'undefined' || !UG_DISPATCH.openAddEquipmentModal) {
        toast('Equipment module not loaded. Reload the page.', 'warning');
        return;
      }
      const ownerBrgy = d.ownerBrgy || null;
      const ownerUnit = d.ownerUnit || null;
      if (ownerBrgy) {
        /* barangay path */
        UG_DISPATCH.openAddEquipmentModal({
          ownerUnitId: null,
          ownerBarangayId: ownerBrgy,
          unitType: 'Barangay',
          onSaved: async function () {
            try { await Repo.loadDispatchDirectory(); } catch (e) {}
            if (typeof render === 'function') render();
          }
        });
      } else if (ownerUnit) {
        /* unit path (LGU clicking the per-unit Add button falls through
           to UG_DISPATCH.openAddEquipmentModal directly via onMount, so
           this branch is a fallback) */
        UG_DISPATCH.openAddEquipmentModal({
          ownerUnitId: ownerUnit,
          ownerBarangayId: null,
          unitType: d.unitType || null,
          onSaved: async function () {
            try { await Repo.loadDispatchDirectory(); } catch (e) {}
            if (typeof render === 'function') render();
          }
        });
      } else {
        toast('Could not determine the owner. Reload the page and try again.', 'warning');
      }
    },
    'equipment-edit': (d) => {
      if (typeof UG_DISPATCH === 'undefined' || !UG_DISPATCH.openEditEquipmentModal) {
        toast('Equipment module not loaded. Reload the page.', 'warning');
        return;
      }
      UG_DISPATCH.openEditEquipmentModal(d.id, {
        onSaved: async function () {
          try { await Repo.loadDispatchDirectory(); } catch (e) {}
          if (typeof render === 'function') render();
        }
      });
    },
    'equipment-remove': (d) => {
      if (typeof UG_DISPATCH === 'undefined' || !UG_DISPATCH.openRemoveEquipmentModal) {
        toast('Equipment module not loaded. Reload the page.', 'warning');
        return;
      }
      UG_DISPATCH.openRemoveEquipmentModal(d.id, {
        onSaved: async function () {
          try { await Repo.loadDispatchDirectory(); } catch (e) {}
          if (typeof render === 'function') render();
        }
      });
    },

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

    /* ------------------------------------------- delete a dispatch unit (Super Admin) */
    'admin-delete-unit': async (d) => {
      if (!isSuperAdmin()) { toast('Only the Super Admin can delete a dispatch unit', 'warning'); return; }
      const unit = (UG.DATA.dispatchUnits || []).find((u) => u.id === d.id);
      if (!unit) { toast('That unit no longer exists', 'warning'); return; }
      const ok = await UG_FEATURES.confirm({
        title: 'Delete this dispatch unit?',
        message: 'Unit "' + unit.name + '" will be permanently removed. Personnel and equipment records stay, but the unit can no longer be dispatched to. This cannot be undone.',
        danger: true,
        confirmLabel: 'Delete'
      });
      if (!ok) return;
      try {
        const c = Repo.client();
        if (!c) { throw new Error('Connect Supabase first — units cannot be deleted without a database.'); }
        /* try the RPC first (preferred: server-side re-checks the caller);
           fall back to a direct delete if the RPC is not deployed yet. */
        let err = null;
        try {
          const { error } = await c.rpc('delete_dispatch_unit', { p_unit_id: d.id });
          if (error && !/Could not find|does not exist|P0001|42883/i.test(error.message)) err = error;
        } catch (e) { /* fall through to direct delete */ }
        if (!err) {
          /* the RPC may have done a soft delete (active=false). A direct
             delete is also safe: RLS restricts it to Super Admin anyway. */
          const { error: e2 } = await c.from('dispatch_units').delete().eq('id', d.id);
          if (e2 && !/no rows/i.test(e2.message)) err = e2;
        }
        if (err) throw new Error(err.message);
        toast('Unit deleted', 'prepared');
        try { await Repo.loadDispatchDirectory(); } catch (e) {}
        render();
      } catch (e) { toast(e.message || 'Could not delete the unit', 'warning'); }
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
      /* Disable both decision buttons while in flight so the LGU user
         cannot double-click Approve + Decline (or click Approve twice
         and produce two notifications). The LGU screen is rendered by
         js/screens.admin.js dispatchUnits(); we re-enable on the next
         render. We do not need a per-button disabled flag — the buttons
         only exist for status === 'pending', and the row leaves that
         state once the RPC succeeds. */
      try {
        const c = Repo.client();
        if (!c) { toast('No connection to the server. Reconnect and try again.', 'warning'); return; }
        const { error } = await c.rpc('decide_unit_request', {
          p_request_id: d.id, p_decision: d.decision, p_note: ''
        });
        if (error) throw new Error(error.message);
        toast('Request ' + d.decision, 'prepared');
        try { await Repo.loadDispatchDirectory(); } catch (e) {}
        render();
      } catch (e) { toast(e.message || ('Could not ' + d.decision + ' the request'), 'warning'); }
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

    'admin-export-users': () => UG_EXPORTS.run('admin-export-users'),

    'admin-export-audit': () => UG_EXPORTS.run('admin-export-audit'),

    'audit-clear': () => {
      S.auditQ = ''; S.auditEntity = 'All'; S.auditActor = 'All';
      S.auditRole = 'All'; S.auditAction = 'All'; S.auditBarangay = 'All';
      S.auditFrom = ''; S.auditTo = ''; S.auditPage = 1;
      render();
    },

    'open-audit': (d) => {
      const a = (S.audit || []).find((x) => x.id === d.id);
      if (!a) return;
      const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + UG_UTIL.esc(k) + '</span><span style="text-align:right;max-width:60%">' + UG_UTIL.esc(v) + '</span></div>';
      const roleLabel = (r) => {
        const map = { citizen: 'Citizen', barangay_official: 'Barangay Official', lgu_ldrrmc: 'LDRRMO Staff', super_admin: 'Super Admin', dispatch_team: 'Dispatch Team' };
        return map[r] || (r ? r.replace(/_/g, ' ') : 'System');
      };
      let changed = '';
      try {
        const m = a.meta || {};
        if (m.changed) {
          changed = Object.keys(m.changed).map((k) =>
            '<div style="font-size:11.5px;padding:6px 0;border-bottom:1px solid var(--ug-line)"><b>' + UG_UTIL.esc(k) + '</b>: ' +
            UG_UTIL.esc(String(m.changed[k].from)) + ' → ' + UG_UTIL.esc(String(m.changed[k].to)) + '</div>').join('');
        }
      } catch (e) { changed = ''; }
      /* "Open this record" deep-link: routes the user to the matching module
         and opens the affected record's own detail view. Only shown when the
         entity maps to a record type the app can open. */
      const entityToRoute = (entity) => ({
        reports: 'incidents', emergency_hotlines: 'hotlines', evacuation_centers: 'centers',
        road_status: 'roadwork', road_work_posts: 'roadwork', advisories: 'advisories',
        faqs: 'faqs', preparedness_guides: 'guides', sos_log: 'sos', profiles: 'users',
        dispatch_units: 'dispatch-units', change_requests: 'hotlines',
        relief_inventory: 'relief', relief_distribution_log: 'relief'
      })[entity] || null;
      const route = entityToRoute(a.entity || '');
      const openRecordBtn = (route && a.entity_id)
        ? '<button class="ug-btn ug-btn--signal" data-act="audit-open-record" data-route="' + UG_UTIL.esc(route) + '" data-id="' + UG_UTIL.esc(a.entity_id) + '" data-entity="' + UG_UTIL.esc(a.entity || '') + '">' + UG.icon('doc', 13) + 'Open this record</button>'
        : '';
      UG_FEATURES.modal({
        title: 'Activity entry',
        body:
          kv('When', UG_UTIL.absTime(a.created_at) || '') +
          kv('Actor', a.actor_name || (a.actor_id ? String(a.actor_id).slice(0, 8) : 'system')) +
          kv('Role', roleLabel(a.actor_role === 'super_admin' ? 'super_admin' : a.actor_role)) +
          kv('Barangay', a.actor_barangay || '—') +
          kv('Module', UG_ADMIN.entityLabel(a.entity || '')) +
          kv('Action', a.action || '') +
          kv('Entity', a.entity || '') +
          kv('Entity id', a.entity_id || '') +
          (changed ? '<div style="margin-top:10px"><div class="ug-lab">Changed fields (previous → new)</div>' + changed + '</div>' : '') +
          (a.meta && !changed ? '<div style="margin-top:10px"><div class="ug-lab">Detail</div><pre class="ug-note" style="white-space:pre-wrap">' + UG_UTIL.esc(JSON.stringify(a.meta, null, 2)) + '</pre></div>' : ''),
        footer:
          '<button class="ug-btn" data-modal-close>Close</button>' +
          openRecordBtn
      });
    },

    /* deep-link from Activity Log → affected record's own detail view */
    'audit-open-record': (d) => {
      const route = d.route, id = d.id, entity = d.entity;
      /* navigate first, then open the detail modal on the next render */
      S.route = route;
      /* store a pending open-id so the screen-specific render can pick it up */
      S.pendingOpenId = id;
      S.pendingOpenEntity = entity;
      render();
      /* the per-entity open action */
      const openAct = {
        reports: 'open-incident',
        emergency_hotlines: 'open-hotline-detail',
        evacuation_centers: 'center-detail',
        road_status: 'rs-detail',
        advisories: 'open-advisory',
        dispatch_units: 'open-unit',
        relief_inventory: 'inv-detail',
        change_requests: 'open-change-request'
      }[entity];
      if (openAct && ALL[openAct]) {
        setTimeout(() => ALL[openAct]({ id: id }), 60);
      }
    },

    'audit-page': (d) => { S.auditPage = parseInt(d.p, 10) || 1; render(); },

    /* both run from the SOS detail pop-up; reload the log afterwards so the
       status badge in the list is current */
    'sos-ack': async (d) => {
      try { await Repo.updateSosStatus(d.id, 'acknowledged'); toast('SOS acknowledged — the sender has been notified', 'prepared'); }
      catch (e) { toast(e.message, 'warning'); }
      try { if (Repo.client()) UG.DATA.sosLog = await Repo.listSos(); } catch (e) { }
      render();
    },

    'sos-resolve': async (d) => {
      try { await Repo.updateSosStatus(d.id, 'resolved'); toast('SOS marked resolved', 'prepared'); }
      catch (e) { toast(e.message, 'warning'); }
      try { if (Repo.client()) UG.DATA.sosLog = await Repo.listSos(); } catch (e) { }
      render();
    },

    /* Priority Sort: toggles the incident queue between newest-first and
       severity → corroboration → recency. */
    'sort-toggle': () => {
      S.incidentSort = (S.incidentSort === 'priority') ? 'default' : 'priority';
      render();
    },

    'shelter-scope': (d) => { S.shelterScope = d.v || 'all'; render(); },
    'shelter-clear-search': () => { S.shelterSearch = ''; render(); },

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

    /* ----------------------------- A1 / A2 / B4 / D2 / D3 (dispatch team features) */

    /* A1: decline a dispatch. Reason required. Available on the dispatch card
       on the Response Team screen and on the dispatch console. */
    'dispatch-decline': async (d) => {
      const res = await UG_FEATURES.prompt({
        title: 'Decline this dispatch',
        label: 'Reason (required)', placeholder: 'e.g. No available responders, equipment failure',
        required: true, requiredMessage: 'A reason is required to decline.'
      });
      if (!res) return;
      const reason = String(res || '').trim();
      if (!reason) { toast('A reason is required', 'warning'); return; }
      try {
        const c = Repo.client && Repo.client();
        if (!c) { toast('Offline — cannot decline now', 'warning'); return; }
        const { error } = await c.rpc('decline_dispatch', {
          p_dispatch_id: d.id, p_reason: reason
        });
        if (error) throw error;
        toast('Dispatch declined — the dispatcher has been notified', 'prepared');
        /* declining the last active team returns the report to verified (051) */
        try { await Repo.loadAll(); } catch (e) {}
        if (d.reportId) { try { await Repo.loadDispatches(d.reportId); } catch (e) {} }
        render();
      } catch (e) { toast(e.message || 'Could not decline', 'warning'); }
    },

    /* A2: open the help-request composer for this dispatch. */
    'dispatch-help-new': (d) => {
      const kindOpts = ['general','water_tanker','extra_personnel','beyond_capacity']
        .map((k) => '<option value="' + k + '">' + k + '</option>').join('');
      UG_FEATURES.modal({
        title: 'Request help on this dispatch',
        body: '<div class="ug-field"><label class="ug-lab">Kind</label>' +
            '<select class="ug-sel" data-hr-kind>' + kindOpts + '</select></div>' +
          '<div class="ug-field"><label class="ug-lab">Message</label>' +
            '<textarea class="ug-ta" rows="3" data-hr-msg placeholder="What do you need?"></textarea></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-hr-send>Send</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-hr-send]').addEventListener('click', async () => {
            const kind = wrap.querySelector('[data-hr-kind]').value;
            const msg = wrap.querySelector('[data-hr-msg]').value.trim();
            if (!msg) { toast('Write a short message', 'warning'); return; }
            try {
              const c = Repo.client && Repo.client();
              if (!c) { toast('Offline', 'warning'); return; }
              const { error } = await c.rpc('create_help_request', {
                p_dispatch_id: d.id, p_kind: kind, p_message: msg
              });
              if (error) throw error;
              toast('Help request sent to the LGU', 'prepared');
              close();
              if (d.reportId) { try { await Repo.loadDispatches(d.reportId); } catch (e) {} }
              render();
            } catch (e) { toast(e.message || 'Could not send', 'warning'); }
          });
        }
      });
    },

    /* B4: "Beyond our capacity" — opens a menu with two choices:
       (a) re-dispatch BFP / PNP / Rescue Unit for the same incident (the
           existing dispatch form pre-filled), or (b) create a help request
           of kind 'beyond_capacity' to the LGU. */
    'dispatch-beyond-capacity': (d) => {
      const inc = (UG.DATA.incidents || []).find((i) => (i.uuid || i.id) === d.reportId || i.id === d.reportId);
      UG_FEATURES.modal({
        title: 'Beyond our capacity',
        body: '<div class="ug-col" style="gap:10px">' +
          '<div class="ug-note">Choose how to escalate this dispatch.</div>' +
          '<button class="ug-btn ug-btn--signal" data-bc-dispatch="' + (inc ? UG_UTIL.esc(inc.uuid || inc.id) : '') + '">Re-dispatch another team</button>' +
          '<button class="ug-btn ug-btn--ghost" data-bc-help>Send Need Help to the LGU</button>' +
        '</div>',
        footer: '<button class="ug-btn" data-modal-close>Close</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-bc-dispatch]').addEventListener('click', () => {
            close();
            if (!inc) { toast('Could not find the incident', 'warning'); return; }
            dispatchModal(inc);
          });
          wrap.querySelector('[data-bc-help]').addEventListener('click', async () => {
            close();
            try {
              const c = Repo.client && Repo.client();
              if (!c) { toast('Offline', 'warning'); return; }
              const { error } = await c.rpc('create_help_request', {
                p_dispatch_id: d.id, p_kind: 'beyond_capacity',
                p_message: 'Beyond our capacity — please send additional help.'
              });
              if (error) throw error;
              toast('Need Help sent to the LGU', 'prepared');
              if (d.reportId) { try { await Repo.loadDispatches(d.reportId); } catch (e) {} }
              render();
            } catch (e) { toast(e.message || 'Could not send', 'warning'); }
          });
        }
      });
    },

    /* D2: toggle needs_patrol on an evacuation center. The LGU and the
       barangay's officials are already writers through RLS; this just
       flips the boolean. */
    'center-toggle-patrol': async (d) => {
      const c = (UG.DATA.centers || []).find((x) => (x.uuid || x.id) === d.id || x.id === d.id);
      if (!c) return;
      try {
        await Repo.updateCenter(c.uuid || c.id, {
          needs_patrol: !c.needs_patrol,
          needs_patrol_at: !c.needs_patrol ? new Date().toISOString() : null
        });
        toast(c.needs_patrol ? 'Patrol request cleared' : 'Marked as needing patrol', 'prepared');
      } catch (e) { toast(e.message, 'warning'); }
    },

    /* D3: request / confirm a relief escort. */
    'relief-escort-request': async (d) => {
      const res = await UG_FEATURES.prompt({
        title: 'Request a PNP escort for this distribution',
        label: 'Note', placeholder: 'Convoy size, route, schedule'
      });
      if (!res) return;
      try {
        const c = Repo.client && Repo.client();
        if (!c) { toast('Offline', 'warning'); return; }
        const { error } = await c.rpc('request_relief_escort', {
          p_distribution_id: d.id, p_note: String(res || '')
        });
        if (error) throw error;
        toast('Escort requested from the PNP', 'prepared');
        render();
      } catch (e) { toast(e.message || 'Could not request', 'warning'); }
    },
    'relief-escort-confirm': async (d) => {
      try {
        const c = Repo.client && Repo.client();
        if (!c) { toast('Offline', 'warning'); return; }
        const { error } = await c.rpc('confirm_relief_escort', { p_distribution_id: d.id });
        if (error) throw error;
        toast('Escort confirmed', 'prepared');
        render();
      } catch (e) { toast(e.message || 'Could not confirm', 'warning'); }
    },

    /* A2 LGU console: update a help request status forward-only. */
    'help-request-update': async (d) => {
      try {
        const c = Repo.client && Repo.client();
        if (!c) { toast('Offline', 'warning'); return; }
        const { error } = await c.rpc('update_help_request', {
          p_id: d.id, p_status: d.next
        });
        if (error) throw error;
        toast('Help request ' + d.next, 'prepared');
        render();
      } catch (e) { toast(e.message || 'Could not update', 'warning'); }
    },

    /* D1: post a road closure from a PNP dispatch (opens a small form). */
    'dispatch-road-closure': (d) => {
      UG_FEATURES.modal({
        title: 'Post a road closure from this dispatch',
        body:
          '<div class="ug-field"><label class="ug-lab">Road name</label>' +
            '<input class="ug-in" data-rc-road placeholder="e.g. Rizal St"></div>' +
          '<div class="ug-field"><label class="ug-lab">Diversion route / note</label>' +
            '<textarea class="ug-ta" rows="2" data-rc-note placeholder="Detour via Mabini St, two lanes blocked"></textarea></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">From</label><input class="ug-in" data-rc-from placeholder="Purok 1"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">To</label><input class="ug-in" data-rc-to placeholder="Highway junction"></div>' +
          '</div>' +
          '<div class="ug-field"><label class="ug-lab">Estimated reopen (optional)</label>' +
            '<input class="ug-in" type="datetime-local" data-rc-eta></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-rc-save>Post closure</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-rc-save]').addEventListener('click', async () => {
            const road = wrap.querySelector('[data-rc-road]').value.trim();
            const note = wrap.querySelector('[data-rc-note]').value.trim();
            if (!road) { toast('A road name is required', 'warning'); return; }
            const segFrom = wrap.querySelector('[data-rc-from]').value.trim();
            const segTo = wrap.querySelector('[data-rc-to]').value.trim();
            const etaVal = wrap.querySelector('[data-rc-eta]').value;
            const eta = etaVal ? new Date(etaVal).toISOString() : null;
            try {
              const c = Repo.client && Repo.client();
              if (!c) { toast('Offline', 'warning'); return; }
              const { error } = await c.rpc('post_road_closure', {
                p_dispatch_id: d.id,
                p_road_name: road,
                p_note: note,
                p_lat: null, p_lng: null,
                p_segment_from: segFrom, p_segment_to: segTo,
                p_estimated_reopen: eta
              });
              if (error) throw error;
              toast('Road closure posted', 'prepared');
              close();
              render();
            } catch (e) { toast(e.message || 'Could not post', 'warning'); }
          });
        }
      });
    },
    'dispatch-road-reopen': async (d) => {
      try {
        const c = Repo.client && Repo.client();
        if (!c) { toast('Offline', 'warning'); return; }
        const { error } = await c.rpc('reopen_road_closure', { p_dispatch_id: d.id });
        if (error) throw error;
        toast('Road reopened', 'prepared');
        render();
      } catch (e) { toast(e.message || 'Could not reopen', 'warning'); }
    },

    /* -------------------------------------------- relief / guides / faqs / roadwork / sos */
    'relief-filter': (d) => { S.reliefFilter = d.v; render(); },
    'relief-verify': (d) => { S.openId = d.id; S.route = 'relief-verify'; render(); },
    'report-status-filter': (d) => { S.reportStatusFilter = d.v; render(); },

    /* Relief exports (js/exports.js): the schedule list or the authorized
       beneficiaries, exactly the rows on screen after the barangay filter and
       search (UG_RELIEF.visibleSchedules / visibleBeneficiaries). */
    'relief-download': (d) => UG_EXPORTS.run('relief-download:' + ((d && d.what) === 'distributions' ? 'distributions' : 'beneficiaries')),

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
      /* FULL edit modal — not just a single prompt for the title. The duty
         officer can change every field the data model exposes: title,
         description, location_name, address, contact person + phone,
         distribution_at, eligibility list, required_docs list, note, active. */
      const r = (UG.DATA.relief || []).find((x) => x.id === d.id);
      if (!r) { toast('That distribution no longer exists', 'warning'); return; }
      const esc = UG_UTIL.esc;
      const mine = (S.session && S.session.role === 'barangay_official') ? S.session.barangay : null;
      const barangays = mine ? [mine] : (S.barangays || []).map((b) => b.name);
      const brgyOpts = barangays.map((b) => '<option' + (r.barangay === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('');
      const toList = (arr) => (arr || []).join('\n');
      const fmtInput = (iso) => {
        if (!iso) return '';
        const t = Date.parse(iso); if (isNaN(t)) return '';
        const d = new Date(t);
        const pad = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      };
      UG_FEATURES.modal({
        title: 'Edit distribution · ' + (r.title || ''),
        body:
          '<div class="ug-field"><label class="ug-lab">Title</label>' +
            '<input class="ug-in" data-re-title value="' + esc(r.title || '') + '"></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Barangay</label>' +
              '<select class="ug-sel" data-re-barangay>' + brgyOpts + '</select></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Distribution at</label>' +
              '<input class="ug-in" type="datetime-local" data-re-when value="' + esc(fmtInput(r.distribution_at)) + '"></div>' +
          '</div>' +
          '<div class="ug-field"><label class="ug-lab">Location name</label>' +
            '<input class="ug-in" data-re-loc value="' + esc(r.location_name || '') + '"></div>' +
          '<div class="ug-field"><label class="ug-lab">Address</label>' +
            '<input class="ug-in" data-re-address value="' + esc(r.address || '') + '"></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Contact person</label>' +
              '<input class="ug-in" data-re-cp value="' + esc(r.contact_person || '') + '"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Contact phone</label>' +
              '<input class="ug-in" data-re-cphone value="' + esc(r.contact_phone || '') + '"></div>' +
          '</div>' +
          '<div class="ug-field"><label class="ug-lab">Eligibility (one per line)</label>' +
            '<textarea class="ug-ta" rows="3" data-re-elig>' + esc(toList(r.eligibility)) + '</textarea></div>' +
          '<div class="ug-field"><label class="ug-lab">Required documents (one per line)</label>' +
            '<textarea class="ug-ta" rows="3" data-re-docs>' + esc(toList(r.required_docs)) + '</textarea></div>' +
          '<div class="ug-field"><label class="ug-lab">Note</label>' +
            '<textarea class="ug-ta" rows="2" data-re-note>' + esc(r.note || '') + '</textarea></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Active</label>' +
            '<select class="ug-sel" data-re-active><option value="true"' + (r.active !== false ? ' selected' : '') + '>Active</option>' +
              '<option value="false"' + (r.active === false ? ' selected' : '') + '>Inactive</option></select></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-re-save>Save</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-re-save]').addEventListener('click', async () => {
            const patch = {
              title: wrap.querySelector('[data-re-title]').value.trim() || r.title,
              barangay: wrap.querySelector('[data-re-barangay]').value,
              location_name: wrap.querySelector('[data-re-loc]').value.trim(),
              address: wrap.querySelector('[data-re-address]').value.trim(),
              contact_person: wrap.querySelector('[data-re-cp]').value.trim(),
              contact_phone: wrap.querySelector('[data-re-cphone]').value.trim(),
              eligibility: wrap.querySelector('[data-re-elig]').value.split('\n').map((s) => s.trim()).filter(Boolean),
              required_docs: wrap.querySelector('[data-re-docs]').value.split('\n').map((s) => s.trim()).filter(Boolean),
              note: wrap.querySelector('[data-re-note]').value.trim(),
              active: wrap.querySelector('[data-re-active]').value === 'true'
            };
            const whenVal = wrap.querySelector('[data-re-when]').value;
            if (whenVal) {
              const t = Date.parse(whenVal);
              if (!isNaN(t)) patch.distribution_at = new Date(t).toISOString();
            }
            try {
              await Repo.updateRelief(d.id, patch);
              toast('Distribution updated', 'prepared');
              close(); render();
            } catch (e) { toast(e.message || 'Could not update', 'warning'); }
          });
        }
      });
    },
    /* "View" on Active Distributions: the full record in a pop-up
       (UG_RELIEF.distDetailModal), with Verify / Edit for staff */
    'relief-view': (d) => {
      if (!UG_RELIEF.distDetailModal(d.id, S)) toast('That distribution no longer exists', 'warning');
    },
    /* one form for the whole record (it used to be three pop-ups in a row,
       one field each, with the category fixed to "Affected household") */
    'beneficiary-add': () => {
      const esc = UG_UTIL.esc;
      const isBO = !!(S.session && S.session.role === 'barangay_official');
      const cats = ['Affected household', 'Senior citizen', 'PWD (authorized rep)', 'Coastal household', 'Solo parent', 'Pregnant / lactating', 'Indigenous family', 'Other'];
      const brgyField = isBO
        ? '<div class="ug-field"><label class="ug-lab">Barangay</label><input class="ug-in" value="' + esc(myBrgyName()) + '" disabled></div>'
        : '<div class="ug-field"><label class="ug-lab">Barangay</label><select class="ug-sel" data-ben-brgy><option value="">Select a barangay</option>' +
          (S.barangays || []).map((b) => '<option>' + esc(b.name) + '</option>').join('') + '</select></div>';
      UG_FEATURES.modal({
        title: 'Add authorized beneficiary',
        body:
          '<div class="ug-field"><label class="ug-lab">Beneficiary name</label><input class="ug-in" data-ben-name placeholder="Last, First" autocomplete="off"></div>' +
          '<div class="ug-field"><label class="ug-lab">Category</label><select class="ug-sel" data-ben-cat>' + cats.map((c) => '<option>' + esc(c) + '</option>').join('') + '</select></div>' +
          '<div class="ug-field"><label class="ug-lab">Claimant</label><input class="ug-in" data-ben-claimant placeholder="Same as beneficiary" autocomplete="off">' +
            '<div class="ug-help">Who will claim on their behalf. Leave empty if the beneficiary claims in person.</div></div>' +
          '<div class="ug-field"><label class="ug-lab">Claimant ID number</label><input class="ug-in" data-ben-id placeholder="ID-2026-000000" autocomplete="off"></div>' +
          brgyField,
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-save>Save</button>',
        onMount: (wrap, close) => {
          const nameEl = wrap.querySelector('[data-ben-name]');
          const saveBtn = wrap.querySelector('[data-save]');
          setTimeout(() => nameEl.focus(), 30);
          saveBtn.addEventListener('click', async () => {
            if (saveBtn.disabled) return;
            const name = nameEl.value.trim();
            const brgyEl = wrap.querySelector('[data-ben-brgy]');
            const barangay = isBO ? myBrgyName() : (brgyEl ? brgyEl.value : '');
            if (!name) { toast('Enter the beneficiary\'s name', 'warning'); nameEl.focus(); return; }
            if (!barangay) { toast('Select the barangay', 'warning'); return; }
            saveBtn.disabled = true;
            try {
              await Repo.createBeneficiary({
                beneficiary_name: name,
                claimant_name: wrap.querySelector('[data-ben-claimant]').value.trim() || name,
                claimant_id: wrap.querySelector('[data-ben-id]').value.trim(),
                barangay: barangay,
                category: wrap.querySelector('[data-ben-cat]').value
              });
              close();
              toast('Beneficiary added', 'prepared');
              render();
            } catch (e) {
              saveBtn.disabled = false;
              toast(e.message, 'warning');
            }
          });
        }
      });
    },
    'beneficiary-del': async (d) => {
      try { await Repo.deleteBeneficiary(d.id); toast('Beneficiary removed', 'warning'); }
      catch (e) { toast(e.message, 'warning'); }
      render();
    },

    /* ============================================== MODULE E: inventory + records
       All three Relief tabs share one action namespace. The inventory actions
       mutate UG.DATA.inventory in place (offline-first); when Supabase is
       reachable they would hit Repo methods that mirror the change server-side. */

    'relief-tab': (d) => { S.reliefTab = d.v; render(); },
    'inv-cat': (d) => { S.invCatFilter = d.v; render(); },
    'inv-clear-search': () => { S.invSearch = ''; render(); },
    'inv-detail': (d) => { if (typeof UG_RELIEF !== 'undefined' && UG_RELIEF.invDetailModal) UG_RELIEF.invDetailModal(d.id); },

    'inv-add': () => {
      if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can manage inventory', 'warning'); return; }
      const cats = UG_RELIEF.INV_CATEGORIES.map((c) => '<option>' + c + '</option>').join('');
      UG_FEATURES.modal({
        title: 'Add a stock item',
        body:
          '<div class="ug-field"><label class="ug-lab">Item name</label><input class="ug-in" data-inv-name placeholder="e.g. Family Food Pack"></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Category</label><select class="ug-sel" data-inv-cat>' + cats + '</select></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Unit</label><input class="ug-in" data-inv-unit placeholder="packs / bottles / kits"></div>' +
          '</div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Stock</label><input class="ug-in" data-inv-stock placeholder="0" inputmode="numeric"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Reorder at</label><input class="ug-in" data-inv-reorder placeholder="0" inputmode="numeric"></div>' +
          '</div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Location</label><input class="ug-in" data-inv-loc placeholder="MDRRMO Warehouse A"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Supplier</label><input class="ug-in" data-inv-sup placeholder="DSWD Field Office"></div>' +
          '</div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-save>Add Item</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', () => {
            const name = wrap.querySelector('[data-inv-name]').value.trim();
            const stock = parseInt(wrap.querySelector('[data-inv-stock]').value || '0', 10) || 0;
            if (!name) { toast('An item name is required', 'warning'); return; }
            const item = {
              id: 'INV-' + String(Date.now()).slice(-6),
              name: name,
              category: wrap.querySelector('[data-inv-cat]').value,
              unit: wrap.querySelector('[data-inv-unit]').value.trim() || 'units',
              stock: stock,
              reorder: parseInt(wrap.querySelector('[data-inv-reorder]').value || '0', 10) || 0,
              location: wrap.querySelector('[data-inv-loc]').value.trim(),
              supplier: wrap.querySelector('[data-inv-sup]').value.trim()
            };
            UG.DATA.inventory = UG.DATA.inventory || [];
            UG.DATA.inventory.push(item);
            /* low-stock check at add time so the duty officer is warned even
               when they enter a starting stock that is already below reorder. */
            if (item.stock <= item.reorder) toast('Item added — already at or below reorder point', 'warning');
            else toast('Stock item added', 'prepared');
            close(); render();
          });
        }
      });
    },

    'inv-edit': (d) => {
      const i = (UG.DATA.inventory || []).find((x) => x.id === d.id);
      if (!i) return;
      const cats = UG_RELIEF.INV_CATEGORIES.map((c) => '<option' + (i.category === c ? ' selected' : '') + '>' + c + '</option>').join('');
      UG_FEATURES.modal({
        title: 'Edit stock item · ' + i.name,
        body:
          '<div class="ug-field"><label class="ug-lab">Item name</label><input class="ug-in" data-inv-name value="' + UG_UTIL.esc(i.name) + '"></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Category</label><select class="ug-sel" data-inv-cat>' + cats + '</select></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Unit</label><input class="ug-in" data-inv-unit value="' + UG_UTIL.esc(i.unit || '') + '"></div>' +
          '</div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Stock</label><input class="ug-in" data-inv-stock value="' + (i.stock || 0) + '" inputmode="numeric"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Reorder at</label><input class="ug-in" data-inv-reorder value="' + (i.reorder || 0) + '" inputmode="numeric"></div>' +
          '</div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Location</label><input class="ug-in" data-inv-loc value="' + UG_UTIL.esc(i.location || '') + '"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Supplier</label><input class="ug-in" data-inv-sup value="' + UG_UTIL.esc(i.supplier || '') + '"></div>' +
          '</div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-save>Save</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', () => {
            i.name = wrap.querySelector('[data-inv-name]').value.trim() || i.name;
            i.category = wrap.querySelector('[data-inv-cat]').value;
            i.unit = wrap.querySelector('[data-inv-unit]').value.trim() || i.unit;
            i.stock = parseInt(wrap.querySelector('[data-inv-stock]').value || '0', 10) || 0;
            i.reorder = parseInt(wrap.querySelector('[data-inv-reorder]').value || '0', 10) || 0;
            i.location = wrap.querySelector('[data-inv-loc]').value.trim();
            i.supplier = wrap.querySelector('[data-inv-sup]').value.trim();
            toast('Stock item updated', 'prepared');
            close(); render();
          });
        }
      });
    },

    'inv-restock': (d) => {
      const i = (UG.DATA.inventory || []).find((x) => x.id === d.id);
      if (!i) return;
      UG_FEATURES.modal({
        title: 'Restock ' + i.name,
        body: '<div class="ug-field"><label class="ug-lab">Add to stock (' + (i.unit || 'units') + ')</label>' +
          '<input class="ug-in" data-inv-add placeholder="e.g. 100" inputmode="numeric" autofocus>' +
          '<div class="ug-help">Current stock: ' + i.stock + ' · Reorder at: ' + i.reorder + '</div></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-save>Restock</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', () => {
            const add = parseInt(wrap.querySelector('[data-inv-add"]').value || '0', 10) || 0;
            if (add <= 0) { toast('Enter a positive quantity', 'warning'); return; }
            i.stock = (i.stock || 0) + add;
            toast('+' + add + ' ' + i.unit + ' · new stock ' + i.stock + (i.stock <= i.reorder ? ' (still below reorder)' : ''), 'prepared');
            close(); render();
          });
        }
      });
    },

    'inv-adjust': (d) => {
      const i = (UG.DATA.inventory || []).find((x) => x.id === d.id);
      if (!i) return;
      const delta = parseInt(d.d, 10) || 0;
      i.stock = Math.max(0, (i.stock || 0) + delta);
      toast(i.name + ' stock adjusted to ' + i.stock + ' ' + i.unit, i.stock <= i.reorder ? 'warning' : 'info');
      render();
    },

    'inv-download': () => UG_EXPORTS.run('inv-download'),

    'rec-add': () => {
      if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can record distributions', 'warning'); return; }
      UG_RELIEF.ensureInventory();
      const items = (UG.DATA.inventory || []).map((i) => '<option value="' + i.id + '">' + UG_UTIL.esc(i.name + ' (' + (i.stock || 0) + ' ' + i.unit + ' in stock)') + '</option>').join('');
      const brgys = UG.DATA.barangays.map((b) => '<option>' + UG_UTIL.esc(b) + '</option>').join('');
      UG_FEATURES.modal({
        title: 'Record a distribution',
        body:
          '<div class="ug-field"><label class="ug-lab">Item</label><select class="ug-sel" data-rec-item>' + items + '</select></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Quantity</label><input class="ug-in" data-rec-qty placeholder="e.g. 50" inputmode="numeric"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Barangay</label><select class="ug-sel" data-rec-brgy>' + brgys + '</select></div>' +
          '</div>' +
          '<div class="ug-field"><label class="ug-lab">Family / recipient</label><input class="ug-in" data-rec-family placeholder="e.g. Aquino household"></div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Distributed by</label><input class="ug-in" data-rec-by value="' + UG_UTIL.esc((S.session && S.session.name) || '') + '"></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-save>Record</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', () => {
            const itemId = wrap.querySelector('[data-rec-item]').value;
            const item = (UG.DATA.inventory || []).find((x) => x.id === itemId);
            const qty = parseInt(wrap.querySelector('[data-rec-qty]').value || '0', 10) || 0;
            const brgy = wrap.querySelector('[data-rec-brgy]').value;
            const family = wrap.querySelector('[data-rec-family]').value.trim();
            const by = wrap.querySelector('[data-rec-by]').value.trim();
            if (!qty || !brgy) { toast('A quantity and a barangay are required', 'warning'); return; }
            if (item && qty > (item.stock || 0)) {
              toast('Only ' + item.stock + ' ' + item.unit + ' of ' + item.name + ' in stock', 'warning'); return;
            }
            const rec = {
              id: 'DR-' + String(Date.now()).slice(-6),
              item_id: itemId,
              item_name: item ? item.name : 'Item',
              qty: qty, barangay: brgy, family: family || '—',
              distributed_by: by || '—',
              distributed_at: new Date().toISOString()
            };
            UG.DATA.distributionLog = UG.DATA.distributionLog || [];
            UG.DATA.distributionLog.push(rec);
            /* decrement the inventory in the same action so the stock ledger
               and the distribution log never drift apart. */
            if (item) item.stock = Math.max(0, (item.stock || 0) - qty);
            toast(qty + ' ' + (item ? item.unit : 'units') + ' recorded for ' + brgy, 'prepared');
            close(); render();
          });
        }
      });
    },

    'rec-del': (d) => {
      const log = UG.DATA.distributionLog || [];
      const idx = log.findIndex((r) => r.id === d.id);
      if (idx === -1) return;
      /* restock the item the record had decremented, so deleting a mistake
         doesn't leave the inventory permanently short. */
      const rec = log[idx];
      const item = (UG.DATA.inventory || []).find((x) => x.id === rec.item_id);
      if (item) item.stock = (item.stock || 0) + (rec.qty || 0);
      log.splice(idx, 1);
      toast('Distribution record removed · ' + (rec.qty || 0) + ' ' + (item ? item.unit : '') + ' returned to stock', 'warning');
      render();
    },

    'rec-download': () => UG_EXPORTS.run('rec-download'),

    /* ================================================================ SETTINGS
       Settings is now per-user for preferences (language, notifications,
       offline, display) and device-wide for system config (org profile, SMS).
       Every role sees Settings; the tabs inside adapt to the role. */

    'settings-tab': (d) => { S.settingsTab = d.v; render(); },
    'tpl-cat': (d) => { S.tplCategoryFilter = d.v; render(); },
    'tpl-lang': (d) => { S.settingsLang = d.v; render(); },

    /* the UI language switch — actually changes the interface language.
       Sets the i18n layer immediately, persists per-user, then re-renders
       the whole app so every nav item, title and button updates. */
    'lang-ui': (d) => {
      const lang = d.v || 'en';
      if (typeof UG_I18N !== 'undefined') UG_I18N.setLang(lang);
      UG_SETTINGS.patchUserPrefs('language.ui', lang);
      toast(typeof UG_I18N !== 'undefined' && UG_I18N.isFil()
        ? (typeof UG_I18N.t('toast.languageChanged') === 'string' ? UG_I18N.t('toast.languageChanged') : 'Language changed to Filipino')
        : (typeof UG_I18N !== 'undefined' && UG_I18N.t ? UG_I18N.t('toast.languageChangedEn') : 'Language changed to English'),
        'prepared');
      render();
    },

    'alarm-toggle': () => {
      const on = UG_ALARM.muted();
      UG_ALARM.setMuted(!on);
      toast(on ? 'Alarm sound on' : 'Alarm sound off', 'info');
      render();
    },
    'alarm-test': () => {
      const ra = UG_ALARM.roleAlarms(S.session && S.session.role, S.session && S.session.superAdmin);
      if (!UG_ALARM.play(ra.test, { force: true })) toast('This browser cannot play the alarm sound', 'warning');
    },
    'settings-toggle': (d) => {
      const path = d.path;
      const cur = UG_SETTINGS.getSettings();
      /* walk the path to read the current value */
      const keys = path.split('.');
      let v = cur;
      for (const k of keys) v = v && v[k];
      /* for string-enum toggles (onValue set), the toggle cycles to onValue
         when off and back to the first alternative when on. For boolean
         toggles it just flips. */
      const onValue = d.v && d.v !== 'true' ? d.v : null;
      let next;
      if (onValue) {
        next = (v === onValue) ? null : onValue;
      } else {
        next = !v;
      }
      UG_SETTINGS.patchSettings(path, next);
      toast((next === true || next === onValue ? 'Enabled' : 'Disabled') + ' · ' + path, 'info');
      render();
    },

    'settings-save-general': () => {
      const vals = {};
      document.querySelectorAll('[data-setting]').forEach((el) => {
        if (el.dataset.setting.indexOf('org.') === 0 || el.dataset.setting.indexOf('sms.') === 0)
          vals[el.dataset.setting] = el.value;
      });
      Object.keys(vals).forEach((p) => UG_SETTINGS.patchSettings(p, vals[p]));
      toast('Profile + SMS settings saved', 'prepared');
      render();
    },

    'settings-save-offline': () => {
      document.querySelectorAll('[data-setting]').forEach((el) => {
        if (el.dataset.setting.indexOf('offline.') === 0)
          UG_SETTINGS.patchSettings(el.dataset.setting, el.type === 'number' ? parseInt(el.value, 10) || 0 : el.value);
      });
      toast('Offline settings saved', 'prepared');
      render();
    },

    'settings-save-language': () => {
      const def = (q('[data-field="langDefault"]') || {}).value || 'en';
      UG_SETTINGS.patchUserPrefs('language.broadcastDefault', def);
      toast('Language settings saved', 'prepared');
      render();
    },

    'settings-reset': () => {
      UG_FEATURES.confirm({
        title: 'Restore default settings',
        message: 'This resets your preferences (language, notifications, offline, display) to their defaults. System config (org profile, SMS) and message templates are not affected.',
        confirmLabel: 'Restore', danger: true
      }).then((ok) => {
        if (!ok) return;
        /* clear per-user prefs only; leave system config + templates intact */
        const uid = window.__UG_CURRENT_UID || '';
        const key = uid ? 'uniguard.prefs.v1.' + uid : 'uniguard.prefs.v1';
        try { localStorage.removeItem(key); } catch (e) {}
        if (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.reloadUserPrefs) UG_SETTINGS.reloadUserPrefs();
        /* also reset the i18n layer to the (now-default) English */
        if (typeof UG_I18N !== 'undefined') UG_I18N.setLang('en');
        toast('Preferences restored to defaults', 'info');
        render();
      });
    },

    'tpl-add': () => { UG_SETTINGS.openEditor(null); },
    'tpl-edit': (d) => { UG_SETTINGS.openEditor(d.id); },
    'tpl-delete': (d) => { UG_SETTINGS.deleteTemplate(d.id); },
    'tpl-export': () => { UG_SETTINGS.exportTemplates(); },

    'guide-hazard': (d) => { S.guideHazard = d.v; render(); },
    'guide-phase': (d) => { S.guidePhase = d.v; render(); },
    'guide-open': (d) => { S.openId = d.id; S.route = 'guide-detail'; render(); },

    /* Preparedness guides as a formal PDF (js/exports.js): the selected
       hazard or every guide, with summary and Before / During / After text in
       full (no truncation). */
    'guide-download': (d) => UG_EXPORTS.run('guide-download', (d && d.hazard) || 'all'),

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
          '<div class="ug-help">Fill at least one section. Put each instruction on its own line starting with its number, for example "1) Prepare a go-bag." Each numbered line becomes its own step card. Citizens see the guide as soon as you save.</div></div>',
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
            /* One row per filled phase, the same shape as the production seed
               (phase = before | during | after, text in `body` and in the
               matching phase column). The table's check constraint
               (migration 014) only allows those three phase values, so the
               old single row with phase 'all' could not be saved. */
            const hazardType = wrap.querySelector('[data-g-hazard]').value;
            const summary = wrap.querySelector('[data-g-summary]').value.trim();
            const parts = [['before', before], ['during', during], ['after', after]].filter((x) => x[1]);
            try {
              for (const [ph, text] of parts) {
                const row = { hazard_type: hazardType, phase: ph, title: title, summary: summary, body: text,
                  body_before: '', body_during: '', body_after: '' };
                row['body_' + ph] = text;
                await Repo.createGuide(row);
              }
              toast(parts.length === 1 ? 'Guide published' : 'Guide published for ' + parts.length + ' phases', 'prepared');
              close();
            } catch (e) { toast(e.message, 'warning'); }
          });
        }
      });
    },

    'guide-edit': async (d) => {
      if (!requireRole(['lgu_ldrrmc', 'barangay_official'])) { toast('Only officials can manage guides', 'warning'); return; }
      const g = (UG.DATA.guides || []).find((x) => x.id === d.id);
      if (!g) return;
      const esc = UG_UTIL.esc;
      /* A phase row (the seed's shape) is edited as that one phase: the form
         shows its own text and saves it to `body` and the matching phase
         column together, so the two never drift apart. The old form put a
         During or After row's text into the Before box and saved it there. */
      const single = UG_GUIDES.PHASES.indexOf(g.phase) !== -1;
      const ta = (ph, label, rows) => '<div class="ug-field"><label class="ug-lab">' + label + '</label>' +
        '<textarea class="ug-ta" rows="' + rows + '" data-g-' + ph + '>' + esc(UG_GUIDES.phaseText(g, ph)) + '</textarea></div>';
      UG_FEATURES.modal({
        title: 'Edit guide',
        body:
          '<div class="ug-field"><label class="ug-lab">Title</label><input class="ug-in" data-g-title value="' + esc(g.title) + '"></div>' +
          '<div class="ug-field"><label class="ug-lab">Brief summary</label><input class="ug-in" data-g-summary value="' + esc(g.summary || '') + '"></div>' +
          (single
            ? ta(g.phase, UG_GUIDES.phaseLabel(g.phase) + ' · ' + esc(g.hazard_type), 12)
            : ta('before', 'Before', 5) + ta('during', 'During', 5) + ta('after', 'After', 5)) +
          '<div class="ug-help">One instruction per line, starting with its number ("1) …"). Each numbered line is shown as its own step card.</div>',
        footer:
          '<button class="ug-btn" data-modal-close>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal" data-save>Save changes</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-save]').addEventListener('click', async () => {
            const val = (ph) => { const el = wrap.querySelector('[data-g-' + ph + ']'); return el ? el.value.trim() : ''; };
            const patch = { title: wrap.querySelector('[data-g-title]').value.trim(), summary: wrap.querySelector('[data-g-summary]').value.trim() };
            if (!patch.title) { toast('Give the guide a title', 'warning'); return; }
            if (single) {
              const text = val(g.phase);
              if (!text) { toast('The instructions cannot be empty', 'warning'); return; }
              patch.body = text; patch['body_' + g.phase] = text;
            } else {
              const before = val('before'), during = val('during'), after = val('after');
              if (!before && !during && !after) { toast('Fill at least one of the three sections', 'warning'); return; }
              Object.assign(patch, { body: before || during || after, body_before: before, body_during: during, body_after: after });
            }
            try {
              await Repo.updateGuide(g.id, patch);
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
    /* Section 8: open the road status detail modal. The citizen screen's
       UG_ROADWORK.roadDetailModal already shows every stored field; we reuse
       it here so the Super Admin / LGU gets the same full record view, with
       an Edit action appended in the footer for authorized users. */
    'rs-detail': (d) => {
      if (typeof UG_ROADWORK !== 'undefined' && UG_ROADWORK.roadDetailModal) {
        UG_ROADWORK.roadDetailModal(d.id, S);
      }
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
    /* The status of the last SOS is shown inline on the SOS card
       (S.lastSos.status: 'sent' | 'queued' | 'error'), never as a pile of
       toasts over the call button. With no connection the SOS is saved on the
       phone and sent by UG_PWA.flushQueue as soon as the signal returns. */
    /* Without a type (the floating SOS button, the home shortcut) it opens
       the SOS screen, where the resident taps what kind of emergency it is;
       the typed button sends, and the server dispatches the matching team. */
    'sos-trigger': async (d) => {
      if (S.sosSending) return;
      if (!S.session) { toast('Sign in to send an SOS', 'warning'); return; }
      const kind = d && d.kind;
      if (!kind) {
        if (S.route !== 'sos') { go('sos'); render(); }
        return;
      }
      S.sosSending = true; S.route = 'sos'; render();
      let pos = null;
      try { pos = await UG_FEATURES.locate(); }
      catch (e) { pos = null; /* send or queue without coordinates */ }
      const now = new Date();
      const base = {
        lat: pos ? pos.lat : null, lng: pos ? pos.lng : null, accuracy: pos ? pos.accuracy : null,
        at: now.toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
        noGps: !pos, kind: kind
      };
      const queueIt = async () => {
        await UG_PWA.upsertQueuedSos({
          _kind: 'sos', lat: base.lat, lng: base.lng, accuracy: base.accuracy, note: '', kind: kind,
          client_sent_at: now.toISOString()
        });
        S.lastSos = Object.assign({ status: 'queued', id: null, reach: null }, base);
      };
      try {
        if (navigator.onLine === false) {
          await queueIt();
        } else {
          const res = await Repo.submitSos({ lat: base.lat, lng: base.lng, accuracy: base.accuracy, kind: kind });
          if (res && res.queued) {
            S.lastSos = Object.assign({ status: 'queued', id: null, reach: null }, base);
          } else {
            S.lastSos = Object.assign({
              status: 'sent',
              id: res && res.id ? res.id : null,
              reach: res && typeof res.reach === 'number' ? res.reach : null,
              team: res && res.dispatched ? res.team : null
            }, base);
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) { }
          }
        }
      } catch (e) {
        if (UG_UTIL.isNetworkError(e)) {
          try { await queueIt(); }
          catch (e2) { S.lastSos = Object.assign({ status: 'error', message: T('error.network') }, base); }
        } else {
          /* the server refused it (rate limit, permission): say so in the card */
          console.error('[UniGuard] SOS rejected', e);
          S.lastSos = Object.assign({ status: 'error', message: UG_UTIL.friendlyError(e) }, base);
        }
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

  /* ─────────────────────────────────────────────────────────────────────
   *  hotlineRequestModal — the LGU/BO change request form for emergency
   *  hotlines (master prompt · Emergency Hotlines Management and Super Admin
   *  Approval). action = 'add' | 'edit' | 'delete'; existing = the hotline
   *  row being modified (null for 'add'). Submits through Repo.submitChange-
   *  Request, which calls the submit_change_request RPC (security definer)
   *  that stamps the requester from auth.uid() and writes the audit row.
   * ───────────────────────────────────────────────────────────────────── */
  function hotlineRequestModal(action, existing) {
    const esc = UG_UTIL.esc;
    const isEdit = action === 'edit';
    const isDelete = action === 'delete';
    const isAdd = action === 'add';
    /* pre-fill the proposed fields from the existing record when editing */
    const cur = existing || {};
    const agencyVal = isEdit ? (cur.agency || '') : '';
    const numberVal = isEdit ? (cur.number || '') : '';
    const scopeVal = isEdit ? (cur.scope || '') : '';
    const descVal = isEdit ? (cur.description || '') : '';
    UG_FEATURES.modal({
      title: isAdd ? 'Request a new hotline'
           : isDelete ? 'Request deletion of ' + (cur.agency || 'hotline')
           : 'Request an edit to ' + (cur.agency || 'hotline'),
      body:
        '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-note">' +
          'Your request will be reviewed by the Super Admin. The official directory is not changed until the request is approved. You will be notified when a decision is made.' +
        '</div></div>' +
        (isDelete ? '<div class="ug-field"><label class="ug-lab">Existing agency</label><div class="ug-dim" style="font-size:13px;padding:8px 0">' + esc(cur.agency || '—') + '</div>' +
          '<div class="ug-dim ug-mono" style="font-size:11px">' + esc(cur.number || '—') + '</div></div>'
          : '<div class="ug-field"><label class="ug-lab">Agency name</label>' +
            '<input class="ug-in" data-req-agency value="' + esc(agencyVal) + '" placeholder="e.g. Bureau of Fire Protection"></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Contact number</label>' +
              '<input class="ug-in" data-req-number value="' + esc(numberVal) + '" placeholder="(075) 000-0000"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Scope</label>' +
              '<input class="ug-in" data-req-scope value="' + esc(scopeVal) + '" placeholder="Fire and rescue"></div>' +
          '</div>' +
          '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Description (optional)</label>' +
            '<input class="ug-in" data-req-desc value="' + esc(descVal) + '" placeholder="e.g. 24/7 fire and rescue dispatch"></div>') +
        '<div class="ug-field" style="margin-top:12px"><label class="ug-lab">Reason for this request</label>' +
          '<textarea class="ug-ta" data-req-reason rows="3" placeholder="e.g. The BFP changed their 24-hour dispatch number."></textarea>' +
          '<div class="ug-help">Shown to the Super Admin when they review your request, and stored in the audit log.</div></div>',
      footer: '<button class="ug-btn" data-modal-close>Cancel</button>' +
        '<button class="ug-btn ug-btn--signal" data-submit>Submit request</button>',
      onMount: (wrap, close) => {
        wrap.querySelector('[data-submit]').addEventListener('click', async () => {
          const reason = wrap.querySelector('[data-req-reason]').value.trim();
          if (!reason) { toast('A reason is required so the Super Admin can review the request', 'warning'); return; }
          const proposed = isDelete ? {} : {
            agency_name: wrap.querySelector('[data-req-agency]').value.trim(),
            contact_number: wrap.querySelector('[data-req-number]').value.trim(),
            scope: wrap.querySelector('[data-req-scope]').value.trim() || 'Municipality-wide',
            description: wrap.querySelector('[data-req-desc]').value.trim()
          };
          if (!isDelete) {
            if (!proposed.agency_name || !proposed.contact_number) {
              toast('An agency name and a contact number are required', 'warning'); return;
            }
          }
          const current = existing ? {
            agency_name: existing.agency || '',
            contact_number: existing.number || '',
            scope: existing.scope || '',
            description: existing.description || ''
          } : {};
          try {
            const res = await Repo.submitChangeRequest({
              target_table: 'emergency_hotlines',
              action: action,
              target_id: existing ? (existing.uuid || existing.id) : null,
              current_data: current,
              proposed_data: proposed,
              reason: reason
            });
            toast(T('toast.changeRequestSent'), 'prepared');
            if (Repo.loadChangeRequests) await Repo.loadChangeRequests();
            close();
            render();
          } catch (e) { toast(e.message, 'warning'); }
        });
      }
    });
  }

  const ALL = Object.assign({},
    AUTH_ACTIONS,
    APP_ACTIONS,
    /* Dispatch team module actions. The module is loaded before app.js in
       index.html, so UG_DISPATCH.actions is available here. */
    (typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.actions) ? UG_DISPATCH.actions : {},
    /* Reports and Documentation module actions (module G) */
    (typeof UG_REPORTING !== 'undefined' && UG_REPORTING.actions) ? UG_REPORTING.actions : {},
    /* Super Admin home screen actions, all named 'sa-*' */
    (typeof UG_SUPERADMIN !== 'undefined' && UG_SUPERADMIN.actions) ? UG_SUPERADMIN.actions : {}
  );

  /* --------------------------------------------------------------- listeners */
  /* Delegated on document, not #ug-root: pop-ups (UG_FEATURES.modal) and the
     connectivity strip live on <body>, outside the root, and their [data-act]
     buttons never reached a root-bound listener. The urgent-alert overlay has
     its own listener, so its events are skipped here. Bound exactly once. */
  const bindDelegates = !window.__ugDelegated;
  window.__ugDelegated = true;
  const outsideApp = (e) => !!(e.target && e.target.closest && e.target.closest('.ug-urgent-host'));
  const on = (type, fn, opts) => {
    if (!bindDelegates) return;
    document.addEventListener(type, (e) => {
      if (!e.target || !e.target.closest || outsideApp(e)) return;
      fn(e);
    }, opts);
  };

  on('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    /* a submit button belongs to the form: let the submit handler run, and do not
       cancel the default action or the form never fires */
    if (t.getAttribute('type') === 'submit') return;
    const fn = ALL[t.dataset.act];
    if (!fn) return;
    e.preventDefault();
    /* PRIORITY 0 fix (Oct 24 2026): the old delegate closed the modal
       BEFORE running the action, so any action that read modal form
       fields (e.g. dispatch-help-new's onMount handler reads
       [data-hr-kind] and [data-hr-msg]) found them already removed
       from the DOM. Run the action FIRST (it can read the form, call
       close() itself when done, or call render() which leaves the
       modal in place because modals live on <body>, not inside
       #ug-root). Then auto-close the modal unless the button opted
       out with data-keep-modal. The action's own directly-attached
       listeners (e.g. footer Save buttons) ran during the target
       phase, before this delegated handler, so they are unaffected. */
    const dlg = t.closest('.ug-modal');
    try { fn(t.dataset, t); }
    finally {
      if (dlg && !t.hasAttribute('data-keep-modal')) {
        if (typeof dlg.__ugClose === 'function') dlg.__ugClose(); else dlg.remove();
      }
    }
  });

  on('input', (e) => {
    const el = e.target.closest('[data-field]');
    if (!el) return;
    const f = el.dataset.field, v = el.value;
    if (!S.session) {
      if (f === 'email' || f === 'password' || f === 'confirm' || f === 'lastName' || f === 'firstName' || f === 'phone') S.auth.form[f] = v;
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
    if (f === 'auditQ') { S.auditQ = v; render(f); return; }
    if (f === 'invSearch') { S.invSearch = v; render(f); return; }
    if (f === 'unitSearch') { S.unitSearch = v; render(f); return; }
    if (f === 'userSearch') { S.userSearch = v; render(f); return; }
    if (f === 'shelterSearch') { S.shelterSearch = v; render(f); return; }
    if (f === 'rsSearch') { S.rsSearch = v; render(f); return; }
    if (f === 'reportAddress') { S.report.locationNote = v; return; }
    /* road work composer fields */
    if (f === 'rwTitle') { S.roadDraft.title = v; return; }
    if (f === 'rwDescription') { S.roadDraft.description = v; return; }
    if (f === 'rwRoad') { S.roadDraft.road_name = v; return; }
    if (f === 'rwLat') { S.roadDraft.lat = parseFloat(v); return; }
    if (f === 'rwLng') { S.roadDraft.lng = parseFloat(v); return; }
    if (f === 'rwHours') { S.roadDraft.expected_hours = parseFloat(v); return; }
  });

  on('change', (e) => {
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
    else if (f === 'anBrgyFilter') { S.anBrgyFilter = v; render(); return; }
    else if (f === 'hazard') S.report.hazard = v;
    else if (f === 'brgy') S.report.brgy = v;
    else if (f === 'rwBarangay') { S.roadDraft.barangay = v; render(); return; }
    else if (f === 'benBarangayFilter') { S.benBarangayFilter = v; render(); return; }
    else if (f === 'incBrgyFilter') { S.incBrgyFilter = v; render(); return; }
    else if (f === 'incHazardFilter') { S.incHazardFilter = v; render(); return; }
    else if (f === 'recBrgyFilter') { S.recBrgyFilter = v; render(); return; }
    else if (f === 'invBrgyFilter') { S.invBrgyFilter = v; render(); return; }
    /* activity log filters */
    else if (f === 'auditEntity' || f === 'auditActor' || f === 'auditFrom' || f === 'auditTo'
          || f === 'auditRole' || f === 'auditAction' || f === 'auditBarangay') { S[f] = v; S.auditPage = 1; render(); return; }
    else if (f === 'auditQ') return;
    else if (f === 'assignResponder') return;
    else return;
    render();
  });

  /* Barangay combo — search filtering. The existing input listener only acts
     on [data-field], so the search input (which uses data-act instead) needs
     its own handler. */
  on('input', (e) => {
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
  on('keydown', (e) => {
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
  on('keydown', (e) => {
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
    else if (a === 'onboarding') AUTH_ACTIONS['complete-onboarding']();
  });

  on('submit', (e) => {
    const form = e.target.closest('[data-form="auth"]');
    if (!form) return;
    e.preventDefault();
    const a = S.auth.screen;
    if (a === 'signin') AUTH_ACTIONS.signin();
    else if (a === 'signup') AUTH_ACTIONS.signup();
    else if (a === 'forgot') AUTH_ACTIONS.forgot();
    else if (a === 'set-password') AUTH_ACTIONS['set-password']();
    else if (a === 'onboarding') AUTH_ACTIONS['complete-onboarding']();
  });

  /* the live map asks the app to open an incident */
  document.addEventListener('ug:open-incident', (e) => {
    const id = e.detail && e.detail.id;
    if (!id) return;
    APP_ACTIONS['open-incident']({ id: id });
  });

  /* a queued SOS reached the server after the connection came back */
  document.addEventListener('ug:sos-delivered', (e) => {
    const res = (e.detail && e.detail.result) || {};
    if (S.lastSos && (S.lastSos.status === 'queued' || S.lastSos.status === 'error')) {
      S.lastSos = Object.assign({}, S.lastSos, {
        status: 'sent', message: '', id: res.id || null,
        reach: typeof res.reach === 'number' ? res.reach : null,
        team: res.dispatched ? res.team : null
      });
    }
    toast(T('sos.delivered'), 'prepared');
    if (S.session) render();
  });
  document.addEventListener('ug:sos-rejected', (e) => {
    if (S.lastSos && S.lastSos.status === 'queued') {
      S.lastSos = Object.assign({}, S.lastSos, { status: 'error', message: (e.detail && e.detail.message) || T('error.generic') });
      if (S.session) render();
    }
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
      else if (b.dataset.reset) { S.route = homeRoute(); S.openId = null; S.sevFilter = 'all'; S.incBrgyFilter = 'All'; S.incHazardFilter = 'All'; S.centerFilter = 'all'; render(); }
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

  Repo.onChange(() => {
    if (!S.session) return;
    render();
    /* an open report whose history is not loaded yet (opened from a
       notification or a link) or whose status changed: (re)load it */
    if (S.openId && !Repo.state.loading && (S.route === 'report-detail' || S.route === 'incident')) {
      const inc = (UG.DATA.incidents || []).find((i) => i.id === S.openId || i.uuid === S.openId);
      const at = UG.DATA.reportHistoryAt || {};
      if (inc && inc.uuid && at[inc.uuid] !== inc.status) loadHistoryFor(inc);
    }
    /* a live refresh can bring in an emergency advisory: store it for the
       notifications list and raise the overlay, as bootstrapData does */
    if (!Repo.state.loading && S.session.role !== 'dispatch_team') {
      try { UG_NOTIF_STORE.mergeAll(UG.DATA.notifications || []); } catch (e) { }
      try { UG_URGENT.scan(); } catch (e) { }
      alarmOnNew();
    }
  });

  /* Every portal hears what its role must act on (UG_ALARM.roleAlarms):
       resident     help dispatched to / arriving at their own report or SOS
       barangay     new report or SOS in their barangay, their Response Team sent
       LGU          any new report, any SOS, a team that could not be auto-sent
       Super Admin  SOS, new Emergency reports, a team not auto-sent, approvals
     (Units ring in js/dispatch.js; emergency alerts in js/urgent-alerts.js.)
     The first load after sign-in only records what is already there, so
     opening the app is silent. */
  let alarmSeen = null;
  let alarmSeenFor = '';
  const NEEDS_DISPATCH = /^(No unit available|Dispatch needed|Auto-dispatch failed)/;
  function alarmOnNew() {
    const role = S.session.role;
    if (role === 'dispatch_team') return;
    if (!Repo.state.hasSynced || Repo.state.source !== 'supabase') return;
    const sup = !!S.session.superAdmin;
    const inc = UG.DATA.incidents || [];
    const notifs = UG.DATA.notifications || [];
    const crs = UG.DATA.changeRequests || [];
    const who = S.session.id || S.session.email || '';
    const keys = inc.map((i) => 'r' + i.uuid).concat(notifs.map((n) => 'n' + n.id), crs.map((c) => 'c' + c.id));
    if (!alarmSeen || alarmSeenFor !== who) {
      alarmSeen = new Set(keys);
      alarmSeenFor = who;
      return;
    }
    const newInc = inc.filter((i) => i.uuid && !alarmSeen.has('r' + i.uuid) && i.status !== 'resolved' && i.status !== 'rejected');
    const newN = notifs.filter((n) => n.id && !alarmSeen.has('n' + n.id));
    const newCr = crs.filter((c) => c.id && !alarmSeen.has('c' + c.id) && (c.status || 'pending') === 'pending');
    keys.forEach((k) => alarmSeen.add(k));

    const sos = newN.some((n) => n.type === 'sos');
    const needsDispatch = newN.some((n) => NEEDS_DISPATCH.test(n.title));
    let kind = null;
    if (role === 'citizen') {
      const mine = new Set(inc.filter((i) => i.mine).map((i) => i.uuid));
      const help = newN.some((n) => mine.has(n.report_id) &&
        (n.type === 'dispatch' || (n.type === 'dispatch_status' && /on scene/i.test(n.title))));
      if (help) kind = 'help';
    } else if (role === 'barangay_official') {
      const team = newN.some((n) => n.type === 'dispatch' && /^Barangay Response Team/.test(n.body));
      kind = sos ? 'sos' : newInc.length ? newInc[0].hazard : team ? 'dispatch' : null;
    } else if (sup) {
      const emergency = newInc.filter((i) => i.sev === 'emergency');
      kind = sos ? 'sos' : emergency.length ? emergency[0].hazard : needsDispatch ? 'attention' : newCr.length ? 'admin' : null;
    } else if (role === 'lgu_ldrrmc') {
      kind = sos ? 'sos' : newInc.length ? newInc[0].hazard : needsDispatch ? 'attention' : null;
    }
    if (kind) { try { UG_ALARM.play(kind); } catch (e) { } }

    /* the SOS log is read on entering its screen; keep it current there */
    if (sos && S.route === 'sos') {
      Repo.listSos().then((rows) => { UG.DATA.sosLog = rows; if (S.session) render(); }).catch(() => { });
    }
  }

  /* Live refreshes rebuild #ug-root, so hold one back while that would cost
     the user something: a field they are typing in, an open dropdown, or a
     form they have filled but not submitted. Modals live on <body> and are
     untouched by render(). The held refresh runs once they move on. */
  function formIsDirty() {
    const els = root.querySelectorAll('input, textarea, select');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.tagName === 'SELECT') {
        if (el.multiple) continue;
        const def = Array.prototype.findIndex.call(el.options, (o) => o.defaultSelected);
        if (el.options.length && el.selectedIndex !== (def < 0 ? 0 : def)) return true;
      } else if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked !== el.defaultChecked) return true;
      } else if (el.type === 'file') {
        if (el.files && el.files.length) return true;
      } else if (!/^(hidden|button|submit|reset|image|range|color)$/.test(el.type)) {
        if (el.value !== el.defaultValue) return true;
      }
    }
    return false;
  }
  function liveRefreshAllowed() {
    if (!S.session) return false;
    const a = document.activeElement;
    if (a && root.contains(a) && (a.isContentEditable || a.tagName === 'TEXTAREA' ||
        (a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file)$/.test(a.type)))) return false;
    if (document.querySelector('.ug-combo.is-open')) return false;
    return !formIsDirty();
  }
  /* the dispatch team reads its own dataset (UG_DISPATCH), not Repo's */
  Repo.setRefreshGate(() => S.session && S.session.role !== 'dispatch_team' && liveRefreshAllowed());

  /* The dispatch portal has no Realtime feed of its own; refresh it on the
     same cadence, under the same rule, so new assignments show up unprompted. */
  let dispatchRefreshing = false;
  async function refreshDispatch() {
    if (dispatchRefreshing || !S.session || S.session.role !== 'dispatch_team') return;
    if (typeof UG_DISPATCH === 'undefined' || !UG_DISPATCH.loadAll) return;
    if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
    if (UG_DISPATCH.state.loading || !liveRefreshAllowed()) return;
    dispatchRefreshing = true;
    try { await UG_DISPATCH.loadAll({ silent: true }); } catch (e) { }
    dispatchRefreshing = false;
  }
  /* js/dispatch.js calls this when Realtime reports a new assignment */
  window.UG_DISPATCH_REFRESH = refreshDispatch;
  setInterval(refreshDispatch, UG_CONFIG.LIVE_REFRESH_MS || 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshDispatch(); });
  UG_PWA.onChange(() => { if (S.session) render(); });

  /* My Reports lists the reports still waiting in the offline queue (SOS rows
     are shown on the SOS card instead). IndexedDB is async, so keep a copy in
     UG.DATA.queuedReports and refresh it whenever the queue changes. */
  let queueKey = '';
  async function refreshQueuedList() {
    const rows = (await UG_PWA.listQueue()) || [];
    UG.DATA.queuedReports = rows.filter((r) => r._kind !== 'sos').map((r) => ({
      qid: r.id, hazard: r.hazard_type, brgy: r.barangay, description: r.description,
      queued_at: r.queued_at, failed: !!r.failed, last_error: r.last_error || '', sev: r.severity
    }));
    if (S.session) render();
  }
  UG_PWA.onChange((st) => {
    const k = (st.queued || 0) + ':' + (st.failed || 0);
    if (k === queueKey) return;
    queueKey = k;
    refreshQueuedList().catch(() => { });
  });

  /* A session restored from the device cache while offline is confirmed with
     the server once per reconnection. If it is really gone (or the account
     was disabled meanwhile) the user lands on the sign-in screen. */
  let revalidating = false;
  async function revalidateSession() {
    if (revalidating || !S.session || !Repo.client()) return;
    revalidating = true;
    try {
      const r = await Auth.revalidate();
      if (r && r.signedOut) {
        MapView.destroy();
        S.session = null;
        S.auth = blankAuth();
        S.auth.notice = T('auth.signInAgain');
        go('home');
        render();
      }
    } catch (e) { /* stay as we are; the next reconnection tries again */ }
    revalidating = false;
  }
  window.addEventListener('online', () => { revalidateSession(); });

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
        /* ?super=0 previews the LDRRMO Staff tier; the default LGU preview is the Super Admin */
        role: as, superAdmin: as === 'lgu_ldrrmc' && p.get('super') !== '0',
        title: (as === 'lgu_ldrrmc' && p.get('super') !== '0') ? UG_WEB.SUPER_ADMIN_LABEL : UG_WEB.ROLE_INFO[as].label,
        barangay: seeded.barangay, barangay_id: null,
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
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto" data-act="retry-load">' + UG.icon('wave', 13) + UG_UTIL.esc(T('action.tryAgainShort')) + '</button>';
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
      /* a deep-linked preview route still needs its own data (reports register,
         activity log); enterApp is skipped on this path */
      bootstrapData().then(() => loadRouteData(S.route)).catch(() => { });
      return;
    }

    let session = null;
    try { session = await Auth.restore(); }
    catch (e) {
      /* not a definitive "signed out": keep the session and offer a retry */
      console.error('[UniGuard] restore failed', e);
      session = null;
      S.auth = blankAuth();
      S.auth.error = UG_UTIL.friendlyError(e);
      S.auth.restoreFailed = true;
    }

    if (Auth.state.recovery) {
      S.session = null;
      S.auth = blankAuth();
      S.auth.screen = 'set-password';
      render();
      return;
    }
    /* Back from a confirmation email: drop the token from the address bar
       (keeping the hash router alive) and say plainly what happened. */
    let linkMessage = '';
    if (EMAIL_LINK && EMAIL_LINK.kind !== 'recovery') {
      try { history.replaceState(null, '', location.pathname + '#'); } catch (e) { }
      if (EMAIL_LINK.kind === 'confirmed') linkMessage = T('auth.emailConfirmed');
      if (!session) {
        S.auth = blankAuth();
        if (EMAIL_LINK.kind === 'error') { S.auth.error = T('auth.linkExpired'); S.auth.linkExpired = true; }
        else S.auth.notice = linkMessage;
      }
    }
    /* Onboarding: if the restored session is for an invited account (official,
       LGU or dispatch team) whose full_name is still the email prefix, show
       the onboarding screen so they can set their password + real name. */
    if (session && Auth.state.profile && Auth.needsOnboarding(Auth.state.profile, session.email)) {
      S.session = null;
      S.auth = blankAuth();
      S.auth.screen = 'onboarding';
      S.auth.pendingProfile = Auth.state.profile;
      /* load the barangay list so barangay_official can pick theirs */
      try { S.auth.barangays = await Repo.listBarangays(); } catch (e) {}
      /* for dispatch_team, load the unit name so we can show it */
      if (Auth.state.profile.role === 'dispatch_team') {
        try {
          const unit = await Auth.loadUnitName(Auth.state.profile);
          if (unit) S.auth.pendingProfile.unit_name = unit.name;
        } catch (e) {}
      }
      S.auth.form = { password: '', confirm: '', lastName: '', firstName: '', phone: '', barangay_id: Auth.state.profile.barangay_id || '' };
      render();
      return;
    }
    if (session) enterApp(session, linkMessage || undefined);
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

  /* expose the controller hooks the feature modules (settings, relief,
     dispatch, reporting, roadwork) reach for. These are assigned once on
     boot; the modules guard with typeof so a missed assignment never throws.

     CRITICAL (PRIORITY 0 fix, Oct 24 2026): the dispatch module references
     `window.UG_APP` (all caps) in 62+ places, but only `window.UG_App`
     (mixed case) was being exposed — so every dispatch click silently
     no-op'd: no re-render, no route change, no toast. The mixed-case name
     is kept as an alias so reporting.js and roadwork.js keep working, but
     the canonical name is now `window.UG_APP`. The bridge is exposed here
     (after render / go / toast / loadRouteData are all defined) so the
     dispatch module's `app()` helper can rely on it. */
  window.UG_APP = {
    S: S,
    render: render,
    toast: toast,
    go: go,
    loadRouteData: loadRouteData,
    actions: ALL,
    /* `go(route)` writes the hash so back/forward and reload land on the
       same route. The wrapper used to swallow errors with try/catch,
       which hid routing bugs; it now rethrows so a broken route surfaces
       immediately. */
    goLoud: function (route) { go(route); }
  };
  /* alias for the mixed-case name reporting.js / roadwork.js already use */
  window.UG_App = window.UG_APP;
  boot();
})();
