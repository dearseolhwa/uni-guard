# Changes

## 2026-10-11 — Barangay Response Team + Dispatch Teams (BFP, PNP, Rescue, Hospital)
- **4th user role `dispatch_team`** with its own interface at `#dispatch`. A dispatch user is tied to ONE unit (`profiles.dispatch_unit_id`) with role `unit_admin` or `member`. Self sign-up can never produce dispatch_team — the LGU creates units and the first unit_admin through `admin-users`; a unit_admin can then invite members into their own unit.
- **Municipality-wide units** (`dispatch_units`) for BFP / PNP / Rescue / Hospital. There is no coverage table — these units serve every barangay.
- **Per-barangay Response Team** feature in the existing barangay console (no new role): incoming dispatches where team = 'Barangay Response Team' and the report is in the official's barangay, Acknowledge → En route → On scene → Done actions, roster with Available / On duty / Off duty, barangay-owned equipment (boat, rope, stretcher, radio, first-aid kit) with available / deployed / maintenance, and a read-only dispatch directory + barangay captain contacts.
- **Per-unit equipment and readiness checks** (`dispatch_equipment`, `equipment_checks`). The dispatch picker rejects equipment that is needs_repair, missing, out_of_service, or already deployed. A 24-hour-skip shows OVERDUE to the unit admin and the LGU.
- **Hospital-specific screen**: ER / ICU / available beds, an Accepting / Divert toggle, and incoming-patient notices. Hospitals get NO field dispatch; they receive patient notices through `send_patient_notice` + `ack_patient_notice`.
- **Critical notification rules** in `fanout_dispatch` v2: Barangay Response Team dispatch notifies the report's barangay (action alert) + reporter + LGU; municipality-wide unit dispatch notifies the unit's users + the report's barangay (info) + reporter + LGU; never another barangay or unit. Dispatch status updates (acknowledged / en route / on scene / done) notify the barangay officials of the report's barangay and the LGU; on_scene and done also notify the reporter.
- **Support requests** (`unit_requests`): a unit asks the LGU for fuel, extra personnel, equipment or mutual aid; the LGU approves / declines / completes; the unit is notified.
- **After-action report** attached to each completed dispatch; visible to the LGU and to the report's barangay.
- **Unit analytics**: response time (dispatched → ack → on_scene), monthly count, equipment usage, CSV export. The LGU sees every unit.
- **Tightened RLS**: a dispatch user reads and writes only their own unit's data; an official reads and writes only their barangay's response team data; officials may read units and equipment readiness (read-only); the LGU is the only role that creates or edits dispatch_units. The `report_dispatches` read policy was widened so a unit can read only its own dispatches.
- **Audience filters** in `push-dispatch` and `sms-fallback`: `barangayId` (an official can target only their own; the LGU may broadcast municipality-wide) and `unitId` (LGU can target a specific unit).
- Files: `migrations/038_dispatch_units.sql`, `migrations/039_dispatch_report_v2.sql`, `migrations/040_dispatch_rpcs.sql`, `seed/003_dispatch_units.sql`; `js/dispatch.js`, `css/dispatch.css`; `js/app.js`, `js/screens.js`, `js/screens.web.js`, `js/screens.admin.js`, `js/auth.js`, `js/repo.js`; `supabase/functions/admin-users`, `supabase/functions/push-dispatch`, `supabase/functions/sms-fallback`; `index.html`, `sw.js` (v7), `env.js` (build bump); docs/RLS-TEST.sql, docs/TEST-CHECKLIST-ALL.md, docs/MIGRATION-NOTES.md.
- Out of scope (later phase): live unit location sharing, opt-in, visible to the LGU and the incident's barangay, stopped when the dispatch is Done.

---

# Changes

## 2026-10-11 — LDRRMO barangay filter
- Incident Queue (LGU / LDRRMO console): new **Barangay** dropdown beside the status chips. It narrows the list, the status chip counts and the escalation banner to one barangay; each option shows how many reports that barangay has. A **Clear** button resets it. Barangay officials are unaffected (already scoped to their barangay).
- Files: js/screens.js (dIncidents), js/app.js (state, change handler, clear action), sw.js (cache v6), env.js (build bump).


---

# UniGuard revision 2 — security, workflow and module fixes (fix prompt v2)

JS syntax-checked with `node --check` on every file; new migrations are
additive and idempotent; no demo accounts or credentials were added anywhere
(seed files untouched). See `docs/MIGRATION-NOTES.md` for the live-project
run order and `DOC_UPDATES.md` for the paper edits.

## Phase A — security and database
- **024 created** (was missing though referenced by README/DEPLOY): analytics
  views now run as the caller AND carry explicit scope predicates — LGU sees
  all barangays, an official only their own, citizens zero rows. Views over
  permissive tables (`evacuation_centers`) are scoped inside the view body.
  Date-ranged function twins added; old view names keep working.
- **027**: citizen edits of their own report (15-minute window) can only
  change description / hazard type / "Others" text / location note / photo /
  coordinates / severity (severity is reporter-set by design, stated in the
  summary). Status, barangay, reporter, code, resolved_at are trigger-
  protected; status only moves through the RPC. `reports_update.with check`
  tightened. Every citizen edit writes an audit row.
- **028**: strict status flow for ALL roles — one step at a time,
  `resolved`/`rejected` final. `guard_report_status` + `advance_report_status`
  redefined; corroboration auto-verify (022/025) still works (a legal step).
- **029**: SOS reads scoped to the sender's barangay for officials (LGU all,
  citizens own); `update_sos_status` RPC (scoped + audited + notifies the
  sender); road-status and road-work writes scoped to the official's own
  barangay; `road_status` added to `fill_barangay_id()`; advisory publishing
  restricted (official = own barangay only, citywide LGU-only) with guards on
  `advisory_targets` and a widen-block on updates.
- **030**: server-side location routing. Coordinates mandatory and validated
  (missing / invalid / swapped / outside Lingayen all rejected — same ladder
  as `UG_GEO.classify`). Barangay derived from coordinates for every role;
  the picked name is only a hint. `barangay_geoms` ships approximate
  centroids (OSM/PhilAtlas) — **verify against MDRRMO records** (see
  MIGRATION-NOTES). Existing reports with coordinates backfilled in a
  reviewable step.
- **033**: audit coverage — one generic row-change trigger on advisories,
  shelters, road status, road work, hotlines, guides, FAQs (with before/after
  change maps), SOS status changes, plus `shelter_occupancy_log` and a trend
  view for analytics.
- Edge functions: `'Citywide'` defaults replaced with `'Municipality-wide'`
  (push-dispatch, sms-fallback).

## Phase B — hazard reporting (citizen)
- Submission is blocked without a valid in-Lingayen location — online AND in
  the offline queue path (the database re-checks).
- GPS denial shows a plain explanation (routing + verification reasons) and
  falls back to the draggable map pin; manual coordinate entry remains as a
  secondary control.
- The raw coordinate display is replaced by the map pin (drag-to-adjust) plus
  a readable reverse-geocoded address label.
