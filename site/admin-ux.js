/* ═══════════ Админ-панель: слой удобства ═══════════
   Подключается ДО admin.js и ничего в нём не правит — только добавляет:
     • всплывающие уведомления вместо строчки «✓ Сохранено» в углу формы;
     • панель публикации: сколько правок ещё не выгружено, кнопка «Скачать
       db.json» и пошаговая подсказка — на каждой вкладке, а не только в ценах;
     • защита от потери правок: точка на вкладке с несохранённой формой и
       вопрос браузера при закрытии;
     • Ctrl/⌘+S сохраняет форму открытой вкладки;
     • лента вкладок на телефоне подсказывает, что её можно листать;
     • пустые списки говорят, что делать, а не молчат. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var UNPUB = "chestom_unpublished";

  /* ── Счётчик невыгруженных правок: оборачиваем ChestomDB.save ──
     admin.js зовёт save при каждом сохранении; мы считаем вызовы, а кнопка
     «Скачать db.json» обнуляет счётчик — человек видит, есть ли что
     публиковать, не вспоминая. */
  try {
    var origSave = ChestomDB.save;
    ChestomDB.save = function (db) {
      var r = origSave.apply(this, arguments);
      try { localStorage.setItem(UNPUB, String((+localStorage.getItem(UNPUB) || 0) + 1)); } catch (e) {}
      renderPublish();
      return r;
    };
  } catch (e) {}

  /* ── Уведомления ── */
  var toastBox;
  function toast(text, kind) {
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.className = "adm-toasts";
      toastBox.setAttribute("aria-live", "polite");
      document.body.appendChild(toastBox);
    }
    var t = document.createElement("div");
    t.className = "adm-toast" + (kind ? " adm-toast--" + kind : "");
    t.textContent = text;
    toastBox.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("is-on"); });
    setTimeout(function () {
      t.classList.remove("is-on");
      setTimeout(function () { t.remove(); }, 350);
    }, 3200);
  }
  window.ChestomToast = toast;

  document.addEventListener("DOMContentLoaded", function () {
    var main = $(".adm-main");
    if (!main) return;
    var isAdmin = !$("body").classList.contains("is-doctor") && !!$("#panel-prices");

    /* ── Панель публикации ── */
    var bar = document.createElement("section");
    bar.className = "adm-publish";
    bar.innerHTML =
      '<div class="adm-publish__row">' +
        '<span class="adm-publish__dot" aria-hidden="true"></span>' +
        '<div class="adm-publish__text"><b id="pubState"></b><small id="pubSub"></small></div>' +
        '<a class="btn btn--ghost btn--sm" id="pubView" href="index.html" target="_blank" rel="noopener">Посмотреть на сайте</a>' +
        '<button type="button" class="btn btn--primary btn--sm" id="pubExport">⬇ Скачать db.json</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" id="pubHow" aria-expanded="false">Как опубликовать</button>' +
      '</div>' +
      '<ol class="adm-publish__steps" id="pubSteps" hidden>' +
        '<li>Нажмите <b>«Скачать db.json»</b> — файл сохранится в «Загрузки».</li>' +
        '<li>Положите его вместо <code>site/db.json</code> в папке проекта.</li>' +
        '<li>Запустите <b>«Опубликовать.command»</b> — через 1–2 минуты сайт обновится у всех.</li>' +
      '</ol>';
    var head = $(".adm-head");
    head.parentNode.insertBefore(bar, head.nextSibling);
    if (!isAdmin) bar.classList.add("adm-publish--doctor");

    var VIEW = { prices: "index.html#services", services: "index.html#services", doctors: "index.html#team",
                 blog: "index.html#news", promos: "index.html#promo", banners: "index.html", accounts: "index.html", ct: "index.html" };

    function renderPublish() {
      var n = +(function () { try { return localStorage.getItem(UNPUB); } catch (e) { return 0; } })() || 0;
      var st = $("#pubState"), sub = $("#pubSub");
      if (!st) return;
      bar.classList.toggle("is-dirty", n > 0);
      st.textContent = n ? "Не выгружено: " + n + " " + plural(n, "правка", "правки", "правок") : "Все правки выгружены";
      sub.textContent = n ? "Они видны только в этом браузере — скачайте db.json и опубликуйте"
                          : "Сохранения считаются здесь; после «Скачать db.json» счётчик обнулится";
    }
    window.renderPublish = renderPublish;
    renderPublish();

    $("#pubExport").addEventListener("click", function () {
      var orig = $("#dbExport");
      if (orig) orig.click(); else toast("Экспорт недоступен в этой роли", "warn");
      try { localStorage.setItem(UNPUB, "0"); } catch (e) {}
      renderPublish();
      toast("db.json скачан — теперь замените файл в проекте и запустите «Опубликовать.command»");
    });
    $("#pubHow").addEventListener("click", function () {
      var steps = $("#pubSteps"), open = steps.hidden;
      steps.hidden = !open;
      this.setAttribute("aria-expanded", String(open));
    });

    /* ── «Посмотреть на сайте» ведёт в раздел открытой вкладки ── */
    function activeTab() { var t = $(".adm__tab.is-active"); return t ? t.dataset.tab : "prices"; }
    function syncView() { var a = $("#pubView"); if (a) a.href = VIEW[activeTab()] || "index.html"; }
    $$(".adm__tab").forEach(function (t) { t.addEventListener("click", function () { setTimeout(syncView, 0); markNav(); }); });
    syncView();

    /* ── Уведомление, когда admin.js показывает «✓ Сохранено» ── */
    $$(".adm__saved").forEach(function (el) {
      new MutationObserver(function () {
        if (!el.hidden) toast(el.textContent.replace(/^✓\s*/, "✓ "));
      }).observe(el, { attributes: true, attributeFilter: ["hidden"] });
    });

    /* ── Несохранённые правки ── */
    var dirty = {};
    function panelOf(el) { var p = el.closest(".adm__panel"); return p ? p.id.replace("panel-", "") : null; }
    function markNav() {
      $$(".adm__tab").forEach(function (t) {
        t.classList.toggle("is-dirty", !!dirty[t.dataset.tab]);
      });
    }
    document.addEventListener("input", function (e) {
      var form = e.target.closest("form.adm-card");
      if (!form || e.target.type === "file") return;
      var id = panelOf(form); if (!id) return;
      if (!dirty[id]) { dirty[id] = true; markNav(); }
    });
    document.addEventListener("submit", function (e) {
      var form = e.target.closest("form.adm-card");
      if (!form) return;
      var id = panelOf(form); if (id && dirty[id]) { delete dirty[id]; markNav(); }
    }, true);
    window.addEventListener("beforeunload", function (e) {
      if (Object.keys(dirty).length) { e.preventDefault(); e.returnValue = ""; }
    });

    /* ── Ctrl/⌘+S — сохранить открытую вкладку ── */
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        var panel = $(".adm__panel.is-active"); if (!panel) return;
        var form = panel.querySelector("form.adm-card"); if (!form) return;
        e.preventDefault();
        if (form.requestSubmit) form.requestSubmit(); else form.submit();
      }
    });

    /* ── Лента вкладок на телефоне: тени по краям, пока есть куда листать ── */
    var nav = $(".adm-side__nav");
    function shade() {
      if (!nav) return;
      var max = nav.scrollWidth - nav.clientWidth;
      nav.classList.toggle("can-left", nav.scrollLeft > 4);
      nav.classList.toggle("can-right", max - nav.scrollLeft > 4);
    }
    if (nav) {
      nav.addEventListener("scroll", shade, { passive: true });
      window.addEventListener("resize", shade);
      shade();
    }

    /* ── Пустые списки ── */
    var EMPTY = {
      doctorsList: "Врачей пока нет — нажмите «+ Добавить врача».",
      svcList: "Карточек услуг нет — нажмите «+ Добавить услугу».",
      promoList: "Акций нет — нажмите «+ Добавить акцию». Пока список пуст, раздел «Акции» на сайте скрыт.",
      postList: "Постов пока нет — первый появится после «Опубликовать» слева.",
      accountList: "Аккаунтов врачей нет — создайте первый в форме выше."
    };
    Object.keys(EMPTY).forEach(function (id) {
      var box = document.getElementById(id); if (!box) return;
      var check = function () {
        var has = box.children.length && !box.querySelector(".adm-empty");
        var e = box.querySelector(".adm-empty");
        if (!box.children.length) {
          if (!e) { e = document.createElement("p"); e.className = "adm-empty"; e.textContent = EMPTY[id]; box.appendChild(e); }
        } else if (e && box.children.length > 1) e.remove();
      };
      new MutationObserver(check).observe(box, { childList: true });
      check();
    });

    function plural(n, a, b, c) {
      var m = n % 100, d = n % 10;
      if (m > 10 && m < 20) return c;
      if (d === 1) return a;
      if (d > 1 && d < 5) return b;
      return c;
    }
  });
})();
