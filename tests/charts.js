/* Chart builder tests.

   Worked examples are compared to exact characterized specs. Point-series
   boundaries are checked explicitly, and a deliberate edge-class pass keeps
   every builder and renderer on the no-throw/no-NaN contract. */

'use strict';

var H = require('./harness');
var BASELINE = require('./charts-baseline.json');
var TITLE = 'Chart builders';

function computeResults(card, v) {
  var r = {};
  card.outputs.forEach(function (out) {
    try { r[out.key] = out.compute(v); } catch (e) { r[out.key] = null; }
  });
  return r;
}

function plain(value) {
  var copy;
  if (value === undefined) return undefined;
  copy = JSON.parse(JSON.stringify(value));
  if (copy && typeof copy === 'object') delete copy.summary;
  return copy;
}

function pointBoundaries(spec) {
  var boundaries = [];
  if (!spec || !spec.series) return null;

  spec.series.forEach(function (series) {
    var xs;
    var ys;
    if (!series.points || !series.points.length) return;
    xs = series.points.map(function (point) { return point[0]; });
    ys = series.points.map(function (point) { return point[1]; });
    boundaries.push({
      label: series.label,
      first: series.points[0],
      last: series.points[series.points.length - 1],
      minX: Math.min.apply(Math, xs),
      maxX: Math.max.apply(Math, xs),
      minY: Math.min.apply(Math, ys),
      maxY: Math.max.apply(Math, ys)
    });
  });

  return boundaries.length ? boundaries : null;
}

function renderAt(id, renderer, spec, width) {
  var out;
  var problem = '';
  try {
    out = renderer(spec, width);
  } catch (e) {
    problem = 'threw: ' + e.message;
  }
  if (!problem && (!out ||
      typeof out.svg !== 'string' || out.svg.indexOf('<svg') !== 0 ||
      typeof out.summary !== 'string' ||
      !out.table || !Array.isArray(out.table.head) || !Array.isArray(out.table.rows))) {
    problem = 'renderer returned a malformed result';
  }
  if (!problem && (out.svg.indexOf('NaN') !== -1 || out.svg.indexOf('Infinity') !== -1)) {
    problem = 'renderer emitted a non-finite SVG coordinate';
  }
  H.check(id + ' renders at ' + width + 'px', !problem, problem);
}

function edgeValues(card, numberValue, textValue) {
  var v = {};
  card.inputs.forEach(function (inp) {
    v[inp.key] = inp.type === 'text' ? textValue : numberValue;
  });
  return v;
}

function verifyEdge(id, def, renderer, v, label, card) {
  var spec;
  var out;
  var problem = '';
  var results = computeResults(card, v);

  try { spec = def.build(v, results); } catch (e) { problem = 'build threw: ' + e.message; }
  if (!problem && spec !== null && spec !== undefined && typeof spec !== 'object') {
    problem = 'build returned ' + JSON.stringify(spec);
  }
  if (!problem && spec !== null && spec !== undefined) {
    try { out = renderer(spec, 360); } catch (e) { problem = 'renderer threw: ' + e.message; }
    if (!problem && out && typeof out.svg === 'string' &&
        (out.svg.indexOf('NaN') !== -1 || out.svg.indexOf('Infinity') !== -1)) {
      problem = 'renderer emitted a non-finite SVG coordinate';
    }
  }

  H.check(id + ' handles ' + label, !problem,
    'inputs ' + JSON.stringify(v) + ' -> ' + problem);
}

function run(page) {
  var data = page.sandbox.PM_DATA;
  var charts = page.sandbox.PM_CHARTS;
  var seen = {};

  H.suite('worked-example specs');
  H.eachCard(data, function (card, cat) {
    if (!card.charts || !card.charts.length) return;
    var v = H.exampleValues(card);
    var results = computeResults(card, v);

    card.charts.forEach(function (def) {
      var id = cat.id + '/' + card.id + ' :: ' + def.title;
      var expected = BASELINE[id];
      var renderer = charts && charts.renderers[def.kind];
      var spec;
      var problem = '';
      seen[id] = true;

      H.check(id + ' metadata resolves a renderer',
        typeof def.purpose === 'string' && def.purpose.length > 0 &&
        typeof renderer === 'function',
        'kind=' + def.kind);

      try { spec = def.build(v, results); } catch (e) { problem = e.message; }
      if (expected) {
        H.deep(id + ' matches its worked-example spec',
          problem ? { threw: problem } : plain(spec),
          expected.spec);
      } else {
        H.deep(id + ' builds an uncharacterized chart spec',
          { kind: def.kind, result: problem ? 'threw' : typeof spec },
          { kind: def.kind, result: 'object' });
      }

      if (!problem && expected) {
        H.deep(id + ' keeps point-series boundaries',
          pointBoundaries(plain(spec)),
          pointBoundaries(expected.spec));
      }

      if (!problem && spec !== null && spec !== undefined && typeof renderer === 'function') {
        renderAt(id, renderer, spec, 360);
        renderAt(id, renderer, spec, 900);
      }
    });
  });

  Object.keys(BASELINE).forEach(function (id) {
    H.check(id + ' still exists', !!seen[id], 'chart disappeared from PM_DATA');
  });

  H.suite('edge-class specs');
  H.eachCard(data, function (card, cat) {
    if (!card.charts || !card.charts.length) return;
    var cases = [
      ['all inputs zero', edgeValues(card, 0, '0')],
      ['all numeric inputs negative', edgeValues(card, -1, '-1,-1')],
      ['huge inputs', edgeValues(card, 1e15, '1e15,1e15')],
      ['tiny inputs', edgeValues(card, 1e-9, '1e-9,1e-9')],
      ['malformed inputs', edgeValues(card, 'abc', 'abc')]
    ];

    card.charts.forEach(function (def) {
      var id = cat.id + '/' + card.id + ' :: ' + def.title;
      var renderer = charts.renderers[def.kind];
      cases.forEach(function (testCase) {
        verifyEdge(id, def, renderer, testCase[1], testCase[0], card);
      });
    });
  });

  H.suite('empty-input specs');
  H.eachCard(data, function (card, cat) {
    if (!card.charts || !card.charts.length) return;
    var v = edgeValues(card, NaN, '');
    var results = computeResults(card, v);

    card.charts.forEach(function (def) {
      var id = cat.id + '/' + card.id + ' :: ' + def.title;
      var spec;
      var problem = '';
      try { spec = def.build(v, results); } catch (e) { problem = 'threw: ' + e.message; }
      if (!problem && spec !== null && spec !== undefined) {
        problem = 'returned ' + JSON.stringify(spec);
      }
      H.check(id + ' returns the empty spec', !problem, problem);
    });
  });
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  var page = H.loadPage('index.html');
  if (!page.sandbox.PM_CHARTS) {
    console.error('PM_CHARTS did not load from index.html');
    process.exit(1);
  }
  run(page);
  H.report(TITLE);
}
