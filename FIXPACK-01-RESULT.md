# UniGuard · Fix Pack 01: result

All 14 tasks are **done**. Build `2026-10-24.1`, service worker `uniguard-v12`.

## What you must do by hand (in this order)

1. **Run `migrations/048_fixpack_01.sql`** in the Supabase SQL editor. Advisories cannot be published until you do (F2). The file is safe to re-run.
2. **Supabase → Authentication → URL Configuration**
   - **Site URL**: the deployed **https** URL.
   - **Redirect URLs**: `https://<deployed-host>/**`. For desktop development only, also add `http://127.0.0.1:5500/**`.
3. **`env.js` → `APP_PUBLIC_URL`**: set this to the deployed https URL. I did not change it because I don't know the URL. Until you set it, email links sent from `127.0.0.1` will still fail on phones.
4. **Deploy the static files.** The new service worker version makes installed PWAs update themselves.
5. **Edge Functions:** none were changed, so there is nothing to redeploy.

## Answer for the tester: "Go live" vs "Retry"

They did not do the same thing. **"Go live"** was a leftover preview switch: it only hid the offline banner and did not check the connection. **"Retry"** really checks the connection, sends any reports or SOS saved on the phone, and reloads the data. "Go live" is now gone from production builds. There is a single connectivity banner, and its button is now called **"Try again"**.

## How it was checked

- Every edited `.js` file passes `node --check`.
- I loaded the app in headless Chrome. It reaches the sign-in screen with no console errors.
- **F1:** an expired confirmation link shows the expiry message and the resend button. A confirmation link shows "Your email is confirmed".
- **In-page test (F4/F5/F7):**
  - A `data-act` button inside a pop-up runs its action and closes the pop-up; `data-keep-modal` keeps it open.
  - Five identical toasts collapse into one marked "×4"; at most 3 toasts show at once.
  - Toasts sit at the top of the screen and can be clicked through.
  - "TypeError: Failed to fetch" is shown as "No internet connection…".
- **Not tested at runtime:** anything that needs a signed-in session or the live Supabase project (F2, F3, F6, the F7 queue being sent after reconnect, F8, F10–F14). I reviewed that code but did not run it. Please run section 26 of `docs/TEST-CHECKLIST-ALL.md` on the deployed build.

## Per task

### F1 · Confirmation link opens an error page: done
- **Files:** `js/auth.js`, `js/app.js`, `js/screens.auth.js`, `js/i18n.js`, `docs/DEPLOY.md`, `env.js` (comment only).
- **What was found:** the boot sequence is `boot()` in `app.js`, which calls `Auth.restore()`. The sign-in screen already shows notices through `S.auth.notice` / `S.auth.error`, so I reused that instead of adding a new screen.
- **What changed:**
  - `Auth.redirectUrl()` is now used by sign-up, resend-confirmation and password reset. It never picks a loopback address when a real one is available.
  - When someone returns from an email link, the app reads the link's result before supabase-js clears the URL:
    - Success shows "Your email is confirmed…". If Supabase also created a session, the app opens normally and shows the same message once as a toast.
    - An expired or used link shows the expiry message and a **"Request a new link"** button, which reuses the existing resend action with the email typed into the form.
    - Password recovery links behave exactly as before.
    - The token is removed from the address bar afterwards.
  - I also updated the existing Redirect URLs row in the DEPLOY.md table, which still listed `localhost:5173`.

### F2 · `delivery_mode` column missing: done
- **Files:** `migrations/048_fixpack_01.sql` (Section A), `js/repo.js`, `js/app.js`, `docs/MIGRATION-NOTES.md`.
- **What was found:**
  - The insert in `Repo.createAdvisory` sends these keys: `author_id, title, body, severity, kind, affected_area, citywide, expires_at, published_at, alert_type, language, delivery_mode`.
  - `delivery_mode` is the only key with no column. The client only ever sends `'push'` or `'in_app'`; I added a normaliser anyway.
  - `advisory_targets` and `fanout_advisory` are separate and unaffected.
- **What changed:**
  - `push-dispatch` is now called only when `delivery_mode === 'push'`. In-app-only advisories still go through the in-app fan-out, so they still reach the inbox.
  - A schema error during publish shows: "Could not publish the advisory. The system needs an update — contact the system administrator." The raw error goes to `console.error`.

