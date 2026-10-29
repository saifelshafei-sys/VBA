// Second Home — moving sketches.
// Each [data-sketch] drawing is pen-drawn line by line when it scrolls into view,
// then gets the class "on" so its glows, colors and buzzes can start.
// Lines "boil" (wobble a few times a second) like hand-drawn animation.
// Without JS, or with reduced motion, the drawings simply appear finished.
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sketches = document.querySelectorAll('[data-sketch]');

  if (reduced || !('IntersectionObserver' in window)) {
    sketches.forEach(function (s) { s.classList.add('on'); });
    return;
  }

  function prepare(sketch) {
    var paths = sketch.querySelectorAll('.ink:not(.static)');
    paths.forEach(function (p) {
      var len = Math.ceil(p.getTotalLength()) + 1;
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
    });
    return paths;
  }

  function draw(sketch, paths) {
    var speed = parseFloat(sketch.getAttribute('data-speed') || '1');
    var t = 150;
    paths.forEach(function (p) {
      var len = parseFloat(p.style.strokeDasharray);
      var dur = Math.min(800, 180 + len * 1.2) / speed;
      p.style.transition = 'stroke-dashoffset ' + dur + 'ms ease-in-out ' + t + 'ms';
      p.style.strokeDashoffset = 0;
      t += dur * 0.4;
    });
    setTimeout(function () { sketch.classList.add('on'); }, t + 250);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      draw(entry.target, entry.target._paths);
    });
  }, { threshold: 0.35 });

  sketches.forEach(function (s) {
    s._paths = prepare(s);
    io.observe(s);
  });

  // Boil: swap the wobble pattern 8 times a second.
  var turb = document.querySelectorAll('[data-boil]');
  var seed = 1;
  if (turb.length) {
    setInterval(function () {
      seed = seed % 4 + 1;
      turb.forEach(function (t) { t.setAttribute('seed', seed); });
    }, 125);
  }
})();
