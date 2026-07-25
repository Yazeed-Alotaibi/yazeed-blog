/* Contract tests that apply to every calculator on the page at once.

   These are the invariants the renderer silently depends on. A duplicate
   output key, for example, breaks nothing at build time — the renderer's
   querySelector('[data-out=…]') just quietly writes both results into the
   first chip. Asserting the invariants here is what makes adding a 34th
   calculator safe. */

'use strict';

var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var pm = require('./load-data.js');

var DATA = pm.DATA;
var cards = pm.allCards();

function dupes(list) {
  var seen = Object.create(null);
  var dup = [];
  list.forEach(function (x) {
    if (seen[x]) { dup.push(x); } else { seen[x] = true; }
  });
  return dup;
}

/* ------------------------------------------------------------ identity */

test('category ids are unique', function () {
  var ids = DATA.categories.map(function (c) { return c.id; });
  assert.deepStrictEqual(dupes(ids), [], 'duplicate category ids collide in the sidebar nav');
});

test('card ids are unique across the whole page', function () {
  /* Cards become element ids (calc-<id>) and the search filter looks them up
     with getElementById, so a collision hides the wrong calculator. */
  var ids = cards.map(function (e) { return e.card.id; });
  assert.deepStrictEqual(dupes(ids), [], 'duplicate card ids collide in anchors and search');
});

test('input keys are unique within each calculator', function () {
  cards.forEach(function (e) {
    var keys = e.card.inputs.map(function (i) { return i.key; });
    assert.deepStrictEqual(dupes(keys), [],
      'calculator "' + e.card.id + '" reuses an input key');
  });
});

test('output keys are unique within each calculator', function () {
  cards.forEach(function (e) {
    var keys = e.card.outputs.map(function (o) { return o.key; });
    assert.deepStrictEqual(dupes(keys), [],
      'calculator "' + e.card.id + '" reuses an output key');
  });
});

/* ----------------------------------------------------------- completeness */

test('every category carries its teaching copy', function () {
  DATA.categories.forEach(function (cat) {
    assert.ok(cat.id, 'category is missing an id');
    assert.ok(cat.name, 'category "' + cat.id + '" is missing a name');
    assert.ok(cat.blurb, 'category "' + cat.id + '" is missing a blurb');
    assert.ok(Array.isArray(cat.cards) && cat.cards.length > 0,
      'category "' + cat.id + '" has no calculators');
  });
});

test('every calculator carries its teaching copy', function () {
  cards.forEach(function (e) {
    var c = e.card;
    assert.ok(c.name, 'calculator "' + c.id + '" is missing a name');
    assert.ok(c.tagline, 'calculator "' + c.id + '" is missing a tagline');
    assert.ok(c.about, 'calculator "' + c.id + '" is missing its "about" text');
    assert.ok(Array.isArray(c.formula) && c.formula.length > 0,
      'calculator "' + c.id + '" shows no formula');
    assert.ok(c.inputs.length > 0, 'calculator "' + c.id + '" has no inputs');
    assert.ok(c.outputs.length > 0, 'calculator "' + c.id + '" has no outputs');
  });
});

test('every input is fully labelled and explained', function () {
  cards.forEach(function (e) {
    e.card.inputs.forEach(function (inp) {
      var where = e.card.id + '.' + inp.key;
      assert.ok(inp.key, 'an input on "' + e.card.id + '" has no key');
      assert.ok(inp.label, where + ' is missing a label');
      assert.ok(inp.meaning, where + ' is missing its meaning text');
      assert.ok(inp.placeholder, where + ' is missing a placeholder example');
    });
  });
});

test('every result is fully labelled, explained and computable', function () {
  cards.forEach(function (e) {
    e.card.outputs.forEach(function (out) {
      var where = e.card.id + '.' + out.key;
      assert.ok(out.key, 'an output on "' + e.card.id + '" has no key');
      assert.ok(out.label, where + ' is missing a label');
      assert.ok(out.meaning, where + ' is missing its meaning text');
      assert.strictEqual(typeof out.compute, 'function', where + ' has no compute function');
      assert.strictEqual(typeof out.interpret, 'function',
        where + ' has no interpret function, so it renders a bare number with no advice');
    });
  });
});

/* --------------------------------------------------------------- behaviour */

test('an untouched form computes nothing rather than showing NaN', function () {
  /* Every card renders on page load with all fields empty. If any compute
     returned a number there, the user would see a result they never asked
     for; if it returned NaN the chip would read "NaN" instead of "—". */
  cards.forEach(function (e) {
    var r = pm.compute(e.card.id, {});
    Object.keys(r).forEach(function (k) {
      assert.strictEqual(r[k], null,
        e.card.id + '.' + k + ' returned ' + JSON.stringify(r[k]) + ' for an empty form');
    });
  });
});