- Optional **"Exact address / landmark"** field added end-to-end (column,
  RPC payload, feed, detail views, edit form).
- **Edit own report** within 15 minutes: Edit button on the citizen detail
  view (mobile + web), same validation as submit, window enforced again by
  027, every edit audited; after 15 minutes the control explains the closure.

## Phase C — incidents (console)
- **Priority Sort** is now a real toggle: severity → corroboration count →
  recency, with an active state and switch-back.
- **Command View** built: live map + active incident list (Reported / Verified
  / Response Dispatched) + status pipeline, scope-respecting, with an exit
  control.
- **Edit incident** (officials in scope + LGU): modal form on the detail
  view; every change audit-logged; identity/status fields excluded.
- Status labels + strict flow applied everywhere from `js/theme.js`; the
  Verify action stays.
- Dashboard: recent incidents and advisories are clickable to their detail
  views; recent rows carry "View Details" affordance.
- Home stat cards read live store data (open reports in the citizen's
  barangay was a hardcoded "1" before).

## Phase D — navigation and layout
- Citizen top nav rebuilt: secondary destinations (Guides, FAQs, Hotlines,
  Offline) collapse into a **"More" dropdown**; SOS, user menu and **Sign Out
  (labelled, last in row)** stay visible at 1280/1366/1440 and on mobile at
  100% zoom; name column collapses first, then the Sign Out label.
- Stacking fixed at the variable level: one z-index scale (`--ug-z-*`),
  Leaflet sealed in its own stacking context; drawer, scrim, modal, dropdown,
  toasts, urgent alerts, SOS button can no longer interleave wrongly.
- **"My Location"** map control added to every Leaflet map (same corner,
  size and spacing as the other controls; touch-friendly). Road-work
  composer's My Location button aligned; raw lat/lng inputs replaced by a
  pin readout + GPS button + typed fallback.

## Phase E — details views
- **SOS entries**: the missing detail view exists (sender, contact, time,
  status, map location, Waze, acknowledge/resolve actions) from the console
  SOS log.
- **Shelters**: citizen cards open the full record (address/notes, capacity,
  occupancy, status, coordinates, Waze).
- **Road status**: full record view (segment, cause, timing, updater, Waze).
- **Audit log rows**: clickable with the full change map ("from → to").
- Advisories keep their detail view; "Reach 0 subscribed devices" was not
  shown from real data so the hardcoded reach line stays off the advisory
  detail.

## Phase F — module fixes
- **Shelters**: **All Shelters (default) / My Barangay** toggle on the citizen
  directory; Open/Full/Closed filters verified working; occupancy changes
  audit-logged (033) and shown with capacity on the detail view.
- **Road status**: full form (road, barangay, segment, status Open/One
  lane/Closed/Under repair, cause, severity, start, estimated reopening, pin,
  notes, auto-filled updater) + Edit/Delete with confirmation; cards show
  status, cause and update time; citizens see a detail view.
- **Guides**: restructured to one guide with summary + Before/During/After +
  optional PDF; conversion migration keeps all content; visible "+ Add Guide"
  button opens a real modal form (no `prompt()`); list shows title+summary,
  detail shows the sections.
- **FAQs**: prompt()-based add/edit replaced with proper modal forms
  (question, category, multi-line answer, complete pre-filled answer); the
  "Verified, In Progress, and Resolved" wording fixed to the new labels.
- **Hotlines**: Verify button and `verify-hotline` action removed together
  with the "single verified list" wording; add/edit/delete work (LGU only,
  per RLS); the number and the Call control are real `tel:` links.
- **Audit page**: short description added; rows clickable; no stray "Layer"
  control existed in the audit screen (map layer toggles are a separate,
  working feature — left in place).

## Phase G — analytics and PDF exports
- **jsPDF + jspdf-autotable vendored** into `vendor/`, added to `sw.js`
  PRECACHE; one shared `js/pdf.js` helper (title, generated date/time,
  generated-by name+role, scope, table headers, "Page X of Y").
- **All CSV exports removed**: hotlines, analytics, users, audit log now
  export formatted PDFs; `toCSV` and the CSV branch of `download` are gone.
- Analytics screen: date-range filters (defaults last 30 days) applied on the
  server; response performance (avg report→dispatch, report→resolve);
  barangay comparison (LGU) / breakdown (official); every chart carries a
  one-line description of what it shows; PDF export of the current view and
  range.

## Phase H — dead controls audit (table)

| Control | Location | Status |
|---|---|---|
| Priority Sort (navigated to hotlines) | screens.js incident queue | **Fixed** — real toggle |
| Command View (navigated to dashboard) | screens.js incident queue | **Fixed** — new screen |
| Hotline "Verify" button | screens.js hotlines | **Removed** (with action) |
| `verify-hotline` action | app.js | **Removed** |
| "single verified list…" wording | screens.js hotlines header | **Fixed** |
| Export CSV buttons ×4 | app.js, screens.admin.js | **Fixed** → Export PDF |
| `toCSV` / CSV download branch | util.js | **Removed** |
| rs-cycle (status roulette) | app.js/roadwork.js | **Removed** → proper Edit form |
| Raw rwLat/rwLng inputs | roadwork.js composer | **Fixed** → pin + GPS + typed |
| Static "In your barangay: 1" stat | screens.web.js home | **Fixed** → live data |
| "Accuracy 6 m · captured just now" (hardcoded) | screens.web.js report | **Fixed** → real accuracy |
| Offline DATA demo set | screens.js | **Kept** — legitimate offline fallback; only shown when Supabase is not configured |
| Map "Layers" chip (dashboard header) | screens.js dashboard | **Fixed** → a button that opens/closes the layer panel on the map; the toggles now show/hide each layer in place (map.js setLayers) |
| Enter-coordinates fallback | report form | **Kept** — secondary control behind the pin map |

## Phase I — documentation
- `DOC_UPDATES.md` (new): paper edits for administrator roles, UC-16,
  advisory scope, status flow and location capture.
- `docs/MIGRATION-NOTES.md` (new): run order for the live project + a manual
  verification query per migration + data provenance note.
- `README.md` / `docs/DEPLOY.md`: migrations 026–033 added, cache name fixed
  (`uniguard-v5`), PDF libraries noted in the vendor list.
- `docs/RLS-TEST.sql`: Phase A assertions appended (rolled-back transactions).
- `docs/TEST-CHECKLIST-ALL.md`: status names and new checks updated.

## Assumptions taken (per the fix prompt's rule)
1. **Severity is reporter-set** — the report form's urgency chips set it, so
   the 15-minute edit allows changing it; the assumption is stated in 027.
2. **Stored status keys unchanged**; only labels changed, in `js/theme.js`.
3. **No official boundary polygons exist**, so 030 ships nearest-centroid
   routing with explicit validation, clearly flagged for MDRRMO verification.
4. Legacy `caution` road statuses map to `one_lane` (closest meaning).
5. `analytics_response_times` view gained `barangay_id` for scoping; the UI
   never showed it.

