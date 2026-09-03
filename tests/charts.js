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

function finiteNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

function validGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object' || Array.isArray(geometry)) return false;
  return finiteNumber(geometry.x) && finiteNumber(geometry.y) &&
    finiteNumber(geometry.w) && finiteNumber(geometry.h) &&
    geometry.w >= 0 && geometry.h >= 0;
}

function inspectProblem(inspect) {
  var fields = ['width', 'height', 'x1', 'y1', 'x2', 'y2'];
  var problem = '';

  if (!inspect || typeof inspect !== 'object' || Array.isArray(inspect)) {
    return 'renderer omitted its inspection geometry';
  }
  fields.forEach(function (field) {
    if (!problem && !finiteNumber(inspect[field])) {
      problem = 'inspection ' + field + ' is not finite';
    }
  });
  if (problem) return problem;
  if (!(inspect.width > 0) || !(inspect.height > 0) ||
      !(inspect.x2 >= inspect.x1) || !(inspect.y2 >= inspect.y1)) {
    return 'inspection bounds are malformed';
  }
  if (!Array.isArray(inspect.items) || !inspect.items.length) {
    return 'inspection items are missing';
  }

  inspect.items.forEach(function (item, index) {
    if (problem) return;
    if (!item || typeof item !== 'object') {
      problem = 'inspection item ' + index + ' is malformed';
    } else if (!finiteNumber(item.x) || !finiteNumber(item.y)) {
      problem = 'inspection item ' + index + ' has a non-finite position';
    } else if (typeof item.label !== 'string' || !item.label.trim() ||
        typeof item.value !== 'string' || !item.value.trim()) {
      problem = 'inspection item ' + index + ' has an empty label or value';
    } else if (['none', 'x', 'xy'].indexOf(item.guide) === -1) {
      problem = 'inspection item ' + index + ' has an unknown guide';
    } else if (item.box !== undefined && !validGeometry(item.box)) {
      problem = 'inspection item ' + index + ' has malformed box geometry';
    } else if (item.hit !== undefined && !validGeometry(item.hit)) {
      problem = 'inspection item ' + index + ' has malformed hit geometry';
    }
  });

  return problem;
}

function renderAt(id, kind, renderer, spec, width) {
  var out;
  var problem = '';
  var boxes;
  var barPaths;
  try {
    out = renderer(spec, width);
  } catch (e) {
    problem = 'threw: ' + e.message;
  }
  if (!problem && (!out ||
      typeof out.svg !== 'string' || out.svg.indexOf('<svg') !== 0 ||
      typeof out.summary !== 'string' || !out.summary.length ||
      /NaN|Infinity/.test(out.summary) ||
      !out.table || !Array.isArray(out.table.head) || !Array.isArray(out.table.rows))) {
    problem = 'renderer returned a malformed result';
  }
  if (!problem && (out.svg.indexOf('NaN') !== -1 || out.svg.indexOf('Infinity') !== -1)) {
    problem = 'renderer emitted a non-finite SVG coordinate';
  }
  if (!problem) problem = inspectProblem(out.inspect);
  if (!problem && kind === 'bars') {
    boxes = out.inspect.items.filter(function (item) { return item.box; });
    barPaths = out.svg.match(/<path class="ch-bar\b[^>]*>/g) || [];
    if (!boxes.length || boxes.some(function (item) {
      return item.box.w > 24;
    })) {
      problem = 'bar inspection geometry exceeds the 24px thickness cap';
    } else if (!barPaths.length || barPaths.some(function (path) {
      return !/[Qq]/.test(path);
    })) {
      problem = 'bars are not drawn as rounded quadratic paths';
    } else if (/<rect class="ch-bar\b/.test(out.svg)) {
      problem = 'bars still use square-cornered rect elements';
    }
  }
  H.check(id + ' renders at ' + width + 'px', !problem, problem);
}

function inspectionRegressions(charts) {
  var meter = charts.renderers.meter({
    value: 12.5,
    target: 50,
    targetLabel: 'Stretch target',
    valueFmt: function (value) { return 'fmt(' + value.toFixed(1) + ')'; },
    zones: [
      { from: 0, to: 5, label: 'Low' },
      { from: 5, to: 10, label: 'High' }
    ]
  }, 360);
  var meterValues = meter.inspect.items.map(function (item) { return item.value; });
  var meterTarget = meter.inspect.items.filter(function (item) {
    return item.key === 'meter-target';
  })[0];

  H.deep('meter inspection formats its reading, target, and zones with valueFmt',
    plain(meterValues),
    ['fmt(12.5)', 'fmt(50.0)', 'fmt(0.0) – fmt(5.0)', 'fmt(5.0) – fmt(10.0)']);
  H.check('meter inspection includes an out-of-band target inside its plot bounds',
    !!meterTarget && meterTarget.x >= meter.inspect.x1 && meterTarget.x <= meter.inspect.x2,
    'target x=' + (meterTarget && meterTarget.x) +
      ', bounds=' + meter.inspect.x1 + '–' + meter.inspect.x2);

  var curveSpec = {
    xLabel: 'X',
    yLabel: 'Y',
    series: [
      { label: 'Alpha', points: [[2, 20], [1, 10], [3, 30]] },
      { label: 'Beta', points: [[1, 10], [2, 5], [3, 25]] }
    ]
  };
  var curve = charts.renderers.curve(curveSpec, 360);
  var curveAgain = charts.renderers.curve(curveSpec, 360);
  var coincident = curve.inspect.items.filter(function (item) {
    return item.label.indexOf('Alpha') !== -1 && item.label.indexOf('Beta') !== -1;
  })[0];
  var ordered = true;
  var i;

  for (i = 1; i < curve.inspect.items.length; i++) {
    if (curve.inspect.items[i - 1].x > curve.inspect.items[i].x ||
        (curve.inspect.items[i - 1].x === curve.inspect.items[i].x &&
         curve.inspect.items[i - 1].y > curve.inspect.items[i].y)) {
      ordered = false;
      break;
    }
  }

  H.check('curve inspection preserves both series at a coincident point',
    curve.inspect.items.length === 5 && !!coincident &&
      coincident.value.indexOf('Alpha 10') !== -1 &&
      coincident.value.indexOf('Beta 10') !== -1 &&
      coincident.value.indexOf('Alpha 10') < coincident.value.indexOf('Beta 10'),
    coincident ? coincident.label + ': ' + coincident.value : 'coincident point missing');
  H.check('curve inspection orders points by rendered x then y', ordered,
    JSON.stringify(curve.inspect.items.map(function (item) {
      return [item.key, item.x, item.y];
    })));
  H.deep('curve inspection order is deterministic across renders',
    curve.inspect.items.map(function (item) { return item.key; }),
    curveAgain.inspect.items.map(function (item) { return item.key; }));
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
    if (!problem && out &&
        (typeof out.summary !== 'string' || !out.summary.length ||
         /NaN|Infinity/.test(out.summary))) {
      problem = 'renderer emitted a malformed summary';
    }
    if (!problem && out) problem = inspectProblem(out.inspect);
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
        renderAt(id, def.kind, renderer, spec, 360);
        renderAt(id, def.kind, renderer, spec, 900);
      }
    });
  });

  Object.keys(BASELINE).forEach(function (id) {
    H.check(id + ' still exists', !!seen[id], 'chart disappeared from PM_DATA');
  });

  H.suite('inspection regressions');
  inspectionRegressions(charts);

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
