
/* Hero instrument. The same indices the Calculation Desk opens with, wired
   live so the homepage demonstrates the product rather than describing it.
   Each index is drawn as a needle on a graduated arc, because that is what
   reading a ratio against 1.00 actually is. */
(function () {
  'use strict';

  var fields = {
    bac: document.getElementById('bac'),
    ev: document.getElementById('ev'),
    ac: document.getElementById('ac'),
    pv: document.getElementById('pv')
  };
  var figure = document.getElementById('evm');
  if (!figure || !fields.ev) return;

  /* Command Deck overview. The four inputs in the active workspace are the
     single source for every reading, comparison bar, threshold and signal. */
  function deckNumber(value) {
    if (value === null || !isFinite(value)) return '—';
    var rounded = Math.round(Math.abs(value)).toString();
    var grouped = '';
    var count = 0;
    for (var i = rounded.length - 1; i >= 0; i--) {
      grouped = rounded.charAt(i) + grouped;
      count += 1;
      if (count % 3 === 0 && i > 0) grouped = ',' + grouped;
    }
    return (value < 0 ? '−' : '') + grouped;
  }

  function deckRead(field) {
    var value = parseFloat(field.value);
    return isFinite(value) ? value : null;
  }

  function deckTone(value) {
    if (value === null) return 'current';
    if (value >= 1) return 'good';
    if (value >= .95) return 'warn';
    return 'bad';
  }

  function deckWord(tone) {
    return tone === 'good' ? 'Good' : tone === 'warn' ? 'Watch' : tone === 'bad' ? 'Action' : 'Current';
  }

  function deckTargetText(value) {
    if (value === null) return 'Waiting';
    var delta = value - 1;
    if (Math.abs(delta) < .005) return 'On target';
    return (delta > 0 ? '+' : '−') + Math.abs(delta).toFixed(2) + (delta > 0 ? ' above' : ' below');
  }

  function deckRatioContext(value) {
    if (value === null) return 'Waiting for current inputs';
    var delta = value - 1;
    if (Math.abs(delta) < .005) return 'On the 1.00 target';
    return Math.round(Math.abs(delta) * 100) + '% ' + (delta > 0 ? 'above' : 'below') + ' the 1.00 target';
  }

  function deckBudgetContext(value, budget, varianceLabel) {
    if (value === null || budget === null) return 'Waiting for current inputs';
    if (varianceLabel) {
      if (Math.abs(value) < .5) return 'On the approved budget';
      return deckNumber(Math.abs(value)) + (value > 0 ? ' favourable variance' : ' unfavourable variance');
    }
    var delta = value - budget;
    if (Math.abs(delta) < .5) return 'On the approved budget';
    return deckNumber(Math.abs(delta)) + (delta > 0 ? ' over' : ' under') + ' the approved budget';
  }

  function deckPaintKpi(id, value, format, tone, note, context) {
    var node = document.getElementById(id);
    var text = value === null ? '—' : format === 'ratio' ? value.toFixed(2) : deckNumber(value);
    var previous = node.querySelector('.g-value').textContent;
    var selected = node.classList.contains('is-lens-selected');
    node.className = 'command-kpi' + (tone === 'current' ? '' : ' tone-' + tone);
    if (selected) node.classList.add('is-lens-selected');
    node.querySelector('.g-value').textContent = text;
    node.querySelector('.g-verdict').className = 'g-verdict status-badge' + (tone === 'current' ? '' : ' tone-' + tone);
    node.querySelector('.g-verdict').textContent = value === null ? 'Awaiting input' : deckWord(tone);
    node.querySelector('.g-note').textContent = note;
    node.querySelector('.g-context').textContent = context;
    if (previous !== '—' && previous !== text) {
      node.classList.add('is-updated');
      (function (updatedNode) {
        window.setTimeout(function () { updatedNode.classList.remove('is-updated'); }, 650);
      })(node);
    }
  }

  function deckPaintResult(key, value, format, tone) {
    document.getElementById('result-' + key).textContent = value === null ? '—' : format === 'ratio' ? value.toFixed(2) : deckNumber(value);
    var status = document.getElementById('result-' + key + '-status');
    status.className = tone === 'current' ? '' : 'tone-' + tone;
    status.textContent = value === null ? 'Current' : deckWord(tone);
  }

  function deckPaintSignal(id, tone, value, detail) {
    var node = document.getElementById(id);
    var selected = node.classList.contains('is-lens-selected');
    node.className = 'signal' + (tone === 'current' ? '' : ' tone-' + tone);
    if (selected) node.classList.add('is-lens-selected');
    node.querySelector('.signal-mark').textContent = tone === 'good' ? '✓' : tone === 'current' ? '·' : '!';
    node.querySelector('p').textContent = detail;
    node.querySelector('b').textContent = value;
  }

  function deckUpdate(announce) {
    var bac = deckRead(fields.bac);
    var pv = deckRead(fields.pv);
    var ev = deckRead(fields.ev);
    var ac = deckRead(fields.ac);
    var cpi = ev !== null && ac !== null && ac > 0 ? ev / ac : null;
    var spi = ev !== null && pv !== null && pv > 0 ? ev / pv : null;
    var eac = bac !== null && cpi !== null && cpi > 0 ? bac / cpi : null;
    var vac = bac !== null && eac !== null ? bac - eac : null;
    var cpiTone = deckTone(cpi);
    var spiTone = deckTone(spi);
    var eacTone = eac === null || bac === null ? 'current' : eac <= bac ? 'good' : 'bad';
    var vacTone = vac === null ? 'current' : vac >= 0 ? 'good' : 'bad';

    deckPaintKpi('out-cpi', cpi, 'ratio', cpiTone, 'Cost performance index', deckRatioContext(cpi));
    deckPaintKpi('out-spi', spi, 'ratio', spiTone, 'Schedule performance index', deckRatioContext(spi));
    deckPaintKpi('out-eac', eac, 'money', eacTone, 'Estimate at completion', deckBudgetContext(eac, bac, false));
    deckPaintKpi('out-vac', vac, 'money', vacTone, 'Variance at completion', deckBudgetContext(vac, bac, true));
    deckPaintResult('cpi', cpi, 'ratio', cpiTone);
    deckPaintResult('spi', spi, 'ratio', spiTone);
    deckPaintResult('eac', eac, 'money', eacTone);
    deckPaintResult('vac', vac, 'money', vacTone);

    var values = [pv || 0, ev || 0, ac || 0];
    var maximum = Math.max(values[0], values[1], values[2], 1);
    var barKeys = ['pv', 'ev', 'ac'];
    for (var i = 0; i < barKeys.length; i++) {
      document.getElementById('bar-' + barKeys[i]).style.width = Math.max(0, values[i] / maximum * 100).toFixed(2) + '%';
      document.getElementById('bar-' + barKeys[i] + '-value').textContent = values[i] ? deckNumber(values[i]) : '—';
    }
    document.getElementById('eff-cpi-fill').style.width = cpi === null ? '0' : Math.min(100, Math.max(0, cpi / 1.25 * 100)).toFixed(2) + '%';
    document.getElementById('eff-spi-fill').style.width = spi === null ? '0' : Math.min(100, Math.max(0, spi / 1.25 * 100)).toFixed(2) + '%';
    document.getElementById('eff-cpi-value').textContent = cpi === null ? '—' : cpi.toFixed(2);
    document.getElementById('eff-spi-value').textContent = spi === null ? '—' : spi.toFixed(2);
    document.getElementById('eff-cpi-delta').textContent = deckTargetText(cpi);
    document.getElementById('eff-spi-delta').textContent = deckTargetText(spi);
    document.getElementById('eff-cpi-delta').className = cpiTone === 'current' ? '' : 'tone-' + cpiTone;
    document.getElementById('eff-spi-delta').className = spiTone === 'current' ? '' : 'tone-' + spiTone;

    deckPaintSignal('signal-cost', cpiTone, cpi === null ? '—' : cpi.toFixed(2),
      cpi === null ? 'Enter earned and actual cost.' : cpi >= 1 ? 'Cost efficiency is ' + deckTargetText(cpi) + ' the 1.00 target.' : 'Recover ' + (1 - cpi).toFixed(2) + ' index points to reach target 1.00.');
    deckPaintSignal('signal-schedule', spiTone, spi === null ? '—' : spi.toFixed(2),
      spi === null ? 'Enter earned and planned value.' : spi >= 1 ? 'Schedule efficiency is ' + deckTargetText(spi) + ' the 1.00 target.' : 'Recover ' + (1 - spi).toFixed(2) + ' index points to reach target 1.00.');
    deckPaintSignal('signal-forecast', vacTone, vac === null ? '—' : deckNumber(vac),
      vac === null ? 'Enter an approved budget.' : vac >= 0 ? 'Forecast retains ' + deckNumber(vac) + ' of budget headroom.' : 'Forecast exceeds BAC by ' + deckNumber(Math.abs(vac)) + '.');

    document.getElementById('out-cv').textContent = ev !== null && ac !== null ? deckNumber(ev - ac) : '—';
    document.getElementById('out-sv').textContent = ev !== null && pv !== null ? deckNumber(ev - pv) : '—';
    if (announce) {
      document.getElementById('deck-live').textContent = 'Inputs updated. CPI ' +
        (cpi === null ? 'unavailable' : cpi.toFixed(2) + ' ' + deckWord(cpiTone)) +
        ', SPI ' + (spi === null ? 'unavailable' : spi.toFixed(2) + ' ' + deckWord(spiTone)) + '.';
    }
  }

  var deckKeys = ['bac', 'pv', 'ev', 'ac'];
  for (var deckIndex = 0; deckIndex < deckKeys.length; deckIndex++) {
    fields[deckKeys[deckIndex]].addEventListener('input', function () { deckUpdate(true); });
  }
  deckUpdate(false);

  var lensTargets = {
    cost: ['out-cpi', 'comparison-panel', 'signal-cost'],
    schedule: ['out-spi', 'efficiency-panel', 'signal-schedule'],
    forecast: ['out-eac', 'out-vac', 'evm', 'signal-forecast']
  };
  var lensCopy = {
    cost: 'Cost lens selected: efficiency, value comparison, and cost signal are connected.',
    schedule: 'Schedule lens selected: delivery efficiency and the recovery signal are connected.',
    forecast: 'Forecast lens selected: completion estimate, variance, and headroom are connected.'
  };
  var lensButtons = document.querySelectorAll('[data-review-lens]');

  function selectLens(name, announce) {
    var current = document.querySelectorAll('.is-lens-selected');
    var i;
    document.getElementById('main-hero').setAttribute('data-lens', name);
    for (i = 0; i < current.length; i++) current[i].classList.remove('is-lens-selected');
    for (i = 0; i < lensButtons.length; i++) {
      lensButtons[i].setAttribute('aria-pressed',
        lensButtons[i].getAttribute('data-review-lens') === name ? 'true' : 'false');
    }
    lensTargets[name].forEach(function (id) {
      var target = document.getElementById(id);
      if (target) target.classList.add('is-lens-selected');
    });
    document.getElementById('review-lens-status').textContent = lensCopy[name];
    if (announce) document.getElementById('deck-live').textContent = lensCopy[name];
  }

  for (var lensIndex = 0; lensIndex < lensButtons.length; lensIndex++) {
    lensButtons[lensIndex].addEventListener('click', function () {
      selectLens(this.getAttribute('data-review-lens'), true);
    });
  }
  selectLens('cost', false);

  /* The mobile rail is a modal drawer: Escape and the scrim close it, Tab is
     contained within it, and focus returns to the control that opened it. */
  var rail = document.getElementById('command-rail');
  var menu = document.getElementById('command-menu');
  var railClose = document.getElementById('rail-close');
  var scrim = document.getElementById('rail-scrim');
  var commandSearch = document.getElementById('command-search');
  var search = document.getElementById('search');
  var returnFocus = null;

  function openRail(trigger) {
    returnFocus = trigger || menu;
    document.body.classList.add('rail-open');
    menu.setAttribute('aria-expanded', 'true');
    scrim.hidden = false;
    railClose.focus();
  }

  function closeRail(restore) {
    document.body.classList.remove('rail-open');
    menu.setAttribute('aria-expanded', 'false');
    scrim.hidden = true;
    if (restore !== false && returnFocus) returnFocus.focus();
  }

  menu.addEventListener('click', function () { openRail(menu); });
  railClose.addEventListener('click', function () { closeRail(true); });
  scrim.addEventListener('click', function () { closeRail(true); });
  rail.addEventListener('click', function (event) {
    if (window.innerWidth <= 920 && event.target.closest && event.target.closest('#cat-nav a')) closeRail(false);
  });
  document.addEventListener('keydown', function (event) {
    if (!document.body.classList.contains('rail-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeRail(true); return; }
    if (event.key !== 'Tab') return;
    var focusable = rail.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  commandSearch.addEventListener('click', function () {
    if (window.innerWidth <= 920) {
      openRail(commandSearch);
      window.setTimeout(function () { search.focus(); }, 0);
    } else search.focus();
  });
  document.getElementById('command-project-open').addEventListener('click', function () {
    document.getElementById('project-register-open').click();
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 920 && document.body.classList.contains('rail-open')) closeRail(false); });

})();
