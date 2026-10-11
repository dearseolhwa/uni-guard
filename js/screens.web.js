/* UniGuard citizen web shell: role definitions and the desktop citizen layout. */

const UG_WEB = (() => {
  const U = UG, I = U.icon, esc = U.esc;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');

  /* local field builders: these belong to this module, the account screens have their own */
  function selectField(id, label, options, value, help) {
    return '<div class="ug-field" style="margin-bottom:14px"><label class="ug-lab">' + esc(label) + '</label>' +
      '<select class="ug-sel" data-field="' + id + '" aria-label="' + esc(label) + '">' +
      options.map((o) => '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') +
      '</select>' + (help ? '<div class="ug-help">' + esc(help) + '</div>' : '') + '</div>';
  }

  /* role definitions: role decides where the account lands after sign in */
  const ROLE_INFO = {
    citizen:           { key:'citizen',           label:'Citizen',            area:'citizen', home:'home',      scope:(b) => 'Barangay ' + (b || UG_GEO.BARANGAYS[0]) },
    barangay_official: { key:'barangay_official', label:'Barangay Official', area:'console', home:'dashboard',
  scope:(b) => b ? 'Barangay ' + b : 'No barangay assigned' },
    lgu_ldrrmc:        { key:'lgu_ldrrmc',        label:'LGU / MDRRMO',       area:'console', home:'dashboard', scope:() => UG_GEO.PLACE.scope },
    dispatch_team:     { key:'dispatch_team',     label:'Dispatch Team',     area:'dispatch', home:'dispatch',
  scope:(b, p) => 'Municipality-wide ' + (p && p.unit_role ? p.unit_role + ' · ' : '') + (p && p.dispatch_unit_id ? p.dispatch_unit_id.slice(0, 8) : 'unit') },
  };
  const ROLES = ['citizen', 'barangay_official', 'lgu_ldrrmc', 'dispatch_team'];

  /* ------------------------------------------------------------------ */
  /* CITIZEN DESKTOP (WEB) SHELL                                         */
  /* ------------------------------------------------------------------ */
  const CNAV = [
    ['home', 'Home', 'home'],
    ['report', 'Report a Hazard', 'plus'],
    ['relief', 'Relief', 'relief'],
    ['advisories', 'Advisories', 'megaphone'],
    ['map', 'Hazard Map', 'map'],
    ['guides', 'Guides', 'guide'],
    ['faqs', 'FAQs', 'faq'],
    ['centers', 'Shelters', 'shelter'],
    ['hotlines', 'Hotlines', 'phone'],
    ['notifications', 'Notifications', 'bell'],
  ];

  function cwTop(st) {
    const s = st.session;
    /* the badge on the bell now reads the actual unread count from UG.DATA
       instead of the old fixed "2". */
    const unread = (U.DATA.notifications || []).filter(n => n.unread).length;
    const active = st.route === 'advisory-detail' ? 'advisories'
      : (st.route === 'report-detail' ? 'notifications' : st.route);
    /* Sign Out is the LAST item after the nav, SOS, name and avatar, so extra
       items can never push it off-screen. Secondary destinations (FAQs,
       Guides, Hotlines, Offline) collapse into a "More" dropdown so the SOS
       button, user menu and Sign Out stay visible at 1280 / 1366 / 1440 px
       and on mobile at 100% zoom with no horizontal scroll. */
    const primary = [['home', 'Home', 'home'], ['report', 'Report a Hazard', 'plus'], ['relief', 'Relief', 'relief'], ['advisories', 'Advisories', 'megaphone'], ['map', 'Hazard Map', 'map'], ['centers', 'Shelters', 'shelter'], ['notifications', 'Notifications', 'bell']];
    const secondary = [['guides', 'Guides', 'guide'], ['faqs', 'FAQs', 'faq'], ['hotlines', 'Hotlines', 'phone'], ['offline', 'Offline', 'download']];
    const navBtn = (n) =>
      '<button class="ug-wnav-i' + (active === n[0] ? ' is-on' : '') + '"' + A('nav', attr({ route: n[0] })) + '>' +
      I(n[2], 16) + n[1] + (n[0] === 'notifications' && unread ? '<span class="ug-wdot' + (unread > 9 ? ' is-many' : '') + '">' + (unread > 9 ? '9+' : unread) + '</span>' : '') + '</button>';
    return '<header class="ug-wtop">' +
      '<button class="ug-brand ug-brand-btn"' + A('nav', attr({ route: 'home' })) + ' aria-label="Go to the home screen">' + U.brandMark(32) +
        '<span class="ug-col" style="gap:0"><span class="ug-wordmark" style="font-size:16px">Uni<em>Guard</em></span>' +
        '<span class="ug-dimmer" style="font-size:9px;letter-spacing:.11em;text-transform:uppercase">Resident portal</span></span></button>' +
      '<nav class="ug-wnav">' + primary.map(navBtn).join('') +
        '<span class="ug-wmore">' +
          '<button class="ug-wnav-i" aria-haspopup="true"' + A('toggle-more') + '>' + I('grid', 16) + 'More' + I('chevron', 12) + '</button>' +
          '<span class="ug-wmore-panel" data-more-panel hidden>' + secondary.map((n) =>
            '<button class="ug-wmore-item' + (active === n[0] ? ' is-on' : '') + '"' + A('nav', attr({ route: n[0] })) + '>' + I(n[2], 15) + n[1] + '</button>').join('') + '</span>' +
        '</span>' +
      '</nav>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px;margin-left:auto">' +
        '<button class="ug-btn ug-btn--danger ug-btn--sm" aria-label="Send SOS"' + A('sos-trigger') + '>' + I('alert', 16) + 'SOS</button>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding-left:8px;border-left:1px solid var(--ug-line);margin-left:2px">' +
          '<span class="ug-col" style="gap:0;align-items:flex-end"><span style="font-size:12px;font-weight:600">' + esc(s.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(s.scope) + '</span></span>' +
          '<span class="ug-av">' + esc(s.initials) + '</span>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" aria-label="Sign out"' + A('logout') + '>' + I('logout', 16) + '<span class="ug-signout-lab">Sign Out</span></button>' +
        '</div>' +
      '</div>' +
    '</header>';
  }

  function cwMore(st) {
    return '<div class="ug-col" style="gap:14px">' +
      cwHead('More', 'Guides, FAQs, hotlines and offline readiness.') +
      '<div class="ug-wgrid-3">' +
        [['guides', 'Preparedness Guides', 'guide', 'What to do before, during and after every hazard.'],
         ['faqs', 'FAQs', 'faq', 'Answers about reports, relief, shelters and SOS.'],
         ['hotlines', 'Hotlines', 'phone', 'The official emergency numbers, cached offline.'],
         ['offline', 'Offline readiness', 'download', 'What works without a connection and how syncing behaves.'],
         ['notifications', 'Notifications', 'bell', 'Every push alert delivered to this device.'],
         ['map', 'Hazard Map', 'map', 'The live map with every overlay layer.']]
          .map((x) => '<button class="ug-card" style="text-align:left;cursor:pointer"' + A('nav', attr({ route: x[0] })) + '>' +
            '<div class="ug-card-b ug-col" style="gap:8px"><span style="color:var(--ug-signal);display:flex">' + I(x[2], 20) + '</span>' +
            '<div><div style="font-size:13px;font-weight:700">' + esc(x[1]) + '</div>' +
            '<div class="ug-dimmer" style="font-size:11px">' + esc(x[3]) + '</div></div></div></button>').join('') +
      '</div></div>';
  }

  function cwHead(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  const readout = (v, l, tone) =>
    '<div class="ug-col" style="gap:3px;padding:14px 16px;background:var(--ug-surface);border:1px solid var(--ug-line);border-radius:14px">' +
      '<span class="ug-mono" style="font-size:22px;font-weight:600;color:' + tone + '">' + v + '</span>' +
      '<span class="ug-dimmer" style="font-size:10px;letter-spacing:.05em;text-transform:uppercase">' + l + '</span></div>';

  function cwHome(st) {
    const top = U.DATA.advisories[0];
    const mine = U.DATA.incidents.filter(i => i.mine);
    const openCenters = U.DATA.centers.filter(c => c.status === 'open');
    /* live figures: open reports in the citizen's barangay come from the store
       the repository keeps hydrated — no static placeholder values */
    const myBrgy = (st.session && st.session.barangay) || UG_GEO.BARANGAYS[0];
    const inMyBrgy = U.DATA.incidents.filter(i => i.brgy === myBrgy && i.status !== 'resolved' && i.status !== 'rejected').length;
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Home', 'Live situation for Barangay ' + esc(myBrgy) + ', ' + esc(UG_GEO.PLACE.label) + '.',
        '<button class="ug-btn ug-btn--signal"' + A('nav', attr({ route: 'report' })) + '>' + I('plus', 16) + 'Report a Hazard</button>') +
      '<div class="ug-wgrid-3">' +
        readout(String(inMyBrgy), 'Open in your barangay', 'var(--ug-warning)') +
        readout(String(U.DATA.advisories.filter(a => a.severity !== 'prepared').length), 'Active advisories', 'var(--ug-advisory)') +
        readout(String(openCenters.length), 'Shelters open', 'var(--ug-prepared)') +
      '</div>' +
      '<div class="ug-wgrid-main">' +
        '<div class="ug-col" style="gap:18px;min-width:0">' +
          '<div class="ug-banner" style="height:120px;background:linear-gradient(135deg,' + U.SEV[top.severity].color + '40,#0C1524)">' + U.thumb('surge', 'bn-img') +
            '<div class="bn-in">' +
              '<div class="ug-rowf ug-gap8" style="gap:6px">' + U.sevBadge(top.severity) + U.badge('id', 'Push alert') + '</div>' +
              '<h3 style="font-size:17px;line-height:1.3">' + esc(top.title) + '</h3>' +
              '<div class="ug-dimmer ug-rowf" style="font-size:11px;gap:8px">' + I('pin', 13) + esc(top.area) + ' &middot; ' + esc(top.time) + '</div>' +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Your Reports</h3>' +
  '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'reports' })) + '>View All</button></div>' +
  '<div class="ug-rows">' + (mine.length ? mine.slice(0, 3).map(i =>
    '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-report', attr({ id: i.id })) + '>' + U.photo(i) +
      '<div class="r-main"><div class="r-t">' + U.ladder(i.sev) + esc(i.hazard) + '</div>' +
        '<div class="r-m"><span class="ug-mono">' + esc(i.id) + '</span><span>' + I('clock', 12) + esc(i.time) + '</span>' +
        '<span>' + I('pin', 12) + esc(i.brgy) + '</span></div></div>' +
      U.stageBadge(i.status) + '</button>').join('')
    : '<div class="ug-empty"><span class="e-ico">' + I('inbox', 20) + '</span>' +
      '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">You have not filed a report yet</div></div>') +
  '</div></div>' +

'<div class="ug-card"><div class="ug-card-h"><h3>Reported Near You</h3>' +
  '<span class="ug-dimmer" style="font-size:10.5px">Confirm a hazard if you can see it too</span></div>' +
  '<div class="ug-rows">' + (U.DATA.incidents.filter(i => !i.mine && i.status !== 'resolved' && i.status !== 'rejected').slice(0, 3).map(i =>
    '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-report', attr({ id: i.id })) + '>' + U.photo(i) +
      '<div class="r-main"><div class="r-t">' + U.ladder(i.sev) + esc(i.hazard) + '</div>' +
        '<div class="r-m"><span>' + I('clock', 12) + esc(i.time) + '</span><span>' + I('pin', 12) + esc(i.brgy) + '</span>' +
        '<span>' + I('shield', 12) + i.corr + '/3</span></div></div>' +
      U.stageBadge(i.status) + '</button>').join('') ||
    '<div class="ug-empty"><div style="font-size:12px" class="ug-dim">No other open reports in your barangay.</div></div>') +
  '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Advisories and Alerts</h3>' +
  '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'advisories' })) + '>View All</button></div>' +
  '<div class="ug-rows">' + U.DATA.advisories.slice(0, 3).map(a =>
              '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-advisory', attr({ id: a.id })) + '>' +
                '<span class="r-dot" style="background:' + U.SEV[a.severity].color + '"></span>' +
                '<div class="r-main"><div class="r-t" style="font-size:12.5px">' + esc(a.title) + '</div>' +
                '<div class="r-m"><span>' + I('pin', 12) + esc(a.area) + '</span><span>' + esc(a.type) + '</span><span>' + esc(a.time) + '</span></div></div>' +
                U.sevBadge(a.severity) + '</button>').join('') + '</div></div>' +
        '</div>' +
        '<div class="ug-col" style="gap:18px;min-width:0">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Nearest Open Shelters</h3>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'centers' })) + '>All Shelters</button></div>' +
            '<div class="ug-rows">' + openCenters.slice(0, 3).map(c =>
              '<div class="ug-row"><span class="r-dot" style="background:var(--ug-prepared)"></span>' +
                '<div class="r-main"><div class="r-t" style="font-size:12.5px">' + esc(c.name) + '</div>' +
                  '<div class="r-m"><span>' + I('pin', 12) + esc(c.brgy) + '</span><span>' + I('users', 12) + c.occ + ' / ' + c.cap + '</span></div></div>' +
                U.badge('open', 'Open') + '</div>').join('') + '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Emergency Hotlines</h3>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'hotlines' })) + '>View All</button></div>' +
            '<div class="ug-rows">' + U.DATA.hotlines.slice(0, 4).map(h =>
              '<div class="ug-row" style="padding:10px 16px"><div class="r-main">' +
                '<div class="r-t" style="font-size:12px">' + esc(h.agency) + '</div>' +
                '<div class="ug-mono" style="font-size:12.5px;color:var(--ug-signal);margin-top:2px">' + esc(h.number) + '</div></div>' +
                '<button class="ug-btn ug-btn--sm"' + A('call', attr({ num: h.number, agency: h.agency })) + '>' + I('phone', 13) + '</button></div>').join('') + '</div></div>' +
          '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:9px">' +
            '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Offline copy</span>' +
            '<span class="ug-mono" style="color:var(--ug-prepared)">Ready</span></div>' +
            '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Last sync</span>' +
            '<span class="ug-mono">' + esc(U.DATA.offlineCache.synced) + '</span></div>' +
            '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Hotlines cached</span>' +
            '<span class="ug-mono">' + U.DATA.offlineCache.hotlines + '</span></div>' +
          '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function cwReport(st) {
    const r = st.report;
    const urg = [['advisory', 'Looks Minor'], ['warning', 'Getting Worse'], ['emergency', 'People at Risk']];
    return '<div class="ug-col" style="gap:18px">' +
      cwHead(st.editing ? 'Edit Your Report' : 'Report a Hazard', st.editing ? 'Corrections stay within the same rules as filing — the change is audit-logged.' : 'Multi-Hazard Reporting. Your report reaches your barangay queue with its timestamp and position.',
        st.editing
          ? '<button class="ug-btn ug-btn--ghost"' + A('cancel-edit') + '>Cancel edit</button>'
          : '<button class="ug-btn ug-btn--ghost"' + A('nav', attr({ route: 'home' })) + '>Cancel</button>') +
      '<div class="ug-wgrid-form">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Hazard Details</h3><span class="ug-dimmer" style="font-size:10.5px">Step 1 of 2</span></div>' +
          '<div class="ug-card-b">' +
            '<div class="ug-wgrid-2">' +
              selectField('hazard', 'Hazard Type', U.DATA.hazards.map(h => [h, h]), r.hazard) +
              selectField('brgy', 'Barangay Jurisdiction', U.DATA.barangays.map(b => [b, b]), r.brgy) +
            '</div>' +
            (UG_HAZARDS.classify(r.hazard).key === 'other'
              ? '<div class="ug-field"><label class="ug-lab">Tell Us What the Hazard Is</label>' +
                '<input class="ug-in" data-field="hazardOther" placeholder="e.g. downed utility pole" value="' + esc(r.hazardOther || '') + '">' +
                '<div class="ug-help">Required when the hazard type is "Others".</div></div>'
              : '') +
            '<div class="ug-field" style="margin-bottom:14px"><label class="ug-lab">How Urgent Does It Look</label>' +
              '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + urg.map(u =>
                '<button class="ug-chip' + (r.urg === u[0] ? ' is-on' : '') + '"' + A('set-urg', attr({ v: u[0] })) + '>' +
                U.ladder(u[0]) + u[1] + '</button>').join('') + '</div></div>' +
            '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Description and Hazard Details</label>' +
              '<textarea class="ug-ta" rows="6" data-field="desc" placeholder="Describe what you are seeing: water depth (knee or waist high), affected roads, trapped families, or nearby landmarks.">' + esc(r.desc) + '</textarea>' +
              '<div class="ug-help">Landmark references help responders find the exact spot.</div></div>' +
          '</div></div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Photo Evidence</h3><span class="ug-dimmer" style="font-size:10.5px">Optional</span></div>' +
            '<div class="ug-card-b">' +
              (r.photo
                ? '<div class="ug-rowf ug-gap12" style="gap:10px;align-items:center;border:1px solid var(--ug-line);border-radius:10px;padding:9px">' + (r.photoPreview ? '<img src="' + esc(r.photoPreview) + '" alt="Selected photo preview" style="width:62px;height:46px;border-radius:8px;object-fit:cover;flex:none;border:1px solid var(--ug-line)">' : '') +
                  '<div style="min-width:0"><div style="font-size:12px;font-weight:600">' + esc(r.photoName || 'hazard-photo.jpg') + '</div>' +
                  '<div class="ug-dimmer" style="font-size:10.5px">' + esc(UG_UTIL.bytes(r.photoBytes || 0)) + ' after compression</div></div>' +
                  '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('rm-photo') + '>Replace</button></div>'
                : '<button class="ug-upload" style="width:100%"' + A('add-photo') + '><span class="up-ico">' + I('camera', 22) + '</span>' +
                  '<span style="font-size:13px;font-weight:600">Tap to Attach a Hazard Photo</span>' +
                  '<span class="ug-dimmer" style="font-size:10.5px">JPG or PNG up to 10 MB</span></button>') +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Incident Location</h3>' + (r.gpsDenied && !r.gps ? '<span class="ug-dimmer" style="font-size:10.5px;color:var(--ug-warning)">GPS unavailable</span>' : '') + '</div>' +
            '<div class="ug-card-b">' +
              (r.gpsDenied && !r.gps
                ? '<div class="ug-note" style="margin-bottom:10px">We could not read your GPS. The location is needed to route the report to the right barangay and to verify it with nearby reports — drop the pin on the map below at the hazard spot.</div>' : '') +
              '<div class="ug-geo"><span class="geo-ico">' + I('pin', 18) + '</span>' +
              '<span style="min-width:0"><span class="geo-val">' + (r.gps && UG_GEO.isNum(r.lat) ? UG_GEO.fmt(r.lat, r.lng) : 'Not set — drop the pin on the map') + '</span>' +
              '<span class="geo-sub">' + (r.address || (r.gps ? 'Position captured' : 'Drag the pin to the hazard location')) + '</span></span>' +
              '<button class="ug-btn ug-btn--sm" style="margin-left:auto"' + A('gps') + '>' + (r.gps ? 'Refresh' : 'Acquire GPS') + '</button></div>' +
              '<div class="ug-map" data-map="report-pin" style="height:220px;margin-top:12px;border-radius:10px;overflow:hidden">' + U.mapSVG({}) + '</div>' +
              '<div class="ug-help" style="margin-top:8px">Drag the pin to the hazard. The server confirms which barangay receives the report from these coordinates.</div>' +
              '<div class="ug-field" style="margin-top:10px;margin-bottom:0"><label class="ug-lab">Exact address / landmark (optional)</label>' +
              '<input class="ug-in" data-field="reportAddress" value="' + esc(r.locationNote || '') + '" placeholder="e.g. beside the seawall, near the chapel"></div>' +
            '</div></div>' +
          '<button class="ug-btn ug-btn--signal ug-btn--block' + (r.desc.trim() ? '' : ' is-disabled') + '"' + A('submit-report') + '>' +
            I('check', 16) + (st.editing ? 'Save changes' : 'Submit Report') + '</button>' +
          '<div class="ug-dimmer" style="font-size:10.5px;text-align:center;margin-top:-8px">' + (st.editing ? 'Editing ' + esc(st.editing.code || '') + ' — audit-logged.' : 'Reports stay editable for 15 minutes after submission.') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function cwAdvisories(st) {
    const f = st.sevFilter;
    const chips = [['all', 'All'], ['emergency', 'Emergency'], ['warning', 'Warning'], ['advisory', 'Advisory'], ['prepared', 'Preparedness']];
    const list = U.DATA.advisories.filter(a => f === 'all' || a.severity === f);
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Advisories and Alerts', 'Official broadcasts from the City Disaster Risk Reduction and Management Office.') +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('sev-filter', attr({ v: c[0] })) + '>' + c[1] +
        '<span class="ug-mono" style="opacity:.7">' + (c[0] === 'all' ? U.DATA.advisories.length : U.DATA.advisories.filter(x => x.severity === c[0]).length) + '</span></button>').join('') + '</div>' +
      '<div class="ug-wgrid-cards">' + list.map((a, k) =>
        '<button class="ug-card" style="text-align:left;cursor:pointer"' + A('open-advisory', attr({ id: a.id })) + '>' +
          '<div class="ug-card-b ug-col" style="gap:9px">' +
            '<div class="ug-rowf ug-between" style="gap:8px">' + U.sevBadge(a.severity) +
            '<span class="ug-dimmer ug-mono" style="font-size:10px">' + esc(a.time) + '</span></div>' +
            '<h3 style="font-size:14px;line-height:1.35">' + esc(a.title) + '</h3>' +
            '<p class="ug-dim" style="font-size:11.5px;line-height:1.5">' + esc(a.body.slice(0, 104)) + (a.body.length > 104 ? '...' : '') + '</p>' +
            '<div class="ug-dimmer ug-rowf" style="font-size:10.5px;gap:10px">' +
              '<span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(a.area) + '</span>' +
              '<span class="ug-rowf" style="gap:4px">' + I('flag', 12) + esc(a.type) + '</span></div>' +
          '</div></button>').join('') + '</div>' +
    '</div>';
  }

  function cwAdvisory(st) {
    const a = U.DATA.advisories.find(x => x.id === st.openId) || U.DATA.advisories[0];
    const steps = a.severity === 'prepared'
      ? ['Agree on a family meeting point and an out-of-town contact.', 'Prepare a go-bag with water, food, documents and a power bank.', 'Join the municipality-wide drill and practise duck, cover and hold.']
      : ['Move to the nearest open evacuation centre if advised.', 'Avoid the affected roads and never cross moving flood water.', 'Bring water, medication, identification and a phone charger.', 'Keep monitoring official advisories for updates.'];
    return '<div class="ug-col" style="gap:18px">' +
      '<button class="ug-btn ug-btn--ghost ug-btn--sm" style="align-self:flex-start"' + A('nav', attr({ route: 'advisories' })) + '>' +
        '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 14) + '</span>Back to Advisories</button>' +
      '<div class="ug-wgrid-article">' +
        '<div class="ug-col" style="gap:18px;min-width:0">' +
          '<div class="ug-banner" style="height:230px">' + U.thumb('surge', 'bn-img') +
            '<div class="bn-in"><div class="ug-rowf ug-gap8" style="gap:6px">' + U.sevBadge(a.severity) + U.badge('id', a.type) + '</div>' +
            '<h2 style="font-size:21px;line-height:1.28">' + esc(a.title) + '</h2></div></div>' +
          '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;font-size:11px;color:var(--ug-ink-3)">' +
            '<span class="ug-rowf" style="gap:5px">' + I('pin', 13) + esc(a.area) + '</span>' +
            '<span class="ug-rowf" style="gap:5px">' + I('clock', 13) + 'Published ' + esc(a.time) + '</span>' +
            '<span class="ug-rowf" style="gap:5px">' + I('shield', 13) + esc(UG_GEO.PLACE.office) + '</span></div>' +
          '<div class="ug-card"><div class="ug-card-sheet ug-dim">' + esc(a.body) + '</div></div>' +
        '</div>' +
        '<div class="ug-col" style="gap:18px;min-width:0">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>' + (a.severity === 'prepared' ? 'How to Prepare' : 'What to Do Now') + '</h3></div>' +
            '<div class="ug-card-b ug-col" style="gap:11px">' + steps.map((s, n) =>
              '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
                '<span class="ug-mono" style="font-size:10.5px;color:var(--ug-signal);width:16px;flex:none;padding-top:2px">0' + (n + 1) + '</span>' +
                '<span class="ug-dim" style="font-size:12.5px;line-height:1.5">' + esc(s) + '</span></div>').join('') + '</div></div>' +
          '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:9px">' +
            '<button class="ug-btn ug-btn--sm ug-btn--block"' + A('save-advisory') + '>' + I('download', 15) + 'Save Offline</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--block ug-btn--ghost"' + A('share-advisory') + '>Share</button>' +
          '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function cwCenters(st) {
    const f = st.centerFilter;
    const scope = st.shelterScope || 'all';
    const myBrgy = (st.session && st.session.barangay) || UG_GEO.BARANGAYS[0];
    const chips = [['all', 'All'], ['open', 'Open'], ['full', 'Full'], ['closed', 'Closed']];
    /* citizens see all municipality shelters by default; "My Barangay" narrows */
    const scoped = scope === 'mine'
      ? U.DATA.centers.filter(c => c.brgy === myBrgy)
      : U.DATA.centers;
    const list = scoped.filter(c => f === 'all' || c.status === f);
    const occBar = (occ, cap) => {
      const pct = Math.min(100, Math.round(occ / cap * 100));
      const col = pct >= 100 ? 'var(--ug-warning)' : 'var(--ug-prepared)';
      return '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + col + '"></div></div>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Shelters', 'Evacuation Center Directory with live availability for ' + U.DATA.city + '.') +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' +
        '<button class="ug-chip' + (scope === 'all' ? ' is-on' : '') + '"' + A('shelter-scope', attr({ v: 'all' })) + '>All Shelters</button>' +
        '<button class="ug-chip' + (scope === 'mine' ? ' is-on' : '') + '"' + A('shelter-scope', attr({ v: 'mine' })) + '>My Barangay (' + esc(myBrgy) + ')</button>' +
        '<span style="width:1px;height:22px;background:var(--ug-line);margin:0 4px"></span>' +
        chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('center-filter', attr({ v: c[0] })) + '>' + c[1] +
        '<span class="ug-mono" style="opacity:.7">' + (c[0] === 'all' ? scoped.length : scoped.filter(x => x.status === c[0]).length) + '</span></button>').join('') +
        '<span class="ug-dimmer" style="margin-left:auto;font-size:11px;display:flex;align-items:center;gap:6px">' + I('wifioff', 13) + 'This list works without a connection</span></div>' +
      (list.length ? '<div class="ug-wgrid-cards">' + list.map(c =>
        '<button class="ug-card" style="text-align:left;cursor:pointer"' + A('open-center-detail', attr({ id: c.uuid || c.id })) + '><div class="ug-card-b ug-col" style="gap:11px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><h3 style="font-size:13.5px">' + esc(c.name) + '</h3>' +
          U.badge(c.status, c.status.charAt(0).toUpperCase() + c.status.slice(1)) + '</div>' +
          '<div class="ug-dimmer ug-rowf ug-wrap" style="font-size:11px;gap:10px">' +
            '<span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(c.brgy) + '</span>' +
            '<span class="ug-rowf" style="gap:4px">' + I('users', 12) + c.occ + ' of ' + c.cap + ' slots</span></div>' +
          occBar(c.occ, c.cap) +
          '<div class="ug-dim" style="font-size:11.5px">' + esc(c.note || 'Tap for the full record, capacity and directions.') + '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px">' +
            '<span class="ug-btn ug-btn--sm ug-btn--signal" style="flex:1;background:var(--ug-waze);color:var(--ug-waze-ink);border-color:transparent">' + I('route', 14) + 'Navigate with Waze</span>' +
            '<span class="ug-btn ug-btn--sm ug-btn--ghost">Details</span></div>' +
        '</div></button>').join('') + '</div>'
      : '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('shelter', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No shelters match this filter</div>' +
        '<div class="ug-dim" style="font-size:11px">Try “All Shelters”, or a different status.</div></div></div>') +
    '</div>';
  }

  function cwHotlines(st) {
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Hotlines', 'Emergency Hotline Directory for barangay and municipal offices.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('save-center-offline', attr({ id: 'hotlines' })) + '>' + I('download', 15) + 'Save Offline</button>') +
      '<div class="ug-wgrid-hotlines">' + U.DATA.hotlines.map(h =>
        '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:10px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><span class="ug-lab">' + esc(h.scope) + '</span>' + I('phone', 16) + '</div>' +
          '<h3 style="font-size:13.5px">' + esc(h.agency) + '</h3>' +
          '<a class="ug-mono" style="font-size:17px;color:var(--ug-signal);text-decoration:none" href="tel:' + esc(String(h.number).replace(/[^\d+]/g, '')) + '">' + esc(h.number) + '</a>' +
          '<a class="ug-btn ug-btn--sm ug-btn--signal" style="text-decoration:none;justify-content:center" href="tel:' + esc(String(h.number).replace(/[^\d+]/g, '')) + '">' + I('phone', 14) + 'Call now</a>' +
        '</div></div>').join('') + '</div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-signal);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-dim" style="font-size:11.5px;line-height:1.5">If a line is busy, keep the call short and state your barangay, landmark and number of people needing help.</div></div></div>' +
    '</div>';
  }

  function cwNotifications(st) {
    const unread = (U.DATA.notifications || []).filter(n => n.unread).length;
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Notifications', 'Push Notifications delivered to this device, including alerts received while the app was closed.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('read-all') + '>' + I('check', 15) + 'Mark All Read</button>') +
      '<div class="ug-wgrid-side">' +
        '<div class="ug-card"><div class="ug-rows">' + (U.DATA.notifications || []).map(n =>
          '<div class="ug-row">' +
            '<span class="r-dot" style="background:' + (U.SEV[n.tone] || U.SEV.advisory).color + '"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(n.title) +
              (n.unread && !st.readNotifs ? '<span class="ug-badge ug-badge--id" style="font-size:9px">New</span>' : '') + '</div>' +
              '<div class="ug-dim" style="font-size:11.5px;margin-top:4px;line-height:1.5">' + esc(n.body) + '</div>' +
              '<div class="r-m"><span>' + I('clock', 12) + esc(n.time) + '</span></div></div>' +
            '<span class="ug-dimmer" style="display:flex;align-self:center">' + I(n.icon, 17) + '</span></div>').join('') + '</div></div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Delivery</h3></div><div class="ug-card-b ug-col" style="gap:10px">' +
            [['Unread', String(st.readNotifs ? 0 : unread), 'warning'], ['Delivered today', '5', 'advisory'], ['Delivery channel', 'Push + offline inbox', 'prepared']]
              .map(x => '<div class="ug-rowf ug-between" style="gap:10px;font-size:12px"><span class="ug-dim">' + x[0] + '</span>' +
                '<span class="ug-mono" style="color:var(--ug-' + x[2] + ')">' + x[1] + '</span></div>').join('') +
          '</div></div>' +
          '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-dim" style="font-size:11.5px;line-height:1.55">' +
            'Alerts are delivered even when the app is closed, and are queued for the offline inbox when there is no signal.</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function cwOffline(st) {
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Offline Readiness', 'Progressive web app caching keeps the essentials available when networks fail.') +
      '<div class="ug-wgrid-side">' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:12px;align-items:center;text-align:center;padding:26px 20px">' +
            '<span style="width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:rgba(255,176,32,.14);color:var(--ug-warning);border:1px solid rgba(255,176,32,.3)">' + I('wifioff', 26) + '</span>' +
            '<h3 style="font-size:17px">' + (st.offline ? 'You Are Offline' : 'Offline Copy Ready') + '</h3>' +
            '<p class="ug-dim" style="font-size:12.5px;line-height:1.55;max-width:420px">Cellular networks often fail during a disaster. UniGuard keeps hotlines, shelters and critical advisories on this device so they still open without a signal.</p>' +
            '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('reconnect') + '>' + I('wave', 15) + (st.offline ? 'Back Online' : 'Check Connection') + '</button>' +
          '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Cached on This Device</h3>' +
            '<span class="ug-dimmer ug-mono" style="font-size:10px">Synced ' + esc(U.DATA.offlineCache.synced) + '</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:11px">' +
              [['Emergency Hotlines', U.DATA.offlineCache.hotlines, 'phone'], ['Evacuation Centers', U.DATA.offlineCache.centers, 'shelter'], ['Critical Advisories', U.DATA.offlineCache.advisories, 'megaphone']]
                .map(x => '<div class="ug-rowf ug-between" style="gap:10px"><span class="ug-rowf" style="gap:9px">' +
                  '<span style="color:var(--ug-signal);display:flex">' + I(x[2], 16) + '</span>' +
                  '<span style="font-size:12.5px">' + x[0] + '</span></span>' +
                  '<span class="ug-badge ug-badge--resolved">' + x[1] + ' ready</span></div>').join('') +
            '</div></div>' +
        '</div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Service Worker Cache</h3></div><div class="ug-card-b ug-col" style="gap:12px">' +
            [['Last Successful Sync', esc(U.DATA.offlineCache.synced)],
             ['Reports Queued While Offline', (UG.DATA.queueCount || 0) + ' waiting'],
             ['Strategy', 'Network first'],
             ['Build', (typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev']]
              .map(x => '<div class="ug-rowf ug-between" style="gap:10px;font-size:12px"><span class="ug-dim">' + x[0] + '</span>' +
                '<span class="ug-mono">' + x[1] + '</span></div>').join('') +
            '<button class="ug-btn ug-btn--sm ug-btn--block"' + A('force-refresh') + '>' + I('wave', 15) + 'Force Refresh</button>' +
            '<div class="ug-dimmer" style="font-size:10.5px;line-height:1.5;text-align:center">Clears the offline cache and reloads the newest build.</div>' +
          '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

    function cwBody(st) {
    switch (st.route) {
      case 'home': return cwHome(st);
      case 'report': return cwReport(st);
      case 'advisories': return cwAdvisories(st);
      case 'advisory-detail': return cwAdvisory(st);
      case 'centers': return cwCenters(st);
      case 'hotlines': return cwHotlines(st);
      case 'notifications': return cwNotifications(st);
      case 'offline': return cwOffline(st);
      case 'more': return cwMore(st);
      /* the new citizen web routes reuse the mobile render functions inside a
         centered page column with the standard desktop header */
      case 'relief':
        return cwWrap(st, 'Relief Assistance', 'Per-barangay relief distribution information.',
          UG_RELIEF.mRelief(st));
      case 'relief-verify': return UG_RELIEF.mReliefVerify(st);
      case 'guides':
        return cwWrap(st, 'Disaster Preparedness Guides',
          'Step-by-step guidance for the hazards that affect ' + UG_GEO.PLACE.label + '.',
          UG_GUIDES.mGuides(st));
      case 'faqs':
        return cwWrap(st, 'Help Center', 'Frequently asked questions answered by the LGU.',
          UG_FAQS.mFaqs(st));
      case 'roadwork':
        return cwWrap(st, 'Road Work & Road Status', 'Active road work posts and the road-status overlay.',
          UG_ROADWORK.mRoadwork(st));
      case 'reports':
        return cwWrap(st, 'My Reports', 'Every report you have filed, with its current status.',
          (typeof UG_SCREENS !== 'undefined' && UG_SCREENS.mobileBody)
            ? UG_SCREENS.mobileBody(Object.assign({}, st, { route: 'reports' })) : '');
      case 'report-detail':
        return (typeof UG_SCREENS !== 'undefined' && UG_SCREENS.mobileBody)
          ? UG_SCREENS.mobileBody(Object.assign({}, st, { route: 'report-detail' })) : cwHome(st);
      case 'sos':
        return cwWrap(st, 'SOS', 'One-tap emergency signal to the LGU / LDRRMO duty officer.', UG_SOS.mSos(st));
      case 'map':
        return cwWrap(st, 'Hazard Map', 'Hazards, relief, shelters and road status around you.',
          UG_SCREENS.mobileBody(Object.assign({}, st, { route: 'map' })));
      default: return cwHome(st);
    }
  }

  /* wraps a mobile-render body in the standard desktop page header. The header
     and the content share one centered column (.ug-cw-page) so they line up. */
  function cwWrap(st, title, sub, body) {
    /* the mobile screen draws its own title block; remove it so the title only shows once */
    const tmp = document.createElement('div');
    tmp.innerHTML = body;
    const header = tmp.firstElementChild && tmp.firstElementChild.firstElementChild;
    if (header && header.querySelector('.ug-lab')) header.remove();

    return '<div class="ug-col ug-cw-page" style="gap:18px">' +
      cwHead(title, sub) +
      '<div>' + tmp.innerHTML + '</div>' +
    '</div>';
  }

  function frameCitizenWeb(st) {
    return '<div class="ug ug-frame ug-w' + (st.fixed ? ' ug-fixed' : '') + '"' +
      (st.fixed ? ' style="width:' + st.w + 'px;height:' + st.h + 'px"' : '') + '>' +
      cwTop(st) +
      (st.offline ? '<div class="ug-offline">' + I('wifioff', 14) +
        '<span>Offline mode. Showing cached hotlines, shelters and critical advisories synced ' + esc(U.DATA.offlineCache.synced) + '.</span>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('toggle-offline') + '>Go live</button></div>' : '') +
      '<main class="ug-wbody ug-scroll">' + cwBody(st) + '</main>' +
      '<footer class="ug-wfoot">' + I('shield', 13) + '<span>UniGuard Resident Portal</span>' +
        '<span class="ug-dimmer">&middot;</span><span class="ug-dimmer">' + esc(U.DATA.city) + '</span>' +
        '<span class="ug-dimmer" style="margin-left:auto">Offline copy synced ' + esc(U.DATA.offlineCache.synced) + '</span></footer>' +
    '</div>';
  }

  return { ROLE_INFO, ROLES, frameCitizenWeb, cwBody };
})();
