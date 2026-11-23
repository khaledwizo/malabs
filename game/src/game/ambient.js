// حياة السوق باللوبي: مارّة يتمشّون، أصحاب يلتقون عالچايخانة ويطلبون چاي، وخرفان أبو فرحان ترعى
// كلها مرئية فقط (ما تدخل المحاكاة) — لذلك تظهر باللوبي بس
import * as THREE from 'three';
import { Civilian } from './civilians.js';
import { findPath } from './route.js';

const LOOKS = ['citizen', 'vendor', 'elder', 'youth', 'citizen', 'pilgrim'];
// أماكن التمشّي: شارع السوق، ساحة الساعة، الشريعة، صحن الجامع، ساحة البئر
const SPOTS = [[0, -20], [0, -2], [0, 14], [-1, 22], [12, 26], [26, 24], [40, 24], [55, 22], [66, -9], [60, -16], [74, -12], [30, -3], [20, -25], [-12, -27], [-20, -6], [-38, 22], [-14, 24], [60, 10], [84, 12]];
let wid = 900;

export class Walker {
  constructor(game, look, x, z, o = {}) {
    this.g = game;
    this.n = { id: wid++, x, y: 0, z, yaw: o.yaw || 0, pose: o.pose || 'stand', look, seed: o.seed ?? (wid * 13 + 5), kill: false, stool: o.stool };
    this.c = new Civilian(this.n); this.c.walker = true; this.c.name = o.name || 'رجل من السوق'; this.c.idx = -1;
    game.scene.add(this.c.root);
    this.path = null; this.pi = 0; this.sp = o.sp || 1.25; this.wait = 0; this.onArrive = null;
  }
  get pos() { return [this.n.x, 0, this.n.z]; }
  goTo(x, z, cb) { this.path = findPath(this.g.world, [this.n.x, 0, this.n.z], [x, 0, z]); this.pi = 1; this.onArrive = cb || null; }
  stop() { this.path = null; this.c.walkSp = 0; }
  face(x, z) { this.n.yaw = Math.atan2(-(x - this.n.x), -(z - this.n.z)); this.c.root.rotation.y = this.n.yaw; }
  remove() { this.g.scene.remove(this.c.root); this.dead = true; }
  update(dt, cam) {
    const n = this.n, c = this.c;
    if (this.path && this.pi < this.path.length) {
      const [tx, tz] = this.path[this.pi], dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
      if (d < 0.25) { this.pi++; if (this.pi >= this.path.length) { this.path = null; c.walkSp = 0; const f = this.onArrive; this.onArrive = null; f && f(this); } }
      else {
        const st = Math.min(d, this.sp * dt); n.x += dx / d * st; n.z += dz / d * st;
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
    for (let k = 0; k < 6; k++) { const s = SPOTS[(k * 5) % SPOTS.length], w = new Walker(g, LOOKS[k % LOOKS.length], s[0], s[1], { sp: 1.05 + R() * 0.4, name: 'من أهل السوق' }); w.stroll = true; w.wait = R() * 5; this.walkers.push(w); }
    // الخرفان
    const box = [35, 28, 45, 32.2];
    for (let k = 0; k < 6; k++) this.sheep.push(new Sheep(g.scene, box[0] + R() * (box[2] - box[0]), box[1] + R() * (box[3] - box[1]), R, box));
    this.fT = 12;
  }
  stop() {
    if (!this.on) return; this.on = false;
    for (const w of this.walkers) w.remove(); this.walkers.length = 0;
    for (const s of this.sheep) this.g.scene.remove(s.g); this.sheep.length = 0;
    if (this.friends) for (const o of this.friends.all) o.remove(); this.friends = null;
  }
  // يضيف شخص مؤقّت (مثل مجاهدي الفلوجة بالمهمة)
  spawn(look, x, z, o) { const w = new Walker(this.g, look, x, z, o); this.walkers.push(w); return w; }
  update(dt) {
    if (!this.on) return;
    const cam = this.g.camera.position, R = this.R;
    for (const w of this.walkers) {
      if (w.stroll && !w.path) { if ((w.wait -= dt) <= 0) { const s = SPOTS[Math.floor(R() * SPOTS.length)]; w.goTo(s[0] + (R() - 0.5) * 3, s[1] + (R() - 0.5) * 3, () => { w.wait = 2 + R() * 8; }); } }
      w.update(dt, cam);
    }
    this.walkers = this.walkers.filter(w => !w.dead);
    for (const s of this.sheep) if (Math.hypot(s.g.position.x - cam.x, s.g.position.z - cam.z) < 50) s.update(dt);
    this.updateFriends(dt);
  }
  // الأصحاب: كل واحد يجي من صوب، يتلاقون عالطاولة، يسلّمون، يگعدون ويطلبون چاي، وبعدين يمشون
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
  { names: ['أبو كرم', 'أبو جاسم'], looks: ['citizen', 'elder'], lines: ['السلام عليكم يا أبو جاسم!', 'وعليكم السلام هلا بيك أبو كرم، شلونك؟', 'أبو سلام! استكانين چاي من إيدك الحلوة.', 'تدلّلون، هسّه يجي الچاي المهيّل!', 'يلّا نشوفك باچر بنفس المكان.'] },
  { names: ['علي', 'مصطفى'], looks: ['youth', 'citizen'], lines: ['هلا مصطفى! صارلي ساعة أدوّر عليك!', 'هلا علوّي، الطريق زحمة يمعود.', 'أبو سلام، ثنين چاي، واحد بلا شكر.', 'من عيوني، تدلّلون شباب!', 'يلّا، الله وياك، أشوفك باچر.'] },
  { names: ['حجي رزاق', 'حجي ناصر'], looks: ['elder', 'elder'], lines: ['السلام عليكم ورحمة الله.', 'وعليكم السلام، هلا بالغالي، تفضّل اگعد.', 'أبو سلام، چاي مهيّل الله يخلّيك.', 'على راسي حجي، هسّه.', 'الله ويّاك، سلّملي على أهلك.'] },
];
