/* UniGuard · shared export utilities (js/export-core.js)
 *
 * One place for everything every export needs, whatever its format:
 *
 *   · org()                  who the document comes from, read from the
 *                            organisation profile (Settings → General), with
 *                            the place data in js/geo.js as the fallback
 *   · formatDate / formatDateTime / isoDate / isoDateTime / excelSerial
 *                            dates, always in Philippine Standard Time
 *   · buildFilename()        UniGuard_Type_Scope_Period.ext
 *   · buildMetadata()        the metadata block shared by PDF, workbook and the
 *                            CSV export confirmation
 *   · formatCell()           one typed value → display text (PDF, on-screen)
 *   · buildCsv() / saveCsv() RFC 4180 CSV, UTF-8 with BOM, formula-safe
 *   · validateScope()        client-side role and barangay check (defence in
 *                            depth; row level security is the real control)
 *   · run()                  busy state, duplicate-click guard and toasts
 *
 * Columns are typed so the same dataset formats correctly everywhere:
 *   text · longtext · id · status · int · num · money · pct · date · datetime
 * A cell may also be { v: value, t: 'type' } to override its column's type.
 *
 * Formats (PDF in js/pdf.js, Excel in js/xlsx-lite.js) build on this file;
 * nothing here draws or zips anything.
 */
