'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SITE_DIR = path.join(ROOT, 'src', 'site');
var TEMPLATE = path.join(SITE_DIR, 'index.template.html');
var OUTPUT = path.join(ROOT, 'index.html');
var FEATURE_MANIFEST = path.join(ROOT, 'src', 'features', 'manifest.json');

var STYLE_FILES = [
  path.join('styles', 'bench.css'),
  path.join('styles', 'command-deck.css'),
  path.join('styles', 'instrument-families.css')
];

var SCRIPT_FILES = [
  ['data', path.join('scripts', 'data.js'), /calculator definitions/],
  ['registry', path.join('scripts', 'registry.js'), /PM_REGISTRY/],
  ['xlsx', path.join('scripts', 'xlsx.js'), /PM_XLSX/],
  ['charts', path.join('scripts', 'charts.js'), /instrument plotting/],
  ['export', path.join('scripts', 'export.js'), /PM_EXPORT/],
  ['chart-mount', path.join('scripts', 'chart-mount.js'), /chart mounting/],
  ['projects', path.join('scripts', 'projects.js'), /PM Project Workspace/],
  ['desk', path.join('scripts', 'desk.js'), /rendering and live computation/],
  ['hero', path.join('scripts', 'hero.js'), /Hero instrument/]
];

var STYLE_MARKER = '<!-- @inline:site-styles -->';
var PRERENDER_MARKER = '<!-- @preserve:prerender -->';

function read(file) { return fs.readFileSync(file, 'utf8'); }

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

function marker(name) { return '<!-- @inline:script:' + name + ' -->'; }

function scriptTag(source) {
  return '<script>' + source + '</script>';
}

function scriptSource(entry) {
  var source = read(path.join(SITE_DIR, entry[1]));
  var features = JSON.parse(read(FEATURE_MANIFEST)).features;
  if (entry[0] === 'data') {
    var families = {};
    features.forEach(function (feature) {
      if (!families[feature.category]) families[feature.category] = feature.instrumentFamily;
    });
    source = replaceExactly(source, '__CATEGORY_FAMILIES__',
      JSON.stringify(families), 'category families token');
  } else if (entry[0] === 'registry') {
    source = replaceExactly(source, '__FEATURE_MANIFEST__',
      JSON.stringify(features), 'feature manifest token');
  }
  return source;
}

function currentPrerender(html) {
  var match = /<!-- prerender:start -->[\s\S]*?<!-- prerender:end -->/.exec(html);
  if (!match) throw new Error('index.html has no prerender marker region');
  return match[0];
}

