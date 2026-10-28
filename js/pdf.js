/* UniGuard · formal PDF documents (js/pdf.js)
 *
 * The one PDF engine in the system. Every PDF export goes through
 * UG_PDF.formal(spec), which applies the shared document template:
 *
 *   page 1   letterhead (LGU and office from the organisation profile, the
 *            system name, the document type), title, subtitle, a metadata
 *            block (export ID, generated date and time in PHT, prepared by,
 *            source module, reporting period, data scope, filters, record
 *            count) and any notices
 *   page 2+  a compact running header with the document title
 *   every    a footer with the system and document name, the scope and
 *   page     period, the generated date and "Page X of Y"
 *
 * Body blocks (spec.blocks), drawn in order with automatic page breaks:
 *   { type: 'table',    name, note, columns: [{ label, type, width }], rows, total, emptyText }
 *   { type: 'keyvalue', name, note, rows: [[label, value]] }
 *   { type: 'kpis',     name, items: [{ label, value, sub }] }
 *   { type: 'bars',     name, note, items: [[label, number]], unit }
 *   { type: 'text',     name, text }
 *   { type: 'heading',  text, level }        a section title kept with what follows
 *   { type: 'steps',    name, note, content: [{ type: 'p' | 'step', text }] }
 *                                            numbered instructions, one box per step
 * plus spec.signoff = [{ label, name, title }] for blank signature lines.
 *
 * Tables repeat their header on every page, wrap long text, right-align
 * numbers, avoid splitting a row across pages and say so when they are
 * empty. Uses the vendored jsPDF + jspdf-autotable (vendor/, no CDN).
 *
 * The standard PDF fonts cover Latin-1 and the Windows-1252 punctuation, so
 * Filipino and Spanish names (ñ, é, ü) print as typed. Symbols outside that
 * set (→, ≥, ₱, emoji) are replaced with plain-text equivalents.
 */
