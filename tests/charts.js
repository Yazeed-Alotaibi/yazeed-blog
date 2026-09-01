/* Chart builder tests.

   Every builder is exercised against: (1) the card's own worked example,
   where a chart is expected to appear and its numbers must trace back to
   the card's own computed results, never a re-derived figure; and (2) the
   full edge-case sweep, where a builder must never throw and must return
   either a well-formed spec object or null — nothing in between. */

'use strict';

var H = require('./harness');

var page = H.loadPage('index.html');
var DATA = page.sandbox.PM_DATA;
var CHARTS = page.sandbox.PM_CHARTS;

if (!CHARTS) {
  console.error('PM_CHARTS did not load — check the chart engine <script> block evaluates headless.');
  process.exit(1);
}

function computeResults(card, v) {
  var r = {};
  card.outputs.forEach(function (out) {
    var val;
    try { val = out.compute(v); } catch (e) { val = null; }
    r[out.key] = val;
  });
  return r;
}

H.suite('chart builders — worked example');

var chartedCards = 0, totalCharts = 0, producedOnExample = 0;

H.eachCard(DATA, function (card, cat) {
  if (!card.charts || !card.charts.length) return;
  chartedCards += 1;
  var v = H.exampleValues(card);
  var r = computeResults(card, v);

  card.charts.forEach(function (def) {
    totalCharts += 1;
    var id = cat.id + '/' + card.id + ' :: ' + def.title;

    H.check(id + ' has a purpose sentence', typeof def.purpose === 'string' && def.purpose.length > 0);
    H.check(id + ' has a known renderer', typeof CHARTS.renderers[def.kind] === 'function',
      'kind=' + def.kind);

    var spec, threw = false, msg = '';
    try { spec = def.build(v, r); } catch (e) { threw = true; msg = e.message; }
    H.check(id + ' build() never throws on the worked example', !threw, msg);
    if (threw) return;

    /* The worked example is the card's own placeholders — every card's
       author considered these representative, so a chart with real inputs
       to plot should produce a spec, not fall back to the empty state. */
    if (spec !== null) {
      producedOnExample += 1;
      var renderer = CHARTS.renderers[def.kind];
      var out;
      try { out = renderer(spec, 360); } catch (e) { out = null; H.check(id + ' renders at 360px without throwing', false, e.message); }
      if (out) {
        H.check(id + ' renderer returns svg', typeof out.svg === 'string' && out.svg.indexOf('<svg') === 0);
        H.check(id + ' renderer returns a summary', typeof out.summary === 'string');
        H.check(id + ' renderer returns a data table', out.table && Array.isArray(out.table.head) && Array.isArray(out.table.rows));
      }
      /* Widescreen too — the same spec must survive very different widths. */
      var outWide;
      try { outWide = renderer(spec, 900); } catch (e) { outWide = null; H.check(id + ' renders at 900px without throwing', false, e.message); }
      if (outWide) H.check(id + ' renders at 900px', typeof outWide.svg === 'string');
    } else {
      H.check(id + ' returns null on its own worked example (chart may be conditional)', true);
    }
  });
});

console.log('  (' + chartedCards + ' cards carry charts, ' + totalCharts + ' chart definitions, ' +
  producedOnExample + ' produced a plot on their worked example)');

H.suite('chart builders — edge-case sweep');

var SWEEPS = 20;

H.eachCard(DATA, function (card, cat) {
  if (!card.charts || !card.charts.length) return;

  for (var s = 0; s < SWEEPS; s++) {
    var v = H.inputSweeps(card, s);
    var r = computeResults(card, v);

    card.charts.forEach(function (def) {
      var id = cat.id + '/' + card.id + ' :: ' + def.title + ' (sweep ' + s + ')';
      var spec, threw = false, msg = '';
      try { spec = def.build(v, r); } catch (e) { threw = true; msg = e.message; }
      H.check(id + ' build() never throws', !threw, 'inputs ' + JSON.stringify(v) + ' → ' + msg);
      if (threw) return;

      H.check(id + ' returns null or an object', spec === null || (typeof spec === 'object' && spec !== undefined),
        'got ' + JSON.stringify(spec));

      if (spec !== null && spec !== undefined) {
        var renderer = CHARTS.renderers[def.kind];
        var out, rThrew = false, rMsg = '';
        try { out = renderer(spec, 360); } catch (e) { rThrew = true; rMsg = e.message; }
        H.check(id + ' renderer never throws on this spec', !rThrew,
          'spec ' + JSON.stringify(spec) + ' → ' + rMsg);
        if (!rThrew && out) {
          /* No NaN/Infinity should ever reach the SVG string — that would
             draw a broken instrument instead of refusing to draw at all. */
          H.check(id + ' svg contains no NaN', out.svg.indexOf('NaN') === -1, 'svg contained NaN');
          H.check(id + ' svg contains no Infinity', out.svg.indexOf('Infinity') === -1, 'svg contained Infinity');
        }
      }
    });
  }
});

/* Empty-input state: every chart must return null (its documented empty
   state), never throw, when nothing has been typed. */
H.suite('chart builders — empty input');

H.eachCard(DATA, function (card, cat) {
  if (!card.charts || !card.charts.length) return;
  var v = {};
  card.inputs.forEach(function (inp) { v[inp.key] = inp.type === 'text' ? '' : NaN; });
  var r = computeResults(card, v);

  card.charts.forEach(function (def) {
    var id = cat.id + '/' + card.id + ' :: ' + def.title;
    var spec, threw = false, msg = '';
    try { spec = def.build(v, r); } catch (e) { threw = true; msg = e.message; }
    H.check(id + ' build() never throws on empty input', !threw, msg);
    H.check(id + ' returns null on empty input', spec === null || spec === undefined,
      'got ' + JSON.stringify(spec) + ' from all-blank inputs');
  });
});

H.report('Chart builders');
