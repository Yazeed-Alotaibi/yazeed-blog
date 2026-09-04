
/* ══ PM_XLSX ═══════════════════════════════════════════════════════════
   Writes a real .xlsx in the browser, with no library.

   An .xlsx is a ZIP holding a handful of XML files. Both halves are here:
   a minimal ZIP writer, and just enough SpreadsheetML and DrawingML to
   carry a formatted sheet and a live, editable chart.

   The ZIP is written with compression method 0 — "stored", the bytes as
   they are. DEFLATE would need another two hundred lines to save a few
   kilobytes on a file that leaves in a download, and every reader that
   opens an .xlsx at all opens a stored one.

   Element order in these XML parts is not cosmetic. The schemas are
   sequences, and Excel answers an out-of-order child with "we found a
   problem with some content" rather than with the chart. Anything moved
   here must be moved against ECMA-376, not against what looks tidy. */

var PM_XLSX = (function () {
  'use strict';

  /* ── bytes ─────────────────────────────────────────────────────── */

  var crcTable = null;
  function crc32(bytes) {
    var i, k, c;
    if (!crcTable) {
      crcTable = [];
      for (i = 0; i < 256; i++) {
        c = i;
        for (k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[i] = c >>> 0;
      }
    }
    c = 0xffffffff;
    for (i = 0; i < bytes.length; i++) {
      c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  /* TextEncoder is not on the ES5 floor this file is written to, so the
     UTF-8 is done by hand. Surrogate pairs are joined before encoding —
     an emoji in a card name would otherwise arrive as two broken halves. */
  function utf8(str) {
    var out = [], i, c, next;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        next = str.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      } else if (c < 0x10000) {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else {
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63),
          0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return new Uint8Array(out);
  }

  function pushU16(arr, n) { arr.push(n & 0xff, (n >>> 8) & 0xff); }
  function pushU32(arr, n) {
    arr.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
  }
  function pushBytes(arr, bytes) {
    for (var i = 0; i < bytes.length; i++) arr.push(bytes[i]);
  }

  /* ── zip ───────────────────────────────────────────────────────── */

  function dosStamp(date) {
    var y = date.getFullYear();
    /* The DOS epoch starts in 1980 and there is no room to say otherwise. */
    if (y < 1980) y = 1980;
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) |
        (Math.floor(date.getSeconds() / 2)),
      date: ((y - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  /* files: [{ name: 'xl/workbook.xml', text: '<?xml …' }] */
  function zip(files, now) {
    var stamp = dosStamp(now || new Date());
    var out = [], central = [], offset = 0, i;

    for (i = 0; i < files.length; i++) {
      var nameBytes = utf8(files[i].name);
      var body = utf8(files[i].text);
      var crc = crc32(body);

      /* Local file header. Bit 11 of the flags declares the name UTF-8,
         which matters for nothing here but costs nothing and is correct. */
      pushU32(out, 0x04034b50);
      pushU16(out, 20);
      pushU16(out, 0x0800);
      pushU16(out, 0);
      pushU16(out, stamp.time);
      pushU16(out, stamp.date);
      pushU32(out, crc);
      pushU32(out, body.length);
      pushU32(out, body.length);
      pushU16(out, nameBytes.length);
      pushU16(out, 0);
      pushBytes(out, nameBytes);
      pushBytes(out, body);

      pushU32(central, 0x02014b50);
      pushU16(central, 20);
      pushU16(central, 20);
      pushU16(central, 0x0800);
      pushU16(central, 0);
      pushU16(central, stamp.time);
      pushU16(central, stamp.date);
      pushU32(central, crc);
      pushU32(central, body.length);
      pushU32(central, body.length);
      pushU16(central, nameBytes.length);
      pushU16(central, 0);
      pushU16(central, 0);
      pushU16(central, 0);
      pushU16(central, 0);
      pushU32(central, 0);
      pushU32(central, offset);
      pushBytes(central, nameBytes);

      offset += 30 + nameBytes.length + body.length;
    }

    var cdSize = central.length;
    pushBytes(out, central);
    pushU32(out, 0x06054b50);
    pushU16(out, 0);
    pushU16(out, 0);
    pushU16(out, files.length);
    pushU16(out, files.length);
    pushU32(out, cdSize);
    pushU32(out, offset);
    pushU16(out, 0);

    return new Uint8Array(out);
  }

  /* ── xml ───────────────────────────────────────────────────────── */

  var HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      /* XML 1.0 has no way to spell a control character, and Excel rejects
         the file rather than skipping one. Drop them. */
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  }

  /* A1, B1 … Z1, AA1. Column index is zero-based. */
  function colName(index) {
    var name = '';
    var n = index;
    do {
      name = String.fromCharCode(65 + (n % 26)) + name;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return name;
  }

  function cellRef(col, row) { return colName(col) + (row + 1); }

  /* Sheet names cannot hold : \ / ? * [ ] and cap at 31 characters. Excel
     refuses to open a workbook that breaks either rule. */
  function safeSheetName(name) {
    var s = String(name || 'Sheet1').replace(/[:\\\/?*\[\]]/g, ' ').trim();
    if (s.length > 31) s = s.slice(0, 31).trim();
    return s || 'Sheet1';
  }

  function absRange(sheet, col, rowStart, rowEnd) {
    var q = "'" + String(sheet).replace(/'/g, "''") + "'";
    return q + '!$' + colName(col) + '$' + (rowStart + 1) +
      ':$' + colName(col) + '$' + (rowEnd + 1);
  }

  function absCell(sheet, col, row) {
    var q = "'" + String(sheet).replace(/'/g, "''") + "'";
    return q + '!$' + colName(col) + '$' + (row + 1);
  }

  /* ── styles ────────────────────────────────────────────────────── */

  /* Style indexes, referenced by the sheet builder as S.title, S.money … */
  var S = {
    base: 0, title: 1, subtitle: 2, section: 3, head: 4, label: 5,
    money: 6, pct: 7, ratio: 8, int: 9, num: 10, wrap: 11, note: 12,
    headNum: 13
  };

  function stylesXml() {
    return HEAD +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<numFmts count="5">' +
          '<numFmt numFmtId="164" formatCode="#,##0.00"/>' +
          /* Values reach here already on a 0–100 scale, so the percent sign
             is quoted text rather than Excel's % format, which would
             multiply by a hundred a second time. */
          '<numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/>' +
          '<numFmt numFmtId="166" formatCode="0.00"/>' +
          '<numFmt numFmtId="167" formatCode="#,##0"/>' +
          '<numFmt numFmtId="168" formatCode="#,##0.##"/>' +
        '</numFmts>' +
        '<fonts count="5">' +
          '<font><sz val="11"/><name val="Calibri"/></font>' +
          '<font><b/><sz val="15"/><name val="Calibri"/></font>' +
          '<font><sz val="10"/><color rgb="FF6B6B6B"/><name val="Calibri"/></font>' +
          '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
          '<font><i/><sz val="10"/><color rgb="FF6B6B6B"/><name val="Calibri"/></font>' +
        '</fonts>' +
        /* Excel expects fill 0 to be none and fill 1 to be gray125; it
           rewrites the file if they are missing. */
        '<fills count="3">' +
          '<fill><patternFill patternType="none"/></fill>' +
          '<fill><patternFill patternType="gray125"/></fill>' +
          '<fill><patternFill patternType="solid">' +
            '<fgColor rgb="FFEFEDE8"/><bgColor indexed="64"/></patternFill></fill>' +
        '</fills>' +
        '<borders count="2">' +
          '<border><left/><right/><top/><bottom/><diagonal/></border>' +
          '<border><left/><right/><top/>' +
            '<bottom style="thin"><color rgb="FF9A968E"/></bottom><diagonal/></border>' +
        '</borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="14">' +
          '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
          '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
          '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
          '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0"' +
            ' applyFont="1" applyFill="1" applyBorder="1"/>' +
          '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0"' +
            ' applyFont="1" applyBorder="1"/>' +
          '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"' +
            ' applyAlignment="1"><alignment vertical="top" wrapText="0"/></xf>' +
          '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
          '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
          '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
          '<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
          '<xf numFmtId="168" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
          '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"' +
            ' applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
          '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0"' +
            ' applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
          '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0"' +
            ' applyFont="1" applyBorder="1" applyAlignment="1">' +
            '<alignment horizontal="right"/></xf>' +
        '</cellXfs>' +
        '<cellStyles count="1">' +
          '<cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '<dxfs count="0"/>' +
        '<tableStyles count="0" defaultTableStyle="TableStyleMedium2"/>' +
      '</styleSheet>';
  }

  /* Maps a calculator's output format onto one of the styles above. */
  function styleForFormat(format) {
    switch (format) {
      case 'money': return S.money;
      case 'pct': return S.pct;
      case 'ratio': return S.ratio;
      case 'int': return S.int;
      case 'text': return S.base;
      default: return S.num;
    }
  }

  /* ── worksheet ─────────────────────────────────────────────────── */

  /* A cell is null, a number, a string, or { v, s } to carry a style. */
  function cellXml(col, row, cell) {
    var value = cell, style = 0;
    if (cell && typeof cell === 'object') { value = cell.v; style = cell.s || 0; }
    if (value === null || value === undefined || value === '') {
      return style ? '<c r="' + cellRef(col, row) + '" s="' + style + '"/>' : '';
    }
    var attrs = ' r="' + cellRef(col, row) + '"' + (style ? ' s="' + style + '"' : '');
    if (typeof value === 'number' && isFinite(value)) {
      return '<c' + attrs + '><v>' + numText(value) + '</v></c>';
    }
    /* Inline strings keep the whole workbook to one part per sheet; a
       shared string table would buy deduplication this file never needs. */
    return '<c' + attrs + ' t="inlineStr"><is><t xml:space="preserve">' +
      esc(value) + '</t></is></c>';
  }

  /* Excel stores numbers as decimal text. Exponential notation is legal
     but reads badly in the XML and some parsers are fussier than the
     spec, so keep ordinary magnitudes in plain form. */
  function numText(n) {
    if (n === Math.floor(n) && Math.abs(n) < 1e15) return String(n);
    var s = String(n);
    if (s.indexOf('e') === -1 && s.indexOf('E') === -1) return s;
    return n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  }

  function sheetXml(sheet) {
    var rows = sheet.rows || [];
    var maxCol = 0, i, j, body = '';

    for (i = 0; i < rows.length; i++) {
      var row = rows[i] || [];
      if (row.length > maxCol) maxCol = row.length;
      var cells = '';
      for (j = 0; j < row.length; j++) cells += cellXml(j, i, row[j]);
      if (cells) body += '<row r="' + (i + 1) + '">' + cells + '</row>';
    }
    if (maxCol < 1) maxCol = 1;

    var cols = '';
    if (sheet.cols && sheet.cols.length) {
      cols = '<cols>';
      for (i = 0; i < sheet.cols.length; i++) {
        cols += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' +
          sheet.cols[i] + '" customWidth="1"/>';
      }
      cols += '</cols>';
    }

    /* CT_Worksheet is a sequence: dimension, sheetViews, sheetFormatPr,
       cols, sheetData, then much later pageMargins and drawing. */
    return HEAD +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<dimension ref="A1:' + cellRef(maxCol - 1, Math.max(0, rows.length - 1)) + '"/>' +
        '<sheetViews><sheetView workbookViewId="0" showGridLines="0"' +
          ' tabSelected="1"/></sheetViews>' +
        '<sheetFormatPr defaultRowHeight="15"/>' +
        cols +
        '<sheetData>' + body + '</sheetData>' +
        '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75"' +
          ' header="0.3" footer="0.3"/>' +
        (sheet.charts && sheet.charts.length ? '<drawing r:id="rId1"/>' : '') +
      '</worksheet>';
  }

  /* ── chart ─────────────────────────────────────────────────────── */

  /* Line colours, in the order series are added. Kept deliberately close
     to the desk's own ink: graphite first, indigo second. */
  var SERIES_INK = ['3C3B38', '3B4CA8', '8A6A2F', '5B7A5B', '8A3F3F', '55606B'];

  function numCache(values, formatCode) {
    var pts = '', i;
    for (i = 0; i < values.length; i++) {
      if (typeof values[i] === 'number' && isFinite(values[i])) {
        pts += '<c:pt idx="' + i + '"><c:v>' + numText(values[i]) + '</c:v></c:pt>';
      }
    }
    return '<c:formatCode>' + (formatCode || 'General') + '</c:formatCode>' +
      '<c:ptCount val="' + values.length + '"/>' + pts;
  }

  function strCache(values) {
    var pts = '', i;
    for (i = 0; i < values.length; i++) {
      pts += '<c:pt idx="' + i + '"><c:v>' + esc(values[i]) + '</c:v></c:pt>';
    }
    return '<c:ptCount val="' + values.length + '"/>' + pts;
  }

  function numRef(tag, ref, values, formatCode) {
    return '<c:' + tag + '><c:numRef><c:f>' + esc(ref) + '</c:f>' +
      '<c:numCache>' + numCache(values, formatCode) + '</c:numCache>' +
      '</c:numRef></c:' + tag + '>';
  }

  function seriesTitle(ref, name) {
    return '<c:tx><c:strRef><c:f>' + esc(ref) + '</c:f><c:strCache>' +
      strCache([name]) + '</c:strCache></c:strRef></c:tx>';
  }

  function linePr(hex, dash) {
    return '<c:spPr><a:ln w="22225" cap="rnd"><a:solidFill>' +
      '<a:srgbClr val="' + hex + '"/></a:solidFill>' +
      (dash ? '<a:prstDash val="' + dash + '"/>' : '<a:prstDash val="solid"/>') +
      '<a:round/></a:ln><a:effectLst/></c:spPr>';
  }

  function fillPr(hex) {
    return '<c:spPr><a:solidFill><a:srgbClr val="' + hex + '"/></a:solidFill>' +
      '<a:ln><a:noFill/></a:ln></c:spPr>';
  }

  function chartTitle(text) {
    if (!text) return '<c:autoTitleDeleted val="1"/>';
    return '<c:title><c:tx><c:rich>' +
      '<a:bodyPr rot="0" spcFirstLastPara="1" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/>' +
      '<a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr>' +
      '<a:r><a:rPr lang="en-US" sz="1100" b="1"/><a:t>' + esc(text) + '</a:t></a:r>' +
      '</a:p></c:rich></c:tx><c:overlay val="0"/></c:title>' +
      '<c:autoTitleDeleted val="0"/>';
  }

  function axisTitle(text, rotated) {
    if (!text) return '';
    return '<c:title><c:tx><c:rich>' +
      '<a:bodyPr' + (rotated ? ' rot="-5400000" vert="horz"' : ' rot="0" vert="horz"') + '/>' +
      '<a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="0"/></a:pPr>' +
      '<a:r><a:rPr lang="en-US" sz="900" b="0"/><a:t>' + esc(text) + '</a:t></a:r>' +
      '</a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';
  }

  /* CT_CatAx and CT_ValAx are sequences too: axId, scaling, delete, axPos,
     majorGridlines, title, numFmt, tickMarks, tickLblPos, spPr, txPr,
     crossAx, crosses, then the axis-specific tail. */
  function valAx(id, crossId, title, gridlines, formatCode) {
    return '<c:valAx><c:axId val="' + id + '"/>' +
      '<c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/><c:axPos val="l"/>' +
      (gridlines ? '<c:majorGridlines/>' : '') +
      axisTitle(title, true) +
      '<c:numFmt formatCode="' + (formatCode || 'General') + '" sourceLinked="0"/>' +
      '<c:majorTickMark val="out"/><c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + crossId + '"/><c:crosses val="autoZero"/>' +
      '<c:crossBetween val="between"/></c:valAx>';
  }

  function valAxBottom(id, crossId, title, formatCode) {
    return '<c:valAx><c:axId val="' + id + '"/>' +
      '<c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/><c:axPos val="b"/>' +
      axisTitle(title, false) +
      '<c:numFmt formatCode="' + (formatCode || 'General') + '" sourceLinked="0"/>' +
      '<c:majorTickMark val="out"/><c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + crossId + '"/><c:crosses val="autoZero"/>' +
      '<c:crossBetween val="midCat"/></c:valAx>';
  }

  function catAx(id, crossId, title) {
    return '<c:catAx><c:axId val="' + id + '"/>' +
      '<c:scaling><c:orientation val="minMax"/></c:scaling>' +
      '<c:delete val="0"/><c:axPos val="b"/>' +
      axisTitle(title, false) +
      '<c:majorTickMark val="out"/><c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/>' +
      '<c:crossAx val="' + crossId + '"/><c:crosses val="autoZero"/>' +
      '<c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>' +
      '<c:noMultiLvlLbl val="0"/></c:catAx>';
  }

  /* def:
       { type: 'col' | 'bar' | 'stacked' | 'scatter',
         title, xTitle, yTitle, valFormat,
         cats: { ref, values },                    // categories, or x for scatter
         series: [ { name, nameRef, ref, values, dash, noFill }] } */
  function chartXml(def) {
    var AX_A = 111111111, AX_B = 222222222;
    var plot = '', i;

    if (def.type === 'scatter') {
      var sers = '';
      for (i = 0; i < def.series.length; i++) {
        var s = def.series[i];
        /* Series usually share one x column, but not always: a flat
           baseline drawn across a sampled curve has its own two points.
           A scatter series carries its own xVal, so let it. */
        var xRef = s.xRef || def.cats.ref;
        var xValues = s.xValues || def.cats.values;
        sers += '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/>' +
          seriesTitle(s.nameRef, s.name) +
          linePr(SERIES_INK[i % SERIES_INK.length], s.dash) +
          '<c:marker><c:symbol val="none"/></c:marker>' +
          numRef('xVal', xRef, xValues, 'General') +
          numRef('yVal', s.ref, s.values, def.valFormat) +
          '<c:smooth val="0"/></c:ser>';
      }
      plot = '<c:scatterChart><c:scatterStyle val="lineMarker"/>' +
        '<c:varyColors val="0"/>' + sers +
        '<c:axId val="' + AX_A + '"/><c:axId val="' + AX_B + '"/></c:scatterChart>' +
        valAxBottom(AX_A, AX_B, def.xTitle, 'General') +
        valAx(AX_B, AX_A, def.yTitle, true, def.valFormat);
    } else {
      var bars = '';
      for (i = 0; i < def.series.length; i++) {
        var b = def.series[i];
        bars += '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/>' +
          seriesTitle(b.nameRef, b.name) +
          (b.noFill
            ? '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>'
            : fillPr(SERIES_INK[i % SERIES_INK.length])) +
          '<c:invertIfNegative val="0"/>' +
          '<c:cat><c:strRef><c:f>' + esc(def.cats.ref) + '</c:f><c:strCache>' +
            strCache(def.cats.values) + '</c:strCache></c:strRef></c:cat>' +
          numRef('val', b.ref, b.values, def.valFormat) +
          '</c:ser>';
      }
      plot = '<c:barChart><c:barDir val="' + (def.type === 'bar' ? 'bar' : 'col') + '"/>' +
        '<c:grouping val="' + (def.type === 'stacked' ? 'stacked' : 'clustered') + '"/>' +
        '<c:varyColors val="0"/>' + bars +
        '<c:gapWidth val="' + (def.type === 'stacked' ? '40' : '80') + '"/>' +
        (def.type === 'stacked' ? '<c:overlap val="100"/>' : '<c:overlap val="-20"/>') +
        '<c:axId val="' + AX_A + '"/><c:axId val="' + AX_B + '"/></c:barChart>' +
        catAx(AX_A, AX_B, def.xTitle) +
        valAx(AX_B, AX_A, def.yTitle, true, def.valFormat);
    }

    /* One series needs no key to tell it apart from the others. */
    var wantLegend = def.series.filter(function (s) { return !s.noFill; }).length > 1;

    return HEAD +
      '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"' +
      ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<c:roundedCorners val="0"/>' +
        '<c:chart>' +
          chartTitle(def.title) +
          '<c:plotArea><c:layout/>' + plot + '<c:spPr><a:noFill/>' +
            '<a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>' +
          (wantLegend
            ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>'
            : '') +
          '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>' +
        '</c:chart>' +
        '<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>' +
      '</c:chartSpace>';
  }

  function drawingXml(charts) {
    var body = '', i;
    for (i = 0; i < charts.length; i++) {
      var a = charts[i].anchor;
      body += '<xdr:twoCellAnchor>' +
        '<xdr:from><xdr:col>' + a.col + '</xdr:col><xdr:colOff>0</xdr:colOff>' +
          '<xdr:row>' + a.row + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
        '<xdr:to><xdr:col>' + a.colEnd + '</xdr:col><xdr:colOff>0</xdr:colOff>' +
          '<xdr:row>' + a.rowEnd + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
        '<xdr:graphicFrame macro="">' +
          '<xdr:nvGraphicFramePr>' +
            '<xdr:cNvPr id="' + (i + 2) + '" name="Chart ' + (i + 1) + '"/>' +
            '<xdr:cNvGraphicFramePr/>' +
          '</xdr:nvGraphicFramePr>' +
          '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
          '<a:graphic><a:graphicData' +
            ' uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
            '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"' +
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
            ' r:id="rId' + (i + 1) + '"/>' +
          '</a:graphicData></a:graphic>' +
        '</xdr:graphicFrame>' +
        '<xdr:clientData/></xdr:twoCellAnchor>';
    }
    return HEAD +
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"' +
      ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' + body + '</xdr:wsDr>';
  }

  /* ── package ───────────────────────────────────────────────────── */

  /* sheet: { name, rows, cols, charts: [ { anchor, …chart def } ] }
     Returns the .xlsx as a Uint8Array. */
  function build(sheet, meta) {
    var charts = sheet.charts || [];
    var name = safeSheetName(sheet.name);
    var files = [];
    var i;

    var overrides = '';
    for (i = 0; i < charts.length; i++) {
      overrides += '<Override PartName="/xl/charts/chart' + (i + 1) + '.xml"' +
        ' ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>';
    }

    files.push({
      name: '[Content_Types].xml',
      text: HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels"' +
            ' ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml"' +
            ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml"' +
            ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml"' +
            ' ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          (charts.length
            ? '<Override PartName="/xl/drawings/drawing1.xml"' +
              ' ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'
            : '') +
          overrides +
          '<Override PartName="/docProps/core.xml"' +
            ' ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
          '<Override PartName="/docProps/app.xml"' +
            ' ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>'
    });

    files.push({
      name: '_rels/.rels',
      text: HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1"' +
            ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"' +
            ' Target="xl/workbook.xml"/>' +
          '<Relationship Id="rId2"' +
            ' Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"' +
            ' Target="docProps/core.xml"/>' +
          '<Relationship Id="rId3"' +
            ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"' +
            ' Target="docProps/app.xml"/>' +
        '</Relationships>'
    });

    var stamp = ((meta && meta.date) || new Date()).toISOString().replace(/\.\d+Z$/, 'Z');
    files.push({
      name: 'docProps/core.xml',
      text: HEAD +
        '<cp:coreProperties' +
        ' xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"' +
        ' xmlns:dc="http://purl.org/dc/elements/1.1/"' +
        ' xmlns:dcterms="http://purl.org/dc/terms/"' +
        ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          '<dc:title>' + esc((meta && meta.title) || name) + '</dc:title>' +
          '<dc:creator>yazeed.blog</dc:creator>' +
          '<cp:lastModifiedBy>yazeed.blog</cp:lastModifiedBy>' +
          '<dcterms:created xsi:type="dcterms:W3CDTF">' + stamp + '</dcterms:created>' +
          '<dcterms:modified xsi:type="dcterms:W3CDTF">' + stamp + '</dcterms:modified>' +
        '</cp:coreProperties>'
    });

    files.push({
      name: 'docProps/app.xml',
      text: HEAD +
        '<Properties' +
        ' xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"' +
        ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
          '<Application>yazeed.blog</Application>' +
          '<Company></Company>' +
        '</Properties>'
    });

    files.push({
      name: 'xl/workbook.xml',
      text: HEAD +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' +
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<workbookPr/>' +
          '<sheets><sheet name="' + esc(name) + '" sheetId="1" r:id="rId1"/></sheets>' +
        '</workbook>'
    });

    files.push({
      name: 'xl/_rels/workbook.xml.rels',
      text: HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1"' +
            ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"' +
            ' Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2"' +
            ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"' +
            ' Target="styles.xml"/>' +
        '</Relationships>'
    });

    files.push({ name: 'xl/styles.xml', text: stylesXml() });
    files.push({ name: 'xl/worksheets/sheet1.xml', text: sheetXml(sheet) });

    if (charts.length) {
      files.push({
        name: 'xl/worksheets/_rels/sheet1.xml.rels',
        text: HEAD +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId1"' +
              ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing"' +
              ' Target="../drawings/drawing1.xml"/>' +
          '</Relationships>'
      });

      files.push({ name: 'xl/drawings/drawing1.xml', text: drawingXml(charts) });

      var drawRels = '';
      for (i = 0; i < charts.length; i++) {
        drawRels += '<Relationship Id="rId' + (i + 1) + '"' +
          ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart"' +
          ' Target="../charts/chart' + (i + 1) + '.xml"/>';
      }
      files.push({
        name: 'xl/drawings/_rels/drawing1.xml.rels',
        text: HEAD +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            drawRels + '</Relationships>'
      });

      for (i = 0; i < charts.length; i++) {
        files.push({
          name: 'xl/charts/chart' + (i + 1) + '.xml',
          text: chartXml(charts[i])
        });
      }
    }

    return zip(files, (meta && meta.date) || new Date());
  }

  return {
    build: build,
    zip: zip,
    crc32: crc32,
    utf8: utf8,
    colName: colName,
    cellRef: cellRef,
    absRange: absRange,
    absCell: absCell,
    safeSheetName: safeSheetName,
    styleForFormat: styleForFormat,
    styles: S
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PM_XLSX;
