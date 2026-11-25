/* UniGuard · road routes for the response tracking maps
 *
 * A responding team's map shows the road it still has to drive as a faint
 * line, and the road it already drove (its GPS trail, migration 090) as a
 * solid one. The road route comes from the public OSRM server
 * (router.project-osrm.org): free and without a key, but a shared demo
 * service, so it is asked as little as possible:
 *
 *  · one route per dispatch, from the team's position to the incident, kept
 *    in memory; as the team moves, only the part still ahead is drawn;
 *  · a new route only when the team leaves the road it was given (over
 *    OFF_ROUTE_M), at most every REROUTE_MS, or when the incident moves;
 *  · requests are spaced out, time out after 8 s, and a failure is not
 *    retried for a minute. Until a route arrives, or if the server cannot be
 *    reached, the map draws a straight dashed line instead.
 *
 * Only the two coordinates are sent (the team's position and the incident),
 * never a name, report or account.
 */
const UG_ROUTE = (() => {
  const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
  const OFF_ROUTE_M = 80;
  const REROUTE_MS = 30000;
  const RETRY_FAIL_MS = 60000;
  const GAP_MS = 1200;
  const DEST_MOVED_M = 30;

  const cache = new Map();   /* key → { dest, coords, status: 'ok'|'pending'|'fail', at } */
  let nextSlot = 0;

  const dist = (a, b) => UG_UTIL.distanceM(a[0], a[1], b[0], b[1]);

  /* the closest point of a polyline to p, on a local flat projection (fine at
     town scale): { i: segment start index, pt: [lat, lng], d: metres } */
  function nearest(coords, p) {
    const kx = Math.cos(p[0] * Math.PI / 180) * 111320, ky = 110540;
    let best = { i: 0, pt: coords[0], d: Infinity };
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i], b = coords[i + 1];
      const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky;
      const bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky;
      const vx = bx - ax, vy = by - ay;
      const len = vx * vx + vy * vy;
      const t = len ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / len)) : 0;
      const x = ax + vx * t, y = ay + vy * t;
      const d = Math.sqrt(x * x + y * y);
      if (d < best.d) best = { i: i, pt: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d: d };
    }
    return best;
  }

  async function request(key, from, dest) {
    const entry = { dest: dest, coords: (cache.get(key) || {}).coords || null, status: 'pending', at: Date.now() };
    cache.set(key, entry);
    const wait = Math.max(0, nextSlot - Date.now());
    nextSlot = Date.now() + wait + GAP_MS;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
    try {
      const url = OSRM + from[1].toFixed(6) + ',' + from[0].toFixed(6) + ';' + dest[1].toFixed(6) + ',' + dest[0].toFixed(6) +
        '?overview=full&geometries=geojson';
      const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
      const body = res.ok ? await res.json() : null;
      const line = body && body.code === 'Ok' && body.routes && body.routes[0] && body.routes[0].geometry && body.routes[0].geometry.coordinates;
      if (!line || line.length < 2) throw new Error('no route');
      entry.coords = line.map((c) => [c[1], c[0]]);
      entry.status = 'ok';
    } catch (e) {
      entry.status = 'fail';
    } finally {
      if (timer) clearTimeout(timer);
      entry.at = Date.now();
    }
    if (cache.get(key) === entry) document.dispatchEvent(new CustomEvent('ug:route-ready', { detail: { key: key } }));
  }

  /* The road still to drive, from the team's position to the incident, as
     [[lat, lng], ...]; or null while there is none (the caller then draws a
     straight dashed line). Asks the server when needed. */
  function ahead(key, car, dest) {
    if (!key || !car || !dest) return null;
    const now = Date.now();
    let entry = cache.get(key);
    if (entry && dist(entry.dest, dest) > DEST_MOVED_M) entry = null;
    if (!entry || (entry.status === 'fail' && now - entry.at > RETRY_FAIL_MS)) {
      request(key, car, dest);
      return null;
    }
    if (!entry.coords) return null;
    const n = nearest(entry.coords, car);
    if (n.d > OFF_ROUTE_M && entry.status !== 'pending' && now - entry.at > REROUTE_MS) request(key, car, dest);
    return [car, n.pt].concat(entry.coords.slice(n.i + 1));
  }

  return { ahead, nearest };
})();
window.UG_ROUTE = UG_ROUTE;
