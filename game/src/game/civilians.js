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

const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _X = new THREE.Vector3(1, 0, 0);
const SKINS = ['#c48a64', '#b98060', '#d69670', '#a87452', '#c99272'];
// ألوان ثياب أهل المهن الجدد
const LOOKC = { lablabi: [228, 226, 218], shepherd: [112, 88, 62], tourist: [196, 176, 134], repair: [72, 84, 98], elder2: [240, 238, 232], citizen: [150, 140, 122], youth: [58, 70, 92], gravedigger: [84, 76, 64], spice: [124, 72, 40], pharmacist: [246, 248, 246], baker: [236, 226, 204] };
// وضعيات الصلاة (على طريقة السنّة): الذراعان [أعلى x، أعلى z، الساعد x]، الانحناء، الرأس، طول الثوب وارتفاع الصدر
const PRAY = {
  stand: { a: [[-0.35, 0.3, -1.9], [-0.35, -0.3, -1.9]], cx: 0, hx: 0.18, s: 1, cy: 1 },
  raise: { a: [[-0.4, -0.6, -2.45], [-0.4, 0.6, -2.45]], cx: 0, hx: 0, s: 1, cy: 1 },
  ruku: { a: [[-1.25, 0.08, -0.1], [-1.25, -0.08, -0.1]], cx: 1.5, hx: 0.15, s: 1, cy: 1 },
  sujud: { a: [[-2.3, 0.4, -0.55], [-2.3, -0.4, -0.55]], cx: 1.9, hx: 0.25, s: 0.42, cy: 0.42 },
  sit: { a: [[-0.9, 0.12, -0.55], [-0.9, -0.12, -0.55]], cx: 0.05, hx: 0.15, s: 0.55, cy: 0.55 },
};
PRAY.salamR = { ...PRAY.sit, hy: 1.1 }; PRAY.salamL = { ...PRAY.sit, hy: -1.1 };
const ROBES = [[232, 230, 224], [196, 192, 182], [128, 110, 88], [86, 96, 104], [150, 138, 118], [70, 62, 54]];

