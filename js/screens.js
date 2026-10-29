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
      { id:'ADV-2026-060', title:'Suspension of Classes, All Levels',      severity:'warning',   type:'Emergency',     area:UG_GEO.PLACE.areaAll,               time:'1h ago',  body:'The Municipal Disaster Risk Reduction and Management Office has suspended classes at all levels for today. Parents are advised to keep children indoors and monitor official channels.' },
      { id:'ADV-2026-059', title:'Coastal Advisory: Storm Surge Watch',    severity:'advisory',  type:'Emergency',     area:'Coastal barangays',                time:'3h ago',  body:'A storm surge watch is in effect for barangays along Lingayen Gulf. Small sea vessels are prohibited from sailing. The seawall areas are closed until further notice.' },
      { id:'ADV-2026-058', title:'Preparedness Drill: Duck, Cover, Hold',  severity:'prepared',  type:'Preparedness',  area:UG_GEO.PLACE.areaAll,               time:'2d ago',  body:'A municipality-wide earthquake drill will run at 9:00 AM this Friday. Households, schools, and offices are encouraged to join and time their duck, cover, and hold practice.' },
      { id:'ADV-2026-057', title:'Go-Bag Checklist for the Wet Season',    severity:'prepared',  type:'Preparedness',  area:UG_GEO.PLACE.areaAll,               time:'4d ago',  body:'Keep a go-bag ready: three days of water and non-perishable food, flashlight, batteries, first-aid kit, whistle, copies of documents, and a power bank.' },
    ],
    centers: [
      { id:'EC-01', name:'Pangapisan North Multi-Purpose Center', brgy:'Pangapisan North', status:'open',   occ:118, cap:250, note:'Priority for coastal households', lat:16.0330, lng:120.2080, facilities:['Medical station','Kitchen','Generator','Pet-friendly area'], contact_person:'Brgy. Captain Office', contact_phone:'0917-408-2210' },
      { id:'EC-02', name:'Narciso Ramos Sports and Civic Center', brgy:'Poblacion',        status:'full',   occ:620, cap:620, note:'No remaining slots', lat:16.03192, lng:120.22529, facilities:['Cots','Generator','Medical station','Feeding area'], contact_person:'MDRRMO Shelter Desk', contact_phone:'(075) 632-2222' },
      { id:'EC-03', name:'Lingayen Central Elementary School',    brgy:'Poblacion',         status:'open',   occ:84,  cap:300, note:'Medical station on site', lat:16.0219, lng:120.2320, facilities:['Classrooms','Medical station','Water supply'], contact_person:'Principal\'s Office', contact_phone:'(075) 632-2333' },
      { id:'EC-04', name:'Domalandan West Barangay Hall',         brgy:'Domalandan West',   status:'closed', occ:0,   cap:90,  note:'Undergoing roof repair', lat:16.0083, lng:120.1823, facilities:['Function hall','Water supply'], contact_person:'Brgy. Captain', contact_phone:'0917-408-2240' },
      { id:'EC-05', name:'Pangasinan National High School',       brgy:'Poblacion',         status:'open',   occ:210, cap:400, note:'Pet-friendly area available', lat:16.031292, lng:120.230322, facilities:['Classrooms','Pet-friendly area','Cots','Generator'], contact_person:'School DRRM Coordinator', contact_phone:'(075) 632-2344' },
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
  function corrMeter(n){
    const pct = Math.min(100, Math.round(n / 3 * 100));
    const cls = n >= 3 ? 'var(--ug-prepared)' : 'var(--ug-warning)';
    return '<div class="ug-col ug-gap6" style="gap:6px">' +
      '<div class="ug-rowf ug-between" style="font-size:11.5px"><span class="ug-dimmer">Independent Corroborations</span>' +
      '<span class="ug-mono" style="color:' + cls + '">' + Math.min(n,3) + ' / 3</span></div>' +
      '<div style="height:5px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.09);overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + cls + ';border-radius:3px"></div></div>' +
      '<div class="ug-dimmer" style="font-size:10.5px">' + (n >= 3 ? 'Threshold reached. This report is auto-verified.' : (3 - n) + ' more nearby confirmation' + (3 - n === 1 ? '' : 's') + ' within 6 hours will auto-verify it.') + '</div>' +
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
      'font-family="IBM Plex Mono, monospace" font-size="10.5" ' +
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
      '<text x="16" y="'+(H-14)+'" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="#7E92AF">LINGAYEN GRID · WGS84 · ZOOM 12</text>' +
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

  return { ICONS, icon, DATA, SEV, STAGES, esc, badge, sevBadge, ladder, stageBadge, stat, thumb, photo, pipeline, corrMeter, mapSVG, mapLegend, brandMark, triadEmblem, shieldIcon };
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
    for (let i = 1; i <= 4; i++) grid += '<line x1="0" y1="' + H / 4 * i + '" x2="' + W + '" y2="' + H / 4 * i + '" style="stroke:rgba(var(--ug-tint, 255,255,255),.05)"/>';
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
          '<span style="font-family:var(--ug-display);font-weight:700;font-size:13px">' + esc(title) + '</span>' +
          '<span class="ug-dimmer" style="font-size:10px">' + esc(sub) + '</span>' +
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
        '<span class="ug-mono" style="font-size:17px;font-weight:600;color:' + tone + '">' + v + '</span>' +
        '<span class="ug-dimmer" style="font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;overflow-wrap:anywhere;line-height:1.3">' + l + '</span></div>';

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
              '<span class="ug-dimmer ug-mono" style="font-size:10px">' + esc(top.time) + '</span>' +
            '</div>' +
            '<h3 style="font-size:14.5px;line-height:1.3;margin-top:9px;font-weight:700">' + esc(top.title) + '</h3>' +
            '<div class="ug-dimmer ug-rowf" style="font-size:10.5px;gap:6px;margin-top:5px">' + I('pin', 12) + esc(top.area) + '</div>' +
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
        '<h2 style="font-size:19px;margin-top:3px">Hello, ' + esc(sess(st).name.split(' ')[0]) + '</h2></div>' +
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
            '<div class="ug-dimmer ug-mono" style="font-size:10.5px;margin-top:3px">' + esc(mine.id) + ' &middot; ' + esc(mine.time) + '</div>' +
            '<div class="ug-dim" style="font-size:11.5px;margin-top:5px;line-height:1.45">' + esc(mine.desc.slice(0, 74)) + '&hellip;</div></div>' +
          '</div>' + U.corrMeter(st.corr[mine.id] || mine.corr) +
        '</div>' +
      '</button>'
      ) : '') +
            (function () {
        const near = (U.DATA.incidents || []).filter(i => !i.mine && i.status !== 'resolved' && i.status !== 'rejected').slice(0, 3);
        return '<div class="ug-card"><div class="ug-card-h"><h3>Reported Near You</h3>' +
          '<span class="ug-dimmer" style="font-size:10.5px">Confirm if you see it too</span></div>' +
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
          [['map', 'map', 'Hazard Map'], ['advisories', 'megaphone', 'Advisories'], ['roadwork', 'road2', 'Road Work'],
 ['guides', 'guide', 'Guides'], ['faqs', 'faq', 'FAQs'], ['centers', 'shelter', 'Shelters']]
            .map(q => '<button class="ug-btn ug-btn--sm" style="width:100%"' + A('nav', attr({ route: q[0] })) + '>' + I(q[1], 15) + q[2] + '</button>').join('') +
        '</div>' +
      '</div>' +

      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:10.5px">' +
        I('download', 12) + 'Offline copy ready &middot; synced ' + esc(U.DATA.offlineCache.synced) + '</div>' +
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
            '<div class="ug-dimmer" style="font-size:10.5px">' + esc(UG_UTIL.bytes(r.photoBytes || 0)) + ' after compression</div></div>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('rm-photo') + '>Replace</button></div>'
          : '<button class="ug-upload" style="width:100%"' + A('add-photo') + '>' +
            '<span class="up-ico">' + I('camera', 22) + '</span>' +
            '<span style="font-size:13px;font-weight:600">Tap to Attach a Hazard Photo</span>' +
            '<span class="ug-dimmer" style="font-size:10.5px">JPG or PNG up to 10 MB, or capture with the camera</span></button>') +
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
          '<div class="ug-dimmer" style="font-size:10.5px;text-align:center;margin-top:-6px">Editing ' + esc(st.editing.code || '') + ' — the change is audit-logged and cannot change the status or barangay.</div>'
        : '<div class="ug-dimmer" style="font-size:10.5px;text-align:center;margin-top:-6px">Reports stay editable for 15 minutes after submission.</div>') +
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
      '<div><div class="ug-lab">Incident Status Tracking</div><h2 style="font-size:19px;margin-top:3px">My Reports</h2>' +
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
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No reports in this status</div>' +
        '<div class="ug-dim" style="font-size:11px">Switch the filter to see other reports.</div></div>') + '</div></div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:8px">' +
        '<div class="ug-lab">Status Legend</div>' +
        U.STAGES.map(s => '<div class="ug-rowf ug-gap8" style="gap:8px;font-size:11.5px"><span class="r-dot" style="background:' + s.color + ';margin:0"></span>' +
          '<span style="font-weight:600;color:' + s.color + '">' + s.label + '</span>' +
          '<span class="ug-dimmer" style="margin-left:auto;text-align:right">' + s.note + '</span></div>').join('') +
        '<div class="ug-rowf ug-gap8" style="gap:8px;font-size:11.5px"><span class="r-dot" style="background:' + UG_THEME.STATUS.rejected.color + ';margin:0"></span>' +
          '<span style="font-weight:600;color:' + UG_THEME.STATUS.rejected.color + '">' + esc(UG_THEME.STATUS.rejected.label) + '</span>' +
          '<span class="ug-dimmer" style="margin-left:auto;text-align:right">' + esc(UG_THEME.STATUS.rejected.note) + '</span></div>' +
      '</div></div>' +
    '</div>';
  }

  function mReportDetail(st){
    const id = st.openId;
    const i = U.DATA.incidents.find(x => x.id === id || x.uuid === id) || U.DATA.incidents[0];
    const corr = st.corr[i.id] != null ? st.corr[i.id] : i.corr;
    const auto = corr >= 3 && i.status === 'reported';
    const status = auto ? 'verified' : i.status;
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
    /* the timestamped history log: rebuilt from a small set of synthetic
       entries derived from the incident itself. When Repo.reportHistory
       returns server rows, the citizen UI passes them in UG.DATA.reportHistory
       keyed by the report id; if absent, the synthetic timeline still shows
       something coherent. */
    const historyRows = (UG.DATA.reportHistory && UG.DATA.reportHistory[i.uuid || i.id])
      ? UG.DATA.reportHistory[i.uuid || i.id]
      : syntheticHistory(i, status);
    const historyHtml = '<ul class="ug-history">' + historyRows.map((h) =>
      '<li><div class="h-t">' + esc(h.title) + '</div>' +
      '<div class="h-d">' + esc(h.detail) + '</div>' +
      '<div class="h-time">' + esc(h.time) + '</div></li>').join('') + '</ul>';

    return '<div class="ug-col" style="gap:14px">' +
      '<button class="ug-btn ug-btn--ghost ug-btn--sm" style="align-self:flex-start"' + A('nav', attr({ route: 'reports' })) + '>' +
        '<span style="transform:rotate(180deg);display:flex">' + I('chevron', 14) + '</span>Back</button>' +
      '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:12px">' +
        '<div class="ug-rowf ug-between" style="gap:8px">' + U.sevBadge(i.sev) + U.stageBadge(status) + '</div>' +
        '<h2 style="font-size:18px">' + esc(i.hazard) + '</h2>' +
        '<div class="ug-dimmer ug-mono" style="font-size:11px">' + esc(i.id) + ' &middot; ' + esc(i.time) + ' &middot; ' + esc(i.brgy) + '</div>' +
        U.photo(i, 'bn-img') +
        '<p class="ug-dim" style="font-size:12.5px;line-height:1.55">' + esc(i.desc) + '</p>' +
        (i.location_note ? '<div class="ug-dim" style="font-size:11.5px"><b>Exact address / landmark:</b> ' + esc(i.location_note) + '</div>' : '') +
        (i.mine && (Date.now() - (Date.parse(i.created_at || '') || 0)) <= 15 * 60000 && status === 'reported'
          ? '<button class="ug-btn ug-btn--sm" style="align-self:flex-start"' + A('start-edit-report', attr({ id: i.id })) + '>' + I('settings', 14) + 'Edit this report</button>'
          : (i.mine && status === 'reported' ? '<div class="ug-dimmer" style="font-size:10.5px">The 15-minute edit window has closed.</div>' : '')) +
      '</div></div>' +

      (auto ? '<div class="ug-card" style="border-color:rgba(47,208,138,.4)"><div class="ug-card-b ug-rowf ug-gap10" style="gap:10px;align-items:flex-start">' +
        '<span style="color:var(--ug-prepared);display:flex">' + I('check', 18) + '</span>' +
        '<div><div style="font-size:12.5px;font-weight:700;color:var(--ug-prepared)">Auto-Verified by Corroboration</div>' +
        '<div class="ug-dim" style="font-size:11.5px;margin-top:3px;line-height:1.5">Three independent residents reported the same hazard in the same barangay within the 6 hour window, so the report skipped manual approval.</div></div>' +
      '</div></div>' : '') +

      /* the glanceable tracker; if rejected, the pipeline renders a single red step */
      (status === 'rejected'
        ? '<div class="ug-card"><div class="ug-card-h"><h3>Status</h3>' + U.badge('rejected', 'Rejected') + '</div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' + U.pipeline('rejected') +
              '<div class="ug-dim" style="font-size:11.5px;line-height:1.55">This report was closed as not actionable or a duplicate. Contact your barangay desk if you think this was a mistake.</div></div></div>'
        : '<div class="ug-card"><div class="ug-card-h"><h3>Tracking</h3><span class="ug-dimmer" style="font-size:10.5px">Processing → Deployed → Resolved</span></div>' +
            '<div class="ug-card-b">' + tracker + U.pipeline(status) + '</div></div>') +
          dispatchRecords(i) +
          ratingCard(i, i.mine && i.status === 'resolved', st.rateDraft) +
      /* timestamped history log */
      '<div class="ug-card"><div class="ug-card-h"><h3>History</h3><span class="ug-dimmer ug-mono" style="font-size:10px">' + historyRows.length + ' entries</span></div>' +
        '<div class="ug-card-b">' + historyHtml + '</div></div>' +

      '<div class="ug-card"><div class="ug-card-h"><h3>Corroboration</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' + U.corrMeter(corr) +
          (i.mine
  ? '<div class="ug-note">You filed this report, so you cannot confirm it yourself. Other residents in your barangay can.</div>'
  : '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('confirm-corr', attr({ id: i.uuid || i.id })) + '>' + I('check', 15) + 'Confirm This Hazard Is Still There</button>') +
        '</div></div>' +

      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-between" style="gap:8px">' +
        '<div class="ug-dim" style="font-size:11.5px">Need help right now?</div>' +
        '<button class="ug-btn ug-btn--sm"' + A('nav', attr({ route: 'hotlines' })) + '>' + I('phone', 14) + 'Barangay Desk</button>' +
      '</div></div>' +
    '</div>';
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
      sent: 'Sent', acknowledged: 'Acknowledged', en_route: 'En route',
      on_scene: 'On scene', done: 'Done', declined: 'Declined',
      under_control: 'Under control', fire_out: 'Fire out',
      on_hold: 'On hold', resume: 'Resumed',
      transporting: 'Transporting', arrived_hospital: 'Arrived at hospital'
    })[s] || s || 'Sent';
    const clock = (v) => v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const mins = (a, b) => (a && b) ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null;
    const minsText = (n) => n == null ? '' : n < 60 ? n + ' min' : Math.floor(n / 60) + ' h ' + (n % 60) + ' min';
    return '<div class="ug-card"><div class="ug-card-h"><h3>Response Dispatch</h3>' +
      '<span class="ug-dimmer ug-mono" style="font-size:10px">' + list.length + (list.length === 1 ? ' TEAM' : ' TEAMS') + '</span></div>' +
      '<div class="ug-card-b ug-col" style="gap:12px">' + list.map((r) => {
        const unit = units[r.unit_id];
        const who = unit ? unit.name : (r.team === 'Barangay Response Team' ? 'Barangay ' + (i.brgy || '') + ' Response Team' : '');
        const open = r.dispatch_status !== 'done' && r.dispatch_status !== 'declined';
        const steps = [['Dispatched', r.dispatched_at], ['Acknowledged', r.ack_at], ['En route', r.en_route_at],
                       ['On scene', r.on_scene_at], ['Done', r.done_at]].filter((x) => x[1]);
        const toScene = mins(r.dispatched_at, r.on_scene_at);
        const total = mins(r.dispatched_at, r.done_at);
        const sinceReport = mins(i.created_at, r.dispatched_at);
        const far = (open && r.last_lat != null) ? UG_UTIL.distanceM(r.last_lat, r.last_lng, i.lat, i.lng) : null;
        return '<div class="ug-col" style="gap:6px;padding-bottom:12px;border-bottom:1px solid var(--ug-line)">' +
          '<div class="ug-rowf ug-between" style="gap:8px;align-items:flex-start"><span style="font-size:13px;font-weight:700">' + I('truck', 14) + ' ' + esc(r.team) +
              (who ? '<span class="ug-dim" style="font-weight:600"> · ' + esc(who) + '</span>' : '') + '</span>' +
            '<span class="ug-rowf ug-gap6 ug-wrap" style="gap:6px;align-items:center;justify-content:flex-end">' +
              (r.auto_dispatched ? '<span class="ug-badge ug-badge--id">Auto</span>' : '') +
              '<span class="ug-badge ug-badge--' + (r.dispatch_status === 'declined' ? 'closed'
                : r.dispatch_status === 'on_hold' ? 'warning'
                : r.dispatch_status === 'done' ? 'prepared'
                : r.dispatch_status === 'fire_out' || r.dispatch_status === 'arrived_hospital' ? 'prepared'
                : 'dispatched') + '">' + esc(stepLabel(r.dispatch_status)) + '</span>' +
              (open ? '<span class="ug-badge ug-badge--dispatched">ETA ' + esc(clock(r.eta) || '—') + '</span>' : '') +
            '</span></div>' +
          (unit && unit.contact_number ? '<a class="ug-dim" style="font-size:11.5px" href="tel:' + esc(unit.contact_number.replace(/\s+/g, '')) + '">' + I('phone', 12) + ' ' + esc(unit.contact_number) + '</a>' : '') +
          '<div class="ug-dim" style="font-size:12px;line-height:1.5">' + esc(r.instructions) + '</div>' +
          (far != null
            ? '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:8px;align-items:center;font-size:11.5px">' +
                '<span style="font-weight:600;color:var(--ug-st-dispatched)">' + I('radar', 12) + ' ' + esc(UG_UTIL.fmtDistance(far)) + ' from the scene</span>' +
                '<span class="ug-dimmer">updated ' + esc(UG_UTIL.relTime({ created_at: r.last_loc_at })) + '</span>' +
                '<a class="ug-waze-btn" target="_blank" rel="noopener noreferrer" href="' + UG_GEO.wazeUrl(r.last_lat, r.last_lng) + '">' + I('route', 12) + ' Map</a>' +
              '</div>'
            : '') +
          '<div class="ug-rowf ug-wrap" style="gap:4px 10px;font-size:10.5px">' + steps.map((x) =>
            '<span class="ug-mono"><span class="ug-dimmer">' + esc(x[0]) + '</span> ' + esc(clock(x[1])) + '</span>').join('<span class="ug-dimmer">›</span>') + '</div>' +
          ((toScene != null || total != null || sinceReport != null)
            ? '<div class="ug-dimmer" style="font-size:10.5px">' + [
                sinceReport != null ? 'Sent ' + minsText(sinceReport) + ' after the report' : '',
                toScene != null ? 'on scene ' + minsText(toScene) + ' after dispatch' : '',
                total != null ? 'finished in ' + minsText(total) : ''
              ].filter(Boolean).join(' · ') + '</div>'
            : '') +
          (r.decline_reason ? '<div class="ug-dimmer" style="font-size:11px">Decline reason: ' + esc(r.decline_reason) + '</div>' : '') +
          (r.hold_reason ? '<div class="ug-dimmer" style="font-size:11px">Hold reason: ' + esc(r.hold_reason) + '</div>' : '') +
          '<div class="ug-dimmer ug-mono" style="font-size:10.5px">Dispatched by ' + esc(r.dispatched_by_name || '—') +
            ' · ' + esc(UG_UTIL.absTime(r.dispatched_at) || '') + '</div>' +
        '</div>';
      }).join('') + '</div></div>';
  }

  /* the reporter's 1-5 star rating of the response, once the report is
     resolved (rate_report, migration 057). Others see it read-only. */
  function ratingCard(i, canRate, draft) {
    const r = i.rating;
    if (!canRate && !r) return '';
    if (!canRate) {
      return '<div class="ug-card"><div class="ug-card-h"><h3>Resident Rating</h3>' +
        '<span class="ug-badge ug-badge--prepared">' + r.stars + ' / 5</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:6px">' +
          '<div class="ug-stars" aria-label="' + r.stars + ' of 5 stars">' + [1, 2, 3, 4, 5].map((n) =>
            '<span class="ug-star' + (n <= r.stars ? ' is-on' : '') + '">★</span>').join('') + '</div>' +
          (r.comment ? '<div class="ug-dim" style="font-size:12px;line-height:1.5">' + esc(r.comment) + '</div>' : '') +
          '<div class="ug-dimmer" style="font-size:10.5px">' + esc(UG_UTIL.absTime(r.created_at) || '') + '</div>' +
        '</div></div>';
    }
    const stars = (draft && draft.id === (i.uuid || i.id) && draft.stars) || (r ? r.stars : 0);
    return '<div class="ug-card"><div class="ug-card-h"><h3>' + (r ? 'Your Rating' : 'Rate the Response') + '</h3>' +
        (r ? '<span class="ug-badge ug-badge--prepared">Sent</span>' : '') + '</div>' +
      '<div class="ug-card-b ug-col" style="gap:10px">' +
        '<div class="ug-dim" style="font-size:12px;line-height:1.5">How well did the responders handle your report?</div>' +
        '<div class="ug-stars" role="radiogroup" aria-label="Rating">' + [1, 2, 3, 4, 5].map((n) =>
          '<button type="button" class="ug-star' + (n <= stars ? ' is-on' : '') + '" role="radio" aria-checked="' + (n === stars) + '" aria-label="' + n + ' star' + (n > 1 ? 's' : '') + '"' +
            A('rate-star', attr({ id: i.uuid || i.id, n: n })) + '>★</button>').join('') + '</div>' +
        '<textarea class="ug-ta" rows="2" data-rate-comment placeholder="Comment (optional)">' + esc(r ? r.comment : '') + '</textarea>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm" style="align-self:flex-start"' + A('rate-submit', attr({ id: i.uuid || i.id })) + '>' + I('check', 14) + (r ? 'Update rating' : 'Submit rating') + '</button>' +
      '</div></div>';
  }
  /* a small synthetic history when the live report_status_history is not
     available (offline, or the migration hasn't been applied). It still gives
     the citizen a coherent timeline of what happened to their report. */
  function syntheticHistory(i, currentStatus) {
    const stages = [
      { key: 'reported', label: 'Report received', detail: 'Your report was added to the ' + (i.brgy || 'barangay') + ' queue.' },
      { key: 'verified', label: 'Verified', detail: 'Confirmed by an official or by three independent corroborations.' },
      { key: 'dispatched', label: 'Response deployed', detail: 'A responder unit was dispatched.' },
      { key: 'resolved', label: 'Resolved', detail: 'The hazard has been cleared and the report closed.' }
    ];
    const order = stages.map((s) => s.key);
    const endIdx = order.indexOf(currentStatus);
    const rows = stages.slice(0, endIdx >= 0 ? endIdx + 1 : 1);
    /* stagger the times across the past so they read like a timeline */
    const now = Date.parse(i.created_at) || Date.now();
    return rows.map((s, k) => ({
      title: s.label,
      detail: s.detail,
      time: UG_UTIL.absTime(new Date(now + k * 18 * 60000).toISOString()) || UG_UTIL.relTime(i)
    }));
  }

  /* ---- advisories (feature 6 + 11) ---- */
  function mAdvisories(st){
    const f = st.sevFilter;
    const chips = [['all', 'All'], ['emergency', 'Emergency'], ['warning', 'Warning'], ['advisory', 'Advisory'], ['prepared', 'Preparedness']];
    const list = U.DATA.advisories.filter(a => f === 'all' || a.severity === f);
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">' + esc(T('advisories.compose')) + '</div><h2 style="font-size:19px;margin-top:3px">' + esc(T('title.advisories')) + '</h2></div>' +
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
    if (!a) return '<div class="ug-empty">Advisory not found.</div>';
    const steps = a.severity === 'prepared'
      ? ['Agree on a family meeting point and an out-of-town contact.', 'Prepare a go-bag with water, food, documents and a power bank.', 'Join the citywide drill and practise duck, cover and hold.']
      : ['Move to the nearest open evacuation centre if advised.', 'Avoid the affected roads and never cross moving flood water.', 'Bring water, medication, identification and a phone charger.', 'Keep monitoring official advisories for updates.'];
    const sev = (U.SEV[a.severity] || U.SEV.advisory);
    /* a tidy, section-grouped key/value block — looks more like an official
       bulletin than a wall of plain text. Replaces the old plain layout. */
    const kv = (k, v) => '<div class="ug-rowf ug-between" style="gap:12px;font-size:12.5px;padding:7px 0;border-bottom:1px solid var(--ug-line)"><span class="ug-dim">' + esc(k) + '</span><span style="text-align:right;font-weight:600;max-width:60%">' + esc(v || '—') + '</span></div>';
    const section = (title, body) => '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(title) + '</h3></div><div class="ug-card-b">' + body + '</div></div>';
    /* what to do now / how to prepare — render the same numbered list as before,
       just inside a proper card so it doesn't read as plain text. */
    const stepsHtml = steps.map((s, n) =>
      '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start;padding:7px 0">' +
      '<span class="ug-mono" style="font-size:10.5px;color:var(--ug-signal);width:16px;flex:none;padding-top:2px">0' + (n + 1) + '</span>' +
      '<span class="ug-dim" style="font-size:12.5px;line-height:1.5;flex:1">' + esc(s) + '</span></div>').join('');
    /* the delivery preference: push or in-app only. Falls back gracefully if
       the field is not on the existing advisory (older rows). */
    const deliveryLabel = (a.delivery_mode === 'in_app' || a.delivery_preference === 'in_app')
      ? T('advisories.delivery.inApp')
      : (a.delivery_mode === 'push' || a.delivery_preference === 'push' || !a.delivery_mode ? T('advisories.delivery.push') : '—');
    return '<div class="ug-col" style="gap:14px">' +
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
        kv('Advisory ID', a.id)) +
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
      '<div><div class="ug-lab">' + esc(T('title.centers')) + '</div><h2 style="font-size:19px;margin-top:3px">' + esc(T('nav.centers')) + '</h2></div>' +
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
        '</div></div>').join('') :
        '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('shelter', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No shelters match this filter</div>' +
        '<div class="ug-dim" style="font-size:11px">' + (scope === 'mine' && hasBrgy ? 'No shelters are listed in ' + esc(myBrgy) + ' yet. Switch to “All Shelters” to see the municipality-wide directory.' : 'Try a different status filter.') + '</div></div></div>') +
      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:10.5px">' + I('wifioff', 12) + 'This list is cached and works without a connection.</div>' +
    '</div>';
  }

  /* ---- hotlines (feature 8) ---- */
  function mHotlines(st){
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">' + esc(T('hotlines.title')) + '</div><h2 style="font-size:19px;margin-top:3px">' + esc(T('hotlines.title')) + '</h2>' +
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
    /* a small type-icon resolver so each notification shows the right glyph
       (hazard alert, relief update, report status, road work) instead of a
       generic bell. Falls back to the row's stored icon if the type is unknown. */
    const typeIcon = (n) => {
      if (n.type === 'report_status') return { icon: 'check', cls: 'tone-prepared' };
      if (n.type === 'road_work') return { icon: 'road2', cls: 'tone-warning' };
      if (n.type === 'sos') return { icon: 'alert', cls: 'tone-emergency' };
      if (n.type === 'relief') return { icon: 'relief', cls: 'tone-advisory' };
      const tone = n.tone || 'advisory';
      return { icon: n.icon || 'bell', cls: 'tone-' + tone };
    };
    return '<div class="ug-col" style="gap:14px">' +
      '<div class="ug-rowf ug-between" style="gap:8px"><div><div class="ug-lab">Push Notifications</div><h2 style="font-size:19px;margin-top:3px">Inbox</h2>' +
        (unread ? '<div class="ug-dimmer" style="font-size:11px;margin-top:4px">' + unread + ' unread</div>' : '') + '</div>' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('read-all') + '>' + I('check', 15) + 'Mark All Read</button></div>' +
      '<div class="ug-card"><div class="ug-rows">' + (rows.length ? rows.map(n => {
        const ti = typeIcon(n);
        /* the row is a button when it carries a deep-link target (advisory, report,
           road work or SOS id). Plain notifications still render as a row so the
           list reads consistently. */
        const target = n.advisory_id || n.report_id || n.road_work_id || n.sos_id;
        const open = target ? A('open-notification', attr({ id: n.id, advisory: n.advisory_id || '', report: n.report_id || '', roadWork: n.road_work_id || '', sos: n.sos_id || '' })) : '';
        const tag = target ? 'button' : 'div';
        return '<' + tag + ' class="ug-row' + (n.unread ? ' is-unread' : '') + '"' +
          (target ? ' style="width:100%;text-align:left;background:none;border:0;cursor:pointer"' : '') + open + '>' +
          '<span class="ug-notif-icon ' + ti.cls + '">' + I(ti.icon, 16) + '</span>' +
          '<div class="r-main"><div class="r-t">' + esc(n.title) +
            (n.unread ? '<span class="ug-badge ug-badge--id" style="font-size:9px;margin-left:6px">NEW</span>' : '') + '</div>' +
            '<div class="ug-dim" style="font-size:11.5px;margin-top:4px;line-height:1.5">' + esc(n.body) + '</div>' +
            '<div class="r-m"><span>' + I('clock', 12) + esc(n.time) + '</span></div></div>' +
          (target ? '<span class="ug-dimmer" style="display:flex;align-self:center">' + I('chevron', 17) + '</span>' : '') +
        '</' + tag + '>';
      }).join('') : '<div class="ug-empty"><span class="e-ico">' + I('bell', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No notifications yet</div>' +
        '<div class="ug-dim" style="font-size:11px">Advisories, report status changes and road work notices appear here.</div></div>') + '</div></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:7px;justify-content:center;color:var(--ug-ink-3);font-size:10.5px">' + I('bell', 12) + 'Alerts are delivered even when the app is closed. History persists on this device.</div>' +
      /* Enable push on this device — surfaces the subscribe flow so the
         push_subscriptions table actually gets a row, instead of the LGU
         seeing "no push devices registered yet" forever. */
      '<div class="ug-rowf ug-gap8" style="gap:8px;justify-content:center">' +
        '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('enable-push') + '>' + I('bell', 14) + 'Enable push alerts on this device</button>' +
      '</div>' +
    '</div>';
  }

  /* ---- offline (feature 9) ---- */
  function mOffline(st){
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Offline Access</div><h2 style="font-size:19px;margin-top:3px">Offline Readiness</h2></div>' +
      '<div class="ug-card ug-tick"><div class="ug-card-b ug-col" style="gap:12px;align-items:center;text-align:center">' +
        '<span style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:rgba(255,176,32,.14);color:var(--ug-warning);border:1px solid rgba(255,176,32,.3)">' + I('wifioff', 25) + '</span>' +
        '<h3 style="font-size:16px">' + (st.offline ? 'You Are Offline' : 'Offline Copy Ready') + '</h3>' +
        '<p class="ug-dim" style="font-size:12px;line-height:1.5;max-width:280px">' + esc(T('offline.subtitle')) + '</p>' +
      '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('offline.availableNoSignal')) + '</h3><span class="ug-dimmer ug-mono" style="font-size:10px">' + esc(T('offline.lastSaved')) + ' ' + esc(U.DATA.offlineCache.synced) + '</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:10px">' +
          [['Emergency Hotlines', U.DATA.offlineCache.hotlines, 'phone'], ['Evacuation Centers', U.DATA.offlineCache.centers, 'shelter'], ['Critical Advisories', U.DATA.offlineCache.advisories, 'megaphone']]
            .map(x => '<div class="ug-rowf ug-between" style="gap:10px"><span class="ug-rowf" style="gap:9px">' +
              '<span style="color:var(--ug-signal);display:flex">' + I(x[2], 16) + '</span>' +
              '<span style="font-size:12.5px">' + x[0] + '</span></span>' +
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
        '<div class="ug-dimmer" style="font-size:10.5px;line-height:1.5">' + esc(T('offline.reloadHelp')) + '</div>' +
      '</div></div>' +
    '</div>';
  }

  /* ================================================================== */
  /* DESKTOP (barangay / LGU console)                                    */
  /* ================================================================== */
  const DNAV = [
    ['dashboard', 'nav.home', 'home', null],
    ['incidents', 'nav.incidents', 'alert', '6'],
    ['advisories', 'nav.advisories', 'megaphone', '5'],
    ['relief', 'nav.relief', 'relief', null],
    ['centers', 'nav.centers', 'shelter', null],
    ['roadwork', 'nav.roadwork', 'road2', null],
    ['response-team', 'nav.response-team', 'shield', null, ['barangay_official']],
    ['dispatch-units', 'nav.dispatch-units', 'truck', null, ['lgu_ldrrmc']],
    ['guides', 'nav.guides', 'guide', null, ['lgu_ldrrmc']],
    ['faqs', 'nav.faqs', 'faq', null, ['lgu_ldrrmc']],
    ['sos', 'nav.sos', 'sos', null, ['lgu_ldrrmc']],
    ['hotlines', 'nav.hotlines', 'phone', null],
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
        '<span class="ug-col" style="gap:0"><span class="ug-wordmark" style="font-size:15.5px">Uni<em>Guard</em></span>' +
        '<span class="ug-dimmer" style="font-size:9px;letter-spacing:.1em;text-transform:uppercase">Command console</span></span></button>' +
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
          '<span class="ug-dimmer" style="font-size:10px">' + esc(role.title) + '</span></span></div>' +
        '<button class="ug-nav"' + A('logout') + '>' + I('logout', 18) + '<span>' + T('action.signout') + '</span></button>' +
        '<button class="ug-nav"' + A('force-refresh') + '>' + I('wave', 18) + '<span>' + T('settings.forceRefresh') + '</span></button>' +
        '<div class="ug-mono" style="font-size:9px;color:var(--ug-ink-3);padding:2px 9px 4px">build ' + esc((typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') + '</div>' +
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
        '<span style="font-family:var(--ug-display);font-weight:700;font-size:13.5px">' + esc(title) + '</span>' +
        '<span class="ug-dimmer" style="font-size:10.5px">' + esc(sub) + '</span></div>' +
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

  /* A visible strip that tells the duty officer whether the dashboard is
     showing live synced data, the last-known cached data, or the demo seed.
     Without this the dashboard reads like "plain text" because you cannot tell
     sample data from real data. */
  function syncStatusBanner(st) {
    const src = (typeof Repo !== 'undefined' && Repo.state) ? Repo.state.source : 'local';
    const hasSynced = !!(Repo.state && Repo.state.hasSynced);
    const lastSync = (Repo.state && Repo.state.lastSync) ? UG_UTIL.absTime(Repo.state.lastSync) : 'never';
    const lastError = (Repo.state && Repo.state.lastError) ? Repo.state.lastError : '';
    if (src === 'supabase') {
      return '<div class="ug-card ug-card--flat" style="border-left:3px solid var(--ug-prepared)">' +
        '<div class="ug-card-b ug-rowf ug-between" style="gap:10px;align-items:center">' +
          '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:center">' +
            '<span class="ug-chip is-on" style="background:rgba(52,214,160,.14);color:var(--ug-prepared)">' + I('wave', 13) + 'Live</span>' +
            '<span class="ug-dim" style="font-size:11.5px">Synced ' + esc(lastSync) + '</span>' +
          '</div>' +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('refresh-data') + '>' + I('download', 14) + 'Refresh data</button>' +
        '</div></div>';
    }
    /* offline or local: warn clearly that the dashboard is on cached/seed data */
    const isSeed = !hasSynced;
    const tone = isSeed ? 'var(--ug-warning)' : 'var(--ug-advisory)';
    const label = isSeed ? 'Showing sample data — not synced yet' : 'Offline — showing the last synced data';
    const detail = isSeed
      ? 'These are demo records. Tap Refresh data to pull the live incident queue from the server.'
      : (lastError ? esc(lastError) : 'The server could not be reached. Cached data is shown.') + ' · last sync ' + esc(lastSync);
    return '<div class="ug-card ug-card--flat" style="border-left:3px solid ' + tone + '">' +
      '<div class="ug-card-b ug-rowf ug-between ug-wrap" style="gap:10px;align-items:center">' +
        '<div class="ug-col" style="gap:4px;min-width:0">' +
          '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:center">' +
            '<span class="ug-chip" style="background:rgba(255,179,64,.14);color:' + tone + '">' + I('wifioff', 13) + esc(isSeed ? 'Demo' : 'Offline') + '</span>' +
            '<span style="font-size:12px;font-weight:600;color:' + tone + '">' + esc(label) + '</span>' +
          '</div>' +
          '<span class="ug-dim" style="font-size:11px;line-height:1.5">' + detail + '</span>' +
        '</div>' +
        '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('refresh-data') + '>' + I('wave', 14) + 'Refresh data</button>' +
      '</div></div>';
  }

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
      if (i.status === 'dispatched') return '<button class="ug-btn ug-btn--sm"' + A('advance', attr({ id: i.id })) + '>' + I('check', 14) + 'Resolve</button>';
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
                (i.is_severity_bypass ? '<span class="ug-badge ug-badge--emergency" style="font-size:9px">Life-safety</span>' : '<span class="ug-badge ug-badge--warning" style="font-size:9px">Stale</span>') +
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
      syncStatusBanner(st) +
      escalationBanner +
      '<div class="ug-dgrid4">' + U.DATA.kpis.map(U.stat).join('') + '</div>' +
      '<div class="ug-dgrid-main">' +
        '<div class="ug-card"><div class="ug-card-h" style="padding:14px 16px">' +
          '<div><h3>Live Operations Map</h3><span class="ug-dimmer" style="font-size:10.5px">Active incident perimeters and deployed units</span></div>' +
          '<div class="ug-rowf ug-gap8" style="gap:6px">' +
            '<span class="ug-chip is-on">' + I('radar', 13) + 'Realtime</span>' +
            '<button class="ug-chip' + (st.mapPanelOpen ? ' is-on' : '') + '" data-act="map-layers-panel" aria-expanded="' + !!st.mapPanelOpen + '">' + I('layers', 13) + 'Layers</button></div></div>' +
          '<div class="ug-map" data-map="live" data-toggles="chip" style="min-height:260px;flex:1">' + U.mapSVG({ animated: true }) +
            '<div class="map-scale">1 : 25 000</div></div></div>' +
        '<div class="ug-card ug-col" style="min-height:0"><div class="ug-card-h" style="padding:14px 16px">' +
          '<div><h3>Recent Incidents</h3><span class="ug-dimmer" style="font-size:10.5px">Tap a row for the full detail view</span></div>' +
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
              '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No recent incidents</div>' +
              '<div style="font-size:11px">New reports will appear here automatically.</div></div>') + '</div></div>' +
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
                '<div style="height:6px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden">' +
                '<div style="height:100%;width:' + Math.round(x[1] / max * 100) + '%;background:' + x[2] + '"></div></div></div>').join('');
            })() +
          '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Active Advisories</h3><span class="ug-chip is-on" style="font-size:10px">' + U.DATA.advisories.slice(0, 2).filter(a => a.severity !== 'prepared').length + ' live</span></div>' +
          '<div class="ug-rows">' + U.DATA.advisories.slice(0, 2).map(a =>
            '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-advisory', attr({ id: a.id })) + '><span class="r-dot" style="background:' + U.SEV[a.severity].color + '"></span>' +
              '<div class="r-main"><div class="r-t" style="font-size:12.5px">' + esc(a.title) + '</div>' +
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
              '<div><div style="font-size:12.5px;font-weight:700">' + esc(x[2]) + '</div>' +
              '<div class="ug-dimmer" style="font-size:11px">' + esc(x[3]) + '</div></div>' +
            '</div></button>').join('') +
      '</div>' +
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
    const escalatedHelp = f === 'escalated'
      ? '<div class="ug-card ug-card--flat" style="margin-top:8px"><div class="ug-card-b ug-note"><b>Escalated</b> &mdash; reports needing additional LGU intervention. Either stale (unverified > 30 min) or life-safety hazards (fire, power line, accident, landslide) that bypass the barangay queue. This is a separate flag from severity and from the Processing / Verified / Deployed / Resolved status.</div></div>'
      : '';
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
    const allInc = hf === 'All' ? inBrgy : inBrgy.filter(x => hazardKey(x) === hf);
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
        return '<span class="ug-badge ug-badge--emergency" style="font-size:9px">Life-safety</span>';
      if (i.is_stale && i.status === 'reported')
        return '<span class="ug-badge ug-badge--warning" style="font-size:9px">Stale</span>';
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
      if (i.status === 'dispatched') return '<button class="ug-btn ug-btn--sm"' + A('advance', attr({ id: i.id })) + '>Resolve</button>';
      if (i.status === 'rejected') return '<span class="ug-dimmer" style="font-size:11px;display:flex;align-items:center;gap:5px">' + I('x', 13) + 'Rejected</span>';
      return '<span class="ug-dimmer" style="font-size:11px;display:flex;align-items:center;gap:5px">' + I('check', 13) + 'Closed</span>';
    };
    const escalatedCount = allInc.filter((i) => i.escalates_to_lgu).length;
    /* barangay dropdown (LGU only): option text shows how many reports each
       barangay has, so the officer can see where the load is before filtering. */
    const brgyCounts = {};
    U.DATA.incidents.forEach(x => { brgyCounts[x.brgy] = (brgyCounts[x.brgy] || 0) + 1; });
    const brgyFilterUi = isLGUq
      ? '<label class="ug-rowf" style="gap:7px;align-items:center;font-size:11px;color:var(--ug-ink-3)">' + I('pin', 13) + 'Barangay' +
          '<select class="ug-sel" style="min-width:170px;padding:5px 8px;font-size:12px" data-field="incBrgyFilter" aria-label="Filter incidents by barangay">' +
            '<option value="All"' + (bf === 'All' ? ' selected' : '') + '>All barangays (' + U.DATA.incidents.length + ')</option>' +
            U.DATA.barangays.map(b => '<option value="' + esc(b) + '"' + (bf === b ? ' selected' : '') + '>' + esc(b) + ' (' + (brgyCounts[b] || 0) + ')</option>').join('') +
          '</select></label>' +
          (bf !== 'All' ? '<button class="ug-chip"' + A('inc-brgy-clear') + '>Clear</button>' : '')
      : '';
    const hazCounts = {};
    inBrgy.forEach(x => { const k = hazardKey(x); hazCounts[k] = (hazCounts[k] || 0) + 1; });
    const hazardFilterUi =
      '<label class="ug-rowf" style="gap:7px;align-items:center;font-size:11px;color:var(--ug-ink-3)">' + I('hazards', 13) + 'Hazard' +
        '<select class="ug-sel" style="min-width:190px;padding:5px 8px;font-size:12px" data-field="incHazardFilter" aria-label="Filter incidents by hazard type">' +
          '<option value="All"' + (hf === 'All' ? ' selected' : '') + '>All hazard types (' + inBrgy.length + ')</option>' +
          UG_HAZARDS.LIST.map(h => '<option value="' + esc(h.key) + '"' + (hf === h.key ? ' selected' : '') + '>' + esc(h.label) + ' (' + (hazCounts[h.key] || 0) + ')</option>').join('') +
        '</select></label>' +
        (hf !== 'All' ? '<button class="ug-chip"' + A('inc-hazard-clear') + '>Clear</button>' : '');
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.incidents'), 'Track every report through reported, verified, response dispatched and resolved.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm' + (priority ? ' is-active' : '') + '" style="' + (priority ? 'border-color:var(--ug-signal);color:var(--ug-signal)' : '') + '"' + A('sort-toggle') + '>' + I('sort', 15) + (priority ? 'Priority Sort: On' : 'Priority Sort') + '</button>' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('nav', attr({ route: 'command' })) + '>' + I('grid', 15) + 'Command View</button>') +
      (escalatedCount > 0 ? '<div class="ug-card ug-card--flat" style="border-left:3px solid var(--ug-emergency)"><div class="ug-card-b ug-col" style="gap:8px">' +
        '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:center"><span style="color:var(--ug-emergency);display:flex">' + I('alert', 16) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-emergency)">' + escalatedCount + ' report' + (escalatedCount === 1 ? '' : 's') + ' escalated to LGU</div></div>' +
        '<div class="ug-dim" style="font-size:11px;line-height:1.55"><b>Escalated</b> means a report needs additional LGU intervention — it is not the same as severity or the standard Processing / Verified / Deployed / Resolved status. A report is escalated when (a) it has remained unverified for more than 30 minutes (stale), or (b) it is a life-safety hazard (fire, power line, accident, landslide) that bypasses the barangay queue and goes straight to the LGU.</div>' +
      '</div></div>' : '') +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + chips.map(c =>
        '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('sev-filter', attr({ v: c[0] })) +
          (c[0] === 'escalated' ? ' title="Reports needing additional LGU intervention (stale > 30 min, or life-safety hazard). Not a status — a separate flag."' : '') + '>' + c[1] +
        '<span class="ug-mono" style="opacity:.7">' + (c[0] === 'all' ? allInc.length : c[0] === 'escalated' ? escalatedCount : allInc.filter(x => x.status === c[0]).length) + '</span></button>').join('') +
        '<span class="ug-rowf ug-wrap" style="margin-left:auto;gap:10px;align-items:center">' + hazardFilterUi + brgyFilterUi +
        '<span class="ug-dimmer" style="font-size:11px;display:flex;align-items:center;gap:6px">' + I('target', 13) + 'Scope: ' + esc(bf !== 'All' ? 'Barangay ' + bf : (sess(st).scope || '')) + '</span></span></div>' +
      escalatedHelp +
      '<div class="ug-card"><div class="ug-ticks" style="grid-template-columns:1.2fr 2.4fr 1.1fr 1fr .7fr 1.1fr .9fr;padding:11px 16px;font-size:10px">' +
        '<span>Status</span><span>Hazard / description</span><span>Barangay</span><span>Corroboration</span><span>Age</span><span>Severity</span><span style="text-align:right">Action</span>' +
      '</div>' + (list.length ? list.map(i =>
        '<div class="ug-trow" style="grid-template-columns:1.2fr 2.4fr 1.1fr 1fr .7fr 1.1fr .9fr">' +
          '<span class="ug-rowf ug-gap6" style="gap:6px;align-items:center">' + U.stageBadge(i.status) + escalationBadge(i) + '</span>' +
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
          '<div style="font-size:11px">' + (bf !== 'All' ? 'No matching reports in ' + esc(bf) + '. Change the status filter or choose another barangay.' : 'Change the status filter to see other reports.') + '</div></div>') + '</div>' +
    '</div>';
  }

  /* ---- incident detail (feature 4 + 5) ---- */
  function dIncident(st){
    const i = U.DATA.incidents.find(x => x.id === st.openId || x.uuid === st.openId) || U.DATA.incidents[0];
    const corr = st.corr[i.id] != null ? st.corr[i.id] : i.corr;
    const status = (corr >= 3 && i.status === 'reported') ? 'verified' : i.status;
    const corrRows = [];
    /* escalation badges for the detail header */
    const escBadges = (i.is_severity_bypass && i.status === 'reported'
        ? '<span class="ug-badge ug-badge--emergency" style="font-size:10px">Life-safety bypass</span>' : '') +
      (i.is_stale && i.status === 'reported'
        ? '<span class="ug-badge ug-badge--warning" style="font-size:10px">Stale: not yet verified by barangay</span>' : '');
    /* who verified this report, if anyone has */
    const verifiedByLine = (status === 'verified' || status === 'dispatched' || status === 'resolved')
      ? (i.verified_by_role === 'lgu_ldrrmc'
          ? '<div class="ug-rowf ug-gap6" style="gap:6px;align-items:center;font-size:11px;color:var(--ug-signal)">' + I('shield', 13) + 'LGU-verified by ' + esc(i.verified_by_name || 'MDRRMO') + (i.verified_at ? ' · ' + esc(UG_UTIL.absTime(i.verified_at)) : '') + '</div>'
          : i.verified_by_role === 'barangay_official'
            ? '<div class="ug-rowf ug-gap6" style="gap:6px;align-items:center;font-size:11px;color:var(--ug-prepared)">' + I('check', 13) + 'Verified by ' + esc(i.verified_by_name || 'barangay official') + (i.verified_at ? ' · ' + esc(UG_UTIL.absTime(i.verified_at)) : '') + '</div>'
            : '')
      : '';
    const isLGU = st.session && st.session.role === 'lgu_ldrrmc';
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
          (isSuperAdminSession(st) ? (
              (status !== 'resolved' && status !== 'rejected'
                ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('reject', attr({ id: i.id })) + '>' + I('x', 15) + 'Reject</button>'
                : '')
            ) :
            (status !== 'resolved' && status !== 'rejected' ? (
              /* LDRRMO staff verify through the LGU verification (one button,
                 not "Advance Status" plus a second "LGU-Verify") */
              isLGU && status === 'reported'
                ? '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('lgu-verify', attr({ id: i.id })) + ' title="Verified by the LDRRMO; an optional note is kept in the activity log">' + I('shield', 15) + 'Verify Report</button>'
                : '<button class="ug-btn ug-btn--sm ug-btn--signal"' + A('advance', attr({ id: i.id })) + '>' + I('check', 15) + (status === 'verified' ? 'Dispatch Response' : 'Advance Status') + '</button>') +
          /* verified but not sent (auto-verified by residents, or no unit was
             free): one tap sends the hazard's teams (migration 057) */
          (status === 'verified' && (UG_HAZARDS.suggestedTeams(i.hazard_type).length || i.sev === 'emergency')
            ? '<button class="ug-btn ug-btn--sm"' + A('auto-dispatch', attr({ id: i.uuid || i.id })) + '>' + I('truck', 15) + 'Auto-dispatch</button>' : '') +
          (status === 'dispatched' ? '<button class="ug-btn ug-btn--sm"' + A('incident-add-team', attr({ id: i.id })) + '>' + I('truck', 15) + 'Add Team</button>' : '') +

          '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('reject', attr({ id: i.id })) + '>' + I('x', 15) + 'Reject</button>' : '')
          ) +
        '</div>' +
      '</div>' +
      '<div class="ug-dgrid-detail">' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Field Evidence</h3><span class="ug-dimmer ug-mono" style="font-size:10px">' + esc(i.id) + '_ev.jpg</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' + (i.thumb ? U.photo(i, 'bn-img', 'height:110px') : '') +
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
          dispatchRecords(i) +
          ratingCard(i, false) +
          '<div class="ug-card"><div class="ug-card-h"><h3>Crowd Corroboration</h3>' + U.badge(corr >= 3 ? 'resolved' : 'warning', corr + ' of 3') + '</div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' + U.corrMeter(corr) +
              corrRows.map((n, k) =>
              '<div class="ug-rowf ug-gap10" style="gap:9px"><span class="ug-av" style="width:26px;height:26px;font-size:10px">' + esc(n.split(' ').map(w => w[0]).join('')) + '</span>' +
                '<span style="font-size:12px">' + esc(n) + '</span>' +
                '<span class="ug-dimmer ug-mono" style="font-size:10px;margin-left:auto">' + (k + 1) + 'm ago</span></div>').join('') +
              '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('confirm-corr', attr({ id: i.uuid || i.id })) + '>' + I('plus', 14) + 'Log Corroboration</button>' +
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
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.advisories'), 'Publish official broadcasts by barangay. Pick an alert type, set the alert level, apply a template, then publish.',
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('nav', attr({ route: 'analytics' })) + '>' + I('eye', 15) + T('dashboard.analytics') + '</button>') +
      '<div class="ug-dgrid-compose">' +
        '<div class="ug-card ug-tick"><div class="ug-card-h"><h3>' + T('advisories.compose') + '</h3>' +
          '<span class="ug-chip">' + I(st.offline ? 'wifioff' : 'bell', 13) + (st.offline ? T('state.offline') : (UG_CONFIG.VAPID_PUBLIC_KEY ? T('advisories.delivery.push') : T('advisories.delivery.inApp'))) + '</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:0">' +
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
            '<div class="ug-field"><label class="ug-lab">' + esc(T('advisories.advisoryTitle')) + '</label>' +
              '<input class="ug-in" data-field="advTitle" value="' + esc(d.title) + '" placeholder="e.g. Flood warning: Pangapisan North"></div>' +
            '<div class="ug-rowf ug-gap12" style="gap:12px">' +
              '<div class="ug-field" style="flex:1"><label class="ug-lab">' + esc(T('advisories.broadcastType')) + '</label>' +
                '<select class="ug-sel" data-field="advType" aria-label="' + esc(T('advisories.broadcastType')) + '">' +
                ['Emergency', 'Preparedness'].map(s => '<option' + (d.type === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
              '<div class="ug-field" style="flex:1"><label class="ug-lab">' + esc(T('advisories.affectedArea')) + '</label>' +
                '<select class="ug-sel" data-field="advArea" aria-label="' + esc(T('advisories.affectedArea')) + '">' +
                [UG_GEO.PLACE.areaAll].concat(U.DATA.barangays)
                  .map(s => '<option' + (d.area === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></div>' +
            '</div>' +
            /* language toggle + template picker row. The language decides which
               half of the template is loaded; English and Filipino are the only
               two (Pangasinense was removed per build spec). */
            '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px;margin-bottom:8px">' +
              '<span class="ug-dimmer" style="font-size:10.5px;align-self:center">' + esc(T('label.language')) + '</span>' +
              [['en',T('settings.english')],['fil',T('settings.filipino')]].map((l) =>
                '<button class="ug-chip' + (d.lang === l[0] ? ' is-on' : '') + '"' + A('adv-lang', attr({ v: l[0] })) + '>' + l[1] + '</button>').join('') +
              '<span style="flex:1"></span>' +
              '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('adv-use-template') + '>' + I('megaphone', 14) + esc(T('advisories.useTemplate')) + '</button>' +
            '</div>' +
            '<div class="ug-field"><label class="ug-lab">' + esc(T('advisories.message')) + '</label>' +
              '<textarea class="ug-ta" rows="4" data-field="advMsg" placeholder="' + esc(T('advisories.messageHint')) + '">' + esc(d.msg) + '</textarea>' +
              '<div class="ug-help">' + esc(T('advisories.messageHint')) + '</div></div>' +
            /* Delivery preference: Push (emergency) vs In-app only (informational).
               The DOCX asks for a choice — not every advisory is an emergency. */
            '<div class="ug-field"><label class="ug-lab">' + esc(T('label.deliveryMode')) + '</label>' +
              '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' +
                '<button class="ug-chip' + ((d.deliveryMode || 'push') === 'push' ? ' is-on' : '') + '"' + A('adv-delivery', attr({ v: 'push' })) + '>' + I('bell', 13) + esc(T('advisories.delivery.push')) + '</button>' +
                '<button class="ug-chip' + (d.deliveryMode === 'in_app' ? ' is-on' : '') + '"' + A('adv-delivery', attr({ v: 'in_app' })) + '>' + I('info', 13) + esc(T('advisories.delivery.inApp')) + '</button>' +
                '<div class="ug-help" style="flex:1;min-width:200px">' + esc(T('label.deliveryModeHint')) + '</div>' +
              '</div></div>' +
            '<div class="ug-rowf ug-gap8" style="gap:8px">' +
              '<button class="ug-btn ug-btn--signal' + (ready ? '' : ' is-disabled') + '"' + A('publish') + '>' + I('megaphone', 16) + esc(T('advisories.publishBroadcast')) + '</button>' +
              '<button class="ug-btn ug-btn--ghost"' + A('clear-draft') + '>' + esc(T('action.clear')) + '</button>' +
              /* If no devices are subscribed yet, surface the "Enable push"
                 button right where the LGU is looking, so they can subscribe
                 this browser before publishing. The reach count updates on
                 the next load after a successful subscription. */
              (U.DATA.subscribedDevices > 0
                ? '<span class="ug-dimmer" style="margin-left:auto;font-size:11px;display:flex;align-items:center;gap:6px">' + I('users', 13) + 'Reach ' + U.DATA.subscribedDevices + ' subscribed device' + (U.DATA.subscribedDevices === 1 ? '' : 's') + '</span>'
                : '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="margin-left:auto"' + A('enable-push') + '>' + I('bell', 14) + 'Enable push on this device</button>') +
            '</div>' +
          '</div></div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('advisories.preview')) + '</h3><span class="ug-dimmer" style="font-size:10.5px">' + (d.lang === 'fil' ? esc(T('settings.filipino')) : esc(T('settings.english'))) + ' · Lock Screen</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:10px">' +
              '<div class="ug-rowf ug-gap10" style="gap:10px;align-items:flex-start;background:rgba(var(--ug-tint, 255,255,255),.03);border:1px solid var(--ug-line);border-radius:10px;padding:11px">' +
                U.brandMark(26) +
                '<span class="ug-col" style="gap:2px;min-width:0"><span class="ug-rowf" style="gap:6px"><span style="font-size:11.5px;font-weight:700">UniGuard</span>' +
                '<span class="ug-dimmer ug-mono" style="font-size:9.5px">now</span></span>' +
                '<span style="font-size:12.5px;font-weight:600">' + esc(d.title || 'Advisory title appears here') + '</span>' +
                '<span class="ug-dim ug-clamp3" style="font-size:11.5px;line-height:1.45">' + esc(d.msg || 'Your message appears here as residents will see it.') + '</span></span>' +
              '</div>' +
              '<div class="ug-rowf ug-gap8" style="gap:6px">' + U.sevBadge(d.sev) + U.badge('id', d.type) +
                '<span class="ug-dimmer ug-rowf" style="font-size:10.5px;gap:4px;margin-left:auto">' + I('pin', 12) + esc(d.area) + '</span></div>' +
            '</div></div>' +
          '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('advisories.published')) + '</h3>' +
            '<span class="ug-chip is-on">' + U.DATA.advisories.filter(a => a.severity !== 'prepared').length + ' emergency</span></div>' +
            '<div class="ug-rows ug-scroll" style="max-height:330px">' + U.DATA.advisories.map(a =>
              '<button class="ug-row" style="width:100%;text-align:left;background:none;border-left:0;border-right:0;cursor:pointer"' + A('open-advisory', attr({ id: a.id })) + ' title="' + esc(T('advisories.publishedHint')) + '"><span class="r-dot" style="background:' + U.SEV[a.severity].color + '"></span>' +
                '<div class="r-main"><div class="r-t" style="font-size:12.5px">' + esc(a.title) + '</div>' +
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
    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Evacuation Center Management', 'Keep capacity, facilities and contact details accurate so residents arrive at a shelter with space and the right support. (Evacuee check-in is handled separately.)',
        statusChip('open', counts[0][1]) + statusChip('full', counts[1][1]) + statusChip('closed', counts[2][1])) +
      /* capacity summary strip — total capacity vs current occupancy across the
         scoped list, so the duty officer can see the municipality-wide headroom. */
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:center">' +
        '<div class="ug-rowf ug-gap8" style="gap:8px;align-items:center"><span style="color:var(--ug-shelter);display:flex">' + I('shelter', 17) + '</span>' +
          '<span class="ug-mono" style="font-size:15px;font-weight:600">' + totalOcc + ' / ' + totalCap + '</span>' +
          '<span class="ug-dimmer" style="font-size:11px">current occupancy</span></div>' +
        '<span style="width:1px;height:22px;background:var(--ug-line);margin:0 4px"></span>' +
        '<span class="ug-dim" style="font-size:11.5px">' + scoped.length + ' centers · ' + counts[0][1] + ' open · ' + counts[1][1] + ' full · ' + counts[2][1] + ' closed</span>' +
      '</div></div>' +
      /* scope toggle + status filter row, mirrors the citizen desktop screen.
         LGU sees "All Shelters" + "Municipality-wide"; an official gets a real
         "My Barangay (name)" toggle that narrows the list. */
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' +
        (isOfficial
          ? '<button class="ug-chip' + (scope === 'all' ? ' is-on' : '') + '"' + A('shelter-scope', attr({ v: 'all' })) + '>All Shelters</button>' +
            '<button class="ug-chip' + (scope === 'mine' ? ' is-on' : '') + '"' + A('shelter-scope', attr({ v: 'mine' })) + '>My Barangay (' + esc(myBrgy) + ')</button>'
          : '<button class="ug-chip is-on">All Shelters · Municipality-wide</button>') +
        '<span style="width:1px;height:22px;background:var(--ug-line);margin:0 4px"></span>' +
        [['all','All ('+scoped.length+')']].concat([['open','Open'],['full','Full'],['closed','Closed']].map((c,i) => [c[0], c[1]+' ('+counts[i][1]+')']))
          .map(c => '<button class="ug-chip' + (f === c[0] ? ' is-on' : '') + '"' + A('center-filter', attr({ v: c[0] })) + '>' + esc(c[1]) + '</button>').join('') +
      '</div>' +
      '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-gap8 ug-wrap" style="gap:8px;align-items:flex-end">' +
        '<div class="ug-field" style="margin:0;flex:1;min-width:240px"><label class="ug-lab">Search shelters</label>' +
          '<input class="ug-in" data-field="shelterSearch" value="' + esc(st.shelterSearch || '') + '" placeholder="Name, barangay, contact or note"></div>' +
        (st.shelterSearch ? '<button class="ug-btn ug-btn--sm ug-btn--ghost"' + A('shelter-clear-search') + '>Clear</button>' : '') +
      '</div></div>' +
      (list.length ? '<div class="ug-dgrid-centers">' + list.map(c => {
        const pct = c.cap ? Math.min(100, Math.round(c.occ / c.cap * 100)) : 0;
        const geoState = UG_GEO.classify(c.lat, c.lng);
        const facs = facChips(c);
        return '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:12px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><h3 style="font-size:13.5px">' + esc(c.name) + '</h3>' + U.badge(c.status, c.status.charAt(0).toUpperCase() + c.status.slice(1)) + '</div>' +
          '<div class="ug-dimmer ug-rowf ug-wrap" style="font-size:11px;gap:10px"><span class="ug-rowf" style="gap:4px">' + I('pin', 12) + esc(c.brgy) + '</span>' +
            (geoState === 'ok' ? '<span class="ug-rowf" style="gap:4px">' + I('map', 12) + esc(UG_GEO.fmt(c.lat, c.lng)) + '</span>' : '') + '</div>' +
          '<div class="ug-rowf ug-between" style="font-size:11.5px"><span class="ug-dim">Occupancy</span>' +
            '<span class="ug-mono">' + c.occ + ' / ' + c.cap + ' &middot; ' + pct + '%</span></div>' + occBar(c.occ, c.cap) +
                      '<div class="ug-rowf" style="gap:6px">' +
            [[-10, '−10'], [-1, '−1']].map(x => '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="flex:1"' + A('center-occ', attr({ id: c.id, d: x[0] })) + '>' + x[1] + '</button>').join('') +
            '<button class="ug-btn ug-btn--sm" style="flex:1.4"' + A('center-occ-set', attr({ id: c.id })) + '>Set count</button>' +
            [[1, '+1'], [10, '+10']].map(x => '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="flex:1"' + A('center-occ', attr({ id: c.id, d: x[0] })) + '>' + x[1] + '</button>').join('') +
          '</div>' +
          /* facilities chip row — only when the center has any on file. Renders
             as soft chips so they read as a secondary detail under occupancy. */
          (facs ? '<div class="ug-rowf ug-gap6 ug-wrap" style="gap:5px">' + facs + '</div>' : '') +
          /* contact person + phone, so a duty officer can call the shelter
             manager directly from the same card without opening the detail. */
          ((c.contact_person || c.contact_phone) ? '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:8px;font-size:11.5px">' +
            (c.contact_person ? '<span class="ug-rowf" style="gap:5px;color:var(--ug-ink-2)">' + I('users', 12) + esc(c.contact_person) + '</span>' : '') +
            (c.contact_phone ? '<button class="ug-rowf" style="gap:5px;background:none;border:0;cursor:pointer;color:var(--ug-signal);font-family:var(--ug-mono);font-size:11px;padding:0"' + A('call', attr({ num: c.contact_phone, agency: c.name })) + '>' + I('phone', 12) + esc(c.contact_phone) + '</button>' : '') +
          '</div>' : '') +
          (c.note ? '<div class="ug-dim" style="font-size:11.5px">' + esc(c.note) + '</div>' : '') +
          '<div class="ug-rowf ug-gap8" style="gap:6px">' +
            ['open', 'full', 'closed'].map(s => '<button class="ug-btn ug-btn--sm' + (c.status === s ? ' ug-btn--signal' : '') + '" style="flex:1"' +
              A('center-status', attr({ id: c.id, s: s })) + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>').join('') +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="flex:0 0 auto"' + A('center-edit', attr({ id: c.id })) + '>' + I('settings', 13) + '</button>' +
          '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:6px">' +
            '<button class="ug-btn ug-btn--sm" style="flex:1"' + A('center-detail', attr({ id: c.id })) + '>' + I('doc', 13) + 'Details</button>' +
            (geoState === 'ok'
              ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="flex:1"' + A('center-edit-location', attr({ id: c.id })) + '>' + I('pin', 13) + 'Edit Location</button>'
              : '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="flex:1"' + A('center-edit-location', attr({ id: c.id })) + '>' + I('pin', 13) + 'Set Location</button>') +
          '</div>' +
        '</div></div>';
      }).join('') + '</div>'
      : '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('shelter', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No shelters match this filter</div>' +
        '<div class="ug-dim" style="font-size:11px">' + (scope === 'mine' ? 'No shelters are listed in your barangay yet. Switch to “All Shelters” to see the municipality-wide directory.' : 'Try a different status filter.') + '</div></div></div>') +
      '<div class="ug-card"><div class="ug-card-h"><h3>Add Evacuation Center</h3><span class="ug-dimmer" style="font-size:10.5px">Appears to citizens immediately</span></div>' +
        '<div class="ug-card-b"><div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
          '<div class="ug-field" style="flex:2;min-width:220px;margin:0"><label class="ug-lab">Center Name</label><input class="ug-in" data-field="centerName" placeholder="e.g. Lingayen Central Elementary School"></div>' +
          '<div class="ug-field" style="flex:1;min-width:150px;margin:0"><label class="ug-lab">Barangay</label><select class="ug-sel" data-field="centerBarangay" aria-label="Barangay">' +
            U.DATA.barangays.map(b => '<option>' + esc(b) + '</option>').join('') + '</select></div>' +
          '<div class="ug-field" style="flex:0 0 130px;margin:0"><label class="ug-lab">Capacity</label><input class="ug-in" data-field="centerCapacity" placeholder="400" inputmode="numeric"></div>' +
          '<div class="ug-field" style="flex:0 0 130px;margin:0"><label class="ug-lab">Latitude</label><input class="ug-in" data-field="centerLat" placeholder="16.0206" inputmode="decimal"></div>' +
          '<div class="ug-field" style="flex:0 0 130px;margin:0"><label class="ug-lab">Longitude</label><input class="ug-in" data-field="centerLng" placeholder="120.2306" inputmode="decimal"></div>' +
          '<button class="ug-btn ug-btn--ghost"' + A('center-locate') + '>' + I('pin', 15) + 'Use My Location</button>' +
        '</div>' +
        /* facilities + contact person + contact phone are the Module D additions.
           Facilities are comma-separated on the form and stored as an array; the
           contact phone becomes a clickable call button on the card. */
        '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end;margin-top:12px">' +
          '<div class="ug-field" style="flex:2;min-width:220px;margin:0"><label class="ug-lab">Facilities</label><input class="ug-in" data-field="centerFacilities" placeholder="e.g. Medical station, Kitchen, Pet-friendly area, Generator"></div>' +
          '<div class="ug-field" style="flex:1;min-width:180px;margin:0"><label class="ug-lab">Contact person</label><input class="ug-in" data-field="centerContact" placeholder="e.g. Shelter Manager"></div>' +
          '<div class="ug-field" style="flex:1;min-width:160px;margin:0"><label class="ug-lab">Contact phone</label><input class="ug-in" data-field="centerPhone" placeholder="(075) 632-2222"></div>' +
          '<div class="ug-field" style="flex:2;min-width:220px;margin:0"><label class="ug-lab">Notes</label><input class="ug-in" data-field="centerNote" placeholder="e.g. Priority for coastal households"></div>' +
          '<button class="ug-btn ug-btn--signal"' + A('add-center') + '>' + I('plus', 15) + 'Add Center</button>' +
        '</div><div class="ug-help">Coordinates are optional but required for the Waze navigation button to appear. Example: ' + esc(UG_GEO.EXAMPLE) + '. Facilities become chips on the card so residents can see what the shelter offers at a glance.</div></div></div>' +
    '</div>';
  }

  /* ---- command view (focused operational layout) ----
     Live map + active incident list (Reported / Verified / Response Dispatched)
     + the status pipeline. Scope comes from the data layer: an official's
     session only receives their own barangay's rows. */
  function dCommand(st){
    const active = U.DATA.incidents.filter(i => i.status === 'reported' || i.status === 'verified' || i.status === 'dispatched');
    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('title.command'), 'Focused operational view: live map, open incidents and the pipeline. Scope: ' +  + esc(sess(st).scope || ''),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('nav', attr({ route: 'incidents' })) + '>' + I('x', 15) + 'Exit Command View</button>') +
      '<div class="ug-card" style="padding:0;overflow:hidden"><div class="ug-map" data-map="live" style="height:clamp(320px,52vh,480px)">' + U.mapSVG({ animated: true }) + '</div></div>' +
      '<div class="ug-dgrid-main">' +
        '<div class="ug-card ug-col" style="min-height:0"><div class="ug-card-h"><div><h3>Active Incidents</h3>' +
          '<span class="ug-dimmer" style="font-size:10.5px">Reported · Verified · Response Dispatched — tap to open</span></div>' +
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
            : '<div class="ug-empty"><span class="e-ico">' + I('check', 20) + '</span><div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">Nothing open in your scope</div></div>') + '</div></div>' +
        '<div class="ug-col" style="gap:18px">' +
          '<div class="ug-card"><div class="ug-card-h"><h3>Status Pipeline</h3></div><div class="ug-card-b ug-col" style="gap:12px">' +
            U.STAGES.concat([{ key: 'rejected', label: UG_THEME.STATUS.rejected.label, color: UG_THEME.STATUS.rejected.color }]).map(s => {
              const total = U.DATA.incidents.length;
              const n = U.DATA.incidents.filter(i => i.status === s.key).length;
              const pct = total ? Math.round(n / total * 100) : 0;
              return '<div class="ug-col" style="gap:6px"><div class="ug-rowf ug-between" style="font-size:11.5px">' +
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
       · LGU / Barangay Official: Call + "Request Change" button. No direct
         Edit / Delete. Submitting a request opens a form modal that captures
         the action (add / edit / delete), the current data, the proposed
         data, and a reason. The request goes to the Super Admin for review.
       · The Call functionality is preserved for everyone. */
  function dHotlines(st){
    const isSuper = !!(st.session && st.session.role === 'lgu_ldrrmc' && st.session.superAdmin);
    const isLgu = !!(st.session && st.session.role === 'lgu_ldrrmc');
    const isOfficial = !!(st.session && st.session.role === 'barangay_official');
    const canRequest = isLgu && !isSuper || isOfficial;
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
          '<div><div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">' + esc(T('hotlines.noPending')) + '</div>' +
          '<div class="ug-dim" style="font-size:11px">' + esc(T('hotlines.noPendingHint')) + '</div></div></div></div>')
      : '';

    /* pending count for the LGU's own submitted requests (so they can see
       what they're waiting on) */
    const myPending = canRequest ? (UG.DATA.changeRequests || []).filter((r) => r.requester_id === st.session.id && r.status === 'pending') : [];
    const myPendingSection = canRequest && myPending.length
      ? '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-col" style="gap:8px">' +
          '<div class="ug-rowf ug-between"><div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">Your pending requests</div>' +
            '<span class="ug-chip">' + myPending.length + '</span></div>' +
          myPending.slice(0, 5).map((r) => '<div class="ug-rowf ug-between" style="gap:8px;font-size:11.5px">' +
            '<span>' + esc(r.action) + ' · ' + esc((r.proposed_data && r.proposed_data.agency_name) || (r.current_data && r.current_data.agency_name) || '—') + '</span>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="open-change-request" data-id="' + esc(r.id) + '">View</button></div>').join('') +
        '</div></div>'
      : '';

    /* action buttons per hotline card depend on the role */
    const hotlineActions = (h) => {
      const call = '<a class="ug-btn ug-btn--sm" style="flex:1;text-decoration:none" href="tel:' + esc(String(h.number).replace(/[^\d+]/g, '')) + '">' + I('phone', 14) + esc(T('action.call')) + '</a>';
      if (isSuper) {
        /* four buttons: a 2 x 2 grid so none is cut off on a narrow card */
        return '<div class="ug-hl-acts">' + call +
          '<button class="ug-btn ug-btn--sm" data-act="open-hotline-detail" data-id="' + esc(h.id) + '">' + I('doc', 13) + esc(T('hotlines.viewDetails')) + '</button>' +
          '<button class="ug-btn ug-btn--sm" data-act="edit-hotline" data-id="' + esc(h.id) + '">' + I('settings', 13) + esc(T('action.edit')) + '</button>' +
          '<button class="ug-btn ug-btn--sm ug-btn--danger" data-act="delete-hotline" data-id="' + esc(h.id) + '">' + I('x', 13) + esc(T('action.delete')) + '</button>' +
          '</div>';
      }
      if (canRequest) {
        return '<div class="ug-rowf ug-gap8" style="gap:6px">' + call +
          '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="request-hotline-edit" data-id="' + esc(h.id) + '">' + I('edit', 13) + esc(T('hotlines.requestChange')) + '</button>' +
          '</div>';
      }
      return '<div class="ug-rowf ug-gap8" style="gap:6px">' + call + '</div>';
    };

    /* Add hotline form — Super Admin gets a direct form; LGU/BO get a "Request
       a new hotline" button that opens the request modal */
    const addSection = isSuper
      ? '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('hotlines.addHotline')) + '</h3></div>' +
          '<div class="ug-card-b"><div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
            '<div class="ug-field" style="flex:2;min-width:200px;margin:0"><label class="ug-lab">' + esc(T('hotlines.agencyName')) + '</label><input class="ug-in" data-field="hotlineAgency" placeholder="e.g. Bureau of Fire Protection"></div>' +
            '<div class="ug-field" style="flex:1;min-width:160px;margin:0"><label class="ug-lab">' + esc(T('hotlines.contactNumber')) + '</label><input class="ug-in" data-field="hotlineNumber" placeholder="(075) 000-0000"></div>' +
            '<div class="ug-field" style="flex:1;min-width:160px;margin:0"><label class="ug-lab">' + esc(T('hotlines.scope')) + '</label><input class="ug-in" data-field="hotlineScope" placeholder="Fire and rescue"></div>' +
            '<button class="ug-btn ug-btn--signal"' + A('add-hotline') + '>' + I('plus', 15) + esc(T('action.add')) + '</button>' +
          '</div></div></div>'
      : canRequest
        ? '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-rowf ug-between" style="gap:12px;align-items:center">' +
            '<div><div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">' + esc(T('hotlines.pendingSub')) + '</div>' +
            '<div class="ug-dim" style="font-size:11px;line-height:1.5">' + esc(T('hotlines.callHint')) + '</div></div>' +
            '<button class="ug-btn ug-btn--signal" data-act="request-hotline-add">' + I('plus', 14) + esc(T('hotlines.requestNew')) + '</button>' +
          '</div></div>'
        : '';

    return '<div class="ug-col" style="gap:18px">' +
      pageHead(T('hotlines.title'), T('hotlines.subtitle'),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('export-hotlines') + '>' + I('download', 15) + esc(T('action.exportPdf')) + '</button>') +
      pendingSection +
      myPendingSection +
      '<div class="ug-dgrid-hotlines">' + U.DATA.hotlines.map(h =>
        '<div class="ug-card"><div class="ug-card-b ug-col" style="gap:10px">' +
          '<div class="ug-rowf ug-between" style="gap:8px"><span class="ug-lab">' + esc(h.type) + '</span>' + I('phone', 16) + '</div>' +
          '<h3 style="font-size:13.5px">' + esc(h.agency) + '</h3>' +
          '<a class="ug-mono" style="font-size:17px;color:var(--ug-signal);text-decoration:none" href="tel:' + esc(String(h.number).replace(/[^\d+]/g, '')) + '">' + esc(h.number) + '</a>' +
          '<div class="ug-dim" style="font-size:11.5px">' + esc(h.scope) + '</div>' +
          hotlineActions(h) +
        '</div></div>').join('') +
      '</div>' +
      addSection +
      (canRequest ? '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-note">You cannot directly edit or delete official hotlines. Use the <b>Request Change</b> button on any card or the <b>Request a new hotline</b> button above — your request goes to the Super Admin for approval. You will be notified when it is decided.</div></div>' : '') +
      (isSuper ? '<div class="ug-card ug-card--flat"><div class="ug-card-b ug-note">As the Super Admin, you can directly add, edit or delete official hotline records. Every change is recorded in the centralized Activity Log. LGU and Barangay Official submissions appear in the Pending Change Requests queue above.</div></div>' : '') +
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
    const an = U.DATA.analytics || {};
    const cnt = U.DATA.counts || {};
    const trendDaily = (an.daily && an.daily.length && typeof an.daily[0] === 'object') ? an.daily.map(d => d.total) : (an.daily || []);
    const trend = (trendDaily.length) ? trendDaily : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const fmtDur = (s) => s == null ? '—' : (s >= 3600 ? (s / 3600).toFixed(1) + ' h' : Math.round(s / 60) + ' min');
    const isLGU = st.session && st.session.role === 'lgu_ldrrmc';
    const brgyFilter = (isLGU && st.anBrgyFilter && st.anBrgyFilter !== 'All') ? st.anBrgyFilter : 'All';

    /* barangay-scoped incident list: applies the barangay filter to every
       card below so the whole page reflects the same selection. */
    const inc = (U.DATA.incidents || []).filter((i) => brgyFilter === 'All' || i.brgy === brgyFilter);
    const adv = (U.DATA.advisories || []);
    const cen = (U.DATA.centers || []);
    const relief = (U.DATA.relief || []);

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
    const dispatches = U.DATA.dispatches || {};
    Object.keys(dispatches).forEach((rid) => {
      const report = (U.DATA.incidents || []).find((i) => i.uuid === rid || i.id === rid);
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
    const distLog = U.DATA.distributionLog || [];
    const totalRecipients = distLog.length;

    /* previous-period comparison: last 7 days vs the 7 days before that */
    const week = (trendDaily.length >= 7) ? trendDaily.slice(-7).reduce((a, b) => a + b, 0) : 0;
    const prev = (trendDaily.length >= 14) ? trendDaily.slice(0, 7).reduce((a, b) => a + b, 0) : 0;
    const weekDelta = prev ? Math.round(((week - prev) / prev) * 100) : 0;
    return { an, cnt, trendDaily, trend, fmtDur, isLGU, brgyFilter, inc, adv, cen, relief, byHaz, hazRows, byBrgy, brgyRows, stages, openCount, openIncidents, oldest, oldestAgeMin, staleThreshold, overThresholdCount, unitBuckets, dispatches, unitStats, perTeam, teamRows, verified, unverified, rejected, total, autoVerified, totalCap, totalOcc, fullShelters, openShelters, reliefPerBrgy, reliefRows, reliefPhases, distLog, totalRecipients, week, prev, weekDelta };
  }

  function dAnalytics(st){
    const { an, cnt, trendDaily, trend, fmtDur, isLGU, brgyFilter, inc, adv, cen, relief, byHaz, hazRows, byBrgy, brgyRows, stages, openCount, openIncidents, oldest, oldestAgeMin, staleThreshold, overThresholdCount, unitBuckets, dispatches, unitStats, perTeam, teamRows, verified, unverified, rejected, total, autoVerified, totalCap, totalOcc, fullShelters, openShelters, reliefPerBrgy, reliefRows, reliefPhases, distLog, totalRecipients, week, prev, weekDelta } = analyticsModel(st);

    /* barangay filter dropdown */
    const brgyOpts = ['All'].concat(U.DATA.barangays).map((b) =>
      '<option value="' + esc(b) + '"' + (brgyFilter === b ? ' selected' : '') + '>' + esc(b === 'All' ? 'All barangays' : b) + '</option>').join('');

    return '<div class="ug-col" style="gap:18px">' +
      pageHead('Analytics and Reporting', (isLGU ? 'Municipality-wide telemetry across hazards, response times, verification quality, shelters and relief.' : 'Barangay telemetry across hazards, response times, verification quality, shelters and relief. Scope is enforced by the database.'),
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="analytics-export-csv">' + I('download', 15) + 'Export CSV</button>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm" data-act="export-analytics">' + I('doc', 15) + 'Export PDF</button>') +
      syncStatusBanner(st) +
      /* unified filters: date range + barangay filter applies to every card */
      '<div class="ug-card"><div class="ug-card-b ug-rowf ug-gap12 ug-wrap" style="gap:12px;align-items:flex-end">' +
        '<div class="ug-field" style="margin:0"><label class="ug-lab">From</label><input class="ug-in" type="date" data-field="anFrom" value="' + esc(st.anFrom || '') + '"></div>' +
        '<div class="ug-field" style="margin:0"><label class="ug-lab">To</label><input class="ug-in" type="date" data-field="anTo" value="' + esc(st.anTo || '') + '"></div>' +
        (isLGU ? '<div class="ug-field" style="margin:0;min-width:180px"><label class="ug-lab">Barangay</label>' +
          '<select class="ug-sel" data-field="anBrgyFilter">' + brgyOpts + '</select></div>' : '') +
        '<button class="ug-btn ug-btn--sm"' + A('an-apply') + '>' + I('check', 14) + 'Apply range</button>' +
        '<span class="ug-dimmer" style="font-size:11px;margin-left:auto">Empty dates default to the last 30 days</span></div></div>' +
      /* top KPI strip — comparison with the previous period */
      '<div class="ug-dgrid4">' +
        U.stat({ label: 'Reports This Week', value: String(week || 0), delta: (weekDelta >= 0 ? '+' : '') + (weekDelta || 0) + '% vs previous week', dir: (weekDelta >= 0 ? 'up' : 'down'), tone: 'advisory', icon: 'inbox', nav: 'incidents' }) +
        U.stat({ label: 'Verified Share', value: (inc.length ? Math.round(verified / total * 100) : 0) + '%', delta: verified + ' of ' + inc.length + ' reports verified', dir: 'flat', tone: 'resolved', icon: 'shield' }) +
        U.stat({ label: 'Open Reports', value: String(openCount), delta: overThresholdCount + ' over 30 min unverified', dir: 'flat', tone: 'warning', icon: 'alert', nav: 'incidents' }) +
        U.stat({ label: 'Shelters at Capacity', value: String(fullShelters.length), delta: (cnt.openCenters || 0) + ' open of ' + (cnt.centers || 0), dir: 'flat', tone: 'warning', icon: 'shelter', nav: 'centers' }) +
      '</div>' +
      /* trend + response performance */
      '<div class="ug-dgrid3">' +
        '<div class="ug-card" style="grid-column:span 2"><div class="ug-card-h"><h3>Incident Trend, Last 14 Days</h3>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px"><span class="ug-dimmer ug-mono" style="font-size:10px">REPORTS PER DAY</span>' +
          '<span class="ug-chip is-on">' + I('wave', 13) + 'All hazards</span></div></div>' +
          '<div class="ug-card-b">' + trendSVG(trend) +
            '<div class="ug-rowf ug-between ug-mt8" style="font-size:10px;color:var(--ug-ink-3);padding-left:36px;padding-right:2px">' +
              '<span>13 days ago</span><span>10 days ago</span><span>7 days ago</span><span>4 days ago</span><span>Today</span></div>' +
            '<div class="ug-dim" style="font-size:11px;margin-top:8px">Daily report volume over the last two weeks — a spike usually reaches the queue before the first official advisory does.</div></div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>Response Performance</h3><span class="ug-dimmer ug-mono" style="font-size:10px">SELECTED RANGE</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:12px">' +
            '<div><div class="ug-mono" style="font-size:22px;font-weight:700;color:var(--ug-signal)">' + fmtDur(an.avgDispatchSeconds) + '</div>' +
            '<div class="ug-dimmer" style="font-size:10.5px">average report &rarr; Response Dispatched</div></div>' +
            '<div><div class="ug-mono" style="font-size:22px;font-weight:700;color:var(--ug-prepared)">' + fmtDur(an.avgResolveSeconds) + '</div>' +
            '<div class="ug-dimmer" style="font-size:10.5px">average report &rarr; Resolved</div></div>' +
            (function () {
              /* team timing from the GPS-stamped dispatches (migration 057)
                 and the residents' ratings, over the reports in range */
              const ids = new Set(inc.map((i) => i.uuid));
              const disp = [].concat.apply([], Object.keys(U.DATA.dispatches || {}).filter((k) => ids.has(k)).map((k) => U.DATA.dispatches[k]));
              const scene = disp.filter((d) => d.on_scene_at && d.dispatched_at)
                .map((d) => (Date.parse(d.on_scene_at) - Date.parse(d.dispatched_at)) / 1000);
              const rated = inc.filter((i) => i.rating);
              const avgScene = scene.length ? scene.reduce((a, b) => a + b, 0) / scene.length : null;
              const avgStars = rated.length ? rated.reduce((a, i) => a + i.rating.stars, 0) / rated.length : null;
              return '<div><div class="ug-mono" style="font-size:22px;font-weight:700;color:var(--ug-st-dispatched)">' + (avgScene != null ? fmtDur(avgScene) : '—') + '</div>' +
                '<div class="ug-dimmer" style="font-size:10.5px">average dispatch &rarr; team on scene (' + scene.length + ' arrivals)</div></div>' +
                '<div><div class="ug-mono" style="font-size:22px;font-weight:700;color:#B45309">' + (avgStars != null ? avgStars.toFixed(1) + ' / 5' : '—') + '</div>' +
                '<div class="ug-dimmer" style="font-size:10.5px">average resident rating (' + rated.length + ' rated)</div></div>';
            })() +
            '<div class="ug-dim" style="font-size:11px;line-height:1.55">How fast reports in the range moved through the pipeline. A long dispatch time usually means the queue needs another duty officer.</div>' +
          '</div></div>' +
      '</div>' +
      /* A. hazard type distribution — full list, including Others */
      '<div class="ug-dgrid2">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>A · Reports by Hazard Type</h3><span class="ug-dimmer ug-mono" style="font-size:10px">' + hazRows.length + ' CATEGORIES</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:12px">' +
            (hazRows.length ? hazRows.map(x => '<div class="ug-col" style="gap:6px"><div class="ug-rowf ug-between" style="font-size:11.5px">' +
              '<button class="ug-rowf ug-gap6" style="gap:6px;background:transparent;border:0;cursor:pointer;color:inherit;padding:0;font:inherit" data-act="sev-filter" data-v="all" title="Open these reports">' +
                '<span style="color:' + x[2] + ';display:flex">' + I('alert', 12) + '</span>' +
                '<span style="color:var(--ug-ink);font-weight:600">' + esc(x[0]) + '</span></button>' +
              '<span class="ug-mono">' + x[1] + '</span></div>' +
              '<div style="height:6px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden"><div style="height:100%;width:' + Math.round(x[1] / Math.max(hazRows[0][1], 1) * 100) + '%;background:' + x[2] + '"></div></div></div>').join('')
              : '<div class="ug-dim" style="font-size:12px">No reports recorded yet.</div>') +
            '<div class="ug-dim" style="font-size:11px;line-height:1.55">Includes "Others". Tap a row label to filter the incident queue by hazard.</div>' +
          '</div></div>' +
        /* B. barangay comparison */
        '<div class="ug-card"><div class="ug-card-h"><h3>B · Reports by Barangay</h3>' +
          '<span class="ug-dimmer ug-mono" style="font-size:10px">' + brgyRows.length + ' BARANGAYS</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:9px">' +
            ((brgyRows.length) ? brgyRows.slice(0, 10).map(b =>
              '<div class="ug-col" style="gap:5px"><button class="ug-rowf ug-between" style="gap:8px;font-size:11.5px;background:transparent;border:0;cursor:pointer;color:inherit;padding:0;font:inherit;text-align:left" data-act="sev-filter" data-v="all" title="Open ' + esc(b.brgy) + ' reports">' +
                '<span>' + esc(b.brgy || '—') + '</span><span class="ug-mono">' + b.total + ' reports</span></button>' +
                '<div style="height:6px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden"><div style="height:100%;width:' + Math.min(100, b.total * 4) + '%;background:var(--ug-signal)"></div></div></div>').join('')
              : '<div class="ug-dim" style="font-size:12px">No incidents in the selected range.</div>') +
            '<div class="ug-dim" style="font-size:11px">' + (isLGU ? 'Municipality-wide comparison across all barangays.' : 'Your barangay only — the scope is enforced server side.') + '</div>' +
          '</div></div>' +
      '</div>' +
      /* C. status breakdown — clickable counts */
      '<div class="ug-card"><div class="ug-card-h"><h3>C · Report Status Breakdown</h3>' +
        '<span class="ug-chip is-on">' + inc.length + ' total in scope</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:14px">' +
          '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px">' +
            '<button class="ug-card ug-stat-card" style="cursor:pointer;text-align:left" data-act="sev-filter" data-v="reported"><div class="ug-card-b ug-col" style="gap:4px"><span class="ug-lab">Processing</span><span class="ug-mono" style="font-size:22px;font-weight:600;color:var(--ug-warning)">' + stages.reported + '</span></div></button>' +
            '<button class="ug-card ug-stat-card" style="cursor:pointer;text-align:left" data-act="sev-filter" data-v="dispatched"><div class="ug-card-b ug-col" style="gap:4px"><span class="ug-lab">Deployed</span><span class="ug-mono" style="font-size:22px;font-weight:600;color:var(--ug-st-dispatched)">' + stages.dispatched + '</span></div></button>' +
            '<button class="ug-card ug-stat-card" style="cursor:pointer;text-align:left" data-act="sev-filter" data-v="resolved"><div class="ug-card-b ug-col" style="gap:4px"><span class="ug-lab">Resolved</span><span class="ug-mono" style="font-size:22px;font-weight:600;color:var(--ug-prepared)">' + stages.resolved + '</span></div></button>' +
            '<button class="ug-card ug-stat-card" style="cursor:pointer;text-align:left" data-act="sev-filter" data-v="rejected"><div class="ug-card-b ug-col" style="gap:4px"><span class="ug-lab">Rejected</span><span class="ug-mono" style="font-size:22px;font-weight:600;color:var(--ug-emergency)">' + stages.rejected + '</span></div></button>' +
          '</div>' +
          '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;font-size:12px">' +
            '<span class="ug-rowf ug-gap6" style="gap:6px"><span class="ug-dim">Open (unresolved)</span>' +
              '<button class="ug-mono" style="background:transparent;border:0;cursor:pointer;color:var(--ug-warning);font:inherit;font-weight:600" data-act="sev-filter" data-v="all">' + openCount + '</button></span>' +
            '<span class="ug-rowf ug-gap6" style="gap:6px"><span class="ug-dim">Oldest unresolved</span>' +
              '<span class="ug-mono" style="color:' + (oldestAgeMin > staleThreshold ? 'var(--ug-emergency)' : 'var(--ug-ink-2)') + '">' + (oldestAgeMin > 0 ? oldestAgeMin + ' min ago' : '—') + '</span></span>' +
            '<span class="ug-rowf ug-gap6" style="gap:6px"><span class="ug-dim">Beyond 30 min threshold</span>' +
              '<span class="ug-mono" style="color:' + (overThresholdCount > 0 ? 'var(--ug-emergency)' : 'var(--ug-prepared)') + '">' + overThresholdCount + '</span></span>' +
          '</div>' +
          (oldest ? '<button class="ug-btn ug-btn--sm ug-btn--ghost" style="align-self:flex-start" data-act="open-incident" data-id="' + esc(oldest.id) + '">' + I('alert', 13) + 'Open the oldest unresolved report</button>' : '') +
        '</div></div>' +
      /* D + E. response time by unit + dispatch workload */
      '<div class="ug-dgrid2">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>D · Response Time by Unit</h3>' +
          '<span class="ug-dimmer ug-mono" style="font-size:10px">FROM ACTUAL DISPATCH TIMESTAMPS</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:14px">' +
            unitStats.map((u) => '<div class="ug-col" style="gap:5px">' +
              '<div class="ug-rowf ug-between" style="font-size:11.5px"><span style="color:var(--ug-ink-2);font-weight:600">' + esc(u.unit) + '</span><span class="ug-dim">' + u.count + ' dispatch' + (u.count === 1 ? '' : 'es') + '</span></div>' +
              '<div class="ug-rowf ug-between" style="font-size:11px"><span class="ug-dim">avg</span><span class="ug-mono" style="color:var(--ug-signal)">' + fmtDur(u.avg) + '</span></div>' +
              '<div class="ug-rowf ug-between" style="font-size:11px"><span class="ug-dim">slowest</span><span class="ug-mono" style="color:var(--ug-warning)">' + fmtDur(u.slowest) + '</span></div>' +
            '</div>').join('') +
            '<div class="ug-dim" style="font-size:11px;line-height:1.55">Average and slowest time from report submission to dispatch, bucketed by unit type (BFP / PNP / Rescue / Hospital). Computed from actual dispatch timestamps in the database.</div>' +
          '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>E · Dispatch Workload</h3>' +
          '<span class="ug-dimmer ug-mono" style="font-size:10px">' + teamRows.length + ' TEAMS</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:9px">' +
            (teamRows.length ? teamRows.slice(0, 8).map((t) => '<div class="ug-col" style="gap:5px"><div class="ug-rowf ug-between" style="font-size:11.5px">' +
              '<span>' + esc(t.team) + '</span><span class="ug-mono">' + t.count + ' dispatch' + (t.count === 1 ? '' : 'es') + '</span></div>' +
              '<div style="height:6px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden"><div style="height:100%;width:' + Math.min(100, t.count / Math.max(teamRows[0].count, 1) * 100) + '%;background:var(--ug-st-dispatched)"></div></div></div>').join('')
              : '<div class="ug-dim" style="font-size:12px">No dispatches recorded yet.</div>') +
            /* unit support request acknowledgement time — gap closure from the
               previous audit. unit_requests.decided_at exists in the schema
               (migration 038); we compute avg ack time for decided requests. */
            (function () {
              const reqs = (U.DATA.unitRequests || []).filter((r) => r.created_at && r.decided_at);
              if (!reqs.length) return '<div class="ug-hr" style="margin:8px 0"></div><div class="ug-dim" style="font-size:11px">No decided support requests yet.</div>';
              const acks = reqs.map((r) => (Date.parse(r.decided_at) - Date.parse(r.created_at)) / 1000);
              const avgAck = acks.reduce((a, b) => a + b, 0) / acks.length;
              const slowestAck = acks.reduce((a, b) => Math.max(a, b), 0);
              const fmtDur = (s) => s == null ? '—' : (s >= 3600 ? (s / 3600).toFixed(1) + ' h' : Math.round(s / 60) + ' min');
              return '<div class="ug-hr" style="margin:10px 0"></div>' +
                '<div class="ug-lab">Support request acknowledgement</div>' +
                '<div class="ug-rowf ug-between" style="font-size:11.5px;margin-top:4px"><span class="ug-dim">average</span><span class="ug-mono" style="color:var(--ug-signal)">' + fmtDur(avgAck) + '</span></div>' +
                '<div class="ug-rowf ug-between" style="font-size:11.5px"><span class="ug-dim">slowest</span><span class="ug-mono" style="color:var(--ug-warning)">' + fmtDur(slowestAck) + '</span></div>' +
                '<div class="ug-rowf ug-between" style="font-size:11.5px"><span class="ug-dim">decided / pending</span><span class="ug-mono">' + reqs.length + ' / ' + ((U.DATA.unitRequests || []).length - reqs.length) + '</span></div>';
            })() +
            '<div class="ug-dim" style="font-size:11px;line-height:1.55;margin-top:6px">Number of dispatches per team, plus acknowledgement time for unit support requests (created_at → decided_at). Use this to balance load between units when one is clearly over-assigned or slow to respond.</div>' +
          '</div></div>' +
      '</div>' +
      /* F + G. verification quality + shelter occupancy */
      '<div class="ug-dgrid2">' +
        '<div class="ug-card"><div class="ug-card-h"><h3>F · Verification Quality</h3>' +
          '<span class="ug-dim" style="font-size:10.5px">Monitoring only · no verify controls</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:14px">' +
            '<div class="ug-rowf ug-gap16" style="gap:16px">' +
              '<div><div class="ug-mono" style="font-size:30px;font-weight:700;color:var(--ug-prepared)">' + verified + '</div><div class="ug-dimmer" style="font-size:10.5px">verified (incl. dispatched / resolved)</div></div>' +
              '<div><div class="ug-mono" style="font-size:30px;font-weight:700;color:var(--ug-warning)">' + unverified + '</div><div class="ug-dimmer" style="font-size:10.5px">still unverified</div></div>' +
              '<div><div class="ug-mono" style="font-size:30px;font-weight:700;color:var(--ug-emergency)">' + rejected + '</div><div class="ug-dimmer" style="font-size:10.5px">rejected / duplicate</div></div>' +
            '</div>' +
            '<div class="ug-hr"></div>' +
            '<div class="ug-rowf ug-between" style="font-size:11.5px"><span class="ug-dim">Auto-verified by corroboration (≥ 3)</span>' +
              '<span class="ug-mono" style="color:var(--ug-prepared)">' + autoVerified + '</span></div>' +
            '<div class="ug-dim" style="font-size:11.5px;line-height:1.6">Verification is performed by Barangay Officials and LDRRMO staff. The Super Admin monitors quality here but does not have verify permissions.</div>' +
          '</div></div>' +
        '<div class="ug-card"><div class="ug-card-h"><h3>G · Shelter Occupancy</h3>' +
          '<span class="ug-dim" style="font-size:10.5px">' + openShelters.length + ' open · ' + fullShelters.length + ' at capacity</span></div>' +
          '<div class="ug-card-b ug-col" style="gap:14px">' +
            '<div><div class="ug-mono" style="font-size:30px;font-weight:700;color:var(--ug-prepared)">' + totalOcc + ' / ' + totalCap + '</div>' +
              '<div class="ug-dimmer" style="font-size:10.5px">current occupancy / total capacity</div></div>' +
            '<div style="height:8px;border-radius:4px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden"><div style="height:100%;width:' + Math.min(100, totalCap ? Math.round(totalOcc / totalCap * 100) : 0) + '%;background:' + (totalCap && totalOcc / totalCap >= 0.85 ? 'var(--ug-warning)' : 'var(--ug-prepared)') + '"></div></div>' +
            (fullShelters.length ? '<div class="ug-col" style="gap:6px;margin-top:8px"><div class="ug-lab">At capacity</div>' + fullShelters.slice(0, 5).map((c) =>
              '<button class="ug-rowf ug-between" style="gap:8px;font-size:11px;background:transparent;border:0;cursor:pointer;color:inherit;padding:3px 0;font:inherit;text-align:left;width:100%" data-act="center-detail" data-id="' + esc(c.uuid || c.id) + '"><span>' + esc(c.name) + '</span><span class="ug-mono" style="color:var(--ug-warning)">' + c.occ + '/' + c.cap + '</span></button>').join('') + '</div>' : '') +
          '</div></div>' +
      '</div>' +
      /* H. relief goods distribution */
      '<div class="ug-card"><div class="ug-card-h"><h3>H · Relief Goods Distribution</h3>' +
        '<span class="ug-dim" style="font-size:10.5px">' + totalRecipients + ' recipients · ' + reliefRows.length + ' barangays</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:14px">' +
          '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px">' +
            '<div class="ug-card ug-stat-card" style="flex:1;min-width:140px"><div class="ug-card-b ug-col" style="gap:4px"><span class="ug-lab">To be distributed</span>' +
              '<span class="ug-mono" style="font-size:22px;font-weight:600;color:var(--ug-warning)">' + reliefPhases.to_distribute + '</span></div></div>' +
            '<div class="ug-card ug-stat-card" style="flex:1;min-width:140px"><div class="ug-card-b ug-col" style="gap:4px"><span class="ug-lab">During distribution</span>' +
              '<span class="ug-mono" style="font-size:22px;font-weight:600;color:var(--ug-signal)">' + reliefPhases.during + '</span></div></div>' +
            '<div class="ug-card ug-stat-card" style="flex:1;min-width:140px"><div class="ug-card-b ug-col" style="gap:4px"><span class="ug-lab">Fully distributed</span>' +
              '<span class="ug-mono" style="font-size:22px;font-weight:600;color:var(--ug-prepared)">' + reliefPhases.fully + '</span></div></div>' +
          '</div>' +
          '<div class="ug-col" style="gap:6px"><div class="ug-lab">Per barangay</div>' +
            (reliefRows.length ? reliefRows.slice(0, 8).map((r) =>
              '<div class="ug-col" style="gap:5px"><div class="ug-rowf ug-between" style="font-size:11.5px"><span>' + esc(r.brgy) + '</span><span class="ug-mono">' + r.count + '</span></div>' +
              '<div style="height:6px;border-radius:3px;background:rgba(var(--ug-tint, 255,255,255),.07);overflow:hidden"><div style="height:100%;width:' + Math.min(100, r.count / Math.max(reliefRows[0].count, 1) * 100) + '%;background:var(--ug-prepared)"></div></div></div>').join('')
              : '<div class="ug-dim" style="font-size:12px">No distributions recorded.</div>') +
          '</div>' +
        '</div></div>' +
      /* Comparison with previous equivalent reporting period */
      '<div class="ug-card"><div class="ug-card-h"><h3>I · Period Comparison</h3>' +
        '<span class="ug-dim" style="font-size:10.5px">Last 7 days vs the 7 days before</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:14px">' +
          '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px;font-size:12px">' +
            '<span class="ug-rowf ug-gap6" style="gap:6px"><span class="ug-dim">This week</span><span class="ug-mono" style="color:var(--ug-signal);font-weight:600">' + week + '</span></span>' +
            '<span class="ug-rowf ug-gap6" style="gap:6px"><span class="ug-dim">Previous week</span><span class="ug-mono">' + prev + '</span></span>' +
            '<span class="ug-rowf ug-gap6" style="gap:6px"><span class="ug-dim">Delta</span><span class="ug-mono" style="color:' + (weekDelta >= 0 ? 'var(--ug-warning)' : 'var(--ug-prepared)') + ';font-weight:600">' + (weekDelta >= 0 ? '+' : '') + weekDelta + '%</span></span>' +
          '</div>' +
          '<div class="ug-dim" style="font-size:11px;line-height:1.55">A negative delta is good — fewer incidents this week than last. The barangay and date filters above apply to every card on this page.</div>' +
        '</div></div>' +
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
      '<h2 style="font-size:19px;margin-top:3px">Hazard Map</h2>' +
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
              '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No "Others" reports yet</div>' +
              '<div class="ug-dim" style="font-size:11px">When residents file a report with the "Others" hazard type and a free-text description, those entries aggregate here.</div></div>') + '</div></div>';
      })();
      case 'notifications': return (function(){ // reuse mobile inbox inside a desktop panel
        /* mNotifications already renders its own "Mark All Read" button + the
           inbox header, so the desktop wrapper must NOT add a second one. The
           old version had two identical buttons stacked — fixed. */
        return '<div class="ug-col" style="gap:18px">' + pageHead('Push notification log', 'Every alert delivered to citizen devices.') +
          '<div style="max-width:760px">' + mNotifications(st) + '</div></div>';
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
          ? '<div class="ug-offline">' + I('alert', 14) +
            '<span>No barangay is assigned to your account yet, so you cannot see any reports. Contact your LGU administrator.</span></div>'
          : '') +
        '<div class="ug-d-body ug-scroll">' + desktopBody(st) + '</div>' +
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
      if (st.view === 'desktop') return UG_WEB.frameCitizenWeb(Object.assign({}, st, { session: sess(st) }));
      return frameMobile(Object.assign({}, st, { route: MOB(st.route), session: sess(st) }));
    }
    if (st.role === 'dispatch_team') {
      return (typeof UG_DISPATCH !== 'undefined' && UG_DISPATCH.frame)
        ? UG_DISPATCH.frame(Object.assign({}, st, { session: sess(st) }))
        : frameDesktop(Object.assign({}, st, { session: sess(st) }));
    }
    /* the Super Admin's home screen (js/screens.superadmin.js); every other
       route and role keeps the console below */
    if (typeof UG_SUPERADMIN !== 'undefined' && UG_SUPERADMIN.handles(st)) return UG_SUPERADMIN.frame(st);
    return frameDesktop(Object.assign({}, st, { route: DESK(st.route), session: sess(st) }));
  }

  /* map a shared route name onto a mobile / desktop route */
  const MOB = (r) => ({ notifications:'notifications', offline:'offline', advisories:'advisories', centers:'centers', hotlines:'hotlines', home:'home', report:'report', reports:'reports' })[r] || r;
  const DESK = (r) => ({ notifications:'notifications', offline:'offline', advisories:'advisories', centers:'centers', hotlines:'hotlines', dashboard:'dashboard', home:'dashboard', incidents:'incidents', analytics:'analytics' })[r] || r;

  return { login, frame, frameMobile, frameDesktop, mobileBody, desktopBody, MOB, DESK, sess, analyticsModel };
})();
