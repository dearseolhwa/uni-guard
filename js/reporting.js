/* UniGuard · Reports and Documentation (js/reporting.js)
 *
 * LDRRMO core module G:
 *   · Situation Report   compiled from the live data already in the console
 *                        (incidents, dispatches, evacuation centers, relief,
 *                        road status, advisories, damage assessments)
 *   · Incident Summary   one incident: details, status timeline, response
 *   · Damage and Needs Assessment   a form + register, per barangay
 *
 * Every document exports to PDF and Excel through the shared export layer:
 * js/export-core.js (metadata, filenames, dates, scope checks), js/pdf.js (the
 * formal PDF template) and js/xlsx-lite.js (the formatted workbook). Sections
 * carry typed columns (`types`, parallel to `head`) and raw values, so the
 * preview, the PDF and the workbook format dates, numbers and money the same
 * way and the workbook keeps real numbers and dates.
 *
 * The module owns its own state and actions, the same way js/dispatch.js does;
 * app.js merges `actions` into its action table and calls loadRoute() when the
 * `reporting` route opens.
 *
 * Storage: damage assessments and the situation report register live in the
 * `damage_assessments` and `situation_reports` tables (migration 044). Until
 * that migration is applied the module keeps them on this device and says so on
 * screen, so the screens are usable for review without touching the database.
 */
