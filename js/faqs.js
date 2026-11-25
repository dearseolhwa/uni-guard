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
      '<h2 style="font-size:18px;margin-top:3px">Help Center</h2></div>' +
      '<div class="ug-card"><div class="ug-card-b"><input class="ug-in" data-field="faqSearch" placeholder="Search FAQs…" value="' + esc(st.faqSearch || '') + '"></div></div>' +
      (cats.length === 0 ? '<div class="ug-card"><div class="ug-empty"><span class="e-ico">' + I('help', 20) + '</span>' +
        '<div style="font-size:13px;font-weight:600;color:var(--ug-ink-2)">No FAQs yet</div>' +
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
      '<p class="ug-dim" style="font-size:13px;line-height:1.65;margin-top:8px">' + esc(f.answer) + '</p></details>';
  }

  /* --------------------------------------------------------------- LGU */
  function dFaqs(st) {
    /* Layout (Nov 2026): category pills + search, questions grouped by
       category, each one opens to its answer; edit / delete as quiet round
       buttons. Same faq-add / faq-edit / faq-del actions. */
    const all = UG.DATA.faqs || [];
    const counts = all.reduce((m, f) => { const c = f.category || 'General'; m[c] = (m[c] || 0) + 1; return m; }, {});
    const cats = Object.keys(counts).sort();
    const cf = st.faqCat && (st.faqCat === 'all' || counts[st.faqCat]) ? st.faqCat : 'all';
    const q = String(st.faqAdminQ || '').trim().toLowerCase();
    const rows = all.filter((f) => cf === 'all' || (f.category || 'General') === cf)
      .filter((f) => !q || [f.question, f.answer, f.category].some((v) => String(v || '').toLowerCase().indexOf(q) >= 0));
    const stop = ' onclick="event.preventDefault()"';
    const item = (f) => '<details class="fq-item">' +
        '<summary><span class="fq-chev">' + I('chevron', 14) + '</span>' +
          '<span class="fq-q">' + esc(f.question) + '</span>' +
          '<span class="fq-acts">' +
            '<button class="hl-ico" data-act="faq-edit" data-id="' + esc(f.id) + '" title="Edit" aria-label="Edit"' + stop + '>' + I('settings', 14) + '</button>' +
            '<button class="hl-ico is-del" data-act="faq-del" data-id="' + esc(f.id) + '" title="Delete" aria-label="Delete"' + stop + '>' + I('x', 14) + '</button>' +
          '</span></summary>' +
        '<p class="fq-a">' + esc(f.answer) + '</p>' +
      '</details>';
    const groups = (cf === 'all' ? cats : [cf]).map((c) => {
      const list = rows.filter((f) => (f.category || 'General') === c);
      if (!list.length) return '';
      return '<section class="fq-group"><header><h3>' + esc(c) + '</h3><span>' + list.length + ' question' + (list.length === 1 ? '' : 's') + '</span></header>' +
        list.map(item).join('') + '</section>';
    }).join('');

    return '<div class="ug-col fq" style="gap:20px">' +
      head('FAQ Management', 'Questions residents see in the Help Center. Changes appear right away.',
        '<button class="hl-ghost hl-primary fq-add"' + A('faq-add') + ' aria-label="Add FAQ">' + I('plus', 14) + 'Add FAQ</button>') +
      '<div class="hl-tool fq-tool">' +
        /* phones: the category as a compact dropdown left of the search */
        (function () {
          const opts = [['all', 'All', all.length]].concat(cats.map((c) => [c, c, counts[c]]));
          const cur = opts.find((o) => o[0] === cf) || opts[0];
          return '<div class="ug-wmore inc-dd hl-dd fq-dd"><button class="inc-dd-btn"' + A('toggle-more') + ' aria-haspopup="listbox" aria-label="Category">' +
              I('sort', 15) + '<span>' + esc(cur[1]) + '</span>' + I('chevdn', 14) + '</button>' +
            '<div class="inc-dd-panel" data-more-panel hidden role="listbox">' + opts.map((o) =>
              '<button role="option" class="' + (o[0] === cf ? 'is-on' : '') + '"' + A('faq-cat', attr({ v: o[0] })) + '>' +
                '<span>' + esc(o[0] === 'all' ? 'All categories' : o[1]) + '</span><b>' + o[2] + '</b>' + (o[0] === cf ? I('check', 14) : '') + '</button>').join('') +
            '</div></div>';
        })() +
        '<label class="fq-sel"><span>' + I('layers', 14) + '</span><select data-field="rw.faqCat" aria-label="Category">' +
          [['all', 'All categories', all.length]].concat(cats.map((c) => [c, c, counts[c]])).map((t) =>
            '<option value="' + esc(t[0]) + '"' + (cf === t[0] ? ' selected' : '') + '>' + esc(t[1]) + ' (' + t[2] + ')</option>').join('') + '</select></label>' +
        '<span class="sos-search">' + I('search', 14) + '<input data-field="rw.faqAdminQ" value="' + esc(st.faqAdminQ || '') + '" placeholder="Search FAQs" aria-label="Search questions and answers">' +
          (st.faqAdminQ ? '<button data-act="faq-q-clear" aria-label="Clear search">' + I('x', 11) + '</button>' : '') + '</span></div>' +
      (groups || '<div class="rl-card"><div class="rl-empty"><span>' + I('help', 20) + '</span><b>' + (all.length ? 'No question matches' : 'No FAQs yet') + '</b><p>' +
        (all.length ? 'Try another category or clear the search.' : 'Add the first question residents often ask.') + '</p>' +
        (all.length ? '' : '<button class="hl-ghost hl-primary"' + A('faq-add') + '>' + I('plus', 14) + 'Add FAQ</button>') + '</div></div>') +
    '</div>';
  }

  function head(title, sub, actions) {
    return '<div class="ug-rowf ug-between ug-wrap ug-phead" style="gap:14px;align-items:flex-end">' +
      '<div><h2 style="font-size:20px">' + esc(title) + '</h2>' +
      '<p class="ug-dim" style="font-size:12px;margin-top:4px">' + esc(sub) + '</p></div>' +
      '<div class="ug-rowf ug-gap8" style="gap:8px">' + (actions || '') + '</div></div>';
  }

  return { mFaqs, dFaqs, head };
})();
