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
    return n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
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

  /* CSV export used by the console analytics and the admin tables. */
  function toCSV(rows, columns) {
    const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
    const cell = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n');
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8;' });
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

  return {
    esc, since, relTime, absTime, initials, bytes, debounce, toCSV, download,
    normalisePhone, formatPhone, passwordStrength, authError
  };
})();
