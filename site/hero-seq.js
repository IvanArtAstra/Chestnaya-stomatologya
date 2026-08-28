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

    var COUNT = 16;                 /* 1–12 зум к зубу и свет, дальше по одному
                                       кадру на помещение: 13 стойка регистрации,
                                       14 кабинет № 1, 15 кабинет № 2,
                                       16 зона ожидания. */
    /* Кадр помещения держится почти весь свой отрезок и меняется коротким
       кроссфейдом на его конце — иначе четыре снимка «перетекали» бы друг в
       друга непрерывно и ни один не читался бы как самостоятельный. */
    var ROOM_FIRST = 12;            /* индекс первого кадра помещения (0-based) */
    var ROOM_MIX = 0.28;            /* доля отрезка, отведённая на переход */
    var ROOMS = ["room.1", "room.2", "room.3", "room.4"];
    var BASE = "hero-seq/";
    var steps = Array.prototype.slice.call(section.querySelectorAll(".reveal-seq__step"));
    var offers = Array.prototype.slice.call(section.querySelectorAll(".seq-offer"));
    var roomEl = document.getElementById("seqRoom");

    /* Первые проценты прокрутки кадр идёт чистым — сцена успевает
       «прочитаться», и только потом выходит визитка клиники.
       Дальше подписи-ценности, после STEP_END кадр уходит в свет. */
    var STEP_START = 0.05, STEP_END = 0.62;
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
        var t = f - i;
        /* на кадрах помещений держим снимок и смешиваем только в конце */
        if (i >= ROOM_FIRST) t = t < 1 - ROOM_MIX ? 0 : (t - (1 - ROOM_MIX)) / ROOM_MIX;
        var frac = smooth(t);
        ctx.clearRect(0, 0, cw, ch);
        cover(imgs[i], 1);
        if (frac > 0) cover(imgs[i + 1], frac);
      }
      updateSteps(p);
      updateRoom(f);
    }

    /* подпись помещения: показываем, начиная с первого кадра помещения */
    var lastRoom = -2;
    function updateRoom(f) {
      if (!roomEl) return;
      var k = Math.round(f) - ROOM_FIRST;
      if (k < 0 || k >= ROOMS.length) k = -1;
      if (k === lastRoom) return;
      lastRoom = k;
      if (k < 0) { roomEl.hidden = true; return; }
      var dict = (typeof I18N !== "undefined" && I18N[ROOMS[k]]) || null;
      var lang = "ru";
      try { lang = localStorage.getItem("chestom_lang") || "ru"; } catch (e) {}
      roomEl.textContent = dict ? (dict[lang] || dict.ru) : "";
      roomEl.hidden = false;
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

    /* Раньше карточки проезжали по одной вдоль длинного прохода. Теперь на
       клинику приходится четыре кадра-слайда, и на короткий отрезок стойки
       три проезда не помещаются — поэтому показываем их группой, в ряд,
       пока держится кадр стойки регистрации. */
    function updateOffers(p) {
      if (!offers.length) return;
      var a = ROOM_FIRST / (COUNT - 1);              /* начало кадра стойки */
      var b = (ROOM_FIRST + 1) / (COUNT - 1);        /* и его конец */
      var fade = (b - a) * 0.3;
      var vis = 0;
      if (p > a - fade && p < b) {
        vis = Math.min(1, (p - (a - fade)) / fade, (b - p) / fade);
      }
      for (var i = 0; i < offers.length; i++) {
        var x = (i - 1) * 33;                        /* три карточки в ряд */
        offers[i].style.transform =
          "translate(calc(-50% + " + x + "vw), calc(-50% + " + ((1 - vis) * 14).toFixed(1) + "px))";
        offers[i].style.opacity = Math.max(0, vis).toFixed(3);
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
