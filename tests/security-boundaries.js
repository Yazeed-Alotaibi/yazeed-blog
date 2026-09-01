'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var H = require('./harness');

function run(result, root) {
  var vmTemp = fs.mkdtempSync(path.join(root, '.lane-b-vm-'));
  try {
    var vmPagePath = path.join(vmTemp, 'index.html');
    var vmProbes = [
      'console.log.constructor("return process")()',
      'setTimeout.constructor("return process")()',
      'this.constructor.constructor("return process")()',
      'Function("return process")()',
      'module.constructor.constructor("return process")()'
    ];
    var vmScript = vmProbes.map(function (probe) {
      return 'try{if(' + probe + ')window.vmEscapes.push(' +
        JSON.stringify(probe) + ')}catch(e){}';
    }).join('');
    fs.writeFileSync(vmPagePath,
      '<script>window.vmEscapes=[];' + vmScript +
      'function canReachHost(value){try{return !!value.constructor.constructor(' +
      '"return process")()}catch(e){return false}}' +
      'window.vmComputeProbe=function(values){return canReachHost(values)};' +
      'window.vmInterpretProbe=function(value,values){' +
      'return canReachHost(value)||canReachHost(values)};' +
      'window.vmBuildProbe=function(values,results){' +
      'return canReachHost(values)||canReachHost(results)};' +
      'window.vmFormatter=function(value){return value};' +
      'window.vmRendererProbe=function(spec){return canReachHost(spec)||' +
      'canReachHost(spec.series)||canReachHost(spec.series[0])||' +
      'canReachHost(spec.series[0].points)||' +
      'canReachHost(spec.series[0].points[0])||canReachHost(spec.formatter)};' +
      'window.vmListEscape=false;window.vmList=[1];' +
      'window.vmList.forEach=function(callback){' +
      'window.vmListEscape=canReachHost(callback)};</script>');
    var vmPage = H.loadPage(path.relative(root, vmPagePath));
    result('VM host escape', vmPage.sandbox.vmEscapes.length === 0,
      'host process was reachable through: ' + vmPage.sandbox.vmEscapes.join(', '));

    function callbackProbe(name, fn, args) {
      var escaped;
      try {
        escaped = H.invoke(vmPage, fn, args);
        result(name, escaped === false, 'host process was reachable');
      } catch (error) {
        result(name, false, error.message);
      }
    }

    callbackProbe('VM compute callback', vmPage.sandbox.vmComputeProbe,
      [{ value: 1 }]);
    callbackProbe('VM interpret callback', vmPage.sandbox.vmInterpretProbe,
      [1, { value: 1 }]);
    callbackProbe('VM chart build callback', vmPage.sandbox.vmBuildProbe,
      [{ value: 1 }, { result: 2 }]);
    callbackProbe('VM renderer nested data', vmPage.sandbox.vmRendererProbe,
      [{
        series: [{ points: [[1, 2]] }],
        formatter: vmPage.sandbox.vmFormatter
      }]);

    var hostFunctionRejected = false;
    var spoofedFormatter = function () {};
    Object.setPrototypeOf(spoofedFormatter,
      Object.getPrototypeOf(vmPage.sandbox.vmFormatter));
    try {
      H.invoke(vmPage, vmPage.sandbox.vmRendererProbe,
        [{ series: [{ points: [[1, 2]] }], formatter: spoofedFormatter }]);
    } catch (error) {
      hostFunctionRejected = /host functions/.test(error.message);
    }
    result('VM nested host function', hostFunctionRejected,
      'host function was accepted as callback data');

    H.each(vmPage.sandbox.vmList, function () {});
    result('VM overridden array method', vmPage.sandbox.vmListEscape === false,
      'page received a host iteration callback');

    var hostTargetRejected = false;
    try {
      H.invoke(vmPage, function () { return false; }, [{}]);
    } catch (error) {
      hostTargetRejected = /originate in the page VM/.test(error.message);
    }
    result('VM host callback target', hostTargetRejected,
      'host callback target was accepted');

    var spoofedTargetCalled = false;
    var spoofedTarget = function () {
      spoofedTargetCalled = true;
      return false;
    };
    Object.setPrototypeOf(spoofedTarget,
      Object.getPrototypeOf(vmPage.sandbox.vmComputeProbe));
    var spoofedTargetRejected = false;
    try {
      H.invoke(vmPage, spoofedTarget, [{}]);
    } catch (error) {
      spoofedTargetRejected = /originate in the page VM/.test(error.message);
    }
    result('VM prototype-spoofed callback target',
      spoofedTargetRejected && spoofedTargetCalled === false,
      'prototype-spoofed host target was accepted or called');

    var targetTrapCalled = false;
    var proxiedTarget = new Proxy(vmPage.sandbox.vmComputeProbe, {
      apply: function () {
        targetTrapCalled = true;
        return false;
      }
    });
    var proxiedTargetRejected = false;
    try {
      H.invoke(vmPage, proxiedTarget, [{}]);
    } catch (error) {
      proxiedTargetRejected = /originate in the page VM/.test(error.message);
    }
    result('VM proxied callback target',
      proxiedTargetRejected && targetTrapCalled === false,
      'host proxy target was accepted or its apply trap ran');

    var formatterTrapCalled = false;
    var proxiedFormatter = new Proxy(vmPage.sandbox.vmFormatter, {
      apply: function () {
        formatterTrapCalled = true;
        return 1;
      }
    });
    var proxiedFormatterRejected = false;
    try {
      H.invoke(vmPage, vmPage.sandbox.vmRendererProbe,
        [{ series: [{ points: [[1, 2]] }], formatter: proxiedFormatter }]);
    } catch (error) {
      proxiedFormatterRejected = /proxies/.test(error.message);
    }
    result('VM nested proxied function',
      proxiedFormatterRejected && formatterTrapCalled === false,
      'host proxy data was accepted or its apply trap ran');

    var cyclicRejected = false;
    var cyclic = {};
    cyclic.self = cyclic;
    try {
      H.invoke(vmPage, vmPage.sandbox.vmComputeProbe, [cyclic]);
    } catch (error) {
      cyclicRejected = /cyclic data/.test(error.message);
    }
    result('VM cyclic callback data', cyclicRejected,
      'cycle did not produce a deliberate boundary error');
  } finally {
    fs.rmSync(vmTemp, { recursive: true, force: true });
  }

  var externalTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'yazeed-external-page-'));
  try {
    var externalPagePath = path.join(externalTemp, 'index.html');
    fs.writeFileSync(externalPagePath, '<script>window.externalPage=true</script>');
    try {
      H.loadPage(externalPagePath);
      result('external harness page', false, 'outside page was evaluated');
    } catch (error) {
      result('external harness page',
        /inside the repository/.test(error.message), error.message);
    }
  } finally {
    fs.rmSync(externalTemp, { recursive: true, force: true });
  }

  var linkRoot = fs.mkdtempSync(path.join(root, '.lane-b-link-'));
  var linkTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'yazeed-link-target-'));
  try {
    var linkPath = path.join(linkRoot, 'outside');
    fs.writeFileSync(path.join(linkTarget, 'index.html'),
      '<script>window.linkedExternalPage=true</script>');
    fs.symlinkSync(linkTarget, linkPath, 'junction');
    try {
      H.loadPage(path.relative(root, path.join(linkPath, 'index.html')));
      result('symlinked external harness page', false, 'linked page was evaluated');
    } catch (error) {
      result('symlinked external harness page',
        /inside the repository/.test(error.message), error.message);
    }
  } finally {
    fs.rmSync(linkRoot, { recursive: true, force: true });
    fs.rmSync(linkTarget, { recursive: true, force: true });
  }
}

module.exports = run;
