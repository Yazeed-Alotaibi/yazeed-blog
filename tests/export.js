/* Spreadsheet export.

   Three layers, tested where each can actually be wrong:

   - PM_XLSX writes a ZIP and a pile of XML. The failures here are silent
     and total — a bad CRC or a misplaced element gives Excel a file it
     refuses to open, with nothing on the page to show for it.
   - PM_CHARTS.exportData turns a plot spec into raw numbers. The failure
     here is quiet and worse: a chart that exports formatted strings still
     produces a workbook, just one that cannot be plotted or summed.
   - PM_EXPORT.sheetFor lays the sheet out and points each chart's series at
     the cells holding its numbers. An off-by-one in that arithmetic draws a
     real chart of the wrong rows, which looks like data.

   What this file cannot do is open the result in Excel. The workbooks were
   checked by hand against LibreOffice and openpyxl when the feature landed;
   these assertions hold the structure that check validated. */

'use strict';

var H = require('./harness');

var TITLE = 'Spreadsheet export';

/* Just enough ZIP reading to check what the writer claims. */
function readZip(bytes) {
  var buf = Buffer.from(bytes);
  var entries = [];
  var i = 0;
  while (i + 4 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    var crc = buf.readUInt32LE(i + 14);
    var size = buf.readUInt32LE(i + 18);
    var nameLen = buf.readUInt16LE(i + 26);
    var extraLen = buf.readUInt16LE(i + 28);
    var name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    var start = i + 30 + nameLen + extraLen;
    entries.push({
      name: name, crc: crc, size: size,
      text: buf.toString('utf8', start, start + size)
    });
    i = start + size;
  }
  /* The end-of-central-directory record is what a reader actually trusts. */
  var eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  return {
    entries: entries,
    eocdFound: eocd !== -1,
    declaredCount: eocd === -1 ? -1 : buf.readUInt16LE(eocd + 10)
  };
}

/* Values built inside the sandbox carry that realm's prototypes, and
   isDeepStrictEqual compares those too — an array of the same numbers is
   not deep-equal across the boundary. Copy through JSON to compare. */
