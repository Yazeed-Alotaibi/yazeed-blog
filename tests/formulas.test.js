/* Numeric correctness of every calculator on the Calculation Desk.

   Expected values here are derived by hand from the standard PMBOK / PMP-exam
   formulas, not copied from the page's own output — a test that just records
   what the code currently does would happily lock in a wrong formula. Where a
   textbook worked example exists (3-4-5 path sigma, 4σ ≈ 6,210 DPMO, a 500×3
   annuity on 1,000 → IRR ≈ 23.4%) the numbers are chosen to match it. */

'use strict';

var test = require('node:test');
var assert = require('node:assert');
var pm = require('./load-data.js');

var compute = pm.compute;
var verdict = pm.verdict;

/* Floats: compare to a tolerance rather than exactly. */
function close(actual, expected, tol, msg) {
  tol = tol === undefined ? 1e-9 : tol;
  assert.ok(
    typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= tol,
    (msg || 'value') + ': expected ≈' + expected + ', got ' + actual
  );
}

/* ------------------------------------------------------------------- EVM */

test('EVM — core metrics on an over-budget, behind-schedule project', function () {
  var r = compute('earned-value', { bac: 100000, pv: 50000, ev: 45000, ac: 60000 });

  close(r.cv, -15000, 1e-9, 'CV = EV − AC');
  close(r.sv, -5000, 1e-9, 'SV = EV − PV');
  close(r.cpi, 0.75, 1e-9, 'CPI = EV ÷ AC');
  close(r.spi, 0.9, 1e-9, 'SPI = EV ÷ PV');
  close(r.csi, 0.675, 1e-9, 'CSI = CPI × SPI');
  close(r.pctComplete, 45, 1e-9, '% complete = EV ÷ BAC');
  close(r.pctSpent, 60, 1e-9, '% spent = AC ÷ BAC');
});

test('EVM — forecasting metrics', function () {
  var r = compute('earned-value', { bac: 100000, pv: 50000, ev: 45000, ac: 60000 });

  close(r.eacTypical, 100000 / 0.75, 1e-6, 'EAC typical = BAC ÷ CPI');
  close(r.eacAtypical, 115000, 1e-9, 'EAC atypical = AC + (BAC − EV)');
  close(r.eacBoth, 60000 + 55000 / 0.675, 1e-6, 'EAC both = AC + (BAC − EV) ÷ (CPI × SPI)');
  close(r.etc, 100000 / 0.75 - 60000, 1e-6, 'ETC = EAC − AC');
  close(r.vac, 100000 - 100000 / 0.75, 1e-6, 'VAC = BAC − EAC');
  close(r.tcpiBac, 55000 / 40000, 1e-9, 'TCPI(BAC) = (BAC − EV) ÷ (BAC − AC)');
  close(r.tcpiEac, 55000 / (100000 / 0.75 - 60000), 1e-9, 'TCPI(EAC) = (BAC − EV) ÷ (EAC − AC)');
});

test('EVM — a perfectly on-plan project reads as neutral', function () {
  var r = compute('earned-value', { bac: 100, pv: 50, ev: 50, ac: 50 });

  close(r.cv, 0, 1e-9, 'CV');
  close(r.sv, 0, 1e-9, 'SV');
  close(r.cpi, 1, 1e-9, 'CPI');
  close(r.spi, 1, 1e-9, 'SPI');
  close(r.eacTypical, 100, 1e-9, 'EAC equals BAC when CPI is 1');
  close(r.vac, 0, 1e-9, 'VAC');
});

test('EVM — CV sign drives the verdict tone', function () {
  assert.strictEqual(verdict('earned-value', 'cv', { bac: 100, pv: 50, ev: 60, ac: 50 }).tone, 'good');
  assert.strictEqual(verdict('earned-value', 'cv', { bac: 100, pv: 50, ev: 40, ac: 50 }).tone, 'bad');
  assert.strictEqual(verdict('earned-value', 'cv', { bac: 100, pv: 50, ev: 50, ac: 50 }).tone, 'info');
});

