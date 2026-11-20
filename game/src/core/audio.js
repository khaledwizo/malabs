// أصوات إجرائية بالكامل (WebAudio): طلقات، خطوات، انفجارات، قلب، أجواء — مع موضع ثلاثي الأبعاد
import { Settings } from './settings.js';

export const Audio = {
  ctx: null, master: null, sfx: null, amb: null, noise: null, listener: null, live: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = Settings.volume; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(comp);
    this.amb = c.createGain(); this.amb.gain.value = 0.25 * Settings.music; this.amb.connect(this.master);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    // نسخة "بنية" للأجواء
    const bb = c.createBuffer(1, len, c.sampleRate), bd = bb.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brown = bb;
    this.listener = c.listener;
    this.startAmbient();
  },
  setVolume(v) { if (this.master) this.master.gain.value = v; },
  setListener(x, y, z, fx, fy, fz) {
    const L = this.listener; if (!L) return;
    if (L.positionX) { L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z; L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(x, y, z); L.setOrientation(fx, fy, fz, 0, 1, 0); }
    this.lx = x; this.ly = y; this.lz = z;
  },
  // مخرج بموضع ثلاثي الأبعاد (أو مباشر إن لم يُعطَ موضع)
  out(pos, gain = 1, ref = 4, maxD = 120) {
    const c = this.ctx, g = c.createGain(); g.gain.value = gain;
    if (pos) {
      const p = c.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = maxD; p.rolloffFactor = 1.1;
      if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; } else p.setPosition(pos[0], pos[1], pos[2]);
      g.connect(p); p.connect(this.sfx);
      // كتم ترددات عالية للأصوات البعيدة
      const d = Math.hypot(pos[0] - (this.lx || 0), pos[1] - (this.ly || 0), pos[2] - (this.lz || 0));
      if (d > 25) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 9000 - d * 70); g.disconnect(); g.connect(lp); lp.connect(p); }
    } else g.connect(this.sfx);
    return g;
  },
  nz(dest, t, dur, f0, f1, q = 0.8, type = 'bandpass', vol = 1, attack = 0.002) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  osc(dest, t, dur, f0, f1, type = 'sine', vol = 1) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  },
  play(name, pos, opt = {}) {
    if (!this.ctx || this.live > 48) return;
    this.live++; setTimeout(() => this.live--, 600);
    const c = this.ctx, t = c.currentTime, self = !pos;
    const S = SOUNDS[name]; if (S) S(this, pos, t, opt, self);
  },
  startAmbient() {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.brown; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0.35; s.connect(f); f.connect(g); g.connect(this.amb); s.start();
    // طيور ونداءات بعيدة متقطعة
    const chirp = () => { if (!this.ctx) return; const t = c.currentTime; if (Math.random() < 0.7) for (let k = 0; k < 2 + Math.random() * 3; k++) this.osc(this.amb, t + k * 0.12, 0.08, 2600 + Math.random() * 1500, 3400 + Math.random() * 1200, 'sine', 0.05); setTimeout(chirp, 3000 + Math.random() * 7000); };
    setTimeout(chirp, 2000);
  },
};

