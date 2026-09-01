'use strict';

var H = require('./harness');

function run(result, page) {
  result('VM boundary state private',
    !Object.prototype.hasOwnProperty.call(page, 'trustedFunctions') &&
    !Object.prototype.hasOwnProperty.call(page, 'cloneData'),
    'mutable callback trust state was exposed');

  var forgedTargetCalled = false;
  var forgedPageRejected = false;
  try {
    H.invoke({
      trustedFunctions: { has: function () { return true; } },
      cloneData: function (value) { return value; }
    }, function () {
      forgedTargetCalled = true;
      return false;
    }, []);
  } catch (error) {
    forgedPageRejected = /not created by loadPage/.test(error.message);
  }
  result('VM forged page identity',
    forgedPageRejected && forgedTargetCalled === false,
    'forged page state allowed a host callback to run');

  var argsTrapCalled = false;
  var proxiedArgs = new Proxy([], {
    get: function (target, key, receiver) {
      argsTrapCalled = true;
      return Reflect.get(target, key, receiver);
    }
  });
  var proxiedArgsRejected = false;
  try {
    H.invoke(page, page.sandbox.vmComputeProbe, proxiedArgs);
  } catch (error) {
    proxiedArgsRejected = /argument list|proxies/.test(error.message);
  }
  result('VM proxied argument list',
    proxiedArgsRejected && argsTrapCalled === false,
    'argument-list proxy was accepted or a trap ran');

  var argumentGetterCalled = false;
  var accessorArgs = [];
  Object.defineProperty(accessorArgs, '0', {
    get: function () {
      argumentGetterCalled = true;
      return {};
    }
  });
  var accessorArgsRejected = false;
  try {
    H.invoke(page, page.sandbox.vmComputeProbe, accessorArgs);
  } catch (error) {
    accessorArgsRejected = /accessors/.test(error.message);
  }
  result('VM accessor argument list',
    accessorArgsRejected && argumentGetterCalled === false,
    'argument-list accessor was accepted or invoked');

  var getterCalled = false;
  var accessorValue = {};
  Object.defineProperty(accessorValue, 'value', {
    enumerable: true,
    get: function () {
      getterCalled = true;
      return 1;
    }
  });
  var accessorRejected = false;
  try {
    H.invoke(page, page.sandbox.vmComputeProbe, [accessorValue]);
  } catch (error) {
    accessorRejected = /accessors/.test(error.message);
  }
  result('VM accessor callback data',
    accessorRejected && getterCalled === false,
    'callback data accessor was accepted or invoked');

  var receiverCorrect = false;
  try {
    receiverCorrect = H.invoke(page, page.sandbox.vmOwner.method,
      [], page.sandbox.vmOwner) === true;
  } catch (error) {
    receiverCorrect = false;
  }
  result('VM callback receiver', receiverCorrect,
    'page callback did not receive its browser owner');

  var hostReceiverRejected = false;
  try {
    H.invoke(page, page.sandbox.vmOwner.method, [], {});
  } catch (error) {
    hostReceiverRejected = /receiver must originate/.test(error.message);
  }
  result('VM host callback receiver', hostReceiverRejected,
    'host receiver was accepted by a page callback');

  var receiverCalls = page.sandbox.vmOwner.calls;
  page.sandbox.vmOwner.hostValue = {};
  var taintedReceiverRejected = false;
  try {
    H.invoke(page, page.sandbox.vmOwner.method, [], page.sandbox.vmOwner);
  } catch (error) {
    taintedReceiverRejected = /receiver must originate/.test(error.message);
  }
  result('VM tainted callback receiver',
    taintedReceiverRejected && page.sandbox.vmOwner.calls === receiverCalls,
    'host-tainted receiver was accepted or callback ran');
  delete page.sandbox.vmOwner.hostValue;

  receiverCalls = page.sandbox.vmOwner.calls;
  page.sandbox.vmOwner.method.hostValue = {};
  var functionTaintedReceiverRejected = false;
  try {
    H.invoke(page, page.sandbox.vmOwner.method, [], page.sandbox.vmOwner);
  } catch (error) {
    functionTaintedReceiverRejected = /receiver must originate/.test(error.message);
  }
  result('VM function-tainted callback receiver',
    functionTaintedReceiverRejected &&
      page.sandbox.vmOwner.calls === receiverCalls,
    'host-tainted receiver function was accepted or callback ran');
  delete page.sandbox.vmOwner.method.hostValue;

  var ownerPrototype = Object.getPrototypeOf(page.sandbox.vmOwner);
  var constructorDescriptor = Object.getOwnPropertyDescriptor(
    ownerPrototype, 'constructor');
  Object.defineProperty(ownerPrototype, 'constructor', {
    configurable: constructorDescriptor.configurable,
    enumerable: constructorDescriptor.enumerable,
    value: Function,
    writable: constructorDescriptor.writable
  });
  receiverCalls = page.sandbox.vmOwner.calls;
  var prototypeTaintedReceiverRejected = false;
  try {
    H.invoke(page, page.sandbox.vmOwner.method, [], page.sandbox.vmOwner);
  } catch (error) {
    prototypeTaintedReceiverRejected = /receiver must originate/.test(error.message);
  }
  result('VM prototype-tainted callback receiver',
    prototypeTaintedReceiverRejected &&
      page.sandbox.vmOwner.calls === receiverCalls,
    'host-tainted receiver prototype was accepted or callback ran');
  Object.defineProperty(ownerPrototype, 'constructor', constructorDescriptor);
}

module.exports = run;
