/* Builds sitemap.xml from the page manifest.

   The dates in a sitemap are a promise to a crawler about when a page last
   changed, and they were the one part of a shipped page kept by hand. Every
   other copy of that date is already derived: `content/pages.json` carries
   `updated` per page, and tools/calcpage.js reads it for the byline and for
   both JSON-LD dates. The sitemap held a fourth copy, typed separately, with
   nothing to notice when it and the page disagreed — and on the homepage row
   it already had.

   So it is generated from the same field, and `tests/pages.js` regenerates
   and compares, the way it does for the pages themselves. Line endings are
   left out of that comparison: under autocrlf a Windows checkout holds this
   file as CRLF while `build()` writes LF, and that is not staleness.

     node tools/sitemap.js            # write sitemap.xml
     node tools/sitemap.js --check    # change nothing; fail if it is stale

   Commit the result. */

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SITE = 'https://yazeed.blog';
var FILE = 'sitemap.xml';

function manifest() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'pages.json'), 'utf8'));
}

/* An ISO date and nothing else. A sitemap accepts fuller W3C timestamps, but
   a date is what the manifest holds, and accepting anything looser here would
   let a typo through to a crawler that reads it silently. */
function day(value, where) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    throw new Error(where + ': `updated` must be an ISO date (YYYY-MM-DD), got ' +
      JSON.stringify(value));
  }
  return value;
}

/* The homepage is a page like any other and needs its own date, but it has no
   manifest entry to carry one — it is the desk, not a calculator. `home` in
   content/pages.json holds it. Bump it when index.html changes in a way a
   reader would notice; tools/newpage.js does it for you when a page ships,
   because a new page changes the desk's links. */
function build() {
  var data = manifest();
  if (!data.home || !data.home.updated) {
    throw new Error('content/pages.json needs a top-level "home": { "updated": "YYYY-MM-DD" } ' +
      'for the homepage row of the sitemap');
  }

  var urls = [{ loc: SITE + '/', lastmod: day(data.home.updated, 'home') }];
  (data.pages || []).forEach(function (page) {
    urls.push({
      loc: SITE + '/' + page.slug + '.html',
      lastmod: day(page.updated, page.slug)
    });
  });

  var lines = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  urls.forEach(function (url) {
    lines.push('  <url>', '    <loc>' + url.loc + '</loc>',
      '    <lastmod>' + url.lastmod + '</lastmod>', '  </url>');
  });
  lines.push('</urlset>', '');
  return lines.join('\n');
}

/* Line endings are not content. A Windows checkout under autocrlf holds the
   file as CRLF while build() emits LF; the same normalisation
   tools/calcpage.js applies to its pages keeps that from reading as stale. */
function sameText(a, b) {
  return String(a).replace(/\r\n/g, '\n') === String(b).replace(/\r\n/g, '\n');
}

function main(argv) {
  var check = argv.indexOf('--check') !== -1;
  var want = build();
  var file = path.join(ROOT, FILE);
  var have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;

  if (sameText(have, want)) {
    console.log('sitemap: ' + FILE + ' is up to date');
    return;
  }
  if (check) {
    console.error('sitemap: ' + FILE + ' is stale — run `node tools/sitemap.js`');
    process.exit(1);
  }
  fs.writeFileSync(file, want);
  console.log('sitemap: wrote ' + FILE + ' (' + (build().split('<url>').length - 1) + ' urls)');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { build: build, FILE: FILE };
