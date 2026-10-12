/* UniGuard · Excel exports (js/xlsx-lite.js)
 *
 * A small, dependency-free .xlsx writer used ONLY by the Reports and
 * Documentation module (js/reporting.js). Every other export in the system
 * stays a formatted PDF (js/pdf.js).
 *
 * An .xlsx file is a ZIP of a few XML parts. This writes those parts and packs
 * them with the ZIP "stored" method (no compression), so there is no library to
 * vendor and nothing is fetched at runtime. The files open in Excel, LibreOffice
 * and Google Sheets.
 *
 *   UG_XLSX.download('file.xlsx', { sheets: [{ name, cols, rows }] })
 *
 *   · cols  optional array of column widths (in characters)
 *   · rows  array of rows; a row is an array of cells; a cell is a string, a
 *           number, null, or { v: value, s: 'title' | 'head' | 'bold' | 'cell' |
 *           'wrap' | 'muted' }
 *
 * Numbers are written as real numbers so the LDRRMO can sum and filter them.
 */
const UG_XLSX = (function () {
  const STYLE = { plain: 0, head: 1, title: 2, bold: 3, wrap: 4, muted: 5, cell: 6, total: 7 };

  /* ------------------------------------------------------------------ xml */
  function xml(s) {
    return String(s == null ? '' : s)
      /* characters XML 1.0 does not allow would make Excel reject the file */
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
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
      let n = String(sh.name || ('Sheet' + (i + 1))).replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || ('Sheet' + (i + 1));
      let k = 2;
      const base = n;
      while (used[n.toLowerCase()]) { const suf = ' (' + (k++) + ')'; n = base.slice(0, 31 - suf.length) + suf; }
      used[n.toLowerCase()] = true;
      return n;
    });
  }

  function sheetXml(sh) {
    const rows = sh.rows || [];
    let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (sh.cols && sh.cols.length) {
      out += '<cols>' + sh.cols.map((w, i) =>
        '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (Number(w) || 12) + '" customWidth="1"/>').join('') + '</cols>';
    }
    out += '<sheetData>';
    rows.forEach((row, r) => {
      if (!row || !row.length) return;
      out += '<row r="' + (r + 1) + '">';
      row.forEach((cell, c) => {
        if (cell == null || cell === '') return;
        const obj = (typeof cell === 'object' && !(cell instanceof Date));
        const v = obj ? cell.v : cell;
        const s = obj ? (STYLE[cell.s] || 0) : 0;
        const ref = colName(c) + (r + 1);
        if (v == null || v === '') { if (s) out += '<c r="' + ref + '" s="' + s + '"/>'; return; }
        if (typeof v === 'number' && isFinite(v)) {
          out += '<c r="' + ref + '"' + (s ? ' s="' + s + '"' : '') + '><v>' + v + '</v></c>';
        } else {
          out += '<c r="' + ref + '" t="inlineStr"' + (s ? ' s="' + s + '"' : '') +
            '><is><t xml:space="preserve">' + xml(v) + '</t></is></c>';
        }
      });
      out += '</row>';
    });
    out += '</sheetData></worksheet>';
    return out;
  }

  const STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="5">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><i/><sz val="10"/><color rgb="FF5A6982"/><name val="Calibri"/></font>' +
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
    '<cellXfs count="8">' +
      /* 0 plain */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      /* 1 head  */ '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
      /* 2 title */ '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      /* 3 bold  */ '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      /* 4 wrap  */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      /* 5 muted */ '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      /* 6 cell  */ '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
      /* 7 total */ '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
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
    const files = [];

    files.push({ name: '[Content_Types].xml', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
      '</Types>' });

    files.push({ name: '_rels/.rels', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>' });

    files.push({ name: 'xl/workbook.xml', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + names.map((n, i) => '<sheet name="' + xml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets>' +
      '</workbook>' });

    files.push({ name: 'xl/_rels/workbook.xml.rels', text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' });

    files.push({ name: 'xl/styles.xml', text: STYLES_XML });
    sheets.forEach((s, i) => files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: sheetXml(s) }));
    return zip(files);
  }

  function build(spec) {
    return new Blob(parts(spec), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function download(filename, spec) {
    const blob = build(spec);
    if (typeof UG_UTIL !== 'undefined' && UG_UTIL.downloadBlob) { UG_UTIL.downloadBlob(blob, filename); return true; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  }

  return { build, parts, download, STYLE };
})();
