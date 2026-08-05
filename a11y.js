/* Версия для слабовидящих по ГОСТ Р 52872-2019.
   Управление: размер шрифта, цветовая схема, интервалы, изображения, озвучивание.
   Состояние — в localStorage (chestom_a11y). Раннее применение — в head-скрипте страниц. */
(function () {
  "use strict";
  var KEY = "chestom_a11y";
  var DEF = { on: false, font: 1, scheme: "wb", spacing: 1, images: "on" };

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === "object") return Object.assign({}, DEF, s); } catch (e) {}
    try { if (localStorage.getItem("chestom_bvi") === "1") return Object.assign({}, DEF, { on: true }); } catch (e) {}
    return Object.assign({}, DEF);
  }
  var st = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function apply() {
    var r = document.documentElement;
    r.classList.toggle("bvi", !!st.on);
    r.setAttribute("data-a11y-font", st.font);
    r.setAttribute("data-a11y-scheme", st.scheme);
    r.setAttribute("data-a11y-spacing", st.spacing);
    r.setAttribute("data-a11y-images", st.images);
  }
  apply();

  /* ── Озвучивание (Web Speech API) ── */
  var synth = window.speechSynthesis || null;
  function stopSpeech() { if (synth) synth.cancel(); }
  function speakToggle(btn) {
    if (!synth) { btn.disabled = true; btn.textContent = "Озвучивание не поддерживается"; return; }
    if (synth.speaking) {
      stopSpeech();
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = "🔊 Озвучить страницу";
      return;
    }
    var main = document.querySelector("main") || document.body;
    var text = (main.innerText || "").replace(/\s+/g, " ").trim().slice(0, 9000);
    if (!text) return;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "ru-RU"; u.rate = 0.98;
    u.onend = u.onerror = function () {
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = "🔊 Озвучить страницу";
    };
    stopSpeech(); synth.speak(u);
    btn.setAttribute("aria-pressed", "true");
    btn.textContent = "⏹ Остановить озвучивание";
  }

  /* ── Панель ── */
  var panel;
  function refresh() {
    if (!panel) return;
    panel.querySelectorAll(".a11y-opt").forEach(function (b) {
      var k = b.dataset.k, v = b.dataset.v;
      b.setAttribute("aria-pressed", String(st[k]) === v ? "true" : "false");
    });
  }
  function set(k, v) {
    st[k] = (k === "font" || k === "spacing") ? parseInt(v, 10) : v;
    apply(); save(); refresh();
  }

  function buildPanel() {
    var p = document.createElement("div");
    p.className = "a11y-panel";
    p.id = "a11yPanel";
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", "Настройки версии для слабовидящих");
    p.innerHTML =
      '<h2>Версия для слабовидящих</h2>' +
      '<p class="a11y-panel__hint">Настройте отображение под себя. Параметры сохраняются на этом устройстве.</p>' +
      '<div class="a11y-group"><b>Размер шрифта</b><div class="a11y-opts">' +
        '<button class="a11y-opt" data-k="font" data-v="1" style="font-size:.9rem">А</button>' +
        '<button class="a11y-opt" data-k="font" data-v="2" style="font-size:1.1rem">А+</button>' +
        '<button class="a11y-opt" data-k="font" data-v="3" style="font-size:1.35rem">А++</button>' +
      '</div></div>' +
      '<div class="a11y-group"><b>Цветовая схема</b><div class="a11y-opts">' +
        '<button class="a11y-opt" data-k="scheme" data-v="wb"><span class="sw" style="background:#fff"></span>Ч/Б</button>' +
        '<button class="a11y-opt" data-k="scheme" data-v="bw"><span class="sw" style="background:#000"></span>Б/Ч</button>' +
        '<button class="a11y-opt" data-k="scheme" data-v="beige"><span class="sw" style="background:#f4ecd6"></span>Бежевая</button>' +
        '<button class="a11y-opt" data-k="scheme" data-v="blue"><span class="sw" style="background:#9dccff"></span>Голубая</button>' +
      '</div></div>' +
      '<div class="a11y-group"><b>Интервал</b><div class="a11y-opts">' +
        '<button class="a11y-opt" data-k="spacing" data-v="1">Обычный</button>' +
        '<button class="a11y-opt" data-k="spacing" data-v="2">Средний</button>' +
        '<button class="a11y-opt" data-k="spacing" data-v="3">Большой</button>' +
      '</div></div>' +
      '<div class="a11y-group"><b>Изображения</b><div class="a11y-opts">' +
        '<button class="a11y-opt" data-k="images" data-v="on">Показывать</button>' +
        '<button class="a11y-opt" data-k="images" data-v="off">Отключить</button>' +
      '</div></div>' +
      '<div class="a11y-group"><b>Озвучивание</b><div class="a11y-opts">' +
        '<button class="a11y-opt a11y-speak" type="button" aria-pressed="false" style="width:100%;justify-content:center">🔊 Озвучить страницу</button>' +
      '</div></div>' +
      '<button class="a11y-reset" type="button">Обычная версия сайта</button>';

    p.addEventListener("click", function (e) {
      var opt = e.target.closest(".a11y-opt");
      if (opt && opt.dataset.k) { set(opt.dataset.k, opt.dataset.v); return; }
      if (e.target.closest(".a11y-speak")) { speakToggle(e.target.closest(".a11y-speak")); return; }
      if (e.target.closest(".a11y-reset")) { disable(); return; }
    });
    return p;
  }

  var eyeBtn;
  function openPanel() {
    if (!st.on) { st.on = true; apply(); save(); }
    if (!panel) { panel = buildPanel(); document.body.appendChild(panel); }
    refresh();
    panel.classList.add("is-open");
    if (eyeBtn) eyeBtn.setAttribute("aria-expanded", "true");
    var first = panel.querySelector(".a11y-opt"); if (first) first.focus();
  }
  function closePanel() {
    if (panel) panel.classList.remove("is-open");
    if (eyeBtn) { eyeBtn.setAttribute("aria-expanded", "false"); eyeBtn.setAttribute("aria-pressed", st.on ? "true" : "false"); }
  }
  function disable() {
    st.on = false; apply(); save(); stopSpeech(); closePanel();
    if (eyeBtn) eyeBtn.focus();
  }

  function makeBtn() {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "theme-btn a11y-btn";
    b.id = "a11yBtn";
    b.setAttribute("aria-label", "Версия для слабовидящих");
    b.setAttribute("aria-haspopup", "dialog");
    b.setAttribute("aria-expanded", "false");
    b.setAttribute("aria-pressed", st.on ? "true" : "false");
    b.title = "Версия для слабовидящих";
    b.innerHTML =
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    b.addEventListener("click", function () {
      if (panel && panel.classList.contains("is-open")) closePanel();
      else openPanel();
    });
    return b;
  }

  function init() {
    if (document.getElementById("a11yBtn")) return;
    var actions = document.querySelector(".nav__actions");
    if (!actions) return;
    eyeBtn = makeBtn();
    actions.insertBefore(eyeBtn, actions.firstChild);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel && panel.classList.contains("is-open")) { closePanel(); eyeBtn.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (!panel || !panel.classList.contains("is-open")) return;
      if (panel.contains(e.target) || eyeBtn.contains(e.target)) return;
      closePanel();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