const UG_REPORTING = (function () {
  const esc = UG_UTIL.esc;
  const I = UG.icon;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map((k) => ' data-' + k + '="' + esc(o[k]) + '"').join('');

  const NEEDS = ['Food packs', 'Drinking water', 'Temporary shelter / tarpaulin', 'Medicine / medical team',
    'Hygiene kits', 'Clothing / blankets', 'Search and rescue', 'Clearing operations', 'Psychosocial support'];
  const LIFELINE = ['Normal', 'Partially interrupted', 'Interrupted', 'Not assessed'];
  const DNA_STATUS = { draft: 'Draft', submitted: 'Submitted', validated: 'Validated' };
  const LOCAL_DNA = 'uniguard.reporting.dna';
  const LOCAL_SITREP = 'uniguard.reporting.sitreps';

  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => new Date();
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

  const state = {
    tab: 'sitrep',
    from: iso(daysAgo(7)), to: iso(today()),
    brgy: 'All',
    eventName: '', remarks: '',
    incidentId: '', history: {},
    dna: [], dnaMode: 'device', dnaBrgy: 'All',
    issued: [], lastSaved: null,
    loaded: false, loading: false
  };

  /* ----------------------------------------------------------------- helpers */
  const app = () => window.UG_App || {};
  const S = () => (app().S || {});
  const me = () => S().session || {};
  const rerender = () => { if (app().render) app().render(); };
  const toast = (m, t) => { if (app().toast) app().toast(m, t); };
  const isLgu = () => me().role === 'lgu_ldrrmc';
  const isOfficial = () => me().role === 'barangay_official';
  const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const fmt = (v) => num(v).toLocaleString('en-PH');
  const php = (v) => 'PHP ' + num(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const when = (v) => v ? (UG_UTIL.absTime(v) || String(v)) : '';
  const statusLabel = (k) => (UG_THEME.STATUS[k] || { label: k || '' }).label;
  const sevLabel = (k) => (UG_THEME.sev(k) || {}).label || k || '';
  const signer = () => (me().name || 'UniGuard') + (me().title ? ' · ' + me().title : '');

  /* A barangay official always works inside their own barangay. */
  const scopeBrgy = () => isOfficial() ? (me().barangay || '') : state.brgy;
  const scopeLabel = () => { const b = scopeBrgy(); return (!b || b === 'All') ? UG_GEO.PLACE.scope : 'Barangay ' + b; };
  const inScope = (b) => { const s = scopeBrgy(); return !s || s === 'All' || b === s; };
  function inPeriod(ts) {
    if (!ts) return true;                       /* undated rows are never dropped silently */
    const t = new Date(ts).getTime();
    if (isNaN(t)) return true;
    const a = state.from ? new Date(state.from + 'T00:00:00').getTime() : -Infinity;
    const b = state.to ? new Date(state.to + 'T23:59:59').getTime() : Infinity;
    return t >= a && t <= b;
  }
  const barangayNames = () => {
    const live = (S().barangays || []).map((b) => b.name);
    return live.length ? live : UG_GEO.BARANGAYS.slice();
  };
  const barangayId = (name) => { const b = (S().barangays || []).find((x) => x.name === name); return b ? b.id : null; };

  function readLocal(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { return []; } }
  function writeLocal(key, rows) { try { localStorage.setItem(key, JSON.stringify(rows)); } catch (e) { } }

  /* ------------------------------------------------------------ data access */
  function client() { return (typeof Repo !== 'undefined' && Repo.client) ? Repo.client() : null; }

  async function loadDna() {
    const c = client();
    if (c && me().id && me().id !== 'dev') {
      const { data, error } = await c.from('damage_assessments').select('*')
        .order('assessed_on', { ascending: false }).limit(500);
      if (!error) { state.dnaMode = 'server'; state.dna = data || []; return; }
    }
    /* table missing (migration 044 not applied), signed out preview, or offline */
    state.dnaMode = 'device';
    state.dna = readLocal(LOCAL_DNA);
  }

  async function loadIssued() {
    const c = client();
    if (c && state.dnaMode === 'server') {
      const { data, error } = await c.from('situation_reports').select('*')
        .order('created_at', { ascending: false }).limit(100);
      if (!error) { state.issued = data || []; return; }
    }
    state.issued = readLocal(LOCAL_SITREP);
  }

  async function saveDna(row) {
    if (state.dnaMode === 'server') {
      const c = client();
      const clean = Object.assign({}, row);
      const id = clean.id;
      delete clean.id; delete clean.created_at; delete clean.updated_at; delete clean.created_by;
      const q = id ? c.from('damage_assessments').update(clean).eq('id', id) : c.from('damage_assessments').insert(clean);
      const { error } = await q;
      if (error) throw new Error(error.message);
      await loadDna();
      return;
    }
    const rows = readLocal(LOCAL_DNA);
    if (row.id) {
      const i = rows.findIndex((r) => r.id === row.id);
      if (i !== -1) rows[i] = Object.assign({}, rows[i], row, { updated_at: new Date().toISOString() });
    } else {
      rows.unshift(Object.assign({}, row, { id: 'DNA-' + Date.now(), created_at: new Date().toISOString() }));
    }
    writeLocal(LOCAL_DNA, rows);
    state.dna = rows;
  }

  async function removeDna(id) {
    if (state.dnaMode === 'server') {
      const { error } = await client().from('damage_assessments').delete().eq('id', id);
      if (error) throw new Error(error.message);
      await loadDna();
      return;
    }
    const rows = readLocal(LOCAL_DNA).filter((r) => r.id !== id);
    writeLocal(LOCAL_DNA, rows);
    state.dna = rows;
  }

  async function loadRoute() {
    state.loading = true;
    try { await loadDna(); } catch (e) { state.dnaMode = 'device'; state.dna = readLocal(LOCAL_DNA); }
    try { await loadIssued(); } catch (e) { state.issued = readLocal(LOCAL_SITREP); }
    /* dispatch records for the incidents a situation report will list */
    try {
      if (client() && Repo.loadDispatches) {
        const need = (UG.DATA.incidents || []).filter((i) => i.uuid && (i.status === 'dispatched' || i.status === 'resolved') &&
          !(UG.DATA.dispatches || {})[i.uuid]).slice(0, 40);
        await Promise.all(need.map((i) => Repo.loadDispatches(i.uuid).catch(() => null)));
      }
    } catch (e) { }
    state.loading = false; state.loaded = true;
    if (state.incidentId) loadIncidentExtras(state.incidentId);
    rerender();
  }

  function findIncident(id) {
    return (UG.DATA.incidents || []).find((i) => i.id === id || i.uuid === id) || null;
  }

  async function loadIncidentExtras(id) {
    const inc = findIncident(id);
    if (!inc || !inc.uuid || !client()) return;
    try {
      const [hist] = await Promise.all([
        Repo.reportHistory ? Repo.reportHistory(inc.uuid) : Promise.resolve([]),
        Repo.loadDispatches ? Repo.loadDispatches(inc.uuid).catch(() => []) : Promise.resolve([])
      ]);
      state.history[inc.uuid] = hist || [];
    } catch (e) { state.history[inc.uuid] = []; }
    rerender();
  }

  /* -------------------------------------------------- situation report data */
  function dnaRows(filterBrgy) {
    return (state.dna || []).filter((d) => (filterBrgy ? filterBrgy(d.barangay) : true));
  }

  function dnaTotals(rows) {
    const t = { affected_families: 0, affected_persons: 0, displaced_families: 0, displaced_persons: 0, dead: 0, injured: 0,
      missing: 0, houses_totally: 0, houses_partially: 0, infra_damage_php: 0, agri_damage_php: 0 };
    rows.forEach((d) => Object.keys(t).forEach((k) => { t[k] += num(d[k]); }));
    return t;
  }

  /* One list of sections feeds the on-screen preview, the PDF and the workbook,
     so the three can never disagree. */
  function sitrepSections() {
    const incidents = (UG.DATA.incidents || []).filter((i) => inScope(i.brgy) && inPeriod(i.created_at));
    const centers = (UG.DATA.centers || []).filter((c) => inScope(c.brgy));
    const advisories = (UG.DATA.advisories || []).filter((a) => inPeriod(a.created_at) &&
      (a.citywide || scopeBrgy() === 'All' || !scopeBrgy() || String(a.area || '').indexOf(scopeBrgy()) !== -1));
    const roads = (UG.DATA.roadStatus || []).filter((r) => inScope(r.barangay) && r.status && r.status !== 'passable');
    const dna = dnaRows(inScope).filter((d) => inPeriod(d.assessed_on));
    const dt = dnaTotals(dna);
    const relief = (UG.DATA.relief || []).filter((r) => inScope(r.barangay) && inPeriod(r.distribution_at));
    const distLog = (UG.DATA.distributionLog || []).filter((r) => inScope(r.barangay) && inPeriod(r.distributed_at || r.date || r.created_at));
    /* same rule as the relief inventory screen: an official sees their own
       barangay's store and the shared (unassigned) MDRRMO stock */
    const inventory = (UG.DATA.inventory || []).filter((i) => !isOfficial() || !i.barangay || (i.barangay || 'MDRRMO Warehouse') === me().barangay);

    const byStatus = {};
    incidents.forEach((i) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
    const evacuees = centers.reduce((n, c) => n + num(c.occ), 0);
    const openCenters = centers.filter((c) => c.status === 'open' || c.status === 'full').length;

    const dispatchRows = [];
    incidents.forEach((i) => {
      ((UG.DATA.dispatches || {})[i.uuid] || []).forEach((d) => {
        dispatchRows.push([i.id, i.brgy, d.unit_name || d.team || '', UG_EXPORT.titleCase(d.status || 'dispatched'), d.dispatched_at || null, d.eta || null, d.instructions || '']);
      });
    });

    /* barangay x status matrix */
    const matrix = {};
    incidents.forEach((i) => {
      const b = i.brgy || 'Unassigned';
      matrix[b] = matrix[b] || { reported: 0, verified: 0, dispatched: 0, resolved: 0, rejected: 0, total: 0 };
      if (matrix[b][i.status] != null) matrix[b][i.status] += 1;
      matrix[b].total += 1;
    });
    const matrixRows = Object.keys(matrix).sort().map((b) => [b, matrix[b].reported, matrix[b].verified, matrix[b].dispatched, matrix[b].resolved, matrix[b].rejected, matrix[b].total]);

    const needsCount = {};
    dna.forEach((d) => (d.needs || []).forEach((n) => { needsCount[n] = (needsCount[n] || 0) + 1; }));

    const sections = [
      { key: 'summary', name: 'I. Situation overview', note: 'Headline figures for the reporting period and scope.',
        head: ['Indicator', 'Value'], types: ['text', 'int'], widths: [44, 22],
        rows: [
          ['Incidents reported', incidents.length],
          ['Awaiting verification', byStatus.reported || 0],
          ['Verified', byStatus.verified || 0],
          ['Response dispatched', byStatus.dispatched || 0],
          ['Resolved', byStatus.resolved || 0],
          ['Rejected', byStatus.rejected || 0],
          ['Evacuation centers open', openCenters],
          ['Persons inside evacuation centers', evacuees],
          ['Affected families (assessed)', dt.affected_families],
          ['Affected persons (assessed)', dt.affected_persons],
          ['Dead', dt.dead],
          ['Injured', dt.injured],
          ['Missing', dt.missing],
          ['Houses totally damaged', dt.houses_totally],
          ['Houses partially damaged', dt.houses_partially],
          ['Estimated infrastructure damage (PHP)', { v: dt.infra_damage_php, t: 'money' }],
          ['Estimated agriculture damage (PHP)', { v: dt.agri_damage_php, t: 'money' }],
          ['Roads not passable', roads.length],
          ['Advisories issued', advisories.length]
        ] },
      { key: 'incidents', name: 'II. Incidents monitored', note: 'Every report filed in the period, newest first.',
        head: ['Code', 'Reported', 'Barangay', 'Hazard', 'Severity', 'Status', 'Details'], types: ['id', 'datetime', 'text', 'text', 'status', 'status', 'longtext'], widths: [16, 20, 20, 24, 12, 20, 60],
        rows: incidents.map((i) => [i.id, i.created_at || null, i.brgy, i.hazard, sevLabel(i.sev), statusLabel(i.status), i.desc || '']) },
      { key: 'matrix', name: 'III. Incidents by barangay', note: 'Count of reports per barangay and where each sits in the status pipeline.',
        head: ['Barangay', 'Reported', 'Verified', 'Dispatched', 'Resolved', 'Rejected', 'Total'], types: ['text', 'int', 'int', 'int', 'int', 'int', 'int'], widths: [24, 12, 12, 12, 12, 12, 10],
        rows: matrixRows,
        total: matrixRows.length ? ['TOTAL'].concat([1, 2, 3, 4, 5, 6].map((k) => matrixRows.reduce((n, r) => n + r[k], 0))) : null },
      { key: 'damage', name: 'IV. Affected population and damage', note: 'From the Damage and Needs Assessments dated within the period.',
        head: ['Barangay', 'Families', 'Persons', 'Displaced fam.', 'Displaced pers.', 'Dead', 'Injured', 'Missing', 'Houses total', 'Houses partial', 'Infrastructure (PHP)', 'Agriculture (PHP)', 'Status'],
        types: ['text', 'int', 'int', 'int', 'int', 'int', 'int', 'int', 'int', 'int', 'money', 'money', 'status'],
        widths: [22, 10, 10, 13, 13, 8, 9, 9, 12, 13, 20, 20, 12],
        rows: dna.map((d) => [d.barangay, num(d.affected_families), num(d.affected_persons), num(d.displaced_families), num(d.displaced_persons),
          num(d.dead), num(d.injured), num(d.missing), num(d.houses_totally), num(d.houses_partially), num(d.infra_damage_php), num(d.agri_damage_php), DNA_STATUS[d.status] || d.status || '']),
        total: dna.length ? ['TOTAL', dt.affected_families, dt.affected_persons, dt.displaced_families, dt.displaced_persons, dt.dead, dt.injured, dt.missing,
          dt.houses_totally, dt.houses_partially, dt.infra_damage_php, dt.agri_damage_php, ''] : null },
      { key: 'centers', name: 'V. Evacuation centers', note: 'Status and occupancy at the time this report was generated.',
        head: ['Center', 'Barangay', 'Status', 'Occupancy', 'Capacity', 'Used', 'Contact'], types: ['text', 'text', 'status', 'int', 'int', 'pct', 'text'], widths: [34, 20, 12, 12, 12, 10, 28],
        rows: centers.map((c) => [c.name, c.brgy, UG_EXPORT.titleCase(c.status), num(c.occ), num(c.cap), c.cap ? Math.round(num(c.occ) / num(c.cap) * 1000) / 10 : null,
          [c.contact_person, c.contact_phone].filter(Boolean).join(' · ')]) },
      { key: 'response', name: 'VI. Response actions', note: 'Teams and units dispatched to the incidents listed above.',
        head: ['Incident', 'Barangay', 'Team / unit', 'Status', 'Dispatched', 'ETA', 'Instructions'], types: ['id', 'text', 'text', 'status', 'datetime', 'datetime', 'longtext'], widths: [16, 20, 26, 14, 20, 20, 50],
        rows: dispatchRows },
      { key: 'relief', name: 'VII. Relief operations', note: 'Scheduled distributions in the period and the distribution log.',
        head: ['Type', 'Barangay', 'Item / activity', 'Quantity', 'When', 'Details'], types: ['status', 'text', 'text', 'int', 'datetime', 'longtext'], widths: [16, 20, 34, 12, 20, 44],
        rows: relief.map((r) => ['Scheduled', r.barangay, r.title, null, r.distribution_at || null, r.location_name || ''])
          .concat(distLog.map((r) => ['Distributed', r.barangay || '', r.item_name || r.item || '', num(r.qty || r.quantity), r.distributed_at || r.date || r.created_at || null, r.family || r.recipient || r.note || ''])) },
      { key: 'stock', name: 'VIII. Relief stock on hand', note: 'Current inventory; items at or below their reorder point are flagged.',
        head: ['Item', 'Category', 'Stock', 'Unit', 'Reorder at', 'Flag', 'Location'], types: ['text', 'text', 'int', 'text', 'int', 'status', 'text'], widths: [30, 18, 10, 12, 12, 12, 28],
        rows: inventory.map((i) => [i.name, i.category || '', num(i.stock), i.unit || '', num(i.reorder), num(i.stock) <= num(i.reorder) ? 'LOW STOCK' : '', i.location || '']) },
      { key: 'roads', name: 'IX. Roads not passable', note: 'Road sections reported closed or with limited access.',
        head: ['Road', 'Barangay', 'Status', 'Cause', 'Since', 'Expected reopening'], types: ['text', 'text', 'status', 'longtext', 'datetime', 'datetime'], widths: [30, 20, 16, 30, 20, 20],
        rows: roads.map((r) => [r.road_name, r.barangay, UG_EXPORT.titleCase(r.status), r.cause || r.note || '', r.started_at || null, r.estimated_reopen || null]) },
      { key: 'advisories', name: 'X. Advisories issued', note: 'Official broadcasts published in the period.',
        head: ['Published', 'Alert level', 'Type', 'Title', 'Area'], types: ['datetime', 'status', 'text', 'longtext', 'text'], widths: [20, 14, 18, 50, 28],
        rows: advisories.map((a) => [a.created_at || null, sevLabel(a.severity), a.alert_type || a.type || '', a.title, a.citywide ? UG_GEO.PLACE.areaAll : a.area]) },
      { key: 'needs', name: 'XI. Priority needs', note: 'Needs flagged in the damage assessments, by number of barangay assessments requesting them.',
        head: ['Need', 'Assessments requesting'], types: ['text', 'int'], widths: [40, 24],
        rows: Object.keys(needsCount).sort((a, b) => needsCount[b] - needsCount[a]).map((k) => [k, needsCount[k]]) }
    ];
    return { sections: sections, counts: { incidents: incidents.length, evacuees: evacuees, openCenters: openCenters, dna: dna.length, families: dt.affected_families, persons: dt.affected_persons } };
  }

  function nextSitrepNo() {
    const name = (state.eventName || '').trim().toLowerCase();
    const same = (state.issued || []).filter((r) => String(r.event_name || '').trim().toLowerCase() === name);
    return same.reduce((m, r) => Math.max(m, num(r.sitrep_no)), 0) + 1;
  }

  function sitrepTitle() {
    return 'Situation Report No. ' + nextSitrepNo() + (state.eventName.trim() ? ' · ' + state.eventName.trim() : '');
  }

  /* ---------------------------------------------------------------- exports */
  const X = () => UG_EXPORT;
  const columnsOf = (s) => s.head.map((h, i) => ({ label: h, type: (s.types || [])[i] || 'text', width: (s.widths || [])[i] }));
  const periodText = () => X().periodLabel(state.from, state.to) || 'All dates';
  const DEVICE_NOTICE = 'Damage assessments and the situation report register in this document are saved on this device only (migration 044 not yet applied). They are not shared with other devices.';
  const STOCK_NOTICE = 'Relief stock on hand and the distribution log are kept in this browser session (they are not yet stored in the database). Treat those figures as a working record, not an official inventory.';

  function guardRole() {
    return X().validateScope({ roles: ['lgu_ldrrmc', 'barangay_official'] });
  }

  /* sections → formal PDF (shared template, js/pdf.js) */
  function toPdf(meta, opts, sections) {
    const blocks = [];
    if (opts.kpis && opts.kpis.length) blocks.push({ type: 'kpis', name: 'Key figures', items: opts.kpis });
    sections.forEach((s) => blocks.push({ type: 'table', name: s.name, note: s.note, columns: columnsOf(s), rows: s.rows, total: s.total || null,
      emptyText: 'Nothing to report for this period and scope.' }));
    return UG_PDF.formal({ meta: meta, subtitle: opts.subtitle, landscape: opts.landscape !== false, filename: opts.filename,
      signoff: opts.signoff, blocks: blocks });
  }

  /* sections → formatted workbook (Summary sheet + one sheet per section) */
  function toXlsx(meta, opts, sections) {
    return UG_XLSX.report({ meta: meta, filename: opts.filename, keyFigures: opts.keyFigures || [],
      sheets: sections.map((s) => ({ name: s.name.replace(/^[IVX]+\.\s*/, ''), title: s.name, note: s.note, columns: columnsOf(s), rows: s.rows, total: s.total || null })) });
  }

  /* The register number is only printed once the report is in the register.
     Before that the document says it is a draft and which number it will get. */
  function sitrepReference() {
    const ls = state.lastSaved;
    const same = ls && ls.event === state.eventName.trim().toLowerCase() && ls.from === state.from && ls.to === state.to && ls.scope === scopeLabel();
    if (same) return { title: 'Situation Report No. ' + ls.no + (state.eventName.trim() ? ' \u00b7 ' + state.eventName.trim() : ''), reference: 'Situation report register No. ' + ls.no, draft: false };
    return { title: 'Situation Report' + (state.eventName.trim() ? ' \u00b7 ' + state.eventName.trim() : '') + ' (Draft)', reference: '', draft: true,
      note: 'Draft: not yet saved to the situation report register. When saved it will be Situation Report No. ' + nextSitrepNo() + ' for this event.' };
  }

  function exportSitrep(kind) {
    guardRole();
    const built = sitrepSections();
    const ref = sitrepReference();
    const sections = built.sections;
    if (state.remarks.trim()) sections.push({ key: 'remarks', name: 'XII. Remarks and actions taken', note: 'As entered by the preparer.', head: ['Remarks'], types: ['longtext'], widths: [110], rows: [[state.remarks.trim()]] });
    const total = built.counts.incidents;
    const notices = [ref.note, 'Undated records are always included; a record is otherwise included when its date falls within the reporting period. Evacuation centers, stock and road status are as of the time of export.',
      state.dnaMode === 'server' ? '' : DEVICE_NOTICE, STOCK_NOTICE];
    const meta = X().buildMetadata({
      title: ref.title, kind: 'Situation Report', module: 'Reports and Documentation \u00b7 Situation Report', reference: ref.reference,
      scope: scopeLabel(), from: state.from, to: state.to, period: periodText(),
      filters: [isLgu() ? 'Barangay: ' + (state.brgy === 'All' ? 'All barangays' : state.brgy) : '', state.eventName.trim() ? 'Event: ' + state.eventName.trim() : ''],
      count: total, countLabel: 'Incidents in period', notices: notices
    });
    const scopeFile = scopeBrgy() && scopeBrgy() !== 'All' ? scopeBrgy() : UG_GEO.PLACE.town;
    const filename = X().buildFilename({ type: 'Situation Report' + (ref.draft ? ' Draft' : ' No ' + state.lastSaved.no), scope: scopeFile, from: state.from, to: state.to, ext: kind === 'pdf' ? 'pdf' : 'xlsx' });
    const c = built.counts;
    if (kind === 'pdf') {
      return toPdf(meta, { subtitle: 'Compiled from the UniGuard operations record' + (state.eventName.trim() ? ' for ' + state.eventName.trim() : '') + '.', filename: filename,
        kpis: [{ label: 'Incidents in period', value: fmt(c.incidents) }, { label: 'Persons in evacuation centers', value: fmt(c.evacuees), sub: c.openCenters + ' center(s) open' },
          { label: 'Affected families (assessed)', value: fmt(c.families), sub: fmt(c.persons) + ' persons' }, { label: 'Damage assessments included', value: fmt(c.dna) }],
        signoff: [{ label: 'Prepared by', name: me().name || '', title: me().title || '' }, { label: 'Noted by', name: '', title: 'LDRRMO Head' }] }, sections);
    }
    return toXlsx(meta, { filename: filename, keyFigures: [['Incidents in period', c.incidents, 'int'], ['Persons in evacuation centers', c.evacuees, 'int'],
      ['Evacuation centers open', c.openCenters, 'int'], ['Affected families (assessed)', c.families, 'int'], ['Affected persons (assessed)', c.persons, 'int'], ['Damage assessments included', c.dna, 'int']] }, sections);
  }

  async function saveSitrep() {
    const built = sitrepSections();
    const row = {
      sitrep_no: nextSitrepNo(), event_name: state.eventName.trim(),
      period_from: state.from || null, period_to: state.to || null,
      barangay: scopeBrgy() === 'All' ? '' : (scopeBrgy() || ''),
      barangay_id: scopeBrgy() === 'All' ? null : (isOfficial() ? me().barangay_id : barangayId(scopeBrgy())),
      summary: built.counts, remarks: state.remarks.trim(), prepared_by_name: me().name || ''
    };
    if (state.dnaMode === 'server') {
      const { error } = await client().from('situation_reports').insert(row);
      if (error) throw new Error(error.message);
      await loadIssued();
    } else {
      const rows = readLocal(LOCAL_SITREP);
      rows.unshift(Object.assign({ id: 'SR-' + Date.now(), created_at: new Date().toISOString() }, row));
      writeLocal(LOCAL_SITREP, rows);
      state.issued = rows;
    }
    state.lastSaved = { no: row.sitrep_no, event: state.eventName.trim().toLowerCase(), from: state.from, to: state.to, scope: scopeLabel() };
    return row;
  }

  /* ----------------------------------------------------- incident summary */
  function incidentSections(inc) {
    const hist = state.history[inc.uuid] || [];
    const disp = (UG.DATA.dispatches || {})[inc.uuid] || [];
    const dna = (state.dna || []).filter((d) => d.report_id && (d.report_id === inc.uuid || d.report_id === inc.id));
    const timeline = [[inc.created_at || null, 'Reported', inc.mine ? 'Filed by you' : 'Filed by a resident']]
      .concat(hist.map((h) => [h.created_at || null, statusLabel(h.from_status) + ' \u2192 ' + statusLabel(h.to_status), h.reason || '']));
    return [
      { key: 'details', name: 'Incident details', note: 'The report as filed and its current status.', head: ['Field', 'Value'], types: ['text', 'longtext'], widths: [28, 80],
        rows: [
          ['Incident code', inc.id], ['Hazard', inc.hazard], ['Severity', sevLabel(inc.sev)], ['Current status', statusLabel(inc.status)],
          ['Barangay', inc.brgy], ['Location', inc.area || ''], ['Location note', inc.location_note || ''],
          ['Coordinates', (typeof inc.lat === 'number' && typeof inc.lng === 'number') ? inc.lat.toFixed(6) + ', ' + inc.lng.toFixed(6) : 'Not recorded'],
          ['Reported', { v: inc.created_at || null, t: 'datetime' }],
          ['Corroborations', { v: num(inc.corr), t: 'int' }],
          ['Verified by', inc.verified_by_name ? inc.verified_by_name + (inc.verified_at ? ' · ' + UG_EXPORT.formatDateTime(inc.verified_at, true) : '') : 'Not yet verified'],
          ['Photo attached', inc.remote_photo ? 'Yes' : 'No'],
          ['Description', inc.desc || '']
        ] },
      { key: 'timeline', name: 'Status timeline', note: 'Each move through the status pipeline, oldest first. These are historical changes; the current status is in the details above.', head: ['When', 'Change', 'Note'], types: ['datetime', 'text', 'longtext'], widths: [24, 36, 60], rows: timeline },
      { key: 'response', name: 'Response dispatched', note: 'Teams and units sent to this incident.', head: ['Team / unit', 'Status', 'Dispatched', 'ETA', 'By', 'Instructions'], types: ['text', 'status', 'datetime', 'datetime', 'text', 'longtext'], widths: [26, 14, 22, 22, 22, 50],
        rows: disp.map((d) => [d.unit_name || d.team || '', UG_EXPORT.titleCase(d.status || 'dispatched'), d.dispatched_at || null, d.eta || null, d.dispatched_by_name || '', d.instructions || '']) },
      { key: 'dna', name: 'Damage and needs', note: 'Assessments linked to this incident.', head: ['Assessed', 'Families', 'Persons', 'Dead', 'Injured', 'Missing', 'Houses total', 'Houses partial', 'Needs'], types: ['date', 'int', 'int', 'int', 'int', 'int', 'int', 'int', 'longtext'], widths: [16, 10, 10, 8, 9, 9, 12, 13, 50],
        rows: dna.map((d) => [d.assessed_on || null, num(d.affected_families), num(d.affected_persons), num(d.dead), num(d.injured), num(d.missing), num(d.houses_totally), num(d.houses_partially), (d.needs || []).join(', ')]) }
    ];
  }

  function exportIncident(kind) {
    guardRole();
    const inc = findIncident(state.incidentId);
    if (!inc) { toast('Choose an incident first', 'info'); return null; }
    if (!inScope(inc.brgy)) throw new Error('You can only export incidents in Barangay ' + (me().barangay || '') + '.');
    const sections = incidentSections(inc);
    const meta = X().buildMetadata({
      title: 'Incident Summary Report \u00b7 ' + inc.id, kind: 'Incident Summary Report', module: 'Reports and Documentation \u00b7 Incident Summary',
      reference: 'Incident code ' + inc.id, scope: 'Barangay ' + inc.brgy, period: '', count: 1, countLabel: 'Incidents',
      filters: ['Incident: ' + inc.id], notices: [inc.created_at ? '' : 'The report time was not recorded with an absolute date on this device.']
    });
    const filename = X().buildFilename({ type: 'Incident Summary ' + inc.id, scope: inc.brgy, ext: kind === 'pdf' ? 'pdf' : 'xlsx' });
    if (kind === 'pdf') {
      return toPdf(meta, { subtitle: inc.hazard + ' \u00b7 Barangay ' + inc.brgy + ' \u00b7 current status: ' + statusLabel(inc.status), filename: filename, landscape: false,
        signoff: [{ label: 'Prepared by', name: me().name || '', title: me().title || '' }] }, sections);
    }
    return toXlsx(meta, { filename: filename, keyFigures: [['Hazard', inc.hazard], ['Barangay', inc.brgy], ['Current status', statusLabel(inc.status)], ['Severity', sevLabel(inc.sev)]] }, sections);
  }

  /* -------------------------------------------- damage assessment exports */
  /* An official only ever sees their own barangay's assessments. On the server
     row level security already guarantees this; on a shared device (assessments
     kept in this browser) the filter here is what keeps other barangays out. */
  function dnaVisible() {
    return (state.dna || []).filter((d) => isOfficial() ? d.barangay === (me().barangay || '') : (state.dnaBrgy === 'All' || d.barangay === state.dnaBrgy));
  }

  function dnaSections(rows) {
    const t = dnaTotals(rows);
    return [
      { key: 'register', name: 'Damage and needs register', note: 'One row per barangay assessment.',
        head: ['Assessed', 'Barangay', 'Event / hazard', 'Families', 'Persons', 'Displaced fam.', 'Displaced pers.', 'Dead', 'Injured', 'Missing', 'Houses total', 'Houses partial', 'Infrastructure (PHP)', 'Agriculture (PHP)', 'Status'],
        types: ['date', 'text', 'text', 'int', 'int', 'int', 'int', 'int', 'int', 'int', 'int', 'int', 'money', 'money', 'status'],
        widths: [14, 20, 26, 10, 10, 13, 13, 8, 9, 9, 12, 13, 20, 20, 12],
        rows: rows.map((d) => [d.assessed_on || null, d.barangay, [d.event_name, d.hazard_type].filter(Boolean).join(' · '), num(d.affected_families), num(d.affected_persons),
          num(d.displaced_families), num(d.displaced_persons), num(d.dead), num(d.injured), num(d.missing), num(d.houses_totally), num(d.houses_partially),
          num(d.infra_damage_php), num(d.agri_damage_php), DNA_STATUS[d.status] || d.status || '']),
        total: rows.length ? ['TOTAL', '', '', t.affected_families, t.affected_persons, t.displaced_families, t.displaced_persons, t.dead, t.injured, t.missing,
          t.houses_totally, t.houses_partially, t.infra_damage_php, t.agri_damage_php, ''] : null },
      { key: 'lifelines', name: 'Lifelines and needs', note: 'Utility status and the needs each barangay flagged.',
        head: ['Barangay', 'Assessed', 'Power', 'Water', 'Communications', 'Needs', 'Priority notes', 'Assessed by'], types: ['text', 'date', 'status', 'status', 'status', 'longtext', 'longtext', 'text'], widths: [20, 14, 20, 20, 20, 44, 44, 24],
        rows: rows.map((d) => [d.barangay, d.assessed_on || null, d.power_status || '', d.water_status || '', d.comms_status || '', (d.needs || []).join(', '), d.needs_notes || '', d.assessed_by_name || '']) },
      { key: 'notes', name: 'Damage descriptions', note: 'Narrative detail behind the cost estimates.',
        head: ['Barangay', 'Infrastructure', 'Agriculture', 'Remarks'], types: ['text', 'longtext', 'longtext', 'longtext'], widths: [20, 50, 50, 50],
        rows: rows.map((d) => [d.barangay, d.infra_notes || '', d.agri_notes || '', d.remarks || '']) }
    ];
  }

  function exportDna(kind, onlyId) {
    guardRole();
    /* a single assessment is still taken from the visible (scoped) rows */
    const rows = onlyId ? dnaVisible().filter((d) => String(d.id) === String(onlyId)) : dnaVisible();
    if (!rows.length) { toast('No assessments to export', 'info'); return null; }
    const one = onlyId ? rows[0] : null;
    const title = one ? 'Damage and Needs Assessment \u00b7 Barangay ' + one.barangay : 'Damage and Needs Assessment Register';
    const scope = one ? 'Barangay ' + one.barangay : (isOfficial() ? 'Barangay ' + (me().barangay || '') : (state.dnaBrgy === 'All' ? UG_GEO.PLACE.scope : 'Barangay ' + state.dnaBrgy));
    const dates = rows.map((d) => d.assessed_on).filter(Boolean).sort();
    const sections = dnaSections(rows);
    const t = dnaTotals(rows);
    const meta = X().buildMetadata({
      title: title, kind: 'Damage and Needs Assessment', module: 'Reports and Documentation \u00b7 Damage and Needs Assessment',
      scope: scope, period: dates.length ? X().periodLabel(dates[0], dates[dates.length - 1]) + ' (assessment dates)' : '',
      filters: isLgu() && !one ? ['Barangay: ' + (state.dnaBrgy === 'All' ? 'All barangays' : state.dnaBrgy)] : (one ? ['Single assessment dated ' + (X().formatDate(one.assessed_on) || '')] : []),
      count: rows.length, countLabel: 'Assessments',
      notices: [state.dnaMode === 'server' ? '' : DEVICE_NOTICE, 'Status shows where each assessment is in the Draft / Submitted / Validated workflow. Only LDRRMO staff can validate.']
    });
    const filename = X().buildFilename({ type: one ? 'Damage and Needs Assessment' : 'Damage and Needs Register', scope: one ? one.barangay : (isOfficial() ? me().barangay : (state.dnaBrgy === 'All' ? UG_GEO.PLACE.town : state.dnaBrgy)),
      date: one ? one.assessed_on : '', from: !one && dates.length ? dates[0] : '', to: !one && dates.length ? dates[dates.length - 1] : '', ext: kind === 'pdf' ? 'pdf' : 'xlsx' });
    if (kind === 'pdf') {
      return toPdf(meta, { subtitle: 'Rapid damage and needs assessment record.', filename: filename,
        kpis: [{ label: 'Affected families', value: fmt(t.affected_families), sub: fmt(t.affected_persons) + ' persons' }, { label: 'Displaced families', value: fmt(t.displaced_families), sub: fmt(t.displaced_persons) + ' persons' },
          { label: 'Dead / injured / missing', value: fmt(t.dead) + ' / ' + fmt(t.injured) + ' / ' + fmt(t.missing) }, { label: 'Estimated damage (PHP)', value: num(t.infra_damage_php + t.agri_damage_php).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }],
        signoff: [{ label: 'Prepared by', name: me().name || '', title: me().title || '' }, { label: 'Validated by', name: '', title: 'LDRRMO' }] }, sections);
    }
    return toXlsx(meta, { filename: filename, keyFigures: [['Assessments', rows.length, 'int'], ['Affected families', t.affected_families, 'int'], ['Affected persons', t.affected_persons, 'int'],
      ['Estimated infrastructure damage', t.infra_damage_php, 'money'], ['Estimated agriculture damage', t.agri_damage_php, 'money']] }, sections);
  }

  /* ----------------------------------------------------------------- render */
  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2><p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  const exportButtons = (pdfAct, xlsAct, extra) =>
    '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A(pdfAct, extra) + '>' + I('doc', 15) + 'Export PDF</button>' +
    '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A(xlsAct, extra) + '>' + I('download', 15) + 'Export Excel</button>';

  function previewTable(s, cap) {
    const rows = s.rows.slice(0, cap || 6);
    const types = s.types || [];
    const cell = (c, i) => { const t = (c && typeof c === 'object' && 't' in c) ? c.t : types[i];
      return '<td' + (UG_EXPORT.isNumericType(t) ? ' class="t-num"' : '') + ' style="max-width:320px">' + esc(typeof c === 'string' && UG_EXPORT.isNumericType(t) ? c : UG_EXPORT.formatCell(c, t)) + '</td>'; };
    return '<div class="ug-card" style="overflow:hidden"><div class="ug-card-h"><h3>' + esc(s.name) + '</h3>' +
        '<span class="ug-chip">' + s.rows.length + ' row' + (s.rows.length === 1 ? '' : 's') + '</span></div>' +
      (s.rows.length
        ? '<div style="overflow-x:auto"><table class="ug-table"><thead><tr>' + s.head.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
            rows.map((r) => '<tr>' + r.map(cell).join('') + '</tr>').join('') +
            (s.total ? '<tr style="font-weight:700">' + s.total.map(cell).join('') + '</tr>' : '') +
          '</tbody></table></div>' +
          (s.rows.length > rows.length ? '<div class="ug-dimmer" style="font-size:11px;padding:9px 14px">+ ' + (s.rows.length - rows.length) + ' more in the exported document</div>' : '')
        : '<div class="ug-dimmer" style="font-size:11.5px;padding:14px">Nothing to report for this period and scope.</div>') +
      '</div>';
  }

  function deviceNote() {
    if (state.dnaMode === 'server') return '';
    return '<div class="ug-card ug-card--flat" style="border-left:3px solid var(--ug-warning)"><div class="ug-card-b" style="font-size:11.5px;line-height:1.55">' +
      '<b style="color:var(--ug-warning)">Saved on this device only.</b> Damage assessments and the situation report register are kept in this browser until ' +
      'migration 044 is applied to the database. After that they are shared across every LDRRMO and barangay device and written to the activity log.</div></div>';
  }

  function tabs() {
    const list = [['sitrep', 'Situation Report', 'doc'], ['incident', 'Incident Summary', 'alert'], ['dna', 'Damage & Needs Assessment', 'layers']];
    return '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:8px">' + list.map((t) =>
      '<button class="ug-chip' + (state.tab === t[0] ? ' is-on' : '') + '"' + A('rp-tab', attr({ v: t[0] })) + '>' + I(t[2], 14) + t[1] + '</button>').join('') + '</div>';
  }

  const field = (label, inner, style) => '<div class="ug-field" style="margin:0;' + (style || '') + '"><label class="ug-lab">' + esc(label) + '</label>' + inner + '</div>';
  const brgyOptions = (sel, withAll) => (withAll ? '<option value="All"' + (sel === 'All' ? ' selected' : '') + '>All barangays</option>' : '') +
    barangayNames().map((b) => '<option' + (b === sel ? ' selected' : '') + '>' + esc(b) + '</option>').join('');

  function vSitrep() {
    const built = sitrepSections();
    const c = built.counts;
    const controls = '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:12px">' +
      '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
        field('Event or incident name', '<input class="ug-in" data-rp="eventName" value="' + esc(state.eventName) + '" placeholder="e.g. Typhoon Pepito, Southwest Monsoon">', 'flex:2;min-width:220px') +
        field('From', '<input class="ug-in" type="date" data-rp="from" value="' + esc(state.from) + '">') +
        field('To', '<input class="ug-in" type="date" data-rp="to" value="' + esc(state.to) + '">') +
        (isLgu() ? field('Barangay', '<select class="ug-sel" data-rp="brgy">' + brgyOptions(state.brgy, true) + '</select>', 'min-width:170px') : '') +
      '</div>' +
      field('Remarks and actions taken (optional)', '<textarea class="ug-ta" rows="2" data-rp="remarks" placeholder="Summary of actions taken, coordination with BFP / PNP / DSWD / DOH / OCD, and next steps.">' + esc(state.remarks) + '</textarea>') +
      '<div class="ug-rowf ug-between ug-wrap" style="gap:10px;align-items:center">' +
        '<span class="ug-dimmer" style="font-size:11px">This will be <b>' + esc(sitrepTitle()) + '</b> · ' + esc(scopeLabel()) + '. The number advances when you save it to the register.</span>' +
        '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:8px">' + exportButtons('rp-sitrep-pdf', 'rp-sitrep-xlsx') +
          '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('rp-sitrep-save') + '>' + I('check', 15) + 'Save to register</button></div>' +
      '</div></div></div>';

    const stats = '<div class="ug-dgrid4">' +
      UG.stat({ label: 'Incidents in period', value: String(c.incidents), delta: periodText(), dir: 'flat', tone: 'advisory', icon: 'inbox' }) +
      UG.stat({ label: 'Evacuees in centers', value: fmt(c.evacuees), delta: c.openCenters + ' center(s) open', dir: 'flat', tone: 'warning', icon: 'shelter' }) +
      UG.stat({ label: 'Affected families', value: fmt(c.families), delta: fmt(c.persons) + ' persons assessed', dir: 'flat', tone: 'emergency', icon: 'users' }) +
      UG.stat({ label: 'Assessments included', value: String(c.dna), delta: 'Damage and needs', dir: 'flat', tone: 'resolved', icon: 'layers' }) +
      '</div>';

    const issued = state.issued || [];
    const register = '<div class="ug-card" style="overflow:hidden"><div class="ug-card-h"><h3>Situation report register</h3><span class="ug-chip">' + issued.length + ' issued</span></div>' +
      (issued.length
        ? '<table class="ug-table"><thead><tr><th>No.</th><th>Event</th><th>Period</th><th>Scope</th><th>Prepared by</th><th>Saved</th></tr></thead><tbody>' +
          issued.slice(0, 12).map((r) => '<tr><td class="t-num">' + esc(r.sitrep_no) + '</td><td>' + esc(r.event_name || '—') + '</td><td>' + esc((r.period_from || '') + ' to ' + (r.period_to || '')) + '</td>' +
            '<td>' + esc(r.barangay ? 'Barangay ' + r.barangay : UG_GEO.PLACE.areaAll) + '</td><td>' + esc(r.prepared_by_name || '') + '</td><td class="t-num">' + esc(when(r.created_at)) + '</td></tr>').join('') + '</tbody></table>'
        : '<div class="ug-dimmer" style="font-size:11.5px;padding:14px">No situation report has been saved yet. Saving records the number, period and headline figures so the next report continues the series.</div>') +
      '</div>';

    return controls + stats + built.sections.map((s) => previewTable(s, 5)).join('') + register;
  }

  function vIncident() {
    const list = UG.DATA.incidents || [];
    const inc = findIncident(state.incidentId);
    const picker = '<div class="ug-card"><div class="ug-card-b ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
      field('Incident', '<select class="ug-sel" data-rp="incidentId"><option value="">Choose an incident</option>' +
        list.map((i) => '<option value="' + esc(i.id) + '"' + (inc && inc.id === i.id ? ' selected' : '') + '>' + esc(i.id + ' · ' + i.hazard + ' · ' + i.brgy + ' · ' + statusLabel(i.status)) + '</option>').join('') +
        '</select>', 'flex:1;min-width:280px') +
      (inc ? '<div class="ug-rowf ug-gap8" style="gap:8px">' + exportButtons('rp-inc-pdf', 'rp-inc-xlsx') + '</div>' : '') +
      '</div></div>';
    if (!inc) {
      return picker + '<div class="ug-empty"><span class="e-ico">' + I('alert', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">Choose an incident to summarise</div>' +
        '<div class="ug-dim" style="font-size:11px">The summary pulls the report, its status timeline, the teams dispatched and any linked damage assessment into one document.</div></div>';
    }
    return picker + incidentSections(inc).map((s) => previewTable(s, 14)).join('');
  }

  function vDna() {
    const rows = dnaVisible();
    const t = dnaTotals(rows);
    const canValidate = isLgu();
    const body = rows.map((d) => {
      const tone = d.status === 'validated' ? 'var(--ug-prepared)' : d.status === 'submitted' ? 'var(--ug-signal)' : 'var(--ug-ink-3)';
      const locked = d.status === 'validated' && !canValidate;
      return '<tr>' +
        '<td class="t-num" style="white-space:nowrap">' + esc(d.assessed_on || '') + '</td>' +
        '<td><div style="font-weight:600">' + esc(d.barangay) + '</div><div class="ug-dimmer" style="font-size:10.5px">' + esc([d.event_name, d.hazard_type].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td class="t-num">' + fmt(d.affected_families) + ' / ' + fmt(d.affected_persons) + '</td>' +
        '<td class="t-num">' + fmt(d.dead) + ' / ' + fmt(d.injured) + ' / ' + fmt(d.missing) + '</td>' +
        '<td class="t-num">' + fmt(d.houses_totally) + ' / ' + fmt(d.houses_partially) + '</td>' +
        '<td class="t-num">' + esc(php(num(d.infra_damage_php) + num(d.agri_damage_php))) + '</td>' +
        '<td style="max-width:220px;font-size:11px">' + esc((d.needs || []).join(', ') || '—') + '</td>' +
        '<td><span class="ug-badge" style="color:' + tone + ';border-color:' + tone + '">' + esc(DNA_STATUS[d.status] || d.status || 'Draft') + '</span></td>' +
        '<td class="t-right" style="white-space:nowrap">' +
          (canValidate && d.status === 'submitted' ? '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('rp-dna-status', attr({ id: d.id, v: 'validated' })) + '>Validate</button> ' : '') +
          (!locked ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('rp-dna-edit', attr({ id: d.id })) + '>Edit</button> ' : '') +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('rp-dna-one-pdf', attr({ id: d.id })) + ' title="Export this assessment as PDF">' + I('doc', 14) + '</button> ' +
          /* a barangay may withdraw its own draft; anything further along is LDRRMO only */
          ((canValidate || !d.status || d.status === 'draft') ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('rp-dna-delete', attr({ id: d.id })) + ' title="Delete">' + I('x', 14) + '</button>' : '') +
        '</td></tr>';
    }).join('');

    const toolbar = '<div class="ug-card"><div class="ug-card-b ug-rowf ug-between ug-wrap" style="gap:12px;align-items:flex-end">' +
      (isLgu() ? field('Barangay', '<select class="ug-sel" data-rp="dnaBrgy">' + brgyOptions(state.dnaBrgy, true) + '</select>', 'min-width:190px')
        : '<span class="ug-dim" style="font-size:12px">Assessments for Barangay ' + esc(me().barangay || '') + '</span>') +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:8px">' + exportButtons('rp-dna-pdf', 'rp-dna-xlsx') +
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('rp-dna-add') + '>' + I('plus', 15) + 'New Assessment</button></div>' +
      '</div></div>';

    const stats = '<div class="ug-dgrid4">' +
      UG.stat({ label: 'Affected families', value: fmt(t.affected_families), delta: fmt(t.affected_persons) + ' persons', dir: 'flat', tone: 'emergency', icon: 'users' }) +
      UG.stat({ label: 'Displaced families', value: fmt(t.displaced_families), delta: fmt(t.displaced_persons) + ' persons', dir: 'flat', tone: 'warning', icon: 'shelter' }) +
      UG.stat({ label: 'Houses damaged', value: fmt(t.houses_totally + t.houses_partially), delta: fmt(t.houses_totally) + ' totally · ' + fmt(t.houses_partially) + ' partially', dir: 'flat', tone: 'advisory', icon: 'home' }) +
      UG.stat({ label: 'Estimated damage', value: php(t.infra_damage_php + t.agri_damage_php), delta: 'Infrastructure + agriculture', dir: 'flat', tone: 'resolved', icon: 'layers' }) +
      '</div>';

    const table = rows.length
      ? '<div class="ug-card" style="overflow:hidden"><div style="overflow-x:auto"><table class="ug-table"><thead><tr><th>Assessed</th><th>Barangay / event</th><th>Families / persons</th><th>Dead / inj. / missing</th>' +
        '<th>Houses total / partial</th><th>Est. damage</th><th>Needs</th><th>Status</th><th class="t-right">Action</th></tr></thead><tbody>' + body + '</tbody></table></div></div>'
      : '<div class="ug-empty"><span class="e-ico">' + I('layers', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No damage assessment recorded yet</div>' +
        '<div class="ug-dim" style="font-size:11px">Record one per barangay after a hazard. The figures feed the situation report automatically.</div>' +
        (UG_CONFIG.DEV ? '<button class="ug-btn ug-btn--sm" style="margin-top:10px"' + A('rp-dna-sample') + '>Load sample rows (preview only)</button>' : '') + '</div>';

    return toolbar + stats + table;
  }

  function dReporting(st) {
    const allowed = isLgu() || isOfficial();
    if (!allowed) {
      return '<div class="ug-col" style="gap:16px">' + head('Reports and Documentation', 'Situation reports, incident summaries and damage assessments.') +
        '<div class="ug-empty"><span class="e-ico">' + I('shield', 20) + '</span><div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">Available to LDRRMO staff and barangay officials</div></div></div>';
    }
    const body = state.tab === 'incident' ? vIncident() : state.tab === 'dna' ? vDna() : vSitrep();
    return '<div class="ug-col" style="gap:16px">' +
      head('Reports and Documentation', 'Auto-generated situation reports and incident summaries, and the damage and needs assessment. Scope: ' + (isOfficial() ? 'Barangay ' + (me().barangay || '') : UG_GEO.PLACE.scope) + '.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('rp-refresh') + '>' + I('wave', 15) + 'Refresh</button>') +
      tabs() + deviceNote() + body + '</div>';
  }

  /* --------------------------------------------------- assessment form */
  function dnaForm(existing) {
    const d = existing || {};
    const lockedBrgy = isOfficial() ? (me().barangay || '') : null;
    const selBrgy = d.barangay || lockedBrgy || (state.dnaBrgy !== 'All' ? state.dnaBrgy : barangayNames()[0]);
    const n = (key, label) => '<div class="ug-field" style="flex:1;min-width:110px"><label class="ug-lab">' + label + '</label>' +
      '<input class="ug-in" type="number" min="0" step="1" inputmode="numeric" data-f="' + key + '" value="' + esc(d[key] != null ? d[key] : '') + '" placeholder="0"></div>';
    const money = (key, label) => '<div class="ug-field" style="flex:1;min-width:150px"><label class="ug-lab">' + label + '</label>' +
      '<input class="ug-in" type="number" min="0" step="0.01" inputmode="decimal" data-f="' + key + '" value="' + esc(d[key] != null ? d[key] : '') + '" placeholder="0.00"></div>';
    const sel = (key, label, opts, cur) => '<div class="ug-field" style="flex:1;min-width:150px"><label class="ug-lab">' + label + '</label><select class="ug-sel" data-f="' + key + '">' +
      opts.map((o) => '<option' + (o === cur ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
    const row = (inner) => '<div class="ug-rowf ug-wrap" style="gap:12px">' + inner + '</div>';
    const group = (t) => '<div class="ug-lab" style="margin:14px 0 6px;color:var(--ug-signal)">' + t + '</div>';
    const incidents = (UG.DATA.incidents || []).slice(0, 150);
    const hazards = UG_HAZARDS.LIST.map((h) => h.label);

    UG_FEATURES.modal({
      title: existing ? 'Edit damage and needs assessment' : 'New damage and needs assessment',
      body:
        row('<div class="ug-field" style="flex:1;min-width:170px"><label class="ug-lab">Barangay</label>' +
            (lockedBrgy ? '<input class="ug-in" data-f="barangay" value="' + esc(lockedBrgy) + '" readonly>'
              : '<select class="ug-sel" data-f="barangay">' + brgyOptions(selBrgy, false) + '</select>') + '</div>' +
          '<div class="ug-field" style="flex:1;min-width:150px"><label class="ug-lab">Date assessed</label><input class="ug-in" type="date" data-f="assessed_on" value="' + esc(d.assessed_on || iso(today())) + '"></div>') +
        row('<div class="ug-field" style="flex:1;min-width:170px"><label class="ug-lab">Event name</label><input class="ug-in" data-f="event_name" value="' + esc(d.event_name || state.eventName || '') + '" placeholder="e.g. Typhoon Pepito"></div>' +
          sel('hazard_type', 'Hazard', hazards, d.hazard_type || hazards[0])) +
        '<div class="ug-field"><label class="ug-lab">Linked incident (optional)</label><select class="ug-sel" data-f="report_id"><option value="">None</option>' +
          incidents.map((i) => '<option value="' + esc(i.uuid || i.id) + '"' + ((d.report_id === i.uuid || d.report_id === i.id) ? ' selected' : '') + '>' + esc(i.id + ' · ' + i.hazard + ' · ' + i.brgy) + '</option>').join('') + '</select></div>' +
        group('Affected population') +
        row(n('affected_families', 'Affected families') + n('affected_persons', 'Affected persons') + n('displaced_families', 'Displaced families') + n('displaced_persons', 'Displaced persons')) +
        group('Casualties') +
        row(n('dead', 'Dead') + n('injured', 'Injured') + n('missing', 'Missing')) +
        group('Damage') +
        row(n('houses_totally', 'Houses totally damaged') + n('houses_partially', 'Houses partially damaged')) +
        row(money('infra_damage_php', 'Infrastructure damage (PHP)') + money('agri_damage_php', 'Agriculture damage (PHP)')) +
        row('<div class="ug-field" style="flex:1;min-width:200px"><label class="ug-lab">Infrastructure details</label><textarea class="ug-ta" rows="2" data-f="infra_notes" placeholder="Roads, bridges, schools, health stations…">' + esc(d.infra_notes || '') + '</textarea></div>' +
          '<div class="ug-field" style="flex:1;min-width:200px"><label class="ug-lab">Agriculture details</label><textarea class="ug-ta" rows="2" data-f="agri_notes" placeholder="Crops, livestock, fisheries…">' + esc(d.agri_notes || '') + '</textarea></div>') +
        group('Lifelines') +
        row(sel('power_status', 'Power', LIFELINE, d.power_status || 'Not assessed') + sel('water_status', 'Water', LIFELINE, d.water_status || 'Not assessed') + sel('comms_status', 'Communications', LIFELINE, d.comms_status || 'Not assessed')) +
        group('Needs') +
        '<div class="ug-rowf ug-wrap" style="gap:8px 16px">' + NEEDS.map((x) =>
          '<label class="ug-rowf" style="gap:7px;align-items:center;font-size:12px;cursor:pointer"><input type="checkbox" data-need value="' + esc(x) + '"' + ((d.needs || []).indexOf(x) !== -1 ? ' checked' : '') + '>' + esc(x) + '</label>').join('') + '</div>' +
        '<div class="ug-field" style="margin-top:10px"><label class="ug-lab">Priority needs and quantities</label><textarea class="ug-ta" rows="2" data-f="needs_notes" placeholder="e.g. 120 family food packs, 40 tarpaulins">' + esc(d.needs_notes || '') + '</textarea></div>' +
        '<div class="ug-field"><label class="ug-lab">Remarks</label><textarea class="ug-ta" rows="2" data-f="remarks">' + esc(d.remarks || '') + '</textarea></div>' +
        row(sel('status', 'Status', isLgu() ? ['Draft', 'Submitted', 'Validated'] : ['Draft', 'Submitted'], DNA_STATUS[d.status] || 'Draft') +
          '<div class="ug-field" style="flex:1;min-width:170px"><label class="ug-lab">Assessed by</label><input class="ug-in" data-f="assessed_by_name" value="' + esc(d.assessed_by_name || me().name || '') + '"></div>'),
      footer: '<button class="ug-btn" data-modal-close>Cancel</button><button class="ug-btn ug-btn--signal" data-save>' + (existing ? 'Save changes' : 'Save assessment') + '</button>',
      onMount: (wrap, close) => {
        const btn = wrap.querySelector('[data-save]');
        btn.addEventListener('click', async () => {
          const v = (k) => { const el = wrap.querySelector('[data-f="' + k + '"]'); return el ? el.value : ''; };
          const int = (k) => Math.max(0, Math.round(num(v(k))));
          const brgy = v('barangay');
          if (!brgy) { toast('Choose the barangay assessed', 'warning'); return; }
          if (!v('assessed_on')) { toast('Enter the date of the assessment', 'warning'); return; }
          if (int('affected_persons') && int('affected_families') > int('affected_persons')) { toast('Affected families cannot exceed affected persons', 'warning'); return; }
          if (int('displaced_persons') && int('displaced_families') > int('displaced_persons')) { toast('Displaced families cannot exceed displaced persons', 'warning'); return; }
          const reportId = v('report_id');
          const linked = reportId ? findIncident(reportId) : null;
          const rec = {
            id: d.id || undefined,
            barangay: brgy,
            barangay_id: isOfficial() ? (me().barangay_id || null) : barangayId(brgy),
            report_id: linked ? (linked.uuid || null) : null,
            report_code: linked ? linked.id : '',
            event_name: v('event_name').trim(), hazard_type: v('hazard_type'), assessed_on: v('assessed_on'),
            affected_families: int('affected_families'), affected_persons: int('affected_persons'),
            displaced_families: int('displaced_families'), displaced_persons: int('displaced_persons'),
            dead: int('dead'), injured: int('injured'), missing: int('missing'),
            houses_totally: int('houses_totally'), houses_partially: int('houses_partially'),
            infra_damage_php: Math.max(0, num(v('infra_damage_php'))), agri_damage_php: Math.max(0, num(v('agri_damage_php'))),
            infra_notes: v('infra_notes').trim(), agri_notes: v('agri_notes').trim(),
            power_status: v('power_status'), water_status: v('water_status'), comms_status: v('comms_status'),
            needs: Array.prototype.slice.call(wrap.querySelectorAll('[data-need]:checked')).map((c) => c.value),
            needs_notes: v('needs_notes').trim(), remarks: v('remarks').trim(),
            status: v('status').toLowerCase(), assessed_by_name: v('assessed_by_name').trim()
          };
          /* on this device a linked incident keeps its code so the link still resolves */
          if (state.dnaMode !== 'server' && linked) rec.report_id = linked.uuid || linked.id;
          btn.disabled = true;
          try {
            await saveDna(rec);
            close();
            toast(existing ? 'Assessment updated' : 'Assessment saved', 'prepared');
            rerender();
          } catch (e) { btn.disabled = false; toast(e.message || 'Could not save the assessment', 'warning'); }
        });
      }
    });
  }

  function sampleRows() {
    const b = barangayNames();
    const mk = (i, o) => Object.assign({
      id: 'DNA-S' + i, barangay: b[i % b.length], barangay_id: null, report_id: null, report_code: '', event_name: 'Sample event',
      hazard_type: UG_HAZARDS.LIST[0].label, assessed_on: iso(daysAgo(i)), affected_families: 0, affected_persons: 0, displaced_families: 0,
      displaced_persons: 0, dead: 0, injured: 0, missing: 0, houses_totally: 0, houses_partially: 0, infra_damage_php: 0, agri_damage_php: 0,
      infra_notes: '', agri_notes: '', power_status: 'Normal', water_status: 'Normal', comms_status: 'Normal', needs: [], needs_notes: '',
      remarks: 'Sample row for preview only.', status: 'draft', assessed_by_name: 'Preview', created_at: new Date().toISOString()
    }, o);
    return [
      mk(1, { affected_families: 148, affected_persons: 612, displaced_families: 61, displaced_persons: 244, injured: 3, houses_totally: 4, houses_partially: 37,
        infra_damage_php: 850000, agri_damage_php: 1240000, infra_notes: 'Barangay road shoulder washed out, 120 m.', agri_notes: '18 ha of palay submerged.',
        power_status: 'Interrupted', water_status: 'Partially interrupted', needs: ['Food packs', 'Drinking water', 'Temporary shelter / tarpaulin'], needs_notes: '150 food packs, 40 tarpaulins', status: 'submitted' }),
      mk(2, { affected_families: 72, affected_persons: 301, displaced_families: 20, displaced_persons: 84, houses_partially: 12, infra_damage_php: 210000,
        agri_damage_php: 96000, comms_status: 'Partially interrupted', needs: ['Food packs', 'Hygiene kits'], status: 'validated' }),
      mk(3, { affected_families: 35, affected_persons: 140, houses_partially: 5, agri_damage_php: 54000, needs: ['Clearing operations'], status: 'draft' })
    ];
  }

  /* ---------------------------------------------------------------- actions */
  const guard = (fn) => async (d, el) => { try { await fn(d, el); } catch (e) { toast((e && e.message) || 'Something went wrong', 'warning'); } };

  const actions = {
    'rp-tab': (d) => { state.tab = d.v; if (state.tab === 'incident' && state.incidentId) loadIncidentExtras(state.incidentId); rerender(); },
    'rp-refresh': guard(async () => { await loadRoute(); toast('Reports refreshed', 'info'); }),
    /* opened from an incident's detail page */
    'rp-open-incident': (d) => {
      state.tab = 'incident'; state.incidentId = d.id || '';
      if (app().go) app().go('reporting');
      rerender();
      loadRoute();
    },

    /* exports run through UG_EXPORT.run: busy state, no double clicks, and the
       success message only after the file was actually generated */
    'rp-sitrep-pdf': () => UG_EXPORT.run('rp-sitrep-pdf', () => exportSitrep('pdf'), { label: 'situation report PDF' }),
    'rp-sitrep-xlsx': () => UG_EXPORT.run('rp-sitrep-xlsx', () => exportSitrep('xlsx'), { label: 'situation report workbook' }),
    'rp-sitrep-save': guard(async () => {
      if (!state.eventName.trim()) { toast('Give the event a name before saving it to the register', 'warning'); return; }
      const row = await saveSitrep();
      toast('Situation Report No. ' + row.sitrep_no + ' saved to the register', 'prepared');
      rerender();
    }),

    'rp-inc-pdf': () => UG_EXPORT.run('rp-inc-pdf', () => exportIncident('pdf'), { label: 'incident summary PDF' }),
    'rp-inc-xlsx': () => UG_EXPORT.run('rp-inc-xlsx', () => exportIncident('xlsx'), { label: 'incident summary workbook' }),

    'rp-dna-add': () => dnaForm(null),
    'rp-dna-edit': (d) => { const row = (state.dna || []).find((x) => String(x.id) === String(d.id)); if (row) dnaForm(row); },
    'rp-dna-delete': guard(async (d) => {
      const row = (state.dna || []).find((x) => String(x.id) === String(d.id));
      if (!row) return;
      const ok = await UG_FEATURES.confirm({ title: 'Delete this assessment?', message: 'The assessment for Barangay ' + row.barangay + ' dated ' + (row.assessed_on || '') + ' will be removed. This cannot be undone.', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      await removeDna(row.id);
      toast('Assessment deleted', 'info');
      rerender();
    }),
    'rp-dna-status': guard(async (d) => {
      const row = (state.dna || []).find((x) => String(x.id) === String(d.id));
      if (!row) return;
      if (d.v === 'validated' && !isLgu()) { toast('Only LDRRMO staff can validate an assessment', 'warning'); return; }
      await saveDna(state.dnaMode === 'server' ? { id: row.id, status: d.v } : Object.assign({}, row, { status: d.v }));
      toast('Assessment marked ' + (DNA_STATUS[d.v] || d.v).toLowerCase(), 'prepared');
      rerender();
    }),
    'rp-dna-pdf': () => UG_EXPORT.run('rp-dna-pdf', () => exportDna('pdf'), { label: 'damage and needs PDF' }),
    'rp-dna-xlsx': () => UG_EXPORT.run('rp-dna-xlsx', () => exportDna('xlsx'), { label: 'damage and needs workbook' }),
    'rp-dna-one-pdf': (d) => UG_EXPORT.run('rp-dna-one-pdf', () => exportDna('pdf', d.id), { label: 'assessment PDF' }),
    'rp-dna-sample': () => {
      if (!UG_CONFIG.DEV) return;
      writeLocal(LOCAL_DNA, sampleRows()); state.dna = readLocal(LOCAL_DNA); rerender();
    }
  };

  /* The module's own inputs. app.js only reads [data-field]; these use [data-rp]
     so typing never triggers a full re-render and the caret stays put. */
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('input', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-rp]') : null;
      if (!el) return;
      const k = el.dataset.rp;
      if (k === 'eventName' || k === 'remarks') state[k] = el.value;
    });
    document.addEventListener('change', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-rp]') : null;
      if (!el) return;
      const k = el.dataset.rp;
      if (!(k in state)) return;
      state[k] = el.value;
      if (k === 'incidentId') loadIncidentExtras(el.value);
      rerender();
    });
  }

  return { dReporting, actions, loadRoute, state, sitrepSections, incidentSections, dnaSections, sampleRows };
})();
