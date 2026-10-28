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
      if (ctx.map) { try { ctx.map.remove(); } catch (e) {} }
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
      data: { incidents: [], centers: [], relief: [], roadStatus: [] },
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
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 100);
    setTimeout(() => { try { map.invalidateSize(); fitOnce(); } catch (e) {} }, 400);
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
  function markerEntry(cat, item) {
    const L = window.L;
    if (cat === 'hazards') {
      const resolved = item.status === 'resolved';
      const entry = resolved ? UG_THEME.STATUS.resolved : UG_THEME.sev(item.sev);
      return { entry: entry, size: item.sev === 'emergency' ? 26 : 22 };
    }
    if (cat === 'centers') {
      const avail = UG_THEME.SHELTER[item.status] || UG_THEME.SHELTER.closed;
      const entry = Object.assign({}, UG_THEME.SHELTER.marker, { color: avail.color, on: avail.on, short: 'EVAC' });
      return { entry: entry, size: 22 };
    }
    if (cat === 'relief') {
      return { entry: { color: '#8B5CF6', on: '#FFFFFF', short: 'REL', shape: 'square' }, size: 22 };
    }
    /* roadStatus */
    const tone = item.status === 'blocked' ? 'road-blocked'
               : item.status === 'caution'  ? 'road-caution'
               : 'road-passable';
    const label = item.status === 'blocked' ? 'X' : item.status === 'caution' ? '!' : '';
    return {
      entry: null, size: 22,
      icon: L.divIcon({
        className: '',
        html: '<div class="ug-marker ' + tone + '" style="width:22px;height:22px">' + UG_UTIL.esc(label) + '</div>',
        iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -11]
      })
    };
  }

  function bindItemPopup(marker, cat, item) {
    if (cat === 'hazards') {
      const resolved = item.status === 'resolved';
      const entry = resolved ? UG_THEME.STATUS.resolved : UG_THEME.sev(item.sev);
      marker.bindPopup(
        '<div class="ug-map-pop"><div class="p-t">' + UG_UTIL.esc(item.hazard) + '</div>' +
        '<div class="p-m">' + UG_UTIL.esc(item.id) + ' &middot; ' + UG_UTIL.esc(item.brgy) + '</div>' +
        '<div class="p-m" style="margin-top:4px">' + UG_UTIL.esc(entry.label) + ' &middot; ' +
        UG_UTIL.esc((UG_THEME.status(item.status) || {}).label || String(item.status).replace(/_/g, ' ')) + ' &middot; ' +
        UG_UTIL.esc(UG_UTIL.corroborationLabel(item.corr)) + '</div>' +
        '</div>'
      );
      marker.on('click', () => {
        document.dispatchEvent(new CustomEvent('ug:open-incident', { detail: { id: item.uuid || item.id } }));
      });
      marker.options.title = item.hazard + ' — ' + item.brgy;
    } else if (cat === 'centers') {
      const avail = UG_THEME.SHELTER[item.status] || UG_THEME.SHELTER.closed;
      marker.bindPopup('<div class="ug-map-pop"><div class="p-t">' + UG_UTIL.esc(item.name) + '</div>' +
        '<div class="p-m">' + UG_UTIL.esc(avail.label) + ' &middot; ' + item.occ + ' of ' + item.cap + '</div>' +
        '<div class="p-act">' + wazeButtonHtml(item.lat, item.lng, 'Waze') + '</div></div>');
      marker.options.title = item.name;
    } else if (cat === 'relief') {
      marker.bindPopup('<div class="ug-map-pop"><div class="p-t">' + UG_UTIL.esc(item.title || item.location_name || 'Relief') + '</div>' +
        '<div class="p-m">' + UG_UTIL.esc(item.barangay || '') + '</div>' +
        '<div class="p-act">' + wazeButtonHtml(item.lat, item.lng, 'Waze') + '</div></div>');
      marker.options.title = item.title || item.location_name || 'Relief distribution';
    } else {
      marker.bindPopup('<div class="ug-map-pop"><div class="p-t">' + UG_UTIL.esc(item.road_name) + '</div>' +
        '<div class="p-m">' + UG_UTIL.esc(String(item.status).toUpperCase()) + ' &middot; ' + UG_UTIL.esc(item.barangay) + '</div>' +
        (item.note ? '<div class="p-m">' + UG_UTIL.esc(item.note) + '</div>' : '') +
        '</div>');
      marker.options.title = item.road_name + ' — ' + String(item.status).toUpperCase();
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
    const size = n <= 4 ? 30 : n <= 9 ? 36 : 42;
    const cats = {};
    members.forEach((m) => { cats[m.cat] = true; });
    const CAT_COLORS = {
      hazards: UG_THEME.SEVERITY.emergency.color,
      relief: '#8B5CF6',
      centers: UG_THEME.SHELTER.marker.color,
      roadStatus: UG_THEME.SEVERITY.warning.color
    };
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
      ctx.container.insertAdjacentHTML('beforeend',
        '<div class="ug-map-warn" role="status">' + UG_UTIL.esc(
          skippedTotal + ' record' + (skippedTotal === 1 ? '' : 's') + ' not shown: ' + reasons.join(', ') + '.') + '</div>');
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
        const marker = L.marker(m.ll, {
          icon: mk.icon || shapeIcon(mk.entry, mk.size),
          riseOnHover: true,
          title: (mk.entry && mk.entry.short) ? mk.entry.short : undefined
        });
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
      const marker = L.marker(ll, { icon: mk.icon || shapeIcon(mk.entry, mk.size), zIndexOffset: 900 });
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
    if (inside) ctx.map.panTo(center);
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

  return { mount, destroy, owns, getMap, setIncidents, setCenters, setRelief, setRoadStatus, setLayers, setReportPin, invalidate, isFallback, wazeButtonHtml };
})();
