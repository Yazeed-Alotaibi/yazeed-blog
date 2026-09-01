'use strict';

var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');
var H = require('./harness');
var runner = require('./run');

var root = path.join(__dirname, '..');
var source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
var mutations = [
  {
    name: 'earned-value CPI division',
    from: 'v.ev / v.ac : null;',
    to: 'v.ev * v.ac : null;'
  },
  {
    name: 'velocity division',
    from: 'v.points / v.sprints : null;',
    to: 'v.points * v.sprints : null;'
  },
  {
    name: 'depreciation division',
    from: '(v.cost - v.salvage) / v.life : null;',
    to: '(v.cost - v.salvage) * v.life : null;'
  }
];
var survived = 0;

mutations.forEach(function (mutation) {
  var first = source.indexOf(mutation.from);
  var second = first === -1 ? -1 : source.indexOf(mutation.from, first + mutation.from.length);
  var temp = fs.mkdtempSync(path.join(root, '.lane-b-mutant-'));
  var mutantPath = path.join(temp, 'index.html');
  try {
    if (first === -1 || second !== -1) {
      console.log(mutation.name + ': invalid mutation target');
      survived += 1;
      return;
    }

    fs.writeFileSync(mutantPath,
      source.slice(0, first) + mutation.to + source.slice(first + mutation.from.length));

    var mutantPage = H.loadPage(path.relative(root, mutantPath));
    var result = runner.run(mutantPage, { quiet: true });
    var failed = result.suites.filter(function (testSuite) {
      return testSuite.failures.length > 0;
    });

    if (result.allPassed) {
      survived += 1;
      console.log(mutation.name + ': SURVIVED');
    } else {
      console.log(mutation.name + ': killed');
    }
    failed.slice(0, 2).forEach(function (testSuite) {
      console.log('  ' + testSuite.title + ': ' + testSuite.passed + '/' +
        testSuite.total + ' passed, ' + testSuite.failures.length + ' FAILED');
    });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

var hostileTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'yazeed-runner-security-'));
var hostilePage = path.join(hostileTemp, 'index.html');
try {
  fs.writeFileSync(hostilePage,
    '<script>console.log("UNTRUSTED_PAGE_EXECUTED:"+' +
    'console.log.constructor("return process")().version)</script>');
  var cli = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'run.js'), '--page', hostilePage],
    { cwd: root, encoding: 'utf8' });
  var externalPageRejected = cli.status === 2 &&
    (cli.stdout || '').indexOf('UNTRUSTED_PAGE_EXECUTED') === -1;
  console.log('runner external page: ' + (externalPageRejected ? 'rejected' : 'EXECUTED'));
  if (!externalPageRejected) survived += 1;
} finally {
  fs.rmSync(hostileTemp, { recursive: true, force: true });
}

if (survived) {
  console.log('Mutation smoke: ' + survived + '/4 checks failed');
  process.exitCode = 1;
} else {
  console.log('Mutation smoke: 3/3 killed; external page rejected');
}
