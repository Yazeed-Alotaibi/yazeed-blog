'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./harness');

var ROOT = path.join(__dirname, '..');
var FAMILIES = [
  'control-room', 'field-notebook', 'survey-map', 'planning-wall',
  'drafting-table', 'signal-station', 'laboratory'
];

function run(page) {
  var html = page.html;
  var css = fs.readFileSync(path.join(ROOT, 'src', 'site', 'styles', 'instrument-families.css'), 'utf8');
  var manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'features', 'manifest.json'), 'utf8'));
  var buttons = html.match(/<button type="button" data-review-lens="[^"]+" aria-pressed="(?:true|false)">/g) || [];
  var selected = buttons.filter(function (button) { return /aria-pressed="true"/.test(button); });

  H.suite('Instrument families and review lens');
  H.check('review lens exposes three explicit choices', buttons.length === 3);
  H.check('review lens starts with one selected choice', selected.length === 1);
  H.check('review lens reports its written selection',
    /id="review-lens-status"[^>]*aria-live="polite"/.test(html));
  H.check('review trace is decorative to assistive technology',
    /class="review-trace" aria-hidden="true"/.test(html));
  H.check('every desk category declares an instrument family',
    page.sandbox.PM_DATA.categories.every(function (category) {
      return FAMILIES.indexOf(category.instrumentFamily) !== -1;
    }));
  H.check('every instrument family has scoped styling',
    FAMILIES.every(function (family) {
      return css.indexOf('[data-family="' + family + '"]') !== -1;
    }));
  H.check('every shipped feature uses a supported instrument family',
    manifest.features.every(function (feature) {
      return FAMILIES.indexOf(feature.instrumentFamily) !== -1;
    }));
}

module.exports = { title: 'Instrument families and review lens', run: run };

if (require.main === module) {
  H.reset();
  run(H.loadPage(path.join(ROOT, 'index.html')));
  process.exitCode = H.report('Instrument families and review lens') ? 0 : 1;
}
