// قوام إجرائي يُرسم بالكود: طابوق، جص، خشب، مشبك شناشيل، كاشي، أقمشة… مع خرائط نتوء (normal)
import * as THREE from 'three';

let seed = 1337;
export const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
export const srand = s => { seed = s >>> 0; };
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s, per) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const P = v => per ? ((v % per) + per) % per : v;
  const a = hash(P(xi), P(yi), s), b = hash(P(xi + 1), P(yi), s), c = hash(P(xi), P(yi + 1), s), d = hash(P(xi + 1), P(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// ضجيج متعدد الطبقات قابل للتكرار (بلا حواف) عند تمرير per
export function fbm(x, y, oct = 4, s = 0, per = 0) {
  let t = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i * 17, per ? per * f : 0) * amp; amp *= 0.5; f *= 2; }
  return t;
}

class Canvas {
  constructor(w, h) {
    this.w = w; this.h = h || w;
    this.c = document.createElement('canvas'); this.c.width = this.w; this.c.height = this.h;
    this.x = this.c.getContext('2d', { willReadFrequently: true });
    this.hgt = new Float32Array(this.w * this.h).fill(0.5);
  }
  // ضجيج لوني وتضريس بكسل ببكسل
  perPixel(fn) {
    const { w, h } = this, img = this.x.getImageData(0, 0, w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x), j = i * 4;
      const r = fn(x, y, d[j], d[j + 1], d[j + 2], i);
      if (r) { d[j] = r[0]; d[j + 1] = r[1]; d[j + 2] = r[2]; d[j + 3] = r[3] !== undefined ? r[3] : 255; }
    }
    this.x.putImageData(img, 0, 0);
  }
}
const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;

function normalFromHeight(cv, strength = 2) {
  const { w, h, hgt } = cv, n = document.createElement('canvas'); n.width = w; n.height = h;
  const nx = n.getContext('2d'), img = nx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = hgt[y * w + ((x - 1 + w) % w)], r = hgt[y * w + ((x + 1) % w)], u = hgt[((y - 1 + h) % h) * w + x], b = hgt[((y + 1) % h) * w + x];
    let dx = (l - r) * strength, dy = (u - b) * strength, dz = 1; const L = Math.hypot(dx, dy, dz);
    const j = (y * w + x) * 4; d[j] = (dx / L * 0.5 + 0.5) * 255; d[j + 1] = (dy / L * 0.5 + 0.5) * 255; d[j + 2] = (dz / L * 0.5 + 0.5) * 255; d[j + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
  return n;
}

let maxAniso = 1;
export function setAniso(a) { maxAniso = a; }
function toTex(canvas, srgb = true, rep = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function pack(cv, nStrength, extra) {
  const out = { map: toTex(cv.c) };
  if (nStrength) out.normalMap = toTex(normalFromHeight(cv, nStrength), false);
  return Object.assign(out, extra || {});
}

// ---------- الطابوق العراقي الأصفر ----------
export function brick(S, opt = {}) {
  const cv = new Canvas(S), { x } = cv;
  const rows = opt.rows || 14, cols = opt.cols || 4, bh = S / rows, bw = S / cols, m = Math.max(1, S / 160);
  const base = opt.base || [196, 160, 112];
  x.fillStyle = `rgb(${base.map(v => v * 0.72 | 0)})`; x.fillRect(0, 0, S, S);
  srand(opt.seed || 11);
  const H = cv.hgt; H.fill(0.15);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw / 2;
    for (let c = -1; c <= cols; c++) {
      const x0 = c * bw + off + m, y0 = r * bh + m, w = bw - m * 2, h = bh - m * 2;
      const v = 0.82 + rnd() * 0.3, burnt = rnd() < 0.08 ? 0.72 : 1;
      x.fillStyle = `rgb(${cl(base[0] * v * burnt)},${cl(base[1] * v * burnt * (0.97 + rnd() * 0.05))},${cl(base[2] * v * burnt)})`;
      x.fillRect(x0, y0, w, h);
      const hv = 0.75 + rnd() * 0.2;
      for (let yy = Math.max(0, y0 | 0); yy < Math.min(S, y0 + h); yy++) for (let xx = Math.floor(x0); xx < x0 + w; xx++) { const X = ((xx % S) + S) % S; H[yy * S + X] = hv; }
    }
  }
  cv.perPixel((px, py, r, g, b, i) => {
    const n = fbm(px / S * 16, py / S * 16, 3, 3, 16), n2 = fbm(px / S * 4, py / S * 4, 3, 9, 4);
    const k = 0.82 + n * 0.32 - (n2 > 0.62 ? (n2 - 0.62) * 0.9 : 0);
    H[i] += (n - 0.5) * 0.12;
    return [cl(r * k), cl(g * k), cl(b * k * 0.98)];
  });
  return pack(cv, opt.n || 3.2);
}

// ---------- جص / لبخ ----------
export function plaster(S, opt = {}) {
  const cv = new Canvas(S), base = opt.base || [222, 206, 178], H = cv.hgt;
  cv.perPixel((px, py, r, g, b, i) => {
    const n = fbm(px / S * 6, py / S * 6, 5, opt.seed || 5, 6), f = fbm(px / S * 30, py / S * 30, 2, 21, 30);
    const stain = Math.max(0, fbm(px / S * 3, py / S * 3, 3, 33, 3) - 0.55) * 1.6;
    const drip = Math.max(0, fbm(px / S * 18, py / S * 1.2, 2, 44, 18) - 0.6) * (py / S) * 1.2;
    const k = 0.9 + n * 0.18 + (f - 0.5) * 0.06 - stain * 0.35 - drip * 0.4;
    H[i] = 0.5 + n * 0.25 + f * 0.08;
    return [cl(base[0] * k), cl(base[1] * k * (1 - stain * 0.05)), cl(base[2] * k * (1 - stain * 0.12))];
  });
  // شقوق
  const x = cv.x; srand(opt.seed || 5); x.strokeStyle = 'rgba(70,55,40,0.35)'; x.lineWidth = Math.max(1, S / 512);
  for (let k = 0; k < (opt.cracks ?? 5); k++) {
    let px = rnd() * S, py = rnd() * S; x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 14; s++) { px += (rnd() - 0.5) * S * 0.05; py += rnd() * S * 0.035; x.lineTo(px, py); }
    x.stroke();
  }
  return pack(cv, opt.n || 1.6);
}

