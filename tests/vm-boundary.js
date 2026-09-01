'use strict';

var vm = require('vm');

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
  var isRealmFunction = vm.runInContext([
    '(function (RealmFunction) {',
    '  return function (value) {',
    '    return typeof value === "function" && value instanceof RealmFunction;',
    '  };',
    '}(Function))'
  ].join('\n'), sandbox, { filename: 'test-harness-function-origin.js' });
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
    isRealmFunction: isRealmFunction
  };
}

function evaluate(realm, source, filename) {
  return vm.runInContext(source, realm.sandbox, { filename: filename });
}

function invoke(page, fn, args) {
  var safeArgs = [];
  var i;
  if (!page || typeof page.cloneData !== 'function' ||
      typeof page.isRealmFunction !== 'function') {
    throw new TypeError('Page was not created by loadPage()');
  }
  if (typeof fn !== 'function') throw new TypeError('Page callback is not a function');
  if (!Reflect.apply(page.isRealmFunction, undefined, [fn])) {
    throw new TypeError('Page callback must originate in the page VM');
  }
  for (i = 0; i < (args || []).length; i += 1) {
    safeArgs.push(Reflect.apply(page.cloneData, undefined, [args[i]]));
  }
  return Reflect.apply(fn, undefined, safeArgs);
}

module.exports = {
  createRealm: createRealm,
  evaluate: evaluate,
  invoke: invoke
};
