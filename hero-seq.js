/* ═══════════ Секвенция «в наших руках» ═══════════
   Скролл-скраб по 11 фото: непрерывный кроссфейд соседних кадров
   на <canvas> по прогрессу прокрутки sticky-секции. Промежуточные
   «кадры» создаются налету через плавную интерполяцию прозрачности —
   это мягче любого фиксированного набора кадров.
   Прогрессивное улучшение: любой сбой = тихий откат к <img>. */
(function () {
  "use strict";
  try {
    var section = document.querySelector(".reveal-seq");
    var canvas = document.getElementById("seqCanvas");
    if (!section || !canvas) return;

    var COUNT = 15;                 /* 1–9 зум к зубу, 10–12 свет, 13–15 ресепшн */
    var BASE = "hero-seq/";
    var steps = Array.prototype.slice.call(section.querySelectorAll(".reveal-seq__step"));
    var offers = Array.prototype.slice.call(section.querySelectorAll(".seq-offer"));

    /* Подписи держатся на «зумной» части, дальше кадр уходит в свет */
    var STEP_END = 0.56;
    /* Предложения выезжают на ресепшене: центр показа каждого + полуокно */
    var OFFER_START = 0.78, OFFER_AT = [0.845, 0.915, 0.985], OFFER_HALF = 0.075;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var imgs = [], loaded = 0, ready = false;
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (var i = 0; i < COUNT; i++) {
      (function (idx) {
        var im = new Image();
        im.decoding = "async";
        im.onload = function () {
          loaded++;
          if (idx === 0 && !ready) { setup(); render(); } // покажем первый кадр сразу
          if (loaded === COUNT) { section.classList.add("is-ready"); }
        };
        im.onerror = function () { loaded++; };
        im.src = BASE + (idx + 1 < 10 ? "0" : "") + (idx + 1) + ".jpg";
        imgs[idx] = im;
      })(i);
    }

    var cw = 0, ch = 0, dpr = 1;
    function setup() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = canvas.getBoundingClientRect();
      cw = Math.max(1, Math.round(r.width));
      ch = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!ready) { ready = true; section.classList.add("is-ready"); }
    }

    /* cover-отрисовка одного кадра */
    function cover(im, alpha) {
      if (!im || !im.naturalWidth) return;
      var iw = im.naturalWidth, ih = im.naturalHeight;
      var s = Math.max(cw / iw, ch / ih);
      var w = iw * s, h = ih * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
      ctx.globalAlpha = 1;
    }

    function smooth(t) { return t * t * (3 - 2 * t); } // smoothstep

    var lastP = -1;
    function progress() {
      var r = section.getBoundingClientRect();
      var total = Math.max(r.height - window.innerHeight, 1);
      return Math.min(Math.max(-r.top / total, 0), 1);
    }

    function draw(p) {
      if (!cw) setup();
      var f = p * (COUNT - 1);
      var i = Math.floor(f);
      if (i >= COUNT - 1) { i = COUNT - 1; ctx.clearRect(0, 0, cw, ch); cover(imgs[i], 1); }
      else {
        var frac = smooth(f - i);
        ctx.clearRect(0, 0, cw, ch);
        cover(imgs[i], 1);
        if (frac > 0) cover(imgs[i + 1], frac);
      }
      updateSteps(p);
    }

    function updateSteps(p) {
      if (steps.length) {
        /* после STEP_END подписи гаснут — начинается свет и ресепшн */
        var active = p >= STEP_END ? -1
          : p < STEP_END * 0.25 ? 0
          : p < STEP_END * 0.50 ? 1
          : p < STEP_END * 0.75 ? 2 : 3;
        for (var k = 0; k < steps.length; k++) {
          steps[k].classList.toggle("is-active", k === active);
        }
      }
      updateOffers(p);
    }

    /* Карточки предложений проезжают справа налево, сменяя друг друга.
       Последняя доезжает до центра и остаётся — ею заканчивается сегмент. */
    function updateOffers(p) {
      if (!offers.length) return;
      var last = offers.length - 1;
      for (var i = 0; i < offers.length; i++) {
        var d = (OFFER_AT[i] - p) / OFFER_HALF;       /* >0 — ещё справа, <0 — уехала влево */
        if (i === last && d < 0) d = 0;               /* финальная не уезжает */
        var off = Math.max(-1.6, Math.min(1.6, d));
        var vis = p >= OFFER_START ? Math.max(0, 1 - Math.abs(off) * 1.15) : 0;
        offers[i].style.transform =
          "translate(calc(-50% + " + (off * 62).toFixed(2) + "vw), -50%)";
        offers[i].style.opacity = vis.toFixed(3);
      }
    }

    var raf = 0, near = true;
    function render() {
      raf = 0;
      var p = reduce ? 1 : progress();      // reduced-motion → финальный «светящийся» кадр
      if (p !== lastP) { lastP = p; draw(p); }
    }
    function schedule() { if (!raf && near) raf = requestAnimationFrame(render); }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        near = en[0].isIntersecting;
        if (near) schedule();
      }, { rootMargin: "20%" }).observe(section);
    }

    if (!reduce) {
      window.addEventListener("scroll", schedule, { passive: true });
    }
    window.addEventListener("resize", function () { setup(); lastP = -1; schedule(); });

    setup();
    render();
  } catch (e) { /* тихий откат к <img> */ }
})();
