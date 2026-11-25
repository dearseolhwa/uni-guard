/* UniGuard · Excel workbooks (js/xlsx-lite.js)
 *
 * A small, dependency-free .xlsx writer. An .xlsx file is a ZIP of a few XML
 * parts; this writes those parts and packs them with the ZIP "stored" method,
 * so there is no library to vendor and nothing is fetched at runtime. The
 * files open in Excel, LibreOffice and Google Sheets.
 *
 * Two levels:
 *
 *   UG_XLSX.report(spec)   the formatted report workbook every module uses:
 *                          a Summary sheet (title, LGU, metadata, notices, key
 *                          figures, list of worksheets) followed by one data
 *                          sheet per dataset with a title, scope line, a styled
 *                          header row, frozen panes, an auto-filter, typed
 *                          cells, a totals row and print settings.
 *
 *   UG_XLSX.download(filename, { sheets: [{ name, cols, rows, freezeRow,
 *                    autoFilter, printTitleRow, landscape, footer }] })
 *                          the low-level writer; a cell is a string, a number,
 *                          a Date, null, or { v, s } with s one of the STYLE keys.
 *
 * Data integrity:
 *   · numbers are written as numbers, dates and times as real Excel dates
 *     (Philippine time) with a date format, IDs as text so leading zeros stay
 *   · every string is an inline TEXT cell, never a formula, so text that starts
 *     with = + - @ cannot execute (no formula injection)
 *   · no merged cells, so filtering and sorting keep working
 */
