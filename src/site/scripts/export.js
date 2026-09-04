
/* ══ PM_EXPORT ═════════════════════════════════════════════════════════
   Lays a calculator out as a spreadsheet: what was entered, what came out,
   what each reading means, and every chart as data beside a live Excel
   chart drawn from that data.

   `sheetFor` is a pure function of the card, the values and the results —
   no DOM, no download — so the whole layout is testable without a browser.
   The parts that touch the page are the two functions below it. */

var PM_EXPORT = (function () {
  'use strict';

  var S = PM_XLSX.styles;

  /* Prose in PM_DATA is authored as HTML — a card's `about` carries
     <strong> and the odd entity. A spreadsheet cell wants the sentence. */
  var NAMED = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    nbsp: ' ', middot: '·', mdash: '—', ndash: '–', reg: '®'
  };

  function plain(html) {
    return String(html == null ? '' : html)
      .replace(/<[^>]*>/g, '')
      .replace(/&#(\d+);/g, function (m, code) {
        return String.fromCharCode(Number(code));
      })
      .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, function (m, name) {
        var key = name.toLowerCase();
        return Object.prototype.hasOwnProperty.call(NAMED, key) ? NAMED[key] : m;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Column layout. A is the label column and stays wide; C carries the
     verdict sentences and stays wider still. Charts are anchored well to
     the right of anything the tables use. */
  var COLS = [44, 17, 54, 17, 17, 17, 17];
  var CHART_COL = 8;          /* anchor column — I, clear of the tables */
  var CHART_W = 9;            /* columns wide */
  var CHART_H = 17;           /* rows tall */

  function styleFor(format) { return PM_XLSX.styleForFormat(format); }

  /* card:    a PM_DATA card
     values:  { inputKey: number|string }
     results: { outputKey: number|string|null }
     charts:  [ { def, spec } ] — the chart definitions with their live specs
     Returns a sheet ready for PM_XLSX.build. */
  function sheetFor(card, values, results, charts, now) {
    var sheetName = PM_XLSX.safeSheetName(card.name);
    var rows = [];
    var chartDefs = [];
    var chartFloor = 0;

    function add(row) { rows.push(row || []); return rows.length - 1; }
    function blank() { add([]); }
    function section(text) { return add([{ v: text, s: S.section }, { v: '', s: S.section }]); }
    function note(text) { return add([{ v: text, s: S.note }]); }

    add([{ v: card.name, s: S.title }]);
    add([{ v: plain(card.tagline), s: S.subtitle }]);
    if (card.about) note(plain(card.about));
    blank();
    add([{ v: 'Exported from yazeed.blog · ' + ymd(now), s: S.note }]);
    blank();

    if (card.formula && card.formula.length) {
      section('FORMULA');
      /* Formula lines are padded with spaces so that two formulas sit in
         columns under a monospace font. Collapsing that to one space loses
         the pairing, so split the line and let the sheet's own columns do
         the aligning instead.

         The threshold is four because the padding and the separator are
         different sizes: a run of two spaces aligns an operator inside one
         formula ("CV  = EV − AC"), while six or more divides one formula
         from the next. tests/export.js holds that gap open. */
      card.formula.forEach(function (line) {
        add(String(line).replace(/<[^>]*>/g, '').split(/\s{4,}/)
          .map(function (piece) { return plain(piece); })
          .filter(function (piece) { return piece !== ''; }));
      });
      blank();
    }

    section('PARAMETERS');
    add([{ v: 'Parameter', s: S.head }, { v: 'Value', s: S.headNum },
      { v: 'What it means', s: S.head }]);
    card.inputs.forEach(function (inp) {
      var raw = values[inp.key];
      var cell = (typeof raw === 'number' && isFinite(raw)) ? { v: raw, s: S.num }
        : { v: raw === undefined || raw === null || raw !== raw ? '' : String(raw), s: S.base };
      add([plain(inp.label), cell, { v: plain(inp.meaning), s: S.wrap }]);
    });
    blank();

    section('RESULTS');
    add([{ v: 'Result', s: S.head }, { v: 'Value', s: S.headNum },
      { v: 'Reading', s: S.head }]);
    card.outputs.forEach(function (out) {
      var val = results[out.key];
      var has = val !== null && val !== undefined && !(typeof val === 'number' && !isFinite(val));
      var verdict = null;
      if (has && out.interpret) {
        try { verdict = out.interpret(val, values); } catch (e) { verdict = null; }
      }
      var cell = has
        ? (typeof val === 'number' ? { v: val, s: styleFor(out.format) } : { v: String(val), s: S.base })
        : { v: '—', s: S.base };
      add([plain(out.label), cell, { v: verdict ? plain(verdict.text) : '', s: S.wrap }]);
    });
    blank();

    if (card.howto && card.howto.length) {
      section('HOW TO USE IT');
      card.howto.forEach(function (step, n) {
        add([{ v: (n + 1) + '. ' + plain(step), s: S.wrap }]);
      });
      blank();
    }

    (charts || []).forEach(function (entry) {
      var data = null;
      try {
        data = entry.spec ? PM_CHARTS.exportData(entry.def.kind, entry.spec) : null;
      } catch (e) {
        data = null;
      }

      section(plain(entry.def.title));
      if (entry.def.purpose) note(plain(entry.def.purpose));

      if (!data) {
        note(entry.spec
          ? 'These parameters cannot be plotted.'
          : 'Not plotted — this chart needs parameters that are not filled in.');
        blank();
        return;
      }

      if (entry.spec.summary) note(plain(entry.spec.summary));
      if (data.reason) note(data.reason);

      var headRow = add(data.head.map(function (h, n) {
        return { v: h, s: n === 0 ? S.head : S.headNum };
      }));
      var first = rows.length;
      data.rows.forEach(function (r) {
        add(r.map(function (cell, n) {
          if (typeof cell === 'number') return { v: cell, s: S.num };
          return { v: cell === null || cell === undefined ? '' : String(cell), s: n === 0 ? S.base : S.base };
        }));
      });
      var last = rows.length - 1;

      if (data.chart && data.chartRows > 0) {
        var lastPlotted = first + data.chartRows - 1;
        var anchorRow = Math.max(headRow - 1, chartFloor);
        chartFloor = anchorRow + CHART_H + 1;

        var cats = data.chart === 'scatter'
          ? {
            ref: PM_XLSX.absRange(sheetName, data.catCol, first, lastPlotted),
            values: column(data.rows, data.catCol, data.chartRows)
          }
          : {
            ref: PM_XLSX.absRange(sheetName, data.catCol, first, lastPlotted),
            values: column(data.rows, data.catCol, data.chartRows).map(function (c) {
              return c === null || c === undefined ? '' : String(c);
            })
          };

        var series = data.seriesCols.map(function (col, n) {
          var s = {
            name: data.head[col],
            nameRef: PM_XLSX.absCell(sheetName, col, headRow),
            ref: PM_XLSX.absRange(sheetName, col, first, lastPlotted),
            values: column(data.rows, col, data.chartRows),
            dash: data.dashes ? data.dashes[n] : null,
            noFill: !!(data.noFillCols && data.noFillCols.indexOf(col) !== -1)
          };
          /* Series on their own x grid carry their own x column. */
          if (data.xCols && data.xCols[n] !== undefined) {
            s.xRef = PM_XLSX.absRange(sheetName, data.xCols[n], first, lastPlotted);
            s.xValues = column(data.rows, data.xCols[n], data.chartRows);
          }
          return s;
        });

        chartDefs.push({
          type: data.chart === 'stacked' && data.stackedFallback ? 'col' : data.chart,
          title: plain(entry.def.title),
          xTitle: data.xTitle || '',
          yTitle: data.yTitle || '',
          valFormat: '#,##0.##',
          anchor: {
            col: CHART_COL, row: anchorRow,
            colEnd: CHART_COL + CHART_W, rowEnd: anchorRow + CHART_H
          },
          cats: cats,
          series: series
        });
      }

      blank();
    });

    add([{ v: 'Calculated in the browser at yazeed.blog — nothing was uploaded.', s: S.note }]);

    return {
      name: sheetName,
      rows: rows,
      cols: COLS,
      charts: chartDefs
    };
  }

  function column(rows, index, limit) {
    var out = [], i;
    for (i = 0; i < rows.length && i < limit; i++) {
      var cell = rows[i][index];
      out.push(cell === undefined ? null : cell);
    }
    return out;
  }

  function two(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(now) {
    var d = now || new Date();
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }

  function slug(name) {
    return String(name).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'calculator';
  }

  function filenameFor(card, now) {
    return slug(card.name) + '-' + ymd(now) + '.xlsx';
  }

  /* Handing the bytes to the browser needs a document, so that half lives
     with the rest of the page code. Everything here is a pure function of
     the card and its numbers, which is what makes it testable headless. */

  return {
    sheetFor: sheetFor,
    filenameFor: filenameFor,
    plain: plain
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PM_EXPORT;
