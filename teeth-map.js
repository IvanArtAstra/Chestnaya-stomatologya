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
    { id: "pulpitis",    key: "tm.p.pulp" },
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

  /* «4 000–4 500 ₽» → [4000, 4500]; «10 440 ₽» → [10440, 10440].
     Обе границы берём из самого прайса: домножать нижнюю на коэффициент
     значило бы показывать пациенту цену, которой в прайсе нет. */
  const parseRange = (str) => {
    const nums = String(str || "").replace(/[^0-9–—-]/g, "").match(/\d+/g) || [];
    if (!nums.length) return [0, 0];
    const a = parseInt(nums[0], 10);
    const b = nums.length > 1 ? parseInt(nums[1], 10) : a;
    return [Math.min(a, b), Math.max(a, b)];
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
/* ── Вводный экран: сомкнутая челюсть + кнопка расчёта ── */
.tm-fold { max-width: 1080px; margin: 26px auto 0; }
.tm-intro {
  display: flex; align-items: center; gap: clamp(20px, 4vw, 48px); flex-wrap: wrap;
  border-radius: var(--radius, 22px); border: 1px solid var(--card-line);
  background: var(--card); padding: clamp(22px, 3.4vw, 40px) clamp(24px, 4vw, 46px);
}
.tm-intro__pic {
  flex: none; width: clamp(190px, 30vw, 300px); height: auto; border-radius: 20px;
  background: #ececee; box-shadow: 0 14px 40px rgba(var(--shade-rgb), 0.16);
  transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.35s;
}
.tm-intro__text { display: flex; flex-direction: column; gap: 10px; min-width: 240px; flex: 1; align-items: flex-start; }
.tm-intro__text b {
  font-family: var(--font-display); font-weight: 700;
  font-size: clamp(1.25rem, 2.6vw, 1.75rem); letter-spacing: -0.01em; color: var(--ink);
}
.tm-intro__text > span { color: var(--ink-dim); font-size: 0.96rem; line-height: 1.55; }
.tm-intro__btn {
  margin-top: 6px; padding: 14px 28px; border-radius: 999px; border: none; cursor: pointer;
  font-family: inherit; font-weight: 700; font-size: 0.96rem; color: #fff;
  background: linear-gradient(120deg, var(--aqua), var(--cyan));
  box-shadow: 0 8px 24px rgba(var(--acc-rgb), 0.32);
  transition: transform 0.2s, box-shadow 0.2s;
}
.tm-intro__btn:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(var(--acc-rgb), 0.4); }
.tm-intro__btn:focus-visible { outline: 2px solid var(--aqua); outline-offset: 3px; }

/* раскрытие: сомкнутые челюсти расходятся и уступают место схеме */
.tm-fold.is-open .tm-intro { display: none; }
.tm-fold.is-opening .tm-intro__pic { transform: scale(1.12); opacity: 0; }

.tm-collapse {
  margin-top: 16px; padding: 11px 22px; border-radius: 999px; cursor: pointer;
  font-family: inherit; font-weight: 700; font-size: 0.9rem;
  color: var(--aqua); background: none; border: 1.5px solid var(--card-line);
  transition: border-color 0.2s;
}
.tm-collapse:hover { border-color: var(--aqua); }
.tm-collapse:focus-visible { outline: 2px solid var(--aqua); outline-offset: 3px; }
.tm-fold:not(.is-open) .tm-card, .tm-fold:not(.is-open) .tm-collapse { display: none; }

