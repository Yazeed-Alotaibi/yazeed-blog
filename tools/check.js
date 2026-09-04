/* The one command to run before every commit.

   The modular authoring sources assemble the self-contained homepage first.
   The manifest then validates every registered feature against that artifact.
   Calculator pages, sitemap and prerender follow in dependency order, and the
   tests read the final committed output last.

   Run them in the wrong order and the suite fails on work you have already
   done; skip one and the suite fails on work you have not. Neither is
   interesting, and remembering the order is not the job. Hence this file.

     node tools/check.js              # regenerate, then test
     node tools/check.js --verify     # change nothing; fail if anything is stale

   `--verify` is the read-only form. It asks both generators whether the
   committed output already matches the source, and fails if it does not,
   which is what you want when checking a tree you did not just edit — a
   colleague's branch, a fresh clone, or your own work right before you
   publish. The default form is what you want while working: it writes.

   Adding a dependency to this repository is not allowed, so this shells out
   to `node` rather than importing a task runner. It needs nothing but the
   `node` already on your PATH. */

'use strict';

var path = require('path');
var spawnSync = require('child_process').spawnSync;

var ROOT = path.join(__dirname, '..');

/* Each step is a script plus the arguments it takes in each mode. A step
   whose `verify` is null has no read-only form and simply runs as-is —
   the test suite neither writes nor needs a flag to avoid writing. */
var STEPS = [
  {
    label: 'self-contained site assembly',
    script: path.join('tools', 'assemble.js'),
    write: [],
    verify: ['--check'],
    fix: 'node tools/assemble.js'
  },
  {
    label: 'feature manifest',
    script: path.join('tools', 'feature-manifest.js'),
    write: [],
    verify: [],
    fix: 'node tools/feature-manifest.js'
  },
  {
    label: 'feature scaffolding contract',
    script: path.join('tests', 'newfeature.js'),
    write: [],
    verify: [],
    fix: 'node tests/newfeature.js'
  },
  {
    label: 'per-calculator pages',
    script: path.join('tools', 'calcpage.js'),
    write: ['--all'],
    verify: ['--all', '--check'],
    fix: 'node tools/calcpage.js --all'
  },
  {
    label: 'sitemap',
    script: path.join('tools', 'sitemap.js'),
    write: [],
    verify: ['--check'],
    fix: 'node tools/sitemap.js'
  },
  {
    label: 'prerendered desk mirror',
    script: path.join('tools', 'prerender.js'),
    write: [],
    verify: ['--check'],
    fix: 'node tools/prerender.js'
  },
  {
    label: 'test suite',
    script: path.join('tests', 'run.js'),
    write: [],
    verify: [],
    fix: 'node tests/run.js'
  }
];

function runStep(step, mode) {
  var args = [step.script].concat(mode === 'verify' ? step.verify : step.write);
  var result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit'
  });

  if (result.error) {
    console.error('\ncheck: could not run ' + step.script + ' — ' +
      result.error.message);
    return 2;
  }
  return result.status === null ? 1 : result.status;
}

function main(argv) {
  var mode = 'write';
  var i;

  for (i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--verify' || argv[i] === '--check') {
      mode = 'verify';
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: node tools/check.js [--verify]');
      console.log('');
      console.log('  (no flag)  assemble, regenerate pages/sitemap/prerender, then test');
      console.log('  --verify   change nothing; fail if any committed output is stale');
      return 0;
    } else {
      console.error('check: unknown argument ' + argv[i]);
      console.error('usage: node tools/check.js [--verify]');
      return 2;
    }
  }

  var started = Date.now();

  for (i = 0; i < STEPS.length; i += 1) {
    var step = STEPS[i];
    console.log('── ' + (i + 1) + '/' + STEPS.length + '  ' + step.label +
      (mode === 'verify' ? '  (verify only)' : '') + ' ' +
      new Array(Math.max(2, 58 - step.label.length)).join('─'));

    var status = runStep(step, mode);
    if (status !== 0) {
      console.error('');
      console.error('check: FAILED at step ' + (i + 1) + ' — ' + step.label + '.');
      if (mode === 'verify') {
        console.error('  The committed output does not match the source.');
        console.error('  Run `node tools/check.js` to regenerate it, then commit the result.');
      } else {
        console.error('  Read the failure above, fix it, and run `node tools/check.js` again.');
        console.error('  To debug this step on its own: ' + step.fix);
      }
      return status;
    }
    console.log('');
  }

  console.log('check: all clear in ' + ((Date.now() - started) / 1000).toFixed(1) + 's.');
  if (mode !== 'verify') {
    console.log('');
    console.log('Two things the tests cannot see, so look yourself:');
    console.log('  1. Open the page in a FOREGROUND tab and confirm a chart draws.');
    console.log('     Charts build from an IntersectionObserver, so a hidden or');
    console.log('     backgrounded tab strands every one of them on its empty state.');
    console.log('  2. If you changed the export XML, export a card and open the .xlsx.');
    console.log('');
    console.log('Then stage the files you changed by name — never `git add -A`.');
  }
  return 0;
}

module.exports = { main: main };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
