const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const dispatchRoutes = 'dispatch equipment roster requests analytics contacts notifications dp-settings'.split(' ');
const roles = [
  ['citizen', '', '', 'home report reports advisories relief map centers hotlines roadwork guides faqs notifications offline settings sos'.split(' ')],
  ['barangay_official', '', '', 'dashboard incidents advisories relief centers roadwork response-team sos hotlines analytics reporting notifications settings map guides faqs offline'.split(' ')],
  ['lgu_ldrrmc', '', '', 'dashboard incidents advisories relief centers roadwork dispatch-units sos hotlines analytics reporting notifications settings map guides faqs offline others-review'.split(' ')],
  ['lgu_ldrrmc', 'super_admin', '', 'admin-home users audit dashboard dispatch-units hotlines notifications settings'.split(' ')],
  ...['BFP', 'PNP', 'Rescue', 'Hospital'].flatMap(type => ['unit_admin', 'member'].map(tier => [
    'dispatch_team', tier, type, type === 'Hospital' ? [...dispatchRoutes, 'hospital'] : dispatchRoutes
  ]))
];

async function fixture(browser, app, options = {}) {
  const context = await browser.newContext({
    viewport: options.mobile ? {width: 390, height: 844} : {width: 1440, height: 1000},
    isMobile: !!options.mobile, hasTouch: !!options.mobile, serviceWorkers: 'block', reducedMotion: 'reduce',
    geolocation: {latitude: 16.0223, longitude: 120.2312, accuracy: 8}, permissions: ['geolocation']
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== app) return options.handle ? options.handle(route, url) : route.abort();
    if (url.pathname === '/js/screens.js' && !options.handle) {
      const screens = await fs.readFile(path.resolve(__dirname, '../js/screens.js'), 'utf8');
      return route.fulfill({contentType: 'application/javascript', body: screens +
        "\nUG.DATA.sessions.dispatch_team = {name:'Fixture responder', initials:'FR', email:'responder@example.test', scope:'Fixture unit'};"});
    }
    if (url.pathname === '/env.js' && !options.handle) {
      return route.fulfill({contentType: 'application/javascript', body: `window.UG_ENV = { DEV:${options.dev !== false} };`});
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  return {page, context};
}

async function enter(page, app, role, route, tier) {
  await page.goto(app + '/?role=' + role + '&route=' + route + '&super=' + (tier === 'super_admin' ? '1' : '0'), {waitUntil: 'domcontentloaded', timeout: 30000});
  await page.waitForFunction((role) => window.UG_APP?.S.session?.role === role, role);
  await page.evaluate(() => {
    UG_URGENT.scan = () => {};
    UG_URGENT.dismiss();
  });
}

async function roleSweep(browser, app) {
  let checks = 0;
  await Promise.all([true, false].map(async mobile => {
    const {page, context} = await fixture(browser, app, {mobile});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      for (const [role, tier, type, routes] of roles) {
        errors.length = 0;
        try {
          await enter(page, app, role, routes[0], tier);
          await page.evaluate(({tier, type}) => {
            if (!type) return;
            Object.assign(UG_APP.S.session, {unit_role: tier, dispatch_unit_id: 'fixture-unit'});
            UG_DISPATCH.state.data.unit = {id: 'fixture-unit', unit_type: type, name: 'Fixture ' + type, active: true};
          }, {tier, type});
          for (const route of routes) {
            const result = await page.evaluate(async route => {
              UG_APP.go(route);
              await UG_APP.loadRouteData(route);
              UG_APP.render();
              const root = document.getElementById('ug-root');
              const broken = [...root.querySelectorAll('button[data-act], a[data-act], [role="button"][data-act]')]
                .filter(el => el.getClientRects().length && typeof UG_APP.actions[el.dataset.act] !== 'function')
                .map(el => el.dataset.act);
              return {route: UG_APP.S.route, rendered: root.innerText.trim().length > 50, broken};
            }, route);
            assert.deepEqual(result, {route, rendered: true, broken: []}, [role, tier, type, route, mobile].join(' '));
            checks++;
          }
          if (tier !== 'super_admin') {
            await page.evaluate(() => UG_APP.go('users'));
            assert.equal(await page.evaluate(() => UG_APP.S.route !== 'users'), true);
          }
          if (role === 'barangay_official') {
            await page.evaluate(() => { UG_APP.go('advisories'); UG_APP.render(); });
            assert.ok(await page.locator('select[data-field="advArea"]').isDisabled());
          }
          assert.deepEqual(errors, []);
        } catch (error) {
          throw new Error([role, tier, type, mobile ? 'mobile' : 'desktop', ...errors, error.message].join(' · '), {cause: error});
        }
      }
    } finally { await context.close(); }
  }));
  console.log('PASS ' + checks + ' rendered role-route checks across desktop and mobile with reachable action handlers.');
}

async function dispatchFailure(browser, app) {
  const {page, context} = await fixture(browser, app, {mobile: true});
  try {
    await enter(page, app, 'dispatch_team', 'dispatch');
    const outcome = await page.evaluate(async () => {
      const id = 'fixture-unit-first';
      const recent = Array.from({length: 50}, (_, n) => ({id: 'closed-' + n, dispatch_status: 'done',
        dispatched_at: '2025-12-20T10:00:00Z', unit_id: id}));
      const older = {id: 'old-open', dispatch_status: 'acknowledged', dispatched_at: '2025-11-20T10:00:00Z', unit_id: id};
      let equipmentFailed = false;
      let held = null;
      const client = {
        from(table) {
          const filters = {};
          const query = {
            select: () => query, eq: (key, value) => { filters[key] = value; return query; },
            order: () => query, maybeSingle: () => query, in: (key, value) => { filters[key] = value; return query; },
            not: (key, op, value) => { filters.open = key === 'dispatch_status' && op === 'in' && value === '(done,declined)'; return query; },
            limit: () => query, range: () => query,
            then(resolve) {
              if (table === 'dispatch_units' && filters.id === id) return resolve({data: {id, unit_type: 'BFP', name: 'Fixture unit', active: true}});
              if (table === 'report_dispatches' && filters.unit_id === id) return resolve({data: filters.open ? [older] : recent});
              if (table === 'dispatch_equipment') {
                if (equipmentFailed) return resolve({error: {message: 'Fixture equipment unavailable'}});
                if (held) return held.then(resolve);
                return resolve({data: [{id: 'gear-fixture', custom_label: 'Fixture gear', status: 'available', condition: 'ready'}]});
              }
              return resolve({data: []});
            }
          };
          return query;
        },
        channel() { return {on() { return this; }, subscribe() { return this; }}; },
        removeChannel() {}
      };
      const original = Repo.client;
      const previous = UG_APP.S.session;
      try {
        Repo.client = () => client;
        UG_APP.S.session = {...previous, dispatch_unit_id: id, unit_role: 'unit_admin'};
        await UG_DISPATCH.loadAll();
        const retainedAfter50Closed = UG_DISPATCH.state.data.dispatches.some(row => row.id === older.id);
        equipmentFailed = true;
        await UG_DISPATCH.loadAll({silent: true});
        const retainedOnFailure = UG_DISPATCH.state.data.equipment[0]?.id === 'gear-fixture' && !!UG_DISPATCH.state.error;
        equipmentFailed = false;
        let release;
        held = new Promise(resolve => { release = resolve; });
        const loading = UG_DISPATCH.loadRoute('equipment');
        UG_DISPATCH.signedOut();
        release({data: [{id: 'previous-account-gear'}]});
        await loading;
        return {retainedAfter50Closed, retainedOnFailure, cleared: UG_DISPATCH.state.data.equipment.length === 0};
      } finally {
        Repo.client = original;
        UG_APP.S.session = previous;
      }
    });
    assert.deepEqual(outcome, {retainedAfter50Closed: true, retainedOnFailure: true, cleared: true});
    console.log('PASS Dispatch retains older active work and good reads during a failure, and discards an old account response.');
  } finally { await context.close(); }
}

async function advisoryDelivery(browser, app) {
  const id = '8c3c1de0-8cd9-4170-af6c-49af240c7e15';
  const record = {id, title: 'Fixture targeted advisory', body: 'Keep away from the river.', severity: 'warning',
    barangay_ids: [], affected_area: 'Municipality-wide', citywide: true, delivery_mode: 'push', reached: 2};
  const calls = [];
  const {page, context} = await fixture(browser, app, {handle: (route, url) => {
    if (url.hostname !== 'fixture.invalid') return route.abort();
    const headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS'};
    if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers});
    if (url.pathname.endsWith('/publish_advisory')) {
      const sent = route.request().postDataJSON();
      calls.push(sent.p_request_id);
      if (calls.length === 1) return route.fulfill({status: 503, headers, json: {message: 'Fixture transient publish error'}});
      return route.fulfill({status: 200, headers, json: record});
    }
    if (url.pathname.endsWith('/push-dispatch')) return route.fulfill({status: 503, headers, json: {error: 'Fixture gateway unavailable'}});
    if (url.pathname.endsWith('/advisories') && url.searchParams.get('id') === 'eq.' + id) {
      return route.fulfill({status: 200, headers, json: [record]});
    }
    return route.fulfill({status: 200, headers, json: []});
  }});
  try {
    await enter(page, app, 'lgu_ldrrmc', 'advisories');
    await page.locator('input[data-field="advTitle"]').fill(record.title);
    await page.locator('textarea[data-field="advMsg"]').fill(record.body);
    const submit = async () => {
      await page.locator('[data-act="publish"]:visible').click();
      await page.getByRole('button', {name: 'Publish', exact: true}).click();
    };
    await submit();
    await page.getByText(/Fixture transient publish error|could not reach/i).first().waitFor();
    await submit();
    await page.getByText(/Push and SMS delivery could not be confirmed/).waitFor();
    assert.equal(calls.length, 2);
    assert.equal(calls[0], calls[1]);

    await page.evaluate(id => UG_APP.actions['open-advisory']({id}), id);
    await page.getByRole('heading', {name: record.title}).waitFor();
    await page.evaluate(() => UG_APP.actions['open-advisory']({id: '8c3c1de0-8cd9-4170-af6c-49af240c7e16'}));
    await page.getByText('Advisory not found.', {exact: true}).waitFor();
    assert.equal(await page.getByRole('heading', {name: record.title}).count(), 0);
    console.log('PASS Advisory publish retries once with the same ID, reports push failure accurately, and opens the exact linked record.');
    const scoped = await page.evaluate(() => {
      const st = {...UG_APP.S, anFrom: '2025-06-02', anTo: '2025-06-02', anBrgyFilter: 'Poblacion'};
      UG.DATA.incidents = [
        {uuid: 'local-earlier', brgy: 'Poblacion', hazard: 'Flood', status: 'reported', created_at: '2025-06-01T15:59:59Z'},
        {uuid: 'local', brgy: 'Poblacion', hazard: 'Flood', status: 'dispatched', created_at: '2025-06-01T16:00:00Z'},
        {uuid: 'remote', brgy: 'Malawa', hazard: 'Flood', status: 'dispatched', created_at: '2025-06-01T16:00:00Z'}
      ];
      UG.DATA.centers = [{brgy: 'Poblacion', cap: 15, occ: 4}, {brgy: 'Malawa', cap: 200, occ: 80}];
      UG.DATA.dispatches = {
        local: [{team: 'BFP', dispatched_at: '2025-06-01T16:05:00Z'}],
        remote: [{team: 'PNP', dispatched_at: '2025-06-01T16:30:00Z'}]
      };
      const {an, trend, teamRows, totalCap, totalOcc} = UG_SCREENS.analyticsModel(st);
      return {daily: trend.at(-1), dispatch: an.avgDispatchSeconds, resolve: an.avgResolveSeconds,
        team: teamRows[0]?.team, teams: teamRows.length, totalCap, totalOcc};
    });
    assert.deepEqual(scoped, {daily: 1, dispatch: 300, resolve: null, team: 'BFP', teams: 1, totalCap: 15, totalOcc: 4});
    console.log('PASS LGU analytics respects the barangay filter and the selected Philippine date.');
  } finally { await context.close(); }
}

