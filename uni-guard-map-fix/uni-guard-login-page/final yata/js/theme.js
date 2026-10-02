/* UniGuard · theme
 *
 * THE single source of truth for every colour that carries meaning in a hazard
 * report: severity, workflow status, shelter availability, advisory type and
 * hazard-type groups. Nothing else in the project may hard-code these colours.
 *
 *   - map markers, the map legend, list cards, badges, pipelines, charts and the
 *     LGU dashboard all read from here, so they can never drift apart;
 *   - this file also writes the matching CSS custom properties and badge classes
 *     into the page (see inject()), so the stylesheets only use var(--ug-...);
 *   - colour is never the only signal: every entry carries a text label, a shape
 *     and (for hazards) an icon, which the map, legend, lists and badges all use.
 *
 * Meaning
 *   red    = critical          orange = high          yellow = moderate
 *   green  = resolved          blue   = verified      violet = in progress
 *   slate  = pending           dark slate = rejected
 */
const UG_THEME = (function () {
  /* ------------------------------------------------------------------ palette */
  /* base : marker fill, chart bar, dot        text : readable on the dark UI
     Every "text" value is checked against the surface colour in tests/contrast. */
  const PALETTE = {
    red:    { base: '#EF4444', text: '#FCA5A5' },
    orange: { base: '#F97316', text: '#FDBA74' },
    yellow: { base: '#FACC15', text: '#FDE047' },
    green:  { base: '#22C55E', text: '#86EFAC' },
    blue:   { base: '#3B82F6', text: '#93C5FD' },
    violet: { base: '#8B5CF6', text: '#C4B5FD' },
    sky:    { base: '#38BDF8', text: '#7DD3FC' },
    teal:   { base: '#14B8A6', text: '#5EEAD4' },
    slate:  { base: '#94A3B8', text: '#CBD5E1' },
    stone:  { base: '#64748B', text: '#A8B5C7' }
  };

  const INK_DARK = '#0B1220';
  const INK_LIGHT = '#FFFFFF';
  const SURFACE = '#0C1524';        /* --ug-surface, what badge text sits on */

  /* ---------------------------------------------------------------- colour maths */
  function hexToRgb(hex) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function luminance(hex) {
    const c = hexToRgb(hex);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }
  /* the glyph or text that sits ON a filled marker: whichever reads better */
  function onColor(hex) {
    return contrast(hex, INK_DARK) >= contrast(hex, INK_LIGHT) ? INK_DARK : INK_LIGHT;
  }

  function entry(key, paletteName, extra) {
    const p = PALETTE[paletteName];
    return Object.assign({
      key: key,
      color: p.base,
      text: p.text,
      on: onColor(p.base),
      soft: rgba(p.base, 0.16),
      line: rgba(p.base, 0.4)
    }, extra || {});
  }

  /* ---------------------------------------------------------------- severity */
  /* Keys are the values stored in reports.severity. `label` is the report word,
     `advisoryLabel` is the word used on official advisories. `shape` is what the
     map marker looks like, so severity survives without colour. */
  const SEVERITY = {
    emergency: entry('emergency', 'red',    { label: 'Critical', advisoryLabel: 'Emergency', short: 'CRIT', level: 4, shape: 'octagon', hint: 'People at risk' }),
    warning:   entry('warning',   'orange', { label: 'High',     advisoryLabel: 'Warning',   short: 'HIGH', level: 3, shape: 'diamond', hint: 'Getting worse' }),
    advisory:  entry('advisory',  'yellow', { label: 'Moderate', advisoryLabel: 'Advisory',  short: 'MOD',  level: 2, shape: 'circle',  hint: 'Looks minor' })
  };
  /* advisories also carry a preparedness kind that is not a hazard severity */
  const PREPARED = entry('prepared', 'sky', { label: 'Preparedness', advisoryLabel: 'Preparedness', short: 'PREP', level: 1, shape: 'circle', hint: 'Be ready' });

  /* ------------------------------------------------------------------ status */
  /* Keys are the values stored in reports.status. The stored words did not change
     (so existing rows and the analytics views keep working); only the labels did:
       reported  -> Pending        dispatched -> In Progress        + rejected */
  const STATUS = {
    reported:   entry('reported',   'slate',  { label: 'Pending',     short: 'PEND', shape: 'circle', glyph: 'clock', note: 'Submitted by a resident' }),
    verified:   entry('verified',   'blue',   { label: 'Verified',    short: 'VER',  shape: 'circle', glyph: 'eye',   note: 'Confirmed by an official or by corroboration' }),
    dispatched: entry('dispatched', 'violet', { label: 'In Progress', short: 'PROG', shape: 'circle', glyph: 'truck', note: 'Responders are on it' }),
    resolved:   entry('resolved',   'green',  { label: 'Resolved',    short: 'DONE', shape: 'circle', glyph: 'check', note: 'Cleared and closed' }),
    rejected:   entry('rejected',   'stone',  { label: 'Rejected',    short: 'REJ',  shape: 'circle', glyph: 'x',     note: 'Not actionable or a duplicate' })
  };
  /* the four steps of the normal path, in order; rejected is a side exit */
  const STATUS_FLOW = ['reported', 'verified', 'dispatched', 'resolved'];

  /* ------------------------------------------------------- shelter availability */
  /* Shelters are a different kind of thing from hazards, so they get their own
     marker (a house in a rounded square) and never share the severity colours. */
  const SHELTER = {
    marker: entry('shelter', 'teal', { label: 'Evacuation center', shape: 'square', glyph: 'shelter' }),
    open:   entry('open',   'green',  { label: 'Open',   glyph: 'check' }),
    full:   entry('full',   'orange', { label: 'Full',   glyph: 'users' }),
    closed: entry('closed', 'stone',  { label: 'Closed', glyph: 'x' })
  };

  /* an assigned response unit on the map */
  const UNIT = entry('unit', 'sky', { label: 'Deployed unit', shape: 'diamond', glyph: 'truck' });

  /* -------------------------------------------------------- hazard type groups */
  /* Colours for the hazard TYPE chips and chart bars deliberately avoid red,
     orange, yellow and green, which are reserved for severity and resolution. */
  const TYPE_GROUP = {
    water:   entry('water',   'sky',   { label: 'Water' }),
    coastal: entry('coastal', 'teal',  { label: 'Coastal' }),
    wind:    entry('wind',    'violet', { label: 'Wind' }),
    earth:   entry('earth',   'stone', { label: 'Ground' }),
    fire:    entry('fire',    'slate', { label: 'Fire and power' }),
    infra:   entry('infra',   'blue',  { label: 'Roads and traffic' }),
    other:   entry('other',   'slate', { label: 'Other' })
  };

  /* brand colours that are not ours to change */
  const BRAND = { waze: '#33CCFF', wazeInk: '#062B36' };

  /* map look: a white ring keeps a marker readable on the light OSM tiles AND on
     the dark fallback map; the dark outline keeps it readable on pale tiles. */
  const MARKER = { ring: '#FFFFFF', outline: '#0B1220', shadow: 'rgba(11,18,32,.45)' };

  /* ---------------------------------------------------------------- lookups */
  const sev = (k) => SEVERITY[k] || SEVERITY.advisory;
  const status = (k) => STATUS[k] || STATUS.reported;

  /* the colour a report is drawn with on the map and in charts:
     resolved is green, rejected is muted, everything else is its severity */
  function reportColor(report) {
    if (!report) return SEVERITY.advisory;
    if (report.status === 'resolved') return STATUS.resolved;
    if (report.status === 'rejected') return STATUS.rejected;
    return sev(report.sev || report.severity);
  }

  /* one row per legend entry, in the order they should be drawn */
  function legendItems() {
    return [
      { group: 'Severity', key: 'emergency', label: SEVERITY.emergency.label, color: SEVERITY.emergency.color, shape: 'octagon', on: SEVERITY.emergency.on, note: SEVERITY.emergency.hint },
      { group: 'Severity', key: 'warning',   label: SEVERITY.warning.label,   color: SEVERITY.warning.color,   shape: 'diamond', on: SEVERITY.warning.on,   note: SEVERITY.warning.hint },
      { group: 'Severity', key: 'advisory',  label: SEVERITY.advisory.label,  color: SEVERITY.advisory.color,  shape: 'circle',  on: SEVERITY.advisory.on,  note: SEVERITY.advisory.hint },
      { group: 'Status',   key: 'resolved',  label: STATUS.resolved.label,    color: STATUS.resolved.color,    shape: 'circle',  on: STATUS.resolved.on,    glyph: 'check', note: 'Resolved report' },
      { group: 'Places',   key: 'shelter',   label: SHELTER.marker.label,     color: SHELTER.marker.color,     shape: 'square',  on: SHELTER.marker.on,     glyph: 'shelter' },
      { group: 'Places',   key: 'unit',      label: UNIT.label,               color: UNIT.color,               shape: 'diamond', on: UNIT.on,               glyph: 'truck' }
    ];
  }

  /* -------------------------------------------------------- CSS injection */
  function cssText() {
    const vars = [];
    const put = (name, v) => vars.push('--ug-' + name + ':' + v);

    Object.keys(SEVERITY).forEach((k) => {
      const e = SEVERITY[k];
      put('sev-' + k, e.color); put('sev-' + k + '-text', e.text); put('sev-' + k + '-on', e.on);
    });
    put('sev-prepared', PREPARED.color);
    Object.keys(STATUS).forEach((k) => {
      const e = STATUS[k];
      put('st-' + k, e.color); put('st-' + k + '-text', e.text); put('st-' + k + '-on', e.on);
    });
    ['open', 'full', 'closed'].forEach((k) => { put('shelter-' + k, SHELTER[k].color); put('shelter-' + k + '-text', SHELTER[k].text); });
    put('shelter', SHELTER.marker.color);
    put('unit', UNIT.color);
    Object.keys(TYPE_GROUP).forEach((k) => put('type-' + k, TYPE_GROUP[k].color));
    put('waze', BRAND.waze); put('waze-ink', BRAND.wazeInk);

    /* the older tone tokens still used by stat tiles, toasts and dots now resolve
       to the same theme values */
    put('emergency', SEVERITY.emergency.color);
    put('warning', SEVERITY.warning.color);
    put('advisory', SEVERITY.advisory.color);
    put('prepared', PREPARED.color);
    put('verified', STATUS.verified.color);
    put('dispatched', STATUS.dispatched.color);
    put('resolved', STATUS.resolved.color);
    put('neutral', STATUS.reported.color);

    const block = vars.join(';') + ';';

    /* badge classes: one rule per key, generated so they cannot disagree with the map */
    const badge = (cls, e) => '.ug-badge--' + cls + '{background:' + e.soft + ';color:' + e.text + ';border-color:' + e.line + '}';
    const rules = [];
    Object.keys(STATUS).forEach((k) => rules.push(badge(k, STATUS[k])));
    Object.keys(SEVERITY).forEach((k) => rules.push(badge(k, SEVERITY[k])));
    rules.push(badge('prepared', PREPARED));
    ['open', 'full', 'closed'].forEach((k) => rules.push(badge(k, SHELTER[k])));
    /* report-word variants (Critical / High / Moderate) share the severity colours */
    rules.push(badge('sev-critical', SEVERITY.emergency), badge('sev-high', SEVERITY.warning), badge('sev-moderate', SEVERITY.advisory));

    /* pipeline step colours */
    Object.keys(STATUS).forEach((k) => rules.push('.ug-step.s-' + k + '{color:' + STATUS[k].text + '}'));

    /* legend swatches and marker chips share these classes */
    return ':root{' + block + '}\n.ug{' + block + '}\n' + rules.join('\n');
  }

  function inject() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('ug-theme');
    if (!el) {
      el = document.createElement('style');
      el.id = 'ug-theme';
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = cssText();
  }
  inject();

  return {
    PALETTE, SEVERITY, PREPARED, STATUS, STATUS_FLOW, SHELTER, UNIT, TYPE_GROUP, BRAND, MARKER,
    INK_DARK, INK_LIGHT, SURFACE,
    sev, status, reportColor, legendItems,
    hexToRgb, luminance, contrast, rgba, onColor,
    cssText, inject
  };
})();