const UG_XLSX = (function () {
  const STYLE = {
    plain: 0, head: 1, title: 2, bold: 3, wrap: 4, muted: 5, cell: 6, total: 7,
    int: 8, num: 9, money: 10, pct: 11, date: 12, datetime: 13, text: 14,
    totalInt: 15, totalMoney: 16, subtitle: 17, totalNum: 18, section: 19
  };

  /* ------------------------------------------------------------------ xml */
  function xml(s) {
    return String(s == null ? '' : s)
      /* characters XML 1.0 does not allow would make Excel reject the file */
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function colName(i) {
    let s = '';
    i += 1;
    while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  /* Sheet names: 31 characters at most, none of []:*?/\ and unique in the book. */
  function sheetNames(sheets) {
    const used = {};
    return sheets.map((sh, i) => {
      let n = String(sh.name || ('Sheet' + (i + 1))).replace(/[\[\]:*?\/\\]/g, ' ').replace(/^'+|'+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 31) || ('Sheet' + (i + 1));
      let k = 2;
      const base = n;
      while (used[n.toLowerCase()]) { const suf = ' (' + (k++) + ')'; n = base.slice(0, 31 - suf.length) + suf; }
      used[n.toLowerCase()] = true;
      return n;
    });
  }
  const quoteSheet = (n) => "'" + String(n).replace(/'/g, "''") + "'";

  function dateSerial(d) {
    if (typeof UG_EXPORT !== 'undefined') return UG_EXPORT.excelSerial(d);
    return d.getTime() / 86400000 + 25569;
  }

  function sheetXml(sh) {
    const rows = sh.rows || [];
    let maxCol = 1;
    rows.forEach((r) => { if (r && r.length > maxCol) maxCol = r.length; });
    let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    out += '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
    out += '<dimension ref="A1:' + colName(maxCol - 1) + Math.max(1, rows.length) + '"/>';
    out += '<sheetViews><sheetView workbookViewId="0"' + (sh.tabSelected ? ' tabSelected="1"' : '') + '>';
    if (sh.freezeRow) {
      const r = sh.freezeRow + 1;
      out += '<pane ySplit="' + sh.freezeRow + '" topLeftCell="A' + r + '" activePane="bottomLeft" state="frozen"/>' +
        '<selection pane="bottomLeft" activeCell="A' + r + '" sqref="A' + r + '"/>';
    }
    out += '</sheetView></sheetViews>';
    out += '<sheetFormatPr defaultRowHeight="15"/>';
    if (sh.cols && sh.cols.length) {
      out += '<cols>' + sh.cols.map((w, i) =>
        '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (Number(w) || 12) + '" customWidth="1"/>').join('') + '</cols>';
    }
    out += '<sheetData>';
    rows.forEach((row, r) => {
      if (!row || !row.length) return;
      let cells = '';
      row.forEach((cell, c) => {
        if (cell == null || cell === '') return;
        const obj = (typeof cell === 'object' && !(cell instanceof Date));
        let v = obj ? cell.v : cell;
        const s = obj ? (STYLE[cell.s] || 0) : 0;
        const ref = colName(c) + (r + 1);
        if (v instanceof Date) v = dateSerial(v);
        if (v == null || v === '') { if (s) cells += '<c r="' + ref + '" s="' + s + '"/>'; return; }
        if (typeof v === 'number' && isFinite(v)) {
          cells += '<c r="' + ref + '"' + (s ? ' s="' + s + '"' : '') + '><v>' + v + '</v></c>';
        } else if (typeof v === 'boolean') {
          cells += '<c r="' + ref + '" t="b"' + (s ? ' s="' + s + '"' : '') + '><v>' + (v ? 1 : 0) + '</v></c>';
        } else {
          cells += '<c r="' + ref + '" t="inlineStr"' + (s ? ' s="' + s + '"' : '') +
            '><is><t xml:space="preserve">' + xml(v) + '</t></is></c>';
        }
      });
      if (cells) out += '<row r="' + (r + 1) + '">' + cells + '</row>';
    });
    out += '</sheetData>';
    if (sh.autoFilter) out += '<autoFilter ref="' + sh.autoFilter + '"/>';
    out += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.7" header="0.3" footer="0.3"/>';
    out += '<pageSetup paperSize="9" orientation="' + (sh.landscape ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/>';
    out += '<headerFooter><oddFooter>' + xml('&L&8' + String(sh.footer || 'UniGuard').replace(/&/g, '&&') + '&R&8Page &P of &N') + '</oddFooter></headerFooter>';
    out += '</worksheet>';
    return out;
  }

  const BORDER = 'borderId="1"';
  const STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="4">' +
      '<numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/>' +
      '<numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>' +
      '<numFmt numFmtId="166" formatCode="#,##0.0%"/>' +
      '<numFmt numFmtId="167" formatCode="#,##0.##########"/>' +
    '</numFmts>' +
    '<fonts count="7">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +                                  /* 0 */
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +                              /* 1 */
      '<font><b/><sz val="14"/><color rgb="FF0B1220"/><name val="Calibri"/></font>' +       /* 2 */
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +       /* 3 */
      '<font><i/><sz val="10"/><color rgb="FF5A6982"/><name val="Calibri"/></font>' +       /* 4 */
      '<font><b/><sz val="11"/><color rgb="FF0C1524"/><name val="Calibri"/></font>' +       /* 5 */
      '<font><b/><sz val="12"/><color rgb="FF0C1524"/><name val="Calibri"/></font>' +       /* 6 */
    '</fonts>' +
    '<fills count="4">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0C1524"/><bgColor indexed="64"/></patternFill></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="2">' +
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left style="thin"><color rgb="FFC9D3E2"/></left><right style="thin"><color rgb="FFC9D3E2"/></right>' +
        '<top style="thin"><color rgb="FFC9D3E2"/></top><bottom style="thin"><color rgb="FFC9D3E2"/></bottom><diagonal/></border>' +
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="20">' +
      /* 0 plain    */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      /* 1 head     */ '<xf numFmtId="0" fontId="3" fillId="2" ' + BORDER + ' xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      /* 2 title    */ '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      /* 3 bold     */ '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      /* 4 wrap     */ '<xf numFmtId="0" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      /* 5 muted    */ '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      /* 6 cell     */ '<xf numFmtId="0" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      /* 7 total    */ '<xf numFmtId="0" fontId="1" fillId="3" ' + BORDER + ' xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
      /* 8 int      */ '<xf numFmtId="3" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      /* 9 num      */ '<xf numFmtId="167" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      /* 10 money   */ '<xf numFmtId="4" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      /* 11 pct     */ '<xf numFmtId="166" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      /* 12 date    */ '<xf numFmtId="165" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>' +
      /* 13 datetime*/ '<xf numFmtId="164" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>' +
      /* 14 text    */ '<xf numFmtId="49" fontId="0" fillId="0" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      /* 15 totalInt*/ '<xf numFmtId="3" fontId="1" fillId="3" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
      /* 16 totalMoney */ '<xf numFmtId="4" fontId="1" fillId="3" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
      /* 17 subtitle*/ '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      /* 18 totalNum*/ '<xf numFmtId="167" fontId="1" fillId="3" ' + BORDER + ' xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
      /* 19 section */ '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

/* ------------------------------------------------------------------ zip */
  let CRC_TABLE = null;
  function crc32(bytes) {
    if (!CRC_TABLE) {
      CRC_TABLE = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        CRC_TABLE[n] = c >>> 0;
      }
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((Math.max(now.getFullYear(), 1980) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const parts = [];
    const central = [];
    let offset = 0;

    files.forEach((f) => {
      const name = enc.encode(f.name);
      const data = enc.encode(f.text);
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);            /* version needed */
      local.setUint16(6, 0x0800, true);        /* UTF-8 names */
      local.setUint16(8, 0, true);             /* stored */
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, dosTime, true);
      cd.setUint16(14, dosDate, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);

      offset += 30 + name.length + data.length;
    });

    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);

    return parts.concat(central, [new Uint8Array(end.buffer)]);
  }

    /* ---------------------------------------------------------------- build */
  function parts(spec) {
    const sheets = (spec && spec.sheets && spec.sheets.length) ? spec.sheets : [{ name: 'Sheet1', rows: [] }];
    const names = sheetNames(sheets);
    const props = (spec && spec.props) || {};
    const files = [];

    files.push({ name: '[Content_Types].xml', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
      '</Types>' });

    files.push({ name: '_rels/.rels', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>' });

    const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    files.push({ name: 'docProps/core.xml', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
      'xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + xml(props.title || '') + '</dc:title>' +
      '<dc:subject>' + xml(props.subject || '') + '</dc:subject>' +
      '<dc:creator>' + xml(props.creator || 'UniGuard') + '</dc:creator>' +
      '<cp:keywords>' + xml(props.keywords || '') + '</cp:keywords>' +
      '<dc:description>' + xml(props.description || '') + '</dc:description>' +
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + created + '</dcterms:created>' +
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + created + '</dcterms:modified>' +
      '</cp:coreProperties>' });
    files.push({ name: 'docProps/app.xml', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
      '<Application>UniGuard</Application></Properties>' });

    /* auto-filter ranges and repeating print titles need workbook-level names */
    const defined = [];
    sheets.forEach((s, i) => {
      if (s.autoFilter) {
        const ref = s.autoFilter.split(':').map((p) => p.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2')).join(':');
        defined.push('<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">' + xml(quoteSheet(names[i]) + '!' + ref) + '</definedName>');
      }
      if (s.printTitleRow) {
        defined.push('<definedName name="_xlnm.Print_Titles" localSheetId="' + i + '">' + xml(quoteSheet(names[i]) + '!$' + s.printTitleRow + ':$' + s.printTitleRow) + '</definedName>');
      }
    });

    files.push({ name: 'xl/workbook.xml', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView activeTab="0"/></bookViews>' +
      '<sheets>' + names.map((n, i) => '<sheet name="' + xml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets>' +
      (defined.length ? '<definedNames>' + defined.join('') + '</definedNames>' : '') +
      '</workbook>' });

    files.push({ name: 'xl/_rels/workbook.xml.rels', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' });

    files.push({ name: 'xl/styles.xml', text: STYLES_XML });
    sheets.forEach((s, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: sheetXml(Object.assign({ tabSelected: i === 0 }, s)) }));
    return zip(files);
  }

  function build(spec) {
    return new Blob(parts(spec), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function download(filename, spec) {
    const blob = build(spec);
    if (typeof UG_EXPORT !== 'undefined') { UG_EXPORT.download(blob, filename); return true; }
    if (typeof UG_UTIL !== 'undefined' && UG_UTIL.downloadBlob) { UG_UTIL.downloadBlob(blob, filename); return true; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  }

  /* ------------------------------------------------- typed cell → xlsx cell */
  const DEFAULT_WIDTH = { id: 16, text: 22, status: 16, longtext: 48, int: 12, num: 12, money: 16, pct: 10, date: 12, datetime: 17 };

  function typedCell(cell, colType, isTotal) {
    const X = UG_EXPORT;
    const c = X.unwrap(cell, colType);
    const v = c.v;
    const t = c.t;
    if (v == null || v === '') return { v: null, s: isTotal ? 'total' : 'cell' };
    if (X.isNumericType(t)) {
      const n = X.numberOrNull(v);
      if (n == null) return { v: String(v), s: isTotal ? 'total' : 'cell' };
      if (t === 'pct') return { v: n / 100, s: isTotal ? 'total' : 'pct' };
      if (isTotal) return { v: n, s: t === 'money' ? 'totalMoney' : t === 'int' ? 'totalInt' : 'totalNum' };
      return { v: n, s: t };
    }
    if (t === 'date' || t === 'datetime') {
      const serial = X.excelSerial(v, t === 'date');
      if (serial != null) return { v: serial, s: t };
      return { v: String(v), s: 'cell' };
    }
    if (typeof v === 'boolean') return { v: v ? 'Yes' : 'No', s: 'cell' };
    if (t === 'id') return { v: String(v), s: 'text' };
    if (t === 'longtext') return { v: String(v), s: 'wrap' };
    return { v: String(v), s: isTotal ? 'total' : (String(v).length > 60 ? 'wrap' : 'cell') };
  }

  /* ----------------------------------------------------- report workbook
     spec: {
       meta,                          UG_EXPORT.buildMetadata(...)
       filename,
       keyFigures: [[label, value, type]],   optional, shown on the Summary sheet
       sheets: [{ name, title, note, columns: [{ label, type, width }], rows, total, landscape }]
     } → { filename, rows } */
  function report(spec) {
    const X = UG_EXPORT;
    const meta = spec.meta;
    const org = meta.org || X.org();
    const footer = X.SYSTEM + ' \u00b7 ' + meta.title + ' \u00b7 ' + meta.exportId;
    const datasets = spec.sheets || [];

    /* Summary sheet */
    const sum = [];
    sum.push([{ v: meta.title, s: 'title' }]);
    if (org.lguLine) sum.push([{ v: org.lguLine, s: 'subtitle' }]);
    if (org.office) sum.push([{ v: org.office, s: 'muted' }]);
    sum.push([{ v: X.SYSTEM_FULL + ' \u00b7 ' + meta.kind, s: 'muted' }]);
    sum.push([]);
    X.metaPairs(meta).forEach((p) => sum.push([{ v: p[0], s: 'bold' }, { v: p[1], s: 'plain' }]));
    sum.push([{ v: 'Time zone', s: 'bold' }, { v: 'All dates and times are ' + X.TZ_LONG + '.', s: 'plain' }]);
    const notices = (meta.personalData ? [X.PRIVACY_NOTICE] : []).concat(meta.notices || []);
    if (notices.length) {
      sum.push([]);
      sum.push([{ v: 'Notes', s: 'section' }]);
      notices.forEach((n) => sum.push([{ v: n, s: 'muted' }]));
    }
    if (spec.keyFigures && spec.keyFigures.length) {
      sum.push([]);
      sum.push([{ v: 'Key figures', s: 'section' }]);
      sum.push([{ v: 'Indicator', s: 'head' }, { v: 'Value', s: 'head' }]);
      spec.keyFigures.forEach((k) => sum.push([{ v: k[0], s: 'cell' }, typedCell(k[1], k[2] || (typeof k[1] === 'number' ? 'num' : 'text'))]));
    }
    sum.push([]);
    sum.push([{ v: 'Worksheets in this workbook', s: 'section' }]);
    sum.push([{ v: 'Worksheet', s: 'head' }, { v: 'Contents', s: 'head' }, { v: 'Records', s: 'head' }]);
    const sheetNamesList = sheetNames([{ name: 'Summary' }].concat(datasets.map((d) => ({ name: d.name })))).slice(1);
    datasets.forEach((d, i) => sum.push([{ v: sheetNamesList[i], s: 'cell' }, { v: d.title || d.name, s: 'wrap' }, { v: (d.rows || []).length, s: 'int' }]));

    const sheets = [{ name: 'Summary', cols: [30, 78, 12], rows: sum, footer: footer, landscape: false }];

    datasets.forEach((d) => {
      const cols = d.columns || [];
      const rows = [];
      rows.push([{ v: d.title || d.name, s: 'title' }]);
      rows.push([{ v: d.note || '', s: 'muted' }]);
      const count = (d.rows || []).length;
      rows.push([{ v: [meta.scope ? 'Scope: ' + meta.scope : '', meta.period ? 'Period: ' + meta.period : '',
        'Records: ' + count.toLocaleString('en-PH') + (count ? '' : ' (no records for the selected period and scope)'),
        'Generated: ' + meta.generatedAtText].filter(Boolean).join('  \u00b7  '), s: 'muted' }]);
      rows.push([]);
      const headerRow = rows.length + 1;          /* 1-based */
      rows.push(cols.map((c) => ({ v: c.label + (c.type === 'money' && !/php/i.test(c.label) ? ' (PHP)' : '') + (c.type === 'pct' && !/%/.test(c.label) ? ' (%)' : ''), s: 'head' })));
      (d.rows || []).forEach((r) => rows.push(r.map((cell, i) => typedCell(cell, (cols[i] || {}).type, false))));
      const lastData = rows.length;
      if (d.total) {
        rows.push([]);
        rows.push(d.total.map((cell, i) => typedCell(cell, typeof cell === 'string' ? 'text' : (cols[i] || {}).type, true)));
      }
      const lastCol = colName(Math.max(0, cols.length - 1));
      sheets.push({
        name: d.name,
        cols: cols.map((c) => Number(c.width) ? Math.max(8, Math.min(70, Number(c.width))) : (DEFAULT_WIDTH[c.type] || 18)),
        rows: rows,
        freezeRow: headerRow,
        autoFilter: cols.length ? ('A' + headerRow + ':' + lastCol + Math.max(headerRow, lastData)) : null,
        printTitleRow: headerRow,
        landscape: d.landscape != null ? d.landscape : cols.length > 6,
        footer: footer
      });
    });

    const filename = spec.filename || X.buildFilename({ type: meta.kind, ext: 'xlsx' });
    download(filename, {
      sheets: sheets,
      props: { title: meta.title, subject: [meta.kind, meta.scope, meta.period].filter(Boolean).join(' \u00b7 '),
        creator: meta.preparedBy, keywords: ['UniGuard', meta.kind, meta.exportId].join(', '),
        description: 'Generated ' + meta.generatedAtText + '. Export ID ' + meta.exportId + ' (system-generated, not an official document number).' }
    });
    return { filename: filename, rows: meta.count };
  }

  return { build, parts, download, report, typedCell, STYLE };
})();
