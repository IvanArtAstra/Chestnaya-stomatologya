/* Бейдж «Открыто сейчас» — пермское время (Asia/Yekaterinburg, UTC+5) */
(function () {
  "use strict";

  var OPEN_H = 10;
  var CLOSE_H = 20;

  function permMinutes() {
    try {
      var parts = new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Asia/Yekaterinburg",
        hour: "numeric",
        minute: "numeric",
        hour12: false
      }).formatToParts(new Date());
      var h = 0, m = 0;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "hour") h = parseInt(parts[i].value, 10);
        if (parts[i].type === "minute") m = parseInt(parts[i].value, 10);
      }
      if (h === 24) h = 0;
      return h * 60 + m;
    } catch (e) {
      return null;
    }
  }

  function makeBadge() {
    var badge = document.createElement("a");
    badge.className = "open-badge";
    badge.href = "#contacts";
    badge.id = "openBadge";

    var dot = document.createElement("span");
    dot.className = "open-badge__dot";
    dot.setAttribute("aria-hidden", "true");

    var text = document.createElement("span");
    text.className = "open-badge__text";

    badge.appendChild(dot);
    badge.appendChild(text);
    return badge;
  }

  function update(badge) {
    var mins = permMinutes();
    var text = badge.querySelector(".open-badge__text");
    var label;
    if (mins === null) {
      label = "Ежедневно 10:00–20:00";
      badge.classList.remove("is-closed");
    } else if (mins >= OPEN_H * 60 && mins < CLOSE_H * 60) {
      label = "Открыто до 20:00";
      badge.classList.remove("is-closed");
    } else {
      label = "Откроемся в 10:00";
      badge.classList.add("is-closed");
    }
    text.textContent = label;
    badge.setAttribute("aria-label", label + ". Контакты клиники");
    badge.title = label;
  }

  function init() {
    var nav = document.getElementById("nav");
    if (!nav) return;
    var logo = nav.querySelector(".nav__logo");
    if (!logo || document.getElementById("openBadge")) return;

    var badge = makeBadge();
    update(badge);
    logo.insertAdjacentElement("afterend", badge);

    setInterval(function () { update(badge); }, 60000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
