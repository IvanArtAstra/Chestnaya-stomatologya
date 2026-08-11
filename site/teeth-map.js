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
.tm-scheme svg { display: block; width: 100%; height: auto;
  clip-path: inset(0 round 18px); background: #ececee; }
.tm-jaw-label { font-size: 13px; font-weight: 700; fill: var(--ink-dim); letter-spacing: 0.08em; text-transform: uppercase; }

/* .btn задаёт display:flex и перебивает атрибут hidden — кнопки сметы
   показывались бы всегда, поэтому гасим скрытое явно */
.tm-card [hidden] { display: none !important; }

.tm-rows { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.tm-row {
  padding: 9px 16px; border-radius: 999px; font: inherit; font-size: 0.85rem; font-weight: 600;
  border: 1.5px solid var(--card-line); background: none; color: var(--ink-dim);
  cursor: pointer; transition: 0.2s;
}
.tm-row:hover { border-color: var(--aqua); color: var(--ink); }
.tm-row[aria-pressed="true"] { border-color: var(--aqua); background: rgba(66, 57, 184, 0.1); color: var(--aqua); }

/* Зона выбора поверх зуба на снимке: прозрачная, подсвечивается по наведению
   и заливается фирменным цветом, когда зуб отмечен. */
.tm-tooth { cursor: pointer; outline: none; }
.tm-pick {
  fill: transparent; stroke: transparent; stroke-width: 2;
  transition: fill 0.18s, stroke 0.18s;
}
.tm-tooth:hover .tm-pick,
.tm-tooth:focus-visible .tm-pick {
  fill: rgba(66, 57, 184, 0.22); stroke: var(--aqua);
}
.tm-tooth:focus-visible .tm-pick { stroke-width: 3; }
.tm-tooth[aria-pressed="true"] .tm-pick {
  fill: url(#tmGrad); fill-opacity: 0.62; stroke: var(--aqua);
  animation: tmPulse 1.8s ease-in-out infinite;
}
@keyframes tmPulse {
  0%, 100% { fill-opacity: 0.55; }
  50%      { fill-opacity: 0.75; }
}
@media (prefers-reduced-motion: reduce) {
  .tm-tooth[aria-pressed="true"] .tm-pick { animation: none; }
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

  /* ── Карта зубов на реальном снимке челюстей ──
     Схему заменил рендер (jaws.jpg): зубы объёмные, с анатомией и дёснами.
     Координаты зон получены разбором самого изображения — зуб за зубом,
     поэтому кликабельные области ложатся ровно на зубы. Система координат
     совпадает с viewBox 512×512. */
  const NS = "http://www.w3.org/2000/svg";
  const TEETH = 14;
  const POS = {
    u: [[108.8,228.2], [108.8,186.8], [123.5,155.2], [138.5,121.0], [156.1,82.9], [188.6,57.2], [230.9,43.2], [280.0,42.5], [324.5,54.0], [357.1,81.3], [373.1,120.6], [388.1,155.2], [402.8,186.0], [402.8,228.0]],
    l: [[114.3,295.8], [114.3,341.2], [131.3,376.4], [148.9,407.2], [171.0,438.8], [203.2,454.9], [237.5,462.6], [272.9,462.7], [307.3,455.2], [339.9,439.2], [362.3,407.4], [380.0,376.6], [397.1,341.2], [397.1,295.8]]
  };
  const nameByIndex = (i) => {
    const d = Math.abs(i - (TEETH - 1) / 2);
    return d < 1 ? "центральный резец" : d < 2 ? "боковой резец"
         : d < 3 ? "клык" : d < 5 ? "премоляр" : "моляр";
  };

  const buildJaw = (upper) => {
    const key = upper ? "u" : "l";
    let out = "";
    POS[key].forEach(([x, y], i) => {
      const num = i + 1;
      const side = i < TEETH / 2 ? "справа" : "слева";
      const label = `${nameByIndex(i)}, ${upper ? "верхняя" : "нижняя"} челюсть, ${side}`;
      out +=
        `<g class="tm-tooth" tabindex="0" role="button" aria-pressed="false"` +
        ` data-tooth="${key}${num}" data-row="${key}" aria-label="${label}">` +
        `<title>${label}</title>` +
        `<circle class="tm-pick" cx="${x}" cy="${y}" r="17"></circle>` +
        `</g>`;
    });
    return out;
  };

  const svg =
    `<svg viewBox="0 0 512 512" xmlns="${NS}" role="group" aria-label="Схема зубов: верхняя и нижняя челюсть">` +
    `<defs><linearGradient id="tmGrad" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="var(--aqua)"></stop>` +
    `<stop offset="1" stop-color="var(--cyan)"></stop>` +
    `</linearGradient></defs>` +
    `<image href="jaws.jpg" x="0" y="0" width="512" height="512"></image>` +
    `<text class="tm-jaw-label" x="256" y="14" text-anchor="middle">Верхняя челюсть</text>` +
    `<text class="tm-jaw-label" x="256" y="504" text-anchor="middle">Нижняя челюсть</text>` +
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