function replaceExactly(source, needle, replacement, label) {
  var first = source.indexOf(needle);
  var last = source.lastIndexOf(needle);
  if (first < 0) throw new Error('template is missing ' + label);
  if (first !== last) throw new Error('template has duplicate ' + label);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function build(template, prerender) {
  var css = STYLE_FILES.map(function (rel) {
    var file = path.join(SITE_DIR, rel);
    if (!fs.existsSync(file)) throw new Error('missing style source: ' + rel);
    return read(file).replace(/^\s*\r?\n/, '').replace(/\s+$/, '');
  }).join('\n');
  var html = replaceExactly(template, STYLE_MARKER,
    '<style>\n' + css + '\n  </style>', 'site style marker');

  SCRIPT_FILES.forEach(function (entry) {
    var file = path.join(SITE_DIR, entry[1]);
    if (!fs.existsSync(file)) throw new Error('missing script source: ' + entry[1]);
    html = replaceExactly(html, marker(entry[0]), scriptTag(scriptSource(entry)),
      entry[0] + ' script marker');
  });

  html = replaceExactly(html, PRERENDER_MARKER, prerender,
    'prerender preservation marker');
  return html;
}

function extractScript(html, entry) {
  var re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  var found = null;
  var full = null;
  var match;
  while ((match = re.exec(html)) !== null) {
    if (/\bsrc=|\btype\s*=/.test(match[1])) continue;
    if (entry[2].test(match[2].slice(0, 500))) {
      if (found !== null) throw new Error('multiple script blocks match ' + entry[0]);
      found = match[2];
      full = match[0];
    }
  }
  if (found === null) throw new Error('could not find script block: ' + entry[0]);
  return { source: found, full: full };
}

function extract() {
  if (fs.existsSync(TEMPLATE)) {
    throw new Error('source template already exists; refusing to overwrite it');
  }
  var html = read(OUTPUT);
  var style = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!style) throw new Error('index.html has no style block');

  var splitAt = style[1].indexOf('/* ═══ Command Deck UI replacement');
  if (splitAt < 0) splitAt = style[1].indexOf('/* ═══ Command Deck');
  if (splitAt < 0) throw new Error('could not find the Command Deck CSS boundary');

  write(path.join(SITE_DIR, STYLE_FILES[0]),
    style[1].slice(0, splitAt).replace(/\s+$/, '') + '\n');
  write(path.join(SITE_DIR, STYLE_FILES[1]),
    style[1].slice(splitAt).replace(/\s+$/, '') + '\n');
  write(path.join(SITE_DIR, STYLE_FILES[2]),
    '/* Category-specific instrument families are authored here. */\n');
  html = html.replace(style[0], STYLE_MARKER);

  SCRIPT_FILES.forEach(function (entry) {
    if (entry[0] === 'registry') {
      write(path.join(SITE_DIR, entry[1]),
        "/* PM_REGISTRY — feature discovery over PM_DATA. */\n" +
        "var PM_REGISTRY = (function (data, manifest) {\n" +
        "  'use strict';\n" +
        "  return { data: function () { return data; }, manifest: function () { return manifest.slice(); } };\n" +
        "}(PM_DATA, __FEATURE_MANIFEST__));\n" +
        "if (typeof window !== 'undefined') window.PM_REGISTRY = PM_REGISTRY;\n" +
        "if (typeof module !== 'undefined' && module.exports) module.exports = PM_REGISTRY;\n");
      return;
    }
    var result = extractScript(html, entry);
    write(path.join(SITE_DIR, entry[1]), result.source);
    html = html.replace(result.full, marker(entry[0]));
  });
  html = html.replace(marker('data'), marker('data') + '\n  ' + marker('registry'));

  html = html.replace(/<!-- prerender:start -->[\s\S]*?<!-- prerender:end -->/,
    PRERENDER_MARKER);
  write(TEMPLATE, html);

  var assembled = build(read(TEMPLATE), currentPrerender(read(OUTPUT)));
  if (assembled !== read(OUTPUT)) {
    throw new Error('extracted sources do not reproduce index.html byte for byte');
  }
  console.log('assemble: extracted modular source under src/site');
}

function main(argv) {
  var check = false;
  var doExtract = false;
  var i;
  for (i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--check' || argv[i] === '--verify') check = true;
    else if (argv[i] === '--extract') doExtract = true;
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('usage: node tools/assemble.js [--check|--extract]');
      return 0;
    } else {
      console.error('assemble: unknown argument ' + argv[i]);
      return 2;
    }
  }
  try {
    if (doExtract) {
      if (check) throw new Error('--extract and --check cannot be combined');
      extract();
      return 0;
    }
    if (!fs.existsSync(TEMPLATE)) throw new Error('missing src/site/index.template.html');
    var current = read(OUTPUT);
    var assembled = build(read(TEMPLATE), currentPrerender(current));
    if (check) {
      if (assembled !== current) {
        console.error('assemble: index.html is STALE — run `node tools/assemble.js`');
        return 1;
      }
      console.log('assemble: index.html matches modular source');
      return 0;
    }
    if (assembled !== current) write(OUTPUT, assembled);
    console.log('assemble: wrote self-contained index.html');
    return 0;
  } catch (err) {
    console.error('assemble: ' + err.message);
    return 1;
  }
}

module.exports = {
  build: build,
  currentPrerender: currentPrerender,
  extractScript: extractScript,
  main: main
};

if (require.main === module) process.exitCode = main(process.argv.slice(2));
