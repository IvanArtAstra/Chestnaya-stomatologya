/* ===========================================================
   effects.js — декоративные эффекты сайта
   (tilt-карточки, магнитные кнопки, прелоадер,
   бегущие строки, split-заголовки)
   Без библиотек. Каждый блок изолирован try/catch.
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

  /* ---------- 1. 3D-tilt карточек ---------- */
  try {
    if (!reduceMotion && finePointer && canHover) {
      var MAX_DEG = 5;
      var cards = document.querySelectorAll(".svc-card, a.doc-card, .promo-card");
      Array.prototype.forEach.call(cards, function (card) {
        var glare = document.createElement("span");
        glare.className = "tilt-glare";
        glare.setAttribute("aria-hidden", "true");
        card.appendChild(glare);

        var raf = 0;
        var lastEvent = null;

        function applyTilt() {
          raf = 0;
          if (!lastEvent) return;
          var rect = card.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          var px = (lastEvent.clientX - rect.left) / rect.width;  // 0..1
          var py = (lastEvent.clientY - rect.top) / rect.height;  // 0..1
          var rotY = (px - 0.5) * 2 * MAX_DEG;
          var rotX = (0.5 - py) * 2 * MAX_DEG;
          card.style.transform =
            "perspective(800px) rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg)";
          glare.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
          glare.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
        }

        card.addEventListener("mouseenter", function () {
          card.classList.add("is-tilting");
        });

        card.addEventListener("mousemove", function (e) {
          lastEvent = e;
          if (!raf) raf = requestAnimationFrame(applyTilt);
        }, { passive: true });

        card.addEventListener("mouseleave", function () {
          lastEvent = null;
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          card.classList.remove("is-tilting");
          // плавный возврат: даём transition из styles.css снова работать
          card.style.transition = "transform 0.4s ease";
          card.style.transform = "";
          window.setTimeout(function () {
            card.style.transition = "";
          }, 420);
        });
      });
    }
  } catch (e) { /* tilt failed — остальные эффекты живут */ }

  /* ---------- 2. Магнитные кнопки ---------- */
  try {
    if (!reduceMotion && finePointer) {
      var RADIUS = 90;
      var MAX_SHIFT = 6;
      var buttons = Array.prototype.slice.call(document.querySelectorAll(".btn--primary"));
      buttons.forEach(function (btn) { btn.classList.add("is-magnetic"); });

      var magnetRaf = 0;
      var lastX = 0, lastY = 0;

      function updateMagnets() {
        magnetRaf = 0;
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          var rect = btn.getBoundingClientRect();
          if (!rect.width) continue;
          var cx = rect.left + rect.width / 2;
          var cy = rect.top + rect.height / 2;
          var dx = lastX - cx;
          var dy = lastY - cy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < RADIUS) {
            var pull = 1 - dist / RADIUS; // 0..1
            var tx = (dx / RADIUS) * MAX_SHIFT * (1 + pull);
            var ty = (dy / RADIUS) * MAX_SHIFT * (1 + pull);
            if (tx > MAX_SHIFT) tx = MAX_SHIFT; else if (tx < -MAX_SHIFT) tx = -MAX_SHIFT;
            if (ty > MAX_SHIFT) ty = MAX_SHIFT; else if (ty < -MAX_SHIFT) ty = -MAX_SHIFT;
            btn.style.transform =
              "translate(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px) scale(1.02)";
          } else if (btn.style.transform) {
            btn.style.transform = "";
          }
        }
      }

      document.addEventListener("mousemove", function (e) {
        lastX = e.clientX;
        lastY = e.clientY;
        if (!magnetRaf) magnetRaf = requestAnimationFrame(updateMagnets);
      }, { passive: true });
    }
  } catch (e) { /* noop */ }

  /* ---------- 3. Рисующиеся иконки ----------
     Реализовано целиком в effects.css (:hover + @keyframes iconDraw).
     JS не требуется. */

  /* ---------- 4. Прелоадер первого визита ---------- */
  try {
    var seen = null;
    try { seen = window.sessionStorage.getItem("chestom_seen"); } catch (e2) { seen = "1"; }
    if (!seen && !reduceMotion && document.body) {
      try { window.sessionStorage.setItem("chestom_seen", "1"); } catch (e3) { /* noop */ }

      var overlay = document.createElement("div");
      overlay.id = "preloader";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML =
        '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">' +
        '<path class="pl-tooth" d="M32 12c-8.5 0-14 5.6-14 12.4 0 5.5 2.8 8.3 4 13.8 1 4.3 1.9 12 4.7 12 3.2 0 2.1-9.3 5.3-9.3s2.1 9.3 5.3 9.3c2.8 0 3.7-7.7 4.7-12 1.2-5.5 4-8.3 4-13.8C46 17.6 40.5 12 32 12z"/>' +
        '<path class="pl-pulse" d="M24.5 26h4.2l2-3.4 2.9 6 2-2.6h4"/>' +
        "</svg>";
      document.body.appendChild(overlay);

      var removed = false;
      var removeOverlay = function () {
        if (removed) return;
        removed = true;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      };
      var hideOverlay = function () {
        overlay.classList.add("is-done");
        window.setTimeout(removeOverlay, 450);
      };

      // прорисовка ~0.8s (+задержка пульса) → скрываем
      window.setTimeout(hideOverlay, 1100);
      // страховка: в любом случае убрать через 2.5s
      window.setTimeout(removeOverlay, 2500);
    }
  } catch (e) { /* noop */ }

  /* ---------- 5. Бегущие строки-разделители ---------- */
  try {
    var phrase = "честно • без боли • без скрытых доплат • ★ 5,0 на 2ГИС • ";
    // "честно • без боли • без скрытых доплат • ★ 5,0 на 2ГИС • "
    var half = "";
    for (var r = 0; r < 4; r++) half += phrase;
    var tickerTargets = ["#team", "#reviews", "#contacts"];
    tickerTargets.forEach(function (sel) {
      var section = document.querySelector(sel);
      if (!section || !section.parentNode) return;
      var ticker = document.createElement("div");
      ticker.className = "ticker";
      ticker.setAttribute("aria-hidden", "true");
      var track = document.createElement("div");
      track.className = "ticker__track";
      // две одинаковые половины → translateX(-50%) даёт бесшовный цикл
      track.textContent = reduceMotion ? phrase : (half + half);
      ticker.appendChild(track);
      section.parentNode.insertBefore(ticker, section);
    });
  } catch (e) { /* noop */ }

  /* ---------- 6. Split-заголовки с волной ---------- */
  try {
    if (!reduceMotion && "IntersectionObserver" in window) {
      var STAGGER = 60;

      var splitHeading = function (h2) {
        // guard от реакции MutationObserver на собственные изменения
        h2.__splitting = true;
        var walker = document.createTreeWalker(h2, NodeFilter.SHOW_TEXT, null);
        var textNodes = [];
        var node;
        while ((node = walker.nextNode())) {
          if (node.nodeValue && /\S/.test(node.nodeValue)) textNodes.push(node);
        }
        var wordIndex = 0;
        textNodes.forEach(function (tn) {
          var parts = tn.nodeValue.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
            } else {
              var span = document.createElement("span");
              span.className = "w";
              span.textContent = part;
              span.style.setProperty("--wd", (wordIndex * STAGGER) + "ms");
              wordIndex++;
              frag.appendChild(span);
            }
          });
          tn.parentNode.replaceChild(frag, tn);
        });
        // снимаем guard после того, как обсёрвер получит свои записи
        window.setTimeout(function () { h2.__splitting = false; }, 0);
      };

      var showInstantly = function (h2) {
        Array.prototype.forEach.call(h2.querySelectorAll(".w"), function (w) {
          w.classList.add("is-shown");
          w.style.transition = "none";
          w.style.removeProperty("--wd");
        });
      };

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-inview");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      var headings = document.querySelectorAll(".section__head h2");
      Array.prototype.forEach.call(headings, function (h2) {
        splitHeading(h2);
        io.observe(h2);

        // i18n перезаписывает innerHTML — пере-сплитить и показать сразу
        var mo = new MutationObserver(function () {
          if (h2.__splitting) return;
          if (h2.querySelector(".w")) return;
          splitHeading(h2);
          showInstantly(h2);
          h2.classList.add("is-inview");
        });
        mo.observe(h2, { childList: true, subtree: true });
      });
    }
  } catch (e) { /* noop */ }
})();
