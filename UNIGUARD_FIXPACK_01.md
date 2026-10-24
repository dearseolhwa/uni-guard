# UniGuard · Fix Pack 01 — Tester findings (QA PDF, Oct 23 2026)

> **How to use:** put this file in the repo root, open Claude Code in VS Code and send one prompt:
> `Read UNIGUARD_FIXPACK_01.md and execute every task in it, in order, following its operating rules.`

---

## 0. Operating rules for Claude Code (read first, follow strictly)

1. **Read before you edit.** For every task, open and read the files named in it first. Five core files were NOT visible to the author of this plan: `js/app.js`, `js/repo.js`, `js/screens.js`, `js/i18n.js`, `js/reporting.js`. Wherever a task says **LOCATE**, search those files (`grep -n`) and adapt the fix to the real code. Do not guess function names; find them.
2. **Stack constraints.** No bundler. Classic `<script>` files sharing one global scope, string-built HTML, ES2017, no new dependencies, no CDN. Keep existing class names, `data-act` conventions and code style. Every user-visible string must go through `UG_I18N.t()` when the surrounding code does; add **both `en` and `fil`** entries to `js/i18n.js` for any new key.
3. **Never edit an already-numbered migration.** New SQL goes in `migrations/048_fixpack_01.sql` (idempotent, re-runnable, wrapped in `begin; … commit;`, ending with `notify pgrst, 'reload schema';`).
4. **Do not touch secrets/keys** in `env.js` except where Task F1 says so. Never add the service-role key anywhere in the client.
5. **One task at a time.** After each task: re-read the changed region, run `node --check <file>` on every edited `.js` file, and fix syntax errors before moving on.
6. **Do not "fix" things outside this plan.** If you notice another bug, append it to the "Noticed, not fixed" list in the result file (§ Final steps). The owner will approve a second fix pack separately.
7. At the end, bump `VERSION` in `sw.js` (`uniguard-v11` → `uniguard-v12`) and `BUILD` in `env.js` (e.g. `2026-10-24.1`) so installed PWAs pick up the new build.

---

## 1. System context (so the fixes are consistent)

- Frontend: static PWA (`index.html` + `js/*.js`), Supabase backend (Postgres + RLS + RPCs + Edge Functions `admin-users`, `push-dispatch`, `sms-fallback`).
- Roles: `citizen`, `barangay_official`, `lgu_ldrrmc` (+ `profiles.is_super_admin` flag = Super Admin), `dispatch_team`.
- Rendering: `app.js` keeps state `S`, calls `render(S)` into `#ug-root`, and handles clicks through **one delegated listener that reads `data-act`**. Modals (`UG_FEATURES.modal`) are appended to `document.body`, i.e. **outside `#ug-root`**.
- Offline: `js/pwa.js` (IndexedDB `snapshot` + `queue` stores, `flushQueue`, `forceRefresh`), `sw.js` (network-first shell).
- Auth: `js/auth.js` (`restore`, `signIn`, `signUp`, local session cache in `localStorage['uniguard.session']`).

---

## 2. Tasks

Each task: **Symptom → Root cause → Change → Acceptance check.**

### F1 · New residents' confirmation link opens an error page (account is actually confirmed)

**Root cause (confirmed).** `Auth.signUp()` sends `emailRedirectTo: UG_CONFIG.APP_PUBLIC_URL`, which is `http://127.0.0.1:5500` in `env.js`. On a phone, `127.0.0.1` is the phone itself → `ERR_CONNECTION_REFUSED`. Supabase confirms the email *before* redirecting, so login works. Also `signUp` uses `APP_PUBLIC_URL` while `resendConfirmation`/`resetPassword` use `window.location.origin` (inconsistent). The app also has no "email confirmed" landing state.

**Change.**
1. `js/auth.js`: add one helper and use it in `signUp`, `resendConfirmation`, `resetPassword`:
   ```js
   /* Where Supabase email links send people back to. A loopback address only
      works on the machine running the dev server, never on a phone. */
   function redirectUrl() {
     const isLoopback = (u) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(u || '');
     const configured = UG_CONFIG.APP_PUBLIC_URL || '';
     const here = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
     if (configured && !isLoopback(configured)) return configured;
     if (here && !isLoopback(here)) return here;
     if (typeof console !== 'undefined') console.warn('[UniGuard] Email links point to a loopback address and will fail on other devices. Set APP_PUBLIC_URL in env.js to the deployed https URL.');
     return configured || here;
   }
   ```
   Export it on the `Auth` object.