// ---------- بلاط حجري / ممرات ----------
export function stoneFloor(S, opt = {}) {
  const cv = new Canvas(S), x = cv.x, H = cv.hgt, n = opt.tiles || 3, t = S / n, g = Math.max(2, S / 128);
  const base = opt.base || [178, 164, 140];
  x.fillStyle = '#5b5145'; x.fillRect(0, 0, S, S); H.fill(0.1);
  srand(opt.seed || 7);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = 0.85 + rnd() * 0.25;
    x.fillStyle = `rgb(${cl(base[0] * v)},${cl(base[1] * v)},${cl(base[2] * v)})`;
    x.fillRect(c * t + g, r * t + g, t - g * 2, t - g * 2);
    for (let yy = (r * t + g) | 0; yy < r * t + t - g; yy++) for (let xx = (c * t + g) | 0; xx < c * t + t - g; xx++) H[yy * S + xx] = 0.7 + rnd() * 0.02;
  }
  cv.perPixel((px, py, r, gg, b, i) => {
    const nn = fbm(px / S * 10, py / S * 10, 4, 4, 10), dirt = fbm(px / S * 3, py / S * 3, 3, 8, 3);
    const k = 0.8 + nn * 0.35 - Math.max(0, dirt - 0.55) * 0.6;
    H[i] += (nn - 0.5) * 0.15;
    return [cl(r * k), cl(gg * k), cl(b * k)];
  });
  return pack(cv, 2.4);
}

// رصف بالطابوق بنمط متعرّج (herringbone)
export function brickPaving(S, opt = {}) {
  const cv = new Canvas(S), x = cv.x, H = cv.hgt, u = S / 16, base = opt.base || [170, 120, 84];
  x.fillStyle = '#6a5440'; x.fillRect(0, 0, S, S); H.fill(0.1);
  srand(opt.seed || 9);
  const put = (x0, y0, w, h) => {
    const v = 0.8 + rnd() * 0.3; x.fillStyle = `rgb(${cl(base[0] * v)},${cl(base[1] * v)},${cl(base[2] * v)})`;
    const m = Math.max(1, S / 256);
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) x.fillRect(x0 + m + ox, y0 + m + oy, w - 2 * m, h - 2 * m);
    const hv = 0.7 + rnd() * 0.15;
    for (let yy = Math.floor(y0 + m); yy < y0 + h - m; yy++) for (let xx = Math.floor(x0 + m); xx < x0 + w - m; xx++) H[((yy % S) + S) % S * S + ((xx % S) + S) % S] = hv;
  };
  // نمط سلّة: أزواج أفقية وعمودية متناوبة
  for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
    const X = bx * 2 * u, Y = by * 2 * u;
    if ((bx + by) % 2 === 0) { put(X, Y, 2 * u, u); put(X, Y + u, 2 * u, u); }
    else { put(X, Y, u, 2 * u); put(X + u, Y, u, 2 * u); }
  }
  cv.perPixel((px, py, r, g, b, i) => { const n = fbm(px / S * 12, py / S * 12, 3, 2, 12), d = fbm(px / S * 3, py / S * 3, 2, 6, 3); const k = 0.82 + n * 0.3 - Math.max(0, d - 0.5) * 0.5; H[i] += (n - 0.5) * 0.1; return [cl(r * k), cl(g * k), cl(b * k)]; });
  return pack(cv, 2.6);
}

