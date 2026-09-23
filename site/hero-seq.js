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

    var COUNT = 17;                 /* 1–11 зуб в ладонях и уход в свет,
                                       12 рецепция, 13 кабинет № 2, 14–15 кабинет № 1,
                                       16 рабочая зона, 17 кабинет с креслом.
                                       Финальный кадр «возвращение к стойке» был
                                       побайтово тем же файлом, что и 12-й, —
                                       на экране это выглядело как застывший
                                       скролл. Убран. Все кадры настоящие. */
    var ROOM_MIX = 0.42;            /* доля отрезка комнаты, отданная под смену */
    /* Подпись показываем только на самих помещениях, не на проходах и не на
       зубе: ключ — индекс кадра (0-based) */
    /* Подпись помещения — по индексу кадра (0-based); на кадрах с зубом
       и на повторах подписи нет. */
    var ROOMS = { 11: "room.1", 12: "room.3", 13: "room.2", 14: "room.2",
                  15: "room.5", 16: "room.2" };
    /* Полный набор кадров весит 3,4 МБ — на мобильном трафике это дорого
       и ничего не даёт: на телефоне холст шириной 375 pt даже при
       плотности 3 просит меньше, чем 1024 px. Для узких экранов лежит
       облегчённый набор на 0,8 МБ. Ширину берём один раз при загрузке:
       менять набор посреди прокрутки — значит заново тянуть все кадры. */
    /* Ширина может быть нулём (скрытая вкладка, фрейм нулевого размера) —
       тогда берём полный набор: лишний трафик лучше мыльной картинки. */
    var vw = document.documentElement.clientWidth || window.innerWidth ||
             (window.screen && screen.width) || 0;
    var narrow = vw > 0 && vw <= 820;
    var BASE = "hero-seq/" + (narrow ? "m/" : "");
    /* Кадры менялись, а имена файлов оставались прежними — браузер отдавал
       старые картинки из кэша. Версия в запросе это снимает. */
    var VER = "?v=20260923e";
    var steps = Array.prototype.slice.call(section.querySelectorAll(".reveal-seq__step"));
    var roomEl = document.getElementById("seqRoom");

    /* Подписи привязаны к кадрам, а не к равным долям прокрутки: иначе текст
       про стерилизацию оказывался не на автоклаве, а где придётся.
       Диапазон кадров задан в разметке через data-from / data-to. */
    var stepRange = steps.map(function (el) {
      return [parseFloat(el.dataset.from), parseFloat(el.dataset.to)];
    });
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
        im.src = BASE + (idx + 1 < 10 ? "0" : "") + (idx + 1) + ".jpg" + VER;
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
        /* кадр-комната держится, проходной — перетекает плавно */
        if (ROOMS[i]) {
          t = t < 1 - ROOM_MIX ? 0 : (t - (1 - ROOM_MIX)) / ROOM_MIX;
        }
        var frac = smooth(t);
        ctx.clearRect(0, 0, cw, ch);
        cover(imgs[i], 1);
        if (frac > 0) cover(imgs[i + 1], frac);
      }
      updateSteps(f);
      updateRoom(f);
    }

    /* подпись помещения: показываем, начиная с первого кадра помещения */
    var lastRoom = -2;
    function updateRoom(f) {
      if (!roomEl) return;
      var k = Math.round(f);
      var key = ROOMS[k];
      if (k === lastRoom) return;
      lastRoom = k;
      if (!key) { roomEl.hidden = true; return; }
      var dict = (typeof I18N !== "undefined" && I18N[key]) || null;
      var lang = "ru";
      try { lang = localStorage.getItem("chestom_lang") || "ru"; } catch (e) {}
      roomEl.textContent = dict ? (dict[lang] || dict.ru) : "";
      roomEl.hidden = false;
    }

    function updateSteps(f) {
      for (var k = 0; k < steps.length; k++) {
        var r = stepRange[k];
        var on = r && f >= r[0] && f < r[1];
        steps[k].classList.toggle("is-active", !!on);
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