2. **LOCATE** the boot sequence in `js/app.js` (where `Auth.restore()` is called). Before the first render, detect a Supabase email-link return:
   - `location.hash` or `location.search` containing `type=signup`, `type=email`, `type=invite`, `access_token=`, `code=`, `error=` / `error_description=`.
   - Success (signup/email): show the auth screen with a success notice **"Your email is confirmed. You can now sign in."** (`fil`: "Kumpirmado na ang iyong email. Maaari ka nang mag-sign in."). If Supabase also created a session, let `restore()` continue normally into the app and just toast the same message once.
   - Error (e.g. `otp_expired`): show **"This confirmation link has expired or was already used. Sign in, or request a new link."** with the existing resend control.
   - `type=recovery` must keep its current behaviour (reset-password screen).
   - Clean the URL afterwards: `history.replaceState(null, '', location.pathname + '#')` (keep the app's own hash routing working).
   - Implement the notice as a new state/route in `js/screens.auth.js` (reuse `shell(...)`) or a notice banner on the sign-in screen — whichever matches existing code better.
3. `docs/DEPLOY.md` §2 (Auth settings): add a clearly marked note:
   - Supabase Dashboard → Authentication → URL Configuration → **Site URL** = the deployed **https** URL; **Redirect URLs** include `https://<deployed-host>/**` and, for desktop dev only, `http://127.0.0.1:5500/**`.
   - Testing on phones requires a deployed HTTPS URL (e.g. Netlify drop-deploy). `127.0.0.1` never works from another device, and Web Push/service workers need HTTPS anyway.
   - `env.js` → `APP_PUBLIC_URL` must equal the deployed URL.
4. Do **not** change `APP_PUBLIC_URL` in `env.js` yourself (the deployed URL is unknown). Add a comment above it: `/* MUST be the public https URL in any build tested on phones */`.

**Accept.** Sign up on desktop with `APP_PUBLIC_URL` set to a real host → the email link lands on the app and shows the confirmed message; an expired link shows the friendly expiry message; password recovery still opens the reset screen.

---

### F2 · "No new advisories can be sent" — `Could not find the 'delivery_mode' column of 'advisories' in the schema cache`

**Root cause (confirmed).** The advisory composer (Delivery: *Push notification* / *In-app only*) writes `delivery_mode`, but **no migration creates that column** (only `alert_type` and `language` were added in 041).

**Change.**
1. **LOCATE** in `js/repo.js` (and `js/app.js`) the advisory insert (search `advisories` + `insert`/`publish`). List every key in the payload and compare with the schema (columns from migrations 001 + 041: `author_id,title,body,severity,kind,affected_area,barangay_id,citywide,expires_at,published_at,created_at,updated_at,alert_type,language`). Record the exact `delivery_mode` values the client sends.
2. Create `migrations/048_fixpack_01.sql` (Section A — more sections are added by later tasks):
   ```sql
   -- A. advisories.delivery_mode (composer: push notification vs in-app only)
   alter table public.advisories
     add column if not exists delivery_mode text not null default 'push';
   do $$ begin
     if not exists (select 1 from pg_constraint where conname = 'advisories_delivery_mode_check') then
       alter table public.advisories add constraint advisories_delivery_mode_check
         check (delivery_mode in ('push','in_app'));
     end if;
   end $$;
   comment on column public.advisories.delivery_mode is
     'push = publish + Web Push/SMS fan-out; in_app = publish to the in-app inbox only.';
   -- safety net in case 041 was skipped on the live project
   alter table public.advisories add column if not exists alert_type text not null default 'general';
   alter table public.advisories add column if not exists language  text not null default 'en';
   ```
   If the client sends other spellings (`in-app`, `inapp`, `app`), **normalise in the client** to `'push' | 'in_app'` rather than widening the constraint. If step 1 finds any *other* payload key without a column, add it to Section A the same way (nullable or with a safe default) and note it in the result file.
3. In the publish flow, invoke `push-dispatch` **only** when `delivery_mode === 'push'`. In-app-only advisories must still appear in the inbox/feeds.
4. Error toast for this class of failure must be plain language (see F5 `friendlyError`): "Could not publish the advisory. The system needs an update — contact the system administrator." (raw message to `console.error`).

**Accept.** After running 048 in the SQL editor: publishing with *Push notification* creates the row and calls `push-dispatch`; *In-app only* creates the row and does not call it. No schema-cache error.

---

### F3 · Super Admin portal: Dispatch Units **Edit / Account / Delete** cannot be clicked

**Root cause (confirmed).** `js/screens.admin.js` lines ~407–409 render those buttons with `onclick="event.stopPropagation()"`. That stops the click before it bubbles to the delegated `data-act` listener, so the actions never run. (It was added so the row's `data-act="open-unit"` would not fire — unnecessary, because the delegate resolves `e.target.closest('[data-act]')`, which already returns the inner button first.)

**Change.**
1. Remove `onclick="event.stopPropagation()"` from the three buttons in `screens.admin.js` and from the two buttons in `js/roadwork.js` (~lines 191–192, `rs-edit`, `rs-del`) — same bug.
2. **LOCATE** the delegate in `app.js` and confirm it uses `closest('[data-act]')` and handles only that one element (the innermost). If it walks further up or also fires parent handlers, fix it so only the innermost `[data-act]` runs.
3. Confirm handlers exist for `admin-edit-unit`, `admin-unit-accounts`, `admin-delete-unit`, `open-unit`, `rs-edit`, `rs-del`. If any is missing, implement it with the existing patterns (Repo/RPC + `UG_FEATURES.confirm` for delete + toast + reload).
4. Leave the `<a class="ug-waze-btn" … onclick="event.stopPropagation()">` in `js/sos.js` as is (it is a plain link and must not open the row).

**Accept.** As Super Admin: Edit opens the unit editor, Account opens the member roster, Delete asks for confirmation; clicking elsewhere on the row still opens the unit detail.

---

### F4 · Buttons inside pop-ups do nothing (hotline change request, shelter Edit / Edit Location, road work Edit, SOS Acknowledge / Mark resolved, inventory Restock / Edit)

**Root cause (confirmed by code comment in `js/urgent-alerts.js`: "the overlay lives on document.body (outside #ug-root), so the existing delegated click handler in app.js does NOT reach it").** `UG_FEATURES.modal()` appends dialogs to `document.body`, but the delegated `data-act` listener is bound to `#ug-root`. Every modal footer button that relies on `data-act` is dead: `rs-edit` (roadwork.js), `sos-ack` / `sos-resolve` (sos.js), `inv-restock` / `inv-edit` (relief.js), the hotline "Edit this hotline" / "Request deletion of this hotline" choices and the shelter "Edit Location" / "Edit" buttons (LOCATE in screens.js / app.js).

**Change.**
1. **LOCATE** in `app.js` every delegated listener bound to the root element (`click`, and also `input`, `change`, `keydown`, `submit` if they serve `data-act` / `data-field`). Rebind them to `document` so modals (and any other body-level UI) are covered. Requirements:
   - Ignore events inside `.ug-urgent-host` (it has its own listener) to avoid double handling.
   - Bind exactly once (guard with a flag) — `render()` must not add listeners repeatedly.
   - Inputs inside modals that use `data-field` must keep updating state the same way as before.
2. When a `data-act` button **inside a `.ug-modal`** is clicked, close that modal **before** running the action (the action usually re-renders or opens another modal), unless the button carries `data-keep-modal`. Implement by removing the `.ug-modal` element (or calling its stored close fn). Make sure `UG_FEATURES.modal`'s Escape listener is also removed in that path (store `close` on the element: `wrap.__ugClose = close`, and call it).
3. After `sos-ack` / `sos-resolve`, re-render the SOS log so the status badge updates.
4. Make sure the hotline change-request actions call `submit_change_request` (migration 046) with action `edit` / `delete` and show a plain-language confirmation ("Your request was sent to the Super Admin for review.").
5. Road-work Edit inside `roadDetailModal` must only be shown to staff: `roadwork.js` computes `isStaff` but never uses it and `S_session` is never set. Use the session from `UG_APP` (or pass `st` into `roadDetailModal(id, st)`) and render the Edit button only for `barangay_official` and `lgu_ldrrmc`.

**Accept.** Each listed pop-up button performs its action and the pop-up closes; Escape/× still close pop-ups; no action fires twice; citizens never see Edit on a road-status pop-up.

---

### F5 · Too many technical terms for residents (e.g. "VAPID key"); technical error text in toasts

**Root cause.** Resident-facing Settings reuse admin wording (`settings.pushEnabledHelp` mentions the VAPID key; SMS "gateway"; "registered office email"; quiet hours is a broadcast policy, not a personal setting). The Offline page shows "Service Worker Cache", "Strategy: Network first". Raw errors such as `TypeError: Failed to fetch` are shown verbatim.

**Change.**
1. **Settings → Notifications** (`js/settings.js` `tabNotifications`, strings in `js/i18n.js`):
   - For **all non-LGU roles**: replace the three toggles with one card **"Alerts on this phone"**: shows current status (*On* / *Off* / *Blocked in browser settings* / *Not supported on this browser*) using `UG_PWA.pushSupported()` / `pushEnabled()` / `Notification.permission`, and a button **"Turn on alerts"** that calls `UG_PWA.enablePush()` (toast the result through `friendlyError`). Help text: "Get warnings and evacuation notices even when UniGuard is closed." Add an info line: "Emergency alerts may also be sent by text message to your registered mobile number."
   - **Quiet hours, email digests and the SMS-fallback switch become LGU-only** (system policy). Rewrite their help text in plain words, no "VAPID", "gateway", "deploy time".
   - Remove the word "VAPID" from every non-admin string. In admin strings, say "push notification key (set by the system administrator)".
2. **Settings → Offline** and **citizen Offline page** (`js/screens.web.js` `cwOffline`): rename for residents — "Service Worker Cache" → "Saved on this phone"; "Queued reports" → "Reports waiting to send"; "Service worker: Supported" → "Works without internet: Yes"; "Cache retention (days)" → "Keep saved information for (days)"; delete the "Strategy: Network first" row; show "App version" instead of "Build". Subtitle: "UniGuard keeps the essentials on your phone so they still open without a signal."
3. Add `UG_UTIL.friendlyError(err)` in `js/util.js` and use it **inside `UG_APP.toast`** whenever the message comes from an `Error`/server (LOCATE `toast` in app.js; keep explicit friendly messages untouched). Always `console.error` the raw error. Mapping (case-insensitive, both languages via i18n keys):
   | Raw contains | Resident message |
   |---|---|
   | `failed to fetch`, `networkerror`, `network request failed`, `load failed` | "No internet connection. Check your signal and try again." |
   | `schema cache`, `column`, `relation`, `does not exist` | "Something on our side needs an update. Please try again later or contact the MDRRMO." |
   | `jwt`, `token`, `session` + `expired`/`invalid` | "Your session ended. Please sign in again." |
   | `row-level security`, `permission denied`, `42501` | "You don't have permission to do that." |
   | `rate limit`, `too many` | "Too many attempts. Please wait a few minutes and try again." |
   | `duplicate key`, `23505` | "This record already exists." |
   | fallback | keep the message if it is already a plain sentence written by our RPCs (no `TypeError`, no SQL codes), else "Something went wrong. Please try again." |

**Accept.** Signed in as a citizen, Settings and Offline pages contain no VAPID/service worker/cache/gateway wording; turning off Wi-Fi and pressing any network action shows "No internet connection…" instead of `TypeError: Failed to fetch`.

---

### F6 · Refreshing the page returns to the login screen (seen while offline)

**Root cause (confirmed).** `Auth.restore()` calls `loadProfile()`; when the network is down this throws, and the `catch` **calls `c.auth.signOut()`**, which deletes the Supabase session. The user is logged out permanently, even after the connection returns.

**Change** in `js/auth.js`:
1. Make `loadProfile` tag failures: set `err.network = true` when the Supabase error/`TypeError` matches the network patterns of F5 or `navigator.onLine === false`; set `err.code = 'PROFILE_MISSING'` when the row is absent.
2. Rewrite `restore()`:
   - Wrap `c.auth.getSession()` in try/catch.
   - If there is a session: try `loadProfile`. On `err.network` **and** a cached profile in `SESSION_KEY` whose `id` equals the session user id → `apply(buildProfile(cached.profile, …))`, set `state.offline = true`, return the session. Only call `signOut()` when the error is definitive (`PROFILE_MISSING`, disabled account). For any other error, do **not** sign out; rethrow so the app shows an error with a Retry action.
   - If there is **no** session but the device is offline and a cached profile exists → restore from the cache in read-only/offline mode (Supabase may fail to refresh an expired token offline). When the app comes back online, call a new `Auth.revalidate()` that re-runs `getSession` + `loadProfile`; if the session is truly gone, sign out and show the login screen with "Please sign in again."
3. **LOCATE** the `online` handling in `app.js` / `pwa.js` and call `Auth.revalidate()` there (once per reconnection).
4. Confirm the Supabase client in `repo.js` is created with `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }` (defaults) — fix if overridden.

**Accept.** Sign in → go offline → refresh: the app opens on the same account with the offline banner. Online refresh also stays signed in. A disabled account is still signed out.

---

### F7 · SOS offline: "TypeError: Failed to fetch", not saved, not sent later; toasts pile up over the backup call button; "Go live" vs "Retry"

**Root causes.** (a) **LOCATE** the `sos-trigger` handler in `app.js`: it calls `Repo.submitSos` directly and toasts the raw error; the offline queue (`UG_PWA.enqueue` with `_kind: 'sos'`, which `flushQueue` already supports) is not used when the request fails with a network error (and `navigator.onLine` can still be `true` while there is no internet). (b) Each tap adds another toast; the toast host is bottom-anchored with `pointer-events:auto`, covering the "Call Lingayen MDRRMO" button. (c) `frameCitizenWeb` shows its own offline strip with a **"Go live"** button bound to `toggle-offline` — a prototype simulation switch that only hides the banner — in addition to the real `#ug-conn` strip with **Retry**.

**Change.**
1. **SOS send flow** (app.js `sos-trigger`):
   - Ignore taps while `S.sosSending` is true (button visually disabled).
   - Read GPS (`UG_FEATURES.locate()`, keep current timeout); if GPS fails, still send/queue without coordinates.
   - If `navigator.onLine === false` **or** the RPC fails with a network error → `UG_PWA.enqueue({ _kind: 'sos', lat, lng, accuracy, note, client_sent_at: new Date().toISOString() })`. **De-duplicate:** if a queued SOS already exists from the last 10 minutes, replace it with the newer position instead of adding another row (add `UG_PWA.upsertQueuedSos(row)` in pwa.js).
   - Set `S.lastSos = { status: 'queued', at, lat, lng, accuracy }` and render an **inline status in the SOS card** (not a toast): amber badge "Waiting for signal" + text "No internet connection. Your SOS is saved on this phone and will be sent automatically as soon as you are back online. If you are in danger, call MDRRMO now." (`fil` translation too).
   - When `flushQueue` sends a queued SOS, update `S.lastSos` to sent and toast once: "Your SOS was delivered to the MDRRMO."
   - Server rejections (e.g. rate limit) show the friendly message from F5 inline, not a raw error.
2. **pwa.js `flushQueue`**: send `_kind === 'sos'` rows first; classify failures — network error → stop the loop (retry later); server rejection → increment `row.attempts`, keep the row, **continue with the next row** (one bad row must not block everything); after 5 attempts mark `row.failed = true` and surface it (see F11). Listen for the service-worker `FLUSH_QUEUE` message (`navigator.serviceWorker.addEventListener('message', …)`) and call `flushQueue`.
3. **Backup call button** (`js/sos.js` `mSos`): render it as a real link `<a class="ug-btn ug-btn--signal ug-btn--block" href="tel:0756322222">` so it works even if JS actions fail; when `S.lastSos.status === 'queued'` or a send error occurred, move the Backup Hotline card **above** the SOS circle.
4. **Toasts** (LOCATE `UG_APP.toast` + `css/app.css`/`screens-additions.css`):
   - De-duplicate: if a toast with the same text is visible, refresh its timer and show a small "×2" counter instead of adding another.
   - Max 3 visible; oldest removed first.
   - Move the host to the **top** of the screen: `.ug-toast-host{top:calc(12px + env(safe-area-inset-top));bottom:auto}` and make toasts click-through (`pointer-events:none`) so they can never cover the SOS, call, submit or nav buttons.
5. **Banners**: remove the "Go live" button and the duplicate in-frame offline strip from `frameCitizenWeb` (`js/screens.web.js`) and any equivalent in `screens.js` for production (keep it only when `UG_CONFIG.DEV` is true, labelled "Preview: simulate offline"). Keep a single connectivity banner (`#ug-conn`) and rename its button **"Try again"**. Answer for the tester (put in the result file): *they were not the same — "Go live" only hid the banner; "Retry" actually checks the connection and sends queued items.*

**Accept.** Offline, tap SOS repeatedly → one inline "Waiting for signal" status, no stacked toasts, call button always visible and tappable. Reconnect → SOS is delivered once, appears in the LGU SOS Log, resident sees "delivered". Only one offline banner.

---

### F8 · "Declare Emergency" button shown to barangay officials (they cannot use it)

**Root cause (confirmed).** RPC `declare_emergency` (migration 009) raises `Only LGU / LDRRMC can declare an emergency`, but the dashboard header renders the button for every console role.

**Change.** **LOCATE** "Declare Emergency" in `js/screens.js` (and its handler in `app.js`). Render it only when `S.session.role === 'lgu_ldrrmc'`; make the handler return early with the F5 permission message for other roles.

**Accept.** Barangay Official dashboard has no Declare Emergency button; LGU still has it and it works.

---

### F9 · "0 corroborations / 1 corroborations"

**Change.**
1. Add to `js/util.js`: `plural(n, one, many)` → returns `n + ' ' + (n === 1 ? one : many)`, and expose it.
2. **LOCATE** every corroboration label in `js/screens.js` (dashboard Recent Incidents, incident list/detail) and `js/map.js` popup (line ~144). Show **"No corroborations yet"** for 0, **"1 corroboration"**, **"N corroborations"**; Filipino via i18n ("Wala pang kumpirmasyon", "1 kumpirmasyon", "N kumpirmasyon" — reuse existing Filipino terminology if i18n already has one).

**Accept.** The dashboard shows "1 corroboration" and "No corroborations yet".

---

### F10 · Relief & Inventory → Active Distributions → **View** does nothing

**Change.** **LOCATE** `relief-view` in `app.js`. If missing or broken, add `distDetailModal(id, st)` to `js/relief.js` (pattern of `invDetailModal`) showing: title, barangay, location name + address, schedule (`fmtDate(distribution_at)`), contact person + phone (tel link), eligibility list, required documents, note, active state, Waze link when `UG_GEO.classify` is `ok`. Footer: Close, plus for staff (`barangay_official`, `lgu_ldrrmc`) **Verify beneficiary** (`relief-verify`) and **Edit** (`relief-edit`). Export it and call it from the `relief-view` handler. (The footer buttons work because of F4.)

**Accept.** View opens the detail; Verify/Edit inside it work.

---

### F11 · Citizen offline report disappears after "Force Refresh" (no warning)

**Root cause (confirmed).** `UG_PWA.forceRefresh()` calls `clearQueue()`, deleting every report/SOS waiting to be sent.

**Change.**
1. `js/pwa.js` `forceRefresh()`: **never** clear the queue. Keep clearing caches/snapshot/notifications. Remove the `clearQueue()` call.
2. **LOCATE** the `force-refresh` action in `app.js`: if `UG_PWA.state.queued > 0`, first show `UG_FEATURES.confirm`: "You have N report(s) waiting to send. They will be kept and sent when you're back online. Reload the app now?" Rename the resident-facing button "Reload app" (keep "Force Refresh" for staff if you prefer, same behaviour).
3. **My Reports** (LOCATE the citizen reports list in `screens.js`): merge `UG_PWA.listQueue()` rows (non-SOS) at the top with a "Waiting to send" badge and "Saved on this phone — will send automatically when you're online." Rows with `failed = true` show "Could not send — tap to retry" (retry = `UG_PWA.flushQueue()`) and a delete option with confirmation.

**Accept.** Offline: submit a report → it appears in My Reports as "Waiting to send" → press Reload app → still there → reconnect → it is sent and becomes a normal report with a code.

---

### F12 · Report form: "Drag the pin to the hazard" but no pin is visible (tester outside Lingayen) · SOS detail map is blank

**Root cause (confirmed).** The pin is placed at the device GPS (Dasol, ~119.86 E). `MapView.mount` sets `maxBounds = UG_GEO.MAP_BOUNDS` (min lng 119.98) with `maxBoundsViscosity: 1`, so the view is clamped to Lingayen and the pin sits off-screen and cannot be reached. The same clamp blanks the SOS detail map for an SOS sent from outside the box.

**Change** in `js/map.js`:
1. `setReportPin(initial, onDrop, onOutside)`: if `initial` is missing or outside `UG_GEO.MAP_BOUNDS`, place the pin at `UG_GEO.CENTER`, `map.setView(UG_GEO.CENTER, UG_GEO.ZOOM)`, and call `onOutside()` so the form shows: "Your current location is outside Lingayen. Move the pin to where the hazard is." Always pan to the pin after placing it. On `dragend`, clamp the position into `MAP_BOUNDS` (`L.latLngBounds(...).contains`, else snap back and toast "Pin must be inside Lingayen").
2. Make the pin obvious: size 30, add a short CSS pulse ring, and set `title`/`alt` "Drag me".
3. `mount(container, opts)`: accept `opts.unbounded === true` to skip `maxBounds`/`minZoom` limits. Use it for the SOS detail map (`js/sos.js` `sosDetailModal` → `MapView.mount(el, { center, zoom: 16, unbounded: true })`) and any other *detail* map that shows a single stored point. Note: `MapView` keeps a single `ctx`, so mounting the SOS mini-map destroys the page map; **LOCATE** how the page map is remounted after a modal closes and make sure the main map comes back (re-render on modal close is acceptable).
4. Wire `onOutside` in the report form (**LOCATE** `setReportPin`/`reportPin` usage in `screens.js`/`app.js`).

**Accept.** With GPS outside Lingayen, the report map shows a draggable pin in Lingayen plus the notice; dragging works; an SOS from outside the area shows its real position on the detail map.

---

### F13 · Super Admin → **Users** shows "No accounts yet / 0 of 0" although the request returns 200

**Facts.** The network panel shows `profiles?select=*&order=created_at…` → **200, 1.2 kB**. RLS `profiles_read` always returns at least the caller's own row, so the data arrives but never reaches `UG.DATA.users`.

**Change (diagnose, then fix).**
1. **LOCATE** the admin loader in `repo.js`/`app.js` (`admin-load`, `loadUsers`, `UG.DATA.users =`). Check, in this order, and fix what is wrong:
   - Results assigned to a different key than `UG.DATA.users`, or a different shape (e.g. `{data}` vs array).
   - A later `loadAll()` / realtime refresh resetting `UG.DATA.users = []`.
   - Users + audit loaded with `Promise.all`, so a failing audit query discards the users result and the error is swallowed. → Load them **independently**; each sets its own error state.
   - A client-side filter by role/barangay that drops all rows.
2. Every admin loader must surface failures through `st.error` (the screen already renders an error panel with "Try Again") instead of silently returning `[]`.
3. Add to `docs/MIGRATION-NOTES.md` a "Super Admin checks" block with:
   ```sql
   select id, email, role, is_super_admin, disabled from public.profiles where role = 'lgu_ldrrmc';
   select to_regclass('public.audit_log_with_actor') as audit_view;
   select count(*) from public.audit_log;
   ```

**Accept.** Users lists every account (at least the Super Admin's own); a failing query shows the error panel.

---

### F14 · Super Admin → **Activity Log** empty

**Change.** Apply the same loader review as F13 to the audit loader (likely `audit_log_with_actor`, migration 045). If the view query fails (view missing because 045 was not applied, or `is_super_admin` missing), **fall back** to `audit_log` with `actor:profiles(full_name, role, is_super_admin, unit_role, barangay)` embedded and map it to the same shape (`actor_name`, `actor_role`, `actor_barangay`, …). Show an error panel if both fail. If the table is genuinely empty, keep the empty state but add the hint "Entries appear after accounts, incidents or advisories change. If this stays empty, ask the administrator to apply migrations 033 and 045."

**Accept.** After any change (e.g. editing a hotline), the Activity Log shows the entry for the Super Admin.

---

## 3. Final steps (do all)

1. `migrations/048_fixpack_01.sql` exists, is idempotent, ends with `notify pgrst, 'reload schema';`. Add it to the run-order table in `docs/MIGRATION-NOTES.md`.
2. Bump `sw.js` `VERSION` → `uniguard-v12`; `env.js` `BUILD` → `2026-10-24.1`.
3. `node --check` every edited JS file; grep the repo for leftovers: `onclick="event.stopPropagation()"` on `data-act` buttons (should be none), `VAPID` in non-admin strings (none), `clearQueue()` inside `forceRefresh` (none).
4. Update `docs/TEST-CHECKLIST-ALL.md` with one checklist line per task F1–F14 (role, steps, expected).
5. Write `FIXPACK-01-RESULT.md` in the repo root containing: for each task — status (done / partially / blocked), files changed, what was found when LOCATE-ing, and anything the owner must do manually (Supabase URL config, run migration 048, set `APP_PUBLIC_URL`, redeploy Edge Functions if touched); the tester answer for "Go live vs Retry"; and a **"Noticed, not fixed"** list.
6. Stop. Do not start any other work.
