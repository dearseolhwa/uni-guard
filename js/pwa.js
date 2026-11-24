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
    failed: 0,
    unassigned: 0,
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
      try {
        const transaction = db.transaction(store, mode);
        transaction.onabort = () => {
          db.close();
          reject(transaction.error || new Error('IndexedDB transaction aborted'));
        };
        const result = fn(transaction.objectStore(store));
        transaction.oncomplete = () => {
          db.close();
          resolve(result instanceof IDBRequest ? result.result : result);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    }));
  }

  function snapshotKey(session = Auth.state.session || (UG_CONFIG.DEV ? window.UG_APP?.S.session : null)) {
    if (!session?.id) return null;
    return JSON.stringify([session.id, session.role, session.superAdmin, session.barangay_id,
      session.dispatch_unit_id, session.unit_role]);
  }

  /* The signed-in account and its current permissions own the snapshot. */
  function storeSnapshot(data) {
    const key = snapshotKey();
    if (!key) return Promise.resolve(false);
    const payload = {
      at: new Date().toISOString(),
      hotlines: data.hotlines || [],
      centers: data.centers || [],
      advisories: (data.advisories || []).filter((a) => a.severity !== 'prepared').slice(0, 20),
      incidents: (data.incidents || []).slice(0, 40).map((row) => ({ ...row, photo_url: null }))
    };
    return tx(STORE_SNAPSHOT, 'readwrite', (s) => s.put(payload, key)).then(() => {
      if (snapshotKey() === key) state.lastSync = payload.at;
      return true;
    }).catch(() => false);
  }

  async function readSnapshot() {
    const key = snapshotKey();
    if (!key) return null;
    const snapshot = await tx(STORE_SNAPSHOT, 'readonly', (s) => s.get(key)).catch(() => null);
    return snapshotKey() === key ? snapshot || null : null;
  }

  function clearSnapshot(session) {
    const key = snapshotKey(session);
    return tx(STORE_SNAPSHOT, 'readwrite', (s) => {
      s.delete('data');
      if (key) s.delete(key);
    }).catch(() => null);
  }

  /* wipe the whole offline queue. Not used by forceRefresh (that keeps the
     queue); kept for explicit administrative resets only. */
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
    const key = snapshotKey();
    const snap = await readSnapshot();
    if (!snap || snapshotKey() !== key) return false;
    if (snap.hotlines && snap.hotlines.length) UG.DATA.hotlines = snap.hotlines;
    if (snap.centers && snap.centers.length) UG.DATA.centers = snap.centers;
    if (snap.advisories && snap.advisories.length) UG.DATA.advisories = snap.advisories;
    if (snap.incidents && snap.incidents.length) UG.DATA.incidents = snap.incidents;
    state.lastSync = snap.at;
    return true;
  }

  /* ----------------------------------------------------------- offline queue */
  /* ask the browser to wake the page when the network returns (Background
     Sync, where supported); the worker then posts FLUSH_QUEUE */
  function requestBackgroundSync() {
    try {
      if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
      navigator.serviceWorker.ready.then((reg) => {
        if (reg && reg.sync && reg.sync.register) reg.sync.register('uniguard-queue').catch(() => null);
      }).catch(() => null);
    } catch (e) { /* best effort */ }
  }

  function queueOwner() {
    const session = Auth.state.session;
    if (session && session.id) return session.id;
    return UG_CONFIG.DEV && window.UG_APP?.S.session?.id === 'dev' ? 'dev' : null;
  }

  async function saveQueuedItem(write, ownerId) {
    if (!ownerId || ownerId !== queueOwner()) throw new Error('Sign in to the original account and try again.');
    try {
      await tx(STORE_QUEUE, 'readwrite', write);
    } catch (e) {
      throw new Error('Could not save on this device. Free up browser storage or reconnect and try again.');
    }
    requestBackgroundSync();
    return refreshQueueCount();
  }

  function enqueue(report, ownerId = queueOwner()) {
    return saveQueuedItem((store) => store.add(Object.assign({}, report, {
      owner_id: ownerId,
      queued_at: new Date().toISOString(),
      request_id: report.request_id || crypto.randomUUID(),
      revision: crypto.randomUUID()
    })), ownerId);
  }

  /* One person in danger tapping SOS again and again must not stack up rows:
     a queued SOS from the last 10 minutes is replaced by the newer position. */
  function upsertQueuedSos(row, ownerId = queueOwner()) {
    const stamp = new Date().toISOString();
    const cutoff = Date.now() - 10 * 60 * 1000;
    return saveQueuedItem((store) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const keep = request.result.filter((item) => item.owner_id === ownerId && item._kind === 'sos' && (
          (row.request_id && item.request_id === row.request_id) ||
          (!row.attempted && !item.attempted && Date.parse(item.client_sent_at || item.queued_at) >= cutoff)
        )).pop();
        const next = Object.assign({}, keep, row, {
          _kind: 'sos', owner_id: ownerId, queued_at: keep ? keep.queued_at : stamp, updated_at: stamp,
          request_id: keep?.request_id || row.request_id || crypto.randomUUID(),
          revision: crypto.randomUUID(), attempts: 0, failed: false, last_error: '',
          note: row.note || keep?.note || '', kind: row.kind || keep?.kind || 'other'
        });
        if (keep && row.lat == null) {
          next.lat = keep.lat; next.lng = keep.lng; next.accuracy = keep.accuracy;
        }
        store.put(next);
      };
    }, ownerId);
  }

  function readQueue() {
    return tx(STORE_QUEUE, 'readonly', (s) => s.getAll());
  }

  async function listQueue() {
    const ownerId = queueOwner();
    if (!ownerId) return [];
    const rows = await readQueue().catch(() => []);
    return queueOwner() === ownerId ? rows.filter((row) => row.owner_id === ownerId) : [];
  }

  function updateQueuedRow(id, ownerId, update, revision) {
    return tx(STORE_QUEUE, 'readwrite', (store) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const row = request.result;
        if (row && row.owner_id === ownerId && (revision === undefined || row.revision === revision)) {
          update(store, row);
        }
      };
    });
  }

  function removeFromQueue(id) {
    const ownerId = queueOwner();
    if (!ownerId) return Promise.resolve();
    return updateQueuedRow(id, ownerId, (store) => store.delete(id)).then(() => refreshQueueCount());
  }

  async function refreshQueueCount() {
    const rows = await readQueue().catch(() => []);
    const ownerId = queueOwner();
    const own = ownerId ? rows.filter((row) => row.owner_id === ownerId) : [];
    state.queued = own.length;
    state.failed = own.filter((row) => row.failed).length;
    state.unassigned = rows.filter((row) => !row.owner_id).length;
    emit();
    return state.queued;
  }

  const MAX_ATTEMPTS = 5;
  let flushing = false;

  /* Called on reconnect, on a timer while the app is open, and when the
     worker posts FLUSH_QUEUE. SOS rows go first. A network error stops the
     loop (everything waits for the next try); a server rejection only counts
     an attempt on that row and moves on, so one bad row never blocks the
     rest. After MAX_ATTEMPTS a row is marked failed and skipped until the
     resident retries it (opts.retryFailed). */
  async function flushQueue(opts) {
    opts = opts || {};
    const ownerId = queueOwner();
    if (!ownerId || flushing || !state.online || !Repo.online()) return 0;
    flushing = true;
    try {
      if (navigator.locks) {
        return await navigator.locks.request('uniguard-queue-' + ownerId, () => sendQueuedItems(ownerId, opts));
      }
      return await sendQueuedItems(ownerId, opts);
    } finally {
      flushing = false;
    }
  }

  async function sendQueuedItems(ownerId, opts) {
    if (queueOwner() !== ownerId) return 0;
    const rows = await listQueue();
    if (!rows.length) return 0;
    const upload = await Repo.queueUploadSession(ownerId);
    if (!upload || queueOwner() !== ownerId) return 0;
    let sent = 0;
    let reportsSent = false;
    try {
      rows.sort((a, b) => (a._kind === 'sos' ? 0 : 1) - (b._kind === 'sos' ? 0 : 1));
      for (const row of rows) {
        if (queueOwner() !== ownerId) break;
        if (row.failed && !opts.retryFailed) continue;
        let claimed = false;
        await updateQueuedRow(row.id, ownerId, (store, current) => {
          row.request_id = current.request_id || crypto.randomUUID();
          row.attempted = true;
          store.put(row);
          claimed = true;
        }, row.revision);
        if (!claimed || queueOwner() !== ownerId) continue;
        let sosResult;
        try {
          if (row._kind === 'sos') {
            const stamp = row.client_sent_at ? new Date(row.client_sent_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '';
            sosResult = await Repo.submitSos({
              request_id: row.request_id,
              lat: row.lat, lng: row.lng, accuracy: row.accuracy, kind: row.kind || 'other',
              /* the duty officer must know this SOS waited for a signal */
              note: ((row.note || '') + (stamp ? ' [Saved offline at ' + stamp + ']' : '')).trim()
            }, upload);
          } else {
            await Repo.createReport({
              request_id: row.request_id,
              hazard_type: row.hazard_type, hazard_other_text: row.hazard_other_text || '',
              barangay: row.barangay, description: row.description,
              severity: row.severity, urgency: row.urgency, lat: row.lat, lng: row.lng,
              location_note: row.location_note || '',
              photoBlob: row.photoBlob || null
            }, upload);
          }
        } catch (e) {
          if (UG_UTIL.isNetworkError(e)) break;
          row.attempts = (row.attempts || 0) + 1;
          row.last_error = UG_UTIL.friendlyError(e);
          row.failed = row.attempts >= MAX_ATTEMPTS;
          await updateQueuedRow(row.id, ownerId, (store) => store.put(row), row.revision);
          if (row._kind === 'sos' && queueOwner() === ownerId) {
            try { document.dispatchEvent(new CustomEvent('ug:sos-rejected', { detail: { row: row, message: row.last_error } })); } catch (e2) { }
          }
          continue;
        }
        sent++;
        if (row._kind === 'sos' && queueOwner() === ownerId) {
          document.dispatchEvent(new CustomEvent('ug:sos-delivered', { detail: { row: row, result: sosResult } }));
        }
        if (row._kind !== 'sos' || sosResult?.report_id) reportsSent = true;
        await updateQueuedRow(row.id, ownerId, (store) => store.delete(row.id), row.revision);
      }
    } finally {
      await refreshQueueCount();
    }
    if (sent && queueOwner() === ownerId) {
      await Repo.loadAll();
      if (reportsSent && queueOwner() === ownerId) document.dispatchEvent(new Event('ug:report-queue-sent'));
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
    let refreshed = false, partial = false;
    /* delegate the session-revive + reload to Repo.forceReload so the same
       recovery path runs whether the user taps "Retry" in the banner or
       "Back online" on the citizen screen. */
    try {
      if (typeof Repo !== 'undefined' && Repo.forceReload) {
        const r = await Repo.forceReload();
        partial = !!r?.partial;
        refreshed = !!(r && r.ok && !partial && Repo.state.source === 'supabase');
      } else if (Repo.online()) {
        await Repo.loadAll(); refreshed = Repo.state.source === 'supabase';
      }
    } catch (e) { refreshed = false; }
    emit();
    return { online: state.online, uploaded: uploaded, refreshed: refreshed, partial, queued: state.queued || 0 };
  }

  /* ------------------------------------------------------- force refresh */
  /* Escape hatch: drop the worker, every cache, the IndexedDB snapshot and the
     local notifications so a device holding on to an older build (or a bad
     cached snapshot that throws on hydrate) starts clean. The offline queue is
     NEVER cleared here: it holds reports and SOS a resident has not been able
     to send yet. A row the server keeps refusing is marked failed by
     flushQueue and shown in My Reports, where the resident can retry or
     delete it. */
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
    try { await clearSnapshot(); } catch (e) {}
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
    tx(STORE_SNAPSHOT, 'readwrite', (store) => store.delete('data')).catch(() => {});

    const syncQueue = () => { if (state.online) return flushQueue().catch(() => {}); };
    const sync = () => {
      state.online = navigator.onLine !== false;
      emit();
      syncQueue();
    };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);

    /* the worker's Background Sync hook asks the page to send the queue */
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'FLUSH_QUEUE') syncQueue();
        });
      }
    } catch (e) { /* best effort */ }

    register().then(syncQueue);
    Auth.onChange(() => refreshQueueCount());
    refreshQueueCount();
    setInterval(syncQueue, UG_CONFIG.SYNC_RETRY_MS);
  }

  return {
    state, onChange, init, register, flushQueue, forceRefresh, retryNow,
    enqueue, upsertQueuedSos, listQueue, removeFromQueue, refreshQueueCount,
    storeSnapshot, readSnapshot, clearSnapshot, clearQueue, clearNotifications,
    hydrateFromCache,
    enablePush, pushEnabled, pushSupported
  };
})();
