'use strict';

var vm = require('vm');
var types = require('util').types;

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
    trustedFunctions: new WeakSet()
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
  if (typeof value === 'function') {
    realm.trustedFunctions.add(value);
    return;
  }
  keys = Object.keys(value);
  for (i = 0; i < keys.length; i += 1) {
    registerFunctions(realm, value[keys[i]], seen);
  }
}

function validateData(page, value, seen) {
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
    if (!page.trustedFunctions.has(value)) {
      throw new TypeError('Cannot pass host functions into page callbacks');
    }
    return;
  }
  keys = Object.keys(value);
  for (i = 0; i < keys.length; i += 1) {
    validateData(page, value[keys[i]], seen);
  }
}

function invoke(page, fn, args) {
  var output;
  var safeArgs = [];
  var i;
  if (!page || typeof page.cloneData !== 'function' ||
      !page.trustedFunctions || typeof page.trustedFunctions.has !== 'function') {
    throw new TypeError('Page was not created by loadPage()');
  }
  if (typeof fn !== 'function') throw new TypeError('Page callback is not a function');
  if (types.isProxy(fn) || !page.trustedFunctions.has(fn)) {
    throw new TypeError('Page callback must originate in the page VM');
  }
  for (i = 0; i < (args || []).length; i += 1) {
    validateData(page, args[i]);
    safeArgs.push(Reflect.apply(page.cloneData, undefined, [args[i]]));
  }
  output = Reflect.apply(fn, undefined, safeArgs);
  registerFunctions(page, output);
  return output;
}

module.exports = {
  createRealm: createRealm,
  evaluate: evaluate,
  registerFunctions: registerFunctions,
  invoke: invoke
};
