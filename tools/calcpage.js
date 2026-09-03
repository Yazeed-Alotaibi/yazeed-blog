/* Builds a standalone page for one calculator.

   The point of this script is that there is no second copy of anything. The
   stylesheet, the calculator definitions, the chart renderers, the spreadsheet
   export and the rendering engine are all lifted out of `index.html` at build
   time, so a page cannot drift away from the desk it came from. What the page
   adds is its own: a title, a description, a heading, and the long-form prose
   in `content/<slug>.html`.

   The engine is not modified. It renders whatever categories PM_DATA holds, so
   the page narrows PM_DATA to a single card and lets it do exactly what it
   does on the desk. That is why the calculator here behaves identically —
   it is the same code, not a port of it.

     node tools/calcpage.js earned-value-analysis        # write the page
     node tools/calcpage.js --all                        # every page in the manifest
     node tools/calcpage.js earned-value-analysis --check # fail if stale

   Commit the result. There is no build step at serve time; the generated file
   is the shipped artifact, same as `tools/prerender.js` output. */

'use strict';

var fs = require('fs');
var path = require('path');

var prerender = require('./prerender.js');

var ROOT = path.join(__dirname, '..');
var SITE = 'https://yazeed.blog';

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Google's tag, identical on every shipped page. page_location omits the
   hash so calculator inputs in a copied deep-link are not sent with the
   page view. */
function googleTag() {
  return [
    '  <!-- Google tag (gtag.js). page_location omits the hash so calculator',
    '       inputs in a copied deep-link are not sent with the page view. -->',
    '  <script async src="https://www.googletagmanager.com/gtag/js?id=G-J4XTN125MF"></script>',
    '  <script>',
    '    window.dataLayer = window.dataLayer || [];',
    '    function gtag(){dataLayer.push(arguments);}',
    "    gtag('js', new Date());",
    "    gtag('config', 'G-J4XTN125MF', {",
    "      page_location: location.protocol + '//' + location.host + location.pathname",
    '    });',
    '  </script>'
  ].join('\n');
}

/* ── lifting the shared parts out of index.html ─────────────────── */

function styleBlock(html) {
  var m = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!m) throw new Error('index.html has no <style> block');
  return m[1];
}

/* Executable script blocks, in document order, keyed by a phrase from the
   comment each one opens with. Matching on the comment rather than on
   position means inserting a new module cannot silently reorder these. */
var WANTED = [
  ['data', /calculator definitions/],
  ['xlsx', /PM_XLSX/],
  ['charts', /instrument plotting/],
  ['export', /PM_EXPORT/],
  ['mount', /chart mounting/],
  ['desk', /rendering and live computation/]
];

function scriptBlocks(html) {
  var re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  var found = {};
  var m;
  while ((m = re.exec(html)) !== null) {
    if (/\bsrc=|\btype\s*=/.test(m[1])) continue;
    var head = m[2].slice(0, 400);
    WANTED.forEach(function (pair) {
      if (!found[pair[0]] && pair[1].test(head)) found[pair[0]] = m[2];
    });
  }
  WANTED.forEach(function (pair) {
    if (!found[pair[0]]) {
      throw new Error('could not find the "' + pair[0] + '" script block in ' +
        'index.html — its opening comment may have changed');
    }
  });
  return found;
}

/* The definitions evaluate cleanly on their own; nothing in that block
   touches a document. Returns the whole sandbox because the block defines
   two things — PM_DATA and the EXAMPLES pack beside it — and narrowing has
   to check both. */
function evaluate(source) {
  var sandbox = { module: { exports: {} }, console: console, Math: Math, Date: Date };
  sandbox.window = sandbox;
  require('vm').runInNewContext(source, sandbox);
  return sandbox;
}

function loadData(html) {
  return evaluate(scriptBlocks(html).data).PM_DATA;
}

function cardFrom(html, id) {
  var hit = null;
  loadData(html).categories.forEach(function (cat) {
    cat.cards.forEach(function (card) {
      if (card.id === id) hit = { card: card, category: cat };
    });
  });
  return hit;
}

