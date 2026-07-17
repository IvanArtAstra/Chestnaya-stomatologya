/* ═══════════ Общие UX-механики: маска телефона, scrollspy, «наверх» ═══════════ */
(() => {
  "use strict";

  /* ── маска телефона +7 999 999-99-99 ── */
  const maskPhone = (raw) => {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (d && !d.startsWith("7")) d = "7" + d;
    d = d.slice(0, 11);
    if (!d) return "";
    let out = "+7";
    if (d.length > 1) out += " " + d.slice(1, 4);
    if (d.length > 4) out += " " + d.slice(4, 7);
    if (d.length > 7) out += "-" + d.slice(7, 9);
    if (d.length > 9) out += "-" + d.slice(9, 11);
    return out;
  };
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.matches && el.matches('input[type="tel"]')) {
      const v = maskPhone(el.value);
      if (el.value !== v) el.value = v;
    }
  });

  /* ── кнопка «наверх» ── */
  const toTop = document.createElement("button");
  toTop.className = "to-top";
  toTop.setAttribute("aria-label", "Наверх");
  toTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19.5v-15M6 10l6-5.8L18 10"/></svg>';
  document.body.appendChild(toTop);
  toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  const onScrollTop = () => toTop.classList.toggle("is-visible", scrollY > 700);
  addEventListener("scroll", onScrollTop, { passive: true });
  onScrollTop();

  /* ── подсветка активного пункта меню (scrollspy) ── */
  const links = [...document.querySelectorAll('.nav__links a[href^="#"]')];
  if (links.length) {
    const map = new Map();
    links.forEach((a) => {
      const sec = document.querySelector(a.getAttribute("href"));
      if (sec) map.set(sec, a);
    });
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((a) => a.classList.remove("is-current"));
          const link = map.get(en.target);
          if (link) link.classList.add("is-current");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    map.forEach((_, sec) => spy.observe(sec));
  }
})();
