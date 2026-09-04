'use strict';

var H = require('./harness');
var validator = require('../tools/feature-manifest');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function run(page) {
  H.suite('Feature manifest');

  var manifest = validator.readJson(validator.DEFAULT_MANIFEST);
  var data = page ? page.sandbox.PM_DATA : validator.loadData(validator.DEFAULT_PAGE);
  var errors = validator.validate(manifest, data);
  var cards = Object.keys(validator.calculatorIndex(data).cards);

  H.eq('manifest validates against the live PM_DATA definitions', errors.length, 0,
    errors.join('\n'));
  H.eq('manifest contains all 34 calculators', manifest.features.length, cards.length);
  H.eq('PM_DATA still contains 34 calculators', cards.length, 34);

  var duplicate = clone(manifest);
  duplicate.features.push(clone(duplicate.features[0]));
  H.check('duplicate feature id is rejected',
    validator.validate(duplicate, data).some(function (error) { return /duplicates/.test(error); }));

  var unknownKind = clone(manifest);
  unknownKind.features[0].kind = 'dashboard';
  H.check('unsupported feature kind is rejected',
    validator.validate(unknownKind, data).some(function (error) { return /\.kind must be one of/.test(error); }));

  var unknownFamily = clone(manifest);
  unknownFamily.features[0].instrumentFamily = 'war-room';
  H.check('unsupported instrument family is rejected',
    validator.validate(unknownFamily, data).some(function (error) { return /\.instrumentFamily must be one of/.test(error); }));

  var missing = clone(manifest);
  missing.features.pop();
  H.check('missing live calculator is rejected',
    validator.validate(missing, data).some(function (error) { return /has no manifest feature/.test(error); }));

  var draft = clone(manifest);
  draft.features.push({
    id: 'risk-register',
    category: 'risk',
    kind: 'calculator',
    instrumentFamily: 'survey-map',
    status: 'draft'
  });
  H.eq('draft calculator may exist before its PM_DATA definition',
    validator.validate(draft, data).length, 0);

  var unknownStatus = clone(manifest);
  unknownStatus.features[0].status = 'retired';
  H.check('unsupported feature status is rejected',
    validator.validate(unknownStatus, data).some(function (error) { return /\.status must be one of/.test(error); }));

  return H.stats();
}

if (require.main === module) {
  H.reset();
  run();
  process.exitCode = H.report('Feature manifest validation') ? 0 : 1;
}

module.exports = { title: 'Feature manifest validation', run: run };
