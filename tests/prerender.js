/* Drift tripwire for the committed prerender block.

   `tools/prerender.js` writes a static text mirror of the desk into
   index.html so that a fetcher which does not run JavaScript still sees the
   14 domains, 34 calculators and 103 metrics. Because it is committed rather
   than built at serve time, it can silently fall out of step with PM_DATA the
   moment a card is added, renamed or reworded — and unlike `tests/counts.js`
   the drift has no visible symptom in a browser at all, since the browser
   throws the block away on load. Nobody would notice for months.

   So this is `--check`, in process: regenerate the block from the PM_DATA the
   suite already parsed and assert the file on disk is byte-identical. It is
   the same guarantee the CLI gives, run against the same page every other
   suite reads.

   Self-activating, the way `tests/earned-schedule.js` waits for its card: no
   markers in the file means the block has not been installed yet, which is a
   pass, not a failure. The suite has to stay green from the commit before the
   one that adds it. */

'use strict';

var H = require('./harness');
var prerender = require('../tools/prerender');

var TITLE = 'Prerender freshness';

/* Words a non-JS fetcher must be able to find. Every one of them lives only
   inside PM_DATA today; if the static block stops carrying them it has
   stopped doing the single job it exists for, whatever else still matches. */
var PROOF_TERMS = ['TCPI', 'EMV', 'DPMO', 'PTA', 'earned schedule'];

function run(page, options) {
  var html = page.html;
  var data = page.sandbox.PM_DATA;
  var region;

  try {
    region = prerender.findRegion(html);
  } catch (e) {
    H.suite('prerender markers');
    H.check('prerender markers are well formed', false, e.message);
    return;
  }

  if (!region.present) {
    if (!options || !options.quiet) {
      console.log('prerender: no marker region in the page, block not installed yet');
    }
    H.suite('guarded integration');
    H.check('prerender check waits for the marker region', true);
    return;
  }

  H.suite('prerender freshness');

  var regenerated;
  try {
    regenerated = prerender.apply(html, data);
  } catch (e) {
    H.check('the block regenerates from PM_DATA', false, e.message);
    return;
  }

  if (!H.check('committed block matches PM_DATA byte for byte',
      regenerated === html,
      'index.html is stale — run `node tools/prerender.js` and commit the result')) {
    return;
  }

  /* Byte-identical is the whole contract, so everything below is a check on
     the generator rather than on the file: it can only fail if the tool
     itself regressed. Cheap, and it is what turns a green run into evidence
     that the block is worth shipping. */
  H.check('regenerating twice is idempotent',
    prerender.apply(regenerated, data) === regenerated);

  H.suite('prerender coverage');

  var block = prerender.findRegion(regenerated).body;
  var missingCards = [];
  var missingMetrics = [];
  var domains = data.categories.length;
  var calculators = 0;

  H.eachCard(data, function (card) {
    calculators += 1;
    if (block.indexOf('id="prerender-calc-' + card.id + '"') === -1) {
      missingCards.push(card.id);
    }
    card.outputs.forEach(function (out) {
      if (block.indexOf(out.meaning) === -1) missingMetrics.push(card.id + '.' + out.key);
    });
  });

  var missingCharts = [];
  H.eachCard(data, function (card) {
    (card.charts || []).forEach(function (def) {
      if (def.purpose && block.indexOf(def.purpose.replace(/&/g, '&amp;')) === -1) {
        missingCharts.push(card.id + ': ' + def.title);
      }
    });
  });
  H.deep('every chart says what it plots, even though it cannot be drawn',
    missingCharts, []);

  H.eq('every domain has a heading',
    (block.match(/<h2>/g) || []).length, domains);
  H.eq('every calculator has a heading',
    (block.match(/<h3>/g) || []).length, calculators);
  H.deep('every calculator has its own static anchor', missingCards, []);
  H.deep('every metric explains itself in the static block', missingMetrics, []);

  var lowered = block.toLowerCase();
  var missingTerms = PROOF_TERMS.filter(function (term) {
    return lowered.indexOf(term.toLowerCase()) === -1;
  });
  H.deep('the terms only JavaScript used to reveal are in the bytes', missingTerms, []);

  /* Formula lines sit in a `<pre>`, where indentation is content. Splicing
     the block into an indented page must not push their continuation lines
     right — several formulas are two equations aligned in columns, and a
     shifted second line reads as a different statement. */
  var misaligned = [];
  H.eachCard(data, function (card) {
    (card.formula || []).forEach(function (line, i) {
      if (i > 0 && block.indexOf('\n' + line) === -1) {
        misaligned.push(card.id + '.formula[' + i + ']');
      }
    });
  });
  H.deep('formula lines keep their own leading whitespace', misaligned, []);

  /* The static block is prose for crawlers, not a second copy of the desk.
     A form control in it would be dead markup a browser discards a moment
     later, and an id the runtime also mints would be a duplicate for as long
     as the page takes to render. */
  H.check('the static block ships no form controls',
    !/<(input|button|form|select|textarea)\b/i.test(block));
  H.check('the static block does not reuse runtime ids',
    !/\sid\s*=\s*["'](?:calc|cat)-/.test(block));
  /* A link to an element only JavaScript creates is a dead link for the one
     reader who can see this block. `tests/stylesheet.js` catches it across the
     whole page; this says so in the suite that would have caused it. */
  H.check('the static block links only to anchors it defines itself',
    !/href\s*=\s*["']#(?!prerender-)/.test(block));
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  run(H.loadPage('index.html'));
  H.report(TITLE);
}
