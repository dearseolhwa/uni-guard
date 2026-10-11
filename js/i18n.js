/* UniGuard · internationalization (i18n)
 *
 * THE single source of UI strings. Every screen reads its visible text
 * through UG_I18N.t('key') instead of hard-coding English, so the language
 * picker in Settings actually changes the interface.
 *
 * Languages: English (en) and Filipino (fil) only. Pangasinense was removed
 * per the build spec — English and Filipino cover every resident the system
 * currently serves.
 *
 * Load order: this file loads EARLY (right after util.js), before screens.js,
 * so every screen can call t() at render time. The active language is read
 * from localStorage on boot; when the user changes it in Settings,
 * UG_I18N.setLang() is called and the controller re-renders the whole app.
 *
 * Coverage: navigation, page titles, common actions, common labels, the
 * Settings page, and the main screen headers. Deeper strings (modal bodies,
 * toast messages, help text) can be added incrementally — they fall back to
 * the English string when a translation key is missing, so the UI never
 * breaks.
 */
const UG_I18N = (function () {
  /* ----------------------------------------------------------- the dictionary
     Keys are namespaced by area: nav.*, title.*, action.*, label.*, settings.*,
     screen.*, etc. Missing keys fall back to English, then to the key itself,
     so a missing translation never renders as "undefined". */
  const STRINGS = {
    en: {
      /* ---- navigation ---- */
      'nav.home': 'Home',
      'nav.incidents': 'Incidents',
      'nav.advisories': 'Advisories',
      'nav.relief': 'Relief & Inventory',
      'nav.centers': 'Shelters',
      'nav.roadwork': 'Road Work',
      'nav.response-team': 'Response Team',
      'nav.dispatch-units': 'Dispatch Units',
      'nav.guides': 'Guides',
      'nav.faqs': 'FAQs',
      'nav.sos': 'SOS Log',
      'nav.hotlines': 'Hotlines',
      'nav.analytics': 'Analytics',
      'nav.others-review': 'Others Review',
      'nav.users': 'Users',
      'nav.audit': 'Audit Log',
      'nav.settings': 'Settings',
      'nav.offline': 'Offline Sync',
      'nav.map': 'Hazard Map',
      'nav.report': 'Report a Hazard',
      'nav.notifications': 'Notifications',
      'nav.more': 'More',

      /* ---- common actions ---- */
      'action.save': 'Save',
      'action.cancel': 'Cancel',
      'action.add': 'Add',
      'action.edit': 'Edit',
      'action.delete': 'Delete',
      'action.export': 'Export',
      'action.publish': 'Publish',
      'action.clear': 'Clear',
      'action.refresh': 'Refresh',
      'action.back': 'Back',
      'action.close': 'Close',
      'action.confirm': 'Confirm',
      'action.search': 'Search',
      'action.filter': 'Filter',
      'action.call': 'Call',
      'action.navigate': 'Navigate',
      'action.verify': 'Verify',
      'action.resolve': 'Resolve',
      'action.dispatch': 'Dispatch',
      'action.restock': 'Restock',
      'action.record': 'Record',
      'action.signout': 'Sign Out',
      'action.create': 'Create',
      'action.restore': 'Restore Defaults',
      'action.review': 'Review',

      /* ---- common labels ---- */
      'label.barangay': 'Barangay',
      'label.status': 'Status',
      'label.capacity': 'Capacity',
      'label.occupancy': 'Occupancy',
      'label.name': 'Name',
      'label.contact': 'Contact',
      'label.location': 'Location',
      'label.description': 'Description',
      'label.severity': 'Severity',
      'label.type': 'Type',
      'label.message': 'Message',
      'label.title': 'Title',
      'label.category': 'Category',
      'label.language': 'Language',
      'label.unit': 'Unit',
      'label.stock': 'Stock',
      'label.supplier': 'Supplier',
      'label.active': 'Active',
      'label.note': 'Notes',

      /* ---- settings tabs ---- */
      'settings.general': 'General',
      'settings.notifications': 'Notifications',
      'settings.offline': 'Offline & Sync',
      'settings.language': 'Language',
      'settings.templates': 'Message Templates',

      /* ---- settings page ---- */
      'settings.title': 'System Settings',
      'settings.subtitle': 'Your preferences and the reusable message templates for advisories.',
      'settings.orgProfile': 'Organisation Profile',
      'settings.orgProfileHint': 'Shown across the app and on exported PDFs',
      'settings.displayWorkflow': 'Display & Workflow',
      'settings.smsFallback': 'SMS Fallback',
      'settings.smsFallbackHint': 'For citizens without data',
      'settings.notificationChannels': 'Notification Channels',
      'settings.quietHours': 'Quiet Hours',
      'settings.quietHoursHint': 'Preparedness advisories are held until quiet hours end',
      'settings.syncStatus': 'Sync Status',
      'settings.connection': 'Connection',
      'settings.lastSync': 'Last sync',
      'settings.queuedReports': 'Queued reports',
      'settings.serviceWorker': 'Service worker',
      'settings.languageLocalization': 'Language & Localization',
      'settings.defaultLanguage': 'Default language for broadcasts',
      'settings.defaultLanguageHint': 'The language the advisory composer opens in. The other language is still required before publishing.',
      'settings.citizenDisplay': 'Citizen-facing display',
      'settings.citizenDisplayHint': 'How advisory text is shown to citizens on their device.',
      'settings.pangasinenseRemoved': 'Pangasinense translation was removed from this build. English and Filipino cover every resident the system currently serves, and keeping two languages instead of three halves the template maintenance for the LDRRMO.',
      'settings.messageTemplates': 'Message Templates',
      'settings.templatesSubtitle': 'Reusable broadcast templates · English & Filipino',
      'settings.templatesHelp': 'Pre-written advisories the duty officer applies to the composer during a response. Placeholders like {barangay} are filled in at publish time.',
      'settings.previewLanguage': 'Preview language',
      'settings.sortUrgency': 'Sort incident queue by urgency',
      'settings.sortUrgencyHelp': 'Auto-triage: rank reports by severity, corroboration and recency so the most urgent surfaces first.',
      'settings.showCorroboration': 'Show corroboration count on cards',
      'settings.showCorroborationHelp': 'Displays how many residents reported the same hazard on each incident card.',
      'settings.compactTables': 'Compact table density',
      'settings.compactTablesHelp': 'Reduces row padding in management tables so more rows fit on a single screen.',
      'settings.pushEnabled': 'Web Push notifications',
      'settings.pushEnabledHelp': 'Broadcast advisories to subscribed devices. Requires the VAPID key to be set at deploy time.',
      'settings.smsFallbackToggle': 'SMS fallback for emergency advisories',
      'settings.smsFallbackToggleHelp': 'When push is unavailable or a device has no data, queue the advisory to the SMS gateway.',
      'settings.emailAlerts': 'Email alert digests',
      'settings.emailAlertsHelp': 'Send a daily digest of emergency advisories to the registered office email.',
      'settings.enableQuietHours': 'Enable quiet hours',
      'settings.enableQuietHoursHelp': 'Non-emergency (preparedness) broadcasts are queued and sent after quiet hours end. Emergency advisories always go through immediately.',
      'settings.quietStart': 'Quiet starts',
      'settings.quietEnd': 'Quiet ends',
      'settings.autoSync': 'Auto-sync when back online',
      'settings.autoSyncHelp': 'Queued reports and edits are uploaded automatically the moment a connection returns.',
      'settings.cacheMaps': 'Cache map tiles for offline use',
      'settings.cacheMapsHelp': 'Stores the base map tiles so the operations map still renders without a connection.',
      'settings.cacheRetention': 'Cache retention (days)',
      'settings.saveProfile': 'Save Profile',
      'settings.saveOffline': 'Save Offline Settings',
      'settings.saveLanguage': 'Save Language Settings',
      'settings.syncNow': 'Sync Now',
      'settings.forceRefresh': 'Force Refresh',

      /* ---- page titles (the main screens) ---- */
      'title.dashboard': 'Operations Dashboard',
      'title.incidents': 'Incident Queue',
      'title.advisories': 'Early Warning & Announcements',
      'title.centers': 'Evacuation Center Management',
      'title.relief': 'Relief & Resource Inventory',
      'title.command': 'Command View',
      'title.hotlines': 'Emergency Hotlines',
      'title.analytics': 'Analytics',
      'title.users': 'User Management',
      'title.audit': 'Audit Log',
      'title.offline': 'Offline Sync',
      'title.settings': 'Settings',

      /* ---- relief tabs ---- */
      'relief.tab.distributions': 'Distributions',
      'relief.tab.inventory': 'Resource Inventory',
      'relief.tab.records': 'Distribution Records',

      /* ---- advisories ---- */
      'advisories.compose': 'Compose Broadcast',
      'advisories.preview': 'Preview',
      'advisories.published': 'Published',
      'advisories.alertType': 'Alert type',
      'advisories.alertTypeHint': 'Determines the template shortlist and the icon on the citizen lock screen.',
      'advisories.alertLevel': 'Alert level',
      'advisories.advisoryTitle': 'Advisory title',
      'advisories.broadcastType': 'Broadcast type',
      'advisories.affectedArea': 'Affected area',
      'advisories.message': 'Message',
      'advisories.messageHint': 'Keep it short. Residents read this on a lock screen during an emergency.',
      'advisories.publishBroadcast': 'Publish Broadcast',
      'advisories.useTemplate': 'Use Template',
      'advisories.alertType.general': 'General Notice',
      'advisories.alertType.weather_advisory': 'Weather Advisory',
      'advisories.alertType.evacuation_order': 'Evacuation Order',
      'advisories.alertType.road_closure': 'Road Closure',
      'advisories.level.emergency': 'Emergency',
      'advisories.level.warning': 'Warning',
      'advisories.level.advisory': 'Advisory',
      'advisories.level.prepared': 'Preparedness',

      /* ---- centers ---- */
      'centers.subtitle': 'Keep capacity, facilities and contact details accurate so residents arrive at a shelter with space and the right support.',
      'centers.addCenter': 'Add Evacuation Center',
      'centers.facilities': 'Facilities',
      'centers.facilitiesPlaceholder': 'e.g. Medical station, Kitchen, Pet-friendly area, Generator',
      'centers.contactPerson': 'Contact person',
      'centers.contactPhone': 'Contact phone',
      'centers.centerName': 'Center Name',
      'centers.latitude': 'Latitude',
      'centers.longitude': 'Longitude',
      'centers.useMyLocation': 'Use My Location',
      'centers.occupancy': 'Occupancy',
      'centers.currentOccupancy': 'current occupancy',

      /* ---- toasts ---- */
      'toast.templateApplied': 'Template applied — review and publish',
      'toast.templateCreated': 'Template created',
      'toast.templateSaved': 'Template saved',
      'toast.templateDeleted': 'Template deleted',
      'toast.settingsSaved': 'Settings saved',
      'toast.languageChanged': 'Language changed to Filipino',
      'toast.languageChangedEn': 'Language changed to English',
      'toast.prefsRestored': 'Preferences restored to defaults',

      /* ---- roles ---- */
      'role.citizen': 'Citizen',
      'role.barangay_official': 'Barangay Official',
      'role.lgu_ldrrmc': 'LGU / MDRRMO',
      'role.dispatch_team': 'Dispatch Team'
    },

    fil: {
      /* ---- navigation ---- */
      'nav.home': 'Home',
      'nav.incidents': 'Mga Insidente',
      'nav.advisories': 'Mga Babala',
      'nav.relief': 'Relief at Imbentaryo',
      'nav.centers': 'Mga Shelter',
      'nav.roadwork': 'Gawa sa Kalsada',
      'nav.response-team': 'Response Team',
      'nav.dispatch-units': 'Mga Dispatch Unit',
      'nav.guides': 'Mga Gabay',
      'nav.faqs': 'Mga FAQ',
      'nav.sos': 'Log ng SOS',
      'nav.hotlines': 'Mga Hotline',
      'nav.analytics': 'Analytics',
      'nav.others-review': 'Review ng Iba',
      'nav.users': 'Mga Gumagamit',
      'nav.audit': 'Audit Log',
      'nav.settings': 'Mga Setting',
      'nav.offline': 'Offline Sync',
      'nav.map': 'Mapa ng Panganib',
      'nav.report': 'Mag-ulat ng Panganib',
      'nav.notifications': 'Mga Abiso',
      'nav.more': 'Iba Pa',

      /* ---- common actions ---- */
      'action.save': 'I-save',
      'action.cancel': 'Kanselahin',
      'action.add': 'Magdagdag',
      'action.edit': 'I-edit',
      'action.delete': 'Burahin',
      'action.export': 'I-export',
      'action.publish': 'I-publish',
      'action.clear': 'I-clear',
      'action.refresh': 'I-refresh',
      'action.back': 'Bumalik',
      'action.close': 'Isara',
      'action.confirm': 'Kumpirmahin',
      'action.search': 'Hanapin',
      'action.filter': 'I-filter',
      'action.call': 'Tumawag',
      'action.navigate': 'Mag-navigate',
      'action.verify': 'Beripikahin',
      'action.resolve': 'Lutasin',
      'action.dispatch': 'I-dispatch',
      'action.restock': 'Mag-restock',
      'action.record': 'Itala',
      'action.signout': 'Mag Sign Out',
      'action.create': 'Likhain',
      'action.restore': 'Ibalik sa Default',
      'action.review': 'Suriin',

      /* ---- common labels ---- */
      'label.barangay': 'Barangay',
      'label.status': 'Status',
      'label.capacity': 'Kapasidad',
      'label.occupancy': 'Ocupancy',
      'label.name': 'Pangalan',
      'label.contact': 'Kontak',
      'label.location': 'Lokasyon',
      'label.description': 'Paglalarawan',
      'label.severity': 'Kalubhaan',
      'label.type': 'Uri',
      'label.message': 'Mensahe',
      'label.title': 'Pamagat',
      'label.category': 'Kategorya',
      'label.language': 'Wika',
      'label.unit': 'Yunit',
      'label.stock': 'Stock',
      'label.supplier': 'Tagabigay',
      'label.active': 'Aktibo',
      'label.note': 'Mga Tala',

      /* ---- settings tabs ---- */
      'settings.general': 'Pangkalahatan',
      'settings.notifications': 'Mga Abiso',
      'settings.offline': 'Offline at Sync',
      'settings.language': 'Wika',
      'settings.templates': 'Mga Template ng Mensahe',

      /* ---- settings page ---- */
      'settings.title': 'Mga Setting ng Sistema',
      'settings.subtitle': 'Ang iyong mga kagustuhan at ang mga nauling template ng mensahe para sa advisories.',
      'settings.orgProfile': 'Profile ng Organisasyon',
      'settings.orgProfileHint': 'Ipinapakita sa buong app at sa mga na-export na PDF',
      'settings.displayWorkflow': 'Display at Workflow',
      'settings.smsFallback': 'SMS Fallback',
      'settings.smsFallbackHint': 'Para sa mga mamamayan walang data',
      'settings.notificationChannels': 'Mga Channel ng Abiso',
      'settings.quietHours': 'Oras ng Katahimikan',
      'settings.quietHoursHint': 'Ang mga preparedness advisory ay hahawak hanggang matapos ang quiet hours',
      'settings.syncStatus': 'Status ng Sync',
      'settings.connection': 'Koneksyon',
      'settings.lastSync': 'Huling sync',
      'settings.queuedReports': 'Mga nakapilang ulat',
      'settings.serviceWorker': 'Service worker',
      'settings.languageLocalization': 'Wika at Lokalisasyon',
      'settings.defaultLanguage': 'Default na wika para sa broadcast',
      'settings.defaultLanguageHint': 'Ang wika na bubuksan ng advisory composer. Kailangan pa rin ang kabilang wika bago mag-publish.',
      'settings.citizenDisplay': 'Display para sa mamamayan',
      'settings.citizenDisplayHint': 'Paano ipinapakita ang teksto ng advisory sa mga mamamayan sa kanilang device.',
      'settings.pangasinenseRemoved': 'Ang Pangasinense translation ay tinanggal sa build na ito. Saklaw ng English at Filipino ang bawat residenteng kasalukuyang pinaglilingkuran ng sistema, at ang pagpapanatili ng dalawang wika sa halip na tatlo ay pinaikli ang maintenance ng template para sa LDRRMO.',
      'settings.messageTemplates': 'Mga Template ng Mensahe',
      'settings.templatesSubtitle': 'Mga nauling template ng broadcast · English at Filipino',
      'settings.templatesHelp': 'Mga naisulat nang advisory na ginagamit ng duty officer sa composer habang may tugon. Ang mga placeholder tulad ng {barangay} ay pupunan sa oras ng publish.',
      'settings.previewLanguage': 'Preview na wika',
      'settings.sortUrgency': 'Ayusin ang incident queue ayon sa urgency',
      'settings.sortUrgencyHelp': 'Auto-triage: rank ang mga ulat ayon sa severity, corroboration at recency para lumabas ang pinaka-urgent.',
      'settings.showCorroboration': 'Ipakita ang bilang ng corroboration sa mga card',
      'settings.showCorroborationHelp': 'Ipinapakita kung ilang residente ang nag-ulat ng parehong panganib sa bawat incident card.',
      'settings.compactTables': 'Compact na density ng table',
      'settings.compactTablesHelp': 'Binabawasan ang row padding sa management tables para mas maraming row ang magkasya sa isang screen.',
      'settings.pushEnabled': 'Web Push na abiso',
      'settings.pushEnabledHelp': 'I-broadcast ang mga advisory sa mga naka-subscribe na device. Kailangan ang VAPID key na naka-set sa deploy time.',
      'settings.smsFallbackToggle': 'SMS fallback para sa emergency advisory',
      'settings.smsFallbackToggleHelp': 'Kapag hindi available ang push o walang data ang device, ipapasa ang advisory sa SMS gateway.',
      'settings.emailAlerts': 'Email alert digest',
      'settings.emailAlertsHelp': 'Magpadala ng pang-araw-araw na digest ng emergency advisory sa rehistradong email ng opisina.',
      'settings.enableQuietHours': 'I-enable ang quiet hours',
      'settings.enableQuietHoursHelp': 'Ang mga hindi emergency (preparedness) broadcast ay nakapila at ipapadala pagkatapos ng quiet hours. Ang emergency advisory ay palaging ipinapadala agad.',
      'settings.quietStart': 'Simula ng quiet',
      'settings.quietEnd': 'Wakas ng quiet',
      'settings.autoSync': 'Auto-sync kapag online na',
      'settings.autoSyncHelp': 'Ang mga nakapilang ulat at edit ay awtomatikong naa-upload kapag bumalik ang koneksyon.',
      'settings.cacheMaps': 'I-cache ang mapa tiles para sa offline',
      'settings.cacheMapsHelp': 'Nag-iimbak ng base map tiles para mag-render pa rin ang operations mapa walang koneksyon.',
      'settings.cacheRetention': 'Retention ng cache (araw)',
      'settings.saveProfile': 'I-save ang Profile',
      'settings.saveOffline': 'I-save ang Offline Setting',
      'settings.saveLanguage': 'I-save ang Wika Setting',
      'settings.syncNow': 'Sync Ngayon',
      'settings.forceRefresh': 'Force Refresh',

      /* ---- page titles ---- */
      'title.dashboard': 'Operations Dashboard',
      'title.incidents': 'Incident Queue',
      'title.advisories': 'Maagang Babala at Anunsyo',
      'title.centers': 'Pamamahala ng Evacuation Center',
      'title.relief': 'Relief at Imbentaryo ng Resource',
      'title.command': 'Command View',
      'title.hotlines': 'Mga Emergency Hotline',
      'title.analytics': 'Analytics',
      'title.users': 'Pamamahala ng Gumagamit',
      'title.audit': 'Audit Log',
      'title.offline': 'Offline Sync',
      'title.settings': 'Mga Setting',

      /* ---- relief tabs ---- */
      'relief.tab.distributions': 'Mga Distribusyon',
      'relief.tab.inventory': 'Imbentaryo ng Resource',
      'relief.tab.records': 'Mga Tala ng Distribusyon',

      /* ---- advisories ---- */
      'advisories.compose': 'Sumulat ng Broadcast',
      'advisories.preview': 'Preview',
      'advisories.published': 'Na-publish na',
      'advisories.alertType': 'Uri ng alerto',
      'advisories.alertTypeHint': 'Tinutukoy ang shortlist ng template at ang icon sa lock screen ng mamamayan.',
      'advisories.alertLevel': 'Antas ng alerto',
      'advisories.advisoryTitle': 'Pamagat ng advisory',
      'advisories.broadcastType': 'Uri ng broadcast',
      'advisories.affectedArea': 'Apektadong lugar',
      'advisories.message': 'Mensahe',
      'advisories.messageHint': 'Maikli lang. Binabasa ito ng mga residente sa lock screen habang may emergency.',
      'advisories.publishBroadcast': 'I-publish ang Broadcast',
      'advisories.useTemplate': 'Gumamit ng Template',
      'advisories.alertType.general': 'Pangkalahatang Paunawa',
      'advisories.alertType.weather_advisory': 'Advisory sa Panahon',
      'advisories.alertType.evacuation_order': 'Utos ng Paglikas',
      'advisories.alertType.road_closure': 'Pagsara ng Kalsada',
      'advisories.level.emergency': 'Emergency',
      'advisories.level.warning': 'Babala',
      'advisories.level.advisory': 'Advisory',
      'advisories.level.prepared': 'Preparedness',

      /* ---- centers ---- */
      'centers.subtitle': 'Panatilihin na tumpak ang kapasidad, facilities at kontak para makarating ang mga residente sa shelter na may espasyo at tamang suporta.',
      'centers.addCenter': 'Magdagdag ng Evacuation Center',
      'centers.facilities': 'Mga Facility',
      'centers.facilitiesPlaceholder': 'hal. Medical station, Kusina, Pet-friendly area, Generator',
      'centers.contactPerson': 'Taong kontak',
      'centers.contactPhone': 'Telepono ng kontak',
      'centers.centerName': 'Pangalan ng Center',
      'centers.latitude': 'Latitude',
      'centers.longitude': 'Longitude',
      'centers.useMyLocation': 'Gamitin ang Aking Lokasyon',
      'centers.occupancy': 'Ocupancy',
      'centers.currentOccupancy': 'kasalukuyang ocupancy',

      /* ---- toasts ---- */
      'toast.templateApplied': 'Nailapat ang template — suriin at i-publish',
      'toast.templateCreated': 'Likha ang template',
      'toast.templateSaved': 'Na-save ang template',
      'toast.templateDeleted': 'Nabura ang template',
      'toast.settingsSaved': 'Na-save ang setting',
      'toast.languageChanged': 'Pinalitan ang wika patungong Filipino',
      'toast.languageChangedEn': 'Pinalitan ang wika patungong English',
      'toast.prefsRestored': 'Naibalik ang mga kagustuhan sa default',

      /* ---- roles ---- */
      'role.citizen': 'Mamamayan',
      'role.barangay_official': 'Opisyal ng Barangay',
      'role.lgu_ldrrmc': 'LGU / MDRRMO',
      'role.dispatch_team': 'Dispatch Team'
    }
  };

  /* ----------------------------------------------------------- active language
     Read from localStorage on boot. The key includes the user id when
     available (per-user language), falling back to a device-wide default. */
  const STORAGE_KEY = 'uniguard.lang';
  let currentLang = 'en';

  function readStoredLang() {
    try {
      /* try per-user first, then device-wide */
      const uid = (typeof window !== 'undefined' && window.__UG_CURRENT_UID) || '';
      const perUser = uid ? localStorage.getItem(STORAGE_KEY + '.' + uid) : null;
      if (perUser === 'en' || perUser === 'fil') return perUser;
      const device = localStorage.getItem(STORAGE_KEY);
      if (device === 'en' || device === 'fil') return device;
    } catch (e) {}
    return 'en';
  }
  currentLang = readStoredLang();

  /* ----------------------------------------------------------- the t() function
     t('nav.home') → 'Home' (en) or 'Home' (fil)
     Missing key → falls back to English, then to the key itself. */
  function t(key) {
    const fil = STRINGS.fil[key];
    const en = STRINGS.en[key];
    if (currentLang === 'fil' && fil) return fil;
    if (en) return en;
    return key;  /* never break the UI — show the key if both are missing */
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'fil') lang = 'en';
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      const uid = (typeof window !== 'undefined' && window.__UG_CURRENT_UID) || '';
      if (uid) localStorage.setItem(STORAGE_KEY + '.' + uid, lang);
    } catch (e) {}
  }
  function getLang() { return currentLang; }
  function isFil() { return currentLang === 'fil'; }

  /* a small helper so screens can localize a value that already has both
     languages, e.g. pickLang(t.title_en, t.title_fil) */
  function pickLang(en, fil) {
    if (currentLang === 'fil' && fil) return fil;
    return en || fil || '';
  }

  return { t, setLang, getLang, isFil, pickLang, STRINGS };
})();
