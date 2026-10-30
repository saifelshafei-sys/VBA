// Second Home — page-turning reader.
// Lays the chapter out into screen-sized pages and turns them with a tap, swipe or arrow key.
// Without JS the chapter stays a normal scrolling page.
(function () {
  var body = document.body;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Blocks that always take a whole page to themselves
  var FULL = 'header.chapter-head, section.scene, section.ending, .phone, section.coldopen, main.cover';

  var blocks = [];
  Array.prototype.slice.call(body.children).forEach(function (el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'svg') return;
    if (tag === 'article') {
      Array.prototype.slice.call(el.children).forEach(function (c) { blocks.push({ el: c, text: true }); });
      el.remove();
    } else {
      blocks.push({ el: el, full: el.matches(FULL) });
    }
  });

  var reader = document.createElement('div');
  reader.className = 'reader';
  reader.setAttribute('aria-live', 'polite');
  body.insertBefore(reader, body.querySelector('script'));
  body.classList.add('paged');

  document.querySelectorAll('[data-paged-label]').forEach(function (el) {
    el.textContent = el.getAttribute('data-paged-label');
  });

  var pages = [];
  var cur = 0;
  var busy = false;
  var chapterName = (document.title.split('—')[0] || '').trim();

  function newPage() {
    var page = document.createElement('div');
    page.className = 'page';
    var inner = document.createElement('div');
    inner.className = 'page-inner';
    var folio = document.createElement('div');
    folio.className = 'folio';
    page.appendChild(inner);
    page.appendChild(folio);
    reader.appendChild(page);
    pages.push(page);
    page._count = 0;
    return page;
  }

  function paginate() {
    var anchor = pages[cur] && pages[cur]._first;
    pages.forEach(function (p) { p.remove(); });
    pages = [];
    reader.classList.add('measuring');

    var page = null, art = null;
    blocks.forEach(function (b) {
      if (b.full) {
        var fp = newPage();
        fp.classList.add('full');
        if (b.el.matches('section.ending, section.coldopen, main.cover')) fp.classList.add('dark');
        fp.firstChild.appendChild(b.el);
        fp._first = b.el;
        page = null;
        return;
      }
      for (var attempt = 0; attempt < 2; attempt++) {
        if (!page) { page = newPage(); art = null; }
        var inner = page.firstChild;
        var target = inner;
        if (b.text) {
          if (!art) { art = document.createElement('article'); inner.appendChild(art); }
          target = art;
        } else {
          art = null;
        }
        target.appendChild(b.el);
        // Doesn't fit and the page already has something on it: start a fresh page.
        if (inner.scrollHeight > inner.clientHeight + 1 && page._count > 0) {
          b.el.remove();
          if (art && !art.children.length) { art.remove(); }
          page = null;
          continue;
        }
        if (!page._count) page._first = b.el;
        page._count++;
        break;
      }
    });

    reader.classList.remove('measuring');
    pages.forEach(function (p, i) {
      p.lastChild.textContent = p.classList.contains('full') ? '' : chapterName + '  ·  ' + (i + 1) + ' / ' + pages.length;
    });

    var at = 0;
    if (anchor) pages.forEach(function (p, i) { if (p.contains(anchor)) at = i; });
    cur = at;
    pages[cur].classList.add('current');
  }

  function remember() {
    try { history.replaceState(null, '', '#p' + (cur + 1)); } catch (e) { /* hash is a convenience only */ }
  }

  // ---- Page curl ----
  // The turning page is clipped along a fold line, and the folded-over flap
  // (the back of the paper) is drawn in an SVG overlay, reflected across that line.
  // P is where the grabbed corner has been pulled to. For the top corner, (W, 0) is
  // flat and (-W, 0) is fully turned over the spine; the bottom corner mirrors it.
  var SVGNS = 'http://www.w3.org/2000/svg';
  var overlay = document.createElementNS(SVGNS, 'svg');
  overlay.setAttribute('class', 'curl');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML =
    '<defs>' +
    '<linearGradient id="curl-back" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#d9ccb2"/><stop offset="0.12" stop-color="#fbf5e8"/>' +
    '<stop offset="0.6" stop-color="#efe4cd"/><stop offset="1" stop-color="#dccdb0"/></linearGradient>' +
    '<linearGradient id="curl-shade" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#000" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>' +
    '</defs>' +
    '<polygon class="curl-shade" fill="url(#curl-shade)"/>' +
    '<polygon class="curl-back" fill="url(#curl-back)"/>';
  reader.appendChild(overlay);
  var shadePoly = overlay.querySelector('.curl-shade');
  var backPoly = overlay.querySelector('.curl-back');
  var gBack = overlay.querySelector('#curl-back');
  var gShade = overlay.querySelector('#curl-shade');

  function size() {
    var r = pages[cur].getBoundingClientRect();
    return { W: r.width, H: r.height, left: r.left, top: r.top };
  }

  // Keep the side of the polygon where f(pt) >= 0 (Sutherland–Hodgman, one edge).
  function clip(poly, f) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) {
        var t = fa / (fa - fb);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  }
  function pts(poly) { return poly.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }

  // bottom: the grabbed corner is the bottom-right one; the maths runs flipped upside down.
  function draw(page, P, s, bottom) {
    var W = s.W, H = s.H;
    var fy = function (p) { return bottom ? [p[0], H - p[1]] : p; };
    var Q = fy(P);
    var dx = Q[0] - W, dy = Q[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) { clearCurl(page); return; }
    var nx = dx / len, ny = dy / len;
    var mx = (W + Q[0]) / 2, my = Q[1] / 2;
    var side = function (p) { return (p[0] - mx) * nx + (p[1] - my) * ny; };
    var rect = [[0, 0], [W, 0], [W, H], [0, H]];
    var visible = clip(rect, side).map(fy);
    var flapF = clip(rect, function (p) { return -side(p); });
    var back = flapF.map(function (p) {
      var k = 2 * side(p);
      return fy([p[0] - k * nx, p[1] - k * ny]);
    });
    var flap = flapF.map(fy);
    page.style.clipPath = visible.length ? 'polygon(' + visible.map(function (p) { return p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(',') + ')' : 'polygon(0 0, 0 0, 0 0)';
    backPoly.setAttribute('points', pts(back));
    shadePoly.setAttribute('points', pts(flap));
    var L = Math.min(len, W) * 0.9;
    var m = fy([mx, my]), a = fy([mx + nx * L, my + ny * L]), b = fy([mx - nx * W * 0.35, my - ny * W * 0.35]);
    gBack.setAttribute('x1', m[0]); gBack.setAttribute('y1', m[1]);
    gBack.setAttribute('x2', a[0]); gBack.setAttribute('y2', a[1]);
    gShade.setAttribute('x1', m[0]); gShade.setAttribute('y1', m[1]);
    gShade.setAttribute('x2', b[0]); gShade.setAttribute('y2', b[1]);
    overlay.style.display = 'block';
  }
  function clearCurl(page) {
    if (page) page.style.clipPath = '';
    overlay.style.display = 'none';
  }

  // Paper can't stretch: the corner stays within one page-width of its end of the spine,
  // and can't be pulled past its own edge of the page.
  function limit(P, s, bottom) {
    var x = P[0], y = bottom ? s.H - P[1] : P[1];
    y = Math.max(0, y);
    var d = Math.sqrt(x * x + y * y);
    if (d > s.W) { x = x * s.W / d; y = y * s.W / d; }
    return [x, bottom ? s.H - y : y];
  }

  function animate(t, from, to, done) {
    var s = t.s;
    var dist = Math.abs(to[0] - from[0]) / (2 * s.W);
    var dur = 180 + 520 * dist;
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      var lift = Math.sin(Math.PI * e) * s.H * 0.18 * dist * (t.bottom ? -1 : 1);
      var P = limit([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + lift], s, t.bottom);
      draw(t.top, P, s, t.bottom);
      if (k < 1) requestAnimationFrame(frame); else done();
    }
    requestAnimationFrame(frame);
  }

  function leaveChapter(forward) {
    var url = body.getAttribute(forward ? 'data-next' : 'data-prev');
    if (url) location.href = forward ? url : url + '#end';
  }

  function settle(t, underWins) {
    clearCurl(t.top);
    t.top.classList.remove('current', 'turning', 'under');
    t.under.classList.remove('current', 'turning', 'under');
    var now = underWins ? t.under : t.top;
    now.classList.add('current');
    cur = pages.indexOf(now);
    busy = false;
    remember();
  }

  // Start a turn: forward folds the current page away, backward brings the previous page back over it.
  function begin(forward, bottom) {
    var n = forward ? cur + 1 : cur - 1;
    if (n < 0 || n >= pages.length) return null;
    var s = size();
    var t = { forward: forward, bottom: bottom, s: s,
      top: forward ? pages[cur] : pages[n],
      under: forward ? pages[n] : pages[cur] };
    t.flat = [s.W, bottom ? s.H : 0];
    t.turned = [-s.W, bottom ? s.H : 0];
    t.top.classList.add('turning');
    t.under.classList.add('under');
    if (!forward) draw(t.top, t.turned, s, bottom);
    return t;
  }

  // Keyboard (and links): turn a whole page from the top corner.
  function go(n) {
    if (busy || n === cur) return;
    if (n < 0 || n >= pages.length) { leaveChapter(n >= pages.length); return; }
    var forward = n > cur;
    if (reduced) {
      pages[cur].classList.remove('current');
      pages[n].classList.add('current');
      cur = n;
      remember();
      return;
    }
    busy = true;
    var t = begin(forward, false);
    if (forward) animate(t, t.flat, t.turned, function () { settle(t, true); });
    else animate(t, t.turned, t.flat, function () { settle(t, false); });
  }

  // ---- Turning by hand ----
  // Grab the page and drag: the corner nearest your finger comes away with it
  // and settles under your fingertip as you pull. Let go past halfway, or flick,
  // and the page finishes turning; let go early and it falls back.
  var drag = null;
  function local(e) {
    var r = reader.querySelector('.page.current, .page.turning').getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  reader.addEventListener('pointerdown', function (e) {
    if (busy || e.button > 0 || e.target.closest('a, button')) return;
    drag = { id: e.pointerId, start: local(e), turn: null, hist: [] };
  });
  reader.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var f = local(e);
    var dx = f[0] - drag.start[0], dy = f[1] - drag.start[1];
    drag.hist.push([e.timeStamp, f[0]]);
    if (drag.hist.length > 6) drag.hist.shift();
    if (!drag.turn) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy) * 0.8) return;
      var forward = dx < 0;
      var s = size();
      if (forward ? cur >= pages.length - 1 : cur <= 0) {
        drag = null;
        leaveChapter(forward);
        return;
      }
      if (reduced) { drag = null; go(forward ? cur + 1 : cur - 1); return; }
      drag.turn = begin(forward, drag.start[1] > s.H * 0.55);
      busy = true;
      drag.from = forward ? drag.turn.flat : drag.turn.turned;
      try { reader.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
    }
    var t = drag.turn, sz = t.s;
    // The corner starts where it is and slides under the finger over the first part of the pull.
    var pull = Math.min(1, Math.abs(dx) / (sz.W * 0.35));
    var ease = pull * pull * (3 - 2 * pull);
    var P = [
      f[0] + (drag.from[0] - drag.start[0]) * (1 - ease),
      f[1] + (drag.from[1] - drag.start[1]) * (1 - ease)
    ];
    drag.dx = dx;
    drag.P = limit(P, sz, t.bottom);
    draw(t.top, drag.P, sz, t.bottom);
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var t = drag.turn, P = drag.P, h = drag.hist, moved = drag.dx || 0;
    drag = null;
    if (!t) return;
    if (!P) { settle(t, !t.forward); return; }
    var W = t.s.W;
    var v = 0;
    if (h.length > 1) {
      var a = h[0], b = h[h.length - 1];
      v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]); // px per ms, negative = leftward
    }
    // Decide by how far the finger travelled (a third of the page) or a flick,
    // not by where the corner ended up: paper held low can't reach far, but the hand did.
    var turnedOver = t.forward ? !(moved > -W * 0.33) : moved < W * 0.33;
    if (v < -0.4) turnedOver = true;
    if (v > 0.4) turnedOver = false;
    animate(t, P, turnedOver ? t.turned : t.flat, function () {
      // When the page ends up turned over, the page beneath it is the one you're reading.
      settle(t, turnedOver);
    });
  }
  reader.addEventListener('pointerup', endDrag);
  reader.addEventListener('pointercancel', endDrag);

  // Links inside pages still work; in-book links (#name) turn to their page.
  reader.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (href.charAt(0) === '#' && href.length > 1) {
      var target = document.getElementById(href.slice(1));
      e.preventDefault();
      if (target) pages.forEach(function (p, i) { if (p.contains(target)) go(i); });
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(cur + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (!busy) paginate(); }, 250);
  });

  function start() {
    paginate();
    var hash = location.hash;
    if (hash === '#end') {
      pages[cur].classList.remove('current');
      cur = pages.length - 1;
      pages[cur].classList.add('current');
    } else if (/^#p\d+$/.test(hash)) {
      var n = Math.min(pages.length, parseInt(hash.slice(2), 10)) - 1;
      pages[cur].classList.remove('current');
      cur = Math.max(0, n);
      pages[cur].classList.add('current');
    }
    remember();
    if (!reduced && cur === 0) {
      var hint = document.createElement('div');
      hint.className = 'turn-hint';
      hint.textContent = 'Drag left to turn the page, right to go back';
      body.appendChild(hint);
      setTimeout(function () { hint.remove(); }, 5200);
    }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start, start);
  } else {
    start();
  }
})();
