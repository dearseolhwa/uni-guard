/* UniGuard · configuration
 *
 * Deploy-time settings. `window.UG_ENV` is populated by /env.js (generated on
 * deploy from .env.local) or by a small inline script. The anon key is safe to
 * expose: row level security is what protects the data.
 */
const UG_CONFIG = (function () {
  const env = (typeof window !== 'undefined' && window.UG_ENV) || {};

  return {
    SUPABASE_URL: env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || '',
    APP_PUBLIC_URL: env.APP_PUBLIC_URL || (typeof location !== 'undefined' ? location.origin : ''),
    BUILD: env.BUILD || 'dev',

    /* Web Push public key (Phase 7). Safe to expose, the private half never leaves the server. */
    VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY || '',

    /* DEV gate: the preview bar and ?role=/?route= deep links are OFF in production. */
    DEV: env.DEV === true || env.DEV === 'true',

    /* photo handling */
    MAX_PHOTO_BYTES: 5 * 1024 * 1024,
    PHOTO_MAX_EDGE: 1600,
    PHOTO_QUALITY: 0.82,

    /* business rules mirrored from the database */
    REPORT_EDIT_MINUTES: 15,
    CORROBORATION_WINDOW_HOURS: 6,
    CORROBORATION_THRESHOLD: 3,

    /* how often the offline queue retries while the app is open */
    SYNC_RETRY_MS: 20000
  };
})();
