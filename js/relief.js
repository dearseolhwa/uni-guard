/* UniGuard · Relief Assistance Information
 *
 * Citizen UI + LGU management surface for the relief_distributions and
 * authorized_beneficiaries tables (migrations/011).
 *
 * Module E of the LDRRMO core covers THREE things, all surfaced here as tabs:
 *   1. Relief distributions — per-barangay schedules, eligibility, required docs
 *      and the authorized-beneficiary list (the original surface).
 *   2. Resource inventory — stock of food packs, water, medicine, boats and
 *      equipment, with low-stock alerts so the LDRRMO can pre-position before
 *      a typhoon makes resupply impossible.
 *   3. Distribution records — every pack actually handed out, per barangay and
 *      per family, so the LDRRMO can reconcile stock against need.
 *
 * Render functions are HTML-string-returning (same pattern as UG_SCREENS),
 * and every action goes through the existing `data-act` delegate in app.js.
 */
const UG_RELIEF = (function () {
  const esc = UG_UTIL.esc, I = UG.icon, U = UG;
  const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');
    /* only LGU staff and barangay officials may see the authorized-beneficiary list */
  const isStaff = (st) => !!(st && st.session &&
    (st.session.role === 'barangay_official' || st.session.role === 'lgu_ldrrmc'));

  /* --------------------------------------------------- resource inventory seed
     Stock the LDRRMO pre-positions at the municipal warehouse. `reorder` is the
     threshold below which the low-stock alert fires; once stock drops to or
     below it the row turns amber on the inventory tab. Categories mirror the
     relief catalogue used at a distribution point. */
  const DEFAULT_INVENTORY = [
    { id: 'INV-01', name: 'Family Food Pack',        category: 'Food',     unit: 'packs',    stock: 420,  reorder: 200, location: 'LDRRMO Warehouse A', supplier: 'DSWD Field Office' },
    { id: 'INV-02', name: 'Bottled Water (5L)',       category: 'Water',    unit: 'bottles',  stock: 180,  reorder: 250, location: 'LDRRMO Warehouse A', supplier: 'Lingayen Water District' },
    { id: 'INV-03', name: 'Rice (25kg sack)',         category: 'Food',     unit: 'sacks',    stock: 64,   reorder: 40,  location: 'LDRRMO Warehouse B', supplier: 'NFA Pangasinan' },
    { id: 'INV-04', name: 'Canned Goods',             category: 'Food',     unit: 'cans',     stock: 1280, reorder: 500, location: 'LDRRMO Warehouse A', supplier: 'Red Cross Pangasinan' },
    { id: 'INV-05', name: 'First Aid Kit',            category: 'Medical',  unit: 'kits',     stock: 48,   reorder: 60,  location: 'LDRRMO Warehouse C', supplier: 'Provincial Health Office' },
    { id: 'INV-06', name: 'Paracetamol / Biogesic',   category: 'Medical',  unit: 'boxes',    stock: 90,   reorder: 100, location: 'LDRRMO Warehouse C', supplier: 'Botika ng Bayan' },
    { id: 'INV-07', name: 'Banca / Boat',             category: 'Equipment',unit: 'units',    stock: 6,    reorder: 4,   location: 'Coastal Depot',        supplier: 'PCG Lingayen' },
    { id: 'INV-08', name: 'Life Jacket',              category: 'Equipment',unit: 'pieces',   stock: 38,   reorder: 30,  location: 'Coastal Depot',        supplier: 'PCG Lingayen' },
    { id: 'INV-09', name: 'Portable Radio (VHF)',     category: 'Equipment',unit: 'units',    stock: 12,   reorder: 8,   location: 'LDRRMO Warehouse C', supplier: 'OCD Region I' },
    { id: 'INV-10', name: 'Tarpaulin / Trapal',       category: 'Shelter Supplies', unit: 'pieces',   stock: 75,   reorder: 50,  location: 'LDRRMO Warehouse B', supplier: 'DSWD Field Office' },
    { id: 'INV-11', name: 'Sleeping Mat',             category: 'Shelter Supplies', unit: 'pieces',   stock: 140,  reorder: 120, location: 'LDRRMO Warehouse B', supplier: 'DSWD Field Office' },
    { id: 'INV-12', name: 'Hygiene Kit',              category: 'Hygiene',  unit: 'kits',     stock: 95,   reorder: 80,  location: 'LDRRMO Warehouse A', supplier: 'Red Cross Pangasinan' },
    { id: 'INV-13', name: 'Family Tent (4-person)',   category: 'Shelter Supplies', unit: 'units',    stock: 22,   reorder: 25,  location: 'LDRRMO Warehouse B', supplier: 'DSWD Field Office' },
    { id: 'INV-14', name: 'Blanket',                  category: 'Shelter Supplies', unit: 'pieces',   stock: 200,  reorder: 150, location: 'LDRRMO Warehouse B', supplier: 'Red Cross Pangasinan' },
    { id: 'INV-15', name: 'Mosquito Net',             category: 'Shelter Supplies', unit: 'pieces',   stock: 60,   reorder: 75,  location: 'LDRRMO Warehouse B', supplier: 'Provincial Health Office' },
    { id: 'INV-16', name: 'Water Container (20L)',    category: 'Hygiene',  unit: 'containers', stock: 40,  reorder: 50,  location: 'LDRRMO Warehouse A', supplier: 'Lingayen Water District' },
    { id: 'INV-17', name: 'Soap / Detergent Pack',    category: 'Hygiene',  unit: 'packs',   stock: 110,  reorder: 90,  location: 'LDRRMO Warehouse A', supplier: 'Red Cross Pangasinan' },
    { id: 'INV-18', name: 'Sanitary Napkin Pack',     category: 'Hygiene',  unit: 'packs',   stock: 70,   reorder: 80,  location: 'LDRRMO Warehouse A', supplier: 'Provincial Health Office' }
  ];

  /* ----------------------------------------------------- distribution records
     Each row is one handover at a distribution point: which item, how many, to
     which barangay and family, by whom, on what date. The records reconcile the
     inventory (stock decreases) against the relief_distributions schedule. */
  const DEFAULT_DISTRIBUTIONS_LOG = [
    { id: 'DR-01', item_id: 'INV-01', item_name: 'Family Food Pack', qty: 50, barangay: 'Pangapisan North', family: 'Aquino household', distributed_by: 'LDRRMO Relief Desk', distributed_at: new Date(Date.now() - 1 * 86400000).toISOString() },
    { id: 'DR-02', item_id: 'INV-02', item_name: 'Bottled Water (5L)', qty: 40, barangay: 'Pangapisan North', family: 'Aquino household', distributed_by: 'LDRRMO Relief Desk', distributed_at: new Date(Date.now() - 1 * 86400000).toISOString() },
    { id: 'DR-03', item_id: 'INV-01', item_name: 'Family Food Pack', qty: 30, barangay: 'Poblacion', family: 'Soriano household', distributed_by: 'Brgy. Captain Office', distributed_at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'DR-04', item_id: 'INV-05', item_name: 'First Aid Kit', qty: 5, barangay: 'Poblacion', family: 'Fernandez household', distributed_by: 'Brgy. Captain Office', distributed_at: new Date(Date.now() - 2 * 86400000).toISOString() }
  ];

  function ensureInventory() {
    if (!UG.DATA.inventory) UG.DATA.inventory = JSON.parse(JSON.stringify(DEFAULT_INVENTORY));
    if (!UG.DATA.distributionLog) UG.DATA.distributionLog = JSON.parse(JSON.stringify(DEFAULT_DISTRIBUTIONS_LOG));
  }
  ensureInventory();

  /* low-stock = stock <= reorder. Pre-computed so the dashboard and the alert
     banner can both read the same source without re-filtering everywhere. */
  function lowStockItems() {
    return (UG.DATA.inventory || []).filter((i) => (i.stock || 0) <= (i.reorder || 0));
  }
  /* Categories reflect the actual purpose of each item:
     - Shelter Supplies: temporary shelter and sleeping items (tents, tarpaulins, mats, blankets)
     - Hygiene: personal sanitation and hygiene items (kits, soap, sanitary products, water containers)
       These were previously both lumped under "Shelter", which made the inventory table confusing.
       The migration 044_super_admin_improvements.sql reclassifies existing rows in the database to match. */
  const INV_CATEGORIES = ['Food', 'Water', 'Medical', 'Equipment', 'Shelter Supplies', 'Hygiene'];
  const CAT_COLOR = {
    Food: 'var(--ug-prepared)', Water: 'var(--ug-signal)', Medical: 'var(--ug-emergency)',
    Equipment: 'var(--ug-advisory)', 'Shelter Supplies': 'var(--ug-warning)',
    Hygiene: 'var(--ug-st-dispatched)'
  };

  /* --------------------------------------------------------------- the data */
  /* seeded defaults so the UI renders even without a Supabase project. Once
     Repo.loadAll runs, the live rows overwrite these in UG.DATA.relief. */
  if (!UG.DATA.relief) {
    UG.DATA.relief = [
      {
        id: 'RD-01', barangay: 'Poblacion', title: 'Family Food Pack Distribution',
        location_name: 'Provincial Capitol Grounds', address: 'Aguila Rd, Lingayen, Pangasinan',
        lat: 16.033513, lng: 120.231519,
        distribution_at: new Date(Date.now() + 2 * 86400000).toISOString(),
        contact_person: 'LDRRMO Relief Desk', contact_phone: '(075) 632-2222',
        eligibility: ['Affected household', 'Senior citizen', 'Person with disability (PWD)'],
        required_docs: ['Valid government ID', 'Barangay certificate of indigency',
          'Authorization letter if claiming on behalf of a beneficiary'],
        note: 'Distribution starts 8:00 AM. Bring your own bag.',
        active: true
      },
      {
        id: 'RD-02', barangay: 'Pangapisan North', title: 'Coastal Relief Distribution',
        location_name: 'Pangapisan North Multi-Purpose Center', address: 'Pangapisan North, Lingayen',
        lat: 16.0330, lng: 120.2080,
        distribution_at: new Date(Date.now() + 3 * 86400000).toISOString(),
        contact_person: 'Brgy. Captain Office', contact_phone: '0917-408-2210',
        eligibility: ['Coastal household affected by storm surge', 'Evacuated family from shelter'],
        required_docs: ['Valid ID', 'Proof of residence'],
        note: 'Priority for households within 200m of the shoreline.',
        active: true
      }
    ];
  }
  if (!UG.DATA.beneficiaries) {
    UG.DATA.beneficiaries = [
      { id: 'B-01', barangay: 'Poblacion', beneficiary_name: 'Aquino, Marites', claimant_name: 'Aquino, Marites', claimant_id: 'ID-2026-001234', category: 'Affected household' },
      { id: 'B-02', barangay: 'Poblacion', beneficiary_name: 'Soriano, Reynaldo', claimant_name: 'Soriano, Reynaldo', claimant_id: 'ID-2026-001235', category: 'Senior citizen' },
      { id: 'B-03', barangay: 'Poblacion', beneficiary_name: 'Fernandez, Andrea', claimant_name: 'Villanueva, Joel', claimant_id: 'ID-2026-001236', category: 'PWD (authorized rep)' },
      { id: 'B-04', barangay: 'Pangapisan North', beneficiary_name: 'Bautista, Liza', claimant_name: 'Bautista, Liza', claimant_id: 'ID-2026-001237', category: 'Coastal household' }
    ];
  }

  /* ------------------------------------------------------------- formatting */
  function fmtDate(iso) {
    if (!iso) return 'To be announced';
    const t = Date.parse(iso);
    if (isNaN(t)) return 'To be announced';
    return new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const t = Date.parse(iso);
    if (isNaN(t)) return '—';
    return new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /* ------------------------------------------------------------- mobile UI */
  function mRelief(st) {
        const isCitizen = !st.session || st.session.role === 'citizen';
    const barangays = isCitizen ? [] : ['All'].concat(U.DATA.barangays);
    const f = st.reliefFilter || 'All';
    const list = U.DATA.relief.filter((r) => r.active !== false).filter((r) => f === 'All' || r.barangay === f);
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Relief Assistance Information</div>' +
      '<h2 style="font-size:18px;margin-top:3px">Relief Distribution</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Per-barangay relief schedules, eligibility, required documents, and the authorized-beneficiary list. Filter by your barangay.</p></div>' +

            (barangays.length ? '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + barangays.map((b) =>
        '<button class="ug-chip' + (f === b ? ' is-on' : '') + '"' + A('relief-filter', attr({ v: b })) + '>' + esc(b) + '</button>').join('') + '</div>' : '') +

      (list.length ? list.map((r) => reliefCard(r, isStaff(st))).join(''):
        '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('info', 20) + '</span>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No Active Distribution for ' + esc(f) + '</div>' +
        '<div class="ug-dim" style="font-size:11px">Check another barangay or contact your barangay desk.</div></div></div>') +

      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-signal);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-note">If you are claiming on behalf of a named beneficiary, bring a valid ID and an authorization letter. The distribution desk checks representatives against the LGU authorized list.</div>' +
    '</div></div></div>';
  }

    function reliefCard(r, canVerify) {
    const geoState = UG_GEO.classify(r.lat, r.lng);
    const elig = (r.eligibility || []).map((e) => '<li>' + esc(e) + '</li>').join('');
    const docs = (r.required_docs || []).map((d) => '<li>' + esc(d) + '</li>').join('');
    return '<div class="ug-card">' +
      '<div class="ug-card-h"><h3>' + esc(r.title) + '</h3>' + U.badge('id', r.barangay) + '</div>' +
      '<div class="ug-card-b ug-col" style="gap:11px">' +
        '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
          '<span style="color:var(--ug-signal);display:flex">' + I('pin', 16) + '</span>' +
          '<div style="min-width:0"><div style="font-size:13px;font-weight:600">' + esc(r.location_name) + '</div>' +
          '<div class="ug-dim" style="font-size:12px;line-height:1.5">' + esc(r.address) + '</div></div></div>' +
        '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
          '<span style="color:var(--ug-prepared);display:flex">' + I('clock', 16) + '</span>' +
          '<div style="min-width:0"><div style="font-size:12px;font-weight:600">' + esc(fmtDate(r.distribution_at)) + '</div>' +
          '<div class="ug-dimmer" style="font-size:11px">Distribution schedule</div></div></div>' +
        '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
          '<span style="color:var(--ug-advisory);display:flex">' + I('phone', 16) + '</span>' +
          '<div style="min-width:0"><div style="font-size:12px;font-weight:600">' + esc(r.contact_person) + '</div>' +
          '<div class="ug-mono" style="font-size:12px;color:var(--ug-signal)">' + esc(r.contact_phone) + '</div></div></div>' +
        (elig ? '<div class="ug-field" style="margin:0"><div class="ug-lab">Eligibility</div><ul class="ug-bullets">' + elig + '</ul></div>' : '') +
        (docs ? '<div class="ug-field" style="margin:0"><div class="ug-lab">Bring these documents</div><ul class="ug-bullets">' + docs + '</ul></div>' : '') +
        (r.note ? '<div class="ug-note">' + esc(r.note) + '</div>' : '') +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          (canVerify
            ? '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('relief-verify', attr({ id: r.id })) + '>' + I('users', 14) + 'Verify Beneficiary</button>'
            : '') +
          (geoState === 'ok'
            ? '<a class="ug-waze-btn" style="flex:1" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(r.lat, r.lng) + '">' + I('route', 13) + 'Navigate</a>'
            : '<div class="ug-help" style="flex:1">No coordinates on file for this distribution.</div>') +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('call', attr({ num: r.contact_phone, agency: r.contact_person })) + '>' + I('phone', 14) + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------- mobile verify */
  function mReliefVerify(st) {
    const r = (UG.DATA.relief || []).find((x) => x.id === st.openId) || U.DATA.relief[0];
    const list = (UG.DATA.beneficiaries || []).filter((b) => b.barangay === r.barangay);
    return '<div class="ug-col" style="gap:14px">' +
      '<button class="ug-btn ug-btn--ghost ug-btn--sm" style="align-self:flex-start"' + A('nav', attr({ route: 'relief' })) + '>' +
        '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 14) + '</span>Back to Relief</button>' +
      '<div><div class="ug-lab">Authorized Beneficiary List</div>' +
      '<h2 style="font-size:16px;margin-top:3px">' + esc(r.title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px;line-height:1.5">Search by beneficiary name, claimant name, or claimant ID. Used by staff on the spot to confirm an authorized claimant.</p></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Search</h3></div>' +
        '<div class="ug-card-b"><input class="ug-in" data-field="benSearch" placeholder="Name or ID number" value="' + esc(st.benSearch || '') + '">' +
        '<div class="ug-help">Live filter — start typing a name or claimant ID.</div></div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>' + (list.length + ' Records') + '</h3>' + U.badge('id', r.barangay) + '</div>' +
        '<div class="ug-rows">' + (list.length ? list.map((b) => beneficiaryRow(b, st.benSearch)).join('') :
          '<div class="ug-empty"><span class="e-ico">' + I('users', 20) + '</span>' +
          '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No Authorized Records for ' + esc(r.barangay) + '</div>' +
          '<div class="ug-dim" style="font-size:11px">The LGU has not uploaded any authorized beneficiaries for this barangay.</div></div>') + '</div></div>' +
    '</div>';
  }

  function beneficiaryRow(b, query) {
    const q = (query || '').toLowerCase().trim();
    if (q && !((b.beneficiary_name || '').toLowerCase().indexOf(q) >= 0 ||
               (b.claimant_name || '').toLowerCase().indexOf(q) >= 0 ||
               (b.claimant_id || '').toLowerCase().indexOf(q) >= 0 ||
               (b.category || '').toLowerCase().indexOf(q) >= 0)) return '';
    const authorized = b.claimant_name === b.beneficiary_name;
    return '<div class="ug-row">' +
      '<span class="r-dot" style="background:' + (authorized ? 'var(--ug-prepared)' : 'var(--ug-advisory)') + '"></span>' +
      '<div class="r-main">' +
        '<div class="r-t">' + esc(b.beneficiary_name) + '</div>' +
        '<div class="r-m"><span>' + I('users', 12) + 'Claimant: ' + esc(b.claimant_name) + '</span>' +
        '<span class="ug-mono">' + esc(b.claimant_id) + '</span>' +
        '<span>' + esc(b.category || 'Beneficiary') + '</span></div>' +
      '</div>' +
      U.badge(authorized ? 'open' : 'id', authorized ? 'Self' : 'Rep') + '</div>';
  }
    /* officials only manage their own barangay; LGU sees everything */
  function scopedBrgy(st) {
    const s = st.session;
    return s && s.role === 'barangay_official' ? (s.barangay || '__none__') : null;
  }


  /* ---------------------------------------------- visible rows (screen = export)
     The relief screens and their exports (js/exports.js) read the same rows
     through these, so a downloaded file always matches what is on screen. */
  function visibleSchedules(st) {
    const mine = scopedBrgy(st);
    return (U.DATA.relief || []).filter((r) => !mine || r.barangay === mine);
  }
  function visibleBeneficiaries(st) {
    const mine = scopedBrgy(st);
    const benFilter = mine || st.benBarangayFilter;
    const q = (st.benSearchLgu || '').toLowerCase().trim();
    return (UG.DATA.beneficiaries || [])
      .filter((b) => !mine || b.barangay === mine)
      .filter((b) => (!benFilter || benFilter === 'All' || b.barangay === benFilter))
      .filter((b) => !q ||
        (b.beneficiary_name || '').toLowerCase().indexOf(q) >= 0 ||
        (b.claimant_name || '').toLowerCase().indexOf(q) >= 0 ||
        (b.claimant_id || '').toLowerCase().indexOf(q) >= 0);
  }
  function visibleInventory(st) {
    ensureInventory();
    const mine = scopedBrgy(st);
    const all = (UG.DATA.inventory || []).filter((i) => !mine || (i.barangay || 'LDRRMO Warehouse') === mine || !i.barangay);
    const cat = st.invCatFilter || 'all';
    const q = (st.invSearch || '').trim().toLowerCase();
    const brgyFilter = mine ? mine : (st.invBrgyFilter || 'All');
    const list = all.filter((i) => cat === 'all' || i.category === cat)
      .filter((i) => !q ||
        (i.name || '').toLowerCase().indexOf(q) >= 0 ||
        (i.id || '').toLowerCase().indexOf(q) >= 0 ||
        (i.location || '').toLowerCase().indexOf(q) >= 0 ||
        (i.supplier || '').toLowerCase().indexOf(q) >= 0)
      .filter((i) => mine || brgyFilter === 'All' || (i.barangay || '') === brgyFilter);
    return { all: all, list: list, cat: cat, q: q, brgyFilter: brgyFilter, mine: mine };
  }
  function visibleRecords(st) {
    ensureInventory();
    const mine = scopedBrgy(st);
    const all = (UG.DATA.distributionLog || []).slice().sort((a, b) =>
      (Date.parse(b.distributed_at) || 0) - (Date.parse(a.distributed_at) || 0));
    const rows = all.filter((r) => !mine || r.barangay === mine);
    const brgyFilter = st.recBrgyFilter || 'All';
    return { rows: rows, filtered: rows.filter((r) => brgyFilter === 'All' || r.barangay === brgyFilter), brgyFilter: brgyFilter, mine: mine };
  }

  /* ============================================================ MODULE E TABS
     The LGU relief surface is now a three-tab workspace:
       1. Distributions — schedules + authorized beneficiaries (the original)
       2. Inventory — stock levels, low-stock alerts, restock
       3. Records — every pack handed out, per barangay / per family
     A low-stock banner surfaces above the tabs whenever any item is at or
     below its reorder point, so the duty officer never misses a shortfall. */
  const RELIEF_TABS = [
    ['distributions', T('relief.tab.distributions'), 'clock'],
    ['inventory', T('relief.tab.inventory'), 'layers'],
    ['records', T('relief.tab.records'), 'doc']
  ];

  /* Relief Assistance (uniguard/src/components/LdrrmcReliefView.tsx):
     title + one main action on the right, a compact low-stock line with a
     Review shortcut, the three section tabs as a pill bar, then the tab. */
  function dRelief(st) {
    const tab = st.reliefTab || 'distributions';
    const mine = scopedBrgy(st);
    const low = lowStockItems();
    const sub = mine ? 'Distribution schedules, beneficiaries, relief stock and what was handed out in Barangay ' + mine + '.'
      : 'Manage distributions, track stock levels, and record every pack handed out per barangay and family.';
    const main = tab === 'distributions' ? '<button class="ug-btn ug-btn--signal rl-main"' + A('relief-add') + '>' + I('plus', 15) + 'Add Distribution</button>'
      : tab === 'inventory' ? '<button class="ug-btn ug-btn--signal rl-main"' + A('inv-add') + '>' + I('plus', 15) + 'Add item</button>'
      : '<button class="ug-btn ug-btn--signal rl-main"' + A('rec-add') + '>' + I('plus', 15) + 'Record distribution</button>';
    const lowLine = low.length
      ? U.note('relief-low', low.map((i) => i.id + ':' + i.stock).join(','), 'alert', low.length + ' ' + (low.length === 1 ? 'item is' : 'items are') + ' at or below the reorder point',
          low.slice(0, 3).map((i) => esc(i.name) + ' (' + i.stock + ' ' + esc(i.unit) + ')').join(' · ') + (low.length > 3 ? ' · +' + (low.length - 3) + ' more' : ''),
          { btn: tab !== 'inventory' ? '<button class="n2-go"' + A('relief-tab', attr({ v: 'inventory' })) + '>Review</button>' : '' })
      : '';
    const TABS = [['distributions', 'Distributions', 'shelter'], ['inventory', 'Resource Inventory', 'layers'], ['records', 'Distribution Records', 'doc']];
    return '<div class="ug-col rl" style="gap:20px">' +
      head(T('title.relief'), sub, main) +
      (tab === 'inventory' ? '' : lowLine) +
      /* phones: the section switch is a dropdown (the tabs hide there) */
      (() => {
        const cur = TABS.find((t) => t[0] === tab) || TABS[0];
        return '<div class="rl-bar"><div class="ug-wmore inc-dd rl-dd"><button class="inc-dd-btn"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Relief section">' +
            I(cur[2], 15) + '<span>' + cur[1] + '</span>' + I('chevdn', 16) + '</button>' +
          '<div class="inc-dd-panel" data-more-panel hidden role="listbox">' + TABS.map((t) =>
            '<button role="option" class="' + (tab === t[0] ? 'is-on' : '') + '"' + A('relief-tab', attr({ v: t[0] })) + '>' + I(t[2], 15) + '<span>' + t[1] + '</span>' +
              (tab === t[0] ? I('check', 14) : '') + '</button>').join('') + '</div></div>' +
          /* phones: the main action sits beside the section switch */
          main.replace('rl-main', 'rl-main rl-main--bar') + '</div>';
      })() +
      '<div class="rl-tabs" role="tablist" aria-label="Relief sections">' + TABS.map((t) =>
        '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'is-on' : '') + '"' + A('relief-tab', attr({ v: t[0] })) + '>' + I(t[2], 14) + t[1] + '</button>').join('') + '</div>' +
      (tab === 'inventory' ? dInventory(st) : tab === 'records' ? dRecords(st) : dDistributions(st)) +
    '</div>';
  }

  /* --------------------------------------------------------- distributions tab */
  function dDistributions(st) {
    const mine = scopedBrgy(st);
    const barangays = mine ? [mine] : U.DATA.barangays;
    const rows = (U.DATA.relief || []).filter((r) => !mine || r.barangay === mine);
    const bens = (UG.DATA.beneficiaries || []).filter((b) => !mine || b.barangay === mine);
    const benFilter = mine || st.benBarangayFilter || 'All';
    const q = (st.benSearchLgu || '').trim().toLowerCase();
    const visibleBens = bens
      .filter((b) => (benFilter === 'All' || b.barangay === benFilter))
      .filter((b) => !q || [b.beneficiary_name, b.claimant_name, b.claimant_id].some((v) => String(v || '').toLowerCase().indexOf(q) >= 0));
    const cardHead = (icon, title, right) => '<div class="rl-ch"><h2>' + I(icon, 15) + title + '</h2><div class="rl-ch-r">' + right + '</div></div>';
    const exp = (what, empty) => '<button class="rl-ghost"' + A('relief-download', attr({ what: what })) + (empty ? ' disabled' : '') + ' title="Download as CSV">' + I('download', 13) + 'CSV</button>';
    return '<div class="ug-col" style="gap:20px">' +
      /* active distributions */
      '<section class="rl-card">' +
        cardHead('shelter', 'Active Distributions', exp('distributions', !rows.length) + '<span class="rl-count">' + rows.length + ' ' + (rows.length === 1 ? 'record' : 'records') + '</span>') +
        (rows.length ? '<div class="rl-list">' + rows.map((r) =>
          '<div class="rl-item"><div class="rl-item-t"><h3>' + esc(r.title) + '</h3>' +
            '<div class="rl-meta"><span>' + I('pin', 13) + esc(r.location_name || r.barangay) + '</span><span>' + I('clock', 13) + esc(fmtDate(r.distribution_at)) + '</span>' +
              (r.contact_phone ? '<span class="rl-mono">' + esc(r.contact_phone) + '</span>' : '') + '</div></div>' +
            '<div class="rl-acts">' +
              '<button class="rl-ghost" data-act="relief-verify" data-id="' + esc(r.id) + '">' + I('users', 13) + 'Verify</button>' +
              '<button class="rl-ghost" data-act="relief-view" data-id="' + esc(r.id) + '">' + I('doc', 13) + 'View</button>' +
              '<button class="rl-ghost" data-act="relief-edit" data-id="' + esc(r.id) + '">' + I('settings', 13) + 'Edit</button>' +
            '</div></div>').join('') + '</div>'
        : '<div class="rl-empty"><span>' + I('shelter', 22) + '</span><b>No Active Distributions</b><p>There are currently no active distribution drives recorded. Schedule one to let residents know when and where to go.</p>' +
          '<button class="ug-btn ug-btn--signal"' + A('relief-add') + '>' + I('plus', 14) + 'Schedule New Distribution</button></div>') +
      '</section>' +
      /* authorized beneficiaries */
      '<section class="rl-card" id="relief-beneficiaries">' +
        cardHead('users', 'Authorized Beneficiaries', exp('beneficiaries', !visibleBens.length) +
          '<button class="ug-btn ug-btn--signal rl-sm"' + A('beneficiary-add') + '>' + I('plus', 13) + 'Add</button>') +
        '<div class="rl-filters">' +
          '<label><span>' + (mine ? 'Barangay' : 'Filter by barangay') + '</span>' +
            (mine ? '<p class="rl-fixed">Brgy. ' + esc(mine) + '</p>'
              : '<select class="rl-in rl-sel" data-field="benBarangayFilter">' + ['All'].concat(barangays).map((b) => '<option value="' + esc(b) + '"' + (benFilter === b ? ' selected' : '') + '>' + (b === 'All' ? 'All (Municipality-wide)' : 'Brgy. ' + esc(b)) + '</option>').join('') + '</select>') + '</label>' +
          '<label><span>Search</span><span class="rl-search">' + I('search', 14) + '<input class="rl-in" data-field="benSearchLgu" placeholder="Name or ID" value="' + esc(st.benSearchLgu || '') + '"></span></label>' +
        '</div>' +
        '<div class="rl-stat"><span>Showing <b>' + visibleBens.length + '</b> records</span>' +
          (!mine && benFilter !== 'All' ? '<button' + A('relief-ben-reset') + '>Reset to All Barangays</button>' : '') + '</div>' +
        (visibleBens.length ? '<div class="rl-tablewrap"><table class="rl-table"><thead><tr><th>Beneficiary ID</th><th>Head of household</th><th>Barangay / address</th><th class="c">Category</th><th class="c">Action</th></tr></thead><tbody>' +
          visibleBens.map((b) => '<tr><td class="rl-mono">' + esc(b.claimant_id || '—') + '</td>' +
            '<td><b>' + esc(b.beneficiary_name) + '</b><small>Claimant: ' + esc(b.claimant_name || '—') + '</small></td>' +
            '<td><b>Brgy. ' + esc(b.barangay) + '</b></td>' +
            '<td class="c"><span class="rl-cat">' + esc(b.category || 'General') + '</span></td>' +
            '<td class="c"><button class="rl-icon" data-act="beneficiary-del" data-id="' + esc(b.id) + '" title="Delete record" aria-label="Delete ' + esc(b.beneficiary_name) + '">' + I('x', 13) + '</button></td></tr>').join('') +
          '</tbody></table></div>'
        : '<div class="rl-empty"><span>' + I('search', 20) + '</span><b>No matching beneficiaries found</b><p>Try adjusting your search or selecting a different barangay.</p></div>') +
      '</section>' +
    '</div>';
  }

  /* ----------------------------------------------------------- inventory tab
   * Stock table grouped by category. Each row shows current stock vs the
   * reorder point; amber when at or below reorder. Restock + Adjust buttons
   * open a modal that records a stock movement.
   *
   * Barangay scoping (per the DOCX issue list):
   *  - barangay_official: scoped to assigned barangay (a static chip is
   *    locked to their barangay and the dropdown is hidden).
   *  - LGU staff: see municipality-wide stock with an optional barangay filter
   *    so they can audit any single barangay's stock.
   */
  /* Resource Inventory (uniguard ReliefStockPanel, stock view): three
     figures, category pills with counts + search, the low-stock note, then
     the items grouped by category, each with a stock bar against its
     reorder point and Distribute / Restock / Edit. */
  function dInventory(st) {
    const vis = visibleInventory(st);
    const all = vis.all, cat = vis.cat, list = vis.list, mine = vis.mine, q = vis.q;
    const low = all.filter((i) => (i.stock || 0) <= (i.reorder || 0));
    const totalUnits = all.reduce((n, i) => n + (i.stock || 0), 0);
    const cats = [['all', 'All', all.length]].concat(INV_CATEGORIES.map((c) => [c, c, all.filter((i) => i.category === c).length]).filter((c) => c[2] > 0));
    const groups = INV_CATEGORIES.concat(['Other']).map((c) => ({ c: c, items: list.filter((i) => (INV_CATEGORIES.indexOf(i.category) >= 0 ? i.category : 'Other') === c) })).filter((g) => g.items.length);
    return '<section class="rl-card">' +
      '<div class="rl-ch"><h2>' + I('layers', 15) + 'Resource Inventory</h2><div class="rl-ch-r">' +
        (mine ? '<span class="rl-count">' + I('pin', 12) + esc(mine) + '</span>'
          : '<select class="rl-in rl-sel rl-sel--sm" data-field="invBrgyFilter" aria-label="Filter by barangay"><option value="All">All barangays</option>' +
              (U.DATA.barangays || []).map((b) => '<option value="' + esc(b) + '"' + (st.invBrgyFilter === b ? ' selected' : '') + '>Brgy. ' + esc(b) + '</option>').join('') + '</select>') +
        '<button class="rl-ghost"' + A('inv-download') + (all.length ? '' : ' disabled') + '>' + I('download', 13) + 'CSV</button>' +
      '</div></div>' +
      '<div class="rl-body">' +
        '<div class="rl-figs">' +
          '<div><span>Items</span><b>' + all.length.toLocaleString() + '</b></div>' +
          '<div><span>Units on hand</span><b>' + totalUnits.toLocaleString() + '</b></div>' +
          '<div class="' + (low.length ? 'is-warn' : '') + '"><span>Low stock</span><b>' + low.length.toLocaleString() + '</b></div>' +
        '</div>' +
        '<div class="rl-tool">' +
          /* phones: the category filter as a dropdown (the pills hide there) */
          (() => {
            const cur = cats.find((c) => c[0] === cat) || cats[0];
            return '<div class="ug-wmore inc-dd rl-cdd"><button class="inc-dd-btn"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Filter by category">' +
                '<span>' + esc(cur[0] === 'all' ? 'All categories' : cur[1]) + '</span><b>' + cur[2] + '</b>' + I('chevdn', 16) + '</button>' +
              '<div class="inc-dd-panel" data-more-panel hidden role="listbox">' + cats.map((c) =>
                '<button role="option" class="' + (cat === c[0] ? 'is-on' : '') + '"' + A('inv-cat', attr({ v: c[0] })) + '><span>' + esc(c[0] === 'all' ? 'All categories' : c[1]) + '</span><b>' + c[2] + '</b>' +
                  (cat === c[0] ? I('check', 14) : '') + '</button>').join('') + '</div></div>';
          })() +
          '<div class="rl-pills" role="tablist" aria-label="Filter by category">' + cats.map((c) =>
          '<button role="tab" aria-selected="' + (cat === c[0]) + '" class="' + (cat === c[0] ? 'is-on' : '') + '"' + A('inv-cat', attr({ v: c[0] })) + '>' + esc(c[1]) + '<b>' + c[2] + '</b></button>').join('') + '</div>' +
          '<span class="rl-search rl-search--sm">' + I('search', 14) + '<input class="rl-in" type="search" data-field="invSearch" value="' + esc(st.invSearch || '') + '" placeholder="Search items" aria-label="Search the inventory">' +
            (q ? '<button' + A('inv-clear-search') + ' aria-label="Clear search">' + I('x', 11) + '</button>' : '') + '</span></div>' +
        /* a friendly, dismissible stock reminder (comes back when the low list changes) */
        (low.length ? U.note('inv-low', low.map((i) => i.id + ':' + i.stock).join(','), 'alert',
            low.length + ' ' + (low.length === 1 ? 'item needs' : 'items need') + ' restocking',
            low.slice(0, 3).map((i) => esc(i.name) + ' — ' + i.stock + ' ' + esc(i.unit) + ' left').join('<br>') + (low.length > 3 ? '<br>and ' + (low.length - 3) + ' more' : ''),
            { tone: 'glass' }) : '') +
        (!all.length ? '<p class="rl-muted">No items yet. Add the goods the LDRRMO keeps in its warehouses.</p>'
          : !groups.length ? '<p class="rl-muted">No items match. Try another category or search.</p>'
          : groups.map((g) => '<div class="rl-group"><h3>' + esc(g.c) + '</h3><ul>' + g.items.map(invRow).join('') + '</ul></div>').join('')) +
      '</div>' +
    '</section>';
  }

  function invRow(i) {
    const isLow = (i.stock || 0) <= (i.reorder || 0);
    const pct = i.reorder > 0 ? Math.min(100, Math.round((i.stock || 0) / (i.reorder * 2) * 100)) : 100;
    return '<li class="rl-inv' + (isLow ? ' is-low' : '') + '">' +
      '<div class="rl-inv-t"><button class="rl-link" data-act="inv-detail" data-id="' + esc(i.id) + '">' + esc(i.name) + '</button>' +
        '<small>' + esc([i.location, i.supplier].filter(Boolean).join(' · ')) + '</small>' +
        '<div class="rl-bar"><i style="width:' + Math.max(pct, (i.stock || 0) > 0 ? 4 : 0) + '%"></i></div></div>' +
      '<div class="rl-inv-r"><span class="rl-mono rl-qty">' + (i.stock || 0).toLocaleString() + ' ' + esc(i.unit || '') + '<em>/ reorder ' + (i.reorder || 0) + '</em></span>' +
        '<div class="rl-acts">' +
          '<button class="rl-ghost" data-act="rec-add" data-item="' + esc(i.id) + '"' + ((i.stock || 0) <= 0 ? ' disabled' : '') + ' title="Record goods handed out">' + I('download', 12) + 'Distribute</button>' +
          '<button class="rl-ghost" data-act="inv-restock" data-id="' + esc(i.id) + '">' + I('plus', 12) + 'Restock</button>' +
          '<button class="rl-icon" data-act="inv-edit" data-id="' + esc(i.id) + '" title="Edit" aria-label="Edit ' + esc(i.name) + '">' + I('settings', 13) + '</button>' +
        '</div></div>' +
    '</li>';
  }

  /* full detail modal for an inventory item — opens when the row is clicked.
     Shows every stored field in organized sections; Edit is offered where the
     caller is an LGU or barangay official (RLS re-checks on the server). */
  function invDetailModal(id) {
    const i = (UG.DATA.inventory || []).find((x) => x.id === id);
    if (!i) return;
    const low = (i.stock || 0) <= (i.reorder || 0);
    const out = (i.stock || 0) <= 0;
    const status = out ? 'Out of stock' : low ? 'Low stock' : 'In stock';
    const statusTone = out ? 'var(--ug-emergency)' : low ? 'var(--ug-warning)' : 'var(--ug-prepared)';
    const catColor = CAT_COLOR[i.category] || 'var(--ug-ink-2)';
    const pct = i.reorder > 0 ? Math.min(100, Math.round((i.stock || 0) / Math.max(i.reorder * 2, 1) * 100)) : 100;
    const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600;max-width:60%">' + esc(v == null || v === '' ? '—' : v) + '</span></div>';
    UG_FEATURES.modal({
      title: i.name || 'Stock item',
      body:
        '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:14px">' +
          '<div class="ug-rowf ug-between" style="gap:10px;align-items:center">' +
            '<span class="ug-chip" style="background:' + catColor + '22;color:' + catColor + '">' + esc(i.category) + '</span>' +
            '<span class="ug-badge" style="background:' + statusTone + '22;color:' + statusTone + ';border-color:' + statusTone + '55">' + esc(status) + '</span>' +
          '</div>' +
          '<div>' +
            '<div class="ug-rowf ug-between" style="font-size:12px;margin-bottom:5px"><span class="ug-dim">Stock vs reorder point</span>' +
              '<span class="ug-mono">' + esc(i.stock || 0) + ' / ' + esc(i.reorder || 0) + ' ' + esc(i.unit || '') + '</span></div>' +
            '<div style="height:8px;border-radius:4px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + statusTone + '"></div></div>' +
          '</div>' +
        '</div></div>' +
        '<div style="margin-top:14px">' +
          kv('Item ID', i.id) +
          kv('Item name', i.name) +
          kv('Category', i.category) +
          kv('Unit of measure', i.unit) +
          kv('In stock', (i.stock || 0) + ' ' + (i.unit || '')) +
          kv('Reorder threshold', (i.reorder || 0) + ' ' + (i.unit || '')) +
          kv('Warehouse location', i.location) +
          kv('Supplier', i.supplier) +
          (i.created_at ? kv('Created', UG_UTIL.absTime(i.created_at) || '') : '') +
          (i.updated_at ? kv('Last updated', UG_UTIL.absTime(i.updated_at) || '') : '') +
        '</div>',
      footer:
        '<button class="ug-btn" data-modal-close>Close</button>' +
        '<button class="ug-btn ug-btn--ghost" data-act="inv-restock" data-id="' + esc(i.id) + '">' + I('plus', 13) + 'Restock</button>' +
        '<button class="ug-btn ug-btn--signal" data-act="inv-edit" data-id="' + esc(i.id) + '">' + I('settings', 13) + 'Edit</button>'
    });
  }

  /* ------------------------------------------------------ distribution detail
     Opened by "View" on Active Distributions. Same layout as invDetailModal;
     staff get Verify beneficiary and Edit in the footer (those buttons run
     through the app's delegated [data-act] handler). */
  function distDetailModal(id, st) {
    const r = (UG.DATA.relief || []).find((x) => x.id === id);
    if (!r) return false;
    const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600;max-width:60%">' + esc(v == null || v === '' ? '—' : v) + '</span></div>';
    const li = (arr) => (arr || []).map((x) => '<li>' + esc(x) + '</li>').join('');
    const phone = String(r.contact_phone || '').replace(/[^\d+]/g, '');
    const canWaze = typeof r.lat === 'number' && typeof r.lng === 'number' && UG_GEO.classify(r.lat, r.lng) === 'ok';
    UG_FEATURES.modal({
      title: r.title || 'Distribution',
      body:
        '<div style="margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          U.badge(r.active === false ? 'closed' : 'open', r.active === false ? 'Inactive' : 'Active') +
          U.badge('id', r.barangay || '—') + '</div>' +
        kv('Barangay', r.barangay) +
        kv('Location', r.location_name) +
        kv('Address', r.address) +
        kv('Schedule', fmtDate(r.distribution_at)) +
        kv('Contact person', r.contact_person) +
        '<div class="ug-rowf ug-between" style="gap:12px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">Contact phone</span>' +
          (phone ? '<a href="tel:' + esc(phone) + '" style="font-weight:600">' + esc(r.contact_phone) + '</a>' : '<span style="font-weight:600">—</span>') + '</div>' +
        kv('Status', r.active === false ? 'Inactive' : 'Active') +
        (r.eligibility && r.eligibility.length ? '<div class="ug-field" style="margin-top:10px"><div class="ug-lab">Eligibility</div><ul class="ug-bullets">' + li(r.eligibility) + '</ul></div>' : '') +
        (r.required_docs && r.required_docs.length ? '<div class="ug-field"><div class="ug-lab">Required documents</div><ul class="ug-bullets">' + li(r.required_docs) + '</ul></div>' : '') +
        (r.note ? '<div class="ug-note" style="margin-top:10px">' + esc(r.note) + '</div>' : '') +
        (canWaze
          ? '<a class="ug-waze-btn" style="margin-top:12px;display:inline-flex" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(r.lat, r.lng) + '">' + I('route', 13) + ' Open in Waze</a>' : ''),
      footer:
        '<button class="ug-btn" data-modal-close>Close</button>' +
        (isStaff(st)
          ? '<button class="ug-btn ug-btn--ghost" data-act="relief-verify" data-id="' + esc(r.id) + '">' + I('users', 13) + 'Verify beneficiary</button>' +
            '<button class="ug-btn ug-btn--signal" data-act="relief-edit" data-id="' + esc(r.id) + '">' + I('settings', 13) + 'Edit</button>'
          : '')
    });
    return true;
  }

  /* ------------------------------------------------------- distribution records
     Every handover is one row. The "Record distribution" modal decrements the
     inventory and appends a record in one action so stock and ledger never
     drift apart. */
  /* Distribution Records (uniguard ReliefStockPanel, log view): totals per
     barangay with bars, then every hand-out, newest first */
  function dRecords(st) {
    const vis = visibleRecords(st);
    const mine = vis.mine, brgyFilter = vis.brgyFilter, filtered = vis.filtered;
    const barangays = mine ? [mine] : ['All'].concat(U.DATA.barangays);
    const per = {};
    filtered.forEach((r) => { const k = r.barangay || 'Unspecified'; per[k] = (per[k] || 0) + (r.qty || 0); });
    const perRows = Object.keys(per).sort((x, y) => per[y] - per[x]);
    const max = perRows.length ? per[perRows[0]] : 1;
    const total = filtered.reduce((n, r) => n + (r.qty || 0), 0);
    return '<section class="rl-card">' +
      '<div class="rl-ch"><h2>' + I('doc', 15) + 'Distribution Records</h2><div class="rl-ch-r">' +
        (mine ? '<span class="rl-count">' + I('pin', 12) + esc(mine) + '</span>'
          : '<select class="rl-in rl-sel rl-sel--sm" data-field="recBrgyFilter" aria-label="Filter by barangay">' + barangays.map((b) => '<option value="' + esc(b) + '"' + (brgyFilter === b ? ' selected' : '') + '>' + (b === 'All' ? 'All barangays' : 'Brgy. ' + esc(b)) + '</option>').join('') + '</select>') +
        '<button class="rl-ghost"' + A('rec-download') + (filtered.length ? '' : ' disabled') + '>' + I('download', 13) + 'CSV</button>' +
      '</div></div>' +
      '<div class="rl-body rl-rec">' +
        '<div><h3 class="rl-h3">' + (mine ? 'Total handed out' : 'Per-barangay totals') + '<em>' + total.toLocaleString() + ' units</em></h3>' +
          (perRows.length ? '<ul class="rl-per">' + perRows.map((b) => '<li><div><span>' + esc(b) + '</span><b class="rl-mono">' + per[b].toLocaleString() + '</b></div><div class="rl-bar"><i style="width:' + Math.max(4, Math.round(per[b] / max * 100)) + '%"></i></div></li>').join('') + '</ul>'
            : '<p class="rl-muted">No distributions recorded yet.</p>') + '</div>' +
        '<div><h3 class="rl-h3">Goods handed out<em>' + filtered.length + ' records</em></h3>' +
          (filtered.length ? '<ul class="rl-log">' + filtered.map(recRow).join('') + '</ul>' : '<p class="rl-muted">No distribution records.</p>') + '</div>' +
      '</div>' +
    '</section>';
  }

  function recRow(r) {
    return '<li><div class="rl-log-t"><b>' + (r.qty || 0).toLocaleString() + ' × ' + esc(r.item_name || 'Removed item') + '</b>' +
      '<small>' + esc(r.family || '—') + ' · Brgy. ' + esc(r.barangay || '—') + '</small>' +
      '<small class="rl-faint">' + esc(fmtDateTime(r.distributed_at)) + (r.distributed_by ? ' · ' + esc(r.distributed_by) : '') + '</small></div>' +
      '<button class="rl-icon" data-act="rec-del" data-id="' + esc(r.id) + '" title="Remove record" aria-label="Remove record">' + I('x', 13) + '</button></li>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap ug-phead" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mRelief, mReliefVerify, dRelief, fmtDate, fmtDateTime, head,
    visibleSchedules, visibleBeneficiaries, visibleInventory, visibleRecords, scopedBrgy,
    ensureInventory, lowStockItems, DEFAULT_INVENTORY, DEFAULT_DISTRIBUTIONS_LOG,
    INV_CATEGORIES, CAT_COLOR, RELIEF_TABS, invDetailModal, distDetailModal };
})();
