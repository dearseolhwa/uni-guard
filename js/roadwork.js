/* UniGuard · Road Work notifications + Road Status overlay
 *
 * Citizen UI + LGU composer for the road_work_posts table (migration 012),
 * plus the road_status overlay used by the map (migration 017).
 *
 * LGU staff create a post (location, description, expected duration) which
 * fans out a notification to every resident of the affected barangay (or
 * municipality-wide if the post is citywide).
 */
const UG_ROADWORK = (function () {
  const esc = UG_UTIL.esc, I = UG.icon, U = UG;
  const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');

  if (!UG.DATA.roadWork) {
    UG.DATA.roadWork = [
      { id: 'RW-01', title: 'Road clearing: Aguila Rd',
        description: 'Tree debris removal along Aguila Rd between the Provincial Capitol and the public market. Single lane alternates.',
        barangay: 'Poblacion', road_name: 'Aguila Rd', address: 'Aguila Rd, Poblacion, Lingayen',
        lat: 16.033513, lng: 120.231519,
        expected_start: new Date(Date.now() - 3600000).toISOString(),
        expected_end:   new Date(Date.now() + 5 * 3600000).toISOString(),
        status: 'active', citywide: false, time: '1h ago' },
      { id: 'RW-02', title: 'Drainage repair: Coastal Rd',
        description: 'Open drainage culvert being replaced. Expect closures on the inner lane through the working day.',
        barangay: 'Pangapisan North', road_name: 'Coastal Rd', address: 'Coastal Rd, Pangapisan North',
        lat: 16.0390, lng: 120.2080,
        expected_start: new Date(Date.now() - 3 * 3600000).toISOString(),
        expected_end:   new Date(Date.now() + 9 * 3600000).toISOString(),
        status: 'active', citywide: false, time: '3h ago' }
    ];
  }

  if (!UG.DATA.roadStatus) {
    UG.DATA.roadStatus = [
      /* coordinates polygon-verified against the PSA barangay boundaries
         (migration 053): Coastal Rd sits on the Pangapisan North shore, and
         Domalandan Access is inside Domalandan West, not 4 km north-east. */
      { id: 'RS-01', road_name: 'Aguila Rd',         barangay: 'Poblacion',         status: 'caution',  note: 'Single lane alternating while clearing is in progress', lat: 16.033513, lng: 120.231519 },
      { id: 'RS-02', road_name: 'Coastal Rd',        barangay: 'Pangapisan North',  status: 'blocked',  note: 'Closed in both directions until drainage repair completes', lat: 16.0390,    lng: 120.2080 },
      { id: 'RS-03', road_name: 'M. Palarca St',     barangay: 'Poblacion',         status: 'passable',note: 'No reported issues', lat: 16.0206,    lng: 120.2306 },
      { id: 'RS-04', road_name: 'Domalandan Access', barangay: 'Domalandan West',   status: 'passable',note: 'Cleared by the barangay team', lat: 16.0075, lng: 120.1855 }
    ];
  }

  function fmt(iso) {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (isNaN(t)) return '';
    return new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function statusBadge(s) {
    /* Open / One lane / Closed / Under repair (migration 031 keys); the legacy
       keys keep rendering. Labels come from one map so the cards, filters and
       map popup never disagree. */
    const map = {
      passable:     ['open', 'Open', 'var(--ug-prepared)'],
      one_lane:     ['warning', 'One lane', 'var(--ug-warning)'],
      caution:      ['warning', 'One lane', 'var(--ug-warning)'],
      blocked:      ['closed', 'Closed', 'var(--ug-emergency)'],
      under_repair: ['id', 'Under repair', 'var(--ug-signal)']
    };
    const m = map[s] || map.passable;
    return '<span class="ug-badge ug-badge--' + m[0] + '">' + m[1] + '</span>';
  }

  /* --------------------------------------------------------------- citizen */
  function mRoadwork(st) {
    const list = (UG.DATA.roadWork || []).filter((r) => r.status === 'active');
    const roadStatus = UG.DATA.roadStatus || [];
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Road Conditions</div>' +
      '<h2 style="font-size:18px;margin-top:3px">Road Work & Road Status</h2>' +
      '</div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Active Road Work</h3><span class="ug-chip is-on">' + list.length + ' posts</span></div>' +
        /* each post opens its details (roadWorkModal) */
        '<div class="ug-card-b ug-col" style="gap:11px">' + (list.length ? list.map((r) =>
          '<button class="ug-rowf ug-gap10 rwk-row" data-act="open-roadwork" data-id="' + esc(r.id) + '">' +
            '<span style="color:var(--ug-warning);display:flex">' + I('road', 18) + '</span>' +
            '<div style="min-width:0;flex:1"><div style="font-size:13px;font-weight:600">' + esc(r.title) + '</div>' +
              '<div class="ug-dim" style="font-size:12px;line-height:1.5;margin-top:3px">' + esc(r.description) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span>' +
                '<span>' + I('clock', 12) + (r.expected_end ? 'Until ' + fmt(r.expected_end) : 'Until further notice') + '</span></div></div>' +
            '<span class="ug-dimmer" style="display:flex;align-self:center">' + I('chevron', 16) + '</span></button>').join('') :
          '<div class="ug-empty"><span class="e-ico">' + I('road', 20) + '</span>' +
          '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No Active Road Work</div>' +
          '<div class="ug-dim" style="font-size:11px">The road is clear municipality-wide.</div></div>') + '</div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Road Status</h3>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'map' })) + '>' + I('map', 14) + 'Open Map</button></div>' +
        '<div class="ug-rows">' + roadStatus.map((r) =>
          '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer" data-act="open-road-detail" data-id="' + esc(r.id) + '"><span class="r-dot" style="background:' + (r.status === 'passable' ? 'var(--ug-prepared)' : r.status === 'blocked' ? 'var(--ug-emergency)' : 'var(--ug-warning)') + '"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(r.road_name) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span>' +
              '<span>' + esc((r.cause ? r.cause + ' · ' : '') + (r.note || '')) + '</span></div></div>' +
            statusBadge(r.status) + '</button>').join('') + '</div></div>' +
    '</div>';
  }

  /* the road status / road work detail view (full record). Reused by both the
     citizen mRoadwork screen and the LGU dRoadwork screen so the same level of
     detail is shown everywhere (Section 8). Barangay officials and LGU staff
     get an Edit button in the footer; everyone else only sees Close. */
  function roadDetailModal(id, st) {
    const r = (UG.DATA.roadStatus || []).find((x) => x.id === id);
    if (!r) return;
    const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600">' + esc(v == null || v === '' ? '—' : v) + '</span></div>';
    const sess = (st && st.session) || (window.UG_App && UG_App.S && UG_App.S.session) || null;
    const isStaff = !!(sess && (sess.role === 'barangay_official' || sess.role === 'lgu_ldrrmc'));
    UG_FEATURES.modal({
      title: r.road_name || 'Road status',
      body:
        '<div style="margin-bottom:10px">' + statusBadge(r.status) + '</div>' +
        kv('Road name', r.road_name) +
        kv('Barangay', r.barangay || '—') +
        kv('Segment', (r.segment_from || r.segment_to) ? (r.segment_from || '—') + '  →  ' + (r.segment_to || '—') : '—') +
        kv('Cause', r.cause) +
        kv('Severity', r.severity) +
        kv('Started', r.started_at ? fmt(r.started_at) : '—') +
        kv('Estimated reopening', r.estimated_reopen ? fmt(r.estimated_reopen) : '—') +
        kv('Last updated', (r.updated_at ? fmt(r.updated_at) : '—') + (r.updater_name ? ' · ' + r.updater_name : '')) +
        (r.note ? kv('Notes', r.note) : '') +
        kv('Coordinates', (typeof r.lat === 'number' && typeof r.lng === 'number') ? UG_GEO.fmt(r.lat, r.lng) : '—') +
        ((typeof r.lat === 'number' && typeof r.lng === 'number' && UG_GEO.canNavigate(r.lat, r.lng))
          ? '<a class="ug-waze-btn" style="margin-top:12px;display:inline-flex" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(r.lat, r.lng) + '">' + I('route', 13) + ' Open in Waze</a>' : ''),
      footer:
        '<button class="ug-btn" data-modal-close>Close</button>' +
        (isStaff ? '<button class="ug-btn ug-btn--signal" data-act="rs-edit" data-id="' + esc(r.id) + '">' + I('settings', 13) + 'Edit</button>' : '')
    });
  }

  /* one road work post (from the list or a notification) */
  function roadWorkModal(id) {
    const r = (UG.DATA.roadWork || []).find((x) => String(x.id) === String(id));
    if (!r) return false;
    const kv = (k, v) => v ? '<div class="ug-rowf ug-between" style="gap:12px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600">' + esc(v) + '</span></div>' : '';
    const pos = typeof r.lat === 'number' && typeof r.lng === 'number' && UG_GEO.canNavigate(r.lat, r.lng);
    UG_FEATURES.modal({
      title: r.title || 'Road work',
      body:
        (r.description ? '<p style="margin:0 0 12px;font-size:13px;line-height:1.55">' + esc(r.description) + '</p>' : '') +
        kv('Road', r.road_name) +
        kv('Where', r.citywide ? 'Municipality-wide' : [r.barangay, r.address].filter(Boolean).join(' · ')) +
        kv('Starts', r.expected_start ? fmt(r.expected_start) : '') +
        kv('Until', r.expected_end ? fmt(r.expected_end) : 'Until further notice') +
        (pos ? '<a class="ug-waze-btn" style="margin-top:12px;display:inline-flex" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(r.lat, r.lng) + '">' + I('route', 13) + ' Open in Waze</a>' : ''),
      footer: '<button class="ug-btn" data-modal-close>Close</button>'
    });
    return true;
  }

  /* --------------------------------------------------------------- LGU */
  function dRoadwork(st) {
    const d = st.roadDraft || { title: '', description: '', barangay: UG_GEO.PLACE.areaAll, road_name: '', address: '', lat: '', lng: '', expected_hours: 6, citywide: false };
    const own = st.session?.role === 'barangay_official';
    const brgys = own ? [st.session.barangay || 'Barangay assignment needed'] : [UG_GEO.PLACE.areaAll, ...U.DATA.barangays];
    /* road-status search filter: matches road_name, barangay, cause or note. */
    const rsQ = (st.rsSearch || '').trim().toLowerCase();
    const filteredStatus = (UG.DATA.roadStatus || []).filter((r) => {
      if (!rsQ) return true;
      return (r.road_name || '').toLowerCase().indexOf(rsQ) >= 0 ||
             (r.barangay || '').toLowerCase().indexOf(rsQ) >= 0 ||
             (r.cause || '').toLowerCase().indexOf(rsQ) >= 0 ||
             (r.note || '').toLowerCase().indexOf(rsQ) >= 0;
    });
    return '<div class="ug-col" style="gap:18px">' +
      head(T('title.roadwork'), T('roadwork.subtitle'),
        '<span class="ug-chip is-on">' + (UG.DATA.roadWork || []).filter((r) => r.status === 'active').length + ' ' + esc(T('label.active')) + '</span>') +

      /* New Road Work Post (Nov 2026): two groups side by side, the notice
         itself and where / how long, each field with a short hint; the
         duration is picked from quick choices (or typed) and shows when it
         ends; the footer says who is notified. Same fields and actions. */
      (function () {
        const hrs = d.expected_hours != null && !isNaN(d.expected_hours) ? Number(d.expected_hours) : 6;
        const ends = new Date(Date.now() + hrs * 3600000);
        const endsTxt = ends.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
        const hasPin = d.lat != null && d.lng != null && !isNaN(d.lat) && !isNaN(d.lng);
        const where = hasPin ? esc(UG_GEO.fmt(d.lat, d.lng)) + (d.address ? ' · ' + esc(d.address) : '') : d.address ? esc(d.address) : '';
        const area = own ? brgys[0] : d.barangay;
        const allArea = area === UG_GEO.PLACE.areaAll;
        const step = Number(st.rwStep) === 2 ? 2 : 1;
        return '<section class="rw" data-rw-step="' + step + '">' +
          '<header class="rw-h"><h3>' + I('road', 16) + esc(T('roadwork.newPost')) + '</h3><p>Fill in what is happening and where. Residents ' + (allArea ? 'across Lingayen' : 'of Barangay ' + esc(area)) + ' receive an in-app notification when you publish.</p></header>' +
          /* phones: two pages (Notice → Location & duration) */
          '<ol class="rf-stepper rw-stepper">' + [['1', 'Notice'], ['2', 'Location & duration']].map((x) =>
            '<li class="' + (Number(x[0]) <= step ? 'is-on' : '') + (Number(x[0]) === step ? ' is-cur' : '') + '"><button type="button"' + A('rw-step', attr({ v: x[0] })) + '><i></i><span>' + x[1] + '</span></button></li>').join('') + '</ol>' +
          '<div class="rw-cols">' +
            '<fieldset class="rw-g" data-g="1"><legend><b>1</b>Notice</legend>' +
              '<label class="rw-f"><span>Title <em>required</em></span><input class="ug-in" data-field="rwTitle" value="' + esc(d.title || '') + '" placeholder="e.g. Road clearing: Aguila Rd"><small>Short and specific. This is the headline residents see.</small></label>' +
              '<label class="rw-f"><span>Description</span><textarea class="ug-ta" rows="4" data-field="rwDescription" placeholder="e.g. Fallen tree being cleared. Northbound lane closed; use Avenida Rizal instead.">' + esc(d.description || '') + '</textarea><small>Say what is happening, which lane is closed and the detour to take.</small></label>' +
            '</fieldset>' +
            '<fieldset class="rw-g" data-g="2"><legend><b>2</b>Location &amp; duration</legend>' +
              '<div class="rw-two">' +
                '<label class="rw-f"><span>Barangay</span><select class="ug-sel" data-field="rwBarangay"' + (own ? ' disabled' : '') + '>' +
                  brgys.map((b) => '<option' + (area === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select><small>Decides who gets the notification.</small></label>' +
                '<label class="rw-f"><span>Road name</span><input class="ug-in" data-field="rwRoad" value="' + esc(d.road_name || '') + '" placeholder="e.g. Aguila Rd"></label>' +
              '</div>' +
              '<div class="rw-f"><span>Map pin <em>optional</em></span>' +
                '<div class="rw-pin' + (where ? ' is-set' : '') + '"><span class="rw-pin-ico">' + I('pin', 15) + '</span>' +
                  '<span class="rw-pin-t">' + (where ? '<b>' + where + '</b>' : '<b>No pin yet</b><i>Use your location, or type the street.</i>') + '</span>' +
                  '<button type="button" class="rw-chip"' + A('rw-locate') + '>' + I('target', 13) + 'My location</button>' +
                  '<button type="button" class="rw-chip"' + A('rw-manual-pin') + '>' + I('doc', 13) + 'Type address</button></div>' +
                '<small>The address is what residents read. With a map pin they also get Waze directions.</small></div>' +
              '<div class="rw-f"><span>Expected duration</span>' +
                '<div class="rw-dur"><div class="rw-dur-opts" role="radiogroup" aria-label="Expected duration">' +
                  [[2, '2 h'], [4, '4 h'], [6, '6 h'], [12, '12 h'], [24, '1 day'], [48, '2 days']].map((o) =>
                    '<button type="button" role="radio" aria-checked="' + (hrs === o[0]) + '" class="' + (hrs === o[0] ? 'is-on' : '') + '"' + A('rw-hours', attr({ v: o[0] })) + '>' + o[1] + '</button>').join('') + '</div>' +
                  '<label class="rw-dur-in"><input class="ug-in" data-field="rwHours" value="' + esc(String(hrs)) + '" inputmode="decimal" aria-label="Hours"><em>hours</em></label></div>' +
                '<small>' + I('clock', 12) + 'Ends around <b>' + esc(endsTxt) + '</b>. The post closes on its own after that.</small></div>' +
            '</fieldset>' +
          '</div>' +
          '<div class="rw-snav"><button type="button" class="ac-next"' + A('rw-step', attr({ v: '2' })) + '>Next' + I('chevron', 14) + '</button></div>' +
          '<footer class="rw-foot"><span>' + I('bell', 13) + 'Publishing sends a push notification to ' + (allArea ? 'all residents' : 'residents of Barangay ' + esc(d.barangay)) + '.</span>' +
            '<div><button class="ug-btn ug-btn--ghost rw-back"' + A('rw-step', attr({ v: '1' })) + '>Back</button><button class="ug-btn ug-btn--ghost rw-clr"' + A('rw-clear') + '>Clear</button>' +
            '<button class="ug-btn ug-btn--signal rw-go' + ((d.title || '').trim() ? ' is-ready' : '') + '"' + A('rw-publish') + '>' + I('megaphone', 15) + esc(T('action.publishNotify')) + '</button></div></footer>' +
        '</section>';
      })() +

      '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('roadwork.roadStatusOverlay')) + '</h3>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<input class="ug-in" data-field="rsSearch" placeholder="' + esc(T('action.search')) + '" style="font-size:12px;padding:6px 10px;min-width:160px" value="' + esc(st.rsSearch || '') + '">' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('rs-add') + '>' + I('plus', 14) + esc(T('roadwork.addRoadStatus')) + '</button>' +
        '</div></div>' +
        '<div class="ug-rows ug-scroll" style="max-height:380px">' + (filteredStatus.length ? filteredStatus.map((r) =>
          '<div class="ug-row" role="button" tabindex="0" style="cursor:pointer;width:100%;text-align:left;background:none" data-act="rs-detail" data-id="' + esc(r.id) + '"><span class="r-dot" style="background:' + (r.status === 'passable' ? 'var(--ug-prepared)' : r.status === 'blocked' ? 'var(--ug-emergency)' : 'var(--ug-warning)') + '"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(r.road_name) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span><span>' + esc((r.cause ? r.cause + ' · ' : '') + (r.note || '')) + '</span></div></div>' +
            statusBadge(r.status) +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="rs-edit" data-id="' + esc(r.id) + '">' + I('settings', 14) + '</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="rs-del" data-id="' + esc(r.id) + '">' + I('x', 14) + '</button>' +
          '</div>').join('') : '<div class="ug-empty"><span class="e-ico">' + I('road', 20) + '</span><div style="font-size:12px;color:var(--ug-ink-2)">No road status entries match.</div></div>') + '</div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('roadwork.recentPosts')) + '</h3></div>' +
        '<div class="ug-rows">' + (UG.DATA.roadWork || []).slice(0, 8).map((r) =>
          /* the whole row opens the post (open-roadwork: description, road, where, dates, directions) */
          '<div class="ug-row rw-post" role="button" tabindex="0" data-act="open-roadwork" data-id="' + esc(r.id) + '" aria-label="Open ' + esc(r.title || 'road work post') + '"><span class="r-dot" style="background:' + (r.status === 'active' ? 'var(--ug-warning)' : 'var(--ug-ink-3)') + '"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(r.title) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span><span>' + I('clock', 12) + (r.expected_end ? esc(T('roadwork.untilLabel')) + ' ' + fmt(r.expected_end) : '') + '</span></div></div>' +
            U.badge(r.status === 'active' ? 'warning' : 'id', r.status) + '<span class="rw-post-go" aria-hidden="true">' + I('chevron', 14) + '</span></div>').join('') + '</div></div>' +
    '</div>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap ug-phead" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mRoadwork, dRoadwork, roadDetailModal, roadWorkModal, statusBadge, fmt, head };
})();
