/* ═══════════ Страница услуги: рендер из services-data.js ═══════════ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = MD.esc;

  /* тема */
  const themeBtn = $("#themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("chestom_theme", next); } catch (e) {}
  });

  const svc = SERVICES[window.SERVICE_ID];
  if (!svc) return;
  const db = ChestomDB.load();
  const price = db.prices[svc.priceKey] || svc.price;

  $("#svcH1").textContent = svc.h1;
  $("#svcIntro").textContent = svc.intro;
  $("#svcPrice").textContent = price;
  $("#svcDuration").textContent = svc.duration;
  $("#svcIcon").innerHTML = `<svg class="icon icon--xl"><use href="#${svc.icon}"/></svg>`;
  $("#svcIncludes").innerHTML = svc.includes.map((i) => `<li>${esc(i)}</li>`).join("");
  $("#svcFaq").innerHTML = svc.faq.map((f) => `
    <details class="faq">
      <summary>${esc(f.q)}</summary>
      <p>${esc(f.a)}</p>
    </details>`).join("");

  /* другие услуги */
  $("#svcOthers").innerHTML = Object.entries(SERVICES)
    .filter(([id]) => id !== window.SERVICE_ID)
    .map(([id, s]) => `<a class="svc-mini" href="${id}.html">
      <svg class="icon"><use href="#${s.icon}"/></svg><span>${esc(s.name)}</span>
      <b>${esc(db.prices[s.priceKey] || s.price)}</b>
    </a>`).join("");

  /* модалка записи */
  const modal = $("#bookingModal");
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-booking]")) {
      $("#modalContext").textContent = `Услуга: ${svc.name}`;
      modal.hidden = false;
      document.body.style.overflow = "hidden";
      $("input", modal).focus();
    }
    if (e.target.closest("[data-close-modal]")) {
      modal.hidden = true;
      document.body.style.overflow = "";
    }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) { modal.hidden = true; document.body.style.overflow = ""; }
  });
  $("#modalBooking").addEventListener("submit", (e) => {
    e.preventDefault();
    $$("input, button", e.target).forEach((el) => (el.disabled = true));
    $(".booking-form__ok", e.target).hidden = false;
  });
})();
