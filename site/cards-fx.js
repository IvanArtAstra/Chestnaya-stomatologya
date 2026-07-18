/* ===========================================================
   cards-fx.js — эффекты карточек:
   • spotlight-сетка (границы карточек светятся у курсора),
   • стаггер-каскад появления (--rd на детях гридов).
   Border beam и параллакс при tilt — целиком в cards-fx.css.
   Подключается ПОСЛЕ effects.js. Без библиотек,
   каждый эффект изолирован try/catch.
   =========================================================== */
(function () {
  "use strict";

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) { /* noop */ }

  var finePointer = false;
  var canHover = false;
  try {
    finePointer = window.matchMedia("(pointer: fine)").matches;
    canHover = window.matchMedia("(hover: hover)").matches;
  } catch (e) { /* noop */ }

  /* ---------- 1. Spotlight-сетка ---------- */
  try {
    if (!reduceMotion && finePointer && canHover) {
      var grids = document.querySelectorAll(".services__grid, .promo__row");

      Array.prototype.forEach.call(grids, function (grid) {
        var cards = Array.prototype.slice.call(
          grid.querySelectorAll(".svc-card, .promo-card")
        );
        if (!cards.length) return;

        // рамочный слой-свечение (::before занят beam'ом, ::after — заливкой)
        cards.forEach(function (card) {
          if (card.querySelector(":scope > .spot")) return;
          var spot = document.createElement("span");
          spot.className = "spot";
          spot.setAttribute("aria-hidden", "true");
          card.appendChild(spot);
        });

        var raf = 0;
        var lastX = 0;
        var lastY = 0;

        function update() {
          raf = 0;
          for (var i = 0; i < cards.length; i++) {
            var rect = cards[i].getBoundingClientRect();
            if (!rect.width) continue;
            // координаты курсора относительно карточки (могут быть вне её)
            cards[i].style.setProperty("--mx", (lastX - rect.left).toFixed(1) + "px");
            cards[i].style.setProperty("--my", (lastY - rect.top).toFixed(1) + "px");
          }
        }

        grid.addEventListener("mousemove", function (e) {
          lastX = e.clientX;
          lastY = e.clientY;
          if (!raf) raf = requestAnimationFrame(update);
        }, { passive: true });

        grid.addEventListener("mouseenter", function () {
          grid.classList.add("is-spotlit");
        });

        grid.addEventListener("mouseleave", function () {
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          grid.classList.remove("is-spotlit"); // плавное затухание через CSS
        });
      });
    }
  } catch (e) { /* spotlight failed — остальное живёт */ }

  /* ---------- 2. Стаггер-каскад появления ---------- */
  try {
    if (!reduceMotion) {
      var STEP = 60;   // мс на карточку
      var MAX = 8;     // не более 8 ступеней

      var staggerGrid = function (grid) {
        var kids = grid.querySelectorAll(":scope > .reveal");
        Array.prototype.forEach.call(kids, function (el, i) {
          // уже показан (или вставлен сразу с is-in) — delay не нужен
          if (el.classList.contains("is-in")) return;
          var delay = Math.min(i, MAX - 1) * STEP;
          el.style.setProperty("--rd", delay + "ms");

          var cleared = false;
          var mo = null;
          var clear = function () {
            if (cleared) return;
            cleared = true;
            el.style.removeProperty("--rd");
            el.removeEventListener("transitionend", onEnd);
            if (mo) { mo.disconnect(); mo = null; }
          };
          var onEnd = function (ev) {
            if (ev.target === el && ev.propertyName === "opacity") clear();
          };
          el.addEventListener("transitionend", onEnd);
          // снимаем delay после реального появления: ждём класс .is-in,
          // затем transitionend по opacity либо страховочный таймер
          // (transition 0.7s + delay; failsafe-анимация transitionend не даёт)
          if ("MutationObserver" in window) {
            mo = new MutationObserver(function () {
              if (el.classList.contains("is-in")) {
                window.setTimeout(clear, 900 + delay);
                if (mo) { mo.disconnect(); mo = null; }
              }
            });
            mo.observe(el, { attributes: true, attributeFilter: ["class"] });
          } else {
            window.setTimeout(clear, 4000);
          }
          // страховка от влияния на hover-переходы: наведение = карточка
          // уже видна, задержка больше не нужна
          el.addEventListener("pointerenter", clear, { once: true });
        });
      };

      var staggerGrids = document.querySelectorAll(
        ".services__grid, .promo__row, .reviews__row"
      );
      Array.prototype.forEach.call(staggerGrids, staggerGrid);
    }
  } catch (e) { /* noop */ }
})();