test('EVM — a zero actual cost does not produce Infinity', function () {
  var r = compute('earned-value', { bac: 100000, pv: 50000, ev: 45000, ac: 0 });
  assert.strictEqual(r.cpi, null, 'CPI must be null, not Infinity, when AC is 0');
});

test('time forecasting — duration stretches by 1 ÷ SPI', function () {
  var r = compute('time-forecast', { plannedDur: 12, ev: 45000, pv: 50000 });
  close(r.spi, 0.9, 1e-9, 'SPI');
  close(r.forecastDur, 12 / 0.9, 1e-9, 'forecast duration = planned ÷ SPI');
  close(r.delay, 12 / 0.9 - 12, 1e-9, 'delay = forecast − planned');
});

/* ------------------------------------------------------------ burn rate */

test('burn rate — spend pace, runway and consumption', function () {
  var r = compute('burn-rate', { budget: 120000, spent: 60000, elapsed: 6, planLeft: 6 });
  close(r.burnRate, 10000, 1e-9, 'burn = spent ÷ elapsed');
  close(r.remaining, 60000, 1e-9, 'remaining = budget − spent');
  close(r.runway, 6, 1e-9, 'runway = remaining ÷ burn');
  close(r.pctUsed, 50, 1e-9, '% of budget used');
});

/* ----------------------------------------------------------- estimation */

test('PERT — weighted mean, spread and confidence ranges', function () {
  var r = compute('three-point', { o: 4, m: 6, p: 14 });

  close(r.tri, 8, 1e-9, 'triangular = (O + M + P) ÷ 3');
  close(r.pert, 7, 1e-9, 'PERT = (O + 4M + P) ÷ 6');
  close(r.sd, 10 / 6, 1e-9, 'σ = (P − O) ÷ 6');
  close(r.variance, Math.pow(10 / 6, 2), 1e-9, 'variance = σ²');

  /* Ranges are display strings: PERT ± 1σ / 2σ / 3σ. */
  assert.strictEqual(r.r68, '5.33 – 8.67', '68% range = PERT ± 1σ');
  assert.strictEqual(r.r95, '3.67 – 10.33', '95% range = PERT ± 2σ');
  assert.strictEqual(r.r997, '2 – 12', '99.7% range = PERT ± 3σ');
});

test('PERT — a certain estimate has zero spread', function () {
  var r = compute('three-point', { o: 5, m: 5, p: 5 });
  close(r.pert, 5, 1e-9, 'PERT');
  close(r.sd, 0, 1e-9, 'σ is 0 when O = M = P');
  close(r.variance, 0, 1e-9, 'variance');
});

test('path sigma — variances add, standard deviations do not', function () {
  /* The 3-4-5 case: √(3² + 4²) = 5, well below the naive 3 + 4 = 7. */
  var r = compute('path-sigma', { sigmas: '3, 4' });
  close(r.pathSigma, 5, 1e-9, 'σ(path) = √Σσ²');
  close(r.naiveSum, 7, 1e-9, 'naive sum of σ, shown for contrast');
  assert.ok(r.pathSigma < r.naiveSum, 'roll-up must be smaller than the naive sum');
});

test('path sigma — accepts commas, semicolons and bare spaces', function () {
  ['3, 4', '3;4', '3 4', ' 3 , 4 '].forEach(function (s) {
    close(compute('path-sigma', { sigmas: s }).pathSigma, 5, 1e-9, 'parsed "' + s + '"');
  });
});

test('path sigma — rejects non-numeric input instead of guessing', function () {
  assert.strictEqual(compute('path-sigma', { sigmas: 'abc' }).pathSigma, null);
  assert.strictEqual(compute('path-sigma', { sigmas: '' }).pathSigma, null);
});

test('learning curve — an 80% curve halves-and-halves correctly', function () {
  /* Doubling the unit count multiplies time by the learning rate. */
  close(compute('learning-curve', { t1: 100, rate: 80, n: 2 }).tn, 80, 1e-9, 'unit 2');
  close(compute('learning-curve', { t1: 100, rate: 80, n: 4 }).tn, 64, 1e-9, 'unit 4');
  close(compute('learning-curve', { t1: 100, rate: 80, n: 8 }).tn, 51.2, 1e-9, 'unit 8');

  close(compute('learning-curve', { t1: 100, rate: 80, n: 4 }).improvement, 36, 1e-9,
    'improvement = 1 − Tn ÷ T1');
  close(compute('learning-curve', { t1: 100, rate: 80, n: 1 }).tn, 100, 1e-9,
    'unit 1 is always T1');
});

