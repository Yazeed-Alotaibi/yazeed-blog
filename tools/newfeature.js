'use strict';

var fs = require('fs');
var path = require('path');

var TYPES = ['calculator', 'guide', 'checklist', 'matrix'];
var TYPE_KINDS = {
  calculator: 'calculator',
  guide: 'interactive-guide',
  checklist: 'checklist',
  matrix: 'decision-matrix'
};
var FAMILIES = [
  'control-room', 'field-notebook', 'survey-map', 'planning-wall',
  'drafting-table', 'signal-station', 'laboratory'
];
var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var FILES = ['feature.json', 'content.html', 'definition.js', 'theme.css'];
var MANIFEST = path.join('src', 'features', 'manifest.json');

function usage() {
  console.log('usage: node tools/newfeature.js <slug> --type <type> --category <category> --family <family> [--root <directory>]');
  console.log('');
  console.log('  --type <type>  calculator, guide, checklist or matrix (required)');
  console.log('  --category     manifest category (required)');
  console.log('  --family       instrument family (required)');
  console.log('  --root <dir>   project root; defaults to the current directory');
  console.log('  --help         show this help');
}

function parseArgs(argv) {
  var opts = { root: process.cwd() };
  var positional = [];
  var i;
  for (i = 0; i < argv.length; i += 1) {
    var arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--type' || arg === '--root' || arg === '--category' || arg === '--family') {
      if (argv[i + 1] === undefined || argv[i + 1].indexOf('--') === 0) {
        throw new Error(arg + ' needs a value');
      }
      if (arg === '--type') opts.type = argv[i + 1];
      else if (arg === '--root') opts.root = argv[i + 1];
      else if (arg === '--category') opts.category = argv[i + 1];
      else opts.family = argv[i + 1];
      i += 1;
    } else if (arg.charAt(0) === '-') {
      throw new Error('unknown option ' + arg);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length > 1) {
    throw new Error('one slug at a time, got: ' + positional.join(', '));
  }
  opts.slug = positional[0];
  return opts;
}

function validateSlug(slug) {
  if (!slug) return 'no slug given';
  if (/\.html$/.test(slug)) {
    return 'drop the .html — pass the slug alone (' + slug.replace(/\.html$/, '') + ')';
  }
  if (!SLUG_RE.test(slug)) {
    return 'a slug is lowercase letters, digits and single hyphens: ' +
      'risk-register, not "' + slug + '"';
  }
  return null;
}

function validateType(type) {
  if (TYPES.indexOf(type) === -1) {
    return 'type must be one of: ' + TYPES.join(', ');
  }
  return null;
}

function validateCategory(category) {
  if (!category) return 'category is required';
  if (!SLUG_RE.test(category)) return 'category must be lowercase letters, digits and single hyphens';
  return null;
}

function validateFamily(family) {
  if (FAMILIES.indexOf(family) === -1) {
    return 'family must be one of: ' + FAMILIES.join(', ');
  }
  return null;
}

function ensureDirectory(dir) {
  if (fs.existsSync(dir)) {
    if (!fs.statSync(dir).isDirectory()) {
      throw new Error(dir + ' exists but is not a directory');
    }
    return;
  }
  ensureDirectory(path.dirname(dir));
  fs.mkdirSync(dir);
}

function featureJson(slug, kind, category, family) {
  return JSON.stringify({
    id: slug,
    slug: slug,
    kind: kind,
    category: category,
    instrumentFamily: family,
    status: 'draft',
    title: 'TODO: Feature title',
    description: 'TODO: Explain the reader problem this feature solves.',
    entry: 'definition.js',
    theme: 'theme.css',
    content: 'content.html'
  }, null, 2) + '\n';
}

function contentStub(slug, kind) {
  return [
    '<!-- Practitioner content for the ' + kind + ' feature "' + slug + '".',
    '     Replace this stub with the feature narrative. Keep markup semantic,',
    '     use h2/h3 headings, and explain the reader workflow end to end. -->',
    '',
    '<h2 id="what-it-answers">What this feature answers</h2>',
    '',
    '<p>TODO — describe the decision or planning problem this feature helps a',
    'reader solve.</p>',
    '',
    '<h2 id="how-to-use-it">How to use it</h2>',
    '',
    '<p>TODO — explain the inputs, sequence, and interpretation in practical',
    'language.</p>',
    ''
  ].join('\n');
}

function definitionStub(slug, kind) {
  return [
    "/* Definition for feature '" + slug + "'. Edit the contract before shipping. */",
    "'use strict';",
    '',
    'var PM_FEATURE = {',
    "  id: '" + slug + "',",
    "  kind: '" + kind + "',",
    "  name: 'TODO: Feature name',",
    '  inputs: [],',
    '  calculate: function (values) {',
    '    /* TODO: return the feature result from raw input values. */',
    '    return values;',
    '  },',
    '  interpret: function (result) {',
    '    /* TODO: return the reader-facing interpretation of the result. */',
    '    return result;',
    '  }',
    '};',
    '',
    'if (typeof module !== \'undefined\' && module.exports) {',
    '  module.exports = PM_FEATURE;',
    '}',
    ''
  ].join('\n');
}

