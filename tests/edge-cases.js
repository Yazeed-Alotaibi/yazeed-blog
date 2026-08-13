/* Edge-case sweep.

   Every calculator's compute() is run against zero, negative, empty,
   fractional, huge and malformed inputs. The bar is low but absolute: a
   compute() may return null, a number, or a string — it must never throw,
   and it must never hand back NaN or Infinity as if they were an answer
   (formatValue prints those as '—', but compute() itself should already
   have refused). interpret() gets the same treatment against whatever
   compute() actually returned. */

'use strict';

var H = require('./harness');

var page = H.loadPage('pm-calculation-desk.html');
var DATA = page.sandbox.PM_DATA;

H.suite('edge-case sweep');

var SWEEPS = 24; /* rotations through the edge-value tables per card */

H.eachCard(DATA, function (card, cat) {
  var id = cat.id + '/' + card.id;

  for (var s = 0; s < SWEEPS; s++) {
    var v = H.inputSweeps(card, s);
    var vLabel = JSON.stringify(v);

    card.outputs.forEach(function (out) {
      var val, threw = false, threwMsg = '';
      try { val = out.compute(v); } catch (e) { threw = true; threwMsg = e.message; }

      H.check(id + '.' + out.key + ' never throws (sweep ' + s + ')', !threw,
        'inputs ' + vLabel + ' → threw: ' + threwMsg);
      if (threw) return;

      var isBadNumber = typeof val === 'number' && !isFinite(val);
      H.check(id + '.' + out.key + ' never returns NaN/Infinity (sweep ' + s + ')', !isBadNumber,
        'inputs ' + vLabel + ' → ' + val);

      if (val !== null && val !== undefined && out.interpret) {
        var verdict, vThrew = false, vMsg = '';
        try { verdict = out.interpret(val, v); } catch (e) { vThrew = true; vMsg = e.message; }
        H.check(id + '.' + out.key + ' interpret() never throws (sweep ' + s + ')', !vThrew,
          'value ' + JSON.stringify(val) + ', inputs ' + vLabel + ' → threw: ' + vMsg);
        if (!vThrew && verdict !== null && verdict !== undefined) {
          H.check(id + '.' + out.key + ' interpret() returns a well-formed verdict (sweep ' + s + ')',
            typeof verdict === 'object' && typeof verdict.tone === 'string' && typeof verdict.text === 'string',
            'got ' + JSON.stringify(verdict));
        }
      }
    });
  }
});

/* Specifically the documented empty state: with every input blank/NaN, every
   output must come back null (or a defined empty marker), never a number
   that looks like a real answer. */
H.suite('empty-input state');

H.eachCard(DATA, function (card, cat) {
  var id = cat.id + '/' + card.id;
  var v = {};
  card.inputs.forEach(function (inp) {
    v[inp.key] = inp.type === 'text' ? '' : NaN;
  });
  card.outputs.forEach(function (out) {
    var val;
    try { val = out.compute(v); } catch (e) { val = '<<threw: ' + e.message + '>>'; }
    var isEmpty = val === null || val === undefined ||
      (typeof val === 'number' && !isFinite(val) === false && false); /* placeholder, see below */
    H.check(id + '.' + out.key + ' is null with every input blank',
      val === null || val === undefined,
      'got ' + JSON.stringify(val) + ' from all-blank inputs');
  });
});

/* Division-by-zero specific probes, targeted at denominators visible in the
   formula strings — these are the classic misleading-value trap. */
H.suite('division-by-zero probes');

function probe(id, base, overrides, outKey, note) {
  var card = null, cat = null;
  H.eachCard(DATA, function (c, ct) { if (ct.id + '/' + c.id === id) { card = c; cat = ct; } });
  if (!card) { H.check(id + ' exists for probe', false, 'card not found'); return; }
  var v = {};
  card.inputs.forEach(function (inp) { v[inp.key] = base[inp.key]; });
  Object.keys(overrides).forEach(function (k) { v[k] = overrides[k]; });
  var out = null;
  card.outputs.forEach(function (o) { if (o.key === outKey) out = o; });
  if (!out) { H.check(id + '.' + outKey + ' exists for probe', false); return; }
  var val;
  try { val = out.compute(v); } catch (e) { val = '<<threw: ' + e.message + '>>'; }
  H.check(id + '.' + outKey + ' handles ' + note, val === null || (typeof val !== 'number') || isFinite(val),
    'got ' + JSON.stringify(val));
}

probe('evm/earned-value', { bac: 100000, pv: 50000, ev: 45000, ac: 60000 }, { ac: 0 }, 'cpi', 'AC = 0 (CPI)');
probe('evm/earned-value', { bac: 100000, pv: 50000, ev: 45000, ac: 60000 }, { pv: 0 }, 'spi', 'PV = 0 (SPI)');
probe('evm/earned-value', { bac: 100000, pv: 50000, ev: 45000, ac: 60000 }, { ev: 0 }, 'eacTypical', 'EV = 0 (EAC typical)');
probe('evm/earned-value', { bac: 100000, pv: 50000, ev: 45000, ac: 60000 }, { bac: 60000, ac: 60000 }, 'tcpiBac', 'BAC = AC (TCPI)');
probe('burn/burn-rate', { budget: 120000, spent: 45000, elapsed: 3, planLeft: 6 }, { elapsed: 0 }, 'burnRate', 'elapsed = 0');
probe('quality/dpmo', { defects: 25, units: 1000, opps: 4 }, { units: 0 }, 'dpmo', 'units = 0');
probe('quality/cpk', { usl: 10, lsl: 4, mean: 6, sigma: 0.5 }, { sigma: 0 }, 'cpk', 'sigma = 0');
probe('financial/breakeven', { fixed: 50000, price: 25, varCost: 15 }, { varCost: 25 }, 'units', 'price = variable cost');
probe('financial/roi', { cost: 200000, benefit: 260000 }, { cost: 0 }, 'roi', 'cost = 0');
probe('resources/fte', { effort: 2080, hoursPer: 130, periods: 4 }, { hoursPer: 0 }, 'fte', 'hoursPer = 0');
probe('resources/utilization', { allocated: 150, available: 160 }, { available: 0 }, 'util', 'available = 0');
probe('flow/littles-law', { wip: 12, throughput: 3, workTime: 0.5 }, { throughput: 0 }, 'cycleTime', 'throughput = 0');
probe('agile/velocity', { points: 120, sprints: 4, backlog: 200, weeks: 2 }, { sprints: 0 }, 'velocity', 'sprints = 0');
probe('compression/crash', { normalCost: 10000, crashCost: 16000, normalDur: 10, crashDur: 10 }, {}, 'slope', 'normalDur = crashDur');

H.report('Edge cases + empty state + division guards');
