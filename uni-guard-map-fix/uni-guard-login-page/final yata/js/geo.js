/* UniGuard · place data (Lingayen, Pangasinan)
 *
 * Everything that says where this system is lives here: the town name, the map
 * centre and bounds, the 32 barangays, well known landmarks, and the coordinate
 * checks used before a location is drawn or sent to a navigation app.
 *
 * SOURCES (verify before production):
 *   - Barangay list: PSA via PhilAtlas, Lingayen has 32 barangays.
 *   - Municipal centre 16.0206, 120.2306: PhilAtlas.
 *   - Landmark coordinates: Wikipedia / Wikidata pages for each landmark.
 *   - BOUNDS is a service-area box drawn a little wider than the town. It is an
 *     approximation, NOT an official boundary. It exists to catch wrong-city and
 *     swapped latitude/longitude values, not to define jurisdiction.
 */
const UG_GEO = (function () {
  const PLACE = {
    town: 'Lingayen',
    province: 'Pangasinan',
    label: 'Lingayen, Pangasinan',
    kind: 'Municipality',
    /* wording that replaces the old "Citywide" */
    areaAll: 'Municipality-wide',
    scope: 'Municipality-wide · Lingayen',
    office: 'Municipal DRRMO',
    controller: 'Municipal Government of Lingayen, through the Municipal Disaster Risk Reduction and Management Office (MDRRMO)'
  };

  /* municipal centre, then a zoom that shows the whole built-up area */
  const CENTER = [16.0206, 120.2306];
  const ZOOM = 13;
  const BOUNDS = { minLat: 15.95, maxLat: 16.085, minLng: 120.17, maxLng: 120.29 };

  /* an example a person can copy when typing coordinates by hand */
  const EXAMPLE = '16.0206, 120.2306';

  const BARANGAYS = [
    'Aliwekwek', 'Baay', 'Balangobong', 'Balococ', 'Bantayan', 'Basing', 'Capandanan',
    'Domalandan Center', 'Domalandan East', 'Domalandan West', 'Dorongan', 'Dulag',
    'Estanza', 'Lasip', 'Libsong East', 'Libsong West', 'Malawa', 'Malimpuec', 'Maniboc',
    'Matalava', 'Naguelguel', 'Namolan', 'Pangapisan North', 'Pangapisan Sur', 'Poblacion',
    'Quibaol', 'Rosario', 'Sabangan', 'Talogtog', 'Tonton', 'Tumbar', 'Wawa'
  ];

  /* used to draw the offline / fallback map and to sanity check the centre */
  const LANDMARKS = [
    { name: 'Provincial Capitol', lat: 16.033513, lng: 120.231519, main: true },
    { name: 'Narciso Ramos Sports Complex', lat: 16.03192, lng: 120.22529 },
    { name: 'Casa Real', lat: 16.019805, lng: 120.230341 }
  ];

  /* what borders the town, for the schematic map (direction only, not coordinates) */
  const NEIGHBOURS = [
    { name: 'Lingayen Gulf', edge: 'n' },
    { name: 'Binmaley', edge: 'e' },
    { name: 'San Carlos City', edge: 's' },
    { name: 'Bugallon', edge: 'sw' },
    { name: 'Labrador', edge: 'w' }
  ];

  /* --------------------------------------------------------- coordinate checks */
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const toNum = (v) => {
    if (v === null || v === undefined || v === '') return NaN;
    return typeof v === 'number' ? v : parseFloat(v);
  };

  /* 'missing'  nothing stored
     'invalid'  not numbers, out of range, or the (0,0) placeholder
     'swapped'  looks like longitude was stored where latitude belongs
     'outside'  a real coordinate, but not in the Lingayen service area
     'ok'       usable */
  function classify(lat, lng) {
    lat = toNum(lat); lng = toNum(lng);
    if (isNaN(lat) && isNaN(lng)) return 'missing';
    if (!isNum(lat) || !isNum(lng)) return 'invalid';
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) return 'swapped';
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return 'invalid';
    if (lat === 0 && lng === 0) return 'invalid';
    /* latitude 16 / longitude 120 written the wrong way round */
    if (lat >= BOUNDS.minLng && lat <= BOUNDS.maxLng && lng >= BOUNDS.minLat && lng <= BOUNDS.maxLat) return 'swapped';
    if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) return 'outside';
    return 'ok';
  }

  const MESSAGES = {
    missing: 'No location has been recorded for this place yet.',
    invalid: 'The stored coordinates are not valid.',
    swapped: 'Latitude and longitude look swapped.',
    outside: 'The stored coordinates are outside Lingayen.',
    ok: ''
  };
  const message = (state) => MESSAGES[state] || '';

  /* is it safe to hand these to a navigation app? only a clean, in-town point is */
  const canNavigate = (lat, lng) => classify(lat, lng) === 'ok';

  /* parse "16.0206, 120.2306" typed by a person (latitude first) */
  function parse(text) {
    const m = String(text || '').match(/(-?\d+(?:\.\d+)?)\s*[,\s;]\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    return { lat: lat, lng: lng, state: classify(lat, lng) };
  }

  const fmt = (lat, lng) => (isNum(lat) && isNum(lng)) ? lat.toFixed(5) + ', ' + lng.toFixed(5) : '';

  /* project a point onto a 0..1 box over BOUNDS (x to the east, y to the south) */
  function project(lat, lng) {
    const x = (lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng);
    const y = 1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat);
    return { x: x, y: y };
  }

  /* -------------------------------------------------------------- Waze links */
  /* Task 3 spec: universal link, latitude then longitude, navigation started.
     wazeAppUrl is the app-scheme attempt (works only where iOS/Android allow a
     custom scheme to be tried); wazeUrl is the universal link, which opens the
     app if installed and otherwise falls back to Waze's own web page. */
  function wazeUrl(lat, lng) {
    return 'https://waze.com/ul?ll=' + encodeURIComponent(lat) + ',' + encodeURIComponent(lng) + '&navigate=yes';
  }
  function wazeAppUrl(lat, lng) {
    return 'waze://?ll=' + encodeURIComponent(lat) + ',' + encodeURIComponent(lng) + '&navigate=yes';
  }

  return {
    PLACE, CENTER, ZOOM, BOUNDS, EXAMPLE, BARANGAYS, LANDMARKS, NEIGHBOURS,
    isNum, toNum, classify, message, canNavigate, parse, fmt, project,
    wazeUrl, wazeAppUrl
  };
})();
