# Deploy

Everything below is a one-time setup. Nothing here needs a build step: the app is
plain HTML, CSS and classic scripts.

## 0. What you need

- A Supabase project (Postgres 15+).
- A host that serves static files over HTTPS. Any of these work: Netlify, Vercel,
  Cloudflare Pages, GitHub Pages, an Nginx box, or Supabase Storage's static hosting.
- For push: a VAPID key pair (`npx web-push generate-vapid-keys`).

HTTPS is required, not optional: service workers, geolocation and web push are all
restricted to secure origins. `localhost` is treated as secure for testing.

## Dispatch staff and response assignments upgrade

For an existing project with migrations through 067, apply
`migrations/068_dispatch_staff_and_assignments.sql`, deploy the updated
`admin-users` Edge Function, then publish the updated static files.

Use **Operations → Dispatch units** to create units independently of staff
invitations. Then use **Accounts → New account** to assign staff access. Each
barangay already represents its own response team through its barangay ID.
Hospitals can accept patient notices independently of ambulance deployment.

The first assignment on an incident is labeled **Lead** and additional
assignments are labeled **Support**. For a request from a deployed team, open
**Dispatch help requests**, acknowledge it, then choose **Assign backup**.
For an SOS without a linked report, confirm the location and link the matching
incident before assigning teams.

## Persistent SOS alerts upgrade

Apply `migrations/069_persistent_sos_acknowledgements.sql` after 068, then publish
the updated static files. Open an LGU or barangay console and enable browser
audio. An eligible staff account's SOS alarm repeats every five seconds while
the console can play audio, until that account acknowledges all its pending
SOS alerts. The first acknowledgment updates the shared incident and notifies
the sender. Unanswered SOS alerts stay open for staff follow-up. Dispatch units
receive assignment alerts for their own units.

## Dispatch alarms and resident response tracking upgrade

Apply `migrations/070_resident_response_tracking.sql` after 069, then publish the
static files. Keep the dispatch console open with audio enabled. A new assignment
rings on its assigned unit's console until the crew acknowledges it or the
assignment is declined or rerouted.

On the responding phone, open the assignment, acknowledge it, and choose
**Share location for this response**. Allow location access and keep UniGuard
open. Residents can open **My Reports → report details** or use the SOS tracker
to see the incident pin, the latest shared team positions, status, and the
dispatcher-provided ETA. Test with an actual dispatch handset and an independent
resident device on the deployed site.

## Super Admin account reliability upgrade

Apply `072_super_admin_account_reliability.sql` after 071. Deploy the updated
`admin-users` Edge Function before publishing the new static files. Verify the
PostgREST pre-request hook is `public.enforce_account_session`. If the project
already uses a custom hook, call this function from it before rollout.

Disabling a staff account revokes stored sessions and blocks their old access
tokens at the API. Re-enabling lets the person sign in again. Test from two
separate browser sessions and verify the account can sign in fresh after being
enabled. Search for an older account and check that pagination and status filters
match. Pending invitations can send a fresh password setup link through the
Supabase password recovery flow. Verify the SMTP provider, allowed redirect URL,
email arrival and acceptance using a staging account.

## Dispatch authority upgrade

Apply `073_dispatch_authority_hierarchy.sql` after 072, then publish the matching
static files. Barangay officials can send their own Barangay Response Team or
request a municipal unit from an incident. MDRRMO duty staff review requests in
**Dispatch Units → Municipal dispatch requests** and dispatch from the linked
incident. Manual municipal assignment and incident response decisions belong to
duty staff. The Super Admin manages accounts, configuration, and oversight.
Existing automatic SOS response rules continue to run.

## Shared relief inventory

Apply `074_shared_relief_inventory.sql` after 073 and publish the updated site.
MDRRMO duty staff can maintain shared stock and void incorrect distributions.
Barangay officials can record distributions for their own barangay. A void
restores stock and preserves the original record for audit. Existing database
records are preserved. Browser preview stock is sample data and is not imported.

