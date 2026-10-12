/* UniGuard · Reports and Documentation (js/reporting.js)
 *
 * LDRRMO core module G:
 *   · Situation Report   compiled from the live data already in the console
 *                        (incidents, dispatches, evacuation centers, relief,
 *                        road status, advisories, damage assessments)
 *   · Incident Summary   one incident: details, status timeline, response
 *   · Damage and Needs Assessment   a form + register, per barangay
 *
 * Every document exports to PDF (js/pdf.js) AND Excel (js/xlsx-lite.js). This
 * is the only module with an Excel export.
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
    issued: [],
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
    const inventory = UG.DATA.inventory || [];

    const byStatus = {};
    incidents.forEach((i) => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
    const evacuees = centers.reduce((n, c) => n + num(c.occ), 0);
    const openCenters = centers.filter((c) => c.status === 'open' || c.status === 'full').length;

    const dispatchRows = [];
    incidents.forEach((i) => {
      ((UG.DATA.dispatches || {})[i.uuid] || []).forEach((d) => {
        dispatchRows.push([i.id, i.brgy, d.unit_name || d.team || '', d.status || 'dispatched', when(d.dispatched_at), when(d.eta), d.instructions || '']);
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
        head: ['Indicator', 'Value'], widths: [44, 22],
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
          ['Dead / Injured / Missing', dt.dead + ' / ' + dt.injured + ' / ' + dt.missing],
          ['Houses totally / partially damaged', dt.houses_totally + ' / ' + dt.houses_partially],
          ['Estimated infrastructure damage', php(dt.infra_damage_php)],
          ['Estimated agriculture damage', php(dt.agri_damage_php)],
          ['Roads not passable', roads.length],
          ['Advisories issued', advisories.length]
        ] },
      { key: 'incidents', name: 'II. Incidents monitored', note: 'Every report filed in the period, newest first.',
        head: ['Code', 'Reported', 'Barangay', 'Hazard', 'Severity', 'Status', 'Details'], widths: [16, 20, 20, 24, 12, 20, 60],
        rows: incidents.map((i) => [i.id, when(i.created_at) || i.time || '', i.brgy, i.hazard, sevLabel(i.sev), statusLabel(i.status), i.desc || '']) },
      { key: 'matrix', name: 'III. Incidents by barangay', note: 'Count of reports per barangay and where each sits in the status pipeline.',
        head: ['Barangay', 'Reported', 'Verified', 'Dispatched', 'Resolved', 'Rejected', 'Total'], widths: [24, 12, 12, 12, 12, 12, 10],
        rows: matrixRows },
      { key: 'damage', name: 'IV. Affected population and damage', note: 'From the Damage and Needs Assessments dated within the period.',
        head: ['Barangay', 'Families', 'Persons', 'Displaced fam.', 'Displaced pers.', 'Dead', 'Injured', 'Missing', 'Houses total', 'Houses partial', 'Infrastructure (PHP)', 'Agriculture (PHP)', 'Status'],
        widths: [22, 10, 10, 13, 13, 8, 9, 9, 12, 13, 20, 20, 12],
        rows: dna.map((d) => [d.barangay, num(d.affected_families), num(d.affected_persons), num(d.displaced_families), num(d.displaced_persons),
          num(d.dead), num(d.injured), num(d.missing), num(d.houses_totally), num(d.houses_partially), num(d.infra_damage_php), num(d.agri_damage_php), DNA_STATUS[d.status] || d.status || '']),
        total: dna.length ? ['TOTAL', dt.affected_families, dt.affected_persons, dt.displaced_families, dt.displaced_persons, dt.dead, dt.injured, dt.missing,
          dt.houses_totally, dt.houses_partially, dt.infra_damage_php, dt.agri_damage_php, ''] : null },
      { key: 'centers', name: 'V. Evacuation centers', note: 'Status and occupancy at the time this report was generated.',
        head: ['Center', 'Barangay', 'Status', 'Occupancy', 'Capacity', 'Used %', 'Contact'], widths: [34, 20, 12, 12, 12, 10, 28],
        rows: centers.map((c) => [c.name, c.brgy, c.status, num(c.occ), num(c.cap), c.cap ? Math.round(num(c.occ) / num(c.cap) * 100) : 0,
          [c.contact_person, c.contact_phone].filter(Boolean).join(' · ')]) },
      { key: 'response', name: 'VI. Response actions', note: 'Teams and units dispatched to the incidents listed above.',
        head: ['Incident', 'Barangay', 'Team / unit', 'Status', 'Dispatched', 'ETA', 'Instructions'], widths: [16, 20, 26, 14, 20, 20, 50],
        rows: dispatchRows },
      { key: 'relief', name: 'VII. Relief operations', note: 'Scheduled distributions in the period and the distribution log.',
        head: ['Type', 'Barangay', 'Item / activity', 'Quantity', 'When', 'Details'], widths: [16, 20, 34, 12, 20, 44],
        rows: relief.map((r) => ['Scheduled', r.barangay, r.title, '', when(r.distribution_at), r.location_name || ''])
          .concat(distLog.map((r) => ['Distributed', r.barangay || '', r.item_name || r.item || '', num(r.qty || r.quantity), when(r.distributed_at || r.date || r.created_at), r.family || r.recipient || r.note || ''])) },
      { key: 'stock', name: 'VIII. Relief stock on hand', note: 'Current inventory; items at or below their reorder point are flagged.',
        head: ['Item', 'Category', 'Stock', 'Unit', 'Reorder at', 'Flag', 'Location'], widths: [30, 18, 10, 12, 12, 12, 28],
        rows: inventory.map((i) => [i.name, i.category || '', num(i.stock), i.unit || '', num(i.reorder), num(i.stock) <= num(i.reorder) ? 'LOW STOCK' : '', i.location || '']) },
      { key: 'roads', name: 'IX. Roads not passable', note: 'Road sections reported closed or with limited access.',
        head: ['Road', 'Barangay', 'Status', 'Cause', 'Since', 'Expected reopening'], widths: [30, 20, 16, 30, 20, 20],
        rows: roads.map((r) => [r.road_name, r.barangay, r.status, r.cause || r.note || '', when(r.started_at), when(r.estimated_reopen)]) },
      { key: 'advisories', name: 'X. Advisories issued', note: 'Official broadcasts published in the period.',
        head: ['Published', 'Alert level', 'Type', 'Title', 'Area'], widths: [20, 14, 18, 50, 28],
        rows: advisories.map((a) => [when(a.created_at), sevLabel(a.severity), a.alert_type || a.type || '', a.title, a.citywide ? UG_GEO.PLACE.areaAll : a.area]) },
      { key: 'needs', name: 'XI. Priority needs', note: 'Needs flagged in the damage assessments, by number of barangay assessments requesting them.',
        head: ['Need', 'Assessments requesting'], widths: [40, 24],
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
  function toPdf(opts, sections) {
    UG_PDF.exportDoc(Object.assign({ flow: true, generatedBy: signer(), scope: scopeLabel() }, opts, {
      tables: sections.map((s) => ({
        name: s.name, note: s.note, head: s.head,
        rows: (s.rows.length ? s.rows.map((r) => r.map((c) => (typeof c === 'number' ? c.toLocaleString('en-PH') : c))) : [['Nothing to report'].concat(s.head.slice(1).map(() => ''))])
          .concat(s.total ? [s.total.map((c) => (typeof c === 'number' ? c.toLocaleString('en-PH') : c))] : [])
      }))
    }));
  }

  function toXlsx(filename, title, metaLines, sections) {
    const cover = [[{ v: title, s: 'title' }], [{ v: 'UniGuard · ' + UG_GEO.PLACE.office + ' · ' + UG_GEO.PLACE.label, s: 'muted' }], []];
    metaLines.forEach((m) => cover.push([{ v: m[0], s: 'bold' }, m[1]]));
    cover.push([]);
    cover.push([{ v: 'Sheets in this workbook', s: 'bold' }]);
    sections.forEach((s) => cover.push([s.name, s.rows.length + ' row' + (s.rows.length === 1 ? '' : 's')]));
    const sheets = [{ name: 'Cover', cols: [34, 60], rows: cover }];
    sections.forEach((s) => {
      const rows = [[{ v: s.name, s: 'title' }], [{ v: s.note || '', s: 'muted' }], [],
        s.head.map((h) => ({ v: h, s: 'head' }))];
      (s.rows.length ? s.rows : [['Nothing to report']]).forEach((r) => rows.push(r.map((c) => ({ v: c, s: (typeof c === 'string' && c.length > 40) ? 'wrap' : 'cell' }))));
      if (s.total) rows.push(s.total.map((c) => ({ v: c, s: 'total' })));
      sheets.push({ name: s.name.replace(/^[IVX]+\.\s*/, ''), cols: s.widths, rows: rows });
    });
    UG_XLSX.download(filename, { sheets: sheets });
  }

  const stamp = () => iso(today());
  const periodText = () => (state.from || 'start') + ' to ' + (state.to || 'today');

  function exportSitrep(kind) {
    const built = sitrepSections();
    const title = sitrepTitle();
    const sections = built.sections;
    if (state.remarks.trim()) sections.push({ key: 'remarks', name: 'XII. Remarks and actions taken', note: '', head: ['Remarks'], widths: [110], rows: [[state.remarks.trim()]] });
    if (kind === 'pdf') {
      toPdf({ title: title, subtitle: 'Compiled from the UniGuard operations record.', kind: 'Situation Report',
        landscape: true, meta: 'Reporting period: ' + periodText(), filename: 'uniguard-sitrep-' + stamp() + '.pdf',
        signoff: [{ label: 'Prepared by', name: me().name || '', title: me().title || '' }, { label: 'Noted by', name: '', title: 'LDRRMO Head' }] }, sections);
    } else {
      toXlsx('uniguard-sitrep-' + stamp() + '.xlsx', title,
        [['Reporting period', periodText()], ['Scope', scopeLabel()], ['Generated', new Date().toLocaleString()], ['Prepared by', signer()]], sections);
    }
    return built;
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
    return row;
  }

  /* ----------------------------------------------------- incident summary */
  function incidentSections(inc) {
    const hist = state.history[inc.uuid] || [];
    const disp = (UG.DATA.dispatches || {})[inc.uuid] || [];
    const dna = (state.dna || []).filter((d) => d.report_id && (d.report_id === inc.uuid || d.report_id === inc.id));
    const timeline = [[when(inc.created_at) || inc.time || '', 'Reported', inc.mine ? 'Filed by you' : 'Filed by a resident']]
      .concat(hist.map((h) => [when(h.created_at), statusLabel(h.from_status) + ' → ' + statusLabel(h.to_status), h.reason || '']));
    return [
      { key: 'details', name: 'Incident details', note: 'The report as filed and its current status.', head: ['Field', 'Value'], widths: [28, 80],
        rows: [
          ['Incident code', inc.id], ['Hazard', inc.hazard], ['Severity', sevLabel(inc.sev)], ['Current status', statusLabel(inc.status)],
          ['Barangay', inc.brgy], ['Location', inc.area || ''], ['Location note', inc.location_note || ''],
          ['Coordinates', (typeof inc.lat === 'number' && typeof inc.lng === 'number') ? inc.lat.toFixed(6) + ', ' + inc.lng.toFixed(6) : 'Not recorded'],
          ['Reported', when(inc.created_at) || inc.time || ''],
          ['Corroborations', num(inc.corr)],
          ['Verified by', inc.verified_by_name ? inc.verified_by_name + (inc.verified_at ? ' · ' + when(inc.verified_at) : '') : 'Not yet verified'],
          ['Photo attached', inc.remote_photo ? 'Yes' : 'No'],
          ['Description', inc.desc || '']
        ] },
      { key: 'timeline', name: 'Status timeline', note: 'Each move through the status pipeline, oldest first.', head: ['When', 'Change', 'Note'], widths: [24, 36, 60], rows: timeline },
      { key: 'response', name: 'Response dispatched', note: 'Teams and units sent to this incident.', head: ['Team / unit', 'Status', 'Dispatched', 'ETA', 'By', 'Instructions'], widths: [26, 14, 22, 22, 22, 50],
        rows: disp.map((d) => [d.unit_name || d.team || '', d.status || 'dispatched', when(d.dispatched_at), when(d.eta), d.dispatched_by_name || '', d.instructions || '']) },
      { key: 'dna', name: 'Damage and needs', note: 'Assessments linked to this incident.', head: ['Assessed', 'Families', 'Persons', 'Dead', 'Injured', 'Missing', 'Houses total', 'Houses partial', 'Needs'], widths: [16, 10, 10, 8, 9, 9, 12, 13, 50],
        rows: dna.map((d) => [d.assessed_on || '', num(d.affected_families), num(d.affected_persons), num(d.dead), num(d.injured), num(d.missing), num(d.houses_totally), num(d.houses_partially), (d.needs || []).join(', ')]) }
    ];
  }

  function exportIncident(kind) {
    const inc = findIncident(state.incidentId);
    if (!inc) { toast('Choose an incident first', 'info'); return; }
    const sections = incidentSections(inc);
    const title = 'Incident Summary · ' + inc.id;
    const file = 'uniguard-incident-' + String(inc.id).replace(/[^A-Za-z0-9-]+/g, '-');
    if (kind === 'pdf') {
      toPdf({ title: title, subtitle: inc.hazard + ' · Barangay ' + inc.brgy, kind: 'Incident Summary',
        scope: 'Barangay ' + inc.brgy, filename: file + '.pdf',
        signoff: [{ label: 'Prepared by', name: me().name || '', title: me().title || '' }] }, sections);
    } else {
      toXlsx(file + '.xlsx', title, [['Hazard', inc.hazard], ['Barangay', inc.brgy], ['Status', statusLabel(inc.status)],
        ['Generated', new Date().toLocaleString()], ['Prepared by', signer()]], sections);
    }
  }

  /* -------------------------------------------- damage assessment exports */
  function dnaVisible() {
    return (state.dna || []).filter((d) => isOfficial() ? true : (state.dnaBrgy === 'All' || d.barangay === state.dnaBrgy));
  }

  function dnaSections(rows) {
    const t = dnaTotals(rows);
    return [
      { key: 'register', name: 'Damage and needs register', note: 'One row per barangay assessment.',
        head: ['Assessed', 'Barangay', 'Event / hazard', 'Families', 'Persons', 'Displaced fam.', 'Displaced pers.', 'Dead', 'Injured', 'Missing', 'Houses total', 'Houses partial', 'Infrastructure (PHP)', 'Agriculture (PHP)', 'Status'],
        widths: [14, 20, 26, 10, 10, 13, 13, 8, 9, 9, 12, 13, 20, 20, 12],
        rows: rows.map((d) => [d.assessed_on || '', d.barangay, [d.event_name, d.hazard_type].filter(Boolean).join(' · '), num(d.affected_families), num(d.affected_persons),
          num(d.displaced_families), num(d.displaced_persons), num(d.dead), num(d.injured), num(d.missing), num(d.houses_totally), num(d.houses_partially),
          num(d.infra_damage_php), num(d.agri_damage_php), DNA_STATUS[d.status] || d.status || '']),
        total: rows.length ? ['TOTAL', '', '', t.affected_families, t.affected_persons, t.displaced_families, t.displaced_persons, t.dead, t.injured, t.missing,
          t.houses_totally, t.houses_partially, t.infra_damage_php, t.agri_damage_php, ''] : null },
      { key: 'lifelines', name: 'Lifelines and needs', note: 'Utility status and the needs each barangay flagged.',
        head: ['Barangay', 'Assessed', 'Power', 'Water', 'Communications', 'Needs', 'Priority notes', 'Assessed by'], widths: [20, 14, 20, 20, 20, 44, 44, 24],
        rows: rows.map((d) => [d.barangay, d.assessed_on || '', d.power_status || '', d.water_status || '', d.comms_status || '', (d.needs || []).join(', '), d.needs_notes || '', d.assessed_by_name || '']) },
      { key: 'notes', name: 'Damage descriptions', note: 'Narrative detail behind the cost estimates.',
        head: ['Barangay', 'Infrastructure', 'Agriculture', 'Remarks'], widths: [20, 50, 50, 50],
        rows: rows.map((d) => [d.barangay, d.infra_notes || '', d.agri_notes || '', d.remarks || '']) }
    ];
  }

  function exportDna(kind, onlyId) {
    const rows = onlyId ? (state.dna || []).filter((d) => d.id === onlyId) : dnaVisible();
    if (!rows.length) { toast('No assessments to export', 'info'); return; }
    const one = onlyId ? rows[0] : null;
    const title = one ? 'Damage and Needs Assessment · Barangay ' + one.barangay : 'Damage and Needs Assessment';
    const scope = one ? 'Barangay ' + one.barangay : (isOfficial() ? 'Barangay ' + (me().barangay || '') : (state.dnaBrgy === 'All' ? UG_GEO.PLACE.scope : 'Barangay ' + state.dnaBrgy));
    const file = 'uniguard-damage-needs-' + stamp();
    const sections = dnaSections(rows);
    if (kind === 'pdf') {
      toPdf({ title: title, subtitle: 'Rapid damage and needs assessment record.', kind: 'Damage & Needs', landscape: true, scope: scope,
        filename: file + '.pdf', signoff: [{ label: 'Prepared by', name: me().name || '', title: me().title || '' }, { label: 'Validated by', name: '', title: 'LDRRMO' }] }, sections);
    } else {
      toXlsx(file + '.xlsx', title, [['Scope', scope], ['Assessments', rows.length], ['Generated', new Date().toLocaleString()], ['Prepared by', signer()]], sections);
    }
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
    const cell = (c) => '<td' + (typeof c === 'number' ? ' class="t-num"' : '') + ' style="max-width:320px">' + esc(typeof c === 'number' ? fmt(c) : c) + '</td>';
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

    'rp-sitrep-pdf': guard(() => { exportSitrep('pdf'); toast('Situation report exported as PDF', 'info'); }),
    'rp-sitrep-xlsx': guard(() => { exportSitrep('xlsx'); toast('Situation report exported as Excel', 'info'); }),
    'rp-sitrep-save': guard(async () => {
      if (!state.eventName.trim()) { toast('Give the event a name before saving it to the register', 'warning'); return; }
      const row = await saveSitrep();
      toast('Situation Report No. ' + row.sitrep_no + ' saved to the register', 'prepared');
      rerender();
    }),

    'rp-inc-pdf': guard(() => { exportIncident('pdf'); }),
    'rp-inc-xlsx': guard(() => { exportIncident('xlsx'); }),

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
    'rp-dna-pdf': guard(() => { exportDna('pdf'); }),
    'rp-dna-xlsx': guard(() => { exportDna('xlsx'); }),
    'rp-dna-one-pdf': guard((d) => { exportDna('pdf', (state.dna || []).filter((x) => String(x.id) === String(d.id)).map((x) => x.id)[0]); }),
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
