/* UniGuard · notification store
 *
 * One small IndexedDB-backed ring buffer that keeps the most recent 200
 * notifications on this device, so a citizen who closes the app and reopens it
 * still sees the alerts that came in between.
 *
 * This module is best-effort: it writes from JS, it never blocks the boot.
 * The live source of truth stays in Postgres (public.notifications), and the
 * store only exists to fill the gap between an advisory arriving on the wire
 * and the user opening the app to look at it.
 *
 * Used by js/app.js when computing the bell badge count, and by the
 * notifications screen to render the list when Supabase is unreachable.
 */
const UG_NOTIF_STORE = (function () {
  const DB_NAME = 'uniguard';
  const DB_VERSION = 1;
  const STORE = 'notifications';

  function openDB() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (e) { return resolve(null); }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('created_at', 'created_at');
        }
        if (!db.objectStoreNames.contains('snapshot')) { /* created by pwa.js */ }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
  }

  function tx(mode, fn) {
    return openDB().then((db) => {
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const t = db.transaction(STORE, mode);
          const os = t.objectStore(STORE);
          const out = fn(os);
          t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
          t.onerror = () => resolve(null);
          t.onabort = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    });
  }

  /* merge a fresh set from Repo.loadAll into the local store, capping at 200 */
  function mergeAll(rows) {
    if (!rows || !rows.length) return Promise.resolve();
    return tx('readwrite', (os) => {
      rows.forEach((r) => {
        try { os.put(r); } catch (e) {}
      });
    }).then(() => trim());
  }

  function trim() {
    return tx('readonly', (os) => os.count()).then((n) => {
      if (!n || n <= 200) return;
      return tx('readwrite', (os) => {
        const idx = os.index('created_at');
        const range = IDBKeyRange.upperBound(Date.now(), false);
        /* advance past everything we want to keep, then delete the rest */
        let skipped = 0;
        const keep = n - 200;
        const req = idx.openCursor(range);
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return;
          if (skipped < keep) { skipped++; cur.continue(); }
          else {
            /* we are now at the (keep+1)th oldest entry; nuke it and continue */
            os.delete(cur.primaryKey);
            cur.continue();
          }
        };
      });
    });
  }

  function list() {
    return tx('readonly', (os) => os.getAll()).then((rows) => {
      rows = rows || [];
      rows.sort((a, b) => {
        const ta = Date.parse(a.created_at || a.time || 0);
        const tb = Date.parse(b.created_at || b.time || 0);
        return tb - ta;
      });
      return rows;
    });
  }

  function markReadLocal(id) {
    return tx('readwrite', (os) => {
      const get = os.get(id);
      get.onsuccess = () => {
        if (get.result) { get.result.unread = false; get.result.read_at = new Date().toISOString(); os.put(get.result); }
      };
    });
  }

  function markAllReadLocal() {
    return tx('readwrite', (os) => {
      const req = os.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return;
        cur.value.unread = false;
        cur.value.read_at = new Date().toISOString();
        cur.update(cur.value);
        cur.continue();
      };
    });
  }

  return { mergeAll, list, markReadLocal, markAllReadLocal };
})();