function themeStub(slug) {
  return [
    '/* Scoped art direction for feature "' + slug + '".',
    '   Use shared design tokens; keep status meaning and accessibility intact. */',
    '',
    '.feature--' + slug + ' {',
    '  --feature-accent: var(--accent);',
    '  /* TODO: choose the feature instrument family and composition. */',
    '}',
    ''
  ].join('\n');
}

function filesFor(slug, type, category, family) {
  var kind = TYPE_KINDS[type];
  return {
    'feature.json': featureJson(slug, kind, category, family),
    'content.html': contentStub(slug, kind),
    'definition.js': definitionStub(slug, kind),
    'theme.css': themeStub(slug)
  };
}

function removeDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(function (name) {
    var target = path.join(dir, name);
    var stat = fs.lstatSync(target);
    if (stat.isDirectory()) removeDirectory(target);
    else fs.unlinkSync(target);
  });
  fs.rmdirSync(dir);
}

function scaffoldFeature(root, slug, type, category, family) {
  var featureRoot = path.resolve(root, 'src', 'features');
  var target = path.join(featureRoot, slug);
  var manifestPath = path.resolve(root, MANIFEST);
  var staging = null;
  var manifestStageDir = null;
  var manifestStageFile = null;
  var manifestBackup = null;
  var targetCreated = false;
  var contents = filesFor(slug, type, category, family);

  if (!fs.existsSync(manifestPath)) {
    throw new Error('missing feature manifest: ' + path.relative(root, manifestPath));
  }
  var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || !Array.isArray(manifest.features)) {
    throw new Error('feature manifest must contain a features array');
  }
  if (manifest.features.some(function (feature) { return feature && feature.id === slug; })) {
    throw new Error('refusing to overwrite existing manifest feature: ' + slug);
  }
  manifest.features.push({
    id: slug,
    category: category,
    kind: TYPE_KINDS[type],
    instrumentFamily: family,
    status: 'draft'
  });
  var manifestBody = JSON.stringify(manifest, null, 2) + '\n';

  if (fs.existsSync(target)) {
    throw new Error('refusing to overwrite existing feature: ' + path.relative(root, target));
  }

  ensureDirectory(featureRoot);
  try {
    staging = fs.mkdtempSync(path.join(featureRoot, '.' + slug + '.tmp-'));
    FILES.forEach(function (name) {
      fs.writeFileSync(path.join(staging, name), contents[name], 'utf8');
    });
    if (fs.existsSync(target)) {
      throw new Error('feature appeared while scaffolding: ' + path.relative(root, target));
    }
    fs.renameSync(staging, target);
    targetCreated = true;
    staging = null;
    manifestStageDir = fs.mkdtempSync(path.join(path.dirname(manifestPath), '.manifest.tmp-'));
    manifestStageFile = path.join(manifestStageDir, path.basename(manifestPath));
    fs.writeFileSync(manifestStageFile, manifestBody, 'utf8');
    manifestBackup = manifestPath + '.backup-' + Date.now();
    fs.renameSync(manifestPath, manifestBackup);
    fs.renameSync(manifestStageFile, manifestPath);
    manifestStageFile = null;
    removeDirectory(manifestStageDir);
    manifestStageDir = null;
    fs.unlinkSync(manifestBackup);
    manifestBackup = null;
  } catch (e) {
    if (manifestStageFile && fs.existsSync(manifestStageFile)) fs.unlinkSync(manifestStageFile);
    if (manifestStageDir && fs.existsSync(manifestStageDir)) removeDirectory(manifestStageDir);
    if (manifestBackup && fs.existsSync(manifestBackup)) {
      if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
      fs.renameSync(manifestBackup, manifestPath);
    }
    if (targetCreated && fs.existsSync(target)) removeDirectory(target);
    if (staging) removeDirectory(staging);
    throw e;
  }

  return { path: path.relative(root, target), files: FILES.slice() };
}

function main(argv) {
  var opts;
  try {
    opts = parseArgs(argv);
    if (opts.help || !argv.length) {
      usage();
      return opts.help ? 0 : 2;
    }
    var slugError = validateSlug(opts.slug);
    if (slugError) throw new Error(slugError);
    var typeError = validateType(opts.type);
    if (typeError) throw new Error(typeError);
    var categoryError = validateCategory(opts.category);
    if (categoryError) throw new Error(categoryError);
    var familyError = validateFamily(opts.family);
    if (familyError) throw new Error(familyError);
    var result = scaffoldFeature(opts.root, opts.slug, opts.type, opts.category, opts.family);
    console.log('scaffolded ' + result.path + ' (' + opts.type + ')');
    result.files.forEach(function (name) { console.log('  wrote ' + name); });
    return 0;
  } catch (e) {
    console.error('newfeature: ' + e.message);
    return 2;
  }
}

module.exports = {
  FILES: FILES,
  TYPES: TYPES,
  TYPE_KINDS: TYPE_KINDS,
  FAMILIES: FAMILIES,
  validateSlug: validateSlug,
  validateType: validateType,
  validateCategory: validateCategory,
  validateFamily: validateFamily,
  filesFor: filesFor,
  scaffoldFeature: scaffoldFeature,
  main: main
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
