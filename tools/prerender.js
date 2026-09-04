/* Commit-time prerender for the Calculation Desk.

   index.html ships one empty container — `<div id="calc-sections"></div>` —
   and builds all 14 domains and 34 calculators into it from PM_DATA on load.
   That is fine for a browser and invisible to everything else: a fetcher that
   does not run JavaScript sees a few hundred words of hero copy and none of
   the 103 metrics. TCPI, EMV, DPMO, PTA and "earned schedule" do not occur
   once in the bytes on the wire.

   This tool closes that gap without adding a build step to the *serve* path.
   It runs on a developer's machine before a commit, derives a plain static
   mirror of the desk from the same PM_DATA the page runs on, and splices it
   into index.html between two marker comments. The committed file is still
   the shipped artifact — there is nothing to build at deploy time, and the
   tool needs nothing but a bare `node`.

   Progressive enhancement, not hydration. The static block carries prose,
   not state. On load the render script empties #calc-sections and builds the
   real interactive desk over the top, so a browser never sees this markup;
   only a non-JS consumer does. Nothing here is read back by the page.

     node tools/prerender.js                 rewrite index.html in place
     node tools/prerender.js --check         exit 1 if the file is stale
     node tools/prerender.js --file <path>   operate on some other copy

   Idempotent by construction: the block is a pure function of PM_DATA, and
   splicing replaces the whole marked region, so a second run is a no-op that
   produces a byte-identical file. `tests/prerender.js` asserts exactly that
   against the committed page. */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DEFAULT_FILE = path.join(ROOT, 'index.html');

var MARKER_START = '<!-- prerender:start -->';
var MARKER_END = '<!-- prerender:end -->';

/* ── escaping ────────────────────────────────────────────────────────

   Every string in PM_DATA reaches the live page through `innerHTML`, so by
   contract the data *is* authored HTML — `earned-schedule.about` relies on
   it, carrying a real `<strong>LINEAR PV</strong>`. Escaping that field
   would print the tag as text and put the static mirror out of step with the
   page it mirrors, which is the one thing this file must not do.

   So the rule is one rule, the same one the runtime uses: pass the authored
   markup through. Two corrections make that safe to write into a static file
   rather than into a live DOM.

   First, a bare `&`. Nineteen strings contain one — "Budget & Burn Rate",
   "DPMO & sigma level", "Little's Law & flow efficiency". A browser's error
   recovery renders those correctly either way, but they are a parse error in
   a served document, and the strict-ish XML and HTML parsers that sit in
   front of crawlers and extractors are exactly the audience for this block.
   Any `&` that does not already open a character reference becomes `&amp;`.

   Second, an allowlist. Pass-through is only defensible while the authored
   markup stays inline and inert, so anything outside a small set of phrasing
   elements — a `<script>`, a `<div>`, an `on*=` handler, a `javascript:` URL
   — stops the run rather than being emitted or silently mangled. PM_DATA is
   the repository's own content, so this is a guard against a future mistake,
   not against an attacker; it is loud because a silent one would let the
   static block drift from the rendered page unnoticed.

   Attribute values are a different problem and get a different function:
   nothing authored is ever interpolated into one, only slugs this file
   builds itself, and those are escaped outright. */

var ALLOWED_TAGS = {
  a: true, abbr: true, b: true, br: true, code: true, em: true,
  i: true, span: true, strong: true, sub: true, sup: true
};

