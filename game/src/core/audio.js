// أصوات إجرائية بالكامل (WebAudio): طلقات، خطوات حسب الأرضية، انفجارات، رعد ومطر وأجواء رعب — مع موضع ثلاثي الأبعاد
import { Settings } from './settings.js';
import { composeArabic } from './music.js';

export const Audio = {
  ctx: null, master: null, sfx: null, amb: null, noise: null, listener: null, live: 0, steps: null, ambKind: '', ambNodes: [],
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; } // iOS: «interrupted» بعد الرجوع للتطبيق
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = Settings.volume; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(comp);
    this.amb = c.createGain(); this.amb.gain.value = 0.55; this.amb.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = 0; this.mus.connect(this.master);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    const bb = c.createBuffer(1, len, c.sampleRate), bd = bb.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brown = bb;
    this.listener = c.listener;
    this.buildSteps();
    this.buildRain();
    this.setAmbience(this.wantAmb || 'day');
    setTimeout(() => this.startMusic(), 400);
  },
  setVolume(v) { if (this.master) this.master.gain.value = v; },
  // الموسيقى: أعلى في القوائم، خافتة أثناء القتال
  setMusic(v) { this.musV = v; this.applyMusic(); },
  musicMode(m) { this.musM = m; this.applyMusic(); },
  applyMusic() { if (!this.mus) return; const v = this.introOn ? 0 : (this.musV ?? Settings.music) * (this.musM === 'game' ? 0.22 : this.musM === 'intro' ? 0 : 0.6); this.mus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.8); },
  // بعد المقدّمة: الموسيقى تبدأ من أولها
  restartMusic() { if (this.musSrc) { try { this.musSrc.stop(); } catch (e) { } this.musSrc = null; } if (this.mus) this.mus.gain.cancelScheduledValues(this.ctx.currentTime), this.mus.gain.setValueAtTime(0, this.ctx.currentTime); this.startMusic(); },
  startMusic() {
    if (this.musSrc || !this.ctx) return;
    try {
      const c = this.ctx; let b = this.musBuf;
      if (!b) { const m = composeArabic(11); b = this.musBuf = c.createBuffer(2, m.L.length, m.sr); b.copyToChannel(m.L, 0); b.copyToChannel(m.R, 1); }
      // صدى قاعة (رجع صوتي مولّد)
      const ir = c.createBuffer(2, Math.floor(c.sampleRate * 2.2), c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2) * 0.35; }
      const conv = c.createConvolver(); conv.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.32; conv.connect(wet); wet.connect(this.mus);
      const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.connect(this.mus); s.connect(conv); s.start();
      this.musSrc = s; this.applyMusic();
    } catch (e) { console.warn('music', e); }
  },
  // حلقة مطر واقعية: «شششش» ضوضاء مشكّلة تتنفّس ببطء + آلاف ارتطامات القطرات (ضوضاء قصيرة لا نغمات)
  // + قطرات قليلة تسقط بالبرك (فقاعة صاعدة النغمة) + غسيل منخفض خفيف — بلا طنين ولا رنين صناعي
  buildRain() {
    const c = this.ctx, sr = 22050, { L, R, n } = rainSamples(sr, 7);
    const buf = c.createBuffer(2, n, sr); buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
    this.rainBuf = buf;
  },
  // تحت سقف: صوت المطر مكتوم
  setRainCover(k) { if (this.rainNode) this.rainNode.f.frequency.setTargetAtTime(k > 0.5 ? 750 : 9000, this.ctx.currentTime, 0.25); },
  setRainLevel(v) { if (this.rainNode) this.rainNode.g.gain.setTargetAtTime(v, this.ctx.currentTime, 1.5); },
  setListener(x, y, z, fx, fy, fz) {
    const L = this.listener; if (!L) return;
    if (L.positionX) { L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z; L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(x, y, z); L.setOrientation(fx, fy, fz, 0, 1, 0); }
    this.lx = x; this.ly = y; this.lz = z;
  },
  out(pos, gain = 1, ref = 4, maxD = 120) {
    const c = this.ctx, g = c.createGain(); g.gain.value = gain;
    if (pos) {
      const p = c.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = maxD; p.rolloffFactor = 1.1;
      if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; } else p.setPosition(pos[0], pos[1], pos[2]);
      g.connect(p); p.connect(this.sfx);
      const d = Math.hypot(pos[0] - (this.lx || 0), pos[1] - (this.ly || 0), pos[2] - (this.lz || 0));
      if (d > 25) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(700, 9000 - d * 70); g.disconnect(); g.connect(lp); lp.connect(p); }
    } else g.connect(this.sfx);
    return g;
  },
  nz(dest, t, dur, f0, f1, q = 0.8, type = 'bandpass', vol = 1, attack = 0.002, buf) {
    const c = dest.context, s = c.createBufferSource(); s.buffer = buf || this.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  osc(dest, t, dur, f0, f1, type = 'sine', vol = 1, attack = 0) {
    const c = dest.context, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  },
  // همهمة كلام بشري (حين لا يتوفّر محرّك نطق عربي): مقاطع بنبرة صوتية ومرشّحات حروف العلّة وتنغيم الجملة
  babble(pos, dur, pitch = 1, vol = 0.8) {
    if (!this.ctx) return; const c = this.ctx, t0 = c.currentTime + 0.02, end = t0 + dur;
    const out = this.out(pos, 0.5 * vol, 2.5, 30); this.babbles = this.babbles || []; this.babbles.push(out); setTimeout(() => { const i = this.babbles.indexOf(out); if (i >= 0) this.babbles.splice(i, 1); }, (dur + 0.6) * 1000);
    const V = [[730, 1090], [270, 2290], [300, 870], [530, 1840], [570, 840], [440, 1020]], f0 = 118 * pitch;
    let t = t0;
    while (t < end - 0.09) {
      if (Math.random() < 0.16) { t += 0.07 + Math.random() * 0.12; continue; }
      const sl = 0.08 + Math.random() * 0.09, pr = (t - t0) / dur, into = 1 + 0.12 * Math.sin(pr * Math.PI) - 0.1 * pr + (Math.random() - 0.5) * 0.08, v = V[(Math.random() * V.length) | 0];
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * into, t); o.frequency.linearRampToValueAtTime(f0 * into * (0.94 + Math.random() * 0.1), t + sl);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.018); g.gain.setValueAtTime(0.5, t + sl * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + sl);
      const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = v[0]; f1.Q.value = 5;
      const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = v[1]; f2.Q.value = 7;
      const m2 = c.createGain(); m2.gain.value = 0.45;
      o.connect(g); g.connect(f1); g.connect(f2); f1.connect(out); f2.connect(m2); m2.connect(out); o.start(t); o.stop(t + sl + 0.02);
      if (Math.random() < 0.55) this.nz(out, t, 0.035, 3000 + Math.random() * 3000, 2000, 1.5, 'bandpass', 0.16, 0.003);
      t += sl;
    }
  },
  stopBabble() { if (!this.ctx) return; for (const o of this.babbles || []) { try { o.gain.cancelScheduledValues(this.ctx.currentTime); o.gain.setValueAtTime(0, this.ctx.currentTime); } catch (e) { } } this.babbles = []; },
  play(name, pos, opt = {}) {
    if (!this.ctx || this.live > 56) return;
    this.live++; setTimeout(() => this.live--, 600);
    const c = this.ctx, t = c.currentTime, self = !pos;
    const S = SOUNDS[name]; if (S) S(this, pos, t, opt, self);
  },
  // ---------- الخطوات: تُحضّر مسبقاً بعدة تنويعات لكل أرضية ----------
  buildSteps() {
    const c = this.ctx, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return;
    const sr = 22050, kinds = ['stone', 'wood', 'sand', 'wet', 'metal', 'cloth'];
    this.steps = {};
    const nb = (oc) => { const b = oc.createBuffer(1, sr, sr), d = b.getChannelData(0); for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1; return b; };
    for (const k of kinds) {
      this.steps[k] = [];
      for (let v = 0; v < 6; v++) {
        const oc = new OAC(1, Math.floor(sr * 0.32), sr), N = nb(oc), dest = oc.destination, t = 0.005;
        const nz = (dur, f0, f1, q, type, vol, att = 0.003, at = t) => this.nz(dest, at, dur, f0, f1, q, type, vol, att, N);
        const os = (dur, f0, f1, type, vol, at = t) => this.osc(dest, at, dur, f0, f1, type, vol);
        const j = 0.85 + Math.random() * 0.3;
        // خطوات ناعمة: كعب ثم مقدّمة القدم، ترددات منخفضة بلا طقطقة حادة
        const heel = t, toe = t + 0.045 + Math.random() * 0.02;
        if (k === 'stone') { nz(0.09 * j, 520 * j, 160, 0.7, 'lowpass', 0.75, 0.006, heel); nz(0.06, 1300 * j, 700, 0.6, 'bandpass', 0.16, 0.008, heel + 0.004); nz(0.07, 420 * j, 150, 0.7, 'lowpass', 0.45, 0.006, toe); nz(0.05, 2400, 1500, 0.5, 'bandpass', 0.05, 0.01, toe); }
        else if (k === 'wood') { nz(0.11 * j, 380 * j, 180, 1.6, 'bandpass', 0.8, 0.006, heel); nz(0.08, 300 * j, 150, 1.6, 'bandpass', 0.45, 0.006, toe); if (Math.random() < 0.4) os(0.12, 190 * j, 170, 'sine', 0.06, toe + 0.03); }
        else if (k === 'sand') { for (let g = 0; g < 18; g++) nz(0.006 + Math.random() * 0.008, 2600, 1400, 0.6, 'lowpass', 0.12 + Math.random() * 0.14, 0.002, heel + Math.random() * 0.13); nz(0.08, 380, 140, 0.7, 'lowpass', 0.5, 0.008, heel); }
        else if (k === 'wet') { nz(0.08 * j, 460 * j, 150, 0.7, 'lowpass', 0.6, 0.006, heel); nz(0.18, 2200, 1200, 0.6, 'bandpass', 0.16, 0.025, heel + 0.01); nz(0.12, 1600, 900, 0.6, 'bandpass', 0.1, 0.02, toe); }
        else if (k === 'metal') { nz(0.07, 700 * j, 300, 1, 'bandpass', 0.6, 0.005, heel); os(0.16, 1400 * j, 1350, 'sine', 0.04, heel); nz(0.05, 600, 260, 1, 'bandpass', 0.35, 0.005, toe); }
        else { nz(0.1, 380 * j, 140, 0.7, 'lowpass', 0.45, 0.01, heel); }
        oc.startRendering().then(b => this.steps[k].push(b)).catch(() => { });
      }
    }
  },
  // surf: رقم المادة من التصادم أو 'wet'
  step(pos, run, surf, crouch) {
    if (!this.ctx || !this.steps) return;
    const map = { 0: 'stone', 1: 'stone', 2: 'wood', 3: 'metal', 4: 'stone', 5: 'sand', 6: 'cloth', 7: 'stone', 8: 'wet', 9: 'stone' };
    const k = surf === 'wet' ? 'wet' : (map[surf] || 'stone'), L = this.steps[k]; if (!L || !L.length) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = L[Math.floor(Math.random() * L.length)];
    s.playbackRate.value = (run ? 1.05 : 0.95) * (0.92 + Math.random() * 0.16);
    const vol = (pos ? 0.6 : 0.17) * (run ? 1.0 : 0.6) * (crouch ? 0.35 : 1) * (0.85 + Math.random() * 0.3);
    const o = this.out(pos, vol, pos ? 2.5 : 1, 28); s.connect(o); s.start();
    if (run && Math.random() < 0.25) this.nz(o, c.currentTime, 0.14, 1400, 800, 0.5, 'bandpass', 0.05, 0.03); // حفيف الملابس
  },
  // ---------- الأجواء حسب الطقس ----------
  setAmbience(kind) {
    this.wantAmb = kind;
    if (!this.ctx || this.ambKind === kind) return;
    this.ambKind = kind;
    const c = this.ctx, t = c.currentTime;
    for (const n of this.ambNodes) { try { n.g.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => { try { n.s.stop(); } catch (e) { } }, 3000); } catch (e) { } }
    this.ambNodes = []; this.rainNode = null;
    clearTimeout(this.ambTimer);
    const loop = (buf, type, f, q, vol, rate = 1) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.setTargetAtTime(vol, t, 1.2);
      s.connect(fl); fl.connect(g); g.connect(this.amb); s.start(); this.ambNodes.push({ s, g, f: fl }); return { s, g, f: fl };
    };
    if (kind === 'menu' || kind === 'day' || kind === 'sunset') {
      loop(this.brown, 'lowpass', 480, 0.7, 0.35); // نسيم هادئ فقط (أُزيلت زقزقة الطيور المصطنعة)
    } else if (kind === 'storm') {
      this.rainNode = loop(this.rainBuf || this.noise, 'lowpass', 9000, 0.5, 0.9);
      const wind = loop(this.brown, 'bandpass', 380, 0.9, 0.3);
      const gust = () => { if (this.ambKind !== kind) return; const t = c.currentTime; wind.f.frequency.setTargetAtTime(250 + Math.random() * 500, t, 1.5); wind.g.gain.setTargetAtTime(0.25 + Math.random() * 0.5, t, 1.2); this.ambTimer = setTimeout(gust, 2000 + Math.random() * 3000); };
      gust();
    } else if (kind === 'horror') {
      loop(this.brown, 'lowpass', 220, 0.7, 0.4);
      this.rainNode = loop(this.rainBuf || this.noise, 'lowpass', 9000, 0.5, 0.3);
      const howl = loop(this.noise, 'bandpass', 600, 8, 0.07, 0.5);
      // طنين منخفض مزعج
      const drone = (f, v) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.setTargetAtTime(v, t, 3); o.connect(lp); lp.connect(g); g.connect(this.amb); o.start(); this.ambNodes.push({ s: o, g }); };
      drone(41, 0.03); drone(43.3, 0.025);
      const ev = () => {
        if (this.ambKind !== kind) return; const t = c.currentTime, r = Math.random();
        howl.f.frequency.setTargetAtTime(400 + Math.random() * 900, t, 2);
        if (r < 0.3) SOUNDS.crow(this, this.randPos(30), t, {});
        else if (r < 0.5) SOUNDS.wail(this, this.randPos(45), t, {});
        else if (r < 0.62) SOUNDS.creak(this, this.randPos(14), t, {});
        else if (r < 0.7) SOUNDS.whisper(this, this.randPos(6), t, {});
        this.ambTimer = setTimeout(ev, 5000 + Math.random() * 9000);
      };
      this.ambTimer = setTimeout(ev, 4000);
    }
  },
  randPos(r) { const a = Math.random() * Math.PI * 2; return [(this.lx || 0) + Math.cos(a) * r, (this.ly || 0) + 2 + Math.random() * 6, (this.lz || 0) + Math.sin(a) * r]; },
  thunder(dist) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + dist / 343, o = this.out(null, Math.min(1.6, 60 / Math.max(30, dist)));
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(260, 2400 - dist * 2.2); lp.connect(o);
    if (dist < 400) this.nz(lp, t, 0.25, 5000, 1200, 0.5, 'highpass', 0.9, 0.003);
    this.nz(lp, t + 0.05, 2.8 + Math.random(), 700, 60, 0.6, 'lowpass', 1, 0.08, this.brown);
    this.osc(lp, t + 0.05, 1.6, 55, 28, 'sine', 0.9, 0.05);
    for (let k = 0; k < 3; k++) this.nz(lp, t + 0.4 + k * (0.4 + Math.random() * 0.5), 1.2, 400, 60, 0.6, 'lowpass', 0.6, 0.1, this.brown);
  },
};

