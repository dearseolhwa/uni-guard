/* UniGuard render layer: design tokens, icon set, sample data, components and
   every screen body. Split out of the approved prototype without visual change. */

const UG = (() => {
  /* ------------------------------------------------------------------ */
  /* icons                                                               */
  /* ------------------------------------------------------------------ */
  const ICONS = {
    shield:'<path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.6 7 8.9 4.1-1.3 7-4.7 7-8.9V6l-7-2.8Z"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus:'<path d="M12 5.5v13M5.5 12h13"/>',
    home:'<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z"/>',
    megaphone:'<path d="M4 10v4a1 1 0 0 0 1 1h2l7 4V5L7 9H5a1 1 0 0 0-1 1Z"/><path d="M18 9.5a3.5 3.5 0 0 1 0 5"/>',
    shelter:'<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
    phone:'<path d="M6.5 4h2.2l1.4 3.4-1.8 1.4a11.5 11.5 0 0 0 5.9 5.9l1.4-1.8L18.9 14v2.2a2 2 0 0 1-2.2 2A13.4 13.4 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z"/>',
    grid:'<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>',
    alert:'<path d="M12 4.5 3.5 19h17L12 4.5Z"/><path d="M12 10v4"/><path d="M12 16.6h.01"/>',
    map:'<path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8 9 4.5Z"/><path d="M9 4.5v12.7M15 6.8v12.7"/>',
    users:'<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M16 5.6a3 3 0 0 1 0 5.8M17.5 19.5a5.6 5.6 0 0 0-2-4.2"/>',
    settings:'<circle cx="12" cy="12" r="2.8"/><path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.6l1.9 1.1M17.2 15.3l1.9 1.1M4.9 16.4l1.9-1.1M17.2 8.7l1.9-1.1"/>',
    logout:'<path d="M14 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8"/><path d="M17 9l3 3-3 3M20 12h-8"/>',
    bell:'<path d="M17.5 16.5h-11l1.2-2a4 4 0 0 1 .6-2.2V10a4.7 4.7 0 0 1 9.4 0v2.3a4 4 0 0 1 .6 2.2l1.2 2Z"/><path d="M10.5 19a1.6 1.6 0 0 0 3 0"/>',
    search:'<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 20 20"/>',
    pin:'<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"/><circle cx="12" cy="11" r="2.2"/>',
    clock:'<circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.2l2.8 1.7"/>',
    camera:'<path d="M4 8.5h3l1.4-2h7.2L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.4" r="3.1"/>',
    chevron:'<path d="M9 6l6 6-6 6"/>',
    chevdn:'<path d="M6 9.5l6 6 6-6"/>',
    check:'<path d="M5 12.5 9.5 17 19 7.5"/>',
    x:'<path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>',
    wave:'<path d="M3 15c2.2 0 3-1.4 4.5-1.4S10 15 12 15s3.2-1.4 4.6-1.4S19.4 15 21 15"/><path d="M3 9.6c2.2 0 3-1.4 4.5-1.4S10 9.6 12 9.6s3.2-1.4 4.6-1.4S19.4 9.6 21 9.6"/>',
    truck:'<path d="M3 7.5h10v8H3z"/><path d="M13 10h4l4 3.2v2.3h-8z"/><circle cx="7" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/>',
    sort:'<path d="M6 5v13M6 18l-2.5-2.6M6 18l2.5-2.6"/><path d="M13 6.5h8M13 11h6M13 15.5h4"/>',
    download:'<path d="M12 4v10"/><path d="M8 10.5 12 14.5l4-4"/><path d="M5 18.5h14"/>',
    wifioff:'<path d="M3 8.6A15 15 0 0 1 12 5c1.6 0 3.2.28 4.6.8"/><path d="M17.4 11.4A11 11 0 0 1 21 13"/><path d="M7.2 11.6A10 10 0 0 1 9.6 10.6"/><path d="M12 17h.01"/><path d="M4 4l16 16"/>',
    doc:'<path d="M6 3.5h7l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M13 3.5v5h5"/><path d="M8.5 13h7M8.5 16.5h4.5"/>',
    shieldx:'<path d="M12 3.2 5 6v5.4c0 4.2 2.9 7.6 7 8.9 4.1-1.3 7-4.7 7-8.9V6l-7-2.8Z"/><path d="M9.6 9.6l4.8 4.8M14.4 9.6l-4.8 4.8"/>',
    play:'<path d="M8 5.5 18 12 8 18.5v-13Z"/>',
    layers:'<path d="M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z"/><path d="M3.5 13 12 17.5 20.5 13"/>',
    inbox:'<path d="M4 13.5 6.5 5h11L20 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5Z"/><path d="M4 13.5h4l1 2.5h6l1-2.5h4"/>',
    target:'<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    flag:'<path d="M6 21V4"/><path d="M6 4.6h10.5l-1.6 3.6 1.6 3.6H6"/>',
    eye:'<path d="M2.8 12S6 6.5 12 6.5 21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.6"/>',
    info:'<circle cx="12" cy="12" r="7.5"/><path d="M12 11v5M12 8.4h.01"/>',
    radar:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12 18 6"/>',
    route:'<path d="M5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM19 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M7.5 16h6a4 4 0 0 0 0-8H9"/>',
    flame:'<path d="M12 2.5c1 3 4.5 4.5 4.5 9a4.5 4.5 0 0 1-9 0c0-1.4.6-2.3 1.2-3.1.2 1 .9 1.6 1.6 1.6-.4-2.3.6-3.9 1.7-5.5Z"/>',
    bolt:'<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
    wind:'<path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h9a2 2 0 1 1-2 2"/>',
    tree:'<path d="M12 3 7 10h3l-4 6h4v5h4v-5h4l-4-6h3L12 3Z"/>',
    landslide:'<path d="M3 18 9 8l3.5 5.5L15 10l6 8H3Z"/><path d="M6.5 18 9 14"/>',
    road:'<path d="M8 3 4 21M16 3l4 18M12 6v3M12 12v3M12 18v2"/>',
    car:'<path d="M4 16V11l2-5h12l2 5v5"/><path d="M4 16h16"/><circle cx="7.5" cy="16.5" r="1.6"/><circle cx="16.5" cy="16.5" r="1.6"/>',
    drain:'<path d="M4 4h16v16H4z"/><path d="M4 9h16M4 14h16M9 4v16M14 4v16"/>',
    help:'<path d="M9.1 9a3 3 0 1 1 4.6 2.5c-.9.6-1.7 1.1-1.7 2.5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
    flood:'<path d="M3 20c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0 3 1.4 4.5 0M12 3v11M8.5 10.5 12 14l3.5-3.5"/>',
    quake:'<path d="M2 14h4l2-5 3 9 2-6 2 4h7"/>',
  };

  function icon(n, size, cls){
    size = size || 20;
    return '<svg class="ug-i ' + (cls || '') + '" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[n] || ICONS.info) + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* data                                                                */
  /* ------------------------------------------------------------------ */
  /* SEV (severity) and STAGES (status pipeline) are read from js/theme.js — the
     one file that defines these colours and labels — so this render layer can
     never drift from what the map, the legend and the LGU dashboard show. */
  const SEV = {
    emergency:  { label: UG_THEME.SEVERITY.emergency.label, cls: 'emergency', color: 'var(--ug-emergency)', level: 4 },
    warning:    { label: UG_THEME.SEVERITY.warning.label,   cls: 'warning',   color: 'var(--ug-warning)',   level: 3 },
    advisory:   { label: UG_THEME.SEVERITY.advisory.label,  cls: 'advisory',  color: 'var(--ug-advisory)',  level: 2 },
    prepared:   { label: 'Preparedness', cls: 'prepared', color: 'var(--ug-prepared)', level: 1 },
  };
  const STAGES = [
    { key: 'reported',   label: UG_THEME.STATUS.reported.label,   cls: 'reported',   color: 'var(--ug-st-reported)',   note: UG_THEME.STATUS.reported.note },
    { key: 'verified',   label: UG_THEME.STATUS.verified.label,   cls: 'verified',   color: 'var(--ug-st-verified)',   note: UG_THEME.STATUS.verified.note },
    { key: 'dispatched', label: UG_THEME.STATUS.dispatched.label, cls: 'dispatched', color: 'var(--ug-st-dispatched)', note: UG_THEME.STATUS.dispatched.note },
    { key: 'resolved',   label: UG_THEME.STATUS.resolved.label,   cls: 'resolved',   color: 'var(--ug-st-resolved)',   note: UG_THEME.STATUS.resolved.note },
  ];
  /* rejected is a side exit from the normal pipeline, not a step in it — kept
     out of STAGES (which the pipeline widget walks in order) but available for
     badges and filters via UG_THEME.STATUS.rejected directly. */

  const IMG = window.UG_IMG || {};

  const DATA = {
    city: UG_GEO.PLACE.label,
    roles: [
      { id:'citizen',            name:'Marites Aquino',       title:'Resident',                          initials:'MA', scope:'Barangay Poblacion' },
      { id:'barangay_official',  name:'Reynaldo Soriano',     title:'Barangay Captain',                  initials:'RS', scope:'Barangay Poblacion' },
      { id:'lgu_ldrrmc',         name:'Cmdr. Elena Reyes',    title:'MDRRMO Head',                       initials:'ER', scope:UG_GEO.PLACE.scope },
    ],
    sessions: {
      citizen:           { name:'Marites Aquino',    initials:'MA', role:'citizen',           title:'Resident',         barangay:'Poblacion', scope:'Barangay Poblacion', email:'m.aquino@example.ph' },
      barangay_official: { name:'Reynaldo Soriano',  initials:'RS', role:'barangay_official', title:'Barangay Captain', barangay:'Poblacion', scope:'Barangay Poblacion', email:'r.soriano@lingayen.gov.ph' },
      lgu_ldrrmc:        { name:'Cmdr. Elena Reyes', initials:'ER', role:'lgu_ldrrmc',        title:'MDRRMO Head',      barangay:'',           scope:UG_GEO.PLACE.scope,   email:'e.reyes@lingayen.gov.ph' },
    },
    hazards: UG_HAZARDS.LIST.map(h => h.label),
    barangays: UG_GEO.BARANGAYS.slice(),
    kpis: [
      { label:'Active Incidents', value:'12',      delta:'+2 vs last 24h',  dir:'up',   tone:'emergency', icon:'alert' },
      { label:'Units Deployed',   value:'34',      delta:'+5 vs last 24h',  dir:'up',   tone:'verified',  icon:'users' },
      { label:'Critical Areas',   value:'3',       delta:'-1 vs last 24h',  dir:'down', tone:'warning',   icon:'shieldx' },
      { label:'System Status',    value:'STABLE',  delta:'All channels nominal', dir:'flat', tone:'resolved', icon:'wave' },
    ],
    /* x/y/r position the incident on the built-in SVG fallback map (see
       mapSVG below); lat/lng position it on the real Leaflet map (js/map.js)
       and are kept in the same relative spots via UG_GEO.project(). */
    incidents: [
      { id:'UG-2026-0142', hazard:'Flood',              brgy:'Pangapisan North', area:'Coastal road near the barangay hall', status:'dispatched', sev:'emergency', time:'10m ago',  desc:'Knee-deep water across the coastal road; two households requesting evacuation assistance.', corr:3, thumb:'flood',     units:2, lat:16.0552, lng:120.2238 },
      { id:'UG-2026-0141', hazard:'Landslide / Soil Erosion', brgy:'Malawa',   area:'Slope along the barangay road',       status:'verified',   sev:'warning',   time:'45m ago',  desc:'Soil and debris covering the inner lane; one vehicle stalled, no injuries reported.',        corr:3, thumb:'landslide', units:1, lat:16.0038, lng:120.2361 },
      { id:'UG-2026-0140', hazard:'Storm Surge',        brgy:'Wawa',          area:'Seawall along the gulf side',         status:'reported',   sev:'advisory',  time:'1h 12m ago', desc:'Waves overtopping the seawall at high tide; the shoreline path is closed to the public.',  corr:1, thumb:'surge',     units:0, lat:16.0513, lng:120.2452 },
      { id:'UG-2026-0139', hazard:'Fallen Tree',        brgy:'Domalandan West', area:'Along the barangay access road',    status:'resolved',   sev:'advisory',  time:'3h ago',   desc:'Fallen tree cleared by the barangay team; lane reopened to traffic.',                       corr:4, thumb:null,        units:0, lat:16.0421, lng:120.2059 },
      { id:'UG-2026-0138', hazard:'Fire',               brgy:'Poblacion',     area:'Near the public market',              status:'verified',   sev:'emergency', time:'2h 5m ago', desc:'Contained stall fire behind the market row; BFP monitoring for flare-ups.',                corr:2, thumb:null,        units:3, lat:16.0223, lng:120.2312 },
      { id:'UG-2026-0137', hazard:'River Overflow',     brgy:'Estanza',       area:'Low-lying farmland',                  status:'reported',   sev:'warning',   time:'22m ago',  desc:'Water level rising toward the first flood marker; residents advised to prepare go-bags.',   corr:2, thumb:'flood',     units:0, lat:15.9878, lng:120.2497 },
    ],
    advisories: [
      { id:'ADV-2026-061', title:'Flood Warning: Pangapisan North',        severity:'emergency', type:'Emergency',     area:'Pangapisan North, Pangapisan Sur', time:'12m ago', body:'Water has reached the first flood marker along the Pangapisan North coastal road. Residents within 200 m of the shoreline must prepare to move to the Pangapisan North Multi-Purpose Center. Bring water, medication, and identification.' },
      { id:'ADV-2026-060', title:'Suspension of Classes, All Levels',      severity:'warning',   type:'Emergency',     area:UG_GEO.PLACE.areaAll,               time:'1h ago',  body:'The Municipal Disaster Risk Reduction and Management Office has suspended classes at all levels for today. Parents are advised to keep children indoors and monitor official channels.' },
      { id:'ADV-2026-059', title:'Coastal Advisory: Storm Surge Watch',    severity:'advisory',  type:'Emergency',     area:'Coastal barangays',                time:'3h ago',  body:'A storm surge watch is in effect for barangays along Lingayen Gulf. Small sea vessels are prohibited from sailing. The seawall areas are closed until further notice.' },
      { id:'ADV-2026-058', title:'Preparedness Drill: Duck, Cover, Hold',  severity:'prepared',  type:'Preparedness',  area:UG_GEO.PLACE.areaAll,               time:'2d ago',  body:'A municipality-wide earthquake drill will run at 9:00 AM this Friday. Households, schools, and offices are encouraged to join and time their duck, cover, and hold practice.' },
      { id:'ADV-2026-057', title:'Go-Bag Checklist for the Wet Season',    severity:'prepared',  type:'Preparedness',  area:UG_GEO.PLACE.areaAll,               time:'4d ago',  body:'Keep a go-bag ready: three days of water and non-perishable food, flashlight, batteries, first-aid kit, whistle, copies of documents, and a power bank.' },
    ],
    centers: [
      { id:'EC-01', name:'Pangapisan North Multi-Purpose Center', brgy:'Pangapisan North', status:'open',   occ:118, cap:250, note:'Priority for coastal households', lat:16.0555, lng:120.2245 },
      { id:'EC-02', name:'Narciso Ramos Sports and Civic Center', brgy:'Poblacion',        status:'full',   occ:620, cap:620, note:'No remaining slots', lat:16.03192, lng:120.22529 },
      { id:'EC-03', name:'Lingayen Central Elementary School',    brgy:'Poblacion',         status:'open',   occ:84,  cap:300, note:'Medical station on site', lat:16.0219, lng:120.2320 },
      { id:'EC-04', name:'Domalandan West Barangay Hall',         brgy:'Domalandan West',   status:'closed', occ:0,   cap:90,  note:'Undergoing roof repair', lat:16.0418, lng:120.2065 },
      { id:'EC-05', name:'Pangasinan National High School',       brgy:'Poblacion',         status:'open',   occ:210, cap:400, note:'Pet-friendly area available', lat:16.031292, lng:120.230322 },
    ],
    hotlines: [
      { agency:'Lingayen MDRRMO',           number:'(075) 632-2222',   scope:UG_GEO.PLACE.areaAll,  type:'emergency' },
      { agency:'Bureau of Fire Protection', number:'(075) 632-2333',   scope:'Fire and rescue',    type:'emergency' },
      { agency:'PNP Lingayen',              number:'0998-598-5391',    scope:'Police assistance',  type:'emergency' },
      { agency:'Philippine Coast Guard',    number:'(075) 542-6377',   scope:'Coastal rescue',     type:'emergency' },
      { agency:'Philippine Red Cross Pangasinan Chapter', number:'(075) 522-2133', scope:'Medical and relief', type:'medical' },
      { agency:'Poblacion Barangay Desk',   number:'0917-408-2210',    scope:'Barangay hotline',  type:'barangay' },
    ],
    notifications: [
      { title:'Emergency: Flood Warning',          body:'Pangapisan North and Pangapisan Sur residents: prepare to move to higher ground.', time:'12m ago', tone:'emergency', icon:'alert', unread:true },
      { title:'Your Report Was Auto-Verified',     body:'UG-2026-0142 reached 3 independent corroborations in Pangapisan North.',        time:'18m ago', tone:'prepared',  icon:'check', unread:true },
      { title:'Response Dispatched',               body:'Two rescue units are en route to the coastal road.',                          time:'26m ago', tone:'warning',   icon:'truck', unread:true },
      { title:'Coastal Advisory Updated',          body:'Storm surge watch extended until 6:00 PM for coastal barangays.',             time:'3h ago',  tone:'advisory',  icon:'wave',  unread:false },
      { title:'Preparedness Drill Reminder',       body:'Municipality-wide earthquake drill this Friday at 9:00 AM.',                  time:'1d ago',  tone:'prepared',  icon:'flag',  unread:false },
    ],
    offlineCache: { hotlines:6, centers:5, advisories:3, synced:'Today, 08:42' },
  };
  /* give every demo incident and center the 0..1 x/y the SVG fallback map
     expects, derived from the same lat/lng used on the real map so the two
     views never disagree about where something is */
  DATA.incidents.forEach((i) => {
    const p = UG_GEO.project(i.lat, i.lng);
    i.x = p.x; i.y = p.y;
    i.r = i.status === 'resolved' ? 0 : (i.sev === 'emergency' ? 0.1 : i.sev === 'warning' ? 0.08 : 0.06);
  });
  DATA.centers.forEach((c) => { const p = UG_GEO.project(c.lat, c.lng); c.x = p.x; c.y = p.y; });
  DATA.byStatus = (s) => DATA.incidents.filter(i => i.status === s);

  /* ------------------------------------------------------------------ */
  /* components                                                          */
  /* ------------------------------------------------------------------ */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  function badge(kind, label){
    return '<span class="ug-badge ug-badge--' + kind + '">' + esc(label) + '</span>';
  }
  function sevBadge(sev){
    const s = SEV[sev] || SEV.advisory;
    return '<span class="ug-badge ug-badge--' + s.cls + '" style="color:' + s.color + '">' + esc(s.label) + '</span>';
  }
  function ladder(sev){
    const s = SEV[sev] || SEV.advisory;
    let cells = '';
    for (let i = 1; i <= 4; i++) cells += '<i class="' + (i <= s.level ? 'on' : '') + '"></i>';
    return '<span class="ug-ladder" style="color:' + s.color + '">' + cells + '</span>';
  }
  function stageBadge(key){
    if (key === 'rejected') return '<span class="ug-badge ug-badge--rejected">' + esc(UG_THEME.STATUS.rejected.label) + '</span>';
    const st = STAGES.find(x => x.key === key) || STAGES[0];
    return '<span class="ug-badge ug-badge--' + st.cls + '">' + esc(st.label) + '</span>';
  }
  function stat(k){
    return '<div class="ug-stat">' +
      '<div class="s-top"><span class="ug-lab">' + esc(k.label) + '</span>' +
      '<span class="s-ico" style="background:rgba(255,255,255,.05);color:var(--ug-' + k.tone + ')">' + icon(k.icon, 17) + '</span></div>' +
      '<div class="s-val">' + esc(k.value) + '</div>' +
      '<div class="s-delta ' + k.dir + '">' + (k.dir === 'up' ? '&#9650;' : k.dir === 'down' ? '&#9660;' : '&#8226;') + ' ' + esc(k.delta) + '</div>' +
    '</div>';
  }
  function thumb(name, cls, style){
    if (!name || !IMG[name]) return '';
    return '<img class="' + (cls || 'r-thumb') + '" src="' + IMG[name] + '"' + (style ? ' style="' + style + '"' : '') + ' alt="Field photo evidence for the reported hazard">';
  }
  function pipeline(current){
    if (current === 'rejected') {
      const r = UG_THEME.STATUS.rejected;
      return '<div class="ug-pipe"><div class="ug-step s-rejected now">' +
        '<span class="dot" style="border-color:' + r.color + ';color:' + r.color + '">' + icon('x', 11) + '</span>' +
        '<span class="st-x"><span class="st-t">' + esc(r.label) + '</span>' +
        '<span class="st-s">' + esc(r.note) + '</span></span></div></div>';
    }
    const idx = STAGES.findIndex(s => s.key === current);
    return '<div class="ug-pipe">' + STAGES.map((s, i) => {
      const state = i < idx ? 'done' : (i === idx ? 'now' : '');
      const mark = i < idx ? icon('check', 11) : (i === idx ? '' : '');
      return '<div class="ug-step s-' + s.cls + ' ' + state + '">' +
        '<span class="dot">' + mark + '</span>' +
        '<span class="st-x"><span class="st-t">' + esc(s.label) + '</span>' +
        (i === idx ? '<span class="st-s">' + esc(s.note) + '</span>' : '') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }
  function corrMeter(n){
    const pct = Math.min(100, Math.round(n / 3 * 100));
    const cls = n >= 3 ? 'var(--ug-prepared)' : 'var(--ug-warning)';
    return '<div class="ug-col ug-gap6" style="gap:6px">' +
      '<div class="ug-rowf ug-between" style="font-size:11.5px"><span class="ug-dimmer">Independent Corroborations</span>' +
      '<span class="ug-mono" style="color:' + cls + '">' + Math.min(n,3) + ' / 3</span></div>' +
      '<div style="height:5px;border-radius:3px;background:rgba(255,255,255,.09);overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + cls + ';border-radius:3px"></div></div>' +
      '<div class="ug-dimmer" style="font-size:10.5px">' + (n >= 3 ? 'Threshold reached. This report is auto-verified.' : 'Two more matching reports in this barangay within 6 hours will auto-verify it.') + '</div>' +
    '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* tactical map                                                        */
  /* ------------------------------------------------------------------ */
  function mapSVG(opts){
    opts = opts || {};
    const W = 760, H = 430;
    /* the barangays shown on the tactical map are the ones with an active
       incident or evacuation center in the demo data, plus Poblacion (the
       town centre) and the neighbouring towns/gulf that border Lingayen. */
    const nodes = [
      ['Pangapisan North',560,96,1,1],['Wawa',612,150,0,1],['Domalandan West',176,196,1,-1],
      ['Poblacion',420,262,1,1],['Malawa',360,332,0,-1],['Estanza',300,388,0,-1],
      ['Lingayen Gulf',420,40,0,1],['Binmaley',700,236,0,1],['Bugallon',80,360,0,-1],
    ];
    let grid = '';
    for (let x = 0; x <= W; x += 38) grid += '<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+H+'"/>';
    for (let y = 0; y <= H; y += 38) grid += '<line x1="0" y1="'+y+'" x2="'+W+'" y2="'+y+'"/>';
    let contours = '';
    const contourShapes = [
      'M60 150 C120 120 190 130 240 170 C290 210 300 270 270 320',
      'M40 120 C110 90 200 100 260 145',
      'M520 330 C560 300 610 300 660 330',
      'M600 60 C650 40 700 55 730 90',
      'M120 380 C180 350 250 356 300 388'
    ];
    contourShapes.forEach((d, i) => {
      const o = 0.11 - i * 0.015;
      contours += '<path d="' + d + '" fill="none" stroke="rgba(52,214,240,' + o.toFixed(3) + ')" stroke-width="1"/>';
      contours += '<path d="' + d + '" fill="none" stroke="rgba(52,214,240,' + (o * 0.6).toFixed(3) + ')" stroke-width="1" transform="translate(0,-16)"/>';
      contours += '<path d="' + d + '" fill="none" stroke="rgba(52,214,240,' + (o * 0.4).toFixed(3) + ')" stroke-width="1" transform="translate(0,15)"/>';
    });
    /* the gulf sits to the north of the town, so the shaded "water" band runs
       along the top of the grid instead of the bottom */
    const land = '<path d="M0 96 C90 120 172 104 252 118 C342 134 432 128 522 108 C612 90 702 96 760 110 L760 0 L0 0 Z" ' +
      'fill="rgba(52,150,214,.16)" stroke="rgba(120,190,215,.22)" stroke-width="1"/>';
    let roads = '<path d="M60 250 C180 236 300 268 470 232 S640 196 720 214" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="2"/>' +
                '<path d="M170 60 C200 150 250 200 300 300 S380 380 500 400" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2"/>';
    let river = '';
    let nodeMarks = nodes.map(n => {
      const left = n[4] === -1;
      return '<circle cx="'+n[1]+'" cy="'+n[2]+'" r="'+(n[3]?4.5:3)+'" fill="'+(n[3]?'#34D6F0':'#7E92AF')+'"/>' +
      '<text x="'+(n[1] + (left ? -9 : 9))+'" y="'+(n[2]+4)+'" text-anchor="'+(left ? 'end' : 'start')+'" ' +
      'font-family="IBM Plex Mono, monospace" font-size="10.5" ' +
      'style="paint-order:stroke;stroke:#061020;stroke-width:3.6px;stroke-linejoin:round" ' +
      'fill="'+(n[3]?'#DCEDFB':'#A9BDD6')+'">'+n[0]+'</text>';
    }).join('');
    let marks = '';
    DATA.incidents.filter(i => i.r > 0).forEach(i => {
      const cx = i.x * W, cy = i.y * H, rr = i.r * H;
      const col = (SEV[i.sev]||SEV.advisory).color;
      marks += '<circle cx="'+cx+'" cy="'+cy+'" r="'+rr+'" fill="'+col+'" opacity=".10"/>' +
               '<circle cx="'+cx+'" cy="'+cy+'" r="'+rr+'" fill="none" stroke="'+col+'" stroke-opacity=".45" stroke-width="1" stroke-dasharray="4 5"/>' +
               '<circle cx="'+cx+'" cy="'+cy+'" r="5" fill="'+col+'"/>' +
               '<circle cx="'+cx+'" cy="'+cy+'" r="1.9" fill="#050910"/>';
    });
    DATA.incidents.filter(i => i.units > 0).forEach(i => {
      const cx = i.x * W + 22, cy = i.y * H - 20;
      marks += '<rect x="'+(cx-4)+'" y="'+(cy-4)+'" width="8" height="8" rx="2" fill="#34D6F0" transform="rotate(45 '+cx+' '+cy+')"/>';
    });
    const sweep = opts.animated ? '<g style="transform-origin:300px 200px;animation:ugSweep 4.2s linear infinite">' +
      '<path d="M300 200 L300 60 A140 140 0 0 1 430 150 Z" fill="rgba(52,214,240,.10)"/></g>' : '';
    return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Live operations map of Lingayen showing active incident perimeters and deployed units">' +
      '<defs><pattern id="uggrid" width="38" height="38" patternUnits="userSpaceOnUse">' +
      '<path d="M38 0H0V38" fill="none" stroke="rgba(255,255,255,.045)" stroke-width="1"/></pattern></defs>' +
      '<rect width="'+W+'" height="'+H+'" fill="#061020"/>' +
      '<rect width="'+W+'" height="'+H+'" fill="url(#uggrid)"/>' +
      contours + land + roads + river + nodeMarks + sweep + marks +
      '<text x="16" y="'+(H-14)+'" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="#7E92AF">LINGAYEN GRID · WGS84 · ZOOM 12</text>' +
    '</svg>';
  }

  function mapLegend(){
    const items = UG_THEME.legendItems().filter(i => i.group === 'Severity' || i.key === 'unit');
    return '<div class="map-legend">' +
      items.map(l => '<span class="lg"><i class="shape-' + l.shape + '" style="background:' + l.color + '"></i>' + l.label + '</span>').join('') +
    '</div>';
  }

  function brandMark(size){
    size = size || 34;
    return '<span class="ug-mark" style="width:'+size+'px;height:'+size+'px">' +
      '<svg viewBox="0 0 24 24" width="'+Math.round(size*0.6)+'" height="'+Math.round(size*0.6)+'" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 2.6 4.6 5.7v5.8c0 4.5 3.1 8.2 7.4 9.6 4.3-1.4 7.4-5.1 7.4-9.6V5.7L12 2.6Z"/><path d="M8.6 12.2 11 14.6l4.6-4.9"/></svg></span>';
  }

  return { ICONS, icon, DATA, SEV, STAGES, esc, badge, sevBadge, ladder, stageBadge, stat, thumb, pipeline, corrMeter, mapSVG, mapLegend, brandMark };
})();

const UG_SCREENS = (() => {
  const U = UG;
  const I = U.icon, esc = U.esc;

  /* small helpers ---------------------------------------------------- */
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');

  /* hazard colour and rows come from the live store, never from a fixed list.
     Colour lookup goes through js/hazard-types.js + js/theme.js — the same
     canonical list and colour groups the report form and the map legend use —
     instead of guessing from the label text. */
  const HAZARD_COLOR = (h) => UG_HAZARDS.colorFor(h);

  function hazardRows(limit) {
    const a = (U.DATA.analytics && U.DATA.analytics.byHazard) || {};
    return Object.keys(a)
      .map((k) => [k, Number(a[k]), HAZARD_COLOR(k)])
      .filter((r) => r[1] > 0)
      .sort((x, y) => y[1] - x[1])
      .slice(0, limit || 5);
  }
  const occBar = (occ, cap) => {
    const pct = Math.min(100, Math.round(occ / cap * 100));
    const col = pct >= 100 ? 'var(--ug-warning)' : 'var(--ug-prepared)';
    return '<div style="height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + col + '"></div></div>';
  };
  const catBar = (n) => {
    const max = Math.max.apply(null, n.map(x => x[1]));
    return '<div style="display:flex;gap:10px;align-items:stretch">' +
      '<div style="display:flex;flex-direction:column;justify-content:space-between;width:16px;text-align:right;' +
      'font-family:var(--ug-mono);font-size:9.5px;color:var(--ug-ink-3)"><span>' + max + '</span><span>0</span></div>' +
      '<div class="ug-rowf" style="gap:10px;align-items:flex-end;flex:1;min-width:0">' + n.map(x => '<div class="ug-col" style="gap:5px;flex:1;min-width:0">' +
      '<div style="height:64px;display:flex;align-items:flex-end"><div style="width:100%;height:' + Math.round(x[1] / max * 100) + '%;background:' + x[2] + ';border-radius:3px 3px 0 0;min-height:4px"></div></div>' +
      '<div class="ug-dimmer" style="font-size:10.5px;text-align:center;line-height:1.25;overflow-wrap:anywhere" title="' + esc(x[0]) + '">' + esc(x[0]) + '</div>' +
      '<div class="ug-mono" style="font-size:11px;text-align:center">' + x[1] + '</div></div>').join('') + '</div></div>';
  };
  const trendSVG = (series) => {
    const W = 560, H = 120, max = Math.max.apply(null, series) * 1.15;
    const pts = series.map((v, i) => [i / (series.length - 1) * W, H - v / max * H]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    let grid = '';
    for (let i = 1; i <= 4; i++) grid += '<line x1="0" y1="' + H / 4 * i + '" x2="' + W + '" y2="' + H / 4 * i + '" stroke="rgba(255,255,255,.05)"/>';
    const dots = pts.map((p, i) => i % 2 === 0 ? '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4" fill="#34D6F0"/>' : '').join('');
    return '<div style="display:flex;gap:10px;align-items:stretch">' +
        '<div style="display:flex;flex-direction:column;justify-content:space-between;width:26px;text-align:right;' +
        'font-family:var(--ug-mono);font-size:9.5px;color:var(--ug-ink-3);padding:0 0 0 0">' +
        '<span>' + Math.max(1, Math.ceil(max)) + '</span><span>' + Math.max(0, Math.round(Math.max(1, max) / 2)) + '</span><span>0</span></div>' +
        '<div style="flex:1;min-width:0">' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:120px;display:block" role="img" aria-label="Fourteen day incident trend in reports per day">' +
        '<defs><linearGradient id="ugtr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34D6F0" stop-opacity=".28"/><stop offset="1" stop-color="#34D6F0" stop-opacity="0"/></linearGradient></defs>' +
        grid + '<path d="' + area + '" fill="url(#ugtr)"/><path d="' + line + '" fill="none" stroke="#34D6F0" stroke-width="2"/>' + dots + '</svg></div></div>';
  };

  /* ================================================================== */
  /* SHARED: login / role selection                                      */
  /* ================================================================== */
  function login(st){
    return UG_AUTH.authScreen(st);
  }

  /* the signed in account decides the workspace; artboards fall back to a seeded profile */
  const sess = (st) => st.session || U.DATA.sessions[st.role] || U.DATA.sessions.citizen;

  /* ================================================================== */
  /* MOBILE (citizen)                                                    */
  /* ================================================================== */
  function mAppbar(st, title, sub){
    const role = U.DATA.roles.find(r => r.id === st.role) || U.DATA.roles[0];
    return '<div class="ug-appbar">' +
      '<button class="ug-brand ug-brand-btn"' + A('nav', attr({ route: 'home' })) + ' aria-label="Go to the home screen">' +
        '<span class="ug-mark" style="width:30px;height:30px;border-radius:8px">' +
          '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 2.6 4.6 5.7v5.8c0 4.5 3.1 8.2 7.4 9.6 4.3-1.4 7.4-5.1 7.4-9.6V5.7L12 2.6Z"/><path d="M8.6 12.2 11 14.6l4.6-4.9"/></svg></span>' +
        '<span class="ug-col" style="gap:0;min-width:0">' +
          '<span style="font-family:var(--ug-display);font-weight:700;font-size:13px">' + esc(title) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(sub) + '</span>' +
        '</span>' +
      '</button>' +
      '<div class="ug-rowf ug-gap8" style="gap:6px">' +
        '<button class="ug-ico-btn" aria-label="Offline readiness"' + A('nav', attr({ route: 'offline' })) + '>' +
          I(st.offline ? 'wifioff' : 'download', 17) + '</button>' +
        '<button class="ug-ico-btn" aria-label="Notifications"' + A('nav', attr({ route: 'notifications' })) + '>' +
          I('bell', 17) + (st.readNotifs ? '' : '<span class="dot"></span>') + '</button>' +
        '<button class="ug-ico-btn" aria-label="Sign out"' + A('logout') + '>' + I('logout', 17) + '</button>' +
      '</div>' +
    '</div>';
  }

  function mTabbar(st){
    const t = (route, ico, label, badge) =>
      '<button class="ug-tab' + (st.route === route ? ' is-on' : '') + '"' + A('nav', attr({ route: route })) + '>' +
        I(ico, 20) + '<span>' + label + '</span>' + (badge ? '<span class="t-badge">' + badge + '</span>' : '') + '</button>';
    const unread = st.readNotifs ? 0 : 2;
    return '<div class="ug-tabbar">' +
      t('home', 'home', 'Home') +
      t('advisories', 'megaphone', 'Advisories', unread) +
      '<button class="ug-tab" style="flex:0 0 64px" aria-label="Report a Hazard"' + A('nav', attr({ route: 'report' })) + '>' +
        '<span class="ug-fab">' + I('plus', 24) + '</span></button>' +
      t('centers', 'shelter', 'Shelters') +
      t('hotlines', 'phone', 'Hotlines') +
    '</div>';
  }

  /* ---- home ---- */
  function mHome(st){
    const top = U.DATA.advisories[0];
    const mine = U.DATA.incidents[0];
    const openCenters = U.DATA.centers.filter(c => c.status === 'open');
    const readout = (v, l, tone) =>
      '<div class="ug-col" style="gap:3px;padding:11px 12px;background:rgba(255,255,255,.03);border:1px solid var(--ug-line);border-radius:10px;flex:1;min-width:0">' +
        '<span class="ug-mono" style="font-size:17px;font-weight:600;color:' + tone + '">' + v + '</span>' +
        '<span class="ug-dimmer" style="font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;overflow-wrap:anywhere;line-height:1.3">' + l + '</span></div>';
    return '<div class="ug-col" style="gap:16px">' +
      '<div class="ug-rowf ug-between" style="gap:10px">' +
        '<div><div class="ug-lab">' + esc(sess(st).scope) + '</div>' +
        '<h2 style="font-size:19px;margin-top:3px">Good afternoon, ' + esc(sess(st).name.split(' ')[0]) + '</h2></div>' +
        '<span class="ug-chip is-on">' + I('target', 13) + 'Citizen</span>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
        readout('1', 'In your barangay', 'var(--ug-warning)') +
        readout('2', 'Active Advisories', 'var(--ug-advisory)') +
        readout(String(openCenters.length), 'Shelters open', 'var(--ug-prepared)') +
      '</div>' +

      '<div class="ug-banner" style="height:150px">' + U.thumb('surge', 'bn-img') +
        '<div class="bn-in">' +
          '<div class="ug-rowf ug-gap8" style="gap:6px">' + U.sevBadge(top.severity) + '<span class="ug-badge ug-badge--id">Push alert</span></div>' +
          '<h3 style="font-size:14.5px;line-height:1.3">' + esc(top.title) + '</h3>' +
          '<div class="ug-dimmer ug-rowf" style="font-size:10.5px;gap:6px">' + I('pin', 12) + esc(top.area) + ' &middot; ' + esc(top.time) + '</div>' +
        '</div>' +
      '</div>' +

      '<button class="ug-card ug-tick" style="text-align:left;cursor:pointer;width:100%"' + A('open-incident', attr({ id: mine.id })) + '>' +
        '<div class="ug-card-h"><h3>Your Latest Report</h3>' + U.stageBadge(mine.status) + '</div>' +
        '<div class="ug-card-b ug-col" style="gap:11px">' +
          '<div class="ug-rowf ug-gap12" style="gap:10px;align-items:flex-start">' + U.thumb(mine.thumb) +
            '<div style="flex:1;min-width:0"><div class="ug-rowf ug-gap8" style="gap:7px">' + U.ladder(mine.sev) +
            '<span style="font-size:13px;font-weight:600">' + esc(mine.hazard) + '</span></div>' +
            '<div class="ug-dimmer ug-mono" style="font-size:10.5px;margin-top:3px">' + esc(mine.id) + ' &middot; ' + esc(mine.time) + '</div>' +
            '<div class="ug-dim" style="font-size:11.5px;margin-top:5px;line-height:1.45">' + esc(mine.desc.slice(0, 74)) + '&hellip;</div></div>' +
          '</div>' + U.corrMeter(st.corr[mine.id] || mine.corr) +
        '</div>' +
      '</button>' +

      '<div class="ug-card">' +
        '<div class="ug-card-h"><h3>Nearest Open Shelters</h3>' +
          '<button class="ug-dimmer" style="background:none;border:0;font-size:11.5px;cursor:pointer;display:flex;align-items:center;gap:3px"' + A('nav', attr({ route: 'centers' })) + '>All Shelters' + I('chevron', 13) + '</button></div>' +
        '<div class="ug-rows">' + openCenters.slice(0, 2).map(c =>
          '<div class="ug-row"><span class="r-dot" style="background:var(--ug-prepared)"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(c.name) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(c.brgy) + '</span><span>' + I('users', 12) + c.occ + ' / ' + c.cap + '</span></div>' +
              '<div style="margin-top:7px">' + occBar(c.occ, c.cap) + '</div></div>' +
            U.badge('open', 'Open') + '</div>').join('') + '</div>' +
      '</div>' +

      '<div class="ug-card ug-card--flat">' +
        '<div class="ug-card-b" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          [['report', 'plus', 'Report Hazard'], ['centers', 'shelter', 'Find Shelter'], ['hotlines', 'phone', 'Hotlines'], ['advisories', 'megaphone', 'Advisories']]
            .map(q => '<button class="ug-btn ug-btn--sm" style="width:100%"' + A('nav', attr({ route: q[0] })) + '>' + I(q[1], 15) + q[2] + '</button>').join('') +
        '</div>' +
      '</div>' +

      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:10.5px">' +
        I('download', 12) + 'Offline copy ready &middot; hotlines, shelters and critical advisories synced ' + esc(U.DATA.offlineCache.synced) + '</div>' +
    '</div>';
  }

  /* ---- report form (feature 3) ---- */
  function mReport(st){
    const r = st.report;
    const urg = [['advisory', 'Looks Minor'], ['warning', 'Getting Worse'], ['emergency', 'People at Risk']];
    return '<div class="ug-col" style="gap:16px">' +
      '<div><div class="ug-lab">Multi-Hazard Reporting</div>' +
      '<h2 style="font-size:19px;margin-top:3px">Report a Hazard</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Your report goes to your barangay queue with your GPS position and timestamp. Three matching reports in the same area auto-verify it.</p></div>' +

      '<div class="ug-field"><label class="ug-lab">Hazard type</label>' +
        '<select class="ug-sel" data-field="hazard" aria-label="Hazard type">' +
        U.DATA.hazards.map(h => '<option' + (r.hazard === h ? ' selected' : '') + '>' + esc(h) + '</option>').join('') + '</select></div>' +

      (UG_HAZARDS.classify(r.hazard).key === 'other'
        ? '<div class="ug-field"><label class="ug-lab">Tell us what the hazard is</label>' +
          '<input class="ug-in" data-field="hazardOther" placeholder="e.g. downed utility pole" value="' + esc(r.hazardOther || '') + '">' +
          '<div class="ug-help">Required when the hazard type is "Others".</div></div>'
        : '') +

      '<div class="ug-field"><label class="ug-lab">Barangay jurisdiction</label>' +
        '<select class="ug-sel" data-field="brgy" aria-label="Barangay jurisdiction">' +
        U.DATA.barangays.map(b => '<option' + (r.brgy === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select></div>' +

      '<div class="ug-field"><label class="ug-lab">How urgent does it look</label>' +
        '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + urg.map(u =>
          '<button class="ug-chip' + (r.urg === u[0] ? ' is-on' : '') + '"' + A('set-urg', attr({ v: u[0] })) + '>' +
          U.ladder(u[0]) + u[1] + '</button>').join('') + '</div></div>' +

      '<div class="ug-field"><label class="ug-lab">Description and hazard details</label>' +
        '<textarea class="ug-ta" rows="4" data-field="desc" placeholder="Describe what you are seeing: water depth (knee or waist high), affected roads, trapped families, or nearby landmarks.">' + esc(r.desc) + '</textarea>' +
        '<div class="ug-help">Tip: landmark references help responders find the exact spot.</div></div>' +

      '<div class="ug-field"><label class="ug-lab">Photo evidence</label>' +
        (r.photo
          ? '<div class="ug-rowf ug-gap12" style="gap:10px;align-items:center;border:1px solid var(--ug-line);border-radius:10px;padding:9px">' + U.thumb('flood') +
            '<div style="min-width:0"><div style="font-size:12px;font-weight:600">' + esc(r.photoName || 'hazard-photo.jpg') + '</div>' +
            '<div class="ug-dimmer" style="font-size:10.5px">2.4 MB &middot; GPS tag embedded</div></div>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('rm-photo') + '>Replace</button></div>'
          : '<button class="ug-upload" style="width:100%"' + A('add-photo') + '>' +
            '<span class="up-ico">' + I('camera', 22) + '</span>' +
            '<span style="font-size:13px;font-weight:600">Tap to Attach a Hazard Photo</span>' +
            '<span class="ug-dimmer" style="font-size:10.5px">JPG or PNG up to 10 MB, or capture with the camera</span></button>') +
      '</div>' +

      '<div class="ug-field"><label class="ug-lab">Incident coordinates</label>' +
        '<div class="ug-geo"><span class="geo-ico">' + I('pin', 18) + '</span>' +
          '<span style="min-width:0"><span class="geo-val">' + (r.gps && UG_GEO.isNum(r.lat) ? UG_GEO.fmt(r.lat, r.lng) : 'Not acquired') + '</span>' +
          '<span class="geo-sub">' + (r.gps ? 'Accuracy 6 m &middot; captured just now' : 'GPS tagging attaches your position to the report') + '</span></span>' +
          '<button class="ug-btn ug-btn--sm" style="margin-left:auto"' + A('gps') + '>' + (r.gps ? 'Refresh' : 'Acquire') + '</button>' +
        '</div></div>' +

      '<button class="ug-btn ug-btn--signal ug-btn--block' + (r.desc.trim() ? '' : ' is-disabled') + '"' + A('submit-report') + '>' +
        I('check', 16) + 'Submit Report</button>' +
      '<div class="ug-dimmer" style="font-size:10.5px;text-align:center;margin-top:-6px">Reports stay editable for 15 minutes after submission.</div>' +
    '</div>';
  }

  /* ---- report submitted (feature 4) ---- */
  function mReportDone(st){
    const id = (st.lastReport && st.lastReport.id) || 'Pending sync';
    return '<div class="ug-col" style="gap:16px">' +
      '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:12px;align-items:center;text-align:center;padding:22px 18px">' +
        '<span style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:rgba(47,208,138,.14);color:var(--ug-prepared);border:1px solid rgba(47,208,138,.32)">' + I('check', 26) + '</span>' +
        '<h3 style="font-size:17px">Report Submitted</h3>' +
        '<p class="ug-dim" style="font-size:12px;line-height:1.5">Your hazard report is now in the ' + esc((st.lastReport && st.lastReport.brgy) || 'barangay') + ' queue. Responders see it immediately.</p>' +
        '<span class="ug-badge ug-badge--id" style="font-size:11px">' + id + '</span>' +
      '</div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Crowd Corroboration</h3>' + U.badge('reported', '1 of 3') + '</div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' + U.corrMeter(1) +
        '<div class="ug-hr"></div>' +
        '<div class="ug-lab">Corroborating Reports</div>' +
        '<div class="ug-rows" style="margin:0 -16px -16px">' +
          '<div class="ug-row"><span class="r-dot" style="background:var(--ug-signal)"></span><div class="r-main"><div class="r-t">You (' + esc(sess(st).name) + ')</div>' +
            '<div class="r-m"><span>' + I('clock', 12) + 'just now</span><span>' + I('pin', 12) + esc((st.lastReport && st.lastReport.brgy) || 'your barangay') + '</span></div></div></div>' +
          '<div class="ug-row" style="opacity:.5"><span class="r-dot" style="background:var(--ug-line-strong)"></span><div class="r-main"><div class="r-t">Awaiting Second Report</div>' +
            '<div class="r-m"><span>Same barangay &middot; same hazard &middot; within 6 hours</span></div></div></div>' +
          '<div class="ug-row" style="opacity:.5"><span class="r-dot" style="background:var(--ug-line-strong)"></span><div class="r-main"><div class="r-t">Awaiting Third Report</div>' +
            '<div class="r-m"><span>Auto-verification triggers at three</span></div></div></div>' +
        '</div></div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>What Happens Next</h3></div>' +
        '<div class="ug-card-b">' + U.pipeline('reported') + '</div></div>' +

      '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<button class="ug-btn ug-btn--signal" style="flex:1"' + A('nav', attr({ route: 'reports' })) + '>Track Report</button>' +
        '<button class="ug-btn ug-btn--ghost" style="flex:1"' + A('nav', attr({ route: 'home' })) + '>Back Home</button>' +
      '</div>' +
    '</div>';
  }

  /* ---- my reports (feature 5) ---- */
  function mReports(st){
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Incident Status Tracking</div><h2 style="font-size:19px;margin-top:3px">My Reports</h2></div>' +
      '<div class="ug-card"><div class="ug-rows">' + U.DATA.incidents.slice(0, 3).map(i => {
        const corr = st.corr[i.id] != null ? st.corr[i.id] : i.corr;
        const status = corr >= 3 && i.status === 'reported' ? 'verified' : i.status;
        return '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-report', attr({ id: i.id })) + '>' +
          U.thumb(i.thumb) +
          '<div class="r-main"><div class="r-t">' + U.ladder(i.sev) + esc(i.hazard) + '</div>' +
            '<div class="r-m"><span class="ug-mono">' + esc(i.id) + '</span><span>' + I('clock', 12) + esc(i.time) + '</span><span>' + I('shield', 12) + corr + '/3</span></div></div>' +
          U.stageBadge(status) + I('chevron', 16) + '</button>';
      }).join('') + '</div></div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:8px">' +
        '<div class="ug-lab">Status Legend</div>' +
        U.STAGES.map(s => '<div class="ug-rowf ug-gap8" style="gap:8px;font-size:11.5px"><span class="r-dot" style="background:' + s.color + ';margin:0"></span>' +
          '<span style="font-weight:600;color:' + s.color + '">' + s.label + '</span>' +
          '<span class="ug-dimmer" style="margin-left:auto;text-align:right">' + s.note + '</span></div>').join('') +
      '</div></div>' +
    '</div>';
  }

  function mReportDetail(st){
    const id = st.openId;
    const i = U.DATA.incidents.find(x => x.id === id) || U.DATA.incidents[0];
    const corr = st.corr[i.id] != null ? st.corr[i.id] : i.corr;
    const auto = corr >= 3 && i.status === 'reported';
    const status = auto ? 'verified' : i.status;
    return '<div class="ug-col" style="gap:14px">' +
      '<button class="ug-btn ug-btn--ghost ug-btn--sm" style="align-self:flex-start"' + A('nav', attr({ route: 'reports' })) + '>' +
        '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 14) + '</span>Back</button>' +
      '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:12px">' +
        '<div class="ug-rowf ug-between" style="gap:8px">' + U.sevBadge(i.sev) + U.stageBadge(status) + '</div>' +
        '<h2 style="font-size:18px">' + esc(i.hazard) + '</h2>' +
        '<div class="ug-dimmer ug-mono" style="font-size:11px">' + esc(i.id) + ' &middot; ' + esc(i.time) + ' &middot; ' + esc(i.brgy) + '</div>' +
        U.thumb(i.thumb, 'bn-img') +
        '<p class="ug-dim" style="font-size:12.5px;line-height:1.55">' + esc(i.desc) + '</p>' +
      '</div></div>' +

      (auto ? '<div class="ug-card" style="border-color:rgba(47,208,138,.4)"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-prepared);display:flex">' + I('check', 18) + '</span>' +
        '<div><div style="font-size:12.5px;font-weight:700;color:var(--ug-prepared)">Auto-Verified by Corroboration</div>' +
        '<div class="ug-dim" style="font-size:11.5px;margin-top:3px;line-height:1.5">Three independent residents reported the same hazard in the same barangay within the 6 hour window, so the report skipped manual approval.</div></div>' +
      '</div></div>' : '') +

      '<div class="ug-card"><div class="ug-card-h"><h3>Tracking</h3></div>' +
        '<div class="ug-card-b">' + U.pipeline(status) + '</div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Corroboration</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' + U.corrMeter(corr) +
          '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('confirm-corr', attr({ id: i.id })) + '>' + I('check', 15) + 'Confirm This Hazard Is Still There</button>' +
        '</div></div>' +

      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-between" style="gap:8px">' +
        '<div class="ug-dim" style="font-size:11.5px">Need help right now?</div>' +
        '<button class="ug-btn ug-btn--sm"' + A('nav', attr({ route: 'hotlines' })) + '>' + I('phone', 14) + 'Barangay Desk</button>' +
      '</div></div>' +
    '</div>';
  }

  /* ---- advisories (feature 6 + 11) ---- */
  function mAdvisories(st){
    const f = st.sevFilter;
    const chips = [['all', 'All'], ['emergency', 'Emergency'], ['warning', 'Warning'], ['advisory', 'Advisory'], ['prepared', 'Preparedness']];
    const list = U.DATA.advisories.filter(a => f === 'all' || a.severity === f);
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Official broadcasts</div><h2 style="font-size:19px;margin-top:3px">Advisories and Alerts</h2></div>' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('sev-filter', attr({ v: c[0] })) + '>' + c[1] + '</button>').join('') + '</div>' +
      (list.length ? list.map(a =>
        '<button class="ug-card" style="text-align:left;cursor:pointer;width:100%"' + A('open-advisory', attr({ id: a.id })) + '>' +
          '<div class="ug-card-b ug-col" style="gap:9px">' +
            '<div class="ug-rowf ug-between" style="gap:8px">' + U.sevBadge(a.severity) +
              '<span class="ug-dimmer ug-mono" style="font-size:10px">' + esc(a.time) + '</span></div>' +
            '<h3 style="font-size:14px;line-height:1.35">' + esc(a.title) + '</h3>' +
            '<div class="ug-dimmer ug-rowf ug-wrap" style="font-size:10.5px;gap:10px">' +
              '<span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(a.area) + '</span>' +
              '<span class="ug-rowf" style="gap:4px">' + I('flag', 12) + esc(a.type) + '</span>' +
              '<span class="ug-rowf" style="gap:4px;margin-left:auto">Read' + I('chevron', 12) + '</span></div>' +
          '</div></button>').join('')
        : '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('megaphone', 20) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No Advisories in This Filter</div>' +
          '<div style="font-size:11px">Switch the filter to see other broadcasts.</div></div></div>') +
    '</div>';
  }

  function mAdvisoryDetail(st){
    const a = U.DATA.advisories.find(x => x.id === st.openId) || U.DATA.advisories[0];
    const steps = a.severity === 'prepared'
      ? ['Agree on a family meeting point and an out-of-town contact.', 'Prepare a go-bag with water, food, documents and a power bank.', 'Join the citywide drill and practise duck, cover and hold.']
      : ['Move to the nearest open evacuation centre if advised.', 'Avoid the affected roads and never cross moving flood water.', 'Bring water, medication, identification and a phone charger.', 'Keep monitoring official advisories for updates.'];
    return '<div class="ug-col" style="gap:14px">' +
      '<button class="ug-btn ug-btn--ghost ug-btn--sm" style="align-self:flex-start"' + A('nav', attr({ route: 'advisories' })) + '>' +
        '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 14) + '</span>Back</button>' +
      '<div class="ug-banner" style="height:168px">' + U.thumb('surge', 'bn-img') +
        '<div class="bn-in"><div class="ug-rowf ug-gap8" style="gap:6px">' + U.sevBadge(a.severity) + U.badge('id', a.type) + '</div>' +
        '<h2 style="font-size:17px;line-height:1.3">' + esc(a.title) + '</h2></div></div>' +
      '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;font-size:11px;color:var(--ug-ink-3)">' +
        '<span class="ug-rowf" style="gap:5px">' + I('pin', 13) + esc(a.area) + '</span>' +
        '<span class="ug-rowf" style="gap:5px">' + I('clock', 13) + 'Published ' + esc(a.time) + '</span>' +
        '<span class="ug-rowf" style="gap:5px">' + I('shield', 13) + esc(UG_GEO.PLACE.office) + '</span></div>' +
      '<div class="ug-card"><div class="ug-card-b"><p class="ug-dim" style="font-size:13px;line-height:1.65">' + esc(a.body) + '</p></div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + (a.severity === 'prepared' ? 'How to Prepare' : 'What to Do Now') + '</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:11px">' + steps.map((s, n) =>
          '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
            '<span class="ug-mono" style="font-size:10.5px;color:var(--ug-signal);width:16px;flex:none;padding-top:2px">0' + (n + 1) + '</span>' +
            '<span class="ug-dim" style="font-size:12.5px;line-height:1.5">' + esc(s) + '</span></div>').join('') + '</div></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('save-advisory') + '>' + I('download', 15) + 'Save Offline</button>' +
        '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('share-advisory') + '>Share</button>' +
      '</div>' +
    '</div>';
  }

  /* ---- evacuation centres (feature 7) ---- */
  function mCenters(st){
    const f = st.centerFilter;
    const chips = [['all', 'All'], ['open', 'Open'], ['full', 'Full'], ['closed', 'Closed']];
    const list = U.DATA.centers.filter(c => f === 'all' || c.status === f);
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Evacuation Center Directory</div><h2 style="font-size:19px;margin-top:3px">Shelters Near You</h2></div>' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('center-filter', attr({ v: c[0] })) + '>' + c[1] +
        '<span class="ug-mono" style="opacity:.7">' + (c[0] === 'all' ? U.DATA.centers.length : U.DATA.centers.filter(x => x.status === c[0]).length) + '</span></button>').join('') + '</div>' +
      list.map(c =>
        '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:11px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><h3 style="font-size:13.5px">' + esc(c.name) + '</h3>' + U.badge(c.status, c.status.charAt(0).toUpperCase() + c.status.slice(1)) + '</div>' +
          '<div class="ug-dimmer ug-rowf ug-wrap" style="font-size:11px;gap:10px">' +
            '<span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(c.brgy) + '</span>' +
            '<span class="ug-rowf" style="gap:4px">' + I('users', 12) + c.occ + ' of ' + c.cap + ' slots</span></div>' +
          occBar(c.occ, c.cap) +
          '<div class="ug-dim" style="font-size:11.5px">' + esc(c.note) + '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px">' +
            '<button class="ug-btn ug-btn--sm ug-btn--signal" style="flex:1;background:var(--ug-waze);color:var(--ug-waze-ink);border-color:transparent"' + A('directions', attr({ id: c.id, name: c.name })) + '>' + I('route', 14) + 'Navigate with Waze</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('save-center-offline', attr({ id: c.id })) + '>' + I('download', 14) + '</button>' +
          '</div>' +
        '</div></div>').join('') +
      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:10.5px">' + I('wifioff', 12) + 'This list is cached and works without a connection.</div>' +
    '</div>';
  }

  /* ---- hotlines (feature 8) ---- */
  function mHotlines(st){
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Emergency Hotline Directory</div><h2 style="font-size:19px;margin-top:3px">Who to Call</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">One list for barangay and city offices. Cached on your device for offline use.</p></div>' +
      '<div class="ug-card"><div class="ug-rows">' + U.DATA.hotlines.map(h =>
        '<div class="ug-row"><span class="r-dot" style="background:' + (h.type === 'emergency' ? 'var(--ug-emergency)' : h.type === 'medical' ? 'var(--ug-prepared)' : 'var(--ug-advisory)') + '"></span>' +
          '<div class="r-main"><div class="r-t">' + esc(h.agency) + '</div>' +
            '<div class="ug-mono" style="font-size:14px;color:var(--ug-signal);margin-top:3px">' + esc(h.number) + '</div>' +
            '<div class="r-m"><span>' + esc(h.scope) + '</span></div></div>' +
          '<button class="ug-btn ug-btn--sm ug-btn--signal" style="align-self:center"' + A('call', attr({ num: h.number, agency: h.agency })) + '>' + I('phone', 14) + 'Call</button></div>').join('') +
      '</div></div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-signal);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-dim" style="font-size:11.5px;line-height:1.5">If a line is busy, keep the call short and state your barangay, landmark and number of people needing help.</div></div></div>' +
    '</div>';
  }

  /* ---- notifications (feature 10) ---- */
  function mNotifications(st){
    return '<div class="ug-col" style="gap:14px">' +
      '<div class="ug-rowf ug-between" style="gap:8px"><div><div class="ug-lab">Push Notifications</div><h2 style="font-size:19px;margin-top:3px">Inbox</h2></div>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('read-all') + '>Mark All Read</button></div>' +
      '<div class="ug-card"><div class="ug-rows">' + U.DATA.notifications.map(n =>
        '<div class="ug-row">' +
          '<span class="r-dot" style="background:' + (U.SEV[n.tone] || U.SEV.advisory).color + '"></span>' +
          '<div class="r-main"><div class="r-t">' + esc(n.title) + (n.unread && !st.readNotifs ? '<span class="ug-badge ug-badge--id" style="font-size:9px">New</span>' : '') + '</div>' +
            '<div class="ug-dim" style="font-size:11.5px;margin-top:4px;line-height:1.5">' + esc(n.body) + '</div>' +
            '<div class="r-m"><span>' + I('clock', 12) + esc(n.time) + '</span></div></div>' +
          '<span class="ug-dimmer" style="display:flex;align-self:center">' + I(n.icon, 17) + '</span></div>').join('') +
      '</div></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:10.5px">' + I('bell', 12) + 'Alerts are delivered even when the app is closed.</div>' +
    '</div>';
  }

  /* ---- offline (feature 9) ---- */
  function mOffline(st){
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Offline Access</div><h2 style="font-size:19px;margin-top:3px">Offline Readiness</h2></div>' +
      '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:12px;align-items:center;text-align:center">' +
        '<span style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:rgba(255,176,32,.14);color:var(--ug-warning);border:1px solid rgba(255,176,32,.3)">' + I('wifioff', 25) + '</span>' +
        '<h3 style="font-size:16px">You Are Offline</h3>' +
        '<p class="ug-dim" style="font-size:12px;line-height:1.5;max-width:280px">Cellular networks often fail during a disaster. UniGuard keeps the essentials on your device so they still open without a signal.</p>' +
      '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>Cached on This Device</h3><span class="ug-dimmer ug-mono" style="font-size:10px">Synced ' + esc(U.DATA.offlineCache.synced) + '</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:10px">' +
          [['Emergency Hotlines', U.DATA.offlineCache.hotlines, 'phone'], ['Evacuation Centers', U.DATA.offlineCache.centers, 'shelter'], ['Critical Advisories', U.DATA.offlineCache.advisories, 'megaphone']]
            .map(x => '<div class="ug-rowf ug-between" style="gap:10px"><span class="ug-rowf" style="gap:9px">' +
              '<span style="color:var(--ug-signal);display:flex">' + I(x[2], 16) + '</span>' +
              '<span style="font-size:12.5px">' + x[0] + '</span></span>' +
              '<span class="ug-badge ug-badge--resolved">' + x[1] + ' ready</span></div>').join('') +
        '</div></div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:10px">' +
        '<div class="ug-lab">Service Worker Cache</div>' +
        '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Last successful sync</span><span class="ug-mono">08:42 today</span></div>' +
        '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Reports queued while offline</span><span class="ug-mono">' + (UG.DATA.queueCount || 0) + ' waiting</span></div>' +
        '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Strategy</span><span class="ug-mono">Network first</span></div>' +
        '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">Build</span><span class="ug-mono">' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</span></div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<button class="ug-btn ug-btn--sm ug-btn--signal" style="flex:1"' + A('reconnect') + '>' + I('wave', 15) + (st.offline ? 'Back Online' : 'Check Connection') + '</button>' +
          '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('force-refresh') + '>' + I('wave', 15) + 'Force Refresh</button>' +
        '</div>' +
        '<div class="ug-dimmer" style="font-size:10.5px;line-height:1.5">Force Refresh clears the offline cache and reloads the newest build.</div>' +
      '</div></div>' +
    '</div>';
  }

  /* ================================================================== */
  /* DESKTOP (barangay / LGU console)                                    */
  /* ================================================================== */
  const DNAV = [
    ['dashboard', 'Home', 'home', null],
    ['incidents', 'Incidents', 'alert', '6'],
    ['advisories', 'Advisories', 'megaphone', '5'],
    ['centers', 'Shelters', 'shelter', null],
    ['hotlines', 'Hotlines', 'phone', null],
    ['analytics', 'Analytics', 'layers', null],
    ['users', 'Users', 'users', null, ['lgu_ldrrmc']],
    ['audit', 'Audit Log', 'doc', null, ['lgu_ldrrmc']],
  ];

  function dSidebar(st){
    const role = sess(st);
    const counts = U.DATA.counts || {};
    const nz = (v) => (v ? String(v) : null);
    const navCount = (r) => r === 'incidents' ? nz(counts.openIncidents)
      : r === 'advisories' ? nz(counts.liveAdvisories)
      : r === 'centers' ? nz(counts.openCenters) : null;
    const route = st.route === 'incident' ? 'incidents' : st.route;
    return '<aside class="ug-side" id="ug-console-nav">' +
      '<button class="ug-brand ug-brand-btn"' + A('nav', attr({ route: 'dashboard' })) + ' aria-label="Go to the dashboard">' + U.brandMark(32) +
        '<span class="ug-col" style="gap:0"><span class="ug-wordmark" style="font-size:15.5px">Uni<em>Guard</em></span>' +
        '<span class="ug-dimmer" style="font-size:9px;letter-spacing:.1em;text-transform:uppercase">Command console</span></span></button>' +
      DNAV.filter(n => !n[4] || n[4].indexOf(role.role) !== -1).map(n => '<button class="ug-nav' + (route === n[0] ? ' is-on' : '') + '"' + A('nav', attr({ route: n[0] })) + '>' +
        I(n[2], 18) + '<span>' + n[1] + '</span>' + (navCount(n[0]) ? '<span class="n-cnt">' + navCount(n[0]) + '</span>' : '') + '</button>').join('') +
      '<div style="margin-top:auto" class="ug-col ug-gap6" style="gap:6px">' +
        '<button class="ug-nav"' + A('nav', attr({ route: 'offline' })) + '>' + I(st.offline ? 'wifioff' : 'download', 18) + '<span>' + (st.offline ? 'Offline mode' : 'Offline sync') + '</span></button>' +
        '<div class="ug-hr" style="margin:8px 0"></div>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding:4px 8px">' +
          '<span class="ug-av">' + esc(role.initials) + '</span>' +
          '<span class="ug-col" style="gap:0;min-width:0"><span style="font-size:12px;font-weight:600">' + esc(role.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(role.title) + '</span></span></div>' +
        '<button class="ug-nav"' + A('logout') + '>' + I('logout', 18) + '<span>Sign out</span></button>' +
        '<button class="ug-nav"' + A('force-refresh') + '>' + I('wave', 18) + '<span>Force Refresh</span></button>' +
        '<div class="ug-mono" style="font-size:9px;color:var(--ug-ink-3);padding:2px 9px 4px">build ' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</div>' +
      '</div>' +
    '</aside>';
  }

  function dTopbar(st, title, sub){
    const role = sess(st);
    return '<header class="ug-top">' +
      '<button class="ug-ico-btn ug-menubtn" data-act="toggle-nav" aria-label="Open the navigation menu" ' +
        'aria-expanded="false" aria-controls="ug-console-nav">' + I('menu', 18) + '</button>' +
      '<div class="ug-col" style="gap:0;min-width:150px">' +
        '<span style="font-family:var(--ug-display);font-weight:700;font-size:13.5px">' + esc(title) + '</span>' +
        '<span class="ug-dimmer" style="font-size:10.5px">' + esc(sub) + '</span></div>' +
      '<label class="ug-search">' + I('search', 16) +
        '<input type="text" placeholder="Search incidents, responders, or locations" data-field="search" aria-label="Search">' +
        '<span class="ug-mono" style="font-size:10px;color:var(--ug-ink-3)">&#8984;K</span></label>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px;margin-left:auto">' +
        '<span class="ug-chip ug-top-live' + (st.offline ? '' : ' is-on') + '">' + I(st.offline ? 'wifioff' : 'wave', 13) + (st.offline ? 'Offline' : 'Live feed') + '</span>' +
        '<button class="ug-ico-btn" aria-label="Notifications"' + A('nav', attr({ route: 'notifications' })) + '>' + I('bell', 17) + (st.readNotifs ? '' : '<span class="dot"></span>') + '</button>' +
        '<button class="ug-ico-btn" aria-label="Sign out"' + A('logout') + '>' + I('logout', 17) + '</button>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding-left:6px;border-left:1px solid var(--ug-line);margin-left:4px">' +
          '<span class="ug-col ug-top-user" style="gap:0;align-items:flex-end"><span style="font-size:12px;font-weight:600">' + esc(role.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(role.scope) + '</span></span>' +
          '<span class="ug-av">' + esc(role.initials) + '</span>' +
        '</div>' +
      '</div>' +
    '</header>';
  }

  function pageHead(title, sub, actions){
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  /* ---- dashboard (feature 2) ---- */
  function dDashboard(st){
    const incidents = U.DATA.incidents;
    const recent = incidents.slice(0, 3);
    return '<div class="ug-col" style="gap:14px">' +
      pageHead('Operations Dashboard', 'Real-time monitoring and incident command overview for ' + U.DATA.city + '.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('nav', attr({ route: 'analytics' })) + '>' + I('layers', 15) + 'Analytics</button>' +
        '<button class="ug-btn ug-btn--danger"' + A('declare') + '>' + I('alert', 16) + 'Declare Emergency</button>') +
      '<div class="ug-dgrid4">' + U.DATA.kpis.map(U.stat).join('') + '</div>' +
      '<div class="ug-dgrid-main">' +
        '<div class="ug-card"><div class="ug-card-h" style="padding:14px 16px">' +
          '<div><h3>Live Operations Map</h3><span class="ug-dimmer" style="font-size:10.5px">Active incident perimeters and deployed units</span></div>' +
          '<div class="ug-rowf ug-gap8" style="gap:6px">' +
            '<span class="ug-chip is-on">' + I('radar', 13) + 'Realtime</span>' +
            '<span class="ug-chip">' + I('layers', 13) + 'Layers</span></div></div>' +
          '<div class="ug-map" data-map="live" style="height:260px">' + U.mapSVG({ animated: true }) + U.mapLegend() +
            '<div class="map-scale">1 : 25 000</div></div></div>' +
        '<div class="ug-card ug-col" style="min-height:0"><div class="ug-card-h" style="padding:14px 16px">' +
          '<div><h3>Recent Incidents</h3><span class="ug-dimmer" style="font-size:10.5px">Newest first, all barangays</span></div>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'incidents' })) + '>View All</button></div>' +
          '<div class="ug-rows ug-scroll" style="max-height:330px">' + recent.map(i =>
            '<div class="ug-row"><span class="r-dot" style="background:' + (U.SEV[i.sev] || U.SEV.advisory).color + '"></span>' +
              '<div class="r-main"><div class="r-t">' + esc(i.hazard) + '<span class="ug-badge ug-badge--id">' + esc(i.id) + '</span></div>' +
                '<div class="r-m"><span>' + I('pin', 12) + esc(i.area) + ', ' + esc(i.brgy) + '</span></div>' +
                '<div class="r-m"><span>' + I('clock', 12) + esc(i.time) + '</span><span>' + I('shield', 12) + i.corr + ' corroborations</span></div></div>' +
              U.stageBadge(i.status) + '</div>').join('') + '</div></div>' +
      '</div>' +
      '<div class="ug-dgrid3">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Incidents by Hazard Type</h3><span class="ug-dimmer ug-mono" style="font-size:10px">' + (U.DATA.counts ? U.DATA.counts.incidents : 0) + ' ON RECORD</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:9px">' +
            (function () {
              const rows = hazardRows(5);
              if (!rows.length) return '<div class="ug-dim" style="font-size:12px">No reports in the last 30 days.</div>';
              const max = Math.max(rows[0][1], 4);
              return rows.map(x => '<div class="ug-col" style="gap:5px"><div class="ug-rowf ug-between" style="font-size:11.5px">' +
                '<span>' + esc(x[0]) + '</span><span class="ug-mono">' + x[1] + '</span></div>' +
                '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden">' +
                '<div style="height:100%;width:' + Math.round(x[1] / max * 100) + '%;background:' + x[2] + '"></div></div></div>').join('');
            })() +
          '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Active Advisories</h3><span class="ug-chip is-on" style="font-size:10px">' + U.DATA.advisories.slice(0, 2).filter(a => a.severity !== 'prepared').length + ' live</span></div>' +
          '<div class="ug-rows">' + U.DATA.advisories.slice(0, 2).map(a =>
            '<div class="ug-row"><span class="r-dot" style="background:' + U.SEV[a.severity].color + '"></span>' +
              '<div class="r-main"><div class="r-t" style="font-size:12.5px">' + esc(a.title) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(a.area) + '</span><span>' + esc(a.time) + '</span></div></div>' +
              U.sevBadge(a.severity) + '</div>').join('') + '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Readiness</h3></div><div class="ug-card-b ug-col" style="gap:11px">' +
          [['Shelters open', (U.DATA.counts ? U.DATA.counts.openCenters : U.DATA.centers.filter(c => c.status === 'open').length) + ' of ' + U.DATA.centers.length, 'prepared'],
           ['Units assigned', (U.DATA.counts ? U.DATA.counts.units : 0) + ' deployed', 'verified'],
           ['Corroboration rate', ((U.DATA.analytics && U.DATA.analytics.corroborationRate) || 0) + '%', 'prepared']]
            .map(x => '<div class="ug-rowf ug-between" style="gap:10px;font-size:12px"><span class="ug-dim">' + x[0] + '</span>' +
              '<span class="ug-mono" style="color:var(--ug-' + x[2] + ')">' + x[1] + '</span></div>').join('') +
        '</div></div>' +
      '</div>' +
    '</div>';
  }

  /* ---- incident queue (feature 5) ---- */
  function dIncidents(st){
    const f = st.sevFilter;
    const chips = [['all', 'All'], ['reported', UG_THEME.STATUS.reported.label], ['verified', UG_THEME.STATUS.verified.label],
      ['dispatched', UG_THEME.STATUS.dispatched.label], ['resolved', UG_THEME.STATUS.resolved.label], ['rejected', UG_THEME.STATUS.rejected.label]];
    const list = U.DATA.incidents.filter(i => f === 'all' || i.status === f);
    const action = (i) => {
      if (i.status === 'reported') return '<button class="ug-btn ug-btn--sm"' + A('advance', attr({ id: i.id })) + '>Verify</button>';
      if (i.status === 'verified') return '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('advance', attr({ id: i.id })) + '>Dispatch</button>';
      if (i.status === 'dispatched') return '<button class="ug-btn ug-btn--sm"' + A('advance', attr({ id: i.id })) + '>Resolve</button>';
      if (i.status === 'rejected') return '<span class="ug-dimmer" style="font-size:11px;display:flex;align-items:center;gap:5px">' + I('x', 13) + 'Rejected</span>';
      return '<span class="ug-dimmer" style="font-size:11px;display:flex;align-items:center;gap:5px">' + I('check', 13) + 'Closed</span>';
    };
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Incident Queue', 'Track every report through reported, verified, response dispatched and resolved.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('nav', attr({ route: 'hotlines' })) + '>' + I('sort', 15) + 'Priority Sort</button>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('nav', attr({ route: 'dashboard' })) + '>' + I('grid', 15) + 'Command View</button>') +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('sev-filter', attr({ v: c[0] })) + '>' + c[1] +
        '<span class="ug-mono" style="opacity:.7">' + (c[0] === 'all' ? U.DATA.incidents.length : U.DATA.incidents.filter(x => x.status === c[0]).length) + '</span></button>').join('') +
        '<span class="ug-dimmer" style="margin-left:auto;font-size:11px;display:flex;align-items:center;gap:6px">' + I('target', 13) + 'Scope: ' + esc((U.DATA.roles.find(r => r.id === st.role) || {}).scope || '') + '</span></div>' +
      '<div class="ug-card"><div class="ug-ticks" style="grid-template-columns:1.2fr 2.4fr 1.1fr 1fr .7fr 1.1fr .9fr;padding:11px 16px;font-size:10px">' +
        '<span>Status</span><span>Hazard / description</span><span>Barangay</span><span>Corroboration</span><span>Age</span><span>Severity</span><span style="text-align:right">Action</span>' +
      '</div>' + (list.length ? list.map(i =>
        '<div class="ug-trow" style="grid-template-columns:1.2fr 2.4fr 1.1fr 1fr .7fr 1.1fr .9fr">' +
          '<span>' + U.stageBadge(i.status) + '</span>' +
          '<span class="ug-rowf ug-gap10" style="gap:10px;min-width:0"><span style="color:' + U.SEV[i.sev].color + ';display:flex">' + I('alert', 16) + '</span>' +
            '<span style="min-width:0"><span class="ug-mono" style="font-size:10.5px;color:var(--ug-ink-3)">' + esc(i.id) + '</span>' +
            '<span style="display:block;font-size:12.5px;font-weight:600">' + esc(i.hazard) + '</span>' +
            '<span class="ug-dimmer" style="display:block;font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px">' + esc(i.desc) + '</span></span></span>' +
          '<span style="font-size:12px">' + esc(i.brgy) + '<span class="ug-dimmer" style="display:block;font-size:10.5px">' + esc(i.area) + '</span></span>' +
          '<span class="ug-rowf" style="gap:7px"><span class="ug-mono" style="font-size:12px;color:' + (i.corr >= 3 ? 'var(--ug-prepared)' : 'var(--ug-warning)') + '">' + i.corr + '/3</span>' +
            (i.corr >= 3 ? '<span class="ug-badge ug-badge--resolved" style="font-size:9px">Auto</span>' : '') + '</span>' +
          '<span class="ug-mono" style="font-size:11.5px;color:var(--ug-ink-2)">' + esc(i.time) + '</span>' +
          '<span class="ug-rowf ug-gap6" style="gap:6px">' + U.ladder(i.sev) + U.sevBadge(i.sev) + '</span>' +
          '<span class="ug-rowf ug-gap8" style="gap:6px;justify-content:flex-end">' + action(i) +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost ug-btn--icon" aria-label="Open incident"' + A('open-incident', attr({ id: i.id })) + '>' + I('chevron', 15) + '</button></span>' +
        '</div>').join('') : '<div class="ug-empty"><span class="e-ico">' + I('inbox', 20) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No Incidents in This Stage</div>' +
          '<div style="font-size:11px">Change the status filter to see other reports.</div></div>') + '</div>' +
    '</div>';
  }

  /* ---- incident detail (feature 4 + 5) ---- */
  function dIncident(st){
    const i = U.DATA.incidents.find(x => x.id === st.openId) || U.DATA.incidents[0];
    const corr = st.corr[i.id] != null ? st.corr[i.id] : i.corr;
    const status = (corr >= 3 && i.status === 'reported') ? 'verified' : i.status;
    const corrRows = ['Marites Aquino', 'Joel Villanueva', 'Andrea Fernandez'].slice(0, Math.min(2, corr));
    return '<div class="ug-col" style="gap:14px">' +
      '<div class="ug-rowf ug-between ug-wrap" style="gap:12px;align-items:flex-start">' +
        '<div class="ug-rowf ug-gap12" style="gap:12px;align-items:flex-start">' +
          '<button class="ug-btn ug-btn--ghost ug-btn--icon" aria-label="Back"' + A('nav', attr({ route: 'incidents' })) + '>' +
            '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 16) + '</span></button>' +
          '<div><div class="ug-rowf ug-gap8" style="gap:8px">' + U.sevBadge(i.sev) + U.stageBadge(status) +
            '<span class="ug-badge ug-badge--id">' + esc(i.id) + '</span></div>' +
          '<h2 style="font-size:20px;margin-top:8px">' + esc(i.hazard) + '</h2>' +
          '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(i.area) + ', ' + esc(i.brgy) + ' &middot; reported ' + esc(i.time) + '</p></div>' +
        '</div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<button class="ug-btn ug-btn--sm"' + A('load-responders') + '>' + I('truck', 15) + 'Assign Units</button>' +
          (status !== 'resolved' && status !== 'rejected' ? '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('advance', attr({ id: i.id })) + '>' + I('check', 15) + 'Advance Status</button>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('reject', attr({ id: i.id })) + '>' + I('x', 15) + 'Reject</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ug-dgrid-detail">' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Field Evidence</h3><span class="ug-dimmer ug-mono" style="font-size:10px">' + esc(i.id) + '_ev.jpg</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' + (i.thumb ? U.thumb(i.thumb, 'bn-img', 'height:110px') : '') +
              '<p class="ug-dim ug-clamp3" style="font-size:12.5px;line-height:1.6">' + esc(i.desc) + '</p>' +
              '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;font-size:11px;color:var(--ug-ink-3)">' +
                '<span class="ug-rowf" style="gap:5px">' + I('camera', 13) + 'Photo attached</span>' +
                '<span class="ug-rowf" style="gap:5px">' + I('pin', 13) + (
                  (typeof i.lat === 'number' && typeof i.lng === 'number')
                    ? esc(UG_GEO.fmt(i.lat, i.lng)) + (i.accuracy ? ' (' + esc(i.accuracy) + ' m)' : '')
                    : 'No coordinates recorded') + '</span>' +
                '<span class="ug-rowf" style="gap:5px">' + I('clock', 13) + 'Today, ' + esc(i.time) + '</span></div>' +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Location</h3></div><div class="ug-card-b" style="padding:0">' +
            '<div class="ug-map" data-map="detail" style="height:142px;border:0;border-radius:0">' + U.mapSVG({}) + '</div></div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Activity Log</h3></div>' +
            '<div class="ug-card-b ug-col" style="gap:11px">' +
              [['Reported', (i.lat != null && i.lng != null) ? 'GPS and photo attached where available' : 'Coordinates not recorded', UG_UTIL.relTime(i)],
               ['Corroborations', (i.corr || 0) + ' of ' + ((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.CORROBORATION_THRESHOLD) || 3) + ' needed to auto-verify', UG_UTIL.relTime(i)],
               ['Current status', (UG.STAGES.filter(x => x.key === i.status)[0] || { label: i.status }).label, UG_UTIL.relTime(i)]]
                .map(l => '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
                  '<span class="r-dot" style="background:var(--ug-signal);margin-top:6px"></span>' +
                  '<div style="flex:1"><div style="font-size:12.5px;font-weight:600">' + esc(l[0]) + '</div>' +
                  '<div class="ug-dimmer" style="font-size:11px;margin-top:2px">' + esc(l[1]) + '</div></div>' +
                  '<span class="ug-dimmer ug-mono" style="font-size:10.5px">' + esc(l[2]) + '</span></div>').join('') +
            '</div></div>' +
        '</div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Status Pipeline</h3></div><div class="ug-card-b">' + U.pipeline(status) + '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Crowd Corroboration</h3>' + U.badge(corr >= 3 ? 'resolved' : 'warning', corr + ' of 3') + '</div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' + U.corrMeter(corr) +
              corrRows.map((n, k) =>
              '<div class="ug-rowf ug-gap10" style="gap:9px"><span class="ug-av" style="width:26px;height:26px;font-size:10px">' + esc(n.split(' ').map(w => w[0]).join('')) + '</span>' +
                '<span style="font-size:12px">' + esc(n) + '</span>' +
                '<span class="ug-dimmer ug-mono" style="font-size:10px;margin-left:auto">' + (k + 1) + 'm ago</span></div>').join('') +
              '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('confirm-corr', attr({ id: i.id })) + '>' + I('plus', 14) + 'Log Corroboration</button>' +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Assignment</h3></div><div class="ug-card-b ug-col" style="gap:11px">' +
            [['Barangay scope', i.brgy], ['Assigned units', i.units ? i.units + ' deployed' : 'None Yet'], ['Priority', U.SEV[i.sev].label]]
              .map(x => '<div class="ug-rowf ug-between" style="gap:10px;font-size:12px"><span class="ug-dim">' + esc(x[0]) + '</span><span style="font-weight:600">' + esc(x[1]) + '</span></div>').join('') +
          (typeof UG_ADMIN !== 'undefined' ? '<div class="ug-hr" style="margin:12px 0"></div>' + UG_ADMIN.assignmentPanel(st, i) : '') +
          '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- advisories composer (feature 6 + 11) ---- */
  function dAdvisories(st){
    const d = st.draft;
    const ready = d.title.trim() && d.msg.trim();
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Advisories and Alerts', 'Publish official broadcasts and preparedness content to residents.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('nav', attr({ route: 'analytics' })) + '>' + I('eye', 15) + 'Reach Report</button>') +
      '<div class="ug-dgrid-compose">' +
        '<div class="ug-card ug-tick"><div class="ug-card-h"><h3>Compose Broadcast</h3>' +
          '<span class="ug-chip">' + I(st.offline ? 'wifioff' : 'bell', 13) + (st.offline ? 'Queued offline' : 'Push enabled') + '</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:0">' +
            '<div class="ug-field"><label class="ug-lab">Advisory title</label>' +
              '<input class="ug-in" data-field="advTitle" value="' + esc(d.title) + '" placeholder="e.g. Flood warning: Pangapisan North"></div>' +
            '<div class="ug-rowf ug-gap12" style="gap:12px">' +
              '<div class="ug-field" style="flex:1"><label class="ug-lab">Severity</label>' +
                '<select class="ug-sel" data-field="advSev" aria-label="Severity">' +
                [['emergency', 'Emergency'], ['warning', 'Warning'], ['advisory', 'Advisory'], ['prepared', 'Preparedness']]
                  .map(s => '<option value="' + s[0] + '"' + (d.sev === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select></div>' +
              '<div class="ug-field" style="flex:1"><label class="ug-lab">Broadcast type</label>' +
                '<select class="ug-sel" data-field="advType" aria-label="Broadcast type">' +
                ['Emergency', 'Preparedness'].map(s => '<option' + (d.type === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
            '</div>' +
            '<div class="ug-field"><label class="ug-lab">Affected area</label>' +
              '<select class="ug-sel" data-field="advArea" aria-label="Affected area">' +
              [UG_GEO.PLACE.areaAll].concat(U.DATA.barangays)
                .map(s => '<option' + (d.area === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></div>' +
            '<div class="ug-field"><label class="ug-lab">Message</label>' +
              '<textarea class="ug-ta" rows="4" data-field="advMsg" placeholder="Write the advisory residents will receive as a push notification.">' + esc(d.msg) + '</textarea>' +
              '<div class="ug-help">Keep it short. Residents read this on a lock screen during an emergency.</div></div>' +
            '<div class="ug-rowf ug-gap8" style="gap:8px">' +
              '<button class="ug-btn ug-btn--signal' + (ready ? '' : ' is-disabled') + '"' + A('publish') + '>' + I('megaphone', 16) + 'Publish Broadcast</button>' +
              '<button class="ug-btn ug-btn--ghost"' + A('clear-draft') + '>Clear</button>' +
              '<span class="ug-dimmer" style="margin-left:auto;font-size:11px;display:flex;align-items:center;gap:6px">' + I('users', 13) + 'Reach ' + (U.DATA.subscribedDevices != null ? U.DATA.subscribedDevices : 0) + ' subscribed devices</span></div>' +
          '</div></div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Preview</h3><span class="ug-dimmer" style="font-size:10.5px">Lock Screen</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' +
              '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start;background:rgba(255,255,255,.03);border:1px solid var(--ug-line);border-radius:10px;padding:11px">' +
                U.brandMark(26) +
                '<span class="ug-col" style="gap:2px;min-width:0"><span class="ug-rowf" style="gap:6px"><span style="font-size:11.5px;font-weight:700">UniGuard</span>' +
                '<span class="ug-dimmer ug-mono" style="font-size:9.5px">now</span></span>' +
                '<span style="font-size:12.5px;font-weight:600">' + esc(d.title || 'Advisory title appears here') + '</span>' +
                '<span class="ug-dim ug-clamp3" style="font-size:11.5px;line-height:1.45">' + esc(d.msg || 'Your message appears here as residents will see it.') + '</span></span>' +
              '</div>' +
              '<div class="ug-rowf ug-gap8" style="gap:6px">' + U.sevBadge(d.sev) + U.badge('id', d.type) +
                '<span class="ug-dimmer ug-rowf" style="font-size:10.5px;gap:4px;margin-left:auto">' + I('pin', 12) + esc(d.area) + '</span></div>' +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Published</h3>' +
            '<span class="ug-chip is-on">' + U.DATA.advisories.filter(a => a.severity !== 'prepared').length + ' emergency</span></div>' +
            '<div class="ug-rows ug-scroll" style="max-height:330px">' + U.DATA.advisories.map(a =>
              '<div class="ug-row"><span class="r-dot" style="background:' + U.SEV[a.severity].color + '"></span>' +
                '<div class="r-main"><div class="r-t" style="font-size:12.5px">' + esc(a.title) + '</div>' +
                '<div class="r-m"><span>' + I('pin', 12) + esc(a.area) + '</span><span>' + esc(a.type) + '</span><span>' + esc(a.time) + '</span></div></div>' +
                U.sevBadge(a.severity) + '</div>').join('') + '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- centres management (feature 7) ---- */
  function dCenters(st){
    const counts = ['open', 'full', 'closed'].map(s => [s, U.DATA.centers.filter(c => c.status === s).length]);
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Evacuation Centers', 'Keep capacity and availability accurate so residents arrive at a shelter with space.',
        '<span class="ug-chip is-on">' + I('shelter', 13) + counts[0][1] + ' open</span>' +
        '<span class="ug-chip">' + I('shelter', 13) + counts[1][1] + ' full</span>' +
        '<span class="ug-chip">' + I('shelter', 13) + counts[2][1] + ' closed</span>') +
      '<div class="ug-dgrid-centers">' + U.DATA.centers.map(c => {
        const pct = Math.min(100, Math.round(c.occ / c.cap * 100));
        const geoState = UG_GEO.classify(c.lat, c.lng);
        return '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:12px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><h3 style="font-size:13.5px">' + esc(c.name) + '</h3>' + U.badge(c.status, c.status.charAt(0).toUpperCase() + c.status.slice(1)) + '</div>' +
          '<div class="ug-dimmer ug-rowf ug-wrap" style="font-size:11px;gap:10px"><span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(c.brgy) + '</span>' +
            '<span class="ug-rowf" style="gap:4px">' + I('layers', 12) + esc(c.id) + '</span>' +
            (geoState === 'ok' ? '<span class="ug-rowf" style="gap:4px">' + I('map', 12) + esc(UG_GEO.fmt(c.lat, c.lng)) + '</span>' : '') + '</div>' +
          '<div class="ug-rowf ug-between" style="font-size:11.5px"><span class="ug-dim">Occupancy</span>' +
            '<span class="ug-mono">' + c.occ + ' / ' + c.cap + ' &middot; ' + pct + '%</span></div>' + occBar(c.occ, c.cap) +
          '<div class="ug-dim" style="font-size:11.5px">' + esc(c.note) + '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:6px">' +
            ['open', 'full', 'closed'].map(s => '<button class="ug-btn ug-btn--sm' + (c.status === s ? ' ug-btn--signal' : '') + '" style="flex:1"' +
              A('center-status', attr({ id: c.id, s: s })) + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>').join('') +
          '</div>' +
          (geoState === 'ok'
            ? '<a class="ug-waze-btn" style="width:100%" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(c.lat, c.lng) + '">' + I('route', 13) + 'Navigate with Waze</a>'
            : '<div class="ug-help">' + esc(UG_GEO.message(geoState)) + ' — Waze navigation is hidden until it has valid coordinates.</div>') +
          '</div></div>';
      }).join('') + '</div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>Add Evacuation Center</h3><span class="ug-dimmer" style="font-size:10.5px">Appears to citizens immediately</span></div>' +
        '<div class="ug-card-b"><div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
          '<div class="ug-field" style="flex:2;min-width:220px;margin:0"><label class="ug-lab">Center Name</label><input class="ug-in" data-field="centerName" placeholder="e.g. Lingayen Central Elementary School"></div>' +
          '<div class="ug-field" style="flex:1;min-width:150px;margin:0"><label class="ug-lab">Barangay</label><select class="ug-sel" data-field="centerBarangay" aria-label="Barangay">' +
            U.DATA.barangays.map(b => '<option>' + esc(b) + '</option>').join('') + '</select></div>' +
          '<div class="ug-field" style="flex:0 0 130px;margin:0"><label class="ug-lab">Capacity</label><input class="ug-in" data-field="centerCapacity" placeholder="400" inputmode="numeric"></div>' +
          '<div class="ug-field" style="flex:0 0 130px;margin:0"><label class="ug-lab">Latitude</label><input class="ug-in" data-field="centerLat" placeholder="16.0206" inputmode="decimal"></div>' +
          '<div class="ug-field" style="flex:0 0 130px;margin:0"><label class="ug-lab">Longitude</label><input class="ug-in" data-field="centerLng" placeholder="120.2306" inputmode="decimal"></div>' +
          '<button class="ug-btn ug-btn--ghost"' + A('center-locate') + '>' + I('pin', 15) + 'Use My Location</button>' +
          '<button class="ug-btn ug-btn--signal"' + A('add-center') + '>' + I('plus', 15) + 'Add Center</button>' +
        '</div><div class="ug-help">Coordinates are optional but required for the Waze navigation button to appear. Example: ' + esc(UG_GEO.EXAMPLE) + '.</div></div></div>' +
    '</div>';
  }

  /* ---- hotlines management (feature 8) ---- */
  function dHotlines(st){
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Emergency Hotlines', 'A single verified list for barangay and city offices, cached offline on every device.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('export-hotlines') + '>' + I('download', 15) + 'Export</button>') +
      '<div class="ug-dgrid-hotlines">' + U.DATA.hotlines.map(h =>
        '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:10px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><span class="ug-lab">' + esc(h.type) + '</span>' + I('phone', 16) + '</div>' +
          '<h3 style="font-size:13.5px">' + esc(h.agency) + '</h3>' +
          '<div class="ug-mono" style="font-size:17px;color:var(--ug-signal)">' + esc(h.number) + '</div>' +
          '<div class="ug-dim" style="font-size:11.5px">' + esc(h.scope) + '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:6px">' +
            '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('edit-hotline', attr({ id: h.id })) + '>' + I('settings', 14) + 'Edit</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('verify-hotline', attr({ id: h.id })) + '>' + I('check', 14) + 'Verify</button>' +
          '</div></div></div>').join('') +
      '</div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>Add Hotline</h3></div>' +
        '<div class="ug-card-b"><div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
          '<div class="ug-field" style="flex:2;min-width:200px;margin:0"><label class="ug-lab">Agency</label><input class="ug-in" data-field="hotlineAgency" placeholder="e.g. Bureau of Fire Protection"></div>' +
          '<div class="ug-field" style="flex:1;min-width:160px;margin:0"><label class="ug-lab">Contact number</label><input class="ug-in" data-field="hotlineNumber" placeholder="(075) 000-0000"></div>' +
          '<div class="ug-field" style="flex:1;min-width:160px;margin:0"><label class="ug-lab">Scope</label><input class="ug-in" data-field="hotlineScope" placeholder="Fire and rescue"></div>' +
          '<button class="ug-btn ug-btn--signal"' + A('add-hotline') + '>' + I('plus', 15) + 'Add</button>' +
        '</div></div></div>' +
    '</div>';
  }

  /* ---- analytics (feature 2 + 5) ---- */
  function dAnalytics(st){
    const an = U.DATA.analytics || {};
    const cnt = U.DATA.counts || {};
    const trend = (an.daily && an.daily.length) ? an.daily : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Analytics and Reporting', 'City-wide telemetry across hazards, response times and verification quality.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('export-analytics') + '>' + I('doc', 15) + 'Export Report</button>') +
      '<div class="ug-dgrid4">' +
        U.stat({ label: 'Reports This Week', value: String(an.weekTotal || 0), delta: (an.weekDelta >= 0 ? '+' : '') + (an.weekDelta || 0) + '% vs previous week', dir: (an.weekDelta >= 0 ? 'up' : 'down'), tone: 'advisory', icon: 'inbox' }) +
        U.stat({ label: 'Verified Share', value: (an.autoVerifiedShare || 0) + '%', delta: (an.total || 0) + ' reports on record', dir: 'flat', tone: 'resolved', icon: 'shield' }) +
        U.stat({ label: 'Corroboration Rate', value: (an.corroborationRate || 0) + '%', delta: 'Reports reaching three confirmations', dir: 'flat', tone: 'prepared', icon: 'clock' }) +
        U.stat({ label: 'Shelters at Capacity', value: String(cnt.fullCenters || 0), delta: (cnt.openCenters || 0) + ' open of ' + (cnt.centers || 0), dir: 'flat', tone: 'warning', icon: 'shelter' }) +
      '</div>' +
      '<div class="ug-dgrid3">' +
        '<div class="ug-card" style="grid-column:span 2"><div class="ug-card-h"><h3>Incident Trend, Last 14 Days</h3>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px"><span class="ug-dimmer ug-mono" style="font-size:10px">REPORTS PER DAY</span>' +
          '<span class="ug-chip is-on">' + I('wave', 13) + 'All hazards</span></div></div>' +
          '<div class="ug-card-b">' + trendSVG(trend) +
            '<div class="ug-rowf ug-between ug-mt8" style="font-size:10px;color:var(--ug-ink-3);padding-left:36px;padding-right:2px">' +
              '<span>13 days ago</span><span>10 days ago</span><span>7 days ago</span><span>4 days ago</span><span>Today</span></div></div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Pipeline Load</h3></div><div class="ug-card-b ug-col" style="gap:12px">' +
          U.STAGES.map(s => {
            const n = U.DATA.incidents.filter(i => i.status === s.key).length;
            const pct = Math.round(n / U.DATA.incidents.length * 100);
            return '<div class="ug-col" style="gap:6px"><div class="ug-rowf ug-between" style="font-size:11.5px">' +
              '<span style="color:' + s.color + ';font-weight:600">' + s.label + '</span><span class="ug-mono">' + n + (n === 1 ? ' report' : ' reports') + '</span></div>' +
              '<div style="height:5px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden"><div style="height:100%;width:' + Math.max(6, pct) + '%;background:' + s.color + '"></div></div></div>';
          }).join('') + '</div></div>' +
      '</div>' +
      '<div class="ug-dgrid2">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Hazard Type Distribution</h3><span class="ug-dimmer ug-mono" style="font-size:10px">REPORTS THIS WEEK</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:12px">' +
            (function () {
              const rows = hazardRows(6);
              if (!rows.length) return '<div class="ug-dim" style="font-size:12px">No reports recorded yet.</div>';
              const max = Math.max(rows[0][1], 4);
              return rows.map(x => '<div class="ug-col" style="gap:6px"><div class="ug-rowf ug-between" style="font-size:11.5px">' +
                '<span>' + esc(x[0]) + '</span><span class="ug-mono">' + x[1] + '</span></div>' +
                '<div style="height:6px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden"><div style="height:100%;width:' + Math.round(x[1] / max * 100) + '%;background:' + x[2] + '"></div></div></div>').join('');
            })() +
          '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Corroboration Quality</h3></div>' +
          '<div class="ug-card-b ug-col" style="gap:14px">' +
            '<div class="ug-rowf ug-gap16" style="gap:16px;align-items:flex-end">' +
              '<div><div class="ug-mono" style="font-size:30px;font-weight:700;color:var(--ug-prepared)">' + (an.corroborationRate || 0) + '%</div>' +
              '<div class="ug-dimmer" style="font-size:10.5px">of reports reached three confirmations</div></div>' +
              '<div style="flex:1">' + U.corrMeter(3) + '</div>' +
            '</div>' +
            '<div class="ug-hr"></div>' +
            '<div class="ug-dim" style="font-size:11.5px;line-height:1.6">Corroboration keeps the queue moving when call volumes spike. Only reports that reach three independent confirmations in the same barangay skip manual review; everything else stays with the duty officer.</div>' +
          '</div></div>' +
      '</div>' +
    '</div>';
  }

  /* ================================================================== */
  /* frame assembly                                                      */
  /* ================================================================== */
  function mobileBody(st){
    switch (st.route) {
      case 'home': return mHome(st);
      case 'report': return mReport(st);
      case 'report-done': return mReportDone(st);
      case 'reports': return mReports(st);
      case 'report-detail': return mReportDetail(st);
      case 'advisories': return mAdvisories(st);
      case 'advisory-detail': return mAdvisoryDetail(st);
      case 'centers': return mCenters(st);
      case 'hotlines': return mHotlines(st);
      case 'notifications': return mNotifications(st);
      case 'offline': return mOffline(st);
      default: return mHome(st);
    }
  }

  const MTITLES = {
    home: ['UniGuard', UG_GEO.PLACE.label],
    report: ['Report a Hazard', 'Multi-Hazard Reporting'],
    'report-done': ['Report Submitted', 'Awaiting Corroboration'],
    reports: ['My Reports', 'Incident Status Tracking'],
    'report-detail': ['Report Detail', 'Tracking and Corroboration'],
    advisories: ['Advisories', 'Official broadcasts'],
    'advisory-detail': ['Advisory', 'Official broadcast'],
    centers: ['Shelters', 'Evacuation Centers'],
    hotlines: ['Hotlines', 'Emergency numbers'],
    notifications: ['Notifications', 'Push alerts'],
    offline: ['Offline', 'Cached Essentials'],
  };

  function frameMobile(st){
    const t = MTITLES[st.route] || MTITLES.home;
    return '<div class="ug ug-frame ug-m' + (st.fixed ? ' ug-fixed' : '') + '"' +
      (st.fixed ? ' style="width:' + st.w + 'px;height:' + st.h + 'px"' : '') + '>' +
      '<div class="ug-m-shell">' +
        mAppbar(st, t[0], t[1]) +
        (st.offline && st.route !== 'offline' ? '<div class="ug-offline">' + I('wifioff', 14) +
          '<span>Offline mode. Showing cached data synced ' + esc(U.DATA.offlineCache.synced) + '.</span>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('toggle-offline') + '>Go live</button></div>' : '') +
        '<div class="ug-m-body ug-scroll">' + mobileBody(st) + '</div>' +
        mTabbar(st) +
      '</div>' +
    '</div>';
  }

  const DTITLES = {
    dashboard: ['UniGuard Command Console', UG_GEO.PLACE.label],
    incidents: ['UniGuard Command Console', UG_GEO.PLACE.label],
    incident: ['UniGuard Command Console', UG_GEO.PLACE.label],
    advisories: ['UniGuard Command Console', UG_GEO.PLACE.label],
    centers: ['UniGuard Command Console', UG_GEO.PLACE.label],
    hotlines: ['UniGuard Command Console', UG_GEO.PLACE.label],
    analytics: ['UniGuard Command Console', UG_GEO.PLACE.label],
    notifications: ['UniGuard Command Console', UG_GEO.PLACE.label],
    offline: ['UniGuard Command Console', UG_GEO.PLACE.label],
  };

  function desktopBody(st){
    switch (st.route) {
      case 'dashboard': return dDashboard(st);
      case 'incidents': return dIncidents(st);
      case 'incident': return dIncident(st);
      case 'advisories': return dAdvisories(st);
      case 'centers': return dCenters(st);
      case 'hotlines': return dHotlines(st);
      case 'analytics': return dAnalytics(st);
      case 'notifications': return (function(){ // reuse mobile inbox inside a desktop panel
        return '<div class="ug-col" style="gap:18px">' + pageHead('Push notification log', 'Every alert delivered to citizen devices.',
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('read-all') + '>Mark All Read</button>') +
          '<div style="max-width:760px">' + mNotifications(st) + '</div></div>';
      })();
      case 'offline': return '<div class="ug-col" style="gap:18px">' + pageHead('Offline sync', 'Progressive web app cache keeps essentials available when networks fail.') +
        '<div style="max-width:760px">' + mOffline(st) + '</div></div>';
      default: return (typeof UG_ADMIN !== 'undefined' && UG_ADMIN.handles(st.route)) ? UG_ADMIN.body(st) : dDashboard(st);
    }
  }

  function frameDesktop(st){
    const t = DTITLES[st.route] || DTITLES.dashboard;
    return '<div class="ug ug-frame ug-d' + (st.fixed ? ' ug-fixed' : '') + '"' +
      (st.fixed ? ' style="width:' + st.w + 'px;height:' + st.h + 'px"' : '') + '>' +
      '<div class="ug-d-shell">' + dSidebar(st) +
        '<div class="ug-nav-scrim" data-act="close-nav" aria-hidden="true"></div>' +
        '<div class="ug-d-main">' + dTopbar(st, t[0], t[1]) +
          (st.offline ? '<div class="ug-offline">' + I('wifioff', 14) + '<span>Working offline. Changes are queued and will sync automatically.</span></div>' : '') +
          '<div class="ug-d-body ug-scroll">' + desktopBody(st) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function frame(st){
    if (st.role === 'citizen') {
      if (st.view === 'desktop') return UG_WEB.frameCitizenWeb(Object.assign({}, st, { session: sess(st) }));
      return frameMobile(Object.assign({}, st, { route: MOB(st.route), session: sess(st) }));
    }
    return frameDesktop(Object.assign({}, st, { route: DESK(st.route), session: sess(st) }));
  }

  /* map a shared route name onto a mobile / desktop route */
  const MOB = (r) => ({ notifications:'notifications', offline:'offline', advisories:'advisories', centers:'centers', hotlines:'hotlines', home:'home', report:'report', reports:'reports' })[r] || r;
  const DESK = (r) => ({ notifications:'notifications', offline:'offline', advisories:'advisories', centers:'centers', hotlines:'hotlines', dashboard:'dashboard', home:'dashboard', incidents:'incidents', analytics:'analytics' })[r] || r;

  return { login, frame, frameMobile, frameDesktop, mobileBody, desktopBody, MOB, DESK, sess };
})();
