/* Scaffolds a new per-calculator page.

   Adding a page is five edits in four files, and `tests/pages.js` gates every
   one of them. Miss any and the suite fails — correctly, but after the fact:

     1. content/<slug>.html      the long-form prose, 1000 words minimum
     2. content/pages.json       the manifest entry the generator reads, and
                                 the homepage's own `updated` date, since a
                                 new page changes the desk that links to it
     3. index.html               a `page:` field on the card, so the desk
                                 links to it in both the runtime template
                                 and the prerendered static mirror
     4. <slug>.html              the generated page itself
     5. sitemap.xml              or a crawler has no list to find it in

   This tool does 1 through 3 and leaves the two generated files to
   `tools/calcpage.js` and `tools/sitemap.js`, which are the things that
   actually know how to build them — `node tools/check.js` runs both. What
   you are left with is the only part that needed a person: the prose.

     node tools/newpage.js <slug> --card <card-id>
     node tools/newpage.js <slug> --card <card-id> --dry-run
     node tools/newpage.js <slug> --card <card-id> --no-link

   The manifest defaults it writes are placeholders, and deliberately obvious
   ones: `tests/pages.js` holds the title to 62 characters and the description
   to between 110 and 175, so a default that merely parsed would fail the
   suite later and teach you nothing. Edit them before you run the tests.

   On the index.html edit
   ──────────────────────
   Step 4 writes into the 400KB file the whole site is built from, which is
   the one edit here worth being nervous about. So it is not a blind splice:
   the tool re-parses PM_DATA afterwards and confirms the card really does
   carry the new `page` value. If the parse throws, or the value is not
   there, the original bytes go back and nothing is left half-done. Pass
   `--no-link` to skip the edit and be told what to add by hand instead. */

'use strict';

var fs = require('fs');
var path = require('path');

var calcpage = require('./calcpage.js');

var ROOT = path.join(__dirname, '..');
var SITE = 'https://yazeed.blog';

function rel(p) { return path.join(ROOT, p); }
function read(p) { return fs.readFileSync(rel(p), 'utf8'); }

