/* UniGuard · service worker
 *
 * Caches the application shell so the app opens without a connection, keeps the
 * map tiles and the last synced data available, and serves a push notification
 * payload sent by the push-dispatch Edge Function.
 */
importScripts('./js/device-store.js');

const VERSION = 'uniguard-v637';
const SHELL = 'uniguard-shell-' + VERSION;
const TILES = 'uniguard-tiles-' + VERSION;
const IMAGES = 'uniguard-images-' + VERSION;
const APP_ICON = './icons-192.png?v=565';
const ICONS = ['./favicon.ico?v=565', APP_ICON, './icons-512.png?v=565', './icons-maskable-512.png?v=565'];
const RELIEF_SAMPLE_IMAGES = ['authorization', 'indigency', 'photo-id', 'residence', 'checklist']
  .map((name) => './img/relief-documents/' + name + '.webp');
const SHELL_IMAGE_URLS = new Set([...ICONS, ...RELIEF_SAMPLE_IMAGES].map((path) => new URL(path, self.location.href).href));

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

  './vendor/leaflet.css',
  './vendor/leaflet.js',
  './vendor/supabase.js',
  './vendor/jspdf.umd.min.js',
  './vendor/jspdf.plugin.autotable.min.js',
  './vendor/images/layers.png',
  './vendor/images/layers-2x.png',
  './vendor/images/marker-icon.png',
  './vendor/images/marker-icon-2x.png',
  './vendor/images/marker-shadow.png',

  './js/config.js',
  './js/util.js',
  './js/i18n.js',
  './js/export-core.js',
  './js/pdf.js',
  './js/xlsx-lite.js',
  './js/exports.js',
  './js/reporting.js',
  './js/screens.js',
  './js/rail.js',
  './js/screens.web.js',
  './js/screens.auth.js',
  './js/screens.admin.js',
  './js/screens.superadmin.js',
  './js/repo.js',
  './js/auth.js',
  './js/route.js',
  './js/map.js',
  './js/features.js',
  './js/pwa.js',
  './js/device-store.js',
  './js/app.js',

  './css/screens-additions.css',
  './css/dispatch.css',
  './css/design.css',
  './css/superadmin.css',
  './css/resident.css',
  './css/barangay.css',
  './css/dispatch-portal.css',
  './css/auth.css',
  './css/staff-pages.css',
  './css/soft-accents.css',
  './css/type.css',
  './css/rail.css',
  './css/notif-panel.css',
  './img/rescue.jpg',
  './img/ldrrmo-lingayen.png',
  './js/geo.js',
  './js/theme.js',
  './js/hazard-types.js',
  './js/alarm.js',
  './js/relief.js',
  './js/settings.js',
  './js/guides.js',
  './js/faqs.js',
  './js/roadwork.js',
  './js/sos.js',
  './js/resident.js',
  './js/barangay.js',
  './js/notifications-store.js',
  './js/urgent-alerts.js',
  './js/dispatch.js',

  ...ICONS,
  ...RELIEF_SAMPLE_IMAGES
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => null))))
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
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  const shellNavigation = req.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  try {
    /* 'no-cache' makes the browser re-check every file with the server, so a
       code or style change shows on the next refresh (the plain fetch could
       return a stale copy from the browser's own HTTP cache) */
    const res = await fetch(req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' }));
    if (res.ok && !res.redirected) {
      if (shellNavigation) {
        if (!url.search) await cache.put('./index.html', res.clone()).catch(() => {});
      } else if (res.status === 200 && res.type === 'basic') {
        await cache.put(req, res.clone()).catch(() => {});
      }
    }
    return res;
  } catch (e) {
    const hit = await cache.match(shellNavigation ? './index.html' : req, { ignoreSearch: req.mode !== 'navigate' });
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
    if (/tile\.openstreetmap\.org$/.test(url.hostname) || /arcgisonline\.com$/.test(url.hostname)) {
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

  if (SHELL_IMAGE_URLS.has(url.href)) {
    event.respondWith(cacheFirst(req, SHELL));
    return;
  }

  /* the shell: mark up and code update from the network whenever it is reachable */
  if (req.mode === 'navigate' || /\.(?:js|css|html|json)$/.test(url.pathname) || url.pathname.endsWith('/')) {
    event.respondWith(
      networkFirst(req, SHELL).catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
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

  event.waitUntil((async () => {
    if (Date.parse(payload.expires_at) <= Date.now()) return;
    const binding = await UG_DEVICE_DB.readPush().catch(() => ({ suspended: true }));
    if (!binding?.owner || binding.suspended || (payload.recipient_id && payload.recipient_id !== binding.owner)) return;
    await Promise.all([
      notifyWindows({ type: 'UG_PUSH', payload, ownerId: binding.owner }),
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: APP_ICON,
        badge: APP_ICON,
        tag: payload.tag || payload.advisory_id || 'uniguard',
        renotify: !!payload.renotify,
        requireInteraction: payload.severity === 'emergency',
        data: { url: payload.url || './index.html', advisory_id: payload.advisory_id || null },
        vibrate: payload.severity === 'emergency' ? [200, 80, 200, 80, 200] : [120]
      })
    ]);
  })());
});

async function notifyWindows(message) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  list.filter((client) => client.url.startsWith(self.registration.scope)).forEach((client) => client.postMessage(message));
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(UG_DEVICE_DB.withPushLock(async () => {
    const binding = await UG_DEVICE_DB.readPush();
    if (!binding?.owner || !binding.token || binding.suspended) return;
    if (event.oldSubscription && event.oldSubscription.endpoint !== binding.endpoint) return;
    const manager = self.registration.pushManager;
    const subscription = event.newSubscription || await manager.getSubscription() ||
      await manager.subscribe({ userVisibleOnly: true, applicationServerKey: binding.applicationServerKey });
    const json = subscription.toJSON();
    const response = await fetch(new URL('/rest/v1/rpc/renew_mobile_push_device', binding.project), {
      method: 'POST',
      redirect: 'error',
      headers: { apikey: binding.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_previous_endpoint: binding.endpoint, p_renewal_token: binding.token,
        p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth
      })
    });
    if (response.ok && await response.json() === true) {
      await UG_DEVICE_DB.savePush({ ...binding, endpoint: json.endpoint });
    }
    // If the server already discarded the old endpoint, the signed-in page
    // registers the new endpoint on its next foreground reconciliation.
  }).catch(() => {}).then(() => notifyWindows({ type: 'UG_PUSH_SUBSCRIPTION_CHANGED' })));
});

function notificationTarget(value) {
  const scope = self.registration.scope;
  const fallback = new URL('./index.html', scope).href;
  try {
    const target = new URL(value || fallback, scope);
    return target.href.startsWith(scope) ? target.href : fallback;
  } catch (e) {
    return fallback;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = notificationTarget(event.notification.data?.url);
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = list.find((item) => 'focus' in item && item.url.startsWith(self.registration.scope));
    if (client) {
      try {
        const focused = await client.focus();
        if (focused && (focused.url === target || await focused.navigate(target))) return;
      } catch (e) { /* the window may have closed */ }
    }
    return self.clients.openWindow(target);
  })());
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
