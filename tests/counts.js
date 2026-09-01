'use strict';

var H = require('./harness');

var TITLE = 'Published counts';

function metaContent(html, key) {
  var tags = html.match(/<meta\b[^>]*>/gi) || [];
  var value = null;
  tags.forEach(function (tag) {
    var identity = /(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tag);
    var content = /content\s*=\s*["']([^"']*)["']/i.exec(tag);
    if (identity && content && identity[1].toLowerCase() === key.toLowerCase()) {
      value = content[1];
    }
  });
  return value || '';
}

function hasCount(text, count, noun) {
  var prefix = noun === 'calculators' ? '(?:(?:PM|project-management)\\s+)?' : '';
  return new RegExp('\\b' + count + '\\s+' + prefix + noun + '\\b', 'i').test(text);
}

function allCountsMatch(text, count, noun) {
  var values = [];
  var re = new RegExp('\\b(\\d+)\\s+' + noun + '\\b', 'gi');
  var match;
  while ((match = re.exec(text)) !== null) values.push(Number(match[1]));
  return values.length > 0 && values.every(function (value) { return value === count; });
}

function run(page) {
  var html = page.html;
  var data = page.sandbox.PM_DATA;
  var domains = data.categories.length;
  var calculators = 0;
  var metrics = 0;
  var titleMatch;
  var jsonMatch;
  var jsonLd = null;
  var figures = {};
  var heroMatch;

  H.eachCard(data, function (card) {
    calculators += 1;
    metrics += card.outputs.length;
  });

  titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(html);
  jsonMatch = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (jsonMatch) {
    try { jsonLd = JSON.parse(jsonMatch[1]); } catch (e) { jsonLd = null; }
  }
  heroMatch = /<section\b[^>]*id\s*=\s*["']main-hero["'][^>]*>([\s\S]*?)<\/section>/i.exec(html);

  html.replace(/hero-fig-num[^>]*>(\d+)<[\s\S]*?hero-fig-lab[^>]*>([^<]+)</gi,
    function (whole, number, label) {
      figures[label.trim().toLowerCase()] = Number(number);
      return whole;
    });

  H.suite('metadata counts');
  H.check('title states the calculator count',
    hasCount(titleMatch ? titleMatch[1] : '', calculators, 'calculators'));
  H.check('meta description states the calculator count',
    hasCount(metaContent(html, 'description'), calculators, 'calculators'));
  H.check('Open Graph title states the calculator count',
    hasCount(metaContent(html, 'og:title'), calculators, 'calculators'));
  H.check('Open Graph description states calculators and domains',
    hasCount(metaContent(html, 'og:description'), calculators, 'calculators') &&
    hasCount(metaContent(html, 'og:description'), domains, 'domains'));
  H.check('Open Graph image alt states every count',
    hasCount(metaContent(html, 'og:image:alt'), domains, 'domains') &&
    hasCount(metaContent(html, 'og:image:alt'), calculators, 'calculators') &&
    hasCount(metaContent(html, 'og:image:alt'), metrics, 'metrics'));
  H.check('JSON-LD description states calculators and domains',
    jsonLd && hasCount(jsonLd.description || '', calculators, 'calculators') &&
    hasCount(jsonLd.description || '', domains, 'domains'));

  H.suite('visible counts');
  H.deep('hero figures match PM_DATA', figures, {
    domains: domains,
    calculators: calculators,
    metrics: metrics
  });
  H.check('hero copy states calculators and domains',
    hasCount(html, calculators, 'calculators') && hasCount(html, domains, 'domains'));
  H.check('every metric count in the hero matches PM_DATA',
    allCountsMatch(heroMatch ? heroMatch[1] : '', metrics, 'metrics'));
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  run(H.loadPage('index.html'));
  H.report(TITLE);
}
