// زوّار مرقد الشيخ فاتح: أربعة يقرؤون الفاتحة رافعين أكفّهم
// - بطور القصة: وقت الأذان يطلعون للمضيف ويصلّون بالصف، وبعد السلام يسبقون الشيخ للمرقد ويقرؤون الفاتحة؛
//   ووقت المحاضرة يروحون يگعدون بالمضيف يسمعون، وبعدها يرجعون
// - بالمعارك: جولة بسيطة بالمدينة دقيقة، ثم يرجعون للمرقد 20 ثانية، ثم يعيدون
import { findPath } from './route.js';
import { walkStep, walkerDoors } from './ambient.js';

const DOOR_OUT = [-50.6, -12], DOOR_IN = [-53.4, -12], SHRINE_OUT = [-73.6, -4], SHRINE_DOOR_IN = [-76.4, -4];
const QIBLA = Math.PI - 0.35, QF = [-Math.sin(QIBLA), -Math.cos(QIBLA)], QR = [Math.cos(QIBLA), -Math.sin(QIBLA)];
// صف ثاني ورا الصف الأول
const slot2 = i => { const k = (i % 2 ? 1 : -1) * Math.ceil((i + 1) / 2); return [-58.4 - QF[0] * 1.3 + QR[0] * k * 0.9, -12 - QF[1] * 1.3 + QR[1] * k * 0.9]; };
const LISTEN = [[-62.2, -8.2], [-61.1, -8.2], [-60.0, -8.2], [-58.9, -8.2]];

