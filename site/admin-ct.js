/* ═══════════ Просмотр снимков: ядро ═══════════
   Врач открывает папку снимка — сотни файлов DICOM — или обычный снимок
   (панорама, прицельный, фото). Здесь: разбор DICOM, распаковка сжатых
   форматов, сборка объёма, 2D-снимки, демо-снимок и общая математика.
   Окна срезов — admin-ct-mpr.js, 3D — admin-ct-3d.js, интерфейс —
   admin-ct-app.js.

   Всё считается в браузере: файлы не уходят на сервер и нигде не
   сохраняются. Снимок — сведения о здоровье (врачебная тайна,
   специальная категория по 152-ФЗ): закрыли вкладку — данных нет. */
(function () {
  "use strict";

  /* ═══════════════ Векторы ═══════════════ */
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    /* поворот вектора v вокруг единичной оси k на угол t (формула Родрига) */
    rot(v, k, t) {
      const c = Math.cos(t), s = Math.sin(t), d = V.dot(k, v), x = V.cross(k, v);
      return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
    },
  };

  /* ═══════════════ DICOM ═══════════════ */
  const TS_IMPLICIT = "1.2.840.10008.1.2";
  const TS_BIG = "1.2.840.10008.1.2.2";
  const TS_DEFLATE = "1.2.840.10008.1.2.1.99";
  const TS_RLE = "1.2.840.10008.1.2.5";
  const TS_JPEG_BASE = "1.2.840.10008.1.2.4.50";
  const TS_JPEG_EXT = "1.2.840.10008.1.2.4.51";
  const TS_JPEG_LL = new Set(["1.2.840.10008.1.2.4.57", "1.2.840.10008.1.2.4.70"]);
  const CODEC_NAME = ts =>
    /1\.2\.840\.10008\.1\.2\.4\.9\d/.test(ts) || /1\.2\.840\.10008\.1\.2\.4\.20\d/.test(ts) ? "JPEG 2000"
      : /1\.2\.840\.10008\.1\.2\.4\.8\d/.test(ts) ? "JPEG-LS"
      : /1\.2\.840\.10008\.1\.2\.4\.1\d\d/.test(ts) ? "видео MPEG"
      : ts === TS_JPEG_EXT ? "JPEG 12 бит" : "сжатый формат";
  const LONG_VR = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "SV", "UC", "UN", "UR", "UT", "UV"]);
  const T = (g, e) => ((g << 16) | e) >>> 0;
  const PIXEL = T(0x7fe0, 0x0010);
  const WANT = {
    [T(0x0008, 0x0005)]: "charset",     [T(0x0008, 0x0020)]: "studyDate",
    [T(0x0008, 0x0060)]: "modality",    [T(0x0008, 0x0070)]: "maker",
    [T(0x0008, 0x1030)]: "study",       [T(0x0008, 0x103e)]: "seriesDesc",
    [T(0x0008, 0x1090)]: "model",       [T(0x0010, 0x0010)]: "patient",
    [T(0x0010, 0x0020)]: "patientId",   [T(0x0010, 0x0030)]: "birth",
    [T(0x0018, 0x0050)]: "thickness",   [T(0x0018, 0x0088)]: "between",
    [T(0x0018, 0x1164)]: "imagerSpacing",
    [T(0x0020, 0x000e)]: "series",      [T(0x0020, 0x0013)]: "instance",
    [T(0x0020, 0x0032)]: "position",    [T(0x0020, 0x0037)]: "orientation",
    [T(0x0028, 0x0002)]: "samples",     [T(0x0028, 0x0004)]: "photometric",
    [T(0x0028, 0x0006)]: "planar",      [T(0x0028, 0x0008)]: "frames",
    [T(0x0028, 0x0010)]: "rows",        [T(0x0028, 0x0011)]: "cols",
    [T(0x0028, 0x0030)]: "spacing",     [T(0x0028, 0x0100)]: "bits",
    [T(0x0028, 0x0101)]: "stored",      [T(0x0028, 0x0103)]: "signed",
    [T(0x0028, 0x1050)]: "wc",          [T(0x0028, 0x1051)]: "ww",
    [T(0x0028, 0x1052)]: "intercept",   [T(0x0028, 0x1053)]: "slope",
  };
  const US_TAGS = new Set([T(0x28, 0x02), T(0x28, 0x06), T(0x28, 0x10), T(0x28, 0x11), T(0x28, 0x100), T(0x28, 0x101), T(0x28, 0x103)]);

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
    else {
      /* без преамбулы: первый тег должен быть из групп 0002/0008 */
      const g = dv.getUint16(0, true);
      if (g !== 0x0002 && g !== 0x0008) throw new DicomError("not dicom");
    }
    let ts = null;
    while (off + 8 <= buf.byteLength && dv.getUint16(off, true) === 0x0002) {
      const el = readEl(dv, off, true);
      if (el.tag === T(0x0002, 0x0010)) ts = str(u8, el.val, el.len);
      off = el.next;
    }
    if (!ts) {
      const a = u8[off + 4], b = u8[off + 5];
      ts = a >= 65 && a <= 90 && b >= 65 && b <= 90 ? "1.2.840.10008.1.2.1" : TS_IMPLICIT;
    }
    if (ts === TS_BIG || ts === TS_DEFLATE) throw new DicomError("unsupported");
    const explicit = ts !== TS_IMPLICIT;
    const out = { ts };
    let dec = latin;
    try {
      while (off + 8 <= buf.byteLength) {
        const el = readEl(dv, off, explicit);
        if (el.tag === PIXEL) {
          if (el.len === 0xffffffff) out.frags = readFragments(dv, el.val);
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
    } catch (e) {
      /* обрезанный или повреждённый хвост: оставляем то, что успели прочитать */
      if (!(e instanceof RangeError)) throw e;
    }
    return out;
  }
  /* инкапсулированные пиксели (сжатые форматы): таблица смещений + фрагменты */
  function readFragments(dv, off) {
    const n = dv.byteLength, items = [];
    while (off + 8 <= n) {
      const g = dv.getUint16(off, true), e = dv.getUint16(off + 2, true), len = dv.getUint32(off + 4, true);
      if (g !== 0xfffe || e === 0xe0dd) break;
      items.push({ pos: off, off: off + 8, len: Math.min(len, n - off - 8) });
      off += 8 + len;
    }
    const botItem = items.shift();
    const bot = [];
    if (botItem && botItem.len >= 4) for (let i = 0; i < botItem.len; i += 4) bot.push(dv.getUint32(botItem.off + i, true));
    const first = items.length ? items[0].pos : 0;
    return { bot, items: items.map(it => ({ rel: it.pos - first, off: it.off, len: it.len })) };
  }
  const nums = s => (s || "").split("\\").map(Number).filter(n => !isNaN(n));

  /* ── фрагменты кадра f ── */
  function frameBytes(d, u8, f) {
    const fr = d.frags, frames = +d.frames || 1, its = fr.items;
    let pick;
    if (frames === 1) pick = its;
    else if (fr.bot.length === frames) {
      const a = fr.bot[f], b = f + 1 < frames ? fr.bot[f + 1] : Infinity;
      pick = its.filter(it => it.rel >= a && it.rel < b);
    } else if (its.length === frames) pick = [its[f]];
    else throw new DicomError("frames");
    if (pick.length === 1) return u8.subarray(pick[0].off, pick[0].off + pick[0].len);
    const total = pick.reduce((s, it) => s + it.len, 0), out = new Uint8Array(total);
    let p = 0; for (const it of pick) { out.set(u8.subarray(it.off, it.off + it.len), p); p += it.len; }
    return out;
  }

  /* ── RLE Lossless (PackBits по байтовым плоскостям) ── */
  function decodeRLE(src, count, bytesPerSample) {
    const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
    const nseg = dv.getUint32(0, true), segs = [];
    for (let s = 0; s < nseg; s++) segs.push(dv.getUint32(4 + s * 4, true));
    const planes = [];
    for (let s = 0; s < nseg; s++) {
      const a = segs[s], b = s + 1 < nseg ? segs[s + 1] : src.length, out = new Uint8Array(count);
      let i = a, o = 0;
      while (i < b && o < count) {
        const n = (src[i++] << 24) >> 24;
        if (n >= 0) { const m = Math.min(n + 1, count - o); out.set(src.subarray(i, i + m), o); o += m; i += n + 1; }
        else if (n !== -128) { const m = Math.min(1 - n, count - o); out.fill(src[i++], o, o + m); o += m; }
      }
      planes.push(out);
    }
    if (bytesPerSample === 1) return planes[0];
    const res = new Uint16Array(count), hi = planes[0], lo = planes[1];
    for (let i = 0; i < count; i++) res[i] = (hi[i] << 8) | lo[i];
    return res;
  }

  /* ── JPEG Lossless (процесс 14, один канал) ──
     Такой формат часто пишут аппараты КЛКТ и диски пациентов.
     Хаффман — через таблицу на 16 бит: быстро и без лишних ветвлений. */
  function huffTable(counts, syms) {
    const lut = new Uint16Array(65536);
    let code = 0, k = 0;
    for (let len = 1; len <= 16; len++) {
      for (let i = 0; i < counts[len - 1]; i++) {
        const base = code << (16 - len), span = 1 << (16 - len), v = (len << 8) | syms[k++];
        lut.fill(v, base, base + span);
        code++;
      }
      code <<= 1;
    }
    return lut;
  }
  function decodeJpegLossless(u8) {
    if (u8[0] !== 0xff || u8[1] !== 0xd8) throw new DicomError("jpeg");
    const tables = {};
    let pos = 2, W = 0, H = 0, P = 16, restart = 0, sel = 1, pt = 0, td = 0, scan = -1;
    while (pos + 4 <= u8.length) {
      if (u8[pos] !== 0xff) { pos++; continue; }
      const m = u8[pos + 1];
      if (m === 0xff) { pos++; continue; }
      pos += 2;
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue;
      const len = (u8[pos] << 8) | u8[pos + 1], seg = pos + 2, end = pos + len;
      if (m === 0xc4) {
        let q = seg;
        while (q < end) {
          const tc = u8[q] >> 4, th = u8[q] & 15; q++;
          const counts = u8.subarray(q, q + 16); q += 16;
          let n = 0; for (let i = 0; i < 16; i++) n += counts[i];
          if (tc === 0) tables[th] = huffTable(counts, u8.subarray(q, q + n));
          q += n;
        }
      } else if (m === 0xc3) {
        P = u8[seg]; H = (u8[seg + 1] << 8) | u8[seg + 2]; W = (u8[seg + 3] << 8) | u8[seg + 4];
        if (u8[seg + 5] !== 1) throw new DicomError("jpeg: цвет");
      } else if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        throw new DicomError("jpeg: не lossless");
      } else if (m === 0xdd) {
        restart = (u8[seg] << 8) | u8[seg + 1];
      } else if (m === 0xda) {
        const ns = u8[seg]; td = u8[seg + 2] >> 4;
        const q = seg + 1 + ns * 2; sel = u8[q]; pt = u8[q + 2] & 15;
        scan = end; break;
      }
      pos = end;
    }
    if (scan < 0 || !W || !H) throw new DicomError("jpeg");
    const lut = tables[td] || tables[0];
    /* разбираем поток: снимаем байт-стаффинг FF00, запоминаем метки RST */
    const data = new Uint8Array(u8.length - scan), rst = [];
    let n = 0;
    for (let i = scan; i < u8.length; i++) {
      const b = u8[i];
      if (b === 0xff) {
        const nx = u8[i + 1];
        if (nx === 0x00) { data[n++] = 0xff; i++; continue; }
        if (nx >= 0xd0 && nx <= 0xd7) { rst.push(n); i++; continue; }
        if (nx === 0xff) continue;
        break;                                  // EOI или другой маркер
      }
      data[n++] = b;
    }
    let bp = 0, buf = 0, cnt = 0, rsti = 0;
    const need = k => { while (cnt < k) { buf = ((buf << 8) | (bp < n ? data[bp++] : 0)) >>> 0; cnt += 8; } };
    const out = new Uint16Array(W * H), init = 1 << (P - pt - 1), mask = P >= 16 ? 0xffff : (1 << P) - 1;
    let firstRow = 0, count = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (restart && count > 0 && count % restart === 0) {
          /* новый интервал: к границе байта и за метку RST; предсказание — как в первой строке */
          cnt = 0; buf = 0; if (rsti < rst.length) bp = rst[rsti++];
          firstRow = y;
        }
        count++;
        const i = y * W + x;
        let pred;
        if (y === firstRow) pred = x === 0 ? init : out[i - 1];
        else if (x === 0) pred = out[i - W];
        else {
          const a = out[i - 1], b = out[i - W], c = out[i - W - 1];
          pred = sel === 1 ? a : sel === 2 ? b : sel === 3 ? c : sel === 4 ? a + b - c : sel === 5 ? a + ((b - c) >> 1) : sel === 6 ? b + ((a - c) >> 1) : (a + b) >> 1;
        }
        need(16);
        const e = lut[(buf >>> (cnt - 16)) & 0xffff], l = e >> 8, s = e & 0xff;
        cnt -= l || 16;
        let diff = 0;
        if (s === 16) diff = 32768;
        else if (s) {
          need(s);
          const bits = (buf >>> (cnt - s)) & ((1 << s) - 1); cnt -= s;
          diff = bits < 1 << (s - 1) ? bits - (1 << s) + 1 : bits;
        }
        out[i] = (pred + diff) & mask;
        if (cnt > 24) buf &= (1 << cnt) - 1;
      }
    }
    if (pt) for (let i = 0; i < out.length; i++) out[i] <<= pt;
    return { data: out, w: W, h: H };
  }

  /* ── JPEG baseline (8 бит) — распаковывает сам браузер ── */
  async function decodeJpegBrowser(bytes, w, h, rgb) {
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const x = c.getContext("2d"); x.drawImage(bmp, 0, 0, w, h);
    const px = x.getImageData(0, 0, w, h).data;
    if (rgb) return px;
    const out = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = px[p];
    return out;
  }

  /* Пиксели кадра f как типизированный массив (серый; для цветных — RGBA). */
  async function framePixels(d, buf, f) {
    const px = d.rows * d.cols, bits = d.bits || 16, samples = d.samples || 1, u8 = new Uint8Array(buf);
    let raw;
    if (!d.frags) {
      const bytes = px * samples * (bits / 8), start = d.pixOff + f * bytes;
      const slice = buf.slice(start, start + bytes);
      if (samples === 3) return { rgb: toRGBA(new Uint8Array(slice), px, d.planar) };
      raw = bits === 8 ? new Uint8Array(slice) : d.signed ? new Int16Array(slice) : new Uint16Array(slice);
    } else {
      const bytes = frameBytes(d, u8, f);
      if (d.ts === TS_RLE) {
        if (samples === 3) {
          const planes = decodeRLEPlanes(bytes, px);
          return { rgb: toRGBA(planes, px, 1) };
        }
        raw = decodeRLE(bytes, px, bits / 8);
      } else if (TS_JPEG_LL.has(d.ts)) {
        raw = decodeJpegLossless(bytes).data;
      } else if (d.ts === TS_JPEG_BASE || (d.ts === TS_JPEG_EXT && bits === 8)) {
        if (samples === 3) return { rgb: await decodeJpegBrowser(bytes, d.cols, d.rows, true) };
        raw = await decodeJpegBrowser(bytes, d.cols, d.rows, false);
      } else {
        throw new DicomError("codec:" + CODEC_NAME(d.ts));
      }
      if (d.signed && bits === 16 && raw instanceof Uint16Array) raw = new Int16Array(raw.buffer, raw.byteOffset, raw.length);
    }
    /* знак для «хранимых» бит меньше 16 (например, 12 бит со знаком) */
    const stored = d.stored || bits;
    if (d.signed && stored < bits && bits === 16) {
      const m = (1 << stored) - 1, sb = 1 << (stored - 1), fixed = new Int16Array(raw.length);
      for (let i = 0; i < raw.length; i++) { const v = raw[i] & m; fixed[i] = v & sb ? v - (1 << stored) : v; }
      raw = fixed;
    }
    return { gray: raw };
  }
  function decodeRLEPlanes(src, count) {
    const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
    const nseg = dv.getUint32(0, true), out = new Uint8Array(count * 3);
    for (let s = 0; s < Math.min(3, nseg); s++) {
      const a = dv.getUint32(4 + s * 4, true), b = s + 1 < nseg ? dv.getUint32(8 + s * 4, true) : src.length;
      let i = a, o = s * count;
      const end = (s + 1) * count;
      while (i < b && o < end) {
        const n = (src[i++] << 24) >> 24;
        if (n >= 0) { const m = Math.min(n + 1, end - o); out.set(src.subarray(i, i + m), o); o += m; i += n + 1; }
        else if (n !== -128) { const m = Math.min(1 - n, end - o); out.fill(src[i++], o, o + m); o += m; }
      }
    }
    return out;
  }
  function toRGBA(src, px, planar) {
    const out = new Uint8ClampedArray(px * 4);
    for (let i = 0; i < px; i++) {
      const r = planar ? src[i] : src[i * 3], g = planar ? src[px + i] : src[i * 3 + 1], b = planar ? src[2 * px + i] : src[i * 3 + 2];
      out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
    }
    return out;
  }

  /* ═══════════════ Сборка объёма ═══════════════ */
  const MAX_VOXELS = 300e6;            // ~600 МБ в Int16 — предел для браузера
  const TWO_D = new Set(["DX", "CR", "IO", "PX", "XC", "MG", "OP", "GM", "SM", "ES", "OT"]);

  /* Срезы пишем сразу в общий буфер по мере чтения, а порядок наводим
     потом перестановкой на месте: так снимок не лежит в памяти дважды. */
  async function buildVolume(files, onProgress, signal) {
    const order = [];
    let head = null, factor = 1, skipped = 0, codec = null, done = 0;
    let data = null, nx = 0, ny = 0, cap = 0, count = 0;
    for (const f of files) {
      if (signal && signal.aborted) throw new DicomError("cancel");
      done++;
      if (done % 4 === 0) { onProgress(done / files.length); await new Promise(r => setTimeout(r, 0)); }
      let d, buf;
      try { buf = await f.arrayBuffer(); d = parseDicom(buf); } catch (e) { skipped++; continue; }
      if ((!d.pixOff && !d.frags) || !d.rows || !d.cols || (d.samples && d.samples !== 1)) { skipped++; continue; }
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
      const slope = +d.slope || 1, icpt = +d.intercept || 0;
      const inv = (d.photometric || "").includes("MONOCHROME1");
      const pos = nums(d.position), ori = nums(d.orientation);
      let dist = null;
      if (pos.length === 3 && ori.length === 6 && frames === 1) {
        const nrm = [ori[1] * ori[5] - ori[2] * ori[4], ori[2] * ori[3] - ori[0] * ori[5], ori[0] * ori[4] - ori[1] * ori[3]];
        dist = pos[0] * nrm[0] + pos[1] * nrm[1] + pos[2] * nrm[2];
      }
      for (let fr = 0; fr < frames && count < cap; fr++) {
        let src;
        try { src = (await framePixels(d, buf, fr)).gray; }
        catch (e) { if (String(e.message).startsWith("codec:")) codec = e.message.slice(6); skipped++; break; }
        const ff = factor * factor, out = count * nx * ny;
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
          let s = 0;
          for (let dy = 0; dy < factor; dy++) {
            const row = (y * factor + dy) * d.cols + x * factor;
            for (let dx = 0; dx < factor; dx++) s += src[row + dx];
          }
          let hu = (s / ff) * slope + icpt;
          if (inv) hu = -hu;
          data[out + x + y * nx] = hu < -32768 ? -32768 : hu > 32767 ? 32767 : hu;
        }
        order.push({ dist, inst: (+d.instance || 0) * 10000 + fr, at: count });
        count++;
      }
      if (count % 16 === 0) onProgress(done / files.length);
    }
    onProgress(1);
    if (!count) {
      const err = new DicomError(codec ? "codec:" + codec : "empty");
      err.counts = { skipped };
      throw err;
    }
    const byDist = order.every(s => s.dist !== null) && new Set(order.map(s => s.dist.toFixed(3))).size === order.length;
    order.sort(byDist ? (a, b) => a.dist - b.dist : (a, b) => a.inst - b.inst);
    /* перестановка срезов на месте: срез order[k].at должен встать на место k */
    const plane = nx * ny, tmp = new Int16Array(plane), at = new Int32Array(count);
    for (let k = 0; k < count; k++) at[k] = order[k].at;
    for (let k = 0; k < count; k++) {
      if (at[k] === k) continue;
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
    return finishVolume(data, nx, ny, nz, sx, sy, sz, metaOf(head), { factor, files: files.length, skipped, codec: head.frags ? codecLabel(head.ts) : "" });
  }
  function codecLabel(ts) {
    return ts === TS_RLE ? "RLE" : TS_JPEG_LL.has(ts) ? "JPEG Lossless" : ts === TS_JPEG_BASE ? "JPEG" : "";
  }
  function metaOf(head) {
    return {
      maker: head.maker, model: head.model, date: head.studyDate, modality: head.modality,
      study: head.study || head.seriesDesc,
      patient: (head.patient || "").replace(/\^+/g, " ").trim(), patientId: head.patientId, birth: head.birth,
      wc: nums(head.wc)[0], ww: nums(head.ww)[0],
    };
  }

  /* статистика по выборке вокселей: диапазон, перцентили, гистограмма, порог кости */
  function finishVolume(data, nx, ny, nz, sx, sy, sz, meta, extra) {
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
    const huLike = mn >= -1300 && mn <= -500 && mx > 1200;
    return Object.assign({
      nx, ny, nz, sx, sy, sz, data, min: mn, max: mx, lo, hi, otsu, huLike, hist, histMin: mn, histSpan: span,
      ext: [(nx - 1) * sx, (ny - 1) * sy, (nz - 1) * sz], minSp: Math.min(sx, sy, sz),
      factor: 1, files: 0, skipped: 0, meta,
    }, extra || {});
  }

  /* значение в точке (мм), ближайший воксель; вне объёма — null */
  function valueAt(vol, q) {
    const i = Math.round(q[0] / vol.sx), j = Math.round(q[1] / vol.sy), k = Math.round(q[2] / vol.sz);
    if (i < 0 || j < 0 || k < 0 || i >= vol.nx || j >= vol.ny || k >= vol.nz) return null;
    return vol.data[i + j * vol.nx + k * vol.nx * vol.ny];
  }

  /* ═══════════════ 2D-снимки: панорама, прицельный, фото ═══════════════ */
  const IMG_RE = /\.(jpe?g|png|webp|bmp|gif|tiff?)$/i;
  async function loadPhoto(file) {
    if (IMG_RE.test(file.name) || /^image\//.test(file.type)) {
      const bmp = await createImageBitmap(file);
      const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
      const x = c.getContext("2d"); x.drawImage(bmp, 0, 0);
      const rgba = x.getImageData(0, 0, c.width, c.height).data;
      let gray = true;
      for (let i = 0; i < rgba.length; i += 4 * 97) if (Math.abs(rgba[i] - rgba[i + 1]) > 6 || Math.abs(rgba[i + 1] - rgba[i + 2]) > 6) { gray = false; break; }
      return { name: file.name, w: c.width, h: c.height, rgba, isGray: gray, pxMm: null, meta: { study: file.name } };
    }
    const buf = await file.arrayBuffer(), d = parseDicom(buf);
    if (!d.rows || !d.cols) throw new DicomError("empty");
    const px = await framePixels(d, buf, 0);
    const ps = nums(d.imagerSpacing).length ? nums(d.imagerSpacing) : nums(d.spacing);
    const meta = metaOf(d);
    if (px.rgb) return { name: file.name, w: d.cols, h: d.rows, rgba: px.rgb, isGray: false, pxMm: ps[0] || null, meta };
    const slope = +d.slope || 1, icpt = +d.intercept || 0, inv = (d.photometric || "").includes("MONOCHROME1");
    const g = new Int16Array(d.rows * d.cols);
    let mn = 32767, mx = -32768;
    for (let i = 0; i < g.length; i++) { let v = px.gray[i] * slope + icpt; if (inv) v = -v; v = v < -32768 ? -32768 : v > 32767 ? 32767 : v; g[i] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
    const vol = finishVolume(g, d.cols, d.rows, 1, ps[1] || ps[0] || 1, ps[0] || 1, 1, meta);
    return { name: file.name, w: d.cols, h: d.rows, gray: g, lo: vol.lo, hi: vol.hi, min: mn, max: mx, hist: vol.hist, histMin: vol.histMin, histSpan: vol.histSpan,
      wc: meta.wc, ww: meta.ww, pxMm: ps[0] || null, meta };
  }
  /* по первому файлу понимаем, что открываем: объём КЛКТ или отдельные снимки */
  async function sniff(files) {
    const imgs = files.filter(f => IMG_RE.test(f.name) || /^image\//.test(f.type));
    if (imgs.length && imgs.length === files.length) return "photo";
    for (const f of files.slice(0, 6)) {
      try {
        const head = await f.slice(0, Math.min(f.size, 64 * 1024)).arrayBuffer();
        const d = parseDicomHead(head);
        if (!d) continue;
        if (TWO_D.has((d.modality || "").toUpperCase())) return "photo";
        if (files.length <= 3 && (+d.frames || 1) <= 1) return "photo";
        return "volume";
      } catch (e) { /* дальше */ }
    }
    return files.length <= 3 ? "photo" : "volume";
  }
  /* заголовок без пикселей: для распознавания хватает первых 64 КБ */
  function parseDicomHead(buf) {
    try { return parseDicom(buf); } catch (e) { return null; }
  }

  /* ═══════════════ Демо-снимок ═══════════════
     Синтетическая нижняя челюсть: кортикальный слой, губчатая кость,
     канал нижнечелюстного нерва, зубы с эмалью, дентином и пульпой,
     кариес на одном зубе и отсутствующий зуб (место под имплант).
     Никаких данных пациентов — всё рассчитано формулами. */
  function demoVolume() {
    const nx = 256, ny = 256, nz = 200, sp = 0.3;
    const data = new Int16Array(nx * ny * nz);
    const X = new Float32Array(nx * ny), Y = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { X[i + j * nx] = (i - nx / 2) * sp; Y[i + j * nx] = (j - ny / 2) * sp; }
    /* дуга: парабола, спереди — меньшие y */
    const N = 360, ax = new Float32Array(N), ay = new Float32Array(N);
    for (let a = 0; a < N; a++) { const t = -1 + 2 * a / (N - 1); ax[a] = 25 * Math.sin(t * 1.22); ay[a] = -20 + 27 * t * t; }
    const dist = new Float32Array(nx * ny).fill(1e9), tpar = new Float32Array(nx * ny), side = new Float32Array(nx * ny);
    for (let p = 0; p < nx * ny; p++) {
      const x = X[p], y = Y[p];
      if (Math.abs(x) > 34 || y < -30 || y > 16) continue;
      let best = 1e18, bi = 0;
      for (let a = 0; a < N; a++) { const dx = x - ax[a], dy = y - ay[a], d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; bi = a; } }
      dist[p] = Math.sqrt(best); tpar[p] = -1 + 2 * bi / (N - 1);
      /* сторона: снаружи дуги (щека/губа) или внутри (язык) */
      const a0 = Math.max(0, bi - 1), a1 = Math.min(N - 1, bi + 1), tx = ax[a1] - ax[a0], ty = ay[a1] - ay[a0];
      side[p] = Math.sign((x - ax[bi]) * ty - (y - ay[bi]) * tx) || 1;
    }
    const teeth = [];
    for (let k = 0; k < 14; k++) {
      if (k === 9) continue;                                       // отсутствующий зуб
      const t = -0.93 + k * (1.86 / 13), r = Math.abs(t) > 0.55 ? 3.8 : Math.abs(t) > 0.25 ? 3.0 : 2.5;
      teeth.push({ x: 25 * Math.sin(t * 1.22), y: -20 + 27 * t * t, r, caries: k === 3 });
    }
    let seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2831853 * rnd());
    const face = new Uint8Array(nx * ny);
    for (let p = 0; p < nx * ny; p++) face[p] = (X[p] / 34) ** 2 + ((Y[p] + 3) / 30) ** 2 < 1 ? 1 : 0;
    const canalR = 1.3;
    for (let k = 0; k < nz; k++) {
      const z = k * sp, base = k * nx * ny;
      for (let p = 0; p < nx * ny; p++) {
        let v = face[p] ? 35 : -1000;
        const dd = dist[p];
        if (z >= 3 && z <= 27) {
          const half = 5.6 - Math.max(0, (z - 20) * 0.2);
          if (dd < half) {
            v = dd > half - 1.7 || z < 4.5 ? 1650 : 420;
            /* канал нерва: вдоль дуги на высоте 9,5–12,5 мм, смещён на 1,2 мм к языку
               (side < 0 — внутренняя, язычная сторона дуги) */
            const t = tpar[p];
            if (Math.abs(t) < 0.97) {
              const cz = 9.5 + 3 * t * t, sd = dd * side[p] + 1.2, dz = z - cz;
              if (sd * sd + dz * dz < canalR * canalR) v = 70;
            }
          }
        }
        data[base + p] = v;
      }
      for (const t of teeth) {
        if (z < 13 || z > 38.5) continue;
        let rr = z >= 27 ? t.r : t.r * (0.5 + 0.5 * (z - 13) / 14);
        if (z > 34.5) rr = t.r * Math.sqrt(Math.max(0, 1 - ((z - 34.5) / 4.2) ** 2));
        const i0 = Math.max(0, Math.floor((t.x - rr - 1) / sp + nx / 2)), i1 = Math.min(nx - 1, Math.ceil((t.x + rr + 1) / sp + nx / 2));
        const j0 = Math.max(0, Math.floor((t.y - rr - 1) / sp + ny / 2)), j1 = Math.min(ny - 1, Math.ceil((t.y + rr + 1) / sp + ny / 2));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const p = i + j * nx, d = Math.hypot(X[p] - t.x, Y[p] - t.y);
          if (d >= rr) continue;
          let v = 1550;                                             // дентин
          if (z >= 27 && d > rr - 1.1) v = 2700;                    // эмаль
          if (z > 37.2) v = 2700;                                    // эмаль жевательной поверхности
          const pulp = z < 27 ? 0.5 : z < 32 ? 1.3 : 0;
          if (d < pulp) v = 60;                                     // пульпа и канал
          if (t.caries && z > 32.5 && Math.hypot(X[p] - t.x - 1.2, Y[p] - t.y + 1.0, (z - 35.5) * 0.9) < 1.9) v = 380;
          data[k * nx * ny + p] = v;
        }
      }
      for (let p = 0; p < nx * ny; p++) data[base + p] += gauss() * 32;
    }
    const today = new Date();
    const ymd = today.getFullYear() + String(today.getMonth() + 1).padStart(2, "0") + String(today.getDate()).padStart(2, "0");
    return finishVolume(data, nx, ny, nz, sp, sp, sp,
      { maker: "Демо", model: "синтетический КЛКТ", date: ymd, modality: "CT", study: "Нижняя челюсть", patient: "Демо Пациент", patientId: "DEMO", demo: true },
      { files: 0, demo: true });
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

  /* цвета плоскостей — как в привычных просмотрщиках КЛКТ */
  const PLANE = { axial: "#8b7cf6", coronal: "#35c3b8", sagittal: "#f0a54a" };
  const NAMES = { axial: "Аксиальный", coronal: "Корональный", sagittal: "Сагиттальный", vr: "3D", pano: "Панорама", xs: "Сечения", photo: "Снимок" };

  window.ChestomCT = {
    V, M4, PLANE, NAMES, DicomError, IMG_RE,
    parseDicom, framePixels, buildVolume, finishVolume, valueAt, loadPhoto, sniff, demoVolume,
    decodeJpegLossless, decodeRLE,
  };
})();