export class Civilian {
  constructor(n) {
    this.n = n; let a = n.seed | 0; const R = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const woman = n.look === 'pilgrim' && R() < 0.45, fatih = n.look === 'sheikhF', sheikh = n.look === 'sheikh' || fatih, masked = n.look === 'masked';
    const skinC = SKINS[Math.floor(R() * SKINS.length)];
    const skin = std('skin' + skinC, { color: skinC, roughness: 0.6 });
    const robeC = woman ? [22, 22, 26] : masked ? [30, 30, 32] : sheikh ? [238, 236, 230] : n.look === 'nursery' ? [70, 112, 72] : LOOKC[n.look] || ROBES[Math.floor(R() * ROBES.length)];
    const robe = fab('robe' + robeC.join(), robeC);
    const face = fatih ? faceMat(21, '#c69272', { beard: '#f2f0ea', beardA: 0.95, mustache: '#ecebe6', brow: '#d8d4cc', eye: '#2a1c12', lip: '#8d5446' }) : sheikh ? faceMat(20, '#c08a68', { beard: '#b9b4ac', beardA: 0.85, mustache: '#a8a29a', brow: '#8f8a82', eye: '#2a1c12', lip: '#8d5446' }) : faceMat(Math.floor(R() * 6) + (woman ? 10 : 0), skinC, woman ? { brow: '#1a120c', lip: '#9c5a4a' } : { beard: R() < 0.7 ? (R() < 0.3 ? '#bdb8b0' : '#2a221c') : null, beardA: 0.9, mustache: '#231d18', brow: '#1d1612' });
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
    if (masked) { // لثام أسود يغطّي الرأس كله إلا فتحة العينين
      mesh(geo('balac', () => new THREE.SphereGeometry(0.133, 16, 12)), std('balac', { color: 0x0c0c0d, roughness: 0.95 }), 0, 0.055, 0.004, head).scale.set(1, 1.12, 1.04);
      mesh(roundBox(0.1, 0.024, 0.02, 0.008), skin, 0, 0.085, -0.128, head);
      for (const s2 of [-1, 1]) mesh(geo('eyeM', () => new THREE.SphereGeometry(0.011, 6, 5)), std('eyeM', { color: 0x050505 }), s2 * 0.026, 0.087, -0.138, head);
    }
    else if (woman) { const h = mesh(geo('hijab', () => new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72)), std('abaya', { color: 0x141416, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.06, 0.02, head); h.rotation.x = -0.35; mesh(geo('hijab2', () => new THREE.CylinderGeometry(0.13, 0.2, 0.3, 14, 1, true)), std('abaya', {}), 0, -0.12, 0.02, head); }
    else if (fatih) { // عمامة بيضاء كبيرة ملفوفة ولحية بيضاء طويلة
      const tm = fab('turbanW', [246, 244, 238]);
      mesh(geo('turbCap', () => new THREE.SphereGeometry(0.128, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)), tm, 0, 0.1, 0.01, head);
      for (let k = 0; k < 4; k++) { const tr = mesh(geo('turbR' + k, () => new THREE.TorusGeometry(0.122 - k * 0.014, 0.036 - k * 0.003, 8, 20)), tm, 0, 0.165 + k * 0.03, 0.018, head); tr.rotation.x = Math.PI / 2 - 0.18 + (k % 2 ? 0.08 : 0); tr.rotation.y = k * 0.4; }
      mesh(geo('turbTop', () => new THREE.SphereGeometry(0.085, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), tm, 0, 0.255, 0.02, head).scale.y = 0.7;
      const bm = std('beardW', { color: 0xeeebe4, roughness: 0.95 });
      const bd = mesh(geo('beardL', () => { const g = new THREE.ConeGeometry(0.085, 0.34, 12, 1, false, Math.PI * 0.15, Math.PI * 1.7); g.rotateX(Math.PI); g.rotateY(Math.PI); return g; }), bm, 0, -0.2, -0.07, head); bd.rotation.x = 0.22;
      mesh(geo('beardS', () => new THREE.SphereGeometry(0.08, 12, 8)), bm, 0, -0.07, -0.06, head).scale.set(1.05, 0.6, 0.7);
    }
    else if (n.look === 'tourist') { // قبعة شمس بحافة عريضة
      const hm = std('hatT', { color: 0xd8c89a, roughness: 0.9 });
      mesh(geo('hatTop', () => new THREE.CylinderGeometry(0.1, 0.12, 0.1, 14)), hm, 0, 0.16, 0.005, head);
      mesh(geo('hatBrim', () => new THREE.CylinderGeometry(0.22, 0.22, 0.012, 18)), hm, 0, 0.115, 0.005, head);
    }
    else if (n.look === 'youth') mesh(geo('capY', () => new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45)), std('capY', { color: 0x1d2a44 }), 0, 0.08, 0.005, head);
    else if (sheikh || n.look === 'elder2' || n.look === 'shepherd' || (n.look !== 'pharmacist' && n.look !== 'repair' && R() < 0.75)) {
      const red = sheikh || R() < 0.55, m = shem(red);
      mesh(geo('shemTop', () => new THREE.SphereGeometry(0.128, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), m, 0, 0.07, 0.008, head);
      const dr = mesh(geo('shemDrape', () => new THREE.CylinderGeometry(0.125, 0.17, 0.24, 14, 1, true, Math.PI * 0.2, Math.PI * 1.6)), m, 0, -0.06, 0.02, head); dr.rotation.y = Math.PI;
      if (sheikh || R() < 0.7) { const eg = mesh(geo('egal', () => new THREE.TorusGeometry(0.112, 0.011, 6, 22)), std('egal', { color: 0x101010 }), 0, 0.12, 0.01, head); eg.rotation.x = Math.PI / 2; }
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
    if (sit && n.look !== 'tea' && R() < 0.35) { const gl = mesh(geo('chai', () => new THREE.CylinderGeometry(0.025, 0.02, 0.07, 8)), std('chai', { color: 0x9a3a10, roughness: 0.15, transparent: true, opacity: 0.85 }), 0, -0.31, -0.03, this.arms[1].fo); this.cup = gl; }
    // أدوات المهنة: إبريق الشاي، المسبحة، مرشّة الماء
    const Rh = this.arms[1].fo;
    if (n.look === 'tea' && !sit) {
      // بيّاع الشاي: قوري فرفوري باليمنى (يمسكه من الإذن) وصينية استكانات باليسرى — يبقيان أفقيين مهما تحرّكت اليد
      const porc = std('porc', { color: 0xf3f0ea, roughness: 0.25 }), blue = std('porcB', { color: 0x2d5ba6, roughness: 0.3 });
      const pot = this.pot = new THREE.Group(); pot.position.set(0, -0.3, 0); Rh.add(pot);
      const body = mesh(geo('qBody', () => { const P = []; for (let i = 0; i <= 10; i++) { const t = i / 10; P.push(new THREE.Vector2(0.035 + Math.sin(t * Math.PI) * 0.03 - t * 0.012, t * 0.1)); } return new THREE.LatheGeometry(P, 14); }), porc, 0, -0.1, -0.07, pot);
      mesh(geo('qBand', () => new THREE.TorusGeometry(0.06, 0.004, 4, 16)), blue, 0, -0.05, -0.07, pot).rotation.x = Math.PI / 2;
      mesh(geo('qLid', () => new THREE.SphereGeometry(0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), porc, 0, -0.002, -0.07, pot);
      mesh(geo('qKnob', () => new THREE.SphereGeometry(0.009, 6, 5)), blue, 0, 0.03, -0.07, pot);
      mesh(geo('qSpout', () => new THREE.CylinderGeometry(0.006, 0.012, 0.08, 8)), porc, 0, -0.035, -0.145, pot).rotation.x = -0.75;
      const hd = mesh(geo('qHandle', () => new THREE.TorusGeometry(0.03, 0.007, 5, 10, Math.PI)), porc, 0, -0.045, -0.01, pot); hd.rotation.set(0, Math.PI / 2, Math.PI / 2);
      const Lh = this.arms[0].fo, tray = this.tray = new THREE.Group(); tray.position.set(0, -0.3, 0); Lh.add(tray);
      const tm = std('tray', { color: 0xd2c9b4, roughness: 0.3, metalness: 0.85 }), gl = std('estG', { color: 0xdde8ee, roughness: 0.06, transparent: true, opacity: 0.4, depthWrite: false }), tea = std('teaL', { color: 0x6a1a06, roughness: 0.1 });
      mesh(geo('trayD', () => new THREE.CylinderGeometry(0.12, 0.115, 0.012, 18)), tm, 0, 0.035, -0.07, tray);
      mesh(geo('trayR', () => new THREE.TorusGeometry(0.12, 0.006, 4, 20)), tm, 0, 0.042, -0.07, tray).rotation.x = Math.PI / 2;
      const eR = t => t < 0.38 ? 0.0185 + 0.003 * ((0.38 - t) / 0.38) ** 2 : 0.0185 + 0.008 * ((t - 0.38) / 0.62) ** 1.6;
      const shell = geo('estS', () => { const P = [new THREE.Vector2(0.001, 0)]; for (let i = 0; i <= 8; i++) P.push(new THREE.Vector2(eR(i / 8), i / 8 * 0.085)); return new THREE.LatheGeometry(P, 10); });
      const fillG = geo('estT', () => { const P = [new THREE.Vector2(0.001, 0.004)]; for (let i = 0; i <= 5; i++) { const t = i / 5 * 0.85; P.push(new THREE.Vector2(eR(t) * 0.86, 0.004 + t * 0.078)); } P.push(new THREE.Vector2(0.001, 0.004 + 0.85 * 0.078)); return new THREE.LatheGeometry(P, 10); });
      for (const [ex, ez] of [[-0.05, -0.04], [0.05, -0.05], [0, -0.13]]) { mesh(geo('saucer', () => new THREE.CylinderGeometry(0.04, 0.033, 0.007, 14)), porc, ex, 0.045, ez, tray); mesh(shell, gl, ex, 0.049, ez, tray); mesh(fillG, tea, ex, 0.049, ez, tray); }
    }
    else if (n.look === 'nursery' && !sit) { const can = this.can = new THREE.Group(); can.position.set(0, -0.32, -0.04); Rh.add(can); const gm = std('canG', { color: 0x3f7a46, roughness: 0.45, metalness: 0.5 }); mesh(geo('canB', () => new THREE.CylinderGeometry(0.06, 0.07, 0.14, 10)), gm, 0, -0.08, 0, can); mesh(geo('canS', () => new THREE.CylinderGeometry(0.008, 0.012, 0.2, 6)), gm, 0, -0.06, -0.11, can).rotation.x = -1.1; }
    else if (!sit && (n.look === 'shepherd' || n.look === 'elder2')) { // عصا الراعي / عكّازة الشايب
      const st = this.staff = mesh(geo('staff' + n.look, () => new THREE.CylinderGeometry(0.014, 0.018, n.look === 'shepherd' ? 1.55 : 0.95, 6)), std('staffW', { color: 0x5a3a20, roughness: 0.8 }), 0, n.look === 'shepherd' ? -0.2 : -0.62, -0.02, Rh);
    }
    else if (!sit && n.look === 'gravedigger') { // مسحاة
      const sv = this.shovel = new THREE.Group(); sv.position.set(0, -0.3, -0.02); Rh.add(sv);
      mesh(geo('shvH', () => new THREE.CylinderGeometry(0.016, 0.016, 1.2, 6)), std('staffW', {}), 0, -0.2, 0, sv);
      mesh(roundBox(0.2, 0.26, 0.02, 0.01), std('shvB', { color: 0x6a6660, roughness: 0.5, metalness: 0.7 }), 0, -0.88, 0, sv);
    }
    else if (!sit && n.look === 'tourist') { // كاميرا معلّقة على الصدر
      const cm = std('camB', { color: 0x161616, roughness: 0.4, metalness: 0.4 });
      this.camera = mesh(roundBox(0.13, 0.08, 0.06, 0.012), cm, 0, 0.1, -0.16, chest);
      mesh(geo('camL', () => new THREE.CylinderGeometry(0.028, 0.03, 0.05, 12)), cm, 0, 0.1, -0.205, chest).rotation.x = Math.PI / 2;
    }
    else if (!sit && (n.look === 'lablabi' || n.look === 'spice' || n.look === 'baker')) { // صدرية/مريلة
      mesh(roundBox(0.36, 0.55, 0.02, 0.01), std('apron' + n.look, { color: n.look === 'spice' ? 0x6a4a2a : 0xf4f2ec, roughness: 0.9 }), 0, 0.08, -0.14, chest);
    }
    else if (sit && !this.cup) { this.beads = mesh(geo('beads', () => new THREE.TorusGeometry(0.045, 0.008, 5, 16)), std('beads', { color: 0x5a1a12, roughness: 0.35 }), 0, -0.33, -0.01, Rh); this.beads.rotation.y = Math.PI / 2; }
    // بشت الشيخ: عباءة بنّية داكنة بحاشية ذهبية على الكتفين
    if (sheikh) {
      const bm = std('bisht', { color: 0x2a1d14, roughness: 0.75, side: THREE.DoubleSide }), gm = std('bishtGold', { color: 0xc9a24a, roughness: 0.35, metalness: 0.7 });
      const len = sit ? 0.62 : 1.18, b = mesh(geo('bisht' + len, () => new THREE.CylinderGeometry(0.25, sit ? 0.36 : 0.42, len, 16, 1, true, Math.PI * 0.18, Math.PI * 1.64)), bm, 0, 0.5 - len / 2, 0.02, chest); b.rotation.y = Math.PI;
      for (const s2 of [-1, 1]) { const tr = mesh(roundBox(0.035, 0.4, 0.02, 0.008), gm, s2 * 0.11, 0.33, -0.14, chest); tr.rotation.z = s2 * 0.12; }
    }
    mergeChildren(body);
    // أصحاب المحال (وبيّاع الشاي وزبائنه) يرجعون لبيوتهم بالليل؛ غيرهم يحملون مظلّة بالمطر
    this.shop = ['vendor', 'nursery', 'tea', 'spice', 'pharmacist', 'lablabi', 'repair', 'baker'].includes(n.look);
    this.umbOK = !this.shop && n.pose !== 'pray' || (n.look === 'tea' && sit);
    this.umbSeed = R();
    this.pose0(); this.alive = true; this.t = R() * 10; this.dead = 0; this.wave = 0; this.look = 0;
    root.traverse(o => { if (o.isMesh) o.userData.npc = n.id; });
  }
  // الوضعيات الأساسية لكل ذراع: [دوران العضد x، العضد z، الساعد x]
  basePose() {
    const n = this.n, L = [0.05, 0.12, -0.15], R = [0.05, -0.12, -0.15];
    if (n.pose === 'pray') return [[-0.35, 0.18, -1.55], [-0.35, -0.18, -1.55]];
    if (this.sit) return [[-0.5, 0.1, -0.7], [-0.55, -0.1, this.cup ? -1.35 : -0.85]];
    if (n.look === 'fisher') return [[0.42, -0.18, -1.05], [0.42, 0.18, -1.05]]; // يداه خلف ظهره يتأمّل النهر
    if (n.look === 'tea') return [[-0.3, 0.14, -1.4], [-0.25, -0.3, -1.1]]; // صينية باليسار وقوري باليمين
    if (n.look === 'vendor') return [[-0.25, 0.45, -1.2], [-0.25, -0.45, -1.2]];
    if (n.look === 'nursery') return [[-0.2, 0.2, -0.9], [-0.35, -0.15, -1.0]];
    if (n.look === 'shepherd' || n.look === 'elder2' || n.look === 'gravedigger') return [L, [-0.2, -0.12, -0.55]];
    if (n.look === 'tourist') return [[-0.3, 0.3, -1.3], [-0.3, -0.3, -1.3]];
    return [L, R];
  }
  pose0() {
    // الوجه نحو ‎-z‎: الدوران السالب حول x يرمي الذراع للخلف، لذا نعكس الإشارة (قيم الوضعيات «سالب = أمام»)
    const P = this.basePose(); this.arms.forEach((a, i) => { a.up.rotation.set(-P[i][0], 0, P[i][1]); a.fo.rotation.set(-P[i][2], 0, 0); });
    if (this.n.pose === 'pray') { this.arms[0].fo.rotation.z = 0.25; this.arms[1].fo.rotation.z = -0.25; }
    this.head.rotation.set(0, 0, 0); this.chest.rotation.set(0, 0, 0);
  }
  get here() { return this.alive && !this.away; }
  setAway(on) { if (this.away === on) return; this.away = on; this.root.visible = !on; if (on) { this.talkT = 0; this.wave = 0; } }
  // مظلّة باليد اليسرى، قبّتها فوق الرأس وتبقى عمودية
  setUmbrella(on) {
    if (!!this.umb === on && (!this.umb || this.umb.visible === on)) return;
    if (on && !this.umb) {
      const cols = [0x18181c, 0x1c2a44, 0x4a1418, 0x2b3a2a, 0x3a2c22], col = cols[Math.floor(this.umbSeed * cols.length)];
      const cm = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, side: THREE.DoubleSide }), sm = std('umbS', { color: 0x2a2a2a, roughness: 0.4, metalness: 0.6 }), hm = std('umbH', { color: 0x4a2e1a, roughness: 0.6 });
      const g = this.umb = new THREE.Group(); g.position.set(0, -0.29, 0); this.arms[0].fo.add(g);
      const add = (geom, m, x, y, z) => { const o = new THREE.Mesh(geom, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
      add(geo('umbShaft', () => new THREE.CylinderGeometry(0.008, 0.008, 0.92, 6)), sm, 0, 0.42, 0);
      add(geo('umbHook', () => new THREE.TorusGeometry(0.035, 0.01, 5, 10, Math.PI)), hm, 0.035, -0.04, 0).rotation.z = Math.PI;
      const can = add(geo('umbCan', () => new THREE.ConeGeometry(0.62, 0.22, 8, 1, true)), cm, 0, 0.8, 0); can.castShadow = true;
      add(geo('umbTip', () => new THREE.CylinderGeometry(0.006, 0.006, 0.08, 5)), sm, 0, 0.94, 0);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, r = add(geo('umbRib', () => new THREE.CylinderGeometry(0.004, 0.004, 0.02, 4)), sm, Math.cos(a) * 0.6, 0.69, Math.sin(a) * 0.6); r.scale.y = 1; }
    }
    if (this.umb) this.umb.visible = on;
  }
  // يتكلّم الآن (إيماءات باليد وإيماء بالرأس) — dur ثوانٍ
  say(dur) { this.talkT = dur; this.gHand = this.tray || (this.umb && this.umb.visible) || Math.random() < 0.7 ? 1 : 0; }
  // القوري والصينية يبقيان أفقيين (مع ميلان الصبّ)
  levelHeld() {
    if (!this.pot && !this.tray) return;
    this.root.updateMatrixWorld(true); const qr = this.root.getWorldQuaternion(_qa);
    if (this.pot) { this.pot.quaternion.copy(this.pot.parent.getWorldQuaternion(_qb).invert().multiply(qr)); if (this.pour) this.pot.quaternion.multiply(_qc.setFromAxisAngle(_X, this.pour)); }
    if (this.tray) this.tray.quaternion.copy(this.tray.parent.getWorldQuaternion(_qb).invert().multiply(qr));
  }
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
        for (const a of this.arms) { a.up.rotation.z = a.s * (0.2 + 1.2 * e); a.up.rotation.x = 0.3 * e; a.fo.rotation.x = 0.3 * e; }
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
          if (n.look === 'tea') { P[1][0] = -0.3 - 0.55 * w; P[1][1] = -0.3 + 0.12 * w; P[1][2] = -1.1 + 0.2 * w; P[0][0] = -0.3 - 0.2 * w; this.pour = 1.0 * w; } // يصبّ الشاي من القوري
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
      if (this.umb && this.umb.visible && !(this.cower > 0)) P[0] = this.sit ? [-0.55, 0.38, -1.45] : [-0.4, 0.4, -1.45]; // يمسك المظلّة أمام صدره
      if (this.raise) { P[1] = [-2.35, -0.25, -0.25]; hx -= 0.08; }
      // يمسك الرمّانة أمامه ثم يرميها
      if (this.hold) P[1] = [-1.1, -0.15, -1.5];
      if (this.aimR) { P[0] = [-1.35, 0.42, -0.55]; P[1] = [-1.2, -0.12, -0.95]; hx = -0.05; }
      if (this.throwT !== undefined) { this.throwT += dt; const T = this.throwT; if (T < 0.45) { const e = T / 0.45; P[1] = [-1.1 - 1.6 * e, -0.15 - 0.2 * e, -1.5 + 0.2 * e]; } else if (T < 0.7) { const e = (T - 0.45) / 0.25; P[1] = [-2.7 + 1.9 * e, -0.35, -1.3 + 1.1 * e]; } else P[1] = [-0.8, -0.3, -0.2]; }
      // المشي (المارّة وأهل المهام): تأرجح الذراعين وهزّة الجسم
      if (this.walkSp > 0.05) { const ph = (this.walkPh = (this.walkPh || 0) + dt * this.walkSp * 5.2), w = Math.min(1, this.walkSp); if (!(this.talkT > 0)) { P[0][0] += Math.sin(ph) * 0.38 * w; P[1][0] -= Math.sin(ph) * 0.38 * w; } this.root.position.y = n.y + Math.abs(Math.sin(ph)) * 0.035 * w; sway = Math.sin(ph) * 0.025 * w; }
      // يجلس على الطاولة (الأصحاب بالمقهى)
      // الخوف من الرمي: ينحني ويغطّي رأسه
      if (this.cower > 0) { const e = Math.min(1, this.cower * 2, (this.cowerMax - this.cower) * 4 + 0.2); P[0] = [-2.6 * e + P[0][0] * (1 - e), 0.35 * e + P[0][1] * (1 - e), -1.7 * e + P[0][2] * (1 - e)]; P[1] = [-2.6 * e + P[1][0] * (1 - e), -0.35 * e + P[1][1] * (1 - e), -1.7 * e + P[1][2] * (1 - e)]; cx = 0.5 * e; hx = 0.5 * e; }
      this.chest.rotation.y += (chestY - this.chest.rotation.y) * k;
    }
    if (this.prayP && !this.sit) { const Q = PRAY[this.prayP] || PRAY.stand; P[0] = Q.a[0].slice(); P[1] = Q.a[1].slice(); cx = Q.cx; hx = Q.hx; hy = Q.hy || 0; this.look = 0; }
    const kk = this.throwT !== undefined && this.throwT < 0.8 ? 1 : k;
    this.arms.forEach((a, i) => { const k = i === 1 ? kk : kk === 1 ? Math.min(1, dt * 7) : kk; a.up.rotation.x += (-P[i][0] - a.up.rotation.x) * k; a.up.rotation.z += (P[i][1] - a.up.rotation.z) * k; a.fo.rotation.x += (-P[i][2] - a.fo.rotation.x) * k; });
    this.head.rotation.x += (-hx - this.head.rotation.x) * k; this.head.rotation.y += (hy - this.head.rotation.y) * k; // hx موجب = يطأطئ
    this.chest.rotation.x += (-cx - this.chest.rotation.x) * k; // cx موجب = ينحني للأمام
    if (!this.sit) this.root.rotation.z = sway;
    if (!this.sit && (this.prayP || this.body.scale.y !== 1)) { const Q = PRAY[this.prayP] || { s: 1, cy: 1 }, kp = Math.min(1, dt * 6); this.body.scale.y += (Q.s - this.body.scale.y) * kp; this.chest.position.y += (Q.cy - this.chest.position.y) * kp; if (!this.prayP && Math.abs(this.body.scale.y - 1) < 0.01) { this.body.scale.y = 1; this.chest.position.y = 1; } }
    if (this.pot || this.tray) { if (!(this.talkT > 0 || this.wave > 0) || n.look !== 'tea') this.pour = this.pour || 0; else this.pour = 0; this.levelHeld(); }
    if (this.umb && this.umb.visible) { this.root.updateMatrixWorld(true); const qr = this.root.getWorldQuaternion(_qa); this.umb.quaternion.copy(this.umb.parent.getWorldQuaternion(_qb).invert().multiply(qr)).multiply(_qc.setFromAxisAngle(_X, -0.12)); }
  }
  scare(dur) { if (!this.alive || this.n.pose === 'pray') return; this.cower = dur; this.cowerMax = dur; this.talkT = 0; }
  die(dir) {
    if (!this.alive) return; this.alive = false; this.dead = 0;
    // اتجاه السقوط: بعيداً عن مصدر الطلقة
    let b = 1, s = 0; if (dir) { const fx = -Math.sin(this.n.yaw), fz = -Math.cos(this.n.yaw); const fw = dir[0] * fx + dir[2] * fz; b = fw > 0 ? 1 : -1; s = Math.sign(dir[0] * Math.cos(this.n.yaw) - dir[2] * Math.sin(this.n.yaw)) || 1; }
    this.fall = { b, s, tw: (Math.random() - 0.5) * 0.8 }; // يسقط باتجاه الطلقة (بعيداً عن الرامي)
  }
  revive() { this.alive = true; this.dead = 0; this.root.rotation.set(0, this.n.yaw, 0); this.root.position.set(this.n.x, this.n.y, this.n.z); this.head.rotation.set(0, 0, 0); this.pose0(); }
}