async function photoAndDialogs(browser, app) {
  const {page, context} = await fixture(browser, app);
  try {
    await enter(page, app, 'citizen', 'report');
    const attach = async (name, mimeType, buffer) => {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-act="add-photo"]:visible').click()]);
      await chooser.setFiles({name, mimeType, buffer});
    };
    await attach('invalid.jpg', 'image/jpeg', Buffer.from('Invalid fixture file'));
    await page.getByText('That file is not a readable image', {exact: true}).waitFor();
    assert.equal(await page.evaluate(() => UG_APP.S.report.photo), false);
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.getContext('2d').fillRect(0, 0, 5, 5);
      return canvas.toDataURL().split(',')[1];
    });
    await attach('fixture.png', 'image/png', Buffer.from(png, 'base64'));
    await page.waitForFunction(() => UG_APP.S.report.photoBlob?.type === 'image/jpeg');
    await page.locator('[data-act="rm-photo"]:visible').click();
    assert.equal(await page.evaluate(() => UG_APP.S.report.photo), false);

    await page.evaluate(() => {
      UG_FEATURES.modal({title: 'Fixture outer dialog'});
      UG_FEATURES.confirm({title: 'Fixture confirmation'}).then(value => { window.confirmed = value; });
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.confirmed === false);
    await page.getByRole('dialog', {name: 'Fixture outer dialog'}).waitFor();
    await page.evaluate(() => {
      UG_FEATURES.prompt({title: 'Fixture prompt'}).then(value => { window.answer = value; });
      UG_FEATURES.closeDialogs();
    });
    await page.waitForFunction(() => window.answer === null);
    assert.equal(await page.getByRole('dialog').count(), 0);
    console.log('PASS Real browser photo selection, invalid image rejection, JPEG conversion and nested dialog cancellation.');
  } finally { await context.close(); }
}

