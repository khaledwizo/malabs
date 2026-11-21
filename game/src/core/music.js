// موسيقى تراثية عربية مولّدة على الجهاز (تأليف أصلي، بلا تسجيلات محمية):
// مقام بيات ثم حجاز على درجة الدوكاه، عود وقانون (أوتار منقورة بخوارزمية كاربلس-سترونغ)، ناي بنفَس واهتزاز، ودربكة بإيقاع المقسوم
const SR = 32000;
const BAYATI = [0, 1.5, 3, 5, 7, 8, 10, 12, 13.5, 15, 17, 19];
const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19];
const D3 = 146.83;
const hz = (scale, deg, oct = 0) => { const n = scale.length - 5; const o = Math.floor(deg / 7); const i = ((deg % 7) + 7) % 7; return D3 * Math.pow(2, (scale[i] + 12 * (o + oct)) / 12); };

function rng(seed) { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// وتر منقور مع تأخير كسري (ضبط دقيق للنغمة)
function pluck(L, R, start, f, dur, amp, o = {}) {
  const P = SR / f, N = Math.max(2, Math.floor(P - 0.5)), frac = P - 0.5 - N, C = (1 - frac) / (1 + frac);
  const buf = new Float32Array(N), bright = o.bright ?? 0.5, damp = o.damp ?? 0.996;
  // إثارة: ضجيج مرشّح (أنعم للعود، أحدّ للقانون)
  let prev = 0; for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; prev = prev + (w - prev) * (0.35 + bright * 0.6); buf[i] = prev; }
  let idx = 0, x1 = 0, y1 = 0; const len = Math.min(L.length - start, Math.floor(dur * SR)), pan = o.pan ?? 0, gl = amp * (1 - Math.max(0, pan)) , gr = amp * (1 + Math.min(0, pan));
  const rel = Math.floor(0.05 * SR);
  for (let n = 0; n < len; n++) {
    const a = buf[idx], b = buf[(idx + 1) % N];
    const avg = damp * (a * (1 - bright * 0.5) + b * bright * 0.5 + (a + b) * 0.25) * 0.667;
    const y = C * avg + x1 - C * y1; x1 = avg; y1 = y;
    buf[idx] = y; idx = (idx + 1) % N;
    const env = n > len - rel ? (len - n) / rel : 1;
    const s = a * env; L[start + n] += s * gl; R[start + n] += s * gr;
  }
}
// ناي: نغمة نفخية بهارمونيات خفيفة واهتزاز ونفَس
function ney(L, R, start, f, dur, amp, pan = 0) {
  const len = Math.min(L.length - start, Math.floor(dur * SR)), att = 0.18 * SR, rel = 0.25 * SR;
  let ph = 0, nz = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR, vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t / 0.4);
    ph += 2 * Math.PI * f * vib / SR;
    nz = nz * 0.92 + (Math.random() * 2 - 1) * 0.08;
    const env = Math.min(1, n / att) * Math.min(1, (len - n) / rel);
    const s = (Math.sin(ph) * 0.8 + Math.sin(ph * 2) * 0.12 + Math.sin(ph * 3) * 0.05 + nz * 0.35) * env * amp;
    L[start + n] += s * (1 - Math.max(0, pan)); R[start + n] += s * (1 + Math.min(0, pan));
  }
}
// دربكة: دُم (منخفض) وتك (حاد) وكا (خفيف)
function drum(L, R, start, kind, amp) {
  const dur = kind === 'D' ? 0.32 : 0.07, len = Math.min(L.length - start, Math.floor(dur * SR));
  let ph = 0, lp = 0;
  for (let n = 0; n < len; n++) {
    const t = n / SR; let s;
    if (kind === 'D') { const f = 62 + 70 * Math.exp(-t * 28); ph += 2 * Math.PI * f / SR; s = Math.sin(ph) * Math.exp(-t * 9) + (Math.random() * 2 - 1) * 0.12 * Math.exp(-t * 60); }
    else { const w = Math.random() * 2 - 1; lp = lp + (w - lp) * 0.6; s = (w - lp) * Math.exp(-t * (kind === 'T' ? 55 : 80)) * (kind === 'T' ? 1 : 0.55) + Math.sin(2 * Math.PI * 620 * t) * 0.25 * Math.exp(-t * 70); }
    L[start + n] += s * amp * 0.95; R[start + n] += s * amp;
  }
}
function riq(L, R, start, amp) {
  const len = Math.min(L.length - start, Math.floor(0.09 * SR));
  for (let n = 0; n < len; n++) { const t = n / SR; const s = (Math.random() * 2 - 1) * Math.exp(-t * 45) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 7200 * t)); L[start + n] += s * amp * 0.8; R[start + n] += s * amp; }
}

// جملة لحنية: حركة متدرّجة مع قفزات قليلة وزخارف، وتنتهي على درجة مستقرة
function phrase(r, bars, startDeg, endDeg) {
  const notes = []; let deg = startDeg, t = 0; const total = bars * 8;
  const rhythms = [[2, 1, 1, 2, 2], [1, 1, 2, 1, 1, 2], [3, 1, 2, 2], [1, 1, 1, 1, 2, 2], [2, 2, 1, 1, 2]];
  while (t < total) {
    const rh = rhythms[Math.floor(r() * rhythms.length)];
    for (const d of rh) {
      if (t >= total) break;
      const last = t + d >= total - 2;
      if (last) deg = endDeg;
      else { const m = r(); deg += m < 0.36 ? -1 : m < 0.72 ? 1 : m < 0.82 ? 2 : m < 0.9 ? -2 : 0; deg = Math.max(-2, Math.min(9, deg)); }
      notes.push({ t, d: last ? total - t : d, deg, orn: !last && d >= 2 && r() < 0.35 });
      t += last ? total - t : d;
    }
  }
  return notes;
}

