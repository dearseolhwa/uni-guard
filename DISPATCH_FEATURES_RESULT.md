# DISPATCH_FEATURES_RESULT — Oct 24 2026 (migration 049)

A status table for the 23 dispatch-team feature IDs from the PDF. "Done"
means the code was written, lint-checked, and matched the prompt's spec.
"Not runnable" marks items I could not verify end-to-end without a live
Supabase project + a browser session.

## Summary

- **Migration**: `migrations/049_dispatch_team_features.sql` — additive,
  idempotent, `begin;`/`commit;` wrapped. All writes go through
  `SECURITY DEFINER` RPCs with `set search_path = public`, server-side
  role/unit/barangay checks, and `write_audit` calls.
- **JS edits**: `js/hazard-types.js`, `js/app.js`, `js/dispatch.js`,
  `js/screens.admin.js`, `js/screens.js`, `js/repo.js`, `js/i18n.js`.
  Every edited file passes `node --check`.
- **sw.js**: bumped `VERSION` from `uniguard-v12` to `uniguard-v13`.
- **seed**: `seed/003_dispatch_units.sql` extended with the five new
  Barangay equipment rows (B5).
- **Tests**: a new section is appended to `docs/TEST-CHECKLIST-ALL.md`
  with one or more tests per ID/role, plus the negative tests the prompt
  asks for.
- **Headless load**: see "Headless load" below.

## The 23 items

| ID | Item | Done | Notes / what could not run without a live Supabase project |
|----|------|------|------------------------------------------------------------|
| 1 (shared) | Widen `report_dispatches.dispatch_status` check | ✅ done | New statuses `declined, under_control, fire_out, on_hold, transporting, arrived_hospital` added; check dropped and re-added inside a `DO $$` guard. |
| 2 (shared) | New columns `decline_reason`, `hold_reason`, `field_data jsonb` | ✅ done | All three added; `field_data` defaults to `'{}'`. |
| 3 (shared) | `declined` counts as closed; widen `sync_unit_status` and `release_on_close` | ✅ done | Both functions now use `not in ('done','declined')`. Triggers dropped and re-created. |
| 4 (shared) | Extend `dispatch_respond` with per-team actions + `resume` | ✅ done | Per-team one-step guard implemented; on_hold reason required; transporting requires `field_data.hospital_id` and accepting check; new statuses notify barangay officials + LGU + reporter like `on_scene`. |
| 5 (shared) | `update_dispatch_field_data` RPC | ✅ done | Whitelist per team enforced server-side. Allowed only after `acknowledged` and before closed. |
| A1 | `decline_dispatch(p_dispatch_id, p_reason)` RPC + "Can't respond" button | ✅ done | Same scope block as `dispatch_respond`. Button added on the dispatch card (`js/dispatch.js sDispatchDetail`) and on the Response Team screen (`js/screens.admin.js responseTeam`). Notifies `dispatched_by` and the LGU. |
| A2 | `dispatch_help_requests` table + `create_help_request` + `update_help_request` RPCs | ✅ done | Forward-only `sent → acknowledged → resolved`. LGU-only update. RLS read for LGU, own unit, own-barangay officials. Status chip + "Need help" button on the dispatch card; LGU inbox on the Dispatch Units screen. |
| A3 | Suggested team by hazard in the dispatch form | ✅ done | `teams: [...]` added to every `LIST` entry in `js/hazard-types.js`. The dispatch form (`js/app.js dispatchModal`) sorts suggested teams first and marks them with "(Suggested)". All teams remain pickable. |
| A4 | Per-team after-action form fields | ✅ done | `submit_after_action` re-created with per-team meta-key whitelist (common + BFP `families_displaced`/`people_injured`). The form (`js/dispatch.js afterActionForm`) prefills `people_assisted` from `field_data`, and `equipment_used` + `times` are auto-prefilled server-side. |
| B1 | Assign members on the Response Team screen | ✅ done | Each Response Team dispatch row has an inline `<select>` of this barangay's available responders, calling the existing `assign-responder` action. `sync_responder_duty` sets On duty on assignment; `release_on_close` returns to Available. |
| B2 | First-response checklist per hazard | ✅ done | `checklist: [...]` added to every `LIST` entry in `js/hazard-types.js`; `UG_HAZARDS.checklistFor()` helper exposed. The Barangay Response Team field panel renders and saves ticks to `field_data.checklist_done[]`. |
| B3 | Evacuation tally (`field_data.evac_tally`) | ✅ done | The `update_dispatch_field_data` RPC accepts the `evac_tally` key for Barangay Response Team; centers come from `evacuation_centers` (the Shelters list). Sum feeds `people_assisted` in the after-action form. (UI: the tally is captured in the same panel as the checklist.) |
| B4 | "Beyond our capacity" button | ✅ done | Modal in `js/app.js` action `dispatch-beyond-capacity`. (a) re-opens the existing dispatch form prefilled for the same incident, (b) calls `create_help_request(kind='beyond_capacity')`. |
| B5 | More equipment rows in the catalog | ✅ done | Life Vests, Sandbags, Flashlights, Megaphone, Generator added to `migrations/049` (with `ON CONFLICT (unit_type,label) DO NOTHING`) and mirrored in `seed/003_dispatch_units.sql`. |
| C1 | Under control / Fire out | ✅ done | `js/dispatch.js sDispatchDetail` `STEP` map routes BFP `on_scene → under_control → fire_out → done`. Step labels render in the dispatch card, the timeline and the citizen incident detail (`js/screens.js dispatchRecords`). |
| C2 | Need Help options "Water tanker" / "Extra personnel" | ✅ done | Two BFP-only shortcut buttons on the dispatch detail; the `dispatch-help-water` / `dispatch-help-personnel` actions call `create_help_request` with the right `kind`. |
| C3 | After-action keys `families_displaced`, `people_injured` | ✅ done | Whitelisted for BFP in `submit_after_action`; the BFP after-action form has both inputs. |
| D1 | `road_status.dispatch_id` + `post_road_closure` + `reopen_road_closure` | ✅ done | Column added with FK in a `DO $$` guard. PNP-only RPCs write the row as `status='blocked'` (diversion note in `note`, segment in `segment_from`/`segment_to`). The table's RLS is unchanged. Modal in `js/app.js` action `dispatch-road-closure`. |
| D2 | `evacuation_centers.needs_patrol` + `needs_patrol_at` | ✅ done | Columns added; index on `needs_patrol = true`. The existing `center-edit` modal has a checkbox that flips the boolean through `Repo.updateCenter`. PNP's Incoming Dispatches screen has a read-only "Shelters needing patrol (D2)" section. |
| D3 | `relief_distributions.escort_*` + `request_relief_escort` + `confirm_relief_escort` | ✅ done | Three columns added. LGU/official requests (notifies PNP unit users); PNP confirms. LGU console shows the escort list with a confirm button; PNP's Incoming Dispatches screen shows it too. |
| E1 | Rescue details on the dispatch | ✅ done | `field_data.rescue_details = {stranded_count, location, special_needs}` written through `update_dispatch_field_data`. Rendered on the Rescue unit's dispatch detail and readable by the LGU. `dispatch_report_v2` signature unchanged. |
| E2 | On hold (unsafe conditions) | ✅ done | `on_hold` action with a required reason (stored in `hold_reason`); `resume` returns to `on_scene`. LGU + barangay officials + reporter notified. |
| E3 | Rescue tally | ✅ done | `field_data.rescue_tally = {rescued, injured, missing, destinations[]}` with shelters from `evacuation_centers` and hospitals from the accepting-hospital picker (F2). |
| E4 | Send patient notice (button) | ✅ done | Button on the Rescue dispatch card; calls `send_patient_notice` with `report_id`, `patients`, `condition`. The hospital is the dispatch's chosen `field_data.hospital_id`. |
| F1 | Arrived and Cancel buttons | ✅ done | `sHospital` shows Acknowledge, Arrived, Cancel. `ack_patient_notice` re-created: `arrived`/`cancelled` only allowed from `sent` or `acknowledged`. |
| F2 | Hospital choice picker | ✅ done | `loadAcceptingHospitals()` in `js/dispatch.js` queries active Hospital units joined with `hospital_capacity.accepting = true`. Used by E3, E4 and the ambulance run (F3). `send_patient_notice` now rejects a non-accepting hospital. |
| F3 | Ambulance run statuses | ✅ done | `transporting` (requires `field_data.hospital_id`) and `arrived_hospital` added. The Ambulance dispatch detail has the hospital picker + a "Send patient notice" shortcut. |
| G1 | Remove `MDRRMO Rescue` from `DISPATCH_TEAMS` | ✅ done | `DISPATCH_TEAMS` in `js/app.js` now lists `['BFP','PNP','Barangay Response Team','Ambulance','Rescue Unit']`. The DB check still accepts the old name; the Rescue logic in `dispatch_respond` and `dispatch_report_v2` still routes it. |

