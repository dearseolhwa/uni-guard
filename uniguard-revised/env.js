/* UniGuard · runtime environment
 *
 * GENERATED ON DEPLOY from .env.local. The committed default is safe: with no
 * project configured the app runs on its local cache and the offline queue, so
 * the interface is still usable and no demo accounts exist anywhere.
 *
 * The anon key is designed to be public. Row level security is what protects the
 * data. Never put the service_role key here.
 */
window.UG_ENV = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  APP_PUBLIC_URL: '',
  VAPID_PUBLIC_KEY: '',

  /* Shown in the app so you can tell at a glance which build is running.
     Bump it on every deploy. */
  BUILD: '2026-09-19.4',

  /* Keep false in production. Turns on the preview bar and ?role=/?route= links. */
  DEV: false
};
