/* UniGuard · Relief Assistance Information
 *
 * Citizen UI + LGU management surface for the relief_distributions and
 * authorized_beneficiaries tables (migrations/011).
 *
 * Render functions are HTML-string-returning (same pattern as UG_SCREENS),
 * and every action goes through the existing `data-act` delegate in app.js.
 *
 * Data access goes through UG_RELief.Repo wrapper so the citizen UI and the
 * LGU admin share the same fetch + create + update + delete code paths.
 */
const UG_RELIEF = (function () {
  const esc = UG_UTIL.esc, I = UG.icon, U = UG;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');

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

  /* ------------------------------------------------------------- mobile UI */
  function mRelief(st) {
    const barangays = ['All'].concat(U.DATA.barangays);
    const f = st.reliefFilter || 'All';
    const list = U.DATA.relief.filter((r) => r.active !== false).filter((r) => f === 'All' || r.barangay === f);
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Relief Assistance Information</div>' +
      '<h2 style="font-size:19px;margin-top:3px">Relief Distribution</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Per-barangay relief schedules, eligibility, required documents, and the authorized-beneficiary list. Filter by your barangay.</p></div>' +

      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + barangays.map((b) =>
        '<button class="ug-chip' + (f === b ? ' is-on' : '') + '"' + A('relief-filter', attr({ v: b })) + '>' + esc(b) + '</button>').join('') + '</div>' +

      (list.length ? list.map((r) => reliefCard(r)).join('') :
        '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('info', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No Active Distribution for ' + esc(f) + '</div>' +
        '<div class="ug-dim" style="font-size:11px">Check another barangay or contact your barangay desk.</div></div></div>') +

      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-signal);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-note">If you are claiming on behalf of a named beneficiary, the distribution desk will check you against the authorized-names list. Search it from any distribution card below.</div></div></div>' +
    '</div>';
  }

  function reliefCard(r) {
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
          '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('relief-verify', attr({ id: r.id })) + '>' + I('users', 14) + 'Verify Beneficiary</button>' +
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

  /* ------------------------------------------------------------- LGU admin */
  function dRelief(st) {
    const barangays = U.DATA.barangays;
    const rows = U.DATA.relief || [];
    return '<div class="ug-col" style="gap:18px">' +
      head('Relief Assistance', 'Manage per-barangay distribution schedules, eligibility, required documents and the authorized-beneficiary list.',
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('relief-add') + '>' + I('plus', 15) + 'Add Distribution</button>') +
      '<div class="ug-card"><div class="ug-card-h"><h3>Active Distributions</h3><span class="ug-chip is-on">' + rows.length + ' records</span></div>' +
        '<div class="ug-rows ug-scroll" style="max-height:330px">' + rows.map((r) =>
          '<div class="ug-row"><span class="r-dot" style="background:var(--ug-prepared)"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(r.title) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span>' +
              '<span>' + I('clock', 12) + esc(fmtDate(r.distribution_at)) + '</span>' +
              '<span class="ug-mono">' + esc(r.contact_phone) + '</span></div></div>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="relief-edit" data-id="' + esc(r.id) + '">' + I('settings', 14) + 'Edit</button></div>').join('') + '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>Authorized Beneficiaries</h3>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('beneficiary-add') + '>' + I('plus', 14) + 'Add</button></div>' +
        '<div class="ug-card-b"><div class="ug-rowf ug-gap10 ug-wrap" style="gap:10px;align-items:flex-end">' +
          '<div class="ug-field" style="flex:1;min-width:200px;margin:0"><label class="ug-lab">Filter by barangay</label>' +
            '<select class="ug-sel" data-field="benBarangayFilter">' +
            ['All'].concat(barangays).map((b) => '<option' + (st.benBarangayFilter === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select></div>' +
          '<div class="ug-field" style="flex:1;min-width:200px;margin:0"><label class="ug-lab">Search</label>' +
            '<input class="ug-in" data-field="benSearchLgu" placeholder="Name or ID" value="' + esc(st.benSearchLgu || '') + '"></div>' +
        '</div></div>' +
        '<div class="ug-rows ug-scroll" style="max-height:280px;margin-top:6px">' +
          (UG.DATA.beneficiaries || []).filter((b) => (!st.benBarangayFilter || st.benBarangayFilter === 'All' || b.barangay === st.benBarangayFilter))
            .filter((b) => !((st.benSearchLgu || '').trim()) ||
              (b.beneficiary_name || '').toLowerCase().indexOf(st.benSearchLgu.toLowerCase()) >= 0 ||
              (b.claimant_name || '').toLowerCase().indexOf(st.benSearchLgu.toLowerCase()) >= 0 ||
              (b.claimant_id || '').toLowerCase().indexOf(st.benSearchLgu.toLowerCase()) >= 0)
            .map((b) => '<div class="ug-row"><span class="r-dot" style="background:var(--ug-advisory)"></span>' +
              '<div class="r-main"><div class="r-t">' + esc(b.beneficiary_name) + '</div>' +
                '<div class="r-m"><span>' + esc(b.barangay) + '</span>' +
                '<span>Claimant: ' + esc(b.claimant_name) + '</span>' +
                '<span class="ug-mono">' + esc(b.claimant_id) + '</span></div></div>' +
              '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="beneficiary-del" data-id="' + esc(b.id) + '">' + I('x', 13) + '</button></div>').join('') +
        '</div></div>' +
    '</div>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mRelief, mReliefVerify, dRelief, fmtDate, head };
})();