var AMPERSAND = /&(?!#[0-9]+;|#[xX][0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]*;)/g;

function fail(where, message) {
  throw new Error('prerender: ' + where + ': ' + message);
}

/* Authored HTML from PM_DATA, checked and normalised. */
function html(value, where) {
  var text = value === null || value === undefined ? '' : String(value);
  var tag = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  var match;

  if (text.indexOf('<') !== -1) {
    while ((match = tag.exec(text)) !== null) {
      var name = match[1].toLowerCase();
      var attrs = match[2] || '';
      if (!ALLOWED_TAGS[name]) {
        fail(where, 'authored markup uses <' + name + '>, which is not on the ' +
          'prerender allowlist (' + Object.keys(ALLOWED_TAGS).join(', ') + '). ' +
          'Either keep the content inline or widen ALLOWED_TAGS deliberately.');
      }
      if (/\son[a-zA-Z]+\s*=/.test(attrs)) {
        fail(where, 'authored markup carries an inline event handler');
      }
      if (/javascript\s*:/i.test(attrs)) {
        fail(where, 'authored markup carries a javascript: URL');
      }
    }
    /* A `<` that opened nothing the scanner recognised is a literal one the
       author meant as text — "< 0.5", say. The runtime would render it as a
       stray bracket too, but in a static file it can swallow the rest of the
       document, so it is worth refusing rather than guessing. */
    if (/<(?![\/!]?[a-zA-Z])/.test(text)) {
      fail(where, 'contains a bare "<" that opens no tag; write it as &lt;');
    }
  }

  return text.replace(AMPERSAND, '&amp;');
}

/* Plain text, escaped outright.

   Not every PM_DATA string is authored HTML, and the page itself draws the
   line: `PM_CHART_MOUNT` builds a chart's `title` and `purpose` through
   `PM_CHARTS.esc()`, so those two are plain text by the runtime's own
   contract and a `<` in them would already show as a bracket on screen. The
   mirror escapes exactly what the page escapes. */
function text(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Slugs and anchors this file builds. Never authored content. */
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/* ── markup ──────────────────────────────────────────────────────────

   Deliberately plain. The block has no stylesheet of its own — index.html is
   self-contained and this tool does not touch its `<style>` block — so it is
   built from elements a browser renders sensibly with no CSS at all: headings
   in a real hierarchy, a `<pre>` for the formula lines, a `<dl>` pairing each
   parameter and result with what it means.

   Class names are namespaced `prerender-*`, and so are the ids: the runtime's
   own `cat-<id>` and `calc-<id>` are deliberately NOT reused. If the one-line
   runtime change to clear the container is ever dropped, the failure is a
   page that says everything twice — not a page carrying 48 duplicate ids and
   ambiguous deep links.

   The block links only to its own anchors, never to the runtime's. A
   `href="#calc-emv"` here would look like a deep link and be a dead one for
   the only reader who can see it: the target element does not exist until
   JavaScript builds it, so a non-JS consumer following it lands nowhere.
   `tests/stylesheet.js` already refuses fragment links that resolve to no
   static id, and it is right to — the static block has to be navigable on its
   own terms or not claim to be navigable at all. */

function cardMarkup(card, index, out) {
  var where = 'card ' + card.id;

  out.push('<article class="prerender-card" id="prerender-calc-' + attr(card.id) + '">');
  out.push('<h3>' + index + ' — ' + html(card.name, where + '.name') + '</h3>');
  out.push('<p class="prerender-tagline">' + html(card.tagline, where + '.tagline') + '</p>');
  out.push('<p class="prerender-about">' + html(card.about, where + '.about') + '</p>');

  if (card.page) {
    out.push('<p class="prerender-page"><a href="' + attr(card.page) +
      '">Full analysis</a></p>');
  }

  if (card.formula && card.formula.length) {
    out.push('<pre class="prerender-formula"><code>' +
      card.formula.map(function (line, i) {
        return html(line, where + '.formula[' + i + ']');
      }).join('\n') +
      '</code></pre>');
  }

  out.push('<h4>Parameters</h4>');
  out.push('<dl class="prerender-params">');
  card.inputs.forEach(function (inp) {
    var at = where + '.inputs.' + inp.key;
    out.push('<dt>' + html(inp.label, at + '.label') + '</dt>');
    out.push('<dd>' + html(inp.meaning, at + '.meaning') + '</dd>');
    if (inp.placeholder) {
      out.push('<dd class="prerender-eg">' + html(inp.placeholder, at + '.placeholder') + '</dd>');
    }
  });
  out.push('</dl>');

  out.push('<h4>Results</h4>');
  /* Consecutive outputs sharing a `group` are one run, exactly as the runtime
     groups them — the grouping is positional, not a key, so two separated
     runs with the same name stay two runs. */
  var groups = [];
  card.outputs.forEach(function (o) {
    var name = o.group || '';
    var last = groups.length ? groups[groups.length - 1] : null;
    if (!last || last.name !== name) {
      last = { name: name, outs: [] };
      groups.push(last);
    }
    last.outs.push(o);
  });

  groups.forEach(function (group) {
    if (group.name) {
      out.push('<h5>' + html(group.name, where + '.group') + '</h5>');
    }
    out.push('<dl class="prerender-results">');
    group.outs.forEach(function (o) {
      var at = where + '.outputs.' + o.key;
      out.push('<dt>' + html(o.label, at + '.label') + '</dt>');
      out.push('<dd>' + html(o.meaning, at + '.meaning') + '</dd>');
    });
    out.push('</dl>');
  });

  if (card.howto && card.howto.length) {
    out.push('<h4>How to use it</h4>');
    out.push('<ol class="prerender-howto">');
    card.howto.forEach(function (step, i) {
      out.push('<li>' + html(step, where + '.howto[' + i + ']') + '</li>');
    });
    out.push('</ol>');
  }

  /* A plot cannot be prerendered — it is drawn to a canvas from numbers the
     reader has not typed yet, and there are no numbers until they do. What
     can be carried across is what the chart is *for*: its title and the one
     sentence under it saying what the picture shows. That sentence is often
     the clearest statement of the relationship on the whole card, and it is
     the only part a reader without JavaScript could otherwise never see. */
  if (card.charts && card.charts.length) {
    out.push('<h4>Charts</h4>');
    out.push('<dl class="prerender-charts">');
    card.charts.forEach(function (def) {
      out.push('<dt>' + text(def.title) + '</dt>');
      out.push('<dd>' + text(def.purpose) + '</dd>');
    });
    out.push('</dl>');
  }

  out.push('</article>');
}

/* One array entry per line of output — except a `<pre>`, which is a single
   entry carrying its own newlines. See `apply`. */
function generateLines(data) {
  var out = [];
  var domains = data.categories.length;
  var calculators = 0;
  var metrics = 0;

  data.categories.forEach(function (cat) {
    cat.cards.forEach(function (card) {
      calculators += 1;
      metrics += card.outputs.length;
    });
  });

  out.push('<div class="prerender" id="prerender-desk">');
  out.push('<p class="prerender-lede">A text index of the ' + domains + ' domains, ' +
    calculators + ' calculators and ' + metrics + ' metrics on this page. ' +
    'Every figure computes in your browser; open the page with JavaScript ' +
    'enabled for the working instruments.</p>');

  /* One link per domain, pointing inside this block. Enough to navigate 34
     calculators without a scroll bar, and short enough not to become a second
     table of contents competing with the sidebar the runtime builds. */
  out.push('<ol class="prerender-toc">');
  data.categories.forEach(function (cat, i) {
    out.push('<li><a href="#prerender-cat-' + attr(cat.id) + '">' +
      pad2(i + 1) + ' — ' + html(cat.name, 'category ' + cat.id + '.name') + '</a></li>');
  });
  out.push('</ol>');

  data.categories.forEach(function (cat, i) {
    var where = 'category ' + cat.id;
    out.push('<section class="prerender-category" data-family="' +
      attr(cat.instrumentFamily || 'control-room') + '" id="prerender-cat-' + attr(cat.id) + '">');
    out.push('<h2>' + pad2(i + 1) + ' — ' + html(cat.name, where + '.name') + '</h2>');
    out.push('<p class="prerender-blurb">' + html(cat.blurb, where + '.blurb') + '</p>');
    out.push('<p class="prerender-citation">' + html(cat.citation, where + '.citation') + '</p>');
    cat.cards.forEach(function (card, j) {
      cardMarkup(card, pad2(i + 1) + '.' + (j + 1), out);
    });
    out.push('</section>');
  });

  out.push('</div>');
  return out;
}

/* The block as one string, for reading and diffing. `apply` wants the array:
   see the note on indentation below. */
function generate(data) {
  return generateLines(data).join('\n');
}

/* ── splicing ────────────────────────────────────────────────────────

   The markers own the region between them and nothing else. Indentation is
   taken from the line the start marker sits on, so the block lands at the
   depth the author placed it at and stays there across runs. */

function findRegion(page) {
  var start = page.indexOf(MARKER_START);
  var end = page.indexOf(MARKER_END);

  if (start === -1 && end === -1) return { present: false };
  if (start === -1 || end === -1) {
    fail('markers', 'found ' + (start === -1 ? MARKER_END : MARKER_START) +
      ' without its pair');
  }
  if (end < start) fail('markers', MARKER_END + ' precedes ' + MARKER_START);
  if (page.indexOf(MARKER_START, start + 1) !== -1 ||
      page.indexOf(MARKER_END, end + 1) !== -1) {
    fail('markers', 'more than one prerender region in the file');
  }

  var lineStart = page.lastIndexOf('\n', start) + 1;
  var lead = page.slice(lineStart, start);
  /* Only whitespace may precede the marker; anything else means the marker
     was pasted mid-line and re-indenting would corrupt the surrounding
     markup. */
  var indent = /^[ \t]*$/.test(lead) ? lead : '';

  return {
    present: true,
    indent: indent,
    bodyStart: start + MARKER_START.length,
    bodyEnd: end,
    body: page.slice(start + MARKER_START.length, end)
  };
}

function apply(page, data) {
  var region = findRegion(page);
  if (!region.present) return page;

  /* Indent per generated line, never per newline. The formula blocks are
     `<pre>`, where every leading space is content: indenting their inner
     lines to match the surrounding markup would push each continuation line
     six columns right and destroy the column alignment the formulas are
     written in — `CV  = EV − AC        SV  = EV − PV` reads as two aligned
     equations only while that whitespace is exactly what the author typed.
     So a `<pre>` arrives as one entry and only its opening line is indented;
     its body stays flush, which is how pre-formatted text has to sit inside
     indented HTML. */
  var block = generateLines(data).map(function (line) {
    return line === '' ? '' : region.indent + line;
  }).join('\n');

  return page.slice(0, region.bodyStart) +
    '\n' + block + '\n' + region.indent +
    page.slice(region.bodyEnd);
}

function isCurrent(page, data) {
  return apply(page, data) === page;
}

/* ── cli ─────────────────────────────────────────────────────────── */

function loadData(file) {
  /* Required lazily so `tests/prerender.js` can pull in `generate` and
     `apply` without dragging the harness in twice — the suite already holds
     one parsed page and passes its PM_DATA straight through. */
  var harness = require(path.join(ROOT, 'tests', 'harness.js'));
  return harness.loadPage(file).sandbox.PM_DATA;
}

function main(argv) {
  /* Every failure this tool can hit is a content or placement mistake with a
     sentence that explains it. A Node stack trace on top of that sentence
     buries it, so the CLI reports the message and gets out of the way; the
     exported functions still throw, because a suite wants the stack. */
  try {
    return run(argv);
  } catch (e) {
    console.error(String(e.message || e));
    return 2;
  }
}

function run(argv) {
  var checkOnly = false;
  var file = DEFAULT_FILE;
  var i;

  for (i = 0; i < argv.length; i += 1) {
    var arg = argv[i];
    if (arg === '--check') {
      checkOnly = true;
    } else if (arg === '--file') {
      file = argv[i + 1];
      i += 1;
      if (!file) {
        console.error('prerender: --file needs a path');
        return 2;
      }
    } else if (arg.indexOf('--file=') === 0) {
      file = arg.slice('--file='.length);
    } else {
      console.error('prerender: unknown argument ' + arg);
      console.error('Usage: node tools/prerender.js [--check] [--file <path>]');
      return 2;
    }
  }

  file = path.isAbsolute(file) ? file : path.join(process.cwd(), file);

  var page = fs.readFileSync(file, 'utf8');
  var region = findRegion(page);

  if (!region.present) {
    if (checkOnly) {
      /* Nothing to be stale against. --check is meant to be wired into CI
         before the block exists, so an uninstalled region is a pass, the
         same way the Earned Schedule suite waits for its card. */
      console.log('prerender: no ' + MARKER_START + ' region in ' +
        path.relative(process.cwd(), file) + ' — nothing to check');
      return 0;
    }
    console.error('prerender: no ' + MARKER_START + ' … ' + MARKER_END +
      ' region in ' + path.relative(process.cwd(), file));
    console.error('  Add the pair inside <div id="calc-sections"> and re-run.');
    return 1;
  }

  var next = apply(page, loadData(file));
  var label = path.relative(process.cwd(), file) || file;

  if (next === page) {
    console.log('prerender: ' + label + ' is up to date');
    return 0;
  }

  if (checkOnly) {
    console.error('prerender: ' + label + ' is STALE — the committed block does ' +
      'not match PM_DATA.');
    console.error('  Run `node tools/prerender.js` and commit the result.');
    return 1;
  }

  fs.writeFileSync(file, next);
  console.log('prerender: rewrote ' + label + ' (' +
    (Buffer.byteLength(next) - Buffer.byteLength(page) >= 0 ? '+' : '') +
    (Buffer.byteLength(next) - Buffer.byteLength(page)) + ' bytes)');
  return 0;
}

module.exports = {
  MARKER_START: MARKER_START,
  MARKER_END: MARKER_END,
  generate: generate,
  /* One card's markup on its own, for the per-calculator pages built by
     tools/calcpage.js. Those pages hold a single calculator, so the domain
     index and the whole-desk lede above would both be nonsense there — but
     the card block itself is exactly the same mirror, and must stay so. */
  cardMarkup: cardMarkup,
  generateLines: generateLines,
  apply: apply,
  isCurrent: isCurrent,
  findRegion: findRegion,
  html: html,
  main: main
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
