/* ═══════════ Просмотр 3D-снимков: окна, 3D и панель ═══════════
   Разбор DICOM и сборка объёма — в admin-ct.js. Здесь — то, что видит
   врач: три среза с общим перекрестием, объёмная модель и панель
   настроек. Монтируется в админке по ChestomCT.mount(host). */
(function () {
  "use strict";
  const CT = window.ChestomCT;
  const { M4, PLANE, NAMES } = CT;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const ICON = {
    cross: '<svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="2"/></svg>',
    pan: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
    wl: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>',
    ruler: '<svg viewBox="0 0 24 24"><path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
    one: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    shot: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    max: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  };

  /* ═══════════════ Состояние ═══════════════ */
  function makeState(vol) {
    const auto = autoWindow(vol);
    return {
      vol,
      cross: [vol.nx >> 1, vol.ny >> 1, vol.nz >> 1],   // i, j, k
      level: auto.level, width: auto.width, preset: "auto", invert: false,
      slabMode: "thin", slabMm: 10,
      tool: "cross", layout: "grid", active: "axial",
      vrMode: "bone", thrHu: Math.round(vol.otsu), opacity: 0.85, cut: "none", outlines: true, turntable: false,
      showName: false,
      measures: { axial: [], coronal: [], sagittal: [] },
    };
  }
  function autoWindow(vol) {
    const lo = vol.lo, hi = vol.hi;
    return { level: Math.round((lo + hi) / 2 + (hi - lo) * 0.08), width: Math.round((hi - lo) * 0.9) };
  }
  /* единицы КЛКТ разнятся от аппарата к аппарату: пресеты в HU,
     если диапазон похож на HU, иначе — от гистограммы снимка */
  function presets(vol) {
    const huLike = vol.min >= -1300 && vol.min <= -600 && vol.max > 1200;
    if (huLike) return {
      auto: autoWindow(vol),
      bone: { level: 1100, width: 3600 },
      fine: { level: 500, width: 1600 },
      soft: { level: 60, width: 500 },
    };
    const span = vol.hi - vol.lo;
    return {
      auto: autoWindow(vol),
      bone: { level: vol.lo + span * 0.62, width: span * 1.1 },
      fine: { level: vol.lo + span * 0.55, width: span * 0.55 },
      soft: { level: vol.lo + span * 0.3, width: span * 0.25 },
    };
  }

  /* ═══════════════ Срез ═══════════════ */
  const GEO = {
    axial:    v => ({ w: v.nx, h: v.ny, sw: v.sx, sh: v.sy, n: v.nz, sn: v.sz, axis: 2 }),
    coronal:  v => ({ w: v.nx, h: v.nz, sw: v.sx, sh: v.sz, n: v.ny, sn: v.sy, axis: 1 }),
    sagittal: v => ({ w: v.ny, h: v.nz, sw: v.sy, sh: v.sz, n: v.nx, sn: v.sx, axis: 0 }),
  };
  /* (u, v) точки на срезе → индексы вокселя; и обратно */
  function toVoxel(kind, vol, u, v, s) {
    if (kind === "axial") return [u, v, s];
    if (kind === "coronal") return [u, s, vol.nz - 1 - v];
    return [s, u, vol.nz - 1 - v];
  }
  function fromVoxel(kind, vol, c) {
    if (kind === "axial") return [c[0], c[1]];
    if (kind === "coronal") return [c[0], vol.nz - 1 - c[2]];
    return [c[1], vol.nz - 1 - c[2]];
  }
  function sliceHU(kind, vol, idx, half, mode, out) {
    const { nx, ny, nz, data } = vol, g = GEO[kind](vol), plane = nx * ny;
    const w = g.w, hgt = g.h;
    const a = clamp(idx - half, 0, g.n - 1), b = clamp(idx + half, 0, g.n - 1);
    const mip = mode === "mip", avg = mode === "avg";
    if (!avg) out.fill(-32768);
    else out.fill(0);
    const acc = avg ? new Float32Array(w * hgt) : null;
    for (let s = a; s <= b; s++) {
      for (let v = 0; v < hgt; v++) {
        let base, step;
        if (kind === "axial") { base = s * plane + v * nx; step = 1; }
        else if (kind === "coronal") { base = (nz - 1 - v) * plane + s * nx; step = 1; }
        else { base = (nz - 1 - v) * plane + s; step = nx; }
        const row = v * w;
        if (acc) for (let u = 0; u < w; u++) acc[row + u] += data[base + u * step];
        else if (mip || a === b) for (let u = 0; u < w; u++) { const x = data[base + u * step]; if (x > out[row + u]) out[row + u] = x; }
      }
    }
    if (acc) { const n = b - a + 1; for (let i = 0; i < out.length; i++) out[i] = acc[i] / n; }
    return out;
  }

  /* ═══════════════ Окно среза ═══════════════ */
  class View2D {
    constructor(app, kind, el) {
      this.app = app; this.kind = kind; this.el = el;
      this.canvas = h("canvas", "ct-canvas"); el.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      this.img = document.createElement("canvas"); this.ictx = this.img.getContext("2d");
      this.zoom = 1; this.pan = [0, 0]; this.hover = null; this.dirty = true;
      this.buf = null; this.imgData = null;
      this.bind();
    }
    geo() { return GEO[this.kind](this.app.s.vol); }
    sliceIndex() { const c = this.app.s.cross; return this.kind === "axial" ? c[2] : this.kind === "coronal" ? c[1] : c[0]; }
    layout() {
      const g = this.geo(), cw = this.cw, ch = this.ch;
      const fit = Math.min(cw / (g.w * g.sw), ch / (g.h * g.sh)) * 0.92;
      const s = fit * this.zoom;
      const W = g.w * g.sw * s, H = g.h * g.sh * s;
      return { s, ox: (cw - W) / 2 + this.pan[0], oy: (ch - H) / 2 + this.pan[1], g };
    }
    toImage(px, py) { const L = this.layout(); return [(px - L.ox) / (L.g.sw * L.s), (py - L.oy) / (L.g.sh * L.s)]; }
    toScreen(u, v) { const L = this.layout(); return [L.ox + (u + 0.5) * L.g.sw * L.s, L.oy + (v + 0.5) * L.g.sh * L.s]; }
    resize() {
      const r = this.el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cw = Math.max(10, r.width); this.ch = Math.max(10, r.height); this.dpr = dpr;
      this.canvas.width = Math.round(this.cw * dpr); this.canvas.height = Math.round(this.ch * dpr);
      this.dirty = true;
    }
    render() {
      const S = this.app.s, vol = S.vol, g = this.geo(), ctx = this.ctx;
      if (!this.buf || this.buf.length !== g.w * g.h) {
        this.buf = new Int16Array(g.w * g.h);
        this.img.width = g.w; this.img.height = g.h;
        this.imgData = this.ictx.createImageData(g.w, g.h);
      }
      const half = S.slabMode === "thin" ? 0 : Math.max(0, Math.round(S.slabMm / 2 / g.sn));
      sliceHU(this.kind, vol, this.sliceIndex(), half, S.slabMode, this.buf);
      const lut = this.app.lut, px = this.imgData.data, buf = this.buf;
      for (let i = 0, p = 0; i < buf.length; i++, p += 4) { const c = lut[buf[i] + 32768]; px[p] = px[p + 1] = px[p + 2] = c; px[p + 3] = 255; }
      this.ictx.putImageData(this.imgData, 0, 0);

      const dpr = this.dpr, L = this.layout();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#07080b"; ctx.fillRect(0, 0, this.cw, this.ch);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(this.img, L.ox, L.oy, g.w * g.sw * L.s, g.h * g.sh * L.s);
      this.overlay(L);
      this.dirty = false;
    }
    overlay(L) {
      const S = this.app.s, ctx = this.ctx, k = this.kind, cw = this.cw, ch = this.ch;
      /* перекрестие: линии соседних плоскостей их цветами, с разрывом у центра */
      const [cu, cv] = fromVoxel(k, S.vol, S.cross);
      const [x, y] = this.toScreen(cu, cv);
      const vCol = k === "sagittal" ? PLANE.coronal : PLANE.sagittal;
      const hCol = k === "axial" ? PLANE.coronal : PLANE.axial;
      const gap = 16;
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = vCol; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - gap); ctx.moveTo(x, y + gap); ctx.lineTo(x, ch); ctx.stroke();
      ctx.strokeStyle = hCol;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(x - gap, y); ctx.moveTo(x + gap, y); ctx.lineTo(cw, y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.stroke();

      /* линейки */
      ctx.font = "600 12px 'Open Sans', system-ui, sans-serif";
      const ms = S.measures[k].slice();
      if (this.drawing) ms.push(this.drawing);
      for (const m of ms) {
        const a = this.toScreen(m[0] - 0.5, m[1] - 0.5), b = this.toScreen(m[2] - 0.5, m[3] - 0.5);
        const g = L.g, mm = Math.hypot((m[2] - m[0]) * g.sw, (m[3] - m[1]) * g.sh);
        ctx.strokeStyle = "#ffd166"; ctx.fillStyle = "#ffd166"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill(); }
        const label = mm.toFixed(1).replace(".", ",") + " мм";
        const tx = (a[0] + b[0]) / 2 + 8, ty = (a[1] + b[1]) / 2 - 8;
        ctx.fillStyle = "rgba(7,8,11,.78)"; const tw = ctx.measureText(label).width;
        ctx.fillRect(tx - 5, ty - 13, tw + 10, 19);
        ctx.fillStyle = "#ffd166"; ctx.fillText(label, tx, ty);
      }

      /* подписи сторон */
      const O = { axial: ["A", "P", "R", "L"], coronal: ["S", "I", "R", "L"], sagittal: ["S", "I", "A", "P"] }[k];
      ctx.fillStyle = "rgba(230,230,240,.7)"; ctx.font = "700 12px 'Open Sans', system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.fillText(O[0], cw / 2, 18); ctx.fillText(O[1], cw / 2, ch - 10);
      ctx.textAlign = "left"; ctx.fillText(O[2], 10, ch / 2 + 4);
      ctx.textAlign = "right"; ctx.fillText(O[3], cw - 10, ch / 2 + 4);
      ctx.textAlign = "left";

      /* масштабная полоска 10 мм */
      const bar = 10 * L.s, bx = cw - 16 - bar, by = ch - 26;
      ctx.strokeStyle = "rgba(230,230,240,.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bar, by); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4); ctx.moveTo(bx + bar, by - 4); ctx.lineTo(bx + bar, by + 4); ctx.stroke();
      ctx.fillStyle = "rgba(230,230,240,.8)"; ctx.font = "600 11px 'Open Sans', system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.fillText("10 мм", bx + bar / 2, by - 8); ctx.textAlign = "left";

      /* сведения внизу слева */
      const g = L.g, idx = this.sliceIndex();
      const lines = [`${idx + 1} / ${g.n} · ${(idx * g.sn).toFixed(1).replace(".", ",")} мм`];
      if (S.slabMode !== "thin") lines.push(`${S.slabMode === "mip" ? "MIP" : "Среднее"} ${S.slabMm} мм`);
      lines.push(`W ${Math.round(S.width)} · L ${Math.round(S.level)}`);
      if (this.hover) lines.push(this.hover);
      ctx.fillStyle = "rgba(210,210,225,.72)"; ctx.font = "500 11px 'Open Sans', system-ui, sans-serif";
      lines.forEach((t, i) => ctx.fillText(t, 10, ch - 12 - (lines.length - 1 - i) * 15));
    }
    setCrossFrom(px, py) {
      const S = this.app.s, [u, v] = this.toImage(px, py), g = this.geo();
      const c = toVoxel(this.kind, S.vol, clamp(Math.floor(u), 0, g.w - 1), clamp(Math.floor(v), 0, g.h - 1), this.sliceIndex());
      S.cross = [clamp(c[0], 0, S.vol.nx - 1), clamp(c[1], 0, S.vol.ny - 1), clamp(c[2], 0, S.vol.nz - 1)];
      this.app.crossChanged();
    }
    bind() {
      const cv = this.canvas, pts = new Map();
      let drag = null, pinch = null;
      const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener("contextmenu", e => e.preventDefault());
      cv.addEventListener("pointerdown", e => {
        cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e));
        this.app.setActive(this.kind);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.zoom }; drag = null; return;
        }
        const [x, y] = pos(e), S = this.app.s;
        const tool = e.button === 2 || e.button === 1 ? "pan" : S.tool;
        drag = { tool, x, y, pan: this.pan.slice(), level: S.level, width: S.width };
        if (tool === "cross") this.setCrossFrom(x, y);
        if (tool === "ruler") { const [u, v] = this.toImage(x, y); this.drawing = [u, v, u, v]; }
      });
      cv.addEventListener("pointermove", e => {
        const p = pos(e);
        if (pts.has(e.pointerId)) pts.set(e.pointerId, p);
        if (pinch && pts.size === 2) {
          const [a, b] = [...pts.values()];
          this.zoom = clamp(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, 0.4, 16); this.app.request(this.kind); return;
        }
        this.updateHover(p[0], p[1]);
        if (!drag) return;
        const S = this.app.s, dx = p[0] - drag.x, dy = p[1] - drag.y;
        if (drag.tool === "cross") this.setCrossFrom(p[0], p[1]);
        else if (drag.tool === "pan") { this.pan = [drag.pan[0] + dx, drag.pan[1] + dy]; this.app.request(this.kind); }
        else if (drag.tool === "wl") {
          const k = (S.vol.hi - S.vol.lo) / 400;
          S.width = Math.max(1, drag.width + dx * k); S.level = drag.level - dy * k; S.preset = "";
          this.app.windowChanged();
        } else if (drag.tool === "ruler") {
          const [u, v] = this.toImage(p[0], p[1]); this.drawing[2] = u; this.drawing[3] = v; this.app.request(this.kind);
        }
      });
      const end = e => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (drag && drag.tool === "ruler" && this.drawing) {
          const d = this.drawing;
          if (Math.hypot(d[2] - d[0], d[3] - d[1]) > 1.5) this.app.s.measures[this.kind].push(d);
          this.drawing = null; this.app.request(this.kind);
        }
        drag = null;
      };
      cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
      cv.addEventListener("pointerleave", () => { this.hover = null; this.app.request(this.kind); });
      cv.addEventListener("wheel", e => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const [x, y] = pos(e), z0 = this.zoom, z1 = clamp(z0 * Math.exp(-e.deltaY * 0.0022), 0.4, 16);
          /* масштаб вокруг курсора */
          const L = this.layout(), cx = this.cw / 2 + this.pan[0], cy = this.ch / 2 + this.pan[1];
          this.pan = [this.pan[0] + (x - cx) * (1 - z1 / z0), this.pan[1] + (y - cy) * (1 - z1 / z0)];
          this.zoom = z1; this.app.request(this.kind); void L;
          return;
        }
        this.app.stepSlice(this.kind, (e.deltaY > 0 ? 1 : -1) * (e.shiftKey ? 5 : 1));
      }, { passive: false });
      cv.addEventListener("dblclick", () => this.app.toggleMax(this.kind));
    }
    updateHover(px, py) {
      const S = this.app.s, [u, v] = this.toImage(px, py), g = this.geo();
      if (u < 0 || v < 0 || u >= g.w || v >= g.h) { if (this.hover) { this.hover = null; this.app.request(this.kind); } return; }
      const c = toVoxel(this.kind, S.vol, Math.floor(u), Math.floor(v), this.sliceIndex());
      const val = S.vol.data[c[0] + c[1] * S.vol.nx + c[2] * S.vol.nx * S.vol.ny];
      this.hover = `Плотность ${val}`;
      this.app.request(this.kind);
    }
    reset() { this.zoom = 1; this.pan = [0, 0]; this.dirty = true; }
  }

  /* ═══════════════ 3D ═══════════════ */
  const VS = `#version 300 es
  in vec2 p; out vec2 vUV;
  void main(){ vUV = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `#version 300 es
  precision highp float; precision highp sampler3D;
  uniform sampler3D uVol; uniform mat4 uInvVP; uniform vec3 uExt; uniform vec3 uCam;
  uniform float uThr, uThr2, uOpacity, uSteps; uniform int uMode, uCut; uniform vec3 uCross, uTexel;
  in vec2 vUV; out vec4 o;
  vec2 hitBox(vec3 ro, vec3 rd, vec3 b){ vec3 inv = 1.0 / rd; vec3 t0 = (-b - ro) * inv, t1 = (b - ro) * inv;
    vec3 a = min(t0, t1), c = max(t0, t1); return vec2(max(max(a.x, a.y), a.z), min(min(c.x, c.y), c.z)); }
  bool cut(vec3 tc){
    if (uCut == 1) return tc.z > uCross.z;
    if (uCut == 2) return tc.x > uCross.x && tc.y < uCross.y && tc.z > uCross.z;
    return false; }
  void main(){
    vec3 bg = mix(vec3(0.035, 0.038, 0.05), vec3(0.075, 0.075, 0.1), vUV.y);
    vec4 fp = uInvVP * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
    vec3 ro = uCam, rd = normalize(fp.xyz / fp.w - ro);
    vec2 t = hitBox(ro, rd, uExt);
    if (t.x > t.y || t.y < 0.0) { o = vec4(bg, 1.0); return; }
    t.x = max(t.x, 0.0);
    float dt = length(uExt * 2.0) / uSteps, ref = length(uExt * 2.0) / 256.0;
    float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec4 acc = vec4(0.0); float mx = 0.0;
    float s = t.x + jit * dt;
    for (int i = 0; i < 1400; i++) {
      if (s > t.y) break;
      vec3 tc = (ro + rd * s) / (uExt * 2.0) + 0.5;
      s += dt;
      if (cut(tc)) continue;
      float v = texture(uVol, tc).r;
      if (uMode == 2) { mx = max(mx, v); continue; }
      if (v < uThr) continue;
      float a = smoothstep(uThr, uThr2, v) * uOpacity;
      a = 1.0 - pow(1.0 - a, dt / ref);
      vec3 g = vec3(
        texture(uVol, tc + vec3(uTexel.x, 0, 0)).r - texture(uVol, tc - vec3(uTexel.x, 0, 0)).r,
        texture(uVol, tc + vec3(0, uTexel.y, 0)).r - texture(uVol, tc - vec3(0, uTexel.y, 0)).r,
        texture(uVol, tc + vec3(0, 0, uTexel.z)).r - texture(uVol, tc - vec3(0, 0, uTexel.z)).r);
      vec3 n = -normalize(g + vec3(1e-5));
      vec3 l = -rd;
      float lam = abs(dot(n, l));
      float spec = pow(max(dot(reflect(-l, n), l), 0.0), 28.0);
      float dens = smoothstep(uThr, 1.0, v);
      vec3 base = uMode == 1 ? mix(vec3(0.86, 0.82, 0.74), vec3(1.0, 0.98, 0.94), dens)
                             : mix(vec3(0.66, 0.58, 0.48), vec3(0.97, 0.94, 0.87), dens);
      vec3 col = base * (0.26 + 0.74 * lam) + vec3(spec * 0.28);
      acc.rgb += (1.0 - acc.a) * a * col; acc.a += (1.0 - acc.a) * a;
      if (acc.a > 0.975) break;
    }
    if (uMode == 2) { float k = clamp((mx - uThr * 0.6) / (1.0 - uThr * 0.6), 0.0, 1.0); o = vec4(mix(bg, vec3(0.95), pow(k, 1.1)), 1.0); return; }
    o = vec4(acc.rgb + (1.0 - acc.a) * bg, 1.0);
  }`;

  class View3D {
    constructor(app, el) {
      this.app = app; this.el = el;
      this.canvas = h("canvas", "ct-canvas"); el.appendChild(this.canvas);
      this.over = h("canvas", "ct-canvas ct-canvas--over"); el.appendChild(this.over);
      this.octx = this.over.getContext("2d");
      this.az = 0.55; this.el_ = 0.32; this.dist = 2.6; this.quality = 1; this.dirty = true;
      const gl = this.gl = this.canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
      if (!gl) { this.failed = true; el.appendChild(h("div", "ct-3d-fail", "Этот браузер не поддерживает WebGL2 — объёмная модель недоступна. Срезы работают.")); return; }
      this.prog = this.program(VS, FS);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
      const loc = gl.getAttribLocation(this.prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.upload();
      this.bind();
    }
    program(vs, fs) {
      const gl = this.gl, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
      const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.u = n => gl.getUniformLocation(p, n);
      return p;
    }
    /* объём для видеокарты: 8 бит, не больше ~320 вокселей по стороне */
    upload() {
      const gl = this.gl, vol = this.app.s.vol;
      const d = Math.max(1, Math.ceil(Math.max(vol.nx, vol.ny, vol.nz) / 320));
      const nx = Math.floor(vol.nx / d), ny = Math.floor(vol.ny / d), nz = Math.floor(vol.nz / d);
      const lo = vol.lo, span = Math.max(1, vol.hi - vol.lo), src = vol.data, P = vol.nx * vol.ny;
      const f = new Float32Array(nx * ny * nz);
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        let s = 0;
        if (d === 1) s = src[i + j * vol.nx + k * P];
        else { for (let c = 0; c < d; c++) for (let b = 0; b < d; b++) for (let a = 0; a < d; a++) s += src[(i * d + a) + (j * d + b) * vol.nx + (k * d + c) * P]; s /= d * d * d; }
        f[i + j * nx + k * nx * ny] = s;
      }
      /* лёгкое сглаживание [1 2 1] по трём осям: шум КЛКТ иначе даёт
         на поверхности кости «зерно» и полосы; на срезах данные исходные */
      const tmp = new Float32Array(f.length), strides = [1, nx, nx * ny], dims = [nx, ny, nz];
      for (let ax = 0; ax < 3; ax++) {
        const st = strides[ax], n = dims[ax];
        for (let idx = 0; idx < f.length; idx++) {
          const c = ((idx / st) | 0) % n;
          const a = c > 0 ? f[idx - st] : f[idx], b = c < n - 1 ? f[idx + st] : f[idx];
          tmp[idx] = (a + 2 * f[idx] + b) * 0.25;
        }
        f.set(tmp);
      }
      const out = new Uint8Array(f.length);
      for (let i = 0; i < f.length; i++) out[i] = clamp(((f[i] - lo) / span) * 255, 0, 255);
      this.tex3 = { nx, ny, nz, data: out, lo, span };
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, nx, ny, nz, 0, gl.RED, gl.UNSIGNED_BYTE, out);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.CLAMP_TO_EDGE);
      /* половины размеров в мм, нормированные — самая длинная сторона = 1 */
      const ex = vol.nx * vol.sx, ey = vol.ny * vol.sy, ez = vol.nz * vol.sz, m = Math.max(ex, ey, ez);
      this.ext = [ex / m / 2 * 2, ey / m / 2 * 2, ez / m / 2 * 2].map(v => v / 2);
    }
    thr01(hu) { return clamp((hu - this.tex3.lo) / this.tex3.span, 0, 1); }
    resize() {
      const r = this.el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.cw = Math.max(10, r.width); this.ch = Math.max(10, r.height); this.dpr = dpr;
      this.over.width = Math.round(this.cw * dpr); this.over.height = Math.round(this.ch * dpr);
      this.dirty = true;
    }
    camera() {
      const c = [Math.sin(this.az) * Math.cos(this.el_) * this.dist, -Math.cos(this.az) * Math.cos(this.el_) * this.dist, Math.sin(this.el_) * this.dist];
      const V = M4.lookAt(c, [0, 0, 0], [0, 0, 1]), P = M4.persp(0.52, this.cw / this.ch, 0.05, 20);
      const VP = M4.mul(P, V);
      return { c, VP, inv: M4.inv(VP) };
    }
    render() {
      if (this.failed) return;
      const gl = this.gl, S = this.app.s, q = this.moving ? 0.5 : 1;
      const W = Math.round(this.cw * this.dpr * q), H = Math.round(this.ch * this.dpr * q);
      if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
      gl.viewport(0, 0, W, H);
      gl.useProgram(this.prog); gl.bindVertexArray(this.vao);
      const cam = this.camera(); this.cam = cam;
      const t = this.tex3, vol = S.vol;
      const thrHu = S.vrMode === "teeth" ? Math.max(S.thrHu, S.thrHu + (vol.hi - S.thrHu) * 0.45) : S.thrHu;
      const thr = this.thr01(thrHu);
      gl.uniformMatrix4fv(this.u("uInvVP"), false, new Float32Array(cam.inv));
      gl.uniform3fv(this.u("uExt"), this.ext); gl.uniform3fv(this.u("uCam"), cam.c);
      gl.uniform1f(this.u("uThr"), thr); gl.uniform1f(this.u("uThr2"), Math.min(1, thr + 0.12));
      gl.uniform1f(this.u("uOpacity"), S.opacity); gl.uniform1f(this.u("uSteps"), this.moving ? 220 : 480);
      gl.uniform1i(this.u("uMode"), S.vrMode === "mip" ? 2 : S.vrMode === "teeth" ? 1 : 0);
      gl.uniform1i(this.u("uCut"), S.cut === "axial" ? 1 : S.cut === "octant" ? 2 : 0);
      gl.uniform3fv(this.u("uCross"), [(S.cross[0] + 0.5) / vol.nx, (S.cross[1] + 0.5) / vol.ny, (S.cross[2] + 0.5) / vol.nz]);
      gl.uniform3fv(this.u("uTexel"), [1.2 / t.nx, 1.2 / t.ny, 1.2 / t.nz]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.overlay();
      this.dirty = false;
    }
    project(p) { const r = M4.apply(this.cam.VP, p); return [(r[0] * 0.5 + 0.5) * this.cw, (1 - (r[1] * 0.5 + 0.5)) * this.ch, r[3]]; }
    overlay() {
      const ctx = this.octx, S = this.app.s, vol = S.vol, e = this.ext;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.cw, this.ch);
      if (S.outlines) {
        const fx = (S.cross[0] + 0.5) / vol.nx * 2 - 1, fy = (S.cross[1] + 0.5) / vol.ny * 2 - 1, fz = (S.cross[2] + 0.5) / vol.nz * 2 - 1;
        const planes = {
          axial: [[-1, -1, fz], [1, -1, fz], [1, 1, fz], [-1, 1, fz]],
          coronal: [[-1, fy, -1], [1, fy, -1], [1, fy, 1], [-1, fy, 1]],
          sagittal: [[fx, -1, -1], [fx, 1, -1], [fx, 1, 1], [fx, -1, 1]],
        };
        ctx.lineWidth = 1.3;
        for (const k in planes) {
          const pts = planes[k].map(p => this.project([p[0] * e[0], p[1] * e[1], p[2] * e[2]]));
          ctx.strokeStyle = PLANE[k]; ctx.globalAlpha = 0.9;
          ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
          ctx.globalAlpha = 0.07; ctx.fillStyle = PLANE[k]; ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = "rgba(210,210,225,.6)"; ctx.font = "500 11px 'Open Sans', system-ui, sans-serif";
      ctx.fillText("Тяните — вращать · колесо — масштаб · клик — перекрестие", 10, this.ch - 12);
    }
    /* клик по модели: ищем первую точку кости вдоль луча и ставим туда перекрестие */
    pick(px, py) {
      if (!this.cam) return;
      const ndc = [px / this.cw * 2 - 1, 1 - py / this.ch * 2];
      const far = M4.apply(this.cam.inv, [ndc[0], ndc[1], 1]), ro = this.cam.c;
      let rd = [far[0] - ro[0], far[1] - ro[1], far[2] - ro[2]]; const l = Math.hypot(...rd); rd = rd.map(v => v / l);
      const e = this.ext, t = this.tex3, S = this.app.s;
      const thr = this.thr01(S.vrMode === "teeth" ? S.thrHu + (S.vol.hi - S.thrHu) * 0.45 : S.thrHu) * 255;
      const step = Math.hypot(...e) * 2 / 700;
      for (let s = 0; s < 8; s += step) {
        const p = [ro[0] + rd[0] * s, ro[1] + rd[1] * s, ro[2] + rd[2] * s];
        const tc = [p[0] / (2 * e[0]) + 0.5, p[1] / (2 * e[1]) + 0.5, p[2] / (2 * e[2]) + 0.5];
        if (tc.some(v => v < 0 || v > 1)) continue;
        const i = Math.min(t.nx - 1, tc[0] * t.nx | 0), j = Math.min(t.ny - 1, tc[1] * t.ny | 0), k = Math.min(t.nz - 1, tc[2] * t.nz | 0);
        if (t.data[i + j * t.nx + k * t.nx * t.ny] >= thr) {
          const vol = S.vol;
          S.cross = [clamp(tc[0] * vol.nx | 0, 0, vol.nx - 1), clamp(tc[1] * vol.ny | 0, 0, vol.ny - 1), clamp(tc[2] * vol.nz | 0, 0, vol.nz - 1)];
          this.app.crossChanged(); return;
        }
      }
    }
    bind() {
      const cv = this.over; let drag = null;
      cv.addEventListener("pointerdown", e => {
        cv.setPointerCapture(e.pointerId); this.app.setActive("vr");
        drag = { x: e.clientX, y: e.clientY, az: this.az, el: this.el_, moved: false };
      });
      cv.addEventListener("pointermove", e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        this.az = drag.az - dx * 0.008; this.el_ = clamp(drag.el + dy * 0.008, -1.45, 1.45);
        this.interact();
      });
      cv.addEventListener("pointerup", e => {
        if (drag && !drag.moved) { const r = cv.getBoundingClientRect(); this.pick(e.clientX - r.left, e.clientY - r.top); }
        drag = null;
      });
      cv.addEventListener("wheel", e => { e.preventDefault(); this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0015), 1.1, 6); this.interact(); }, { passive: false });
      cv.addEventListener("dblclick", () => this.app.toggleMax("vr"));
    }
    /* пока вращают — рисуем в половинном разрешении, потом доводим */
    interact() {
      this.moving = true; this.app.request("vr");
      clearTimeout(this.idleT); this.idleT = setTimeout(() => { this.moving = false; this.app.request("vr"); }, 160);
    }
    reset() { this.az = 0.55; this.el_ = 0.32; this.dist = 2.6; this.dirty = true; }
    dispose() { if (this.gl) { const x = this.gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); } }
  }

  /* ═══════════════ Приложение ═══════════════ */
  class App {
    constructor(host) {
      this.host = host; this.s = null; this.views = {}; this.raf = 0;
      this.renderEmpty();
    }
    /* ── пустое состояние: выбрать папку ── */
    renderEmpty(msg) {
      this.dispose();
      this.host.innerHTML = "";
      const box = h("div", "ct-empty");
      box.innerHTML = `
        <div class="ct-drop" tabindex="0">
          <span class="ct-drop__ico">${ICON.folder}</span>
          <b>Перетащите сюда папку со снимком</b>
          <span>КЛКТ или КТ в формате DICOM — сотни файлов из папки, которую выдаёт аппарат или диск пациента</span>
          <div class="ct-drop__btns">
            <label class="btn btn--primary">Выбрать папку<input type="file" webkitdirectory directory multiple hidden data-pick="dir"></label>
            <label class="btn btn--ghost">Выбрать файлы<input type="file" multiple hidden data-pick="files"></label>
          </div>
          ${msg ? `<p class="ct-drop__err" role="alert">${msg}</p>` : ""}
        </div>
        <p class="ct-privacy">${ICON.lock}<span>Снимок открывается только на этом компьютере: файлы не загружаются на сервер и не сохраняются. Закрыли вкладку — данных нет.</span></p>`;
      this.host.appendChild(box);
      box.querySelectorAll("input[type=file]").forEach(inp => inp.addEventListener("change", () => this.load([...inp.files])));
      const drop = box.querySelector(".ct-drop");
      drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("is-over"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
      drop.addEventListener("drop", async e => {
        e.preventDefault(); drop.classList.remove("is-over");
        const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
        const files = items.length ? await readEntries(items) : [...e.dataTransfer.files];
        this.load(files);
      });
    }
    async load(files) {
      files = files.filter(f => !/\.(txt|pdf|exe|dll|inf|ini|html?|js|css|xml|jpg|jpeg|png|bmp|zip|ico|json)$/i.test(f.name) && !/^dicomdir$/i.test(f.name) && f.size > 256);
      files.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true }));
      if (!files.length) return this.renderEmpty("В выбранной папке нет файлов DICOM.");
      this.host.innerHTML = `<div class="ct-loading"><b>Читаем снимок…</b><div class="ct-bar"><i></i></div><span>0 из ${files.length} файлов</span></div>`;
      const bar = this.host.querySelector(".ct-bar i"), lbl = this.host.querySelector(".ct-loading span");
      try {
        const vol = await CT.buildVolume(files, p => { bar.style.width = (p * 100).toFixed(1) + "%"; lbl.textContent = `${Math.round(p * files.length)} из ${files.length} файлов`; });
        this.start(vol);
      } catch (e) {
        console.error(e);
        const m = e.message === "compressed"
          ? "Снимок сохранён в сжатом формате DICOM (JPEG). Выгрузите его из программы аппарата без сжатия (Uncompressed / Explicit VR Little Endian) — такой формат открывается."
          : e.message === "empty" ? "Не нашли в файлах изображений DICOM. Проверьте, что выбрана папка со снимком."
          : "Не получилось прочитать снимок: " + (e.message || "ошибка") + ". Если объём очень большой, попробуйте на компьютере с большей памятью.";
        this.renderEmpty(m);
      }
    }
    start(vol) {
      this.s = makeState(vol);
      this.P = presets(vol);
      this.buildUI();
      this.makeLut();
      this.ro = new ResizeObserver(() => { for (const k in this.views) this.views[k].resize(); this.requestAll(); });
      this.ro.observe(this.grid);
      for (const k in this.views) this.views[k].resize();
      /* на планшете и телефоне — одно окно и вкладки */
      if (matchMedia("(max-width: 1100px)").matches) this.toggleMax("axial", true);
      this.requestAll();
      this.keys = e => {
        if (!this.s || !this.host.isConnected || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
        if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); this.stepSlice(this.s.active === "vr" ? "axial" : this.s.active, e.key === "ArrowUp" ? -1 : 1); }
      };
      document.addEventListener("keydown", this.keys);
    }
    buildUI() {
      const S = this.s, vol = S.vol, meta = vol.meta;
      this.host.innerHTML = "";
      const root = h("div", "ct"); this.root = root;
      const date = meta.date && meta.date.length === 8 ? `${meta.date.slice(6, 8)}.${meta.date.slice(4, 6)}.${meta.date.slice(0, 4)}` : "";
      const bar = h("div", "ct-bar-top");
      bar.innerHTML = `
        <div class="ct-study">
          <b>${[meta.maker, meta.model].filter(Boolean).join(" ") || "Снимок"} ${meta.modality ? "· " + meta.modality : ""}</b>
          <span>${date ? date + " · " : ""}${vol.nx}×${vol.ny}×${vol.nz} · воксель ${vol.sx.toFixed(2).replace(".", ",")} мм</span>
          <span class="ct-patient" data-ct="patient"></span>
        </div>
        <div class="ct-tools" role="toolbar" aria-label="Инструменты">
          ${[["cross", "Перекрестие"], ["pan", "Сдвиг"], ["wl", "Яркость и контраст"], ["ruler", "Линейка"]].map(([k, t]) => `<button type="button" data-tool="${k}" title="${t}" aria-label="${t}">${ICON[k]}</button>`).join("")}
          <span class="ct-sep"></span>
          <button type="button" data-act="layout" title="Одно окно / четыре окна" aria-label="Раскладка">${ICON.one}</button>
          <button type="button" data-act="reset" title="Сбросить вид" aria-label="Сбросить вид">${ICON.reset}</button>
          <button type="button" data-act="shot" title="Сохранить кадр активного окна" aria-label="Сохранить кадр">${ICON.shot}</button>
          <span class="ct-sep"></span>
          <button type="button" data-act="close" class="ct-close" title="Закрыть снимок">${ICON.close}<span>Закрыть</span></button>
        </div>`;
      root.appendChild(bar);

      const body = h("div", "ct-body"); root.appendChild(body);
      const grid = h("div", "ct-grid"); this.grid = grid; body.appendChild(grid);
      const tabs = h("div", "ct-tabs");
      for (const k of ["axial", "vr", "coronal", "sagittal"]) {
        const cell = h("div", "ct-cell"); cell.dataset.view = k;
        cell.innerHTML = `<span class="ct-cell__tag" style="--c:${PLANE[k] || "#b8b2ff"}">${NAMES[k]}</span><button type="button" class="ct-cell__max" title="Развернуть" aria-label="Развернуть">${ICON.max}</button>`;
        grid.appendChild(cell);
        cell.querySelector(".ct-cell__max").addEventListener("click", () => this.toggleMax(k));
        this.views[k] = k === "vr" ? new View3D(this, cell) : new View2D(this, k, cell);
        const tb = h("button", "", NAMES[k]); tb.type = "button"; tb.dataset.view = k;
        tb.addEventListener("click", () => { this.setActive(k); this.toggleMax(k, true); });
        tabs.appendChild(tb);
      }
      grid.before(tabs);
      body.appendChild(this.panel());
      this.host.appendChild(root);

      bar.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", () => { S.tool = b.dataset.tool; this.syncUI(); }));
      bar.querySelector('[data-act="layout"]').addEventListener("click", () => this.toggleMax(S.active));
      bar.querySelector('[data-act="reset"]').addEventListener("click", () => {
        for (const k in this.views) this.views[k].reset();
        S.cross = [vol.nx >> 1, vol.ny >> 1, vol.nz >> 1];
        S.measures = { axial: [], coronal: [], sagittal: [] };
        this.requestAll();
      });
      bar.querySelector('[data-act="shot"]').addEventListener("click", () => this.shot());
      bar.querySelector('[data-act="close"]').addEventListener("click", () => this.renderEmpty());
      this.setActive("axial");
      this.syncUI();
    }
    panel() {
      const S = this.s, vol = S.vol;
      const p = h("aside", "ct-panel");
      const huMin = Math.floor(vol.lo), huMax = Math.ceil(vol.hi);
      p.innerHTML = `
        <section>
          <h4>Контраст</h4>
          <div class="ct-seg" data-group="preset">
            <button type="button" data-v="auto">Авто</button><button type="button" data-v="bone">Кость</button>
            <button type="button" data-v="fine">Тонкая кость</button><button type="button" data-v="soft">Мягкие ткани</button>
          </div>
          <canvas class="ct-hist" width="560" height="110"></canvas>
          <label class="ct-range"><span>Уровень <output data-out="level"></output></span><input type="range" data-k="level" min="${huMin}" max="${huMax}" step="1"></label>
          <label class="ct-range"><span>Ширина <output data-out="width"></output></span><input type="range" data-k="width" min="1" max="${Math.max(2, huMax - huMin) * 2}" step="1"></label>
          <label class="ct-switch"><input type="checkbox" data-k="invert"><span>Инверсия</span></label>
        </section>
        <section>
          <h4>Толщина среза</h4>
          <div class="ct-seg" data-group="slabMode"><button type="button" data-v="thin">Тонкий</button><button type="button" data-v="mip">MIP</button><button type="button" data-v="avg">Среднее</button></div>
          <label class="ct-range"><span>Толщина <output data-out="slabMm"></output></span><input type="range" data-k="slabMm" min="1" max="40" step="1"></label>
        </section>
        <section>
          <h4>3D</h4>
          <div class="ct-seg" data-group="vrMode"><button type="button" data-v="bone">Кость</button><button type="button" data-v="teeth">Зубы</button><button type="button" data-v="mip">MIP</button></div>
          <label class="ct-range"><span>Порог <output data-out="thrHu"></output></span><input type="range" data-k="thrHu" min="${huMin}" max="${huMax}" step="1"></label>
          <label class="ct-range"><span>Непрозрачность <output data-out="opacity"></output></span><input type="range" data-k="opacity" min="0.05" max="1" step="0.01"></label>
          <span class="ct-lbl">Разрез по перекрестию</span>
          <div class="ct-seg" data-group="cut"><button type="button" data-v="none">Нет</button><button type="button" data-v="axial">Сверху</button><button type="button" data-v="octant">Угол</button></div>
          <label class="ct-switch"><input type="checkbox" data-k="outlines"><span>Контуры срезов</span></label>
          <label class="ct-switch"><input type="checkbox" data-k="turntable"><span>Вращение</span></label>
        </section>
        <section class="ct-info">
          <h4>Исследование</h4>
          <dl>
            <dt>Файлов</dt><dd>${vol.files}${vol.skipped ? ` (пропущено ${vol.skipped})` : ""}</dd>
            <dt>Объём</dt><dd>${(vol.nx * vol.sx).toFixed(0)}×${(vol.ny * vol.sy).toFixed(0)}×${(vol.nz * vol.sz).toFixed(0)} мм</dd>
            <dt>Воксель</dt><dd>${vol.sx.toFixed(2)}×${vol.sy.toFixed(2)}×${vol.sz.toFixed(2)} мм</dd>
            ${vol.factor > 1 || vol.zStep > 1 ? `<dt>Прорежено</dt><dd>×${vol.factor} по срезу, ×${vol.zStep} по высоте — объём большой</dd>` : ""}
          </dl>
          <label class="ct-switch"><input type="checkbox" data-k="showName"><span>Показать ФИО пациента</span></label>
          <p class="ct-note">${ICON.lock}Снимок только в памяти этой вкладки, на сервер не отправляется.</p>
        </section>`;
      this.hist = p.querySelector(".ct-hist");
      p.querySelectorAll(".ct-seg").forEach(seg => seg.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        const g = seg.dataset.group, v = b.dataset.v;
        if (g === "preset") { const pr = this.P[v]; S.level = pr.level; S.width = pr.width; S.preset = v; this.windowChanged(); }
        else { S[g] = v; if (g === "slabMode") this.request2D(); else this.request("vr"); }
        this.syncUI();
      }));
      p.querySelectorAll("input[data-k]").forEach(inp => inp.addEventListener("input", () => {
        const k = inp.dataset.k;
        S[k] = inp.type === "checkbox" ? inp.checked : +inp.value;
        if (k === "level" || k === "width" || k === "invert") { if (k !== "invert") S.preset = ""; this.windowChanged(); }
        else if (k === "slabMm") this.request2D();
        else if (k === "turntable") this.spin();
        else if (k === "showName") this.syncUI();
        else this.request("vr");
        this.syncUI(true);
      }));
      return p;
    }
    syncUI(skipInputs) {
      const S = this.s, r = this.root; if (!r) return;
      r.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("is-on", b.dataset.tool === S.tool));
      r.dataset.tool = S.tool;
      r.querySelectorAll(".ct-seg").forEach(seg => seg.querySelectorAll("button").forEach(b => b.classList.toggle("is-on", S[seg.dataset.group] === b.dataset.v)));
      if (!skipInputs) r.querySelectorAll("input[data-k]").forEach(inp => { if (inp.type === "checkbox") inp.checked = !!S[inp.dataset.k]; else inp.value = S[inp.dataset.k]; });
      const fmt = { level: v => Math.round(v), width: v => Math.round(v), slabMm: v => v + " мм", thrHu: v => Math.round(v), opacity: v => Math.round(v * 100) + "%" };
      r.querySelectorAll("output[data-out]").forEach(o => { const k = o.dataset.out; o.textContent = fmt[k](S[k]); });
      const pat = r.querySelector('[data-ct="patient"]'), m = S.vol.meta;
      pat.textContent = S.showName ? [m.patient, m.patientId ? "ID " + m.patientId : ""].filter(Boolean).join(" · ") || "ФИО нет в файлах" : "Данные пациента скрыты";
      pat.classList.toggle("is-hidden", !S.showName);
      this.drawHist();
    }
    drawHist() {
      const c = this.hist, ctx = c.getContext("2d"), vol = this.s.vol, S = this.s;
      const W = c.width, H = c.height, hist = vol.hist, B = hist.length;
      ctx.clearRect(0, 0, W, H);
      const a = Math.floor((vol.lo - vol.histMin) / vol.histSpan * B), b = Math.ceil((vol.hi - vol.histMin) / vol.histSpan * B);
      let mx = 1; for (let i = a; i < b; i++) mx = Math.max(mx, hist[i]);
      const lmx = Math.log(mx + 1);
      ctx.fillStyle = "rgba(180,172,255,.55)";
      for (let i = a; i < b; i++) { const x = (i - a) / (b - a) * W, bh = Math.log(hist[i] + 1) / lmx * (H - 8); ctx.fillRect(x, H - bh, W / (b - a) + 0.6, bh); }
      const toX = hu => (hu - vol.lo) / (vol.hi - vol.lo) * W;
      const x0 = toX(S.level - S.width / 2), x1 = toX(S.level + S.width / 2);
      ctx.fillStyle = "rgba(139,124,246,.16)"; ctx.fillRect(x0, 0, x1 - x0, H);
      ctx.strokeStyle = "#b8b2ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, H); ctx.lineTo(x1, 0); ctx.stroke();
    }
    makeLut() {
      const S = this.s, lut = this.lut || (this.lut = new Uint8Array(65536));
      const lo = S.level - S.width / 2, w = Math.max(1, S.width);
      for (let i = 0; i < 65536; i++) { let c = ((i - 32768 - lo) / w) * 255; c = c < 0 ? 0 : c > 255 ? 255 : c; lut[i] = S.invert ? 255 - c : c; }
    }
    windowChanged() { this.makeLut(); this.request2D(); this.syncUI(true); }
    crossChanged() { this.requestAll(); }
    stepSlice(kind, d) {
      const S = this.s, v = S.vol, ax = GEO[kind](v).axis, max = [v.nx, v.ny, v.nz][ax] - 1;
      /* на корональном и сагиттальном «вниз» по колесу — к пациенту сзади / справа, как в привычных просмотрщиках */
      S.cross[ax] = clamp(S.cross[ax] + d, 0, max);
      this.requestAll();
    }
    setActive(k) {
      if (!this.s) return;
      this.s.active = k;
      this.grid.querySelectorAll(".ct-cell").forEach(c => c.classList.toggle("is-active", c.dataset.view === k));
      this.root.querySelectorAll(".ct-tabs button").forEach(b => b.classList.toggle("is-on", b.dataset.view === k));
    }
    toggleMax(k, force) {
      const g = this.grid, on = force || g.dataset.max !== k;
      if (on) g.dataset.max = k; else delete g.dataset.max;
      this.s.layout = on ? "one" : "grid";
      this.setActive(k);
      const lb = this.root.querySelector('[data-act="layout"]'); lb.innerHTML = on ? ICON.grid : ICON.one;
      requestAnimationFrame(() => { for (const key in this.views) this.views[key].resize(); this.requestAll(); });
    }
    request(k) { const v = this.views[k]; if (v) v.dirty = true; this.schedule(); }
    request2D() { ["axial", "coronal", "sagittal"].forEach(k => (this.views[k].dirty = true)); this.request("vr"); }
    requestAll() { for (const k in this.views) this.views[k].dirty = true; this.schedule(); }
    schedule() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        for (const k in this.views) { const v = this.views[k]; if (v.dirty && v.cw && v.el.offsetParent !== null) v.render(); }
      });
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
    shot() {
      const k = this.s.active, v = this.views[k];
      let c = v.canvas;
      if (k === "vr") {
        v.moving = false; v.render();
        c = document.createElement("canvas"); c.width = v.canvas.width; c.height = v.canvas.height;
        const x = c.getContext("2d"); x.drawImage(v.canvas, 0, 0); x.drawImage(v.over, 0, 0, c.width, c.height);
      }
      const a = document.createElement("a");
      a.download = `snimok-${NAMES[k].toLowerCase()}.png`;
      a.href = c.toDataURL("image/png"); a.click();
    }
    dispose() {
      cancelAnimationFrame(this.raf); cancelAnimationFrame(this.spinRaf); this.raf = 0;
      if (this.ro) this.ro.disconnect();
      if (this.keys) document.removeEventListener("keydown", this.keys);
      if (this.views.vr) this.views.vr.dispose();
      this.views = {}; this.s = null; this.root = null;
    }
  }

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
