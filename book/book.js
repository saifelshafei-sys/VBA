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
  // P is where the page's top-right corner has been pulled to: (W, 0) is flat,
  // (-W, 0) is fully turned over the spine.
  var SVGNS = 'http://www.w3.org/2000/svg';
  var overlay = document.createElementNS(SVGNS, 'svg');
  overlay.setAttribute('class', 'curl');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML =
    '<defs>' +
    '<linearGradient id="curl-back" gradientUnits="userSpaceOnUse">' +
    '<stop offset="0" stop-color="#5a3a62"/><stop offset="0.12" stop-color="#3e2245"/>' +
    '<stop offset="0.6" stop-color="#2b1430"/><stop offset="1" stop-color="#1f0d23"/></linearGradient>' +
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

  // Keep the side of the polygon where keep(pt) is true (Sutherland–Hodgman, one edge).
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

  function draw(page, P, s) {
    var W = s.W, H = s.H;
    var dx = P[0] - W, dy = P[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) { clearCurl(page); return; }
    var nx = dx / len, ny = dy / len;
    var mx = (W + P[0]) / 2, my = P[1] / 2;
    var side = function (p) { return (p[0] - mx) * nx + (p[1] - my) * ny; };
    var rect = [[0, 0], [W, 0], [W, H], [0, H]];
    var visible = clip(rect, side);
    var flap = clip(rect, function (p) { return -side(p); });
    page.style.clipPath = visible.length ? 'polygon(' + visible.map(function (p) { return p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(',') + ')' : 'polygon(0 0, 0 0, 0 0)';
    var back = flap.map(function (p) {
      var k = 2 * side(p);
      return [p[0] - k * nx, p[1] - k * ny];
    });
    backPoly.setAttribute('points', pts(back));
    shadePoly.setAttribute('points', pts(flap));
    var L = Math.min(len, W) * 0.9;
    gBack.setAttribute('x1', mx); gBack.setAttribute('y1', my);
    gBack.setAttribute('x2', mx + nx * L); gBack.setAttribute('y2', my + ny * L);
    gShade.setAttribute('x1', mx); gShade.setAttribute('y1', my);
    gShade.setAttribute('x2', mx - nx * W * 0.35); gShade.setAttribute('y2', my - ny * W * 0.35);
    overlay.style.display = 'block';
  }
  function clearCurl(page) {
    if (page) page.style.clipPath = '';
    overlay.style.display = 'none';
  }

  // The corner can't be pulled farther from the spine than the page is wide.
  function limit(P, s) {
    var d = Math.sqrt(P[0] * P[0] + P[1] * P[1]);
    if (d > s.W) { P = [P[0] * s.W / d, P[1] * s.W / d]; }
    return [P[0], Math.max(0, P[1])];
  }

  function animate(page, from, to, s, done) {
    var dist = Math.abs(to[0] - from[0]) / (2 * s.W);
    var dur = 250 + 650 * dist;
    var t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var lift = Math.sin(Math.PI * e) * s.H * 0.32 * dist;
      var P = limit([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e + lift], s);
      draw(page, P, s);
      if (k < 1) requestAnimationFrame(frame); else done();
    }
    requestAnimationFrame(frame);
  }

  function leaveChapter(forward) {
    var url = body.getAttribute(forward ? 'data-next' : 'data-prev');
    if (url) location.href = forward ? url : url + '#end';
  }

  function settle(page, under, keepUnder) {
    clearCurl(page);
    page.classList.remove('current', 'turning', 'under');
    under.classList.remove('current', 'turning', 'under');
    (keepUnder ? under : page).classList.add('current');
    cur = pages.indexOf(keepUnder ? under : page);
    busy = false;
    remember();
  }

  // Start a turn: forward folds the current page away, backward unfolds the previous page over it.
  function begin(forward) {
    var n = forward ? cur + 1 : cur - 1;
    if (n < 0 || n >= pages.length) return null;
    var s = size();
    var top = forward ? pages[cur] : pages[n];
    var under = forward ? pages[n] : pages[cur];
    top.classList.add('turning');
    under.classList.add('under');
    if (!forward) draw(top, [-s.W, 0], s);
    return { forward: forward, top: top, under: under, s: s };
  }

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
    var t = begin(forward);
    var W = t.s.W;
    if (forward) {
      animate(t.top, [W, 0], [-W, 0], t.s, function () { settle(t.top, t.under, true); });
    } else {
      animate(t.top, [-W, 0], [W, 0], t.s, function () { settle(t.top, t.under, false); });
    }
  }

  // Drag a page: the corner follows your finger. Tap: right side forward, left side back.
  var drag = null, dragged = false;
  reader.addEventListener('pointerdown', function (e) {
    if (busy || e.button > 0 || e.target.closest('a, button')) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId, turn: null };
    dragged = false;
  });
  reader.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.turn) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      if (reduced) return;
      drag.turn = begin(dx < 0);
      if (!drag.turn) { drag = null; return; }
      busy = true;
      dragged = true;
      try { reader.setPointerCapture(e.pointerId); } catch (err) { /* not needed */ }
    }
    var s = drag.turn.s, P;
    if (drag.turn.forward) {
      P = [s.W + dx * 1.6, Math.max(0, dy) * 0.6 + (-dx) * 0.08];
    } else {
      P = [-s.W + dx * 2.2, Math.max(0, dy) * 0.6 + Math.max(0, s.W - dx) * 0.04];
    }
    drag.P = limit(P, s);
    draw(drag.turn.top, drag.P, s);
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var t = drag.turn, P = drag.P;
    drag = null;
    if (!t || !P) return;
    var W = t.s.W;
    var complete = t.forward ? P[0] < W * 0.55 : P[0] > -W * 0.45;
    var target = (t.forward === complete) ? [-W, 0] : [W, 0];
    animate(t.top, P, target, t.s, function () {
      // forward+complete or backward+cancelled: the under page wins
      settle(t.top, t.under, t.forward === complete);
    });
  }
  reader.addEventListener('pointerup', endDrag);
  reader.addEventListener('pointercancel', endDrag);

  reader.addEventListener('click', function (e) {
    if (dragged) { dragged = false; return; }
    var link = e.target.closest('a, button');
    if (link) {
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) === '#' && href.length > 1) {
        var target = document.getElementById(href.slice(1));
        e.preventDefault();
        if (target) pages.forEach(function (p, i) { if (p.contains(target)) go(i); });
      }
      return;
    }
    if (window.getSelection && String(window.getSelection()).length) return;
    var s = size();
    go(e.clientX - s.left > s.W * 0.35 ? cur + 1 : cur - 1);
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
      hint.textContent = 'Tap the right side or swipe to turn the page';
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
