// حلقة الإطارات: غير محدودة (MessageChannel) أو تزامن الشاشة (rAF) أو حدّ ثابت
import { fpsCap } from './settings.js';

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
  // كل الإطارات على تزامن الشاشة (rAF): «غير محدود» = أقصى تحديث تدعمه الشاشة (90/120 هرتز)،
  // والحدود الأقل نتخطّى بيها إطارات. الرسم خارج تزامن الشاشة يكدّس شغل المعالج الرسومي ويسبّب تعليق وتأخير باللمس.
  schedule() {
    if (!this.running) return;
    if (document.hidden) { this.timer = setTimeout(() => this.tick(), 250); return; }
    this.raf = requestAnimationFrame(t => this.tick(t));
  },
  tick(ts) {
    if (!this.running) return;
    const cap = fpsCap(), now = ts || performance.now();
    // نسمح بهامش 2.5م.ث حتى ما نطيّح إطار كامل بسبب ارتجاف التوقيت (مثلاً 60 على شاشة 60)
    if (cap > 0 && now - this.last < 1000 / cap - 2.5) { this.schedule(); return; }
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.frames++; this.acc += dt; this.worst = Math.max(this.worst, dt);
    if (this.acc >= 0.5) { this.fps = this.frames / this.acc; this.ms = this.acc / this.frames * 1000; this.low1 = 1 / this.worst; this.frames = 0; this.acc = 0; this.worst = 0; }
    try { this.cb(dt, now); } catch (e) { console.error(e); }
    this.schedule();
  },
};
