const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  try {
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(404).end();
    const body = pathname === '/env.js'
      ? "window.UG_ENV = { DEV:true, SUPABASE_URL:'https://fixture.invalid', SUPABASE_ANON_KEY:'browser-test' };"
      : await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});

(async () => {
  await new Promise((resolve) => server.listen(0,'127.0.0.1',resolve));
  const app = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH, args:['--no-sandbox']});
  try {
    const context = await browser.newContext({ serviceWorkers:'block' });
    let hotlineDown = false;
    const ownedQueries = [];
    const owned = Array.from({length:31}, (_,i) => ({
      id: '10000000-0000-4000-8000-' + String(i + 1).padStart(12,'0'), code:'FIXTURE-' + String(i + 1).padStart(3,'0'),
      created_at: new Date(Date.UTC(2025,0,31-i)).toISOString(), description: 'Owned fixture report ' + (i + 1),
      location_note:'Fixture landmark', hazard_type:'flood', severity:'warning', is_mine:true,
      status:'reported', barangay:'Poblacion', lat:16.0223,lng:120.2312
    }));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === app) return route.continue();
      if (url.hostname !== 'fixture.invalid') return route.abort();
      const table = url.pathname.split('/').pop();
      const headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };
      let body = [];
      let status = 200;
      if (table === 'reports_feed' && url.searchParams.has('is_mine')) {
        ownedQueries.push(url);
        body = url.searchParams.has('or') ? owned.slice(30) : owned;
        headers['content-range'] = '0-30/31';
      }
      if (table === 'emergency_hotlines') {
        body = hotlineDown ? {message:'Fixture hotline unavailable'} :
          [{id:'fixture-hotline',agency_name:'Fixture Hotline',contact_number:'1234'}];
        status = hotlineDown ? 400 : 200;
      }
      return route.fulfill({status, headers, json:body});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(app + '/?role=citizen&route=home', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.UG_APP?.S.session?.role === 'citizen');
    await page.evaluate(async () => {
      UG_URGENT.scan = () => {};
      UG_URGENT.dismiss();
      const actor = { ...UG_APP.S.session, id:'fixture-a' };
      Auth.state.session = actor;
      UG_APP.S.session = actor;
      const sample = {incidents:[{id:'own-a',photo_url:'https://fixture.invalid/private-photo'}]};
      if (!await UG_PWA.storeSnapshot(sample)) throw new Error('Cache write failed');
      Auth.state.session = { ...actor, id:'fixture-b' };
      UG.DATA.incidents = [];
      if (await UG_PWA.hydrateFromCache()) throw new Error('Other account loaded the snapshot');
      Auth.state.session = { ...actor, role:'barangay_official' };
      if (await UG_PWA.hydrateFromCache()) throw new Error('Different role loaded the snapshot');
      Auth.state.session = actor;
      if (!await UG_PWA.hydrateFromCache() || UG.DATA.incidents[0]?.id !== 'own-a') throw new Error('Owner cache was unavailable');
      if (UG.DATA.incidents[0].photo_url) throw new Error('Cached signed photo URL');
      Repo.state.profile = { id: actor.id, role:'citizen' };
      await Repo.loadAll();
    });
    console.log('PASS Offline snapshot scoped to account and role, without signed photo URLs');

    const history = await page.evaluate(async () => {
      const owner = Auth.state.session;
      await UG_NOTIF_STORE.mergeAll(Array.from({ length: 250 }, (_, id) => ({
        id: 'fixture-notice-' + id, unread: true, created_at: new Date(Date.UTC(2026,0,1,0,id)).toISOString()
      })));
      await UG_NOTIF_STORE.markReadLocal('fixture-notice-249');
      const original = await UG_NOTIF_STORE.list();
      Auth.state.session = { ...owner, id: 'another-account' };
      const other = await UG_NOTIF_STORE.list();
      Auth.state.session = owner;
      return { count: original.length, first: original[0], last: original.at(-1), other: other.length };
    });
    assert.equal(history.count, 200);
    assert.equal(history.first.id, 'fixture-notice-249');
    assert.equal(history.first.unread, false);
    assert.equal(history.last.id, 'fixture-notice-50');
    assert.equal(history.other, 0);
    console.log('PASS Notification history keeps the newest 200 rows for the active account');

    const photoPicker = await page.evaluate(async () => {
      const click = HTMLInputElement.prototype.click;
      let capture;
      HTMLInputElement.prototype.click = function () {
        capture = this.hasAttribute('capture');
        this.dispatchEvent(new Event('cancel'));
      };
      try { return { file: await UG_FEATURES.pickPhoto(), cameraForced: capture }; }
      finally { HTMLInputElement.prototype.click = click; }
    });
    assert.deepEqual(photoPicker, { file: null, cameraForced: false });
    console.log('PASS The file picker allows gallery access and resolves cleanly on cancel');

    const success = await page.evaluate(() => ({
      at:Repo.state.lastSync, hotlines:Repo.state.resourceSync.hotlines.lastSuccess
    }));
    assert.ok(success.at);
    hotlineDown = true;
    await page.evaluate(() => Repo.loadAll());
    const partial = await page.evaluate(() => ({
      at:Repo.state.lastSync, hotlines:Repo.state.resourceSync.hotlines, name:UG.DATA.hotlines[0]?.agency
    }));
    assert.deepEqual(partial,{ at:success.at,hotlines:{failed:true,lastSuccess:success.hotlines}, name:'Fixture Hotline' });
    await page.locator('#ug-conn').getByText(/Hotlines|hotlines/).waitFor();
    hotlineDown = false;
    await page.evaluate(() => Repo.loadAll());
    assert.equal(await page.evaluate(() => Repo.state.resourceSync.hotlines.failed), false);
    console.log('PASS Partial sync shows the failed resource, preserves its last success, and clears the warning on recovery');

    await page.evaluate(async () => { UG_APP.go('reports'); UG_APP.render(); await UG_APP.loadRouteData('reports'); });
    const older = page.getByRole('button',{name:'Load older reports'});
    await older.click();
    await page.getByText('FIXTURE-031',{exact:true}).waitFor();
    assert.equal(ownedQueries.length,2);
    assert.equal(ownedQueries[0].searchParams.get('is_mine'),'eq.true');
    assert.equal(ownedQueries[1].searchParams.get('order'),'created_at.desc,id.desc');
    assert.ok(ownedQueries[1].searchParams.get('or').includes(owned[29].id));
    await page.locator('[data-act="rw-report"][data-id="' + owned[30].id + '"]').click();
    await page.locator('[data-act="open-report"][data-id="' + owned[30].code + '"]').click();
    await page.getByText('Owned fixture report 31',{exact:true}).waitFor();
    console.log('PASS Older history loads with a stable owner-only cursor and opens the report detail');

    const retries = await page.evaluate(async () => {
      const calls = { report:[], sos:[] };
      const send = (name) => async (input) => {
        calls[name].push(input.request_id);
        if (calls[name].length === 1) throw new Error('Failed to fetch');
        return {id:'fixture-record',reach:1};
      };
      Repo.online = () => true;
      Repo.queueUploadSession = async () => ({ownerId:'fixture-a'});
      Repo.createReport = send('report');
      Repo.submitSos = send('sos');
      Repo.loadAll = async () => Repo.state;
      await UG_PWA.enqueue({description:'Retry report'});
      await UG_PWA.flushQueue();
      await UG_PWA.flushQueue();
      await UG_PWA.upsertQueuedSos({note:'Retry SOS'});
      await UG_PWA.flushQueue();
      await UG_PWA.flushQueue();
      return { calls, pending:(await UG_PWA.listQueue()).length };
    });
    for (const ids of Object.values(retries.calls)) {
      assert.equal(ids.length,2);
      assert.ok(ids[0]);
      assert.equal(ids[0],ids[1]);
    }
    assert.equal(retries.pending,0);
    assert.deepEqual(errors,[]);
    console.log('PASS Report and SOS queues keep the same request ID across a lost response');

    const mobile = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.route('**/*', (route) => route.request().url().startsWith(app + '/') ? route.continue() : route.abort());
    const phone = await mobile.newPage();
    const mobileErrors = [];
    phone.on('pageerror', (e) => mobileErrors.push(e.message));
    await phone.goto(app + '/privacy.html', { waitUntil: 'domcontentloaded' });
    await phone.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('uniguard', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('snapshot');
        db.createObjectStore('notifications', { keyPath: 'id' }).put({ id: 'unowned-old-alert' });
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
          .add({ owner_id: 'dev', description: 'Existing offline report', queued_at: new Date().toISOString() });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(); };
    }));
    await phone.goto(app + '/?role=citizen&route=sos#sos', { waitUntil: 'domcontentloaded' });
    await phone.waitForFunction(() => window.UG_APP?.S.session?.id === 'dev' && !!navigator.serviceWorker.controller);
    await mobile.setOffline(true);
    await phone.evaluate(async () => {
      if (!(await UG_PWA.listQueue()).some((row) => row.description === 'Existing offline report')) {
        throw new Error('Existing queue row lost during storage upgrade');
      }
      await UG_PWA.upsertQueuedSos({ kind: 'rescue', lat: 16.02, lng: 120.23 });
      await UG_NOTIF_STORE.mergeAll([{ id: 'offline-notice', title: 'Saved mobile alert', created_at: new Date().toISOString() }]);
    });
    await phone.reload({ waitUntil: 'domcontentloaded' });
    await phone.waitForFunction(() => window.UG_APP?.S.lastSos?.status === 'queued');
    await phone.getByText('Waiting for signal', { exact: true }).first().waitFor();
    await phone.waitForFunction(() => UG.DATA.notifications.some((notice) => notice.id === 'offline-notice'));
    await phone.evaluate(() => { UG_APP.go('reports'); UG_APP.render(); });
    await phone.getByText('SOS · Rescue', { exact: true }).first().waitFor();
    await phone.getByText('Waiting for signal', { exact: true }).first().waitFor();
    assert.deepEqual(mobileErrors, []);
    console.log('PASS A saved SOS survives a real offline mobile reload and appears in My Reports');
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
