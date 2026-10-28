/* UniGuard · Super Admin home screen (js/screens.superadmin.js)
 *
 * The Super Admin console from the React app (uniguard/src/components/
 * SuperAdminPortal.tsx), rebuilt for this application: a light sidebar with the
 * menu and the account breakdown, a warm gold hero with Overview / Accounts /
 * Activity, two stat cards resting on the hero's floor, system health, and a
 * floating "System pulse" card with the report chart and a calendar.
 *
 * Shown on the route 'admin-home' to a Super Admin only (an lgu_ldrrmc account
 * with profiles.is_super_admin = true). Everything else is unchanged.
 *
 * No second copy of any logic: the screen reads the same UG.DATA / S arrays the
 * console screens read, navigates with the controller's 'nav' action, opens
 * activity entries with 'open-audit' / 'audit-open-record', refreshes with
 * 'refresh-data' and signs out with 'logout'. Account changes go through
 * Repo.adminUsers (the admin-users server function), exactly like the Users
 * screen. Its own clicks are 'sa-*' actions merged into the controller's single
 * delegated click listener; its own fields use data-sa-field and one input /
 * change listener bound once below, so no event is handled twice.
 */
const UG_SUPERADMIN = (function () {
  const esc = UG_UTIL.esc;
  const ROUTE = 'admin-home';
  const app = () => window.UG_APP || {};
  const S = () => app().S || {};
  const render = () => { if (app().render) app().render(); };
  const toast = (m, t) => { if (app().toast) app().toast(m, t); };
  const act = (name, d) => { const fn = app().actions && app().actions[name]; if (fn) return fn(d || {}); };

  const isSuper = (st) => !!(st && st.session && st.session.role === 'lgu_ldrrmc' && st.session.superAdmin);
  const handles = (st) => !!(st && st.route === ROUTE && isSuper(st));

  /* ------------------------------------------------------------ icons
     Lucide outlines (the React screen uses lucide-react), 24 unit grid. */
  const LI = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    sheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    arrow: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    siren: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>'
  };
  const li = (n, size, cls) => '<svg class="sa-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + (size || 16) + '" height="' + (size || 16) +
    '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (LI[n] || '') + '</svg>';

  /* ------------------------------------------------------------ vocabulary */
  /* the five account kinds. Super Admin is not a database role: an lgu_ldrrmc
     account with is_super_admin = true (UG_ADMIN.roleOf), so "LDRRMO staff"
     never counts a Super Admin twice. */
  const ROLES = [
    { role: 'citizen', label: 'Residents', icon: 'home' },
    { role: 'barangay_official', label: 'Barangay officials', icon: 'building' },
    { role: 'lgu_ldrrmc', label: 'LDRRMO staff', icon: 'shieldCheck' },
    { role: 'dispatch_team', label: 'Dispatch team', icon: 'truck' },
    { role: 'super_admin', label: 'Super admins', icon: 'crown' }
  ];
  const roleKey = (u) => (u && u.role === 'lgu_ldrrmc' && u.is_super_admin === true) ? 'super_admin' : ((u && u.role) || 'citizen');
  const roleLabel = (r) => (ROLES.find((x) => x.role === r) || {}).label || r;
  const ROLE_PILL = {
    citizen: 'sa-pill--res', barangay_official: 'sa-pill--brgy', lgu_ldrrmc: 'sa-pill--lgu',
    dispatch_team: 'sa-pill--dis', super_admin: 'sa-pill--sup'
  };

  const SIDE_MENU = [
    { route: 'dashboard', label: 'Operations', icon: 'grid' },
    { route: 'settings', label: 'Settings', icon: 'settings' },
    { route: 'notifications', label: 'Notifications', icon: 'bell' },
    { route: 'reporting', label: 'Reports & Documents', icon: 'file' },
    { route: 'analytics', label: 'Analytics', icon: 'chart' }
  ];
  const VIEWS = [['overview', 'Overview'], ['accounts', 'Accounts'], ['activity', 'Activity']];

  const ROLE_TEXT = {
    super_admin: 'Super Admin', lgu_ldrrmc: 'LDRRMO', barangay_official: 'Barangay official',
    dispatch_team: 'Dispatch', citizen: 'Resident'
  };
  const ENTITY_TEXT = {
    reports: 'Incident report', report_dispatches: 'Dispatch', profiles: 'Account', advisories: 'Advisory',
    evacuation_centers: 'Shelter', emergency_hotlines: 'Hotline', change_requests: 'Change request',
    road_status: 'Road status', road_work_posts: 'Road work', relief_distributions: 'Relief schedule',
    relief_inventory: 'Relief stock', relief_distribution_log: 'Relief handed out', damage_assessments: 'Damage assessment',
    situation_reports: 'Situation report', dispatch_units: 'Dispatch unit', unit_requests: 'Unit request',
    dispatch_equipment: 'Unit equipment', hospital_capacity: 'Hospital capacity', sos_log: 'SOS', sos_alerts: 'SOS',
    preparedness_guides: 'Guide', faqs: 'FAQ'
  };
  /* where each kind of record lives in this application */
  const ENTITY_ROUTE = {
    reports: 'incidents', report_dispatches: 'incidents', profiles: 'accounts', advisories: 'advisories',
    evacuation_centers: 'centers', emergency_hotlines: 'hotlines', change_requests: 'hotlines',
    road_status: 'roadwork', road_work_posts: 'roadwork', relief_distributions: 'relief', relief_inventory: 'relief',
    relief_distribution_log: 'relief', damage_assessments: 'reporting', situation_reports: 'reporting',
    dispatch_units: 'dispatch-units', unit_requests: 'dispatch-units', sos_log: 'sos', sos_alerts: 'sos',
    preparedness_guides: 'guides', faqs: 'faqs'
  };
  /* records 'audit-open-record' can open in their own detail view */
  const OPENS_DETAIL = ['reports', 'emergency_hotlines', 'evacuation_centers', 'road_status', 'advisories',
    'dispatch_units', 'relief_inventory', 'change_requests'];
  const ACTION_BUCKET_TEXT = { create: 'Create', edit: 'Edit / update', delete: 'Delete', verify: 'Verify', status: 'Status / dispatch', other: 'Other' };
  const actionBucket = (a) => UG_ADMIN.actionBucket(a || '');

  /* the activity line, as the React app words it (repo.ts describeAudit) */
  const AUDIT_RECORD = {
    evacuation_centers: 'Shelter', emergency_hotlines: 'Hotline', road_status: 'Road status', road_work_posts: 'Road work post',
    relief_distributions: 'Relief schedule', relief_inventory: 'Relief stock item', relief_distribution_log: 'Relief distribution',
    damage_assessments: 'Damage assessment', situation_reports: 'Situation report', advisories: 'Advisory',
    preparedness_guides: 'Guide', faqs: 'FAQ', dispatch_units: 'Dispatch unit', profiles: 'Account'
  };
  function describe(a) {
    const meta = (a.meta && typeof a.meta === 'object') ? a.meta : {};
    switch (a.action) {
      case 'report.status_changed': return 'Report status changed to ' + (meta.to || 'unknown') + (meta.note ? ' — ' + meta.note : '');
      case 'report.responder_assigned': return 'Responder unit assigned to report';
      case 'user.invited': return 'Invited ' + (meta.email || 'an account') + ' as ' + (meta.role || 'official');
      case 'user.role_changed': return 'Role changed to ' + (meta.to || 'unknown');
      case 'user.barangay_changed': return 'Barangay assignment changed to ' + (meta.name || 'none');
      case 'user.disabled': return 'Account disabled';
      case 'user.enabled': return 'Account enabled';
      case 'emergency.declared': return 'Emergency declared' + (meta.title ? ': ' + meta.title : '');
      case 'sos.received': return 'SOS received' + (meta.reach != null ? ', ' + meta.reach + ' duty officers notified' : '');
      default: {
        const m = /^([a-z_]+)\.(insert|update|delete)$/.exec(a.action || '');
        if (m) {
          const what = AUDIT_RECORD[m[1]] || m[1].replace(/_/g, ' ');
          const did = m[2] === 'insert' ? 'added' : m[2] === 'update' ? 'updated' : 'removed';
          const name = meta.name || meta.title || meta.road_name || meta.agency_name || '';
          return what + ' ' + did + (name ? ': ' + name : '');
        }
        const detail = Object.keys(meta).map((k) => k + ': ' + (typeof meta[k] === 'object' ? JSON.stringify(meta[k]) : meta[k])).join(' · ');
        return [a.entity, detail].filter(Boolean).join(' — ') || a.action || '';
      }
    }
  }
  const actorName = (a) => a.actor_id ? (a.actor_name || String(a.actor_id).slice(0, 8)) : (a.actor_name || 'system');

  /* ------------------------------------------------------------ time */
  const dayKey = (d) => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  const isoDayLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parseIso = (k) => { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  /* "4d ago", then the date (lib/util.ts relTime) */
  function relTime(value) {
    if (value == null) return '';
    const t = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
    if (!t || isNaN(t)) return '';
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 45) return 'just now';
    if (s < 90) return '1m ago';
    const m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60), rm = m % 60;
    if (h < 24) return rm ? h + 'h ' + rm + 'm ago' : h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(t).toLocaleDateString();
  }

  /* ------------------------------------------------------------ state
     Lives here, not in the controller's S: it survives every re-render and
     starts fresh for a different account. */
  const SHORT = 10, PAGE = 25;
  function fresh(uid) {
    const now = new Date();
    return {
      uid: uid, view: 'overview', range: 14,
      month: new Date(now.getFullYear(), now.getMonth(), 1), day: isoDayLocal(now),
      query: '', accRole: 'all', accStatus: 'all', allAccounts: false,
      menu: null,              /* 'role' | 'export-accounts' | 'export-activity' */
      newAcct: null, newNote: '', newBusy: false,
      edit: null, editNote: '', editOk: false, saving: false, resetting: false,
      actQ: '', actRole: 'all', actEntity: 'all', actAction: 'all', actActor: 'all', actBarangay: 'all',
      actFrom: '', actTo: '', actPage: 1, allOnPage: false, moreOpen: false, refreshing: false,
      loadError: null
    };
  }
  let st = fresh(null);
  function sync() {
    const s = S().session;
    const uid = s ? (s.id || s.email || '') : null;
    if (uid !== st.uid) st = fresh(uid);
  }

  /* ------------------------------------------------------------ data */
  const D = () => UG.DATA || {};
  const users = () => D().users || [];
  const audit = () => D().audit || [];
  const reports = () => D().incidents || [];
  const sosLog = () => D().sosLog || [];
  const barangays = () => S().barangays || [];
  const activeUnits = () => (D().dispatchUnits || []).filter((u) => u.active !== false);
  const responders = () => D().responders || S().responders || [];

  /* every read this screen needs; each part fails on its own */
  async function load() {
    const s = S();
    st.loadError = null;
    const parts = [
      Repo.listUsers().then((u) => { s.users = u; UG.DATA.users = u; }),
      Repo.listAudit(500).then((a) => { s.audit = a; UG.DATA.audit = a; }),
      Repo.listSos().then((x) => { UG.DATA.sosLog = x; }),
      Repo.loadChangeRequests(),
      Repo.loadDispatchDirectory(),
      Repo.listResponders().then((r) => { s.responders = r; UG.DATA.responders = r; }),
      Repo.subscribedDeviceCount().then((n) => { UG.DATA.subscribedDevices = n; })
    ];
    if (!(s.barangays && s.barangays.length)) parts.push(Repo.listBarangays().then((b) => { s.barangays = b; }));
    const res = await Promise.allSettled(parts);
    const bad = res.filter((r) => r.status === 'rejected');
    if (bad.length) {
      console.warn('[UniGuard] super admin home: some reads failed', bad.map((r) => r.reason));
      st.loadError = 'Some sections could not be loaded.';
    }
    render();
  }
  async function reloadUsers() {
    const u = await Repo.listUsers();
    S().users = u; UG.DATA.users = u;
  }

  /* ------------------------------------------------------------ derived */
  function roleCounts() {
    const c = {};
    users().forEach((u) => { const r = roleKey(u); c[r] = (c[r] || 0) + 1; });
    return c;
  }
  function filteredAccounts() {
    const q = st.query.trim().toLowerCase();
    return users().filter((u) =>
      (st.accRole === 'all' || roleKey(u) === st.accRole) &&
      (st.accStatus === 'all' || (st.accStatus === 'disabled' ? !!u.disabled : !u.disabled)) &&
      (!q || [u.full_name, u.email, u.barangay].some((f) => String(f || '').toLowerCase().indexOf(q) !== -1)));
  }
  function filteredAudit() {
    const q = st.actQ.trim().toLowerCase();
    return audit().filter((a) => {
      if (st.actRole !== 'all' && (st.actRole === 'system' ? !!a.actor_id : a.actor_role !== st.actRole)) return false;
      if (st.actEntity !== 'all' && a.entity !== st.actEntity) return false;
      if (st.actAction !== 'all' && actionBucket(a.action) !== st.actAction) return false;
      if (st.actActor !== 'all' && actorName(a) !== st.actActor) return false;
      if (st.actBarangay !== 'all' && (a.actor_barangay || '') !== st.actBarangay) return false;
      /* compare by the local calendar day (timestamps are stored in UTC) */
      const t = new Date(a.created_at);
      const day = isNaN(t.getTime()) ? '' : isoDayLocal(t);
      if (st.actFrom && day < st.actFrom) return false;
      if (st.actTo && day > st.actTo) return false;
      if (q && ![describe(a), a.action, actorName(a), a.entity, a.actor_barangay].some((x) => String(x || '').toLowerCase().indexOf(q) !== -1)) return false;
      return true;
    });
  }
  function series() {
    const byDay = {};
    reports().forEach((r) => { const t = new Date(r.created_at); if (!isNaN(t)) { const k = dayKey(t); byDay[k] = (byDay[k] || 0) + 1; } });
    const days = [];
    for (let i = 0; i < st.range; i++) {
      const d = new Date(); d.setDate(d.getDate() - (st.range - 1 - i));
      days.push({ d: d, n: byDay[dayKey(d)] || 0 });
    }
    return { days: days, byDay: byDay, max: Math.max.apply(null, [1].concat(days.map((x) => x.n))) };
  }
  function sosByDay() {
    const m = {};
    sosLog().forEach((x) => { const t = new Date(x.created_at); if (!isNaN(t)) { const k = dayKey(t); m[k] = (m[k] || 0) + 1; } });
    return m;
  }
  const attr = (o) => Object.keys(o).map((k) => ' data-' + k + '="' + esc(String(o[k])) + '"').join('');
  const btn = (a, data) => ' data-act="' + a + '"' + (data ? attr(data) : '');

  /* ================================================================ hero art
     "Every portal, one view": the Super Admin's gold shield on a sun burst, the
     four portals' shields riding an orbit around it, curved links carrying data
     in. Each portal shield opens the accounts of that portal's role. */
  const EMBLEM = {
    admin: { left: '#B7791F', right: '#F6C445', keel: '#5C3A0A', hub: '#FFFFFF', dot: '#D69E2E' },
    resident: { left: '#991B1B', right: '#C9545A', keel: '#4A0D12', hub: '#FFFFFF', dot: '#991B1B' },
    barangay: { left: '#052659', right: '#5482B4', keel: '#1E4E8C', hub: '#FFFFFF', dot: '#5482B4' },
    command: { left: '#18181B', right: '#52525B', keel: '#A1A1AA', hub: '#FFFFFF', dot: '#18181B' },
    dispatch: { left: '#C2410C', right: '#F59E6B', keel: '#7C2D12', hub: '#FFFFFF', dot: '#EA580C' }
  };
  const SH_L = 'M30.4 5.3C24 8.2 17.5 9.9 9.5 11.2V30C9.5 32.3 9.7 34.4 10.1 36.4H30.4Z';
  const SH_R = 'M33.6 5.3C40 8.2 46.5 9.9 54.5 11.2V30C54.5 32.3 54.3 34.4 53.9 36.4H33.6Z';
  const SH_K = 'M10.9 40.2C16.8 37.6 22.6 42.8 32 40.2C41.4 37.6 47.2 42.8 53.1 40.2C49.6 48.8 42.2 55.6 32 60.5C21.8 55.6 14.4 48.8 10.9 40.2Z';
  function shield(portal, x, y, size, filter) {
    const c = EMBLEM[portal], k = size / 64;
    return '<g transform="translate(' + (x - size / 2) + ' ' + (y - size / 2) + ') scale(' + k + ')"' + (filter ? ' filter="' + filter + '"' : '') + '>' +
      '<path d="' + SH_L + '" fill="' + c.left + '"/><path d="' + SH_R + '" fill="' + c.right + '"/><path d="' + SH_K + '" fill="' + c.keel + '"/>' +
      '<circle cx="32" cy="21.5" r="5.6" fill="' + c.hub + '"/><circle cx="32" cy="21.5" r="2.4" fill="' + c.dot + '"/></g>';
  }
  /* a small emblem for the logo lockups */
  function emblem(portal, px, reverse) {
    const c = reverse ? { left: '#FFFFFF', right: '#FDE68A', keel: '#FBBF24', hub: '#B7791F', dot: '#FFFFFF' } : EMBLEM[portal];
    return '<svg viewBox="0 0 64 64" width="' + px + '" height="' + px + '" aria-hidden="true">' +
      '<path d="' + SH_L + '" fill="' + c.left + '"/><path d="' + SH_R + '" fill="' + c.right + '"/><path d="' + SH_K + '" fill="' + c.keel + '"/>' +
      '<circle cx="32" cy="21.5" r="5.6" fill="' + c.hub + '"/><circle cx="32" cy="21.5" r="2.4" fill="' + c.dot + '"/></svg>';
  }
  const HUB = { x: 180, y: 76 }, ORBIT = { rx: 128, ry: 50 };
  const onOrbit = (deg) => ({ x: Math.round(HUB.x + ORBIT.rx * Math.cos(deg * Math.PI / 180)), y: Math.round(HUB.y + ORBIT.ry * Math.sin(deg * Math.PI / 180)) });
  const HERO_NODES = [
    { portal: 'resident', label: 'Residents', deg: 208, above: true, role: 'citizen' },
    { portal: 'barangay', label: 'Barangay', deg: 332, above: true, role: 'barangay_official' },
    { portal: 'command', label: 'LDRRMO', deg: 152, above: false, role: 'lgu_ldrrmc' },
    { portal: 'dispatch', label: 'Dispatch', deg: 28, above: false, role: 'dispatch_team' }
  ].map((n) => Object.assign(n, onOrbit(n.deg)));
  const SPARKLES = [[118, 18, 5, 0], [250, 14, 4, 1.1], [28, 104, 4, 0.6], [336, 120, 5, 1.7], [214, 136, 3.5, 2.3]];

  function heroArt() {
    let s = '<svg viewBox="0 0 360 230" class="sa-hero-art" role="group" aria-label="The four portals">' +
      '<defs><radialGradient id="saHeroGlow"><stop offset="0%" stop-color="#FFF6DA" stop-opacity="0.95"/><stop offset="45%" stop-color="#FFE7A3" stop-opacity="0.45"/><stop offset="100%" stop-color="#FFE7A3" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="saHeroHalo"><stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.7"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="saHeroRay" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#FFF6DA" stop-opacity="0.85"/><stop offset="100%" stop-color="#FFF6DA" stop-opacity="0"/></linearGradient>' +
      '<filter id="saHeroLift" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#5C3A0A" flood-opacity="0.28"/></filter></defs>';
    SPARKLES.forEach((p) => {
      const x = p[0], y = p[1], r = p[2];
      s += '<path class="twinkle" style="animation-delay:' + p[3] + 's" d="M' + x + ' ' + (y - r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) +
        'Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z" fill="#FFF6DA"/>';
    });
    s += '<path d="M' + (HUB.x - ORBIT.rx) + ' ' + HUB.y + 'A' + ORBIT.rx + ' ' + ORBIT.ry + ' 0 0 1 ' + (HUB.x + ORBIT.rx) + ' ' + HUB.y + '" fill="none" stroke="#FFF6DA" stroke-width="1.6" stroke-dasharray="1 7" stroke-linecap="round" opacity="0.8"/>';
    s += '<circle cx="' + HUB.x + '" cy="' + HUB.y + '" r="64" fill="url(#saHeroGlow)"/><g class="rays">';
    for (let i = 0; i < 8; i++) {
      s += '<path transform="rotate(' + (i * 45) + ' ' + HUB.x + ' ' + HUB.y + ')" d="M' + (HUB.x - 7) + ' ' + (HUB.y - 30) + 'L' + HUB.x + ' ' + (HUB.y - 62) + 'L' + (HUB.x + 7) + ' ' + (HUB.y - 30) + 'Z" fill="url(#saHeroRay)"/>';
    }
    s += '</g>';
    HERO_NODES.forEach((n) => {
      const d = 'M' + n.x + ' ' + n.y + 'Q' + ((n.x + HUB.x) / 2) + ' ' + (n.above ? HUB.y - 34 : HUB.y + 34) + ' ' + HUB.x + ' ' + HUB.y;
      s += '<g><path d="' + d + '" fill="none" stroke="#FFF6DA" stroke-width="1.6" opacity="0.5"/><path class="flow" d="' + d + '" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="2 24"/></g>';
    });
    s += '<g class="float">' + shield('admin', HUB.x, HUB.y + 2, 62, 'url(#saHeroLift)') + '</g>';
    s += '<path d="M' + (HUB.x - ORBIT.rx) + ' ' + HUB.y + 'A' + ORBIT.rx + ' ' + ORBIT.ry + ' 0 0 0 ' + (HUB.x + ORBIT.rx) + ' ' + HUB.y + '" fill="none" stroke="#FFF6DA" stroke-width="1.8" stroke-linecap="round" opacity="0.85"/>';
    s += '<g transform="translate(' + HUB.x + ' ' + HUB.y + ') scale(1 ' + (ORBIT.ry / ORBIT.rx) + ')"><g class="beacon"><circle cx="' + ORBIT.rx + '" cy="0" r="9" fill="url(#saHeroHalo)"/><circle cx="' + ORBIT.rx + '" cy="0" r="3.4" fill="#FFFFFF"/></g></g>';
    HERO_NODES.forEach((n, i) => {
      s += '<g class="float node" style="animation-delay:' + (i * 0.6) + 's" role="button" tabindex="0" aria-label="' + esc(n.label) + ' accounts"' + btn('sa-role', { role: n.role }) + ' data-sa-key="1">' +
        '<circle class="ring" cx="' + n.x + '" cy="' + (n.y + 1) + '" r="19" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-dasharray="3 3"/>' +
        '<circle class="halo" cx="' + n.x + '" cy="' + n.y + '" r="20" fill="url(#saHeroHalo)"/>' +
        shield(n.portal, n.x, n.y + 1, 30, 'url(#saHeroLift)') +
        '<text x="' + n.x + '" y="' + (n.above ? n.y - 21 : n.y + 28) + '" text-anchor="middle" font-size="8.5" font-weight="800" letter-spacing="1.2" fill="#5C3A0A" font-family="inherit">' + esc(n.label.toUpperCase()) + '</text></g>';
    });
    return s + '</svg>';
  }

  /* ================================================================ menus */
  /* a gold dropdown: the button names the current choice; the menu lists every option */
  function pickMenu(id, label, value, options, pickAct) {
    const cur = options.find((o) => o.value === value) || options[0];
    const open = st.menu === id;
    return '<div class="sa-menu" data-sa-menu="' + id + '">' +
      '<button type="button" class="sa-pick' + (open ? ' is-open' : '') + '"' + btn('sa-menu', { menu: id }) + ' aria-haspopup="listbox" aria-expanded="' + open + '">' +
        '<span class="sa-muted">' + esc(label) + ':</span><span class="sa-gold">' + esc(cur.label) + '</span>' +
        (cur.count !== undefined ? '<span class="sa-num sa-muted">' + cur.count + '</span>' : '') + li('down', 14, 'sa-muted') + '</button>' +
      (open ? '<div class="sa-pop sa-pop--left" role="listbox" aria-label="' + esc(label) + '">' + options.map((o) => {
        const on = o.value === value;
        return '<button type="button" role="option" aria-selected="' + on + '" class="sa-opt' + (on ? ' is-on' : '') + '"' + btn(pickAct, { value: o.value }) + '>' +
          (o.icon ? li(o.icon, 16, 'sa-opt-ico') : '<span class="sa-opt-sp"></span>') +
          '<span class="sa-opt-l">' + esc(o.label) + '</span>' +
          (o.count !== undefined ? '<span class="sa-num sa-muted">' + o.count + '</span>' : '') +
          (on ? li('check', 14, 'sa-gold') : '') + '</button>';
      }).join('') + '</div>' : '') +
    '</div>';
  }
  /* one "Export" button that opens PDF / Excel / CSV */
  function exportMenu(id, what, disabled, note, small) {
    const open = st.menu === id && !disabled;
    return '<div class="sa-menu' + (disabled ? ' is-disabled' : '') + '" data-sa-menu="' + id + '">' +
      '<button type="button" class="sa-export' + (small ? ' sa-export--sm' : '') + (open ? ' is-open' : '') + '"' + btn('sa-menu', { menu: id }) +
        (disabled ? ' disabled aria-disabled="true"' : '') + ' aria-haspopup="menu" aria-expanded="' + open + '">' +
        li('download', 14) + 'Export' + li('down', 14, 'sa-dim70') + '</button>' +
      (open ? '<div class="sa-pop sa-pop--right sa-pop--export" role="menu">' +
        [['pdf', 'PDF', 'To print or send', 'file'], ['xlsx', 'Excel', 'To sort and total', 'sheet'], ['csv', 'CSV', 'For other programs', 'download']].map((o) =>
          '<button type="button" role="menuitem" class="sa-opt sa-opt--exp"' + btn('sa-export', { what: what, fmt: o[0] }) + '>' + li(o[3], 16, 'sa-opt-ico') +
          '<span class="sa-opt-txt"><span class="sa-opt-t">' + o[1] + '</span><span class="sa-opt-h">' + o[2] + '</span></span></button>').join('') +
        (note ? '<p class="sa-pop-note">' + esc(note) + '</p>' : '') + '</div>' : '') +
    '</div>';
  }

  /* ================================================================ sidebar */
  function sidebar(counts, total) {
    const unread = (D().notifications || []).filter((n) => n.unread).length;
    return '<aside class="sa-side">' +
      '<div class="sa-logo">' + emblem('admin', 30) + '<span>UniGuard</span></div>' +
      '<h1 class="sa-side-title">System Admin</h1>' +
      '<nav class="sa-side-nav" aria-label="Operations menu">' + SIDE_MENU.map((m) =>
        '<button type="button" class="sa-side-link"' + btn('nav', { route: m.route }) + '>' + li(m.icon, 16, 'sa-side-ico') +
        '<span class="sa-flex1">' + esc(m.label) + '</span>' +
        (m.route === 'notifications' && unread > 0 ? '<span class="sa-badge">' + unread + '</span>' : '') +
        li('arrow', 14, 'sa-side-arrow') + '</button>').join('') + '</nav>' +
      '<div class="sa-side-label"><span>Accounts by role</span><span class="sa-num">' + total + '</span></div>' +
      '<ul class="sa-roles">' + ROLES.map((r) => {
        const n = counts[r.role] || 0;
        const pct = total ? (n / total) * 100 : 0;
        return '<li><button type="button" class="sa-role-row"' + btn('sa-role', { role: r.role }) + ' aria-label="' + esc(r.label + ': ' + n + ' account' + (n === 1 ? '' : 's')) + '">' +
          '<span class="sa-role-top">' + li(r.icon, 16, 'sa-side-ico') + '<span class="sa-flex1">' + esc(r.label) + '</span><span class="sa-num sa-role-n">' + n + '</span></span>' +
          '<span class="sa-bar"><span style="width:' + pct.toFixed(2) + '%"></span></span></button></li>';
      }).join('') + '</ul>' +
      '<div class="sa-side-foot"><button type="button" class="sa-signout"' + btn('logout') + '><span>Sign out</span><span class="sa-signout-ico">' + li('logout', 14) + '</span></button></div>' +
    '</aside>';
  }

  /* ================================================================ hero */
  function hero(total, disabledN) {
    const session = S().session || {};
    const initial = String(session.name || 'S').trim().charAt(0).toUpperCase();
    const top = '<div class="sa-hero-top">' +
      '<span class="sa-hero-mark">' + emblem('admin', 20, true) + '</span>' +
      '<nav class="sa-tabs" aria-label="Admin sections">' +
        VIEWS.map((v) => '<button type="button" class="sa-tab' + (st.view === v[0] ? ' is-on' : '') + '"' + btn('sa-view', { view: v[0] }) + (st.view === v[0] ? ' aria-current="page"' : '') + '>' + v[1] + '</button>').join('') +
        /* phones and tablets have no sidebar: its menu shows here instead */
        SIDE_MENU.map((m) => '<button type="button" class="sa-tab sa-tab--side"' + btn('nav', { route: m.route }) + '>' + esc(m.label) + li('arrow', 14) + '</button>').join('') +
      '</nav>' +
      '<span class="sa-avatar">' + esc(initial) + '</span>' +
      '<button type="button" class="sa-hero-out"' + btn('logout') + ' aria-label="Sign out">' + li('logout', 16) + '</button>' +
    '</div>';
    if (st.view === 'overview') {
      return '<section class="sa-hero" data-sa-hero>' + top +
        '<div class="sa-hero-body">' +
          '<div class="sa-hero-copy">' +
            '<h2 class="sa-hero-h">Every portal,<br>one view.</h2>' +
            '<p class="sa-hero-p">' + total + ' accounts across residents, barangays, LDRRMO and dispatch.' + (disabledN ? ' ' + disabledN + ' disabled.' : '') + '</p>' +
            '<div class="sa-hero-btns">' +
              '<button type="button" class="sa-btn-orange"' + btn('sa-role', { role: 'all' }) + '>Manage accounts</button>' +
              '<button type="button" class="sa-btn-cream"' + btn('nav', { route: 'dashboard' }) + '>Open operations' + li('arrow', 16) + '</button>' +
            '</div></div>' +
          '<div class="sa-hero-artbox">' + heroArt() + '</div>' +
        '</div></section>';
    }
    return '<section class="sa-hero" data-sa-hero>' + top +
      '<div class="sa-hero-head"><h2>' + (st.view === 'accounts' ? 'Accounts' : 'Activity') + '</h2><p>' +
        (st.view === 'accounts'
          ? esc(total + ' accounts' + (disabledN ? ' · ' + disabledN + ' disabled' : '') + '. Tap an account to change its role or barangay.')
          : 'Every change made by an account, newest first. Tap an entry for details.') +
      '</p></div></section>';
  }

  /* ================================================================ overview */
  function statCard(title, icon, tint, a, b, route) {
    return '<button type="button" class="sa-stat"' + btn('nav', { route: route }) + '>' +
      '<span class="sa-stat-top"><span class="sa-stat-t">' + esc(title) + '</span><span class="sa-stat-go">' + li('arrow', 14) + '</span></span>' +
      '<span class="sa-stat-row"><span class="sa-stat-ico ' + tint + '">' + li(icon, 24) + '</span>' +
        '<span class="sa-stat-pair">' + [a, b].map((x) => '<span class="sa-stat-cell"><span class="sa-stat-l">' + esc(x.label) + '</span><span class="sa-stat-v sa-num">' + x.value + '</span></span>').join('') + '</span>' +
      '</span></button>';
  }

  function healthCard() {
    const R = Repo.state || {};
    const online = !(typeof UG_PWA !== 'undefined' && UG_PWA.state && UG_PWA.state.online === false);
    const connected = online && R.source === 'supabase';
    const notSetUp = !Repo.client();
    const syncAgeMin = R.lastSync ? Math.round((Date.now() - Date.parse(R.lastSync)) / 60000) : null;
    const devices = D().subscribedDevices || 0;
    const vapid = !!(UG_CONFIG && UG_CONFIG.VAPID_PUBLIC_KEY);
    const queued = (typeof UG_PWA !== 'undefined' && UG_PWA.state && UG_PWA.state.queued) || 0;
    const pending = (D().changeRequests || []).filter((c) => c.status === 'pending').length;
    const checks = [
      { label: 'Database', value: connected ? 'Connected' : notSetUp ? 'Not set up' : 'Offline', state: connected ? 'ok' : 'bad',
        hint: connected ? '' : 'Showing saved data. Check the internet connection or the Supabase settings.' },
      { label: 'Push alerts', value: vapid ? 'Set up · ' + devices + ' ' + (devices === 1 ? 'device' : 'devices') : 'Not set up',
        state: vapid ? (devices > 0 ? 'ok' : 'warn') : 'bad',
        hint: vapid ? (devices > 0 ? '' : 'No phone has turned on alerts yet.') : 'The push key (VAPID_PUBLIC_KEY in env.js) is missing, so phones get no alerts.' },
      { label: 'Last sync', value: R.lastSync ? relTime(R.lastSync) : 'Never', state: syncAgeMin === null ? 'bad' : syncAgeMin > 60 ? 'warn' : 'ok' },
      { label: 'Waiting to send', value: String(queued), state: queued ? 'warn' : 'ok', hint: queued ? 'Saved on this device; sends when online.' : '' },
      { label: 'Hotline requests', value: String(pending), state: pending ? 'warn' : 'ok', hint: pending ? 'Review them in Operations → Hotlines.' : '', route: 'hotlines' },
      { label: 'App version', value: (UG_CONFIG && UG_CONFIG.BUILD) || 'dev', state: 'ok' }
    ];
    const problems = checks.filter((c) => c.state !== 'ok');
    const hinted = problems.filter((c) => c.hint);
    return '<section class="sa-pad sa-mt4" aria-labelledby="sa-health-title"><div class="sa-card sa-health">' +
      '<div class="sa-health-top"><div class="sa-health-t">' + li('heart', 16, 'sa-goldi') +
        '<h3 id="sa-health-title">System health</h3><span class="' + (problems.length ? 'sa-warn-t' : 'sa-ok-t') + '">' + (problems.length ? problems.length + ' to check' : 'All good') + '</span></div>' +
        '<button type="button" class="sa-link-btn"' + btn('refresh-data') + '>' + li('refresh', 14) + 'Check again</button></div>' +
      '<ul class="sa-chips">' + checks.map((c) => {
        const inner = '<span class="sa-dot sa-dot--' + c.state + '"></span><span class="sa-chip-l">' + esc(c.label) + '</span><span class="sa-chip-v">' + esc(c.value) + '</span>';
        return '<li>' + (c.route
          ? '<button type="button" class="sa-chip sa-chip--btn"' + btn('nav', { route: c.route }) + ' title="Open where these are handled">' + inner + li('arrow', 12, 'sa-muted') + '</button>'
          : '<span class="sa-chip">' + inner + '</span>') + '</li>';
      }).join('') + '</ul>' +
      (hinted.length ? '<ul class="sa-hints">' + hinted.map((c) => '<li><b>' + esc(c.label) + ':</b> ' + esc(c.hint) + '</li>').join('') + '</ul>' : '') +
    '</div></section>';
  }

  function overview() {
    const weekAgo = Date.now() - 7 * 86400000;
    const inWeek = (x) => new Date(x.created_at).getTime() >= weekAgo;
    const reportsWeek = reports().filter(inWeek);
    const openReports = reports().filter((r) => r.status !== 'resolved' && r.status !== 'rejected').length;
    const resolvedWeek = reportsWeek.filter((r) => r.status === 'resolved').length;
    const sosWeek = sosLog().filter(inWeek).length;
    const sosOpen = sosLog().filter((s) => s.status !== 'resolved').length;
    const openShelters = (D().centers || []).filter((c) => c.status === 'open').length;
    return '<div class="sa-stats2">' +
        statCard('Reports this week', 'file', 'sa-tint-orange', { label: 'Filed', value: reportsWeek.length }, { label: 'Still open', value: openReports }, 'incidents') +
        statCard('SOS calls this week', 'siren', 'sa-tint-gold', { label: 'Received', value: sosWeek }, { label: 'Unhandled', value: sosOpen }, 'sos') +
      '</div>' +
      '<div class="sa-stats3">' + [
        { label: 'Resolved this week', value: resolvedWeek, route: 'incidents' },
        { label: 'Responder units', value: responders().length, route: 'incidents' },
        { label: 'Open shelters', value: openShelters, route: 'centers' }
      ].map((s) => '<button type="button" class="sa-mini"' + btn('nav', { route: s.route }) + '><span class="sa-mini-l">' + esc(s.label) + '</span>' +
        '<span class="sa-mini-r"><span class="sa-mini-v sa-num">' + s.value + '</span>' + li('arrow', 14, 'sa-mini-go') + '</span></button>').join('') +
      '</div>' + healthCard();
  }

  /* ================================================================ pulse card */
  function calendar(ser) {
    const month = st.month;
    const first = month.getDay();
    const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const today = new Date();
    const onThisMonth = month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear();
    const sos = sosByDay();
    const sel = parseIso(st.day);
    const selKey = dayKey(sel);
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let n = 1; n <= daysIn; n++) {
      const d = new Date(month.getFullYear(), month.getMonth(), n);
      const k = dayKey(d);
      const count = ser.byDay[k] || 0, s = sos[k] || 0;
      const isToday = k === dayKey(today), picked = k === selKey;
      const label = d.toLocaleDateString([], { month: 'long', day: 'numeric' }) + ': ' + count + ' report' + (count === 1 ? '' : 's') + (s ? ', ' + s + ' SOS' : '');
      cells += '<button type="button" class="sa-cal-d' + (isToday ? ' is-today' : count ? ' has-rep' : '') + (picked ? ' is-picked' : '') + '"' +
        btn('sa-day', { day: isoDayLocal(d) }) + ' aria-pressed="' + picked + '" aria-label="' + esc(label) + '">' + n +
        (s > 0 ? '<span class="sa-cal-sos" aria-hidden="true"></span>' : '') + '</button>';
    }
    const dayReports = reports().filter((r) => dayKey(new Date(r.created_at)) === selKey);
    const daySos = sosLog().filter((x) => dayKey(new Date(x.created_at)) === selKey);
    const dayAct = audit().filter((a) => dayKey(new Date(a.created_at)) === selKey);
    return '<div class="sa-cal">' +
      '<div class="sa-cal-head">' +
        '<button type="button" class="sa-cal-nav"' + btn('sa-month', { dir: -1 }) + ' aria-label="Previous month">' + li('left', 16) + '</button>' +
        '<span class="sa-cal-m">' + esc(month.toLocaleDateString([], { month: 'long', year: 'numeric' })) + '</span>' +
        '<span class="sa-cal-r">' + (!onThisMonth ? '<button type="button" class="sa-cal-today"' + btn('sa-day', { day: isoDayLocal(today) }) + '>Today</button>' : '') +
          '<button type="button" class="sa-cal-nav"' + btn('sa-month', { dir: 1 }) + ' aria-label="Next month">' + li('right', 16) + '</button></span>' +
      '</div>' +
      '<div class="sa-cal-wk">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => '<span>' + d + '</span>').join('') + '</div>' +
      '<div class="sa-cal-grid">' + cells + '</div>' +
      '<div class="sa-cal-day">' +
        '<div class="sa-cal-day-h"><p class="sa-cal-day-t">' + esc(sel.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })) + '</p>' +
          '<p class="sa-cal-day-n sa-num">' + dayReports.length + ' report' + (dayReports.length === 1 ? '' : 's') + ' · ' + daySos.length + ' SOS · ' +
            dayAct.length + ' activit' + (dayAct.length === 1 ? 'y' : 'ies') + '</p></div>' +
        (dayReports.length
          ? '<ul class="sa-cal-list">' + dayReports.slice(0, 3).map((r) => '<li><span class="sa-code">' + esc(r.id) + '</span><span class="sa-trunc">' + esc((r.hazard || '') + ' · ' + (r.brgy || '—')) + '</span></li>').join('') +
              (dayReports.length > 3 ? '<li class="sa-muted">and ' + (dayReports.length - 3) + ' more</li>' : '') + '</ul>'
          : '<p class="sa-cal-none">No reports filed this day.</p>') +
        '<div class="sa-cal-btns">' +
          (dayReports.length ? '<button type="button" class="sa-cal-b sa-cal-b--inc"' + btn('nav', { route: 'incidents' }) + '>Incidents' + li('arrow', 12) + '</button>' : '') +
          (daySos.length ? '<button type="button" class="sa-cal-b sa-cal-b--sos"' + btn('nav', { route: 'sos' }) + '>SOS Log' + li('arrow', 12) + '</button>' : '') +
          '<button type="button" class="sa-cal-b sa-cal-b--act"' + btn('sa-day-activity') + '>Day’s activity</button>' +
        '</div></div>' +
    '</div>';
  }

  function pulseCard() {
    const R = Repo.state || {};
    const online = !(typeof UG_PWA !== 'undefined' && UG_PWA.state && UG_PWA.state.online === false);
    const live = online && R.source === 'supabase';
    const ser = series();
    const selKey = dayKey(parseIso(st.day));
    return '<section class="sa-pulse">' +
      '<div class="sa-pulse-top"><div><h3>System pulse</h3><p>Reports filed per day</p></div>' +
        '<span class="sa-live' + (live ? ' is-live' : '') + '" title="' + (live ? 'Updates arrive as they happen' : 'Showing the last data this device saved') + '"><span class="sa-live-dot"></span>' + (live ? 'Live' : 'Offline') + '</span></div>' +
      '<div class="sa-range">' + [7, 14].map((n) => '<button type="button" class="' + (st.range === n ? 'is-on' : '') + '"' + btn('sa-range', { n: n }) + ' aria-pressed="' + (st.range === n) + '">' + n + ' days</button>').join('') + '</div>' +
      '<div class="sa-bars" aria-label="Reports per day over the last ' + st.range + ' days">' + ser.days.map((x, i) => {
        const picked = dayKey(x.d) === selKey;
        const tone = picked ? 'is-picked' : i === ser.days.length - 1 ? 'is-today' : '';
        return '<button type="button" class="sa-bar-b"' + btn('sa-day', { day: isoDayLocal(x.d) }) + ' aria-pressed="' + picked + '" aria-label="' +
          esc(x.d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ': ' + x.n + ' report' + (x.n === 1 ? '' : 's')) + '" title="' + esc(x.d.toLocaleDateString() + ': ' + x.n) + '">' +
          '<span class="' + tone + '" style="height:' + Math.max(6, (x.n / ser.max) * 100) + '%"></span></button>';
      }).join('') + '</div>' +
      calendar(ser) +
      '<button type="button" class="sa-open-log"' + btn('sa-view', { view: 'activity' }) + '><span>Open activity log</span>' + li('arrow', 16) + '</button>' +
    '</section>';
  }

  /* ================================================================ accounts */
  const fieldIn = (name, value, extra) => '<input class="sa-in sa-in--gold" data-sa-field="' + name + '" value="' + esc(value || '') + '"' + (extra || '') + '>';
  function selectEl(name, value, opts, cls) {
    return '<select class="' + (cls || 'sa-in') + '" data-sa-field="' + name + '">' + opts.map((o) =>
      '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value == null ? '' : value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  }
  const brgyOpts = (empty) => [['', empty]].concat(barangays().map((b) => [b.id, b.name]));
  const unitOpts = (empty) => [['', empty]].concat(activeUnits().map((u) => [u.id, u.name + ' (' + (u.unit_type || '') + ')']));

  function newAccountForm() {
    const n = st.newAcct;
    const lab = (t) => '<span class="sa-flab">' + t + '</span>';
    let extra = '';
    if (n.role === 'dispatch_team') {
      extra += '<label class="sa-fld">' + lab('Dispatch unit') + selectEl('newUnit', n.unitId, unitOpts(activeUnits().length ? 'Choose a unit' : 'No active units yet'), 'sa-in sa-in--gold') + '</label>';
      if (!activeUnits().length) extra += '<button type="button" class="sa-span2 sa-inline-link"' + btn('nav', { route: 'dispatch-units' }) + '>No dispatch units yet. Create one in Dispatch units</button>';
      extra += '<label class="sa-fld">' + lab('In the unit') + selectEl('newUnitRole', n.unitRole, [['member', 'Member'], ['unit_admin', 'Unit admin']], 'sa-in sa-in--gold') + '</label>';
    }
    if (n.role === 'barangay_official') {
      extra += '<label class="sa-fld">' + lab('Barangay') + selectEl('newBrgy', n.barangayId, brgyOpts('Choose a barangay'), 'sa-in sa-in--gold') + '</label>';
    }
    return '<div class="sa-card sa-newacct" data-sa-new>' +
      '<div class="sa-row-between"><h3>New staff account</h3><button type="button" class="sa-x"' + btn('sa-new-close') + ' aria-label="Close">' + li('x', 16) + '</button></div>' +
      '<p class="sa-small">The person gets an email to set their password. Residents sign up by themselves.</p>' +
      '<div class="sa-grid2">' +
        '<label class="sa-fld">' + lab('Full name') + fieldIn('newName', n.fullName, ' autocomplete="off"') + '</label>' +
        '<label class="sa-fld">' + lab('Email') + fieldIn('newEmail', n.email, ' type="email" autocomplete="off"') + '</label>' +
        '<label class="sa-fld">' + lab('Role') + selectEl('newRole', n.role, [['barangay_official', 'Barangay official'], ['lgu_ldrrmc', 'LDRRMO staff'], ['dispatch_team', 'Dispatch team']], 'sa-in sa-in--gold') + '</label>' +
        extra +
      '</div>' +
      (st.newNote ? '<p class="sa-err">' + esc(st.newNote) + '</p>' : '') +
      '<div class="sa-row-end"><button type="button" class="sa-btn-ghost"' + btn('sa-new-close') + '>Cancel</button>' +
        '<button type="button" class="sa-btn-orange sa-btn-sm"' + btn('sa-new-submit') + (st.newBusy ? ' disabled' : '') + '>' + (st.newBusy ? 'Sending…' : 'Send invitation') + '</button></div>' +
    '</div>';
  }

  function accountsView(counts, total) {
    const list = filteredAccounts();
    const disabledN = users().filter((u) => u.disabled).length;
    const shown = st.allAccounts ? list : list.slice(0, SHORT);
    const rows = shown.map((u) => {
      const r = roleKey(u);
      return '<button type="button" class="sa-acc-row"' + btn('sa-open-account', { id: u.id }) + '>' +
        '<span class="sa-acc-who"><span class="sa-av">' + esc(String(u.full_name || u.email || '?').trim().charAt(0).toUpperCase()) + '</span>' +
          '<span class="sa-minw0"><span class="sa-acc-name">' + esc(u.full_name || 'Unnamed') + (u.disabled ? '<span class="sa-disabled-tag">DISABLED</span>' : '') + '</span>' +
          '<span class="sa-acc-mail">' + esc(u.email || '') + '</span></span></span>' +
        '<span><span class="sa-pill ' + ROLE_PILL[r] + '">' + esc(roleLabel(r)) + '</span></span>' +
        '<span class="sa-acc-brgy">' + esc(u.barangay || '—') + '</span>' +
        '<span class="sa-acc-when">' + esc(relTime(u.created_at)) + '</span></button>';
    }).join('');
    return '<div class="sa-pad sa-pt6">' +
      '<div class="sa-acc-bar">' +
        '<label class="sa-search">' + li('search', 16, 'sa-muted') +
          '<input data-sa-field="query" value="' + esc(st.query) + '" placeholder="Search name, email or barangay" aria-label="Search accounts"></label>' +
        '<div class="sa-acc-acts">' + exportMenu('export-accounts', 'accounts', !list.length, 'Only the accounts shown are exported.') +
          '<button type="button" class="sa-btn-new"' + btn('sa-new') + '>' + li('userPlus', 16) + 'New account</button></div>' +
      '</div>' +
      '<div class="sa-acc-filters">' +
        pickMenu('role', 'Role', st.accRole, [{ value: 'all', label: 'All', count: total, icon: 'users' }].concat(ROLES.map((r) => ({ value: r.role, label: r.label, count: counts[r.role] || 0, icon: r.icon }))), 'sa-acc-role') +
        '<div class="sa-acc-right"><div class="sa-seg" role="group" aria-label="Show accounts by status">' +
          [['all', 'Any'], ['active', 'Active'], ['disabled', 'Disabled' + (disabledN ? ' ' + disabledN : '')]].map((s) =>
            '<button type="button" class="' + (st.accStatus === s[0] ? 'is-on' : '') + '"' + btn('sa-acc-status', { status: s[0] }) + ' aria-pressed="' + (st.accStatus === s[0]) + '">' + esc(s[1]) + '</button>').join('') +
          '</div><span class="sa-shown">' + list.length + ' shown</span></div>' +
      '</div>' +
      (st.newNote && !st.newAcct ? '<p class="sa-note-gold">' + esc(st.newNote) + '</p>' : '') +
      (st.newAcct ? newAccountForm() : '') +
      '<div class="sa-card sa-table">' +
        '<div class="sa-thead"><span>Account</span><span>Role</span><span>Barangay</span><span>Joined</span></div>' +
        rows +
        (!list.length ? '<p class="sa-empty">No accounts match.</p>' : '') +
        (list.length > SHORT ? '<button type="button" class="sa-more"' + btn('sa-acc-all') + ' aria-expanded="' + st.allAccounts + '">' +
          (st.allAccounts ? 'Show fewer' : 'Show all ' + list.length + ' accounts') + li('down', 14, st.allAccounts ? 'sa-rot' : '') + '</button>' : '') +
      '</div>' +
    '</div>';
  }

  function editDialog() {
    const e = st.edit;
    const u = users().find((x) => x.id === e.id);
    if (!u) return '';
    const me = (S().session || {}).id;
    const lab = (t) => '<label class="sa-elab">' + t + '</label>';
    let roleExtra = '';
    if (e.role === 'dispatch_team') {
      roleExtra += lab('Dispatch unit') + (activeUnits().length
        ? selectEl('editUnit', e.unitId, unitOpts('Choose a unit'), 'sa-ein')
        : '<p class="sa-amber">No active dispatch units yet. <button type="button" class="sa-inline-link"' + btn('nav', { route: 'dispatch-units' }) + '>Create one in Dispatch units</button></p>');
      roleExtra += lab('In the unit') + selectEl('editUnitRole', e.unitRole, [['member', 'Member'], ['unit_admin', 'Unit admin (manages the unit\'s crew and equipment)']], 'sa-ein');
    }
    if (e.role === 'barangay_official' || e.role === 'citizen') {
      roleExtra += lab('Barangay') + selectEl('editBrgy', e.barangayId, brgyOpts(e.role === 'citizen' ? 'Not set' : 'Choose a barangay'), 'sa-ein');
    }
    return '<div class="sa-overlay" data-sa-overlay>' +
      '<div class="sa-dialog" role="dialog" aria-modal="true" aria-label="Manage account">' +
        '<div class="sa-dlg-who"><span class="sa-av sa-av--lg">' + esc(String(u.full_name || u.email || '?').trim().charAt(0).toUpperCase()) + '</span>' +
          '<span class="sa-minw0"><span class="sa-dlg-name">' + esc(u.full_name || 'Unnamed') + '</span><span class="sa-dlg-mail">' + esc(u.email || '') + '</span></span></div>' +
        lab('Full name').replace('sa-elab', 'sa-elab sa-elab--first') + '<input class="sa-ein" data-sa-field="editName" value="' + esc(e.name) + '">' +
        lab('Phone') + '<input class="sa-ein" data-sa-field="editPhone" inputmode="tel" value="' + esc(e.phone) + '">' +
        '<p class="sa-dlg-meta">' + (u.disabled ? 'Disabled' : 'Active') + ' · joined ' + esc(new Date(u.created_at).toLocaleDateString()) + '</p>' +
        lab('Role') + selectEl('editRole', e.role, [['citizen', 'Resident'], ['barangay_official', 'Barangay official'], ['lgu_ldrrmc', 'LDRRMO staff'], ['dispatch_team', 'Dispatch team'], ['super_admin', 'Super Admin']], 'sa-ein') +
        roleExtra +
        (u.email ? '<button type="button" class="sa-reset"' + btn('sa-reset') + ((st.resetting || u.disabled) ? ' disabled' : '') +
          ' title="' + (u.disabled ? 'Enable the account first' : 'Email them a link to set a new password') + '">' + li('key', 14) + (st.resetting ? 'Sending…' : 'Send password-reset email') + '</button>' : '') +
        (st.editNote ? '<p class="' + (st.editOk ? 'sa-okmsg' : 'sa-err') + '">' + esc(st.editNote) + '</p>' : '') +
        '<div class="sa-dlg-btns">' +
          '<button type="button" class="sa-dlg-toggle ' + (u.disabled ? 'is-enable' : 'is-disable') + '"' + btn('sa-toggle-disabled') +
            ((st.saving || u.id === me) ? ' disabled' : '') + (u.id === me ? ' title="You cannot disable your own account"' : '') + '>' + (u.disabled ? 'Enable account' : 'Disable account') + '</button>' +
          '<button type="button" class="sa-dlg-save"' + btn('sa-save') + (st.saving ? ' disabled' : '') + '>' + (st.saving ? 'Saving…' : 'Save') + '</button>' +
        '</div>' +
        '<button type="button" class="sa-dlg-close"' + btn('sa-edit-close') + '>Close</button>' +
      '</div></div>';
  }

  /* ================================================================ activity */
  function activityView() {
    const all = audit();
    const list = filteredAudit();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    const page = Math.min(st.actPage, pages);
    const pageRows = list.slice((page - 1) * PAGE, page * PAGE);
    const today = isoDayLocal(new Date());
    const PRESETS = [[1, 'Today'], [7, 'Last 7 days'], [30, 'Last 30 days']];
    const activePreset = st.actTo === today
      ? ((PRESETS.find((p) => st.actFrom === isoDayLocal(new Date(Date.now() - (p[0] - 1) * 86400000))) || [])[1] || null) : null;
    const moreUsed = st.actRole !== 'all' || st.actEntity !== 'all' || st.actAction !== 'all' || st.actActor !== 'all' || st.actBarangay !== 'all' || (!!(st.actFrom || st.actTo) && !activePreset);
    const moreOpen = st.moreOpen || moreUsed;
    const filterCount = [st.actQ.trim(), st.actRole !== 'all', st.actEntity !== 'all', st.actAction !== 'all', st.actActor !== 'all', st.actBarangay !== 'all', st.actFrom, st.actTo].filter(Boolean).length;
    const uniq = (f) => Array.from(new Set(all.map(f).filter(Boolean))).sort();
    const entities = uniq((a) => a.entity), actors = uniq(actorName), brgys = uniq((a) => a.actor_barangay || '');

    const rows = (st.allOnPage ? pageRows : pageRows.slice(0, SHORT)).map((a) => {
      const target = a.entity ? ENTITY_ROUTE[a.entity] : null;
      const desc = describe(a);
      const who = actorName(a) + (a.actor_role ? ' (' + (ROLE_TEXT[a.actor_role] || a.actor_role) + (a.actor_barangay ? ', ' + a.actor_barangay : '') + ')' : '');
      return '<div class="sa-act-row" role="button" tabindex="0" aria-label="Activity entry: details"' + btn('open-audit', { id: a.id }) + ' data-sa-key="1">' +
        '<span class="sa-act-ico">' + li('activity', 16) + '</span>' +
        '<span class="sa-act-main"><span class="sa-act-desc" title="' + esc(desc) + '">' + esc(desc) + '</span>' +
          '<span class="sa-act-meta">' + esc(who + ' · ' + (ENTITY_TEXT[a.entity] || a.entity || '') + ' · ' + new Date(a.created_at).toLocaleString()) + '</span></span>' +
        (target ? '<button type="button" class="sa-act-open"' + btn('sa-act-open', { id: a.id }) + ' title="Open the screen that holds this record">Open' + li('arrow', 12) + '</button>' : '') +
      '</div>';
    }).join('');

    const sel = (name, value, opts, label) => '<select class="sa-fin" data-sa-field="' + name + '" aria-label="' + label + '">' + opts.map((o) =>
      '<option value="' + esc(o[0]) + '"' + (o[0] === value ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';

    return '<div class="sa-pad sa-pt6">' +
      '<div class="sa-act-bar"><p class="sa-act-count">' + (list.length === all.length ? all.length + ' entries' : list.length + ' of ' + all.length + ' entries') + '</p>' +
        '<div class="sa-act-btns"><button type="button" class="sa-refresh"' + btn('sa-act-refresh') + (st.refreshing ? ' disabled' : '') + '>' + li('refresh', 14, st.refreshing ? 'sa-spin' : '') + 'Refresh</button>' +
          exportMenu('export-activity', 'activity', !list.length, 'Only the entries that match the filters are exported.', true) + '</div></div>' +
      '<div class="sa-card sa-act-filters">' +
        '<div class="sa-act-frow"><div class="sa-presets" role="group" aria-label="Quick date range">' + PRESETS.map((p) =>
          '<button type="button" class="' + (activePreset === p[1] ? 'is-on' : '') + '"' + btn('sa-act-preset', { days: p[0] }) + ' aria-pressed="' + (activePreset === p[1]) + '">' + p[1] + '</button>').join('') + '</div>' +
          (filterCount ? '<span class="sa-fcount">' + filterCount + ' ' + (filterCount === 1 ? 'filter' : 'filters') + ' on</span>' : '') + '</div>' +
        '<input class="sa-fin sa-fin--wide" data-sa-field="actQ" placeholder="Search actor, action, record" value="' + esc(st.actQ) + '" aria-label="Search the activity log">' +
        '<div class="sa-more-f">' +
          '<button type="button" class="sa-more-sum"' + btn('sa-act-more') + ' aria-expanded="' + moreOpen + '">More filters <span class="sa-more-hint">(role, record, action, person, barangay, dates)</span>' + li('down', 14, moreOpen ? 'sa-rot' : '') + '</button>' +
          (moreOpen ? '<div class="sa-more-grid">' +
            sel('actRole', st.actRole, [['all', 'Every role']].concat(Object.keys(ROLE_TEXT).map((k) => [k, ROLE_TEXT[k]])).concat([['system', 'System']]), 'Actor role') +
            sel('actEntity', st.actEntity, [['all', 'Every record']].concat(entities.map((e) => [e, ENTITY_TEXT[e] || e])), 'Record type') +
            sel('actAction', st.actAction, [['all', 'Every action']].concat(Object.keys(ACTION_BUCKET_TEXT).map((k) => [k, ACTION_BUCKET_TEXT[k]])), 'Action type') +
            sel('actActor', st.actActor, [['all', 'Everyone']].concat(actors.map((n) => [n, n])), 'Changed by') +
            sel('actBarangay', st.actBarangay, [['all', 'Every barangay']].concat(brgys.map((b) => [b, b])), 'Barangay') +
            '<input type="date" class="sa-fin" data-sa-field="actFrom" value="' + esc(st.actFrom) + '" aria-label="From date">' +
            '<input type="date" class="sa-fin" data-sa-field="actTo" value="' + esc(st.actTo) + '" aria-label="To date">' +
            '<button type="button" class="sa-clear"' + btn('sa-act-clear') + '>Clear</button>' +
          '</div>' : '') +
        '</div>' +
      '</div>' +
      '<p class="sa-act-help">Every change made by an account, newest first. Tap Open to go to the record.</p>' +
      '<div class="sa-card sa-act-list">' + rows +
        (!list.length ? '<p class="sa-empty">' + (all.length ? 'Nothing matches these filters.' : 'No activity recorded yet.') + '</p>' : '') +
        (pageRows.length > SHORT ? '<button type="button" class="sa-more sa-more--act"' + btn('sa-act-all') + ' aria-expanded="' + st.allOnPage + '">' +
          (st.allOnPage ? 'Show fewer' : 'Show all ' + pageRows.length + ' on this page') + li('down', 14, st.allOnPage ? 'sa-rot' : '') + '</button>' : '') +
      '</div>' +
      (list.length > PAGE ? '<div class="sa-pager"><span>Page ' + page + ' of ' + pages + ' · ' + list.length + ' entries match</span><span class="sa-pager-b">' +
        '<button type="button"' + btn('sa-act-page', { p: page - 1 }) + (page <= 1 ? ' disabled' : '') + '>Prev</button>' +
        '<button type="button"' + btn('sa-act-page', { p: page + 1 }) + (page >= pages ? ' disabled' : '') + '>Next</button></span></div>' : '') +
    '</div>';
  }

  /* ================================================================ frame */
  function frame(appSt) {
    sync();
    /* arriving from another screen starts on a fresh Overview, as the React
       console does when it mounts again */
    if (!document.querySelector('.ug-sa')) st = fresh(st.uid);
    const counts = roleCounts();
    const total = users().length;
    const disabledN = users().filter((u) => u.disabled).length;
    const body = st.view === 'overview' ? overview() : st.view === 'accounts' ? accountsView(counts, total) : activityView();
    /* a redraw (live data arriving) must not pull the cursor out of a field */
    const ae = document.activeElement;
    const keep = ae && ae.dataset && ae.dataset.saField
      ? { f: ae.dataset.saField, a: ae.selectionStart, z: ae.selectionEnd } : null;
    Promise.resolve().then(() => {
      /* the gold band behind the pulse card ends where the hero ends */
      syncBand();
      if (!keep) return;
      const el = document.querySelector('[data-sa-field="' + keep.f + '"]');
      if (!el || document.activeElement === el) return;
      el.focus();
      try { if (keep.a != null) el.setSelectionRange(keep.a, keep.z); } catch (e) { }
    });
    return '<div class="ug-sa"><div class="sa-wrap"><div class="sa-frame">' +
      sidebar(counts, total) +
      '<main class="sa-main ug-scroll">' +
        hero(total, disabledN) +
        (st.loadError ? '<p class="sa-loaderr">' + esc(st.loadError) + '</p>' : '') +
        body +
        (st.view === 'overview' ? '<div class="sa-pulse-inline">' + pulseCard() + '</div>' : '<div class="sa-gap8"></div>') +
        '<div class="sa-gap8 sa-xl-only"></div>' +
      '</main>' +
      (st.view === 'overview' ? '<aside class="sa-pulse-side"><div class="sa-band" data-sa-band></div><div class="sa-pulse-scroll">' + pulseCard() + '</div></aside>' : '') +
      (st.edit ? editDialog() : '') +
    '</div></div></div>';
  }
  function syncBand() {
    const h = document.querySelector('[data-sa-hero]');
    const b = document.querySelector('[data-sa-band]');
    if (h && b) b.style.height = h.offsetHeight + 'px';
  }

  /* ================================================================ exports */
  function exportAccounts(fmt) {
    const X = UG_EXPORT;
    X.validateScope({ superAdmin: true });
    const list = filteredAccounts();
    const rows = list.map((u) => [u.full_name || '(no name)', u.email || '', u.phone || '',
      roleLabel(roleKey(u)) + (u.unit_role ? ' (' + String(u.unit_role).replace('_', ' ') + ')' : ''),
      u.barangay || '', u.disabled ? 'Disabled' : 'Active', u.created_at || null]);
    const columns = [{ label: 'Name', type: 'text', width: 24 }, { label: 'Email', type: 'text', width: 30 }, { label: 'Phone', type: 'id', width: 16 },
      { label: 'Role', type: 'status', width: 20 }, { label: 'Barangay', type: 'text', width: 18 }, { label: 'Status', type: 'status', width: 11 }, { label: 'Created', type: 'date', width: 14 }];
    const filters = [st.accRole !== 'all' ? 'Role: ' + roleLabel(st.accRole) : '', st.accStatus !== 'all' ? 'Status: ' + (st.accStatus === 'active' ? 'Active' : 'Disabled') : '',
      st.query.trim() ? 'Search: "' + st.query.trim() + '"' : ''].filter(Boolean);
    const meta = X.buildMetadata({ title: 'User Management', kind: 'User Account Register', module: 'Super Admin · Accounts',
      scope: 'All accounts visible to the Super Admin', filters: filters, count: rows.length, countLabel: 'Accounts listed', personalData: true, period: '' });
    const filename = X.buildFilename({ type: 'User Accounts', ext: fmt });
    if (fmt === 'csv') return X.saveCsv(filename, columns, rows);
    if (fmt === 'xlsx') return UG_XLSX.report({ meta: meta, filename: filename, sheets: [{ name: 'Accounts', title: 'Accounts', columns: columns, rows: rows }] });
    return UG_PDF.formal({ meta: meta, landscape: true, filename: filename,
      subtitle: 'Accounts, their role, barangay assignment and status.', blocks: [{ type: 'table', name: 'Accounts', columns: columns, rows: rows }] });
  }
  function exportActivity(fmt) {
    const X = UG_EXPORT;
    X.validateScope({ superAdmin: true });
    const list = filteredAudit();
    const rows = list.map((a) => [a.created_at || null, actorName(a), ROLE_TEXT[a.actor_role || ''] || a.actor_role || 'System', a.actor_barangay || '',
      ENTITY_TEXT[a.entity] || a.entity || '', a.action || '', describe(a)]);
    const columns = [{ label: 'When', type: 'datetime', width: 15 }, { label: 'Who', type: 'text', width: 18 }, { label: 'Role', type: 'status', width: 13 },
      { label: 'Barangay', type: 'text', width: 14 }, { label: 'Record', type: 'text', width: 14 }, { label: 'Action', type: 'text', width: 16 }, { label: 'What changed', type: 'longtext', width: 46 }];
    const filters = [st.actRole !== 'all' ? 'Role: ' + (ROLE_TEXT[st.actRole] || 'System') : '', st.actEntity !== 'all' ? 'Record: ' + (ENTITY_TEXT[st.actEntity] || st.actEntity) : '',
      st.actAction !== 'all' ? 'Action: ' + ACTION_BUCKET_TEXT[st.actAction] : '', st.actActor !== 'all' ? 'Changed by: ' + st.actActor : '',
      st.actBarangay !== 'all' ? 'Barangay: ' + st.actBarangay : '', st.actQ.trim() ? 'Search: "' + st.actQ.trim() + '"' : ''].filter(Boolean);
    const meta = X.buildMetadata({ title: 'Activity Log', kind: 'System Activity Log Report', module: 'Super Admin · Activity',
      scope: 'Barangay Officials, LDRRMO Staff, the Super Admin and Dispatch Teams', from: st.actFrom, to: st.actTo,
      period: (st.actFrom || st.actTo) ? X.periodLabel(st.actFrom, st.actTo) : 'All loaded entries',
      filters: filters, count: rows.length, countLabel: 'Entries listed', personalData: true });
    const filename = X.buildFilename({ type: 'Activity Log', from: st.actFrom, to: st.actTo, ext: fmt });
    if (fmt === 'csv') return X.saveCsv(filename, columns, rows);
    if (fmt === 'xlsx') return UG_XLSX.report({ meta: meta, filename: filename, sheets: [{ name: 'Entries', title: 'Activity entries', columns: columns, rows: rows }] });
    return UG_PDF.formal({ meta: meta, landscape: true, filename: filename,
      subtitle: 'Who changed what, newest first.', blocks: [{ type: 'table', name: 'Activity entries', fontSize: 7.5, columns: columns, rows: rows }] });
  }

  /* ================================================================ actions */
  const set = (patch) => { Object.assign(st, patch); render(); };
  const showRole = (role) => set({ accRole: role, query: '', allAccounts: false, view: 'accounts', menu: null });

  function openAccount(id) {
    const u = users().find((x) => x.id === id);
    if (!u) return;
    st.edit = { id: u.id, name: u.full_name || '', phone: u.phone || '', role: roleKey(u), barangayId: u.barangay_id || '',
      unitId: u.dispatch_unit_id || '', unitRole: u.unit_role === 'unit_admin' ? 'unit_admin' : 'member' };
    st.editNote = ''; st.editOk = false;
    render();
  }

  async function saveAccount() {
    const e = st.edit;
    if (!e || st.saving) return;
    const u = users().find((x) => x.id === e.id);
    if (!u) { st.edit = null; render(); return; }
    const note = (m) => { st.editNote = m; st.editOk = false; render(); };
    if (e.role === 'barangay_official' && !e.barangayId) return note('Choose the barangay this official serves.');
    if (e.role === 'dispatch_team' && !e.unitId) return note(activeUnits().length ? 'Choose the unit this person belongs to.' : 'Create a dispatch unit first, in Dispatch units.');
    if (!e.name.trim()) return note('The name cannot be empty.');
    const cur = roleKey(u);
    const roleChanged = e.role !== cur;
    const unitChanged = e.role === 'dispatch_team' && (e.unitId !== (u.dispatch_unit_id || '') || e.unitRole !== (u.unit_role === 'unit_admin' ? 'unit_admin' : 'member'));
    /* granting full administration is deliberate: confirm it (as the Users screen does) */
    if (roleChanged && e.role === 'super_admin') {
      const ok = await UG_FEATURES.confirm({
        title: 'Make this account a Super Admin?',
        message: (u.full_name || u.email || 'This account') + ' will be able to create accounts, change roles, disable users and read the full activity log.',
        confirmLabel: 'Grant Super Admin'
      });
      if (!ok) return;
    }
    st.saving = true; st.editNote = ''; render();
    let changed = false;
    try {
      if (e.name.trim() !== (u.full_name || '') || e.phone.trim() !== (u.phone || '')) {
        const c = Repo.client();
        if (!c) throw new Error('Connect to the server to edit accounts');
        const { error } = await c.from('profiles').update({ full_name: e.name.trim(), phone: e.phone.trim(), updated_at: new Date().toISOString() }).eq('id', u.id);
        if (error) throw new Error(error.message);
        changed = true;
      }
      if (roleChanged || unitChanged) {
        await Repo.adminUsers('set-role', e.role === 'dispatch_team'
          ? { userId: u.id, role: 'dispatch_team', unitId: e.unitId, unitRole: e.unitRole }
          : { userId: u.id, role: e.role });
        changed = true;
      }
      if (e.role === 'barangay_official' || e.role === 'citizen') {
        const target = e.barangayId || null;
        if (target !== (u.barangay_id || null)) {
          await Repo.adminUsers('set-barangay', { userId: u.id, barangayId: target });
          changed = true;
        }
      }
      if (changed) await reloadUsers();
      st.saving = false; st.edit = null;
      render();
      if (changed) toast('Account saved', 'prepared');
    } catch (err) {
      st.saving = false;
      if (changed) { try { await reloadUsers(); } catch (e2) { } }
      note((err && err.message) || 'Could not save the account.');
    }
  }

  async function toggleDisabled() {
    const e = st.edit;
    if (!e || st.saving) return;
    const u = users().find((x) => x.id === e.id);
    if (!u) return;
    const disable = !u.disabled;
    if (disable) {
      const ok = await UG_FEATURES.confirm({
        title: 'Disable account',
        message: 'Disable ' + (u.full_name || u.email) + '? They are signed out and cannot sign in until enabled again.',
        confirmLabel: 'Disable', danger: true
      });
      if (!ok) return;
    }
    st.saving = true; st.editNote = ''; render();
    try {
      await Repo.adminUsers('set-disabled', { userId: u.id, disabled: disable });
      await reloadUsers();
      st.saving = false; st.edit = null;
      render();
      toast(disable ? 'Account disabled' : 'Account enabled', 'prepared');
    } catch (err) {
      st.saving = false; st.editNote = (err && err.message) || 'Could not change the account status.'; st.editOk = false;
      render();
    }
  }

  async function sendReset() {
    const e = st.edit;
    if (!e || st.resetting) return;
    const u = users().find((x) => x.id === e.id);
    if (!u || !u.email || u.disabled) return;
    const ok = await UG_FEATURES.confirm({ title: 'Send password-reset email', message: 'Send a password-reset email to ' + u.email + '?', confirmLabel: 'Send' });
    if (!ok) return;
    st.resetting = true; st.editNote = ''; render();
    try {
      await Auth.resetPassword(u.email);
      st.editNote = 'Password-reset email sent to ' + u.email + '. The link in it lets them set a new password.'; st.editOk = true;
    } catch (err) {
      st.editNote = (err && err.message) || 'Could not send the email.'; st.editOk = false;
    }
    st.resetting = false;
    render();
  }

  async function createAccount() {
    const n = st.newAcct;
    if (!n || st.newBusy) return;
    const note = (m) => { st.newNote = m; render(); };
    if (!n.fullName.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(n.email.trim())) return note('Enter the person\'s name and a valid email address.');
    if (n.role === 'barangay_official' && !n.barangayId) return note('Choose the barangay this official will manage.');
    if (n.role === 'dispatch_team' && !n.unitId) return note(activeUnits().length ? 'Choose the unit this person belongs to.' : 'Create a dispatch unit first, in Dispatch units.');
    st.newBusy = true; st.newNote = ''; render();
    try {
      await Repo.adminUsers('create', {
        email: n.email.trim(), fullName: n.fullName.trim(), role: n.role,
        barangayId: n.role === 'barangay_official' ? n.barangayId : null,
        unitId: n.role === 'dispatch_team' ? n.unitId : null,
        unitRole: n.role === 'dispatch_team' ? n.unitRole : undefined
      });
      st.newNote = 'Invitation sent to ' + n.email.trim() + '. They set a password from the email.';
      st.newAcct = null;
      try { await reloadUsers(); } catch (e) { }
    } catch (err) {
      st.newNote = (err && err.message) || 'Could not create the account.';
    }
    st.newBusy = false;
    render();
  }

  const actions = {
    'sa-view': (d) => set({ view: d.view, menu: null }),
    'sa-role': (d) => showRole(d.role),
    'sa-range': (d) => set({ range: Number(d.n) === 7 ? 7 : 14 }),
    'sa-month': (d) => set({ month: new Date(st.month.getFullYear(), st.month.getMonth() + (Number(d.dir) || 0), 1) }),
    'sa-day': (d) => {
      const day = parseIso(d.day);
      const patch = { day: d.day };
      if (day.getMonth() !== st.month.getMonth() || day.getFullYear() !== st.month.getFullYear()) patch.month = new Date(day.getFullYear(), day.getMonth(), 1);
      set(patch);
    },
    /* the picked day in the activity log (a local calendar date) */
    'sa-day-activity': () => set({ actQ: '', actRole: 'all', actEntity: 'all', actAction: 'all', actActor: 'all', actBarangay: 'all',
      actFrom: st.day, actTo: st.day, actPage: 1, allOnPage: false, view: 'activity' }),
    'sa-menu': (d) => set({ menu: st.menu === d.menu ? null : d.menu }),
    'sa-acc-role': (d) => set({ accRole: d.value, allAccounts: false, menu: null }),
    'sa-acc-status': (d) => set({ accStatus: d.status, allAccounts: false }),
    'sa-acc-all': () => set({ allAccounts: !st.allAccounts }),
    'sa-new': () => set({ newAcct: { fullName: '', email: '', role: 'barangay_official', barangayId: '', unitId: '', unitRole: 'member' }, newNote: '', menu: null }),
    'sa-new-close': () => set({ newAcct: null, newNote: '' }),
    'sa-new-submit': () => createAccount(),
    'sa-open-account': (d) => openAccount(d.id),
    'sa-edit-close': () => { if (!st.saving) set({ edit: null, editNote: '' }); },
    'sa-save': () => saveAccount(),
    'sa-reset': () => sendReset(),
    'sa-toggle-disabled': () => toggleDisabled(),
    'sa-export': (d) => {
      st.menu = null; render();
      const accounts = d.what === 'accounts';
      const fmt = d.fmt === 'xlsx' || d.fmt === 'csv' ? d.fmt : 'pdf';
      const name = { pdf: 'PDF', xlsx: 'Excel workbook', csv: 'CSV' }[fmt];
      return UG_EXPORT.run('sa-export', () => accounts ? exportAccounts(fmt) : exportActivity(fmt),
        { label: (accounts ? 'account register ' : 'activity log ') + name });
    },
    'sa-act-refresh': async () => {
      if (st.refreshing) return;
      set({ refreshing: true });
      try { const a = await Repo.listAudit(500); S().audit = a; UG.DATA.audit = a; }
      catch (e) { toast((e && e.message) || 'Could not load the activity log', 'warning'); }
      set({ refreshing: false });
    },
    'sa-act-preset': (d) => {
      const days = Number(d.days) || 1;
      set({ actFrom: isoDayLocal(new Date(Date.now() - (days - 1) * 86400000)), actTo: isoDayLocal(new Date()), actPage: 1, allOnPage: false });
    },
    'sa-act-more': () => set({ moreOpen: !st.moreOpen }),
    'sa-act-clear': () => set({ actQ: '', actRole: 'all', actEntity: 'all', actAction: 'all', actActor: 'all', actBarangay: 'all',
      actFrom: '', actTo: '', actPage: 1, allOnPage: false, moreOpen: false }),
    'sa-act-page': (d) => set({ actPage: Math.max(1, Number(d.p) || 1), allOnPage: false }),
    'sa-act-all': () => set({ allOnPage: !st.allOnPage }),
    /* "Open": the screen that holds the record, and the record itself when the
       console can open it (the Activity Log screen's own deep link) */
    'sa-act-open': (d) => {
      const a = audit().find((x) => x.id === d.id);
      if (!a) return;
      const target = ENTITY_ROUTE[a.entity];
      if (!target) return;
      if (target === 'accounts') { set({ view: 'accounts', menu: null }); return; }
      if (a.entity_id && OPENS_DETAIL.indexOf(a.entity) !== -1) {
        act('nav', { route: target });
        act('audit-open-record', { route: target, id: a.entity_id, entity: a.entity });
      } else {
        act('nav', { route: target });
      }
    }
  };

  /* ================================================================ fields
     One listener per event type, bound once, for this screen's fields only
     (data-sa-field). The controller's own listeners read data-field, so the
     two never handle the same element. */
  const TEXT_RERENDER = { query: 'query', actQ: 'actQ' };
  function onField(el, isChange) {
    const f = el.dataset.saField, v = el.value;
    if (TEXT_RERENDER[f]) {
      if (isChange) return;
      if (f === 'query') { st.query = v; st.allAccounts = false; }
      else { st.actQ = v; st.actPage = 1; st.allOnPage = false; }
      render(); /* frame() puts the cursor back */
      return;
    }
    const n = st.newAcct, e = st.edit;
    if (f === 'newName' && n) { n.fullName = v; return; }
    if (f === 'newEmail' && n) { n.email = v; return; }
    if (f === 'editName' && e) { e.name = v; return; }
    if (f === 'editPhone' && e) { e.phone = v; return; }
    if (!isChange) return;
    if (f === 'newRole' && n) { n.role = v; st.newNote = ''; }
    else if (f === 'newBrgy' && n) n.barangayId = v;
    else if (f === 'newUnit' && n) n.unitId = v;
    else if (f === 'newUnitRole' && n) n.unitRole = v;
    else if (f === 'editRole' && e) { e.role = v; st.editNote = ''; }
    else if (f === 'editBrgy' && e) e.barangayId = v;
    else if (f === 'editUnit' && e) e.unitId = v;
    else if (f === 'editUnitRole' && e) e.unitRole = v;
    else if (/^act(Role|Entity|Action|Actor|Barangay|From|To)$/.test(f)) { st[f] = v; st.actPage = 1; st.allOnPage = false; }
    else return;
    render();
  }

  if (!window.__ugSaBound) {
    window.__ugSaBound = true;
    document.addEventListener('input', (ev) => {
      const el = ev.target && ev.target.closest && ev.target.closest('[data-sa-field]');
      if (el) onField(el, false);
    });
    document.addEventListener('change', (ev) => {
      const el = ev.target && ev.target.closest && ev.target.closest('[data-sa-field]');
      if (el) onField(el, true);
    });
    /* keyboard: Enter / Space on the activity rows and hero shields; Escape
       closes an open menu or the account window; Enter sends the new account */
    document.addEventListener('keydown', (ev) => {
      if (!document.querySelector('.ug-sa')) return;
      const t = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && t && t.matches && t.matches('[data-sa-key]')) { ev.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      if (ev.key === 'Enter' && t && t.closest && t.closest('[data-sa-new]') && t.tagName === 'INPUT') { ev.preventDefault(); createAccount(); return; }
      if (ev.key === 'Escape' && !document.querySelector('.ug-modal')) {
        if (st.menu) set({ menu: null });
        else if (st.edit && !st.saving) set({ edit: null, editNote: '' });
      }
    });
    /* a click outside an open menu closes it; a click on the dimmed backdrop
       closes the account window */
    document.addEventListener('click', (ev) => {
      if (!document.querySelector('.ug-sa')) return;
      const t = ev.target;
      if (st.menu && !(t.closest && t.closest('[data-sa-menu]'))) { st.menu = null; render(); }
      if (st.edit && !st.saving && t.matches && t.matches('[data-sa-overlay]')) set({ edit: null, editNote: '' });
    });
    window.addEventListener('resize', syncBand);
  }

  return { ROUTE, handles, frame, load, actions, describe };
})();