### F3 · Dispatch Units Edit / Account / Delete not clickable: done
- **Files:** `js/screens.admin.js`, `js/roadwork.js`.
- **What was found:**
  - The delegate uses `closest('[data-act]')` and runs only that innermost element, so it needed no change.
  - Handlers already existed for `admin-edit-unit`, `admin-unit-accounts`, `admin-delete-unit`, `open-unit`, `rs-edit` and `rs-del`.
- **What changed:** removed the five `onclick="event.stopPropagation()"` attributes. The Waze link in `sos.js` keeps its own, as the plan says.

### F4 · Pop-up buttons do nothing: done
- **Files:** `js/app.js`, `js/features.js`, `js/roadwork.js`.
- **What was found:**
  - Seven listeners were bound to `#ug-root`: `click`, `input` ×2, `change`, `keydown` ×2 (one in capture phase) and `submit`.
  - All seven now listen on `document`, are bound once (guarded by `window.__ugDelegated`), and ignore events inside `.ug-urgent-host`.
  - Side benefit: the **Retry / Upload now** buttons on the `#ug-conn` banner also live outside `#ug-root`, so they were dead too. They work now.
  - Pop-ups that contain `data-act` buttons:
    - shelter detail
    - hotline detail and the change-request chooser
    - change-request review
    - template picker
    - unit detail
    - unit roster
    - activity-log entry
    - inventory detail
    - road-status detail
    - SOS detail
    - road-status form (its "Use my location" button)
- **What changed:**
  - Clicking a `data-act` button inside a `.ug-modal` closes that pop-up first, through the stored `wrap.__ugClose`, which also removes the Escape listener.
  - Only `rs-pin` ("Use my location" in the road-status form) carries `data-keep-modal`, because it fills fields inside its own form.
  - After `sos-ack` / `sos-resolve`, the SOS log is reloaded and the screen re-renders.
  - Hotline change requests already called `submit_change_request` with `edit` / `delete`. The confirmation now reads "Your request was sent to the Super Admin for review."
  - Road status: `S_session` was never set and `isStaff` was never used. `roadDetailModal(id, st)` now gets the session, and Edit shows only for `barangay_official` and `lgu_ldrrmc`.

### F5 · Technical wording / raw errors: done
- **Files:** `js/util.js`, `js/app.js`, `js/settings.js`, `js/screens.js`, `js/screens.web.js`, `js/i18n.js`.
- **What changed:**
  - **Errors:**
    - `UG_UTIL.friendlyError()` maps errors to the plan's table, in English and Filipino.
    - `UG_UTIL.looksTechnical()` decides when a toast message needs that mapping. A toast passed an `Error` object, or text that looks like a raw server or browser error, gets the friendly text and is logged raw to `console.error`.
    - Our own plain sentences pass through unchanged. I checked every literal toast against the patterns.
  - **Settings → Notifications:**
    - Every role gets one "Alerts on this phone" card. It shows On / Off / Blocked in browser settings / Not supported, with a "Turn on alerts" button and the text-message info line.
    - Only LGU accounts also see the policy switches (push for advisories, text-message backup, daily email summary, quiet hours). Their help text is rewritten in plain words.
    - "VAPID" now appears only in code identifiers. The admin help says "push notification key (set by the system administrator)".
  - **Offline:**
    - In Settings → Offline and on both resident Offline pages (`mOffline` on phones, `cwOffline` on desktop), I applied the renames from the plan, removed the "Strategy" row, replaced "Build" with "App version", and set the new subtitle.
    - "Cached on This Device" became "Available without a signal", because "cache" wording had to go.

### F6 · Refresh while offline logs the user out: done
- **Files:** `js/auth.js`, `js/app.js`, `js/screens.auth.js`, `js/i18n.js`.
- **What changed:**
  - **`loadProfile`:** failures are now labelled as either "no connection" or "profile missing". A disabled account is labelled too.
  - **`restore()`:**
    - The app signs out only when the server gives a definite answer (profile missing or account disabled).
    - With no connection, it opens the cached profile for the same user id in offline mode.
    - With no session while the device is offline, it also opens from the cache.
    - Any other failure is passed back to the app. The app then shows the error with a "Try Again" button (`retry-restore`) on the sign-in screen and does not sign out.
  - **`Auth.revalidate()`:**
    - It runs on the browser's `online` event (once per reconnection, guarded against overlapping runs), and after a successful Retry or "Back online" when the session came from the cache.
    - If the session is really gone, the user lands on sign-in with "Please sign in again."
  - The Supabase client options in `repo.js` were already `persistSession / autoRefreshToken / detectSessionInUrl: true`, so no change was needed there.

