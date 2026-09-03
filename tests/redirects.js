'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./harness');

var TITLE = 'Redirect integrity';
var STUBS = ['pm-calculation-desk.html', 'wbs-estimation-toolkit.html'];
var FURNITURE = ['docs', 'design', 'tests', 'tools', 'content', 'AGENTS', 'README', '^\\.'];

function refreshTarget(html) {
  var tags = html.match(/<meta\b[^>]*>/gi) || [];
  var target = null;
  tags.forEach(function (tag) {
    if (!/http-equiv\s*=\s*["']refresh["']/i.test(tag)) return;
    var content = /content\s*=\s*["'][^"']*?url\s*=\s*([^"'\s;>]+)[^"']*["']/i.exec(tag);
    if (content) target = content[1];
  });
  return target;
}

function rewriteTargets(text) {
  var targets = {};
  text.split(/\r?\n/).forEach(function (line) {
    var match = /^\s*RewriteRule\s+\^([^$]+)\$\s+(\S+)/i.exec(line);
    if (!match) return;
    targets[match[1].replace(/\\\./g, '.')] = match[2];
  });
  return targets;
}

function run(page, options) {
  var root = options && options.root ? options.root : path.join(__dirname, '..');
  var htaccess = fs.readFileSync(path.join(root, '.htaccess'), 'utf8');
  var moduleStack = [];
  var rewriteOutside = [];
  var headerOutside = [];

  htaccess.split(/\r?\n/).forEach(function (line) {
    var opening = /^\s*<IfModule\s+([^>]+)>/i.exec(line);
    if (opening) {
      moduleStack.push({
        rewrite: /mod_rewrite\.c/i.test(opening[1]),
        headers: /mod_headers\.c/i.test(opening[1])
      });
      return;
    }
    if (/^\s*<\/IfModule>/i.test(line)) {
      moduleStack.pop();
      return;
    }
    if (/^\s*Rewrite(?:Rule|Cond|Engine)\b/i.test(line) &&
        !moduleStack.some(function (frame) { return frame.rewrite; })) {
      rewriteOutside.push(line.trim());
    }
    if (/^\s*Header\b/i.test(line) &&
        !moduleStack.some(function (frame) { return frame.headers; })) {
      headerOutside.push(line.trim());
    }
  });

  H.suite('rewrite guard');
  H.check('every Rewrite directive is guarded by mod_rewrite', rewriteOutside.length === 0,
    'outside guard: ' + rewriteOutside.join(' | '));

  H.suite('header guard');
  H.check('every Header directive is guarded by mod_headers', headerOutside.length === 0,
    'outside guard: ' + headerOutside.join(' | '));

  var denied = htaccess.split(/\r?\n/).filter(function (line) {
    return /^\s*RewriteRule\s+\^.*\[R=404,L\]/.test(line);
  }).join('\n');
  H.suite('furniture');
  FURNITURE.forEach(function (name) {
    H.check(name + ' is answered 404', denied.indexOf(name) !== -1,
      'no [R=404,L] RewriteRule mentions ' + name);
  });

  var targets = rewriteTargets(htaccess);
  H.suite('stub destinations');
  STUBS.forEach(function (stub) {
    var html = fs.readFileSync(path.join(root, stub), 'utf8');
    H.eq(stub + ' refresh matches its RewriteRule',
      refreshTarget(html), targets[stub],
      'refresh=' + refreshTarget(html) + ', rewrite=' + targets[stub]);
  });
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  H.reset();
  run(null);
  H.report(TITLE);
}