/* ------------------------------------------------------------- schedule */

test('float — total float, its cross-check, and free float', function () {
  var r = compute('float', { es: 5, ef: 10, ls: 8, lf: 13, succEs: 12 });
  close(r.tf, 3, 1e-9, 'TF = LS − ES');
  close(r.tfCheck, 3, 1e-9, 'TF = LF − EF (must agree)');
  close(r.ff, 2, 1e-9, 'FF = successor ES − EF');
  assert.strictEqual(r.tf, r.tfCheck, 'the two total-float routes must agree');
});

test('float — a critical activity has zero float', function () {
  var r = compute('float', { es: 5, ef: 10, ls: 5, lf: 10, succEs: 10 });
  close(r.tf, 0, 1e-9, 'TF');
  close(r.ff, 0, 1e-9, 'FF');
});

test('crash — cost slope is cost per period saved', function () {
  var r = compute('crash', { normalCost: 1000, crashCost: 1400, normalDur: 10, crashDur: 8 });
  close(r.slope, 200, 1e-9, 'slope = Δcost ÷ Δduration');
  close(r.maxSaving, 2, 1e-9, 'max time saving');
  close(r.premium, 400, 1e-9, 'total premium');
});

test('crash — no compressible time means no slope, not a divide-by-zero', function () {
  var r = compute('crash', { normalCost: 1000, crashCost: 1400, normalDur: 8, crashDur: 8 });
  assert.strictEqual(r.slope, null, 'slope must be null when duration cannot be reduced');
});

/* ------------------------------------------------------------ resources */

test('FTE — fractional demand rounds up to whole people', function () {
  var r = compute('fte', { effort: 1000, hoursPer: 40, periods: 10 });
  close(r.fte, 2.5, 1e-9, 'FTE = effort ÷ (hours × periods)');
  assert.strictEqual(r.headcount, 3, 'headcount rounds 2.5 FTE up to 3 people');
});

test('utilization — allocated against available', function () {
  var r = compute('utilization', { allocated: 32, available: 40 });
  close(r.util, 80, 1e-9, 'utilization %');
  close(r.slack, 8, 1e-9, 'unallocated hours');
});

test('utilization — over-allocation is flagged, not silently accepted', function () {
  var r = compute('utilization', { allocated: 48, available: 40 });
  close(r.util, 120, 1e-9, 'utilization can exceed 100%');
  assert.strictEqual(verdict('utilization', 'util', { allocated: 48, available: 40 }).tone, 'bad');
});

test('loaded labor cost — overhead multiplies the base', function () {
  var r = compute('labor-cost', { hours: 100, rate: 50, overhead: 30 });
  close(r.base, 5000, 1e-9, 'base = hours × rate');
  close(r.loaded, 6500, 1e-9, 'loaded = base × (1 + overhead)');
  close(r.loadedRate, 65, 1e-9, 'effective hourly rate');
});

/* --------------------------------------------------------- communication */

test('communication channels — n(n−1)/2, and the cost of one more person', function () {
  close(compute('channels', { n: 10, n2: 12 }).ch, 45, 1e-9, '10 people → 45 channels');
  close(compute('channels', { n: 10, n2: 12 }).ch2, 66, 1e-9, '12 people → 66 channels');
  close(compute('channels', { n: 10, n2: 12 }).delta, 21, 1e-9, 'added channels');
  close(compute('channels', { n: 1 }).ch, 0, 1e-9, 'one person has no channels');
  close(compute('channels', { n: 2 }).ch, 1, 1e-9, 'two people have one channel');
});

/* ------------------------------------------------------------------ risk */