/* The full desk's calculator count, before the page narrows PM_DATA to one
   card. The footer states this number so a reader landing on a subpage can
   see the scale of the desk they came from — and it has to be derived from
   the same source the desk renders, not hard-coded, or it drifts the way
   `tests/counts.js` guards against on the homepage. */
function countCalculators(html) {
  var n = 0;
  loadData(html).categories.forEach(function (cat) {
    n += cat.cards.length;
  });
  return n;
}

/* ── narrowing the definitions to one card ──────────────────────── */

/* A page that shows one calculator has no use for the other thirty-three,
   but it used to ship all of them: the whole definitions block went into
   the page and a script immediately below it filtered the rest away at
   run time. Correct, and about 134 kB of prose, formulas and interpret
   functions that every visitor downloaded and parsed so the page could
   throw them away before drawing anything. The cost was per page, so it
   grew with the manifest rather than staying put.

   This does the same filtering here, on the source text, so the bytes
   never leave. Slicing text rather than re-serialising the parsed object
   is deliberate: the compute and interpret functions close over the
   helpers at the top of the block (`ok`, `f2`, `npvOf` and the rest), and
   a function put back through `toString()` would lose that closure and
   fail at the first call. Keeping the prelude and cutting whole card
   literals out of the array between preserves every reference exactly.

   The cut is anchored on indentation, which is safe only for as long as
   the block stays formatted the way it is now — so `checkNarrowed` below
   proves each cut rather than trusting it. */
function narrowData(data, keep) {
  var lines = data.split('\n');
  function find(pred, from) {
    for (var i = from || 0; i < lines.length; i++) if (pred(lines[i])) return i;
    return -1;
  }

  var catsStart = find(function (l) { return l === '  var categories = ['; });
  var catsEnd = find(function (l) { return l === '  ];'; }, catsStart);
  if (catsStart === -1 || catsEnd === -1) {
    throw new Error('PM_DATA: no `var categories = [ ... ];` array to narrow');
  }

  var target = null;
  var i = catsStart + 1;
  while (i < catsEnd) {
    if (lines[i] !== '    {') { i++; continue; }
    var catStart = i;
    var catEnd = -1, j;
    for (j = catStart + 1; j < catsEnd; j++) {
      if (/^    \},?$/.test(lines[j])) { catEnd = j; break; }
    }
    if (catEnd === -1) throw new Error('PM_DATA: unclosed category at line ' + catStart);

    var open = -1;
    for (j = catStart + 1; j < catEnd; j++) if (lines[j] === '      cards: [') { open = j; break; }
    if (open === -1) throw new Error('PM_DATA: category at line ' + catStart + ' has no cards array');
    var close = -1;
    for (j = open + 1; j < catEnd; j++) if (/^      \],?$/.test(lines[j])) { close = j; break; }
    if (close === -1) throw new Error('PM_DATA: unclosed cards array at line ' + open);

    var k = open + 1;
    while (k < close) {
      if (lines[k] !== '        {') { k++; continue; }
      var cardStart = k, cardEnd = -1;
      for (j = cardStart + 1; j < close; j++) {
        if (/^        \},?$/.test(lines[j])) { cardEnd = j; break; }
      }
      if (cardEnd === -1) throw new Error('PM_DATA: unclosed card at line ' + cardStart);
      var m = /^          id: '([^']+)',$/.exec(lines[cardStart + 1] || '');
      if (!m) {
        throw new Error('PM_DATA: the card at line ' + cardStart + ' does not open with ' +
          'an `id:` field — narrowing reads the id from that line');
      }
      if (m[1] === keep) {
        if (target) throw new Error('PM_DATA: two cards share the id "' + keep + '"');
        target = { catStart: catStart, open: open, start: cardStart, end: cardEnd };
      }
      k = cardEnd + 1;
    }
    i = catEnd + 1;
  }
  if (!target) throw new Error('no card with id "' + keep + '" in PM_DATA');

  /* One category holding one card, so both closers lose their comma. */
  var out = lines.slice(0, catsStart + 1)
    .concat(lines.slice(target.catStart, target.open + 1))
    .concat(lines.slice(target.start, target.end))
    .concat(['        }', '      ]', '    }'])
    .concat(lines.slice(catsEnd));

  return narrowExamples(out, keep).join('\n');
}

