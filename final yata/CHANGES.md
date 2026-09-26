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
