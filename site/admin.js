/* ═══════════ Админ-панель: цены + блог ═══════════ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let db = ChestomDB.load();

  /* ── тема ── */
  const themeBtn = $("#themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("chestom_theme", next); } catch (e) {}
  });

  /* ── вкладки ── */
  const PAGE_META = {
    prices:  { title: "Цены на сайте", sub: "Изменения публикуются на сайте мгновенно" },
    doctors: { title: "Врачи", sub: "Карточки команды и личные страницы — врач редактирует свою сам" },
    blog:    { title: "Блог и новости", sub: "Каждый врач ведёт свою колонку — посты появляются в ленте на сайте" }
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
  };

  /* ── врачи: редактор карточек ── */
  const doctorsForm = $("#doctorsForm");
  const renderDoctorsEditor = () => {
    $("#doctorsList").innerHTML = db.doctors.map((d) => `
      <fieldset class="adm-doc" data-doc="${esc(d.id)}">
        <div class="adm-doc__head">
          <span class="adm-doc__ava" style="--hue:${+d.hue || 190}">${esc(ChestomDB.initials(d.name))}</span>
          <a class="adm-doc__link" href="doctor.html?id=${esc(d.id)}" target="_blank" rel="noopener">Открыть страницу →</a>
        </div>
        <label>Имя на карточке<input data-field="name" value="${esc(d.name)}"></label>
        <label>Полное имя (на странице)<input data-field="fullName" value="${esc(d.fullName || d.name)}"></label>
        <label>Специализация<input data-field="role" value="${esc(d.role)}"></label>
        <label>Описание<textarea data-field="desc" rows="3">${esc(d.desc)}</textarea></label>
      </fieldset>`).join("");
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
  }

  /* ── выбор автора поста из базы врачей ── */
  const renderAuthorOptions = () => {
    const sel = $("#postAuthor");
    if (!sel) return;
    sel.innerHTML =
      `<option value="">Честная стоматология</option>` +
      db.doctors.map((d) => `<option value="${esc(d.id)}">${esc(d.name)} — ${esc(d.role.split("·")[0].trim())}</option>`).join("");
  };
  renderAuthorOptions();

  /* ── цены ── */
  const pricesForm = $("#pricesForm");
  const fillPrices = () => {
    Object.entries(db.prices).forEach(([k, v]) => {
      const input = pricesForm.elements[k];
      if (input) input.value = v;
    });
  };
  fillPrices();

  pricesForm.addEventListener("submit", (e) => {
    e.preventDefault();
    [...pricesForm.elements].forEach((el) => {
      if (el.name && el.value.trim()) db.prices[el.name] = el.value.trim();
    });
    ChestomDB.save(db);
    flash("#pricesSaved");
  });

  $("#pricesReset").addEventListener("click", () => {
    if (!confirm("Вернуть исходные цены? Изменения будут потеряны.")) return;
    db.prices = ChestomDB.deepCopy(ChestomDB.SEED.prices);
    ChestomDB.save(db);
    fillPrices();
    flash("#pricesSaved");
  });

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
    const authorId = f.get("author") || null;
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
    const selDoc = db.doctors.find((d) => d.id === f.get("author"));
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
