/* ═══════════ Плашки услуг: «плей» и карусель процедур ═══════════
   На каждую плашку услуги (кроме призыва к калькулятору) ставим
   кнопку «плей». Нажатие открывает окно-карусель с роликами всех
   процедур — сразу на выбранной. Внутри можно листать дальше:
   стрелками, точками, пальцем или клавишами ← →. Крестик, Esc или
   клик по фону закрывают окно.
   Играет только видимый слайд; ролики грузятся лишь при открытии
   окна, чтобы не тянуть трафик заранее.
   Пока слайд плашки на экране, по контуру её иконки бежит штрих света.

   Карточки собирает app.js из базы и пересобирает при смене языка или
   после загрузки опубликованных данных — тогда приходит событие
   chestom:services, и карусель разбирается и собирается заново. */
(function () {
  "use strict";
  var SVG = "http://www.w3.org/2000/svg";
  var destroy = null;

  function mount() {
  var grid = document.querySelector(".services__grid--neu");
  if (!grid) return null;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".svc-card"));
  var items = cards.filter(function (c) { return c.hasAttribute("data-video"); });
  var io = null;

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

  /* при первом появлении плашки иконка один раз прорисовывается линией */
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-drawn"); io.unobserve(e.target); }
      });
    }, { threshold: 0.35 });
    cards.forEach(function (c) { io.observe(c); });
  }

  if (!items.length) return function () { if (io) io.disconnect(); };

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
      '<button class="svc-reel__sound" type="button" aria-pressed="true" aria-label="Выключить музыку">' +
        '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/>' +
          '<path class="svc-reel__wave" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>' +
          '<path class="svc-reel__mute" d="M16 9.5l5 5M21 9.5l-5 5"/>' +
        '</svg></button>' +
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

  /* ── Спокойная музыка к роликам ──
     Отдельная дорожка, не зашитая в видео: включается при открытии окна
     (нажатие «плей» — жест пользователя, поэтому телефоны разрешают
     звук), плавно нарастает и затихает при закрытии. Громкость ведём
     через Web Audio: на iPhone свойство volume у <audio> не работает.
     Выбор «без звука» запоминаем. */
  var soundBtn = box.querySelector(".svc-reel__sound");
  var music = null, actx = null, gain = null, fadeT = 0;
  var MUSIC_VOL = 0.45;
  function soundOn() {
    try { return localStorage.getItem("chestom_reel_sound") !== "off"; } catch (e) { return true; }
  }
  function syncSoundBtn() {
    var on = soundOn();
    soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
    soundBtn.setAttribute("aria-label", on ? "Выключить музыку" : "Включить музыку");
    soundBtn.classList.toggle("is-muted", !on);
  }
  function ensureMusic() {
    if (music) return;
    music = new Audio("audio/calm.m4a?v=20260926");
    music.loop = true; music.preload = "auto";
    music.setAttribute("playsinline", "");
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      try {
        actx = new AC();
        gain = actx.createGain(); gain.gain.value = 0;
        actx.createMediaElementSource(music).connect(gain);
        gain.connect(actx.destination);
      } catch (e) { actx = null; gain = null; }
    }
    if (!gain) music.volume = 0;
  }
  function fadeTo(v, sec, done) {
    clearTimeout(fadeT);
    if (gain) {
      var now = actx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(v, now + sec);
    } else {
      /* запасной путь без Web Audio: шагами по volume */
      var from = music.volume, steps = 20, k = 0;
      (function step() {
        k++; music.volume = Math.max(0, Math.min(1, from + (v - from) * k / steps));
        if (k < steps) fadeT = setTimeout(step, sec * 1000 / steps);
      })();
    }
    if (done) fadeT = setTimeout(done, sec * 1000 + 30);
  }
  function musicPlay() {
    if (!soundOn()) return;
    ensureMusic();
    if (actx && actx.state === "suspended") actx.resume();
    var p = music.play();
    if (p && p.catch) p.catch(function () {});
    fadeTo(MUSIC_VOL, 1.6);
  }
  function musicStop(quick) {
    if (!music || music.paused) return;
    fadeTo(0, quick ? 0.25 : 0.8, function () { music.pause(); });
  }
  soundBtn.addEventListener("click", function () {
    var on = !soundOn();
    try { localStorage.setItem("chestom_reel_sound", on ? "on" : "off"); } catch (e) {}
    syncSoundBtn();
    if (on) musicPlay(); else musicStop(true);
  });

  function open(i, from) {
    opener = from || null;
    syncCaptions();
    box.hidden = false;
    document.documentElement.classList.add("svc-reel-open");
    active = -1;
    void box.offsetWidth;             /* зафиксировать старт, чтобы сработал переход */
    box.classList.add("is-open");
    go(i, true);
    syncSoundBtn();
    musicPlay();
    box.querySelector(".svc-reel__close").focus({ preventScroll: true });
  }

  function close() {
    if (box.hidden) return;
    box.classList.remove("is-open");
    document.documentElement.classList.remove("svc-reel-open");
    slides.forEach(function (s) { s.querySelector("video").pause(); });
    musicStop();
    items.forEach(function (c) { c.classList.remove("is-playing"); });
    active = -1;
    setTimeout(function () { if (!box.classList.contains("is-open")) box.hidden = true; }, 280);
    if (opener) opener.focus({ preventScroll: true });
  }

  box.querySelector(".svc-reel__close").addEventListener("click", close);
  box.addEventListener("click", function (e) { if (!panel.contains(e.target)) close(); });
  function onKey(e) {
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
  }
  function onResize() { if (!box.hidden && active >= 0) go(active, true); }
  function onVisible() {
    if (box.hidden) return;
    /* ушли со вкладки — музыка не должна играть в фоне */
    if (document.hidden) { if (music) music.pause(); return; }
    if (slides[active]) kick(slides[active].querySelector("video"));
    musicPlay();
  }
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisible);

  /* разобрать: закрыть окно, снять обработчики, убрать разметку */
  return function () {
    if (!box.hidden) close();
    document.documentElement.classList.remove("svc-reel-open");
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisible);
    if (io) io.disconnect();
    if (music) { music.pause(); music.src = ""; }
    if (actx && actx.close) actx.close();
    if (box.parentNode) box.parentNode.removeChild(box);
  };
  }

  destroy = mount();
  document.addEventListener("chestom:services", function () {
    if (destroy) destroy();
    destroy = mount();
  });
})();
