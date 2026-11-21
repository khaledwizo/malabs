// أهل السوق: باعة جالسون في دكاكينهم، زبائن المقهى، شيوخ على المصاطب، وزوّار الضريح يقرؤون الفاتحة رافعين أيديهم
// نماذج بسيطة بدشداشة وشماغ أو عباءة، بحركات خفيفة (تنفّس، التفات نحو اللاعب، تلويح بالتحية) وسقوط واقعي عند الإصابة
import * as THREE from 'three';
import * as TX from '../gfx/tex.js';
import { roundBox, headGeo } from './chars.js';
import { mergeChildren } from '../gfx/geo.js';

const mats = new Map();
const std = (k, o) => { if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.88, metalness: 0 }, o))); return mats.get(k); };
const fab = (k, base) => { if (!mats.has(k)) { const t = TX.fabric(128, { base }); mats.set(k, new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.92 })); } return mats.get(k); };
const faceMat = (i, skin, opt) => { const k = 'face' + i; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ map: TX.face(128, { skin, ...opt }), roughness: 0.62 })); return mats.get(k); };
const shem = (red) => { const k = red ? 'shemR' : 'shemW'; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ map: TX.fabric(128, red ? { check: 12, col: '#b3202a' } : { base: [236, 234, 228] }).map, roughness: 0.95, side: THREE.DoubleSide })); return mats.get(k); };
const G = new Map(); const geo = (k, f) => { if (!G.has(k)) G.set(k, f()); return G.get(k); };

const SKINS = ['#c48a64', '#b98060', '#d69670', '#a87452', '#c99272'];
const ROBES = [[232, 230, 224], [196, 192, 182], [128, 110, 88], [86, 96, 104], [150, 138, 118], [70, 62, 54]];

