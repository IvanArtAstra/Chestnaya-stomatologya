/* ═══════════ Личная страница врача ═══════════ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = MD.esc;

  /* ── тема ── */
  const themeBtn = $("#themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("chestom_theme", next); } catch (e) {}
  });

  const db = ChestomDB.load();
  const id = new URLSearchParams(location.search).get("id");
  const doc = ChestomDB.doctorById(db, id) || db.doctors[0];

  const fmtDate = (iso) => {
    try {
      return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
    } catch (e) { return iso; }
  };

  /* ── профиль ── */
  document.title = `${doc.name} — Честная стоматология, Пермь`;
  const ava = $("#docAva");
  ava.textContent = ChestomDB.initials(doc.name);
  ava.style.setProperty("--hue", doc.hue || 190);
  $("#docName").textContent = doc.fullName || doc.name;
  $("#docRole").textContent = doc.role;
  $("#docDesc").textContent = doc.desc;
  $("#docBook").dataset.doctor = doc.name;

  /* ── отзывы ── */
  const reviews = ChestomDB.reviewsFor(db, doc.id);
  $("#docRevCount").textContent = reviews.length ? `· ${reviews.length}` : "";
  const stars = `<div class="review__stars" aria-label="5/5">${'<svg class="icon icon--star"><use href="#i-star"/></svg>'.repeat(5)}</div>`;
  $("#docReviews").innerHTML = reviews.length
    ? reviews.map((r) => `
      <blockquote class="review">
        ${stars}
        <p>«${esc(r.text)}»</p>
        <footer><b>${esc(r.author)}</b><span>${esc(r.source)} · ${fmtDate(r.date)}</span></footer>
      </blockquote>`).join("")
    : `<p class="dpage__empty">Отзывы об этом сотруднике появятся здесь — а пока читайте <a href="https://2gis.ru/perm/firm/70000001054392269/tab/reviews" target="_blank" rel="noopener" style="color:var(--aqua-soft);text-decoration:underline">все отзывы клиники на 2ГИС</a>.</p>`;

  /* ── публикации ── */
  const posts = ChestomDB.postsFor(db, doc.id);
  $("#docPosts").innerHTML = posts.length
    ? posts.map((n) => `
      <article class="post">
        <header class="post__head">
          <span class="post__ava">${ChestomDB.initials(n.author)}</span>
          <span class="post__meta"><b>${esc(n.author)}</b><span>${esc(n.role)} · ${fmtDate(n.date)}</span></span>
          <span class="post__tag">${esc(n.tag)}</span>
        </header>
        <h3>${MD.inlineHtml(n.title)}</h3>
        <div class="post__body">${MD.toHtml(n.text)}</div>
      </article>`).join("")
    : `<p class="dpage__empty">Врач пока не публиковал постов. Новые записи появятся в <a href="index.html#news" style="color:var(--aqua-soft);text-decoration:underline">ленте клиники</a>.</p>`;

  /* ── модалка записи ── */
  const modal = $("#bookingModal");
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-booking]");
    if (btn) {
      $("#modalContext").textContent = `Запись к специалисту: ${doc.name}`;
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
