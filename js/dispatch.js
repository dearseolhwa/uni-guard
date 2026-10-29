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
  const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);

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
      directory: { hotlines: [], captains: [], patrolShelters: [], escortList: [] },
      notifications: [],
      helpRequests: [],
      acceptingHospitals: []
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
    /* PRIORITY 0 / defect 4: Supabase returns { data, error }. The old
       code awaited the whole object, which is truthy even when error is
       set, so server errors silently no-op'd (no toast, no re-render).
       Now we reject on .error so the calling action's catch block fires
       and surfaces the message. */
    return c.rpc(name, args).then((res) => {
      if (!res) return res;
      if (res.error) {
        const e = res.error;
        const msg = (e && (e.message || e.details || e.code)) || ('RPC failed: ' + name);
        throw new Error(String(msg));
      }
      return res.data !== undefined ? res.data : res;
    });
  }

  /* ----------------------------------------------------- app bridge helper
   * PRIORITY 0 fix (Oct 24 2026): the old code did
   *   app().render();
   * 62 times. window.UG_APP was never assigned (app.js only exposed
   * window.UG_App, mixed case), so every dispatch click silently
   * no-op'd. This helper fails LOUDLY the first time the bridge is
   * missing: console.error + a visible toast (via window.UG_TOAST,
   * which IS exposed). Subsequent failures return a noop bridge so
   * catch blocks that call app().toast(...) do not recurse or throw. */
  let __bridgeMissingWarned = false;
  const NOOP_BRIDGE = {
    render: () => {},
    go: () => {},
    toast: () => {},
    loadRouteData: () => Promise.resolve(),
    actions: {}
  };
  function app() {
    if (window.UG_APP) return window.UG_APP;
    if (!__bridgeMissingWarned) {
      __bridgeMissingWarned = true;
      const msg = 'Dispatch bridge missing: window.UG_APP is undefined. The console cannot re-render or toast. Reload the page; if this persists, the app.js boot did not finish.';
      try { console.error('[UniGuard dispatch]', msg); } catch (e) {}
      if (typeof window.UG_TOAST === 'function') {
        try { window.UG_TOAST(msg, 'warning'); } catch (e) {}
      }
    }
    return NOOP_BRIDGE;
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

  /* A2: dispatch help requests addressed to the caller's unit (the unit's
     own rows) — barangay-official rows are not visible here (the official
     uses the Response Team screen). */
  async function loadHelpRequests() {
    const c = client(); if (!c) return [];
    const unit = state.data.unit; if (!unit) return [];
    const { data } = await c.from('dispatch_help_requests')
      .select('*').eq('unit_id', unit.id).order('created_at', { ascending: false });
    state.data.helpRequests = data || [];
    return data || [];
  }

  /* F2: the shared hospital picker. Active Hospital units whose
     hospital_capacity.accepting = true. Used by the ambulance run (F3),
     E3 rescue tally destinations and the E4 patient-notice button. */
  async function loadAcceptingHospitals() {
    const c = client(); if (!c) return [];
    const { data } = await c.from('dispatch_units')
      .select('id,name,unit_type,hospital_capacity!inner(accepting,available,er_beds,icu_beds)')
      .eq('unit_type', 'Hospital')
      .eq('active', true)
      .eq('hospital_capacity.accepting', true)
      .order('name', { ascending: true });
    state.data.acceptingHospitals = (data || []).map((h) => ({
      id: h.id, name: h.name,
      available: h.hospital_capacity ? h.hospital_capacity.available : null
    }));
    return state.data.acceptingHospitals;
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
    /* D2 + D3: PNP-only lists. Loaded for every dispatch_team user but
       only surfaced on the PNP console. */
    const { data: patrols } = await c.from('evacuation_centers')
      .select('id, name, barangay, barangay_id, needs_patrol, needs_patrol_at')
      .eq('needs_patrol', true);
    state.data.directory.patrolShelters = patrols || [];
    const { data: escorts } = await c.from('relief_distributions')
      .select('*')
      .neq('escort_status', 'none');
    state.data.directory.escortList = escorts || [];
  }

  async function loadNotifications() {
    const c = client(); if (!c) return [];
    const { data } = await c.from('notifications')
      .select('*').order('created_at', { ascending: false }).limit(50);
    state.data.notifications = data || [];
    return data || [];
  }

  /* opts.silent: a background refresh (poll, new assignment); the screen
     keeps showing the current data instead of the loading panel */
  async function loadAll(opts) {
    const silent = !!(opts && opts.silent);
    if (!silent) { state.loading = true; state.error = null; }
    try {
      await loadUnit();
      await Promise.all([
        loadEquipment(), loadPersonnel(), loadDispatches(),
        loadRequests(), loadNotices(), loadDirectory(), loadNotifications()
      ]);
      await Promise.all([loadEvents(), loadCapacity(), loadHelpRequests(), loadAcceptingHospitals()]);
      state.lastSync = new Date().toISOString();
      state.error = null;
    } catch (e) {
      if (!silent) state.error = e.message || 'Could not load your unit data';
    }
    state.loading = false;
    alarmOnNewDispatch();
    watchUnitDispatches();
    syncTracking();
    app().render();
  }

  /* ------------------------------------------------- new-assignment alarm */
  /* A new dispatch for the unit sounds its hazard's alarm; a hospital also
     hears a new patient notice. The first load after sign-in only records
     what is already there. */
  let seenDispatches = null;
  let seenNotices = null;
  function alarmOnNewDispatch() {
    const notices = state.data.notices || [];
    if (!seenNotices) seenNotices = new Set(notices.map((n) => n.id));
    else {
      const freshN = notices.filter((n) => !seenNotices.has(n.id) && (n.status || 'sent') === 'sent');
      notices.forEach((n) => seenNotices.add(n.id));
      if (freshN.length) {
        try { UG_ALARM.play('dispatch'); } catch (e) { }
        app().toast('New patient notice: ' + (freshN[0].patients || 1) + ' incoming', 'warning');
      }
    }
    const list = state.data.dispatches || [];
    if (!seenDispatches) { seenDispatches = new Set(list.map((d) => d.id)); return; }
    const fresh = list.filter((d) => !seenDispatches.has(d.id) && d.dispatch_status === 'sent');
    list.forEach((d) => seenDispatches.add(d.id));
    if (!fresh.length) return;
    const r = fresh[0].report || {};
    try { UG_ALARM.play(UG_HAZARDS.displayLabel(r.hazard_type, r.hazard_other_text), { force: true }); } catch (e) { }
    app().toast('New dispatch: ' + (r.code || '') + ' · ' + (r.barangay || ''), 'warning');
  }

  /* a new assignment arrives within seconds: Realtime on this unit's rows.
     Only inserts matter here; status and position updates come from this
     device itself, and the poll in js/app.js catches anything else. */
  let unitChannel = null;
  let unitChannelFor = null;
  function watchUnitDispatches() {
    const c = client();
    const unit = state.data.unit;
    if (!c || !unit || unitChannelFor === unit.id) return;
    try {
      if (unitChannel) c.removeChannel(unitChannel);
      unitChannelFor = unit.id;
      unitChannel = c.channel('ug-unit-' + unit.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_dispatches', filter: 'unit_id=eq.' + unit.id },
          (payload) => { ringForInsert(payload && payload.new); })
        .subscribe();
    } catch (e) { /* the poll still covers it */ }
  }

  /* ring at once with the report's hazard alarm, even when the screen has to
     wait (someone typing) before it can show the new dispatch */
  async function ringForInsert(row) {
    if (!row || !row.id) return;
    if (seenDispatches && seenDispatches.has(row.id)) return;
    if (seenDispatches) seenDispatches.add(row.id);
    let label = 'dispatch';
    try {
      const { data: r } = await client().from('reports').select('code, barangay, hazard_type, hazard_other_text').eq('id', row.report_id).maybeSingle();
      if (r) {
        label = UG_HAZARDS.displayLabel(r.hazard_type, r.hazard_other_text);
        app().toast('New dispatch: ' + (r.code || '') + ' · ' + (r.barangay || ''), 'warning');
      }
    } catch (e) { }
    try { UG_ALARM.play(label, { force: true }); } catch (e) { }
    if (typeof window.UG_DISPATCH_REFRESH === 'function') window.UG_DISPATCH_REFRESH();
    else loadAll({ silent: true });
  }

  /* ------------------------------------------------------- GPS tracking */
  /* While the unit has an open dispatch, this device shares its position
     (update_dispatch_location, migration 057). The server moves the status
     by itself: acknowledged on the first fix, en route after 50 m of
     movement, on scene within 100 m of the report. Responders press Done. */
  const SEND_EVERY_MS = 15000;
  const SEND_MOVED_M = 25;
  const track = { watchId: null, status: 'off', fix: null, sent: null, sending: false, error: '' };

  const metres = UG_UTIL.distanceM;
  function openDispatches() {
    return (state.data.dispatches || []).filter((d) => d.dispatch_status !== 'done' && d.dispatch_status !== 'declined');
  }

  function syncTracking() {
    const need = openDispatches().length > 0 && online();
    if (need && track.watchId == null && track.status !== 'denied') startTracking();
    if (!need && track.watchId != null) stopTracking();
  }
  function startTracking() {
    if (!('geolocation' in navigator)) { track.status = 'unsupported'; return; }
    track.status = 'starting'; track.error = '';
    try {
      track.watchId = navigator.geolocation.watchPosition(onFix, onFixError,
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    } catch (e) { track.status = 'unsupported'; track.watchId = null; }
  }
  function stopTracking() {
    try { if (track.watchId != null) navigator.geolocation.clearWatch(track.watchId); } catch (e) { }
    track.watchId = null;
    track.status = 'off';
  }
  /* sign-out: stop sharing, forget this unit's alarm and Realtime state */
  function signedOut() {
    stopTracking();
    track.fix = null; track.sent = null; track.error = '';
    seenDispatches = null;
    seenNotices = null;
    const c = client();
    if (c && unitChannel) { try { c.removeChannel(unitChannel); } catch (e) { } }
    unitChannel = null; unitChannelFor = null;
  }
  function onFixError(err) {
    if (err && err.code === 1) {          /* permission denied */
      track.status = 'denied';
      stopTracking();
      track.status = 'denied';
    } else {
      track.status = 'searching';
    }
    track.error = (err && err.message) || '';
    app().render();
  }
  async function onFix(pos) {
    const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy || 0), at: Date.now() };
    const wasOn = track.status === 'on';
    track.fix = fix; track.status = 'on';
    const last = track.sent;
    const due = !last || fix.at - last.at >= SEND_EVERY_MS || metres(last.lat, last.lng, fix.lat, fix.lng) >= SEND_MOVED_M;
    if (!due || track.sending) { if (!wasOn) app().render(); return; }
    const open = openDispatches();
    if (!open.length) { syncTracking(); return; }
    track.sending = true;
    let changed = false;
    try {
      for (const d of open) {
        try {
          const res = await rpc('update_dispatch_location', { p_dispatch_id: d.id, p_lat: fix.lat, p_lng: fix.lng, p_accuracy: fix.accuracy });
          if (res && res.status && res.status !== d.dispatch_status) changed = true;
          d.last_lat = fix.lat; d.last_lng = fix.lng; d.last_accuracy = fix.accuracy;
          d.last_loc_at = new Date(fix.at).toISOString();
          if (res && res.distance_m != null) d._distance = res.distance_m;
        } catch (e) { track.error = e.message || ''; }
      }
      track.sent = fix;
    } finally { track.sending = false; }
    if (changed) { await loadDispatches(); await loadEvents(); }
    app().render();
  }

  /* the status card's location line */
  function trackingLine(d) {
    const st = track.status;
    const r = d.report || {};
    const dist = (track.fix && r.lat != null && r.lng != null)
      ? Math.round(metres(track.fix.lat, track.fix.lng, r.lat, r.lng)) : null;
    if (st === 'on') {
      return '<div class="ug-rowf ug-gap8" style="gap:8px;align-items:center;font-size:11.5px">' +
        '<span class="ug-badge ug-badge--resolved">' + I('radar', 12) + ' Location on</span>' +
        '<span class="ug-dim">' + (dist != null ? UG_UTIL.fmtDistance(dist) + ' from the scene · ' : '') +
          '±' + esc(track.fix.accuracy) + ' m</span></div>';
    }
    if (st === 'denied') {
      return '<div class="ug-col" style="gap:6px"><div class="ug-note" style="font-size:11.5px">Location is blocked for this site, so the status cannot move by itself. Allow location in the browser settings, then tap Retry.</div>' +
        '<button class="ug-btn ug-btn--sm ug-btn--signal" style="align-self:flex-start" data-act="dispatch-track-start">' + I('radar', 13) + 'Retry location</button></div>';
    }
    if (st === 'unsupported') {
      return '<div class="ug-note" style="font-size:11.5px">This device cannot share its location. Press Done when the response is finished.</div>';
    }
    return '<div class="ug-dim" style="font-size:11.5px">' + I('radar', 12) + ' Finding your location…</div>';
  }

  async function loadRoute(route) {
    state.route = route;
    if (route === 'dispatch-detail' || route === 'dispatch') await loadDispatches().then(loadEvents);
    if (route === 'equipment') await loadEquipment();
    if (route === 'roster') await loadPersonnel();
    if (route === 'requests') await loadRequests();
    if (route === 'hospital') await Promise.all([loadCapacity(), loadNotices()]);
    if (route === 'analytics') await loadDispatches();
    app().render();
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
    ['dispatch',  T('nav.dispatch'), 'truck'],
    ['equipment', T('nav.equipment'), 'shield'],
    ['roster',    T('nav.roster'),       'users'],
    ['hospital',  T('nav.hospital'),              'shelter', 'Hospital'],
    ['requests',  T('nav.requests'),      'inbox'],
    ['analytics', T('nav.unit-analytics'),        'layers'],
    ['contacts',  T('nav.contacts'),             'phone'],
    ['notifications', T('nav.notifications'),    'bell'],
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
        '<button class="ug-nav" data-act="dispatch-refresh">' + I('wave', 18) + '<span>' + esc(T('action.refresh')) + '</span></button>' +
        '<div class="ug-hr" style="margin:8px 0"></div>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding:4px 8px">' +
          '<span class="ug-av">' + esc((session && session.initials) || '?') + '</span>' +
          '<span class="ug-col" style="gap:0;min-width:0"><span style="font-size:12px;font-weight:600">' + esc(session && session.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(session && session.scope) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + (unit ? unitTypeLabel(unit.unit_type) : '') + (unit && dutyCount ? ' · ' + dutyCount + ' ' + esc(T('dispatch.onDuty')) : '') + '</span></span></div>' +
        '<button class="ug-nav" data-act="logout">' + I('logout', 18) + '<span>' + esc(T('action.signout')) + '</span></button>' +
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
        '<span class="ug-chip ug-top-live is-on">' + I('wave', 13) + esc(T('state.online')) + '</span>' +
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
      dispatch: [T('title.dispatch'), ''],
      'dispatch-detail': [T('title.dispatchDetail'), ''],
      equipment: [T('title.equipment'), T('dispatch.equipmentSub')],
      roster: [T('title.roster'), T('dispatch.rosterSub')],
      hospital: [T('title.hospital'), T('dispatch.hospitalSub')],
      requests: [T('title.requests'), T('dispatch.requestsSub')],
      analytics: [T('title.unitAnalytics'), T('dispatch.analyticsSub')],
      contacts: [T('title.contacts'), T('dispatch.directorySub')],
      notifications: [T('title.notifications'), T('dispatch.notificationsSub')]
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
    if (state.loading) return pageHead(T('dispatch.incoming'), T('dispatch.incomingSub')) + statePanel('loading', T('state.loading'));
    if (state.error)   return pageHead(T('dispatch.incoming'), T('dispatch.incomingSub')) + statePanel('error', T('toast.couldNotLoad'), state.error);
    const list = state.data.dispatches || [];
    const open = list.filter((d) => d.dispatch_status !== 'done' && d.dispatch_status !== 'declined');
    if (!list.length) return pageHead(T('dispatch.incoming'), T('dispatch.incomingSub')) +
      emptyState('truck', T('dispatch.noDispatches'), T('dispatch.noDispatchesHint'));

    /* PNP-specific sections: shelters needing patrol (D2) + relief
       distributions with an escort requested (D3). PNP can confirm the
       escort; patrol is read-only here (the toggle lives with LGU and
       barangay officials). */
    const unit = state.data.unit;
    const isPnp = unit && unit.unit_type === 'PNP';
    let pnpSection = '';
    if (isPnp) {
      const patrolShelters = (state.data.directory.patrolShelters || []);
      const escortList = (state.data.directory.escortList || []);
      if (patrolShelters.length || escortList.length) {
        pnpSection = '<div class="ug-col" style="gap:14px">' +
          (patrolShelters.length
            ? card('<div class="ug-col" style="gap:8px"><div style="font-size:13px;font-weight:700">Shelters needing patrol (D2)</div>' +
                '<div class="ug-card ug-card--flat" style="margin-top:4px"><div class="ug-card-b ug-col" style="gap:6px">' +
                  patrolShelters.map((c) => '<div class="ug-rowf ug-between" style="gap:8px;font-size:12px">' +
                    '<span>' + esc(c.name || '') + ' <span class="ug-dimmer">· ' + esc(c.brgy || c.barangay || '') + '</span></span>' +
                    '<span class="ug-dimmer ug-mono" style="font-size:10.5px">' + (c.needs_patrol_at ? absTime(c.needs_patrol_at) : '') + '</span>' +
                  '</div>').join('') +
                '</div></div></div>')
            : '') +
          (escortList.length
            ? card('<div class="ug-col" style="gap:8px"><div style="font-size:13px;font-weight:700">Relief escorts (D3)</div>' +
                '<div class="ug-card ug-card--flat" style="margin-top:4px"><div class="ug-card-b ug-col" style="gap:6px">' +
                  escortList.map((r) => '<div class="ug-rowf ug-between" style="gap:8px;font-size:12px;align-items:center">' +
                    '<span style="flex:1;min-width:0">' + esc(r.title || '') + ' <span class="ug-dimmer">· ' + esc(r.barangay || '') + '</span></span>' +
                    '<span>' + badge(r.escort_status === 'confirmed' ? 'prepared' : 'warning', r.escort_status) + '</span>' +
                    (r.escort_status === 'requested'
                      ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="relief-escort-confirm" data-id="' + esc(r.id) + '">Confirm escort</button>'
                      : '') +
                  '</div>').join('') +
                '</div></div></div>')
            : '') +
        '</div>';
      }
    }

    const row = (d) => {
      const r = d.report || {};
      return '<button class="ug-card" style="text-align:left;cursor:pointer" data-act="dispatch-open" data-id="' + esc(d.id) + '">' +
        '<div class="ug-card-b ug-col" style="gap:8px">' +
        '<div class="ug-rowf ug-between" style="gap:8px">' +
          '<span style="font-size:13px;font-weight:700">' + esc(r.code || '') + ' · ' + esc(r.hazard_type || T('label.type')) + '</span>' +
          '<span>' + badge(d.dispatch_status, d.dispatch_status) + '</span>' +
        '</div>' +
        '<div class="ug-dim" style="font-size:11.5px">' + esc(r.barangay || '') + (d.eta ? ' · ETA ' + absTime(d.eta) : '') + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">Dispatched ' + ago(d.dispatched_at) + ' by ' + esc(d.dispatched_by_name || '') + '</div>' +
        '</div></button>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Incoming Dispatches', 'Open dispatches addressed to your unit.',
        '<span class="ug-chip is-on">' + open.length + ' active</span>') +
      pnpSection +
      '<div class="ug-wgrid-3">' + list.slice(0, 12).map(row).join('') + '</div>' +
      (list.length > 12 ? '<button class="ug-btn ug-btn--ghost" data-act="dispatch-nav" data-route="analytics">View all</button>' : '') +
      '</div>';
  }

  function sDispatchDetail(st) {
    const id = state.openDispatchId;
    const d = (state.data.dispatches || []).find((x) => x.id === id);
    if (!d) return pageHead(T('title.dispatchDetail'), '') + emptyState('truck', T('dispatch.noDispatches'), T('dispatch.noDispatchesHint'));
    const r = d.report || {};
    const events = (state.data.events || []).filter((e) => e.dispatch_id === d.id);
    const team = d.team;
    const status = d.dispatch_status;

    /* Acknowledged, en route and on scene are set from the unit's GPS
       (migration 057), so they have no buttons. What remains are the
       team-specific steps GPS cannot see, and Done. Each entry is
       [nextAction, buttonLabel]. */
    const STEP = {
      on_scene: (function () {
        if (team === 'BFP') return ['under_control', 'Under control'];
        if (team === 'Ambulance') return ['transporting', 'Transporting'];
        if (team === 'Rescue Unit' || team === 'MDRRMO Rescue') return ['on_hold', 'On hold'];
        return null;
      })(),
      under_control: ['fire_out', 'Fire out'],
      on_hold: ['resume', 'Resume'],
      transporting: ['arrived_hospital', 'Arrived at hospital']
    };
    const nextPair = STEP[status] || null;
    const next = nextPair ? nextPair[0] : null;
    const nextLabel = nextPair ? nextPair[1] : '';
    /* Done wherever dispatch_respond allows finishing (from 'sent' the
       action acknowledges first) */
    const canFinish = ['sent', 'acknowledged', 'en_route', 'on_scene', 'fire_out', 'arrived_hospital'].indexOf(status) >= 0
      || (team === 'BFP' && status === 'under_control');

    const stepLabel = (s) => ({
      sent: T('dispatch.acknowledge'), acknowledged: T('dispatch.acknowledge'), en_route: T('dispatch.enRoute'),
      on_scene: T('dispatch.onScene'), done: T('dispatch.done'), declined: 'Declined',
      under_control: 'Under control', fire_out: 'Fire out',
      on_hold: 'On hold', resume: 'Resumed',
      transporting: 'Transporting', arrived_hospital: 'Arrived at hospital'
    })[s] || s;

    const eventsList = events.length ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Note</th></tr></thead><tbody>' +
      events.map((e) => '<tr><td class="t-num">' + absTime(e.created_at) + '</td><td>' + esc(e.actor_name) + '</td><td>' + esc(stepLabel(e.action) || e.action) + '</td><td class="ug-dimmer" style="font-size:11px">' + esc(e.note) + '</td></tr>').join('') +
      '</tbody></table></div>' : '';

    const afterAction = d.after_action ? card('<div class="ug-col" style="gap:6px"><div style="font-size:12px;font-weight:700">After-action report</div>' +
      '<div class="ug-note" style="font-size:11.5px;white-space:pre-wrap">' + esc(d.after_action) + '</div>' +
      '<div class="ug-dimmer" style="font-size:10px">Filed ' + ago(d.after_action_at) + '</div>' +
      (d.after_action_meta && Object.keys(d.after_action_meta).length
        ? '<div class="ug-dimmer ug-mono" style="font-size:10px;margin-top:4px">' + esc(JSON.stringify(d.after_action_meta)) + '</div>'
        : '') +
      '</div>') : '';

    /* -- per-team field panels (E1 rescue details, E3 rescue tally,
       B2/B3 barangay checklist + evac tally, F3 hospital picker for
       ambulance). All write through update_dispatch_field_data, which
       whitelists keys per team server-side. */
    let fieldPanel = '';
    let hospitalBlock = '';
    const fd = (typeof d.field_data === 'object' && d.field_data) ? d.field_data : {};

    /* F3 / F2: ambulance run — choose an accepting hospital on Transporting.
       Also surfaced for Rescue Unit (E3 destinations). */
    const hospitals = state.data.acceptingHospitals || [];
    const hospitalOpts = '<option value="">Select an accepting hospital</option>' +
      hospitals.map((h) => '<option value="' + esc(h.id) + '"' + (fd.hospital_id === h.id ? ' selected' : '') + '>' + esc(h.name) + (h.available != null ? ' (' + h.available + ' avail.)' : '') + '</option>').join('');

    if (team === 'Rescue Unit' || team === 'MDRRMO Rescue') {
      const rd = fd.rescue_details || {};
      const rt = fd.rescue_tally || { rescued: 0, injured: 0, missing: 0, destinations: [] };
      fieldPanel = card('<div class="ug-col" style="gap:10px"><div style="font-size:13px;font-weight:700">Rescue details & tally</div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Stranded count</label><input class="ug-in" type="number" min="0" data-fd-rd-stranded value="' + esc(rd.stranded_count || 0) + '"></div>' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Location</label><input class="ug-in" type="text" data-fd-rd-location value="' + esc(rd.location || '') + '"></div>' +
        '</div>' +
        '<div class="ug-field"><label class="ug-lab">Special needs</label><input class="ug-in" type="text" data-fd-rd-needs value="' + esc(rd.special_needs || '') + '"></div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Rescued</label><input class="ug-in" type="number" min="0" data-fd-rt-rescued value="' + esc(rt.rescued || 0) + '"></div>' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Injured</label><input class="ug-in" type="number" min="0" data-fd-rt-injured value="' + esc(rt.injured || 0) + '"></div>' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Missing</label><input class="ug-in" type="number" min="0" data-fd-rt-missing value="' + esc(rt.missing || 0) + '"></div>' +
        '</div>' +
        '<div class="ug-field"><label class="ug-lab">Destination hospital</label><select class="ug-sel" data-fd-hospital>' + hospitalOpts + '</select></div>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-field-save" data-id="' + esc(d.id) + '">Save field data</button>' +
        '</div>');
      /* E4: send a patient notice to the chosen hospital. */
      hospitalBlock = card('<div class="ug-col" style="gap:10px"><div style="font-size:13px;font-weight:700">Send patient notice (E4)</div>' +
        '<div class="ug-dim" style="font-size:11px">Sends a notice to the chosen hospital with this dispatch\'s report_id.</div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<div class="ug-field" style="flex:1"><label class="ug-lab">Patients</label><input class="ug-in" type="number" min="1" data-pn-patients value="1"></div>' +
          '<div class="ug-field" style="flex:2"><label class="ug-lab">Condition</label><input class="ug-in" type="text" data-pn-cond placeholder="e.g. Trauma, stable"></div>' +
        '</div>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-send-patient-notice" data-id="' + esc(d.id) + '">' + I('truck', 14) + 'Send notice</button>' +
        '</div>');
    }

    if (team === 'Ambulance') {
      hospitalBlock = card('<div class="ug-col" style="gap:10px"><div style="font-size:13px;font-weight:700">Hospital (F2 / F3)</div>' +
        '<div class="ug-field"><label class="ug-lab">Accepting hospital</label><select class="ug-sel" data-fd-hospital>' + hospitalOpts + '</select></div>' +
        '<div class="ug-dim" style="font-size:11px">Required before Transporting. Save first, then press Transporting.</div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-field-save" data-id="' + esc(d.id) + '">Save hospital</button>' +
          '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-send-patient-notice" data-id="' + esc(d.id) + '">' + I('truck', 14) + 'Send patient notice</button>' +
        '</div></div>');
    }

    /* A1: Can't respond; A2: Need help. Available only from sent/acknowledged
       per the RPC. */
    const canDecline = (status === 'sent' || status === 'acknowledged');
    const declineHelp = canDecline ? '<div class="ug-rowf ug-gap8" style="gap:8px;margin-top:8px">' +
      '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-decline" data-id="' + esc(d.id) + '" data-report-id="' + esc(d.report_id || (d.report && d.report.id) || '') + '">Can\'t respond</button>' +
      '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-help-new" data-id="' + esc(d.id) + '" data-report-id="' + esc(d.report_id || (d.report && d.report.id) || '') + '">Need help</button>' +
      (team === 'BFP'
        ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-help-water" data-id="' + esc(d.id) + '" data-report-id="' + esc(d.report_id || (d.report && d.report.id) || '') + '">Water tanker</button>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-help-personnel" data-id="' + esc(d.id) + '" data-report-id="' + esc(d.report_id || (d.report && d.report.id) || '') + '">Extra personnel</button>'
        : '') +
      '</div>' : '';

    /* D1: PNP-only road closure button (when the dispatch is open and the
       unit is a PNP unit). */
    const isPnp = state.data.unit && state.data.unit.unit_type === 'PNP';
    const roadBlock = (isPnp && status !== 'done' && status !== 'declined')
      ? card('<div class="ug-col" style="gap:10px"><div style="font-size:13px;font-weight:700">Road closure (D1)</div>' +
        '<div class="ug-dim" style="font-size:11px">Post a closure from this dispatch into the existing Road Status list.</div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="dispatch-road-closure" data-id="' + esc(d.id) + '">Post closure</button>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-road-reopen" data-id="' + esc(d.id) + '">Reopen</button>' +
        '</div></div>')
      : '';

    const isOpen = status !== 'done' && status !== 'declined';
    const statusCard = card('<div class="ug-col" style="gap:10px"><div style="font-size:13px;font-weight:700">Status</div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + badge(status, stepLabel(status)) + '</div>' +
      (isOpen ? trackingLine(d) : '') +
      ((next || canFinish) ? '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<input class="ug-in" type="text" data-act="dispatch-note" data-id="' + esc(d.id) + '" placeholder="' + (next === 'on_hold' ? 'Reason (required for On hold)' : 'Note (optional)') + '" style="flex:1;max-width:none">' +
        (next ? '<button class="ug-btn ug-btn--sm" data-act="dispatch-respond" data-id="' + esc(d.id) + '" data-next="' + next + '">' + esc(nextLabel) + '</button>' : '') +
        (canFinish ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-respond" data-id="' + esc(d.id) + '" data-next="done">' + I('check', 14) + esc(T('dispatch.done')) + '</button>' : '') +
      '</div>' : '') +
      (isOpen ? '<div class="ug-dim" style="font-size:11px">The status follows your location: acknowledged when it is first shared, en route once you move, on scene within 100 m of the report. Press Done when the response is finished. The reporter is notified on every change.</div>' : '') +
      declineHelp + '</div>');

    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Dispatch ' + (d.id || '').slice(0, 8), 'Incident ' + (r.code || '') + ' · ' + (r.barangay || ''),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="dispatch-nav" data-route="dispatch">' + I('chevron', 13) + esc(T('dispatch.back')) + '</button>') +
      '<div class="ug-wgrid-2">' +
        card('<div class="ug-col" style="gap:8px"><div style="font-size:13px;font-weight:700">' + esc(r.code || '') + ' · ' + esc(r.hazard_type || '') + '</div>' +
          '<div class="ug-dim" style="font-size:12px">' + esc(r.description || '') + '</div>' +
          '<div class="ug-rowf ug-gap10" style="gap:10px"><span class="ug-badge ug-badge--id">' + esc(r.barangay || '') + '</span>' +
            '<span class="ug-badge ug-badge--' + (r.severity || 'advisory') + '">' + esc(r.severity || '') + '</span>' +
            (d.eta ? '<span class="ug-dim">ETA ' + absTime(d.eta) + '</span>' : '') + '</div>' +
          '<div class="ug-dimmer" style="font-size:10.5px">Dispatched by ' + esc(d.dispatched_by_name || '') + ' · ' + ago(d.dispatched_at) + '</div>' +
          '<div class="ug-note" style="font-size:11.5px;white-space:pre-wrap;margin-top:6px">' + esc(d.instructions || '') + '</div></div>') +
        statusCard +
      '</div>' +
      fieldPanel +
      hospitalBlock +
      roadBlock +
      eventsList +
      afterAction +
      (d.dispatch_status === 'done' && !d.after_action
        ? card('<div class="ug-col" style="gap:8px"><div style="font-size:13px;font-weight:700">File an after-action report</div>' +
            /* A4: per-team form fields, populated into p_meta on submit. */
            afterActionForm(d) +
          '</div>')
        : '') +
    '</div>';
  }

  /* A4 — the per-team after-action form. The free-text summary stays. Each
     team gets its own numeric fields; everything is validated server-side
     in submit_after_action against the team's whitelist. */
  function afterActionForm(d) {
    const team = d.team;
    const fd = (typeof d.field_data === 'object' && d.field_data) ? d.field_data : {};
    const common =
      '<div class="ug-field"><label class="ug-lab">Summary</label>' +
        '<textarea class="ug-ta" rows="4" data-act="dispatch-aa" data-id="' + esc(d.id) + '" placeholder="What was done, time spent, equipment used, casualties or patients, outcome"></textarea></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<div class="ug-field" style="flex:1"><label class="ug-lab">People assisted</label><input class="ug-in" type="number" min="0" data-aa-people value="' + esc((fd.rescue_tally && (fd.rescue_tally.rescued || 0)) || (fd.evac_tally && Array.isArray(fd.evac_tally) ? fd.evac_tally.reduce((s, e) => s + (e.people || 0), 0) : 0) || 0) + '"></div>' +
        '<div class="ug-field" style="flex:1"><label class="ug-lab">Follow-up needed</label><select class="ug-sel" data-aa-follow><option value="false">No</option><option value="true">Yes</option></select></div>' +
      '</div>' +
      '<div class="ug-field"><label class="ug-lab">Follow-up note</label><input class="ug-in" type="text" data-aa-follow-note placeholder="What needs following up?"></div>';

    let teamFields = '';
    if (team === 'BFP') {
      teamFields = '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<div class="ug-field" style="flex:1"><label class="ug-lab">Families displaced</label><input class="ug-in" type="number" min="0" data-aa-families></div>' +
        '<div class="ug-field" style="flex:1"><label class="ug-lab">People injured</label><input class="ug-in" type="number" min="0" data-aa-injured></div>' +
      '</div>';
    }
    /* equipment_used + times are auto-prefilled server-side; the form
       does not ask for them. */

    return common + teamFields +
      '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-aa-submit" data-id="' + esc(d.id) + '" data-team="' + esc(team) + '">' + I('check', 14) + 'Submit after-action</button>';
  }

  function sEquipment(st) {
    if (state.loading) return pageHead(T('title.equipment'), '') + statePanel('loading');
    if (state.error)   return pageHead(T('title.equipment'), '') + statePanel('error', T('toast.couldNotLoad'), state.error);
    const rows = state.data.equipment || [];
    /* 050: unit_admin can add/edit/remove. Regular members only see the
       Check + Status buttons (record_equipment_check + set_equipment_status
       already allow members of the unit). */
    const canManage = !!(st.session && st.session.role === 'dispatch_team' && st.session.unit_role === 'unit_admin');
    if (!rows.length) return pageHead('Equipment & readiness', 'Track each piece and run the shift checklist.',
        canManage ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="equipment-add" data-owner-unit="' + esc((state.data.unit && state.data.unit.id) || '') + '">' + I('plus', 14) + 'Add equipment</button>' : '') +
      emptyState('shield', T('dispatch.noEquipment'),
        canManage ? 'Use "Add equipment" to register a piece of equipment for your unit.' : T('dispatch.noEquipmentHint'));
    const overdue = rows.filter((r) => !r.last_checked_at || (Date.now() - Date.parse(r.last_checked_at)) > 86400000).length;
    const row = (r) => {
      const overdueClass = !r.last_checked_at || (Date.now() - Date.parse(r.last_checked_at)) > 86400000 ? ' style="border-left:3px solid var(--ug-warning)"' : '';
      const manageBtns = canManage
        ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="equipment-edit" data-id="' + esc(r.id) + '">Edit</button>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="equipment-remove" data-id="' + esc(r.id) + '">' + (r.status === 'unavailable' ? 'Remove' : 'Retire / remove') + '</button>'
        : '';
      return '<tr' + overdueClass + '>' +
        '<td><div style="font-weight:600">' + esc(r.identifier || equipmentLabel(r)) + '</div>' +
          '<div class="ug-dimmer" style="font-size:10.5px">' + esc([r.identifier ? equipmentLabel(r) : '', r.notes || ''].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td>' + badge(r.status, statusLabel(r.status)) + '</td>' +
        '<td>' + badge(r.condition, conditionLabel(r.condition)) + '</td>' +
        '<td class="t-num">' + (r.last_checked_at ? ago(r.last_checked_at) : 'never') + '</td>' +
        '<td class="t-right"><div class="ug-rowf ug-gap6" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-check" data-id="' + esc(r.id) + '">Check</button>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-status" data-id="' + esc(r.id) + '">Status</button>' +
          manageBtns +
        '</div></td>' +
      '</tr>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Equipment & readiness', 'Track each piece and run the shift checklist.',
        (canManage ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="equipment-add" data-owner-unit="' + esc((state.data.unit && state.data.unit.id) || '') + '">' + I('plus', 14) + 'Add equipment</button>' : '') +
        '<span class="ug-chip is-on">' + rows.length + ' items</span>' +
        (overdue ? '<span class="ug-chip" style="background:rgba(255,179,64,.14);color:var(--ug-warning)">' + overdue + ' OVERDUE</span>' : '')) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Equipment</th><th>Status</th><th>Condition</th><th>Last check</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + rows.map(row).join('') + '</tbody></table></div>' +
      (state.data.unit && state.data.unit.unit_type === 'Hospital' ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-nav" data-route="hospital">' + I('shelter', 14) + 'Hospital capacity</button>' : '') +
    '</div>';
  }

  function sRoster(st) {
    if (state.loading) return pageHead(T('title.roster'), '') + statePanel('loading');
    if (state.error)   return pageHead(T('title.roster'), '') + statePanel('error', T('toast.couldNotLoad'), state.error);
    const rows = state.data.personnel || [];
    const unit = state.data.unit;
    const canInvite = unit && (st.session && st.session.unit_role === 'unit_admin');
    const inviteBtn = canInvite ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="admin-invite-unit-member" data-unit-id="' + esc(unit && unit.id) + '">' + I('plus', 14) + 'Invite member</button>' : '';
    if (!rows.length) return pageHead(T('title.roster'), T('dispatch.rosterSub'), inviteBtn) +
      emptyState('users', 'No personnel yet', canInvite ? 'Use Invite member to send an email to a new unit member.' : 'Ask your unit admin to add personnel.');
    const onDuty = rows.filter((p) => p.on_duty).length;
    const row = (p) => '<tr>' +
      '<td><div style="font-weight:600">' + esc(p.name) + '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px">' + esc(p.role || '') + '</div></td>' +
      '<td>' + esc(p.phone || '') + '</td>' +
      '<td>' + badge(p.on_duty ? 'on' : 'off', p.on_duty ? 'On duty' : 'Off duty') + '</td>' +
      '<td class="t-num">' + (p.shift_start ? absTime(p.shift_start) : '—') + '</td>' +
      '<td class="t-right"><button class="ug-btn ug-btn--sm' + (p.on_duty ? '' : ' ug-btn--signal') + '" data-act="dispatch-duty" data-id="' + esc(p.id) + '" data-next="' + (p.on_duty ? 'false' : 'true') + '">' + (p.on_duty ? esc(T('action.clockOut')) : esc(T('action.clockIn'))) + '</button></td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.roster'), T('dispatch.rosterSub'),
        '<span class="ug-chip is-on">' + onDuty + ' on duty</span>' + inviteBtn) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Name / role</th><th>Phone</th><th>Status</th><th>Shift start</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + rows.map(row).join('') + '</tbody></table></div></div>';
  }

  function sHospital(st) {
    if (state.loading) return pageHead(T('nav.hospital'), '') + statePanel('loading');
    if (state.error)   return pageHead(T('nav.hospital'), '') + statePanel('error', T('toast.couldNotLoad'), state.error);
    const cap = state.data.capacity || { er_beds: 0, icu_beds: 0, available: 0, accepting: true };
    const notices = state.data.notices || [];
    /* F1: show Acknowledge, Arrived and Cancel buttons. The RPC allows
       'arrived' or 'cancelled' only from 'sent' or 'acknowledged'. */
    const noticeRow = (n) => {
      const canAck = (n.status === 'sent' || n.status === 'acknowledged');
      const actBtns = canAck
        ? '<div class="ug-rowf ug-gap6" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
            (n.status === 'sent' ? '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="dispatch-ack-notice" data-id="' + esc(n.id) + '" data-next="acknowledged">Acknowledge</button>' : '') +
            '<button class="ug-btn ug-btn--sm" data-act="dispatch-ack-notice" data-id="' + esc(n.id) + '" data-next="arrived">Arrived</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-ack-notice" data-id="' + esc(n.id) + '" data-next="cancelled">Cancel</button>' +
          '</div>'
        : '';
      return '<tr>' +
        '<td class="t-num">' + absTime(n.created_at) + '</td>' +
        '<td class="t-num">' + esc(n.patients || 1) + '</td>' +
        '<td>' + esc(n.condition || '') + '</td>' +
        '<td>' + badge(n.status, n.status) + '</td>' +
        '<td class="t-right">' + actBtns + '</td>' +
      '</tr>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.hospital'), T('dispatch.hospitalSub'),
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-capacity-edit">' + I('settings', 14) + 'Update</button>') +
      '<div class="ug-rowf ug-gap10" style="gap:10px">' +
        readout(cap.er_beds, 'ER beds', 'var(--ug-signal)') +
        readout(cap.icu_beds, 'ICU beds', 'var(--ug-signal)') +
        readout(cap.available, 'Available', 'var(--ug-prepared)') +
        readout(cap.accepting ? T('label.accepting') : T('label.divert'), 'Status', cap.accepting ? 'var(--ug-prepared)' : 'var(--ug-emergency)') +
      '</div>' +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Patients</th><th>Condition</th><th>Status</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + (notices.length ? notices.map(noticeRow).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px">No incoming-patient notices</td></tr>') + '</tbody></table></div>' +
    '</div>';
  }

  function sRequests(st) {
    if (state.loading) return pageHead(T('title.requests'), '') + statePanel('loading');
    if (state.error)   return pageHead(T('title.requests'), '') + statePanel('error', T('toast.couldNotLoad'), state.error);
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
      pageHead(T('title.requests'), T('dispatch.requestsSub'),
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-request-new">' + I('plus', 14) + 'New request</button>') +
      (open.length ? '<span class="ug-chip is-on">' + open.length + ' open</span>' : '') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Kind</th><th>Details</th><th>Status</th><th>Decided</th></tr></thead>' +
      '<tbody>' + (rows.length ? rows.map(row).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px">No requests yet</td></tr>') + '</tbody></table></div>' +
    '</div>';
  }

  function sAnalytics(st) {
    const dispatches = state.data.dispatches || [];
    if (!dispatches.length) return pageHead(T('title.unitAnalytics'), '') + emptyState('layers', T('dispatch.noAnalyticsYet'), T('dispatch.noAnalyticsHint'));
    const acks = dispatches.filter((d) => d.ack_at).length;
    const avgAck = acks ? (dispatches.reduce((s, d) => s + (Date.parse(d.ack_at) - Date.parse(d.dispatched_at)) / 60000, 0) / acks).toFixed(1) : '—';
    const scenes = dispatches.filter((d) => d.on_scene_at && d.ack_at).length;
    const avgScene = scenes ? (dispatches.reduce((s, d) => s + (Date.parse(d.on_scene_at) - Date.parse(d.ack_at)) / 60000, 0) / scenes).toFixed(1) : '—';
    const done = dispatches.filter((d) => d.dispatch_status === 'done').length;
    const month = dispatches.filter((d) => {
      const m = new Date(); return new Date(d.dispatched_at).getMonth() === m.getMonth() && new Date(d.dispatched_at).getFullYear() === m.getFullYear();
    }).length;
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.unitAnalytics'), T('dispatch.analyticsSub'),
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
    const callLink = (num) => '<a class="ug-btn ug-btn--sm ug-btn--signal" href="tel:' + esc(String(num).replace(/[^+\d]/g, '')) + '">' + I('phone', 13) + esc(T('action.call')) + '</a>';
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
      pageHead(T('title.contacts'), T('dispatch.directorySub')) +
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
    /* the unit's alarm on/off + test (the dispatch portal has no Settings) */
    const alarm = (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.alarmCard) ? UG_SETTINGS.alarmCard(st) : '';
    if (!rows.length) return pageHead(T('title.notifications'), '') + alarm + emptyState('bell', T('dispatch.noNotifications'), T('dispatch.noNotificationsHint'));
    const row = (n) => '<tr>' +
      '<td class="t-num">' + absTime(n.created_at) + '</td>' +
      /* tappable: opens the dispatch for this report and marks it read */
      '<td><button class="ug-link-btn" style="background:none;border:0;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer;font-weight:600"' +
        ' data-act="dispatch-notif-open" data-id="' + esc(n.id) + '" data-report="' + esc(n.report_id || '') + '">' + esc(n.title) +
        (n.report_id ? ' <span style="color:var(--ug-signal)">›</span>' : '') + '</button></td>' +
      '<td class="ug-dim" style="font-size:11.5px">' + esc(n.body) + '</td>' +
      '<td>' + (n.read_at ? badge('open', T('label.read')) : badge('warning', T('label.unread'))) + '</td>' +
      '<td class="t-right">' + (n.read_at ? '' : '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="dispatch-notif-read" data-id="' + esc(n.id) + '">Mark read</button>') + '</td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.notifications'), T('dispatch.notificationsSub'),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="dispatch-notif-read-all">Mark all read</button>') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Title</th><th>Body</th><th>Status</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + rows.map(row).join('') + '</tbody></table></div>' + alarm + '</div>';
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
    'dispatch-nav': async (d) => {
      /* PRIORITY 0 fix: the old version called UG_APP.go('dispatch') which
         wrote #dispatch to the hash and reset S.route to 'dispatch',
         clobbering the sub-route we just set (e.g. 'equipment' became
         'dispatch'). Now we update the hash to match the actual sub-route
         (so back/forward and reload land on the same screen), render
         immediately so the user sees the loading state, await loadRoute,
         then render again. */
      state.route = d.route;
      try { window.history.replaceState(null, '', '#' + d.route); } catch (e) {}
      app().render();
      try {
        await loadRoute(d.route);
      } catch (e) {
        app().toast(e.message || ('Could not load ' + d.route), 'warning');
      }
      app().render();
    },
    'dispatch-refresh': () => loadAll(),
    'dispatch-open': (d) => { state.openDispatchId = d.id; state.route = 'dispatch-detail'; app().render(); },
    'dispatch-respond': async (d) => {
      try {
        const note = (document.querySelector('[data-act="dispatch-note"][data-id="' + d.id + '"]') || {}).value || '';
        const cur = (state.data.dispatches || []).find((x) => x.id === d.id);
        /* Done straight from 'sent' (location never shared): acknowledge first */
        if (d.next === 'done' && cur && cur.dispatch_status === 'sent') {
          await rpc('dispatch_respond', { p_dispatch_id: d.id, p_action: 'acknowledged', p_note: '' });
        }
        await rpc('dispatch_respond', { p_dispatch_id: d.id, p_action: d.next, p_note: note });
        /* resume is an event: the dispatch goes back to on_scene (migration 051) */
        app().toast(d.next === 'resume' ? 'Rescue resumed · back on scene' : 'Status updated to ' + d.next, 'prepared');
        await loadDispatches(); await loadEvents();
        app().render();
      } catch (e) { app().toast(e.message || 'Could not update', 'warning'); }
    },
    'dispatch-track-start': () => { track.status = 'off'; startTracking(); app().render(); },
    'dispatch-check': (d) => { state.openEquipmentId = d.id; openCheckModal(d.id); },
    'dispatch-status': (d) => openStatusModal(d.id),
    'dispatch-duty': async (d) => {
      try {
        await rpc('set_personnel_duty', { p_personnel_id: d.id, p_on_duty: d.next === 'true' });
        await loadPersonnel();
        app().render();
      } catch (e) { app().toast(e.message, 'warning'); }
    },
    'dispatch-ack-notice': async (d) => {
      try {
        const next = d.next || 'acknowledged';
        await rpc('ack_patient_notice', { p_notice_id: d.id, p_status: next });
        app().toast('Patient notice ' + next, 'prepared');
        await loadNotices();
        app().render();
      } catch (e) { app().toast(e.message, 'warning'); }
    },
    'dispatch-aa-submit': async (d) => {
      const ta = document.querySelector('[data-act="dispatch-aa"][data-id="' + d.id + '"]');
      const text = ta ? ta.value : '';
      if (!text || !text.trim()) { app().toast('Write a short summary', 'warning'); return; }
      /* A4: build the per-team meta object from the form fields. */
      const num = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return 0;
        const v = parseInt(el.value, 10);
        return isNaN(v) ? 0 : v;
      };
      const val = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.value : '';
      };
      const meta = {
        people_assisted: num('[data-aa-people]'),
        follow_up_needed: val('[data-aa-follow]') === 'true',
        follow_up_note: val('[data-aa-follow-note]')
      };
      if (d.team === 'BFP') {
        meta.families_displaced = num('[data-aa-families]');
        meta.people_injured = num('[data-aa-injured]');
      }
      try {
        await rpc('submit_after_action', { p_dispatch_id: d.id, p_text: text, p_meta: meta });
        app().toast('After-action submitted', 'prepared');
        await loadDispatches();
        app().render();
      } catch (e) { app().toast(e.message, 'warning'); }
    },
    /* Update field_data on the dispatch (B2 checklist, B3 evac tally,
       E1 rescue details, E3 rescue tally, F3 hospital_id). */
    'dispatch-field-save': async (d) => {
      const num = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return 0;
        const v = parseInt(el.value, 10);
        return isNaN(v) ? 0 : v;
      };
      const val = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.value : '';
      };
      const patch = {};
      const dispatch = (state.data.dispatches || []).find((x) => x.id === d.id);
      if (!dispatch) return;
      const team = dispatch.team;

      /* Rescue unit: rescue_details + rescue_tally */
      if (team === 'Rescue Unit' || team === 'MDRRMO Rescue') {
        patch.rescue_details = {
          stranded_count: num('[data-fd-rd-stranded]'),
          location: val('[data-fd-rd-location]'),
          special_needs: val('[data-fd-rd-needs]')
        };
        patch.rescue_tally = {
          rescued: num('[data-fd-rt-rescued]'),
          injured: num('[data-fd-rt-injured]'),
          missing: num('[data-fd-rt-missing]'),
          destinations: []
        };
        const hospId = val('[data-fd-hospital]');
        if (hospId) {
          patch.rescue_tally.destinations.push({ kind: 'hospital', ref_id: hospId, count: patch.rescue_tally.rescued });
        }
      }
      /* Ambulance: hospital_id only */
      if (team === 'Ambulance') {
        const hospId = val('[data-fd-hospital]');
        if (hospId) patch.hospital_id = hospId;
      }

      if (!Object.keys(patch).length) {
        app().toast('Nothing to save', 'warning');
        return;
      }
      try {
        await rpc('update_dispatch_field_data', { p_dispatch_id: d.id, p_patch: patch });
        app().toast('Field data saved', 'prepared');
        await loadDispatches();
        app().render();
      } catch (e) { app().toast(e.message, 'warning'); }
    },
    /* E4: send a patient notice from the dispatch card. */
    'dispatch-send-patient-notice': async (d) => {
      const dispatch = (state.data.dispatches || []).find((x) => x.id === d.id);
      if (!dispatch) return;
      const fd = (typeof dispatch.field_data === 'object' && dispatch.field_data) ? dispatch.field_data : {};
      const hospitalId = fd.hospital_id;
      if (!hospitalId) {
        app().toast('Pick an accepting hospital first', 'warning');
        return;
      }
      const patEl = document.querySelector('[data-pn-patients]');
      const condEl = document.querySelector('[data-pn-cond]');
      const patients = patEl ? Math.max(1, parseInt(patEl.value, 10) || 1) : 1;
      const condition = condEl ? condEl.value : '';
      try {
        await rpc('send_patient_notice', {
          p_unit_id: hospitalId,
          p_report_id: dispatch.report_id || (dispatch.report && dispatch.report.id) || null,
          p_patients: patients,
          p_condition: condition,
          p_eta: null
        });
        app().toast('Patient notice sent', 'prepared');
      } catch (e) { app().toast(e.message, 'warning'); }
    },
    /* A1: decline — self-contained (UG_APP is never assigned; we cannot
       forward). The same RPC is also reachable from the Response Team
       screen via app.js's APP_ACTIONS, but that path runs for the
       barangay_official/LGU; this one runs for the dispatch_team user. */
    'dispatch-decline': async (d) => {
      /* Friendly-fail if the prompt host is missing — same pattern as
         openModal. The old code silently returned when UG_FEATURES.prompt
         was undefined, so the user clicked "Can't respond" and nothing
         happened. */
      /* typeof on an undeclared identifier returns 'undefined' without
         throwing — safe even if js/features.js failed to load. */
      if (typeof UG_FEATURES === 'undefined' || typeof UG_FEATURES.prompt !== 'function') {
        app().toast('Could not open the decline form (UI module not loaded). Reload the page; if this persists, contact the LGU.', 'warning');
        try { console.error('[UniGuard dispatch] UG_FEATURES.prompt is missing — cannot open the decline form'); } catch (e) {}
        return;
      }
      const res = await UG_FEATURES.prompt({
        title: 'Decline this dispatch',
        label: 'Reason (required)', placeholder: 'e.g. No available responders, equipment failure',
        required: true, requiredMessage: 'A reason is required to decline.'
      });
      if (!res) return;
      const reason = String(res || '').trim();
      if (!reason) { app().toast('A reason is required', 'warning'); return; }
      try {
        await rpc('decline_dispatch', { p_dispatch_id: d.id, p_reason: reason });
        app().toast('Dispatch declined — the dispatcher has been notified', 'prepared');
        await loadDispatches(); await loadEvents();
        app().render();
      } catch (e) { app().toast(e.message || 'Could not decline', 'warning'); }
    },
    /* A2: help request composer. */
    'dispatch-help-new': (d) => {
      /* readable Kind labels, DB values preserved (PART 1 step 8 pattern) */
      const HELP_KIND_LABELS = {
        general: 'General',
        water_tanker: 'Water tanker',
        extra_personnel: 'Extra personnel',
        beyond_capacity: 'Beyond capacity'
      };
      const kindOpts = Object.keys(HELP_KIND_LABELS).map((k) =>
        '<option value="' + k + '">' + esc(HELP_KIND_LABELS[k]) + '</option>').join('');
      openModal({
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
            if (!msg) { app().toast('Write a short message', 'warning'); return; }
            try {
              await rpc('create_help_request', {
                p_dispatch_id: d.id, p_kind: kind, p_message: msg
              });
              app().toast('Help request sent to the LGU', 'prepared');
              close();
              await loadHelpRequests();
              app().render();
            } catch (e) { app().toast(e.message || 'Could not send', 'warning'); }
          });
        }
      });
    },
    /* C2 / A2: water tanker + extra personnel shortcuts (BFP-only). */
    'dispatch-help-water': async (d) => {
      try {
        await rpc('create_help_request', {
          p_dispatch_id: d.id, p_kind: 'water_tanker',
          p_message: 'Requesting a water tanker on this dispatch.'
        });
        app().toast('Water tanker request sent to the LGU', 'prepared');
        await loadHelpRequests();
        app().render();
      } catch (e) { app().toast(e.message, 'warning'); }
    },
    'dispatch-help-personnel': async (d) => {
      try {
        await rpc('create_help_request', {
          p_dispatch_id: d.id, p_kind: 'extra_personnel',
          p_message: 'Requesting extra personnel on this dispatch.'
        });
        app().toast('Personnel request sent to the LGU', 'prepared');
        await loadHelpRequests();
        app().render();
      } catch (e) { app().toast(e.message, 'warning'); }
    },
    /* D1: PNP-only road closure — self-contained modal. */
    'dispatch-road-closure': (d) => {
      openModal({
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
            if (!road) { app().toast('A road name is required', 'warning'); return; }
            const segFrom = wrap.querySelector('[data-rc-from]').value.trim();
            const segTo = wrap.querySelector('[data-rc-to]').value.trim();
            const etaVal = wrap.querySelector('[data-rc-eta]').value;
            const eta = etaVal ? new Date(etaVal).toISOString() : null;
            try {
              await rpc('post_road_closure', {
                p_dispatch_id: d.id, p_road_name: road, p_note: note,
                p_lat: null, p_lng: null,
                p_segment_from: segFrom, p_segment_to: segTo,
                p_estimated_reopen: eta
              });
              app().toast('Road closure posted', 'prepared');
              close();
              app().render();
            } catch (e) { app().toast(e.message || 'Could not post', 'warning'); }
          });
        }
      });
    },
    'dispatch-road-reopen': async (d) => {
      try {
        await rpc('reopen_road_closure', { p_dispatch_id: d.id });
        app().toast('Road reopened', 'prepared');
        app().render();
      } catch (e) { app().toast(e.message || 'Could not reopen', 'warning'); }
    },

    /* 050 (Oct 25 2026) — equipment management actions (unit_admin only).
       The barangay_official + LGU paths live in js/screens.admin.js and
       js/app.js; the same openAddEquipmentModal / openEditEquipmentModal /
       openRemoveEquipmentModal functions are reused there. */
    /* Fix (Oct 28 2026): js/app.js merges these actions AFTER its own, so
       this handler also serves the barangay Response Team button, which
       sets data-owner-brgy (dataset.ownerBrgy). It read d.ownerBarangay
       only, so the barangay official always got "not linked to a dispatch
       unit". Barangay owner wins; otherwise the button's unit or this
       console's unit. */
    'equipment-add': (d) => {
      const brgy = d.ownerBrgy || d.ownerBarangay || null;
      if (brgy) {
        openAddEquipmentModal({ ownerUnitId: null, ownerBarangayId: brgy, unitType: 'Barangay' });
      } else if (d.unitType === 'Barangay') {
        /* The LGU has no barangay of its own: let it pick one. The
           add_equipment RPC lets the LGU add to any barangay and still
           limits an official to their own. */
        openAddEquipmentModal({ ownerUnitId: null, ownerBarangayId: null, unitType: 'Barangay', pickBarangay: true });
      } else {
        openAddEquipmentModal({ ownerUnitId: d.ownerUnit || (state.data.unit && state.data.unit.id) || null,
          ownerBarangayId: null, unitType: d.unitType || null });
      }
    },
    'equipment-edit': (d) => openEditEquipmentModal(d.id, {}),
    'equipment-remove': (d) => openRemoveEquipmentModal(d.id, {}),

    'dispatch-csv': () => UG_EXPORTS.run('dispatch-csv'),
    'dispatch-request-new': () => openRequestModal(),
    'dispatch-capacity-edit': () => openCapacityModal(),
    'dispatch-notif-open': async (d) => {
      const c = client();
      const n = (state.data.notifications || []).find((x) => x.id === d.id);
      if (c && n && !n.read_at) {
        n.read_at = new Date().toISOString();
        c.from('notifications').update({ read_at: n.read_at }).eq('id', d.id).then(() => { }, () => { });
      }
      const disp = d.report ? (state.data.dispatches || []).find((x) => x.report_id === d.report) : null;
      if (disp) { state.openDispatchId = disp.id; state.route = 'dispatch-detail'; }
      else if (d.report) app().toast('That dispatch is no longer assigned to your unit', 'info');
      app().render();
    },
    'dispatch-notif-read': async (d) => {
      const c = client(); if (!c) return;
      try { await c.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', d.id); await loadNotifications(); app().render(); }
      catch (e) { app().toast(e.message, 'warning'); }
    },
    'dispatch-notif-read-all': async () => {
      const c = client(); if (!c) return;
      const ids = (state.data.notifications || []).filter((n) => !n.read_at).map((n) => n.id);
      if (!ids.length) return;
      try { await c.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids); await loadNotifications(); app().render(); }
      catch (e) { app().toast(e.message, 'warning'); }
    }
  };

  /* ------------------------------------------------------------- modals (CSV export: js/exports.js) */

  /* 054 (Oct 28 2026): condition <option>s with readable labels. The values
     stay the DB values the RPCs validate (ready, needs_repair, missing,
     out_of_service, unknown); only the visible text changes. */
  const CONDITION_LABELS = [
    ['ready', 'Ready'],
    ['needs_repair', 'Needs repair'],
    ['missing', 'Missing'],
    ['out_of_service', 'Out of service'],
    ['unknown', 'Unknown']
  ];
  function conditionOptions(selected) {
    return CONDITION_LABELS.map((p) =>
      '<option value="' + p[0] + '"' + (p[0] === selected ? ' selected' : '') + '>' + p[1] + '</option>'
    ).join('');
  }
  const STATUS_LABELS = [
    ['available', 'Available'],
    ['deployed', 'Deployed'],
    ['maintenance', 'Maintenance'],
    ['unavailable', 'Unavailable']
  ];
  function labelFrom(pairs, value) {
    const hit = pairs.find((p) => p[0] === value);
    return hit ? hit[1] : (value || '');
  }
  function conditionLabel(v) { return labelFrom(CONDITION_LABELS, v); }
  function statusLabel(v) { return labelFrom(STATUS_LABELS, v); }

  /* Fix (Oct 28 2026): the Check / Status / Edit / Remove modals looked only
     in this console's own list (state.data.equipment), which is empty for
     the barangay official and the LGU. Fall back to the shared directory. */
  function findEquipment(id) {
    const local = (state.data.equipment || []).find((e) => e.id === id);
    if (local) return local;
    const all = (typeof UG !== 'undefined' && UG.DATA && UG.DATA.dispatchEquipment) || [];
    return all.find((e) => e.id === id) || null;
  }

  /* After any equipment write: refresh this console's list, then either the
     caller's onSaved or the shared directory (barangay / LGU screens read
     UG.DATA.dispatchEquipment), then tell open lists (the LGU per-unit
     modal in js/app.js) to redraw. */
  async function afterEquipmentChange(opts) {
    try { await loadEquipment(); } catch (e) {}
    if (opts && typeof opts.onSaved === 'function') {
      try { await opts.onSaved(); } catch (e) {}
    } else if (typeof Repo !== 'undefined' && Repo.loadDispatchDirectory) {
      try { await Repo.loadDispatchDirectory(); } catch (e) {}
    }
    try { window.dispatchEvent(new CustomEvent('ug:equipment-changed')); } catch (e) {}
    app().render();
  }

  function openCheckModal(id, opts) {
    const eq = findEquipment(id);
    if (!eq) {
      app().toast('That equipment is no longer in the list. Refresh and try again.', 'warning');
      return;
    }
    /* First option (Ready) stays the default, as before. */
    const condOpts = conditionOptions(null);
    /* Fix (Oct 28 2026): the catalog's readiness checklist was never shown,
       and every check was saved with p_items: []. Show it as tick boxes and
       save [{ item, ok }] in equipment_checks.items. Custom equipment has no
       checklist, so the section is left out. */
    const cat = eq.catalog_id ? catalogList().find((c) => c.id === eq.catalog_id) : null;
    const items = (cat && Array.isArray(cat.checklist)) ? cat.checklist.filter((x) => typeof x === 'string' && x.trim()) : [];
    const checklistHtml = items.length
      ? '<div class="ug-field"><label class="ug-lab">Checklist · ' + esc(cat.label) + '</label>' +
          '<div class="ug-col" style="gap:6px" data-ck-items>' +
          items.map((it, i) => '<label class="ug-rowf" style="gap:8px;align-items:center;font-size:13px">' +
            '<input type="checkbox" data-ck-item="' + i + '"> <span>' + esc(it) + '</span></label>').join('') +
          '</div><div class="ug-help" data-ck-tally>0 of ' + items.length + ' OK</div></div>'
      : '';
    openModal({
      title: 'Readiness check · ' + (eq.identifier || equipmentLabel(eq)),
      body: checklistHtml +
            '<div class="ug-field"><label class="ug-lab">Condition</label><select class="ug-sel" data-ck-cond>' + condOpts + '</select></div>' +
            '<div class="ug-field"><label class="ug-lab">Level (fuel / pressure / etc.)</label><input class="ug-in" type="text" data-ck-level placeholder="e.g. 80% or 200 bar"></div>' +
            '<div class="ug-field"><label class="ug-lab">Notes</label><textarea class="ug-ta" rows="2" data-ck-notes></textarea></div>',
      footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-ck-save>Save check</button>',
      onMount: (wrap, close) => {
        const boxes = Array.prototype.slice.call(wrap.querySelectorAll('[data-ck-item]'));
        const tally = wrap.querySelector('[data-ck-tally]');
        boxes.forEach((b) => b.addEventListener('change', () => {
          if (tally) tally.textContent = boxes.filter((x) => x.checked).length + ' of ' + boxes.length + ' OK';
        }));
        wrap.querySelector('[data-ck-save]').addEventListener('click', async () => {
          const btn = wrap.querySelector('[data-ck-save]');
          if (btn.disabled) return;
          btn.disabled = true; btn.textContent = 'Saving…';
          try {
            await rpc('record_equipment_check', {
              p_equipment_id: id, p_condition: wrap.querySelector('[data-ck-cond]').value,
              p_level: wrap.querySelector('[data-ck-level]').value, p_notes: wrap.querySelector('[data-ck-notes]').value,
              p_photo: null,
              p_items: boxes.map((b) => ({ item: items[Number(b.getAttribute('data-ck-item'))], ok: b.checked }))
            });
            app().toast('Check recorded', 'prepared');
            await afterEquipmentChange(opts);
            close();
          } catch (e) {
            app().toast(e.message || 'Could not record the check', 'warning');
            btn.disabled = false; btn.textContent = 'Save check';
          }
        });
      }
    });
  }

  function openStatusModal(id, opts) {
    const eq = findEquipment(id);
    if (!eq) {
      app().toast('That equipment is no longer in the list. Refresh and try again.', 'warning');
      return;
    }
    const statusOpts = STATUS_LABELS.map((p) => '<option value="' + p[0] + '"' + (p[0] === eq.status ? ' selected' : '') + '>' + p[1] + '</option>').join('');
    openModal({
      title: 'Set status · ' + (eq.identifier || equipmentLabel(eq)),
      body: '<div class="ug-field"><label class="ug-lab">Status</label><select class="ug-sel" data-st-status>' + statusOpts + '</select></div>' +
            '<div class="ug-field"><label class="ug-lab">Notes</label><textarea class="ug-ta" rows="2" data-st-notes>' + esc(eq.notes || '') + '</textarea></div>',
      footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-st-save>Save</button>',
      onMount: (wrap, close) => {
        wrap.querySelector('[data-st-save]').addEventListener('click', async () => {
          const btn = wrap.querySelector('[data-st-save]');
          if (btn.disabled) return;
          btn.disabled = true; btn.textContent = 'Saving…';
          try {
            await rpc('set_equipment_status', {
              p_equipment_id: id, p_status: wrap.querySelector('[data-st-status]').value,
              p_condition: null, p_notes: wrap.querySelector('[data-st-notes]').value
            });
            app().toast('Status updated', 'prepared');
            await afterEquipmentChange(opts);
            close();
          } catch (e) {
            app().toast(e.message || 'Could not update status', 'warning');
            btn.disabled = false; btn.textContent = 'Save';
          }
        });
      }
    });
  }

  /* ------------------------------------------------------- request modal
   * PART 1 fix (Oct 24 2026): the New request button was fragile:
   *   - if window.UG_FEATURES.modal was missing, the click silently did
   *     nothing (no toast, no log). Now we toast loudly.
   *   - if state.data.unit was null (account not linked to a unit, or
   *     loadUnit() had not finished), `state.data.unit.id` threw a
   *     TypeError that surfaced as a technical toast. Now we detect it
   *     and show a friendly message.
   *   - the Details textarea had no empty-check; an empty string was
   *     sent to the RPC. Now we trim + reject empty.
   *   - the Send button had no in-flight guard; double-clicks could
   *     submit twice. Now we disable it while the RPC is in flight.
   *   - the Kind dropdown showed raw DB values ("mutual_aid"). Now the
   *     labels are readable ("Mutual aid") while the value stays the DB
   *     value the RPC expects.
   *   - the 1000-char limit the RPC enforces with left(..., 1000) is
   *     surfaced to the user with a maxlength + counter.
   */
  /* ----------------------------------------------------- modal host helper
   * Wraps UG_FEATURES.modal so every caller fails safely when the modal
   * host is missing. Without this wrapper, every modal in this module
   * silently no-op'd when UG_FEATURES.modal was undefined (the user
   * clicked Check / Status / Update capacity / New request and nothing
   * happened — no toast, no log). Now the user sees a clear message. */
  function openModal(opts) {
    /* typeof on an undeclared identifier returns 'undefined' without
       throwing — safe even if js/features.js failed to load. In a real
       browser, `const UG_FEATURES` declared at the top of a classic
       <script> does NOT attach to window, so `window.UG_FEATURES` is
       always undefined. The check must use the lexical `UG_FEATURES`. */
    if (typeof UG_FEATURES === 'undefined' || typeof UG_FEATURES.modal !== 'function') {
      const msg = 'Could not open the ' + (opts && opts.title ? opts.title : 'dialog') + ' (UI module not loaded). Reload the page; if this persists, contact the LGU.';
      app().toast(msg, 'warning');
      try { console.error('[UniGuard dispatch] UG_FEATURES.modal is missing — cannot open', opts && opts.title); } catch (e) {}
      return null;
    }
    return UG_FEATURES.modal(opts);
  }

  function openRequestModal() {
    /* Detect "no unit linked" before opening the form, so we can show a
       friendly message instead of a TypeError on submit. */
    if (!state.data.unit || !state.data.unit.id) {
      app().toast('Your account is not linked to a dispatch unit. Ask the LGU or Super Admin to assign one before sending a support request.', 'warning');
      return;
    }
    /* PART 1 step 8: readable Kind labels, DB values preserved. */
    const KIND_LABELS = {
      fuel: 'Fuel',
      personnel: 'Personnel',
      equipment: 'Equipment',
      mutual_aid: 'Mutual aid',
      other: 'Other'
    };
    const kindOpts = Object.keys(KIND_LABELS).map((k) =>
      '<option value="' + k + '">' + esc(KIND_LABELS[k]) + '</option>').join('');

    /* openModal() handles the missing-UG_FEATURES case with a visible
       toast — no silent fail. */
    openModal({
      title: 'New support request',
      body: '<div class="ug-field"><label class="ug-lab">Kind</label><select class="ug-sel" data-rq-kind>' + kindOpts + '</select></div>' +
            '<div class="ug-field"><label class="ug-lab">Details</label>' +
              '<textarea class="ug-ta" rows="3" data-rq-details maxlength="1000" placeholder="What do you need? Be specific — the LGU sees this message."></textarea>' +
              '<div class="ug-help ug-dimmer" style="font-size:10.5px;text-align:right" data-rq-counter>0 / 1000</div>' +
            '</div>',
      footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-rq-save>Send</button>',
      onMount: (wrap, close) => {
        /* Live character counter. */
        const ta = wrap.querySelector('[data-rq-details]');
        const counter = wrap.querySelector('[data-rq-counter]');
        const updateCounter = () => {
          if (!counter) return;
          const n = (ta.value || '').length;
          counter.textContent = n + ' / 1000';
          counter.style.color = n > 1000 ? 'var(--ug-emergency)' : (n > 900 ? 'var(--ug-warning)' : '');
        };
        ta.addEventListener('input', updateCounter);
        updateCounter();

        const saveBtn = wrap.querySelector('[data-rq-save]');
        saveBtn.addEventListener('click', async () => {
          /* PART 1 step 4: validation + double-submit guard. */
          if (saveBtn.disabled) return;
          const kind = wrap.querySelector('[data-rq-kind]').value;
          const details = (ta.value || '').trim();
          if (!details) {
            app().toast('Write a short description of what you need before sending.', 'warning');
            ta.focus();
            return;
          }
          if (details.length > 1000) {
            app().toast('Keep the details under 1000 characters (you have ' + details.length + ').', 'warning');
            return;
          }
          /* Disable while the request is in flight. */
          saveBtn.disabled = true;
          saveBtn.textContent = 'Sending…';
          try {
            await rpc('create_unit_request', {
              p_unit_id: state.data.unit.id,
              p_kind: kind,
              p_details: details
            });
            app().toast('Request sent to the LGU', 'prepared');
            /* PART 1 step 6: refresh + render so the new row + the open-count chip update. */
            await loadRequests();
            app().render();
            close();
          } catch (e) {
            app().toast(e.message || 'Could not send the request', 'warning');
            /* Re-enable so the user can fix the message and retry. */
            saveBtn.disabled = false;
            saveBtn.textContent = 'Send';
          }
        });
      }
    });
  }

  function openCapacityModal() {
    /* Hospital-only — but guard anyway. If the user is not on a hospital
       unit, the Set capacity button should not be visible (it's hidden
       in sEquipment for non-Hospital units). Detect a missing unit and
       toast a friendly message instead of throwing on state.data.unit.id. */
    if (!state.data.unit || !state.data.unit.id) {
      app().toast('Your account is not linked to a dispatch unit. Ask the LGU or Super Admin to assign one before updating capacity.', 'warning');
      return;
    }
    const cap = state.data.capacity || { er_beds: 0, icu_beds: 0, available: 0, accepting: true };
    openModal({
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
          const btn = wrap.querySelector('[data-cap-save]');
          if (btn.disabled) return;
          btn.disabled = true; btn.textContent = 'Saving…';
          try {
            await rpc('set_hospital_capacity', {
              p_unit_id: state.data.unit.id,
              p_er_beds: parseInt(wrap.querySelector('[data-cap-er]').value, 10) || 0,
              p_icu_beds: parseInt(wrap.querySelector('[data-cap-icu]').value, 10) || 0,
              p_available: parseInt(wrap.querySelector('[data-cap-avail]').value, 10) || 0,
              p_accepting: wrap.querySelector('[data-cap-accepting]').value === 'true'
            });
            app().toast('Capacity updated', 'prepared');
            await loadCapacity();
            app().render();
            close();
          } catch (e) {
            app().toast(e.message || 'Could not update capacity', 'warning');
            btn.disabled = false; btn.textContent = 'Save';
          }
        });
      }
    });
  }

  /* ------------------------------------------------------- equipment management
   * 050 (Oct 25 2026): Add / Edit / Retire / Remove equipment for the
   * caller's own unit. The barangay_official + LGU paths are in
   * js/screens.admin.js; this block is for the dispatch_team unit_admin
   * on the Equipment & Readiness screen. Regular members see only the
   * Check / Status buttons (handled by the existing actions).
   *
   * Catalog dropdown: from UG.DATA.equipmentCatalog (loaded once by
   * Repo.loadDispatchDirectory). The list_equipment_catalog_by_owner RPC
   * also exists for callers that want a server-side filter.
   */

  function catalogList() {
    return (window.UG_DATA && UG_DATA.equipmentCatalog) ||
           (typeof UG !== 'undefined' && UG.DATA && UG.DATA.equipmentCatalog) || [];
  }

  /* 054: rows loaded before migration 054 have no category; treat them as
     'General' (the column default) so the form still works. */
  function catalogCategory(c) {
    return (c && c.category) || 'General';
  }

  /* 054: the distinct categories of the owner's catalog rows, sorted. */
  function catalogCategoriesForUnitType(unitType) {
    const seen = {};
    catalogList().forEach((c) => { if (c.unit_type === unitType) seen[catalogCategory(c)] = true; });
    return Object.keys(seen).sort((a, b) => a.localeCompare(b));
  }

  /* Render the catalog <option>s for the Add form's Type dropdown. The
     owner unit's unit_type determines which catalog rows to show.
     054: optional `category` narrows the list to one category. */
  function catalogOptionsForUnitType(unitType, selectedId, category) {
    const list = catalogList();
    const filtered = list.filter((c) => c.unit_type === unitType &&
      (category == null || catalogCategory(c) === category));
    const opts = filtered.map((c) =>
      '<option value="' + esc(c.id) + '"' + (c.id === selectedId ? ' selected' : '') + '>' + esc(c.label) + '</option>'
    ).join('');
    /* The "Other (custom)" option uses custom_label and no catalog_id. */
    return opts + '<option value=""' + (selectedId === '' || selectedId == null ? ' selected' : '') + '>Other (custom)</option>';
  }

  /* Map a dispatch_equipment row's catalog_id back to a readable label,
     falling back to custom_label or 'Equipment'. */
  function equipmentLabel(row) {
    if (row && row.catalog_id) {
      const list = (typeof UG !== 'undefined' && UG.DATA && UG.DATA.equipmentCatalog) || [];
      const c = list.find((x) => x.id === row.catalog_id);
      if (c) return c.label;
    }
    return (row && (row.custom_label || row.identifier)) || 'Equipment';
  }

  function openAddEquipmentModal(opts) {
    /* opts: { ownerUnitId, ownerBarangayId, unitType, onSaved, pickBarangay } */
    /* 054: check the owner passed in, not the dispatch console's own unit.
       The LGU has no dispatch unit, so the old check (!state.data.unit)
       blocked the LGU from adding equipment to any unit. add_equipment
       still enforces who may add to which owner. */
    if (!opts.ownerUnitId && !opts.ownerBarangayId && !opts.pickBarangay) {
      app().toast('Your account is not linked to a dispatch unit. Ask the LGU or Super Admin to assign one before adding equipment.', 'warning');
      return;
    }
    const ownerUnit = opts.ownerUnitId
      ? (((typeof UG !== 'undefined' && UG.DATA && UG.DATA.dispatchUnits) || []).find((u) => u.id === opts.ownerUnitId) ||
         (state.data.unit && state.data.unit.id === opts.ownerUnitId ? state.data.unit : null))
      : null;
    const unitType = opts.unitType || (ownerUnit && ownerUnit.unit_type) ||
                     (state.data.unit && state.data.unit.unit_type) || 'Barangay';

    /* 054: Category -> Type. The Category field is hidden when the owner's
       catalog has one category or none; then Type lists every row. */
    const categories = catalogCategoriesForUnitType(unitType);
    const showCategory = categories.length > 1;
    const firstCategory = categories.length ? categories[0] : null;
    const categoryOpts = categories.map((cat, i) =>
      '<option value="' + esc(cat) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(cat) + '</option>'
    ).join('');
    /* Type options for one category; the first catalog row is preselected,
       "Other (custom)" (value "") is always last. */
    const typeOptsFor = (cat) => {
      const first = catalogList().find((c) => c.unit_type === unitType && catalogCategory(c) === cat);
      return catalogOptionsForUnitType(unitType, first ? first.id : null, cat);
    };

    openModal({
      title: 'Add equipment' + (ownerUnit && ownerUnit.name ? ' · ' + ownerUnit.name : ''),
      body: (opts.pickBarangay
          ? '<div class="ug-field"><label class="ug-lab">Barangay</label>' +
              '<select class="ug-sel" data-eq-brgy><option value="">Loading barangays…</option></select></div>'
          : '') +
        '<div class="ug-field" data-eq-category-field' + (showCategory ? '' : ' hidden') + '><label class="ug-lab">Category</label>' +
          '<select class="ug-sel" data-eq-category>' + categoryOpts + '</select></div>' +
        '<div class="ug-field"><label class="ug-lab">Type</label>' +
          '<select class="ug-sel" data-eq-catalog>' + typeOptsFor(firstCategory) + '</select></div>' +
        '<div class="ug-field" data-eq-custom-field hidden><label class="ug-lab">Custom label</label>' +
          '<input class="ug-in" type="text" data-eq-custom placeholder="e.g. Portable Pump"></div>' +
        '<div class="ug-field"><label class="ug-lab">Identifier (plate / tag / unit number)</label>' +
          '<input class="ug-in" type="text" data-eq-identifier placeholder="e.g. Fire Truck #2"></div>' +
        '<div class="ug-field"><label class="ug-lab">Starting condition</label>' +
          '<select class="ug-sel" data-eq-condition>' + conditionOptions('unknown') + '</select></div>' +
        '<div class="ug-field"><label class="ug-lab">Notes</label>' +
          '<textarea class="ug-ta" rows="2" data-eq-notes placeholder="Anything the next shift should know"></textarea></div>',
      footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-eq-save>Add</button>',
      onMount: (wrap, close) => {
        /* Show the custom-label field only when "Other (custom)" is selected. */
        const catalogSel = wrap.querySelector('[data-eq-catalog]');
        const customField = wrap.querySelector('[data-eq-custom-field]');
        const refreshCustom = () => { customField.hidden = !!catalogSel.value; };
        catalogSel.addEventListener('change', refreshCustom);
        const brgySel = wrap.querySelector('[data-eq-brgy]');
        if (brgySel) {
          Promise.resolve(typeof Repo !== 'undefined' && Repo.listBarangays ? Repo.listBarangays() : [])
            .then((list) => {
              /* 'local-N' ids are offline placeholders, not real rows. */
              const rows = (list || []).filter((b) => b && b.id && String(b.id).indexOf('local-') !== 0);
              brgySel.innerHTML = '<option value="">Choose a barangay</option>' +
                rows.map((b) => '<option value="' + esc(b.id) + '">' + esc(b.name) + '</option>').join('');
            })
            .catch(() => { brgySel.innerHTML = '<option value="">Could not load barangays</option>'; });
        }
        /* 054: a new category refills Type with that category's rows. */
        const categorySel = wrap.querySelector('[data-eq-category]');
        categorySel.addEventListener('change', () => {
          catalogSel.innerHTML = typeOptsFor(categorySel.value);
          refreshCustom();
        });
        refreshCustom();

        const saveBtn = wrap.querySelector('[data-eq-save]');
        saveBtn.addEventListener('click', async () => {
          if (saveBtn.disabled) return;
          const catalogId = catalogSel.value || null;
          const customLabel = customField.hidden ? '' : (wrap.querySelector('[data-eq-custom]').value || '').trim();
          const identifier = (wrap.querySelector('[data-eq-identifier]').value || '').trim();
          const condition = wrap.querySelector('[data-eq-condition]').value;
          const notes = (wrap.querySelector('[data-eq-notes]').value || '').trim();
          const ownerBrgy = brgySel ? (brgySel.value || null) : (opts.ownerBarangayId || null);
          if (brgySel && !ownerBrgy) {
            app().toast('Choose the barangay that owns this equipment.', 'warning');
            return;
          }
          if (!catalogId && !customLabel) {
            app().toast('Pick a type from the catalog, or write a custom label.', 'warning');
            return;
          }
          saveBtn.disabled = true; saveBtn.textContent = 'Adding…';
          try {
            await rpc('add_equipment', {
              p_owner_unit_id: opts.ownerUnitId || null,
              p_owner_barangay_id: ownerBrgy,
              p_catalog_id: catalogId,
              p_custom_label: customLabel,
              p_identifier: identifier,
              p_condition: condition,
              p_notes: notes
            });
            app().toast('Equipment added', 'prepared');
            /* Refresh this console's list, the caller's onSaved (or the
               shared directory) and any open per-unit list. */
            await afterEquipmentChange(opts);
            close();
          } catch (e) {
            app().toast(e.message || 'Could not add the equipment', 'warning');
            saveBtn.disabled = false; saveBtn.textContent = 'Add';
          }
        });
      }
    });
  }

  function openEditEquipmentModal(id, opts) {
    /* opts: { onSaved } — for the LGU/barangay screen, which doesn't share
       UG_DISPATCH.state.data.equipment, the caller passes the row + a
       refresh callback. */
    const row = findEquipment(id);
    if (!row) {
      app().toast('That equipment is no longer in the list. Refresh and try again.', 'warning');
      return;
    }
    /* The modal escapes the title itself; esc() here showed "&amp;". */
    openModal({
      title: 'Edit · ' + (row.identifier || equipmentLabel(row)),
      body: '<div class="ug-field"><label class="ug-lab">Type</label>' +
          '<input class="ug-in" type="text" value="' + esc(equipmentLabel(row)) + '" disabled></div>' +
        '<div class="ug-field"' + (row.catalog_id ? ' hidden' : '') + ' data-eq-custom-field><label class="ug-lab">Custom label</label>' +
          '<input class="ug-in" type="text" data-eq-custom value="' + esc(row.custom_label || '') + '"></div>' +
        '<div class="ug-field"><label class="ug-lab">Identifier</label>' +
          '<input class="ug-in" type="text" data-eq-identifier value="' + esc(row.identifier || '') + '"></div>' +
        '<div class="ug-field"><label class="ug-lab">Condition</label>' +
          '<select class="ug-sel" data-eq-condition>' + conditionOptions(row.condition) + '</select></div>' +
        '<div class="ug-field"><label class="ug-lab">Notes</label>' +
          '<textarea class="ug-ta" rows="2" data-eq-notes>' + esc(row.notes || '') + '</textarea></div>' +
        '<div class="ug-help">Owner cannot be changed. Retire + add a new row to change ownership.</div>',
      footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-eq-save>Save</button>',
      onMount: (wrap, close) => {
        const saveBtn = wrap.querySelector('[data-eq-save]');
        saveBtn.addEventListener('click', async () => {
          if (saveBtn.disabled) return;
          const customLabel = (wrap.querySelector('[data-eq-custom-field]').hidden ? null : (wrap.querySelector('[data-eq-custom]').value || '').trim());
          const identifier = (wrap.querySelector('[data-eq-identifier]').value || '').trim();
          const condition = wrap.querySelector('[data-eq-condition]').value;
          const notes = (wrap.querySelector('[data-eq-notes]').value || '').trim();
          saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
          try {
            await rpc('update_equipment', {
              p_equipment_id: id,
              p_identifier: identifier,
              p_custom_label: customLabel,
              p_condition: condition,
              p_notes: notes
            });
            app().toast('Equipment updated', 'prepared');
            await afterEquipmentChange(opts);
            close();
          } catch (e) {
            app().toast(e.message || 'Could not update the equipment', 'warning');
            saveBtn.disabled = false; saveBtn.textContent = 'Save';
          }
        });
      }
    });
  }

  function openRemoveEquipmentModal(id, opts) {
    /* opts: { onSaved } */
    const row = findEquipment(id);
    if (!row) {
      app().toast('That equipment is no longer in the list. Refresh and try again.', 'warning');
      return;
    }
    /* Block the modal entirely while deployed. */
    if (row.status === 'deployed') {
      openModal({
        title: 'Cannot remove · ' + (row.identifier || equipmentLabel(row)),
        body: '<div class="ug-note">This equipment is currently deployed to a dispatch. ' +
              'Release it from the dispatch (or mark the dispatch Done) before removing or retiring it.</div>',
        footer: '<button class="ug-btn" data-modal-close>Close</button>'
      });
      return;
    }
    /* Fetch the dispatch history count so we can pre-empt the "has been
       used" case in the UI. The RPC will reject server-side anyway, so
       this is purely for a friendlier modal. */
    const refreshAfter = () => afterEquipmentChange(opts);
    const c = client();
    /* Default the body text — the actual history count is fetched
       asynchronously; if the count is 0 we show "Remove" + "Retire";
       if >0 we show only "Retire". */
    openModal({
      title: 'Retire or remove · ' + (row.identifier || equipmentLabel(row)),
      body: '<div class="ug-note" data-eq-status>Loading dispatch history…</div>',
      footer: '<button class="ug-btn" data-modal-close>Cancel</button>' +
              '<button class="ug-btn ug-btn--ghost" data-eq-retire hidden>Retire (status = unavailable)</button>' +
              '<button class="ug-btn ug-btn--signal" data-eq-remove hidden>Remove permanently</button>',
      onMount: async (wrap, close) => {
        const statusEl = wrap.querySelector('[data-eq-status]');
        const retireBtn = wrap.querySelector('[data-eq-retire]');
        const removeBtn = wrap.querySelector('[data-eq-remove]');
        let useCount = 0;
        if (c) {
          try {
            /* Fix (Oct 28 2026): with head:true supabase-js puts the
               number on the response's `count`, not on data (which is
               null), so this always read 0 and the fallback below capped
               the message at "1 dispatch(es)". */
            const { count, error } = await c.from('dispatch_equipment_use')
              .select('id', { count: 'exact', head: true })
              .eq('equipment_id', id);
            useCount = (error ? 0 : (typeof count === 'number' ? count : 0));
            /* head:true returns count in the response meta, but the supabase
               JS client returns it as `count` on the response. If head:true
               returned no count, fall back to a normal select + length. */
            if (useCount === 0 && !error) {
              const { data: rows } = await c.from('dispatch_equipment_use')
                .select('id').eq('equipment_id', id).limit(1);
              useCount = (rows && rows.length) || 0;
            }
          } catch (e) { /* fall back to "no history" — server will reject if wrong */ }
        }
        if (useCount > 0) {
          statusEl.innerHTML = 'This equipment has been used in <b>' + useCount + '</b> dispatch(es). ' +
            'Permanently deleting it would erase that history. <b>Retire</b> it instead — it stays in the list, marked unavailable, and the history is preserved.';
          retireBtn.hidden = false;
          removeBtn.hidden = true;
        } else {
          statusEl.innerHTML = 'This equipment has never been used in a dispatch. You can <b>remove</b> it permanently (the readiness-check history is also deleted) or <b>retire</b> it (status = unavailable, stays in the list).';
          retireBtn.hidden = false;
          removeBtn.hidden = false;
        }
        retireBtn.addEventListener('click', async () => {
          if (retireBtn.disabled) return;
          retireBtn.disabled = true; retireBtn.textContent = 'Retiring…';
          try {
            await rpc('remove_equipment', { p_equipment_id: id, p_retire: true });
            app().toast('Equipment retired', 'prepared');
            await refreshAfter();
            close();
          } catch (e) {
            app().toast(e.message || 'Could not retire the equipment', 'warning');
            retireBtn.disabled = false; retireBtn.textContent = 'Retire (status = unavailable)';
          }
        });
        removeBtn.addEventListener('click', async () => {
          if (removeBtn.disabled) return;
          removeBtn.disabled = true; removeBtn.textContent = 'Removing…';
          try {
            await rpc('remove_equipment', { p_equipment_id: id, p_retire: false });
            app().toast('Equipment removed', 'prepared');
            await refreshAfter();
            close();
          } catch (e) {
            app().toast(e.message || 'Could not remove the equipment', 'warning');
            removeBtn.disabled = false; removeBtn.textContent = 'Remove permanently';
          }
        });
      }
    });
  }


  /* ----------------------------------------------------------------- exports */
  return {
    state, frame, body, loadAll, loadRoute, actions, signedOut,
    DTITLES: (r) => DTITLES(r),
    /* 050 (Oct 25 2026): expose the equipment-management modals so the
       LGU + barangay Response Team screens (js/screens.admin.js + js/app.js)
       can reuse them — the modal logic is the same for every role, only
       the owner (unit_id vs barangay_id) differs. */
    openAddEquipmentModal,
    openEditEquipmentModal,
    openRemoveEquipmentModal,
    catalogOptionsForUnitType,
    catalogCategoriesForUnitType,
    equipmentLabel,
    openCheckModal,
    conditionLabel,
    statusLabel
  };
})();

window.UG_DISPATCH = UG_DISPATCH;