// ---------- خشب ----------
export function wood(S, opt = {}) {
  const cv = new Canvas(S), H = cv.hgt, base = opt.base || [120, 78, 46], planks = opt.planks ?? 5, pw = S / Math.max(1, planks);
  srand(opt.seed || 3); const tone = []; for (let i = 0; i < 16; i++) tone.push(0.8 + rnd() * 0.35);
  cv.perPixel((px, py, r, g, b, i) => {
    const p = planks ? Math.floor(px / pw) : 0, lx = planks ? (px % pw) / pw : 0;
    const grain = Math.sin((py / S * 40 + fbm(px / S * 3, py / S * 8, 3, p + 1, 0) * 6) * 3.1) * 0.5 + 0.5;
    const n = fbm(px / S * 20, py / S * 2, 3, 7 + p, 0);
    let k = tone[p % 16] * (0.78 + grain * 0.18 + n * 0.12);
    let h = 0.6 + grain * 0.08;
    if (planks && (lx < 0.025 || lx > 0.975)) { k *= 0.45; h = 0.2; }
    H[i] = h;
    return [cl(base[0] * k), cl(base[1] * k), cl(base[2] * k)];
  });
  return pack(cv, opt.n || 1.8);
}

// ---------- مشبك الشناشيل الخشبي (ثقوب داكنة) ----------
export function lattice(S, opt = {}) {
  const cv = new Canvas(S), x = cv.x, H = cv.hgt, n = opt.n || 8, c = S / n, bar = c * 0.28;
  const w = wood(S, { base: opt.base || [104, 62, 34], planks: 0, seed: 12 });
  x.fillStyle = '#120c08'; x.fillRect(0, 0, S, S); H.fill(0.05);
  x.save(); x.beginPath();
  for (let i = 0; i <= n; i++) { x.rect(i * c - bar / 2, 0, bar, S); x.rect(0, i * c - bar / 2, S, bar); }
  // معيّنات زخرفية
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const cx = i * c + c / 2, cy = j * c + c / 2, r = c * 0.2; x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.closePath(); }
  x.clip(); x.drawImage(w.map.image, 0, 0); x.restore();
  const img = x.getImageData(0, 0, S, S).data;
  for (let i = 0; i < S * S; i++) H[i] = img[i * 4] > 30 ? 0.8 : 0.05;
  return pack(cv, 4);
}

// ---------- كاشي (قاشاني) بنجمة ثمانية ----------
export function tile(S, opt = {}) {
  const cv = new Canvas(S), x = cv.x, H = cv.hgt, n = opt.n || 2, c = S / n;
  const bg = opt.bg || '#1f7f8f', line = opt.line || '#f1d27a', acc = opt.acc || '#123d6a', white = opt.white || '#e9f3ee';
  x.fillStyle = bg; x.fillRect(0, 0, S, S); H.fill(0.6);
  x.lineJoin = 'round';
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = i * c + c / 2, cy = j * c + c / 2, R = c * 0.42, r = c * 0.2;
    const star = (rr, inner, rot) => { x.beginPath(); for (let k = 0; k < 16; k++) { const a = rot + k * Math.PI / 8, q = k % 2 ? inner : rr; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); };
    star(R, R * 0.72, 0); x.fillStyle = acc; x.fill(); x.lineWidth = c * 0.035; x.strokeStyle = line; x.stroke();
    star(r * 1.25, r * 0.9, Math.PI / 8); x.fillStyle = white; x.fill(); x.strokeStyle = line; x.lineWidth = c * 0.02; x.stroke();
    x.beginPath(); x.arc(cx, cy, r * 0.45, 0, Math.PI * 2); x.fillStyle = bg; x.fill();
    // أوراق في الزوايا
    for (const [qx, qy] of [[i * c, j * c], [i * c + c, j * c], [i * c, j * c + c], [i * c + c, j * c + c]]) { x.beginPath(); x.arc(qx, qy, c * 0.12, 0, Math.PI * 2); x.fillStyle = line; x.fill(); x.beginPath(); x.arc(qx, qy, c * 0.07, 0, Math.PI * 2); x.fillStyle = acc; x.fill(); }
  }
  // فواصل البلاط
  x.strokeStyle = 'rgba(240,235,220,0.8)'; x.lineWidth = Math.max(1, S / 200);
  for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * c, 0); x.lineTo(i * c, S); x.stroke(); x.beginPath(); x.moveTo(0, i * c); x.lineTo(S, i * c); x.stroke(); }
  const img = x.getImageData(0, 0, S, S).data;
  for (let i = 0; i < S * S; i++) { const g = img[i * 4 + 1]; H[i] = 0.5 + (img[i * 4] + g) / 1200; }
  cv.perPixel((px, py, r, g, b) => { const nn = fbm(px / S * 8, py / S * 8, 3, 2, 8); const k = 0.9 + nn * 0.16; return [cl(r * k), cl(g * k), cl(b * k)]; });
  return pack(cv, 1.2);
}

