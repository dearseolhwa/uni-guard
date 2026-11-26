/* UniGuard citizen web shell: role definitions and the desktop citizen layout. */

const UG_WEB = (() => {
  const U = UG, I = U.icon, esc = U.esc;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');
  const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);

  /* local field builders: these belong to this module, the account screens have their own */
  function selectField(id, label, options, value, help) {
    return '<div class="ug-field" style="margin-bottom:14px"><label class="ug-lab">' + esc(label) + '</label>' +
      '<select class="ug-sel" data-field="' + id + '" aria-label="' + esc(label) + '">' +
      options.map((o) => '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') +
      '</select>' + (help ? '<div class="ug-help">' + esc(help) + '</div>' : '') + '</div>';
  }

  /* role definitions: role decides where the account lands after sign in */
  const ROLE_INFO = {
    citizen:           { key:'citizen',           label:'Citizen',            area:'citizen', home:'home',      scope:(b) => 'Barangay ' + (b || UG_GEO.BARANGAYS[0]) },
    barangay_official: { key:'barangay_official', label:'Barangay Official', area:'console', home:'dashboard',
  scope:(b) => b ? 'Barangay ' + b : 'No barangay assigned' },
    /* Two tiers share this role key. LDRRMO Staff run daily operations; the
       Super Admin (profiles.is_super_admin) also manages accounts, roles and
       the activity log. See session.superAdmin. */
    lgu_ldrrmc:        { key:'lgu_ldrrmc',        label:'LDRRMO Staff',       area:'console', home:'dashboard', scope:() => UG_GEO.PLACE.scope },
    dispatch_team:     { key:'dispatch_team',     label:'Dispatch Team',     area:'dispatch', home:'dispatch',
  scope:(b, p) => 'Municipality-wide ' + (p && p.unit_role ? p.unit_role + ' · ' : '') + (p && p.dispatch_unit_id ? p.dispatch_unit_id.slice(0, 8) : 'unit') },
  };
  const ROLES = ['citizen', 'barangay_official', 'lgu_ldrrmc', 'dispatch_team'];
  const SUPER_ADMIN_LABEL = 'Super Admin';

  /* ------------------------------------------------------------------ */
  /* CITIZEN DESKTOP (WEB) SHELL                                         */
  /* ------------------------------------------------------------------ */
  /* the resident shell, after the React build (uniguard/src/components:
     DashboardSidebar, DashboardHeader). Sidebar sections, then the
     secondary pages and the account with Sign out; the header keeps only SOS
     and the bell. css/resident.css */
  /* what a resident needs first in an emergency: where the danger is, what
     officials say, where to go, who to call, then relief */
  const RNAV = [
    ['home', 'Home', 'home'],
    ['map', 'Hazard Map', 'map'],
    ['advisories', 'Advisories', 'megaphone'],
    ['centers', 'Shelters', 'shelter'],
    ['hotlines', 'Hotlines', 'phone'],
    ['relief', 'Relief', 'relief'],
  ];
  const RMENU = [
    ['reports', 'My Reports', 'doc'],
    ['guides', 'Preparedness Guides', 'guide'],
    ['faqs', 'FAQs', 'faq'],
    ['offline', 'Offline Readiness', 'download'],
    ['settings', 'Settings', 'settings'],
  ];
  const RTITLE = {
    home: 'Home', report: 'Report a Hazard', relief: 'Relief', 'relief-verify': 'Relief',
    advisories: 'Advisories', 'advisory-detail': 'Advisories', map: 'Hazard Map', centers: 'Shelters',
    hotlines: 'Hotlines', notifications: 'Notifications', reports: 'My Reports', 'report-detail': 'My Reports',
    'report-done': 'Report a Hazard', guides: 'Preparedness Guides', faqs: 'FAQs', offline: 'Offline Readiness',
    settings: 'Settings', sos: 'Emergency SOS', roadwork: 'Road Work', more: 'More'
  };
  function rwActive(route) {
    return route === 'advisory-detail' ? 'advisories'
      : route === 'relief-verify' ? 'relief'
      : route === 'report-done' ? 'report'
      : route === 'report-detail' ? 'reports' : route;
  }

  const FOLD_KEY = 'uniguard_resident_sidebar_minimized';
  function folded() { try { return localStorage.getItem(FOLD_KEY) === 'true'; } catch (e) { return false; } }

  /* layered waves along the bottom of the sidebar */
  const WAVES = '<div class="rw-waves" aria-hidden="true"><svg viewBox="0 0 360 140" preserveAspectRatio="none">' +
    '<defs>' + [['#7F1D1D', '.45', '#5F0E1E', '.6'], ['#881337', '.5', '#4C0519', '.65'], ['#991B1B', '.55', '#450A0A', '.7'],
      ['#831843', '.6', '#3B0715', '.8'], ['#4C0519', '.75', '#240209', '.9']].map((g, n) =>
      '<linearGradient id="rwWave' + n + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + g[0] + '" stop-opacity="' + g[1] +
      '"/><stop offset="1" stop-color="' + g[2] + '" stop-opacity="' + g[3] + '"/></linearGradient>').join('') + '</defs>' +
    ['M0 38C70 20 140 54 220 30C275 14 320 28 360 22L360 140L0 140Z', 'M0 58C85 40 160 70 245 48C295 34 335 46 360 40L360 140L0 140Z',
     'M0 76C65 60 135 88 210 66C265 50 310 62 360 56L360 140L0 140Z', 'M0 96C90 82 175 106 260 84C305 72 335 80 360 76L360 140L0 140Z',
     'M0 114C75 102 150 122 230 106C285 94 325 102 360 98L360 140L0 140Z'].map((d, n) =>
      '<path d="' + d + '" fill="url(#rwWave' + n + ')"/>').join('') + '</svg></div>';
  /* the "Add your home address" reminder, once closed, stays closed for
     this account on this device (js/app.js rw-home-dismiss) */
  function homeAskHidden(st) {
    try { return localStorage.getItem('uniguard_homeask_hidden_' + ((st.session && (st.session.id || st.session.email)) || '')) === '1'; } catch (e) { return false; }
  }

  function rwItem(n, active, unread, cls) {
    return '<button class="rw-nav-i' + (cls || '') + (active === n[0] ? ' is-on' : '') + '"' + A('nav', attr({ route: n[0] })) + ' title="' + esc(n[1]) + '">' +
      I(n[2], 16) + '<span class="rw-lab">' + esc(n[1]) + '</span>' +
      (n[0] === 'notifications' && unread ? '<span class="rw-count">' + (unread > 9 ? '9+' : unread) + '</span>' : '') +
    '</button>';
  }

  function rwSide(st) {
    const s = st.session;
    const active = rwActive(st.route);
    const unread = (U.DATA.notifications || []).filter((n) => n.unread).length;
    return '<aside class="ug-rw-side" id="ug-resident-nav">' +
      '<div class="rw-brand">' +
        '<button class="rw-brand-btn"' + A('nav', attr({ route: 'home' })) + ' aria-label="Go to the home screen">' + U.brandMark(52) +
          '<span class="rw-word">Uni<em>Guard</em></span>' +
          (s.barangay ? '<span class="rw-tag">Brgy. ' + esc(s.barangay) + '</span>' : '') + '</button>' +
        '<div class="rw-fold"><button class="rw-fold-btn"' + A('rw-fold') + ' aria-label="Minimize sidebar" title="Minimize sidebar">' +
          '<span style="display:flex;transform:rotate(180deg)">' + I('chevron', 14) + '</span></button></div>' +
      '</div>' +
      '<nav class="rw-nav">' + RNAV.map((n) => rwItem(n, active, unread)).join('') +
        RMENU.map((n) => rwItem(n, active, 0, ' rw-nav-i--sub')).join('') +
      '</nav>' +
      /* the account and Sign out, formerly in the header's grid menu */
      '<div class="rw-acct">' +
        '<button class="rw-acct-me"' + A('nav', attr({ route: 'settings' })) + ' title="Account settings">' +
          '<span class="rw-acct-av">' + esc((s.name || 'U').trim().charAt(0).toUpperCase()) + '</span>' +
          '<span class="rw-acct-t"><b>' + esc(s.name || 'Resident') + '</b>' +
            '<small>' + (s.barangay ? 'Brgy. ' + esc(s.barangay) : 'Resident') + '</small></span></button>' +
        '<button class="rw-acct-out"' + A('logout') + ' aria-label="Sign out" title="Sign out">' + I('logout', 16) + '<span class="rw-lab">Sign out</span></button>' +
      '</div>' +
      WAVES +
    '</aside>';
  }

  function rwHead(st) {
    const s = st.session;
    const unread = (U.DATA.notifications || []).filter((n) => n.unread).length;
    const active = rwActive(st.route);
    const tip = (label) => ' data-tip="' + esc(label) + '"';
    return '<header class="ug-rw-head">' +
      '<div class="rw-head-l">' +
        '<button class="rw-ibtn rw-menu-btn"' + A('rw-drawer') + ' aria-label="Open the menu" aria-controls="ug-resident-nav">' + I('menu', 18) + '</button>' +
        '<span class="rw-pmark">' + U.brandMark(28) + '</span>' +
        '<h2>' + esc(RTITLE[st.route] || 'Home') + '</h2>' +
      '</div>' +
      UG_RW.phoneTabs(st) +
      '<div class="rw-head-r">' +
        '<span class="rw-tip"' + tip('Emergency SOS') + '><button class="rw-sos"' + A('sos-trigger') + ' aria-label="Emergency SOS">' + I('alert', 14) + 'SOS</button></span>' +
        '<span class="rw-tip rw-tip--phone"' + tip('Report Hazard') + '><button class="rw-ibtn' + (st.route === 'report' ? ' is-on' : '') + '"' + A('nav', attr({ route: 'report' })) + ' aria-label="Report Hazard">' + I('plus', 16) + '</button></span>' +
        /* the bell opens the notification panel (js/screens.js notifPanel) */
        '<span class="rw-tip ug-nwrap"' + (st.notifPanel ? '' : tip('Notifications')) + '><button class="rw-ibtn' + (active === 'notifications' || st.notifPanel ? ' is-on' : '') + '"' + A('notif-panel') +
          ' aria-label="Notifications' + (unread ? ', ' + unread + ' unread' : '') + '" aria-haspopup="dialog" aria-expanded="' + !!st.notifPanel + '">' + I('bell', 16) +
          (unread ? '<span class="rw-dot">' + (unread > 9 ? '9+' : unread) + '</span>' : '') + '</button>' + UG_SCREENS.notifPanel(st) + '</span>' +
      '</div>' +
    '</header>';
  }

  function cwMore(st) {
    return '<div class="ug-col" style="gap:14px">' +
      cwHead('More', 'Guides, FAQs, hotlines and offline readiness.') +
      '<div class="ug-wgrid-3">' +
        [['guides', 'Preparedness Guides', 'guide', 'What to do before, during and after every hazard.'],
         ['faqs', 'FAQs', 'faq', 'Answers about reports, relief, shelters and SOS.'],
         ['hotlines', 'Hotlines', 'phone', 'The official emergency numbers, cached offline.'],
         ['offline', 'Offline readiness', 'download', 'What works without a connection and how syncing behaves.'],
         ['notifications', 'Notifications', 'bell', 'Every push alert delivered to this device.'],
         ['map', 'Hazard Map', 'map', 'The live map with every overlay layer.']]
          .map((x) => '<button class="ug-card" style="text-align:left;cursor:pointer"' + A('nav', attr({ route: x[0] })) + '>' +
            '<div class="ug-card-b ug-col" style="gap:8px"><span style="color:var(--ug-signal);display:flex">' + I(x[2], 20) + '</span>' +
            '<div><div style="font-size:13px;font-weight:700">' + esc(x[1]) + '</div>' +
            '<div class="ug-dimmer" style="font-size:11px">' + esc(x[3]) + '</div></div></div></button>').join('') +
      '</div></div>';
  }

  function cwHead(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  const readout = (v, l, tone) =>
    '<div class="ug-col" style="gap:3px;padding:14px 16px;background:var(--ug-surface);border:1px solid var(--ug-line);border-radius:14px">' +
      '<span class="ug-mono" style="font-size:20px;font-weight:600;color:' + tone + '">' + v + '</span>' +
      '<span class="ug-dimmer" style="font-size:11px;letter-spacing:.05em;text-transform:uppercase">' + l + '</span></div>';

  /* advisory severity as the resident portal words it */
  const RSEV = { emergency: 'critical', warning: 'high', advisory: 'moderate', prepared: 'preparedness' };
  /* home advisory rows: the level in words */
  const HSEV = { emergency: 'Emergency', warning: 'Warning', advisory: 'Advisory', prepared: 'Preparedness' };
  const RSEV_LABEL = { critical: 'CRITICAL', high: 'HIGH', moderate: 'MODERATE', preparedness: 'PREPAREDNESS' };

  /* the resident home, after uniguard/src/components/ResidentHomeDraftView.tsx:
     figures, the newest advisory, your reports, reports near you to confirm,
     advisories, open shelters, hotlines and the offline copy */
  function cwHome(st) {
    const s = st.session || {};
    const incidents = U.DATA.incidents || [];
    const advisories = U.DATA.advisories || [];
    const myBrgy = s.barangay || UG_GEO.BARANGAYS[0];
    const inBrgy = (i) => s.barangay_id && i.brgy_id ? i.brgy_id === s.barangay_id : i.brgy === myBrgy;
    const open = (i) => i.status !== 'resolved' && i.status !== 'rejected';
    const inMyBrgy = incidents.filter((i) => inBrgy(i) && open(i)).length;
    const openCenters = (U.DATA.centers || []).filter((c) => c.status === 'open');
    const live = advisories.filter((a) => a.severity !== 'prepared');
    const mine = incidents.filter((i) => i.mine);
    const near = incidents.filter((i) => !i.mine && inBrgy(i) && open(i))
      .sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0)).slice(0, 3);
    const top = advisories[0];
    const done = st.corrDone || {};
    const cache = U.DATA.offlineCache || {};
    const ready = synced();
    const hotlines = U.DATA.hotlines || [];
    const sev = (a) => RSEV[a.severity] || 'moderate';
    const go = (route) => A('nav', attr({ route: route }));

    const stat = (label, value, note, icon, route) =>
      '<button class="rw-stat"' + go(route) + '>' +
        '<div class="rw-stat-top"><div style="min-width:0"><div class="rw-stat-l">' + esc(label) + '</div>' +
          '<div class="rw-stat-v">' + esc(String(value)) + '</div></div>' +
          '<span class="rw-stat-ico">' + I(icon, 24) + '</span></div>' +
        '<div class="rw-stat-f"><span class="rw-n">' + esc(note) + '</span>' + I('chevron', 16) + '</div>' +
      '</button>';

    const card = (title, acts, body) =>
      '<section class="rw-card"><div class="rw-card-h"><h3>' + esc(title) + '</h3><div class="rw-acts">' + acts + '</div></div>' + body + '</section>';

    const statusPill = (v) => '<span class="rw-pill ' + (v === 'verified' ? 'rw-pill--soft' : v === 'resolved' ? 'rw-pill--dark' : v === 'reported' ? 'rw-pill--light' : 'rw-pill--solid') + '">' + esc(v) + '</span>';

    return '<div class="ug-col rw-home" style="gap:32px">' +
      '<div class="rw-intro"><p>Live situation for <b>Barangay ' + esc(myBrgy) + ', ' + esc(UG_GEO.PLACE.label) + '</b>.</p>' +
        '<button class="rw-cta"' + go('report') + '><span>+</span>Report a Hazard</button></div>' +
      /* no home address yet: the SOS fallback needs it (migration 091) */
      /* the resident can close it; it stays closed on this device, and
         Settings › Home address is always there to add one later */
      (st.session && !st.session.home_address && !homeAskHidden(st)
        ? '<div class="rw-homeask-wrap"><button class="rw-homeask"' + A('rw-home-setup') + '>' + I('home', 18) + '<span><b>Add your home address</b>' +
            '<small>If you send an SOS with location off, responders go there.</small></span>' + I('chevron', 16) + '</button>' +
            '<button class="rw-homeask-x"' + A('rw-home-dismiss') + ' aria-label="Hide this reminder" title="Hide this reminder">' + I('x', 16) + '</button></div>'
        : '') +

      '<div class="rw-stats">' +
        stat('In Your Barangay', inMyBrgy, 'Active ground hazard reports', 'alert', 'map') +
        stat('Shelters Open', openCenters.length, 'Available for intake', 'shelter', 'centers') +
        stat('Active Advisories', live.length, 'Official bulletins', 'bell', 'advisories') +
      '</div>' +

      (top ? '<button class="rw-hero"' + A('open-advisory', attr({ id: top.id })) + '><div class="rw-hero-in">' +
          '<h3>' + esc(top.title) + '</h3>' +
          '<div class="rw-hero-m">' + I('pin', 16) + '<span>' + esc(top.area) + ' • ' + esc(top.time) + '</span></div>' +
        '</div><img class="rw-hero-logo" src="img/ldrrmo-lingayen.png" alt="" aria-hidden="true"></button>' : '') +

      card('Your Reports',
        (mine.length ? '<button class="rw-btn rw-btn--dark"' + go('reports') + '>View All</button>' : '') +
        '<button class="rw-btn rw-btn--red rw-newrep-home"' + go('report') + '>+ New Report</button>',
        '<div class="rw-card-b">' + (mine.length
          ? '<div class="rw-mine">' + mine.slice(0, 3).map((i) =>
              '<button class="rw-tile"' + A('open-report', attr({ id: i.id })) + '><div class="rw-main" style="gap:4px">' +
                '<div class="rw-t"><b>' + esc(i.hazard) + '</b><span class="rw-sub">• Brgy. ' + esc(i.brgy) + '</span></div>' +
                '<p class="rw-desc">' + esc(i.desc) + '</p></div>' + statusPill(i.status) + '</button>').join('') + '</div>'
          : '<div class="rw-empty"><p>You haven\'t submitted any incident reports yet.</p>' +
              '<button' + go('report') + '>+ Submit a ground hazard report</button></div>') + '</div>') +

      card('Reported Near You', '',
        (st.nearNotice ? '<p class="rw-notice">' + esc(st.nearNotice) + '</p>' : '') +
        '<div class="rw-rows' + (near.length > 3 ? ' rw-rows--scroll' : '') + '">' + (near.length ? near.map((i) => {
          const key = i.uuid || i.id;
          const ok = !!done[key];
          const busy = st.corrBusy === key;
          return '<div class="rw-row" role="button" tabindex="0"' + A('open-report', attr({ id: i.id })) + '><div class="rw-main">' +
              '<div class="rw-t"><b>' + esc(i.hazard) + '</b><span class="rw-pill rw-pill--mini">' + esc(i.status === 'reported' ? 'Reported' : i.status) + '</span></div>' +
              '<div class="rw-meta"><span>' + I('clock', 14) + esc(i.time) + '</span><span>' + I('pin', 14) + esc(i.brgy) + '</span>' +
                '<span title="Confirmations needed to verify">' + I('shield', 14) + Math.min(i.corr || 0, 3) + '/3</span></div></div>' +
            '<button class="rw-btn ' + (ok ? 'rw-btn--done' : 'rw-btn--red') + '"' +
              (ok || st.corrBusy ? ' disabled' : A('confirm-corr', attr({ id: key, from: 'home' }))) + '>' +
              (ok ? I('check', 14) + 'Confirmed' : busy ? 'Confirming…' : 'Confirm') + '</button>' +
          '</div>';
        }).join('') : '<p class="rw-empty rw-empty--row" style="margin:0;font-size:14px">No other open reports in your barangay.</p>') + '</div>') +

      card('Advisories and Alerts',
        '<button class="rw-btn rw-btn--dark"' + go('advisories') + '>View All</button>',
        /* phones keep the original rows (.rh-m); wider screens get the
           minimal list below (.rh-d) */
        '<div class="rw-rows rh-m">' + advisories.slice(0, 3).map((a) =>
          '<button class="rw-row"' + A('open-advisory', attr({ id: a.id })) + '><div class="rw-main">' +
              '<div class="rw-t"><span class="rw-dotc rw-dot--' + sev(a) + '"></span><h4>' + esc(a.title) + '</h4></div>' +
              '<div class="rw-meta rw-in"><span>' + I('pin', 14) + esc(a.area) + ' ' + (a.severity === 'prepared' ? 'Preparedness' : 'Emergency') + ' • ' + esc(a.time) + '</span></div></div>' +
            '</button>').join('') + '</div>' +
        '<div class="rh-list rh-d">' + (advisories.length ? advisories.slice(0, 3).map((a) => {
          /* the home's own language: a small crimson dot for the level, the
             title, then quiet grey facts */
          return '<button class="rh-row"' + A('open-advisory', attr({ id: a.id })) + '>' +
              '<span class="rh-main"><span class="rh-t"><span class="rw-dotc rw-dot--' + sev(a) + '"></span><b>' + esc(a.title) + '</b></span>' +
                '<span class="rh-meta"><span>' + HSEV[a.severity || 'advisory'] + '</span><span>' + I('pin', 13) + esc(a.area) + '</span><span>' + I('clock', 13) + esc(a.time) + '</span></span></span>' +
              '<span class="rh-chev">' + I('chevron', 16) + '</span></button>';
        }).join('') : '<p class="rw-empty rw-empty--row" style="margin:0;font-size:14px">No advisories right now.</p>') + '</div>') +

      card('Nearest Open Shelters', '<button class="rw-btn rw-btn--dark"' + go('centers') + '>All Shelters</button>',
        (openCenters.length ? '<div class="rw-rows rh-m">' + openCenters.slice(0, 3).map((c) =>
          '<button class="rw-row"' + A('open-center-detail', attr({ id: c.uuid || c.id })) + '><div class="rw-main">' +
              '<div class="rw-t"><h4>' + esc(c.name) + '</h4></div>' +
              '<div class="rw-meta rw-in"><span>' + I('pin', 14) + 'Brgy. ' + esc(c.brgy) + '</span>' +
                '<span class="rw-mono" style="color:#404040">' + I('users', 14) + c.occ + ' / ' + c.cap + ' evacuees</span></div></div>' +
            '</button>').join('') + '</div>' : '') +
        /* each shelter: its name, barangay, and how full it is as a bar */
        '<div class="rh-list' + (openCenters.length ? ' rh-d' : '') + '">' + (openCenters.length ? openCenters.slice(0, 3).map((c) => {
          const cap = Number(c.cap) || 0, occ = Number(c.occ) || 0;
          const pct = cap ? Math.min(100, Math.round(occ / cap * 100)) : 0;
          const left = Math.max(0, cap - occ);
          return '<button class="rh-row"' + A('open-center-detail', attr({ id: c.uuid || c.id })) + '>' +
              '<span class="rh-main"><span class="rh-t"><b>' + esc(c.name) + '</b></span>' +
                '<span class="rh-meta"><span>' + I('pin', 13) + 'Brgy. ' + esc(c.brgy) + '</span><span>' + I('users', 13) + occ + ' / ' + cap + ' evacuees</span></span>' +
                '<span class="rh-cap"><i style="width:' + pct + '%"></i></span></span>' +
              '<span class="rh-side"><b>' + left.toLocaleString() + '</b><small>space' + (left === 1 ? '' : 's') + ' left</small></span>' +
              '<span class="rh-chev">' + I('chevron', 16) + '</span></button>';
        }).join('')
          : '<p class="rw-empty rw-empty--row" style="margin:0;font-size:14px">No shelter is open right now.</p>') + '</div>') +

      card('Emergency Hotlines', '<button class="rw-btn rw-btn--dark"' + go('hotlines') + '>View All</button>',
        '<div class="rw-rows">' + hotlines.slice(0, 4).map((h) =>
          '<div class="rw-row" role="button" tabindex="0"' + go('hotlines') + '><div class="rw-main" style="gap:4px">' +
              '<div class="rw-t"><h4>' + esc(h.agency) + '</h4></div><p class="rw-num">' + esc(h.number) + '</p></div>' +
            '<a class="rw-call" href="tel:' + esc(String(h.number).replace(/[^\d+]/g, '')) + '" onclick="event.stopPropagation()" title="Call ' + esc(h.agency) + '" aria-label="Call ' + esc(h.agency) + '">' + I('phone', 16) + '</a>' +
          '</div>').join('') + '</div>') +

      '<button class="rw-offline"' + go('offline') + '>' +
        '<span class="rw-col"><span class="rw-kv"><span class="rw-k">Offline copy:</span><span class="rw-ok">' + (ready ? 'Ready' : 'Not yet synced') + '</span></span>' +
          '<span class="rw-kv"><span class="rw-k">Last sync:</span><span class="rw-v">' + esc(cache.synced || '—') + '</span></span></span>' +
        '<span class="rw-kv"><span class="rw-k">Hotlines cached:</span><span class="rw-cnt">' + hotlines.length + '</span></span>' +
      '</button>' +
    '</div>';
  }

  function cwReport(st) {
    const r = st.report;
    const urg = [['advisory', 'Looks Minor'], ['warning', 'Getting Worse'], ['emergency', 'People at Risk']];
    return '<div class="ug-col" style="gap:18px">' +
      cwHead(st.editing ? 'Edit Your Report' : 'Report a Hazard', st.editing ? 'Corrections stay within the same rules as filing — the change is audit-logged.' : 'Multi-Hazard Reporting. Your report reaches your barangay queue with its timestamp and position.',
        st.editing
          ? '<button class="ug-btn ug-btn--ghost"' + A('cancel-edit') + '>Cancel edit</button>'
          : '<button class="ug-btn ug-btn--ghost"' + A('nav', attr({ route: 'home' })) + '>Cancel</button>') +
      '<div class="ug-wgrid-form">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Hazard Details</h3><span class="ug-dimmer" style="font-size:11px">Step 1 of 2</span></div>' +
          '<div class="ug-card-b">' +
            '<div class="ug-wgrid-2">' +
              selectField('hazard', 'Hazard Type', U.DATA.hazards.map(h => [h, h]), r.hazard) +
              selectField('brgy', 'Barangay Jurisdiction', U.DATA.barangays.map(b => [b, b]), r.brgy) +
            '</div>' +
            (UG_HAZARDS.classify(r.hazard).key === 'other'
              ? '<div class="ug-field"><label class="ug-lab">Tell Us What the Hazard Is</label>' +
                '<input class="ug-in" data-field="hazardOther" placeholder="e.g. downed utility pole" value="' + esc(r.hazardOther || '') + '">' +
                '<div class="ug-help">Required when the hazard type is "Others".</div></div>'
              : '') +
            '<div class="ug-field" style="margin-bottom:14px"><label class="ug-lab">How Urgent Does It Look</label>' +
              '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + urg.map(u =>
                '<button class="ug-chip' + (r.urg === u[0] ? ' is-on' : '') + '"' + A('set-urg', attr({ v: u[0] })) + '>' +
                U.ladder(u[0]) + u[1] + '</button>').join('') + '</div></div>' +
            '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Description and Hazard Details</label>' +
              '<textarea class="ug-ta" rows="6" data-field="desc" placeholder="Describe what you are seeing: water depth (knee or waist high), affected roads, trapped families, or nearby landmarks.">' + esc(r.desc) + '</textarea>' +
              '<div class="ug-help">Landmark references help responders find the exact spot.</div></div>' +
          '</div></div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Photo Evidence</h3><span class="ug-dimmer" style="font-size:11px">Optional</span></div>' +
            '<div class="ug-card-b">' +
              (r.photo
                ? '<div class="ug-rowf ug-gap12" style="gap:10px;align-items:center;border:1px solid var(--ug-line);border-radius:10px;padding:9px">' + (r.photoPreview ? '<img src="' + esc(r.photoPreview) + '" alt="Selected photo preview" style="width:62px;height:46px;border-radius:8px;object-fit:cover;flex:none;border:1px solid var(--ug-line)">' : '') +
                  '<div style="min-width:0"><div style="font-size:12px;font-weight:600">' + esc(r.photoName || 'hazard-photo.jpg') + '</div>' +
                  '<div class="ug-dimmer" style="font-size:11px">' + esc(UG_UTIL.bytes(r.photoBytes || 0)) + ' after compression</div></div>' +
                  '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('rm-photo') + '>Replace</button></div>'
                : '<button class="ug-upload" style="width:100%"' + A('add-photo') + '><span class="up-ico">' + I('camera', 22) + '</span>' +
                  '<span style="font-size:13px;font-weight:600">Tap to Attach a Hazard Photo</span>' +
                  '<span class="ug-dimmer" style="font-size:11px">JPG or PNG up to 10 MB</span></button>') +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Incident Location</h3>' + (r.gpsDenied && !r.gps ? '<span class="ug-dimmer" style="font-size:11px;color:var(--ug-warning)">GPS unavailable</span>' : '') + '</div>' +
            '<div class="ug-card-b">' +
              (r.gpsDenied && !r.gps
                ? '<div class="ug-note" style="margin-bottom:10px">We could not read your GPS. The location is needed to route the report to the right barangay and to verify it with nearby reports — drop the pin on the map below at the hazard spot.</div>' : '') +
              '<div class="ug-geo"><span class="geo-ico">' + I('pin', 18) + '</span>' +
              '<span style="min-width:0"><span class="geo-val">' + (r.gps && UG_GEO.isNum(r.lat) ? UG_GEO.fmt(r.lat, r.lng) : 'Not set — drop the pin on the map') + '</span>' +
              '<span class="geo-sub">' + (r.address || (r.gps ? 'Position captured' : 'Drag the pin to the hazard location')) + '</span></span>' +
              '<button class="ug-btn ug-btn--sm" style="margin-left:auto"' + A('gps') + '>' + (r.gps ? 'Refresh' : 'Acquire GPS') + '</button></div>' +
              '<div class="ug-note" data-pin-outside style="margin-top:12px"' + (r.pinOutside ? '' : ' hidden') + '>' + esc(T('report.pinOutside')) + '</div>' +
              '<div class="ug-map" data-map="report-pin" style="height:220px;margin-top:12px;border-radius:10px;overflow:hidden">' + U.mapSVG({}) + '</div>' +
              '<div class="ug-help" style="margin-top:8px">Drag the pin to the hazard. The server confirms which barangay receives the report from these coordinates.</div>' +
              '<div class="ug-field" style="margin-top:10px;margin-bottom:0"><label class="ug-lab">Exact address / landmark (optional)</label>' +
              '<input class="ug-in" data-field="reportAddress" value="' + esc(r.locationNote || '') + '" placeholder="e.g. beside the seawall, near the chapel"></div>' +
            '</div></div>' +
          '<button class="ug-btn ug-btn--signal ug-btn--block' + (r.desc.trim() ? '' : ' is-disabled') + '"' + A('submit-report') + '>' +
            I('check', 16) + (st.editing ? 'Save changes' : 'Submit Report') + '</button>' +
          '<div class="ug-dimmer" style="font-size:11px;text-align:center;margin-top:-8px">' + (st.editing ? 'Editing ' + esc(st.editing.code || '') + ' — audit-logged.' : 'Reports stay editable for 15 minutes after submission.') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* the line under the header on resident pages: the header already names
     the page, so only the subtitle and the page's own buttons show here */
  function rwLead(sub, actions) {
    return '<div class="rw-lead"><p>' + esc(sub) + '</p>' + (actions ? '<div class="rw-acts">' + actions + '</div>' : '') + '</div>';
  }
  const RTAG = { emergency: 'Emergency', warning: 'Warning', advisory: 'Advisory', prepared: 'Preparedness' };
  const RTAG_COLOR = { Emergency: '#B91C1C', Warning: '#C2410C', Advisory: '#A16207', Preparedness: '#15803D' };
  const tagLabel = (tag) => '<span class="rw-tag2"><i style="background:' + RTAG_COLOR[tag] + '"></i>' + esc(tag) + '</span>';
  const isNew = (iso) => iso && Date.now() - Date.parse(iso) < 24 * 3600000;
  /* whether an offline copy exists on this device */
  const synced = () => !!((typeof UG_PWA !== 'undefined' && UG_PWA.state && UG_PWA.state.lastSync) ||
    (typeof Repo !== 'undefined' && Repo.state && Repo.state.hasSynced));
  const telOf = (n) => 'tel:' + esc(String(n || '').replace(/[^\d+]/g, ''));

  /* Advisories, after uniguard/src/components/AdvisoryCenter.tsx (resident feed) */
  function cwAdvisories(st) {
    const f = st.sevFilter || 'all';
    const all = U.DATA.advisories || [];
    const chips = [['all', 'All'], ['emergency', 'Emergency'], ['warning', 'Warning'], ['advisory', 'Advisory'], ['prepared', 'Preparedness']];
    const list = all.filter((a) => f === 'all' || a.severity === f);
    /* phone: the filter is a plain dropdown (as on Shelters / Hotlines) */
    const cnt = (v) => v === 'all' ? all.length : all.filter((x) => x.severity === v).length;
    const curC = chips.find((c) => c[0] === f) || chips[0];
    const lbl = (c) => c[0] === 'all' ? 'All advisories' : c[1];
    const dd = '<div class="rw-adv-bar"><div class="ug-wmore rw-shdd rw-adv-dd">' +
      '<button class="rw-shdd-btn"' + A('toggle-more') + ' aria-haspopup="listbox">' +
        (f !== 'all' ? '<i style="background:' + RTAG_COLOR[RTAG[f]] + '"></i>' : '') + '<span>' + lbl(curC) + '</span><b>' + cnt(curC[0]) + '</b>' + I('chevdn', 14) + '</button>' +
      '<div class="rw-shdd-panel" data-more-panel hidden role="listbox">' + chips.map((c) =>
        '<button role="option" class="' + (c[0] === f ? 'is-on' : '') + '"' + A('sev-filter', attr({ v: c[0] })) + '>' +
          '<i style="background:' + (c[0] === 'all' ? '#991B1B' : RTAG_COLOR[RTAG[c[0]]]) + '"></i><span>' + lbl(c) + '</span><b>' + cnt(c[0]) + '</b>' +
          (c[0] === f ? I('check', 14) : '') + '</button>').join('') +
      '</div></div></div>';
    return '<div class="ug-col rw-advp" style="gap:20px">' +
      rwLead('Official warnings and updates from the Lingayen LDRRMO.') + dd +
      '<div class="rw-seg" role="tablist" aria-label="Filter advisories">' + chips.map((c) =>
        '<button class="rw-seg-i' + (f === c[0] ? ' is-on' : '') + '" role="tab" aria-selected="' + (f === c[0]) + '"' + A('sev-filter', attr({ v: c[0] })) + '>' +
          (c[0] !== 'all' ? '<i style="background:' + RTAG_COLOR[RTAG[c[0]]] + '"></i>' : '') + '<span>' + c[1] + '</span>' +
          '<b>' + (c[0] === 'all' ? all.length : all.filter((x) => x.severity === c[0]).length) + '</b></button>').join('') + '</div>' +
      (list.length
        ? '<div class="rw-grid rw-grid--adv">' + list.map((a) =>
          '<button class="rw-acard"' + A('open-advisory', attr({ id: a.id })) + '>' +
            '<div class="ug-col" style="gap:10px">' +
              '<div class="rw-acard-top">' + tagLabel(RTAG[a.severity] || 'Advisory') +
                '<span class="rw-date">' + (isNew(a.created_at) ? '<span class="rw-new">New</span>' : '') + esc(a.time) + '</span></div>' +
              '<h3>' + esc(a.title) + '</h3>' +
              '<p class="rw-clamp3">' + esc(a.body) + '</p>' +
            '</div>' +
            '<div class="rw-acard-f"><span class="rw-loc">' + I('pin', 14) + '<span>' + esc(a.area) + '</span></span>' +
              '<span class="rw-read">Read' + I('chevron', 14) + '</span></div>' +
          '</button>').join('') + '</div>'
        : '<div class="rw-blank">' + I('megaphone', 40) + '<h3>No advisories here right now</h3><p>Try another filter, or check back later.</p></div>') +
    '</div>';
  }

  /* one advisory, read in full: the advisory, what to do, save and share */
  function cwAdvisory(st) {
    const a = Repo.findAdvisory(st.openId);
    if (!a) return '<div class="rw-blank"><h3>Advisory unavailable</h3>' +
      '<button class="rw-back"' + A('nav', attr({ route: 'advisories' })) + '>Back to Advisories</button></div>';
    const preparing = a.severity === 'prepared';
    const steps = preparing
      ? ['Agree on a family meeting point and an out-of-town contact.', 'Prepare a go-bag with water, food, documents and a power bank.', 'Join the municipality-wide drill and practise duck, cover and hold.']
      : ['Move to the nearest open evacuation centre if advised.', 'Avoid the affected roads and never cross moving flood water.', 'Bring water, medication, identification and a phone charger.', 'Keep monitoring official advisories for updates.'];
    const tag = RTAG[a.severity] || 'Advisory';
    return '<div class="ug-col" style="gap:20px">' +
      '<button class="rw-back"' + A('nav', attr({ route: 'advisories' })) + '><span style="display:flex;transform:rotate(180deg)">' + I('chevron', 16) + '</span>Back to Advisories</button>' +
      '<div class="rw-reader">' +
        '<article class="ug-col" style="gap:16px;min-width:0">' +
          '<header class="rw-rhero"><div class="rw-hero-tags"><span class="t1">' + esc(tag) + '</span>' +
              (a.type !== tag ? '<span class="t3">' + esc(a.type) + '</span>' : '') + '</div>' +
            '<h2>' + esc(a.title) + '</h2>' +
            '<div class="rw-rmeta"><span>' + I('pin', 14) + esc(a.area) + '</span><span>' + I('clock', 14) + 'Published ' + esc(UG_UTIL.absTime(a.created_at) || a.time) + '</span>' +
              (a.expires_at ? '<span>' + I('clock', 14) + 'Valid until ' + esc(UG_UTIL.absTime(a.expires_at)) + '</span>' : '') + '</div></header>' +
          '<div class="rw-panel rw-prose">' + esc(a.body) + '</div>' +
        '</article>' +
        '<aside class="ug-col" style="gap:16px;min-width:0">' +
          '<div class="rw-panel" style="padding:0;overflow:hidden"><div class="rw-panel-h">' + (preparing ? 'How to Prepare' : 'What to Do Now') + '</div>' +
            '<ol class="rw-steps">' + steps.map((x, n) => '<li><b>' + String(n + 1).padStart(2, '0') + '</b><span>' + esc(x) + '</span></li>').join('') + '</ol></div>' +
          '<div class="rw-panel ug-col" style="gap:10px;padding:16px">' +
            '<button class="rw-pbtn rw-pbtn--red"' + A('save-advisory') + '>' + I('download', 16) + 'Save Offline</button>' +
            '<button class="rw-pbtn rw-pbtn--line"' + A('share-advisory') + '>' + I('route', 16) + 'Share</button>' +
          '</div>' +
        '</aside>' +
      '</div>' +
    '</div>';
  }

  /* Shelters, after uniguard/src/components/EvacuationDirectory.tsx (resident) */
  function cwCenters(st) {
    const f = st.centerFilter || 'all';
    const scope = st.shelterScope || 'all';
    const myBrgy = (st.session && st.session.barangay) || UG_GEO.BARANGAYS[0];
    const all = U.DATA.centers || [];
    const scoped = scope === 'mine' ? all.filter((c) => c.brgy === myBrgy) : all;
    const list = scoped.filter((c) => f === 'all' || c.status === f);
    return '<div class="ug-col" style="gap:24px">' +
      '<section class="rw-card rw-shelters">' +
        '<div class="rw-toolbar">' +
          (() => {
            /* status filter as a dropdown (toggle-more opens, a tap outside closes) */
            const opts = [['all', 'All shelters'], ['open', 'Open'], ['full', 'Full'], ['closed', 'Closed']];
            const cnt = (v) => v === 'all' ? scoped.length : scoped.filter((x) => x.status === v).length;
            const cur = opts.find((o) => o[0] === f) || opts[0];
            return '<div class="ug-wmore rw-shdd">' +
              '<button class="rw-shdd-btn"' + A('toggle-more') + ' aria-haspopup="listbox">' +
                (f !== 'all' ? '<i class="is-' + f + '"></i>' : '') + '<span>' + cur[1] + '</span><b>' + cnt(cur[0]) + '</b>' + I('chevdn', 14) + '</button>' +
              '<div class="rw-shdd-panel" data-more-panel hidden role="listbox">' + opts.map((o) =>
                '<button role="option" class="' + (o[0] === f ? 'is-on' : '') + '"' + A('center-filter', attr({ v: o[0] })) + '>' +
                  (o[0] !== 'all' ? '<i class="is-' + o[0] + '"></i>' : '<i class="is-all"></i>') + '<span>' + o[1] + '</span><b>' + cnt(o[0]) + '</b>' +
                  (o[0] === f ? I('check', 14) : '') + '</button>').join('') +
              '</div></div>';
          })() +
          '<div class="rw-shseg" role="group" aria-label="Barangay">' +
            '<button class="' + (scope === 'all' ? 'is-on' : '') + '"' + A('shelter-scope', attr({ v: 'all' })) + '>All</button>' +
            '<button class="' + (scope === 'mine' ? 'is-on' : '') + '"' + A('shelter-scope', attr({ v: 'mine' })) + '>' + I('pin', 13) + esc(myBrgy) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="rw-card-b">' + (list.length
          ? '<div class="rw-grid rw-grid--3 rw-scgrid">' + list.slice().sort((a, b) => {
              /* open shelters with space first, then full, then closed */
              const rank = (c) => c.status === 'closed' ? 2 : (c.status === 'full' || (c.cap && c.occ >= c.cap)) ? 1 : 0;
              return rank(a) - rank(b);
            }).map((c) => {
            const cap = c.cap || 0, occ = c.occ || 0, left = Math.max(0, cap - occ);
            const pct = cap ? Math.min(100, Math.round(occ / cap * 100)) : 0;
            const id = c.uuid || c.id;
            const hasPos = c.lat != null && c.lng != null;
            const st = c.status === 'closed' ? 'closed' : (c.status === 'full' || (cap && left === 0)) ? 'full' : 'open';
            const ST = { open: 'Open', full: 'Full', closed: 'Closed' };
            const fac = c.facilities || [];
            return '<div class="rw-scard rw-sc2 is-' + st + '" role="button" tabindex="0"' + A('open-center-detail', attr({ id: id })) + '>' +
              '<div class="rw-sc2-top"><h4>' + esc(c.name) + '</h4><span class="rw-sc2-st is-' + st + '"><i></i>' + ST[st] + '</span></div>' +
              '<p class="rw-sc2-loc">' + I('pin', 14) + '<span>Brgy. ' + esc(c.brgy) + '</span></p>' +
              '<div class="rw-sc2-occ">' +
                '<div class="rw-sc2-occ-h"><div><b>' + (st === 'closed' ? '—' : left.toLocaleString()) + '</b><span>' + (st === 'closed' ? 'not taking evacuees' : 'space' + (left === 1 ? '' : 's') + ' left') + '</span></div>' +
                  '<small>' + occ.toLocaleString() + ' / ' + cap.toLocaleString() + '</small></div>' +
                '<div class="rw-sc2-bar"><i class="is-' + st + '" style="width:' + pct + '%"></i></div>' +
              '</div>' +
              /* the least-used details fold into "More" (as on the barangay
                 console): notes, facilities and the contact. Kept open across
                 re-renders; closes when the pointer leaves the card. */
              ((c.note || fac.length || c.contact_phone)
                ? '<details class="sc-more rw-sc2-more" data-sc-more="rw-' + esc(id) + '"' + (window.UG_SC_OPEN && window.UG_SC_OPEN['rw-' + id] ? ' open' : '') + ' onclick="event.stopPropagation()">' +
                    '<summary>' + I('chevdn', 14) + 'More<em>' + [c.note ? 'notes' : '', fac.length ? fac.length + ' facilit' + (fac.length === 1 ? 'y' : 'ies') : '', c.contact_phone ? 'contact' : ''].filter(Boolean).join(' · ') + '</em></summary>' +
                    '<div class="sc-more-b">' +
                      (c.note ? '<p class="rw-sc2-note">' + esc(c.note) + '</p>' : '') +
                      (fac.length ? '<div class="rw-sc2-fac">' + fac.map((x) => '<span>' + I('check', 13) + esc(x) + '</span>').join('') + '</div>' : '') +
                      (c.contact_phone ? '<a class="rw-sc2-tel" href="' + telOf(c.contact_phone) + '" onclick="event.stopPropagation()">' + I('phone', 14) +
                        '<span>' + (c.contact_person ? esc(c.contact_person) + ' · ' : '') + esc(c.contact_phone) + '</span></a>' : '') +
                    '</div></details>'
                : '') +
              '<div class="rw-sc2-acts">' +
                (hasPos ? '<a class="rw-sbtn rw-sbtn--red" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(c.lat, c.lng) + '" onclick="event.stopPropagation()">' + I('route', 14) + 'Navigate</a>'
                  : '<span class="rw-sc2-nopos">No map location yet</span>') +
                '<button class="rw-sc2-ico"' + A('open-center-detail', attr({ id: id })) + ' title="Details" aria-label="Details">' + I('doc', 15) + '</button>' +
                '<button class="rw-sc2-ico"' + A('save-center-offline', attr({ id: id })) + ' title="Save for offline use" aria-label="Save for offline use">' + I('download', 15) + '</button>' +
              '</div>' +
            '</div>';
          }).join('') + '</div>'
          : '<div class="rw-blank" style="box-shadow:none;border:0">' + I('shelter', 40) + '<h3>No evacuation centers match your search</h3><p>Try adjusting your filter.</p>' +
              '<button class="rw-linkbtn"' + A('center-filter', attr({ v: 'all' })) + '>Clear filter</button></div>') + '</div>' +
      '</section>' +
    '</div>';
  }

  /* Hotlines, after uniguard/src/components/HotlineDirectory.tsx */
  function hotlineTag(h) {
    const name = String(h.agency || '').toLowerCase();
    if (/bfp|fire/.test(name)) return 'FIRE AND RESCUE';
    if (/pnp|police/.test(name)) return 'POLICE ASSISTANCE';
    if (/medical|health|red cross|relief/.test(String(h.scope || '').toLowerCase() + ' ' + name)) return 'MEDICAL AND RELIEF';
    if (/coast guard/.test(name)) return 'COASTAL RESCUE';
    return String(h.scope || '').toUpperCase();
  }
  function cwHotlines(st) {
    const all = U.DATA.hotlines || [];
    /* filter by category (the tag shown on each row); dropdown as on Shelters */
    const tags = [];
    all.forEach((h) => { const t = hotlineTag(h); if (t && tags.indexOf(t) === -1) tags.push(t); });
    const f = tags.indexOf(st.hotlineFilter) !== -1 ? st.hotlineFilter : 'all';
    const list = f === 'all' ? all : all.filter((h) => hotlineTag(h) === f);
    const nice = (t) => t.charAt(0) + t.slice(1).toLowerCase();
    const opts = [['all', 'All hotlines', all.length]].concat(tags.map((t) => [t, nice(t), all.filter((h) => hotlineTag(h) === t).length]));
    const cur = opts.find((o) => o[0] === f) || opts[0];
    const dd = '<div class="ug-wmore rw-shdd rw-hotl-dd">' +
      '<button class="rw-shdd-btn"' + A('toggle-more') + ' aria-haspopup="listbox"><span>' + esc(cur[1]) + '</span><b>' + cur[2] + '</b>' + I('chevdn', 14) + '</button>' +
      '<div class="rw-shdd-panel" data-more-panel hidden role="listbox">' + opts.map((o) =>
        '<button role="option" class="' + (o[0] === f ? 'is-on' : '') + '"' + A('hotline-filter', attr({ v: o[0] })) + '><span>' + esc(o[1]) + '</span><b>' + o[2] + '</b>' +
          (o[0] === f ? I('check', 14) : '') + '</button>').join('') +
      '</div></div>';
    return '<div class="ug-col" style="gap:24px">' +
      '<section class="rw-card rw-hotl"><div class="rw-hotl-h">' + dd +
        '<button class="rw-hotl-save"' + A('save-center-offline', attr({ id: 'hotlines' })) + '>' + I('download', 14) + 'Save offline</button></div>' +
        '<div class="rw-rows">' + (list.length ? list.map((h) =>
        '<div class="rw-row" style="cursor:default"><div class="rw-main">' +
            '<div class="rw-t"><h4 style="font-size:14px">' + esc(h.agency) + '</h4></div>' +
            '<p class="rw-num" style="font-size:13px;margin:0">' + esc(h.number) + '</p></div>' +
          '<a class="rw-callbtn" href="' + telOf(h.number) + '" title="Call ' + esc(h.agency) + '">' + I('phone', 14) + '<span>Call</span></a>' +
        '</div>').join('')
        : '<p class="rw-empty rw-empty--row" style="margin:0;font-size:14px">No hotlines saved yet.</p>') + '</div></section>' +
      '<p class="rw-hotl-tip">' + I('info', 15) + '<span>If a line is busy, keep the call short and state your barangay, landmark and number of people needing help.</span></p>' +
    '</div>';
  }

  /* Notifications, after uniguard/src/components/ResidentNotificationsView.tsx */
  const NLEVEL = { emergency: ['Urgent', '#B91C1C'], warning: ['Warning', '#C2410C'], advisory: ['Advisory', '#A16207'] };
  function cwNotifications(st) {
    const all = UG_SCREENS.notifRows();
    const unread = all.filter((n) => n.unread).length;
    /* the same filters as the bell's panel (js/screens.js notifFilter) */
    const F = UG_SCREENS.notifFilter(all, st.notifFilter || 'all');
    const list = F.shown;
    const today = new Date().toDateString();
    const lv = (n) => NLEVEL[n.tone] || ['Notice', '#737373'];
    const openAttr = (n) => A('open-notification', attr({ id: n.id || '', advisory: n.advisory_id || '', report: n.report_id || '',
      'road-work': n.road_work_id || '', sos: n.sos_id || '', relief: n.relief_id || '' }));
    const cache = U.DATA.offlineCache || {};
    /* when it was sent: "Sent 9:42 AM" today, "Sent Nov 12, 9:42 AM" before */
    const sentAt = (n) => {
      let t = n.created_at ? new Date(n.created_at) : null;
      if (!t || isNaN(t)) {
        /* no timestamp on file: work it out from "12m ago" / "3h ago" / "2d ago" */
        const m = String(n.time || '').match(/(\d+)\s*(s|m|h|d)/i);
        if (!m) return '';
        t = new Date(Date.now() - Number(m[1]) * ({ s: 1e3, m: 6e4, h: 36e5, d: 864e5 })[m[2].toLowerCase()]);
      }
      const clock = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return 'Sent ' + (t.toDateString() === today ? clock : t.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + clock);
    };
    return '<div class="ug-col" style="gap:20px">' +
      '<section class="rw-card"><div class="rw-card-h rw-nhead"><div><h3>Notifications</h3><span class="rw-hint">' + (unread ? unread + ' unread' : 'All caught up') + '</span></div>' +
        (unread ? '<button class="rw-markall"' + A('read-all') + '>' + I('check', 14) + 'Mark all as read</button>' : '') + '</div>' +
        /* the same "Show All · 70" dropdown as the bell's panel */
        '<div class="rw-nfilter">' + UG_SCREENS.notifFilterMenu(F) + '</div>' +
        '<ul class="rw-nlist">' + (list.length ? list.map((n) =>
          '<li class="' + (n.unread ? 'is-unread' : '') + '"><button' + openAttr(n) + '>' +
            '<i class="rw-ndot"></i>' +
            '<span class="rw-nmain"><span class="rw-ntop"><span class="rw-ntitle">' + esc(n.title) + '</span>' +
              '<span class="rw-tag2"><i style="background:' + lv(n)[1] + '"></i>' + esc(lv(n)[0]) + '</span></span>' +
              (n.body ? '<span class="rw-nbody">' + esc(n.body) + '</span>' : '') +
              '<span class="rw-nmeta">' + esc(n.time || '') + (sentAt(n) ? '<span class="rw-nsent"> · ' + esc(sentAt(n)) + '</span>' : '') + '</span></span>' +
            I('chevron', 16) + '</button></li>').join('')
          : '<li class="rw-blank" style="box-shadow:none;border:0;border-radius:0">' + I('bell', 40) + '<h3>' + (all.length ? 'Nothing here' : 'No notifications yet') + '</h3></li>') + '</ul>' +
      '</section>' +
      '<p class="rw-quiet">' + I('wave', 14) + (synced() ? 'Saved for offline reading. Last updated ' + esc(cache.synced) + '.' : 'Not saved for offline reading yet.') + '</p>' +
    '</div>';
  }

  function cwOffline(st) {
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Offline Readiness', T('offline.subtitle')) +
      '<div class="ug-wgrid-side">' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:12px;align-items:center;text-align:center;padding:26px 20px">' +
            '<span class="off-ico" style="width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:rgba(255,176,32,.14);color:var(--ug-warning);border:1px solid rgba(255,176,32,.3)">' + I('wifioff', 26) + '</span>' +
            '<h3 style="font-size:16px">' + (st.offline ? 'You Are Offline' : 'Offline Copy Ready') + '</h3>' +
            '<p class="ug-dim" style="font-size:13px;line-height:1.55;max-width:420px">Cellular networks often fail during a disaster. UniGuard keeps hotlines, shelters and critical advisories on this device so they still open without a signal.</p>' +
            '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('reconnect') + '>' + I('wave', 15) + (st.offline ? 'Back Online' : 'Check Connection') + '</button>' +
          '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('offline.availableNoSignal')) + '</h3>' +
            '<span class="ug-dimmer ug-mono" style="font-size:11px">' + esc(T('offline.lastSaved')) + ' ' + esc(U.DATA.offlineCache.synced) + '</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:11px">' +
              [['Emergency Hotlines', U.DATA.offlineCache.hotlines, 'phone'], ['Evacuation Centers', U.DATA.offlineCache.centers, 'shelter'], ['Critical Advisories', U.DATA.offlineCache.advisories, 'megaphone']]
                .map(x => '<div class="ug-rowf ug-between" style="gap:10px"><span class="ug-rowf" style="gap:9px">' +
                  '<span style="color:var(--ug-signal);display:flex">' + I(x[2], 16) + '</span>' +
                  '<span style="font-size:13px">' + x[0] + '</span></span>' +
                  '<span class="ug-badge ug-badge--resolved">' + x[1] + ' ' + esc(T('offline.ready')) + '</span></div>').join('') +
            '</div></div>' +
        '</div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('offline.savedOnPhone')) + '</h3></div><div class="ug-card-b ug-col" style="gap:12px">' +
            [[esc(T('offline.lastSaved')), esc(U.DATA.offlineCache.synced)],
             [esc(T('offline.waitingToSend')), (UG.DATA.queueCount || 0) + ' ' + esc(T('offline.waiting'))],
             [esc(T('offline.worksWithoutInternet')), esc(('serviceWorker' in navigator) ? T('label.yes') : T('label.no'))],
             [esc(T('settings.appVersion')), esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev')]]
              .map(x => '<div class="ug-rowf ug-between" style="gap:10px;font-size:12px"><span class="ug-dim">' + x[0] + '</span>' +
                '<span class="ug-mono">' + x[1] + '</span></div>').join('') +
            '<button class="ug-btn ug-btn--sm ug-btn--block"' + A('force-refresh') + '>' + I('wave', 15) + esc(T('offline.reloadApp')) + '</button>' +
            '<div class="ug-dimmer" style="font-size:11px;line-height:1.5;text-align:center">' + esc(T('offline.reloadHelp')) + '</div>' +
          '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

    function cwBody(st) {
    switch (st.route) {
      case 'home': return cwHome(st);
      case 'report': return UG_RW.report(st);
      case 'report-done': return UG_RW.reportDone(st);
      case 'advisories': return cwAdvisories(st);
      case 'advisory-detail': return cwAdvisory(st);
      case 'centers': return cwCenters(st);
      case 'hotlines': return cwHotlines(st);
      case 'notifications': return cwNotifications(st);
      case 'offline': return UG_RW.offline(st);
      case 'more': return cwMore(st);
      /* the new citizen web routes reuse the mobile render functions inside a
         centered page column with the standard desktop header */
      case 'relief': return UG_RW.relief(st);
      case 'relief-verify': return '<div class="rw-legacy">' + UG_RELIEF.mReliefVerify(st) + '</div>';
      case 'guides': return UG_RW.guides(st);
      case 'faqs': return UG_RW.faqs(st);
      case 'roadwork':
        return cwWrap(st, 'Road Work & Road Status', 'Active road work posts and the road-status overlay.',
          UG_ROADWORK.mRoadwork(st));
      case 'reports': return UG_RW.myReports(st);
      case 'report-detail': return UG_RW.reportDetail(st);
      case 'sos': return UG_RW.sos(st);
      case 'map': return UG_RW.map(st);
      case 'settings': return UG_RW.settings(st);
      default: return cwHome(st);
    }
  }

  /* wraps a mobile-render body in the standard desktop page header. The header
     and the content share one centered column (.ug-cw-page) so they line up. */
  function cwWrap(st, title, sub, body) {
    /* the mobile screen draws its own title block; remove it so the title only shows once */
    const tmp = document.createElement('div');
    tmp.innerHTML = body;
    const header = tmp.firstElementChild && tmp.firstElementChild.firstElementChild;
    /* keep the mobile header's action buttons (e.g. the guide PDF downloads):
       they move into the desktop header instead of disappearing with it */
    let actions = '';
    if (header && header.querySelector('.ug-lab')) {
      actions = Array.prototype.map.call(header.querySelectorAll('button[data-act]'), (b) => b.outerHTML).join('');
      header.remove();
    }

    return '<div class="ug-col ug-cw-page rw-legacy" style="gap:18px">' +
      rwLead(sub, actions) +
      '<div>' + tmp.innerHTML + '</div>' +
    '</div>';
  }

  function frameCitizenWeb(st) {
    return '<div class="ug ug-frame ug-w ug-rw' + (folded() ? ' is-folded' : '') + (st.fixed ? ' ug-fixed' : '') + '"' +
      (st.fixed ? ' style="width:' + st.w + 'px;height:' + st.h + 'px"' : '') + '>' +
      '<div class="ug-rw-shell">' +
        rwSide(st) +
        '<div class="rw-scrim"' + A('rw-drawer') + ' aria-hidden="true"></div>' +
        '<div class="ug-rw-main">' +
          rwHead(st) +
          /* the real connectivity banner is #ug-conn (index.html); this in-frame
             strip is only a preview control in DEV builds */
          (st.offline && UG_CONFIG.DEV ? '<div class="ug-offline">' + I('wifioff', 14) +
            '<span>Offline mode. Showing hotlines, shelters and critical advisories saved ' + esc(U.DATA.offlineCache.synced) + '.</span>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('toggle-offline') + '>Preview: simulate offline</button></div>' : '') +
          '<main class="ug-rw-body ug-scroll"><div class="ug-rw-page">' + cwBody(st) + '</div></main>' +
          UG_RW.phoneBar(st) +
        '</div>' +
        UG_RW.phoneMenu(st) +
      '</div>' +
    '</div>';
  }

  return { ROLE_INFO, ROLES, SUPER_ADMIN_LABEL, frameCitizenWeb, cwBody, cwOffline };
})();
