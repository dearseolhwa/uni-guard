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
    activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
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
    /* icons added for the new feature screens — kept here so the existing
       icon() helper picks them up just like every other icon. */
    sos:   '<path d="M12 2.5 4 5v6c0 5.2 3.4 8.4 8 9.5 4.6-1.1 8-4.3 8-9.5V5l-8-2.5Z"/><path d="M9.5 9.2a2.5 2.5 0 1 1 5 0c0 1.2-1.5 1.6-1.5 2.8"/><path d="M12 16.5h.01"/>',
    relief:'<path d="M4 9h16v11H4z"/><path d="M4 9l3-4h10l3 4"/><path d="M9 13h6"/>',
    guide: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H17l3 3v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z"/><path d="M8 9h7M8 13h5"/>',
    faq:   '<path d="M21 11a8 8 0 0 1-12 7L4 20l1-4.5A8 8 0 1 1 21 11Z"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><path d="M12 16.5h.01"/>',
    road2: '<path d="M7 3 4 21M17 3l3 18M12 6v3M12 12v3M12 18v2"/>',
    volcano:'<path d="M3 20 9 8l3 4 3-7 6 15Z"/><path d="M9 8l3 4 3-7"/>',
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
      { id:'lgu_ldrrmc',         name:'Cmdr. Elena Reyes',    title:'LDRRMO Head',                       initials:'ER', scope:UG_GEO.PLACE.scope },
    ],
    sessions: {
      citizen:           { name:'Marites Aquino',    initials:'MA', role:'citizen',           title:'Resident',         barangay:'Poblacion', scope:'Barangay Poblacion', email:'m.aquino@example.ph' },
      barangay_official: { name:'Reynaldo Soriano',  initials:'RS', role:'barangay_official', title:'Barangay Captain', barangay:'Poblacion', scope:'Barangay Poblacion', email:'r.soriano@lingayen.gov.ph' },
      lgu_ldrrmc:        { name:'Cmdr. Elena Reyes', initials:'ER', role:'lgu_ldrrmc',        title:'LDRRMO Head',      barangay:'',           scope:UG_GEO.PLACE.scope,   email:'e.reyes@lingayen.gov.ph' },
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
      /* Coordinates are polygon-verified against the official PSA barangay
         boundaries (migration 053) — see scripts/validate_proposed_coords.py.
         One earlier revision had "Pangapisan North" points out in the gulf and
         a Malawa incident plotted in Quibaol; every row below now sits inside
         the ring of the barangay it names. */
      { id:'UG-2026-0142', hazard:'Flood',              brgy:'Pangapisan North', area:'Coastal road near the barangay hall', status:'dispatched', sev:'emergency', time:'10m ago',  desc:'Knee-deep water across the coastal road; two households requesting evacuation assistance.', corr:3, thumb:'flood',     units:2, lat:16.0385, lng:120.2090 },
      { id:'UG-2026-0141', hazard:'Landslide / Soil Erosion', brgy:'Malawa',   area:'Slope along the barangay road',       status:'verified',   sev:'warning',   time:'45m ago',  desc:'Soil and debris covering the inner lane; one vehicle stalled, no injuries reported.',        corr:3, thumb:'landslide', units:1, lat:15.9558, lng:120.2713 },
      { id:'UG-2026-0140', hazard:'Storm Surge',        brgy:'Sabangan',      area:'Seawall along the gulf side',         status:'reported',   sev:'advisory',  time:'1h 12m ago', desc:'Waves overtopping the seawall at high tide; the shoreline path is closed to the public.',  corr:1, thumb:'surge',     units:0, lat:16.0290, lng:120.1560 },
      { id:'UG-2026-0139', hazard:'Fallen Tree',        brgy:'Domalandan West', area:'Along the barangay access road',    status:'resolved',   sev:'advisory',  time:'3h ago',   desc:'Fallen tree cleared by the barangay team; lane reopened to traffic.',                       corr:4, thumb:null,        units:0, lat:16.0090, lng:120.1840 },
      { id:'UG-2026-0138', hazard:'Fire',               brgy:'Poblacion',     area:'Near the public market',              status:'verified',   sev:'emergency', time:'2h 5m ago', desc:'Contained stall fire behind the market row; BFP monitoring for flare-ups.',                corr:2, thumb:null,        units:3, lat:16.0223, lng:120.2312 },
      { id:'UG-2026-0137', hazard:'River Overflow',     brgy:'Estanza',       area:'Low-lying farmland',                  status:'reported',   sev:'warning',   time:'22m ago',  desc:'Water level rising toward the first flood marker; residents advised to prepare go-bags.',   corr:2, thumb:'flood',     units:0, lat:16.0230, lng:120.1715 },
    ],
    advisories: [
      { id:'ADV-2026-061', title:'Flood Warning: Pangapisan North',        severity:'emergency', type:'Emergency',     area:'Pangapisan North, Pangapisan Sur', time:'12m ago', body:'Water has reached the first flood marker along the Pangapisan North coastal road. Residents within 200 m of the shoreline must prepare to move to the Pangapisan North Multi-Purpose Center. Bring water, medication, and identification.' },
      { id:'ADV-2026-060', title:'Suspension of Classes, All Levels',      severity:'warning',   type:'Emergency',     area:UG_GEO.PLACE.areaAll,               time:'1h ago',  body:'The Lingayen LDRRMO has suspended classes at all levels for today. Parents are advised to keep children indoors and monitor official channels.' },
      { id:'ADV-2026-059', title:'Coastal Advisory: Storm Surge Watch',    severity:'advisory',  type:'Emergency',     area:'Coastal barangays',                time:'3h ago',  body:'A storm surge watch is in effect for barangays along Lingayen Gulf. Small sea vessels are prohibited from sailing. The seawall areas are closed until further notice.' },
      { id:'ADV-2026-058', title:'Preparedness Drill: Duck, Cover, Hold',  severity:'prepared',  type:'Preparedness',  area:UG_GEO.PLACE.areaAll,               time:'2d ago',  body:'A municipality-wide earthquake drill will run at 9:00 AM this Friday. Households, schools, and offices are encouraged to join and time their duck, cover, and hold practice.' },
      { id:'ADV-2026-057', title:'Go-Bag Checklist for the Wet Season',    severity:'prepared',  type:'Preparedness',  area:UG_GEO.PLACE.areaAll,               time:'4d ago',  body:'Keep a go-bag ready: three days of water and non-perishable food, flashlight, batteries, first-aid kit, whistle, copies of documents, and a power bank.' },
    ],
    centers: [
      { id:'EC-01', name:'Pangapisan North Multi-Purpose Center', brgy:'Pangapisan North', status:'open',   occ:118, cap:250, note:'Priority for coastal households', lat:16.0330, lng:120.2080, facilities:['Medical station','Kitchen','Generator','Pet-friendly area'], contact_person:'Brgy. Captain Office', contact_phone:'0917-408-2210' },
      { id:'EC-02', name:'Narciso Ramos Sports and Civic Center', brgy:'Poblacion',        status:'full',   occ:620, cap:620, note:'No remaining slots', lat:16.03192, lng:120.22529, facilities:['Cots','Generator','Medical station','Feeding area'], contact_person:'LDRRMO Shelter Desk', contact_phone:'(075) 632-2222' },
      { id:'EC-03', name:'Lingayen Central Elementary School',    brgy:'Poblacion',         status:'open',   occ:84,  cap:300, note:'Medical station on site', lat:16.0219, lng:120.2320, facilities:['Classrooms','Medical station','Water supply'], contact_person:'Principal\'s Office', contact_phone:'(075) 632-2333' },
      { id:'EC-04', name:'Domalandan West Barangay Hall',         brgy:'Domalandan West',   status:'closed', occ:0,   cap:90,  note:'Undergoing roof repair', lat:16.0083, lng:120.1823, facilities:['Function hall','Water supply'], contact_person:'Brgy. Captain', contact_phone:'0917-408-2240' },
      { id:'EC-05', name:'Pangasinan National High School',       brgy:'Poblacion',         status:'open',   occ:210, cap:400, note:'Pet-friendly area available', lat:16.031292, lng:120.230322, facilities:['Classrooms','Pet-friendly area','Cots','Generator'], contact_person:'School DRRM Coordinator', contact_phone:'(075) 632-2344' },
    ],
    hotlines: [
      { agency:'Lingayen LDRRMO',           number:'(075) 632-2222',   scope:UG_GEO.PLACE.areaAll,  type:'emergency' },
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
    /* defaults the dispatch feature uses; Repo.loadDispatchDirectory overwrites them */
    dispatchUnits: [],
    dispatchEquipment: [],
    unitRequests: [],
    /* A2 (Oct 24 2026) — dispatch help requests; Repo.loadHelpRequests (LGU
       only) overwrites this when Supabase is reachable. */
    dispatchHelpRequests: [],
    /* 050 (Oct 25 2026) — equipment catalog, for the Add-equipment form's
       Type dropdown. Repo.loadDispatchDirectory overwrites this. */
    equipmentCatalog: [],
    /* change requests (master prompt · Emergency Hotlines approval).
       Repo.loadChangeRequests overwrites this when Supabase is reachable. */
    changeRequests: [],
    offlineCache: {
      get hotlines()   { return (DATA.hotlines || []).length; },
      get centers()    { return (DATA.centers || []).length; },
      get advisories() { return (DATA.advisories || []).filter(a => a.severity !== 'prepared').length; },
      get synced() {
        const at = (typeof UG_PWA !== 'undefined' && UG_PWA.state.lastSync) || null;
        return UG_UTIL.syncLabel(at);
      }
    },
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
  /* UG-wide i18n helper so every screen reads its visible strings through
     the dictionary. Same shape as the per-screen T() helpers below. */
  const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);

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
    /* if k.nav is set, wrap the card in a clickable button that routes to the
       corresponding module (Section 4: incident count cards open records). */
    const inner = '<div class="s-top"><span class="ug-lab">' + esc(k.label) + '</span>' +
      '<span class="s-ico" style="background:rgba(var(--ug-tint, 255,255,255),.05);color:var(--ug-' + k.tone + ')">' + icon(k.icon, 17) + '</span></div>' +
      '<div class="s-val">' + esc(k.value) + '</div>' +
      '<div class="s-delta ' + k.dir + '">' + (k.dir === 'up' ? '&#9650;' : k.dir === 'down' ? '&#9660;' : '&#8226;') + ' ' + esc(k.delta) + '</div>';
    if (k.nav) {
      return '<button class="ug-stat" data-act="nav" data-route="' + esc(k.nav) + '" style="text-align:left;cursor:pointer;width:100%;font:inherit;color:inherit" title="Open ' + esc(k.label) + '">' + inner + '</button>';
    }
    return '<div class="ug-stat">' + inner + '</div>';
  }
  function thumb(name, cls, style){
    if (!name || !IMG[name]) return '';
    return '<img class="' + (cls || 'r-thumb') + '" src="' + IMG[name] + '"' + (style ? ' style="' + style + '"' : '') + ' alt="Field photo evidence for the reported hazard">';
  }
  function photo(item, cls, style){
  if (item && item.photo_url) {
    return '<img class="' + (cls || 'r-thumb') + '" src="' + esc(item.photo_url) + '"' + (style ? ' style="' + style + '"' : '') +
      ' alt="Photo submitted with the hazard report" loading="lazy">';
  }
  return thumb(item && item.thumb, cls, style);
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
  function corrMeter(n, status = 'reported'){
    const pct = Math.min(100, Math.round(n / 3 * 100));
    const cls = n >= 3 ? 'var(--ug-prepared)' : 'var(--ug-warning)';
    const note = n >= 3 ? 'Corroboration threshold reached.'
      : status === 'reported' ? 'The reporter counts once. The report needs ' + (3 - n) + ' more independent nearby confirmation' + (n === 2 ? '.' : 's.')
      : '';
    return '<div class="ug-col ug-gap6" style="gap:6px">' +
      '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dimmer">Independent Corroborations</span>' +
      '<span class="ug-mono" style="color:' + cls + '">' + Math.min(n,3) + ' / 3</span></div>' +
      '<div style="height:5px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.09);overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + cls + ';border-radius:3px"></div></div>' +
      (note ? '<div class="ug-dimmer" style="font-size:11px">' + note + '</div>' : '') +
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
    let roads = '<path d="M60 250 C180 236 300 268 470 232 S640 196 720 214" fill="none" style="stroke:rgba(var(--ug-tint, 255,255,255),.10)" stroke-width="2"/>' +
                '<path d="M170 60 C200 150 250 200 300 300 S380 380 500 400" fill="none" style="stroke:rgba(var(--ug-tint, 255,255,255),.08)" stroke-width="2"/>';
    let river = '';
    let nodeMarks = nodes.map(n => {
      const left = n[4] === -1;
      return '<circle cx="'+n[1]+'" cy="'+n[2]+'" r="'+(n[3]?4.5:3)+'" fill="'+(n[3]?'#34D6F0':'#7E92AF')+'"/>' +
      '<text x="'+(n[1] + (left ? -9 : 9))+'" y="'+(n[2]+4)+'" text-anchor="'+(left ? 'end' : 'start')+'" ' +
      'font-family="inherit" font-size="10.5" ' +
      'style="paint-order:stroke;stroke:var(--ug-map-bg, #061020);stroke-width:3.6px;stroke-linejoin:round" ' +
      'fill="'+(n[3]?'#DCEDFB':'#A9BDD6')+'">'+n[0]+'</text>';
    }).join('');
    let marks = '';
    DATA.incidents.filter(i => i.r > 0).forEach(i => {
      const cx = i.x * W, cy = i.y * H, rr = i.r * H;
      const col = (SEV[i.sev]||SEV.advisory).color;
      marks += '<circle cx="'+cx+'" cy="'+cy+'" r="'+rr+'" fill="'+col+'" opacity=".10"/>' +
               '<circle cx="'+cx+'" cy="'+cy+'" r="'+rr+'" fill="none" stroke="'+col+'" stroke-opacity=".45" stroke-width="1" stroke-dasharray="4 5"/>' +
               '<circle cx="'+cx+'" cy="'+cy+'" r="5" fill="'+col+'"/>' +
               '<circle cx="'+cx+'" cy="'+cy+'" r="1.9" style="fill:var(--ug-bg, #050910)"/>';
    });
    DATA.incidents.filter(i => i.units > 0).forEach(i => {
      const cx = i.x * W + 22, cy = i.y * H - 20;
      marks += '<rect x="'+(cx-4)+'" y="'+(cy-4)+'" width="8" height="8" rx="2" fill="#34D6F0" transform="rotate(45 '+cx+' '+cy+')"/>';
    });
    const sweep = opts.animated ? '<g style="transform-origin:300px 200px;animation:ugSweep 4.2s linear infinite">' +
      '<path d="M300 200 L300 60 A140 140 0 0 1 430 150 Z" fill="rgba(52,214,240,.10)"/></g>' : '';
    return '<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Live operations map of Lingayen showing active incident perimeters and deployed units">' +
      '<defs><pattern id="uggrid" width="38" height="38" patternUnits="userSpaceOnUse">' +
      '<path d="M38 0H0V38" fill="none" style="stroke:rgba(var(--ug-tint, 255,255,255),.045)" stroke-width="1"/></pattern></defs>' +
      '<rect width="'+W+'" height="'+H+'" style="fill:var(--ug-map-bg, #061020)"/>' +
      '<rect width="'+W+'" height="'+H+'" fill="url(#uggrid)"/>' +
      contours + land + roads + river + nodeMarks + sweep + marks +
      '<text x="16" y="'+(H-14)+'" font-family="inherit" font-size="9.5" fill="#7E92AF">LINGAYEN GRID · WGS84 · ZOOM 12</text>' +
    '</svg>';
  }

  function mapLegend(){
    const items = UG_THEME.legendItems().filter(i => i.group === 'Severity' || i.key === 'unit');
    return '<div class="map-legend">' +
      items.map(l => '<span class="lg"><i class="shape-' + l.shape + '" style="background:' + l.color + '"></i>' + l.label + '</span>').join('') +
    '</div>';
  }

  /* The Triad Shield emblem (Oct 2026 design): left = barangay, right = LDRRMO
     command, keel = residents, joined by the beacon hub. Each role recolours it
     through --ug-em-* (css/design.css). Path data from the React app's
     src/brand/TriadEmblem.tsx. */
  function triadEmblem(px){
    return '<svg class="ug-emblem" viewBox="0 0 64 64" width="'+px+'" height="'+px+'" aria-hidden="true">' +
      '<path style="fill:var(--ug-em-left)" d="M30.4 5.3C24 8.2 17.5 9.9 9.5 11.2V30C9.5 32.3 9.7 34.4 10.1 36.4H30.4Z"/>' +
      '<path style="fill:var(--ug-em-right)" d="M33.6 5.3C40 8.2 46.5 9.9 54.5 11.2V30C54.5 32.3 54.3 34.4 53.9 36.4H33.6Z"/>' +
      '<path style="fill:var(--ug-em-keel)" d="M10.9 40.2C16.8 37.6 22.6 42.8 32 40.2C41.4 37.6 47.2 42.8 53.1 40.2C49.6 48.8 42.2 55.6 32 60.5C21.8 55.6 14.4 48.8 10.9 40.2Z"/>' +
      '<circle cx="32" cy="21.5" r="5.6" style="fill:var(--ug-em-hub)"/>' +
      '<circle cx="32" cy="21.5" r="2.4" style="fill:var(--ug-em-dot)"/></svg>';
  }
  /* the original shield icon; css/design.css swaps it for the emblem */
  function shieldIcon(px){
    return '<svg class="ug-mark-classic" viewBox="0 0 24 24" width="'+px+'" height="'+px+'" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 2.6 4.6 5.7v5.8c0 4.5 3.1 8.2 7.4 9.6 4.3-1.4 7.4-5.1 7.4-9.6V5.7L12 2.6Z"/><path d="M8.6 12.2 11 14.6l4.6-4.9"/></svg>';
  }
  function brandMark(size){
    size = size || 34;
    return '<span class="ug-mark" style="width:'+size+'px;height:'+size+'px">' +
      shieldIcon(Math.round(size*0.6)) + triadEmblem(size) + '</span>';
  }

  /* A dismissible notice (glass card, icon, title, details, optional
     action, ×). Dismissing stores the notice's signature: it stays hidden
     until the content changes (e.g. a different set of low items). With
     opts.session it only stays hidden for this browser session. */
  function note(key, sig, iconName, title, detail, opts) {
    opts = opts || {};
    try {
      const store = opts.session ? sessionStorage : localStorage;
      const map = JSON.parse(store.getItem('ug_notes_x') || '{}');
      if (map[key] && map[key] === String(sig)) return '';
    } catch (e) { }
    return '<div class="ug-note2' + (opts.tone ? ' is-' + opts.tone : '') + '" role="status" data-note="' + esc(key) + '"' + (opts.act ? ' data-note-act="1"' : '') + '>' +
      '<span class="n2-ico">' + icon(iconName, 15) + '</span>' +
      '<div class="n2-t"' + (opts.act ? ' data-act="' + esc(opts.act) + '" role="button" tabindex="0"' : '') + '><b>' + esc(title) + '</b>' + (detail ? '<span>' + detail + '</span>' : '') + '</div>' +
      (opts.btn || '') +
      '<button class="n2-x" data-act="note-x" data-key="' + esc(key) + '" data-sig="' + esc(String(sig)) + '"' + (opts.session ? ' data-session="1"' : '') + ' aria-label="Dismiss" title="Dismiss">' + icon('x', 13) + '</button>' +
    '</div>';
  }
  return { ICONS, icon, DATA, SEV, STAGES, esc, badge, sevBadge, ladder, stageBadge, stat, thumb, photo, pipeline, corrMeter, mapSVG, mapLegend, brandMark, triadEmblem, shieldIcon, note };
})();

