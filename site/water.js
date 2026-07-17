/*
 * water.js — интерактивная «живая вода» в секции героя.
 * Canvas-эффект: пузырьки с реакцией на курсор, god rays, каустики.
 * Самодостаточный файл, без зависимостей. Подключается после app.js (defer).
 */
(function () {
  'use strict';

  try {
    // 1. Уважение к prefers-reduced-motion: не запускаемся вовсе.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (!window.requestAnimationFrame || !document.querySelector) return;

    var hero = document.querySelector('.hero');
    if (!hero) return;

    // ---------------------------------------------------------------
    // Палитра по теме
    // ---------------------------------------------------------------
    function currentTheme() {
      try {
        return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      } catch (e) {
        return 'dark';
      }
    }

    function palette() {
      if (currentTheme() === 'light') {
        return {
          theme: 'light',
          bubbleFill: 'rgba(2, 132, 199, 0.10)',      // #0284c7
          bubbleStroke: 'rgba(14, 165, 160, 0.30)',   // #0ea5a0
          bubbleHighlight: 'rgba(255, 255, 255, 0.85)',
          rayColor: '255, 255, 255',
          rayOpacity: 0.11,                            // 0.08–0.14
          causticColor1: '14, 165, 160',
          causticColor2: '2, 132, 199',
          causticOpacity: 0.06,
          causticComposite: 'source-over',
          popColor: 'rgba(2, 132, 199, 0.55)'
        };
      }
      return {
        theme: 'dark',
        bubbleFill: 'rgba(126, 232, 220, 0.08)',       // #7ee8dc
        bubbleStroke: 'rgba(45, 212, 191, 0.35)',      // #2dd4bf
        bubbleHighlight: 'rgba(220, 250, 250, 0.75)',
        rayColor: '190, 235, 255',
        rayOpacity: 0.07,                              // 0.04–0.1
        causticColor1: '45, 212, 191',                 // #2dd4bf
        causticColor2: '56, 189, 248',                 // #38bdf8
        causticOpacity: 0.05,
        causticComposite: 'lighter',
        popColor: 'rgba(126, 232, 220, 0.7)'
      };
    }

    var pal = palette();

    // Следим за сменой темы на лету.
    try {
      var mo = new MutationObserver(function () {
        try { pal = palette(); } catch (e) {}
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (e) {}

    // ---------------------------------------------------------------
    // Canvas
    // ---------------------------------------------------------------
    var bubblesEl = document.getElementById('bubbles');
    if (bubblesEl) bubblesEl.style.display = 'none'; // 2. скрываем DOM-пузырьки

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1'; // между фоном и контентом

    var heroInner = hero.querySelector('.hero__inner');
    if (heroInner) {
      hero.insertBefore(canvas, heroInner);
      try {
        var innerZ = window.getComputedStyle(heroInner).zIndex;
        if (innerZ === 'auto' || innerZ === '0') {
          heroInner.style.position = heroInner.style.position || 'relative';
          if (window.getComputedStyle(heroInner).position === 'static') {
            heroInner.style.position = 'relative';
          }
          heroInner.style.zIndex = '2';
        }
      } catch (e) {}
    } else {
      hero.appendChild(canvas);
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var DPR = Math.min(window.devicePixelRatio || 1, 2); // cap 2
    var W = 0, H = 0; // CSS-пиксели

    function resize() {
      try {
        var rect = hero.getBoundingClientRect();
        W = Math.max(1, rect.width);
        H = Math.max(1, rect.height);
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      } catch (e) {}
    }
    resize();

    try {
      if ('ResizeObserver' in window) {
        var ro = new ResizeObserver(function () { resize(); });
        ro.observe(hero);
      } else {
        window.addEventListener('resize', resize);
      }
    } catch (e) {
      window.addEventListener('resize', resize);
    }

    // ---------------------------------------------------------------
    // Утилиты
    // ---------------------------------------------------------------
    function rand(min, max) { return min + Math.random() * (max - min); }

    // ---------------------------------------------------------------
    // 3. Пузырьки
    // ---------------------------------------------------------------
    var MOUSE_PUSH_RADIUS = 110;
    var MOUSE_POP_RADIUS = 20;

    var bubbleCount = (window.innerWidth < 640) ? 35 : 55;
    var bubbles = [];
    var particles = []; // микрочастицы от лопнувших пузырьков

    function makeBubble(fromBottom) {
      var r = rand(2, 14);
      return {
        x: rand(0, W),
        y: fromBottom ? H + r + rand(0, 40) : rand(0, H),
        r: r,
        speed: rand(14, 55) * (0.6 + r / 20),   // px/сек, крупнее — быстрее
        wobbleAmp: rand(4, 18),
        wobbleFreq: rand(0.4, 1.4),
        wobblePhase: rand(0, Math.PI * 2),
        vx: 0,                                    // импульс от курсора
        alpha: rand(0.35, 0.85)
      };
    }

    for (var i = 0; i < bubbleCount; i++) bubbles.push(makeBubble(false));

    function respawn(b) {
      var nb = makeBubble(true);
      for (var k in nb) { if (Object.prototype.hasOwnProperty.call(nb, k)) b[k] = nb[k]; }
    }

    function popBubble(b) {
      var n = 4 + Math.floor(Math.random() * 3); // 4–6 микрочастиц
      for (var j = 0; j < n; j++) {
        var ang = (Math.PI * 2 * j) / n + rand(-0.4, 0.4);
        var sp = rand(40, 120);
        particles.push({
          x: b.x, y: b.y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - 20,
          r: rand(1, 2.5),
          life: 0,
          maxLife: rand(0.3, 0.55)
        });
      }
      respawn(b);
    }

    // Курсор / тач
    var pointer = { x: -9999, y: -9999, active: false };

    function updatePointer(clientX, clientY) {
      try {
        var rect = hero.getBoundingClientRect();
        pointer.x = clientX - rect.left;
        pointer.y = clientY - rect.top;
        pointer.active = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= W && pointer.y <= H;
      } catch (e) {}
    }

    window.addEventListener('mousemove', function (ev) {
      updatePointer(ev.clientX, ev.clientY);
    }, { passive: true });

    window.addEventListener('mouseout', function (ev) {
      if (!ev.relatedTarget) pointer.active = false;
    }, { passive: true });

    window.addEventListener('touchmove', function (ev) {
      if (ev.touches && ev.touches.length) {
        updatePointer(ev.touches[0].clientX, ev.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', function () {
      pointer.active = false;
      pointer.x = -9999; pointer.y = -9999;
    }, { passive: true });

    function stepBubbles(dt, t) {
      for (var i = 0; i < bubbles.length; i++) {
        var b = bubbles[i];

        // Всплытие
        b.y -= b.speed * dt;

        // Синусоидальное покачивание
        var wobble = Math.sin(t * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp * dt;

        // Взаимодействие с курсором
        if (pointer.active) {
          var dx = b.x - pointer.x;
          var dy = b.y - pointer.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_POP_RADIUS) {
            popBubble(b);
            continue;
          }
          if (dist < MOUSE_PUSH_RADIUS && dist > 0.001) {
            var force = (1 - dist / MOUSE_PUSH_RADIUS); // сила по расстоянию (0..1)
            force = force * force * 900;                 // мягкая квадратичная кривая, px/сек^2
            b.vx += (dx / dist) * force * dt;            // vx в px/сек
            b.y += (dy / dist) * force * dt * dt * 30;   // лёгкий сдвиг по Y
          }
        }

        // Затухание импульса
        b.vx *= Math.max(0, 1 - 3.2 * dt);
        b.x += wobble + b.vx * dt;

        // Границы по X — мягкий заворот
        if (b.x < -b.r - 20) b.x = W + b.r;
        if (b.x > W + b.r + 20) b.x = -b.r;

        // Респавн снизу
        if (b.y < -b.r - 10) respawn(b);
      }

      // Микрочастицы
      for (var p = particles.length - 1; p >= 0; p--) {
        var pt = particles[p];
        pt.life += dt;
        if (pt.life >= pt.maxLife) { particles.splice(p, 1); continue; }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy -= 30 * dt; // лёгкое всплытие частиц
      }
    }

    function drawBubbles() {
      for (var i = 0; i < bubbles.length; i++) {
        var b = bubbles[i];
        var g;
        try {
          g = ctx.createRadialGradient(
            b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1,
            b.x, b.y, b.r
          );
          g.addColorStop(0, pal.bubbleHighlight);
          g.addColorStop(0.35, pal.bubbleFill);
          g.addColorStop(1, 'rgba(255,255,255,0)');
        } catch (e) {
          g = pal.bubbleFill;
        }
        ctx.globalAlpha = b.alpha;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = pal.bubbleStroke;
        ctx.stroke();
      }
      // Частицы лопанья
      for (var p = 0; p < particles.length; p++) {
        var pt = particles[p];
        var fade = 1 - pt.life / pt.maxLife;
        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fillStyle = pal.popColor;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------------
    // 4. God rays — 3–4 широких луча под углом ~15–25°
    // ---------------------------------------------------------------
    var RAYS = [];
    (function initRays() {
      var count = 4;
      for (var i = 0; i < count; i++) {
        RAYS.push({
          xFrac: 0.12 + (i / (count - 1)) * 0.72 + rand(-0.05, 0.05), // позиция по ширине
          angle: (15 + rand(0, 10)) * Math.PI / 180,                    // 15–25°
          width: rand(70, 150),
          swayAmp: rand(0.02, 0.05),   // радианы
          swayFreq: rand(0.08, 0.18),
          swayPhase: rand(0, Math.PI * 2),
          alphaScale: rand(0.6, 1)
        });
      }
    })();

    function drawRays(t) {
      var len = Math.sqrt(W * W + H * H) * 1.2;
      for (var i = 0; i < RAYS.length; i++) {
        var r = RAYS[i];
        var angle = r.angle + Math.sin(t * r.swayFreq + r.swayPhase) * r.swayAmp;
        var x0 = r.xFrac * W;
        ctx.save();
        ctx.translate(x0, -40);
        ctx.rotate(angle);
        var g;
        try {
          g = ctx.createLinearGradient(-r.width / 2, 0, r.width / 2, 0);
          var a = pal.rayOpacity * r.alphaScale;
          g.addColorStop(0, 'rgba(' + pal.rayColor + ', 0)');
          g.addColorStop(0.5, 'rgba(' + pal.rayColor + ', ' + a.toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + pal.rayColor + ', 0)');
        } catch (e) {
          ctx.restore();
          continue;
        }
        ctx.fillStyle = g;
        ctx.fillRect(-r.width / 2, 0, r.width, len);
        ctx.restore();
      }
    }

    // ---------------------------------------------------------------
    // 5. Каустики — 2 слоя плывущих пятен света
    // ---------------------------------------------------------------
    var CAUSTIC_LAYERS = [
      { blobs: [], speed: 10, dir: 1, colorKey: 'causticColor1', count: 5 },
      { blobs: [], speed: 6, dir: -1, colorKey: 'causticColor2', count: 4 }
    ];
    (function initCaustics() {
      for (var l = 0; l < CAUSTIC_LAYERS.length; l++) {
        var layer = CAUSTIC_LAYERS[l];
        for (var i = 0; i < layer.count; i++) {
          layer.blobs.push({
            xFrac: Math.random(),
            yFrac: rand(0.05, 0.85),
            r: rand(80, 220),
            phase: rand(0, Math.PI * 2),
            driftFreq: rand(0.05, 0.15)
          });
        }
      }
    })();

    function drawCaustics(t) {
      ctx.save();
      try { ctx.globalCompositeOperation = pal.causticComposite; } catch (e) {}
      for (var l = 0; l < CAUSTIC_LAYERS.length; l++) {
        var layer = CAUSTIC_LAYERS[l];
        var color = pal[layer.colorKey];
        for (var i = 0; i < layer.blobs.length; i++) {
          var b = layer.blobs[i];
          var x = ((b.xFrac * W + t * layer.speed * layer.dir) % (W + b.r * 2));
          if (x < -b.r) x += W + b.r * 2;
          if (x > W + b.r) x -= W + b.r * 2;
          var y = b.yFrac * H + Math.sin(t * b.driftFreq + b.phase) * 25;
          var g;
          try {
            g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
            g.addColorStop(0, 'rgba(' + color + ', ' + pal.causticOpacity.toFixed(3) + ')');
            g.addColorStop(1, 'rgba(' + color + ', 0)');
          } catch (e) { continue; }
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ---------------------------------------------------------------
    // 6. Цикл с остановкой вне вьюпорта / при скрытой вкладке
    // ---------------------------------------------------------------
    var running = false;
    var rafId = null;
    var heroVisible = true;
    var lastTime = 0;
    var elapsed = 0;

    function frame(now) {
      rafId = null;
      if (!running) return;
      try {
        var dt = (now - lastTime) / 1000;
        lastTime = now;
        if (dt > 0.1) dt = 0.1; // защита от скачков после сна вкладки
        if (dt < 0) dt = 0;
        elapsed += dt;

        ctx.clearRect(0, 0, W, H);
        drawRays(elapsed);
        drawCaustics(elapsed);
        stepBubbles(dt, elapsed);
        drawBubbles();
      } catch (e) {
        running = false;
        return;
      }
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function updateRunning() {
      if (heroVisible && !document.hidden) start();
      else stop();
    }

    try {
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          try {
            heroVisible = entries[0] ? entries[0].isIntersecting : true;
            updateRunning();
          } catch (e) {}
        }, { threshold: 0 });
        io.observe(hero);
      }
    } catch (e) {}

    document.addEventListener('visibilitychange', function () {
      try { updateRunning(); } catch (e) {}
    });

    updateRunning();
  } catch (e) {
    // Тихо выходим: сайт должен работать и без эффекта.
    try {
      var fallback = document.getElementById('bubbles');
      if (fallback) fallback.style.display = '';
    } catch (e2) {}
  }
})();