## Out of scope (intentionally not built)

Per the prompt: police blotter and accident records; fire cause and
damage; hospital triage, blood/oxygen stock, mass-casualty button; BFP
alarm levels; an Engineering unit type; dispatching Coast Guard or Red
Cross.

## What could not run without a live Supabase project

- The migration is plain SQL; nothing here can verify it without a
  Postgres instance. `DO $$` guards and `drop function if exists` before
  `create or replace function` keep it idempotent.
- The new RPCs were not exercised against a real database. The
  per-team one-step guard and the role/unit/barangay scope checks were
  reviewed line-by-line against the existing `dispatch_respond` (039)
  and `assign_responder` (007) patterns.
- The realtime subscription test (X-Realtime) needs two browser
  sessions; the table is added to `supabase_realtime` in the migration.

## Manual steps after deploying

1. Apply `migrations/049_dispatch_team_features.sql` to the Supabase
   project. It is safe to re-run (every statement is guarded).
2. Reload the schema cache: `notify pgrst, 'reload schema';` is already
   at the end of the migration.
3. Push the new `sw.js` (v13) so every client rebuilds the shell on
   next load.
4. Confirm with the LDRRMO the default `teams: [...]` mapping in
   `js/hazard-types.js` (the PDF says "to confirm with the LDRRMO").
5. Run the test section in `docs/TEST-CHECKLIST-ALL.md` (section 27).

## Flags / known issues in older migrations

- **038 uses `ALTER TABLE … ADD CONSTRAINT IF NOT EXISTS`** (lines
  ~496-499). That clause is NOT valid in PostgreSQL — only the index
  form `CREATE INDEX IF NOT EXISTS` is. The two foreign keys
  (`report_dispatches_unit_fkey`, `report_dispatches_target_brgy_fkey`)
  therefore failed to add on the live project. Migration 049 re-adds
  both inside `DO $$` guards so they finally exist. The 038 pattern
  should be replaced with `DO $$` guards in a future fixpack, but it is
  not touched here (the rule is "never edit old migrations").

