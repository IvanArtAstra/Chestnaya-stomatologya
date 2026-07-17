/* ═══════════ Честная стоматология — интерактив ═══════════ */
(() => {
  "use strict";
  try {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ══════════ I18N ══════════ */
  const LANGS = ["ru", "en", "ar"];
  let lang = localStorage.getItem("chestom_lang");
  if (!LANGS.includes(lang)) lang = "ru";

  const applyLang = (code) => {
    lang = code;
    localStorage.setItem("chestom_lang", code);
    document.documentElement.lang = code;
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("is-rtl", code === "ar");
    $("#langCur").textContent = code.toUpperCase();
    $$("[data-i18n]").forEach((el) => {
      const t = I18N[el.dataset.i18n];
      if (t && t[code] != null) el.textContent = t[code];
    });
    $$("[data-i18n-html]").forEach((el) => {
      const t = I18N[el.dataset.i18nHtml];
      if (t && t[code] != null) el.innerHTML = t[code];
    });
    $$("[data-ph]").forEach((el) => {
      const t = PLACEHOLDERS[el.dataset.ph];
      if (t && t[code] != null) el.placeholder = t[code];
    });
    renderNews();
    renderDoctors();
    renderReviews();
  };

  /* ══════════ Тема (светлая/тёмная) ══════════ */
  const themeBtn = $("#themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("chestom_theme", next); } catch (e) {}
  });

  const langBox = $("#lang");
  $("#langBtn").addEventListener("click", (e) => { e.stopPropagation(); langBox.classList.toggle("is-open"); });
  $$("#langMenu button").forEach((b) =>
    b.addEventListener("click", () => { applyLang(b.dataset.lang); langBox.classList.remove("is-open"); })
  );
  document.addEventListener("click", (e) => { if (!langBox.contains(e.target)) langBox.classList.remove("is-open"); });

  /* ══════════ БД: цены и новости ══════════ */
  const db = ChestomDB.load();
  $$("[data-price-id]").forEach((el) => {
    const v = db.prices[el.dataset.priceId];
    if (v) el.textContent = v;
  });

  const newsDateFmt = (iso) => {
    try {
      return new Intl.DateTimeFormat(lang === "ar" ? "ar" : lang === "en" ? "en-GB" : "ru-RU",
        { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
    } catch { return iso; }
  };

  function renderNews() {
    const feed = $("#newsFeed");
    if (!feed) return;
    const items = [...db.news].sort((a, b) => b.date.localeCompare(a.date));
    if (!items.length) {
      feed.innerHTML = `<p class="news__empty">${(I18N["news.empty"] || {})[lang] || ""}</p>`;
      return;
    }
    feed.innerHTML = items.map((n) => {
      const initials = n.author.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      return `<article class="post reveal is-in">
        <header class="post__head">
          <span class="post__ava" aria-hidden="true">${initials}</span>
          <span class="post__meta"><b>${esc(n.author)}</b><span>${esc(n.role)} · ${newsDateFmt(n.date)}</span></span>
          <span class="post__tag">${esc(n.tag)}</span>
        </header>
        <h3>${MD.inlineHtml(n.title)}</h3>
        <div class="post__body">${MD.toHtml(n.text)}</div>
      </article>`;
    }).join("");
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ══════════ Шапка ══════════ */
  const nav = $("#nav");
  const onNavScroll = () => nav.classList.toggle("is-scrolled", scrollY > 30);
  addEventListener("scroll", onNavScroll, { passive: true });
  onNavScroll();

  const burger = $("#burger");
  const navLinks = $("#navLinks");
  burger.addEventListener("click", () => navLinks.classList.toggle("is-open"));
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") navLinks.classList.remove("is-open");
  });

  /* ══════════ Пузырьки ══════════ */
  const bubbles = $("#bubbles");
  const bubbleCount = innerWidth < 640 ? 14 : 26;
  for (let i = 0; i < bubbleCount; i++) {
    const b = document.createElement("span");
    b.className = "bubble";
    const size = 6 + Math.random() * 26;
    b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 100}%;--sway:${(Math.random() - 0.5) * 120}px;animation-duration:${9 + Math.random() * 14}s;animation-delay:${-Math.random() * 20}s`;
    bubbles.appendChild(b);
  }

  /* ══════════ Reveal ══════════ */
  /* включаем скрытие только теперь, когда observer точно будет создан */
  document.documentElement.classList.add("reveal-armed");
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }),
    { threshold: 0.12 }
  );
  $$(".reveal").forEach((el) => io.observe(el));

  /* ══════════ Счётчики ══════════ */
  const fmt = new Intl.NumberFormat("ru-RU");
  const counterIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      counterIO.unobserve(en.target);
      const el = en.target, target = +el.dataset.count, dur = 1400, t0 = performance.now();
      const plain = target > 2000; /* годы не форматируем пробелами */
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const val = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = plain ? String(val) : fmt.format(val);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => counterIO.observe(el));

  /* ══════════ Шкала глубины ══════════ */
  const depthFill = $("#depthFill");
  const depthLabel = $("#depthLabel");
  const updateDepth = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? scrollY / max : 0;
    depthFill.style.height = `${p * 100}%`;
    depthLabel.textContent = `−${Math.round(p * 20)} м`;
  };
  addEventListener("scroll", updateDepth, { passive: true });
  updateDepth();

  /* ══════════ Sticky-сцена «Погружение» ══════════ */
  const dive = $("#dive");
  const diveTooth = $("#diveTooth");
  const steps = $$(".dive__step");
  const updateDive = () => {
    const rect = dive.getBoundingClientRect();
    const total = rect.height - innerHeight;
    const p = Math.min(Math.max(-rect.top / total, 0), 1);
    const idx = Math.min(Math.floor(p * steps.length), steps.length - 1);
    steps.forEach((s, i) => s.classList.toggle("is-active", i === idx));
    if (!reduceMotion) {
      const scale = 0.7 + p * 2.6;
      diveTooth.style.transform = `translateY(${(0.5 - p) * 12}vh) scale(${scale}) rotate(${p * 14 - 7}deg)`;
      diveTooth.style.opacity = String(Math.max(0.12, 0.95 - p * 0.75));
    }
  };
  addEventListener("scroll", updateDive, { passive: true });
  updateDive();

  /* ══════════ Бегущая лента команды (marquee) ══════════ */
  function renderDoctors() {
    const track = $("#doctorsTrack");
    if (!track) return;
    const t = (k) => (I18N[k] || {})[lang] || "";
    const cardHtml = (d) => {
      const revCount = ChestomDB.reviewsFor(db, d.id).length;
      return `<a class="doc-card" href="doctor.html?id=${esc(d.id)}" aria-label="${esc(d.name)}">
        <div class="doc-card__photo" style="--hue:${+d.hue || 190}"><span>${ChestomDB.initials(d.name)}</span></div>
        <h3>${esc(d.name)}</h3>
        <p class="doc-card__role">${esc(d.role)}</p>
        <p class="doc-card__exp">${esc(d.desc)}</p>
        <span class="doc-card__foot">
          ${revCount ? `<span class="doc-card__chip"><svg class="icon icon--star"><use href="#i-star"/></svg>${revCount} ${t("team.reviews")}</span>` : ""}
          <span class="doc-card__more">${t("team.page")}</span>
        </span>
      </a>`;
    };
    const cards = db.doctors.map(cardHtml).join("");
    /* дублируем набор для бесшовного бесконечного бега */
    track.innerHTML = cards + `<div class="hscroll__dup" aria-hidden="true">${cards}</div>`;
  }

  /* ══════════ Отзывы из 2ГИС/ВК (из БД) ══════════ */
  function renderReviews() {
    const row = $("#reviewsRow");
    if (!row) return;
    const t = (k) => (I18N[k] || {})[lang] || "";
    const stars = `<div class="review__stars" aria-label="5/5">${
      '<svg class="icon icon--star"><use href="#i-star"/></svg>'.repeat(5)}</div>`;
    const items = [...db.reviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    row.innerHTML = items.map((r) => {
      const doc = r.doctorId ? ChestomDB.doctorById(db, r.doctorId) : null;
      return `<blockquote class="review reveal is-in">
        ${stars}
        <p>«${esc(r.text)}»</p>
        <footer>
          <b>${esc(r.author)}</b>
          <span>${esc(r.source)} · ${newsDateFmt(r.date)}</span>
          ${doc ? `<a class="review__doc" href="doctor.html?id=${esc(doc.id)}">${t("rev.about")} ${esc(doc.name)}</a>` : ""}
        </footer>
      </blockquote>`;
    }).join("");
  }

  /* ══════════ До/после ══════════ */
  $$("[data-ba]").forEach((fig) => {
    const frame = $(".ba__frame", fig);
    const setPos = (clientX) => {
      const r = frame.getBoundingClientRect();
      const p = Math.min(Math.max(((clientX - r.left) / r.width) * 100, 2), 98);
      frame.style.setProperty("--pos", p + "%");
    };
    let dragging = false;
    frame.addEventListener("pointerdown", (e) => { dragging = true; frame.setPointerCapture(e.pointerId); setPos(e.clientX); });
    frame.addEventListener("pointermove", (e) => dragging && setPos(e.clientX));
    frame.addEventListener("pointerup", () => (dragging = false));
    frame.addEventListener("pointercancel", () => (dragging = false));
  });

  /* ══════════ Калькулятор (на базе реального прайса) ══════════ */
  const PRICES = { clean: 4900, caries: 4250, prosthetics: 10440, smile: 3500 };
  $("#calcForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const base = PRICES[f.get("q1")];
    const teeth = +f.get("q2");
    const neglect = +f.get("q3");
    const premium = f.get("q4") === "premium" ? 1.35 : 1;
    const low = Math.round((base * teeth * neglect * premium) / 100) * 100;
    const high = Math.round((low * 1.4) / 100) * 100;
    $("#calcSum").textContent = `${fmt.format(low)} – ${fmt.format(high)} ₽`;
    const res = $("#calcResult");
    res.hidden = false;
    res.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  });

  /* ══════════ FAB ══════════ */
  const fab = $("#fab");
  $("#fabToggle").addEventListener("click", () => fab.classList.toggle("is-open"));
  document.addEventListener("click", (e) => {
    if (!fab.contains(e.target)) fab.classList.remove("is-open");
  });

  /* ══════════ Модалка ══════════ */
  const modal = $("#bookingModal");
  const modalContext = $("#modalContext");
  const openModal = (ctx) => {
    modalContext.textContent = ctx || (I18N["modal.sub"] || {})[lang] || "";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $("input", modal).focus();
  };
  const closeModal = () => { modal.hidden = true; document.body.style.overflow = ""; };
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-booking]");
    if (btn) {
      const svc = btn.dataset.service, doc = btn.dataset.doctor;
      const p = (k) => (I18N[k] || {})[lang] || "";
      openModal(doc ? `${p("modal.doctor")} ${doc}` : svc ? `${p("modal.service")} ${svc}` : "");
    }
    if (e.target.closest("[data-close-modal]")) closeModal();
    if (e.target.closest("[data-open-calc]")) {
      $("#calc").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    }
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  /* ══════════ Формы (демо; на проде → API/Telegram-бот) ══════════ */
  const bindForm = (form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      $$("input, select, button", form).forEach((el) => (el.disabled = true));
      const okEl = $(".booking-form__ok", form);
      if (okEl) okEl.hidden = false;
    });
  };
  bindForm($("#inlineBooking"));
  bindForm($("#modalBooking"));

  /* старт */
  applyLang(lang);

  } catch (e) {
    /* любой сбой — показываем контент без анимаций, дизайн не должен «пропадать» */
    document.documentElement.classList.remove("js", "reveal-armed");
    console.error("app.js:", e);
  }
})();