const UG_SCREENS = (() => {
  const U = UG;
  const I = U.icon, esc = U.esc;
  /* UG_SCREENS-wide i18n helper — closures inside this IIFE (dSidebar,
     dTopbar, dAdvisories, mAdvisoryDetail, dCenters, dHotlines, dAnalytics,
     etc.) read their visible strings through T() so the Settings language
     picker actually flips every screen between English and Filipino. */
  const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);

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
    return '<div style="height:5px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.08);overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + col + '"></div></div>';
  };
  const catBar = (n) => {
    const max = Math.max.apply(null, n.map(x => x[1]));
    return '<div style="display:flex;gap:10px;align-items:stretch">' +
      '<div style="display:flex;flex-direction:column;justify-content:space-between;width:16px;text-align:right;' +
      'font-family:var(--ug-font);font-size:11px;color:var(--ug-ink-3)"><span>' + max + '</span><span>0</span></div>' +
      '<div class="ug-rowf" style="gap:10px;align-items:flex-end;flex:1;min-width:0">' + n.map(x => '<div class="ug-col" style="gap:5px;flex:1;min-width:0">' +
      '<div style="height:64px;display:flex;align-items:flex-end"><div style="width:100%;height:' + Math.round(x[1] / max * 100) + '%;background:' + x[2] + ';border-radius:3px 3px 0 0;min-height:4px"></div></div>' +
      '<div class="ug-dimmer" style="font-size:11px;text-align:center;line-height:1.25;overflow-wrap:anywhere" title="' + esc(x[0]) + '">' + esc(x[0]) + '</div>' +
      '<div class="ug-mono" style="font-size:11px;text-align:center">' + x[1] + '</div></div>').join('') + '</div></div>';
  };
  const trendSVG = (series) => {
    const W = 560, H = 120, max = Math.max.apply(null, series) * 1.15;
    const pts = series.map((v, i) => [i / (series.length - 1) * W, H - v / max * H]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
    let grid = '';
    for (let i = 1; i <= 4; i++) grid += '<line x1="0" y1="' + H / 4 * i + '" x2="' + W + '" y2="' + H / 4 * i + '" style="stroke:rgba(var(--ug-tint, 255,255,255),.05)"/>';
    const dots = pts.map((p, i) => i % 2 === 0 ? '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.4" fill="#34D6F0"/>' : '').join('');
    return '<div style="display:flex;gap:10px;align-items:stretch">' +
        '<div style="display:flex;flex-direction:column;justify-content:space-between;width:26px;text-align:right;' +
        'font-family:var(--ug-font);font-size:11px;color:var(--ug-ink-3);padding:0 0 0 0">' +
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
  /* True when the signed-in account is the Super Admin (an lgu_ldrrmc account
     with profiles.is_super_admin = true). Used to hide the Verify / LGU-Verify
     / Advance Status actions: the Super Admin has read + edit but no verify
     permission, by design. */
  const isSuperAdminSession = (st) => !!(st && st.session && st.session.role === 'lgu_ldrrmc' && st.session.superAdmin);

  /* ================================================================== */
  /* MOBILE (citizen)                                                    */
  /* ================================================================== */
  function mAppbar(st, title, sub){
    const role = U.DATA.roles.find(r => r.id === st.role) || U.DATA.roles[0];
    /* the badge reflects the real unread count from UG.DATA.notifications — fixed
       the old bug where the bell looked the same with or without new alerts. */
    const unreadCount = (U.DATA.notifications || []).filter((n) => n.unread).length;
    const badge = unreadCount > 0
      ? '<span class="ug-bell-badge' + (unreadCount >= 10 ? ' is-many' : '') + '">' + (unreadCount > 9 ? '9+' : unreadCount) + '</span>'
      : '';
    return '<div class="ug-appbar">' +
      '<button class="ug-brand ug-brand-btn"' + A('nav', attr({ route: 'home' })) + ' aria-label="Go to the home screen">' +
        '<span class="ug-mark" style="width:30px;height:30px;border-radius:8px">' +
          U.shieldIcon(17) + U.triadEmblem(30) + '</span>' +
        '<span class="ug-col" style="gap:0;min-width:0">' +
          '<span style="font-family:var(--ug-font);font-weight:700;font-size:13px">' + esc(title) + '</span>' +
          '<span class="ug-dimmer" style="font-size:11px">' + esc(sub) + '</span>' +
        '</span>' +
      '</button>' +
      '<div class="ug-rowf ug-gap8" style="gap:6px">' +
        '<button class="ug-ico-btn" aria-label="Offline readiness"' + A('nav', attr({ route: 'offline' })) + '>' +
          I(st.offline ? 'wifioff' : 'download', 17) + '</button>' +
        '<button class="ug-ico-btn" aria-label="Notifications"' + A('nav', attr({ route: 'notifications' })) + '>' +
          I('bell', 17) + badge + '</button>' +
        '<button class="ug-ico-btn" aria-label="Sign out"' + A('logout') + '>' + I('logout', 17) + '</button>' +
      '</div>' +
    '</div>';
  }

  function mTabbar(st){
    const t = (route, ico, label, badge) =>
      '<button class="ug-tab' + (st.route === route ? ' is-on' : '') + '"' + A('nav', attr({ route: route })) + '>' +
        I(ico, 20) + '<span>' + label + '</span>' + (badge ? '<span class="t-badge">' + badge + '</span>' : '') + '</button>';
    /* the unread badge on the advisories tab also reflects real data, not a fixed
       '2' anymore. */
    const unreadAdv = (U.DATA.advisories || []).filter((a) => a.severity !== 'prepared').length;
    const notifCount = (U.DATA.notifications || []).filter((n) => n.unread).length;
    return '<div class="ug-tabbar">' +
      t('home', 'home', 'Home') +
      t('relief', 'relief', 'Relief') +
      '<button class="ug-tab" style="flex:0 0 64px" aria-label="Report a Hazard"' + A('nav', attr({ route: 'report' })) + '>' +
        '<span class="ug-fab">' + I('plus', 24) + '</span></button>' +
            t('advisories', 'megaphone', 'Alerts') +
      t('hotlines', 'phone', 'Hotlines') +
    '</div>';
  }

  /* ---- home ---- */
  /* Priority layout: urgent alerts pinned to the top with strong visual
     treatment, then quick-access shortcuts (Report Hazard / SOS / Relief Info /
     My Reports), then secondary content (shelters, latest report, offline
     readiness). Guides and FAQs are reachable but moved off the home surface
     to reduce clutter. */
  function mHome(st){
    const activeAds = (U.DATA.advisories || []).filter(a => a.severity !== 'prepared');
    const top = activeAds[0] || U.DATA.advisories[0];
    const mine = U.DATA.incidents.find(i => i.mine) || null;
    const openCenters = U.DATA.centers.filter(c => c.status === 'open');
    const isEmergency = top && top.severity === 'emergency';
    const readout = (v, l, tone) =>
      '<div class="ug-col" style="gap:3px;padding:11px 12px;background:rgba(var(--ug-tint, 255,255,255),.03);border:1px solid var(--ug-line);border-radius:10px;flex:1;min-width:0">' +
        '<span class="ug-mono" style="font-size:16px;font-weight:600;color:' + tone + '">' + v + '</span>' +
        '<span class="ug-dimmer" style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;overflow-wrap:anywhere;line-height:1.3">' + l + '</span></div>';

    /* the urgent banner — color-coded by severity, larger for emergency */
    const banner = top
      ? '<button class="ug-card ug-urgent-card' + (isEmergency ? ' is-emergency' : '') + '" style="text-align:left;cursor:pointer;width:100%;padding:0;overflow:hidden"' + A('open-advisory', attr({ id: top.id })) + '>' +
          '<div class="ug-urgent-card-strip" style="background:' + (U.SEV[top.severity] || U.SEV.advisory).color + '"></div>' +
          '<div style="padding:14px 16px">' +
            '<div class="ug-rowf ug-between" style="gap:8px">' +
              '<div class="ug-rowf ug-gap8" style="gap:6px;align-items:center">' +
                '<span class="ug-urgent-card-ico" style="background:' + (U.SEV[top.severity] || U.SEV.advisory).color + '">' + I('alert', 16) + '</span>' +
                U.sevBadge(top.severity) +
              '</div>' +
              '<span class="ug-dimmer ug-mono" style="font-size:11px">' + esc(top.time) + '</span>' +
            '</div>' +
            '<h3 style="font-size:14px;line-height:1.3;margin-top:9px;font-weight:700">' + esc(top.title) + '</h3>' +
            '<div class="ug-dimmer ug-rowf" style="font-size:11px;gap:6px;margin-top:5px">' + I('pin', 12) + esc(top.area) + '</div>' +
          '</div></button>'
      : '';

    /* quick-access shortcuts: Report Hazard, SOS, Relief Info, My Reports —
       sized so the SOS button is visually primary. */
    const shortcuts =
      '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<button class="ug-btn ug-btn--signal" style="flex:1"' + A('nav', attr({ route: 'report' })) + '>' + I('plus', 16) + 'Report Hazard</button>' +
        '<button class="ug-btn ug-btn--danger" style="flex:1"' + A('sos-trigger') + '>' + I('alert', 16) + 'SOS</button>' +
      '</div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<button class="ug-btn ug-btn--ghost" style="flex:1"' + A('nav', attr({ route: 'relief' })) + '>' + I('relief', 15) + 'Relief Info</button>' +
        '<button class="ug-btn ug-btn--ghost" style="flex:1"' + A('nav', attr({ route: 'reports' })) + '>' + I('doc', 15) + 'My Reports</button>' +
      '</div>';

    return '<div class="ug-col" style="gap:14px">' +
      '<div class="ug-rowf ug-between" style="gap:10px">' +
        '<div><div class="ug-lab">' + esc(sess(st).scope) + '</div>' +
        '<h2 style="font-size:18px;margin-top:3px">Hello, ' + esc(sess(st).name.split(' ')[0]) + '</h2></div>' +
        '<span class="ug-chip is-on">' + I('target', 13) + 'Citizen</span>' +
      '</div>' +

      /* 1. urgent alerts pinned at the very top — emergency advisories take
         precedence over everything else on the home screen. */
      banner +

      /* 2. quick-access shortcuts — the four actions a citizen is most likely
         to need in an emergency. */
      shortcuts +

      /* 3. secondary readouts (counts) and the latest-report + shelters block
         moved below the fold. */
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
        readout('1', 'In your barangay', 'var(--ug-warning)') +
        readout(String(activeAds.length || 0), 'Active Advisories', 'var(--ug-advisory)') +
        readout(String(openCenters.length), 'Shelters open', 'var(--ug-prepared)') +
      '</div>' +

      (mine ? (
      '<button class="ug-card ug-tick" style="text-align:left;cursor:pointer;width:100%"' + A('open-incident', attr({ id: mine.id })) + '>' +
        '<div class="ug-card-h"><h3>Your Latest Report</h3>' + U.stageBadge(mine.status) + '</div>' +
        '<div class="ug-card-b ug-col" style="gap:11px">' +
          '<div class="ug-rowf ug-gap12" style="gap:10px;align-items:flex-start">' + U.photo(mine) +
            '<div style="flex:1;min-width:0"><div class="ug-rowf ug-gap8" style="gap:7px">' + U.ladder(mine.sev) +
            '<span style="font-size:13px;font-weight:600">' + esc(mine.hazard) + '</span></div>' +
            '<div class="ug-dimmer ug-mono" style="font-size:11px;margin-top:3px">' + esc(mine.id) + ' &middot; ' + esc(mine.time) + '</div>' +
            '<div class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.45">' + esc(mine.desc.slice(0, 74)) + '&hellip;</div></div>' +
          '</div>' + U.corrMeter(st.corr[mine.id] || mine.corr, mine.status) +
        '</div>' +
      '</button>'
      ) : '') +
            (function () {
        const near = (U.DATA.incidents || []).filter(i => !i.mine && i.status !== 'resolved' && i.status !== 'rejected').slice(0, 3);
        return '<div class="ug-card"><div class="ug-card-h"><h3>Reported Near You</h3>' +
          '<span class="ug-dimmer" style="font-size:11px">Confirm if you see it too</span></div>' +
          '<div class="ug-rows">' + (near.length ? near.map(i =>
            '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-report', attr({ id: i.id })) + '>' +
              '<div class="r-main"><div class="r-t">' + U.ladder(i.sev) + esc(i.hazard) + '</div>' +
                '<div class="r-m"><span>' + I('clock', 12) + esc(i.time) + '</span><span>' + I('pin', 12) + esc(i.brgy) + '</span>' +
                '<span>' + I('shield', 12) + i.corr + '/3</span></div></div>' + U.stageBadge(i.status) + '</button>').join('')
            : '<div class="ug-empty"><div style="font-size:12px" class="ug-dim">No other open reports in your barangay.</div></div>') +
          '</div></div>';
      })() +
      '<div class="ug-card">' +
        '<div class="ug-card-h"><h3>Nearest Open Shelters</h3>' +
          '<button class="ug-dimmer" style="background:none;border:0;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:3px"' + A('nav', attr({ route: 'centers' })) + '>All Shelters' + I('chevron', 13) + '</button></div>' +
        '<div class="ug-rows">' + openCenters.slice(0, 2).map(c =>
          '<div class="ug-row"><span class="r-dot" style="background:var(--ug-prepared)"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(c.name) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(c.brgy) + '</span><span>' + I('users', 12) + c.occ + ' / ' + c.cap + '</span></div>' +
              '<div style="margin-top:7px">' + occBar(c.occ, c.cap) + '</div></div>' +
            U.badge('open', 'Open') + '</div>').join('') + '</div>' +
      '</div>' +

      '<div class="ug-card ug-card--flat">' +
        '<div class="ug-card-b" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
          [['map', 'map', 'Hazard Map'], ['advisories', 'megaphone', 'Advisories'], ['roadwork', 'road2', 'Road Work'],
 ['guides', 'guide', 'Guides'], ['faqs', 'faq', 'FAQs'], ['centers', 'shelter', 'Shelters']]
            .map(q => '<button class="ug-btn ug-btn--sm" style="width:100%"' + A('nav', attr({ route: q[0] })) + '>' + I(q[1], 15) + q[2] + '</button>').join('') +
        '</div>' +
      '</div>' +

      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:11px">' +
        I('download', 12) + 'Offline copy ready &middot; synced ' + esc(U.DATA.offlineCache.synced) + '</div>' +
    '</div>';
  }

  /* ---- report form (feature 3) ---- */
  function mReport(st){
    const r = st.report;
    const urg = [['advisory', 'Looks Minor'], ['warning', 'Getting Worse'], ['emergency', 'People at Risk']];
    return '<div class="ug-col" style="gap:16px">' +
      '<div><div class="ug-lab">Multi-Hazard Reporting</div>' +
      '<h2 style="font-size:18px;margin-top:3px">Report a Hazard</h2>' +
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
        U.DATA.barangays.map(b => '<option' + (r.brgy === b ? ' selected' : '') + '>' + esc(b) + '</option>').join('') + '</select>' +
        /* the report is filed under the barangay that contains the pin
           (official boundaries, migration 053) — say so when they differ */
        (r.pinBrgy && r.brgy !== r.pinBrgy
          ? '<div class="ug-note" style="margin-top:8px">Your pin is in <b>' + esc(r.pinBrgy) + '</b>. Reports go to the barangay where the pin is. ' +
            'If the hazard is in ' + esc(r.brgy) + ', move the pin on the map below to the hazard location.</div>'
          : (r.pinBrgy ? '<div class="ug-help">Set from your pin location.</div>' : '')) +
        '</div>' +

      '<div class="ug-field"><label class="ug-lab">How urgent does it look</label>' +
        '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + urg.map(u =>
          '<button class="ug-chip' + (r.urg === u[0] ? ' is-on' : '') + '"' + A('set-urg', attr({ v: u[0] })) + '>' +
          U.ladder(u[0]) + u[1] + '</button>').join('') + '</div></div>' +

      '<div class="ug-field"><label class="ug-lab">Description and hazard details</label>' +
        '<textarea class="ug-ta" rows="4" data-field="desc" placeholder="Describe what you are seeing: water depth (knee or waist high), affected roads, trapped families, or nearby landmarks.">' + esc(r.desc) + '</textarea>' +
        '<div class="ug-help">Tip: landmark references help responders find the exact spot.</div></div>' +

      '<div class="ug-field"><label class="ug-lab">Photo evidence</label>' +
        (r.photo
          ? '<div class="ug-rowf ug-gap12" style="gap:10px;align-items:center;border:1px solid var(--ug-line);border-radius:10px;padding:9px">' + (r.photoPreview ? '<img src="' + esc(r.photoPreview) + '" alt="Selected photo preview" style="width:62px;height:46px;border-radius:8px;object-fit:cover;flex:none;border:1px solid var(--ug-line)">' : '') +
            '<div style="min-width:0"><div style="font-size:12px;font-weight:600">' + esc(r.photoName || 'hazard-photo.jpg') + '</div>' +
            '<div class="ug-dimmer" style="font-size:11px">' + esc(UG_UTIL.bytes(r.photoBytes || 0)) + ' after compression</div></div>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('rm-photo') + '>Replace</button></div>'
          : '<button class="ug-upload" style="width:100%"' + A('add-photo') + '>' +
            '<span class="up-ico">' + I('camera', 22) + '</span>' +
            '<span style="font-size:13px;font-weight:600">Tap to Attach a Hazard Photo</span>' +
            '<span class="ug-dimmer" style="font-size:11px">JPG or PNG up to 10 MB, or capture with the camera</span></button>') +
      '</div>' +

      '<div class="ug-field"><label class="ug-lab">Incident location</label>' +
        (r.gpsDenied && !r.gps
          ? '<div class="ug-note" style="margin-bottom:8px">We could not read your GPS. The location is needed to route the report to the right barangay and to verify it with nearby reports — drop the pin on the map below at the hazard spot.</div>'
          : '') +
        '<div class="ug-geo"><span class="geo-ico">' + I('pin', 18) + '</span>' +
          '<span style="min-width:0"><span class="geo-val" data-field="geoCoords">' + (r.gps && UG_GEO.isNum(r.lat) ? UG_GEO.fmt(r.lat, r.lng) : 'Not set — drop the pin on the map') + '</span>' +
          '<span class="geo-sub" data-field="geoAddress">' + (r.address || (r.gps ? 'Position captured' : 'GPS tagging attaches your position to the report')) + '</span>' +
          (r.accuracy != null && r.gps ? '<span class="ug-geo-accuracy"><span class="bar"><i style="width:' + Math.min(100, Math.max(8, Math.round(r.accuracy / 2))) + '%"></i></span>Accuracy ~' + esc(r.accuracy) + ' m</span>' : '') +
          '</span>' +
          '<button class="ug-btn ug-btn--sm" style="margin-left:auto"' + A('gps') + '>' + (r.gps ? 'Refresh' : 'Acquire GPS') + '</button>' +
        '</div>' +
        '<div class="ug-rowf" style="margin-top:8px"><button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('manual-coords') + '>Enter coordinates instead</button></div></div>' +

      /* drag-to-adjust pin map: a small Leaflet map with a draggable marker
         so the citizen can place / correct the pin. The pin-drop callback is
         wired in js/app.js's mountMaps -> reportPin path. */
      '<div class="ug-field"><label class="ug-lab">Drop the pin at the hazard (drag to adjust)</label>' +
        '<div class="ug-note" data-pin-outside style="margin-bottom:8px"' + (r.pinOutside ? '' : ' hidden') + '>' + esc(T('report.pinOutside')) + '</div>' +
        '<div class="ug-map" data-map="report-pin" style="height:200px;border-radius:10px;overflow:hidden">' + U.mapSVG({}) + '</div>' +
        '<div class="ug-help">Drag the pin to where the hazard actually is. The address and barangay update automatically; the server confirms the barangay from these coordinates.</div></div>' +

      '<div class="ug-field"><label class="ug-lab">Exact address / landmark (optional)</label>' +
        '<input class="ug-in" data-field="reportAddress" value="' + esc(r.locationNote || '') + '" placeholder="e.g. near the gate of Pangapisan Elementary School">' +
        '<div class="ug-help">A typed address helps responders, but the map pin is what routes the report.</div></div>' +

      '<button class="ug-btn ug-btn--signal ug-btn--block' + (r.desc.trim() ? '' : ' is-disabled') + '"' + A('submit-report') + '>' +
        I('check', 16) + (st.editing ? 'Save changes' : 'Submit Report') + '</button>' +
      (st.editing
        ? '<button class="ug-btn ug-btn--block ug-btn--ghost"' + A('cancel-edit') + '>Cancel edit</button>' +
          '<div class="ug-dimmer" style="font-size:11px;text-align:center;margin-top:-6px">Editing ' + esc(st.editing.code || '') + ' — the change is audit-logged and cannot change the status or barangay.</div>'
        : '<div class="ug-dimmer" style="font-size:11px;text-align:center;margin-top:-6px">Reports stay editable for 15 minutes after submission.</div>') +
    '</div>';
  }

  /* ---- report submitted (feature 4) ---- */
  function mReportDone(st){
    const id = (st.lastReport && st.lastReport.id) || 'Pending sync';
    return '<div class="ug-col" style="gap:16px">' +
      '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:12px;align-items:center;text-align:center;padding:22px 18px">' +
        '<span style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:rgba(47,208,138,.14);color:var(--ug-prepared);border:1px solid rgba(47,208,138,.32)">' + I('check', 26) + '</span>' +
        '<h3 style="font-size:16px">' + (st.lastReport?.id ? 'Report submitted' : 'Report saved offline') + '</h3>' +
        '<p class="ug-dim" style="font-size:12px;line-height:1.5">' +
          (st.lastReport?.id ? 'Your hazard report is in the ' + esc(st.lastReport.brgy || 'barangay') + ' queue.' :
            'UniGuard will send your report when you reconnect.') + '</p>' +
        '<span class="ug-badge ug-badge--id" style="font-size:11px">' + id + '</span>' +
      '</div></div>' +

      (st.lastReport?.id ? '<div class="ug-card"><div class="ug-card-h"><h3>Crowd Corroboration</h3></div>' +
        '<div class="ug-card-b">' + U.corrMeter(st.lastReport.corr ?? 1, st.lastReport.status) + '</div></div>' : '') +

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
    const f = st.reportStatusFilter || 'all';
    const chips = [['all', 'All'], ['reported', UG_THEME.STATUS.reported.label],
                   ['verified', UG_THEME.STATUS.verified.label],
                   ['dispatched', UG_THEME.STATUS.dispatched.label],
                   ['resolved', UG_THEME.STATUS.resolved.label],
                   ['rejected', UG_THEME.STATUS.rejected.label]];
    const mineAll = (U.DATA.incidents || []).filter((i) => i.mine); 
    const list = mineAll.filter((i) => f === 'all' || i.status === f); 
    /* reports still in the offline queue (refreshed by app.js) come first */
    const queued = U.DATA.queuedReports || [];
    const queuedCard = queued.length
      ? '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('offline.waitingToSend')) + '</h3>' +
          '<span class="ug-mono ug-dimmer" style="font-size:11px">' + queued.length + '</span></div>' +
        '<div class="ug-rows">' + queued.map((q) =>
          '<div class="ug-row" style="align-items:flex-start">' +
            '<span class="r-dot" style="background:' + (q.failed ? 'var(--ug-emergency)' : 'var(--ug-warning)') + '"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(q.hazard || 'Report') +
              '<span class="ug-badge ug-badge--' + (q.failed ? 'emergency' : 'warning') + '">' + esc(q.failed ? T('offline.couldNotSend') : T('offline.waitingBadge')) + '</span></div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(q.brgy || '') + '</span><span>' + I('clock', 12) + esc(UG_UTIL.relTime(q.queued_at)) + '</span></div>' +
              '<div class="ug-dim" style="font-size:11px;line-height:1.5;margin-top:4px">' +
                esc(q.failed ? (q.last_error || T('error.generic')) : T('offline.savedWillSend')) + '</div>' +
              (q.failed
                ? '<div class="ug-rowf ug-gap8" style="gap:8px;margin-top:8px">' +
                    '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('queue-retry') + '>' + I('wave', 13) + esc(T('offline.tapToRetry')) + '</button>' +
                    '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('queue-delete', attr({ qid: q.qid })) + '>' + I('x', 13) + esc(T('action.delete')) + '</button></div>'
                : '') +
            '</div></div>').join('') +
        '</div></div>'
      : '';
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Incident Status Tracking</div><h2 style="font-size:18px;margin-top:3px">My Reports</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Every report you have filed, with its current status at a glance. Tap to open the tracker.</p></div>' +
      queuedCard +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + chips.map((c) =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('report-status-filter', attr({ v: c[0] })) + '>' + esc(c[1]) +
        '<span class="ug-mono" style="opacity:.7">' + (c[0] === 'all' ? mineAll.length : mineAll.filter((x) => x.status === c[0]).length) + '</span></button>').join('') + '</div>' +
      '<div class="ug-card"><div class="ug-rows">' + (list.length ? list.map(i => {
        const corr = st.corr[i.id] != null ? st.corr[i.id] : i.corr;
        const status = corr >= 3 && i.status === 'reported' ? 'verified' : i.status;
        return '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-report', attr({ id: i.id })) + '>' +
          U.photo(i) +
          '<div class="r-main"><div class="r-t">' + U.ladder(i.sev) + esc(i.hazard) + '</div>' +
            '<div class="r-m"><span class="ug-mono">' + esc(i.id) + '</span><span>' + I('clock', 12) + esc(i.time) + '</span><span>' + I('shield', 12) + corr + '/3</span></div></div>' +
          U.stageBadge(status) + I('chevron', 16) + '</button>';
      }).join('') : '<div class="ug-empty"><span class="e-ico">' + I('inbox', 20) + '</span>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No reports in this status</div>' +
        '<div class="ug-dim" style="font-size:11px">Switch the filter to see other reports.</div></div>') + '</div></div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:8px">' +
        '<div class="ug-lab">Status Legend</div>' +
        U.STAGES.map(s => '<div class="ug-rowf ug-gap8" style="gap:8px;font-size:12px"><span class="r-dot" style="background:' + s.color + ';margin:0"></span>' +
          '<span style="font-weight:600;color:' + s.color + '">' + s.label + '</span>' +
          '<span class="ug-dimmer" style="margin-left:auto;text-align:right">' + s.note + '</span></div>').join('') +
        '<div class="ug-rowf ug-gap8" style="gap:8px;font-size:12px"><span class="r-dot" style="background:' + UG_THEME.STATUS.rejected.color + ';margin:0"></span>' +
          '<span style="font-weight:600;color:' + UG_THEME.STATUS.rejected.color + '">' + esc(UG_THEME.STATUS.rejected.label) + '</span>' +
          '<span class="ug-dimmer" style="margin-left:auto;text-align:right">' + esc(UG_THEME.STATUS.rejected.note) + '</span></div>' +
      '</div></div>' +
    '</div>';
  }

  function mReportDetail(st){
    const id = st.openId;
    const i = Repo.findReport(id);
    if (!i) return '<div class="ug-note">This report is unavailable.</div>';
    const privateSos = (i.is_sos || i.verified_by_name === 'SOS') && !i.mine && !(U.DATA.sosLog || []).some((row) => row.report_id === i.uuid);
    const corr = st.corr[i.id] != null ? st.corr[i.id] : i.corr;
    /* the server decides verification (061); the screen never promotes a
       report to verified on its own count */
    const status = i.status;
    const auto = status === 'verified' && corr >= 3 && !i.verified_by_role && !i.is_sos;
    /* the report-status tracker: a compact visual progress bar that maps the
       four pipeline stages to Processing → Verified → Deployed → Resolved in
       the user's wording. The existing U.pipeline() still renders the verbose
       one; this tracker adds a second, glanceable view. */
    const trackerSteps = [
      { key: 'reported',   label: 'Processing' },
      { key: 'verified',   label: 'Verified' },
      { key: 'dispatched', label: 'Deployed' },
      { key: 'resolved',   label: 'Resolved' }
    ];
    const order = trackerSteps.map((s) => s.key);
    let idx = order.indexOf(status);
    if (status === 'rejected') idx = -1;
    const tracker = '<div class="ug-tracker">' + trackerSteps.map((s, k) => {
      const state = status === 'rejected' ? '' : (k < idx ? 'done' : (k === idx ? 'now' : ''));
      return '<div class="step ' + state + '"><span class="dot"></span>' +
        '<span class="lab">' + esc(s.label) + '</span>' +
        '<span class="time">' + (k === idx ? esc(i.time) : '') + '</span></div>';
    }).join('') + '</div>';
    return '<div class="ug-col" style="gap:14px">' +
      '<button class="ug-btn ug-btn--ghost ug-btn--sm rd-back" style="align-self:flex-start"' + A('nav', attr({ route: 'reports' })) + '>' +
        '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 14) + '</span>Back</button>' +
      '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:12px">' +
        '<div class="ug-rowf ug-between" style="gap:8px">' + U.sevBadge(i.sev) + U.stageBadge(status) + '</div>' +
        '<h2 style="font-size:18px">' + esc(i.hazard) + '</h2>' +
        '<div class="ug-dimmer ug-mono" style="font-size:11px">' + esc(i.id) + ' &middot; ' + esc(i.time) + ' &middot; ' + esc(i.brgy) + '</div>' +
        (privateSos ? '' : U.photo(i, 'bn-img')) +
        '<p class="ug-dim" style="font-size:13px;line-height:1.55">' + esc(privateSos ? 'Emergency SOS reported in this barangay.' : i.desc || 'No description was provided.') + '</p>' +
        (!privateSos && i.location_note ? '<div class="ug-dim" style="font-size:12px"><b>Exact address / landmark:</b> ' + esc(i.location_note) + '</div>' : '') +
        (i.mine && (Date.now() - (Date.parse(i.created_at || '') || 0)) <= 15 * 60000 && status === 'reported'
          ? '<button class="ug-btn ug-btn--sm" style="align-self:flex-start"' + A('start-edit-report', attr({ id: i.id })) + '>' + I('settings', 14) + 'Edit this report</button>'
          : (i.mine && status === 'reported' ? '<div class="ug-dimmer" style="font-size:11px">The 15-minute edit window has closed.</div>' : '')) +
      '</div></div>' +

      (auto ? '<div class="ug-card" style="border-color:rgba(47,208,138,.4)"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-prepared);display:flex">' + I('check', 18) + '</span>' +
        '<div><div style="font-size:13px;font-weight:700;color:var(--ug-prepared)">Auto-Verified by Corroboration</div>' +
        '<div class="ug-dim" style="font-size:12px;margin-top:3px;line-height:1.5">Three independent residents reported the same hazard in the same barangay within the 6 hour window, so the report skipped manual approval.</div></div>' +
      '</div></div>' : '') +

      /* the glanceable tracker; if rejected, the pipeline renders a single red step */
      (status === 'rejected'
        ? '<div class="ug-card"><div class="ug-card-h"><h3>Status</h3>' + U.badge('rejected', i.expired ? 'Expired' : 'Rejected') + '</div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' + U.pipeline('rejected') +
              '<div class="ug-dim" style="font-size:12px;line-height:1.55">' + (i.expired
                ? 'No official verified this report within 3 days, so it was closed automatically. If the hazard is still there, please report it again.'
                : 'This report was closed as not actionable or a duplicate. Contact your barangay desk if you think this was a mistake.') + '</div></div></div>'
        : '<div class="ug-card"><div class="ug-card-h"><h3>Tracking</h3><span class="ug-dimmer" style="font-size:11px">Processing → Deployed → Resolved</span></div>' +
            '<div class="ug-card-b">' + tracker + U.pipeline(status) + '</div></div>') +
          residentResponseMap(i) + dispatchRecords(i) +
          ratingCard(i, i.mine && i.status === 'resolved', st.rateDraft) +
      /* timestamped history log, newest first */
      historyCard(i, st, true, 'History') +

      (i.is_sos ? '' : '<div class="ug-card"><div class="ug-card-h"><h3>Corroboration</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' + U.corrMeter(corr, i.status) +
          (['resolved', 'rejected'].includes(i.status) ? '<div class="ug-note">This report is closed.</div>' : i.mine
  ? '<div class="ug-note">You filed this report, so you cannot confirm it yourself. Other residents in your barangay can.</div>'
  : ((st.corrDone || {})[i.uuid || i.id]
      ? '<button class="ug-btn ug-btn--sm rd-confirmed" disabled>' + I('check', 15) + 'Confirmed</button>'
      : '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('confirm-corr', attr({ id: i.uuid || i.id })) +
        (st.corrBusy ? ' disabled' : '') + '>' + I('check', 15) + 'Confirm This Hazard Is Still There</button>')) +
        '</div></div>') +

      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-between" style="gap:8px">' +
        '<div class="ug-dim" style="font-size:12px">Need help right now?</div>' +
        '<button class="ug-btn ug-btn--sm"' + A('nav', attr({ route: 'hotlines' })) + '>' + I('phone', 14) + 'Barangay Desk</button>' +
      '</div></div>' +
    '</div>';
  }
  function residentResponseMap(incident) {
    const linkedSos = (U.DATA.sosLog || []).some((row) => row.report_id === incident.uuid);
    if ((!incident.mine && !linkedSos) || incident.status !== 'dispatched') return '';
    const open = ((U.DATA.dispatches || {})[incident.uuid] || []).filter((row) =>
      !['done', 'declined'].includes(row.dispatch_status));
    const gps = open.filter((row) => row.last_lat != null && row.last_lng != null && row.last_loc_at);
    const fresh = gps.some((row) => Date.now() - Date.parse(row.last_loc_at) < 90000);
    const label = fresh ? 'Live GPS' : gps.length ? 'Last known locations' : 'Waiting for team GPS';
    return '<section class="ug-card"><div class="ug-card-h"><h3>Track your response team</h3>' +
      '<span class="ug-badge ug-badge--dispatched">' + label + '</span></div>' +
      '<div class="ug-map" data-map="detail" data-response-report="' + esc(incident.uuid) +
      '" aria-label="Map of your incident and responding teams" style="height:clamp(240px,38vh,380px);border:0;border-radius:0">' + U.mapSVG({}) + '</div>' +
      '<p class="sos-mapkey" style="padding:10px 16px 0;margin:0"><span><i class="is-done"></i>Road driven</span><span><i class="is-ahead"></i>Road ahead</span></p>' +
      '<div class="ug-card-b ug-col" style="gap:8px"><p class="ug-dim" style="font-size:12px">' +
      (gps.length ? 'The map shows the incident and each team’s latest shared position.' :
        'The incident pin is shown now. Team markers appear when responders share a GPS location.') +
      '</p><p class="ug-dim" style="font-size:12px"><b>Incident:</b> ' + esc([incident.hazard, incident.brgy && 'Brgy. ' + incident.brgy, incident.location_note].filter(Boolean).join(' · ')) +
      '</p><button class="ug-btn ug-btn--sm" style="align-self:flex-start" data-act="response-fit-map">' + I('map', 14) + 'Show incident and teams</button></div></section>';
  }

    /* dispatch records for one incident: every team sent (any number), which
       unit it is and how to reach it, its status, a timestamped timeline with
       the response times, and while it is out, where it is now (from the
       unit's GPS, migration 057). Shown to the reporter, the barangay and
       the LGU alike. */
  function dispatchRecords(i) {
    const list = (U.DATA.dispatches || {})[i.uuid || i.id] || [];
    if (!list.length) return '';
    const units = U.DATA.unitsById || {};
    const stepLabel = (s) => ({
      sent: 'Awaiting acknowledgment', acknowledged: 'Acknowledged', en_route: 'En route',
      on_scene: 'On scene', done: 'Done', declined: 'Declined',
      under_control: 'Under control', fire_out: 'Fire out',
      on_hold: 'On hold', resume: 'Resumed',
      transporting: 'Transporting', arrived_hospital: 'Arrived at hospital'
    })[s] || s || 'Sent';
    const clock = (v) => v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const mins = (a, b) => (a && b) ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null;
    const minsText = (n) => n == null ? '' : n < 60 ? n + ' min' : Math.floor(n / 60) + ' h ' + (n % 60) + ' min';
    return '<div class="ug-card"><div class="ug-card-h"><h3>Response Dispatch</h3>' +
      '<span class="ug-dimmer ug-mono" style="font-size:11px">' + list.length + (list.length === 1 ? ' TEAM' : ' TEAMS') + '</span></div>' +
      '<div class="ug-card-b ug-col" style="gap:12px">' + list.map((r) => {
        const unit = units[r.unit_id];
        const who = unit ? unit.name : (r.team === 'Barangay Response Team' ? 'Barangay ' + (i.brgy || '') + ' Response Team' : '');
        const open = r.dispatch_status !== 'done' && r.dispatch_status !== 'declined';
        const steps = [['Dispatched', r.dispatched_at], ['Acknowledged', r.ack_at], ['En route', r.en_route_at],
                       ['On scene', r.on_scene_at], ['Done', r.done_at]].filter((x) => x[1]);
        const toScene = mins(r.dispatched_at, r.on_scene_at);
        const total = mins(r.dispatched_at, r.done_at);
        const sinceReport = mins(i.created_at, r.dispatched_at);
        const far = (open && i.status !== 'resolved' && r.last_loc_at && r.last_lat != null && i.lat != null) ? UG_UTIL.distanceM(r.last_lat, r.last_lng, i.lat, i.lng) : null;
        return '<div class="ug-col" style="gap:6px;padding-bottom:12px;border-bottom:1px solid var(--ug-line)">' +
          '<div class="ug-rowf ug-between" style="gap:8px;align-items:flex-start"><span style="font-size:13px;font-weight:700">' + I('truck', 14) + ' ' + esc(r.team) +
              (who ? '<span class="ug-dim" style="font-weight:600"> · ' + esc(who) + '</span>' : '') + '</span>' +
            '<span class="ug-rowf ug-gap6 ug-wrap" style="gap:6px;align-items:center;justify-content:flex-end">' +
              (r.assignment_role ? '<span class="ug-badge ug-badge--id">' + (r.assignment_role === 'lead' ? (r.dispatch_status === 'declined' ? 'Former lead' : 'Lead') : 'Support') + '</span>' : '') +
              (r.auto_dispatched ? '<span class="ug-badge ug-badge--id">Auto</span>' : '') +
              '<span class="ug-badge ug-badge--' + (r.dispatch_status === 'declined' ? 'closed'
                : r.dispatch_status === 'on_hold' ? 'warning'
                : r.dispatch_status === 'done' ? 'prepared'
                : r.dispatch_status === 'fire_out' || r.dispatch_status === 'arrived_hospital' ? 'prepared'
                : 'dispatched') + '">' + esc(stepLabel(r.dispatch_status)) + '</span>' +
              (open ? '<span class="ug-badge ug-badge--dispatched">ETA ' + esc(clock(r.eta) || '—') + '</span>' : '') +
            '</span></div>' +
          (unit && unit.contact_number ? '<a class="ug-dim" style="font-size:12px" href="tel:' + esc(unit.contact_number.replace(/\s+/g, '')) + '">' + I('phone', 12) + ' ' + esc(unit.contact_number) + '</a>' : '') +
          '<div class="ug-dim" style="font-size:12px;line-height:1.5">' + esc(r.instructions) + '</div>' +
          (far != null
            ? '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:8px;align-items:center;font-size:12px">' +
                '<span style="font-weight:600;color:var(--ug-st-dispatched)">' + I('radar', 12) + ' ' + esc(UG_UTIL.fmtDistance(far)) + ' from the scene</span>' +
                '<span class="ug-dimmer">' + (Date.now() - Date.parse(r.last_loc_at) >= 90000 ? 'Last known · ' : 'Updated ') + esc(UG_UTIL.relTime({ created_at: r.last_loc_at })) + '</span>' +
                '<a class="ug-waze-btn" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(r.last_lat, r.last_lng) + '">' + I('route', 12) + ' Map</a>' +
              '</div>'
            : '') +
          '<div class="ug-rowf ug-wrap" style="gap:4px 10px;font-size:11px">' + steps.map((x) =>
            '<span class="ug-mono"><span class="ug-dimmer">' + esc(x[0]) + '</span> ' + esc(clock(x[1])) + '</span>').join('<span class="ug-dimmer">›</span>') + '</div>' +
          ((toScene != null || total != null || sinceReport != null)
            ? '<div class="ug-dimmer" style="font-size:11px">' + [
                sinceReport != null ? 'Sent ' + minsText(sinceReport) + ' after the report' : '',
                toScene != null ? 'on scene ' + minsText(toScene) + ' after dispatch' : '',
                total != null ? 'finished in ' + minsText(total) : ''
              ].filter(Boolean).join(' · ') + '</div>'
            : '') +
          (r.decline_reason ? '<div class="ug-dimmer" style="font-size:11px">Decline reason: ' + esc(r.decline_reason) + '</div>' : '') +
          (r.hold_reason ? '<div class="ug-dimmer" style="font-size:11px">Hold reason: ' + esc(r.hold_reason) + '</div>' : '') +
          '<div class="ug-dimmer ug-mono" style="font-size:11px">Dispatched by ' + esc(r.dispatched_by_name || '—') +
            ' · ' + esc(UG_UTIL.absTime(r.dispatched_at) || '') + '</div>' +
        '</div>';
      }).join('') + '</div></div>';
  }

  /* Faint example comments for the rating boxes. They change with the stars
     picked and with who is being rated, so the resident knows what kind of
     thing to write. [0] is shown before any star is picked. */
  const RATE_HINTS = {
    overall: [
      'Pick the stars first, then tell us how the whole response went.',
      'e.g. Nobody came and the hazard is still there. What went wrong?',
      'e.g. Help came very late and the problem was only partly fixed.',
      'e.g. The response was okay, but it took long to reach us.',
      'e.g. Quick and helpful. Only the updates on the app could be clearer.',
      'e.g. Fast, kind and clear from start to finish. Salamat po!'
    ],
    barangay: [
      'Pick the stars, then tell us how the barangay handled your report.',
      'e.g. No one from the barangay checked or answered my report.',
      'e.g. The barangay took hours to verify and did not call me back.',
      'e.g. They verified it, but I had to follow up myself.',
      'e.g. They checked my report quickly and kept me posted.',
      'e.g. The barangay verified right away and sent the team. Very helpful!'
    ],
    lgu: [
      'Pick the stars, then tell us how the LDRRMO coordinated the response.',
      'e.g. No help or update from the municipality at all.',
      'e.g. The municipal response was slow and the wrong team came.',
      'e.g. They sent help, but the coordination could be faster.',
      'e.g. Good coordination; the right team came on time.',
      'e.g. Excellent coordination. The right teams arrived quickly.'
    ],
    team: [
      'Pick the stars, then tell us how this team did at the scene.',
      'e.g. The team never arrived.',
      'e.g. They arrived late and were not ready to help.',
      'e.g. They helped, but it took a while to get here.',
      'e.g. They arrived quickly and did their job well.',
      'e.g. They came fast, were very professional and kept us safe. Thank you!'
    ]
  };
  const STAR_WORDS = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

  /* average stars per role across the rated reports (Barangay officials,
     LDRRMO, each team type), for the Analytics response card */
  function roleAverages(rated) {
    const sum = {}, cnt = {};
    rated.forEach((i) => ((i.rating && i.rating.details) || []).forEach((d) => {
      const k = d.target === 'barangay' ? 'Barangay officials' : d.target === 'lgu' ? 'LDRRMO'
        : String(d.label || '').split(' · ')[0] || 'Team';
      sum[k] = (sum[k] || 0) + d.stars; cnt[k] = (cnt[k] || 0) + 1;
    }));
    const keys = Object.keys(sum);
    if (!keys.length) return '';
    return '<div class="ug-col" style="gap:4px"><span style="font-size:11px;font-weight:700">Rating by role</span>' +
      keys.sort().map((k) => '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">' + esc(k) + '</span>' +
        '<span class="ug-mono">' + (sum[k] / cnt[k]).toFixed(1) + ' / 5 <span class="ug-dimmer">(' + cnt[k] + ')</span></span></div>').join('') + '</div>';
  }

  /* who handled the report, each rated separately. The server decides
     (report_handlers, migration 059): the barangay officials only if one of
     them acted on it, the LDRRMO only if LGU staff did, and every team that
     was sent and did not decline. Until that answer arrives the card waits;
     if it cannot be read (offline, 059 not applied) only the teams on record
     are offered, never an office that may not have handled the report. */
  function rateTargets(i) {
    const h = (U.DATA.reportHandlers || {})[i.uuid];
    if (!h) return { pending: true, list: [] };
    const list = [];
    if (!h.failed) {
      if (h.barangay) list.push({ target: 'barangay', kind: 'barangay', label: 'Barangay ' + (i.brgy || '') + ' officials' });
      if (h.lgu) list.push({ target: 'lgu', kind: 'lgu', label: 'LDRRMO (Municipal DRRM Office)' });
      (h.teams || []).forEach((t) => list.push({ target: t.target, kind: 'team', label: t.label }));
      if (h.responders) list.push({ target: 'responders', kind: 'team', label: 'Response team' });
      return { pending: false, list: list };
    }
    const units = U.DATA.unitsById || {};
    const all = (U.DATA.dispatches || {})[i.uuid] || [];
    all.filter((d) => d.dispatch_status !== 'declined').forEach((d) => {
      const u = units[d.unit_id];
      list.push({ target: 'dispatch:' + d.id, kind: 'team', label: d.team + (u ? ' · ' + u.name : '') });
    });
    if (!all.length) list.push({ target: 'responders', kind: 'team', label: 'Response team' });
    return { pending: false, list: list };
  }

  function starRow(id, target, kind, n, editable) {
    return '<div class="ug-rowf ug-gap8" style="gap:8px;align-items:center">' +
      '<div class="ug-stars" role="' + (editable ? 'radiogroup' : 'img') + '" data-rate-target="' + esc(target) + '" data-kind="' + esc(kind) + '" data-value="' + (n || 0) + '"' +
        ' aria-label="' + (editable ? 'Rating' : n + ' of 5 stars') + '">' + [1, 2, 3, 4, 5].map((k) =>
          editable
            ? '<button type="button" class="ug-star' + (k <= n ? ' is-on' : '') + '" role="radio" aria-checked="' + (k === n) + '" aria-label="' + k + ' star' + (k > 1 ? 's' : '') + '"' +
                A('rate-star', attr({ id: id, target: target, n: k })) + '>★</button>'
            : '<span class="ug-star' + (k <= n ? ' is-on' : '') + '">★</span>').join('') + '</div>' +
      '<span class="ug-dim ug-star-word" style="font-size:12px;font-weight:600">' + esc(STAR_WORDS[n] || '') + '</span></div>';
  }

  /* the reporter's ratings once the report is resolved (rate_report,
     migrations 057 + 058): overall (required) and each role that handled
     it (optional). Staff see them read-only. */
  function ratingCard(i, canRate, draft) {
    const r = i.rating;
    if (!canRate && !r) return '';
    const id = i.uuid || i.id;
    const saved = {};
    ((r && r.details) || []).forEach((d) => { saved[d.target] = d; });

    if (!canRate) {
      return '<div class="ug-card"><div class="ug-card-h"><h3>Resident Rating</h3>' +
        '<span class="ug-badge ug-badge--prepared">' + r.stars + ' / 5</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' +
          '<div class="ug-col" style="gap:4px"><span style="font-size:12px;font-weight:700">Overall</span>' + starRow(id, 'overall', 'overall', r.stars, false) +
            (r.comment ? '<div class="ug-dim" style="font-size:12px;line-height:1.5">' + esc(r.comment) + '</div>' : '') + '</div>' +
          (r.details || []).map((d) =>
            '<div class="ug-col" style="gap:4px;padding-top:10px;border-top:1px solid var(--ug-line)"><span style="font-size:12px;font-weight:700">' + esc(d.label) + '</span>' +
              starRow(id, d.target, '', d.stars, false) +
              (d.comment ? '<div class="ug-dim" style="font-size:12px;line-height:1.5">' + esc(d.comment) + '</div>' : '') + '</div>').join('') +
          '<div class="ug-dimmer" style="font-size:11px">' + esc(UG_UTIL.absTime(r.created_at) || '') + '</div>' +
        '</div></div>';
    }

    const picked = (draft && draft.id === id && draft.stars) || {};
    const targets = rateTargets(i);
    const starsFor = (t, fallback) => picked[t] != null ? picked[t] : fallback;
    const block = (t, kind, label, n, comment, sub) =>
      '<div class="ug-col" style="gap:6px' + (t !== 'overall' ? ';padding-top:12px;border-top:1px solid var(--ug-line)' : '') + '">' +
        '<span style="font-size:13px;font-weight:700">' + esc(label) + (sub ? ' <span class="ug-dimmer" style="font-weight:500">' + esc(sub) + '</span>' : '') + '</span>' +
        starRow(id, t, kind, n, true) +
        '<textarea class="ug-ta ug-rate-comment" rows="2" data-rate-comment data-target="' + esc(t) + '" placeholder="' + esc(RATE_HINTS[kind][n] || RATE_HINTS[kind][0]) + '">' + esc(comment || '') + '</textarea>' +
      '</div>';

    return '<div class="ug-card"><div class="ug-card-h"><h3>' + (r ? 'Your Rating' : 'Rate the Response') + '</h3>' +
        (r ? '<span class="ug-badge ug-badge--prepared">Sent</span>' : '') + '</div>' +
      '<div class="ug-card-b ug-col" style="gap:12px" data-rate-card="' + esc(id) + '">' +
        '<div class="ug-dim" style="font-size:12px;line-height:1.5">How well was your report handled? Rate the whole response, and if you like, each office and team that worked on it.</div>' +
        block('overall', 'overall', 'Overall response', starsFor('overall', r ? r.stars : 0), r ? r.comment : '', '') +
        (targets.pending
          ? '<div class="ug-dimmer" style="font-size:12px">' + I('clock', 12) + ' Checking who handled your report…</div>'
          : targets.list.map((x) => {
              const s0 = saved[x.target];
              return block(x.target, x.kind, x.label, starsFor(x.target, s0 ? s0.stars : 0), s0 ? s0.comment : '', '(optional)');
            }).join('')) +
        '<button class="ug-btn ug-btn--signal ug-btn--sm" style="align-self:flex-start"' + A('rate-submit', attr({ id: id })) + '>' + I('check', 14) + (r ? 'Update rating' : 'Submit rating') + '</button>' +
      '</div></div>';
  }
  /* The report's history from what was actually recorded, newest first:
     the status changes (report_status_history, loaded when the report is
     opened), every team's timestamps (report_dispatches) and the rating.
     Nothing is made up: a step whose time was never recorded says so. */
  const HISTORY_STATUS = { verified: 'Verified', dispatched: 'Response dispatched', resolved: 'Resolved',
    rejected: 'Rejected', reported: 'Back in the queue' };
  function historyEntries(i, forResident) {
    const rows = [];
    const add = (at, title, detail) => rows.push({ at: at || null, title: title, detail: detail || '' });
    const who = i.verified_by_role === 'lgu_ldrrmc' ? 'the Lingayen LDRRMO' : 'a barangay official';
    const by = i.verified_by_name ? ' (' + i.verified_by_name + ')' : '';
    add(i.created_at, 'Report received', (forResident ? 'Your report' : 'The report') + ' was added to the ' + (i.brgy || 'barangay') + ' queue.');

    const hist = (U.DATA.reportHistory || {})[i.uuid];
    if (hist && hist.length) {
      hist.forEach((h) => {
        if (!h.to_status || h.to_status === h.from_status) return;
        const note = (h.note || '').trim();
        let d = '';
        if (h.to_status === 'verified') {
          d = h.reason === 'auto_corroboration' ? 'Auto-verified: three residents confirmed the same hazard nearby.'
            : h.reason === 'sos' ? 'Verified automatically from an SOS.'
            : h.from_status === 'dispatched' ? 'Every team declined; waiting for a new team.'
            : 'Verified by ' + who + by + '.';
        } else if (h.to_status === 'dispatched') {
          d = h.reason === 'auto_dispatch' ? 'Response teams were sent automatically.' : 'A response team was dispatched.';
        } else if (h.to_status === 'resolved') {
          d = 'The report was closed.' + (note ? ' Note: ' + note : '');
        } else if (h.to_status === 'rejected') {
          d = 'The report was rejected.' + (note ? ' Reason: ' + note : '');
        }
        if (note && (h.to_status === 'verified' || h.to_status === 'dispatched') && h.reason !== 'auto_dispatch') d += ' ' + note;
        add(h.created_at, HISTORY_STATUS[h.to_status] || h.to_status, d);
      });
    } else {
      /* history not loaded (offline, or still loading): only what the
         report row itself records */
      const reached = (k) => ['verified', 'dispatched', 'resolved'].indexOf(i.status) >= ['verified', 'dispatched', 'resolved'].indexOf(k);
      if (i.status !== 'reported' && i.status !== 'rejected' && reached('verified')) add(i.verified_at, 'Verified', 'Verified by ' + who + by + '.');
      if (i.status === 'resolved') add(i.resolved_at, 'Resolved', 'The report was closed.');
      if (i.status === 'rejected') add(i.expired_at || null, i.expired ? 'Expired' : 'Rejected', i.expired ? 'Not verified within 3 days, so it was closed automatically.' : 'The report was rejected.');
    }

    const units = U.DATA.unitsById || {};
    ((U.DATA.dispatches || {})[i.uuid] || []).forEach((d) => {
      const name = d.team + (units[d.unit_id] ? ' · ' + units[d.unit_id].name : '');
      add(d.dispatched_at, name + ' dispatched', (d.auto_dispatched ? 'Sent automatically.' : 'Sent by ' + (d.dispatched_by_name || 'the dispatcher') + '.') +
        (d.dispatch_status === 'declined' ? ' The team declined' + (d.decline_reason ? ': ' + d.decline_reason : '') + '.' : ''));
      if (d.ack_at) add(d.ack_at, name + ' acknowledged', 'The team received the dispatch.');
      if (d.en_route_at) add(d.en_route_at, name + ' on the way', 'The team is moving to the scene.');
      if (d.on_scene_at) add(d.on_scene_at, name + ' arrived on scene', '');
      if (d.done_at) add(d.done_at, name + ' finished', 'The team completed its response.');
    });

    if (i.rating) {
      add(i.rating.created_at, (forResident ? 'You rated' : 'The resident rated') + ' the response',
        i.rating.stars + ' / 5' + (i.rating.comment ? ' · "' + i.rating.comment + '"' : ''));
    }
    /* newest first; anything without a recorded time goes last */
    return rows.sort((a, b) => (Date.parse(b.at || '') || 0) - (Date.parse(a.at || '') || 0));
  }

  /* the History / Activity Log card: latest 5, or every entry after View all */
  function historyCard(i, st, forResident, title) {
    const id = i.uuid || i.id;
    const all = historyEntries(i, forResident);
    const open = st.historyAll === id;
    const shown = open ? all : all.slice(0, 5);
    return '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(title) + '</h3>' +
        '<span class="ug-dimmer ug-mono" style="font-size:11px">NEWEST FIRST · ' + all.length + (all.length === 1 ? ' ENTRY' : ' ENTRIES') + '</span></div>' +
      '<div class="ug-card-b ug-col" style="gap:12px">' +
        '<ul class="ug-history">' + shown.map((h) =>
          '<li><div class="h-t">' + esc(h.title) + '</div>' +
          (h.detail ? '<div class="h-d">' + esc(h.detail) + '</div>' : '') +
          '<div class="h-time">' + esc(h.at ? UG_UTIL.absTime(h.at) : 'Time not recorded') + '</div></li>').join('') + '</ul>' +
        (all.length > 5
          ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="align-self:flex-start"' + A('history-all', attr({ id: id })) + '>' +
              (open ? 'Show latest only' : 'View all ' + all.length + ' entries') + '</button>'
          : '') +
      '</div></div>';
  }

  /* ---- advisories (feature 6 + 11) ---- */
  function mAdvisories(st){
    const f = st.sevFilter;
    const chips = [['all', 'All'], ['emergency', 'Emergency'], ['warning', 'Warning'], ['advisory', 'Advisory'], ['prepared', 'Preparedness']];
    const list = U.DATA.advisories.filter(a => f === 'all' || a.severity === f);
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">' + esc(T('advisories.compose')) + '</div><h2 style="font-size:18px;margin-top:3px">' + esc(T('title.advisories')) + '</h2></div>' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('sev-filter', attr({ v: c[0] })) + '>' + c[1] + '</button>').join('') + '</div>' +
      (list.length ? list.map(a =>
        '<button class="ug-card" style="text-align:left;cursor:pointer;width:100%"' + A('open-advisory', attr({ id: a.id })) + '>' +
          '<div class="ug-card-b ug-col" style="gap:9px">' +
            '<div class="ug-rowf ug-between" style="gap:8px">' + U.sevBadge(a.severity) +
              '<span class="ug-dimmer ug-mono" style="font-size:11px">' + esc(a.time) + '</span></div>' +
            '<h3 style="font-size:14px;line-height:1.35">' + esc(a.title) + '</h3>' +
            '<div class="ug-dimmer ug-rowf ug-wrap" style="font-size:11px;gap:10px">' +
              '<span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(a.area) + '</span>' +
              '<span class="ug-rowf" style="gap:4px">' + I('flag', 12) + esc(a.type) + '</span>' +
              '<span class="ug-rowf" style="gap:4px;margin-left:auto">Read' + I('chevron', 12) + '</span></div>' +
          '</div></button>').join('')
        : '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('megaphone', 20) + '</span>' +
          '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No Advisories in This Filter</div>' +
          '<div style="font-size:11px">Switch the filter to see other broadcasts.</div></div></div>') +
    '</div>';
  }

  function mAdvisoryDetail(st){
    const a = Repo.findAdvisory(st.openId);
    if (!a) return '<div class="ug-empty">Advisory not found.</div>';
    const steps = a.severity === 'prepared'
      ? ['Agree on a family meeting point and an out-of-town contact.', 'Prepare a go-bag with water, food, documents and a power bank.', 'Join the citywide drill and practise duck, cover and hold.']
      : ['Move to the nearest open evacuation centre if advised.', 'Avoid the affected roads and never cross moving flood water.', 'Bring water, medication, identification and a phone charger.', 'Keep monitoring official advisories for updates.'];
    const sev = (U.SEV[a.severity] || U.SEV.advisory);
    /* a tidy, section-grouped key/value block — looks more like an official
       bulletin than a wall of plain text. Replaces the old plain layout. */
    const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600;max-width:60%">' + esc(v || '—') + '</span></div>';
    const section = (title, body) => '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(title) + '</h3></div><div class="ug-card-b">' + body + '</div></div>';
    /* what to do now / how to prepare — render the same numbered list as before,
       just inside a proper card so it doesn't read as plain text. */
    const stepsHtml = steps.map((s, n) =>
      '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start;padding:7px 0">' +
      '<span class="ug-mono" style="font-size:11px;color:var(--ug-signal);width:16px;flex:none;padding-top:2px">0' + (n + 1) + '</span>' +
      '<span class="ug-dim" style="font-size:13px;line-height:1.5;flex:1">' + esc(s) + '</span></div>').join('');
    /* the delivery preference: push or in-app only. Falls back gracefully if
       the field is not on the existing advisory (older rows). */
    const deliveryLabel = (a.delivery_mode === 'in_app' || a.delivery_preference === 'in_app')
      ? T('advisories.delivery.inApp')
      : (a.delivery_mode === 'push' || a.delivery_preference === 'push' || !a.delivery_mode ? T('advisories.delivery.push') : '—');
    return '<div class="ug-col adv-detail is-' + esc(a.severity || 'advisory') + '" style="gap:14px">' +
      '<button class="ug-btn ug-btn--ghost ug-btn--sm" style="align-self:flex-start"' + A('nav', attr({ route: 'advisories' })) + '>' +
        '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 14) + '</span>' + esc(T('action.back')) + '</button>' +
      /* the banner with the severity strip + title — same gradient as before,
         still the visual anchor. */
      '<div class="ug-banner" style="min-height:140px;background:linear-gradient(135deg,' + sev.color + '40,var(--ug-surface, #0C1524))">' +
        '<div class="bn-in"><div class="ug-rowf ug-gap8" style="gap:6px;margin-bottom:6px">' + U.sevBadge(a.severity) + U.badge('id', a.type) + '</div>' +
        '<h2 style="font-size:18px;line-height:1.3">' + esc(a.title) + '</h2>' +
        '<div class="ug-dimmer" style="font-size:11px;margin-top:6px">' + esc(a.area || UG_GEO.PLACE.areaAll) + ' · ' + esc(a.time || 'just now') + '</div></div></div>' +
      /* overview — what this advisory is, in one card */
      section(T('advisories.overview'),
        kv(T('label.severity'), sev.label) +
        kv(T('label.type'), a.type) +
        kv(T('advisories.affectedArea'), a.area || UG_GEO.PLACE.areaAll) +
        kv(T('advisories.publishedOn'), a.time || 'just now') +
        kv(T('advisories.responsibleOffice'), UG_GEO.PLACE.office) +
        kv(T('advisories.deliveryPreference'), deliveryLabel) +
        /* a database id is long; the short form is enough to quote it */
        kv('Advisory ID', /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(a.id || '')) ? String(a.id).slice(0, 8).toUpperCase() : a.id)) +
      /* the full message — never truncated, the whole reason for the detail view */
      section(T('advisories.fullMessage'),
        '<p class="ug-dim" style="font-size:13px;line-height:1.7;white-space:pre-wrap">' + esc(a.body || a.message || '') + '</p>') +
      /* what to do now / how to prepare */
      section(a.severity === 'prepared' ? T('advisories.howToPrepare') : T('advisories.whatToDoNow'), stepsHtml) +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('save-advisory') + '>' + I('download', 15) + esc(T('advisories.saveOffline')) + '</button>' +
        '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('share-advisory') + '>' + esc(T('advisories.share')) + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ---- evacuation centres (feature 7) ---- */
  function mCenters(st){
    const f = st.centerFilter;
    const scope = st.shelterScope || 'all';
    /* a citizen with a barangay set can narrow to "My Barangay"; a citizen
       without one (or anonymous) just sees the whole municipality. */
    const myBrgy = (st.session && st.session.barangay) || '';
    const hasBrgy = !!myBrgy;
    const scoped = (scope === 'mine' && hasBrgy)
      ? U.DATA.centers.filter(c => c.brgy === myBrgy)
      : U.DATA.centers;
    const chips = [['all', 'All'], ['open', 'Open'], ['full', 'Full'], ['closed', 'Closed']];
    const list = scoped.filter(c => f === 'all' || c.status === f);
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">' + esc(T('title.centers')) + '</div><h2 style="font-size:18px;margin-top:3px">' + esc(T('nav.centers')) + '</h2></div>' +
      /* scope toggle — mirrors the citizen desktop screen so a resident can
         see just their own barangay's shelters with one tap. */
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' +
        (hasBrgy
          ? '<button class="ug-chip' + (scope === 'all' ? ' is-on' : '') + '"' + A('shelter-scope', attr({ v: 'all' })) + '>All Shelters</button>' +
            '<button class="ug-chip' + (scope === 'mine' ? ' is-on' : '') + '"' + A('shelter-scope', attr({ v: 'mine' })) + '>My Barangay (' + esc(myBrgy) + ')</button>'
          : '<button class="ug-chip is-on">All Shelters · Municipality-wide</button>') +
      '</div>' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('center-filter', attr({ v: c[0] })) + '>' + c[1] +
        '<span class="ug-mono" style="opacity:.7">' + (c[0] === 'all' ? scoped.length : scoped.filter(x => x.status === c[0]).length) + '</span></button>').join('') + '</div>' +
      (list.length ? list.map(c =>
        '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:11px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><h3 style="font-size:14px">' + esc(c.name) + '</h3>' + U.badge(c.status, c.status.charAt(0).toUpperCase() + c.status.slice(1)) + '</div>' +
          '<div class="ug-dimmer ug-rowf ug-wrap" style="font-size:11px;gap:10px">' +
            '<span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(c.brgy) + '</span>' +
            '<span class="ug-rowf" style="gap:4px">' + I('users', 12) + c.occ + ' of ' + c.cap + ' slots</span></div>' +
          occBar(c.occ, c.cap) +
          '<div class="ug-dim" style="font-size:12px">' + esc(c.note) + '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px">' +
            '<button class="ug-btn ug-btn--sm ug-btn--signal" style="flex:1;background:var(--ug-waze);color:var(--ug-waze-ink);border-color:transparent"' + A('directions', attr({ id: c.id, name: c.name })) + '>' + I('route', 14) + 'Navigate with Waze</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('save-center-offline', attr({ id: c.id })) + '>' + I('download', 14) + '</button>' +
          '</div>' +
        '</div></div>').join('') :
        '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('shelter', 20) + '</span>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No shelters match this filter</div>' +
        '<div class="ug-dim" style="font-size:11px">' + (scope === 'mine' && hasBrgy ? 'No shelters are listed in ' + esc(myBrgy) + ' yet. Switch to “All Shelters” to see the municipality-wide directory.' : 'Try a different status filter.') + '</div></div></div>') +
      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:11px">' + I('wifioff', 12) + 'This list is cached and works without a connection.</div>' +
    '</div>';
  }

  /* ---- hotlines (feature 8) ---- */
  function mHotlines(st){
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">' + esc(T('hotlines.title')) + '</div><h2 style="font-size:18px;margin-top:3px">' + esc(T('hotlines.title')) + '</h2>' +
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
        '<div class="ug-dim" style="font-size:12px;line-height:1.5">If a line is busy, keep the call short and state your barangay, landmark and number of people needing help.</div></div></div>' +
    '</div>';
  }

  /* ---- notifications (feature 10) ---- */
  /* one notification row, shared by the mobile inbox and the resident web
     portal. Every row is a button: one with a link (report, advisory, road
     work, relief, SOS) opens it, and every tap marks the row read. */
  function notifRow(n) {
    const typeIcon = (x) => {
      if (x.type === 'report_status') return { icon: 'check', cls: 'tone-prepared' };
      if (x.type === 'road_work') return { icon: 'road2', cls: 'tone-warning' };
      if (x.type === 'sos') return { icon: 'alert', cls: 'tone-emergency' };
      if (x.type === 'relief') return { icon: 'relief', cls: 'tone-advisory' };
      return { icon: x.icon || 'bell', cls: 'tone-' + (x.tone || 'advisory') };
    };
    const ti = typeIcon(n);
    const linked = !!(n.advisory_id || n.report_id || n.road_work_id || n.sos_id || n.relief_id);
    return '<button class="ug-row ug-notif-row' + (n.unread ? ' is-unread' : '') + '" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' +
        A('open-notification', attr({ id: n.id || '', advisory: n.advisory_id || '', report: n.report_id || '', 'road-work': n.road_work_id || '', sos: n.sos_id || '', relief: n.relief_id || '' })) +
        ' title="' + (linked ? 'Open' : 'Mark as read') + '">' +
      '<span class="ug-notif-icon ' + ti.cls + '">' + I(ti.icon, 16) + '</span>' +
      '<div class="r-main"><div class="r-t">' + esc(n.title) +
        (n.unread ? '<span class="ug-badge ug-badge--id" style="font-size:11px;margin-left:6px">NEW</span>' : '') + '</div>' +
        '<div class="ug-dim" style="font-size:12px;margin-top:4px;line-height:1.5">' + esc(n.body) + '</div>' +
        '<div class="r-m"><span>' + I('clock', 12) + esc(n.time) + '</span>' +
          (linked ? '<span style="color:var(--ug-signal);font-weight:600">Tap to open</span>' : '') + '</div></div>' +
      '<span class="ug-dimmer" style="display:flex;align-self:center">' + I(linked ? 'chevron' : 'check', 17) + '</span>' +
    '</button>';
  }

  /* ---- the notification panel (bell in the header) ----
     The bell opens this panel over the page instead of a full screen, for the
     resident, barangay and LDRRMO portals. It has the same filters as the
     Notifications page (one set of kinds for both) and a link to that page.
     Open / closed and the filter live in the app state (S.notifPanel,
     S.notifFilter), so a live refresh does not close it. */
  const NKIND = { sos: ['SOS', 'alert'], dispatch: ['Teams', 'truck'], reports: ['Reports', 'doc'], advisories: ['Alerts', 'megaphone'],
    relief: ['Relief', 'relief'], roads: ['Roads', 'road2'], other: ['Other', 'bell'] };
  function notifKind(n) {
    const t = String(n.type || '');
    if (t === 'sos' || n.sos_id) return 'sos';
    if (/dispatch|unit/.test(t) || n.icon === 'truck') return 'dispatch';
    if (/report/.test(t) || n.report_id) return 'reports';
    if (t === 'advisory' || n.advisory_id) return 'advisories';
    if (t === 'relief' || n.relief_id) return 'relief';
    if (t === 'road_work' || n.road_work_id) return 'roads';
    return 'other';
  }
  /* newest first, without the duplicates a re-fired RPC can leave */
  function notifRows() {
    const raw = U.DATA.notifications || [];
    const seenId = {}, seenSig = {}, rows = [];
    for (let k = raw.length - 1; k >= 0; k--) {
      const n = raw[k]; if (!n) continue;
      const sig = (n.title || '') + '|' + (n.body || '') + '|' + (n.created_at || n.time || '');
      if ((n.id && seenId[n.id]) || seenSig[sig]) continue;
      if (n.id) seenId[n.id] = true; seenSig[sig] = true; rows.unshift(n);
    }
    return rows;
  }
  /* the filter chips: All, Unread, then only the kinds that have rows */
  function notifFilter(rows, f) {
    const count = { all: rows.length, unread: rows.filter((n) => n.unread).length };
    rows.forEach((n) => { const k = notifKind(n); count[k] = (count[k] || 0) + 1; });
    const tabs = [['all', 'All'], ['unread', 'Unread']].concat(Object.keys(NKIND).filter((k) => count[k]).map((k) => [k, NKIND[k][0]]));
    if (!tabs.some((t) => t[0] === f)) f = 'all';
    return {
      f: f, tabs: tabs, count: count,
      shown: rows.filter((n) => f === 'all' || (f === 'unread' ? n.unread : notifKind(n) === f)),
      chips: '<div class="ug-nchips" role="tablist" aria-label="Filter notifications">' + tabs.map((t) =>
        '<button role="tab" aria-selected="' + (f === t[0]) + '" class="' + (f === t[0] ? 'is-on' : '') + '"' + A('notif-filter', attr({ v: t[0] })) + '>' +
          esc(t[1]) + (count[t[0]] ? '<i>' + count[t[0]] + '</i>' : '') + '</button>').join('') + '</div>'
    };
  }
  function notifItem(n) {
    const k = notifKind(n);
    return '<button class="ug-nitem' + (n.unread ? ' is-unread' : '') + ' is-' + k + '"' +
        A('open-notification', attr({ id: n.id || '', advisory: n.advisory_id || '', report: n.report_id || '', 'road-work': n.road_work_id || '', sos: n.sos_id || '', relief: n.relief_id || '' })) + '>' +
      /* every row the same: icon (a dot on it when unread), the title with
         the time on its right, then the message cut to one or two lines */
      '<span class="ug-nitem-i">' + I(NKIND[k][1], 15) + (n.unread ? '<i class="ug-nitem-dot" aria-label="Unread"></i>' : '') + '</span>' +
      '<span class="ug-nitem-m"><span class="ug-nitem-top"><b>' + esc(n.title || '') + '</b><em>' + esc(n.time || '') + '</em></span>' +
        (n.body ? '<small>' + esc(n.body) + '</small>' : '') + '</span>' +
    '</button>';
  }
  /* the panel's filter: one compact button ("All · 70") that drops down the
     list of kinds instead of two rows of chips. .ug-wmore + [data-more-panel]
     reuse toggle-more and the tap-outside close (js/app.js). */
  function notifFilterMenu(F) {
    const label = (F.tabs.find((t) => t[0] === F.f) || ['all', 'All'])[1];
    return '<div class="ug-nfilt ug-wmore">' +
      '<button class="ug-nfilt-btn"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Filter notifications: ' + esc(label) + '">' +
        I('sort', 14) + '<span>Show</span><b>' + esc(label) + '</b>' + (F.count[F.f] ? '<i>' + F.count[F.f] + '</i>' : '') + I('chevdn', 14) + '</button>' +
      '<div class="ug-nfilt-menu" role="listbox" data-more-panel hidden>' + F.tabs.map((t) =>
        '<button role="option" aria-selected="' + (F.f === t[0]) + '" class="' + (F.f === t[0] ? 'is-on' : '') + '"' + A('notif-filter', attr({ v: t[0] })) + '>' +
          '<span>' + esc(t[1]) + '</span><i>' + (F.count[t[0]] || 0) + '</i>' + (F.f === t[0] ? I('check', 14) : '') + '</button>').join('') +
      '</div></div>';
  }

  /* it fades in when it opens, not again on every redraw (live data) */
  let notifPanelShown = false;
  function notifPanel(st) {
    if (!st.notifPanel) { notifPanelShown = false; return ''; }
    const enter = !notifPanelShown;
    notifPanelShown = true;
    const rows = notifRows();
    const unread = rows.filter((n) => n.unread).length;
    const F = notifFilter(rows, st.notifFilter || 'all');
    return '<div class="ug-npanel' + (enter ? ' is-enter' : '') + '" role="dialog" aria-label="Notifications">' +
      '<div class="ug-npanel-h"><b>Notifications</b>' + (unread ? '<span class="ug-npanel-n">' + (unread > 99 ? '99+' : unread) + ' new</span>' : '<span class="ug-npanel-ok">All caught up</span>') +
        '<button class="ug-npanel-x"' + A('notif-panel') + ' aria-label="Close notifications">' + I('x', 16) + '</button></div>' +
      '<div class="ug-npanel-bar">' + notifFilterMenu(F) +
        (unread ? '<button class="ug-npanel-a"' + A('read-all') + '>' + I('check', 14) + 'Mark all read</button>' : '') + '</div>' +
      '<div class="ug-npanel-list">' + (F.shown.length ? F.shown.slice(0, 40).map(notifItem).join('')
        : '<p class="ug-npanel-none">' + I('bell', 22) + '<span>' + (rows.length ? 'Nothing here' : 'No notifications yet') + '</span></p>') + '</div>' +
      '<button class="ug-npanel-all"' + A('nav', attr({ route: 'notifications' })) + '>See all notifications' + I('chevron', 14) + '</button>' +
    '</div>';
  }

  function mNotifications(st){
    /* dedupe by id (exact duplicates from a re-fired RPC) and by a
       title+body+time signature (near-identical duplicates like the same SOS
       arriving twice with different row ids). Keeps the newest of each group. */
    const raw = (U.DATA.notifications || []);
    const byId = {};
    const bySig = {};
    const deduped = [];
    /* walk oldest-first so newer rows overwrite older ones at the same key */
    for (let k = raw.length - 1; k >= 0; k--) {
      const n = raw[k];
      if (!n) continue;
      const sig = (n.title || '') + '|' + (n.body || '') + '|' + (n.created_at || n.time || '');
      if (n.id && byId[n.id]) continue;
      if (bySig[sig]) continue;
      if (n.id) byId[n.id] = true;
      bySig[sig] = true;
      deduped.unshift(n);
    }
    const rows = deduped;
    const unread = rows.filter(n => n.unread).length;
    return '<div class="ug-col" style="gap:14px">' +
      '<div class="ug-rowf ug-between" style="gap:8px"><div><div class="ug-lab">Push Notifications</div><h2 style="font-size:18px;margin-top:3px">Inbox</h2>' +
        (unread ? '<div class="ug-dimmer" style="font-size:11px;margin-top:4px">' + unread + ' unread</div>' : '') + '</div>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('read-all') + '>' + I('check', 15) + 'Mark All Read</button></div>' +
      '<div class="ug-card"><div class="ug-rows">' + (rows.length ? rows.map(n => notifRow(n)).join('') : '<div class="ug-empty"><span class="e-ico">' + I('bell', 20) + '</span>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No notifications yet</div>' +
        '<div class="ug-dim" style="font-size:11px">Advisories, report status changes and road work notices appear here.</div></div>') + '</div></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:11px">' + I('bell', 12) + 'Alerts are delivered even when the app is closed. History persists on this device.</div>' +
      /* Enable push on this device — surfaces the subscribe flow so the
         push_subscriptions table actually gets a row, instead of the LGU
         seeing "no push devices registered yet" forever. */
''+
    '</div>';
  }

  /* Staff inbox (Nov 2026): the console's own layout instead of the phone
     inbox. Type pills + search, rows grouped by day, a quiet unread dot in
     place of the NEW pill. Same data, dedupe and open-notification action. */
  function dNotifs(st) {
    const raw = (U.DATA.notifications || []);
    const seenId = {}, seenSig = {}, rows = [];
    for (let k = raw.length - 1; k >= 0; k--) {
      const n = raw[k]; if (!n) continue;
      const sig = (n.title || '') + '|' + (n.body || '') + '|' + (n.created_at || n.time || '');
      if ((n.id && seenId[n.id]) || seenSig[sig]) continue;
      if (n.id) seenId[n.id] = true; seenSig[sig] = true; rows.unshift(n);
    }
    const kind = (n) => {
      const t = String(n.type || '');
      if (t === 'sos' || n.sos_id) return 'sos';
      if (/dispatch|unit/.test(t) || n.icon === 'truck') return 'dispatch';
      if (/report/.test(t) || n.report_id) return 'reports';
      if (t === 'advisory' || n.advisory_id) return 'advisories';
      return 'other';
    };
    const KIND = { sos: ['SOS', 'alert'], dispatch: ['Dispatch', 'truck'], reports: ['Reports', 'doc'], advisories: ['Advisories', 'megaphone'], other: ['Other', 'bell'] };
    const count = { all: rows.length, unread: rows.filter((n) => n.unread).length };
    rows.forEach((n) => { const k = kind(n); count[k] = (count[k] || 0) + 1; });
    const f = st.ntFilter || 'all';
    const q = String(st.ntSearch || '').trim().toLowerCase();
    const shown = rows.filter((n) => f === 'all' || (f === 'unread' ? n.unread : kind(n) === f))
      .filter((n) => !q || [n.title, n.body].some((v) => String(v || '').toLowerCase().indexOf(q) >= 0));
    const day0 = new Date(); day0.setHours(0, 0, 0, 0);
    const group = (n) => {
      const t = Date.parse(n.created_at || '');
      if (!t) return 'Earlier';
      if (t >= day0.getTime()) return 'Today';
      if (t >= day0.getTime() - 86400000) return 'Yesterday';
      if (t >= day0.getTime() - 6 * 86400000) return 'This week';
      return 'Earlier';
    };
    const tabs = [['all', 'All'], ['unread', 'Unread']].concat(['sos', 'dispatch', 'reports', 'advisories', 'other'].filter((k) => count[k]).map((k) => [k, KIND[k][0]]));
    const row = (n) => {
      const k = kind(n);
      const linked = !!(n.advisory_id || n.report_id || n.road_work_id || n.sos_id || n.relief_id);
      /* styled like the SOS Log feed (.sf-*): a round icon for the kind, the
         title in bold with the message after it, the time (crimson while
         unread), and a dot on the right until it is read */
      return '<div class="sf-row nt-sf' + (n.unread ? ' is-sent' : ' is-read') + ' is-' + k + '" role="button" tabindex="0"' +
          A('nt-preview', attr({ kind: k, id: n.id || '', advisory: n.advisory_id || '', report: n.report_id || '', 'road-work': n.road_work_id || '', sos: n.sos_id || '', relief: n.relief_id || '' })) + '>' +
        '<span class="sf-av">' + I(KIND[k][1], 20) + '</span>' +
        '<div class="sf-main"><p class="sf-txt"><b>' + esc(n.title || '') + '</b>' + (n.body ? ' ' + esc(n.body) : '') + '</p>' +
          '<span class="sf-time">' + esc(n.time || '') + ' · ' + KIND[k][0] + (n.unread ? ' · Unread' : '') + '</span></div>' +
        (n.unread ? '<i class="sf-dot" aria-label="Unread"></i>' : '<span class="nt-sf-go">' + I('chevron', 15) + '</span>') +
      '</div>';
    };
    let list = '', last = '';
    shown.forEach((n) => { const g = group(n); if (g !== last) { list += '<h4 class="sf-h">' + g + '</h4>'; last = g; } list += row(n); });

    return '<div class="ug-col nt" style="gap:20px">' +
      pageHead('Notifications', 'Alerts for your account: SOS, reports, dispatches and advisories, newest first.',
''+
        '<button class="hl-ghost hl-primary nt-readall"' + A('read-all') + (count.unread ? '' : ' disabled') + ' aria-label="Mark all read" title="Mark all read">' + I('check', 14) + 'Mark all read</button>') +
      '<div class="hl-tool nt-tool">' +
        /* phones: the type filter as a compact dropdown left of the search */
        (function () {
          const cur = tabs.find((t) => t[0] === f) || tabs[0];
          return '<div class="ug-wmore inc-dd hl-dd nt-dd"><button class="inc-dd-btn"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Filter notifications">' +
              I('sort', 15) + '<span>' + esc(cur[1]) + '</span>' + I('chevdn', 14) + '</button>' +
            '<div class="inc-dd-panel" data-more-panel hidden role="listbox">' + tabs.map((t) =>
              '<button role="option" class="' + (t[0] === f ? 'is-on' : '') + '" data-act="nt-filter" data-v="' + t[0] + '">' +
                '<span>' + esc(t[1]) + '</span><b>' + (count[t[0]] || 0) + '</b>' + (t[0] === f ? I('check', 14) : '') + '</button>').join('') +
            '</div></div>';
        })() +
        '<div class="sos-tabs" role="tablist" aria-label="Notification type">' + tabs.map((t) =>
          '<button role="tab" aria-selected="' + (f === t[0]) + '" class="' + (f === t[0] ? 'is-on' : '') + '" data-act="nt-filter" data-v="' + t[0] + '">' + t[1] + '<i>' + (count[t[0]] || 0) + '</i></button>').join('') + '</div>' +
        '<span class="sos-search">' + I('search', 14) + '<input data-field="rw.ntSearch" value="' + esc(st.ntSearch || '') + '" placeholder="Search notifications" aria-label="Search notifications">' +
          (st.ntSearch ? '<button data-act="nt-search-clear" aria-label="Clear search">' + I('x', 11) + '</button>' : '') + '</span></div>' +
      '<section class="rl-card nt-card sf-card">' + (shown.length ? list
        : '<div class="rl-empty"><span>' + I('bell', 20) + '</span><b>' + (rows.length ? 'Nothing here' : 'No notifications yet') + '</b><p>' +
            (rows.length ? 'Try another filter or clear the search.' : 'SOS alerts, report changes, dispatches and advisories appear here.') + '</p></div>') + '</section>' +
      '<p class="nt-foot">' + I('bell', 12) + 'Alerts arrive even when the app is closed once push is enabled on this device.</p>' +
    '</div>';
  }

  /* ---- offline (feature 9) ---- */
  function mOffline(st){
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Offline Access</div><h2 style="font-size:18px;margin-top:3px">Offline Readiness</h2></div>' +
      '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:12px;align-items:center;text-align:center">' +
        '<span style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:rgba(255,176,32,.14);color:var(--ug-warning);border:1px solid rgba(255,176,32,.3)">' + I('wifioff', 25) + '</span>' +
        '<h3 style="font-size:16px">' + (st.offline ? 'You Are Offline' : 'Offline Copy Ready') + '</h3>' +
        '<p class="ug-dim" style="font-size:12px;line-height:1.5;max-width:280px">' + esc(T('offline.subtitle')) + '</p>' +
      '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('offline.availableNoSignal')) + '</h3><span class="ug-dimmer ug-mono" style="font-size:11px">' + esc(T('offline.lastSaved')) + ' ' + esc(U.DATA.offlineCache.synced) + '</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:10px">' +
          [['Emergency Hotlines', U.DATA.offlineCache.hotlines, 'phone'], ['Evacuation Centers', U.DATA.offlineCache.centers, 'shelter'], ['Critical Advisories', U.DATA.offlineCache.advisories, 'megaphone']]
            .map(x => '<div class="ug-rowf ug-between" style="gap:10px"><span class="ug-rowf" style="gap:9px">' +
              '<span style="color:var(--ug-signal);display:flex">' + I(x[2], 16) + '</span>' +
              '<span style="font-size:13px">' + x[0] + '</span></span>' +
              '<span class="ug-badge ug-badge--resolved">' + x[1] + ' ' + esc(T('offline.ready')) + '</span></div>').join('') +
        '</div></div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:10px">' +
        '<div class="ug-lab">' + esc(T('offline.savedOnPhone')) + '</div>' +
        '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">' + esc(T('offline.lastSaved')) + '</span><span class="ug-mono">' + esc(U.DATA.offlineCache.synced) + '</span></div>' +
        '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">' + esc(T('offline.waitingToSend')) + '</span><span class="ug-mono">' + (UG.DATA.queueCount || 0) + ' ' + esc(T('offline.waiting')) + '</span></div>' +
        '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">' + esc(T('offline.worksWithoutInternet')) + '</span><span class="ug-mono">' + esc(('serviceWorker' in navigator) ? T('label.yes') : T('label.no')) + '</span></div>' +
        '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">' + esc(T('settings.appVersion')) + '</span><span class="ug-mono">' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</span></div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<button class="ug-btn ug-btn--sm ug-btn--signal" style="flex:1"' + A('reconnect') + '>' + I('wave', 15) + (st.offline ? 'Back Online' : 'Check Connection') + '</button>' +
          '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('force-refresh') + '>' + I('wave', 15) + esc(T('offline.reloadApp')) + '</button>' +
        '</div>' +
        '<div class="ug-dimmer" style="font-size:11px;line-height:1.5">' + esc(T('offline.reloadHelp')) + '</div>' +
      '</div></div>' +
    '</div>';
  }

  /* ================================================================== */
  /* DESKTOP (barangay / LGU console)                                    */
  /* ================================================================== */
  const DNAV = [
    /* by urgency, the same order as the console sidebar (js/barangay.js):
       respond, then inform the public, then reference and records */
    ['dashboard', 'nav.home', 'home', null],
    ['sos', 'nav.sos', 'sos', null, ['lgu_ldrrmc', 'barangay_official']],
    ['incidents', 'nav.incidents', 'alert', '6'],
    ['response-team', 'nav.response-team', 'shield', null, ['barangay_official']],
    ['dispatch-units', 'nav.dispatch-units', 'truck', null, ['lgu_ldrrmc']],
    ['advisories', 'nav.advisories', 'megaphone', '5'],
    ['centers', 'nav.centers', 'shelter', null],
    ['relief', 'nav.relief', 'relief', null],
    ['roadwork', 'nav.roadwork', 'road2', null],
    ['hotlines', 'nav.hotlines', 'phone', null],
    ['guides', 'nav.guides', 'guide', null, ['lgu_ldrrmc']],
    ['faqs', 'nav.faqs', 'faq', null, ['lgu_ldrrmc']],
    ['analytics', 'nav.analytics', 'layers', null],
    /* Module G: situation report, incident summary, damage and needs */
    ['reporting', 'nav.reporting', 'doc', null, ['lgu_ldrrmc', 'barangay_official']],
    ['others-review', 'nav.others-review', 'help', null, ['lgu_ldrrmc']],
    /* Module H: accounts, roles and the activity log are Super Admin only.
       A sixth slot of 'super' hides the entry from LDRRMO staff; the database
       enforces the same rule (migration 043). */
    ['users', 'nav.users', 'users', null, ['lgu_ldrrmc'], 'super'],
    ['audit', 'nav.audit', 'clock', null, ['lgu_ldrrmc'], 'super'],
    /* Settings is now visible to EVERY role. The tabs inside adapt to the
       role (citizens see language + notifications + offline; LGU sees those
       plus org profile + templates). No role gate here. */
    ['settings', 'nav.settings', 'settings', null],
  ];

  function dSidebar(st){
    const role = sess(st);
    const counts = U.DATA.counts || {};
    const nz = (v) => (v ? String(v) : null);
    const navCount = (r) => r === 'incidents' ? nz(counts.openIncidents)
      : r === 'advisories' ? nz(counts.liveAdvisories)
      : r === 'centers' ? nz(counts.openCenters) : null;
    const route = st.route === 'incident' ? 'incidents' : st.route === 'relief-verify' ? 'relief' : st.route;
    /* T() is defined at the UG_SCREENS module scope (line 362) — reused here. */
    return '<aside class="ug-side" id="ug-console-nav">' +
      /* the Super Admin's logo goes back to their home screen (Overview, Accounts, Activity) */
      (role.superAdmin
        ? '<button class="ug-brand ug-brand-btn"' + A('nav', attr({ route: 'admin-home' })) + ' aria-label="Go to the Super Admin home">'
        : '<button class="ug-brand ug-brand-btn"' + A('nav', attr({ route: 'dashboard' })) + ' aria-label="Go to the dashboard">') + U.brandMark(32) +
        '<span class="ug-col" style="gap:0"><span class="ug-wordmark" style="font-size:16px">Uni<em>Guard</em></span>' +
        '<span class="ug-dimmer" style="font-size:11px;letter-spacing:.1em;text-transform:uppercase">Command console</span></span></button>' +
      /* Super Admin only: back to the main screen (Overview, Accounts, Activity) */
      (role.superAdmin ? '<button class="ug-nav ug-sa-back-nav"' + A('nav', attr({ route: 'admin-home' })) + '>' + I('chevron', 18, 'ug-flip') + '<span>Main screen</span></button>' : '') +
      DNAV.filter(n => (!n[4] || n[4].indexOf(role.role) !== -1) && (n[5] !== 'super' || role.superAdmin)).map(n => '<button class="ug-nav' + (route === n[0] ? ' is-on' : '') + '"' + A('nav', attr({ route: n[0] })) + '>' +
        I(n[2], 18) + '<span>' + T(n[1]) + '</span>' + (navCount(n[0]) ? '<span class="n-cnt">' + navCount(n[0]) + '</span>' : '') + '</button>').join('') +
      '<div style="margin-top:auto" class="ug-col ug-gap6" style="gap:6px">' +
        '<button class="ug-nav"' + A('nav', attr({ route: 'offline' })) + '>' + I(st.offline ? 'wifioff' : 'download', 18) + '<span>' + T('nav.offline') + '</span></button>' +
        '<div class="ug-hr" style="margin:8px 0"></div>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding:4px 8px">' +
          '<span class="ug-av">' + esc(role.initials) + '</span>' +
          '<span class="ug-col" style="gap:0;min-width:0"><span style="font-size:12px;font-weight:600">' + esc(role.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:11px">' + esc(role.title) + '</span></span></div>' +
        '<button class="ug-nav"' + A('logout') + '>' + I('logout', 18) + '<span>' + T('action.signout') + '</span></button>' +
        '<button class="ug-nav"' + A('force-refresh') + '>' + I('wave', 18) + '<span>' + T('settings.forceRefresh') + '</span></button>' +
        '<div class="ug-mono" style="font-size:11px;color:var(--ug-ink-3);padding:2px 9px 4px">build ' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</div>' +
      '</div>' +
    '</aside>';
  }

  function dTopbar(st, title, sub){
    const role = sess(st);
    return '<header class="ug-top">' +
      '<button class="ug-ico-btn ug-menubtn" data-act="toggle-nav" aria-label="Open the navigation menu" ' +
        'aria-expanded="false" aria-controls="ug-console-nav">' + I('menu', 18) + '</button>' +
      /* Super Admin only: always-visible way back to the main screen */
      (role.superAdmin ? '<button class="ug-sa-back"' + A('nav', attr({ route: 'admin-home' })) + ' aria-label="Back to the main screen">' + I('chevron', 15, 'ug-flip') + '<span>Main screen</span></button>' : '') +
      '<div class="ug-col" style="gap:0;min-width:150px">' +
        '<span style="font-family:var(--ug-font);font-weight:700;font-size:14px">' + esc(title) + '</span>' +
        '<span class="ug-dimmer" style="font-size:11px">' + esc(sub) + '</span></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px;margin-left:auto">' +
        '<span class="ug-chip ug-top-live' + (st.offline ? '' : ' is-on') + '">' + I(st.offline ? 'wifioff' : 'wave', 13) + (st.offline ? 'Offline' : 'Live feed') + '</span>' +
        '<button class="ug-ico-btn" aria-label="Notifications"' + A('nav', attr({ route: 'notifications' })) + '>' + I('bell', 17) + (st.readNotifs ? '' : '<span class="dot"></span>') + '</button>' +
        '<button class="ug-ico-btn" aria-label="Sign out"' + A('logout') + '>' + I('logout', 17) + '</button>' +
        '<div class="ug-rowf ug-gap10" style="gap:9px;padding-left:6px;border-left:1px solid var(--ug-line);margin-left:4px">' +
          '<span class="ug-col ug-top-user" style="gap:0;align-items:flex-end"><span style="font-size:12px;font-weight:600">' + esc(role.name) + '</span>' +
          '<span class="ug-dimmer" style="font-size:11px">' + esc(role.scope) + '</span></span>' +
          '<span class="ug-av">' + esc(role.initials) + '</span>' +
        '</div>' +
      '</div>' +
    '</header>';
  }

  function pageHead(title, sub, actions){
    return '<div class="ug-rowf ug-between ug-wrap ug-phead" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  function replacementQueue(st, limit) {
    if (isSuperAdminSession(st)) return '';
    const rows = U.DATA.replacementQueue || [];
    if (!rows.length) return '';
    return '<section class="ug-card"><div class="ug-card-h ug-wrap">' +
      '<div><h3>Needs a replacement team</h3><p class="ug-dim">MDRRMO duty staff coordinate reassignment. Barangay officials can send their own team.</p></div>' +
      (limit && rows.length > limit ? '<button class="ug-btn ug-btn--sm"' + A('nav', attr({ route: 'incidents' })) + '>View incidents</button>' : '') +
      '</div><div class="ug-rows">' + rows.slice(0, limit || rows.length).map((row) =>
        '<div class="ug-row ug-wrap"><div class="r-main"><div class="r-t">' + esc(row.code) + ' · ' +
          esc(row.barangay || 'Lingayen') + ' ' + U.sevBadge(row.severity) + '</div>' +
          '<div class="r-m">' + (row.is_overdue ? 'Overdue · ' : '') + 'Review by ' + esc(UG_UTIL.absTime(row.review_by)) + '</div></div>' +
          '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('open-replacement', attr({ id: row.report_id })) + '>Open incident</button></div>'
      ).join('') + '</div></section>';
  }

  /* A visible strip that tells the duty officer whether the dashboard is
     showing live synced data, the last-known cached data, or the demo seed.
     Without this the dashboard reads like "plain text" because you cannot tell
     sample data from real data. */
  /* ---- dashboard (feature 2) ---- */
  function dDashboard(st){
    const incidents = U.DATA.incidents;
    const recent = incidents.slice(0, 5);
    /* quick action shown inline on each recent incident row so the duty officer
       can advance a report straight from the dashboard without opening it.
       Super Admin has no verify permission: instead of Verify, they get an Edit
       action that opens the existing edit-report modal. */
    const isSuper = !!(st.session && st.session.role === 'lgu_ldrrmc' && st.session.superAdmin);
    const quickAction = (i) => {
      if (isSuper) return '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('edit-report', attr({ id: i.id })) + '>' + I('settings', 14) + 'Edit</button>';
      if (i.status === 'verified')   return '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('advance', attr({ id: i.id })) + '>' + I('truck', 14) + 'Dispatch</button>';
      if (i.status === 'dispatched' && !(st.session && st.session.role === 'barangay_official' &&
        ((U.DATA.dispatches || {})[i.uuid] || []).some((d) => d.unit_id && !['done', 'declined'].includes(d.dispatch_status)))) return '<button class="ug-btn ug-btn--sm"' + A('advance', attr({ id: i.id })) + '>' + I('check', 14) + 'Resolve</button>';
      if (i.status === 'reported')   return '<button class="ug-btn ug-btn--sm"' + A('advance', attr({ id: i.id })) + '>Verify</button>';
      return '';
    };
    /* a compact "team(s) dispatched" line for incidents that already have a
       response on the way, so the dashboard finally shows what was dispatched
       instead of only the status word. */
    const dispatchLine = (i) => {
      const list = (U.DATA.dispatches || {})[i.uuid || i.id] || [];
      if (!list.length) return '';
      const first = list[0];
      return '<div class="r-m"><span style="color:var(--ug-st-dispatched)">' + I('truck', 12) + esc(first.team) + (list.length > 1 ? ' +' + (list.length - 1) + ' more' : '') + '</span></div>';
    };
    /* escalated incidents: stale > 30 min or life-safety bypass. Surfaced at
       the top of the dashboard so the LGU never misses what the escalation
       policy pushed into their queue. */
    const escalated = incidents.filter((i) => i.escalates_to_lgu);
    const escalationBanner = escalated.length
      ? '<div class="ug-card ug-card--flat" style="border-left:3px solid var(--ug-emergency)"><div class="ug-card-b ug-col" style="gap:10px">' +
          '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:center"><span style="color:var(--ug-emergency);display:flex">' + I('alert', 16) + '</span>' +
            '<div style="font-size:13px;font-weight:700;color:var(--ug-emergency)">' + escalated.length + ' escalated to LGU</div>' +
            '<span class="ug-dim" style="font-size:11px;margin-left:auto">Stale (>30 min) or life-safety hazard</span></div>' +
          '<div class="ug-dim" style="font-size:11px;line-height:1.55"><b>Escalated</b> is not a status — it is a separate flag for reports needing additional LGU intervention. A report is escalated when it remains unverified for more than 30 minutes (stale), or when it is a life-safety hazard (fire, power line, accident, landslide) that bypasses the barangay queue. It complements the Processing / Verified / Deployed / Resolved status pipeline; it does not replace it.</div>' +
          '<div class="ug-rows" style="max-height:200px">' + escalated.slice(0, 6).map((i) =>
            '<div class="ug-row" role="button" tabindex="0" style="width:100%;text-align:left;cursor:pointer"' + A('open-incident', attr({ id: i.id })) + '><span class="r-dot" style="background:var(--ug-emergency)"></span>' +
              '<div class="r-main"><div class="r-t">' + esc(i.hazard) + '<span class="ug-badge ug-badge--id">' + esc(i.id) + '</span>' +
                (i.is_severity_bypass ? '<span class="ug-badge ug-badge--emergency" style="font-size:11px">Life-safety</span>' : '<span class="ug-badge ug-badge--warning" style="font-size:11px">Stale</span>') +
              '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(i.brgy) + '</span><span>' + I('clock', 12) + esc(i.time) + '</span></div></div>' +
              '<span class="ug-rowf ug-gap6" style="gap:6px">' + U.stageBadge(i.status) + (st.session && st.session.role === 'lgu_ldrrmc' && !st.session.superAdmin ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('lgu-verify', attr({ id: i.id })) + '>' + I('shield', 13) + 'LGU-Verify</button>' : '') + '</span>' +
            '</div>').join('') + '</div>' +
        '</div></div>'
      : '';
    return '<div class="ug-col" style="gap:14px">' +
      pageHead(T('title.dashboard'), T('dashboard.subtitle') + ' ' + U.DATA.city + '.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('nav', attr({ route: 'analytics' })) + '>' + I('layers', 15) + 'Analytics</button>' +
        /* only LGU / LDRRMC may declare (RPC declare_emergency, migration 009) */
        (st.session && st.session.role === 'lgu_ldrrmc'
          ? '<button class="ug-btn ug-btn--danger"' + A('declare') + '>' + I('alert', 16) + esc(T('dashboard.declareEmergency')) + '</button>'
          : '')) +
      replacementQueue(st, 5) + escalationBanner +
      '<div class="ug-dgrid4">' + U.DATA.kpis.map(U.stat).join('') + '</div>' +
      '<div class="ug-dgrid-main">' +
        '<div class="ug-card"><div class="ug-card-h" style="padding:14px 16px">' +
          '<div><h3>Live Operations Map</h3><span class="ug-dimmer" style="font-size:11px">Active incidents, SOS response zones and deployed units</span></div>' +
          '<div class="ug-rowf ug-gap8" style="gap:6px">' +
            '<span class="ug-chip is-on">' + I('radar', 13) + 'Realtime</span>' +
            '<button class="ug-chip' + (st.mapPanelOpen ? ' is-on' : '') + '" data-act="map-layers-panel" aria-expanded="' + !!st.mapPanelOpen + '">' + I('layers', 13) + 'Layers</button></div></div>' +
          '<div class="ug-map" data-map="live" data-toggles="chip" style="min-height:260px;flex:1">' + U.mapSVG({ animated: true }) +
            '<div class="map-scale">1 : 25 000</div></div></div>' +
        '<div class="ug-card ug-col" style="min-height:0"><div class="ug-card-h" style="padding:14px 16px">' +
          '<div><h3>Recent Incidents</h3><span class="ug-dimmer" style="font-size:11px">Tap a row for the full detail view</span></div>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('nav', attr({ route: 'incidents' })) + '>View All</button></div>' +
          '<div class="ug-rows ug-scroll" style="max-height:360px">' + (recent.length ? recent.map(i =>
            /* rows are divs (not buttons) so the inline quick-action button can
               sit inside without producing nested-button HTML. Clicking the row
               opens the incident; clicking the action button advances it. */
            '<div class="ug-row" role="button" tabindex="0" style="width:100%;text-align:left;cursor:pointer"' + A('open-incident', attr({ id: i.id })) + '><span class="r-dot" style="background:' + (U.SEV[i.sev] || U.SEV.advisory).color + '"></span>' +
              '<div class="r-main"><div class="r-t">' + esc(i.hazard) + '<span class="ug-badge ug-badge--id">' + esc(i.id) + '</span></div>' +
                '<div class="r-m"><span>' + I('pin', 12) + esc(i.area) + ', ' + esc(i.brgy) + '</span></div>' +
                '<div class="r-m"><span>' + I('clock', 12) + esc(i.time) + '</span><span>' + I('shield', 12) + esc(UG_UTIL.corroborationLabel(i.corr)) + '</span></div>' +
                dispatchLine(i) + '</div>' +
              '<div class="ug-col" style="gap:6px;align-items:flex-end">' + U.stageBadge(i.status) + quickAction(i) + '</div></div>').join('') :
            '<div class="ug-empty"><span class="e-ico">' + I('inbox', 20) + '</span>' +
              '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No recent incidents</div>' +
              '<div style="font-size:11px">New reports will appear here automatically.</div></div>') + '</div></div>' +
      '</div>' +
      '<div class="ug-dgrid3">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Incidents by Hazard Type</h3><span class="ug-dimmer ug-mono" style="font-size:11px">' + (U.DATA.counts ? U.DATA.counts.incidents : 0) + ' ON RECORD</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:9px">' +
            (function () {
              const rows = hazardRows(5);
              if (!rows.length) return '<div class="ug-dim" style="font-size:12px">No reports in the last 30 days.</div>';
              const max = Math.max(rows[0][1], 4);
              return rows.map(x => '<div class="ug-col" style="gap:5px"><div class="ug-rowf ug-between" style="font-size:12px">' +
                '<span>' + esc(x[0]) + '</span><span class="ug-mono">' + x[1] + '</span></div>' +
                '<div style="height:6px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden">' +
                '<div style="height:100%;width:' + Math.round(x[1] / max * 100) + '%;background:' + x[2] + '"></div></div></div>').join('');
            })() +
          '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Active Advisories</h3><span class="ug-chip is-on" style="font-size:11px">' + U.DATA.advisories.slice(0, 2).filter(a => a.severity !== 'prepared').length + ' live</span></div>' +
          '<div class="ug-rows">' + U.DATA.advisories.slice(0, 2).map(a =>
            '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-advisory', attr({ id: a.id })) + '><span class="r-dot" style="background:' + U.SEV[a.severity].color + '"></span>' +
              '<div class="r-main"><div class="r-t" style="font-size:13px">' + esc(a.title) + '</div>' +
              '<div class="r-m"><span>' + I('pin', 12) + esc(a.area) + '</span><span>' + esc(a.time) + '</span></div></div>' +
              U.sevBadge(a.severity) + '</button>').join('') + '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Readiness</h3></div><div class="ug-card-b ug-col" style="gap:11px">' +
          [['Shelters open', (U.DATA.counts ? U.DATA.counts.openCenters : U.DATA.centers.filter(c => c.status === 'open').length) + ' of ' + U.DATA.centers.length, 'prepared', 'centers'],
           ['Units assigned', (U.DATA.counts ? U.DATA.counts.units : 0) + ' deployed', 'verified', 'dispatch-units'],
           ['Corroboration rate', ((U.DATA.analytics && U.DATA.analytics.corroborationRate) || 0) + '%', 'prepared', 'analytics']]
            .map(x => '<button class="ug-rowf ug-between" style="gap:10px;font-size:12px;background:transparent;border:0;cursor:pointer;color:inherit;padding:4px 0;width:100%;text-align:left" data-act="nav" data-route="' + esc(x[3]) + '"><span class="ug-dim">' + x[0] + '</span>' +
              '<span class="ug-mono" style="color:var(--ug-' + x[2] + ')">' + x[1] + '</span></button>').join('') +
        '</div></div>' +
      '</div>' +
      /* staff quick-access: tiles for the new modules so the LGU dashboard
         surfaces them at a glance. Each tile is a button that routes the user
         to the full management surface. */
      '<div class="ug-dgrid4">' +
        [['relief', 'relief', 'Relief Distributions', (U.DATA.relief || []).length + ' active'],
         ['roadwork', 'road2', 'Road Work Posts', (U.DATA.roadWork || []).filter((r) => r.status === 'active').length + ' active'],
         ['guides', 'guide', 'Preparedness Guides', (U.DATA.guides || []).length + ' published'],
         ['faqs', 'faq', 'FAQ Entries', (U.DATA.faqs || []).length + ' published']]
          .map((x) => '<button class="ug-card" style="text-align:left;cursor:pointer"' + A('nav', attr({ route: x[0] })) + '>' +
            '<div class="ug-card-b ug-col" style="gap:8px">' +
              '<span class="ug-ico-btn" style="background:rgba(52,214,240,.12);color:var(--ug-signal);border:0;cursor:pointer;padding:8px;width:32px;height:32px">' + I(x[1], 16) + '</span>' +
              '<div><div style="font-size:13px;font-weight:700">' + esc(x[2]) + '</div>' +
              '<div class="ug-dimmer" style="font-size:11px">' + esc(x[3]) + '</div></div>' +
            '</div></button>').join('') +
      '</div>' +
    '</div>';
  }

  /* Hazard glyphs for the queue (Nov 2026): one clear outline symbol per
     hazard type, drawn on a 24px grid with round caps like the rest of the
     icon set, so each row reads at a glance (house in water for a flood,
     a tornado for strong wind, a tilted tree for a fallen tree, ...). */
  const HAZ_GLYPH = {
    flood: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v4M17.5 10v4"/><path d="M2 17.5c1.7 0 2.4-1 4-1s2.3 1 4 1 2.4-1 4-1 2.3 1 4 1 2.4-1 4-1"/><path d="M2 21c1.7 0 2.4-1 4-1s2.3 1 4 1 2.4-1 4-1 2.3 1 4 1 2.4-1 4-1"/>',
    river_overflow: '<path d="M2 13c1.7 0 2.4-1 4-1s2.3 1 4 1 2.4-1 4-1 2.3 1 4 1 2.4-1 4-1"/><path d="M2 17c1.7 0 2.4-1 4-1s2.3 1 4 1 2.4-1 4-1 2.3 1 4 1 2.4-1 4-1"/><path d="M2 21c1.7 0 2.4-1 4-1s2.3 1 4 1 2.4-1 4-1 2.3 1 4 1 2.4-1 4-1"/><path d="M12 9V3M9 6l3-3 3 3"/>',
    drainage_blockage: '<circle cx="12" cy="12" r="8.5"/><path d="M8 8.5v7M12 7v10M16 8.5v7"/><path d="M5.5 5.5l13 13"/>',
    storm_surge: '<path d="M3 13.5c0-4.7 3.6-8.5 8.5-8.5 2.6 0 4.8 1.1 6 3-2.4-.7-4.5.6-4.5 2.6 0 1.4 1.1 2.4 2.5 2.4"/><path d="M2 17.5c1.7 0 2.4-1 4-1s2.3 1 4 1 2.4-1 4-1 2.3 1 4 1 2.4-1 4-1"/><path d="M2 21c1.7 0 2.4-1 4-1s2.3 1 4 1 2.4-1 4-1 2.3 1 4 1 2.4-1 4-1"/>',
    coastal_erosion: '<path d="M3 4h5l2 3.5 2-1 2 4 2.5.5V14"/><path d="M3 4v10"/><path d="M2 18c1.7 0 2.4-1 4-1s2.3 1 4 1 2.4-1 4-1 2.3 1 4 1 2.4-1 4-1"/><path d="M14 21.5c1.4 0 2.1-.8 3.4-.8s2 .8 3.4.8"/>',
    strong_wind: '<path d="M21 4H3"/><path d="M18 8H6"/><path d="M19 12H9"/><path d="M16 16h-6"/><path d="M11 20H9"/>',
    fallen_tree: '<path d="M2 21h20"/><path d="M4.5 21v-3.5H7V21"/><path d="M7 18.8l6.6-3.2"/><circle cx="17" cy="13" r="4.2"/><path d="M15.2 14.6l2.8-2.8"/>',
    landslide: '<path d="M2 20h20"/><path d="M3 20 10 8l3 4.5"/><path d="M13 12.5 15.5 9 21 20"/><circle cx="17" cy="5" r="1.4"/><circle cx="19.5" cy="9" r="1"/><circle cx="7" cy="16.5" r=".8"/>',
    earthquake: '<path d="M2 12h3l2-5 3 10 3-8 2 5 2-2h5"/><path d="M8 21l2-2.5 2 1.5 2-2.5 2 3.5"/>',
    road_damage: '<path d="M8 3 4 21M16 3l4 18"/><path d="M12 4v2.5M12 9.5l-1.5 2.5 2.5 1.5-1.5 3 1 2"/>',
    vehicular_accident: '<path d="M3 16v-3.5L5 8h8l2 4.5V16"/><path d="M3 16h12"/><circle cx="6" cy="16.8" r="1.5"/><circle cx="12" cy="16.8" r="1.5"/><path d="M18.5 4.5v3M21.5 6l-2 1.5M21.8 10h-2.6M15.5 4.5l1.3 2.6"/>',
    fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>',
    power_line: '<path d="M7 21V3M7 6H3M7 6h5M4.5 9H7M7 9h2.5"/><path d="M16.5 7 13 13h4l-3 6"/>',
    other: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a3 3 0 0 1 5.6 1c0 2-3 2.8-3 2.8"/><path d="M12 17h.01"/>'
  };
  function hazGlyph(i, size) {
    const k = UG_HAZARDS.classify(i.hazard_type || i.hazard).key;
    const d = HAZ_GLYPH[k] || HAZ_GLYPH.other;
    return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* "Start from a template" (uniguard/src/components/TemplatePicker.tsx),
     in three plain steps: 1 what is it for (category tabs), 2 which
     message (template cards with a one-line preview), 3 fill the details,
     each blank with the right control: barangay / area / evacuation centre /
     wind signal / reason as dropdowns, the date as a date picker, the road
     and the place as typed text with suggestions. Live preview, then "Use
     this template" writes the title and message into the composer. */
  const TPL_FIELD = {
    barangay: { label: 'Barangay', kind: 'brgy' },
    area: { label: 'Area covered', kind: 'area' },
    center: { label: 'Evacuation center', kind: 'center' },
    signal: { label: 'Wind signal', kind: 'signal' },
    hazard: { label: 'Reason', kind: 'hazard' },
    road: { label: 'Road name', kind: 'road' },
    location: { label: 'Distribution point', kind: 'place' },
    date: { label: 'Date', kind: 'date' }
  };
  function tplValue(k, v) {
    if (k === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) {
      const d = new Date(v + 'T00:00:00');
      return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    return v;
  }
  function advTemplatePicker(st, d) {
    if (typeof UG_SETTINGS === 'undefined') return '';
    const t = st.tpl || {};
    const all = UG_SETTINGS.loadTemplates() || [];
    const CAT = UG_SETTINGS.CATEGORY || {};
    const cats = Object.keys(CAT).filter((c) => all.some((x) => x.category === c));
    const cat = (st.tplCat && cats.indexOf(st.tplCat) >= 0) ? st.tplCat : (cats[0] || 'general');
    const list = all.filter((x) => x.category === cat);
    const tpl = list.find((x) => x.id === st.tplId) || list[0] || null;
    const lang = t.lang || 'en';
    const own = (st.session && st.session.barangay) || '';
    const defaults = { barangay: own || (d.area && d.area !== UG_GEO.PLACE.areaAll ? d.area : ''), area: own || '' };
    const vals = Object.assign({}, defaults, t.vals || {});
    const keysOf = (x) => {
      const seen = {}; const out = [];
      [x.title_en, x.body_en, x.title_fil, x.body_fil].join(' ').replace(/\{(\w+)\}/g, (m, k) => { if (!seen[k]) { seen[k] = 1; out.push(k); } return m; });
      return out;
    };
    const keys = tpl ? keysOf(tpl) : [];
    const pick = (lng, x) => (lng === 'fil' && x.body_fil) ? x.body_fil : x.body_en;
    const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (String(cur || '') === String(v) ? ' selected' : '') + '>' + esc(label) + '</option>';
    const brgys = U.DATA.barangays || [];
    const centers = (U.DATA.centers || []).slice().sort((p, q) => (p.brgy === vals.barangay ? -1 : 0) - (q.brgy === vals.barangay ? -1 : 0) || String(p.name).localeCompare(q.name));
    const field = (k) => {
      const f = TPL_FIELD[k] || { label: k.charAt(0).toUpperCase() + k.slice(1), kind: 'text' };
      const cur = vals[k] || '';
      const miss = (t.missing || []).indexOf(k) >= 0 ? ' is-miss' : '';
      const sel = (inner, ph) => '<select class="tp-in tp-sel' + miss + '" data-field="tplv.' + esc(k) + '" aria-label="' + esc(f.label) + '">' + opt('', ph, cur) + inner + '</select>';
      let ctl;
      if (f.kind === 'brgy') ctl = sel(brgys.map((b) => opt(b, b, cur)).join(''), 'Choose a barangay');
      else if (f.kind === 'area') ctl = sel(opt('Lingayen', 'All of Lingayen (municipality-wide)', cur) + brgys.map((b) => opt('Barangay ' + b, 'Barangay ' + b, cur)).join(''), 'Choose the area');
      else if (f.kind === 'center') ctl = centers.length ? sel(centers.map((c) => opt(c.name, c.name + ' · ' + c.brgy + (c.status !== 'open' ? ' (' + c.status + ')' : ''), cur)).join(''), 'Choose an evacuation center')
        : '<input class="tp-in' + miss + '" data-field="tplv.center" value="' + esc(cur) + '" placeholder="Name of the evacuation center">';
      else if (f.kind === 'signal') ctl = sel([1, 2, 3, 4, 5].map((n) => opt(String(n), 'Signal No. ' + n, cur)).join(''), 'Choose the signal');
      else if (f.kind === 'hazard') ctl = sel(UG_HAZARDS.LIST.filter((h) => h.key !== 'other').map((h) => opt(h.label.toLowerCase(), h.label, cur)).concat([opt('road repairs', 'Road repairs', cur)]).join(''), 'Choose the reason');
      else if (f.kind === 'date') ctl = '<input type="date" class="tp-in' + miss + '" data-field="tplv.date" value="' + esc(cur) + '">';
      else if (f.kind === 'road') ctl = '<input class="tp-in' + miss + '" list="tp-roads" data-field="tplv.road" value="' + esc(cur) + '" placeholder="e.g. Lingayen–Labrador Road">' +
        '<datalist id="tp-roads">' + Array.from(new Set((U.DATA.roadStatus || []).map((r) => r.road_name).concat((U.DATA.roadWork || []).map((r) => r.road_name || r.location)).filter(Boolean))).map((r) => '<option value="' + esc(r) + '">').join('') + '</datalist>';
      else if (f.kind === 'place') ctl = '<input class="tp-in' + miss + '" list="tp-places" data-field="tplv.location" value="' + esc(cur) + '" placeholder="e.g. Barangay hall covered court">' +
        '<datalist id="tp-places">' + (U.DATA.centers || []).map((c) => '<option value="' + esc(c.name) + '">').join('') + '</datalist>';
      else ctl = '<input class="tp-in' + miss + '" data-field="tplv.' + esc(k) + '" value="' + esc(cur) + '" placeholder="{' + esc(k) + '}">';
      return '<label class="tp-f"><span>' + esc(f.label) + '</span>' + ctl + '</label>';
    };
    const shown = Object.keys(vals).reduce((o, k) => { if (String(vals[k] || '').trim()) o[k] = tplValue(k, vals[k]); return o; }, {});
    const filled = keys.filter((k) => String(vals[k] || '').trim()).length;
    return '<div class="tp' + (t.open ? ' is-open' : '') + '">' +
      '<button type="button" class="tp-h"' + A('adv-tpl-toggle') + ' aria-expanded="' + !!t.open + '">' +
        '<span>' + I('doc', 14) + 'Start from a template<em>Ready-made messages in English and Filipino</em></span>' + I('chevdn', 15) + '</button>' +
      (t.open ? '<div class="tp-b">' +
        (!all.length ? '<p class="tp-muted">No templates yet. The LDRRMO adds them in Settings.</p>' :
          /* step 1: what is it for */
          '<div class="tp-step"><b>1</b>What is the message for?</div>' +
          '<div class="tp-cats" role="tablist">' + cats.map((c) => '<button type="button" role="tab" aria-selected="' + (c === cat) + '" class="' + (c === cat ? 'is-on' : '') + '"' + A('adv-tpl-cat', attr({ v: c })) + '>' +
            I((CAT[c] || {}).icon || 'megaphone', 14) + esc((CAT[c] || {}).label || c) + '<em>' + all.filter((x) => x.category === c).length + '</em></button>').join('') + '</div>' +
          /* step 2: which message */
          '<div class="tp-step"><b>2</b>Pick a message</div>' +
          '<div class="tp-cards">' + list.map((x) => '<button type="button" class="tp-card' + (tpl && x.id === tpl.id ? ' is-on' : '') + '"' + A('adv-tpl-pick', attr({ id: x.id })) + ' aria-pressed="' + !!(tpl && x.id === tpl.id) + '">' +
            '<i aria-hidden="true"></i><span><b>' + esc(x.label || x.title_en) + '</b><small>' + esc(pick(lang, x)) + '</small></span></button>').join('') + '</div>' +
          /* step 3: details */
          '<div class="tp-step"><b>3</b>Fill in the details' + (keys.length ? '<em>' + filled + ' of ' + keys.length + ' done</em>' : '') +
            '<span class="tp-lang" role="radiogroup" aria-label="Message language">' +
              [['en', 'English'], ['fil', 'Filipino']].map((l) => '<button type="button" role="radio" aria-checked="' + (lang === l[0]) + '" class="' + (lang === l[0] ? 'is-on' : '') + '"' + A('adv-tpl-lang', attr({ v: l[0] })) + '>' + l[1] + '</button>').join('') +
            '</span></div>' +
          (keys.length ? '<div class="tp-keys">' + keys.map(field).join('') + '</div>' : '<p class="tp-muted">This message has nothing to fill in.</p>') +
          (tpl ? '<div class="tp-prev"><span>Preview</span><b>' + esc(UG_SETTINGS.fillTemplate((lang === 'fil' && tpl.title_fil) ? tpl.title_fil : tpl.title_en, shown)) + '</b>' +
            '<p>' + esc(UG_SETTINGS.fillTemplate(pick(lang, tpl), shown)) + '</p></div>' : '') +
          ((t.missing && t.missing.length) ? '<p class="tp-miss" role="alert">' + I('alert', 13) + 'Fill in ' + esc(t.missing.map((k) => (TPL_FIELD[k] || { label: k }).label.toLowerCase()).join(', ')) + ' first.</p>' : '') +
          '<div class="tp-foot"><button type="button" class="tp-go"' + A('adv-tpl-apply', attr({ id: tpl ? tpl.id : '' })) + '>' + I('check', 14) + 'Use this template</button>' +
            '<span>You can still edit the title and message before publishing.</span></div>') +
      '</div>' : '') +
    '</div>';
  }

  /* Resident Feed (uniguard/src/components/AdvisoryCenter.tsx, resident
     view): filter pills with counts, then a grid of cards (tag, date,
     title, three lines of the message, area and category). A card opens a
     quick view with Share. Uses the published advisories already loaded. */
  const ADV_TAG = { emergency: 'Emergency', warning: 'Warning', advisory: 'Advisory', prepared: 'Preparedness' };
  function advTag(a) { return a.kind === 'preparedness' ? 'Preparedness' : (ADV_TAG[a.severity] || 'Advisory'); }
  function advCategory(a) {
    const c = (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.CATEGORY[a.alert_type]) || null;
    return c ? c.label : 'General Notice';
  }
  function advDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function advResidentFeed(st) {
    const all = (U.DATA.advisories || []).slice().sort((p, q) => Date.parse(q.created_at || 0) - Date.parse(p.created_at || 0));
    const f = st.advFeedFilter || 'All';
    const counts = { All: all.length };
    ['Emergency', 'Warning', 'Advisory', 'Preparedness'].forEach((k) => { counts[k] = all.filter((a) => advTag(a) === k).length; });
    const list = f === 'All' ? all : all.filter((a) => advTag(a) === f);
    return '<div class="af">' +
      '<div class="af-pills" role="tablist" aria-label="Filter advisories">' + ['All', 'Emergency', 'Warning', 'Advisory', 'Preparedness'].map((k) =>
        '<button role="tab" aria-selected="' + (f === k) + '" class="' + (f === k ? 'is-on' : '') + '"' + A('adv-feed-filter', attr({ v: k })) + '>' + k + '<b>' + counts[k] + '</b></button>').join('') + '</div>' +
      (list.length ? '<div class="af-grid">' + list.map((a) => {
        const tag = advTag(a);
        return '<article class="af-card" role="button" tabindex="0"' + A('adv-feed-open', attr({ id: a.id })) + '>' +
          '<div class="af-top"><span class="af-tag is-' + tag.toLowerCase() + '">' + tag + '</span><span class="af-date">' + esc(advDate(a.created_at)) + '</span></div>' +
          '<h3>' + esc(a.title) + '</h3>' +
          '<p>' + esc(a.body) + '</p>' +
          '<div class="af-foot"><span>' + I('pin', 13) + esc(a.area || UG_GEO.PLACE.areaAll) + '</span><span>' + I('flag', 13) + esc(advCategory(a)) + '</span></div>' +
        '</article>';
      }).join('') + '</div>'
      : '<div class="af-empty">' + I('megaphone', 28) + '<b>No advisories here right now</b><span>Try another filter, or check back later.</span></div>') +
    '</div>';
  }

  /* ---- incident queue (feature 5) ---- */
  function dIncidents(st){
    const f = st.sevFilter;
    const chips = [['all', 'All'], ['escalated', 'Escalated'], ['reported', UG_THEME.STATUS.reported.label], ['verified', UG_THEME.STATUS.verified.label],
      ['dispatched', UG_THEME.STATUS.dispatched.label], ['resolved', UG_THEME.STATUS.resolved.label], ['rejected', UG_THEME.STATUS.rejected.label]];
    /* Clarify what Escalated means, so it is not confused with the standard
       status pipeline. The chip carries a title attribute and a tiny help
       line below the chip row. */
    const escalatedHelp = '';   /* explained by the folded reminder above the toolbar */
    /* Priority Sort toggle: severity first, then corroboration count, then recency.
       Default stays newest-first. */
    const priority = st.incidentSort === 'priority';
    const SEV_RANK = { emergency: 0, warning: 1, advisory: 2, prepared: 3 };
    /* the new 'escalated' chip surfaces stale + life-safety-bypass reports so
       the LGU can see exactly what the escalation policy pushed into their queue. */
    const baseFilter = (i) => {
      if (f === 'all') return true;
      if (f === 'escalated') return i.escalates_to_lgu === true || i.is_stale === true || i.is_severity_bypass === true;
      return i.status === f;
    };
    /* LDRRMO barangay filter: narrows the whole queue (list, chip counts and the
       escalation banner) to one barangay. Barangay officials are already scoped
       to their own barangay server side, so the dropdown is LGU-only. */
    const isLGUq = !!(st.session && st.session.role === 'lgu_ldrrmc');
    const bf = (isLGUq && st.incBrgyFilter && st.incBrgyFilter !== 'All') ? st.incBrgyFilter : 'All';
    const inBrgy = bf === 'All' ? U.DATA.incidents : U.DATA.incidents.filter(x => x.brgy === bf);
    /* hazard type filter (every staff role): narrows the list and the chip
       counts like the barangay filter; matches by hazard key, so a stored
       label ("Fire") and a key ("fire") land in the same bucket */
    const hf = st.incHazardFilter && st.incHazardFilter !== 'All' ? st.incHazardFilter : 'All';
    const hazardKey = (x) => UG_HAZARDS.classify(x.hazard_type).key;
    const byHaz = hf === 'All' ? inBrgy : inBrgy.filter(x => hazardKey(x) === hf);
    /* free-text search over the code, hazard, barangay, place and description */
    const qs = String(st.incSearch || '').trim().toLowerCase();
    const allInc = !qs ? byHaz : byHaz.filter((x) => [x.id, x.hazard, x.brgy, x.area, x.desc].some((v) => String(v || '').toLowerCase().indexOf(qs) >= 0));
    const base = allInc.filter(baseFilter);
    /* escalated rows float to the top of every filter so the duty officer never
       misses a stale or life-safety report, even in the 'All' view. */
    const escalatedFirst = (a, b) => {
      const ae = a.escalates_to_lgu ? 1 : 0, be = b.escalates_to_lgu ? 1 : 0;
      if (ae !== be) return be - ae;
      return 0;
    };
    const list = priority
      ? base.slice().sort((a, b) =>
          escalatedFirst(a, b) ||
          (SEV_RANK[a.sev] != null ? SEV_RANK[a.sev] : 9) - (SEV_RANK[b.sev] != null ? SEV_RANK[b.sev] : 9) ||
          (b.corr || 0) - (a.corr || 0) ||
          (Date.parse(b.created_at || '') || 0) - (Date.parse(a.created_at || '') || 0))
      : base.slice().sort(escalatedFirst);
    /* escalation badge shown next to the status badge on each row */
    const escalationBadge = (i) => {
      if (i.is_severity_bypass && i.status === 'reported')
        return '<span class="ug-badge ug-badge--emergency" style="font-size:11px">Life-safety</span>';
      if (i.is_stale && i.status === 'reported')
        return '<span class="ug-badge ug-badge--warning" style="font-size:11px">Stale</span>';
      return '';
    };
    const action = (i) => {
      /* Super Admin has no verify permission. They can edit a record (which is
         itself logged) but they cannot move it through the verification step. */
      if (st.session && st.session.role === 'lgu_ldrrmc' && st.session.superAdmin) {
        return '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('edit-report', attr({ id: i.id })) + '>' + I('settings', 14) + 'Edit</button>';
      }
      if (i.status === 'reported') {
        /* One Verify button. For LDRRMO staff it runs the LGU verification
           (records the LDRRMO as verifier, keeps the note, notifies the
           reporter); showing it next to the generic Verify put two buttons
           that did the same thing on every row. Barangay officials keep the
           standard Verify. Super Admin gets neither (handled above). */
        if (st.session && st.session.role === 'lgu_ldrrmc') {
          return '<button class="ug-btn ug-btn--sm"' + A('lgu-verify', attr({ id: i.id })) + ' title="Verified by the LDRRMO; an optional note is kept in the activity log">' + I('shield', 14) + 'Verify</button>';
        }
        return '<button class="ug-btn ug-btn--sm"' + A('advance', attr({ id: i.id })) + '>Verify</button>';
      }
      if (i.status === 'verified') return '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('advance', attr({ id: i.id })) + '>Dispatch</button>';
      if (i.status === 'dispatched') {
        const municipalResponse = ((U.DATA.dispatches || {})[i.uuid] || []).some(
          (d) => d.unit_id && !['done', 'declined'].includes(d.dispatch_status));
        if (st.session && st.session.role === 'barangay_official' && municipalResponse) {
          return '<span class="ug-dimmer">MDRRMO coordinating</span>';
        }
        return '<button class="ug-btn ug-btn--sm"' + A('advance', attr({ id: i.id })) + '>Resolve</button>';
      }
      if (i.status === 'rejected') return '<span class="ug-dimmer" style="font-size:11px;display:flex;align-items:center;gap:5px">' + I('x', 13) + 'Rejected</span>';
      return '<span class="ug-dimmer" style="font-size:11px;display:flex;align-items:center;gap:5px">' + I('check', 13) + 'Closed</span>';
    };
    const escalatedCount = allInc.filter((i) => i.escalates_to_lgu).length;
    /* barangay dropdown (LGU only): option text shows how many reports each
       barangay has, so the officer can see where the load is before filtering. */
    const brgyCounts = {};
    U.DATA.incidents.forEach(x => { brgyCounts[x.brgy] = (brgyCounts[x.brgy] || 0) + 1; });
    const brgyFilterUi = isLGUq
      ? '<label class="inc-sel">' + I('pin', 14) +
          '<select data-field="incBrgyFilter" aria-label="Filter incidents by barangay">' +
            '<option value="All"' + (bf === 'All' ? ' selected' : '') + '>All barangays (' + U.DATA.incidents.length + ')</option>' +
            U.DATA.barangays.map(b => '<option value="' + esc(b) + '"' + (bf === b ? ' selected' : '') + '>' + esc(b) + ' (' + (brgyCounts[b] || 0) + ')</option>').join('') +
          '</select></label>' +
          (bf !== 'All' ? '<button class="inc-clear"' + A('inc-brgy-clear') + ' aria-label="Clear barangay filter">' + I('x', 12) + '</button>' : '')
      : '';
    const hazCounts = {};
    inBrgy.forEach(x => { const k = hazardKey(x); hazCounts[k] = (hazCounts[k] || 0) + 1; });
    const hazardFilterUi =
      '<label class="inc-sel">' + I('layers', 14) +
        '<select data-field="incHazardFilter" aria-label="Filter incidents by hazard type">' +
          '<option value="All"' + (hf === 'All' ? ' selected' : '') + '>All hazard types (' + inBrgy.length + ')</option>' +
          UG_HAZARDS.LIST.map(h => '<option value="' + esc(h.key) + '"' + (hf === h.key ? ' selected' : '') + '>' + esc(h.label) + ' (' + (hazCounts[h.key] || 0) + ')</option>').join('') +
        '</select></label>' +
        (hf !== 'All' ? '<button class="inc-clear"' + A('inc-hazard-clear') + ' aria-label="Clear hazard filter">' + I('x', 12) + '</button>' : '');
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.incidents'), 'Track every report through reported, verified, response dispatched and resolved.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm' + (priority ? ' is-active' : '') + '" style="' + (priority ? 'border-color:var(--ug-signal);color:var(--ug-signal)' : '') + '"' + A('sort-toggle') + '>' + I('sort', 15) + (priority ? 'Priority Sort: On' : 'Priority Sort') + '</button>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('nav', attr({ route: 'command' })) + '>' + I('grid', 15) + 'Command View</button>') +
      replacementQueue(st) +
      /* a faint, folded reminder: one slim line; "What does this mean?"
         opens the explanation (kept open across re-renders) */
      /* hidden once dismissed (×); comes back when more reports escalate */
      (escalatedCount > 0 && escalatedCount > (function () { try { return parseInt(localStorage.getItem('ug_esc_note_x') || '0', 10) || 0; } catch (e) { return 0; } })() ? '<details class="ug-esc-note" data-keep-open="inc-esc"' + ((window.UG_SC_OPEN || {})['inc-esc'] ? ' open' : '') + '>' +
        '<summary><span class="en-ico">' + I('alert', 13) + '</span>' +
          '<span class="en-t"><b>' + escalatedCount + '</b> report' + (escalatedCount === 1 ? '' : 's') + ' escalated to LGU</span>' +
          '<span class="en-acts"><span class="en-why">What does this mean?' + I('chevdn', 12) + '</span>' +
          (f !== 'escalated' ? '<button class="en-go"' + A('sev-filter', attr({ v: 'escalated' })) + ' title="Show only the escalated reports in the list below">View escalated reports</button>' : '') + '</span>' +
          '<button class="en-x"' + A('esc-note-x', attr({ n: escalatedCount })) + ' aria-label="Dismiss this reminder" title="Dismiss (shows again if more reports escalate)">' + I('x', 13) + '</button>' +
        '</summary>' +
        '<p><b>Escalated</b> means a report needs additional LGU intervention. It is not a severity and not a status like Reported, Verified, Response Dispatched or Resolved. A report is escalated when (a) it has stayed unverified for more than 30 minutes (stale), or (b) it is a life-safety hazard (fire, power line, accident, landslide) that skips the barangay queue and goes straight to the LGU.</p>' +
      '</details>' : '') +
      /* one toolbar: the status tabs (scroll sideways on small screens),
         then the hazard and barangay filters with the scope on the right */
      '<div class="inc-tool">' +
        /* phones: the status filter is a dropdown (the tabs below are hidden there) */
        (() => {
          const cnt = (v) => v === 'all' ? allInc.length : v === 'escalated' ? escalatedCount : allInc.filter(x => x.status === v).length;
          const cur = chips.find((c) => c[0] === f) || chips[0];
          return '<div class="ug-wmore inc-dd">' +
            '<button class="inc-dd-btn"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Filter by status">' +
              '<span>' + esc(cur[0] === 'all' ? 'All statuses' : cur[1]) + '</span><b>' + cnt(cur[0]) + '</b>' + I('chevdn', 16) + '</button>' +
            '<div class="inc-dd-panel" data-more-panel hidden role="listbox">' + chips.map((c) =>
              '<button role="option" class="' + (c[0] === f ? 'is-on' : '') + (c[0] === 'escalated' && cnt(c[0]) ? ' is-esc' : '') + '"' + A('sev-filter', attr({ v: c[0] })) + '>' +
                '<span>' + esc(c[0] === 'all' ? 'All statuses' : c[1]) + '</span><b>' + cnt(c[0]) + '</b>' + (c[0] === f ? I('check', 14) : '') + '</button>').join('') +
            '</div></div>';
        })() +
        '<div class="inc-tabs" role="tablist" aria-label="Filter by status">' + chips.map((c) => {
          const n = c[0] === 'all' ? allInc.length : c[0] === 'escalated' ? escalatedCount : allInc.filter(x => x.status === c[0]).length;
          return '<button role="tab" aria-selected="' + (f === c[0]) + '" class="' + (f === c[0] ? 'is-on' : '') + (c[0] === 'escalated' && n ? ' is-esc' : '') + (!n && f !== c[0] ? ' is-zero' : '') + '"' + A('sev-filter', attr({ v: c[0] })) +
            (c[0] === 'escalated' ? ' title="Reports needing extra LGU attention: unverified over 30 minutes, or a life-safety hazard"' : '') + '>' + esc(c[1]) + '<b>' + n + '</b></button>';
        }).join('') +
        '</div><div class="inc-filters">' +
          '<label class="inc-search">' + I('search', 14) + '<input data-field="rw.incSearch" value="' + esc(st.incSearch || '') + '" placeholder="Search code, hazard, barangay or description" aria-label="Search incidents">' +
            (qs ? '<button' + A('inc-search-clear') + ' aria-label="Clear search">' + I('x', 12) + '</button>' : '') + '</label>' +
          hazardFilterUi + brgyFilterUi +
        '</div>' +
        '<div class="inc-meta"><span>Showing <b>' + list.length + '</b> of ' + inBrgy.length + ' report' + (inBrgy.length === 1 ? '' : 's') +
          (priority ? ' · priority order' : ' · newest first, escalated on top') + '</span>' +
          ((f !== 'all' || hf !== 'All' || bf !== 'All' || qs) ? '<button' + A('inc-reset') + '>Reset filters</button>' : '') +
          '<span class="inc-scope">' + I('target', 13) + esc(bf !== 'All' ? 'Barangay ' + bf : (sess(st).scope || '')) + '</span></div>' +
      '</div>' +
      escalatedHelp +
      /* the queue table (Nov 2026, monochrome): neutral status pills, the
         hazard's own icon, a confirms pill, severity bars with a small word,
         the next step, and a chevron that opens three facts in place */
      '<div class="iq">' +
        '<div class="iq-head"><span>Status</span><span>Hazard / description</span><span>Barangay</span><span>Confirms</span><span>Age</span><span>Severity</span><span class="iq-r">Action</span></div>' +
        (list.length ? list.map((i) => {
          const open = st.incOpenRow === i.id;
          const hz = UG_HAZARDS.classify(i.hazard_type || i.hazard);
          const lvl = { emergency: 4, warning: 3, advisory: 2, prepared: 1 }[i.sev] || 2;
          const word = { emergency: 'Critical', warning: 'High', advisory: 'Moderate', prepared: 'Low' }[i.sev] || 'Moderate';
          const esc2 = (i.is_severity_bypass && i.status === 'reported') ? 'Life-safety' : (i.is_stale && i.status === 'reported') ? 'Stale' : '';
          const team = i.status === 'dispatched' ? (i.units ? i.units + ' unit' + (i.units === 1 ? '' : 's') + ' assigned' : 'Team dispatched')
            : i.status === 'verified' ? 'Pending team assignment' : i.status === 'resolved' ? 'Response closed' : i.status === 'rejected' ? 'Not dispatched' : 'Waiting for verification';
          const by = i.verified_by_name ? ((i.verified_by_role === 'lgu_ldrrmc' ? 'LGU' : 'Barangay') + '-verified by ' + i.verified_by_name) : (i.status === 'reported' ? 'Not yet verified' : '');
          return '<div class="iq-row' + (open ? ' is-open' : '') + (i.escalates_to_lgu ? ' is-esc' : '') + '">' +
            /* the whole row opens / closes its details (the buttons inside keep their own action) */
            '<div class="iq-main" role="button" tabindex="0" aria-expanded="' + open + '"' + A('inc-row', attr({ id: i.id })) + '>' +
              '<span class="iq-status"><span class="iq-pill is-' + esc(i.status) + '"><i></i>' + esc((UG_THEME.STATUS[i.expired ? 'expired' : i.status] || {}).label || i.status) + '</span>' + (esc2 ? '<span class="iq-flag" title="' + (esc2 === 'Stale' ? 'Unverified for more than 30 minutes' : 'Life-safety hazard sent straight to the LGU') + '">' + I(esc2 === 'Stale' ? 'clock' : 'alert', 11) + esc2 + '</span>' : '') + '</span>' +
              '<span class="iq-hz"><span class="iq-hz-ico" title="' + esc(hz.label || i.hazard) + '">' + hazGlyph(i, 18) + '</span><span class="iq-hz-t"><code>' + esc(i.id) + '</code><b>' + esc(i.hazard) + '</b>' +
                (i.desc ? '<small>' + esc(i.desc) + '</small>' : '') + '</span></span>' +
              '<span class="iq-brgy"><b>' + esc(i.brgy ? 'Brgy. ' + i.brgy : '—') + '</b><small>' + esc(i.area && i.area !== i.brgy ? i.area : 'Lingayen, Pangasinan') + '</small></span>' +
              '<span><span class="iq-conf' + (i.corr >= 3 ? ' is-met' : '') + '">' + (i.corr || 0) + '/3</span></span>' +
              '<span class="iq-age">' + esc(i.time) + '</span>' +
              '<span class="iq-sev' + (i.sev === 'emergency' ? ' is-crit' : '') + '"><span class="iq-bars">' + [1, 2, 3, 4].map((n) => '<i class="' + (n <= lvl ? 'on' : '') + '"></i>').join('') + '</span><small>' + word + '</small></span>' +
              '<span class="iq-act">' + action(i) +
                '<button class="iq-tog"' + A('inc-row', attr({ id: i.id })) + ' aria-expanded="' + open + '" aria-label="' + (open ? 'Hide' : 'Show') + ' details for ' + esc(i.id) + '">' + I('chevdn', 15) + '</button></span>' +
            '</div>' +
            (open ? '<div class="iq-more">' +
              '<div class="iq-facts">' +
                '<div><span>Reporter &amp; location</span><b>' + esc(i.id) + '</b><small class="iq-mono">' + (i.lat != null ? 'Coordinates: ' + esc(UG_GEO.fmt(i.lat, i.lng)) : 'No map pin on this report') + '</small></div>' +
                '<div><span>Corroboration</span><b>' + (i.corr || 0) + ' of 3 required confirmations</b><small>' + (i.is_sos ? 'SOS follows the response status' : i.corr >= 3 ? 'Corroboration threshold reached' : i.status === 'reported' ? 'Awaiting more independent confirmations' : 'Report already reviewed') + '</small></div>' +
                '<div><span>Dispatch / team</span><b>' + esc(team) + '</b><small>' + esc(by || ' ') + '</small></div>' +
              '</div>' +
              '<div class="iq-more-f"><button class="iq-link"' + A('open-incident', attr({ id: i.id })) + '>' + I('pin', 14) + 'Open full record &amp; map</button>' +
                '<span>Ticket code: <code>' + esc(i.id) + '</code></span></div>' +
            '</div>' : '') +
          '</div>';
        }).join('') : '<div class="ug-empty"><span class="e-ico">' + I('inbox', 20) + '</span>' +
          '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No incidents match</div>' +
          '<div style="font-size:11px">' + (bf !== 'All' ? 'No matching reports in ' + esc(bf) + '. Change the filters or choose another barangay.' : 'Change the filters or the search to see other reports.') + '</div></div>') +
      '</div>' +
    '</div>';
  }

  /* ---- incident detail (feature 4 + 5) ---- */
  function dIncident(st){
    const i = st.openId ? Repo.findReport(st.openId) : U.DATA.incidents[0];
    if (!i) return '<div class="ug-empty"><p>This incident is unavailable.</p><button class="ug-btn"' +
      A('nav', attr({ route: 'incidents' })) + '>Back to incidents</button></div>';
    const corr = st.corr[i.id] != null ? st.corr[i.id] : i.corr;
    const status = (corr >= 3 && i.status === 'reported') ? 'verified' : i.status;
    /* escalation badges for the detail header */
    const escBadges = (i.is_severity_bypass && i.status === 'reported'
        ? '<span class="ug-badge ug-badge--emergency" style="font-size:11px">Life-safety bypass</span>' : '') +
      (i.is_stale && i.status === 'reported'
        ? '<span class="ug-badge ug-badge--warning" style="font-size:11px">Stale: not yet verified by barangay</span>' : '');
    /* who verified this report, if anyone has */
    const verifiedByLine = (status === 'verified' || status === 'dispatched' || status === 'resolved')
      ? (i.verified_by_role === 'lgu_ldrrmc'
          ? '<div class="ug-rowf ug-gap6" style="gap:6px;align-items:center;font-size:11px;color:var(--ug-signal)">' + I('shield', 13) + 'LGU-verified by ' + esc(i.verified_by_name || 'LDRRMO') + (i.verified_at ? ' · ' + esc(UG_UTIL.absTime(i.verified_at)) : '') + '</div>'
          : i.verified_by_role === 'barangay_official'
            ? '<div class="ug-rowf ug-gap6" style="gap:6px;align-items:center;font-size:11px;color:var(--ug-prepared)">' + I('check', 13) + 'Verified by ' + esc(i.verified_by_name || 'barangay official') + (i.verified_at ? ' · ' + esc(UG_UTIL.absTime(i.verified_at)) : '') + '</div>'
            : '')
      : '';
    const isLGU = st.session && st.session.role === 'lgu_ldrrmc';
    const isBarangay = st.session && st.session.role === 'barangay_official';
    const request = (U.DATA.municipalDispatchRequests || []).find((row) => row.report_id === i.uuid);
    const canRequest = isBarangay && ['verified', 'dispatched'].includes(status) && !request;
    const localTeamAssigned = ((U.DATA.dispatches || {})[i.uuid] || []).some(
      (row) => row.team === 'Barangay Response Team' && !['done', 'declined'].includes(row.dispatch_status));
    const municipalTeamAssigned = ((U.DATA.dispatches || {})[i.uuid] || []).some(
      (row) => row.unit_id && !['done', 'declined'].includes(row.dispatch_status));
    return '<div class="ug-col" style="gap:14px">' +
      '<div class="ug-rowf ug-between ug-wrap" style="gap:12px;align-items:flex-start">' +
        '<div class="ug-rowf ug-gap12" style="gap:12px;align-items:flex-start">' +
          '<button class="ug-btn ug-btn--ghost ug-btn--icon" aria-label="Back"' + A('nav', attr({ route: 'incidents' })) + '>' +
            '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 16) + '</span></button>' +
          '<div><div class="ug-rowf ug-gap8" style="gap:8px">' + U.sevBadge(i.sev) + U.stageBadge(status) +
            '<span class="ug-badge ug-badge--id">' + esc(i.id) + '</span>' + escBadges + '</div>' +
          '<h2 style="font-size:20px;margin-top:8px">' + esc(i.hazard) + '</h2>' +
          '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(i.area) + ', ' + esc(i.brgy) + ' &middot; reported ' + esc(i.time) + '</p>' +
          verifiedByLine + '</div>' +
        '</div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<button class="ug-btn ug-btn--sm"' + A('edit-report', attr({ id: i.id })) + '>' + I('settings', 15) + 'Edit</button>' +
          /* Module G: one-document summary of this incident (PDF or Excel) */
          (typeof UG_REPORTING !== 'undefined' ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('rp-open-incident', attr({ id: i.id })) + '>' + I('doc', 15) + 'Incident Summary</button>' : '') +
          /* "Assign Units" removed — Dispatch Response (and "Add Team" once
             dispatched) already covers assigning a response unit, so the
             separate Assign Units button was redundant clutter. */
          (isSuperAdminSession(st) ? '' :
            (status !== 'resolved' && status !== 'rejected' ? (
              /* LDRRMO staff verify through the LGU verification (one button,
                 not "Advance Status" plus a second "LGU-Verify") */
              isLGU && status === 'reported'
                ? '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('lgu-verify', attr({ id: i.id })) + ' title="Verified by the LDRRMO; an optional note is kept in the activity log">' + I('shield', 15) + 'Verify Report</button>'
                : (isBarangay && municipalTeamAssigned ? '' : '<button class="ug-btn ug-btn--sm ug-btn--signal"' +
                  A('advance', attr({ id: i.id })) + '>' + I('check', 15) + (status === 'verified' ?
                    (isBarangay ? 'Send Barangay Response Team' : 'Dispatch Response') : 'Advance Status') + '</button>')) +
          /* verified but not sent (auto-verified by residents, or no unit was
             free): one tap sends the hazard's teams (migration 057) */
          (isLGU && status === 'verified' && UG_HAZARDS.suggestedTeams(i.hazard_type || i.hazard).length
            ? '<button class="ug-btn ug-btn--sm"' + A('auto-dispatch', attr({ id: i.uuid || i.id })) + '>' + I('truck', 15) + 'Auto-dispatch</button>' : '') +
          (isLGU && ['verified', 'dispatched'].includes(status) ? '<button class="ug-btn ug-btn--sm"' +
            A('incident-notify-hospital', attr({ id: i.uuid || i.id })) + '>' + I('truck', 15) + 'Notify hospital</button>' : '') +
          (status === 'dispatched' && (isLGU || (isBarangay && !localTeamAssigned)) ?
            '<button class="ug-btn ug-btn--sm"' + A('incident-add-team', attr({ id: i.id })) + '>' +
            I('truck', 15) + (isBarangay ? 'Send Barangay Response Team' : 'Add supporting team') + '</button>' : '') +
          (canRequest ? '<button class="ug-btn ug-btn--sm"' + A('request-municipal-dispatch', attr({ id: i.uuid })) +
            '>' + I('truck', 15) + 'Request municipal dispatch</button>' : '') +

          ((!isBarangay || !municipalTeamAssigned) ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' +
            A('reject', attr({ id: i.id })) + '>' + I('x', 15) + 'Reject</button>' : '') : '')
          ) +
        '</div>' +
      '</div>' +
      '<div class="ug-dgrid-detail">' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Field Evidence</h3><span class="ug-dimmer ug-mono" style="font-size:11px">' + esc(i.id) + '_ev.jpg</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' + (i.thumb ? U.photo(i, 'bn-img', 'height:110px') : '') +
              '<p class="ug-dim ug-clamp3" style="font-size:13px;line-height:1.6">' + esc(i.desc) + '</p>' +
              '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;font-size:11px;color:var(--ug-ink-3)">' +
                '<span class="ug-rowf" style="gap:5px">' + I('camera', 13) + 'Photo attached</span>' +
                '<span class="ug-rowf" style="gap:5px">' + I('pin', 13) + (
                  (typeof i.lat === 'number' && typeof i.lng === 'number')
                    ? esc(UG_GEO.fmt(i.lat, i.lng)) + (i.accuracy ? ' (' + esc(i.accuracy) + ' m)' : '')
                    : 'No coordinates recorded') + '</span>' +
                '<span class="ug-rowf" style="gap:5px">' + I('clock', 13) + 'Today, ' + esc(i.time) + '</span></div>' +
            '</div></div>' +
          /* while a team is responding the map tracks it: its car, the road it
             drove and the road ahead (js/map.js drawTracks) */
          (((U.DATA.dispatches || {})[i.uuid] || []).some((d) => !['done', 'declined'].includes(d.dispatch_status))
            ? '<div class="ug-card"><div class="ug-card-h"><h3>Location &amp; response</h3></div><div class="ug-card-b" style="padding:0">' +
                '<div class="ug-map" data-map="detail" data-response-report="' + esc(i.uuid) + '" style="height:300px;border:0;border-radius:0">' + U.mapSVG({}) + '</div>' +
                '<p class="sos-mapkey" style="padding:10px 14px;margin:0"><span><i class="is-done"></i>Road driven</span><span><i class="is-ahead"></i>Road ahead</span></p>' +
                (i.location_note ? '<p class="inc-locnote">' + I('pin', 13) + '<span>' + esc(i.location_note) + '</span></p>' : '') + '</div></div>'
            : '<div class="ug-card"><div class="ug-card-h"><h3>Location</h3></div><div class="ug-card-b" style="padding:0">' +
                '<div class="ug-map" data-map="detail" style="height:142px;border:0;border-radius:0">' + U.mapSVG({}) + '</div>' +
                (i.location_note ? '<p class="inc-locnote">' + I('pin', 13) + '<span>' + esc(i.location_note) + '</span></p>' : '') + '</div></div>') +
          historyCard(i, st, false, 'Activity Log') +
        '</div>' +
        '<div class="ug-col" style="gap:18px">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Status Pipeline</h3></div><div class="ug-card-b">' + U.pipeline(status) + '</div></div>' +
          (request ? '<div class="ug-note"><b>Municipal dispatch ' +
            (request.assigned_dispatch_id ? 'assigned' : 'requested') + '</b><p>' + esc(request.details) + '</p></div>' : '') +
          dispatchRecords(i) +
          ratingCard(i, false) +
          (i.is_sos ? '' : '<div class="ug-card"><div class="ug-card-h"><h3>Crowd Corroboration</h3>' +
            U.badge(corr >= 3 ? 'resolved' : 'warning', corr + ' of 3') + '</div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' + U.corrMeter(corr, i.status) +
            (!i.mine && !['resolved', 'rejected'].includes(i.status) && !st.corrDone?.[i.uuid || i.id]
              ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('confirm-corr', attr({ id: i.uuid || i.id })) +
                (st.corrBusy ? ' disabled' : '') + '>' + I('plus', 14) + 'Log Corroboration</button>' : '') + '</div></div>') +
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
    const areas = st.session?.role === 'barangay_official'
      ? [st.session.barangay || 'Barangay assignment needed'] : [UG_GEO.PLACE.areaAll, ...U.DATA.barangays];
    /* Module F: the broadcast type now carries the four real LDRRMO alert
       categories (weather advisory, evacuation order, road closure, plus a
       general catch-all) alongside the Emergency / Preparedness severity
       ladder. The color of the alert-type chip comes from UG_SETTINGS.CATEGORY
       so it matches the message-template categories one-to-one. */
    const ALERT_TYPES = [
      ['general', 'General Notice', 'megaphone'],
      ['weather_advisory', 'Weather Advisory', 'wind'],
      ['evacuation_order', 'Evacuation Order', 'shelter'],
      ['road_closure', 'Road Closure', 'road']
    ];
    const alertTypeChip = (key, label, icon) => {
      const cat = (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.CATEGORY[key]) || { color: 'var(--ug-signal)' };
      return '<button class="ug-chip' + (d.alertType === key ? ' is-on' : '') + '"' + A('adv-alert-type', attr({ v: key })) +
        ' style="' + (d.alertType === key ? 'background:' + cat.color + '22;border-color:' + cat.color + ';color:' + cat.color : '') + '">' + I(icon, 13) + label + '</button>';
    };
    /* the alert level ladder mirrors the severity ladder: Emergency (red),
       Warning (orange), Advisory (yellow), Preparedness (blue). Each cell is a
       colored chip so the duty officer can see the level at a glance. */
    const levelChip = (key, label) => {
      const sev = U.SEV[key] || UG_THEME.PREPARED;
      /* U.SEV has no soft/text shades (this wrote background:undefined): read
         them from the theme, and the text through the light/dark-aware variable */
      const th = UG_THEME.SEVERITY[key] || UG_THEME.PREPARED;
      const txt = 'var(--ug-' + (UG_THEME.SEVERITY[key] ? 'sev-' + key : 'prepared') + '-text, ' + th.text + ')';
      return '<button class="ug-chip ug-ladder-chip' + (d.sev === key ? ' is-on' : '') + '"' + A('adv-sev', attr({ v: key })) +
        ' style="' + (d.sev === key ? 'background:' + th.soft + ';border-color:' + th.color + ';color:' + txt : '') + '">' +
        '<span class="ug-ladder-dot" style="background:' + sev.color + '"></span>' + label + '</button>';
    };
    /* Broadcast Console | Resident Feed (uniguard AdvisoryCenter): the feed
       shows the published advisories the way residents see them */
    const feed = st.advView === 'resident';
    const viewToggle = '<div class="adv-view" role="tablist" aria-label="Advisories view">' +
      [['broadcast', 'Broadcast Console'], ['resident', 'Resident Feed']].map((v) =>
        '<button role="tab" aria-selected="' + ((feed ? 'resident' : 'broadcast') === v[0]) + '" class="' + ((feed ? 'resident' : 'broadcast') === v[0] ? 'is-on' : '') + '"' + A('adv-view', attr({ v: v[0] })) + '>' + v[1] + '</button>').join('') + '</div>';
    if (feed) {
      return '<div class="ug-col" style="gap:18px">' +
        pageHead(T('title.advisories'), 'Official broadcasts from the Lingayen Local Disaster Risk Reduction and Management Office (LDRRMO), as residents see them.', viewToggle) +
        advResidentFeed(st) + '</div>';
    }
    const advStep = Math.max(1, Math.min(3, Number(st.advStep) || 1));
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.advisories'), 'Publish official broadcasts and preparedness content to residents. Pick an alert type, set the alert level, apply a template, then publish.',
        viewToggle + '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('nav', attr({ route: 'analytics' })) + '>' + I('eye', 15) + T('dashboard.analytics') + '</button>') +
      '<div class="ug-dgrid-compose">' +
        '<div class="ug-card ug-tick adv-steps is-step-' + advStep + '"><div class="ug-card-h"><h3>' + T('advisories.compose') + '</h3>' +
          '<span class="ug-chip">' + I(st.offline ? 'wifioff' : 'bell', 13) + (st.offline ? T('state.offline') : (UG_CONFIG.VAPID_PUBLIC_KEY ? T('advisories.delivery.push') : T('advisories.delivery.inApp'))) + '</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:0">' +
            /* phones: a 3-step form (Type → Message → Send); desktop shows every field */
            '<ol class="adv-stepper" aria-label="Steps">' + [['1', 'Type'], ['2', 'Message'], ['3', 'Send']].map((x) =>
              '<li class="' + (Number(x[0]) === advStep ? 'is-on' : Number(x[0]) < advStep ? 'is-done' : '') + '">' +
                '<button' + A('adv-step', attr({ v: x[0] })) + '><i>' + (Number(x[0]) < advStep ? I('check', 12) : x[0]) + '</i><span>' + x[1] + '</span></button></li>').join('') + '</ol>' +
            '<div class="adv-sg" data-sg="1"><p class="adv-sg-t">Choose the kind of alert and how serious it is.</p>' +
            advTemplatePicker(st, d) +
            /* alert type selector — the four LDRRMO categories. Picks the
               matching template category so the "Use template" button offers
               the right shortlist. */
            '<div class="ug-field"><label class="ug-lab">' + esc(T('advisories.alertType')) + '</label>' +
              '<div class="ug-rowf ug-gap6 ug-wrap" style="gap:6px">' + ALERT_TYPES.map((t) => alertTypeChip(t[0], t[1], t[2])).join('') + '</div>' +
              '<div class="ug-help">' + esc(T('advisories.alertTypeHint')) + '</div></div>' +
            /* alert level ladder — color-coded severity. Emergency always
               triggers push immediately; Preparedness respects quiet hours. */
            '<div class="ug-field"><label class="ug-lab">' + esc(T('advisories.alertLevel')) + '</label>' +
              '<div class="ug-rowf ug-gap6 ug-wrap" style="gap:6px">' +
                levelChip('emergency', T('advisories.level.emergency')) +
                levelChip('warning', T('advisories.level.warning')) +
                levelChip('advisory', T('advisories.level.advisory')) +
                levelChip('prepared', T('advisories.level.prepared')) +
              '</div></div>' +
            '</div><div class="adv-sg" data-sg="2"><p class="adv-sg-t">Write what residents need to know.</p>' +
            '<div class="ug-field"><label class="ug-lab">' + esc(T('advisories.advisoryTitle')) + '</label>' +
              '<input class="ug-in" data-field="advTitle" value="' + esc(d.title) + '" placeholder="e.g. Flood warning: Pangapisan North"></div>' +
            '<div class="ug-rowf ug-gap12" style="gap:12px">' +
              '<div class="ug-field" style="flex:1"><label class="ug-lab">' + esc(T('advisories.broadcastType')) + '</label>' +
                '<select class="ug-sel" data-field="advType" aria-label="' + esc(T('advisories.broadcastType')) + '">' +
                ['Emergency', 'Preparedness'].map(s => '<option' + (d.type === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
              '<div class="ug-field" style="flex:1"><label class="ug-lab">' + esc(T('advisories.affectedArea')) + '</label>' +
                '<select class="ug-sel" data-field="advArea" aria-label="' + esc(T('advisories.affectedArea')) + '"' + (areas.length === 1 ? ' disabled' : '') + '>' +
                areas
                  .map(s => '<option' + (d.area === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></div>' +
            '</div>' +
            /* language toggle + template picker row. The language decides which
               half of the template is loaded; English and Filipino are the only
               two (Pangasinense was removed per build spec). */
            '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px;margin-bottom:8px">' +
              '<span class="ug-dimmer" style="font-size:11px;align-self:center">' + esc(T('label.language')) + '</span>' +
              [['en',T('settings.english')],['fil',T('settings.filipino')]].map((l) =>
                '<button class="ug-chip' + (d.lang === l[0] ? ' is-on' : '') + '"' + A('adv-lang', attr({ v: l[0] })) + '>' + l[1] + '</button>').join('') +

            '</div>' +
            '<div class="ug-field"><label class="ug-lab">' + esc(T('advisories.message')) + '</label>' +
              '<textarea class="ug-ta" rows="4" data-field="advMsg" placeholder="' + esc(T('advisories.messageHint')) + '">' + esc(d.msg) + '</textarea>' +
              '<div class="ug-help">' + esc(T('advisories.messageHint')) + '</div></div>' +
            /* Delivery preference: Push (emergency) vs In-app only (informational).
               The DOCX asks for a choice — not every advisory is an emergency. */
            '</div><div class="adv-sg" data-sg="3"><p class="adv-sg-t">Check how it looks, choose how it is delivered, then publish.</p>' +
            '<div class="adv-mprev">' + U.brandMark(24) + '<div><div class="adv-mprev-h"><b>UniGuard</b><span>now</span></div>' +
              '<strong>' + esc(d.title || 'Advisory title appears here') + '</strong>' +
              '<p>' + esc(d.msg || 'Your message appears here as residents will see it.') + '</p>' +
              '<div class="adv-mprev-f">' + U.sevBadge(d.sev) + '<span>' + I('pin', 12) + esc(d.area) + '</span></div></div></div>' +
            '<div class="ug-field"><label class="ug-lab">' + esc(T('label.deliveryMode')) + '</label>' +
              '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' +
                '<button class="ug-chip' + ((d.deliveryMode || 'push') === 'push' ? ' is-on' : '') + '"' + A('adv-delivery', attr({ v: 'push' })) + '>' + I('bell', 13) + esc(T('advisories.delivery.push')) + '</button>' +
                '<button class="ug-chip' + (d.deliveryMode === 'in_app' ? ' is-on' : '') + '"' + A('adv-delivery', attr({ v: 'in_app' })) + '>' + I('info', 13) + esc(T('advisories.delivery.inApp')) + '</button>' +
                '<div class="ug-help" style="flex:1;min-width:200px">' + esc(T('label.deliveryModeHint')) + '</div>' +
              '</div></div>' +
            '<div class="ug-rowf ug-gap8" style="gap:8px">' +
              '<button class="ug-btn ug-btn--signal adv-publish' + (ready ? ' is-ready' : ' is-disabled') + '"' + A('publish') + (st.publishing ? ' disabled aria-busy="true"' : '') + ' title="' + (ready ? 'Ready to publish' : 'Add a title and a message first') + '">' + I('megaphone', 16) + esc(T('advisories.publishBroadcast')) + '</button>' +
              '<button class="ug-btn ug-btn--ghost"' + A('clear-draft') + '>' + esc(T('action.clear')) + '</button>' +
              /* If no devices are subscribed yet, surface the "Enable push"
                 button right where the LGU is looking, so they can subscribe
                 this browser before publishing. The reach count updates on
                 the next load after a successful subscription. */
              (d.deliveryMode === 'push' && d.area === UG_GEO.PLACE.areaAll && st.session?.role === 'lgu_ldrrmc' &&
               Number.isInteger(U.DATA.subscribedDevices)
                ? '<span class="ug-dimmer" style="margin-left:auto;font-size:11px;display:flex;align-items:center;gap:6px">' + I('users', 13) + U.DATA.subscribedDevices + ' subscribed device' + (U.DATA.subscribedDevices === 1 ? '' : 's') + '</span>'
                : '') +
            '</div>' +
            '</div>' +
            (advStep < 3 ? '<div class="adv-snav">' +
                (advStep > 1 ? '<button class="adv-snav-back"' + A('adv-step', attr({ v: String(advStep - 1) })) + '>Back</button>' : '<span></span>') +
                '<button class="adv-snav-next"' + A('adv-step', attr({ v: String(advStep + 1) })) + '>Next' + I('chevron', 14) + '</button></div>'
              : '<div class="adv-snav"><button class="adv-snav-back"' + A('adv-step', attr({ v: '2' })) + '>Back</button><span></span></div>') +
          '</div></div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card adv-prev-card"><div class="ug-card-h"><h3>' + esc(T('advisories.preview')) + '</h3><span class="ug-dimmer" style="font-size:11px">' + (d.lang === 'fil' ? esc(T('settings.filipino')) : esc(T('settings.english'))) + ' · Lock Screen</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' +
              '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start;background:rgba(var(--ug-tint, 255,255,255),.03);border:1px solid var(--ug-line);border-radius:10px;padding:11px">' +
                U.brandMark(26) +
                '<span class="ug-col" style="gap:2px;min-width:0"><span class="ug-rowf" style="gap:6px"><span style="font-size:12px;font-weight:700">UniGuard</span>' +
                '<span class="ug-dimmer ug-mono" style="font-size:11px">now</span></span>' +
                '<span style="font-size:13px;font-weight:600">' + esc(d.title || 'Advisory title appears here') + '</span>' +
                '<span class="ug-dim ug-clamp3" style="font-size:12px;line-height:1.45">' + esc(d.msg || 'Your message appears here as residents will see it.') + '</span></span>' +
              '</div>' +
              '<div class="ug-rowf ug-gap8" style="gap:6px">' + U.sevBadge(d.sev) + U.badge('id', d.type) +
                '<span class="ug-dimmer ug-rowf" style="font-size:11px;gap:4px;margin-left:auto">' + I('pin', 12) + esc(d.area) + '</span></div>' +
            '</div></div>' +
          (() => {
            /* filter the published list by alert level (the level pills are hidden on phones) */
            const pf = ['all', 'emergency', 'warning', 'advisory', 'prepared'].indexOf(st.advPubFilter) >= 0 ? st.advPubFilter : 'all';
            const lvl = (v) => v === 'all' ? 'All levels' : ((U.SEV || {})[v] || {}).label || v;
            const cnt = (v) => v === 'all' ? U.DATA.advisories.length : U.DATA.advisories.filter((a) => a.severity === v).length;
            st.__pubList = U.DATA.advisories.filter((a) => pf === 'all' || a.severity === pf);
            return '<div class="ug-card adv-pub-card"><div class="ug-card-h"><h3>' + esc(T('advisories.published')) + '</h3>' +
              '<div class="ug-wmore adv-pf">' +
                '<button class="adv-pf-btn' + (pf !== 'all' ? ' is-on' : '') + '"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Filter by level">' +
                  (pf !== 'all' ? '<i class="adv-pf-dot is-' + pf + '"></i>' : '') + '<span>' + esc(lvl(pf)) + '</span><b>' + cnt(pf) + '</b>' + I('chevdn', 14) + '</button>' +
                '<div class="adv-pf-panel" data-more-panel hidden role="listbox">' + ['all', 'emergency', 'warning', 'advisory', 'prepared'].map((v) =>
                  '<button role="option" class="' + (v === pf ? 'is-on' : '') + '"' + A('adv-pub-filter', attr({ v: v })) + '>' +
                    '<i class="adv-pf-dot is-' + v + '"></i><span>' + esc(lvl(v)) + '</span><b>' + cnt(v) + '</b>' + (v === pf ? I('check', 13) : '') + '</button>').join('') +
                '</div></div></div>';
          })() +
            '<div class="ug-rows ug-scroll" style="max-height:330px">' + (st.__pubList.length ? '' : '<p class="adv-pf-none">No advisories at this level.</p>') + st.__pubList.map(a =>
              '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-advisory', attr({ id: a.id })) + ' title="' + esc(T('advisories.publishedHint')) + '"><span class="r-dot" style="background:' + U.SEV[a.severity].color + '"></span>' +
                '<div class="r-main"><div class="r-t" style="font-size:13px">' + esc(a.title) + '</div>' +
                '<div class="r-m"><span>' + I('pin', 12) + esc(a.area) + '</span><span>' + esc(a.type) + '</span><span>' + esc(a.time) + '</span></div></div>' +
                U.sevBadge(a.severity) + '</button>').join('') + '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---- centres management (feature 7) ---- */
  function dCenters(st){
    const all = U.DATA.centers;
    const f = st.centerFilter || 'all';
    const scope = st.shelterScope || 'all';
    /* LGU is municipality-wide, but an official is scoped to their barangay;
       "My Barangay" narrows the list the same way it does for citizens. */
    const myBrgy = (st.session && st.session.barangay) || '';
    const isOfficial = st.session && st.session.role === 'barangay_official';
    const scoped = (scope === 'mine' && isOfficial && myBrgy)
      ? all.filter(c => c.brgy === myBrgy)
      : all;
    const list = scoped.filter(c => f === 'all' || c.status === f)
      .filter((c) => {
        const q = (st.shelterSearch || '').trim().toLowerCase();
        if (!q) return true;
        return (c.name || '').toLowerCase().indexOf(q) >= 0 ||
               (c.brgy || '').toLowerCase().indexOf(q) >= 0 ||
               (c.contact_person || '').toLowerCase().indexOf(q) >= 0 ||
               (c.note || '').toLowerCase().indexOf(q) >= 0;
      });
    const counts = ['open', 'full', 'closed'].map(s => [s, scoped.filter(c => c.status === s).length]);
    const totalCap = scoped.reduce((s, c) => s + (c.cap || 0), 0);
    const totalOcc = scoped.reduce((s, c) => s + (c.occ || 0), 0);
    /* the status chips are now clickable filters (they were display-only
       before). Each carries its count + an is-on state for the active filter. */
    const statusChip = (s, n) => '<button class="ug-chip' + (f === s ? ' is-on' : '') + '"' + A('center-filter', attr({ v: s })) + '>' + I('shelter', 13) + n + ' ' + s + '</button>';
    /* facilities are stored as a comma-separated string or an array; normalise
       so the card renders a tidy chip row. */
    const facList = (c) => {
      const arr = Array.isArray(c.facilities) ? c.facilities
        : (c.facilities ? String(c.facilities).split(',').map((s) => s.trim()).filter(Boolean) : []);
      return arr;
    };
    const facChips = (c) => facList(c).map((x) =>
      '<span class="ug-chip ug-chip--soft">' + I('check', 11) + esc(x) + '</span>').join('');
    /* Shelter cards, calmer (Nov 2026): name + barangay + status on top; one
       big occupancy figure with its bar and a compact counter; facilities as
       one short line; one contact row; then a single footer with the status
       switch and icon actions. Coordinates and the note live in Details. */
    const FAC_MAX = 3;
    const card = (c) => {
      const pct = c.cap ? Math.min(100, Math.round(c.occ / c.cap * 100)) : 0;
      const left = Math.max(0, (c.cap || 0) - (c.occ || 0));
      const geoOk = UG_GEO.classify(c.lat, c.lng) === 'ok';
      const facs = facList(c);
      const tone = pct >= 90 ? 'is-hot' : pct >= 70 ? 'is-warm' : '';
      return '<article class="sc-card is-' + esc(c.status) + '">' +
        '<header class="sc-h"><div class="sc-h-t"><h3 title="' + esc(c.name) + '">' + esc(c.name) + '</h3>' +
            '<span class="sc-sub">' + I('pin', 12) + esc(c.brgy || '—') + (geoOk ? '' : '<em class="sc-warn" title="No map location yet">· No map pin</em>') + '</span></div>' +
          '<span class="sc-status is-' + esc(c.status) + '"><i></i>' + esc(c.status.charAt(0).toUpperCase() + c.status.slice(1)) + '</span></header>' +
        '<div class="sc-occ">' +
          '<div class="sc-occ-n"><b>' + (c.occ || 0) + '</b><span>of ' + (c.cap || 0) + ' people</span></div>' +
          '<span class="sc-occ-p ' + tone + '">' + (c.status === 'closed' ? 'Not taking evacuees' : left + ' spaces left') + '</span>' +
        '</div>' +
        '<div class="sc-bar ' + tone + '"><i style="width:' + pct + '%"></i></div>' +
        /* the counter: -10 / -1 / set / +1 / +10 in one quiet pill */
        '<div class="sc-step" role="group" aria-label="Adjust occupancy of ' + esc(c.name) + '">' +
          '<button' + A('center-occ', attr({ id: c.id, d: -10 })) + ' aria-label="Minus 10">−10</button>' +
          '<button' + A('center-occ', attr({ id: c.id, d: -1 })) + ' aria-label="Minus 1">−1</button>' +
          '<button class="sc-step-set"' + A('center-occ-set', attr({ id: c.id })) + ' title="Type an exact count">Set count</button>' +
          '<button' + A('center-occ', attr({ id: c.id, d: 1 })) + ' aria-label="Plus 1">+1</button>' +
          '<button' + A('center-occ', attr({ id: c.id, d: 10 })) + ' aria-label="Plus 10">+10</button>' +
        '</div>' +
        /* the least-used details fold into "More": facilities, contact and
           the record actions. Kept open across re-renders (UG_SC_OPEN). */
        '<footer class="sc-f">' +
          '<div class="sc-seg" role="group" aria-label="Shelter status">' + ['open', 'full', 'closed'].map(s => '<button class="' + (c.status === s ? 'is-on' : '') + '"' +
            (c.status === s ? ' aria-pressed="true"' : ' aria-pressed="false"') + A('center-status', attr({ id: c.id, s: s })) + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>').join('') + '</div>' +
        '</footer>' +
        '<details class="sc-more" data-sc-more="' + esc(c.id) + '"' + ((window.UG_SC_OPEN || {})[c.id] ? ' open' : '') + '>' +
          '<summary>' + I('chevdn', 14) + '<span>More</span><em>' + [facs.length ? facs.length + ' facilities' : '', c.contact_person || c.contact_phone ? 'contact' : ''].filter(Boolean).join(' · ') + '</em></summary>' +
          '<div class="sc-more-b">' +
            (facs.length ? '<div class="sc-fac">' + facs.map((x) => '<span>' + I('check', 11) + esc(x) + '</span>').join('') + '</div>' : '') +
            ((c.contact_person || c.contact_phone) ? '<div class="sc-contact">' + I('users', 12) +
              '<span>' + esc(c.contact_person || 'Shelter contact') + '</span>' +
              (c.contact_phone ? '<button' + A('call', attr({ num: c.contact_phone, agency: c.name })) + ' title="Call ' + esc(c.contact_phone) + '">' + I('phone', 12) + esc(c.contact_phone) + '</button>' : '') +
            '</div>' : '') +
            '<div class="sc-acts">' +
              '<button' + A('center-detail', attr({ id: c.id })) + '>' + I('doc', 13) + 'Details</button>' +
              '<button' + A('center-edit-location', attr({ id: c.id })) + (geoOk ? '' : ' class="is-warn"') + '>' + I('pin', 13) + (geoOk ? 'Edit location' : 'Set location') + '</button>' +
              '<button' + A('center-edit', attr({ id: c.id })) + '>' + I('settings', 13) + 'Edit shelter</button>' +
            '</div>' +
          '</div>' +
        '</details>' +
      '</article>';
    };
    const pctAll = totalCap ? Math.round(totalOcc / totalCap * 100) : 0;
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Evacuation Center Management', 'Keep capacity, facilities and contacts current so residents reach a shelter with space.',
        '<button class="ug-btn ug-btn--signal ac-open' + (st.acOpen ? ' is-on' : '') + '"' + A('ac-toggle') + ' aria-expanded="' + !!st.acOpen + '">' + I(st.acOpen ? 'x' : 'plus', 15) + (st.acOpen ? 'Close form' : 'Add Evacuation Center') + '</button>') +
      (st.acOpen ? /* Add Evacuation Center, in three labelled groups (the basics, where it
         is, who runs it and what it has) with one footer for the action.
         Field names and the add-center / center-locate actions are unchanged. */
      '<section class="ac" data-ac-step="1">' +
        '<header class="ac-h"><div><h3>' + I('plus', 16) + 'Add Evacuation Center</h3><p>Residents see it on the map and in the shelter list as soon as you add it.</p></div>' +
          '<button class="ac-x"' + A('ac-toggle') + ' aria-label="Close">' + I('x', 14) + '</button></header>' +
        /* phones: one group at a time (Details → Location → Contact) */
        '<ol class="ac-stepper" aria-label="Steps">' + [['1', 'Details'], ['2', 'Location'], ['3', 'Contact']].map((x) =>
          '<li data-s="' + x[0] + '"><button type="button"' + A('ac-step', attr({ v: x[0] })) + '><i></i><span>' + x[1] + '</span></button></li>').join('') + '</ol>' +
        '<div class="ac-groups">' +
          '<fieldset class="ac-g" data-g="1"><legend><b>1</b>Center Details</legend>' +
            '<label class="ac-f ac-f--wide"><span>Center name <em>required</em></span><input class="ug-in" data-field="centerName" placeholder="e.g. Lingayen Central Elementary School"></label>' +
            '<label class="ac-f"><span>Barangay</span><select class="ug-sel" data-field="centerBarangay" aria-label="Barangay">' +
              U.DATA.barangays.map(b => '<option>' + esc(b) + '</option>').join('') + '</select></label>' +
            '<label class="ac-f"><span>Capacity <em>people</em></span><input class="ug-in" data-field="centerCapacity" placeholder="400" inputmode="numeric"></label>' +
          '</fieldset>' +
          '<fieldset class="ac-g" data-g="2"><legend><b>2</b>Geographic Coordinates <i>optional</i></legend>' +
            '<label class="ac-f"><span>Latitude</span><input class="ug-in" data-field="centerLat" placeholder="16.0206" inputmode="decimal"></label>' +
            '<label class="ac-f"><span>Longitude</span><input class="ug-in" data-field="centerLng" placeholder="120.2306" inputmode="decimal"></label>' +
            '<button type="button" class="ac-loc"' + A('center-locate') + '>' + I('pin', 15) + 'Use my location</button>' +
            '<p class="ac-hint">' + I('info', 13) + 'Add coordinates so residents get the Waze directions button. Example: ' + esc(UG_GEO.EXAMPLE) + '.</p>' +
          '</fieldset>' +
          '<fieldset class="ac-g" data-g="3"><legend><b>3</b>Contact &amp; Facilities <i>optional</i></legend>' +
            '<label class="ac-f"><span>Contact person</span><input class="ug-in" data-field="centerContact" placeholder="e.g. Shelter Manager"></label>' +
            '<label class="ac-f"><span>Contact phone</span><input class="ug-in" data-field="centerPhone" placeholder="(075) 632-2222" inputmode="tel"></label>' +
            '<label class="ac-f ac-f--wide"><span>Facilities <em>separate with commas</em></span><input class="ug-in" data-field="centerFacilities" placeholder="e.g. Medical station, Kitchen, Pet-friendly area, Generator"></label>' +
            '<label class="ac-f ac-f--wide"><span>Notes</span><input class="ug-in" data-field="centerNote" placeholder="e.g. Priority for coastal households"></label>' +
          '</fieldset>' +
        '</div>' +
        '<div class="ac-snav"><button type="button" class="ac-back"' + A('ac-step', attr({ v: 'prev' })) + '>Back</button>' +
          '<button type="button" class="ac-next"' + A('ac-step', attr({ v: 'next' })) + '>Next' + I('chevron', 14) + '</button></div>' +
        '<footer class="ac-foot"><span>Facilities show as chips on the card so residents see what the shelter offers at a glance.</span>' +
          '<div class="ac-btns"><button class="ug-btn ug-btn--ghost"' + A('ac-toggle') + '>Cancel</button>' +
          '<button class="ug-btn ug-btn--signal ac-go"' + A('add-center') + '>' + I('plus', 15) + 'Add Center</button></div></footer>' +
      '</section>' : '') +
      /* one toolbar: the headline numbers, the scope, the status filter and search */
      '<div class="sc-tool">' +
        '<div class="sc-sum">' +
          '<div><span>Occupancy</span><b>' + totalOcc + ' <em>/ ' + totalCap + '</em></b><div class="sc-bar"><i style="width:' + pctAll + '%"></i></div></div>' +
          '<div><span>Open</span><b class="t-open">' + counts[0][1] + '</b></div>' +
          '<div><span>Full</span><b class="t-full">' + counts[1][1] + '</b></div>' +
          '<div><span>Closed</span><b class="t-closed">' + counts[2][1] + '</b></div>' +
        '</div>' +
        '<div class="sc-filters">' +
          (isOfficial
            ? '<div class="sc-seg sc-seg--sm sc-scope">' +
                '<button class="' + (scope === 'all' ? 'is-on' : '') + '"' + A('shelter-scope', attr({ v: 'all' })) + '>All</button>' +
                '<button class="' + (scope === 'mine' ? 'is-on' : '') + '"' + A('shelter-scope', attr({ v: 'mine' })) + '>' + esc(myBrgy || 'My barangay') + '</button></div>'
            : '') +
          '<div class="sc-seg sc-seg--sm sc-status">' +
            [['all', 'All', scoped.length], ['open', 'Open', counts[0][1]], ['full', 'Full', counts[1][1]], ['closed', 'Closed', counts[2][1]]]
              .map(c => '<button class="' + (f === c[0] ? 'is-on' : '') + '"' + A('center-filter', attr({ v: c[0] })) + '>' + c[1] + ' <em>' + c[2] + '</em></button>').join('') +
          '</div>' +
          '<label class="sc-search">' + I('search', 14) +
            '<input data-field="shelterSearch" value="' + esc(st.shelterSearch || '') + '" placeholder="Search shelters" aria-label="Search shelters by name, barangay or contact">' +
            (st.shelterSearch ? '<button' + A('shelter-clear-search') + ' aria-label="Clear search">' + I('x', 12) + '</button>' : '') +
          '</label>' +
        '</div>' +
      '</div>' +
      (list.length ? '<div class="sc-grid">' + list.map(card).join('') + '</div>'
      : '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('shelter', 20) + '</span>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No shelters match this filter</div>' +
        '<div class="ug-dim" style="font-size:11px">' + (scope === 'mine' ? 'No shelters are listed in your barangay yet. Switch to “All Shelters” to see the municipality-wide directory.' : 'Try a different status filter.') + '</div></div></div>') +

    '</div>';
  }

  /* ---- command view (focused operational layout) ----
     Live map + active incident list (Reported / Verified / Response Dispatched)
     + the status pipeline. Scope comes from the data layer: an official's
     session only receives their own barangay's rows. */
  function dCommand(st){
    const active = U.DATA.incidents.filter(i => i.status === 'reported' || i.status === 'verified' || i.status === 'dispatched');
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.command'), 'Focused operational view: live map, open incidents and the pipeline. Scope: ' + esc(sess(st).scope || ''),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('nav', attr({ route: 'incidents' })) + '>' + I('x', 15) + 'Exit Command View</button>') +
      '<div class="ug-card" style="padding:0;overflow:hidden"><div class="ug-map" data-map="live" style="height:clamp(320px,52vh,480px)">' + U.mapSVG({ animated: true }) + '</div></div>' +
      '<div class="ug-dgrid-main">' +
        '<div class="ug-card ug-col" style="min-height:0"><div class="ug-card-h"><div><h3>Active Incidents</h3>' +
          '<span class="ug-dimmer" style="font-size:11px">Reported · Verified · Response Dispatched — tap to open</span></div>' +
          '<span class="ug-chip is-on">' + active.length + ' open</span></div>' +
          '<div class="ug-rows ug-scroll" style="max-height:420px">' + (active.length ? active.map(i =>
            /* div (not button) so the inline Dispatch/Resolve chip can be a real
               clickable button. Clicking the row opens the incident; clicking the
               chip advances the status, just like the incident queue. */
            '<div class="ug-row" role="button" tabindex="0" style="width:100%;text-align:left;cursor:pointer"' + A('open-incident', attr({ id: i.id })) + '>' +
              '<span class="r-dot" style="background:' + (U.SEV[i.sev] || U.SEV.advisory).color + '"></span>' +
              '<div class="r-main"><div class="r-t">' + esc(i.hazard) + '<span class="ug-badge ug-badge--id">' + esc(i.id) + '</span></div>' +
                '<div class="r-m"><span>' + I('pin', 12) + esc(i.brgy) + '</span><span>' + I('clock', 12) + esc(i.time) + '</span><span>' + I('shield', 12) + (i.corr || 0) + '/3</span></div></div>' +
              '<span class="ug-rowf ug-gap8" style="gap:8px">' + U.stageBadge(i.status) + actionChip(i) + '</span>' +
            '</div>').join('')
            : '<div class="ug-empty"><span class="e-ico">' + I('check', 20) + '</span><div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">Nothing open in your scope</div></div>') + '</div></div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Status Pipeline</h3></div><div class="ug-card-b ug-col" style="gap:12px">' +
            U.STAGES.concat([{ key: 'rejected', label: UG_THEME.STATUS.rejected.label, color: UG_THEME.STATUS.rejected.color }]).map(s => {
              const total = U.DATA.incidents.length;
              const n = U.DATA.incidents.filter(i => i.status === s.key).length;
              const pct = total ? Math.round(n / total * 100) : 0;
              return '<div class="ug-col" style="gap:6px"><div class="ug-rowf ug-between" style="font-size:12px">' +
                '<span style="color:' + s.color + ';font-weight:600">' + s.label + '</span><span class="ug-mono">' + n + (n === 1 ? ' report' : ' reports') + '</span></div>' +
                '<div style="height:5px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.08);overflow:hidden">' +
                (n ? '<div style="height:100%;width:' + Math.max(4, pct) + '%;background:' + s.color + '"></div>' : '') + '</div></div>';
            }).join('') + '</div></div>' +
          '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-note">Statuses move one step at a time — Reported, Verified, Response Dispatched, Resolved. Rejected is final. Open an incident to advance it.</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  function actionChip(i){
    /* real clickable buttons now (the command-view rows are divs, not buttons,
       so a nested button is valid HTML). They advance the incident exactly like
       the queue does, so the Dispatch chip is no longer just decoration.
       Super Admin gets Edit instead of Verify — they have no verify permission. */
    const isSuper = !!(U._lastSt && U._lastSt.session && U._lastSt.session.role === 'lgu_ldrrmc' && U._lastSt.session.superAdmin);
    if (isSuper) return '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="edit-report" data-id="' + esc(i.id) + '">' + U.icon('settings', 13) + 'Edit</button>';
    if (i.status === 'reported')   return '<button class="ug-btn ug-btn--sm" data-act="advance" data-id="' + esc(i.id) + '">Verify</button>';
    if (i.status === 'verified')   return '<button class="ug-btn ug-btn--sm ug-btn--signal" data-act="advance" data-id="' + esc(i.id) + '">' + I('truck', 13) + 'Dispatch</button>';
    if (i.status === 'dispatched') return '<button class="ug-btn ug-btn--sm" data-act="advance" data-id="' + esc(i.id) + '">Resolve</button>';
    return '';
  }
  /* ---- hotlines management (feature 8 + master prompt Emergency Hotlines
     Management and Super Admin Approval) ----
       · Super Admin: Add / Edit / Delete directly (with confirmation dialogs),
         plus a "Pending Change Requests" queue at the top.
       · LGU staff: Add / Edit / Delete directly too (migration 093).
       · Barangay Official: Call + "Request Change" button. No direct
         Edit / Delete. Submitting a request opens a form modal that captures
         the action (add / edit / delete), the current data, the proposed
         data, and a reason. The request goes to the Super Admin for review.
       · The Call functionality is preserved for everyone. */
  function dHotlines(st){
    const isSuper = !!(st.session && st.session.role === 'lgu_ldrrmc' && st.session.superAdmin);
    const isLgu = !!(st.session && st.session.role === 'lgu_ldrrmc');
    const isOfficial = !!(st.session && st.session.role === 'barangay_official');
    /* LGU staff (the Super Admin included) manage the directory directly
       (migration 093); barangay officials still request changes */
    const canManage = isLgu;
    const canRequest = isOfficial;
    const pending = (UG.DATA.changeRequests || []).filter((r) => r.target_table === 'emergency_hotlines' && r.status === 'pending');

    /* pending requests queue — Super Admin only sees this section */
    const pendingSection = isSuper ? (pending.length
      ? '<div class="ug-card" style="border-left:3px solid var(--ug-warning)"><div class="ug-card-h"><h3>' + esc(T('hotlines.pendingChangeRequests')) + '</h3>' +
          '<span class="ug-chip" style="background:rgba(255,179,64,.14);color:var(--ug-warning)">' + pending.length + ' ' + esc(T('action.review').toLowerCase()) + '</span></div>' +
          '<div class="ug-rows ug-scroll" style="max-height:280px">' + pending.map((r) =>
            '<div class="ug-row" role="button" tabindex="0" style="cursor:pointer;width:100%;text-align:left;background:none" data-act="open-change-request" data-id="' + esc(r.id) + '"><span class="r-dot" style="background:var(--ug-warning)"></span>' +
              '<div class="r-main"><div class="r-t">' + esc(r.action.toUpperCase()) + ' · ' + esc(r.target_table.replace(/_/g, ' ')) + '</div>' +
                '<div class="r-m"><span>' + I('users', 12) + esc(r.requester_name || '—') + '</span>' +
                '<span>' + I('pin', 12) + esc(r.requester_barangay || '—') + '</span>' +
                '<span>' + I('clock', 12) + esc(UG_UTIL.relTime(r) || '') + '</span></div></div>' +
              '<span class="ug-badge ug-badge--warning">' + esc(T('hotlines.status')) + '</span></div>').join('') + '</div></div>'
      : '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:center">' +
          '<span style="color:var(--ug-prepared);display:flex">' + I('check', 16) + '</span>' +
          '<div><div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">' + esc(T('hotlines.noPending')) + '</div>' +
          '<div class="ug-dim" style="font-size:11px">' + esc(T('hotlines.noPendingHint')) + '</div></div></div></div>')
      : '';

    /* pending count for the LGU's own submitted requests (so they can see
       what they're waiting on) */
    const myPending = canRequest ? (UG.DATA.changeRequests || []).filter((r) => r.requester_id === st.session.id && r.status === 'pending') : [];
    const myPendingSection = canRequest && myPending.length
      ? '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:8px">' +
          '<div class="ug-rowf ug-between"><div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">Your pending requests</div>' +
            '<span class="ug-chip">' + myPending.length + '</span></div>' +
          myPending.slice(0, 5).map((r) => '<div class="ug-rowf ug-between" style="gap:8px;font-size:12px">' +
            '<span>' + esc(r.action) + ' · ' + esc((r.proposed_data && r.proposed_data.agency_name) || (r.current_data && r.current_data.agency_name) || '—') + '</span>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="open-change-request" data-id="' + esc(r.id) + '">View</button></div>').join('') +
        '</div></div>'
      : '';

    /* Layout (Nov 2026): type pills + search, even cards with one Call
       button and quiet icon actions, the add form behind a head button, role
       notes as dismissible notices. Actions and permissions are unchanged. */
    const all = U.DATA.hotlines || [];
    const TYPE_ICON = { emergency: 'alert', medical: 'plus', barangay: 'home', police: 'shield', fire: 'flame', rescue: 'flood' };
    const cap = (v) => { v = String(v || 'other'); return v.charAt(0).toUpperCase() + v.slice(1); };
    const types = all.reduce((m, h) => { const k = h.type || 'other'; m[k] = (m[k] || 0) + 1; return m; }, {});
    const tf = st.hlType && (st.hlType === 'all' || types[st.hlType]) ? st.hlType : 'all';
    const q = String(st.hlSearch || '').trim().toLowerCase();
    const shown = all.filter((h) => tf === 'all' || (h.type || 'other') === tf)
      .filter((h) => !q || [h.agency, h.number, h.scope, h.type].some((v) => String(v || '').toLowerCase().indexOf(q) >= 0));
    const tel = (n) => 'tel:' + String(n || '').replace(/[^\d+]/g, '');
    const iconBtn = (act, id, icon, label, cls) => '<button class="hl-ico' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-id="' + esc(id) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + I(icon, 14) + '</button>';
    const hotlineActions = (h) =>
      '<div class="hl-foot"><a class="hl-call" href="' + esc(tel(h.number)) + '">' + I('phone', 14) + esc(T('action.call')) + '</a>' +
        (canManage
          ? iconBtn('open-hotline-detail', h.id, 'doc', T('hotlines.viewDetails')) + iconBtn('edit-hotline', h.id, 'settings', T('action.edit')) + iconBtn('delete-hotline', h.id, 'x', T('action.delete'), 'is-del')
          : canRequest ? '<button class="hl-req" data-act="request-hotline-edit" data-id="' + esc(h.id) + '">' + I('doc', 13) + esc(T('hotlines.requestChange')) + '</button>' : '') +
      '</div>';
    const cardHtml = (h) => '<article class="hl-card">' +
        '<div class="hl-top"><span class="hl-av">' + I(TYPE_ICON[h.type] || 'phone', 16) + '</span><span class="hl-type">' + esc(cap(h.type)) + '</span></div>' +
        '<a class="hl-num" href="' + esc(tel(h.number)) + '">' + esc(h.number) + '</a>' +
        '<h3 class="hl-name" title="' + esc(h.agency) + '">' + esc(h.agency) + '</h3>' +
        '<p class="hl-scope">' + esc(h.scope || '') + '</p>' +
        hotlineActions(h) +
      '</article>';

    const addForm = canManage && st.hlAddOpen
      ? '<section class="hl-add"><div class="hl-add-h"><div><h3>' + esc(T('hotlines.addHotline')) + '</h3><p>Shows on every resident\'s Hotlines page once saved.</p></div>' +
          '<button class="hl-ico" data-act="hl-add-toggle" aria-label="Close">' + I('x', 14) + '</button></div>' +
          '<div class="hl-add-g">' +
            '<label><span>' + esc(T('hotlines.agencyName')) + '</span><input class="hl-in" data-field="hotlineAgency" placeholder="e.g. Bureau of Fire Protection"></label>' +
            '<label><span>' + esc(T('hotlines.contactNumber')) + '</span><input class="hl-in" data-field="hotlineNumber" inputmode="tel" placeholder="(075) 000-0000"></label>' +
            '<label><span>' + esc(T('hotlines.scope')) + '</span><input class="hl-in" data-field="hotlineScope" placeholder="Fire and rescue"></label>' +
          '</div>' +
          '<div class="hl-add-f"><button class="hl-ghost" data-act="hl-add-toggle">Cancel</button><button class="hl-save"' + A('add-hotline') + '>' + I('plus', 14) + esc(T('action.add')) + '</button></div></section>'
      : '';

    const headActions =
      (isSuper && !pending.length ? '<span class="hl-ok">' + I('check', 13) + esc(T('hotlines.noPending')) + '</span>' : '') +
      '<button class="hl-ghost hl-xpdf"' + A('export-hotlines') + ' aria-label="' + esc(T('action.exportPdf')) + '">' + I('download', 14) + esc(T('action.exportPdf')) + '</button>' +
      (canManage ? '<button class="hl-ghost hl-primary' + (st.hlAddOpen ? ' is-on' : '') + '" data-act="hl-add-toggle" aria-label="' + esc(T('hotlines.addHotline')) + '">' + I('plus', 14) + esc(T('hotlines.addHotline')) + '</button>' : '') +
      (canRequest ? '<button class="hl-ghost hl-primary" data-act="request-hotline-add" aria-label="' + esc(T('hotlines.requestNew')) + '">' + I('plus', 14) + esc(T('hotlines.requestNew')) + '</button>' : '');

    return '<div class="ug-col hl" style="gap:20px">' +
      pageHead(T('hotlines.title'), T('hotlines.subtitle'), headActions) +
      (isSuper ? UG.note('hl-super', 1, 'info', 'You manage the official list', 'Add, edit or delete hotlines directly. Every change is recorded in the Activity Log, and requests from barangay officials appear here for review.')
        : canManage ? UG.note('hl-lgu', 1, 'info', 'You manage the official list', 'Add, edit or delete hotlines directly. Every change is recorded in the Activity Log and shows on every resident\'s Hotlines page.') : '') +
      (canRequest ? UG.note('hl-request', 1, 'info', 'Changes go to the Super Admin', 'Use <b>Request change</b> on a card or <b>Request a new hotline</b> above. You are notified when it is decided.') : '') +
      (isSuper && pending.length ? pendingSection : '') +
      myPendingSection +
      addForm +
      '<div class="hl-tool">' +
        /* phones: the type filter as a dropdown left of the search (desktop keeps the tabs) */
        (function () {
          const opts = [['all', 'All', all.length]].concat(Object.keys(types).map((k) => [k, cap(k), types[k]]));
          const cur = opts.find((o) => o[0] === tf) || opts[0];
          return '<div class="ug-wmore inc-dd hl-dd">' +
            '<button class="inc-dd-btn"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Filter by type">' +
              I('sort', 15) + '<span>' + esc(cur[1]) + '</span>' + I('chevdn', 14) + '</button>' +
            '<div class="inc-dd-panel" data-more-panel hidden role="listbox">' + opts.map((o) =>
              '<button role="option" class="' + (o[0] === tf ? 'is-on' : '') + '"' + A('hl-type', attr({ v: o[0] })) + '>' +
                '<span>' + esc(o[0] === 'all' ? 'All types' : o[1]) + '</span><b>' + o[2] + '</b>' + (o[0] === tf ? I('check', 14) : '') + '</button>').join('') +
            '</div></div>';
        })() +
        '<div class="sos-tabs" role="tablist" aria-label="Hotline type">' +
          [['all', 'All', all.length]].concat(Object.keys(types).map((k) => [k, cap(k), types[k]])).map((t) =>
            '<button role="tab" aria-selected="' + (tf === t[0]) + '" class="' + (tf === t[0] ? 'is-on' : '') + '" data-act="hl-type" data-v="' + esc(t[0]) + '">' + esc(t[1]) + '<i>' + t[2] + '</i></button>').join('') + '</div>' +
        '<span class="sos-search">' + I('search', 14) + '<input data-field="rw.hlSearch" value="' + esc(st.hlSearch || '') + '" placeholder="Search hotlines" aria-label="Search agency, number or scope">' +
          (st.hlSearch ? '<button data-act="hl-search-clear" aria-label="Clear search">' + I('x', 11) + '</button>' : '') + '</span></div>' +
      (shown.length ? '<div class="hl-grid">' + shown.map(cardHtml).join('') + '</div>'
        : '<div class="rl-card"><div class="rl-empty"><span>' + I('search', 20) + '</span><b>No hotline matches</b><p>Try another type or clear the search.</p></div></div>') +
    '</div>';
  }

  /* ---- analytics (feature 2 + 5) ----
     Section 10: every card shows the actual numbers from the data layer, with
     a comparison to the previous equivalent reporting period where applicable.
     The barangay filter applies to every card so the Super Admin / LGU can
     see one barangay across the whole page. No fake numbers anywhere. */
  /* The numbers behind the Analytics screen, shared with its PDF / Excel / CSV
     exports (js/exports.js) so a document can never disagree with the screen. */
  function analyticsModel(st){
    const stored = U.DATA.analytics || {};
    const cnt = U.DATA.counts || {};
    const fmtDur = (s) => s == null ? '—' : (s >= 3600 ? (s / 3600).toFixed(1) + ' h' : Math.round(s / 60) + ' min');
    const isLGU = st.session?.role === 'lgu_ldrrmc';
    const brgyFilter = isLGU ? st.anBrgyFilter || 'All' : 'All';
    const from = st.anFrom || stored.from || UG_EXPORT.isoDate(Date.now() - 29 * 86400000);
    const to = st.anTo || stored.to || UG_EXPORT.todayIso();
    const inScope = (name) => brgyFilter === 'All' || name === brgyFilter;
    const inc = (U.DATA.incidents || []).filter((row) => inScope(row.brgy));
    const adv = (U.DATA.advisories || []).filter((row) => brgyFilter === 'All' || row.citywide || row.area === brgyFilter);
    const cen = (U.DATA.centers || []).filter((row) => inScope(row.brgy));
    const relief = (U.DATA.relief || []).filter((row) => inScope(row.barangay));
    const reportById = new Map(inc.map((row) => [row.uuid || row.id, row]));
    const dispatches = Object.fromEntries(Object.entries(U.DATA.dispatches || {}).filter(([id]) => reportById.has(id)));

    const daily = new Map();
    const dispatchSeconds = [], resolveSeconds = [];
    const useServer = brgyFilter === 'All' && stored.live && stored.from === from && stored.to === to;
    if (useServer) {
      (stored.daily || []).forEach((row) => { if (row.day) daily.set(row.day, Number(row.total)); });
    } else {
      for (const row of inc) {
        const day = UG_EXPORT.isoDate(row.created_at);
        if (!day || day < from || day > to) continue;
        daily.set(day, (daily.get(day) || 0) + 1);
        const start = Date.parse(row.created_at);
        const first = (dispatches[row.uuid] || []).map((d) => Date.parse(d.dispatched_at)).filter((n) => n >= start);
        const resolved = Date.parse(row.resolved_at);
        if (first.length) dispatchSeconds.push((Math.min(...first) - start) / 1000);
        if (resolved >= start) resolveSeconds.push((resolved - start) / 1000);
      }
    }
    const avg = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
    const an = {
      ...stored, from, to,
      daily: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([day, total]) => ({ day, total })),
      avgDispatchSeconds: useServer ? stored.avgDispatchSeconds : avg(dispatchSeconds),
      avgResolveSeconds: useServer ? stored.avgResolveSeconds : avg(resolveSeconds)
    };
    const end = (UG_EXPORT.toDate(to) || new Date()).getTime();
    const trendDates = Array.from({length: 14}, (_, index) => UG_EXPORT.isoDate(end - (13 - index) * 86400000));
    const trendDaily = trendDates.map((day) => daily.get(day) || 0);
    const trend = trendDaily;

    /* A. reports by hazard type — actual counts, including "Others" */
    const byHaz = {};
    inc.forEach((i) => { byHaz[i.hazard] = (byHaz[i.hazard] || 0) + 1; });
    const hazRows = Object.keys(byHaz).map((k) => [k, byHaz[k], UG_HAZARDS.colorFor(k)])
      .filter((r) => r[1] > 0).sort((x, y) => y[1] - x[1]);

    /* B. reports by barangay — ranked list, with bars */
    const byBrgy = {};
    inc.forEach((i) => { byBrgy[i.brgy] = (byBrgy[i.brgy] || 0) + 1; });
    const brgyRows = Object.keys(byBrgy).map((k) => ({ brgy: k, total: byBrgy[k] }))
      .sort((a, b) => b.total - a.total);

    /* C. report status breakdown */
    const stages = { reported: 0, verified: 0, dispatched: 0, resolved: 0, rejected: 0 };
    inc.forEach((i) => { if (stages[i.status] != null) stages[i.status]++; });
    const openCount = inc.filter((i) => i.status !== 'resolved' && i.status !== 'rejected').length;
    /* oldest unresolved report — measured from created_at */
    const openIncidents = inc.filter((i) => i.status !== 'resolved' && i.status !== 'rejected' && i.created_at);
    const oldest = openIncidents.length ? openIncidents.reduce((a, b) => (Date.parse(a.created_at) < Date.parse(b.created_at) ? a : b)) : null;
    const oldestAgeMin = oldest ? Math.round((Date.now() - Date.parse(oldest.created_at)) / 60000) : 0;
    const staleThreshold = 30; /* matches the escalation policy */
    const overThresholdCount = openIncidents.filter((i) => (Date.now() - Date.parse(i.created_at)) / 60000 > staleThreshold).length;

    /* D. response time by unit (BFP / PNP / Rescue / Hospital). We don't have
       a direct join, so we estimate from the dispatches table: each dispatch
       record ties a report to a team name. We bucket team names by unit type. */
    const unitBuckets = { BFP: [], PNP: [], Rescue: [], Hospital: [] };
    Object.keys(dispatches).forEach((rid) => {
      const report = reportById.get(rid);
      if (!report || !report.created_at) return;
      (dispatches[rid] || []).forEach((d) => {
        const t = (d.team || '').toLowerCase();
        let bucket = null;
        if (/bfp|fire/.test(t)) bucket = 'BFP';
        else if (/pnp|police/.test(t)) bucket = 'PNP';
        else if (/rescue|sarl|sar/.test(t)) bucket = 'Rescue';
        else if (/hospital|medic|ambulance|ems/.test(t)) bucket = 'Hospital';
        if (!bucket) return;
        const dispatchedAt = d.dispatched_at ? Date.parse(d.dispatched_at) : null;
        if (!dispatchedAt) return;
        const dt = (dispatchedAt - Date.parse(report.created_at)) / 1000;
        if (dt >= 0) unitBuckets[bucket].push(dt);
      });
    });
    const unitStats = Object.keys(unitBuckets).map((k) => {
      const arr = unitBuckets[k];
      if (!arr.length) return { unit: k, count: 0, avg: null, slowest: null };
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      const slowest = arr.reduce((a, b) => Math.max(a, b), 0);
      return { unit: k, count: arr.length, avg: avg, slowest: slowest };
    });

    /* E. dispatch workload — number of dispatches per team */
    const perTeam = {};
    Object.keys(dispatches).forEach((rid) => {
      (dispatches[rid] || []).forEach((d) => {
        const team = d.team || 'Unspecified';
        perTeam[team] = (perTeam[team] || 0) + 1;
      });
    });
    const teamRows = Object.keys(perTeam).map((k) => ({ team: k, count: perTeam[k] })).sort((a, b) => b.count - a.count);

    /* F. verification quality — verified, unverified, rejected, auto-verified.
       Display only — no verify controls for the Super Admin. */
    const verified = stages.verified + stages.dispatched + stages.resolved;
    const unverified = stages.reported;
    const rejected = stages.rejected;
    const total = inc.length || 1;
    const autoVerified = inc.filter((i) => (i.corr || 0) >= 3).length;

    /* G. shelter occupancy */
    const totalCap = cen.reduce((s, c) => s + (c.cap || 0), 0);
    const totalOcc = cen.reduce((s, c) => s + (c.occ || 0), 0);
    const fullShelters = cen.filter((c) => c.status === 'full' || (c.cap && c.occ >= c.cap));
    const openShelters = cen.filter((c) => c.status === 'open');

    /* H. relief goods distribution — per-barangay + distribution phase */
    const reliefPerBrgy = {};
    relief.forEach((r) => { reliefPerBrgy[r.barangay] = (reliefPerBrgy[r.barangay] || 0) + 1; });
    const reliefRows = Object.keys(reliefPerBrgy).map((k) => ({ brgy: k, count: reliefPerBrgy[k] }))
      .sort((a, b) => b.count - a.count);
    const reliefPhases = { to_distribute: 0, during: 0, fully: 0 };
    relief.forEach((r) => {
      const status = (r.status || r.phase || '').toLowerCase();
      if (/distribut/.test(status) && !/fully|complete/.test(status)) reliefPhases.during++;
      else if (/fully|complete/.test(status)) reliefPhases.fully++;
      else reliefPhases.to_distribute++;
    });
    const distLog = (U.DATA.distributionLog || []).filter((row) => !row.voided_at && inScope(row.barangay));
    const totalRecipients = distLog.length;

    /* previous-period comparison: last 7 days vs the 7 days before that */
    const week = (trendDaily.length >= 7) ? trendDaily.slice(-7).reduce((a, b) => a + b, 0) : 0;
    const prev = (trendDaily.length >= 14) ? trendDaily.slice(0, 7).reduce((a, b) => a + b, 0) : 0;
    const weekDelta = prev ? Math.round(((week - prev) / prev) * 100) : 0;
    return { an, cnt, trendDaily, trend, fmtDur, isLGU, brgyFilter, trendDates, inc, adv, cen, relief, byHaz, hazRows, byBrgy, brgyRows, stages, openCount, openIncidents, oldest, oldestAgeMin, staleThreshold, overThresholdCount, unitBuckets, dispatches, unitStats, perTeam, teamRows, verified, unverified, rejected, total, autoVerified, totalCap, totalOcc, fullShelters, openShelters, reliefPerBrgy, reliefRows, reliefPhases, distLog, totalRecipients, week, prev, weekDelta };
  }

  function dAnalytics(st){
    const { an, cnt, trendDaily, trend, fmtDur, isLGU, brgyFilter, trendDates, inc, adv, cen, relief, byHaz, hazRows, byBrgy, brgyRows, stages, openCount, openIncidents, oldest, oldestAgeMin, staleThreshold, overThresholdCount, unitBuckets, dispatches, unitStats, perTeam, teamRows, verified, unverified, rejected, total, autoVerified, totalCap, totalOcc, fullShelters, openShelters, reliefPerBrgy, reliefRows, reliefPhases, distLog, totalRecipients, week, prev, weekDelta } = analyticsModel(st);

    /* Analytics in the uniguard layout (LdrrmcAnalyticsView): header, sync
       state, four figure cards, the 14-day chart, how fast reports are
       handled, the range + barangay + export bar, then four tabs (Reports,
       Response, Shelters & relief, Compare). Same numbers (analyticsModel),
       same filters (anFrom / anTo / anBrgyFilter) and the same exports. */
    const tab = st.anTab || 'reports';
    const range = st.anRange || (st.anFrom || st.anTo ? 'custom' : '30');
    const brgyOpts = ['All'].concat(U.DATA.barangays).map((b) =>
      '<option value="' + esc(b) + '"' + (brgyFilter === b ? ' selected' : '') + '>' + esc(b === 'All' ? 'All barangays' : b) + '</option>').join('');
    const fmtD = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const isoD = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const toD = st.anTo ? new Date(st.anTo + 'T00:00:00') : new Date();
    const fromD = st.anFrom ? new Date(st.anFrom + 'T00:00:00') : new Date(toD.getTime() - 30 * 86400000);
    const days = Math.max(1, Math.round((toD - fromD) / 86400000));
    const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
    const bar = (v, max) => '<div class="an-bar"><i style="width:' + (max ? Math.max(v ? 3 : 0, Math.round(v / max * 100)) : 0) + '%"></i></div>';
    const card = (title, sub, inner, right, icon) => '<section class="an-card"><header class="an-ch"><div><h3>' + (icon ? I(icon, 16) : '') + esc(title) + '</h3>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (right || '') + '</header>' + inner + '</section>';
    const kpi = (label, value, note, icon, dot, nav) => '<div class="an-kpi' + (nav ? ' is-link' : '') + '"' + (nav ? ' role="button" tabindex="0"' + A('nav', attr({ route: nav })) : '') + '>' +
      '<div class="an-kpi-t"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div><span class="an-kpi-ico">' + I(icon, 20) + '</span>' +
      '<div class="an-kpi-f"><i' + (dot ? ' class="is-' + dot + '"' : '') + '></i>' + esc(note) + '</div></div>';

    /* the chart: server totals for all hazards, local counts per hazard */
    const hz = st.anHaz || 'All';
    const series = hz === 'All' ? trend : trendDates.map((day) => {
      if (day < an.from) return 0;
      return inc.filter((row) => UG_HAZARDS.classify(row.hazard_type || row.hazard).key === hz &&
        UG_EXPORT.isoDate(row.created_at) === day).length;
    });
    const maxY = Math.max(1, Math.max.apply(null, series));
    const chart = (function () {
      const W = 1000, H = 220, L = 30, R = 14, T = 14, B = 26, iw = W - L - R, ih = H - T - B;
      const x = (k) => L + (k + .5) * iw / 14, y = (v) => T + ih - v / maxY * ih;
      const grid = (maxY >= 2 ? [0, .5, 1] : [0, 1]).map((f) => { const v = Math.round(maxY * f); return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(maxY * f) + '" y2="' + y(maxY * f) + '" class="g"/><text x="4" y="' + (y(maxY * f) + 4) + '" class="t">' + v + '</text>'; }).join('');
      const pts = series.map((v, k) => x(k) + ',' + y(v)).join(' ');
      const dots = series.map((v, k) => '<g class="d"><circle cx="' + x(k) + '" cy="' + y(v) + '" r="' + (v ? 6 : 5) + '" class="' + (v ? 'on' : '') + '"/><title>' + esc(UG_EXPORT.formatDate(trendDates[k])) + ': ' + v + ' report' + (v === 1 ? '' : 's') + '</title></g>').join('');
      return '<svg class="an-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Reports per day over the last 14 days">' + grid +
        (series.some((v) => v) ? '<polyline points="' + pts + '" class="l"/>' : '') + dots + '</svg>' +
        '<div class="an-xl">' + [0, 3, 6, 9, 13].map((index) =>
          '<span>' + esc(UG_EXPORT.formatDate(trendDates[index])) + '</span>').join('') + '</div>';
    })();

    const ids = new Set(inc.map((i) => i.uuid));
    const disp = [].concat.apply([], Object.keys(U.DATA.dispatches || {}).filter((k) => ids.has(k)).map((k) => U.DATA.dispatches[k]));
    const scene = disp.filter((d) => d.on_scene_at && d.dispatched_at).map((d) => (Date.parse(d.on_scene_at) - Date.parse(d.dispatched_at)) / 1000);
    const rated = inc.filter((i) => i.rating);
    const avgScene = scene.length ? scene.reduce((p, q) => p + q, 0) / scene.length : null;
    const avgStars = rated.length ? rated.reduce((p, i) => p + i.rating.stars, 0) / rated.length : null;
    const dispCount = teamRows.reduce((n, t) => n + t.count, 0);

    const TABS = [['reports', 'Reports', 'doc', inc.length + ' report' + (inc.length === 1 ? '' : 's')],
      ['response', 'Response', 'truck', dispCount + ' dispatch' + (dispCount === 1 ? '' : 'es')],
      ['shelters', 'Shelters<em class="an-long"> &amp; relief</em>', 'shelter', totalOcc.toLocaleString() + ' of ' + totalCap.toLocaleString() + ' places'],
      ['compare', 'Compare', 'wave', 'Reports ' + (weekDelta >= 0 ? 'up ' : 'down ') + Math.abs(weekDelta || 0) + '%']];

    const tabBody = tab === 'response' ? (
        '<div class="an-two">' +
          card('Response time by unit', 'From actual dispatch times', '<div class="an-pad an-list">' + unitStats.map((u) =>
            '<div class="an-unit"><div><b>' + esc(u.unit) + '</b><span>' + u.count + ' dispatch' + (u.count === 1 ? '' : 'es') + '</span></div>' +
            '<div class="an-unit-n"><span>Average<b>' + fmtDur(u.avg) + '</b></span><span>Slowest<b>' + fmtDur(u.slowest) + '</b></span></div></div>').join('') + '</div>') +
          card('Dispatch workload', teamRows.length + ' team' + (teamRows.length === 1 ? '' : 's'), '<div class="an-pad an-list">' + (teamRows.length ? teamRows.slice(0, 8).map((t) =>
            '<div class="an-row"><div><span>' + esc(t.team) + '</span><b>' + t.count + '</b></div>' + bar(t.count, teamRows[0].count) + '</div>').join('') : '<p class="an-muted">No dispatches recorded yet.</p>') + '</div>') +
        '</div>' +
        card('On scene and residents\' rating', 'Reports in this range', '<div class="an-split">' +
          '<div><span>Dispatch to team on scene</span><b>' + (avgScene != null ? fmtDur(avgScene) : '<em>No arrivals yet</em>') + '</b><small>' + scene.length + ' arrival' + (scene.length === 1 ? '' : 's') + '</small></div>' +
          '<div><span>Average resident rating</span><b>' + (avgStars != null ? avgStars.toFixed(1) + ' / 5' : '<em>No ratings yet</em>') + '</b><small>' + rated.length + ' rated</small></div></div>' +
          (rated.length ? '<div class="an-pad">' + roleAverages(rated) + '</div>' : ''))
      ) : tab === 'shelters' ? (
        '<div class="an-two">' +
          card('Shelter occupancy', openShelters.length + ' open · ' + fullShelters.length + ' at capacity', '<div class="an-pad">' +
            '<div class="an-big">' + totalOcc.toLocaleString() + '<em> / ' + totalCap.toLocaleString() + ' people</em></div>' + bar(totalOcc, totalCap) +
            (fullShelters.length ? '<h4 class="an-h4">At capacity</h4><div class="an-lines">' + fullShelters.slice(0, 6).map((c) => '<div class="an-line"><span>' + esc(c.name) + '</span><b>' + c.occ + ' / ' + c.cap + '</b></div>').join('') + '</div>' : '<p class="an-muted">No shelter is full.</p>') + '</div>') +
          card('Relief goods distribution', totalRecipients + ' recipients · ' + reliefRows.length + ' barangays', '<div class="an-pad">' +
            '<div class="an-tiles an-tiles--3">' + [['To be distributed', reliefPhases.to_distribute], ['During distribution', reliefPhases.during], ['Fully distributed', reliefPhases.fully]].map((r) =>
              '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('') + '</div>' +
            '<h4 class="an-h4">Per barangay</h4>' + (reliefRows.length ? '<div class="an-list">' + reliefRows.slice(0, 8).map((r) => '<div class="an-row"><div><span>' + esc(r.brgy) + '</span><b>' + r.count + '</b></div>' + bar(r.count, reliefRows[0].count) + '</div>').join('') + '</div>' : '<p class="an-muted">No distributions recorded.</p>') + '</div>') +
        '</div>'
      ) : tab === 'compare' ? (
        card('Compared with the week before', 'Last 7 days vs the 7 days before', '<div class="an-pad"><div class="an-tiles an-tiles--3">' +
          '<div><span>This week</span><b>' + week + '</b></div><div><span>Previous week</span><b>' + prev + '</b></div>' +
          '<div><span>Change</span><b>' + (weekDelta >= 0 ? '+' : '') + (weekDelta || 0) + '%</b></div></div>' +
          '<p class="an-muted an-left">Fewer reports than last week is good. The barangay and date filters above apply to every tab.</p></div>')
      ) : (
        '<div class="an-two">' +
          card('Reports by hazard', inc.length + ' report' + (inc.length === 1 ? '' : 's') + ' in this range', '<div class="an-pad an-list">' + (hazRows.length ? hazRows.map((h) =>
            '<button class="an-row an-row--btn"' + A('an-open-haz', attr({ v: h[0] })) + ' title="Open these reports"><div><span>' + esc(h[0]) + '</span><b>' + h[1] + '</b></div>' + bar(h[1], hazRows[0][1]) + '</button>').join('') +
            '<p class="an-muted an-left">Tap a hazard to see those reports.</p>' : '<p class="an-muted">No reports in this range.</p>') + '</div>') +
          card('Reports by barangay', brgyRows.length + ' barangay' + (brgyRows.length === 1 ? '' : 's'), '<div class="an-pad an-list">' + (brgyRows.length ? brgyRows.slice(0, 10).map((b) =>
            '<button class="an-row an-row--btn"' + A('an-open-brgy', attr({ v: b.brgy || '' })) + '><div><span>' + esc(b.brgy || '—') + '</span><b>' + b.total + ' report' + (b.total === 1 ? '' : 's') + '</b></div>' + bar(b.total, brgyRows[0].total) + '</button>').join('')
            : '<p class="an-muted">No reports in this range.</p>') + '</div>') +
        '</div>' +
        card('Where reports are now', 'Each report\'s current step', '<div class="an-pad">' +
          '<div class="an-tiles an-tiles--5">' + [['reported', 'Awaiting verification'], ['verified', 'Verified'], ['dispatched', 'Dispatched'], ['resolved', 'Resolved'], ['rejected', 'Rejected']].map((x) =>
            '<button' + A('an-open-stage', attr({ v: x[0] })) + '><span>' + x[1] + '</span><b>' + (stages[x[0]] || 0) + '</b><small>' + pct(stages[x[0]] || 0, inc.length) + '%</small></button>').join('') + '</div>' +
          '<dl class="an-facts"><div><dt>Still open</dt><dd>' + openCount + '</dd></div><div><dt>Waiting over 30 min for verification</dt><dd>' + overThresholdCount + '</dd></div>' +
            '<div><dt>Oldest open</dt><dd>' + (oldest ? esc(oldest.id) + ', ' + esc(oldest.time || (oldestAgeMin + ' min ago')) : '—') + '</dd></div></dl>' +
          (oldest ? '<button class="an-ghost"' + A('open-incident', attr({ id: oldest.id })) + '>Open the oldest report</button>' : '') + '</div>') +
        '<div class="an-two">' +
          card('How reports were confirmed', 'For checking quality; nothing to act on here', '<div class="an-pad an-list">' +
            [['Verified (or further along)', verified, true], ['Still waiting for verification', unverified, true], ['Rejected', rejected, true], ['Confirmed by 3 or more neighbours', autoVerified, false]].map((r) =>
              '<div class="an-row"><div><span>' + r[0] + '</span><b>' + r[1] + (r[2] ? ' · ' + pct(r[1], inc.length) + '%' : '') + '</b></div>' + bar(r[1], inc.length) + '</div>').join('') + '</div>') +
        '</div>'
      );

    return '<div class="ug-col an" style="gap:24px">' +
      pageHead(T('title.analytics'), isLGU ? 'Municipality-wide telemetry across hazards, response times and verification quality.' : 'Barangay telemetry across hazards, response times and verification quality.',
        /* phones: one round Export button with a small menu (the range card's CSV / PDF buttons are hidden there) */
        '<div class="ug-wmore an-xdd"><button class="an-xbtn"' + A('toggle-more') + ' aria-haspopup="menu" aria-label="Export">' + I('download', 17) + '</button>' +
          '<div class="an-xpanel" data-more-panel hidden role="menu">' +
            '<button role="menuitem"' + A('export-analytics') + '>' + I('doc', 15) + '<span><b>PDF report</b><small>Ready to print or share</small></span></button>' +
            '<button role="menuitem"' + A('analytics-export-csv') + '>' + I('download', 15) + '<span><b>CSV data</b><small>For Excel or Sheets</small></span></button>' +
          '</div></div>') +
      /* the range bar sits on top so every figure below follows it. The
         presets fill From / To; editing either date applies a custom range. */
      '<section class="an-card an-pad an-range"><div class="an-range-h"><div><h3>Show data for</h3>' +
          '<p class="an-sum">' + esc(brgyFilter === 'All' ? (isLGU ? 'All barangays' : 'Your barangay') : 'Barangay ' + brgyFilter) + ' · ' + fmtD(fromD) + ' to ' + fmtD(toD) + ' · ' + days + ' day' + (days === 1 ? '' : 's') + ', compared with the ' + days + ' days before</p></div><div>' +
          '<button class="an-ghost"' + A('analytics-export-csv') + '>' + I('download', 14) + 'CSV</button>' +
          '<button class="an-solid"' + A('export-analytics') + '>' + I('doc', 14) + 'PDF</button></div></div>' +
        '<div class="an-range-r"><div class="an-seg" role="radiogroup" aria-label="Quick ranges">' + [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days']].map((r) =>
            '<button role="radio" aria-checked="' + (range === r[0]) + '" class="' + (range === r[0] ? 'is-on' : '') + '"' + A('an-range', attr({ v: r[0] })) + '>' + r[1] + '</button>').join('') + '</div>' +
          '<div class="an-dates' + (range === 'custom' ? ' is-on' : '') + '" role="group" aria-label="Custom range">' +
            '<label><span>From</span><input type="date" data-field="anFrom" value="' + isoD(fromD) + '" max="' + isoD(toD) + '" aria-label="From date"></label>' +
            '<i aria-hidden="true">' + I('chevron', 13) + '</i>' +
            '<label><span>To</span><input type="date" data-field="anTo" value="' + isoD(toD) + '" min="' + isoD(fromD) + '" max="' + isoD(new Date()) + '" aria-label="To date"></label>' +
          '</div>' +
          (isLGU ? '<select class="an-sel" data-field="anBrgyFilter" aria-label="Barangay">' + brgyOpts + '</select>' : '') +
        '</div></section>' +
      '<div class="an-kpis">' +
        kpi('Reports this week', String(week || 0), (weekDelta >= 0 ? '+' : '') + (weekDelta || 0) + '% vs previous week', 'inbox', '', 'incidents') +
        kpi('Verified share', pct(verified, inc.length) + '%', verified + ' of ' + inc.length + ' reports verified', 'shield', '', null) +
        kpi('Open reports', String(openCount), overThresholdCount ? overThresholdCount + ' waiting over 30 min' : 'None waiting over 30 min', 'alert', overThresholdCount ? 'warn' : 'ok', 'incidents') +
        kpi('Shelters at capacity', String(fullShelters.length), openShelters.length + ' open of ' + cen.length, 'shelter', fullShelters.length ? 'warn' : '', 'centers') +
      '</div>' +
      '<div class="an-pair">' +
      card('Reports per day', 'Last 14 days', '<div class="an-pad">' + chart + '</div>',
        '<div class="an-ch-r"><select class="an-sel" data-field="rw.anHaz" aria-label="Hazard">' +
          '<option value="All">All hazards</option>' + UG_HAZARDS.LIST.map((h) => '<option value="' + esc(h.key) + '"' + (hz === h.key ? ' selected' : '') + '>' + esc(h.label) + '</option>').join('') + '</select></div>') +
      card('How fast reports are handled', 'Average over the selected range', '<div class="an-split">' +
          '<div><span>Until a team is sent</span><b>' + (an.avgDispatchSeconds != null ? fmtDur(an.avgDispatchSeconds) : '<em>None dispatched yet</em>') + '</b></div>' +
          '<div><span>Until it is resolved</span><b>' + (an.avgResolveSeconds != null ? fmtDur(an.avgResolveSeconds) : '<em>None resolved yet</em>') + '</b></div></div>' +
        '<p class="an-foot">A long wait before a team is sent usually means the queue needs another duty officer.</p>', '', 'clock') +
      '</div>' +
      '<div class="an-tabs" role="tablist" aria-label="Analytics sections">' + TABS.map((t) =>
        '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'is-on' : '') + '"' + A('an-tab', attr({ v: t[0] })) + '>' + I(t[2], 18) + '<span><b>' + t[1] + '</b><small>' + esc(t[3]) + '</small></span></button>').join('') + '</div>' +
      tabBody +
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
      /* new routes for the integrated features */
      case 'relief': return UG_RELIEF.mRelief(st);
      case 'relief-verify': return UG_RELIEF.mReliefVerify(st);
      case 'guides': return UG_GUIDES.mGuides(st);
      case 'faqs': return UG_FAQS.mFaqs(st);
      case 'roadwork': return UG_ROADWORK.mRoadwork(st);
      case 'map': return mMap(st);
      case 'sos': return UG_SOS.mSos(st);
      case 'settings': return (typeof UG_SETTINGS !== 'undefined') ? UG_SETTINGS.dSettings(st) : mHome(st);
      default: return mHome(st);
    }
  }

  /* the four category filter chips shared by the mobile screen and the console
     screen — same action, same look, so filters behave identically everywhere */
  function mapLayerChips(st) {
    const layers = st.mapLayers || { hazards: true, relief: true, centers: true, roadStatus: true };
    const toggle = (k, label, shape, color) =>
      '<button class="ug-chip' + (layers[k] ? ' is-on' : '') + '" aria-pressed="' + !!layers[k] + '" data-act="map-layer-toggle" data-layer="' + k + '">' +
        '<span class="swatch shape-' + shape + '" style="background:' + color + ';width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:6px;vertical-align:middle"></span>' +
        label + '</button>';
    return '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' +
      toggle('hazards', 'Hazards', 'octagon', 'var(--ug-emergency)') +
      toggle('relief', 'Relief', 'square', '#8B5CF6') +
      toggle('centers', 'Shelters', 'square', 'var(--ug-shelter-open)') +
      toggle('roadStatus', 'Road status', 'diamond', 'var(--ug-warning)') +
    '</div>';
  }

  /* the dedicated Hazard Map screen: an interactive Leaflet map with
     toggleable layers (hazards, relief, evacuation centers, road status).
     The map itself is mounted by js/app.js's mountMaps() when this screen
     renders. */
  function mMap(st) {
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Live Operations Map</div>' +
      '<h2 style="font-size:18px;margin-top:3px">Hazard Map</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Hazards, relief centers, evacuation centers and road status. Toggle the layers off to focus on one. Tap any marker for details.</p></div>' +
      mapLayerChips(st) +
      '<div class="ug-card" style="padding:0;overflow:hidden">' +
        '<div class="ug-map" data-map="live" data-toggles="inline" style="height:clamp(300px,55vh,430px)">' + U.mapSVG({ animated: true }) + '</div>' +
      '</div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-warning);display:flex">' + I('info', 17) + '</span>' +
        '<div class="ug-note">If full routing is not available yet, the road-status markers let you route around a closure manually. A red X means the road is blocked; an amber ! means use caution.</div></div></div>' +
    '</div>';
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
    relief: ['Relief', 'Assistance Information'],
    'relief-verify': ['Authorized Beneficiary', 'Verify a Claimant'],
    guides: ['Preparedness', 'Disaster Guides'],
    faqs: ['Help Center', 'Frequently Asked Questions'],
    roadwork: ['Road Work', 'Active Posts & Road Status'],
    map: ['Hazard Map', 'Live Operations'],
    sos: ['SOS', 'One-Tap Emergency'],
    settings: ['Settings', 'Your preferences'],
  };

  function frameMobile(st){
    const t = MTITLES[st.route] || MTITLES.home;
    return '<div class="ug ug-frame ug-m' + (st.fixed ? ' ug-fixed' : '') + '"' +
      (st.fixed ? ' style="width:' + st.w + 'px;height:' + st.h + 'px"' : '') + '>' +
      '<div class="ug-m-shell">' +
        mAppbar(st, t[0], t[1]) +
        /* the real connectivity banner is #ug-conn (index.html); this in-frame
           strip is only a preview control in DEV builds */
        (st.offline && UG_CONFIG.DEV && st.route !== 'offline' ? '<div class="ug-offline">' + I('wifioff', 14) +
          '<span>Offline mode. Showing data saved ' + esc(U.DATA.offlineCache.synced) + '.</span>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('toggle-offline') + '>Preview: simulate offline</button></div>' : '') +
        '<div class="ug-m-body ug-scroll">' + mobileBody(st) + '</div>' +
        mTabbar(st) +
        /* the floating SOS button — persistent and easy to reach for any citizen
           on the mobile shell, except on the SOS screen itself. */
        UG_SOS.floatingButton(st) +
      '</div>' +
    '</div>';
  }

  const DTITLES = {
    dashboard: ['UniGuard Command Console', UG_GEO.PLACE.label],
    incidents: ['UniGuard Command Console', UG_GEO.PLACE.label],
    incident: ['UniGuard Command Console', UG_GEO.PLACE.label],
    command: ['UniGuard Command Console', UG_GEO.PLACE.label],
    advisories: ['UniGuard Command Console', UG_GEO.PLACE.label],
    centers: ['UniGuard Command Console', UG_GEO.PLACE.label],
    hotlines: ['UniGuard Command Console', UG_GEO.PLACE.label],
    analytics: ['UniGuard Command Console', UG_GEO.PLACE.label],
    notifications: ['UniGuard Command Console', UG_GEO.PLACE.label],
    offline: ['UniGuard Command Console', UG_GEO.PLACE.label],
    relief: ['UniGuard Command Console', UG_GEO.PLACE.label],
    roadwork: ['UniGuard Command Console', UG_GEO.PLACE.label],
    'response-team': ['Barangay Response Team', 'Incoming dispatches, roster, equipment and contacts for your barangay.'],
    'dispatch-units': ['Dispatch Units', 'BFP, PNP, Rescue and Hospital units · manage accounts, equipment and the support-request inbox.'],
    guides: ['UniGuard Command Console', UG_GEO.PLACE.label],
    faqs: ['UniGuard Command Console', UG_GEO.PLACE.label],
    sos: ['UniGuard Command Console', UG_GEO.PLACE.label],
    map: ['UniGuard Command Console', UG_GEO.PLACE.label],
    'others-review': ['UniGuard Command Console', UG_GEO.PLACE.label],
    settings: ['UniGuard Command Console', UG_GEO.PLACE.label],
  };

  function desktopBody(st){
    switch (st.route) {
      case 'dashboard': return dDashboard(st);
      case 'incidents': return dIncidents(st);
      case 'incident': return dIncident(st);
      case 'command': return dCommand(st);
      case 'advisories': return dAdvisories(st);
      /* a published advisory opened from the console (it used to fall through to the old dashboard) */
      case 'advisory-detail': return mAdvisoryDetail(st);
      case 'centers': return dCenters(st);
      case 'hotlines': return dHotlines(st);
      case 'analytics': return dAnalytics(st);
      case 'relief': return UG_RELIEF.dRelief(st);
      case 'relief-verify': return UG_RELIEF.mReliefVerify(st);
      case 'roadwork': return UG_ROADWORK.dRoadwork(st);
      case 'guides': return UG_GUIDES.dGuides(st);
      case 'faqs': return UG_FAQS.dFaqs(st);
      case 'sos': return UG_SOS.dSos(st);
      case 'map': return (function () {
        /* phones: the resident map layout (layers dropdown, zoom + locate on
           the map, "On the map" list, marker legend), tinted for the portal */
        const phone = !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
        st.mapPhone = phone;
        if (phone && typeof UG_RW !== 'undefined' && UG_RW.map) {
          return '<div class="ug-col bg-rmap" style="gap:14px">' + pageHead('Hazard Map', 'Live operations map with toggleable layers and road-status overlay.') + UG_RW.map(st) + '</div>';
        }
        return '<div class="ug-col" style="gap:18px">' + pageHead('Hazard Map', 'Live operations map with toggleable layers and road-status overlay.') +
          mapLayerChips(st) +
          '<div class="ug-card" style="padding:0;overflow:hidden"><div class="ug-map" data-map="live" data-toggles="inline" style="height:clamp(340px,56vh,620px)">' + U.mapSVG({ animated: true }) + '</div></div></div>';
      })();
      case 'others-review': return (function () {
        const rows = UG.DATA.othersReview || [];
        return '<div class="ug-col" style="gap:18px">' + pageHead('"Others" Hazard Review', 'Aggregated free-text from reports filed as "Others". Use it to spot new hazard categories worth promoting into the canonical list.',
          '<span class="ug-chip is-on">' + rows.length + ' entries</span>') +
          '<div class="ug-card" style="overflow:hidden">' + (rows.length
            ? '<table class="ug-table"><thead><tr><th>Description</th><th>Occurrences</th><th>Last seen</th></tr></thead><tbody>' +
                rows.map((r) => '<tr><td>' + esc(r.description) + '</td><td class="t-num">' + esc(r.occurrences) + '</td><td class="t-num">' + esc(UG_UTIL.absTime(r.latest_at) || r.latest_at) + '</td></tr>').join('') +
              '</tbody></table>'
            : '<div class="ug-empty"><span class="e-ico">' + I('help', 20) + '</span>' +
              '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No "Others" reports yet</div>' +
              '<div class="ug-dim" style="font-size:11px">When residents file a report with the "Others" hazard type and a free-text description, those entries aggregate here.</div></div>') + '</div></div>';
      })();
      case 'notifications': return (function(){ // reuse mobile inbox inside a desktop panel
        /* mNotifications already renders its own "Mark All Read" button + the
           inbox header, so the desktop wrapper must NOT add a second one. The
           old version had two identical buttons stacked — fixed. */
        return dNotifs(st);
      })();
      case 'response-team': return (typeof UG_ADMIN !== 'undefined' && UG_ADMIN.responseTeam) ? UG_ADMIN.responseTeam(st) : dDashboard(st);
      case 'dispatch-units': return (typeof UG_ADMIN !== 'undefined' && UG_ADMIN.dispatchUnits) ? UG_ADMIN.dispatchUnits(st) : dDashboard(st);
      case 'settings': return (typeof UG_SETTINGS !== 'undefined') ? UG_SETTINGS.dSettings(st) : dDashboard(st);
      case 'reporting': return (typeof UG_REPORTING !== 'undefined') ? UG_REPORTING.dReporting(st) : dDashboard(st);
      /* the same two-column Offline Readiness page residents get on a wide screen
         (the phone layout squeezed into one narrow column looked unfinished) */
      case 'offline': return (typeof UG_WEB !== 'undefined' && UG_WEB.cwOffline) ? UG_WEB.cwOffline(st)
        : '<div class="ug-col" style="gap:18px">' + pageHead('Offline sync', 'Progressive web app cache keeps essentials available when networks fail.') +
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
        /* #ug-conn is the one connectivity banner; this copy shows in DEV only */
        (st.offline && UG_CONFIG.DEV ? '<div class="ug-offline">' + I('wifioff', 14) + '<span>Working offline. Changes are queued and will sync automatically.</span></div>' : '') +
        (st.session && st.session.role === 'barangay_official' && !st.session.barangay_id
          ? U.note('nobrgy', st.session.id || 'x', 'alert', 'No barangay is assigned to your account yet', 'You cannot see any reports until one is set. Contact your LGU administrator.', { session: true })
          : '') +
        '<div class="ug-d-body ug-scroll">' + (typeof UG_SOS !== 'undefined' ? UG_SOS.activeStrip(st) : '') + desktopBody(st) + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

  function frame(st){
    /* remember the last state so feature modules that build buttons outside
       the rendering tree (actionChip in dCommand) can read session info without
       a parameter reshuffle. */
    U._lastSt = st;
    if (st.role === 'citizen') {
      /* the resident shell (js/screens.web.js) covers phones too: a bottom bar
         and section tabs replace the sidebar below 768px */
      return UG_WEB.frameCitizenWeb(Object.assign({}, st, { session: sess(st) }));
    }
    if (st.role === 'dispatch_team') {
      return (typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.frame)
        ? UG_DISPATCH.frame(Object.assign({}, st, { session: sess(st) }))
        : frameDesktop(Object.assign({}, st, { session: sess(st) }));
    }
    /* the Super Admin's home screen (js/screens.superadmin.js); every other
       route and role keeps the console below */
    if (typeof UG_SUPERADMIN !== 'undefined' && UG_SUPERADMIN.handles(st)) return UG_SUPERADMIN.frame(st);
    /* barangay officials and LGU staff: the staff portal's own frame and Home
       (js/barangay.js); every other section is the shared console screen */
    if ((st.role === 'barangay_official' || st.role === 'lgu_ldrrmc') && typeof UG_BRGY !== 'undefined') {
      return UG_BRGY.frame(Object.assign({}, st, { route: DESK(st.route), session: sess(st) }));
    }
    return frameDesktop(Object.assign({}, st, { route: DESK(st.route), session: sess(st) }));
  }

  /* map a shared route name onto a mobile / desktop route */
  const MOB = (r) => ({ notifications:'notifications', offline:'offline', advisories:'advisories', centers:'centers', hotlines:'hotlines', home:'home', report:'report', reports:'reports' })[r] || r;
  const DESK = (r) => ({ notifications:'notifications', offline:'offline', advisories:'advisories', centers:'centers', hotlines:'hotlines', dashboard:'dashboard', home:'dashboard', incidents:'incidents', analytics:'analytics' })[r] || r;

  return { login, frame, frameMobile, frameDesktop, mobileBody, desktopBody, MOB, DESK, sess, analyticsModel, RATE_HINTS, STAR_WORDS, notifRow,
    notifPanel, notifRows, notifFilter, notifItem, notifFilterMenu };
})();