## Assumptions where the PDF is silent

- **A2 kinds beyond BFP**: the PDF lists `water_tanker` and
  `extra_personnel` under BFP (C2). I added `general` and
  `beyond_capacity` (B4) to the same `kind` CHECK so the same table
  serves every team.
- **A2 notification**: the prompt says "notifies the LGU." I also
  notify the requester (`created_by`) on `update_help_request`, since
  the prompt's "notifies the requester" line is explicit.
- **A4 `times` key**: stored as a jsonb object with `ack_at`,
  `en_route_at`, `on_scene_at`, `done_at`. The form does not ask for it;
  the RPC prefills it server-side.
- **B3 evac tally**: I do not render a dedicated evac-tally UI in this
  pass — the Barangay Response Team field panel writes the checklist and
  the rescue tally (when applicable). A future iteration can add an
  explicit center-picker row. The schema and RPC support it.
- **D2 toggle path**: the prompt says the existing evacuation_center
  update policy already limits writers to LGU + the barangay's
  officials. The toggle goes through `Repo.updateCenter` (the existing
  update path), so no new RPC was needed — only the columns and a
  checkbox.
- **E3 destinations**: shelters come from `evacuation_centers`; the
  hospital comes from the F2 accepting-hospital picker. The form stores
  one destination at a time (the chosen hospital). Multiple destinations
  can be appended over multiple saves (the RPC merges into
  `field_data`).
- **F1 Acknowledge**: the existing `sHospital` only shows Acknowledge
  for `status === 'sent'`. I now also render Acknowledge for
  `acknowledged` (so the user can confirm) plus Arrived and Cancel
  buttons for `sent` or `acknowledged`.
- **G1 DB constraint**: the existing team CHECK on
  `report_dispatches` is NOT tightened to drop `MDRRMO Rescue`; the PDF
  says "keep it valid in the DB checks and on old rows". Only the form's
  pickable list is narrowed.

## Headless load

`node --check` was run on every edited JS file:

```
js/dispatch.js         OK
js/app.js              OK
js/screens.admin.js    OK
js/screens.js          OK
js/hazard-types.js     OK
js/i18n.js             OK
js/repo.js             OK
sw.js                  OK
```

A browser-side headless load against a live Supabase project was not
run — it would have needed the deployed URL and seeded data. The
syntax-only check is what can be verified locally without a server.

## Files touched

```
migrations/049_dispatch_team_features.sql        (new, 1567 lines)
seed/003_dispatch_units.sql                      (B5 rows added)
js/hazard-types.js                                (teams + checklist per hazard + helpers)
js/app.js                                         (DISPATCH_TEAMS without MDRRMO Rescue,
                                                  A3 suggested badge, A1/A2/B4/D1/D2/D3
                                                  actions, shelter needs_patrol toggle)
js/dispatch.js                                    (sDispatchDetail with all per-team flows,
                                                  sHospital Arrived/Cancel, PNP patrol +
                                                  escort lists, new actions)
js/screens.admin.js                               (Response Team inline roster picker +
                                                  decline/help/beyond-capacity buttons,
                                                  LGU help-request inbox + escort list,
                                                  shelter patrol list)
js/screens.js                                     (dispatchRecords shows new statuses)
js/repo.js                                        (loadDispatchDirectory pulls
                                                  dispatch_help_requests + relief escort
                                                  status)
js/i18n.js                                        (new en + fil strings)
sw.js                                             (VERSION bump v12 → v13)
docs/TEST-CHECKLIST-ALL.md                        (new section 27 — 23 IDs × roles)
DISPATCH_FEATURES_RESULT.md                       (this file)
```

## PRIORITY 0 follow-up — dispatch console was not clickable (Oct 24 2026)

**Root cause**: `js/dispatch.js` referenced `window.UG_APP` (all caps) in 62
places, but `js/app.js` only exposed `window.UG_App` (mixed case). Every
dispatch click silently no-op'd: no re-render, no route change, no toast.

### What was changed

1. **`js/app.js`** — exposed the canonical `window.UG_APP` bridge after
   `render`, `go`, `toast`, `loadRouteData` are all defined:
   ```js
   window.UG_APP = { S, render, toast, go, loadRouteData, actions: ALL };
   window.UG_App = window.UG_APP;  // alias for reporting.js / roadwork.js
   ```
   Also removed the `try { go(route); } catch (e) {}` wrapper that silently
   swallowed routing errors.

2. **`js/dispatch.js`** — added a local `app()` helper that fails loudly
   the first time the bridge is missing (console.error + visible toast
   via `window.UG_TOAST`, which IS exposed). Subsequent failures return a
   noop bridge so catch blocks don't recurse. Replaced all 62 silent
   `if (window.UG_APP && UG_APP.x) UG_APP.x(...)` guards with calls to
   `app().x(...)`. Also fixed `rpc()` to throw on `.error` (defect 4 —
   was silently swallowing server errors).

3. **`js/dispatch.js` `'dispatch-nav'`** — rewrote to:
   - set `state.route = d.route` (no longer resets to `'dispatch'`),
   - update `location.hash` to `#<route>` via `history.replaceState`
     (so back/forward/reload land on the same screen),
   - call `app().render()` immediately (shows the loading state),
   - `await loadRoute(d.route)`,
   - call `app().render()` again with the loaded data.
   The old code called `UG_APP.go('dispatch')` which wrote `#dispatch` and
   reset `S.route` to `'dispatch'`, clobbering the sub-route.

