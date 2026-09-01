'use strict';

var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

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
  var temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yazeed-blog-mutant-'));
  var mutantPath = path.join(temp, 'index.html');

  if (first === -1 || second !== -1) {
    console.log(mutation.name + ': invalid mutation target');
    survived += 1;
    fs.rmSync(temp, { recursive: true, force: true });
    return;
  }

  fs.writeFileSync(mutantPath,
    source.slice(0, first) + mutation.to + source.slice(first + mutation.from.length));

  var result = childProcess.spawnSync(process.execPath,
    [path.join(__dirname, 'run.js'), '--page', mutantPath],
    { cwd: root, encoding: 'utf8' });
  var output = (result.stdout || '').split(/\r?\n/).filter(function (line) {
    return /FAILED|All tests:/.test(line);
  });

  if (result.status === 0) {
    survived += 1;
    console.log(mutation.name + ': SURVIVED');
  } else {
    console.log(mutation.name + ': killed (exit ' + result.status + ')');
  }
  output.slice(0, 2).forEach(function (line) { console.log('  ' + line.trim()); });
  fs.rmSync(temp, { recursive: true, force: true });
});

if (survived) {
  console.log('Mutation smoke: ' + survived + '/' + mutations.length + ' survived');
  process.exitCode = 1;
} else {
  console.log('Mutation smoke: 3/3 killed');
}
