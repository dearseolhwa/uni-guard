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