export class ShrineFolk {
  constructor(g) { this.g = g; this.list = []; this.on = false; }
  start(lobby) {
    this.stop(); this.lobby = lobby; this.on = true;
    this.list = (this.g.civs || []).map((c, i) => ({ c, i })).filter(o => o.c.n.look === 'pilgrim' && o.c.n.pose === 'pray')
      .map((o, k) => ({ ...o, k, home: [o.c.n.x, o.c.n.z, o.c.n.yaw], st: 'home', t: lobby ? 0 : 12 + k * 7, path: null }));
  }
  stop() { for (const F of this.list || []) this.toHome(F); this.list = []; this.on = false; }
  // يرجع لمكانه بالمرقد رافع إيديه
  toHome(F) {
    const c = F.c, r = c.root; F.path = null; F.st = 'home'; c.tour = false; c.walkSp = 0; c.prayP = null; c.n.pose = 'pray';
    r.position.set(F.home[0], c.n.y, F.home[1]); r.rotation.y = F.home[2];
    const wn = this.g.world.npcs[F.i]; if (wn && wn.box >= 0) this.g.world.restore(wn.box);
  }
  leave(F) { const c = F.c; if (F.st === 'home') { c.n.pose = 'stand'; c.tour = true; const wn = this.g.world.npcs[F.i]; if (wn && wn.box >= 0) this.g.world.disable(wn.box); } }
  go(F, pts, sp, cb) { this.leave(F); const r = F.c.root; F.path = [[r.position.x, r.position.z], ...pts]; F.pi = 1; F.sp = sp; F.cb = cb || null; F.stk = 0; }
  nav(F, x, z) { const r = F.c.root; return findPath(this.g.world, [r.position.x, r.position.y, r.position.z], [x, 0, z], true).slice(1); }
  // مسار من المرقد للمضيف وبالعكس (من الأبواب)
  toMudhif(F, last, cb) {
    const g = this.g, m = g.mudhif; m && m.openDoor(-75.3, -4);
    const out = F.st === 'home' ? [SHRINE_DOOR_IN, SHRINE_OUT] : [];
    this.go(F, out, 1.25, () => { this.go(F, [...this.nav(F, DOOR_OUT[0], DOOR_OUT[1]), DOOR_IN, last], 1.25, cb); m && m.openDoor(-52.2, -12); });
  }
  toShrine(F, sp = 1.3) {
    const m = this.g.mudhif; const r = F.c.root, inside = r.position.x < -52.2 && r.position.x > -66 && r.position.z < -6 && r.position.z > -18;
    const pre = inside ? [[-55, (r.position.z - 12) * 0.3 - 8.4], DOOR_IN, DOOR_OUT] : []; m && m.openDoor(-52.2, -12);
    this.go(F, pre, sp, () => this.go(F, [...this.nav(F, SHRINE_OUT[0], SHRINE_OUT[1]), SHRINE_DOOR_IN, [F.home[0], F.home[1]]], sp, () => this.toHome(F)));
    setTimeout(() => m && m.openDoor(-75.3, -4), 2500);
  }
  // ---------- أحداث المضيف (طور القصة) ----------
  onAdhan() { if (!this.lobby) return; this.list.forEach((F, j) => { const s = slot2(j); F.slot = s; setTimeout(() => this.toMudhif(F, s, () => { F.st = 'pray'; this.face(F, s[0] + QF[0], s[1] + QF[1]); F.c.prayP = 'stand'; }), 1500 + j * 1200); }); }
  // بداية الصلاة: اللي بعده بالطريق يلتحق بمكانه
  onPrayStart() { for (const F of this.list) if (F.slot && F.st !== 'pray') { F.path = null; const r = F.c.root; this.leave(F); r.position.set(F.slot[0], 0, F.slot[1]); this.face(F, F.slot[0] + QF[0], F.slot[1] + QF[1]); F.st = 'pray'; F.c.prayP = 'stand'; } }
  setPose(p) { for (const F of this.list) if (F.st === 'pray') F.c.prayP = p; }
  // بعد السلام: يسبقون الشيخ للمرقد ويقرؤون الفاتحة
  onSalam() { this.list.forEach((F, j) => setTimeout(() => { F.c.prayP = null; F.slot = null; F.st = 'walk'; this.toShrine(F); }, 600 + j * 500)); }
  onLecture() { if (!this.lobby) return; this.list.forEach((F, j) => setTimeout(() => { if (F.st !== 'home') return; const s = LISTEN[j % LISTEN.length]; this.toMudhif(F, s, () => { F.st = 'listen'; F.c.prayP = 'sit'; this.face(F, -64.9, -12); }); }, 1000 + j * 1500)); }
  onLectureEnd() { this.list.forEach((F, j) => { if (F.st === 'listen' || (F.path && F.st !== 'walk')) setTimeout(() => { F.c.prayP = null; F.st = 'walk'; this.toShrine(F); }, 1200 + j * 900); }); }
  face(F, x, z) { const r = F.c.root; r.rotation.y = Math.atan2(-(x - r.position.x), -(z - r.position.z)); }
  // رمي قريب بالمعركة: اللي بالجولة يرجع بسرعة للمرقد (يُمنع فيه الرمي)
  alarm(pos) { if (this.lobby) return; for (const F of this.list) { if (F.st === 'tour' || F.st === 'walk') { const r = F.c.root; if (Math.hypot(r.position.x - pos[0], r.position.z - pos[2]) < 30) { F.st = 'walk'; this.go(F, [...this.nav(F, SHRINE_OUT[0], SHRINE_OUT[1]), SHRINE_DOOR_IN, [F.home[0], F.home[1]]], 3.6, () => { this.toHome(F); F.t = 20; }); } } } }
  // جولة المعركة: نقاط بالمدينة ضمن 35 متر
  tourSpot(F) {
    const N = (this.g.world.nav && this.g.world.nav.nodes) || [], r = F.c.root;
    for (let k = 0; k < 30; k++) { const n = N[Math.floor(Math.random() * N.length)]; if (!n || Math.abs(n[1]) > 0.5) continue; const d = Math.hypot(n[0] - r.position.x, n[2] - r.position.z); if (d > 8 && d < 35 && n[0] > -70) return [n[0], n[2]]; }
    return null;
  }
  update(dt) {
    if (!this.on) return; const g = this.g;
    for (const F of this.list) {
      const c = F.c; if (!c.alive) continue;
      if (!this.lobby && !F.path) {
        if (F.st === 'home') { if ((F.t -= dt) <= 0) { F.st = 'tour'; F.tEnd = g.t + 60; this.m(F); this.toTour(F); } }
        else if (F.st === 'tour') { if (g.t >= F.tEnd) { F.st = 'walk'; F.c.root && this.go(F, [...this.nav(F, SHRINE_OUT[0], SHRINE_OUT[1]), SHRINE_DOOR_IN, [F.home[0], F.home[1]]], 1.25, () => { this.toHome(F); F.t = 20; }); setTimeout(() => g.mudhif && g.mudhif.openDoor(-75.3, -4), 500); } else this.toTour(F); }
      }
      if (F.path) this.step(F, dt);
    }
  }
  m(F) { const g = this.g; g.mudhif && g.mudhif.openDoor(-75.3, -4); }
  toTour(F) { const s = this.tourSpot(F); if (!s) { F.tEnd = 0; return; } const first = F.c.root.position.x < -74.6 && F.c.root.position.x > -83.4 ? [SHRINE_DOOR_IN, SHRINE_OUT] : []; this.go(F, first, 1.2, () => this.go(F, this.nav(F, s[0], s[1]), 1.2, () => { F.c.walkSp = 0; F.pause = 2 + Math.random() * 3; })); }
  step(F, dt) {
    const c = F.c, r = c.root;
    if (F.pause > 0) { F.pause -= dt; c.walkSp = 0; return; }
    if ((F.dT = (F.dT || 0) - dt) <= 0) { F.dT = 0.2; walkerDoors(this.g, r.position.x, r.position.y, r.position.z); }
    const p = F.path[F.pi];
    if (!p) { F.path = null; c.walkSp = 0; const cb = F.cb; F.cb = null; cb && cb(); return; }
    const dx = p[0] - r.position.x, dz = p[1] - r.position.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { F.pi++; return; }
    const st = Math.min(d, F.sp * dt), P = F.wp || (F.wp = { x: 0, y: 0, z: 0 }); P.x = r.position.x; P.y = r.position.y; P.z = r.position.z;
    walkStep(this.g.world, P, dx / d, dz / d, st); const pr = Math.hypot(P.x - r.position.x, P.z - r.position.z); r.position.set(P.x, P.y, P.z);
    F.stk = pr < st * 0.3 ? (F.stk || 0) + dt : 0; if (F.stk > 2) { F.stk = 0; F.pi++; }
    let a = Math.atan2(-dx, -dz) - r.rotation.y; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; r.rotation.y += a * Math.min(1, dt * 7);
    c.walkSp = F.sp > 2 ? 3.4 : 1.1;
  }
}
