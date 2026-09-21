/* UniGuard · live operations map
 *
 * Leaflet with OpenStreetMap tiles. When Leaflet has not loaded (offline, or a
 * blocked CDN) the screen falls back to the built in SVG tactical map so the
 * console never shows an empty panel.
 */
const MapView = (function () {
  let ctx = null;                 /* { map, layers, container, fallback } */

  const COLORS = {
    emergency: '#FF5A5F',
    warning: '#FFB020',
    advisory: '#4D9BFF',
    prepared: '#2FD08A'
  };

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
      center: opts.center || [16.0433, 120.3331],
      zoom: opts.zoom || 13,
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
      const color = COLORS[i.sev] || COLORS.advisory;
      const open = i.status !== 'resolved';

      if (open) {
        L.circle([i.lat, i.lng], {
          radius: i.sev === 'emergency' ? 480 : i.sev === 'warning' ? 340 : 220,
          color: color, weight: 1, opacity: 0.65, fillColor: color, fillOpacity: 0.13
        }).addTo(ctx.incidentLayer);
      }

      const marker = L.circleMarker([i.lat, i.lng], {
        radius: i.sev === 'emergency' ? 9 : 7,
        color: '#050910', weight: 2, fillColor: color, fillOpacity: 1
      }).addTo(ctx.incidentLayer);

      marker.bindPopup(
        '<div class="ug-map-pop"><div class="p-t">' + UG_UTIL.esc(i.hazard) + '</div>' +
        '<div class="p-m">' + UG_UTIL.esc(i.id) + ' &middot; ' + UG_UTIL.esc(i.brgy) + '</div>' +
        '<div class="p-m" style="margin-top:4px">' + UG_UTIL.esc(i.status.replace(/_/g, ' ')) + ' &middot; ' + UG_UTIL.esc(i.corr || 0) + ' corroborations</div>' +
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
      const color = c.status === 'open' ? '#2FD08A' : c.status === 'full' ? '#FFB020' : '#FF5A5F';
      L.circleMarker([c.lat, c.lng], { radius: 6, color: '#050910', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindPopup('<div class="ug-map-pop"><div class="p-t">' + UG_UTIL.esc(c.name) + '</div>' +
          '<div class="p-m">' + UG_UTIL.esc(c.status) + ' &middot; ' + c.occ + ' of ' + c.cap + '</div></div>')
        .addTo(ctx.centerLayer);
    });
  }

  function invalidate() { if (ctx && ctx.map) { try { ctx.map.invalidateSize(); } catch (e) {} } }
  const isFallback = () => !!(ctx && ctx.fallback);

  return { mount, destroy, setIncidents, setCenters, invalidate, isFallback };
})();