### F7 · SOS offline, stacked toasts, "Go live": done
- **Files:** `js/app.js`, `js/pwa.js`, `js/repo.js`, `js/sos.js`, `js/util.js`, `js/screens.js`, `js/screens.web.js`, `css/app.css`, `js/i18n.js`.
- **SOS send (`sos-trigger`):**
  - Taps are ignored while a send is in progress, and the SOS button is shown as disabled.
  - If GPS fails, the SOS is still sent or saved, without a location.
  - With no connection, or when the request fails for network reasons, the SOS goes to `UG_PWA.upsertQueuedSos`. A queued SOS from the last 10 minutes is updated with the newer position instead of adding another row.
  - The result shows inside the SOS card ("Waiting for signal" plus the instructions, or the friendly refusal message), not as a toast.
  - `Repo.submitSos` without a backend now uses the same de-duplication.
- **`flushQueue`:**
  - SOS rows are sent first.
  - A network error stops the loop until the next try.
  - A server refusal adds one to that row's attempt count and moves on to the next row. After 5 attempts the row is marked failed.
  - A delivered SOS updates the card and shows the toast "Your SOS was delivered to the MDRRMO." once.
  - The page listens for the service worker's `FLUSH_QUEUE` message. New queue rows also register a Background Sync (`uniguard-queue`).
- **SOS screen:** the backup call is now a real `tel:0756322222` link. The hotline card moves above the SOS button while an SOS is queued or refused.
- **Toasts:**
  - The same text again refreshes the existing toast and shows a "×N" counter instead of stacking.
  - At most 3 show at once.
  - They sit at the top of the screen and can be clicked through.
- **Banners:** the in-frame offline strips (resident web, resident mobile and the staff console) now show only when `UG_CONFIG.DEV` is true, labelled "Preview: simulate offline". `#ug-conn` is the only connectivity banner, and its button reads "Try again".
- **My addition, beyond the plan:** a queued SOS is sent with "[Saved offline at <time>]" added to its note. The `submit_sos` RPC has no parameter for the time it was first tapped, and the duty officer needs to know it was delayed.

### F8 · Declare Emergency shown to barangay officials: done
- **Files:** `js/screens.js`, `js/app.js`.
- **What changed:** the button renders only for `lgu_ldrrmc`. For any other role the action stops early with "You don't have permission to do that."

### F9 · "0 / 1 corroborations": done
- **Files:** `js/util.js`, `js/screens.js`, `js/map.js`, `js/i18n.js`.
- **What changed:** added `UG_UTIL.plural()` and `UG_UTIL.corroborationLabel()`. They are used in dashboard Recent Incidents and the map pop-up, the only two places that printed "N corroborations". Other screens print "N/3" or "N of 3 needed" and were left alone.

### F10 · Active Distributions → View does nothing: done
- **Files:** `js/relief.js`, `js/app.js`.
- **What was found:** the `relief-view` handler existed but used `U.badge(...)`, and `U` is not defined in `app.js`. Every click threw a ReferenceError.
- **What changed:** added `UG_RELIEF.distDetailModal(id, st)` with every field the plan lists (tap-to-call contact; the Waze link only when the location is inside Lingayen). Staff get Verify beneficiary / Edit in the footer. `relief-view` now just calls it.

### F11 · Offline report lost on Force Refresh: done
- **Files:** `js/pwa.js`, `js/app.js`, `js/screens.js`, `js/screens.web.js`, `js/settings.js`, `js/i18n.js`.
- **What changed:**
  - `forceRefresh()` no longer clears the queue.
  - `force-refresh` asks for confirmation when items are waiting ("You have N report(s) waiting to send…").
  - Residents see the button as **"Reload app"**; staff keep "Force Refresh".
  - My Reports lists queued (non-SOS) reports at the top with "Waiting to send". Failed rows show "Could not send — tap to retry" (`queue-retry`, which retries failed rows too) and a Delete button with confirmation (`queue-delete`).

### F12 · Report pin off-screen / blank SOS detail map: done
- **Files:** `js/map.js`, `js/app.js`, `js/sos.js`, `js/features.js`, `js/screens.js`, `js/screens.web.js`, `css/screens-additions.css`, `js/i18n.js`.
- **What changed:**
  - **Report pin:**
    - A GPS fix outside the Lingayen box starts the pin at the town centre and shows "Your current location is outside Lingayen. Move the pin to where the hazard is."
    - Dropping the pin outside the box snaps it back with "Pin must be inside Lingayen".
    - The pin is larger (30 px), titled "Drag me", and has a pulse ring (no animation when the phone asks for reduced motion).
  - **SOS detail map:**
    - `MapView.mount` accepts `unbounded: true`, used by the SOS detail map.
    - **Page map after closing:** I added an `onClose` option to `UG_FEATURES.modal`. The SOS pop-up uses it to clear its mini map and re-render, which brings the page map back.
