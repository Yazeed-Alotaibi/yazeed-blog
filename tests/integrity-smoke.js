'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var H = require('./harness');
var charts = require('./charts');
var earnedSchedule = require('./earned-schedule');
var redirects = require('./redirects');
var stylesheet = require('./stylesheet');

var root = path.join(__dirname, '..');
var page = H.loadPage('index.html');
var passed = 0;
var failed = 0;

function result(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(name + ': caught');
  } else {
    failed += 1;
    console.log(name + ': MISSED' + (detail ? ' - ' + detail : ''));
  }
}

function expectFailure(name, run, label) {
  var stats;
  H.reset();
  try {
    run();
    stats = H.stats();
    result(name, stats.failures.some(function (failure) {
      return failure.label === label;
    }), JSON.stringify(stats.failures));
  } catch (e) {
    result(name, false, e.message);
  }
}

function redirectRoot(mutate, run) {
  var temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yazeed-integrity-'));
  try {
    ['.htaccess', 'pm-calculation-desk.html', 'wbs-estimation-toolkit.html']
      .forEach(function (file) {
        var text = fs.readFileSync(path.join(root, file), 'utf8');
        fs.writeFileSync(path.join(temp, file), mutate(file, text));
      });
    run(temp);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

expectFailure('unbalanced brace', function () {
  stylesheet.run({ html: page.html.replace('</style>', '{\n</style>') });
}, 'CSS braces are balanced');

expectFailure('dangling token', function () {
  stylesheet.run({
    html: page.html.replace('</style>',
      '.probe{color:var(--missing-probe);}\n</style>')
  });
}, 'every custom property use has a definition');

expectFailure('dark-only token', function () {
  stylesheet.run({
    html: page.html.replace(/color-scheme:\s*dark;/,
      'color-scheme: dark; --dark-probe: #fff;')
  });
}, 'dark-mode custom properties also exist in the base palette');

expectFailure('hardcoded colour', function () {
  stylesheet.run({
    html: page.html.replace('</style>', '.probe{color:#123456;}\n</style>')
  });
}, 'hex colours stay inside allowlisted palette blocks');

expectFailure('painted colour beside mask stencil', function () {
  stylesheet.run({
    html: page.html.replace('#cat-nav.can-scroll-r {',
      '#cat-nav.can-scroll-r { color: #123456;')
  });
}, 'hex colours stay inside allowlisted palette blocks');

expectFailure('missing anchor', function () {
  stylesheet.run({
    html: page.html.replace('</body>',
      '<a href="#missing-probe">probe</a></body>')
  });
}, 'static fragment links resolve to static ids');

redirectRoot(function (file, text) {
  return file === '.htaccess'
    ? text + '\nRewriteRule ^probe$ /probe [R=301,L]\n'
    : text;
}, function (temp) {
  expectFailure('unguarded rewrite', function () {
    redirects.run(null, { root: temp });
  }, 'every Rewrite directive is guarded by mod_rewrite');
});

redirectRoot(function (file, text) {
  return file === 'pm-calculation-desk.html'
    ? text.replace('url=/#calc-sections', 'url=/#about')
    : text;
}, function (temp) {
  expectFailure('stub drift', function () {
    redirects.run(null, { root: temp });
  }, 'pm-calculation-desk.html refresh matches its RewriteRule');
});

var earnedPage = H.loadPage('index.html');
earnedPage.sandbox.PM_DATA.categories[0].cards.push({
  id: 'earned-schedule',
  inputs: [{ key: 'bac' }, { key: 'pd' }, { key: 'at' }, { key: 'ev' }],
  outputs: [
    {
      key: 'es',
      compute: function (v) {
        return Number.isFinite(v.bac) && Number.isFinite(v.pd) &&
          Number.isFinite(v.ev) && v.bac > 0 ? v.pd * (v.ev / v.bac) : null;
      }
    },
    {
      key: 'svt',
      compute: function (v) {
        var es = v.bac > 0 ? v.pd * (v.ev / v.bac) : null;
        return es === null || !Number.isFinite(v.at) ? null : es - v.at;
      }
    },
    {
      key: 'spit',
      compute: function (v) {
        var es = v.bac > 0 ? v.pd * (v.ev / v.bac) : null;
        return es === null || !Number.isFinite(v.at) || v.at <= 0
          ? null : es / v.at;
      }
    },
    {
      key: 'ieac',
      compute: function (v) {
        var es = v.bac > 0 ? v.pd * (v.ev / v.bac) : null;
        var spi = es === null || !Number.isFinite(v.at) || v.at <= 0
          ? null : es / v.at;
        return spi === null || spi <= 0 ? null : v.pd / spi;
      }
    }
  ]
});
H.reset();
earnedSchedule.run(earnedPage, { quiet: true });
var earnedStats = H.stats();
result('synthetic Earned Schedule vectors',
  earnedStats.total === 9 && earnedStats.failures.length === 0,
  JSON.stringify(earnedStats.failures));

var futurePage = H.loadPage('index.html');
futurePage.sandbox.PM_DATA.categories[0].cards.push({
  id: 'future-card',
  inputs: [{ key: 'x', placeholder: '1' }],
  outputs: [{
    key: 'y',
    compute: function (v) {
      return typeof v.x === 'number' && isFinite(v.x) ? v.x : null;
    }
  }],
  charts: [{
    title: 'Future chart',
    purpose: 'Future integration probe.',
    kind: 'bars',
    build: function (v, readings) {
      return typeof readings.y === 'number' ? {
        series: [{ label: 'Y', value: readings.y, tone: 'accent' }],
        catHead: 'Value',
        summary: 'Valid future chart summary.'
      } : null;
    }
  }]
});
H.reset();
charts.run(futurePage);
var futureStats = H.stats();
result('future chart integration',
  futureStats.total === 370 && futureStats.failures.length === 0,
  JSON.stringify(futureStats.failures));

var summaryPage = H.loadPage('index.html');
var chart = summaryPage.sandbox.PM_DATA.categories[0].cards[0].charts[0];
var build = chart.build;
chart.build = function (v, readings) {
  var spec = build(v, readings);
  if (spec) spec.summary = 'NaN';
  return spec;
};
H.reset();
charts.run(summaryPage);
var summaryStats = H.stats();
result('non-finite chart summary',
  summaryStats.failures.length > 0,
  'summary mutant survived');

console.log('Integrity smoke: ' + passed + '/' + (passed + failed) + ' caught');
if (failed) process.exitCode = 1;
