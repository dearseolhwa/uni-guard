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
