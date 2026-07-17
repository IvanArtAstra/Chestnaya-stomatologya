/* ═══════════════════════════════════════════════════════════════
   ЭКСКУРСИЯ ПО КЛИНИКЕ — горизонтальный scroll-тур
   Рендерится в #tour (section.tour-host). Без библиотек.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var host = document.getElementById("tour");
  if (!host) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ── стили ─────────────────────────────────────────────────── */
  var css = "" +
    ".tour-host{position:relative;}" +
    ".tour__head{max-width:760px;margin:0 auto;padding:clamp(70px,10vw,130px) clamp(16px,5vw,64px) 0;text-align:center;}" +
    ".tour__head p{color:var(--ink-dim);margin-top:16px;font-size:1.05rem;line-height:1.6;}" +
    ".tour__scroll{height:350vh;position:relative;margin-top:clamp(28px,4vw,52px);}" +
    ".tour__sticky{position:sticky;top:0;height:100svh;overflow:hidden;display:flex;flex-direction:column;justify-content:center;}" +
    ".tour__track{display:flex;width:400%;will-change:transform;}" +
    ".tour-slide{width:25%;flex:0 0 25%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(10px,2vh,22px);padding:0 clamp(16px,4vw,48px);box-sizing:border-box;}" +
    ".tour-slide__art{position:relative;width:min(55vmin,480px);aspect-ratio:6/5;}" +
    ".tour-slide__art svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}" +
    ".tour-slide__bg,.tour-slide__main{will-change:transform;}" +
    ".tour-slide__meta{text-align:center;max-width:520px;}" +
    ".tour-slide__num{display:inline-block;font-family:var(--font-display);font-weight:700;font-size:0.8rem;letter-spacing:0.22em;color:var(--aqua);border:1px solid var(--card-line);background:var(--card);border-radius:999px;padding:5px 14px;margin-bottom:10px;}" +
    ".tour-slide__title{font-family:var(--font-display);font-weight:700;font-size:clamp(1.15rem,2.6vw,1.7rem);letter-spacing:-0.01em;margin:0 0 8px;color:var(--ink);}" +
    ".tour-slide__cap{color:var(--ink-dim);font-size:clamp(0.92rem,1.6vw,1.08rem);line-height:1.55;margin:0;}" +
    ".tour__dots{position:absolute;left:0;right:0;bottom:clamp(18px,4vh,40px);display:flex;justify-content:center;gap:12px;}" +
    ".tour__dot{width:9px;height:9px;border-radius:50%;border:1.5px solid var(--aqua-soft);background:transparent;opacity:0.45;transition:opacity .3s,transform .3s,background .3s;}" +
    ".tour__dot.is-active{opacity:1;background:var(--aqua);border-color:var(--aqua);transform:scale(1.35);box-shadow:0 0 14px rgba(45,212,191,.5);}" +
    ".tour-art-line{stroke:var(--aqua-soft);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;}" +
    ".tour-art-line--cyan{stroke:var(--cyan);}" +
    ".tour-art-fill{fill:var(--aqua);fill-opacity:.08;}" +
    ".tour-art-fill--cyan{fill:var(--cyan);fill-opacity:.10;}" +
    ".tour-art-text{fill:var(--aqua-soft);font-family:var(--font-display),sans-serif;font-weight:700;}" +
    ".tour-bubble{fill:none;stroke:var(--aqua-soft);stroke-opacity:.22;stroke-width:1.5;}" +
    ":root[data-theme=\"light\"] .tour-art-fill{fill-opacity:.12;}" +
    ":root[data-theme=\"light\"] .tour__dot.is-active{box-shadow:0 0 10px rgba(14,165,160,.4);}" +
    /* reduced motion: вертикальная колонка без sticky */
    ".tour--static .tour__scroll{height:auto;}" +
    ".tour--static .tour__sticky{position:static;height:auto;overflow:visible;}" +
    ".tour--static .tour__track{display:flex;flex-direction:column;width:100%;gap:clamp(48px,8vw,90px);padding:clamp(30px,5vw,60px) 0;transform:none!important;}" +
    ".tour--static .tour-slide{width:100%;flex:0 0 auto;}" +
    ".tour--static .tour-slide__bg,.tour--static .tour-slide__main{transform:none!important;}" +
    ".tour--static .tour__dots{display:none;}" +
    "@media (max-width:640px){" +
    "  .tour__scroll{height:300vh;}" +
    "  .tour__dots{bottom:96px;}" + /* выше мобильной CTA-панели */
    "  .tour-slide__art{width:min(62vmin,300px);}" +
    "  .tour-slide__cap{font-size:0.92rem;}" +
    "}";

  var style = document.createElement("style");
  style.id = "tourStyles";
  style.textContent = css;
  document.head.appendChild(style);

  /* ── SVG-иллюстрации ───────────────────────────────────────── */

  // фоновые декоративные пузыри (параллакс-слой), у каждого слайда свой рисунок
  function bgBubbles(seed) {
    var sets = [
      "M60 220 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0 M290 60 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M320 200 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M40 80 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0",
      "M50 70 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0 M310 110 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 M80 240 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M300 230 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0",
      "M40 150 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M320 70 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M60 50 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M310 240 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0",
      "M55 90 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0 M300 50 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M45 230 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M315 180 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0"
    ];
    return '<svg class="tour-slide__bg" viewBox="0 0 380 300" aria-hidden="true">' +
      '<path class="tour-bubble" d="' + sets[seed] + '"/></svg>';
  }

  // 01 — Ресепшн: стойка, монитор, растение, табличка
  var artReception =
    '<svg class="tour-slide__main" viewBox="0 0 380 300" aria-hidden="true" role="img">' +
    // табличка на «стене»
    '<rect class="tour-art-fill" x="100" y="28" width="180" height="46" rx="12"/>' +
    '<rect class="tour-art-line" x="100" y="28" width="180" height="46" rx="12"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M150 28 v-14 M230 28 v-14"/>' +
    '<text class="tour-art-text" x="190" y="48" font-size="10.5" text-anchor="middle">ЧЕСТНАЯ</text>' +
    '<text class="tour-art-text" x="190" y="63" font-size="8.5" text-anchor="middle" opacity="0.8">СТОМАТОЛОГИЯ</text>' +
    // стойка ресепшн
    '<path class="tour-art-fill--cyan" d="M60 180 h260 a12 12 0 0 1 12 12 v66 h-284 v-66 a12 12 0 0 1 12-12 z"/>' +
    '<path class="tour-art-line" d="M60 180 h260 a12 12 0 0 1 12 12 v66 h-284 v-66 a12 12 0 0 1 12-12 z"/>' +
    '<path class="tour-art-line" d="M48 196 h284" opacity="0.55"/>' +
    // волна-декор на стойке
    '<path class="tour-art-line--cyan tour-art-line" d="M78 226 q14 -12 28 0 t28 0 t28 0 t28 0" opacity="0.7"/>' +
    // монитор
    '<rect class="tour-art-fill" x="146" y="118" width="66" height="46" rx="7"/>' +
    '<rect class="tour-art-line" x="146" y="118" width="66" height="46" rx="7"/>' +
    '<path class="tour-art-line" d="M172 164 l-5 14 h32 l-5 -14 M160 178 h44"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M156 132 h30 M156 142 h20" opacity="0.8"/>' +
    // растение в горшке
    '<path class="tour-art-line" d="M268 178 q-2 -26 -14 -38 M268 178 q0 -30 12 -44 M268 178 q6 -22 22 -30"/>' +
    '<circle class="tour-art-fill tour-art-line" cx="252" cy="136" r="5"/>' +
    '<circle class="tour-art-fill tour-art-line" cx="282" cy="128" r="5"/>' +
    '<circle class="tour-art-fill tour-art-line" cx="292" cy="146" r="4"/>' +
    '<path class="tour-art-fill--cyan" d="M254 178 h30 l-4 22 h-22 z"/>' +
    '<path class="tour-art-line" d="M254 178 h30 l-4 22 h-22 z"/>' +
    // колокольчик на стойке
    '<path class="tour-art-line--cyan tour-art-line" d="M104 164 a12 12 0 0 1 24 0 z M116 152 v-6"/>' +
    '</svg>';

  // 02 — Стерилизация: автоклав, лоток с инструментами, щит
  var artSterile =
    '<svg class="tour-slide__main" viewBox="0 0 380 300" aria-hidden="true" role="img">' +
    // корпус автоклава
    '<rect class="tour-art-fill--cyan" x="92" y="52" width="152" height="120" rx="18"/>' +
    '<rect class="tour-art-line" x="92" y="52" width="152" height="120" rx="18"/>' +
    // круглая дверца
    '<circle class="tour-art-fill" cx="150" cy="112" r="36"/>' +
    '<circle class="tour-art-line" cx="150" cy="112" r="36"/>' +
    '<circle class="tour-art-line--cyan tour-art-line" cx="150" cy="112" r="24" opacity="0.8"/>' +
    '<path class="tour-art-line" d="M150 96 a16 16 0 0 1 14 8" opacity="0.6"/>' +
    // панель: дисплей и ручка
    '<rect class="tour-art-line" x="202" y="72" width="30" height="16" rx="4"/>' +
    '<circle class="tour-art-line--cyan tour-art-line" cx="217" cy="112" r="9"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M217 112 l6 -5"/>' +
    '<circle class="tour-art-line" cx="209" cy="140" r="3"/>' +
    '<circle class="tour-art-line" cx="225" cy="140" r="3"/>' +
    // пар
    '<path class="tour-art-line--cyan tour-art-line" d="M124 40 q5 -8 0 -16 M150 42 q6 -9 0 -18 M176 40 q5 -8 0 -16" opacity="0.6"/>' +
    // лоток с инструментами
    '<path class="tour-art-fill" d="M96 214 h186 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-186 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10 z"/>' +
    '<path class="tour-art-line" d="M96 214 h186 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-186 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10 z"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M112 233 h58 M120 226 q-6 7 0 14" opacity="0.9"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M190 226 v14 M190 226 l10 6 l-10 8" opacity="0.9"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M226 240 l16 -14 m-3 -3 a4 4 0 1 1 6 6 a4 4 0 1 1 -6 -6 z" opacity="0.9"/>' +
    // щит со звёздочкой-плюсом
    '<path class="tour-art-fill--cyan" d="M300 96 l26 10 v22 q0 26 -26 38 q-26 -12 -26 -38 v-22 z"/>' +
    '<path class="tour-art-line" d="M300 96 l26 10 v22 q0 26 -26 38 q-26 -12 -26 -38 v-22 z"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M290 130 l8 8 l14 -16"/>' +
    '</svg>';

  // 03 — Кабинет: кресло, бестеневая лампа, стойка врача
  var artCabinet =
    '<svg class="tour-slide__main" viewBox="0 0 380 300" aria-hidden="true" role="img">' +
    // лампа: штанга сверху + плафон
    '<path class="tour-art-line" d="M236 18 v34 l-46 30"/>' +
    '<ellipse class="tour-art-fill" cx="182" cy="88" rx="26" ry="14" transform="rotate(-24 182 88)"/>' +
    '<ellipse class="tour-art-line" cx="182" cy="88" rx="26" ry="14" transform="rotate(-24 182 88)"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M166 104 l-8 14 M182 108 l-4 16 M196 106 l2 16" opacity="0.55"/>' +
    // кресло: подголовник, спинка, сиденье, подножка
    '<circle class="tour-art-fill" cx="118" cy="130" r="13"/>' +
    '<circle class="tour-art-line" cx="118" cy="130" r="13"/>' +
    '<path class="tour-art-fill--cyan" d="M104 148 q22 24 56 30 l70 12 q16 3 14 16 q-2 12 -18 11 l-88 -6 q-40 -4 -50 -44 q-3 -14 16 -19 z"/>' +
    '<path class="tour-art-line" d="M104 148 q22 24 56 30 l70 12 q16 3 14 16 q-2 12 -18 11 l-88 -6 q-40 -4 -50 -44 q-3 -14 16 -19 z"/>' +
    // подножка-опора
    '<path class="tour-art-line" d="M168 218 v26 m-30 0 h60 M244 208 l24 14"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M138 244 h60" opacity="0.5"/>' +
    // стойка врача с ящиками
    '<rect class="tour-art-fill" x="292" y="150" width="62" height="80" rx="10"/>' +
    '<rect class="tour-art-line" x="292" y="150" width="62" height="80" rx="10"/>' +
    '<path class="tour-art-line" d="M292 176 h62 M292 202 h62 M316 164 h14 M316 190 h14 M316 216 h14" opacity="0.8"/>' +
    '<circle class="tour-art-line" cx="304" cy="242" r="6"/>' +
    '<circle class="tour-art-line" cx="342" cy="242" r="6"/>' +
    // инструмент на кронштейне стойки
    '<path class="tour-art-line--cyan tour-art-line" d="M292 158 q-20 -4 -26 -22 q-2 -8 6 -10" opacity="0.9"/>' +
    '</svg>';

  // 04 — Ваша улыбка: зуб со звёздами и «★ 5,0»
  var artSmile =
    '<svg class="tour-slide__main" viewBox="0 0 380 300" aria-hidden="true" role="img">' +
    // зуб
    '<path class="tour-art-fill" d="M190 52 c-34 0 -62 24 -62 62 c0 30 12 44 18 74 c4 22 10 46 24 46 c14 0 12 -34 20 -34 c8 0 6 34 20 34 c14 0 20 -24 24 -46 c6 -30 18 -44 18 -74 c0 -38 -28 -62 -62 -62 z"/>' +
    '<path class="tour-art-line" d="M190 52 c-34 0 -62 24 -62 62 c0 30 12 44 18 74 c4 22 10 46 24 46 c14 0 12 -34 20 -34 c8 0 6 34 20 34 c14 0 20 -24 24 -46 c6 -30 18 -44 18 -74 c0 -38 -28 -62 -62 -62 z"/>' +
    // блик
    '<path class="tour-art-line--cyan tour-art-line" d="M150 92 q4 -18 22 -24" opacity="0.7"/>' +
    // глаза и улыбка
    '<circle class="tour-art-line" cx="170" cy="122" r="3.5"/>' +
    '<circle class="tour-art-line" cx="210" cy="122" r="3.5"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M164 146 q26 22 52 0"/>' +
    // звёздочки-искры
    '<path class="tour-art-line--cyan tour-art-line" d="M112 70 l0 -18 m-9 9 h18" opacity="0.9"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M282 96 l0 -14 m-7 7 h14" opacity="0.7"/>' +
    '<path class="tour-art-line--cyan tour-art-line" d="M268 190 l0 -12 m-6 6 h12" opacity="0.6"/>' +
    '<path class="tour-art-line" d="M96 150 l0 -10 m-5 5 h10" opacity="0.5"/>' +
    // бейдж рейтинга
    '<rect class="tour-art-fill--cyan" x="252" y="34" width="84" height="34" rx="17"/>' +
    '<rect class="tour-art-line" x="252" y="34" width="84" height="34" rx="17"/>' +
    '<text class="tour-art-text" x="294" y="56" font-size="15" text-anchor="middle">★ 5,0</text>' +
    '</svg>';

  /* ── данные слайдов ────────────────────────────────────────── */
  var slides = [
    { num: "01", title: "Ресепшн", cap: "Администратор Анна встретит и всё расскажет", art: artReception },
    { num: "02", title: "Стерилизация", cap: "Инструменты проходят три этапа обработки", art: artSterile },
    { num: "03", title: "Кабинет", cap: "Современное кресло и бестеневая лампа", art: artCabinet },
    { num: "04", title: "Ваша улыбка", cap: "Выходите с улыбкой — как 59 авторов отзывов на 2ГИС", art: artSmile }
  ];

  /* ── разметка ──────────────────────────────────────────────── */
  var slidesHtml = slides.map(function (s, i) {
    return '<div class="tour-slide" data-slide="' + i + '">' +
      '<div class="tour-slide__art">' + bgBubbles(i) + s.art + '</div>' +
      '<div class="tour-slide__meta">' +
      '<span class="tour-slide__num">' + s.num + '</span>' +
      '<h3 class="tour-slide__title">' + s.title + '</h3>' +
      '<p class="tour-slide__cap">' + s.cap + '</p>' +
      '</div></div>';
  }).join("");

  var dotsHtml = slides.map(function (_, i) {
    return '<span class="tour__dot' + (i === 0 ? " is-active" : "") + '" data-dot="' + i + '"></span>';
  }).join("");

  host.innerHTML =
    '<div class="tour__head reveal">' +
    '<span class="section__tag">Экскурсия</span>' +
    '<h2>Прогуляйтесь по клинике</h2>' +
    '<p>Листайте вниз — а мы поведём вас по кабинетам</p>' +
    '</div>' +
    '<div class="tour__scroll" id="tourScroll">' +
    '<div class="tour__sticky">' +
    '<div class="tour__track" id="tourTrack">' + slidesHtml + '</div>' +
    '<div class="tour__dots" id="tourDots" aria-hidden="true">' + dotsHtml + '</div>' +
    '</div></div>';

  // app.js навешивает IntersectionObserver на .reveal до того, как tour.js
  // отрендерился — наблюдаем заголовок сами, чтобы он появился без failsafe-задержки
  var headEl = host.querySelector(".tour__head");
  if ("IntersectionObserver" in window) {
    var headIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          headIO.disconnect();
        }
      });
    }, { threshold: 0.15 });
    headIO.observe(headEl);
  } else {
    headEl.classList.add("is-in");
  }

  var scrollBox = document.getElementById("tourScroll");
  var track = document.getElementById("tourTrack");
  var dots = [].slice.call(document.getElementById("tourDots").children);
  var bgLayers = [].slice.call(host.querySelectorAll(".tour-slide__bg"));
  var mainLayers = [].slice.call(host.querySelectorAll(".tour-slide__main"));

  /* ── механика ──────────────────────────────────────────────── */
  var isRTL = (document.documentElement.dir || document.dir || "").toLowerCase() === "rtl" ||
    getComputedStyle(document.documentElement).direction === "rtl";
  var dir = isRTL ? 1 : -1; // знак сдвига ленты
  var ticking = false;
  var activeDot = 0;
  var staticMode = false;

  function applyStatic(on) {
    staticMode = on;
    host.classList.toggle("tour--static", on);
    if (on) {
      track.style.transform = "";
      bgLayers.concat(mainLayers).forEach(function (el) { el.style.transform = ""; });
    } else {
      update();
    }
  }

  function update() {
    if (staticMode) return;
    var rect = scrollBox.getBoundingClientRect();
    var vh = window.innerHeight;
    // работать только когда секция рядом с вьюпортом
    if (rect.top > vh + 200 || rect.bottom < -200) return;

    var span = rect.height - vh;
    var p = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;

    // сдвиг ленты: 3 экрана из 4-х, т.е. 75% ширины трека
    track.style.transform = "translate3d(" + (dir * p * 75) + "%,0,0)";

    // параллакс: локальное смещение слайда относительно центра экрана
    var cur = p * (slides.length - 1);
    for (var i = 0; i < slides.length; i++) {
      var d = Math.max(-1, Math.min(1, cur - i));
      // фон отстаёт, основная иллюстрация чуть опережает — эффект глубины
      bgLayers[i].style.transform = "translate3d(" + (-dir * d * 46) + "px," + (d * -10) + "px,0)";
      mainLayers[i].style.transform = "translate3d(" + (dir * d * 20) + "px,0,0)";
    }

    var idx = Math.min(slides.length - 1, Math.round(cur));
    if (idx !== activeDot) {
      dots[activeDot].classList.remove("is-active");
      dots[idx].classList.add("is-active");
      activeDot = idx;
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      update();
    });
  }

  function syncMotion() {
    applyStatic(reduceMotion.matches);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  if (typeof reduceMotion.addEventListener === "function") {
    reduceMotion.addEventListener("change", syncMotion);
  } else if (typeof reduceMotion.addListener === "function") {
    reduceMotion.addListener(syncMotion);
  }

  syncMotion();
  update();
})();
