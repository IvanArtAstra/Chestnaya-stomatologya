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

/* .btn задаёт display:flex и перебивает атрибут hidden — кнопки сметы
   показывались бы всегда, поэтому гасим скрытое явно */
.tm-card [hidden] { display: none !important; }

.tm-midline { stroke: var(--aqua); stroke-opacity: 0.22; stroke-width: 1.5; stroke-dasharray: 3 9; stroke-linecap: round; }

.tm-rows { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.tm-row {
  padding: 9px 16px; border-radius: 999px; font: inherit; font-size: 0.85rem; font-weight: 600;
  border: 1.5px solid var(--card-line); background: none; color: var(--ink-dim);
  cursor: pointer; transition: 0.2s;
}
.tm-row:hover { border-color: var(--aqua); color: var(--ink); }
.tm-row[aria-pressed="true"] { border-color: var(--aqua); background: rgba(66, 57, 184, 0.1); color: var(--aqua); }

.tm-tooth { cursor: pointer; outline: none; }
.tm-tooth .tm-hit { fill: transparent; }
.tm-gum {
  fill: none; stroke-width: 26; stroke-linecap: round;
  pointer-events: none; opacity: 0.9;
}
.tm-gloss { fill: #fff; opacity: 0.5; pointer-events: none; transition: opacity 0.18s; }
.tm-tooth[aria-pressed="true"] .tm-gloss { opacity: 0.32; }

.tm-tooth .tm-shape {
  fill: url(#tmEnamel); stroke: var(--aqua); stroke-width: 1.6; stroke-opacity: 0.5;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 1px rgba(36, 31, 92, 0.16));
  transition: fill 0.18s, stroke-opacity 0.18s, filter 0.18s;
}
.tm-tooth:hover .tm-shape,
.tm-tooth:focus-visible .tm-shape {
  stroke-opacity: 1; fill: rgba(66, 57, 184, 0.12);
}
.tm-tooth:focus-visible .tm-shape { filter: drop-shadow(0 0 6px rgba(66, 57, 184, 0.6)); }
.tm-tooth[aria-pressed="true"] .tm-shape {
  fill: url(#tmGrad); stroke: var(--aqua); stroke-opacity: 1;
  animation: tmPulse 1.6s ease-in-out infinite;
}
@keyframes tmPulse {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(66, 57, 184, 0.35)); }
  50%      { filter: drop-shadow(0 0 9px rgba(122, 108, 240, 0.7)); }
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
  color: #14123a; border-color: transparent; font-weight: 700;
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

/* цвет контура — фирменный индиго (прежний бирюзовый остался от старой палитры) */
:root[data-theme="light"] .tm-tooth .tm-shape { fill: url(#tmEnamel); stroke: var(--aqua); stroke-opacity: 0.5; }
:root[data-theme="light"] .tm-tooth:hover .tm-shape,
:root[data-theme="light"] .tm-tooth:focus-visible .tm-shape {
  stroke-opacity: 1; fill: #eef0ff;
  filter: drop-shadow(0 2px 5px rgba(66, 57, 184, 0.34));
}
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

  /* ── Генерация SVG: две подковы по 14 зубов ──
     Челюсти разведены по вертикали, коронки повёрнуты внутрь — к линии
     смыкания, как в стоматологической карте (раньше дуги замыкались в
     кольцо и боковые зубы лежали на боку). */
  const NS = "http://www.w3.org/2000/svg";
  const TEETH = 14;
  const ARC = { cx: 250, a: 158, b: 118, cyU: 178, cyL: 292, span: 84 };

  /* Дуга десны — тот же эллипс, что у зубов, но шире на толщину корня */
  const gumArc = (upper) => {
    const { cx, a, b, span } = ARC;
    const cy = upper ? ARC.cyU : ARC.cyL;
    /* лента идёт по корням: коронки остаются открытыми, десна
       прикрывает только шейку (полуширина обводки — 13) */
    const A = a + 21, B = b + 21;
    const rad = (span * Math.PI) / 180;
    const dx = +(A * Math.sin(rad)).toFixed(1);
    const dy = +(B * Math.cos(rad)).toFixed(1);
    const y = upper ? cy - dy : cy + dy;
    const sweep = upper ? 1 : 0;
    return (
      `<path class="tm-gum" d="M ${cx - dx} ${y} A ${A} ${B} 0 0 ${sweep} ${cx + dx} ${y}"` +
      ` stroke="url(#${upper ? "tmGumU" : "tmGumL"})"></path>`
    );
  };
  const buildJaw = (upper) => {
    const { cx, a, b, span } = ARC;
    const cy = upper ? ARC.cyU : ARC.cyL;
    let out = "";
    for (let i = 0; i < TEETH; i++) {
      const ang = -span + (2 * span * i) / (TEETH - 1);
      const rad = (ang * Math.PI) / 180;
      const x = +(cx + a * Math.sin(rad)).toFixed(1);
      const y = +(upper ? cy - b * Math.cos(rad) : cy + b * Math.cos(rad)).toFixed(1);
      /* коронка нарисована к −y; доворачиваем её внутрь дуги */
      const rot = +(upper ? 180 + ang : -ang).toFixed(1);
      const type = typeByDist(Math.abs(i - (TEETH - 1) / 2));
      const num = i + 1;
      const side = i < TEETH / 2 ? "справа" : "слева";
      const label = `Зуб ${num}, ${upper ? "верхняя" : "нижняя"} челюсть, ${side}`;
      out +=
        `<g class="tm-tooth" tabindex="0" role="button" aria-pressed="false"` +
        ` data-tooth="${upper ? "u" : "l"}${num}" data-row="${upper ? "u" : "l"}"` +
        ` aria-label="${label}"` +
        ` transform="translate(${x} ${y}) rotate(${rot}) scale(1.22)">` +
        `<title>${label}</title>` +
        `<circle class="tm-hit" cx="0" cy="0" r="22"></circle>` +
        `<path class="tm-shape" d="${SHAPES[type]}"></path>` +
        `<rect class="tm-gloss" x="-3.6" y="-14" width="4.6" height="12" rx="2.3"></rect>` +
        `</g>`;
    }
    return out;
  };

  const svg =
    `<svg viewBox="0 0 500 470" xmlns="${NS}" role="group" aria-label="Схема зубов: верхняя и нижняя челюсть">` +
    `<defs><linearGradient id="tmGrad" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="var(--aqua)"></stop>` +
    `<stop offset="1" stop-color="var(--cyan)"></stop>` +
    `</linearGradient>` +
    /* эмаль и десна — чтобы схема читалась как челюсть, а не как чертёж */
    `<linearGradient id="tmEnamel" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#ffffff"></stop>` +
    `<stop offset="0.6" stop-color="#fbf9f4"></stop>` +
    `<stop offset="1" stop-color="#eee7d9"></stop>` +
    `</linearGradient>` +
    `<linearGradient id="tmGumU" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#e7a8b1"></stop><stop offset="1" stop-color="#d68d97"></stop>` +
    `</linearGradient>` +
    `<linearGradient id="tmGumL" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#d68d97"></stop><stop offset="1" stop-color="#e7a8b1"></stop>` +
    `</linearGradient>` +
    `</defs>` +
    /* линия смыкания — ориентир между челюстями */
    `<line class="tm-midline" x1="60" y1="235" x2="440" y2="235"></line>` +
    `<text class="tm-jaw-label" x="250" y="26" text-anchor="middle">Верхняя челюсть</text>` +
    `<text class="tm-jaw-label" x="250" y="458" text-anchor="middle">Нижняя челюсть</text>` +
    buildJaw(true) + buildJaw(false) +
    /* дёсны рисуем последними: они прикрывают шейки зубов.
       Клики сквозь них проходят — у дуг отключены события мыши. */
    gumArc(true) + gumArc(false) +
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
    `<div class="tm-scheme">` +
    `<div class="tm-rows">` +
    `<button class="tm-row" type="button" data-row="u" aria-pressed="false">Выбрать верхний ряд</button>` +
    `<button class="tm-row" type="button" data-row="l" aria-pressed="false">Выбрать нижний ряд</button>` +
    `</div>` +
    `${svg}` +
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

  /* кнопки «весь ряд» подсвечиваются, когда ряд выбран целиком */
  const rowBtns = Array.from(host.querySelectorAll(".tm-row"));
  const syncRows = () => {
    rowBtns.forEach((b) => {
      const inRow = teeth.filter((g) => g.dataset.row === b.dataset.row);
      const all = inRow.length > 0 && inRow.every((g) => selected.has(g.dataset.tooth));
      b.setAttribute("aria-pressed", String(all));
    });
  };

  const toggle = (g) => {
    const id = g.dataset.tooth;
    const on = !selected.has(id);
    if (on) selected.add(id); else selected.delete(id);
    g.setAttribute("aria-pressed", String(on));
    syncRows();
    render();
  };

  rowBtns.forEach((b) => {
    b.addEventListener("click", () => {
      const inRow = teeth.filter((g) => g.dataset.row === b.dataset.row);
      /* ряд выбран целиком — снимаем, иначе добираем недостающие */
      const on = !inRow.every((g) => selected.has(g.dataset.tooth));
      inRow.forEach((g) => {
        if (on) selected.add(g.dataset.tooth); else selected.delete(g.dataset.tooth);
        g.setAttribute("aria-pressed", String(on));
      });
      syncRows();
      render();
    });
  });

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
    syncRows();
    render();
  });

  render();
})();
