/* Keep the most recent 200 inbox entries for the current account and role. */
const UG_NOTIF_STORE = (function () {
  const STORE = 'notification_history';
  const LIMIT = 200;
  const tx = (mode, operation) => UG_DEVICE_DB.tx(STORE, mode, operation).catch(() => null);
  const range = (scope) => IDBKeyRange.bound([scope, 0], [scope, Number.MAX_SAFE_INTEGER]);

  function mergeAll(rows) {
    const scope = UG_PWA.dataScope();
    if (!scope || !rows?.length) return Promise.resolve();
    return tx('readwrite', (store) => {
      for (const notice of rows) {
        if (!notice.id) continue;
        const createdAt = Math.max(0, Date.parse(notice.created_at) || 0);
        store.put({ scope, id: notice.id, createdAt, notice });
      }

      let retained = 0;
      const request = store.index('created_at').openCursor(range(scope), 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (++retained > LIMIT) cursor.delete();
        cursor.continue();
      };
    });
  }

  async function list() {
    const scope = UG_PWA.dataScope();
    if (!scope) return [];
    const rows = await tx('readonly', (store) => store.index('created_at').getAll(range(scope)));
    return UG_PWA.dataScope() === scope ? (rows || []).reverse().map((row) => row.notice) : [];
  }

  function markReadLocal(id) {
    const scope = UG_PWA.dataScope();
    if (!scope) return Promise.resolve();
    return tx('readwrite', (store) => {
      const request = store.get([scope, id]);
      request.onsuccess = () => {
        const row = request.result;
        if (!row) return;
        row.notice.unread = false;
        store.put(row);
      };
    });
  }

  function updateAccountRows(operation) {
    const scope = UG_PWA.dataScope();
    if (!scope) return Promise.resolve();
    return tx('readwrite', (store) => {
      const request = store.index('created_at').openCursor(range(scope));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        operation(cursor);
        cursor.continue();
      };
    });
  }

  function markAllReadLocal() {
    return updateAccountRows((cursor) => {
      const row = cursor.value;
      row.notice.unread = false;
      cursor.update(row);
    });
  }

  return { mergeAll, list, markReadLocal, markAllReadLocal, clear: () => updateAccountRows((cursor) => cursor.delete()) };
})();