// ---------- رمل / تراب ----------
export function sand(S, opt = {}) {
  const cv = new Canvas(S), H = cv.hgt, base = opt.base || [200, 174, 132];
  cv.perPixel((px, py, r, g, b, i) => {
    const n = fbm(px / S * 8, py / S * 8, 5, opt.seed || 13, 8), f = hash(px, py, 5);
    const k = 0.82 + n * 0.3 + (f - 0.5) * 0.08;
    H[i] = n * 0.8 + f * 0.1;
    return [cl(base[0] * k), cl(base[1] * k), cl(base[2] * k)];
  });
  return pack(cv, 2);
}

// ---------- معدن / بوليمر للأسلحة ----------
export function metal(S, opt = {}) {
  const cv = new Canvas(S), H = cv.hgt, base = opt.base || [52, 55, 60];
  cv.perPixel((px, py, r, g, b, i) => {
    const n = fbm(px / S * 30, py / S * 4, 3, opt.seed || 1, 0), sc = fbm(px / S * 6, py / S * 6, 3, 8, 6), f = hash(px, py, 2);
    const wear = Math.max(0, sc - 0.62) * 2.2;
    const k = 0.85 + n * 0.2 + (f - 0.5) * 0.06;
    H[i] = n * 0.3 + f * 0.05;
    return [cl(base[0] * k + wear * 60), cl(base[1] * k + wear * 58), cl(base[2] * k + wear * 55)];
  });
  return pack(cv, 0.8);
}

// ---------- أقمشة ----------
export function fabric(S, opt = {}) {
  const cv = new Canvas(S), x = cv.x, H = cv.hgt, base = opt.base || [60, 64, 70];
  x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, S, S);
  if (opt.plaid) {
    // كاروهات رمادية (سترة خالد)
    const p = opt.plaid, step = S / p.n;
    for (let i = 0; i < p.n; i++) {
      x.fillStyle = p.c1; x.globalAlpha = 0.35; x.fillRect(i * step, 0, step * 0.18, S); x.fillRect(0, i * step, S, step * 0.18);
      x.fillStyle = p.c2; x.globalAlpha = 0.5; x.fillRect(i * step + step * 0.55, 0, Math.max(1, step * 0.04), S); x.fillRect(0, i * step + step * 0.55, S, Math.max(1, step * 0.04));
    }
    x.globalAlpha = 1;
  }
  if (opt.check) {
    // شماغ أحمر وأبيض
    const n = opt.check, st = S / n;
    x.fillStyle = '#f3eee6'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) { x.fillStyle = opt.col || '#b3202a'; x.fillRect(i * st + st * 0.15, j * st + st * 0.15, st * 0.7, st * 0.7); }
  }
  if (opt.camo) {
    srand(opt.seed || 4);
    for (let k = 0; k < 90; k++) { x.fillStyle = opt.camo[k % opt.camo.length]; x.beginPath(); const cx = rnd() * S, cy = rnd() * S; for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, rr = S * (0.03 + rnd() * 0.05); x.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); } x.fill(); }
  }
  if (opt.stripe) { x.fillStyle = opt.stripe; for (let i = 0; i < 24; i++) x.fillRect(i * S / 24, 0, Math.max(1, S / 400), S); }
  cv.perPixel((px, py, r, g, b, i) => {
    const weave = ((px + py) % 2 ? 0.96 : 1.04) * (0.94 + Math.sin(px * 1.3) * 0.03 + Math.sin(py * 1.3) * 0.03);
    const n = fbm(px / S * 10, py / S * 10, 3, 6, 10), k = weave * (0.9 + n * 0.18);
    H[i] = 0.5 + Math.sin(px * 1.6) * 0.1 + Math.sin(py * 1.6) * 0.1;
    return [cl(r * k), cl(g * k), cl(b * k)];
  });
  return pack(cv, 0.6);
}