export function composeArabic(seed = 7) {
  const r = rng(seed), bpm = 92, e8 = 60 / bpm / 2, bar = e8 * 8;
  const BARS = 20, len = Math.ceil((BARS * bar + 1.5) * SR);
  const L = new Float32Array(len), R = new Float32Array(len);
  const at = s => Math.floor(s * SR);
  // درون العود على القرار
  for (let b = 0; b < BARS; b++) { pluck(L, R, at(b * bar), hz(BAYATI, 0, -1), bar * 1.1, 0.16, { bright: 0.25, damp: 0.998, pan: -0.2 }); if (b % 2) pluck(L, R, at(b * bar + e8 * 4), hz(BAYATI, 4, -1), bar * 0.6, 0.09, { bright: 0.25, damp: 0.997, pan: -0.2 }); }
  // المقدمة: ناي حرّ (بارات 0-3)
  const intro = [[0, 4, 0], [4, 3, 1], [7, 2, 2], [9, 3, 1], [12, 4, 0], [16, 4, 4], [20, 2, 3], [22, 4, 2], [26, 6, 0]];
  for (const [t, d, dg] of intro) ney(L, R, at(t * e8), hz(BAYATI, dg, 1), d * e8 * 1.05, 0.16, 0.25);
  // الإيقاع (مقسوم) من البار 4
  const maq = [['D', 0], ['T', 1], ['T', 3], ['D', 4], ['T', 6]];
  for (let b = 4; b < BARS; b++) {
    for (const [k, p] of maq) drum(L, R, at(b * bar + p * e8), k, k === 'D' ? 0.55 : 0.32);
    for (const p of [2, 5, 7]) if (r() < 0.6) drum(L, R, at(b * bar + p * e8), 'K', 0.2);
    if (b >= 8) for (let p = 0; p < 8; p++) if (p % 2 === 1 || r() < 0.3) riq(L, R, at(b * bar + p * e8 + e8 * 0.02), 0.07);
  }
  // العود: جمل بيات (بارات 4-11)
  const play = (notes, b0, scale, inst, oct = 0) => {
    for (const n of notes) {
      const t = b0 * bar + n.t * e8, f = hz(scale, n.deg, oct), d = n.d * e8;
      if (inst === 'oud') { if (n.orn) pluck(L, R, at(t), hz(scale, n.deg + 1, oct), e8 * 0.4, 0.14, { bright: 0.45, damp: 0.994, pan: -0.25 }); pluck(L, R, at(t + (n.orn ? e8 * 0.25 : 0)), f, d + 0.4, 0.26, { bright: 0.42, damp: 0.995, pan: -0.25 }); }
      else if (inst === 'qanun') { const reps = d >= 2 * e8 ? 3 : 1; for (let k = 0; k < reps; k++) { pluck(L, R, at(t + k * d / reps), f, d / reps + 0.3, 0.17, { bright: 0.78, damp: 0.993, pan: 0.3 }); pluck(L, R, at(t + k * d / reps), f * 2, d / reps + 0.2, 0.07, { bright: 0.8, damp: 0.992, pan: 0.35 }); } }
      else ney(L, R, at(t), f, d * 1.02, 0.13, 0.15);
    }
  };
  play(phrase(r, 2, 0, 2), 4, BAYATI, 'oud'); play(phrase(r, 2, 2, 0), 6, BAYATI, 'oud');
  play(phrase(r, 2, 4, 4), 8, BAYATI, 'oud'); play(phrase(r, 2, 4, 0), 10, BAYATI, 'qanun', 1);
  // القانون والناي في الحجاز (بارات 12-15) ثم العودة للبيات بالجميع (16-19)
  play(phrase(r, 2, 4, 3), 12, HIJAZ, 'qanun', 1); play(phrase(r, 2, 3, 0), 14, HIJAZ, 'ney', 1);
  const fin = phrase(r, 2, 2, 0); play(fin, 16, BAYATI, 'oud'); play(fin, 16, BAYATI, 'qanun', 1);
  play(phrase(r, 2, 0, 0), 18, BAYATI, 'oud');
  // تطابق نهاية الحلقة مع بدايتها
  const xf = Math.floor(1.2 * SR), end = Math.floor(BARS * bar * SR);
  for (let i = 0; i < xf; i++) { const k = i / xf; L[i] = L[i] * k + (L[end + i] || 0) * (1 - k); R[i] = R[i] * k + (R[end + i] || 0) * (1 - k); }
  let mx = 1e-6; for (let i = 0; i < end; i++) mx = Math.max(mx, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.85 / mx; for (let i = 0; i < end; i++) { L[i] *= g; R[i] *= g; }
  return { L: L.subarray(0, end), R: R.subarray(0, end), sr: SR };
}
