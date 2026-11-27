// حياة السوق باللوبي: مارّة يتمشّون، أصحاب يلتقون عالمقهى ويطلبون شاي، وخرفان أبو فرحان ترعى
// كلها مرئية فقط (ما تدخل المحاكاة) — لذلك تظهر باللوبي بس
import * as THREE from 'three';
import { Civilian } from './civilians.js';
import { findPath } from './route.js';
import { STREET_TALK } from './streettalk.js';

const LOOKS = ['citizen', 'vendor', 'elder', 'youth', 'citizen', 'pilgrim'];
// أماكن التمشّي: شارع السوق، ساحة الساعة، الشريعة، صحن الجامع، ساحة البئر
const SPOTS = [[0, -20], [0, -2], [0, 14], [-1, 22], [12, 26], [26, 24], [40, 24], [55, 22], [66, -9], [60, -16], [74, -12], [30, -3], [20, -25], [-12, -27], [-20, -6], [-38, 22], [-14, 24], [60, 10], [84, 12]];
let wid = 900;

// الماشي إذا وصل باب حقيقي (المضيف، البيوت اللي تنفتح) يفتحه ويبقيه مفتوح لحد ما يعبر
// خطوة مشي بتصادم: ينزلق على الحيطان والبسطات بدل ما يخترقها، ويصعد الدرج والعتبات (ارتفاع الأرض تحته)
// عند فتحة باب: يعبر حتى لو الباب بعده يتسكّر (ما يجشر بالباب)
function atDoor(W, x, y, z) { for (const d of W.doors || []) { if (Math.abs((d.y || 0) - y) > 1) continue; const b = d.bb, ax = d.axis === 'x'; if (x > b[0] + (ax ? 0.05 : -0.6) && x < b[2] - (ax ? 0.05 : -0.6) && z > b[1] + (ax ? -0.6 : 0.05) && z < b[3] - (ax ? -0.6 : 0.05)) return true; } return false; }
// hurry: اللي يهرب من الرمي ينطّ فوگ البسطات والمصاطب الواطئة (أقل من متر)
export function walkStep(W, n, dx, dz, st, hurry) {
  const y = n.y || 0, R = 0.2, free = (x, z) => !W.overlap(x, y + 0.44, z, R, 1.2) || atDoor(W, x, y, z) || (hurry && !W.overlap(x, y + 1.0, z, R, 0.7)), inside = !free(n.x, n.z);
  let ok = true; const nx = n.x + dx * st, nz = n.z + dz * st;
  if (inside || free(nx, nz)) { n.x = nx; n.z = nz; }
  else if (Math.abs(dx) > 0.15 && free(nx, n.z)) n.x = nx;
  else if (Math.abs(dz) > 0.15 && free(n.x, nz)) n.z = nz;
  else ok = false;
  const gy = W.groundBelow(n.x, y + 0.46, n.z, 0.14, 1.4); if (gy !== null) n.y = gy; else n.y = Math.max(0, y - st * 3);
  return ok;
}
// أقرب نقطة فاضية (إذا المكان المطلوب داخل حايط أو بسطة)
export function freeSpot(W, x, z, y = 0) {
  const free = (a, b) => !W.overlap(a, y + 0.44, b, 0.22, 1.2);
  if (!W || free(x, z)) return [x, z];
  for (let r = 0.3; r < 5; r += 0.3) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (free(px, pz)) return [px, pz]; }
  return [x, z];
}
// الأجسام اللي ما يخترقها الماشي: باقي المارّة واللاعب وأهل السوق (تُحسب مرّة كل إطار)
function bodies(g, self) {
  const t = g.t || 0; if (g._bT !== t || !g._B) { g._bT = t; const B = g._B = []; const A = g.ambient; if (A) for (const w of A.walkers) if (!w.hidden && !w.dead && !w.ghost) B.push([w.n.x, w.n.z, w.n.y || 0, w]); const me = g.mp; if (me && me.alive !== false) B.push([me.pos[0], me.pos[2], me.pos[1], null]); for (const c of g.civs || []) if (c.alive && !c.away && c.fl) B.push([c.root.position.x, c.root.position.z, c.root.position.y, null]); }
  return g._B.filter(b => b[3] !== self);
}
export function walkerDoors(g, x, y, z) {
  const S = g.sim, W = g.world; if (!S || !S.doors || !W || !W.doors) return;
  W.doors.forEach((d, i) => { if (Math.abs((d.y || 0) - (y || 0)) > 1.5 || Math.hypot(d.x - x, d.z - z) > 1.7) return; const st = S.doors[i]; if (!st) return; if (!st.open) S.setDoor(i, true); else st.t = Math.max(st.t, 4); });
}