/* The worked readings ride along in the same block, keyed by DOM id. The
   desk looks up `EXAMPLES['calc-' + card.id]` for the card it is rendering
   and nothing else, so every other entry is dead weight on this page too. */
function narrowExamples(lines, keep) {
  var start = -1, i;
  for (i = 0; i < lines.length; i++) if (lines[i] === 'var EXAMPLES = {') { start = i; break; }
  if (start === -1) return lines;
  var end = -1;
  for (i = start + 1; i < lines.length; i++) if (lines[i] === '};') { end = i; break; }
  if (end === -1) throw new Error('EXAMPLES: unclosed object literal');

  var want = "  'calc-" + keep + "': {";
  var kept = [];
  var k = start + 1;
  while (k < end) {
    if (!/^  '[^']+': \{$/.test(lines[k])) { k++; continue; }
    var entryEnd = -1, j;
    for (j = k + 1; j < end; j++) if (/^  \},?$/.test(lines[j])) { entryEnd = j; break; }
    if (entryEnd === -1) throw new Error('EXAMPLES: unclosed entry at line ' + k);
    if (lines[k] === want) kept = lines.slice(k, entryEnd).concat(['  }']);
    k = entryEnd + 1;
  }
  return lines.slice(0, start + 1).concat(kept).concat(lines.slice(end));
}

/* Proof, not assumption. The narrowed block has to evaluate, hold exactly
   the one card, and hold it unchanged — functions compared by source, so a
   cut that clipped an `interpret` mid-body is caught here rather than by a
   reader whose verdict line has gone blank. */
function checkNarrowed(narrowed, full, keep) {
  var sandbox = evaluate(narrowed);
  var cats = sandbox.PM_DATA && sandbox.PM_DATA.categories;
  if (!cats || cats.length !== 1 || cats[0].cards.length !== 1) {
    throw new Error('narrowing "' + keep + '": expected one category holding one card, got ' +
      (cats ? cats.length + ' holding ' + cats.map(function (c) { return c.cards.length; }).join('/') : 'nothing'));
  }

  var want = null;
  full.PM_DATA.categories.forEach(function (cat) {
    cat.cards.forEach(function (card) { if (card.id === keep) want = card; });
  });
  if (shape(cats[0].cards[0]) !== shape(want)) {
    throw new Error('narrowing "' + keep + '": the card changed on the way through');
  }

  var keys = Object.keys(sandbox.EXAMPLES || {});
  var expected = full.EXAMPLES && full.EXAMPLES['calc-' + keep] ? ['calc-' + keep] : [];
  if (keys.join(',') !== expected.join(',')) {
    throw new Error('narrowing "' + keep + '": EXAMPLES should hold ' +
      (expected.length ? expected[0] : 'nothing') + ', holds ' + (keys.join(',') || 'nothing'));
  }
  return narrowed;
}

/* A stable string for a value, functions included — `JSON.stringify` drops
   them, and a compute function is most of what a card is. */
function shape(v) {
  return JSON.stringify(v, function (k, val) {
    if (typeof val === 'function') return 'fn:' + val.toString();
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      var sorted = {};
      Object.keys(val).sort().forEach(function (key) { sorted[key] = val[key]; });
      return sorted;
    }
    return val;
  });
}


/* ── the page's own styling ─────────────────────────────────────── */

/* Everything here either undoes the desk shell (which assumes a sidebar this
   page does not have) or styles prose, which the desk has none of. */