// مكتبة الأصوات
const gun = (base, body, crack, tail, vol) => (A, pos, t, o, self) => {
  const out = A.out(pos, vol * (self ? 0.7 : 1), 6, 220);
  A.nz(out, t, 0.06, 6000, 1500, 0.6, 'highpass', 1.0 * crack);
  A.nz(out, t, body, base * 3, base, 0.9, 'lowpass', 1.0);
  A.osc(out, t, body * 0.9, base, base * 0.4, 'triangle', 0.6);
  A.nz(out, t + 0.02, tail, 900, 200, 0.5, 'lowpass', 0.25);
  if (!self) A.nz(out, t + 0.12, tail * 1.4, 600, 120, 0.4, 'lowpass', 0.12, 0.05); // صدى الأزقة
};
const SOUNDS = {
  rifle: gun(170, 0.14, 0.9, 0.5, 0.9), rifleHeavy: gun(130, 0.18, 1, 0.65, 1), smg: gun(220, 0.1, 0.7, 0.35, 0.7), smgHeavy: gun(185, 0.12, 0.8, 0.4, 0.8),
  shotgun: gun(95, 0.26, 1, 0.8, 1.1), sniper: gun(90, 0.32, 1.2, 1.2, 1.25), sniperSemi: gun(110, 0.24, 1.1, 0.9, 1.1),
  pistol: gun(260, 0.08, 0.7, 0.3, 0.6), pistolHeavy: gun(150, 0.15, 1, 0.55, 0.95), revolver: gun(140, 0.17, 1.05, 0.6, 1),
  suppressed: (A, pos, t, o, self) => { const out = A.out(pos, self ? 0.5 : 0.6, 2, 40); A.nz(out, t, 0.09, 1800, 500, 0.8, 'lowpass', 0.9, 0.003); A.nz(out, t, 0.03, 4000, 2500, 1, 'bandpass', 0.35); A.osc(out, t, 0.05, 220, 120, 'triangle', 0.25); },
  knife: (A, pos, t) => { const o = A.out(pos, 0.5); A.nz(o, t, 0.18, 2500, 6000, 1.2, 'bandpass', 0.6, 0.04); },
  knifeHit: (A, pos, t) => { const o = A.out(pos, 0.8); A.nz(o, t, 0.12, 600, 200, 1, 'lowpass', 1); },
  dry: (A, pos, t) => { const o = A.out(pos, 0.4); A.osc(o, t, 0.03, 1800, 1200, 'square', 0.4); },
  reload: (A, pos, t) => { const o = A.out(pos, 0.5, 2, 30); A.nz(o, t, 0.05, 3000, 1500, 2, 'bandpass', 0.5); A.nz(o, t + 0.45, 0.06, 2000, 900, 2, 'bandpass', 0.6); A.nz(o, t + 0.9, 0.08, 2500, 1200, 3, 'bandpass', 0.8); },
  bolt: (A, pos, t) => { const o = A.out(pos, 0.5, 2, 30); A.nz(o, t, 0.07, 2000, 800, 2, 'bandpass', 0.6); A.nz(o, t + 0.25, 0.07, 2600, 1200, 2, 'bandpass', 0.7); },
  pump: (A, pos, t) => { const o = A.out(pos, 0.6, 2, 30); A.nz(o, t, 0.08, 1500, 600, 2, 'bandpass', 0.8); A.nz(o, t + 0.18, 0.09, 1900, 800, 2, 'bandpass', 0.9); },
  draw: (A, pos, t) => { const o = A.out(pos, 0.35, 2, 25); A.nz(o, t, 0.08, 3500, 1800, 1.5, 'bandpass', 0.5); },
  land: (A, pos, t) => { const o = A.out(pos, 0.6, 2, 40); A.nz(o, t, 0.12, 500, 80, 0.7, 'lowpass', 1); },
  impact: (A, pos, t, o) => { const out = A.out(pos, 0.35, 2, 40); const m = o.mat; if (m === 3) A.osc(out, t, 0.12, 3000 + Math.random() * 1500, 1500, 'sine', 0.35); A.nz(out, t, 0.06, m === 2 ? 1400 : 2600, 500, 1, 'bandpass', 0.9); },
  flesh: (A, pos, t) => { const o = A.out(pos, 0.7, 2, 40); A.nz(o, t, 0.09, 900, 260, 1, 'lowpass', 1); A.nz(o, t + 0.01, 0.06, 2400, 900, 2, 'bandpass', 0.3); },
  // تحطّم الأشياء: خشب يتشظّى، فخّار يتكسّر، حجر يتفتّت
  breakWood: (A, pos, t) => { const o = A.out(pos, 0.9, 3, 60); A.nz(o, t, 0.16, 1400, 300, 1.2, 'bandpass', 1, 0.002); for (let k = 0; k < 6; k++) A.nz(o, t + 0.03 + k * 0.035 + Math.random() * 0.02, 0.05, 2200 + Math.random() * 1500, 700, 4, 'bandpass', 0.45 - k * 0.05, 0.002); A.nz(o, t + 0.2, 0.25, 500, 120, 0.8, 'lowpass', 0.5, 0.01); },
  breakClay: (A, pos, t) => { const o = A.out(pos, 0.8, 3, 50); A.nz(o, t, 0.06, 3200, 1600, 2.5, 'bandpass', 1, 0.001); for (let k = 0; k < 9; k++) A.nz(o, t + 0.05 + k * 0.03 + Math.random() * 0.03, 0.035, 3500 + Math.random() * 2500, 1800, 6, 'bandpass', 0.4 - k * 0.03, 0.001); },
  // زجاج فانوس ينكسر: صدمة حادّة ثم شظايا ترنّ وتتساقط، وطشّة شرارة خفيفة
  breakGlass: (A, pos, t) => { const o = A.out(pos, 0.85, 3, 55); A.nz(o, t, 0.05, 5200, 2600, 1.8, 'highpass', 1, 0.0005); for (let k = 0; k < 14; k++) { const d = 0.03 + k * 0.035 + Math.random() * 0.05; A.osc(o, t + d, 0.05 + Math.random() * 0.06, 3800 + Math.random() * 4200, 3600 + Math.random() * 3800, 'sine', 0.18 - k * 0.01); A.nz(o, t + d, 0.02, 6000 + Math.random() * 3000, 3000, 8, 'bandpass', 0.25, 0.0005); } A.nz(o, t + 0.02, 0.18, 2600, 1200, 1, 'bandpass', 0.18, 0.003); },
  breakStone: (A, pos, t) => { const o = A.out(pos, 0.9, 3, 60); A.nz(o, t, 0.22, 900, 140, 0.9, 'lowpass', 1, 0.002); for (let k = 0; k < 5; k++) A.nz(o, t + 0.08 + k * 0.06, 0.06, 1600 + Math.random() * 800, 500, 3, 'bandpass', 0.35, 0.002); },
  bodyFall: (A, pos, t) => { const o = A.out(pos, 0.7, 2, 35); A.nz(o, t, 0.18, 420, 70, 0.7, 'lowpass', 1, 0.004); A.nz(o, t + 0.16, 0.1, 300, 60, 0.7, 'lowpass', 0.4, 0.004); },
  // العلاج: تمزيق الضمادة ولفّها، أو نقرة الإبرة وهسيسها
  bandage: (A, pos, t, o, self) => { const out = A.out(pos, self ? 0.32 : 0.5, 1.5, 18); for (let k = 0; k < 3; k++) A.nz(out, t + k * 0.55, 0.32, 3800, 1600, 1.2, 'bandpass', 0.55, 0.03); for (let k = 0; k < 4; k++) A.nz(out, t + 1.5 + k * 0.18, 0.12, 1800, 900, 1, 'bandpass', 0.22, 0.02); },
  syringe: (A, pos, t, o, self) => { const out = A.out(pos, self ? 0.32 : 0.5, 1.5, 18); A.nz(out, t, 0.04, 4200, 3000, 3, 'bandpass', 0.6, 0.001); A.osc(out, t + 0.6, 0.05, 2400, 2100, 'square', 0.08); A.nz(out, t + 0.9, 1.6, 6000, 4000, 1.5, 'highpass', 0.12, 0.2); },
  healed: (A, pos, t) => { const o = A.out(null, 0.28); A.osc(o, t, 0.25, 660, 660, 'sine', 0.35, 0.02); A.osc(o, t + 0.1, 0.35, 990, 990, 'sine', 0.25, 0.02); },
  whizz: (A, pos, t) => { const o = A.out(pos, 0.45, 1, 20); A.nz(o, t, 0.15, 5000, 1500, 3, 'bandpass', 0.7, 0.03); },
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
  go: (A, pos, t) => { const o = A.out(null, 0.55); A.osc(o, t, 0.5, 220, 440, 'sawtooth', 0.12); A.osc(o, t, 0.6, 660, 660, 'triangle', 0.35); A.nz(o, t, 0.4, 300, 80, 0.7, 'lowpass', 0.6); },
  respawn: (A, pos, t) => { const o = A.out(null, 0.4); A.osc(o, t, 0.5, 300, 900, 'sine', 0.3, 0.05); A.nz(o, t, 0.5, 6000, 2000, 0.6, 'highpass', 0.2, 0.1); },
  invite: (A, pos, t) => { const o = A.out(null, 0.5); [784, 988, 1175].forEach((f, i) => A.osc(o, t + i * 0.09, 0.3, f, f, 'sine', 0.35)); },
  roundWin: (A, pos, t) => { const o = A.out(null, 0.5); [523, 659, 784, 1046].forEach((f, i) => A.osc(o, t + i * 0.13, 0.5, f, f, 'triangle', 0.4)); },
  roundLose: (A, pos, t) => { const o = A.out(null, 0.5); [392, 349, 311].forEach((f, i) => A.osc(o, t + i * 0.18, 0.5, f, f * 0.98, 'triangle', 0.4)); },
  ui: (A, pos, t) => { const o = A.out(null, 0.3); A.osc(o, t, 0.05, 1200, 1500, 'sine', 0.4); },
  uiBack: (A, pos, t) => { const o = A.out(null, 0.3); A.osc(o, t, 0.06, 900, 700, 'sine', 0.4); },
  heart: (A, pos, t) => { const o = A.out(null, 0.5); A.osc(o, t, 0.12, 60, 40, 'sine', 0.8); A.osc(o, t + 0.18, 0.1, 55, 38, 'sine', 0.6); },
  // أصوات الرعب
  crow: (A, pos, t) => { const o = A.out(pos, 0.5, 6, 80); for (let k = 0; k < 2 + Math.random() * 2; k++) { const s = t + k * 0.32; A.nz(o, s, 0.22, 1300, 700, 3, 'bandpass', 0.7, 0.02); A.osc(o, s, 0.2, 620, 480, 'sawtooth', 0.08); } },
  wail: (A, pos, t) => { const o = A.out(pos, 0.35, 10, 120); A.osc(o, t, 2.6, 420 + Math.random() * 80, 260, 'sine', 0.22, 0.8); A.osc(o, t + 0.1, 2.4, 630, 400, 'sine', 0.06, 0.9); },
  creak: (A, pos, t) => { const o = A.out(pos, 0.5, 4, 50); for (let k = 0; k < 14; k++) A.nz(o, t + k * 0.04 + Math.random() * 0.02, 0.03, 700, 500, 6, 'bandpass', 0.4, 0.002); },
  whisper: (A, pos, t) => { const o = A.out(pos, 0.25, 2, 20); A.nz(o, t, 1.4, 3200, 2200, 2, 'bandpass', 0.35, 0.4); A.nz(o, t + 0.5, 1.0, 2600, 1800, 2, 'bandpass', 0.25, 0.3); },
  stinger: (A, pos, t) => { const o = A.out(null, 0.5); A.osc(o, t, 1.6, 90, 40, 'sawtooth', 0.25, 0.01); A.nz(o, t, 1.2, 3000, 600, 1, 'bandpass', 0.3, 0.01); A.osc(o, t, 1.2, 1500, 1520, 'sine', 0.08); },
};

