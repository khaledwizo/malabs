// المقدّمة السينمائية (أول فتح للعبة): ليلة ببغداد في مضيف الشيخ فاتح الرفاعي، أخبار الغزاة على تكريت، فتوى «رد الصائل واجب شرعاً»،
// ملثّم مدسوس يغتال الشيخ بثلاث طلقات، والدفن بالفجر بالمرقد الفارغ وعمامته على القبر... وبعد أشهر قبّة خضراء. القصة خيالية بالكامل.
import * as THREE from 'three';
import { CharModel, solveArm, roundBox } from './chars.js';
import { buildGun } from './gunmodels.js';
import { signMat } from '../gfx/mats.js';
import { Civilian } from './civilians.js';
import { CAST, SCRIPT } from './introdata.js';
import { Voices, voiceId } from '../core/voices.js';
import { lite } from '../core/voicekey.js';
import { Audio } from '../core/audio.js';
import { Settings } from '../core/settings.js';

export const INTRO_KEY = 'rafidain.intro.v2';
export const introSeen = () => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch (e) { return true; } };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

// أماكن الجلوس حول السفرة (السفرة بطول المحور x في وسط المضيف)
const SEATS = {
  khaled: { x: -0.65, z: -1.0, yaw: Math.PI }, mohammed: { x: 0.75, z: -1.0, yaw: Math.PI },
  ibrahim: { x: -0.65, z: 1.0, yaw: 0 }, saif: { x: 0.75, z: 1.0, yaw: 0 },
  sheikh: { x: -2.25, z: 0, yaw: -Math.PI / 2 },
};
const HEAD_Y = 1.02;

