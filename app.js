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
    $$("[data-i18n-aria]").forEach((el) => {
      const t = I18N[el.dataset.i18nAria];
      if (t && t[code] != null) el.setAttribute("aria-label", t[code]);
    });
    renderNews();
    renderServices();
    renderPromos();
    renderDoctors();
    renderReviews();
    /* строки, которые собираются в других модулях (счётчик и смета в карте
       зубов), data-i18n не покрывает — сообщаем им о смене языка */
    document.dispatchEvent(new CustomEvent("chestom:lang", { detail: code }));
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
    feed.innerHTML = items.map((n, idx) => {
      const initials = n.author.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      return `<article class="post reveal is-in${idx === 0 ? " post--featured" : ""}">
        <header class="post__head">
          <span class="post__ava" aria-hidden="true">${initials}</span>
          <span class="post__meta"><b>${esc(n.author)}</b><span>${esc(n.role)} · ${newsDateFmt(n.date)}</span></span>
          <span class="post__tag">${esc(n.tag)}</span>
        </header>
        ${n.image ? `<img class="post__img" src="${esc(n.image)}" alt="" loading="lazy" decoding="async">` : ""}
        <h3>${MD.inlineHtml(n.title)}</h3>
        <div class="post__body">${MD.toHtml(n.text)}</div>
      </article>`;
    }).join("");
  }

  /* ══════════ Услуги и цены (вкладка «Услуги» в админке) ══════════
     Перевод: пока текст не правили в админке — из словаря сайта (ключ
     i18n), после правки — из en/ar карточки, иначе русский текст.
     После сборки сообщаем карусели роликов, что карточки новые. */
  const svcTr = (obj, field, dictKey) => {
    if (lang === "ru") return obj[field] || "";
    if (obj[lang] && obj[lang][field]) return obj[lang][field];
    if (dictKey && I18N[dictKey] && I18N[dictKey][lang]) return I18N[dictKey][lang];
    return obj[field] || "";
  };
  function renderServices() {
    const sv = db.services;
    const grid = $("#svcGrid");
    if (!sv || !grid) return;
    const t = (k) => (I18N[k] || {})[lang] || (I18N[k] || {}).ru || "";
    const h = sv.head || {};
    const tag = $("#svcTag"), title = $("#svcTitle"), sub = $("#svcSub");
    if (tag) tag.textContent = svcTr(h, "tag", h.i18n ? "svc.tag" : "");
    if (title) {
      const raw = lang !== "ru" && !(h[lang] && h[lang].title) && h.i18n
        ? (I18N["svc.title"] || {})[lang] || ""        /* в словаре уже есть <br> */
        : esc(svcTr(h, "title", "")).replace(/\n/g, "<br>");
      title.innerHTML = raw;
    }
    if (sub) sub.textContent = svcTr(h, "sub", h.i18n ? "svc.sub" : "");

    const band = $("#svcBand"), b = sv.band || {};
    if (band) {
      band.hidden = !(b.on && b.image);
      if (!band.hidden) {
        const img = $("img", band);
        img.src = b.image;
        if (b.imageSm) img.srcset = `${b.imageSm} 450w, ${b.image} 900w`; else img.removeAttribute("srcset");
        img.alt = b.alt || "";
        $(".band__cap b", band).textContent = svcTr(b, "title", b.i18n ? b.i18n + ".h" : "");
        $(".band__cap span", band).textContent = svcTr(b, "text", b.i18n ? b.i18n + ".p" : "");
      }
    }

    $$(".svc-card:not(.svc-card--accent)", grid).forEach((c) => c.remove());
    const accent = $(".svc-card--accent", grid);
    const html = sv.items.filter((it) => it.on !== false).map((it) => {
      const price = (it.priceKey && db.prices[it.priceKey]) || it.price || "";
      const attrs = [
        it.video ? `data-video="${esc(it.video)}"` : "",
        it.poster ? `data-poster="${esc(it.poster)}"` : "",
        it.vtt ? `data-vtt="${esc(it.vtt)}"` : ""
      ].join(" ");
      return `<article class="svc-card reveal is-in" ${attrs}>
        ${it.icon ? `<span class="svc-card__icon"><svg class="icon icon--xl"><use href="#${esc(it.icon)}"/></svg></span>` : ""}
        <h3>${esc(svcTr(it, "title", it.i18n ? it.i18n + ".h" : ""))}</h3>
        <p>${esc(svcTr(it, "text", it.i18n ? it.i18n + ".p" : ""))}</p>
        ${price ? `<div class="svc-card__price">${it.from ? `<span>${esc(t("svc.from"))}</span>&nbsp;` : ""}<b>${esc(price)}</b></div>` : ""}
        <div class="svc-card__links"><button class="svc-card__cta" data-open-booking data-service="${esc(it.service || it.title)}"><span>${esc(t("svc.book"))}</span></button>${it.page ? `<a class="svc-card__page" href="${esc(it.page)}">${esc(t("svc.more"))}</a>` : ""}</div>
      </article>`;
    }).join("");
    if (accent) accent.insertAdjacentHTML("beforebegin", html); else grid.insertAdjacentHTML("beforeend", html);
    document.dispatchEvent(new CustomEvent("chestom:services"));
  }

  /* ══════════ Акции (вкладка «Акции» в админке) ══════════
     Показываем включённые акции, у которых не вышел срок; истёкшие
     пропадают сами. Разметка та же, что была в HTML, — стеклянные
     стили раздела работают без изменений. */
  const promoDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
  };
  function renderPromos() {
    const row = $("#promoRow");
    if (!row || !db.promos) return;
    const t = (k) => (I18N[k] || {})[lang] || (I18N[k] || {}).ru || "";
    const items = db.promos.items.filter((p) => ChestomDB.promoActive(p));
    if (!items.length) {
      row.innerHTML = `<div class="promo__empty">
        <p>${esc(t("promo.empty"))}</p>
        <a class="btn btn--light btn--sm" href="https://vk.ru/chestom" target="_blank" rel="noopener">${esc(t("promo.vk"))}</a>
      </div>`;
    } else {
      row.innerHTML = items.map((p) => {
        const tr = (lang !== "ru" && p[lang]) || {};
        const title = tr.title || p.title || "";
        const text = tr.text || p.text || "";
        return `<article class="promo-card${p.accent ? " promo-card--alt" : ""} reveal is-in">
          ${p.till ? `<span class="promo-card__badge">${esc(t("promo.till.p"))} ${promoDate(p.till)}</span>` : ""}
          ${p.image ? `<img class="promo-card__pic" src="${esc(p.image)}" width="560" height="420" alt="" loading="lazy" decoding="async">` : ""}
          ${p.icon ? `<span class="promo-card__icon"><svg class="icon icon--xl" aria-hidden="true"><use href="#${esc(p.icon)}"/></svg></span>` : ""}
          <h3>${esc(title)}</h3>
          ${text ? `<p>${esc(text)}</p>` : ""}
          ${p.price || p.oldPrice ? `<div class="promo-card__price">${p.oldPrice ? `<s>${esc(p.oldPrice)}</s>` : ""}${p.price ? `<b>${esc(p.price)}</b>` : ""}</div>` : ""}
          <button class="btn btn--light btn--sm" data-open-booking data-service="${esc("Акция: " + p.title)}">${esc(t("promo.book"))}</button>
        </article>`;
      }).join("");
    }
    /* сноска с условиями: русский текст — из админки, переводы — из словаря */
    const fn = $("#fnPromo");
    if (fn && lang === "ru" && db.promos.note) fn.textContent = db.promos.note;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ══════════ Боковые баннеры (из админки) ══════════ */
  function renderBanners() {
    ["left", "right"].forEach((side) => {
      const host = $("#rail" + (side === "left" ? "Left" : "Right"));
      if (!host) return;
      const b = db.banners && db.banners[side];
      let dismissed = false;
      try { dismissed = sessionStorage.getItem("chestom_rail_" + side) === "1"; } catch (e) {}
      if (!b || !b.on || dismissed) { host.hidden = true; return; }
      host.hidden = false;
      host.innerHTML = `
        <div class="rail__card">
          <button class="rail__close" aria-label="Скрыть баннер">✕</button>
          ${b.badge ? `<span class="rail__badge">${esc(b.badge)}</span>` : ""}
          <b class="rail__title">${esc(b.title || "")}</b>
          <p class="rail__text">${esc(b.text || "")}</p>
          ${b.url ? `<a class="btn btn--primary btn--sm" href="${esc(b.url)}">${esc(b.cta || "Подробнее")}</a>` : ""}
        </div>`;
      $(".rail__close", host).addEventListener("click", () => {
        host.hidden = true;
        try { sessionStorage.setItem("chestom_rail_" + side, "1"); } catch (e) {}
      });
    });
  }
  renderBanners();

  /* ══════════ Шапка ══════════
     Во время сцены скролла шапка уезжает вверх, чтобы не спорить с кадром;
     возвращается в самом верху страницы и после того, как сцена закончилась. */
  const nav = $("#nav");
  const seq = $(".reveal-seq");
  const onNavScroll = () => {
    nav.classList.toggle("is-scrolled", scrollY > 30);
    if (!seq) return;
    const start = seq.offsetTop;
    const end = start + seq.offsetHeight - innerHeight;
    nav.classList.toggle("is-away", scrollY > start + 40 && scrollY < end);
  };
  addEventListener("scroll", onNavScroll, { passive: true });
  addEventListener("resize", onNavScroll);
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

  /* Секвенцию «в наших руках» ведёт hero-seq.js */

  /* ══════════ Бегущая лента команды (marquee) ══════════ */
  function renderDoctors() {
    const track = $("#doctorsTrack");
    if (!track) return;
    const t = (k) => (I18N[k] || {})[lang] || "";
    const cardHtml = (d) => {
      const revCount = ChestomDB.reviewsFor(db, d.id).length;
      return `<a class="doc-card" href="doctor.html?id=${esc(d.id)}" aria-label="${esc(d.name)}">
        <div class="doc-card__photo" style="--hue:${+d.hue || 190}">${
          d.photo
            ? `<img src="${esc(d.photo)}" width="896" height="1200" loading="lazy" decoding="async"
                    alt="${esc(d.name)} — ${esc(d.role)}, «Честная стоматология»">`
            : `<span>${ChestomDB.initials(d.name)}</span>`
        }</div>
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
    /* Бесшовный бесконечный цикл через translateX(-50%): трек = две
       ИДЕНТИЧНЫЕ половины, и каждая половина должна быть НЕ УЖЕ окна —
       иначе в конце прохода появляется пустота. Меряем ширину одного
       набора и повторяем его столько раз, сколько нужно. */
    track.innerHTML = cards;
    const holder = track.parentElement;
    const setW = Math.max(track.scrollWidth, 1);
    const k = Math.max(1, Math.ceil((holder.clientWidth || innerWidth) / setW));
    track.innerHTML = cards.repeat(2 * k);
    [...track.children].forEach((el, i) => {
      if (i >= db.doctors.length) { el.setAttribute("aria-hidden", "true"); el.tabIndex = -1; }
    });
    /* скорость постоянна: ~7с на карточку в половине трека */
    track.style.animationDuration = Math.max(20, db.doctors.length * k * 7) + "s";
  }
  /* при изменении ширины окна пересобираем трек под новую геометрию */
  let marqueeResizeT = 0;
  addEventListener("resize", () => {
    clearTimeout(marqueeResizeT);
    marqueeResizeT = setTimeout(renderDoctors, 250);
  });

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

  /* ══════════ До/после ══════════
     Шторкой управляет нативный <input type="range">: мышь, палец и
     клавиатура (стрелки, Home/End) работают без своей логики drag.
     При первом появлении карточка сама «показывает» ход ползунка. */
  $$("[data-ba]").forEach((fig) => {
    const frame = $(".ba__frame", fig);
    const range = $(".ba__range", fig);
    if (!frame || !range) return;

    let hinted = false, hintRaf = 0;
    const apply = (v) => {
      frame.style.setProperty("--pos", v + "%");
      range.setAttribute("aria-valuetext", Math.round(v) + "% «до»");
    };
    apply(+range.value);

    const stopHint = () => {
      hinted = true;
      if (hintRaf) { cancelAnimationFrame(hintRaf); hintRaf = 0; }
    };
    range.addEventListener("input", () => { stopHint(); apply(+range.value); });
    range.addEventListener("pointerdown", stopHint);

    /* подсказка: плавный проход шторки туда-обратно, один раз */
    const hint = () => {
      if (hinted || reduceMotion) return;
      hinted = true;
      const KEYS = [50, 76, 26, 50], STEP = 700;
      const t0 = performance.now();
      const ease = (t) => t * t * (3 - 2 * t);
      const tick = (now) => {
        const el = now - t0;
        const i = Math.min(Math.floor(el / STEP), KEYS.length - 2);
        const v = KEYS[i] + (KEYS[i + 1] - KEYS[i]) * ease((el - i * STEP) / STEP);
        apply(v); range.value = v;
        if (el < STEP * (KEYS.length - 1)) hintRaf = requestAnimationFrame(tick);
        else { apply(50); range.value = 50; hintRaf = 0; }
      };
      hintRaf = requestAnimationFrame(tick);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => {
        if (en[0].isIntersecting) { hint(); io.disconnect(); }
      }, { threshold: 0.55 });
      io.observe(fig);
    }
  });

  /* Смету считает карта зубов (teeth-map.js) — анкета калькулятора убрана */

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
      /* Ведём не к закрытой заставке, а к уже раскрытой челюсти:
         человек нажал «рассчитать» — значит выбирать зубы он готов. */
      const fold = document.querySelector(".tm-fold");
      if (fold && !fold.classList.contains("is-open")) $("#tmOpen")?.click();
      const target = $("#teethMap") || $("#calc");
      setTimeout(() => target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }), fold ? 360 : 0);
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

  /* опубликованный db.json — применяем, если нет локальных правок админки */
  if (!ChestomDB.hasLocal()) {
    fetch("db.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((remote) => {
        if (!remote) return;
        Object.assign(db, ChestomDB.mergeRemote(db, remote));
        $$("[data-price-id]").forEach((el) => {
          const v = db.prices[el.dataset.priceId];
          if (v) el.textContent = v;
        });
        renderNews();
        renderServices();
        renderPromos();
        renderDoctors();
        renderReviews();
        renderBanners();
      })
      .catch(() => {});
  }

  } catch (e) {
    /* любой сбой — показываем контент без анимаций, дизайн не должен «пропадать» */
    document.documentElement.classList.remove("js", "reveal-armed");
    console.error("app.js:", e);
  }
})();