test('EMV — probability-weighted impact', function () {
  var r = compute('emv', { p: 30, impact: -50000 });
  close(r.emv, -15000, 1e-9, 'EMV = P × impact');
  close(r.residual, -50000, 1e-9, 'full impact is shown as a reminder, unweighted');

  close(compute('emv', { p: 25, impact: 40000 }).emv, 10000, 1e-9, 'opportunities are positive');
  close(compute('emv', { p: 0, impact: -50000 }).emv, 0, 1e-9, 'zero probability, zero EMV');
  close(compute('emv', { p: 100, impact: -50000 }).emv, -50000, 1e-9, 'certainty is the full impact');
});

test('EMV — threats read bad, opportunities read good', function () {
  assert.strictEqual(verdict('emv', 'emv', { p: 30, impact: -50000 }).tone, 'bad');
  assert.strictEqual(verdict('emv', 'emv', { p: 30, impact: 50000 }).tone, 'good');
});

test('qualitative risk score — probability × impact on the 1–5 grid', function () {
  close(compute('risk-score', { p: 4, i: 5 }).score, 20, 1e-9, 'high/high');
  close(compute('risk-score', { p: 1, i: 1 }).score, 1, 1e-9, 'low/low');
});

test('contingency reserve — sums EMV across the whole risk register', function () {
  /* 30%×−50k + 10%×−20k + 50%×+10k = −15k − 2k + 5k = −12k net exposure. */
  var r = compute('contingency', { probs: '30, 10, 50', impacts: '-50000, -20000, 10000' });
  close(r.netEmv, -12000, 1e-9, 'net EMV across the register');
  close(r.reserve, 12000, 1e-9, 'reserve is the funded positive of a net threat');
});

test('contingency reserve — mismatched list lengths are rejected', function () {
  var r = compute('contingency', { probs: '30, 10, 50', impacts: '-50000, -20000' });
  assert.strictEqual(r.netEmv, null, 'three probabilities against two impacts is ambiguous');
});

/* -------------------------------------------------------------- decision */

test('decision tree — EMV of each branch, net of its up-front cost', function () {
  var inp = {
    costA: 10000, pA: 60, winA: 50000, loseA: -5000,
    costB: 20000, pB: 80, winB: 60000, loseB: -10000
  };
  var r = compute('decision-tree', inp);

  /* A: 0.6×50k + 0.4×(−5k) − 10k = 18k.  B: 0.8×60k + 0.2×(−10k) − 20k = 26k. */
  close(r.emvA, 18000, 1e-9, 'EMV of option A');
  close(r.emvB, 26000, 1e-9, 'EMV of option B');
  assert.match(r.verdict, /Option B/, 'the higher EMV wins');
  assert.match(r.verdict, /8,000/, 'the margin is stated');
});

/* --------------------------------------------------------------- quality */

test('DPMO — normalizes defects by opportunity count', function () {
  var r = compute('dpmo', { defects: 25, units: 1000, opps: 4 });
  close(r.dpmo, 6250, 1e-9, 'DPMO = defects × 1e6 ÷ (units × opportunities)');
  close(r.yield, 99.375, 1e-9, 'yield = 1 − defect rate');
});

test('sigma level — lands on the published conversion anchors', function () {
  /* The textbook table: 6,210 DPMO ≈ 4σ and 66,807 ≈ 3σ (1.5σ shift included). */
  close(compute('dpmo', { defects: 6210, units: 1000000, opps: 1 }).sigma, 4, 0.02, '≈ 4σ');
  close(compute('dpmo', { defects: 66807, units: 1000000, opps: 1 }).sigma, 3, 0.02, '≈ 3σ');
});

test('sigma level — a defect-free sample is reported, not divided by zero', function () {
  var r = compute('dpmo', { defects: 0, units: 1000, opps: 4 });
  close(r.dpmo, 0, 1e-9, 'DPMO');
  assert.strictEqual(typeof r.sigma, 'string', 'ln(0) is guarded with an explanatory string');
  assert.match(r.sigma, /6/, 'reported as ≥ 6σ');
});

test('control limits — ±3σ band and the ±2σ warning zone', function () {
  var r = compute('control', { mean: 50, sigma: 2 });
  close(r.ucl, 56, 1e-9, 'UCL = mean + 3σ');
  close(r.lcl, 44, 1e-9, 'LCL = mean − 3σ');
  assert.strictEqual(r.warnZone, '46 – 54', 'warning zone = mean ± 2σ');
});