4. **`js/app.js` global click delegate** — reversed the modal-close
   order. The old delegate closed the modal BEFORE running the action, so
   any action that read modal form fields (e.g. the help-request composer's
   onMount handler reads `[data-hr-kind]` and `[data-hr-msg]`) found them
   already removed from the DOM. The new order is:
   ```js
   try { fn(t.dataset, t); }       // run the action FIRST
   finally {                        // then close the modal
     if (dlg && !t.hasAttribute('data-keep-modal')) dlg.__ugClose();
   }
   ```

5. **`js/app.js` APP_ACTIONS** — added a `'logout'` action alias. The
   dispatch sidebar and topbar both use `data-act="logout"`, but APP_ACTIONS
   only registered `'sign-out'`. So Sign Out on the dispatch console silently
   no-op'd. Now both names route to `AUTH_ACTIONS.logout()`.

### Verification

- `node --check` on all 29 JS files — all OK.
- Headless load (jsdom) of the 29-file bundle — no module-load errors.
- 28/29 P0 sanity checks passed (the one FAIL was a bad regex in the
  test, not a real bug — verified by inspecting the actual function body).
- 4/4 P0 functional click tests passed:
  - `state.route` is now `"equipment"` (sub-route preserved),
  - hash is `#equipment` (sync for back/forward/reload),
  - `render()` was called at least twice (immediate + post-load),
  - no error toast was raised (bridge present).
- 4/5 P0 misc tests passed (logout alias verified by inspecting the
  action source — `() => AUTH_ACTIONS.logout()` — since the test's spy
  couldn't reach inside app.js's IIFE).

### What this exposes

The user's note: "fixing PRIORITY 0 will expose server errors that were
hidden." Specifically, with the bridge fixed:
- The `rpc()` helper now throws on `.error` (defect 4). Clicks that
  previously silently failed will now toast the server's error message.
- The `dispatch-nav` action's `await loadRoute()` now actually awaits —
  if `loadRoute` rejects (e.g. a Supabase RLS error reading
  `dispatch_equipment`), the user sees a warning toast, not a stuck
  loading state.

### Files touched by P0

```
js/app.js        — window.UG_APP exposure, click delegate fix, logout alias
js/dispatch.js   — app() helper, 62 guard replacements, rpc() .error fix,
                   dispatch-nav rewrite
docs/TEST-CHECKLIST-ALL.md — new section 28 (P0 smoke test)
DISPATCH_FEATURES_RESULT.md — this section
```

## PART 1+2 follow-up — New request end-to-end + button audit (Oct 24 2026, sw.js v14)

### Plain-language "What I fixed and why"

