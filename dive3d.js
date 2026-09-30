/* ═══════════ 3D-сцена погружения: хрустальный моляр ═══════════
   Процедурная анатомия: коронка с 4 буграми и фиссурой + 3 изогнутых
   корня. Материал — стекло/лёд (transmission) с собственным PMREM-
   окружением, внутри пульсирует «нерв», вокруг всплывают искры.
   Прогрессивное улучшение: любой сбой = тихий откат к плоскому SVG. */
(() => {
  "use strict";
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (innerWidth < 700) return;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return;

    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;

    const sticky = document.querySelector(".dive__sticky");
    const dive = document.getElementById("dive");
    const svgHost = document.getElementById("diveTooth");
    if (!sticky || !dive || !svgHost) return;

    import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js")
      .then(init)
      .catch(() => {});

    function init(THREE) {
      /* ── рендерер ── */
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none";
      sticky.prepend(canvas);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.set(0, 0.2, 7.5);

      /* ── собственное PMREM-окружение (мини-комната из светящихся панелей) ── */
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const panel = (color, intensity, w, h, pos) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
        );
        m.position.set(pos[0], pos[1], pos[2]);
        m.lookAt(0, 0, 0);
        envScene.add(m);
      };
      panel("#ffffff", 6, 6, 4, [0, 6, 2]);        /* ключевой сверху */
      panel("#2dd4bf", 3, 8, 3, [-6, 0, 1]);       /* аква слева */
      panel("#38bdf8", 3, 8, 3, [6, -1, 1]);       /* циан справа */
      panel("#0b4560", 1.5, 10, 6, [0, -6, -2]);   /* глубина снизу */
      panel("#ffffff", 2.2, 3, 6, [0, 1, -7]);     /* римлайт сзади */
      scene.environment = pmrem.fromScene(envScene, 0.25).texture;

      /* ── геометрия моляра ── */
      const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

      const crownGeo = new THREE.SphereGeometry(1, 96, 72);
      {
        const pos = crownGeo.attributes.position;
        const v = new THREE.Vector3();
        const cusps = [
          [ 0.55,  0.55], [-0.55,  0.55],
          [ 0.55, -0.55], [-0.55, -0.55]
        ];
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          /* базовая форма: приземистая «боксовая» коронка моляра —
             выпрямляем бока (суперэллипс) и поджимаем высоту */
          const ang = Math.atan2(v.z, v.x);
          const boxy = 1 + 0.14 * Math.abs(Math.sin(2 * ang)); /* к квадрату в плане */
          v.x *= 1.04 * boxy; v.z *= 1.04 * boxy; v.y *= 0.78;
          const r = Math.hypot(v.x, v.z);
          /* верх: бугры + крестовая фиссура */
          if (v.y > 0.1) {
            const t = (v.y - 0.1) / 0.68;
            let bump = 0;
            for (let c = 0; c < 4; c++) {
              const d = Math.hypot(v.x - cusps[c][0], v.z - cusps[c][1]);
              bump += gauss(d, 0.32) * 0.38;
            }
            const fissure = (gauss(v.x, 0.12) + gauss(v.z, 0.12)) * 0.18 * t;
            v.y += bump * t - fissure;
            const spread = 1 + 0.08 * t * gauss(r - 0.8, 0.3);
            v.x *= spread; v.z *= spread;
          }
          /* гладкий профиль боков: лёгкая «талия» экватора и плавное
             сужение шейки — только непрерывные функции, без рёбер */
          const wall = 1 + 0.07 * gauss(v.y + 0.15, 0.3);
          const neckT = Math.min(1, Math.max(0, (-v.y - 0.3) / 0.5));
          const neck = 1 - 0.28 * neckT * neckT * (3 - 2 * neckT); /* smoothstep */
          v.x *= wall * neck; v.z *= wall * neck;
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        crownGeo.computeVertexNormals();
      }

      const rootGeo = (bendX, bendZ) => {
        /* корень стартует не из центра, а со своего места на шейке —
           толще у основания, мягкий изгиб наружу и к центру у кончика */
        const sx = bendX * 0.5, sz = bendZ * 0.5;
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(sx, 0.1, sz),
          new THREE.Vector3(sx + bendX * 0.3, -0.6, sz + bendZ * 0.3),
          new THREE.Vector3(sx + bendX * 0.5, -1.2, sz + bendZ * 0.5),
          new THREE.Vector3(sx + bendX * 0.28, -1.75, sz + bendZ * 0.28)
        );
        const g = new THREE.TubeGeometry(curve, 24, 0.3, 14, false);
        /* конусное сужение к кончику */
        const p = g.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i);
          const t = Math.min(1, Math.max(0, (0.1 - v.y) / 1.85));
          const c = curve.getPoint(t);
          const k = 1 - t * 0.85;
          v.x = c.x + (v.x - c.x) * k;
          v.z = c.z + (v.z - c.z) * k;
          p.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeVertexNormals();
        return g;
      };

      const toothMat = new THREE.MeshPhysicalMaterial({
        color: 0xf6feff,
        transmission: 0.55,
        thickness: 1.6,
        roughness: 0.16,
        ior: 1.45,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        attenuationColor: new THREE.Color("#bdf3ec"),
        attenuationDistance: 4.5,
        envMapIntensity: 1.35,
        side: THREE.DoubleSide,
        transparent: true
      });

      const tooth = new THREE.Group();
      tooth.add(new THREE.Mesh(crownGeo, toothMat));
      const rootsPos = [[0.5, 0.34], [-0.5, 0.34], [0, -0.58]];
      for (let i = 0; i < rootsPos.length; i++) {
        const root = new THREE.Mesh(rootGeo(rootsPos[i][0], rootsPos[i][1]), toothMat);
        root.position.y = -0.62;
        tooth.add(root);
      }

      /* «нерв» — светящееся ядро */
      const nerve = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.34, 2),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.85 })
      );
      nerve.scale.y = 1.5;
      nerve.position.y = -0.1;
      tooth.add(nerve);
      const nerveLight = new THREE.PointLight(0x2dd4bf, 2.4, 6, 2);
      tooth.add(nerveLight);

      scene.add(tooth);

      /* ── свет (дополнительно к окружению) ── */
      const ambient = new THREE.AmbientLight(0xffffff, 0.35);
      const keyL = new THREE.DirectionalLight(0x2dd4bf, 1.6);
      keyL.position.set(-4, 5, 3);
      const rimL = new THREE.DirectionalLight(0x38bdf8, 1.9);
      rimL.position.set(4, -2, -4);
      scene.add(ambient, keyL, rimL);

      /* ── искры вокруг ── */
      const SPARKS = 42;
      const sparkGeo = new THREE.BufferGeometry();
      const sp = new Float32Array(SPARKS * 3);
      const sv = new Float32Array(SPARKS);
      for (let i = 0; i < SPARKS; i++) {
        sp[i * 3] = (Math.random() - 0.5) * 7;
        sp[i * 3 + 1] = (Math.random() - 0.5) * 6;
        sp[i * 3 + 2] = (Math.random() - 0.5) * 3 - 0.5;
        sv[i] = 0.15 + Math.random() * 0.35;
      }
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
      const sparks = new THREE.Points(
        sparkGeo,
        new THREE.PointsMaterial({
          color: 0x9beee4, size: 0.045, transparent: true, opacity: 0.8,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      scene.add(sparks);

      /* ── темы ── */
      const applyTheme = () => {
        const light = document.documentElement.dataset.theme === "light";
        keyL.color.set(light ? "#0ea5a0" : "#2dd4bf");
        rimL.color.set(light ? "#0284c7" : "#38bdf8");
        ambient.intensity = light ? 0.85 : 0.35;
        renderer.toneMappingExposure = light ? 1.25 : 1.1;
        sparks.material.color.set(light ? "#0ea5a0" : "#9beee4");
        nerve.material.color.set(light ? "#0ea5a0" : "#2dd4bf");
        nerveLight.color.set(light ? "#0ea5a0" : "#2dd4bf");
      };
      applyTheme();
      new MutationObserver(applyTheme)
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      /* ── размер ── */
      const resize = () => {
        const w = sticky.clientWidth, h = sticky.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      if ("ResizeObserver" in window) new ResizeObserver(resize).observe(sticky);
      else addEventListener("resize", resize);

      /* SVG больше не нужен */
      svgHost.style.visibility = "hidden";

      /* ── анимация ── */
      let near = true, visible = !document.hidden, raf = 0, last = 0, t = 0;

      const frame = (now) => {
        raf = 0;
        const dt = Math.min((now - last) / 1000, 0.1); last = now;
        t += dt;

        const rect = dive.getBoundingClientRect();
        const total = Math.max(rect.height - innerHeight, 1);
        const p = Math.min(Math.max(-rect.top / total, 0), 1);

        /* появление-выход по краям сцены + рост в процессе */
        const enter = Math.min(1, p * 8);
        const exit = 1 - Math.max(0, (p - 0.88) / 0.12);
        const scale = (0.95 + p * 1.15) * Math.max(enter, 0.001) * Math.max(exit, 0.001);
        tooth.scale.setScalar(scale);

        tooth.rotation.y = p * 2.4 + t * 0.12;
        tooth.rotation.x = 0.25 - p * 0.5 + Math.sin(t * 0.7) * 0.04;
        tooth.rotation.z = Math.sin(t * 0.5) * 0.05;
        tooth.position.y = Math.sin(t * 0.9) * 0.12 + (0.5 - p) * 0.6;

        /* нерв пульсирует */
        const pulse = 1 + Math.sin(t * 2.2) * 0.12;
        nerve.scale.set(pulse, 1.5 * pulse, pulse);
        nerveLight.intensity = 1.8 + Math.sin(t * 2.2) * 0.8;

        /* растворение к финалу погружения */
        toothMat.opacity = Math.max(0.25, 1 - Math.max(0, p - 0.75) * 2.2);

        /* искры всплывают */
        const ps = sparkGeo.attributes.position;
        for (let i = 0; i < SPARKS; i++) {
          let y = ps.getY(i) + sv[i] * dt;
          if (y > 3.2) y = -3.2;
          ps.setY(i, y);
        }
        ps.needsUpdate = true;
        sparks.rotation.y = t * 0.03;

        renderer.render(scene, camera);
        if (near && visible) raf = requestAnimationFrame(frame);
      };

      const kick = () => {
        if (near && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      };
      new IntersectionObserver((en) => { near = en[0].isIntersecting; kick(); },
        { rootMargin: "30%" }).observe(dive);
      document.addEventListener("visibilitychange", () => { visible = !document.hidden; kick(); });
      kick();

      /* отладочный снимок кадра (используется инструментами разработки) */
      window.__diveSnap = (w) => {
        frame(performance.now());
        const out = document.createElement("canvas");
        const k = (w || 480) / canvas.width;
        out.width = Math.round(canvas.width * k);
        out.height = Math.round(canvas.height * k);
        out.getContext("2d").drawImage(canvas, 0, 0, out.width, out.height);
        return out.toDataURL("image/jpeg", 0.85);
      };
    }
  } catch (e) { /* тихий откат к SVG */ }
})();
