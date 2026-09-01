'use strict';

var H = require('./harness');

var TITLE = 'Stylesheet integrity';

function styleText(html) {
  var css = [];
  var re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  var match;
  while ((match = re.exec(html)) !== null) css.push(match[1]);
  return css.join('\n');
}

function stripNoise(text) {
  var output = text.split('');
  var quote = '';
  var escaped = false;
  var inComment = false;
  var i;

  for (i = 0; i < text.length; i += 1) {
    if (inComment) {
      if (text[i] === '*' && text[i + 1] === '/') {
        output[i] = ' ';
        output[i + 1] = ' ';
        i += 1;
        inComment = false;
      } else if (text[i] !== '\n' && text[i] !== '\r') {
        output[i] = ' ';
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (text[i] === '\\') {
        escaped = true;
      } else if (text[i] === quote) {
        quote = '';
      }
      if (text[i] !== '\n' && text[i] !== '\r') output[i] = ' ';
      continue;
    }

    if (text[i] === '/' && text[i + 1] === '*') {
      output[i] = ' ';
      output[i + 1] = ' ';
      i += 1;
      inComment = true;
    } else if (text[i] === '"' || text[i] === "'") {
      quote = text[i];
      output[i] = ' ';
    }
  }

  return output.join('');
}

function blocks(css) {
  var clean = stripNoise(css);
  var stack = [];
  var found = [];
  var i;

  for (i = 0; i < clean.length; i += 1) {
    if (clean[i] === '{') {
      var start = i - 1;
      var block;
      while (start >= 0 && clean[start] !== '{' && clean[start] !== '}') start -= 1;
      block = {
        start: i,
        end: -1,
        prelude: clean.slice(start + 1, i).trim(),
        parent: stack.length ? stack[stack.length - 1] : null
      };
      found.push(block);
      stack.push(block);
    } else if (clean[i] === '}' && stack.length) {
      stack.pop().end = i;
    }
  }

  return { clean: clean, found: found, open: stack };
}

function hasAncestor(block, pattern) {
  var cursor = block;
  while (cursor) {
    if (pattern.test(cursor.prelude)) return true;
    cursor = cursor.parent;
  }
  return false;
}

function definitions(text) {
  var names = {};
  var re = /(--[a-z0-9-]+)\s*:/gi;
  var match;
  while ((match = re.exec(text)) !== null) names[match[1]] = true;
  return names;
}

function uses(text) {
  var names = {};
  var re = /var\(\s*(--[a-z0-9-]+)/gi;
  var match;
  while ((match = re.exec(text)) !== null) names[match[1]] = true;
  return names;
}

function run(page) {
  var html = page.html;
  var css = styleText(html);
  var parsed = blocks(css);
  var depth = 0;
  var minimum = 0;
  var i;

  for (i = 0; i < parsed.clean.length; i += 1) {
    if (parsed.clean[i] === '{') depth += 1;
    if (parsed.clean[i] === '}') depth -= 1;
    if (depth < minimum) minimum = depth;
  }

  H.suite('balanced stylesheet');
  H.check('CSS braces are balanced', depth === 0 && minimum === 0,
    'final depth ' + depth + ', minimum depth ' + minimum);

  var defined = definitions(css);
  var used = uses(css);
  var dangling = Object.keys(used).filter(function (name) { return !defined[name]; });
  H.suite('custom properties');
  H.check('every custom property use has a definition', dangling.length === 0,
    'dangling: ' + dangling.join(', '));

  var baseDefinitions = {};
  var darkDefinitions = {};
  parsed.found.forEach(function (block) {
    if (block.end === -1 || block.prelude !== ':root') return;
    var names = definitions(css.slice(block.start + 1, block.end));
    if (hasAncestor(block.parent, /@media\s*\(prefers-color-scheme:\s*dark\)/i)) {
      Object.keys(names).forEach(function (name) { darkDefinitions[name] = true; });
    } else {
      Object.keys(names).forEach(function (name) { baseDefinitions[name] = true; });
    }
  });
  var darkOnly = Object.keys(darkDefinitions).filter(function (name) {
    return !baseDefinitions[name];
  });
  H.check('dark-mode custom properties also exist in the base palette', darkOnly.length === 0,
    'dark only: ' + darkOnly.join(', '));

  var hardcoded = [];
  var colorRe = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi;
  var color;
  while ((color = colorRe.exec(css)) !== null) {
    var containing = parsed.found.filter(function (block) {
      return block.start < color.index && color.index < block.end;
    });
    var allowed = containing.some(function (block) {
      var blockText = block.end === -1 ? '' : css.slice(block.start + 1, block.end);
      return block.prelude === ':root' ||
        /@media\s*\(prefers-color-scheme:\s*dark\)/i.test(block.prelude) ||
        /@media\s+print\b/i.test(block.prelude) ||
        (/#cat-nav\b/.test(block.prelude) && /mask-image\s*:/.test(blockText));
    });
    if (!allowed) hardcoded.push(color[0] + ' at CSS offset ' + color.index);
  }
  H.suite('palette boundaries');
  H.check('hex colours stay inside allowlisted palette blocks', hardcoded.length === 0,
    hardcoded.join(', '));

  var ids = {};
  var idRe = /\bid\s*=\s*["']([^"']+)["']/gi;
  var idMatch;
  while ((idMatch = idRe.exec(html)) !== null) ids[idMatch[1]] = true;
  var missing = [];
  var hrefRe = /\bhref\s*=\s*["']#([^"']+)["']/gi;
  var href;
  while ((href = hrefRe.exec(html)) !== null) {
    if (!ids[href[1]]) missing.push('#' + href[1]);
  }
  H.suite('static anchors');
  H.check('static fragment links resolve to static ids', missing.length === 0,
    'missing: ' + missing.join(', '));
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  run(H.loadPage('index.html'));
  H.report(TITLE);
}
