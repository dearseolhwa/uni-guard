/* UniGuard · module exports (js/exports.js)
 *
 * Every export outside the Reports and Documentation module (js/reporting.js)
 * is defined here: the data it reads, its columns, title, scope, filters and
 * format. All of them go through the shared layer:
 *
 *   js/export-core.js   metadata, filenames, dates, CSV, scope checks, run()
 *   js/pdf.js           the formal PDF template
 *   js/xlsx-lite.js     the formatted Excel writer
 *
 * Each export reads the SAME rows its screen shows (shared filter functions in
 * js/screens.js, js/relief.js and js/screens.admin.js). Those rows were loaded
 * through Supabase row level security, so an export can never contain more
 * than the signed-in account may read; validateScope() adds a client-side role
 * check on top so an export cannot be started from a screen the role does not
 * have.
 *
 * app.js keeps its action names; each action calls UG_EXPORTS.run(name).
 */
const UG_EXPORTS = (function () {
  const X = () => UG_EXPORT;
  const app = () => window.UG_App || {};
  const S = () => app().S || {};
  const toast = (m, t) => { if (app().toast) app().toast(m, t); };
  const PLACE = () => (UG_GEO && UG_GEO.PLACE) || {};

  /* scope wording used in titles, metadata and filenames */
  function roleScope(s, barangayFilter) {
    if (s && s.role === 'barangay_official') return { label: 'Barangay ' + (s.barangay || ''), file: s.barangay || '' };
    if (barangayFilter && barangayFilter !== 'All') return { label: 'Barangay ' + barangayFilter, file: barangayFilter };
    return { label: PLACE().scope || 'Municipality-wide', file: PLACE().town || '' };
  }

  function empty(what) { toast('Nothing to export: ' + what, 'info'); return null; }

  /* ================================================== hotline directory */
  function hotlines() {
    X().validateScope({});
    const rows = (UG.DATA.hotlines || []).slice()
      .sort((a, b) => String(a.agency).localeCompare(String(b.agency)))
      .map((h) => [X().titleCase(h.type || ''), h.agency || '', h.number || '', h.scope || '', h.description || '']);
    if (!rows.length) return empty('no hotlines are loaded yet');
    const meta = X().buildMetadata({
      title: 'Emergency Hotline Directory', kind: 'Emergency Hotline Directory', module: 'Hotlines',
      scope: PLACE().scope, count: rows.length, countLabel: 'Hotlines listed', period: '',
      notices: ['Numbers are listed exactly as recorded in UniGuard. Confirm a number with the agency before publishing it elsewhere.']
    });
    return UG_PDF.formal({
      meta: meta,
      subtitle: 'Official emergency contact numbers recorded in UniGuard for ' + (PLACE().label || '') + '.',
      filename: X().buildFilename({ type: 'Emergency Hotline Directory', scope: PLACE().town, ext: 'pdf' }),
      blocks: [{ type: 'table', name: 'Hotlines', columns: [
        { label: 'Type', type: 'text', width: 12 }, { label: 'Agency', type: 'text', width: 30 },
        { label: 'Contact number', type: 'id', width: 20 }, { label: 'Coverage', type: 'text', width: 20 },
        { label: 'Notes', type: 'longtext', width: 30 }], rows: rows }]
    });
  }

  /* ========================================================== analytics */
  function analyticsData() {
    const st = S();
    const s = X().validateScope({ roles: ['lgu_ldrrmc', 'barangay_official'] });
    const m = UG_SCREENS.analyticsModel(st);
    const scope = roleScope(s, m.brgyFilter);
    const an = m.an || {};
    const rangeFrom = an.from || st.anFrom || '';
    const rangeTo = an.to || st.anTo || '';
    const rangeText = (rangeFrom || rangeTo) ? X().periodLabel(rangeFrom, rangeTo) : 'Last 30 days (default range)';
    const filters = [];
    if (s.role === 'lgu_ldrrmc') filters.push('Barangay: ' + (m.brgyFilter === 'All' ? 'All barangays' : m.brgyFilter));
    filters.push('Date range for response performance and daily trend: ' + rangeText);
    const durMin = (sec) => (sec == null ? null : Math.round(sec / 6) / 10);   /* seconds → minutes, 1 decimal */
    const pct = (n, d) => (d ? Math.round(n / d * 1000) / 10 : null);
    const daily = (an.daily || []).map((d, i, arr) => (typeof d === 'object'
      ? [X().formatDate(d.day) || String(d.day), Number(d.total) || 0]
      : [(arr.length - 1 - i) === 0 ? 'Today' : (arr.length - 1 - i) + ' days ago', Number(d) || 0]));
    const reqs = (UG.DATA.unitRequests || []).filter((r) => r.created_at && r.decided_at);
    const acks = reqs.map((r) => (Date.parse(r.decided_at) - Date.parse(r.created_at)) / 1000).filter((n) => isFinite(n) && n >= 0);
    return {
      m: m, scope: scope, filters: filters, rangeFrom: rangeFrom, rangeTo: rangeTo, rangeText: rangeText,
      kpis: [
        ['Reports in the last 7 days', m.week || 0, 'int'],
        ['Change vs the previous 7 days', m.prev ? m.weekDelta : null, 'pct'],
        ['Reports in scope', m.inc.length, 'int'],
        ['Open (unresolved) reports', m.openCount, 'int'],
        ['Open reports older than 30 minutes', m.overThresholdCount, 'int'],
        ['Verified share', pct(m.verified, m.inc.length), 'pct'],
        ['Auto-verified by corroboration (3 or more)', m.autoVerified, 'int'],
        ['Shelters at capacity', m.fullShelters.length, 'int'],
        ['Shelter occupancy (persons)', m.totalOcc, 'int'],
        ['Shelter capacity (persons)', m.totalCap, 'int']
      ],
      response: [
        ['Average time, report to Response Dispatched (minutes)', durMin(an.avgDispatchSeconds), 'num'],
        ['Average time, report to Resolved (minutes)', durMin(an.avgResolveSeconds), 'num'],
        ['Average time, support request acknowledged (minutes)', acks.length ? durMin(acks.reduce((a, b) => a + b, 0) / acks.length) : null, 'num'],
        ['Decided support requests', reqs.length, 'int']
      ],
      daily: daily,
      hazard: m.hazRows.map((r) => [r[0], r[1], pct(r[1], m.inc.length)]),
      barangay: m.brgyRows.map((r) => [r.brgy || 'Unassigned', r.total, pct(r.total, m.inc.length)]),
      status: [['Reported (awaiting verification)', m.stages.reported], ['Verified', m.stages.verified], ['Response Dispatched', m.stages.dispatched],
        ['Resolved', m.stages.resolved], ['Rejected', m.stages.rejected]].map((r) => [r[0], r[1], pct(r[1], m.inc.length)]),
      units: m.unitStats.map((u) => [u.unit, u.count, durMin(u.avg), durMin(u.slowest)]),
      teams: m.teamRows.map((t) => [t.team, t.count]),
      shelters: (m.cen || []).map((c) => [c.name, c.brgy || '', X().titleCase(c.status || ''), Number(c.occ) || 0, Number(c.cap) || 0, c.cap ? Math.round((Number(c.occ) || 0) / Number(c.cap) * 1000) / 10 : null]),
      relief: m.reliefRows.map((r) => [r.brgy || 'Unassigned', r.count])
    };
  }

  const BREAKDOWN_NOTE = 'Counts cover the incident reports currently loaded in the console for this account, with the barangay filter applied. As on the Analytics screen, the date range is not applied to these breakdowns.';

  function analyticsPdf() {
    const d = analyticsData();
    if (!d.m.inc.length && !d.m.cen.length) return empty('there is no analytics data yet');
    const meta = X().buildMetadata({
      title: 'Analytics and Performance Report', kind: 'Analytics and Performance Report', module: 'Analytics and Reporting',
      scope: d.scope.label, period: d.rangeText + ' (response performance and daily trend)', filters: d.filters,
      count: d.m.inc.length, countLabel: 'Incident reports in scope', notices: [BREAKDOWN_NOTE]
    });
    const pctCol = { label: 'Share of reports', type: 'pct', width: 14 };
    return UG_PDF.formal({
      meta: meta,
      subtitle: 'Incident volume, response performance, verification quality, shelter occupancy and relief activity, as shown on the Analytics screen.',
      filename: X().buildFilename({ type: 'Analytics and Performance', scope: d.scope.file, from: d.rangeFrom, to: d.rangeTo, ext: 'pdf' }),
      blocks: [
        { type: 'kpis', name: 'Key figures', items: d.kpis.filter((k) => k[1] != null).slice(0, 8).map((k) => ({ label: k[0], value: X().formatCell(k[1], k[2]) })) },
        { type: 'keyvalue', name: 'Response performance', note: 'Averages for reports in the selected date range (' + d.rangeText + '). A dash means no report in the range reached that stage.', rows: d.response },
        { type: 'bars', name: 'Daily report volume', note: 'Reports filed per day in the selected date range.', items: d.daily, emptyText: 'No daily figures for the selected range.' },
        { type: 'bars', name: 'A. Reports by hazard type', note: BREAKDOWN_NOTE, items: d.hazard.map((r) => [r[0], r[1]]) },
        { type: 'table', name: 'A. Reports by hazard type (table)', columns: [{ label: 'Hazard type', type: 'text', width: 40 }, { label: 'Reports', type: 'int', width: 14 }, pctCol], rows: d.hazard },
        { type: 'table', name: 'B. Reports by barangay', columns: [{ label: 'Barangay', type: 'text', width: 40 }, { label: 'Reports', type: 'int', width: 14 }, pctCol], rows: d.barangay },
        { type: 'table', name: 'C. Report status breakdown', note: 'Current status of each report in scope.', columns: [{ label: 'Status', type: 'status', width: 40 }, { label: 'Reports', type: 'int', width: 14 }, pctCol], rows: d.status,
          total: ['Total', d.m.inc.length, ''] },
        { type: 'table', name: 'D. Response time by unit type', note: 'Time from report to dispatch, from dispatch records loaded in the console. Team names are grouped by unit type (BFP, PNP, Rescue, Hospital).',
          columns: [{ label: 'Unit type', type: 'text', width: 24 }, { label: 'Dispatches', type: 'int', width: 14 }, { label: 'Average (minutes)', type: 'num', width: 18 }, { label: 'Slowest (minutes)', type: 'num', width: 18 }], rows: d.units },
        { type: 'table', name: 'E. Dispatch workload by team', columns: [{ label: 'Team', type: 'text', width: 44 }, { label: 'Dispatches', type: 'int', width: 14 }], rows: d.teams, emptyText: 'No dispatches recorded yet.' },
        { type: 'keyvalue', name: 'F. Verification quality', rows: [
          ['Verified (including dispatched and resolved)', d.m.verified, 'int'], ['Still unverified', d.m.unverified, 'int'],
          ['Rejected or duplicate', d.m.rejected, 'int'], ['Auto-verified by corroboration (3 or more)', d.m.autoVerified, 'int']] },
        { type: 'table', name: 'G. Shelter occupancy', note: 'Status and occupancy at the time of export.', columns: [
          { label: 'Evacuation center', type: 'text', width: 36 }, { label: 'Barangay', type: 'text', width: 20 }, { label: 'Status', type: 'status', width: 12 },
          { label: 'Occupancy', type: 'int', width: 12 }, { label: 'Capacity', type: 'int', width: 12 }, { label: 'Used', type: 'pct', width: 10 }], rows: d.shelters,
          total: d.shelters.length ? ['Total', '', '', d.m.totalOcc, d.m.totalCap, ''] : null },
        { type: 'table', name: 'H. Relief distributions scheduled by barangay', columns: [{ label: 'Barangay', type: 'text', width: 40 }, { label: 'Distributions', type: 'int', width: 14 }], rows: d.relief, emptyText: 'No relief distributions scheduled.' }
      ]
    });
  }

  /* Tidy CSV: one value per row, so it imports into any spreadsheet or tool. */
  function analyticsCsv() {
    const d = analyticsData();
    if (!d.m.inc.length && !d.m.cen.length) return empty('there is no analytics data yet');
    const cols = [{ label: 'Section', type: 'text' }, { label: 'Item', type: 'text' }, { label: 'Measure', type: 'text' }, { label: 'Value', type: 'num' }, { label: 'Unit', type: 'text' }];
    const rows = [];
    const unitOf = (t, label) => t === 'pct' ? 'percent' : /minutes/.test(label) ? 'minutes' : 'count';
    d.kpis.forEach((k) => rows.push(['Key figures', '', k[0], k[1], unitOf(k[2], k[0])]));
    d.response.forEach((k) => rows.push(['Response performance', '', k[0], k[1], unitOf(k[2], k[0])]));
    d.daily.forEach((r) => rows.push(['Daily report volume', r[0], 'Reports', r[1], 'count']));
    d.hazard.forEach((r) => rows.push(['Reports by hazard type', r[0], 'Reports', r[1], 'count']));
    d.barangay.forEach((r) => rows.push(['Reports by barangay', r[0], 'Reports', r[1], 'count']));
    d.status.forEach((r) => rows.push(['Report status', r[0], 'Reports', r[1], 'count']));
    d.units.forEach((r) => {
      rows.push(['Response time by unit type', r[0], 'Dispatches', r[1], 'count']);
      rows.push(['Response time by unit type', r[0], 'Average report to dispatch', r[2], 'minutes']);
      rows.push(['Response time by unit type', r[0], 'Slowest report to dispatch', r[3], 'minutes']);
    });
    d.teams.forEach((r) => rows.push(['Dispatch workload', r[0], 'Dispatches', r[1], 'count']));
    d.shelters.forEach((r) => {
      rows.push(['Shelter occupancy', r[0], 'Occupancy', r[3], 'persons']);
      rows.push(['Shelter occupancy', r[0], 'Capacity', r[4], 'persons']);
    });
    d.relief.forEach((r) => rows.push(['Relief distributions scheduled', r[0], 'Distributions', r[1], 'count']));
    const filename = X().buildFilename({ type: 'Analytics Data', scope: d.scope.file, from: d.rangeFrom, to: d.rangeTo, ext: 'csv' });
    X().saveCsv(filename, cols, rows);
    return { filename: filename, rows: rows.length };
  }

  /* ========================================= Super Admin: accounts, log */
  const ROLE_NAMES = { citizen: 'Citizen', barangay_official: 'Barangay Official', lgu_ldrrmc: 'LDRRMO Staff', super_admin: 'Super Admin', dispatch_team: 'Dispatch Team' };

  function users() {
    X().validateScope({ superAdmin: true });
    const st = S();
    const list = UG_ADMIN.filterUsers(st);
    if (!list.length) return empty('no accounts match the current search');
    const loaded = (UG.DATA.users || []).length;
    const rows = list.map((u) => {
      const r = UG_ADMIN.roleOf ? UG_ADMIN.roleOf(u) : u.role;
      return [u.full_name || '(no name)', u.email || '', ROLE_NAMES[r] || UG_ADMIN.ROLE_LABEL[r] || r || '', u.unit_role || '', u.barangay || '', u.disabled ? 'Disabled' : 'Active', u.created_at || null];
    });
    const notices = [];
    if (loaded >= 200) notices.push('The console loads the 200 most recent accounts. Older accounts are not included in this list.');
    const meta = X().buildMetadata({
      title: 'User Account Register', kind: 'User Account Register', module: 'Super Admin · Users and Roles', scope: 'All accounts visible to the Super Admin',
      filters: st.userSearch && st.userSearch.trim() ? ['Search: "' + st.userSearch.trim() + '"'] : [], count: rows.length, countLabel: 'Accounts listed',
      personalData: true, period: '', notices: notices
    });
    return UG_PDF.formal({
      meta: meta, landscape: true,
      subtitle: 'Accounts, their role, barangay assignment and status. Roles are enforced by the database (row level security).',
      filename: X().buildFilename({ type: 'User Accounts', ext: 'pdf' }),
      blocks: [{ type: 'table', name: 'Accounts', columns: [
        { label: 'Name', type: 'text', width: 26 }, { label: 'Email', type: 'text', width: 32 }, { label: 'Role', type: 'status', width: 18 },
        { label: 'Unit role', type: 'text', width: 16 }, { label: 'Barangay', type: 'text', width: 20 }, { label: 'Status', type: 'status', width: 11 },
        { label: 'Created', type: 'date', width: 14 }], rows: rows }]
    });
  }

  function audit() {
    X().validateScope({ superAdmin: true });
    const st = S();
    const list = UG_ADMIN.filterAudit(st);
    if (!list.length) return empty('no activity entries match the current filters');
    const rows = list.map((a) => {
      const r = a.actor_role === 'super_admin' ? 'super_admin' : a.actor_role;
      return [a.created_at || null, a.actor_name || (a.actor_id ? String(a.actor_id).slice(0, 8) : 'System'), ROLE_NAMES[r] || (r ? X().titleCase(r) : 'System'),
        a.actor_barangay || '', UG_ADMIN.entityLabel(a.entity), a.action || '', UG_ADMIN.describe(a, true)];
    });
    const filters = [st.auditEntity && st.auditEntity !== 'All' ? 'Record type: ' + UG_ADMIN.entityLabel(st.auditEntity) : '',
      st.auditAction && st.auditAction !== 'All' ? 'Action type: ' + st.auditAction : '',
      st.auditRole && st.auditRole !== 'All' ? 'Role: ' + (ROLE_NAMES[st.auditRole] || st.auditRole) : '',
      st.auditBarangay && st.auditBarangay !== 'All' ? 'Barangay: ' + st.auditBarangay : '',
      st.auditActor && st.auditActor !== 'All' ? 'Changed by: ' + st.auditActor : '',
      st.auditQ ? 'Search: "' + st.auditQ + '"' : ''].filter(Boolean);
    const notices = [];
    if ((UG.DATA.audit || []).length >= 500) notices.push('The console loads the 500 most recent activity entries. Earlier entries are not included.');
    const meta = X().buildMetadata({
      title: 'System Activity Log Report', kind: 'System Activity Log Report', module: 'Super Admin · Activity Log',
      scope: 'Barangay Officials, LDRRMO Staff, the Super Admin and Dispatch Teams',
      from: st.auditFrom || '', to: st.auditTo || '', period: (st.auditFrom || st.auditTo) ? X().periodLabel(st.auditFrom, st.auditTo) : 'All loaded entries',
      filters: filters, count: rows.length, countLabel: 'Entries listed', personalData: true, notices: notices
    });
    return UG_PDF.formal({
      meta: meta, landscape: true,
      subtitle: 'Who changed what, newest first. Entries are written by the database at the time of the change; actor and role come from a trusted server source.',
      filename: X().buildFilename({ type: 'Activity Log', from: st.auditFrom, to: st.auditTo, ext: 'pdf' }),
      blocks: [{ type: 'table', name: 'Activity entries', fontSize: 7.5, columns: [
        { label: 'When', type: 'datetime', width: 15 }, { label: 'Who', type: 'text', width: 18 }, { label: 'Role', type: 'status', width: 13 },
        { label: 'Barangay', type: 'text', width: 14 }, { label: 'Module', type: 'text', width: 14 }, { label: 'Action', type: 'text', width: 14 },
        { label: 'What changed', type: 'longtext', width: 48 }], rows: rows }]
    });
  }

  /* ============================================================ relief */
  const DEVICE_ONLY = 'kept on this device only';

  function reliefSchedules() {
    const s = X().validateScope({ roles: ['lgu_ldrrmc', 'barangay_official'] });
    const list = UG_RELIEF.visibleSchedules(S());
    if (!list.length) return empty('no relief distributions are scheduled');
    const cols = [{ label: 'Distribution ID', type: 'id' }, { label: 'Barangay', type: 'text' }, { label: 'Title', type: 'text' }, { label: 'Location', type: 'text' },
      { label: 'Address', type: 'text' }, { label: 'Scheduled at', type: 'datetime' }, { label: 'Contact person', type: 'text' }, { label: 'Contact phone', type: 'id' },
      { label: 'Eligibility', type: 'text' }, { label: 'Required documents', type: 'text' }, { label: 'Active', type: 'text' }];
    const rows = list.map((r) => [r.id, r.barangay, r.title, r.location_name, r.address, r.distribution_at || null, r.contact_person, r.contact_phone,
      (r.eligibility || []).join('; '), (r.required_docs || []).join('; '), r.active === false ? 'No' : 'Yes']);
    const filename = X().buildFilename({ type: 'Relief Distribution Schedule', scope: roleScope(s).file, ext: 'csv' });
    X().saveCsv(filename, cols, rows);
    return { filename: filename, rows: rows.length };
  }

  function beneficiaries() {
    const s = X().validateScope({ roles: ['lgu_ldrrmc', 'barangay_official'] });
    const st = S();
    const list = UG_RELIEF.visibleBeneficiaries(st);
    if (!list.length) return empty('no beneficiaries match the current filter');
    const cols = [{ label: 'Record ID', type: 'id' }, { label: 'Barangay', type: 'text' }, { label: 'Beneficiary name', type: 'text' },
      { label: 'Claimant name', type: 'text' }, { label: 'Claimant ID', type: 'id' }, { label: 'Category', type: 'text' }];
    const rows = list.map((b) => [b.id, b.barangay, b.beneficiary_name, b.claimant_name, b.claimant_id, b.category]);
    const brgy = s.role === 'barangay_official' ? s.barangay : st.benBarangayFilter;
    const filename = X().buildFilename({ type: 'Relief Beneficiaries', scope: roleScope(s, brgy).file, ext: 'csv' });
    X().saveCsv(filename, cols, rows);
    return { filename: filename, rows: rows.length, note: 'contains personal information (RA 10173)' };
  }

  function inventory() {
    const s = X().validateScope({ roles: ['lgu_ldrrmc', 'barangay_official'] });
    const v = UG_RELIEF.visibleInventory(S());
    if (!v.list.length) return empty('no stock items match the current filter');
    const cols = [{ label: 'Item ID', type: 'id' }, { label: 'Item', type: 'text' }, { label: 'Category', type: 'text' }, { label: 'Unit', type: 'text' },
      { label: 'Stock', type: 'int' }, { label: 'Reorder point', type: 'int' }, { label: 'Low stock', type: 'text' }, { label: 'Barangay / store', type: 'text' },
      { label: 'Location', type: 'text' }, { label: 'Supplier', type: 'text' }];
    const rows = v.list.map((r) => [r.id, r.name, r.category, r.unit, r.stock, r.reorder, (Number(r.stock) || 0) <= (Number(r.reorder) || 0) ? 'Yes' : 'No',
      r.barangay || 'MDRRMO Warehouse', r.location || '', r.supplier || '']);
    const filename = X().buildFilename({ type: 'Relief Inventory', scope: roleScope(s, v.brgyFilter).file, suffix: v.cat !== 'all' ? v.cat : '', ext: 'csv' });
    X().saveCsv(filename, cols, rows);
    return { filename: filename, rows: rows.length, note: 'inventory is ' + DEVICE_ONLY };
  }

  function distributionLog() {
    const s = X().validateScope({ roles: ['lgu_ldrrmc', 'barangay_official'] });
    const v = UG_RELIEF.visibleRecords(S());
    if (!v.filtered.length) return empty('no distribution records match the current filter');
    const cols = [{ label: 'Record ID', type: 'id' }, { label: 'Item', type: 'text' }, { label: 'Quantity', type: 'int' }, { label: 'Barangay', type: 'text' },
      { label: 'Family / recipient', type: 'text' }, { label: 'Distributed by', type: 'text' }, { label: 'Distributed at', type: 'datetime' }];
    const rows = v.filtered.map((r) => [r.id, r.item_name, r.qty, r.barangay, r.family, r.distributed_by, r.distributed_at || null]);
    const filename = X().buildFilename({ type: 'Relief Distribution Log', scope: roleScope(s, v.brgyFilter).file, ext: 'csv' });
    X().saveCsv(filename, cols, rows);
    return { filename: filename, rows: rows.length, note: 'the distribution log is ' + DEVICE_ONLY };
  }

  /* ======================================================== guides (all) */
  /* Same data selection and the same step parser as the citizen screen
     (UG_GUIDES.guidesFor / phaseText / parseSteps), so the PDF shows exactly
     the instructions a resident sees, one numbered box per step. Each guide
     row appears once, under the phase it belongs to: the seed stores the
     same text in `body` and in the phase column, and only one is printed. */
  function guides(hazard) {
    X().validateScope({});
    hazard = hazard || 'all';
    const G = UG_GUIDES;
    const list = (UG.DATA.guides || []).filter((g) => g.active !== false);
    const known = G.guideHazards();
    const extra = Array.from(new Set(list.map((g) => g.hazard_type))).filter((h) => known.indexOf(h) === -1).sort();
    const hazards = hazard === 'all' ? known.concat(extra) : [hazard];
    const blocks = [];
    let sections = 0, steps = 0;
    hazards.forEach((h) => {
      const perPhase = G.PHASES.map((p) => [p, G.guidesFor(list, h, p)]).filter((x) => x[1].length);
      if (!perPhase.length) return;
      if (hazard === 'all') blocks.push({ type: 'heading', text: h, level: 1 });
      perPhase.forEach(([p, rows]) => {
        rows.forEach((g) => {
          const parsed = G.parseSteps(G.phaseText(g, p));
          sections++; steps += parsed.steps.length;
          blocks.push({ type: 'steps', name: G.phaseLabel(p).toUpperCase() + ' \u00b7 ' + (g.title || h),
            note: g.summary || '', content: parsed.blocks, emptyText: 'No instructions recorded for this phase yet.' });
        });
      });
    });
    if (!sections) return empty('there are no guides for this hazard yet');
    const title = hazard === 'all' ? 'Disaster Preparedness Guides' : hazard + ' Preparedness Guide';
    const meta = X().buildMetadata({
      title: title, kind: 'Preparedness Guide', module: 'Preparedness Guides', scope: PLACE().label, period: '',
      filters: hazard === 'all' ? [] : ['Hazard: ' + hazard], count: sections, countLabel: 'Guide sections (hazard and phase)'
    });
    return UG_PDF.formal({
      meta: meta, subtitle: 'What to do before, during and after a hazard in ' + (PLACE().label || '') + '. ' + steps + ' numbered steps.',
      filename: X().buildFilename({ type: hazard === 'all' ? 'Preparedness Guides' : hazard + ' Preparedness Guide', ext: 'pdf' }),
      blocks: blocks
    });
  }

  /* ============================================= dispatch team (own unit) */
  function dispatchActivity() {
    X().validateScope({ roles: ['dispatch_team'] });
    const st = UG_DISPATCH.state;
    const list = (st.data && st.data.dispatches) || [];
    if (!list.length) return empty('your unit has no dispatches yet');
    const unit = (st.data && st.data.unit) || {};
    const cols = [{ label: 'Dispatched at', type: 'datetime' }, { label: 'Acknowledged at', type: 'datetime' }, { label: 'On scene at', type: 'datetime' },
      { label: 'Completed at', type: 'datetime' }, { label: 'Dispatch status', type: 'text' }, { label: 'Team', type: 'text' }, { label: 'Incident code', type: 'id' },
      { label: 'Incident barangay', type: 'text' }, { label: 'Minutes to acknowledge', type: 'num' }, { label: 'Minutes from acknowledgement to scene', type: 'num' },
      { label: 'Instructions', type: 'text' }];
    const mins = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return (isFinite(x) && isFinite(y) && y >= x) ? Math.round((y - x) / 6000) / 10 : null; };
    const rows = list.map((d) => [d.dispatched_at || null, d.ack_at || null, d.on_scene_at || null, d.done_at || null, X().titleCase(d.dispatch_status || ''),
      d.team || '', d.report ? d.report.code : '', d.report ? d.report.barangay : '', mins(d.dispatched_at, d.ack_at), mins(d.ack_at, d.on_scene_at), d.instructions || '']);
    const filename = X().buildFilename({ type: 'Dispatch Activity', scope: unit.name || unit.code || '', ext: 'csv' });
    X().saveCsv(filename, cols, rows);
    return { filename: filename, rows: rows.length, note: list.length >= 50 ? 'the 50 most recent dispatches' : '' };
  }

  /* ====================================================== runner */
  const DEFS = {
    'export-hotlines': ['hotline directory PDF', hotlines],
    'export-analytics': ['analytics report PDF', analyticsPdf],
    'analytics-export-csv': ['analytics data CSV', analyticsCsv],
    'admin-export-users': ['account register PDF', users],
    'admin-export-audit': ['activity log PDF', audit],
    'relief-download:distributions': ['relief schedule CSV', reliefSchedules],
    'relief-download:beneficiaries': ['beneficiary list CSV', beneficiaries],
    'inv-download': ['inventory CSV', inventory],
    'rec-download': ['distribution log CSV', distributionLog],
    'guide-download': ['preparedness guide PDF', guides],
    'dispatch-csv': ['dispatch activity CSV', dispatchActivity]
  };

  function run(name, arg) {
    const def = DEFS[name];
    if (!def) { toast('This export is not available', 'warning'); return Promise.resolve(null); }
    return X().run(name.split(':')[0], async () => {
      const res = def[1](arg);
      if (res && res.note && res.filename) res.filename = res.filename + ' (' + res.note + ')';
      return res;
    }, { label: def[0] });
  }

  return { run, hotlines, analyticsPdf, analyticsCsv, users, audit, reliefSchedules, beneficiaries, inventory, distributionLog, guides, dispatchActivity, analyticsData };
})();
