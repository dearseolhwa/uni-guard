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
    { id: 'INV-01', name: 'Family Food Pack',        category: 'Food',     unit: 'packs',    stock: 420,  reorder: 200, location: 'MDRRMO Warehouse A', supplier: 'DSWD Field Office' },
    { id: 'INV-02', name: 'Bottled Water (5L)',       category: 'Water',    unit: 'bottles',  stock: 180,  reorder: 250, location: 'MDRRMO Warehouse A', supplier: 'Lingayen Water District' },
    { id: 'INV-03', name: 'Rice (25kg sack)',         category: 'Food',     unit: 'sacks',    stock: 64,   reorder: 40,  location: 'MDRRMO Warehouse B', supplier: 'NFA Pangasinan' },
    { id: 'INV-04', name: 'Canned Goods',             category: 'Food',     unit: 'cans',     stock: 1280, reorder: 500, location: 'MDRRMO Warehouse A', supplier: 'Red Cross Pangasinan' },
    { id: 'INV-05', name: 'First Aid Kit',            category: 'Medical',  unit: 'kits',     stock: 48,   reorder: 60,  location: 'MDRRMO Warehouse C', supplier: 'Provincial Health Office' },
    { id: 'INV-06', name: 'Paracetamol / Biogesic',   category: 'Medical',  unit: 'boxes',    stock: 90,   reorder: 100, location: 'MDRRMO Warehouse C', supplier: 'Botika ng Bayan' },
    { id: 'INV-07', name: 'Banca / Boat',             category: 'Equipment',unit: 'units',    stock: 6,    reorder: 4,   location: 'Coastal Depot',        supplier: 'PCG Lingayen' },
    { id: 'INV-08', name: 'Life Jacket',              category: 'Equipment',unit: 'pieces',   stock: 38,   reorder: 30,  location: 'Coastal Depot',        supplier: 'PCG Lingayen' },
    { id: 'INV-09', name: 'Portable Radio (VHF)',     category: 'Equipment',unit: 'units',    stock: 12,   reorder: 8,   location: 'MDRRMO Warehouse C', supplier: 'OCD Region I' },
    { id: 'INV-10', name: 'Tarpaulin / Trapal',       category: 'Shelter Supplies', unit: 'pieces',   stock: 75,   reorder: 50,  location: 'MDRRMO Warehouse B', supplier: 'DSWD Field Office' },
    { id: 'INV-11', name: 'Sleeping Mat',             category: 'Shelter Supplies', unit: 'pieces',   stock: 140,  reorder: 120, location: 'MDRRMO Warehouse B', supplier: 'DSWD Field Office' },
    { id: 'INV-12', name: 'Hygiene Kit',              category: 'Hygiene',  unit: 'kits',     stock: 95,   reorder: 80,  location: 'MDRRMO Warehouse A', supplier: 'Red Cross Pangasinan' },
    { id: 'INV-13', name: 'Family Tent (4-person)',   category: 'Shelter Supplies', unit: 'units',    stock: 22,   reorder: 25,  location: 'MDRRMO Warehouse B', supplier: 'DSWD Field Office' },
    { id: 'INV-14', name: 'Blanket',                  category: 'Shelter Supplies', unit: 'pieces',   stock: 200,  reorder: 150, location: 'MDRRMO Warehouse B', supplier: 'Red Cross Pangasinan' },
    { id: 'INV-15', name: 'Mosquito Net',             category: 'Shelter Supplies', unit: 'pieces',   stock: 60,   reorder: 75,  location: 'MDRRMO Warehouse B', supplier: 'Provincial Health Office' },
    { id: 'INV-16', name: 'Water Container (20L)',    category: 'Hygiene',  unit: 'containers', stock: 40,  reorder: 50,  location: 'MDRRMO Warehouse A', supplier: 'Lingayen Water District' },
    { id: 'INV-17', name: 'Soap / Detergent Pack',    category: 'Hygiene',  unit: 'packs',   stock: 110,  reorder: 90,  location: 'MDRRMO Warehouse A', supplier: 'Red Cross Pangasinan' },
    { id: 'INV-18', name: 'Sanitary Napkin Pack',     category: 'Hygiene',  unit: 'packs',   stock: 70,   reorder: 80,  location: 'MDRRMO Warehouse A', supplier: 'Provincial Health Office' }
  ];

  /* ----------------------------------------------------- distribution records
     Each row is one handover at a distribution point: which item, how many, to
     which barangay and family, by whom, on what date. The records reconcile the
     inventory (stock decreases) against the relief_distributions schedule. */
  const DEFAULT_DISTRIBUTIONS_LOG = [
    { id: 'DR-01', item_id: 'INV-01', item_name: 'Family Food Pack', qty: 50, barangay: 'Pangapisan North', family: 'Aquino household', distributed_by: 'MDRRMO Relief Desk', distributed_at: new Date(Date.now() - 1 * 86400000).toISOString() },
    { id: 'DR-02', item_id: 'INV-02', item_name: 'Bottled Water (5L)', qty: 40, barangay: 'Pangapisan North', family: 'Aquino household', distributed_by: 'MDRRMO Relief Desk', distributed_at: new Date(Date.now() - 1 * 86400000).toISOString() },
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
        contact_person: 'MDRRMO Relief Desk', contact_phone: '(075) 632-2222',
        eligibility: ['Affected household', 'Senior citizen', 'Person with disability (PWD)'],
        required_docs: ['Valid government ID', 'Barangay certificate of indigency',
          'Authorization letter if claiming on behalf of a beneficiary'],
        note: 'Distribution starts 8:00 AM. Bring your own bag.',
        active: true
      },
      {
        id: 'RD-02', barangay: 'Pangapisan North', title: 'Coastal Relief Distribution',
        location_name: 'Pangapisan North Multi-Purpose Center', address: 'Coastal Rd, Pangapisan North',
        lat: 16.0555, lng: 120.2245,
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
      '<h2 style="font-size:19px;margin-top:3px">Relief Distribution</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Per-barangay relief schedules, eligibility, required documents, and the authorized-beneficiary list. Filter by your barangay.</p></div>' +

            (barangays.length ? '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + barangays.map((b) =>
        '<button class="ug-chip' + (f === b ? ' is-on' : '') + '"' + A('relief-filter', attr({ v: b })) + '>' + esc(b) + '</button>').join('') + '</div>' : '') +

      (list.length ? list.map((r) => reliefCard(r, isStaff(st))).join(''):
        '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('info', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No Active Distribution for ' + esc(f) + '</div>' +
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
          '<div style="min-width:0"><div style="font-size:12.5px;font-weight:600">' + esc(r.location_name) + '</div>' +
          '<div class="ug-dim" style="font-size:11.5px;line-height:1.5">' + esc(r.address) + '</div></div></div>' +
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
      '<h2 style="font-size:17px;margin-top:3px">' + esc(r.title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px;line-height:1.5">Search by beneficiary name, claimant name, or claimant ID. Used by staff on the spot to confirm an authorized claimant.</p></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Search</h3></div>' +
        '<div class="ug-card-b"><input class="ug-in" data-field="benSearch" placeholder="Name or ID number" value="' + esc(st.benSearch || '') + '">' +
        '<div class="ug-help">Live filter — start typing a name or claimant ID.</div></div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>' + (list.length + ' Records') + '</h3>' + U.badge('id', r.barangay) + '</div>' +
        '<div class="ug-rows">' + (list.length ? list.map((b) => beneficiaryRow(b, st.benSearch)).join('') :
          '<div class="ug-empty"><span class="e-ico">' + I('users', 20) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No Authorized Records for ' + esc(r.barangay) + '</div>' +
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

  function dRelief(st) {
    const tab = st.reliefTab || 'distributions';
    const tabs = RELIEF_TABS.map((t) =>
      '<button class="ug-chip' + (tab === t[0] ? ' is-on' : '') + '"' + A('relief-tab', attr({ v: t[0] })) + '>' + I(t[2], 14) + t[1] + '</button>').join('');
    /* the low-stock alert banner is shared across all three tabs because a
       shortfall affects distributions and records, not just inventory. */
    const low = lowStockItems();
    const lowBanner = low.length
      ? '<div class="ug-card ug-lowstock-banner"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
          '<span style="color:var(--ug-warning);display:flex">' + I('alert', 18) + '</span>' +
          '<div class="ug-col" style="gap:4px;min-width:0;flex:1">' +
            '<div style="font-size:12.5px;font-weight:700;color:var(--ug-warning)">' + low.length + ' ' + esc(T(low.length === 1 ? 'relief.lowStockBannerOne' : 'relief.lowStockBannerMany')) + '</div>' +
            '<div class="ug-dim" style="font-size:11.5px;line-height:1.5">' + low.slice(0, 3).map((i) => esc(i.name) + ' (' + i.stock + ' ' + i.unit + ' ≤ ' + i.reorder + ')').join(' · ') + (low.length > 3 ? ' · +' + (low.length - 3) + ' more' : '') + '</div>' +
          '</div>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('relief-tab', attr({ v: 'inventory' })) + '>' + esc(T('relief.review')) + '</button>' +
        '</div></div>'
      : '';
    return '<div class="ug-col" style="gap:18px">' +
      head(T('title.relief'), T('relief.subtitle'),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('relief-download', attr({ what: 'distributions' })) + '>' + I('download', 15) + esc(T('action.export')) + '</button>') +
      lowBanner +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + tabs + '</div>' +
      (tab === 'inventory' ? dInventory(st) :
       tab === 'records' ? dRecords(st) :
       dDistributions(st)) +
    '</div>';
  }

  /* --------------------------------------------------------- distributions tab */
  function dDistributions(st) {
    const mine = scopedBrgy(st);
    const barangays = mine ? [mine] : U.DATA.barangays;
    const rows = (U.DATA.relief || []).filter((r) => !mine || r.barangay === mine);
    const bens = (UG.DATA.beneficiaries || []).filter((b) => !mine || b.barangay === mine);
    const benFilter = mine || st.benBarangayFilter;
    /* the visible (filtered) beneficiary rows, so the Download button exports
       exactly what the duty officer is looking at on screen. */
    const visibleBens = bens
      .filter((b) => (!benFilter || benFilter === 'All' || b.barangay === benFilter))
      .filter((b) => !((st.benSearchLgu || '').trim()) ||
        (b.beneficiary_name || '').toLowerCase().indexOf(st.benSearchLgu.toLowerCase()) >= 0 ||
        (b.claimant_name || '').toLowerCase().indexOf(st.benSearchLgu.toLowerCase()) >= 0 ||
        (b.claimant_id || '').toLowerCase().indexOf(st.benSearchLgu.toLowerCase()) >= 0);
    return '<div class="ug-col" style="gap:18px">' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('relief.activeDistributions')) + '</h3><span class="ug-chip is-on">' + rows.length + ' ' + esc(T('admin.entriesOf')) + '</span></div>' +
        '<div class="ug-rows ug-scroll" style="max-height:330px">' + rows.map((r) =>
          '<div class="ug-row"><span class="r-dot" style="background:var(--ug-prepared)"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(r.title) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span>' +
              '<span>' + I('clock', 12) + esc(fmtDate(r.distribution_at)) + '</span>' +
              '<span class="ug-mono">' + esc(r.contact_phone) + '</span></div></div>' +
              '<div class="ug-rowf ug-gap6" style="gap:6px;justify-content:flex-end;flex-wrap:wrap">' +
                '<button class="ug-btn ug-btn--sm" data-act="relief-verify" data-id="' + esc(r.id) + '">' + I('users', 14) + esc(T('action.verify')) + '</button>' +
                '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="relief-view" data-id="' + esc(r.id) + '" title="' + esc(T('action.viewDetails')) + '">' + I('eye', 14) + esc(T('action.view')) + '</button>' +
                '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="relief-edit" data-id="' + esc(r.id) + '" title="' + esc(T('action.edit')) + '">' + I('settings', 14) + esc(T('action.edit')) + '</button>' +
              '</div></div>').join('') + '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('relief.authorizedBeneficiaries')) + '</h3>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('relief-download', attr({ what: 'beneficiaries' })) + '>' + I('download', 14) + esc(T('action.exportCsv')) + '</button>' +
          '<button class="ug-btn ug-btn--sm"' + A('beneficiary-add') + '>' + I('plus', 14) + esc(T('relief.beneficiaryAdd')) + '</button></div></div>' +
        '<div class="ug-card-b"><div class="ug-rowf ug-gap10 ug-wrap" style="gap:10px;align-items:flex-end">' +
          '<div class="ug-field" style="flex:1;min-width:200px;margin:0"><label class="ug-lab">' + esc(T('label.filterByBarangay')) + '</label>' +
            '<select class="ug-sel" data-field="benBarangayFilter">' +
                        (mine ? barangays : ['All'].concat(barangays)).map((b) => '<option' + (benFilter === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select></div>' +
          '<div class="ug-field" style="flex:1;min-width:200px;margin:0"><label class="ug-lab">' + esc(T('action.search')) + '</label>' +
            '<input class="ug-in" data-field="benSearchLgu" placeholder="' + esc(T('ben.searchPlaceholder')) + '" value="' + esc(st.benSearchLgu || '') + '"></div>' +
        '</div></div>' +
        '<div class="ug-rows ug-scroll" style="max-height:280px;margin-top:6px">' +
                    visibleBens
            .map((b) => '<div class="ug-row"><span class="r-dot" style="background:var(--ug-advisory)"></span>' +
              '<div class="r-main"><div class="r-t">' + esc(b.beneficiary_name) + '</div>' +
                '<div class="r-m"><span>' + esc(b.barangay) + '</span>' +
                '<span>Claimant: ' + esc(b.claimant_name) + '</span>' +
                '<span class="ug-mono">' + esc(b.claimant_id) + '</span></div></div>' +
              '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="beneficiary-del" data-id="' + esc(b.id) + '">' + I('x', 13) + '</button></div>').join('') +
        '</div></div>' +
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
  function dInventory(st) {
    ensureInventory();
    const mine = scopedBrgy(st); /* null for LGU; barangay name for officials */
    const all = (UG.DATA.inventory || []).filter((i) => !mine || (i.barangay || 'MDRRMO Warehouse') === mine || !i.barangay);
    const cat = st.invCatFilter || 'all';
    const q = (st.invSearch || '').trim().toLowerCase();
    const cats = [['all', T('label.all'), all.length]].concat(INV_CATEGORIES.map((c) =>
      [c, c, all.filter((i) => i.category === c).length]));
    /* combined filter: category + search text on name/id/location/supplier +
       LGU barangay filter (barangay_official is already scoped to mine). */
    const brgyFilter = mine ? mine : (st.invBrgyFilter || 'All');
    const list = all.filter((i) => cat === 'all' || i.category === cat)
      .filter((i) => !q ||
        (i.name || '').toLowerCase().indexOf(q) >= 0 ||
        (i.id || '').toLowerCase().indexOf(q) >= 0 ||
        (i.location || '').toLowerCase().indexOf(q) >= 0 ||
        (i.supplier || '').toLowerCase().indexOf(q) >= 0)
      .filter((i) => mine || brgyFilter === 'All' || (i.barangay || '') === brgyFilter);
    const lowN = (all).filter((i) => (i.stock || 0) <= (i.reorder || 0)).length;
    const totalUnits = all.reduce((s, i) => s + (i.stock || 0), 0);
    const summary = [
      [T('relief.totalSkus'), all.length, 'layers', 'var(--ug-signal)'],
      [T('relief.itemsInStock'), totalUnits + ' ' + T('label.units'), 'download', 'var(--ug-prepared)'],
      [T('relief.lowStockAlerts'), lowN, 'alert', 'var(--ug-warning)']
    ];
    /* LGU-only barangay filter dropdown. Barangay officials see a static chip
       telling them the inventory is locked to their barangay. */
    const lguBrgyFilter = mine ? '' :
      '<div class="ug-field" style="margin:0;min-width:200px"><label class="ug-lab">' + esc(T('label.filterByBarangay')) + '</label>' +
        '<select class="ug-sel" data-field="invBrgyFilter">' +
          '<option value="All">' + esc(T('label.allBarangays')) + '</option>' +
          (U.DATA.barangays || []).map((b) => '<option value="' + esc(b) + '"' + (st.invBrgyFilter === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') +
        '</select></div>';
    const scopeChip = mine
      ? '<span class="ug-chip is-on">' + I('pin', 13) + esc(mine) + '</span>'
      : '';
    return '<div class="ug-col" style="gap:18px">' +
      '<div class="ug-dgrid-stats">' + summary.map((s) =>
        '<div class="ug-card ug-stat-card"><div class="ug-card-b ug-col" style="gap:6px">' +
        '<div class="ug-rowf ug-between" style="gap:8px"><span class="ug-lab">' + esc(s[0]) + '</span>' +
        '<span style="color:' + s[3] + ';display:flex">' + I(s[2], 16) + '</span></div>' +
        '<div class="ug-mono" style="font-size:22px;font-weight:600;color:' + s[3] + '">' + esc(s[1]) + '</div>' +
        '</div></div>').join('') + '</div>' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px;align-items:flex-end">' +
        cats.map((c) => '<button class="ug-chip' + (cat === c[0] ? ' is-on' : '') + '"' + A('inv-cat', attr({ v: c[0] })) + '>' + I('layers', 13) + esc(c[1]) + ' <span class="ug-dimmer" style="margin-left:4px">' + c[2] + '</span></button>').join('') +
        '<span style="flex:1"></span>' +
        scopeChip +
        lguBrgyFilter +
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('inv-add') + '>' + I('plus', 14) + esc(T('action.addStockItem')) + '</button>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('inv-download') + '>' + I('download', 14) + esc(T('action.exportCsv')) + '</button>' +
      '</div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap8 ug-wrap" style="gap:8px;align-items:flex-end">' +
        '<div class="ug-field" style="margin:0;flex:1;min-width:240px"><label class="ug-lab">' + esc(T('action.search')) + '</label>' +
          '<input class="ug-in" data-field="invSearch" value="' + esc(st.invSearch || '') + '" placeholder="' + esc(T('label.name')) + ', ' + esc(T('label.location')) + ', ' + esc(T('label.supplier')) + '"></div>' +
        (q ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('inv-clear-search') + '>' + esc(T('action.clear')) + '</button>' : '') +
      '</div></div>' +
      '<div class="ug-card" style="overflow:hidden">' +
        '<table class="ug-table ug-inv-table">' +
          '<thead><tr><th>' + esc(T('label.item')) + '</th><th>' + esc(T('label.category')) + '</th><th class="t-num">' + esc(T('relief.itemsInStock')) + '</th><th class="t-num">' + esc(T('label.reorderAt')) + '</th><th>' + esc(T('label.status')) + '</th><th>' + esc(T('label.location')) + '</th><th>' + esc(T('label.supplier')) + '</th><th class="t-right">' + esc(T('label.action')) + '</th></tr></thead>' +
          '<tbody>' + (list.length ? list.map(invRow).join('') :
            '<tr><td colspan="8" style="text-align:center;padding:20px">' + (q ? esc(T('action.search')) + ' — ' + esc(q) : esc(T('relief.noStockItems'))) + '</td></tr>') + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  function invRow(i) {
    const low = (i.stock || 0) <= (i.reorder || 0);
    const out = (i.stock || 0) <= 0;
    const status = out ? '<span class="ug-badge ug-badge--closed">' + esc(T('relief.outOfStock')) + '</span>'
      : low ? '<span class="ug-badge ug-badge--full">' + esc(T('relief.lowStock')) + '</span>'
      : '<span class="ug-badge ug-badge--open">' + esc(T('relief.inStock')) + '</span>';
    const catColor = CAT_COLOR[i.category] || 'var(--ug-ink-2)';
    return '<tr class="' + (low ? 'ug-inv-row-low' : '') + '" data-act="inv-detail" data-id="' + esc(i.id) + '" style="cursor:pointer">' +
      '<td><div style="font-weight:600">' + esc(i.name) + '</div>' +
        '<div class="ug-dimmer ug-mono" style="font-size:10px">' + esc(i.id) + '</div></td>' +
      '<td><span class="ug-chip" style="background:' + catColor + '22;color:' + catColor + '">' + esc(i.category) + '</span></td>' +
      '<td class="t-num ug-mono" style="font-weight:600;color:' + (low ? 'var(--ug-warning)' : 'var(--ug-ink)') + '">' + esc(i.stock) + ' <span class="ug-dimmer" style="font-weight:400">' + esc(i.unit) + '</span></td>' +
      '<td class="t-num ug-mono">' + esc(i.reorder) + '</td>' +
      '<td>' + status + '</td>' +
      '<td class="ug-dim" style="font-size:11.5px">' + esc(i.location || '—') + '</td>' +
      '<td class="ug-dim" style="font-size:11.5px">' + esc(i.supplier || '—') + '</td>' +
      '<td class="t-right"><div class="ug-rowf ug-gap6" style="gap:6px;justify-content:flex-end">' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="inv-adjust" data-id="' + esc(i.id) + '" data-d="-1">−</button>' +
        '<button class="ug-btn ug-btn--sm" data-act="inv-restock" data-id="' + esc(i.id) + '">' + I('plus', 12) + esc(T('action.restock')) + '</button>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="inv-edit" data-id="' + esc(i.id) + '" title="' + esc(T('action.edit')) + '">' + I('settings', 12) + '</button>' +
      '</div></td>' +
    '</tr>';
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
    const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600;max-width:60%">' + esc(v == null || v === '' ? '—' : v) + '</span></div>';
    UG_FEATURES.modal({
      title: i.name || 'Stock item',
      body:
        '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:14px">' +
          '<div class="ug-rowf ug-between" style="gap:10px;align-items:center">' +
            '<span class="ug-chip" style="background:' + catColor + '22;color:' + catColor + '">' + esc(i.category) + '</span>' +
            '<span class="ug-badge" style="background:' + statusTone + '22;color:' + statusTone + ';border-color:' + statusTone + '55">' + esc(status) + '</span>' +
          '</div>' +
          '<div>' +
            '<div class="ug-rowf ug-between" style="font-size:11.5px;margin-bottom:5px"><span class="ug-dim">Stock vs reorder point</span>' +
              '<span class="ug-mono">' + esc(i.stock || 0) + ' / ' + esc(i.reorder || 0) + ' ' + esc(i.unit || '') + '</span></div>' +
            '<div style="height:8px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + statusTone + '"></div></div>' +
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

  /* ------------------------------------------------------- distribution records
     Every handover is one row. The "Record distribution" modal decrements the
     inventory and appends a record in one action so stock and ledger never
     drift apart. */
  function dRecords(st) {
    ensureInventory();
    const mine = scopedBrgy(st);
    const all = (UG.DATA.distributionLog || []).slice().sort((a, b) =>
      (Date.parse(b.distributed_at) || 0) - (Date.parse(a.distributed_at) || 0));
    const rows = all.filter((r) => !mine || r.barangay === mine);
    const brgyFilter = st.recBrgyFilter || 'All';
    const filtered = rows.filter((r) => brgyFilter === 'All' || r.barangay === brgyFilter);
    const barangays = mine ? [mine] : ['All'].concat(U.DATA.barangays);
    /* aggregate: total packs per barangay, so the duty officer can see who has
       been served the most / the least in the current response. */
    const perBrgy = {};
    filtered.forEach((r) => { perBrgy[r.barangay] = (perBrgy[r.barangay] || 0) + (r.qty || 0); });
    const perBrgyRows = Object.keys(perBrgy).sort((a, b) => perBrgy[b] - perBrgy[a])
      .map((b) => '<div class="ug-row"><span class="r-dot" style="background:var(--ug-signal)"></span>' +
        '<div class="r-main"><div class="r-t">' + esc(b) + '</div>' +
        '<div class="r-m"><span>' + perBrgy[b] + ' units distributed</span></div></div>' +
        '<span class="ug-mono">' + perBrgy[b] + '</span></div>').join('');
    return '<div class="ug-col" style="gap:18px">' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:8px;align-items:flex-end">' +
        '<div class="ug-field" style="margin:0;min-width:220px"><label class="ug-lab">Filter by barangay</label>' +
          '<select class="ug-sel" data-field="recBrgyFilter">' +
            barangays.map((b) => '<option' + (brgyFilter === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select></div>' +
        '<span style="flex:1"></span>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('rec-add') + '>' + I('plus', 14) + 'Record Distribution</button>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('rec-download') + '>' + I('download', 14) + 'Export CSV</button>' +
      '</div>' +
      '<div class="ug-dgrid-2">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Per-Barangay Totals</h3><span class="ug-chip is-on">' + Object.keys(perBrgy).length + ' barangays</span></div>' +
          '<div class="ug-rows ug-scroll" style="max-height:260px">' + (perBrgyRows || '<div class="ug-empty"><span class="e-ico">' + I('doc', 20) + '</span><div style="font-size:12px;color:var(--ug-ink-2)">No distributions recorded yet</div></div>') + '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Distribution Log</h3><span class="ug-chip">' + filtered.length + ' records</span></div>' +
          '<div class="ug-rows ug-scroll" style="max-height:260px">' + (filtered.length ? filtered.map(recRow).join('') :
            '<div class="ug-empty"><span class="e-ico">' + I('doc', 20) + '</span><div style="font-size:12px;color:var(--ug-ink-2)">No distribution records</div></div>') + '</div></div>' +
      '</div>' +
    '</div>';
  }

  function recRow(r) {
    return '<div class="ug-row"><span class="r-dot" style="background:var(--ug-prepared)"></span>' +
      '<div class="r-main"><div class="r-t">' + esc(r.qty + ' ' + (r.item_name || 'item')) + ' → ' + esc(r.family || '—') + '</div>' +
      '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span>' +
      '<span>' + I('users', 12) + esc(r.distributed_by || '—') + '</span>' +
      '<span>' + esc(fmtDateTime(r.distributed_at)) + '</span></div></div>' +
      '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="rec-del" data-id="' + esc(r.id) + '">' + I('x', 13) + '</button></div>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mRelief, mReliefVerify, dRelief, fmtDate, fmtDateTime, head,
    ensureInventory, lowStockItems, DEFAULT_INVENTORY, DEFAULT_DISTRIBUTIONS_LOG,
    INV_CATEGORIES, CAT_COLOR, RELIEF_TABS, invDetailModal };
})();