export class Walker {
  constructor(game, look, x, z, o = {}) {
    this.g = game;
    this.n = { id: wid++, x, y: 0, z, yaw: o.yaw || 0, pose: o.pose || 'stand', look, seed: o.seed ?? (wid * 13 + 5), kill: false, stool: o.stool };
    this.c = new Civilian(this.n); this.c.walker = true; this.c.name = o.name || 'رجل من السوق'; this.c.idx = -1;
    game.scene.add(this.c.root);
    this.path = null; this.pi = 0; this.sp = o.sp || 1.25; this.wait = 0; this.onArrive = null;
  }
  get pos() { return [this.n.x, 0, this.n.z]; }
  goTo(x, z, cb) { this.rep = 0; this.stuckT = 0; this.path = findPath(this.g.world, [this.n.x, this.n.y || 0, this.n.z], [x, 0, z], true); this.pi = 1; this.onArrive = cb || null; }
  stop() { this.path = null; this.c.walkSp = 0; }
  face(x, z) { this.n.yaw = Math.atan2(-(x - this.n.x), -(z - this.n.z)); this.c.root.rotation.y = this.n.yaw; }
  remove() { this.g.scene.remove(this.c.root); this.dead = true; }
  update(dt, cam) {
    const n = this.n, c = this.c;
    if (this.path && this.pi < this.path.length) {
      if ((this.dT = (this.dT || 0) - dt) <= 0) { this.dT = 0.2; walkerDoors(this.g, n.x, n.y, n.z); }
      const [tx, tz] = this.path[this.pi], dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
      if (d < 0.25) { this.pi++; if (this.pi >= this.path.length) { this.path = null; c.walkSp = 0; const f = this.onArrive; this.onArrive = null; f && f(this); } }
      else {
        const st = Math.min(d, this.sp * dt);
        if (this.ghost) { n.x += dx / d * st; n.z += dz / d * st; }
        else {
          // يتفادى الناس اللي گدّامه (واللاعب): يميل للجنب، ولو لزگ بيه يوگف لحظة
          let ux = dx / d, uz = dz / d, wait = false; const B = bodies(this.g, this);
          for (const b of B) { const bx = b[0] - n.x, bz = b[1] - n.z, bd = Math.hypot(bx, bz); if (bd > 1.5 || bd < 0.01 || Math.abs(b[2] - (n.y || 0)) > 1.2) continue; const ah = (bx * ux + bz * uz) / bd; if (ah < 0.25) continue; const lat = bx * -uz + bz * ux, s = lat > 0 ? -1 : 1, k = (1.5 - bd) / 1.5 * ah * 1.4; if (bd < 0.62 && ah > 0.6) wait = true; const px = -uz * s, pz = ux * s; ux += px * k; uz += pz * k; }
          { const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L; }
          if (wait && (this.waitT = (this.waitT || 0) + dt) < 1.6) { c.walkSp = 0; return; } if (!wait) this.waitT = 0;
          const x0 = n.x, z0 = n.z; walkStep(this.g.world, n, ux, uz, st);
          // علگ؟ نعيد حساب الطريق، وإذا بعده علگان نعتبره وصل (حتى ما يوقف الشغل)
          const pr = Math.hypot(n.x - x0, n.z - z0); this.stuckT = pr < st * 0.3 ? (this.stuckT || 0) + dt : Math.max(0, (this.stuckT || 0) - dt);
          if (this.stuckT > 1.0 && !this.rep) { this.rep = 1; const end = this.path[this.path.length - 1], cb = this.onArrive; this.goTo(end[0], end[1], cb); this.rep = 1; this.stuckT = 0; return; }
          if (this.stuckT > 2.5) { this.stuckT = 0; this.rep = 0; this.path = null; c.walkSp = 0; const f = this.onArrive; this.onArrive = null; f && f(this); return; }
        }
        c.root.position.y = n.y || 0;
        let want = Math.atan2(-dx, -dz), a = want - n.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; n.yaw += a * Math.min(1, dt * 6);
        c.walkSp = this.sp / 1.25;
      }
    } else c.walkSp = Math.max(0, (c.walkSp || 0) - dt * 4);
    c.root.position.x = n.x; c.root.position.z = n.z; c.root.rotation.y = n.yaw;
    const d = Math.hypot(n.x - cam.x, n.z - cam.z), vis = !this.hidden && d < 46; if (c.root.visible !== vis) c.root.visible = vis;
    if (vis && d < 32) c.update(dt, cam);
  }
}