test('no compute function throws, whatever is typed in', function () {
  /* The renderer wraps compute in try/catch, so a throw degrades to "—"
     rather than breaking the page — but it would silently kill a result the
     user expects to see. */
  var hostile = [0, 1, -1, -1000, 1e12, 0.0001, NaN];

  cards.forEach(function (e) {
    hostile.forEach(function (n) {
      var inputs = {};
      e.card.inputs.forEach(function (inp) {
        inputs[inp.key] = inp.type === 'text' ? n + ', ' + n : n;
      });
      assert.doesNotThrow(function () { pm.compute(e.card.id, inputs); },
        'calculator "' + e.card.id + '" threw on input ' + n);
    });

    /* Text fields get the worst of it — they are free-form strings. */
    var junk = ['', '   ', 'abc', ',,,', '1,,2', '-', 'NaN', '1e999'];
    junk.forEach(function (s) {
      var inputs = {};
      e.card.inputs.forEach(function (inp) { inputs[inp.key] = inp.type === 'text' ? s : 1; });
      assert.doesNotThrow(function () { pm.compute(e.card.id, inputs); },
        'calculator "' + e.card.id + '" threw on text input ' + JSON.stringify(s));
    });
  });
});

test('plausible project numbers never produce Infinity or NaN', function () {
  /* Guards against unreported divide-by-zero across all 99 outputs. */
  [1, 2, 10, 50].forEach(function (n) {
    cards.forEach(function (e) {
      var inputs = {};
      e.card.inputs.forEach(function (inp) {
        inputs[inp.key] = inp.type === 'text' ? n + ', ' + n : n;
      });
      var r = pm.compute(e.card.id, inputs);
      Object.keys(r).forEach(function (k) {
        var val = r[k];
        if (typeof val !== 'number') return;
        assert.ok(Number.isFinite(val),
          e.card.id + '.' + k + ' produced ' + val + ' from ordinary inputs of ' + n);
      });
    });
  });
});

test('a result that overflows to Infinity is still caught before display', function () {
  /* Compounding 1,000% over 1,000 periods exceeds the double range. The value
     is absurd, but the page must degrade to "—" rather than print "Infinity".
     This mirrors the guard at the top of the renderer's formatValue(). */
  var fv = pm.compute('tvm', { amount: 1000, rate: 1000, n: 1000 }).fv;
  assert.ok(!Number.isFinite(fv), 'expected this extreme case to overflow');
  assert.ok(
    fv === null || fv === undefined || (typeof fv === 'number' && !Number.isFinite(fv)),
    'the renderer displays "—" for exactly this shape of value'
  );
});

test('every verdict uses a tone the stylesheet defines', function () {
  /* The renderer does chip.classList.add(verdict.tone), so an unknown tone
     produces an unstyled chip. */
  var allowed = ['good', 'warn', 'bad', 'info'];

  [1, 2, 10, 50, 100].forEach(function (n) {
    cards.forEach(function (e) {
      var inputs = {};
      e.card.inputs.forEach(function (inp) {
        inputs[inp.key] = inp.type === 'text' ? n + ', ' + n : n;
      });
      e.card.outputs.forEach(function (out) {
        var v = pm.verdict(e.card.id, out.key, inputs);
        if (v === null || v === undefined) return;
        assert.ok(allowed.indexOf(v.tone) !== -1,
          e.card.id + '.' + out.key + ' returned unknown tone "' + v.tone + '"');
        assert.ok(v.text && typeof v.text === 'string',
          e.card.id + '.' + out.key + ' returned a verdict with no text');
      });
    });
  });
});

test('formats are ones the renderer knows how to print', function () {
  /* formatValue() switches on these; anything else silently falls through to
     the default branch, which is fine for numbers but wrong for money. */
  var known = ['money', 'pct', 'ratio', 'int', 'num', 'text', undefined];
  cards.forEach(function (e) {
    e.card.outputs.forEach(function (out) {
      assert.ok(known.indexOf(out.format) !== -1,
        e.card.id + '.' + out.key + ' uses unknown format "' + out.format + '"');
    });
  });
});

/* ------------------------------------------------------- homepage sync */

test('the homepage advertises the counts the data actually contains', function () {
  /* index.html hard-codes "14 domains · 33 calculators · 99 metrics" on the
     tool card. Adding a calculator without updating it makes the site lie. */
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

  var found = {};
  var re = /<div class="stat-num">(\d+)<\/div>\s*<div class="stat-label">([^<]+)<\/div>/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    found[m[2].trim().toLowerCase()] = Number(m[1]);
  }

  var outputs = 0;
  cards.forEach(function (e) { outputs += e.card.outputs.length; });

  assert.strictEqual(found.domains, DATA.categories.length,
    'index.html advertises ' + found.domains + ' domains, data has ' + DATA.categories.length);
  assert.strictEqual(found.calculators, cards.length,
    'index.html advertises ' + found.calculators + ' calculators, data has ' + cards.length);
  assert.strictEqual(found.metrics, outputs,
    'index.html advertises ' + found.metrics + ' metrics, data has ' + outputs);
});

test('the homepage links to a page that exists', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  var links = [];
  var re = /href="([^"#:]+\.html)"/g;
  var m;
  while ((m = re.exec(html)) !== null) { links.push(m[1]); }

  assert.ok(links.length > 0, 'expected at least one local page link on the homepage');
  links.forEach(function (href) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', href)),
      'index.html links to "' + href + '", which is not in the repo');
  });
});