.tm-card {
  border-radius: var(--radius, 22px);
  background: var(--card); border: 1px solid var(--card-line);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  padding: clamp(24px, 4vw, 44px);
  animation: tmFoldIn 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
}
@keyframes tmFoldIn { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
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
.tm-row[aria-pressed="true"] { border-color: var(--aqua); background: rgba(var(--acc-rgb), 0.1); color: var(--aqua); }

/* Зона выбора поверх зуба на снимке: прозрачная, подсвечивается по наведению
   и заливается фирменным цветом, когда зуб отмечен. */
.tm-tooth { cursor: pointer; outline: none; }
.tm-pick {
  fill: transparent; stroke: transparent; stroke-width: 2;
  transition: fill 0.18s, stroke 0.18s;
}
.tm-tooth:hover .tm-pick,
.tm-tooth:focus-visible .tm-pick {
  fill: rgba(var(--acc-rgb), 0.22); stroke: var(--aqua);
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
  border-radius: 18px; padding: 24px; background: rgba(var(--shade-rgb), 0.4);
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

/* ── Заявка прямо под сметой ── */
.tm-lead { display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 6px; }
.tm-lead[hidden] { display: none; }
.tm-lead label { display: flex; flex-direction: column; gap: 6px; }
.tm-lead label span { font-size: 0.82rem; font-weight: 700; color: var(--ink-dim); }
.tm-lead input {
  width: 100%; padding: 12px 16px; border-radius: 14px;
  font: inherit; font-size: 0.95rem; color: var(--ink);
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid var(--card-line); transition: border-color 0.22s, background 0.22s;
}
.tm-lead input::placeholder { color: var(--ink-dim); opacity: 0.7; }
.tm-lead input:focus { outline: none; border-color: var(--aqua); background: rgba(255, 255, 255, 0.08); }
.tm-lead input:disabled { opacity: 0.6; }
.tm-lead__legal { color: var(--ink-dim); font-size: 0.74rem; line-height: 1.5; }
.tm-lead__ok {
  padding: 12px 16px; border-radius: 14px; font-weight: 700; font-size: 0.9rem;
  color: var(--aqua); background: rgba(var(--acc-rgb), 0.12);
  border: 1px solid rgba(var(--acc-rgb), 0.24);
}
.tm-lead__ok[hidden] { display: none; }
/* iOS зумит страницу, если шрифт поля меньше 16 px */
@media (max-width: 860px) { .tm-lead input { font-size: 16px; } }

/* цвет контура — фирменный индиго (прежний бирюзовый остался от старой палитры) */
:root[data-theme="light"] .tm-summary { background: rgba(255, 255, 255, 0.7); }

@media (max-width: 860px) {
  .tm-grid { grid-template-columns: 1fr; }
  .tm-summary { position: static; }
}
/* На телефоне зуб на схеме получался 19 px — пальцем не попасть.
   Отдаём схеме всю ширину карточки: зуб вырастает примерно до 25 px.
   Больше сделать нельзя — соседние зубы стоят в 37 единицах друг от
   друга, и зоны выбора начали бы перекрываться. */
@media (max-width: 560px) {
  .tm-card { padding: 20px 14px; }
  .tm-scheme { margin: 0 -6px; }
  .tm-row { padding: 11px 16px; }
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
    `<image x="0" y="0" width="512" height="512"></image>` +
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

  /* Раздел открыт сразу: сначала — сомкнутые челюсти и кнопка расчёта,
     по нажатию челюсть «раскрывается» в схему с выбором зубов.
     Тяжёлый снимок схемы грузим лениво, до раскрытия он не нужен. */
  host.innerHTML =
    `<div class="tm-fold">` +
    `<div class="tm-intro">` +
    `<img class="tm-intro__pic" src="jaws-closed.jpg" alt="" width="1024" height="1024" loading="lazy" decoding="async">` +
    `<div class="tm-intro__text">` +
    `<b data-i18n="tm.title">${t("tm.title")}</b>` +
    `<span data-i18n="tm.sub">${t("tm.sub")}</span>` +
    `<button class="tm-intro__btn" type="button" id="tmOpen" data-i18n="tm.open">${t("tm.open")}</button>` +
    `</div>` +
    `</div>` +
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
    /* Заявка собирается прямо здесь, а не в модалке: человек уже отметил
       зубы и увидел сумму — уводить его в отдельное окно значит терять
       половину. Выбранные зубы и смета уезжают вместе с заявкой. */
    `<form class="tm-lead" id="tmLead" hidden novalidate>` +
    `<label><span data-i18n="form.name">${t("form.name")}</span>` +
    `<input type="text" name="name" autocomplete="name" data-ph="ph.name" placeholder="${t("ph.name")}" required></label>` +
    `<label><span data-i18n="form.phone">${t("form.phone")}</span>` +
    `<input type="tel" name="phone" autocomplete="tel" data-ph="ph.phone" placeholder="${t("ph.phone")}" required></label>` +
    `<input type="hidden" name="request" id="tmRequest">` +
    `<div class="tm-actions">` +
    `<button class="btn btn--primary" type="submit" data-i18n="tm.send">${t("tm.send")}</button>` +
    `<button class="btn btn--ghost" id="tmReset" type="button" data-i18n="tm.reset">${t("tm.reset")}</button>` +
    `</div>` +
    `<small class="tm-lead__legal" data-i18n="tm.legal">${t("tm.legal")}</small>` +
    `<div class="tm-lead__ok" role="status" aria-live="polite" hidden data-i18n="form.ok">${t("form.ok")}</div>` +
    `</form>` +
    `<span class="tm-summary__note" data-i18n="tm.note">${t("tm.note")}</span>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `<button class="tm-collapse" type="button" id="tmCollapse" data-i18n="tm.close">${t("tm.close")}</button>` +
    `</div>`;

  /* ── Раскрытие / сворачивание ───────────────────────── */
  const fold = host.querySelector(".tm-fold");
  const openBtn = host.querySelector("#tmOpen");
  const collapseBtn = host.querySelector("#tmCollapse");
  const jawImg = host.querySelector(".tm-scheme image");

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  openBtn.addEventListener("click", () => {
    /* схему подставляем в момент раскрытия — до него файл не грузится */
    if (jawImg && !jawImg.getAttribute("href")) jawImg.setAttribute("href", "jaws.jpg");
    if (reduced) { fold.classList.add("is-open"); return; }
    fold.classList.add("is-opening");
    setTimeout(() => {
      fold.classList.remove("is-opening");
      fold.classList.add("is-open");
      host.querySelector(".tm-row")?.focus();
    }, 320);
  });
  collapseBtn.addEventListener("click", () => {
    fold.classList.remove("is-open");
    openBtn.focus();
  });

  /* ── Логика ─────────────────────────────────────────── */
  const teeth = Array.from(host.querySelectorAll(".tm-tooth"));
  const countEl = host.querySelector("#tmCount");
  const sumEl = host.querySelector("#tmSum");
  const hintEl = host.querySelector("#tmHint");
  const leadForm = host.querySelector("#tmLead");
  const requestEl = host.querySelector("#tmRequest");
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
      leadForm.hidden = true;
      hintEl.hidden = false;
      return;
    }
    const [min, max] = parseRange(prices[pid]);
    const low = roundH(min * n);
    const high = roundH(max * n);
    sumEl.textContent = low === high
      ? `${t("tm.approx")} ${fmt(low)} ₽`
      : `${t("tm.approx")} ${fmt(low)} – ${fmt(high)} ₽`;
    sumEl.hidden = false;
    hintEl.hidden = true;
    leadForm.hidden = false;
    requestEl.value =
      `${n} ${plural(n)}, ${problemLabel(pid)}, ${sumEl.textContent}`;
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

  /* Отправка — демо, как и у остальных форм сайта: на проде здесь
     будет запрос к API или Telegram-боту. */
  leadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = leadForm.elements.name;
    const phone = leadForm.elements.phone;
    if (!name.value.trim() || !phone.value.trim()) {
      (name.value.trim() ? phone : name).focus();
      return;
    }
    Array.from(leadForm.querySelectorAll("input, button")).forEach((el) => (el.disabled = true));
    leadForm.querySelector(".tm-lead__ok").hidden = false;
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
