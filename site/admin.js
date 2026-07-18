/* ═══════════ Админ-панель: цены + блог ═══════════ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let db = ChestomDB.load();

  /* ── сессия и роли ── */
  const session = ChestomAuth.require();
  if (!session) return; /* редирект уже произошёл */
  const isAdmin = session.role === "admin";

  $("#userName").textContent = session.name;
  $("#userRole").textContent = isAdmin ? "администратор" : "врач";
  $("#userAva").textContent = ChestomDB.initials(session.name);
  $("#logoutBtn").addEventListener("click", () => {
    ChestomAuth.logout();
    location.replace("login.html");
  });

  /* врач видит только свои разделы */
  if (!isAdmin) {
    $$("[data-admin-only]").forEach((el) => el.remove());
    const pricesTab = $('[data-tab="prices"]');
    if (pricesTab) pricesTab.remove();
    /* стартовая вкладка врача — «Врачи» (своя карточка) */
    const doctorsTab = $('[data-tab="doctors"]');
    const doctorsPanel = $("#panel-doctors");
    if (doctorsTab) doctorsTab.classList.add("is-active");
    if (doctorsPanel) doctorsPanel.classList.add("is-active");
    const meta = { title: "Врачи", sub: "Ваша карточка и личная страница" };
    $("#pageTitle").textContent = meta.title;
    $("#pageSub").textContent = meta.sub;
  }

  /* ── тема ── */
  const themeBtn = $("#themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("chestom_theme", next); } catch (e) {}
  });

  /* ── вкладки ── */
  const PAGE_META = {
    prices:   { title: "Цены на сайте", sub: "Изменения публикуются на сайте мгновенно" },
    doctors:  { title: "Врачи", sub: "Добавление и удаление врачей сразу обновляет бегущую ленту на сайте" },
    blog:     { title: "Блог и новости", sub: "Каждый врач ведёт свою колонку — посты появляются в ленте на сайте" },
    banners:  { title: "Баннеры", sub: "Боковые рекламные блоки на широких экранах" },
    accounts: { title: "Аккаунты", sub: "Доступы сотрудников: администратор — всё, врач — своя страница и блог" }
  };
  $$(".adm__tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".adm__tab").forEach((t) => t.classList.toggle("is-active", t === tab));
      $$(".adm__panel").forEach((p) => p.classList.toggle("is-active", p.id === "panel-" + tab.dataset.tab));
      const meta = PAGE_META[tab.dataset.tab];
      if (meta) { $("#pageTitle").textContent = meta.title; $("#pageSub").textContent = meta.sub; }
    })
  );

  /* ── статистика ── */
  const updateStats = () => {
    $("#statPrices").textContent = Object.keys(db.prices).length;
    $("#statPosts").textContent = db.news.length;
    $("#navPostCount").textContent = db.news.length;
    const dc = $("#navDocCount");
    if (dc) dc.textContent = db.doctors.length;
    const ac = $("#navAccCount");
    if (ac) ac.textContent = db.accounts.length;
  };

  /* ── врачи: редактор карточек ── */
  const doctorsForm = $("#doctorsForm");
  const renderDoctorsEditor = () => {
    /* врач видит и редактирует только свою карточку */
    const list = isAdmin ? db.doctors : db.doctors.filter((d) => d.id === session.doctorId);
    $("#doctorsList").innerHTML = list.length ? list.map((d) => `
      <fieldset class="adm-doc" data-doc="${esc(d.id)}">
        <div class="adm-doc__head">
          <span class="adm-doc__ava" style="--hue:${+d.hue || 190}">${esc(ChestomDB.initials(d.name))}</span>
          <a class="adm-doc__link" href="doctor.html?id=${esc(d.id)}" target="_blank" rel="noopener">Открыть страницу →</a>
          ${isAdmin ? `<button type="button" class="adm-post__del adm-doc__del" data-del-doc="${esc(d.id)}" title="Удалить врача" aria-label="Удалить врача"><svg class="icon"><use href="#i-trash"/></svg></button>` : ""}
        </div>
        <label>Имя на карточке<input data-field="name" value="${esc(d.name)}"></label>
        <label>Полное имя (на странице)<input data-field="fullName" value="${esc(d.fullName || d.name)}"></label>
        <label>Специализация<input data-field="role" value="${esc(d.role)}"></label>
        <label>Описание<textarea data-field="desc" rows="3">${esc(d.desc)}</textarea></label>
      </fieldset>`).join("") : `<p class="adm-post__meta">Ваша карточка врача не найдена — обратитесь к администратору.</p>`;
  };
  if (doctorsForm) {
    renderDoctorsEditor();
    doctorsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      $$(".adm-doc", doctorsForm).forEach((fs) => {
        const doc = db.doctors.find((d) => d.id === fs.dataset.doc);
        if (!doc) return;
        $$("[data-field]", fs).forEach((inp) => {
          if (inp.value.trim()) doc[inp.dataset.field] = inp.value.trim();
        });
      });
      ChestomDB.save(db);
      renderAuthorOptions();
      flash("#doctorsSaved");
    });

    /* добавление врача (только админ) */
    const addBtn = $("#doctorAdd");
    if (addBtn) addBtn.addEventListener("click", () => {
      const id = "doc" + Date.now().toString(36);
      db.doctors.push({
        id,
        name: "Новый врач",
        fullName: "Новый врач",
        role: "Врач-стоматолог",
        desc: "Заполните специализацию и описание — карточка сразу появится в бегущей ленте на сайте.",
        hue: 160 + Math.floor(Math.random() * 70)
      });
      ChestomDB.save(db);
      renderDoctorsEditor();
      renderAuthorOptions();
      renderAccounts();
      updateStats();
      const fs = $(`.adm-doc[data-doc="${id}"]`);
      if (fs) { fs.scrollIntoView({ behavior: "smooth", block: "center" }); $("input", fs).select(); }
    });

    /* удаление врача (только админ): чистим связанные посты/отзывы/аккаунты */
    $("#doctorsList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-doc]");
      if (!btn) return;
      const doc = db.doctors.find((d) => d.id === btn.dataset.delDoc);
      if (!doc) return;
      if (!confirm(`Удалить врача «${doc.name}»?\nЕго страница исчезнет с сайта, посты станут постами клиники, аккаунт (если есть) будет удалён.`)) return;
      db.doctors = db.doctors.filter((d) => d.id !== doc.id);
      db.news.forEach((n) => { if (n.authorId === doc.id) { n.authorId = null; n.author = "Честная стоматология"; } });
      db.reviews.forEach((r) => { if (r.doctorId === doc.id) r.doctorId = null; });
      db.accounts = db.accounts.filter((a) => a.doctorId !== doc.id);
      ChestomDB.save(db);
      renderDoctorsEditor();
      renderAuthorOptions();
      renderAccounts();
      updateStats();
      flash("#doctorsSaved");
    });
  }

  /* ── выбор автора поста из базы врачей ── */
  const renderAuthorOptions = () => {
    const sel = $("#postAuthor");
    if (!sel) return;
    if (!isAdmin) {
      /* врач публикует только от своего имени */
      const me = db.doctors.find((d) => d.id === session.doctorId);
      sel.innerHTML = `<option value="${esc(session.doctorId || "")}">${esc(me ? me.name : session.name)}</option>`;
      sel.disabled = true;
      return;
    }
    sel.innerHTML =
      `<option value="">Честная стоматология</option>` +
      db.doctors.map((d) => `<option value="${esc(d.id)}">${esc(d.name)} — ${esc(d.role.split("·")[0].trim())}</option>`).join("");
  };
  renderAuthorOptions();

  /* ══════════ БАННЕРЫ ══════════ */
  const bannersForm = $("#bannersForm");
  const renderBannersEditor = () => {
    const list = $("#bannersList");
    if (!list) return;
    const side = (key, label) => {
      const b = db.banners[key];
      return `<fieldset class="adm-doc adm-banner" data-side="${key}">
        <div class="adm-doc__head">
          <label class="adm-banner__toggle">
            <input type="checkbox" data-bf="on" ${b.on ? "checked" : ""}>
            <span><b>${label}</b> — ${b.on ? "включён" : "выключен"}</span>
          </label>
        </div>
        <label>Бейдж<input data-bf="badge" value="${esc(b.badge || "")}" placeholder="Акция"></label>
        <label>Заголовок<input data-bf="title" value="${esc(b.title || "")}" required></label>
        <label>Текст<textarea data-bf="text" rows="2">${esc(b.text || "")}</textarea></label>
        <label>Ссылка (URL, #секция или tel:)<input data-bf="url" value="${esc(b.url || "")}"></label>
        <label>Текст кнопки<input data-bf="cta" value="${esc(b.cta || "")}" placeholder="Подробнее"></label>
      </fieldset>`;
    };
    list.innerHTML = side("left", "Левый баннер") + side("right", "Правый баннер");
  };
  if (bannersForm) {
    renderBannersEditor();
    bannersForm.addEventListener("change", (e) => {
      /* живое обновление подписи вкл/выкл */
      if (e.target.matches('[data-bf="on"]')) renderBannersLabel(e.target);
    });
    const renderBannersLabel = (cb) => {
      const span = cb.parentElement.querySelector("span");
      const label = cb.closest("[data-side]").dataset.side === "left" ? "Левый баннер" : "Правый баннер";
      span.innerHTML = `<b>${label}</b> — ${cb.checked ? "включён" : "выключен"}`;
    };
    bannersForm.addEventListener("submit", (e) => {
      e.preventDefault();
      $$(".adm-banner", bannersForm).forEach((fs) => {
        const b = db.banners[fs.dataset.side];
        if (!b) return;
        $$("[data-bf]", fs).forEach((inp) => {
          const k = inp.dataset.bf;
          b[k] = k === "on" ? inp.checked : inp.value.trim();
        });
      });
      ChestomDB.save(db);
      flash("#bannersSaved");
    });
  }

  /* ══════════ АККАУНТЫ ══════════ */
  const renderAccounts = () => {
    const list = $("#accountList");
    const sel = $("#accDoctor");
    if (!list || !sel) return;
    /* врачи без аккаунта — доступны для создания */
    const taken = new Set(db.accounts.map((a) => a.doctorId).filter(Boolean));
    const free = db.doctors.filter((d) => !taken.has(d.id));
    sel.innerHTML = free.length
      ? free.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("")
      : `<option value="">— у всех врачей уже есть аккаунт —</option>`;
    sel.disabled = !free.length;

    list.innerHTML = db.accounts.map((a) => {
      const doc = a.doctorId ? db.doctors.find((d) => d.id === a.doctorId) : null;
      return `<div class="adm-post">
        <div class="adm-post__top">
          <b>${esc(a.name)}</b>
          ${a.role !== "admin" ? `<button class="adm-post__del" data-del-acc="${esc(a.id)}" title="Удалить аккаунт" aria-label="Удалить аккаунт"><svg class="icon"><use href="#i-trash"/></svg></button>` : ""}
        </div>
        <span class="adm-post__meta">логин: <code>${esc(a.login)}</code> · ${a.role === "admin" ? "администратор" : `врач${doc ? " · " + esc(doc.role.split("·")[0].trim()) : ""}`}</span>
        <div class="adm__actions"><button class="btn btn--ghost btn--sm" data-reset-acc="${esc(a.id)}">Сбросить пароль</button></div>
      </div>`;
    }).join("");
  };
  renderAccounts();

  const accountForm = $("#accountForm");
  if (accountForm) {
    accountForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(accountForm);
      const doctorId = f.get("doctorId");
      const loginName = String(f.get("login")).trim().toLowerCase();
      const password = String(f.get("password"));
      if (!doctorId) return;
      if (db.accounts.some((a) => a.login.toLowerCase() === loginName)) {
        alert("Такой логин уже занят.");
        return;
      }
      const doc = db.doctors.find((d) => d.id === doctorId);
      db.accounts.push({
        id: "acc" + Date.now().toString(36),
        login: loginName,
        name: doc ? doc.name : loginName,
        role: "doctor",
        doctorId,
        pass: await ChestomAuth.sha256(password)
      });
      ChestomDB.save(db);
      accountForm.reset();
      renderAccounts();
      updateStats();
      flash("#accSaved");
    });

    $("#accountList").addEventListener("click", async (e) => {
      const del = e.target.closest("[data-del-acc]");
      const rst = e.target.closest("[data-reset-acc]");
      if (del) {
        const acc = db.accounts.find((a) => a.id === del.dataset.delAcc);
        if (acc && confirm(`Удалить аккаунт «${acc.name}» (${acc.login})?`)) {
          db.accounts = db.accounts.filter((a) => a.id !== acc.id);
          ChestomDB.save(db);
          renderAccounts();
          updateStats();
        }
      }
      if (rst) {
        const acc = db.accounts.find((a) => a.id === rst.dataset.resetAcc);
        if (!acc) return;
        const np = prompt(`Новый пароль для «${acc.name}» (минимум 6 символов):`);
        if (!np || np.length < 6) { if (np !== null) alert("Слишком короткий пароль."); return; }
        acc.pass = await ChestomAuth.sha256(np);
        ChestomDB.save(db);
        alert("Пароль обновлён.");
      }
    });
  }

  /* ── цены (панель есть только у администратора) ── */
  const pricesForm = $("#pricesForm");
  const fillPrices = () => {
    if (!pricesForm) return;
    Object.entries(db.prices).forEach(([k, v]) => {
      const input = pricesForm.elements[k];
      if (input) input.value = v;
    });
  };
  if (pricesForm) {
    fillPrices();

    pricesForm.addEventListener("submit", (e) => {
      e.preventDefault();
      [...pricesForm.elements].forEach((el) => {
        if (el.name && el.value.trim()) db.prices[el.name] = el.value.trim();
      });
      ChestomDB.save(db);
      flash("#pricesSaved");
    });

    /* ── экспорт db.json для публикации ── */
    $("#dbExport").addEventListener("click", () => {
      const pub = { ...db };
      delete pub.accounts; /* пароли не публикуем */
      const blob = new Blob([JSON.stringify(pub, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "db.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    $("#pricesReset").addEventListener("click", () => {
      if (!confirm("Вернуть исходные цены? Изменения будут потеряны.")) return;
      db.prices = ChestomDB.deepCopy(ChestomDB.SEED.prices);
      ChestomDB.save(db);
      fillPrices();
      flash("#pricesSaved");
    });
  }

  /* ── блог ── */
  const postForm = $("#postForm");
  const renderPosts = () => {
    const list = $("#postList");
    const items = [...db.news].sort((a, b) => b.date.localeCompare(a.date));
    $("#postCount").textContent = `· ${items.length}`;
    list.innerHTML = items.length
      ? items.map((n) => `
        <div class="adm-post">
          <div class="adm-post__top">
            <b>${esc(n.title)}</b>
            <button class="adm-post__del" data-del="${esc(n.id)}" aria-label="Удалить пост" title="Удалить">
              <svg class="icon"><use href="#i-trash"/></svg>
            </button>
          </div>
          <span class="adm-post__meta">${esc(n.author)} · ${esc(n.role)} · ${esc(n.tag)} · ${n.date}</span>
          <p class="adm-post__text">${esc((s => s.length > 160 ? s.slice(0, 160) + "…" : s)(n.text.replace(/[*`#]|\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\n+/g, " ")))}</p>
        </div>`).join("")
      : `<p class="adm-post__meta">Постов пока нет.</p>`;
    updateStats();
  };
  renderPosts();

  postForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(postForm);
    /* врач всегда публикует от себя (его select отключён и не попадает в FormData) */
    const authorId = isAdmin ? (f.get("author") || null) : (session.doctorId || null);
    const doc = authorId ? db.doctors.find((d) => d.id === authorId) : null;
    db.news.push({
      id: "n" + Date.now(),
      date: new Date().toISOString().slice(0, 10),
      authorId,
      author: doc ? doc.name : "Честная стоматология",
      role: f.get("role"),
      tag: f.get("tag").trim(),
      title: f.get("title").trim(),
      text: f.get("text").trim()
    });
    ChestomDB.save(db);
    postForm.reset();
    renderPosts();
    flash("#postSaved");
  });

  /* ── живое превью поста (Markdown) ── */
  const preview = $("#postPreview");
  const updatePreview = () => {
    const f = new FormData(postForm);
    const title = (f.get("title") || "").trim();
    const text = (f.get("text") || "").trim();
    if (!title && !text) { preview.hidden = true; return; }
    preview.hidden = false;
    const selDoc = db.doctors.find((d) => d.id === (isAdmin ? f.get("author") : session.doctorId));
    const author = selDoc ? selDoc.name : "Честная стоматология";
    $("#pvAva").textContent = author.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    $("#pvAuthor").textContent = author;
    $("#pvRole").textContent = `${f.get("role")} · сегодня`;
    $("#pvTag").textContent = (f.get("tag") || "—").trim() || "—";
    $("#pvTitle").innerHTML = title ? MD.inlineHtml(title) : "Без заголовка";
    $("#pvBody").innerHTML = text ? MD.toHtml(text) : "";
  };
  postForm.addEventListener("input", updatePreview);
  postForm.addEventListener("reset", () => setTimeout(updatePreview, 0));

  $("#postList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-del]");
    if (!btn) return;
    if (!confirm("Удалить пост?")) return;
    db.news = db.news.filter((n) => n.id !== btn.dataset.del);
    ChestomDB.save(db);
    renderPosts();
  });

  /* ── всплывающее «сохранено» ── */
  function flash(sel) {
    const el = $(sel);
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.hidden = true), 3000);
  }
})();