const UG_PDF = (function () {
  const X = () => UG_EXPORT;

  function ready() {
    return typeof window !== 'undefined' &&
      window.jspdf && window.jspdf.jsPDF &&
      typeof window.jspdf.jsPDF.API !== 'undefined' &&
      typeof window.jspdf.jsPDF.API.autoTable === 'function';
  }
  function requireEngine() {
    if (!ready()) throw new Error('The PDF engine has not loaded yet. Check your connection and retry.');
  }

  /* ------------------------------------------------------------ text safety */
  const SWAP = {
    '\u2192': '->', '\u2190': '<-', '\u2194': '<->', '\u21d2': '=>', '\u2265': '>=', '\u2264': '<=', '\u2260': '!=',
    '\u20b1': 'PHP ', '\u2713': 'Yes', '\u2714': 'Yes', '\u2717': 'No', '\u00a0': ' ', '\u2009': ' ', '\u202f': ' ',
    '\u2212': '-', '\u2011': '-', '\u2010': '-', '\u2032': "'", '\u2033': '"', '\u2248': '~', '\u00d7': 'x'
  };
  /* Windows-1252 extras the standard fonts can draw */
  const CP1252 = '\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178';
  function safe(s) {
    if (s == null) return '';
    let out = '';
    const str = String(s).replace(/\r\n?/g, '\n');
    for (const ch of str) {
      const c = ch.codePointAt(0);
      if (ch === '\n' || ch === '\t') { out += ch === '\t' ? ' ' : ch; continue; }
      if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff)) { out += ch; continue; }
      if (CP1252.indexOf(ch) !== -1) { out += ch; continue; }
      if (SWAP[ch] != null) { out += SWAP[ch]; continue; }
      /* accented letters outside Latin-1: drop the accent (ŝ → s) */
      const base = ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      if (base && base !== ch && /^[\x20-\x7e]+$/.test(base)) { out += base; continue; }
      if (c < 0x20) continue;
      out += '?';
    }
    return out;
  }

  /* ---------------------------------------------------------------- palette */
  const INK = [11, 18, 32], INK2 = [51, 65, 85], MUTED = [100, 116, 139], RULE = [148, 163, 184];
  const NAVY = [12, 21, 36], ZEBRA = [246, 248, 251], LINE = [214, 222, 232], TOTAL = [232, 238, 247];

  /* ------------------------------------------------------------------ build */
  /* spec: { meta (UG_EXPORT.buildMetadata), subtitle, landscape, blocks,
             signoff, filename } → { filename, rows, pages } */
  function formal(spec) {
    requireEngine();
    const meta = spec.meta;
    if (!meta) throw new Error('Document metadata is missing.');
    const jsPDF = window.jspdf.jsPDF;
    const orient = spec.landscape ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation: orient, unit: 'pt', format: 'a4', compress: true });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 40;                 /* side margins */
    const TOP = 58;               /* content top on continuation pages */
    const BOTTOM = 60;            /* reserved for the footer */
    const CW = W - M * 2;
    const org = meta.org || X().org();

    doc.setProperties({
      title: safe(meta.title),
      subject: safe([meta.kind, meta.scope, meta.period].filter(Boolean).join(' \u00b7 ')),
      author: safe(meta.preparedBy),
      keywords: safe(['UniGuard', meta.kind, meta.exportId].filter(Boolean).join(', ')),
      creator: safe(X().SYSTEM_FULL)
    });

    const setFont = (style, size, color) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor.apply(doc, color || INK); };
    const textLines = (str, width) => doc.splitTextToSize(safe(str), width);
    let y = 0;

    const newPage = () => { doc.addPage('a4', orient); y = TOP; };
    const ensure = (h) => { if (y + h > H - BOTTOM) newPage(); };

    /* ---- page 1 letterhead */
    const lgu = org.lguLine;
    setFont('bold', 11, INK);
    let ly = 40;
    doc.text(safe(lgu || X().SYSTEM_FULL), M, ly);
    if (org.office) { ly += 13; setFont('normal', 9, INK2); doc.text(safe(org.office), M, ly); }
    if (lgu) { ly += 12; setFont('normal', 8, MUTED); doc.text(safe(X().SYSTEM_FULL), M, ly); }
    setFont('bold', 9, INK);
    doc.text(safe(String(meta.kind).toUpperCase()), W - M, 40, { align: 'right' });
    setFont('normal', 8, MUTED);
    doc.text(safe('Generated ' + meta.generatedAtText), W - M, 53, { align: 'right' });
    ly += 10;
    doc.setDrawColor.apply(doc, NAVY); doc.setLineWidth(1.4); doc.line(M, ly, W - M, ly);
    doc.setDrawColor.apply(doc, RULE); doc.setLineWidth(0.4); doc.line(M, ly + 3, W - M, ly + 3);
    y = ly + 26;

    setFont('bold', 16, INK);
    textLines(meta.title, CW).forEach((l) => { doc.text(l, M, y); y += 19; });
    if (spec.subtitle) {
      setFont('normal', 9.5, MUTED);
      textLines(spec.subtitle, CW).forEach((l) => { doc.text(l, M, y - 4); y += 12; });
    }
    y += 2;

    /* ---- metadata block */
    doc.autoTable({
      startY: y,
      theme: 'plain',
      body: X().metaPairs(meta).map((r) => [safe(r[0]), safe(r[1])]),
      styles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 6, right: 6 }, textColor: INK2, overflow: 'linebreak' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 108, textColor: INK } },
      tableLineColor: LINE, tableLineWidth: 0.6,
      bodyStyles: { fillColor: ZEBRA },
      margin: { left: M, right: M, top: TOP, bottom: BOTTOM }
    });
    y = doc.lastAutoTable.finalY + 10;

    /* ---- notices (privacy, data provenance) */
    const notices = (meta.personalData ? [X().PRIVACY_NOTICE] : []).concat(meta.notices || []);
    notices.forEach((n) => {
      setFont('italic', 8, INK2);
      const lines = textLines(n, CW - 14);
      ensure(lines.length * 10 + 10);
      doc.setFillColor(255, 248, 230); doc.setDrawColor(217, 164, 65); doc.setLineWidth(0.6);
      doc.rect(M, y, CW, lines.length * 10 + 8, 'FD');
      lines.forEach((l, i) => doc.text(l, M + 7, y + 11 + i * 10));
      y += lines.length * 10 + 14;
    });
    y += 6;

    /* ---- blocks */
    const blockHead = (b, minBody) => {
      const noteLines = b.note ? (setFont('normal', 8.5, MUTED), textLines(b.note, CW)) : [];
      const need = (b.name ? 16 : 0) + noteLines.length * 10.5 + (minBody || 40);
      ensure(need);
      if (b.name) { setFont('bold', 11, INK); doc.text(safe(b.name), M, y + 8); y += 16; }
      if (noteLines.length) { setFont('normal', 8.5, MUTED); noteLines.forEach((l) => { doc.text(l, M, y + 6); y += 10.5; }); }
      y += 4;
    };

    const tableBlock = (b) => {
      const cols = b.columns || [];
      blockHead(b, 46);
      const n = cols.length;
      const totalW = cols.reduce((s, c) => s + (Number(c.width) || 12), 0) || 1;
      const columnStyles = {};
      cols.forEach((c, i) => {
        const st = { cellWidth: CW * (Number(c.width) || 12) / totalW };
        if (X().isNumericType(c.type)) st.halign = 'right';
        if (c.type === 'id' || c.type === 'date' || c.type === 'datetime') st.overflow = 'linebreak';
        columnStyles[i] = st;
      });
      const head = [cols.map((c) => safe(c.label + (c.type === 'money' && !/php/i.test(c.label) ? ' (PHP)' : '')))];
      const rows = b.rows || [];
      const body = rows.length
        ? rows.map((r) => r.map((cell, i) => safe(X().formatCell(cell, (cols[i] || {}).type))))
        : [[{ content: safe(b.emptyText || 'No records for the selected period and scope.'), colSpan: Math.max(1, n), styles: { fontStyle: 'italic', textColor: MUTED, halign: 'left' } }]];
      const foot = b.total ? [b.total.map((cell, i) => {
        const t = (cols[i] || {}).type;
        const txt = (cell == null || cell === '') ? '' : safe(X().formatCell(cell, typeof cell === 'string' ? 'text' : t));
        return { content: txt, styles: { halign: X().isNumericType(t) && typeof cell !== 'string' ? 'right' : 'left' } };
      })] : undefined;
      doc.autoTable({
        startY: y,
        theme: 'grid',
        head: head,
        body: body,
        foot: foot,
        showHead: 'everyPage',
        showFoot: 'lastPage',
        rowPageBreak: 'avoid',
        styles: { font: 'helvetica', fontSize: b.fontSize || 8, cellPadding: 3.5, textColor: [30, 41, 59], lineColor: LINE, lineWidth: 0.5, overflow: 'linebreak', valign: 'top' },
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', valign: 'middle' },
        footStyles: { fillColor: TOTAL, textColor: INK, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: ZEBRA },
        columnStyles: columnStyles,
        margin: { left: M, right: M, top: TOP, bottom: BOTTOM }
      });
      y = doc.lastAutoTable.finalY + 18;
    };

    const kvBlock = (b) => {
      blockHead(b, 30);
      doc.autoTable({
        startY: y, theme: 'grid',
        body: (b.rows || []).map((r) => [safe(r[0]), safe(X().formatCell(r[1], r[2] || (typeof r[1] === 'number' ? 'num' : 'text')))]),
        rowPageBreak: 'avoid',
        styles: { fontSize: 8.5, cellPadding: 4, textColor: [30, 41, 59], lineColor: LINE, lineWidth: 0.5, overflow: 'linebreak', valign: 'top' },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: Math.min(200, CW * 0.36), fillColor: ZEBRA, textColor: INK } },
        margin: { left: M, right: M, top: TOP, bottom: BOTTOM }
      });
      y = doc.lastAutoTable.finalY + 18;
    };

    const kpiBlock = (b) => {
      const items = b.items || [];
      if (!items.length) return;
      const per = spec.landscape ? 5 : 4;
      const gap = 8;
      const bw = (CW - gap * (per - 1)) / per;
      const bh = 50;
      blockHead(b, bh + 4);
      for (let i = 0; i < items.length; i += per) {
        ensure(bh + 6);
        items.slice(i, i + per).forEach((it, j) => {
          const x = M + j * (bw + gap);
          doc.setDrawColor.apply(doc, LINE); doc.setFillColor.apply(doc, ZEBRA); doc.setLineWidth(0.6);
          doc.rect(x, y, bw, bh, 'FD');
          setFont('bold', 15, INK);
          doc.text(safe(it.value), x + 8, y + 21);
          setFont('bold', 7.5, INK2);
          doc.text(textLines(it.label, bw - 14).slice(0, 2), x + 8, y + 33);
          if (it.sub) { setFont('normal', 7, MUTED); doc.text(textLines(it.sub, bw - 14).slice(0, 1), x + 8, y + 45); }
        });
        y += bh + 8;
      }
      y += 10;
    };

    const barsBlock = (b) => {
      const items = (b.items || []).filter((r) => typeof r[1] === 'number' && isFinite(r[1]));
      blockHead(b, items.length ? 30 : 18);
      if (!items.length) {
        setFont('italic', 8.5, MUTED); doc.text(safe(b.emptyText || 'No data for the selected period and scope.'), M, y + 6); y += 22; return;
      }
      const max = Math.max.apply(null, items.map((r) => r[1])) || 1;
      const labelW = Math.min(190, CW * 0.34), valW = 60, barMax = CW - labelW - valW - 8;
      const rowH = 14;
      items.forEach((r) => {
        ensure(rowH);
        setFont('normal', 8, INK2);
        const label = textLines(r[0], labelW - 6)[0] || '';
        doc.text(label, M, y + 9);
        const w = Math.max(r[1] > 0 ? 1.5 : 0, barMax * (r[1] / max));
        doc.setFillColor(51, 85, 140);
        if (w > 0) doc.rect(M + labelW, y + 2, w, 9, 'F');
        setFont('bold', 8, INK);
        doc.text(safe(X().formatCell(r[1], 'num') + (b.unit ? ' ' + b.unit : '')), M + labelW + w + 5, y + 9);
        y += rowH;
      });
      y += 14;
    };

    const textBlock = (b) => {
      blockHead(b, 14);
      setFont('normal', 9, INK2);
      String(b.text || '').split(/\n{2,}/).forEach((para) => {
        textLines(para, CW).forEach((l) => { ensure(12); doc.text(l, M, y + 6); y += 12; });
        y += 4;
      });
      y += 8;
    };

    /* section heading that keeps itself with the content after it */
    const headingBlock = (b) => {
      ensure(b.keep || 120);
      if (y > TOP + 4) y += 6;
      setFont('bold', b.level === 2 ? 12 : 14, INK);
      textLines(b.text, CW).forEach((l) => { doc.text(l, M, y + 10); y += b.level === 2 ? 15 : 17; });
      doc.setDrawColor.apply(doc, b.level === 2 ? LINE : NAVY); doc.setLineWidth(b.level === 2 ? 0.5 : 1);
      doc.line(M, y + 1, W - M, y + 1);
      y += 10;
    };

    /* numbered instructions: introduction / notes as paragraphs, then one
       bordered box per step with its number, text wrapped inside the box.
       A step that does not fit the rest of the page moves to the next page;
       a step longer than a whole page continues across pages. */
    const stepsBlock = (b) => {
      const content = b.content || [];
      const numW = 26, padX = 8, padY = 6, lineH = 11.2, gap = 5;
      const textW = CW - numW - padX * 3;
      blockHead(b, 60);
      if (!content.length) {
        setFont('italic', 8.5, MUTED); doc.text(safe(b.emptyText || 'No instructions recorded yet.'), M, y + 6); y += 20; return;
      }
      let n = 0;
      content.forEach((c) => {
        if (c.type !== 'step') {
          setFont('bold', 8.5, INK2);
          const lines = textLines(c.text, CW - 12);
          ensure(Math.min(lines.length, 3) * 11 + 10);
          const h = lines.length * 11 + 8;
          if (y + h <= H - BOTTOM) {
            doc.setFillColor.apply(doc, ZEBRA); doc.rect(M, y, CW, h, 'F');
            doc.setFillColor(51, 85, 140); doc.rect(M, y, 2.2, h, 'F');
          }
          lines.forEach((l) => { ensure(11); doc.text(l, M + 9, y + 10); y += 11; });
          y += 8 + gap;
          return;
        }
        n++;
        setFont('normal', 9, [30, 41, 59]);
        let lines = textLines(c.text, textW);
        const label = (n < 10 ? '0' : '') + n;
        let first = true;
        while (lines.length) {
          const room = Math.floor((H - BOTTOM - y - padY * 2) / lineH);
          const whole = lines.length * lineH + padY * 2;
          if (first && whole <= (H - BOTTOM - TOP) && y + whole > H - BOTTOM) { newPage(); continue; }
          if (room < 1) { newPage(); continue; }
          const take = lines.slice(0, room);
          lines = lines.slice(take.length);
          const h = take.length * lineH + padY * 2;
          doc.setDrawColor.apply(doc, LINE); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.7);
          doc.roundedRect(M, y, CW, h, 3, 3, 'FD');
          if (first) {
            doc.setFillColor(232, 238, 247); doc.roundedRect(M + padX, y + padY - 1, numW, 14, 2, 2, 'F');
            setFont('bold', 8.5, NAVY); doc.text(label, M + padX + numW / 2, y + padY + 9, { align: 'center' });
          }
          setFont('normal', 9, [30, 41, 59]);
          take.forEach((l, k) => doc.text(l, M + padX * 2 + numW, y + padY + 8.5 + k * lineH));
          y += h + (lines.length ? 0 : gap);
          if (lines.length) newPage();
          first = false;
        }
      });
      y += 10;
    };

    (spec.blocks || []).forEach((b) => {
      if (!b) return;
      if (b.type === 'heading') { headingBlock(b); return; }
      if (b.type === 'steps') { stepsBlock(b); return; }
      if (b.type === 'table') tableBlock(b);
      else if (b.type === 'keyvalue') kvBlock(b);
      else if (b.type === 'kpis') kpiBlock(b);
      else if (b.type === 'bars') barsBlock(b);
      else if (b.type === 'text') textBlock(b);
    });

    /* ---- signature lines (blank; nothing is pre-approved) */
    if (spec.signoff && spec.signoff.length) {
      ensure(80);
      y += 34;
      const colW = CW / spec.signoff.length;
      spec.signoff.forEach((s, i) => {
        const x = M + colW * i;
        if (s.name) { setFont('bold', 9.5, INK); doc.text(safe(s.name), x, y - 5); }
        doc.setDrawColor.apply(doc, MUTED); doc.setLineWidth(0.6);
        doc.line(x, y, x + Math.min(colW - 30, 210), y);
        setFont('normal', 8.5, INK2);
        doc.text(safe((s.label || '') + (s.title ? ' \u00b7 ' + s.title : '')), x, y + 12);
        setFont('normal', 7.5, MUTED);
        doc.text('Signature over printed name / date', x, y + 23);
      });
      y += 30;
    }

    /* ---- running headers and footers, now that the page count is known */
    const pages = doc.internal.getNumberOfPages();
    const short = (s, max) => { s = safe(s); return s.length > max ? s.slice(0, max - 1) + '\u2026' : s; };
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      if (i > 1) {
        setFont('normal', 7.5, MUTED);
        doc.text(short(X().SYSTEM + (org.place ? ' \u00b7 ' + org.place : ''), 70), M, 30);
        setFont('bold', 7.5, INK2);
        doc.text(short(meta.title, spec.landscape ? 110 : 70), W - M, 30, { align: 'right' });
        doc.setDrawColor.apply(doc, RULE); doc.setLineWidth(0.5); doc.line(M, 37, W - M, 37);
      }
      doc.setDrawColor.apply(doc, RULE); doc.setLineWidth(0.5); doc.line(M, H - 44, W - M, H - 44);
      setFont('normal', 7.5, MUTED);
      doc.text(short(X().SYSTEM + ' \u00b7 ' + meta.title, spec.landscape ? 120 : 80), M, H - 33);
      const sub = [meta.scope, meta.period ? 'Period: ' + meta.period : ''].filter(Boolean).join(' \u00b7 ');
      if (sub) doc.text(short(sub, spec.landscape ? 120 : 80), M, H - 23);
      if (meta.personalData) { setFont('italic', 7, MUTED); doc.text('Contains personal information (RA 10173)', M, H - 13); }
      setFont('bold', 8, INK2);
      doc.text('Page ' + i + ' of ' + pages, W - M, H - 33, { align: 'right' });
      setFont('normal', 7.5, MUTED);
      doc.text(safe('Generated ' + meta.generatedAtText), W - M, H - 23, { align: 'right' });
      doc.text(safe(meta.exportId), W - M, H - 13, { align: 'right' });
    }

    const filename = spec.filename || X().buildFilename({ type: meta.kind, ext: 'pdf' });
    const blob = doc.output('blob');
    X().download(blob, filename);
    return { filename: filename, rows: meta.count, pages: pages, blob: blob };
  }

  /* --------------------------------------------- backward compatibility
     The original exportDoc({ title, subtitle, kind, scope, meta, tables,
     filename, landscape, signoff }) signature, mapped onto the template so
     any caller not yet migrated still gets the formal layout. */
  function exportDoc(opts) {
    const meta = X().buildMetadata({
      title: opts.title, kind: opts.kind, scope: opts.scope,
      filters: opts.meta ? String(opts.meta).split('\n') : [],
      count: (opts.tables || []).reduce((n, t) => n + ((t.rows || []).length), 0)
    });
    return formal({
      meta: meta, subtitle: opts.subtitle, landscape: !!opts.landscape, filename: opts.filename, signoff: opts.signoff,
      blocks: (opts.tables || []).map((t) => ({ type: 'table', name: t.name, note: t.note,
        columns: (t.head || []).map((h) => ({ label: h, type: 'text' })), rows: t.rows || [] }))
    });
  }

  return { formal, exportDoc, ready, safe };
})();