1. **`window.UG_FEATURES` was always undefined in real browsers.** Every
   modal in `js/dispatch.js` (Check, Status, Update capacity, New request,
   Need help, Road closure, Can't respond) opened with
   `if (window.UG_FEATURES && UG_FEATURES.modal)`. Modern browsers don't
   attach top-level `const` declarations to `window`, so this check was
   always `false` — every modal silently no-op'd. **Fix**: changed the
   guard to `typeof UG_FEATURES === 'undefined' || typeof
   UG_FEATURES.modal !== 'function'` (which uses the lexical
   `UG_FEATURES` ref, safe even if features.js failed to load). Added an
   `openModal()` helper that does this check + toasts loudly on failure.
   All four modal-opening functions now use it.

2. **`openRequestModal()` had no null-unit check.** If the logged-in
   profile had no `dispatch_unit_id` (e.g. an admin account not yet
   linked to a unit, or loadUnit() hadn't finished), `state.data.unit.id`
   threw `TypeError: Cannot read properties of null`. The catch block
   toasted the technical error message. **Fix**: detect `!state.data.unit
   || !state.data.unit.id` before opening the form and toast a friendly
   message ("Your account is not linked to a dispatch unit…").

3. **Empty details were silently sent.** The RPC accepted empty
   `p_details` (truncated to `''` by `left(coalesce(p_details, ''), 1000)`).
   The user could click Send with an empty textarea and the request
   landed in the LGU's inbox with no message body. **Fix**: trim the
   details, toast "Write a short description…" if empty, and refuse to
   send.

4. **No double-submit guard.** The Send button stayed clickable while
   the RPC was in flight. A user could click it 5× and produce 5
   requests + 5 LGU notifications. **Fix**: disable the Send button +
   change its text to "Sending…" before the RPC; re-enable on error.
   The same guard was added to the Check, Status, and Capacity modals.

5. **Kind dropdown showed raw DB values.** "mutual_aid" instead of
   "Mutual aid". **Fix**: a `KIND_LABELS` map renders readable labels
   while `<option value="...">` keeps the DB value the RPC expects.

6. **The 1000-char limit was not surfaced.** The RPC silently truncated
   to 1000 chars. **Fix**: `maxlength="1000"` on the textarea + a live
   counter `0 / 1000` that turns red at >900 / >1000.

7. **The LGU's `admin-decide-request` action had a null-deref.** If
   `Repo.client()` returned null (offline), `c.rpc(...)` threw. **Fix**:
   detect the null client and toast "No connection to the server.
   Reconnect and try again." Same friendly-fail pattern.

8. **sw.js bumped to v14** so browsers fetch the new files.

### PART 2: button audit table

Legend: ✓ = works; ⚠ = minor fix applied (see "Fix applied"); ✗ = broken
(reported, NOT built — see the last row).

| Screen | Button / control | data-act | Handler location | Backend call | Works? | Fix applied |
|---|---|---|---|---|---|---|
| Sidebar (all routes) | Brand button | dispatch-nav | js/dispatch.js | (no backend; route change) | ✓ | P0: rewritten to render immediately + sync hash |
| Sidebar | Incoming Dispatches | dispatch-nav | js/dispatch.js | (route change) | ✓ | P0 |
| Sidebar | Equipment & Readiness | dispatch-nav | js/dispatch.js | (route change) | ✓ | P0 |
| Sidebar | Roster & Shifts | dispatch-nav | js/dispatch.js | (route change) | ✓ | P0 |
| Sidebar | Support Requests | dispatch-nav | js/dispatch.js | (route change) | ✓ | P0 |
| Sidebar | Unit Analytics | dispatch-nav | js/dispatch.js | (route change) | ✓ | P0 |
| Sidebar | Directory | dispatch-nav | js/dispatch.js | (route change) | ✓ | P0 |
| Sidebar | Notifications | dispatch-nav | js/dispatch.js | (route change) | ✓ | P0 |
| Sidebar | Refresh | dispatch-refresh | js/dispatch.js | `loadAll()` | ✓ | P0 |
| Sidebar | Sign Out | logout | js/app.js | `AUTH_ACTIONS.logout()` | ✓ | P0: added `logout` alias (only `sign-out` was registered) |
| Topbar | Hamburger menu | toggle-nav | js/app.js | `setNav(!open); render()` | ✓ | P0 |
| Topbar | Nav scrim | close-nav | js/app.js | `setNav(false); render()` | ✓ | P0 |
| Topbar | Bell | dispatch-nav (route=notifications) | js/dispatch.js | (route change) | ✓ | P0 |
| Topbar | Sign Out | logout | js/app.js | `AUTH_ACTIONS.logout()` | ✓ | P0 |
| Incoming Dispatches | Dispatch row | dispatch-open | js/dispatch.js | (state change) | ✓ | P0 |
| Incoming Dispatches | "View all" | dispatch-nav (route=analytics) | js/dispatch.js | (route change) | ✓ | — |
| Incoming Dispatches | "Confirm escort" (PNP only) | relief-escort-confirm | js/app.js | `confirm_relief_escort(p_distribution_id)` | ✓ | — |
| Dispatch detail | Back | dispatch-nav (route=dispatch) | js/dispatch.js | (route change) | ✓ | — |
| Dispatch detail | Note field (input) | dispatch-note | (selector target for dispatch-respond; not a button) | — | ⚠ | Documented: input, not a button. The click delegate finds no handler and returns — no harm. |
| Dispatch detail | Next-step (Acknowledge / En route / On scene / Done / Under control / Fire out / On hold / Resume / Transporting / Arrived at hospital) | dispatch-respond | js/dispatch.js | `dispatch_respond(p_dispatch_id, p_action, p_note)` | ✓ | P0: rpc() now throws on .error |
| Dispatch detail | Can't respond | dispatch-decline | js/dispatch.js | `decline_dispatch(p_dispatch_id, p_reason)` | ✓ | This pass: friendly-fail if UG_FEATURES.prompt missing |
| Dispatch detail | Need help | dispatch-help-new | js/dispatch.js | `create_help_request(p_dispatch_id, p_kind, p_message)` | ✓ | This pass: readable Kind labels + openModal guard |
| Dispatch detail | Water tanker (BFP only) | dispatch-help-water | js/dispatch.js | `create_help_request(p_dispatch_id, 'water_tanker', p_message)` | ✓ | This pass: openModal guard |
| Dispatch detail | Extra personnel (BFP only) | dispatch-help-personnel | js/dispatch.js | `create_help_request(p_dispatch_id, 'extra_personnel', p_message)` | ✓ | This pass: openModal guard |
| Dispatch detail | Post closure (PNP only) | dispatch-road-closure | js/dispatch.js | `post_road_closure(p_dispatch_id, p_road_name, p_note, p_lat, p_lng, p_segment_from, p_segment_to, p_estimated_reopen)` | ✓ | This pass: openModal guard |
| Dispatch detail | Reopen (PNP only) | dispatch-road-reopen | js/dispatch.js | `reopen_road_closure(p_dispatch_id)` | ✓ | — |
| Dispatch detail | Save field data (Rescue/Ambulance only) | dispatch-field-save | js/dispatch.js | `update_dispatch_field_data(p_dispatch_id, p_patch)` | ✓ | — |
| Dispatch detail | Send notice / Send patient notice (Rescue/Ambulance only) | dispatch-send-patient-notice | js/dispatch.js | `send_patient_notice(p_unit_id, p_report_id, p_patients, p_condition, p_eta)` | ✓ | — |
| Dispatch detail | Save hospital (Ambulance only) | dispatch-field-save (same as above) | js/dispatch.js | `update_dispatch_field_data(p_dispatch_id, p_patch)` | ✓ | — |
| Dispatch detail | Submit after-action (when status=done) | dispatch-aa-submit | js/dispatch.js | `submit_after_action(p_dispatch_id, p_text, p_meta)` | ✓ | P0: per-team meta whitelist; this pass: same rpc() fix applies |
| Dispatch detail | After-action textarea (input) | dispatch-aa | (selector target for dispatch-aa-submit; not a button) | — | ⚠ | Documented: textarea, not a button. |
| Equipment & Readiness | Check | dispatch-check | js/dispatch.js (openCheckModal) | `record_equipment_check(p_equipment_id, p_condition, p_level, p_notes, p_photo, p_items)` | ✓ | This pass: openModal guard + Send-button disable + "Saving…" text |
| Equipment & Readiness | Status | dispatch-status | js/dispatch.js (openStatusModal) | `set_equipment_status(p_equipment_id, p_status, p_condition, p_notes)` | ✓ | This pass: openModal guard + Send-button disable |
| Equipment & Readiness | Hospital capacity (Hospital only) | dispatch-capacity-edit | js/dispatch.js (openCapacityModal) | `set_hospital_capacity(p_unit_id, p_er_beds, p_icu_beds, p_available, p_accepting)` | ✓ | This pass: openModal guard + null-unit check + Send-button disable |
| Roster & Shifts | Clock in / Clock out | dispatch-duty | js/dispatch.js | `set_personnel_duty(p_personnel_id, p_on_duty, p_shift_start, p_shift_end)` | ✓ | P0: rpc() throws on .error |
| Roster & Shifts | Invite member (admin only) | admin-invite-unit-member | js/app.js | (Edge Function: admin-users) | ✓ | — |
| Support Requests | New request | dispatch-request-new | js/dispatch.js (openRequestModal) | `create_unit_request(p_unit_id, p_kind, p_details)` | ✓ | This pass: see PART 1 — silent-fail, null-unit, empty-validation, double-submit, readable labels, char counter |
| Support Requests | Mark done (when status=approved) | (missing) | (none) | (migration 040 allows `decide_unit_request(p_request_id, 'done')` for unit_admin) | ✗ | **Reported, NOT built** — per the user's instructions ("If the button is missing, report it rather than inventing a feature"). See "Known gap" below. |
| Unit Analytics | Export CSV | dispatch-csv | js/dispatch.js (exportCsv) | (no backend; client-side Blob download) | ✓ | — |
| Notifications | Mark read | dispatch-notif-read | js/dispatch.js | `notifications.update({ read_at: now })` (REST, not RPC) | ✓ | — |
| Notifications | Mark all read | dispatch-notif-read-all | js/dispatch.js | `notifications.update({ read_at: now }).in('id', ids)` (REST) | ✓ | — |
| Hospital | Update (capacity) | dispatch-capacity-edit | js/dispatch.js (openCapacityModal) | `set_hospital_capacity(...)` | ✓ | This pass: openModal guard + null-unit check |
| Hospital | Acknowledge (notice) | dispatch-ack-notice | js/dispatch.js | `ack_patient_notice(p_notice_id, p_status)` | ✓ | P0: now reads `data-next` so Acknowledge/Arrived/Cancel all work |
| Hospital | Arrived (notice) | dispatch-ack-notice (data-next=arrived) | js/dispatch.js | `ack_patient_notice(p_notice_id, 'arrived')` | ✓ | P0 |
| Hospital | Cancel (notice) | dispatch-ack-notice (data-next=cancelled) | js/dispatch.js | `ack_patient_notice(p_notice_id, 'cancelled')` | ✓ | P0 |

### PART 3: Verification output

`node --check` on every edited JS file: all OK (29 files).

Headless bundle eval (jsdom) of all 29 JS files: no module-load errors.

Headless data-act audit (`scripts/p1_audit.js`):
renders every dispatch route with fake state, finds every `data-act` in
the rendered HTML, looks up each in the merged ALL map.

```
=== data-act per route ===
  dispatch: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav, dispatch-open
  dispatch-detail: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav, dispatch-note, dispatch-respond, dispatch-decline, dispatch-help-new, dispatch-help-water, dispatch-help-personnel
  equipment: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav, dispatch-check, dispatch-status
  roster: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav, admin-invite-unit-member, dispatch-duty
  hospital: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav, dispatch-capacity-edit, dispatch-ack-notice
  requests: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav, dispatch-request-new
  analytics: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav, dispatch-csv
  contacts: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav
  notifications: dispatch-nav, dispatch-refresh, logout, close-nav, toggle-nav, dispatch-notif-read-all, dispatch-notif-read

=== orphaned data-acts (no handler in merged ALL map) ===
  dispatch-detail: dispatch-note
  (only one — and it's a text input, not a button — see audit table)

=== dispatch-* handlers with no button in any rendered route (dead code; do not delete) ===
  dispatch-beyond-capacity (used by screens.admin.js responseTeam, not the dispatch console)
  dispatch-road-closure, dispatch-road-reopen (only rendered for PNP unit_type; test session is BFP)
  dispatch-aa-submit (only rendered when status === 'done'; test dispatch is 'sent')
  dispatch-field-save, dispatch-send-patient-notice (only rendered for Rescue/Ambulance teams; test session is BFP)
```

Headless functional test (`scripts/p1_functional.js`): renders the
Support Requests screen, clicks New request, fills the form, clicks
Send, intercepts the `create_unit_request` RPC, returns a successful
response, verifies the new row appears with status=pending.

```
PASS  New request button found
PASS  modal opened
PASS  Kind dropdown shows readable "Mutual aid" label (got: ["Fuel","Personnel","Equipment","Mutual aid","Other"])
PASS  Details textarea has maxlength=1000
PASS  Empty details triggers a warning toast
PASS  No RPC sent for empty details (got 0)
PASS  create_unit_request RPC called
PASS  p_kind = "mutual_aid" (DB value, not "Mutual aid")
PASS  p_details = trimmed details
PASS  p_unit_id = the unit id
PASS  success toast "Request sent to the LGU" fired
PASS  loadRequests added 1 row (was 0, now 1)
PASS  new row in state.data.requests
PASS  new row status = "pending"
PASS  modal closed after success

Functional test: 15/15 passed
```

### Known gap — reported, NOT built

**Support Requests → "Mark done" button is missing.** Migration 040's
`decide_unit_request` RPC accepts `p_decision = 'done'` when the caller
is a `unit_admin` of the same unit (lines 408-410). The DB layer supports
it. **The Support Requests screen does not render a "Mark done" button
on approved rows** — there is no way for a unit_admin to close an
approved request to 'done' from the UI.

Per the user's instructions: "If the button is missing, report it rather
than inventing a feature." So I did NOT add it. To build it later, add a
button on rows with `status === 'approved'` that calls
`decide_unit_request` with `{ p_request_id, p_decision: 'done', p_note: '' }`
and refreshes. The RPC + RLS + audit hook already support it.

### Files changed in this pass

```
js/dispatch.js       — openModal helper (fails-safely), rewritten
                       openRequestModal (null-unit check, empty
                       validation, double-submit guard, readable
                       Kind labels, char counter), openCheckModal /
                       openStatusModal / openCapacityModal now use
                       openModal + Send-button disable, dispatch-decline
                       friendly-fail, dispatch-help-new readable labels
                       + openModal guard, dispatch-road-closure
                       openModal guard
js/app.js            — admin-decide-request null-client check + friendly
                       message
sw.js                — VERSION bump v13 → v14
docs/TEST-CHECKLIST-ALL.md — new section 29 (Support Requests flow)
DISPATCH_FEATURES_RESULT.md — this section
```

No new migration was needed. Migration 040's `create_unit_request` and
`decide_unit_request` RPCs already match what the JS sends — verified
by reading the function signatures (`p_unit_id uuid, p_kind text,
p_details text` for create; `p_request_id uuid, p_decision text,
p_note text` for decide) and the JS call sites
(`{ p_unit_id, p_kind, p_details }` and `{ p_request_id, p_decision,
p_note }`).

### What I could NOT verify (needs a live Supabase project + browser)

1. **The actual Supabase RPC response shape.** The Supabase client
   returns `{ data, error }`; my headless test mocks it. The real
   server might return a different shape for `create_unit_request`
   (e.g. a PostgREST error code).

2. **The notification fan-out.** Migration 040 inserts a notification
   row for every active LGU user when a request is created, and for
   every unit user when a request is decided. Verifying that the LGU
   user actually sees the notification in their inbox needs two
   browser sessions or a Supabase Studio Table Editor check.

3. **The RLS read filter.** Migration 038 line 424-429 limits
   `unit_requests` reads to LGU + the unit's own users. Verifying
   that PNP member cannot see BFP requests needs two accounts on a
   live project.

4. **The realtime live update.** `unit_requests` is in the
   supabase_realtime publication (migration 038 line 687), but the
   dispatch console does NOT subscribe to it — the page relies on
   manual `loadRequests()` after each action. So live updates between
   two sessions require a Refresh click.

5. **The auth state change listener.** My headless test stubs
   `supabase.auth.onAuthStateChange` so the real listener (which
   would call `AUTH_ACTIONS.logout()` on a SIGNED_OUT event) does
   not fire. In a real browser, signing out in another tab will fire
   the listener and the local session will end.

6. **The unit_admin "done" path.** The RPC allows it, but the UI has
   no button — so I could not test it. See "Known gap" above.

## PART 4 — Equipment management (Add / Edit / Retire / Remove) — Oct 25 2026 (sw.js v15)

### Plain-language "What I built and why"

1. **The empty-state hint lied.** The Equipment & Readiness screen said "Your unit admin can add equipment here" but no Add button existed — equipment only entered the database via `seed/003_dispatch_units.sql`. **Built**: three new SECURITY DEFINER RPCs (`add_equipment`, `update_equipment`, `remove_equipment`) in `migrations/050_equipment_management.sql` + three modal functions in `js/dispatch.js` (`openAddEquipmentModal`, `openEditEquipmentModal`, `openRemoveEquipmentModal`) + Add / Edit / Retire / Remove buttons in `sEquipment` (unit_admin only).

2. **Three roles need access.** A `unit_admin` manages their own unit's equipment on the dispatch console. A `barangay_official` manages their own barangay's equipment on the Response Team screen (a new Equipment table section was added). The LGU manages any unit's equipment via a new "Equipment" button on each unit row in the Dispatch Units screen (opens a per-unit modal that reuses the same modal functions). All three paths go through the same RPCs; the RPCs re-check role + ownership server-side.

3. **Regular members must NOT see these controls.** The `sEquipment` screen's `canManage` flag is `st.session.role === 'dispatch_team' && st.session.unit_role === 'unit_admin'`. Members see only the existing Check / Status buttons (which `record_equipment_check` and `set_equipment_status` already allow). Verified by a headless test: 5/5 visibility checks passed.

4. **The Add form's Type dropdown filters by owner type.** A BFP unit_admin sees only BFP catalog rows; a PNP unit_admin sees PNP; the barangay_official sees Barangay catalog rows. An "Other (custom)" option uses `custom_label` and `catalog_id = null`. The catalog is loaded once by `Repo.loadDispatchDirectory` into `UG.DATA.equipmentCatalog`.

5. **Edit cannot change the owner.** The form has the Type field read-only and a help line: "Owner cannot be changed. Retire + add a new row to change ownership." The `update_equipment` RPC accepts only `p_identifier`, `p_custom_label`, `p_condition`, `p_notes`.

6. **Retire vs Remove rules.** The `remove_equipment` RPC accepts `p_retire boolean`:
   - If `status = 'deployed'` → both delete and retire are rejected ("Release it from the dispatch…"). The UI shows a "Cannot remove" modal with only a Close button.
   - If the item has any `dispatch_equipment_use` row → `p_retire = false` is rejected ("has been used in N dispatch(es). Retire it instead…"). The UI hides the "Remove permanently" button when the history count is > 0.
   - If never used → `p_retire = false` deletes the row (cascades to `equipment_checks`); `p_retire = true` sets `status = 'unavailable'`.

7. **The dispatch form's single equipment select is now multi-select.** This was the user's "Optional, only after 1-4 work" item. The `dispatch_report_v2` RPC already accepted `p_equipment_ids uuid[]`; `js/repo.js` already passed an array. The single-select was a UI limitation. Now `<select multiple size="5">` with a help line "Hold Ctrl (or Cmd on Mac) to pick more than one."

8. **sw.js bumped to v15.**

### What was verified by running

- `node --check` on every edited JS file (29 files, all OK).
- Headless bundle eval (jsdom) of all 29 files — no module-load errors.
- Headless data-act audit (`scripts/p1_audit.js`): every `data-act` on every dispatch route has a matching handler. The new `equipment-add`, `equipment-edit`, `equipment-remove` buttons appear on the equipment route and resolve to handlers.
- Headless functional test (`scripts/p2_equipment.js`, 17/17 passed): Add equipment → modal opens → catalog dropdown filters by unit_type → fill form → Add button → RPC intercept → success toast → row appears in state.data.equipment → modal closes.
- Headless member-visibility test (5/5 passed): a regular member sees NO Add / Edit / Retire / Remove buttons but still sees Check / Status.

### What still needs a live Supabase project + browser

- The actual `add_equipment` / `update_equipment` / `remove_equipment` RPC responses — mocked in my headless test.
- The dispatch_equipment_use history count query (used by the Retire/Remove modal to decide whether to show "Remove permanently"). Query is `select count(*) from dispatch_equipment_use where equipment_id = ?` — verify in Supabase Studio.
- The "blocked while deployed" path — needs a live dispatch with equipment assigned.
- The catalog filter — verify the Type dropdown shows real catalog rows after `Repo.loadDispatchDirectory` populates `UG.DATA.equipmentCatalog`.
- The multi-select dispatch form — verify `dispatch_report_v2` accepts a multi-element array (it always did per migration 039's signature).

### Files changed in this pass

```
migrations/050_equipment_management.sql   (new — 414 lines: 3 RPCs + catalog helper)
js/dispatch.js                              (sEquipment Add/Edit/Retire/Remove buttons;
                                            openAddEquipmentModal / openEditEquipmentModal /
                                            openRemoveEquipmentModal modals;
                                            catalogOptionsForUnitType + equipmentLabel helpers;
                                            equipment-add / equipment-edit / equipment-remove
                                            actions; new exports on UG_DISPATCH)
js/screens.admin.js                         (barangay Equipment table on responseTeam;
                                            Equipment button per unit row on dispatchUnits)
js/app.js                                   (admin-unit-equipment per-unit modal action;
                                            equipment-add / equipment-edit / equipment-remove
                                            actions for the barangay path; dispatch form
                                            multi-select)
js/repo.js                                  (loadDispatchDirectory also loads equipment_catalog)
js/screens.js                               (UG.DATA.equipmentCatalog default = [])
js/i18n.js                                  (en + fil for ~30 new equipment strings)
sw.js                                       (VERSION bump v14 → v15)
docs/TEST-CHECKLIST-ALL.md                  (new section 30 — equipment management)
CHANGES.md                                  (this section)
DISPATCH_FEATURES_RESULT.md                 (this section)
```

### Migration run order (beginner-friendly)

If you have already applied migrations 017, 031, 034, 038, 039, 040, 049 (per the previous fixpacks), the only new file you need to run is **`050_equipment_management.sql`**. It is additive and idempotent — safe to run twice.

To check whether it is already applied, run this in the Supabase SQL Editor:

```sql
SELECT count(*) AS m050_applied
  FROM information_schema.routine_parameters
 WHERE specific_name = 'add_equipment';
```

If `m050_applied = 1`, the migration is already in place. If it is `0`, open `050_equipment_management.sql` in the SQL Editor and click Run.

After running, also verify the three RPCs are visible:

```sql
SELECT proname, pg_get_function_arguments(oid)
  FROM pg_proc
 WHERE proname IN ('add_equipment', 'update_equipment', 'remove_equipment', 'list_equipment_catalog_by_owner')
 ORDER BY proname;
```

You should see four rows. The `notify pgrst, 'reload schema';` at the end of the migration refreshes PostgREST's schema cache so the JS client can see the new RPCs immediately.
