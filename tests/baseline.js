/* Formula baseline.

   Snapshots every calculator's output for its own worked example, so a later
   refactor has to prove it changed nothing. Run with `--write` to regenerate
   the snapshot deliberately; run with no flag to check against it.

     node tests/baseline.js --write     # capture (only when the math SHOULD change)
     node tests/baseline.js             # verify nothing drifted */

'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./harness');

var SNAP = path.join(__dirname, 'baseline.json');
var write = process.argv.indexOf('--write') !== -1;

var page = H.loadPage('pm-calculation-desk.html');
var DATA = page.sandbox.PM_DATA;

if (!DATA || !DATA.categories) {
  console.error('Could not load PM_DATA from pm-calculation-desk.html');
  process.exit(1);
}

var actual = {};

H.eachCard(DATA, function (card, cat) {
  var v = H.exampleValues(card);
  var row = { _inputs: v };
  card.outputs.forEach(function (out) {
    var val;
    try { val = out.compute(v); } catch (e) { val = '<<THREW: ' + e.message + '>>'; }
    /* Snapshot at full double precision — the point is to catch a changed
       formula, not to tolerate one. */
    row[out.key] = typeof val === 'number' ? (isFinite(val) ? val : String(val)) : val;
  });
  actual[cat.id + '/' + card.id] = row;
});

if (write) {
  fs.writeFileSync(SNAP, JSON.stringify(actual, null, 2) + '\n');
  console.log('baseline written: ' + Object.keys(actual).length + ' calculators');
  process.exit(0);
}

if (!fs.existsSync(SNAP)) {
  console.error('No baseline.json. Run: node tests/baseline.js --write');
  process.exit(1);
}

var expected = JSON.parse(fs.readFileSync(SNAP, 'utf8'));

H.suite('formula baseline');

Object.keys(expected).forEach(function (key) {
  var exp = expected[key];
  var act = actual[key];
  if (!H.check(key + ' still exists', !!act, 'calculator disappeared from PM_DATA')) return;

  Object.keys(exp).forEach(function (k) {
    if (k === '_inputs') return;
    var e = exp[k], a = act[k];
    if (typeof e === 'number' && typeof a === 'number') {
      H.check(key + '.' + k, Math.abs(a - e) <= 1e-9 * Math.max(1, Math.abs(e)),
        'was ' + e + ', now ' + a);
    } else {
      H.eq(key + '.' + k, a, e);
    }
  });
});

Object.keys(actual).forEach(function (key) {
  if (!expected[key]) {
    H.check(key + ' is new', true);
  }
});

H.report('Formula baseline');
