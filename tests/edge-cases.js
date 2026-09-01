/* Deliberate edge classes.

   Each input class is exercised once instead of rotating through overlapping
   value tables. Every output still has the same absolute bar: no throw, no
   NaN/Infinity, and every returned verdict is well formed. */

'use strict';

var H = require('./harness');
var TITLE = 'Edge cases + empty state + division guards';

var DIVISOR_CASES = {
  'evm/earned-value': [
    ['AC = 0', function (v) { v.ac = 0; }],
    ['PV = 0', function (v) { v.pv = 0; }],
    ['EV = 0', function (v) { v.ev = 0; }],
    ['BAC = 0', function (v) { v.bac = 0; }],
    ['BAC - AC = 0', function (v) { v.ac = v.bac; }]
  ],
  'evm/time-forecast': [
    ['PV = 0', function (v) { v.pv = 0; }],
    ['EV = 0', function (v) { v.ev = 0; }]
  ],
  'evm/earned-schedule': [
    ['BAC = 0', function (v) { v.bac = 0; }],
    ['AT = 0', function (v) { v.at = 0; }],
    ['EV = 0', function (v) { v.ev = 0; }]
  ],
  'burn/burn-rate': [
    ['elapsed = 0', function (v) { v.elapsed = 0; }],
    ['spent = 0', function (v) { v.spent = 0; }],
    ['budget = 0', function (v) { v.budget = 0; }]
  ],
  'compression/crash': [
    ['normal duration = crash duration', function (v) { v.crashDur = v.normalDur; }]
  ],
  'resources/fte': [
    ['hours per period = 0', function (v) { v.hoursPer = 0; }],
    ['periods = 0', function (v) { v.periods = 0; }]
  ],
  'resources/utilization': [
    ['available = 0', function (v) { v.available = 0; }]
  ],
  'quality/dpmo': [
    ['units = 0', function (v) { v.units = 0; }],
    ['opportunities = 0', function (v) { v.opps = 0; }]
  ],
  'quality/cpk': [
    ['sigma = 0', function (v) { v.sigma = 0; }]
  ],
  'quality/coq': [
    ['total spend = 0', function (v) {
      v.prevention = 0; v.appraisal = 0; v.internal = 0; v.external = 0;
    }]
  ],
  'financial/roi': [
    ['cost = 0', function (v) { v.cost = 0; }]
  ],
  'financial/npv': [
    ['investment = 0', function (v) { v.inv = 0; }],
    ['rate = -100', function (v) { v.rate = -100; }]
  ],
  'financial/tvm': [
    ['rate = -100', function (v) { v.rate = -100; }],
    ['rate = 0', function (v) { v.rate = 0; }]
  ],
  'financial/breakeven': [
    ['price = variable cost', function (v) { v.varCost = v.price; }]
  ],
  'financial/depreciation': [
    ['life = 0', function (v) { v.life = 0; }]
  ],
  'financial/scoring': [
    ['weight sum = 0', function (v) { v.weights = '0,0,0'; }]
  ],
  'procurement/pta': [
    ['buyer share = 0', function (v) { v.buyerShare = 0; }]
  ],
  'agile/velocity': [
    ['sprints = 0', function (v) { v.sprints = 0; }],
    ['points = 0', function (v) { v.points = 0; }]
  ],
  'agile/say-do': [
    ['committed = 0', function (v) { v.committed = 0; }]
  ],
  'flow/littles-law': [
    ['throughput = 0', function (v) { v.throughput = 0; }],
    ['WIP = 0', function (v) { v.wip = 0; }]
  ]
};

function valuesFor(card, numberValue, textValue) {
  var v = {};
  H.each(card.inputs, function (inp) {
    v[inp.key] = inp.type === 'text' ? textValue : numberValue;
  });
  return v;
}

function verifyOutput(page, id, caseLabel, out, v) {
  var val;
  var verdict;
  var problem = '';

  try {
    val = H.invoke(page, out.compute, [v]);
  } catch (e) {
    problem = 'threw: ' + e.message;
  }

  if (!problem && typeof val === 'number' && !isFinite(val)) {
    problem = 'returned ' + String(val);
  }

  if (!problem && val !== null && val !== undefined && out.interpret) {
    try {
      verdict = H.invoke(page, out.interpret, [val, v]);
    } catch (e) {
      problem = 'interpret() threw: ' + e.message;
    }
    if (!problem && verdict !== null && verdict !== undefined &&
        !(typeof verdict === 'object' &&
          typeof verdict.tone === 'string' &&
          typeof verdict.text === 'string')) {
      problem = 'malformed verdict ' + JSON.stringify(verdict);
    }
  }

  H.check(id + '.' + out.key + ' handles ' + caseLabel, !problem,
    'inputs ' + JSON.stringify(v) + ' -> ' + problem);
}

function exercise(page, data, suiteName, casesForCard) {
  H.suite(suiteName);
  H.eachCard(data, function (card, cat) {
    var id = cat.id + '/' + card.id;
    casesForCard(card, id).forEach(function (testCase) {
      H.each(card.outputs, function (out) {
        verifyOutput(page, id, testCase.label, out, testCase.values);
      });
    });
  });
}

function run(page) {
  var data = page.sandbox.PM_DATA;

  exercise(page, data, 'all inputs zero', function (card) {
    return [{ label: 'all inputs zero', values: valuesFor(card, 0, '0') }];
  });

  exercise(page, data, 'huge inputs', function (card) {
    return [{ label: 'huge inputs', values: valuesFor(card, 1e15, '1e15,1e15') }];
  });

  exercise(page, data, 'tiny inputs', function (card) {
    return [{ label: 'tiny inputs', values: valuesFor(card, 1e-9, '1e-9,1e-9') }];
  });

  exercise(page, data, 'each input empty', function (card) {
    return H.map(card.inputs, function (inp) {
      var v = H.exampleValues(card);
      v[inp.key] = inp.type === 'text' ? '' : NaN;
      return { label: inp.key + ' empty', values: v };
    });
  });

  exercise(page, data, 'each input malformed', function (card) {
    return H.map(card.inputs, function (inp) {
      var v = H.exampleValues(card);
      v[inp.key] = 'abc';
      return { label: inp.key + ' malformed', values: v };
    });
  });

  exercise(page, data, 'each numeric input negative', function (card) {
    return H.map(H.filter(card.inputs, function (inp) {
      return inp.type !== 'text';
    }), function (inp) {
      var v = H.exampleValues(card);
      var n = Math.abs(Number(v[inp.key]));
      v[inp.key] = -(isFinite(n) && n > 0 ? n : 1);
      return { label: inp.key + ' negative', values: v };
    });
  });

  exercise(page, data, 'division guards', function (card, id) {
    var definitions = DIVISOR_CASES[id] || [];
    return definitions.map(function (definition) {
      var v = H.exampleValues(card);
      definition[1](v);
      return { label: definition[0], values: v };
    });
  });

  H.suite('empty-input state');
  H.eachCard(data, function (card, cat) {
    var id = cat.id + '/' + card.id;
    var v = valuesFor(card, NaN, '');
    H.each(card.outputs, function (out) {
      var val;
      var problem = '';
      try { val = H.invoke(page, out.compute, [v]); }
      catch (e) { problem = 'threw: ' + e.message; }
      if (!problem && val !== null && val !== undefined) {
        problem = 'returned ' + JSON.stringify(val);
      }
      H.check(id + '.' + out.key + ' is empty with every input blank', !problem,
        'inputs ' + JSON.stringify(v) + ' -> ' + problem);
    });
  });
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  run(H.loadPage('index.html'));
  H.report(TITLE);
}
