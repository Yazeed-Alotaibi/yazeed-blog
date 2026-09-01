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

function option(name) {
  var index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

var pageFile = option('--page') || 'index.html';
var started = process.hrtime.bigint();
var page = H.loadPage(pageFile);
var passed = 0;
var total = 0;
var allPassed = true;

suites.forEach(function (testSuite) {
  var result;
  H.reset();
  try {
    testSuite.run(page);
  } catch (e) {
    H.suite('suite execution');
    H.check(testSuite.title + ' completes', false, e.stack || e.message);
  }
  result = H.stats();
  passed += result.passed;
  total += result.total;
  if (!H.report(testSuite.title)) allPassed = false;
});

var elapsedMs = Number(process.hrtime.bigint() - started) / 1000000;
console.log('All tests: ' + passed + '/' + total + ' passed in ' + elapsedMs.toFixed(1) + 'ms');
if (!allPassed) process.exitCode = 1;
