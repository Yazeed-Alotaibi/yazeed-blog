'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DEFAULT_PAGE = path.join(ROOT, 'index.html');
var DEFAULT_MANIFEST = path.join(ROOT, 'src', 'features', 'manifest.json');

var KINDS = [
  'calculator', 'decision-matrix', 'checklist', 'project-template',
  'interactive-guide', 'risk-workshop', 'comparison-tool'
];
var INSTRUMENT_FAMILIES = [
  'control-room', 'field-notebook', 'survey-map', 'planning-wall',
  'drafting-table', 'signal-station', 'laboratory'
];
var STATUSES = ['draft', 'shipped'];

function contains(values, value) {
  return values.indexOf(value) !== -1;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('cannot read manifest ' + file + ': ' + e.message);
  }
}

function loadData(pageFile) {
  var harness = require(path.join(ROOT, 'tests', 'harness.js'));
  return harness.loadPage(pageFile).sandbox.PM_DATA;
}

function calculatorIndex(data) {
  var cards = {};
  var categories = {};

  data.categories.forEach(function (category) {
    categories[category.id] = true;
    category.cards.forEach(function (card) {
      if (cards[card.id]) {
        throw new Error('PM_DATA duplicates calculator id "' + card.id + '"');
      }
      cards[card.id] = category.id;
    });
  });

  return { cards: cards, categories: categories };
}

function validate(manifest, data) {
  var errors = [];
  var index = calculatorIndex(data);
  var features = manifest && manifest.features;
  var seen = {};
  var calculators = {};

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['manifest must be an object'];
  }
  if (manifest.version !== 1) errors.push('manifest version must be 1');
  if (!Array.isArray(features)) return errors.concat(['manifest features must be an array']);

  features.forEach(function (feature, position) {
    var at = 'features[' + position + ']';
    var status;
    if (!feature || typeof feature !== 'object' || Array.isArray(feature)) {
      errors.push(at + ' must be an object');
      return;
    }
    if (typeof feature.id !== 'string' || !feature.id) {
      errors.push(at + '.id must be a non-empty string');
    } else if (seen[feature.id]) {
      errors.push(at + '.id duplicates "' + feature.id + '"');
    } else {
      seen[feature.id] = true;
    }
    if (!contains(KINDS, feature.kind)) {
      errors.push(at + '.kind must be one of ' + KINDS.join(', '));
    }
    if (!contains(INSTRUMENT_FAMILIES, feature.instrumentFamily)) {
      errors.push(at + '.instrumentFamily must be one of ' + INSTRUMENT_FAMILIES.join(', '));
    }
    status = feature.status || 'shipped';
    if (!contains(STATUSES, status)) {
      errors.push(at + '.status must be one of ' + STATUSES.join(', '));
    }
    if (typeof feature.category !== 'string' || !index.categories[feature.category]) {
      errors.push(at + '.category must name a PM_DATA category');
    }
    if (feature.kind === 'calculator' && status === 'shipped') {
      if (!index.cards[feature.id]) {
        errors.push(at + '.id "' + feature.id + '" is not a PM_DATA calculator');
      } else {
        calculators[feature.id] = true;
        if (index.cards[feature.id] !== feature.category) {
          errors.push(at + '.category must be "' + index.cards[feature.id] + '" for calculator "' + feature.id + '"');
        }
      }
    }
  });

  Object.keys(index.cards).forEach(function (id) {
    if (!calculators[id]) errors.push('PM_DATA calculator "' + id + '" has no manifest feature');
  });

  return errors;
}

function parseArgs(argv) {
  var options = { page: DEFAULT_PAGE, manifest: DEFAULT_MANIFEST };
  var i;
  for (i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--page' || argv[i] === '--manifest') {
      if (!argv[i + 1]) throw new Error(argv[i] + ' needs a path');
      options[argv[i].slice(2)] = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--help') {
      options.help = true;
    } else {
      throw new Error('unknown argument ' + argv[i]);
    }
  }
  return options;
}

function run(argv) {
  var options = parseArgs(argv || []);
  if (options.help) {
    console.log('Usage: node tools/feature-manifest.js [--page <file>] [--manifest <file>]');
    return 0;
  }
  var manifest = readJson(options.manifest);
  var errors = validate(manifest, loadData(options.page));
  if (errors.length) {
    errors.forEach(function (error) { console.error('feature-manifest: ' + error); });
    return 1;
  }
  console.log('feature-manifest: ' + manifest.features.length + ' features validate against PM_DATA');
  return 0;
}

module.exports = {
  DEFAULT_PAGE: DEFAULT_PAGE,
  DEFAULT_MANIFEST: DEFAULT_MANIFEST,
  KINDS: KINDS,
  INSTRUMENT_FAMILIES: INSTRUMENT_FAMILIES,
  STATUSES: STATUSES,
  loadData: loadData,
  calculatorIndex: calculatorIndex,
  readJson: readJson,
  validate: validate,
  parseArgs: parseArgs,
  run: run
};

if (require.main === module) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    console.error('feature-manifest: ' + e.message);
    process.exitCode = 2;
  }
}
