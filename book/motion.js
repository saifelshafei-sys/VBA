// Second Home — scroll-triggered motion. Content stays readable without this file.
(function () {
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  var targets = document.querySelectorAll('[data-reveal]');

  function show(el) {
    el.classList.add('is-in');
    if (!reduced) typeOut(el);
  }

  // Phone bubbles marked data-type appear letter by letter, one after another.
  function typeOut(el) {
    var bubbles = el.querySelectorAll('[data-type]');
    var delay = 900;
    bubbles.forEach(function (b) {
      var full = b.textContent;
      b.textContent = '';
      b.style.visibility = 'hidden';
      setTimeout(function () {
        b.style.visibility = '';
        var i = 0;
        var timer = setInterval(function () {
          i++;
          b.textContent = full.slice(0, i);
          if (i >= full.length) clearInterval(timer);
        }, 28);
      }, delay);
      delay += full.length * 28 + 700;
    });
  }

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        show(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(function (el) { io.observe(el); });
})();

// Scenes slowly push in and darken as they scroll past (sets --p from 0 to 1).
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var scenes = document.querySelectorAll('[data-scene]');
  if (!scenes.length) return;
  var ticking = false;
  function update() {
    var vh = window.innerHeight;
    scenes.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      s.style.setProperty('--p', p.toFixed(3));
    });
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();

// Marquee: repeat the group so the strip loops without a seam (Magic UI repeats it 4 times).
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('[data-marquee]').forEach(function (m) {
    var group = m.querySelector('.marquee__group');
    for (var i = 0; i < 3; i++) {
      var copy = group.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      m.appendChild(copy);
    }
    m.classList.add('is-running');
  });
})();
