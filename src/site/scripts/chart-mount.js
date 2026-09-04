
/* PM Calculation Desk — chart mounting and lifecycle.

   A chart is inert until it is worth drawing: the plot area stays empty until
   the card scrolls near the viewport, and redraws only when the reader
   changes an input or the sheet changes width past a threshold. That
   threshold matters — redrawing on every sub-pixel resize is how a chart and
   its container start fighting each other. */

var PM_CHART_MOUNT = (function () {
  'use strict';

  var R = PM_CHARTS.renderers;
  var uid = 0;

  /* A chart draws only when the reader can plausibly see it. */
  var io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var inst = e.target.__chart;
        if (inst) { inst.visible = true; inst.draw(); }
      });
    }, { rootMargin: '300px 0px' });
  }

  function build(card, chartDef) {
    var id = 'ch' + (++uid);
    var fig = document.createElement('figure');
    /* Born in the resolved empty state — the same class and hidden data
       drawer the first no-spec draw() would apply. Building 30 charts "open"
       and collapsing them on first visibility shed ~2,500px of page height
       mid-scroll, which yanked content upward under the reader and made
       anchor jumps from the domain nav overshoot their section. */
    fig.className = 'chart is-empty';
    fig.setAttribute('aria-labelledby', id + '-t');
    fig.innerHTML =
      '<figcaption class="chart-head">' +
        '<span class="chart-title" id="' + id + '-t">' + PM_CHARTS.esc(chartDef.title) + '</span>' +
        '<span class="chart-purpose">' + PM_CHARTS.esc(chartDef.purpose) + '</span>' +
      '</figcaption>' +
      '<div class="chart-legend" hidden></div>' +
      '<div class="chart-plot"></div>' +
      '<p class="sr-only" id="' + id + '-help">Interactive chart. Use the arrow keys to inspect values, ' +
        'Home and End to jump, and Escape to clear the reading. Touch the plot to pin a reading.</p>' +
      '<p class="sr-only" id="' + id + '-status" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<p class="chart-empty">Enter the parameters to plot this.</p>' +
      '<p class="chart-summary"></p>' +
      '<details class="chart-data" hidden>' +
        '<summary>View data</summary>' +
        '<div class="chart-table-wrap"></div>' +
      '</details>';

    var plot = fig.querySelector('.chart-plot');
    var statusEl = fig.querySelector('#' + id + '-status');
    var legendEl = fig.querySelector('.chart-legend');
    var emptyEl = fig.querySelector('.chart-empty');
    var sumEl = fig.querySelector('.chart-summary');
    var details = fig.querySelector('.chart-data');
    var tableWrap = fig.querySelector('.chart-table-wrap');

    var inst = {
      def: chartDef,
      spec: null,
      visible: false,
      lastW: 0,
      drawnSpec: null,
      inspect: null,
      inspectIndex: -1,
      inspectKey: '',
      inspectMode: '',
      inspectEls: null,
      touchStart: null,

      disableInspection: function () {
        plot.classList.remove('is-inspectable');
        plot.removeAttribute('tabindex');
        plot.removeAttribute('role');
        plot.removeAttribute('aria-labelledby');
        plot.removeAttribute('aria-describedby');
        inst.inspect = null;
        inst.inspectIndex = -1;
        inst.inspectKey = '';
        inst.inspectMode = '';
        inst.inspectEls = null;
        inst.touchStart = null;
        statusEl.textContent = '';
      },

      prepareInspection: function (data, restoreKey, restoreMode) {
        inst.disableInspection();
        if (!data || !data.items || !data.items.length) return;

        inst.inspect = data;
        plot.classList.add('is-inspectable');
        plot.setAttribute('tabindex', '0');
        plot.setAttribute('role', 'group');
        plot.setAttribute('aria-labelledby', id + '-t');
        plot.setAttribute('aria-describedby', id + '-help');

        function make(cls) {
          var el = document.createElement('span');
          el.className = cls;
          el.hidden = true;
          el.setAttribute('aria-hidden', 'true');
          plot.appendChild(el);
          return el;
        }

        var guideX = make('ch-inspect-guide ch-inspect-guide-x');
        var guideY = make('ch-inspect-guide ch-inspect-guide-y');
        var dot = make('ch-inspect-dot');
        var box = make('ch-inspect-box');
        var readout = document.createElement('span');
        var label = document.createElement('span');
        var value = document.createElement('span');
        var detail = document.createElement('span');
        readout.className = 'ch-inspect-readout';
        readout.hidden = true;
        readout.setAttribute('aria-hidden', 'true');
        label.className = 'ch-inspect-label';
        value.className = 'ch-inspect-value';
        detail.className = 'ch-inspect-detail';
        readout.appendChild(label);
        readout.appendChild(value);
        readout.appendChild(detail);
        plot.appendChild(readout);

        inst.inspectEls = {
          guideX: guideX,
          guideY: guideY,
          dot: dot,
          box: box,
          readout: readout,
          label: label,
          value: value,
          detail: detail
        };

        if (restoreKey && restoreMode && restoreMode !== 'hover') {
          for (var i = 0; i < data.items.length; i++) {
            if (data.items[i].key === restoreKey) {
              inst.showInspection(i, restoreMode, false);
              break;
            }
          }
        }
      },

      showInspection: function (index, mode, announce) {
        if (!inst.inspect || !inst.inspectEls || !inst.inspect.items[index]) return;
        var data = inst.inspect;
        var item = data.items[index];
        var els = inst.inspectEls;
        var xp = item.x / data.width * 100;
        var yp = item.y / data.height * 100;

        els.guideX.style.left = xp + '%';
        els.guideX.style.top = (data.y1 / data.height * 100) + '%';
        els.guideX.style.height = ((data.y2 - data.y1) / data.height * 100) + '%';
        els.guideX.hidden = item.guide === 'none';

        els.guideY.style.left = (data.x1 / data.width * 100) + '%';
        els.guideY.style.top = yp + '%';
        els.guideY.style.width = ((data.x2 - data.x1) / data.width * 100) + '%';
        els.guideY.hidden = item.guide !== 'xy';

        if (item.box) {
          els.box.style.left = (item.box.x / data.width * 100) + '%';
          els.box.style.top = (item.box.y / data.height * 100) + '%';
          els.box.style.width = (item.box.w / data.width * 100) + '%';
          els.box.style.height = (item.box.h / data.height * 100) + '%';
          els.box.hidden = false;
          els.dot.hidden = true;
        } else {
          els.box.hidden = true;
          els.dot.style.left = xp + '%';
          els.dot.style.top = yp + '%';
          els.dot.hidden = item.guide === 'x';
        }

        els.readout.className = 'ch-inspect-readout ' +
          (item.x > data.width * 0.56 ? 'is-left' : 'is-right');
        els.label.textContent = item.label;
        els.value.textContent = item.value;
        els.detail.textContent = item.detail || '';
        els.detail.hidden = !item.detail;
        els.readout.hidden = false;

        inst.inspectIndex = index;
        inst.inspectKey = item.key || String(index);
        inst.inspectMode = mode || '';
        if (announce) {
          statusEl.textContent = item.label + '. ' + item.value +
            (item.detail ? '. ' + item.detail : '') + '. ' +
            (index + 1) + ' of ' + data.items.length + '.';
        }
      },

      clearInspection: function (announce) {
        var els = inst.inspectEls;
        if (els) {
          els.guideX.hidden = true;
          els.guideY.hidden = true;
          els.dot.hidden = true;
          els.box.hidden = true;
          els.readout.hidden = true;
        }
        inst.inspectIndex = -1;
        inst.inspectKey = '';
        inst.inspectMode = '';
        inst.touchStart = null;
        statusEl.textContent = announce ? 'Chart inspection cleared.' : '';
      },

      nearestInspection: function (clientX, clientY) {
        if (!inst.inspect || !inst.inspect.items.length) return -1;
        var bounds = plot.getBoundingClientRect();
        if (!(bounds.width > 0) || !(bounds.height > 0)) return -1;
        var data = inst.inspect;
        var x = (clientX - bounds.left) * data.width / bounds.width;
        var y = (clientY - bounds.top) * data.height / bounds.height;
        var best = -1, bestScore = Infinity, bestPriority = -Infinity;

        function edgeDistance(value, start, length) {
          if (value < start) return start - value;
          if (value > start + length) return value - start - length;
          return 0;
        }

        for (var i = 0; i < data.items.length; i++) {
          var item = data.items[i];
          var dx, dy;
          if (item.hit) {
            dx = edgeDistance(x, item.hit.x, item.hit.w);
            dy = edgeDistance(y, item.hit.y, item.hit.h);
          } else {
            dx = x - item.x;
            dy = y - item.y;
          }
          var score = dx * dx + dy * dy;
          var priority = item.priority || 0;
          if (score < bestScore || (score === bestScore && priority > bestPriority)) {
            best = i;
            bestScore = score;
            bestPriority = priority;
          }
        }
        return best;
      },

      /* Whether the reader has actually typed anything into this card. It
         separates "nothing entered yet" from "entered, but this combination
         has no plot" — telling someone to enter parameters they can see on
         screen is the more confusing of the two failures. */
      hasValues: function () {
        var card = fig.closest('.calc-card');
        if (!card) return false;
        var fields = card.querySelectorAll('.inputs input, .inputs select');
        for (var i = 0; i < fields.length; i++) {
          if (String(fields[i].value).trim() !== '') return true;
        }
        return false;
      },

      /* Called by computeCard with the values and the results it just
         produced. The builder never recomputes — it reads. */
      update: function (v, results) {
        var spec = null;
        try { spec = chartDef.build(v, results); } catch (err) { spec = null; }
        inst.spec = spec;
        inst.drawnSpec = null;
        if (inst.visible) inst.draw();
      },

      draw: function () {
        var w = Math.round(plot.clientWidth);
        /* The empty state hides the plot, which zeroes its width. Measuring
           that zero and bailing would strand the chart in the empty state for
           good: every later redraw would read the same zero and return here,
           before the code that clears the class. So when there is a spec to
           draw, unhide first and measure again. */
        if (!w && inst.spec) {
          fig.classList.remove('is-empty');
          w = Math.round(plot.clientWidth);
        }
        if (!w) return;
        /* Sub-threshold width jitter is ignored so a redraw can never change
           the width that triggered it. */
        if (inst.drawnSpec === inst.spec && Math.abs(w - inst.lastW) < 8) return;
        var restoreKey = inst.inspectKey;
        var restoreMode = inst.inspectMode;
        inst.lastW = w;
        inst.drawnSpec = inst.spec;

        if (!inst.spec) {
          inst.disableInspection();
          plot.innerHTML = '';
          legendEl.hidden = true;
          emptyEl.textContent = inst.hasValues()
            ? 'These parameters cannot be plotted. Check that the values make sense together.'
            : 'Enter the parameters to plot this.';
          emptyEl.hidden = false;
          sumEl.textContent = '';
          details.hidden = true;
          details.open = false;
          fig.classList.add('is-empty');
          return;
        }

        var render = R[chartDef.kind];
        var out = null;
        /* A chart that fails to draw must never take the calculator with it:
           the numbers are the product, the plot is the commentary. */
        try {
          out = render ? render(inst.spec, w) : null;
        } catch (err) {
          out = null;
        }

        if (!out) {
          inst.disableInspection();
          plot.innerHTML = '';
          legendEl.hidden = true;
          /* There is a spec here, so the values exist — the plot itself is
             what failed. Never ask for parameters that are already on screen. */
          emptyEl.textContent = 'These parameters cannot be plotted. Check that the values make sense together.';
          emptyEl.hidden = false;
          sumEl.textContent = '';
          details.hidden = true;
          fig.classList.add('is-empty');
          return;
        }

        fig.classList.remove('is-empty');
        emptyEl.hidden = true;
        plot.innerHTML = out.svg;
        inst.prepareInspection(out.inspect, restoreKey, restoreMode);
        details.hidden = false;

        if (out.legend && out.legend.length) {
          legendEl.innerHTML = out.legend.map(function (l) {
            return '<span class="ch-key"><i class="ch-key-line ch-ls-' + l.style +
              ' ch-t-' + l.tone + '"></i>' + PM_CHARTS.esc(l.label) + '</span>';
          }).join('');
          legendEl.hidden = false;
        } else {
          legendEl.hidden = true;
        }

        sumEl.textContent = out.summary || '';

        if (details.open) inst.fillTable(out.table);
        else inst.pendingTable = out.table;
      },

      fillTable: function (t) {
        if (!t) { tableWrap.innerHTML = ''; return; }
        tableWrap.innerHTML =
          '<table class="chart-table"><caption class="sr-only">' +
            PM_CHARTS.esc(chartDef.title) + ' — plotted values</caption><thead><tr>' +
            t.head.map(function (c) { return '<th scope="col">' + PM_CHARTS.esc(c) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
            t.rows.map(function (row) {
              return '<tr>' + row.map(function (c, i) {
                return i === 0
                  ? '<th scope="row">' + PM_CHARTS.esc(c) + '</th>'
                  : '<td>' + PM_CHARTS.esc(c) + '</td>';
              }).join('') + '</tr>';
            }).join('') +
          '</tbody></table>';
      }
    };

    plot.addEventListener('pointermove', function (e) {
      if (!inst.inspect || e.pointerType === 'touch' || inst.inspectMode === 'touch') return;
      var next = inst.nearestInspection(e.clientX, e.clientY);
      if (next >= 0 && (inst.inspectMode !== 'hover' || inst.inspectIndex !== next)) {
        inst.showInspection(next, 'hover', false);
      }
    });

    plot.addEventListener('pointerleave', function () {
      if (inst.inspectMode === 'hover') inst.clearInspection(false);
    });

    plot.addEventListener('pointerdown', function (e) {
      if (!inst.inspect || e.pointerType !== 'touch') return;
      inst.touchStart = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });

    plot.addEventListener('pointercancel', function () {
      inst.touchStart = null;
    });

    plot.addEventListener('pointerup', function (e) {
      var start = inst.touchStart;
      inst.touchStart = null;
      if (!inst.inspect || e.pointerType !== 'touch' || !start || start.id !== e.pointerId) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (dx * dx + dy * dy > 144) return;
      var next = inst.nearestInspection(e.clientX, e.clientY);
      if (next < 0) return;
      var same = inst.inspectMode === 'touch' && inst.inspectIndex === next;
      inst.inspectMode = 'touch';
      plot.focus();
      if (same) inst.clearInspection(true);
      else inst.showInspection(next, 'touch', true);
    });

    plot.addEventListener('focus', function () {
      if (!inst.inspect || inst.inspectMode === 'touch') return;
      var next = inst.inspectIndex;
      if (next < 0) {
        next = 0;
        for (var i = 0; i < inst.inspect.items.length; i++) {
          if (inst.inspect.items[i].selected) { next = i; break; }
        }
      }
      inst.showInspection(next, 'keyboard', true);
    });

    plot.addEventListener('blur', function () {
      if (inst.inspectMode === 'keyboard') inst.clearInspection(false);
    });

    plot.addEventListener('keydown', function (e) {
      if (!inst.inspect || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var key = e.key;
      if (key === 'Escape') {
        inst.clearInspection(true);
        e.preventDefault();
        return;
      }

      var count = inst.inspect.items.length;
      var current = inst.inspectIndex >= 0 ? inst.inspectIndex : 0;
      var next = current;
      var columns = inst.inspect.columns || 0;
      if (key === 'Home') next = 0;
      else if (key === 'End') next = count - 1;
      else if (key === 'ArrowLeft') {
        next = columns && current % columns === 0 ? current : current - 1;
      } else if (key === 'ArrowRight') {
        next = columns && current % columns === columns - 1 ? current : current + 1;
      } else if (key === 'ArrowUp') {
        next = current - (columns || 1);
      } else if (key === 'ArrowDown') {
        next = current + (columns || 1);
      } else {
        return;
      }
      next = Math.max(0, Math.min(count - 1, next));
      inst.showInspection(next, 'keyboard', true);
      e.preventDefault();
    });

    details.addEventListener('toggle', function () {
      if (details.open) inst.fillTable(inst.pendingTable);
    });

    fig.__chart = inst;
    if (io) io.observe(fig); else { inst.visible = true; }
    return { el: fig, inst: inst };
  }

  /* One resize pass for the whole sheet, rather than an observer per chart:
     independent ResizeObservers are how a page starts dropping frames. */
  var all = [];
  var resizeTimer = null;
  function onResize() {
    if (resizeTimer) return;
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      for (var i = 0; i < all.length; i++) {
        if (all[i].visible) all[i].draw();
      }
    }, 140);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      for (var i = 0; i < all.length; i++) {
        if (all[i].inspectMode === 'hover') {
          all[i].clearInspection(true);
          e.preventDefault();
        }
      }
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      /* Colours come from CSS custom properties, so a scheme flip needs no
         redraw — but Safari < 14 needs the listener guard anyway. */
      if (mq.addEventListener) mq.addEventListener('change', onResize);
    }
  }

  return {
    build: function (card, chartDef) {
      var made = build(card, chartDef);
      all.push(made.inst);
      return made;
    }
  };
})();