function pageCss() {
  return [
    '/* ── one-calculator page ─────────────────────────────────────── */',
    '',
    '/* The desk is a two-column grid beside a sticky sidebar. This page has',
    '   no sidebar, so it reverts to a single column and centres itself. */',
    'body { display: block; }',
    'main { margin: 0 auto; max-width: 78ch; padding-bottom: 4rem; }',
    '',
    '/* The engine needs these to exist; this page has no use for them. */',
    '.engine-hooks { position: absolute; width: 1px; height: 1px;',
    '  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }',
    '',
    '.doc-head { display: flex; flex-wrap: wrap; align-items: baseline;',
    '  gap: .5rem 1rem; max-width: 78ch; margin: 0 auto;',
    '  padding: 1.25rem clamp(1.25rem, 4vw, 4rem) 0; }',
    '.doc-head a { color: var(--ink-2); text-decoration: none; }',
    '.doc-head a:hover { color: var(--accent); text-decoration: underline; }',
    '.doc-brand { font-family: var(--display); font-size: 1.15rem;',
    '  text-transform: uppercase; letter-spacing: .04em; color: var(--ink); }',
    '.crumbs { font-family: var(--mono); font-size: .7rem;',
    '  text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }',
    '.crumbs span { margin: 0 .35rem; }',
    '',
    '.doc-title { padding: clamp(2rem, 5vw, 3.25rem) 0 0; }',
    '.doc-title h1 { margin: 0 0 .75rem; font-family: var(--display);',
    '  font-size: clamp(2rem, 1.4rem + 3vw, 3.1rem); line-height: 1.02;',
    '  text-transform: uppercase; letter-spacing: .005em;',
    '  overflow-wrap: anywhere; }',
    '.lede { margin: 0 0 .6rem; font-size: 1.06rem; color: var(--ink-2); }',
    '.byline { margin: 0 0 2rem; font-family: var(--mono); font-size: .7rem;',
    '  text-transform: uppercase; letter-spacing: .07em; color: var(--ink-3); }',
    '.byline a { color: inherit; text-decoration: none; text-underline-offset: 2px; }',
    '.byline a:hover { color: var(--accent); text-decoration: underline; }',
    '',
    '.tool { margin: 0 0 var(--space-section); }',
    '.tool > h2 { position: absolute; width: 1px; height: 1px;',
    '  overflow: hidden; clip: rect(0 0 0 0); }',
    '',
    '/* The engine prints the domain heading and blurb above its cards. On the',
    '   desk that separates fourteen domains; here there is one card, the',
    '   breadcrumb already names the domain, and the page has its own opening.',
    '   Hiding it lifts the instrument up the page instead of restating what',
    '   the reader just read. */',
    '.tool .cat-head { display: none; }',
    '.tool .calc-card { margin-top: 0; }',
    '',
    '/* ── prose ───────────────────────────────────────────────────── */',
    '.prose { font-size: 1.02rem; line-height: 1.65; }',
    '.prose h2 { margin: var(--space-section) 0 .9rem;',
    '  font-family: var(--display); font-size: clamp(1.5rem, 1.2rem + 1.4vw, 2.1rem);',
    '  line-height: 1.06; text-transform: uppercase; letter-spacing: .01em;',
    '  padding-bottom: .5rem; border-bottom: 1px solid var(--rule-2); }',
    '.prose h3 { margin: 2rem 0 .5rem; font-family: var(--body);',
    '  font-size: 1.06rem; font-weight: 600; color: var(--ink); }',
    '.prose p, .prose li { color: var(--ink-2); }',
    '.prose li { margin-bottom: .5rem; }',
    '.prose strong { color: var(--ink); font-weight: 600; }',
    '.prose a { color: var(--accent); text-underline-offset: 2px; }',
    '',
    '/* Worked arithmetic gets the engraved-plate treatment the desk gives a',
    '   formula, so a reader recognises it as the same kind of thing. */',
    '.prose pre { margin: 1.1rem 0; padding: .95rem 1.1rem;',
    '  background: var(--sheet-sunk); border: 1px solid var(--rule);',
    '  border-radius: 3px; box-shadow: var(--sunk);',
    '  overflow-x: auto; }',
    '.prose pre code { font-family: var(--mono); font-size: .85rem;',
    '  line-height: 1.85; color: var(--ink);',
    '  font-variant-numeric: tabular-nums; white-space: pre; }',
    '.prose p code, .prose li code { font-family: var(--mono); font-size: .85em;',
    '  padding: .1em .35em; background: var(--sheet-sunk);',
    '  border: 1px solid var(--rule); border-radius: 2px; color: var(--ink); }',
    '',
    '.prose .table-wrap { overflow-x: auto; margin: 1.2rem 0; }',
    '.prose table { width: 100%; border-collapse: collapse; font-size: .93rem; }',
    '.prose th, .prose td { padding: .6rem .7rem; text-align: left;',
    '  border-bottom: 1px solid var(--rule); vertical-align: top; }',
    '.prose thead th { font-family: var(--mono); font-size: .68rem;',
    '  text-transform: uppercase; letter-spacing: .07em; color: var(--ink-3);',
    '  border-bottom: 1px solid var(--rule-2); }',
    '.prose tbody td { color: var(--ink-2); }',
    '/* A row label like "CPI \u2265 1, SPI < 1" reads badly broken across two',
    '   lines. Hold it on one where there is room; let it wrap where there is',
    '   not, since the table scrolls rather than overflows. */',
    '@media (min-width: 34em) {',
    '  .prose tbody td:first-child { white-space: nowrap; }',
    '}',
    '',
    '/* ── related + footer ────────────────────────────────────────── */',
    '.related { margin: var(--space-section) 0 0; padding-top: 1.4rem;',
    '  border-top: 1px solid var(--rule-2); }',
    '.related h2 { margin: 0 0 .9rem; font-family: var(--mono); font-size: .72rem;',
    '  text-transform: uppercase; letter-spacing: .09em; color: var(--ink-3); }',
    '.related ul { list-style: none; margin: 0; padding: 0; display: grid;',
    '  gap: .5rem; }',
    '.related a { display: block; min-height: 44px; padding: .7rem .9rem;',
    '  background: var(--sheet); border: 1px solid var(--rule-2);',
    '  border-radius: 2px; box-shadow: var(--lip);',
    '  color: var(--ink); text-decoration: none; }',
    '.related a:hover { border-color: var(--accent); color: var(--accent); }',
    '.related b { display: block; font-weight: 600; }',
    '.related span { font-family: var(--mono); font-size: .72rem;',
    '  color: var(--ink-3); }',
    '.related a:hover span { color: var(--accent); }',
    '',
    '.doc-foot { max-width: 78ch; margin: 0 auto;',
    '  padding: 2rem clamp(1.25rem, 4vw, 4rem) 3rem;',
    '  border-top: 1px solid var(--rule); font-size: .85rem; color: var(--ink-3); }',
    '.doc-foot a { color: var(--ink-2); }',
    '',
    '@media (max-width: 40em) {',
    '  main { padding-left: clamp(1rem, 4vw, 2rem); padding-right: clamp(1rem, 4vw, 2rem); }',
    '}'
  ].join('\n');
}

