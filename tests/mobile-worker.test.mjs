import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const origin = 'https://pwa.example.test';
const scope = origin + '/';
const recached = './index.html';

function worker({ network = fetch, binding, clients = [] } = {}) {
  const handlers = {};
  const posts = [], opened = [], notices = [], entries = new Map();
  const context = {
    URL, Request, Response, fetch: network, importScripts: () => {},
    caches: { open: async () => ({
      put: async (key, res) => { entries.set(key.url || key, res); },
      match: async (key) => entries.get(key.url || key)
    }) },
    UG_DEVICE_DB: {
      readPush: async () => binding,
      savePush: async (value) => { binding = value; },
      withPushLock: (fn) => fn()
    },
    self: {
      location: { href: scope + 'sw.js', origin },
      addEventListener: (type, listener) => { handlers[type] = listener; },
      clients: {
        matchAll: async () => clients.map((client) => ({ ...client, postMessage: (info) => posts.push(info) })),
        openWindow: async (url) => { opened.push(url); }
      },
      registration: {
        scope, showNotification: async (title) => { notices.push(title); },
        pushManager: { getSubscription: async () => null }
      }
    }
  };
  runInNewContext(source, context);
  return {
    posts, opened, notices, entries,
    binding: () => binding,
    dispatch(type, extra = {}) {
      let result;
      handlers[type]({ waitUntil: (promise) => { result = promise; }, respondWith: (promise) => { result = promise; }, ...extra });
      return result;
    },
    precache: runInNewContext('JSON.stringify(PRECACHE)', context)
  };
}

test('focuses a background window before navigation and opens a fallback if navigation fails', async () => {
  const calls = [];
  const target = './index.html#sos';
  const w = worker({ clients: [{ url: scope, focus: async () => {
    calls.push('focus');
    return { url: scope, navigate: async () => { calls.push('navigate'); throw Error('closed'); } };
  } }] });
  await w.dispatch('notificationclick', { notification: { close: () => calls.push('close'), data: { url: target } } });
  assert.deepEqual(calls, ['close','focus','navigate']);
  assert.deepEqual(w.opened, [scope + 'index.html#sos']);
});

test('notification URLs outside the app are replaced with the home page', async () => {
  const w = worker();
  await w.dispatch('notificationclick', { notification: { close: () => {}, data: { url: 'https://other.example.test' } } });
  assert.deepEqual(w.opened, [scope + 'index.html']);
});

test('navigation refreshes the canonical offline shell while query links stay out of the cache', async () => {
  let version = 'fresh shell';
  const w = worker({ network: async () => {
    if (!version) throw Error('offline');
    return new Response(version);
  } });
  const visit = (path) => w.dispatch('fetch', { request: { method: 'GET', mode: 'navigate', url: scope + path } });
  await visit('');
  assert.equal(await w.entries.get(recached).clone().text(), 'fresh shell');
  version = 'session query page';
  await visit('index.html?code=fixture');
  version = '';
  assert.equal(await (await visit('index.html')).text(), 'fresh shell');
  assert.deepEqual([...w.entries.keys()], [recached]);
  for (const path of JSON.parse(w.precache)) {
    assert.ok(existsSync(new URL('../' + path.split('?')[0], import.meta.url)), path);
  }
});

test('a worker renewal uses its device proof and updates the stored endpoint', async () => {
  const endpoint = 'fixture-rotated';
  const binding = { owner: 'fixture', token: 'proof', endpoint: 'fixture-old', project: 'https://db.example.test', apiKey: 'public-key' };
  const w = worker({ binding, clients: [{ url: scope }], network: async (url, { headers, body }) => {
    assert.equal(url.pathname, '/rest/v1/rpc/renew_mobile_push_device');
    assert.equal(headers.apikey, binding.apiKey);
    assert.equal(headers.Authorization, undefined);
    assert.equal(JSON.parse(body).p_renewal_token, binding.token);
    return Response.json(true);
  } });
  await w.dispatch('pushsubscriptionchange', { oldSubscription: { endpoint: binding.endpoint },
    newSubscription: { toJSON: () => ({ endpoint, keys: { p256dh: 'public', auth: 'device' } }) } });
  assert.equal(w.binding().endpoint, endpoint);
  assert.equal(w.posts[0].type, 'UG_PUSH_SUBSCRIPTION_CHANGED');
});

