/* ═══════════ Интерактивная карта зубов ═══════════
   Пациент отмечает зубы на схеме, выбирает тип проблемы —
   получает ориентировочную смету по ценам из ChestomDB.
   Самодостаточный модуль: рендер + стили из JS, без библиотек. */
(() => {
  "use strict";

  const host = document.getElementById("teethMap");
  if (!host) return;

  /* ── Данные ─────────────────────────────────────────── */
  const PROBLEMS = [
    { id: "caries",      label: "Болит / кариес" },
    { id: "prosthetics", label: "Разрушен / нужна коронка" },
    { id: "extraction",  label: "Удалить" },
    { id: "restore",     label: "Эстетика" }
  ];

  const prices = (() => {
    /* db.js объявляет ChestomDB через const — это глобальная лексическая
       привязка, а не свойство window, поэтому проверяем через typeof */
    try { return (typeof ChestomDB !== "undefined" && ChestomDB.load().prices) || {}; }
    catch (e) { return {}; }
  })();

  /* «4 000–4 500 ₽» → 4000 (нижняя граница) */
  const parseLow = (str) => {
    const m = String(str || "").replace(/[\s  ]/g, "").match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };

  const fmt = (n) => n.toLocaleString("ru-RU");
  const roundH = (n) => Math.round(n / 100) * 100;
  const plural = (n) => {
    const d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return "зуб";
    if (d >= 2 && d <= 4 && (h < 10 || h > 20)) return "зуба";
    return "зубов";
  };

  /* ── Стили ──────────────────────────────────────────── */
  const css = `
.tm-card {
  max-width: 1080px; margin: 26px auto 0; border-radius: var(--radius, 22px);
  background: var(--card); border: 1px solid var(--card-line);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  padding: clamp(24px, 4vw, 44px);
}
.tm-card h3 {
  font-family: var(--font-display); font-weight: 700; font-size: clamp(1.3rem, 2.6vw, 1.8rem);
  letter-spacing: -0.01em; margin: 0 0 8px;
}
.tm-card > p { color: var(--ink-dim); margin: 0 0 22px; line-height: 1.6; }
.tm-grid { display: grid; grid-template-columns: 1.35fr 1fr; gap: clamp(20px, 3vw, 36px); align-items: start; }
.tm-scheme { min-width: 0; }
.tm-scheme svg { display: block; width: 100%; height: auto; }
.tm-jaw-label { font-size: 12px; fill: var(--ink-dim); letter-spacing: 0.08em; text-transform: uppercase; }

.tm-tooth { cursor: pointer; outline: none; }
.tm-tooth .tm-hit { fill: transparent; }
.tm-tooth .tm-shape {
  fill: rgba(255, 255, 255, 0.08); stroke: var(--card-line); stroke-width: 1.5;
  transition: fill 0.2s, stroke 0.2s, filter 0.2s;
}
.tm-tooth:hover .tm-shape,
.tm-tooth:focus-visible .tm-shape { stroke: var(--aqua); fill: rgba(45, 212, 191, 0.16); }
.tm-tooth:focus-visible .tm-shape { filter: drop-shadow(0 0 6px rgba(45, 212, 191, 0.6)); }
.tm-tooth[aria-pressed="true"] .tm-shape {
  fill: url(#tmGrad); stroke: var(--aqua);
  animation: tmPulse 1.6s ease-in-out infinite;
}
@keyframes tmPulse {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(45, 212, 191, 0.35)); }
  50%      { filter: drop-shadow(0 0 9px rgba(56, 189, 248, 0.7)); }
}
@media (prefers-reduced-motion: reduce) {
  .tm-tooth[aria-pressed="true"] .tm-shape { animation: none; }
}

.tm-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.tm-chips label { position: relative; }
.tm-chips input[type="radio"] { position: absolute; opacity: 0; }
.tm-chips label span {
  display: inline-block; padding: 10px 18px; border-radius: 999px; font-size: 0.9rem;
  border: 1.5px solid var(--card-line); color: var(--ink-dim); cursor: pointer; transition: 0.25s;
}
.tm-chips label span:hover { border-color: var(--aqua); color: var(--ink); }
.tm-chips input:checked + span {
  background: linear-gradient(120deg, var(--aqua), var(--cyan));
  color: #04202e; border-color: transparent; font-weight: 700;
}
.tm-chips input:focus-visible + span { outline: 2px solid var(--aqua); outline-offset: 2px; }

.tm-summary {
  border-radius: 18px; padding: 24px; background: rgba(2, 18, 28, 0.4);
  border: 1px solid var(--card-line); display: flex; flex-direction: column;
  gap: 12px; align-items: flex-start; position: sticky; top: 90px;
}
.tm-summary__count { color: var(--ink-dim); font-size: 0.88rem; }
.tm-summary__sum {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(1.25rem, 2.4vw, 1.7rem); color: var(--aqua-soft); line-height: 1.25;
}
.tm-summary__hint { color: var(--ink-dim); font-size: 0.92rem; line-height: 1.55; }
.tm-summary__note { color: var(--ink-dim); font-size: 0.78rem; line-height: 1.5; opacity: 0.85; }
.tm-summary .btn { width: 100%; text-align: center; justify-content: center; }
.tm-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 4px; }

:root[data-theme="light"] .tm-tooth .tm-shape { fill: #fff; stroke: rgba(11, 69, 96, 0.25); }
:root[data-theme="light"] .tm-tooth:hover .tm-shape,
:root[data-theme="light"] .tm-tooth:focus-visible .tm-shape { stroke: var(--aqua); fill: rgba(45, 212, 191, 0.18); }
:root[data-theme="light"] .tm-tooth[aria-pressed="true"] .tm-shape { fill: url(#tmGrad); stroke: var(--aqua); }
:root[data-theme="light"] .tm-summary { background: rgba(255, 255, 255, 0.7); }

@media (max-width: 860px) {
  .tm-grid { grid-template-columns: 1fr; }
  .tm-summary { position: static; }
}
`;

  if (!document.getElementById("teethMapStyles")) {
    const style = document.createElement("style");
    style.id = "teethMapStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ── Формы зубов (контур вокруг (0,0), коронка «вверх», к -y) ── */
  const SHAPES = {
    incisor:  "M -6.5 -17 Q -6.5 -21 -2.5 -21 L 2.5 -21 Q 6.5 -21 6.5 -17 L 5.5 12 Q 0 18 -5.5 12 Z",
    canine:   "M 0 -23 Q 7.5 -15 7.5 -3 L 6 12 Q 0 18 -6 12 L -7.5 -3 Q -7.5 -15 0 -23 Z",
    premolar: "M -9 -15 Q -9 -20 -4 -19 Q 0 -16 4 -19 Q 9 -20 9 -15 L 7.5 11 Q 0 17 -7.5 11 Z",
    molar:    "M -12 -13 Q -12 -19 -6.5 -18 Q 0 -14.5 6.5 -18 Q 12 -19 12 -13 L 10.5 10 Q 5.5 16 0 13.5 Q -5.5 16 -10.5 10 Z"
  };
  /* тип зуба по удалённости от центра дуги (7 на квадрант) */
  const typeByDist = (d) =>
    d < 2 ? "incisor" : d < 3 ? "canine" : d < 5 ? "premolar" : "molar";

  /* ── Генерация SVG: две дуги по 14 зубов по эллипсу ── */
  const NS = "http://www.w3.org/2000/svg";
  const TEETH = 14;
  const buildJaw = (upper) => {
    const cx = 250, a = 205, b = 155;
    const cy = upper ? 205 : 235; /* центры эллипсов */
    let out = "";
    for (let i = 0; i < TEETH; i++) {
      /* угол от -76° до +76° равномерно */
      const ang = -76 + (152 * i) / (TEETH - 1);
      const rad = (ang * Math.PI) / 180;
      const x = +(cx + a * Math.sin(rad)).toFixed(1);
      const y = +(upper ? cy - b * Math.cos(rad) : cy + b * Math.cos(rad)).toFixed(1);
      const rot = +(upper ? ang : 180 - ang).toFixed(1);
      const type = typeByDist(Math.abs(i - (TEETH - 1) / 2));
      const num = i + 1;
      const label = `Зуб ${num}, ${upper ? "верхняя" : "нижняя"} челюсть`;
      out +=
        `<g class="tm-tooth" tabindex="0" role="button" aria-pressed="false"` +
        ` data-tooth="${upper ? "u" : "l"}${num}" aria-label="${label}"` +
        ` transform="translate(${x} ${y}) rotate(${rot})">` +
        `<circle class="tm-hit" cx="0" cy="0" r="25"></circle>` +
        `<path class="tm-shape" d="${SHAPES[type]}"></path>` +
        `</g>`;
    }
    return out;
  };

  const svg =
    `<svg viewBox="0 0 500 460" xmlns="${NS}" role="group" aria-label="Схема зубов: верхняя и нижняя челюсть">` +
    `<defs><linearGradient id="tmGrad" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="var(--aqua)"></stop>` +
    `<stop offset="1" stop-color="var(--cyan)"></stop>` +
    `</linearGradient></defs>` +
    `<text class="tm-jaw-label" x="250" y="88" text-anchor="middle">Верхняя</text>` +
    `<text class="tm-jaw-label" x="250" y="352" text-anchor="middle">Нижняя</text>` +
    buildJaw(true) + buildJaw(false) +
    `</svg>`;

  /* ── Разметка карточки ─────────────────────────────── */
  const chips = PROBLEMS.map(
    (p, i) =>
      `<label><input type="radio" name="tmProblem" value="${p.id}"${i === 0 ? " checked" : ""}>` +
      `<span>${p.label}</span></label>`
  ).join("");

  host.innerHTML =
    `<div class="tm-card">` +
    `<h3>Покажите, что беспокоит</h3>` +
    `<p>Выберите зубы на схеме — посчитаем ориентировочную стоимость.</p>` +
    `<div class="tm-grid">` +
    `<div class="tm-scheme">${svg}` +
    `<div class="tm-chips" role="radiogroup" aria-label="Тип проблемы">${chips}</div>` +
    `</div>` +
    `<div class="tm-summary" aria-live="polite">` +
    `<span class="tm-summary__count" id="tmCount">Выбрано зубов: 0</span>` +
    `<b class="tm-summary__sum" id="tmSum" hidden></b>` +
    `<span class="tm-summary__hint" id="tmHint">Нажмите на зуб на схеме</span>` +
    `<div class="tm-actions">` +
    `<button class="btn btn--primary" id="tmBook" data-open-booking hidden>Записаться с этой сметой</button>` +
    `<button class="btn btn--ghost" id="tmReset" type="button" hidden>Сбросить</button>` +
    `</div>` +
    `<span class="tm-summary__note">Расчёт предварительный. Точную смету зафиксирует врач после осмотра — она не изменится в процессе лечения.</span>` +
    `</div>` +
    `</div>` +
    `</div>`;

  /* ── Логика ─────────────────────────────────────────── */
  const teeth = Array.from(host.querySelectorAll(".tm-tooth"));
  const countEl = host.querySelector("#tmCount");
  const sumEl = host.querySelector("#tmSum");
  const hintEl = host.querySelector("#tmHint");
  const bookBtn = host.querySelector("#tmBook");
  const resetBtn = host.querySelector("#tmReset");
  const selected = new Set();

  const problem = () =>
    host.querySelector('input[name="tmProblem"]:checked')?.value || "caries";
  const problemLabel = (id) =>
    (PROBLEMS.find((p) => p.id === id) || PROBLEMS[0]).label;

  const render = () => {
    const n = selected.size;
    const pid = problem();
    countEl.textContent = `Выбрано зубов: ${n}`;
    if (!n) {
      sumEl.hidden = true;
      bookBtn.hidden = true;
      resetBtn.hidden = true;
      hintEl.hidden = false;
      return;
    }
    const base = parseLow(prices[pid]) || 0;
    const low = roundH(base * n);
    const high = roundH(base * 1.35 * n);
    sumEl.textContent = `Ориентировочно: ${fmt(low)} – ${fmt(high)} ₽`;
    sumEl.hidden = false;
    hintEl.hidden = true;
    bookBtn.hidden = false;
    resetBtn.hidden = false;
    bookBtn.dataset.service = `Карта зубов: ${n} ${plural(n)}, ${problemLabel(pid)}`;
  };

  const toggle = (g) => {
    const id = g.dataset.tooth;
    const on = !selected.has(id);
    if (on) selected.add(id); else selected.delete(id);
    g.setAttribute("aria-pressed", String(on));
    render();
  };

  teeth.forEach((g) => {
    g.addEventListener("click", () => toggle(g));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggle(g);
      }
    });
  });

  host.querySelectorAll('input[name="tmProblem"]').forEach((r) =>
    r.addEventListener("change", render)
  );

  resetBtn.addEventListener("click", () => {
    selected.clear();
    teeth.forEach((g) => g.setAttribute("aria-pressed", "false"));
    render();
  });

  render();
})();