export class Civilian {
  constructor(n) {
    this.n = n; let a = n.seed | 0; const R = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const woman = n.look === 'pilgrim' && R() < 0.45;
    const skinC = SKINS[Math.floor(R() * SKINS.length)];
    const skin = std('skin' + skinC, { color: skinC, roughness: 0.6 });
    const robeC = woman ? [22, 22, 26] : n.look === 'nursery' ? [70, 112, 72] : ROBES[Math.floor(R() * ROBES.length)];
    const robe = fab('robe' + robeC.join(), robeC);
    const face = faceMat(Math.floor(R() * 6) + (woman ? 10 : 0), skinC, woman ? { brow: '#1a120c', lip: '#9c5a4a' } : { beard: R() < 0.7 ? (R() < 0.3 ? '#bdb8b0' : '#2a221c') : null, beardA: 0.9, mustache: '#231d18', brow: '#1d1612' });
    const root = this.root = new THREE.Group(); root.position.set(n.x, n.y, n.z); root.rotation.y = n.yaw;
    const mesh = (g, m, x, y, z, parent) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (parent || root).add(o); return o; };
    const sit = n.pose === 'sit';
    this.sit = sit;
    // الجسد السفلي
    const body = this.body = new THREE.Group(); root.add(body);
    if (sit) {
      if (n.stool !== false) mesh(roundBox(0.36, 0.42, 0.34, 0.03), std('stool', { color: 0x5a3a22, roughness: 0.8 }), 0, 0.21, 0.05, body); // كرسي خشبي واطئ
      mesh(roundBox(0.38, 0.16, 0.5, 0.06), robe, 0, 0.5, -0.12, body);     // الفخذان تحت الدشداشة
      mesh(geo('skirt', () => new THREE.CylinderGeometry(0.2, 0.26, 0.48, 12, 1, true)), robe, 0, 0.26, -0.34, body).material.side = THREE.DoubleSide;
      for (const s of [-1, 1]) mesh(roundBox(0.1, 0.06, 0.22, 0.03), std('shoe', { color: 0x2a2018, roughness: 0.6 }), s * 0.09, 0.03, -0.4, body);
    } else {
      const g = geo('robeS', () => { const p = []; for (let i = 0; i <= 8; i++) { const t = i / 8; p.push(new THREE.Vector2(0.27 - t * 0.05 + (t < 0.2 ? 0.02 : 0), t * 1.0)); } return new THREE.LatheGeometry(p, 16); });
      mesh(g, robe, 0, 0.02, 0, body);
      for (const s of [-1, 1]) mesh(roundBox(0.1, 0.06, 0.24, 0.03), std('shoe', { color: 0x2a2018, roughness: 0.6 }), s * 0.1, 0.03, -0.05, body);
    }
    // الجذع والرأس (يتنفس ويلتفت)
    const chest = this.chest = new THREE.Group(); chest.position.y = sit ? 0.58 : 1.0; root.add(chest);
    mesh(roundBox(0.44, 0.5, 0.27, 0.1), robe, 0, 0.25, 0, chest);
    mesh(geo('neck', () => new THREE.CylinderGeometry(0.05, 0.056, 0.1, 10)), skin, 0, 0.53, 0, chest);
    const head = this.head = new THREE.Group(); head.position.y = 0.6; chest.add(head);
    mesh(headGeo(), face, 0, 0.05, 0, head);
    if (woman) { const h = mesh(geo('hijab', () => new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72)), std('abaya', { color: 0x141416, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.06, 0.02, head); h.rotation.x = -0.35; mesh(geo('hijab2', () => new THREE.CylinderGeometry(0.13, 0.2, 0.3, 14, 1, true)), std('abaya', {}), 0, -0.12, 0.02, head); }
    else if (R() < 0.75) {
      const red = R() < 0.55, m = shem(red);
      mesh(geo('shemTop', () => new THREE.SphereGeometry(0.128, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), m, 0, 0.07, 0.008, head);
      const dr = mesh(geo('shemDrape', () => new THREE.CylinderGeometry(0.125, 0.17, 0.24, 14, 1, true, Math.PI * 0.2, Math.PI * 1.6)), m, 0, -0.06, 0.02, head); dr.rotation.y = Math.PI;
      if (R() < 0.7) { const eg = mesh(geo('egal', () => new THREE.TorusGeometry(0.112, 0.011, 6, 22)), std('egal', { color: 0x101010 }), 0, 0.12, 0.01, head); eg.rotation.x = Math.PI / 2; }
    } else mesh(geo('cap', () => new THREE.SphereGeometry(0.115, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42)), std('capW', { color: 0xf2f0ea }), 0, 0.09, 0.005, head);
    // الذراعان
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.23, 0.45, 0); chest.add(sh);
      const up = new THREE.Group(); sh.add(up); mesh(geo('armU', () => new THREE.CapsuleGeometry(0.055, 0.2, 4, 8)), robe, 0, -0.14, 0, up);
      const fo = new THREE.Group(); fo.position.y = -0.29; up.add(fo); mesh(geo('armF', () => new THREE.CapsuleGeometry(0.048, 0.17, 4, 8)), robe, 0, -0.11, 0, fo);
      mesh(roundBox(0.065, 0.09, 0.035, 0.016), skin, 0, -0.27, 0, fo);
      this.arms.push({ up, fo, s });
    }
    if ((n.look === 'tea' && sit) || (sit && R() < 0.35)) { const gl = mesh(geo('chai', () => new THREE.CylinderGeometry(0.025, 0.02, 0.07, 8)), std('chai', { color: 0x9a3a10, roughness: 0.15, transparent: true, opacity: 0.85 }), 0, -0.31, -0.03, this.arms[1].fo); this.cup = gl; }
    // أدوات المهنة: إبريق الچاي، المسبحة، مرشّة الماء
    const Rh = this.arms[1].fo;
    if (n.look === 'tea' && !sit) { const pot = this.pot = new THREE.Group(); pot.position.set(0, -0.33, -0.02); Rh.add(pot); const met = std('teapot', { color: 0xc8c4bc, roughness: 0.25, metalness: 0.85 }); mesh(geo('potB', () => new THREE.SphereGeometry(0.065, 12, 8)), met, 0, -0.04, 0, pot).scale.set(1, 0.85, 1); mesh(geo('potS', () => new THREE.CylinderGeometry(0.008, 0.014, 0.09, 6)), met, 0, -0.02, -0.08, pot).rotation.x = -0.9; mesh(geo('potL', () => new THREE.CylinderGeometry(0.03, 0.04, 0.025, 10)), met, 0, 0.02, 0, pot); }
    else if (n.look === 'nursery' && !sit) { const can = this.can = new THREE.Group(); can.position.set(0, -0.32, -0.04); Rh.add(can); const gm = std('canG', { color: 0x3f7a46, roughness: 0.45, metalness: 0.5 }); mesh(geo('canB', () => new THREE.CylinderGeometry(0.06, 0.07, 0.14, 10)), gm, 0, -0.08, 0, can); mesh(geo('canS', () => new THREE.CylinderGeometry(0.008, 0.012, 0.2, 6)), gm, 0, -0.06, -0.11, can).rotation.x = -1.1; }
    else if (sit && !this.cup) { this.beads = mesh(geo('beads', () => new THREE.TorusGeometry(0.045, 0.008, 5, 16)), std('beads', { color: 0x5a1a12, roughness: 0.35 }), 0, -0.33, -0.01, Rh); this.beads.rotation.y = Math.PI / 2; }
    mergeChildren(body);
    this.pose0(); this.alive = true; this.t = R() * 10; this.dead = 0; this.wave = 0; this.look = 0;
    root.traverse(o => { if (o.isMesh) o.userData.npc = n.id; });
  }
  // الوضعيات الأساسية لكل ذراع: [دوران العضد x، العضد z، الساعد x]
  basePose() {
    const n = this.n, L = [0.05, 0.12, -0.15], R = [0.05, -0.12, -0.15];
    if (n.pose === 'pray') return [[-0.35, 0.18, -1.55], [-0.35, -0.18, -1.55]];
    if (this.sit) return [[-0.5, 0.1, -0.7], [-0.55, -0.1, this.cup ? -1.35 : -0.85]];
    if (n.look === 'fisher') return [[0.42, -0.18, -1.05], [0.42, 0.18, -1.05]]; // يداه خلف ظهره يتأمّل النهر
    if (n.look === 'vendor' || n.look === 'tea') return [[-0.25, 0.45, -1.2], [-0.25, -0.45, -1.2]];
    if (n.look === 'nursery') return [[-0.2, 0.2, -0.9], [-0.35, -0.15, -1.0]];
    return [L, R];
  }
  pose0() {
    const P = this.basePose(); this.arms.forEach((a, i) => { a.up.rotation.set(P[i][0], 0, P[i][1]); a.fo.rotation.set(P[i][2], 0, 0); });
    if (this.n.pose === 'pray') { this.arms[0].fo.rotation.z = 0.25; this.arms[1].fo.rotation.z = -0.25; }
    this.head.rotation.set(0, 0, 0); this.chest.rotation.set(0, 0, 0);
  }
  // يتكلّم الآن (إيماءات باليد وإيماء بالرأس) — dur ثوانٍ
  say(dur) { this.talkT = dur; this.gHand = Math.random() < 0.7 ? 1 : 0; }
  // ينظر نحو نقطة (متكلّم آخر أو اللاعب) لمدّة
  focus(x, z, dur) { this.fx = x; this.fz = z; this.focusT = dur; }
  // cam: موضع الكاميرا للالتفات والتحية
  update(dt, cam) {
    this.t += dt;
    if (!this.alive) {
      if (this.dead < 1) {
        this.dead = Math.min(1, this.dead + dt / 0.75); const e = 1 - Math.pow(1 - this.dead, 3), r = this.root, f = this.fall;
        // يسقط على ظهره أو جانبه مبتعداً عن الطلقة
        r.rotation.set(-e * Math.PI / 2 * 0.97 * f.b, this.n.yaw + f.tw * e, e * f.s * 0.4, 'YXZ');
        r.position.y = this.n.y + (this.sit ? 0.1 * (1 - e) : 0) + e * 0.12;
        for (const a of this.arms) { a.up.rotation.z = a.s * (0.2 + 1.2 * e); a.up.rotation.x = -0.3 * e; a.fo.rotation.x = -0.3 * e; }
        this.head.rotation.set(0.2 * e, f.s * 0.5 * e, 0); this.chest.rotation.set(0, 0, 0);
      }
      return;
    }
    const n = this.n, t = this.t, k = Math.min(1, dt * 7);
    this.talkT = Math.max(0, (this.talkT || 0) - dt); this.focusT = Math.max(0, (this.focusT || 0) - dt); this.cower = Math.max(0, (this.cower || 0) - dt);
    const br = Math.sin(t * 1.6) * 0.012;
    this.chest.scale.set(1, 1 + br, 1 + br * 1.3);
    // الهدف: وضعية أساسية + عمل المهنة + كلام + تحية + خوف
    const P = this.basePose().map(a => a.slice());
    let hx = 0, hy = 0, cx = 0, sway = 0;
    if (n.pose === 'pray') { hx = 0.28 + Math.sin(t * 0.7) * 0.04; P[0][2] += Math.sin(t * 0.9) * 0.03; P[1][2] += Math.sin(t * 0.9 + 1) * 0.03; }
    else {
      // جهة النظر: من يكلّمه، أو اللاعب القريب، أو تلفّت هادئ
      const dx = cam.x - this.root.position.x, dz = cam.z - this.root.position.z, d = Math.hypot(dx, dz);
      let want = Math.sin(t * 0.3 + n.id) * 0.35, tx = null, tz = null;
      if (this.focusT > 0) { tx = this.fx; tz = this.fz; } else if (d < 9) { tx = cam.x; tz = cam.z; }
      if (tx !== null) { let a = Math.atan2(-(tx - this.root.position.x), -(tz - this.root.position.z)) - n.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; if (Math.abs(a) < 2.2) want = Math.max(-1.25, Math.min(1.25, a)); }
      this.look = (this.look || 0) + (want - (this.look || 0)) * Math.min(1, dt * 2.5);
      hy = this.look * 0.7; const chestY = this.look * 0.3;
      // عمل المهنة حين لا يتكلّم
      const busy = this.talkT > 0 || this.wave > 0;
      if (!busy) {
        if (this.sit) {
          if (this.cup) { if (Math.sin(t * 0.25 + n.id) > 0.97) P[1][2] = -1.9; } // رشفة شاي
          else if (this.beads) { P[1][2] = -0.95 + Math.sin(t * 2.4) * 0.12; P[1][0] = -0.6; } // يعدّ حبّات المسبحة
        } else {
          const per = 7 + (n.id % 5), ph = (t + n.id * 1.7) % per, w = ph < 1.8 ? Math.sin(ph / 1.8 * Math.PI) : 0;
          if (n.look === 'tea') { P[1][0] = -0.25 - 1.0 * w; P[1][1] = -0.45 + 0.1 * w; P[1][2] = -1.2 + 0.6 * w; P[0][0] = -0.25 - 0.35 * w; if (this.pot) this.pot.rotation.x = 0.9 * w; } // يصبّ الچاي
          else if (n.look === 'vendor') { P[0][0] -= 0.45 * w; P[1][0] -= 0.55 * w; P[0][2] += 0.6 * w; P[1][2] += 0.55 * w; cx = 0.18 * w; } // يرتّب البضاعة
          else if (n.look === 'nursery') { P[1][0] = -0.35 - 0.5 * w; P[1][2] = -1.0 + 0.5 * w; if (this.can) this.can.rotation.x = 0.8 * w; } // يسقي الشتلات
          else if (n.look === 'fisher') { if (w > 0) { P[1][0] = -2.0 * w + 0.42 * (1 - w); P[1][1] = -0.3 * w; P[1][2] = -1.9 * w - 1.05 * (1 - w); hx = -0.1 * w; } } // يظلّل عينيه ويتأمّل دجلة
          sway = Math.sin(t * 0.45 + n.id) * 0.018; // نقل الوزن بين القدمين
        }
      }
      // الكلام: يد تشرح وإيماء بالرأس
      if (this.talkT > 0) {
        const g = this.gHand ?? 1, s = g ? -1 : 1, A = P[g];
        A[0] = (this.sit ? -0.75 : -0.55) + Math.sin(t * 4.1) * 0.16; A[1] = s * 0.28 + Math.sin(t * 2.7) * 0.08; A[2] = -1.25 + Math.sin(t * 5.6 + 1) * 0.35;
        hx += Math.sin(t * 6.5) * 0.045; if (Math.sin(t * 0.9) > 0.6) { const B = P[1 - g]; B[0] -= 0.25; B[2] -= 0.3; }
      } else if (this.focusT > 0 && Math.sin(t * 1.3 + n.id) > 0.92) hx += 0.12; // يومئ موافقاً وهو يسمع
      // التحية بيد مرفوعة
      if (this.wave > 0) { this.wave -= dt; const w = Math.sin(Math.min(1, (2.2 - this.wave) * 3) * Math.PI / 2) * Math.min(1, this.wave * 3); P[1][0] = -0.3 * w + P[1][0] * (1 - w); P[1][1] = -1.9 * w + P[1][1] * (1 - w); P[1][2] = -0.4 * w + Math.sin(t * 12) * 0.35 * w + P[1][2] * (1 - w); }
      if (d < 3.2 && this.wave <= 0 && !this.waved && !this.cower) { this.wave = 2.2; this.waved = true; } if (d > 8) this.waved = false;
      // الخوف من الرمي: ينحني ويغطّي رأسه
      if (this.cower > 0) { const e = Math.min(1, this.cower * 2, (this.cowerMax - this.cower) * 4 + 0.2); P[0] = [-2.6 * e + P[0][0] * (1 - e), 0.35 * e + P[0][1] * (1 - e), -1.7 * e + P[0][2] * (1 - e)]; P[1] = [-2.6 * e + P[1][0] * (1 - e), -0.35 * e + P[1][1] * (1 - e), -1.7 * e + P[1][2] * (1 - e)]; cx = 0.5 * e; hx = 0.5 * e; }
      this.chest.rotation.y += (chestY - this.chest.rotation.y) * k;
    }
    this.arms.forEach((a, i) => { a.up.rotation.x += (P[i][0] - a.up.rotation.x) * k; a.up.rotation.z += (P[i][1] - a.up.rotation.z) * k; a.fo.rotation.x += (P[i][2] - a.fo.rotation.x) * k; });
    this.head.rotation.x += (hx - this.head.rotation.x) * k; this.head.rotation.y += (hy - this.head.rotation.y) * k;
    this.chest.rotation.x += (cx - this.chest.rotation.x) * k;
    if (!this.sit) this.root.rotation.z = sway;
  }
  scare(dur) { if (!this.alive || this.n.pose === 'pray') return; this.cower = dur; this.cowerMax = dur; this.talkT = 0; }
  die(dir) {
    if (!this.alive) return; this.alive = false; this.dead = 0;
    // اتجاه السقوط: بعيداً عن مصدر الطلقة
    let b = 1, s = 0; if (dir) { const fx = -Math.sin(this.n.yaw), fz = -Math.cos(this.n.yaw); const fw = dir[0] * fx + dir[2] * fz; b = fw > 0 ? 1 : -1; s = Math.sign(dir[0] * Math.cos(this.n.yaw) - dir[2] * Math.sin(this.n.yaw)) || 1; }
    this.fall = { b: -b, s, tw: (Math.random() - 0.5) * 0.8 };
  }
  revive() { this.alive = true; this.dead = 0; this.root.rotation.set(0, this.n.yaw, 0); this.root.position.set(this.n.x, this.n.y, this.n.z); this.head.rotation.set(0, 0, 0); this.pose0(); }
}
