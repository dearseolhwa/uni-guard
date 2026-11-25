# UniGuard export audit and enhancement (28 Oct 2026)

This records what was found, what changed, how it was tested and what is still untested. Test results are stated exactly as observed; nothing here was verified against a live Supabase project.

## 1. Export inventory (before the change)

| # | Role(s) | Screen | Action (`data-act`) | Format | Data source | Original implementation | Defects found |
|---|---|---|---|---|---|---|---|
| 1 | Barangay Official, LDRRMO, Super Admin | Hotlines | `export-hotlines` | PDF | `UG.DATA.hotlines` (table `hotlines`) | `app.js` → `UG_PDF.exportDoc` | No type/notes columns, generic filename `uniguard-hotlines.pdf`, US date format |
| 2 | Barangay Official, LDRRMO, Super Admin | Analytics | `export-analytics` | PDF | `Repo.analytics()` RPCs (migration 024) | `app.js` | Re-queried the server instead of using the screen's figures, so it disagreed with the screen (no barangay filter); no date in filename |
| 3 | Same | Analytics | `analytics-export-csv` | CSV | Loaded incidents and centers | `app.js`, ad hoc | Said it applied the date range but did not; several tables mixed in one file; occupancy as text "118/250"; no BOM, LF only |
| 4 | Super Admin | Users and Roles | `admin-export-users` | PDF | `S.users` (`profiles`) | `app.js` | Ignored the search box; no Super Admin check in the action; no personal-data notice |
| 5 | Super Admin | Activity Log | `admin-export-audit` | PDF | `UG.DATA.audit` (`audit_log`) | `app.js` | "What changed" cut at 400 characters and again to 60 per value; no Super Admin check in the action |
| 6 | Barangay Official, LDRRMO | Relief › Distributions | `relief-download` (schedules) | CSV | `UG.DATA.relief` | `app.js` | Locale-formatted dates; no BOM; button labelled only "Export" |
| 7 | Barangay Official, LDRRMO | Relief › Distributions | `relief-download` (beneficiaries) | CSV | `UG.DATA.beneficiaries` | `app.js` | Filter logic duplicated from the screen; no BOM or formula guard |
| 8 | Barangay Official, LDRRMO | Relief › Inventory | `inv-download` | CSV | `UG.DATA.inventory` (browser only) | `app.js` | **Crashed** (`csvCell is not defined`); ignored category, search and barangay filters; data is not in the database |
| 9 | Barangay Official, LDRRMO | Relief › Records | `rec-download` | CSV | `UG.DATA.distributionLog` (browser only) | `app.js` | **Crashed** (same error); ignored the barangay filter and the official's scope |
| 10 | All signed-in roles | Preparedness Guides | `guide-download` | PDF | `UG.DATA.guides` | `app.js` | Desktop citizen page **hid the buttons** (`cwWrap` removed the header); only `body` exported, so v2 guides (summary + Before/During/After) were blank; bodies cut at 1,800 characters |
| 11 | Dispatch Team | Unit Analytics | `dispatch-csv` | CSV | `report_dispatches` for own unit (RLS) | `dispatch.js` | Raw database column names; raw UTC timestamps; filename `dispatch-stats.csv`; no BOM or formula guard |
| 12 | LDRRMO | Settings › Message templates | `tpl-export` | JSON | Templates in local storage | `settings.js` | Filename only (configuration backup, not a document) |
| 13–14 | Barangay Official, LDRRMO | Reports › Situation Report | `rp-sitrep-pdf`, `rp-sitrep-xlsx` | PDF, Excel | Console data + `damage_assessments`, `situation_reports` | `reporting.js` | Printed "Situation Report No. N" before N was issued; relative times ("10m ago"); "0/0/0" text cells; dates without a year; device-only data not labelled |
| 15–16 | Same | Reports › Incident Summary | `rp-inc-pdf`, `rp-inc-xlsx` | PDF, Excel | Incident, `report_status_history`, dispatches | `reporting.js` | Same date problems; "→" printed as garbage |
| 17–19 | Same | Reports › Damage and Needs | `rp-dna-pdf`, `rp-dna-xlsx`, `rp-dna-one-pdf` | PDF, Excel | `damage_assessments` (or this browser) | `reporting.js` | In device mode an official saw and exported **other barangays'** assessments; no frozen panes or filters; numbers as plain cells |

Not found anywhere: CSV/PDF exports for citizens' own reports, evacuation centers, road status and dispatch field reports as standalone files (centers, roads and dispatches are covered inside the Situation Report). `UG_FEATURES.printNode` exists but nothing calls it. No new export buttons were added.

## 2. Architecture