/* ── the page ───────────────────────────────────────────────────── */

function build(spec, html, manifestPath) {
  var found = cardFrom(html, spec.card);
  if (!found) throw new Error('no card with id "' + spec.card + '" in PM_DATA');

  var blocks = scriptBlocks(html);
  /* The definitions as the desk holds them, kept so the narrowed copy below
     can be checked against the original card rather than merely parsed. */
  var defs = evaluate(blocks.data);
  /* The full desk's calculator count, before the page narrows PM_DATA to a
     single card. Interpolated into the footer so the number can never drift
     from the desk the reader came from. */
  var totalCards = countCalculators(html);
  /* The file is served as it is named. Dropping the extension would look
     better but needs a mod_rewrite rule, and a canonical that points at a URL
     the host does not answer is worse than an honest one. See the note in
     content/pages.json if that rewrite ever lands. */
  var url = SITE + '/' + spec.slug + '.html';
  var prose = read(path.join('content', spec.slug + '.html'))
    /* A table needs a scroll container of its own, or a wide one pushes the
       whole page sideways on a phone. Wrapping here keeps the content file
       free of layout markup. */
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');

  var related = (spec.related || []).map(function (id) {
    var hit = cardFrom(html, id);
    return hit ? { id: id, name: hit.card.name, tagline: hit.card.tagline } : null;
  }).filter(Boolean);

  var mirror = [];
  prerender.cardMarkup(found.card, '1', mirror);
  var staticCard = mirror.map(function (line) { return '          ' + line; }).join('\n');

  var jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Calculation Desk', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: found.category.name,
            item: SITE + '/#cat-' + found.category.id },
          { '@type': 'ListItem', position: 3, name: found.card.name, item: url }
        ]
      },
      {
        '@type': 'SoftwareApplication',
        name: found.card.name,
        url: url,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        inLanguage: 'en',
        isAccessibleForFree: true,
        featureList: found.card.outputs.map(function (o) { return o.label; }),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      },
      {
        '@type': 'TechArticle',
        headline: spec.h1,
        description: spec.description,
        inLanguage: 'en',
        mainEntityOfPage: url,
        datePublished: spec.updated,
        dateModified: spec.updated,
        author: {
          '@type': 'Person',
          name: 'Yazeed Alotaibi',
          jobTitle: 'Project Engineer',
          sameAs: ['https://sa.linkedin.com/in/yazeed-alotaibi-rmp-prince2']
        }
      }
    ]
  };

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    googleTag(),
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>' + esc(spec.title) + '</title>',
    '  <meta name="description" content="' + esc(spec.description) + '">',
    '  <link rel="canonical" href="' + url + '">',
    '  <link rel="icon" href="' + /href="(data:image\/svg\+xml[^"]*)"/.exec(html)[1] + '">',
    '  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#d9d7cf">',
    '  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#131518">',
    '  <meta property="og:type" content="article">',
    '  <meta property="og:url" content="' + url + '">',
    '  <meta property="og:site_name" content="Calculation Desk">',
    '  <meta property="og:title" content="' + esc(spec.title) + '">',
    '  <meta property="og:description" content="' + esc(spec.description) + '">',
    '  <meta property="og:image" content="' + SITE + '/og.png">',
    '  <meta property="og:image:width" content="1200">',
    '  <meta property="og:image:height" content="630">',
    '  <meta property="og:image:alt" content="' + esc(found.card.name) +
      ' on the Calculation Desk — an instrument panel of project-management figures.">',
    '  <meta property="og:locale" content="en_US">',
    '  <meta name="twitter:card" content="summary_large_image">',
    '  <meta name="twitter:image:alt" content="' + esc(found.card.name) +
      ' on the Calculation Desk.">',
    '  <link rel="preload" as="font" type="font/woff2" crossorigin href="fonts/big-shoulders-display-700.woff2">',
    '  <link rel="preload" as="font" type="font/woff2" crossorigin href="fonts/libre-franklin-var.woff2">',
    '  <style>' + styleBlock(html) + '</style>',
    '  <style>',
    pageCss(),
    '  </style>',
    '  <script type="application/ld+json">',
    JSON.stringify(jsonLd, null, 2),
    '  </script>',
    '</head>',
    '<body>',
    '  <a class="skip-link" href="#main">Skip to the calculator</a>',
    '',
    '  <header class="doc-head">',
    '    <a class="doc-brand" href="/">Calculation Desk</a>',
    '    <nav class="crumbs" aria-label="Breadcrumb">',
    '      <a href="/">Desk</a><span aria-hidden="true">·</span>' +
      '<a href="/#cat-' + found.category.id + '">' + esc(found.category.name) + '</a>' +
      '<span aria-hidden="true">·</span>' + esc(found.card.name),
    '    </nav>',
    '  </header>',
    '',
    '  <main id="main">',
    '    <article>',
    '      <div class="doc-title">',
    '        <h1>' + esc(spec.h1) + '</h1>',
    '        <p class="lede">' + esc(spec.lede) + '</p>',
    '        <p class="byline"><a href="/#about-h">Yazeed Alotaibi</a> · PMI-RMP · PRINCE2 · updated ' +
      esc(spec.updated) + '</p>',
    '      </div>',
    '',
    '      <section class="tool">',
    '        <h2>The calculator</h2>',
    /* The container ships with the same static mirror tools/prerender.js
       splices into the desk, for two reasons. A fetcher that runs no
       JavaScript still gets the formula, the inputs and every metric. And a
       browser gets something occupying this space during parse, so building
       the real instrument over the top does not shove the article below it
       down the page — that shift measured 0.54 on a phone before this block
       existed, against a 0.1 budget. */
    '        <div id="calc-sections">',
    '          ' + prerender.MARKER_START,
    staticCard,
    '          ' + prerender.MARKER_END,
    '        </div>',
    '      </section>',
    '',
    '      <div class="prose">',
    prose.trim(),
    '      </div>',
    '',
    related.length ? [
      '      <nav class="related">',
      '        <h2>Related calculators</h2>',
      '        <ul>',
      related.map(function (r) {
        return '          <li><a href="/#calc-' + r.id + '"><b>' + esc(r.name) +
          '</b><span>' + esc(r.tagline) + '</span></a></li>';
      }).join('\n'),
      '        </ul>',
      '      </nav>'
    ].join('\n') : '',
    '    </article>',
    '  </main>',
    '',
    '  <footer class="doc-foot">',
    '    <p>Every figure on this page is calculated in your browser. The numbers',
    '    you type are not sent to us. Google Analytics records that the page was',
    '    visited. <a href="/">Back to all ' + totalCards + ' calculators</a>.</p>',
    '  </footer>',
    '',
    '  <!-- The rendering engine expects these; this page has no use for them,',
    '       so they exist off-screen rather than being coded around. Changing',
    '       the engine to make them optional would mean maintaining two. -->',
    '  <div class="engine-hooks" aria-hidden="true">',
    '    <input id="search" type="search" tabindex="-1" aria-hidden="true">',
    '    <div id="cat-nav"></div>',
    '    <p id="no-results" hidden></p>',
    '    <p id="desk-stats"></p>',
    '  </div>',
    '',
    /* One calculator, not thirty-four. The engine renders whatever PM_DATA
       holds, so narrowing the definitions is all it takes — no branch in the
       renderer, and nothing on this page that the desk does not also run.
       The cut happens here rather than in a script on the page so the other
       thirty-three are never sent, and is proved before it is written. */
    '  <script>' + checkNarrowed(narrowData(blocks.data, spec.card), defs, spec.card) + '</script>',
    '  <script>' + blocks.xlsx + '</script>',
    '  <script>' + blocks.charts + '</script>',
    '  <script>' + blocks.export + '</script>',
    '  <script>' + blocks.mount + '</script>',
    '  <script>' + blocks.desk + '</script>',
    '</body>',
    '</html>',
    ''
  ].filter(function (line) { return line !== ''; }).join('\n');
}

