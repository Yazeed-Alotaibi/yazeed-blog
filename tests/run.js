'use strict';

var H = require('./harness');

var suites = [
  require('./baseline'),
  require('./edge-cases'),
  require('./charts'),
  require('./stylesheet'),
  require('./redirects'),
  require('./counts'),
  require('./earned-schedule')
];

function run(pageFile, options) {
  var started = process.hrtime.bigint();
  var page = H.loadPage(pageFile);
  var passed = 0;
  var total = 0;
  var allPassed = true;
  var suiteResults = [];
  options = options || {};

  suites.forEach(function (testSuite) {
    var result;
    H.reset();
    try {
      testSuite.run(page, options);
    } catch (e) {
      H.suite('suite execution');
      H.check(testSuite.title + ' completes', false, e.stack || e.message);
    }
    result = H.stats();
    passed += result.passed;
    total += result.total;
    if (result.failures.length) allPassed = false;
    suiteResults.push({
      title: testSuite.title,
      passed: result.passed,
      total: result.total,
      failures: result.failures
    });
    if (!options.quiet) H.report(testSuite.title);
  });

  var elapsedMs = Number(process.hrtime.bigint() - started) / 1000000;
  if (!options.quiet) {
    console.log('All tests: ' + passed + '/' + total + ' passed in ' + elapsedMs.toFixed(1) + 'ms');
  }
  return {
    passed: passed,
    total: total,
    elapsedMs: elapsedMs,
    allPassed: allPassed,
    suites: suiteResults
  };
}

module.exports = { run: run };

if (require.main === module) {
  var result = run('index.html');
  if (!result.allPassed) process.exitCode = 1;
}
