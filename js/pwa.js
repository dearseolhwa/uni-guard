/* UniGuard · progressive web app layer
 * Service worker registration, real connectivity state, the IndexedDB cache for
 * hotlines / centres / critical advisories, the offline report queue, and web
 * push subscription.
 */
const UG_PWA = (function () {
  const DB_NAME = 'uniguard';
  const DB_VERSION = 1;
  const STORE_SNAPSHOT = 'snapshot';
  const STORE_QUEUE = 'queue';

  const state = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    swReady: false,
    queued: 0,
    lastSync: null,
    reloaded: false
  };

  const watchers = new Set();
  function onChange(fn) { watchers.add(fn); return () => watchers.delete(fn); }
  function emit() { watchers.forEach((fn) => { try { fn(state); } catch (e) {} }); }

  /* ---------------------------------------------------------------- storage */
  function openDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
      /* a blocked or unavailable store must never stall the boot sequence */
      const timer = setTimeout(() => reject(new Error('IndexedDB timed out')), 4000);
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { clearTimeout(timer); return reject(e); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SNAPSHOT)) db.createObjectStore(STORE_SNAPSHOT);
        if (!db.objectStoreNames.contains(STORE_QUEUE)) db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
      req.onerror = () => { clearTimeout(timer); reject(req.error); };
      req.onblocked = () => { clearTimeout(timer); reject(new Error('IndexedDB blocked')); };
    });
  }

  function tx(store, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
    }));
  }

  /* Keep only what an offline resident needs: hotlines, centres, critical advisories. */
  function storeSnapshot(data) {
    const payload = {
      at: new Date().toISOString(),
      hotlines: data.hotlines || [],
      centers: data.centers || [],
      advisories: (data.advisories || []).filter((a) => a.severity !== 'prepared').slice(0, 20),
      incidents: (data.incidents || []).slice(0, 40)
    };
    state.lastSync = payload.at;
    return tx(STORE_SNAPSHOT, 'readwrite', (s) => s.put(payload, 'data')).catch(() => null);
  }

  function readSnapshot() {
    return tx(STORE_SNAPSHOT, 'readonly', (s) => s.get('data')).catch(() => null);
  }

    function clearSnapshot() {
    return tx(STORE_SNAPSHOT, 'readwrite', (s) => s.delete('data')).catch(() => null);
  }

  /* wipe the offline report queue (used by force refresh so a bad queued row
     cannot resurface and re-trigger the same error after the reload). */
  function clearQueue() {
    return tx(STORE_QUEUE, 'readwrite', (s) => s.clear()).catch(() => null);
  }

  /* wipe the local notifications ring buffer (same DB, different store; created
     by js/notifications-store.js). Best-effort: if the store does not exist on
     this connection the clear is a no-op. */
  function clearNotifications() {
    return openDB().then((db) => {
      if (!db) return null;
      if (!db.objectStoreNames.contains('notifications')) return null;
      return new Promise((resolve) => {
        try {
          const t = db.transaction('notifications', 'readwrite');
          t.objectStore('notifications').clear();
          t.oncomplete = () => resolve(true);
          t.onerror = () => resolve(null);
          t.onabort = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    }).catch(() => null);
  }
  async function hydrateFromCache() {
    const snap = await readSnapshot();
    if (!snap) return false;
    if (snap.hotlines && snap.hotlines.length) UG.DATA.hotlines = snap.hotlines;
    if (snap.centers && snap.centers.length) UG.DATA.centers = snap.centers;
    if (snap.advisories && snap.advisories.length) UG.DATA.advisories = snap.advisories;
    if (snap.incidents && snap.incidents.length) UG.DATA.incidents = snap.incidents;
    state.lastSync = snap.at;
    return true;
  }

  /* ----------------------------------------------------------- offline queue */
  function enqueue(report) {
    return tx(STORE_QUEUE, 'readwrite', (s) => s.add(Object.assign({ queued_at: new Date().toISOString() }, report)))
      .then(() => refreshQueueCount())
      .catch(() => null);
  }

  function listQueue() {
    return tx(STORE_QUEUE, 'readonly', (s) => s.getAll()).catch(() => []);
  }

  function removeFromQueue(id) {
    return tx(STORE_QUEUE, 'readwrite', (s) => s.delete(id)).then(() => refreshQueueCount()).catch(() => null);
  }

  async function refreshQueueCount() {
    const rows = await listQueue();
    state.queued = (rows || []).length;
    emit();
    return state.queued;
  }

  /* Called on reconnect and on a timer while the app is open. */
  async function flushQueue() {
    if (!state.online || !Repo.online()) return 0;
    const rows = await listQueue();
    if (!rows || !rows.length) return 0;
    let sent = 0;
        for (const row of rows) {
      try {
        if (row._kind === 'sos') {
          await Repo.submitSos({ lat: row.lat, lng: row.lng, accuracy: row.accuracy, note: row.note });
        } else {
          await Repo.createReport({
            hazard_type: row.hazard_type, hazard_other_text: row.hazard_other_text || '',
            barangay: row.barangay, description: row.description,
            severity: row.severity, urgency: row.urgency, lat: row.lat, lng: row.lng,
            location_note: row.location_note || '',
            photoBlob: row.photoBlob || null, reportCodeHint: 'offline'
          });
        }
        await removeFromQueue(row.id);
        sent++;
      } catch (e) { break; }
    }
    if (sent) {
      await Repo.loadAll();
      emit();
    }
    return sent;
  }

  /* ------------------------------------------------------------- service worker */
  async function register() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.register('sw.js', {
        /* never serve the worker script itself from the HTTP cache, so a new build
           is always noticed on the next open */
        updateViaCache: 'none'
      });
      state.swReady = true;
      emit();

      /* A new build must reach installed users. When a replacement worker has
         finished installing, activate it and reload once so the shell is new. */
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state !== 'installed') return;
          if (!navigator.serviceWorker.controller) return;   /* very first install */
          if (state.reloaded) return;
          state.reloaded = true;
          try { sw.postMessage('SKIP_WAITING'); } catch (e) {}
        });
      });

      if (navigator.serviceWorker.addEventListener) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (state.reloaded) return;
          state.reloaded = true;
          try { location.reload(); } catch (e) {}
        });
      }

      /* check for a new build on every open, and hourly while the app stays open */
      try { reg.update(); } catch (e) {}
      setInterval(() => { try { reg.update(); } catch (e) {} }, 60 * 60 * 1000);

      return true;
    } catch (e) {
      state.swReady = false;
      return false;
    }
  }

  /* --------------------------------------------------------------- web push */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function pushSupported() {
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
      typeof window !== 'undefined' && 'PushManager' in window && !!UG_CONFIG.VAPID_PUBLIC_KEY;
  }

  async function enablePush() {
    if (!(await pushSupported())) {
      throw new Error('Push notifications are not available in this browser, or the push key is not configured.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(UG_CONFIG.VAPID_PUBLIC_KEY)
    });

    const c = Repo.client();
    if (c) {
      /* fetch the signed-in user id — the push_subscriptions table has a
         NOT NULL user_id + an RLS policy that requires user_id = auth.uid().
         The old version never set user_id, so every insert was silently
         rejected by RLS and the table stayed empty ("no push devices
         registered yet"). */
      const { data: userData } = await c.auth.getUser();
      const userId = userData && userData.user ? userData.user.id : null;
      if (!userId) throw new Error('Sign in to enable push notifications.');
      const json = sub.toJSON();
      const { error: upErr } = await c.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys ? json.keys.p256dh : '',
        auth: json.keys ? json.keys.auth : '',
        user_agent: navigator.userAgent.slice(0, 200)
      }, { onConflict: 'endpoint' });
      if (upErr) {
        /* surface the real reason instead of swallowing it, so a misconfigured
           RLS policy or missing column no longer looks like "success". */
        throw new Error('Could not save your push subscription: ' + (upErr.message || upErr.code || 'unknown error'));
      }
    }
    return true;
  }

  async function pushEnabled() {
    if (!(await pushSupported())) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      return !!(await reg.pushManager.getSubscription());
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------- retry connection */
  /* Used by the Back Online control. It asks the browser again, sends anything
     queued, revives the auth session if it expired (the #1 cause of "stuck
     offline"), and reloads the data, then reports honestly what happened. */
  async function retryNow() {
    state.online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    if (!state.online) { emit(); return { online: false, uploaded: 0, refreshed: false, queued: state.queued || 0 }; }
    let uploaded = 0;
    try { uploaded = await flushQueue(); } catch (e) { uploaded = 0; }
    let refreshed = false;
    /* delegate the session-revive + reload to Repo.forceReload so the same
       recovery path runs whether the user taps "Retry" in the banner or
       "Back online" on the citizen screen. */
    try {
      if (typeof Repo !== 'undefined' && Repo.forceReload) {
        const r = await Repo.forceReload();
        refreshed = !!(r && r.ok && Repo.state.source === 'supabase');
      } else if (Repo.online()) {
        await Repo.loadAll(); refreshed = Repo.state.source === 'supabase';
      }
    } catch (e) { refreshed = false; }
    emit();
    return { online: state.online, uploaded: uploaded, refreshed: refreshed, queued: state.queued || 0 };
  }

  /* ------------------------------------------------------- force refresh */
  /* Escape hatch: drop the worker, every cache AND the IndexedDB snapshot /
     queue so a device that is somehow holding on to an older build (or a bad
     cached row that throws on hydrate) starts completely clean. The previous
     version only cleared caches, so on reload hydrateFromCache() reloaded the
     same stale snapshot and the error came right back. */
  async function forceRefresh() {
    try {
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => null)));
      }
    } catch (e) { /* keep going */ }
    try {
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* keep going */ }
    /* wipe the IndexedDB stores so a stale snapshot / queued report can no
       longer resurface after the reload and re-trigger the same error. */
    try { await clearSnapshot(); } catch (e) {}
    try { await clearQueue(); } catch (e) {}
    try { await clearNotifications(); } catch (e) {}
    /* bust the HTTP cache on the shell so the newest index.html / sw.js is
       fetched, then reload. */
    try { location.reload(); } catch (e) {}
    return true;
  }

  /* ------------------------------------------------------------------- wire */
  function init() {
    if (typeof window === 'undefined') return;
    window.UG_CACHE = { storeSnapshot: storeSnapshot, readSnapshot: readSnapshot, hydrateFromCache: hydrateFromCache };

    const sync = () => {
      state.online = navigator.onLine !== false;
      emit();
      if (state.online) flushQueue();
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);

    register().then(() => { if (state.online) flushQueue(); });
    refreshQueueCount();
    setInterval(() => { if (state.online) flushQueue(); }, UG_CONFIG.SYNC_RETRY_MS);
  }

  return {
    state, onChange, init, register, flushQueue, forceRefresh, retryNow,
    enqueue, listQueue, removeFromQueue, refreshQueueCount,
    storeSnapshot, readSnapshot, clearSnapshot, clearQueue, clearNotifications,
    hydrateFromCache,
    enablePush, pushEnabled, pushSupported
  };
})();
