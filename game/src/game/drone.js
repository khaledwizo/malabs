// درون استطلاع: تطيّره 30 ثانية بسرعة وتحكّم، صوت مراوح، وكل عدو يدخل كاميرته ينكشف لك على الخريطة
// (مرئي عندك بس — ما يدخل المحاكاة). مرّة كل 60 ثانية.
import * as THREE from 'three';
import { Audio } from '../core/audio.js';

export const DRONE_TIME = 30, DRONE_CD = 60, DRONE_RANGE = 85;

export class Drone {
  constructor(game) { this.g = game; this.on = false; this.cdUntil = -1; this.seen = new Map(); this.marks = []; }
  get ready() { return !this.on && this.g.t >= this.cdUntil; }
  get cdLeft() { return Math.max(0, this.cdUntil - this.g.t); }
  start() {
    const g = this.g, me = g.mp; if (!me || !me.alive || !this.ready) return false;
    this.on = true; this.t = 0; this.home = me.pos.slice();
    this.pos = new THREE.Vector3(me.pos[0], me.pos[1] + 3.2, me.pos[2]); this.vel = new THREE.Vector3();
    this.yaw = g.yaw; this.pitch = -0.35; this.tilt = 0;
    Audio.droneStart && Audio.droneStart(); document.body.classList.add('drone');
    return true;
  }
  stop() {
    if (!this.on) return; this.on = false; this.cdUntil = this.g.t + DRONE_CD;
    Audio.droneStop && Audio.droneStop(); document.body.classList.remove('drone');
    for (const m of this.marks) m.visible = false;
  }
  // تحكّم: الجويستك يحرّك، السحب يلفّ الكاميرا، القفز يصعد والانحناء ينزل
  control(dt, mx, mz, up, down, lx, ly) {
    this.yaw -= lx; this.pitch = Math.max(-1.45, Math.min(0.5, this.pitch - ly));
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw), SP = 15;
    const want = new THREE.Vector3((fx * mz + rx * mx) * SP, ((up ? 1 : 0) - (down ? 1 : 0)) * 7, (fz * mz + rz * mx) * SP);
    this.vel.lerp(want, Math.min(1, dt * 3));
    this.tilt += ((-mx * 0.25) - this.tilt) * Math.min(1, dt * 4);
    const W = this.g.world, p = this.pos, n = p.clone().addScaledVector(this.vel, dt);
    // ما يدخل بالجدران، ويبقى ضمن مدى الإشارة والارتفاع
    if (W.overlap(n.x, n.y - 0.25, p.z, 0.3, 0.5)) { n.x = p.x; this.vel.x = 0; }
    if (W.overlap(n.x, n.y - 0.25, n.z, 0.3, 0.5)) { n.z = p.z; this.vel.z = 0; }
    if (W.overlap(n.x, n.y - 0.25, n.z, 0.3, 0.5)) { n.y = p.y; this.vel.y = 0; }
    n.y = Math.max(1.2, Math.min(42, n.y));
    const hx = n.x - this.home[0], hz = n.z - this.home[2], hd = Math.hypot(hx, hz);
    if (hd > DRONE_RANGE) { n.x = this.home[0] + hx / hd * DRONE_RANGE; n.z = this.home[2] + hz / hd * DRONE_RANGE; }
    p.copy(n);
    Audio.droneSet && Audio.droneSet(this.vel.length() / SP, p);
  }
  update(dt) {
    const g = this.g, me = g.mp;
    if (this.on) {
      this.t += dt;
      if (this.t >= DRONE_TIME || !me || !me.alive) { this.stop(); g.ui && g.ui.toast('رجع الدرون'); return; }
      this.scan();
    }
    // علامات الأعداء المكشوفين (حمراء فوق رؤوسهم) — بالدرون بس
    let i = 0; const now = g.t;
    if (this.on && g.sim) for (const [id, t] of this.seen) { if (now - t > 8) continue; const q = g.sim.players.get(id); if (!q || !q.alive) continue; const m = this.mark(i++); m.position.set(q.pos[0], q.pos[1] + 2.4, q.pos[2]); m.visible = true; }
    for (; i < this.marks.length; i++) this.marks[i].visible = false;
  }
  mark(i) {
    if (!this.marks[i]) {
      if (!this.tex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#ff3a2a'; x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.moveTo(32, 58); x.lineTo(8, 22); x.lineTo(56, 22); x.closePath(); x.fill(); x.stroke(); this.tex = new THREE.CanvasTexture(c); }
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true, fog: false })); s.scale.set(0.9, 0.9, 1); s.renderOrder = 10; this.g.scene.add(s); this.marks[i] = s;
    }
    return this.marks[i];
  }
  // كشف: عدو بمجال الكاميرا (حوالي 70°) وعلى بعد أقل من 55م وبلا جدار بالنص
  scan() {
    const g = this.g, me = g.mp, sim = g.sim; if (!sim || !me) return;
    const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    for (const q of sim.players.values()) {
      if (!q.alive || q.team === me.team) continue;
      const dx = q.pos[0] - this.pos.x, dy = q.pos[1] + 1.2 - this.pos.y, dz = q.pos[2] - this.pos.z, d = Math.hypot(dx, dy, dz);
      if (d > 55 || (dx * f.x + dy * f.y + dz * f.z) / d < 0.82) continue;
      if (!g.world.los(this.pos.x, this.pos.y, this.pos.z, q.pos[0], q.pos[1] + 1.2, q.pos[2])) continue;
      if (!this.seen.has(q.id) || g.t - this.seen.get(q.id) > 8) Audio.play('hitmark');
      this.seen.set(q.id, g.t);
    }
  }
  applyCamera(cam) { cam.position.copy(this.pos); cam.rotation.set(this.pitch, this.yaw, this.tilt, 'YXZ'); }
}
