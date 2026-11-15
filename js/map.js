/* UniGuard · live operations map
 *
 * Leaflet with OpenStreetMap tiles (Esri World Street tiles), centred on
 * Lingayen, Pangasinan (js/geo.js). When Leaflet has not loaded (offline, or a
 * blocked CDN) the screen falls back to the built-in SVG tactical map so the
 * console never shows an empty panel.
 *
 * Every colour drawn here comes from js/theme.js — the map, the legend, the
 * list cards and the LGU dashboard all read the same values, so they can never
 * disagree. Severity markers also carry a shape and a short text label
 * (CRIT/HIGH/MOD), so colour is never the only way to tell them apart.
 *
 * MAP FIX (hazard map alignment pass)
 *  · Every point is checked with UG_GEO.classify() before it is drawn. Missing,
 *    malformed, swapped or (0,0) coordinates are skipped and counted; the count
 *    surfaces as a small strip on the map so bad records get corrected instead
 *    of silently piling up on the town centre.
 *  · Overlapping markers are grouped into a cluster bubble at the position they
 *    actually share. Nothing is ever offset from its real coordinate: clicking
 *    a bubble either zooms to the group or spiderfies it — the members are then
 *    drawn on leader lines around the true point, and each member keeps its own
 *    real coordinates in its popup.
 *  · The dedicated map screens fit the view to the valid records once on mount
 *    (capped at a readable overview zoom); pan/zoom is never re-fitted while
 *    the user is working — layer toggles and data refreshes redraw in place.
 *  · A ResizeObserver keeps the Leaflet canvas in sync when the console drawer
 *    pins/unpins or the device rotates (the old code only checked twice).
 */
