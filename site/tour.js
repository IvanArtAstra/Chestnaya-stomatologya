/* ═══════════ Прогулка по клинике ═══════════
   Листание на scroll-snap: браузер сам доводит слайд до края, поэтому
   инерция на телефоне родная. Скрипту остаётся только стрелки, точки
   и подсветка активного слайда. */
(function () {
  "use strict";
  try {
    var track = document.getElementById("tourTrack");
    var dotsBox = document.getElementById("tourDots");
    if (!track || !dotsBox) return;

    var slides = Array.prototype.slice.call(track.querySelectorAll(".tour__slide"));
    if (!slides.length) return;

    var dots = slides.map(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tour__dot";
      b.setAttribute("role", "tab");
      var cap = s.querySelector("figcaption b");
      b.setAttribute("aria-label", cap ? cap.textContent : "Слайд " + (i + 1));
      b.addEventListener("click", function () { go(i); });
      dotsBox.appendChild(b);
      return b;
    });

    var cur = 0;
    function go(i) {
      i = Math.min(Math.max(i, 0), slides.length - 1);
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft,
                       behavior: reduce ? "auto" : "smooth" });
    }
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    function sync() {
      /* активный — тот слайд, чей левый край ближе всего к левому краю ленты */
      var best = 0, min = Infinity;
      for (var i = 0; i < slides.length; i++) {
        var d = Math.abs(slides[i].offsetLeft - track.offsetLeft - track.scrollLeft);
        if (d < min) { min = d; best = i; }
      }
      if (best === cur) return;
      cur = best;
      for (var k = 0; k < dots.length; k++) {
        dots[k].classList.toggle("is-on", k === cur);
        dots[k].setAttribute("aria-selected", String(k === cur));
      }
      prev.disabled = cur === 0;
      next.disabled = cur === slides.length - 1;
    }

    var prev = document.getElementById("tourPrev");
    var next = document.getElementById("tourNext");
    prev.addEventListener("click", function () { go(cur - 1); });
    next.addEventListener("click", function () { go(cur + 1); });

    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); go(cur - 1); }
    });

    var raf = 0;
    track.addEventListener("scroll", function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; sync(); });
    }, { passive: true });
    window.addEventListener("resize", sync);

    cur = -1; sync();
  } catch (e) { /* без скрипта лента всё равно листается пальцем */ }
})();
