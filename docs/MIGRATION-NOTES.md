# UniGuard · Migration notes for the live project

Start with the [schema checker](CHECK-SUPABASE-MIGRATIONS.sql) in the Supabase
SQL Editor. Follow the missing steps in order and record each full filename.
Use the new release migrations for an existing project. The corrections to
earlier files cover new installations and installations paused at one of
those steps.

## Run order

| # | File | What it does | Risk |
|---|------|--------------|------|
| 1 | `024_analytics_invoker.sql` | Recreates the analytics views with `security_invoker` **and** explicit scope predicates; adds date-ranged function twins; adds `analytics_by_barangay`. | None — views replaced, no data touched. |
| 2 | `027_report_edit_guard.sql` | Adds `reports.location_note`; rebuilds `reports_feed` with it; installs `guard_report_edit` + citizen-edit audit trigger; tightens the `reports_update` policy. | Low. Existing rows unaffected. |
| 3 | `028_status_flow.sql` | Strict one-step status flow for every role; terminal states final; `advance_report_status` redefined. | Low — no row changes; only new writes are constrained. |
| 4 | `029_barangay_scoping.sql` | SOS read scope (+ `sos_log.barangay_id` backfill), road-status / road-work write scope, advisory scope guard + targets guard, `update_sos_status` RPC. | Low. The sos backfill is a plain UPDATE from the stored name snapshot. |
| 5 | `030_barangay_routing.sql` | `barangay_geoms` (approximate centroids — verify!), `validate_report_coords`, `resolve_barangay`, new `guard_report_insert` (coordinates win, invalid rejected), `route_report_update`, **backfill of existing reports**. | Medium — the backfill UPDATEs `reports.barangay_id/barangay` for rows with coordinates. Review the step before running; it only fills/mismatches. |
| 6 | `031_road_status_full.sql` | Road-status form columns; status check widened to `passable/one_lane/blocked/under_repair`; legacy `caution` rows become `one_lane`; updater stamping. | Low — one remap of existing rows (`caution` → `one_lane`), reversible by hand. |
| 7 | `032_guides_v2.sql` | Guide columns (summary, before/during/after, pdf); converts per-phase rows into single guides. | Medium — the conversion DELETES the v1 per-phase rows after merging their content. Re-run safe; content preserved into the new columns. Take a backup first (`pg_dump --table=preparedness_guides`). |
| 8 | `033_audit_coverage.sql` | Generic audit triggers, `shelter_occupancy_log`, occupancy trend view. | None — new writes only, starting from run time. |
| 9 | `048_fixpack_01.sql` | Fix Pack 01: adds `advisories.delivery_mode` (`push` / `in_app`, default `push`, check constraint) so the advisory composer can publish again; safety net for `alert_type` / `language` (041). Run after 047. | None — additive columns with defaults; re-runnable. |

Run 026 before 027 if it has not been applied yet on the live project (the
repo jumps from 023 to 025 — **check whether 024 was ever applied to the live
database first**; if the analytics views are already `security_invoker` there,
024 simply re-applies cleanly and can be re-run).

## Manual verification queries

After 024 — analytics scoping (run as an official, then as a citizen):

```sql
-- as a barangay official: only their barangay, or empty
select * from public.analytics_by_hazard;
-- as a citizen: must be empty
select count(*) from public.analytics_pipeline;  -- expect 0
```

After 027 — edit guard:

```sql
-- as the reporting citizen inside the window:
update public.reports set status = 'verified' where id = '<own-report-id>';
-- expect: SQL error 'Status changes go through the official workflow...'
```

After 028 — strict flow:

```sql
update public.reports set status = 'dispatched' where status = 'reported' and false;
-- probe with a fixture row inside a rolled-back transaction; expect the
-- 'Illegal status change' error for any skip, and no error for one step.
```

After 029 — SOS / road / advisory scope:

