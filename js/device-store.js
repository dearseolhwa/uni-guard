/* Shared IndexedDB schema for the app and service worker. */
const UG_DEVICE_DB = (function () {
  function open() {
    return new Promise((resolve, reject) => {
      let expired = false;
      const request = indexedDB.open('uniguard', 2);
      const timer = setTimeout(() => {
        expired = true;
        reject(new Error('IndexedDB timed out'));
      }, 4000);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('snapshot')) db.createObjectStore('snapshot');
        if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        if (db.objectStoreNames.contains('notifications')) db.deleteObjectStore('notifications');
        const notices = db.createObjectStore('notification_history', { keyPath: ['scope', 'id'] });
        notices.createIndex('created_at', ['scope', 'createdAt']);
        db.createObjectStore('push_settings');
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        db.onversionchange = () => db.close();
        if (expired) db.close();
        else resolve(db);
      };
      request.onerror = () => { clearTimeout(timer); reject(request.error); };
    });
  }

  function tx(name, mode, operation) {
    return open().then((db) => new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(name, mode);
        transaction.onabort = () => {
          db.close();
          reject(transaction.error || new Error('IndexedDB transaction aborted'));
        };
        let result;
        try { result = operation(transaction.objectStore(name)); }
        catch (error) { transaction.abort(); throw error; }
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

  const readPush = () => tx('push_settings', 'readonly', (store) => store.get('binding'));
  const savePush = (binding) => tx('push_settings', 'readwrite', (store) => store.put(binding, 'binding'));
  const withPushLock = (operation) => navigator.locks
    ? navigator.locks.request('uniguard-push-device', operation)
    : operation();
  return { tx, readPush, savePush, withPushLock };
})();