// خروف: جسم صوف، راس غامج، أربع رجلين — يرعى ويتمشّى ببطء داخل الحشيش
class Sheep {
  constructor(scene, x, z, R, box) {
    const g = this.g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const wool = new THREE.MeshStandardMaterial({ color: R() < 0.25 ? 0x6a5a4a : 0xe8e2d2, roughness: 1 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 9), wool); body.scale.set(0.85, 0.75, 1.35); body.position.y = 0.55; body.castShadow = true; g.add(body);
    const head = this.head = new THREE.Group(); head.position.set(0, 0.62, -0.46); g.add(head);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), dark); hm.scale.set(0.8, 0.85, 1.25); hm.position.z = -0.08; head.add(hm);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), dark); e.scale.set(1.6, 0.5, 0.8); e.position.set(s * 0.12, 0.05, 0); head.add(e); }
    this.legs = [];
    for (const [lx, lz] of [[-0.15, -0.28], [0.15, -0.28], [-0.15, 0.28], [0.15, 0.28]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.36, 6), dark); l.position.set(lx, 0.18, lz); g.add(l); this.legs.push(l); }
    this.R = R; this.box = box; this.t = R() * 10; this.tx = x; this.tz = z; this.wait = R() * 4; this.yaw = R() * 6.28; g.rotation.y = this.yaw;
  }
  update(dt) {
    this.t += dt; const g = this.g, R = this.R, B = this.box;
    const dx = this.tx - g.position.x, dz = this.tz - g.position.z, d = Math.hypot(dx, dz);
    let walk = 0;
    if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) { this.tx = B[0] + R() * (B[2] - B[0]); this.tz = B[1] + R() * (B[3] - B[1]); } }
    else if (d > 0.1) {
      walk = 1; const st = Math.min(d, 0.45 * dt); g.position.x += dx / d * st; g.position.z += dz / d * st;
      let a = Math.atan2(-dx, -dz) - this.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; this.yaw += a * Math.min(1, dt * 3); g.rotation.y = this.yaw;
    } else this.wait = 3 + R() * 7;
    // يرعى: الراس ينزل للحشيش لمّا يوقف
    const graze = walk ? 0 : (Math.sin(this.t * 0.7) > -0.3 ? 1 : 0);
    this.head.rotation.x += ((graze ? 0.75 + Math.sin(this.t * 5) * 0.06 : -0.1) - this.head.rotation.x) * Math.min(1, dt * 3);
    this.head.position.y = 0.62 - graze * 0.12;
    this.legs.forEach((l, i) => { l.rotation.x = walk ? Math.sin(this.t * 9 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.35 : 0; });
  }
}

