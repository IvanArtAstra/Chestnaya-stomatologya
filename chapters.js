/* ═══════════ Главы главной страницы ═══════════
   Длинная главная разложена на пять глав (услуги, врачи, клиника,
   новости, контакты). Под первым экраном — карта разделов: человек
   выбирает главу и «проваливается» только в неё. Остальные главы
   скрыты, но остаются в разметке целиком — ничего не удалено.

   Любая ссылка на раздел (#team, #promo, index.html#contacts с другой
   страницы, кнопки «Смотреть цены», пункты меню и подвала) сама
   открывает нужную главу и докручивает до раздела.
   Без JS класса chapters-on нет — страница видна полностью, как раньше. */
(function () {
  "use strict";
  var root = document.documentElement;
  var hub = document.getElementById("hub");
  var bar = document.getElementById("chapters");
  var sections = Array.prototype.slice.call(document.querySelectorAll("[data-chapter]"));
  if (!hub || !bar || !sections.length) return;

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var current = null;

  root.classList.add("chapters-on");

  function chapterOf(el) {
    var sec = el && el.closest ? el.closest("[data-chapter]") : null;
    return sec ? sec.getAttribute("data-chapter") : null;
  }

  /* бегущие строки effects.js стоят между разделами — прячем те,
     за которыми сейчас скрытый раздел */
  function syncTickers() {
    Array.prototype.forEach.call(document.querySelectorAll(".ticker"), function (t) {
      var next = t.nextElementSibling;
      var ch = next && next.getAttribute("data-chapter");
      t.classList.toggle("is-folded", !!ch && ch !== current);
    });
  }

  function headerOffset() {
    var nav = document.getElementById("nav");
    var h = nav ? nav.getBoundingClientRect().height : 64;
    return h + (current ? bar.getBoundingClientRect().height : 0) + 12;
  }

  function scrollToEl(el, smooth) {
    var y = el.getBoundingClientRect().top + window.scrollY - headerOffset();
    /* "auto" подчинился бы scroll-behavior: smooth из CSS — для доводки
       нужен именно мгновенный прыжок */
    window.scrollTo({ top: Math.max(0, y), behavior: smooth && !reduce ? "smooth" : "instant" });
  }

  function open(ch, target, opts) {
    opts = opts || {};
    var changed = ch !== current;
    current = ch;
    sections.forEach(function (s) {
      s.classList.toggle("is-chapter", s.getAttribute("data-chapter") === ch);
    });
    root.classList.add("chapter-open");
    bar.hidden = false;
    Array.prototype.forEach.call(bar.querySelectorAll("[data-chapter-open]"), function (a) {
      var on = a.getAttribute("data-chapter-open") === ch;
      a.classList.toggle("is-current", on);
      if (on) {
        a.setAttribute("aria-current", "true");
        /* активная вкладка видна в строке и на узком экране */
        var track = bar.querySelector(".chapters__track");
        if (track) {
          var tr = track.getBoundingClientRect(), ar = a.getBoundingClientRect();
          track.scrollLeft += (ar.left - tr.left) - (tr.width - ar.width) / 2;  /* пункт — по центру строки */
        }
      } else a.removeAttribute("aria-current");
    });
    Array.prototype.forEach.call(hub.querySelectorAll("[data-chapter-open]"), function (a) {
      a.classList.toggle("is-current", a.getAttribute("data-chapter-open") === ch);
    });
    syncTickers();
    if (changed) {
      /* карусели, лента врачей и шторка до/после меряют себя при
         ресайзе — показанной главе нужны живые размеры */
      window.dispatchEvent(new Event("resize"));
    }
    var el = target || sections.filter(function (s) { return s.getAttribute("data-chapter") === ch; })[0];
    if (opts.scroll !== false && el) {
      /* даём раскладке встать, потом едем */
      requestAnimationFrame(function () { scrollToEl(el, opts.smooth !== false); });
      setTimeout(function () { scrollToEl(el, false); }, reduce ? 0 : 700);
    }
    if (opts.hash !== false && el && el.id) {
      try { history.replaceState(null, "", "#" + el.id); } catch (e) { /* noop */ }
    }
  }

  function close(opts) {
    opts = opts || {};
    current = null;
    sections.forEach(function (s) { s.classList.remove("is-chapter"); });
    root.classList.remove("chapter-open");
    bar.hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll("[data-chapter-open].is-current"), function (a) {
      a.classList.remove("is-current"); a.removeAttribute("aria-current");
    });
    syncTickers();
    if (opts.scroll !== false) scrollToEl(hub, true);
    try { history.replaceState(null, "", "#hub"); } catch (e) { /* noop */ }
  }

  /* открыть по якорю: #team → глава «Врачи», прокрутка к #team */
  function route(hash, smooth) {
    if (!hash || hash === "#") return false;
    var id = decodeURIComponent(hash.slice(1));
    if (id === "hub") { if (current) close(); else scrollToEl(hub, smooth); return true; }
    var el = document.getElementById(id);
    if (!el) return false;
    var ch = chapterOf(el);
    if (!ch) return false;                       /* раздел вне глав — обычный переход */
    open(ch, el, { smooth: smooth });
    return true;
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a");
    if (!a) return;
    if (a.hasAttribute("data-chapter-close")) { e.preventDefault(); close(); return; }
    var ch = a.getAttribute("data-chapter-open");
    var href = a.getAttribute("href") || "";
    if (ch) {
      e.preventDefault();
      var t = href.charAt(0) === "#" ? document.getElementById(href.slice(1)) : null;
      open(ch, t);
      return;
    }
    if (href.charAt(0) === "#" && href.length > 1) {
      if (route(href, true)) e.preventDefault();
    }
  }, true);

  window.addEventListener("hashchange", function () { route(location.hash, true); });

  /* пришли по ссылке вида index.html#promo — сразу нужная глава */
  syncTickers();
  if (location.hash) {
    var h = location.hash;
    /* браузер уже попытался прыгнуть к скрытому разделу — поправим */
    setTimeout(function () { route(h, false); }, 0);
  }
})();
