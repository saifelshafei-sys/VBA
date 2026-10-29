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
