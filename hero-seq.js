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

    var COUNT = 29;                 /* 1–9 зум к зубу, 10–12 свет,
                                       13–29 съёмка клиники одним дублём:
                                       вывеска → двери → тамбур → ресепшн →
                                       коридор → кабинет. Кадры идут подряд из
                                       одной записи, поэтому проход читается
                                       слитно, без скачков между сценами. */
    var BASE = "hero-seq/";
    var steps = Array.prototype.slice.call(section.querySelectorAll(".reveal-seq__step"));
    var offers = Array.prototype.slice.call(section.querySelectorAll(".seq-offer"));

    /* Первые проценты прокрутки кадр идёт чистым — сцена успевает
       «прочитаться», и только потом выходит визитка клиники.
       Дальше подписи-ценности, после STEP_END кадр уходит в свет. */
    var STEP_START = 0.05, STEP_END = 0.40;
    /* Предложения выезжают на ресепшене — это кадры 13–15, то есть
       прогресс 0.63…0.74. Раньше ресепшн был финалом секции и последняя
       карточка оставалась висеть; теперь за ним идёт кабинет, поэтому
       все три уезжают до его начала. */
    var OFFER_START = 0.58, OFFER_AT = [0.625, 0.680, 0.735], OFFER_HALF = 0.05;
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
          /* Сброс lastP обязателен: первый render() отрабатывает ещё до
             загрузки картинок и запоминает прогресс, из-за чего повторный
             вызов считает, что перерисовывать нечего, и кадр не появляется. */
          lastP = -1;
          if (idx === 0) {
            /* canvas показываем только с готовым кадром, иначе фолбэк
               спрячется раньше времени и мелькнёт пустой экран */
            setup(); render(); section.classList.add("is-ready");
          } else { schedule(); }
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
      ready = true;
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
    /* Кадры зума в начале почти одинаковы, поэтому линейный прогресс
       ощущается вязким. Степень < 1 «разгоняет» начало и оставляет
       больше хода на финал — ресепшн и карточки акций. */
    var EASE = 0.68;
    function progress() {
      var r = section.getBoundingClientRect();
      var total = Math.max(r.height - window.innerHeight, 1);
      var p = Math.min(Math.max(-r.top / total, 0), 1);
      return Math.pow(p, EASE);
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
        /* равные доли на каждую подпись; после STEP_END они гаснут —
           дальше идёт свет и ресепшн с карточками предложений */
        var active = (p < STEP_START || p >= STEP_END) ? -1
          : Math.min(steps.length - 1,
              Math.floor(((p - STEP_START) / (STEP_END - STEP_START)) * steps.length));
        for (var k = 0; k < steps.length; k++) {
          steps[k].classList.toggle("is-active", k === active);
        }
      }
      updateOffers(p);
    }

    /* Карточки предложений проезжают справа налево, сменяя друг друга,
       и уходят перед тем, как начнётся кабинет. */
    function updateOffers(p) {
      if (!offers.length) return;
      for (var i = 0; i < offers.length; i++) {
        var d = (OFFER_AT[i] - p) / OFFER_HALF;       /* >0 — ещё справа, <0 — уехала влево */
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