function today() {
  var d = new Date();
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/* ── validation ─────────────────────────────────────────────────── */

/* The slug becomes a filename, a URL and a canonical tag, so it may hold
   only what all three agree on. Lowercase, digits, single hyphens between
   words. Anything else is rejected here rather than discovered as a broken
   canonical in the test suite. */
var SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateSlug(slug) {
  if (!slug) return 'no slug given';
  if (/\.html$/.test(slug)) {
    return 'drop the .html — pass the slug alone (' + slug.replace(/\.html$/, '') + ')';
  }
  if (!SLUG_RE.test(slug)) {
    return 'a slug is lowercase letters, digits and single hyphens: ' +
      'earned-schedule-forecasting, not "' + slug + '"';
  }
  return null;
}

/* ── the four edits ─────────────────────────────────────────────── */

function proseStub(slug, card, spec) {
  return [
    '<!-- Long-form content for /' + slug + '.',
    '     Plain prose in plain HTML — edit this file directly; tools/calcpage.js',
    '     wraps it in the page furniture. Use h2 for sections, h3 beneath them.',
    '',
    '     tests/pages.js requires at least 1000 words of plain text here, counted',
    '     with tags stripped, so markup does not pad it. That minimum is not',
    '     bureaucracy: a shorter page is the shape Google filters as built for',
    '     rankings rather than for readers.',
    '',
    '     Work the same numbers the calculator opens with, so a reader can',
    '     follow along in the instrument above rather than beside it. -->',
    '',
    '<h2 id="what-it-answers">What ' + esc(lower(card.name)) + ' actually answers</h2>',
    '',
    '<p>TODO — open with the question a reader arrived with, and the reason the',
    'obvious way of answering it misleads them. Not a definition.</p>',
    '',
    '<h2 id="worked-example">Worked through end to end</h2>',
    '',
    '<p>TODO — take the numbers the calculator above opens with and walk every',
    'step, so the arithmetic on the page and the arithmetic in the instrument',
    'are visibly the same.</p>',
    '',
    '<h3>Step 1</h3>',
    '',
    '<p>TODO</p>',
    '',
    '<h2 id="reading-it">How to read the result</h2>',
    '',
    '<p>TODO — what each verdict means on a real project, and where the metric',
    'stops telling the truth. This section is usually the reason the page is',
    'worth having.</p>',
    '',
    '<h2 id="mistakes">Mistakes that survive into real reporting</h2>',
    '',
    '<p>TODO — the errors you have actually seen, not the ones a textbook',
    'warns about.</p>',
    '',
    '<h2 id="exam-vs-practice">On the exam and on a real project</h2>',
    '',
    '<p>TODO — where the certification answer and the practitioner answer part',
    'company, and why.</p>',
    ''
  ].join('\n');
}

function lower(s) {
  return String(s).charAt(0).toLowerCase() + String(s).slice(1);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function manifestEntry(slug, card, opts) {
  return {
    card: card.id,
    slug: slug,
    title: opts.title || (card.name + ' — TODO calculator'),
    description: opts.description ||
      ('TODO — 110 to 175 characters selling this page in a result list. ' +
       'It currently covers: ' + (card.tagline || card.name) + '.'),
    h1: opts.h1 || card.name,
    lede: opts.lede || 'TODO — one or two sentences under the h1, saying what the ' +
      'calculator does and what the prose below adds to it.',
    updated: today(),
    related: opts.related || []
  };
}

/* pages.json round-trips through JSON.stringify byte for byte at two-space
   indent, including the `_comment` block at the top, so rewriting the parsed
   object is safe here and does not reformat the file around the new entry. */
function addToManifest(slug, card, opts) {
  var raw = read(path.join('content', 'pages.json'));
  var data = JSON.parse(raw);
  data.pages.push(manifestEntry(slug, card, opts));
  return { path: path.join('content', 'pages.json'), body: JSON.stringify(data, null, 2) + '\n' };
}

/* sitemap.xml is generated from content/pages.json by tools/sitemap.js, so
   there is no entry to splice in here — writing the manifest entry above is
   what puts the page in the sitemap. All this does is bump the homepage's
   own date, because a new page changes the desk that links to it.

   Call it after the manifest write has been staged: it reads the manifest
   body being written, not the one still on disk. */
function bumpHomeUpdated(pagesWrite) {
  var data = JSON.parse(pagesWrite.body);
  if (!data.home) data.home = {};
  if (data.home.updated === today()) return pagesWrite;
  data.home.updated = today();
  return { path: pagesWrite.path, body: JSON.stringify(data, null, 2) + '\n' };
}

/* Insert `page: '<slug>.html',` into the card's object literal, immediately
   after its `id:` line and at the same indentation. Order inside an object
   literal carries no meaning, and anchoring to `id:` is the one line every
   card is guaranteed to have exactly once. */
function linkFromDesk(slug, cardId) {
  var raw = read('index.html');
  var re = new RegExp('^([ \\t]*)id: \'' + cardId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\',[ \\t]*$', 'm');
  var hits = raw.match(new RegExp(re.source, 'gm')) || [];

  if (hits.length === 0) {
    throw new Error('could not find the line `id: \'' + cardId + '\',` in index.html');
  }
  if (hits.length > 1) {
    throw new Error('the line `id: \'' + cardId + '\',` appears ' + hits.length +
      ' times in index.html — refusing to guess which card is the calculator');
  }

  var m = re.exec(raw);
  var indent = m[1];
  var insertAt = m.index + m[0].length;
  var body = raw.slice(0, insertAt) +
    '\n' + indent + 'page: \'' + slug + '.html\',' +
    raw.slice(insertAt);

  return { path: 'index.html', body: body };
}

/* The safety net for the edit above: parse the result and insist the card
   now carries the value we meant to give it. A splice that produced invalid
   JavaScript throws here, before anything reaches the working tree. */
function verifyLink(html, cardId, slug) {
  var hit = calcpage.cardFrom(html, cardId);
  if (!hit) throw new Error('after the edit, no card with id "' + cardId + '" parses out of index.html');
  if (hit.card.page !== slug + '.html') {
    throw new Error('after the edit, card "' + cardId + '" has page=' +
      JSON.stringify(hit.card.page) + ', expected ' + JSON.stringify(slug + '.html'));
  }
}

/* ── cli ────────────────────────────────────────────────────────── */

function usage() {
  console.log('usage: node tools/newpage.js <slug> --card <card-id> [options]');
  console.log('');
  console.log('  --card <id>        the calculator in PM_DATA this page is about (required)');
  console.log('  --title <text>     <title> tag, 62 characters maximum');
  console.log('  --description <t>  meta description, 110 to 175 characters');
  console.log('  --h1 <text>        the on-page heading');
  console.log('  --lede <text>      the sentence under the heading');
  console.log('  --related a,b,c    card ids to link at the foot of the page');
  console.log('  --no-link          do not touch index.html; print the line to add instead');
  console.log('  --dry-run          report what would change and write nothing');
}

function parseArgs(argv) {
  var opts = { related: null, link: true, dryRun: false };
  var positional = [];
  var takesValue = { '--card': 'card', '--title': 'title', '--description': 'description',
    '--h1': 'h1', '--lede': 'lede', '--related': 'related' };
  var i;

  for (i = 0; i < argv.length; i += 1) {
    var arg = argv[i];
    if (arg === '--help' || arg === '-h') { opts.help = true; }
    else if (arg === '--no-link') { opts.link = false; }
    else if (arg === '--dry-run') { opts.dryRun = true; }
    else if (Object.prototype.hasOwnProperty.call(takesValue, arg)) {
      var value = argv[i + 1];
      if (value === undefined || value.indexOf('--') === 0) {
        throw new Error(arg + ' needs a value');
      }
      opts[takesValue[arg]] = value;
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
  if (typeof opts.related === 'string') {
    opts.related = opts.related.split(',').map(function (s) { return s.trim(); })
      .filter(Boolean);
  }
  return opts;
}

function main(argv) {
  var opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error('newpage: ' + e.message);
    usage();
    return 2;
  }

  if (opts.help || !argv.length) { usage(); return opts.help ? 0 : 2; }

  var slugError = validateSlug(opts.slug);
  if (slugError) { console.error('newpage: ' + slugError); return 2; }

  if (!opts.card) {
    console.error('newpage: --card is required. It names the calculator in PM_DATA');
    console.error('         that this page is about.');
    return 2;
  }

  var indexHtml = read('index.html');
  var hit = calcpage.cardFrom(indexHtml, opts.card);
  if (!hit) {
    console.error('newpage: no calculator with id "' + opts.card + '" in PM_DATA.');
    console.error('');
    console.error('Known ids:');
    calcpage.loadData(indexHtml).categories.forEach(function (cat) {
      cat.cards.forEach(function (card) {
        console.error('  ' + card.id + new Array(Math.max(2, 26 - card.id.length)).join(' ') +
          card.name);
      });
    });
    return 2;
  }
  var card = hit.card;

  /* Refuse to overwrite. Every one of these is a file a person may have
     spent an afternoon on. */
  var clashes = [];
  calcpage.manifest().forEach(function (spec) {
    if (spec.slug === opts.slug) clashes.push('content/pages.json already lists the slug "' + opts.slug + '"');
    if (spec.card === opts.card) clashes.push('content/pages.json already has a page for card "' + opts.card + '" (' + spec.slug + ')');
  });
  if (fs.existsSync(rel(path.join('content', opts.slug + '.html')))) {
    clashes.push('content/' + opts.slug + '.html already exists');
  }
  if (fs.existsSync(rel(opts.slug + '.html'))) {
    clashes.push(opts.slug + '.html already exists at the repository root');
  }
  if (card.page && opts.link) {
    clashes.push('the card "' + opts.card + '" already links to ' + card.page);
  }
  if (clashes.length) {
    console.error('newpage: refusing to overwrite existing work.');
    clashes.forEach(function (c) { console.error('  - ' + c); });
    return 2;
  }

  /* Build every edit in memory first, verify the risky one, and only then
     touch the working tree. A failure half way through would otherwise
     leave a manifest entry pointing at prose that does not exist. */
  var writes = [];
  writes.push({
    path: path.join('content', opts.slug + '.html'),
    body: proseStub(opts.slug, card, opts)
  });
  writes.push(bumpHomeUpdated(addToManifest(opts.slug, card, opts)));

  if (opts.link) {
    var linked;
    try {
      linked = linkFromDesk(opts.slug, opts.card);
      verifyLink(linked.body, opts.card, opts.slug);
    } catch (e) {
      console.error('newpage: could not add the desk link to index.html — ' + e.message);
      console.error('         Nothing has been written. Re-run with --no-link to do');
      console.error('         the other three edits and add the field by hand.');
      return 1;
    }
    writes.push(linked);
  }

  if (opts.dryRun) {
    console.log('newpage: --dry-run, nothing written. Would change:');
    writes.forEach(function (w) {
      console.log('  ' + w.path + '  (' + Buffer.byteLength(w.body) + ' bytes)');
    });
    return 0;
  }

  writes.forEach(function (w) {
    fs.writeFileSync(rel(w.path), w.body);
    console.log('wrote  ' + w.path);
  });

  console.log('');
  console.log('Scaffolded /' + opts.slug + '.html for "' + card.name + '".');
  console.log('');
  console.log('Now, in order:');
  console.log('  1. Write content/' + opts.slug + '.html — at least 1000 words of plain');
  console.log('     text, or tests/pages.js fails the page as thin.');
  console.log('  2. Replace the TODO title, description and lede in content/pages.json.');
  console.log('     The title must fit 62 characters and the description 110 to 175,');
  console.log('     and the suite checks both.');
  if (!opts.link) {
    console.log('  3. Add this line to the "' + opts.card + '" card in index.html, so the');
    console.log('     desk links to the page in both the template and the static mirror:');
    console.log('');
    console.log('         page: \'' + opts.slug + '.html\',');
    console.log('');
    console.log('  4. Run: node tools/check.js');
  } else {
    console.log('  3. Run: node tools/check.js');
  }
  console.log('');
  console.log('The generated ' + opts.slug + '.html appears at step ' +
    (opts.link ? '3' : '4') + '. Commit it with the rest.');
  return 0;
}

module.exports = { main: main, validateSlug: validateSlug };

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
