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
    { id: "caries",      key: "tm.p.caries" },
    { id: "prosthetics", key: "tm.p.prosth" },
    { id: "extraction",  key: "tm.p.extract" },
    { id: "restore",     key: "tm.p.restore" }
  ];

  /* Текущий перевод по ключу. i18n.js объявляет I18N через const —
     это лексическая привязка, не свойство window, поэтому typeof. */
  const lang = () => {
    try { return localStorage.getItem("chestom_lang") || "ru"; } catch (e) { return "ru"; }
  };
  const t = (key, fallback) => {
    try {
      if (typeof I18N !== "undefined" && I18N[key]) return I18N[key][lang()] || I18N[key].ru;
    } catch (e) { /* noop */ }
    return fallback || "";
  };

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
    if (lang() !== "ru") return lang() === "en" ? (n === 1 ? "tooth" : "teeth") : "سن";
    const d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return "зуб";
    if (d >= 2 && d <= 4 && (h < 10 || h > 20)) return "зуба";
    return "зубов";
  };

  /* ── Стили ──────────────────────────────────────────── */
  const css = `
/* ── Свёрнутый блок ── */
.tm-fold { max-width: 1080px; margin: 26px auto 0; }
.tm-fold__head {
  display: flex; align-items: center; gap: clamp(18px, 3vw, 34px);
  flex-wrap: wrap; cursor: pointer; list-style: none;
  border-radius: var(--radius, 22px); border: 1px solid var(--card-line);
  background: var(--card); padding: clamp(20px, 3vw, 30px) clamp(22px, 3.5vw, 38px);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.tm-fold__head::-webkit-details-marker { display: none; }
.tm-fold__head:hover { border-color: var(--aqua); box-shadow: 0 10px 34px rgba(66, 57, 184, 0.14); }
.tm-fold__head:focus-visible { outline: 2px solid var(--aqua); outline-offset: 3px; }
.tm-fold__text { display: flex; flex-direction: column; gap: 8px; min-width: 0; flex: 1; align-items: flex-start; }
/* превью челюсти: видно, что откроется, ещё до раскрытия */
.tm-fold__preview {
  flex: none; width: clamp(96px, 15vw, 140px); height: auto; border-radius: 16px;
  background: #ececee; box-shadow: 0 8px 26px rgba(23, 18, 62, 0.12);
  transition: transform 0.25s;
}
.tm-fold__head:hover .tm-fold__preview { transform: scale(1.04); }
.tm-fold[open] .tm-fold__preview { display: none; }
.tm-fold__text b {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(1.2rem, 2.4vw, 1.65rem); letter-spacing: -0.01em; color: var(--ink);
}
.tm-fold__text > span:not(.tm-fold__btn) { color: var(--ink-dim); font-size: 0.94rem; line-height: 1.55; }
.tm-fold__btn {
  margin-top: 4px; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 0.94rem;
  background: linear-gradient(120deg, var(--aqua), var(--cyan));
  box-shadow: 0 8px 24px rgba(66, 57, 184, 0.32);
}
.tm-fold__btn, .tm-fold__btn span { color: #fff; }
.tm-fold__close { display: none; }
.tm-fold[open] .tm-fold__open { display: none; }
.tm-fold[open] .tm-fold__close { display: inline; }
.tm-fold[open] .tm-fold__head {
  border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom-color: transparent;
}
.tm-fold[open] .tm-fold__btn,
.tm-fold[open] .tm-fold__btn span { color: var(--aqua); }
.tm-fold[open] .tm-fold__btn { background: none; box-shadow: none; border: 1.5px solid var(--card-line); }

.tm-card {
  border-radius: var(--radius, 22px); border-top-left-radius: 0; border-top-right-radius: 0;
  background: var(--card); border: 1px solid var(--card-line); border-top: none;
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  padding: clamp(24px, 4vw, 44px);
  animation: tmFoldIn 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
}
@keyframes tmFoldIn { from { opacity: 0; transform: translateY(-8px); } }
@media (prefers-reduced-motion: reduce) { .tm-card { animation: none; } }
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
    const key = d < 1 ? "tm.t.central" : d < 2 ? "tm.t.lateral"
              : d < 3 ? "tm.t.canine" : d < 5 ? "tm.t.premolar" : "tm.t.molar";
    return t(key);
  };

  const buildJaw = (upper) => {
    const key = upper ? "u" : "l";
    let out = "";
    POS[key].forEach(([x, y], i) => {
      const num = i + 1;
      const side = t(i < TEETH / 2 ? "tm.side.r" : "tm.side.l");
      const label = `${nameByIndex(i)}, ${t(upper ? "tm.jawU" : "tm.jawL")}, ${side}`;
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
    `<text class="tm-jaw-label" x="256" y="14" text-anchor="middle" data-i18n="tm.jawU">${t("tm.jawU")}</text>` +
    `<text class="tm-jaw-label" x="256" y="504" text-anchor="middle" data-i18n="tm.jawL">${t("tm.jawL")}</text>` +
    buildJaw(true) + buildJaw(false) +
    `</svg>`;

  /* ── Разметка карточки ─────────────────────────────── */
  const chips = PROBLEMS.map(
    (p, i) =>
      `<label><input type="radio" name="tmProblem" value="${p.id}"${i === 0 ? " checked" : ""}>` +
      `<span data-i18n="${p.key}">${t(p.key)}</span></label>`
  ).join("");

  /* Блок свёрнут: снимок челюстей крупный, поэтому раскрывается по кнопке.
     <details> выбран намеренно — раскрытие работает и без JS, а браузер
     не грузит изображение, пока блок закрыт. */
  host.innerHTML =
    `<details class="tm-fold">` +
    `<summary class="tm-fold__head">` +
    `<img class="tm-fold__preview" src="jaws.jpg" alt="" width="1024" height="1024" loading="lazy">` +
    `<span class="tm-fold__text">` +
    `<b data-i18n="tm.title">${t("tm.title")}</b>` +
    `<span data-i18n="tm.sub">${t("tm.sub")}</span>` +
    `<span class="tm-fold__btn">` +
    `<span class="tm-fold__open" data-i18n="tm.open">${t("tm.open")}</span>` +
    `<span class="tm-fold__close" data-i18n="tm.close">${t("tm.close")}</span>` +
    `</span>` +
    `</span>` +
    `</summary>` +
    `<div class="tm-card">` +
    `<div class="tm-grid">` +
    `<div class="tm-scheme">` +
    `<div class="tm-rows">` +
    `<button class="tm-row" type="button" data-row="u" aria-pressed="false" data-i18n="tm.rowU">${t("tm.rowU")}</button>` +
    `<button class="tm-row" type="button" data-row="l" aria-pressed="false" data-i18n="tm.rowL">${t("tm.rowL")}</button>` +
    `</div>` +
    `${svg}` +
    `<div class="tm-chips" role="radiogroup" data-i18n-aria="tm.problem" aria-label="${t('tm.problem')}">${chips}</div>` +
    `</div>` +
    `<div class="tm-summary" aria-live="polite">` +
    `<span class="tm-summary__count" id="tmCount">${t("tm.count")} 0</span>` +
    `<b class="tm-summary__sum" id="tmSum" hidden></b>` +
    `<span class="tm-summary__hint" id="tmHint" data-i18n="tm.hint">${t("tm.hint")}</span>` +
    `<div class="tm-actions">` +
    `<button class="btn btn--primary" id="tmBook" data-open-booking hidden data-i18n="tm.book">${t("tm.book")}</button>` +
    `<button class="btn btn--ghost" id="tmReset" type="button" hidden data-i18n="tm.reset">${t("tm.reset")}</button>` +
    `</div>` +
    `<span class="tm-summary__note" data-i18n="tm.note">${t("tm.note")}</span>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `</details>`;

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
    t((PROBLEMS.find((p) => p.id === id) || PROBLEMS[0]).key);

  const render = () => {
    const n = selected.size;
    const pid = problem();
    countEl.textContent = `${t("tm.count")} ${n}`;
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
    sumEl.textContent = `${t("tm.approx")} ${fmt(low)} – ${fmt(high)} ₽`;
    sumEl.hidden = false;
    hintEl.hidden = true;
    bookBtn.hidden = false;
    resetBtn.hidden = false;
    bookBtn.dataset.service = `${t("tm.title")}: ${n} ${plural(n)}, ${problemLabel(pid)}`;
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

  /* app.js переводит всё, что помечено data-i18n; строки, собранные здесь
     (подсказки зубов, счётчик, смета), обновляем сами */
  document.addEventListener("chestom:lang", () => {
    teeth.forEach((g) => {
      const upper = g.dataset.row === "u";
      const i = +g.dataset.tooth.slice(1) - 1;
      const side = t(i < TEETH / 2 ? "tm.side.r" : "tm.side.l");
      const label = `${nameByIndex(i)}, ${t(upper ? "tm.jawU" : "tm.jawL")}, ${side}`;
      g.setAttribute("aria-label", label);
      const ttl = g.querySelector("title");
      if (ttl) ttl.textContent = label;
    });
    render();
  });
})();