// مكتبة الأصوات
const gun = (base, body, crack, tail, vol) => (A, pos, t, o, self) => {
  const out = A.out(pos, vol * (self ? 0.7 : 1), 6, 200);
  A.nz(out, t, 0.06, 6000, 1500, 0.6, 'highpass', 1.0 * crack);           // حدّة
  A.nz(out, t, body, base * 3, base, 0.9, 'lowpass', 1.0);                  // جسم
  A.osc(out, t, body * 0.9, base, base * 0.4, 'triangle', 0.6);             // دفعة منخفضة
  A.nz(out, t + 0.02, tail, 900, 200, 0.5, 'lowpass', 0.25);                // صدى
};
const SOUNDS = {
  rifle: gun(170, 0.14, 0.9, 0.5, 0.9), rifleHeavy: gun(130, 0.18, 1, 0.65, 1), smg: gun(220, 0.1, 0.7, 0.35, 0.7),
  shotgun: gun(95, 0.26, 1, 0.8, 1.1), sniper: gun(90, 0.32, 1.2, 1.2, 1.25), sniperSemi: gun(110, 0.24, 1.1, 0.9, 1.1),
  pistol: gun(260, 0.08, 0.7, 0.3, 0.6), pistolHeavy: gun(150, 0.15, 1, 0.55, 0.95),
  knife: (A, pos, t) => { const o = A.out(pos, 0.5); A.nz(o, t, 0.18, 2500, 6000, 1.2, 'bandpass', 0.6, 0.04); },
  knifeHit: (A, pos, t) => { const o = A.out(pos, 0.8); A.nz(o, t, 0.12, 600, 200, 1, 'lowpass', 1); },
  dry: (A, pos, t) => { const o = A.out(pos, 0.4); A.osc(o, t, 0.03, 1800, 1200, 'square', 0.4); },
  reload: (A, pos, t) => { const o = A.out(pos, 0.5, 2, 30); A.nz(o, t, 0.05, 3000, 1500, 2, 'bandpass', 0.5); A.nz(o, t + 0.45, 0.06, 2000, 900, 2, 'bandpass', 0.6); A.nz(o, t + 0.9, 0.08, 2500, 1200, 3, 'bandpass', 0.8); },
  bolt: (A, pos, t) => { const o = A.out(pos, 0.5, 2, 30); A.nz(o, t, 0.07, 2000, 800, 2, 'bandpass', 0.6); A.nz(o, t + 0.25, 0.07, 2600, 1200, 2, 'bandpass', 0.7); },
  draw: (A, pos, t) => { const o = A.out(pos, 0.35, 2, 25); A.nz(o, t, 0.08, 3500, 1800, 1.5, 'bandpass', 0.5); },
  step: (A, pos, t, o) => { const out = A.out(pos, (o.vol || 0.35), 2, 40); A.nz(out, t, 0.07, o.f || 900, 180, 0.7, 'lowpass', 0.9); },
  land: (A, pos, t) => { const o = A.out(pos, 0.6, 2, 40); A.nz(o, t, 0.12, 500, 80, 0.7, 'lowpass', 1); },
  jump: (A, pos, t) => { const o = A.out(pos, 0.2, 2, 30); A.nz(o, t, 0.06, 1200, 500, 1, 'lowpass', 0.6); },
  impact: (A, pos, t, o) => { const out = A.out(pos, 0.35, 2, 40); const m = o.mat; if (m === 3) A.osc(out, t, 0.12, 3000 + Math.random() * 1500, 1500, 'sine', 0.35); A.nz(out, t, 0.06, m === 2 ? 1400 : 2600, 500, 1, 'bandpass', 0.9); },
  flesh: (A, pos, t) => { const o = A.out(pos, 0.6, 2, 40); A.nz(o, t, 0.08, 900, 300, 1, 'lowpass', 1); },
  whizz: (A, pos, t) => { const o = A.out(pos, 0.4, 1, 20); A.nz(o, t, 0.15, 5000, 1500, 3, 'bandpass', 0.7, 0.03); },
  hitmark: (A, pos, t) => { const o = A.out(null, 0.35); A.osc(o, t, 0.05, 1900, 1700, 'sine', 0.5); },
  headshot: (A, pos, t) => { const o = A.out(null, 0.45); A.osc(o, t, 0.12, 2600, 2400, 'sine', 0.6); A.osc(o, t + 0.04, 0.1, 3900, 3800, 'sine', 0.3); },
  kill: (A, pos, t) => { const o = A.out(null, 0.5); A.osc(o, t, 0.18, 880, 870, 'triangle', 0.5); A.osc(o, t + 0.09, 0.22, 1320, 1310, 'triangle', 0.4); },
  hurt: (A, pos, t) => { const o = A.out(null, 0.6); A.nz(o, t, 0.15, 500, 120, 0.8, 'lowpass', 1); },
  boom: (A, pos, t) => { const o = A.out(pos, 1.6, 10, 300); A.nz(o, t, 1.6, 900, 40, 0.6, 'lowpass', 1); A.osc(o, t, 0.9, 70, 25, 'sine', 1); A.nz(o, t, 0.15, 5000, 1000, 0.5, 'highpass', 0.7); },
  flashbang: (A, pos, t) => { const o = A.out(pos, 1.2, 8, 200); A.nz(o, t, 0.4, 4000, 800, 0.5, 'bandpass', 1); },
  smokeHiss: (A, pos, t) => { const o = A.out(pos, 0.5, 4, 60); A.nz(o, t, 3, 5000, 2500, 0.4, 'highpass', 0.4, 0.2); },
  fire: (A, pos, t) => { const o = A.out(pos, 0.8, 4, 60); A.nz(o, t, 1.2, 1200, 300, 0.6, 'lowpass', 0.9, 0.05); },
  bounce: (A, pos, t) => { const o = A.out(pos, 0.4, 2, 40); A.osc(o, t, 0.08, 900 + Math.random() * 400, 500, 'triangle', 0.4); },
  pin: (A, pos, t) => { const o = A.out(pos, 0.4, 1, 20); A.osc(o, t, 0.05, 3000, 2500, 'square', 0.2); A.nz(o, t + 0.05, 0.05, 4000, 2000, 2, 'bandpass', 0.5); },
  ring: (A, pos, t, o) => { const out = A.out(null, 0.25); A.osc(out, t, o.dur || 3, 3600, 3500, 'sine', 0.25); },
  roundStart: (A, pos, t) => { const o = A.out(null, 0.5); [523, 659, 784].forEach((f, i) => A.osc(o, t + i * 0.12, 0.35, f, f, 'triangle', 0.45)); },
  roundWin: (A, pos, t) => { const o = A.out(null, 0.5); [523, 659, 784, 1046].forEach((f, i) => A.osc(o, t + i * 0.13, 0.5, f, f, 'triangle', 0.4)); },
  roundLose: (A, pos, t) => { const o = A.out(null, 0.5); [392, 349, 311].forEach((f, i) => A.osc(o, t + i * 0.18, 0.5, f, f * 0.98, 'triangle', 0.4)); },
  ui: (A, pos, t) => { const o = A.out(null, 0.3); A.osc(o, t, 0.05, 1200, 1500, 'sine', 0.4); },
  uiBack: (A, pos, t) => { const o = A.out(null, 0.3); A.osc(o, t, 0.06, 900, 700, 'sine', 0.4); },
  heart: (A, pos, t) => { const o = A.out(null, 0.5); A.osc(o, t, 0.12, 60, 40, 'sine', 0.8); A.osc(o, t + 0.18, 0.1, 55, 38, 'sine', 0.6); },
};
