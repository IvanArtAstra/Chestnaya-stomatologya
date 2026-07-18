/* ═══════════ Честная стоматология — motion-fx: одометры, морфинг кнопок, круговая смена темы ═══════════ */
(() => {
  "use strict";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const THIN = " "; /* узкий неразрывный пробел — как у Intl ru-RU */

  /* ══════════ Стили (внедряем из JS) ══════════ */
  try {
    if (!document.getElementById("motionFxStyles")) {
      const st = document.createElement("style");
      st.id = "motionFxStyles";
      st.textContent = `
/* ── одометр ──
   !important: на сайте есть .hero__stats span / .fact span (font-size, display, color),
   которые иначе перебивают наши вложенные span'ы */
.odo, .odo span { font-size: inherit !important; color: inherit !important; }
.odo { display: inline-flex !important; overflow: hidden; height: 1em !important; line-height: 1 !important; vertical-align: baseline; }
.odo-reel { display: block !important; height: 1em !important; overflow: hidden; }
.odo-strip { display: block !important; height: auto !important; transform: translateY(0); transition: transform 1.4s cubic-bezier(0.2, 0.8, 0.2, 1); will-change: transform; }
.odo-strip > span, .odo-sep { display: block !important; height: 1em !important; line-height: 1em !important; }

/* ── кнопка-морфинг успеха ── */
.btn--success {
  position: relative; overflow: hidden; padding: 0 !important;
  border-radius: 50% !important; border-color: transparent !important;
  background: linear-gradient(120deg, var(--aqua), #34d399) !important;
  opacity: 1 !important; cursor: default;
  transition:
    width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) 0.12s,
    height 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) 0.12s,
    border-radius 0.45s ease 0.12s,
    background 0.3s ease;
}
.btn--success .btn-label {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  white-space: nowrap; opacity: 0; transition: opacity 0.2s ease;
}
.btn-check {
  position: absolute; inset: 0; margin: auto; width: 26px; height: 26px;
  fill: none; stroke: #04202e; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
}
.btn-check polyline { stroke-dasharray: 24; stroke-dashoffset: 24; animation: fxCheck 0.4s ease-out 0.4s forwards; }
@keyframes fxCheck { to { stroke-dashoffset: 0; } }
.fx-ripple {
  position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px;
  border-radius: 50%; background: rgba(255, 255, 255, 0.45);
  transform: scale(0); animation: fxRipple 0.6s ease-out forwards; pointer-events: none;
}
@keyframes fxRipple { to { transform: scale(8); opacity: 0; } }

/* ── круговая смена темы (перекрывает vtOut/vtIn ТОЛЬКО пока висит .theme-wipe) ── */
html.theme-wipe::view-transition-old(root) { animation: none; }
html.theme-wipe::view-transition-new(root) { animation: themeWipe 0.55s ease-out both; }
@keyframes themeWipe {
  from { clip-path: circle(0px at var(--tw-x, 50%) var(--tw-y, 0%)); }
  to   { clip-path: circle(var(--tw-r, 120vmax) at var(--tw-x, 50%) var(--tw-y, 0%)); }
}
@media (prefers-reduced-motion: reduce) {
  .odo-strip { transition: none; }
  .btn-check polyline, .fx-ripple { animation: none; }
  html.theme-wipe::view-transition-new(root) { animation: none; }
}`;
      document.head.appendChild(st);
    }
  } catch (e) { console.error("motion-fx styles:", e); }

  /* ══════════ 1. Одометр для [data-count] ══════════ */
  try {
    /* формат как в app.js: >2000 — без разделителей (годы), иначе ru-RU-группировка */
    const fmtDigits = (n) => {
      const s = String(n);
      if (n > 999 && n <= 2000) return s.replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
      return s;
    };

    document.querySelectorAll("[data-count]").forEach((orig) => {
      const target = Math.max(0, Math.round(+orig.dataset.count || 0));
      /* отвязываем узел от counterIO из app.js: observer держит старый (отсоединённый) узел */
      const clone = orig.cloneNode(true);
      orig.replaceWith(clone);
      const text = fmtDigits(target);

      if (reduceMotion) { clone.textContent = text; return; }

      clone.textContent = "";
      clone.setAttribute("aria-label", text);
      const wrap = document.createElement("span");
      wrap.className = "odo";
      wrap.setAttribute("aria-hidden", "true");
      const reels = [];
      for (const ch of text) {
        if (ch >= "0" && ch <= "9") {
          const d = +ch;
          const reel = document.createElement("span");
          reel.className = "odo-reel";
          const strip = document.createElement("span");
          strip.className = "odo-strip";
          /* цель «0» — полный круг 0→…→9→0 (в т.ч. одиночный ноль) */
          const steps = d === 0 ? 10 : d;
          for (let i = 0; i <= steps; i++) {
            const digit = document.createElement("span");
            digit.textContent = String(i % 10);
            strip.appendChild(digit);
          }
          reel.appendChild(strip);
          wrap.appendChild(reel);
          reels.push({ strip, offset: steps });
        } else {
          const sep = document.createElement("span");
          sep.className = "odo-sep";
          sep.textContent = ch;
          wrap.appendChild(sep);
        }
      }
      clone.appendChild(wrap);

      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.disconnect();
          const n = reels.length;
          reels.forEach((r, i) => {
            /* стаггер 80ms справа налево */
            r.strip.style.transitionDelay = `${(n - 1 - i) * 80}ms`;
            r.strip.style.transform = `translateY(-${r.offset}em)`;
          });
        });
      }, { threshold: 0.6 });
      io.observe(clone);
    });
  } catch (e) { console.error("motion-fx odometer:", e); }

  /* ══════════ 2. Кнопка-морфинг успеха (формы записи) ══════════ */
  try {
    document.addEventListener("submit", (e) => {
      try {
        const form = e.target;
        if (!form || (form.id !== "inlineBooking" && form.id !== "modalBooking")) return;
        const btn =
          (e.submitter && e.submitter.tagName === "BUTTON" ? e.submitter : null) ||
          form.querySelector('button[type="submit"], button:not([type])');
        if (!btn || btn.classList.contains("btn--success")) return;

        if (reduceMotion) { btn.textContent = "✓"; return; }

        /* оборачиваем текущий текст, чтобы плавно погасить */
        const label = document.createElement("span");
        label.className = "btn-label";
        while (btn.firstChild) label.appendChild(btn.firstChild);
        btn.appendChild(label);

        /* ripple от центра */
        const rip = document.createElement("span");
        rip.className = "fx-ripple";
        btn.appendChild(rip);

        /* галочка с прорисовкой штриха */
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("class", "btn-check");
        svg.setAttribute("aria-hidden", "true");
        const pl = document.createElementNS(NS, "polyline");
        pl.setAttribute("points", "20 7 10 17 5 12");
        svg.appendChild(pl);
        btn.appendChild(svg);

        /* фиксируем текущие габариты в px, затем морфим до квадрата 54px */
        const r = btn.getBoundingClientRect();
        btn.style.width = `${r.width}px`;
        btn.style.height = `${r.height}px`;
        void btn.offsetWidth; /* reflow */
        btn.classList.add("btn--success");
        requestAnimationFrame(() => {
          btn.style.width = "54px";
          btn.style.height = "54px";
        });
        /* app.js в bubble-фазе задизейблит кнопку — морф работает и на disabled */
      } catch (err) { console.error("motion-fx submit:", err); }
    }, true); /* capture: срабатываем ДО обработчика app.js */
  } catch (e) { console.error("motion-fx button:", e); }

  /* ══════════ 3. Смена темы круговым раскрытием ══════════ */
  try {
    document.addEventListener("click", (e) => {
      try {
        const btn = e.target && e.target.closest ? e.target.closest("#themeBtn") : null;
        if (!btn) return;
        /* глушим обработчик app.js — дублируем его логику сами */
        e.stopImmediatePropagation();

        /* app.js-обработчики на document (закрытие языка/FAB) тоже не сработают — закроем сами */
        const lang = document.getElementById("lang");
        if (lang) lang.classList.remove("is-open");
        const fab = document.getElementById("fab");
        if (fab && !fab.contains(btn)) fab.classList.remove("is-open");

        const root = document.documentElement;
        const next = root.dataset.theme === "light" ? "dark" : "light";
        try { localStorage.setItem("chestom_theme", next); } catch (_) {}
        const apply = () => { root.dataset.theme = next; };

        if (!document.startViewTransition || reduceMotion) { apply(); return; }

        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const maxR = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
        root.classList.add("theme-wipe");
        root.style.setProperty("--tw-x", `${cx}px`);
        root.style.setProperty("--tw-y", `${cy}px`);
        root.style.setProperty("--tw-r", `${Math.ceil(maxR)}px`);

        const vt = document.startViewTransition(apply);
        /* снимаем класс после — межстраничные переходы снова используют vtOut/vtIn */
        vt.finished.finally(() => root.classList.remove("theme-wipe"));
      } catch (err) {
        /* при любом сбое тема всё равно должна переключиться */
        const root = document.documentElement;
        root.classList.remove("theme-wipe");
        root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
        console.error("motion-fx theme:", err);
      }
    }, true); /* capture на document — раньше listener'а на самой кнопке */
  } catch (e) { console.error("motion-fx theme init:", e); }
})();
