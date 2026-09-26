/* UniGuard · hazard types
 *
 * THE single place every hazard type is defined: its key (stored in
 * reports.hazard_type), its display label, which colour group it draws in a
 * chart (see js/theme.js TYPE_GROUP — deliberately not the severity colours),
 * and its icon. The report form, the filters, the legend, the analytics chart
 * and the LGU dashboard all build their hazard lists from here, so adding a
 * hazard type only means editing this file.
 *
 * "Others" is a real entry (key 'other') like any other, except
 * requiresText: true — the UI must collect a required free-text description
 * when it is chosen, and that text is stored separately (reports.hazard_other_text,
 * see migrations/010_hazard_types.sql) so the canonical label list, and every
 * colour/icon lookup keyed on it, stay stable no matter what a resident types.
 *
 * A report written before this list existed, or naming a hazard type this list
 * has since dropped, still renders: classify() below falls back to a neutral
 * "Other" look rather than failing, so existing reports keep working.
 */
const UG_HAZARDS = (function () {
  const LIST = [
    { key: 'flood',               label: 'Flood',                              group: 'water',   icon: 'flood' },
    { key: 'river_overflow',      label: 'River Overflow',                     group: 'water',   icon: 'flood' },
    { key: 'drainage_blockage',   label: 'Drainage Blockage',                  group: 'water',   icon: 'drain' },
    { key: 'storm_surge',         label: 'Storm Surge',                        group: 'coastal', icon: 'wave' },
    { key: 'coastal_erosion',     label: 'Coastal Erosion',                    group: 'coastal', icon: 'wave' },
    { key: 'strong_wind',         label: 'Strong Wind / Typhoon Damage',       group: 'wind',    icon: 'wind' },
    { key: 'fallen_tree',         label: 'Fallen Tree',                        group: 'wind',    icon: 'tree' },
    { key: 'landslide',           label: 'Landslide / Soil Erosion',           group: 'earth',   icon: 'landslide' },
    { key: 'earthquake',          label: 'Earthquake',                         group: 'earth',   icon: 'quake' },
    { key: 'road_damage',         label: 'Road Damage',                        group: 'infra',   icon: 'road' },
    { key: 'vehicular_accident',  label: 'Vehicular Accident',                 group: 'infra',   icon: 'car' },
    { key: 'fire',                label: 'Fire',                               group: 'fire',    icon: 'flame' },
    { key: 'power_line',          label: 'Electrical / Power Line Hazard',     group: 'fire',    icon: 'bolt' },
    { key: 'other',               label: 'Others',                            group: 'other',   icon: 'help', requiresText: true }
  ];

  const BY_KEY = {};
  const BY_LABEL = {};
  LIST.forEach((h) => { BY_KEY[h.key] = h; BY_LABEL[h.label.toLowerCase()] = h; });

  const OTHER = BY_KEY.other;

  /* dropdown rows: [key, label], "Others" always last */
  function options() {
    return LIST.map((h) => [h.key, h.label]);
  }

  function byKey(key) { return BY_KEY[key] || null; }

  /* Matches free text against a known label (case-insensitive, exact) first,
     so both a stored key ('flood') and a stored legacy label ('Flood') resolve.
     Anything unrecognised — an old report, a hazard type since removed — is
     treated as 'other' rather than breaking. */
  function classify(hazardTypeText) {
    const raw = String(hazardTypeText || '').trim();
    if (!raw) return OTHER;
    if (BY_KEY[raw]) return BY_KEY[raw];
    const byLabel = BY_LABEL[raw.toLowerCase()];
    if (byLabel) return byLabel;
    return OTHER;
  }

  /* the text to store in reports.hazard_type and to show in every list: the
     canonical label, or "Others: <what they typed>" when they typed one */
  function displayLabel(hazardTypeText, otherText) {
    const h = classify(hazardTypeText);
    if (h.key === 'other' && otherText && otherText.trim()) {
      return h.label + ': ' + otherText.trim();
    }
    return h.label;
  }

  /* colour + icon for a stored hazard_type value, from the theme's type groups */
  function colorFor(hazardTypeText) {
    const h = classify(hazardTypeText);
    const g = (typeof UG_THEME !== 'undefined' && UG_THEME.TYPE_GROUP[h.group]) || null;
    return g ? g.color : '#94A3B8';
  }
  function iconFor(hazardTypeText) { return classify(hazardTypeText).icon; }

  return { LIST, OTHER, options, byKey, classify, displayLabel, colorFor, iconFor };
})();