## Super Admin upgrade from 074

Back up the database and confirm the last applied migration by full filename.
If you do not know it, run
[`CHECK-SUPABASE-MIGRATIONS.sql`](CHECK-SUPABASE-MIGRATIONS.sql) in the SQL
Editor. It checks recorded CLI history when available and inspects the actual
schema when migrations were previously pasted into the SQL Editor. Follow its
final recommendation. If it reports a gap, keep the full result grid and resolve
that gap before applying 075 or 076.
For a project already through 074, apply these files in the SQL Editor, in order.

| File | What changes |
| --- | --- |
| [075_super_admin_audit_fixes.sql](../migrations/075_super_admin_audit_fixes.sql) | Allows account deletion to clear the requester on old change requests, revokes obsolete staff-management RPCs from browser roles, extends revoked-session policies, and rejects approval when the hotline target is gone. |
| [076_super_admin_notifications.sql](../migrations/076_super_admin_notifications.sql) | Adds persisted Super Admin notifications and a push queue. New pending hotline requests and supported account events produce notification rows. |

The branch also corrects migrations 043, `045_super_admin_improvements.sql`, and
072 for fresh or incomplete setups. Use the corrected files when applying
missing migrations. A project that has already successfully applied them can
continue with 075 and 076.

1. Confirm the deployed HTTPS origin is the Auth **Site URL**, that the allowed
   Auth redirect URLs include that origin, and that SMTP works for invitations
   and password recovery. In `env.js` and the `admin-users` function's
   `APP_PUBLIC_URL` secret, use the same public HTTPS origin. Set
   `ALLOWED_REDIRECT_ORIGINS` only if you also use another approved site.
2. Redeploy the updated `admin-users` function with its existing JWT verification.
   Keep the existing project URL, browser anon/publishable key, and Web Push keys.
   The integration updates the frontend build version while keeping the
   repository's project configuration.
