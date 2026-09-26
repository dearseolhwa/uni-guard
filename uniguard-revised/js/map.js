/* UniGuard · live operations map
 *
 * Leaflet with OpenStreetMap tiles, centred on Lingayen, Pangasinan (js/geo.js).
 * When Leaflet has not loaded (offline, or a blocked CDN) the screen falls back
 * to the built-in SVG tactical map so the console never shows an empty panel.
 *
 * Every colour drawn here comes from js/theme.js — the map, the legend, the
 * list cards and the LGU dashboard all read the same values, so they can never
 * disagree. Severity markers also carry a shape and a short text label
 * (CRIT/HIGH/MOD), so colour is never the only way to tell them apart.
 */
const MapView = (function () {
  let ctx = null;                 /* { map, layers, container, fallback } */

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
    if (ctx && ctx.map) { try { ctx.map.remove(); } catch (e) {} }
    ctx = null;
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

  /* container must have an explicit height */
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
    const map = L.map(container, {
      center: opts.center || UG_GEO.CENTER,
      zoom: opts.zoom || UG_GEO.ZOOM,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    ctx = { map: map, layer: L.layerGroup().addTo(map), container: container, fallback: false };
    if (opts.incidents) setIncidents(opts.incidents);
    if (opts.centers) setCenters(opts.centers);
    setTimeout(() => { try { map.invalidateSize(); } catch (e) {} }, 200);
    return ctx;
  }

  function setIncidents(list) {
    if (!ctx) return;
    if (ctx.fallback) return;
    const L = window.L;
    if (!ctx.incidentLayer) ctx.incidentLayer = L.layerGroup().addTo(ctx.map);
    ctx.incidentLayer.clearLayers();

    (list || []).forEach((i) => {
      if (typeof i.lat !== 'number' || typeof i.lng !== 'number') return;
      const resolved = i.status === 'resolved';
      const entry = resolved ? UG_THEME.STATUS.resolved : UG_THEME.sev(i.sev);
      const open = !resolved;

      if (open) {
        L.circle([i.lat, i.lng], {
          radius: i.sev === 'emergency' ? 480 : i.sev === 'warning' ? 340 : 220,
          color: entry.color, weight: 1, opacity: 0.65, fillColor: entry.color, fillOpacity: 0.13
        }).addTo(ctx.incidentLayer);
      }

      const marker = L.marker([i.lat, i.lng], { icon: shapeIcon(entry, i.sev === 'emergency' ? 26 : 22) }).addTo(ctx.incidentLayer);

      marker.bindPopup(
        '<div class="ug-map-pop"><div class="p-t">' + UG_UTIL.esc(i.hazard) + '</div>' +
        '<div class="p-m">' + UG_UTIL.esc(i.id) + ' &middot; ' + UG_UTIL.esc(i.brgy) + '</div>' +
        '<div class="p-m" style="margin-top:4px">' + UG_UTIL.esc(entry.label) + ' &middot; ' +
        UG_UTIL.esc((UG_THEME.status(i.status) || {}).label || i.status.replace(/_/g, ' ')) + ' &middot; ' +
        UG_UTIL.esc(i.corr || 0) + ' corroborations</div>' +
        '</div>'
      );
      marker.on('click', () => {
        document.dispatchEvent(new CustomEvent('ug:open-incident', { detail: { id: i.uuid || i.id } }));
      });
    });
  }

  function setCenters(list) {
    if (!ctx || ctx.fallback) return;
    const L = window.L;
    if (!ctx.centerLayer) ctx.centerLayer = L.layerGroup().addTo(ctx.map);
    ctx.centerLayer.clearLayers();
    (list || []).forEach((c) => {
      if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return;
      const avail = UG_THEME.SHELTER[c.status] || UG_THEME.SHELTER.closed;
      const entry = Object.assign({}, UG_THEME.SHELTER.marker, { color: avail.color, on: avail.on, short: 'EVAC' });
      L.marker([c.lat, c.lng], { icon: shapeIcon(entry, 22) })
        .bindPopup('<div class="ug-map-pop"><div class="p-t">' + UG_UTIL.esc(c.name) + '</div>' +
          '<div class="p-m">' + UG_UTIL.esc(avail.label) + ' &middot; ' + c.occ + ' of ' + c.cap + '</div>' +
          '<div class="p-act">' + wazeButtonHtml(c.lat, c.lng, 'Waze') + '</div></div>')
        .addTo(ctx.centerLayer);
    });
  }

  function invalidate() { if (ctx && ctx.map) { try { ctx.map.invalidateSize(); } catch (e) {} } }
  const isFallback = () => !!(ctx && ctx.fallback);

  return { mount, destroy, setIncidents, setCenters, invalidate, isFallback, wazeButtonHtml };
})();
