/* UniGuard · FAQ module
 *
 * Citizen UI + LGU CRUD for the faqs table (migration 013). Citizens get a
 * searchable, category-grouped list. LGU gets a CRUD surface in the command
 * console.
 */
const UG_FAQS = (function () {
  const esc = UG_UTIL.esc, I = UG.icon, U = UG;
  const A = (act, extra) => ' data-act="' + act + '"' + (extra ? ' ' + extra : '');
  const attr = (o) => Object.keys(o).map(k => ' data-' + k + '="' + esc(o[k]) + '"').join('');

  if (!UG.DATA.faqs) {
    UG.DATA.faqs = [
      { id: 'F-01', category: 'Reports', question: 'How long does a report stay editable?',
        answer: 'Reports stay editable for 15 minutes after submission. After that, only an LGU official can update the status.' },
      { id: 'F-02', category: 'Reports', question: 'What happens after I submit a report?',
        answer: 'It joins your barangay queue. Three matching reports in the same barangay within six hours auto-verify it. An official then advances it through Verified, In Progress, and Resolved.' },
      { id: 'F-03', category: 'Reports', question: 'Can I report on behalf of a neighbor?',
        answer: 'Yes. Use your own account and pick the correct barangay. The report is logged to your account so officials can follow up with you.' },
      { id: 'F-04', category: 'Relief', question: 'Who is eligible for a relief pack?',
        answer: 'Eligibility is set per distribution by the LGU. Common categories are affected household, senior citizen and person with disability. Open the Relief tab and pick your barangay to see the current criteria.' },
      { id: 'F-05', category: 'Relief', question: 'What should I bring to claim a relief pack?',
        answer: 'A valid government ID, your barangay certificate, and — if you are claiming on behalf of a named beneficiary — an authorization letter. The relief screen lists exactly what each distribution requires.' },
      { id: 'F-06', category: 'Evacuation', question: 'How do I find the nearest open shelter?',
        answer: 'Open the Shelters tab. Open shelters are listed first; the Waze button routes you to them. The list also works offline once you have loaded it once.' },
      { id: 'F-07', category: 'SOS', question: 'What does the SOS button do?',
        answer: 'One tap sends your current GPS position, your name and your contact number to the LGU/LDRRMO duty officers. A confirmation screen appears when the SOS has been logged. SOS is rate-limited to 5 calls per 10 minutes.' }
    ];
  }

  /* --------------------------------------------------------------- citizen */
  function mFaqs(st) {
    const q = (st.faqSearch || '').toLowerCase().trim();
    const cats = Array.from(new Set((UG.DATA.faqs || []).map((f) => f.category))).sort();
    const list = (UG.DATA.faqs || [])
      .filter((f) => !q || (f.question.toLowerCase().indexOf(q) >= 0 || f.answer.toLowerCase().indexOf(q) >= 0 || f.category.toLowerCase().indexOf(q) >= 0));
    return '<div class="ug-col" style="gap:14px">' +
      '<div><div class="ug-lab">Frequently Asked Questions</div>' +
      '<h2 style="font-size:19px;margin-top:3px">Help Center</h2></div>' +
      '<div class="ug-card"><div class="ug-card-b"><input class="ug-in" data-field="faqSearch" placeholder="Search FAQs…" value="' + esc(st.faqSearch || '') + '"></div></div>' +
      (cats.length === 0 ? '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('help', 20) + '</span>' +
        '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No FAQs yet</div>' +
        '<div class="ug-dim" style="font-size:11px">The LGU has not published any FAQs.</div></div></div>' :
        cats.map((cat) => {
          const rows = list.filter((f) => f.category === cat);
          if (!rows.length) return '';
          return '<div class="ug-card"><div class="ug-card-h"><h3>' + esc(cat) + '</h3><span class="ug-chip is-on">' + rows.length + '</span></div>' +
            '<div class="ug-card-b ug-col" style="gap:13px">' + rows.map((f) => faqItem(f)).join('') + '</div></div>';
        }).join('')) +
    '</div>';
  }

  function faqItem(f) {
    return '<details class="ug-faq"><summary>' + esc(f.question) + '</summary>' +
      '<p class="ug-dim" style="font-size:12.5px;line-height:1.65;margin-top:8px">' + esc(f.answer) + '</p></details>';
  }

  /* --------------------------------------------------------------- LGU */
  function dFaqs(st) {
    const rows = UG.DATA.faqs || [];
    return '<div class="ug-col" style="gap:18px">' +
      head('FAQ Management', 'Add, edit or remove entries. Citizens see changes immediately — no app release required.',
        '<button class="ug-btn ug-btn--signal ug-btn--sm"' + A('faq-add') + '>' + I('plus', 15) + 'Add FAQ</button>') +
      '<div class="ug-card"><div class="ug-card-h"><h3>All FAQs</h3><span class="ug-chip is-on">' + rows.length + '</span></div>' +
        '<div class="ug-rows ug-scroll" style="max-height:520px">' + (rows.length ? rows.map((f) =>
          '<div class="ug-row"><span class="r-dot" style="background:var(--ug-signal)"></span>' +
            '<div class="r-main"><div class="r-t">' + esc(f.question) + '</div>' +
              '<div class="r-m"><span class="ug-mono">' + esc(f.category) + '</span><span>' + esc(f.answer.slice(0, 80)) + (f.answer.length > 80 ? '…' : '') + '</span></div></div>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="faq-edit" data-id="' + esc(f.id) + '">' + I('settings', 14) + '</button>' +
            '<button class="ug-btn ug-btn--sm ug-btn--ghost" data-act="faq-del" data-id="' + esc(f.id) + '">' + I('x', 14) + '</button></div>').join('') :
          '<div class="ug-empty"><span class="e-ico">' + I('help', 20) + '</span>' +
          '<div style="font-size:12.5px;font-weight:600;color:var(--ug-ink-2)">No FAQs yet</div>' +
          '<div class="ug-dim" style="font-size:11px">Add the first one.</div></div>') + '</div></div>' +
    '</div>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mFaqs, dFaqs, head };
})();
