// ===================== حلقة اللعبة: غير محدودة / VSync / حدّ مخصص =====================
// غير محدود: نستخدم MessageChannel ليعمل الإطار التالي فوراً دون انتظار تحديث الشاشة،
// مع إعطاء المتصفح فرصة لمعالجة اللمس والرسم بين الإطارات.
const Loop = {
  cap: 0, running: false, token: 0, port: null, onFrame: null,
  last: 0, frameStart: 0,
  // إحصاءات
  frames: 0, winStart: 0, cpuAcc: 0, worst: 0, fps: 0, ms: 0, cpu: 0, low: 0, total: 0,
  hz: 0,
  init(onFrame) {
    this.onFrame = onFrame;
    const mc = new MessageChannel();
    mc.port1.onmessage = e => { if (e.data === this.token) this.tick(); };
    this.port = mc.port2;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.stop(); Sound.suspend(); }
      else { this.start(); Sound.resume(); }
    });
    this.measureHz();
  },
  start() {
    if (this.running) return;
    this.running = true; this.token++;
    this.last = this.frameStart = this.winStart = performance.now();
    this.frames = 0; this.cpuAcc = 0; this.worst = 0;
    this.schedule();
  },
  stop() { this.running = false; this.token++; },
  setCap(c) {
    this.cap = c;
    if (this.running) { this.token++; this.frameStart = performance.now(); this.schedule(); }
  },
  schedule() {
    const tok = this.token;
    if (this.cap === -1) { requestAnimationFrame(() => { if (tok === this.token) this.tick(); }); return; }
    if (this.cap === 0) { this.port.postMessage(tok); return; }
    const wait = this.frameStart + 1000 / this.cap - performance.now();
    if (wait > 2) setTimeout(() => { if (tok === this.token) this.port.postMessage(tok); }, wait - 1.2);
    else this.port.postMessage(tok);
  },
  tick() {
    if (!this.running) return;
    let t = performance.now();
    if (this.cap > 0) {
      const iv = 1000 / this.cap;
      if (t < this.frameStart + iv - 0.2) { this.port.postMessage(this.token); return; } // انتظار دقيق
      this.frameStart = (t - this.frameStart > iv * 2) ? t : this.frameStart + iv;
    } else this.frameStart = t;
    const rawDt = (t - this.last) / 1000;
    this.last = t;
    const dt = Math.min(rawDt, 0.1);
    const c0 = performance.now();
    try { this.onFrame(dt, t); } catch (err) { console.error(err); }
    const c1 = performance.now();
    this.frames++; this.total++;
    this.cpuAcc += c1 - c0;
    if (rawDt > this.worst) this.worst = rawDt;
    const win = c1 - this.winStart;
    if (win >= 400) {
      this.fps = this.frames * 1000 / win;
      this.ms = win / this.frames;
      this.cpu = this.cpuAcc / this.frames;
      this.low = this.worst > 0 ? 1 / this.worst : 0;
      this.frames = 0; this.cpuAcc = 0; this.worst = 0; this.winStart = c1;
    }
    this.schedule();
  },
  // تقدير تردد الشاشة بقياس فواصل requestAnimationFrame
  measureHz() {
    const ts = [];
    const f = t => {
      ts.push(t);
      if (ts.length < 50) requestAnimationFrame(f);
      else {
        const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
        d.sort((a, b) => a - b);
        const med = d[d.length >> 1];
        if (med > 0) this.hz = Math.round(1000 / med);
      }
    };
    requestAnimationFrame(f);
  },
};