test('expired advisory push does not display or reach open windows', async () => {
  const env = worker({binding: {owner: 'fixture-owner'}, clients: [{url: scope}]});
  await env.dispatch('push', {data: {json: () => ({title: 'fixture expired alert', expires_at: '2000-01-01T00:00:00Z'})}});
  assert.deepEqual(env.notices, []);
  assert.deepEqual(env.posts, []);
});

test('push contents are scoped to the registered account and suspended on sign-out', async () => {
  const active = worker({ binding: { owner: 'fixture' }, clients: [{ url: scope }] });
  const suspended = worker({ binding: { suspended: true }, clients: [{ url: scope }] });
  for (const w of [active, suspended]) await w.dispatch('push', { data: { json: () => ({ title: 'Fixture alert' }) } });
  assert.equal(active.posts[0].ownerId, 'fixture');
  assert.deepEqual(active.notices, ['Fixture alert']);
  assert.deepEqual(suspended.notices, []);
  assert.deepEqual(suspended.posts, []);
});

test('the app rotates a shared endpoint, restores a missing server row and detaches on sign-out', async () => {
  const auth = { state: { session: { id: 'next-account' } } };
  const owners = new Map([['fixture-original', 'previous-account']]);
  let binding;
  let serial = 0;
  const newSubscription = (endpoint) => ({
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'device-key', auth: 'device-auth' } }),
    unsubscribe: async () => { subscription = null; return true; }
  });
  let subscription = newSubscription('fixture-original');
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, 'sync_mobile_push_device');
      const previous = owners.get(args.p_endpoint);
      if (previous && previous !== auth.state.session.id) return { data: false };
      owners.set(args.p_endpoint, auth.state.session.id);
      return { data: true };
    },
    from: (table) => {
      assert.equal(table, 'push_subscriptions');
      const filters = {};
      const query = {
        select: () => query, delete: () => query,
        eq: (key, value) => { filters[key] = value; return query; },
        maybeSingle: async () => ({ data: owners.get(filters.endpoint) === filters.user_id ? { id: 'fixture' } : null }),
        abortSignal: async () => {
          if (owners.get(filters.endpoint) === filters.user_id) owners.delete(filters.endpoint);
          return {};
        }
      };
      return query;
    }
  };
  const navigator = {
    onLine: true,
    serviceWorker: { getRegistration: async () => ({
      active: {}, getNotifications: async () => [], pushManager: {
        getSubscription: async () => subscription,
        subscribe: async () => { subscription = newSubscription('fixture-new-' + ++serial); return subscription; }
      }
    }) }
  };
  const pwa = runInNewContext(readFileSync(new URL('../js/pwa.js', import.meta.url), 'utf8') + '\nUG_PWA;', {
    window: { PushManager: true }, navigator, Notification: { permission: 'granted' },
    UG_CONFIG: { VAPID_PUBLIC_KEY: 'AA' },
    Auth: auth, Repo: { client: () => client, queueUploadSession: async () => ({ client }) },
    UG_DEVICE_DB: { withPushLock: (fn) => fn(), readPush: async () => binding, savePush: async (value) => { binding = value; } },
    AbortSignal, atob, crypto: { randomUUID }
  });
  assert.equal(await pwa.enablePush(), true);
  assert.equal(owners.get('fixture-original'), 'previous-account');
  assert.equal(binding.owner, 'next-account');
  assert.notEqual(binding.endpoint, 'fixture-original');
  owners.delete(binding.endpoint);
  assert.equal(await pwa.pushEnabled(), true);
  assert.equal(owners.get(binding.endpoint), 'next-account');
  const endpoint = binding.endpoint;
  await pwa.releasePush(auth.state.session.id);
  assert.equal(binding.suspended, true);
  assert.equal(subscription, null);
  assert.equal(owners.has(endpoint), false);
});