// ---------- سجّاد ----------
export function carpet(S, opt = {}) {
  const cv = new Canvas(S), x = cv.x, H = cv.hgt;
  const red = opt.red || '#8c1c22', navy = opt.navy || '#1d2a4d', gold = '#d9a441', cream = '#efe1c3';
  x.fillStyle = red; x.fillRect(0, 0, S, S);
  x.strokeStyle = navy; x.lineWidth = S * 0.05; x.strokeRect(S * 0.05, S * 0.05, S * 0.9, S * 0.9);
  x.strokeStyle = gold; x.lineWidth = S * 0.012; x.strokeRect(S * 0.1, S * 0.1, S * 0.8, S * 0.8);
  x.fillStyle = navy; x.beginPath(); x.moveTo(S / 2, S * 0.2); x.lineTo(S * 0.75, S / 2); x.lineTo(S / 2, S * 0.8); x.lineTo(S * 0.25, S / 2); x.closePath(); x.fill();
  x.fillStyle = cream; x.beginPath(); x.moveTo(S / 2, S * 0.32); x.lineTo(S * 0.63, S / 2); x.lineTo(S / 2, S * 0.68); x.lineTo(S * 0.37, S / 2); x.closePath(); x.fill();
  x.fillStyle = gold; x.beginPath(); x.arc(S / 2, S / 2, S * 0.06, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? gold : cream; x.fillRect(S * 0.12 + i * S * 0.064, S * 0.12, S * 0.03, S * 0.03); x.fillRect(S * 0.12 + i * S * 0.064, S * 0.85, S * 0.03, S * 0.03); }
  cv.perPixel((px, py, r, g, b, i) => { const k = 0.85 + hash(px, py, 4) * 0.2; H[i] = hash(px, py, 4); return [cl(r * k), cl(g * k), cl(b * k)]; });
  return pack(cv, 0.6, {});
}

// لوحة بخط عربي (لافتات المحلات والأفاريز)
export function sign(text, opt = {}) {
  const w = opt.w || 512, h = opt.h || 128, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = opt.bg || '#2b4b3c'; x.fillRect(0, 0, w, h);
  x.strokeStyle = opt.border || '#d9b56a'; x.lineWidth = h * 0.06; x.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
  x.fillStyle = opt.fg || '#f2e3b6'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.font = `700 ${h * 0.52}px "Aref Ruqaa","Amiri","Noto Naskh Arabic",serif`;
  x.fillText(text, w / 2, h * 0.54);
  const img = x.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const k = 0.85 + Math.random() * 0.15; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
  x.putImageData(img, 0, 0);
  const t = toTex(c, true, false); return { map: t };
}

