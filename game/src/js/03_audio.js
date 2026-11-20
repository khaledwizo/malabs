// ===================== الصوت: مؤثرات مُركّبة + موسيقى توليدية =====================
const Sound = {
  ctx: null, master: null, musicBus: null, sfxBus: null, noiseBuf: null,
  vol: { music: 0.45, sfx: 0.8 }, tension: 0, tensionTarget: 0, last: {}, listener: { x: 0, y: 0 },
  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(comp);
      this.sfxBus = c.createGain(); this.sfxBus.connect(comp);
      const len = c.sampleRate; const b = c.createBuffer(1, len, c.sampleRate); const ch = b.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
      this.setVolumes(this.vol.music, this.vol.sfx);
      this.startMusic();
      this.resume();
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => { }); },
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => { }); },
  setVolumes(m, s) {
    this.vol.music = m; this.vol.sfx = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(m * 0.6, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s, t, 0.05);
  },
  tone(f, dur, type = 'sine', v = 0.15, f2 = 0, delay = 0, bus = null) {
    const c = this.ctx; if (!c || v <= 0.0005) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || this.sfxBus); o.start(t0); o.stop(t0 + dur + 0.03);
  },
  noise(dur, v = 0.15, freq = 1200, type = 'lowpass', f2 = 0, delay = 0, q = 0.8) {
    const c = this.ctx; if (!c || v <= 0.0005) return;
    const t0 = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t0); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  },
  // تشغيل مؤثر مع تخفيف حسب البعد عن المستمع
  at(name, x, y) {
    const d = dist(x, y, this.listener.x, this.listener.y) / T;
    const k = clamp(1.15 - d / 16, 0, 1);
    if (k > 0.03) this.play(name, k);
  },
  play(name, k = 1) {
    if (!this.ctx) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 45) return;
    this.last[name] = now;
    const v = k;
    switch (name) {
      case 'ui': this.tone(880, 0.06, 'square', 0.05 * v); break;
      case 'uiBack': this.tone(520, 0.07, 'square', 0.045 * v, 380); break;
      case 'switch': this.tone(320, 0.05, 'square', 0.09 * v); this.tone(660, 0.05, 'square', 0.06 * v, 0, 0.045); break;
      case 'door': this.noise(0.32, 0.12 * v, 700, 'lowpass', 160); this.tone(95, 0.28, 'sawtooth', 0.05 * v, 60); break;
      case 'push': this.noise(0.14, 0.08 * v, 400, 'lowpass', 200); break;
      case 'pickup': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.08 * v, 0, i * 0.05)); break;
      case 'core': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.09 * v, 0, i * 0.06)); break;
      case 'energy': this.tone(420, 0.18, 'sine', 0.1 * v, 980); break;
      case 'health': this.tone(500, 0.12, 'triangle', 0.1 * v, 760); this.tone(760, 0.18, 'triangle', 0.08 * v, 1000, 0.1); break;
      case 'hurt': this.tone(240, 0.22, 'square', 0.13 * v, 70); this.noise(0.12, 0.1 * v, 2200); break;
      case 'shot': this.tone(950, 0.09, 'sawtooth', 0.05 * v, 320); break;
      case 'tshot': this.tone(1300, 0.06, 'square', 0.04 * v, 500); break;
      case 'alarm': for (let i = 0; i < 2; i++) { this.tone(880, 0.17, 'square', 0.07 * v, 0, i * 0.36); this.tone(620, 0.17, 'square', 0.07 * v, 0, i * 0.36 + 0.18); } break;
      case 'sus': this.tone(640, 0.12, 'sine', 0.05 * v, 920); break;
      case 'emp': this.noise(0.7, 0.24 * v, 3800, 'lowpass', 90); this.tone(130, 0.7, 'sine', 0.28 * v, 38); break;
      case 'dash': this.noise(0.2, 0.13 * v, 1200, 'bandpass', 3200, 0, 1.2); break;
      case 'scan': this.tone(280, 0.7, 'sine', 0.08 * v, 1400); this.tone(560, 0.7, 'sine', 0.04 * v, 2800, 0.05); break;
      case 'decoy': this.tone(1200, 0.07, 'square', 0.045 * v); this.tone(1500, 0.07, 'square', 0.04 * v, 0, 0.09); break;
      case 'decoyPing': this.tone(980, 0.05, 'triangle', 0.035 * v); break;
      case 'cloak': this.tone(1600, 0.45, 'sine', 0.05 * v, 360); this.noise(0.45, 0.04 * v, 5000, 'highpass'); break;
      case 'uncloak': this.tone(360, 0.3, 'sine', 0.05 * v, 1400); break;
      case 'hackOk': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08 * v, 0, i * 0.05)); break;
      case 'hackFail': this.tone(160, 0.45, 'sawtooth', 0.11 * v, 80); break;
      case 'rotate': this.tone(1100, 0.03, 'square', 0.04 * v); break;
      case 'swarm': this.noise(0.12, 0.09 * v, 3200, 'highpass'); this.tone(700, 0.08, 'square', 0.03 * v, 200); break;
      case 'blip': this.tone(rand(620, 920), 0.045, 'triangle', 0.035 * v); break;
      case 'over': this.tone(rand(85, 125), 0.11, 'sawtooth', 0.045 * v, 70); break;
      case 'win': [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.08 * v, 0, i * 0.09)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.06 * v, 0, i * 0.13)); break;
      case 'laser': this.noise(0.08, 0.07 * v, 4200, 'highpass'); break;
      case 'exit': this.tone(330, 0.5, 'triangle', 0.08 * v, 990); this.tone(495, 0.5, 'triangle', 0.06 * v, 1485, 0.08); break;
      case 'check': this.tone(660, 0.12, 'sine', 0.08 * v, 990); this.tone(990, 0.2, 'sine', 0.06 * v, 0, 0.1); break;
      case 'riddle': this.tone(220, 0.5, 'sine', 0.07 * v, 440); break;
      case 'stun': this.noise(0.25, 0.08 * v, 5000, 'highpass', 1500); break;
      case 'explode': this.noise(0.6, 0.2 * v, 1600, 'lowpass', 80); this.tone(80, 0.5, 'sine', 0.2 * v, 30); break;
      case 'chip': [440, 660, 880, 1320, 1760].forEach((f, i) => this.tone(f, 0.16, 'square', 0.04 * v, 0, i * 0.06)); break;
      case 'boss': this.tone(55, 1.2, 'sawtooth', 0.12 * v, 40); this.noise(1.2, 0.08 * v, 300, 'lowpass', 80); break;
      case 'charge': this.tone(200, 0.9, 'sawtooth', 0.05 * v, 900); break;
      case 'step': this.noise(0.035, 0.018 * v, 900); break;
    }
  },
  // ---------------- الموسيقى التوليدية ----------------
  startMusic() {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360; lp.Q.value = 0.7;
    const pad = c.createGain(); pad.gain.value = 0.07;
    [55, 55.35, 82.41, 110.2].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i >= 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = i >= 2 ? 0.5 : 1; o.connect(g); g.connect(lp); o.start();
    });
    lp.connect(pad); pad.connect(this.musicBus);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.045;
    const lfoG = c.createGain(); lfoG.gain.value = 170; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    const dl = c.createDelay(1.0); dl.delayTime.value = 0.43;
    const fb = c.createGain(); fb.gain.value = 0.36; const wet = c.createGain(); wet.gain.value = 0.55;
    dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(this.musicBus);
    this.arpIn = c.createGain(); this.arpIn.gain.value = 1; this.arpIn.connect(this.musicBus); this.arpIn.connect(dl);
    this.tenseBus = c.createGain(); this.tenseBus.gain.value = 0; this.tenseBus.connect(this.musicBus);
    this.nextNote = c.currentTime + 0.3; this.step = 0;
    this.scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
    setInterval(() => this.schedule(), 50);
  },
  note(f, t, dur, type, v, dest, cutoff = 0) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (cutoff) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; o.connect(fl); fl.connect(g); }
    else o.connect(g);
    g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  },
  hat(t, dest) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 7000;
    const g = c.createGain(); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + 0.07);
  },
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    this.tension += (this.tensionTarget - this.tension) * 0.06;
    this.tenseBus.gain.setTargetAtTime(this.tension * 0.5, c.currentTime, 0.25);
    while (this.nextNote < c.currentTime + 0.25) {
      const t = this.nextNote, step = 0.214;
      if (this.step % 2 === 0 && Math.random() < 0.4) {
        const f = pick(this.scale) * (Math.random() < 0.25 ? 2 : 1);
        this.note(f, t, 0.55, 'triangle', 0.045, this.arpIn);
      }
      if (this.tension > 0.03) {
        const bf = (this.step % 16) < 12 ? 55 : 65.41;
        this.note(bf, t, 0.17, 'square', 0.22, this.tenseBus, 420);
        if (this.step % 2 === 1) this.hat(t, this.tenseBus);
      }
      this.nextNote += step; this.step++;
    }
  },
};
