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
  const emptyData = () => ({
    unit: null, personnel: [], equipment: [], checks: [], dispatches: [], events: [],
    requests: [], notices: [], capacity: null, notifications: [], helpRequests: [],
    acceptingHospitals: [], directory: { hotlines: [], captains: [], patrolShelters: [], escortList: [] }
  });
  const state = {
    route: 'dispatch',
    openDispatchId: null,
    openEquipmentId: null,
    loading: false,
    error: null,
    lastSync: null,
    data: emptyData()
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
  async function read(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message || 'Could not read unit data');
    return data;
  }

  async function loadUnit() {
    const c = client();
    const session = app().S?.session;
    if (!c || !session?.dispatch_unit_id) return null;
    const target = state.data;
    const unit = await read(c.from('dispatch_units').select('*').eq('id', session.dispatch_unit_id).maybeSingle());
    if (target !== state.data) return null;
    if (!unit || unit.active === false) {
      Object.assign(target, emptyData());
      stopTracking();
      throw new Error('Your dispatch unit is unavailable. Ask your administrator to check your assignment.');
    }
    target.unit = unit;
    return unit;
  }

  async function loadUnitPart(key, tableName, unitColumn, configure, fallback = []) {
    const c = client();
    const target = state.data;
    if (!c || !target.unit) return fallback;
    target[key] = await read(configure(c.from(tableName).select('*').eq(unitColumn, target.unit.id))) ?? fallback;
    return target[key];
  }

  const newestFirst = (query) => query.order('created_at', { ascending: false });
  const loadEquipment = () => loadUnitPart('equipment', 'dispatch_equipment', 'owner_unit_id', newestFirst);
  const loadPersonnel = () => loadUnitPart('personnel', 'unit_personnel', 'unit_id', (query) => query.order('on_duty', { ascending: false }));
  const loadRequests = () => loadUnitPart('requests', 'unit_requests', 'unit_id', newestFirst);
  const loadCapacity = () => loadUnitPart('capacity', 'hospital_capacity', 'unit_id', (query) => query.maybeSingle(), null);
  const loadNotices = () => loadUnitPart('notices', 'patient_notices', 'unit_id', newestFirst);
  const loadHelpRequests = () => loadUnitPart('helpRequests', 'dispatch_help_requests', 'unit_id', newestFirst);

  function loadDispatchById(c, unitId, assignmentId) {
    return read(c.from('report_dispatches').select('*, report:reports(*)')
      .eq('unit_id', unitId).eq('id', assignmentId).maybeSingle());
  }

  async function loadDispatches() {
    const c = client();
    const target = state.data;
    if (!c || !target.unit) return [];
    const terminal = ['done', 'declined'];
    const query = () => c.from('report_dispatches').select('*, report:reports(*)').eq('unit_id', target.unit.id)
      .order('dispatched_at', { ascending: false }).order('id', { ascending: false });
    const closed = read(query().in('dispatch_status', terminal).limit(50));
    const active = async () => {
      const rows = [];
      const size = 200;
      for (let offset = 0;; offset += size) {
        const page = await read(query().not('dispatch_status', 'in', '(done,declined)').range(offset, offset + size - 1));
        rows.push(...page);
        if (page.length < size || target !== state.data) return rows;
      }
    };
    const [openRows, closedRows] = await Promise.all([active(), closed]);
    if (target !== state.data) return [];
    const rows = new Map([...closedRows, ...openRows].map((row) => [row.id, row]));
    const id = app().S?.route === 'dispatch-detail' && app().S.openId;
    if (id && !rows.has(id)) {
      const selected = await loadDispatchById(c, target.unit.id, id);
      if (target !== state.data) return [];
      if (selected) rows.set(id, selected);
    }
    target.dispatches = [...rows.values()]
      .sort((a, b) => Date.parse(b.dispatched_at) - Date.parse(a.dispatched_at));
    target.dispatches.forEach((row) => incoming.delete(row.id));
    return target.dispatches;
  }

  async function loadEvents() {
    const c = client();
    const target = state.data;
    if (!c || !target.unit) return [];
    const ids = target.dispatches.map((row) => row.id);
    target.events = ids.length
      ? await read(c.from('report_dispatch_events').select('*').in('dispatch_id', ids).order('created_at', { ascending: false }))
      : [];
    return target.events;
  }

  /* The ambulance and rescue forms share the same receiving-hospital list. */
  async function loadAcceptingHospitals() {
    const c = client();
    if (!c) return [];
    const target = state.data;
    const hospitals = await read(c.from('dispatch_units')
      .select('id,name,unit_type,hospital_capacity!inner(accepting,available,er_beds,icu_beds)')
      .eq('unit_type', 'Hospital').eq('active', true).eq('hospital_capacity.accepting', true).order('name'));
    target.acceptingHospitals = (hospitals || []).map((row) => ({
      id: row.id, name: row.name, available: row.hospital_capacity?.available ?? null
    }));
    return target.acceptingHospitals;
  }

  /* emergency_hotlines.category (038) defaults to 'Other' and the hotline
     forms never set it, so nearly every row says Other. Work the category
     out from the agency name and scope (as js/repo.js does for residents);
     a real stored category still wins. */
  const HOT_CAT = { BFP: 'Fire', PNP: 'Police', Hospital: 'Medical', 'Rescue Unit': 'Rescue', MDRRMO: 'Disaster response', 'Barangay Captain': 'Barangay' };
  function hotlineCategory(h) {
    if (h.category && h.category !== 'Other') return HOT_CAT[h.category] || h.category;
    const t = ((h.agency_name || '') + ' ' + (h.scope || '') + ' ' + (h.description || '')).toLowerCase();
    if (/\bbfp\b|fire/.test(t)) return 'Fire';
    if (/\bpnp\b|police/.test(t)) return 'Police';
    if (/coast guard/.test(t)) return 'Coast guard';
    if (/hospital|medical|red cross|health|ambulance|\bpph\b/.test(t)) return 'Medical';
    if (/swdo|dswd|social welfare/.test(t)) return 'Social welfare';
    if (/drrm|rescue/.test(t)) return 'Disaster response';
    if (/barangay|brgy/.test(t)) return 'Barangay';
    if (/\b911\b|emergency|hotline/.test(t)) return 'Emergency';
    return 'Other';
  }

  async function loadDirectory() {
    const c = client();
    if (!c) return;
    const target = state.data;
    const isPolice = target.unit?.unit_type === 'PNP';
    const [hotlines, captains, patrolShelters, escortList] = await Promise.all([
      read(c.from('emergency_hotlines').select('id, agency_name, contact_number, scope, description, category, active').eq('active', true)),
      read(c.from('barangays').select('id, name, captain_name, captain_phone')),
      isPolice ? read(c.from('evacuation_centers').select('id, name, barangay, barangay_id, needs_patrol, needs_patrol_at').eq('needs_patrol', true)) : [],
      isPolice ? read(c.from('relief_distributions').select('*').neq('escort_status', 'none')) : []
    ]);
    target.directory = {
      hotlines: hotlines.map((row) => ({ ...row, category: hotlineCategory(row) })),
      captains: captains.filter((row) => row.captain_phone), patrolShelters, escortList
    };
  }

  async function loadNotifications() {
    const c = client();
    if (!c) return [];
    const target = state.data;
    target.notifications = await read(c.from('notifications').select('*').order('created_at', { ascending: false }).limit(50));
    return target.notifications;
  }

  async function loadAll(opts) {
    const target = state.data;
    if (!opts?.silent) { state.loading = true; state.error = null; }
    try {
      await loadUnit();
      if (target !== state.data) return;
      const results = await Promise.allSettled([
        loadEquipment(), loadPersonnel(), loadDispatches().then(() => {
          if (target === state.data) return loadEvents();
        }),
        loadRequests(), loadDirectory(), loadNotifications(), loadHelpRequests(), loadAcceptingHospitals(),
        ...(target.unit?.unit_type === 'Hospital' ? [loadNotices(), loadCapacity()] : [])
      ]);
      if (target !== state.data) return;
      const failed = results.find((result) => result.status === 'rejected');
      state.error = failed ? 'Could not refresh all unit data. Retry to check the latest information.' : null;
      if (!failed) state.lastSync = new Date().toISOString();
    } catch (error) {
      if (target !== state.data) return;
      state.error = UG_UTIL.friendlyError(error);
    }
    state.loading = false;
    alarmOnNewDispatch();
    syncDispatchAlarm();
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
    if (!seenDispatches) seenDispatches = new Set();
    const fresh = list.filter((d) => !seenDispatches.has(d.id) && d.dispatch_status === 'sent');
    list.forEach((d) => seenDispatches.add(d.id));
    if (!fresh.length) return;
    const r = fresh[0].report || {};
    app().toast('New dispatch: ' + (r.code || '') + ' · ' + (r.barangay || ''), 'warning');
  }

  let lastDispatchAlarmAt = 0;
  const incoming = new Set();
  function syncDispatchAlarm() {
    if (typeof Auth === 'undefined' || !Auth.state.session || Auth.state.session.role !== 'dispatch_team' ||
        (!incoming.size && !(state.data.dispatches || []).some((d) => d.dispatch_status === 'sent'))) {
      UG_ALARM.stopPendingDispatch();
      lastDispatchAlarmAt = 0;
      return;
    }
    if (Date.now() - lastDispatchAlarmAt < 5000 || UG_ALARM.needsUnlock()) return;
    if (UG_ALARM.play('dispatch', { force: true, pendingDispatch: true })) lastDispatchAlarmAt = Date.now();
  }
  setInterval(syncDispatchAlarm, 1000);
  document.addEventListener('ug:alarm-unlocked', syncDispatchAlarm);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncDispatchAlarm();
  });

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
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'report_dispatches', filter: 'unit_id=eq.' + unit.id },
          ({ new: row }) => {
            if (row.dispatch_status !== 'sent') incoming.delete(row.id);
            const local = (state.data.dispatches || []).find((d) => d.id === row.id);
            if (local && local.dispatch_status !== row.dispatch_status) {
              local.dispatch_status = row.dispatch_status;
              syncDispatchAlarm();
              syncTracking();
              app().render();
              loadAll({ silent: true });
            }
          })
        .subscribe();
    } catch (e) { /* the poll still covers it */ }
  }

  /* ring at once with the report's hazard alarm, even when the screen has to
     wait (someone typing) before it can show the new dispatch */
  async function ringForInsert(row) {
    if (!row || !row.id) return;
    if (seenDispatches && seenDispatches.has(row.id)) return;
    if (seenDispatches) seenDispatches.add(row.id);
    if (row.dispatch_status === 'sent') {
      incoming.add(row.id);
      syncDispatchAlarm();
    }
    try {
      const { data: r } = await client().from('reports').select('code, barangay, hazard_type, hazard_other_text').eq('id', row.report_id).maybeSingle();
      if (r) {
        app().toast('New dispatch: ' + (r.code || '') + ' · ' + (r.barangay || ''), 'warning');
      }
    } catch (e) { }
    await loadAll({ silent: true });
  }

  /* ------------------------------------------------------- GPS tracking */
  /* While the unit has an open dispatch, this device shares its position
     (update_dispatch_location, migration 057). The server moves the status
     after explicit acknowledgment: en route with movement and on scene
     near the incident. One device shares for its selected assignment. */
  const SEND_EVERY_MS = 15000;
  const SEND_MOVED_M = 25;
  const track = { dispatchId: null, watchId: null, status: 'off', fix: null, sent: null, sending: false, error: '' };

  const metres = UG_UTIL.distanceM;
  function openDispatches() {
    return (state.data.dispatches || []).filter((d) => d.dispatch_status !== 'done' && d.dispatch_status !== 'declined');
  }

  function syncTracking() {
    const selected = openDispatches().find((d) => d.id === track.dispatchId && d.dispatch_status !== 'sent' &&
      !['resolved', 'rejected'].includes((d.report || {}).status));
    const need = !!selected && online();
    if (!selected && track.dispatchId) {
      track.dispatchId = null;
      track.fix = null;
      track.sent = null;
    }
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
    Object.assign(state, {
      data: emptyData(), route: 'dispatch', openDispatchId: null, openEquipmentId: null,
      error: null, lastSync: null, loading: false, mTab: 'active', eqF: 'all', ntF: 'all', rqTab: 'open'
    });
    stopTracking();
    track.dispatchId = null;
    track.fix = null; track.sent = null; track.error = '';
    incoming.clear();
    UG_ALARM.stopPendingDispatch();
    lastDispatchAlarmAt = 0;
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
    const open = openDispatches().filter((d) => d.id === track.dispatchId && d.dispatch_status !== 'sent');
    if (!open.length) { syncTracking(); return; }
    track.sending = true;
    let changed = false;
    try {
      for (const d of open) {
        try {
          const res = await rpc('update_dispatch_location', { p_dispatch_id: d.id, p_lat: fix.lat, p_lng: fix.lng, p_accuracy: fix.accuracy });
          if (res && (res.poor_fix || res.tracking === false)) continue;
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
    if (d.dispatch_status === 'sent') return '';
    if (track.dispatchId !== d.id || st === 'denied' || st === 'off') {
      return (st === 'denied' && track.dispatchId === d.id
        ? '<p class="ug-dim">Allow location in your browser, then try again.</p>' : '') +
        '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="dispatch-track-start" data-id="' +
        esc(d.id) + '">' + I('radar', 13) + 'Share location for this response</button>';
    }
    const r = d.report || {};
    const dist = (track.fix && r.lat != null && r.lng != null)
      ? Math.round(metres(track.fix.lat, track.fix.lng, r.lat, r.lng)) : null;
    if (st === 'on') {
      return '<div class="ug-rowf ug-gap8" style="gap:8px;align-items:center;font-size:12px">' +
        '<span class="ug-badge ug-badge--resolved">' + I('radar', 12) + ' Location on</span>' +
        '<span class="ug-dim">' + (dist != null ? UG_UTIL.fmtDistance(dist) + ' from the scene · ' : '') +
          '±' + esc(track.fix.accuracy) + ' m</span></div>';
    }
    if (st === 'unsupported') {
      return '<div class="ug-note" style="font-size:12px">This device cannot share its location. Press Done when the response is finished.</div>';
    }
    return '<div class="ug-dim" style="font-size:12px">' + I('radar', 12) + ' Finding your location…</div>';
  }

  async function loadRoute(route) {
    const target = state.data;
    state.route = route;
    if (route === 'dispatch-detail' && app().S?.openId) state.openDispatchId = app().S.openId;
    try {
      if (route === 'dispatch-detail' || route === 'dispatch') {
        await loadDispatches();
        if (target === state.data) await loadEvents();
      }
      if (route === 'equipment') await loadEquipment();
      if (route === 'roster') await loadPersonnel();
      if (route === 'requests') await loadRequests();
      if (route === 'hospital' && target.unit?.unit_type === 'Hospital') await Promise.all([loadCapacity(), loadNotices()]);
      if (route === 'analytics') await loadDispatches();
    } catch (error) {
      if (target === state.data && state.route === route) state.error = UG_UTIL.friendlyError(error);
    }
    if (target === state.data) app().render();
  }

  /* -------------------------------------------------------------- render helpers */
  function pageHead(title, sub, actions) {
    return '<div class="dp-head">' +
      '<div class="dp-head-t"><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' +
      (actions ? '<div class="dp-head-a">' + actions + '</div>' : '') + '</div>';
  }

  function card(body, extra) {
    return '<div class="ug-card"' + (extra ? ' ' + extra : '') + '><div class="ug-card-b">' + body + '</div></div>';
  }

  function badge(tone, label) {
    return '<span class="ug-badge ug-badge--' + tone + '">' + esc(label) + '</span>';
  }

  function readout(v, l, tone) {
    return '<div class="ug-col" style="gap:3px;padding:14px 16px;background:var(--ug-surface);border:1px solid var(--ug-line);border-radius:14px">' +
      '<span class="ug-mono" style="font-size:20px;font-weight:600;color:' + (tone || 'var(--ug-ink)') + '">' + v + '</span>' +
      '<span class="ug-dimmer" style="font-size:11px;letter-spacing:.05em;text-transform:uppercase">' + l + '</span></div>';
  }

  function emptyState(icon, title, sub) {
    return '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I(icon || 'inbox', 20) + '</span>' +
      '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">' + esc(title) + '</div>' +
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
        '<div><div style="font-size:13px;font-weight:700;color:var(--ug-emergency)">' + esc(title) + '</div>' +
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
    ['dp-settings', 'Settings',                   'settings'],
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
        '<span class="ug-col" style="gap:0"><span class="ug-wordmark" style="font-size:16px">Uni<em>Guard</em></span>' +
        '<span class="ug-dimmer" style="font-size:11px;letter-spacing:.1em;text-transform:uppercase">Dispatch console</span></span></button>' +
      DNAV.map((n) => navItem(n, state.route)).join('') +
      '<div style="margin-top:auto" class="ug-col ug-gap6" style="gap:6px">' +
        '<button class="ug-nav" data-act="dispatch-refresh">' + I('wave', 18) + '<span>' + esc(T('action.refresh')) + '</span></button>' +
        '<div class="ug-hr" style="margin:8px 0"></div>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding:4px 8px">' +
          '<span class="ug-av">' + esc((session && session.initials) || '?') + '</span>' +
          '<span class="ug-col" style="gap:0;min-width:0"><span style="font-size:12px;font-weight:600">' + esc(session && session.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:11px">' + esc(session && session.scope) + '</span>' +
          '<span class="ug-dimmer" style="font-size:11px">' + (unit ? unitTypeLabel(unit.unit_type) : '') + (unit && dutyCount ? ' · ' + dutyCount + ' ' + esc(T('dispatch.onDuty')) : '') + '</span></span></div>' +
        '<button class="ug-nav" data-act="logout">' + I('logout', 18) + '<span>' + esc(T('action.signout')) + '</span></button>' +
        '<div class="ug-mono" style="font-size:11px;color:var(--ug-ink-3);padding:2px 9px 4px">build ' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</div>' +
      '</div>' +
    '</aside>';
  }

  function topbar(session, title, sub) {
    const unread = (state.data.notifications || []).filter((n) => !n.read_at).length;
    return '<header class="ug-top">' +
      '<button class="ug-ico-btn ug-menubtn" data-act="toggle-nav" aria-label="Open the navigation menu">' + I('menu', 18) + '</button>' +
      '<div class="ug-col" style="gap:0;min-width:150px">' +
        '<span style="font-family:var(--ug-font);font-weight:700;font-size:14px">' + esc(title) + '</span>' +
        '<span class="ug-dimmer" style="font-size:11px">' + esc(sub) + '</span></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px;margin-left:auto">' +
        '<span class="ug-chip ug-top-live is-on">' + I('wave', 13) + esc(T('state.online')) + '</span>' +
        '<button class="ug-ico-btn" aria-label="Notifications" data-act="dispatch-nav" data-route="notifications">' + I('bell', 17) + (unread ? '<span class="dot"></span>' : '') + '</button>' +
        '<button class="ug-ico-btn" aria-label="Sign out" data-act="logout">' + I('logout', 17) + '</button>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding-left:6px;border-left:1px solid var(--ug-line);margin-left:4px">' +
          '<span class="ug-col ug-top-user" style="gap:0;align-items:flex-end"><span style="font-size:12px;font-weight:600">' + esc(session.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:11px">' + esc(session.scope) + '</span></span>' +
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
      notifications: [T('title.notifications'), T('dispatch.notificationsSub')],
      'dp-settings': ['Settings', 'Alerts, alarm, location sharing, language and your account']
    };
    return function (route) { return map[route] || map.dispatch; };
  })();

  /* ----------------------------------------------------------------- screens */

  function body(st) {
    switch (state.route) {
      case 'dispatch':       return isPhone() ? mHome(st) : sIncoming(st);
      case 'dispatch-detail': return sDispatchDetail(st);
      case 'equipment':      return sEquipment(st);
      case 'roster':         return sRoster(st);
      case 'hospital':       return sHospital(st);
      case 'requests':       return sRequests(st);
      case 'analytics':      return sAnalytics(st);
      case 'contacts':       return sContacts(st);
      case 'notifications':  return sNotifications(st);
      case 'dp-settings':    return sSettings(st);
      default:               return sIncoming(st);
    }
  }

  function sIncoming(st) {
    if (state.loading) return pageHead(T('dispatch.incoming'), T('dispatch.incomingSub')) + statePanel('loading', T('state.loading'));
    const list = state.data.dispatches || [];
    if (state.error && !list.length) return pageHead(T('dispatch.incoming'), T('dispatch.incomingSub')) + statePanel('error', T('toast.couldNotLoad'), state.error);
    const open = openDispatches();
    const recentHistory = list.filter((d) => d.dispatch_status === 'done' || d.dispatch_status === 'declined').slice(0, 12);
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
                    '<span class="ug-dimmer ug-mono" style="font-size:11px">' + (c.needs_patrol_at ? absTime(c.needs_patrol_at) : '') + '</span>' +
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
        '<div class="ug-dim" style="font-size:12px">' + esc(r.barangay || '') + (d.eta ? ' · ETA ' + absTime(d.eta) : '') + '</div>' +
        '<div class="ug-dimmer" style="font-size:11px">Dispatched ' + ago(d.dispatched_at) + ' by ' + esc(d.dispatched_by_name || '') + '</div>' +
        '</div></button>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Incoming Dispatches', 'Open dispatches addressed to your unit.',
        '<span class="ug-chip is-on">' + open.length + ' active</span>') +
      pnpSection +
      '<div class="ug-wgrid-3">' + [...open, ...recentHistory].map(row).join('') + '</div>' +
      (list.length > open.length + recentHistory.length ? '<button class="ug-btn ug-btn--ghost" data-act="dispatch-nav" data-route="analytics">View dispatch history</button>' : '') +
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

    const STEP = {
      sent: ['acknowledged', 'Acknowledge dispatch'],
      acknowledged: ['en_route', 'Mark en route'],
      en_route: ['on_scene', 'Mark on scene'],
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
    const canFinish = ['acknowledged', 'en_route', 'on_scene', 'fire_out', 'arrived_hospital'].indexOf(status) >= 0
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
      '<div class="ug-note" style="font-size:12px;white-space:pre-wrap">' + esc(d.after_action) + '</div>' +
      '<div class="ug-dimmer" style="font-size:11px">Filed ' + ago(d.after_action_at) + '</div>' +
      (d.after_action_meta && Object.keys(d.after_action_meta).length
        ? '<div class="ug-dimmer ug-mono" style="font-size:11px;margin-top:4px">' + esc(JSON.stringify(d.after_action_meta)) + '</div>'
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
      (isOpen && Number.isFinite(r.lat) && Number.isFinite(r.lng) ?
        '<a class="ug-btn ug-btn--sm" target="_blank" rel="noopener noreferrer" href="' +
        esc(UG_GEO.wazeUrl(r.lat, r.lng)) + '">' + I('route', 14) + 'Directions to incident</a>' : '') +
      (isOpen && d.report && (r.lat == null || r.lng == null)
        ? '<p class="ug-note">' + esc(r.location_note || 'No GPS location. Confirm the incident address with the duty officer before traveling.') + '</p>' : '') +
      (!d.report ? '<p class="ug-note">Incident details are unavailable. Contact the duty officer to confirm the report.</p>' : '') +
      ((next || canFinish) ? '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<input class="ug-in" type="text" data-act="dispatch-note" data-id="' + esc(d.id) + '" placeholder="' + (next === 'on_hold' ? 'Reason (required for On hold)' : 'Note (optional)') + '" style="flex:1;max-width:none">' +
        (next ? '<button class="ug-btn ug-btn--sm" data-act="dispatch-respond" data-id="' + esc(d.id) + '" data-next="' + next + '">' + esc(nextLabel) + '</button>' : '') +
        (canFinish ? '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-respond" data-id="' + esc(d.id) + '" data-next="done">' + I('check', 14) + esc(T('dispatch.done')) + '</button>' : '') +
      '</div>' : '') +
      (isOpen ? '<div class="ug-dim" style="font-size:11px">Acknowledge the assignment before sharing location. When GPS is unavailable, use the status buttons to keep the resident updated.</div>' : '') +
      declineHelp + '</div>');

    /* phones: an orange hero card (back · hazard · code · facts · the
       instructions), then the status card with its big actions */
    if (isPhone()) {
      const m = etaMins(d), inf = dInfo(d), isOpenNow = OPEN_ST(d);
      const SEV = { emergency: 'Critical', warning: 'High', advisory: 'Moderate' };
      const facts = [
        inf.brgy ? ['pin', 'Brgy. ' + inf.brgy] : null,
        m != null && isOpenNow ? ['clock', m > 0 ? 'ETA ' + m + ' min' : 'Due now'] : ['clock', ago({ created_at: d.dispatched_at })],
        inf.sev ? ['alert', SEV[inf.sev] || inf.sev] : null,
        d.team ? ['truck', d.team] : null
      ].filter(Boolean);
      const hero = '<section class="dpm-hero">' +
          '<div class="dpm-hero-top"><button class="dpm-back" data-act="dispatch-nav" data-route="dispatch" aria-label="' + esc(T('dispatch.back')) + '">' + I('chevron', 18) + '</button>' +
            (inf.code ? '<span class="dpm-hero-code">' + esc(inf.code) + '</span>' : '') + '</div>' +
          '<span class="dpm-hero-i" aria-hidden="true">' + I(inf.icon, 96) + '</span>' +
        '</section>' +
        '<section class="dpm-hero-card"><h2>' + esc(inf.name) + '</h2>' +
          (r.description ? '<p class="dpm-desc">' + esc(r.description) + '</p>' : '') +
          '<div class="dpm-facts">' + facts.map((f) => '<span>' + I(f[0], 14) + esc(f[1]) + '</span>').join('') + '</div>' +
          '<p class="dpm-st is-' + esc(status) + '">' + (status === 'done' ? I('check', 15) : '') + esc(STEP_WORD[status] || status) + '</p>' +
          (d.instructions ? '<div class="dpm-instr"><small>Instructions</small><p>' + esc(d.instructions) + '</p></div>' : '') +
          '<p class="dpm-by">Dispatched by ' + esc(d.dispatched_by_name || 'the LGU') + ' · ' + esc(ago({ created_at: d.dispatched_at })) + '</p>' +
        '</section>';
      /* the history as a timeline, newest first */
      const tl = events.length ? '<section class="dpm-tl"><h3>History</h3><ol>' + events.slice().sort((x, y) => Date.parse(y.created_at || 0) - Date.parse(x.created_at || 0)).map((e, k) =>
          '<li class="' + (k === 0 ? 'is-last' : '') + '"><i></i><div><b>' + esc((e.action === 'sent' || e.action === 'dispatched' ? 'Dispatched' : STEP_WORD[e.action]) || stepLabel(e.action) || e.action) + '</b>' +
            '<small>' + esc([e.actor_name, absTime(e.created_at)].filter(Boolean).join(' · ')) + '</small>' +
            (e.note ? '<p>' + esc(e.note) + '</p>' : '') + '</div></li>').join('') + '</ol></section>' : '';
      return '<div class="ug-col dpm-detail" style="gap:14px">' + hero + (isOpenNow ? statusCard : '') + fieldPanel + hospitalBlock + roadBlock + tl + afterAction +
        (d.dispatch_status === 'done' && !d.after_action ? card('<div class="ug-col" style="gap:8px"><div style="font-size:14px;font-weight:700">File an after-action report</div>' + afterActionForm(d) + '</div>') : '') +
      '</div>';
    }
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Dispatch ' + (d.id || '').slice(0, 8), 'Incident ' + (r.code || '') + ' · ' + (r.barangay || ''),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="dispatch-nav" data-route="dispatch">' + I('chevron', 13) + esc(T('dispatch.back')) + '</button>') +
      '<div class="ug-wgrid-2">' +
        card('<div class="ug-col" style="gap:8px"><div style="font-size:13px;font-weight:700">' + esc(r.code || '') + ' · ' + esc(r.hazard_type || '') + '</div>' +
          '<div class="ug-dim" style="font-size:12px">' + esc(r.description || '') + '</div>' +
          '<div class="ug-rowf ug-gap10" style="gap:10px"><span class="ug-badge ug-badge--id">' + esc(r.barangay || '') + '</span>' +
            '<span class="ug-badge ug-badge--' + (r.severity || 'advisory') + '">' + esc(r.severity || '') + '</span>' +
            (d.eta ? '<span class="ug-dim">ETA ' + absTime(d.eta) + '</span>' : '') + '</div>' +
          '<div class="ug-dimmer" style="font-size:11px">Dispatched by ' + esc(d.dispatched_by_name || '') + ' · ' + ago(d.dispatched_at) + '</div>' +
          '<div class="ug-note" style="font-size:12px;white-space:pre-wrap;margin-top:6px">' + esc(d.instructions || '') + '</div></div>') +
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
    if (isPhone()) return mEquipment(st, rows, canManage, overdue);
    const row = (r) => {
      const overdueClass = !r.last_checked_at || (Date.now() - Date.parse(r.last_checked_at)) > 86400000 ? ' style="border-left:3px solid var(--ug-warning)"' : '';
      const manageBtns = canManage
        ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="equipment-edit" data-id="' + esc(r.id) + '">Edit</button>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="equipment-remove" data-id="' + esc(r.id) + '">' + (r.status === 'unavailable' ? 'Remove' : 'Retire / remove') + '</button>'
        : '';
      return '<tr' + overdueClass + '>' +
        '<td><div style="font-weight:600">' + esc(r.identifier || equipmentLabel(r)) + '</div>' +
          '<div class="ug-dimmer" style="font-size:11px">' + esc([r.identifier ? equipmentLabel(r) : '', r.notes || ''].filter(Boolean).join(' · ')) + '</div></td>' +
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

  /* phones: equipment as cards with a figure strip that filters, a round
     Add button, clear status / condition dots and big Check / Status buttons */
  function mEquipment(st, rows, canManage, overdue) {
    const due = (r) => !r.last_checked_at || (Date.now() - Date.parse(r.last_checked_at)) > 86400000;
    const ready = rows.filter((r) => r.condition === 'ready' && r.status === 'available').length;
    const f = state.eqF === 'due' ? 'due' : state.eqF === 'ready' ? 'ready' : 'all';
    const shown = rows.filter((r) => f === 'due' ? due(r) : f === 'ready' ? (r.condition === 'ready' && r.status === 'available') : true)
      .sort((a, b) => (due(b) - due(a)) || String(a.identifier || '').localeCompare(String(b.identifier || '')));
    const unitId = esc((state.data.unit && state.data.unit.id) || '');
    const dot = (kind, v, label) => '<span class="dpe-tag is-' + kind + '-' + esc(v || 'none') + '"><i></i>' + esc(label) + '</span>';
    const card = (r) => {
      const d = due(r);
      const last = r.last_checked_at ? ago(r.last_checked_at) : 'Never';
      const cell = (label, inner) => '<div class="dpe-cell"><small>' + label + '</small><span>' + inner + '</span></div>';
      return '<article class="dpe-card' + (d ? ' is-due' : '') + '">' +
        '<div class="dpe-h"><div class="dpe-t"><b>' + esc(r.identifier || equipmentLabel(r)) + '</b>' +
            '<small>' + esc([r.identifier && equipmentLabel(r) !== r.identifier ? equipmentLabel(r) : '', r.notes || ''].filter(Boolean).join(' · ') || 'Equipment') + '</small></div>' +
          (canManage ? '<div class="ug-wmore dpe-more"><button class="dpe-dots" data-act="toggle-more" aria-haspopup="menu" aria-label="More options for ' + esc(r.identifier || 'this item') + '">' +
              '<i></i><i></i><i></i></button>' +
            '<div class="dpe-menu" data-more-panel hidden role="menu">' +
              '<button role="menuitem" data-act="equipment-edit" data-id="' + esc(r.id) + '">Edit details</button>' +
              '<button role="menuitem" class="is-del" data-act="equipment-remove" data-id="' + esc(r.id) + '">' + (r.status === 'unavailable' ? 'Remove' : 'Retire / remove') + '</button>' +
            '</div></div>' : '') + '</div>' +
        '<div class="dpe-cells">' +
          cell('Status', '<i class="dpe-d is-st-' + esc(r.status || 'none') + '"></i>' + esc(statusLabel(r.status) || '—')) +
          cell('Condition', '<i class="dpe-d is-cd-' + esc(r.condition || 'none') + '"></i>' + esc(conditionLabel(r.condition) || '—')) +
          cell('Last check', esc(last)) +
        '</div>' +
        (d ? '<p class="dpe-warn">' + I('clock', 14) + (r.last_checked_at ? 'Check due: not checked in 24 hours' : 'Check due: never checked') + '</p>' : '') +
        '<div class="dpe-acts"><button class="dpe-go" data-act="dispatch-check" data-id="' + esc(r.id) + '">' + I('check', 15) + 'Run check</button>' +
          '<button class="dpe-soft" data-act="dispatch-status" data-id="' + esc(r.id) + '">Update status</button></div>' +
      '</article>';
    };
    return '<div class="dpe">' +
      '<div class="dpe-head"><div><h2>Equipment</h2><p>Track each piece and run the shift checklist.</p></div>' +
        (canManage ? '<button class="dpe-add" data-act="equipment-add" data-owner-unit="' + unitId + '" aria-label="Add equipment">' + I('plus', 20) + '</button>' : '') + '</div>' +
      '<div class="dpe-seg" role="tablist" aria-label="Filter equipment">' + [['all', 'All', rows.length], ['ready', 'Ready', ready], ['due', 'Check due', overdue]].map((x) =>
        '<button role="tab" aria-selected="' + (f === x[0]) + '" class="' + (f === x[0] ? 'is-on' : '') + (x[0] === 'due' && x[2] ? ' is-warn' : '') + '" data-act="dispatch-eqf" data-v="' + x[0] + '">' +
          '<span>' + x[1] + '</span><i>' + x[2] + '</i></button>').join('') + '</div>' +
      (shown.length ? '<div class="dpe-list">' + shown.map(card).join('') + '</div>'
        : '<div class="dpm-empty">' + I('check', 28) + '<b>' + (f === 'due' ? 'Every check is up to date' : 'Nothing here') + '</b><p>' + (f === 'due' ? 'All equipment was checked in the last 24 hours.' : 'Try another filter.') + '</p></div>') +
      (state.data.unit && state.data.unit.unit_type === 'Hospital' ? '<button class="dpm-ghost" data-act="dispatch-nav" data-route="hospital">' + I('shelter', 15) + 'Hospital capacity</button>' : '') +
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
        '<div class="ug-dimmer" style="font-size:11px">' + esc(p.role || '') + '</div></td>' +
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
      '<tbody>' + (notices.length ? notices.map(noticeRow).join('') : '<tr><td colspan="5" class="dp-none">No incoming-patient notices</td></tr>') + '</tbody></table></div>' +
    '</div>';
  }

  /* support request kinds (DB values stay; labels / icons / hints for people) */
  const RQ_KINDS = [['fuel', 'Fuel', 'bolt', 'Refuel a vehicle or generator'], ['personnel', 'Personnel', 'users', 'Extra hands on scene'],
    ['equipment', 'Equipment', 'shield', 'Gear you are missing'], ['mutual_aid', 'Mutual aid', 'truck', 'Another unit to back you up'],
    ['other', 'Other', 'help', 'Anything else']];
  const RQ_STATE = { pending: ['Waiting for the LGU', 'is-wait'], approved: ['Approved · help is coming', 'is-ok'], declined: ['Declined', 'is-no'], done: ['Fulfilled', 'is-done'] };

  function canCompleteRequest(row, session) {
    return row.status === 'approved' && session?.role === 'dispatch_team' &&
      session.unit_role === 'unit_admin' && row.unit_id === session.dispatch_unit_id;
  }

  function completeRequestButton(row, session) {
    return canCompleteRequest(row, session)
      ? '<button type="button" class="ug-btn ug-btn--sm" data-act="dispatch-request-done" data-id="' +
        esc(row.id) + '">' + I('check', 14) + 'Mark done</button>'
      : '';
  }

  /* phones: quick-request tiles, Open / History, plain-language cards */
  function mRequests(st) {
    const rows = (state.data.requests || []).slice().sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
    const open = rows.filter((r) => r.status === 'pending' || r.status === 'approved');
    const past = rows.filter((r) => !(r.status === 'pending' || r.status === 'approved'));
    const tab = state.rqTab === 'past' ? 'past' : 'open';
    const shown = tab === 'past' ? past : open;
    const kindOf = (k) => RQ_KINDS.find((x) => x[0] === k) || RQ_KINDS[4];
    const card = (r) => {
      const k = kindOf(r.kind), stt = RQ_STATE[r.status] || [r.status || '', ''];
      return '<article class="dpq-card">' +
        '<div class="dpq-h"><span class="dpq-ico" aria-hidden="true">' + I(k[2], 20) + '</span>' +
          '<div class="dpq-t"><b>' + esc(k[1]) + '</b><small>Sent ' + esc(ago(r.created_at)) + '</small></div></div>' +
        '<p class="dpq-st ' + stt[1] + '"><i></i>' + esc(stt[0]) + '</p>' +
        (r.details ? '<p class="dpq-d">' + esc(r.details) + '</p>' : '') +
        (r.decided_at ? '<p class="dpq-f">Decided ' + esc(absTime(r.decided_at)) + '</p>' : '') +
        completeRequestButton(r, st.session) +
      '</article>';
    };
    return '<div class="dpq">' +
      '<div class="dpe-head"><div><h2>Support requests</h2><p>Ask the LGU for fuel, people, gear or another unit.</p></div>' +
        '<button class="dpe-add" data-act="dispatch-request-new" aria-label="New request">' + I('plus', 20) + '</button></div>' +
      '<section class="dpq-quick"><p class="dpq-k">What do you need?</p><div class="dpq-tiles">' + RQ_KINDS.map((k) =>
        '<button data-act="dispatch-request-new" data-kind="' + k[0] + '">' + I(k[2], 26) + '<b>' + esc(k[1]) + '</b><small>' + esc(k[3]) + '</small></button>').join('') + '</div></section>' +
      '<div class="dpe-seg dpq-seg" role="tablist" aria-label="Requests">' + [['open', 'Open', open.length], ['past', 'History', past.length]].map((t) =>
        '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'is-on' : '') + '" data-act="dispatch-rqtab" data-v="' + t[0] + '"><span>' + t[1] + '</span><i>' + t[2] + '</i></button>').join('') + '</div>' +
      (shown.length ? '<div class="dpq-list">' + shown.map(card).join('') + '</div>'
        : '<div class="dpm-empty">' + I(tab === 'past' ? 'inbox' : 'check', 28) + '<b>' + (tab === 'past' ? 'No past requests' : 'No open requests') + '</b><p>' +
            (tab === 'past' ? 'Approved, declined and fulfilled requests appear here.' : 'Tap what you need above and the LGU is told right away.') + '</p></div>') +
    '</div>';
  }

  function sRequests(st) {
    if (state.loading) return pageHead(T('title.requests'), '') + statePanel('loading');
    if (state.error)   return pageHead(T('title.requests'), '') + statePanel('error', T('toast.couldNotLoad'), state.error);
    if (isPhone()) return mRequests(st);
    const rows = state.data.requests || [];
    const open = rows.filter((r) => r.status === 'pending' || r.status === 'approved');
    const row = (r) => '<tr>' +
      '<td class="t-num">' + absTime(r.created_at) + '</td>' +
      '<td><span class="ug-badge ug-badge--id">' + esc(r.kind) + '</span></td>' +
      '<td>' + esc(r.details) + '</td>' +
      '<td>' + badge(r.status, r.status) + '</td>' +
      '<td class="t-num">' + (r.decided_at ? absTime(r.decided_at) : '—') + '</td>' +
      '<td class="t-right">' + completeRequestButton(r, st.session) + '</td>' +
    '</tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.requests'), T('dispatch.requestsSub'),
        '<button class="ug-btn ug-btn--signal ug-btn--sm" data-act="dispatch-request-new">' + I('plus', 14) + 'New request</button>') +
      (open.length ? '<span class="ug-chip is-on">' + open.length + ' open</span>' : '') +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>When</th><th>Kind</th><th>Details</th><th>Status</th><th>Decided</th><th>Action</th></tr></thead>' +
      '<tbody>' + (rows.length ? rows.map(row).join('') : '<tr><td colspan="6" class="dp-none">No requests yet</td></tr>') + '</tbody></table></div>' +
    '</div>';
  }

  function sAnalytics(st) {
    const dispatches = state.data.dispatches || [];
    if (!dispatches.length) return pageHead(T('title.unitAnalytics'), '') + emptyState('layers', T('dispatch.noAnalyticsYet'), T('dispatch.noAnalyticsHint'));
    const acks = dispatches.filter((d) => d.ack_at).length;
    /* average only over dispatches that have both times (others made it NaN) */
    const avgAck = acks ? (dispatches.filter((d) => d.ack_at && d.dispatched_at).reduce((s, d) => s + (Date.parse(d.ack_at) - Date.parse(d.dispatched_at)) / 60000, 0) / acks).toFixed(1) : '—';
    const scenes = dispatches.filter((d) => d.on_scene_at && d.ack_at).length;
    const avgScene = scenes ? (dispatches.filter((d) => d.on_scene_at && d.ack_at).reduce((s, d) => s + (Date.parse(d.on_scene_at) - Date.parse(d.ack_at)) / 60000, 0) / scenes).toFixed(1) : '—';
    const done = dispatches.filter((d) => d.dispatch_status === 'done').length;
    const month = dispatches.filter((d) => {
      const m = new Date(); return new Date(d.dispatched_at).getMonth() === m.getMonth() && new Date(d.dispatched_at).getFullYear() === m.getFullYear();
    }).length;
    if (isPhone()) return mAnalytics(dispatches, { acks, avgAck, scenes, avgScene, done, month });
    /* Layout (Nov 2026): five even figure cards, then each dispatch with how
       long it took to acknowledge and reach the scene (minutes, not dates). */
    const mins = (a, b) => (a && b) ? Math.max(0, (Date.parse(b) - Date.parse(a)) / 60000) : null;
    const fmtMin = (m) => m == null ? '—' : m < 1 ? '<1 min' : m < 60 ? Math.round(m) + ' min' : (m / 60).toFixed(1) + ' h';
    const fig = (icon, label, value, sub) => '<div class="ua-fig"><span class="ua-fig-i">' + I(icon, 15) + '</span><p>' + esc(label) + '</p><b>' + value + '</b><small>' + esc(sub) + '</small></div>';
    const ST = { done: 'Done', sent: 'New', acknowledged: 'Acknowledged', en_route: 'En route', on_scene: 'On scene', declined: 'Declined', fire_out: 'Fire out', arrived_hospital: 'At hospital' };
    const row = (d) => {
      const r = d.report || {};
      const st = d.dispatch_status || 'sent';
      return '<tr>' +
        '<td><b>' + esc(absTime(d.dispatched_at) || '—') + '</b><small>' + esc(ago(d.dispatched_at) || '') + '</small></td>' +
        '<td>' + (r.code ? '<span class="ua-code">' + esc(r.code) + '</span>' : '<span class="ua-none">—</span>') + (r.hazard_type ? '<small>' + esc(r.hazard_type) + '</small>' : '') + '</td>' +
        '<td>' + (r.barangay ? esc(r.barangay) : '<span class="ua-none">—</span>') + '</td>' +
        '<td><span class="ua-st is-' + esc(st) + '"><i></i>' + esc(ST[st] || st.replace(/_/g, ' ')) + '</span></td>' +
        '<td class="ua-n">' + fmtMin(mins(d.dispatched_at, d.ack_at)) + '</td>' +
        '<td class="ua-n">' + fmtMin(mins(d.ack_at, d.on_scene_at)) + '</td>' +
      '</tr>';
    };
    return '<div class="ug-col ua" style="gap:20px">' +
      pageHead(T('title.unitAnalytics'), T('dispatch.analyticsSub'),
        '<button class="hl-ghost" data-act="dispatch-csv">' + I('download', 14) + 'Export CSV</button>') +
      '<div class="ua-figs">' +
        fig('truck', 'Total dispatches', String(dispatches.length), 'all time') +
        fig('clock', 'This month', String(month), new Date().toLocaleDateString([], { month: 'long' })) +
        fig('check', 'Avg to acknowledge', avgAck === '—' ? '—' : avgAck + '<em> min</em>', acks + ' acknowledged') +
        fig('pin', 'Avg to scene', avgScene === '—' ? '—' : avgScene + '<em> min</em>', 'after acknowledging') +
        fig('shield', 'Completed', String(done), dispatches.length ? Math.round(done / dispatches.length * 100) + '% of dispatches' : '—') +
      '</div>' +
      '<section class="rl-card"><div class="rl-ch"><h2>' + I('layers', 15) + 'Dispatch history</h2><div class="rl-ch-r"><span class="rl-count">' + dispatches.length + ' dispatch' + (dispatches.length === 1 ? '' : 'es') + '</span></div></div>' +
        '<div class="rl-tablewrap"><table class="rl-table ua-table"><thead><tr><th>Dispatched</th><th>Incident</th><th>Barangay</th><th>Status</th><th class="ua-n">To acknowledge</th><th class="ua-n">To scene</th></tr></thead>' +
        '<tbody>' + dispatches.slice(0, 30).map(row).join('') + '</tbody></table></div>' +
        (dispatches.length > 30 ? '<p class="rp-more">Showing the latest 30. Export CSV for the full list.</p>' : '') +
      '</section></div>';
  }

  /* phones: an orange "this month" card, response-speed cards, a completion
     bar and the history as cards (same numbers as desktop) */
  function mAnalytics(list, m) {
    const mins = (a, b) => (a && b) ? Math.max(0, (Date.parse(b) - Date.parse(a)) / 60000) : null;
    const fmt = (v) => v == null ? '—' : v < 1 ? '<1 min' : v < 60 ? Math.round(v) + ' min' : (v / 60).toFixed(1) + ' h';
    const pct = list.length ? Math.round(m.done / list.length * 100) : 0;
    const monthName = new Date().toLocaleDateString([], { month: 'long' });
    const sorted = list.slice().sort((a, b) => Date.parse(b.dispatched_at || 0) - Date.parse(a.dispatched_at || 0));
    const big = (v) => { const n = parseFloat(v); if (!isFinite(n)) return '—';
      return n < 1 ? '&lt;1<em> min</em>' : n < 60 ? Math.round(n) + '<em> min</em>' : (n / 60).toFixed(1) + '<em> h</em>'; };
    const speed = (icon, label, val, sub) => '<div class="dpa-speed">' + I(icon, 18) + '<small>' + esc(label) + '</small>' +
      '<b>' + big(val) + '</b><span>' + esc(sub) + '</span></div>';
    const row = (d) => {
      const stt = d.dispatch_status || 'sent', inf = dInfo(d);
      const a = mins(d.dispatched_at, d.ack_at), sc = mins(d.ack_at, d.on_scene_at);
      return '<button class="dpa-row" data-act="dispatch-open" data-id="' + esc(d.id) + '">' +
        '<span class="dpa-row-i" aria-hidden="true">' + I(inf.icon, 20) + '</span>' +
        '<span class="dpa-row-m"><b>' + esc(inf.name) + '</b>' +
          '<small>' + esc([inf.code, inf.brgy ? 'Brgy. ' + inf.brgy : '', ago({ created_at: d.dispatched_at })].filter(Boolean).join(' · ')) + '</small>' +
          '<span class="dpa-chips"><i>Ack ' + esc(fmt(a)) + '</i><i>Scene ' + esc(fmt(sc)) + '</i></span></span>' +
        '<span class="dpm-st is-' + esc(stt) + ' dpa-st">' + esc(STEP_WORD[stt] || stt) + '</span></button>';
    };
    return '<div class="dpa">' +
      '<div class="dpe-head"><div><h2>Unit analytics</h2><p>How fast and how often your unit responds.</p></div>' +
        '<button class="dpa-x" data-act="dispatch-csv" aria-label="Export CSV">' + I('download', 18) + '</button></div>' +
      '<section class="dpa-hero"><div><small>' + esc(monthName) + '</small><b>' + m.month + '</b><span>dispatch' + (m.month === 1 ? '' : 'es') + ' this month</span></div>' +
        '<div class="dpa-hero-r"><b>' + list.length + '</b><span>all time</span></div>' +
        '<span class="dpa-hero-i" aria-hidden="true">' + I('truck', 110) + '</span></section>' +
      '<div class="dpa-speeds">' +
        speed('check', 'To acknowledge', String(m.avgAck), m.acks + ' acknowledged') +
        speed('pin', 'To reach the scene', String(m.avgScene), m.scenes + ' arrivals') +
      '</div>' +
      '<section class="dpa-done"><div class="dpa-done-h"><b>Completed</b><span>' + m.done + ' of ' + list.length + ' · ' + pct + '%</span></div>' +
        '<div class="dpa-bar"><i style="width:' + pct + '%"></i></div></section>' +
      '<section class="dpm-sec"><div class="dpm-sec-h"><h3>Dispatch history</h3></div>' +
        '<div class="dpa-list">' + sorted.slice(0, 15).map(row).join('') + '</div>' +
        (sorted.length > 15 ? '<p class="dpa-more">Showing the latest 15. Export for the full list.</p>' : '') +
      '</section>' +
    '</div>';
  }

  function sContacts(st) {
    const dir = state.data.directory || {};
    const hotlines = dir.hotlines || [];
    const captains = dir.captains || [];
    if (isPhone()) return mContacts(st, hotlines, captains);
    const callLink = (num) => '<a class="ug-btn ug-btn--sm ug-btn--signal" href="tel:' + esc(String(num).replace(/[^+\d]/g, '')) + '">' + I('phone', 13) + esc(T('action.call')) + '</a>';
    const row = (h) => '<tr><td><div style="font-weight:600">' + esc(h.agency_name) + '</div>' +
      '<div class="ug-dimmer" style="font-size:11px">' + esc(h.scope || '') + '</div></td>' +
      '<td>' + esc(h.category || 'Other') + '</td>' +
      '<td class="t-num">' + esc(h.contact_number) + '</td>' +
      '<td class="t-right">' + callLink(h.contact_number) + '</td></tr>';
    const cRow = (c) => '<tr><td><div style="font-weight:600">' + esc(c.captain_name || '(unassigned)') + '</div>' +
      '<div class="ug-dimmer" style="font-size:11px">Brgy Captain · ' + esc(c.name) + '</div></td>' +
      '<td class="t-num">' + esc(c.captain_phone || '—') + '</td>' +
      '<td class="t-right">' + (c.captain_phone ? callLink(c.captain_phone) : '') + '</td></tr>';
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.contacts'), T('dispatch.directorySub')) +
      '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Agency</th><th>Category</th><th>Number</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + (hotlines.length ? hotlines.map(row).join('') : '<tr><td colspan="4" class="dp-none">No hotlines on file yet</td></tr>') + '</tbody></table></div>' +
      (captains.length ? '<div class="ug-card" style="overflow:hidden"><table class="ug-table">' +
      '<thead><tr><th>Barangay captain</th><th>Phone</th><th class="t-right">Action</th></tr></thead>' +
      '<tbody>' + captains.map(cRow).join('') + '</tbody></table></div>' : '') +
    '</div>';
  }

  /* phones: search, Hotlines / Captains, rows with a round call button */
  function mContacts(st, hotlines, captains) {
    const tab = state.dirTab === 'captains' && captains.length ? 'captains' : 'hotlines';
    const q = String(st.dpDirQ || '').trim().toLowerCase();
    const hit = (vals) => !q || vals.some((v) => String(v || '').toLowerCase().indexOf(q) >= 0);
    const tel = (n) => 'tel:' + String(n || '').replace(/[^+\d]/g, '');
    const call = (num, who) => num
      ? '<a class="dpd-call" href="' + esc(tel(num)) + '" aria-label="Call ' + esc(who) + '">' + I('phone', 17) + '</a>'
      : '<span class="dpd-none">No number</span>';
    /* the filter: hotline category, or whether a captain has a number */
    const cats = hotlines.reduce((m, h) => { const k = h.category || 'Other'; m[k] = (m[k] || 0) + 1; return m; }, {});
    const hf = state.dirCat && (state.dirCat === 'all' || cats[state.dirCat]) ? state.dirCat : 'all';
    const cf = ['all', 'with', 'without'].indexOf(state.dirCap) >= 0 ? state.dirCap : 'all';
    const hRows = hotlines.filter((h) => (hf === 'all' || (h.category || 'Other') === hf) && hit([h.agency_name, h.category, h.scope, h.contact_number]));
    const cRows = captains.filter((c) => (cf === 'all' || (cf === 'with' ? !!c.captain_phone : !c.captain_phone)) && hit([c.captain_name, c.name, c.captain_phone]));
    const opts = tab === 'captains'
      ? [['all', 'All', captains.length], ['with', 'Has a number', captains.filter((c) => c.captain_phone).length], ['without', 'No number', captains.filter((c) => !c.captain_phone).length]]
      : [['all', 'All', hotlines.length]].concat(Object.keys(cats).sort().map((k) => [k, k, cats[k]]));
    const curV = tab === 'captains' ? cf : hf;
    const cur = opts.find((o) => o[0] === curV) || opts[0];
    const filter = '<div class="ug-wmore dpd-dd"><button class="dpd-dd-btn' + (curV !== 'all' ? ' is-set' : '') + '" data-act="toggle-more" aria-haspopup="listbox" aria-label="Filter">' +
        I('sort', 15) + '<span>' + esc(cur[1]) + '</span>' + I('chevdn', 14) + '</button>' +
      '<div class="dpd-dd-panel" data-more-panel hidden role="listbox">' + opts.map((o) =>
        '<button role="option" class="' + (o[0] === curV ? 'is-on' : '') + '" data-act="dispatch-dirf" data-v="' + esc(o[0]) + '">' +
          '<span>' + esc(o[0] === 'all' ? (tab === 'captains' ? 'All captains' : 'All categories') : o[1]) + '</span><b>' + o[2] + '</b>' + (o[0] === curV ? I('check', 14) : '') + '</button>').join('') +
      '</div></div>';
    const list = tab === 'captains'
      ? cRows.map((c) => '<div class="dpd-row"><div class="dpd-m"><b>' + esc(c.captain_name || 'No captain on file') + '</b>' +
          '<small>Brgy. ' + esc(c.name || '') + '</small>' + (c.captain_phone ? '<span class="dpd-num">' + esc(c.captain_phone) + '</span>' : '') + '</div>' +
          call(c.captain_phone, c.captain_name || ('Brgy. ' + c.name)) + '</div>').join('')
      : hRows.map((h) => '<div class="dpd-row"><div class="dpd-m"><b>' + esc(h.agency_name) + '</b>' +
          '<small>' + esc([h.category || '', h.scope || ''].filter(Boolean).join(' · ') || 'Hotline') + '</small>' +
          '<span class="dpd-num">' + esc(h.contact_number || '') + '</span></div>' + call(h.contact_number, h.agency_name) + '</div>').join('');
    const n = tab === 'captains' ? cRows.length : hRows.length;
    return '<div class="dpd">' +
      '<div class="dpe-head"><div><h2>Directory</h2><p>Hotlines and barangay captains, one tap to call.</p></div></div>' +
      '<div class="dpd-tool">' + filter +
        '<label class="dpd-search">' + I('search', 16) + '<input data-field="rw.dpDirQ" value="' + esc(st.dpDirQ || '') + '" placeholder="Search" aria-label="Search name, number or barangay"></label></div>' +
      (captains.length ? '<div class="dpe-seg dpd-seg" role="tablist" aria-label="Directory">' + [['hotlines', 'Hotlines', hRows.length], ['captains', 'Captains', cRows.length]].map((t) =>
        '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'is-on' : '') + '" data-act="dispatch-dirtab" data-v="' + t[0] + '"><span>' + t[1] + '</span><i>' + t[2] + '</i></button>').join('') + '</div>' : '') +
      (n ? '<div class="dpd-list">' + list + '</div>'
        : '<div class="dpm-empty">' + I(q ? 'search' : 'phone', 26) + '<b>' + (q || curV !== 'all' ? 'No match' : tab === 'captains' ? 'No captains on file yet' : 'No hotlines on file yet') + '</b>' +
            (q || curV !== 'all' ? '<p>Try another filter or search.</p>' : '') + '</div>') +
    '</div>';
  }

  /* Settings (Nov 2026): the dispatch portal had none. Phone alerts, the
     alarm, location sharing (the status follows it), language, the account
     and data, each in its own card. Same layout on desktop and phone. */
  function sSettings(st) {
    const session = st.session || {};
    const unit = state.data.unit;
    const U8 = typeof UG_SETTINGS !== 'undefined' ? UG_SETTINGS : null;
    const fil = typeof UG_I18N !== 'undefined' && UG_I18N.isFil && UG_I18N.isFil();
    const LOC = {
      on: ['Sharing your location', 'is-ok', 'Your location can update the accepted assignment to En route or On scene.'],
      searching: ['Finding your location…', 'is-wait', 'Keep this page open while the phone gets a GPS fix.'],
      starting: ['Starting…', 'is-wait', 'Allow location access when the browser asks.'],
      denied: ['Location is blocked', 'is-no', 'Allow location for this site in your browser settings, then tap Share my location again.'],
      unsupported: ['Not available on this device', 'is-no', 'This browser cannot share its location.'],
      off: ['Not sharing', '', 'Share your location when you take a dispatch so the LGU sees you on the map and your status updates by itself.']
    }[track.status] || ['Not sharing', '', ''];
    const sharing = track.status === 'on' || track.status === 'searching' || track.status === 'starting';
    const card = (title, inner, sub) => '<section class="dps-card"><header><h3>' + esc(title) + '</h3>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</header>' + inner + '</section>';
    const account = '<section class="dps-card dps-me"><span class="dps-av">' + esc(((session.name || '?').trim().charAt(0) || '?').toUpperCase()) + '</span>' +
        '<div><b>' + esc(session.name || 'Responder') + '</b><small>' + esc(session.email || '') + '</small>' +
          '<span class="dps-tags"><i>' + esc(unit ? unit.name : 'No unit linked') + '</i>' + (unit ? '<i>' + esc(unitTypeLabel(unit.unit_type)) + '</i>' : '') +
          '<i>' + esc(session.unit_role === 'unit_admin' || ['unit_admin', 'admin'].includes(session.unit_role) ? 'Unit administrator' : 'Responder') + '</i></span></div></section>';
    const location = card('Location sharing',
      '<p class="dps-st ' + LOC[1] + '"><i></i>' + esc(LOC[0]) + '</p><p class="dps-help">' + esc(LOC[2]) + '</p>' +
      (sharing ? '' : '<button class="dps-btn" data-act="dispatch-track-start">' + I('target', 15) + 'Share my location</button>'));
    const language = card('Language',
      '<div class="dps-seg" role="radiogroup" aria-label="Language">' + [['en', 'English', 'EN'], ['fil', 'Filipino', 'FIL']].map((l) => {
        const on = (l[0] === 'fil') === !!fil;
        return '<button role="radio" aria-checked="' + on + '" class="' + (on ? 'is-on' : '') + '" data-act="lang-ui" data-v="' + l[0] + '"><em>' + l[2] + '</em>' + l[1] + '</button>';
      }).join('') + '</div>', 'Changes the whole portal right away, for your account only.');
    const data = card('Data',
      '<dl class="dps-kv"><div><dt>Last updated</dt><dd>' + esc(state.lastSync ? ago(state.lastSync) : 'Not yet') + '</dd></div>' +
        '<div><dt>Connection</dt><dd>' + (typeof navigator !== 'undefined' && navigator.onLine === false ? 'Offline' : 'Online') + '</dd></div>' +
        '<div><dt>App version</dt><dd>' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</dd></div></dl>' +
      '<button class="dps-btn dps-btn--soft" data-act="dispatch-refresh">' + I('wave', 15) + 'Refresh now</button>');
    return '<div class="dps">' +
      '<div class="dpe-head"><div><h2>Settings</h2><p>For this phone and your account.</p></div></div>' +
      account +
      '<div class="dps-cols"><div class="dps-col">' +
        (U8 && U8.alertsCard ? '<div class="dps-wrap dpn-alarm">' + U8.alertsCard() + '</div>' : '') +
        (U8 && U8.alarmCard ? '<div class="dps-wrap dpn-alarm">' + U8.alarmCard(st) + '</div>' : '') +
      '</div><div class="dps-col">' + location + language + data +
        '<button class="dps-out" data-act="logout">' + I('logout', 16) + 'Sign out</button>' +
      '</div></div>' +
    '</div>';
  }

  /* phones: a notification feed (New / Earlier), All / Unread, a round
     "mark all read", tap a row to open its dispatch; the alarm card below */
  function mNotifications(st, rows, alarm) {
    const unread = rows.filter((n) => !n.read_at).length;
    const f = state.ntF === 'unread' ? 'unread' : 'all';
    const list = rows.filter((n) => f === 'all' || !n.read_at).slice().sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
    const icon = (n) => { const t = ((n.type || '') + ' ' + (n.title || '')).toLowerCase();
      return /sos/.test(t) ? 'sos' : /dispatch|team|re-sent|unit/.test(t) ? 'truck' : /request|help/.test(t) ? 'inbox' : /advisory|warning/.test(t) ? 'alert' : 'bell'; };
    const tone = (n) => n.tone === 'emergency' ? ' is-em' : n.tone === 'warning' ? ' is-warn' : '';
    const row = (n) => '<button class="dpn-row' + (n.read_at ? '' : ' is-new') + '" data-act="dispatch-notif-open" data-id="' + esc(n.id) + '" data-report="' + esc(n.report_id || '') + '">' +
        '<span class="dpn-ico' + tone(n) + '" aria-hidden="true">' + I(icon(n), 18) + '</span>' +
        '<span class="dpn-m"><b>' + esc(n.title || 'Notification') + '</b>' + (n.body ? '<span>' + esc(n.body) + '</span>' : '') +
          '<small>' + esc(ago(n.created_at)) + '</small></span>' +
        (n.read_at ? '' : '<i class="dpn-dot" aria-label="Unread"></i>') + '</button>';
    const day = 86400000, now = Date.now();
    const fresh = list.filter((n) => now - Date.parse(n.created_at || 0) < day), older = list.filter((n) => now - Date.parse(n.created_at || 0) >= day);
    const group = (title, xs) => xs.length ? '<p class="dpn-g">' + title + '</p><div class="dpn-list">' + xs.map(row).join('') + '</div>' : '';
    return '<div class="dpn">' +
      '<div class="dpe-head"><div><h2>Notifications</h2><p>' + (unread ? unread + ' unread' : 'You are all caught up') + '</p></div>' +
        '<button class="dpa-x dpn-all' + (unread ? ' is-on' : '') + '" data-act="dispatch-notif-read-all"' + (unread ? '' : ' disabled') + ' aria-label="Mark all as read" title="Mark all as read">' + I('check', 18) + '</button></div>' +
      '<div class="dpe-seg dpq-seg" role="tablist" aria-label="Notifications">' + [['all', 'All', rows.length], ['unread', 'Unread', unread]].map((t) =>
        '<button role="tab" aria-selected="' + (f === t[0]) + '" class="' + (f === t[0] ? 'is-on' : '') + '" data-act="dispatch-ntf" data-v="' + t[0] + '"><span>' + t[1] + '</span><i>' + t[2] + '</i></button>').join('') + '</div>' +
      (list.length ? group('New', fresh) + group('Earlier', older)
        : '<div class="dpm-empty">' + I('check', 26) + '<b>' + (f === 'unread' ? 'No unread notifications' : 'No notifications yet') + '</b>' +
            (f === 'unread' ? '' : '<p>New dispatches and updates for your unit appear here.</p>') + '</div>') +
      (alarm ? '<div class="dpn-alarm">' + alarm + '</div>' : '') +
    '</div>';
  }

  function sNotifications(st) {
    const rows = state.data.notifications || [];
    /* the unit's alarm on/off + test (the dispatch portal has no Settings) */
    const pushCard = (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.alertsCard) ? UG_SETTINGS.alertsCard() : '';
    const alarm = pushCard + ((typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.alarmCard) ? UG_SETTINGS.alarmCard(st) : '');
    if (isPhone()) return mNotifications(st, rows, alarm);
    if (!rows.length) return pageHead(T('title.notifications'), '') + alarm + emptyState('bell', T('dispatch.noNotifications'), T('dispatch.noNotificationsHint'));
    const row = (n) => '<tr>' +
      '<td class="t-num">' + absTime(n.created_at) + '</td>' +
      /* tappable: opens the dispatch for this report and marks it read */
      '<td><button class="ug-link-btn" style="background:none;border:0;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer;font-weight:600"' +
        ' data-act="dispatch-notif-open" data-id="' + esc(n.id) + '" data-report="' + esc(n.report_id || '') + '">' + esc(n.title) +
        (n.report_id ? ' <span style="color:var(--ug-signal)">›</span>' : '') + '</button></td>' +
      '<td class="ug-dim" style="font-size:12px">' + esc(n.body) + '</td>' +
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
  /* the dispatch console in the look of the React build (uniguard/src/
     components/DispatchPortal.tsx): an orange rail of section icons on the
     left, the clock and the unit summary on top, then the section. Every
     section, action and query is this module's own. css/dispatch-portal.css */
  /* The rail opens on hover; picking a section closes it at once, and it
     stays closed until the pointer leaves the rail (the page re-renders on
     navigation, so the flag lives here, outside the DOM). */
  let railShut = false;
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.dp-rail button');
    if (!b) return;
    railShut = true;
    const r = b.closest('.dp-rail'); if (r) r.classList.add('is-shut');
    try { b.blur(); } catch (err) { }
  }, true);
  document.addEventListener('mouseout', (e) => {
    const r = e.target.closest && e.target.closest('.dp-rail');
    if (!r || (e.relatedTarget && r.contains(e.relatedTarget))) return;
    railShut = false;
    document.querySelectorAll('.dp-rail.is-shut').forEach((x) => x.classList.remove('is-shut'));
  });

  /* ---------------------------------------------------- phone layout (Nov 2026)
     Inspired by a food-delivery app: a greeting card, an orange "new
     dispatch" banner, the dispatches as order cards with Active / Completed,
     quick-access tiles and a bottom bar. Same data and actions as desktop. */
  const isPhone = () => !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
  const OPEN_ST = (d) => d.dispatch_status !== 'done' && d.dispatch_status !== 'declined';
  const STEP_WORD = { sent: 'Waiting for you', acknowledged: 'Acknowledged', en_route: 'On the way', on_scene: 'On scene',
    under_control: 'Under control', fire_out: 'Fire out', on_hold: 'On hold', transporting: 'Transporting',
    arrived_hospital: 'At the hospital', done: 'Done', declined: 'Declined' };
  const hazardIcon = (h) => { try { return (UG_HAZARDS.classify(h).icon) || 'alert'; } catch (e) { return 'alert'; } };
  const hazardName = (h) => { try { return UG_HAZARDS.displayLabel(h) || h || 'Incident'; } catch (e) { return h || 'Incident'; } };
  const etaMins = (d) => d.eta ? Math.round((Date.parse(d.eta) - Date.now()) / 60000) : null;
  /* what a dispatch is about. The linked report may be missing (an SOS
     auto-dispatch, or a report outside what the unit can read), so fall back
     to the instructions ("Respond to Fire (emergency) in Maniboc. …"), then
     to the team. Never "Others" when the dispatch itself says what it is. */
  const TEAM_HZ = { BFP: 'Fire', Ambulance: 'Medical emergency', PNP: 'Police response', 'Rescue Unit': 'Rescue', 'MDRRMO Rescue': 'Rescue', 'Barangay Response Team': 'Barangay response' };
  function dInfo(d) {
    const r = d.report || {}, ins = String(d.instructions || '');
    let name = r.hazard_type ? hazardName(r.hazard_type) : '';
    if (!name || /^others?$/i.test(name)) {
      const mm = /respond to\s+([^(.,]+?)\s*(?:\(|\bin\b|[.,]|$)/i.exec(ins);
      name = (mm && mm[1].trim()) || TEAM_HZ[d.team] || name || 'Dispatch';
    }
    let icon = r.hazard_type ? hazardIcon(r.hazard_type) : hazardIcon(name);
    if (icon === 'help' || icon === 'alert') icon = /fire/i.test(name) ? 'flame' : /flood|rescue/i.test(name) ? 'flood' : /medic/i.test(name) ? 'plus' : /police|crime/i.test(name) ? 'shield' : 'truck';
    const bm = /\bin\s+([A-Z][\w .'-]*?)(?:\.|,|\s+SOS|$)/.exec(ins);
    const brgy = r.barangay || (bm ? bm[1].trim() : '');
    const sev = r.severity || ((/\(emergency\)/i.test(ins)) ? 'emergency' : (/\(warning\)/i.test(ins)) ? 'warning' : '');
    return { name: name, icon: icon, brgy: brgy, sev: sev, code: r.code || '' };
  }

  function mHome(st) {
    const session = st.session || {};
    const unit = state.data.unit;
    const list = (state.data.dispatches || []).slice().sort((a, b) => Date.parse(b.dispatched_at || 0) - Date.parse(a.dispatched_at || 0));
    const open = list.filter(OPEN_ST), closed = list.filter((d) => !OPEN_ST(d));
    const waiting = open.filter((d) => d.dispatch_status === 'sent');
    const crew = state.data.personnel || [], gear = state.data.equipment || [];
    const onDuty = crew.filter((p) => p.on_duty).length;
    const overdue = gear.filter((r) => !r.last_checked_at || (Date.now() - Date.parse(r.last_checked_at)) > 86400000).length;
    const fullName = String(session.name || 'Responder').trim();
    const initial = esc((fullName.charAt(0) || '?').toUpperCase());
    const tab = state.mTab === 'done' ? 'done' : 'active';
    const shown = tab === 'done' ? closed : open;
    const sharing = track.status === 'on' || track.status === 'searching' || track.status === 'starting';

    const greet = '<section class="dpm-hi">' +
        '<div class="dpm-hi-top"><span class="dpm-av">' + initial + '</span><div><b>' + esc(fullName) + '</b><small>' + esc(['unit_admin', 'admin'].includes(session.unit_role) ? 'Unit administrator' : 'Responder') + '</small></div>' +
          '<span class="dpm-duty' + (onDuty ? ' is-on' : '') + '"><i></i>' + onDuty + ' on duty</span></div>' +
        '<p class="dpm-k">Your unit</p>' +
        '<div class="dpm-unit">' + I('truck', 16) + '<span><b>' + esc(unit ? unit.name : 'Dispatch team') + '</b><small>' + esc(unit ? unitTypeLabel(unit.unit_type) : (session.title || '')) + '</small></span></div>' +
        '<button class="dpm-ghost" data-act="dispatch-track-start">' + I('target', 15) + (sharing ? 'Sharing my location' : 'Share my location') + '</button>' +
      '</section>';

    const nd = waiting[0], nr = nd ? (nd.report || {}) : null, ni = nd ? dInfo(nd) : null;
    const banner = nd
      ? '<button class="dpm-promo" data-act="dispatch-open" data-id="' + esc(nd.id) + '">' +
          '<span class="dpm-promo-t"><small>New dispatch' + (waiting.length > 1 ? ' · ' + waiting.length + ' waiting' : '') + '</small>' +
            '<b>' + esc(ni.name) + '</b><em>' + esc((ni.brgy ? 'Brgy. ' + ni.brgy + ' · ' : '') + ago({ created_at: nd.dispatched_at })) + '</em>' +
            '<span class="dpm-promo-go">Open and acknowledge' + I('chevron', 14) + '</span></span>' +
          '<span class="dpm-promo-i" aria-hidden="true">' + I(ni.icon, 84) + '</span></button>'
      : '<div class="dpm-promo is-calm"><span class="dpm-promo-t"><small>All clear</small><b>No new dispatch</b><em>You will hear an alarm the moment one arrives.</em></span>' +
          '<span class="dpm-promo-i" aria-hidden="true">' + I('check', 72) + '</span></div>';

    const figs = '<div class="dpm-figs">' + [['Active', open.length, 'dispatch'], ['On duty', onDuty + '/' + crew.length, 'roster'], ['Checks due', overdue, 'equipment']].map((f) =>
        '<button data-act="dispatch-nav" data-route="' + f[2] + '"><b>' + f[1] + '</b><span>' + f[0] + '</span></button>').join('') + '</div>';

    const order = (d) => {
      const r = d.report || {}, stt = d.dispatch_status, m = etaMins(d), isOpen = OPEN_ST(d), inf = dInfo(d);
      return '<article class="dpm-order">' +
        '<button class="dpm-order-h" data-act="dispatch-open" data-id="' + esc(d.id) + '"><b>' + esc(inf.code || inf.name) + '</b>' + I('chevron', 15) + '</button>' +
        '<p class="dpm-st is-' + esc(stt) + '">' + esc(STEP_WORD[stt] || stt) + '</p>' +
        '<div class="dpm-order-b"><div>' +
            '<p class="dpm-what">' + esc(inf.code ? inf.name : (TEAM_HZ[d.team] && TEAM_HZ[d.team] !== inf.name ? d.team : 'Dispatch')) + (inf.brgy ? ' · Brgy. ' + esc(inf.brgy) : '') + '</p>' +
            (isOpen
              ? '<p class="dpm-eta">' + (m != null ? (m > 0 ? 'ETA in <b>' + m + ' min</b>' : 'Due now') : 'Sent ' + esc(ago({ created_at: d.dispatched_at }))) + '</p>'
              : '<p class="dpm-eta">Closed ' + esc(absTime(d.done_at || d.updated_at || d.dispatched_at)) + '</p>') +
          '</div><span class="dpm-order-i" aria-hidden="true">' + I(inf.icon, 40) + '</span></div>' +
        (isOpen ? '<button class="dpm-cta" data-act="dispatch-open" data-id="' + esc(d.id) + '">' + (stt === 'sent' ? 'Open and acknowledge' : 'Open dispatch') + '</button>' : '') +
      '</article>';
    };
    const orders = '<section class="dpm-sec"><div class="dpm-sec-h"><h3>Your dispatches</h3></div>' +
        '<div class="dpm-seg" role="tablist">' + [['active', 'Active', open.length], ['done', 'Completed', closed.length]].map((t) =>
          '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'is-on' : '') + '" data-act="dispatch-mtab" data-v="' + t[0] + '">' + t[1] + ' <i>' + t[2] + '</i></button>').join('') + '</div>' +
        (shown.length ? '<div class="dpm-orders">' + shown.map(order).join('') + '</div>'
          : '<div class="dpm-empty">' + I(tab === 'done' ? 'check' : 'truck', 28) + '<b>' + (tab === 'done' ? 'Nothing completed yet' : 'No active dispatch') + '</b>' +
              '<p>' + (tab === 'done' ? 'Finished dispatches appear here.' : 'When an LGU or barangay official dispatches your unit, it lands here.') + '</p></div>') +
      '</section>';

    const tiles = DNAV.filter((n) => n[0] !== 'dispatch' && n[0] !== 'notifications' && n[0] !== 'dp-settings' && (!n[3] || (unit && unit.unit_type === n[3])));
    const short = { equipment: 'Equipment', roster: 'Crew', hospital: 'Hospital', requests: 'Requests', analytics: 'Analytics', contacts: 'Contacts' };
    const quick = '<section class="dpm-sec"><div class="dpm-sec-h"><h3>Quick access</h3></div><div class="dpm-tiles">' + tiles.map((n) =>
        '<button data-act="dispatch-nav" data-route="' + n[0] + '">' + I(n[2], 30) + '<span>' + esc(short[n[0]] || n[1]) + '</span></button>').join('') + '</div></section>';

    /* push is only offered on a tap (browsers block automatic prompts), so
       remind the responder until this phone receives dispatch alerts */
    const push = (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.alertsStatus) ? UG_SETTINGS.alertsStatus() : 'on';
    const pushNote = push === 'off'
      ? '<div class="dpm-push">' + I('bell', 20) + '<div><b>Allow dispatch alerts</b><span>Tap <b>Allow</b> when your browser asks, so new dispatches reach this phone even when UniGuard is closed.</span></div></div>'
      : push === 'blocked'
        ? '<div class="dpm-push is-blocked">' + I('bell', 20) + '<div><b>Alerts are blocked</b><span>Allow notifications for this site in your browser settings to get new dispatches.</span></div></div>'
        : '';
    return '<div class="dpm">' + greet + pushNote + banner + figs + orders + quick + '</div>';
  }

  /* phones: the barangay portal's bar (the active section rises into a
     circle) and its Menu drawer (slides in from the right, dims the page,
     closes on the scrim, X, Escape or a swipe). The state lives in the app
     (S.bgMenu), so app.js animates both exactly as for barangay. */
  function mBar(st, route, unread) {
    const unit = state.data.unit;
    const shown = !!st.bgMenu;
    const open = shown && !st.bgMenuEnter;
    const session = st.session || {};
    /* the 4th slot: the unit's most important section (Notifications already
       has the bell in the header) - Hospital for hospital units, otherwise
       support Requests (backup, water tanker, extra personnel) */
    const isHosp = !!(unit && unit.unit_type === 'Hospital');
    const main = [['dispatch', 'Home', 'home'], ['equipment', 'Equipment', 'shield'], ['roster', 'Crew', 'users'],
      isHosp ? ['hospital', 'Hospital', 'shelter'] : ['requests', 'Requests', 'inbox']];
    const inBar = main.map((n) => n[0]).concat(['notifications']);
    /* the drawer lists only what is not already in the bar or the header */
    const extra = DNAV.filter((n) => inBar.indexOf(n[0]) < 0 && (!n[3] || (unit && unit.unit_type === n[3])));
    const inMore = extra.some((n) => n[0] === route);
    const slot = (id, label, icon, on, act, badgeN) =>
      '<button class="bg-pb' + (on ? ' is-on' : '') + '" data-slot="' + id + '"' + act + (on ? ' aria-current="page"' : '') + ' aria-label="' + esc(label) + (badgeN ? ', ' + badgeN + ' new' : '') + '">' +
        '<span class="bg-pb-i">' + I(icon, on ? 20 : 22) + (badgeN ? '<em>' + (badgeN > 9 ? '9+' : badgeN) + '</em>' : '') + '</span><b>' + esc(label) + '</b></button>';
    const groups = [['More sections', extra.map((n) => [n[0], n[1], n[2]])]];
    return '<nav class="bg-pbar dpm-pbar" aria-label="Dispatch sections"><div class="bg-pbar-in">' +
        main.map((n) => slot(n[0], n[1], n[2], !shown && route === n[0], ' data-act="dispatch-nav" data-route="' + n[0] + '"', 0)).join('') +
        slot('more', 'More', 'layers', shown || inMore, ' data-act="bg-pmenu" aria-haspopup="dialog" aria-controls="bg-pm" aria-expanded="' + shown + '"', 0) +
      '</div></nav>' +
      '<div class="bg-pm-scrim' + (open ? ' is-open' : '') + '" data-act="bg-pmenu" data-v="0" aria-hidden="true"></div>' +
      '<aside id="bg-pm" class="bg-pm dpm-pm' + (open ? ' is-open' : '') + '" role="dialog" aria-modal="true" aria-label="Menu"' + (open ? '' : ' inert') + '>' +
        '<div class="bg-pm-h"><span class="bg-pm-av">' + esc((session.name || 'D').trim().charAt(0).toUpperCase()) + '</span>' +
          '<div class="bg-pm-who"><b>' + esc(session.name || 'Dispatch team') + '</b><small>' + esc(unit ? unit.name + ' · ' + unitTypeLabel(unit.unit_type) : 'Dispatch team') + '</small></div>' +
          '<button class="bg-pm-x" data-act="bg-pmenu" data-v="0" aria-label="Close menu">' + I('x', 20) + '</button></div>' +
        '<div class="bg-pm-list">' + groups.filter((g) => g[1].length).map((g) => '<p class="bg-pm-g">' + esc(g[0]) + '</p><div class="bg-pm-card">' + g[1].map((it) =>
          '<button class="bg-pm-i' + (route === it[0] ? ' is-on' : '') + '" data-act="dispatch-nav" data-route="' + it[0] + '"' + (route === it[0] ? ' aria-current="page"' : '') + '>' +
            I(it[2], 22) + '<span>' + esc(it[1]) + '</span>' + (it[0] === 'notifications' && unread ? '<em>' + unread + '</em>' : '') +
            '<i class="bg-pm-chev">' + I('chevron', 16) + '</i></button>').join('') + '</div>').join('') +
          '<p class="bg-pm-g">Data</p><div class="bg-pm-card"><button class="bg-pm-i" data-act="dispatch-refresh">' + I('wave', 22) + '<span>' + esc(T('action.refresh')) + '</span><i class="bg-pm-chev">' + I('chevron', 16) + '</i></button></div>' +
        '</div>' +
        '<div class="bg-pm-f"><button data-act="logout">' + I('logout', 16) + '<span>' + esc(T('action.signout')) + '</span></button>' +
          '<small>UniGuard · ' + esc(unit ? unit.name : 'Dispatch') + ((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) ? ' · ' + esc(UG_CONFIG.BUILD) : '') + '</small></div>' +
      '</aside>';
  }

  function frame(st) {
    const session = st.session || {};
    const unit = state.data.unit;
    const visible = DNAV.filter((n) => !n[3] || (unit && unit.unit_type === n[3]));
    const route = state.route === 'dispatch-detail' ? 'dispatch' : state.route;
    const unread = (state.data.notifications || []).filter((n) => !n.read_at).length;
    const now = new Date();
    const clock = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const open = (state.data.dispatches || []).filter((d) => d.dispatch_status !== 'done' && d.dispatch_status !== 'declined');
    const newest = (state.data.dispatches || []).filter((d) => d.dispatch_status === 'sent')
      .sort((a, b) => Date.parse(b.dispatched_at || 0) - Date.parse(a.dispatched_at || 0))[0];
    const crew = state.data.personnel || [];
    const gear = state.data.equipment || [];
    const overdue = gear.filter((r) => !r.last_checked_at || (Date.now() - Date.parse(r.last_checked_at)) > 86400000).length;
    const initial = esc(((session.name || '?').trim().charAt(0) || '?').toUpperCase());
    const nr = newest ? (newest.report || {}) : null;
    const phone = isPhone();
    window.__dpPhone = phone;
    const summary = (route === 'dispatch' && !phone)
      ? '<div class="dp-sum">' +
          '<div class="dp-figs">' + [
            ['Active dispatches', open.length, unit ? unit.name + ' · ' + unitTypeLabel(unit.unit_type) : (open.length ? 'open now' : 'none open')],
            ['On duty', crew.filter((p) => p.on_duty).length, 'of ' + crew.length + ' crew'],
            ['Checks overdue', overdue, 'of ' + gear.length + ' items']].map((f) =>
            '<div><p>' + esc(f[0]) + '</p><b>' + f[1] + '</b><small>' + esc(f[2]) + '</small></div>').join('') + '</div>' +
          '<button class="dp-new"' + (newest ? ' data-act="dispatch-open" data-id="' + esc(newest.id) + '"' : ' data-act="dispatch-nav" data-route="dispatch"') + '>' +
            '<span class="dp-new-h"><span>New dispatch</span>' + I(newest ? 'alert' : 'chevron', 16) + '</span>' +
            '<span class="dp-new-t">' + (newest
              ? esc((nr.hazard_type || 'Incident') + ' in ' + (nr.barangay || 'Lingayen') + ', ' + UG_UTIL.relTime({ created_at: newest.dispatched_at }) + '. Waiting for acknowledgement.')
              : 'Nothing waiting for acknowledgement.') + '</span></button>' +
        '</div>'
      : '';
    return '<div class="ug ug-frame ug-d ug-dp' + (phone ? ' is-phone' : '') + (st.fixed ? ' ug-fixed' : '') + '"' +
      (st.fixed ? ' style="width:' + st.w + 'px;height:' + st.h + 'px"' : '') + '>' +
      '<i class="dp-blob dp-blob--a" aria-hidden="true"></i><i class="dp-blob dp-blob--b" aria-hidden="true"></i>' +
      '<div class="dp-shell">' +
        '<aside class="dp-rail' + (railShut ? ' is-shut' : '') + '">' +
          '<button class="dp-logo" data-act="dispatch-nav" data-route="dispatch" aria-label="Go to incoming dispatches" title="Incoming Dispatches">' + U.brandMark(34) + '</button>' +
          '<nav class="dp-nav" id="ug-dispatch-nav" aria-label="Dispatch sections">' +
            '<div class="dp-meRow"><span class="dp-me" title="' + esc((session.name || '') + ' · ' + (session.scope || '')) + '">' + initial + '</span>' +
              '<span class="dp-lbl dp-meT"><b>' + esc(session.name || 'Dispatch') + '</b><small>' + esc(unit ? unit.name : (session.title || 'Dispatch team')) + '</small></span></div>' +
            '<span class="dp-sep" aria-hidden="true"></span>' +
            visible.map((n) =>
              '<button class="' + (route === n[0] ? 'is-on' : '') + '" data-act="dispatch-nav" data-route="' + n[0] + '" aria-label="' + esc(n[1]) + '"' + (route === n[0] ? ' aria-current="page"' : '') + '>' +
                I(n[2], 22) + '<span class="dp-lbl">' + esc(n[1]) + '</span>' + (n[0] === 'notifications' && unread ? '<i class="dp-dot"></i>' : '') + '</button>').join('') +
            '<span class="dp-sep dp-sep--b" aria-hidden="true"></span>' +
            '<button class="dp-tool" data-act="dispatch-refresh" aria-label="' + esc(T('action.refresh')) + '" title="' + esc(T('action.refresh')) + '">' + I('wave', 20) + '<span class="dp-lbl">' + esc(T('action.refresh')) + '</span></button>' +
            '<button class="dp-out" data-act="logout" aria-label="' + esc(T('action.signout')) + '" title="' + esc(T('action.signout')) + '">' + I('logout', 20) + '<span class="dp-lbl">' + esc(T('action.signout')) + '</span></button>' +
            '<span class="dp-build" title="build">' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</span>' +
          '</nav>' +
        '</aside>' +
        '<main class="dp-main">' +
          (phone
            ? '<div class="dp-phone dpm-top"><button class="dpm-brand" data-act="dispatch-nav" data-route="dispatch" aria-label="Go to Home">' + U.brandMark(26) +
                '<span class="dpm-chip">' + esc(unit ? unit.name : 'Dispatch') + '</span></button>' +
                '<span class="dpm-top-r"><button class="dpm-ib' + (route === 'notifications' ? ' is-on' : '') + '" data-act="dispatch-nav" data-route="notifications" aria-label="Notifications">' + I('bell', 17) +
                  (unread ? '<em>' + (unread > 9 ? '9+' : unread) + '</em>' : '') + '</button>' +
                '<button class="dpm-ib' + (st.bgMenu ? ' is-on' : '') + '" data-act="bg-pmenu" aria-label="Menu" aria-haspopup="dialog" aria-controls="bg-pm" aria-expanded="' + !!st.bgMenu + '">' + I('menu', 18) + '</button></span></div>'
            : '<div class="dp-phone">' + U.brandMark(28) + '<b>' + esc(unit ? unit.name : 'Dispatch') + '</b><span>' + esc(clock) + '</span>' +
            '<button data-act="dispatch-nav" data-route="notifications" aria-label="Notifications">' + I('bell', 16) + (unread ? '<i class="dp-dot"></i>' : '') + '</button>' +
            '<button data-act="logout" aria-label="Sign out">' + I('logout', 16) + '</button></div>') +
          '<div class="ug-d-body ug-scroll dp-body">' +
            '<div class="dp-top">' +
              '<div class="dp-id"><span class="dp-id-ico">' + I('truck', 18) + '</span><div><b>' + esc(unit ? unit.name : 'Dispatch Console') + '</b>' +
                '<small>' + esc((session.name || '') + (unit ? ' · ' + unitTypeLabel(unit.unit_type) : '')) + '</small></div></div>' +
              '<div class="dp-clock"><span>' + esc(clock) + '</span><b>' + esc(date) + '</b></div>' +
            '</div>' +
            (newest ? '<div class="ug-note" role="alert"><b>Dispatch waiting for acknowledgment</b> ' +
              '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="dispatch-open" data-id="' + esc(newest.id) + '">Open dispatch</button>' +
              (UG_ALARM.needsUnlock() ? ' <button class="ug-btn ug-btn--sm" data-act="dispatch-enable-alarm">Enable alarm sound</button>' : '') + '</div>' : '') +
            (state.error ? '<p class="dp-err">' + esc(state.error) + '</p>' : '') +
            summary +
            '<div class="dp-tabs">' + visible.map((n) =>
              '<button class="' + (route === n[0] ? 'is-on' : '') + '" data-act="dispatch-nav" data-route="' + n[0] + '">' + esc(n[1]) + (n[0] === 'notifications' && unread ? ' •' : '') + '</button>').join('') + '</div>' +
            '<div class="dp-page">' + body(st) + '</div>' +
          '</div>' +
          (phone ? mBar(st, route, unread) : '') +
        '</main>' +
      '</div>' +
    '</div>';
  }

  /* ----------------------------------------------------------------- actions */
  function openDispatch(id) {
    const ui = app();
    ui.go('dispatch-detail');
    if (ui.S) ui.S.openId = id;
    state.openDispatchId = id;
    state.route = 'dispatch-detail';
    ui.render();
  }

  async function openAlert(id) {
    const c = client();
    const target = state.data;
    if (!c || !target.unit) return;
    let assignment = target.dispatches.find((row) => row.id === id);
    if (!assignment) {
      assignment = await loadDispatchById(c, target.unit.id, id);
      if (target !== state.data || app().S?.route !== 'dispatch') return;
      if (assignment) target.dispatches.push(assignment);
    }
    if (!assignment) {
      app().toast('This assignment is unavailable to your unit.', 'warning');
      return;
    }
    openDispatch(assignment.id);
    await loadEvents();
    if (target === state.data) app().render();
  }

  const actions = {
    'dispatch-nav': async (d) => {
      const ui = app();
      if (ui.S?.bgMenu) { ui.S.bgMenu = false; ui.S.bgMenuEnter = false; }
      ui.go(d.route);
      state.route = d.route;
      ui.render();
      await ui.loadRouteData(d.route);
    },
    'dispatch-refresh': () => { const A0 = app(); if (A0 && A0.S && A0.S.bgMenu) A0.S.bgMenu = false; return loadAll(); },
    'dispatch-eqf': (d) => { state.eqF = d.v; app().render(); },
    'dispatch-mtab': (d) => { state.mTab = d.v === 'done' ? 'done' : 'active'; app().render(); },
    'dispatch-open': (d) => openDispatch(d.id),
    'dispatch-respond': async (d) => {
      try {
        const note = (document.querySelector('[data-act="dispatch-note"][data-id="' + d.id + '"]') || {}).value || '';
        const cur = (state.data.dispatches || []).find((x) => x.id === d.id);
        await rpc('dispatch_respond', { p_dispatch_id: d.id, p_action: d.next, p_note: note });
        if (cur) cur.dispatch_status = d.next;
        incoming.delete(d.id);
        syncDispatchAlarm();
        /* resume is an event: the dispatch goes back to on_scene (migration 051) */
        app().toast(d.next === 'resume' ? 'Rescue resumed · back on scene' : 'Status updated to ' + d.next, 'prepared');
        await loadDispatches(); await loadEvents();
        syncTracking();
        app().render();
      } catch (e) { app().toast(e.message || 'Could not update', 'warning'); }
    },
    'dispatch-track-start': (d) => {
      const selected = openDispatches().filter((row) => row.dispatch_status !== 'sent');
      const row = d.id ? selected.find((r) => r.id === d.id) : selected.length === 1 ? selected[0] : null;
      if (!row) { app().toast('Open an acknowledged assignment to share its location', 'warning'); return; }
      stopTracking();
      track.dispatchId = row.id;
      track.fix = null;
      track.sent = null;
      startTracking();
      app().render();
    },
    'dispatch-enable-alarm': () => { UG_ALARM.unlock(); syncDispatchAlarm(); app().render(); },
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
    'dispatch-request-new': (d) => openRequestModal(d && d.kind),
    'dispatch-request-done': async (d, button) => {
      const ui = app();
      const row = state.data.requests.find((item) => item.id === d.id);
      if (!row || !canCompleteRequest(row, ui.S?.session)) return;
      if (!online()) { ui.toast('Connect to the server to complete this request', 'warning'); return; }
      if (button) button.disabled = true;
      try {
        await rpc('decide_unit_request', { p_request_id: row.id, p_decision: 'done' });
        row.status = 'done';
        ui.toast('Support request marked done', 'prepared');
        await loadRequests();
      } catch (e) { ui.toast(e.message || 'Could not update the request', 'warning'); }
      finally { ui.render(); }
    },
    'dispatch-ntf': (d) => { state.ntF = d.v === 'unread' ? 'unread' : 'all'; app().render(); },
    'dispatch-dirf': (d) => { if (state.dirTab === 'captains') state.dirCap = d.v; else state.dirCat = d.v; app().render(); },
    'dispatch-dirtab': (d) => { state.dirTab = d.v === 'captains' ? 'captains' : 'hotlines'; app().render(); },
    'dispatch-rqtab': (d) => { state.rqTab = d.v === 'past' ? 'past' : 'open'; app().render(); },
    'dispatch-capacity-edit': () => openCapacityModal(),
    'dispatch-notif-open': async (d) => {
      const c = client();
      const n = (state.data.notifications || []).find((x) => x.id === d.id);
      if (c && n && !n.read_at) {
        n.read_at = new Date().toISOString();
        c.from('notifications').update({ read_at: n.read_at }).eq('id', d.id).then(() => { }, () => { });
      }
      const disp = d.report ? (state.data.dispatches || []).find((x) => x.report_id === d.report) : null;
      if (disp) { openDispatch(disp.id); return; }
      if (n?.type === 'hazard_confirmed') app().toast(n.body, 'warning');
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

  function openRequestModal(preKind) {
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
    const pk = KIND_LABELS[preKind] ? preKind : 'fuel';
    const kindOpts = Object.keys(KIND_LABELS).map((k) =>
      '<option value="' + k + '"' + (k === pk ? ' selected' : '') + '>' + esc(KIND_LABELS[k]) + '</option>').join('');
    /* phones: the kind as tappable chips (they set the select) */
    const kindChips = '<div class="dpq-chips" role="radiogroup" aria-label="Kind">' + RQ_KINDS.map((k) =>
      '<button type="button" role="radio" aria-checked="' + (k[0] === pk) + '" class="' + (k[0] === pk ? 'is-on' : '') + '" data-rq-chip="' + k[0] + '">' + I(k[2], 16) + esc(k[1]) + '</button>').join('') + '</div>';

    /* openModal() handles the missing-UG_FEATURES case with a visible
       toast — no silent fail. */
    openModal({
      title: 'New support request',
      cls: 'rf-modal dpq-modal',
      body: '<div class="ug-field"><label class="ug-lab">What do you need?</label>' + kindChips + '<select class="ug-sel dpq-sel" data-rq-kind>' + kindOpts + '</select></div>' +
            '<div class="ug-field" data-rq-other-field' + (pk === 'other' ? '' : ' hidden') + '><label class="ug-lab">Please specify</label>' +
              '<input class="ug-in" type="text" data-rq-other maxlength="80" placeholder="e.g. Generator, food packs, a second boat"></div>' +
            '<div class="ug-field"><label class="ug-lab">Details</label>' +
              '<textarea class="ug-ta" rows="3" data-rq-details maxlength="1000" placeholder="What do you need? Be specific — the LGU sees this message."></textarea>' +
              '<div class="ug-help ug-dimmer" style="font-size:11px;text-align:right" data-rq-counter>0 / 1000</div>' +
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
        /* "Other": ask what it is. The kind stays 'other' (create_unit_request
           only accepts the fixed kinds); the text leads the details. */
        const kindSel = wrap.querySelector('[data-rq-kind]');
        const otherField = wrap.querySelector('[data-rq-other-field]');
        const otherIn = wrap.querySelector('[data-rq-other]');
        kindSel.addEventListener('change', () => { otherField.hidden = kindSel.value !== 'other'; if (!otherField.hidden) otherIn.focus(); });
        wrap.querySelectorAll('[data-rq-chip]').forEach((b) => b.addEventListener('click', () => {
          wrap.querySelectorAll('[data-rq-chip]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); });
          kindSel.value = b.getAttribute('data-rq-chip'); kindSel.dispatchEvent(new Event('change'));
        }));

        const saveBtn = wrap.querySelector('[data-rq-save]');
        saveBtn.addEventListener('click', async () => {
          /* PART 1 step 4: validation + double-submit guard. */
          if (saveBtn.disabled) return;
          const kind = wrap.querySelector('[data-rq-kind]').value;
          const spec = kind === 'other' ? (otherIn.value || '').trim() : '';
          if (kind === 'other' && !spec) {
            app().toast('Say what you need under "Please specify".', 'warning');
            otherIn.focus();
            return;
          }
          const details = (spec ? 'Other: ' + spec + ' \u2014 ' : '') + (ta.value || '').trim();
          if (!(ta.value || '').trim()) {
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
      body: '<p class="eqf-lead">Register a piece of equipment so crews can check it each shift and dispatchers know it is ready.</p>' +
        '<section class="eqf-sec"><h4>What it is</h4><div class="eqf-grid">' +
        (opts.pickBarangay
          ? '<div class="ug-field eqf-span"><label class="ug-lab">Barangay</label>' +
              '<select class="ug-sel" data-eq-brgy><option value="">Loading barangays…</option></select></div>'
          : '') +
        '<div class="ug-field" data-eq-category-field' + (showCategory ? '' : ' hidden') + '><label class="ug-lab">Category</label>' +
          '<select class="ug-sel" data-eq-category>' + categoryOpts + '</select></div>' +
        '<div class="ug-field"><label class="ug-lab">Type</label>' +
          '<select class="ug-sel" data-eq-catalog>' + typeOptsFor(firstCategory) + '</select>' +
          '<small class="eqf-hint" data-eq-cat-note hidden>Loading the equipment list…</small></div>' +
        '<div class="ug-field" data-eq-custom-field hidden><label class="ug-lab">Custom label</label>' +
          '<input class="ug-in" type="text" data-eq-custom placeholder="e.g. Portable Pump"></div>' +
        '<div class="ug-field"><label class="ug-lab">Identifier <span class="eqf-opt">plate, tag or unit no.</span></label>' +
          '<input class="ug-in" type="text" data-eq-identifier placeholder="e.g. Fire Truck #2"></div>' +
        '</div></section>' +
        '<section class="eqf-sec"><h4>Condition</h4><div class="eqf-grid">' +
        '<div class="ug-field eqf-span"><label class="ug-lab">Starting condition</label>' +
          '<select class="ug-sel" data-eq-condition>' + conditionOptions('unknown') + '</select></div>' +
        '<div class="ug-field eqf-span"><label class="ug-lab">Notes <span class="eqf-opt">optional</span></label>' +
          '<textarea class="ug-ta" rows="3" data-eq-notes placeholder="Anything the next shift should know"></textarea></div>' +
        '</div></section>',
      footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-eq-save>' + I('plus', 14) + 'Add equipment</button>',
      onMount: (wrap, close) => {
        wrap.classList.add('eqf-modal');
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

        /* The dispatch console never loads the catalog with the directory,
           so the Type list used to show only "Other (custom)". Load it here
           when it is missing, then refill Category and Type. */
        if (!catalogList().filter((c) => c.unit_type === unitType).length) {
          const note = wrap.querySelector('[data-eq-cat-note]');
          const c = client();
          if (c && note) {
            note.hidden = false;
            c.from('equipment_catalog').select('*').order('unit_type', { ascending: true }).order('label', { ascending: true })
              .then(({ data, error }) => {
                if (error) throw error;
                if (typeof UG !== 'undefined' && UG.DATA) UG.DATA.equipmentCatalog = data || [];
                const cats = catalogCategoriesForUnitType(unitType);
                categorySel.innerHTML = cats.map((cat, i) => '<option value="' + esc(cat) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(cat) + '</option>').join('');
                wrap.querySelector('[data-eq-category-field]').hidden = cats.length <= 1;
                catalogSel.innerHTML = typeOptsFor(cats.length ? cats[0] : null);
                refreshCustom();
                if (cats.length) note.hidden = true;
                else note.textContent = 'No catalog items for this unit type yet. Use a custom label.';
              })
              .catch(() => { note.textContent = 'Could not load the equipment list. Use a custom label for now.'; });
          }
        }

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
          const restore = () => { saveBtn.disabled = false; saveBtn.innerHTML = I('plus', 14) + 'Add equipment'; };
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
            restore();
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
    state, frame, body, loadAll, loadRoute, openAlert, actions, signedOut,
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
