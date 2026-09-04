'use strict';

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var child = require('child_process');
var scaffolder = require('../tools/newfeature');

var TOOL = path.join(__dirname, '..', 'tools', 'newfeature.js');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'yazeed-newfeature-'));
}

function read(root, relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function run(root, args) {
  return child.spawnSync(process.execPath, [TOOL].concat(args), {
    cwd: root,
    encoding: 'utf8'
  });
}

function seedManifest(root) {
  var directory = path.join(root, 'src', 'features');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({
    version: 1,
    features: []
  }, null, 2) + '\n', 'utf8');
}

function main() {
  var root = tempRoot();
  try {
    seedManifest(root);
    var success = run(root, [
      'risk-register', '--type', 'matrix', '--category', 'risk', '--family', 'survey-map'
    ]);
    assert.strictEqual(success.status, 0, success.stderr);

    var feature = path.join(root, 'src', 'features', 'risk-register');
    assert.strictEqual(fs.existsSync(feature), true);
    ['feature.json', 'content.html', 'definition.js', 'theme.css'].forEach(function (name) {
      assert.strictEqual(fs.existsSync(path.join(feature, name)), true, name + ' missing');
      assert.ok(fs.statSync(path.join(feature, name)).size > 0, name + ' is empty');
    });
    var metadata = JSON.parse(read(root, 'src/features/risk-register/feature.json'));
    assert.deepStrictEqual({
      id: metadata.id,
      slug: metadata.slug,
      kind: metadata.kind,
      category: metadata.category,
      instrumentFamily: metadata.instrumentFamily,
      status: metadata.status
    }, {
      id: 'risk-register',
      slug: 'risk-register',
      kind: 'decision-matrix',
      category: 'risk',
      instrumentFamily: 'survey-map',
      status: 'draft'
    });
    assert.ok(read(root, 'src/features/risk-register/definition.js').indexOf("id: 'risk-register'") !== -1);
    assert.ok(read(root, 'src/features/risk-register/theme.css').indexOf('.feature--risk-register') !== -1);
    var manifest = JSON.parse(read(root, 'src/features/manifest.json'));
    assert.deepStrictEqual(manifest.features, [{
      id: 'risk-register',
      category: 'risk',
      kind: 'decision-matrix',
      instrumentFamily: 'survey-map',
      status: 'draft'
    }]);
    assert.deepStrictEqual(scaffolder.TYPE_KINDS, {
      calculator: 'calculator',
      guide: 'interactive-guide',
      checklist: 'checklist',
      matrix: 'decision-matrix'
    });

    var before = read(root, 'src/features/risk-register/feature.json');
    var manifestBefore = read(root, 'src/features/manifest.json');
    var refusal = run(root, [
      'risk-register', '--type', 'guide', '--category', 'risk', '--family', 'survey-map'
    ]);
    assert.notStrictEqual(refusal.status, 0);
    assert.ok(/refusing to overwrite/i.test(refusal.stderr));
    assert.strictEqual(read(root, 'src/features/risk-register/feature.json'), before);
    assert.strictEqual(read(root, 'src/features/manifest.json'), manifestBefore);
    assert.deepStrictEqual(fs.readdirSync(feature).sort(), [
      'content.html', 'definition.js', 'feature.json', 'theme.css'
    ]);

    console.log('newfeature: 2/2 passed');
  } finally {
    function remove(dir) {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(function (name) {
        var target = path.join(dir, name);
        if (fs.lstatSync(target).isDirectory()) remove(target);
        else fs.unlinkSync(target);
      });
      fs.rmdirSync(dir);
    }
    remove(root);
  }
}

main();