test('process capability — Cp ignores centring, Cpk does not', function () {
  var centred = compute('cpk', { usl: 110, lsl: 90, mean: 100, sigma: 2 });
  close(centred.cp, 20 / 12, 1e-9, 'Cp = (USL − LSL) ÷ 6σ');
  close(centred.cpk, 10 / 6, 1e-9, 'Cpk equals Cp when perfectly centred');

  var shifted = compute('cpk', { usl: 110, lsl: 90, mean: 104, sigma: 2 });
  close(shifted.cp, 20 / 12, 1e-9, 'Cp is unchanged by the shift');
  close(shifted.cpk, 1, 1e-9, 'Cpk = min(USL − μ, μ − LSL) ÷ 3σ');
  assert.ok(shifted.cpk < shifted.cp, 'an off-centre process must score lower on Cpk');
});

test('cost of quality — conformance versus failure spend', function () {
  var r = compute('coq', { prevention: 10, appraisal: 20, internal: 30, external: 40 });
  close(r.conformance, 30, 1e-9, 'prevention + appraisal');
  close(r.nonconformance, 70, 1e-9, 'internal + external failure');
  close(r.total, 100, 1e-9, 'total CoQ');
  close(r.failShare, 70, 1e-9, 'failure share of total');
});

/* ------------------------------------------------------------- financial */

test('ROI — net gain over cost', function () {
  var r = compute('roi', { cost: 1000, benefit: 1500 });
  close(r.net, 500, 1e-9, 'net benefit');
  close(r.roi, 50, 1e-9, 'ROI %');

  close(compute('roi', { cost: 1000, benefit: 800 }).roi, -20, 1e-9, 'a loss is negative');
  close(compute('roi', { cost: 1000, benefit: 1000 }).roi, 0, 1e-9, 'break-even is 0%');
});

test('NPV — discounts each period’s flow back to today', function () {
  var r = compute('npv', { rate: 10, inv: 1000, flows: '500, 500, 500' });
  var expected = -1000 + 500 / 1.1 + 500 / Math.pow(1.1, 2) + 500 / Math.pow(1.1, 3);
  close(r.npv, expected, 1e-9, 'NPV');
  close(r.npv, 243.43, 0.01, 'NPV ≈ 243.43');
  close(r.bcr, (expected + 1000) / 1000, 1e-9, 'BCR = PV of inflows ÷ investment');
});

test('NPV — a zero discount rate is just the undiscounted sum', function () {
  var r = compute('npv', { rate: 0, inv: 1000, flows: '500, 500, 500' });
  close(r.npv, 500, 1e-9, '1,500 in, 1,000 out');
});

test('IRR — the rate at which NPV crosses zero', function () {
  /* A 3-period 500 annuity against 1,000 solves to ≈ 23.375%. */
  var r = compute('npv', { rate: 10, inv: 1000, flows: '500, 500, 500' });
  close(r.irr, 23.375, 0.01, 'IRR %');

  /* Cross-check: discounting at the IRR must zero out the NPV. */
  var atIrr = compute('npv', { rate: r.irr, inv: 1000, flows: '500, 500, 500' });
  close(atIrr.npv, 0, 1e-6, 'NPV at the IRR');
});

test('IRR — a project that loses money still has a (negative) IRR', function () {
  /* 200 back on 1,000 is a real, badly negative return — not an undefined one.
     The solver's bracket reaches down to −99%, so it must find it rather than
     give up. */
  var r = compute('npv', { rate: 10, inv: 1000, flows: '100, 100' });
  close(r.irr, -62.98, 0.01, 'IRR %');
  assert.ok(r.irr < 0, 'a loss-making project must report a negative IRR');
});

test('IRR — returns null when the cash flows never change sign', function () {
  /* Money only ever goes out, so no discount rate can zero the NPV. */
  var r = compute('npv', { rate: 10, inv: 1000, flows: '-100, -100' });
  assert.strictEqual(r.irr, null, 'an all-outflow project has no IRR to find');
});

