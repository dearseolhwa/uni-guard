/* UniGuard · service worker
 *
 * Caches the application shell so the app opens without a connection, keeps the
 * map tiles and the last synced data available, and serves a push notification
 * payload sent by the push-dispatch Edge Function.
 */
const VERSION = 'uniguard-v3';
const SHELL = 'uniguard-shell-' + VERSION;
const TILES = 'uniguard-tiles-' + VERSION;
const IMAGES = 'uniguard-images-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './env.js',
  './privacy.html',

  './css/base.css',
  './css/tokens.css',
  './css/fonts.css',
  './css/app.css',
  './css/screens.css',

  './fonts/archivo-500.woff2',
  './fonts/ibmplexsans-400.woff2',
  './fonts/ibmplexmono-400.woff2',
  './fonts/ibmplexmono-500.woff2',
  './fonts/ibmplexmono-600.woff2',

  './vendor/leaflet.css',
  './vendor/leaflet.js',
  './vendor/supabase.js',
  './vendor/images/layers.png',
  './vendor/images/layers-2x.png',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-icon-2x.png',
  './vendor/images/marker-shadow.png',

  './js/config.js',
  './js/util.js',
  './js/screens.js',
  './js/screens.web.js',
  './js/screens.auth.js',
  './js/screens.admin.js',
  './js/repo.js',
  './js/auth.js',
  './js/map.js',
  './js/features.js',
  './js/pwa.js',
  './js/app.js',

  './icons-192.png',
  './icons-512.png',
  './icons-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(PRECACHE).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => [SHELL, TILES, IMAGES].indexOf(k) === -1).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

/* Trim the tile cache so a long lived install cannot grow without bound. */
async function trimCache(name, maxEntries) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)));
}

/* Code and markup must always be able to update. Network first, cache as the
   offline fallback, so an installed app never gets stuck on an old build. */
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw e;
  }
}

/* Fonts, vendor libraries and icons rarely change, so serve them from cache. */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* never intercept the API or auth traffic */
  if (/\.supabase\.co$/.test(url.hostname) || /\/(auth|rest|storage|functions)\/v1\//.test(url.pathname)) {
    return;
  }

  /* map tiles: stale while revalidate, capped */
  if (/tile\.openstreetmap\.org$/.test(url.hostname)) {
    event.respondWith(
      caches.open(TILES).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.status === 200) { cache.put(req, res.clone()); trimCache(TILES, 400); }
          return res;
        }).catch(() => hit);
        return hit || network;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* the shell: mark up and code update from the network whenever it is reachable */
  if (req.mode === 'navigate' || /\.(?:js|css|html|json)$/.test(url.pathname) || url.pathname.endsWith('/')) {
    event.respondWith(
      networkFirst(req, SHELL).catch(() => caches.match('./index.html'))
    );
    return;
  }

  /* immutable-ish assets */
  event.respondWith(cacheFirst(req, IMAGES));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHES') {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
});

/* --------------------------------------------------------------- web push */
self.addEventListener('push', (event) => {
  let payload = { title: 'UniGuard alert', body: 'Open UniGuard for details.', severity: 'advisory' };
  try { if (event.data) payload = Object.assign(payload, event.data.json()); }
  catch (e) { if (event.data) payload.body = event.data.text(); }

  const colour = payload.severity === 'emergency' ? '#FF5A5F'
    : payload.severity === 'warning' ? '#FFB020'
    : payload.severity === 'prepared' ? '#2FD08A' : '#4D9BFF';

  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: './icons-192.png',
    badge: './icons-192.png',
    tag: payload.tag || payload.advisory_id || 'uniguard',
    renotify: !!payload.renotify,
    requireInteraction: payload.severity === 'emergency',
    data: { url: payload.url || './index.html', advisory_id: payload.advisory_id || null },
    vibrate: payload.severity === 'emergency' ? [200, 80, 200, 80, 200] : [120]
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(target); return client.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});

/* Queued reports are flushed by the page on reconnect; a background sync hook
   is registered here so the browser can wake the page when it regains network. */
self.addEventListener('sync', (event) => {
  if (event.tag === 'uniguard-queue') {
    event.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
      list.forEach((c) => c.postMessage({ type: 'FLUSH_QUEUE' }));
    }));
  }
});