```sql
-- as an official: only own barangay
select count(*) from public.sos_log where barangay_id is distinct from public.my_barangay_id() and user_id <> auth.uid();  -- expect 0
-- as an official: municipality-wide insert must fail
insert into public.advisories (title, body, severity, kind, citywide) values ('t','t','advisory','emergency', true);  -- expect error
```

After 030 — routing + backfill sanity:

```sql
-- centroids present for all 32 barangays
select count(*) from public.barangay_geoms;                          -- expect 32
-- reports still missing coordinates (cannot be routed; list for follow-up)
select id, code, barangay from public.reports where lat is null or lng is null;
-- rows the backfill changed
select id, code, barangay from public.reports r
  join public.barangay_geoms g on g.barangay_id = r.barangay_id;      -- review
```

After 031 — road statuses valid:

```sql
select status, count(*) from public.road_status group by 1;
-- expect: no 'caution' rows; one_lane / blocked / passable / under_repair only
```

After 032 — guides converted:

```sql
select hazard_type, title, phase,
       length(body_before) b, length(body_during) d, length(body_after) a
  from public.preparedness_guides order by hazard_type;
-- expect one row per guide with phase='all'; spot-check the section text
-- against the old rows (kept in your pre-migration backup).
```

After 033 — audit coverage:

```sql
select action, count(*) from public.audit_log group by 1 order by 2 desc;
-- update a hotline, then confirm an emergency_hotlines.updated row appears
```

After 048 — advisory delivery mode:

```sql
select column_name, data_type, column_default from information_schema.columns
 where table_schema = 'public' and table_name = 'advisories'
   and column_name in ('delivery_mode', 'alert_type', 'language');
select conname from pg_constraint where conname = 'advisories_delivery_mode_check';
```

## Super Admin checks

Run these when the Super Admin's **Users** or **Activity Log** screen stays
empty or shows an error:

```sql
select id, email, role, is_super_admin, disabled from public.profiles where role = 'lgu_ldrrmc';
select to_regclass('public.audit_log_with_actor') as audit_view;
select count(*) from public.audit_log;
```

- No row with `is_super_admin = true` → apply 043 and set the flag on the
  intended account.
