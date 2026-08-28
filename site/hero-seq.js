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

    var COUNT = 8;                  /* 1 — свет с зубом, дальше клиника:
                                       2 рецепция, 4 кабинет № 1, 6 кабинет № 2,
                                       8 зона ожидания. Нечётные кадры между
                                       ними — проходы: взгляд из коридора в
                                       следующее помещение. Благодаря им камера
                                       не прыгает из комнаты в комнату. */
    /* Кадр помещения держится, проход — наоборот, всё время в движении.
       Поэтому смешиваем не равномерно: на кадре комнаты снимок стоит и
       уступает место только в конце отрезка, а на проходном кадре переход
       идёт плавно от начала до конца. */
    var ROOM_FIRST = 1;             /* с этого индекса начинается клиника */
    var ROOM_MIX = 0.42;            /* доля отрезка комнаты, отданная под смену */
    /* Подпись показываем только на самих помещениях, не на проходах */
    var ROOMS = { 1: "room.1", 3: "room.2", 5: "room.3", 7: "room.4" };
    var BASE = "hero-seq/";
    var steps = Array.prototype.slice.call(section.querySelectorAll(".reveal-seq__step"));
    var offers = Array.prototype.slice.call(section.querySelectorAll(".seq-offer"));
    var roomEl = document.getElementById("seqRoom");

    /* Кадров стало восемь, и подписи распределяются по всей секции:
       визитка клиники на заставке, дальше ценности по ходу прохода. */
    var STEP_START = 0.02, STEP_END = 0.98;
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
        /* нечётные индексы — кадры-комнаты: держим снимок, смешиваем в конце */
        if (i >= ROOM_FIRST && (i - ROOM_FIRST) % 2 === 0) {
          t = t < 1 - ROOM_MIX ? 0 : (t - (1 - ROOM_MIX)) / ROOM_MIX;
        }
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

    /* Карточки акций из секции убраны: раздел «Акции» на странице
       показывает их полностью, а поверх кадров они мешали смотреть клинику. */
    function updateOffers() {}

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
