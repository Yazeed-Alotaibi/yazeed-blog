'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var types = require('util').types;

/* The page object is the unforgeable brand; VM trust state never leaves this
   module where a harness caller could mutate it. */
var pageRealms = new WeakMap();

function createRealm() {
  var sandbox = Object.create(null);
  vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false }
  });
  vm.runInContext([
    'this.window = this;',
    'this.console = { log: function () {}, error: function () {}, warn: function () {} };',
    'this.module = { exports: {} };',
    'this.setTimeout = function () { return 0; };',
    'this.clearTimeout = function () {};'
  ].join('\n'), sandbox, { filename: 'test-harness-bootstrap.js' });
  var cloneData = vm.runInContext([
    '(function () {',
    '  var arrayIsArray = Array.isArray;',
    '  var realmFunction = Function;',
    '  var objectCreate = Object.create;',
    '  var objectKeys = Object.keys;',
    '  function clone(value, ancestors) {',
    '    var copy;',
    '    var i;',
    '    var key;',
    '    var keys;',
    '    if (typeof value === "function") {',
    '      if (value instanceof realmFunction) return value;',
    '      throw new TypeError("Cannot pass host functions into page callbacks");',
    '    }',
    '    if (value === null || typeof value !== "object") return value;',
    '    ancestors = ancestors || [];',
    '    for (i = 0; i < ancestors.length; i += 1) {',
    '      if (ancestors[i] === value) throw new TypeError("Cannot pass cyclic data into page callbacks");',
    '    }',
    '    ancestors[ancestors.length] = value;',
    '    copy = arrayIsArray(value) ? [] : objectCreate(null);',
    '    keys = objectKeys(value);',
    '    for (i = 0; i < keys.length; i += 1) {',
    '      key = keys[i];',
    '      copy[key] = clone(value[key], ancestors);',
    '    }',
    '    ancestors.length -= 1;',
    '    return copy;',
    '  }',
    '  return clone;',
    '}())'
  ].join('\n'), sandbox, { filename: 'test-harness-clone.js' });
  return {
    sandbox: sandbox,
    cloneData: cloneData,
    trustedFunctions: new WeakSet(),
    trustedObjects: new WeakSet(),
    trustedPrototypes: new WeakMap()
  };
}

function evaluate(realm, source, filename) {
  return vm.runInContext(source, realm.sandbox, { filename: filename });
}

function registerFunctions(realm, value, seen) {
  var i;
  var keys;
  if (value === null ||
      (typeof value !== 'object' && typeof value !== 'function')) return;
  if (types.isProxy(value)) throw new TypeError('Page data cannot expose proxies');
  seen = seen || new WeakSet();
  if (seen.has(value)) return;
  seen.add(value);
  realm.trustedObjects.add(value);
  realm.trustedPrototypes.set(value, Object.getPrototypeOf(value));
  if (typeof value === 'function') {
    realm.trustedFunctions.add(value);
    return;
  }
  keys = Object.keys(value);
  for (i = 0; i < keys.length; i += 1) {
    registerFunctions(realm, value[keys[i]], seen);
  }
}

function validateData(realm, value, seen) {
  var descriptor;
  var i;
  var keys;
  if (value === null ||
      (typeof value !== 'object' && typeof value !== 'function')) return;
  if (types.isProxy(value)) {
    throw new TypeError('Cannot pass proxies into page callbacks');
  }
  seen = seen || new WeakSet();
  if (seen.has(value)) return;
  seen.add(value);
  if (typeof value === 'function') {
    if (!realm.trustedFunctions.has(value)) {
      throw new TypeError('Cannot pass host functions into page callbacks');
    }
    return;
  }
  keys = Object.keys(value);
  for (i = 0; i < keys.length; i += 1) {
    descriptor = Object.getOwnPropertyDescriptor(value, keys[i]);
    if (descriptor.get || descriptor.set) {
      throw new TypeError('Cannot pass accessors into page callbacks');
    }
    validateData(realm, descriptor.value, seen);
  }
}

