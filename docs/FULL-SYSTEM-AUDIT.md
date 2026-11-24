# UniGuard full system audit

24 November 2026 · Build `uniguard-v569`

The review used the branch that already included the mobile and backend database
audit fixes. It checked the browser screens on desktop and phone, the
frontend-to-database contracts, the migration chain, and the delivery functions.
Browser tests used local accounts and controlled network responses. PostgreSQL
tests loaded the real migrations with local Auth and Storage fixtures.

## Role coverage

| Role | Screens and workflows reviewed |
| --- | --- |
| Citizen | Sign-in, account creation, reports, photos, SOS, map, advisories, relief, shelters, road work, hotlines, guides, FAQs, notifications, preferences, offline queue |
| Barangay Official | Barangay dashboard, incident workflow, SOS inbox, Response Team, advisory and road notices, shelter capacity, relief, analytics, incident documentation, activity notices |
| LDRRMO Staff | Municipality dashboard, incident verification, reassignment, dispatch directory, advisories and declaration, shelter and relief, analytics and reports, Others review |
| Super Admin | Account directory, role and assignment controls, activity log, hotline approvals, admin notices, device count, operating screens |
| BFP, PNP, Rescue and Hospital | Separate unit administrator and member previews, assignments, location controls, equipment, crew, requests, notifications, analytics, contacts and settings. Hospital capacity and patient notices were also included in the Hospital route review. |

The browser sweep checked 248 combinations of role, route and screen size for
render errors and missing action handlers. Targeted tests exercised selected
buttons and verified their data effects. The table describes review coverage
and includes screens with fixture data.

## Findings corrected

| Area | Finding and correction |
| --- | --- |
| Emergency delivery | The declaration screen reported the subscription estimate as a successful broadcast. It now shows publication and gateway results separately. The eligible device count comes from the database and excludes disabled or removed accounts. |
| Advisory publishing | The bulletin, target rows and in-app notifications were written separately. A single database transaction commits all three, and retrying an unchanged draft reuses its ID. Barangay officials publish to their assigned barangay. |
| Advisory links | A missing advisory could open an unrelated bulletin. Push, share and inbox links now open the requested record and show an unavailable state when the account cannot read it. |
| Responder assignments | The newest 50 assignments could hide an older open assignment. The dispatch portal loads open work separately and keeps it available on mobile. |
| Responder refresh and account changes | Failed reads could clear equipment, roster or notices. Refreshes preserve the last successful data where available. Sign-out and role changes clear unit state, and unfinished reads stay tied to the prior session. |
| Resident SOS | Starting another SOS could hide details of the active one. The next attempt is shown separately, older unresolved calls stay in the inbox, and the linked report can load even when it has fallen out of the recent list. |
| Offline advisories | Save Offline could report success for a preparedness advisory that the automatic snapshot excluded. Explicit downloads now save the selected bulletin for the current account. |
| Report photos | Signed photo links stayed cached after expiring. The app refreshes them and clears the cache on a scope change. |
| Shelters and patrols | Occupancy increments were sent from a cached total. They now use the locked database row and enforce the capacity. The shelter mapper preserves the PNP patrol flag when staff edit other details. |
| Road work | Barangay officials could start with a municipality-wide draft, and the screen claimed residents were notified even if fan-out failed. The composer uses the assigned barangay and reports the actual in-app notification outcome. |
| Analytics and documentation | Missing response times were counted as zero. Date boundaries now use the Philippine calendar, and barangay filters scope the relevant counts, trend, and response figures. Exports use the same view data. |
| Accounts and recovery | A missing backend could fall back to device-only signup or report that a password-reset request succeeded. Device-only accounts now require development mode. Officials see their assigned barangay during onboarding. |
| Shared interface | Cancelling a nested confirmation or prompt could leave its action waiting. Close, cancel, Escape, and account changes now end the pending dialog. |
| Directory and dashboard | Failed directory loads could blank valid results. Multi-column orders now use explicit query fields. Rejected reports no longer count as active incidents, and the citizen hotline list requests active entries. |

## Verification and rollout

- The local database tests applied migrations 001 through 082 and checked
  advisory scope, rollback, retries, shelter occupancy, and the Philippine
  midnight cutoff. They also reran the existing report privacy, SOS,
  dispatch replacement, relief, and mobile delivery checks.
- The Chromium and service worker suites checked route rendering, browser
  controls, reconnect behavior, offline storage, and push-device ownership.
- All five Edge Functions passed Deno type checking. The delivery test uses
  simulated gateways with controlled responses.
- Live checks still require a staging project with role accounts and test
  devices. Confirm authentication and invitation mail, real GPS and installed
  PWA behavior, delivery through the configured push and SMS providers, and
  scheduled Supabase jobs. Use test records and recipients.
- The code release requires [the Supabase migration checker and deployment steps](DEPLOY.md#full-system-audit-release).