async function productionAuth(browser, app) {
  const {page, context} = await fixture(browser, app, {dev: false});
  try {
    await page.goto(app, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.UG_APP && typeof Auth !== 'undefined');
    const result = await page.evaluate(async () => {
      const errors = [];
      for (const run of [
        () => Auth.signUp({email: 'citizen@example.test', password: 'Fixture only'}),
        () => Auth.signIn('citizen@example.test', 'Fixture only'),
        () => Auth.resetPassword('citizen@example.test')
      ]) {
        try { await run(); } catch (error) { errors.push(error.message); }
      }
      return {errors, session: Auth.state.session};
    });
    assert.equal(result.errors.length, 3);
    assert.ok(result.errors.every(message => message.includes('Cannot reach UniGuard sign-in')));
    assert.equal(result.session, null);
    console.log('PASS Production sign-in, signup and password reset report a missing backend without creating a device-only account.');
  } finally { await context.close(); }
}

async function urgentReceipts(browser, app) {
  const {page, context} = await fixture(browser, app);
  try {
    await enter(page, app, 'citizen', 'home');
    await page.evaluate(() => {
      const owner = {...UG_APP.S.session, id: 'reader-a'};
      Auth.state.session = UG_APP.S.session = owner;
      UG_URGENT.reset();
      UG.DATA.advisories = [];
      window.receiptCalls = [];
      window.canSaveReceipt = false;
      Repo.queueUploadSession = async () => ({client: {rpc: async (name, args) => {
        window.receiptCalls.push({name, args});
        return window.canSaveReceipt ? {data: null, error: null} : {error: {message: 'Fixture disconnected'}};
      }}});
      UG_URGENT.fire({id: 'expired', severity: 'emergency', title: 'Expired flood alert', expires_at: '2000-01-01T00:00:00Z'});
      UG_URGENT.fire({id: 'first', severity: 'emergency', title: 'First flood alert'});
      UG_URGENT.fire({id: 'second', severity: 'emergency', title: 'Second flood alert'});
    });
    assert.equal(await page.getByRole('alertdialog', {name: /Expired flood/}).count(), 0);
    await page.getByRole('alertdialog', {name: /First flood/}).getByRole('button', {name: 'Close without acknowledging'}).click();
    assert.equal(await page.evaluate(() => window.receiptCalls.length), 0);
    await page.getByRole('alertdialog', {name: /Second flood/}).getByRole('button', {name: 'Acknowledge'}).click();
    await page.waitForFunction(() => window.receiptCalls.length === 1);
    await page.evaluate(() => { window.canSaveReceipt = true; window.dispatchEvent(new Event('online')); });
    await page.waitForFunction(() => window.receiptCalls.length === 2);
    assert.deepEqual(await page.evaluate(() => window.receiptCalls), Array(2).fill({
      name: 'acknowledge_emergency_advisory', args: {p_advisory_id: 'second'}
    }));
    await page.evaluate(() => {
      UG_URGENT.reset();
      const next = {...UG_APP.S.session, id: 'reader-b'};
      Auth.state.session = UG_APP.S.session = next;
      UG_URGENT.fire({id: 'second', severity: 'emergency', title: 'Second flood alert'});
    });
    await page.getByRole('alertdialog', {name: /Second flood/}).waitFor();
    console.log('PASS Expired overlays stay closed, acknowledgment retries and one resident’s receipt does not hide another resident’s alert.');
  } finally { await context.close(); }
}

module.exports = async function verifyRoleAudits(browser, app) {
  await dispatchFailure(browser, app);
  await advisoryDelivery(browser, app);
  await photoAndDialogs(browser, app);
  await productionAuth(browser, app);
  await urgentReceipts(browser, app);
  await roleSweep(browser, app);
};