## Not verifiable from this repo (must be checked on live)
- Whether migration **024 was ever applied** to the live database (the file
  was missing from the repo). 024 is idempotent and safe to re-run.
- Whether the `admin-users` edge function writes audit rows for role changes
  on the live deployment (the repo version does; verify the deployed copy).

# UniGuard revision — summary

18 files changed, 3 new files added. Tested with a headless-browser pass over
the LGU console (all nav routes, incident detail, reject/advance, evacuation
centers) and the citizen mobile flow (report form incl. the new "Others"
hazard field, centers, hotlines) — zero console/page errors on either. JS
syntax-checked with `node --check` on every file.

## New files
- **js/geo.js** — the one place Lingayen's location data lives: the 32
  barangays (PSA/PhilAtlas), map center/bounds, a couple of verified real
  landmarks, and coordinate validation (`classify()` catches missing /
  invalid / swapped-lat-lng / outside-town coordinates) plus the Waze URL
  builders.
- **js/theme.js** — the one centralized color scheme: severity, status,
  shelter and hazard-type-group colors, each with a shape and a short text
  label so nothing relies on color alone, plus contrast-checked text colors.
  Injects the `--ug-*` CSS variables and `.ug-badge--*` / `.ug-step.s-*`
  classes once at startup.
- **js/hazard-types.js** — the expanded, single hazard-type list (flood,
  river overflow, drainage blockage, storm surge, coastal erosion, strong
  wind, fallen tree, landslide, earthquake, road damage, vehicular accident,
  fire, power line hazard, **Others**), with color/icon lookup and a graceful
  fallback so an old or unrecognized report never breaks.

## Task 1 — Location: Lingayen, not Dagupan
Found actual **Dagupan coordinates** hardcoded as data, not just text:
- `js/map.js` default map center, `js/repo.js` `CITY_BOUNDS` — both now read
  from `js/geo.js`.
- A database-level bug: `migrations/001_align_core_tables.sql` set the
  `barangays.city` column's **default value** to `'Dagupan City'`. Fixed to
  `'Lingayen'`. **If migration 001 was already run against a live Supabase
  project, existing barangay rows still say "Dagupan City" and need a manual
  `update` — this fix only changes the default for new rows.**
