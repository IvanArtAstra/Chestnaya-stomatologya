/* Версия для слабовидящих: крупный шрифт + высокий контраст.
   Класс .bvi на <html> (раннее применение — в head-скрипте страниц),
   здесь только кнопка-переключатель в шапке. */
(function () {
  "use strict";
  var KEY = "chestom_bvi";

  function isOn() {
    return document.documentElement.classList.contains("bvi");
  }

  function makeBtn() {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "theme-btn a11y-btn";
    b.id = "a11yBtn";
    b.setAttribute("aria-label", "Версия для слабовидящих");
    b.setAttribute("aria-pressed", isOn() ? "true" : "false");
    b.title = "Версия для слабовидящих";
    b.innerHTML =
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/>' +
      '<circle cx="12" cy="12" r="3"/></svg>';
    b.addEventListener("click", function () {
      var now = !isOn();
      document.documentElement.classList.toggle("bvi", now);
      b.setAttribute("aria-pressed", now ? "true" : "false");
      try { localStorage.setItem(KEY, now ? "1" : "0"); } catch (e) {}
    });
    return b;
  }

  function init() {
    if (document.getElementById("a11yBtn")) return;
    var actions = document.querySelector(".nav__actions");
    if (!actions) return;
    actions.insertBefore(makeBtn(), actions.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
