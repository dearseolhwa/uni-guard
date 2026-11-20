# UniGuard · Hazard Map alignment, marker positioning and responsive layout fix: result

All objectives from the hazard-map master prompt are **done**. Service worker `uniguard-v25`.

---

## 1. Root cause of the map misalignment

There were three stacked causes; the code inspected clean, the **data** did not.

**(a) Wrong source coordinates (the "detached" markers).** Every marker was traced from its
record to its displayed position with Leaflet's own projection (`latLngToContainerPoint` vs the
rendered DOM rect): the rendering pipeline was pixel-exact (≤ 1 px) — the pipeline was never the
problem. The problem was that many stored coordinates do not sit in the barangay their record
claims, measured against the **official PSA barangay boundaries the app already ships**
(migration `053_barangay_boundaries.sql`, PSGC 3Q 2026, source
faeldon/philippines-json-maps, Lingayen PSGC 105522000). Lingayen's real municipal extent ends at
latitude **16.0490**; the sample data placed four records at latitudes 16.0513–16.0562 —
**in Lingayen Gulf, visibly in the sea**. Others sat 4–9 km from their claimed barangay
(a "Malawa" landslide plotted inside Quibaol, "Domalandan West" points inside Capandanan,
"Estanza" farmland inside Dulag, and so on). A point-in-polygon audit of all 28 default/seed
records found **19 invalid**. The same wrong coordinates had also been loaded into the live
Supabase project by the v2.0 production seed (7 of 14 evacuation centers + 6 of 9 road-status rows).

**(b) No overlap handling (the "clustered/overlapping" markers).** Poblacion genuinely hosts
3 evacuation centers, 2 relief distributions, a fire incident and 3 road-status points within
~500 m, and several records shared **byte-identical coordinates** (a relief distribution reusing
the evacuation center's coordinates; a road-blocked marker exactly on a flood incident; a road
pinned to the exact town-centre default). Nothing separated them, so they stacked irretrievably.

**(c) Fixed initial view (the "unbalanced" presentation).** Every map opened at the town-centre
default (zoom 13), which crowded the Poblacion cluster while pushing the genuinely spread-out
records (Sabangan, Malawa, Dulag) off-screen. Marker counts were also affected by remounts: the
live map was destroyed and recreated (tiles reloaded, view reset) whenever the incident count
changed, instead of refreshing the marker layer in place.

## 2. Files changed

| File | Change |
| --- | --- |
| `js/map.js` | Rewritten marker pipeline: coordinate gate via `UG_GEO.classify()`; in-house cross-category clustering (pixel-proximity union-find, ~30 px) + spiderfy with leader lines (no new dependencies, no CDN); one-time fit-to-records on the dedicated map screens (capped at a readable overview zoom); cluster recompute on `zoomend`/`moveend`; `ResizeObserver` → `invalidateSize()` (drawer pin/unpin, rotation); visible zoom control; skipped-record warn strip; empty-state pill; spider survives popup auto-pan and panning, closes on zoom/resize/background click; new read-only `MapView.getMap()` and `MapView.owns(el)` helpers; `title` hover labels on every marker; popups/anchors unchanged and verified. |
| `js/app.js` | `mountMaps()` mounts the live map **once** and refreshes overlays in place (`setIncidents/setCenters/setRelief/setRoadStatus/setLayers`) — no more remount/view-reset when data changes; passes `fit` to dedicated map screens; detail map keeps its relief + road-status overlays (behaviour preserved). |
| `js/screens.js` | Sample incident + evacuation-centre coordinates corrected (polygon-verified); `mapLayerChips()` factored out and **added to the console desktop map screen** (it previously had no layer filters at all — only the mobile screen did); map heights now responsive (`clamp(300px,55vh,430px)` mobile, `clamp(340px,56vh,620px)` console, `clamp(320px,52vh,480px)` command view). |
| `js/roadwork.js` | Sample road-work + road-status coordinates corrected (Coastal Rd out of the Gulf, Domalandan Access into Domalandan West). |
| `js/relief.js` | Sample distribution coordinate corrected (Pangapisan North Multi-Purpose Center). |
| `css/screens.css` | Cluster bubble styling (navy disc, count, per-category colour chips, focus ring), spider anchor ring, `pointer-events:none` warn/empty strips, dark zoom control raised above the scale chip. |
| `sw.js` | `VERSION` bumped `uniguard-v24` → `uniguard-v25` (deploy convention). |
| `uniguard_map_coord_fix.sql` (delivered alongside, in `download/`) | Live-database patch: guarded, idempotent UPDATEs fixing 9 evacuation-centre rows and 6 road-status rows (3 of them also relabelled to the barangay that actually contains their point, with `barangay_id` re-resolved), plus a verification SELECT that runs each fixed point through the server's own `resolve_barangay()`. |

