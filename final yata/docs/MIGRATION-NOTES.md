# UniGuard · Migration notes for the live project

How to bring the existing live Supabase project up to the fixed schema, in
order, with a manual verification query per step. **Never edit an
already-numbered migration**; everything here is additive and safe to re-run
(idempotent). Run each file in the Supabase SQL editor, or copy them into
`supabase/migrations/` and `supabase db push`.

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

## Data provenance note (030)

`barangay_geoms` ships **approximate centroids** compiled from
OpenStreetMap / PhilAtlas references, with a per-barangay bounding box. This
is the nearest-centroid approximation the fix prompt authorises when no
polygon data can be obtained. **Verify every centroid against MDRRMO / PSA /
NAMRIA records before production reliance.** When official Lingayen barangay
boundaries become available, load them into `barangay_geoms.geojson` and swap
`resolve_barangay()` for a point-in-polygon test — the routing trigger will
not need to change.
