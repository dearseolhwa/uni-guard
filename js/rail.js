/* UniGuard · the one sidebar every portal uses (css/rail.css)
 *
 * Resident, barangay official, LDRRMO, Super Admin and dispatch all draw their
 * desktop navigation with UG_RAIL.html(), so the sidebar looks and behaves the
 * same everywhere; only the role's colour changes (opts.theme).
 *
 * Behaviour, the same for every role:
 *  · Closed it is a rail of icons. Resting the pointer on it, or tabbing into
 *    it with the keyboard, opens it and pushes the page aside.
 *  · The pin button keeps it open beside the page. The choice is remembered on
 *    this device and applies to every portal.
 *  · Picking a section closes a hovered rail at once; it stays closed until
 *    the pointer has really moved off it, then opens again when it comes back.
 *  · From 768px up. Phones keep each portal's bottom bar and menu drawer.
 *
 * The app redraws the whole screen on every change, so whether the pointer is
 * over the rail is tracked here and drawn back in (is-hover), which keeps an
 * open rail open through live data refreshes.
 */
const UG_RAIL = (() => {
  const esc = (s) => UG_UTIL.esc(s);
  const PIN_KEY = 'uniguard.rail.pinned';

  let hover = false;   /* pointer is over the rail */
  let shut = false;    /* a section was just picked: stay closed until the pointer leaves */

  function pinned() {
    try { return localStorage.getItem(PIN_KEY) === '1'; } catch (e) { return false; }
  }

  function setPinned(on) {
    try { localStorage.setItem(PIN_KEY, on ? '1' : '0'); } catch (e) { }
    document.querySelectorAll('.ug-rail').forEach((r) => {
      r.classList.toggle('is-pinned', on);
      r.classList.remove('is-shut');
      const b = r.querySelector('.ugr-pin');
      if (b) {
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        const label = on ? 'Let the sidebar close' : 'Keep the sidebar open';
        b.setAttribute('aria-label', label);
        b.setAttribute('title', label);
      }
    });
    shut = false;
  }

  /* pointer tracking (one set of listeners for every portal).
     Only real pointer movement counts: the app redraws the whole screen after
     a click, and the browser then reports the pointer "leaving" and
     "entering" the new rail although it never moved. Trusting those events
     made a picked rail close and spring open again under a still mouse.
     The rail opens only through is-hover (no CSS :hover), after a short
     pause so sweeping across it does not push the page around. */
  const OPEN_DELAY = 140;
  let openTimer = 0;
  function leave() {
    clearTimeout(openTimer); openTimer = 0;
    hover = false;
    shut = false;
    document.querySelectorAll('.ug-rail').forEach((x) => x.classList.remove('is-hover', 'is-shut'));
  }
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = e.target.closest && e.target.closest('.ug-rail');
    if (!r) { if (hover || shut || openTimer) leave(); return; }
    /* a section was just picked: stay closed until the pointer really leaves */
    if (hover || shut || openTimer) return;
    openTimer = setTimeout(() => {
      openTimer = 0;
      hover = true;
      document.querySelectorAll('.ug-rail').forEach((x) => x.classList.add('is-hover'));
    }, OPEN_DELAY);
  }, { passive: true });
  /* the pointer left the window altogether */
  document.documentElement.addEventListener('mouseleave', () => { if (hover || shut || openTimer) leave(); });
  /* picking a section closes the hovered rail (the pin button does not) */
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.ug-rail button');
    if (!b || b.classList.contains('ugr-pin')) return;
    const r = b.closest('.ug-rail');
    if (r.classList.contains('is-pinned')) return;
    clearTimeout(openTimer); openTimer = 0;
    shut = true;
    hover = false;
    r.classList.add('is-shut');
    r.classList.remove('is-hover');
    try { b.blur(); } catch (err) { }
  }, true);

  const ICON = {
    pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z"/><path d="M12 14v6"/></svg>',
    logout: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M14 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8"/><path d="M17 9l3 3-3 3M20 12h-8"/></svg>'
  };

  /* one row: { attrs, icon, label, on, count, alert } */
  function item(it, cls) {
    const n = Number(it.count) || 0;
    const badge = n ? '<span class="ugr-count' + (it.alert ? ' is-alert' : '') + '">' + (n > 99 ? '99+' : n) + '</span>' : '';
    return '<button type="button" class="ugr-i' + (cls ? ' ' + cls : '') + (it.on ? ' is-on' : '') + '"' + (it.attrs || '') +
      (it.on ? ' aria-current="page"' : '') + ' title="' + esc(it.label) + '" aria-label="' + esc(it.label + (n ? ', ' + n : '')) + '">' +
      '<span class="ugr-ico">' + it.icon + '</span><span class="ugr-lbl">' + esc(it.label) + '</span>' + badge + '</button>';
  }

  /* opts: { theme, id, label, brand: { attrs, label, sub }, groups: [{ title, items }],
             tools: [items], user: { initial, name, sub }, signout: attrs } */
  function html(opts) {
    const pin = pinned();
    const cls = 'ug-rail ug-rail--' + opts.theme + (pin ? ' is-pinned' : '') +
      (hover && !pin ? ' is-hover' : '') + (shut && !pin ? ' is-shut' : '');
    const u = opts.user || {};
    const pinLabel = pin ? 'Let the sidebar close' : 'Keep the sidebar open';
    return '<aside class="' + cls + '" aria-label="' + esc(opts.label || 'Sections') + '">' +
      '<div class="ugr-panel">' +
        '<div class="ugr-head">' +
          '<button type="button" class="ugr-brand"' + (opts.brand.attrs || '') + ' aria-label="' + esc(opts.brand.label) + '" title="' + esc(opts.brand.label) + '">' +
            '<span class="ugr-mark">' + UG.brandMark(34) + '</span>' +
            '<span class="ugr-lbl ugr-word"><b>Uni<em>Guard</em></b>' + (opts.brand.sub ? '<small>' + esc(opts.brand.sub) + '</small>' : '') + '</span>' +
          '</button>' +
          '<button type="button" class="ugr-pin" data-act="rail-pin" aria-pressed="' + pin + '" aria-label="' + pinLabel + '" title="' + pinLabel + '">' + ICON.pin + '</button>' +
        '</div>' +
        '<nav class="ugr-nav"' + (opts.id ? ' id="' + esc(opts.id) + '"' : '') + ' aria-label="' + esc(opts.label || 'Sections') + '">' +
          opts.groups.filter((g) => g.items.length).map((g, i) =>
            (g.title ? '<p class="ugr-g' + (i ? '' : ' is-first') + '"><span>' + esc(g.title) + '</span></p>'
              : g.divider ? '<hr class="ugr-div" aria-hidden="true">' : '') +
            g.items.map((it) => item(it)).join('')).join('') +
        '</nav>' +
        '<div class="ugr-foot">' +
          (opts.tools || []).map((it) => item(it, 'ugr-tool')).join('') +
          /* the profile and Sign out live in each portal's header menu; only a
             portal without one (dispatch) asks for them here (opts.account) */
          (opts.account ? '<div class="ugr-me" title="' + esc((u.name || '') + (u.sub ? ' · ' + u.sub : '')) + '">' +
            '<span class="ugr-av">' + esc(u.initial || '?') + '</span>' +
            '<span class="ugr-lbl"><b>' + esc(u.name || '') + '</b>' + (u.sub ? '<small>' + esc(u.sub) + '</small>' : '') + '</span></div>' +
          item({ attrs: opts.signout || ' data-act="logout"', icon: ICON.logout, label: 'Sign out' }, 'ugr-out') : '') +
        '</div>' +
      '</div>' +
    '</aside>';
  }

  /* the first letter of a name, for the avatar */
  const initial = (name, fallback) => (String(name || fallback || '?').trim().charAt(0) || '?').toUpperCase();

  return { html, pinned, setPinned, initial };
})();
window.UG_RAIL = UG_RAIL;
