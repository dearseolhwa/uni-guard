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
    barangay_official: { key:'barangay_official', label:'Barangay Official',  area:'console', home:'dashboard', scope:(b) => 'Barangay ' + (b || UG_GEO.BARANGAYS[0]) },
    lgu_ldrrmc:        { key:'lgu_ldrrmc',        label:'LGU / MDRRMO',       area:'console', home:'dashboard', scope:() => UG_GEO.PLACE.scope },
  };
  const ROLES = ['citizen', 'barangay_official', 'lgu_ldrrmc'];

  /* ------------------------------------------------------------------ */
  /* CITIZEN DESKTOP (WEB) SHELL                                         */
  /* ------------------------------------------------------------------ */
  const CNAV = [
    ['home', 'Home', 'home'],
    ['report', 'Report a Hazard', 'plus'],
    ['relief', 'Relief', 'relief'],
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
    return '<header class="ug-wtop">' +
      '<button class="ug-brand ug-brand-btn"' + A('nav', attr({ route: 'home' })) + ' aria-label="Go to the home screen">' + U.brandMark(32) +
        '<span class="ug-col" style="gap:0"><span class="ug-wordmark" style="font-size:16px">Uni<em>Guard</em></span>' +
        '<span class="ug-dimmer" style="font-size:9px;letter-spacing:.11em;text-transform:uppercase">Resident portal</span></span></button>' +
      '<nav class="ug-wnav">' + CNAV.map(n =>
        '<button class="ug-wnav-i' + (active === n[0] ? ' is-on' : '') + '"' + A('nav', attr({ route: n[0] })) + '>' +
        I(n[2], 16) + n[1] + (n[0] === 'notifications' && unread ? '<span class="ug-wdot' + (unread > 9 ? ' is-many' : '') + '">' + (unread > 9 ? '9+' : unread) + '</span>' : '') + '</button>').join('') +
      '</nav>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px;margin-left:auto">' +
        '<button class="ug-ico-btn" aria-label="Offline readiness"' + A('nav', attr({ route: 'offline' })) + '>' + I(st.offline ? 'wifioff' : 'download', 17) + '</button>' +
        '<button class="ug-btn ug-btn--danger ug-btn--sm" aria-label="Send SOS"' + A('sos-trigger') + '>' + I('alert', 16) + 'SOS</button>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding-left:8px;border-left:1px solid var(--ug-line);margin-left:2px">' +
          '<span class="ug-col" style="gap:0;align-items:flex-end"><span style="font-size:12px;font-weight:600">' + esc(s.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(s.scope) + '</span></span>' +
          '<span class="ug-av">' + esc(s.initials) + '</span>' +
          '<button class="ug-ico-btn" aria-label="Sign out"' + A('logout') + '>' + I('logout', 17) + '</button>' +
        '</div>' +
      '</div>' +
    '</header>';
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
    const mine = U.DATA.incidents[0];
    const openCenters = U.DATA.centers.filter(c => c.status === 'open');
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Home', 'Live situation for Barangay ' + esc((st.session && st.session.barangay) || UG_GEO.BARANGAYS[0]) + ', ' + esc(UG_GEO.PLACE.label) + '.',
        '<button class="ug-btn ug-btn--signal"' + A('nav', attr({ route: 'report' })) + '>' + I('plus', 16) + 'Report a Hazard</button>') +
      '<div class="ug-wgrid-3">' +
        readout('1', 'In your barangay', 'var(--ug-warning)') +
        readout(String(U.DATA.advisories.filter(a => a.severity !== 'prepared').length), 'Active advisories', 'var(--ug-advisory)') +
        readout(String(openCenters.length), 'Shelters open', 'var(--ug-prepared)') +
      '</div>' +
      '<div class="ug-wgrid-main">' +
        '<div class="ug-col" style="gap:18px;min-width:0">' +
          '<div class="ug-banner" style="height:196px">' + U.thumb('surge', 'bn-img') +
            '<div class="bn-in">' +
              '<div class="ug-rowf ug-gap8" style="gap:6px">' + U.sevBadge(top.severity) + U.badge('id', 'Push alert') + '</div>' +
              '<h3 style="font-size:17px;line-height:1.3">' + esc(top.title) + '</h3>' +
              '<div class="ug-dimmer ug-rowf" style="font-size:11px;gap:8px">' + I('pin', 13) + esc(top.area) + ' &middot; ' + esc(top.time) + '</div>' +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Your Reports</h3>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'reports' })) + '>View All</button></div>' +
            '<div class="ug-rows">' + U.DATA.incidents.slice(0, 3).map(i =>
              '<div class="ug-row">' + U.thumb(i.thumb) +
                '<div class="r-main"><div class="r-t">' + U.ladder(i.sev) + esc(i.hazard) + '</div>' +
                  '<div class="r-m"><span class="ug-mono">' + esc(i.id) + '</span><span>' + I('clock', 12) + esc(i.time) + '</span>' +
                  '<span>' + I('pin', 12) + esc(i.brgy) + '</span></div></div>' +
                U.stageBadge(i.status) + '</div>').join('') + '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Advisories and Alerts</h3>' +
            '<span class="ug-chip is-on" style="font-size:10px">' + U.DATA.advisories.filter(a => a.severity !== 'prepared').length + ' live</span></div>' +
            '<div class="ug-rows">' + U.DATA.advisories.slice(0, 3).map(a =>
              '<div class="ug-row"><span class="r-dot" style="background:' + U.SEV[a.severity].color + '"></span>' +
                '<div class="r-main"><div class="r-t" style="font-size:12.5px">' + esc(a.title) + '</div>' +
                '<div class="r-m"><span>' + I('pin', 12) + esc(a.area) + '</span><span>' + esc(a.type) + '</span><span>' + esc(a.time) + '</span></div></div>' +
                U.sevBadge(a.severity) + '</div>').join('') + '</div></div>' +
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
      cwHead('Report a Hazard', 'Multi-Hazard Reporting. Your report reaches your barangay queue with its timestamp and position.',
        '<button class="ug-btn ug-btn--ghost"' + A('nav', attr({ route: 'home' })) + '>Cancel</button>') +
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
                ? '<div class="ug-rowf ug-gap12" style="gap:10px;align-items:center;border:1px solid var(--ug-line);border-radius:10px;padding:9px">' + U.thumb('flood') +
                  '<div style="min-width:0"><div style="font-size:12px;font-weight:600">' + esc(r.photoName || 'hazard-photo.jpg') + '</div>' +
                  '<div class="ug-dimmer" style="font-size:10.5px">2.4 MB &middot; GPS tag embedded</div></div>' +
                  '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('rm-photo') + '>Replace</button></div>'
                : '<button class="ug-upload" style="width:100%"' + A('add-photo') + '><span class="up-ico">' + I('camera', 22) + '</span>' +
                  '<span style="font-size:13px;font-weight:600">Tap to Attach a Hazard Photo</span>' +
                  '<span class="ug-dimmer" style="font-size:10.5px">JPG or PNG up to 10 MB</span></button>') +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Incident Coordinates</h3></div>' +
            '<div class="ug-card-b"><div class="ug-geo"><span class="geo-ico">' + I('pin', 18) + '</span>' +
              '<span style="min-width:0"><span class="geo-val">' + (r.gps && UG_GEO.isNum(r.lat) ? UG_GEO.fmt(r.lat, r.lng) : 'Not acquired') + '</span>' +
              '<span class="geo-sub">' + (r.gps ? 'Accuracy 6 m &middot; captured just now' : 'GPS tagging attaches your position to the report') + '</span></span>' +
              '<button class="ug-btn ug-btn--sm" style="margin-left:auto"' + A('gps') + '>' + (r.gps ? 'Refresh' : 'Acquire') + '</button></div>' +
              '<div class="ug-hr" style="margin:14px 0"></div>' +
              '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Barangay queue</span><span class="ug-mono">' + esc(r.brgy) + '</span></div>' +
              '<div class="ug-rowf ug-between" style="font-size:12px;margin-top:8px"><span class="ug-dim">Verification</span>' +
              '<span class="ug-mono" style="color:var(--ug-warning)">3 corroborations</span></div>' +
            '</div></div>' +
          '<button class="ug-btn ug-btn--signal ug-btn--block' + (r.desc.trim() ? '' : ' is-disabled') + '"' + A('submit-report') + '>' +
            I('check', 16) + 'Submit Report</button>' +
          '<div class="ug-dimmer" style="font-size:10.5px;text-align:center;margin-top:-8px">Reports stay editable for 15 minutes after submission.</div>' +
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
          (k === 0 ? '<div class="ug-banner" style="height:132px">' + U.thumb('surge', 'bn-img') + '</div>' : '') +
          '<div class="ug-card-b ug-col" style="gap:9px">' +
            '<div class="ug-rowf ug-between" style="gap:8px">' + U.sevBadge(a.severity) +
            '<span class="ug-dimmer ug-mono" style="font-size:10px">' + esc(a.time) + '</span></div>' +
            '<h3 style="font-size:14px;line-height:1.35">' + esc(a.title) + '</h3>' +
            '<p class="ug-dim" style="font-size:11.5px;line-height:1.5">' + esc(a.body.slice(0, 104)) + '...</p>' +
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
    const chips = [['all', 'All'], ['open', 'Open'], ['full', 'Full'], ['closed', 'Closed']];
    const list = U.DATA.centers.filter(c => f === 'all' || c.status === f);
    const occBar = (occ, cap) => {
      const pct = Math.min(100, Math.round(occ / cap * 100));
      const col = pct >= 100 ? 'var(--ug-warning)' : 'var(--ug-prepared)';
      return '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + col + '"></div></div>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Shelters', 'Evacuation Center Directory with live availability for ' + U.DATA.city + '.') +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('center-filter', attr({ v: c[0] })) + '>' + c[1] +
        '<span class="ug-mono" style="opacity:.7">' + (c[0] === 'all' ? U.DATA.centers.length : U.DATA.centers.filter(x => x.status === c[0]).length) + '</span></button>').join('') +
        '<span class="ug-dimmer" style="margin-left:auto;font-size:11px;display:flex;align-items:center;gap:6px">' + I('wifioff', 13) + 'This list works without a connection</span></div>' +
      '<div class="ug-wgrid-cards">' + list.map(c =>
        '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:11px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><h3 style="font-size:13.5px">' + esc(c.name) + '</h3>' +
          U.badge(c.status, c.status.charAt(0).toUpperCase() + c.status.slice(1)) + '</div>' +
          '<div class="ug-dimmer ug-rowf ug-wrap" style="font-size:11px;gap:10px">' +
            '<span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(c.brgy) + '</span>' +
            '<span class="ug-rowf" style="gap:4px">' + I('users', 12) + c.occ + ' of ' + c.cap + ' slots</span></div>' +
          occBar(c.occ, c.cap) +
          '<div class="ug-dim" style="font-size:11.5px">' + esc(c.note) + '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px">' +
            '<button class="ug-btn ug-btn--sm ug-btn--signal" style="flex:1;background:var(--ug-waze);color:var(--ug-waze-ink);border-color:transparent"' + A('directions', attr({ id: c.id, name: c.name })) + '>' + I('route', 14) + 'Navigate with Waze</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('save-center-offline', attr({ id: c.id })) + '>' + I('download', 14) + '</button></div>' +
        '</div></div>').join('') + '</div>' +
    '</div>';
  }

  function cwHotlines(st) {
    return '<div class="ug-col" style="gap:18px">' +
      cwHead('Hotlines', 'Emergency Hotline Directory for barangay and city offices.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('save-center-offline', attr({ id: 'hotlines' })) + '>' + I('download', 15) + 'Save Offline</button>') +
      '<div class="ug-wgrid-hotlines">' + U.DATA.hotlines.map(h =>
        '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:10px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><span class="ug-lab">' + esc(h.scope) + '</span>' + I('phone', 16) + '</div>' +
          '<h3 style="font-size:13.5px">' + esc(h.agency) + '</h3>' +
          '<div class="ug-mono" style="font-size:17px;color:var(--ug-signal)">' + esc(h.number) + '</div>' +
          '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('call', attr({ num: h.number, agency: h.agency })) + '>' + I('phone', 14) + 'Call</button>' +
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
            [['Last Successful Sync', '08:42 today'],
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
      /* the new citizen web routes reuse the mobile render functions; the
         desktop shell already wraps them in the appropriate frame. */
      case 'relief': return cwWrap(st, 'Relief Assistance', 'Per-barangay relief distribution information.', UG_RELIEF.mRelief(st));
      case 'relief-verify': return UG_RELIEF.mReliefVerify(st);
      case 'guides': return cwWrap(st, 'Disaster Preparedness Guides', 'Step-by-step guidance for the hazards that affect ' + UG_GEO.PLACE.label + '.', UG_GUIDES.mGuides(st));
      case 'faqs': return cwWrap(st, 'Help Center', 'Frequently asked questions answered by the LGU.', UG_FAQS.mFaqs(st));
      case 'roadwork': return cwWrap(st, 'Road Work & Road Status', 'Active road work posts and the road-status overlay.', UG_ROADWORK.mRoadwork(st));
      case 'reports': return cwWrap(st, 'My Reports', 'Every report you have filed, with its current status.', (typeof UG_SCREENS !== 'undefined' && UG_SCREENS.mobileBody) ? UG_SCREENS.mobileBody(Object.assign({}, st, { route: 'reports' })) : '');
      case 'report-detail': return (typeof UG_SCREENS !== 'undefined' && UG_SCREENS.mobileBody) ? UG_SCREENS.mobileBody(Object.assign({}, st, { route: 'report-detail' })) : cwHome(st);
      case 'sos': return cwWrap(st, 'SOS', 'One-tap emergency signal to the LGU / LDRRMO duty officer.', UG_SOS.mSos(st));
      default: return cwHome(st);
    }
  }

  /* small helper: wraps a mobile-render body in the standard desktop
     pageHead + content card so the new citizen screens fit the web shell
     without duplicating each module's render code on desktop. */
  function cwWrap(st, title, sub, body) {
    return '<div class="ug-col" style="gap:18px">' +
      cwHead(title, sub) +
      '<div style="max-width:780px">' + body + '</div>' +
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
