/* ═══════════ Просмотр снимков: срезы, панорама, сечения, 2D ═══════════
   Все окна-изображения и измерения. Координаты:
   • срезы (mpr) — мир в миллиметрах: точка вокселя (i, j, k) = (i·sx, j·sy, k·sz),
     оси как в DICOM: x — влево от пациента, y — назад, z — вверх;
   • панорама — [s, z]: s — мм вдоль дуги челюсти (от правой стороны
     пациента к левой), z — высота;
   • сечение — [s, смещение, z]: смещение вдоль нормали к дуге, «+» —
     к щеке/губе (вестибулярно);
   • 2D-снимок — пиксели изображения [x, y]. */
(function () {
  "use strict";
  const CT = window.ChestomCT;
  const { V, PLANE } = CT;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const FONT = "'Open Sans', system-ui, sans-serif";
  const fmt1 = v => v.toFixed(1).replace(".", ",");
  const SENT = -32768;

  /* ═══════════════ Плоскости ═══════════════ */
  const CANON = {
    axial:    { n: [0, 0, 1], r: [1, 0, 0], d: [0, 1, 0] },
    coronal:  { n: [0, 1, 0], r: [1, 0, 0], d: [0, 0, -1] },
    sagittal: { n: [1, 0, 0], r: [0, 1, 0], d: [0, 0, -1] },
  };
  const MPR = ["axial", "coronal", "sagittal"];
  const copyBases = b => { const o = {}; for (const k of MPR) o[k] = { n: b[k].n.slice(), r: b[k].r.slice(), d: b[k].d.slice() }; return o; };
  const isAligned = (key, b) => { const c = CANON[key]; return V.dot(b.r, c.r) > 0.99999 && V.dot(b.d, c.d) > 0.99999; };
  /* буквы сторон пациента по направлению в мире */
  function letters(v) {
    const L = [["L", "R"], ["P", "A"], ["S", "I"]], a = v.map(Math.abs), order = [0, 1, 2].sort((i, j) => a[j] - a[i]);
    let s = L[order[0]][v[order[0]] > 0 ? 0 : 1];
    if (a[order[1]] > 0.38) s += L[order[1]][v[order[1]] > 0 ? 0 : 1];
    return s;
  }

  /* ═══════════════ Выборка плоскости ═══════════════
     o — мир (мм) центра пикселя (0,0); du, dv — шаг по пикселю; dn — шаг
     по толщине; half — число шагов толщины в каждую сторону. */
  function samplePlane(vol, o, du, dv, dn, w, h, half, mode, tri, out) {
    const { nx, ny, nz, data } = vol, P = nx * ny;
    const ix = 1 / vol.sx, iy = 1 / vol.sy, iz = 1 / vol.sz;
    const oi = o[0] * ix, oj = o[1] * iy, ok = o[2] * iz;
    const ui = du[0] * ix, uj = du[1] * iy, uk = du[2] * iz;
    const vi = dv[0] * ix, vj = dv[1] * iy, vk = dv[2] * iz;
    const ni = dn[0] * ix, nj = dn[1] * iy, nk = dn[2] * iz;
    const X = nx - 0.5, Y = ny - 0.5, Z = nz - 0.5, mx = nx - 1, my = ny - 1, mz = nz - 1;
    const avg = mode === "avg";
    let p = 0;
    for (let y = 0; y < h; y++) {
      let fi = oi + y * vi, fj = oj + y * vj, fk = ok + y * vk;
      for (let x = 0; x < w; x++, fi += ui, fj += uj, fk += uk) {
        if (!half) {
          if (fi < -0.5 || fj < -0.5 || fk < -0.5 || fi >= X || fj >= Y || fk >= Z) { out[p++] = SENT; continue; }
          if (!tri) { out[p++] = data[((fi + 0.5) | 0) + ((fj + 0.5) | 0) * nx + ((fk + 0.5) | 0) * P]; continue; }
          const ci = fi < 0 ? 0 : fi > mx ? mx : fi, cj = fj < 0 ? 0 : fj > my ? my : fj, ck = fk < 0 ? 0 : fk > mz ? mz : fk;
          const i0 = ci | 0, j0 = cj | 0, k0 = ck | 0, tx = ci - i0, ty = cj - j0, tz = ck - k0;
          const di = i0 < mx ? 1 : 0, dj = j0 < my ? nx : 0, dk = k0 < mz ? P : 0;
          const b = i0 + j0 * nx + k0 * P;
          const c00 = data[b] + (data[b + di] - data[b]) * tx, c10 = data[b + dj] + (data[b + dj + di] - data[b + dj]) * tx;
          const c01 = data[b + dk] + (data[b + dk + di] - data[b + dk]) * tx, c11 = data[b + dk + dj] + (data[b + dk + dj + di] - data[b + dk + dj]) * tx;
          const c0 = c00 + (c10 - c00) * ty, c1 = c01 + (c11 - c01) * ty;
          out[p++] = c0 + (c1 - c0) * tz;
          continue;
        }
        let acc = avg ? 0 : SENT, n = 0;
        for (let m = -half; m <= half; m++) {
          const gi = fi + m * ni, gj = fj + m * nj, gk = fk + m * nk;
          if (gi < -0.5 || gj < -0.5 || gk < -0.5 || gi >= X || gj >= Y || gk >= Z) continue;
          const v = data[((gi + 0.5) | 0) + ((gj + 0.5) | 0) * nx + ((gk + 0.5) | 0) * P];
          if (avg) acc += v; else if (v > acc) acc = v;
          n++;
        }
        out[p++] = n ? (avg ? acc / n : acc) : SENT;
      }
    }
    return out;
  }

  /* HU → серый через общую таблицу; вне объёма — прозрачно */
  function paint(buf, lut, imgData) {
    const px = imgData.data;
    for (let i = 0, q = 0; i < buf.length; i++, q += 4) {
      const v = buf[i];
      if (v === SENT) { px[q + 3] = 0; continue; }
      const c = lut[(v + 32768) | 0]; px[q] = px[q + 1] = px[q + 2] = c; px[q + 3] = 255;
    }
  }

  /* ═══════════════ Дуга челюсти ═══════════════ */
  /* центростремительный сплайн Катмулла—Рома через опорные точки */
  function spline(pts, per) {
    if (pts.length < 2) return pts.slice();
    const P = [pts[0], ...pts, pts[pts.length - 1]], out = [];
    const td = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, 0.5);
    for (let i = 1; i < P.length - 2; i++) {
      const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      const t0 = 0, t1 = t0 + td(p0, p1), t2 = t1 + td(p1, p2), t3 = t2 + td(p2, p3);
      for (let k = 0; k < per; k++) {
        const t = t1 + (t2 - t1) * k / per, pt = [];
        for (let c = 0; c < 2; c++) {
          const A1 = (t1 - t) / (t1 - t0) * p0[c] + (t - t0) / (t1 - t0) * p1[c];
          const A2 = (t2 - t) / (t2 - t1) * p1[c] + (t - t1) / (t2 - t1) * p2[c];
          const A3 = (t3 - t) / (t3 - t2) * p2[c] + (t - t2) / (t3 - t2) * p3[c];
          const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
          const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
          pt.push((t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2);
        }
        out.push(pt);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }
  /* дуга с равным шагом по длине: точки, касательные и нормали наружу */
  function archGeom(pts, step) {
    const dense = spline(pts, 40), cum = [0];
    for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
    const L = cum[cum.length - 1], n = Math.max(2, Math.round(L / step) + 1);
    const x = new Float64Array(n), y = new Float64Array(n);
    let j = 0;
    for (let k = 0; k < n; k++) {
      const s = L * k / (n - 1);
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const t = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
      x[k] = dense[j][0] + (dense[j + 1][0] - dense[j][0]) * t; y[k] = dense[j][1] + (dense[j + 1][1] - dense[j][1]) * t;
    }
    const mx = new Float64Array(n), my = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - 2), b = Math.min(n - 1, k + 2);
      let tx = x[b] - x[a], ty = y[b] - y[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      mx[k] = ty; my[k] = -tx;
    }
    /* нормаль наружу: в середине дуги она смотрит вперёд (к меньшим y) */
    const mid = n >> 1;
    if (my[mid] > 0) for (let k = 0; k < n; k++) { mx[k] = -mx[k]; my[k] = -my[k]; }
    const at = s => {
      const f = clamp(s / L, 0, 1) * (n - 1), i = Math.min(n - 2, f | 0), t = f - i;
      const nxv = mx[i] + (mx[i + 1] - mx[i]) * t, nyv = my[i] + (my[i + 1] - my[i]) * t, l = Math.hypot(nxv, nyv) || 1;
      return { x: x[i] + (x[i + 1] - x[i]) * t, y: y[i] + (y[i + 1] - y[i]) * t, mx: nxv / l, my: nyv / l };
    };
    return { L, n, x, y, mx, my, step: L / (n - 1), at };
  }
  /* Автопоиск дуги на уровне zc: максимум по слою ±4 мм, порог кости,
     самая большая связная область; лучи из точки за дугой — на каждом
     берём наружную полосу кости (у верхней челюсти внутри есть нёбо). */
  function autoArch(vol, zc) {
    const f = Math.max(1, Math.round(0.8 / vol.sx)), gx = Math.floor(vol.nx / f), gy = Math.floor(vol.ny / f);
    const k0 = clamp(Math.round((zc - 4) / vol.sz), 0, vol.nz - 1), k1 = clamp(Math.round((zc + 4) / vol.sz), 0, vol.nz - 1);
    const M = new Int16Array(gx * gy).fill(SENT), P = vol.nx * vol.ny, d = vol.data;
    for (let k = k0; k <= k1; k++) for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const v = d[i * f + j * f * vol.nx + k * P], q = i + j * gx; if (v > M[q]) M[q] = v;
    }
    const thr = vol.otsu, mask = new Uint8Array(gx * gy);
    for (let q = 0; q < mask.length; q++) mask[q] = M[q] > thr ? 1 : 0;
    /* самая большая связная область */
    const lab = new Int32Array(gx * gy), stack = [];
    let best = 0, bestId = 0, id = 0;
    for (let q = 0; q < mask.length; q++) {
      if (!mask[q] || lab[q]) continue;
      id++; let size = 0; stack.push(q); lab[q] = id;
      while (stack.length) {
        const c = stack.pop(); size++;
        const cx = c % gx, cy = (c / gx) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= gx || yy >= gy) continue;
          const nq = xx + yy * gx; if (mask[nq] && !lab[nq]) { lab[nq] = id; stack.push(nq); }
        }
      }
      if (size > best) { best = size; bestId = id; }
    }
    if (best < 40) return null;
    let minx = gx, maxx = 0, miny = gy, maxy = 0, sx = 0, cnt = 0;
    for (let q = 0; q < lab.length; q++) if (lab[q] === bestId) {
      const x = q % gx, y = (q / gx) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; sx += x; cnt++;
    }
    const ox = sx / cnt, oy = maxy + (maxy - miny) * 0.04, pts = [];
    for (let a = 186; a <= 354; a += 2) {
      const r = a * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r);
      let runStart = -1, lastMid = -1;
      for (let t = 0; t < gx + gy; t += 0.5) {
        const x = Math.round(ox + dx * t), y = Math.round(oy + dy * t);
        if (x < 0 || y < 0 || x >= gx || y >= gy) break;
        const on = lab[x + y * gx] === bestId;
        if (on && runStart < 0) runStart = t;
        if (!on && runStart >= 0) { lastMid = (runStart + t) / 2; runStart = -1; }
      }
      if (runStart >= 0) lastMid = runStart;
      if (lastMid >= 0) pts.push([(ox + dx * lastMid) * f * vol.sx, (oy + dy * lastMid) * f * vol.sy]);
    }
    if (pts.length < 12) return null;
    const sm = pts.map((p, i) => {
      let x = 0, y = 0, c = 0;
      for (let k = Math.max(0, i - 3); k <= Math.min(pts.length - 1, i + 3); k++) { x += pts[k][0]; y += pts[k][1]; c++; }
      return [x / c, y / c];
    });
    const out = [];
    for (let k = 0; k < 9; k++) out.push(sm[Math.round(k * (sm.length - 1) / 8)]);
    return out;
  }

  /* ═══════════════ Измерения и пометки ═══════════════ */
  const ANN_COLOR = { ruler: "#ffd166", angle: "#7ee0a1", arrow: "#ff5a5f", text: "#ffffff", canal: "#ff8a3d", calib: "#5ec8ff" };
  function annValue(view, a) {
    if (a.type === "ruler" || a.type === "calib") {
      const mm = view.mm(a.pts[0], a.pts[1]);
      return mm == null ? Math.round(view.pxLen(a.pts[0], a.pts[1])) + " пикс" : fmt1(mm) + " мм";
    }
    if (a.type === "angle") return fmt1(view.angle(a.pts[0], a.pts[1], a.pts[2])) + "°";
    if (a.type === "canal") return "канал нерва";
    if (a.type === "text") return a.text;
    return "";
  }
  function label(ctx, text, x, y, color, bg) {
    ctx.font = `600 12px ${FONT}`;
    const w = ctx.measureText(text).width;
    ctx.fillStyle = bg || "rgba(7,8,11,.8)"; roundRect(ctx, x - 6, y - 14, w + 12, 20, 6); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawAnn(ctx, view, a, sel, scale) {
    const k = scale || 1, sp = a.pts.map(p => view.toScreen(p));
    if (sp.some(p => !p)) return;
    const col = ANN_COLOR[a.type] || "#fff";
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (sel) { ctx.shadowColor = "rgba(255,255,255,.9)"; ctx.shadowBlur = 8 * k; }
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = (a.type === "arrow" || a.type === "canal" ? 3 : 1.7) * k;
    if (a.type === "ruler" || a.type === "calib") {
      ctx.beginPath(); ctx.moveTo(sp[0][0], sp[0][1]); ctx.lineTo(sp[1][0], sp[1][1]); ctx.stroke();
      for (const p of sp) { ctx.beginPath(); ctx.arc(p[0], p[1], 3.2 * k, 0, 7); ctx.fill(); }
      ctx.shadowBlur = 0;
      if (!a.draftNoLabel) {
        ctx.font = `600 ${12 * k}px ${FONT}`;
        label(ctx, (a.type === "calib" ? "Эталон · " : "") + annValue(view, a), (sp[0][0] + sp[1][0]) / 2 + 10 * k, (sp[0][1] + sp[1][1]) / 2 - 8 * k, col);
      }
    } else if (a.type === "angle") {
      if (sp.length < 2) { ctx.restore(); return; }
      ctx.beginPath(); ctx.moveTo(sp[0][0], sp[0][1]); ctx.lineTo(sp[1][0], sp[1][1]); if (sp[2]) ctx.lineTo(sp[2][0], sp[2][1]); ctx.stroke();
      for (const p of sp) { ctx.beginPath(); ctx.arc(p[0], p[1], 3 * k, 0, 7); ctx.fill(); }
      if (sp[2]) {
        const a1 = Math.atan2(sp[0][1] - sp[1][1], sp[0][0] - sp[1][0]), a2 = Math.atan2(sp[2][1] - sp[1][1], sp[2][0] - sp[1][0]);
        let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        ctx.beginPath(); ctx.arc(sp[1][0], sp[1][1], 22 * k, a1, a1 + da, da < 0); ctx.stroke();
        ctx.shadowBlur = 0;
        const am = a1 + da / 2;
        label(ctx, annValue(view, a), sp[1][0] + Math.cos(am) * 34 * k - 14, sp[1][1] + Math.sin(am) * 34 * k + 4, col);
      }
    } else if (a.type === "arrow") {
      const [t, hd] = sp, ang = Math.atan2(hd[1] - t[1], hd[0] - t[0]), L = 16 * k;
      ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(hd[0] - Math.cos(ang) * L * 0.6, hd[1] - Math.sin(ang) * L * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hd[0], hd[1]);
      ctx.lineTo(hd[0] - Math.cos(ang - 0.42) * L, hd[1] - Math.sin(ang - 0.42) * L);
      ctx.lineTo(hd[0] - Math.cos(ang + 0.42) * L, hd[1] - Math.sin(ang + 0.42) * L); ctx.closePath(); ctx.fill();
      if (a.text) { ctx.shadowBlur = 0; label(ctx, a.text, t[0] + 8 * k, t[1] - 8 * k, "#fff", "rgba(255,90,95,.92)"); }
    } else if (a.type === "text") {
      ctx.shadowBlur = 0; ctx.font = `600 ${13 * k}px ${FONT}`;
      const w = ctx.measureText(a.text).width;
      ctx.fillStyle = "rgba(7,8,11,.82)"; roundRect(ctx, sp[0][0] - 8 * k, sp[0][1] - 17 * k, w + 16 * k, 24 * k, 7 * k); ctx.fill();
      if (sel) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.fillStyle = "#fff"; ctx.fillText(a.text, sp[0][0], sp[0][1]);
    } else if (a.type === "canal") {
      ctx.beginPath(); sp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.lineWidth = 9 * k; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (sp.length) label(ctx, "Канал", sp[0][0] + 8, sp[0][1] - 10, col);
    }
    ctx.restore();
  }

  /* ═══════════════ Базовое окно ═══════════════ */
  class BaseView {
    constructor(app, key, el) {
      this.app = app; this.key = key; this.el = el;
      this.canvas = h("canvas", "ct-canvas"); el.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      this.img = document.createElement("canvas"); this.ictx = this.img.getContext("2d");
      this.zoom = 1; this.pan = [0, 0]; this.dirty = true; this.draft = null;
      this.bind();
    }
    get S() { return this.app.s; }
    resize() {
      const r = this.el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cw = Math.max(10, r.width); this.ch = Math.max(10, r.height); this.dpr = dpr;
      this.canvas.width = Math.round(this.cw * dpr); this.canvas.height = Math.round(this.ch * dpr);
      this.dirty = true;
    }
    /* экран ↔ «экранные мм» (u, v) окна */
    sc() { return this.fit() * this.zoom; }
    uv2s(u, v) { const s = this.sc(); return [this.cw / 2 + this.pan[0] + u * s, this.ch / 2 + this.pan[1] + v * s]; }
    s2uv(x, y) { const s = this.sc(); return [(x - this.cw / 2 - this.pan[0]) / s, (y - this.ch / 2 - this.pan[1]) / s]; }
    visUV() { const a = this.s2uv(0, 0), b = this.s2uv(this.cw, this.ch); return [a[0], a[1], b[0], b[1]]; }
    /* нарисовать буфер HU как картинку в прямоугольнике (u0,v0)-(u1,v1) */
    blit(buf, w, hgt, u0, v0, u1, v1) {
      if (this.img.width !== w || this.img.height !== hgt) { this.img.width = w; this.img.height = hgt; this.imgData = null; }
      if (!this.imgData) this.imgData = this.ictx.createImageData(w, hgt);
      paint(buf, this.app.lut, this.imgData);
      this.ictx.putImageData(this.imgData, 0, 0);
      const a = this.uv2s(u0, v0), b = this.uv2s(u1, v1);
      this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = "high";
      this.ctx.drawImage(this.img, a[0], a[1], b[0] - a[0], b[1] - a[1]);
    }
    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = "#07080b"; ctx.fillRect(0, 0, this.cw, this.ch);
      this.drawContent();
      this.drawOverlay();
      for (const a of this.S.anns) if (this.accepts(a)) drawAnn(ctx, this, a, a.id === this.S.sel);
      if (this.draft) drawAnn(ctx, this, this.draft, false);
      this.drawHud();
      this.dirty = false;
    }
    scaleBar(mmLen, unit) {
      const ctx = this.ctx, s = this.sc() * (this.unitScale || 1);
      let L = mmLen || 10;
      while (L * s > this.cw * 0.28 && L > 1) L /= 2;
      while (L * s < 40) L *= 2;
      const bar = L * s, bx = this.cw - 16 - bar, by = this.ch - 22;
      ctx.strokeStyle = "rgba(230,230,240,.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bar, by); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4); ctx.moveTo(bx + bar, by - 4); ctx.lineTo(bx + bar, by + 4); ctx.stroke();
      ctx.fillStyle = "rgba(230,230,240,.8)"; ctx.font = `600 11px ${FONT}`;
      ctx.textAlign = "center"; ctx.fillText((L % 1 ? fmt1(L) : L) + " " + (unit || "мм"), bx + bar / 2, by - 8); ctx.textAlign = "left";
    }
    hud(lines) {
      const ctx = this.ctx;
      ctx.fillStyle = "rgba(210,210,225,.74)"; ctx.font = `500 11px ${FONT}`;
      lines.filter(Boolean).forEach((t, i, arr) => ctx.fillText(t, 10, this.ch - 12 - (arr.length - 1 - i) * 15));
    }
    /* по умолчанию: без спец-ручек */
    hitSpecial() { return null; }
    onWheel(dy, e) { void dy; void e; }
    onCenter() {}
    hoverInfo() { return ""; }
    pxLen(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
    bind() {
      const cv = this.canvas, pts = new Map();
      let drag = null, pinch = null;
      const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener("contextmenu", e => e.preventDefault());
      cv.addEventListener("pointerdown", e => {
        cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, pos(e));
        this.app.setActive(this.key);
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.zoom }; drag = null; this.draft = null; return;
        }
        const [x, y] = pos(e), S = this.S;
        let tool = e.button === 2 || e.button === 1 ? "pan" : S.tool;
        if (e.button === 0 && tool === "cross") {
          const sp = this.hitSpecial(x, y, e);
          if (sp) { drag = sp; drag.x = x; drag.y = y; this.app.interact(); return; }
        }
        if (tool === "angle" || tool === "canal" || tool === "arch") {
          this.clickTool(tool, x, y); return;
        }
        drag = { tool, x, y, pan: this.pan.slice(), level: S.level, width: S.width };
        if (tool === "cross") { this.onCenter(x, y, false); this.app.interact(); }
        else if (tool === "ruler" || tool === "arrow" || tool === "calib") {
          const p = this.fromScreen(x, y); if (!p) { drag = null; return; }
          this.draft = { type: tool, space: this.space, pts: [p, p.slice()], draftNoLabel: tool === "arrow" };
        } else if (tool === "text") {
          const p = this.fromScreen(x, y); drag = null;
          if (p) this.app.editText(this, x, y, text => text && this.app.addAnn({ type: "text", space: this.space, pts: [p], text, ...this.annExtra() }));
        }
      });
      cv.addEventListener("pointermove", e => {
        const p = pos(e);
        if (pts.has(e.pointerId)) pts.set(e.pointerId, p);
        if (pinch && pts.size === 2) {
          const [a, b] = [...pts.values()];
          this.zoom = clamp(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d, 0.3, 24); this.app.request(this.key); return;
        }
        this.hover = [p[0], p[1]];
        this.app.statusHover(this.hoverInfo(p[0], p[1]));
        if (this.draft && (this.S.tool === "angle" || this.S.tool === "canal" || this.S.tool === "arch") && !drag) {
          const q = this.fromScreen(p[0], p[1]); if (q) { this.draft.pts[this.draft.pts.length - 1] = q; this.app.request(this.key); }
          return;
        }
        if (!drag) { if (this.hoverCursor) this.hoverCursor(p[0], p[1]); return; }
        const S = this.S, dx = p[0] - drag.x, dy = p[1] - drag.y;
        if (drag.move) { drag.move(p[0], p[1], dx, dy, e); this.app.interact(); return; }
        if (drag.tool === "cross") { this.onCenter(p[0], p[1], true); this.app.interact(); }
        else if (drag.tool === "pan") { this.pan = [drag.pan[0] + dx, drag.pan[1] + dy]; this.app.request(this.key); }
        else if (drag.tool === "wl") {
          const k = this.wlStep ? this.wlStep() : (S.vol.hi - S.vol.lo) / 400;
          this.app.setWindow(drag.level - dy * k, Math.max(1, drag.width + dx * k));
        } else if (this.draft) {
          const q = this.fromScreen(p[0], p[1]); if (q) { this.draft.pts[1] = q; this.app.request(this.key); }
        }
      });
      const end = e => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (drag && drag.end) drag.end();
        if (drag && this.draft && (drag.tool === "ruler" || drag.tool === "arrow" || drag.tool === "calib")) {
          const d = this.draft, a = this.toScreen(d.pts[0]), b = this.toScreen(d.pts[1]);
          if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) > 6) {
            delete d.draftNoLabel;
            if (d.type === "calib") this.app.calibrate(this, d);
            else if (d.type === "arrow") this.app.editText(this, b[0], b[1], text => this.app.addAnn({ ...d, text: text || "", ...this.annExtra() }), "Подпись к стрелке (можно пусто)", true);
            else this.app.addAnn({ ...d, ...this.annExtra() });
          }
          this.draft = null; this.app.request(this.key);
        }
        if (drag) this.app.interact(true);
        drag = null;
      };
      cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
      cv.addEventListener("pointerleave", () => { this.hover = null; this.app.statusHover(""); });
      cv.addEventListener("wheel", e => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey || this.wheelZooms) {
          const [x, y] = pos(e), z0 = this.zoom, z1 = clamp(z0 * Math.exp(-e.deltaY * 0.0022), 0.3, 24);
          const cx = this.cw / 2 + this.pan[0], cy = this.ch / 2 + this.pan[1];
          this.pan = [this.pan[0] + (x - cx) * (1 - z1 / z0), this.pan[1] + (y - cy) * (1 - z1 / z0)];
          this.zoom = z1; this.app.request(this.key); return;
        }
        this.onWheel(e.deltaY > 0 ? 1 : -1, e);
      }, { passive: false });
      cv.addEventListener("dblclick", e => {
        if (this.draft && (this.S.tool === "canal" || this.S.tool === "arch")) { this.finishClickTool(); return; }
        if (this.S.tool === "cross" || this.S.tool === "pan") this.app.toggleMax(this.key);
        void e;
      });
    }
    annExtra() { return {}; }
    /* инструменты «по щелчкам»: угол (3 точки), канал и дуга (сколько угодно, двойной щелчок — готово) */
    clickTool(tool, x, y) {
      const q = this.fromScreen(x, y); if (!q) return;
      if (!this.draft || this.draft.type !== tool) {
        this.draft = { type: tool === "arch" ? "canal" : tool, space: this.space, pts: [q, q.slice()], arch: tool === "arch" };
        this.app.request(this.key); return;
      }
      this.draft.pts[this.draft.pts.length - 1] = q;
      if (tool === "angle" && this.draft.pts.length === 3) {
        this.app.addAnn({ type: "angle", space: this.space, pts: this.draft.pts.map(p => p.slice()), ...this.annExtra() });
        this.draft = null; this.app.request(this.key); return;
      }
      this.draft.pts.push(q.slice());
      this.app.request(this.key);
    }
    finishClickTool() {
      const d = this.draft; this.draft = null;
      if (!d) return;
      const pts = d.pts.slice(0, -1);
      /* двойной щелчок добавляет лишнюю точку в то же место — убираем дубль */
      if (pts.length > 1) { const a = pts[pts.length - 1], b = pts[pts.length - 2]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.3) pts.pop(); }
      if (d.arch) { if (pts.length >= 3) this.app.setArch(pts.map(p => [p[0], p[1]])); }
      else if (pts.length >= 2) this.app.addAnn({ type: "canal", space: this.space, pts, ...this.annExtra() });
      this.app.request(this.key);
    }
    cancelDraft() { if (this.draft) { this.draft = null; this.app.request(this.key); } }
    reset() { this.zoom = 1; this.pan = [0, 0]; this.dirty = true; }
  }

  /* ═══════════════ Срез (аксиальный / корональный / сагиттальный) ═══════════════ */
  class MprView extends BaseView {
    constructor(app, key, el) { super(app, key, el); this.space = "mpr"; this.buf = null; }
    get B() { return this.S.views[this.key]; }
    center() { return V.mul(this.S.vol.ext, 0.5); }
    /* опорная точка плоскости: центр объёма, спроецированный на плоскость */
    anchor() { const A = this.center(), n = this.B.n; return V.add(A, V.mul(n, V.dot(V.sub(this.S.p, A), n))); }
    extentAlong(v) { const E = this.S.vol.ext; return Math.abs(v[0]) * E[0] + Math.abs(v[1]) * E[1] + Math.abs(v[2]) * E[2]; }
    fit() { const b = this.B; return Math.min(this.cw / (this.extentAlong(b.r) + 1), this.ch / (this.extentAlong(b.d) + 1)) * 0.92; }
    toScreen(q) {
      if (!this.visible(q)) return null;
      const A = this.center(), b = this.B, w = V.sub(q, A);
      return this.uv2s(V.dot(w, b.r), V.dot(w, b.d));
    }
    fromScreen(x, y) { const [u, v] = this.s2uv(x, y), b = this.B, o = this.anchor(); return V.add(V.add(o, V.mul(b.r, u)), V.mul(b.d, v)); }
    visible(q) {
      const S = this.S, tol = Math.max(S.slabMode === "thin" ? 0 : S.slabMm / 2, S.vol.minSp * 1.2);
      return Math.abs(V.dot(V.sub(q, S.p), this.B.n)) <= tol;
    }
    accepts(a) { return a.space === "mpr" && a.pts.every(q => this.visible(q)); }
    mm(a, b) { return V.len(V.sub(a, b)); }
    angle(a, v, c) { const u = V.norm(V.sub(a, v)), w = V.norm(V.sub(c, v)); return Math.acos(clamp(V.dot(u, w), -1, 1)) * 180 / Math.PI; }
    drawContent() {
      const S = this.S, vol = S.vol, b = this.B, fast = this.app.fast;
      const A = this.center();
      /* что видно на экране ∩ проекция объёма */
      const [su0, sv0, su1, sv1] = this.visUV();
      let pu0 = Infinity, pu1 = -Infinity, pv0 = Infinity, pv1 = -Infinity;
      const E = vol.ext, hs = [vol.sx / 2, vol.sy / 2, vol.sz / 2];
      for (let c = 0; c < 8; c++) {
        const q = [c & 1 ? E[0] + hs[0] : -hs[0], c & 2 ? E[1] + hs[1] : -hs[1], c & 4 ? E[2] + hs[2] : -hs[2]];
        const u = V.dot(V.sub(q, A), b.r), v = V.dot(V.sub(q, A), b.d);
        pu0 = Math.min(pu0, u); pu1 = Math.max(pu1, u); pv0 = Math.min(pv0, v); pv1 = Math.max(pv1, v);
      }
      const u0 = Math.max(su0, pu0), u1 = Math.min(su1, pu1), v0 = Math.max(sv0, pv0), v1 = Math.min(sv1, pv1);
      if (u1 <= u0 || v1 <= v0) return;
      let pix = Math.max(1 / (this.sc() * this.dpr), vol.minSp * 0.5);
      const maxPx = fast ? 2.5e5 : 1.4e6;
      while (((u1 - u0) / pix) * ((v1 - v0) / pix) > maxPx) pix *= 1.25;
      const w = Math.max(1, Math.ceil((u1 - u0) / pix)), hh = Math.max(1, Math.ceil((v1 - v0) / pix));
      if (!this.buf || this.buf.length < w * hh) this.buf = new Float32Array(w * hh);
      const buf = this.buf.length === w * hh ? this.buf : this.buf.subarray(0, w * hh);
      const O = this.anchor(), o = V.add(V.add(O, V.mul(b.r, u0 + pix / 2)), V.mul(b.d, v0 + pix / 2));
      const slab = S.slabMode !== "thin";
      let half = 0, dn = [0, 0, 0];
      if (slab) {
        let st = vol.minSp * (fast ? 2 : 1);
        half = Math.max(1, Math.round(S.slabMm / 2 / st));
        if (half * w * hh > (fast ? 4e6 : 2.5e7)) { half = Math.max(1, Math.floor((fast ? 4e6 : 2.5e7) / (w * hh))); st = S.slabMm / 2 / half; }
        dn = V.mul(b.n, st);
      }
      samplePlane(vol, o, V.mul(b.r, pix), V.mul(b.d, pix), dn, w, hh, half, S.slabMode, !fast && !slab, buf);
      this.blit(buf, w, hh, u0, v0, u0 + w * pix, v0 + hh * pix);
    }
    /* линии других плоскостей: направление — пересечение плоскостей */
    lines() {
      const S = this.S, b = this.B, c = this.toScreenAny(S.p), out = [];
      for (const o of MPR) {
        if (o === this.key) continue;
        const dir = V.norm(V.cross(b.n, S.views[o].n));
        let sx = V.dot(dir, b.r), sy = V.dot(dir, b.d); const l = Math.hypot(sx, sy) || 1; sx /= l; sy /= l;
        const nO = S.views[o].n, nx = V.dot(nO, b.r), ny = V.dot(nO, b.d);
        out.push({ key: o, c, dx: sx, dy: sy, nx, ny });
      }
      return out;
    }
    toScreenAny(q) { const A = this.center(), b = this.B, w = V.sub(q, A); return this.uv2s(V.dot(w, b.r), V.dot(w, b.d)); }
    handleLen() { return Math.min(this.cw, this.ch) * 0.36; }
    drawOverlay() {
      const ctx = this.ctx, S = this.S, gap = 16, L = Math.hypot(this.cw, this.ch), hl = this.handleLen();
      if (this.app.showArch && S.archG && this.key === "axial") this.drawArch();
      for (const ln of this.lines()) {
        const [cx, cy] = ln.c;
        ctx.strokeStyle = PLANE[ln.key]; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(cx - ln.dx * L, cy - ln.dy * L); ctx.lineTo(cx - ln.dx * gap, cy - ln.dy * gap);
        ctx.moveTo(cx + ln.dx * gap, cy + ln.dy * gap); ctx.lineTo(cx + ln.dx * L, cy + ln.dy * L);
        ctx.stroke(); ctx.globalAlpha = 1;
        if (S.tool === "cross") {
          /* ручки поворота на концах линии */
          const hot = this.hotHandle && this.hotHandle.key === ln.key;
          for (const sgn of [-1, 1]) {
            const hx = cx + ln.dx * hl * sgn, hy = cy + ln.dy * hl * sgn;
            ctx.beginPath(); ctx.arc(hx, hy, hot ? 6.5 : 5, 0, 7);
            ctx.fillStyle = hot ? PLANE[ln.key] : "#07080b"; ctx.fill();
            ctx.strokeStyle = PLANE[ln.key]; ctx.lineWidth = 2; ctx.stroke();
          }
        }
      }
      const c = this.toScreenAny(S.p);
      ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(c[0], c[1], 3.4, 0, 7); ctx.stroke();
      /* стороны пациента */
      const b = this.B, O = [letters(V.mul(b.d, -1)), letters(b.d), letters(V.mul(b.r, -1)), letters(b.r)];
      ctx.fillStyle = "rgba(230,230,240,.72)"; ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = "center"; ctx.fillText(O[0], this.cw / 2, 18); ctx.fillText(O[1], this.cw / 2, this.ch - 8);
      ctx.textAlign = "left"; ctx.fillText(O[2], 8, this.ch / 2 + 4);
      ctx.textAlign = "right"; ctx.fillText(O[3], this.cw - 8, this.ch / 2 + 4); ctx.textAlign = "left";
    }
    drawArch() {
      const ctx = this.ctx, S = this.S, G = S.archG, z = S.p[2];
      const scr = (x, y) => this.toScreenAny([x, y, z]);
      /* полоса панорамы */
      const half = S.pano.thick / 2;
      ctx.save();
      ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(139,124,246,.55)"; ctx.lineWidth = 1;
      for (const sg of [-1, 1]) {
        ctx.beginPath();
        for (let k = 0; k < G.n; k += 3) { const p = scr(G.x[k] + G.mx[k] * half * sg, G.y[k] + G.my[k] * half * sg); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = "#b8b2ff"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < G.n; k += 2) { const p = scr(G.x[k], G.y[k]); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
      /* метки сечений */
      for (const xs of this.app.xsList()) {
        const a = G.at(xs.s), w = S.pano.width / 2;
        const p0 = scr(a.x - a.mx * w, a.y - a.my * w), p1 = scr(a.x + a.mx * w, a.y + a.my * w);
        ctx.strokeStyle = xs.center ? "#ffd166" : "rgba(255,209,102,.5)"; ctx.lineWidth = xs.center ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
      }
      /* опорные точки */
      S.arch.forEach((q, i) => {
        const p = scr(q[0], q[1]), hot = this.hotArch === i;
        ctx.beginPath(); ctx.arc(p[0], p[1], hot ? 7 : 5.5, 0, 7);
        ctx.fillStyle = hot ? "#b8b2ff" : "#1b1840"; ctx.fill(); ctx.strokeStyle = "#b8b2ff"; ctx.lineWidth = 2; ctx.stroke();
      });
      ctx.restore();
    }
    drawHud() {
      const S = this.S, b = this.B, vol = S.vol, ax = { axial: 2, coronal: 1, sagittal: 0 }[this.key];
      const sp = [vol.sx, vol.sy, vol.sz][ax], n = [vol.nx, vol.ny, vol.nz][ax];
      let first;
      if (isAligned(this.key, b)) first = `${Math.round(S.p[ax] / sp) + 1} / ${n} · ${fmt1(S.p[ax])} мм`;
      else first = `Наклон ${Math.round(Math.acos(clamp(Math.abs(V.dot(b.n, CANON[this.key].n)), 0, 1)) * 180 / Math.PI)}° · ${fmt1(V.dot(V.sub(S.p, this.center()), b.n))} мм`;
      this.hud([first, S.slabMode !== "thin" ? `${S.slabMode === "mip" ? "MIP" : "Среднее"} ${S.slabMm} мм` : "", `W ${Math.round(S.width)} · L ${Math.round(S.level)}`]);
      this.scaleBar(10);
    }
    hoverInfo(x, y) {
      const q = this.fromScreen(x, y), v = CT.valueAt(this.S.vol, q);
      return v == null ? "" : `x ${fmt1(q[0])} · y ${fmt1(q[1])} · z ${fmt1(q[2])} мм · плотность ${v}`;
    }
    onCenter(x, y) {
      const q = this.fromScreen(x, y), E = this.S.vol.ext;
      this.app.setCenter([clamp(q[0], 0, E[0]), clamp(q[1], 0, E[1]), clamp(q[2], 0, E[2])]);
    }
    onWheel(dir, e) {
      const st = this.S.vol.minSp * (isAligned(this.key, this.B) ? [this.S.vol.sx, this.S.vol.sy, this.S.vol.sz][{ axial: 2, coronal: 1, sagittal: 0 }[this.key]] / this.S.vol.minSp : 1);
      this.app.moveAlong(this.key, dir * st * (e.shiftKey ? 5 : 1));
    }
    hoverCursor(x, y) {
      const h = this.S.tool === "cross" ? this.hitSpecial(x, y, null, true) : null;
      const hk = h && h.hover;
      if ((hk && hk.key) !== (this.hotHandle && this.hotHandle.key) || (h && h.archIdx) !== this.hotArch) {
        this.hotHandle = hk; this.hotArch = h ? h.archIdx : undefined; this.app.request(this.key);
      }
      this.canvas.style.cursor = h ? h.cursor : "";
    }
    /* ручки: точки дуги, поворот линии, сдвиг линии */
    hitSpecial(x, y, e, probe) {
      const S = this.S;
      if (this.app.showArch && S.arch && this.key === "axial") {
        for (let i = 0; i < S.arch.length; i++) {
          const p = this.toScreenAny([S.arch[i][0], S.arch[i][1], S.p[2]]);
          if (Math.hypot(p[0] - x, p[1] - y) < 10) {
            if (probe) return { cursor: "grab", archIdx: i };
            return { move: (mx, my) => { const q = this.fromScreen(mx, my); S.arch[i] = [q[0], q[1]]; this.app.archChanged(true); }, end: () => this.app.archChanged(false) };
          }
        }
      }
      const hl = this.handleLen();
      for (const ln of this.lines()) {
        const [cx, cy] = ln.c;
        for (const sgn of [-1, 1]) {
          const hx = cx + ln.dx * hl * sgn, hy = cy + ln.dy * hl * sgn;
          if (Math.hypot(hx - x, hy - y) < 11) {
            if (probe) return { cursor: "grab", hover: ln };
            const snap = copyBases(S.views), a0 = Math.atan2(y - cy, x - cx), b = this.B;
            const sign = Math.sign(V.dot(V.cross(b.n, b.r), b.d)) || 1;
            return {
              move: (mx, my, dx, dy, ev) => {
                let th = Math.atan2(my - cy, mx - cx) - a0;
                if (ev && ev.shiftKey) th = Math.round(th / (Math.PI / 36)) * (Math.PI / 36);
                this.app.rotateFrom(this.key, snap, th * sign);
              },
            };
          }
        }
        /* расстояние до линии и положение вдоль неё */
        const rx = x - cx, ry = y - cy, along = rx * ln.dx + ry * ln.dy, perp = Math.abs(rx * ln.dy - ry * ln.dx);
        if (perp < 6 && Math.abs(along) > 22) {
          if (probe) return { cursor: ln.nx * ln.nx > ln.ny * ln.ny ? "ew-resize" : "ns-resize" };
          const p0 = S.p.slice(), nO = S.views[ln.key].n, s = this.sc(), nl = Math.hypot(ln.nx, ln.ny) || 1;
          return {
            move: (mx, my) => {
              const dmm = ((mx - x) * ln.nx + (my - y) * ln.ny) / nl / nl / s;
              const E = S.vol.ext, q = V.add(p0, V.mul(nO, dmm));
              this.app.setCenter([clamp(q[0], 0, E[0]), clamp(q[1], 0, E[1]), clamp(q[2], 0, E[2])]);
            },
          };
        }
      }
      return null;
    }
  }

  /* ═══════════════ Панорама (ОПТГ из КЛКТ) ═══════════════ */
  class PanoView extends BaseView {
    constructor(app, key, el) { super(app, key, el); this.space = "pano"; this.cache = null; }
    L() { return this.S.archG ? this.S.archG.L : 100; }
    Z() { return this.S.vol.ext[2]; }
    fit() { return Math.min(this.cw / (this.L() + 2), this.ch / (this.Z() + 2)) * 0.95; }
    toScreen(p) { return this.uv2s(p[0] - this.L() / 2, this.Z() / 2 - p[1]); }
    fromScreen(x, y) { const [u, v] = this.s2uv(x, y); return [u + this.L() / 2, this.Z() / 2 - v]; }
    accepts(a) { return a.space === "pano"; }
    mm(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
    angle(a, v, c) { const u = [a[0] - v[0], a[1] - v[1]], w = [c[0] - v[0], c[1] - v[1]]; return Math.acos(clamp((u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w) || 1), -1, 1)) * 180 / Math.PI; }
    invalidate() { this.cache = null; this.dirty = true; }
    build() {
      const S = this.S, G = S.archG, vol = S.vol, fast = this.app.fast;
      const ps = Math.max(vol.minSp, G.L / 1400) * (fast ? 2.2 : 1), pz = Math.max(vol.sz, this.Z() / 800) * (fast ? 2.2 : 1);
      const w = Math.max(2, Math.floor(G.L / ps)), hh = Math.max(2, Math.floor(this.Z() / pz));
      const buf = new Float32Array(w * hh), st = vol.minSp * (fast ? 2.5 : 1.2), half = Math.max(1, Math.round(S.pano.thick / 2 / st));
      const col = new Float32Array(hh);
      for (let c = 0; c < w; c++) {
        const a = G.at((c + 0.5) * ps);
        /* столбец панорамы = сечение толщиной thick по нормали к дуге: одна «плоскость» шириной 1 пиксель */
        samplePlane(vol, [a.x, a.y, this.Z() - pz / 2], [0, 0, 0], [0, 0, -pz], [a.mx * st, a.my * st, 0], 1, hh, half, S.pano.mode, false, col);
        for (let r = 0; r < hh; r++) buf[r * w + c] = col[r];
      }
      this.cache = { buf, w, h: hh, ps, pz, fast, key: this.cacheKey() };
    }
    cacheKey() { const S = this.S; return JSON.stringify([S.arch, S.pano.thick, S.pano.mode]); }
    drawContent() {
      const S = this.S;
      if (!S.archG) {
        const ctx = this.ctx; ctx.fillStyle = "rgba(210,210,225,.75)"; ctx.font = `500 13px ${FONT}`; ctx.textAlign = "center";
        ctx.fillText("Нет дуги челюсти — нажмите «Найти дугу» или нарисуйте её на аксиальном срезе", this.cw / 2, this.ch / 2);
        ctx.textAlign = "left"; return;
      }
      if (!this.cache || this.cache.key !== this.cacheKey() || (this.cache.fast && !this.app.fast)) this.build();
      const c = this.cache;
      this.blit(c.buf, c.w, c.h, -this.L() / 2, -this.Z() / 2, -this.L() / 2 + c.w * c.ps, -this.Z() / 2 + c.h * c.pz);
    }
    drawOverlay() {
      const S = this.S, ctx = this.ctx; if (!S.archG) return;
      /* уровень перекрестия */
      const yz = this.toScreen([0, S.p[2]])[1];
      ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(139,124,246,.7)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, yz); ctx.lineTo(this.cw, yz); ctx.stroke(); ctx.setLineDash([]);
      /* сечения */
      for (const xs of this.app.xsList()) {
        const x = this.toScreen([xs.s, 0])[0];
        ctx.strokeStyle = xs.center ? "#ffd166" : "rgba(255,209,102,.45)"; ctx.lineWidth = xs.center ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(x, 26); ctx.lineTo(x, this.ch - 30); ctx.stroke();
        if (xs.center) label(ctx, fmt1(xs.s) + " мм", x + 8, 42, "#ffd166");
      }
      ctx.fillStyle = "rgba(230,230,240,.72)"; ctx.font = `700 12px ${FONT}`;
      ctx.fillText("R", 10, this.ch / 2); ctx.textAlign = "right"; ctx.fillText("L", this.cw - 10, this.ch / 2); ctx.textAlign = "left";
    }
    drawHud() {
      const S = this.S; if (!S.archG) return;
      this.hud([`Дуга ${fmt1(S.archG.L)} мм · толщина ${S.pano.thick} мм · ${S.pano.mode === "mip" ? "MIP" : "среднее"}`, `W ${Math.round(S.width)} · L ${Math.round(S.level)}`]);
      this.scaleBar(10);
    }
    hoverInfo(x, y) { const p = this.fromScreen(x, y); if (!this.S.archG || p[0] < 0 || p[0] > this.L()) return ""; return `по дуге ${fmt1(p[0])} мм · высота ${fmt1(p[1])} мм`; }
    onCenter(x, y) {
      const S = this.S; if (!S.archG) return;
      const p = this.fromScreen(x, y), s = clamp(p[0], 0, this.L()), a = S.archG.at(s);
      S.pano.s0 = s;
      this.app.setCenter([a.x, a.y, clamp(p[1], 0, this.Z())]);
    }
    onWheel(dir, e) { this.app.stepXs(dir * (e.shiftKey ? 5 : 1)); }
  }

  /* ═══════════════ Поперечное сечение дуги ═══════════════ */
  class XsView extends BaseView {
    constructor(app, key, el, idx) { super(app, key, el); this.space = "xs"; this.idx = idx; }
    info() { return this.app.xsList()[this.idx]; }
    Z() { return this.S.vol.ext[2]; }
    W() { return this.S.pano.width; }
    fit() { return Math.min(this.cw / (this.W() + 1), this.ch / (this.Z() + 1)) * 0.96; }
    toScreen(p) { const i = this.info(); if (!i || (p.length === 3 && Math.abs(p[0] - i.s) > this.S.pano.spacing * 0.45)) return null; const off = p.length === 3 ? p[1] : p[0], z = p.length === 3 ? p[2] : p[1]; return this.uv2s(off, this.Z() / 2 - z); }
    fromScreen(x, y) { const i = this.info(); if (!i) return null; const [u, v] = this.s2uv(x, y); return [i.s, u, this.Z() / 2 - v]; }
    accepts(a) { return a.space === "xs"; }
    mm(a, b) { return Math.hypot(a[1] - b[1], a[2] - b[2]); }
    pxLen(a, b) { return this.mm(a, b); }
    angle(a, v, c) { const u = [a[1] - v[1], a[2] - v[2]], w = [c[1] - v[1], c[2] - v[2]]; return Math.acos(clamp((u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w) || 1), -1, 1)) * 180 / Math.PI; }
    world(off, z) { const a = this.S.archG.at(this.info().s); return [a.x + a.mx * off, a.y + a.my * off, z]; }
    drawContent() {
      const S = this.S, i = this.info(); if (!S.archG || !i) return;
      const vol = S.vol, a = S.archG.at(i.s), fast = this.app.fast;
      const [su0, sv0, su1, sv1] = this.visUV();
      const W = this.W(), Z = this.Z();
      const u0 = Math.max(su0, -W / 2), u1 = Math.min(su1, W / 2), v0 = Math.max(sv0, -Z / 2), v1 = Math.min(sv1, Z / 2);
      if (u1 <= u0 || v1 <= v0) return;
      let pix = Math.max(1 / (this.sc() * this.dpr), vol.minSp * 0.5);
      while (((u1 - u0) / pix) * ((v1 - v0) / pix) > (fast ? 1.2e5 : 5e5)) pix *= 1.25;
      const w = Math.ceil((u1 - u0) / pix), hh = Math.ceil((v1 - v0) / pix), buf = new Float32Array(w * hh);
      const m = [a.mx, a.my, 0], o = [a.x + a.mx * (u0 + pix / 2), a.y + a.my * (u0 + pix / 2), Z / 2 - (v0 + pix / 2)];
      samplePlane(vol, o, V.mul(m, pix), [0, 0, -pix], [0, 0, 0], w, hh, 0, "thin", !fast, buf);
      this.blit(buf, w, hh, u0, v0, u0 + w * pix, v0 + hh * pix);
    }
    drawOverlay() {
      const S = this.S, ctx = this.ctx, i = this.info(); if (!S.archG || !i) return;
      const c = this.uv2s(0, 0);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(184,178,255,.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(c[0], 0); ctx.lineTo(c[0], this.ch); ctx.stroke();
      const yz = this.uv2s(0, this.Z() / 2 - S.p[2])[1];
      ctx.strokeStyle = "rgba(139,124,246,.7)"; ctx.beginPath(); ctx.moveTo(0, yz); ctx.lineTo(this.cw, yz); ctx.stroke(); ctx.setLineDash([]);
      /* канал нерва, отмеченный на панораме: полоса на его высоте */
      for (const an of S.anns) {
        if (an.type !== "canal" || an.space !== "pano") continue;
        const z = canalZ(an.pts, i.s); if (z == null) continue;
        const y = this.uv2s(0, this.Z() / 2 - z)[1];
        ctx.fillStyle = "rgba(255,138,61,.16)"; ctx.fillRect(0, y - 4, this.cw, 8);
        ctx.strokeStyle = "rgba(255,138,61,.85)"; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.cw, y); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = i.center ? "#ffd166" : "rgba(230,230,240,.85)"; ctx.font = `700 12px ${FONT}`;
      const rel = i.rel === 0 ? "0" : (i.rel > 0 ? "+" : "−") + fmt1(Math.abs(i.rel));
      ctx.fillText(rel + " мм", 8, 18);
      ctx.fillStyle = "rgba(210,210,225,.6)"; ctx.font = `600 10px ${FONT}`;
      ctx.fillText("язык", 8, this.ch / 2); ctx.textAlign = "right"; ctx.fillText("щека", this.cw - 8, this.ch / 2); ctx.textAlign = "left";
      if (i.center) { ctx.strokeStyle = "rgba(255,209,102,.6)"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, this.cw - 2, this.ch - 2); }
    }
    drawHud() { const i = this.info(); if (!i) return; this.hud([`${fmt1(i.s)} мм`]); this.scaleBar(5); }
    hoverInfo(x, y) {
      const p = this.fromScreen(x, y); if (!p || !this.S.archG) return "";
      const v = CT.valueAt(this.S.vol, this.world(p[1], p[2]));
      return v == null ? "" : `смещение ${fmt1(p[1])} мм · высота ${fmt1(p[2])} мм · плотность ${v}`;
    }
    onCenter(x, y) {
      const p = this.fromScreen(x, y); if (!p) return;
      this.S.pano.s0 = this.info().s;
      const E = this.S.vol.ext, q = this.world(p[1], p[2]);
      this.app.setCenter([clamp(q[0], 0, E[0]), clamp(q[1], 0, E[1]), clamp(q[2], 0, E[2])]);
    }
    onWheel(dir, e) { this.app.stepXs(dir * (e.shiftKey ? 5 : 1)); }
    annExtra() { return {}; }
  }
  /* высота канала в точке s: линейно по отмеченным точкам */
  function canalZ(pts, s) {
    const P = pts.slice().sort((a, b) => a[0] - b[0]);
    if (!P.length || s < P[0][0] || s > P[P.length - 1][0]) return null;
    for (let k = 0; k < P.length - 1; k++) if (s >= P[k][0] && s <= P[k + 1][0]) {
      const t = (s - P[k][0]) / ((P[k + 1][0] - P[k][0]) || 1); return P[k][1] + (P[k + 1][1] - P[k][1]) * t;
    }
    return null;
  }

  /* ═══════════════ 2D-снимок ═══════════════ */
  class PhotoView extends BaseView {
    constructor(app, key, el) { super(app, key, el); this.space = "photo"; this.wheelZooms = true; this.cacheKey = null; }
    get ph() { return this.S.photo.list[this.S.photo.idx]; }
    dims() { const p = this.ph, r = this.S.photo.rot % 180 !== 0; return r ? [p.h, p.w] : [p.w, p.h]; }
    fit() { const [w, hh] = this.dims(); return Math.min(this.cw / w, this.ch / hh) * 0.96; }
    /* пиксель → «экранные» координаты с поворотом и отражением */
    fwd(px, py) {
      const p = this.ph, S = this.S.photo;
      let u = px - p.w / 2, v = py - p.h / 2;
      if (S.flip) u = -u;
      for (let k = 0; k < (S.rot / 90) % 4; k++) { const t = u; u = -v; v = t; }
      return [u, v];
    }
    inv(u, v) {
      const p = this.ph, S = this.S.photo;
      for (let k = 0; k < (S.rot / 90) % 4; k++) { const t = v; v = -u; u = t; }
      if (S.flip) u = -u;
      return [u + p.w / 2, v + p.h / 2];
    }
    toScreen(pt) { const [u, v] = this.fwd(pt[0], pt[1]); return this.uv2s(u, v); }
    fromScreen(x, y) { const [u, v] = this.s2uv(x, y); return this.inv(u, v); }
    accepts(a) { return a.space === "photo" && a.photo === this.S.photo.idx; }
    annExtra() { return { photo: this.S.photo.idx }; }
    mm(a, b) { const k = this.ph.pxMm; return k ? Math.hypot(a[0] - b[0], a[1] - b[1]) * k : null; }
    angle(a, v, c) { const u = [a[0] - v[0], a[1] - v[1]], w = [c[0] - v[0], c[1] - v[1]]; return Math.acos(clamp((u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w) || 1), -1, 1)) * 180 / Math.PI; }
    wlStep() { const p = this.ph; return p.gray ? (p.hi - p.lo) / 400 : 0.6; }
    /* картинка с яркостью/контрастом — пересобираем только при смене настроек */
    adjusted() {
      const p = this.ph, A = this.S.photo, key = [A.idx, A.bright, A.contrast, A.gamma, A.invert, this.S.level, this.S.width].join("|");
      if (this.cacheKey === key && this.adjCanvas) return this.adjCanvas;
      const c = this.adjCanvas || document.createElement("canvas");
      c.width = p.w; c.height = p.h;
      const x = c.getContext("2d"), id = x.createImageData(p.w, p.h), px = id.data;
      if (p.gray) {
        const lut = this.app.lut;
        for (let i = 0, q = 0; i < p.gray.length; i++, q += 4) { const v = lut[p.gray[i] + 32768]; px[q] = px[q + 1] = px[q + 2] = v; px[q + 3] = 255; }
      } else {
        const L = new Uint8Array(256), ctr = (100 + A.contrast) / 100, br = A.bright * 1.28, g = 1 / A.gamma;
        for (let i = 0; i < 256; i++) { let v = ((i - 128) * ctr + 128 + br) / 255; v = clamp(v, 0, 1); v = Math.pow(v, g) * 255; L[i] = A.invert ? 255 - v : v; }
        const s = p.rgba;
        for (let q = 0; q < s.length; q += 4) { px[q] = L[s[q]]; px[q + 1] = L[s[q + 1]]; px[q + 2] = L[s[q + 2]]; px[q + 3] = 255; }
      }
      x.putImageData(id, 0, 0);
      this.adjCanvas = c; this.cacheKey = key;
      return c;
    }
    drawImageTo(ctx, s, cx, cy) {
      const p = this.ph, A = this.S.photo;
      ctx.save(); ctx.translate(cx, cy);
      ctx.rotate(A.rot * Math.PI / 180);
      if (A.flip) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(this.adjusted(), -p.w / 2 * s, -p.h / 2 * s, p.w * s, p.h * s);
      ctx.restore();
    }
    drawContent() { const c = this.uv2s(0, 0); this.drawImageTo(this.ctx, this.sc(), c[0], c[1]); }
    drawOverlay() {}
    drawHud() {
      const p = this.ph;
      this.hud([`${p.w}×${p.h} пикс`, p.pxMm ? `1 пикс = ${p.pxMm.toFixed(3).replace(".", ",")} мм` : "Без калибровки — линейка в пикселях"]);
      if (p.pxMm) { this.unitScale = 1 / p.pxMm; this.scaleBar(10); } else { this.unitScale = 1; this.scaleBar(100, "пикс"); }
    }
    hoverInfo(x, y) {
      const q = this.fromScreen(x, y), p = this.ph;
      if (q[0] < 0 || q[1] < 0 || q[0] >= p.w || q[1] >= p.h) return "";
      const i = (q[0] | 0) + (q[1] | 0) * p.w;
      return `x ${q[0] | 0} · y ${q[1] | 0}` + (p.gray ? ` · значение ${p.gray[i]}` : "");
    }
    onCenter() {}
    /* снимок с пометками в полном разрешении — для пациента или коллеги */
    exportCanvas() {
      const p = this.ph, A = this.S.photo, rot = A.rot % 180 !== 0, W = rot ? p.h : p.w, H = rot ? p.w : p.h;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const x = c.getContext("2d");
      this.drawImageTo(x, 1, W / 2, H / 2);
      const k = Math.max(1, Math.min(W, H) / 700);
      const proxy = Object.create(this);
      proxy.toScreen = pt => { const [u, v] = this.fwd(pt[0], pt[1]); return [W / 2 + u, H / 2 + v]; };
      for (const a of this.S.anns) if (this.accepts(a)) drawAnn(x, proxy, a, false, k);
      return c;
    }
  }

  Object.assign(CT, { MprView, PanoView, XsView, PhotoView, CANON, MPR, copyBases, isAligned, archGeom, autoArch, drawAnn, annValue, ANN_COLOR, canalZ, letters });
})();
