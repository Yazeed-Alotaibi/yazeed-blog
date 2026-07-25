/* Loads the PM_DATA calculator definitions out of pm-calculation-desk.html.

   The page keeps its data and its rendering logic in two separate inline
   <script> blocks. The first one is pure data plus pure functions with no DOM
   access, so it can be lifted out and run in a sandbox — that is what makes
   the compute functions testable without a browser. */

'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var PAGE = path.join(__dirname, '..', 'pm-calculation-desk.html');

function loadData() {
  var html = fs.readFileSync(PAGE, 'utf8');

  /* The data block is the first <script> on the page; the renderer is the
     second. Anchoring on `var PM_DATA` keeps this honest if the order ever
     changes — we want the data block specifically, not just "script one". */
  var blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  var source = null;

  for (var i = 0; i < blocks.length; i++) {
    var body = blocks[i].replace(/^<script>/, '').replace(/<\/script>$/, '');
    if (body.indexOf('var PM_DATA') !== -1) { source = body; break; }
  }

  if (source === null) {
    throw new Error('No <script> block defining PM_DATA found in ' + PAGE);
  }

  /* No `module` in the sandbox, so the page's CommonJS shim is a no-op and
     PM_DATA is simply left on the context as a global. */
  var context = { Number: Number, Math: Math, isFinite: isFinite };
  vm.createContext(context);
  new vm.Script(source, { filename: 'pm-calculation-desk.html <data>' }).runInContext(context);

  if (!context.PM_DATA || !Array.isArray(context.PM_DATA.categories)) {
    throw new Error('PM_DATA loaded but has no categories array');
  }
  return context.PM_DATA;
}

var DATA = loadData();

/* ---------------------------------------------------------------- lookup */

function allCards() {
  var out = [];
  DATA.categories.forEach(function (cat) {
    cat.cards.forEach(function (card) { out.push({ cat: cat, card: card }); });
  });
  return out;
}

/* Find a calculator by its card id, e.g. 'earned-value'. */
function card(id) {
  var hit = allCards().filter(function (e) { return e.card.id === id; })[0];
  if (!hit) throw new Error('No calculator with id "' + id + '"');
  return hit.card;
}

/* Run one calculator's outputs against a set of inputs and return a plain
   object of { outputKey: computedValue }. Mirrors what the page's
   computeCard() does, minus the DOM. */
function compute(id, inputs) {
  var c = card(id);
  var known = c.inputs.map(function (i) { return i.key; });

  Object.keys(inputs).forEach(function (k) {
    if (known.indexOf(k) === -1) {
      throw new Error('Calculator "' + id + '" has no input "' + k +
        '". Known inputs: ' + known.join(', '));
    }
  });

  /* Absent numeric inputs read as NaN in the browser (parseFloat of ''), and
     several compute functions rely on that to detect "not filled in yet". */
  var v = {};
  c.inputs.forEach(function (inp) {
    if (Object.prototype.hasOwnProperty.call(inputs, inp.key)) {
      v[inp.key] = inputs[inp.key];
    } else {
      v[inp.key] = inp.type === 'text' ? '' : NaN;
    }
  });

  var results = {};
  c.outputs.forEach(function (out) { results[out.key] = out.compute(v); });
  return results;
}

/* Compute a single output and also resolve its verdict tone, so tests can
   assert on the advice as well as the number. */
function verdict(id, outputKey, inputs) {
  var c = card(id);
  var out = c.outputs.filter(function (o) { return o.key === outputKey; })[0];
  if (!out) throw new Error('Calculator "' + id + '" has no output "' + outputKey + '"');

  var v = {};
  c.inputs.forEach(function (inp) {
    v[inp.key] = Object.prototype.hasOwnProperty.call(inputs, inp.key)
      ? inputs[inp.key]
      : (inp.type === 'text' ? '' : NaN);
  });

  var val = out.compute(v);
  if (val === null || val === undefined || !out.interpret) return null;
  return out.interpret(val, v);
}

module.exports = {
  DATA: DATA,
  allCards: allCards,
  card: card,
  compute: compute,
  verdict: verdict
};
