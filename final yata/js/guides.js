/* UniGuard · Disaster Preparedness Guides
 *
 * Citizen UI + LGU management surface for the preparedness_guides table
 * (migration 014). Organised by hazard_type with three phases per hazard:
 * before, during, after.
 *
 * The list of hazard types to surface comes from UG_HAZARDS.LIST (the same
 * canonical list used by the report form), so adding a hazard there will
 * automatically get a guide section here.
 */
const UG_GUIDES = (function () {
  const esc = UG_UTIL.esc, I = UG.icon, U = UG;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');

  /* seeded defaults so the UI renders without a Supabase project */
  if (!UG.DATA.guides) {
    UG.DATA.guides = [
      { id: 'G-F-B', hazard_type: 'Flood', phase: 'before', title: 'Before a flood',
        body: 'Identify the nearest evacuation centre and the safest route to it. Keep a go-bag with three days of water, non-perishable food, copies of important documents in a waterproof bag, a flashlight, batteries and a first-aid kit. Charge power banks and sign up for UniGuard push alerts.' },
      { id: 'G-F-D', hazard_type: 'Flood', phase: 'during', title: 'During a flood',
        body: 'Move to higher ground immediately if you are in a low-lying area. Never walk or drive through moving water — even 15 cm can knock you off your feet. Turn off the main electrical switch if water is rising inside the house. Keep monitoring official UniGuard advisories for instructions.' },
      { id: 'G-F-A', hazard_type: 'Flood', phase: 'after', title: 'After a flood',
        body: 'Wait for the official all-clear before returning home. Do not drink tap water until the LGU says it is safe. Photograph damage for insurance and relief claims. Disinfect anything the flood water touched. Report any downed power lines immediately.' },
      { id: 'G-E-B', hazard_type: 'Earthquake', phase: 'before', title: 'Before an earthquake',
        body: 'Identify safe spots in every room: under a sturdy desk, away from windows and heavy furniture that could topple. Bolt heavy shelves to the wall. Keep a go-bag near the exit. Practise "duck, cover, hold" with your family at least twice a year.' },
      { id: 'G-E-D', hazard_type: 'Earthquake', phase: 'during', title: 'During an earthquake',
        body: 'Duck, cover, and hold. Stay where you are until the shaking stops. If you are outside, move to an open area away from buildings, power lines and trees. Do not use elevators. Do not run outdoors while the building is still shaking.' },
      { id: 'G-E-A', hazard_type: 'Earthquake', phase: 'after', title: 'After an earthquake',
        body: 'Check yourself and others for injuries. Inspect your home for structural damage, gas leaks and electrical issues before going back inside. Aftershocks are normal — be ready to duck, cover and hold again.' },
      { id: 'G-FI-B', hazard_type: 'Fire', phase: 'before', title: 'Before a fire',
        body: 'Install smoke alarms on every floor and test them monthly. Keep a fire extinguisher in the kitchen and learn how to use it (PASS: pull, aim, squeeze, sweep). Plan two ways out of every room and agree on a meeting point outside. Never leave cooking unattended.' },
      { id: 'G-FI-D', hazard_type: 'Fire', phase: 'during', title: 'During a fire',
        body: 'Get out fast. Crawl low under smoke. Feel doors with the back of your hand before opening; if hot, use your second way out. Once out, stay out. Call the Bureau of Fire Protection from outside.' },
      { id: 'G-FI-A', hazard_type: 'Fire', phase: 'after', title: 'After a fire',
        body: 'Do not re-enter until the BFP says the structure is safe. Contact your insurance provider and document everything. The LGU relief desk can provide temporary shelter for displaced households.' },
      { id: 'G-SW-B', hazard_type: 'Strong Wind / Typhoon Damage', phase: 'before', title: 'Before a typhoon',
        body: 'Trim tree branches near the house. Reinforce or board up windows. Charge all devices and power banks. Stock up on water, food and fuel. Secure loose objects outside. Monitor PAGASA and UniGuard advisories.' },
      { id: 'G-SW-D', hazard_type: 'Strong Wind / Typhoon Damage', phase: 'during', title: 'During a typhoon',
        body: 'Stay indoors and away from windows. Keep curtains closed. Use battery-powered lights, not candles. If the eye passes over you, do not go outside — the back side of the storm comes from the opposite direction.' },
      { id: 'G-SW-A', hazard_type: 'Strong Wind / Typhoon Damage', phase: 'after', title: 'After a typhoon',
        body: 'Wait for the official all-clear. Watch for downed power lines, broken glass and weakened structures. Do not walk or drive through flooded roads. Report fallen trees and power line hazards through UniGuard.' }
    ];
  }

  /* hazard types surfaced in the guides UI: every known hazard, plus a generic
     "General" entry at the end so the LGU can keep non-hazard-specific content
     (e.g. "Make a family communication plan") somewhere. */
  function guideHazards() {
    const known = UG_HAZARDS.LIST.filter((h) => h.key !== 'other').map((h) => h.label);
    return known.concat(['General']);
  }

  function phaseLabel(p) { return p === 'before' ? 'Before' : p === 'during' ? 'During' : 'After'; }

  /* ------------------------------------------------------------- mobile UI */
  function mGuides(st) {
    const tab = st.guideHazard || UG_HAZARDS.LIST[0].label;
    const phase = st.guidePhase || 'before';
    const hazards = guideHazards();
    const guides = (UG.DATA.guides || []).filter((g) => g.hazard_type === tab);
    const byPhase = (p) => guides.filter((g) => g.phase === p).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const phases = ['before', 'during', 'after'];

    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Disaster Preparedness</div>' +
      '<h2 style="font-size:19px;margin-top:3px">Preparedness Guides</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Step-by-step guidance for the hazards that affect ' + esc(UG_GEO.PLACE.label) + '. Pick a hazard, then read the Before / During / After tab.</p></div>' +

      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + hazards.map((h) =>
        '<button class="ug-chip' + (tab === h ? ' is-on' : '') + '"' + A('guide-hazard', attr({ v: h })) + '>' + esc(h) + '</button>').join('') + '</div>' +

      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + phases.map((p) =>
        '<button class="ug-chip' + (phase === p ? ' is-on' : '') + '"' + A('guide-phase', attr({ v: p })) + '>' + phaseLabel(p) + '</button>').join('') + '</div>' +

      (byPhase(phase).length ? byPhase(phase).map((g) => guideCard(g)).join('') :
        '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('doc', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No ' + phaseLabel(phase) + ' guide for ' + esc(tab) + ' yet</div>' +
        '<div class="ug-dim" style="font-size:11px">The LGU can add content from the command console.</div></div></div>') +
    '</div>';
  }

  function guideCard(g) {
    return '<div class="ug-card">' +
      '<div class="ug-card-h"><h3>' + esc(g.title) + '</h3>' + U.badge('id', phaseLabel(g.phase)) + '</div>' +
      '<div class="ug-card-b"><p class="ug-dim" style="font-size:13px;line-height:1.65">' + esc(g.body) + '</p></div>' +
    '</div>';
  }

  /* ------------------------------------------------------------- LGU admin */
  function dGuides(st) {
    const hazards = UG_HAZARDS.LIST.filter((h) => h.key !== 'other').map((h) => h.label).concat(['General']);
    const tab = st.guideHazard || hazards[0];
    const phase = st.guidePhase || 'before';
    const guides = (UG.DATA.guides || []).filter((g) => g.hazard_type === tab && g.phase === phase);

    return '<div class="ug-col" style="gap:18px">' +
      head('Preparedness Guides', 'Add or edit disaster preparedness content. Changes appear in the citizen app immediately — no release required.',
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('guide-add') + '>' + I('plus', 15) + 'Add Guide</button>') +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + hazards.map((h) =>
        '<button class="ug-chip' + (tab === h ? ' is-on' : '') + '"' + A('guide-hazard', attr({ v: h })) + '>' + esc(h) + '</button>').join('') + '</div>' +
      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:7px">' + ['before', 'during', 'after'].map((p) =>
        '<button class="ug-chip' + (phase === p ? ' is-on' : '') + '"' + A('guide-phase', attr({ v: p })) + '>' + phaseLabel(p) + '</button>').join('') + '</div>' +
      '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(tab) + ' · ' + phaseLabel(phase) + '</h3>' +
        '<span class="ug-chip is-on">' + guides.length + ' guides</span></div>' +
        '<div class="ug-rows">' + (guides.length ? guides.map((g) =>
          '<div class="ug-row"><span class="r-dot" style="background:var(--ug-signal)"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(g.title) + '</div>' +
              '<div class="r-m">' + esc(g.body.slice(0, 100)) + (g.body.length > 100 ? '…' : '') + '</div></div>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="guide-edit" data-id="' + esc(g.id) + '">' + I('settings', 14) + 'Edit</button></div>').join('') :
          '<div class="ug-empty"><span class="e-ico">' + I('doc', 20) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No guides yet for this combination</div>' +
          '<div class="ug-dim" style="font-size:11px">Add the first one.</div></div>') + '</div></div>' +
    '</div>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mGuides, dGuides, phaseLabel, guideHazards, head };
})();