function validateReceiver(realm, value, seen) {
  var descriptor;
  var i;
  var keys;
  var nested;
  if (value === null ||
      (typeof value !== 'object' && typeof value !== 'function') ||
      types.isProxy(value) || !realm.trustedObjects.has(value) ||
      realm.trustedPrototypes.get(value) !== Object.getPrototypeOf(value)) {
    throw new TypeError('Page callback receiver must originate in the page VM');
  }
  seen = seen || new WeakSet();
  if (seen.has(value) || typeof value === 'function') return;
  seen.add(value);
  keys = Reflect.ownKeys(value);
  for (i = 0; i < keys.length; i += 1) {
    descriptor = Object.getOwnPropertyDescriptor(value, keys[i]);
    if (descriptor.get || descriptor.set) {
      throw new TypeError('Page callback receiver cannot expose accessors');
    }
    nested = descriptor.value;
    if (nested !== null &&
        (typeof nested === 'object' || typeof nested === 'function')) {
      validateReceiver(realm, nested, seen);
    }
  }
}

/* Loading and callback registration stay together so no public helper can
   accidentally bless a host function as page-owned. */
function loadPage(root, file) {
  var rootPath = fs.realpathSync(root);
  var pagePath = fs.realpathSync(path.resolve(root, file));
  var relative = path.relative(rootPath, pagePath);
  if (relative.indexOf('..' + path.sep) === 0 || path.isAbsolute(relative)) {
    throw new Error('Test page must stay inside the repository: ' + file);
  }
  var html = fs.readFileSync(pagePath, 'utf8');
  var blocks = [];
  var re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  var match;
  while ((match = re.exec(html)) !== null) {
    var attrs = match[1];
    if (/\bsrc=/.test(attrs)) continue;
    var type = /\btype\s*=\s*["']([^"']+)["']/.exec(attrs);
    if (type && !/javascript|module/.test(type[1])) continue;
    blocks.push(match[2]);
  }

  var realm = createRealm();
  var loaded = [];
  blocks.forEach(function (source, index) {
    if (/document\.getElementById|document\.createElement/.test(source) &&
        !/^\s*\/\* PM Calculation Desk — calculator definitions/.test(source)) {
      return;
    }
    try {
      evaluate(realm, source, file + '#block' + index);
      loaded.push(index);
    } catch (error) {
      throw new Error('Failed evaluating ' + file + ' script block ' + index +
        ': ' + error.message);
    }
  });
  registerFunctions(realm, realm.sandbox);

  var page = {
    sandbox: realm.sandbox,
    html: html,
    blocks: blocks,
    loaded: loaded
  };
  pageRealms.set(page, realm);
  return page;
}

function invoke(page, fn, args, receiver) {
  var argument;
  var descriptor;
  var realm = pageRealms.get(page);
  var output;
  var safeArgs = [];
  var i;
  if (!realm) {
    throw new TypeError('Page was not created by loadPage()');
  }
  if (typeof fn !== 'function') throw new TypeError('Page callback is not a function');
  if (types.isProxy(fn) || !realm.trustedFunctions.has(fn)) {
    throw new TypeError('Page callback must originate in the page VM');
  }
  args = args === undefined ? [] : args;
  if (types.isProxy(args)) {
    throw new TypeError('Page callback argument list cannot contain proxies');
  }
  if (!Array.isArray(args)) {
    throw new TypeError('Page callback argument list must be an array');
  }
  if (receiver !== undefined) validateReceiver(realm, receiver);
  for (i = 0; i < args.length; i += 1) {
    descriptor = Object.getOwnPropertyDescriptor(args, String(i));
    if (descriptor && (descriptor.get || descriptor.set)) {
      throw new TypeError('Page callback argument list cannot expose accessors');
    }
    argument = descriptor ? descriptor.value : undefined;
    validateData(realm, argument);
    safeArgs.push(Reflect.apply(realm.cloneData, undefined, [argument]));
  }
  output = Reflect.apply(fn, receiver, safeArgs);
  registerFunctions(realm, output);
  return output;
}

module.exports = {
  loadPage: loadPage,
  invoke: invoke
};
