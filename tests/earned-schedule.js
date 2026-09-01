'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./harness');

var TITLE = 'Earned Schedule vectors';

function findCard(data) {
  var found = null;
  H.eachCard(data, function (card) {
    if (card.id === 'earned-schedule') found = card;
  });
  return found;
}

function vectorBlock(markdown) {
  var re = /```json\s*([\s\S]*?)```/gi;
  var match;
  while ((match = re.exec(markdown)) !== null) {
    var parsed;
    try { parsed = JSON.parse(match[1]); } catch (e) { parsed = null; }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.vectors)) return parsed.vectors;
  }
  return null;
}

function canonical(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function rounded(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !isFinite(value)) return value;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function run(page, options) {
  var card = findCard(page.sandbox.PM_DATA);
  if (!card) {
    if (!options || !options.quiet) {
      console.log('earned-schedule: card not present, vectors skipped');
    }
    H.suite('guarded integration');
    return;
  }

  var specPath = path.join(__dirname, '..', 'docs', 'content', 'earned-schedule-spec.md');
  var markdown = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : '';
  var vectors = vectorBlock(markdown);
  var outputMap = {};

  H.each(card.outputs, function (out) {
    outputMap[canonical(out.key)] = out;
  });

  H.suite('vector contract');
  if (!H.check('spec supplies at least six machine-readable vectors',
      vectors && vectors.length >= 6,
      'No JSON vector array found in ' + specPath)) {
    return;
  }

  var guardCases = 0;
  vectors.forEach(function (vector, index) {
    var expected = vector.outputs || vector.expected;
    var actual = {};
    var wanted = {};
    var problem = '';

    if (!vector.inputs || !expected) {
      H.check('vector ' + (index + 1) + ' has inputs and outputs', false,
        JSON.stringify(vector));
      return;
    }

    Object.keys(expected).forEach(function (key) {
      var normalized = canonical(key);
      var out = outputMap[normalized];
      if (!out) {
        problem = 'no card output matches ' + key;
        return;
      }
      try {
        actual[normalized] = rounded(H.invoke(page, out.compute, [vector.inputs]));
      } catch (e) {
        problem = key + ' threw: ' + e.message;
      }
      wanted[normalized] = rounded(expected[key]);
      if (expected[key] === null) guardCases += 1;
    });

    H.deep('vector ' + (index + 1) + ' matches to 2dp',
      problem ? { problem: problem } : actual,
      wanted);
  });

  H.check('vectors include all three guard outcomes', guardCases >= 3,
    'found ' + guardCases + ' expected null outputs');
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  run(H.loadPage('index.html'));
  H.report(TITLE);
}