const MapView = (function () {
  let ctx = null;                 /* { map, layers, container, fallback, ... } */

  /* cluster / spider tuning */
  const CLUSTER_PX = 30;          /* markers closer than this at the current zoom group up */
  const SPIDER_ZOOM = 16;         /* zoom at/above which a mixed cluster spiderfies instead of zooming */
  const FIT_MAX_ZOOM = 14;        /* fit-to-records never zooms past a readable overview */
  const SPIDER_BASE_R = 26;       /* spiderfy ring radius, px */

  function leafletReady(timeoutMs) {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.L) return resolve(true);
      const started = Date.now();
      const t = setInterval(() => {
        if (window.L) { clearInterval(t); resolve(true); }
        else if (Date.now() - started > (timeoutMs || 4000)) { clearInterval(t); resolve(false); }
      }, 120);
    });
  }

  function destroy() {
    if (ctx) {
      if (ctx.resizeObserver) { try { ctx.resizeObserver.disconnect(); } catch (e) {} }
      /* stop any pan/zoom animation first: removing a map mid-animation
         makes Leaflet's next frame read a pane that is gone (_leaflet_pos) */
      if (ctx.map) {
        /* a zoom animation still running ends on a timer that reads the
           removed panes; make that late callback a no-op on this map */
        try { ctx.map.stop(); ctx.map.off(); } catch (e) {}
        try { ctx.map.remove(); } catch (e) {}
      }
    }
    ctx = null;
  }

  /* true when ctx is the live Leaflet map mounted on this exact container */
  function owns(el) {
    return !!(ctx && !ctx.fallback && ctx.map && el && ctx.container === el);
  }

  /* a small divIcon: filled shape, white ring, and a 3-4 letter label so the
     marker still reads correctly in greyscale or for a colourblind viewer */
  function shapeIcon(entry, sizePx) {
    const L = window.L;
    const size = sizePx || 24;
    const label = entry.short || '';
    return L.divIcon({
      className: '',
      html: '<div class="ug-marker shape-' + entry.shape + '" style="width:' + size + 'px;height:' + size + 'px;' +
        'background:' + entry.color + ';color:' + entry.on + '">' + UG_UTIL.esc(label) + '</div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  }

  /* ------------------------------------------------------------- map pins
     The markers of the React build (uniguard/src/components/ResidentHazard-
     MapView.tsx): a coloured teardrop pointing at the spot with a white
     symbol in it, every kind with its own symbol, and hazards sized by danger
     so the level never depends on colour alone. Lucide paths, 24×24, stroked. */
  const PIN_ICON = {
    hazard: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    shelter: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    relief: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/>',
    closed: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    caution: '<rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/><path d="m8 6 8 8"/>',
    open: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    unit: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'
  };
  /* the plain-language words and colours for every kind of marker */
  const PIN_LEVEL = {
    emergency: { word: 'High', color: '#B91C1C', meaning: 'Dangerous. Stay away from this area.', size: 30 },
    warning: { word: 'Medium', color: '#C2410C', meaning: 'Be careful. Avoid this area if you can.', size: 26 },
    advisory: { word: 'Low', color: '#A16207', meaning: 'Be alert when you pass by.', size: 22 }
  };
  const PIN_SHELTER = {
    open: { word: 'Open', color: '#15803D', meaning: 'You can go here now.' },
    full: { word: 'Full', color: '#B45309', meaning: 'No space left. Please go to another shelter.' },
    closed: { word: 'Closed', color: '#525252', meaning: 'Not open right now.' }
  };
  /* road_status.status (migration 031): passable, one_lane, blocked,
     under_repair; caution is the pre-031 value still found in old rows */
  const PIN_ROAD = {
    blocked: { word: 'Road closed', icon: 'closed', color: '#B91C1C', meaning: 'You cannot pass. Take another road.' },
    one_lane: { word: 'One lane', icon: 'caution', color: '#B45309', meaning: 'Only one lane is open. Expect delays.' },
    under_repair: { word: 'Under repair', icon: 'caution', color: '#B45309', meaning: 'Road work ongoing. Drive carefully.' },
    caution: { word: 'Use caution', icon: 'caution', color: '#B45309', meaning: 'Drive carefully through this area.' },
    passable: { word: 'Passable', icon: 'open', color: '#15803D', meaning: 'The road is open.' }
  };
  const PIN_RELIEF = '#6D28D9';
  /* the resident map draws every pin at the same sizes as the legend
     ("What the markers mean"): hazards by level, everything else 26 px */
  const PIN_SIZE = 26;
  const PIN_UNIT = '#1D4ED8';
  const PIN_RESOLVED = '#737373';
  const REPORT_STATUS = {
    reported: 'Reported by a resident, not yet confirmed', verified: 'Confirmed by officials',
    dispatched: 'Help is on the way', resolved: 'Already resolved', rejected: 'Not confirmed'
  };

  function pinHtml(iconKey, bg, size) {
    size = size || 32;
    /* border and symbol size are set inline so a stale stylesheet can never
       bring back the white ring or a large symbol */
    return '<div class="ug-pin" style="width:' + size + 'px;height:' + size + 'px;background:' + bg + ';border:0">' +
      '<svg width="' + Math.round(size * 0.42) + '" height="' + Math.round(size * 0.42) + '" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      (PIN_ICON[iconKey] || PIN_ICON.hazard) + '</svg></div>';
  }
  /* the symbol alone in its colour, for text lists beside the map */
  function pinGlyph(iconKey, color, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (PIN_ICON[iconKey] || PIN_ICON.hazard) + '</svg>';
  }
  function pinIcon(iconKey, bg, size) {
    size = size || 32;
    return window.L.divIcon({
      className: 'ug-pin-wrap',
      html: pinHtml(iconKey, bg, size),
      iconSize: [size, size],
      iconAnchor: [size / 2, Math.round(size * 1.2)],   /* the tip of the pin */
      popupAnchor: [0, -Math.round(size * 1.1)]
    });
  }

  /* a popup in plain words: the name, a coloured label, one sentence on what
     to do, short facts with icons, then the buttons */
  const FACT_ICON = {
    place: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    check: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    time: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    note: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>'
  };
  function pinPopup(p) {
    const esc = UG_UTIL.esc;
    const facts = (p.facts || []).filter((f) => f[1]);
    return '<div class="ug-pop">' +
      '<div class="ug-pop-t">' + esc(p.title) + '</div>' +
      '<div class="ug-pop-tag" style="color:' + p.color + '"><i style="background:' + p.color + '"></i>' + esc(p.tag) + '</div>' +
      (p.advice ? '<div class="ug-pop-a">' + esc(p.advice) + '</div>' : '') +
      (facts.length ? '<div class="ug-pop-f">' + facts.map((f) =>
        '<div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        FACT_ICON[f[0]] + '</svg><span>' + esc(f[1]) + '</span></div>').join('') + '</div>' : '') +
      (p.extra || '') +
      (p.act ? '<button type="button" class="ug-pop-btn"' + Object.keys(p.act).map((k) => ' data-' + k + '="' + esc(p.act[k]) + '"').join('') + '>' + esc(p.actLabel || 'View details') + '</button>' : '') +
    '</div>';
  }
  /* "5 minutes ago": easier to read than "20h 49m ago" */
  function ago(iso) {
    const ms = iso ? Date.now() - Date.parse(iso) : NaN;
    if (!isFinite(ms)) return '';
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min === 1 ? '1 minute ago' : min + ' minutes ago';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr === 1 ? '1 hour ago' : hr + ' hours ago';
    const day = Math.floor(hr / 24);
    if (day < 30) return day === 1 ? 'yesterday' : day + ' days ago';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  /* the resident portal reads the popup and taps its button; the consoles keep
     opening the incident straight from the marker */
  const residentMap = () => document.documentElement.getAttribute('data-portal') === 'resident';

  function wazeButtonHtml(lat, lng, label) {
    const state = UG_GEO.classify(lat, lng);
    if (state !== 'ok') {
      return '<div class="ug-help" style="margin-top:6px">' + UG_UTIL.esc(UG_GEO.message(state) || 'Navigation is unavailable for this location.') + '</div>';
    }
    const href = UG_GEO.wazeUrl(lat, lng);
    return '<a class="ug-waze-btn" href="' + href + '" target="_blank" rel="noopener noreferrer">' +
      (UG.icon ? UG.icon('route', 13) : '') + ' Navigate with ' + UG_UTIL.esc(label || 'Waze') + '</a>';
  }

  /* the Lingayen service box every operational map is clamped to */
  function serviceBounds() {
    const B = UG_GEO.MAP_BOUNDS;
    return window.L.latLngBounds([B.minLat, B.minLng], [B.maxLat, B.maxLng]);
  }
  const hasPoint = (p) => !!(p && typeof p.lat === 'number' && typeof p.lng === 'number' && isFinite(p.lat) && isFinite(p.lng));

  /* ------------------------------------------------- coordinate validation gate
     One gate for every overlay category. Returns 'ok' for a point we will draw;
     anything else is skipped and counted so the screen can say which records
     need fixing. `unbounded` maps (an SOS from a neighbouring town) still draw
     points that are merely outside Lingayen — only truly broken ones are
     skipped there. */
  function coordState(lat, lng, unbounded) {
    const state = UG_GEO.classify(lat, lng);
    if (state === 'ok') return 'ok';
    if (unbounded && state === 'outside') return 'ok';   /* reachable on an unclamped map */
    return state;
  }

  /* container must have an explicit height. opts.unbounded skips the Lingayen
     clamp, for detail maps that show one stored point which may lie outside
     the area (an SOS sent from a neighbouring town). */
  async function mount(container, opts) {
    opts = opts || {};
    destroy();
    if (!container) return null;

    const ok = await leafletReady(opts.timeout);
    if (!ok) {
      container.innerHTML = '<div style="width:100%;height:100%">' + UG.mapSVG({ animated: false }) + UG.mapLegend() + '</div>';
      ctx = { fallback: true, container: container };
      return ctx;
    }

    const L = window.L;
    /* Leaflet 1.9 ends a zoom animation on a 250 ms timer that it never
       cancels; when a re-render removes the map first, that timer reads the
       removed panes and throws (_leaflet_pos). Skip it on removed maps. */
    if (!L.Map.prototype._ugZoomEndSafe) {
      const end = L.Map.prototype._onZoomTransitionEnd;
      L.Map.prototype._onZoomTransitionEnd = function () { if (this._mapPane) end.apply(this, arguments); };
      L.Map.prototype._ugZoomEndSafe = true;
      /* the same for a canvas redraw queued just before the map went away */
      if (L.Canvas) {
        const redraw = L.Canvas.prototype._redraw;
        L.Canvas.prototype._redraw = function () { if (!this._ctx) { this._redrawRequest = null; return; } redraw.apply(this, arguments); };
      }
    }
    container.innerHTML = '';

    /* if a report pin is given, start the map on the pin instead of the town
       centre — unless the pin lies outside the service box, where the clamped
       map could never show it (setReportPin then moves it into Lingayen) */
    const pin = opts.reportPin;
    const pinInside = hasPoint(pin) && serviceBounds().contains([pin.lat, pin.lng]);
    const startCenter = opts.center || (pinInside ? [pin.lat, pin.lng] : UG_GEO.CENTER);

    const mapOpts = {
      center: startCenter,
      zoom: opts.zoom || UG_GEO.ZOOM,
      maxZoom: UG_GEO.MAP_MAX_ZOOM,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true
    };
    if (!opts.unbounded) {
      /* keep the operational map scoped to Lingayen and its immediate
         neighbours (Labrador, Binmaley, Bugallon). maxBoundsViscosity=1
         stops the user from dragging the view outside the box, so the map
         can never zoom/pan out to a country-wide view. */
      mapOpts.minZoom = UG_GEO.MAP_MIN_ZOOM;
      mapOpts.maxBounds = serviceBounds();
      mapOpts.maxBoundsViscosity = 1.0;
    }
    const map = L.map(container, mapOpts);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors, and the GIS User Community'
    }).addTo(map);

    /* visible zoom buttons: scroll-wheel / pinch zoom existed but desktop and
       tablet users had no on-map control to zoom with */
    try { L.control.zoom({ position: 'bottomleft' }).addTo(map); } catch (e) {}

    ctx = {
      map: map,
      layer: L.layerGroup().addTo(map),          /* cluster bubbles + spider markers (markers live here) */
      circleLayer: L.layerGroup().addTo(map),    /* hazard perimeters, follows the hazards toggle */
      container: container,
      fallback: false,
      unbounded: !!opts.unbounded,
      fit: !!opts.fit,
      data: { incidents: [], centers: [], relief: [], roadStatus: [], units: [] },
      visible: { hazards: true, relief: true, centers: true, roadStatus: true },
      spider: null,                              /* { anchorLatLng, members: [...] } while open */
      skipped: {}
    };

    addLocateControl(map);
    /* the spider lives in map space, so panning (including a popup's
       auto-pan) keeps it valid; a zoom changes the pixel geometry, and a
       click on the empty map means "put it back". */
    ['zoomstart', 'resize'].forEach((ev) => {
      map.on(ev, () => { if (ctx && ctx.spider) closeSpider(true); });
    });
    map.on('click', () => { if (ctx && ctx.spider) closeSpider(); });
    /* clusters are pixel-distance groups: they are only meaningful at the zoom
       they were computed for. Recompute whenever the view settles (the initial
       fit-to-records changes the zoom right after mount, and every user zoom
       or pan can pull a group apart or push one together). Panning never
       changes container-point distances, and while a spider is open the drawn
       geometry is the spider's, not the clusters' — so both cases skip. */
    ['zoomend', 'moveend'].forEach((ev) => {
      map.on(ev, () => { if (ctx && !ctx.spider && !ctx._redrawing) redraw(); });
    });
    if (opts.incidents) setIncidents(opts.incidents);
    if (opts.centers) setCenters(opts.centers);
    if (opts.relief) setRelief(opts.relief);
    if (opts.roadStatus) setRoadStatus(opts.roadStatus);
    if (opts.units) setUnits(opts.units);
    if (opts.layers) setLayers(opts.layers);
    if (opts.reportPin) setReportPin(opts.reportPin, opts.onPinDrop, opts.onPinOutside);

    /* keep the canvas in sync with the container: drawer pin/unpin, rotation,
       devtools open — the old double setTimeout missed all of these */
    if (typeof ResizeObserver !== 'undefined') {
      try {
        ctx.resizeObserver = new ResizeObserver(() => {
          if (!ctx || !ctx.map) return;
          try { ctx.map.invalidateSize({ animate: false }); } catch (e) {}
        });
        ctx.resizeObserver.observe(container);
      } catch (e) {}
    }
    map.on('popupopen', (e) => {
      const el = e.popup && e.popup.getElement && e.popup.getElement();
      if (!el) return;
      el.querySelectorAll('.ug-pop-btn[data-act]').forEach((b) => {
        b.onclick = () => {
          const d = Object.assign({}, b.dataset);
          try { map.closePopup(); } catch (err) {}
          document.dispatchEvent(new CustomEvent('ug:map-action', { detail: d }));
        };
      });
    });
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 100);
    setTimeout(() => { try { map.invalidateSize(); fitOnce(); } catch (e) {} }, 400);
    /* phones settle their layout later (address bar, fonts): one more pass */
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 1200);
    return ctx;
  }

  /* one-time fit to the valid records (dedicated map screens). Runs after the
     first invalidateSize so the container has its real size; never runs again
     while the user pans/zooms. */
  function fitOnce() {
    if (!ctx || ctx.fallback || !ctx.fit || ctx.fitDone) return;
    ctx.fitDone = true;
    const pts = collectItems().map((it) => it.ll);
    if (!pts.length) return;
    const L = window.L;
    try {
      if (pts.length === 1) { ctx.map.setView(pts[0], Math.min(15, UG_GEO.MAP_MAX_ZOOM)); return; }
      const b = L.latLngBounds(pts);
      const target = ctx.map.getBoundsZoom(b, false, [40, 40]);
      ctx.map.fitBounds(b, { padding: [40, 40], maxZoom: Math.min(FIT_MAX_ZOOM, target) });
    } catch (e) {}
  }

  /* ---------------------------------------------------------- item collection
     Flattens the visible categories into drawable items and counts every
     record skipped by the coordinate gate. */
  function collectItems() {
    const d = ctx.data, unbounded = ctx.unbounded;
    const items = [];
    const skipped = {};
    const push = (cat, ll, item) => items.push({ cat: cat, ll: ll, item: item });

    (d.incidents || []).forEach((i) => {
      if (ctx.visible.hazards === false) return;
      const st = coordState(i.lat, i.lng, unbounded);
      if (st !== 'ok') { skipped[st] = (skipped[st] || 0) + 1; return; }
      push('hazards', [i.lat, i.lng], i);
    });
    (d.centers || []).forEach((c) => {
      if (ctx.visible.centers === false) return;
      const st = coordState(c.lat, c.lng, unbounded);
      if (st !== 'ok') { skipped[st] = (skipped[st] || 0) + 1; return; }
      push('centers', [c.lat, c.lng], c);
    });
    (d.relief || []).forEach((r) => {
      if (ctx.visible.relief === false) return;
      if (!r.active && r.active !== undefined) return;
      const st = coordState(r.lat, r.lng, unbounded);
      if (st !== 'ok') { skipped[st] = (skipped[st] || 0) + 1; return; }
      push('relief', [r.lat, r.lng], r);
    });
    /* responding teams at their last GPS fix (migration 057); shown with
       the hazards they are going to */
    (d.units || []).forEach((u) => {
      if (ctx.visible.hazards === false) return;
      if (coordState(u.lat, u.lng, true) !== 'ok') return;
      push('units', [u.lat, u.lng], u);
    });
    (d.roadStatus || []).forEach((r) => {
      if (ctx.visible.roadStatus === false) return;
      const st = coordState(r.lat, r.lng, unbounded);
      if (st !== 'ok') { skipped[st] = (skipped[st] || 0) + 1; return; }
      push('roadStatus', [r.lat, r.lng], r);
    });

    ctx.skipped = skipped;
    return items;
  }

  /* per-category marker styling + popup, in one place so clusters, spider
     members and single markers all look and behave the same */
  /* staff maps (barangay, LGU, dispatch, super admin) use the React
     consoles' markers: a red dot per open report (pulsing when an
     emergency), EVAC / REL tags, a ring per road point and a dark unit tag */
  const STAFF_ROAD = { blocked: '#DC2626', one_lane: '#F59E0B', under_repair: '#F59E0B', caution: '#F59E0B', passable: '#00BCD4' };
  const STAFF_SHELTER = { open: '#16A34A', full: '#EA580C', closed: '#475569' };
  function staffIcon(html, w, h) {
    return window.L.divIcon({ className: 'ug-sm-wrap', html: html, iconSize: [w, h], iconAnchor: [w / 2, h / 2], popupAnchor: [0, -h / 2 - 2] });
  }
  function staffEntry(cat, item) {
    const portal = document.documentElement.getAttribute('data-portal');
    if (cat === 'hazards') {
      if (item.status === 'resolved') return { icon: staffIcon('<span class="ug-sm-dot is-done"></span>', 28, 28), z: 0 };
      const hot = item.sev === 'emergency';
      const tone = hot ? '#DC2626' : item.sev === 'warning' ? '#EA580C' : '#D97706';
      return { icon: staffIcon((hot ? '<span class="ug-sm-ping"></span>' : '') + '<span class="ug-sm-dot" style="background:' + tone + '"></span>', 28, 28), z: hot ? 600 : 500 };
    }
    if (cat === 'centers') {
      return { icon: staffIcon('<span class="ug-sm-tag" style="background:' + (STAFF_SHELTER[item.status] || STAFF_SHELTER.closed) + '">EVAC</span>', 44, 22), z: 100 };
    }
    if (cat === 'relief') {
      return { icon: staffIcon('<span class="ug-sm-tag" style="background:' + (portal === 'barangay' ? '#052659' : '#8B5CF6') + '">REL</span>', 40, 22), z: 100 };
    }
    if (cat === 'units') {
      const team = String(item.team || 'Unit');
      const label = team === 'Barangay Response Team' ? 'BRT' : team.length > 12 ? team.split(/\s+/).map((w) => w.charAt(0)).join('').toUpperCase() : team;
      return { icon: staffIcon('<span class="ug-sm-tag ug-sm-unit">' + UG_UTIL.esc(label) + (item.code ? ' · ' + UG_UTIL.esc(item.code) : '') + '</span>', 96, 20), z: 700 };
    }
    return { icon: staffIcon('<span class="ug-sm-ring" style="border-color:' + (STAFF_ROAD[item.status] || STAFF_ROAD.under_repair) + '"></span>', 22, 22), z: 200 };
  }

  /* phones: the staff consoles use the resident portal's pins too (one
     symbol per kind, colour by level), which read better on a small screen
     than the console's EVAC / REL tags and dots */
  const pinMarkers = () => residentMap() || (typeof window !== 'undefined' && window.innerWidth <= 767);
  function markerEntry(cat, item) {
    if (!pinMarkers()) return staffEntry(cat, item);
    if (cat === 'hazards') {
      if (item.status === 'resolved') return { icon: pinIcon('hazard', PIN_RESOLVED, 22), z: 0 };
      const lv = PIN_LEVEL[item.sev] || PIN_LEVEL.advisory;
      return { icon: pinIcon('hazard', lv.color, lv.size), z: 500 };
    }
    if (cat === 'centers') {
      const st = PIN_SHELTER[item.status] || PIN_SHELTER.closed;
      return { icon: pinIcon('shelter', st.color, PIN_SIZE), z: 100 };
    }
    if (cat === 'relief') return { icon: pinIcon('relief', PIN_RELIEF, PIN_SIZE), z: 100 };
    if (cat === 'units') return { icon: pinIcon('unit', PIN_UNIT, PIN_SIZE), z: 700 };
    /* roadStatus */
    const rd = PIN_ROAD[item.status] || PIN_ROAD.under_repair;
    return { icon: pinIcon(rd.icon, rd.color, PIN_SIZE), z: 200 };
  }

  function bindItemPopup(marker, cat, item) {
    const brgy = (n) => n ? 'Barangay ' + n : '';
    if (cat === 'hazards') {
      const lv = item.status === 'resolved' ? { word: 'Resolved', color: PIN_RESOLVED, meaning: 'This hazard has been cleared.' }
        : (PIN_LEVEL[item.sev] || PIN_LEVEL.advisory);
      marker.bindPopup(pinPopup({
        title: item.hazard,
        tag: item.status === 'resolved' ? 'Resolved' : lv.word + ' danger',
        color: lv.color,
        advice: lv.meaning,
        facts: [['place', brgy(item.brgy)],
          ['check', REPORT_STATUS[item.status] || String(item.status || '').replace(/_/g, ' ')],
          ['time', item.created_at ? 'Reported ' + ago(item.created_at) : ''],
          ['people', UG_UTIL.corroborationLabel ? UG_UTIL.corroborationLabel(item.corr) : ''],
          ['note', item.mine ? 'Your report · ' + item.id : (residentMap() ? '' : item.id)]],
        act: { act: 'open-incident', id: item.uuid || item.id },
        actLabel: item.mine ? 'View my report' : 'View details'
      }));
      if (!residentMap()) {
        marker.on('click', () => {
          document.dispatchEvent(new CustomEvent('ug:open-incident', { detail: { id: item.uuid || item.id } }));
        });
      }
      marker.options.title = item.hazard + ' — ' + item.brgy;
    } else if (cat === 'centers') {
      const st = PIN_SHELTER[item.status] || PIN_SHELTER.closed;
      const space = Math.max(0, (item.cap || 0) - (item.occ || 0)) + ' of ' + (item.cap || 0) + ' spaces left';
      marker.bindPopup(pinPopup({
        title: item.name, tag: 'Shelter ' + st.word.toLowerCase(), color: st.color, advice: st.meaning,
        facts: [['people', item.status === 'closed' ? '' : space], ['place', brgy(item.brgy)]],
        extra: '<div class="p-act">' + wazeButtonHtml(item.lat, item.lng, 'Waze') + '</div>',
        act: { act: 'open-center-detail', id: item.uuid || item.id }, actLabel: 'View shelter'
      }));
      marker.options.title = item.name;
    } else if (cat === 'units') {
      marker.bindPopup(pinPopup({
        title: item.team + (item.name ? ' · ' + item.name : ''), tag: item.statusLabel || 'Responding', color: PIN_UNIT,
        advice: 'A response team on its way to ' + (item.code || 'the report') + '.',
        facts: [['time', item.at ? 'Updated ' + ago(item.at) : '']]
      }));
      marker.options.title = item.team + ' (responding)';
    } else if (cat === 'relief') {
      const when = item.distribution_at ? new Date(item.distribution_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      marker.bindPopup(pinPopup({
        title: item.title || 'Relief distribution', tag: 'Relief handout', color: PIN_RELIEF,
        advice: 'Food and supplies are handed out here.',
        facts: [['calendar', when], ['place', item.location_name || ''],
          ['people', item.barangay ? 'For Barangay ' + item.barangay : 'For everyone in Lingayen']],
        extra: '<div class="p-act">' + wazeButtonHtml(item.lat, item.lng, 'Waze') + '</div>',
        act: { act: 'nav', route: 'relief' }, actLabel: 'View schedule'
      }));
      marker.options.title = item.title || item.location_name || 'Relief distribution';
    } else {
      const rd = PIN_ROAD[item.status] || PIN_ROAD.under_repair;
      marker.bindPopup(pinPopup({
        title: item.road_name || 'Road', tag: rd.word, color: rd.color, advice: rd.meaning,
        facts: [['place', brgy(item.barangay)], ['note', item.note || ''],
          ['time', item.updated_at ? 'Updated ' + ago(item.updated_at) : '']]
      }));
      marker.options.title = (item.road_name || 'Road') + ' — ' + rd.word;
    }
  }

  /* --------------------------------------------------------------- clustering
     Group the drawable items by on-screen proximity at the current zoom. A
     plain grid hash buckets points, then buckets merge with their neighbours
     so a group straddling a cell border still lands in one cluster. Exact
     duplicates (two records sharing one coordinate) always land together. */
  function buildClusters(items) {
    const L = window.L;
    const th = CLUSTER_PX;
    const buckets = {};
    items.forEach((it, idx) => {
      const p = ctx.map.latLngToContainerPoint(it.ll);
      const kx = Math.floor(p.x / th), ky = Math.floor(p.y / th);
      const k = kx + ':' + ky;
      (buckets[k] = buckets[k] || []).push({ idx: idx, it: it, x: p.x, y: p.y });
    });

    /* union-find over bucket pairs whose members sit within th px */
    const parent = items.map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };

    const keys = Object.keys(buckets);
    keys.forEach((k) => {
      /* first union everything inside the same cell: exact duplicates (two
         records sharing one coordinate) land in one bucket and must group */
      const own = buckets[k];
      for (let i = 0; i < own.length; i++) {
        for (let j = i + 1; j < own.length; j++) union(own[i].idx, own[j].idx);
      }
      /* then bridge neighbouring cells so a group straddling a border still
         lands in one cluster */
      const [kx, ky] = k.split(':').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const other = buckets[(kx + dx) + ':' + (ky + dy)];
          if (!other) continue;
          own.forEach((a) => other.forEach((b) => {
            const ddx = a.x - b.x, ddy = a.y - b.y;
            if (ddx * ddx + ddy * ddy <= th * th) union(a.idx, b.idx);
          }));
        }
      }
    });

    const groups = {};
    items.forEach((it, idx) => {
      const r = find(idx);
      (groups[r] = groups[r] || []).push(it);
    });
    return Object.keys(groups).map((k) => {
      const members = groups[k];
      const p = ctx.map.latLngToContainerPoint(members[0].ll);
      return { members: members, x: p.x, y: p.y };
    });
  }

  function clusterIcon(members) {
    const L = window.L;
    const n = members.length;
    const size = residentMap() ? (n <= 4 ? 30 : n <= 9 ? 36 : 42) : (n <= 4 ? 34 : n <= 9 ? 38 : 44);
    const cats = {};
    members.forEach((m) => { cats[m.cat] = true; });
    const CAT_COLORS = { hazards: PIN_LEVEL.emergency.color, relief: PIN_RELIEF, centers: PIN_SHELTER.open.color, roadStatus: PIN_ROAD.one_lane.color, units: PIN_UNIT };
    const dots = Object.keys(CAT_COLORS).filter((k) => cats[k])
      .map((k) => '<i style="background:' + CAT_COLORS[k] + '"></i>').join('');
    const names = { hazards: 'hazard reports', centers: 'evacuation centers', relief: 'relief distributions', roadStatus: 'road status points' };
    const here = members[0].item;
    const where = here.brgy ? ' · ' + here.brgy : '';
    return L.divIcon({
      className: '',
      html: '<div class="ug-cluster" style="width:' + size + 'px;height:' + size + 'px" role="button" tabindex="0"' +
        ' aria-label="' + n + ' map points here: ' + UG_UTIL.esc(Object.keys(cats).map((k) => names[k]).join(', ')) + where + '">' +
        '<span class="n">' + n + '</span><span class="dots" aria-hidden="true">' + dots + '</span></div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  }

  /* --------------------------------------------------------------- rendering */
  function redraw() {
    if (!ctx || ctx.fallback) return;
    ctx._redrawing = true;
    closeSpider(true);
    const L = window.L;
    ctx.layer.clearLayers();
    ctx.circleLayer.clearLayers();

    /* hazard perimeters stay as honest circles around the real point — they
       never cluster (they are areas, not points) */
    if (ctx.visible.hazards !== false) {
      (ctx.data.incidents || []).forEach((i) => {
        if (typeof i.lat !== 'number' || typeof i.lng !== 'number') return;
        if (coordState(i.lat, i.lng, ctx.unbounded) !== 'ok') return;
        if (i.status === 'resolved') return;
        const entry = UG_THEME.sev(i.sev);
        L.circle([i.lat, i.lng], {
          radius: i.sev === 'emergency' ? 480 : i.sev === 'warning' ? 340 : 220,
          color: entry.color, weight: 1, opacity: 0.65, fillColor: entry.color, fillOpacity: 0.13
        }).addTo(ctx.circleLayer);
      });
    }

    const items = collectItems();

    /* strip: records the gate could not place — say so instead of silently
       dropping them (the LGU then fixes the coordinates at the source) */
    const oldWarn = ctx.container.querySelector('.ug-map-warn');
    if (oldWarn) oldWarn.remove();
    const skippedTotal = Object.keys(ctx.skipped).reduce((s, k) => s + ctx.skipped[k], 0);
    if (skippedTotal > 0) {
      const reasons = [];
      if (ctx.skipped.missing) reasons.push(ctx.skipped.missing + ' without coordinates');
      if (ctx.skipped.invalid) reasons.push(ctx.skipped.invalid + ' with invalid coordinates');
      if (ctx.skipped.swapped) reasons.push(ctx.skipped.swapped + ' with swapped lat/lng');
      if (ctx.skipped.outside) reasons.push(ctx.skipped.outside + ' outside the Lingayen service area');
      const text = skippedTotal + ' record' + (skippedTotal === 1 ? '' : 's') + ' not shown: ' + reasons.join(', ') + '.';
      /* dismissible: stays hidden for this session until the message changes */
      let dismissed = false;
      try { dismissed = sessionStorage.getItem('ug_map_warn_x') === text; } catch (e) { }
      if (!dismissed) {
        ctx.container.insertAdjacentHTML('beforeend',
          '<div class="ug-map-warn" role="status" title="' + UG_UTIL.esc(reasons.join(', ')) + '"><span>' + UG_UTIL.esc(text) + '</span>' +
            '<button type="button" class="ug-map-warn-x" aria-label="Dismiss" title="Dismiss">' +
              '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>');
        const warn = ctx.container.querySelector('.ug-map-warn');
        const x = warn && warn.querySelector('.ug-map-warn-x');
        if (x) {
          /* keep the tap off the map (no pan / popup close) */
          if (window.L && window.L.DomEvent) { window.L.DomEvent.disableClickPropagation(warn); }
          x.addEventListener('click', (e) => {
            e.stopPropagation();
            try { sessionStorage.setItem('ug_map_warn_x', text); } catch (err) { }
            warn.remove();
          });
        }
      }
    }

    const oldEmpty = ctx.container.querySelector('.ug-map-empty');
    if (oldEmpty) oldEmpty.remove();
    if (!items.length) {
      ctx.container.insertAdjacentHTML('beforeend',
        '<div class="ug-map-empty" role="status">No mappable records for the selected layers.</div>');
      ctx._redrawing = false;
      return;
    }

    const clusters = buildClusters(items);
    clusters.forEach((cl) => {
      if (cl.members.length === 1) {
        const m = cl.members[0];
        const mk = markerEntry(m.cat, m.item);
        const marker = L.marker(m.ll, { icon: mk.icon, riseOnHover: true, zIndexOffset: mk.z || 0, keyboard: true });
        bindItemPopup(marker, m.cat, m.item);
        marker.addTo(ctx.layer);
      } else {
        const bubble = L.marker(cl.members[0].ll, { icon: clusterIcon(cl.members), riseOnHover: true, zIndexOffset: 800 });
        cl.bubble = bubble;
        bubble.on('click', () => openCluster(cl));
        bubble.on('keypress', (e) => { if (e.originalEvent && e.originalEvent.key === 'Enter') openCluster(cl); });
        bubble.addTo(ctx.layer);
      }
    });
    ctx._redrawing = false;
  }

  /* --------------------------------------------------------------- spiderfy
     The members of a cluster sit at (or near) one true point. Spiderfying
     never moves a record's coordinate: each member is DISPLAYED on a leader
     line around the real position (the same approach markercluster uses) and
     its popup keeps the real coordinates. Any pan/zoom/resize closes the
     spider and the honest map returns. */
  function openCluster(cl) {
    if (!ctx || ctx.fallback) return;
    const L = window.L;
    closeSpider();
    const anchor = cl.members[0].ll;
    const anchorPoint = ctx.map.latLngToContainerPoint(anchor);
    const n = cl.members.length;

    /* zoom first when the members can be pulled apart by zooming; spiderfy
       when they share one coordinate or the map is already close in */
    const sameSpot = cl.members.every((m) =>
      Math.abs(m.ll[0] - anchor[0]) < 1e-9 && Math.abs(m.ll[1] - anchor[1]) < 1e-9);
    if (!sameSpot && ctx.map.getZoom() < SPIDER_ZOOM) {
      try {
        const b = L.latLngBounds(cl.members.map((m) => m.ll));
        ctx.map.fitBounds(b, { padding: [48, 48], maxZoom: SPIDER_ZOOM });
        return;
      } catch (e) {}
    }

    const radius = Math.min(SPIDER_BASE_R + 7 * Math.sqrt(n), 64);
    ctx.spider = { anchor: anchor, markers: [], lines: [], bubble: null };

    /* the bubble makes way for its members while the spider is open; any pan
       or zoom closes the spider and the bubble comes back */
    if (cl.bubble) {
      try { ctx.map.removeLayer(cl.bubble); } catch (e) {}
      ctx.spider.bubble = cl.bubble;
    }

    /* a small ring marking the position the records actually share */
    const ring = L.marker(anchor, {
      icon: L.divIcon({
        className: '',
        html: '<div class="ug-spider-anchor"></div>',
        iconSize: [10, 10], iconAnchor: [5, 5]
      }),
      interactive: false,
      zIndexOffset: 600
    }).addTo(ctx.layer);

    cl.members.forEach((m, i) => {
      const angle = (-90 + (360 / n) * i) * Math.PI / 180;
      const px = L.point(anchorPoint.x + radius * Math.cos(angle), anchorPoint.y + radius * Math.sin(angle));
      const ll = ctx.map.containerPointToLatLng(px);
      const mk = markerEntry(m.cat, m.item);
      const marker = L.marker(ll, { icon: mk.icon, zIndexOffset: 900 });
      bindItemPopup(marker, m.cat, m.item);
      marker.addTo(ctx.layer);
      ctx.spider.markers.push(marker);
      const line = L.polyline([anchor, ll], {
        color: '#0B1220', weight: 1.5, opacity: 0.5, interactive: false, dashArray: '3 4'
      }).addTo(ctx.layer);
      ctx.spider.lines.push(line);
    });
    ctx.spider.ring = ring;
  }

  function closeSpider(silent) {
    if (!ctx || !ctx.spider) return;
    ctx.spider.markers.forEach((m) => { try { ctx.layer.removeLayer(m); } catch (e) {} });
    ctx.spider.lines.forEach((l) => { try { ctx.layer.removeLayer(l); } catch (e) {} });
    if (ctx.spider.ring) { try { ctx.layer.removeLayer(ctx.spider.ring); } catch (e) {} }
    /* the cluster bubble comes back once its members are gone */
    if (ctx.spider.bubble) { try { ctx.spider.bubble.addTo(ctx.map); } catch (e) {} }
    ctx.spider = null;
    if (!silent) redraw();
  }

  /* ------------------------------------------------------------- data setters
     Each setter stores its list and redraws the cluster layer in place — the
     map itself (tiles, zoom, pan) is never rebuilt for a data update. */
  function setIncidents(list) {
    if (!ctx || ctx.fallback) return;
    ctx.data.incidents = list || [];
    redraw();
  }

  function setCenters(list) {
    if (!ctx || ctx.fallback) return;
    ctx.data.centers = list || [];
    redraw();
  }

  function setRelief(list) {
    if (!ctx || ctx.fallback) return;
    ctx.data.relief = list || [];
    redraw();
  }

  function setUnits(list) {
    if (!ctx || ctx.fallback) return;
    ctx.data.units = list || [];
    redraw();
  }

  function setRoadStatus(list) {
    if (!ctx || ctx.fallback) return;
    ctx.data.roadStatus = list || [];
    redraw();
  }

  /* show or hide the four overlay groups in place, so switching a layer off
     keeps the current zoom and pan instead of rebuilding the map */
  function setLayers(layers) {
    if (!ctx || ctx.fallback || !layers) return;
    Object.keys({ hazards: 1, relief: 1, centers: 1, roadStatus: 1 }).forEach((k) => {
      if (typeof layers[k] === 'boolean') ctx.visible[k] = layers[k];
    });
    ctx.circleLayer[ctx.visible.hazards === false ? 'remove' : 'addTo'](ctx.map);
    redraw();
  }

  /* the citizen report form's drag-to-adjust pin: a single draggable marker
     whose drop fires the onPinDrop callback so the parent can write the new
     lat/lng into the report state and reverse-geocode it. */
  /* A GPS fix outside Lingayen (or none) starts the pin at the town centre;
     onOutside() lets the form explain why. The pin can never be dropped
     outside the service box: it snaps back to its last valid spot. */
  function setReportPin(initial, onDrop, onOutside) {
    if (!ctx || ctx.fallback) return;
    const L = window.L;
    if (ctx.reportMarker) { try { ctx.reportMarker.remove(); } catch (e) {} }
    const bounds = serviceBounds();
    const inside = hasPoint(initial) && bounds.contains([initial.lat, initial.lng]);
    const center = inside ? [initial.lat, initial.lng] : UG_GEO.CENTER;
    const size = 30;
    const icon = L.divIcon({
      className: 'ug-report-pin',
      html: '<span class="ug-pin-ring" aria-hidden="true"></span>' +
        '<div class="ug-marker shape-diamond" style="width:' + size + 'px;height:' + size + 'px;background:#34D6F0;color:#062B36">PIN</div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
    const marker = L.marker(center, {
      icon: icon,
      draggable: true,
      autoPan: true,
      title: 'Drag me',
      alt: 'Drag me'
    }).addTo(ctx.map);
    let last = marker.getLatLng();
    marker.on('dragstart', () => { last = marker.getLatLng(); });
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      if (!bounds.contains(ll)) {
        marker.setLatLng(last);
        const msg = typeof UG_I18N !== 'undefined' ? UG_I18N.t('report.pinMustBeInside') : 'Pin must be inside Lingayen';
        try { (window.UG_TOAST || function () {})(msg, 'warning'); } catch (e) {}
        return;
      }
      last = ll;
      if (onDrop) onDrop(ll.lat, ll.lng);
    });
    ctx.reportMarker = marker;
    if (inside) ctx.map.panTo(center, { animate: false });
    else ctx.map.setView(UG_GEO.CENTER, UG_GEO.ZOOM);
    if (hasPoint(initial) && !inside && onOutside) onOutside();
  }

  /* ---------------------------------------------------- "My Location" control
   * A single Leaflet control, shared by every map: same corner, same size and
   * spacing as the other map controls, and it works with touch (a plain button
   * with a pointerdown handler, no hover dependency). On success it drops a
   * temporary accuracy circle + marker and re-centres the map; on failure it
   * raises a toast via the normal toast host. */
  function addLocateControl(map) {
    const L = window.L;
    const Locate = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function () {
        const div = L.DomUtil.create('div', 'ug-locate-wrap');
        div.innerHTML = '<button type="button" class="ug-locate-btn" aria-label="Show my location" title="Show my location">' +
          '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>';
        const btn = div.querySelector('button');
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.on(btn, 'click', async (e) => {
          L.DomEvent.preventDefault(e);
          btn.classList.add('is-busy');
          try {
            const pos = await (typeof UG_FEATURES !== 'undefined' ? UG_FEATURES.locate() : Promise.reject(new Error('unavailable')));
            if (ctx && ctx.locateLayer) { try { ctx.locateLayer.remove(); } catch (er) {} }
            ctx.locateLayer = L.layerGroup([
              L.circle([pos.lat, pos.lng], { radius: Math.max(30, pos.accuracy || 60), color: '#34D6F0', weight: 1, fillOpacity: 0.12 }),
              L.marker([pos.lat, pos.lng], { icon: shapeIcon({ color: '#34D6F0', on: '#062B36', short: 'YOU', shape: 'circle' }, 22) })
            ]).addTo(map);
            map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 15));
          } catch (err) {
            try {
              const host = document.getElementById('ug-toasts');
              if (host) {
                const t = document.createElement('div');
                t.className = 'ug-toast ug-toast--warning';
                t.innerHTML = UG.icon('info', 16) + '<span>' + UG_UTIL.esc(err.message || 'Could not read your location.') + '</span>';
                host.appendChild(t);
                setTimeout(() => t.remove(), 3200);
              }
            } catch (er) {}
          }
          btn.classList.remove('is-busy');
        });
        return div;
      }
    });
    try { Locate.prototype.options.position = 'bottomright'; new Locate().addTo(map); } catch (e) {}
  }

  function invalidate() { if (ctx && ctx.map) { try { ctx.map.invalidateSize(); } catch (e) {} } }
  const isFallback = () => !!(ctx && ctx.fallback);
  /* the live Leaflet map, or null while a fallback is showing. Read-only hook
     for diagnostics, tests and future integrations — the screen code never
     needs it, it talks through the setters above. */
  const getMap = () => (ctx && !ctx.fallback) ? ctx.map : null;

  return { mount, destroy, owns, getMap, setIncidents, setCenters, setRelief, setRoadStatus, setUnits, setLayers, setReportPin, invalidate, isFallback, wazeButtonHtml,
    pinHtml, pinGlyph, PIN_SIZE, PIN_LEVEL, PIN_SHELTER, PIN_ROAD, PIN_RELIEF, REPORT_STATUS };
})();