test('payback — the period the investment is recovered', function () {
  assert.match(compute('npv', { rate: 10, inv: 1000, flows: '500, 500, 500' }).payback, /2/,
    '1,000 recovered after two 500 flows');
  assert.match(compute('npv', { rate: 10, inv: 1000, flows: '100, 100' }).payback, /Not recovered/,
    'an unrecovered investment says so rather than reporting a period');
});

test('time value of money — FV, PV and the rule of 72', function () {
  var r = compute('tvm', { amount: 1000, rate: 10, n: 2 });
  close(r.fv, 1210, 1e-9, 'FV = amount × (1 + r)ⁿ');
  close(r.pv, 1000 / 1.21, 1e-9, 'PV = amount ÷ (1 + r)ⁿ');
  close(r.doubling, 7.2, 1e-9, 'doubling time ≈ 72 ÷ rate');
});

test('break-even — fixed cost divided by unit contribution', function () {
  var r = compute('breakeven', { fixed: 10000, price: 50, varCost: 30 });
  close(r.margin, 20, 1e-9, 'contribution margin = price − variable cost');
  close(r.units, 500, 1e-9, 'break-even units');
  close(r.revenue, 25000, 1e-9, 'break-even revenue');
});

test('break-even — selling at or below cost never breaks even', function () {
  var r = compute('breakeven', { fixed: 10000, price: 30, varCost: 30 });
  assert.strictEqual(r.units, null, 'a zero margin must not divide by zero');
});

test('straight-line depreciation — even spread of the depreciable base', function () {
  var r = compute('depreciation', { cost: 10000, salvage: 2000, life: 4 });
  close(r.annual, 2000, 1e-9, 'annual = (cost − salvage) ÷ life');
  close(r.ratePct, 25, 1e-9, 'rate = 1 ÷ life');
});

test('weighted scoring — normalized by total weight', function () {
  /* (5×8 + 3×6 + 2×9) = 76 raw, ÷ 10 total weight = 7.6. */
  var r = compute('scoring', { weights: '5, 3, 2', scores: '8, 6, 9' });
  close(r.weighted, 7.6, 1e-9, 'weighted score');
  close(r.raw, 76, 1e-9, 'raw Σ(weight × score)');
});

test('weighted scoring — mismatched list lengths are rejected', function () {
  assert.strictEqual(compute('scoring', { weights: '5, 3, 2', scores: '8, 6' }).weighted, null);
});

/* ----------------------------------------------------------- procurement */

test('PTA — where the buyer stops sharing the overrun', function () {
  var r = compute('pta', {
    ceiling: 140000, targetPrice: 130000, targetCost: 110000, buyerShare: 80
  });
  /* PTA = (ceiling − target price) ÷ buyer share + target cost. */
  close(r.pta, 122500, 1e-9, 'PTA');
  close(r.headroom, 12500, 1e-9, 'cost headroom above target before the PTA bites');
});

test('FPIF — seller keeps its share of an underrun', function () {
  var r = compute('fpif', {
    targetCost: 150000, targetFee: 15000, actualCost: 140000, sellerShare: 20, ceiling: 180000
  });
  close(r.finalFee, 17000, 1e-9, 'fee = target fee + underrun × seller share');
  close(r.finalPrice, 157000, 1e-9, 'price = actual cost + fee');
  assert.strictEqual(verdict('fpif', 'finalFee', {
    targetCost: 150000, targetFee: 15000, actualCost: 140000, sellerShare: 20, ceiling: 180000
  }).tone, 'good');
});

test('FPIF — the ceiling price caps what the buyer pays', function () {
  var inp = {
    targetCost: 150000, targetFee: 15000, actualCost: 200000, sellerShare: 20, ceiling: 180000
  };
  var r = compute('fpif', inp);
  close(r.finalFee, 5000, 1e-9, 'overrun erodes the fee');
  close(r.finalPrice, 180000, 1e-9, 'price is clamped to the ceiling');
  assert.strictEqual(verdict('fpif', 'finalPrice', inp).tone, 'warn', 'hitting the ceiling warns');
});