/* ── cli ────────────────────────────────────────────────────────── */

function manifest() {
  return JSON.parse(read(path.join('content', 'pages.json'))).pages;
}

function main(argv) {
  var check = argv.indexOf('--check') !== -1;
  var all = argv.indexOf('--all') !== -1;
  var slugs = argv.filter(function (a) { return a.charAt(0) !== '-'; });
  var html = read('index.html');
  var specs = manifest().filter(function (s) {
    return all || slugs.indexOf(s.slug) !== -1;
  });

  if (!specs.length) {
    console.error('nothing to build. Pass a slug from content/pages.json, or --all.');
    console.error('known slugs: ' + manifest().map(function (s) { return s.slug; }).join(', '));
    process.exit(2);
  }

  var stale = [];
  specs.forEach(function (spec) {
    var out = spec.slug + '.html';
    var next = build(spec, html);
    var prev = fs.existsSync(path.join(ROOT, out)) ? read(out) : null;
    if (check) {
      if (prev !== next) stale.push(out);
      return;
    }
    fs.writeFileSync(path.join(ROOT, out), next);
    console.log((prev === next ? 'unchanged  ' : 'wrote      ') + out +
      '  (' + next.length + ' bytes)');
  });

  if (check) {
    if (stale.length) {
      console.error('stale, re-run tools/calcpage.js: ' + stale.join(', '));
      process.exit(1);
    }
    console.log('calcpage: every generated page is current');
  }
}

if (require.main === module) main(process.argv.slice(2));
module.exports = {
  build: build,
  manifest: manifest,
  scriptBlocks: scriptBlocks,
  /* Exported for tools/newpage.js, which has to answer two questions before
     it scaffolds anything: does this card id exist, and what is it called?
     Both are already solved here, and a second copy of the sandbox in
     another file is exactly the drift this repository keeps designing out. */
  loadData: loadData,
  cardFrom: cardFrom
};