export class Intro {
  constructor(o) { this.r = o.renderer; this.kit = o.kit; this.onDone = o.onDone; this.active = false; }
  start() {
    this.active = true; this.t = 0; this.bi = -1; this.waiting = true; this.flash = 0; this.shake = 0;
    Voices.load(); Audio.introOn = true; Audio.musicMode('intro'); // لا موسيقى خلفية أثناء المقدّمة
    this.ui();
    this.build();
  }
  // ---------- الواجهة: أشرطة سينمائية، بطاقات، ترجمة، تخطّي ----------
  ui() {
    const d = this.el = document.createElement('div'); d.id = 'intro';
    d.innerHTML = `<div class="ib t"></div><div class="ib b"></div><div class="ic"></div><div class="is"><b></b><span></span></div><div class="if"></div>
      <div class="itap"><div class="itt">جبهة الرافدين</div><div class="its">حكاية الليلة التي انطلقت فيها جبهة الرافدين</div><div class="itg">المس الشاشة للبدء</div></div><button class="iskip">تخطّي ‹</button>`;
    document.body.appendChild(d);
    this.card = d.querySelector('.ic'); this.sub = d.querySelector('.is'); this.flashEl = d.querySelector('.if');
    d.querySelector('.iskip').addEventListener('click', e => { e.stopPropagation(); this.finish(); });
    d.querySelector('.itap').addEventListener('click', () => { Audio.init(); d.querySelector('.itap').classList.add('gone'); this.waiting = false; this.t = 0; });
  }
  setCard(text, title) { this.card.innerHTML = text ? `<div class="${title ? 'icT' : ''}">${text}</div>` : ''; this.card.classList.toggle('on', !!text); }
  setSub(who, text) { const s = this.sub; if (!text) { s.classList.remove('on'); return; } s.querySelector('b').textContent = CAST[who].name; s.querySelector('span').textContent = lite(text); s.classList.add('on'); }
  // ---------- المشهد ----------
  mat(id, rx = 1, ry = 1, o = {}) {
    const base = this.kit.mats[id] && this.kit.mats[id].mat; let m;
    if (base) { m = base.clone(); m.vertexColors = false; if (m.map) { m.map = m.map.clone(); m.map.repeat.set(rx, ry); m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; m.map.needsUpdate = true; } if (m.normalMap) { m.normalMap = m.normalMap.clone(); m.normalMap.repeat.set(rx, ry); m.normalMap.wrapS = m.normalMap.wrapT = THREE.RepeatWrapping; m.normalMap.needsUpdate = true; } }
    else m = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
    Object.assign(m, o); return m;
  }
  build() {
    const S = this.scene = new THREE.Scene(); S.background = new THREE.Color(0x050608); S.fog = new THREE.Fog(0x0a0807, 9, 26);
    const cam = this.cam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 80);
    const add = (g, m, x, y, z, ry = 0, sh = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = sh; o.receiveShadow = true; S.add(o); return o; };
    const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const col = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    // الأرضية والجدران والسقف
    add(BX(16, 0.1, 9.6), this.mat('stone', 6, 4), 0, -0.05, 0, 0, false);
    add(BX(7.2, 0.012, 4.2), this.mat('carpet', 2, 1.2), 0, 0.006, 0, 0, false);
    add(BX(4.2, 0.012, 2.6), this.mat('carpet2', 1.4, 1), -5.3, 0.006, 0, 0, false);
    const wallM = this.mat('plasterWhite', 5, 1.5), wood = this.mat('woodDark', 4, 1), beamM = this.mat('beam', 1, 4);
    for (const s of [-1, 1]) { add(BX(16, 4.4, 0.3), wallM, 0, 2.2, s * 4.8); add(BX(16, 1.1, 0.06), wood, 0, 0.55, s * 4.62); }
    add(BX(0.3, 4.4, 9.6), wallM, 8, 2.2, 0); add(BX(0.06, 1.1, 9.4), wood, 7.82, 0.55, 0);
    // الجدار الغربي بفتحة الباب
    add(BX(0.3, 4.4, 4.0), wallM, -8, 2.2, -2.8); add(BX(0.3, 4.4, 4.0), wallM, -8, 2.2, 2.8); add(BX(0.3, 1.9, 1.6), wallM, -8, 3.45, 0);
    add(BX(16, 0.12, 9.6), this.mat('wood', 6, 3), 0, 4.45, 0, 0, false);
    for (let x = -7; x <= 7; x += 1.75) add(BX(0.2, 0.24, 9.6), beamM, x, 4.28, 0);
    // الباب بمصراعين على مفصلات
    this.doors = [];
    for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(-7.9, 0, s * 0.8); S.add(g); const leaf = new THREE.Mesh(BX(0.08, 2.5, 0.8), this.mat('woodDark', 1, 2)); leaf.position.set(0, 1.25, -s * 0.4); leaf.castShadow = true; g.add(leaf); const k = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), col(0xb89040)); k.position.set(0.06, 1.15, -s * 0.72); g.add(k); this.doors.push({ g, s }); }
    // شبابيك ليلية بقضبان خشبية
    for (const x of [-4.5, 0, 4.5]) {
      add(BX(1.3, 1.5, 0.05), new THREE.MeshBasicMaterial({ color: 0x0c1a2c }), x, 2.3, -4.63, 0, false);
      for (let k = -2; k <= 2; k++) add(BX(0.04, 1.5, 0.06), wood, x + k * 0.26, 2.3, -4.6, 0, false);
      add(BX(1.5, 0.1, 0.18), wood, x, 1.5, -4.58);
    }
    // أعمدة خشبية (خلف أحدها تختبئ اليد)
    for (const [x, z] of [[4.8, -1.9], [4.8, 1.9], [-4.6, -1.9], [-4.6, 1.9]]) { add(new THREE.CylinderGeometry(0.16, 0.18, 4.3, 12), this.mat('wood', 1, 3), x, 2.15, z); add(BX(0.5, 0.18, 0.5), wood, x, 4.12, z); }
    // دواشك ومساند على طول الجدران
    const red = this.mat('clothRed', 3, 1), grn = this.mat('clothGreen', 3, 1);
    for (const s of [-1, 1]) for (let x = -6.5; x <= 6.5; x += 2.2) { add(BX(2.0, 0.14, 0.8), s > 0 ? red : grn, x, 0.07, s * 4.15); const b = add(BX(1.9, 0.5, 0.18), s > 0 ? red : grn, x, 0.4, s * 4.5); b.rotation.x = s * 0.18; }
    // الوجاق: موقد بجمر ودلال قهوة
    add(BX(1.4, 0.35, 0.9), this.mat('stone', 1, 1), 6.6, 0.175, -3.6);
    const ember = new THREE.MeshStandardMaterial({ color: 0x2a0a00, emissive: 0xff5a10, emissiveIntensity: 1.6 });
    for (let k = 0; k < 9; k++) add(BX(0.12, 0.06, 0.1), ember, 6.2 + Math.random() * 0.8, 0.38, -3.85 + Math.random() * 0.5, Math.random() * 3, false);
    const brass = new THREE.MeshStandardMaterial({ color: 0xc89a48, roughness: 0.3, metalness: 0.85 });
    const dallah = new THREE.LatheGeometry([[0, 0], [0.11, 0], [0.12, 0.06], [0.08, 0.16], [0.06, 0.2], [0.09, 0.26], [0.03, 0.32], [0, 0.34]].map(p => new THREE.Vector2(p[0], p[1])), 16);
    for (const [x, s] of [[6.25, 1], [6.6, 0.85], [6.95, 0.75]]) { const o = add(dallah, brass, x, 0.42, -3.45); o.scale.setScalar(s); }
    // السفرة: قماش ومنسف رز ولحم وخبز ولبن وتمر
    const f0 = S.children.length;
    add(BX(3.8, 0.01, 1.5), this.mat('clothCream', 2, 1), 0, 0.016, 0, 0, false);
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 32), brass, 0, 0.04, 0);
    const rice = add(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), col(0xe6c06a), 0, 0.05, 0); rice.scale.y = 0.42;
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; const m = add(new THREE.SphereGeometry(0.11, 10, 8), col(0x7a4a2a), Math.cos(a) * 0.18, 0.21, Math.sin(a) * 0.18); m.scale.set(1.3, 0.7, 1); }
    const breadM = col(0xd9a85f), bowlM = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.4 }), glassM = new THREE.MeshStandardMaterial({ color: 0xc8dde0, roughness: 0.1, transparent: true, opacity: 0.55 });
    for (const [x, z] of [[-1.3, -0.45], [-1.3, 0.45], [1.35, -0.45], [1.35, 0.45], [-0.9, -0.55], [0.95, 0.55]]) add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 18), breadM, x, 0.03, z);
    for (const [x, z] of [[-0.65, -0.55], [0.75, -0.55], [-0.65, 0.55], [0.75, 0.55], [-1.7, 0]]) { add(new THREE.CylinderGeometry(0.07, 0.05, 0.06, 14), bowlM, x + 0.25, 0.05, z); add(new THREE.CylinderGeometry(0.03, 0.026, 0.09, 10), glassM, x - 0.2, 0.06, z * 0.8); }
    add(new THREE.CylinderGeometry(0.16, 0.13, 0.03, 18), bowlM, 1.6, 0.03, 0); for (let k = 0; k < 7; k++) add(new THREE.SphereGeometry(0.022, 6, 5), col(0x4a2412), 1.6 + Math.cos(k) * 0.07, 0.055, Math.sin(k * 1.7) * 0.07);
    this.foodItems = S.children.slice(f0 + 1); // كل شي فوق القماش
    // أثر الانفجار (مخفي حتى الانفجار): بقعة محروقة وشظايا
    this.scorch = add(new THREE.CircleGeometry(0.9, 24), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1, transparent: true, opacity: 0.85 }), 0, 0.03, 0.1, 0, false); this.scorch.rotation.x = -Math.PI / 2; this.scorch.visible = false;
    this.debris = []; for (let k = 0; k < 16; k++) { const d = add(BX(0.06 + Math.random() * 0.1, 0.03, 0.05 + Math.random() * 0.08), k % 3 ? col(0x3a2a1c) : col(0xd9a85f), (Math.random() - 0.5) * 4, 0.02, (Math.random() - 0.5) * 2.6, Math.random() * 3); d.visible = false; this.debris.push(d); }
    // مساند الجالسين
    for (const k in SEATS) { const s = SEATS[k]; add(BX(0.75, 0.13, 0.7), k === 'sheikh' ? red : grn, s.x - Math.sin(s.yaw) * 0.18, 0.065, s.z - Math.cos(s.yaw) * 0.18 * -1, s.yaw); }
    // الفوانيس والإضاءة الدافئة
    S.add(new THREE.HemisphereLight(0x40506a, 0x1a1008, 0.35));
    const moon = new THREE.DirectionalLight(0x6a86c0, 0.35); moon.position.set(-2, 6, -10); S.add(moon);
    this.lamps = [];
    const glassL = new THREE.MeshStandardMaterial({ color: 0xffd090, emissive: 0xffa040, emissiveIntensity: 2.2 });
    for (const [x, z, i] of [[-2.6, 0, 7], [1.6, 0, 8], [6.4, -3.0, 5]]) {
      add(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4), brass, x, 3.6, z, 0, false); const l = add(new THREE.CylinderGeometry(0.13, 0.11, 0.32, 8), glassL, x, 2.75, z, 0, false); add(new THREE.ConeGeometry(0.17, 0.16, 8), brass, x, 2.98, z, 0, false);
      const pl = new THREE.PointLight(0xffa860, i, 11, 1.6); pl.position.set(x, 2.6, z); if (this.kit.Q.shadow > 0 && x === 1.6) { pl.castShadow = true; pl.shadow.mapSize.set(512, 512); pl.shadow.bias = -0.002; } S.add(pl); this.lamps.push({ pl, base: i, ph: Math.random() * 9, l });
    }
    this.fire = new THREE.PointLight(0xff6a20, 3.2, 6, 2); this.fire.position.set(6.6, 0.7, -3.4); S.add(this.fire);
    this.key = new THREE.PointLight(0xffc896, 0, 3.2, 2); S.add(this.key); // إضاءة وجه المتكلّم في اللقطات القريبة
    this.doorLight = new THREE.PointLight(0x8fb0ff, 0, 7, 1.8); this.doorLight.position.set(-9.2, 2.0, 0); S.add(this.doorLight);
    // الشخصيات الأربع جالسة، والشيخ واقف بالباب ثم جالس في الصدر
    this.actors = {};
    for (const k of ['khaled', 'mohammed', 'ibrahim', 'saif']) {
      const m = new CharModel(CAST[k].char, k === 'khaled' || k === 'mohammed' ? 0 : 1); S.add(m.root);
      const s = SEATS[k]; m.root.position.set(s.x, 0, s.z);
      this.actors[k] = { m, seat: s, stand: 0, talk: 0, look: 0, lookT: 0, hand: 0, react: 0, ph: Math.random() * 6 };
    }
    const sh = SEATS.sheikh;
    this.sheikhSit = new Civilian({ id: 90, x: sh.x - 0.12, y: -0.3, z: sh.z, yaw: sh.yaw, pose: 'sit', look: 'sheikhF', stool: false, seed: 77 });
    this.sheikhStand = new Civilian({ id: 91, x: -7.35, y: 0, z: 0, yaw: -Math.PI / 2, pose: 'stand', look: 'sheikhF', seed: 77 });
    S.add(this.sheikhSit.root); S.add(this.sheikhStand.root); this.sheikhSit.root.visible = false; this.sheikhStand.root.visible = false;
    // اليد الخفيّة والرمّانة
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 1 });
    // الملثّم المدسوس بالباب — لا شعارات ولا رايات
    this.stranger = new Civilian({ id: 92, x: -8.55, y: 0, z: 0.28, yaw: -Math.PI / 2, pose: 'stand', look: 'masked', seed: 13 });
    S.add(this.stranger.root); this.stranger.root.visible = false;
    // بندقيته بين إيديه
    { const gun = buildGun('rafid').group; gun.scale.setScalar(1.05); gun.position.set(0.1, 0.36, -0.2); this.stranger.chest.add(gun); this.strangerGun = gun;
      this.muzzle = new THREE.PointLight(0xffc070, 0, 5, 2); this.muzzle.position.set(0.1, 0.4, -0.95); this.stranger.chest.add(this.muzzle); }
    // لوحة باسم الشيخ بالخط الكوفي على الجدار الجنوبي (خلف السفرة)
    { const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), signMat('الشيخ فاتح الرفاعي', { kufi: true, sub: 'مضيف أهل العلم والكرم', w: 1024, h: 384, glow: 0.35 })); pl.position.set(-2.25, 2.55, 4.6); pl.rotation.y = Math.PI; S.add(pl); this.plaque = pl; }
    this.buildBurial();
    this.strangerLight = new THREE.PointLight(0x9ab0e0, 0, 2.6, 2); this.strangerLight.position.set(-7.6, 1.9, 0.6); S.add(this.strangerLight);
    this.doorTarget = 0; this.doorOpen = 0;
    const nade = this.nade = new THREE.Group(); S.add(nade); nade.visible = false;
    const nb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: 0x3a4628, roughness: 0.55, metalness: 0.3 })); nb.scale.y = 1.25; nade.add(nb);
    const lever = new THREE.Mesh(BX(0.016, 0.07, 0.012), new THREE.MeshStandardMaterial({ color: 0x8a8a80, metalness: 0.8, roughness: 0.3 })); lever.position.set(0.03, 0.04, 0); nade.add(lever);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.03, 10), lever.material); top.position.y = 0.06; nade.add(top);
    this.camPos = V3(5.5, 2.4, 3.6); this.camLook = V3(0, 0.8, 0); this.shot = null;
  }
  // ---------- لقطات الكاميرا ----------
  head(k) { if (k === 'sheikh') { const s = SEATS.sheikh; return V3(s.x - 0.1, 0.98, s.z); } const a = this.actors[k], s = a.seat; return V3(s.x, a.stand > 0.5 ? 1.68 : HEAD_Y, s.z); }
  faceShot(k, side, dist, up = 0.04) {
    const h = this.head(k), yaw = k === 'sheikh' ? SEATS.sheikh.yaw : this.actors[k].seat.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    return [V3(h.x + fx * dist + rx * side, h.y + up, h.z + fz * dist + rz * side), V3(h.x, h.y - 0.02, h.z)];
  }
  shotOf(n) {
    switch (n) {
      case 'out': return [V3(7.2, 2.2, 3.4), V3(0, 0.9, 0), V3(-0.6, 0, -0.3)];
      case 'wide': return [V3(5.4, 2.3, 3.6), V3(-0.5, 0.7, 0), V3(-0.5, -0.1, -0.2)];
      case 'wide2': return [V3(-4.6, 1.9, -3.1), V3(0.4, 0.7, 0), V3(0.4, 0, 0.3)];
      case 'wideStand': return [V3(3.6, 2.0, 3.4), V3(-2.5, 1.3, 0), V3(-0.2, 0, -0.1)];
      case 'wideLow': return [V3(3.0, 0.65, 2.3), V3(0, 0.6, 0), V3(0, 0, 0)];
      case 'door': return [V3(-3.4, 1.55, 1.6), V3(-7.5, 1.5, 0), V3(-0.3, 0, -0.15)];
      case 'hands': return [V3(2.7, 1.3, 0.9), V3(0.0, 0.62, 0), V3(-0.35, -0.1, -0.1)];
      case 'shadow': return [V3(3.85, 1.2, -0.45), V3(4.85, 1.02, -1.7), V3(0.12, 0, -0.06)];
      case 'grenade': return [V3(2.45, 0.45, -0.15), V3(-1.0, 0.1, 0.25), V3(-0.25, 0, 0.05)];
      case 'door2': return [V3(-4.9, 1.45, 1.5), V3(-8.3, 1.45, 0.25), V3(-0.25, 0, -0.1)];
      case 'doorHand': return [V3(-6.35, 1.32, 0.45), V3(-8.45, 1.28, 0.3), V3(-0.15, 0, -0.03)];
      case 'after': return [V3(4.0, 1.75, 2.8), V3(-0.3, 1.1, 0), V3(-0.4, 0, -0.2)];
      case 'afterS': return [V3(0.05, 1.72, -2.55), V3(0.35, 1.45, 1.65), V3(0.06, 0, 0.04)];
      case 'afterI': return [V3(0.35, 1.7, -0.55), V3(-0.65, 1.6, 1.5), V3(0.08, 0, 0)];
      case 'sheikh': return [...this.faceShot('sheikh', 0.45, 1.3), V3(0, 0, 0)];
      case 'sheikh2': return [...this.faceShot('sheikh', -0.5, 1.6, 0.15), V3(0, 0, 0)];
      case 'sheikhClose': return [...this.faceShot('sheikh', 0.22, 0.95, -0.07), V3(0, 0, 0)];
      case 'plaque': return [V3(-2.25, 1.75, 1.6), V3(-2.25, 2.5, 4.6), V3(0.25, 0.08, 0.15)];
      case 'dying': { const r = this.sheikhSit.root.position, h = this.sheikhSit.head.getWorldPosition(V3(0, 0, 0)), m = V3((r.x + h.x) / 2, 0.15, (r.z + h.z) / 2), d = V3(h.x - r.x, 0, h.z - r.z).normalize(); return [V3(m.x - d.z * 1.5 + d.x * 0.6, 1.45, m.z + d.x * 1.5 + d.z * 0.6), V3(m.x + d.x * 0.25, 0.15, m.z + d.z * 0.25), V3(0.05, -0.12, 0.05)]; }
      case 'grave': { const X = this.bx; return [V3(X - 3.2, 1.75, 2.8), V3(X + 3.2, 1.1, 0), V3(0.6, 0, -0.3)]; }
      case 'graveTurban': { const X = this.bx; return [V3(X + 1.7, 1.45, 1.25), V3(X + 3.3, 0.7, 0), V3(0.15, -0.05, -0.1)]; }
      case 'vow': { const X = this.bx; return [V3(X + 4.2, 1.45, 0.5), V3(X + 0.9, 1.45, 0), V3(-0.1, 0, -0.15)]; }
      case 'shrineBuilt': { const X = this.bx; return [V3(X - 6.5, 2.6, 4.8), V3(X + 3.2, 2.4, 0), V3(1.4, 0.2, -1.0)]; }
      case 'shrineBuilt2': { const X = this.bx; return [V3(X + 0.4, 1.5, 0.35), V3(X + 3.3, 0.85, 0), V3(0.35, -0.05, -0.1)]; }
      case 'black': return null;
    }
    const gm = /^grave(K|M)$/.exec(n);
    if (gm) { const k = gm[1] === 'K' ? 'khaled' : 'mohammed'; return [...this.faceShot(k, gm[1] === 'K' ? 0.4 : -0.42, 1.05, 0.02), V3(0, 0, 0)]; }
    const am = /^after(M|K|K2|S2)$/.exec(n);
    if (am) { const k = { M: 'mohammed', K: 'khaled', K2: 'khaled', S2: 'saif' }[am[1]]; return [...this.faceShot(k, am[1] === 'K2' ? 0.32 : am[1] === 'S2' ? -0.3 : -0.4, am[1] === 'S2' ? 0.9 : 1.0, am[1] === 'S2' ? -0.12 : 0.03), V3(0, 0, 0)]; }
    const m = /^(khaled|mohammed|ibrahim|saif)(2?)$/.exec(n);
    if (m) return [...this.faceShot(m[1], m[2] ? -0.42 : 0.42, m[2] ? 0.85 : 1.15), V3(0, 0, 0)];
    return [V3(5.4, 2.3, 3.6), V3(0, 0.7, 0), V3(0, 0, 0)];
  }
  cut(n) { this.shot = n; this.shotT = 0; const s = this.shotOf(n); if (s) { this.s0 = s; } }
  // ---------- الخط الزمني ----------
  beat(i) {
    const b = SCRIPT[i]; this.bi = i; this.bt = 0; this.cut(b.shot);
    this.setCard(b.card || (b.title ? 'جبهة الرافدين' : ''), !!b.title);
    if (b.act) this.act(b.act);
    let dur = 0; this.voice = null;
    if (b.who) {
      const per = CAST[b.who], id = voiceId(per, b.text, !!b.loud);
      dur = Voices.has(id) ? Voices.dur(id) : 0.6 + b.text.length * 0.072 * (1 - per.r / 100);
      if (Voices.has(id)) this.voice = Voices.play(id, Math.min(1, Settings.volume * 1.1), null);
      this.setSub(b.who, b.text); this.speaker = b.who;
      { const h = this.head(b.who), yaw = b.who === 'sheikh' ? SEATS.sheikh.yaw : this.actors[b.who].seat.yaw; this.key.position.set(h.x - Math.sin(yaw) * 0.9, h.y + 0.35, h.z - Math.cos(yaw) * 0.9); this.key.intensity = /sheikh|khaled|mohammed|ibrahim|saif/.test(b.shot) ? 1.3 : 0; }
      if (b.who === 'sheikh') { const c = this.sheikhSit.root.visible ? this.sheikhSit : this.sheikhStand; c.say(dur); }
      else { this.actors[b.who].talk = dur; const prev = this.lastWho && this.lastWho !== b.who ? this.lastWho : (b.who === 'khaled' || b.who === 'mohammed' ? 'ibrahim' : 'mohammed'); this.actors[b.who].lookAt = this.sheikhSit.root.visible && prev === 'sheikh' ? 'sheikh' : prev; }
      this.lastWho = b.who;
      // الكل يلتفت للمتكلّم
      for (const k in this.actors) if (k !== b.who) this.actors[k].lookAt = b.who;
      if (this.sheikhSit.root.visible && b.who !== 'sheikh') { const h = this.head(b.who); this.sheikhSit.focus(h.x, h.z, dur + 1); }
    } else { this.setSub(null); this.speaker = null; this.key.intensity = 0; }
    this.bdur = dur + (b.hold ?? 0.45);
  }
  act(a) {
    const A = this.actors;
    if (a === 'door') { this.doorTarget = 1.25; this.sheikhStand.root.visible = true; Audio.play('creak'); for (const k in A) A[k].lookAt = 'door'; }
    if (a === 'stand') this.standT = 0;
    if (a === 'sheikhSeat') { this.sheikhStand.root.visible = false; this.sheikhSit.root.visible = true; this.standT = -1; for (const k in A) A[k].stand = 0; this.doorTarget = 0; }
    if (a === 'sheikhHand') { this.sheikhSit.raise = true; this.drone = true; }
    if (a === 'handshake') { this.sheikhSit.raise = false; A.ibrahim.handT = 0; A.mohammed.handT = -0.9; A.ibrahim.lookAt = 'mohammed'; A.mohammed.lookAt = 'ibrahim'; Audio.play('heart'); }
    if (a === 'stranger') { this.stranger.root.visible = true; this.doorTarget = 1.15; this.strangerLight.intensity = 3.2; Audio.play('creak'); }
    if (a === 'pin') { this.stranger.hold = true; this.nade.visible = true; this.nadeHeld = true; setTimeout(() => this.active && Audio.play('pin', [-8.2, 1.3, 0.3]), 700); }
    if (a === 'grenade') { this.stranger.hold = false; this.stranger.throwT = 0; this.throwAt = this.t + 0.55; this.bounced = 0; for (const k in A) A[k].react = 0; }
    if (a === 'aftermath') this.aftermath();
    if (a === 'aim') { A.ibrahim.m.setWeapon('rafid'); A.saif.m.setWeapon('nisr'); A.mohammed.m.setWeapon('dijla'); for (const k of ['ibrahim', 'saif', 'mohammed']) A[k].aim = 1; Audio.play('draw', [0.7, 1.2, 1.5]); }
    if (a === 'cock') Audio.play('reload', [0.75, 1.3, 1.6]);
    if (a === 'shots') { const P = [[0.7, 1.4, 1.6], [-0.6, 1.4, -1.5], [0.6, 1.3, -1.6], [-0.7, 1.4, 1.5]]; [0, 0.09, 0.18, 0.3, 0.42, 0.55, 0.8, 0.88, 1.05, 1.2, 1.32, 1.5].forEach((d, i) => setTimeout(() => this.active && Audio.play(i % 3 === 1 ? 'pistol' : 'rifleHeavy', P[i % 4]), d * 1000)); }
    if (a === 'drone') this.drone = true;
    if (a === 'calm') { this.sheikhSit.raise = false; this.drone = false; }
    if (a === 'eat') { for (const k in A) { A[k].eat = 0.001 + Object.keys(A).indexOf(k) * 0.7; A[k].lookAt = null; } }
    if (a === 'aim') { this.stranger.aimR = true; this.strangerLight.intensity = 5; this.strangerLight.position.set(-7.7, 1.8, 0.35); Audio.play('reload', [-8.3, 1.3, 0.3]); for (const k in A) A[k].lookAt = 'door'; }
    if (a === 'shots3') { this.shotsAt = this.t; this.shotN = 0; for (const k in A) A[k].eat = 0; }
    if (a === 'flee') { this.stranger.aimR = false; this.stranger.root.visible = false; this.doorTarget = 0.7; Audio.play('creak'); this.strangerLight.intensity = 0; }
    if (a === 'aftermath') this.aftermathShot();
    if (a === 'dying') { this.key.intensity = 2.2; this.key.distance = 4; this.key.position.set(-1.9, 1.3, 0.2); }
    if (a === 'burialSet') this.toBurial();
    if (a === 'turban') { this.turbanT = 0; this.turban.visible = true; }
    if (a === 'build') { this.buildT = 0; for (const k in A) A[k].m.root.visible = false; for (const c of this.mourners) c.root.visible = false; this.sun.intensity = 2.6; this.sun.color.set(0xfff0d8); }
    if (a === 'boom') { this.boomT = 0; this.expo = 2.4; this.expoT = 0; this.expoRate = 1.1; this.flash = 1; this.shake = 1; Audio.play('boom', [-0.1, 0.2, 0.1]); setTimeout(() => this.active && Audio.play('ring'), 250); for (const k in A) A[k].react = 1; this.nade.visible = false; for (const o of this.foodItems) o.visible = false; this.scorch.visible = true; for (const d of this.debris) d.visible = true; this.sheikhSit.die([1, 0, 0.2]); }
  }
  // بعد الانفجار: غبار ودخان، الشيخ على الأرض، والكل واقف بعيداً عن السفرة
  aftermath() {
    const S = this.scene; S.fog = new THREE.Fog(0x2e241a, 0.8, 9); S.background = new THREE.Color(0x120d09);
    for (const L of this.lamps) L.base *= 0.45; this.lamps[1].base = 0.4;
    const P = { khaled: [-0.75, -1.65, Math.PI], mohammed: [0.85, -1.75, Math.PI], ibrahim: [-0.7, 1.6, 0], saif: [0.8, 1.7, 0] };
    for (const k in this.actors) { const a = this.actors[k], p = P[k]; a.seat = { x: p[0], z: p[1], yaw: p[2] }; a.m.root.position.set(p[0], 0, p[1]); a.after = true; a.react = 0; a.stand = 1; }
    this.key.intensity = 0; this.expo = 0.15; this.expoT = 0.95; this.expoRate = 0.9;
    // نار صغيرة على السفرة المحروقة تضيء الوجوه من تحت
    this.blaze = new THREE.PointLight(0xff7a2a, 4.5, 6, 1.6); this.blaze.position.set(0, 0.45, 0.1); S.add(this.blaze);
    const fm = new THREE.MeshStandardMaterial({ color: 0x331000, emissive: 0xff6a14, emissiveIntensity: 2.4, transparent: true, opacity: 0.85 });
    this.flames = []; for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.06 + Math.random() * 0.05, 0.25 + Math.random() * 0.2, 6), fm); f.position.set((Math.random() - 0.5) * 0.7, 0.15, 0.1 + (Math.random() - 0.5) * 0.5); S.add(f); this.flames.push(f); }
  }
  // بعد الطلقات: المضيف ساكت إلا الوجاق، الأصحاب واقفين حول الشيخ
  aftermathShot() {
    const S = this.scene; S.fog = new THREE.Fog(0x0c0907, 4, 18);
    for (const L of this.lamps) L.base *= 0.7;
    const P = { khaled: [-6.2, 0.6, Math.PI / 2], mohammed: [-1.6, 1.6, Math.PI / 2 + 0.7], ibrahim: [-1.5, -1.55, Math.PI / 2 - 0.7], saif: [-4.6, -1.2, -Math.PI / 2 + 0.5] };
    for (const k in this.actors) { const a = this.actors[k], p = P[k]; a.seat = { x: p[0], z: p[1], yaw: p[2] }; a.m.root.position.set(p[0], 0, p[1]); a.after = true; a.react = 0; a.stand = 1; a.eat = 0; }
    this.key.intensity = 0;
  }
  // موقع الدفن بالفجر: مقبرة قديمة ومرقد فارغ بلا قبّة، وبعد أشهر سياج وقبّة خضراء
  buildBurial() {
    const S = this.scene, X = this.bx = 40, G = this.burial = new THREE.Group(); G.visible = false; S.add(G);
    const add = (g, m, x, y, z, ry = 0, par = G) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; par.add(o); return o; };
    const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    add(BX(40, 0.1, 40), this.mat('graveDirt', 10, 10), X, -0.05, 0);
    const brick = this.mat('brickPale', 2, 1.2), tile = this.mat('tileGreen', 2, 1), stone = this.mat('tomb', 1, 1);
    // المرقد القديم: ثلاث جدران وفتحة واسعة باتجاهنا (غرب) وسقف مستوي
    add(BX(3.8, 3.0, 0.35), brick, X + 3.3, 1.5, -1.9); add(BX(3.8, 3.0, 0.35), brick, X + 3.3, 1.5, 1.9); add(BX(0.35, 3.0, 4.15), brick, X + 5.2, 1.5, 0);
    add(BX(0.4, 3.0, 0.9), brick, X + 1.45, 1.5, -1.5); add(BX(0.4, 3.0, 0.9), brick, X + 1.45, 1.5, 1.5); add(BX(0.4, 0.7, 4.15), brick, X + 1.45, 2.65, 0);
    add(BX(4.2, 0.25, 4.3), brick, X + 3.3, 3.12, 0);
    // القبر داخل المرقد
    add(BX(1.9, 0.55, 0.9), stone, X + 3.3, 0.275, 0); add(BX(0.12, 0.7, 0.5), stone, X + 4.3, 0.35, 0);
    // قبور قديمة حوالي المرقد ونخيل
    for (let k = 0; k < 14; k++) { const x = X - 8 + (k % 7) * 2.2 + Math.random() * 0.5, z = (k < 7 ? -1 : 1) * (5 + Math.random() * 4); add(BX(1.4, 0.3, 0.6), stone, x, 0.15, z, Math.random() * 0.2); add(BX(0.1, 0.55 + Math.random() * 0.3, 0.4), stone, x + 0.7, 0.3, z); }
    for (const [x, z] of [[X - 6, -7], [X + 8, 6], [X - 2, 9], [X + 9, -8]]) { add(new THREE.CylinderGeometry(0.16, 0.22, 7, 8), this.mat('wood', 1, 4), x, 3.5, z); for (let k = 0; k < 7; k++) { const g = new THREE.PlaneGeometry(2.2, 0.6); g.translate(1.1, 0, 0); const l = add(g, new THREE.MeshStandardMaterial({ color: 0x4f6a2a, side: THREE.DoubleSide, roughness: 0.9 }), x, 7, z, k / 7 * 6.28); l.rotation.z = -0.5; } }
    // العمامة البيضاء
    const tm = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.95 }); const tu = this.turban = new THREE.Group(); G.add(tu); tu.visible = false;
    for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.15 - k * 0.016, 0.05 - k * 0.005, 8, 18), tm); r.rotation.x = Math.PI / 2; r.rotation.z = k * 0.4; r.position.y = k * 0.035; tu.add(r); }
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), tm); cap.scale.y = 0.75; cap.position.y = 0.04; tu.add(cap);
    this.turbanFrom = V3(X + 2.25, 1.1, -0.45); this.turbanTo = V3(X + 3.0, 0.58, 0);
    // البناء بعد أشهر: سياج نحاسي حول القبر، كاشي أخضر، قبّة، وراية
    this.builds = [];
    const B2 = (o, d) => { o.userData.s = [o.scale.x, o.scale.y, o.scale.z]; o.visible = false; this.builds.push([o, d]); return o; };
    const brass = new THREE.MeshStandardMaterial({ color: 0xd2a24c, roughness: 0.3, metalness: 0.85 });
    for (let k = 0; k <= 10; k++) for (const zz of [-0.65, 0.65]) B2(add(BX(0.03, 1.4, 0.03), brass, X + 2.2 + k * 0.22, 0.7, zz), 0.0 + k * 0.02);
    for (let k = 0; k <= 5; k++) for (const xx of [X + 2.2, X + 4.4]) B2(add(BX(0.03, 1.4, 0.03), brass, xx, 0.7, -0.65 + k * 0.26), 0.1 + k * 0.02);
    B2(add(BX(2.3, 0.07, 1.4), brass, X + 3.3, 1.42, 0), 0.25);
    B2(add(BX(3.9, 0.6, 0.1), tile, X + 3.3, 2.0, -1.7), 0.3); B2(add(BX(3.9, 0.6, 0.1), tile, X + 3.3, 2.0, 1.7), 0.3); B2(add(BX(0.1, 0.6, 3.4), tile, X + 5.0, 2.0, 0), 0.3);
    B2(add(new THREE.CylinderGeometry(1.9, 1.9, 0.9, 8), tile, X + 3.3, 3.7, 0, Math.PI / 8), 0.4);
    B2(add(new THREE.SphereGeometry(1.95, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), tile, X + 3.3, 4.12, 0), 0.5);
    B2(add(new THREE.CylinderGeometry(0.04, 0.12, 0.9, 8), brass, X + 3.3, 6.4, 0), 0.6);
    B2(add(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshStandardMaterial({ color: 0x1f7a3a, side: THREE.DoubleSide }), X + 3.75, 6.6, 0, Math.PI / 2), 0.6);
    this.shrineGlow = new THREE.PointLight(0x9effb8, 0, 6, 1.6); this.shrineGlow.position.set(X + 3.3, 1.8, 0); G.add(this.shrineGlow);
    // ضوء الفجر
    this.sun = new THREE.DirectionalLight(0xffc89a, 0); this.sun.position.set(X - 20, 8, 12); this.sun.target.position.set(X + 3, 0, 0); G.add(this.sun); G.add(this.sun.target);
    this.skyFill = new THREE.HemisphereLight(0xa8b8d8, 0x5a4634, 0); G.add(this.skyFill);
    // المعزّين
    this.mourners = [[X - 0.6, -1.9, -Math.PI / 2 + 0.3, 'elder'], [X - 0.9, 2.0, -Math.PI / 2 - 0.3, 'pilgrim'], [X + 0.2, 2.5, -Math.PI / 2 - 0.5, 'vendor']].map(([x, z, yaw, look], i) => { const c = new Civilian({ id: 95 + i, x, y: 0, z, yaw, pose: 'stand', look, seed: 31 + i * 9 }); c.root.visible = false; S.add(c.root); return c; });
  }
  toBurial() {
    const S = this.scene, keep = new Set([this.burial, ...Object.values(this.actors).map(a => a.m.root), ...this.mourners.map(c => c.root)]);
    for (const o of S.children) if (!keep.has(o) && !o.isLight) o.visible = false;
    for (const L of this.lamps) L.base = 0; this.fire.intensity = 0; this.fireOff = true; this.key.intensity = 0; this.doorLight.intensity = 0;
    if (this.blaze) this.blaze.intensity = 0;
    this.burial.visible = true; this.sun.intensity = 1.9; this.skyFill.intensity = 0.95;
    { const f = new THREE.PointLight(0xffd8b0, 1.6, 7, 1.6); f.position.set(this.bx + 3.6, 1.7, 0.2); this.burial.add(f); }
    S.background = new THREE.Color(0xc9a283); S.fog = new THREE.Fog(0xc9a283, 10, 48);
    const X = this.bx, P = { khaled: [X + 1.9, -0.55, -Math.PI / 2], mohammed: [X + 1.7, 0.75, -Math.PI / 2], saif: [X + 0.6, -1.05, -Math.PI / 2 + 0.2], ibrahim: [X + 0.5, 1.15, -Math.PI / 2 - 0.2] };
    for (const k in this.actors) { const a = this.actors[k], p = P[k]; a.seat = { x: p[0], z: p[1], yaw: p[2] }; a.m.root.position.set(p[0], 0, p[1]); a.m.setWeapon(null); a.after = true; a.aim = 0; a.react = 0; a.stand = 1; a.m.root.visible = true; }
    for (const c of this.mourners) c.root.visible = true;
    this.expo = 1.0; this.expoT = 1.05;
  }
  frame(dt) {
    if (!this.active) return;
    dt = Math.min(dt, 0.05);
    if (this.waiting) { this.t += dt; this.updateScene(dt); this.renderShot(dt); return; }
    this.t += dt;
    if (this.bi < 0) this.beat(0);
    this.bt += dt;
    if (this.bt >= this.bdur) { if (this.bi + 1 >= SCRIPT.length) return this.finish(); this.beat(this.bi + 1); }
    this.updateScene(dt);
    this.renderShot(dt);
  }
  updateScene(dt) {
    const t = this.t;
    for (const L of this.lamps) { L.pl.intensity = L.base * (0.88 + Math.sin(t * 7 + L.ph) * 0.05 + Math.sin(t * 13.1 + L.ph * 2) * 0.04); }
    if (!this.fireOff) this.fire.intensity = 3.0 + Math.sin(t * 9) * 0.5 + Math.sin(t * 23) * 0.3;
    if (this.blaze) { this.blaze.intensity = 4.2 + Math.sin(t * 11) * 0.8 + Math.sin(t * 27) * 0.5; this.flames.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(t * 9 + i * 1.7) * 0.25; f.rotation.y = t * 2 + i; }); }
    // طقطقة الجمر بالوجاق
    if (!this.waiting && !this.fireOff && Audio.ctx && Math.random() < dt * 1.4) { try { const o = Audio.out([6.6, 0.4, -3.6], 0.05, 3, 30); Audio.nz(o, Audio.ctx.currentTime, 0.02 + Math.random() * 0.03, 700 + Math.random() * 1100, 500, 1.2, 'bandpass', 0.5, 0.002); } catch (e) { } } // طقطقة جمر خافتة ودافئة
    // الباب ينفتح ثم يتسكّر
    this.doorOpen += (this.doorTarget - this.doorOpen) * Math.min(1, dt * 1.6); for (const D of this.doors) D.g.rotation.y = D.s * this.doorOpen; this.doorLight.intensity = this.doorOpen * 4;
    // وقوف الجالسين احتراماً للشيخ
    if (this.standT !== undefined && this.standT >= 0) { this.standT += dt; for (const k in this.actors) this.actors[k].stand = ease((this.standT - 0.15 * Object.keys(this.actors).indexOf(k)) / 0.9); }
    // الغريب يفلت من الباب بعد الرمي
    if (this.throwAt && this.t > this.throwAt + 1.3 && this.stranger.root.visible) { this.stranger.root.visible = false; this.strangerLight.intensity = 0; this.doorTarget = 0.9; }
    if (this.throwAt && this.nadeHeld && this.t >= this.throwAt) { this.nadeHeld = false; this.nadeT = 0; this.n0 = this.nade.position.clone(); }
    // الرمّانة: قوس ثم ارتداد ثم تدحرج حتى تستقر وسط السفرة
    if (this.nade.visible && this.nadeHeld) { const h = this.stranger.arms[1].fo.localToWorld(V3(0, -0.32, -0.02)); this.nade.position.copy(h); this.nade.rotation.set(0, 0, 0.3); }
    else if (this.nade.visible) {
      this.nadeT += dt; const T = this.nadeT, n = this.nade;
      const p0 = this.n0 || V3(-8.2, 1.5, 0.3);
      if (T < 0.95) { const e = T / 0.95; n.position.set(p0.x + (-1.3 - p0.x) * e, p0.y + (0.05 - p0.y) * e + Math.sin(e * Math.PI) * 1.0, p0.z + (0.35 - p0.z) * e); if (e > 0.5) for (const k in this.actors) this.actors[k].lookAt = 'nade'; }
      else { if (!this.bounced) { this.bounced = 1; Audio.play('bounce', [-1.3, 0, 0.35]); this.sheikhSit.focus(-0.5, 0.2, 4); } const e = Math.min(1, (T - 0.95) / 1.1), k = 1 - Math.pow(1 - e, 3); n.position.set(-1.3 + k * 1.2, 0.06 + Math.abs(Math.sin(e * 9)) * 0.07 * (1 - e), 0.35 - k * 0.23); }
      n.rotation.z -= dt * (T < 2 ? 14 * (1 - Math.min(1, T / 2)) : 0); n.rotation.x += dt * 3 * (1 - Math.min(1, T / 2));
    }
    // الطلقات الثلاث: وميض بالباب، والشيخ يطيح بالثانية
    if (this.shotsAt !== undefined && this.shotN < 3 && this.t >= this.shotsAt + 0.25 + this.shotN * 0.42) {
      this.shotN++; Audio.play('rifleHeavy', [-8.3, 1.4, 0.3]); this.muzzle.intensity = 9; this.shake = Math.max(this.shake, 0.5); this.flash = Math.max(this.flash, 0.18);
      if (this.shotN === 2) { this.sheikhSit.n.y = -0.05; this.sheikhSit.die([1, 0, 0.15]); for (const k in this.actors) this.actors[k].react = 1; }
    }
    if (this.muzzle && this.muzzle.intensity > 0) this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 60);
    // العمامة تنحط على القبر
    if (this.turbanT !== undefined && this.turbanT < 1) { this.turbanT = Math.min(1, this.turbanT + dt / 2.4); const e = ease(this.turbanT), a0 = this.turbanFrom, a1 = this.turbanTo; this.turban.position.set(a0.x + (a1.x - a0.x) * e, a0.y + (a1.y - a0.y) * e + Math.sin(e * Math.PI) * 0.25, a0.z + (a1.z - a0.z) * e); if (this.turbanT >= 1) Audio.play('bandage', [a1.x, a1.y, a1.z]); }
    // بناء المرقد: السياج والقبّة والكاشي تطلع شوية شوية
    if (this.buildT !== undefined && this.buildT < 1) { this.buildT = Math.min(1, this.buildT + dt / 3.4); const e = ease(this.buildT); for (const [o, d] of this.builds) { const k = ease(Math.min(1, Math.max(0, (this.buildT - d) / 0.4))); o.visible = k > 0.01; o.scale.set(o.userData.s[0], o.userData.s[1] * Math.max(0.01, k), o.userData.s[2]); } this.shrineGlow.intensity = 2.2 * e; }
    for (const c of this.mourners || []) if (c.root.visible) c.update(dt, this.cam.position);
    // الشخصيات
    for (const k in this.actors) this.poseActor(k, this.actors[k], dt);
    this.sheikhSit.update(dt, this.cam.position); this.sheikhStand.update(dt, V3(0, 1, 0));
  }
  // وضعية الجلوس على الأرض (رجل على رجل تقريباً) أو الوقوف، مع إيماءات الكلام والالتفات
  poseActor(k, a, dt) {
    if (a.after) { // واقف: بلا سلاح، أو موجّه سلاحه نحو الطرف الثاني
      const hurt = this.t - (this.boomT !== undefined ? this.t - this.boomT : 0);
      a.m.update({ alive: true, yaw: a.seat.yaw + Math.sin(this.t * 0.9 + a.ph) * 0.03, pitch: a.aim ? -0.03 : -0.28, speed: 0, vx: 0, vz: 0, crouch: 0, onGround: true, reloading: false, fireT: 0, lean: 0, hurt: 9 }, dt);
      if (!a.aim) a.m.head.rotation.x = -0.05 + Math.sin(this.t * 1.3 + a.ph) * 0.04;
      return;
    }
    const m = a.m, t = this.t + a.ph, st = a.stand, sit = 1 - st;
    a.talk = Math.max(0, a.talk - dt);
    m.root.rotation.set(0, a.seat.yaw, 0);
    m.hips.position.set(0, 0.25 * sit + 0.96 * st, 0.06 * sit);
    m.legs.forEach((L, i) => { const s = i ? 1 : -1; L.thigh.rotation.set(1.42 * sit, 0, s * 0.62 * sit); L.shin.rotation.set(-2.45 * sit, 0, -s * 0.5 * sit); L.foot.rotation.set(0.9 * sit, 0, 0); });
    for (const T of m.tails) { if (T.kind === 'front') { T.g.rotation.set(1.42 * sit, 0, T.side * 0.25 * sit); T.g.scale.y = 1 - 0.42 * sit; } else if (T.kind === 'back') { T.g.rotation.set(-1.3 * sit, 0, 0); T.g.scale.y = 1 - 0.3 * sit; } else T.g.rotation.set(-0.6 * sit, 0, T.side * 0.4 * sit); }
    // الالتفات نحو المتكلّم أو الباب أو الرمّانة
    let tx = null, tz = null, ty = 0.9;
    if (a.lookAt === 'door') { tx = -7.4; tz = 0; ty = 1.6; } else if (a.lookAt === 'nade') { tx = this.nade.position.x; tz = this.nade.position.z; ty = 0; }
    else if (a.lookAt === 'sheikh' || (a.lookAt && a.lookAt !== k && this.actors[a.lookAt])) { const h = this.head(a.lookAt); tx = h.x; tz = h.z; ty = h.y; }
    let yawW = 0, pit = 0;
    if (tx !== null) { const hx = a.seat.x, hz = a.seat.z; let yy = Math.atan2(-(tx - hx), -(tz - hz)) - a.seat.yaw; while (yy > Math.PI) yy -= Math.PI * 2; while (yy < -Math.PI) yy += Math.PI * 2; yawW = Math.max(-1.3, Math.min(1.3, yy)); pit = Math.atan2(ty - (st > 0.5 ? 1.68 : HEAD_Y), Math.hypot(tx - hx, tz - hz)) * -1; }
    a.look += (yawW - a.look) * Math.min(1, dt * 4); a.pit = (a.pit || 0) + (pit - (a.pit || 0)) * Math.min(1, dt * 4);
    const talking = a.talk > 0, ang = this.speaker === 'mohammed' || this.speaker === 'saif' ? 1 : 0;
    m.torso.rotation.set(0.12 * sit + (talking ? Math.sin(t * 3.1) * 0.03 + 0.05 : 0) + (a.react ? -0.35 : 0), a.look * 0.35, 0);
    m.head.rotation.set(Math.max(-0.5, Math.min(0.6, a.pit)) + (talking ? Math.sin(t * 7) * 0.04 : 0) + (a.react ? 0.3 : 0), a.look * 0.65, 0);
    m.chest.scale.set(1, 1 + Math.sin(t * 1.7) * 0.01, 1 + Math.sin(t * 1.7) * 0.014);
    // اليدان: على الركبتين، أو تشرح بالكلام، أو تمتد للمصافحة، أو تحمي الرأس عند الانفجار
    const R = m.arms[1], L = m.arms[0];
    let rT = V3(0.24, 0.03 * sit - 0.45 * st, -0.38 * sit), lT = V3(-0.24, 0.03 * sit - 0.45 * st, -0.38 * sit);
    if (talking) { rT = V3(0.3 + Math.sin(t * 3.7) * 0.05, 0.16 + Math.sin(t * 5.1) * 0.07 + ang * 0.06, -0.3 + Math.sin(t * 2.3) * 0.05); if (Math.sin(t * 0.8) > 0.3) lT = V3(-0.27, 0.12 + Math.sin(t * 4.3) * 0.05, -0.3); }
    let reach = 0; if (a.handT !== undefined && !a.react) { a.handT += dt; reach = ease(a.handT / (k === 'mohammed' ? 2.4 : 1.6)) * (k === 'mohammed' ? 0.55 : 1); rT.lerp(V3(0.1, 0.12, -0.62), reach); m.torso.rotation.x += 0.4 * reach; }
    if (a.eat > 0) { a.eat += dt; const ph = (a.eat % 2.6) / 2.6, up = ph < 0.35 ? 0 : ph < 0.55 ? (ph - 0.35) / 0.2 : ph < 0.75 ? 1 : 1 - (ph - 0.75) / 0.25; rT = V3(0.14 - up * 0.08, 0.02 + up * 0.5, -0.55 + up * 0.45); m.torso.rotation.x += 0.18 * (1 - up); m.head.rotation.x += 0.15 * (1 - up); }
    if (a.react) { rT = V3(0.12, 0.42, -0.08); lT = V3(-0.12, 0.42, -0.08); }
    solveArm(R.upper, R.fore, R.sh.position, rT, V3(0.6, -1, 0.3), 0.29, 0.29);
    solveArm(L.upper, L.fore, L.sh.position, lT, V3(-0.6, -1, 0.3), 0.29, 0.29);
  }
  renderShot(dt) {
    const r = this.r, cam = this.cam;
    if (cam.aspect !== innerWidth / innerHeight) { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
    const s = this.waiting ? this.shotOf('out') : this.s0;
    if (!s || this.shot === 'black') { r.setClearColor(0x000000, 1); r.clear(); this.flashEl.style.opacity = 0; return; }
    this.shotT = (this.shotT || 0) + dt;
    const k = Math.min(1, this.shotT / 9), drift = s[2] || V3(0, 0, 0);
    cam.position.copy(s[0]).addScaledVector(drift, k);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 0.8); const a = this.shake * 0.06; cam.position.x += (Math.random() - 0.5) * a; cam.position.y += (Math.random() - 0.5) * a; }
    const look = s[1].clone(); if (this.shot === 'grenade' && this.nade.visible) look.copy(this.nade.position);
    cam.lookAt(look);
    if (Audio.ctx) { const f = V3(0, 0, -1).applyQuaternion(cam.quaternion); Audio.setListener(cam.position.x, cam.position.y, cam.position.z, f.x, f.y, f.z); }
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 0.45); }
    this.flashEl.style.opacity = this.flash.toFixed(3);
    if (this.boomT !== undefined) this.boomT += dt;
    this.expo = this.expo ?? 1.1; this.expo += ((this.expoT ?? 1.1) - this.expo) * Math.min(1, dt * (this.expoRate || 2)); r.toneMappingExposure = this.expo;
    r.render(this.scene, cam);
  }
  finish() {
    if (!this.active) return; this.active = false;
    try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { }
    if (this.voice) try { this.voice.pause(); } catch (e) { }
    this.r.toneMappingExposure = 1.08;
    this.el.classList.add('out'); setTimeout(() => this.el.remove(), 600);
    this.scene.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
    this.scene = null;
    Audio.introOn = false; Audio.musicMode('menu'); if (Audio.ctx) Audio.restartMusic(); // الموسيقى تبدأ من أولها بعد نهاية المقدّمة
    this.onDone && this.onDone();
  }
}
