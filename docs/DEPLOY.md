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

## 1. Database

For a fresh database, run the files in `migrations/` in filename order, from
`001_align_core_tables.sql` through `073_dispatch_authority_hierarchy.sql`.
`000_inspect_current_schema.sql` is an optional read-only inspection. Use the SQL
editor and keep a record of the **full filename** applied. Enable `pg_trgm` before
011. Both `045_*` files
must run separately. Before running 043, create the first Super Admin account
and make sure its email matches the bootstrap email in that migration.

For an existing database, confirm the last applied full filename and apply
only later files. For an installation at 070, apply 071. Deploy the relevant
Edge Functions and their secrets before publishing the matching static files.
The SQL editor sequence avoids the duplicate version prefix in legacy files.

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

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

Then generate `env.js` from it (this file is served to the browser):

```bash
cat > env.js <<EOF
window.UG_ENV = {
  SUPABASE_URL: "$SUPABASE_URL",
  SUPABASE_ANON_KEY: "$SUPABASE_ANON_KEY",
  APP_PUBLIC_URL: "$APP_PUBLIC_URL",
  VAPID_PUBLIC_KEY: "$VAPID_PUBLIC_KEY",
  DEV: false
};
EOF
```

Only the **anon** key belongs here. The `service_role` key bypasses every RLS rule
and must never reach the browser.

## 4. Edge Functions

```bash
supabase functions deploy admin-users
supabase functions deploy push-dispatch
supabase functions deploy sms-fallback

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

Deploy the queue worker with its own bearer secret.

```bash
supabase secrets set EMERGENCY_WORKER_SECRET='<a-long-random-secret>'
supabase functions deploy emergency-delivery --no-verify-jwt
```

Configure the existing VAPID keys and SMS gateway secrets for the worker.
The SMS provider must accept the JSON contract in the Edge Function and should
honor the Idempotency-Key header. Staff need a push subscription or a valid
phone number. Providers accepting a message does not establish acknowledgment.

Enable Supabase Cron, pg_net, and Vault in the project. Store the full worker
URL as `uniguard_emergency_worker_url` and the same bearer secret as
`uniguard_emergency_worker_secret` in Vault, then schedule the following in
the SQL editor. Keep the cron job active on the deployed environment.

```sql
select cron.schedule('uniguard-emergency-delivery', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'uniguard_emergency_worker_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'uniguard_emergency_worker_secret')),
    body := '{}'::jsonb
  );
$job$);
```

In-app alerting remains immediate. Background delivery starts on the next
worker run and may be delayed by queue volume or provider availability. Only
new SOS and dispatch events enter the queue. Failed deliveries appear in the
LGU notification inbox for duty-phone or radio follow-up. In staging, check
that the provider accepts a push with the device app closed, check SMS on a
staff account without working push, and check the failure alert with neither
channel configured. Verify acknowledgment separately in UniGuard.

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