const UG_EXPORT = (function () {
  const SYSTEM = 'UniGuard';
  const SYSTEM_FULL = 'UniGuard Disaster Response and Management System';
  /* The Philippines has one time zone and no daylight saving time. */
  const TZ_OFFSET_MIN = 480;
  const TZ_LABEL = 'PHT';
  const TZ_LONG = 'Philippine Standard Time (UTC+08:00)';
  const MISSING = '\u2014'; /* em dash, shown for "no value" in documents */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ------------------------------------------------------------ organisation */
  function org() {
    const place = (typeof UG_GEO !== 'undefined' && UG_GEO.PLACE) || {};
    let cfg = {};
    try {
      if (typeof UG_SETTINGS !== 'undefined' && UG_SETTINGS.getSystemConfig) cfg = UG_SETTINGS.getSystemConfig().org || {};
    } catch (e) { cfg = {}; }
    const municipality = String(cfg.municipality || place.town || '').trim();
    const province = String(cfg.province || place.province || '').trim();
    return {
      system: SYSTEM,
      systemFull: SYSTEM_FULL,
      municipality: municipality,
      province: province,
      /* empty when not configured: the header then simply leaves the line out */
      office: String(cfg.office || '').trim(),
      place: [municipality, province].filter(Boolean).join(', '),
      lguLine: municipality ? ('Municipality of ' + municipality + (province ? ', Province of ' + province : '')) : ''
    };
  }

  /* ------------------------------------------------------------------ dates */
  const pad = (n, w) => String(n).padStart(w || 2, '0');

  /* Parses Date, epoch ms, ISO timestamps and plain YYYY-MM-DD dates. A plain
     date is read as that calendar day in the Philippines. Anything else
     (relative strings such as "10m ago", free text) is NOT a date. */
  function toDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') return isFinite(v) ? new Date(v) : null;
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const t = Date.parse(s + 'T00:00:00+08:00');
      return isNaN(t) ? null : new Date(t);
    }
    if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return null;
    const t = Date.parse(s.replace(' ', 'T'));
    return isNaN(t) ? null : new Date(t);
  }

  /* wall-clock fields in Philippine time, whatever the device's zone */
  function ph(d) {
    const x = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), h: x.getUTCHours(), mi: x.getUTCMinutes(), s: x.getUTCSeconds() };
  }

  function formatDate(v) {
    const d = toDate(v); if (!d) return '';
    const p = ph(d);
    return p.d + ' ' + MONTHS[p.m] + ' ' + p.y;
  }
  function formatDateTime(v, withZone) {
    const d = toDate(v); if (!d) return '';
    const p = ph(d);
    return p.d + ' ' + MONTHS[p.m] + ' ' + p.y + ', ' + pad(p.h) + ':' + pad(p.mi) + (withZone ? ' ' + TZ_LABEL : '');
  }
  function isoDate(v) {
    const d = toDate(v); if (!d) return '';
    const p = ph(d);
    return p.y + '-' + pad(p.m + 1) + '-' + pad(p.d);
  }
  function isoDateTime(v) {
    const d = toDate(v); if (!d) return '';
    const p = ph(d);
    return p.y + '-' + pad(p.m + 1) + '-' + pad(p.d) + 'T' + pad(p.h) + ':' + pad(p.mi) + ':' + pad(p.s) + '+08:00';
  }
  /* Excel stores date-times as days since 1899-12-30 in local wall time. */
  function excelSerial(v, dateOnly) {
    const d = toDate(v); if (!d) return null;
    const local = d.getTime() + TZ_OFFSET_MIN * 60000;
    const serial = local / 86400000 + 25569;
    return dateOnly ? Math.floor(serial) : Math.round(serial * 86400) / 86400;
  }
  const todayIso = () => isoDate(new Date());

  /* "1 Oct 2026 to 28 Oct 2026"; open ends are said in words */
  function periodLabel(from, to) {
    if (!from && !to) return '';
    return (from ? formatDate(from) || String(from) : 'Earliest record') + ' to ' + (to ? formatDate(to) || String(to) : 'today');
  }

  /* ------------------------------------------------------------------ cells */
  const NUMERIC = { int: 1, num: 1, money: 1, pct: 1 };
  const isNumericType = (t) => !!NUMERIC[t];

  function unwrap(cell, colType) {
    if (cell && typeof cell === 'object' && !(cell instanceof Date) && 'v' in cell) return { v: cell.v, t: cell.t || colType || 'text' };
    return { v: cell, t: colType || 'text' };
  }

  function numberOrNull(v) {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }

  /* display text for documents and the on-screen preview */
  function formatCell(cell, colType) {
    const c = unwrap(cell, colType);
    const v = c.v;
    /* a label such as "TOTAL" or "Not assessed" in a numeric column stays as written */
    if (isNumericType(c.t) && typeof v === 'string' && v.trim() !== '' && numberOrNull(v) == null) return v;
    switch (c.t) {
      case 'int': { const n = numberOrNull(v); return n == null ? MISSING : Math.round(n).toLocaleString('en-PH'); }
      case 'num': { const n = numberOrNull(v); return n == null ? MISSING : n.toLocaleString('en-PH', { maximumFractionDigits: 2 }); }
      case 'money': { const n = numberOrNull(v); return n == null ? MISSING : n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
      case 'pct': { const n = numberOrNull(v); return n == null ? MISSING : (Math.round(n * 10) / 10).toLocaleString('en-PH') + '%'; }
      case 'date': { if (v == null || v === '') return MISSING; return formatDate(v) || String(v); }
      case 'datetime': {
        if (v == null || v === '') return MISSING;
        const s = formatDateTime(v);
        /* a relative label ("10m ago") is meaningless once printed */
        return s || (/ago$|just now/i.test(String(v)) ? 'Not recorded' : String(v));
      }
      default: return (v == null || v === '') ? MISSING : String(v);
    }
  }

  /* ---------------------------------------------------------------- filenames */
  function slug(s, max) {
    return String(s == null ? '' : s)
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')    /* Niño → Nino */
      .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      .slice(0, max || 40).replace(/_+$/, '');
  }

  /* UniGuard_Incident_Summary_Lingayen_2026-10-28.pdf
     opts: { type, scope, from, to, date, ext, suffix } */
  function buildFilename(opts) {
    opts = opts || {};
    const parts = [SYSTEM, slug(opts.type || 'Export', 48)];
    if (opts.scope) parts.push(slug(opts.scope, 32));
    if (opts.suffix) parts.push(slug(opts.suffix, 24));
    if (opts.from || opts.to) {
      const a = opts.from ? isoDate(opts.from) || slug(opts.from, 10) : 'start';
      const b = opts.to ? isoDate(opts.to) || slug(opts.to, 10) : todayIso();
      parts.push(a === b ? a : a + '_to_' + b);
    } else {
      parts.push(opts.date ? (isoDate(opts.date) || slug(opts.date, 10)) : todayIso());
    }
    const ext = String(opts.ext || 'txt').replace(/[^a-z0-9]/gi, '').toLowerCase();
    let name = parts.filter(Boolean).join('_');
    if (name.length > 120) name = name.slice(0, 120).replace(/_+$/, '');
    return name + '.' + ext;
  }

  /* -------------------------------------------------------------- metadata */
  function session() {
    try { return (window.UG_App && window.UG_App.S && window.UG_App.S.session) || null; } catch (e) { return null; }
  }

  function roleLabel(s) {
    if (!s) return '';
    if (s.role === 'lgu_ldrrmc' && s.superAdmin) return 'Super Admin';
    try { return (UG_WEB.ROLE_INFO[s.role] || {}).label || s.role || ''; } catch (e) { return s.role || ''; }
  }

  /* display name and role only: never the email, phone or account id */
  function generatedBy() {
    const s = session();
    if (!s) return SYSTEM;
    const name = String(s.name || '').trim();
    const role = s.title || roleLabel(s);
    return [name, role].filter(Boolean).join(' \u00b7 ') || SYSTEM;
  }

  /* System-generated export identifier for traceability. It is NOT an
     official document or control number and is labelled as such. */
  function exportId(now) {
    const d = now || new Date();
    const p = ph(d);
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'EXP-' + p.y + pad(p.m + 1) + pad(p.d) + '-' + pad(p.h) + pad(p.mi) + pad(p.s) + '-' + rnd;
  }

  /* opts: { title, kind, module, scope, from, to, period, filters, count,
             countLabel, notices[], personalData, reference } */
  function buildMetadata(opts) {
    opts = opts || {};
    const now = new Date();
    const filters = Array.isArray(opts.filters) ? opts.filters.filter(Boolean)
      : (opts.filters ? [String(opts.filters)] : []);
    return {
      title: String(opts.title || 'Export'),
      kind: String(opts.kind || opts.title || 'Report'),
      module: String(opts.module || ''),
      scope: String(opts.scope || ''),
      from: opts.from || '', to: opts.to || '',
      period: opts.period != null ? String(opts.period) : periodLabel(opts.from, opts.to),
      filters: filters,
      count: (typeof opts.count === 'number') ? opts.count : null,
      countLabel: opts.countLabel || 'Records',
      exportId: exportId(now),
      reference: opts.reference || '',
      generatedAt: now,
      generatedAtText: formatDateTime(now, true),
      preparedBy: generatedBy(),
      notices: (opts.notices || []).filter(Boolean),
      personalData: !!opts.personalData,
      org: org()
    };
  }

  /* [label, value] pairs, in the order a reader looks for them */
  function metaPairs(meta) {
    const rows = [];
    if (meta.reference) rows.push(['Reference', meta.reference]);
    rows.push(['Export ID', meta.exportId + '  (system-generated, not an official document number)']);
    rows.push(['Generated', meta.generatedAtText]);
    rows.push(['Prepared by', meta.preparedBy]);
    if (meta.module) rows.push(['Source module', meta.module]);
    if (meta.period) rows.push(['Reporting period', meta.period]);
    if (meta.scope) rows.push(['Data scope', meta.scope]);
    rows.push(['Filters applied', meta.filters.length ? meta.filters.join('; ') : 'None (all records in scope)']);
    if (meta.count != null) rows.push([meta.countLabel, meta.count.toLocaleString('en-PH')]);
    return rows;
  }

  const PRIVACY_NOTICE = 'Contains personal information. Handle, share and dispose of this document in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).';

  /* ---------------------------------------------------------------------- CSV */
  /* A spreadsheet treats a cell that starts with = + - @ (or a tab / CR) as a
     formula. Text from users is prefixed with an apostrophe so it stays text.
     Real numbers are never touched. */
  function neutralizeFormula(s) {
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  }

  function csvValue(cell, colType) {
    const c = unwrap(cell, colType);
    const v = c.v;
    if (v == null || v === '') return '';
    if (isNumericType(c.t)) {
      const n = numberOrNull(v);
      if (n == null) return (typeof v === 'string' && v.trim()) ? neutralizeFormula(v) : '';
      return String(n);
    }
    if (c.t === 'date') return isoDate(v) || neutralizeFormula(String(v));
    if (c.t === 'datetime') return isoDateTime(v) || '';
    if (typeof v === 'number' && isFinite(v)) return String(v);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return neutralizeFormula(String(v));
  }

  function csvField(s) {
    s = String(s);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* columns: [{ label, type }]; rows: arrays in column order.
     UTF-8 with a byte-order mark (so Excel reads Filipino names correctly),
     CRLF line endings, one header row, no title or metadata rows. */
  function buildCsv(columns, rows) {
    const n = columns.length;
    const out = [columns.map((c) => csvField(c.label)).join(',')];
    (rows || []).forEach((r, i) => {
      if (!Array.isArray(r) || r.length !== n) throw new Error('Export row ' + (i + 1) + ' has ' + (r ? r.length : 0) + ' values; expected ' + n + '.');
      out.push(r.map((cell, j) => csvField(csvValue(cell, columns[j].type))).join(','));
    });
    return '\uFEFF' + out.join('\r\n') + '\r\n';
  }

  /* --------------------------------------------------------------- download */
  function download(blob, filename) {
    if (typeof UG_UTIL !== 'undefined' && UG_UTIL.downloadBlob) { UG_UTIL.downloadBlob(blob, filename); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function saveCsv(filename, columns, rows) {
    const text = buildCsv(columns, rows);
    download(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
    return { filename: filename, rows: rows.length };
  }

  /* -------------------------------------------------------- access control */
  /* Client-side check before an export is generated. The data an export uses
     was already read through row level security, so this cannot widen access;
     it stops an export being started from a screen or a console call the role
     should not use, and pins a barangay official to their own barangay.
       rule: { roles: [...], superAdmin: true, barangay: requestedName } */
  function validateScope(rule) {
    rule = rule || {};
    const s = session();
    if (!s) throw new Error('Sign in to export.');
    if (rule.superAdmin && !(s.role === 'lgu_ldrrmc' && s.superAdmin)) {
      throw new Error('Only the Super Admin can export this record.');
    }
    if (rule.roles && rule.roles.indexOf(s.role) === -1) {
      throw new Error('Your account cannot export this record.');
    }
    if (s.role === 'barangay_official' && rule.barangay && rule.barangay !== 'All' && rule.barangay !== s.barangay) {
      throw new Error('You can only export records for Barangay ' + (s.barangay || '') + '.');
    }
    return s;
  }

  /* ------------------------------------------------------------------- UX */
  const busy = {};
  function toast(m, t) {
    try { if (window.UG_App && window.UG_App.toast) { window.UG_App.toast(m, t); return; } } catch (e) { }
    if (typeof window.UG_TOAST === 'function') window.UG_TOAST(m, t);
  }

  /* run(key, fn, opts): one export of a kind at a time; fn returns
     { filename, rows } on success, or false/undefined when it already told
     the user why nothing was produced (empty data, etc.). The success toast
     only appears after the file was actually handed to the browser. */
  async function run(key, fn, opts) {
    opts = opts || {};
    if (busy[key]) { toast('That export is still being prepared', 'info'); return null; }
    busy[key] = true;
    const btns = (typeof document !== 'undefined') ? Array.prototype.slice.call(document.querySelectorAll('[data-act="' + key + '"]')) : [];
    btns.forEach((b) => { b.disabled = true; b.setAttribute('aria-busy', 'true'); b.classList.add('is-busy'); });
    if (opts.label) toast('Preparing ' + opts.label + '\u2026', 'info');
    /* let the busy state paint before the synchronous build starts */
    await new Promise((r) => setTimeout(r, 30));
    try {
      const res = await fn();
      if (res && res.filename) {
        toast((opts.label ? opts.label.charAt(0).toUpperCase() + opts.label.slice(1) : 'File') + ' saved \u00b7 ' +
          (typeof res.rows === 'number' ? res.rows.toLocaleString('en-PH') + ' record' + (res.rows === 1 ? '' : 's') + ' \u00b7 ' : '') + res.filename, 'prepared');
      }
      return res || null;
    } catch (e) {
      console.error('[UniGuard export]', e);
      const msg = (e && e.message) ? e.message : '';
      toast(msg && !(typeof UG_UTIL !== 'undefined' && UG_UTIL.looksTechnical(msg)) ? msg : 'The export could not be generated. Please try again.', 'warning');
      return null;
    } finally {
      busy[key] = false;
      btns.forEach((b) => { b.disabled = false; b.removeAttribute('aria-busy'); b.classList.remove('is-busy'); });
    }
  }

  /* --------------------------------------------------- shared vocabulary */
  function statusLabel(k) {
    try { return (UG_THEME.STATUS[k] || {}).label || k || ''; } catch (e) { return k || ''; }
  }
  function sevLabel(k) {
    try { return (UG_THEME.sev(k) || {}).label || k || ''; } catch (e) { return k || ''; }
  }
  const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    SYSTEM, SYSTEM_FULL, TZ_LABEL, TZ_LONG, MISSING, PRIVACY_NOTICE,
    org, toDate, formatDate, formatDateTime, isoDate, isoDateTime, excelSerial, todayIso, periodLabel,
    formatCell, isNumericType, numberOrNull, unwrap,
    buildFilename, buildMetadata, metaPairs, generatedBy, roleLabel, exportId,
    neutralizeFormula, csvValue, buildCsv, saveCsv, download,
    validateScope, run, statusLabel, sevLabel, titleCase, slug
  };
})();