- The large offline/demo dataset in `js/screens.js` (used whenever Supabase
  isn't configured — this is what a fresh local run shows) was entirely
  Dagupan-flavored: fictional "Bonuan Gueset", "Tapuac", "Lucao", etc.
  Rewritten with real Lingayen barangays. Evacuation centers use real
  landmarks where I could verify coordinates (Provincial Capitol area,
  Narciso Ramos Sports and Civic Center, Pangasinan National High School);
  others are plausible placeholders — **flagged in the seed file for you to
  verify against MDRRMO records.**
- The built-in SVG fallback map (used when Leaflet/OSM can't load) had its
  entire node layout, labels, and `aria-label` redrawn for Lingayen and its
  real neighbors (Lingayen Gulf, Binmaley, Bugallon).
- `seed/001_sample_data.sql` rewritten with the official 32-barangay list,
  Lingayen hotlines/centers/advisories, each block guarded by
  `ON CONFLICT DO NOTHING` / `where not exists` so it's safe to re-run.
- Every "Citywide" label became "Municipality-wide" (Lingayen is a
  municipality) — including two SQL column defaults in migrations 001 and
  009 that had it hardcoded, and the auto-detection regex in `app.js` that
  reads it back out (updated so it still matches).
- `privacy.html`'s placeholder controller name, the `<title>`/meta
  description, and the noscript fallback text also updated.

## Task 2 — Colors
Centralized in `js/theme.js` (see above). Removed the *duplicate* hardcoded
hex values that used to live in `css/tokens.css` and `css/app.css` — those
files now carry comments pointing to `theme.js` as the source, so there's
exactly one place a color is ever defined, and the map, legend, list cards,
and LGU dashboard can't drift apart. Also fixed a real CSS bug I found along
the way: `--ug-st-reported: --ug-neutral;` in `tokens.css` was missing its
`var()` wrapper, making it invalid CSS.

Every severity marker (map + legend) now carries a **shape** (octagon /
diamond / circle) and a short **text label** (CRIT/HIGH/MOD), not just a
color, for colorblind accessibility. The map legend is generated from the
same `theme.js` list the markers use, so it can't fall out of sync.

## Task 3 — Directions + Waze
Root cause of "directions is broken": the `directions` action just opened a
generic OpenStreetMap search with **"Dagupan City" hardcoded** into the
fallback text, and needed browser geolocation permission to route anywhere.

**Decision: replaced the in-app OSM directions widget with the Waze
redirect everywhere** (map popup, evacuation-center cards on mobile/desktop/
LGU) rather than keeping both. Reasoning: OSM's directions widget needs
location permission to compute a route and gives no turn-by-turn guidance;
Waze's universal link needs neither and opens the navigation app people
already trust for an actual emergency drive. I did *not* implement the
optional "try the app-scheme first" layer — that pattern is flaky (silent
failures, possible double-navigation) and the universal link alone already
satisfies the spec (opens the app if installed, falls back to web/store
otherwise).

Coordinate order is correct (latitude, then longitude) everywhere. A center
with missing/invalid/out-of-bounds coordinates hides the Waze button and
shows a plain-language reason instead (`js/geo.js`'s `classify()`).

**Bug found and fixed:** the LGU "Add Evacuation Center" form had **no
latitude/longitude fields at all** — any center added through it could
never appear on the map or get a working Waze button (the database columns
already existed; only the form and the `add-center` action were missing the
plumbing). Added Lat/Lng inputs plus a "Use My Location" button.

## Task 4 — Hazard types + Others
`js/hazard-types.js` is the one list; the report form (mobile + desktop
citizen web), the dropdown, the chart coloring, and the map/legend all read
from it. Selecting **"Others"** reveals a required text field; submitting
without it shows a validation toast instead of silently accepting an empty
value. The custom text is stored in a new `reports.hazard_other_text`
column (`migrations/010_hazard_types.sql`) and shown appended to the report
wherever the hazard type is displayed ("Others: downed utility pole").
Existing reports are unaffected — `hazard_type` still stores the same kind
of text it always did, and anything not matching the new list falls back to
an "Other" look rather than breaking.

## Task 5 — LGU functionality
Confirmed bugs found by diffing every `data-act` in the codebase against its
registered handler, plus a full headless-browser walk of every route:

- **Dead button:** `js/screens.admin.js` used `data-act="admin-load-
  responders"`, which doesn't match the registered `load-responders`
  handler — the "Load roster" button on the incident assignment panel did
  nothing. Fixed.
- **Fake buttons throughout the citizen desktop web view**
  (`js/screens.web.js`): "Call" and "Directions" on Home, Hotlines, and
  Shelters, plus "Save Offline"/"Share" on the advisory detail page, all
  used `data-act="toast"` to *claim* success without doing anything. All
  rewired to the real `call`/`directions`/`save-advisory`/`share-advisory`/
  `save-center-offline` actions (the mobile view had this right already —
  only the desktop citizen shell had the fakes).
- **The LGU console pages themselves (`js/screens.js`) were not affected by
  the fake-button issue** — Users and Audit Log, which the brief specifically
  called out, were already correctly wired through `js/screens.admin.js`.
- **No "Rejected" status existed anywhere** — not in the UI, not in the
  database. The `reports.status` `CHECK` constraint only allowed
  `reported/verified/dispatched/resolved`, and the `advance_report_status`
  RPC rejected anything else. Added it end-to-end: migration extends the
  constraint and the transition-guard trigger and RPC; the LGU incident
  detail view got a "Reject" button (prompts for a reason, logged to the
  audit trail); the status pipeline, filter chips, and badges all show it.
  Status labels are now exactly **Pending → Verified → In Progress →
  Resolved**, with **Rejected** as the other way a report closes, matching
  your wording.
- Two smaller display bugs fixed alongside this: a hardcoded fake GPS
  reading (`16.0433, 120.3331`) was shown on *both* report forms
  (mobile and desktop) before GPS was even acquired, and the desktop citizen
  report form always displayed a static "Bonuan Gueset" as the submission
  barangay regardless of what the user actually picked.
- Routing still uses `history.replaceState` only (never `pushState`), so
  browser back/forward can't move between in-app routes. **Not fixed** —
  flagging it since your brief explicitly asked for back/forward to work;
  it's a bigger, more surgical change (the whole hash-routing layer assumes
  replace-only) and I ran out of turns to do it safely alongside everything
  else. Direct-link loading and refresh both work correctly already.

## Files changed
`index.html`, `css/tokens.css`, `css/app.css`, `js/app.js`, `js/repo.js`,
`js/map.js`, `js/features.js`, `js/screens.js`, `js/screens.web.js`,
`js/screens.admin.js`, `js/geo.js` (new), `js/theme.js` (new),
`js/hazard-types.js` (new), `migrations/001_align_core_tables.sql`,
`migrations/009_hardening.sql`, `migrations/010_hazard_types.sql` (new),
`seed/001_sample_data.sql`, `privacy.html`.

## Migrations to run (in order, if not already applied)
`001` through `009` as before, then the new **`010_hazard_types.sql`**.
If `001` already ran against a live database, also manually update any
existing `barangays` rows that still say `Dagupan City`.

## Remaining/known issues
- Browser back/forward doesn't traverse in-app routes (see above).
- The evacuation-center and hotline sample data is illustrative, not
  verified — re-check every name, number, capacity, and coordinate against
  MDRRMO records before this goes anywhere near production, per the notes
  left in `seed/001_sample_data.sql`.
- I did not add a design/UI pass beyond what the five tasks required (no
  new pages, no visual redesign) — only what was needed to fix the
  functionality and centralize the colors/hazards/location as asked.

---

# Feature integration — 11 new modules

Surgical add-on pass: the existing file structure, naming conventions and
design patterns are untouched. Every new feature lives in new files where
possible; the few existing files that changed only received small, targeted
patches (state slices, route entries, action handlers, render cases).

## New files
- **migrations/011_relief_assistance.sql** — `relief_distributions` +
  `authorized_beneficiaries` tables, RLS policies (citizens read, LGU/officials
  write).
- **migrations/012_road_works.sql** — `road_work_posts` table + the
  `fanout_road_work()` RPC that pushes a notification to affected-barangay
  residents. Adds nullable `road_work_id`, `relief_id`, `sos_id`, `type`
  columns to `notifications` so a tap can deep-link to any of them.
- **migrations/013_faqs.sql** — `faqs` table (category, question, answer,
  sort_order, active) with LGU-only write policy.
- **migrations/014_preparedness_guides.sql** — `preparedness_guides` table,
  keyed by `hazard_type` + `phase` ('before' / 'during' / 'after') so the
  citizen UI can render three tabs per hazard.
- **migrations/015_urgent_alert_acks.sql** — `alert_acknowledgments` table so
  the LGU can prove a resident saw an emergency alert. Also re-defines
  `advance_report_status()` so that **every status change fans out a
  notification to the original reporter** ("Processing → Deployed → Resolved"
  in the user's wording, mapped onto the existing reported/verified/
  dispatched/resolved pipeline that the analytics views already use).
- **migrations/016_sos_log.sql** — `sos_log` table + the `submit_sos()` RPC
  (rate-limited, writes an audit row, fans out a notification to every
  LGU/LDRRMO account, snapshots the caller's profile at SOS time).
- **migrations/017_road_status.sql** — `road_status` table (passable /
  caution / blocked, with lat/lng) for the map's road-status overlay.
- **migrations/018_others_review.sql** — `others_hazard_review` view that
  aggregates the free-text residents typed under "Others" so the LGU can
  spot new hazard categories worth promoting into the canonical list.
- **seed/002_relief_guides_faqs_roadwork.sql** — sample rows for every new
  table, each block guarded so the file is safe to re-run.
- **js/notifications-store.js** — small IndexedDB ring buffer (200 most
  recent notifications) so a citizen who closes the app and reopens it
  still sees the alerts that came in between. Best-effort, never blocks.
- **js/relief.js**, **js/guides.js**, **js/faqs.js**, **js/roadwork.js**,
  **js/sos.js**, **js/urgent-alerts.js** — one module per new feature,
  containing the render functions (mobile + desktop + LGU admin) and the
  seed defaults so the UI renders even without a Supabase project configured.
- **css/screens-additions.css** — new selectors only (relief bullet lists,
  SOS floating button + confirmation circle, urgent overlay, FAQ accordion,
  map layer toggle, road-status markers, status history timeline, report
  tracker, urgent card on home, numeric bell badge).

## Modified files (minimal patches)
- **index.html** — load the new CSS + 7 new JS modules.
- **js/app.js** — new state slices, new hash routes, ~25 new `data-act`
  handlers (relief, guides, faqs, roadwork, sos, map-layer-toggle,
  urgent-dismiss, urgent-view, report-pin-drop, report-status-filter),
  auto-GPS trigger when entering the report screen, urgent-alert scan after
  `bootstrapData`, `ug:urgent-view` event listener so the overlay (which
  lives on `<body>`, outside `#ug-root`) can ask the app to navigate.
- **js/repo.js** — `loadAll` now fetches 6 additional tables; new shape
  adapters (`toRelief`, `toBeneficiary`, `toGuide`, `toFaq`, `toRoadWork`,
  `toRoadStatus`); 11 new CRUD methods; Realtime subscriptions for the 6
  new tables.
- **js/features.js** — added `reverseGeocode()` (Nominatim/OSM — the same
  provider the map already uses) and a small `vibrate()` helper.
- **js/map.js** — new `setRelief`, `setRoadStatus`, `setReportPin` layers
  plus the layer-toggle UI host; `mount()` accepts `relief`, `roadStatus`,
  `layers`, and a `reportPin` + `onPinDrop` callback.
- **js/screens.js** — 6 new icons (sos, relief, guide, faq, road2, volcano);
  bell badge now reads the **real unread count** from `UG.DATA.notifications`
  (fixed the old bug where the bell looked the same with or without new
  alerts); `mHome` restructured to urgent-first layout (banner pinned top,
  Report/SOS/Relief/My Reports quick-access row, secondary content demoted);
  `mReports` got status filter chips; `mReportDetail` got a glanceable
  tracker plus a timestamped history log; new mobile routes for relief,
  relief-verify, guides, faqs, roadwork, map, sos; SOS floating button on
  the mobile frame; LGU dashboard got 4 new module tiles; LGU sidebar
  gained Relief / Road Work / Guides / FAQs / SOS Log / Others Review /
  Map entries; notifications list rewritten with type-specific icons and
  tap-to-open behavior.
- **js/screens.web.js** — extended CNAV with Relief / Guides / FAQs;
  fixed the bell badge to read the real unread count; added an SOS button
  to the web top bar; `cwBody` handles all new routes via a `cwWrap` helper
  that reuses the mobile render functions inside the desktop shell.

## How each feature maps to the existing system

1. **Notifications** — bell badge reads `(UG.DATA.notifications || []).filter(n => n.unread).length`. `UG_NOTIF_STORE` (IndexedDB) persists the most recent 200 notifications so past alerts survive a reload. List shows type icons (hazard alert, relief update, report status, road work, SOS). Tapping a notification calls `Repo.markRead` + `UG_NOTIF_STORE.markReadLocal` and routes to the relevant screen via `advisory_id` / `report_id` / `road_work_id` / `sos_id`. Mark-all-read writes both server-side and to the local store.

2. **Relief Assistance Information** — `relief_distributions` + `authorized_beneficiaries` tables. Citizen view (mobile + desktop) filters by barangay, shows distribution location + map pin (Waze button), date/time, contact person, eligibility list, required documents list, and a "Verify Beneficiary" button that opens a searchable authorized-beneficiary list for that barangay. LGU gets a CRUD surface for both tables.

3. **Homepage Redesign** — `mHome` now leads with the most-recent active advisory as an `ug-urgent-card` (red strip + pulsing icon for emergency, neutral for warning). Below it: Report Hazard / SOS quick-access row, then Relief Info / My Reports, then the secondary readouts (in your barangay / active advisories / shelters open) and the latest-report card. FAQs and Guides are reachable from the bottom card but moved off the home surface to reduce clutter.

4. **Pin / Location Accuracy** — `gps` action now also calls `UG_FEATURES.reverseGeocode()` (Nominatim) and stores the result in `S.report.address`; the report form shows it under the coordinates. Accuracy radius is rendered as a small colored bar. A draggable Leaflet pin (`data-map="report-pin"`) lets the citizen correct the GPS reading when it landed on the wrong spot (e.g. indoors); the `report-pin-drop` action writes the new lat/lng back to state and re-geocodes. GPS auto-triggers the first time the report screen is opened.

5. **Others Hazard Type** — already implemented in the prior revision (selection reveals a required text field, validated before submission). This pass adds the LGU "Others Review" view (`migrations/018_others_review.sql`) that aggregates `hazard_other_text` across all reports so the LGU can spot new categories worth promoting into `js/hazard-types.js`.

6. **Recovery / Preparedness Guides** — `preparedness_guides` table (hazard_type, phase, title, body). Citizen UI shows a hazard chip row + Before/During/After chips. LGU gets a CRUD surface. Adding content does not require an app release.

7. **Report Tracking** — the existing pipeline (reported → verified → dispatched → resolved, plus rejected) is kept intact so the analytics views keep working. The citizen UI now shows a compact glanceable tracker (Processing → Verified → Deployed → Resolved, with timestamps) alongside the existing `U.pipeline()` widget, plus a timestamped history log. `migrations/015` redefines `advance_report_status()` so **every status change inserts a notification addressed to the reporter** (tone varies: dispatched → warning, resolved → prepared, rejected → warning). Citizens get a status-filter view of all their reports.

8. **Hazard Map + Passable Routes** — `map.js` gained `setRelief` and `setRoadStatus` layers alongside the existing `setIncidents` and `setCenters`. A floating layer-toggle control (`ug-layer-toggle`) lets citizens / LGU turn each of the four overlays (hazards / relief / shelters / road status) on or off. Road-status markers are color-coded: green dot (passable), amber `!` (caution), red `X` (blocked). A dedicated Hazard Map route (`#map`) gives the map the full screen. Full routing is intentionally out of scope — the brief explicitly says "at minimum show road-closed markers so users can route around manually."

9. **One-Tap SOS** — a floating `ug-sos-fab` button on the citizen mobile shell (and a dedicated SOS tab on the desktop shell). One tap calls the `submit_sos()` RPC, which writes a `sos_log` row (with the caller's profile snapshot, GPS, accuracy, timestamp), fans out an emergency notification to every LGU/LDRRMO account, and writes an audit row. The citizen sees a confirmation screen with the SOS id, the position captured, and the number of duty officers reached. Vibration pattern fires on confirmation. A backup "Call Lingayen MDRRMO" button on the SOS screen uses `tel:` so it works even when the data signal is too weak for the SOS to send. Rate-limited to 5 calls per 10 minutes.

10. **Prominent Urgent Alerts** — `js/urgent-alerts.js` scans advisories after every `loadAll` and fires a full-screen overlay for the newest emergency advisory that hasn't been acknowledged on this device. Sound (Web Audio, two short beeps) and vibration fire **only for emergency severity**, so citizens don't get alert fatigue from routine advisories. The overlay is dismissible (Acknowledge / View advisory). Acknowledgment writes a row to `alert_acknowledgments` (best-effort) and stores the id in `localStorage` so a refresh doesn't re-fire the same one.

11. **LGU / LDRRMO Module** — the dead-button fixes from the prior revision are verified intact. The sidebar gained Relief, Road Work, Guides, FAQs, SOS Log, Others Review and Map entries. Road work notifications: LGU staff compose a post (title, description, barangay, road, lat/lng, expected duration) and the `createRoadWork` repo method calls `fanout_road_work()` to push a notification to every resident of the affected barangay (or municipality-wide if the post is citywide). The dashboard got 4 quick-access tiles for the new modules. FAQ management is full CRUD via the LGU console.

## Migrations to run (in order)
`011_relief_assistance.sql`, `012_road_works.sql`, `013_faqs.sql`,
`014_preparedness_guides.sql`, `015_urgent_alert_acks.sql`,
`016_sos_log.sql`, `017_road_status.sql`, `018_others_review.sql`.
Then, in development only, `seed/002_relief_guides_faqs_roadwork.sql`.

## Verified
- `node --check` passes on every JS file.
- Headless-browser smoke test: every citizen mobile route, every LGU console
  route, the urgent overlay (fire + dismiss + view), the notification badge
  count, and the SOS confirmation screen all boot with zero console / page
  errors.

---

# UniGuard revision 3 — LGU field-test fixes (FULL-PERO-BAT feedback)

Addresses every point raised in the field-test feedback document. JS syntax-
checked with `node --check` on every edited file; migration 035 is additive +
idempotent.

## Fixes
1. **Dispatch shows on the dashboard** — `loadDispatchesForDashboard()` now
   preloads the dispatch records (team + ETA) for every dispatched incident
   when the duty officer enters the Operations Dashboard, the Incident Queue
   or the Command View. The dashboard's Recent Incidents also renders a
   compact "team dispatched" line, so a dispatched incident finally shows who
   was sent, not just the status word.
2. **Dashboard dispatch button clickable** — Recent Incidents rows on the
   Operations Dashboard and the Command View are no longer single `<button>`
   rows that swallowed the inline action. They are clickable rows (div +
   role=button) with a real **Verify / Dispatch / Resolve** button inside,
   so the duty officer can advance a report straight from the dashboard.
   The Command View's "Dispatch" chip is now a real button (was
   `pointer-events:none` decoration).
3. **"Barangay Tanod" → "Barangay Response Team"** + per-barangay
   notification — the responder label is retired in the dispatch form
   (`DISPATCH_TEAMS`) and in the database (migration 035 swaps the
   `report_dispatches.team` CHECK and back-fills existing rows). Migration 035
   also adds `fanout_dispatch()` and redefines `dispatch_report()` so that
   every dispatch pushes an in-app notification to the residents, officials
   and LGU of the report's barangay — the barangay is now alerted a response
   team has been pushed to them. The duty officer gets a confirmation toast.
4. **Search bar works** — the topbar global search (`data-field="search"`)
   now filters the Incident Queue and the dashboard's Recent Incidents live
   by id, hazard, description, barangay and area. The box keeps its value
   across re-renders, gains a clear (×) button, and an empty-state message
   tells the officer the search returned nothing.
5. **Map scoped to Lingayen + neighbours** — the live Leaflet map now sets
   `maxBounds` / `maxBoundsViscosity=1` / `minZoom=12` from a new
   `UG_GEO.MAP_BOUNDS` that covers Lingayen plus Labrador, Binmaley and
   Bugallon, so the operational map can no longer be zoomed/panned out to a
   country-wide view.
6. **"Full" snaps occupancy to capacity** — marking an evacuation centre
   "Full" now sets `occupancy = capacity` immediately, so the directory reads
   e.g. **1000 / 1000** instead of **0 / 1000** the moment the status flips.
   The dashboard, the citizen shelter list and the detail modal all read the
   same record so they update together.
7. **Download button** — the Relief Assistance screen gains two downloads:
   "Download Schedules" (all active distributions as CSV) and "Download CSV"
   (the authorized-beneficiary list, scoped to the same barangay filter +
   search the duty officer is viewing). Both are client-side, offline-safe,
   and produce a timestamped `.csv`.
8. **Force refresh no longer re-errors** — `forceRefresh()` now also wipes
   the IndexedDB snapshot, the offline report queue and the local
   notifications store (not just the service worker + HTTP caches). The
   previous version reloaded the same stale snapshot on reboot, which is why
   the error came back. A bad cached row can no longer resurface.

## Files changed
- `js/app.js` — search state + handler, clear-search, relief-download +
  downloadText helper, dispatch per-barangay notify, dashboard dispatch
  preload, full→capacity.
- `js/screens.js` — dTopbar search value/clear, dIncidents search filter,
  dDashboard restructured rows + quick action + dispatch line, dCommand
  clickable actionChip.
- `js/relief.js` — dRelief download buttons + visible-rows export.
- `js/map.js` — maxBounds / minZoom / maxBoundsViscosity.
- `js/geo.js` — MAP_BOUNDS / MAP_MIN_ZOOM / MAP_MAX_ZOOM.
- `js/pwa.js` — clearQueue / clearNotifications + hardened forceRefresh.
- `migrations/035_rename_tanod_to_response_team.sql` — team rename +
  fanout_dispatch + dispatch_report redefinition.

`node --check` passes on every edited JS file.

---

# UniGuard revision 4 — offline sync + dashboard/analytics "plain text" fix

Two follow-up issues from the same field test:

## A. Offline sync stuck even after Force Refresh / Back to Online
**Root cause:** the `retry-load` action called `Repo.loadAll()` directly. But
`loadAll()` silently caught every error (expired JWT, RLS denial, network blip),
set `source='offline'`, and overwrote the store with the sample seed data. The
banner never cleared because the same failure recurred every retry.
`Repo.online()` only checked whether the Supabase *client object* existed —
not whether the session was valid — so an expired session kept "looking"
online while every query 401'd.

**Fix:**
- `Repo.state` now tracks `hasSynced` (true once we've ever successfully loaded
  from Supabase) and `lastError` (the actual error message).
- `loadAll()` failure path no longer clobbers real data with the sample seed.
  On the very first boot (empty store, never synced) it still reseeds so the
  UI is not blank. After the first successful sync, a failed retry keeps the
  last-known real data and only flips the source flag to `offline`.
- New `Repo.forceReload()`: re-checks `navigator.onLine`, refreshes the auth
  session (`c.auth.refreshSession()`), flushes the offline queue, then calls
  `loadAll()`, and returns the actual outcome (`{ok, reason, error}`).
- `retry-load` action now calls `forceReload()` and surfaces a toast with the
  real result — including auto-sign-out when the session is genuinely expired.
- `sync-now` action now flushes the queue **and** reloads the data (old
  version only flushed, so the dashboard kept showing stale rows after upload).
- `UG_PWA.retryNow()` (the citizen "Back online" control) delegates to
  `Repo.forceReload()` so the same recovery path runs everywhere.
- The connectivity banner now shows the actual error message + last sync
  time, so the user can tell *why* it's stuck instead of just seeing
  "Offline."

## B. Dashboard / Analytics look like "plain text"
**Root cause:** when `loadAll()` failed, `reseedLocal()` re-stamped the
hardcoded sample incidents (UG-2026-0142 etc.) and the dashboard rendered
those demo rows. There was no indicator telling the duty officer they were
looking at sample data vs. live data — so it read like static "plain text".

**Fix:**
- New `syncStatusBanner(st)` helper renders a visible strip at the top of the
  Operations Dashboard and the Analytics page. Three states:
    · **Live** (green) — synced with the server, shows last sync time.
    · **Offline** (amber) — last-known real data is shown, with the actual
      error and a Refresh button.
    · **Demo** (warning) — never synced, these are sample records, with a
      Refresh button to pull live data.
- New `refresh-data` action + Refresh button on the banner calls
  `Repo.forceReload()` so the duty officer can re-sync without a full
  force-refresh.
- Because `loadAll()` no longer overwrites real data with the seed on
  failure, the dashboard now keeps showing the last-known live records
  during a transient outage instead of snapping back to demo text.

## Files changed
- `js/repo.js` — `state.hasSynced` / `state.lastError`, loadAll failure no
  longer reseeds over real data, new `forceReload()`.
- `js/pwa.js` — `retryNow()` delegates to `Repo.forceReload()`.
- `js/app.js` — `retry-load` / `sync-now` / new `refresh-data` action use
  `forceReload()`, connectivity banner shows error + last sync.
- `js/screens.js` — `syncStatusBanner()` on dashboard + analytics.

`node --check` passes on every edited JS file.

---

# UniGuard revision 5 — Units Deployed fix, Guides PDF, search bar removed

Three follow-up changes.

## A. "Units Deployed" now counts dispatched teams
**Root cause:** `computeCounts()` only summed `i.units` from
`report_assignments`, but dispatching a team writes to `report_dispatches`
— a completely different table. So the KPI never moved when LGU dispatched
a response.

**Fix:** `computeCounts()` now adds `totalDispatchedTeams()` (the count of
every record across all arrays in `UG.DATA.dispatches`). `loadDispatches()`
now calls `computeCounts()` + `recomputeKpis()` after each load, so the
dashboard's Units Deployed card updates the instant a dispatch lands —
same as the incident tracker. The offline dispatch path also recomputes.
The KPI card's sub-label now reads "N dispatched teams + assigned
responders" so the breakdown is visible.

## B. Download Preparedness Guides as PDF (citizen-facing)
The citizen Preparedness Guides screen now has two buttons:
- **"Download [Hazard] PDF"** — exports the currently selected hazard's
  Before / During / After guides.
- **"All Guides PDF"** — exports every guide in the system.
Uses the existing `UG_PDF.exportDoc()` engine, so each document carries the
UniGuard header, generated-by, scope (Lingayen, Pangasinan) and page
numbers. Works offline (jsPDF is vendored + precached by the service worker).

## C. Removed the topbar search bar
Per request, the global search bar in the LGU console topbar has been
removed entirely (input, state, clear button, handler, and the incident
queue / dashboard filters that wired into it). The incident queue's own
status chips remain, so filtering by Reported / Verified / Dispatched /
Resolved / Rejected still works.

## Files changed
- `js/repo.js` — `computeCounts()` + `totalDispatchedTeams()` +
  `loadDispatches()` recompute + offline dispatch recompute.
- `js/screens.js` — search bar removed from `dTopbar`, search filter removed
  from `dIncidents` and `dDashboard`.
- `js/guides.js` — download buttons on `mGuides`.
- `js/app.js` — `search` state + `clear-search` action + input handler
  removed; new `guide-download` action added.

`node --check` passes on every edited JS file.

---

# UniGuard revision 6 — Escalation policy (stale, severity bypass, LGU verify)

Three operational gaps closed. All three are policy/workflow changes with no new
infrastructure — they're a view-time check + an RPC + a column.

## 1. Auto-escalation of stale reports
A report stuck in "reported" for **> 30 minutes** is now surfaced to the LGU's
main queue with a **"Stale: not yet verified by barangay"** badge. An absent
barangay official is no longer a single point of failure.

- Implemented in `reports_feed` VIEW (migration 036): a computed `is_stale`
  boolean = `status='reported' AND verified_at IS NULL AND created_at < now() - interval '30 minutes'`.
  No cron, no job, no new table.
- The LGU queue gets a new **"Escalated"** filter chip + a red banner at the
  top showing the count and the list of escalated reports.
- Escalated rows float to the top of every filter so they're never missed.
- Each escalated row shows either a **"Stale"** (amber) or **"Life-safety"**
  (red) badge next to the status.

## 2. Severity bypass for life-safety hazards
Life-safety hazards — **fire, power line, vehicular accident, landslide** —
skip the 30-minute wait and surface to the LGU immediately, even while still
unverified. A real fire must not depend on a barangay official being online.

- Implemented in the same view: `is_severity_bypass` = `status='reported' AND hazard_type IN ('fire','power_line','vehicular_accident','landslide')`.
- `escalates_to_lgu = is_stale OR is_severity_bypass` — the OR the LGU queue
  filters on.
- These reports get a red **"Life-safety"** badge and appear in the Escalated
  list the moment they're submitted.

## 3. LGU-verified second verification path
LGU/LDRRMC can now mark a report **"LGU-verified"** when a barangay is inactive.
Both levels (barangay official + LGU) can confirm reports, and the gaps stop
being blind spots. WHO did it is recorded.

- New `reports.verified_by` (uuid), `verified_by_name` (text),
  `verified_by_role` (text: 'barangay_official' | 'lgu_ldrrmc'), and
  `verified_at` columns (migration 036).
- New `lgu_verify_report(uuid, note)` RPC — LGU-only, moves reported→verified,
  stamps the verifier's identity, writes an audit row, and notifies the
  reporter ("Your report was LGU-verified").
- `advance_report_status` (the barangay verify path) also stamps the same
  columns now, so both paths record who verified and at what level.
- The incident detail screen shows a line: **"LGU-verified by [name] · [time]"**
  (signal blue) or **"Verified by [name] · [time]"** (prepared green) so the
  two levels are visually distinguishable.
- The LGU sees an **"LGU-Verify"** button on every reported incident — in the
  queue, on the detail screen, and in the escalation banner.

## Files changed
- `migrations/036_escalation_policy.sql` — new columns, `lgu_verify_report`
  RPC, redefined `advance_report_status`, rebuilt `reports_feed` with the
  escalation booleans.
- `js/repo.js` — `toIncident` surfaces `is_stale` / `is_severity_bypass` /
  `escalates_to_lgu` / `verified_by_*`. New `lguVerify()` wrapper. Exported.
- `js/screens.js` — `dIncidents` gets an "Escalated" chip + escalation banner
  + badges + LGU-Verify button (LGU only) + escalated-first sort. `dIncident`
  shows escalation badges + verified-by line + LGU-Verify button. `dDashboard`
  gets an escalation banner with quick LGU-Verify.
- `js/app.js` — new `lgu-verify` action (role-gated, optional note, calls
  `Repo.lguVerify`).

`node --check` passes on every edited JS file. Migration 036 is additive +
idempotent.

---

# UniGuard revision 7 — Push fixes, notification dedup, road work location, confirmations

Five follow-up issues from the field test.

## A. Duplicate "Mark All Read" button removed
The desktop Notifications screen had TWO "Mark All Read" buttons stacked — one
from the desktop page wrapper and one from the mobile `mNotifications` component
it reused. Removed the wrapper's button; the component's button (inside the
Inbox header, next to the unread count) is the only one now.

## B. Notification dedup
The push notification log showed duplicate SOS entries (the same SOS appearing
2–3× with identical timestamps). This happens when the RPC is retried or the
realtime channel fires twice. `mNotifications` now deduplicates by row id AND by
a title+body+created_at signature, keeping only the newest of each group.
Existing duplicates collapse on the next render.

## C. Advisory push now actually fires
**Root cause:** `Repo.createAdvisory()` fanned out the in-app notification
(via `fanout_advisory`) but never called the `push-dispatch` Edge Function —
only `declareEmergency` did. So a published advisory reached the in-app inbox
but never the phone lock screen. The "Push enabled" chip on the composer was
also misleading (it said "Push enabled" even when no VAPID key was configured).

**Fix:** `createAdvisory()` now invokes `push-dispatch` after the in-app fan-out,
same pattern as `declareEmergency`. Best-effort: if the Edge Function fails the
advisory is still published + in-app-notified. The composer chip now reads
"Push enabled" only when `UG_CONFIG.VAPID_PUBLIC_KEY` is set, otherwise
"In-app only" — so the LGU can tell at a glance whether push is configured.

## D. Road work "Type" button accepts barangay + street
The old `rw-manual-pin` opened a single-line prompt that only accepted
"Latitude, longitude" — useless if you don't have coordinates. Replaced with a
proper modal with three fields:
- **Barangay** (text + datalist autocomplete from the 32 barangays)
- **Street / road name** (free text, e.g. "Aguila Rd, near the Capitol")
- **Coordinates** (optional — lat/lng)

If coordinates are given AND pass the Lingayen bounds check, the pin is set
(Waze navigation works). If only barangay + street are given, the address text
is stored and shown in the notification + on the map pin row; Waze stays hidden
until coords are added. The pin display now reads e.g.
"16.03351, 120.23152 · Aguila Rd, Poblacion, Lingayen, Pangasinan".

## E. Severity bypass + per-barangay dispatch notification — confirmed working
Both were implemented in earlier revisions; confirming they're live:

- **Severity bypass** (revision 6, migration 036): life-safety hazards (fire,
  power line, vehicular accident, landslide) in `reported` status get
  `is_severity_bypass = true` in the `reports_feed` view and surface to the LGU
  queue immediately with a red "Life-safety" badge — no 30-minute wait. Works
  the moment migration 036 is applied.

- **Per-barangay dispatch notification** (revision 3, migration 035): when LGU
  dispatches a response team, `dispatch_report()` calls `fanout_dispatch()` which
  inserts an in-app notification row for every resident + official + LGU whose
  `barangay_id` matches the report's barangay. The notification reads
  "Response team dispatched to [barangay]" with the team name + instructions.
  The barangay is alerted a team has been pushed to them. The duty officer also
  gets a confirmation toast.

## Files changed
- `js/screens.js` — removed duplicate Mark All Read; notification dedup in
  `mNotifications`; honest push chip on advisory composer.
- `js/repo.js` — `createAdvisory()` now invokes `push-dispatch`.
- `js/app.js` — `rw-manual-pin` replaced with a 3-field modal.
- `js/roadwork.js` — pin display shows address text + help text updated.

`node --check` passes on every edited JS file.

---

# UniGuard revision 8 — Shelter filtering + My Barangay scope fix

Two bugs from the field-test screenshots:

## A. LGU Evacuation Centers — status chips were display-only
The "4 open / 0 full / 1 closed" chips in the upper right of `dCenters` had no
`data-act` attribute, so clicking them did nothing. The list always rendered
every shelter regardless of which chip was highlighted.

**Fix:** the status chips are now real clickable filter buttons wired to
`center-filter`. A new dedicated filter row underneath shows All / Open / Full /
Closed with live counts, and an empty-state message appears when a filter
matches nothing. The page-head chips now toggle the same filter (single source
of truth) so the two never disagree.

## B. LGU Evacuation Centers — no "My Barangay" scope
An LGU official saw every shelter municipality-wide with no way to narrow to
their own barangay, even though their session carries a barangay assignment.

**Fix:** `dCenters` now renders an "All Shelters / My Barangay (name)" toggle
(mirrors the citizen desktop screen) when the signed-in user is a barangay
official. LGU/LDRRMC sees "All Shelters · Municipality-wide" (they have no
barangay to narrow to). Tapping "My Barangay" filters the list + recomputes the
status counts so the chips reflect only the scoped set.

## C. Citizen mobile Shelters — missing the All / My Barangay toggle
The citizen **desktop** screen (`cwCenters` in `screens.web.js`) had the toggle,
but the citizen **mobile** screen (`mCenters` in `screens.js`) did not — so a
resident on a phone saw all shelters with no way to narrow to their barangay.

**Fix:** `mCenters` now renders the same "All Shelters / My Barangay (name)"
toggle as the desktop version. When "My Barangay" is active, only shelters whose
`brgy` matches the signed-in citizen's barangay are shown, and the status chips'
counts update to match the scoped set. A citizen without a barangay set sees
"All Shelters · Municipality-wide" (no toggle). The status-filter chips'
counts now reflect the scoped set, not the full municipality.

## Files changed
- `js/screens.js` — `dCenters` (LGU) + `mCenters` (citizen mobile) reworked.

`node --check` passes on `js/screens.js`.

---

# UniGuard revision 9 — Push subscribe bug fix + Assign Units removed

Two issues from the field-test screenshots.

## A. "Push enabled" still doesn't work — root cause found
The advisory composer showed "Push enabled" but publishing still didn't push
to any device, and the reach indicator read "no push devices registered yet".

**Root cause:** `UG_PWA.enablePush()` subscribed the browser to Web Push
correctly, then upserted the subscription into `push_subscriptions` — but it
**never set `user_id`**. That table has `user_id uuid not null` (migration 003)
PLUS an RLS policy `push_write` requiring `user_id = auth.uid()` (migration
004). So every insert was silently rejected by RLS, the table stayed empty,
and `push-dispatch` had nobody to send to. The error was swallowed because
the old code did `await c.from(...).upsert(...)` without checking the result.

**Fix:**
- `enablePush()` now fetches `c.auth.getUser()` to get the signed-in user id,
  sets `user_id` on the upsert, and **surfaces the real error** if the insert
  fails (instead of silently swallowing it). A misconfigured table or RLS
  denial now produces a visible toast.
- Added an **"Enable push on this device"** button to two screens where a
  user is most likely to look for it:
  1. The advisory composer — replaces the "no push devices registered yet"
     text with a button when `subscribedDevices === 0`.
  2. The notifications (Inbox) screen — so citizens can subscribe too.
- The `enable-push` action now refreshes `UG.DATA.subscribedDevices` right
  after a successful subscription, so the composer's reach indicator flips
  from "no devices" to "1 device" immediately.

## B. "Assign Units" button removed from incident detail
The incident detail screen had both an "Assign Units" button AND a "Dispatch
Response" button — the Assign Units one was redundant clutter since Dispatch
Response (and "Add Team" once dispatched) already covers assigning a response
unit. Removed it.

## Files changed
- `js/pwa.js` — `enablePush()` now sets `user_id` + surfaces errors.
- `js/app.js` — `enable-push` action refreshes the subscribed-devices count.
- `js/screens.js` — "Enable push" button added to composer + notifications;
  "Assign Units" button removed from incident detail.

`node --check` passes on every edited JS file.

## What you still need to do
1. Redeploy the web app with these changes.
2. After redeploy, sign in on a device → open Notifications or the advisory
   composer → tap "Enable push on this device" → grant permission.
3. The reach indicator should now read "1 subscribed device".
4. Publish an advisory → the device should receive a real push.
