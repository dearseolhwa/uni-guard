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
        lat: 16.0552, lng: 120.2238,
        expected_start: new Date(Date.now() - 3 * 3600000).toISOString(),
        expected_end:   new Date(Date.now() + 9 * 3600000).toISOString(),
        status: 'active', citywide: false, time: '3h ago' }
    ];
  }

  if (!UG.DATA.roadStatus) {
    UG.DATA.roadStatus = [
      { id: 'RS-01', road_name: 'Aguila Rd',         barangay: 'Poblacion',         status: 'caution',  note: 'Single lane alternating while clearing is in progress', lat: 16.033513, lng: 120.231519 },
      { id: 'RS-02', road_name: 'Coastal Rd',        barangay: 'Pangapisan North',  status: 'blocked',  note: 'Closed in both directions until drainage repair completes', lat: 16.0552,    lng: 120.2238 },
      { id: 'RS-03', road_name: 'M. Palarca St',     barangay: 'Poblacion',         status: 'passable',note: 'No reported issues', lat: 16.0206,    lng: 120.2306 },
      { id: 'RS-04', road_name: 'Domalandan Access', barangay: 'Domalandan West',   status: 'passable',note: 'Cleared by the barangay team', lat: 16.0418, lng: 120.2065 }
    ];
  }

  function fmt(iso) {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (isNaN(t)) return '';
    return new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function statusBadge(s) {
    const map = {
      passable: ['open', 'Passable', 'var(--ug-prepared)'],
      caution:  ['warning', 'Caution', 'var(--ug-warning)'],
      blocked:  ['closed', 'Blocked', 'var(--ug-emergency)']
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
      '<h2 style="font-size:19px;margin-top:3px">Road Work & Road Status</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Active road work posts from the LGU and the live road-status overlay. Tap a road-closed marker on the map to see why.</p></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Active Road Work</h3><span class="ug-chip is-on">' + list.length + ' posts</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:11px">' + (list.length ? list.map((r) =>
          '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
            '<span style="color:var(--ug-warning);display:flex">' + I('road', 18) + '</span>' +
            '<div style="min-width:0;flex:1"><div style="font-size:12.5px;font-weight:600">' + esc(r.title) + '</div>' +
              '<div class="ug-dim" style="font-size:11.5px;line-height:1.5;margin-top:3px">' + esc(r.description) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span>' +
                '<span>' + I('clock', 12) + (r.expected_end ? 'Until ' + fmt(r.expected_end) : 'Until further notice') + '</span></div></div></div>').join('') :
          '<div class="ug-empty"><span class="e-ico">' + I('road', 20) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No Active Road Work</div>' +
          '<div class="ug-dim" style="font-size:11px">The road is clear municipality-wide.</div></div>') + '</div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Road Status</h3>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'map' })) + '>' + I('map', 14) + 'Open Map</button></div>' +
        '<div class="ug-rows">' + roadStatus.map((r) =>
          '<div class="ug-row"><span class="r-dot" style="background:' + (r.status === 'passable' ? 'var(--ug-prepared)' : r.status === 'blocked' ? 'var(--ug-emergency)' : 'var(--ug-warning)') + '"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(r.road_name) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span>' +
              '<span>' + esc(r.note || '') + '</span></div></div>' +
            statusBadge(r.status) + '</div>').join('') + '</div></div>' +
    '</div>';
  }

  /* --------------------------------------------------------------- LGU */
  function dRoadwork(st) {
    const d = st.roadDraft || { title: '', description: '', barangay: UG_GEO.PLACE.areaAll, road_name: '', address: '', lat: '', lng: '', expected_hours: 6, citywide: false };
    const brgys = U.DATA.barangays;
    return '<div class="ug-col" style="gap:18px">' +
      head('Road Work Posts', 'Publish a road work notice. Residents of the affected barangay get a push notification.',
        '<span class="ug-chip is-on">' + (UG.DATA.roadWork || []).filter((r) => r.status === 'active').length + ' active</span>') +

      '<div class="ug-card ug-tick"><div class="ug-card-h"><h3>New Road Work Post</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:0">' +
          '<div class="ug-field"><label class="ug-lab">Title</label>' +
            '<input class="ug-in" data-field="rwTitle" value="' + esc(d.title || '') + '" placeholder="e.g. Road clearing: Aguila Rd"></div>' +
          '<div class="ug-field"><label class="ug-lab">Description</label>' +
            '<textarea class="ug-ta" rows="3" data-field="rwDescription" placeholder="What is happening, what lane is closed, any detour to recommend.">' + esc(d.description || '') + '</textarea></div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Barangay</label>' +
              '<select class="ug-sel" data-field="rwBarangay">' +
              [UG_GEO.PLACE.areaAll].concat(brgys).map((b) => '<option' + (d.barangay === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Road name</label>' +
              '<input class="ug-in" data-field="rwRoad" value="' + esc(d.road_name || '') + '" placeholder="Aguila Rd"></div>' +
          '</div>' +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Latitude</label>' +
              '<input class="ug-in" data-field="rwLat" value="' + esc(d.lat != null ? d.lat : '') + '" placeholder="16.0206" inputmode="decimal"></div>' +
            '<div class="ug-field" style="flex:1"><label class="ug-lab">Longitude</label>' +
              '<input class="ug-in" data-field="rwLng" value="' + esc(d.lng != null ? d.lng : '') + '" placeholder="120.2306" inputmode="decimal"></div>' +
            '<button class="ug-btn ug-btn--ghost" style="align-self:flex-end"' + A('rw-locate') + '>' + I('pin', 15) + 'My Location</button>' +
          '</div>' +
          '<div class="ug-field"><label class="ug-lab">Expected duration (hours)</label>' +
            '<input class="ug-in" data-field="rwHours" value="' + esc(d.expected_hours != null ? d.expected_hours : 6) + '" inputmode="numeric"></div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px">' +
            '<button class="ug-btn ug-btn--signal"' + A('rw-publish') + '>' + I('megaphone', 16) + 'Publish & Notify</button>' +
            '<button class="ug-btn ug-btn--ghost"' + A('rw-clear') + '>Clear</button>' +
          '</div>' +
        '</div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Road Status Overlay</h3>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('rs-add') + '>' + I('plus', 14) + 'Add Road Status</button></div>' +
        '<div class="ug-rows ug-scroll" style="max-height:280px">' + (UG.DATA.roadStatus || []).map((r) =>
          '<div class="ug-row"><span class="r-dot" style="background:' + (r.status === 'passable' ? 'var(--ug-prepared)' : r.status === 'blocked' ? 'var(--ug-emergency)' : 'var(--ug-warning)') + '"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(r.road_name) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span><span>' + esc(r.note || '') + '</span></div></div>' +
            statusBadge(r.status) +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="rs-cycle" data-id="' + esc(r.id) + '">' + I('sort', 14) + '</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="rs-del" data-id="' + esc(r.id) + '">' + I('x', 14) + '</button>' +
          '</div>').join('') + '</div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Recent Posts</h3></div>' +
        '<div class="ug-rows">' + (UG.DATA.roadWork || []).slice(0, 8).map((r) =>
          '<div class="ug-row"><span class="r-dot" style="background:' + (r.status === 'active' ? 'var(--ug-warning)' : 'var(--ug-ink-3)') + '"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(r.title) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(r.barangay) + '</span><span>' + I('clock', 12) + (r.expected_end ? 'Until ' + fmt(r.expected_end) : '') + '</span></div></div>' +
            U.badge(r.status === 'active' ? 'warning' : 'id', r.status) + '</div>').join('') + '</div></div>' +
    '</div>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mRoadwork, dRoadwork, statusBadge, fmt, head };
})();
