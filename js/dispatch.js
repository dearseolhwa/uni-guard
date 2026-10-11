/* UniGuard · dispatch team module
 *
 * State, loaders, screens and actions for the dispatch_team role. A dispatch
 * user is tied to ONE unit (BFP / PNP / Rescue / Hospital) and sees only the
 * dispatches addressed to their unit, their unit's equipment and roster,
 * plus the municipality-wide directory (read-only).
 *
 * The module exposes UG_DISPATCH.frame(st) for js/screens.js to route to and
 * UG_DISPATCH.actions / UG_DISPATCH.loadRoute / UG_DISPATCH.loadAll for
 * js/app.js to merge into the existing ALL actions map and loadRouteData.
 *
 * All data reads go through Repo.client() (the same Supabase client the rest
 * of the app uses). The repository is NOT used to write dispatch team data —
 * everything goes through the security-definer RPCs in migration 039/040 so
 * the server re-checks role, unit and barangay on every call.
 *
 * Same design tokens and class names as the rest of the app — ug-card,
 * ug-table, ug-btn, ug-badge, ug-av, ug-chip, ug-dim. No new fonts or CDNs.
 */

const UG_DISPATCH = (function () {
  const esc = UG_UTIL.esc;
  const I = UG.icon;
  const U = UG;

  /* ----------------------------------------------------------- internal state
   * Kept in its own object so the dispatch module owns it; app.js exposes
   * a small UG_APP handle so this module does not need to reach into app.js
   * private state.
   */
  const state = {
    route: 'dispatch',
    openDispatchId: null,
    openEquipmentId: null,
    loading: false,
    error: null,
    lastSync: null,
    data: {
      unit: null,
      personnel: [],
      equipment: [],
      checks: [],
      dispatches: [],
      events: [],
      requests: [],
      notices: [],
      capacity: null,
      directory: { hotlines: [], captains: [] },
      notifications: []
    }
  };

  /* ----------------------------------------------------------------- helpers */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function toLocalInput(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function ago(value) { try { return UG_UTIL.relTime(value); } catch (e) { return ''; } }
  function absTime(value) { try { return UG_UTIL.absTime(value); } catch (e) { return ''; } }

  function client() { return (typeof Repo !== 'undefined' && Repo.client) ? Repo.client() : null; }
  function online() { return !!client(); }

  function rpc(name, args) {
    const c = client();
    if (!c) return Promise.resolve({ local: true });
    return c.rpc(name, args);
  }

  function table(name) {
    const c = client();
    if (!c) return null;
    return c.from(name);
  }

  /* --------------------------------------------------------------- data loaders */
  async function loadUnit() {
    const c = client();
    if (!c) return null;
    const { data: me } = await c.from('profiles').select('dispatch_unit_id, unit_role').eq('id',
      (await c.auth.getUser()).data.user.id).maybeSingle();
    if (!me || !me.dispatch_unit_id) return null;
    const { data: unit } = await c.from('dispatch_units').select('*').eq('id', me.dispatch_unit_id).maybeSingle();
    state.data.unit = unit;
    return unit;
  }

  async function loadEquipment() {
    const c = client(); if (!c) return [];
    const unit = state.data.unit;
    if (!unit) return [];
    const { data } = await c.from('dispatch_equipment')
      .select('*').eq('owner_unit_id', unit.id).order('created_at', { ascending: false });
    state.data.equipment = data || [];
    return data || [];
  }

  async function loadPersonnel() {
    const c = client(); if (!c) return [];
    const unit = state.data.unit; if (!unit) return [];
    const { data } = await c.from('unit_personnel')
      .select('*').eq('unit_id', unit.id).order('on_duty', { ascending: false });
    state.data.personnel = data || [];
    return data || [];
  }

  async function loadDispatches() {
    const c = client(); if (!c) return [];
    const unit = state.data.unit; if (!unit) return [];
    const { data } = await c.from('report_dispatches')
      .select('*, report:reports(*)')
      .eq('unit_id', unit.id)
      .order('dispatched_at', { ascending: false })
      .limit(50);
    state.data.dispatches = data || [];
    return data || [];
  }

  async function loadEvents() {
    const c = client(); if (!c) return [];
    const unit = state.data.unit; if (!unit) return [];
    const ids = (state.data.dispatches || []).map((d) => d.id);
    if (!ids.length) { state.data.events = []; return []; }
    const { data } = await c.from('report_dispatch_events')
      .select('*').in('dispatch_id', ids).order('created_at', { ascending: false });
    state.data.events = data || [];
    return data || [];
  }

  async function loadRequests() {
    const c = client(); if (!c) return [];
    const unit = state.data.unit; if (!unit) return [];
    const { data } = await c.from('unit_requests')
      .select('*').eq('unit_id', unit.id).order('created_at', { ascending: false });
    state.data.requests = data || [];
    return data || [];
  }

  async function loadCapacity() {
    const c = client(); if (!c) return null;
    const unit = state.data.unit; if (!unit) return null;
    const { data } = await c.from('hospital_capacity').select('*').eq('unit_id', unit.id).maybeSingle();
    state.data.capacity = data || null;
    return data || null;
  }

  async function loadNotices() {
    const c = client(); if (!c) return [];
    const unit = state.data.unit; if (!unit) return [];
    const { data } = await c.from('patient_notices')
      .select('*').eq('unit_id', unit.id).order('created_at', { ascending: false });
    state.data.notices = data || [];
    return data || [];
  }

  async function loadDirectory() {
    const c = client(); if (!c) return;
    const { data: hotlines } = await c.from('emergency_hotlines')
      .select('id, agency_name, contact_number, scope, description, category, active')
      .eq('active', true);
    state.data.directory.hotlines = hotlines || [];
    const { data: captains } = await c.from('barangays')
      .select('id, name, captain_name, captain_phone');
    state.data.directory.captains = (captains || []).filter((b) => b.captain_phone);
  }

  async function loadNotifications() {
    const c = client(); if (!c) return [];
    const { data } = await c.from('notifications')
      .select('*').order('created_at', { ascending: false }).limit(50);
    state.data.notifications = data || [];
    return data || [];
  }

  async function loadAll() {
    state.loading = true; state.error = null;
    try {
      await loadUnit();
      await Promise.all([
        loadEquipment(), loadPersonnel(), loadDispatches(),
        loadRequests(), loadNotices(), loadDirectory(), loadNotifications()
      ]);
      await Promise.all([loadEvents(), loadCapacity()]);
      state.lastSync = new Date().toISOString();
    } catch (e) {
      state.error = e.message || 'Could not load your unit data';
    }
    state.loading = false;
    if (window.UG_APP && UG_APP.render) UG_APP.render();
  }

  async function loadRoute(route) {
    state.route = route;
    if (route === 'dispatch-detail' || route === 'dispatch') await loadDispatches().then(loadEvents);
    if (route === 'equipment') await loadEquipment();
    if (route === 'roster') await loadPersonnel();
    if (route === 'requests') await loadRequests();
    if (route === 'hospital') await Promise.all([loadCapacity(), loadNotices()]);
    if (route === 'analytics') await loadDispatches();
    if (window.UG_APP && UG_APP.render) UG_APP.render();
  }

  /* -------------------------------------------------------------- render helpers */
  function pageHead(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  function card(body, extra) {
    return '<div class="ug-card"' + (extra ? ' ' + extra : '') + '><div class="ug-card-b">' + body + '</div></div>';
  }

  function badge(tone, label) {
    return '<span class="ug-badge ug-badge--' + tone + '">' + esc(label) + '</span>';
  }

  function readout(v, l, tone) {
    return '<div class="ug-col" style="gap:3px;padding:14px 16px;background:var(--ug-surface);border:1px solid var(--ug-line);border-radius:14px">' +
      '<span class="ug-mono" style="font-size:22px;font-weight:600;color:' + (tone || 'var(--ug-ink)') + '">' + v + '</span>' +
      '<span class="ug-dimmer" style="font-size:10px;letter-spacing:.05em;text-transform:uppercase">' + l + '</span></div>';
  }

  function emptyState(icon, title, sub) {
    return '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I(icon || 'inbox', 20) + '</span>' +
      '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">' + esc(title) + '</div>' +
      '<div style="font-size:11px">' + esc(sub || '') + '</div></div></div>';
  }

  function statePanel(kind, title, sub) {
    if (kind === 'loading') {
      return '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:10px">' +
        '<div class="ug-skel" style="height:14px;width:38%"></div>' +
        '<div class="ug-skel" style="height:14px;width:72%"></div>' +
        '<div class="ug-skel" style="height:14px;width:56%"></div></div></div>';
    }
    if (kind === 'error') {
      return '<div class="ug-card"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-emergency);display:flex">' + I('alert', 18) + '</span>' +
        '<div><div style="font-size:12.5px;font-weight:700;color:var(--ug-emergency)">' + esc(title) + '</div>' +
        '<div class="ug-note" style="margin-top:4px">' + esc(sub) + '</div></div></div></div>';
    }
    return emptyState('inbox', title, sub);
  }

  /* ----------------------------------------------------- the desktop frame layout */
  const DNAV = [
    ['dispatch',  'Incoming Dispatches', 'truck'],
    ['equipment', 'Equipment & Readiness', 'shield'],
    ['roster',    'Roster & Shifts',       'users'],
    ['hospital',  'Hospital',              'shelter', 'Hospital'],
    ['requests',  'Support Requests',      'inbox'],
    ['analytics', 'Unit Analytics',        'layers'],
    ['contacts',  'Directory',             'phone'],
    ['notifications', 'Notifications',    'bell'],
  ];

  function unitTypeLabel(t) {
    return ({ BFP: 'Fire (BFP)', PNP: 'Police (PNP)', Rescue: 'Rescue Unit', Hospital: 'Hospital' })[t] || t;
  }

  function navItem(item, current) {
    const visible = !item[3] || (state.data.unit && state.data.unit.unit_type === item[3]);
    if (!visible) return '';
    const on = current === item[0];
    return '<button class="ug-nav' + (on ? ' is-on' : '') + '" data-act="dispatch-nav" data-route="' + item[0] + '">' +
      I(item[2], 18) + '<span>' + item[1] + '</span></button>';
  }

  function sidebar(session) {
    const unit = state.data.unit;
    const dutyCount = (state.data.personnel || []).filter((p) => p.on_duty).length;
    const unread = (state.data.notifications || []).filter((n) => !n.read_at).length;
    return '<aside class="ug-side" id="ug-dispatch-nav">' +
      '<button class="ug-brand ug-brand-btn" data-act="dispatch-nav" data-route="dispatch" aria-label="Go to incoming dispatches">' + U.brandMark(32) +
        '<span class="ug-col" style="gap:0"><span class="ug-wordmark" style="font-size:15.5px">Uni<em>Guard</em></span>' +
        '<span class="ug-dimmer" style="font-size:9px;letter-spacing:.1em;text-transform:uppercase">Dispatch console</span></span></button>' +
      DNAV.map((n) => navItem(n, state.route)).join('') +
      '<div style="margin-top:auto" class="ug-col ug-gap6" style="gap:6px">' +
        '<button class="ug-nav" data-act="dispatch-refresh">' + I('wave', 18) + '<span>Refresh</span></button>' +
        '<div class="ug-hr" style="margin:8px 0"></div>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding:4px 8px">' +
          '<span class="ug-av">' + esc((session && session.initials) || '?') + '</span>' +
          '<span class="ug-col" style="gap:0;min-width:0"><span style="font-size:12px;font-weight:600">' + esc(session && session.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(session && session.scope) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + (unit ? unitTypeLabel(unit.unit_type) : '') + (unit && dutyCount ? ' · ' + dutyCount + ' on duty' : '') + '</span></span></div>' +
        '<button class="ug-nav" data-act="logout">' + I('logout', 18) + '<span>Sign out</span></button>' +
        '<div class="ug-mono" style="font-size:9px;color:var(--ug-ink-3);padding:2px 9px 4px">build ' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</div>' +
      '</div>' +
    '</aside>';
  }

  function topbar(session, title, sub) {
    const unread = (state.data.notifications || []).filter((n) => !n.read_at).length;
    return '<header class="ug-top">' +
      '<button class="ug-ico-btn ug-menubtn" data-act="toggle-nav" aria-label="Open the navigation menu">' + I('menu', 18) + '</button>' +
      '<div class="ug-col" style="gap:0;min-width:150px">' +
        '<span style="font-family:var(--ug-display);font-weight:700;font-size:13.5px">' + esc(title) + '</span>' +
        '<span class="ug-dimmer" style="font-size:10.5px">' + esc(sub) + '</span></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px;margin-left:auto">' +
        '<span class="ug-chip ug-top-live is-on">' + I('wave', 13) + 'Live</span>' +
        '<button class="ug-ico-btn" aria-label="Notifications" data-act="dispatch-nav" data-route="notifications">' + I('bell', 17) + (unread ? '<span class="dot"></span>' : '') + '</button>' +
        '<button class="ug-ico-btn" aria-label="Sign out" data-act="logout">' + I('logout', 17) + '</button>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding-left:6px;border-left:1px solid var(--ug-line);margin-left:4px">' +
          '<span class="ug-col ug-top-user" style="gap:0;align-items:flex-end"><span style="font-size:12px;font-weight:600">' + esc(session.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(session.scope) + '</span></span>' +
          '<span class="ug-av">' + esc(session.initials) + '</span>' +
        '</div>' +
      '</div>' +
    '</header>';
  }

  const DTITLES = (function () {
    const map = {
      dispatch: ['UniGuard Dispatch Console', ''],
      'dispatch-detail': ['Dispatch detail', ''],
      equipment: ['Equipment & readiness', 'Track each piece of equipment and run the shift checklist.'],
      roster: ['Roster & shifts', 'Who is on duty, shift times, roles.'],
      hospital: ['Hospital capacity', 'ER/ICU beds, ambulance, accepting / divert, incoming-patient notices.'],
      requests: ['Support requests', 'Ask the LGU for fuel, extra personnel, equipment or mutual aid.'],
      analytics: ['Unit analytics', 'Response time, monthly count, equipment usage.'],
      contacts: ['Directory', 'BFP, PNP, rescue units, hospitals and barangay captains.'],
      notifications: ['Notifications', 'Every push alert delivered to this unit.']
    };
    return function (route) { return map[route] || map.dispatch; };
  })();

  /* ----------------------------------------------------------------- screens */

  function body(st) {
    switch (state.route) {
      case 'dispatch':       return sIncoming(st);
      case 'dispatch-detail': return sDispatchDetail(st);
      case 'equipment':      return sEquipment(st);
      case 'roster':         return sRoster(st);
      case 'hospital':       return sHospital(st);
      case 'requests':       return sRequests(st);
      case 'analytics':      return sAnalytics(st);
      case 'contacts':       return sContacts(st);
      case 'notifications':  return sNotifications(st);
      default:               return sIncoming(st);
    }
  }

  function sIncoming(st) {
    if (state.loading) return pageHead('Incoming Dispatches', 'Open dispatches addressed to your unit.') + statePanel('loading', 'Loading');
    if (state.error)   return pageHead('Incoming Dispatches', 'Open dispatches addressed to your unit.') + statePanel('error', 'Could not load', state.error);
    const list = state.data.dispatches || [];
    const open = list.filter((d) => d.dispatch_status !== 'done');
    if (!list.length) return pageHead('Incoming Dispatches', 'Open dispatches addressed to your unit.') +
      emptyState('truck', 'No dispatches yet', 'When an LGU or barangay official dispatches your unit, the dispatch lands here.');

    const row = (d) => {
      const r = d.report || {};
      return '<button class="ug-card" style="text-align:left;cursor:pointer" data-act="dispatch-open" data-id="' + esc(d.id) + '">' +
        '<div class="ug-card-b ug-col" style="gap:8px">' +
        '<div class="ug-rowf ug-between" style="gap:8px">' +
          '<span style="font-size:13px;font-weight:700">' + esc(r.code || '') + ' · ' + esc(r.hazard_type || 'Hazard') + '</span>' +
          '<span>' + badge(d.dispatch_status, d.dispatch_status) + '</span>' +
        '</div>' +
        '<div class="ug-dim" style="font-size:11.5px">' + esc(r.barangay || '') + (d.eta ? ' · ETA ' + absTime(d.eta) : '') + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">Dispatched ' + ago(d.dispatched_at) + ' by ' + esc(d.dispatched_by_name || '') + '</div>' +
        '</div></button>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Incoming Dispatches', 'Open dispatches addressed to your unit.',
        '<span class="ug-chip is-on">' + open.length + ' active</span>') +
      '<div class="ug-wgrid-3">' + list.slice(0, 12).map(row).join('') + '</div>' +
      (list.length > 12 ? '<button class="ug-btn ug-btn--ghost" data-act="dispatch-nav" data-route="analytics">View all</button>' : '') +
      '</div>';
  }

  function sDispatchDetail(st) {
    const id = state.openDispatchId;
    const d = (state.data.dispatches || []).find((x) => x.id === id);
    if (!d) return pageHead('Dispatch detail', '') + emptyState('truck', 'No dispatch selected', 'Open one from the list.');
    const r = d.report || {};
    const events = (state.data.events || []).filter((e) => e.dispatch_id === d.id);
    const next = d.dispatch_status === 'sent' ? 'acknowledged'
      : d.dispatch_status === 'acknowledged' ? 'en_route'
      : d.dispatch_status === 'en_route' ? 'on_scene'
      : d.dispatch_status === 'on_scene' ? 'done' : null;
    const stepLabel = (s) => ({ sent: 'Acknowledge', acknowledged: 'En route', en_route: 'On scene', on_scene: 'Done', done: 'Done' })[s] || s;

    const eventsList = events.length ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Note</th></tr></thead><tbody>' +
      events.map((e) => '<tr><td class="t-num">' + absTime(e.created_at) + '</td><td>' + esc(e.actor_name) + '</td><td>' + esc(e.action) + '</td><td class="ug-dimmer" style="font-size:11px">' + esc(e.note) + '</td></tr>').join('') +
      '</tbody></table></div>' : '';
    const afterAction = d.after_action ? card('<div class="ug-col" style="gap:6px"><div style="font-size:12px;font-weight:700">' + esc('After-action report') + '</div>' +
      '<div class="ug-note" style="font-size:11.5px;white-space:pre-wrap">' + esc(d.after_action) + '</div>' +
      '<div class="ug-dimmer" style="font-size:10px">Filed ' + ago(d.after_action_at) + '</div></div>') : '';

    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Dispatch ' + (d.id || '').slice(0, 8), 'Incident ' + (r.code || '') + ' · ' + (r.barangay || ''),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="dispatch-nav" data-route="dispatch">' + I('chevron', 13) + 'Back</button>') +
      '<div class="ug-wgrid-2">' +
        card('<div class="ug-col" style="gap:8px"><div style="font-size:13px;font-weight:700">' + esc(r.code || '') + ' · ' + esc(r.hazard_type || '') + '</div>' +
          '<div class="ug-dim" style="font-size:12px">' + esc(r.description || '') + '</div>' +
          '<div class="ug-rowf ug-gap10" style="gap:10px"><span class="ug-badge ug-badge--id">' + esc(r.barangay || '') + '</span>' +
            '<span class="ug-badge ug-badge--' + (r.severity || 'advisory') + '">' + esc(r.severity || '') + '</span>' +
            (d.eta ? '<span class="ug-dim">ETA ' + absTime(d.eta) + '</span>' : '') + '</div>' +
          '<div class="ug-dimmer" style="font-size:10.5px">Dispatched by ' + esc(d.dispatched_by_name || '') + ' · ' + ago(d.dispatched_at) + '</div>' +
          '<div class="ug-note" style="font-size:11.5px;white-space:pre-wrap;margin-top:6px">' + esc(d.instructions || '') + '</div></div>') +
        card('<div class="ug-col" style="gap:10px"><div style="font-size:13px;font-weight:700">Status</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px">' + badge(d.dispatch_status, stepLabel(d.dispatch_status)) + '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px">' +
            (next ? '<input class="ug-in" type="text" data-act="dispatch-note" data-id="' + esc(d.id) + '" placeholder="Note (optional)" style="flex:1;max-width:none">' : '') +
            (next ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-respond" data-id="' + esc(d.id) + '" data-next="' + next + '">' + stepLabel(next) + '</button>' : '') +
          '</div>' +
          '<div class="ug-dim" style="font-size:11px">Each step is one click. On scene and Done notify the reporter.</div></div>') +
      '</div>' +
      eventsList +
      afterAction +
      (d.dispatch_status === 'done' && !d.after_action ? card('<div class="ug-col" style="gap:8px"><div style="font-size:13px;font-weight:700">File an after-action report</div>' +
        '<textarea class="ug-ta" rows="4" data-act="dispatch-aa" data-id="' + esc(d.id) + '" placeholder="What was done, time spent, equipment used, casualties or patients, outcome"></textarea>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-aa-submit" data-id="' + esc(d.id) + '">' + I('check', 14) + 'Submit after-action</button></div>') : '') +
    '</div>';
  }

  function sEquipment(st) {
    if (state.loading) return pageHead('Equipment & readiness', '') + statePanel('loading');
    if (state.error)   return pageHead('Equipment & readiness', '') + statePanel('error', 'Could not load', state.error);
    const rows = state.data.equipment || [];
    if (!rows.length) return pageHead('Equipment & readiness', 'Track each piece and run the shift checklist.') +
      emptyState('shield', 'No equipment yet', 'Your unit admin can add equipment here.');
    const overdue = rows.filter((r) => !r.last_checked_at || (Date.now() - Date.parse(r.last_checked_at)) > 86400000).length;
    const row = (r) => {
      const overdueClass = !r.last_checked_at || (Date.now() - Date.parse(r.last_checked_at)) > 86400000 ? ' style="border-left:3px solid var(--ug-warning)"' : '';
      return '<tr' + overdueClass + '>' +
        '<td><div style="font-weight:600">' + esc(r.identifier || r.custom_label || 'Equipment') + '</div>' +
          '<div class="ug-dimmer" style="font-size:10.5px">' + esc(r.notes || '') + '</div></td>' +
        '<td>' + badge(r.status, r.status) + '</td>' +
        '<td>' + badge(r.condition, r.condition) + '</td>' +
        '<td class="t-num">' + (r.last_checked_at ? ago(r.last_checked_at) : 'never') + '</td>' +
        '<td class="t-right"><button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-check" data-id="' + esc(r.id) + '">Check</button>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-status" data-id="' + esc(r.id) + '">Status</button></td>' +
      '</tr>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Equipment & readiness', 'Track each piece and run the shift checklist.',
        '<span class="ug-chip is-on">' + rows.length + ' items</span>' +
        (overdue ? '<span class="ug-chip" style="background:rgba(255,179,64,.14);color:var(--ug-warning)">' + overdue + ' OVERDUE</span>' : '')) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Equipment</th><th>Status</th><th>Condition</th><th>Last check</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + rows.map(row).join('') + '</tbody></table></div>' +
      (state.data.unit && state.data.unit.unit_type === 'Hospital' ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-nav" data-route="hospital">' + I('shelter', 14) + 'Hospital capacity</button>' : '') +
    '</div>';
  }

  function sRoster(st) {
    if (state.loading) return pageHead('Roster & shifts', '') + statePanel('loading');
    if (state.error)   return pageHead('Roster & shifts', '') + statePanel('error', 'Could not load', state.error);
    const rows = state.data.personnel || [];
    const unit = state.data.unit;
    const canInvite = unit && (st.session && st.session.unit_role === 'unit_admin');
    const inviteBtn = canInvite ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="admin-invite-unit-member" data-unit-id="' + esc(unit && unit.id) + '">' + I('plus', 14) + 'Invite member</button>' : '';
    if (!rows.length) return pageHead('Roster & shifts', 'Who is on duty, shift times, roles.', inviteBtn) +
      emptyState('users', 'No personnel yet', canInvite ? 'Use Invite member to send an email to a new unit member.' : 'Ask your unit admin to add personnel.');
    const onDuty = rows.filter((p) => p.on_duty).length;
    const row = (p) => '<tr>' +
      '<td><div style="font-weight:600">' + esc(p.name) + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(p.role || '') + '</div></td>' +
      '<td>' + esc(p.phone || '') + '</td>' +
      '<td>' + badge(p.on_duty ? 'on' : 'off', p.on_duty ? 'On duty' : 'Off duty') + '</td>' +
      '<td class="t-num">' + (p.shift_start ? absTime(p.shift_start) : '—') + '</td>' +
      '<td class="t-right"><button class="ug-btn ug-btn--sm' + (p.on_duty ? '' : ' ug-btn--signal') + '" data-act="dispatch-duty" data-id="' + esc(p.id) + '" data-next="' + (p.on_duty ? 'false' : 'true') + '">' + (p.on_duty ? 'Clock out' : 'Clock in') + '</button></td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Roster & shifts', 'Who is on duty, shift times, roles.',
        '<span class="ug-chip is-on">' + onDuty + ' on duty</span>' + inviteBtn) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Name / role</th><th>Phone</th><th>Status</th><th>Shift start</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + rows.map(row).join('') + '</tbody></table></div></div>';
  }

  function sHospital(st) {
    if (state.loading) return pageHead('Hospital', '') + statePanel('loading');
    if (state.error)   return pageHead('Hospital', '') + statePanel('error', 'Could not load', state.error);
    const cap = state.data.capacity || { er_beds: 0, icu_beds: 0, available: 0, accepting: true };
    const notices = state.data.notices || [];
    const noticeRow = (n) => '<tr>' +
      '<td class="t-num">' + absTime(n.created_at) + '</td>' +
      '<td class="t-num">' + esc(n.patients || 1) + '</td>' +
      '<td>' + esc(n.condition || '') + '</td>' +
      '<td>' + badge(n.status, n.status) + '</td>' +
      '<td class="t-right">' + (n.status === 'sent' ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="dispatch-ack-notice" data-id="' + esc(n.id) + '">Ack</button>' : '') + '</td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Hospital capacity', 'ER / ICU beds, ambulance, accepting / divert, incoming-patient notices.',
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-capacity-edit">' + I('settings', 14) + 'Update</button>') +
      '<div class="ug-rowf ug-gap10" style="gap:10px">' +
        readout(cap.er_beds, 'ER beds', 'var(--ug-signal)') +
        readout(cap.icu_beds, 'ICU beds', 'var(--ug-signal)') +
        readout(cap.available, 'Available', 'var(--ug-prepared)') +
        readout(cap.accepting ? 'Accepting' : 'Divert', 'Status', cap.accepting ? 'var(--ug-prepared)' : 'var(--ug-emergency)') +
      '</div>' +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Patients</th><th>Condition</th><th>Status</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + (notices.length ? notices.map(noticeRow).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px">No incoming-patient notices</td></tr>') + '</tbody></table></div>' +
    '</div>';
  }

  function sRequests(st) {
    if (state.loading) return pageHead('Support requests', '') + statePanel('loading');
    if (state.error)   return pageHead('Support requests', '') + statePanel('error', 'Could not load', state.error);
    const rows = state.data.requests || [];
    const open = rows.filter((r) => r.status === 'pending' || r.status === 'approved');
    const row = (r) => '<tr>' +
      '<td class="t-num">' + absTime(r.created_at) + '</td>' +
      '<td><span class="ug-badge ug-badge--id">' + esc(r.kind) + '</span></td>' +
      '<td>' + esc(r.details) + '</td>' +
      '<td>' + badge(r.status, r.status) + '</td>' +
      '<td class="t-num">' + (r.decided_at ? absTime(r.decided_at) : '—') + '</td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Support requests', 'Ask the LGU for fuel, extra personnel, equipment or mutual aid.',
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-request-new">' + I('plus', 14) + 'New request</button>') +
      (open.length ? '<span class="ug-chip is-on">' + open.length + ' open</span>' : '') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Kind</th><th>Details</th><th>Status</th><th>Decided</th></tr></thead>' +
      '<tbody>' + (rows.length ? rows.map(row).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px">No requests yet</td></tr>') + '</tbody></table></div>' +
    '</div>';
  }

  function sAnalytics(st) {
    const dispatches = state.data.dispatches || [];
    if (!dispatches.length) return pageHead('Unit analytics', '') + emptyState('layers', 'No dispatches yet', 'Your response time and monthly count appear here once you have an active dispatch.');
    const acks = dispatches.filter((d) => d.ack_at).length;
    const avgAck = acks ? (dispatches.reduce((s, d) => s + (Date.parse(d.ack_at) - Date.parse(d.dispatched_at)) / 60000, 0) / acks).toFixed(1) : '—';
    const scenes = dispatches.filter((d) => d.on_scene_at && d.ack_at).length;
    const avgScene = scenes ? (dispatches.reduce((s, d) => s + (Date.parse(d.on_scene_at) - Date.parse(d.ack_at)) / 60000, 0) / scenes).toFixed(1) : '—';
    const done = dispatches.filter((d) => d.dispatch_status === 'done').length;
    const month = dispatches.filter((d) => {
      const m = new Date(); return new Date(d.dispatched_at).getMonth() === m.getMonth() && new Date(d.dispatched_at).getFullYear() === m.getFullYear();
    }).length;
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Unit analytics', 'Response time, monthly count, equipment usage.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="dispatch-csv">' + I('download', 14) + 'Export CSV</button>') +
      '<div class="ug-rowf ug-gap10" style="gap:10px">' +
        readout(dispatches.length, 'Total dispatches', 'var(--ug-signal)') +
        readout(month, 'This month', 'var(--ug-signal)') +
        readout(avgAck + ' min', 'Avg ack', 'var(--ug-prepared)') +
        readout(avgScene + ' min', 'Avg to scene', 'var(--ug-prepared)') +
        readout(done, 'Completed', 'var(--ug-prepared)') +
      '</div>' +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Incident</th><th>Barangay</th><th>Status</th><th>Ack</th><th>On scene</th></tr></thead>' +
      '<tbody>' + dispatches.slice(0, 30).map((d) => '<tr>' +
        '<td class="t-num">' + absTime(d.dispatched_at) + '</td>' +
        '<td>' + esc(d.report && d.report.code) + '</td>' +
        '<td>' + esc(d.report && d.report.barangay) + '</td>' +
        '<td>' + badge(d.dispatch_status, d.dispatch_status) + '</td>' +
        '<td class="t-num">' + (d.ack_at ? ago(d.ack_at) : '—') + '</td>' +
        '<td class="t-num">' + (d.on_scene_at ? ago(d.on_scene_at) : '—') + '</td>' +
      '</tr>').join('') + '</tbody></table></div></div>';
  }

  function sContacts(st) {
    const dir = state.data.directory || {};
    const hotlines = dir.hotlines || [];
    const captains = dir.captains || [];
    const callLink = (num) => '<a class="ug-btn ug-btn--sm ug-btn--signal" href="tel:' + esc(String(num).replace(/[^+\d]/g, '')) + '">' + I('phone', 13) + 'Call</a>';
    const row = (h) => '<tr><td><div style="font-weight:600">' + esc(h.agency_name) + '</div>' +
      '<div class="ug-dimmer" style="font-size:10.5px">' + esc(h.scope || '') + '</div></td>' +
      '<td>' + esc(h.category || 'Other') + '</td>' +
      '<td class="t-num">' + esc(h.contact_number) + '</td>' +
      '<td class="t-right">' + callLink(h.contact_number) + '</td></tr>';
    const cRow = (c) => '<tr><td><div style="font-weight:600">' + esc(c.captain_name || '(unassigned)') + '</div>' +
      '<div class="ug-dimmer" style="font-size:10.5px">Brgy Captain · ' + esc(c.name) + '</div></td>' +
      '<td class="t-num">' + esc(c.captain_phone || '—') + '</td>' +
      '<td class="t-right">' + (c.captain_phone ? callLink(c.captain_phone) : '') + '</td></tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Directory', 'BFP, PNP, rescue units, hospitals and barangay captains. Tap to call.') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Agency</th><th>Category</th><th>Number</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + hotlines.map(row).join('') + '</tbody></table></div>' +
      (captains.length ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Barangay captain</th><th>Phone</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + captains.map(cRow).join('') + '</tbody></table></div>' : '') +
    '</div>';
  }

  function sNotifications(st) {
    const rows = state.data.notifications || [];
    if (!rows.length) return pageHead('Notifications', '') + emptyState('bell', 'No notifications yet', 'Alerts delivered to this unit appear here.');
    const row = (n) => '<tr>' +
      '<td class="t-num">' + absTime(n.created_at) + '</td>' +
      '<td>' + esc(n.title) + '</td>' +
      '<td class="ug-dim" style="font-size:11.5px">' + esc(n.body) + '</td>' +
      '<td>' + (n.read_at ? badge('open', 'Read') : badge('warning', 'Unread')) + '</td>' +
      '<td class="t-right">' + (n.read_at ? '' : '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-notif-read" data-id="' + esc(n.id) + '">Mark read</button>') + '</td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Notifications', 'Every push alert delivered to this unit.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="dispatch-notif-read-all">Mark all read</button>') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Title</th><th>Body</th><th>Status</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + rows.map(row).join('') + '</tbody></table></div></div>';
  }

  /* --------------------------------------------------------------- the frame */
  function frame(st) {
    const session = st.session;
    const t = DTITLES(state.route);
    return '<div class="ug ug-frame ug-d' + (st.fixed ? ' ug-fixed' : '') + '"' +
      (st.fixed ? ' style="width:' + st.w + 'px;height:' + st.h + 'px"' : '') + '>' +
      '<div class="ug-d-shell">' + sidebar(session) +
        '<div class="ug-nav-scrim" data-act="close-nav" aria-hidden="true"></div>' +
        '<div class="ug-d-main">' + topbar(session, t[0], t[1]) +
          (state.error ? '<div class="ug-offline">' + I('alert', 14) + '<span>' + esc(state.error) + '</span></div>' : '') +
          '<div class="ug-d-body ug-scroll">' + body(st) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ----------------------------------------------------------------- actions */
  const actions = {
    'dispatch-nav': (d) => { state.route = d.route; if (window.UG_APP && UG_APP.go) UG_APP.go('dispatch'); loadRoute(d.route); },
    'dispatch-refresh': () => loadAll(),
    'dispatch-open': (d) => { state.openDispatchId = d.id; state.route = 'dispatch-detail'; if (window.UG_APP && UG_APP.render) UG_APP.render(); },
    'dispatch-respond': async (d) => {
      try {
        const note = (document.querySelector('[data-act="dispatch-note"][data-id="' + d.id + '"]') || {}).value || '';
        await rpc('dispatch_respond', { p_dispatch_id: d.id, p_action: d.next, p_note: note });
        if (window.UG_APP && UG_APP.toast) UG_APP.toast('Status updated to ' + d.next, 'prepared');
        await loadDispatches(); await loadEvents();
        if (window.UG_APP && UG_APP.render) UG_APP.render();
      } catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message || 'Could not update', 'warning'); }
    },
    'dispatch-check': (d) => { state.openEquipmentId = d.id; openCheckModal(d.id); },
    'dispatch-status': (d) => openStatusModal(d.id),
    'dispatch-duty': async (d) => {
      try {
        await rpc('set_personnel_duty', { p_personnel_id: d.id, p_on_duty: d.next === 'true' });
        await loadPersonnel();
        if (window.UG_APP && UG_APP.render) UG_APP.render();
      } catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
    },
    'dispatch-ack-notice': async (d) => {
      try {
        await rpc('ack_patient_notice', { p_notice_id: d.id, p_status: 'acknowledged' });
        await loadNotices();
        if (window.UG_APP && UG_APP.render) UG_APP.render();
      } catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
    },
    'dispatch-aa-submit': async (d) => {
      const ta = document.querySelector('[data-act="dispatch-aa"][data-id="' + d.id + '"]');
      const text = ta ? ta.value : '';
      if (!text || !text.trim()) { if (window.UG_APP && UG_APP.toast) UG_APP.toast('Write a short summary', 'warning'); return; }
      try {
        await rpc('submit_after_action', { p_dispatch_id: d.id, p_text: text, p_meta: {} });
        if (window.UG_APP && UG_APP.toast) UG_APP.toast('After-action submitted', 'prepared');
        await loadDispatches();
        if (window.UG_APP && UG_APP.render) UG_APP.render();
      } catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
    },
    'dispatch-csv': () => exportCsv(),
    'dispatch-request-new': () => openRequestModal(),
    'dispatch-capacity-edit': () => openCapacityModal(),
    'dispatch-notif-read': async (d) => {
      const c = client(); if (!c) return;
      try { await c.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', d.id); await loadNotifications(); if (window.UG_APP && UG_APP.render) UG_APP.render(); }
      catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
    },
    'dispatch-notif-read-all': async () => {
      const c = client(); if (!c) return;
      const ids = (state.data.notifications || []).filter((n) => !n.read_at).map((n) => n.id);
      if (!ids.length) return;
      try { await c.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids); await loadNotifications(); if (window.UG_APP && UG_APP.render) UG_APP.render(); }
      catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
    }
  };

  /* ------------------------------------------------------------- modals & CSV */
  function openCheckModal(id) {
    const eq = (state.data.equipment || []).find((e) => e.id === id);
    if (!eq) return;
    const condOpts = ['ready', 'needs_repair', 'missing', 'out_of_service', 'unknown'].map((c) => '<option value="' + c + '">' + c + '</option>').join('');
    if (window.UG_FEATURES && UG_FEATURES.modal) {
      UG_FEATURES.modal({
        title: 'Readiness check · ' + (eq.identifier || eq.custom_label || 'equipment'),
        body: '<div class="ug-field"><label class="ug-lab">Condition</label><select class="ug-sel" data-ck-cond>' + condOpts + '</select></div>' +
              '<div class="ug-field"><label class="ug-lab">Level (fuel / pressure / etc.)</label><input class="ug-in" type="text" data-ck-level placeholder="e.g. 80% or 200 bar"></div>' +
              '<div class="ug-field"><label class="ug-lab">Notes</label><textarea class="ug-ta" rows="2" data-ck-notes></textarea></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-ck-save>Save check</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-ck-save]').addEventListener('click', async () => {
            try {
              await rpc('record_equipment_check', {
                p_equipment_id: id, p_condition: wrap.querySelector('[data-ck-cond]').value,
                p_level: wrap.querySelector('[data-ck-level]').value, p_notes: wrap.querySelector('[data-ck-notes]').value,
                p_photo: null, p_items: []
              });
              if (window.UG_APP && UG_APP.toast) UG_APP.toast('Check recorded', 'prepared');
              await loadEquipment();
              if (window.UG_APP && UG_APP.render) UG_APP.render();
              close();
            } catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
          });
        }
      });
    }
  }

  function openStatusModal(id) {
    const eq = (state.data.equipment || []).find((e) => e.id === id);
    if (!eq) return;
    const statusOpts = ['available', 'deployed', 'maintenance', 'unavailable'].map((s) => '<option value="' + s + '"' + (s === eq.status ? ' selected' : '') + '>' + s + '</option>').join('');
    if (window.UG_FEATURES && UG_FEATURES.modal) {
      UG_FEATURES.modal({
        title: 'Set status · ' + (eq.identifier || eq.custom_label || 'equipment'),
        body: '<div class="ug-field"><label class="ug-lab">Status</label><select class="ug-sel" data-st-status>' + statusOpts + '</select></div>' +
              '<div class="ug-field"><label class="ug-lab">Notes</label><textarea class="ug-ta" rows="2" data-st-notes>' + esc(eq.notes || '') + '</textarea></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-st-save>Save</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-st-save]').addEventListener('click', async () => {
            try {
              await rpc('set_equipment_status', {
                p_equipment_id: id, p_status: wrap.querySelector('[data-st-status]').value,
                p_condition: null, p_notes: wrap.querySelector('[data-st-notes]').value
              });
              await loadEquipment();
              if (window.UG_APP && UG_APP.render) UG_APP.render();
              close();
            } catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
          });
        }
      });
    }
  }

  function openRequestModal() {
    const kindOpts = ['fuel', 'personnel', 'equipment', 'mutual_aid', 'other'].map((k) => '<option value="' + k + '">' + k + '</option>').join('');
    if (window.UG_FEATURES && UG_FEATURES.modal) {
      UG_FEATURES.modal({
        title: 'New support request',
        body: '<div class="ug-field"><label class="ug-lab">Kind</label><select class="ug-sel" data-rq-kind>' + kindOpts + '</select></div>' +
              '<div class="ug-field"><label class="ug-lab">Details</label><textarea class="ug-ta" rows="3" data-rq-details placeholder="What do you need?"></textarea></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-rq-save>Send</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-rq-save]').addEventListener('click', async () => {
            try {
              await rpc('create_unit_request', {
                p_unit_id: state.data.unit.id, p_kind: wrap.querySelector('[data-rq-kind]').value,
                p_details: wrap.querySelector('[data-rq-details]').value
              });
              if (window.UG_APP && UG_APP.toast) UG_APP.toast('Request sent to the LGU', 'prepared');
              await loadRequests();
              if (window.UG_APP && UG_APP.render) UG_APP.render();
              close();
            } catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
          });
        }
      });
    }
  }

  function openCapacityModal() {
    const cap = state.data.capacity || { er_beds: 0, icu_beds: 0, available: 0, accepting: true };
    if (window.UG_FEATURES && UG_FEATURES.modal) {
      UG_FEATURES.modal({
        title: 'Update hospital capacity',
        body: '<div class="ug-field"><label class="ug-lab">ER beds</label><input class="ug-in" type="number" min="0" data-cap-er value="' + cap.er_beds + '"></div>' +
              '<div class="ug-field"><label class="ug-lab">ICU beds</label><input class="ug-in" type="number" min="0" data-cap-icu value="' + cap.icu_beds + '"></div>' +
              '<div class="ug-field"><label class="ug-lab">Available</label><input class="ug-in" type="number" min="0" data-cap-avail value="' + cap.available + '"></div>' +
              '<div class="ug-field"><label class="ug-lab">Accepting patients</label><select class="ug-sel" data-cap-accepting>' +
                '<option value="true"' + (cap.accepting ? ' selected' : '') + '>Accepting</option>' +
                '<option value="false"' + (!cap.accepting ? ' selected' : '') + '>Divert</option></select></div>',
        footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-cap-save>Save</button>',
        onMount: (wrap, close) => {
          wrap.querySelector('[data-cap-save]').addEventListener('click', async () => {
            try {
              await rpc('set_hospital_capacity', {
                p_unit_id: state.data.unit.id,
                p_er_beds: parseInt(wrap.querySelector('[data-cap-er]').value, 10) || 0,
                p_icu_beds: parseInt(wrap.querySelector('[data-cap-icu]').value, 10) || 0,
                p_available: parseInt(wrap.querySelector('[data-cap-avail]').value, 10) || 0,
                p_accepting: wrap.querySelector('[data-cap-accepting]').value === 'true'
              });
              if (window.UG_APP && UG_APP.toast) UG_APP.toast('Capacity updated', 'prepared');
              await loadCapacity();
              if (window.UG_APP && UG_APP.render) UG_APP.render();
              close();
            } catch (e) { if (window.UG_APP && UG_APP.toast) UG_APP.toast(e.message, 'warning'); }
          });
        }
      });
    }
  }

  function exportCsv() {
    const rows = state.data.dispatches || [];
    if (!rows.length) { if (window.UG_APP && UG_APP.toast) UG_APP.toast('No data to export', 'warning'); return; }
    const head = ['dispatched_at', 'ack_at', 'on_scene_at', 'done_at', 'dispatch_status', 'team', 'instructions', 'report_code', 'report_barangay'];
    const lines = [head.join(',')].concat(rows.map((d) => head.map((k) => {
      let v = d[k]; if (k.startsWith('report_')) v = d.report ? d.report[k.replace('report_', '')] : '';
      v = String(v == null ? '' : v).replace(/"/g, '""');
      return /[",\n]/.test(v) ? '"' + v + '"' : v;
    }).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    if (UG_UTIL.downloadBlob) UG_UTIL.downloadBlob(blob, 'dispatch-stats.csv');
    else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'dispatch-stats.csv'; a.click(); }
  }

  /* ----------------------------------------------------------------- exports */
  return {
    state, frame, body, loadAll, loadRoute, actions,
    DTITLES: (r) => DTITLES(r)
  };
})();

window.UG_DISPATCH = UG_DISPATCH;
