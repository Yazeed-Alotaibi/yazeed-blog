'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./harness');
var assemble = require('../tools/assemble');

var ROOT = path.join(__dirname, '..');

function throws(fn, pattern) {
  try {
    fn();
  } catch (err) {
    return pattern.test(err.message);
  }
  return false;
}

function run() {
  H.suite('Modular site assembly');
  var template = fs.readFileSync(path.join(ROOT, 'src', 'site', 'index.template.html'), 'utf8');
  var current = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var prerender = assemble.currentPrerender(current);
  var built = assemble.build(template, prerender);

  H.check('modular source reproduces the committed homepage', built === current);
  H.check('assembled homepage keeps one inline stylesheet',
    (built.match(/<style>/g) || []).length === 1);
  H.check('assembled homepage keeps its prerender mirror',
    built.indexOf('<!-- prerender:start -->') !== -1 &&
    built.indexOf('<!-- prerender:end -->') !== -1);
  H.check('assembled homepage resolves every source token',
    built.indexOf('__FEATURE_MANIFEST__') === -1 &&
    built.indexOf('__CATEGORY_FAMILIES__') === -1);
  H.check('missing inline markers fail loudly', throws(function () {
    assemble.build(template.replace('<!-- @inline:script:data -->', ''), prerender);
  }, /missing data script marker/));
  H.check('duplicate inline markers fail loudly', throws(function () {
    assemble.build(template.replace('<!-- @inline:script:data -->',
      '<!-- @inline:script:data --><!-- @inline:script:data -->'), prerender);
  }, /duplicate data script marker/));
}

module.exports = { title: 'Modular site assembly', run: run };

if (require.main === module) {
  H.reset();
  run();
  process.exitCode = H.report('Modular site assembly') ? 0 : 1;
}
