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
  /* ----------------------------------------------------------------+ A3 + B2
   * A3: `teams: [...]` is the suggested-responder list for each hazard key.
   *     The dispatch form (js/app.js dispatchModal) reads it to mark
   *     "Suggested" teams and sort them first. All teams remain pickable.
   *
   *     Default mapping (PDF Oct 24 2026, to confirm with the LDRRMO):
   *       fire, power_line            -> BFP, Barangay Response Team
   *       flood, river_overflow,
   *       drainage_blockage,
   *       storm_surge, coastal_erosion -> Barangay Response Team, Rescue Unit
   *       strong_wind, fallen_tree     -> Barangay Response Team
   *       landslide, earthquake        -> Rescue Unit, Ambulance,
   *                                      Barangay Response Team
   *       vehicular_accident           -> PNP, Ambulance
   *       road_damage                  -> PNP, Barangay Response Team
   *       other                        -> (none)
   *
   * B2: `checklist: [...]` is the static first-response checklist per
   *     hazard key for the Barangay Response Team. Ticks are saved into
   *     field_data.checklist_done[] and copied into the after-action report
   *     by submit_after_action. Other teams do not use this list.
   */
  const LIST = [
    { key: 'flood',               label: 'Flood',                              group: 'water',   icon: 'flood',
      teams: ['Barangay Response Team', 'Rescue Unit'],
      checklist: ['Warn low-lying households','Monitor water level','Pre-position boats and life vests','Clear drainage paths','Assist evacuation to higher ground'] },
    { key: 'river_overflow',      label: 'River Overflow',                     group: 'water',   icon: 'flood',
      teams: ['Barangay Response Team', 'Rescue Unit'],
      checklist: ['Warn households near the riverbank','Monitor river gauge','Pre-position boats','Assist evacuation','Watch for flash flood'] },
    { key: 'drainage_blockage',   label: 'Drainage Blockage',                  group: 'water',   icon: 'drain',
      teams: ['Barangay Response Team', 'Rescue Unit'],
      checklist: ['Identify the blocked section','Warn motorists and pedestrians','Coordinate with the LGU engineering','Clear debris if safe','Monitor for rising water'] },
    { key: 'storm_surge',         label: 'Storm Surge',                        group: 'coastal', icon: 'wave',
      teams: ['Barangay Response Team', 'Rescue Unit'],
      checklist: ['Warn coastal households','Order preemptive evacuation','Pre-position boats','Monitor tide and wind','Assist vulnerable residents'] },
    { key: 'coastal_erosion',     label: 'Coastal Erosion',                    group: 'coastal', icon: 'wave',
      teams: ['Barangay Response Team', 'Rescue Unit'],
      checklist: ['Warn households on the shoreline','Mark unsafe structures','Coordinate with the LGU engineering','Assist relocation','Document the scarp'] },
    { key: 'strong_wind',         label: 'Strong Wind / Typhoon Damage',       group: 'wind',    icon: 'wind',
      teams: ['Barangay Response Team'],
      checklist: ['Warn households','Secure loose roofing and signs','Clear debris from roads','Check on elderly and PWDs','Monitor official advisories'] },
    { key: 'fallen_tree',         label: 'Fallen Tree',                        group: 'wind',    icon: 'tree',
      teams: ['Barangay Response Team'],
      checklist: ['Cordon off the area','Check for downed power lines','Clear the roadway','Notify LGU engineering if heavy equipment needed','Photograph before and after'] },
    { key: 'landslide',           label: 'Landslide / Soil Erosion',           group: 'earth',   icon: 'landslide',
      teams: ['Rescue Unit', 'Ambulance', 'Barangay Response Team'],
      checklist: ['Cordon off the area','Search for buried persons','Stabilise the slope if safe','Assist evacuation upslope','Document the scarp'] },
    { key: 'earthquake',          label: 'Earthquake',                         group: 'earth',   icon: 'quake',
      teams: ['Rescue Unit', 'Ambulance', 'Barangay Response Team'],
      checklist: ['Drop, cover, hold during shaking','Check on neighbours','Search for trapped persons','Mark unsafe structures','Coordinate with the LGU'] },
    { key: 'road_damage',         label: 'Road Damage',                        group: 'infra',   icon: 'road',
      teams: ['PNP', 'Barangay Response Team'],
      checklist: ['Cordon off the damaged section','Warn motorists','Notify the LGU engineering','Document with photos','Set up a detour if needed'] },
    { key: 'vehicular_accident',  label: 'Vehicular Accident',                 group: 'infra',   icon: 'car',
      teams: ['PNP', 'Ambulance'],
      checklist: ['Cordon off the area','Check for injuries','Call for an ambulance if needed','Document the scene','Direct traffic around the scene'] },
    { key: 'fire',                label: 'Fire',                               group: 'fire',    icon: 'flame',
      teams: ['BFP', 'Barangay Response Team'],
      checklist: ['Warn nearby households','Evacuate downwind','Check for trapped persons','Assist the BFP with crowd control','Account for residents'] },
    { key: 'power_line',          label: 'Electrical / Power Line Hazard',     group: 'fire',    icon: 'bolt',
      teams: ['BFP', 'Barangay Response Team'],
      checklist: ['Cordon off the area','Keep people at least 10 m away','Notify the utility company','Do not touch the line','Photograph the scene'] },
    { key: 'other',               label: 'Others',                            group: 'other',   icon: 'help', requiresText: true,
      teams: [], checklist: [] }
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

  /* A3 — suggested teams for a hazard key. Always returns an array (empty
     when the hazard has no suggestion or the hazard is unknown). */
  function suggestedTeams(hazardTypeText) {
    const h = classify(hazardTypeText);
    return (h && Array.isArray(h.teams)) ? h.teams.slice() : [];
  }

  /* B2 — first-response checklist for the Barangay Response Team. */
  function checklistFor(hazardTypeText) {
    const h = classify(hazardTypeText);
    return (h && Array.isArray(h.checklist)) ? h.checklist.slice() : [];
  }

  return { LIST, OTHER, options, byKey, classify, displayLabel, colorFor, iconFor, suggestedTeams, checklistFor };
})();
