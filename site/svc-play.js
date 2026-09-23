/* ═══════════ Плашки услуг: «плей» и карусель процедур ═══════════
   На каждую плашку услуги (кроме призыва к калькулятору) ставим
   кнопку «плей». Нажатие открывает окно-карусель с роликами всех
   процедур — сразу на выбранной. Внутри можно листать дальше:
   стрелками, точками, пальцем или клавишами ← →. Крестик, Esc или
   клик по фону закрывают окно.
   Играет только видимый слайд; ролики грузятся лишь при открытии
   окна, чтобы не тянуть трафик заранее.
   Пока слайд плашки на экране, по контуру её иконки бежит штрих света. */
(function () {
  "use strict";
  var grid = document.querySelector(".services__grid--neu");
  if (!grid) return;
  var SVG = "http://www.w3.org/2000/svg";
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".svc-card"));
  var items = cards.filter(function (c) { return c.hasAttribute("data-video"); });

  function icon(id, cls) {
    return '<svg class="icon' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }
  function text(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }
  function kick(v) {
    if (!v || !v.paused) return;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  /* световой штрих по контуру иконки (второй <use>) */
  cards.forEach(function (card) {
    var holder = card.querySelector(".svc-card__icon > svg");
    if (holder && !holder.querySelector(".svc-trace")) {
      var trace = document.createElementNS(SVG, "use");
      trace.setAttribute("href", holder.querySelector("use").getAttribute("href"));
      trace.setAttribute("class", "svc-trace");
      holder.appendChild(trace);
    }
  });

  if (!items.length) return;

  /* ── Окно-карусель ── */
  var box = document.createElement("div");
  box.className = "svc-reel";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Как проходят процедуры");
  box.innerHTML =
    '<div class="svc-reel__panel">' +
      '<button class="svc-reel__close" type="button" aria-label="Закрыть">' + icon("i-close") + '</button>' +
      '<div class="svc-reel__track" tabindex="-1"></div>' +
      '<div class="svc-reel__bar">' +
        '<button class="svc-reel__nav svc-reel__nav--prev" type="button" aria-label="Предыдущая процедура">' + icon("i-arrow") + '</button>' +
        '<div class="svc-reel__dots" role="tablist" aria-label="Выбор процедуры"></div>' +
        '<button class="svc-reel__nav svc-reel__nav--next" type="button" aria-label="Следующая процедура">' + icon("i-arrow") + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(box);

  var panel = box.querySelector(".svc-reel__panel");
  var track = box.querySelector(".svc-reel__track");
  var dotsEl = box.querySelector(".svc-reel__dots");
  var prevBtn = box.querySelector(".svc-reel__nav--prev");
  var nextBtn = box.querySelector(".svc-reel__nav--next");
  var total = items.length;
  var slides = [], dots = [], active = -1, opener = null, target = -1, lockUntil = 0;

  items.forEach(function (card, i) {
    var num = (i + 1 < 10 ? "0" : "") + (i + 1);
    var fig = document.createElement("figure");
    fig.className = "svc-reel__slide";
    fig.setAttribute("aria-roledescription", "слайд");
    var v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true;
    v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
    v.preload = "none";
    v.poster = card.getAttribute("data-poster") || "";
    v.dataset.src = card.getAttribute("data-video");
    fig.appendChild(v);
    var cap = document.createElement("figcaption");
    cap.innerHTML =
      '<span class="svc-reel__num">' + num + ' <i>/</i> ' + (total < 10 ? "0" : "") + total + '</span>' +
      '<b class="svc-reel__title"></b><span class="svc-reel__text"></span>' +
      '<span class="svc-reel__step" aria-live="polite"></span>';
    fig.appendChild(cap);
    track.appendChild(fig);
    var vtt = card.getAttribute("data-vtt");
    if (vtt) steps(v, cap.querySelector(".svc-reel__step"), vtt);
    slides.push(fig);

    var d = document.createElement("button");
    d.type = "button"; d.className = "svc-reel__dot"; d.setAttribute("role", "tab");
    d.addEventListener("click", function () { go(i); });
    dotsEl.appendChild(d);
    dots.push(d);

    /* кнопка «плей» на плашке */
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "svc-play";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.innerHTML = icon("i-play", "i-play");
    btn.addEventListener("click", function () { open(i, btn); });
    card.appendChild(btn);
  });

  /* Этапы процедуры: подписи из .vtt показываем под названием,
     в такт ролику. Грузим файл только при первом открытии слайда. */
  function steps(v, el, url) {
    var cues = null;
    function parse(txt) {
      var out = [];
      txt.replace(/\r/g, "").split(/\n\n+/).forEach(function (block) {
        var m = block.match(/(\d+):(\d+(?:\.\d+)?)\s*-->\s*(\d+):(\d+(?:\.\d+)?)\s*\n([\s\S]+)/);
        if (m) out.push({ a: +m[1] * 60 + +m[2], b: +m[3] * 60 + +m[4], t: m[5].trim() });
      });
      return out;
    }
    function show() {
      if (!cues) return;
      var t = v.currentTime, txt = "";
      for (var k = 0; k < cues.length; k++) if (t >= cues[k].a && t < cues[k].b) { txt = cues[k].t; break; }
      if (!txt && cues.length) txt = cues[cues.length - 1].t;
      if (el.textContent !== txt) {
        el.classList.remove("is-in"); void el.offsetWidth;
        el.textContent = txt; el.classList.add("is-in");
      }
    }
    v.addEventListener("play", function once() {
      v.removeEventListener("play", once);
      fetch(url).then(function (r) { return r.ok ? r.text() : ""; })
        .then(function (txt) { cues = parse(txt); show(); })
        .catch(function () {});
    });
    v.addEventListener("timeupdate", show);
  }

  /* подписи берём из плашек в момент открытия — так они совпадают
     с текущим языком сайта */
  function syncCaptions() {
    items.forEach(function (card, i) {
      var t = text(card.querySelector("h3"));
      slides[i].querySelector(".svc-reel__title").textContent = t;
      slides[i].querySelector(".svc-reel__text").textContent = text(card.querySelector("p"));
      slides[i].setAttribute("aria-label", t);
      dots[i].setAttribute("aria-label", t);
      card.querySelector(".svc-play").setAttribute("aria-label", "Смотреть, как проходит: " + t);
    });
  }

  function load(i) {
    var v = slides[i] && slides[i].querySelector("video");
    if (v && !v.getAttribute("src")) { v.src = v.dataset.src; v.preload = "auto"; }
    return v;
  }

  function setActive(i) {
    if (i === active) return;
    active = i;
    slides.forEach(function (s, k) {
      var v = s.querySelector("video");
      var on = k === i;
      s.classList.toggle("is-active", on);
      dots[k].setAttribute("aria-selected", on ? "true" : "false");
      items[k].classList.toggle("is-playing", on);
      if (on) { load(k); kick(v); } else if (v) { v.pause(); }
    });
    load(i + 1);                      /* следующий подгружаем заранее */
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === total - 1;
  }

  function go(i, instant) {
    i = Math.max(0, Math.min(total - 1, i));
    var rtl = getComputedStyle(track).direction === "rtl";
    /* пока лента сама доезжает до слайда, промежуточные позиции
       не должны перещёлкивать активный ролик */
    target = i; lockUntil = instant ? 0 : Date.now() + 900;
    track.scrollTo({ left: (rtl ? -1 : 1) * i * track.clientWidth, behavior: instant ? "auto" : "smooth" });
    setActive(i);
  }

  /* активный слайд — тот, что ближе к центру ленты */
  var rafId = 0;
  track.addEventListener("scroll", function () {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      var w = track.clientWidth || 1;
      var k = Math.round(Math.abs(track.scrollLeft) / w);
      if (Date.now() < lockUntil && k !== target) return;
      lockUntil = 0;
      setActive(k);
    });
  }, { passive: true });

  prevBtn.addEventListener("click", function () { go(active - 1); });
  nextBtn.addEventListener("click", function () { go(active + 1); });

  function open(i, from) {
    opener = from || null;
    syncCaptions();
    box.hidden = false;
    document.documentElement.classList.add("svc-reel-open");
    active = -1;
    void box.offsetWidth;             /* зафиксировать старт, чтобы сработал переход */
    box.classList.add("is-open");
    go(i, true);
    box.querySelector(".svc-reel__close").focus({ preventScroll: true });
  }

  function close() {
    if (box.hidden) return;
    box.classList.remove("is-open");
    document.documentElement.classList.remove("svc-reel-open");
    slides.forEach(function (s) { s.querySelector("video").pause(); });
    items.forEach(function (c) { c.classList.remove("is-playing"); });
    active = -1;
    setTimeout(function () { if (!box.classList.contains("is-open")) box.hidden = true; }, 280);
    if (opener) opener.focus({ preventScroll: true });
  }

  box.querySelector(".svc-reel__close").addEventListener("click", close);
  box.addEventListener("click", function (e) { if (!panel.contains(e.target)) close(); });
  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    var rtl = document.documentElement.dir === "rtl";
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(active + (rtl ? -1 : 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(active + (rtl ? 1 : -1)); }
    else if (e.key === "Tab") {
      /* фокус не уходит из окна, пока оно открыто */
      var f = Array.prototype.filter.call(panel.querySelectorAll("button"), function (b) { return !b.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener("resize", function () { if (!box.hidden && active >= 0) go(active, true); });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !box.hidden && slides[active]) kick(slides[active].querySelector("video"));
  });

  /* при первом появлении плашки иконка один раз прорисовывается линией */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-drawn"); io.unobserve(e.target); }
      });
    }, { threshold: 0.35 });
    cards.forEach(function (c) { io.observe(c); });
  }
})();