3. For background Super Admin push, follow
   [Super Admin push](#7b-super-admin-push-migration-076). In-app Super Admin
   notifications work after 076 without configuring the worker.
4. Publish the static site after applying both migrations and updating
   `admin-users`. Verify an invitation link on a phone and a hotline change
   request from a separate staff account. The actor is excluded from their own
   Super Admin notification, so use different accounts for sender and recipient.
   Mark a notification read and confirm it stays read after reload.

If you are behind 074, apply the missing files in filename order before these
two migrations. Check the sections above for 068–074 and
[background emergency delivery](#7-background-sos-and-dispatch-delivery) for 071.
The `emergency-delivery` worker, its Vault entries, and its cron job are
independent of Super Admin push.

## Upgrade from 076

Run [077_relief_scope_and_support_completion.sql](../migrations/077_relief_scope_and_support_completion.sql)
in the Supabase SQL Editor before deploying build `uniguard-v562`. It scopes
relief schedules and beneficiary records by barangay and makes support request
completion safe to retry. Current relief records stay in the database.
Run [the migration checker](CHECK-SUPABASE-MIGRATIONS.sql) again and confirm it
marks the `077` milestone as installed.

Older offline queue entries without an account ID are held on the device.
Residents who still need assistance can file a new report or call the LDRRMO
from the SOS screen.

Publish the new build to Vercel from the branch containing this migration.
Check the deployed site's `sw.js` for `uniguard-v562` before testing live sign-in,
photo uploads, email, and push or SMS.

## Audit fixes from 077

Use the [read-only migration checker](CHECK-SUPABASE-MIGRATIONS.sql) in the
Supabase SQL Editor. Apply
[078_report_access_and_reliable_submissions.sql](../migrations/078_report_access_and_reliable_submissions.sql)
before deploying build `uniguard-v566`. Run the checker again to confirm the
078 milestone is installed. Migration 078 restricts the shared report feed,
restores scoped landmark data and adds transaction-backed submission receipts.
The existing SOS endpoint remains available for the previous app build during
the update.

The **Needs a replacement team** queue appears on the Barangay and MDRRMO
incident screens after the last assigned team declines. MDRRMO duty staff
coordinate replacement and barangay officials retain their local dispatch
authority. The queue marks reports overdue after three minutes, using the
existing unacknowledged-dispatch interval as the review target. The report
leaves the queue when a team is assigned or the report is closed.

In staging, verify that a same-barangay peer sees a neutral SOS summary without
identity, notes or exact location. Check that the sender and authorized duty
staff can still find the details. Test a lost connection during submission and
confirm that retrying returns the same report or SOS. Follow the [background
delivery checks](#7-background-sos-and-dispatch-delivery) separately.

## Mobile audit release

Run the [migration checker](CHECK-SUPABASE-MIGRATIONS.sql) in Supabase.
If 078 is installed, apply
[079_mobile_delivery_reliability.sql](../migrations/079_mobile_delivery_reliability.sql).
Then deploy the four delivery functions from this branch before releasing
the `uniguard-v567` web build.

```bash
supabase functions deploy sms-fallback
supabase functions deploy push-dispatch
supabase functions deploy admin-notify --no-verify-jwt
supabase functions deploy emergency-delivery --no-verify-jwt
```

In staging, reopen the installed app while offline after saving an SOS.
Verify that it appears on the SOS screen and in My Reports. Check the camera
and gallery chooser on Android, test a push after switching accounts on one
device, and tap a notification while the app is in the background. Verify
sender names in the activity log. Retry the same advisory and confirm one
SMS per recipient. The SMS gateway should honor the `Idempotency-Key`
header so a retry remains safe after a lost gateway response.

The app's manifest ID is now the site root. If an existing installation
continues to open an older copy, finish syncing its pending items, then
reinstall from the current site.

The [GitHub checks](../.github/workflows/checks.yml) run the migration chain,
role access tests, and browser regressions against fixtures. For a local run,
use `npm ci`, `npx playwright install chromium`, and `npm test` from `tests/`.
Use the same sequence on each release branch and then verify the staging
project before promoting it to production.

## Backend database audit release

Run the [migration checker](CHECK-SUPABASE-MIGRATIONS.sql) in Supabase. Apply the
missing release migrations in order, then run
[080_backend_audit_fixes.sql](../migrations/080_backend_audit_fixes.sql).
Run the checker again and confirm it reports features through 080. If you are
also releasing the mobile audit changes, deploy the four delivery functions
listed above before promoting the `uniguard-v568` web build.

Verify in staging that an equipment edit can keep or clear its notes. Check
that only active LGU accounts see the Others hazard review, a failed relief
void leaves both stock and the ledger intact, and an unread SOS stays in the
staff inbox after 12 hours. Use [the dispatch delivery checks](#7-background-sos-and-dispatch-delivery)
for the live delivery configuration. Check the configured app URL and
redirect origins against the production domain when testing staff invites.

## Full system audit release

Run the [migration checker](CHECK-SUPABASE-MIGRATIONS.sql) to identify missing
steps through 082. If the project is already on 080, apply
[081](../migrations/081_advisory_publishing.sql) and then
[082](../migrations/082_shelter_occupancy_and_analytics.sql) in the SQL Editor.
Run the checker again before releasing web build `uniguard-v569`. Deploy any
delivery functions still pending from the mobile audit release above.

Use a staging project to verify that residents in the intended barangay see a
test advisory, that repeated publishing after a connection failure creates a
single bulletin, and that the emergency screen distinguishes publication from
delivery. Confirm shelter occupancy updates from the duty and barangay roles.
The [audit report](FULL-SYSTEM-AUDIT.md) lists the remaining live checks.

## Alert receipt and situation report release

Run the [migration checker](CHECK-SUPABASE-MIGRATIONS.sql) and apply the missing
steps through [083](../migrations/083_alert_receipts_and_report_register.sql)
before releasing web build `uniguard-v570`. Deploy the updated
`push-dispatch` Edge Function to enforce advisory expiry during delivery.

In staging, acknowledge the same advisory from two accounts on one device,
retry an emergency declaration after interrupting its response, and issue
situation reports for the same event from two barangays.

## SOS and dispatch delivery release

Run the [migration checker](CHECK-SUPABASE-MIGRATIONS.sql) and apply the missing
files through [084](../migrations/084_sos_and_dispatch_delivery.sql). Deploy
the updated `emergency-delivery` Edge Function and release web build
`uniguard-v571`. Complete the [background delivery setup](#7-background-sos-and-dispatch-delivery)
for phone alerts to reach staff who have closed the app.

Open the Dispatch Units directory and verify that each live BFP, PNP, rescue
and ambulance unit has at least one active account linked to it. Automatic
routing skips units with no active account. Have duty staff review existing
open assignments to those units and arrange reassignment when needed.

Use a staging project to send a Fire SOS and a separate fire hazard report
with a resident account. For the hazard report, verify it with an MDRRMO duty
account. Confirm the assigned BFP account opens each incident, that a staff
phone receives the alert with the app closed, and that acknowledgment appears
in the console. Repeat without GPS using a resident account with a registered
barangay. Check for the address confirmation message, an empty ETA, and no
driving directions.

| Incident type | Recipients |
| --- | --- |
| Fire, medical, crime, and rescue SOS | MDRRMO and the affected barangay receive the SOS. The assigned BFP, ambulance, PNP, or rescue unit receives its own alert. |
| Other / not sure SOS | MDRRMO and the affected barangay review the SOS and arrange any specialized response. |
| New hazard report | The affected barangay receives a review alert. MDRRMO duty staff also receive urgent, life-safety, unclassified reports and reports without an active barangay reviewer. |
| Verified hazard report | The response team for each hazard receives a separate assignment alert. Severity controls alert urgency. Barangay verification and resident corroboration send a heads-up to the mapped response team accounts while MDRRMO arranges any municipal assignment. Unclassified hazards need duty review to choose a team. |
| Needed team unavailable or declines | MDRRMO duty staff receive a follow-up alert. Use the incident queue to arrange another response. |

The routing rules cover the departments with UniGuard roles. The duty officer
can assign additional responders when needed and coordinates with agencies
such as the electric utility that lack an account or routing integration.

## Corroboration release

Apply [085](../migrations/085_corroboration_reliability.sql) after 084, then
release web build `uniguard-v572`. In staging, submit a regular hazard and
confirm it from two other resident accounts. Verify that the meter shows
one, two, then three independent residents and the mapped response teams
get the confirmed-hazard alert. Test a repeated confirmation and separate
reports under Others with different descriptions.

## Relief supplies release

Apply [086](../migrations/086_relief_supply_units.sql) after 085, then release
web build `uniguard-v573`. When an item has active distribution records, create a
separate item if you need to track a different unit of measure. The original
item keeps the unit used by those distributions so a void can restore stock
correctly. Inventory totals count item types and distribution records.
Quantities appear per item with their units.

## Supply and equipment audit release

Run the [migration checker](CHECK-SUPABASE-MIGRATIONS.sql), then apply any
missing files through [087](../migrations/087_relief_equipment_audit.sql) before
publishing web build `uniguard-v575`. Migration 087 backfills distribution
barangay IDs from audit entries or exact matching directory names, and preserves
unmatched history for MDRRMO. Items at or below their reorder point generate an
in-app notice for active MDRRMO duty staff. Standard equipment catalog templates
remain available. To load sample units or equipment in development or staging,
prepend `set uniguard.demo_seed = 'on';` to `seed/003_dispatch_units.sql` in the
same SQL Editor query.

Verify an escort request from Relief → View and confirm it from the PNP home
screen. Check that booked equipment stays deployed until the dispatch releases
it, and that readiness checks appear under Service history.

## 1. Database

For a fresh database, apply the files in `migrations/` in filename order, from
`001_align_core_tables.sql` through `087_relief_equipment_audit.sql`.
`000_inspect_current_schema.sql` is optional and read-only. Use the SQL Editor
and record each full filename. Migration 011 installs `pg_trgm` before creating
its index. Apply `045_super_admin_improvements.sql`, followed by 046 and 047. Migration 043 promotes the account matching its
bootstrap email if the account and profile exist. For a fresh project, use an
email you control in the bootstrap block. If the account does not exist yet,
create it and run only that promotion block once it has a profile.

Migration 072 can finish even when the SQL Editor role lacks permission to
install the `reject_revoked_session` policy on `storage.objects`. If it reports
that the Storage policy was skipped, use a role with policy-management rights
to add the restrictive Storage policy defined in 072 and confirm it is present
with the verification query below.

Then, in development or staging only:

```bash
# seed/001_sample_data.sql
# seed/002_relief_guides_faqs_roadwork.sql
```

## 2. Auth settings

Dashboard → Authentication:

| Setting                 | Value                                             | Why                                             |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Email provider          | enabled                                           | accounts and password reset                     |
| Confirm email           | ON for production, OFF while testing              | the app tells the user to confirm when it is on |
| Site URL                | your deployed https URL                           | reset and confirmation links return here        |
| Redirect URLs           | `https://your-host/**` (+ `http://127.0.0.1:5500/**` for desktop dev only) | password recovery and email confirmation |
| Minimum password length | 8                                                 | matches the client side hint                    |

Nothing else needs changing. The profile row for every new account is created by
the `on_auth_user_created` trigger, with the role forced to `citizen`.

> **⚠ Email links (confirmation, invite, password reset) — read before testing on phones**
>
> - Dashboard → Authentication → URL Configuration → **Site URL** = the deployed
>   **https** URL (for example `https://uniguard-lingayen.netlify.app`).
> - **Redirect URLs** must include `https://<deployed-host>/**` and, for desktop
>   development only, `http://127.0.0.1:5500/**`.
> - Testing on phones requires a deployed HTTPS URL (a Netlify drop-deploy is
>   enough). `127.0.0.1` / `localhost` is the phone itself, so a link pointing there
>   never works from another device (`ERR_CONNECTION_REFUSED`) even though Supabase
>   has already confirmed the account. Web Push and service workers need HTTPS anyway.
> - `env.js` → `APP_PUBLIC_URL` must equal the deployed URL. The app falls back to
>   the current origin when `APP_PUBLIC_URL` is a loopback address, and logs a
>   console warning when both are loopback.

## 3. Application configuration

Set the four environment variables below for your deployment and generate
`env.js`. The generated file is served to the browser:

```bash
cat > env.js <<EOF
window.UG_ENV = {
  SUPABASE_URL: "$SUPABASE_URL",
  SUPABASE_ANON_KEY: "$SUPABASE_ANON_KEY",
  APP_PUBLIC_URL: "$APP_PUBLIC_URL",
  VAPID_PUBLIC_KEY: "$VAPID_PUBLIC_KEY",
  BUILD: "set-this-to-your-release-version",
  DEV: false
};
EOF
```

Only the browser-safe **anon or publishable** key belongs here. The `service_role` key bypasses every RLS rule
and must never reach the browser.

## 4. Edge Functions

```bash
supabase functions deploy admin-users
supabase functions deploy push-dispatch
supabase functions deploy sms-fallback
supabase secrets set APP_PUBLIC_URL='https://<deployed-host>'
# Optional: ALLOWED_REDIRECT_ORIGINS is a comma-separated list of extra origins.

supabase secrets set \
  VAPID_PUBLIC_KEY=... \
  VAPID_PRIVATE_KEY=... \
  VAPID_SUBJECT=mailto:drrmo@example.gov.ph \
  SMS_GATEWAY_URL=... \
  SMS_GATEWAY_KEY=... \
  SMS_SENDER=UniGuard
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to
Edge Functions automatically.

## 5. Upload the site

```bash
# any static host; this is the whole app
index.html  privacy.html  manifest.json  sw.js  env.js
css/  js/  fonts/  vendor/  icons-*.png
```

Two host settings matter:

- **Cache control**: serve `index.html`, `sw.js` and `env.js` with
  `Cache-Control: no-cache` so a new deploy is picked up. Everything under
  `css/`, `js/`, `fonts/` and `vendor/` can be cached for a year, because the
  service worker falls back to the network on a miss.
- **SPA fallback**: not needed. Every route is a hash-free single page and deep
  links are off by default.

## 6. Scheduled maintenance

Rate limit buckets are pruned by `public.cleanup_rate_limits()`. Call it nightly:

```sql
-- Supabase Cron / pg_cron
select cron.schedule('uniguard-cleanup', '0 4 * * *', $$select public.cleanup_rate_limits()$$);
```

## 7. Background SOS and dispatch delivery

Deploy the queue worker after applying migration 084.

```bash
supabase functions deploy emergency-delivery --no-verify-jwt
```

Configure the existing VAPID keys and SMS gateway secrets for the worker.
The SMS provider must accept the JSON contract in the Edge Function and should
honor the Idempotency-Key header. Staff need a working push subscription or a
valid phone number with SMS configured. Record acknowledgment in UniGuard.

Enable Supabase Cron, pg_net, and Vault in the project. In Vault, set
`uniguard_emergency_worker_url` to the full deployed function URL and
`uniguard_emergency_worker_secret` to a long, random bearer secret. The
worker checks the Vault secret when no Edge Function secret named
`EMERGENCY_WORKER_SECRET` is set. If you already set that Edge Function secret,
use the same value in Vault. Schedule retries in the SQL editor as a project
administrator.

```sql
select cron.schedule('uniguard-emergency-delivery', '* * * * *',
  'select public.kick_emergency_delivery()');
```

In-app alerts are created with the assignment. With Vault and pg_net
configured, new queue entries wake the worker after the transaction commits.
Cron picks up retries and queued work if a wake is missed. Verify the
`uniguard-reroute-unacknowledged` cron job is active to reroute municipal teams
that have yet to acknowledge. Only new events enter the alert queue. Failed deliveries appear in the
LGU notification inbox for duty-phone or radio follow-up. In staging, check
that the provider accepts a push with the device app closed, check SMS on a
staff account without working push, and check the failure alert with neither
channel configured. Verify acknowledgment separately in UniGuard.

## 7b. Super Admin push (migration 076)

Migration 076 stores Super Admin notifications on the server (hotline change
requests, account events) and queues a phone push for each. The rows appear in
the app as soon as 076 is applied; the push needs this one-time setup.

```bash
supabase functions deploy admin-notify --no-verify-jwt
```

Enable `pg_net` and Supabase Vault in Dashboard → Database → Extensions.
Enable `pg_cron` before running 076 if you want the retry job installed
automatically. The worker reuses `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
`VAPID_SUBJECT` from your existing function secrets. Preserve the existing VAPID
key pair so subscribed devices can keep receiving push.

Create these two Vault entries once. If either name already exists, update the
existing Vault entry. Use this Supabase project's function URL and generate a
fresh random bearer secret for this worker.

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/admin-notify', 'uniguard_admin_notify_url');
select vault.create_secret('<long-random-secret-for-admin-notify>', 'uniguard_admin_notify_secret');
```

The worker validates its bearer token against Vault. `ADMIN_NOTIFY_SECRET` is
an optional Edge Function alternative. The Vault secret is still required for
the database to call the worker. Keep worker secrets out of browser files.

If `pg_cron` was enabled after 076, register the named job once.

```sql
select cron.schedule('uniguard-admin-notify', '*/2 * * * *', 'select public.kick_admin_notify()');
```

With pg_net and Vault configured, new notification rows wake the worker
immediately. The cron job handles retries. In UniGuard, enable alerts on the
receiving Super Admin device before testing.

### Read-only SQL verification

```sql
select to_regprocedure('public.account_session_blocked()') is not null as has_072,
       to_regclass('public.barangay_dispatch_requests') is not null as has_073,
       to_regprocedure('public.read_relief_stock()') is not null as has_074,
       (select is_nullable = 'YES' from information_schema.columns
         where table_schema = 'public' and table_name = 'change_requests'
           and column_name = 'requester_id') as requester_nullable,
       to_regprocedure('public.claim_admin_push(integer)') is not null as has_076;

select schemaname, tablename, policyname
from pg_policies
where policyname = 'reject_revoked_session'
  and (tablename = 'barangay_dispatch_requests'
       or (schemaname = 'storage' and tablename = 'objects'));

select extname from pg_extension
where extname in ('pg_net', 'pg_cron', 'supabase_vault');

select push_status, count(*) from public.notifications
where audience = 'super_admin' group by push_status;

select kind, status, count(*) as jobs,
       now() - min(created_at) filter (where status in ('pending','processing')) as oldest_wait
from public.emergency_delivery
group by kind, status
order by kind, status;

select count(*) as awaiting_acknowledgment, now() - min(created_at) as oldest_wait
from public.sos_log
where status = 'sent';

select u.name, u.unit_type, u.status,
       (select count(*) from public.profiles p where p.dispatch_unit_id = u.id
          and p.role = 'dispatch_team' and not p.disabled and p.removed_at is null) as active_accounts,
       (select count(*) from public.report_dispatches d where d.unit_id = u.id
          and d.dispatch_status not in ('done','declined')) as open_assignments
from public.dispatch_units u where u.active
order by u.unit_type, u.name;

select kind, status, channel, count(*) as deliveries
from public.emergency_delivery
where created_at >= now() - interval '24 hours'
group by kind, status, channel
order by kind, status, channel;

select count(*) as awaiting_replacement, now() - min(r.updated_at) as oldest_wait
from public.reports r
where r.status = 'verified'
  and exists (select 1 from public.report_status_history h
              where h.report_id = r.id and h.reason = 'all_declined')
  and not exists (select 1 from public.report_dispatches d
                  where d.report_id = r.id and d.dispatch_status <> 'declined');
```

Run these additional queries only when the corresponding extensions are
enabled. They verify names and scheduling without showing secret values.

```sql
select name from vault.secrets
where name in ('uniguard_admin_notify_url', 'uniguard_admin_notify_secret',
               'uniguard_emergency_worker_url', 'uniguard_emergency_worker_secret');

select jobname, schedule, active from cron.job
where jobname in ('uniguard-admin-notify', 'uniguard-emergency-delivery',
                  'uniguard-reroute-unacknowledged');
```

After a test event, `sent` means at least one push provider accepted delivery.
`none` means no eligible subscription, and `failed` means delivery exhausted
the configured attempts. If rows remain `pending`, check the cron job, Vault
entries, and function logs.

## 8. Verification after deploy

1. `https://your-host/manifest.json` loads and Chrome shows an install prompt.
2. DevTools → Application → Service Workers shows `sw.js` activated.
3. DevTools → Application → Manifest shows the three icons with no warnings.
4. Create an account, confirm the email, sign in, and check that a resident lands
   on the resident app while an official lands on the console.
5. Turn off the network in DevTools and reload: the shell must still open and show
   cached hotlines, shelters and advisories.
6. Submit a report with the network off, then turn it back on and watch the queue
   upload from the banner.

## Rollback

Static hosting makes this trivial: redeploy the previous commit. The database is
additive, so an older client keeps working against a newer schema. If a migration
must be undone, write a new migration that reverses it; never edit an applied one.