function own(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function names(zip) {
  return zip.entries.map(function (e) { return e.name; });
}

function part(zip, name) {
  var hit = zip.entries.filter(function (e) { return e.name === name; })[0];
  return hit ? hit.text : '';
}

/* The same results computeCard produces, without a card to paint them on. */
function resultsFor(card, values) {
  var out = {};
  card.outputs.forEach(function (o) {
    var val = null;
    try { val = o.compute(values); } catch (e) { val = null; }
    out[o.key] = val;
  });
  return out;
}

function run(page) {
  var X = page.sandbox.PM_XLSX;
  var CH = page.sandbox.PM_CHARTS;
  var EX = page.sandbox.PM_EXPORT;
  var data = page.sandbox.PM_DATA;

  H.suite('zip writer');
  H.check('modules are present', !!X && !!EX && typeof CH.exportData === 'function');

  /* The standard check value for CRC-32: "123456789" is 0xCBF43926. */
  H.eq('crc32 matches the standard check vector',
    X.crc32(X.utf8('123456789')), 0xcbf43926);
  H.eq('crc32 of empty input is zero', X.crc32(new Uint8Array(0)), 0);
  H.eq('utf8 encodes multi-byte characters by length',
    X.utf8('a·—').length, 6);

  H.eq('column 0 is A', X.colName(0), 'A');
  H.eq('column 25 is Z', X.colName(25), 'Z');
  H.eq('column 26 is AA', X.colName(26), 'AA');
  H.eq('column 27 is AB', X.colName(27), 'AB');
  H.eq('column 701 is ZZ', X.colName(701), 'ZZ');
  H.eq('column 702 is AAA', X.colName(702), 'AAA');
  H.eq('cellRef is one-based on rows', X.cellRef(2, 0), 'C1');

  H.eq('sheet names drop the characters Excel forbids',
    X.safeSheetName('a/b\\c?d*e[f]g:h'), 'a b c d e f g h');
  H.check('sheet names are capped at 31 characters',
    X.safeSheetName(new Array(80).join('x')).length === 31);
  H.eq('an empty sheet name falls back', X.safeSheetName('   '), 'Sheet1');
  H.eq('ranges are absolute and quoted',
    X.absRange('My Sheet', 1, 4, 9), "'My Sheet'!$B$5:$B$10");
  H.eq('a quote in a sheet name is doubled',
    X.absCell("Bob's", 0, 0), "'Bob''s'!$A$1");

  var plain = X.build({ name: 'Plain', rows: [['a', 1]], cols: [10, 10] });
  var pz = readZip(plain);
  H.check('a workbook is a readable zip', pz.eocdFound);
  H.eq('the directory counts every entry', pz.declaredCount, pz.entries.length);
  H.check('every entry carries a correct CRC', pz.entries.every(function (e) {
    return X.crc32(X.utf8(e.text)) === e.crc;
  }));
  H.check('the required parts are all present',
    ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']
      .every(function (n) { return names(pz).indexOf(n) !== -1; }));
  H.check('a chartless workbook ships no drawing',
    names(pz).indexOf('xl/drawings/drawing1.xml') === -1 &&
    part(pz, 'xl/worksheets/sheet1.xml').indexOf('<drawing') === -1);
  H.check('numbers are written as numbers, text as inline strings',
    /<c r="B1"><v>1<\/v><\/c>/.test(part(pz, 'xl/worksheets/sheet1.xml')) &&
    /t="inlineStr"/.test(part(pz, 'xl/worksheets/sheet1.xml')));

  /* A control character is not spellable in XML 1.0, and Excel rejects the
     whole file rather than skipping the cell. */
  var nasty = readZip(X.build({ name: 'X', rows: [['a\u0007b & <c> "d"']] }));
  var nastySheet = part(nasty, 'xl/worksheets/sheet1.xml');
  H.check('control characters are dropped',
    nastySheet.indexOf('\u0007') === -1);
  H.check('markup characters are escaped, not passed through',
    nastySheet.indexOf('ab &amp; &lt;c&gt; &quot;d&quot;') !== -1,
    nastySheet.slice(nastySheet.indexOf('<is>'), nastySheet.indexOf('</is>')));

  var charted = readZip(X.build({
    name: 'Charted',
    rows: [['Head', 'Value'], ['a', 1], ['b', 2]],
    charts: [{
      type: 'col', title: 'T', anchor: { col: 4, row: 0, colEnd: 12, rowEnd: 16 },
      cats: { ref: "'Charted'!$A$2:$A$3", values: ['a', 'b'] },
      series: [{
        name: 'Value', nameRef: "'Charted'!$B$1",
        ref: "'Charted'!$B$2:$B$3", values: [1, 2]
      }]
    }]
  }));
  H.check('a charted workbook ships the drawing chain',
    ['xl/drawings/drawing1.xml', 'xl/drawings/_rels/drawing1.xml.rels',
      'xl/charts/chart1.xml', 'xl/worksheets/_rels/sheet1.xml.rels']
      .every(function (n) { return names(charted).indexOf(n) !== -1; }));
  H.check('the chart part is declared in [Content_Types].xml',
    part(charted, '[Content_Types].xml').indexOf('/xl/charts/chart1.xml') !== -1 &&
    part(charted, '[Content_Types].xml').indexOf('/xl/drawings/drawing1.xml') !== -1);
  H.check('the sheet points at the drawing',
    /<drawing r:id="rId1"\/>/.test(part(charted, 'xl/worksheets/sheet1.xml')));
  /* Without a cache some readers draw an empty frame even with valid refs. */
  H.check('the chart caches its values as well as referencing them',
    /<c:numCache>[\s\S]*<c:pt idx="0"><c:v>1<\/c:v><\/c:pt>/.test(
      part(charted, 'xl/charts/chart1.xml')));
  H.check('the chart declares both axes',
    (part(charted, 'xl/charts/chart1.xml').match(/<c:axId /g) || []).length === 4);

  /* ── the mapping from plot spec to raw numbers ─────────────────── */

  H.suite('chart export data');

  var kindsInData = {};
  var kindsHandled = {};
  var stringInSeries = [];
  var badChartType = [];
  var specCount = 0;

  H.eachCard(data, function (card) {
    if (!card.charts) return;
    var values = H.exampleValues(card);
    var results = resultsFor(card, values);
    card.charts.forEach(function (def) {
      kindsInData[def.kind] = (kindsInData[def.kind] || 0) + 1;
      var spec = null;
      try { spec = def.build(values, results); } catch (e) { spec = null; }
      if (!spec) return;
      specCount += 1;

      var out = null;
      try { out = CH.exportData(def.kind, spec); } catch (e) { out = 'threw'; }
      if (out === 'threw' || !out) return;
      kindsHandled[def.kind] = true;

      if (out.chart && ['col', 'bar', 'stacked', 'scatter'].indexOf(out.chart) === -1) {
        badChartType.push(card.id + '/' + def.kind + ': ' + out.chart);
      }
      /* The whole point of this layer: what goes into a series must be a
         number Excel can plot, never the string a reader would see. */
      (out.seriesCols || []).concat(out.xCols || []).forEach(function (col) {
        for (var i = 0; i < out.chartRows; i++) {
          var cell = out.rows[i][col];
          if (cell !== null && typeof cell !== 'number') {
            stringInSeries.push(card.id + '/' + def.kind + ' col ' + col + ': ' +
              JSON.stringify(cell));
          }
        }
      });
    });
  });

  H.check('the example values produced specs to export', specCount > 20,
    'only ' + specCount + ' specs built');
  H.deep('every plotted value is a number, never a formatted string',
    stringInSeries.slice(0, 5), []);
  H.deep('every chart maps to a chart type Excel has',
    badChartType.slice(0, 5), []);

  /* The tripwire. A new chart kind that nobody taught exportData about
     exports as a bare table with no explanation — this fails first. */
  var unhandled = Object.keys(kindsInData).filter(function (k) {
    return !kindsHandled[k];
  });
  H.deep('every chart kind in PM_DATA has an export path', unhandled, []);

  var kindSpec = {};
  H.eachCard(data, function (card) {
    if (!card.charts) return;
    var values = H.exampleValues(card);
    var results = resultsFor(card, values);
    card.charts.forEach(function (def) {
      if (kindSpec[def.kind]) return;
      var spec = null;
      try { spec = def.build(values, results); } catch (e) { spec = null; }
      if (spec) kindSpec[def.kind] = spec;
    });
  });

  if (kindSpec.bars) {
    var bars = CH.exportData('bars', kindSpec.bars);
    H.eq('bars export as columns', bars.chart, 'col');
    H.check('a bars reference line becomes a plotted column',
      !isFinite(kindSpec.bars.refValue) ||
      bars.rows.some(function (r) { return /reference/i.test(r[0]); }));
  }
  if (kindSpec.curve) {
    var curve = CH.exportData('curve', kindSpec.curve);
    H.eq('curves export as scatter', curve.chart, 'scatter');
    H.check('a curve is sampled to a readable number of rows',
      curve.rows.length <= 62, curve.rows.length + ' rows');
  }
  if (kindSpec.windows) {
    var win = CH.exportData('windows', kindSpec.windows);
    H.eq('windows export as a stacked float bar', win.chart, 'stacked');
    H.deep('the float offset is the hidden segment', own(win.noFillCols), [1]);
  }
  if (kindSpec.meter) {
    var meter = CH.exportData('meter', kindSpec.meter);
    H.eq('a gauge exports no chart', meter.chart, null);
    H.check('and says why', /gauge/i.test(meter.reason || ''));
  }
  if (kindSpec.matrix) {
    var matrix = CH.exportData('matrix', kindSpec.matrix);
    H.eq('a probability–impact grid exports no chart', matrix.chart, null);
    H.check('and says why', (matrix.reason || '').length > 30);
  }

  /* A series drawn on a grid it does not share is the bug this guards:
     a two-point baseline resampled onto a 60-point curve plots two units
     long. Series on their own x grid must carry their own x column. */
  var mixed = CH.exportData('curve', {
    xLabel: 'Unit',
    series: [
      { label: 'curve', points: [[1, 10], [2, 8], [3, 7], [4, 6]] },
      { label: 'flat', points: [[1, 10], [4, 10]] }
    ]
  });
  H.deep('series on different x grids get their own x columns',
    own(mixed.xCols), [0, 2]);
  H.eq('and the short series keeps its own last x',
    mixed.rows[1][2], 4);

  /* ── the sheet ─────────────────────────────────────────────────── */

  H.suite('sheet layout');

  var evCard = null;
  H.eachCard(data, function (card) {
    if (card.id === 'earned-value') evCard = card;
  });
  H.check('the earned value card is still the export fixture', !!evCard);

  if (evCard) {
    var vals = H.exampleValues(evCard);
    var res = resultsFor(evCard, vals);
    var charts = evCard.charts.map(function (def) {
      var spec = null;
      try { spec = def.build(vals, res); } catch (e) { spec = null; }
      return { def: def, spec: spec };
    });
    var when = new Date('2026-09-01T12:00:00Z');
    var sheet = EX.sheetFor(evCard, vals, res, charts, when);

    var flat = sheet.rows.map(function (r) {
      return r.map(function (c) {
        return c && typeof c === 'object' ? c.v : c;
      });
    });
    var text = flat.map(function (r) { return r.join('\t'); }).join('\n');

    H.check('the sheet is named for the card',
      sheet.name === X.safeSheetName(evCard.name));
    H.check('it opens with the card name', flat[0][0] === evCard.name);
    H.check('it states where it came from', /yazeed\.blog/.test(text));
    H.check('it carries the parameter and result blocks',
      /PARAMETERS/.test(text) && /RESULTS/.test(text) && /FORMULA/.test(text));
    H.check('it carries the reading, not just the number',
      /Reading/.test(text) && text.indexOf('budget') !== -1);

    /* Values must arrive as numbers. A number stored as text is the classic
       broken export: it looks right and sums to zero. */
    var firstParam = evCard.inputs[0].label;
    var paramRow = null;
    sheet.rows.forEach(function (r, i) {
      if (r[0] === firstParam) paramRow = i;
    });
    H.check('every parameter row is present', paramRow !== null, firstParam);
    H.check('a parameter value is stored as a number, not text',
      paramRow !== null && typeof sheet.rows[paramRow][1].v === 'number',
      paramRow === null ? 'row not found' : JSON.stringify(sheet.rows[paramRow][1]));

    H.check('the file is named for the card and the day',
      EX.filenameFor(evCard, when) === 'earned-value-core-forecasting-2026-09-01.xlsx',
      EX.filenameFor(evCard, when));

    H.check('markup never reaches a cell', !/[<>]/.test(text));

    /* Anchors are laid out so a chart cannot land on the one above it —
       the failure is two plots stacked in the same cells. */
    var overlaps = [];
    sheet.charts.forEach(function (c, i) {
      if (i && c.anchor.row <= sheet.charts[i - 1].anchor.rowEnd) {
        overlaps.push(i + ': ' + c.anchor.row + ' <= ' + sheet.charts[i - 1].anchor.rowEnd);
      }
    });
    H.deep('charts never overlap each other', overlaps, []);
    H.check('charts sit clear of the columns the tables use',
      sheet.charts.every(function (c) { return c.anchor.col >= sheet.cols.length; }));

    /* The strongest check available without opening Excel: every series
       reference is resolved back to the sheet and compared to the numbers
       the series claims to plot. An off-by-one row fails here. */
    var misaligned = [];
    sheet.charts.forEach(function (c) {
      c.series.forEach(function (s) {
        var m = /\$([A-Z]+)\$(\d+):\$[A-Z]+\$(\d+)$/.exec(s.ref);
        if (!m) { misaligned.push('unparseable ref ' + s.ref); return; }
        var col = 0, letters = m[1], k;
        for (k = 0; k < letters.length; k++) {
          col = col * 26 + (letters.charCodeAt(k) - 64);
        }
        col -= 1;
        var from = Number(m[2]) - 1, to = Number(m[3]) - 1;
        if (to - from + 1 !== s.values.length) {
          misaligned.push(s.name + ': range covers ' + (to - from + 1) +
            ' cells for ' + s.values.length + ' values');
          return;
        }
        for (k = from; k <= to; k++) {
          var cell = sheet.rows[k] && sheet.rows[k][col];
          var got = cell && typeof cell === 'object' ? cell.v : cell;
          var want = s.values[k - from];
          if (want === null || want === undefined) continue;
          if (got !== want) {
            misaligned.push(s.name + ' row ' + (k + 1) + ': sheet has ' +
              JSON.stringify(got) + ', series claims ' + JSON.stringify(want));
            break;
          }
        }
      });
    });
    H.deep('every series reference resolves to the cells it plots',
      misaligned.slice(0, 4), []);

    /* And the same file, built for real, must still be a readable zip. */
    var book = readZip(X.build(sheet, { title: evCard.name, date: when }));
    H.check('the exported workbook is a valid zip', book.eocdFound &&
      book.declaredCount === book.entries.length);
    H.eq('it ships one chart part per plotted chart',
      names(book).filter(function (n) { return /^xl\/charts\/chart\d+\.xml$/.test(n); }).length,
      sheet.charts.length);
  }

  /* sheetFor splits a formula line on a run of four or more spaces. That
     only works while padding runs stay short and separator runs stay long;
     a line padded with four spaces would be cut in half mid-formula. The
     gap between the two is what makes the threshold safe, so hold it. */
  H.suite('formula splitting');
  var ambiguous = [];
  var sawSeparator = false;
  H.eachCard(data, function (card) {
    (card.formula || []).forEach(function (line) {
      (String(line).match(/ {2,}/g) || []).forEach(function (runText) {
        if (runText.length >= 6) sawSeparator = true;
        if (runText.length === 3 || runText.length === 4 || runText.length === 5) {
          ambiguous.push(card.id + ': ' + JSON.stringify(line));
        }
      });
    });
  });
  H.deep('no formula line uses a space run the split cannot classify',
    ambiguous.slice(0, 3), []);
  H.check('formula lines still pair two formulas with a wide gap', sawSeparator);

  H.suite('prose to cells');
  H.eq('tags are stripped', EX.plain('a <strong>b</strong> c'), 'a b c');
  H.eq('entities are decoded', EX.plain('a &amp; b &mdash; c'), 'a & b — c');
  H.eq('numeric entities are decoded', EX.plain('a&#39;b'), "a'b");
  H.eq('whitespace is collapsed', EX.plain('  a\n\n  b  '), 'a b');
  H.eq('an unknown entity is left alone', EX.plain('&zzz;'), '&zzz;');
  H.eq('empty input is safe', EX.plain(null), '');
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  run(H.loadPage('index.html'));
  H.report(TITLE);
}