// يولّد عيّنات المطر (منفصلة كي تُختبر خارج المتصفح)
export function rainSamples(sr, secs) {
  const N = sr * secs, L = new Float32Array(N), R = new Float32Array(N);
  const one = f => 1 - Math.exp(-2 * Math.PI * f / sr);
  // 1) الهسيس: ضوضاء بيضاء → تمرير عالٍ ~350Hz ثم منخفض ~5.5kHz، بتنفّس بطيء مستقل لكل أذن
  for (const [D, seed] of [[L, 1], [R, 2]]) {
    let lp1 = 0, lp2 = 0, hp = 0, env = 1, envT = 1, k = 0;
    for (let i = 0; i < N; i++) {
      const w = Math.random() * 2 - 1;
      hp += (w - hp) * one(350); const h = w - hp;
      lp1 += (h - lp1) * one(3600); lp2 += (lp1 - lp2) * one(5200);
      if (--k <= 0) { k = Math.floor(sr * (0.25 + Math.random() * 0.5)); envT = 0.8 + Math.random() * 0.4; }
      env += (envT - env) * 0.00008;
      D[i] = lp2 * 0.32 * env;
    }
  }
  // 2) غسيل منخفض خفيف (المطر البعيد على السطوح)
  let br = 0; for (let i = 0; i < N; i++) { br = (br + 0.02 * (Math.random() * 2 - 1)) / 1.02; L[i] += br * 0.35; R[i] += br * 0.35; }
  // 3) ارتطام القطرات: نبضات ضوضاء قصيرة جداً مفلترة (معظمها خافت وقليل منها قريب)
  const drops = Math.floor(secs * 1500);
  for (let k = 0; k < drops; k++) {
    const t0 = Math.floor(Math.random() * (N - 300)), near = Math.random() < 0.06, a = (near ? 0.22 : 0.05) * (0.3 + Math.random()), tau = (near ? 0.0012 : 0.0006) + Math.random() * 0.0012;
    const f = one(900 + Math.random() * (near ? 2000 : 3600)), pan = Math.random(), len = Math.min(300, Math.floor(tau * 7 * sr));
    let y = 0; for (let j = 0; j < len; j++) { y += ((Math.random() * 2 - 1) - y) * f; const v = y * Math.exp(-j / sr / tau) * a; L[t0 + j] += v * (1 - pan * 0.7); R[t0 + j] += v * (0.3 + pan * 0.7); }
  }
  // 4) قطرات بالبرك: فقاعة نغمتها تصعد بسرعة (صوت الماء الحقيقي) — قليلة وخافتة
  for (let k = 0; k < secs * 9; k++) {
    const t0 = Math.floor(Math.random() * (N - 2000)), f0 = 700 + Math.random() * 1300, dur = 0.012 + Math.random() * 0.025, a = 0.018 + Math.random() * 0.03, pan = Math.random(), len = Math.floor(dur * 3 * sr);
    let ph = 0; for (let j = 0; j < len; j++) { const t = j / sr, f = f0 * (1 + 0.9 * Math.min(1, t / dur)); ph += 2 * Math.PI * f / sr; const v = Math.sin(ph) * Math.exp(-t / dur) * a * Math.min(1, j / 20); L[t0 + j] += v * (1 - pan); R[t0 + j] += v * pan; }
  }
  // وصل الحلقة بلا قطع، وتطبيع
  const xf = Math.floor(sr * 0.8), n = N - xf;
  for (let i = 0; i < xf; i++) { const q = i / xf; L[i] = L[i] * q + L[n + i] * (1 - q); R[i] = R[i] * q + R[n + i] * (1 - q); }
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.7 / Math.max(pk, 1e-6); for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  return { L: L.subarray(0, n), R: R.subarray(0, n), n };
}
