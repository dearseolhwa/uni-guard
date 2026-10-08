# DOC_UPDATES · text changes needed in the project paper

The project paper (system documentation) predates several design decisions in
the system. Update the sections below so the paper matches what UniGuard now
does. Nothing else in the paper needs to change.

## 1 · Who the "Administrators" are

The paper sometimes says "Admin" or "Administrator" for two different roles.
Use the same two terms everywhere, matching the stored role keys:

| Paper term to use | Stored role key | What they can do |
|---|---|---|
| **Barangay Official** | `barangay_official` | Operates **only inside their own barangay**: incident queue for their barangay, advisories that target exactly their barangay, shelters and road status in their barangay, SOS from their barangay residents, barangay-scoped analytics. |
| **LGU / LDRRMC** (Municipal DRRM Office) | `lgu_ldrrmc` | Everything municipality-wide, plus: user management (create officials, assign roles and barangays, disable accounts), the hotline directory, the audit log, municipality-wide and multi-barangay advisories, the emergency declaration. |

Replace every remaining "Admin", "Administrator", "encoder" or "city hall
user" with one of these two terms. Citizens stay **Citizen / Resident**
(`citizen`).

## 2 · UC-16 (analytics) and its diagram

Redraw the UC-16 use-case diagram and text:

* **LGU / LDRRMC**: municipality-wide analytics, with a barangay comparison
  panel; can export any view as a formatted PDF for a chosen date range.
* **Barangay Official**: the same screen but **barangay-scoped** — the scope
  is enforced by the database (row-level security inside the analytics
  views), not by hiding buttons.
* **Citizen**: no analytics access at all (the database returns zero rows).

Mention the date-range filter (default: last 30 days) and that every export
is a formatted PDF — no CSV exports exist.

## 3 · Advisory and Alert Broadcast

The paper should say:

* A **Barangay Official** can publish an advisory **only for their own
  barangay** (single-barangay target). Attempting a municipality-wide or
  multi-barangay publish is rejected by the database.
* Only **LGU / LDRRMC** can publish municipality-wide or multi-barangay
  advisories, and only LGU can declare an emergency.
* Notification fan-out follows the same targeting: residents receive
  notifications for advisories that target their barangay (or
  municipality-wide ones).
* Officials editing their own advisories cannot widen the area afterwards.

## 4 · Incident Status Tracking

Replace the old "Pending → In Progress" wording. The single status flow is:

**Reported → Verified → Response Dispatched → Resolved**, plus **Rejected**
(terminal).

Rules to state in the paper:

* The stored keys are `reported`, `verified`, `dispatched`, `resolved`,
  `rejected`; the display labels above come from one map in `js/theme.js`.
* The flow is **strict for every role, including LGU/LDRRMC**: one step
  forward at a time. No skipping.
* `resolved` and `rejected` are final; `rejected` is allowed from any
  non-terminal state (duplicate, hoax, not actionable).
* Status changes go through a server RPC (`advance_report_status`) that
  re-checks role and barangay scope, writes the status history and the audit
  log, and notifies the reporter.
* Auto-verification by corroboration still applies: three independent
  matching reports in the same barangay within six hours move a report from
  Reported to Verified automatically.

## 5 · Location capture

Update the location-capture section:

* A **GPS fix or a map pin is mandatory** for every hazard report; a typed
  address or landmark is optional and supplementary (stored as the "exact
  address / landmark" field).
* Reports with missing, invalid, swapped or out-of-Lingayen coordinates are
  **rejected at the database level**, mirroring the client's
  `UG_GEO.classify` checks.
* The incident's barangay is **derived from the report's coordinates on the
  server** — never from the reporter's profile and never from the barangay
  the reporter picked. If the picked barangay disagrees, the coordinates win
  and the app tells the reporter which barangay received the report.
* Routing uses barangay reference points with explicit bounds; the reference
  data is an approximation flagged for verification against MDRRMO records
  (see `docs/MIGRATION-NOTES.md`).
* A citizen may edit their own report for **15 minutes** after filing; the
  edit can change the description, hazard type, "Others" text, address /
  landmark, photo, location and severity — never the status, barangay,
  reporter identity, code or resolution timestamps. Every edit is audited.