Untouched, per the operating constraints: `users`/`profiles`, dispatch units and dispatch
tables, equipment, `public.barangays`, hazard types, reports/advisories/SOS data, guides, FAQs.

## 3. Invalid, duplicated or suspicious coordinate records found

**Sample data (js defaults) — fixed in this pass:**

| Record | Was | Problem | Now (polygon-verified) |
| --- | --- | --- | --- |
| Flood UG-2026-0142, Pangapisan North | 16.0552, 120.2238 | In the Gulf | 16.0385, 120.2090 |
| Landslide UG-2026-0141, Malawa | 16.0038, 120.2361 | Inside Quibaol | 15.9558, 120.2713 |
| Storm surge UG-2026-0140 | 16.0513, 120.2452 | In the Gulf; "Wawa" is an inland barangay | 16.0290, 120.1560 (Sabangan shore, brgy relabelled) |
| Fallen tree UG-2026-0139, Domalandan West | 16.0421, 120.2059 | Inside Capandanan | 16.0090, 120.1840 |
| River overflow UG-2026-0137, Estanza | 15.9878, 120.2497 | Inside Dulag/Tumbar | 16.0230, 120.1715 |
| Evac EC-01 Pangapisan North MPC | 16.0555, 120.2245 | In the Gulf | 16.0330, 120.2080 |
| Evac EC-04 Domalandan West hall | 16.0418, 120.2065 | Inside Capandanan | 16.0083, 120.1823 |
| Road RS-02 Coastal Rd blocked | 16.0552, 120.2238 | In the Gulf | 16.0390, 120.2080 |
| Road RS-04 Domalandan Access | 16.0418, 120.2065 | Inside Capandanan | 16.0075, 120.1855 |
| Relief RD-02, Pangapisan North MPC | 16.0555, 120.2245 | In the Gulf | 16.0330, 120.2080 (distribution genuinely at the evac centre — exact coincidence is real and now spiderfies) |

**Live database (production seed rows) — fixed by `uniguard_map_coord_fix.sql`:**
9 evacuation centers (Pangapisan Elem Auditorium and Basing Elem were offshore; Sabangan MPH,
Estanza Elem, Wawa Hall, Domalandan West Hall, Dulag MPH, Pangapisan Sur Court, Maniboc Court
were kilometres outside their barangay) and 6 road-status rows (3 moved onto their real
alignment, 3 relabelled to the containing barangay). The script's final SELECT re-checks every
point through `resolve_barangay()` and must list `resolved = claimed` for all 15.

Verified-correct and left as they were: Narciso Ramos Sports & Civic Center, Lingayen Central
Elementary School, Pangasinan National High School, Aguila Road (capitol front), Quezon Avenue,
Maramba Boulevard, the three geo.js landmarks, and the town-centre coordinates themselves.

## 4. Layout, centering, zoom and resizing corrections

- Container: unchanged structure (`.ug-map` card with `overflow:hidden`); heights are now
  viewport-relative clamps on all three map screens, so the map neither floats half-empty on
  tall screens nor crowds the tab bar on phones. Border radius and card borders untouched.
- Resize: a `ResizeObserver` on the container calls `invalidateSize()` — the console drawer
  pin/unpin at ≥1280 px and device rotation now re-align the canvas instantly (previously two
  fixed setTimeout calls at mount only; drawer toggling left stale tile geometry).
- Centering/zoom: dedicated map screens fit once to the valid visible records (padding 40 px,
  capped at zoom 14 so a municipality-wide dataset opens as a readable overview rather than
  never zooming); dashboard mini-maps keep the plain town-centre overview. The fit runs once
  per mount; **no recentering on layer toggle, marker selection, or data refresh** — verified:
  zoom/centre were identical before, during and after the full filter matrix and a data refresh.
- Controls: visible zoom buttons added bottom-left (only scroll/pinch existed before), styled
  to match the locate button, raised above the scale chip; locate control unchanged
  bottom-right; all controls remain inside the visible map area at every tested viewport.

## 5. Overlapping-marker solution

