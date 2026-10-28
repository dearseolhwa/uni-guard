/* UniGuard · System Settings & Message Templates
 *
 * Module D, E, F of the LDRRMO core all need configurable, reusable message
 * templates (evacuation orders, weather advisories, road closures) published in
 * English and Filipino. This module is the single place those templates are
 * managed, plus the rest of the system-wide settings (organisation profile,
 * notifications, offline/sync behaviour, language and display).
 *
 * The settings are persisted in localStorage so they survive reloads and work
 * fully offline — exactly the same pattern the nav preference already uses.
 * When a Supabase project is configured, Repo.saveSettings / loadSettings can
 * mirror them into an app_settings table; until then the local copy is the
 * source of truth and the UI never blocks.
 *
 * Roles: only `lgu_ldrrmc` may open Settings. Barangay officials read the
 * templates but cannot edit them, which the database enforces again via RLS.
 */
const UG_SETTINGS = (function () {
  const esc = UG_UTIL.esc, I = UG.icon, U = UG;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');
  /* safe bridges to the controller (app.js assigns these on boot). Modules
     cannot see app.js's lexical `toast` / `render`, so we reach them through
     window and fall back to no-ops if the controller is not ready. */
  const UGTOST = (msg, tone) => { try { (window.UG_TOAST || function () {})(msg, tone); } catch (e) {} };
  const RERENDER = () => { try { (window.APP_RENDER || function () {})(); } catch (e) {} };

  const STORE_KEY = 'uniguard.settings.v1';
  const PREFS_KEY = 'uniguard.prefs.v1';
  const TPL_KEY = 'uniguard.templates.v1';

  /* ------------------------------------------------------- message templates */
  /* The LDRRMO sends the same kinds of broadcasts every typhoon season. Instead
     of retyping them at 2am, the duty officer picks a template and the composer
     is pre-filled. Placeholders ({barangay}, {center}, {time}) are swapped by
     the advisory composer when a template is applied.

     Languages: English and Filipino only — Pangasinense was dropped per the
     build spec, because every resident the system currently serves reads one
     of the two, and maintaining a third translation doubles the editing work
     for the LDRRMO for no reach gain. */
  const DEFAULT_TEMPLATES = [
    {
      id: 'MT-001', category: 'evacuation_order', label: 'Evacuation Order — Flood',
      title_en: 'Evacuation Order: Move to Higher Ground',
      body_en: 'Flood waters are rising in {barangay}. Residents within 200 meters of the shoreline must move immediately to {center}. Bring your go-bag, medication and identification.',
      title_fil: 'Utos ng Paglikas: Lumikas sa Mataas na Lugar',
      body_fil: 'Tumataas ang baha sa {barangay}. Dapat lumikas kaagad ang mga residente sa loob ng 200 metro mula sa baybayin patungong {center}. Dalhin ang inyong go-bag, gamot at pagkakakilanlan.',
      placeholders: ['{barangay}', '{center}']
    },
    {
      id: 'MT-002', category: 'evacuation_order', label: 'Pre-emptive Evacuation — Storm Surge',
      title_en: 'Pre-emptive Evacuation: Storm Surge Warning',
      body_en: 'A storm surge is expected to hit {barangay} within the next few hours. Residents along the coast are ordered to move to {center} now. Do not wait for the water to reach your home.',
      title_fil: 'Pre-emptibong Paglikas: Babala sa Storm Surge',
      body_fil: 'Inaasahang tatama ang storm surge sa {barangay} sa loob ng ilang oras. Ini-uutos sa mga residente sa baybayin na lumikas na ngayon patungong {center}. Huwag nang hintayin na makarating ang tubig sa inyong tahanan.',
      placeholders: ['{barangay}', '{center}']
    },
    {
      id: 'MT-003', category: 'weather_advisory', label: 'Typhoon Public Advisory',
      title_en: 'Typhoon Advisory: {barangay}',
      body_en: 'Typhoon signal no. {signal} is raised over {barangay}. Expect strong winds and heavy rain. Secure loose items, charge devices, and stay indoors. Monitor official channels for updates.',
      title_fil: 'Advisory sa Bagyo: {barangay}',
      body_fil: 'Naka-angat ang signal ng bagyo blg. {signal} sa {barangay}. Asahin ang malakas na hangin at malakas na ulan. Tiyakin na nakakabit ang mga kalat-kalat na gamit, naka-charge ang mga device, at manatili sa loob ng bahay. Subaybayan ang opisyal na mga channel para sa mga update.',
      placeholders: ['{barangay}', '{signal}']
    },
    {
      id: 'MT-004', category: 'weather_advisory', label: 'Heavy Rainfall / Flood Watch',
      title_en: 'Heavy Rainfall Advisory',
      body_en: 'Moderate to heavy rainfall is affecting {barangay} and may cause flooding in low-lying areas. Residents near rivers and creeks are advised to prepare for possible evacuation.',
      title_fil: 'Advisory sa Malakas na Ulan',
      body_fil: 'Nakakaapekto ang katamtaman hanggang malakas na pag-ulan sa {barangay} at maaaring magdulot ng baha sa mababang lugar. Hinuhimok ang mga residente malapit sa ilog at sapa na maghanda para sa posibleng paglikas.',
      placeholders: ['{barangay}']
    },
    {
      id: 'MT-005', category: 'road_closure', label: 'Road Closure Notice',
      title_en: 'Road Closure: {road}',
      body_en: '{road} in {barangay} is closed until further notice due to {hazard}. Seek alternate routes. Do not attempt to pass through flooded or blocked sections.',
      title_fil: 'Pagkasara ng Kalsada: {road}',
      body_fil: 'Sara ang {road} sa {barangay} hanggang sa karagdagang paunawa dahil sa {hazard}. Gumamit ng ibang ruta. Huwag subukang dumaan sa mga bahagi na binaha o hinarang.',
      placeholders: ['{road}', '{barangay}', '{hazard}']
    },
    {
      id: 'MT-006', category: 'general', label: 'Class Suspension',
      title_en: 'Suspension of Classes, All Levels',
      body_en: 'Classes at all levels in {area} are suspended today due to inclement weather. Parents are advised to keep children indoors and monitor official channels.',
      title_fil: 'Pag-suspinde ng Klase, Lahat ng Antas',
      body_fil: 'Suspended ang klase sa lahat ng antas sa {area} ngayon dahil sa masamang panahon. Hinuhimok ang mga magulang na panatilihing nasa loob ng bahay ang mga bata at subaybayan ang opisyal na mga channel.',
      placeholders: ['{area}']
    },
    {
      id: 'MT-007', category: 'general', label: 'All Clear Notice',
      title_en: 'All Clear: Safe to Return',
      body_en: 'The hazard affecting {barangay} has passed. Residents may now return to their homes. Please continue to exercise caution and report any remaining damage through UniGuard.',
      title_fil: 'All Clear: Ligtas na ang Pagbabalik',
      body_fil: 'Lampas na ang panganib na nakakaapekto sa {barangay}. Maaari na ngayong bumalik ang mga residente sa kanilang mga tahanan. Mangyaring mag-ingat pa rin at iulat ang anumang natitirang pinsala sa pamamagitan ng UniGuard.',
      placeholders: ['{barangay}']
    },
    {
      id: 'MT-008', category: 'general', label: 'Relief Goods Distribution',
      title_en: 'Relief Goods Distribution in {barangay}',
      body_en: 'Relief goods will be distributed at {location} on {date}. Affected families are requested to bring a valid ID and their barangay certificate. Priority will be given to seniors, PWDs and pregnant women.',
      title_fil: 'Pamamahagi ng Relief Goods sa {barangay}',
      body_fil: 'Mamamahagi ng relief goods sa {location} sa {date}. Hinihiling sa mga apektadong pamilya na magdala ng wastong ID at kanilang barangay certificate. Prayoridad ang mga senior, PWD at buntis.',
      placeholders: ['{barangay}', '{location}', '{date}']
    }
  ];

  /* ----------------------------------------------------- default app settings
     Split into two tiers:
       1. USER PREFS (per-user, all roles) — language, notifications, offline,
          display. Stored per-user in localStorage keyed by user id so every
          resident, official and LGU staff member gets their own preferences.
       2. SYSTEM CONFIG (LGU-only, global) — org profile, SMS provider,
          message templates. Stored device-wide; in production these would
          live in the app_settings table and sync across all LGU devices. */

  /* per-user preferences — every role sees and edits these */
  const DEFAULT_USER_PREFS = {
    language: {
      ui: 'en',              /* the interface language — actually switches the UI */
      broadcastDefault: 'en', /* the language the advisory composer opens in */
      citizenDisplay: 'bilingual' /* 'en' | 'fil' | 'bilingual' */
    },
    notifications: {
      pushEnabled: true,
      smsFallback: true,
      emailAlerts: false,
      quietHours: false,
      quietStart: '22:00',
      quietEnd: '06:00'
    },
    offline: {
      autoSync: true,
      cacheMaps: true,
      retentionDays: 30
    },
    display: {
      incidentSort: 'priority',
      showCorroboration: true,
      compactTables: false
    }
  };

  /* system config — LGU only, shared across the organisation */
  const DEFAULT_SYSTEM_CONFIG = {
    org: {
      municipality: 'Lingayen',
      province: 'Pangasinan',
      office: 'Municipal Disaster Risk Reduction and Management Office',
      contact: '(075) 632-2222',
      email: 'mdrrmo@lingayen.gov.ph'
    },
    sms: {
      provider: 'none',
      senderId: 'UNIGUARD'
    }
  };

  /* ------------------------------------------------------------- persistence
     USER PREFS are keyed by user id so different users on the same device
     get their own language, notification and offline preferences. The
     current user id is published by app.js as window.__UG_CURRENT_UID on
     login. Before login (auth screen), prefs fall back to a device-wide
     default so the language picker on the sign-in screen still works. */
  function uidKey() {
    const uid = (typeof window !== 'undefined' && window.__UG_CURRENT_UID) || '';
    return uid ? PREFS_KEY + '.' + uid : PREFS_KEY;
  }
  function loadUserPrefs() {
    try {
      const raw = localStorage.getItem(uidKey());
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_USER_PREFS));
      return mergeDeep(JSON.parse(JSON.stringify(DEFAULT_USER_PREFS)), JSON.parse(raw));
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_USER_PREFS)); }
  }
  function saveUserPrefs(p) {
    try { localStorage.setItem(uidKey(), JSON.stringify(p || getUserPrefs())); } catch (e) {}
  }
  let _prefs = null;
  function getUserPrefs() {
    if (_prefs) return _prefs;
    _prefs = loadUserPrefs();
    /* sync the i18n layer on first load so the UI renders in the user's
       chosen language immediately after login */
    if (typeof UG_I18N !== 'undefined' && _prefs.language && _prefs.language.ui) {
      UG_I18N.setLang(_prefs.language.ui);
    }
    return _prefs;
  }
  function patchUserPrefs(path, value) {
    const p = getUserPrefs();
    const keys = path.split('.');
    let cur = p;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]]) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    saveUserPrefs(p);
    return p;
  }
  /* called by app.js on login so prefs reload for the new user */
  function reloadUserPrefs() {
    _prefs = null;
    const p = getUserPrefs();
    if (typeof UG_I18N !== 'undefined' && p.language && p.language.ui) {
      UG_I18N.setLang(p.language.ui);
    }
    return p;
  }

  /* SYSTEM CONFIG — device-wide (LGU shared). Kept for the org-profile and
     SMS-provider tabs that only LGU sees. */
  function loadSystemConfig() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG));
      return mergeDeep(JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG)), JSON.parse(raw));
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_SYSTEM_CONFIG)); }
  }
  function saveSystemConfig(c) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(c || getSystemConfig())); } catch (e) {}
  }
  let _config = null;
  function getSystemConfig() {
    if (_config) return _config;
    _config = loadSystemConfig();
    return _config;
  }
  function patchSystemConfig(path, value) {
    const c = getSystemConfig();
    const keys = path.split('.');
    let cur = c;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]]) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    saveSystemConfig(c);
    return c;
  }
  function mergeDeep(base, over) {
    if (Array.isArray(base) || typeof base !== 'object' || base === null) return over !== undefined ? over : base;
    if (Array.isArray(over) || typeof over !== 'object' || over === null) return over;
    const out = Object.assign({}, base);
    Object.keys(over).forEach((k) => { out[k] = mergeDeep(base[k], over[k]); });
    return out;
  }

  /* --------------------------------------------------- backward-compat shims
     The existing app.js / actions call getSettings() / patchSettings() /
     saveSettings(). These now delegate to the per-user prefs so the old
     code keeps working. The org-profile and SMS tabs use getSystemConfig(). */
  function getSettings() {
    const prefs = getUserPrefs();
    const config = getSystemConfig();
    /* merge into the old shape so existing readers (e.g. the offline tab
       reading s.offline.retentionDays) still work */
    return Object.assign({}, prefs, { org: config.org, sms: config.sms });
  }
  function patchSettings(path, value) {
    /* route org.* and sms.* to system config; everything else to user prefs */
    if (path.indexOf('org.') === 0 || path.indexOf('sms.') === 0) {
      return patchSystemConfig(path, value);
    }
    return patchUserPrefs(path, value);
  }
  function saveSettings() { saveUserPrefs(getUserPrefs()); saveSystemConfig(getSystemConfig()); }

  /* --------------------------------------------------- template persistence */
  function loadTemplates() {
    if (!UG.DATA.messageTemplates) {
      try {
        const raw = localStorage.getItem(TPL_KEY);
        UG.DATA.messageTemplates = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
      } catch (e) { UG.DATA.messageTemplates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)); }
    }
    return UG.DATA.messageTemplates;
  }
  function saveTemplates(list) {
    UG.DATA.messageTemplates = list;
    try { localStorage.setItem(TPL_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function ensureTemplates() { loadTemplates(); }
  /* exposed for the advisory composer (Module F) so it can list + apply one */
  function templatesByCategory(cat) {
    const all = loadTemplates();
    return cat ? all.filter((t) => t.category === cat) : all;
  }
  function templateById(id) {
    return loadTemplates().find((t) => t.id === id) || null;
  }
  /* fills {placeholders} using a values map; leaves unknown ones literal */
  function fillTemplate(text, values) {
    if (!text) return '';
    return text.replace(/\{(\w+)\}/g, (m, key) => (values && values[key] != null ? values[key] : m));
  }

  /* ---------------------------------------------------------- category meta */
  const CATEGORY = {
    evacuation_order: { label: 'Evacuation Order', icon: 'shelter', color: 'var(--ug-emergency)' },
    weather_advisory: { label: 'Weather Advisory', icon: 'wind', color: 'var(--ug-advisory)' },
    road_closure:     { label: 'Road Closure',     icon: 'road',  color: 'var(--ug-warning)' },
    general:          { label: 'General Notice',    icon: 'megaphone', color: 'var(--ug-signal)' }
  };
  function categoryList() { return Object.keys(CATEGORY); }

  /* ----------------------------------------------------------------- render */
  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  /* Settings is now role-aware. EVERY role gets the user-preference tabs
     (notifications, offline, language). Only LGU sees the system-config tabs
     (general/org-profile + templates). Barangay officials get read-only
     access to templates so they can see what's available but not edit them.
     This table decides which tabs each role sees. */
  const ALL_TABS = [
    /* General (organisation profile) is Super Admin only: fifth slot = 'super' */
    ['general', 'settings.general', 'settings', ['lgu_ldrrmc'], 'super'],
    ['notifications', 'settings.notifications', 'bell', ['citizen', 'barangay_official', 'lgu_ldrrmc', 'dispatch_team']],
    ['offline', 'settings.offline', 'download', ['citizen', 'barangay_official', 'lgu_ldrrmc', 'dispatch_team']],
    ['language', 'settings.language', 'globe', ['citizen', 'barangay_official', 'lgu_ldrrmc', 'dispatch_team']],
    ['templates', 'settings.templates', 'megaphone', ['lgu_ldrrmc']]
  ];
  const SETTINGS_TABS = ALL_TABS.map((t) => [t[0], t[1], t[2]]); /* backward-compat export */

  /* the tabs visible to a given role. Used by dSettings + the nav gate. */
  function tabsForRole(role, superAdmin) {
    return ALL_TABS.filter((t) => (!t[3] || t[3].indexOf(role) !== -1) && (t[4] !== 'super' || superAdmin));
  }
  function firstTabForRole(role, superAdmin) {
    /* language is the most useful first tab for most roles (citizens mostly
       come here to switch language); general is first for the Super Admin (org
       profile); LDRRMO staff land on the message templates they work with. */
    if (role === 'lgu_ldrrmc') return superAdmin ? 'general' : 'templates';
    return 'language';
  }

  function dSettings(st) {
    const role = (st.session && st.session.role) || 'citizen';
    const superAdmin = !!(st.session && st.session.superAdmin);
    const visibleTabs = tabsForRole(role, superAdmin);
    /* if the stored tab isn't visible to this role, fall back to the first
       visible one (e.g. a citizen who had 'general' bookmarked). */
    let tab = st.settingsTab || firstTabForRole(role, superAdmin);
    if (!visibleTabs.some((t) => t[0] === tab)) tab = firstTabForRole(role, superAdmin);
    const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
    const tabs = visibleTabs.map((t) =>
      '<button class="ug-chip' + (tab === t[0] ? ' is-on' : '') + '"' + A('settings-tab', attr({ v: t[0] })) + '>' +
      I(t[2], 14) + T(t[1]) + '</button>').join('');
    /* The citizen web shell (cwWrap) already renders a page-level header with
       the title + subtitle. The LGU console sidebar layout does NOT — it needs
       the in-body head(). Detect which shell we're in so we don't render the
       title twice on the citizen web view. */
    const isCitizenWeb = (role === 'citizen' && st.view === 'desktop');
    const header = isCitizenWeb ? '' : head(T('settings.title'), T('settings.subtitle'));
    return '<div class="ug-col" style="gap:18px">' +
      header +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + tabs + '</div>' +
      (tab === 'general' ? tabGeneral(st) :
       tab === 'notifications' ? tabNotifications(st) :
       tab === 'offline' ? tabOffline(st) :
       tab === 'language' ? tabLanguage(st) :
       tabTemplates(st)) +
    '</div>';
  }

  /* ----------------------------------------------------------- general tab */
  function tabGeneral(st) {
    const config = getSystemConfig();
    const prefs = getUserPrefs();
    const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
    return '<div class="ug-col" style="gap:18px">' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + T('settings.orgProfile') + '</h3>' +
        '<span class="ug-dimmer" style="font-size:10.5px">' + T('settings.orgProfileHint') + '</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' +
          settingField('org.municipality', 'Municipality', config.org.municipality, 'e.g. Lingayen') +
          settingField('org.province', 'Province', config.org.province, 'e.g. Pangasinan') +
          settingField('org.office', 'Office name', config.org.office, 'Full office name') +
          '<div class="ug-rowf ug-gap12 ug-wrap" style="gap:12px">' +
            settingField('org.contact', 'Hotline', config.org.contact, '(075) 632-2222', 'flex:1;min-width:200px') +
            settingField('org.email', 'Email', config.org.email, 'mdrrmo@lingayen.gov.ph', 'flex:1;min-width:200px') +
          '</div>' +
          '<div class="ug-rowf ug-gap8" style="gap:8px;margin-top:4px">' +
            '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('settings-save-general') + '>' + I('check', 14) + T('settings.saveProfile') + '</button>' +
            '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('settings-reset') + '>' + I('wave', 14) + T('action.restore') + '</button>' +
          '</div>' +
        '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + T('settings.displayWorkflow') + '</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' +
          toggleRow('display.incidentSort', T('settings.sortUrgency'),
            T('settings.sortUrgencyHelp'),
            prefs.display.incidentSort === 'priority', 'priority') +
          toggleRow('display.showCorroboration', T('settings.showCorroboration'),
            T('settings.showCorroborationHelp'),
            prefs.display.showCorroboration) +
          toggleRow('display.compactTables', T('settings.compactTables'),
            T('settings.compactTablesHelp'),
            prefs.display.compactTables) +
        '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + T('settings.smsFallback') + '</h3>' +
        '<span class="ug-dimmer" style="font-size:10.5px">' + T('settings.smsFallbackHint') + '</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' +
          settingField('sms.provider', 'SMS provider', config.sms.provider, 'none | twilio | itexmo') +
          settingField('sms.senderId', 'Sender ID', config.sms.senderId, 'UNIGUARD') +
          '<div class="ug-help">When a provider is configured, advisories tagged for SMS fallback are queued to the gateway. Leave as "none" to disable.</div>' +
        '</div></div>' +
    '</div>';
  }

  /* ------------------------------------------------------- notifications tab */
  /* Whether this phone is subscribed to push is only known asynchronously;
     remember the last answer and re-render when it changes. */
  let pushOn = null;
  function refreshPushState() {
    if (typeof UG_PWA === 'undefined' || !UG_PWA.pushEnabled) return;
    UG_PWA.pushEnabled().then((v) => {
      if (!!v !== pushOn) { pushOn = !!v; RERENDER(); }
    }).catch(() => {});
  }
  function alertsStatus() {
    const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
      typeof window !== 'undefined' && 'PushManager' in window && typeof Notification !== 'undefined' &&
      !!(typeof UG_CONFIG !== 'undefined' && UG_CONFIG.VAPID_PUBLIC_KEY);
    if (!supported) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    return pushOn ? 'on' : 'off';
  }

  /* "Alerts on this phone": the one notification setting a resident needs. */
  function deviceAlertsCard(T) {
    refreshPushState();
    const status = alertsStatus();
    const label = { on: T('settings.alertsOn'), off: T('settings.alertsOff'), blocked: T('settings.alertsBlocked'), unsupported: T('settings.alertsUnsupported') }[status];
    const tone = status === 'on' ? 'resolved' : status === 'off' ? 'id' : 'warning';
    return '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(T('settings.alertsOnPhone')) + '</h3>' +
        '<span class="ug-badge ug-badge--' + tone + '">' + esc(label) + '</span></div>' +
      '<div class="ug-card-b ug-col" style="gap:12px">' +
        '<div class="ug-dim" style="font-size:12px;line-height:1.5">' + esc(T('settings.alertsHelp')) + '</div>' +
        (status === 'off'
          ? '<button class="ug-btn ug-btn--signal ug-btn--sm" style="align-self:flex-start"' + A('enable-push') + '>' + I('bell', 14) + esc(T('settings.turnOnAlerts')) + '</button>'
          : status === 'blocked'
            ? '<div class="ug-help">' + esc(T('settings.alertsBlockedHelp')) + '</div>'
            : '') +
        '<div class="ug-rowf ug-gap8" style="gap:8px;align-items:flex-start;font-size:11.5px">' +
          '<span style="color:var(--ug-signal);display:flex">' + I('info', 14) + '</span>' +
          '<span class="ug-dim" style="line-height:1.5">' + esc(T('settings.alertsSmsInfo')) + '</span></div>' +
      '</div></div>';
  }

  function tabNotifications(st) {
    const prefs = getUserPrefs();
    const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
    const role = (st.session && st.session.role) || 'citizen';
    /* quiet hours, email digests and the SMS fallback switch are broadcast
       policy for the whole municipality, so only LGU staff see them */
    if (role !== 'lgu_ldrrmc') {
      return '<div class="ug-col" style="gap:18px">' + deviceAlertsCard(T) + '</div>';
    }
    return '<div class="ug-col" style="gap:18px">' +
      deviceAlertsCard(T) +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + T('settings.notificationChannels') + '</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' +
          toggleRow('notifications.pushEnabled', T('settings.pushEnabled'),
            T('settings.pushEnabledHelp'),
            prefs.notifications.pushEnabled) +
          toggleRow('notifications.smsFallback', T('settings.smsFallbackToggle'),
            T('settings.smsFallbackToggleHelp'),
            prefs.notifications.smsFallback) +
          toggleRow('notifications.emailAlerts', T('settings.emailAlerts'),
            T('settings.emailAlertsHelp'),
            prefs.notifications.emailAlerts) +
        '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + T('settings.quietHours') + '</h3>' +
        '<span class="ug-dimmer" style="font-size:10.5px">' + T('settings.quietHoursHint') + '</span></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' +
          toggleRow('notifications.quietHours', T('settings.enableQuietHours'),
            T('settings.enableQuietHoursHelp'),
            prefs.notifications.quietHours) +
          '<div class="ug-rowf ug-gap12" style="gap:12px">' +
            settingField('notifications.quietStart', T('settings.quietStart'), prefs.notifications.quietStart, '22:00', null, 'time') +
            settingField('notifications.quietEnd', T('settings.quietEnd'), prefs.notifications.quietEnd, '06:00', null, 'time') +
          '</div>' +
        '</div></div>' +
    '</div>';
  }

  /* ------------------------------------------------------------ offline tab */
  function tabOffline(st) {
    const prefs = getUserPrefs();
    const pwa = (typeof UG_PWA !== 'undefined' && UG_PWA.state) ? UG_PWA.state : {};
    const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
    return '<div class="ug-col" style="gap:18px">' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + T('settings.offline') + '</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:12px">' +
          toggleRow('offline.autoSync', T('settings.autoSync'),
            T('settings.autoSyncHelp'),
            prefs.offline.autoSync) +
          toggleRow('offline.cacheMaps', T('settings.cacheMaps'),
            T('settings.cacheMapsHelp'),
            prefs.offline.cacheMaps) +
          settingField('offline.retentionDays', T('settings.cacheRetention'), String(prefs.offline.retentionDays), '30', null, 'number') +
        '</div></div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + T('settings.syncStatus') + '</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:10px">' +
          kvRow(T('settings.connection'), pwa.online === false ? 'Offline' : 'Online') +
          kvRow(T('settings.lastSync'), (pwa.lastSync ? UG_UTIL.absTime(pwa.lastSync) : 'never') || 'never') +
          kvRow(T('settings.queuedReports'), String(pwa.queued || 0)) +
          kvRow(T('settings.serviceWorker'), ('serviceWorker' in navigator) ? T('label.yes') : T('label.no')) +
          kvRow(T('settings.appVersion'), (typeof UG_CONFIG !== 'undefined' && UG_CONFIG.BUILD) || 'dev') +
        '</div></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' +
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('settings-save-offline') + '>' + I('check', 14) + T('settings.saveOffline') + '</button>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('refresh-data') + '>' + I('wave', 14) + T('settings.syncNow') + '</button>' +
        '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('force-refresh') + '>' + I('wave', 14) +
          esc(T(st.session && st.session.role === 'citizen' ? 'offline.reloadApp' : 'settings.forceRefresh')) + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ----------------------------------------------------------- language tab */
  function tabLanguage(st) {
    const s = getUserPrefs();
    const T = (k) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : k);
    const curUi = (typeof UG_I18N !== 'undefined' ? UG_I18N.getLang() : 'en');
    /* the UI language picker is the headline control on this tab — it actually
       switches the interface between English and Filipino immediately. The
       broadcast default is the only secondary control: it sets which language
       the advisory composer opens in when an LGU publishes a new broadcast.
       (The old "citizen-facing display" dropdown and the Pangasinense note
       were removed — citizens pick their own language here, so a separate
       "citizen display mode" is redundant; and the Pangasinense note stated
       a build decision that doesn't need to be re-explained on every visit.) */
    return '<div class="ug-col" style="gap:18px">' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + T('settings.languageLocalization') + '</h3></div>' +
        '<div class="ug-card-b ug-col" style="gap:14px">' +
          /* ---- INTERFACE LANGUAGE (the one that actually works) ---- */
          '<div class="ug-field"><label class="ug-lab">' + T('label.language') + ' (Interface)</label>' +
            '<div class="ug-rowf ug-gap8" style="gap:8px">' +
              [['en','English','EN'],['fil','Filipino','FIL']].map((l) =>
                '<button class="ug-chip ug-lang-chip' + (curUi === l[0] ? ' is-on' : '') + '"' + A('lang-ui', attr({ v: l[0] })) + ' style="flex:1;justify-content:center;padding:10px 14px;font-size:13px">' +
                '<span class="ug-lang-flag">' + l[2] + '</span><span>' + l[1] + '</span>' +
                (curUi === l[0] ? '<span style="margin-left:auto">' + I('check', 14) + '</span>' : '') +
                '</button>').join('') +
            '</div>' +
            '<div class="ug-help">Switches the entire interface immediately — navigation, page titles, buttons and labels. Per-user, so each account picks their own.</div></div>' +
          /* ---- BROADCAST DEFAULT (advisory composer language) ---- */
          '<div class="ug-field"><label class="ug-lab">' + T('settings.defaultLanguage') + '</label>' +
            '<select class="ug-sel" data-field="langDefault">' +
              ['en', 'fil'].map((l) => '<option value="' + l + '"' + (s.language.broadcastDefault === l ? ' selected' : '') + '>' +
                (l === 'en' ? 'English' : 'Filipino') + '</option>').join('') +
            '</select>' +
            '<div class="ug-help">' + T('settings.defaultLanguageHint') + '</div></div>' +
          '<button class="ug-btn ug-btn--signal ug-btn--sm" style="align-self:flex-start"' + A('settings-save-language') + '>' + I('check', 14) + T('settings.saveLanguage') + '</button>' +
        '</div></div>' +
    '</div>';
  }

  /* ------------------------------------------------------ templates tab (core) */
  function tabTemplates(st) {
    ensureTemplates();
    const all = loadTemplates();
    const cat = st.tplCategoryFilter || 'all';
    const cats = [['all', 'All', 'layers']].concat(Object.keys(CATEGORY).map((k) => [k, CATEGORY[k].label, CATEGORY[k].icon]));
    const filtered = cat === 'all' ? all : all.filter((t) => t.category === cat);
    const lang = (st.settingsLang || (getSettings().language.default)) || 'en';

    return '<div class="ug-col" style="gap:18px">' +
      '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
        '<div><div class="ug-lab">Message Templates</div>' +
          '<h3 style="font-size:15px;margin-top:3px">Reusable broadcast templates · English & Filipino</h3>' +
          '<p class="ug-dim" style="font-size:11.5px;margin-top:4px;line-height:1.5">Pre-written advisories the duty officer applies to the composer during a response. Placeholders like {barangay} are filled in at publish time.</p></div>' +
        '<div class="ug-rowf ug-gap8" style="gap:8px">' +
          '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('tpl-export') + '>' + I('download', 14) + 'Export JSON</button>' +
          '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('tpl-add') + '>' + I('plus', 14) + 'New Template</button>' +
        '</div>' +
      '</div>' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' +
        cats.map((c) => '<button class="ug-chip' + (cat === c[0] ? ' is-on' : '') + '"' + A('tpl-cat', attr({ v: c[0] })) + '>' + I(c[2], 13) + c[1] + '</button>').join('') +
        '<span style="flex:1"></span>' +
        '<div class="ug-rowf ug-gap6" style="gap:6px">' +
          '<span class="ug-dimmer" style="font-size:10.5px;align-self:center">Preview language</span>' +
          [['en','EN'],['fil','FIL']].map((l) => '<button class="ug-chip' + (lang === l[0] ? ' is-on' : '') + '"' + A('tpl-lang', attr({ v: l[0] })) + '>' + l[1] + '</button>').join('') +
        '</div>' +
      '</div>' +
      (filtered.length
        ? '<div class="ug-tpl-grid">' + filtered.map((t) => templateCard(t, lang)).join('') + '</div>'
        : '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('megaphone', 20) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No templates in this category</div>' +
          '<div class="ug-dim" style="font-size:11px">Create one so the duty officer can publish a ready-made advisory in seconds.</div></div></div>') +
    '</div>';
  }

  function templateCard(t, lang) {
    const cat = CATEGORY[t.category] || CATEGORY.general;
    const title = lang === 'fil' ? (t.title_fil || t.title_en) : (t.title_en || t.title_fil);
    const body = lang === 'fil' ? (t.body_fil || t.body_en) : (t.body_en || t.body_fil);
    const ph = (t.placeholders || []).map((p) => '<code>' + esc(p) + '</code>').join(' ');
    return '<div class="ug-card ug-tpl-card">' +
      '<div class="ug-card-h"><div class="ug-rowf ug-gap8" style="gap:8px;align-items:center;min-width:0">' +
        '<span class="ug-tpl-cat" style="background:' + cat.color + '">' + I(cat.icon, 12) + esc(cat.label) + '</span>' +
        '<span class="ug-dimmer ug-mono" style="font-size:10px">' + esc(t.id) + '</span></div>' +
        '<div class="ug-rowf ug-gap6" style="gap:6px">' +
          '<button class="ug-ico-btn" aria-label="Edit template" data-act="tpl-edit" data-id="' + esc(t.id) + '">' + I('settings', 14) + '</button>' +
          '<button class="ug-ico-btn" aria-label="Delete template" data-act="tpl-delete" data-id="' + esc(t.id) + '">' + I('x', 14) + '</button>' +
        '</div></div>' +
      '<div class="ug-card-b ug-col" style="gap:10px">' +
        '<div><div class="ug-lab" style="font-size:10px">' + esc(t.label) + '</div>' +
          '<div style="font-size:13px;font-weight:600;margin-top:2px">' + esc(title) + '</div></div>' +
        '<div class="ug-dim ug-clamp3" style="font-size:11.5px;line-height:1.5">' + esc(body) + '</div>' +
        (ph ? '<div class="ug-tpl-ph">' + ph + '</div>' : '') +
        '<div class="ug-rowf ug-gap6 ug-tpl-langs" style="gap:6px">' +
          '<span class="ug-badge ug-badge--id' + (t.title_en ? '' : ' is-off') + '">EN</span>' +
          '<span class="ug-badge ug-badge--id' + (t.title_fil ? '' : ' is-off') + '">FIL</span>' +
        '</div>' +
      '</div></div>';
  }

  /* ------------------------------------------------------------ shared bits */
  function settingField(path, label, value, placeholder, style, inputType) {
    const t = inputType || 'text';
    return '<div class="ug-field" style="margin:0"><label class="ug-lab">' + esc(label) + '</label>' +
      '<input class="ug-in" data-setting="' + esc(path) + '" type="' + t + '" value="' + esc(value == null ? '' : value) + '"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') +
      (style ? ' style="' + style + '"' : '') + '></div>';
  }
  function toggleRow(path, label, help, on, onValue) {
    /* a toggle is "on" if its value equals onValue (for string enums) or is truthy */
    const isOn = onValue ? on === onValue : !!on;
    return '<div class="ug-rowf ug-gap10 ug-setting-toggle" style="gap:10px;align-items:flex-start">' +
      '<span class="ug-col" style="gap:3px;min-width:0;flex:1">' +
        '<span style="font-size:12.5px;font-weight:600">' + esc(label) + '</span>' +
        '<span class="ug-dim" style="font-size:11px;line-height:1.5">' + esc(help) + '</span>' +
      '</span>' +
      '<button class="ug-toggle' + (isOn ? ' is-on' : '') + '" role="switch" aria-checked="' + isOn + '"' +
        A('settings-toggle', attr({ path: path, v: onValue || 'true' })) + '>' +
        '<span class="ug-toggle-knob"></span>' +
      '</button>' +
    '</div>';
  }
  function kvRow(k, v) {
    return '<div class="ug-rowf ug-between" style="font-size:12px"><span class="ug-dim">' + esc(k) + '</span><span class="ug-mono">' + esc(v) + '</span></div>';
  }

  /* ----------------------------------------------------- template editor modal */
  /* opened from tpl-add / tpl-edit. A single form holds both languages side by
     side so the translator can see them together. */
  function openEditor(id) {
    const all = loadTemplates();
    const t = id ? all.find((x) => x.id === id) : null;
    const isNew = !t;
    const data = t || {
      id: 'MT-' + String(Date.now()).slice(-6),
      category: 'general', label: '', title_en: '', body_en: '', title_fil: '', body_fil: '', placeholders: []
    };
    const catOpts = Object.keys(CATEGORY).map((k) =>
      '<option value="' + k + '"' + (data.category === k ? ' selected' : '') + '>' + esc(CATEGORY[k].label) + '</option>').join('');

    UG_FEATURES.modal({
      title: isNew ? 'New message template' : 'Edit template · ' + data.id,
      body:
        '<div class="ug-field"><label class="ug-lab">Label (internal name)</label>' +
          '<input class="ug-in" data-tpl-label value="' + esc(data.label) + '" placeholder="e.g. Evacuation Order — Coastal Flood"></div>' +
        '<div class="ug-field"><label class="ug-lab">Category</label>' +
          '<select class="ug-sel" data-tpl-category>' + catOpts + '</select></div>' +
        '<div class="ug-tpl-edit-langs">' +
          '<div class="ug-tpl-edit-lang"><div class="ug-lab" style="margin-bottom:6px"><span class="ug-badge ug-badge--id">EN</span> English</div>' +
            '<input class="ug-in" data-tpl-title-en value="' + esc(data.title_en || '') + '" placeholder="Title (English)" style="margin-bottom:8px">' +
            '<textarea class="ug-ta" rows="4" data-tpl-body-en placeholder="Message body (English)">' + esc(data.body_en || '') + '</textarea></div>' +
          '<div class="ug-tpl-edit-lang"><div class="ug-lab" style="margin-bottom:6px"><span class="ug-badge ug-badge--id">FIL</span> Filipino</div>' +
            '<input class="ug-in" data-tpl-title-fil value="' + esc(data.title_fil || '') + '" placeholder="Pamagat (Filipino)" style="margin-bottom:8px">' +
            '<textarea class="ug-ta" rows="4" data-tpl-body-fil placeholder="Nilalaman ng mensahe (Filipino)">' + esc(data.body_fil || '') + '</textarea></div>' +
        '</div>' +
        '<div class="ug-field" style="margin-bottom:0"><label class="ug-lab">Placeholders (comma-separated)</label>' +
          '<input class="ug-in ug-mono" data-tpl-placeholders value="' + esc((data.placeholders || []).join(', ')) + '" placeholder="{barangay}, {center}">' +
          '<div class="ug-help">Use {name} tokens in the body, then list them here so the composer knows which to prompt for.</div></div>',
      footer:
        '<button class="ug-btn" data-modal-close>Cancel</button>' +
        '<button class="ug-btn ug-btn--signal" data-save>' + (isNew ? 'Create' : 'Save') + '</button>',
      onMount: (wrap, close) => {
        wrap.querySelector('[data-save]').addEventListener('click', () => {
          const label = wrap.querySelector('[data-tpl-label]').value.trim();
          const category = wrap.querySelector('[data-tpl-category]').value;
          const title_en = wrap.querySelector('[data-tpl-title-en]').value.trim();
          const body_en = wrap.querySelector('[data-tpl-body-en]').value.trim();
          const title_fil = wrap.querySelector('[data-tpl-title-fil]').value.trim();
          const body_fil = wrap.querySelector('[data-tpl-body-fil]').value.trim();
          const phRaw = wrap.querySelector('[data-tpl-placeholders]').value.trim();
          if (!label) { UGTOST('A label is required', 'warning'); return; }
          if (!title_en && !title_fil) { UGTOST('Add at least one language title', 'warning'); return; }
          const placeholders = phRaw ? phRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
          const row = { id: data.id, category: category, label: label, title_en: title_en, body_en: body_en,
            title_fil: title_fil, body_fil: body_fil, placeholders: placeholders };
          let list = loadTemplates();
          if (isNew) list.push(row);
          else { const i = list.findIndex((x) => x.id === data.id); if (i !== -1) list[i] = row; }
          saveTemplates(list);
          UGTOST(isNew ? 'Template created' : 'Template saved', 'prepared');
          close();
          RERENDER();
        });
      }
    });
  }

  function deleteTemplate(id) {
    const t = templateById(id);
    if (!t) return;
    UG_FEATURES.confirm({
      title: 'Delete template',
      message: 'Delete "' + (t.label || t.id) + '"? The advisory composer will no longer offer it.',
      confirmLabel: 'Delete', danger: true
    }).then((ok) => {
      if (!ok) return;
      saveTemplates(loadTemplates().filter((x) => x.id !== id));
      UGTOST('Template deleted', 'warning');
      RERENDER();
    });
  }

  function exportTemplates() {
    /* a configuration backup, not a document: the plain JSON array is kept
       exactly as before so it stays re-importable; only the file name and the
       download path follow the shared export standard (js/export-core.js) */
    const list = loadTemplates();
    if (!list.length) { UGTOST('There are no message templates to export', 'info'); return; }
    const filename = UG_EXPORT.buildFilename({ type: 'Message Templates', ext: 'json' });
    UG_EXPORT.download(new Blob([JSON.stringify(list, null, 2)], { type: 'application/json;charset=utf-8' }), filename);
    UGTOST(list.length + ' template' + (list.length === 1 ? '' : 's') + ' saved \u00b7 ' + filename, 'prepared');
  }

  return {
    dSettings, tabTemplates, openEditor, deleteTemplate, exportTemplates,
    getSettings, patchSettings, saveSettings,
    /* per-user prefs + system config */
    getUserPrefs, patchUserPrefs, saveUserPrefs, reloadUserPrefs,
    getSystemConfig, patchSystemConfig, saveSystemConfig,
    DEFAULT_USER_PREFS, DEFAULT_SYSTEM_CONFIG,
    /* role-aware tabs */
    tabsForRole, firstTabForRole, refreshPushState,
    loadTemplates, saveTemplates, ensureTemplates, templatesByCategory, templateById, fillTemplate,
    DEFAULT_TEMPLATES, CATEGORY, categoryList,
    SETTINGS_TABS, ALL_TABS
  };
})();

/* expose a render hook so the settings module can ask the controller to
   re-paint after a local-only mutation (template add/edit/delete, setting
   toggle). app.js sets window.APP_RENDER = render; on boot. */
