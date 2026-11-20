// حلقة الإطارات: غير محدودة (MessageChannel) أو تزامن الشاشة (rAF) أو حدّ ثابت
import { Settings } from './settings.js';

export const Loop = {
  cb: null, running: false, last: 0, mc: null, raf: 0, timer: 0,
  fps: 0, ms: 0, frames: 0, acc: 0, low1: 0, worst: 0,
  start(cb) {
    this.cb = cb; this.running = true; this.last = performance.now();
    if (!this.mc) {
      this.mc = new MessageChannel();
      this.mc.port1.onmessage = () => this.tick();
    }
    this.schedule();
  },
  stop() { this.running = false; cancelAnimationFrame(this.raf); clearTimeout(this.timer); },
  schedule() {
    if (!this.running) return;
    const cap = +Settings.fps;
    if (document.hidden) { this.timer = setTimeout(() => this.tick(), 250); return; }
    if (cap === 0) { this.raf = requestAnimationFrame(() => this.tick()); return; }
    if (cap < 0) { this.mc.port2.postMessage(0); return; }
    const target = 1000 / cap, wait = this.last + target - performance.now();
    if (wait > 2) this.timer = setTimeout(() => this.tick(), wait - 1.5);
    else if (wait > 0) this.mc.port2.postMessage(0);
    else this.tick();
  },
  tick() {
    if (!this.running) return;
    const cap = +Settings.fps, now = performance.now();
    if (cap > 0 && now - this.last < 1000 / cap - 0.3) { this.mc.port2.postMessage(0); return; }
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.frames++; this.acc += dt; this.worst = Math.max(this.worst, dt);
    if (this.acc >= 0.5) { this.fps = this.frames / this.acc; this.ms = this.acc / this.frames * 1000; this.low1 = 1 / this.worst; this.frames = 0; this.acc = 0; this.worst = 0; }
    try { this.cb(dt, now); } catch (e) { console.error(e); }
    this.schedule();
  },
};
