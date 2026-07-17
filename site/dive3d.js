/* dive3d.js — прогрессивное 3D-улучшение сцены «погружения».
   Кристальный зуб на Three.js; при любой проблеме тихо выходим — остаётся SVG. */
(function () {
  "use strict";
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 700) return;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return;

    var sticky = document.querySelector(".dive__sticky");
    var dive = document.getElementById("dive");
    var toothBox = document.getElementById("diveTooth");
    if (!sticky || !dive || !toothBox) return;

    // Проверка WebGL до загрузки библиотеки
    var probe = document.createElement("canvas");
    var gl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!gl) return;

    import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js")
      .then(function (THREE) {
        try { init(THREE); } catch (e) { /* тихий фолбэк на SVG */ }
      })
      .catch(function () { /* нет сети — остаёмся на SVG */ });

    function init(THREE) {
      var svg = toothBox.querySelector("svg");
      if (svg) svg.style.visibility = "hidden";

      var canvas = document.createElement("canvas");
      canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;";
      canvas.setAttribute("aria-hidden", "true");
      // Первым ребёнком: шаги .dive__step идут позже в DOM и остаются поверх
      sticky.insertBefore(canvas, sticky.firstChild);

      var renderer = new THREE.WebGLRenderer({
        canvas: canvas, alpha: true, antialias: true
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.set(0, 0.4, 9);

      // --- Зуб: коронка (Lathe) + два изогнутых корня -------------------
      var crownPts = [];
      var profile = [
        [0.00, -1.10], [0.55, -1.05], [0.95, -0.80], [1.15, -0.40],
        [1.22, 0.10], [1.15, 0.60], [0.95, 1.00], [0.62, 1.25],
        [0.28, 1.36], [0.00, 1.38]
      ];
      for (var i = 0; i < profile.length; i++) {
        crownPts.push(new THREE.Vector2(profile[i][0], profile[i][1]));
      }
      var crownGeo = new THREE.LatheGeometry(crownPts, 48);

      var mat = new THREE.MeshPhysicalMaterial({
        color: 0xbff3ec,
        transmission: 0.85,
        roughness: 0.15,
        thickness: 2,
        ior: 1.4,
        metalness: 0,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide
      });

      var tooth = new THREE.Group();
      tooth.add(new THREE.Mesh(crownGeo, mat));

      function makeRoot(sign) {
        var g = new THREE.CylinderGeometry(0.34, 0.05, 2.1, 20, 12);
        var pos = g.attributes.position;
        for (var j = 0; j < pos.count; j++) {
          var y = pos.getY(j);                 // от +1.05 к -1.05
          var t = (1.05 - y) / 2.1;            // 0 сверху → 1 у кончика
          pos.setX(j, pos.getX(j) + sign * 0.35 * t * t); // изгиб наружу
        }
        g.computeVertexNormals();
        var m = new THREE.Mesh(g, mat);
        m.position.set(sign * 0.45, -1.9, 0);
        m.rotation.z = sign * -0.12;
        return m;
      }
      tooth.add(makeRoot(1));
      tooth.add(makeRoot(-1));
      tooth.position.y = 0.4;
      scene.add(tooth);

      // --- Свет ----------------------------------------------------------
      var ambient = new THREE.AmbientLight(0xffffff, 0.35);
      var keyLight = new THREE.DirectionalLight(0x2dd4bf, 2.2);  // аква, сверху-слева
      keyLight.position.set(-4, 5, 3);
      var fillLight = new THREE.DirectionalLight(0x38bdf8, 1.6); // циан, снизу-справа
      fillLight.position.set(4, -4, 2);
      var rimLight = new THREE.PointLight(0xffffff, 14, 30);     // белый ободок сзади
      rimLight.position.set(0, 1, -5);
      scene.add(ambient, keyLight, fillLight, rimLight);

      function applyTheme() {
        var light = document.documentElement.getAttribute("data-theme") === "light";
        keyLight.color.set(light ? 0x0ea5a0 : 0x2dd4bf);
        fillLight.color.set(light ? 0x0284c7 : 0x38bdf8);
        ambient.intensity = light ? 0.8 : 0.35;
      }
      applyTheme();
      new MutationObserver(applyTheme).observe(document.documentElement, {
        attributes: true, attributeFilter: ["data-theme"]
      });

      // --- Размеры -------------------------------------------------------
      function resize() {
        var w = sticky.clientWidth, h = sticky.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      resize();
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(resize).observe(sticky);
      } else {
        window.addEventListener("resize", resize);
      }

      // --- Прогресс скролла и рендер только возле вьюпорта ---------------
      var progress = 0, nearViewport = false, rafId = 0, clock = new THREE.Clock();

      function readProgress() {
        var rect = dive.getBoundingClientRect();
        var total = rect.height - window.innerHeight;
        if (total <= 0) { progress = 0; return; }
        progress = Math.min(1, Math.max(0, -rect.top / total));
      }
      window.addEventListener("scroll", readProgress, { passive: true });
      readProgress();

      function frame() {
        rafId = 0;
        if (!nearViewport || document.hidden) return;
        var t = clock.getElapsedTime();
        var p = progress;
        var s = 0.9 + p * 1.5; // 0.9 → 2.4
        tooth.scale.setScalar(s);
        tooth.rotation.y = p * 2.2 + t * 0.1;          // скролл + автоспин
        tooth.rotation.x = -0.15 + p * 0.35 + Math.sin(t * 0.7) * 0.05;
        tooth.rotation.z = Math.sin(t * 0.5) * 0.04;   // покачивание в «воде»
        tooth.position.y = 0.4 + (0.5 - p) * 0.8 + Math.sin(t * 0.9) * 0.08;
        var fade = Math.max(0.15, 1 - p * 0.75);       // растворение к концу
        mat.opacity = fade;
        keyLight.intensity = 2.2 * fade;
        fillLight.intensity = 1.6 * fade;
        renderer.render(scene, camera);
        schedule();
      }
      function schedule() {
        if (!rafId && nearViewport && !document.hidden) {
          rafId = requestAnimationFrame(frame);
        }
      }

      new IntersectionObserver(function (entries) {
        nearViewport = entries[0].isIntersecting;
        schedule();
      }, { rootMargin: "25%" }).observe(dive);

      document.addEventListener("visibilitychange", schedule);
    }
  } catch (e) {
    /* любая ошибка — молча оставляем SVG-версию */
  }
})();
