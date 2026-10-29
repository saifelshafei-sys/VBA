// Second Home — page-turning reader.
// Lays the chapter out into screen-sized pages and turns them with a tap, swipe or arrow key.
// Without JS the chapter stays a normal scrolling page.
(function () {
  var body = document.body;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Blocks that always take a whole page to themselves
  var FULL = 'header.chapter-head, section.scene, section.ending, .phone, section.coldopen, main.cover';
  var TURN_MS = 700;

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

  function go(n) {
    if (busy || n === cur) return;
    if (n < 0) {
      var prev = body.getAttribute('data-prev');
      if (prev) location.href = prev + '#end';
      return;
    }
    if (n >= pages.length) {
      var next = body.getAttribute('data-next');
      if (next) location.href = next;
      return;
    }
    var from = pages[cur], to = pages[n], forward = n > cur;
    if (reduced) {
      from.classList.remove('current');
      to.classList.add('current');
      cur = n;
      remember();
      return;
    }
    busy = true;
    if (forward) {
      to.classList.add('under');
      from.classList.add('turn-out');
    } else {
      from.classList.add('under');
      to.classList.add('turn-in');
    }
    setTimeout(function () {
      from.classList.remove('current', 'turn-out', 'under');
      to.classList.remove('under', 'turn-in');
      to.classList.add('current');
      cur = n;
      busy = false;
      remember();
    }, TURN_MS);
  }

  // Tap the right side to go forward, the left side to go back. Links still work.
  var swiped = false;
  reader.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
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
    var rect = reader.getBoundingClientRect();
    go(e.clientX - rect.left > rect.width * 0.35 ? cur + 1 : cur - 1);
  });

  var sx = 0, sy = 0;
  reader.addEventListener('touchstart', function (e) {
    sx = e.changedTouches[0].clientX;
    sy = e.changedTouches[0].clientY;
  }, { passive: true });
  reader.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      swiped = true;
      setTimeout(function () { swiped = false; }, 400);
      go(dx < 0 ? cur + 1 : cur - 1);
    }
  }, { passive: true });

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
