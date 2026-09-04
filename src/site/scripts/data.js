
/* PM Calculation Desk — calculator definitions.
   Each calculator carries its own teaching material: `about` (what it is and
   why it exists), `formula` lines, per-input `meaning`, and per-output
   `meaning` plus an `interpret` function that tells the reader how to act on
   the number. Values arrive in `v` keyed by input key; text inputs arrive as
   raw strings. Compute functions return a number, a display string, or null
   when the inputs are insufficient. */

var PM_DATA = (function () {
  'use strict';

  function ok() {
    for (var i = 0; i < arguments.length; i++) {
      if (!Number.isFinite(arguments[i])) return false;
    }
    return true;
  }

  function f2(n) {
    if (!Number.isFinite(n)) return '—';
    return Number(n.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function parseFlows(s) {
    if (typeof s !== 'string' || !s.trim()) return null;
    var parts = s.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (!parts.length) return null;
    for (var i = 0; i < parts.length; i++) {
      if (!Number.isFinite(parts[i])) return null;
    }
    return parts;
  }

  function npvOf(rate, inv, flows) {
    /* A rate at or below −100% discounts every future flow to infinity —
       not a real cost of capital, just a division by zero in disguise. */
    if (rate <= -1) return null;
    var v = -inv;
    for (var t = 0; t < flows.length; t++) {
      v += flows[t] / Math.pow(1 + rate, t + 1);
    }
    return Number.isFinite(v) ? v : null;
  }

  function irrOf(inv, flows) {
    var lo = -0.99, hi = 10;
    var flo = npvOf(lo, inv, flows);
    var fhi = npvOf(hi, inv, flows);
    if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
    for (var i = 0; i < 200; i++) {
      var mid = (lo + hi) / 2;
      var fm = npvOf(mid, inv, flows);
      if (flo * fm <= 0) { hi = mid; } else { lo = mid; flo = fm; }
    }
    return ((lo + hi) / 2) * 100;
  }

  var good = function (t) { return { tone: 'good', text: t }; };
  var warn = function (t) { return { tone: 'warn', text: t }; };
  var bad = function (t) { return { tone: 'bad', text: t }; };
  var info = function (t) { return { tone: 'info', text: t }; };

  var categories = [

    /* ------------------------------------------------------------ EVM */
    {
      id: 'evm',
      name: 'Earned Value Management',
      blurb: 'One integrated system that answers three questions at once: are we on budget, are we on schedule, and where will we land at completion? It works by comparing what you planned to spend, what you actually spent, and the value of the work actually finished.',
      citation: 'EVM — PMI Practice Standard; Lipke, “Schedule is Different.”',
      cards: [
        {
          id: 'earned-value',
          name: 'Earned value core & forecasting',
          tagline: 'CV · SV · CPI · SPI · EAC · ETC · VAC · TCPI',
          page: 'earned-value-analysis.html',
          about: 'Enter the four base measures below and every earned-value metric updates live. The performance metrics describe project health today; the forecasting metrics project that health forward to completion. All monetary figures share whatever currency you enter.',
          formula: [
            'CV  = EV − AC        SV  = EV − PV',
            'CPI = EV ÷ AC        SPI = EV ÷ PV',
            'EAC = BAC ÷ CPI      ETC = EAC − AC',
            'VAC = BAC − EAC',
            'TCPI = (BAC − EV) ÷ (BAC − AC)'
          ],
          inputs: [
            { key: 'bac', label: 'BAC — Budget at Completion', meaning: 'The total approved budget for all project work. The baseline everything else is measured against.', placeholder: 'e.g. 100000' },
            { key: 'pv', label: 'PV — Planned Value', meaning: 'The budgeted cost of the work that was scheduled to be done by now (also called BCWS).', placeholder: 'e.g. 50000' },
            { key: 'ev', label: 'EV — Earned Value', meaning: 'The budgeted cost of the work actually completed so far: % complete × BAC (also called BCWP).', placeholder: 'e.g. 45000' },
            { key: 'ac', label: 'AC — Actual Cost', meaning: 'What the completed work really cost, regardless of what was budgeted (also called ACWP).', placeholder: 'e.g. 60000' },
            { key: 'eacMgmt', label: 'EAC — management forecast (optional)', meaning: 'A forecast you have committed to, if it differs from BAC ÷ CPI. Only TCPI — to hit EAC uses it; leave blank to read that line against the calculated EAC.', placeholder: 'e.g. 125000' }
          ],
          outputs: [
            {
              group: 'Performance today',
              key: 'cv', label: 'Cost Variance (CV)', format: 'money',
              meaning: 'Budget health in currency: value earned minus money spent.',
              compute: function (v) { return ok(v.ev, v.ac) ? v.ev - v.ac : null; },
              interpret: function (x) { return x > 0 ? good('The work performed cost less than its budgeted value.') : x < 0 ? bad('The work performed cost more than its budgeted value, by this amount.') : info('The work performed cost exactly its budgeted value.'); }
            },
            {
              group: 'Performance today',
              key: 'sv', label: 'Schedule Variance (SV)', format: 'money',
              meaning: 'Schedule health expressed in currency: work done minus work planned.',
              compute: function (v) { return ok(v.ev, v.pv) ? v.ev - v.pv : null; },
              interpret: function (x) { return x > 0 ? good('Ahead of schedule.') : x < 0 ? bad('Behind schedule.') : info('Exactly on schedule.'); }
            },
            {
              group: 'Performance today',
              key: 'cpi', label: 'Cost Performance Index (CPI)', format: 'ratio',
              meaning: 'Cost efficiency: value earned per unit of money spent.',
              compute: function (v) { return ok(v.ev, v.ac) && v.ac !== 0 ? v.ev / v.ac : null; },
              interpret: function (x) { return x > 1 ? good('Each 1.00 spent earns ' + f2(x) + ' of value.') : x < 1 ? bad('Each 1.00 spent earns only ' + f2(x) + ' of value.') : info('Spending exactly as planned.'); }
            },
            {
              group: 'Performance today',
              key: 'spi', label: 'Schedule Performance Index (SPI)', format: 'ratio',
              meaning: 'Schedule efficiency: rate of progress versus the plan.',
              compute: function (v) { return ok(v.ev, v.pv) && v.pv !== 0 ? v.ev / v.pv : null; },
              interpret: function (x) { return x > 1 ? good('Progressing faster than planned.') : x < 1 ? bad('Progressing at ' + f2(x * 100) + '% of the planned rate.') : info('Exactly on pace.'); }
            },
            {
              group: 'Performance today',
              key: 'csi', label: 'Cost–Schedule Index (CSI)', format: 'ratio',
              meaning: 'CPI × SPI — a single overall-health number; hard to recover once it drops far below 1.',
              compute: function (v) { return ok(v.ev, v.pv, v.ac) && v.ac !== 0 && v.pv !== 0 ? (v.ev / v.ac) * (v.ev / v.pv) : null; },
              interpret: function (x) { return x >= 1 ? good('Healthy overall.') : x >= 0.9 ? warn('Slipping — watch closely.') : bad('Past roughly 20% complete, recovery from here is rare without intervention. Early in a project this reading is still noisy.'); }
            },
            {
              group: 'Performance today',
              key: 'pctComplete', label: '% Complete', format: 'pct',
              meaning: 'Share of the total scope actually finished: EV ÷ BAC.',
              compute: function (v) { return ok(v.ev, v.bac) && v.bac !== 0 ? (v.ev / v.bac) * 100 : null; },
              interpret: function (x, v) { return ok(v.ac, v.bac) && v.bac !== 0 && (v.ac / v.bac) * 100 > x ? warn('You have spent a larger share of budget than of scope.') : info('Compare with % Spent to gauge burn.'); }
            },
            {
              group: 'Performance today',
              key: 'pctSpent', label: '% Spent', format: 'pct',
              meaning: 'Share of the total budget already consumed: AC ÷ BAC.',
              compute: function (v) { return ok(v.ac, v.bac) && v.bac !== 0 ? (v.ac / v.bac) * 100 : null; },
              interpret: function () { return info('Read alongside % Complete.'); }
            },
            {
              group: 'Forecasting completion',
              key: 'eacTypical', label: 'EAC — typical variance', format: 'money',
              meaning: 'BAC ÷ CPI. Forecast final cost assuming today’s cost efficiency continues — the default assumption.',
              compute: function (v) { return ok(v.bac, v.ev, v.ac) && v.ev !== 0 ? v.bac / (v.ev / v.ac) : null; },
              interpret: function (x, v) { return ok(v.bac) ? (x <= v.bac ? good('Forecast at or under budget.') : bad('Forecast overrun of ' + f2(x - v.bac) + '.')) : null; }
            },
            {
              group: 'Forecasting completion',
              key: 'eacAtypical', label: 'EAC — atypical variance', format: 'money',
              meaning: 'AC + (BAC − EV). Use when the variance was a one-off and the remaining work will go to plan.',
              compute: function (v) { return ok(v.bac, v.ev, v.ac) ? v.ac + (v.bac - v.ev) : null; },
              interpret: function (x, v) { return ok(v.bac) ? (x <= v.bac ? good('Forecast at or under budget.') : bad('Forecast overrun of ' + f2(x - v.bac) + '.')) : null; }
            },
            {
              group: 'Forecasting completion',
              key: 'eacBoth', label: 'EAC — cost & schedule', format: 'money',
              meaning: 'AC + (BAC − EV) ÷ (CPI × SPI). Use when schedule pressure is also driving cost (e.g. a hard deadline).',
              compute: function (v) {
                if (!ok(v.bac, v.pv, v.ev, v.ac) || v.ac === 0 || v.pv === 0 || v.ev === 0) return null;
                return v.ac + (v.bac - v.ev) / ((v.ev / v.ac) * (v.ev / v.pv));
              },
              interpret: function (x, v) { return ok(v.bac) ? (x <= v.bac ? good('Forecast at or under budget.') : bad('Forecast overrun of ' + f2(x - v.bac) + '.')) : null; }
            },
            {
              group: 'Forecasting completion',
              key: 'etc', label: 'ETC — Estimate to Complete', format: 'money',
              meaning: 'EAC − AC (using the typical-variance EAC). Money still needed to finish the remaining work.',
              compute: function (v) { return ok(v.bac, v.ev, v.ac) && v.ev !== 0 ? v.bac / (v.ev / v.ac) - v.ac : null; },
              interpret: function () { return info('The funding request for the remainder of the project.'); }
            },
            {
              group: 'Forecasting completion',
              key: 'vac', label: 'VAC — Variance at Completion', format: 'money',
              meaning: 'BAC − EAC (using the typical-variance EAC, BAC ÷ CPI). The over- or under-run expected on the day the project finishes.',
              compute: function (v) { return ok(v.bac, v.ev, v.ac) && v.ev !== 0 ? v.bac - v.bac / (v.ev / v.ac) : null; },
              interpret: function (x) { return x >= 0 ? good('Expected to finish under or on budget.') : bad('Expected to finish over budget by this amount.'); }
            },
            {
              group: 'Forecasting completion',
              key: 'tcpiBac', label: 'TCPI — to hit BAC', format: 'ratio',
              meaning: '(BAC − EV) ÷ (BAC − AC). The cost efficiency you must sustain on all remaining work to still land on the original budget.',
              compute: function (v) { return ok(v.bac, v.ev, v.ac) && (v.bac - v.ac) !== 0 ? (v.bac - v.ev) / (v.bac - v.ac) : null; },
              /* Once AC reaches BAC the original budget is spent with work still
                 outstanding, so (BAC − AC) turns negative and the ratio stops
                 meaning anything — a negative TCPI is not an easy target, it is
                 an unreachable one. Judge that case before the tiers. */
              interpret: function (x, v) { return v.ac >= v.bac || x <= 0 ? bad('Actual cost has already reached the budget, so landing on BAC is no longer possible. Re-baseline and read TCPI against an EAC instead.') : x <= 1 ? good('Achievable — no extra efficiency needed.') : x <= 1.1 ? warn('A stretch: remaining work must run ' + f2((x - 1) * 100) + '% more efficiently.') : bad('Likely unrealistic — consider re-baselining to an EAC.'); }
            },
            {
              group: 'Forecasting completion',
              key: 'tcpiEac', label: 'TCPI — to hit EAC', format: 'ratio',
              meaning: '(BAC − EV) ÷ (EAC − AC). The efficiency needed to hit a revised forecast instead of the original budget. Against the calculated EAC of BAC ÷ CPI this reduces to CPI itself, so it only becomes an independent test once you enter a management forecast above.',
              /* Read against BAC ÷ CPI, (BAC−EV)/(EAC−AC) cancels to EV/AC — the
                 same CPI already shown two rows up, dressed as a second opinion.
                 A management EAC is the number this test is actually for, so use
                 it when given and say so plainly when it is not. */
              compute: function (v) {
                if (!ok(v.bac, v.ev, v.ac) || v.ev === 0) return null;
                var eac = ok(v.eacMgmt) ? v.eacMgmt : v.bac / (v.ev / v.ac);
                return (eac - v.ac) !== 0 ? (v.bac - v.ev) / (eac - v.ac) : null;
              },
              interpret: function (x, v) {
                if (!ok(v.eacMgmt)) {
                  return info('This equals CPI by construction — the forecast it is measured against was derived from CPI. Enter a management EAC above to make it a real test.');
                }
                return x <= 1
                  ? good('Achievable — the forecast holds at current efficiency.')
                  : x <= 1.1
                    ? warn('A stretch: the forecast needs remaining work run ' + f2((x - 1) * 100) + '% more efficiently.')
                    : bad('The forecast is unrealistic at this efficiency — it needs re-setting, not more optimism.');
              }
            }
          ],
          charts: [
            {
              title: 'Cost position',
              purpose: 'What was planned, what was earned, what it cost — against the budget line.',
              kind: 'bars',
              build: function (v, r) {
                if (!ok(v.pv, v.ev, v.ac)) return null;
                var series = [
                  { label: 'PV', sub: 'planned', value: v.pv, tone: 'neutral' },
                  { label: 'EV', sub: 'earned', value: v.ev, tone: 'accent' },
                  { label: 'AC', sub: 'spent', value: v.ac, tone: ok(r.cv) && r.cv < 0 ? 'bad' : 'good' }
                ];
                if (typeof r.eacTypical === 'number') {
                  series.push({
                    label: 'EAC', sub: 'forecast', value: r.eacTypical,
                    tone: ok(v.bac) && r.eacTypical > v.bac ? 'bad' : 'good', hatch: true
                  });
                }
                return {
                  series: series,
                  refValue: ok(v.bac) ? v.bac : undefined,
                  refLabel: 'BAC',
                  catHead: 'Measure',
                  summary: 'Earned ' + f2(v.ev) + ' of value for ' + f2(v.ac) + ' spent, against ' +
                    f2(v.pv) + ' planned by now' +
                    (typeof r.eacTypical === 'number' && ok(v.bac)
                      ? '. At today’s efficiency the project lands at ' + f2(r.eacTypical) +
                        ' against a ' + f2(v.bac) + ' budget.'
                      : '.')
                };
              }
            },
            {
              title: 'CPI–SPI quadrant',
              purpose: 'Cost efficiency against schedule efficiency, crossed at 1.00.',
              kind: 'quadrant',
              build: function (v, r) {
                if (!ok(r.cpi, r.spi)) return null;
                var tone = r.cpi >= 1 && r.spi >= 1 ? 'good'
                  : r.cpi < 1 && r.spi < 1 ? 'bad' : 'warn';
                return {
                  x: r.cpi, y: r.spi, refX: 1, refY: 1,
                  xLabel: 'CPI — cost', yLabel: 'SPI — schedule',
                  goodLabel: 'on budget, on plan',
                  badLabel: 'over budget, behind plan',
                  tone: tone,
                  summary: 'CPI ' + f2(r.cpi) + ' and SPI ' + f2(r.spi) + ' place the project ' +
                    (tone === 'good' ? 'in the favourable quadrant — at or better than plan on both axes.'
                      : tone === 'bad' ? 'in the unfavourable quadrant — behind on both cost and schedule.'
                      : 'in a mixed quadrant: one axis is holding, the other is not.')
                };
              }
            },
            {
              title: 'TCPI required efficiency',
              purpose: 'The cost performance the remaining work must sustain to still hit BAC.',
              kind: 'meter',
              build: function (v, r) {
                if (typeof r.tcpiBac !== 'number') return null;
                return {
                  value: r.tcpiBac, min: 0.6, max: 1.6, target: 1, targetLabel: 'current CPI target',
                  zones: [
                    { from: 0.6, to: 1, tone: 'good', label: 'achievable' },
                    { from: 1, to: 1.1, tone: 'warn', label: 'a stretch' },
                    { from: 1.1, to: 1.6, tone: 'bad', label: 'unrealistic' }
                  ],
                  label: 'TCPI', scaleLabel: 'Efficiency required on remaining work',
                  summary: 'Remaining work must run at ' + f2(r.tcpiBac) + ' efficiency to land on the original budget' +
                    (typeof r.cpi === 'number' ? ', versus ' + f2(r.cpi) + ' achieved to date.' : '.')
                };
              }
            }
          ]
        },
        {
          id: 'earned-schedule',
          page: 'earned-schedule.html',
          name: 'Earned Schedule',
          tagline: 'ES · SV(t) · SPI(t) · IEAC(t)',
          about: 'SPI can look healthy late in a project because PV is running out. Earned Schedule puts EV back on the time axis. This card assumes <strong>LINEAR PV</strong> — the useful, explicit approximation for a four-input reading. Treat IEAC(t) as a trend, not a committed finish date.',
          formula: [
            'ES = PD × (EV ÷ BAC)',
            'SV(t) = ES − AT',
            'SPI(t) = ES ÷ AT',
            'IEAC(t) = PD ÷ SPI(t)'
          ],
          howto: [
            'Enter BAC and PD from the approved baseline, then enter EV and AT from the same status date.',
            'Read SV(t) for the time gap and SPI(t) for the direction and efficiency of travel. Check that the linear-PV assumption is reasonable for this project.',
            'Use IEAC(t) as a trend to test recovery options; reconcile it to the time-phased schedule before committing to a finish date.'
          ],
          inputs: [
            { key: 'bac', label: 'BAC — Budget at Completion', meaning: 'Total approved budget for the complete scope. Currency; must be greater than 0.', placeholder: 'e.g. 200000' },
            { key: 'pd', label: 'PD — Planned duration', meaning: 'Baseline duration from start to planned finish. Periods; use a positive value.', placeholder: 'e.g. 12' },
            { key: 'at', label: 'AT — Actual time', meaning: 'Time elapsed at the status date. Periods; must be greater than 0 for SPI(t).', placeholder: 'e.g. 8' },
            { key: 'ev', label: 'EV — Earned Value', meaning: 'Budgeted value of the work actually complete. Same currency as BAC; zero is valid.', placeholder: 'e.g. 120000' }
          ],
          outputs: [
            {
              group: 'Earned time',
              key: 'es', label: 'Earned Schedule (ES)', format: 'num',
              meaning: 'The baseline time equivalent of the EV entered.',
              compute: function (v) {
                return ok(v.bac, v.pd, v.at, v.ev) && v.bac > 0 && v.pd > 0
                  ? v.pd * (v.ev / v.bac) : null;
              }
            },
            {
              group: 'Earned time',
              key: 'svt', label: 'Schedule Variance (SV(t))', format: 'num',
              meaning: 'The time difference at the status date. Negative means late.',
              compute: function (v) {
                return ok(v.bac, v.pd, v.at, v.ev) && v.bac > 0 && v.pd > 0
                  ? v.pd * (v.ev / v.bac) - v.at : null;
              }
            },
            {
              group: 'Earned time',
              key: 'spit', label: 'Schedule Performance Index (SPI(t))', format: 'ratio',
              meaning: 'Time efficiency, with 1.00 as the plan line.',
              compute: function (v) {
                return ok(v.bac, v.pd, v.at, v.ev) && v.bac > 0 && v.pd > 0 && v.at > 0
                  ? (v.pd * (v.ev / v.bac)) / v.at : null;
              },
              interpret: function (x) {
                return x > 1
                  ? good('Ahead of the time baseline. The completed work represents more planned time than the project has consumed.')
                  : x === 1
                    ? info('On the time baseline. Earned schedule and actual time match.')
                    : bad('Behind the time baseline. The completed work represents fewer planned periods than have elapsed.');
              }
            },
            {
              group: 'Forecasting completion',
              key: 'ieac', label: 'Independent Estimate at Completion (IEAC(t))', format: 'num',
              meaning: 'A duration forecast under the same efficiency and linear-PV assumption; it is not a promise and it is not a calendar finish date.',
              compute: function (v) {
                if (!ok(v.bac, v.pd, v.at, v.ev) || v.bac <= 0 || v.pd <= 0 || v.at <= 0) return null;
                var spit = (v.pd * (v.ev / v.bac)) / v.at;
                return spit > 0 ? v.pd / spit : null;
              }
            }
          ],
          charts: [
            {
              title: 'Earned time position',
              purpose: 'The time the completed work earned against actual time and plan.',
              kind: 'bars',
              build: function (v, r) {
                if (!ok(r.es, v.at)) return null;
                var relation = r.svt > 0 ? 'ahead of' : r.svt < 0 ? 'behind' : 'on';
                return {
                  series: [
                    { label: 'ES', sub: 'earned', value: r.es, tone: r.svt >= 0 ? 'good' : 'bad' },
                    { label: 'AT', sub: 'actual', value: v.at, tone: 'accent' }
                  ],
                  refValue: v.pd,
                  refLabel: 'PD',
                  catHead: 'Time (periods)',
                  summary: 'Earned schedule is ' + f2(r.es) + ' periods against ' + f2(v.at) +
                    ' actual, ' + relation + ' the time baseline.'
                };
              }
            },
            {
              title: 'SPI(t) time efficiency',
              purpose: 'Earned schedule per period of actual time, crossed at 1.00.',
              kind: 'meter',
              build: function (v, r) {
                if (!ok(r.spit)) return null;
                return {
                  value: r.spit,
                  min: 0,
                  max: 1.5,
                  target: 1,
                  targetLabel: 'on plan',
                  zones: [
                    { from: 0, to: 0.9, tone: 'bad', label: 'behind' },
                    { from: 0.9, to: 1, tone: 'warn', label: 'watch' },
                    { from: 1, to: 1.5, tone: 'good', label: 'ahead' }
                  ],
                  label: 'SPI(t)',
                  summary: 'SPI(t) is ' + f2(r.spit) + '. Under the linear-PV assumption, use it as a trend, not a committed finish date.'
                };
              }
            }
          ]
        },
        {
          id: 'time-forecast',
          name: 'Time forecasting (SPI-based)',
          tagline: 'Planned duration ÷ SPI',
          about: 'Cost gets EAC; schedule gets this. Dividing the planned duration by the schedule performance index projects when the project will actually finish if the current pace continues. It is an approximation — SPI drifts back toward 1.0 late in a project as planned value tops out, so trust it early and mid-project and re-check often.',
          formula: ['Forecast duration = Planned duration ÷ SPI', 'SPI = EV ÷ PV'],
          inputs: [
            { key: 'plannedDur', label: 'Planned duration', meaning: 'The baseline total duration, in any time unit — the forecast comes back in the same unit.', placeholder: 'e.g. 12' },
            { key: 'ev', label: 'EV — Earned Value', meaning: 'Budgeted cost of the work actually completed to date.', placeholder: 'e.g. 45000' },
            { key: 'pv', label: 'PV — Planned Value', meaning: 'Budgeted cost of the work scheduled to be done by now.', placeholder: 'e.g. 50000' }
          ],
          outputs: [
            {
              key: 'spi', label: 'SPI', format: 'ratio',
              meaning: 'Pace versus plan — the engine of the forecast.',
              compute: function (v) { return ok(v.ev, v.pv) && v.pv !== 0 ? v.ev / v.pv : null; },
              interpret: function (x) { return x >= 1 ? good('At or ahead of the planned pace.') : bad('Running at ' + f2(x * 100) + '% of the planned pace.'); }
            },
            {
              key: 'forecastDur', label: 'Forecast duration', format: 'num',
              meaning: 'Expected total duration if the current pace holds.',
              compute: function (v) { return ok(v.plannedDur, v.ev, v.pv) && v.ev !== 0 ? v.plannedDur / (v.ev / v.pv) : null; },
              interpret: function () { return info('Same unit as the planned duration you entered.'); }
            },
            {
              key: 'delay', label: 'Projected slip', format: 'num',
              meaning: 'Forecast minus plan — the schedule overrun taking shape.',
              compute: function (v) { return ok(v.plannedDur, v.ev, v.pv) && v.ev !== 0 ? v.plannedDur / (v.ev / v.pv) - v.plannedDur : null; },
              interpret: function (x) { return x > 0 ? bad('Trending ' + f2(x) + ' time unit(s) late — compress the schedule or move the date.') : good('Trending on time or early.'); }
            }
          ],
          charts: [
            {
              title: 'Planned vs forecast duration',
              purpose: 'Where the project lands if today’s pace holds — not a certainty, a trend.',
              kind: 'bars',
              build: function (v, r) {
                if (!ok(v.plannedDur) || typeof r.forecastDur !== 'number') return null;
                return {
                  series: [
                    { label: 'Planned', value: v.plannedDur, tone: 'neutral' },
                    { label: 'Forecast', value: r.forecastDur, tone: r.forecastDur > v.plannedDur ? 'bad' : 'good', hatch: r.forecastDur > v.plannedDur }
                  ],
                  catHead: 'Duration',
                  summary: 'At the current pace (SPI ' + f2(r.spi) + '), the project is trending toward ' +
                    f2(r.forecastDur) + ' time units against a plan of ' + f2(v.plannedDur) +
                    ' — an approximation that firms up as the project progresses, not a committed date.'
                };
              }
            }
          ]
        }
      ]
    },

    /* -------------------------------------------------- Budget & Burn */
    {
      id: 'burn',
      name: 'Budget & Burn Rate',
      blurb: 'The cash view of project health: how fast money is leaving, and how long the remaining budget lasts at that pace. Simpler than earned value — but it says nothing about what was delivered for the money, so read it next to % complete, never instead of it.',
      citation: 'Budget & burn — PMI PMBOK Guide, Cost Management.',
      cards: [
        {
          id: 'burn-rate',
          name: 'Burn rate & runway',
          tagline: 'Spend pace · runway · budget used',
          about: 'Divide what you have spent by how long you have been spending it and you get the burn rate — the project’s cash velocity. Runway converts the remaining budget into time at that pace. Use any period unit (months, sprints); the runway comes back in the same unit.',
          formula: [
            'Burn rate = Spent ÷ Periods elapsed',
            'Runway = (Budget − Spent) ÷ Burn rate'
          ],
          inputs: [
            { key: 'budget', label: 'Total budget', meaning: 'Approved funds for the whole project.', placeholder: 'e.g. 120000' },
            { key: 'spent', label: 'Spent to date', meaning: 'Actual cost so far — same as AC in earned value.', placeholder: 'e.g. 45000' },
            { key: 'elapsed', label: 'Periods elapsed', meaning: 'How many months / sprints of spending produced that cost.', placeholder: 'e.g. 3' },
            { key: 'planLeft', label: 'Planned periods remaining (optional)', meaning: 'How much longer the plan says the work will take — to test whether the money outlives the work.', placeholder: 'e.g. 6' }
          ],
          outputs: [
            {
              key: 'burnRate', label: 'Burn rate', format: 'money',
              meaning: 'Average spend per period — the pace at which the budget is being consumed.',
              compute: function (v) { return ok(v.spent, v.elapsed) && v.elapsed > 0 ? v.spent / v.elapsed : null; },
              interpret: function () { return info('A trend, not a verdict — compare across periods to spot acceleration.'); }
            },
            {
              key: 'remaining', label: 'Budget remaining', format: 'money',
              meaning: 'Funds left before the budget is exhausted.',
              compute: function (v) { return ok(v.budget, v.spent) ? v.budget - v.spent : null; },
              interpret: function (x) { return x < 0 ? bad('Budget already exhausted.') : info('The fuel left in the tank.'); }
            },
            {
              key: 'runway', label: 'Runway (periods)', format: 'num',
              meaning: 'How many more periods the remaining budget lasts at the current burn rate.',
              compute: function (v) { return ok(v.budget, v.spent, v.elapsed) && v.elapsed > 0 && v.spent > 0 ? (v.budget - v.spent) / (v.spent / v.elapsed) : null; },
              interpret: function (x, v) {
                if (ok(v.planLeft)) {
                  return x >= v.planLeft ? good('Money outlasts the plan — ' + f2(x - v.planLeft) + ' period(s) of buffer.') : bad('Money runs out ' + f2(v.planLeft - x) + ' period(s) before the work does.');
                }
                return info('Enter planned periods remaining to compare against the plan.');
              }
            },
            {
              key: 'pctUsed', label: '% of budget used', format: 'pct',
              meaning: 'Share of total funds already consumed.',
              compute: function (v) { return ok(v.budget, v.spent) && v.budget !== 0 ? (v.spent / v.budget) * 100 : null; },
              interpret: function (x) { return x > 100 ? bad('Over budget.') : info('Meaningful only next to % of work complete — see Earned Value.'); }
            }
          ],
          charts: [
            {
              title: 'Runway vs plan',
              purpose: 'Whether the remaining money outlasts the remaining work.',
              kind: 'bars',
              build: function (v, r) {
                if (typeof r.runway !== 'number' || !ok(v.planLeft)) return null;
                return {
                  series: [
                    { label: 'Runway', sub: 'at current burn', value: r.runway, tone: r.runway >= v.planLeft ? 'good' : 'bad' },
                    { label: 'Plan', sub: 'periods remaining', value: v.planLeft, tone: 'neutral' }
                  ],
                  catHead: 'Periods',
                  summary: 'At the current burn rate the budget lasts ' + f2(r.runway) + ' more period(s), against ' +
                    f2(v.planLeft) + ' period(s) of planned work remaining.'
                };
              }
            }
          ]
        }
      ]
    },

    /* ----------------------------------------------------- Estimation */
    {
      id: 'estimation',
      name: 'Estimation',
      blurb: 'Turning uncertainty into a defensible number. For reference, typical estimate accuracy ranges: Rough Order of Magnitude −25% / +75%, Budget estimate −10% / +25%, Definitive estimate −5% / +10%.',
      citation: 'Estimation — PMI Practice Standard for Project Estimating.',
      cards: [
        {
          id: 'three-point',
          page: 'pert-estimate.html',
          name: 'Three-point estimate (PERT)',
          tagline: 'Triangular · Beta · σ · confidence ranges',
          about: 'Instead of a single guess, you estimate three scenarios and blend them. The PERT (beta) formula weights the most-likely case 4× because real outcomes cluster around it; the standard deviation then converts your optimism–pessimism spread into confidence ranges you can commit to. Works for durations and for costs alike. The 68 / 95 / 99.7% figures below are properties of the normal curve, while a single activity follows a skewed beta — read them as a good working approximation for one activity, and as genuinely accurate for the sum of several, which is where the roll-up below sends them.',
          formula: [
            'Triangular = (O + M + P) ÷ 3',
            'PERT (beta) = (O + 4M + P) ÷ 6',
            'σ = (P − O) ÷ 6        Variance = σ²'
          ],
          inputs: [
            { key: 'o', label: 'O — Optimistic', meaning: 'Best-case estimate: everything goes right. Roughly the 1-in-100 lucky outcome.', placeholder: 'e.g. 4' },
            { key: 'm', label: 'M — Most Likely', meaning: 'The realistic estimate you would give under normal conditions.', placeholder: 'e.g. 6' },
            { key: 'p', label: 'P — Pessimistic', meaning: 'Worst-case estimate: known risks materialise. Roughly the 1-in-100 unlucky outcome.', placeholder: 'e.g. 12' }
          ],
          outputs: [
            {
              key: 'tri', label: 'Triangular average', format: 'num',
              meaning: 'Simple mean of the three points — use when you have no reason to trust M more.',
              compute: function (v) { return ok(v.o, v.m, v.p) ? (v.o + v.m + v.p) / 3 : null; },
              interpret: function () { return info('All three scenarios weighted equally.'); }
            },
            {
              key: 'pert', label: 'PERT (beta) estimate', format: 'num',
              meaning: 'Weighted mean, 4× on Most Likely — the standard exam and planning answer.',
              compute: function (v) { return ok(v.o, v.m, v.p) ? (v.o + 4 * v.m + v.p) / 6 : null; },
              interpret: function () { return info('The expected value to plan around.'); }
            },
            {
              key: 'sd', label: 'Standard deviation (σ)', format: 'num',
              meaning: 'How spread out the outcome could be. A wide O–P gap means low confidence.',
              compute: function (v) { return ok(v.o, v.p) ? (v.p - v.o) / 6 : null; },
              /* A negative σ means P was entered below O. The arithmetic still
                 produces a number, so say plainly that it is not a real spread
                 rather than letting a negative deviation stand as a result. */
              interpret: function (x, v) {
                if (x < 0) return bad('Pessimistic is below optimistic — swap P and O. σ cannot be negative.');
                return ok(v.m) && v.m !== 0 && Math.abs(x / v.m) > 0.25 ? warn('High uncertainty relative to the estimate — refine the inputs.') : info('Uncertainty of a single activity.');
              }
            },
            {
              key: 'variance', label: 'Variance (σ²)', format: 'num',
              meaning: 'σ squared. Variances (not σ) are what you add up along a path to get path-level uncertainty.',
              compute: function (v) { return ok(v.o, v.p) ? Math.pow((v.p - v.o) / 6, 2) : null; },
              interpret: function () { return info('Path σ = √(sum of activity variances).'); }
            },
            {
              key: 'r68', label: '68% confidence (±1σ)', format: 'text',
              meaning: 'Roughly two times in three, the real result lands inside this range.',
              compute: function (v) {
                if (!ok(v.o, v.m, v.p)) return null;
                var mean = (v.o + 4 * v.m + v.p) / 6, sd = (v.p - v.o) / 6;
                return f2(mean - sd) + ' – ' + f2(mean + sd);
              },
              interpret: function () { return info('PERT ± 1σ.'); }
            },
            {
              key: 'r95', label: '95% confidence (±2σ)', format: 'text',
              meaning: 'The range usually quoted when someone asks for a commitment.',
              compute: function (v) {
                if (!ok(v.o, v.m, v.p)) return null;
                var mean = (v.o + 4 * v.m + v.p) / 6, sd = (v.p - v.o) / 6;
                return f2(mean - 2 * sd) + ' – ' + f2(mean + 2 * sd);
              },
              interpret: function () { return info('PERT ± 2σ.'); }
            },
            {
              key: 'r997', label: '99.7% confidence (±3σ)', format: 'text',
              meaning: 'Near-certainty bounds — use for hard external deadlines.',
              compute: function (v) {
                if (!ok(v.o, v.m, v.p)) return null;
                var mean = (v.o + 4 * v.m + v.p) / 6, sd = (v.p - v.o) / 6;
                return f2(mean - 3 * sd) + ' – ' + f2(mean + 3 * sd);
              },
              interpret: function () { return info('PERT ± 3σ.'); }
            }
          ],
          charts: [
            {
              title: 'Three-point distribution',
              purpose: 'The shape of the estimate, the PERT expected value, and the 68% band around it.',
              kind: 'distribution',
              build: function (v, r) {
                if (!ok(v.o, v.m, v.p) || typeof r.pert !== 'number' || typeof r.sd !== 'number') return null;
                return { o: v.o, m: v.m, p: v.p, e: r.pert, sd: r.sd, clipId: 'dist-three-point' };
              }
            }
          ]
        },
        {
          id: 'path-sigma',
          name: 'Path uncertainty roll-up',
          tagline: 'σ(path) = √(Σ σ²)',
          about: 'Uncertainties don’t add — variances do. To get the uncertainty of a whole path (or project), square each activity’s σ, add them, and take the square root. The roll-up is always smaller than the simple sum of σ’s, which is why padding every task individually is wrong: the math already diversifies the risk. That diversification assumes the activities are <strong>INDEPENDENT</strong>. Correlated risks — one team, one supplier, one weather window — break the assumption, and the true path σ is then larger than this. It also covers a single path, not the merge bias where parallel paths converge.',
          formula: ['σ(path) = √(σ₁² + σ₂² + … + σₙ²)'],
          inputs: [
            { key: 'sigmas', label: 'Activity σ values (comma-separated)', meaning: 'The standard deviation of each activity on the path, from the three-point calculator above.', placeholder: 'e.g. 1.33, 0.5, 2', type: 'text' }
          ],
          outputs: [
            {
              key: 'pathSigma', label: 'Path σ', format: 'num',
              meaning: 'The combined uncertainty of the whole chain — use it for path-level confidence ranges.',
              compute: function (v) {
                var s = parseFlows(v.sigmas);
                if (!s) return null;
                var sum = 0;
                for (var i = 0; i < s.length; i++) sum += s[i] * s[i];
                return Math.sqrt(sum);
              },
              interpret: function () { return info('Path estimate ± this σ gives the 68% range; ± 2σ gives 95%.'); }
            },
            {
              key: 'naiveSum', label: 'Naive sum of σ’s', format: 'num',
              meaning: 'What you would get by simply adding the uncertainties — shown for contrast.',
              compute: function (v) {
                var s = parseFlows(v.sigmas);
                if (!s) return null;
                var sum = 0;
                for (var i = 0; i < s.length; i++) sum += s[i];
                return sum;
              },
              interpret: function (x, v) {
                var s = parseFlows(v.sigmas);
                if (!s || s.length < 2) return info('Add more activities to see the diversification effect.');
                var sq = 0;
                for (var i = 0; i < s.length; i++) sq += s[i] * s[i];
                return warn('Overstates risk by ' + f2(x - Math.sqrt(sq)) + ' — pad the path, not every task.');
              }
            }
          ],
          charts: [
            {
              title: 'Roll-up vs naive sum',
              purpose: 'Why adding standard deviations overstates a path’s real uncertainty.',
              kind: 'bars',
              build: function (v, r) {
                if (typeof r.pathSigma !== 'number' || typeof r.naiveSum !== 'number') return null;
                var s = parseFlows(v.sigmas) || [];
                var series = s.map(function (sig, i) {
                  return { label: 'σ' + (i + 1), value: sig, tone: 'neutral' };
                });
                series.push({ label: 'Path σ', sub: 'rolled up', value: r.pathSigma, tone: 'good' });
                series.push({ label: 'Naive sum', sub: 'if added', value: r.naiveSum, tone: 'warn', hatch: true });
                return {
                  series: series,
                  catHead: 'Uncertainty',
                  summary: 'The path’s real uncertainty rolls up to σ = ' + f2(r.pathSigma) +
                    ' — simply summing the activity σ’s would overstate it at ' + f2(r.naiveSum) + '.'
                };
              }
            }
          ]
        },
        {
          id: 'learning-curve',
          name: 'Learning curve',
          tagline: 'T(n) = T₁ × n^(log rate ÷ log 2)',
          about: 'Every doubling of repetitions cuts the per-unit time by a fixed percentage: on an 80% curve, unit 2 takes 80% of unit 1’s time, unit 4 takes 80% of unit 2’s, and so on. Use it to estimate repetitive work — floors of a building, server migrations, test cycles — instead of multiplying the first unit’s time by the count. This is the unit (Crawford) model.',
          formula: ['Time for unit n = T₁ × n^(log(rate ÷ 100) ÷ log 2)', 'rate is the learning rate as entered, in percent: 80 means 0.8'],
          inputs: [
            { key: 't1', label: 'T₁ — first unit time (or cost)', meaning: 'How long the first repetition took — the anchor of the curve.', placeholder: 'e.g. 100' },
            { key: 'rate', label: 'Learning rate (%)', meaning: 'Per-doubling retention: 80 means each doubling takes 80% of the previous. Typical: 70–90%; 100 = no learning.', placeholder: 'e.g. 80' },
            { key: 'n', label: 'Unit number (n)', meaning: 'Which repetition you want the estimate for.', placeholder: 'e.g. 4' }
          ],
          outputs: [
            {
              key: 'tn', label: 'Time for unit n', format: 'num',
              meaning: 'Predicted effort for that repetition.',
              compute: function (v) { return ok(v.t1, v.rate, v.n) && v.t1 > 0 && v.rate > 0 && v.rate <= 100 && v.n >= 1 ? v.t1 * Math.pow(v.n, Math.log(v.rate / 100) / Math.log(2)) : null; },
              interpret: function () { return info('Assumes the same team and no long breaks — learning decays when work pauses.'); }
            },
            {
              key: 'improvement', label: 'Improvement vs unit 1', format: 'pct',
              meaning: 'How much faster unit n is than the first attempt.',
              compute: function (v) { return ok(v.t1, v.rate, v.n) && v.t1 > 0 && v.rate > 0 && v.rate <= 100 && v.n >= 1 ? (1 - Math.pow(v.n, Math.log(v.rate / 100) / Math.log(2))) * 100 : null; },
              interpret: function () { return warn('Estimating every repetition at T₁ quietly pads the plan.'); }
            }
          ],
          charts: [
            {
              title: 'Learning curve',
              purpose: 'Per-unit time against a flat no-learning baseline, with the selected unit marked.',
              kind: 'curve',
              build: function (v, r) {
                if (typeof r.tn !== 'number' || !ok(v.t1, v.rate, v.n) || v.t1 <= 0 || v.rate <= 0 || v.rate > 100 || v.n < 1 || v.n > 100000) return null;
                var exp = Math.log(v.rate / 100) / Math.log(2);
                var maxN = Math.min(2000, Math.max(8, Math.ceil(v.n * 2)));
                var pts = [], i;
                for (i = 1; i <= maxN; i++) pts.push([i, v.t1 * Math.pow(i, exp)]);
                var flat = [[1, v.t1], [maxN, v.t1]];
                return {
                  series: [
                    { label: (v.rate) + '% learning curve', points: pts, tone: 'accent', style: 'solid' },
                    { label: 'No learning (flat)', points: flat, tone: 'neutral', style: 'dashed' }
                  ],
                  markers: [{ x: v.n, y: r.tn, label: 'unit ' + v.n, tone: 'accent' }],
                  xLabel: 'Unit number', yLabel: 'Time (or cost) per unit', zeroBase: true,
                  summary: 'Unit ' + v.n + ' takes ' + f2(r.tn) + ' at an ' + v.rate +
                    '% learning rate, against ' + f2(v.t1) + ' with no learning at all.'
                };
              }
            }
          ]
        }
      ]
    },

    /* ------------------------------------------------------- Schedule */
    {
      id: 'schedule',
      name: 'Schedule & Critical Path',
      blurb: 'The critical path method finds which activities control the finish date. Early dates come from the forward pass, late dates from the backward pass; float is the gap between them.',
      citation: 'Schedule — PMI Practice Standard for Scheduling.',
      cards: [
        {
          id: 'float',
          page: 'float-calculator.html',
          name: 'Float (slack)',
          tagline: 'Total float · free float · critical path test',
          about: 'Total float is how long an activity can slip without delaying the project finish. Free float is how long it can slip without delaying its immediate successor. Zero total float means the activity is on the critical path. Enter the dates from your forward/backward pass — either day numbers or durations, as long as they are consistent (this calculator uses the continuous convention where EF = ES + duration).',
          formula: [
            'Total Float = LS − ES = LF − EF',
            'Free Float = ES(successor) − EF'
          ],
          inputs: [
            { key: 'es', label: 'ES — Early Start', meaning: 'The soonest the activity can start, from the forward pass.', placeholder: 'e.g. 5' },
            { key: 'ef', label: 'EF — Early Finish', meaning: 'The soonest it can finish: ES + duration.', placeholder: 'e.g. 9' },
            { key: 'ls', label: 'LS — Late Start', meaning: 'The latest it can start without delaying the project, from the backward pass.', placeholder: 'e.g. 8' },
            { key: 'lf', label: 'LF — Late Finish', meaning: 'The latest it can finish without delaying the project.', placeholder: 'e.g. 12' },
            { key: 'succEs', label: 'Successor ES (optional)', meaning: 'Early start of the next activity — only needed for free float.', placeholder: 'e.g. 11' }
          ],
          outputs: [
            {
              key: 'tf', label: 'Total float', format: 'num',
              meaning: 'Slip allowance before the project end date moves: LS − ES.',
              compute: function (v) { return ok(v.ls, v.es) ? v.ls - v.es : ok(v.lf, v.ef) ? v.lf - v.ef : null; },
              interpret: function (x) { return x === 0 ? bad('Zero float: this activity is on the critical path — any slip delays the project.') : x < 0 ? bad('Negative float: the schedule is already behind its target.') : good('Can slip ' + f2(x) + ' time unit(s) without moving the finish date.'); }
            },
            {
              key: 'tfCheck', label: 'Cross-check (LF − EF)', format: 'num',
              meaning: 'Should equal LS − ES; a mismatch means a pass was computed inconsistently.',
              compute: function (v) { return ok(v.lf, v.ef) ? v.lf - v.ef : null; },
              interpret: function (x, v) { return ok(v.ls, v.es) && (v.ls - v.es) !== x ? warn('Does not match LS − ES — re-check the forward/backward pass.') : info('Consistent with LS − ES.'); }
            },
            {
              key: 'ff', label: 'Free float', format: 'num',
              meaning: 'Slip allowance before the next activity is disturbed: successor ES − EF.',
              compute: function (v) { return ok(v.succEs, v.ef) ? v.succEs - v.ef : null; },
              interpret: function (x) { return x > 0 ? good('Can slip without touching the successor.') : x === 0 ? warn('Any slip pushes the successor immediately.') : bad('Already overlapping the successor.'); }
            }
          ],
          charts: [
            {
              title: 'Early vs late window',
              purpose: 'How much room the activity has before it becomes critical.',
              kind: 'windows',
              build: function (v, r) {
                if (!ok(v.es, v.ef, v.ls, v.lf)) return null;
                var rows = [
                  { label: 'Early (ES→EF)', from: v.es, to: v.ef, tone: 'accent' },
                  { label: 'Late (LS→LF)', from: v.ls, to: v.lf, tone: typeof r.tf === 'number' && r.tf === 0 ? 'bad' : 'neutral', hatch: true,
                    note: typeof r.tf === 'number' ? f2(r.tf) + ' float' : undefined }
                ];
                var marks = ok(v.succEs) ? [{ at: v.succEs, label: 'successor ES' }] : [];
                return {
                  rows: rows, marks: marks,
                  summary: typeof r.tf === 'number'
                    ? (r.tf === 0 ? 'Zero float — the early and late windows coincide; this activity is on the critical path.'
                        : 'The late window trails the early one by ' + f2(r.tf) + ' — the total float available before this activity delays the finish.')
                    : 'Early window ' + f2(v.es) + '–' + f2(v.ef) + ', late window ' + f2(v.ls) + '–' + f2(v.lf) + '.'
                };
              }
            }
          ]
        }
      ]
    },

    /* ---------------------------------------- Schedule Compression */
    {
      id: 'compression',
      name: 'Schedule Compression',
      blurb: 'When the schedule must shrink there are only two levers: crashing buys time with money, fast-tracking buys it with risk. The cost slope tells you which activity sells the cheapest week.',
      citation: 'Compression — PMI PMBOK Guide, Schedule Compression.',
      cards: [
        {
          id: 'crash',
          name: 'Crash cost slope',
          tagline: '(Crash cost − Normal cost) ÷ time saved',
          about: 'Most activities can be sped up — more people, overtime, premium suppliers — but only so far and at a price. The cost slope is the price of each time unit saved. To compress rationally: crash only critical-path activities, cheapest slope first, and stop when the slope costs more than the deadline is worth. Run this once per candidate activity and compare.',
          formula: ['Cost slope = (Crash cost − Normal cost) ÷ (Normal duration − Crash duration)'],
          inputs: [
            { key: 'normalCost', label: 'Normal cost', meaning: 'Cost of the activity at its normal, efficient pace.', placeholder: 'e.g. 10000' },
            { key: 'crashCost', label: 'Crash cost', meaning: 'Cost at the fastest possible pace — overtime, extra staff, expediting fees included.', placeholder: 'e.g. 16000' },
            { key: 'normalDur', label: 'Normal duration', meaning: 'Duration at the normal pace (any time unit).', placeholder: 'e.g. 10' },
            { key: 'crashDur', label: 'Crash duration', meaning: 'The shortest duration physically achievable — beyond it, money buys nothing.', placeholder: 'e.g. 8' }
          ],
          outputs: [
            {
              key: 'slope', label: 'Cost slope', format: 'money',
              meaning: 'Extra cost per time unit saved on this activity.',
              compute: function (v) { return ok(v.normalCost, v.crashCost, v.normalDur, v.crashDur) && (v.normalDur - v.crashDur) > 0 ? (v.crashCost - v.normalCost) / (v.normalDur - v.crashDur) : null; },
              interpret: function (x) { return x < 0 ? good('Cheaper and faster — do it regardless of the deadline.') : info('Compare slopes across critical activities; crash the cheapest first.'); }
            },
            {
              key: 'maxSaving', label: 'Maximum time saved', format: 'num',
              meaning: 'The most this activity can be shortened: normal minus crash duration.',
              compute: function (v) { return ok(v.normalDur, v.crashDur) ? v.normalDur - v.crashDur : null; },
              interpret: function (x) { return x <= 0 ? bad('No compression available on this activity.') : warn('Crashing helps only while this activity stays on the critical path — re-check after each step.'); }
            },
            {
              key: 'premium', label: 'Full crash premium', format: 'money',
              meaning: 'Total extra cost of buying all the available time.',
              compute: function (v) { return ok(v.normalCost, v.crashCost) ? v.crashCost - v.normalCost : null; },
              interpret: function () { return info('Weigh against the cost of being late: penalties, lost revenue, standing armies.'); }
            }
          ],
          charts: [
            {
              title: 'Normal vs crash',
              purpose: 'The cost slope drawn as a line — its gradient is the price of each time unit saved.',
              kind: 'curve',
              build: function (v, r) {
                if (!ok(v.normalCost, v.crashCost, v.normalDur, v.crashDur) || v.normalDur === v.crashDur) return null;
                var pts = [[v.crashDur, v.crashCost], [v.normalDur, v.normalCost]].sort(function (a, b) { return a[0] - b[0]; });
                return {
                  series: [{ label: 'Cost vs duration', points: pts, tone: typeof r.slope === 'number' && r.slope < 0 ? 'good' : 'accent' }],
                  markers: [
                    { x: v.normalDur, y: v.normalCost, label: 'normal', tone: 'neutral' },
                    { x: v.crashDur, y: v.crashCost, label: 'crash', tone: 'accent' }
                  ],
                  xLabel: 'Duration', yLabel: 'Cost',
                  summary: typeof r.slope === 'number'
                    ? 'Compressing from ' + f2(v.normalDur) + ' to ' + f2(v.crashDur) +
                      ' costs ' + f2(r.slope) + ' per time unit saved — applies to this activity only, and only while it stays on the critical path.'
                    : 'Normal ' + f2(v.normalDur) + '/' + f2(v.normalCost) + ', crash ' + f2(v.crashDur) + '/' + f2(v.crashCost) + '.'
                };
              }
            }
          ]
        }
      ]
    },

    /* ---------------------------------------------- Resources & Team */
    {
      id: 'resources',
      name: 'Resources & Team',
      blurb: 'Turning effort estimates into headcount, and checking whether the people you have are quietly over-committed.',
      citation: 'Resources — PMI PMBOK Guide, Resource Management.',
      cards: [
        {
          id: 'fte',
          name: 'Full-time equivalents (FTE)',
          tagline: 'Effort ÷ capacity',
          about: 'FTE converts a pile of estimated effort into how many full-time people the work actually needs within a given window. One FTE is one person fully allocated. Use productive hours per period, not contract hours — meetings, support and admin eat 15–30% before project work starts.',
          formula: ['FTE = Effort hours ÷ (Productive hours per period × Periods)'],
          inputs: [
            { key: 'effort', label: 'Total effort (hours)', meaning: 'Estimated person-hours of work to deliver in the window.', placeholder: 'e.g. 2080' },
            { key: 'hoursPer', label: 'Productive hours / person / period', meaning: 'Hours one person can really spend on this work each period — e.g. 130 of a 160-hour month after overhead.', placeholder: 'e.g. 130' },
            { key: 'periods', label: 'Periods in the window', meaning: 'How many periods (months, sprints) the work is spread across.', placeholder: 'e.g. 4' }
          ],
          outputs: [
            {
              key: 'fte', label: 'FTE required', format: 'num',
              meaning: 'Full-time people the work demands over the window.',
              compute: function (v) { return ok(v.effort, v.hoursPer, v.periods) && v.hoursPer > 0 && v.periods > 0 ? v.effort / (v.hoursPer * v.periods) : null; },
              interpret: function () { return info('The fraction is where over-allocation hides — someone absorbs it.'); }
            },
            {
              key: 'headcount', label: 'Headcount (rounded up)', format: 'int',
              meaning: 'Whole people to staff if nobody can split across projects cleanly.',
              compute: function (v) { return ok(v.effort, v.hoursPer, v.periods) && v.hoursPer > 0 && v.periods > 0 ? Math.ceil(v.effort / (v.hoursPer * v.periods)) : null; },
              interpret: function () { return info('Rounding down means overtime; rounding up means slack — choose deliberately.'); }
            }
          ]
        },
        {
          id: 'utilization',
          name: 'Utilization',
          tagline: 'Allocated ÷ available',
          about: 'The share of a person’s available time already committed. Sustained utilization near 100% removes all slack: queues form, small surprises cascade, and cycle times explode (the queueing math behind this lives in Lean & Flow). Plan people like you plan servers — with headroom.',
          formula: ['Utilization % = Allocated hours ÷ Available hours × 100'],
          inputs: [
            { key: 'allocated', label: 'Allocated hours', meaning: 'Hours of committed work in the period across all assignments.', placeholder: 'e.g. 150' },
            { key: 'available', label: 'Available hours', meaning: 'Hours the person actually has in the period.', placeholder: 'e.g. 160' }
          ],
          outputs: [
            {
              key: 'util', label: 'Utilization', format: 'pct',
              meaning: 'Commitment level for the period.',
              compute: function (v) { return ok(v.allocated, v.available) && v.available > 0 ? (v.allocated / v.available) * 100 : null; },
              interpret: function (x) { return x > 100 ? bad('Over-allocated: something will slip, or quality will pay for it.') : x >= 85 ? warn('Little room for the unplanned — delays amplify above ~85%.') : good('Healthy margin for the unplanned.'); }
            },
            {
              key: 'slack', label: 'Uncommitted hours', format: 'num',
              meaning: 'Hours left for the work nobody predicted.',
              compute: function (v) { return ok(v.allocated, v.available) ? v.available - v.allocated : null; },
              interpret: function (x) { return x < 0 ? bad('Negative slack is unpaid overtime in disguise.') : info('Slack is capacity insurance, not waste.'); }
            }
          ],
          charts: [
            {
              title: 'Commitment level',
              purpose: 'Where utilization sits against the point delays start to amplify.',
              kind: 'meter',
              build: function (v, r) {
                if (typeof r.util !== 'number') return null;
                return {
                  value: r.util, min: 0, max: 120, target: 85, targetLabel: '~85% threshold',
                  zones: [
                    { from: 0, to: 85, tone: 'good', label: 'healthy margin' },
                    { from: 85, to: 100, tone: 'warn', label: 'thin' },
                    { from: 100, to: 120, tone: 'bad', label: 'over-allocated' }
                  ],
                  label: 'Utilization', valueFmt: function (n) { return n.toFixed(0) + '%'; },
                  tickFmt: function (n) { return n + '%'; },
                  summary: 'Committed to ' + f2(r.util) + '% of available hours' +
                    (r.util > 100 ? ' — already over-allocated.' : r.util >= 85 ? ', in the thin margin above 85%.' : ', with healthy headroom.')
                };
              }
            }
          ]
        },
        {
          id: 'labor-cost',
          name: 'Loaded labor cost',
          tagline: 'Rate × (1 + overhead)',
          about: 'A person’s cost to the project is never just their pay rate. The loaded (burdened) rate adds employer overhead — benefits, payroll taxes, equipment, facilities, licences — typically 25–50% on top. Budgets built on bare rates systematically understate cost and get discovered at the worst possible time.',
          formula: ['Loaded cost = Hours × Rate × (1 + Overhead %)'],
          inputs: [
            { key: 'hours', label: 'Effort (hours)', meaning: 'Person-hours of work being costed.', placeholder: 'e.g. 400' },
            { key: 'rate', label: 'Base rate (per hour)', meaning: 'The bare pay or contract rate before burden.', placeholder: 'e.g. 60' },
            { key: 'overhead', label: 'Overhead / burden (%)', meaning: 'Employer add-ons as a percentage of the base rate — ask finance; 25–50% is typical for employees.', placeholder: 'e.g. 35' }
          ],
          outputs: [
            {
              key: 'base', label: 'Base cost', format: 'money',
              meaning: 'Hours × bare rate — the number that looks deceptively affordable.',
              compute: function (v) { return ok(v.hours, v.rate) ? v.hours * v.rate : null; },
              interpret: function () { return info('What the budget shows when overhead is forgotten.'); }
            },
            {
              key: 'loaded', label: 'Loaded cost', format: 'money',
              meaning: 'The true cost to the organisation, burden included.',
              compute: function (v) { return ok(v.hours, v.rate, v.overhead) ? v.hours * v.rate * (1 + v.overhead / 100) : null; },
              interpret: function (x, v) { return ok(v.hours, v.rate) ? warn('The bare-rate budget understates this by ' + f2(x - v.hours * v.rate) + '.') : null; }
            },
            {
              key: 'loadedRate', label: 'Loaded hourly rate', format: 'money',
              meaning: 'The per-hour figure to use in every estimate.',
              compute: function (v) { return ok(v.rate, v.overhead) ? v.rate * (1 + v.overhead / 100) : null; },
              interpret: function () { return info('Use this, not the bare rate, when costing effort.'); }
            }
          ]
        }
      ]
    },

    /* -------------------------------------------------- Communication */
    {
      id: 'comms',
      name: 'Communication',
      blurb: 'Why adding “just one more person” is never cheap: the number of one-to-one communication paths grows with the square of team size.',
      citation: 'Communication — PMI PMBOK Guide, Communications Management.',
      cards: [
        {
          id: 'channels',
          name: 'Communication channels',
          tagline: 'n(n−1) ÷ 2',
          about: 'Every pair of people on a project is a potential communication path that can carry — or garble — information. This count is used to justify communication plans, meeting structures and why large stakeholder groups need formal channels. Count everyone who communicates about the project, including yourself and the sponsor.',
          formula: ['Channels = n × (n − 1) ÷ 2'],
          inputs: [
            { key: 'n', label: 'n — People now', meaning: 'Current number of people communicating on the project (team + stakeholders + you).', placeholder: 'e.g. 10' },
            { key: 'n2', label: 'People after change (optional)', meaning: 'Headcount after adding or removing members — to see how many channels the change creates.', placeholder: 'e.g. 15' }
          ],
          outputs: [
            {
              key: 'ch', label: 'Channels now', format: 'int',
              meaning: 'One-to-one paths that currently exist.',
              compute: function (v) { return ok(v.n) && v.n >= 0 ? v.n * (v.n - 1) / 2 : null; },
              interpret: function (x) { return x > 100 ? warn('Too many to manage informally — a structured communication plan is essential.') : info('Each path is a place information can distort.'); }
            },
            {
              key: 'ch2', label: 'Channels after change', format: 'int',
              meaning: 'Paths at the new headcount.',
              compute: function (v) { return ok(v.n2) && v.n2 >= 0 ? v.n2 * (v.n2 - 1) / 2 : null; },
              interpret: function () { return info('Compare against today.'); }
            },
            {
              key: 'delta', label: 'Channels added', format: 'int',
              meaning: 'New paths the headcount change creates — the hidden coordination cost.',
              compute: function (v) { return ok(v.n, v.n2) ? v.n2 * (v.n2 - 1) / 2 - v.n * (v.n - 1) / 2 : null; },
              interpret: function (x, v) { return x > 0 ? warn('Adding ' + f2(v.n2 - v.n) + ' people creates ' + f2(x) + ' new channels — onboarding and sync overhead grows.') : x < 0 ? good('Fewer channels: coordination gets simpler.') : info('No change.'); }
            }
          ],
          charts: [
            {
              title: 'Channel growth',
              purpose: 'Why one more person on a large team costs more coordination than on a small one.',
              kind: 'curve',
              build: function (v, r) {
                if (!ok(v.n) || v.n < 0 || v.n > 500 || (ok(v.n2) && (v.n2 < 0 || v.n2 > 500))) return null;
                var maxN = Math.max(20, Math.ceil((ok(v.n2) ? Math.max(v.n, v.n2) : v.n) * 1.3));
                var pts = [], i;
                for (i = 0; i <= maxN; i++) pts.push([i, i * (i - 1) / 2]);
                var markers = [{ x: v.n, y: v.n * (v.n - 1) / 2, label: 'now (' + v.n + ')', tone: 'accent' }];
                if (ok(v.n2)) markers.push({ x: v.n2, y: v.n2 * (v.n2 - 1) / 2, label: 'after (' + v.n2 + ')', tone: typeof r.delta === 'number' && r.delta > 0 ? 'warn' : 'good' });
                return {
                  series: [{ label: 'n(n−1)/2', points: pts, tone: 'accent' }],
                  markers: markers,
                  xLabel: 'People', yLabel: 'Communication channels', zeroBase: true,
                  summary: v.n + ' people create ' + f2(v.n * (v.n - 1) / 2) + ' channels' +
                    (ok(v.n2) ? '; ' + v.n2 + ' would create ' + f2(v.n2 * (v.n2 - 1) / 2) + ' — the curve steepens as the team grows.' : '.')
                };
              }
            }
          ]
        }
      ]
    },

    /* ----------------------------------------------------------- Risk */
    {
      id: 'risk',
      name: 'Risk',
      blurb: 'Quantitative risk analysis puts money on uncertainty so risks can be compared, prioritised and reserved for.',
      citation: 'Risk — PMI Risk Management in Portfolios, Programs, and Projects.',
      cards: [
        {
          id: 'emv',
          page: 'expected-monetary-value.html',
          name: 'Expected Monetary Value (EMV)',
          tagline: 'Probability × impact',
          about: 'EMV is the probability-weighted value of an uncertain event — what the risk is “worth” on average if you could run the project many times. Enter threats with a negative impact and opportunities with a positive one. Summing the EMV of every identified risk gives the contingency reserve; EMV is also the math behind decision-tree analysis.',
          formula: ['EMV = Probability × Impact'],
          inputs: [
            { key: 'p', label: 'Probability (%)', meaning: 'Likelihood the risk event actually occurs, from qualitative analysis or data. 0–100.', placeholder: 'e.g. 30' },
            { key: 'impact', label: 'Impact', meaning: 'Full monetary consequence if it occurs. Negative for threats (costs), positive for opportunities (gains).', placeholder: 'e.g. -50000' }
          ],
          outputs: [
            {
              key: 'emv', label: 'Expected Monetary Value', format: 'money',
              meaning: 'The amount to carry in the contingency reserve for this single risk.',
              compute: function (v) { return ok(v.p, v.impact) ? (v.p / 100) * v.impact : null; },
              interpret: function (x) { return x < 0 ? bad('A threat: reserve ' + f2(-x) + ' against it, or spend up to that amount on a response that removes it.') : x > 0 ? good('An opportunity worth pursuing if capturing it costs less than ' + f2(x) + '.') : info('No monetary exposure.'); }
            },
            {
              key: 'residual', label: 'Impact if it happens', format: 'money',
              meaning: 'Reminder: EMV is an average — if the event fires you feel the full impact, not the EMV.',
              compute: function (v) { return ok(v.impact) ? v.impact : null; },
              interpret: function () { return info('Reserves cover portfolios of risks, not single worst cases.'); }
            }
          ],
          charts: [
            {
              title: 'EMV against full exposure',
              purpose: 'The average outcome versus what actually happens if the event fires.',
              kind: 'rangeplot',
              build: function (v, r) {
                if (typeof r.emv !== 'number' || !ok(v.impact)) return null;
                var lo = Math.min(0, v.impact), hi = Math.max(0, v.impact);
                return {
                  bands: [{ from: lo, to: hi, tone: v.impact < 0 ? 'bad' : 'good', label: 'full impact range', hatch: true }],
                  marks: [
                    { at: 0, label: 'no event' },
                    { at: r.emv, label: 'EMV', strong: true },
                    { at: v.impact, label: 'if it fires' }
                  ],
                  summary: 'EMV is ' + f2(r.emv) + ', the probability-weighted average — but if the event actually fires, the effect is the full ' +
                    f2(v.impact) + ', not the average.'
                };
              }
            }
          ]
        },
        {
          id: 'risk-score',
          page: 'qualitative-risk-score.html',
          name: 'Qualitative risk score',
          tagline: 'Probability × impact, on a 1–5 scale',
          about: 'Before risks are worth quantifying in money, they are ranked qualitatively: rate probability and impact on an agreed 1–5 scale and multiply. The product places each risk in the probability–impact matrix and decides how much attention it gets. The scales are ordinal — a 4 is not “twice” a 2 — so use the score to rank, not to budget.',
          formula: ['Risk score = Probability (1–5) × Impact (1–5)'],
          inputs: [
            { key: 'p', label: 'Probability rating (1–5)', meaning: '1 = rare, 3 = possible, 5 = almost certain — per your organisation’s definitions.', placeholder: 'e.g. 4' },
            { key: 'i', label: 'Impact rating (1–5)', meaning: '1 = negligible, 3 = moderate, 5 = severe effect on objectives.', placeholder: 'e.g. 3' }
          ],
          outputs: [
            {
              key: 'score', label: 'Risk score', format: 'int',
              meaning: 'Position in the 25-cell probability–impact matrix.',
              compute: function (v) { return ok(v.p, v.i) ? v.p * v.i : null; },
              interpret: function (x) { return x >= 15 ? bad('High: plan a response now and assign an owner.') : x >= 8 ? warn('Moderate: watchlist with a named owner and trigger conditions.') : good('Low: accept and monitor at routine reviews.'); }
            }
          ],
          charts: [
            {
              title: 'Probability–impact matrix',
              purpose: 'Where this risk sits in the standard 5×5 grid.',
              kind: 'matrix',
              build: function (v, r) {
                if (!ok(v.p, v.i)) return null;
                return { p: v.p, i: v.i, size: 5 };
              }
            }
          ]
        },
        {
          id: 'contingency',
          name: 'Contingency reserve roll-up',
          tagline: 'Σ EMV across the risk register',
          about: 'Sum the expected monetary value of every identified risk and you get the contingency reserve — the funded buffer for known-unknowns, owned by the project manager. Enter matching lists: one probability and one impact per risk, threats negative, opportunities positive. (Unknown-unknowns are covered separately by management reserve, which sits outside the baseline.)',
          formula: ['Contingency reserve = − Σ (Probabilityᵢ × Impactᵢ)'],
          inputs: [
            { key: 'probs', label: 'Probabilities % (comma-separated)', meaning: 'Likelihood of each risk, in register order — e.g. 30, 10, 50.', placeholder: 'e.g. 30, 10, 50', type: 'text' },
            { key: 'impacts', label: 'Impacts (same order)', meaning: 'Monetary consequence of each risk: threats negative, opportunities positive.', placeholder: 'e.g. -50000, -20000, 10000', type: 'text' }
          ],
          outputs: [
            {
              key: 'netEmv', label: 'Net EMV of the register', format: 'money',
              meaning: 'Probability-weighted sum of all risks — usually negative when threats dominate.',
              compute: function (v) {
                var p = parseFlows(v.probs), im = parseFlows(v.impacts);
                if (!p || !im || p.length !== im.length) return null;
                var sum = 0;
                for (var i = 0; i < p.length; i++) sum += (p[i] / 100) * im[i];
                return sum;
              },
              interpret: function (x, v) {
                var p = parseFlows(v.probs), im = parseFlows(v.impacts);
                if (p && im && p.length !== im.length) return bad('Probability and impact lists must be the same length.');
                return x < 0 ? info('The register expects a net loss of ' + f2(-x) + ' — fund it.') : good('Opportunities outweigh threats on paper — verify the optimism.');
              }
            },
            {
              key: 'reserve', label: 'Suggested contingency reserve', format: 'money',
              meaning: 'The buffer to add to the cost baseline (zero if net EMV is positive).',
              compute: function (v) {
                var p = parseFlows(v.probs), im = parseFlows(v.impacts);
                if (!p || !im || p.length !== im.length) return null;
                var sum = 0;
                for (var i = 0; i < p.length; i++) sum += (p[i] / 100) * im[i];
                return Math.max(0, -sum);
              },
              interpret: function () { return info('An average across many futures — single big risks may need explicit response plans instead.'); }
            }
          ],
          charts: [
            {
              title: 'Register contribution',
              purpose: 'Which risks drive the reserve — each risk’s own EMV, side by side.',
              kind: 'bars',
              build: function (v, r) {
                var p = parseFlows(v.probs), im = parseFlows(v.impacts);
                if (!p || !im || p.length !== im.length || typeof r.netEmv !== 'number') return null;
                var series = p.map(function (pr, i) {
                  var e = (pr / 100) * im[i];
                  return { label: 'R' + (i + 1), value: e, tone: e < 0 ? 'bad' : e > 0 ? 'good' : 'neutral' };
                });
                return {
                  series: series,
                  catHead: 'Risk',
                  summary: 'Net EMV across the register is ' + f2(r.netEmv) +
                    (typeof r.reserve === 'number' && r.reserve > 0 ? '; suggested reserve ' + f2(r.reserve) + '.' : '.')
                };
              }
            }
          ]
        }
      ]
    },

    /* ----------------------------------------------- Decision Analysis */
    {
      id: 'decision',
      name: 'Decision Analysis',
      blurb: 'Choosing under uncertainty: a decision tree multiplies what each choice costs by what it might return, so competing options can be compared on expected value instead of gut feel.',
      citation: 'Decision — PMI PMBOK Guide, Decision Analysis.',
      cards: [
        {
          id: 'decision-tree',
          page: 'decision-tree.html',
          name: 'Decision tree — compare two options',
          tagline: 'EMV = −cost + p·payoff(success) + (1−p)·payoff(failure)',
          about: 'Each option is a branch: pay its cost, then chance decides between a success payoff and a failure payoff. The branch with the higher expected monetary value wins — on average. Classic uses: build vs buy, prototype vs commit, upgrade vs replace. Remember EMV is a long-run average; for one-shot, bet-the-company decisions, weigh the worst case too.',
          formula: [
            'EMV(option) = − Cost',
            '             + P(success) × Payoff(success)',
            '             + (1 − P) × Payoff(failure)'
          ],
          inputs: [
            { key: 'costA', label: 'Option A — cost', meaning: 'Upfront cost of choosing branch A.', placeholder: 'e.g. 40000' },
            { key: 'pA', label: 'Option A — P(success) %', meaning: 'Probability branch A succeeds.', placeholder: 'e.g. 60' },
            { key: 'winA', label: 'Option A — payoff if success', meaning: 'Value delivered when A succeeds.', placeholder: 'e.g. 100000' },
            { key: 'loseA', label: 'Option A — payoff if failure', meaning: 'Value (often 0, sometimes negative) when A fails.', placeholder: 'e.g. 0' },
            { key: 'costB', label: 'Option B — cost', meaning: 'Upfront cost of choosing branch B.', placeholder: 'e.g. 10000' },
            { key: 'pB', label: 'Option B — P(success) %', meaning: 'Probability branch B succeeds.', placeholder: 'e.g. 30' },
            { key: 'winB', label: 'Option B — payoff if success', meaning: 'Value delivered when B succeeds.', placeholder: 'e.g. 60000' },
            { key: 'loseB', label: 'Option B — payoff if failure', meaning: 'Value when B fails.', placeholder: 'e.g. 0' }
          ],
          outputs: [
            {
              key: 'emvA', label: 'EMV — Option A', format: 'money',
              meaning: 'Expected value of branch A after its cost.',
              compute: function (v) { return ok(v.costA, v.pA, v.winA, v.loseA) ? -v.costA + (v.pA / 100) * v.winA + (1 - v.pA / 100) * v.loseA : null; },
              interpret: function (x) { return x < 0 ? warn('Negative expectation — A only makes sense for non-monetary reasons.') : info('The long-run average outcome of choosing A.'); }
            },
            {
              key: 'emvB', label: 'EMV — Option B', format: 'money',
              meaning: 'Expected value of branch B after its cost.',
              compute: function (v) { return ok(v.costB, v.pB, v.winB, v.loseB) ? -v.costB + (v.pB / 100) * v.winB + (1 - v.pB / 100) * v.loseB : null; },
              interpret: function (x) { return x < 0 ? warn('Negative expectation — B only makes sense for non-monetary reasons.') : info('The long-run average outcome of choosing B.'); }
            },
            {
              key: 'verdict', label: 'Better option', format: 'text',
              meaning: 'The branch with the higher expected value, and by how much.',
              compute: function (v) {
                if (!ok(v.costA, v.pA, v.winA, v.loseA, v.costB, v.pB, v.winB, v.loseB)) return null;
                var a = -v.costA + (v.pA / 100) * v.winA + (1 - v.pA / 100) * v.loseA;
                var b = -v.costB + (v.pB / 100) * v.winB + (1 - v.pB / 100) * v.loseB;
                if (a === b) return 'Tie — decide on risk appetite';
                return (a > b ? 'Option A' : 'Option B') + ' by ' + f2(Math.abs(a - b));
              },
              interpret: function () { return info('The margin is the expected cost of choosing the weaker branch.'); }
            }
          ],
          charts: [
            {
              title: 'Expected value comparison',
              purpose: 'Which branch wins on average, and how wide a bet each one is.',
              kind: 'bars',
              build: function (v, r) {
                if (typeof r.emvA !== 'number' || typeof r.emvB !== 'number') return null;
                return {
                  series: [
                    { label: 'A', sub: 'EMV', value: r.emvA, tone: r.emvA >= r.emvB ? 'good' : 'neutral' },
                    { label: 'B', sub: 'EMV', value: r.emvB, tone: r.emvB > r.emvA ? 'good' : 'neutral' }
                  ],
                  refValue: 0, refLabel: 'break-even',
                  catHead: 'Option',
                  summary: 'Option A has an expected value of ' + f2(r.emvA) + ', option B ' + f2(r.emvB) +
                    ' — the higher figure wins on average, but EMV alone does not show which option is the wider bet.'
                };
              }
            }
          ]
        }
      ]
    },

    /* ----------------------------------------------------- Quality */
    {
      id: 'quality',
      name: 'Quality & Six Sigma',
      blurb: 'Quality math answers two questions: how often does the process fail (DPMO, sigma level) and is it drifting out of control (control limits)?',
      citation: 'Quality — ASQ Quality Resources and Six Sigma guidance.',
      cards: [
        {
          id: 'dpmo',
          name: 'DPMO & sigma level',
          tagline: 'Defects per million opportunities',
          about: 'DPMO normalizes defect counts by how many chances there were to fail, so processes of different complexity can be compared fairly. The sigma level restates DPMO on the Six Sigma scale (with the conventional 1.5σ shift): 3σ ≈ 66,800 defects per million, 4σ ≈ 6,210, 6σ ≈ 3.4.',
          formula: [
            'DPMO = Defects × 1,000,000 ÷ (Units × Opportunities per unit)',
            'Sigma level ≈ 0.8406 + √(29.37 − 2.221 × ln DPMO)'
          ],
          inputs: [
            { key: 'defects', label: 'Defects found', meaning: 'Total defects observed in the sample.', placeholder: 'e.g. 25' },
            { key: 'units', label: 'Units inspected', meaning: 'How many items, transactions or deliverables were checked.', placeholder: 'e.g. 1000' },
            { key: 'opps', label: 'Opportunities per unit', meaning: 'Distinct ways each unit could be defective — fields on a form, joints on an assembly.', placeholder: 'e.g. 4' }
          ],
          outputs: [
            {
              key: 'dpmo', label: 'DPMO', format: 'int',
              meaning: 'Defects expected per million opportunities at this rate.',
              compute: function (v) { return ok(v.defects, v.units, v.opps) && v.units > 0 && v.opps > 0 ? (v.defects * 1000000) / (v.units * v.opps) : null; },
              interpret: function (x) { return x <= 233 ? good('≈ 5σ or better — world class.') : x <= 6210 ? info('≈ 4σ territory — around industry average.') : x <= 66807 ? warn('≈ 3σ — significant rework cost.') : bad('Below 3σ — the process needs redesign, not inspection.'); }
            },
            {
              key: 'yield', label: 'Process yield', format: 'pct',
              meaning: 'Share of opportunities that pass defect-free.',
              compute: function (v) { return ok(v.defects, v.units, v.opps) && v.units > 0 && v.opps > 0 ? (1 - v.defects / (v.units * v.opps)) * 100 : null; },
              interpret: function () { return info('99% yield still means 10,000 defects per million.'); }
            },
            {
              key: 'sigma', label: 'Sigma level', format: 'ratio',
              meaning: 'The process capability on the Six Sigma scale, 1.5σ shift included.',
              compute: function (v) {
                if (!ok(v.defects, v.units, v.opps) || v.units <= 0 || v.opps <= 0) return null;
                var dpmo = (v.defects * 1000000) / (v.units * v.opps);
                if (dpmo === 0) return '≥ 6 (no observed defects)';
                var inner = 29.37 - 2.221 * Math.log(dpmo);
                return inner >= 0 ? 0.8406 + Math.sqrt(inner) : null;
              },
              interpret: function (x) { return typeof x === 'number' && x >= 6 ? good('Six Sigma performance.') : info('Approximation — accurate between roughly 1.5σ and 6σ.'); }
            }
          ],
          charts: [
            {
              title: 'Sigma level',
              purpose: 'Process performance on the Six Sigma scale.',
              kind: 'meter',
              build: function (v, r) {
                if (typeof r.sigma !== 'number') return null; /* r.sigma is a string at 0 defects — no chart then */
                return {
                  value: r.sigma, min: 1.5, max: 6.5,
                  zones: [
                    { from: 1.5, to: 3, tone: 'bad', label: 'redesign needed' },
                    { from: 3, to: 4, tone: 'warn', label: 'industry average' },
                    { from: 4, to: 6.5, tone: 'good', label: 'world class' }
                  ],
                  label: 'Sigma level', valueFmt: function (n) { return n.toFixed(2) + 'σ'; },
                  tickFmt: function (n) { return n.toFixed(1) + 'σ'; },
                  summary: 'The process runs at ' + f2(r.sigma) + 'σ, against ' + f2(v.defects) + ' defects observed in ' +
                    f2(v.units) + ' units.'
                };
              }
            }
          ]
        },
        {
          id: 'control',
          name: 'Control limits (±3σ)',
          tagline: 'UCL · LCL · warning zone',
          about: 'A control chart flags when a process leaves its normal noise band. The limits sit three standard deviations either side of the historical mean: a point outside them — or seven consecutive points on one side of the mean (the rule of seven) — signals the process is out of control and needs investigation, not tampering.',
          formula: ['UCL = Mean + 3σ        LCL = Mean − 3σ'],
          inputs: [
            { key: 'mean', label: 'Process mean', meaning: 'The long-run average of the measurement, from historical data.', placeholder: 'e.g. 50' },
            { key: 'sigma', label: 'Process σ', meaning: 'Standard deviation of the measurement under normal conditions.', placeholder: 'e.g. 2' }
          ],
          outputs: [
            {
              key: 'ucl', label: 'Upper control limit', format: 'num',
              meaning: 'Mean + 3σ — the ceiling of normal variation.',
              compute: function (v) { return ok(v.mean, v.sigma) ? v.mean + 3 * v.sigma : null; },
              interpret: function () { return info('Points above this are signals, not noise.'); }
            },
            {
              key: 'lcl', label: 'Lower control limit', format: 'num',
              meaning: 'Mean − 3σ — the floor of normal variation.',
              compute: function (v) { return ok(v.mean, v.sigma) ? v.mean - 3 * v.sigma : null; },
              interpret: function () { return info('“Too good” readings below the band deserve investigation too.'); }
            },
            {
              key: 'warnZone', label: 'Warning zone (±2σ)', format: 'text',
              meaning: 'Inner band where points are legal but worth watching.',
              compute: function (v) { return ok(v.mean, v.sigma) ? f2(v.mean - 2 * v.sigma) + ' – ' + f2(v.mean + 2 * v.sigma) : null; },
              interpret: function () { return info('Roughly 95% of in-control points should land inside this.'); }
            }
          ],
          charts: [
            {
              title: 'Control band',
              purpose: 'The mean, the ±2σ warning zone, and the ±3σ control limits on one axis.',
              kind: 'rangeplot',
              build: function (v, r) {
                if (typeof r.ucl !== 'number' || typeof r.lcl !== 'number' || !ok(v.mean, v.sigma)) return null;
                return {
                  bands: [
                    { from: v.mean - 2 * v.sigma, to: v.mean + 2 * v.sigma, tone: 'good', label: 'warning zone (±2σ)' },
                    { from: r.lcl, to: v.mean - 2 * v.sigma, tone: 'warn', label: 'LCL–2σ', hatch: true },
                    { from: v.mean + 2 * v.sigma, to: r.ucl, tone: 'warn', label: '2σ–UCL', hatch: true }
                  ],
                  marks: [
                    { at: r.lcl, label: 'LCL' }, { at: v.mean, label: 'mean', strong: true }, { at: r.ucl, label: 'UCL' }
                  ],
                  summary: 'Normal variation runs from ' + f2(r.lcl) + ' to ' + f2(r.ucl) +
                    '; a point outside that band is a signal, not noise.'
                };
              }
            }
          ]
        },
        {
          id: 'cpk',
          page: 'cpk-calculator.html',
          name: 'Process capability (Cp / Cpk)',
          tagline: 'Can the process meet the spec?',
          about: 'Control limits describe what the process does; specification limits describe what the customer needs. Capability indices compare the two. Cp asks whether the spec window is wide enough for the process spread (ignoring centering); Cpk penalises a process that drifts off-centre. The common acceptance bar is Cpk ≥ 1.33.',
          formula: [
            'Cp  = (USL − LSL) ÷ 6σ',
            'Cpk = min(USL − Mean, Mean − LSL) ÷ 3σ'
          ],
          inputs: [
            { key: 'usl', label: 'USL — upper spec limit', meaning: 'The highest value the customer or requirement accepts.', placeholder: 'e.g. 10' },
            { key: 'lsl', label: 'LSL — lower spec limit', meaning: 'The lowest acceptable value.', placeholder: 'e.g. 4' },
            { key: 'mean', label: 'Process mean', meaning: 'Where the process actually centres, from measurement data.', placeholder: 'e.g. 6' },
            { key: 'sigma', label: 'Process σ', meaning: 'Standard deviation of the process output.', placeholder: 'e.g. 0.5' }
          ],
          outputs: [
            {
              key: 'cp', label: 'Cp — potential capability', format: 'ratio',
              meaning: 'Spec width versus process spread, assuming perfect centering.',
              compute: function (v) { return ok(v.usl, v.lsl, v.sigma) && v.sigma > 0 ? (v.usl - v.lsl) / (6 * v.sigma) : null; },
              interpret: function (x) { return x >= 1.33 ? good('The spec window is comfortably wider than the spread.') : x >= 1 ? warn('Barely fits — any drift produces defects.') : bad('The process spread is wider than the spec — defects are guaranteed.'); }
            },
            {
              key: 'cpk', label: 'Cpk — actual capability', format: 'ratio',
              meaning: 'Capability including how far off-centre the process runs.',
              compute: function (v) { return ok(v.usl, v.lsl, v.mean, v.sigma) && v.sigma > 0 ? Math.min(v.usl - v.mean, v.mean - v.lsl) / (3 * v.sigma) : null; },
              interpret: function (x, v) {
                if (x >= 1.33) return good('Capable — meets the common ≥ 1.33 bar.');
                if (ok(v.usl, v.lsl, v.sigma) && v.sigma > 0 && (v.usl - v.lsl) / (6 * v.sigma) >= 1.33) return warn('Cp is fine but Cpk is not: the process is off-centre — re-centre before re-engineering.');
                return x >= 1 ? warn('Marginal — improvement needed.') : bad('Not capable of meeting the specification.');
              }
            }
          ],
          charts: [
            {
              title: 'Spec window vs process spread',
              purpose: 'Whether the ±3σ process spread fits inside the customer’s spec limits, and how centred it is.',
              kind: 'rangeplot',
              build: function (v, r) {
                if (!ok(v.usl, v.lsl, v.mean, v.sigma) || v.sigma <= 0) return null;
                return {
                  bands: [
                    { from: v.lsl, to: v.usl, tone: 'accent', label: 'specification (LSL–USL)' },
                    { from: v.mean - 3 * v.sigma, to: v.mean + 3 * v.sigma,
                      tone: typeof r.cpk === 'number' && r.cpk >= 1.33 ? 'good' : typeof r.cpk === 'number' && r.cpk >= 1 ? 'warn' : 'bad',
                      label: 'process spread (±3σ)', hatch: true }
                  ],
                  marks: [{ at: v.mean, label: 'process mean', strong: true }],
                  summary: typeof r.cp === 'number' && typeof r.cpk === 'number'
                    ? 'Cp ' + f2(r.cp) + ', Cpk ' + f2(r.cpk) +
                      (r.cpk >= 1.33 ? ' — the process spread sits comfortably inside the spec.'
                        : r.cp >= 1.33 ? ' — the spread would fit if the process were centred; it currently is not.'
                        : ' — the process spread is wider than the spec window.')
                    : ''
                };
              }
            }
          ]
        },
        {
          id: 'coq',
          name: 'Cost of Quality (CoQ)',
          tagline: 'Conformance vs failure spend',
          about: 'Everything quality costs, split into money spent on purpose and money lost to failure. Conformance costs are investments: prevention (training, standards, design reviews) and appraisal (testing, inspections, audits). Non-conformance costs are the bill for defects: internal failures (rework, scrap) and external ones (warranty, support, reputation). Mature organisations deliberately shift spend from the failure side to the prevention side.',
          formula: [
            'Conformance = Prevention + Appraisal',
            'Non-conformance = Internal failures + External failures',
            'CoQ = Conformance + Non-conformance'
          ],
          inputs: [
            { key: 'prevention', label: 'Prevention costs', meaning: 'Spent stopping defects from happening: training, standards, quality planning.', placeholder: 'e.g. 20000' },
            { key: 'appraisal', label: 'Appraisal costs', meaning: 'Spent finding defects early: testing, inspection, audits.', placeholder: 'e.g. 30000' },
            { key: 'internal', label: 'Internal failure costs', meaning: 'Defects caught before the customer: rework, scrap, retesting.', placeholder: 'e.g. 40000' },
            { key: 'external', label: 'External failure costs', meaning: 'Defects that reached the customer: warranty, incident response, lost business.', placeholder: 'e.g. 25000' }
          ],
          outputs: [
            {
              key: 'conformance', label: 'Cost of conformance', format: 'money',
              meaning: 'The deliberate investment in quality.',
              compute: function (v) { return ok(v.prevention, v.appraisal) ? v.prevention + v.appraisal : null; },
              interpret: function () { return info('Money spent on purpose, before defects exist.'); }
            },
            {
              key: 'nonconformance', label: 'Cost of non-conformance', format: 'money',
              meaning: 'The price of failure, internal and external.',
              compute: function (v) { return ok(v.internal, v.external) ? v.internal + v.external : null; },
              interpret: function () { return info('Usually understated — reputation and morale rarely get counted.'); }
            },
            {
              key: 'total', label: 'Total cost of quality', format: 'money',
              meaning: 'Everything quality costs, both sides combined.',
              compute: function (v) { return ok(v.prevention, v.appraisal, v.internal, v.external) ? v.prevention + v.appraisal + v.internal + v.external : null; },
              interpret: function () { return info('Often 15–25% of project cost when measured honestly.'); }
            },
            {
              key: 'failShare', label: 'Failure share of CoQ', format: 'pct',
              meaning: 'What portion of quality spend is failure rather than investment.',
              compute: function (v) {
                if (!ok(v.prevention, v.appraisal, v.internal, v.external)) return null;
                var total = v.prevention + v.appraisal + v.internal + v.external;
                return total > 0 ? ((v.internal + v.external) / total) * 100 : null;
              },
              interpret: function (x) { return x > 50 ? bad('Paying for failure more than prevention — shift spend upstream.') : x > 30 ? warn('Failure costs are significant — review where defects originate.') : good('Spend is weighted toward prevention, where it returns most.'); }
            }
          ],
          charts: [
            {
              title: 'Conformance vs failure spend',
              purpose: 'Where quality money goes — investment against the cost of failure.',
              kind: 'bars',
              build: function (v, r) {
                if (!ok(v.prevention, v.appraisal, v.internal, v.external)) return null;
                return {
                  series: [
                    { label: 'Prevention', value: v.prevention, tone: 'good' },
                    { label: 'Appraisal', value: v.appraisal, tone: 'good' },
                    { label: 'Internal fail', value: v.internal, tone: 'bad', hatch: true },
                    { label: 'External fail', value: v.external, tone: 'bad', hatch: true }
                  ],
                  catHead: 'Category',
                  summary: typeof r.failShare === 'number'
                    ? 'Failure costs are ' + f2(r.failShare) + '% of total quality spend of ' + f2(r.total) + '.'
                    : ''
                };
              }
            }
          ]
        }
      ]
    },

    /* ------------------------------------------------------ Financial */
    {
      id: 'financial',
      name: 'Project Selection & Finance',
      blurb: 'The business-case math used to choose between projects and to prove a project was worth doing. Rule of thumb across all of these: money later is worth less than money now.',
      citation: 'Finance — PMI PMBOK Guide, Project Finance and Benefits.',
      cards: [
        {
          id: 'roi',
          page: 'roi-calculator.html',
          name: 'Return on Investment (ROI)',
          tagline: '(Benefit − Cost) ÷ Cost',
          about: 'The simplest project-selection measure: how much you get back per unit invested, ignoring timing. Good for quick comparisons; misleading for long projects because it ignores when the money arrives — use NPV for that.',
          formula: ['ROI % = (Benefit − Cost) ÷ Cost × 100'],
          inputs: [
            { key: 'cost', label: 'Total cost', meaning: 'Everything invested in the project: build, licences, labour, run costs over the horizon you are measuring.', placeholder: 'e.g. 200000' },
            { key: 'benefit', label: 'Total benefit', meaning: 'Total value returned over the same horizon: revenue, savings, avoided costs.', placeholder: 'e.g. 260000' }
          ],
          outputs: [
            {
              key: 'roi', label: 'ROI', format: 'pct',
              meaning: 'Percentage return over the whole horizon (not per year).',
              compute: function (v) { return ok(v.cost, v.benefit) && v.cost !== 0 ? ((v.benefit - v.cost) / v.cost) * 100 : null; },
              interpret: function (x) { return x > 0 ? good('Positive return — compare against alternatives before committing.') : x < 0 ? bad('Destroys value as scoped.') : info('Break-even.'); }
            },
            {
              key: 'net', label: 'Net benefit', format: 'money',
              meaning: 'Absolute value created: benefit minus cost.',
              compute: function (v) { return ok(v.cost, v.benefit) ? v.benefit - v.cost : null; },
              interpret: function () { return info('A small % on a huge base can beat a big % on a tiny one.'); }
            }
          ]
        },
        {
          id: 'npv',
          page: 'npv-irr-payback.html',
          name: 'NPV · IRR · Payback',
          tagline: 'Discounted cash-flow appraisal',
          about: 'The rigorous way to value a project: every future cash flow is discounted back to today because money later is worth less than money now. NPV is the value created in today’s money; IRR is the discount rate at which the project merely breaks even; payback tells you how long capital is at risk. When choosing between projects, pick the higher NPV.',
          formula: [
            'NPV = −Investment + Σ  CFₜ ÷ (1 + r)ᵗ',
            'IRR: the r where NPV = 0',
            'Payback: periods until cumulative cash flow ≥ 0'
          ],
          inputs: [
            { key: 'rate', label: 'Discount rate (%)', meaning: 'Cost of capital or required return per period — the hurdle the project must beat.', placeholder: 'e.g. 10' },
            { key: 'inv', label: 'Initial investment', meaning: 'Cash out at period 0, entered as a positive number.', placeholder: 'e.g. 1000' },
            { key: 'flows', label: 'Cash flows (comma-separated)', meaning: 'Net cash in (or out, negative) for each following period, in order: period 1, 2, 3…', placeholder: 'e.g. 500, 500, 500', type: 'text' }
          ],
          outputs: [
            {
              key: 'npv', label: 'Net Present Value', format: 'money',
              meaning: 'Value created in today’s money after paying back capital and the required return.',
              compute: function (v) {
                var flows = parseFlows(v.flows);
                return ok(v.rate, v.inv) && flows ? npvOf(v.rate / 100, v.inv, flows) : null;
              },
              interpret: function (x) { return x > 0 ? good('Accept: creates value beyond the required return.') : x < 0 ? bad('Reject: fails to earn the discount rate.') : info('Exactly earns the required return.'); }
            },
            {
              key: 'irr', label: 'Internal Rate of Return', format: 'pct',
              meaning: 'The project’s intrinsic return per period. Compare it to the discount rate. Reliable only for conventional flows — one outlay followed by inflows. If the signs change more than once, IRR can have several answers or none, and NPV is the measure to trust.',
              compute: function (v) {
                var flows = parseFlows(v.flows);
                return ok(v.inv) && flows ? irrOf(v.inv, flows) : null;
              },
              interpret: function (x, v) { return ok(v.rate) ? (x > v.rate ? good('Beats the ' + f2(v.rate) + '% hurdle rate.') : bad('Below the hurdle rate.')) : info('Compare with your cost of capital.'); }
            },
            {
              key: 'bcr', label: 'Benefit–Cost Ratio', format: 'ratio',
              meaning: 'Present value of the future net cash flows per unit invested — net, so a negative period nets off rather than counting as a benefit. Above 1 means benefits outweigh costs.',
              compute: function (v) {
                var flows = parseFlows(v.flows);
                if (!ok(v.rate, v.inv) || !flows || v.inv === 0) return null;
                var npv = npvOf(v.rate / 100, v.inv, flows);
                return npv !== null ? (npv + v.inv) / v.inv : null;
              },
              interpret: function (x) { return x > 1 ? good('Each 1.00 invested returns ' + f2(x) + ' in present value.') : bad('Returns less than it costs.'); }
            },
            {
              key: 'payback', label: 'Payback period', format: 'text',
              meaning: 'Periods until the undiscounted cash recovers the investment — a measure of capital risk, not profitability.',
              compute: function (v) {
                var flows = parseFlows(v.flows);
                if (!ok(v.inv) || !flows) return null;
                var cum = -v.inv;
                if (cum >= 0) return '0 periods';
                for (var i = 0; i < flows.length; i++) {
                  if (cum + flows[i] >= 0 && flows[i] > 0) {
                    return f2(i + (-cum) / flows[i]) + ' periods';
                  }
                  cum += flows[i];
                }
                return 'Not recovered in ' + flows.length + ' periods';
              },
              interpret: function () { return warn('Ignores everything after recovery and the time value of money — never use alone.'); }
            }
          ],
          charts: [
            {
              title: 'Cumulative cash flow',
              purpose: 'Discounted against undiscounted — where the project actually breaks even.',
              kind: 'curve',
              build: function (v, r) {
                var flows = parseFlows(v.flows);
                if (!ok(v.rate, v.inv) || !flows || !flows.length) return null;
                var undis = [[0, -v.inv]], dis = [[0, -v.inv]];
                var cu = -v.inv, cd = -v.inv, t;
                for (t = 0; t < flows.length; t++) {
                  cu += flows[t];
                  cd += flows[t] / Math.pow(1 + v.rate / 100, t + 1);
                  undis.push([t + 1, cu]);
                  dis.push([t + 1, cd]);
                }
                var markers = [];
                var pbMatch = typeof r.payback === 'string' && /^([\d.]+) periods$/.exec(r.payback);
                if (pbMatch) markers.push({ x: parseFloat(pbMatch[1]), y: 0, label: 'payback', tone: 'accent' });
                return {
                  series: [
                    { label: 'Undiscounted', points: undis, tone: 'neutral', style: 'dashed' },
                    { label: 'Discounted', points: dis, tone: 'accent', style: 'solid' }
                  ],
                  markers: markers,
                  refY: 0, refLabel: 'break-even',
                  xLabel: 'Period', yLabel: 'Cumulative cash flow', zeroBase: true,
                  summary: typeof r.npv === 'number'
                    ? 'Discounted cumulative cash flow ends at ' + f2(r.npv) + ' in today’s money' +
                      (typeof r.payback === 'string' ? '; undiscounted capital is recovered at ' + r.payback + '.' : '.')
                    : ''
                };
              }
            }
          ]
        },
        {
          id: 'tvm',
          name: 'Present & Future Value',
          tagline: 'FV = PV(1 + r)ⁿ',
          about: 'The time-value-of-money primitive behind NPV. Future value answers “what will this be worth after n periods of compounding?”; present value answers the reverse: “what is a promised future amount worth today?”. Both outputs are computed from the single amount you enter.',
          formula: ['FV = Amount × (1 + r)ⁿ', 'PV = Amount ÷ (1 + r)ⁿ'],
          inputs: [
            { key: 'amount', label: 'Amount', meaning: 'The sum of money to move through time.', placeholder: 'e.g. 10000' },
            { key: 'rate', label: 'Rate per period (%)', meaning: 'Interest or discount rate for each compounding period.', placeholder: 'e.g. 8' },
            { key: 'n', label: 'Periods (n)', meaning: 'Number of compounding periods — years if the rate is annual.', placeholder: 'e.g. 5' }
          ],
          outputs: [
            {
              key: 'fv', label: 'Future value', format: 'money',
              meaning: 'What the amount grows to if invested today at the given rate.',
              compute: function (v) {
                if (!ok(v.amount, v.rate, v.n) || v.rate <= -100) return null;
                var r = v.amount * Math.pow(1 + v.rate / 100, v.n);
                return Number.isFinite(r) ? r : null;
              },
              interpret: function () { return info('Treats the amount as invested today.'); }
            },
            {
              key: 'pv', label: 'Present value', format: 'money',
              meaning: 'What a payment of that amount, received n periods from now, is worth today.',
              compute: function (v) {
                if (!ok(v.amount, v.rate, v.n) || v.rate <= -100) return null;
                var base = Math.pow(1 + v.rate / 100, v.n);
                if (base === 0) return null;
                var r = v.amount / base;
                return Number.isFinite(r) ? r : null;
              },
              interpret: function () { return info('Treats the amount as received in the future.'); }
            },
            {
              key: 'doubling', label: 'Doubling time (Rule of 72)', format: 'num',
              meaning: '72 ÷ rate: the mental-math shortcut for how many periods money takes to double.',
              compute: function (v) { return ok(v.rate) && v.rate > 0 ? 72 / v.rate : null; },
              interpret: function () { return info('Approximation — accurate within ~2% for rates between 4% and 15%.'); }
            }
          ]
        },
        {
          id: 'breakeven',
          name: 'Break-even point',
          tagline: 'Fixed costs ÷ contribution margin',
          about: 'How many units (or billable hours, or subscriptions) you must sell before the venture stops losing money. The denominator — price minus variable cost — is the contribution margin: what each unit contributes toward covering fixed costs.',
          formula: ['Break-even units = Fixed costs ÷ (Price − Variable cost per unit)'],
          inputs: [
            { key: 'fixed', label: 'Fixed costs', meaning: 'Costs that exist regardless of volume: rent, salaries, licences, the project build itself.', placeholder: 'e.g. 50000' },
            { key: 'price', label: 'Price per unit', meaning: 'Revenue received for each unit sold.', placeholder: 'e.g. 25' },
            { key: 'varCost', label: 'Variable cost per unit', meaning: 'Cost incurred for each additional unit: materials, transaction fees, support.', placeholder: 'e.g. 15' }
          ],
          outputs: [
            {
              key: 'units', label: 'Break-even units', format: 'num',
              meaning: 'Volume at which total revenue equals total cost.',
              compute: function (v) { return ok(v.fixed, v.price, v.varCost) && (v.price - v.varCost) > 0 ? v.fixed / (v.price - v.varCost) : null; },
              interpret: function () { return info('Every unit beyond this is profit; every unit short is loss.'); }
            },
            {
              key: 'revenue', label: 'Break-even revenue', format: 'money',
              meaning: 'The revenue level at that volume.',
              compute: function (v) { return ok(v.fixed, v.price, v.varCost) && (v.price - v.varCost) > 0 ? (v.fixed / (v.price - v.varCost)) * v.price : null; },
              interpret: function () { return info('Sanity-check against realistic market size.'); }
            },
            {
              key: 'margin', label: 'Contribution margin / unit', format: 'money',
              meaning: 'Price − variable cost: what each sale contributes to fixed costs.',
              compute: function (v) { return ok(v.price, v.varCost) ? v.price - v.varCost : null; },
              interpret: function (x) { return x <= 0 ? bad('Non-positive margin: no volume can ever break even.') : info('Higher margin means fewer units to break even.'); }
            }
          ],
          charts: [
            {
              title: 'Revenue vs cost',
              purpose: 'Where the revenue line crosses total cost.',
              kind: 'curve',
              build: function (v, r) {
                if (!ok(v.fixed, v.price, v.varCost) || v.price - v.varCost <= 0 || typeof r.units !== 'number') return null;
                var maxU = r.units * 2;
                var rev = [[0, 0], [maxU, v.price * maxU]];
                var cost = [[0, v.fixed], [maxU, v.fixed + v.varCost * maxU]];
                return {
                  series: [
                    { label: 'Revenue', points: rev, tone: 'good' },
                    { label: 'Total cost', points: cost, tone: 'neutral', style: 'dashed' }
                  ],
                  markers: [{ x: r.units, y: r.revenue, label: 'break-even', tone: 'accent' }],
                  xLabel: 'Units', yLabel: 'Amount', zeroBase: true,
                  summary: 'Revenue overtakes total cost at ' + f2(r.units) + ' units (' + f2(r.revenue) + ' of revenue).'
                };
              }
            }
          ]
        },
        {
          id: 'depreciation',
          name: 'Straight-line depreciation',
          tagline: '(Cost − Salvage) ÷ Useful life',
          about: 'Spreads an asset’s cost evenly across its useful life — the depreciation method assumed in PMP exam questions and the simplest for business cases that must account for capital assets.',
          formula: ['Annual depreciation = (Cost − Salvage value) ÷ Useful life'],
          inputs: [
            { key: 'cost', label: 'Purchase cost', meaning: 'What the asset costs to acquire and put into service.', placeholder: 'e.g. 120000' },
            { key: 'salvage', label: 'Salvage value', meaning: 'Expected resale or scrap value at the end of its useful life.', placeholder: 'e.g. 20000' },
            { key: 'life', label: 'Useful life (years)', meaning: 'How many years the asset will be productive.', placeholder: 'e.g. 5' }
          ],
          outputs: [
            {
              key: 'annual', label: 'Depreciation per year', format: 'money',
              meaning: 'The expense recognised each year of the asset’s life.',
              compute: function (v) { return ok(v.cost, v.salvage, v.life) && v.life > 0 ? (v.cost - v.salvage) / v.life : null; },
              interpret: function () { return info('Same amount every year — that is the “straight line”.'); }
            },
            {
              key: 'ratePct', label: 'Depreciation rate', format: 'pct',
              meaning: 'Share of the depreciable base expensed each year: 1 ÷ life.',
              compute: function (v) { return ok(v.life) && v.life > 0 ? 100 / v.life : null; },
              interpret: function () { return info('Applied to (cost − salvage).'); }
            }
          ]
        },
        {
          id: 'scoring',
          name: 'Weighted scoring model',
          tagline: 'Σ (weight × score)',
          about: 'The standard way to compare options against several criteria at once: weight each criterion by importance, score the option against each, and sum weight × score. Run it once per option and compare the totals. Its real value is political — the weights force stakeholders to argue about priorities before the decision, not after it.',
          formula: ['Weighted score = Σ (weightᵢ × scoreᵢ) ÷ Σ weightᵢ'],
          inputs: [
            { key: 'weights', label: 'Criteria weights (comma-separated)', meaning: 'Importance of each criterion, any scale — e.g. strategic fit 5, cost 3, risk 2.', placeholder: 'e.g. 5, 3, 2', type: 'text' },
            { key: 'scores', label: 'Option scores (same order)', meaning: 'How this option rates on each criterion, on your scoring scale (say 1–10), in the same order as the weights.', placeholder: 'e.g. 8, 6, 9', type: 'text' }
          ],
          outputs: [
            {
              key: 'weighted', label: 'Weighted score', format: 'num',
              meaning: 'The option’s weighted average on your scoring scale — directly comparable across options.',
              compute: function (v) {
                var w = parseFlows(v.weights), s = parseFlows(v.scores);
                if (!w || !s || w.length !== s.length) return null;
                var sw = 0, total = 0;
                for (var i = 0; i < w.length; i++) { sw += w[i]; total += w[i] * s[i]; }
                return sw > 0 ? total / sw : null;
              },
              interpret: function () { return info('Meaningless alone — compare against the other options’ totals.'); }
            },
            {
              key: 'raw', label: 'Raw weighted total', format: 'num',
              meaning: 'The unnormalized Σ weight × score, as many textbooks present it.',
              compute: function (v) {
                var w = parseFlows(v.weights), s = parseFlows(v.scores);
                if (!w || !s || w.length !== s.length) return null;
                var total = 0;
                for (var i = 0; i < w.length; i++) total += w[i] * s[i];
                return total;
              },
              interpret: function (x, v) {
                var w = parseFlows(v.weights), s = parseFlows(v.scores);
                return w && s && w.length !== s.length ? bad('Weights and scores must have the same number of entries.') : info('Same ranking as the weighted average, different scale.');
              }
            }
          ],
          charts: [
            {
              title: 'Weighted contribution',
              purpose: 'Each criterion’s share of the total score — the weights, made visible.',
              kind: 'bars',
              build: function (v, r) {
                var w = parseFlows(v.weights), s = parseFlows(v.scores);
                if (!w || !s || w.length !== s.length || typeof r.raw !== 'number') return null;
                var series = w.map(function (wt, i) {
                  return { label: 'C' + (i + 1), sub: 'w' + wt, value: wt * s[i], tone: 'accent' };
                });
                return {
                  series: series,
                  catHead: 'Criterion',
                  summary: 'Weighted total ' + f2(r.raw) + (typeof r.weighted === 'number' ? ' (weighted average ' + f2(r.weighted) + ' on the original scoring scale).' : '.')
                };
              }
            }
          ]
        }
      ]
    },

    /* ---------------------------------------------------- Procurement */
    {
      id: 'procurement',
      name: 'Procurement & Contracts',
      blurb: 'The math of incentive contracts (FPIF): buyer and seller share cost savings and overruns by an agreed ratio — until the point of total assumption, where the seller carries every extra dollar alone.',
      citation: 'Procurement — PMI PMBOK Guide, Procurement Management.',
      cards: [
        {
          id: 'pta',
          name: 'Point of Total Assumption (PTA)',
          tagline: 'Where the seller starts paying for overruns',
          about: 'In a Fixed-Price-Incentive-Fee contract, cost overruns are shared according to the buyer/seller ratio only up to the ceiling price. The PTA is the actual-cost level at which the buyer’s share of the overrun has consumed the room up to the ceiling; beyond it, every additional dollar of cost comes out of the seller’s fee. Sellers manage hard to stay below it.',
          formula: ['PTA = (Ceiling price − Target price) ÷ Buyer share + Target cost'],
          inputs: [
            { key: 'ceiling', label: 'Ceiling price', meaning: 'The maximum the buyer will ever pay, regardless of cost.', placeholder: 'e.g. 180000' },
            { key: 'targetPrice', label: 'Target price', meaning: 'Target cost + target fee: what both parties expect the buyer to pay.', placeholder: 'e.g. 165000' },
            { key: 'targetCost', label: 'Target cost', meaning: 'The cost both parties negotiated as the expected outcome.', placeholder: 'e.g. 150000' },
            { key: 'buyerShare', label: 'Buyer share (%)', meaning: 'Buyer’s portion of the share ratio. An “80/20 split” means the buyer covers 80% of overruns — enter 80.', placeholder: 'e.g. 80' }
          ],
          outputs: [
            {
              key: 'pta', label: 'Point of Total Assumption', format: 'money',
              meaning: 'The actual cost at which the seller assumes all further overrun.',
              compute: function (v) { return ok(v.ceiling, v.targetPrice, v.targetCost, v.buyerShare) && v.buyerShare > 0 ? (v.ceiling - v.targetPrice) / (v.buyerShare / 100) + v.targetCost : null; },
              interpret: function () { return warn('Above this cost, each extra dollar reduces the seller’s fee dollar-for-dollar.'); }
            },
            {
              key: 'headroom', label: 'Overrun absorbed before PTA', format: 'money',
              meaning: 'How much the cost can overrun target before the PTA is reached.',
              compute: function (v) { return ok(v.ceiling, v.targetPrice, v.targetCost, v.buyerShare) && v.buyerShare > 0 ? (v.ceiling - v.targetPrice) / (v.buyerShare / 100) : null; },
              interpret: function () { return info('Shared per the ratio inside this band.'); }
            }
          ],
          charts: [
            {
              title: 'Shared-risk band',
              purpose: 'Target cost, the point of total assumption, and the ceiling on one cost axis.',
              kind: 'rangeplot',
              build: function (v, r) {
                if (typeof r.pta !== 'number' || !ok(v.targetCost, v.ceiling)) return null;
                return {
                  bands: [
                    { from: v.targetCost, to: r.pta, tone: 'good', label: 'shared per ' + v.buyerShare + '/' + (100 - v.buyerShare) },
                    { from: r.pta, to: v.ceiling, tone: 'bad', label: 'seller alone', hatch: true }
                  ],
                  marks: [
                    { at: v.targetCost, label: 'target cost' },
                    { at: r.pta, label: 'PTA', strong: true },
                    { at: v.ceiling, label: 'ceiling' }
                  ],
                  summary: 'Costs are shared ' + v.buyerShare + '/' + (100 - v.buyerShare) +
                    ' up to ' + f2(r.pta) + '; every dollar above that comes out of the seller’s fee alone, up to the ' +
                    f2(v.ceiling) + ' ceiling.'
                };
              }
            }
          ]
        },
        {
          id: 'fpif',
          name: 'FPIF final fee & price',
          tagline: 'Settling an incentive contract',
          about: 'When the work is done, the incentive formula converts the cost outcome into the seller’s final fee: the seller keeps its share of any saving and gives up its share of any overrun. If a ceiling price is set, the buyer never pays more than it.',
          formula: [
            'Final fee = Target fee + (Target cost − Actual cost) × Seller share',
            'If the ceiling binds: Final fee = Ceiling price − Actual cost',
            'Final price = min(Actual cost + Final fee, Ceiling price)'
          ],
          inputs: [
            { key: 'targetCost', label: 'Target cost', meaning: 'Negotiated expected cost of the work.', placeholder: 'e.g. 150000' },
            { key: 'targetFee', label: 'Target fee', meaning: 'Profit the seller earns if actual cost exactly equals target cost.', placeholder: 'e.g. 15000' },
            { key: 'actualCost', label: 'Actual cost', meaning: 'What the work really cost the seller.', placeholder: 'e.g. 140000' },
            { key: 'sellerShare', label: 'Seller share (%)', meaning: 'Seller’s portion of the ratio. In an 80/20 split, enter 20.', placeholder: 'e.g. 20' },
            { key: 'ceiling', label: 'Ceiling price (optional)', meaning: 'Contract maximum — caps what the buyer pays.', placeholder: 'e.g. 180000' }
          ],
          outputs: [
            {
              key: 'finalFee', label: 'Final fee', format: 'money',
              meaning: 'Seller’s profit after applying the incentive share. Once the ceiling binds, the fee erodes dollar for dollar with the overrun and can go negative.',
              /* The share formula alone keeps paying a fee past the ceiling, which
                 contradicts the capped price sitting next to it: the buyer stops at
                 the ceiling, so beyond that point every further dollar of cost comes
                 straight out of the seller. Settle the fee at Ceiling − Actual cost. */
              compute: function (v) {
                if (!ok(v.targetCost, v.targetFee, v.actualCost, v.sellerShare)) return null;
                var fee = v.targetFee + (v.targetCost - v.actualCost) * (v.sellerShare / 100);
                return ok(v.ceiling) ? Math.min(fee, v.ceiling - v.actualCost) : fee;
              },
              interpret: function (x, v) { return !ok(v.targetFee) ? null : x < 0 ? bad('Past the ceiling the fee is gone and now negative — the seller is funding the overrun out of its own pocket.') : x > v.targetFee ? good('Seller beat target cost and earns an incentive bonus.') : x < v.targetFee ? bad('Overrun reduced the seller’s fee.') : info('Cost exactly on target.'); }
            },
            {
              key: 'finalPrice', label: 'Final price (buyer pays)', format: 'money',
              meaning: 'Actual cost plus final fee, capped at the ceiling if one is set.',
              compute: function (v) {
                if (!ok(v.targetCost, v.targetFee, v.actualCost, v.sellerShare)) return null;
                var price = v.actualCost + v.targetFee + (v.targetCost - v.actualCost) * (v.sellerShare / 100);
                return ok(v.ceiling) ? Math.min(price, v.ceiling) : price;
              },
              interpret: function (x, v) { return ok(v.ceiling) && x >= v.ceiling ? warn('Ceiling reached — the seller absorbs everything above it.') : info('Within the shared-risk band.'); }
            }
          ],
          charts: [
            {
              title: 'Final price vs actual cost',
              purpose: 'The slope changes at the PTA and flattens at the ceiling — that bend is where seller risk changes.',
              kind: 'curve',
              build: function (v, r) {
                if (typeof r.finalPrice !== 'number' || !ok(v.targetCost, v.targetFee, v.sellerShare)) return null;
                var lo = Math.min(v.actualCost, v.targetCost) * 0.7;
                var hi = ok(v.ceiling) ? v.ceiling * 1.15 : Math.max(v.actualCost, v.targetCost) * 1.6;
                var N = 40, pts = [], i, ac, price;
                for (i = 0; i <= N; i++) {
                  ac = lo + (hi - lo) * (i / N);
                  price = ac + v.targetFee + (v.targetCost - ac) * (v.sellerShare / 100);
                  if (ok(v.ceiling)) price = Math.min(price, v.ceiling);
                  pts.push([ac, price]);
                }
                return {
                  series: [{ label: 'Final price', points: pts, tone: 'accent' }],
                  markers: [{ x: v.actualCost, y: r.finalPrice, label: 'entered cost', tone: 'accent' }],
                  refY: ok(v.ceiling) ? v.ceiling : undefined, refLabel: ok(v.ceiling) ? 'ceiling' : undefined,
                  xLabel: 'Actual cost', yLabel: 'Final price',
                  summary: 'Seller share ' + v.sellerShare + '% of the delta from target cost. At the entered actual cost of ' +
                    f2(v.actualCost) + ', the buyer pays ' + f2(r.finalPrice) +
                    (ok(v.ceiling) && r.finalPrice >= v.ceiling ? ' — the ceiling is reached.' : '.')
                };
              }
            }
          ]
        },
        {
          id: 'cpif',
          name: 'CPIF final fee & price',
          tagline: 'Cost-plus with a bounded incentive',
          about: 'In a Cost-Plus-Incentive-Fee contract the buyer reimburses all allowable costs, but the seller’s fee moves with performance: it grows when the seller beats the target cost and shrinks on overruns, always clamped between a negotiated minimum and maximum fee. Unlike FPIF there is no ceiling price — cost risk stays mostly with the buyer, which is why CPIF suits work too uncertain to fix-price.',
          formula: [
            'Fee = Target fee + (Target cost − Actual cost) × Seller share',
            'Final fee = clamp(Fee, Min fee, Max fee)',
            'Final price = Actual cost + Final fee'
          ],
          inputs: [
            { key: 'targetCost', label: 'Target cost', meaning: 'Negotiated expected cost of the work.', placeholder: 'e.g. 100000' },
            { key: 'targetFee', label: 'Target fee', meaning: 'Fee the seller earns if cost lands exactly on target.', placeholder: 'e.g. 10000' },
            { key: 'actualCost', label: 'Actual cost', meaning: 'What the work really cost — fully reimbursed by the buyer.', placeholder: 'e.g. 90000' },
            { key: 'sellerShare', label: 'Seller share (%)', meaning: 'Seller’s portion of the share ratio. In an 80/20 split, enter 20.', placeholder: 'e.g. 20' },
            { key: 'minFee', label: 'Minimum fee (optional)', meaning: 'Fee floor — the least the seller can earn however badly cost overruns.', placeholder: 'e.g. 4000' },
            { key: 'maxFee', label: 'Maximum fee (optional)', meaning: 'Fee ceiling — the most the seller can earn however well it performs.', placeholder: 'e.g. 15000' }
          ],
          outputs: [
            {
              key: 'fee', label: 'Final fee', format: 'money',
              meaning: 'Incentive-adjusted fee, clamped to the min/max band if provided.',
              compute: function (v) {
                if (!ok(v.targetCost, v.targetFee, v.actualCost, v.sellerShare)) return null;
                var fee = v.targetFee + (v.targetCost - v.actualCost) * (v.sellerShare / 100);
                if (ok(v.maxFee)) fee = Math.min(fee, v.maxFee);
                if (ok(v.minFee)) fee = Math.max(fee, v.minFee);
                return fee;
              },
              interpret: function (x, v) {
                if (ok(v.maxFee) && x >= v.maxFee) return warn('Capped at the maximum fee — further savings earn the seller nothing.');
                if (ok(v.minFee) && x <= v.minFee) return warn('Floored at the minimum fee — further overruns cost the seller nothing.');
                return ok(v.targetFee) ? (x > v.targetFee ? good('Seller beat the target cost and earns a bonus.') : x < v.targetFee ? bad('Overrun reduced the seller’s fee.') : info('Cost exactly on target.')) : null;
              }
            },
            {
              key: 'price', label: 'Final price (buyer pays)', format: 'money',
              meaning: 'Reimbursed actual cost plus the final fee — no ceiling in CPIF.',
              compute: function (v) {
                if (!ok(v.targetCost, v.targetFee, v.actualCost, v.sellerShare)) return null;
                var fee = v.targetFee + (v.targetCost - v.actualCost) * (v.sellerShare / 100);
                if (ok(v.maxFee)) fee = Math.min(fee, v.maxFee);
                if (ok(v.minFee)) fee = Math.max(fee, v.minFee);
                return v.actualCost + fee;
              },
              interpret: function () { return info('Once the fee hits its floor, every extra cost dollar passes straight to the buyer.'); }
            }
          ],
          charts: [
            {
              title: 'Seller fee vs actual cost',
              purpose: 'The fee moves with performance, then clamps flat at the negotiated floor and ceiling.',
              kind: 'curve',
              build: function (v, r) {
                if (typeof r.fee !== 'number' || !ok(v.targetCost, v.targetFee, v.sellerShare)) return null;
                var lo = Math.min(v.actualCost, v.targetCost) * 0.6;
                var hi = Math.max(v.actualCost, v.targetCost) * 1.6;
                var N = 40, pts = [], i, ac, fee;
                for (i = 0; i <= N; i++) {
                  ac = lo + (hi - lo) * (i / N);
                  fee = v.targetFee + (v.targetCost - ac) * (v.sellerShare / 100);
                  if (ok(v.maxFee)) fee = Math.min(fee, v.maxFee);
                  if (ok(v.minFee)) fee = Math.max(fee, v.minFee);
                  pts.push([ac, fee]);
                }
                return {
                  series: [{ label: 'Seller fee', points: pts, tone: 'accent' }],
                  markers: [{ x: v.actualCost, y: r.fee, label: 'entered cost', tone: 'accent' }],
                  refY: v.targetFee, refLabel: 'target fee',
                  xLabel: 'Actual cost', yLabel: 'Fee',
                  summary: 'Seller share ' + v.sellerShare + '% of the delta from target cost' +
                    (ok(v.minFee) || ok(v.maxFee) ? ', clamped between the negotiated fee floor and ceiling' : '') +
                    '. At the entered actual cost, the fee is ' + f2(r.fee) + '.'
                };
              }
            }
          ]
        }
      ]
    },

    /* ---------------------------------------------------------- Agile */
    {
      id: 'agile',
      name: 'Agile Forecasting',
      blurb: 'Empirical forecasting: measure what the team actually delivered, then project it forward. Velocity is a planning tool for the team — never a performance comparison between teams.',
      citation: 'Agile — Scrum Guide (2020): scrumguides.org/scrum-guide.html',
      cards: [
        {
          id: 'velocity',
          page: 'velocity-forecast.html',
          name: 'Velocity & release forecast',
          tagline: 'Backlog ÷ velocity',
          about: 'Velocity is the average number of story points a team completes per sprint, measured from finished sprints only (yesterday’s weather). Dividing the remaining backlog by velocity gives the most honest forecast available: how many sprints of work remain at the current, demonstrated pace.',
          formula: [
            'Velocity = Points completed ÷ Sprints completed',
            'Sprints remaining = ⌈ Remaining backlog ÷ Velocity ⌉'
          ],
          inputs: [
            { key: 'points', label: 'Points completed', meaning: 'Total story points fully done (meeting the Definition of Done) across the measured sprints.', placeholder: 'e.g. 120' },
            { key: 'sprints', label: 'Sprints completed', meaning: 'Number of finished sprints those points came from — use at least 3 for a stable average.', placeholder: 'e.g. 4' },
            { key: 'backlog', label: 'Remaining backlog (points)', meaning: 'Estimated points left in the release or project scope.', placeholder: 'e.g. 200' },
            { key: 'weeks', label: 'Sprint length (weeks, optional)', meaning: 'Length of one sprint — converts the forecast into calendar time.', placeholder: 'e.g. 2' }
          ],
          outputs: [
            {
              key: 'velocity', label: 'Velocity', format: 'num',
              meaning: 'Demonstrated delivery rate in points per sprint.',
              compute: function (v) { return ok(v.points, v.sprints) && v.sprints > 0 ? v.points / v.sprints : null; },
              interpret: function (x, v) { return ok(v.sprints) && v.sprints < 3 ? warn('Based on fewer than 3 sprints — treat as a rough signal.') : info('Use the team’s own history only.'); }
            },
            {
              key: 'sprintsLeft', label: 'Sprints remaining', format: 'int',
              meaning: 'Whole sprints needed to clear the backlog at current velocity.',
              compute: function (v) { return ok(v.points, v.sprints, v.backlog) && v.points > 0 && v.sprints > 0 ? Math.ceil(v.backlog / (v.points / v.sprints)) : null; },
              interpret: function () { return info('Rounded up — partial sprints still occupy the calendar.'); }
            },
            {
              key: 'weeksLeft', label: 'Calendar time remaining', format: 'text',
              meaning: 'Sprints remaining × sprint length.',
              compute: function (v) {
                if (!ok(v.points, v.sprints, v.backlog, v.weeks) || v.points <= 0 || v.sprints <= 0) return null;
                var w = Math.ceil(v.backlog / (v.points / v.sprints)) * v.weeks;
                return f2(w) + ' weeks (≈ ' + f2(w / 4.33) + ' months)';
              },
              interpret: function () { return warn('Assumes stable scope and team — re-forecast every sprint.'); }
            }
          ],
          charts: [
            {
              title: 'Backlog burndown forecast',
              purpose: 'The remaining backlog burning down at the team’s demonstrated velocity.',
              kind: 'curve',
              build: function (v, r) {
                if (typeof r.velocity !== 'number' || !ok(v.backlog) || r.velocity <= 0) return null;
                var sprints = Math.ceil(v.backlog / r.velocity);
                if (!(sprints >= 0) || sprints > 5000) return null;
                var pts = [], s;
                for (s = 0; s <= sprints; s++) pts.push([s, Math.max(0, v.backlog - r.velocity * s)]);
                return {
                  series: [{ label: 'Remaining backlog', points: pts, tone: 'accent' }],
                  markers: typeof r.sprintsLeft === 'number' ? [{ x: r.sprintsLeft, y: 0, label: 'done', tone: 'good' }] : [],
                  refY: 0, xLabel: 'Sprint', yLabel: 'Backlog (points)', zeroBase: true,
                  summary: 'At a velocity of ' + f2(r.velocity) + ' points/sprint, ' + f2(v.backlog) +
                    ' remaining points clear in ' + f2(r.sprintsLeft) + ' sprints — a forecast, not a commitment.'
                };
              }
            }
          ]
        },
        {
          id: 'capacity',
          name: 'Sprint capacity',
          tagline: 'People × days × hours × focus',
          about: 'Capacity planning in hours, for sprint-level task commitment. Start from raw availability, then apply a focus factor — the share of the day genuinely available for sprint work after ceremonies, support duty, e-mail and context switching. Teams that skip the focus factor systematically over-commit. Use capacity for task hours; use velocity (above) for story points — they answer different questions.',
          formula: ['Capacity = Members × Days × Hours per day × Focus factor'],
          inputs: [
            { key: 'members', label: 'Team members', meaning: 'People doing sprint work — count partial allocations as fractions (0.5 for half-time).', placeholder: 'e.g. 5' },
            { key: 'days', label: 'Working days in sprint', meaning: 'Sprint length minus holidays and planned leave.', placeholder: 'e.g. 9' },
            { key: 'hoursPerDay', label: 'Hours per day', meaning: 'Nominal working hours per person per day.', placeholder: 'e.g. 8' },
            { key: 'focus', label: 'Focus factor (%)', meaning: 'Share of the day truly available for sprint work — 60–70% is realistic for most teams.', placeholder: 'e.g. 65' }
          ],
          outputs: [
            {
              key: 'raw', label: 'Raw hours', format: 'num',
              meaning: 'Theoretical availability before reality intervenes.',
              compute: function (v) { return ok(v.members, v.days, v.hoursPerDay) ? v.members * v.days * v.hoursPerDay : null; },
              interpret: function () { return warn('Committing to this number is how sprints fail.'); }
            },
            {
              key: 'capacity', label: 'Plannable capacity (hours)', format: 'num',
              meaning: 'What the team can actually commit to after the focus factor.',
              compute: function (v) { return ok(v.members, v.days, v.hoursPerDay, v.focus) ? v.members * v.days * v.hoursPerDay * (v.focus / 100) : null; },
              interpret: function () { return info('Compare against the task-hour sum of the proposed sprint backlog.'); }
            }
          ],
          charts: [
            {
              title: 'Raw vs plannable capacity',
              purpose: 'The focus factor is the gap — committing to raw hours is how sprints fail.',
              kind: 'bars',
              build: function (v, r) {
                if (typeof r.raw !== 'number' || typeof r.capacity !== 'number') return null;
                return {
                  series: [
                    { label: 'Raw hours', value: r.raw, tone: 'warn', hatch: true },
                    { label: 'Plannable', value: r.capacity, tone: 'good' }
                  ],
                  catHead: 'Hours',
                  summary: 'Of ' + f2(r.raw) + ' raw hours, only ' + f2(r.capacity) + ' are realistically plannable at a ' +
                    f2(v.focus) + '% focus factor.'
                };
              }
            }
          ]
        },
        {
          id: 'say-do',
          name: 'Say/do ratio',
          tagline: 'Delivered ÷ committed',
          about: 'The simplest measure of forecast reliability: of what the team committed to at sprint planning, how much was actually delivered? Track it over several sprints. A team that consistently delivers what it says — even if it says less — is worth more to planning than a fast team nobody can predict.',
          formula: ['Say/do % = Points delivered ÷ Points committed × 100'],
          inputs: [
            { key: 'committed', label: 'Points committed', meaning: 'Story points the team signed up for at sprint planning.', placeholder: 'e.g. 34' },
            { key: 'delivered', label: 'Points delivered', meaning: 'Points fully done (per the Definition of Done) by sprint end.', placeholder: 'e.g. 29' }
          ],
          outputs: [
            {
              key: 'ratio', label: 'Say/do ratio', format: 'pct',
              meaning: 'Forecast reliability for this sprint.',
              compute: function (v) { return ok(v.committed, v.delivered) && v.committed > 0 ? (v.delivered / v.committed) * 100 : null; },
              interpret: function (x) { return x >= 85 && x <= 110 ? good('Reliable — stakeholders can plan on this team’s word.') : x < 85 ? warn('Chronic over-commitment: plan less, deliver it, rebuild trust.') : info('Consistently beating commitments — the forecasts may be sandbagged.'); }
            },
            {
              key: 'gap', label: 'Commitment gap (points)', format: 'num',
              meaning: 'Delivered minus committed — negative means work rolled over.',
              compute: function (v) { return ok(v.committed, v.delivered) ? v.delivered - v.committed : null; },
              interpret: function (x) { return x < 0 ? info('Rolled-over work distorts the next sprint’s plan — re-estimate it.') : info('Zero gap is the goal, not a big positive one.'); }
            }
          ],
          charts: [
            {
              title: 'Forecast reliability',
              purpose: 'Where the say/do ratio sits against the reliable band.',
              kind: 'meter',
              build: function (v, r) {
                if (typeof r.ratio !== 'number') return null;
                return {
                  value: r.ratio, min: 40, max: 160, target: 100, targetLabel: '100%',
                  zones: [
                    { from: 40, to: 85, tone: 'warn', label: 'over-committing' },
                    { from: 85, to: 110, tone: 'good', label: 'reliable' },
                    { from: 110, to: 160, tone: 'warn', label: 'possibly sandbagged' }
                  ],
                  label: 'Say/do', valueFmt: function (n) { return n.toFixed(0) + '%'; },
                  tickFmt: function (n) { return n + '%'; },
                  summary: 'Delivered ' + f2(r.ratio) + '% of what was committed' +
                    (r.ratio >= 85 && r.ratio <= 110 ? ' — inside the reliable band.'
                      : r.ratio < 85 ? ' — chronic over-commitment.' : ' — consistently beating commitments; check the forecasts aren’t sandbagged.')
                };
              }
            }
          ]
        }
      ]
    },

    /* ---------------------------------------------------- Lean & Flow */
    {
      id: 'flow',
      name: 'Lean & Flow',
      blurb: 'Little’s Law is the physics of work in progress: the more you start, the slower everything finishes. It holds for any stable system — a kanban board, a help desk, a factory line.',
      citation: 'Flow — Little (1961), “A Proof for L = λW”: doi.org/10.1287/opre.9.3.383',
      cards: [
        {
          id: 'littles-law',
          name: 'Little’s Law & flow efficiency',
          tagline: 'Cycle time = WIP ÷ throughput',
          about: 'Given any two of work-in-progress, throughput and cycle time, Little’s Law fixes the third. It is the mathematical case for WIP limits: with throughput unchanged, every extra item you start adds directly to how long everything takes. Flow efficiency then reveals how much of that cycle time is actual work versus waiting in queues.',
          formula: [
            'Cycle time = WIP ÷ Throughput',
            'Flow efficiency % = Active work time ÷ Cycle time × 100'
          ],
          inputs: [
            { key: 'wip', label: 'WIP — work in progress', meaning: 'Items currently started and unfinished on the board.', placeholder: 'e.g. 12' },
            { key: 'throughput', label: 'Throughput (items / period)', meaning: 'Items finished per period — pick days or weeks and stay consistent.', placeholder: 'e.g. 3' },
            { key: 'workTime', label: 'Active work per item (optional)', meaning: 'Hands-on time an item actually receives, in the same period units — for flow efficiency.', placeholder: 'e.g. 0.5' }
          ],
          outputs: [
            {
              key: 'cycleTime', label: 'Average cycle time', format: 'num',
              meaning: 'How long a newly started item takes to finish, in your chosen periods.',
              compute: function (v) { return ok(v.wip, v.throughput) && v.throughput > 0 ? v.wip / v.throughput : null; },
              interpret: function () { return info('Halve WIP and cycle time halves — without anyone working faster.'); }
            },
            {
              key: 'flowEff', label: 'Flow efficiency', format: 'pct',
              meaning: 'Share of the cycle time that is real work rather than waiting.',
              compute: function (v) { return ok(v.wip, v.throughput, v.workTime) && v.throughput > 0 && v.wip > 0 ? (v.workTime / (v.wip / v.throughput)) * 100 : null; },
              interpret: function (x) { return x >= 40 ? good('Exceptional — most knowledge work sits at 5–15%.') : x >= 15 ? info('Typical to good for knowledge work.') : warn('Items spend most of their life waiting — attack queues, not people.'); }
            }
          ],
          charts: [
            {
              title: 'WIP vs cycle time',
              purpose: 'The linear relationship behind WIP limits — at fixed throughput, cycle time tracks WIP directly.',
              kind: 'curve',
              build: function (v, r) {
                if (!ok(v.throughput) || v.throughput <= 0 || typeof r.cycleTime !== 'number' || !ok(v.wip) || v.wip < 0 || v.wip > 100000) return null;
                var maxWip = Math.min(2000, Math.max(8, Math.ceil(v.wip * 2)));
                var pts = [], w;
                for (w = 0; w <= maxWip; w++) pts.push([w, w / v.throughput]);
                return {
                  series: [{ label: 'Cycle time', points: pts, tone: 'accent' }],
                  markers: [{ x: v.wip, y: r.cycleTime, label: 'current WIP', tone: 'accent' }],
                  xLabel: 'Work in progress', yLabel: 'Cycle time', zeroBase: true,
                  summary: 'At a throughput of ' + f2(v.throughput) + ' items/period, ' + f2(v.wip) +
                    ' items in progress means a cycle time of ' + f2(r.cycleTime) +
                    ' — halving WIP halves cycle time without anyone working faster.'
                };
              }
            }
          ]
        }
      ]
    }
  ];

  return { categories: categories };
})();

var PM_CATEGORY_FAMILIES = __CATEGORY_FAMILIES__;
PM_DATA.categories.forEach(function (category) {
  category.instrumentFamily = PM_CATEGORY_FAMILIES[category.id] || 'control-room';
});

/* Lane D supplies the complete pack. Keeping the data outside PM_DATA lets a
   worked reading demonstrate a card without changing its formulas or guards. */
var EXAMPLES = {
  'calc-earned-value': {
    values: { bac: 200000, pv: 120000, ev: 108000, ac: 96000 },
    note: 'Six months in: efficient spend, behind schedule.'
  },
  'calc-earned-schedule': {
    values: { bac: 200000, pd: 12, at: 8, ev: 120000 }
  },
  'calc-time-forecast': {
    values: { plannedDur: 12, ev: 80000, pv: 100000 },
    note: 'Progress is 80% of plan, pointing to a three-period slip.'
  },
  'calc-burn-rate': {
    values: { budget: 120000, spent: 45000, elapsed: 3, planLeft: 6 },
    note: 'The remaining budget buys five periods at the current burn.'
  },
  'calc-three-point': {
    values: { o: 4, m: 6, p: 12 },
    note: 'The wide pessimistic case makes the estimate worth protecting.'
  },
  'calc-path-sigma': {
    values: { sigmas: '1.33, 0.5, 2' },
    note: 'Three activity uncertainties roll up to less than their sum.'
  },
  'calc-learning-curve': {
    values: { t1: 100, rate: 80, n: 4 },
    note: 'By unit four, learning cuts effort by 36 percent.'
  },
  'calc-float': {
    values: { es: 5, ef: 9, ls: 8, lf: 12, succEs: 11 },
    note: 'Three periods of total float leave two periods free before the successor.'
  },
  'calc-crash': {
    values: { normalCost: 10000, crashCost: 16000, normalDur: 10, crashDur: 8 },
    note: 'Buying two periods of compression costs 6,000 in total.'
  },
  'calc-fte': {
    values: { effort: 2080, hoursPer: 130, periods: 4 },
    note: 'The work needs four full-time equivalents across the window.'
  },
  'calc-utilization': {
    values: { allocated: 150, available: 160 },
    note: 'A 93.75 percent allocation leaves only ten hours uncommitted.'
  },
  'calc-labor-cost': {
    values: { hours: 400, rate: 60, overhead: 35 },
    note: 'A 35 percent burden turns a 24,000 base into 32,400 loaded.'
  },
  'calc-channels': {
    values: { n: 10, n2: 15 },
    note: 'Adding five people creates 60 additional communication channels.'
  },
  'calc-emv': {
    values: { p: 30, impact: -50000 },
    note: 'A 30 percent threat with a 50,000 impact carries 15,000 EMV.'
  },
  'calc-risk-score': {
    values: { p: 4, i: 3 },
    note: 'A likely, moderate-impact risk scores 12 and needs a watchlist owner.'
  },
  'calc-contingency': {
    values: { probs: '30, 10, 50', impacts: '-50000, -20000, 10000' },
    note: 'Threats outweigh the opportunity, suggesting a 12,000 reserve.'
  },
  'calc-decision-tree': {
    values: {
      costA: 40000, pA: 60, winA: 100000, loseA: 0,
      costB: 10000, pB: 30, winB: 60000, loseB: 0
    },
    note: 'Option A has the higher expected value despite its larger entry cost.'
  },
  'calc-dpmo': {
    values: { defects: 25, units: 1000, opps: 4 },
    note: 'Twenty-five defects across 4,000 opportunities gives 6,250 DPMO.'
  },
  'calc-control': {
    values: { mean: 50, sigma: 2 },
    note: 'Normal variation spans 44 to 56, with a 46 to 54 warning zone.'
  },
  'calc-cpk': {
    values: { usl: 10, lsl: 4, mean: 6, sigma: 0.5 },
    note: 'The process is centred in the six-unit specification window.'
  },
  'calc-coq': {
    values: { prevention: 20000, appraisal: 30000, internal: 40000, external: 25000 },
    note: 'Failure costs are 56.52 percent of the 115,000 quality total.'
  },
  'calc-roi': {
    values: { cost: 200000, benefit: 260000 },
    note: 'A 60,000 net benefit is a 30 percent return on the investment.'
  },
  'calc-npv': {
    values: { rate: 10, inv: 1000, flows: '500, 500, 500' },
    note: 'Three 500 inflows clear the 10 percent hurdle and repay in period two.'
  },
  'calc-tvm': {
    values: { amount: 10000, rate: 8, n: 5 },
    note: 'At eight percent, 10,000 grows to about 14,693 over five periods.'
  },
  'calc-breakeven': {
    values: { fixed: 50000, price: 25, varCost: 15 },
    note: 'A ten-unit contribution margin requires 5,000 units to break even.'
  },
  'calc-depreciation': {
    values: { cost: 120000, salvage: 20000, life: 5 },
    note: 'The asset depreciates by 20,000 per year over five years.'
  },
  'calc-scoring': {
    values: { weights: '5, 3, 2', scores: '8, 6, 9' },
    note: 'The weighted score is 7.6 on the original ten-point scale.'
  },
  'calc-pta': {
    values: { ceiling: 180000, targetPrice: 165000, targetCost: 150000, buyerShare: 80 },
    note: 'The 80 percent share puts point of total assumption at 168,750.'
  },
  'calc-fpif': {
    values: { targetCost: 150000, targetFee: 15000, actualCost: 140000, sellerShare: 20, ceiling: 180000 },
    note: 'Cost savings increase the seller fee to 17,000 under the 20 percent share.'
  },
  'calc-cpif': {
    values: { targetCost: 100000, targetFee: 10000, actualCost: 90000, sellerShare: 20, minFee: 4000, maxFee: 15000 },
    note: 'The final 12,000 fee stays inside the agreed minimum and maximum.'
  },
  'calc-velocity': {
    values: { points: 120, sprints: 4, backlog: 200, weeks: 2 },
    note: 'Four sprints of history forecast seven sprints, or 14 weeks, remaining.'
  },
  'calc-capacity': {
    values: { members: 5, days: 9, hoursPerDay: 8, focus: 65 },
    note: 'A 65 percent focus factor turns 360 raw hours into 234 plannable hours.'
  },
  'calc-say-do': {
    values: { committed: 34, delivered: 29 },
    note: 'The team delivered 85.29 percent of its commitment.'
  },
  'calc-littles-law': {
    values: { wip: 12, throughput: 3, workTime: 0.5 },
    note: 'Twelve items at three per period means four periods of cycle time.'
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = PM_DATA;