- `audit_view` is null → apply 045 (the app falls back to `audit_log`, but
  without the view it cannot always show the actor's role and barangay).
- `count(*)` is 0 → apply 033 (audit triggers); entries appear only after
  something changes from then on.

## Data provenance note (030)

`barangay_geoms` ships **approximate centroids** compiled from
OpenStreetMap / PhilAtlas references, with a per-barangay bounding box. This
is the nearest-centroid approximation the fix prompt authorises when no
polygon data can be obtained. **Verify every centroid against MDRRMO / PSA /
NAMRIA records before production reliance.** When official Lingayen barangay
boundaries become available, load them into `barangay_geoms.geojson` and swap
`resolve_barangay()` for a point-in-polygon test — the routing trigger will
not need to change.

## 061 · Corroboration fixes

Run after 060 (safe to re-run). Stops reports auto-verifying after a single
confirmation:

- the new-report path now uses the same 500 m rule as the confirm button
  (it counted the whole barangay before);
- a report without coordinates is judged on its own, never on the barangay;
- confirming without GPS is limited to residents of the report's barangay;
- rejected reports never count, and closed reports cannot be confirmed.

Threshold (3, reporter included), radius (500 m) and window (±6 h) are
unchanged; already-verified reports are left as they are. Check with:

    select public.corroboration_count('<report uuid>');

## 062 · Advisory fan-out lock-down, dispatch unit delete

Run after 061 (safe to re-run).

- `fanout_advisory` can no longer be called by anyone holding the public key:
  only LGU / LDRRMC and barangay officials (own barangay only), and it never
  inserts a second copy of the same advisory for one person.
- `delete_dispatch_unit` now exists (Super Admin only, refused while the unit
  is out on an open dispatch). Member accounts are unlinked; the unit's
  equipment list, roster, shifts and requests are removed with it; past
  dispatches keep their record.

Redeploy the two Edge Functions changed in the same pass:

    supabase functions deploy push-dispatch
    supabase functions deploy sms-fallback

- `push-dispatch` refuses residents and dispatch teams, and accepts
  `barangayIds` (several barangays) so a targeted advisory only reaches them.
- `sms-fallback` only accepts calls from `push-dispatch` (service role key),
  only texts emergency / warning alerts, and skips people who have a push
  device.

## 063 · Scheduled jobs

Run after 062 (safe to re-run). Schedules with pg_cron:

- `uniguard-overdue-reports` every 5 minutes → `refresh_overdue_reports()`
- `uniguard-cleanup` nightly 04:00 → `cleanup_rate_limits()`

If pg_cron is off, the migration prints a notice and does nothing: enable it
under Database → Extensions and run 063 again. Check with:

    select jobname, schedule, active from cron.job where jobname like 'uniguard-%';

## 064 · SOS: who acknowledged it

Run after 063 (safe to re-run). `sos_log` records who acknowledged / resolved
an SOS and when; a second acknowledgement does nothing and says who was
first; the sender's notification names who received it. The console shows
"Acknowledged by …" on the SOS card and in the detail; the resident's
"Help on the way" card shows "Seen by Barangay … (name)".

## 065 · Re-send a dispatch nobody acknowledges

Run after 064 (safe to re-run; needs pg_cron like 063). Every minute, a BFP,
PNP, Rescue or Ambulance unit that has not acknowledged its dispatch within
3 minutes is taken off it and the same team is sent to the next nearest unit
not yet tried on that report. The LGU is notified either way; with no other
unit and no team left, the report returns to verified. Check with:

    select jobname, schedule, active from cron.job where jobname = 'uniguard-reroute-unacknowledged';

## 066 · Alert when an SOS sent no team

Run after 065 (safe to re-run). When an SOS ends with no team on the way (no
GPS, outside Lingayen, or no free unit), the duty officers and the officials
of the sender's barangay get an urgent "NO TEAM SENT — SOS · …" notification
(type sos, so it rings) saying why and to call the sender, then dispatch.

## 067 · Unanswered SOS and unverified reports

Run after 066 (safe to re-run; needs pg_cron like 063). One job,
`uniguard-unanswered-sweep`, runs every minute:

- **SOS nobody acknowledged:** a reminder to the sender's barangay officials
  and the LGU at 5 min, an urgent "UNANSWERED 15 MIN" alert to every LGU
  account at 15 min. Migration 069 removed the original 12-hour auto-close.
  Unanswered SOS alerts stay open and remain in the pending staff receipt
  list for each eligible staff member until they record a receipt.
- **Reports nobody verified:** the LGU and the barangay's officials are
  notified once when a report is 1 h overdue. After 3 days it closes
  automatically (status `rejected`, `expired_at` set, reason `expired` in its
  history). The app shows it as "Expired", and the reporter is told to report
  again if the hazard is still there.

Closed items keep the existing final statuses, so every open/closed count and
rule keeps working. `reports_feed` is recreated with `expired_at` added as the
last column. Check with:

    select jobname, schedule, active from cron.job where jobname = 'uniguard-unanswered-sweep';
    select public.ug_unanswered_sweep();   -- runs one pass now, returns the counts

## 080 · Backend database audit

Apply after 079. The migration updates equipment and relief RPCs, adds account
guards to newer RLS tables, limits the Others review to active LGU accounts,
and restores the current overdue-report queue if legacy SQL was replayed.
It also normalizes the old ban date for removed staff accounts. It cannot
recover equipment notes already erased by a past edit.

Fresh installations run a single 045 file, `045_super_admin_improvements.sql`.
Migration 047 owns the original escalation setup. Its replay guard preserves
the two-argument verification RPC introduced in 051. For a database previously
managed with a CLI ledger, check the actual schema before relying on the stored
045 version. The checker reports the Super Admin activity log view as evidence.
Missing earlier features need to be reconciled before continuing.
