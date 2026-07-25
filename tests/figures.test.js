/* The interactive figures.

   Each draw() is a pure function of (inputs, results, width) returning SVG
   markup, so it is testable without a browser. The failure modes worth
   guarding are specific: a NaN reaching a coordinate silently kills a path
   (SVG has no error, the mark just vanishes), and a class name that no longer
   exists in the stylesheet renders an invisible or unstyled mark. Both look
   like "the chart is blank" and neither throws. */

'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var pm = require('./load-data.js');

var PAGE = path.join(__dirname, '..', 'pm-calculation-desk.html');
var HTML = fs.readFileSync(PAGE, 'utf8');
var VIZ = pm.DATA.viz;

/* Representative inputs, one set per figure — the same values the figures
   were designed and eyeballed against. */
var CASES = {
  'earned-value':   { bac: 100000, pv: 50000, ev: 45000, ac: 60000 },
  'three-point':    { o: 4, m: 6, p: 14 },
  'float':          { es: 5, ef: 10, ls: 8, lf: 13, succEs: 12 },
  'breakeven':      { fixed: 10000, price: 50, varCost: 30 },
  'npv':            { rate: 10, inv: 1000, flows: '500, 500, 500' },
  'control':        { mean: 50, sigma: 2 },
  'cpk':            { usl: 110, lsl: 90, mean: 104, sigma: 2 },
  'decision-tree':  { costA: 10000, pA: 60, winA: 50000, loseA: -5000,
                      costB: 20000, pB: 80, winB: 60000, loseB: -10000 },
  'learning-curve': { t1: 100, rate: 80, n: 8 },
  'littles-law':    { wip: 10, throughput: 2, workTime: 1 }
};

var IDS = Object.keys(VIZ);

function render(id, inputs, w) {
  return VIZ[id].draw(inputs, pm.compute(id, inputs), w || 680);
}

/* -------------------------------------------------------------- wiring */

test('every figure attaches to a calculator that exists', function () {
  IDS.forEach(function (id) {
    assert.doesNotThrow(function () { pm.card(id); },
      'figure "' + id + '" has no matching calculator');
  });
});

test('every figure declares a caption, an aria description and a draw', function () {
  IDS.forEach(function (id) {
    var f = VIZ[id];
    assert.ok(f.caption, id + ' has no caption');
    assert.strictEqual(typeof f.aria, 'function', id + ' has no aria function');
    assert.strictEqual(typeof f.draw, 'function', id + ' has no draw function');
  });
});

test('the ten figures cover the calculators they were built for', function () {
  assert.deepStrictEqual(IDS.slice().sort(), Object.keys(CASES).sort());
});

/* ------------------------------------------------------------ rendering */

test('every figure renders for its representative inputs', function () {
  IDS.forEach(function (id) {
    var out = render(id, CASES[id]);
    assert.ok(out, id + ' returned null for inputs it should handle');
    assert.ok(out.h > 0, id + ' returned a non-positive height');
    assert.ok(out.s && out.s.length > 200, id + ' returned suspiciously little markup');
  });
});

test('no figure emits NaN, Infinity or undefined into its markup', function () {
  /* The important one. A NaN in a path's `d` or a rect's `width` makes the
     mark silently disappear — no exception, no console error, just a gap. */
  IDS.forEach(function (id) {
    var out = render(id, CASES[id]);
    ['NaN', 'Infinity', 'undefined', 'null'].forEach(function (bad) {
      assert.ok(out.s.indexOf(bad) === -1,
        id + ' emitted "' + bad + '" into its SVG markup');
    });
  });
});

test('figure markup has balanced tags', function () {
  IDS.forEach(function (id) {
    var s = render(id, CASES[id]).s;
    var open = (s.match(/<(?!\/)[a-zA-Z]/g) || []).length;
    var close = (s.match(/<\/[a-zA-Z]/g) || []).length;
    var self = (s.match(/\/>/g) || []).length;
    assert.strictEqual(open, close + self,
      id + ' has unbalanced markup: ' + open + ' opening, ' + close + ' closing, ' +
      self + ' self-closing');
  });
});

test('every figure renders across the width range it has to survive', function () {
  [300, 420, 680, 1100, 1600].forEach(function (w) {
    IDS.forEach(function (id) {
      var out = render(id, CASES[id], w);
      assert.ok(out, id + ' returned null at width ' + w);
      assert.ok(out.s.indexOf('NaN') === -1, id + ' emitted NaN at width ' + w);
    });
  });
});

/* ------------------------------------------------------------- classes */

test('every class a figure uses is defined in the stylesheet', function () {
  /* Catches a renamed or deleted class — the mark still draws, just unstyled
     or invisible, which no other check would notice. */
  var css = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>'));
  var defined = {};
  (css.match(/\.[a-z][a-z0-9-]*/g) || []).forEach(function (c) {
    defined[c.slice(1)] = true;
  });

  IDS.forEach(function (id) {
    var s = render(id, CASES[id]).s;
    var used = {};
    (s.match(/class="([^"]+)"/g) || []).forEach(function (attr) {
      attr.replace(/class="|"/g, '').split(/\s+/).filter(Boolean).forEach(function (c) {
        used[c] = true;
      });
    });
    Object.keys(used).forEach(function (c) {
      assert.ok(defined[c], id + ' uses CSS class "' + c + '", which the stylesheet does not define');
    });
  });
});