| File | Role |
|---|---|
| `js/export-core.js` (new) | `org()` from Settings → General with `UG_GEO.PLACE` fallback; `formatDate/formatDateTime/isoDate/isoDateTime/excelSerial` (always Philippine time, UTC+08:00); `buildFilename()`; `buildMetadata()` / `metaPairs()`; `formatCell()` for typed columns; `buildCsv()` / `saveCsv()`; `validateScope()`; `run()` (busy state, duplicate-click guard, toasts after success only). |
| `js/pdf.js` (rewritten) | `UG_PDF.formal(spec)`: letterhead, metadata block, notices, blocks (`table`, `keyvalue`, `kpis`, `bars`, `text`), blank signature lines, running header, footer with page X of Y. `exportDoc()` kept as a compatibility adapter. |
| `js/xlsx-lite.js` (extended) | Number formats, frozen panes, auto-filter, print titles, page setup, footer, document properties; `UG_XLSX.report(spec)` builds the Summary + dataset sheets. |
| `js/exports.js` (new) | Definitions for exports 1–11; `UG_EXPORTS.run(name)` is what `app.js` and `dispatch.js` call. |
| `js/reporting.js` (migrated) | Sections carry typed columns; exports use the shared PDF and workbook builders. |

Columns are typed (`text`, `longtext`, `id`, `status`, `int`, `num`, `money`, `pct`, `date`, `datetime`), so one dataset formats correctly in all three formats. Missing values are "—" in PDFs, empty cells in Excel and empty fields in CSV; zero is always printed as 0.

## 3. Standards applied

- **PDF:** A4; portrait for directories, summaries and single records; landscape for wide registers and logs. Header and footer are drawn after layout into reserved margins, so they never overlap content. Tables repeat their header, wrap text, right-align numbers, avoid splitting rows and show an empty-state row. The standard fonts print Filipino and Spanish letters as typed; symbols outside Windows-1252 are converted (→ to "->", ≥ to ">=", ₱ to "PHP"). Document properties are set: title, subject, author, keywords with the export ID, and creator.
- **Excel:** no merged cells. Header row at row 5 is frozen with an auto-filter on the data range only (totals sit after a blank row). Dates and times are real Excel dates. Text is never written as a formula.
- **CSV:** one header row and no title rows. A leading `= + - @`, tab or CR in text gets an apostrophe; numbers are never altered. Embedded line breaks are kept inside quoted fields.
- **Filenames:** `UniGuard_<Type>_<Scope>_<Date or from_to_to>.<ext>`. Accents are removed and unsafe characters replaced; length is capped at about 120 characters. No email, ID or token is used.
- **Branding:** no seal, logo, signature or approval is generated. The export ID is labelled "system-generated, not an official document number". The situation report number appears only after the report is saved to the register; until then the title says "(Draft)".
- **Notices:** a Data Privacy Act (RA 10173) notice on documents with personal data (accounts, activity log); a device-only notice where assessments or stock live in the browser; the analytics breakdown scope note.

## 4. Access control

Each export reads the same rows its screen shows. Those rows came through Supabase row level security; nothing uses a service-role key and RLS is not bypassed. `validateScope()` adds a client-side role check so an export cannot be started from a console call by a role that lacks the screen:

| Export | Allowed |
|---|---|
| Hotlines, guides | Any signed-in account (public information) |
| Analytics, relief (all four), reports (all) | Barangay Official, LDRRMO (incl. Super Admin) |
| Users, activity log | Super Admin only |
| Dispatch activity | Dispatch Team (own unit, via RLS on `report_dispatches`) |

A barangay official is pinned to their own barangay in every export. In device mode, damage assessments are now filtered to the official's barangay (previously unfiltered).

**Finding not changed (needs its own migration and review):** `profiles_read` (migration 004) lets any `is_lgu()` account read all profiles, not only the Super Admin. The account export is Super Admin-only in the client, but the data itself is readable by LDRRMO staff.

## 5. Coverage matrix and test results

Environment: the packaged app served locally with `DEV: true` and no Supabase URL, so it ran on its local sample data. Each case was run in Chromium (Playwright): open the role preview, click the real button (or call the action from the console for the denial cases), capture the download. Sample users, activity entries, guides and dispatches were injected as safe test data where the offline sample had none.

Files were then inspected with `pdfinfo` and `pdftotext`, rendered page images, `openpyxl`, LibreOffice headless (xlsx → PDF), and Python's `csv` module for column counts, BOM, CRLF and Unicode.

