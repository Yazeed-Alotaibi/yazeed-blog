'use strict';

var fs = require('fs');
var path = require('path');
var H = require('./harness');
var calcpage = require('../tools/calcpage.js');
var TITLE = 'Calculator page line endings';

function run() {
  var root = path.join(__dirname, '..');
  var spec = calcpage.manifest()[0];
  var source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  var lf = source.replace(/\r\n/g, '\n');
  var crlf = lf.replace(/\n/g, '\r\n');
  var fromLf;
  var fromCrlf;

  H.suite(TITLE);
  fromLf = calcpage.build(spec, lf);
  fromCrlf = calcpage.build(spec, crlf);
  H.check('CRLF and LF inputs generate identical calculator pages',
    fromCrlf === fromLf,
    'generated lengths were ' + fromCrlf.length + ' and ' + fromLf.length);
}

module.exports = { title: TITLE, run: run };

if (require.main === module) {
  run();
  H.report(TITLE);
}
