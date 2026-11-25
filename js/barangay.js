/* UniGuard · staff portals: barangay official and LGU / LDRRMO (Nov 2026)
 *
 * The staff consoles in the look of the React build (uniguard/src: App.tsx,
 * DashboardSidebar's top bar, BarangayOfficialPortal, OperationsDashboard):
 * a light workspace with the section links in one pill bar along the top,
 * and Home as the Barangay Command Console (navy) or the LDRRMO Operations
 * Dashboard (charcoal; gold for the Super Admin in the console).
 *
 * Only the frame and Home are drawn here. Every other section renders the
 * shared console screen (UG_SCREENS.desktopBody), so each role's
 * permissions, actions and data are unchanged. Styled by css/barangay.css.
 */
const UG_BRGY = (() => {
  const U = UG, I = U.icon, esc = U.esc;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map((k) => ' data-' + k + '="' + esc(o[k]) + '"').join('');

  /* the barangay official's sections, the same routes the console sidebar
     gives this role (js/screens.js DNAV) */
  /* ordered by urgency: respond to people in danger first, then what the
     public needs to know, then the records (NAV_GROUP draws the headings) */
  const NAV = [
    ['dashboard', 'Home', 'Home'],
    ['sos', 'SOS Log', 'SOS'], ['incidents', 'Incidents', 'Incidents'], ['response-team', 'Response Team', 'Team'],
    ['advisories', 'Advisories', 'Advisories'], ['centers', 'Shelters', 'Shelters'], ['relief', 'Relief', 'Relief'],
    ['roadwork', 'Road Work', 'Roads'], ['hotlines', 'Hotlines', 'Hotlines'],
    ['analytics', 'Analytics', 'Analytics'], ['reporting', 'Reports', 'Reports']
  ];
  /* the sidebar's headings: which group each section belongs to */
  const NAV_GROUP = { sos: 'Respond', incidents: 'Respond', 'response-team': 'Respond', 'dispatch-units': 'Respond',
    advisories: 'Inform the public', centers: 'Inform the public', relief: 'Inform the public', roadwork: 'Inform the public', hotlines: 'Inform the public',
    analytics: 'Insights', reporting: 'Insights' };
  /* Notifications are behind the bell in the header, not in the menu */
  const MENU = [['settings', 'Settings', 'settings']];
  /* the sidebar's icon for each section (js/rail.js) */
  const NAV_ICON = { dashboard: 'home', incidents: 'alert', advisories: 'megaphone', relief: 'relief', centers: 'shelter',
    roadwork: 'road2', 'response-team': 'shield', 'dispatch-units': 'truck', sos: 'sos', hotlines: 'phone',
    analytics: 'layers', reporting: 'doc' };
  /* the header title for routes that are not in the sidebar */
  const TITLE = { dashboard: 'Home', notifications: 'Notifications', settings: 'Settings', guides: 'Preparedness Guides',
    faqs: 'FAQs', 'others-review': '"Others" Review', reporting: 'Reports & Documents', map: 'Hazard Map', offline: 'Offline Sync',
    users: 'User Management', audit: 'Audit Log', 'response-team': 'Response Team', 'dispatch-units': 'Dispatch Units' };
  /* LDRRMO staff: the sections the console sidebar gives lgu_ldrrmc
     (js/screens.js DNAV); the rest sit in the menu */
  const NAV_LGU = [
    ['dashboard', 'Home', 'Home'],
    ['sos', 'SOS Log', 'SOS'], ['incidents', 'Incidents', 'Incidents'], ['dispatch-units', 'Dispatch Units', 'Units'],
    ['advisories', 'Advisories', 'Advisories'], ['centers', 'Shelters', 'Shelters'], ['relief', 'Relief', 'Relief'],
    ['roadwork', 'Road Work', 'Roads'], ['hotlines', 'Hotlines', 'Hotlines'],
    ['analytics', 'Analytics', 'Analytics']
  ];
  const MENU_LGU = [['guides', 'Preparedness guides', 'guide'], ['faqs', 'FAQs', 'faq'], ['others-review', '"Others" review', 'help'],
    ['reporting', 'Situation reports', 'doc'], ['settings', 'Settings', 'settings']];
  /* Super Admin only (the database enforces the same, migration 043) */
  const MENU_SUPER = [['users', 'User Management', 'users'], ['audit', 'Audit Log', 'clock'], ['admin-home', 'Admin console', 'shield']];

  /* which console this session gets */
  function variant(st) {
    const s = st.session || {};
    if (s.role === 'lgu_ldrrmc') {
      /* User Management, Audit Log and the admin console are on the Super
         Admin's main screen, so the menu no longer repeats them */
      return { lgu: true, sup: !!s.superAdmin, nav: NAV_LGU, menu: MENU_LGU,
        chip: s.superAdmin ? 'Super Admin' : 'LDRRMO', who: s.superAdmin ? 'Super Admin · Operations' : 'LDRRMO Incident Command',
        role: s.superAdmin ? 'SUPER • ADMIN' : 'LDRRMO • COMMAND' };
    }
    return { lgu: false, sup: false, nav: NAV, menu: MENU, chip: s.barangay ? 'Brgy. ' + s.barangay : '',
      who: 'Barangay Emergency Desk' + (s.barangay ? ' · ' + s.barangay : ''), role: 'BARANGAY • OFFICIAL' };
  }

  function activeRoute(r) {
    return r === 'incident' || r === 'command' ? 'incidents' : r === 'relief-verify' ? 'relief' : r;
  }

  /* the connection pill in the header: Live feed / Offline / Demo data.
     Tapping it opens what it means (source, last sync, whether updates
     arrive on their own) and the Refresh data button that used to sit in a
     banner on the Dashboard and Analytics pages. */
  function liveMenu(live) {
    const R = (typeof Repo !== 'undefined' && Repo.state) ? Repo.state : {};
    const synced = !!R.hasSynced;
    const mode = live ? 'live' : synced ? 'offline' : 'demo';
    const last = R.lastSync && mode !== 'demo' ? UG_UTIL.absTime(R.lastSync) : 'Not yet';
    const ago = R.lastSync && mode !== 'demo' ? UG_UTIL.relTime({ created_at: R.lastSync }) : '';
    const M = {
      live: ['Live feed', 'wave', 'Live', 'Connected to the UniGuard server. New reports, SOS alerts and changes appear here on their own.', 'UniGuard server, realtime'],
      offline: ['Offline', 'wifioff', 'Offline', 'The server cannot be reached, so you are seeing the last data saved on this device. Nothing new will arrive until the connection is back.', 'Saved on this device'],
      demo: ['Demo data', 'wifioff', 'Demo data', 'These are sample records, not the live incident queue. Refresh to pull the real data from the server.', 'Sample records']
    }[mode];
    const row = (k, v) => '<div class="lv-row"><span>' + k + '</span><b>' + v + '</b></div>';
    return '<span class="ug-wmore lv-wrap">' +
      '<button class="bg-live lv-pill is-' + mode + '" aria-haspopup="true" title="Connection status"' + A('toggle-more') + '>' +
        (mode === 'live' ? '' : '<i class="lv-dot"></i>') + I(M[1], 14) + '<span>' + M[0] + '</span></button>' +
      '<div class="lv-panel" data-more-panel hidden role="dialog" aria-label="Connection status">' +
        '<div class="lv-h"><span class="lv-ico is-' + mode + '">' + I(M[1], 16) + '</span>' +
          '<div><b>' + M[0] + '</b><small>' + (ago ? 'Synced ' + esc(ago) : mode === 'demo' ? 'Not synced yet' : 'Not synced') + '</small></div></div>' +
        '<p class="lv-p">' + M[3] + '</p>' +
        '<div class="lv-rows">' +
          row('Source', M[4]) +
          row('Last synced', esc(last)) +
          row('Updates', live ? 'Automatic' : 'Paused') +
        '</div>' +
        (R.lastError && !live ? '<p class="lv-err">' + I('alert', 13) + '<span>' + esc(R.lastError) + '</span></p>' : '') +
        '<button class="lv-btn"' + A('refresh-data') + '>' + I('wave', 14) + 'Refresh data</button>' +
      '</div></span>';
  }

  /* counts beside the sections: open incidents in scope, active advisories,
     open shelters, open SOS calls (shown red) */
  function navCounts(s, V) {
    const brgy = s.barangay || '';
    return {
      incidents: (U.DATA.incidents || []).filter((i) => (V.lgu || !s.barangay_id || !i.brgy_id || i.brgy_id === s.barangay_id) && i.status !== 'resolved' && i.status !== 'rejected').length,
      advisories: (U.DATA.advisories || []).length,
      centers: (U.DATA.centers || []).filter((c) => (V.lgu || !brgy || c.brgy === brgy) && c.status === 'open').length,
      sos: sosOpen()
    };
  }

  /* the shared sidebar (js/rail.js): navy for the barangay, charcoal for the
     LDRRMO, gold for the Super Admin working in the console */
  function rail(st, V) {
    const s = st.session || {};
    const route = activeRoute(st.route);
    const counts = navCounts(s, V);
    const items = V.nav.map((n) => ({ attrs: A('nav', attr({ route: n[0] })), icon: I(NAV_ICON[n[0]] || 'info', 20), label: n[1],
      on: route === n[0], count: counts[n[0]] || 0, alert: n[0] === 'sos' }));
    /* one plain list in order of urgency: no group titles or dividers */
    const grouped = [{ items: items }];
    const groups = V.sup
      ? [{ title: 'Super Admin', items: [{ attrs: A('nav', attr({ route: 'admin-home' })), icon: I('shield', 20), label: 'Main screen' }] }].concat(grouped)
      : grouped;
    return UG_RAIL.html({
      theme: V.sup ? 'admin' : V.lgu ? 'command' : 'barangay', id: 'ug-console-nav', label: 'Sections',
      brand: V.sup ? { attrs: A('nav', attr({ route: 'admin-home' })), label: 'Go to the Super Admin main screen', sub: 'Super Admin' }
        : { attrs: A('nav', attr({ route: 'dashboard' })), label: 'Go to Home', sub: V.lgu ? 'LDRRMO' : (s.barangay ? 'Brgy. ' + s.barangay : 'Barangay') },
      groups: groups,
      user: { initial: UG_RAIL.initial(s.name, V.lgu ? 'L' : 'B'), name: s.name || (V.lgu ? 'LDRRMO Officer' : 'Barangay Official'),
        sub: V.sup ? 'Super Admin' : V.lgu ? 'LDRRMO Staff' : 'Barangay official' }
    });
  }

  function topbar(st) {
    const s = st.session || {};
    const V = variant(st);
    const route = activeRoute(st.route);
    const unread = (U.DATA.notifications || []).filter((n) => n.unread).length;
    const live = typeof Repo !== 'undefined' && Repo.state && Repo.state.source === 'supabase';
    const title = TITLE[route] || ((V.nav.find((n) => n[0] === route) || [])[1]) || '';
    return '<header class="bg-top">' +
      /* phones: the brand (the sidebar carries it on wider screens) */
      (V.sup
        ? '<div class="bg-brand bg-brand--sup"><button class="bg-brand-in"' + A('nav', attr({ route: 'admin-home' })) + ' aria-label="Go to the Super Admin main screen" title="Super Admin main screen">' + U.brandMark(26) +
            '<span class="bg-word">Uni<em>Guard</em></span></button></div>'
        : '<button class="bg-brand"' + A('nav', attr({ route: 'dashboard' })) + ' aria-label="Go to Home">' + U.brandMark(26) +
            '<span class="bg-word">Uni<em>Guard</em></span>' +
            (V.chip ? '<span class="bg-chip">' + esc(V.chip) + '</span>' : '') + '</button>') +
      '<h2 class="bg-title">' + esc(title) + '</h2>' +
      '<div class="bg-right">' +
        liveMenu(live) +
        /* the bell opens the notification panel (js/screens.js notifPanel) */
        '<span class="ug-nwrap"><button class="bg-ibtn' + (route === 'notifications' || st.notifPanel ? ' is-on' : '') + '"' + A('notif-panel') +
          ' aria-label="Notifications' + (unread ? ', ' + unread + ' unread' : '') + '" title="Notifications" aria-haspopup="dialog" aria-expanded="' + !!st.notifPanel + '">' + I('bell', 16) +
          (unread ? '<span class="bg-dot">' + (unread > 9 ? '9+' : unread) + '</span>' : '') + '</button>' + UG_SCREENS.notifPanel(st) + '</span>' +
        /* phones: the Menu drawer opens from the header (the bottom bar keeps five sections) */
        '<button class="bg-ibtn bg-pm-open' + (st.bgMenu ? ' is-on' : '') + '"' + A('bg-pmenu') + ' aria-label="Menu" aria-haspopup="dialog" aria-controls="bg-pm" aria-expanded="' + !!st.bgMenu + '">' + I('menu', 18) + '</button>' +
        /* .ug-wmore + [data-more-panel]: toggle-more opens it, a tap outside closes it */
        '<span class="ug-wmore bg-menu">' +
          '<button class="bg-ibtn" aria-haspopup="true" aria-label="Menu" title="Menu"' + A('toggle-more') + '>' + I('grid', 16) + '</button>' +
          '<div class="bg-panel" data-more-panel hidden>' +
            '<div class="bg-profile"><span class="bg-wm">' + I('shield', 96) + '</span>' +
              '<span class="bg-av">' + esc((s.name || 'B').trim().charAt(0).toUpperCase()) + '</span>' +
              '<b>' + esc(s.name || '') + '</b><span>' + esc(V.who) + '</span>' +
              '<i>' + V.role + '</i></div>' +
            '<div class="bg-mobile-nav">' + V.nav.map((n) =>
              '<button class="bg-qi' + (route === n[0] ? ' is-on' : '') + '"' + A('nav', attr({ route: n[0] })) + '><span>' + n[1] + '</span>' + I('chevron', 14) + '</button>').join('') +
              '<button class="bg-qi lv-mobile"' + A('refresh-data') + '><span>Refresh data · ' + (live ? 'Live' : 'Offline') + '</span>' + I('wave', 14) + '</button></div>' +
            (V.sup ? '<button class="bg-qi bg-qi--main"' + A('nav', attr({ route: 'admin-home' })) + '><span class="bg-qi-l"><span class="bg-qi-ico">' + I('chevron', 16) + '</span>Back to main screen</span>' + I('chevron', 14) + '</button>' : '') +
            V.menu.map((m) => '<button class="bg-qi"' + A('nav', attr({ route: m[0] })) + '><span class="bg-qi-l"><span class="bg-qi-ico">' + I(m[2], 16) + '</span>' + m[1] + '</span>' + I('chevron', 14) + '</button>').join('') +
            '<button class="bg-qi bg-qi--out"' + A('logout') + '><span class="bg-qi-l"><span class="bg-qi-ico">' + I('logout', 16) + '</span>Sign Out</span></button>' +
          '</div></span>' +
      '</div>' +
    '</header>';
  }
  function sosOpen() {
    return (U.DATA.sosLog || []).filter((x) => x.status === 'sent').length;
  }

  /* ================================================================= home */
  const KIND_COLOR = { emergency: '#B91C1C', warning: '#C2410C', advisory: '#A16207', prepared: '#15803D' };
  const KIND_WORD = { emergency: 'Emergency', warning: 'Warning', advisory: 'Advisory', prepared: 'Preparedness' };
  const STATUS_WORD = { reported: 'Reported', verified: 'Verified', dispatched: 'Dispatched', resolved: 'Resolved', rejected: 'Rejected', expired: 'Expired' };

  /* a figure card; every one opens something: a section (route) or an action (act) */
  function stat(label, value, note, icon, dot, route, act) {
    const go = act || (route ? A('nav', attr({ route: route })) : '');
    return '<div class="bg-stat' + (go ? ' is-link' : '') + '"' + (go ? ' role="button" tabindex="0" title="' + esc(act ? label : 'Open ' + label.toLowerCase()) + '"' + go : '') + '><div class="bg-stat-top"><div style="min-width:0"><p class="bg-stat-l">' + esc(label) + '</p>' +
      '<p class="bg-stat-v">' + esc(String(value)) + '</p></div><span class="bg-stat-icos"><span class="bg-stat-ico">' + I(icon, 18) + '</span>' +
        (go ? '<span class="bg-stat-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg></span>' : '') + '</span></div>' +
      '<div class="bg-stat-f"><i' + (dot ? ' style="background:' + dot + '"' : '') + '></i><span>' + esc(note) + '</span></div></div>';
  }
  /* the same quick step the console dashboard offers this role */
  function quick(i, sup) {
    if (sup) return '<button class="bg-qa"' + A('edit-report', attr({ id: i.id })) + '>' + I('settings', 12) + 'Edit</button>';
    if (i.status === 'reported') return '<button class="bg-qa"' + A('advance', attr({ id: i.id })) + '>Verify</button>';
    if (i.status === 'verified') return '<button class="bg-qa bg-qa--solid"' + A('advance', attr({ id: i.id })) + '>' + I('truck', 12) + 'Dispatch</button>';
    if (i.status === 'dispatched') return '<button class="bg-qa"' + A('advance', attr({ id: i.id })) + '>' + I('check', 12) + 'Resolve</button>';
    return '';
  }

  function home(st) {
    const s = st.session || {};
    const V = variant(st);
    /* the LGU sees the whole municipality; a barangay official their barangay */
    const brgy = V.lgu ? '' : (s.barangay || '');
    const where = V.lgu ? 'Lingayen' : 'Barangay ' + (brgy || '—');
    /* reports_feed is already scoped to this barangay by RLS (migration 026) */
    const reports = (U.DATA.incidents || []).filter((i) => V.lgu || !s.barangay_id || !i.brgy_id || i.brgy_id === s.barangay_id);
    const open = (i) => i.status !== 'resolved' && i.status !== 'rejected';
    const active = reports.filter(open);
    const units = active.reduce((n, i) => n + (i.units || 0), 0);
    const critical = active.filter((i) => i.sev === 'emergency').length;
    const sorted = reports.slice().sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
    const escalated = sorted.filter((i) => i.escalates_to_lgu);
    const live = typeof Repo !== 'undefined' && Repo.state && Repo.state.source === 'supabase';
    const shelters = (U.DATA.centers || []).filter((c) => !brgy || c.brgy === brgy);
    const openShelters = shelters.filter((c) => c.status === 'open').length;
    const capTotal = shelters.reduce((n, c) => n + (c.cap || 0), 0);
    const occTotal = shelters.reduce((n, c) => n + (c.occ || 0), 0);
    const fullPct = capTotal ? Math.round(occTotal / capTotal * 100) : 0;
    const corrRate = reports.length ? Math.round(reports.filter((i) => (i.corr || 0) >= UG_CONFIG.CORROBORATION_THRESHOLD).length / reports.length * 100) : 0;
    const advisories = (U.DATA.advisories || []);
    const hz = {};
    reports.forEach((i) => { hz[i.hazard] = (hz[i.hazard] || 0) + 1; });
    const dist = Object.keys(hz).map((k) => ({ t: k, n: hz[k] })).sort((a, b) => b.n - a.n).slice(0, 5);
    const maxN = dist.length ? dist[0].n : 1;
    const relief = (U.DATA.relief || []).filter((r) => r.active !== false && (!brgy || !r.barangay || r.barangay === brgy)).length;
    const roads = (U.DATA.roadWork || []).filter((r) => r.status === 'active' && (r.citywide || !brgy || r.barangay === brgy)).length;
    const card = (cls, body) => '<section class="bg-card ' + (cls || '') + '">' + body + '</section>';
    const cardHead = (title, sub, right) => '<div class="bg-ch"><div style="min-width:0"><h2>' + title + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</div>';
    const tag = (t) => '<span class="bg-tag">' + esc(t) + '</span>';
    /* an empty card: centred icon, title, one line and an optional action,
       filling the card's space instead of leaving a lone line at the top */
    const emptyBox = (icon, title, sub, action) => '<div class="bg-emptybox"><span>' + I(icon, 18) + '</span><b>' + esc(title) + '</b>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') + (action || '') + '</div>';
    const bar = (pct, tone) => '<div class="bg-bar"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + tone + '"></i></div>';

    return '<div class="ug-col bg-home" style="gap:24px">' +
      '<div class="bg-head"><div><div class="bg-head-t"><h1>' + (V.lgu ? 'Operations Dashboard' : 'Barangay Command Console') + '</h1>' +
          (V.lgu ? '<span class="bg-pill">COMMAND CENTER</span>' : brgy ? '<span class="bg-pill">BRGY. ' + esc(brgy.toUpperCase()) + ' COMMAND POST</span>' : '') + '</div>' +
          '<p>Real-time monitoring and incident command overview for ' + (V.lgu ? '' : esc(where) + ', ') + 'Lingayen, Pangasinan.</p></div>' +
          /* the sync state and Refresh live in the header's connection pill */
        /* phones: one summary card instead of four tiles (see css) */
        (() => {
          return '<div class="bg-mhero" role="button" tabindex="0"' + A('nav', attr({ route: 'incidents' })) + ' aria-label="Open incidents">' +
              '<div class="bg-mhero-top"><span>Active incidents</span>' +
                '<i class="bg-mhero-live' + (live ? ' is-live' : '') + '"><b></b>' + (live ? 'Live' : 'Offline') + '</i></div>' +
              '<div class="bg-mhero-n"><strong>' + active.length + '</strong><span>' + (V.lgu ? 'open across Lingayen' : 'open in ' + esc(where)) + '</span></div>' +
              '<div class="bg-mhero-row">' +
                '<div><strong>' + units + '</strong><span>Units deployed</span></div>' +
                '<div><strong>' + (critical ? '<b class="bg-mhero-dot"></b>' : '') + critical + '</strong><span>Critical areas</span></div>' +
                '<div class="bg-mhero-go">' + I('chevron', 18) + '</div>' +
              '</div>' +
            '</div>';
        })() +
        '<div class="bg-head-r">' +
          '<button class="bg-btn bg-btn--an"' + A('nav', attr({ route: 'analytics' })) + '>' + I('layers', 14) + '<span class="bg-an-t">' + (V.lgu ? 'Analytics' : 'Barangay Analytics') + '</span>' +
            '<small class="bg-an-s">Trends, response times and hotspots</small>' + '<i class="bg-an-c">' + I('chevron', 16) + '</i></button>' +
          /* declaring an emergency is the LGU's (RPC declare_emergency, migration 009) */
          (V.lgu ? '<button class="bg-btn bg-btn--solid bg-btn--emergency"' + A('declare') + '>' + I('alert', 14) + 'Declare Emergency</button>'
            : '<button class="bg-btn bg-btn--solid bg-btn--queue"' + A('nav', attr({ route: 'incidents' })) + '>' + I('alert', 14) + 'Incident Queue</button>') +
        '</div></div>' +

      '<div class="bg-stats">' +
        stat('Active incidents', active.length, V.lgu ? 'Live from the incident queue' : 'Open in ' + where, 'alert', null, 'incidents') +
        stat('Units deployed', units, V.lgu ? 'Assigned responders' : 'Barangay responders assigned', 'users', null, V.lgu ? 'dispatch-units' : 'response-team') +
        stat('Critical areas', critical, critical ? 'Emergency severity, not resolved' : 'No emergency-level reports', 'shieldx', critical ? '#C0392B' : '#059669', 'incidents') +
        stat('System status', live ? 'Live' : 'Offline', live ? 'Realtime connected · tap to refresh' : 'Saved data · tap to refresh', 'radar', live ? '#059669' : '#E9B872', null, A('refresh-data')) +
      '</div>' +

      /* escalated to the LGU: a home card like the others, one tile per
         report (scrolls sideways), each opening the report */
      (escalated.length ? card('bg-esc',
        cardHead(I('alert', 16) + '<span>Escalated to LGU</span>' +
            '<span class="bg-why-i" tabindex="0" aria-label="What does escalated mean?" data-tip="Escalated is a flag, not a status: a report still unverified after 30 minutes (stale), or a life-safety hazard that goes straight to the LGU. Verifying it here still works.">' + I('info', 13) + '</span>',
          'Unverified after 30 minutes, or life-safety hazards',
          '<div class="bg-ch-r"><span class="bg-big">' + escalated.length + '</span><button class="bg-va"' + A('nav', attr({ route: 'incidents' })) + '>Review all</button></div>') +
        '<div class="bg-esc-row">' + escalated.slice(0, 12).map((i) =>
          '<div class="bg-ri bg-esc-i" role="button" tabindex="0"' + A('open-incident', attr({ id: i.id })) + '>' +
            '<div class="bg-ri-t"><span class="bg-ri-ico' + (i.sev === 'emergency' ? ' is-hot' : '') + '">' + I(i.sev === 'emergency' ? 'alert' : 'shield', 13) + '</span>' +
              '<h3>' + esc(i.hazard) + '</h3><span class="bg-esc-tag' + (i.is_severity_bypass ? ' is-life' : '') + '">' + (i.is_severity_bypass ? 'Life-safety' : 'Stale') + '</span></div>' +
            '<div class="bg-ri-m"><span>' + I('pin', 13) + esc(i.brgy ? 'Barangay ' + i.brgy : '—') + '</span><em>' + esc(i.time) + '</em></div>' +
            '<div class="bg-ri-f"><span class="bg-code">' + esc(i.id) + '</span><span class="bg-ri-s">' + esc(STATUS_WORD[i.expired ? 'expired' : i.status] || i.status) + '</span></div>' +
          '</div>').join('') +
          (escalated.length > 12 ? '<button class="bg-esc-more"' + A('nav', attr({ route: 'incidents' })) + '><b>+' + (escalated.length - 12) + '</b>more in the<br>Incident Queue</button>' : '') +
        '</div>') : '') +

      '<div class="bg-mid">' +
        card('bg-mapcard',
          cardHead(I('pin', 16) + '<span>Live Operations Map</span>', 'Active incidents, SOS response zones and deployed units' + (V.lgu ? '' : ' in ' + where),
            '<div class="bg-ch-r"><button class="bg-rt' + (live ? ' is-on' : '') + '"' + A('refresh-data') + ' title="' + (live ? 'Live updates are on. Tap to reload now.' : 'Showing saved data. Tap to reload from the server.') + '"><i></i>' + (live ? 'Realtime' : 'Reload') + '</button>' +
              '<button class="bg-btn bg-btn--sm' + (st.mapPanelOpen ? ' is-on' : '') + '" data-act="map-layers-panel" aria-expanded="' + !!st.mapPanelOpen + '">' + I('layers', 14) + 'Layers</button></div>') +
          '<div class="ug-map" data-map="live" data-toggles="chip">' + U.mapSVG({ animated: true }) + '</div>') +
        card('bg-recent',
          cardHead('Recent Incidents', 'Newest first, ' + (V.lgu ? 'municipality-wide' : where),
            '<div class="bg-ch-r"><span class="bg-big">' + sorted.length + '</span><button class="bg-va"' + A('nav', attr({ route: 'incidents' })) + '>View All</button></div>') +
          '<div class="bg-rlist' + (sorted.length ? '' : ' is-empty') + '">' + (sorted.length ? sorted.slice(0, 12).map((i) =>
            '<div class="bg-ri" role="button" tabindex="0"' + A('open-incident', attr({ id: i.id })) + '>' +
              '<div class="bg-ri-t"><span class="bg-ri-ico' + (i.sev === 'emergency' ? ' is-hot' : '') + '">' + I(i.sev === 'emergency' ? 'alert' : 'shield', 13) + '</span>' +
                '<h3>' + esc(i.hazard) + '</h3><span class="bg-code">' + esc(i.id) + '</span></div>' +
              '<div class="bg-ri-m"><span>' + I('pin', 13) + esc(i.brgy ? 'Barangay ' + i.brgy : '—') + '</span><em>' + esc(i.time) + '</em></div>' +
              '<div class="bg-ri-c">' + I('shield', 12) + '<span>' + esc(UG_UTIL.corroborationLabel ? UG_UTIL.corroborationLabel(i.corr) : (i.corr || 0) + ' confirmations') + '</span></div>' +
              '<div class="bg-ri-f"><span class="bg-ri-s">' + esc(STATUS_WORD[i.expired ? 'expired' : i.status] || i.status) + '</span>' + quick(i, V.sup) + '</div>' +
              (i.desc ? '<p class="bg-ri-d">' + esc(i.desc) + '</p>' : '') +
            '</div>').join('')
            : emptyBox('inbox', 'No reports yet', 'New reports from ' + where + ' will appear here as residents send them.',
                '<button class="bg-va"' + A('nav', attr({ route: 'incidents' })) + '>Open the incident queue</button>')) + '</div>') +
      '</div>' +

      '<div class="bg-three">' +
        card('', cardHead('Incidents by Hazard Type', where + ' distribution', tag(reports.length + ' ON RECORD')) +
          /* each hazard opens the incident queue filtered to it */
          '<div class="bg-dist">' + (dist.length ? dist.map((d, k) =>
            '<button class="bg-dist-go"' + A('inc-hazard-open', attr({ v: d.t })) + ' title="Show ' + esc(d.t) + ' incidents"><div class="bg-dist-l"><span>' + esc(d.t) + '</span><b>' + d.n + '</b></div>' + bar(Math.max(8, Math.round(d.n / maxN * 100)), k === 0 ? 'var(--bg-navy)' : k === 1 ? 'var(--bg-mid)' : 'var(--bg-soft)') + '</button>').join('')
            : emptyBox('layers', 'No reports in the last 30 days', 'The breakdown by hazard fills in as reports come in.')) + '</div>' +
          '<button class="bg-link"' + A('nav', attr({ route: 'analytics' })) + '><span>View analytics</span>' + I('chevron', 14) + '</button>') +
        card('', cardHead('Active Advisories', 'Public warnings affecting ' + (V.lgu ? 'Lingayen' : brgy || 'the barangay'), tag(advisories.length + ' active')) +
          '<div class="bg-adv">' + (advisories.length ? advisories.slice(0, 3).map((a) =>
            '<div role="button" tabindex="0"' + A('open-advisory', attr({ id: a.id })) + '><div class="bg-adv-t"><h4>' + esc(a.title) + '</h4>' +
              '<span class="bg-kind"><i style="background:' + (KIND_COLOR[a.severity] || '#A16207') + '"></i>' + esc(KIND_WORD[a.severity] || 'Advisory') + '</span></div>' +
              '<div class="bg-meta"><span>' + I('pin', 12) + esc(a.area || 'Municipality-wide') + '</span><span>' + esc(a.time || '') + '</span></div></div>').join('')
            : emptyBox('megaphone', 'No active advisories', 'Published warnings for the area show here.')) + '</div>' +
          '<button class="bg-link"' + A('nav', attr({ route: 'advisories' })) + '><span>View all advisories</span>' + I('chevron', 14) + '</button>') +
        card('', cardHead(V.lgu ? 'Readiness' : 'Barangay Readiness', V.lgu ? 'LDRRMO operational status' : 'BDRRMC operational status', tag('Operational')) +
          /* each line opens where it comes from */
          '<div class="bg-dist">' +
            '<button class="bg-dist-go"' + A('nav', attr({ route: 'centers' })) + '><div class="bg-dist-l"><span class="bg-soft">' + (V.lgu ? 'Shelters open' : 'Barangay shelters open') + '</span><b>' + openShelters + ' of ' + shelters.length + ' open · ' + fullPct + '% full</b></div>' + bar(Math.round(openShelters / Math.max(1, shelters.length) * 100), 'var(--bg-navy)') + '</button>' +
            '<button class="bg-dist-go"' + A('nav', attr({ route: V.lgu ? 'dispatch-units' : 'response-team' })) + '><div class="bg-dist-l"><span class="bg-soft">' + (V.lgu ? 'Units assigned' : 'Barangay units assigned') + '</span><b>' + units + ' active ' + (units === 1 ? 'crew' : 'crews') + '</b></div>' + bar(Math.min(100, Math.max(units ? 20 : 0, units * 40)), 'var(--bg-mid)') + '</button>' +
            '<button class="bg-dist-go"' + A('nav', attr({ route: 'incidents' })) + '><div class="bg-dist-l"><span class="bg-soft">Corroboration rate</span><b>' + corrRate + '% verified</b></div>' + bar(corrRate, 'var(--bg-soft)') + '</button>' +
          '</div>') +
      '</div>' +

      '<div class="bg-mods">' + (V.lgu
          ? [['relief', 'relief', 'Relief Distributions', relief + ' active'], ['roadwork', 'road2', 'Road Work Posts', roads + ' active'],
             ['guides', 'guide', 'Preparedness Guides', (U.DATA.guides || []).length + ' published'], ['faqs', 'faq', 'FAQ Entries', (U.DATA.faqs || []).length + ' published']]
          : [['relief', 'relief', 'Relief Distributions', relief + ' active in ' + (brgy || 'the barangay')],
             ['roadwork', 'road2', 'Road Work Posts', roads + ' active posts'],
             ['response-team', 'shield', 'Response Team', 'Your Barangay Response Team'],
             ['reporting', 'doc', 'Situation Reports', 'Incident summary, damage and needs']]).map((m) =>
        '<button class="bg-mod"' + A('nav', attr({ route: m[0] })) + '><div class="bg-mod-t"><span class="bg-mod-ico">' + I(m[1], 18) + '</span>' + I('chevron', 16) + '</div>' +
          '<h3>' + esc(m[2]) + '</h3><p>' + esc(m[3]) + '</p></button>').join('') + '</div>' +
    '</div>';
  }

  /* ======================================================== phone navigation
     After uniguard/src/components/StaffMobileNav.tsx: four main sections in a
     bottom bar, the active one rising into a circle that dips into the bar
     (navy for the barangay, charcoal for the LDRRMO), and everything else in
     the Menu at the far right, a drawer that slides in from the right edge. */
  /* SOS Log takes the fourth slot on phones (open SOS calls matter more to
     staff than shelters, which move into the Menu) */
  const PBAR = [['dashboard', 'Home', 'home'], ['incidents', 'Incidents', 'alert'], ['advisories', 'Advisories', 'megaphone'], ['sos', 'SOS Log', 'shieldx']];
  function pmGroups(V) {
    const isB = !V.lgu;
    const keep = (it) => (!it[3] || (it[3] === 'lgu' ? V.lgu : isB));
    return (V.sup ? [['Command', [['dashboard', 'Operations Home', 'home'], ['incidents', 'Incidents', 'alert'], ['advisories', 'Advisories', 'megaphone'],
      ['sos', 'SOS Log', 'shieldx'], ['dispatch-units', 'Dispatch Units', 'truck']]]] : []).concat([
      ['Operations', [['centers', 'Shelters', 'shelter'], ['relief', 'Relief', 'relief'], ['roadwork', 'Road Work', 'road'],
        ['hotlines', 'Hotlines', 'phone'], ['analytics', 'Analytics', 'layers'],
        ['reporting', 'Reports & Documents', 'doc']]],
      ['Resources', [['map', 'Hazard Map', 'map'], ['guides', 'Preparedness Guides', 'guide'], ['faqs', 'FAQs', 'faq']]],
      ['Administration', [['others-review', 'Others Review', 'help', 'lgu']]],
      ['This device', [['offline', 'Offline Sync', 'download'], ['settings', 'Settings', 'settings']]]
    ]).map((g) => [g[0], g[1].filter(keep)]).filter((g) => g[1].length);
  }
  function phoneNav(st, V) {
    const s = st.session || {};
    const route = activeRoute(st.route);
    /* drawn closed for one frame when it opens, so it can slide in */
    const open = !!st.bgMenu && !st.bgMenuEnter;
    const shown = !!st.bgMenu;
    const brgy = s.barangay || '';
    const unread = (U.DATA.notifications || []).filter((n) => n.unread).length;
    const badge = {
      incidents: V.lgu ? 0 : (U.DATA.incidents || []).filter((i) => (!s.barangay_id || !i.brgy_id || i.brgy_id === s.barangay_id) && i.status !== 'resolved' && i.status !== 'rejected').length,
      advisories: (U.DATA.advisories || []).filter((a) => a.severity === 'emergency' || a.severity === 'warning').length,
      sos: sosOpen()
    };
    /* Super Admin: the same four sections as the Super Admin screen's bar
       (js/screens.superadmin.js), Operations lit while in the console; the
       console's own sections move into the Menu */
    if (V.sup) {
      const sosN = sosOpen();
      const supSlot = (label, icon, act, on, n) =>
        '<button class="bg-pb' + (on ? ' is-on' : '') + '"' + act + (on ? ' aria-current="page"' : '') +
          ' aria-label="' + esc(label) + (n ? ', ' + n + ' open SOS' : '') + '">' +
          '<span class="bg-pb-i">' + I(icon, on ? 20 : 22) + (n ? '<em>' + (n > 99 ? '99+' : n) + '</em>' : '') + '</span><b>' + esc(label) + '</b></button>';
      return '<nav class="bg-pbar bg-pbar--sup" aria-label="Super Admin sections"><div class="bg-pbar-in">' +
          supSlot('Overview', 'home', A('sa-open', attr({ view: 'overview' })), false) +
          supSlot('Accounts', 'users', A('sa-open', attr({ view: 'accounts' })), false) +
          supSlot('Activity', 'activity', A('sa-open', attr({ view: 'activity' })), false) +
          supSlot('Operations', 'grid', A('nav', attr({ route: 'dashboard' })), !shown, sosN) +
        '</div></nav>' + drawerHtml(st, V, s, route, open, unread);
    }
    const bar = PBAR.concat([V.lgu ? ['dispatch-units', 'Units', 'truck'] : ['response-team', 'Team', 'shield']]);
    const slot = (id, label, icon, on, act) =>
      '<button class="bg-pb' + (on ? ' is-on' : '') + (id === 'sos' ? ' bg-pb--sos' : '') + '" data-slot="' + id + '"' + act + (on ? ' aria-current="page"' : '') +
        ' aria-label="' + esc(label) + (badge[id] ? ', ' + badge[id] + ' new' : '') + '">' +
        '<span class="bg-pb-i">' + I(icon, on ? 20 : 22) + (badge[id] ? '<em>' + (badge[id] > 99 ? '99+' : badge[id]) + '</em>' : '') + '</span>' +
        '<b>' + esc(label) + '</b></button>';
    return '<nav class="bg-pbar" aria-label="Main sections"><div class="bg-pbar-in">' +
        bar.map((t) => slot(t[0], t[1], t[2], !shown && route === t[0], A('nav', attr({ route: t[0] })))).join('') +
      '</div></nav>' + drawerHtml(st, V, s, route, open, unread);
  }
  /* the same drawer for screens outside this frame (the Super Admin screen) */
  function drawer(st) {
    const s = st.session || {};
    return drawerHtml(st, variant(st), s, activeRoute(st.route), !!st.bgMenu && !st.bgMenuEnter,
      (U.DATA.notifications || []).filter((n) => n.unread).length);
  }
  function drawerHtml(st, V, s, route, open, unread) {
    return '<div class="bg-pm-scrim' + (open ? ' is-open' : '') + '"' + A('bg-pmenu', attr({ v: '0' })) + ' aria-hidden="true"></div>' +
      '<aside id="bg-pm" class="bg-pm' + (open ? ' is-open' : '') + '" role="dialog" aria-modal="true" aria-label="Menu"' + (open ? '' : ' inert') + '>' +
        '<div class="bg-pm-h"><span class="bg-pm-av">' + esc((s.name || (V.lgu ? 'L' : 'B')).trim().charAt(0).toUpperCase()) + '</span>' +
          '<div class="bg-pm-who"><b>' + esc(s.name || (V.lgu ? 'LDRRMO Officer' : 'Barangay Official')) + '</b>' +
            '<small>' + (V.sup ? 'Super Admin · Operations' : V.lgu ? 'LDRRMO · Lingayen' : 'Barangay official' + (s.barangay ? ' · ' + esc(s.barangay) : '')) + '</small></div>' +
          '<button class="bg-pm-x"' + A('bg-pmenu', attr({ v: '0' })) + ' aria-label="Close menu">' + I('x', 20) + '</button></div>' +
        '<div class="bg-pm-list">' + pmGroups(V).map((g) => '<p class="bg-pm-g">' + esc(g[0]) + '</p><div class="bg-pm-card">' + g[1].map((it) =>
          '<button class="bg-pm-i' + (route === it[0] ? ' is-on' : '') + '"' + A('nav', attr({ route: it[0] })) + (route === it[0] ? ' aria-current="page"' : '') + '>' +
            I(it[2], 22) + '<span>' + esc(it[1]) + '</span>' +
            (it[0] === 'notifications' && unread ? '<em>' + unread + '</em>' : '') + '<i class="bg-pm-chev">' + I('chevron', 16) + '</i></button>').join('') + '</div>').join('') + '</div>' +
        (V.sup && st.route !== 'admin-home' ? '<div class="bg-pm-sup"><button' + A('nav', attr({ route: 'admin-home' })) + '>Back to Super Admin console</button></div>' : '') +
        '<div class="bg-pm-f"><button' + A('logout') + '>' + I('logout', 16) + '<span>Sign out</span></button>' +
          '<small>UniGuard · ' + (V.lgu ? 'Lingayen LDRRMO' : 'Brgy. ' + esc(s.barangay || '') + ' BDRRMC') + ((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) ? ' · ' + esc(UG_CONFIG.BUILD) : '') + '</small></div>' +
      '</aside>';
  }

  /* =============================================================== frame */
  function frame(st) {
    const s = st.session || {};
    const V = variant(st);
    const body = st.route === 'dashboard' || st.route === 'home' ? home(st) : UG_SCREENS.desktopBody(st);
    return '<div class="ug ug-frame ug-d ug-bg' + (V.lgu ? ' ug-cmd' : '') + (st.fixed ? ' ug-fixed' : '') + '"' +
      (st.fixed ? ' style="width:' + st.w + 'px;height:' + st.h + 'px"' : '') + '>' +
      '<div class="bg-shell">' + rail(st, V) +
        '<div class="bg-main">' +
        topbar(st) +
        (s.role === 'barangay_official' && !s.barangay_id
          ? U.note('nobrgy', s.id || 'x', 'alert', 'No barangay is assigned to your account yet', 'You cannot see any reports until one is set. Contact your LGU administrator.', { session: true }) : '') +
        '<div class="ug-d-body ug-scroll bg-body"><div class="bg-page">' +
          (typeof UG_SOS !== 'undefined' ? UG_SOS.activeStrip(st) : '') + body + '</div>' +
          /* phones: the footer note shows on Settings only */
          '<footer class="bg-foot-bar' + (st.route === 'settings' ? '' : ' is-not-settings') + '"><div>' + U.brandMark(16) +
            (V.lgu ? '<b>UniGuard LDRRMO</b><span>•</span><span class="bg-soft">Municipality of Lingayen LDRRMO Operations Hub</span></div>'
              : '<b>UniGuard BDRRMC • Brgy. ' + esc((s.barangay || '').toUpperCase()) + '</b><span>•</span>' +
                '<span class="bg-soft">Barangay Incident Command Post • Municipality of Lingayen</span></div>') +
            '<div class="bg-soft"><i class="bg-ok"></i>PWA Offline-Ready<span>•</span>Municipality of Lingayen</div></footer>' +
        '</div>' +
        '</div>' +
        phoneNav(st, V) +
      '</div>' +
    '</div>';
  }

  return { frame, home, drawer, NAV, NAV_LGU };
})();
window.UG_BRGY = UG_BRGY;
