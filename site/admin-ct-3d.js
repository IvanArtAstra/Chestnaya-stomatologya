/* ═══════════ Просмотр снимков: объёмная модель (WebGL2) ═══════════
   Лучи идут сквозь объём прямо в видеокарте. Режимы:
   кость и зубы (поверхность с освещением), мягкие ткани (лицо
   полупрозрачно, кость внутри), рентген (просвечивание, как на
   телерентгенограмме) и MIP (самые плотные точки по лучу).
   Координаты модели: мир в мм, сдвинутый в центр объёма и делённый
   на самую длинную сторону коробки. */
(function () {
  "use strict";
  const CT = window.ChestomCT;
  const { M4, V, PLANE, MPR } = CT;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  const VS = `#version 300 es
  in vec2 p; out vec2 vUV;
  void main(){ vUV = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
  const FS = `#version 300 es
  precision highp float; precision highp sampler3D;
  uniform sampler3D uVol; uniform mat4 uInvVP; uniform vec3 uExt, uCam;
  uniform float uThr, uThr2, uSoft, uOpacity, uSteps, uGain; uniform int uMode, uCut;
  uniform vec3 uCross, uN0, uN1, uN2, uTexel;
  in vec2 vUV; out vec4 o;
  vec2 hitBox(vec3 ro, vec3 rd, vec3 b){ vec3 inv = 1.0 / rd; vec3 t0 = (-b - ro) * inv, t1 = (b - ro) * inv;
    vec3 a = min(t0, t1), c = max(t0, t1); return vec2(max(max(a.x, a.y), a.z), min(min(c.x, c.y), c.z)); }
  bool cut(vec3 q){
    vec3 d = q - uCross;
    if (uCut == 1) return dot(d, uN2) > 0.0;
    if (uCut == 2) return dot(d, uN0) > 0.0 && dot(d, uN1) < 0.0 && dot(d, uN2) > 0.0;
    if (uCut == 3) return dot(d, uN1) < 0.0;
    return false; }
  vec3 shade(vec3 tc, vec3 rd, vec3 base){
    vec3 g = vec3(
      texture(uVol, tc + vec3(uTexel.x, 0, 0)).r - texture(uVol, tc - vec3(uTexel.x, 0, 0)).r,
      texture(uVol, tc + vec3(0, uTexel.y, 0)).r - texture(uVol, tc - vec3(0, uTexel.y, 0)).r,
      texture(uVol, tc + vec3(0, 0, uTexel.z)).r - texture(uVol, tc - vec3(0, 0, uTexel.z)).r);
    vec3 n = -normalize(g + vec3(1e-5)), l = normalize(-rd + vec3(0.25, 0.15, 0.35));
    float lam = abs(dot(n, l)), rim = pow(1.0 - abs(dot(n, -rd)), 3.0);
    float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 32.0);
    return base * (0.24 + 0.76 * lam) + vec3(spec * 0.3) + base * rim * 0.12; }
  void main(){
    vec3 bg = mix(vec3(0.035, 0.038, 0.05), vec3(0.08, 0.078, 0.11), vUV.y);
    vec4 fp = uInvVP * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
    vec3 ro = uCam, rd = normalize(fp.xyz / fp.w - ro);
    vec2 t = hitBox(ro, rd, uExt);
    if (t.x > t.y || t.y < 0.0) { o = vec4(uMode == 3 ? vec3(0.02) : bg, 1.0); return; }
    t.x = max(t.x, 0.0);
    float dt = length(uExt * 2.0) / uSteps, ref = length(uExt * 2.0) / 256.0;
    float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec4 acc = vec4(0.0); float mx = 0.0, sum = 0.0;
    float s = t.x + jit * dt;
    for (int i = 0; i < 1400; i++) {
      if (s > t.y) break;
      vec3 q = ro + rd * s, tc = q / (uExt * 2.0) + 0.5;
      s += dt;
      if (cut(q)) continue;
      float v = texture(uVol, tc).r;
      if (uMode == 2) { mx = max(mx, v); continue; }
      if (uMode == 3) { sum += max(v - uSoft, 0.0) * dt; continue; }
      float a; vec3 col;
      if (uMode == 4 && v < uThr) {
        if (v < uSoft) continue;
        a = smoothstep(uSoft, uSoft + 0.06, v) * 0.045 * uOpacity;
        col = shade(tc, rd, vec3(0.93, 0.72, 0.64));
      } else {
        if (v < uThr) continue;
        a = smoothstep(uThr, uThr2, v) * (uMode == 4 ? 0.95 : uOpacity);
        float dens = smoothstep(uThr, 1.0, v);
        vec3 base = uMode == 1 ? mix(vec3(0.86, 0.82, 0.74), vec3(1.0, 0.98, 0.94), dens)
                               : mix(vec3(0.66, 0.58, 0.48), vec3(0.97, 0.94, 0.87), dens);
        col = shade(tc, rd, base);
      }
      a = 1.0 - pow(1.0 - a, dt / ref);
      acc.rgb += (1.0 - acc.a) * a * col; acc.a += (1.0 - acc.a) * a;
      if (acc.a > 0.975) break;
    }
    if (uMode == 2) { float k = clamp((mx - uThr * 0.6) / (1.0 - uThr * 0.6), 0.0, 1.0); o = vec4(mix(bg, vec3(0.96), pow(k, 1.1)), 1.0); return; }
    if (uMode == 3) { float k = 1.0 - exp(-sum * uGain); o = vec4(vec3(pow(k, 0.85)), 1.0); return; }
    o = vec4(acc.rgb + (1.0 - acc.a) * bg, 1.0);
  }`;

  const VIEWS = {
    front: [0, 0.05], left: [-Math.PI / 2, 0.05], right: [Math.PI / 2, 0.05],
    top: [0, 1.45], bottom: [0, -1.45], back: [Math.PI, 0.05], iso: [0.55, 0.32],
  };

  class View3D {
    constructor(app, key, el) {
      this.app = app; this.key = key; this.el = el;
      this.canvas = h("canvas", "ct-canvas"); el.appendChild(this.canvas);
      this.over = h("canvas", "ct-canvas ct-canvas--over"); el.appendChild(this.over);
      this.octx = this.over.getContext("2d");
      this.az = 0.55; this.el_ = 0.32; this.dist = 2.6; this.target = [0, 0, 0]; this.dirty = true;
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
    get S() { return this.app.s; }
    program(vs, fs) {
      const gl = this.gl, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
      const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const cache = {};
      this.u = n => (n in cache ? cache[n] : (cache[n] = gl.getUniformLocation(p, n)));
      return p;
    }
    /* объём для видеокарты: 8 бит, не больше ~320 вокселей по стороне, сглаженный */
    upload() {
      const gl = this.gl, vol = this.S.vol;
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
      /* [1 2 1] по трём осям: шум КЛКТ иначе даёт на поверхности кости «зерно» */
      const tmp = new Float32Array(f.length), strides = [1, nx, nx * ny], dims = [nx, ny, nz];
      for (let ax = 0; ax < 3; ax++) {
        const st = strides[ax], n = dims[ax];
        for (let idx = 0; idx < f.length; idx++) {
          const c = ((idx / st) | 0) % n;
          tmp[idx] = ((c > 0 ? f[idx - st] : f[idx]) + 2 * f[idx] + (c < n - 1 ? f[idx + st] : f[idx])) * 0.25;
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
      const B = [vol.nx * vol.sx, vol.ny * vol.sy, vol.nz * vol.sz];
      this.M = Math.max(...B);
      this.ext = B.map(v => v / this.M / 2);
    }
    /* мир (мм) → координаты модели */
    toN(q) { const E = this.S.vol.ext; return [(q[0] - E[0] / 2) / this.M, (q[1] - E[1] / 2) / this.M, (q[2] - E[2] / 2) / this.M]; }
    fromN(p) { const E = this.S.vol.ext; return [p[0] * this.M + E[0] / 2, p[1] * this.M + E[1] / 2, p[2] * this.M + E[2] / 2]; }
    thr01(hu) { return clamp((hu - this.tex3.lo) / this.tex3.span, 0, 1); }
    thresholds() {
      const S = this.S, vol = S.vol;
      const bone = S.vrMode === "teeth" ? S.thrHu + (vol.hi - S.thrHu) * 0.45 : S.thrHu;
      const soft = vol.huLike ? -350 : vol.lo + (vol.otsu - vol.lo) * 0.3;
      return { bone: this.thr01(bone), soft: this.thr01(soft) };
    }
    resize() {
      const r = this.el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      this.cw = Math.max(10, r.width); this.ch = Math.max(10, r.height); this.dpr = dpr;
      this.over.width = Math.round(this.cw * dpr); this.over.height = Math.round(this.ch * dpr);
      this.dirty = true;
    }
    camera() {
      const t = this.target, c = [t[0] + Math.sin(this.az) * Math.cos(this.el_) * this.dist, t[1] - Math.cos(this.az) * Math.cos(this.el_) * this.dist, t[2] + Math.sin(this.el_) * this.dist];
      /* почти сверху или снизу «вверх» экрана — вперёд по лицу, иначе вид вырождается */
      const sg = Math.sign(this.el_), up = Math.abs(this.el_) > 1.4 ? [Math.sin(this.az) * sg, -Math.cos(this.az) * sg, 0] : [0, 0, 1];
      const Vw = M4.lookAt(c, t, up), P = M4.persp(0.52, this.cw / this.ch, 0.05, 20);
      const VP = M4.mul(P, Vw);
      return { c, VP, inv: M4.inv(VP) };
    }
    render() {
      if (this.failed) return;
      const gl = this.gl, S = this.S, low = this.moving || this.app.fast, q = low ? 0.5 : 1;
      const W = Math.round(this.cw * this.dpr * q), H = Math.round(this.ch * this.dpr * q);
      if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
      gl.viewport(0, 0, W, H);
      gl.useProgram(this.prog); gl.bindVertexArray(this.vao);
      const cam = this.camera(); this.cam = cam;
      const t = this.tex3, th = this.thresholds();
      const mode = { bone: 0, teeth: 1, mip: 2, xray: 3, soft: 4 }[S.vrMode] || 0;
      gl.uniformMatrix4fv(this.u("uInvVP"), false, new Float32Array(cam.inv));
      gl.uniform3fv(this.u("uExt"), this.ext); gl.uniform3fv(this.u("uCam"), cam.c);
      gl.uniform1f(this.u("uThr"), th.bone); gl.uniform1f(this.u("uThr2"), Math.min(1, th.bone + 0.12)); gl.uniform1f(this.u("uSoft"), th.soft);
      gl.uniform1f(this.u("uOpacity"), S.opacity); gl.uniform1f(this.u("uSteps"), low ? 220 : 480);
      gl.uniform1f(this.u("uGain"), 2.2 + S.opacity * 9);
      gl.uniform1i(this.u("uMode"), mode);
      gl.uniform1i(this.u("uCut"), { none: 0, axial: 1, octant: 2, front: 3 }[S.cut] || 0);
      gl.uniform3fv(this.u("uCross"), this.toN(S.p));
      gl.uniform3fv(this.u("uN0"), S.views.sagittal.n); gl.uniform3fv(this.u("uN1"), S.views.coronal.n); gl.uniform3fv(this.u("uN2"), S.views.axial.n);
      gl.uniform3fv(this.u("uTexel"), [1.2 / t.nx, 1.2 / t.ny, 1.2 / t.nz]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.overlay();
      this.dirty = false;
    }
    project(p) { const r = M4.apply(this.cam.VP, p); return [(r[0] * 0.5 + 0.5) * this.cw, (1 - (r[1] * 0.5 + 0.5)) * this.ch, r[3]]; }
    /* многоугольник: плоскость ∩ коробка объёма */
    planePoly(q, n) {
      const e = this.ext, pts = [];
      const C = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(c => [c[0] * e[0], c[1] * e[1], c[2] * e[2]]);
      const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      for (const [a, b] of E) {
        const da = V.dot(V.sub(C[a], q), n), db = V.dot(V.sub(C[b], q), n);
        if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) { const t = da / (da - db); pts.push(V.add(C[a], V.mul(V.sub(C[b], C[a]), t))); }
      }
      if (pts.length < 3) return [];
      const c = V.mul(pts.reduce((s, p) => V.add(s, p), [0, 0, 0]), 1 / pts.length);
      const u = V.norm(V.sub(pts[0], c)), w = V.cross(n, u);
      return pts.sort((a, b) => Math.atan2(V.dot(V.sub(a, c), w), V.dot(V.sub(a, c), u)) - Math.atan2(V.dot(V.sub(b, c), w), V.dot(V.sub(b, c), u)));
    }
    overlay() {
      const ctx = this.octx, S = this.S;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.cw, this.ch);
      const cq = this.toN(S.p);
      if (S.outlines && S.vrMode !== "xray") {
        ctx.lineWidth = 1.3;
        for (const k of MPR) {
          const poly = this.planePoly(cq, S.views[k].n).map(p => this.project(p));
          if (!poly.length) continue;
          ctx.strokeStyle = PLANE[k]; ctx.globalAlpha = 0.9;
          ctx.beginPath(); poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
          ctx.globalAlpha = 0.06; ctx.fillStyle = PLANE[k]; ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      if (S.archG && this.app.showArch) {
        const G = S.archG; ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 0; k < G.n; k += 3) { const p = this.project(this.toN([G.x[k], G.y[k], S.p[2]])); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
        ctx.stroke();
      }
      /* канал нерва и импланты — поверх модели */
      for (const path of this.app.canalPaths()) {
        const P = path.pts.map(q => this.project(this.toN(q)));
        ctx.strokeStyle = "rgba(255,138,61,.35)"; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
        ctx.strokeStyle = "#ff8a3d"; ctx.lineWidth = 2.5; ctx.stroke();
      }
      for (const imp of S.implants || []) {
        const A = this.project(this.toN(imp.a)), B = this.project(this.toN(imp.b)), mid = V.mul(V.add(imp.a, imp.b), 0.5);
        const u = V.norm(V.sub(imp.b, imp.a)), view = V.norm(V.sub(this.toN(mid), this.cam.c));
        let e = V.cross(u, view); if (V.len(e) < 1e-4) e = V.cross(u, [1, 0, 0]); e = V.norm(e);
        const E = this.project(this.toN(V.add(imp.a, V.mul(e, imp.d / 2)))), R = Math.hypot(E[0] - A[0], E[1] - A[1]);
        const g = { A: { x: A[0], y: A[1] }, B: { x: B[0], y: B[1] }, R, k: R / (imp.d / 2), cos: 0, mode: "body" };
        if (Math.hypot(B[0] - A[0], B[1] - A[1]) < R * 1.2) Object.assign(g, { mode: "section", cos: 1, t: 0, P: A });
        CT.drawImplant(ctx, this, imp, imp.id === S.selImp, g);
      }
      const c = this.project(cq);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(c[0], c[1], 4, 0, 7); ctx.stroke();
      ctx.fillStyle = "rgba(210,210,225,.6)"; ctx.font = "500 11px 'Open Sans', system-ui, sans-serif";
      ctx.fillText("Тяните — вращать · Shift — сдвиг · колесо — масштаб · клик — точка", 10, this.ch - 12);
    }
    /* клик по модели: первая точка кости вдоль луча → перекрестие */
    pick(px, py) {
      if (!this.cam) return;
      const ndc = [px / this.cw * 2 - 1, 1 - py / this.ch * 2];
      const far = M4.apply(this.cam.inv, [ndc[0], ndc[1], 1]), ro = this.cam.c;
      const rd = V.norm(V.sub(far, ro)), e = this.ext, t = this.tex3, S = this.S;
      const thr = (S.vrMode === "soft" ? this.thresholds().soft : this.thresholds().bone) * 255;
      const step = Math.hypot(...e) * 2 / 800;
      for (let s = 0; s < 10; s += step) {
        const p = V.add(ro, V.mul(rd, s));
        const tc = [p[0] / (2 * e[0]) + 0.5, p[1] / (2 * e[1]) + 0.5, p[2] / (2 * e[2]) + 0.5];
        if (tc.some(v => v < 0 || v > 1)) continue;
        const i = Math.min(t.nx - 1, tc[0] * t.nx | 0), j = Math.min(t.ny - 1, tc[1] * t.ny | 0), k = Math.min(t.nz - 1, tc[2] * t.nz | 0);
        if (t.data[i + j * t.nx + k * t.nx * t.ny] >= thr) {
          const E = S.vol.ext, q = this.fromN(p);
          this.app.setCenter([clamp(q[0], 0, E[0]), clamp(q[1], 0, E[1]), clamp(q[2], 0, E[2])]);
          return;
        }
      }
    }
    setView(name) { const v = VIEWS[name]; if (!v) return; this.az = v[0]; this.el_ = v[1]; this.target = [0, 0, 0]; this.interact(); }
    bind() {
      const cv = this.over; let drag = null;
      cv.addEventListener("contextmenu", e => e.preventDefault());
      cv.addEventListener("pointerdown", e => {
        cv.setPointerCapture(e.pointerId); this.app.setActive(this.key);
        drag = { x: e.clientX, y: e.clientY, az: this.az, el: this.el_, t: this.target.slice(), moved: false, pan: e.shiftKey || e.button === 2 };
      });
      cv.addEventListener("pointermove", e => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        if (drag.pan) {
          /* сдвиг цели в плоскости экрана */
          const k = this.dist * 0.0012, ca = Math.cos(this.az), sa = Math.sin(this.az);
          const right = [ca, sa, 0], up = [-sa * Math.sin(this.el_), ca * Math.sin(this.el_), Math.cos(this.el_)];
          this.target = V.add(drag.t, V.add(V.mul(right, -dx * k), V.mul(up, dy * k)));
        } else { this.az = drag.az - dx * 0.008; this.el_ = clamp(drag.el + dy * 0.008, -1.5, 1.5); }
        this.interact();
      });
      cv.addEventListener("pointerup", e => {
        if (drag && !drag.moved) { const r = cv.getBoundingClientRect(); this.pick(e.clientX - r.left, e.clientY - r.top); }
        drag = null;
      });
      cv.addEventListener("wheel", e => { e.preventDefault(); this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0015), 0.7, 6); this.interact(); }, { passive: false });
      cv.addEventListener("dblclick", () => this.app.toggleMax(this.key));
    }
    /* пока вращают — рисуем в половинном разрешении, потом доводим */
    interact() {
      this.moving = true; this.app.request(this.key);
      clearTimeout(this.idleT); this.idleT = setTimeout(() => { this.moving = false; this.app.request(this.key); }, 160);
    }
    reset() { this.az = 0.55; this.el_ = 0.32; this.dist = 2.6; this.target = [0, 0, 0]; this.dirty = true; }
    exportCanvas() {
      this.moving = false; this.render();
      const c = document.createElement("canvas"); c.width = this.canvas.width; c.height = this.canvas.height;
      const x = c.getContext("2d"); x.drawImage(this.canvas, 0, 0); x.drawImage(this.over, 0, 0, c.width, c.height);
      return c;
    }
    dispose() { if (this.gl) { const x = this.gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); } }
  }

  CT.View3D = View3D;
  CT.VIEWS3D = VIEWS;
})();