test('CPIF — fee moves with performance inside its band', function () {
  var r = compute('cpif', {
    targetCost: 100000, targetFee: 10000, actualCost: 90000,
    sellerShare: 20, minFee: 4000, maxFee: 15000
  });
  close(r.fee, 12000, 1e-9, 'fee = 10,000 + 10,000 × 20%');
  close(r.price, 102000, 1e-9, 'price = actual cost + fee');
});

test('CPIF — the fee is clamped at both ends of the band', function () {
  var band = { targetCost: 100000, targetFee: 10000, sellerShare: 20, minFee: 4000, maxFee: 15000 };

  var big = Object.assign({}, band, { actualCost: 60000 });
  close(compute('cpif', big).fee, 15000, 1e-9, 'a large underrun is capped at the maximum fee');
  close(compute('cpif', big).price, 75000, 1e-9, 'price uses the capped fee');
  assert.strictEqual(verdict('cpif', 'fee', big).tone, 'warn', 'hitting the cap warns');

  var bad = Object.assign({}, band, { actualCost: 150000 });
  close(compute('cpif', bad).fee, 4000, 1e-9, 'a large overrun is floored at the minimum fee');
  close(compute('cpif', bad).price, 154000, 1e-9, 'the buyer still reimburses the full cost');
  assert.strictEqual(verdict('cpif', 'fee', bad).tone, 'warn', 'hitting the floor warns');
});

/* ----------------------------------------------------------------- agile */

test('velocity — average throughput and the release forecast', function () {
  var r = compute('velocity', { points: 100, sprints: 5, backlog: 120, weeks: 2 });
  close(r.velocity, 20, 1e-9, 'velocity = points ÷ sprints');
  assert.strictEqual(r.sprintsLeft, 6, 'sprints remaining rounds up a partial sprint');
  assert.match(r.weeksLeft, /12 weeks/, 'calendar time = sprints × sprint length');
});

test('velocity — a team with no recorded throughput yields no forecast', function () {
  var r = compute('velocity', { points: 0, sprints: 5, backlog: 120, weeks: 2 });
  assert.strictEqual(r.sprintsLeft, null, 'zero velocity must not forecast an infinite schedule');
});

test('sprint capacity — focus factor discounts raw availability', function () {
  var r = compute('capacity', { members: 5, days: 10, hoursPerDay: 8, focus: 70 });
  close(r.raw, 400, 1e-9, 'raw hours = members × days × hours/day');
  close(r.capacity, 280, 1e-9, 'usable hours = raw × focus factor');
});

test('say/do ratio — delivered against committed', function () {
  var r = compute('say-do', { committed: 10, delivered: 8 });
  close(r.ratio, 80, 1e-9, 'say/do %');
  close(r.gap, -2, 1e-9, 'gap = delivered − committed, so a shortfall is negative');

  var met = compute('say-do', { committed: 10, delivered: 10 });
  close(met.ratio, 100, 1e-9, 'a met commitment');
  close(met.gap, 0, 1e-9, 'no rollover');
});

test('say/do ratio — a zero commitment does not divide by zero', function () {
  assert.strictEqual(compute('say-do', { committed: 0, delivered: 5 }).ratio, null);
});

/* ------------------------------------------------------------------ flow */

test('Little’s Law — cycle time and flow efficiency', function () {
  var r = compute('littles-law', { wip: 10, throughput: 2, workTime: 1 });
  close(r.cycleTime, 5, 1e-9, 'cycle time = WIP ÷ throughput');
  close(r.flowEff, 20, 1e-9, 'flow efficiency = touch time ÷ cycle time');
});

test('Little’s Law — halving WIP halves cycle time', function () {
  var full = compute('littles-law', { wip: 10, throughput: 2, workTime: 1 });
  var half = compute('littles-law', { wip: 5, throughput: 2, workTime: 1 });
  close(half.cycleTime, full.cycleTime / 2, 1e-9, 'the core argument for WIP limits');
});

test('Little’s Law — zero throughput does not divide by zero', function () {
  assert.strictEqual(compute('littles-law', { wip: 10, throughput: 0, workTime: 1 }).cycleTime, null);
});
