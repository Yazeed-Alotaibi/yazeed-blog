
/* PM Calculation Desk — instrument plotting.

   Charts here are drawings on the same sheet as everything else: hairline
   rules, tabular figures, square frames, no fills that mean nothing. A chart
   earns its place only when it shows a relationship the numbers alone hide.

   The contract: a card's `charts` array holds builders. Each builder receives
   the values the reader typed (v) and the results the card already computed
   (r), and returns a plot spec — or null when the inputs cannot support one.
   Builders never recompute a formula; computeCard is the single source of
   truth and hands them its own output. */

var PM_CHARTS = (function () {
  'use strict';

  /* ── geometry ──────────────────────────────────────────────────── */

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Round to a readable step so gridlines land on numbers a person would
     choose: 1, 2, 2.5, 5, 10 × a power of ten. */
  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return step * mag;
  }

  function ticks(min, max, target) {
    if (!isFinite(min) || !isFinite(max)) return [];
    if (min === max) { min -= 0.5; max += 0.5; }
    var step = niceStep((max - min) / (target || 4));
    var start = Math.ceil(min / step) * step;
    var out = [];
    for (var t = start; t <= max + step * 0.001 && out.length < 24; t += step) {
      out.push(Math.abs(t) < step * 1e-9 ? 0 : t);
    }
    return out;
  }

  /* Axis figures need to stay short — a six-figure budget cannot print in
     full on a 360px sheet without colliding with its neighbour. */
  function short(n) {
    if (!isFinite(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return trim(n / 1e9) + 'B';
    if (a >= 1e6) return trim(n / 1e6) + 'M';
    if (a >= 1e4) return trim(n / 1e3) + 'k';
    if (a >= 100) return String(Math.round(n));
    if (a >= 1) return trim(n);
    if (a === 0) return '0';
    return trim(n);
  }

  function trim(n) {
    var r = Math.round(n * 100) / 100;
    return String(r);
  }

  function full(n) {
    if (!isFinite(n)) return '—';
    return Number(n.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /* ── primitives ────────────────────────────────────────────────── */

  function svgOpen(w, h) {
    return '<svg class="ch-svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
      '" role="img" focusable="false" aria-hidden="true">';
  }

  function line(x1, y1, x2, y2, cls) {
    return '<line class="' + cls + '" x1="' + r1(x1) + '" y1="' + r1(y1) +
      '" x2="' + r1(x2) + '" y2="' + r1(y2) + '"/>';
  }

  function text(x, y, str, cls, anchor) {
    return '<text class="' + cls + '" x="' + r1(x) + '" y="' + r1(y) +
      '" text-anchor="' + (anchor || 'middle') + '">' + esc(str) + '</text>';
  }

  function rect(x, y, w, h, cls) {
    if (!(w > 0)) w = 0;
    if (!(h > 0)) h = 0;
    return '<rect class="' + cls + '" x="' + r1(x) + '" y="' + r1(y) +
      '" width="' + r1(w) + '" height="' + r1(h) + '"/>';
  }

  /* A comparison bar has a square zero-end and a 4px rounded data-end. The
     shared rect() primitive stays square because interval bands, matrix cells
     and calibrated meter zones encode exact boundaries. */
  function barPath(x, y, w, h, cls, growsUp) {
    if (!(w > 0)) w = 0;
    if (!(h > 0)) h = 0;
    var r = Math.min(4, w / 2, h / 2);
    var x2 = x + w, y2 = y + h;
    var d;
    if (growsUp) {
      d = 'M' + r1(x) + ' ' + r1(y2) +
        'L' + r1(x) + ' ' + r1(y + r) +
        'Q' + r1(x) + ' ' + r1(y) + ' ' + r1(x + r) + ' ' + r1(y) +
        'L' + r1(x2 - r) + ' ' + r1(y) +
        'Q' + r1(x2) + ' ' + r1(y) + ' ' + r1(x2) + ' ' + r1(y + r) +
        'L' + r1(x2) + ' ' + r1(y2) + 'Z';
    } else {
      d = 'M' + r1(x) + ' ' + r1(y) +
        'L' + r1(x2) + ' ' + r1(y) +
        'L' + r1(x2) + ' ' + r1(y2 - r) +
        'Q' + r1(x2) + ' ' + r1(y2) + ' ' + r1(x2 - r) + ' ' + r1(y2) +
        'L' + r1(x + r) + ' ' + r1(y2) +
        'Q' + r1(x) + ' ' + r1(y2) + ' ' + r1(x) + ' ' + r1(y2 - r) + 'Z';
    }
    return '<path class="' + cls + '" d="' + d + '"/>';
  }

  function inspection(w, h, pad, items, columns) {
    return {
      width: w,
      height: h,
      x1: pad.l,
      y1: pad.t,
      x2: w - pad.r,
      y2: h - pad.b,
      columns: columns || 0,
      items: items
    };
  }

  /* Half-pixel offsets keep hairlines from smearing across two device rows. */
  function r1(n) { return Math.round(n * 10) / 10; }
  function crisp(n) { return Math.round(n) + 0.5; }

  function plotFrame(w, h, pad) {
    return rect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b, 'ch-frame');
  }

  /* ── vertical / horizontal gridlines with labels ───────────────── */

  function yAxis(w, h, pad, sy, vals, fmt) {
    var out = '';
    for (var i = 0; i < vals.length; i++) {
      var y = crisp(sy(vals[i]));
      out += line(pad.l, y, w - pad.r, y, 'ch-grid');
      out += text(pad.l - 6, y + 3.5, (fmt || short)(vals[i]), 'ch-tick', 'end');
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDERERS
     Each takes (spec, w) and returns { svg, summary, table }.
     `table` is the accessible data view; `summary` the one-line reading.
     ══════════════════════════════════════════════════════════════════ */

  var R = {};

  /* ── bars: categorical comparison against an optional reference ──── */
  R.bars = function (spec, w) {
    var series = spec.series.filter(function (s) { return isFinite(s.value); });
    if (!series.length) return null;

    var h = spec.height || 190;
    var pad = { t: 18, r: 14, b: 44, l: 48 };
    var vals = series.map(function (s) { return s.value; });
    if (isFinite(spec.refValue)) vals.push(spec.refValue);
    var lo = Math.min(0, Math.min.apply(null, vals));
    var hi = Math.max(0, Math.max.apply(null, vals));
    if (lo === hi) hi = lo + 1;
    var span = hi - lo;
    lo -= span * 0.04; hi += span * 0.08;

    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    var sy = function (v) { return pad.t + ph - ((v - lo) / (hi - lo)) * ph; };

    var out = svgOpen(w, h);
    out += yAxis(w, h, pad, sy, ticks(lo, hi, 4), spec.tickFmt);
    out += plotFrame(w, h, pad);

    var inspectItems = [];
    var n = series.length;
    var slot = pw / n;
    var bw = Math.min(slot * 0.56, 24);
    var zeroY = sy(0);

    for (var i = 0; i < n; i++) {
      var s = series[i];
      var cx = pad.l + slot * (i + 0.5);
      var y = sy(s.value);
      var top = Math.min(y, zeroY), hgt = Math.abs(y - zeroY);
      var barH = Math.max(hgt, 1);
      var barX = cx - bw / 2;
      /* A hairline at least 1px tall so a zero-value bar still reads as a
         measured zero rather than a missing entry. */
      out += barPath(barX, top, bw, barH, 'ch-bar ch-t-' + (s.tone || 'neutral'), s.value >= 0);
      /* Pattern overlay, so a bar's role survives greyscale. */
      if (s.hatch) out += barPath(barX, top, bw, barH, 'ch-hatch', s.value >= 0);
      out += text(cx, h - pad.b + 14, s.label, 'ch-cat');
      if (s.sub) out += text(cx, h - pad.b + 26, s.sub, 'ch-cat ch-cat-sub');
      out += text(cx, top - 5, (spec.valueFmt || short)(s.value), 'ch-val');
      inspectItems.push({
        key: 'bar-' + i,
        label: s.label,
        value: full(s.value),
        detail: (s.sub ? s.sub + ' · ' : '') + (spec.valHead || 'Value'),
        x: cx,
        y: s.value >= 0 ? top : top + barH,
        guide: 'none',
        box: { x: barX, y: top, w: bw, h: barH },
        hit: { x: pad.l + slot * i, y: pad.t, w: slot, h: ph }
      });
    }

    out += line(pad.l, crisp(zeroY), w - pad.r, crisp(zeroY), 'ch-zero');

    if (isFinite(spec.refValue)) {
      var ry = crisp(sy(spec.refValue));
      out += line(pad.l, ry, w - pad.r, ry, 'ch-ref');
      out += text(w - pad.r - 3, ry - 5, spec.refLabel || '', 'ch-reflabel', 'end');
    }
    out += '</svg>';

    return {
      svg: out,
      inspect: inspection(w, h, pad, inspectItems),
      summary: spec.summary || series.map(function (s) {
        return s.label + ' ' + full(s.value);
      }).join('; ') + '.',
      table: {
        head: [spec.catHead || 'Measure', spec.valHead || 'Value'],
        rows: series.map(function (s) { return [s.label + (s.sub ? ' (' + s.sub + ')' : ''), full(s.value)]; })
          .concat(isFinite(spec.refValue) ? [[spec.refLabel || 'Reference', full(spec.refValue)]] : [])
      }
    };
  };

  /* ── quadrant: two indices against a crossed reference ──────────── */
  R.quadrant = function (spec, w) {
    if (!isFinite(spec.x) || !isFinite(spec.y)) return null;

    var h = spec.height || 232;
    var pad = { t: 16, r: 16, b: 38, l: 46 };
    var rx = isFinite(spec.refX) ? spec.refX : 1;
    var ry = isFinite(spec.refY) ? spec.refY : 1;

    /* Keep the reference cross centred so the four zones stay equal — a
       lopsided cross reads as a verdict the data has not earned. */
    var reach = Math.max(
      Math.abs(spec.x - rx), Math.abs(spec.y - ry), spec.minReach || 0.25
    ) * 1.25;
    var xlo = rx - reach, xhi = rx + reach;
    var ylo = ry - reach, yhi = ry + reach;

    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    var sx = function (v) { return pad.l + ((v - xlo) / (xhi - xlo)) * pw; };
    var sy = function (v) { return pad.t + ph - ((v - ylo) / (yhi - ylo)) * ph; };

    var out = svgOpen(w, h);

    var cxr = sx(rx), cyr = sy(ry);
    /* The favourable quadrant is shaded, not coloured: a wash plus the
       corner labels carries the meaning without depending on hue. */
    out += rect(cxr, pad.t, w - pad.r - cxr, cyr - pad.t, 'ch-zone-good');
    out += rect(pad.l, cyr, cxr - pad.l, h - pad.b - cyr, 'ch-zone-bad');

    var i;
    var xt = ticks(xlo, xhi, 3), yt = ticks(ylo, yhi, 3);
    for (i = 0; i < yt.length; i++) {
      var gy = crisp(sy(yt[i]));
      out += line(pad.l, gy, w - pad.r, gy, 'ch-grid');
      out += text(pad.l - 6, gy + 3.5, trim(yt[i]), 'ch-tick', 'end');
    }
    for (i = 0; i < xt.length; i++) {
      var gx = crisp(sx(xt[i]));
      out += line(gx, pad.t, gx, h - pad.b, 'ch-grid');
      out += text(gx, h - pad.b + 14, trim(xt[i]), 'ch-tick');
    }

    out += plotFrame(w, h, pad);
    out += line(crisp(cxr), pad.t, crisp(cxr), h - pad.b, 'ch-ref');
    out += line(pad.l, crisp(cyr), w - pad.r, crisp(cyr), 'ch-ref');

    out += text(w - pad.r - 4, pad.t + 12, spec.goodLabel || 'favourable', 'ch-zonelabel', 'end');
    out += text(pad.l + 4, h - pad.b - 5, spec.badLabel || 'unfavourable', 'ch-zonelabel', 'start');

    /* Clamp the plotted point inside the frame so an extreme index still
       shows a direction instead of vanishing off the sheet. */
    var px = Math.max(pad.l + 3, Math.min(w - pad.r - 3, sx(spec.x)));
    var py = Math.max(pad.t + 3, Math.min(h - pad.b - 3, sy(spec.y)));
    out += line(px - 7, py, px + 7, py, 'ch-cross');
    out += line(px, py - 7, px, py + 7, 'ch-cross');
    out += '<circle class="ch-point ch-t-' + (spec.tone || 'neutral') + '" cx="' + r1(px) +
      '" cy="' + r1(py) + '" r="4.5"/>';
    out += text(
      px, py - 12,
      trim(spec.x) + ' / ' + trim(spec.y),
      'ch-val',
      px > w - pad.r - 46 ? 'end' : px < pad.l + 46 ? 'start' : 'middle'
    );

    out += text(pad.l + pw / 2, h - 6, spec.xLabel || '', 'ch-axis');
    out += '<text class="ch-axis" transform="translate(11,' + r1(pad.t + ph / 2) +
      ') rotate(-90)" text-anchor="middle">' + esc(spec.yLabel || '') + '</text>';
    out += '</svg>';

    return {
      svg: out,
      inspect: inspection(w, h, pad, [{
        key: 'quadrant-reading',
        label: 'Current reading',
        value: (spec.xLabel || 'x') + ' ' + full(spec.x),
        detail: (spec.yLabel || 'y') + ' ' + full(spec.y),
        x: px,
        y: py,
        guide: 'xy'
      }]),
      summary: spec.summary || ((spec.xLabel || 'x') + ' ' + trim(spec.x) + ', ' +
        (spec.yLabel || 'y') + ' ' + trim(spec.y) + '.'),
      table: {
        head: ['Axis', 'Value', 'Reference'],
        rows: [
          [spec.xLabel || 'x', trim(spec.x), trim(rx)],
          [spec.yLabel || 'y', trim(spec.y), trim(ry)]
        ]
      }
    };
  };

  /* ── matrix: a discrete probability–impact grid ─────────────────── */
  R.matrix = function (spec, w) {
    var p = spec.p, im = spec.i;
    if (!isFinite(p) || !isFinite(im)) return null;
    var size = spec.size || 5;
    p = Math.max(1, Math.min(size, Math.round(p)));
    im = Math.max(1, Math.min(size, Math.round(im)));

    var pad = { t: 14, r: 14, b: 36, l: 42 };
    var cell = Math.max(22, Math.min(46, (w - pad.l - pad.r) / size));
    var gw = cell * size;
    var h = pad.t + gw + pad.b;

    var inspectItems = [];
    var out = svgOpen(w, h);
    var x0 = pad.l, y0 = pad.t;

    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var prob = size - r;            /* top row = highest probability */
        var imp = c + 1;
        var score = prob * imp;
        var band = score >= 15 ? 'bad' : score >= 8 ? 'warn' : 'good';
        var bandName = score >= 15 ? 'High' : score >= 8 ? 'Moderate' : 'Low';
        var cx = x0 + c * cell, cy = y0 + r * cell;
        out += rect(cx, cy, cell, cell, 'ch-cell ch-band-' + band);
        out += text(cx + cell / 2, cy + cell / 2 + 3.5, String(score), 'ch-cellnum');
        inspectItems.push({
          key: 'cell-' + prob + '-' + imp,
          label: (prob === p && imp === im ? 'Selected · ' : '') +
            'Probability ' + prob + ' × impact ' + imp,
          value: 'Score ' + score,
          detail: bandName + ' band',
          x: cx + cell / 2,
          y: cy + cell / 2,
          guide: 'none',
          selected: prob === p && imp === im,
          box: { x: cx, y: cy, w: cell, h: cell },
          hit: { x: cx, y: cy, w: cell, h: cell }
        });
      }
    }

    /* The entered risk is marked by an open square — position and outline,
       not fill colour, is what identifies it. */
    var mc = x0 + (im - 1) * cell, mr = y0 + (size - p) * cell;
    out += rect(mc + 2, mr + 2, cell - 4, cell - 4, 'ch-cellmark');
    out += rect(mc + 5, mr + 5, cell - 10, cell - 10, 'ch-cellmark2');

    for (var k = 1; k <= size; k++) {
      out += text(x0 + (k - 0.5) * cell, h - pad.b + 14, String(k), 'ch-tick');
      out += text(x0 - 7, y0 + (size - k + 0.5) * cell + 3.5, String(k), 'ch-tick', 'end');
    }
    out += text(x0 + gw / 2, h - 6, 'Impact →', 'ch-axis');
    out += '<text class="ch-axis" transform="translate(10,' + r1(y0 + gw / 2) +
      ') rotate(-90)" text-anchor="middle">Probability →</text>';
    out += '</svg>';

    return {
      svg: out,
      inspect: inspection(w, h, pad, inspectItems, size),
      summary: 'Probability ' + p + ' × impact ' + im + ' places this risk at score ' +
        (p * im) + ' of ' + (size * size) + '.',
      table: {
        head: ['Probability', 'Impact', 'Score', 'Band'],
        rows: [[String(p), String(im), String(p * im),
          p * im >= 15 ? 'High' : p * im >= 8 ? 'Moderate' : 'Low']]
      }
    };
  };

  /* ── curve: one or more series over a numeric x, with markers ───── */
  R.curve = function (spec, w) {
    var series = (spec.series || []).filter(function (s) { return s.points && s.points.length > 1; });
    if (!series.length) return null;

    var h = spec.height || 200;
    var pad = { t: 18, r: 16, b: 40, l: 52 };
    var xs = [], ys = [];
    series.forEach(function (s) {
      s.points.forEach(function (pt) {
        if (isFinite(pt[0]) && isFinite(pt[1])) { xs.push(pt[0]); ys.push(pt[1]); }
      });
    });
    if (xs.length < 2) return null;
    (spec.markers || []).forEach(function (m) {
      if (isFinite(m.x)) xs.push(m.x);
      if (isFinite(m.y)) ys.push(m.y);
    });
    if (isFinite(spec.refY)) ys.push(spec.refY);

    var xlo = Math.min.apply(null, xs), xhi = Math.max.apply(null, xs);
    var ylo = Math.min.apply(null, ys), yhi = Math.max.apply(null, ys);
    if (spec.zeroBase) { ylo = Math.min(0, ylo); yhi = Math.max(0, yhi); }
    if (xlo === xhi) xhi = xlo + 1;
    if (ylo === yhi) { ylo -= 0.5; yhi += 0.5; }
    var yspan = yhi - ylo;
    ylo -= yspan * 0.08; yhi += yspan * 0.12;

    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    var sx = function (v) { return pad.l + ((v - xlo) / (xhi - xlo)) * pw; };
    var sy = function (v) { return pad.t + ph - ((v - ylo) / (yhi - ylo)) * ph; };

    var inspectItems = [];
    var inspectSeq = 0;
    var out = svgOpen(w, h);
    out += yAxis(w, h, pad, sy, ticks(ylo, yhi, 4), spec.tickFmt);

    var xt = ticks(xlo, xhi, Math.max(2, Math.min(5, Math.floor(w / 78))));
    for (var i = 0; i < xt.length; i++) {
      var gx = crisp(sx(xt[i]));
      out += line(gx, pad.t, gx, h - pad.b, 'ch-grid');
      out += text(gx, h - pad.b + 14, short(xt[i]), 'ch-tick');
    }
    out += plotFrame(w, h, pad);

    if (ylo < 0 && yhi > 0) out += line(pad.l, crisp(sy(0)), w - pad.r, crisp(sy(0)), 'ch-zero');
    if (isFinite(spec.refY)) {
      var ry = crisp(sy(spec.refY));
      out += line(pad.l, ry, w - pad.r, ry, 'ch-ref');
      if (spec.refLabel) out += text(w - pad.r - 3, ry - 5, spec.refLabel, 'ch-reflabel', 'end');
    }
    if (isFinite(spec.refX)) {
      var rxx = crisp(sx(spec.refX));
      out += line(rxx, pad.t, rxx, h - pad.b, 'ch-ref');
      if (spec.refXLabel) {
        out += text(rxx + 4, pad.t + 11, spec.refXLabel, 'ch-reflabel',
          rxx > w - pad.r - 70 ? 'end' : 'start');
      }
    }

    /* Line style, not just colour, separates the series — a dashed baseline
       stays a baseline in greyscale and for a dichromatic reader. */
    series.forEach(function (s, si) {
      var d = '';
      var seriesLabel = s.label || ('Series ' + (si + 1));
      s.points.forEach(function (pt, k) {
        if (!isFinite(pt[0]) || !isFinite(pt[1])) return;
        var px = sx(pt[0]), py = sy(pt[1]);
        d += (k === 0 || !d ? 'M' : 'L') + r1(px) + ' ' + r1(py);
        var merged = null;
        for (var ii = 0; ii < inspectItems.length; ii++) {
          if (inspectItems[ii].priority === 1 &&
              Math.abs(inspectItems[ii].x - px) < 0.05 &&
              Math.abs(inspectItems[ii].y - py) < 0.05) {
            merged = inspectItems[ii];
            break;
          }
        }
        if (merged) {
          if (merged.label.indexOf(seriesLabel) === -1) {
            merged.label += ' / ' + seriesLabel;
            merged.seriesValues += ' · ' + seriesLabel + ' ' + full(pt[1]);
            merged.value = (spec.yLabel || 'Value') + ': ' + merged.seriesValues;
          }
        } else {
          inspectItems.push({
            key: 'series-' + si + '-' + k,
            label: seriesLabel,
            value: (spec.yLabel || 'Value') + ' ' + full(pt[1]),
            seriesValues: seriesLabel + ' ' + full(pt[1]),
            detail: (spec.xLabel || 'x') + ' ' + full(pt[0]),
            x: px,
            y: py,
            guide: 'xy',
            priority: 1,
            order: inspectSeq++
          });
        }
      });
      if (s.fill) {
        var base = sy(Math.max(ylo, Math.min(yhi, 0)));
        out += '<path class="ch-area ch-t-' + (s.tone || 'accent') + '" d="' + d +
          'L' + r1(sx(s.points[s.points.length - 1][0])) + ' ' + r1(base) +
          'L' + r1(sx(s.points[0][0])) + ' ' + r1(base) + 'Z"/>';
      }
      out += '<path class="ch-line ch-ls-' + (s.style || (si === 0 ? 'solid' : 'dashed')) +
        ' ch-t-' + (s.tone || 'accent') + '" d="' + d + '"/>';
    });

    (spec.markers || []).forEach(function (m, mi) {
      if (!isFinite(m.x) || !isFinite(m.y)) return;
      var mx = sx(m.x), my = sy(m.y);
      out += line(mx, pad.t, mx, h - pad.b, 'ch-marker-rule');
      out += '<circle class="ch-point ch-t-' + (m.tone || 'accent') + '" cx="' + r1(mx) +
        '" cy="' + r1(my) + '" r="4"/>';
      if (m.label) {
        out += text(mx, my - 10, m.label, 'ch-val',
          mx > w - pad.r - 50 ? 'end' : mx < pad.l + 50 ? 'start' : 'middle');
      }
      inspectItems.push({
        key: 'marker-' + mi,
        label: m.label || 'Marker',
        value: (spec.yLabel || 'Value') + ' ' + full(m.y),
        detail: (spec.xLabel || 'x') + ' ' + full(m.x),
        x: mx,
        y: my,
        guide: 'xy',
        priority: 2,
        order: inspectSeq++
      });
    });

    out += text(pad.l + pw / 2, h - 5, spec.xLabel || '', 'ch-axis');
    if (spec.yLabel) {
      out += '<text class="ch-axis" transform="translate(11,' + r1(pad.t + ph / 2) +
        ') rotate(-90)" text-anchor="middle">' + esc(spec.yLabel) + '</text>';
    }
    out += '</svg>';

    var legend = series.length > 1 ? series.map(function (s) {
      return { label: s.label, style: s.style || 'solid', tone: s.tone || 'accent' };
    }) : null;

    inspectItems.sort(function (a, b) {
      return a.x - b.x || a.y - b.y || a.order - b.order;
    });

    return {
      svg: out,
      inspect: inspection(w, h, pad, inspectItems),
      summary: spec.summary || '',
      legend: legend,
      table: spec.table || {
        head: [spec.xLabel || 'x'].concat(series.map(function (s) { return s.label; })),
        rows: sampleRows(series, spec)
      }
    };
  };

  /* The data view is a reading aid, not a dump: sample a long curve down to
     a dozen rows so a screen-reader user gets the shape, not 400 numbers. */
  function sampleRows(series, spec) {
    var base = series[0].points;
    var stride = Math.max(1, Math.ceil(base.length / 12));
    var rows = [];
    for (var i = 0; i < base.length; i += stride) {
      var row = [short(base[i][0])];
      for (var s = 0; s < series.length; s++) {
        var pt = series[s].points[i];
        row.push(pt ? (spec.tickFmt || full)(pt[1]) : '—');
      }
      rows.push(row);
    }
    return rows;
  }

  /* ── distribution: three-point spread with the PERT estimate ────── */
  R.distribution = function (spec, w) {
    var o = spec.o, m = spec.m, p = spec.p, e = spec.e, sd = spec.sd;
    if (!isFinite(o) || !isFinite(m) || !isFinite(p) || !isFinite(e)) return null;
    if (p < o) return null;

    var h = spec.height || 190;
    var pad = { t: 16, r: 18, b: 42, l: 18 };
    var span = p - o;
    var xlo = o - span * 0.12 - (span === 0 ? 1 : 0);
    var xhi = p + span * 0.12 + (span === 0 ? 1 : 0);
    var pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    var sx = function (v) { return pad.l + ((v - xlo) / (xhi - xlo)) * pw; };

    /* Beta-PERT density, sampled. Shape parameters follow the standard
       PERT parameterisation with lambda = 4. */
    var pts = [], i, dens = [], maxD = 0;
    var N = 96;
    if (span > 0) {
      var a = 1 + 4 * (m - o) / span;
      var b = 1 + 4 * (p - m) / span;
      for (i = 0; i <= N; i++) {
        var t = i / N;
        var d = (t <= 0 || t >= 1) ? 0 : Math.exp((a - 1) * Math.log(t) + (b - 1) * Math.log(1 - t));
        if (!isFinite(d)) d = 0;
        dens.push(d);
        if (d > maxD) maxD = d;
      }
    }
    if (!(maxD > 0)) { for (i = 0; i <= N; i++) dens[i] = i === 0 || i === N ? 0 : 1; maxD = 1; }

    var baseY = pad.t + ph;
    for (i = 0; i <= N; i++) {
      pts.push([sx(o + (i / N) * span), baseY - (dens[i] / maxD) * (ph - 8)]);
    }

    var inspectItems = [];
    function inspectStem(key, label, value, y) {
      for (var j = 0; j < inspectItems.length; j++) {
        if (inspectItems[j].raw === value) {
          inspectItems[j].label += ' / ' + label;
          inspectItems[j].y = Math.min(inspectItems[j].y, y);
          return;
        }
      }
      inspectItems.push({
        key: key,
        label: label,
        value: full(value),
        detail: 'Three-point estimate',
        raw: value,
        x: sx(value),
        y: y,
        guide: 'x'
      });
    }
    inspectStem('optimistic', 'Optimistic (O)', o, baseY - 8);
    inspectStem('most-likely', 'Most likely (M)', m, baseY - 8);
    inspectStem('pessimistic', 'Pessimistic (P)', p, baseY - 8);
    inspectStem('estimate', 'PERT estimate (E)', e, pad.t + 2);

    var out = svgOpen(w, h);
    var d0 = '';
    for (i = 0; i < pts.length; i++) d0 += (i ? 'L' : 'M') + r1(pts[i][0]) + ' ' + r1(pts[i][1]);

    /* Confidence band clipped to the curve: shows where the committed range
       actually sits under the distribution. */
    if (isFinite(sd) && sd > 0) {
      var lo1 = Math.max(o, e - sd), hi1 = Math.min(p, e + sd);
      out += '<clipPath id="' + spec.clipId + '"><rect x="' + r1(sx(lo1)) + '" y="' + pad.t +
        '" width="' + r1(Math.max(0, sx(hi1) - sx(lo1))) + '" height="' + r1(ph) + '"/></clipPath>';
      out += '<path class="ch-dist-band" clip-path="url(#' + spec.clipId + ')" d="' + d0 +
        'L' + r1(sx(p)) + ' ' + r1(baseY) + 'L' + r1(sx(o)) + ' ' + r1(baseY) + 'Z"/>';
    }
    out += '<path class="ch-dist-fill" d="' + d0 + 'L' + r1(sx(p)) + ' ' + r1(baseY) +
      'L' + r1(sx(o)) + ' ' + r1(baseY) + 'Z"/>';
    out += '<path class="ch-line ch-t-accent" d="' + d0 + '"/>';
    out += line(pad.l, crisp(baseY), w - pad.r, crisp(baseY), 'ch-zero');

    function stem(v, label, cls, side) {
      if (!isFinite(v)) return '';
      var x = sx(v);
      var s = line(crisp(x), pad.t + 2, crisp(x), baseY, cls);
      s += text(x, baseY + 14, label, 'ch-cat', side || 'middle');
      s += text(x, baseY + 26, short(v), 'ch-val', side || 'middle');
      return s;
    }

    out += stem(o, 'O', 'ch-stem', sx(o) < pad.l + 22 ? 'start' : 'middle');
    out += stem(m, 'M', 'ch-stem');
    out += stem(p, 'P', 'ch-stem', sx(p) > w - pad.r - 22 ? 'end' : 'middle');
    out += line(crisp(sx(e)), pad.t, crisp(sx(e)), baseY, 'ch-stem-e');
    out += text(sx(e), pad.t - 4, 'E ' + short(e), 'ch-val ch-val-strong');
    out += '</svg>';

    return {
      svg: out,
      inspect: inspection(w, h, pad, inspectItems),
      summary: 'Optimistic ' + full(o) + ', most likely ' + full(m) + ', pessimistic ' + full(p) +
        '. PERT estimate ' + full(e) +
        (isFinite(sd) && sd > 0 ? ', with the shaded band covering ' + full(e - sd) + ' to ' + full(e + sd) +
          ' — about a 68% chance the outcome lands inside it.' : '.'),
      table: {
        head: ['Point', 'Value'],
        rows: [['Optimistic (O)', full(o)], ['Most likely (M)', full(m)], ['Pessimistic (P)', full(p)],
          ['PERT estimate (E)', full(e)]].concat(
          isFinite(sd) ? [['Standard deviation (σ)', full(sd)],
            ['68% range', full(e - sd) + ' – ' + full(e + sd)]] : [])
      }
    };
  };

  /* ── rangeplot: a value and its bands on one number line ────────── */
  R.rangeplot = function (spec, w) {
    var marks = (spec.marks || []).filter(function (m) { return isFinite(m.at); });
    var bands = (spec.bands || []).filter(function (b) { return isFinite(b.from) && isFinite(b.to); });
    if (!marks.length && !bands.length) return null;

    var vals = [];
    marks.forEach(function (m) { vals.push(m.at); });
    bands.forEach(function (b) { vals.push(b.from, b.to); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    var span = hi - lo;
    lo -= span * 0.1; hi += span * 0.1;

    var rows = Math.max(1, bands.length);
    var h = spec.height || (72 + rows * 20);
    var pad = { t: 14, r: 16, b: 40, l: 16 };
    var pw = w - pad.l - pad.r;
    var sx = function (v) { return pad.l + ((v - lo) / (hi - lo)) * pw; };
    var axisY = h - pad.b;

    var markItems = [], bandItems = [];
    var out = svgOpen(w, h);
    var xt = ticks(lo, hi, Math.max(2, Math.min(5, Math.floor(w / 84))));
    for (var i = 0; i < xt.length; i++) {
      var gx = crisp(sx(xt[i]));
      out += line(gx, pad.t, gx, axisY, 'ch-grid');
      out += text(gx, axisY + 14, (spec.tickFmt || short)(xt[i]), 'ch-tick');
    }

    var bandTop = pad.t + 4;
    var bandH = Math.max(12, (axisY - bandTop - 6) / rows - 6);
    bands.forEach(function (b, k) {
      var x1 = sx(Math.min(b.from, b.to)), x2 = sx(Math.max(b.from, b.to));
      var y = bandTop + k * (bandH + 6);
      out += rect(x1, y, Math.max(x2 - x1, 1), bandH, 'ch-band ch-t-' + (b.tone || 'neutral'));
      if (b.hatch) out += rect(x1, y, Math.max(x2 - x1, 1), bandH, 'ch-hatch');
      if (b.label) {
        out += text(x1 + 5, y + bandH / 2 + 3.5, b.label, 'ch-bandlabel', 'start');
      }
      bandItems.push({
        key: 'band-' + k,
        label: b.label || 'Range',
        value: full(b.from) + ' – ' + full(b.to),
        detail: 'Range band',
        x: (x1 + x2) / 2,
        y: y + bandH / 2,
        guide: 'none',
        box: { x: x1, y: y, w: Math.max(x2 - x1, 1), h: bandH },
        hit: { x: x1, y: y, w: Math.max(x2 - x1, 1), h: bandH }
      });
    });

    out += line(pad.l, crisp(axisY), w - pad.r, crisp(axisY), 'ch-zero');

    marks.forEach(function (m, mi) {
      var x = sx(m.at);
      out += line(crisp(x), pad.t, crisp(x), axisY + 4, 'ch-stem' + (m.strong ? '-e' : ''));
      var anchor = x > w - pad.r - 44 ? 'end' : x < pad.l + 44 ? 'start' : 'middle';
      out += text(x, axisY + 26, m.label, 'ch-cat', anchor);
      out += text(x, axisY + 37, (spec.valueFmt || short)(m.at), 'ch-val', anchor);
      markItems.push({
        key: 'mark-' + mi,
        label: m.label || 'Marked point',
        value: full(m.at),
        detail: 'Marked point',
        x: x,
        y: pad.t + (axisY - pad.t) / 2,
        guide: 'x',
        priority: 2,
        hit: { x: x - 22, y: pad.t, w: 44, h: axisY - pad.t }
      });
    });
    out += '</svg>';

    return {
      svg: out,
      inspect: inspection(w, h, pad, markItems.concat(bandItems)),
      summary: spec.summary || marks.map(function (m) {
        return m.label + ' at ' + full(m.at);
      }).join('; ') + '.',
      table: {
        head: ['Point', 'Value'],
        rows: marks.map(function (m) { return [m.label, full(m.at)]; })
          .concat(bands.map(function (b) {
            return [b.label || 'Band', full(b.from) + ' – ' + full(b.to)];
          }))
      }
    };
  };

  /* ── meter: one reading against labelled threshold zones ────────── */
  R.meter = function (spec, w) {
    if (!isFinite(spec.value)) return null;
    var zones = (spec.zones || []).filter(function (z) { return isFinite(z.from) && isFinite(z.to); });
    if (!zones.length) return null;

    var lo = spec.min, hi = spec.max;
    zones.forEach(function (z) {
      lo = isFinite(lo) ? Math.min(lo, z.from) : z.from;
      hi = isFinite(hi) ? Math.max(hi, z.to) : z.to;
    });
    /* An out-of-range reading widens the scale rather than pinning silently,
       so the reader can see how far past the last threshold it sits. */
    lo = Math.min(lo, spec.value);
    hi = Math.max(hi, spec.value);
    if (isFinite(spec.target)) {
      lo = Math.min(lo, spec.target);
      hi = Math.max(hi, spec.target);
    }
    if (lo === hi) { lo -= 1; hi += 1; }

    var h = spec.height || 108;
    var pad = { t: 30, r: 16, b: 34, l: 16 };
    var pw = w - pad.l - pad.r;
    var sx = function (v) { return pad.l + ((v - lo) / (hi - lo)) * pw; };
    var barY = pad.t, barH = 20;
    var valueFmt = spec.valueFmt || trim;

    var out = svgOpen(w, h);
    zones.forEach(function (z) {
      var x1 = sx(z.from), x2 = sx(z.to);
      out += rect(x1, barY, Math.max(x2 - x1, 1), barH, 'ch-band ch-t-' + (z.tone || 'neutral'));
      if (z.hatch) out += rect(x1, barY, Math.max(x2 - x1, 1), barH, 'ch-hatch');
      if (z.label && x2 - x1 > 46) {
        out += text((x1 + x2) / 2, barY + barH + 13, z.label, 'ch-cat');
      }
      out += line(crisp(x2), barY, crisp(x2), barY + barH, 'ch-band-div');
    });
    out += rect(pad.l, barY, pw, barH, 'ch-frame');

    if (isFinite(spec.target)) {
      var tx = crisp(sx(spec.target));
      out += line(tx, barY - 5, tx, barY + barH + 5, 'ch-ref');
      out += text(sx(spec.target), barY - 9, spec.targetLabel || '', 'ch-reflabel');
    }

    /* The reading is a filled triangle above the scale: position carries the
       verdict, so it survives greyscale. */
    var vx = sx(spec.value);
    out += '<path class="ch-needle ch-t-' + (spec.tone || 'neutral') + '" d="M' + r1(vx) + ' ' +
      r1(barY - 1) + 'l-6 -9 h12 Z"/>';
    var anchor = vx > w - pad.r - 40 ? 'end' : vx < pad.l + 40 ? 'start' : 'middle';
    out += text(vx, barY - 14, valueFmt(spec.value), 'ch-val ch-val-strong', anchor);
    out += text(pad.l, h - 6, (spec.tickFmt || short)(lo), 'ch-tick', 'start');
    out += text(w - pad.r, h - 6, (spec.tickFmt || short)(hi), 'ch-tick', 'end');
    if (spec.scaleLabel) out += text(pad.l + pw / 2, h - 6, spec.scaleLabel, 'ch-axis');
    out += '</svg>';

    var inZone = null;
    for (var i = 0; i < zones.length; i++) {
      if (spec.value >= zones[i].from && spec.value <= zones[i].to) { inZone = zones[i]; break; }
    }

    var inspectItems = [{
      key: 'meter-reading',
      label: spec.label || 'Reading',
      value: valueFmt(spec.value),
      detail: inZone && inZone.label ? inZone.label + ' band' : 'Outside labelled bands',
      x: vx,
      y: barY - 5,
      guide: 'x',
      priority: 2,
      hit: { x: vx - 22, y: barY - 12, w: 44, h: barH + 24 }
    }];
    if (isFinite(spec.target)) {
      inspectItems.push({
        key: 'meter-target',
        label: spec.targetLabel || 'Target',
        value: valueFmt(spec.target),
        detail: 'Reference target',
        x: sx(spec.target),
        y: barY + barH / 2,
        guide: 'x',
        priority: 1,
        hit: { x: sx(spec.target) - 22, y: barY - 12, w: 44, h: barH + 24 }
      });
    }
    zones.forEach(function (z, zi) {
      var x1 = sx(Math.min(z.from, z.to)), x2 = sx(Math.max(z.from, z.to));
      inspectItems.push({
        key: 'meter-zone-' + zi,
        label: z.label || 'Threshold band',
        value: valueFmt(z.from) + ' – ' + valueFmt(z.to),
        detail: 'Threshold band',
        x: (x1 + x2) / 2,
        y: barY + barH / 2,
        guide: 'none',
        box: { x: x1, y: barY, w: Math.max(x2 - x1, 1), h: barH },
        hit: { x: x1, y: barY, w: Math.max(x2 - x1, 1), h: barH }
      });
    });

    return {
      svg: out,
      inspect: inspection(w, h, pad, inspectItems),
      summary: spec.summary || ((spec.label || 'Reading') + ' ' + full(spec.value) +
        (inZone && inZone.label ? ', in the ' + inZone.label + ' band.' : '.')),
      table: {
        head: ['Band', 'From', 'To'],
        rows: zones.map(function (z) { return [z.label || '—', full(z.from), full(z.to)]; })
          .concat([[(spec.label || 'Reading'), full(spec.value), '']])
      }
    };
  };

  /* ── windows: early and late activity windows on a shared axis ──── */
  R.windows = function (spec, w) {
    var rows = (spec.rows || []).filter(function (r) { return isFinite(r.from) && isFinite(r.to); });
    if (!rows.length) return null;

    var vals = [];
    rows.forEach(function (r) { vals.push(r.from, r.to); });
    (spec.marks || []).forEach(function (m) { if (isFinite(m.at)) vals.push(m.at); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (lo === hi) hi = lo + 1;
    var span = hi - lo;
    lo -= span * 0.08; hi += span * 0.12;

    /* The label column and the note column are both sized from their own
       longest string — a mono-font character estimate, since an SVG string
       builder has no live text measurement to call. Reserving real space
       for both keeps every row's text inside the frame instead of running
       off either edge. */
    var maxLabelLen = 0, maxNoteLen = 0, hasNote = false;
    rows.forEach(function (r) {
      maxLabelLen = Math.max(maxLabelLen, String(r.label || '').length);
      if (r.note) { hasNote = true; maxNoteLen = Math.max(maxNoteLen, String(r.note).length); }
    });
    var padL = Math.max(50, Math.min(160, 14 + maxLabelLen * 5.6));
    var padR = hasNote ? Math.max(16, Math.min(120, 12 + maxNoteLen * 5.6)) : 16;

    var pad = { t: 16, r: padR, b: 34, l: padL };
    var rowH = 26;
    var h = pad.t + rows.length * rowH + pad.b;
    var pw = w - pad.l - pad.r;
    var sx = function (v) { return pad.l + ((v - lo) / (hi - lo)) * pw; };
    var axisY = h - pad.b;

    var markItems = [], rowItems = [];
    var out = svgOpen(w, h);
    var xt = ticks(lo, hi, Math.max(2, Math.min(6, Math.floor(w / 70))));
    for (var i = 0; i < xt.length; i++) {
      var gx = crisp(sx(xt[i]));
      out += line(gx, pad.t, gx, axisY, 'ch-grid');
      out += text(gx, axisY + 14, short(xt[i]), 'ch-tick');
    }

    rows.forEach(function (r, k) {
      var y = pad.t + k * rowH + 4;
      var bh = rowH - 12;
      var x1 = sx(Math.min(r.from, r.to)), x2 = sx(Math.max(r.from, r.to));
      out += rect(x1, y, Math.max(x2 - x1, 2), bh, 'ch-bar ch-t-' + (r.tone || 'neutral'));
      if (r.hatch) out += rect(x1, y, Math.max(x2 - x1, 2), bh, 'ch-hatch');
      out += text(pad.l - 7, y + bh / 2 + 3.5, r.label, 'ch-cat', 'end');
      /* The note sits in a fixed right-hand column, not trailing the bar —
         a bar that reaches the frame edge would otherwise push its own
         note off the drawing. */
      if (r.note) out += text(w - 4, y + bh / 2 + 3.5, r.note, 'ch-val', 'end');
      rowItems.push({
        key: 'window-' + k,
        label: r.label || 'Activity window',
        value: full(r.from) + ' – ' + full(r.to),
        detail: r.note || ('Span ' + full(Math.abs(r.to - r.from))),
        x: (x1 + x2) / 2,
        y: y + bh / 2,
        guide: 'none',
        box: { x: x1, y: y, w: Math.max(x2 - x1, 2), h: bh },
        hit: { x: x1, y: y, w: Math.max(x2 - x1, 2), h: bh }
      });
    });

    (spec.marks || []).forEach(function (m, mi) {
      if (!isFinite(m.at)) return;
      var x = crisp(sx(m.at));
      out += line(x, pad.t - 2, x, axisY, 'ch-stem-e');
      out += text(sx(m.at), axisY + 26, m.label, 'ch-cat',
        sx(m.at) > w - pad.r - 40 ? 'end' : 'middle');
      markItems.push({
        key: 'window-mark-' + mi,
        label: m.label || 'Schedule marker',
        value: full(m.at),
        detail: 'Schedule marker',
        x: sx(m.at),
        y: pad.t + (axisY - pad.t) / 2,
        guide: 'x',
        priority: 2,
        hit: { x: sx(m.at) - 22, y: pad.t, w: 44, h: axisY - pad.t }
      });
    });

    out += line(pad.l, crisp(axisY), w - pad.r, crisp(axisY), 'ch-zero');
    out += '</svg>';

    return {
      svg: out,
      inspect: inspection(w, h, pad, markItems.concat(rowItems)),
      summary: spec.summary || rows.map(function (r) {
        return r.label + ' from ' + full(r.from) + ' to ' + full(r.to);
      }).join('; ') + '.',
      table: {
        head: ['Window', 'From', 'To', 'Span'],
        rows: rows.map(function (r) {
          return [r.label, full(r.from), full(r.to), full(Math.abs(r.to - r.from))];
        })
      }
    };
  };

  /* ── export ────────────────────────────────────────────────────── */

  /* A spreadsheet needs the numbers a chart was drawn from, not the strings
     it was labelled with. The `table` each renderer returns is formatted for
     reading — "1.2M" and "12,000.00" — and neither plots nor sums. This
     walks the same specs the renderers walk and hands back raw values, plus
     the Excel chart type that carries each kind without flattering it.

     `chart: null` is a real answer, not a gap. A gauge reads one value
     against threshold bands and a probability–impact grid reads a cell
     position; drawing either as a bar chart would silently convert a
     threshold reading into a magnitude comparison, which is the kind of
     wrong that survives review because it looks like a chart. Those kinds
     export their data and state why there is no plot. */

  /* Excel redraws every point, so a 2,000-point curve costs the reader
     2,000 rows to scroll past for a line they cannot tell from a 60-point
     one. Sample, but never drop the last point — a curve that stops short
     of its final x reads as a shorter project, not a sampled one. */
  function sampled(points, cap) {
    var stride = Math.max(1, Math.ceil(points.length / cap));
    var out = [], i;
    for (i = 0; i < points.length; i += stride) out.push(points[i]);
    if (points.length && out[out.length - 1] !== points[points.length - 1]) {
      out.push(points[points.length - 1]);
    }
    return out;
  }

  function sharesX(series) {
    var base = series[0].points, i, j;
    for (i = 1; i < series.length; i++) {
      if (series[i].points.length !== base.length) return false;
      for (j = 0; j < base.length; j++) {
        if (series[i].points[j][0] !== base[j][0]) return false;
      }
    }
    return true;
  }

  function num(x) { return typeof x === 'number' && isFinite(x) ? x : null; }

  /* Returns:
       { chart, reason, xTitle, yTitle, head, rows, chartRows, catCol,
         seriesCols, noFillCols, xCols }
     `chartRows` is how many leading rows the plot covers — trailing rows
     (a standard deviation, a band, a note) belong in the table but not in
     the series. */
  function exportData(kind, spec) {
    var head, rows, i;

    if (kind === 'bars') {
      var bs = (spec.series || []).filter(function (s) { return isFinite(s.value); });
      if (!bs.length) return null;
      head = [spec.catHead || 'Measure', spec.valHead || 'Value'];
      rows = bs.map(function (s) {
        return [s.label + (s.sub ? ' (' + s.sub + ')' : ''), num(s.value)];
      });
      /* The reference is a line on the desk and a column here. Same
         comparison, and Excel has no cheap way to draw the line. */
      if (isFinite(spec.refValue)) {
        rows.push([(spec.refLabel || 'Reference') + ' (reference)', num(spec.refValue)]);
      }
      return {
        chart: 'col', head: head, rows: rows, chartRows: rows.length,
        catCol: 0, seriesCols: [1], xTitle: '', yTitle: spec.valHead || ''
      };
    }

    if (kind === 'curve') {
      var cs = (spec.series || []).filter(function (s) { return s.points && s.points.length > 1; });
      if (!cs.length) return null;
      var xLabel = spec.xLabel || 'x';

      if (sharesX(cs)) {
        var keep = [], stride = Math.max(1, Math.ceil(cs[0].points.length / 60));
        for (i = 0; i < cs[0].points.length; i += stride) keep.push(i);
        if (keep[keep.length - 1] !== cs[0].points.length - 1) keep.push(cs[0].points.length - 1);
        head = [xLabel].concat(cs.map(function (s) { return s.label; }));
        rows = keep.map(function (idx) {
          var row = [num(cs[0].points[idx][0])];
          for (var s = 0; s < cs.length; s++) {
            row.push(cs[s].points[idx] ? num(cs[s].points[idx][1]) : null);
          }
          return row;
        });
        return {
          chart: 'scatter', head: head, rows: rows, chartRows: rows.length,
          catCol: 0,
          seriesCols: cs.map(function (s, n) { return n + 1; }),
          dashes: cs.map(function (s) { return s.style === 'dashed' ? 'dash' : null; }),
          xTitle: xLabel, yTitle: spec.yLabel || ''
        };
      }

      /* Series on different x grids get their own pair of columns — a flat
         baseline spanning two points must not be resampled onto a curve's
         grid, which is exactly how it would end up two units long. */
      var cols = [], longest = 0;
      head = [];
      var seriesCols = [], xCols = [], dashes = [];
      for (i = 0; i < cs.length; i++) {
        var p = sampled(cs[i].points, 60);
        head.push(xLabel + ' — ' + cs[i].label, cs[i].label);
        cols.push(p.map(function (pt) { return num(pt[0]); }));
        cols.push(p.map(function (pt) { return num(pt[1]); }));
        xCols.push(i * 2);
        seriesCols.push(i * 2 + 1);
        dashes.push(cs[i].style === 'dashed' ? 'dash' : null);
        if (p.length > longest) longest = p.length;
      }
      rows = [];
      for (i = 0; i < longest; i++) {
        rows.push(cols.map(function (c) { return i < c.length ? c[i] : null; }));
      }
      return {
        chart: 'scatter', head: head, rows: rows, chartRows: rows.length,
        catCol: 0, seriesCols: seriesCols, xCols: xCols, dashes: dashes,
        xTitle: xLabel, yTitle: spec.yLabel || ''
      };
    }

    if (kind === 'distribution') {
      if (!isFinite(spec.o) || !isFinite(spec.m) || !isFinite(spec.p) || !isFinite(spec.e)) return null;
      head = ['Point', 'Value'];
      rows = [
        ['Optimistic (O)', num(spec.o)],
        ['Most likely (M)', num(spec.m)],
        ['Pessimistic (P)', num(spec.p)],
        ['PERT estimate (E)', num(spec.e)]
      ];
      var chartRows = rows.length;
      if (isFinite(spec.sd)) {
        rows.push(['Standard deviation (sigma)', num(spec.sd)]);
        rows.push(['68% range — low', num(spec.e - spec.sd)]);
        rows.push(['68% range — high', num(spec.e + spec.sd)]);
      }
      return {
        chart: 'col', head: head, rows: rows, chartRows: chartRows,
        catCol: 0, seriesCols: [1], xTitle: '', yTitle: ''
      };
    }

    if (kind === 'rangeplot') {
      var marks = (spec.marks || []).filter(function (m) { return isFinite(m.at); });
      var bands = (spec.bands || []).filter(function (b) { return isFinite(b.from) && isFinite(b.to); });
      if (!marks.length && !bands.length) return null;
      head = ['Point', 'Value'];
      rows = marks.map(function (m) { return [m.label, num(m.at)]; });
      var markCount = rows.length;
      bands.forEach(function (b) {
        rows.push([(b.label || 'Band') + ' — from', num(b.from)]);
        rows.push([(b.label || 'Band') + ' — to', num(b.to)]);
      });
      return {
        chart: markCount ? 'col' : null,
        reason: markCount ? '' : 'This plot is a range with no marked points.',
        head: head, rows: rows, chartRows: markCount,
        catCol: 0, seriesCols: [1], xTitle: '', yTitle: ''
      };
    }

    if (kind === 'quadrant') {
      if (!isFinite(spec.x) || !isFinite(spec.y)) return null;
      var rx = isFinite(spec.refX) ? spec.refX : 1;
      var ry = isFinite(spec.refY) ? spec.refY : 1;
      head = ['Axis', 'Reading', 'Reference'];
      rows = [
        [spec.xLabel || 'x', num(spec.x), num(rx)],
        [spec.yLabel || 'y', num(spec.y), num(ry)]
      ];
      /* Two clustered columns rather than a scatter: a single plotted point
         against crossed reference lines is a picture Excel cannot draw, and
         reading against reference is the whole point of the quadrant. */
      return {
        chart: 'col', head: head, rows: rows, chartRows: rows.length,
        catCol: 0, seriesCols: [1, 2], xTitle: '', yTitle: ''
      };
    }

    if (kind === 'windows') {
      var ws = (spec.rows || []).filter(function (r) { return isFinite(r.from) && isFinite(r.to); });
      if (!ws.length) return null;
      head = ['Window', 'Start', 'Span', 'Finish'];
      rows = ws.map(function (r) {
        return [r.label, num(r.from), num(Math.abs(r.to - r.from)), num(r.to)];
      });
      var winRows = rows.length;
      (spec.marks || []).forEach(function (m) {
        if (isFinite(m.at)) rows.push([m.label || 'Mark', num(m.at), null, null]);
      });
      /* A stacked bar with an invisible first segment is the float diagram:
         the offset holds the bar away from zero, the span is the window.
         It only works while the offsets are positive. */
      var negative = ws.some(function (r) { return r.from < 0; });
      return {
        chart: 'stacked', head: head, rows: rows, chartRows: winRows,
        catCol: 0,
        seriesCols: negative ? [1, 3] : [1, 2],
        noFillCols: negative ? [] : [1],
        stackedFallback: negative,
        xTitle: '', yTitle: 'Time'
      };
    }

    if (kind === 'meter') {
      var zones = (spec.zones || []).filter(function (z) { return isFinite(z.from) && isFinite(z.to); });
      head = ['Band', 'From', 'To'];
      rows = zones.map(function (z) { return [z.label || 'Band', num(z.from), num(z.to)]; });
      rows.push([(spec.label || 'Reading') + ' (this reading)', num(spec.value), null]);
      return {
        chart: null,
        reason: 'A gauge reads one value against threshold bands. Drawn as a bar ' +
          'chart it would read as a magnitude comparison instead, so the bands ' +
          'and the reading are given as figures.',
        head: head, rows: rows, chartRows: 0
      };
    }

    if (kind === 'matrix') {
      if (!isFinite(spec.p) || !isFinite(spec.i)) return null;
      var score = spec.p * spec.i;
      head = ['Probability', 'Impact', 'Score', 'Band'];
      rows = [[num(spec.p), num(spec.i), num(score),
        score >= 15 ? 'High' : score >= 8 ? 'Moderate' : 'Low']];
      return {
        chart: null,
        reason: 'This plot is a position on a probability–impact grid, not a ' +
          'quantity. The coordinates and the resulting band are given as figures.',
        head: head, rows: rows, chartRows: 0
      };
    }

    return null;
  }

  return {
    renderers: R,
    esc: esc,
    short: short,
    full: full,
    trim: trim,
    ticks: ticks,
    exportData: exportData
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PM_CHARTS;
