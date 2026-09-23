/* ═══════════ Админ-панель: цены + блог ═══════════ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let db = ChestomDB.load();

  /* ── картинки: файл → сжатый JPEG (data-URL) ──
     Всё хранится в localStorage (около 5 МБ на сайт), поэтому режем
     и ужимаем прямо в браузере.
     fit: "cover" — ровно w×h с обрезкой (biasY: 0 — верх, 0.5 — центр),
          "max"   — вписать в w×h, пропорции сохранить. */
  const imageError = (file) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return "Нужна картинка в формате JPG, PNG или WebP.";
    if (file.size > 15 * 1024 * 1024) return "Файл больше 15 МБ — выберите изображение поменьше.";
    return "";
  };
  const imageToJpeg = (file, { w, h, fit = "cover", biasY = 0.5, quality = 0.84 }) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0, cw = w, ch = h;
      if (fit === "cover") {
        const k = w / h;
        if (sw / sh > k) { const nw = sh * k; sx = (sw - nw) / 2; sw = nw; }
        else { const nh = sw / k; sy = Math.max(0, (sh - nh) * biasY); sh = nh; }
      } else {
        const s = Math.min(1, w / sw, h / sh);
        cw = Math.round(sw * s); ch = Math.round(sh * s);
      }
      const c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch); /* прозрачный PNG — на белом */
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
  /* сохранить базу; если не влезло — откатить изменение и сказать об этом */
  const saveOrRollback = (rollback) => {
    try { ChestomDB.save(db); return true; }
    catch (err) {
      rollback();
      alert("Не хватило места в хранилище браузера. Попробуйте изображение поменьше или удалите старые картинки в постах.");
      return false;
    }
  };

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
    services: { title: "Услуги", sub: "Раздел «Услуги и цены» на главной: заголовок, фото, карточки и цены" },
    promos:   { title: "Акции", sub: "Раздел «Честные скидки» на главной: карточки, сроки, цены и фото" },
    banners:  { title: "Баннеры", sub: "Боковые рекламные блоки на широких экранах" },
    accounts: { title: "Аккаунты", sub: "Доступы сотрудников: администратор — всё, врач — своя страница и блог" }
  };
  $$(".adm__tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      $$(".adm__tab").forEach((t) => t.classList.toggle("is-active", t === tab));
      $$(".adm__panel").forEach((p) => p.classList.toggle("is-active", p.id === "panel-" + tab.dataset.tab));
      /* на телефоне меню — лента: выбранный пункт подтягиваем в видимую часть */
      tab.scrollIntoView({ block: "nearest", inline: "nearest" });
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
    const sc = $("#navSvcCount");
    if (sc && db.services) sc.textContent = db.services.items.filter((x) => x.on !== false).length;
    const pc = $("#navPromoCount");
    if (pc && db.promos) pc.textContent = db.promos.items.filter((p) => ChestomDB.promoActive(p)).length;
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
          <span class="adm-doc__ava" style="--hue:${+d.hue || 190}">${
            d.photo
              ? `<img src="${esc(d.photo)}" alt="" loading="lazy">`
              : esc(ChestomDB.initials(d.name))
          }</span>
          <a class="adm-doc__link" href="doctor.html?id=${esc(d.id)}" target="_blank" rel="noopener">Открыть страницу →</a>
          ${isAdmin ? `<button type="button" class="adm-post__del adm-doc__del" data-del-doc="${esc(d.id)}" title="Удалить врача" aria-label="Удалить врача"><svg class="icon"><use href="#i-trash"/></svg></button>` : ""}
        </div>
        <div class="adm-doc__photo">
          <span class="adm-doc__pic" style="--hue:${+d.hue || 190}">${
            d.photo
              ? `<img src="${esc(d.photo)}" alt="Фото: ${esc(d.name)}">`
              : `<span>${esc(ChestomDB.initials(d.name))}</span>`
          }</span>
          <div class="adm-doc__photo-ctl">
            <b>Фотокарточка</b>
            <span class="adm-post__meta">Портрет 3:4 — обрежем по центру и уменьшим до 600×800. JPG, PNG или WebP.</span>
            <div class="adm-doc__photo-btns">
              <label class="btn btn--ghost btn--sm adm-doc__upload">${d.photo ? "Заменить фото" : "Загрузить фото"}
                <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-input="${esc(d.id)}" hidden>
              </label>
              ${d.photo ? `<button type="button" class="btn btn--ghost btn--sm adm-doc__nophoto" data-photo-del="${esc(d.id)}">Удалить фото</button>` : ""}
            </div>
            <span class="adm__saved" data-photo-saved hidden>✓ Фото сохранено</span>
          </div>
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

    /* ── фото врача: загрузка, замена, удаление ──
       Сразу сохраняем в базу — как и удаление врача. Перерисовываем только
       блок фото этой карточки, чтобы не потерять несохранённый текст. */
    const toPortrait = (file) => imageToJpeg(file, { w: 600, h: 800, biasY: 0.3 }); /* лицо обычно выше центра */
    const refreshPhoto = (doc) => {
      const fs = $(`.adm-doc[data-doc="${doc.id}"]`);
      if (!fs) return;
      const pic = $(".adm-doc__pic", fs);
      pic.innerHTML = doc.photo ? `<img src="${esc(doc.photo)}" alt="Фото: ${esc(doc.name)}">` : `<span>${esc(ChestomDB.initials(doc.name))}</span>`;
      $(".adm-doc__ava", fs).innerHTML = doc.photo ? `<img src="${esc(doc.photo)}" alt="" loading="lazy">` : esc(ChestomDB.initials(doc.name));
      const btns = $(".adm-doc__photo-btns", fs);
      $(".adm-doc__upload", btns).firstChild.textContent = doc.photo ? "Заменить фото" : "Загрузить фото";
      const del = $(".adm-doc__nophoto", btns);
      if (doc.photo && !del) btns.insertAdjacentHTML("beforeend", `<button type="button" class="btn btn--ghost btn--sm adm-doc__nophoto" data-photo-del="${esc(doc.id)}">Удалить фото</button>`);
      if (!doc.photo && del) del.remove();
      const ok = $("[data-photo-saved]", fs);
      ok.hidden = false; clearTimeout(ok._t); ok._t = setTimeout(() => { ok.hidden = true; }, 2500);
    };
    const savePhoto = (doc, value) => {
      const prev = doc.photo;
      if (value) doc.photo = value; else delete doc.photo;
      if (!saveOrRollback(() => { if (prev) doc.photo = prev; else delete doc.photo; })) return false;
      refreshPhoto(doc);
      return true;
    };
    $("#doctorsList").addEventListener("change", async (e) => {
      const inp = e.target.closest("[data-photo-input]");
      if (!inp || !inp.files || !inp.files[0]) return;
      const doc = db.doctors.find((d) => d.id === inp.dataset.photoInput);
      const file = inp.files[0];
      inp.value = "";                       /* чтобы то же фото можно было выбрать снова */
      if (!doc) return;
      const bad = imageError(file);
      if (bad) { alert(bad); return; }
      try { savePhoto(doc, await toPortrait(file)); }
      catch (err) { alert("Не получилось прочитать это изображение. Попробуйте другой файл."); }
    });
    $("#doctorsList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-photo-del]");
      if (!btn) return;
      const doc = db.doctors.find((d) => d.id === btn.dataset.photoDel);
      if (!doc) return;
      if (!confirm(`Удалить фото врача «${doc.name}»?\nНа сайте вместо фото будут инициалы.`)) return;
      savePhoto(doc, "");
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

  /* ── услуги: редактор раздела «Услуги и цены» ──
     Устроен как редактор акций: текст забираем из формы перед любой
     перестройкой, фото сохраняем сразу. Цена карточки пишется в общий
     прайс prices[priceKey]. Если текст поменяли, снимаем ссылку на
     словарь переводов (i18n): иначе английская и арабская версии
     показывали бы старый перевод. */
  const SVC_ICONS = [
    ["i-exam", "Осмотр"], ["i-tooth", "Зуб"], ["i-shine", "Гигиена"], ["i-restore", "Реставрация"],
    ["i-crown", "Протезирование"], ["i-extract", "Удаление"], ["i-calc", "Калькулятор"],
    ["i-promo-crown", "Коронка"], ["i-promo-percent", "Скидка %"], ["", "Без иконки"]
  ];
  const SVC_PAGES = ["konsultatsiya.html", "lechenie-kariesa.html", "profgigiena.html", "restavratsiya.html", "protezirovanie.html", "udalenie-zubov.html"];
  const servicesForm = $("#servicesForm");
  const svcPrice = (it) => (it.priceKey && db.prices[it.priceKey]) || it.price || "";
  const trField = (o, lng, f) => esc((o[lng] && o[lng][f]) || "");
  const renderSvcEditor = () => {
    if (!servicesForm) return;
    const sv = db.services;
    const h = sv.head;
    $$("[data-sh]", servicesForm).forEach((el) => {
      const k = el.dataset.sh;
      el.value = k.includes(".") ? ((h[k.split(".")[0]] || {})[k.split(".")[1]] || "") : (h[k] || "");
    });
    const b = sv.band;
    $("#svcBandEditor").innerHTML = `
      <div class="adm-doc__head"><b>Большое фото раздела</b></div>
      <div class="adm-doc__photo">
        <span class="adm-img__pic adm-svc__band">${b.image ? `<img src="${esc(b.image)}" alt="">` : `<span>нет фото</span>`}</span>
        <div class="adm-doc__photo-ctl">
          <span class="adm-post__meta">Широкий кадр над карточками. Обрежем до 2:1 и уменьшим до 1600×800.</span>
          <div class="adm-doc__photo-btns">
            <label class="btn btn--ghost btn--sm adm-doc__upload">${b.image ? "Заменить фото" : "Загрузить фото"}
              <input type="file" accept="image/jpeg,image/png,image/webp" data-svc-band-img hidden>
            </label>
            ${b.image ? `<button type="button" class="btn btn--ghost btn--sm adm-doc__nophoto" data-svc-band-del>Удалить фото</button>` : ""}
          </div>
        </div>
      </div>
      <label class="adm-promo__check"><input type="checkbox" data-sb="on" ${b.on ? "checked" : ""}> Показывать фото на сайте</label>
      <label>Описание фото для незрячих (alt)<input data-sb="alt" value="${esc(b.alt || "")}"></label>
      <label>Подпись — заголовок<input data-sb="title" value="${esc(b.title || "")}"></label>
      <label>Подпись — текст<input data-sb="text" value="${esc(b.text || "")}"></label>
      <details class="adm-promo__tr">
        <summary>Переводы подписи (необязательно)</summary>
        <div class="adm-promo__tr-grid">
          <label>Заголовок · EN<input data-sb="en.title" value="${trField(b, "en", "title")}"></label>
          <label>Текст · EN<input data-sb="en.text" value="${trField(b, "en", "text")}"></label>
          <label>Заголовок · AR<input data-sb="ar.title" dir="rtl" value="${trField(b, "ar", "title")}"></label>
          <label>Текст · AR<input data-sb="ar.text" dir="rtl" value="${trField(b, "ar", "text")}"></label>
        </div>
      </details>`;
    const items = sv.items;
    $("#svcList").innerHTML = items.length ? items.map((it, i) => `
      <fieldset class="adm-doc adm-promo adm-svc" data-svc="${esc(it.id)}">
        <div class="adm-doc__head">
          <span class="adm-promo__num">${i + 1}</span>
          <span class="adm-promo__st adm-promo__st--${it.on !== false ? "on" : "off"}">${it.on !== false ? "На сайте" : "Скрыта"}</span>
          <span class="adm-promo__move">
            <button type="button" class="adm-post__del" data-svc-move="-1" title="Выше" aria-label="Переместить выше" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="adm-post__del" data-svc-move="1" title="Ниже" aria-label="Переместить ниже" ${i === items.length - 1 ? "disabled" : ""}>↓</button>
          </span>
          <button type="button" class="adm-post__del adm-doc__del" data-svc-del title="Удалить услугу" aria-label="Удалить услугу"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
        <label class="adm-promo__check"><input type="checkbox" data-sf="on" ${it.on !== false ? "checked" : ""}> Показывать на сайте</label>
        <label>Иконка<select data-sf="icon">${SVC_ICONS.map(([v, l]) => `<option value="${v}" ${v === (it.icon || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Название<input data-sf="title" value="${esc(it.title || "")}" required></label>
        <label>Цена<input data-sf="price" value="${esc(svcPrice(it))}" placeholder="3 500 ₽ или 4 000–4 500 ₽"></label>
        <label>Описание<textarea data-sf="text" rows="2">${esc(it.text || "")}</textarea></label>
        <label class="adm-promo__check"><input type="checkbox" data-sf="from" ${it.from ? "checked" : ""}> Писать «от» перед ценой</label>
        <label>Подпись в форме записи<input data-sf="service" value="${esc(it.service || "")}" placeholder="Как услуга подписана в заявке"></label>
        <label>Страница «Подробнее»<input data-sf="page" list="svcPages" value="${esc(it.page || "")}" placeholder="пусто — без кнопки"></label>
        <div class="adm-doc__photo">
          <span class="adm-img__pic">${it.poster ? `<img src="${esc(it.poster)}" alt="">` : `<span>нет картинки</span>`}</span>
          <div class="adm-doc__photo-ctl">
            <b>Картинка процедуры</b>
            <span class="adm-post__meta">Обложка ролика в карусели «плей». Обрежем до 16:9, 960×540.</span>
            <div class="adm-doc__photo-btns">
              <label class="btn btn--ghost btn--sm adm-doc__upload">${it.poster ? "Заменить" : "Загрузить"}
                <input type="file" accept="image/jpeg,image/png,image/webp" data-svc-img hidden>
              </label>
              ${it.poster ? `<button type="button" class="btn btn--ghost btn--sm adm-doc__nophoto" data-svc-img-del>Удалить</button>` : ""}
            </div>
          </div>
        </div>
        <label>Ролик (путь к mp4)<input data-sf="video" value="${esc(it.video || "")}" placeholder="svc/anim/название.mp4 — пусто: без кнопки «плей»"></label>
        <details class="adm-promo__tr"${(it.en && (it.en.title || it.en.text)) || (it.ar && (it.ar.title || it.ar.text)) ? " open" : ""}>
          <summary>Переводы (необязательно)</summary>
          <div class="adm-promo__tr-grid">
            <label>Название · EN<input data-sf="en.title" value="${trField(it, "en", "title")}"></label>
            <label>Описание · EN<input data-sf="en.text" value="${trField(it, "en", "text")}"></label>
            <label>Название · AR<input data-sf="ar.title" dir="rtl" value="${trField(it, "ar", "title")}"></label>
            <label>Описание · AR<input data-sf="ar.text" dir="rtl" value="${trField(it, "ar", "text")}"></label>
          </div>
          <span class="adm-post__meta">${it.i18n ? "Пока текст не меняли, переводы берутся из словаря сайта." : "Без перевода в этих версиях показывается русский текст."}</span>
        </details>
      </fieldset>`).join("") : `<p class="adm-post__meta">Услуг пока нет.</p>`;
    updateStats();
  };
  /* поля вида "en.title" → obj.en.title; пустой перевод убираем */
  const setField = (obj, key, val) => {
    if (key.includes(".")) {
      const [lng, f] = key.split(".");
      obj[lng] = obj[lng] || {};
      obj[lng][f] = val;
      if (!Object.values(obj[lng]).some(Boolean)) delete obj[lng];
    } else obj[key] = val;
  };
  const syncServices = () => {
    const sv = db.services;
    const h = sv.head, before = [h.tag, h.title, h.sub].join("|");
    $$("[data-sh]", servicesForm).forEach((el) => setField(h, el.dataset.sh, el.value.replace(/\r/g, "").trim()));
    if ([h.tag, h.title, h.sub].join("|") !== before) h.i18n = false;
    const b = sv.band, bBefore = b.title + "|" + b.text;
    $$("[data-sb]", servicesForm).forEach((el) => setField(b, el.dataset.sb, el.type === "checkbox" ? el.checked : el.value.trim()));
    if (b.title + "|" + b.text !== bBefore) b.i18n = null;
    $$(".adm-svc", servicesForm).forEach((fs) => {
      const it = sv.items.find((x) => x.id === fs.dataset.svc);
      if (!it) return;
      const tBefore = it.title + "|" + it.text;
      $$("[data-sf]", fs).forEach((el) => {
        const k = el.dataset.sf;
        const val = el.type === "checkbox" ? el.checked : el.value.trim();
        if (k === "price") {
          if (!it.priceKey) it.priceKey = "svc_" + it.id;
          db.prices[it.priceKey] = val;
        } else setField(it, k, val);
      });
      if (it.title + "|" + it.text !== tBefore) it.i18n = null;
    });
  };
  if (servicesForm) {
    servicesForm.insertAdjacentHTML("beforeend", `<datalist id="svcPages">${SVC_PAGES.map((p) => `<option value="${p}">`).join("")}</datalist>`);
    renderSvcEditor();
    servicesForm.addEventListener("submit", (e) => {
      e.preventDefault();
      syncServices();
      if (db.services.items.some((x) => !x.title)) { alert("У каждой услуги должно быть название."); return; }
      ChestomDB.save(db);
      renderSvcEditor();
      fillPrices();
      flash("#servicesSaved");
    });
    $("#svcAdd").addEventListener("click", () => {
      syncServices();
      const id = "s" + Date.now().toString(36);
      db.services.items.push({ id, on: true, icon: "i-tooth", priceKey: "svc_" + id, from: true, title: "Новая услуга", text: "", service: "", page: "", video: "", poster: "" });
      db.prices["svc_" + id] = "";
      ChestomDB.save(db);
      renderSvcEditor();
      const fs = $(`.adm-svc[data-svc="${id}"]`);
      if (fs) { fs.scrollIntoView({ behavior: "smooth", block: "center" }); $('[data-sf="title"]', fs).select(); }
    });
    $("#svcList").addEventListener("click", (e) => {
      const fs = e.target.closest(".adm-svc");
      if (!fs) return;
      const items = db.services.items;
      const idx = items.findIndex((x) => x.id === fs.dataset.svc);
      if (idx < 0) return;
      const mv = e.target.closest("[data-svc-move]");
      if (mv) {
        syncServices();
        const to = idx + +mv.dataset.svcMove;
        if (to < 0 || to >= items.length) return;
        [items[idx], items[to]] = [items[to], items[idx]];
        ChestomDB.save(db); renderSvcEditor();
        return;
      }
      if (e.target.closest("[data-svc-del]")) {
        if (!confirm(`Удалить услугу «${items[idx].title}» с главной?\nСтраница услуги и цена в прайсе останутся.`)) return;
        syncServices();
        items.splice(idx, 1);
        ChestomDB.save(db); renderSvcEditor();
        return;
      }
      if (e.target.closest("[data-svc-img-del]")) {
        if (!confirm("Удалить картинку процедуры?")) return;
        syncServices();
        const prev = items[idx].poster;
        items[idx].poster = "";
        if (saveOrRollback(() => { items[idx].poster = prev; })) renderSvcEditor();
      }
    });
    servicesForm.addEventListener("click", (e) => {
      if (!e.target.closest("[data-svc-band-del]")) return;
      if (!confirm("Удалить большое фото раздела? На сайте полоса с фото пропадёт.")) return;
      syncServices();
      const b = db.services.band, prev = [b.image, b.imageSm];
      b.image = ""; b.imageSm = "";
      if (saveOrRollback(() => { [b.image, b.imageSm] = prev; })) renderSvcEditor();
    });
    servicesForm.addEventListener("change", async (e) => {
      const bandInp = e.target.closest("[data-svc-band-img]");
      const cardInp = e.target.closest("[data-svc-img]");
      const inp = bandInp || cardInp;
      if (!inp || !inp.files || !inp.files[0]) return;
      const file = inp.files[0];
      const fs = inp.closest(".adm-svc");
      inp.value = "";
      const bad = imageError(file);
      if (bad) { alert(bad); return; }
      let data;
      try {
        data = bandInp
          ? await imageToJpeg(file, { w: 1600, h: 800, biasY: 0.4, quality: 0.82 })
          : await imageToJpeg(file, { w: 960, h: 540, quality: 0.82 });
      } catch (err) { alert("Не получилось прочитать это изображение. Попробуйте другой файл."); return; }
      syncServices();
      if (bandInp) {
        const b = db.services.band, prev = [b.image, b.imageSm, b.on];
        b.image = data; b.imageSm = ""; b.on = true;
        if (saveOrRollback(() => { [b.image, b.imageSm, b.on] = prev; })) renderSvcEditor();
      } else {
        const it = db.services.items.find((x) => x.id === fs.dataset.svc);
        if (!it) return;
        const prev = it.poster;
        it.poster = data;
        if (saveOrRollback(() => { it.poster = prev; })) renderSvcEditor();
      }
    });
    /* статус меняется сразу, пока правят галочку */
    $("#svcList").addEventListener("input", (e) => {
      const fs = e.target.closest(".adm-svc");
      if (!fs) return;
      const on = $('[data-sf="on"]', fs).checked;
      const st = $(".adm-promo__st", fs);
      st.className = `adm-promo__st adm-promo__st--${on ? "on" : "off"}`;
      st.textContent = on ? "На сайте" : "Скрыта";
    });
  }

  /* ── акции: редактор раздела «Честные скидки» ──
     Текст правится в форме и сохраняется кнопкой; перед любой
     перестройкой списка (добавить, удалить, переставить) сначала
     забираем введённое из формы, чтобы ничего не потерялось. */
  const PROMO_ICONS = [
    ["i-promo-hygiene", "Гигиена"], ["i-promo-percent", "Скидка %"], ["i-promo-crown", "Коронка"],
    ["i-tooth", "Зуб"], ["i-shine", "Чистка"], ["i-restore", "Реставрация"],
    ["i-exam", "Осмотр"], ["i-extract", "Удаление"], ["", "Без иконки"]
  ];
  const promosForm = $("#promosForm");
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const ruDate = (iso) => (iso || "").split("-").reverse().join(".");
  const promoStatus = (p) => {
    if (!p.on) return ["off", "Скрыта"];
    if (p.till && p.till < todayIso()) return ["old", `Истекла ${ruDate(p.till)} — на сайте не видна`];
    return ["on", p.till ? `На сайте до ${ruDate(p.till)}` : "На сайте, без срока"];
  };
  const renderPromoEditor = () => {
    if (!promosForm) return;
    const items = db.promos.items;
    $("#promoNote").value = db.promos.note || "";
    $("#promoList").innerHTML = items.length ? items.map((p, i) => {
      const [st, stText] = promoStatus(p);
      return `
      <fieldset class="adm-doc adm-promo${p.accent ? " is-accent" : ""}" data-promo="${esc(p.id)}">
        <div class="adm-doc__head">
          <span class="adm-promo__num">${i + 1}</span>
          <span class="adm-promo__st adm-promo__st--${st}">${esc(stText)}</span>
          <span class="adm-promo__move">
            <button type="button" class="adm-post__del" data-promo-move="-1" title="Выше" aria-label="Переместить выше" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="adm-post__del" data-promo-move="1" title="Ниже" aria-label="Переместить ниже" ${i === items.length - 1 ? "disabled" : ""}>↓</button>
          </span>
          <button type="button" class="adm-post__del adm-doc__del" data-promo-del title="Удалить акцию" aria-label="Удалить акцию"><svg class="icon"><use href="#i-trash"/></svg></button>
        </div>
        <div class="adm-doc__photo">
          <span class="adm-img__pic adm-promo__pic">${p.image ? `<img src="${esc(p.image)}" alt="">` : `<span>нет фото</span>`}</span>
          <div class="adm-doc__photo-ctl">
            <b>Фото акции</b>
            <span class="adm-post__meta">Горизонтальное фото — обрежем до 16:10 и уменьшим до 800×500. Можно без фото.</span>
            <div class="adm-doc__photo-btns">
              <label class="btn btn--ghost btn--sm adm-doc__upload">${p.image ? "Заменить фото" : "Загрузить фото"}
                <input type="file" accept="image/jpeg,image/png,image/webp" data-promo-img hidden>
              </label>
              ${p.image ? `<button type="button" class="btn btn--ghost btn--sm adm-doc__nophoto" data-promo-img-del>Удалить фото</button>` : ""}
            </div>
          </div>
        </div>
        <label class="adm-promo__check"><input type="checkbox" data-pf="on" ${p.on ? "checked" : ""}> Показывать на сайте</label>
        <label>Действует до (включительно)<input type="date" data-pf="till" value="${esc(p.till || "")}"></label>
        <label>Заголовок<input data-pf="title" value="${esc(p.title || "")}" placeholder="Профгигиена 1+1" required></label>
        <label>Иконка<select data-pf="icon">${PROMO_ICONS.map(([v, l]) => `<option value="${v}" ${v === (p.icon || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Описание<textarea data-pf="text" rows="2" placeholder="Коротко: что входит и для кого">${esc(p.text || "")}</textarea></label>
        <label>Старая цена (зачёркнутая)<input data-pf="oldPrice" value="${esc(p.oldPrice || "")}" placeholder="9 800 ₽ — можно пусто"></label>
        <label>Цена или скидка<input data-pf="price" value="${esc(p.price || "")}" placeholder="6 990 ₽ или −15%"></label>
        <label class="adm-promo__check"><input type="checkbox" data-pf="accent" ${p.accent ? "checked" : ""}> Выделить — сиреневая стеклянная карточка</label>
        <details class="adm-promo__tr"${(p.en && (p.en.title || p.en.text)) || (p.ar && (p.ar.title || p.ar.text)) ? " open" : ""}>
          <summary>Переводы для английской и арабской версии (необязательно)</summary>
          <div class="adm-promo__tr-grid">
            <label>Заголовок · EN<input data-pf="en.title" value="${esc((p.en && p.en.title) || "")}"></label>
            <label>Описание · EN<input data-pf="en.text" value="${esc((p.en && p.en.text) || "")}"></label>
            <label>Заголовок · AR<input data-pf="ar.title" dir="rtl" value="${esc((p.ar && p.ar.title) || "")}"></label>
            <label>Описание · AR<input data-pf="ar.text" dir="rtl" value="${esc((p.ar && p.ar.text) || "")}"></label>
          </div>
          <span class="adm-post__meta">Без перевода в этих версиях показывается русский текст.</span>
        </details>
      </fieldset>`;
    }).join("") : `<p class="adm-post__meta">Акций пока нет — на сайте вместо них будет приглашение следить за группой ВКонтакте.</p>`;
    updateStats();
  };
  /* забрать введённое из формы в db (без сохранения) */
  const syncPromos = () => {
    db.promos.note = $("#promoNote").value.trim();
    $$(".adm-promo", promosForm).forEach((fs) => {
      const p = db.promos.items.find((x) => x.id === fs.dataset.promo);
      if (!p) return;
      $$("[data-pf]", fs).forEach((el) => {
        const key = el.dataset.pf;
        const val = el.type === "checkbox" ? el.checked : el.value.trim();
        if (key.includes(".")) {
          const [lng, f] = key.split(".");
          p[lng] = p[lng] || {};
          p[lng][f] = val;
          if (!p[lng].title && !p[lng].text) delete p[lng];
        } else p[key] = val;
      });
    });
  };
  if (promosForm) {
    renderPromoEditor();
    promosForm.addEventListener("submit", (e) => {
      e.preventDefault();
      syncPromos();
      const empty = db.promos.items.find((p) => !p.title);
      if (empty) { alert("У каждой акции должен быть заголовок."); return; }
      ChestomDB.save(db);
      renderPromoEditor();
      flash("#promosSaved");
    });
    $("#promoAdd").addEventListener("click", () => {
      syncPromos();
      const d = new Date(); d.setDate(d.getDate() + 30);
      const till = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const id = "p" + Date.now().toString(36);
      db.promos.items.push({ id, on: true, till, accent: false, icon: "i-promo-percent", image: "", title: "Новая акция", text: "", oldPrice: "", price: "" });
      ChestomDB.save(db);
      renderPromoEditor();
      const fs = $(`.adm-promo[data-promo="${id}"]`);
      if (fs) { fs.scrollIntoView({ behavior: "smooth", block: "center" }); $('[data-pf="title"]', fs).select(); }
    });
    $("#promoList").addEventListener("click", (e) => {
      const fs = e.target.closest(".adm-promo");
      if (!fs) return;
      const items = db.promos.items;
      const idx = items.findIndex((x) => x.id === fs.dataset.promo);
      if (idx < 0) return;
      const mv = e.target.closest("[data-promo-move]");
      if (mv) {
        syncPromos();
        const to = idx + +mv.dataset.promoMove;
        if (to < 0 || to >= items.length) return;
        [items[idx], items[to]] = [items[to], items[idx]];
        ChestomDB.save(db);
        renderPromoEditor();
        return;
      }
      if (e.target.closest("[data-promo-del]")) {
        if (!confirm(`Удалить акцию «${items[idx].title}»?`)) return;
        syncPromos();
        items.splice(idx, 1);
        ChestomDB.save(db);
        renderPromoEditor();
        return;
      }
      if (e.target.closest("[data-promo-img-del]")) {
        if (!confirm("Удалить фото акции?")) return;
        syncPromos();
        const prev = items[idx].image;
        items[idx].image = "";
        if (saveOrRollback(() => { items[idx].image = prev; })) renderPromoEditor();
      }
    });
    $("#promoList").addEventListener("change", async (e) => {
      const inp = e.target.closest("[data-promo-img]");
      if (!inp || !inp.files || !inp.files[0]) return;
      const fs = inp.closest(".adm-promo");
      const file = inp.files[0];
      inp.value = "";
      const bad = imageError(file);
      if (bad) { alert(bad); return; }
      let data;
      try { data = await imageToJpeg(file, { w: 800, h: 500, quality: 0.82 }); }
      catch (err) { alert("Не получилось прочитать это изображение. Попробуйте другой файл."); return; }
      syncPromos();
      const p = db.promos.items.find((x) => x.id === fs.dataset.promo);
      if (!p) return;
      const prev = p.image;
      p.image = data;
      if (saveOrRollback(() => { p.image = prev; })) renderPromoEditor();
    });
    /* статус и подсветка меняются сразу, пока человек правит поля */
    $("#promoList").addEventListener("input", (e) => {
      const fs = e.target.closest(".adm-promo");
      if (!fs) return;
      const on = $('[data-pf="on"]', fs).checked, till = $('[data-pf="till"]', fs).value;
      const [st, txt] = promoStatus({ on, till });
      const badge = $(".adm-promo__st", fs);
      badge.className = `adm-promo__st adm-promo__st--${st}`;
      badge.textContent = txt;
      fs.classList.toggle("is-accent", $('[data-pf="accent"]', fs).checked);
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
      renderSvcEditor();                 /* цены в карточках услуг — те же */
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
          ${n.image ? `<div class="adm-post__img"><img src="${esc(n.image)}" alt=""><button type="button" class="btn btn--ghost btn--sm adm-doc__nophoto" data-del-img="${esc(n.id)}">Убрать изображение</button></div>` : ""}
          <p class="adm-post__text">${esc((s => s.length > 160 ? s.slice(0, 160) + "…" : s)(n.text.replace(/[*`#]|\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\n+/g, " ")))}</p>
        </div>`).join("")
      : `<p class="adm-post__meta">Постов пока нет.</p>`;
    updateStats();
  };
  renderPosts();

  /* ── изображение к новому посту ── */
  let postImage = "";
  const setPostImage = (val) => {
    postImage = val || "";
    const pic = $("#postImgPic");
    pic.hidden = !postImage;
    pic.innerHTML = postImage ? `<img src="${postImage}" alt="">` : "";
    $("#postImgDel").hidden = !postImage;
    $("#postImgLabel").textContent = postImage ? "Заменить изображение" : "Добавить изображение";
    const pv = $("#pvImg");
    if (pv) { pv.hidden = !postImage; if (postImage) pv.src = postImage; else pv.removeAttribute("src"); }
    updatePreview();
  };
  $("#postImgInput").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const bad = imageError(file);
    if (bad) { alert(bad); return; }
    try { setPostImage(await imageToJpeg(file, { w: 1200, h: 1200, fit: "max", quality: 0.82 })); }
    catch (err) { alert("Не получилось прочитать это изображение. Попробуйте другой файл."); }
  });
  $("#postImgDel").addEventListener("click", () => setPostImage(""));

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
      text: f.get("text").trim(),
      ...(postImage ? { image: postImage } : {})
    });
    if (!saveOrRollback(() => db.news.pop())) return;
    setPostImage("");
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
    const imgBtn = e.target.closest("[data-del-img]");
    if (imgBtn) {
      const post = db.news.find((n) => n.id === imgBtn.dataset.delImg);
      if (!post || !confirm("Убрать изображение из поста? Текст останется.")) return;
      delete post.image;
      ChestomDB.save(db);
      renderPosts();
      return;
    }
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
