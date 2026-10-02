# UniGuard

Unified Disaster Risk Reduction and Management System for LGU / LDRRMC coordination,
built on Supabase. The interface, class names and copy come from the approved design
prototype; everything behind them is now a working system.

---

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Schema and security (SQL migrations) | done |
| 2 | Auth and login screen | done |
| 3 | Data layer (async repository, loading/error/empty states, Realtime, viewport layout) | done |
| 4 | Real features (report, corroboration, status, CRUD, notifications, declare) | done |
| 5 | Map (Leaflet + OpenStreetMap) | done |
| 6 | PWA and offline (manifest, service worker, IndexedDB, queue) | done |
| 7 | Alerts (Web Push Edge Function, SMS fallback interface) | done, needs a deployed project to exercise |
| 8 | Admin and analytics (users, audit, assignment, SQL views, CSV) | done |
| 9 | Hardening and deploy (rate limiting, RLS test, logging, backups, privacy notice) | done |

---

## Layout

```
uniguard/
├── index.html                     application shell
├── privacy.html                   Data Privacy Act notice (linked from sign up)
├── manifest.json  sw.js  env.js   PWA manifest, service worker, runtime config
├── icons-192.png  icons-512.png  icons-maskable-512.png
│
├── css/
│   ├── tokens.css                 design tokens, unchanged from the prototype
│   ├── fonts.css                  @font-face for the self-hosted fonts
│   ├── app.css                    the approved stylesheet, classes unchanged
│   └── screens.css                account controls, admin tables, live map
│
├── fonts/                         Archivo + IBM Plex Sans + IBM Plex Mono (latin)
├── vendor/                        Leaflet and supabase-js, no CDN at runtime
│
├── js/
│   ├── config.js                  env, feature flags, business constants
│   ├── util.js                    escape, relative time, formatting, CSV, validation
│   ├── screens.js                 render layer: icons, components, mobile and console screens
│   ├── screens.web.js             role definitions and the citizen web shell
│   ├── screens.auth.js            sign in, create account, confirm, forgot, set password
│   ├── screens.admin.js           user management, audit log, responder assignment
│   ├── repo.js                    the async repository over Supabase, with an offline fallback
│   ├── auth.js                    sessions, sign in, sign up, reset, recovery
│   ├── map.js                     Leaflet + OSM, with the SVG map as fallback
│   ├── features.js                photo compression, geolocation, dialogs, share, print
│   ├── pwa.js                     service worker, IndexedDB cache, offline queue, web push
│   └── app.js                     state, router, render(S), every action
│
├── migrations/                    numbered, additive SQL (see below)
├── seed/001_sample_data.sql       SAMPLE data, verify before production
├── supabase/functions/            admin-users, push-dispatch, sms-fallback
└── docs/
    ├── DEPLOY.md                  setup and deploy runbook
    ├── BACKUP.md                  backup, restore and rotation
    ├── TEST-CHECKLIST-ALL.md      per-role manual test checklist
    ├── TEST-CHECKLIST-PHASE-1.md  schema and security, at SQL level
    └── RLS-TEST.sql               runnable per-role assertions
```

### Updating an installed app

The service worker is **network first for markup and code**, so a new deployment is picked up
the next time the app opens; fonts, vendor libraries and icons stay cache first because they
rarely change. When a replacement worker installs, the app activates it and reloads once, so an
already installed app never gets stuck on an old build.

If you are testing and want to be certain you are on the current build:

1. Open **Offline Readiness** (the download icon in the app bar) or look at the bottom of the
   console sidebar. The current build string is shown there.
2. Press **Force Refresh** there. It unregisters the service worker, deletes every cache and
   reloads, which is the guaranteed way off a stale build.
3. DevTools → Application → Service Workers should show the cache name `uniguard-v2`.

The build string comes from `BUILD` in `env.js`. Bump it on every deploy so you can tell at a
glance which version a device is running.

### Navigation and shortcuts

The screens are addressable with a hash, so the home screen, the report form, the shelter list
and the hotline list can be opened directly, and the app remembers where you were on reload:
`#home`, `#report`, `#advisories`, `#centers`, `#hotlines`, `#notifications`, `#dashboard`,
`#incidents`, `#analytics`, `#users`, `#audit`. The manifest shortcuts use these.

Tapping the UniGuard mark returns to the home screen, or to the dashboard in the console.

### The console navigation is a drawer

The command console keeps its navigation behind a three bar button in the top bar instead of
holding a permanent sidebar, so the working area gets the full width. Tapping the button slides
the menu in over a scrim; choosing an entry closes it again. On a screen 1280px or wider, leaving
it open pins it and shifts the content across. The choice is remembered per device.

The first entry is **Home**, which is the operations dashboard.

### Offline controls behave honestly

- **Back Online** checks the connection again, sends anything queued and reloads the data, then
  tells you what actually happened. It is not a switch: the browser decides whether you are
  online, the app just reports it.
- **Force Refresh** unregisters the service worker, clears every cache and reloads, which is the
  guaranteed way off a stale build.

## Getting started

1. **Database.** Run `migrations/000` … `009` in order. `000` is read only and tells
   you what already exists. Then, in development only, run `seed/001_sample_data.sql`.
2. **Auth settings.** Confirm email, Site URL and redirect URLs. See `docs/DEPLOY.md` §2.
3. **Configuration.** `cp .env.example .env.local`, fill it in, then generate `env.js`
   from it. Only the anon key goes in `env.js`.