export class Ambient {
  constructor(game) { this.g = game; this.on = false; this.walkers = []; this.sheep = []; this.friends = null; this.fT = 25; let a = 77; this.R = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }
  start() {
    if (this.on) return; this.on = true;
    const g = this.g, R = this.R;
    // المارّة
    const dens = (g.Q && g.Q.dens) || 1, nW = Math.max(2, Math.round(6 * dens)), nS = Math.max(2, Math.round(6 * dens)); // كثافة الناس حسب الجودة
    for (let k = 0; k < nW; k++) { const s = SPOTS[(k * 5) % SPOTS.length], w = new Walker(g, LOOKS[k % LOOKS.length], s[0], s[1], { sp: 1.05 + R() * 0.4, name: 'من أهل السوق' }); w.stroll = true; w.wait = R() * 5; this.walkers.push(w); }
    // الخرفان
    const box = [35, 28, 45, 32.2];
    for (let k = 0; k < nS; k++) this.sheep.push(new Sheep(g.scene, box[0] + R() * (box[2] - box[0]), box[1] + R() * (box[3] - box[1]), R, box));
    this.fT = 12;
  }
  stop() {
    if (!this.on) return; this.on = false; if (this.st) this.endStreet();
    for (const w of this.walkers) w.remove(); this.walkers.length = 0;
    for (const s of this.sheep) this.g.scene.remove(s.g); this.sheep.length = 0;
    if (this.friends) for (const o of this.friends.all) o.remove(); this.friends = null;
  }
  // يضيف شخص مؤقّت (مثل مجاهدي الفلوجة بالمهمة)
  // رمي قريب: المارّة يركضون لأقرب باب ويتخبّون، ويرجعون بعد شوية
  flee(pos) {
    const doors = this.g.world.doors || [];
    for (const w of this.walkers) {
      if (!w.stroll || w.hideT > 0) continue;
      if (Math.hypot(w.n.x - pos[0], w.n.z - pos[2]) > 24) continue;
      let best = null, bd = 45; for (const d of doors) { const dd = Math.hypot(d.x - w.n.x, d.z - w.n.z); if (dd < bd) { bd = dd; best = d; } }
      const D = this.g.houseDoors, hd = D && D.pick(w.n.x, w.n.z);
      w.sp0 = w.sp0 || w.sp; w.sp = 4.6; w.hideT = 40 + Math.random() * 25;
      if (hd) { D.enter(w, hd); continue; }
      if (!best) continue;
      w.goTo(best.x, best.z, () => { w.hidden = true; });
    }
  }
  spawn(look, x, z, o = {}) { if (o.pose !== 'sit' && !o.keep) [x, z] = freeSpot(this.g.world, x, z); const w = new Walker(this.g, look, x, z, o); this.walkers.push(w); return w; }
  update(dt) {
    if (!this.on) return;
    const cam = this.g.camera.position, R = this.R;
    for (const w of this.walkers) {
      if (w.hideT > 0) { if ((w.hideT -= dt) <= 0) { w.hidden = false; w.sp = w.sp0 || w.sp; } else if (w.hidden) continue; }
      if (w.stroll && !w.path && !w.talking) { if ((w.wait -= dt) <= 0) { const s = SPOTS[Math.floor(R() * SPOTS.length)], [sx, sz] = freeSpot(this.g.world, s[0] + (R() - 0.5) * 3, s[1] + (R() - 0.5) * 3); w.goTo(sx, sz, () => { w.wait = 2 + R() * 8; }); } }
      w.update(dt, cam);
    }
    this.walkers = this.walkers.filter(w => !w.dead);
    for (const s of this.sheep) if (Math.hypot(s.g.position.x - cam.x, s.g.position.z - cam.z) < 50) s.update(dt);
    this.updateFriends(dt);
    this.updateStreet(dt);
  }
  // سوالف المارّة: اللي يمرّ يمّك يوگف ويحچيلك سالفة (تاريخ، جغرافية، ثروات، معارك، أخبار، ناس) — ما تتكرر لحد ما تخلص كلها
  updateStreet(dt) {
    const g = this.g, me = g.mp, S = this.st;
    if (!me || g.cine) { if (S) this.endStreet(); return; }
    if (S) {
      const w = S.w, d = Math.hypot(w.n.x - me.pos[0], w.n.z - me.pos[2]);
      if (w.dead || w.hidden || w.path || d > 9) return this.endStreet();
      w.c.focus(me.pos[0], me.pos[2], 1.5);
      if ((S.t -= dt) > 0) return;
      if (S.i >= S.lines.length) return this.endStreet(true);
      const text = S.lines[S.i++], sp = g.mudhif.speak(S.per, text, w); S.el = sp.el; S.t = sp.dur + 0.45;
      try { g.talk && g.talk.bubble(w.c, text, sp.dur); } catch (e) { }
      return;
    }
    if ((this.stCD = (this.stCD ?? 6) - dt) > 0) return;
    if (g.talk && (g.talk.units || []).some(u => u.cur && u.dd < 14)) return; // أحد ثاني يسولف يمّك
    let best = null, bd = 4.2; for (const w of this.walkers) { if (!w.stroll || w.hidden || w.hideT > 0 || w.dead) continue; const d = Math.hypot(w.n.x - me.pos[0], w.n.z - me.pos[2]); if (d < bd && Math.abs((w.n.y || 0) - me.pos[1]) < 1.5) { bd = d; best = w; } }
    if (!best) return;
    let heard = []; try { heard = JSON.parse(localStorage.getItem('rafidain.street.v1') || '[]'); } catch (e) { }
    let k = STREET_TALK.findIndex((_, i) => !heard.includes(i)); if (k < 0) { heard = []; k = Math.floor(Math.random() * STREET_TALK.length); }
    heard.push(k); try { localStorage.setItem('rafidain.street.v1', JSON.stringify(heard)); } catch (e) { }
    const T = STREET_TALK[k]; best.path = null; best.c.walkSp = 0; best.talking = true; best.face(me.pos[0], me.pos[2]);
    this.st = { w: best, per: T.per, lines: T.lines, i: 0, t: 0.5 };
  }
  endStreet(done) { const S = this.st; this.st = null; if (S) { S.w.talking = false; S.w.wait = 1.5; if (S.el) try { S.el.pause(); } catch (e) { } } this.stCD = done ? 22 : 8; }
  // الأصحاب: كل واحد يجي من صوب، يتلاقون عالطاولة، يسلّمون، يگعدون ويطلبون شاي، وبعدين يمشون
  updateFriends(dt) {
    const g = this.g, talk = g.talk, F = this.friends;
    const say = (c, t, d = 2.6) => { if (talk) { talk.bubble(c, t, d); c.say(d); } };
    if (!F) { if ((this.fT -= dt) > 0) return; this.fT = 70 + this.R() * 50; this.startFriends(); return; }
    F.t += dt;
    if (F.st === 'come' && F.arrived >= 2) {
      F.st = 'greet'; F.t = 0; const [a, b] = F.w; a.face(b.n.x, b.n.z); b.face(a.n.x, a.n.z); a.c.wave = 2.2; b.c.wave = 2.2;
      say(a.c, F.lines[0]); setTimeout(() => this.friends === F && say(b.c, F.lines[1]), 2300);
    } else if (F.st === 'greet' && F.t > 5.2) {
      F.st = 'sit'; F.t = 0; F.w.forEach(w => { w.c.root.visible = false; w.hidden = true; }); F.s.forEach(o => { o.c.root.visible = true; o.hidden = false; });
      say(F.s[0].c, F.lines[2]); const tea = g.civs && g.civs[17]; setTimeout(() => { if (this.friends === F && tea) { say(tea, F.lines[3], 2.2); tea.focus(77.7, 27.2, 3); } }, 2600);
    } else if (F.st === 'sit' && F.t > 55 + (F.extra || 0)) {
      F.st = 'leave'; F.s.forEach(o => { o.c.root.visible = false; o.hidden = true; }); F.w.forEach((w, i) => { w.hidden = false; w.c.root.visible = true; const e = F.exits[i]; w.goTo(e[0], e[1], () => { w.gone = true; }); });
      say(F.w[0].c, F.lines[4], 2.4);
    } else if (F.st === 'leave' && F.w.every(w => w.gone)) { for (const o of F.all) o.remove(); this.walkers = this.walkers.filter(w => !w.dead); this.friends = null; }
    // الگاعدين: نحرّكهم مثل أهل السوق
    if (F && F.st === 'sit') for (const o of F.s) o.update(dt, this.g.camera.position);
  }
  startFriends() {
    const R = this.R, P = FRIEND_SETS[Math.floor(R() * FRIEND_SETS.length)];
    const seats = [[76.95, 27.2, -Math.PI / 2], [78.45, 27.2, Math.PI / 2]], from = [[66, -9], [40, 24], [84, 12], [12, 26]];
    const i0 = Math.floor(R() * 4), i1 = (i0 + 1 + Math.floor(R() * 3)) % 4;
    const F = { st: 'come', t: 0, arrived: 0, lines: P.lines, w: [], s: [], all: [], exits: [from[i1], from[i0]], extra: R() * 30 };
    [i0, i1].forEach((fi, k) => {
      const w = this.spawn(P.looks[k], from[fi][0], from[fi][1], { name: P.names[k], sp: 1.2 });
      const seat = seats[k]; w.goTo(seat[0] + (k ? 0.7 : -0.7), seat[1] - 0.9, () => { F.arrived++; }); F.w.push(w); F.all.push(w);
      const s = new Walker(this.g, P.looks[k], seat[0], seat[1], { pose: 'sit', yaw: seat[2], name: P.names[k], seed: w.n.seed }); s.c.root.visible = false; s.hidden = true; F.s.push(s); F.all.push(s);
    });
    this.friends = F;
  }
}