test('every custom property a figure references is declared', function () {
  var root = HTML.slice(HTML.indexOf(':root {'), HTML.indexOf('}', HTML.indexOf(':root {')));
  IDS.forEach(function (id) {
    var s = render(id, CASES[id]).s;
    (s.match(/var\(--[a-z0-9-]+\)/g) || []).forEach(function (ref) {
      var name = ref.slice(4, -1);
      assert.ok(root.indexOf(name + ':') !== -1,
        id + ' references ' + ref + ', which :root does not declare');
    });
  });
});

/* ------------------------------------------------------------ behaviour */

test('an empty form draws nothing rather than an empty axis', function () {
  /* The renderer hides the whole figure on null. Returning a stub instead
     would leave a bare set of axes sitting under an untouched calculator. */
  IDS.forEach(function (id) {
    var inputs = {};
    assert.strictEqual(render(id, inputs), null,
      id + ' drew something for a completely empty form');
  });
});

test('no figure throws, whatever is typed in', function () {
  /* drawViz wraps this in try/catch so a throw degrades to a hidden figure,
     but that silently removes a chart the reader expects. */
  var hostile = [0, 1, -1, -1000, 1e12, 0.0001, NaN];

  IDS.forEach(function (id) {
    var card = pm.card(id);
    hostile.forEach(function (n) {
      var inputs = {};
      card.inputs.forEach(function (inp) {
        inputs[inp.key] = inp.type === 'text' ? n + ', ' + n : n;
      });
      assert.doesNotThrow(function () { render(id, inputs); },
        id + ' threw on uniform input ' + n);
    });

    ['', '   ', 'abc', ',,,', '1,,2', '-', '1e999'].forEach(function (junk) {
      var inputs = {};
      card.inputs.forEach(function (inp) { inputs[inp.key] = inp.type === 'text' ? junk : 1; });
      assert.doesNotThrow(function () { render(id, inputs); },
        id + ' threw on text input ' + JSON.stringify(junk));
    });
  });
});

test('a figure that does render on hostile input still emits clean markup', function () {
  IDS.forEach(function (id) {
    var card = pm.card(id);
    [0, -1, 1e9].forEach(function (n) {
      var inputs = {};
      card.inputs.forEach(function (inp) {
        inputs[inp.key] = inp.type === 'text' ? n + ', ' + n : n;
      });
      var out = render(id, inputs);
      if (!out) return;                       /* declining to draw is fine */
      assert.ok(out.s.indexOf('NaN') === -1, id + ' emitted NaN at input ' + n);
      assert.ok(out.s.indexOf('Infinity') === -1, id + ' emitted Infinity at input ' + n);
    });
  });
});

test('aria descriptions are real sentences, not placeholders', function () {
  IDS.forEach(function (id) {
    var label = VIZ[id].aria(CASES[id], pm.compute(id, CASES[id]));
    assert.strictEqual(typeof label, 'string', id + ' aria did not return a string');
    assert.ok(label.length > 40, id + ' aria description is too short to describe anything');
    assert.ok(label.indexOf('NaN') === -1 && label.indexOf('undefined') === -1,
      id + ' aria description contains a broken value: ' + label);
  });
});

/* ------------------------------------------------- palette conformance */

test('figures never use a raw hex — colour comes from tokens only', function () {
  /* Keeps the encoding honest: every colour in a figure resolves to the
     accent ramp or a reserved status token, so the palette can be re-stepped
     in one place. */
  IDS.forEach(function (id) {
    var s = render(id, CASES[id]).s;
    var hexes = s.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
    assert.deepStrictEqual(hexes, [],
      id + ' hard-codes ' + hexes.join(', ') + ' instead of using a token');
  });
});

test('the ordinal ramp stays light-to-dark', function () {
  /* The ramp's whole job is that step 1 reads as "less" and step 5 as "more".
     Re-stepping one value without checking would break the nested bands. */
  var root = HTML.slice(HTML.indexOf(':root {'), HTML.indexOf('}', HTML.indexOf(':root {')));
  var steps = [1, 2, 3, 4, 5].map(function (i) {
    var m = root.match(new RegExp('--viz-' + i + ':\\s*(#[0-9a-f]{6})', 'i'));
    assert.ok(m, '--viz-' + i + ' is not declared');
    return m[1];
  });

  function luminance(hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  for (var i = 1; i < steps.length; i++) {
    assert.ok(luminance(steps[i]) < luminance(steps[i - 1]),
      '--viz-' + (i + 1) + ' (' + steps[i] + ') is not darker than --viz-' + i +
      ' (' + steps[i - 1] + ') — the ramp is no longer monotone');
  }
});
