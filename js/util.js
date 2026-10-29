/* UniGuard · utilities
 * Escaping, relative time, formatting and toasts. Every database-derived string
 * is passed through esc() before it reaches innerHTML.
 */
const UG_UTIL = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  /* Splits a value into { n, unit } for relative display. */
  function since(value) {
    const t = value instanceof Date ? value.getTime()
      : typeof value === 'number' ? value
      : Date.parse(value);
    if (!t || isNaN(t)) return null;
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 45) return { s, label: 'just now' };
    if (s < 90) return { s, label: '1m ago' };
    const m = Math.round(s / 60);
    if (m < 60) return { s, label: m + 'm ago' };
    const h = Math.floor(m / 60);
    const rm = m % 60;
    if (h < 24) return { s, label: rm ? h + 'h ' + rm + 'm ago' : h + 'h ago' };
    const d = Math.floor(h / 24);
    if (d < 7) return { s, label: d + 'd ago' };
    return { s, label: new Date(t).toLocaleDateString() };
  }

  /* Accepts a row with created_at / published_at / updated_at, or a raw value. */
  function relTime(itemOrValue) {
    if (itemOrValue == null) return '';
    let v = itemOrValue;
    if (typeof v === 'object') v = v.created_at || v.published_at || v.updated_at || v.time;
    if (v == null) return '';
    /* a pre-formatted relative string passes straight through */
    if (typeof v === 'string' && /(ago|just now)$/.test(v.trim())) return v.trim();
    const r = since(v);
    return r ? r.label : String(v);
  }

  function absTime(value) {
    const t = typeof value === 'string' ? Date.parse(value) : value;
    if (!t || isNaN(t)) return '';
    return new Date(t).toLocaleString([], {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }

  function initials(name, fallback) {
    const n = String(name || '').trim();
    if (!n) return fallback || '?';
    /* "Dela Cruz, Juan" reads as JD, like "Juan Dela Cruz" */
    const p = splitName(n);
    if (p.last && p.first) return (p.first[0] + p.last[0]).toUpperCase();
    return n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }

  /* Names are entered as separate Last name / First name fields and stored
     in profiles.full_name as "Last, First". A name saved before that (no
     comma) comes back whole in `first`, so the form asks for the last name. */
  function joinName(last, first) {
    const l = String(last || '').trim().replace(/\s+/g, ' ');
    const f = String(first || '').trim().replace(/\s+/g, ' ');
    return l && f ? l + ', ' + f : (l || f);
  }
  /* straight-line metres between two points (haversine) */
  function distanceM(aLat, aLng, bLat, bLng) {
    if ([aLat, aLng, bLat, bLng].some((v) => typeof v !== 'number' || isNaN(v))) return null;
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDistance(m) {
    if (m == null) return '';
    return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
  }

  function splitName(full) {
    const n = String(full || '').trim();
    const i = n.indexOf(',');
    if (i < 0) return { last: '', first: n };
    return { last: n.slice(0, i).trim(), first: n.slice(i + 1).trim() };
  }

  function bytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms || 200);
    };
  }

  /* Hands a generated Blob to the browser as a download and releases the
     object URL afterwards. Every export reaches it through UG_EXPORT.download
     (js/export-core.js); PDF, Excel and CSV are built there and in js/pdf.js /
     js/xlsx-lite.js. */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* Philippine mobile format: 09XX XXX XXXX (also accepts +639XXXXXXXXX). */
  function normalisePhone(input) {
    const digits = String(input || '').replace(/[^\d]/g, '');
    if (/^639\d{9}$/.test(digits)) return '0' + digits.slice(2);
    if (/^09\d{9}$/.test(digits)) return digits;
    return null;
  }

  function formatPhone(value) {
    const d = normalisePhone(value);
    if (!d) return value || '';
    return d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7);
  }

  function passwordStrength(pw) {
    const p = String(pw || '');
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
    return { score, label: labels[Math.min(score, labels.length - 1)] };
  }

    function syncLabel(value) {
    const t = Date.parse(value);
    if (!t) return 'Not synced yet';
    const d = new Date(t), now = new Date();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Today, ' + time;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday, ' + time;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + time;
  }

  /* Friendly text for the auth errors people actually hit. */
  function authError(message, status) {
    const m = String(message || '').toLowerCase();
    if (/invalid login credentials|invalid grant/.test(m)) return 'That email and password do not match an account.';
    if (/email not confirmed/.test(m)) return 'Confirm your email address first. Check your inbox for the link we sent.';
    if (/user is banned|disabled|deactivated/.test(m)) return 'This account has been disabled. Contact your LGU administrator.';
    if (/already registered|already exists/.test(m)) return 'An account already exists for that email. Try signing in instead.';
    if (/rate limit|too many/.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if (/failed to fetch|networkerror|network request failed/.test(m) || status === 0) {
      return 'No connection to the server. Check your network and try again.';
    }
    if (/password should be at least/.test(m)) return 'Use at least 8 characters for the password.';
    return message || 'Something went wrong. Try again.';
  }

  /* Plain-language text for errors that reach a toast. Server and browser
     messages ("TypeError: Failed to fetch", "Could not find the 'x' column ...
     in the schema cache") mean nothing to a resident. i18n.js loads after this
     file, so the strings are looked up at call time. */
  const NETWORK_RE = /failed to fetch|networkerror|network request failed|load failed/;
  function looksTechnical(message) {
    const m = String(message || '').toLowerCase();
    return NETWORK_RE.test(m) ||
      /typeerror|referenceerror|syntaxerror|schema cache|pgrst|sqlstate|jwt|row-level security|permission denied|42501|duplicate key|23505|violates|relation "|column "|' column|does not exist|\bp0001\b|rate limit/.test(m);
  }
  /* "1 corroboration", "3 corroborations" */
  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }
  /* "No corroborations yet" / "1 corroboration" / "N corroborations", in the
     active language */
  function corroborationLabel(n) {
    n = Number(n) || 0;
    const t = (k, fallback) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : fallback);
    if (n === 0) return t('incident.corrNone', 'No corroborations yet');
    return plural(n, t('incident.corrOne', 'corroboration'), t('incident.corrMany', 'corroborations'));
  }

  /* No connection at all (or a request that never reached the server), as
     opposed to the server refusing it. */
  function isNetworkError(err) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const raw = (err && typeof err === 'object' && err.message != null) ? err.message : err;
    return NETWORK_RE.test(String(raw == null ? '' : raw).toLowerCase());
  }
  function friendlyError(err) {
    const raw = (err && typeof err === 'object' && err.message != null) ? String(err.message) : String(err == null ? '' : err);
    const code = (err && typeof err === 'object' && err.code) ? String(err.code) : '';
    const m = (raw + ' ' + code).toLowerCase();
    const t = (k, fallback) => (typeof UG_I18N !== 'undefined' ? UG_I18N.t(k) : fallback);
    if (NETWORK_RE.test(m)) return t('error.network', 'No internet connection. Check your signal and try again.');
    if (/schema cache|column|relation|does not exist/.test(m)) return t('error.needsUpdate', 'Something on our side needs an update. Please try again later or contact the MDRRMO.');
    if (/jwt|token|session/.test(m) && /expired|invalid/.test(m)) return t('error.sessionEnded', 'Your session ended. Please sign in again.');
    if (/row-level security|permission denied|42501/.test(m)) return t('error.permission', 'You don\'t have permission to do that.');
    if (/rate limit|too many/.test(m)) return t('error.rateLimit', 'Too many attempts. Please wait a few minutes and try again.');
    if (/duplicate key|23505/.test(m)) return t('error.duplicate', 'This record already exists.');
    /* a sentence written by our own RPCs passes through unchanged */
    if (raw.trim() && !looksTechnical(raw) && raw.length <= 220) return raw.trim();
    return t('error.generic', 'Something went wrong. Please try again.');
  }

  return {
    esc, since, relTime, absTime, initials, joinName, splitName, distanceM, fmtDistance, bytes, debounce, downloadBlob,
    normalisePhone, formatPhone, passwordStrength, authError, syncLabel,
    friendlyError, looksTechnical, isNetworkError, plural, corroborationLabel
  };
})();