4. **Functions.** Deploy `admin-users`, `push-dispatch` and `sms-fallback`, and set the
   VAPID and SMS secrets.
5. **Serve.** Any static host over HTTPS. There is no build step.
6. **Verify.** Work through `docs/TEST-CHECKLIST-ALL.md`.

Full detail, including caching headers and the optional database webhook, is in
`docs/DEPLOY.md`.

### Running with no project configured

`env.js` ships with blanks. With no project the app still runs: it serves the cached
snapshot, accepts offline reports into the queue, and the account screens create a
local account for that browser. This is how the interface can be reviewed before the
database exists. There are **no demo accounts**: nothing is prefilled and no seeded
credentials exist anywhere.

---

## Migrations

Additive and re-runnable. No table, column or row is ever dropped.

| File | Contents |
|---|---|
| `000_inspect_current_schema.sql` | read only inventory of what exists |
| `001_align_core_tables.sql` | the six core tables brought up to the Phase 1 field list |
| `002_report_workflow.sql` | `UG-YYYY-NNNN` codes, corroborations, status history, auto-verify trigger |
| `003_notifications_audit.sql` | notifications, push subscriptions, audit log, advisory fan-out |
| `004_rls_policies.sql` | role helpers, field protection, every RLS policy, `reports_feed` |
| `005_storage_bucket.sql` | private `reports` bucket, image only, 5 MB, user prefixed paths |
| `006_auth_profile_and_roles.sql` | profile trigger with the role forced to citizen, secure role admin |
| `007_report_rpcs.sql` | `corroborate_report`, `advance_report_status`, responders and assignment |
| `008_analytics_views.sql` | the six analytics views the console reads |
| `009_hardening.sql` | rate limiting, `declare_emergency`, client error log, housekeeping |

## How security is enforced

- **Role comes from `public.profiles` only.** Nothing trusts `user_metadata`, which the
  user controls.
- **Self signup can only be a citizen.** The `on_auth_user_created` trigger forces it, and
  a trigger rejects any client attempt to change `role`, `barangay_id` or `disabled`.
- **Residents never see who reported what.** `reports_feed` carries no reporter column.
  Officials see their barangay, LGU sees the city.
- **Report inserts are sanitised server side.** The reporter is forced to `auth.uid()` and
  a citizen is pinned to their own barangay.
- **Privileged actions are RPCs.** Corroboration, status changes, assignment, emergency
  declaration and role administration all run as `security definer` functions that
  re-check the caller and write an audit row.
- **Hiding a button is never the control.** Every server rule is enforced in the database.

- **The console reads live data.** Sidebar counts, KPI tiles, hazard bars, pipeline load, the
  trend and the reach figure all come from the store: computed locally so they work offline, and
  re-read from the analytics views when the project is connected. There are no hardcoded
  prototype numbers left in the console.

## How the layout fits every device

- **No page chrome.** The body is a fixed-height flex column with no margin and no
  scrollbar, so the app always ends exactly at the edge of the screen. The stage
  fills whatever the connectivity strip leaves.
- **Safe areas.** Notches, rounded corners and the home indicator are respected
  through `env(safe-area-inset-*)` on the app bar, the tab bar, the web shell and
  the account screens, which matters most in an installed app.
- **Citizen app**: full bleed on phones and tablets. Below 1024 px it is the phone
  shell with the bottom navigation; at 1024 px and above it becomes the web shell
  with the top navigation.
- **Official console**: fills the viewport at every width, and below 900 px the
  sidebar collapses to an icon rail so it stays usable on a phone.
- **Small and short screens**: tuned below 380 px wide and below 480 px tall, so a
  320 px phone and a phone in landscape both keep the navigation on screen.
- **Verified** at 320x568, 360x740, 390x844, 430x932, 740x360 landscape, 768x1024,
  1024x768, 1280x800 and 1440x900: zero page margin, no dead bands, no element
  wider than the frame, and no page level scrolling.

## Assumptions and open questions

1. Your live schema could not be inspected, so every migration is guarded and creates a
   table if it is missing. Run `000` first and compare.
2. Postgres 15+ for `security_invoker`; on older engines the view still filters explicitly.
3. `reports.code` uses one global sequence, so numbering does not restart each January.
4. The corroboration window is six hours either side of the report's `created_at`.
5. `barangay` text and `barangay_id` uuid coexist; existing rows are not backfilled.
6. Legacy rows that violate the new CHECK constraints will make those constraints fail.
   A cleanup migration will be written rather than weakening the rule.
7. **Citizen layout.** The brief describes citizens as mobile and layout as viewport
   driven. Below 1024 px citizens get the phone shell; at 1024 px and above they get
   the web shell. There is no fixed phone frame any more, so the app fills whatever
   screen it is opened on. Confirm if the citizen web shell should be removed.
8. **`?role=` / `?route=` deep links and the preview bar** are kept but gated behind
   `UG_CONFIG.DEV`, which is `false` in the shipped `env.js`.
9. **Push and SMS** are complete in code but need a deployed project, VAPID keys and an
   SMS gateway to exercise. Without a gateway the SMS function logs what it would send.
10. `../uniguard-supabase-setup.sql` is superseded and now only points here.

## Phase 1 note

`docs/TEST-CHECKLIST-PHASE-1.md` and `docs/RLS-TEST.sql` cover the schema and security
layer at SQL level, including how to impersonate each role inside a transaction.
