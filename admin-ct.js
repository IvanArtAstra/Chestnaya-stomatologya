/* ═══════════ Просмотр 3D-снимков (КЛКТ / КТ, DICOM) ═══════════
   Врач открывает папку снимка — сотни файлов DICOM — и видит три среза
   (аксиальный, корональный, сагиттальный) с общим перекрестием и
   объёмную модель челюсти.

   Всё считается в браузере: файлы не уходят на сервер и нигде не
   сохраняются. Для клиники это важно — снимок относится к сведениям
   о здоровье (врачебная тайна, специальная категория по 152-ФЗ).
   Закрыли вкладку или нажали «Закрыть снимок» — данных больше нет.

   Без внешних библиотек: свой разбор DICOM (несжатые снимки — именно так
   их отдают аппараты КЛКТ) и свой рендер объёма на WebGL2. */
(function () {
  "use strict";

  /* ═══════════════ DICOM ═══════════════ */
  const TS_IMPLICIT = "1.2.840.10008.1.2";
  const TS_BIG = "1.2.840.10008.1.2.2";
  const TS_DEFLATE = "1.2.840.10008.1.2.1.99";
  const LONG_VR = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "SV", "UC", "UN", "UR", "UT", "UV"]);
  const T = (g, e) => ((g << 16) | e) >>> 0;
  const PIXEL = T(0x7fe0, 0x0010);
  const WANT = {
    [T(0x0008, 0x0005)]: "charset",     [T(0x0008, 0x0020)]: "studyDate",
    [T(0x0008, 0x0060)]: "modality",    [T(0x0008, 0x0070)]: "maker",
    [T(0x0008, 0x1090)]: "model",       [T(0x0010, 0x0010)]: "patient",
    [T(0x0010, 0x0020)]: "patientId",   [T(0x0010, 0x0030)]: "birth",
    [T(0x0018, 0x0050)]: "thickness",   [T(0x0018, 0x0088)]: "between",
    [T(0x0020, 0x000e)]: "series",      [T(0x0020, 0x0013)]: "instance",
    [T(0x0020, 0x0032)]: "position",    [T(0x0020, 0x0037)]: "orientation",
    [T(0x0028, 0x0002)]: "samples",     [T(0x0028, 0x0004)]: "photometric",
    [T(0x0028, 0x0008)]: "frames",      [T(0x0028, 0x0010)]: "rows",
    [T(0x0028, 0x0011)]: "cols",        [T(0x0028, 0x0030)]: "spacing",
    [T(0x0028, 0x0100)]: "bits",        [T(0x0028, 0x0103)]: "signed",
    [T(0x0028, 0x1050)]: "wc",          [T(0x0028, 0x1051)]: "ww",
    [T(0x0028, 0x1052)]: "intercept",   [T(0x0028, 0x1053)]: "slope",
  };
  const US_TAGS = new Set([T(0x28, 0x02), T(0x28, 0x10), T(0x28, 0x11), T(0x28, 0x100), T(0x28, 0x103)]);

  function readEl(dv, off, explicit) {
    const g = dv.getUint16(off, true), e = dv.getUint16(off + 2, true), tag = T(g, e);
    if (g === 0xfffe || !explicit) {
      const len = dv.getUint32(off + 4, true);
      return { tag, len, val: off + 8, next: off + 8 + (len === 0xffffffff ? 0 : len) };
    }
    const vr = String.fromCharCode(dv.getUint8(off + 4), dv.getUint8(off + 5));
    if (LONG_VR.has(vr)) {
      const len = dv.getUint32(off + 8, true);
      return { tag, vr, len, val: off + 12, next: off + 12 + (len === 0xffffffff ? 0 : len) };
    }
    const len = dv.getUint16(off + 6, true);
    return { tag, vr, len, val: off + 8, next: off + 8 + len };
  }
  /* последовательность неопределённой длины: идём до (FFFE,E0DD) с учётом вложенности */
  function skipUndef(dv, off, explicit) {
    const n = dv.byteLength;
    while (off + 8 <= n) {
      const g = dv.getUint16(off, true), e = dv.getUint16(off + 2, true);
      if (g === 0xfffe && e === 0xe0dd) return off + 8;
      if (g === 0xfffe && e === 0xe000) {
        const len = dv.getUint32(off + 4, true);
        if (len !== 0xffffffff) { off += 8 + len; continue; }
        off += 8;
        while (off + 8 <= n) {
          const g2 = dv.getUint16(off, true), e2 = dv.getUint16(off + 2, true);
          if (g2 === 0xfffe && e2 === 0xe00d) { off += 8; break; }
          const el = readEl(dv, off, explicit);
          off = el.len === 0xffffffff ? skipUndef(dv, el.val, explicit) : el.next;
        }
        continue;
      }
      return n;
    }
    return n;
  }
  const latin = new TextDecoder("latin1");
  function str(u8, off, len, dec) { return (dec || latin).decode(u8.subarray(off, off + len)).replace(/[\0\s]+$/, "").trim(); }
  function decoderFor(charset) {
    const c = (charset || "").toUpperCase();
    try {
      if (c.includes("192")) return new TextDecoder("utf-8");
      if (c.includes("144")) return new TextDecoder("iso-8859-5");
    } catch (e) { /* noop */ }
    return latin;
  }

  class DicomError extends Error {}
  function parseDicom(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let off = 0;
    if (buf.byteLength > 132 && u8[128] === 0x44 && u8[129] === 0x49 && u8[130] === 0x43 && u8[131] === 0x4d) off = 132;
    else if (buf.byteLength < 256) throw new DicomError("not dicom");
    let ts = null;
    while (off + 8 <= buf.byteLength && dv.getUint16(off, true) === 0x0002) {
      const el = readEl(dv, off, true);
      if (el.tag === T(0x0002, 0x0010)) ts = str(u8, el.val, el.len);
      off = el.next;
    }
    if (!ts) {
      /* без заголовка: по двум буквам VR угадываем, явный ли синтаксис */
      const a = u8[off + 4], b = u8[off + 5];
      ts = a >= 65 && a <= 90 && b >= 65 && b <= 90 ? "1.2.840.10008.1.2.1" : TS_IMPLICIT;
    }
    if (ts === TS_BIG || ts === TS_DEFLATE) throw new DicomError("unsupported");
    const explicit = ts !== TS_IMPLICIT;
    const compressed = ts.startsWith("1.2.840.10008.1.2.4") || ts === "1.2.840.10008.1.2.5";
    const out = { ts };
    let dec = latin;
    while (off + 8 <= buf.byteLength) {
      const el = readEl(dv, off, explicit);
      if (el.tag === PIXEL) {
        if (compressed || el.len === 0xffffffff) out.compressed = true;
        else { out.pixOff = el.val; out.pixLen = el.len; }
        break;
      }
      if (el.len === 0xffffffff) { off = skipUndef(dv, el.val, explicit); continue; }
      const key = WANT[el.tag];
      if (key) {
        out[key] = US_TAGS.has(el.tag) ? dv.getUint16(el.val, true) : str(u8, el.val, el.len, key === "patient" ? dec : null);
        if (key === "charset") dec = decoderFor(out.charset);
      }
      if (el.next <= off) break;
      off = el.next;
    }
    return out;
  }
  const nums = s => (s || "").split("\\").map(Number).filter(n => !isNaN(n));

  /* ═══════════════ Сборка объёма ═══════════════ */
  const MAX_VOXELS = 300e6;            // ~600 МБ в Int16 — предел для браузера
  async function buildVolume(files, onProgress) {
    /* Срезы пишем сразу в общий буфер по мере чтения, а порядок наводим
       потом перестановкой на месте: так снимок не лежит в памяти дважды. */
    const order = [];
    let head = null, factor = 1, skipped = 0, compressed = 0, done = 0;
    let data = null, nx = 0, ny = 0, cap = 0, count = 0;
    for (const f of files) {
      done++;
      if (done % 8 === 0) { onProgress(done / files.length); await new Promise(r => setTimeout(r, 0)); }
      let d, buf;
      try { buf = await f.arrayBuffer(); d = parseDicom(buf); } catch (e) { skipped++; continue; }
      if (d.compressed) { compressed++; continue; }
      if (!d.pixOff || !d.rows || !d.cols || (d.samples && d.samples !== 1)) { skipped++; continue; }
      const frames = +d.frames || 1;
      if (!head) {
        head = d;
        cap = frames > 1 ? frames : files.length;
        while ((d.rows / factor | 0) * (d.cols / factor | 0) * cap > MAX_VOXELS) factor++;
        nx = Math.floor(d.cols / factor); ny = Math.floor(d.rows / factor);
        data = new Int16Array(nx * ny * cap);
      }
      if (d.rows !== head.rows || d.cols !== head.cols) { skipped++; continue; }
      if (head.series && d.series && d.series !== head.series) { skipped++; continue; }
      const px = d.rows * d.cols, slope = +d.slope || 1, icpt = +d.intercept || 0, bits = d.bits || 16;
      const raw = buf.slice(d.pixOff, d.pixOff + Math.min(d.pixLen, px * frames * (bits / 8)));
      const src = bits === 8 ? new Uint8Array(raw) : d.signed ? new Int16Array(raw) : new Uint16Array(raw);
      const inv = (d.photometric || "").includes("MONOCHROME1");
      const pos = nums(d.position), ori = nums(d.orientation);
      let dist = null;
      if (pos.length === 3 && ori.length === 6 && frames === 1) {
        const n = [ori[1] * ori[5] - ori[2] * ori[4], ori[2] * ori[3] - ori[0] * ori[5], ori[0] * ori[4] - ori[1] * ori[3]];
        dist = pos[0] * n[0] + pos[1] * n[1] + pos[2] * n[2];
      }
      for (let fr = 0; fr < frames && count < cap; fr++) {
        const base = fr * px, ff = factor * factor, out = count * nx * ny;
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
          let s = 0;
          for (let dy = 0; dy < factor; dy++) {
            const row = base + (y * factor + dy) * d.cols + x * factor;
            for (let dx = 0; dx < factor; dx++) s += src[row + dx];
          }
          let hu = (s / ff) * slope + icpt;
          if (inv) hu = -hu;
          data[out + x + y * nx] = hu < -32768 ? -32768 : hu > 32767 ? 32767 : hu;
        }
        order.push({ dist, inst: (+d.instance || 0) * 10000 + fr, at: count });
        count++;
      }
    }
    onProgress(1);
    if (!count) {
      const err = new DicomError(compressed ? "compressed" : "empty");
      err.counts = { skipped, compressed };
      throw err;
    }
    const byDist = order.every(s => s.dist !== null) && new Set(order.map(s => s.dist.toFixed(3))).size === order.length;
    order.sort(byDist ? (a, b) => a.dist - b.dist : (a, b) => a.inst - b.inst);
    /* перестановка срезов на месте: срез order[k].at должен встать на место k */
    const plane = nx * ny, tmp = new Int16Array(plane), at = new Int32Array(count);
    for (let k = 0; k < count; k++) at[k] = order[k].at;
    for (let k = 0; k < count; k++) {
      if (at[k] === k) continue;
      /* обходим цикл перестановки */
      tmp.set(data.subarray(k * plane, (k + 1) * plane));
      let cur = k;
      for (;;) {
        const from = at[cur];
        at[cur] = cur;
        if (from === k) { data.set(tmp, cur * plane); break; }
        data.copyWithin(cur * plane, from * plane, (from + 1) * plane);
        cur = from;
      }
    }
    const nz = count;
    if (nz < cap) data = data.subarray(0, nz * plane);
    const ps = nums(head.spacing);
    const sy = (ps[0] || 1) * factor, sx = (ps[1] || ps[0] || 1) * factor;
    let sz = 0;
    if (byDist && nz > 1) {
      const diffs = [];
      for (let i = 1; i < nz; i++) diffs.push(Math.abs(order[i].dist - order[i - 1].dist));
      diffs.sort((a, b) => a - b); sz = diffs[diffs.length >> 1];
    }
    if (!sz) sz = +head.between || +head.thickness || sx;
    const zStep = 1;

    /* статистика по выборке вокселей: диапазон, перцентили, гистограмма */
    let mn = 32767, mx = -32768;
    const stride = Math.max(1, Math.floor(data.length / 4e6));
    for (let i = 0; i < data.length; i += stride) { const v = data[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const BINS = 512, hist = new Uint32Array(BINS), span = Math.max(1, mx - mn);
    let cnt = 0;
    for (let i = 0; i < data.length; i += stride) { hist[Math.min(BINS - 1, ((data[i] - mn) / span * BINS) | 0)]++; cnt++; }
    const pct = p => { let acc = 0; const need = p * cnt; for (let b = 0; b < BINS; b++) { acc += hist[b]; if (acc >= need) return mn + (b + 0.5) / BINS * span; } return mx; };
    const lo = pct(0.005), hi = pct(0.999);
    /* порог «кость» — метод Оцу по вокселям плотнее воздуха */
    const from = Math.max(0, Math.floor((pct(0.35) - mn) / span * BINS));
    let wB = 0, sumB = 0, total = 0, sum = 0, best = 0, thr = from;
    for (let b = from; b < BINS; b++) { total += hist[b]; sum += b * hist[b]; }
    for (let b = from; b < BINS; b++) {
      wB += hist[b]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += b * hist[b];
      const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = b; }
    }
    const otsu = mn + (thr + 0.5) / BINS * span;
    return {
      nx, ny, nz, sx, sy, sz, data, min: mn, max: mx, lo, hi, otsu, hist, histMin: mn, histSpan: span,
      factor, zStep, files: files.length, skipped, compressed,
      meta: { maker: head.maker, model: head.model, date: head.studyDate, modality: head.modality,
              patient: (head.patient || "").replace(/\^+/g, " ").trim(), patientId: head.patientId, birth: head.birth,
              wc: nums(head.wc)[0], ww: nums(head.ww)[0] },
    };
  }

  /* ═══════════════ Матрицы для 3D ═══════════════ */
  const M4 = {
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
      return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
    },
    lookAt(e, c, u) {
      let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z = z.map(v => v / l);
      let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x = x.map(v => v / l);
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
    },
    mul(a, b) {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
      return o;
    },
    inv(m) {
      const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
      return [
        (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
        (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
        (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
        (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d,
      ];
    },
    apply(m, v) {
      const x = v[0], y = v[1], z = v[2];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w];
    },
  };

  /* цвета плоскостей — как на привычных просмотрщиках КЛКТ */
  const PLANE = { axial: "#8b7cf6", coronal: "#35c3b8", sagittal: "#f0a54a" };
  const NAMES = { axial: "Аксиальный", coronal: "Корональный", sagittal: "Сагиттальный", vr: "3D" };

  window.ChestomCT = { parseDicom, buildVolume, M4, PLANE, NAMES, DicomError };
})();
