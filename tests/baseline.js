/* Formula baseline.

   Snapshots every calculator's output for its own worked example, so a later
   refactor has to prove it changed nothing. Run with --write to regenerate
   the snapshot deliberately; run with no flag to check against it. */

'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./harness');

var SNAP = path.join(__dirname, 'baseline.json');
var TITLE = 'Formula baseline';

function collect(page) {
  var data = page.sandbox.PM_DATA;
  var actual = {};

  if (!data || !data.categories) return null;

  H.eachCard(data, function (card, cat) {
    var v = H.exampleValues(card);
    var row = { _inputs: v };
    H.each(card.outputs, function (out) {
      var val;
      try { val = H.invoke(page, out.compute, [v]); }
      catch (e) { val = '<<THREW: ' + e.message + '>>'; }
      row[out.key] = typeof val === 'number' ? (isFinite(val) ? val : String(val)) : val;
    });
    actual[cat.id + '/' + card.id] = row;
  });

  return actual;
}

function run(page, options) {
  var actual = collect(page);
  var expected;
  options = options || {};

  H.suite('formula baseline');
  if (!H.check('PM_DATA loads from the page', !!actual, 'Could not load PM_DATA from index.html')) {
    return { wrote: false };
  }

  if (options.write) {
    fs.writeFileSync(SNAP, JSON.stringify(actual, null, 2) + '\n');
    console.log('baseline written: ' + Object.keys(actual).length + ' calculators');
    return { wrote: true };
  }

  if (!H.check('baseline snapshot exists', fs.existsSync(SNAP),
      'No baseline.json. Run: node tests/baseline.js --write')) {
    return { wrote: false };
  }
  expected = JSON.parse(fs.readFileSync(SNAP, 'utf8'));

  Object.keys(expected).forEach(function (key) {
    var exp = expected[key];
    var act = actual[key];
    if (!H.check(key + ' still exists', !!act, 'calculator disappeared from PM_DATA')) return;

    Object.keys(exp).forEach(function (k) {
      var e;
      var a;
      if (k === '_inputs') return;
      e = exp[k];
      a = act[k];
      if (typeof e === 'number' && typeof a === 'number') {
        H.check(key + '.' + k, Math.abs(a - e) <= 1e-9 * Math.max(1, Math.abs(e)),
          'was ' + e + ', now ' + a);
      } else {
        H.eq(key + '.' + k, a, e);
      }
    });
  });

  Object.keys(actual).forEach(function (key) {
    if (!expected[key]) H.check(key + ' is new', true);
  });

  return { wrote: false };
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  var result = run(H.loadPage('index.html'), {
    write: process.argv.indexOf('--write') !== -1
  });
  if (!result.wrote) H.report(TITLE);
}
