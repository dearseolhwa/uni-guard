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


  /* ============================================== content → structured steps
     How guide rows are stored (migration 014 + 032, production seed):
       · one row per hazard + phase (phase is 'before' | 'during' | 'after')
       · the instructions are in `body` AND in the matching phase column
         (body_before / body_during / body_after); the other two are empty
       · the text is an optional introduction line followed by numbered steps,
         one per line:  "INTRO.\n1) First step...\n2) Second step..."
     Older / form-created rows may carry phase 'all' with up to three phase
     columns filled. Everything below works on both shapes, and the citizen
     screen, the LGU list and the PDF export all use these same functions. */

  const PHASES = ['before', 'during', 'after'];

  /* The text a guide row holds for one phase: the phase column first, then
     `body` when the row itself belongs to that phase. Never another phase's text. */
  function phaseText(g, phase) {
    if (!g) return '';
    const own = String(g['body_' + phase] || '');
    if (own.trim()) return own;
    if (g.phase === phase) return String(g.body || '');
    return '';
  }

  /* Rows to show for a hazard + phase, in sort order. A row tagged with a
     specific phase only appears under that phase. */
  function guidesFor(list, hazard, phase) {
    return (list || [])
      .filter((g) => g && g.active !== false && g.hazard_type === hazard)
      .filter((g) => (g.phase === phase) || (PHASES.indexOf(g.phase) === -1 && phaseText(g, phase).trim()))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  /* A line that starts a step: "1) ", "1. ", "1 - ", "Step 1: ", or a bullet. */
  const STEP_RE = /^\s*(?:step\s+)?(\d{1,2})\s*[).:\-\u2013]\s+(.*)$/i;
  const BULLET_RE = /^\s*[\u2022\u2023\u25e6*\-]\s+(.*)$/;

  /* "1) a 2) b 3) c" written on one line: split only at the NEXT expected
     number, so numbers inside a sentence ("Signal No. 2", "0912-078") stay. */
  function splitInline(text, startNo) {
    const out = [];
    let rest = text, next = startNo + 1;
    for (;;) {
      /* find "<space>N) " for the next expected N, skipping references such
         as "Signal No. 2)" (no regex lookbehind: older iOS Safari lacks it) */
      const re = new RegExp('\\s' + next + '\\)\\s+', 'g');
      let m, at = -1, len = 0;
      while ((m = re.exec(rest))) {
        if (!/\bno\.?\s*$/i.test(rest.slice(0, m.index))) { at = m.index; len = m[0].length; break; }
      }
      if (at <= 0) break;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at + len);
      next++;
    }
    out.push(rest.trim());
    return out;
  }

  /* text → { blocks, intro, steps, outro, issues }
     · blocks keeps the original order: { type: 'p', text } paragraphs and
       { type: 'step', no, text } steps, interleaved exactly as written
     · intro / outro are the paragraphs before the first / after the last step
     · nothing is rewritten or dropped: every non-blank line ends up in a
       paragraph or a step, in its original order
     · an unnumbered line right after a step continues that step (multi-line
       steps); after a blank line it starts a paragraph instead
     · the step's own number prefix is removed because the card shows the
       number; gaps or repeats in the source numbering are reported in issues */
  function parseSteps(raw) {
    const res = { blocks: [], intro: [], steps: [], outro: [], issues: [] };
    const text = String(raw == null ? '' : raw).replace(/\r\n?/g, '\n');
    if (!text.trim()) return res;
    let para = [];
    let cur = null;
    let blankSinceStep = false;
    const flushPara = () => { if (para.length) { res.blocks.push({ type: 'p', text: para.join('\n') }); para = []; } };
    const pushStep = (no, body) => {
      cur = { type: 'step', no: no, text: body };
      res.blocks.push(cur);
      blankSinceStep = false;
    };
    text.split('\n').forEach((line) => {
      if (!line.trim()) { if (cur) blankSinceStep = true; else flushPara(); return; }
      const m = line.match(STEP_RE);
      const b = m ? null : line.match(BULLET_RE);
      if (m || b) {
        flushPara();
        if (m) {
          const no = Number(m[1]);
          splitInline(m[2], no).forEach((t, k) => pushStep(no + k, t));
        } else {
          pushStep(null, b[1].trim());
        }
        return;
      }
      /* several numbered items written inside one paragraph line:
         "Checklist: 1) water 2) food 3) radio" → the lead-in, then steps */
      const inl = line.match(/^(.*?\S)\s+1\)\s+(.*)$/);
      if (inl && /(^|\s)2\)\s/.test(inl[2])) {
        const items = splitInline(inl[2], 1);
        if (items.length > 1) {
          if (cur && !blankSinceStep) { cur.text += '\n' + inl[1].trim(); } else { cur = null; para.push(inl[1].trim()); }
          flushPara();
          items.forEach((t, k) => pushStep(1 + k, t));
          return;
        }
      }
      if (cur && !blankSinceStep) { cur.text += '\n' + line.trim(); return; }
      cur = null;
      para.push(line.trim());
    });
    flushPara();
    res.steps = res.blocks.filter((x) => x.type === 'step');
    const first = res.blocks.findIndex((x) => x.type === 'step');
    let last = -1; res.blocks.forEach((x, k) => { if (x.type === 'step') last = k; });
    res.intro = res.blocks.filter((x, k) => x.type === 'p' && (first === -1 || k < first)).map((x) => x.text);
    res.outro = first === -1 ? [] : res.blocks.filter((x, k) => x.type === 'p' && k > last).map((x) => x.text);
    const nums = res.steps.map((x) => x.no).filter((n) => n != null);
    nums.forEach((n, k) => { if (k === 0 ? n !== 1 : n !== nums[k - 1] + 1) res.issues.push('Step number ' + n + ' follows ' + (k ? nums[k - 1] : 'the start')); });
    if (nums.length && nums.length !== res.steps.length) res.issues.push('Numbered and bulleted items are mixed');
    if (first !== -1 && res.blocks.some((x, k) => x.type === 'p' && k > first && k < last)) res.issues.push('A paragraph sits between numbered steps');
    return res;
  }

  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  /* parsed content → HTML. Every value is escaped; stored text is never
     interpreted as markup. Steps are numbered by position (01, 02 …) in the
     source order. */
  function contentHtml(raw) {
    const c = parseSteps(raw);
    if (!c.blocks.length) return '';
    if (!c.steps.length) return '<div class="ug-guide-text">' + c.intro.map((t) => '<p class="ug-guide-intro">' + esc(t) + '</p>').join('') + '</div>';
    if (c.issues.length && typeof console !== 'undefined') console.info('[UniGuard guides] content note:', c.issues.join('; '));
    let html = '', n = 0, open = false, seenStep = false;
    c.blocks.forEach((b) => {
      if (b.type === 'step') {
        if (!open) { html += '<ol class="ug-gsteps" role="list"' + (n ? ' start="' + (n + 1) + '"' : '') + '>'; open = true; }
        n++; seenStep = true;
        html += '<li class="ug-gstep">' +
          '<span class="ug-gstep-n" aria-hidden="true">' + pad2(n) + '</span>' +
          '<span class="ug-vh">Step ' + n + ': </span>' +
          '<div class="ug-gstep-t">' + esc(b.text) + '</div></li>';
      } else {
        if (open) { html += '</ol>'; open = false; }
        html += '<p class="' + (seenStep ? 'ug-guide-note' : 'ug-guide-intro') + '">' + esc(b.text) + '</p>';
      }
    });
    if (open) html += '</ol>';
    return html;
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
    const byPhase = (p) => guidesFor(UG.DATA.guides, tab, p);
    const phases = PHASES;

    return '<div class="ug-col" style="gap:14px">' +
      '<div class="ug-rowf ug-between ug-wrap" style="gap:10px;align-items:flex-end">' +
        '<div><div class="ug-lab">Disaster Preparedness</div>' +
        '<h2 style="font-size:19px;margin-top:3px">Preparedness Guides</h2>' +
        '<p class="ug-dim" style="font-size:12px;margin-top:5px;line-height:1.5">Step-by-step guidance for the hazards that affect ' + esc(UG_GEO.PLACE.label) + '. Pick a hazard, then read the Before / During / After tab.</p></div>' +
        '<div class="ug-rowf ug-gap8 ug-wrap ug-guide-actions" style="gap:8px">' +
          '<button class="ug-btn ug-btn--ghost ug-btn--sm"' + A('guide-download', attr({ hazard: tab })) + '>' + I('download', 15) + 'Download ' + esc(tab) + ' PDF</button>' +
          '<button class="ug-btn ug-btn--sm"' + A('guide-download', attr({ hazard: 'all' })) + '>' + I('doc', 15) + 'All Guides PDF</button>' +
        '</div>' +
      '</div>' +

      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + hazards.map((h) =>
        '<button class="ug-chip' + (tab === h ? ' is-on' : '') + '"' + A('guide-hazard', attr({ v: h })) + '>' + esc(h) + '</button>').join('') + '</div>' +

      '<div class="ug-rowf ug-gap8 ug-wrap" style="gap:6px">' + phases.map((p) =>
        '<button class="ug-chip' + (phase === p ? ' is-on' : '') + '"' + A('guide-phase', attr({ v: p })) + '>' + phaseLabel(p) + '</button>').join('') + '</div>' +

      (byPhase(phase).length ? byPhase(phase).map((g) => guideCard(g, phase)).join('') :
        '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('doc', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No ' + phaseLabel(phase) + ' guide for ' + esc(tab) + ' yet</div>' +
        '<div class="ug-dim" style="font-size:11px">The LGU can add content from the command console.</div></div></div>') +
    '</div>';
  }

  /* One guide for one phase: header (title, phase), optional summary, the
     introduction, then one card per numbered step. */
  function guideCard(g, phase) {
    const p = PHASES.indexOf(g.phase) !== -1 ? g.phase : phase;
    const body = contentHtml(phaseText(g, p));
    return '<article class="ug-card ug-guide" data-guide="' + esc(g.id || '') + '">' +
      '<div class="ug-card-h"><h3>' + esc(g.title) + '</h3>' + U.badge('id', phaseLabel(p)) + '</div>' +
      '<div class="ug-card-b ug-guide-b">' +
        (g.summary ? '<p class="ug-guide-sum">' + esc(g.summary) + '</p>' : '') +
        (body || '<p class="ug-dim" style="font-size:12.5px">No instructions recorded for this phase yet.</p>') +
      '</div>' +
    '</article>';
  }

  /* ------------------------------------------------------------- LGU admin */
  function dGuides(st) {
    const hazards = UG_HAZARDS.LIST.filter((h) => h.key !== 'other').map((h) => h.label).concat(['General']);
    const tab = st.guideHazard || hazards[0];
    const phase = st.guidePhase || 'before';
    const guides = guidesFor(UG.DATA.guides, tab, phase);

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
              '<div class="r-m">' + esc(listPreview(g, phase)) + '</div></div>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="guide-edit" data-id="' + esc(g.id) + '">' + I('settings', 14) + 'Edit</button></div>').join('') :
          '<div class="ug-empty"><span class="e-ico">' + I('doc', 20) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No guides yet for this combination</div>' +
          '<div class="ug-dim" style="font-size:11px">Add the first one.</div></div>') + '</div></div>' +
    '</div>';
  }

  /* LGU list line: how many steps, then the start of the introduction */
  function listPreview(g, phase) {
    const c = parseSteps(phaseText(g, PHASES.indexOf(g.phase) !== -1 ? g.phase : phase));
    const lead = (c.intro[0] || (c.steps[0] && c.steps[0].text) || '').replace(/\s+/g, ' ');
    return (c.steps.length ? c.steps.length + ' step' + (c.steps.length === 1 ? '' : 's') + ' \u00b7 ' : '') +
      (lead.length > 100 ? lead.slice(0, 100) + '\u2026' : lead);
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mGuides, dGuides, phaseLabel, guideHazards, head, PHASES, phaseText, guidesFor, parseSteps, contentHtml };
})();
