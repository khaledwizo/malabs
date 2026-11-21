// المقدّمة السينمائية (أول فتح للعبة): عشاء في مضيف الشيخ إبراهيم الهاشمي بتكريت، اتهام وجدال، الشيخ يسعى للصلح،
// يد خفيّة ترمي رمّانة وسط السفرة... وتبدأ الحرب. مشهد ثلاثي الأبعاد بلقطات كاميرا وترجمة وأصوات عراقية مسجّلة إن وُجدت.
import * as THREE from 'three';
import { CharModel, solveArm, roundBox } from './chars.js';
import { Civilian } from './civilians.js';
import { CAST, SCRIPT } from './introdata.js';
import { Voices, voiceId } from '../core/voices.js';
import { Audio } from '../core/audio.js';
import { Settings } from '../core/settings.js';

export const INTRO_KEY = 'rafidain.intro.v1';
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
    Voices.load(); Audio.musicMode('intro');
    this.ui();
    this.build();
  }
  // ---------- الواجهة: أشرطة سينمائية، بطاقات، ترجمة، تخطّي ----------
  ui() {
    const d = this.el = document.createElement('div'); d.id = 'intro';
    d.innerHTML = `<div class="ib t"></div><div class="ib b"></div><div class="ic"></div><div class="is"><b></b><span></span></div><div class="if"></div>
      <div class="itap"><div class="itt">جبهة الرافدين</div><div class="its">حكاية الليلة التي بدأت فيها الحرب</div><div class="itg">المس الشاشة للبدء</div></div><button class="iskip">تخطّي ‹</button>`;
    document.body.appendChild(d);
    this.card = d.querySelector('.ic'); this.sub = d.querySelector('.is'); this.flashEl = d.querySelector('.if');
    d.querySelector('.iskip').addEventListener('click', e => { e.stopPropagation(); this.finish(); });
    d.querySelector('.itap').addEventListener('click', () => { Audio.init(); d.querySelector('.itap').classList.add('gone'); this.waiting = false; this.t = 0; });
  }
  setCard(text, title) { this.card.innerHTML = text ? `<div class="${title ? 'icT' : ''}">${text}</div>` : ''; this.card.classList.toggle('on', !!text); }
  setSub(who, text) { const s = this.sub; if (!text) { s.classList.remove('on'); return; } s.querySelector('b').textContent = CAST[who].name; s.querySelector('span').textContent = text; s.classList.add('on'); }
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
    add(BX(3.8, 0.01, 1.5), this.mat('clothCream', 2, 1), 0, 0.016, 0, 0, false);
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 32), brass, 0, 0.04, 0);
    const rice = add(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), col(0xe6c06a), 0, 0.05, 0); rice.scale.y = 0.42;
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; const m = add(new THREE.SphereGeometry(0.11, 10, 8), col(0x7a4a2a), Math.cos(a) * 0.18, 0.21, Math.sin(a) * 0.18); m.scale.set(1.3, 0.7, 1); }
    const breadM = col(0xd9a85f), bowlM = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.4 }), glassM = new THREE.MeshStandardMaterial({ color: 0xc8dde0, roughness: 0.1, transparent: true, opacity: 0.55 });
    for (const [x, z] of [[-1.3, -0.45], [-1.3, 0.45], [1.35, -0.45], [1.35, 0.45], [-0.9, -0.55], [0.95, 0.55]]) add(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 18), breadM, x, 0.03, z);
    for (const [x, z] of [[-0.65, -0.55], [0.75, -0.55], [-0.65, 0.55], [0.75, 0.55], [-1.7, 0]]) { add(new THREE.CylinderGeometry(0.07, 0.05, 0.06, 14), bowlM, x + 0.25, 0.05, z); add(new THREE.CylinderGeometry(0.03, 0.026, 0.09, 10), glassM, x - 0.2, 0.06, z * 0.8); }
    add(new THREE.CylinderGeometry(0.16, 0.13, 0.03, 18), bowlM, 1.6, 0.03, 0); for (let k = 0; k < 7; k++) add(new THREE.SphereGeometry(0.022, 6, 5), col(0x4a2412), 1.6 + Math.cos(k) * 0.07, 0.055, Math.sin(k * 1.7) * 0.07);
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
    this.sheikhSit = new Civilian({ id: 90, x: sh.x - 0.12, y: -0.3, z: sh.z, yaw: sh.yaw, pose: 'sit', look: 'sheikh', stool: false, seed: 77 });
    this.sheikhStand = new Civilian({ id: 91, x: -7.35, y: 0, z: 0, yaw: -Math.PI / 2, pose: 'stand', look: 'sheikh', seed: 77 });
    S.add(this.sheikhSit.root); S.add(this.sheikhStand.root); this.sheikhSit.root.visible = false; this.sheikhStand.root.visible = false;
    // اليد الخفيّة والرمّانة
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 1 });
    this.hand = new THREE.Group(); this.hand.position.set(5.05, 1.05, -1.75); S.add(this.hand); this.hand.visible = false;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.95 })); sleeve.rotation.z = Math.PI / 2; sleeve.position.x = 0.2; this.hand.add(sleeve);
    const palm = new THREE.Mesh(roundBox(0.1, 0.06, 0.09, 0.025), new THREE.MeshStandardMaterial({ color: 0xa06a4a, roughness: 0.6 })); palm.position.x = -0.07; this.hand.add(palm);
    this.handLight = new THREE.PointLight(0xffa860, 0, 1.6, 2); this.handLight.position.set(4.5, 1.3, -1.3); S.add(this.handLight);
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
      case 'grenade': return [V3(1.05, 0.32, 0.85), V3(0.5, 0.1, 0), V3(-0.25, 0, -0.1)];
      case 'sheikh': return [...this.faceShot('sheikh', 0.45, 1.3), V3(0, 0, 0)];
      case 'sheikh2': return [...this.faceShot('sheikh', -0.5, 1.6, 0.15), V3(0, 0, 0)];
      case 'sheikhClose': return [...this.faceShot('sheikh', 0.22, 0.95, -0.07), V3(0, 0, 0)];
      case 'black': return null;
    }
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
    if (a === 'door') { this.doorT = 0; this.sheikhStand.root.visible = true; Audio.play('creak'); for (const k in A) A[k].lookAt = 'door'; }
    if (a === 'stand') this.standT = 0;
    if (a === 'sheikhSeat') { this.sheikhStand.root.visible = false; this.sheikhSit.root.visible = true; this.standT = -1; for (const k in A) A[k].stand = 0; this.doorClose = true; }
    if (a === 'sheikhHand') { this.sheikhSit.raise = true; this.drone = true; }
    if (a === 'handshake') { this.sheikhSit.raise = false; A.ibrahim.handT = 0; A.mohammed.handT = -0.9; A.ibrahim.lookAt = 'mohammed'; A.mohammed.lookAt = 'ibrahim'; Audio.play('heart'); }
    if (a === 'pin') { this.hand.visible = true; this.handT = 0; this.nade.visible = true; this.nadeHeld = true; this.handLight.intensity = 1.4; setTimeout(() => this.active && Audio.play('pin', [5, 1, -1.7]), 600); }
    if (a === 'grenade') { this.nade.visible = true; this.nadeHeld = false; this.nadeT = 0; this.bounced = 0; for (const k in A) { A[k].lookAt = 'nade'; A[k].react = 0; } this.sheikhSit.focus(0.4, 0.1, 4); }
    if (a === 'boom') { this.boomT = 0; this.flash = 1; this.shake = 1; Audio.play('boom', [0.3, 0.2, 0.1]); setTimeout(() => this.active && Audio.play('ring'), 250); for (const k in A) A[k].react = 1; this.nade.visible = false; }
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
    this.fire.intensity = 3.0 + Math.sin(t * 9) * 0.5 + Math.sin(t * 23) * 0.3;
    // طقطقة الجمر بالوجاق
    if (!this.waiting && Audio.ctx && Math.random() < dt * 3) { try { const o = Audio.out([6.6, 0.4, -3.6], 0.1, 3, 30); Audio.nz(o, Audio.ctx.currentTime, 0.03 + Math.random() * 0.04, 2000 + Math.random() * 2500, 700, 2, 'bandpass', 0.6, 0.002); } catch (e) { } }
    // الباب ينفتح ثم يتسكّر
    if (this.doorT !== undefined) { this.doorT += dt; const e = this.doorClose ? Math.max(0, 1 - (this.doorT - 0) * 0.0) : ease(this.doorT / 1.4); const open = this.doorClose ? 0 : e; for (const D of this.doors) D.g.rotation.y = D.s * open * 1.25; this.doorLight.intensity = open * 5; }
    // وقوف الجالسين احتراماً للشيخ
    if (this.standT !== undefined && this.standT >= 0) { this.standT += dt; for (const k in this.actors) this.actors[k].stand = ease((this.standT - 0.15 * Object.keys(this.actors).indexOf(k)) / 0.9); }
    if (this.handT !== undefined && this.hand.visible) { this.handT += dt; const e = ease(this.handT / 0.7); this.hand.position.x = 5.05 - e * 0.3; if (this.bi >= 0 && SCRIPT[this.bi].act === 'grenade' && this.nadeT > 0.25) this.hand.position.x = 4.75 + ease((this.nadeT - 0.25) / 0.5) * 0.45; }
    // الرمّانة: قوس ثم ارتداد ثم تدحرج حتى تستقر وسط السفرة
    if (this.nade.visible && this.nadeHeld) { this.nade.position.set(this.hand.position.x - 0.1, this.hand.position.y + 0.06, this.hand.position.z); this.nade.rotation.set(0, 0, 0.3); }
    else if (this.nade.visible) {
      this.nadeT += dt; const T = this.nadeT, n = this.nade;
      if (T < 0.7) { const e = T / 0.7; n.position.set(4.75 - e * 2.6, 1.05 + Math.sin(e * Math.PI) * 0.55 - e * 1.0, -1.65 + e * 1.2); }
      else { if (!this.bounced) { this.bounced = 1; Audio.play('bounce', [2.1, 0, -0.45]); } const e = Math.min(1, (T - 0.7) / 1.3), k = 1 - Math.pow(1 - e, 3); n.position.set(2.15 - k * 1.8, 0.06 + Math.abs(Math.sin(e * 9)) * 0.08 * (1 - e), -0.45 + k * 0.55); }
      n.rotation.z -= dt * (T < 2 ? 14 * (1 - Math.min(1, T / 2)) : 0); n.rotation.x += dt * 3 * (1 - Math.min(1, T / 2));
    }
    // الشخصيات
    for (const k in this.actors) this.poseActor(k, this.actors[k], dt);
    this.sheikhSit.update(dt, this.cam.position); this.sheikhStand.update(dt, V3(0, 1, 0));
  }
  // وضعية الجلوس على الأرض (رجل على رجل تقريباً) أو الوقوف، مع إيماءات الكلام والالتفات
  poseActor(k, a, dt) {
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
    if (this.boomT !== undefined) { this.boomT += dt; r.toneMappingExposure = 1.1 * Math.max(0, 1 - this.boomT / 2.6); } else r.toneMappingExposure = 1.1;
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
    Audio.musicMode('menu');
    this.onDone && this.onDone();
  }
}