| Role | Module | Export | Format | Standard | Permission check | Generated | File inspected | Result |
|---|---|---|---|---|---|---|---|---|
| Super Admin | Hotlines | Emergency Hotline Directory | PDF | Formal PDF | Signed in | Yes | Text, page count | Pass |
| Super Admin | Analytics | Analytics and Performance Report | PDF | Formal PDF + KPIs + bars | LGU / official | Yes | Rendered p.1, text | Pass |
| Super Admin | Analytics | Same, barangay filter "Wawa" | PDF | Same | Same | Yes | Filename, count = 1 | Pass |
| Super Admin | Analytics | Analytics Data | CSV | Tidy CSV | LGU / official | Yes | Parsed: 55 rows × 5 columns | Pass |
| Super Admin | Users | User Account Register (with search) | PDF | Formal PDF, RA 10173 notice | Super Admin | Yes | Rendered; formula-like name printed as text | Pass |
| Super Admin | Activity Log | System Activity Log Report (barangay filter) | PDF | Formal PDF, landscape | Super Admin | Yes | Rendered; 60 of 120 rows match filter; full descriptions | Pass |
| Super Admin | Relief | Distribution schedule | CSV | Safe CSV | LGU / official | Yes | Parsed | Pass |
| Super Admin | Relief | Beneficiaries | CSV | Safe CSV | LGU / official | Yes | Parsed | Pass |
| Super Admin | Relief | Inventory (category "Food") | CSV | Safe CSV | LGU / official | Yes (crashed before) | Parsed: 3 rows = filter | Pass |
| Super Admin | Relief | Distribution log | CSV | Safe CSV | LGU / official | Yes (crashed before) | Parsed | Pass |
| Super Admin | Reports | Situation Report (draft) | PDF | Formal PDF + KPIs + signature lines | LGU / official | Yes | Rendered p.1, 6 pages | Pass |
| Super Admin | Reports | Situation Report, empty period (2020) | PDF | Same | Same | Yes | 6 pages; undated sample incidents included as documented | Pass |
| Super Admin | Reports | Situation Report | Excel | Report workbook | Same | Yes | openpyxl + LibreOffice | Pass |
| Super Admin | Reports | Incident Summary | PDF / Excel | Formal PDF / workbook | Same + in scope | Yes | openpyxl + LibreOffice; PDF text | Pass |
| Super Admin | Reports | Damage and Needs register | PDF / Excel | Formal PDF / workbook | Same | Yes | openpyxl + LibreOffice (dates and numbers typed) | Pass |
| Super Admin | Reports | Single assessment | PDF | Formal PDF | Same | Yes | Page count | Pass |
| LDRRMO | Settings | Message templates | JSON | Filename standard only | Screen is LGU-only | Yes | Filename | Pass |
| LDRRMO Staff | Users / Activity Log | Called from the console | — | — | Super Admin | Refused | — | Pass |
| Barangay Official | Analytics | Analytics PDF | PDF | Formal PDF | Own barangay | Yes | Filename scope Poblacion | Pass |
| Barangay Official | Reports | Situation Report | PDF | Formal PDF | Own barangay | Yes | 1 incident in scope | Pass |
| Barangay Official | Reports | Damage and Needs (device has other barangays) | Excel | Workbook | Own barangay | Yes | 1 row, Poblacion only | Pass |
| Barangay Official | Reports | Another barangay's assessment | — | — | Own barangay | Refused ("No assessments to export") | — | Pass |
| Barangay Official | Relief | Beneficiaries, inventory | CSV | Safe CSV | Own barangay | Yes | Parsed | Pass |
| Barangay Official | Users | Called from the console | — | — | Super Admin | Refused | — | Pass |
| Citizen | Guides (desktop web) | All Guides PDF | PDF | Formal PDF | Signed in | Yes (button was hidden before) | Page count | Pass |
| Citizen | Analytics, reports | Called from the console | — | — | LGU / official | Refused | — | Pass |
| Dispatch Team | Unit Analytics | Dispatch Activity | CSV | Safe CSV | Dispatch team | Yes | Parsed; "-check hydrant" written as text | Pass |
| Dispatch Team | Reports, analytics, relief | Called from the console | — | — | Role | Refused | — | Pass |

Static checks: `node --check` on every `js/*.js` and `sw.js`; script order in `index.html`; precache list in `sw.js`. The engines were also run on 181 rows with long Filipino text, a formula-like value, an empty table and a totals row: 29-page landscape PDF with no overlap and correct page numbering (pages 1, 2, 28 and 29 viewed), and a workbook verified with openpyxl and LibreOffice.

## 6. Remaining limitations (not verified)

- **Live database and security.** RLS, cross-role behaviour against real accounts, Supabase errors and slow networks were not tested. That needs a deployed project and per-role test accounts; `docs/RLS-TEST.sql` covers the database side.
- **Dispatch Team UI.** The DEV preview has no dispatch login, so the CSV was generated with a manually created session and injected unit data (the button wiring is unchanged).
- **Not tested here.** Microsoft Excel itself (LibreOffice and openpyxl were used), mobile browsers and very large live datasets.
- **Analytics screen date range.** Cards A–C do not apply the date range (existing screen behaviour). Exports match the screen and say so; fixing the screen is a separate change.
- **Browser-only relief data.** Relief inventory and the distribution log live only in the browser; exports label them accordingly.
- **Record limits.** The console loads at most 200 accounts, 500 activity entries and 50 dispatches per unit; exports say when a limit is reached.
- **Profile visibility.** See the `profiles_read` finding in section 4.
- **Existing console errors.** NaN errors in the console come from the analytics trend chart with empty data; they were there before this change.