- **Small difference from the plan:** the "outside" notice appears only when there is a GPS fix outside the box. With no GPS at all, the pin is still centred, but the existing "We could not read your GPS" note is shown instead, because "your location is outside Lingayen" would be wrong. The outside notice is shown in place without a re-render, to avoid a remount loop.

### F13 · Users shows "No accounts yet": done
- **Files:** `js/app.js`, `docs/MIGRATION-NOTES.md`.
- **What was found:** following the plan's checklist in order:
  - **Wrong key: yes, this was the bug.** `loadRouteData('users')` stored the result in `S.users`, but the screen reads `UG.DATA.users`. That was only copied once in `bootstrapData()`, when the list was still empty.
  - No later reset, no `Promise.all`, and no over-strict filter.
- **What changed:**
  - Both are now kept in sync on every load.
  - Failures are logged and shown through `st.error`.
  - `admin-load` ("Try Again") reuses the same loader.
  - Added the "Super Admin checks" block to MIGRATION-NOTES.

### F14 · Activity Log empty: done
- **Files:** `js/app.js`, `js/repo.js`, `js/i18n.js`.
- **What was found:** the same `S.audit` vs `UG.DATA.audit` bug as F13.
- **What changed:**
  - `Repo.listAudit` now tries three sources in order:
    1. the `audit_log_with_actor` view;
    2. `audit_log` with `actor:profiles(...)` embedded;
    3. plain `audit_log` rows (kept so a project without migration 043 still shows entries, only without actor details).
  - All three return the same row shape. The error panel shows only if every source fails.
  - The empty-state hint now mentions migrations 033 and 045.

## Final checks
- `048_fixpack_01.sql` is idempotent, wrapped in `begin; … commit;`, and ends with `notify pgrst, 'reload schema';`. It is listed in the MIGRATION-NOTES run order.
- Leftover searches:
  - `stopPropagation`: only the Waze `<a>` in `sos.js` (intended).
  - `VAPID`: only in config identifiers, in no visible text.
  - `clearQueue()`: no longer inside `forceRefresh`.
- `docs/TEST-CHECKLIST-ALL.md` has a new section 26 with one line per task (F1–F14).
- **i18n:** all new strings have both `en` and `fil` entries. New keys are grouped at the end of each language block under "fix pack 01" comments. Existing Settings keys were reworded in place.

## Noticed, not fixed (for Fix Pack 02)
1. **Reports are not saved when the phone is connected to Wi-Fi or data that has no actual internet.** `submit-report` only queues a report when `navigator.onLine` is false. On a weak or captive connection it fails with a toast instead of queuing. The same pattern as the F7 SOS fix would solve it.
2. **Deleting a unit is always permanent.** `admin-delete-unit` calls `delete_dispatch_unit` and then always does a direct `delete` on `dispatch_units`. If the RPC was meant as a soft delete, the follow-up turns it into a hard delete.
3. **Invitation emails can point to `127.0.0.1`.** `Repo.adminUsers` builds the invitation `redirectUrl` from `window.location.origin`, so invites sent from the dev server have the same loopback problem as F1. `Auth.redirectUrl()` could be reused there.
4. **Silent empty lists outside the admin screens.** `Repo.listSos`, `listOthersReview` and `listResponders` return `[]` on error, so a failing query looks like "no data", the same silent pattern as F13.
5. **Untranslated text.** Settings → Offline "Connection: Online/Offline" and "never", the SOS screen text, and the Super Admin Users screen headers are hard-coded English. The confirm/prompt "Cancel" / "Save" buttons in `features.js` are also untranslated.
6. **Policy switches only affect one device.** Quiet hours, email digest and text-message backup are stored per user in `localStorage`. They are not a real system policy and have no effect on the server.
7. **Small leak in `UG_FEATURES.confirm()`.** It creates a `MutationObserver` that is never disconnected, so one observer is left behind per confirmation.
8. **Retry signs people out abruptly.** When `Repo.forceReload` returns `no-session`, `retry-load` calls `AUTH_ACTIONS.logout()`, which asks "Sign out of UniGuard on this device?". That is a confusing question when the session has already expired.
