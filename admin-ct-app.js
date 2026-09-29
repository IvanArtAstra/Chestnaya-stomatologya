/* ═══════════ Просмотр снимков: интерфейс ═══════════
   Стартовый экран, загрузка, панель инструментов, раскладки окон,
   настройки, измерения, горячие клавиши, отчёт. Окна — admin-ct-mpr.js
   и admin-ct-3d.js, разбор файлов — admin-ct.js.
   Монтируется в админке по ChestomCT.mount(host). */
(function () {
  "use strict";
  const CT = window.ChestomCT;
  const { V, PLANE, NAMES, MPR } = CT;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt1 = v => v.toFixed(1).replace(".", ",");
  const sv = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const ICON = {
    cross: sv('<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="2"/>'),
    pan: sv('<path d="M8 11V6a1.5 1.5 0 0 1 3 0v4M11 10V4.5a1.5 1.5 0 0 1 3 0V10M14 10V6a1.5 1.5 0 0 1 3 0v6c0 4-2.5 8-6.5 8S5 17 4 14l-1-3a1.5 1.5 0 0 1 2.7-1.2L8 13"/>'),
    wl: sv('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>'),
    ruler: sv('<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
    angle: sv('<path d="M4 20h16M4 20 15 5"/><path d="M10 20a6 6 0 0 0-2-4.5"/>'),
    arrow: sv('<path d="M5 19 19 5M19 5h-7M19 5v7"/>'),
    text: sv('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    canal: sv('<path d="M3 15c3-4 6-6 9-6s6 2 9 6"/><circle cx="3" cy="15" r="1.4"/><circle cx="21" cy="15" r="1.4"/>'),
    arch: sv('<path d="M4 18c0-7 3.5-12 8-12s8 5 8 12"/><circle cx="4" cy="18" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="20" cy="18" r="1.6"/>'),
    calib: sv('<path d="M4 12h16M4 8v8M20 8v8M8 10v4M12 10v4M16 10v4"/>'),
    reset: sv('<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>'),
    grid: sv('<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>'),
    main: sv('<rect x="3" y="3" width="12" height="18" rx="1.5"/><rect x="17" y="3" width="4" height="5" rx="1"/><rect x="17" y="9.5" width="4" height="5" rx="1"/><rect x="17" y="16" width="4" height="5" rx="1"/>'),
    one: sv('<rect x="3" y="3" width="18" height="18" rx="2"/>'),
    pano: sv('<rect x="3" y="5" width="18" height="8" rx="1.5"/><rect x="3" y="15.5" width="4" height="4" rx="1"/><rect x="8.7" y="15.5" width="4" height="4" rx="1"/><rect x="14.4" y="15.5" width="4" height="4" rx="1"/>'),
    play: sv('<path d="M8 5v14l11-7z" fill="currentColor"/>'),
    pause: sv('<path d="M8 5v14M16 5v14"/>'),
    shot: sv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    report: sv('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
    print: sv('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>'),
    full: sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    help: sv('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.2v.3"/>'),
    close: sv('<path d="M6 6l12 12M18 6 6 18"/>'),
    folder: sv('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    file: sv('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>'),
    demo: sv('<path d="M12 3C8 3 5.5 5.6 5.5 8.8c0 2.6 1.3 3.9 1.9 6.5.5 2 .9 5.7 2.2 5.7 1.5 0 1-4.4 2.4-4.4s.9 4.4 2.4 4.4c1.3 0 1.7-3.7 2.2-5.7.6-2.6 1.9-3.9 1.9-6.5C18.5 5.6 16 3 12 3z"/>'),
    lock: sv('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    max: sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    trash: sv('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
    undo: sv('<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-2"/>'),
    rotL: sv('<path d="M4 9a8 8 0 1 1 1 7"/><path d="M4 4v5h5"/>'),
    rotR: sv('<path d="M20 9a8 8 0 1 0-1 7"/><path d="M20 4v5h-5"/>'),
    flip: sv('<path d="M12 3v18M8 7 4 12l4 5V7zM16 7l4 5-4 5z"/>'),
    eye: sv('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: sv('<path d="M3 3l18 18M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4"/>'),
  };
  const TOOL_INFO = {
    cross: ["Перекрестие", "C", "Клик — точка на всех срезах · тяните кружок на линии — повернуть срез · тяните линию — сдвинуть срез · колесо — листать"],
    pan: ["Сдвиг", "H", "Тяните — сдвинуть изображение · Ctrl + колесо или щипок — масштаб"],
    wl: ["Яркость и контраст", "W", "Тяните: вправо — шире окно (мягче), вверх — ярче"],
    ruler: ["Линейка", "M", "Тяните от точки к точке — расстояние в миллиметрах"],
    angle: ["Угол", "A", "Три щелчка: начало, вершина угла, конец"],
    arrow: ["Стрелка", "S", "Тяните от хвоста к острию, затем подпишите (можно пусто)"],
    text: ["Текст", "T", "Щелчок — место подписи, затем введите текст"],
    canal: ["Канал нерва", "K", "На панораме: щелчки вдоль канала · двойной щелчок или Enter — готово"],
    arch: ["Дуга челюсти", "D", "На аксиальном срезе: щелчки по дуге от правой стороны пациента к левой · двойной щелчок — готово"],
    calib: ["Калибровка", "L", "Проведите вдоль предмета известной длины и введите её в мм"],
  };
  const LAYOUTS = { grid: ["2×2", "G"], main: ["1 + 3", "3"], one: ["Одно окно", "1"], pano: ["Панорама", "P"] };
  const VR_MODES = [["bone", "Кость"], ["teeth", "Зубы"], ["soft", "Ткани"], ["xray", "Рентген"], ["mip", "MIP"]];

  function autoWindow(o) {
    const lo = o.lo, hi = o.hi;
    return { level: Math.round((lo + hi) / 2 + (hi - lo) * 0.08), width: Math.max(1, Math.round((hi - lo) * 0.9)) };
  }
  /* единицы КЛКТ разнятся от аппарата к аппарату: пресеты в HU, если
     диапазон похож на HU, иначе — от гистограммы снимка */
  function presets(vol) {
    if (vol.huLike) return { auto: autoWindow(vol), bone: { level: 1100, width: 3600 }, fine: { level: 500, width: 1600 }, soft: { level: 60, width: 500 } };
    const span = vol.hi - vol.lo;
    return { auto: autoWindow(vol), bone: { level: vol.lo + span * 0.62, width: span * 1.1 }, fine: { level: vol.lo + span * 0.55, width: span * 0.55 }, soft: { level: vol.lo + span * 0.3, width: span * 0.25 } };
  }
  const dmy = d => (d && d.length === 8 ? `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}` : "");

  /* ═══════════════ Приложение ═══════════════ */
  class App {
    constructor(host) {
      this.host = host; this.s = null; this.views = {}; this.raf = 0; this.fast = false;
      this.renderEmpty();
    }
    get showArch() { return !!(this.s && this.s.mode === "volume" && this.s.layout === "pano"); }

    /* ── стартовый экран ── */
    renderEmpty(msg) {
      this.dispose();
      this.host.innerHTML = "";
      const box = h("div", "ct-empty");
      box.innerHTML = `
        <div class="ct-start" tabindex="-1">
          <div class="ct-start__head">
            <span class="ct-start__ico">${ICON.demo}</span>
            <div><b>Откройте снимок</b><span>Перетащите сюда папку или файлы — или выберите ниже</span></div>
          </div>
          <div class="ct-start__opts">
            <label class="ct-opt ct-opt--main">${ICON.folder}<b>Папка КЛКТ или КТ</b><span>Сотни файлов DICOM с аппарата или диска пациента</span>
              <input type="file" webkitdirectory directory multiple hidden data-pick="dir"></label>
            <label class="ct-opt">${ICON.file}<b>Файлы или снимок</b><span>Панорама, прицельный, фото — DICOM, JPG, PNG</span>
              <input type="file" multiple hidden data-pick="files"></label>
            <button type="button" class="ct-opt" data-act="demo">${ICON.demo}<b>Демо-снимок</b><span>Синтетическая челюсть — попробовать все инструменты</span></button>
          </div>
          ${msg ? `<p class="ct-start__err" role="alert">${esc(msg)}</p>` : ""}
          <p class="ct-start__fmt">DICOM без сжатия, RLE, JPEG Lossless, JPEG · JPG, PNG, WebP</p>
        </div>
        <p class="ct-privacy">${ICON.lock}<span>Снимок открывается только на этом компьютере: файлы не загружаются на сервер и не сохраняются. Закрыли вкладку — данных нет.</span></p>`;
      this.host.appendChild(box);
      box.querySelectorAll("input[type=file]").forEach(inp => inp.addEventListener("change", () => { const f = [...inp.files]; inp.value = ""; this.load(f); }));
      box.querySelector('[data-act="demo"]').addEventListener("click", () => this.demo());
      const zone = box.querySelector(".ct-start");
      zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("is-over"); });
      zone.addEventListener("dragleave", e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove("is-over"); });
      zone.addEventListener("drop", async e => {
        e.preventDefault(); zone.classList.remove("is-over");
        const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
        this.load(items.length ? await readEntries(items) : [...e.dataTransfer.files]);
      });
    }
    loading(title, total) {
      this.host.innerHTML = `<div class="ct-loading" role="status"><span class="ct-loading__spin"></span><b>${esc(title)}</b><div class="ct-bar"><i></i></div><span data-l>${total ? `0 из ${total}` : ""}</span><button type="button" class="btn btn--ghost btn--sm" data-act="cancel">Отмена</button></div>`;
      const bar = this.host.querySelector(".ct-bar i"), lbl = this.host.querySelector("[data-l]");
      this.abort = new AbortController();
      this.host.querySelector('[data-act="cancel"]').addEventListener("click", () => this.abort.abort());
      return p => { bar.style.width = (p * 100).toFixed(1) + "%"; if (total) lbl.textContent = `${Math.round(p * total)} из ${total} файлов`; };
    }
    async demo() {
      this.loading("Строим демо-снимок…");
      await new Promise(r => setTimeout(r, 30));
      this.startVolume(CT.demoVolume());
    }
    async load(files) {
      files = files.filter(f => f.size > 128 && !/^dicomdir$/i.test(f.name) && !/\.(txt|pdf|exe|dll|inf|ini|html?|js|css|xml|zip|ico|json|db|lnk|dat|log|cfg|plist)$/i.test(f.name));
      files.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true }));
      if (!files.length) return this.renderEmpty("В выбранном нет снимков: нужны файлы DICOM или изображения JPG/PNG.");
      const kind = await CT.sniff(files);
      if (kind === "photo") return this.loadPhotos(files);
      const prog = this.loading("Читаем снимок…", files.length);
      try {
        const vol = await CT.buildVolume(files, prog, this.abort.signal);
        if (vol.nz === 1) return this.loadPhotos(files.slice(0, 1));
        this.startVolume(vol);
      } catch (e) {
        if (e.message === "cancel") return this.renderEmpty();
        console.error(e);
        const m = String(e.message);
        this.renderEmpty(m.startsWith("codec:")
          ? `Файлы сжаты форматом «${m.slice(6)}» — его браузер открыть не может. Выгрузите снимок из программы аппарата без сжатия (Uncompressed) или в JPEG Lossless — такие открываются.`
          : m === "empty" ? "Не нашли в файлах изображений DICOM. Проверьте, что выбрана папка со снимком."
          : "Не получилось прочитать снимок: " + (m || "ошибка") + ". Если объём очень большой, попробуйте на компьютере с большей памятью.");
      }
    }
    async loadPhotos(files) {
      const prog = this.loading("Открываем снимки…", files.length), list = [];
      for (let i = 0; i < files.length && i < 40; i++) {
        if (this.abort.signal.aborted) return this.renderEmpty();
        try { list.push(await CT.loadPhoto(files[i])); } catch (e) { console.warn(e); }
        prog((i + 1) / files.length);
      }
      if (!list.length) return this.renderEmpty("Не удалось открыть файлы как снимки. Нужны DICOM, JPG или PNG.");
      this.startPhoto(list);
    }

    /* ═══ объём ═══ */
    startVolume(vol) {
      const auto = autoWindow(vol);
      this.s = {
        mode: "volume", vol, p: V.mul(vol.ext, 0.5), views: CT.copyBases(CT.CANON),
        level: auto.level, width: auto.width, preset: "auto", invert: false, slabMode: "thin", slabMm: 10,
        tool: "cross", layout: "grid", active: "axial",
        vrMode: "bone", thrHu: Math.round(vol.otsu), opacity: 0.85, cut: "none", outlines: true, turntable: false,
        showName: false, anns: [], sel: null, nextId: 1,
        arch: null, archG: null, pano: { thick: 12, mode: "avg", s0: null, spacing: 1, count: 5, width: 30 },
      };
      this.P = presets(vol);
      this.build();
    }
    /* ═══ 2D-снимки ═══ */
    startPhoto(list) {
      const first = list[0], auto = first.gray ? (first.wc && first.ww ? { level: first.wc, width: first.ww } : autoWindow(first)) : { level: 0, width: 1 };
      this.s = {
        mode: "photo", photo: { list, idx: 0, bright: 0, contrast: 0, gamma: 1, invert: false, rot: 0, flip: false },
        level: auto.level, width: auto.width, preset: "auto", invert: false,
        tool: "pan", layout: "one", active: "photo", showName: false, anns: [], sel: null, nextId: 1,
      };
      this.build();
    }

    /* ── каркас ── */
    build() {
      const S = this.s, isVol = S.mode === "volume";
      this.host.innerHTML = "";
      const root = h("div", "ct"); this.root = root; root.dataset.mode = S.mode;
      root.appendChild(this.header());
      root.appendChild(this.toolbar());
      const body = h("div", "ct-body"); root.appendChild(body);
      const main = h("div", "ct-main"); body.appendChild(main);
      const tabs = h("div", "ct-tabs"); main.appendChild(tabs); this.tabsEl = tabs;
      const grid = h("div", "ct-grid"); this.grid = grid; main.appendChild(grid);
      const status = h("div", "ct-status", `<span data-st="hint"></span><span data-st="hover"></span>`); main.appendChild(status);
      this.statusEl = status;
      if (isVol) {
        for (const k of ["axial", "coronal", "sagittal", "vr", "pano", "xs"]) {
          const cell = h("div", "ct-cell"); cell.dataset.view = k;
          cell.innerHTML = `<span class="ct-cell__tag" style="--c:${PLANE[k] || (k === "pano" || k === "xs" ? "#ffd166" : "#b8b2ff")}">${NAMES[k]}</span>` +
            (k === "xs" ? "" : `<button type="button" class="ct-cell__max" data-tip="Развернуть · двойной щелчок" aria-label="Развернуть">${ICON.max}</button>`);
          grid.appendChild(cell);
          const mx = cell.querySelector(".ct-cell__max"); if (mx) mx.addEventListener("click", () => this.toggleMax(k));
          if (k === "vr") this.views.vr = new CT.View3D(this, "vr", cell);
          else if (k === "pano") this.views.pano = new CT.PanoView(this, "pano", cell);
          else if (k === "xs") { this.xsCell = cell; this.buildXs(); }
          else this.views[k] = new CT.MprView(this, k, cell);
          const tb = h("button", "", NAMES[k]); tb.type = "button"; tb.dataset.view = k;
          tb.addEventListener("click", () => this.mobileShow(k)); tabs.appendChild(tb);
        }
      } else {
        const cell = h("div", "ct-cell"); cell.dataset.view = "photo"; grid.appendChild(cell);
        this.views.photo = new CT.PhotoView(this, "photo", cell);
      }
      body.appendChild(isVol ? this.panelVolume() : this.panelPhoto());
      this.host.appendChild(root);
      this.makeLut();
      this.ro = new ResizeObserver(() => this.resizeAll());
      this.ro.observe(this.grid);
      this.onWinResize = () => this.fitHeight();
      window.addEventListener("resize", this.onWinResize);
      this.fitHeight();
      this.applyLayout();
      this.syncUI();
      this.keys = e => this.onKey(e);
      document.addEventListener("keydown", this.keys);
      this.fsHandler = () => { root.classList.toggle("is-full", document.fullscreenElement === root); requestAnimationFrame(() => this.resizeAll()); };
      document.addEventListener("fullscreenchange", this.fsHandler);
      /* поворот телефона или сужение окна — перестраиваем раскладку */
      this.mq = matchMedia("(max-width: 1100px)");
      this.mqHandler = () => this.applyLayout();
      this.mq.addEventListener("change", this.mqHandler);
    }
    header() {
      const S = this.s, hd = h("div", "ct-head");
      let title, meta = [];
      if (S.mode === "volume") {
        const v = S.vol, m = v.meta;
        title = m.demo ? "Демо-снимок · синтетический КЛКТ" : [m.maker, m.model].filter(Boolean).join(" ") || "Снимок КЛКТ";
        if (dmy(m.date)) meta.push(dmy(m.date));
        if (m.study && !m.demo) meta.push(m.study);
        meta.push(`${fmt1(v.nx * v.sx)}×${fmt1(v.ny * v.sy)}×${fmt1(v.nz * v.sz)} мм`, `воксель ${v.sx.toFixed(2).replace(".", ",")} мм`);
        if (v.codec) meta.push(v.codec);
      } else {
        const p = S.photo.list[0];
        title = S.photo.list.length > 1 ? `Снимки · ${S.photo.list.length}` : p.name;
        if (p.meta && dmy(p.meta.date)) meta.push(dmy(p.meta.date));
      }
      hd.innerHTML = `
        <div class="ct-head__t"><b>${esc(title)}</b><span>${esc(meta.join(" · "))}</span></div>
        <button type="button" class="ct-chip" data-act="name" aria-pressed="false"></button>
        <div class="ct-head__acts">
          <button type="button" data-act="report" data-tip="Отчёт PNG для пациента или коллеги">${ICON.report}<span>Отчёт</span></button>
          <button type="button" data-act="print" data-tip="Печать отчёта">${ICON.print}<span>Печать</span></button>
          <button type="button" data-act="shot" data-tip="Кадр активного окна в PNG">${ICON.shot}<span>Кадр</span></button>
          <button type="button" data-act="full" data-tip="Во весь экран · F">${ICON.full}</button>
          <button type="button" data-act="help" data-tip="Подсказки и клавиши · ?">${ICON.help}</button>
          <button type="button" data-act="close" class="ct-x" data-tip="Закрыть снимок">${ICON.close}<span>Закрыть</span></button>
        </div>`;
      hd.addEventListener("click", e => {
        const b = e.target.closest("[data-act]"); if (!b) return;
        const a = b.dataset.act;
        if (a === "name") { this.s.showName = !this.s.showName; this.syncUI(); }
        else if (a === "report") this.report(false);
        else if (a === "print") this.report(true);
        else if (a === "shot") this.shot();
        else if (a === "full") this.fullscreen();
        else if (a === "help") this.help();
        else if (a === "close") this.renderEmpty();
      });
      return hd;
    }
    toolbar() {
      const S = this.s, isVol = S.mode === "volume", tb = h("div", "ct-toolbar");
      tb.setAttribute("role", "toolbar"); tb.setAttribute("aria-label", "Инструменты");
      const tool = k => `<button type="button" data-tool="${k}" data-tip="${TOOL_INFO[k][0]} · ${TOOL_INFO[k][1]}" aria-label="${TOOL_INFO[k][0]}">${ICON[k]}<span>${TOOL_INFO[k][0]}</span></button>`;
      const groups = isVol
        ? [["cross", "pan", "wl"], ["ruler", "angle", "arrow", "text"], ["canal", "arch"]]
        : [["pan", "wl"], ["ruler", "angle", "arrow", "text"], ["calib"]];
      let html = groups.map(g => `<div class="ct-grp">${g.map(tool).join("")}</div>`).join('<span class="ct-sep"></span>');
      if (isVol) {
        html += '<span class="ct-sep"></span><div class="ct-grp ct-layouts">' +
          Object.entries(LAYOUTS).map(([k, [t, key]]) => `<button type="button" data-layout="${k}" data-tip="${t} · ${key}" aria-label="${t}">${ICON[k]}</button>`).join("") + "</div>";
        html += `<span class="ct-sep"></span><div class="ct-grp"><button type="button" data-act="cine" data-tip="Прокрутка срезов · Пробел">${ICON.play}<span>Прокрутка</span></button>
          <button type="button" data-act="reset" data-tip="Сбросить вид и наклон · 0">${ICON.reset}<span>Сброс</span></button></div>`;
      } else {
        html += `<span class="ct-sep"></span><div class="ct-grp">
          <button type="button" data-act="rotL" data-tip="Повернуть влево">${ICON.rotL}</button><button type="button" data-act="rotR" data-tip="Повернуть вправо">${ICON.rotR}</button>
          <button type="button" data-act="flip" data-tip="Отразить">${ICON.flip}</button><button type="button" data-act="reset" data-tip="Сбросить вид · 0">${ICON.reset}</button></div>`;
      }
      tb.innerHTML = html;
      tb.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.tool) this.setTool(b.dataset.tool);
        else if (b.dataset.layout) this.setLayout(b.dataset.layout);
        else if (b.dataset.act === "cine") this.cine();
        else if (b.dataset.act === "reset") this.resetView();
        else if (b.dataset.act === "rotL" || b.dataset.act === "rotR") { S.photo.rot = (S.photo.rot + (b.dataset.act === "rotR" ? 90 : 270)) % 360; this.requestAll(); }
        else if (b.dataset.act === "flip") { S.photo.flip = !S.photo.flip; this.requestAll(); }
      });
      return tb;
    }

    /* ── панель: объём ── */
    panelVolume() {
      const S = this.s, vol = S.vol, p = h("aside", "ct-panel"), huMin = Math.floor(vol.lo), huMax = Math.ceil(vol.hi);
      p.innerHTML = `
        <details open data-sec="img"><summary>Изображение</summary>
          <div class="ct-seg" data-group="preset"><button type="button" data-v="auto">Авто</button><button type="button" data-v="bone">Кость</button><button type="button" data-v="fine">Тонкая кость</button><button type="button" data-v="soft">Мягкие ткани</button></div>
          <canvas class="ct-hist" width="560" height="110" aria-hidden="true"></canvas>
          <label class="ct-range"><span>Уровень <output data-out="level"></output></span><input type="range" data-k="level" min="${huMin}" max="${huMax}" step="1"></label>
          <label class="ct-range"><span>Ширина <output data-out="width"></output></span><input type="range" data-k="width" min="1" max="${Math.max(2, huMax - huMin) * 2}" step="1"></label>
          <label class="ct-switch"><input type="checkbox" data-k="invert"><span>Инверсия</span></label>
        </details>
        <details open data-sec="slab"><summary>Толщина среза</summary>
          <div class="ct-seg" data-group="slabMode"><button type="button" data-v="thin">Тонкий</button><button type="button" data-v="mip">MIP</button><button type="button" data-v="avg">Среднее</button></div>
          <label class="ct-range"><span>Толщина <output data-out="slabMm"></output></span><input type="range" data-k="slabMm" min="1" max="40" step="1"></label>
        </details>
        <details open data-sec="pano"><summary>Панорама и сечения</summary>
          <div class="ct-row"><button type="button" class="ct-btn ct-btn--acc" data-act="openPano">${ICON.pano}Открыть панораму</button></div>
          <div class="ct-row"><button type="button" class="ct-btn" data-act="autoArch">Найти дугу на срезе</button><button type="button" class="ct-btn" data-act="drawArch">${ICON.arch}Нарисовать</button></div>
          <p class="ct-hint" data-pano-msg>Дуга строится по аксиальному срезу на уровне корней. Точки дуги можно перетаскивать.</p>
          <label class="ct-range"><span>Толщина панорамы <output data-out="pano.thick"></output></span><input type="range" data-k="pano.thick" min="2" max="30" step="1"></label>
          <div class="ct-seg" data-group="pano.mode"><button type="button" data-v="avg">Как ОПТГ</button><button type="button" data-v="mip">MIP</button></div>
          <label class="ct-range"><span>Шаг сечений <output data-out="pano.spacing"></output></span><input type="range" data-k="pano.spacing" min="0.5" max="5" step="0.5"></label>
          <label class="ct-range"><span>Ширина сечения <output data-out="pano.width"></output></span><input type="range" data-k="pano.width" min="14" max="50" step="1"></label>
          <div class="ct-seg" data-group="pano.count"><button type="button" data-v="3">3 сечения</button><button type="button" data-v="5">5</button><button type="button" data-v="7">7</button></div>
        </details>
        <details open data-sec="vr"><summary>3D</summary>
          <div class="ct-seg" data-group="vrMode">${VR_MODES.map(([k, t]) => `<button type="button" data-v="${k}">${t}</button>`).join("")}</div>
          <label class="ct-range" data-thr><span>Порог кости <output data-out="thrHu"></output></span><input type="range" data-k="thrHu" min="${huMin}" max="${huMax}" step="1"></label>
          <label class="ct-range"><span data-op-lbl>Непрозрачность <output data-out="opacity"></output></span><input type="range" data-k="opacity" min="0.05" max="1" step="0.01"></label>
          <span class="ct-lbl">Разрез по перекрестию</span>
          <div class="ct-seg" data-group="cut"><button type="button" data-v="none">Нет</button><button type="button" data-v="axial">Сверху</button><button type="button" data-v="front">Спереди</button><button type="button" data-v="octant">Угол</button></div>
          <span class="ct-lbl">Вид</span>
          <div class="ct-seg" data-group="view3d"><button type="button" data-v="front">Спереди</button><button type="button" data-v="left">Справа</button><button type="button" data-v="right">Слева</button><button type="button" data-v="top">Сверху</button><button type="button" data-v="iso">3/4</button></div>
          <label class="ct-switch"><input type="checkbox" data-k="outlines"><span>Контуры срезов</span></label>
          <label class="ct-switch"><input type="checkbox" data-k="turntable"><span>Вращение</span></label>
        </details>
        ${this.annSection()}
        <details data-sec="info"><summary>Исследование</summary>
          <dl class="ct-dl">
            ${vol.demo ? "<dt>Источник</dt><dd>демо, данные рассчитаны</dd>" : `<dt>Файлов</dt><dd>${vol.files}${vol.skipped ? ` (пропущено ${vol.skipped})` : ""}</dd>`}
            <dt>Срезов</dt><dd>${vol.nx}×${vol.ny}×${vol.nz}</dd>
            <dt>Объём</dt><dd>${fmt1(vol.nx * vol.sx)}×${fmt1(vol.ny * vol.sy)}×${fmt1(vol.nz * vol.sz)} мм</dd>
            <dt>Воксель</dt><dd>${vol.sx.toFixed(2)}×${vol.sy.toFixed(2)}×${vol.sz.toFixed(2)} мм</dd>
            <dt>Плотность</dt><dd>${Math.round(vol.min)}…${Math.round(vol.max)}${vol.huLike ? " HU" : ""}</dd>
            ${vol.codec ? `<dt>Сжатие</dt><dd>${esc(vol.codec)}</dd>` : ""}
            ${vol.factor > 1 ? `<dt>Прорежено</dt><dd>×${vol.factor} по срезу — объём большой</dd>` : ""}
          </dl>
          <p class="ct-note">${ICON.lock}Снимок только в памяти этой вкладки, на сервер не отправляется.</p>
        </details>`;
      this.hist = p.querySelector(".ct-hist");
      this.bindPanel(p);
      return p;
    }
    panelPhoto() {
      const S = this.s, P0 = S.photo.list[0], p = h("aside", "ct-panel");
      const gray = !!P0.gray;
      p.innerHTML = `
        <details open data-sec="img"><summary>Изображение</summary>
          ${gray ? `
          <div class="ct-seg" data-group="preset"><button type="button" data-v="auto">Авто</button><button type="button" data-v="file">Из файла</button></div>
          <canvas class="ct-hist" width="560" height="110" aria-hidden="true"></canvas>
          <label class="ct-range"><span>Уровень <output data-out="level"></output></span><input type="range" data-k="level" min="${Math.floor(P0.lo)}" max="${Math.ceil(P0.hi)}" step="1"></label>
          <label class="ct-range"><span>Ширина <output data-out="width"></output></span><input type="range" data-k="width" min="1" max="${Math.max(2, (P0.hi - P0.lo) * 2)}" step="1"></label>
          <label class="ct-switch"><input type="checkbox" data-k="invert"><span>Инверсия</span></label>` : `
          <label class="ct-range"><span>Яркость <output data-out="photo.bright"></output></span><input type="range" data-k="photo.bright" min="-100" max="100" step="1"></label>
          <label class="ct-range"><span>Контраст <output data-out="photo.contrast"></output></span><input type="range" data-k="photo.contrast" min="-80" max="150" step="1"></label>
          <label class="ct-range"><span>Гамма <output data-out="photo.gamma"></output></span><input type="range" data-k="photo.gamma" min="0.4" max="2.5" step="0.05"></label>
          <label class="ct-switch"><input type="checkbox" data-k="photo.invert"><span>Инверсия (негатив)</span></label>`}
        </details>
        <details open data-sec="calib"><summary>Калибровка</summary>
          <p class="ct-hint" data-calib-msg></p>
          <div class="ct-row"><button type="button" class="ct-btn" data-act="calib">${ICON.calib}Калибровать по эталону</button></div>
        </details>
        ${this.annSection()}
        ${S.photo.list.length > 1 ? `<details open data-sec="files"><summary>Снимки</summary><div class="ct-thumbs"></div></details>` : ""}
        <details data-sec="info"><summary>Снимок</summary>
          <dl class="ct-dl" data-photo-info></dl>
          <p class="ct-note">${ICON.lock}Снимок только в памяти этой вкладки, на сервер не отправляется.</p>
        </details>`;
      this.hist = p.querySelector(".ct-hist");
      this.bindPanel(p);
      const th = p.querySelector(".ct-thumbs");
      if (th) S.photo.list.forEach((ph, i) => {
        const b = h("button", "ct-thumb"); b.type = "button"; b.dataset.i = i; b.title = ph.name;
        const c = document.createElement("canvas"), k = 120 / Math.max(ph.w, ph.h); c.width = Math.max(1, ph.w * k); c.height = Math.max(1, ph.h * k);
        const tmp = document.createElement("canvas"); tmp.width = ph.w; tmp.height = ph.h;
        const id = tmp.getContext("2d").createImageData(ph.w, ph.h);
        if (ph.rgba) id.data.set(ph.rgba); else { const a = autoWindow(ph); for (let q = 0, o = 0; q < ph.gray.length; q++, o += 4) { const v = clamp((ph.gray[q] - (a.level - a.width / 2)) / a.width * 255, 0, 255); id.data[o] = id.data[o + 1] = id.data[o + 2] = v; id.data[o + 3] = 255; } }
        tmp.getContext("2d").putImageData(id, 0, 0); c.getContext("2d").drawImage(tmp, 0, 0, c.width, c.height);
        b.appendChild(c); b.appendChild(h("span", "", esc(ph.name)));
        b.addEventListener("click", () => this.selectPhoto(i));
        th.appendChild(b);
      });
      return p;
    }
    annSection() {
      return `<details open data-sec="anns"><summary>Измерения и пометки <em data-ann-count></em></summary>
          <ul class="ct-anns" data-anns></ul>
          <div class="ct-row"><button type="button" class="ct-btn" data-act="undo">${ICON.undo}Отменить</button><button type="button" class="ct-btn" data-act="clearAnns">${ICON.trash}Очистить</button></div>
        </details>`;
    }
    bindPanel(p) {
      const S = this.s;
      const get = k => k.split(".").reduce((o, x) => o[x], S);
      const set = (k, v) => { const ks = k.split("."), last = ks.pop(); ks.reduce((o, x) => o[x], S)[last] = v; };
      this.panelGet = get;
      p.querySelectorAll(".ct-seg").forEach(seg => seg.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        const g = seg.dataset.group; let v = b.dataset.v;
        if (g === "preset") {
          if (S.mode === "photo") { const ph = this.photoCur(); const w = v === "file" && ph.wc && ph.ww ? { level: ph.wc, width: ph.ww } : autoWindow(ph); S.level = w.level; S.width = w.width; }
          else { const pr = this.P[v]; S.level = pr.level; S.width = pr.width; }
          S.preset = v; this.windowChanged(); return;
        }
        if (g === "view3d") { if (this.views.vr) this.views.vr.setView(v); return; }
        if (g === "pano.count") v = +v;
        set(g, v);
        if (g === "slabMode") this.requestAll();
        else if (g === "pano.count") this.buildXs();
        else if (g.startsWith("pano.")) this.panoChanged();
        else this.request("vr");
        this.syncUI();
      }));
      p.querySelectorAll("input[data-k]").forEach(inp => inp.addEventListener("input", () => {
        const k = inp.dataset.k;
        set(k, inp.type === "checkbox" ? inp.checked : +inp.value);
        if (k === "level" || k === "width" || k === "invert") { if (k !== "invert") S.preset = ""; this.windowChanged(); }
        else if (k === "slabMm") this.requestAll();
        else if (k === "turntable") this.spin();
        else if (k.startsWith("pano.")) this.panoChanged(k === "pano.thick");
        else if (k.startsWith("photo.")) this.requestAll();
        else this.request("vr");
        this.syncUI(true);
      }));
      p.addEventListener("click", e => {
        const b = e.target.closest("[data-act]"); if (!b) return;
        const a = b.dataset.act;
        if (a === "openPano") this.setLayout("pano");
        else if (a === "autoArch") this.autoArch(true);
        else if (a === "drawArch") { if (S.layout !== "pano") this.setLayout("pano"); this.setTool("arch"); }
        else if (a === "undo") this.undo();
        else if (a === "clearAnns") { S.anns = S.anns.filter(x => !this.annVisibleHere(x)); S.sel = null; this.annsChanged(); }
        else if (a === "calib") this.setTool("calib");
      });
    }

    /* ── синхронизация интерфейса с состоянием ── */
    syncUI(skipInputs) {
      const S = this.s, r = this.root; if (!r) return;
      r.dataset.tool = S.tool; r.dataset.layout = S.layout;
      r.querySelectorAll("[data-tool]").forEach(b => { const on = b.dataset.tool === S.tool; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); });
      r.querySelectorAll("[data-layout]").forEach(b => { const on = b.dataset.layout === S.layout; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); });
      r.querySelectorAll(".ct-seg").forEach(seg => {
        const g = seg.dataset.group; if (g === "view3d") return;
        const cur = String(g === "preset" ? S.preset : this.panelGet(g));
        seg.querySelectorAll("button").forEach(b => b.classList.toggle("is-on", cur === b.dataset.v));
      });
      if (!skipInputs) r.querySelectorAll("input[data-k]").forEach(inp => { const v = this.panelGet(inp.dataset.k); if (inp.type === "checkbox") inp.checked = !!v; else inp.value = v; });
      const f = {
        level: v => Math.round(v), width: v => Math.round(v), slabMm: v => v + " мм", thrHu: v => Math.round(v), opacity: v => Math.round(v * 100) + "%",
        "pano.thick": v => v + " мм", "pano.spacing": v => fmt1(v) + " мм", "pano.width": v => v + " мм",
        "photo.bright": v => (v > 0 ? "+" : "") + v, "photo.contrast": v => (v > 0 ? "+" : "") + v, "photo.gamma": v => v.toFixed(2).replace(".", ","),
      };
      r.querySelectorAll("output[data-out]").forEach(o => { const k = o.dataset.out; o.textContent = (f[k] || String)(this.panelGet(k)); });
      if (S.mode === "volume") {
        const opl = r.querySelector("[data-op-lbl]"); if (opl) opl.firstChild.textContent = S.vrMode === "xray" ? "Плотность рентгена " : "Непрозрачность ";
        const thr = r.querySelector("[data-thr]"); if (thr) thr.hidden = S.vrMode === "xray" || S.vrMode === "mip";
        const cine = r.querySelector('[data-act="cine"]'); if (cine) { cine.classList.toggle("is-on", !!this.cineOn); cine.innerHTML = (this.cineOn ? ICON.pause : ICON.play) + "<span>Прокрутка</span>"; }
        r.querySelectorAll('[data-tool="canal"], [data-tool="arch"]').forEach(b => b.classList.toggle("is-dim", S.layout !== "pano"));
      } else {
        const ph = this.photoCur(), m = r.querySelector("[data-calib-msg]");
        if (m) m.textContent = ph.pxMm ? `1 пиксель = ${ph.pxMm.toFixed(4).replace(".", ",")} мм${ph.calibrated ? " (по эталону)" : " (из файла)"} — линейка в миллиметрах.` : "Размер пикселя неизвестен — линейка показывает пиксели. Проведите линию по предмету известной длины (эталон, коронка, имплант) и введите её в мм.";
        const inf = r.querySelector("[data-photo-info]");
        if (inf) inf.innerHTML = `<dt>Файл</dt><dd>${esc(ph.name)}</dd><dt>Размер</dt><dd>${ph.w}×${ph.h} пикс</dd>${ph.meta && ph.meta.modality ? `<dt>Тип</dt><dd>${esc(ph.meta.modality)}</dd>` : ""}`;
        r.querySelectorAll(".ct-thumb").forEach(b => b.classList.toggle("is-on", +b.dataset.i === S.photo.idx));
      }
      const chip = r.querySelector('[data-act="name"]'), meta = S.mode === "volume" ? S.vol.meta : this.photoCur().meta || {};
      chip.innerHTML = (S.showName ? ICON.eye : ICON.eyeOff) + `<span>${S.showName ? esc([meta.patient, meta.patientId ? "ID " + meta.patientId : ""].filter(Boolean).join(" · ") || "ФИО нет в файлах") : "Данные пациента скрыты"}</span>`;
      chip.setAttribute("aria-pressed", S.showName); chip.dataset.tip = S.showName ? "Скрыть ФИО" : "Показать ФИО пациента";
      this.statusEl.querySelector('[data-st="hint"]').textContent = (TOOL_INFO[S.tool] || [])[2] || "";
      this.drawHist();
      this.renderAnnList();
    }
    drawHist() {
      const c = this.hist; if (!c) return;
      const S = this.s, src = S.mode === "volume" ? S.vol : this.photoCur(); if (!src.hist) return;
      const ctx = c.getContext("2d"), W = c.width, H = c.height, hist = src.hist, B = hist.length;
      ctx.clearRect(0, 0, W, H);
      const a = Math.max(0, Math.floor((src.lo - src.histMin) / src.histSpan * B)), b = Math.min(B, Math.ceil((src.hi - src.histMin) / src.histSpan * B));
      let mx = 1; for (let i = a; i < b; i++) mx = Math.max(mx, hist[i]);
      const lmx = Math.log(mx + 1);
      ctx.fillStyle = "rgba(180,172,255,.55)";
      for (let i = a; i < b; i++) { const x = (i - a) / (b - a) * W, bh = Math.log(hist[i] + 1) / lmx * (H - 8); ctx.fillRect(x, H - bh, W / (b - a) + 0.6, bh); }
      const toX = v => (v - src.lo) / (src.hi - src.lo) * W, x0 = toX(S.level - S.width / 2), x1 = toX(S.level + S.width / 2);
      ctx.fillStyle = "rgba(139,124,246,.16)"; ctx.fillRect(x0, 0, x1 - x0, H);
      ctx.strokeStyle = "#b8b2ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, H); ctx.lineTo(x1, 0); ctx.stroke();
    }

    /* ── измерения ── */
    annPlace(a) {
      if (a.space === "mpr") return "срез";
      if (a.space === "pano") return "панорама";
      if (a.space === "xs") return "сечение " + fmt1(a.pts[0][0]) + " мм";
      return "снимок";
    }
    annVisibleHere(a) { return this.s.mode !== "photo" || a.photo === this.s.photo.idx; }
    renderAnnList() {
      const ul = this.root.querySelector("[data-anns]"); if (!ul) return;
      const S = this.s, list = S.anns.filter(a => this.annVisibleHere(a));
      this.root.querySelector("[data-ann-count]").textContent = list.length ? list.length : "";
      if (!list.length) { ul.innerHTML = `<li class="ct-anns__empty">Пока пусто. Линейка, угол, стрелка и текст — на панели инструментов.</li>`; return; }
      const names = { ruler: "Расстояние", angle: "Угол", arrow: "Стрелка", text: "Текст", canal: "Канал нерва", calib: "Эталон" };
      ul.innerHTML = list.map(a => {
        const view = this.viewFor(a), val = view ? CT.annValue(view, a) : "";
        return `<li class="${a.id === S.sel ? "is-sel" : ""}" data-id="${a.id}"><button type="button" class="ct-ann" data-go="${a.id}"><i style="--c:${CT.ANN_COLOR[a.type]}"></i><b>${names[a.type]}</b><span>${esc(a.type === "text" || a.type === "arrow" ? (a.text || "") : val)}</span><em>${this.annPlace(a)}</em></button><button type="button" class="ct-ann__del" data-del="${a.id}" aria-label="Удалить">${ICON.close}</button></li>`;
      }).join("");
      ul.onclick = e => {
        const d = e.target.closest("[data-del]"), g = e.target.closest("[data-go]");
        if (d) { S.anns = S.anns.filter(x => x.id !== +d.dataset.del); if (S.sel === +d.dataset.del) S.sel = null; this.annsChanged(); return; }
        if (g) this.goToAnn(+g.dataset.go);
      };
    }
    viewFor(a) {
      if (a.space === "mpr") return this.views.axial;
      if (a.space === "pano") return this.views.pano;
      if (a.space === "xs") return this.views.xs0;
      return this.views.photo;
    }
    goToAnn(id) {
      const S = this.s, a = S.anns.find(x => x.id === id); if (!a) return;
      S.sel = S.sel === id ? null : id;
      if (a.space === "mpr") {
        /* переходим к срезу, где сделано измерение: центр — первая точка */
        const q = a.pts[0]; S.p = q.slice();
      } else if (a.space === "xs") { S.pano.s0 = a.pts[0][0]; }
      this.annsChanged();
    }
    addAnn(a) {
      const S = this.s; a.id = S.nextId++; delete a.draftNoLabel; delete a.arch;
      S.anns.push(a); S.sel = null; this.annsChanged();
    }
    undo() { const S = this.s, list = S.anns.filter(a => this.annVisibleHere(a)); if (!list.length) return; const last = list[list.length - 1]; S.anns = S.anns.filter(a => a !== last); this.annsChanged(); }
    annsChanged() { this.renderAnnList(); this.requestAll(); }
    /* поле ввода прямо поверх окна (подпись, длина эталона) */
    editText(view, x, y, cb, placeholder, allowEmpty) {
      const old = this.root.querySelector(".ct-input"); if (old) old.remove();
      const box = h("form", "ct-input"), r = view.el.getBoundingClientRect(), g = this.root.getBoundingClientRect();
      box.style.left = clamp(r.left - g.left + x, 8, g.width - 250) + "px"; box.style.top = clamp(r.top - g.top + y + 10, 8, g.height - 60) + "px";
      box.innerHTML = `<input type="text" maxlength="80" placeholder="${esc(placeholder || "Текст пометки")}" aria-label="${esc(placeholder || "Текст пометки")}"><button type="submit" class="ct-btn ct-btn--acc">OK</button>`;
      this.root.appendChild(box);
      const inp = box.querySelector("input");
      /* фокус — после того, как браузер закончит обработку щелчка по снимку,
         иначе щелчок сразу уводит фокус и поле закрывается */
      let ready = false;
      setTimeout(() => { inp.focus(); ready = true; }, 40);
      let done = false;
      /* Enter или уход с поля — сохранить; Esc — без подписи (стрелка остаётся) или отмена */
      const finish = ok => {
        if (done) return; done = true;
        const v = ok ? inp.value.trim() : ""; box.remove();
        if (v || allowEmpty) cb(v);
      };
      box.addEventListener("submit", e => { e.preventDefault(); finish(true); });
      inp.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); finish(false); } e.stopPropagation(); });
      inp.addEventListener("blur", () => { if (ready) setTimeout(() => finish(true), 120); });
    }
    calibrate(view, d) {
      const px = Math.hypot(d.pts[0][0] - d.pts[1][0], d.pts[0][1] - d.pts[1][1]);
      const b = view.toScreen(d.pts[1]);
      this.editText(view, b[0], b[1], txt => {
        const mm = parseFloat(String(txt).replace(",", "."));
        if (!(mm > 0) || !(px > 1)) return;
        const ph = this.photoCur(); ph.pxMm = mm / px; ph.calibrated = true;
        this.s.anns = this.s.anns.filter(a => !(a.type === "calib" && a.photo === this.s.photo.idx));
        this.addAnn({ type: "calib", space: "photo", pts: d.pts, photo: this.s.photo.idx });
        this.setTool("ruler"); this.syncUI();
      }, "Длина эталона, мм (например 10)");
    }

    /* ── состояние срезов ── */
    setCenter(q) { this.s.p = q; this.requestAll(); }
    moveAlong(key, mm) {
      const S = this.s, E = S.vol.ext, q = V.add(S.p, V.mul(S.views[key].n, mm));
      S.p = [clamp(q[0], 0, E[0]), clamp(q[1], 0, E[1]), clamp(q[2], 0, E[2])]; this.requestAll();
    }
    rotateFrom(key, snap, ang) {
      const S = this.s, n = snap[key].n, out = CT.copyBases(snap);
      for (const o of MPR) if (o !== key) for (const c of ["n", "r", "d"]) out[o][c] = V.norm(V.rot(snap[o][c], n, ang));
      S.views = out; this.requestAll();
    }
    setWindow(level, width) { const S = this.s; S.level = level; S.width = width; S.preset = ""; this.windowChanged(); }
    makeLut() {
      const S = this.s, lut = this.lut || (this.lut = new Uint8Array(65536));
      const lo = S.level - S.width / 2, w = Math.max(1, S.width);
      for (let i = 0; i < 65536; i++) { let c = ((i - 32768 - lo) / w) * 255; c = c < 0 ? 0 : c > 255 ? 255 : c; lut[i] = S.invert ? 255 - c : c; }
    }
    windowChanged() { this.makeLut(); for (const k in this.views) if (k !== "vr") this.views[k].dirty = true; this.schedule(); this.syncUI(true); }
    /* во время перетаскивания рисуем грубее, после — в полном качестве */
    interact(end) {
      clearTimeout(this.fastT);
      if (end) { if (this.fast) { this.fast = false; this.requestAll(); } return; }
      this.fast = true;
      this.fastT = setTimeout(() => { this.fast = false; this.requestAll(); }, 220);
    }

    /* ── панорама ── */
    xsList() {
      const S = this.s, G = S.archG; if (!G) return [];
      if (S.pano.s0 == null) S.pano.s0 = G.L / 2;
      const n = S.pano.count, mid = (n - 1) / 2, out = [];
      for (let i = 0; i < n; i++) { const rel = (i - mid) * S.pano.spacing; out.push({ s: clamp(S.pano.s0 + rel, 0, G.L), rel, center: i === mid }); }
      return out;
    }
    stepXs(d) { const S = this.s; if (!S.archG) return; S.pano.s0 = clamp((S.pano.s0 == null ? S.archG.L / 2 : S.pano.s0) + d * S.pano.spacing, 0, S.archG.L); this.requestAll(); }
    setArch(pts) { this.s.arch = pts; this.s.pano.s0 = null; this.archChanged(false); this.setTool("cross"); }
    archChanged(dragging) {
      const S = this.s;
      S.archG = S.arch && S.arch.length >= 2 ? CT.archGeom(S.arch, 0.25) : null;
      if (S.archG && S.pano.s0 != null) S.pano.s0 = clamp(S.pano.s0, 0, S.archG.L);
      if (dragging) this.interact(); else this.interact(true);
      this.requestAll();
    }
    panoChanged() { this.requestAll(); }
    autoArch(fromButton) {
      const S = this.s, E = S.vol.ext;
      const tries = fromButton ? [S.p[2]] : [S.p[2], E[2] * 0.45, E[2] * 0.35, E[2] * 0.55, E[2] * 0.25, E[2] * 0.65];
      for (const z of tries) {
        const pts = CT.autoArch(S.vol, z);
        if (pts) { S.arch = pts; S.pano.s0 = null; this.archChanged(false); this.panoMsg(`Дуга найдена на высоте ${fmt1(z)} мм. Точки можно перетаскивать на аксиальном срезе.`); return true; }
      }
      this.panoMsg("Не удалось найти дугу автоматически. Выберите аксиальный срез на уровне корней и нажмите «Найти дугу» или «Нарисовать».", true);
      return false;
    }
    panoMsg(t, warn) { const m = this.root.querySelector("[data-pano-msg]"); if (m) { m.textContent = t; m.classList.toggle("is-warn", !!warn); } this.status(t); }
    buildXs() {
      const S = this.s, cell = this.xsCell; if (!cell) return;
      for (const k of Object.keys(this.views)) if (k.startsWith("xs")) delete this.views[k];
      let strip = cell.querySelector(".ct-xs"); if (strip) strip.remove();
      strip = h("div", "ct-xs"); cell.appendChild(strip);
      for (let i = 0; i < S.pano.count; i++) {
        const sub = h("div", "ct-xs__cell"); strip.appendChild(sub);
        this.views["xs" + i] = new CT.XsView(this, "xs" + i, sub, i);
      }
      requestAnimationFrame(() => this.resizeAll());
    }

    /* ── раскладки ── */
    setLayout(l) {
      const S = this.s; if (S.mode !== "volume") return;
      S.layout = l;
      if (l === "pano") {
        if (!S.arch) this.autoArch(false);
        if (!["axial", "pano"].includes(S.active) && !S.active.startsWith("xs")) S.active = "pano";
      } else if (!MPR.includes(S.active) && S.active !== "vr") S.active = "axial";
      /* канал и дуга имеют смысл только на панораме */
      if (l !== "pano" && (S.tool === "canal" || S.tool === "arch")) this.setTool("cross", true);
      this.applyLayout(); this.syncUI();
    }
    isMobile() { return matchMedia("(max-width: 1100px)").matches; }
    applyLayout() {
      const S = this.s, g = this.grid;
      g.dataset.layout = S.layout;
      g.querySelectorAll(".ct-cell").forEach(c => { c.style.gridArea = ""; c.classList.remove("is-hidden"); });
      if (S.mode === "volume" && this.isMobile()) {
        /* телефон и планшет: одно окно, переключение вкладками */
        const act = S.active.startsWith("xs") ? "xs" : S.active;
        g.dataset.layout = "one";
        g.querySelectorAll(".ct-cell").forEach(c => { if (c.dataset.view !== act) c.classList.add("is-hidden"); else c.style.gridArea = "m"; });
        this.tabsEl.querySelectorAll("button").forEach(b => b.classList.toggle("is-on", b.dataset.view === act));
      } else if (S.mode === "volume") {
        const cells = k => g.querySelector(`.ct-cell[data-view="${k}"]`);
        const hide = ks => ks.forEach(k => cells(k).classList.add("is-hidden"));
        const act = S.active.startsWith("xs") ? "xs" : S.active;
        if (S.layout === "grid") { hide(["pano", "xs"]); ["axial", "vr", "coronal", "sagittal"].forEach((k, i) => (cells(k).style.gridArea = "abcd"[i])); }
        else if (S.layout === "main") {
          hide(["pano", "xs"]);
          const m = ["axial", "coronal", "sagittal", "vr"].includes(act) ? act : "axial", rest = ["axial", "vr", "coronal", "sagittal"].filter(k => k !== m);
          cells(m).style.gridArea = "m"; rest.forEach((k, i) => (cells(k).style.gridArea = "abc"[i]));
        } else if (S.layout === "one") {
          ["axial", "coronal", "sagittal", "vr", "pano", "xs"].forEach(k => { if (k !== act) cells(k).classList.add("is-hidden"); else cells(k).style.gridArea = "m"; });
        } else if (S.layout === "pano") {
          hide(["coronal", "sagittal", "vr"]);
          cells("axial").style.gridArea = "a"; cells("pano").style.gridArea = "p"; cells("xs").style.gridArea = "x";
        }
      }
      this.markActive();
      requestAnimationFrame(() => this.resizeAll());
    }
    toggleMax(k) {
      const S = this.s; if (S.mode !== "volume") return;
      const key = k.startsWith("xs") ? "xs" : k;
      if (S.layout === "one") { S.layout = S.prevLayout || "grid"; }
      else { S.prevLayout = S.layout; S.layout = "one"; }
      S.active = k.startsWith("xs") ? S.active : key;
      this.applyLayout(); this.syncUI();
    }
    mobileShow(k) {
      const S = this.s; if (!S) return;
      if (S.mode === "volume") {
        if ((k === "pano" || k === "xs") && !S.arch) this.autoArch(false);
        S.layout = k === "pano" || k === "xs" ? "pano" : S.layout === "pano" && k === "axial" ? "pano" : "grid";
      }
      S.active = k === "xs" ? "xs0" : k;
      this.applyLayout(); this.syncUI();
    }
    setActive(k) { if (!this.s || this.s.active === k) return; this.s.active = k; this.markActive(); }
    markActive() {
      const S = this.s, act = S.active.startsWith("xs") ? "xs" : S.active;
      this.grid.querySelectorAll(".ct-cell").forEach(c => c.classList.toggle("is-active", c.dataset.view === act));
    }
    /* рабочая область — ровно до низа окна браузера, под шапкой админки */
    fitHeight() {
      const r = this.root; if (!r || this.isMobile() || document.fullscreenElement === r || r.classList.contains("is-full")) { if (r) r.style.height = ""; return; }
      const top = r.getBoundingClientRect().top + window.scrollY;
      r.style.height = Math.max(560, window.innerHeight - top - 14) + "px";
    }
    resizeAll() { this.fitHeight(); for (const k in this.views) this.views[k].resize(); this.requestAll(); }
    setTool(t, quiet) {
      const S = this.s; S.tool = t;
      for (const k in this.views) if (this.views[k].cancelDraft) this.views[k].cancelDraft();
      if (!quiet) this.syncUI();
      this.requestAll();
    }
    resetView() {
      const S = this.s;
      for (const k in this.views) this.views[k].reset();
      if (S.mode === "volume") { S.views = CT.copyBases(CT.CANON); S.p = V.mul(S.vol.ext, 0.5); }
      else { S.photo.rot = 0; S.photo.flip = false; }
      this.requestAll();
    }

    /* ── отрисовка ── */
    request(k) { const v = this.views[k]; if (v) v.dirty = true; this.schedule(); }
    requestAll() { for (const k in this.views) this.views[k].dirty = true; this.schedule(); }
    schedule() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        for (const k in this.views) { const v = this.views[k]; if (v.dirty && v.cw && v.el.offsetParent !== null && !v.el.closest(".is-hidden")) v.render(); }
      });
    }
    statusHover(t) { const e = this.statusEl && this.statusEl.querySelector('[data-st="hover"]'); if (e) e.textContent = t || ""; }
    status(t) { const e = this.statusEl && this.statusEl.querySelector('[data-st="hint"]'); if (e) { e.textContent = t; clearTimeout(this.stT); this.stT = setTimeout(() => this.syncUI(true), 4000); } }
    photoCur() { return this.s.photo.list[this.s.photo.idx]; }
    selectPhoto(i) {
      const S = this.s; S.photo.idx = i; S.photo.rot = 0; S.photo.flip = false;
      const ph = this.photoCur();
      if (ph.gray) { const w = ph.wc && ph.ww ? { level: ph.wc, width: ph.ww } : autoWindow(ph); S.level = w.level; S.width = w.width; this.makeLut(); }
      this.views.photo.reset(); this.views.photo.cacheKey = null;
      this.syncUI(); this.requestAll();
    }

    /* ── прокрутка срезов ── */
    cine() {
      const S = this.s;
      this.cineOn = !this.cineOn;
      cancelAnimationFrame(this.cineRaf);
      if (this.cineOn) {
        const key = MPR.includes(S.active) ? S.active : "axial";
        let dir = 1, last = 0;
        const tick = now => {
          if (!this.cineOn || !this.s) return;
          if (now - last > 70) {
            last = now;
            const E = S.vol.ext, n = S.views[key].n, before = S.p.slice();
            this.moveAlong(key, dir * S.vol.minSp * 2);
            if (V.len(V.sub(before, S.p)) < 1e-6 || S.p.some((v, i) => v <= 0 || v >= E[i])) dir = -dir;
            void n;
          }
          this.cineRaf = requestAnimationFrame(tick);
        };
        this.cineRaf = requestAnimationFrame(tick);
      }
      this.syncUI(true);
    }
    spin() {
      cancelAnimationFrame(this.spinRaf);
      const vr = this.views.vr; if (!vr || vr.failed) return;
      let last = performance.now();
      const tick = now => {
        if (!this.s || !this.s.turntable) { vr.moving = false; this.request("vr"); return; }
        vr.az += (now - last) * 0.00035; last = now; vr.moving = true; this.request("vr");
        this.spinRaf = requestAnimationFrame(tick);
      };
      this.spinRaf = requestAnimationFrame(tick);
    }

    /* ── клавиши ── */
    onKey(e) {
      /* раздел скрыт (другая вкладка админки) — клавиши не наши; во весь экран offsetParent пустой, это не скрытие */
      if (!this.s || !this.root || !this.root.isConnected || (this.root.offsetParent === null && document.fullscreenElement !== this.root)) return;
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      const S = this.s, k = e.key, low = k.toLowerCase(), isVol = S.mode === "volume";
      const tools = { c: "cross", h: "pan", w: "wl", m: "ruler", a: "angle", s: "arrow", t: "text", k: "canal", d: "arch", l: "calib" };
      const ru = { с: "c", р: "h", ц: "w", ь: "m", ф: "a", ы: "s", е: "t", л: "k", в: "d", д: "l", а: "f", п: "g", з: "p", я: "z" };
      const key = ru[low] || low;
      if ((e.ctrlKey || e.metaKey) && key === "z") { e.preventDefault(); this.undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === "Escape") { const hlp = this.root.querySelector(".ct-help"); if (hlp) { hlp.remove(); return; } for (const v in this.views) if (this.views[v].cancelDraft) this.views[v].cancelDraft(); return; }
      if (k === "Enter") { for (const v in this.views) if (this.views[v].draft && this.views[v].finishClickTool) this.views[v].finishClickTool(); return; }
      if (k === "?" || k === "F1") { e.preventDefault(); this.help(); return; }
      if (k === "Delete" || k === "Backspace") { if (S.sel) { S.anns = S.anns.filter(a => a.id !== S.sel); S.sel = null; this.annsChanged(); } return; }
      if (tools[key] && (isVol || ["pan", "wl", "ruler", "angle", "arrow", "text", "calib"].includes(tools[key])) && !(isVol && key === "l")) { this.setTool(tools[key]); return; }
      if (key === "f") { this.fullscreen(); return; }
      if (key === "0") { this.resetView(); return; }
      if (isVol) {
        if (key === "g") return this.setLayout("grid");
        if (key === "3") return this.setLayout("main");
        if (key === "1") return this.setLayout("one");
        if (key === "p") return this.setLayout("pano");
        if (k === " ") { e.preventDefault(); this.cine(); return; }
        if (k === "ArrowUp" || k === "ArrowDown") {
          e.preventDefault();
          const d = k === "ArrowUp" ? -1 : 1;
          if (S.active === "pano" || S.active.startsWith("xs")) this.stepXs(d);
          else this.moveAlong(MPR.includes(S.active) ? S.active : "axial", d * S.vol.minSp * (e.shiftKey ? 5 : 1));
        }
      }
    }
    help() {
      const old = this.root.querySelector(".ct-help"); if (old) { old.remove(); return; }
      const isVol = this.s.mode === "volume", box = h("div", "ct-help");
      const rows = Object.entries(TOOL_INFO).filter(([k]) => isVol ? k !== "calib" : !["cross", "canal", "arch"].includes(k))
        .map(([, [n, key, hint]]) => `<tr><td><kbd>${key}</kbd></td><td><b>${n}</b><span>${hint}</span></td></tr>`).join("");
      box.innerHTML = `<div class="ct-help__card" role="dialog" aria-modal="true" aria-label="Подсказки">
        <button type="button" class="ct-help__x" aria-label="Закрыть">${ICON.close}</button>
        <h3>Как пользоваться</h3>
        <div class="ct-help__cols">
          <table>${rows}</table>
          <table>
            ${isVol ? `<tr><td><kbd>колесо</kbd></td><td><b>Листать срезы</b><span>Shift — по 5 · на панораме — сдвиг сечений</span></td></tr>
            <tr><td><kbd>↑ ↓</kbd></td><td><b>Срез назад / вперёд</b><span>в активном окне</span></td></tr>` : ""}
            <tr><td><kbd>Ctrl + колесо</kbd></td><td><b>Масштаб</b><span>или щипок двумя пальцами</span></td></tr>
            <tr><td><kbd>правая кнопка</kbd></td><td><b>Сдвиг</b><span>при любом инструменте</span></td></tr>
            <tr><td><kbd>двойной щелчок</kbd></td><td><b>Окно на весь экран</b><span>и обратно</span></td></tr>
            ${isVol ? `<tr><td><kbd>G · 3 · 1 · P</kbd></td><td><b>Раскладки</b><span>2×2 · 1 + 3 · одно окно · панорама</span></td></tr>
            <tr><td><kbd>Пробел</kbd></td><td><b>Прокрутка срезов</b><span>старт / пауза</span></td></tr>` : ""}
            <tr><td><kbd>Ctrl + Z</kbd></td><td><b>Отменить пометку</b><span>Delete — удалить выбранную</span></td></tr>
            <tr><td><kbd>F</kbd></td><td><b>Во весь экран</b><span>Esc — выйти</span></td></tr>
            <tr><td><kbd>0</kbd></td><td><b>Сбросить вид</b><span>${isVol ? "и наклон срезов" : "поворот и масштаб"}</span></td></tr>
          </table>
        </div>
        ${isVol ? `<p class="ct-help__tip"><b>Панорама:</b> кнопка «Панорама» строит ОПТГ по дуге челюсти и поперечные сечения — для оценки кости и каналов. Точки дуги можно тянуть на аксиальном срезе, сечения листаются колесом.</p>` : ""}
      </div>`;
      box.addEventListener("click", e => { if (e.target === box || e.target.closest(".ct-help__x")) box.remove(); });
      this.root.appendChild(box);
      box.querySelector(".ct-help__x").focus();
    }
    fullscreen() {
      const r = this.root;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (r.requestFullscreen) r.requestFullscreen().catch(() => r.classList.toggle("is-full"));
      else r.classList.toggle("is-full");
    }

    /* ── экспорт ── */
    canvasOf(k) {
      const v = this.views[k]; if (!v) return null;
      if (v.exportCanvas) return v.exportCanvas();
      return v.canvas;
    }
    shot() {
      const S = this.s;
      let c;
      if (S.active === "xs" || S.active.startsWith("xs")) c = this.compose(Object.keys(this.views).filter(k => k.startsWith("xs")), 1, null);
      else c = this.canvasOf(S.active);
      if (c) download(c, `snimok-${(NAMES[S.active] || "okno").toLowerCase()}.png`);
    }
    visibleKeys() {
      const S = this.s;
      if (S.mode === "photo") return ["photo"];
      const order = S.layout === "pano" ? ["axial", "pano"] : S.layout === "one" ? [S.active] : ["axial", "vr", "coronal", "sagittal"];
      return order.filter(k => this.views[k]);
    }
    /* сетка кадров: тёмный фон, подписи окон */
    compose(keys, cols, titleOf) {
      const cs = keys.map(k => [k, this.canvasOf(k)]).filter(x => x[1]);
      if (!cs.length) return null;
      const cw = Math.max(...cs.map(x => x[1].width)), ch = Math.max(...cs.map(x => x[1].height)), gap = 6;
      const rows = Math.ceil(cs.length / cols), out = document.createElement("canvas");
      out.width = cols * cw + (cols - 1) * gap; out.height = rows * ch + (rows - 1) * gap;
      const x = out.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, out.width, out.height);
      cs.forEach(([k, c], i) => {
        const cx = (i % cols) * (cw + gap), cy = Math.floor(i / cols) * (ch + gap);
        x.fillStyle = "#07080b"; x.fillRect(cx, cy, cw, ch);
        x.drawImage(c, cx + (cw - c.width) / 2, cy + (ch - c.height) / 2);
        if (titleOf) { x.font = `700 ${Math.round(ch / 26)}px 'Open Sans', sans-serif`; x.fillStyle = "rgba(255,255,255,.85)"; x.fillText(titleOf(k), cx + 14, cy + ch / 18 + 8); }
      });
      return out;
    }
    async report(print) {
      const S = this.s, keys = this.visibleKeys();
      let body;
      if (S.mode === "photo") body = this.views.photo.exportCanvas();
      else {
        const main = this.compose(keys, keys.length > 1 ? 2 : 1, k => NAMES[k] || k);
        body = main;
        if (S.layout === "pano") {
          const xs = this.compose(Object.keys(this.views).filter(k => k.startsWith("xs")), S.pano.count, null);
          if (xs) { const c = document.createElement("canvas"); c.width = Math.max(main.width, xs.width); c.height = main.height + 6 + xs.height * (main.width / xs.width);
            const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height); x.drawImage(main, 0, 0); x.drawImage(xs, 0, main.height + 6, main.width, xs.height * (main.width / xs.width)); body = c; }
        }
      }
      if (!body) return;
      const W = 1800, scale = W / body.width, bodyH = Math.round(body.height * scale);
      const anns = S.anns.filter(a => this.annVisibleHere(a) && a.type !== "calib");
      const names = { ruler: "Расстояние", angle: "Угол", arrow: "Стрелка", text: "Пометка", canal: "Канал нерва" };
      const lineH = 38, listH = anns.length ? 70 + anns.length * lineH : 0;
      const c = document.createElement("canvas"); c.width = W; c.height = 150 + bodyH + listH + 110;
      const x = c.getContext("2d");
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, c.height);
      const logo = await loadImg("logo.png");
      if (logo) x.drawImage(logo, 60, 38, 80 * logo.width / logo.height, 80);
      x.fillStyle = "#1f2027"; x.font = "800 38px 'Open Sans', sans-serif"; x.fillText("Честная стоматология", 175, 78);
      x.fillStyle = "#6b7080"; x.font = "500 22px 'Open Sans', sans-serif";
      const meta = S.mode === "volume" ? S.vol.meta : this.photoCur().meta || {};
      x.fillText([S.mode === "volume" ? "Снимок КЛКТ" : "Рентгеновский снимок", dmy(meta.date), [meta.maker, meta.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "), 175, 112);
      x.textAlign = "right"; x.fillStyle = "#2f0d80"; x.font = "700 22px 'Open Sans', sans-serif";
      x.fillText(S.showName && meta.patient ? meta.patient : "Данные пациента скрыты", W - 60, 78);
      x.fillStyle = "#6b7080"; x.font = "500 18px 'Open Sans', sans-serif";
      x.fillText("Сформировано " + new Date().toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }), W - 60, 112);
      x.textAlign = "left";
      x.drawImage(body, 0, 150, W, bodyH);
      let y = 150 + bodyH + 50;
      if (anns.length) {
        x.fillStyle = "#1f2027"; x.font = "800 26px 'Open Sans', sans-serif"; x.fillText("Измерения и пометки", 60, y); y += 44;
        for (const a of anns) {
          const view = this.viewFor(a), val = a.type === "text" || a.type === "arrow" ? a.text || "" : CT.annValue(view, a);
          x.fillStyle = CT.ANN_COLOR[a.type] === "#ffffff" ? "#1f2027" : CT.ANN_COLOR[a.type]; x.beginPath(); x.arc(70, y - 8, 8, 0, 7); x.fill();
          x.fillStyle = "#1f2027"; x.font = "700 22px 'Open Sans', sans-serif"; x.fillText(names[a.type], 92, y);
          x.fillStyle = "#3a3d4a"; x.font = "500 22px 'Open Sans', sans-serif"; x.fillText(val + " · " + this.annPlace(a), 300, y);
          y += lineH;
        }
      }
      x.fillStyle = "#8a8f9c"; x.font = "500 17px 'Open Sans', sans-serif";
      x.fillText("Изображение для консультации, не является заключением врача. Снимок обработан в браузере и на сервер не передавался.", 60, c.height - 48);
      if (print) {
        const w = window.open("", "_blank");
        if (!w) { download(c, "otchet-snimok.png"); return; }
        w.document.write(`<title>Отчёт по снимку</title><style>@page{margin:10mm}body{margin:0}img{width:100%}</style><img src="${c.toDataURL("image/png")}">`);
        w.document.close(); w.onload = () => { w.focus(); w.print(); };
        setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* noop */ } }, 500);
      } else download(c, `otchet-snimok-${new Date().toISOString().slice(0, 10)}.png`);
    }

    dispose() {
      cancelAnimationFrame(this.raf); cancelAnimationFrame(this.spinRaf); cancelAnimationFrame(this.cineRaf); this.raf = 0; this.cineOn = false;
      if (this.ro) this.ro.disconnect();
      if (this.keys) document.removeEventListener("keydown", this.keys);
      if (this.fsHandler) document.removeEventListener("fullscreenchange", this.fsHandler);
      if (this.mq) this.mq.removeEventListener("change", this.mqHandler);
      if (this.onWinResize) window.removeEventListener("resize", this.onWinResize);
      if (document.fullscreenElement && document.fullscreenElement === this.root) document.exitFullscreen().catch(() => {});
      for (const k in this.views) if (this.views[k].dispose) this.views[k].dispose();
      this.views = {}; this.s = null; this.root = null; this.xsCell = null; this.hist = null;
    }
  }

  function download(canvas, name) {
    const a = document.createElement("a"); a.download = name; a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a); a.click(); a.remove();
  }
  function loadImg(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  /* папка через перетаскивание: обходим каталоги рекурсивно */
  async function readEntries(entries) {
    const out = [];
    const walk = async ent => {
      if (ent.isFile) { out.push(await new Promise((res, rej) => ent.file(res, rej))); return; }
      const reader = ent.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    };
    for (const e of entries) await walk(e);
    return out;
  }

  CT.mount = host => { if (!host.__ct) host.__ct = new App(host); return host.__ct; };
})();