const FRIEND_SETS = [
  { names: ['أبو كرم', 'أبو جاسم'], looks: ['citizen', 'elder'], lines: ['السلامُ عليكم يا أبا جاسم!', 'وعليكمُ السلام، أهلاً بكَ يا أبا كرم، كيفَ حالُك؟', 'يا أبا سلام! كوبانِ من الشايِ من يدِكَ الحلوة.', 'تدلَّلون، الآنَ يأتي الشايُ بالهيل!', 'هيّا، نراكَ غداً في المكانِ نفسِه.'] },
  { names: ['علي', 'مصطفى'], looks: ['youth', 'citizen'], lines: ['أهلاً يا مصطفى! لي ساعةٌ أبحثُ عنك!', 'أهلاً يا عليّ، الطريقُ مزدحمٌ يا أخي.', 'يا أبا سلام، كوبا شاي، واحدٌ بلا سكَّر.', 'على الرأسِ والعين، تدلَّلوا يا شباب!', 'هيّا، اللهُ معك، أراكَ غداً.'] },
  { names: ['الحاج رزّاق', 'الحاج ناصر'], looks: ['elder', 'elder'], lines: ['السلامُ عليكم ورحمةُ الله.', 'وعليكمُ السلام، أهلاً بالغالي، تفضَّلِ اجلِس.', 'يا أبا سلام، شايٌ بالهيلِ حفظَكَ الله.', 'على رأسي يا حاجّ، الآن.', 'اللهُ معك، سلِّمْ لي على أهلِك.'] },
];
