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
  const photoCache = {};   /* storage path -> signed url */

  const state = {
    source: 'local',       /* 'supabase' | 'offline' | 'local' */
    loading: false,
    error: null,
    lastSync: null,
    profile: null,
    /* true once we have ever successfully loaded rows from Supabase in this
       page session. Used by the dashboard to tell "sample seed data" apart
       from "real synced data", and by loadAll() to decide whether a failed
       retry should keep the last-known real data or fall back to the seed. */
    hasSynced: false,
    /* the actual error from the last loadAll attempt, surfaced to the user
       so "Back to Online" no longer fails silently. */
    lastError: null
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
      brgy_id: r.barangay_id || null,
      area: r.area || r.barangay || '',
      status: r.status || 'reported',
      sev: r.severity || 'advisory',
      created_at: r.created_at,
      time: UG_UTIL.relTime(r),
      desc: r.description || '',
      location_note: r.location_note || '',
      corr: typeof r.corroborations === 'number' ? r.corroborations
           : (Array.isArray(r.report_corroborations) ? r.report_corroborations.length : 0),
      thumb: r.photo_path ? 'remote' : null,
      remote_photo: r.photo_path || null,
      photo_url: photoCache[r.photo_path] || null,
      units: r.assigned_units || 0,
      lat: r.lat, lng: r.lng,
      mine: r.is_mine === true,
      x: p.x, y: p.y, r: RADIUS[r.severity || 'advisory'] || 0.09,
      /* escalation policy (migration 036):
         - is_stale: reported > 30 min, never verified
         - is_severity_bypass: life-safety hazard still unverified
         - escalates_to_lgu: either of the above
         - verified_by_name / verified_by_role: who verified it (barangay vs LGU) */
      is_stale: r.is_stale === true,
      is_severity_bypass: r.is_severity_bypass === true,
      escalates_to_lgu: r.escalates_to_lgu === true,
      verified_by_name: r.verified_by_name || '',
      verified_by_role: r.verified_by_role || '',
      verified_at: r.verified_at || null
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
      time: UG_UTIL.relTime(a.published_at || a.created_at),
      /* Module F: alert_type + language so the published list and citizen inbox
         can render the right category icon and language label. */
      alert_type: a.alert_type || 'general',
      language: a.language || 'en'
    };
  }

  function toCenter(c) {
    /* facilities may arrive as a Postgres text[] (already an array) or as a
       comma-separated string; normalise to an array so the card always renders
       the same way. contact_person + contact_phone power the new Module D
       contact row on the center card. */
    let facilities = c.facilities;
    if (typeof facilities === 'string') facilities = facilities.split(',').map((s) => s.trim()).filter(Boolean);
    else if (!Array.isArray(facilities)) facilities = facilities ? [String(facilities)] : [];
    return {
      id: c.id, uuid: c.id,
      name: c.name || '',
      brgy: c.barangay || '',
      status: c.status || 'open',
      occ: c.occupancy || 0,
      cap: c.capacity || 0,
      note: c.note || '',
      lat: c.lat, lng: c.lng,
      facilities: facilities,
      contact_person: c.contact_person || '',
      contact_phone: c.contact_phone || ''
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
      type: n.type || '',
      created_at: n.created_at,
      time: UG_UTIL.relTime(n),
      unread: !n.read_at,
      report_id: n.report_id,
      advisory_id: n.advisory_id,
      road_work_id: n.road_work_id,
      sos_id: n.sos_id,
      relief_id: n.relief_id
    };
  }

  /* -------------------------------------------- new feature table shape adapters */
  function toRelief(r) {
    const arr = (v) => Array.isArray(v) ? v : (function () {
      try { return JSON.parse(v || '[]'); } catch (e) { return []; }
    })();
    return {
      id: r.id, barangay: r.barangay || '', title: r.title || '',
      location_name: r.location_name || '', address: r.address || '',
      lat: r.lat, lng: r.lng,
      distribution_at: r.distribution_at,
      contact_person: r.contact_person || '', contact_phone: r.contact_phone || '',
      eligibility: arr(r.eligibility), required_docs: arr(r.required_docs),
      note: r.note || '', active: r.active !== false
    };
  }
  function toBeneficiary(b) {
    return {
      id: b.id, barangay: b.barangay || '',
      beneficiary_name: b.beneficiary_name || '',
      claimant_name: b.claimant_name || '',
      claimant_id: b.claimant_id || '',
      category: b.category || '',
      valid_until: b.valid_until,
      active: b.active !== false
    };
  }
  function toGuide(g) {
    return {
      id: g.id, hazard_type: g.hazard_type || '', phase: g.phase || 'all',
      title: g.title || '', body: g.body || '',
      summary: g.summary || '',
      body_before: g.body_before || '', body_during: g.body_during || '', body_after: g.body_after || '',
      pdf_path: g.pdf_path || null,
      sort_order: g.sort_order || 0, active: g.active !== false
    };
  }
  function toFaq(f) {
    return {
      id: f.id, category: f.category || 'General',
      question: f.question || '', answer: f.answer || '',
      sort_order: f.sort_order || 0, active: f.active !== false
    };
  }
  function toRoadWork(r) {
    return {
      id: r.id, title: r.title || '', description: r.description || '',
      barangay: r.barangay || '', road_name: r.road_name || '', address: r.address || '',
      lat: r.lat, lng: r.lng,
      expected_start: r.expected_start, expected_end: r.expected_end,
      citywide: r.citywide === true, status: r.status || 'active',
      time: UG_UTIL.relTime(r.created_at ? { created_at: r.created_at } : r)
    };
  }
  function toRoadStatus(r) {
    return {
      id: r.id, road_name: r.road_name || '', barangay: r.barangay || '',
      barangay_id: r.barangay_id || null,
      status: r.status || 'passable', note: r.note || '',
      segment_from: r.segment_from || '', segment_to: r.segment_to || '',
      cause: r.cause || '', severity: r.severity || 'advisory',
      started_at: r.started_at, estimated_reopen: r.estimated_reopen,
      updater_name: r.updater_name || '',
      lat: r.lat, lng: r.lng, updated_at: r.updated_at
    };
  }

  /* ------------------------------------------------------------- hydration */
  function recomputeKpis() {
    const inc = UG.DATA.incidents || [];
    const c = UG.DATA.counts || {};
    const active = (c.openIncidents != null) ? c.openIncidents : inc.filter((i) => i.status !== 'resolved' && i.status !== 'rejected').length;
    const critical = (c.emergency != null) ? c.emergency : inc.filter((i) => i.sev === 'emergency' && i.status !== 'resolved' && i.status !== 'rejected').length;
    const units = (c.units != null) ? c.units : inc.reduce((n, i) => n + (i.units || 0), 0);
    const dispatched = (c.dispatchedTeams != null) ? c.dispatchedTeams : 0;
    const live = state.source === 'supabase';
    UG.DATA.kpis = [
      { label: 'Active Incidents', value: String(active), delta: live ? 'Live from the incident queue' : 'From the cached queue', dir: 'flat', tone: 'emergency', icon: 'alert', nav: 'incidents' },
      { label: 'Units Deployed', value: String(units), delta: dispatched > 0 ? dispatched + ' dispatched team' + (dispatched === 1 ? '' : 's') + ' + assigned responders' : 'Assigned responders + dispatched teams', dir: 'flat', tone: 'verified', icon: 'users', nav: 'dispatch-units' },
      { label: 'Critical Areas', value: String(critical), delta: 'Emergency severity, not resolved', dir: 'flat', tone: 'warning', icon: 'shieldx', nav: 'incidents' },
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
    /* "Units Deployed" now reflects BOTH the responder assignments
       (report_assignments → i.units) AND every dispatched response team
       (report_dispatches → UG.DATA.dispatches). Before this, dispatching a
       team wrote to a different table and the KPI never moved. */
    const dispatchCount = totalDispatchedTeams();
    const assignedUnits = inc.reduce((n, i) => n + (i.units || 0), 0);
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
      units: assignedUnits + dispatchCount,
      dispatchedTeams: dispatchCount,
      unread: (UG.DATA.notifications || []).filter((n) => n.unread).length
    };
  }

  /* total number of dispatched response-team records across every incident.
     UG.DATA.dispatches is keyed by report uuid, each value an array of
     dispatch records. Each record = one deployed unit. */
  function totalDispatchedTeams() {
    const d = UG.DATA.dispatches;
    if (!d) return 0;
    let n = 0;
    Object.keys(d).forEach((k) => { n += (d[k] && d[k].length) || 0; });
    return n;
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
      autoVerifiedShare: pct(inc.filter((i) => ['verified', 'dispatched', 'resolved'].indexOf(i.status) !== -1).length),
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
      /* only seed the demo data if we have nothing else to show */
      if (!(UG.DATA.incidents && UG.DATA.incidents.length)) reseedLocal();
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

      const [reports, advisories, centers, hotlines, notifications, subscriptions, assignments, relief, beneficiaries, guides, faqs, roadWork, roadStatus] = await Promise.all([
        reportsQuery,
        c.from('advisories').select('*').order('published_at', { ascending: false }).limit(100),
        c.from('evacuation_centers').select('*').order('name'),
        c.from('emergency_hotlines').select('*').order('agency_name'),
        c.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
        c.from('push_subscriptions').select('id', { count: 'exact', head: true }),
        c.from('report_assignments').select('report_id').is('released_at', null),
        c.from('relief_distributions').select('*').order('distribution_at', { ascending: false }).limit(100),
        c.from('authorized_beneficiaries').select('*').order('barangay, beneficiary_name').limit(800),
        c.from('preparedness_guides').select('*').order('hazard_type, phase, sort_order').limit(300),
        c.from('faqs').select('*').order('sort_order, created_at').limit(100),
        c.from('road_work_posts').select('*').order('created_at', { ascending: false }).limit(60),
        c.from('road_status').select('*').order('updated_at', { ascending: false }).limit(120)
      ]);
      /* load change requests in parallel — the Super Admin hotlines page and
         the LGU/BO "your pending requests" section both read this. */
      try { await loadChangeRequests(); } catch (e) {}

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
      /* the new feature tables. Each is best-effort: if the migration has not
         been applied yet, the table is missing and we keep whatever was already
         in the store (the seeded defaults from the feature module). */
      if (relief && !relief.error && relief.data) UG.DATA.relief = relief.data.map(toRelief);
      if (beneficiaries && !beneficiaries.error && beneficiaries.data) UG.DATA.beneficiaries = beneficiaries.data.map(toBeneficiary);
      if (guides && !guides.error && guides.data) UG.DATA.guides = guides.data.map(toGuide);
      if (faqs && !faqs.error && faqs.data) UG.DATA.faqs = faqs.data.map(toFaq);
      if (roadWork && !roadWork.error && roadWork.data) UG.DATA.roadWork = roadWork.data.map(toRoadWork);
      if (roadStatus && !roadStatus.error && roadStatus.data) UG.DATA.roadStatus = roadStatus.data.map(toRoadStatus);
      UG.DATA.subscribedDevices = subscriptions && !subscriptions.error ? (subscriptions.count || 0) : 0;
      UG.DATA.scope = { role: role, barangay_id: brgyId };

      recomputeKpis();
      refreshDerived();
      state.source = 'supabase';
      state.hasSynced = true;
      state.lastError = null;
      state.loading = false;
      state.lastSync = new Date().toISOString();
      if (window.UG_CACHE) window.UG_CACHE.storeSnapshot(UG.DATA);
      emit();
      resolvePhotos();

      subscribe();
      return state;
    } catch (e) {
      /* A failed retry must NOT overwrite real data we already loaded. Only
         reseed the sample data on the very first boot, when the store is still
         empty — once we have synced even once, keep the last-known real rows
         so the dashboard still shows live records instead of demo text. */
      state.lastError = (e && e.message) || 'Could not reach the server';
      state.error = state.lastError;
      const isEmpty = !(UG.DATA.incidents && UG.DATA.incidents.length) && !state.hasSynced;
      if (isEmpty) {
        state.source = 'offline';
        reseedLocal();
      } else {
        /* keep the last-known real data; only flip the source flag so the
           connectivity banner shows "offline" without nuking the dashboard. */
        state.source = 'offline';
        recomputeKpis();
        refreshDerived();
      }
      state.loading = false;
      emit();
      return state;
    }
  }
    async function resolvePhotos() {
    const c = client();
    if (!c) return;
    const need = (UG.DATA.incidents || []).filter((i) => i.remote_photo && !photoCache[i.remote_photo]);
    if (!need.length) return;
    const paths = Array.from(new Set(need.map((i) => i.remote_photo)));
    const { data, error } = await c.storage.from('reports').createSignedUrls(paths, 3600);
    if (error || !data) return;
    data.forEach((row) => { if (row.signedUrl && row.path) photoCache[row.path] = row.signedUrl; });
    (UG.DATA.incidents || []).forEach((i) => { if (i.remote_photo) i.photo_url = photoCache[i.remote_photo] || null; });
    emit();
  }

  /* ------------------------------------------------------------- realtime */
  function subscribe() {
    const c = client();
    if (!c || subscribed) return;
    try {
      channel = c.channel('uniguard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'report_corroborations' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'advisories' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'evacuation_centers' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'relief_distributions' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'authorized_beneficiaries' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'preparedness_guides' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'faqs' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'road_work_posts' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'road_status' }, () => loadAll())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_log' }, () => loadAll())
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
        created_at: new Date().toISOString(), corroborations: 1, is_mine: true   // <-- added
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
      location_note: input.location_note || null,
      lat: input.lat, lng: input.lng,
      photo_path: photo_path
    };

    let ins = await c.from('reports').insert(payload).select('*').single();
    /* migration 027 not applied yet? retry without location_note so reports
       keep flowing until the live project is migrated. */
    if (ins.error && /location_note|column/i.test(ins.error.message || '')) {
      delete payload.location_note;
      ins = await c.from('reports').insert(payload).select('*').single();
    }
    if (ins.error) fail(ins.error);
    const data = ins.data;

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

  async function corroborate(reportUuid, note, pos) {
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
        const { data, error } = await c.rpc('corroborate_report', {
      p_report_id: reportUuid, p_note: note || '',
      p_lat: pos ? pos.lat : null, p_lng: pos ? pos.lng : null
    });
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

  /* LGU-only second verification path (migration 036). Moves reported -> verified
     and stamps verified_by_role = 'lgu_ldrrmc' so the audit log + incident
     detail can tell a barangay verify from an LGU verify. */
  async function lguVerify(reportUuid, note) {
    const c = client();
    if (!c) {
      const row = (UG.DATA.incidents || []).find((i) => i.uuid === reportUuid || i.id === reportUuid);
      if (row && row.status === 'reported') {
        row.status = 'verified';
        row.verified_by_role = 'lgu_ldrrmc';
        row.verified_by_name = (Auth.state.session && Auth.state.session.name) || 'LGU';
        row.verified_at = new Date().toISOString();
      }
      recomputeKpis();
      emit();
      return row;
    }
    const { data, error } = await c.rpc('lgu_verify_report', {
      p_report_id: reportUuid, p_note: note || ''
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

  /* Edit an existing report. Citizens may edit their own row for 15 minutes
     (enforced again by guard_report_edit in migration 027); officials in scope
     and LGU may edit through the same policy. Only whitelisted columns are
     ever sent. Barangay is derived server side from the coordinates. */
  async function updateReport(reportUuid, patch) {
    const allowed = ['description', 'hazard_type', 'hazard_other_text', 'location_note',
      'lat', 'lng', 'severity', 'urgency', 'photo_path'];
    const clean = {};
    allowed.forEach((k) => { if (patch[k] !== undefined) clean[k] = patch[k]; });
    const c = client();
    if (!c) {
      const row = (UG.DATA.incidents || []).find((i) => i.uuid === reportUuid || i.id === reportUuid);
      if (row) {
        if (clean.description != null) row.desc = clean.description;
        if (clean.severity != null) row.sev = clean.severity;
      }
      emit();
      return row || null;
    }
    let upd = await c.from('reports').update(clean).eq('id', reportUuid).select('*').single();
    /* migration 027 not applied yet? retry without location_note. */
    if (upd.error && /location_note|column/i.test(upd.error.message || '')) {
      delete clean.location_note;
      upd = await c.from('reports').update(clean).eq('id', reportUuid).select('*').single();
    }
    if (upd.error) fail(upd.error);
    const data = upd.data;
    await loadAll();
    return data;
  }

  /* -------------------------------------------------------------- advisories */
  /* advisories.delivery_mode only accepts 'push' | 'in_app' (migration 048). */
  function normaliseDeliveryMode(v) {
    return /^in[-_ ]?app$|^app$/i.test(String(v || '').trim()) ? 'in_app' : 'push';
  }

  async function createAdvisory(input) {
    input = Object.assign({}, input, { delivery_mode: normaliseDeliveryMode(input.delivery_mode) });
    const c = client();
    if (!c) {
      UG.DATA.advisories.unshift({
        id: 'local-' + Date.now(), title: input.title, body: input.body, severity: input.severity,
        type: input.kind === 'preparedness' ? 'Preparedness' : 'Emergency', kind: input.kind,
        area: input.affected_area, citywide: input.citywide, created_at: new Date().toISOString(),
        time: 'just now',
        /* Module F additions: the alert category (weather advisory / evacuation
           order / road closure / general) and the publish language, so the
           published list + citizen inbox can show the right icon + language. */
        alert_type: input.alert_type || 'general',
        language: input.language || 'en',
        /* delivery preference: push (default) or in_app */
        delivery_mode: input.delivery_mode || 'push'
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
      published_at: new Date().toISOString(),
      alert_type: input.alert_type || 'general',
      language: input.language || 'en',
      /* delivery preference — 'push' or 'in_app' (column added by
         migration 048; without it PostgREST rejects the insert). */
      delivery_mode: input.delivery_mode
    }).select('*').single();
    if (error) fail(error);

    if (input.barangayIds && input.barangayIds.length) {
      await c.from('advisory_targets').insert(input.barangayIds.map((b) => ({ advisory_id: data.id, barangay_id: b })));
    }
    /* fan out the in-app notification to targeted residents */
    await c.rpc('fanout_advisory', { p_advisory_id: data.id });

    /* Web Push — sent ONLY when the duty officer picked "push" delivery.
       The DOCX asks for a choice: emergency advisories push, informational
       advisories stay in the inbox without a push. Honoured here so the
       publish path matches what the composer let the user select. */
    if (input.delivery_mode === 'push' && window.UG_PUSH_DISPATCH !== false) {
      try {
        await c.functions.invoke('push-dispatch', {
          body: {
            title: input.title,
            body: input.body,
            severity: input.severity || 'advisory',
            advisoryId: data.id,
            area: input.affected_area || UG_GEO.PLACE.areaAll,
            url: './index.html#/advisory-detail'
          }
        });
      } catch (e) { /* push is an enhancement; the advisory + in-app fan-out already succeeded */ }
    }

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
      UG.DATA.centers.push(toCenter({ id: 'local-' + Date.now(), name: input.name, barangay: input.barangay, capacity: input.capacity, occupancy: 0, status: 'open', lat: input.lat, lng: input.lng, facilities: input.facilities, contact_person: input.contact_person, contact_phone: input.contact_phone, note: input.note }));
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
    if (!c) { const h = (UG.DATA.hotlines || []).find((x) => x.uuid === id || x.id === id); if (h) Object.assign(h, patch); emit(); return h; }
    const { data, error } = await c.from('emergency_hotlines').update(patch).eq('id', id).select('*').single();
    if (error) fail(error);
    await loadAll();
    return data;
  }

  async function deleteHotline(id) {
    const c = client();
    if (!c) { UG.DATA.hotlines = (UG.DATA.hotlines || []).filter((h) => !(h.uuid === id || h.id === id)); emit(); return; }
    const { error } = await c.from('emergency_hotlines').delete().eq('id', id);
    if (error) fail(error);
    await loadAll();
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
    const title = (payload && payload.title) || 'Emergency declaration: municipality-wide response activated';
    const body = (payload && payload.body) ||
      'The Municipal DRRMO has declared a municipality-wide emergency. Follow official instructions, move to the nearest open evacuation center if advised, and keep monitoring UniGuard advisories.';
    const area = (payload && payload.area) || UG_GEO.PLACE.areaAll;
    const { data, error } = await c.rpc('declare_emergency', { p_title: title, p_body: body, p_area: area });
    if (error) fail(error);
    await loadAll();
    if (window.UG_PUSH_DISPATCH !== false && data && data.advisory_id) {
      /* best effort: hand the advisory to the push gateway */
      try {
        await c.functions.invoke('push-dispatch', {
          body: { title: title, body: body, severity: 'emergency', advisoryId: data.advisory_id, area: area }
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
  /* Date-ranged analytics over the scoped SQL functions from migration 024.
     Scope (LGU = municipality-wide, official = own barangay, citizen = none)
     is enforced inside the functions; the UI only reflects it. */
  async function analytics(fromISO, toISO) {
    const from = fromISO || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const to = toISO || new Date().toISOString().slice(0, 10);
    const c = client();
    if (!c) {
      const byHazard = {};
      const inc = UG.DATA.incidents || [];
      inc.forEach((i) => { byHazard[i.hazard] = (byHazard[i.hazard] || 0) + 1; });
      const stages = { reported: 0, verified: 0, dispatched: 0, resolved: 0, rejected: 0 };
      inc.forEach((i) => { stages[i.status] = (stages[i.status] || 0) + 1; });
      const corroborationRate = inc.length
        ? Math.round(inc.filter((i) => (i.corr || 0) >= 3).length / inc.length * 100)
        : 0;
      return { local: true, from: from, to: to, byHazard: byHazard, stages: stages, daily: [], corroborationRate: corroborationRate, avgDispatchSeconds: null, avgResolveSeconds: null, byBarangay: [], shelters: null };
    }
    const [hazard, pipeline, dailyRows, resp, corr, byBrgy, shelters] = await Promise.all([
      c.rpc('analytics_by_hazard', { p_from: from, p_to: to }),
      c.rpc('analytics_pipeline', { p_from: from, p_to: to }),
      c.rpc('analytics_daily', { p_from: from, p_to: to }),
      c.rpc('analytics_response_times', { p_from: from, p_to: to }),
      c.rpc('analytics_corroboration', { p_from: from, p_to: to }),
      c.rpc('analytics_by_barangay', { p_from: from, p_to: to }),
      c.rpc('analytics_shelters', { p_from: from, p_to: to })
    ]);
    const e = [hazard, pipeline, dailyRows].find((r) => r.error);
    /* migration 024 not applied yet? fall back to the (older) analytics views
       so the screen keeps working until the live project is migrated. */
    if (e && /does not exist|schema cache/i.test(e.error && e.error.message || '')) {
      const legacy = await analyticsFromViews();
      if (legacy) return Object.assign(legacy, { from: from, to: to });
    }
    if (e) fail(e.error);

    const byHazard = {};
    (hazard.data || []).forEach((r) => { byHazard[r.hazard_type] = Number(r.total); });
    const stages = { reported: 0, verified: 0, dispatched: 0, resolved: 0, rejected: 0 };
    (pipeline.data || []).forEach((r) => { stages[r.status] = Number(r.total); });
    const daily = (dailyRows.data || []).map((r) => ({ day: r.day, total: Number(r.total) }));

    let avgDispatchSeconds = null, avgResolveSeconds = null;
    if (resp && !resp.error && resp.data) {
      const d = resp.data.map((r) => Number(r.seconds_to_dispatch)).filter((n) => isFinite(n) && n >= 0);
      const s = resp.data.map((r) => Number(r.seconds_to_resolve)).filter((n) => isFinite(n) && n >= 0);
      avgDispatchSeconds = d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null;
      avgResolveSeconds = s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
    }
    let corroborationRate = 0, autoVerified = 0, totalReports = 0;
    if (corr && !corr.error && corr.data && corr.data.length && Number(corr.data[0].total_reports)) {
      totalReports = Number(corr.data[0].total_reports);
      autoVerified = Number(corr.data[0].auto_verified);
      corroborationRate = Math.round(autoVerified / totalReports * 100);
    }
    const byBarangay = (byBrgy && !byBrgy.error ? byBrgy.data : []).map((r) => ({
      barangay: r.barangay, total: Number(r.total), open: Number(r.open_total), emergency: Number(r.emergency_total)
    }));
    const shelterRows = (shelters && !shelters.error ? shelters.data : []).map((r) => ({
      status: r.status, centres: Number(r.centres), capacity: Number(r.capacity), occupancy: Number(r.occupancy)
    }));

    return { from: from, to: to, byHazard: byHazard, stages: stages, daily: daily,
      corroborationRate: corroborationRate, autoVerified: autoVerified, totalReports: totalReports,
      avgDispatchSeconds: avgDispatchSeconds, avgResolveSeconds: avgResolveSeconds,
      byBarangay: byBarangay, shelters: shelterRows };
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
    /* Pass the current origin as redirectUrl so the invitation email's
       "Accept Invitation" button points back to the site that sent the
       invite (localhost:5500 during dev, the Netlify URL in production).
       The edge function reads this and forwards it to Supabase Auth's
       inviteUserByEmail(). */
    const body = Object.assign({ action: action }, payload || {});
    if (action === 'create' || action === 'unit-invite') {
      body.redirectUrl = (typeof window !== 'undefined' ? window.location.origin : '') || UG_CONFIG.APP_PUBLIC_URL;
    }
    const { data, error } = await c.functions.invoke('admin-users', { body: body });
    if (error) {
      /* an Edge Function returns its reason in the body; show that, not "non-2xx" */
      let msg = error.message;
      try { const b = await error.context.json(); if (b && b.error) msg = b.error; } catch (e) {}
      fail(new Error(msg));
    }
    return data;
  }

  /* Activity Log rows, newest first, in one shape:
     { id, created_at, actor_id, actor_name, actor_role, actor_unit_role,
       actor_barangay, action, entity, entity_id, meta }.
     1. the audit_log_with_actor view (migration 045);
     2. audit_log with the actor's profile embedded (view missing);
     3. plain audit_log rows without actor details (is_super_admin missing).
     Throws (-> error panel) only when every source fails. */
  async function listAudit(limit) {
    const c = client();
    if (!c) return [];
    const n = limit || 500;
    const shape = (a, p) => {
      p = p || {};
      let actorRole = a.actor_role || p.role || '';
      if (!a.actor_role && p.role === 'lgu_ldrrmc' && p.is_super_admin === true) actorRole = 'super_admin';
      return {
        id: a.id, created_at: a.created_at, actor_id: a.actor_id,
        actor_name: a.actor_name || p.full_name || null,
        actor_role: actorRole,
        actor_unit_role: a.actor_unit_role || p.unit_role || '',
        actor_barangay: a.actor_barangay || p.barangay || '',
        action: a.action, entity: a.entity, entity_id: a.entity_id, meta: a.meta
      };
    };

    let r = await c.from('audit_log_with_actor').select('*')
      .order('created_at', { ascending: false }).limit(n);
    if (!r.error && r.data) return r.data.map((a) => shape(a, null));
    console.warn('[UniGuard] audit_log_with_actor unavailable, using audit_log', r.error);

    r = await c.from('audit_log')
      .select('id, created_at, actor_id, action, entity, entity_id, meta, actor:profiles ( full_name, role, is_super_admin, unit_role, barangay )')
      .order('created_at', { ascending: false }).limit(n);
    if (!r.error && r.data) return r.data.map((a) => shape(a, a.actor));
    console.warn('[UniGuard] audit_log with actor embed failed, using plain rows', r.error);

    r = await c.from('audit_log').select('*').order('created_at', { ascending: false }).limit(n);
    if (r.error) fail(r.error);
    return (r.data || []).map((a) => shape(a, null));
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
    /* ---------------------------------------------------------------- dispatch */
  async function dispatchReport(reportUuid, input) {
    const c = client();
    if (!c) {
      /* offline preview: move the incident locally and keep the record */
      const row = (UG.DATA.incidents || []).find((i) => i.uuid === reportUuid || i.id === reportUuid);
      if (row && row.status === 'verified') row.status = 'dispatched';
      UG.DATA.dispatches = UG.DATA.dispatches || {};
      const list = UG.DATA.dispatches[reportUuid] = UG.DATA.dispatches[reportUuid] || [];
      list.unshift({
        id: 'local-' + Date.now(), report_id: reportUuid, team: input.team,
        instructions: input.instructions, eta: input.eta,
        dispatched_by_name: (Auth.state.session && Auth.state.session.name) || '',
        dispatched_at: new Date().toISOString()
      });
      UG.DATA.counts = computeCounts();
      recomputeKpis(); emit();
      return { local: true };
    }
    const { data, error } = await c.rpc('dispatch_report', {
      p_report_id: reportUuid, p_team: input.team,
      p_instructions: input.instructions, p_eta: input.eta
    });
    if (error) fail(error);
    await loadAll();
    await loadDispatches(reportUuid);
    return data;
  }

  async function loadDispatches(reportUuid) {
    UG.DATA.dispatches = UG.DATA.dispatches || {};
    const c = client();
    if (!c || !reportUuid) return UG.DATA.dispatches[reportUuid] || [];
    const { data, error } = await c.from('report_dispatches')
      .select('*').eq('report_id', reportUuid).order('dispatched_at', { ascending: false });
    if (!error) UG.DATA.dispatches[reportUuid] = data || [];
    /* recompute the Units Deployed KPI so the dashboard reflects the new
       dispatch immediately, not just on the next full loadAll(). */
    UG.DATA.counts = computeCounts();
    recomputeKpis();
    emit();
    return UG.DATA.dispatches[reportUuid] || [];
  }

  /* -------------------------------------------------- dispatch v2 + directory */
  async function dispatchReportV2(reportUuid, input) {
    const c = client();
    if (!c) {
      /* offline preview: behave like the old dispatchReport path */
      return dispatchReport(reportUuid, input);
    }
    const { data, error } = await c.rpc('dispatch_report_v2', {
      p_report_id: reportUuid,
      p_team: input.team,
      p_instructions: input.instructions,
      p_eta: input.eta,
      p_unit_id: input.unit_id || null,
      p_target_barangay_id: input.target_barangay_id || null,
      p_equipment_ids: input.equipment_ids || null
    });
    if (error) fail(error);
    await loadAll();
    await loadDispatches(reportUuid);
    return data;
  }

  async function loadDispatchDirectory() {
    const c = client();
    if (!c) return;
    try {
      const [units, equipment, requests, helpReqs, escorts] = await Promise.all([
        c.from('dispatch_units').select('*').order('unit_type', { ascending: true }),
        c.from('dispatch_equipment').select('*').order('created_at', { ascending: false }),
        c.from('unit_requests').select('*').order('created_at', { ascending: false }).limit(50),
        /* A2 (Oct 24 2026): dispatch help requests. RLS lets the LGU see all. */
        c.from('dispatch_help_requests').select('*').order('created_at', { ascending: false }).limit(50),
        /* D3 (Oct 24 2026): relief distributions with escort_status active.
           The existing relief loader already pulls everything; we just
           refresh here so the LGU console's escort list is current. */
        c.from('relief_distributions').select('*').order('distribution_at', { ascending: false }).limit(100)
      ]);
      UG.DATA.dispatchUnits = units.data || [];
      UG.DATA.dispatchEquipment = equipment.data || [];
      UG.DATA.unitRequests = requests.data || [];
      UG.DATA.dispatchHelpRequests = helpReqs.data || [];
      if (escorts.data) UG.DATA.relief = escorts.data.map(toRelief);
      emit();
    } catch (e) { /* directory is a read-only convenience */ }
  }

  /* ----------------------------------------------------- change requests
   * Master prompt · Emergency Hotlines Management and Super Admin Approval.
   * Loads pending + recent change requests so the Super Admin hotlines page
   * can show the queue, and so LGU/BO can see their own submitted requests. */
  async function loadChangeRequests() {
    const c = client();
    if (!c) return;
    try {
      const { data, error } = await c.from('change_requests')
        .select('*').order('created_at', { ascending: false }).limit(100);
      if (!error) UG.DATA.changeRequests = data || [];
    } catch (e) { /* read-only convenience */ }
  }

  async function submitChangeRequest(payload) {
    const c = client();
    if (!c) return { local: true };
    const { data, error } = await c.rpc('submit_change_request', {
      p_target_table: payload.target_table,
      p_action: payload.action,
      p_target_id: payload.target_id || null,
      p_current_data: payload.current_data || {},
      p_proposed_data: payload.proposed_data || {},
      p_reason: payload.reason || ''
    });
    if (error) fail(error);
    return data;
  }

  async function approveChangeRequest(requestId, note) {
    const c = client();
    if (!c) return { local: true };
    const { data, error } = await c.rpc('approve_change_request', {
      p_request_id: requestId, p_decision_note: note || ''
    });
    if (error) fail(error);
    return data;
  }

  async function rejectChangeRequest(requestId, note) {
    const c = client();
    if (!c) return { local: true };
    const { data, error } = await c.rpc('reject_change_request', {
      p_request_id: requestId, p_decision_note: note || ''
    });
    if (error) fail(error);
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

  /* ---------------------------------- relief / beneficiaries / guides / faqs / roadwork / sos */
  /* Each create/update/delete follows the same pattern: optimistic local write
     so the UI reflects the change immediately, then a server round-trip; on
     failure the next loadAll will resync from the source of truth. */
  function localReliefAdd(input) {
    const row = toRelief(Object.assign({ id: 'local-' + Date.now() }, input, { active: true }));
    UG.DATA.relief.unshift(row); emit();
  }
  async function createRelief(input) {
    const c = client();
    if (!c) { localReliefAdd(input); return { local: true }; }
    const { data, error } = await c.from('relief_distributions').insert(adaptRelief(input)).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }
  async function updateRelief(id, patch) {
    const c = client();
    if (!c) { const r = (UG.DATA.relief || []).find((x) => x.id === id); if (r) Object.assign(r, patch); emit(); return r; }
    const { data, error } = await c.from('relief_distributions').update(adaptRelief(patch)).eq('id', id).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }
  function adaptRelief(input) {
    const out = {};
    ['title','barangay','location_name','address','lat','lng','distribution_at','contact_person','contact_phone','note','active'].forEach((k) => {
      if (input[k] !== undefined) out[k] = input[k];
    });
    if (input.eligibility) out.eligibility = JSON.stringify(input.eligibility);
    if (input.required_docs) out.required_docs = JSON.stringify(input.required_docs);
    return out;
  }
  async function createBeneficiary(input) {
    const c = client();
    if (!c) { UG.DATA.beneficiaries.push(toBeneficiary(Object.assign({ id: 'local-' + Date.now() }, input))); emit(); return { local: true }; }
    const { data, error } = await c.from('authorized_beneficiaries').insert(input).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }
  async function deleteBeneficiary(id) {
    const c = client();
    if (!c) { UG.DATA.beneficiaries = (UG.DATA.beneficiaries || []).filter((b) => b.id !== id); emit(); return; }
    const { error } = await c.from('authorized_beneficiaries').delete().eq('id', id);
    if (error) fail(error);
    await loadAll();
  }

  async function createGuide(input) {
    const c = client();
    if (!c) { UG.DATA.guides.push(toGuide(Object.assign({ id: 'local-' + Date.now() }, input))); emit(); return { local: true }; }
    const { data, error } = await c.from('preparedness_guides').insert(input).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }
  async function updateGuide(id, patch) {
    const c = client();
    if (!c) { const g = (UG.DATA.guides || []).find((x) => x.id === id); if (g) Object.assign(g, patch); emit(); return g; }
    const { data, error } = await c.from('preparedness_guides').update(patch).eq('id', id).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }

  async function createFaq(input) {
    const c = client();
    if (!c) { UG.DATA.faqs.push(toFaq(Object.assign({ id: 'local-' + Date.now() }, input))); emit(); return { local: true }; }
    const { data, error } = await c.from('faqs').insert(input).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }
  async function updateFaq(id, patch) {
    const c = client();
    if (!c) { const f = (UG.DATA.faqs || []).find((x) => x.id === id); if (f) Object.assign(f, patch); emit(); return f; }
    const { data, error } = await c.from('faqs').update(patch).eq('id', id).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }
  async function deleteFaq(id) {
    const c = client();
    if (!c) { UG.DATA.faqs = (UG.DATA.faqs || []).filter((f) => f.id !== id); emit(); return; }
    const { error } = await c.from('faqs').delete().eq('id', id);
    if (error) fail(error);
    await loadAll();
  }

  async function createRoadWork(input) {
    const c = client();
    if (!c) { UG.DATA.roadWork.unshift(toRoadWork(Object.assign({ id: 'local-' + Date.now(), created_at: new Date().toISOString(), status: 'active' }, input))); emit(); return { local: true }; }
    const { data: userData } = await c.auth.getUser();
    /* Build the payload. The bug reported by the barangay official was that
       publishing a road work post threw an error. The root cause: the form
       never sent `barangay_id` to the insert, so the road_work_posts NOT NULL
       FK constraint (migration 012 + the barangay-scoping trigger in 026)
       rejected the row. Resolve the barangay_id from the authenticated
       session when the form only carries the barangay NAME. */
    let barangayId = input.barangay_id || null;
    if (!barangayId && input.barangay) {
      try {
        const { data: brgy } = await c.from('barangays').select('id').eq('name', input.barangay).maybeSingle();
        if (brgy && brgy.id) barangayId = brgy.id;
      } catch (e) { /* fall through: insert with a NULL barangay_id only for
                       municipality-wide posts; the trigger will accept it. */ }
    }
    /* citywide posts have no barangay; otherwise the barangay_id is required. */
    if (!input.citywide && !input.barangay) {
      throw new Error('A barangay is required for a non-citywide road work post.');
    }
    const payload = Object.assign({}, input, {
      author_id: userData && userData.user ? userData.user.id : null,
      barangay_id: barangayId,
      /* never let a stale draft override these computed fields */
      expected_start: input.expected_start || new Date().toISOString(),
      expected_end: input.expected_end || new Date(Date.now() + (parseFloat(input.expected_hours) || 6) * 3600000).toISOString(),
      status: 'active'
    });
    /* the in-memory draft may carry `expected_hours` (a UI-only helper) and
       a `barangay` text field that are NOT columns on road_work_posts — strip
       them so the insert does not fail on unknown columns. */
    delete payload.expected_hours;
    const { data, error } = await c.from('road_work_posts').insert(payload).select('*').single();
    if (error) fail(error);
    /* fan out a notification to residents of the affected barangay */
    try { await c.rpc('fanout_road_work', { p_post_id: data.id }); } catch (e) {}
    await loadAll(); return data;
  }

  async function createRoadStatus(input) {
    const c = client();
    if (!c) { UG.DATA.roadStatus.unshift(toRoadStatus(Object.assign({ id: 'local-' + Date.now() }, input))); emit(); return { local: true }; }
    const { data: userData } = await c.auth.getUser();
    const payload = Object.assign({}, input, { updated_by: userData && userData.user ? userData.user.id : null });
    const { data, error } = await c.from('road_status').insert(payload).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }
  async function updateRoadStatus(id, patch) {
    const c = client();
    if (!c) { const r = (UG.DATA.roadStatus || []).find((x) => x.id === id); if (r) Object.assign(r, patch); emit(); return r; }
    const { data, error } = await c.from('road_status').update(patch).eq('id', id).select('*').single();
    if (error) fail(error);
    await loadAll(); return data;
  }
  async function deleteRoadStatus(id) {
    const c = client();
    if (!c) { UG.DATA.roadStatus = (UG.DATA.roadStatus || []).filter((r) => r.id !== id); emit(); return; }
    const { error } = await c.from('road_status').delete().eq('id', id);
    if (error) fail(error);
    await loadAll();
  }

  async function submitSos(payload) {
    const c = client();
    if (!c) {
      /* offline: queue it like an offline report so it sends when the connection
         returns. SOS is rate-limited in the RPC; the queue retry will surface
         the limit as a toast at that point. */
      try { await UG_PWA.upsertQueuedSos(Object.assign({ _kind: 'sos', client_sent_at: new Date().toISOString() }, payload)); } catch (e) {}
      return { id: 'PENDING-' + Date.now(), reach: 0, queued: true };
    }
    const { data, error } = await c.rpc('submit_sos', {
      p_lat: payload.lat, p_lng: payload.lng, p_accuracy: payload.accuracy, p_note: payload.note || ''
    });
    if (error) fail(error);
    return data;
  }
  async function listSos() {
    const c = client();
    if (!c) return [];
    const { data, error } = await c.from('sos_log').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) return [];
    return (data || []).map((s) => ({
      id: s.id, profile_name: s.profile_name, profile_phone: s.profile_phone,
      barangay: s.barangay, lat: s.lat, lng: s.lng, accuracy: s.accuracy,
      note: s.note, status: s.status || 'sent',
      created_at: s.created_at,
      time: UG_UTIL.relTime(s)
    }));
  }

  /* SOS status changes go through the update_sos_status RPC (migration 029):
     scoped per barangay for officials, LGU sees all, every change is audited. */
  async function updateSosStatus(sosId, status) {
    const c = client();
    if (!c) {
      const row = (UG.DATA.sosLog || []).find((s) => s.id === sosId);
      if (row) row.status = status;
      emit();
      return { id: sosId, status: status };
    }
    const { data, error } = await c.rpc('update_sos_status', { p_sos_id: sosId, p_status: status });
    if (error) fail(error);
    UG.DATA.sosLog = await listSos();
    emit();
    return data;
  }
  async function listOthersReview() {
    const c = client();
    if (!c) return [];
    const { data, error } = await c.from('others_hazard_review').select('*');
    if (error) return [];
    return data || [];
  }

  /* ------------------------------------------------------ LGU escalation queue
   * Returns reports that have been pending barangay verification for more
   * than 1 hour, so the LGU dashboard can surface them as a fallback
   * verification queue. Pulls from the migration 047 view when the live
   * schema has it; falls back to a client-side computation using reports_feed
   * when the view is not deployed yet, so the LGU always sees something. */
  async function listLguEscalationQueue() {
    const c = client();
    if (!c) {
      /* offline: derive the queue from whatever is in UG.DATA.incidents
         that still has status 'reported' and is older than 1 hour. */
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      return (UG.DATA.incidents || []).filter((i) => {
        if (i.status !== 'reported') return false;
        const t = i.created_at ? Date.parse(i.created_at) : 0;
        return t && t < oneHourAgo;
      });
    }
    /* try the migration 047 view first; if it's not deployed, fall back to
       a client-side computation that joins reports_feed + reports. */
    try {
      const { data, error } = await c.from('lgu_escalation_queue').select('*');
      if (!error && data) return data;
    } catch (e) { /* fall through */ }
    /* fallback: read reports_feed and filter in JS. */
    try {
      const { data } = await c.from('reports_feed').select('*');
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      return (data || []).filter((r) => r.status === 'reported' && r.created_at && Date.parse(r.created_at) < oneHourAgo);
    } catch (e) { return []; }
  }

  /* LGU verifies an overdue report (1-hour escalation queue). */
  async function lguVerifyOverdueReport(reportId) {
    const c = client();
    if (!c) {
      /* offline: just flip the row in UG.DATA.incidents so the UI updates. */
      const r = (UG.DATA.incidents || []).find((x) => x.id === reportId || x.uuid === reportId);
      if (r) { r.status = 'verified'; r.escalation_status = 'verified'; }
      emit();
      return { ok: true, local: true };
    }
    /* try the migration 047 RPC; fall back to advancing the status with the
       advance_report_status RPC that already exists (migration 007). */
    try {
      const { data, error } = await c.rpc('lgu_verify_overdue_report', { p_report_id: reportId });
      if (!error) return data || { ok: true };
    } catch (e) { /* fall through */ }
    try {
      const { error } = await c.rpc('advance_report_status', { p_report_id: reportId, p_status: 'verified' });
      if (error) throw new Error(error.message);
      return { ok: true };
    } catch (e) { throw e; }
  }

  /* ------------------------------------------------------ force reload (retry)
   * The "Back to Online" / "Retry" / dashboard "Refresh data" buttons all call
   * this. It does what the old retry-load did not:
   *   1. re-checks navigator.onLine (the banner can be stale)
   *   2. flushes the offline report queue first, so queued rows upload before
   *      we reload (otherwise a reload could mark them uploaded-then-dropped)
   *   3. asks Supabase to refresh the auth session if it expired — the #1
   *      cause of "stuck offline" was an expired JWT where client() still
   *      returned the sb object, so every query 401'd and loadAll fell back
   *      to the sample seed
   *   4. calls loadAll()
   *   5. returns the actual outcome so the caller can surface a toast
   */
  async function forceReload() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      state.source = 'offline';
      state.lastError = 'You are still offline. Reconnect to the network and try again.';
      emit();
      return { ok: false, reason: 'offline', error: state.lastError };
    }
    /* try to revive / refresh the auth session before hitting the tables */
    const c = client();
    if (c) {
      try {
        const { data: sess } = await c.auth.getSession();
        if (!sess || !sess.session) {
          /* no session at all — caller should re-authenticate */
          state.lastError = 'Your session has expired. Please sign in again.';
          state.source = 'offline';
          emit();
          return { ok: false, reason: 'no-session', error: state.lastError };
        }
        /* ask the SDK to refresh the access token if it is close to expiry */
        try { await c.auth.refreshSession(); } catch (e) { /* will surface via loadAll */ }
      } catch (e) {
        state.lastError = (e && e.message) || 'Could not restore your session';
        state.source = 'offline';
        emit();
        return { ok: false, reason: 'session-error', error: state.lastError };
      }
    }
    /* flush the offline queue so queued reports upload with the live session */
    try {
      if (typeof UG_PWA !== 'undefined' && UG_PWA.flushQueue) await UG_PWA.flushQueue();
    } catch (e) { /* never block a reload on the queue */ }
    try {
      await loadAll();
      return { ok: true, source: state.source, lastSync: state.lastSync };
    } catch (e) {
      return { ok: false, reason: 'load-failed', error: (e && e.message) || 'Reload failed' };
    }
  }

  return {
    client, online, state, onChange,
    loadAll, forceReload, subscribe, unsubscribe,
    createReport, uploadPhoto, signedPhotoUrl, corroborate, advanceStatus, lguVerify, reportHistory, updateReport,
    createAdvisory, updateCenter, createCenter, createHotline, updateHotline, deleteHotline,
    markRead, markAllRead, listBarangays,
    declareEmergency, subscribedDeviceCount,
    analytics, analyticsFromViews, listUsers, adminUsers, listAudit, listResponders, assignResponder,
    dispatchReport, dispatchReportV2, loadDispatches, loadDispatchDirectory,
    /* change request workflow (master prompt · Emergency Hotlines approval) */
    loadChangeRequests, submitChangeRequest, approveChangeRequest, rejectChangeRequest,
    /* new feature data access */
    createRelief, updateRelief, createBeneficiary, deleteBeneficiary,
    createGuide, updateGuide,
    createFaq, updateFaq, deleteFaq,
    createRoadWork, createRoadStatus, updateRoadStatus, deleteRoadStatus,
    submitSos, listSos, updateSosStatus, listOthersReview,
    listLguEscalationQueue, lguVerifyOverdueReport,
    logClientError,
    toIncident, toAdvisory, toCenter, toHotline, toNotification, posFrom,
    toRelief, toBeneficiary, toGuide, toFaq, toRoadWork, toRoadStatus
  };
})();
