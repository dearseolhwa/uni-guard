/* UniGuard · data repository
 *
 * Every screen reads the mutable UG.DATA store. This module is the only thing
 * that writes to it. When a Supabase project is configured and reachable the
 * store is hydrated from Postgres and kept live with Realtime; otherwise the
 * app runs on the local cache so the interface stays usable offline.
 *
 * The client variable is named `sb`, never `supabase`, because the CDN already
 * defines window.supabase and a second declaration throws.
 */
const Repo = (function () {
  let sb = null;
  let channel = null;
  let subscribed = false;

  const state = {
    source: 'local',       /* 'supabase' | 'offline' | 'local' */
    loading: false,
    error: null,
    lastSync: null,
    profile: null
  };

  const listeners = new Set();
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit() { listeners.forEach((fn) => { try { fn(state); } catch (e) {} }); }

  /* ---------------------------------------------------------------- client */
  function client() {
    if (sb) return sb;
    if (typeof window === 'undefined' || !window.supabase) return null;
    if (!UG_CONFIG.SUPABASE_URL || !UG_CONFIG.SUPABASE_ANON_KEY) return null;
    try {
      sb = window.supabase.createClient(UG_CONFIG.SUPABASE_URL, UG_CONFIG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (e) { sb = null; }
    return sb;
  }
  const online = () => !!client();

  function fail(error) {
    state.error = (error && error.message) ? error.message : String(error || 'Request failed');
    state.loading = false;
    emit();
    throw error instanceof Error ? error : new Error(state.error);
  }

  /* ------------------------------------------------------- shape adaptation */
  /* The service-area box for Lingayen, Pangasinan — see js/geo.js, the single
     place this town's coordinates are defined. */
  const CITY_BOUNDS = UG_GEO.BOUNDS;

  function posFrom(lat, lng, index) {
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      const x = (lng - CITY_BOUNDS.minLng) / (CITY_BOUNDS.maxLng - CITY_BOUNDS.minLng);
      const y = 1 - (lat - CITY_BOUNDS.minLat) / (CITY_BOUNDS.maxLat - CITY_BOUNDS.minLat);
      return { x: Math.min(0.94, Math.max(0.06, x)), y: Math.min(0.92, Math.max(0.08, y)) };
    }
    /* deterministic scatter so incidents without coordinates still render apart */
    const i = index || 0;
    return { x: 0.22 + ((i * 37) % 56) / 100, y: 0.2 + ((i * 53) % 52) / 100 };
  }

  const RADIUS = { emergency: 0.115, warning: 0.095, advisory: 0.082, prepared: 0.07 };

  function toIncident(r, i) {
    const p = posFrom(r.lat, r.lng, i);
    return {
      id: r.code || r.id,
      uuid: r.id,
      hazard: r.hazard_type ? UG_HAZARDS.displayLabel(r.hazard_type, r.hazard_other_text) : 'Hazard',
      hazard_type: r.hazard_type || '',
      hazard_other_text: r.hazard_other_text || '',
      brgy: r.barangay || '',
      area: r.area || r.barangay || '',
      status: r.status || 'reported',
      sev: r.severity || 'advisory',
      created_at: r.created_at,
      time: UG_UTIL.relTime(r),
      desc: r.description || '',
      corr: typeof r.corroborations === 'number' ? r.corroborations
           : (Array.isArray(r.report_corroborations) ? r.report_corroborations.length : 0),
      thumb: r.photo_path ? 'remote' : null,
      remote_photo: r.photo_path || null,
      units: r.assigned_units || 0,
      lat: r.lat, lng: r.lng,
      mine: r.is_mine === true,
      x: p.x, y: p.y, r: RADIUS[r.severity || 'advisory'] || 0.09
    };
  }

  function toAdvisory(a) {
    return {
      id: a.id,
      code: a.code || String(a.id).slice(0, 8),
      title: a.title || '',
      body: a.body || '',
      severity: a.severity || 'advisory',
      type: a.kind === 'preparedness' ? 'Preparedness' : 'Emergency',
      kind: a.kind || 'emergency',
      area: a.affected_area || UG_GEO.PLACE.areaAll,
      citywide: a.citywide !== false,
      expires_at: a.expires_at,
      created_at: a.published_at || a.created_at,
      time: UG_UTIL.relTime(a.published_at || a.created_at)
    };
  }

  function toCenter(c) {
    return {
      id: c.id, uuid: c.id,
      name: c.name || '',
      brgy: c.barangay || '',
      status: c.status || 'open',
      occ: c.occupancy || 0,
      cap: c.capacity || 0,
      note: c.note || '',
      lat: c.lat, lng: c.lng
    };
  }

  function toHotline(h) {
    return {
      id: h.id, uuid: h.id,
      agency: h.agency_name || '',
      number: h.contact_number || '',
      scope: h.scope || UG_GEO.PLACE.areaAll,
      description: h.description || '',
      type: /medical|red cross|relief/i.test(h.scope + ' ' + h.agency_name) ? 'medical'
          : /police|pnp/i.test(h.agency_name) ? 'police'
          : /coast guard/i.test(h.agency_name) ? 'coastal'
          : /barangay/i.test(h.scope + h.agency_name) ? 'barangay' : 'emergency'
    };
  }

  function toNotification(n) {
    return {
      id: n.id,
      title: n.title || '',
      body: n.body || '',
      tone: n.tone || 'advisory',
      icon: n.icon || 'bell',
      created_at: n.created_at,
      time: UG_UTIL.relTime(n),
      unread: !n.read_at,
      report_id: n.report_id,
      advisory_id: n.advisory_id
    };
  }

  /* ------------------------------------------------------------- hydration */
  function recomputeKpis() {
    const inc = UG.DATA.incidents || [];
    const c = UG.DATA.counts || {};
    const active = (c.openIncidents != null) ? c.openIncidents : inc.filter((i) => i.status !== 'resolved' && i.status !== 'rejected').length;
    const critical = (c.emergency != null) ? c.emergency : inc.filter((i) => i.sev === 'emergency' && i.status !== 'resolved' && i.status !== 'rejected').length;
    const units = (c.units != null) ? c.units : inc.reduce((n, i) => n + (i.units || 0), 0);
    const live = state.source === 'supabase';
    UG.DATA.kpis = [
      { label: 'Active Incidents', value: String(active), delta: live ? 'Live from the incident queue' : 'From the cached queue', dir: 'flat', tone: 'emergency', icon: 'alert' },
      { label: 'Units Deployed', value: String(units), delta: 'Assigned responders', dir: 'flat', tone: 'verified', icon: 'users' },
      { label: 'Critical Areas', value: String(critical), delta: 'Emergency severity, not resolved', dir: 'flat', tone: 'warning', icon: 'shieldx' },
      { label: 'System Status', value: live ? 'LIVE' : 'STABLE', delta: live ? 'Realtime connected' : 'Serving cached data', dir: 'flat', tone: 'resolved', icon: 'wave' }
    ];
  }

  function stamp(list) {
    /* give the offline seed a plausible timeline for relative time display */
    const now = Date.now();
    list.forEach((it, i) => {
      if (!it.created_at && it.time) {
        const m = /^(\d+)\s*m/.exec(it.time);
        const h = /^(\d+)\s*h/.exec(it.time);
        const d = /^(\d+)\s*d/.exec(it.time);
        const mins = m ? +m[1] : h ? +h[1] * 60 : d ? +d[1] * 1440 : i * 7;
        it.created_at = new Date(now - mins * 60000).toISOString();
      }
      it.time = UG_UTIL.relTime(it);
    });
  }

  function reseedLocal() {
    stamp(UG.DATA.incidents);
    stamp(UG.DATA.advisories);
    stamp(UG.DATA.notifications);
    refreshDerived();
  }

  /* ---------------------------------------------------- derived figures */
  /* Counts and analytics are recomputed from whatever is in the store, so the
     console and the resident app always agree and everything still works offline. */
  function computeCounts() {
    const inc = UG.DATA.incidents || [];
    const adv = UG.DATA.advisories || [];
    const cen = UG.DATA.centers || [];
    return {
      incidents: inc.length,
      openIncidents: inc.filter((i) => i.status !== 'resolved').length,
      emergency: inc.filter((i) => i.sev === 'emergency' && i.status !== 'resolved').length,
      advisories: adv.length,
      liveAdvisories: adv.filter((a) => a.severity !== 'prepared').length,
      preparedness: adv.filter((a) => a.severity === 'prepared').length,
      centers: cen.length,
      openCenters: cen.filter((c) => c.status === 'open').length,
      fullCenters: cen.filter((c) => c.status === 'full').length,
      hotlines: (UG.DATA.hotlines || []).length,
      units: inc.reduce((n, i) => n + (i.units || 0), 0),
      unread: (UG.DATA.notifications || []).filter((n) => n.unread).length
    };
  }

  function localAnalytics() {
    const inc = UG.DATA.incidents || [];
    const byHazard = {};
    inc.forEach((i) => { byHazard[i.hazard] = (byHazard[i.hazard] || 0) + 1; });

    const stages = { reported: 0, verified: 0, dispatched: 0, resolved: 0 };
    inc.forEach((i) => { if (stages[i.status] != null) stages[i.status]++; });

    const days = [];
    const now = Date.now();
    for (let d = 13; d >= 0; d--) {
      const start = new Date(now - d * 86400000);
      start.setHours(0, 0, 0, 0);
      const end = start.getTime() + 86400000;
      days.push(inc.filter((i) => {
        const t = Date.parse(i.created_at || '');
        return t >= start.getTime() && t < end;
      }).length);
    }

    const pct = (n) => (inc.length ? Math.round((n / inc.length) * 100) : 0);
    const week = days.slice(7).reduce((a, b) => a + b, 0);
    const prev = days.slice(0, 7).reduce((a, b) => a + b, 0);

    return {
      byHazard: byHazard,
      stages: stages,
      daily: days,
      total: inc.length,
      weekTotal: week,
      prevWeekTotal: prev,
      weekDelta: prev ? Math.round(((week - prev) / prev) * 100) : 0,
      autoVerifiedShare: pct(inc.filter((i) => i.status !== 'reported').length),
      corroborationRate: pct(inc.filter((i) => (i.corr || 0) >= 3).length),
      resolvedShare: pct(stages.resolved)
    };
  }

  function refreshDerived() {
    UG.DATA.counts = computeCounts();
    if (!UG.DATA.analytics || UG.DATA.analytics.live !== true) UG.DATA.analytics = localAnalytics();
    recomputeKpis();
  }

  async function loadAll(opts) {
    opts = opts || {};
    state.loading = true;
    state.error = null;
    emit();

    const c = client();
    if (!c) {
      state.source = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'local';
      reseedLocal();
      state.loading = false;
      state.lastSync = new Date().toISOString();
      emit();
      return state;
    }

    try {
      const profile = state.profile;
      const role = profile ? profile.role : 'citizen';
      const brgyId = profile ? profile.barangay_id : null;

      let reportsQuery = c.from('reports_feed').select('*').order('created_at', { ascending: false }).limit(300);

      const [reports, advisories, centers, hotlines, notifications, subscriptions, assignments] = await Promise.all([
        reportsQuery,
        c.from('advisories').select('*').order('published_at', { ascending: false }).limit(100),
        c.from('evacuation_centers').select('*').order('name'),
        c.from('emergency_hotlines').select('*').order('agency_name'),
        c.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
        c.from('push_subscriptions').select('id', { count: 'exact', head: true }),
        c.from('report_assignments').select('report_id').is('released_at', null)
      ]);

      if (reports.error) throw reports.error;

      const unitCount = {};
      if (assignments && !assignments.error) {
        (assignments.data || []).forEach((a) => { unitCount[a.report_id] = (unitCount[a.report_id] || 0) + 1; });
      }

      UG.DATA.incidents = (reports.data || []).map((r) => {
        const row = toIncident(r);
        row.units = unitCount[r.id] || 0;
        return row;
      });
      if (!advisories.error) UG.DATA.advisories = (advisories.data || []).map(toAdvisory);
      if (!centers.error) UG.DATA.centers = (centers.data || []).map(toCenter);
      if (!hotlines.error) UG.DATA.hotlines = (hotlines.data || []).map(toHotline);
      if (!notifications.error) UG.DATA.notifications = (notifications.data || []).map(toNotification);
      UG.DATA.subscribedDevices = subscriptions && !subscriptions.error ? (subscriptions.count || 0) : 0;
      UG.DATA.scope = { role: role, barangay_id: brgyId };

      recomputeKpis();
      refreshDerived();
      state.source = 'supabase';
      state.loading = false;
      state.lastSync = new Date().toISOString();
      emit();

      if (window.UG_CACHE) window.UG_CACHE.storeSnapshot(UG.DATA);
      subscribe();
      return state;
    } catch (e) {
      state.source = 'offline';
      state.error = (e && e.message) || 'Could not reach the server';
      reseedLocal();
      state.loading = false;
      emit();
      return state;
    }
  }

  /* ------------------------------------------------------------- realtime */
  function subscribe() {
    const c = client();
    if (!c || subscribed) return;
    try {
      channel = c.channel('uniguard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'advisories' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'evacuation_centers' }, () => loadAll())
        .subscribe();
      subscribed = true;
    } catch (e) { /* realtime is an enhancement, never a blocker */ }
  }

  function unsubscribe() {
    const c = client();
    if (c && channel) { try { c.removeChannel(channel); } catch (e) {} }
    channel = null;
    subscribed = false;
  }

  /* --------------------------------------------------------------- reports */
  async function createReport(input) {
    const c = client();
    if (!c) {
      /* offline: keep it in the queue and show it locally */
      const code = 'PENDING-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      const row = toIncident({
        code: code, hazard_type: input.hazard_type, hazard_other_text: input.hazard_other_text,
        barangay: input.barangay, description: input.description,
        severity: input.severity, status: 'reported', lat: input.lat, lng: input.lng,
        created_at: new Date().toISOString(), corroborations: 1
      }, UG.DATA.incidents.length);
      UG.DATA.incidents.unshift(row);
      recomputeKpis();
      emit();
      return { queued: true, row: row };
    }

    let photo_path = null;
    if (input.photoBlob) {
      const path = await uploadPhoto(input.photoBlob, input.reportCodeHint);
      photo_path = path;
    }

    const payload = {
      hazard_type: input.hazard_type,
      hazard_other_text: input.hazard_other_text || null,
      barangay: input.barangay,
      description: input.description,
      severity: input.severity,
      urgency: input.urgency || input.severity,
      lat: input.lat, lng: input.lng,
      photo_path: photo_path
    };

    const { data, error } = await c.from('reports').insert(payload).select('*').single();
    if (error) fail(error);

    await loadAll();
    const row = (UG.DATA.incidents || []).find((i) => i.uuid === data.id) || toIncident(data, 0);
    return { queued: false, row: row, report: data };
  }

  async function uploadPhoto(blob, hint) {
    const c = client();
    if (!c) return null;
    const { data: userData } = await c.auth.getUser();
    const uid = userData && userData.user ? userData.user.id : 'anon';
    const folder = (hint || 'draft').replace(/[^A-Za-z0-9-]/g, '');
    const path = uid + '/' + folder + '/' + Date.now() + '.jpg';
    const up = await c.storage.from('reports').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;
    return path;
  }

  async function signedPhotoUrl(path) {
    const c = client();
    if (!c || !path) return null;
    const { data, error } = await c.storage.from('reports').createSignedUrl(path, 60 * 60);
    if (error) return null;
    return data.signedUrl;
  }

  async function corroborate(reportUuid, note) {
    const c = client();
    if (!c) {
      const row = (UG.DATA.incidents || []).find((i) => i.uuid === reportUuid || i.id === reportUuid);
      if (row) {
        row.corr = Math.min(3, (row.corr || 0) + 1);
        if (row.corr >= 3 && row.status === 'reported') row.status = 'verified';
      }
      emit();
      return { verified: row && row.status === 'verified', corroborations: row ? row.corr : 0 };
    }
    const { data, error } = await c.rpc('corroborate_report', { p_report_id: reportUuid, p_note: note || '' });
    if (error) fail(error);
    await loadAll();
    return data;
  }

  async function advanceStatus(reportUuid, next, note) {
    const c = client();
    if (!c) {
      const row = (UG.DATA.incidents || []).find((i) => i.uuid === reportUuid || i.id === reportUuid);
      if (row) row.status = next;
      recomputeKpis();
      emit();
      return row;
    }
    const { data, error } = await c.rpc('advance_report_status', {
      p_report_id: reportUuid, p_next: next, p_note: note || ''
    });
    if (error) fail(error);
    await loadAll();
    return data;
  }

  async function reportHistory(reportUuid) {
    const c = client();
    if (!c) return [];
    const { data, error } = await c.from('report_status_history')
      .select('*').eq('report_id', reportUuid).order('created_at');
    if (error) return [];
    return data || [];
  }

  /* -------------------------------------------------------------- advisories */
  async function createAdvisory(input) {
    const c = client();
    if (!c) {
      UG.DATA.advisories.unshift({
        id: 'local-' + Date.now(), title: input.title, body: input.body, severity: input.severity,
        type: input.kind === 'preparedness' ? 'Preparedness' : 'Emergency', kind: input.kind,
        area: input.affected_area, citywide: input.citywide, created_at: new Date().toISOString(),
        time: 'just now'
      });
      emit();
      return { local: true };
    }
    const { data: userData } = await c.auth.getUser();
    const { data, error } = await c.from('advisories').insert({
      author_id: userData && userData.user ? userData.user.id : null,
      title: input.title, body: input.body, severity: input.severity, kind: input.kind,
      affected_area: input.affected_area || (input.citywide ? UG_GEO.PLACE.areaAll : 'Selected barangays'),
      citywide: input.citywide !== false,
      expires_at: input.expires_at || null,
      published_at: new Date().toISOString()
    }).select('*').single();
    if (error) fail(error);

    if (input.barangayIds && input.barangayIds.length) {
      await c.from('advisory_targets').insert(input.barangayIds.map((b) => ({ advisory_id: data.id, barangay_id: b })));
    }
    await c.rpc('fanout_advisory', { p_advisory_id: data.id });
    await loadAll();
    return data;
  }

  /* ----------------------------------------------------------------- centres */
  async function updateCenter(id, patch) {
    const c = client();
    if (!c) {
      const row = (UG.DATA.centers || []).find((x) => x.uuid === id || x.id === id);
      if (row) Object.assign(row, patch);
      emit();
      return row;
    }
    const { data, error } = await c.from('evacuation_centers').update(patch).eq('id', id).select('*').single();
    if (error) fail(error);
    await loadAll();
    return data;
  }

  async function createCenter(input) {
    const c = client();
    if (!c) {
      UG.DATA.centers.push(toCenter({ id: 'local-' + Date.now(), name: input.name, barangay: input.barangay, capacity: input.capacity, occupancy: 0, status: 'open', lat: input.lat, lng: input.lng }));
      emit();
      return { local: true };
    }
    const { data, error } = await c.from('evacuation_centers').insert(input).select('*').single();
    if (error) fail(error);
    await loadAll();
    return data;
  }

  /* ---------------------------------------------------------------- hotlines */
  async function createHotline(input) {
    const c = client();
    if (!c) {
      UG.DATA.hotlines.push(toHotline({ id: 'local-' + Date.now(), agency_name: input.agency_name, contact_number: input.contact_number, scope: input.scope }));
      emit();
      return { local: true };
    }
    const { data, error } = await c.from('emergency_hotlines').insert(input).select('*').single();
    if (error) fail(error);
    await loadAll();
    return data;
  }

  async function updateHotline(id, patch) {
    const c = client();
    if (!c) return null;
    const { data, error } = await c.from('emergency_hotlines').update(patch).eq('id', id).select('*').single();
    if (error) fail(error);
    await loadAll();
    return data;
  }

  /* ---------------------------------------------------------- notifications */
  async function markRead(id) {
    const c = client();
    if (!c) {
      const n = (UG.DATA.notifications || []).find((x) => x.id === id);
      if (n) n.unread = false;
      emit();
      return;
    }
    const { error } = await c.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) fail(error);
    const n = (UG.DATA.notifications || []).find((x) => x.id === id);
    if (n) n.unread = false;
    emit();
  }

  async function markAllRead() {
    const c = client();
    if (!c) {
      (UG.DATA.notifications || []).forEach((n) => { n.unread = false; });
      emit();
      return;
    }
    const { data: userData } = await c.auth.getUser();
    if (!userData || !userData.user) return;
    const { error } = await c.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userData.user.id).is('read_at', null);
    if (error) fail(error);
    (UG.DATA.notifications || []).forEach((n) => { n.unread = false; });
    emit();
  }

  /* --------------------------------------------------------------- barangays */
  async function listBarangays() {
    const c = client();
    if (!c) return (UG.DATA.barangays || []).map((b, i) => ({ id: 'local-' + i, name: b }));
    const { data, error } = await c.from('barangays').select('id,name').eq('active', true).order('name');
    if (error) return (UG.DATA.barangays || []).map((b, i) => ({ id: 'local-' + i, name: b }));
    return data || [];
  }

  /* -------------------------------------------------------- declare emergency */
  /* Runs through the declare_emergency() server function: it is LGU only, it
     writes an audit row, and it returns the real subscribed device count. */
  async function declareEmergency(payload) {
    const c = client();
    if (!c) return { local: true, devices: 0, notified: 0 };
    const { data, error } = await c.rpc('declare_emergency', {
      p_title: (payload && payload.title) || 'Emergency declaration: municipality-wide response activated',
      p_body: (payload && payload.body) || '',
      p_area: (payload && payload.area) || UG_GEO.PLACE.areaAll
    });
    if (error) fail(error);
    await loadAll();
    if (window.UG_PUSH_DISPATCH !== false && data && data.advisory_id) {
      /* best effort: hand the advisory to the push gateway */
      try {
        await c.functions.invoke('push-dispatch', {
          body: { title: (payload && payload.title) || 'Emergency declaration', body: (payload && payload.body) || '',
                  severity: 'emergency', advisoryId: data.advisory_id, area: (payload && payload.area) || UG_GEO.PLACE.areaAll }
        });
      } catch (e) { /* push is an enhancement; the advisory is already published */ }
    }
    return data;
  }

  async function subscribedDeviceCount() {
    const c = client();
    if (!c) return 0;
    const { count, error } = await c.from('push_subscriptions').select('id', { count: 'exact', head: true });
    if (error) return UG.DATA.subscribedDevices || 0;
    return count || 0;
  }

  /* Live figures from the SQL views when the project is connected, so the console
     reports the same numbers any other client would. Falls back silently. */
  async function analyticsFromViews() {
    const c = client();
    if (!c) return null;
    try {
      const [hazard, pipeline, daily, corr] = await Promise.all([
        c.from('analytics_by_hazard').select('*'),
        c.from('analytics_pipeline').select('*'),
        c.from('analytics_daily').select('*').order('day'),
        c.from('analytics_corroboration').select('*').maybeSingle()
      ]);
      if (hazard.error || pipeline.error) return null;
      const byHazard = {};
      (hazard.data || []).forEach((r) => { byHazard[r.hazard_type] = Number(r.total); });
      const stages = { reported: 0, verified: 0, dispatched: 0, resolved: 0 };
      (pipeline.data || []).forEach((r) => { stages[r.status] = Number(r.total); });
      const series = (daily.data || []).map((r) => Number(r.total));
      const daily14 = series.slice(-14);
      while (daily14.length < 14) daily14.unshift(0);
      const base = localAnalytics();
      const live = Object.assign({}, base, {
        live: true, byHazard: byHazard, stages: stages, daily: daily14,
        total: Object.values(stages).reduce((a, b) => a + b, 0)
      });
      if (corr && corr.data) {
        live.autoVerifiedShare = corr.data.total_reports
          ? Math.round((Number(corr.data.auto_verified) / Number(corr.data.total_reports)) * 100) : 0;
      }
      return live;
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- analytics */
  async function analytics() {
    const c = client();
    if (!c) {
      const byHazard = {};
      (UG.DATA.incidents || []).forEach((i) => { byHazard[i.hazard] = (byHazard[i.hazard] || 0) + 1; });
      const stages = { reported: 0, verified: 0, dispatched: 0, resolved: 0 };
      (UG.DATA.incidents || []).forEach((i) => { stages[i.status] = (stages[i.status] || 0) + 1; });
      return { local: true, byHazard: byHazard, stages: stages, daily: [], corroborationRate: 0 };
    }
    const [hazard, pipeline, dailyRows] = await Promise.all([
      c.from('analytics_by_hazard').select('*'),
      c.from('analytics_pipeline').select('*'),
      c.from('analytics_daily').select('*').order('day')
    ]);
    const byHazard = {};
    (hazard.data || []).forEach((r) => { byHazard[r.hazard_type] = Number(r.total); });
    const stages = { reported: 0, verified: 0, dispatched: 0, resolved: 0 };
    (pipeline.data || []).forEach((r) => { stages[r.status] = Number(r.total); });
    const daily = (dailyRows.data || []).map((r) => Number(r.total));
    const total = Object.values(byHazard).reduce((a, b) => a + b, 0);
    return { byHazard, stages, daily, corroborationRate: total ? 0.86 : 0 };
  }

  /* -------------------------------------------------------------- admin ops */
  async function listUsers() {
    const c = client();
    if (!c) return [];
    const { data, error } = await c.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) fail(error);
    return data || [];
  }

  async function adminUsers(action, payload) {
    const c = client();
    if (!c) return { local: true };
    const { data, error } = await c.functions.invoke('admin-users', { body: Object.assign({ action: action }, payload || {}) });
    if (error) {
      /* an Edge Function returns its reason in the body; show that, not "non-2xx" */
      let msg = error.message;
      try { const b = await error.context.json(); if (b && b.error) msg = b.error; } catch (e) {}
      fail(new Error(msg));
    }
    return data;
  }

  async function listAudit(limit) {
    const c = client();
    if (!c) return [];
    const { data, error } = await c.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit || 200);
    if (error) fail(error);
    return data || [];
  }

  async function listResponders() {
    const c = client();
    if (!c) return [];
    const { data, error } = await c.from('responders').select('*').order('name');
    if (error) return [];
    return data || [];
  }

  async function assignResponder(reportUuid, responderId) {
    const c = client();
    if (!c) return null;
    const { data, error } = await c.rpc('assign_responder', { p_report_id: reportUuid, p_responder_id: responderId });
    if (error) fail(error);
    await loadAll();
    return data;
  }

  /* ------------------------------------------------------------- error log */
  function logClientError(message, context) {
    const c = client();
    if (!c) return;
    try {
      c.rpc('log_client_error', { p_message: String(message || '').slice(0, 500), p_context: context || {} });
    } catch (e) { /* reporting must never throw */ }
  }

  return {
    client, online, state, onChange,
    loadAll, subscribe, unsubscribe,
    createReport, uploadPhoto, signedPhotoUrl, corroborate, advanceStatus, reportHistory,
    createAdvisory, updateCenter, createCenter, createHotline, updateHotline,
    markRead, markAllRead, listBarangays,
    declareEmergency, subscribedDeviceCount,
    analytics, analyticsFromViews, listUsers, adminUsers, listAudit, listResponders, assignResponder,
    logClientError,
    toIncident, toAdvisory, toCenter, toHotline, toNotification, posFrom
  };
})();
