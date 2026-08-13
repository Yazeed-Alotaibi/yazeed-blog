/* Shared test plumbing.

   The site has no build step and no dependencies, and these tests keep that
   promise: they run on a bare `node`, and they read the shipped HTML rather
   than a parallel copy of the logic. Extracting the script blocks from the
   real file is the point — a test that reads its own duplicate of a formula
   proves nothing about what visitors run. */

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

/* Pull the <script> blocks out of a page and evaluate them in one shared
   sandbox, in document order, exactly as a browser would. */
function loadPage(file) {
  var html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  var blocks = [];
  var re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  var m;
  while ((m = re.exec(html)) !== null) blocks.push(m[1]);

  var sandbox = {
    console: console,
    module: { exports: {} },
    setTimeout: function () { return 0; },
    clearTimeout: function () {},
    Math: Math,
    Date: Date
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  /* Only the data/logic blocks evaluate cleanly headless; the render block
     needs a DOM. Skip what throws on a missing document and keep going —
     the assertions below only ever touch the pure logic. */
  var loaded = [];
  blocks.forEach(function (src, i) {
    if (/document\.getElementById|document\.createElement/.test(src) &&
        !/^\s*\/\* PM Calculation Desk — calculator definitions/.test(src)) {
      return;
    }
    try {
      vm.runInContext(src, sandbox, { filename: file + '#block' + i });
      loaded.push(i);
    } catch (e) {
      throw new Error('Failed evaluating ' + file + ' script block ' + i + ': ' + e.message);
    }
  });

  return { sandbox: sandbox, html: html, blocks: blocks, loaded: loaded };
}

/* ── assertions ─────────────────────────────────────────────────── */

var passed = 0;
var failures = [];
var currentSuite = '';

function suite(name) { currentSuite = name; }

function check(label, condition, detail) {
  if (condition) { passed += 1; return true; }
  failures.push({ suite: currentSuite, label: label, detail: detail || '' });
  return false;
}

function eq(label, actual, expected, detail) {
  return check(label, Object.is(actual, expected) || actual === expected,
    detail || ('expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)));
}

/* Formula results are compared to a tolerance, not bit-for-bit: the point is
   that the arithmetic did not change, not that floating point is exact. */
function near(label, actual, expected, tol) {
  tol = tol === undefined ? 1e-9 : tol;
  var okNum = typeof actual === 'number' && isFinite(actual) &&
    Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected));
  return check(label, okNum,
    'expected ≈' + expected + ', got ' + JSON.stringify(actual));
}

function report(title) {
  var total = passed + failures.length;
  if (failures.length) {
    console.log('\n' + title + ': ' + passed + '/' + total + ' passed, ' +
      failures.length + ' FAILED\n');
    failures.forEach(function (f) {
      console.log('  ✗ [' + f.suite + '] ' + f.label);
      if (f.detail) console.log('      ' + f.detail);
    });
    console.log('');
    process.exitCode = 1;
    return false;
  }
  console.log(title + ': ' + passed + '/' + total + ' passed');
  return true;
}

/* ── input generators for edge-case sweeps ──────────────────────── */

/* Every awkward value a real person can put in a number field, plus the ones
   they cannot type but a pasted spreadsheet cell can. */
var EDGE_NUMBERS = [
  0, 1, -1, 0.5, -0.5, 100, -100,
  1e-9, 1e9, 1e15, -1e15,
  0.1 + 0.2,
  NaN
];

var EDGE_TEXT = [
  '', '   ', '0', '1,2,3', '1, 2, 3', '-1,-2', '1;2;3', '1 2 3',
  'abc', '1,abc,3', '0,0,0', '1e9,1e9', '-0', '1.5,2.5'
];

function inputSweeps(card, seedIndex) {
  var v = {};
  card.inputs.forEach(function (inp, i) {
    if (inp.type === 'text') {
      v[inp.key] = EDGE_TEXT[(seedIndex + i) % EDGE_TEXT.length];
    } else {
      v[inp.key] = EDGE_NUMBERS[(seedIndex + i) % EDGE_NUMBERS.length];
    }
  });
  return v;
}

/* The values the card's own placeholders suggest — a realistic worked
   example, which is what most assertions should exercise. */
function exampleValues(card) {
  var v = {};
  card.inputs.forEach(function (inp) {
    if (inp.type === 'text') {
      v[inp.key] = String(inp.placeholder || '').replace(/^e\.g\.\s*/, '');
    } else {
      var n = parseFloat(String(inp.placeholder || '').replace(/^e\.g\.\s*/, ''));
      v[inp.key] = n;
    }
  });
  return v;
}

function eachCard(data, fn) {
  data.categories.forEach(function (cat) {
    cat.cards.forEach(function (card) { fn(card, cat); });
  });
}

module.exports = {
  loadPage: loadPage,
  suite: suite,
  check: check,
  eq: eq,
  near: near,
  report: report,
  EDGE_NUMBERS: EDGE_NUMBERS,
  EDGE_TEXT: EDGE_TEXT,
  inputSweeps: inputSweeps,
  exampleValues: exampleValues,
  eachCard: eachCard,
  get failures() { return failures; }
};