// كتابة جدارية حمراء بقطرات سائلة وآثار أكفّ (لأجواء الرعب)
export function graffiti(text, opt = {}) {
  const w = opt.w || 512, h = opt.h || 192, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.clearRect(0, 0, w, h);
  const col = opt.fg || 'rgba(120,8,10,0.92)';
  x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
  x.font = `700 ${h * 0.42}px "Aref Ruqaa","Reem Kufi",serif`;
  x.save(); x.translate(w / 2, h * 0.42); x.rotate(-0.04); x.fillText(text, 0, 0); x.restore();
  // قطرات
  for (let i = 0; i < 22; i++) { const px = w * 0.12 + Math.random() * w * 0.76, py = h * 0.45 + Math.random() * h * 0.1, L = 10 + Math.random() * h * 0.4; x.fillRect(px, py, 2 + Math.random() * 3, L); x.beginPath(); x.arc(px + 2, py + L, 3, 0, 7); x.fill(); }
  // آثار أكفّ
  if (opt.hands !== false) for (let k = 0; k < 2; k++) { const hx = k ? w * 0.08 : w * 0.9, hy = h * (0.25 + Math.random() * 0.4); x.save(); x.translate(hx, hy); x.rotate((Math.random() - 0.5) * 0.6); x.beginPath(); x.ellipse(0, 0, 14, 17, 0, 0, 7); x.fill(); for (let f = 0; f < 4; f++) { x.beginPath(); x.ellipse(-10 + f * 7, -24 - (f === 1 || f === 2 ? 4 : 0), 3.2, 9, 0, 0, 7); x.fill(); } x.beginPath(); x.ellipse(16, -4, 3.2, 8, -0.8, 0, 7); x.fill(); x.restore(); }
  return { map: toTex(c, true, false) };
}
// وجه ساعة البرج
export function clockFace(S = 256) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = S / 2;
  x.fillStyle = '#f3ead2'; x.beginPath(); x.arc(r, r, r * 0.96, 0, 7); x.fill();
  x.lineWidth = S * 0.04; x.strokeStyle = '#1f3d5a'; x.stroke();
  x.fillStyle = '#1f2a33'; x.font = `700 ${S * 0.1}px "Reem Kufi",serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const AR = ['١٢', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠', '١١'];
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; x.fillText(AR[i], r + Math.cos(a) * r * 0.74, r + Math.sin(a) * r * 0.74); }
  x.strokeStyle = '#1f2a33'; x.lineCap = 'round';
  x.lineWidth = S * 0.035; x.beginPath(); x.moveTo(r, r); x.lineTo(r + Math.cos(-2.1) * r * 0.45, r + Math.sin(-2.1) * r * 0.45); x.stroke();
  x.lineWidth = S * 0.022; x.beginPath(); x.moveTo(r, r); x.lineTo(r + Math.cos(-0.5) * r * 0.65, r + Math.sin(-0.5) * r * 0.65); x.stroke();
  x.fillStyle = '#b8892c'; x.beginPath(); x.arc(r, r, S * 0.03, 0, 7); x.fill();
  return { map: toTex(c, true, false) };
}
// سعف النخيل: ورقة بخلفية شفافة
export function palmLeaf(S) {
  const c = document.createElement('canvas'); c.width = S; c.height = S / 2; const x = c.getContext('2d');
  x.clearRect(0, 0, S, S / 2);
  const H = S / 2, mid = H / 2;
  for (let i = 3; i < 70; i++) {
    const t = i / 70, px = t * S, py = mid - Math.sin(t * Math.PI) * S / 50;
    const L = (H * 0.46) * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.95 + 0.05) * (0.8 + Math.random() * 0.25);
    for (const sgn of [-1, 1]) {
      const g = 105 + Math.random() * 60 | 0;
      x.fillStyle = `rgb(${55 + Math.random() * 35 | 0},${g},${35 + Math.random() * 25 | 0})`;
      const ex = px + L * 0.55, ey = py + sgn * L, w = S / 120;
      x.beginPath(); x.moveTo(px - w, py); x.quadraticCurveTo(px + L * 0.2, py + sgn * L * 0.6, ex, ey); x.lineTo(px + w * 2, py); x.closePath(); x.fill();
    }
  }
  x.strokeStyle = '#6b5a2a'; x.lineWidth = S / 70; x.beginPath(); x.moveTo(0, mid); x.quadraticCurveTo(S / 2, mid - S / 40, S, mid + S / 50); x.stroke();
  const t = toTex(c, true, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return { map: t };
}
// جذع النخلة (حراشف)
export function palmTrunk(S) {
  const cv = new Canvas(S), H = cv.hgt;
  cv.perPixel((px, py, r, g, b, i) => {
    const row = py / S * 18, f = row - Math.floor(row), sc = Math.abs(((px / S * 6 + Math.floor(row) * 0.5) % 1) - 0.5);
    const k = 0.55 + f * 0.45 - sc * 0.3 + fbm(px / S * 12, py / S * 12, 2, 3, 12) * 0.2;
    H[i] = f;
    return [cl(122 * k), cl(96 * k), cl(66 * k)];
  });
  return pack(cv, 3);
}

// وجه مرسوم إجرائياً لشخصية: بشرة، عيون، حواجب، لحية/شارب
export function face(S, o) {
  const c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d');
  x.fillStyle = o.skin; x.fillRect(0, 0, S, S);
  // تظليل ناعم
  const g = x.createRadialGradient(S / 2, S * 0.45, S * 0.1, S / 2, S * 0.5, S * 0.6); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(60,30,20,0.25)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const ey = S * 0.42, ex = S * 0.17;
  // لحية كاملة أو خفيفة
  if (o.beard) {
    x.fillStyle = o.beard; x.globalAlpha = o.beardA ?? 0.85;
    x.beginPath(); x.moveTo(S * 0.2, S * 0.55); x.quadraticCurveTo(S * 0.22, S * 0.95, S / 2, S * 0.98); x.quadraticCurveTo(S * 0.78, S * 0.95, S * 0.8, S * 0.55); x.lineTo(S * 0.72, S * 0.6); x.quadraticCurveTo(S / 2, S * 0.78, S * 0.28, S * 0.6); x.closePath(); x.fill();
    x.globalAlpha = 1;
  }
  if (o.stubble) { x.fillStyle = o.stubble; for (let i = 0; i < 2600; i++) { const a = Math.random() * Math.PI, rr = S * (0.25 + Math.random() * 0.22); const px = S / 2 + Math.cos(a) * rr * 0.95, py = S * 0.55 + Math.sin(a) * rr * 0.85; if (py > S * 0.56) x.fillRect(px, py, 1.5, 1.5); } }
  if (o.mustache) { x.fillStyle = o.mustache; x.beginPath(); x.ellipse(S / 2, S * 0.655, S * 0.13, S * 0.035, 0, Math.PI, 0); x.fill(); x.fillRect(S * 0.37, S * 0.64, S * 0.26, S * 0.025); }
  if (o.goatee) { x.fillStyle = o.goatee; x.beginPath(); x.ellipse(S / 2, S * 0.86, S * 0.1, S * 0.11, 0, 0, Math.PI * 2); x.fill(); }
  // عيون
  for (const s of [-1, 1]) {
    const cx = S / 2 + s * ex;
    x.fillStyle = '#f3ede4'; x.beginPath(); x.ellipse(cx, ey, S * 0.07, S * 0.032, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = o.eye || '#3b2618'; x.beginPath(); x.arc(cx, ey, S * 0.028, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#0b0705'; x.beginPath(); x.arc(cx, ey, S * 0.013, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.arc(cx - S * 0.01, ey - S * 0.01, S * 0.006, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(40,20,10,0.8)'; x.lineWidth = S * 0.012; x.beginPath(); x.ellipse(cx, ey, S * 0.072, S * 0.034, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
    // حاجب
    x.fillStyle = o.brow || '#1c120c'; x.beginPath(); x.moveTo(cx - S * 0.085 * s * -1, ey - S * 0.06); x.quadraticCurveTo(cx, ey - S * 0.1, cx + S * 0.09 * s, ey - S * 0.07); x.lineTo(cx + S * 0.09 * s, ey - S * 0.055); x.quadraticCurveTo(cx, ey - S * 0.08, cx - S * 0.085 * s * -1, ey - S * 0.045); x.fill();
  }
  // أنف وفم
  x.strokeStyle = 'rgba(90,50,30,0.55)'; x.lineWidth = S * 0.012; x.beginPath(); x.moveTo(S / 2 - S * 0.01, S * 0.45); x.lineTo(S / 2 - S * 0.035, S * 0.57); x.quadraticCurveTo(S / 2, S * 0.6, S / 2 + S * 0.035, S * 0.57); x.stroke();
  x.fillStyle = o.lip || '#9a5a4c'; x.beginPath(); x.ellipse(S / 2, S * 0.715, S * 0.075, S * 0.022, 0, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(60,25,20,0.7)'; x.lineWidth = S * 0.008; x.beginPath(); x.moveTo(S / 2 - S * 0.075, S * 0.715); x.quadraticCurveTo(S / 2, S * 0.73, S / 2 + S * 0.075, S * 0.715); x.stroke();
  const t = toTex(c, true, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export { toTex, Canvas };

// أطلس تفاصيل الأرض (4×4): تشققات، بقع، زيت، أوراق وقمامة، أوراق شجر، رمل، فتحة تصريف، غطاء بالوعة، آثار إطارات، فوارغ رصاص...
export function decalAtlas(S = 512) {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), T = S / 4;
  const R = (() => { let a = 99; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  const tile = (i, f) => { x.save(); x.translate((i % 4) * T, Math.floor(i / 4) * T); x.beginPath(); x.rect(0, 0, T, T); x.clip(); f(T); x.restore(); };
  const crack = (t, n, w) => { x.strokeStyle = 'rgba(20,14,10,0.75)'; x.lineCap = 'round'; for (let k = 0; k < n; k++) { let px = t * (0.2 + R() * 0.6), py = t * (0.2 + R() * 0.6), a = R() * 6.28; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 9; s++) { a += (R() - 0.5) * 1.1; px += Math.cos(a) * t * 0.07; py += Math.sin(a) * t * 0.07; x.lineTo(px, py); x.lineWidth = Math.max(0.6, w * (1 - s / 10)); } x.stroke(); } };
  const blob = (t, col, n, r) => { for (let k = 0; k < n; k++) { const gx = t * (0.3 + R() * 0.4), gy = t * (0.3 + R() * 0.4), rr = t * r * (0.5 + R() * 0.6), g = x.createRadialGradient(gx, gy, 0, gx, gy, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, t, t); } };
  tile(0, t => crack(t, 3, 2.2));
  tile(1, t => crack(t, 6, 1.4));
  tile(2, t => blob(t, 'rgba(30,22,14,0.55)', 5, 0.28));
  tile(3, t => { blob(t, 'rgba(8,8,10,0.75)', 3, 0.22); blob(t, 'rgba(60,40,90,0.15)', 2, 0.15); });
  tile(4, t => { for (let k = 0; k < 7; k++) { x.save(); x.translate(t * (0.15 + R() * 0.7), t * (0.15 + R() * 0.7)); x.rotate(R() * 6.28); x.fillStyle = ['#e8e2d2', '#d9cba8', '#b8c4cc', '#c43a2c'][Math.floor(R() * 4)]; x.globalAlpha = 0.85; x.fillRect(-t * 0.06, -t * 0.04, t * (0.08 + R() * 0.08), t * (0.05 + R() * 0.05)); x.restore(); } });
  tile(5, t => { for (let k = 0; k < 16; k++) { x.save(); x.translate(t * (0.1 + R() * 0.8), t * (0.1 + R() * 0.8)); x.rotate(R() * 6.28); x.fillStyle = ['#7a5a26', '#9a6a2a', '#5a4a22', '#8a7a3a'][Math.floor(R() * 4)]; x.globalAlpha = 0.9; x.beginPath(); x.ellipse(0, 0, t * 0.05, t * 0.022, 0, 0, 6.28); x.fill(); x.restore(); } });
  tile(6, t => { blob(t, 'rgba(196,170,120,0.55)', 6, 0.3); for (let k = 0; k < 300; k++) { x.fillStyle = `rgba(${150 + R() * 60},${130 + R() * 50},${90 + R() * 40},0.6)`; x.fillRect(t * (0.15 + R() * 0.7), t * (0.15 + R() * 0.7), 1.5, 1.5); } });
  tile(7, t => { x.fillStyle = '#2a2826'; x.fillRect(t * 0.18, t * 0.3, t * 0.64, t * 0.4); x.fillStyle = '#0c0b0a'; for (let k = 0; k < 7; k++) x.fillRect(t * (0.22 + k * 0.083), t * 0.34, t * 0.045, t * 0.32); });
  tile(8, t => { const cx = t / 2, r = t * 0.42; x.fillStyle = '#34312d'; x.beginPath(); x.arc(cx, cx, r, 0, 6.28); x.fill(); x.strokeStyle = '#22201d'; x.lineWidth = 3; for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(cx - r, cx + k * r * 0.25); x.lineTo(cx + r, cx + k * r * 0.25); x.stroke(); } x.strokeStyle = '#4a4640'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cx, r, 0, 6.28); x.stroke(); });
  tile(9, t => { x.strokeStyle = 'rgba(14,12,10,0.45)'; for (const o of [0.36, 0.64]) { x.lineWidth = t * 0.09; x.beginPath(); x.moveTo(t * o, 0); x.bezierCurveTo(t * (o + 0.1), t * 0.4, t * (o - 0.1), t * 0.6, t * o, t); x.stroke(); } });
  tile(10, t => { for (let k = 0; k < 9; k++) { x.save(); x.translate(t * (0.2 + R() * 0.6), t * (0.2 + R() * 0.6)); x.rotate(R() * 6.28); x.fillStyle = '#c9a043'; x.fillRect(-4, -1.6, 8, 3.2); x.fillStyle = '#8a6a22'; x.fillRect(3, -1.6, 1.5, 3.2); x.restore(); } });
  tile(11, t => { blob(t, 'rgba(90,0,0,0.6)', 4, 0.22); for (let k = 0; k < 18; k++) { x.fillStyle = 'rgba(110,0,0,0.7)'; x.beginPath(); x.arc(t * (0.2 + R() * 0.6), t * (0.2 + R() * 0.6), 1 + R() * 3, 0, 6.28); x.fill(); } });
  tile(12, t => { for (let k = 0; k < 5; k++) { const g = x.createRadialGradient(t * (0.3 + R() * 0.4), t * (0.3 + R() * 0.4), 0, t / 2, t / 2, t * 0.45); g.addColorStop(0, 'rgba(70,90,40,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, t, t); } for (let k = 0; k < 60; k++) { x.strokeStyle = `rgba(${60 + R() * 40},${100 + R() * 50},${30 + R() * 20},0.9)`; x.lineWidth = 1.2; const gx = t * (0.25 + R() * 0.5), gy = t * (0.35 + R() * 0.4); x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (R() - 0.5) * 8, gy - 6 - R() * 10); x.stroke(); } });
  tile(13, t => { x.fillStyle = 'rgba(20,20,22,0.35)'; for (let k = 0; k < 4; k++) { x.save(); x.translate(t * (0.2 + R() * 0.6), t * (0.2 + R() * 0.6)); x.rotate(R() * 6.28); x.fillRect(-t * 0.18, -t * 0.012, t * 0.36, t * 0.024); x.restore(); } crack(t, 2, 1); });
  tile(14, t => { blob(t, 'rgba(255,255,255,0.08)', 3, 0.3); crack(t, 1, 3); });
  tile(15, t => { x.fillStyle = 'rgba(40,30,20,0.4)'; for (let k = 0; k < 40; k++) { x.beginPath(); x.arc(t * (0.1 + R() * 0.8), t * (0.1 + R() * 0.8), 1 + R() * 4, 0, 6.28); x.fill(); } });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
// قناع بقعة ماء (برك المطر)
export function puddleTex(S = 128) {
  // الشكل في قناة اللون (أسود → أبيض) لا في الشفافية: المركز أعمق، فتكبر البركة تدريجياً كلما زاد البلل
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) { const gx = S * (0.3 + Math.random() * 0.4), gy = S * (0.3 + Math.random() * 0.4), r = S * (0.16 + Math.random() * 0.18), g = x.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
  x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); return t;
}