An in-house cross-category cluster + spiderfy layer (no new dependencies, consistent with the
project's vendored-only rule):

- Markers within ~30 px at the current zoom (and any pair sharing one exact coordinate, always)
  group into a navy bubble showing the count plus one colour chip per category present, with an
  accessible label ("4 map points here: hazard reports, evacuation centers, relief
  distributions, road status points · Pangapisan North").
- Clicking a bubble whose members can be pulled apart zooms to their bounds (capped so it can
  never over-zoom); clicking a bubble whose members share one true coordinate spiderfies
  immediately — zooming could never separate exact duplicates.
- Spiderfy never moves a record: members are drawn on dashed leader lines around a small ring
  at the real position and each popup keeps the real coordinates (the same display-offset
  approach Leaflet.markercluster uses). The bubble hides while its members are out; any zoom,
  container resize or click on the empty map puts everything back. Panning (including a popup's
  auto-pan) keeps the spider open, which is safe because it lives in map space.
- Clusters recompute on `zoomend`/`moveend`, so zooming in always separates groups at the first
  opportunity; filtering re-clusters in place without duplicating markers (verified by the
  full toggle matrix returning to the identical initial layout).

## 6. Filter confirmation

The four filters (Hazards / Relief / Shelters / Road status) work on every map screen. The
console desktop map previously had **no** filter UI at all — the shared chip row is now there
too. Toggle matrix actually run (LGU console, desktop): all-on → relief off → relief+shelters
off → all off → all on. Marker/cluster counts matched the expected subset at every step
(17 → 15 → 10 → empty state → 17 identical to the start), no duplicates, view never recentered.
The empty state renders as a centred pill ("No mappable records for the selected layers.").

## 7. Tests performed and actual results

- **Coordinate audit:** all 28 sample/seed records point-in-polygon tested against the
  migration 053 rings (scripts kept in the workspace); 19 found invalid; replacements verified
  in-ring before being written.
- **Rendering exactness:** for every marker, `latLngToContainerPoint(record)` vs the DOM rect
  of the rendered icon agreed within 1 px at zoom 12 — rendering is faithful to the data.
- **Cluster behaviour:** exact-duplicate pair (EVAC+REL) clusters into "2"; click zooms mixed
  clusters apart; same-coordinate cluster spiderfies with leader lines; popup opens on a
  spider member and shows the real record; spider stays open through the popup auto-pan and
  closes on zoom/background click with the bubble restored.
- **Invalid-coordinate gate:** injected one record with no coordinates, one (0,0), one
  lat/lng-swapped — all three skipped and the strip reported "3 records not shown: 1 without
  coordinates, 1 with invalid coordinates, 1 with swapped lat/lng."
- **Filters:** full matrix above; counts, duplicates, view stability all pass.
- **Viewports:** 1280×800 (console + citizen web shell), 1440×900, 768×1024, 390×844
  (console collapsed shell + citizen phone shell with tab bar and SOS button): no overflow,
  no clipping, chips wrap, controls reachable, map fills the card at every size.
- **Resize:** viewport changes at fixed zoom keep markers aligned (ResizeObserver path).
- **Current location:** with permission denied, the control fails honestly with the toast
  "Location permission was denied. Enter the coordinates manually." (the success path uses the
  same locate helper that was already in place and was not changed).
- **Incident detail map:** still renders the single incident + relief + road-status overlays at
  zoom 15 inside the 142 px card; verify pin and report form maps untouched.
- **Console/network:** zero page errors across every screen exercised; tiles load from the
  Esri endpoint (SW stale-while-revalidate cache honoured); every edited `.js` passes
  `node --check`.

## 8. Remaining issues / not verified at runtime

- **Live-database patch not executed here.** `uniguard_map_coord_fix.sql` must be run in the
  Supabase SQL editor (Run without RLS) against the real project; its final SELECT is the
  proof. It only UPDATEs lat/lng/barangay on `evacuation_centers` and `road_status`.
- **Reports (hazards) coordinates are citizen-supplied.** The gate now skips missing/swapped/
  (0,0) and out-of-area report coordinates and says how many were dropped; the LGU should
  correct any reported records at the source. Reports whose pin fell on the town-centre
  default (no GPS) remain centred by design of the report form, not by a map defect.
- **"1 : 25 000" scale chip is still the static label it always was** (cosmetic, unchanged).
- The citizen's own photo/report flow, GPS acquisition on devices, and push/SMS were out of
  scope and unchanged.
