'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./harness');

var page = H.loadPage('index.html');
var data = page.sandbox.PM_DATA;
var examples = JSON.parse(fs.readFileSync(path.join(__dirname, 'examples.json'), 'utf8'));
var failures = [];
var cardCount = 0;

H.eachCard(data, function (card) {
  cardCount += 1;
  var entry = examples[card.id];
  if (!entry) {
    failures.push(card.id + ': missing example set');
    return;
  }

  var results = {};
  card.outputs.forEach(function (output) {
    var value;
    try {
      value = output.compute(entry.values);
    } catch (error) {
      failures.push(card.id + '.' + output.key + ': threw ' + error.message);
      return;
    }
    results[output.key] = value;
    if (value === null || value === undefined ||
        (typeof value === 'number' && !isFinite(value))) {
      failures.push(card.id + '.' + output.key + ': ' + JSON.stringify(value));
    }
  });

  console.log('OK ' + card.id + ' (' + card.outputs.length + ' outputs)');
});

Object.keys(examples).forEach(function (id) {
  var found = false;
  H.eachCard(data, function (card) { if (card.id === id) found = true; });
  if (!found) failures.push(id + ': example has no PM_DATA card');
});

if (failures.length) {
  console.log('ANOMALIES:');
  failures.forEach(function (failure) { console.log('  ' + failure); });
  process.exitCode = 1;
} else {
  console.log('Checked ' + cardCount + ' example sets; no null, NaN, or Infinity outputs.');
}
