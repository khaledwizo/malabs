// ===================== أدوات عامة =====================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const angNorm = a => { a = a % TAU; if (a > Math.PI) a -= TAU; else if (a < -Math.PI) a += TAU; return a; };
const angDiff = (a, b) => angNorm(b - a);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[(Math.random() * arr.length) | 0];
const chance = p => Math.random() < p;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
const smoothstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const damp = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
const fmtTime = s => { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const _colCache = new Map();
// لون بشفافية مع ذاكرة مؤقتة لتجنّب إنشاء نصوص جديدة في كل إطار
function col(hex, a = 1) {
  let arr = _colCache.get(hex);
  if (!arr) { arr = new Array(101); arr.rgb = hexRgb(hex); _colCache.set(hex, arr); }
  const q = a <= 0 ? 0 : a >= 1 ? 100 : Math.round(a * 100);
  let s = arr[q];
  if (!s) { const c = arr.rgb; s = arr[q] = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (q / 100) + ')'; }
  return s;
}
function mixHex(h1, h2, t) {
  const a = hexRgb(h1), b = hexRgb(h2);
  const r = Math.round(lerp(a[0], b[0], t)), g = Math.round(lerp(a[1], b[1], t)), bl = Math.round(lerp(a[2], b[2], t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

// كومة صغرى بمصفوفات مُعَنْوَنة (للبحث A*)
class MinHeap {
  constructor(cap = 1024) { this.ids = new Int32Array(cap); this.keys = new Float64Array(cap); this.n = 0; }
  clear() { this.n = 0; }
  push(id, key) {
    if (this.n >= this.ids.length) {
      const ni = new Int32Array(this.ids.length * 2); ni.set(this.ids); this.ids = ni;
      const nk = new Float64Array(this.keys.length * 2); nk.set(this.keys); this.keys = nk;
    }
    const ids = this.ids, keys = this.keys;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      ids[i] = ids[p]; keys[i] = keys[p]; i = p;
    }
    ids[i] = id; keys[i] = key;
  }
  pop() {
    const ids = this.ids, keys = this.keys;
    const top = ids[0];
    const n = --this.n;
    if (n > 0) {
      const id = ids[n], key = keys[n];
      let i = 0;
      for (;;) {
        let l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        if (r < n && keys[r] < keys[l]) l = r;
        if (keys[l] >= key) break;
        ids[i] = ids[l]; keys[i] = keys[l]; i = l;
      }
      ids[i] = id; keys[i] = key;
    }
    return top;
  }
}

function withTimeout(p, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
  });
}

// مسار مستطيل بزوايا دائرية (مع بديل للمتصفحات القديمة)
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
