/* UniGuard · progressive web app layer
 * Service worker registration, real connectivity state, the IndexedDB cache for
 * hotlines / centres / critical advisories, the offline report queue, and web
 * push subscription.
 */
const UG_PWA = (function () {
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
  const tx = UG_DEVICE_DB.tx;

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
    if (Auth.state.session?.role === 'citizen' && data.reliefSchedulesSyncedAt) {
      payload.reliefSchedulesSyncedAt = data.reliefSchedulesSyncedAt;
      payload.relief = (data.relief || []).filter((row) => row.active !== false)
        .map(({ id, barangay, barangay_id, title, location_name, address, lat, lng, distribution_at,
          contact_person, contact_phone, eligibility, required_docs, note }) =>
          ({ id, barangay, barangay_id, title, location_name, address, lat, lng, distribution_at,
            contact_person, contact_phone, eligibility, required_docs, note, active: true }));
    }
    return tx(STORE_SNAPSHOT, 'readwrite', (s) => s.put(payload, key)).then(() => {
      if (snapshotKey() === key) state.lastSync = payload.at;
      return true;
    }).catch(() => false);
  }

  const savedAdvisoriesKey = (scope) => JSON.stringify([scope, 'saved-advisories']);

  async function saveAdvisory(advisory) {
    const scope = snapshotKey();
    if (!scope || !advisory?.id) return false;
    try {
      await tx(STORE_SNAPSHOT, 'readwrite', (store) => {
        const key = savedAdvisoriesKey(scope);
        const request = store.get(key);
        request.onsuccess = () => {
          const saved = Array.isArray(request.result) ? request.result : [];
          store.put([advisory, ...saved.filter((row) => row.id !== advisory.id)], key);
        };
      });
      return snapshotKey() === scope;
    } catch (e) { return false; }
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
      if (key) { s.delete(key); s.delete(savedAdvisoriesKey(key)); }
    }).catch(() => null);
  }

  /* wipe the whole offline queue. Not used by forceRefresh (that keeps the
     queue); kept for explicit administrative resets only. */
  function clearQueue() {
    return tx(STORE_QUEUE, 'readwrite', (s) => s.clear()).catch(() => null);
  }

  function clearNotifications() {
    return UG_NOTIF_STORE.clear();
  }
  async function hydrateFromCache() {
    const key = snapshotKey();
    if (!key) return false;
    const [snap, saved] = await Promise.all([
      readSnapshot(),
      tx(STORE_SNAPSHOT, 'readonly', (store) => store.get(savedAdvisoriesKey(key))).catch(() => null)
    ]);
    if (snapshotKey() !== key || (!snap && !saved?.length)) return false;
    if (snap?.hotlines) UG.DATA.hotlines = snap.hotlines;
    if (snap?.centers) UG.DATA.centers = snap.centers;
    if (snap?.incidents) UG.DATA.incidents = snap.incidents;
    if (Auth.state.session?.role === 'citizen' && Array.isArray(snap?.relief) && snap.reliefSchedulesSyncedAt) {
      UG.DATA.relief = snap.relief;
      UG.DATA.reliefSchedulesSyncedAt = snap.reliefSchedulesSyncedAt;
      UG.DATA.reliefSchedulesCached = true;
    }
    const advisories = new Map((snap?.advisories || []).map((row) => [row.id, row]));
    for (const row of saved || []) {
      if (!advisories.has(row.id)) advisories.set(row.id, row);
    }
    if (snap || saved?.length) UG.DATA.advisories = [...advisories.values()];
    state.lastSync = snap?.at || null;
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
    state.queueKey = JSON.stringify(own.map((row) => [row.id, row.revision, row.attempts]));
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
      let controlled = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register('sw.js', {
        /* never serve the worker script itself from the HTTP cache, so a new build
           is always noticed on the next open */
        updateViaCache: 'none'
      });
      state.swReady = true;
      emit();

      if (navigator.serviceWorker.addEventListener) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!controlled) { controlled = true; return; }
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
    if (!(await pushSupported()) || !Auth.state.session || !Repo.client()) {
      throw new Error('Sign in on a supported browser to enable push notifications.');
    }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');
    if (!(await syncPushDevice(true))) throw new Error('Could not register push notifications on this device.');
    return true;
  }

  async function syncPushDevice(create) {
    const owner = Auth.state.session;
    if (!owner || !Repo.client() || !state.online) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.active || !reg.pushManager) return false;
    const applicationServerKey = urlBase64ToUint8Array(UG_CONFIG.VAPID_PUBLIC_KEY);
    return UG_DEVICE_DB.withPushLock(async () => {
      if (Auth.state.session?.id !== owner.id) return false;
      const credential = await Repo.queueUploadSession(owner.id);
      if (!credential) return false;
      const c = credential.client;
      const binding = await UG_DEVICE_DB.readPush();
      const subscribe = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      let sub = await reg.pushManager.getSubscription();
      if (!sub && !create) return false;

      if (sub && binding?.owner === owner.id && binding.endpoint === sub.endpoint && !binding.suspended) {
        const existing = await c.from('push_subscriptions').select('id')
          .eq('user_id', owner.id).eq('endpoint', sub.endpoint).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) return Auth.state.session?.id === owner.id;
      }

      const previous = binding?.owner === owner.id ? binding.endpoint : null;
      const token = binding?.owner === owner.id && binding.token ? binding.token : crypto.randomUUID();
      const save = async (subscription) => {
        if (Auth.state.session?.id !== owner.id) return false;
        const json = subscription.toJSON();
        const { data, error } = await c.rpc('sync_mobile_push_device', {
          p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth,
          p_user_agent: navigator.userAgent, p_renewal_token: token, p_previous_endpoint: previous
        });
        if (error) throw error;
        return data === true;
      };

      // Suppress old-account notifications during a handoff.
      if (binding?.owner !== owner.id) {
        await UG_DEVICE_DB.savePush({ suspended: true });
        if (binding?.owner && sub) {
          await sub.unsubscribe();
          sub = await reg.pushManager.getSubscription();
          if (sub) return false;
        }
      }
      if (!sub) sub = await subscribe();
      if (!(await save(sub))) {
        await sub.unsubscribe();
        if (await reg.pushManager.getSubscription()) return false;
        sub = await subscribe();
        if (!(await save(sub))) return false;
      }
      if (Auth.state.session?.id !== owner.id) return false;
      await UG_DEVICE_DB.savePush({
        owner: owner.id, endpoint: sub.endpoint, token, applicationServerKey,
        project: UG_CONFIG.SUPABASE_URL, apiKey: UG_CONFIG.SUPABASE_ANON_KEY
      });
      return true;
    });
  }

  async function pushEnabled() {
    if (!(await pushSupported()) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    try { return await syncPushDevice(false); }
    catch (e) { return false; }
  }

  async function releasePush(userId) {
    if (!userId || !navigator.serviceWorker) return;
    try {
      await UG_DEVICE_DB.withPushLock(async () => {
        const binding = await UG_DEVICE_DB.readPush();
        if (binding?.owner && binding.owner !== userId) return;
        await UG_DEVICE_DB.savePush({ suspended: true });
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg?.pushManager) return;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        const notices = await reg.getNotifications();
        notices.forEach((notice) => notice.close());
        const endpoint = sub?.endpoint || binding?.endpoint;
        if (endpoint && navigator.onLine !== false) {
          const credential = await Repo.queueUploadSession(userId);
          if (credential) {
            await credential.client.from('push_subscriptions').delete().eq('user_id', userId)
              .eq('endpoint', endpoint).abortSignal(AbortSignal.timeout(3000));
          }
        }
      });
    } catch (e) { /* a later sign-in reconciles the device */ }
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
          if (e.data?.type === 'FLUSH_QUEUE') syncQueue();
          if (e.data?.type === 'UG_PUSH_SUBSCRIPTION_CHANGED') {
            document.dispatchEvent(new Event('ug:push-device-changed'));
          }
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
    storeSnapshot, readSnapshot, clearSnapshot, clearQueue, clearNotifications, dataScope: snapshotKey,
    hydrateFromCache, saveAdvisory,
    enablePush, pushEnabled, pushSupported, releasePush
  };
})();
