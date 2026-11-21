// الشخصيات ثلاثية الأبعاد: أجسام مدوّرة، وجوه (منها وجه خالد من صورته)، ملابس بقوام، حركة إجرائية وذراعان بالحركية العكسية
import * as THREE from 'three';
import * as TX from '../gfx/tex.js';
import { CHARS } from './chardefs.js';
import { buildGun } from './gunmodels.js';
import { mergeChildren } from '../gfx/geo.js';
import khaledFace from '../assets/khaled_face.jpg';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const geoCache = new Map();
function cached(k, f) { if (!geoCache.has(k)) geoCache.set(k, f()); return geoCache.get(k); }
export function roundBox(w, h, d, r, seg = 3) {
  return cached(`rb${w},${h},${d},${r}`, () => {
    const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
    const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); c.set(Math.max(-ix, Math.min(ix, v.x)), Math.max(-iy, Math.min(iy, v.y)), Math.max(-iz, Math.min(iz, v.z)));
      const dd = v.clone().sub(c); if (dd.lengthSq() > 1e-10) dd.normalize().multiplyScalar(r); p.setXYZ(i, c.x + dd.x, c.y + dd.y, c.z + dd.z);
    }
    g.computeVertexNormals(); return g;
  });
}
const capsule = (r, len) => cached(`cap${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 10));

// رأس كروي بإسقاط مستوٍ لقوام الوجه على الجهة الأمامية (-z)
function headGeo() {
  return cached('head', () => {
    const r = 0.115, g = new THREE.SphereGeometry(r, 28, 22), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (z < r * 0.25) uv.setXY(i, 0.5 - x / (2.15 * r), 0.5 + y / (2.15 * r));
      else uv.setXY(i, 0.03, 0.5 + y / (2.15 * r) * 0.3);
    }
    g.scale(0.94, 1.07, 1.0);
    return g;
  });
}

const texCache = new Map();
function charMats(id) {
  if (texCache.has(id)) return texCache.get(id);
  const d = CHARS[id], S = 256;
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));
  const skin = std({ color: d.skin, roughness: 0.6 });
  let faceMap;
  if (d.face === 'photo') { faceMap = new THREE.TextureLoader().load(khaledFace); faceMap.colorSpace = THREE.SRGBColorSpace; }
  else faceMap = TX.face(256, Object.assign({ skin: d.skin }, d.faceOpt || {}));
  const face = std({ map: faceMap, roughness: 0.6 });
  const jt = TX.fabric(S, Object.assign({}, d.jacket));
  const jacket = std({ map: jt.map, normalMap: jt.normalMap, roughness: 0.9 });
  const pt = TX.fabric(S, { base: hexRgb(d.pants) });
  const pants = std({ map: pt.map, normalMap: pt.normalMap, roughness: 0.92 });
  const hairT = TX.fabric(128, { base: hexRgb(d.hair) });
  const M = {
    skin, face, jacket, pants, shirt: std({ color: d.shirt, roughness: 0.9 }), shoes: std({ color: d.shoes, roughness: 0.55 }),
    hair: std({ color: d.hair, map: hairT.map, roughness: 0.75 }), vest: d.vest ? std({ color: d.vest, roughness: 0.85 }) : null,
    tie: d.tie ? std({ color: d.tie, roughness: 0.5 }) : null, glass: std({ color: 0x0a0c10, roughness: 0.05, metalness: 0.8 }),
    shemagh: d.hairStyle === 'shemagh' ? std({ map: TX.fabric(256, { check: 14, col: '#b3202a' }).map, roughness: 0.95, side: THREE.DoubleSide }) : null,
    black: std({ color: 0x101010, roughness: 0.6 }),
    leather: std({ color: d.leather || '#3a2a1e', roughness: 0.55 }), glove: d.gloves ? std({ color: d.gloves, roughness: 0.5 }) : skin,
    cape: d.cape ? std({ map: TX.fabric(256, { base: hexRgb(d.cape) }).map, roughness: 0.95, side: THREE.DoubleSide }) : null,
    coatIn: std({ color: 0x1a1410, roughness: 0.9, side: THREE.DoubleSide }), gold: std({ color: 0xc9a043, roughness: 0.35, metalness: 0.85 }),
  };
  texCache.set(id, M); return M;
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
const teamMats = [new THREE.MeshStandardMaterial({ color: 0xf0a83a, emissive: 0x6a3a00, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x3ac8f0, emissive: 0x004a66, roughness: 0.5 })];

// حل ذراع بعظمتين (عضد + ساعد) في فضاء الجذع
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), DOWN = V(0, -1, 0);
function solveArm(upper, fore, S, T, pole, a, b) {
  const dir = T.clone().sub(S); let d = dir.length(); d = Math.min(Math.max(d, Math.abs(a - b) + 0.01), (a + b) * 0.999); dir.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const pp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a * cosA)).add(pp.multiplyScalar(a * sinA));
  _q.setFromUnitVectors(DOWN, E.clone().sub(S).normalize()); upper.quaternion.copy(_q);
  const T2 = S.clone().add(dir.multiplyScalar(d));
  _q2.setFromUnitVectors(DOWN, T2.sub(E).normalize());
  fore.quaternion.copy(_q.clone().invert().multiply(_q2));
}

export class CharModel {
  constructor(charId, team) {
    this.id = charId; this.team = team;
    const d = CHARS[charId], M = charMats(charId);
    const root = this.root = new THREE.Group();
    const mesh = (g, m, x = 0, y = 0, z = 0, parent) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (parent || root).add(o); return o; };
    // الورك والساقان
    const hips = this.hips = new THREE.Group(); hips.position.y = 0.96; root.add(hips);
    mesh(roundBox(0.34, 0.2, 0.22, 0.07), M.pants, 0, 0.02, 0, hips);
    mesh(roundBox(0.36, 0.055, 0.24, 0.02), M.leather, 0, 0.11, 0, hips); // حزام جلدي بإبزيم وجراب
    mesh(roundBox(0.06, 0.045, 0.02, 0.006), M.gold, 0, 0.11, -0.125, hips);
    mesh(roundBox(0.08, 0.1, 0.05, 0.015), M.leather, 0.17, 0.04, -0.03, hips);
    // أذيال المعطف الطويل (تتطاير مع الجري وتتبع الساقين)
    this.tails = [];
    if (d.coat) {
      const L = d.coat, tail = (x, z, w, len, kind) => { const g = new THREE.Group(); g.position.set(x, 0.06, z); hips.add(g); mesh(roundBox(w, len, 0.022, 0.009), M.jacket, 0, -len / 2, 0, g); mesh(roundBox(w * 0.96, len * 0.97, 0.004, 0.002), M.coatIn, 0, -len / 2, kind === 'back' ? -0.014 : 0.014, g); this.tails.push({ g, kind, side: Math.sign(x) }); };
      tail(-0.095, -0.118, 0.165, L * 0.92, 'front'); tail(0.095, -0.118, 0.165, L * 0.92, 'front'); tail(0, 0.125, 0.34, L, 'back');
      tail(-0.178, 0.02, 0.022, L * 0.9, 'side'); tail(0.178, 0.02, 0.022, L * 0.9, 'side');
    }
    this.legs = [];
    for (const s of [-1, 1]) {
      const thigh = new THREE.Group(); thigh.position.set(s * 0.095, -0.04, 0); hips.add(thigh);
      mesh(capsule(0.078, 0.3), M.pants, 0, -0.2, 0, thigh);
      const shin = new THREE.Group(); shin.position.y = -0.42; thigh.add(shin);
      mesh(capsule(0.064, 0.32), M.pants, 0, -0.2, 0, shin);
      const foot = new THREE.Group(); foot.position.y = -0.42; shin.add(foot);
      mesh(roundBox(0.11, 0.08, 0.26, 0.035), M.shoes, 0, -0.05, -0.05, foot);
      this.legs.push({ thigh, shin, foot });
    }
    // الجذع (يميل مع التصويب)
    const torso = this.torso = new THREE.Group(); torso.position.y = 0.1; hips.add(torso);
    const chest = this.chest = new THREE.Group(); torso.add(chest);
    mesh(roundBox(0.45, 0.5, 0.26, 0.09), M.jacket, 0, 0.27, 0, chest);
    mesh(roundBox(0.5, 0.17, 0.275, 0.08), M.jacket, 0, 0.43, 0, chest); // صدر وكتفان عريضان
    if (d.cape) { const cp = mesh(cached('cape', () => new THREE.CylinderGeometry(0.2, 0.3, 0.3, 16, 1, true, -Math.PI * 0.62, Math.PI * 1.24)), M.cape, 0, 0.39, 0.005, chest); cp.rotation.y = Math.PI; cp.scale.set(1.12, 1, 0.82); }
    if (d.hood) { const hd = mesh(cached('hood', () => new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.45)), M.jacket, 0, 0.54, 0.1, chest); hd.scale.set(1.05, 0.8, 0.9); hd.rotation.x = 0.5; }
    if (d.jacketOpen || d.tie) { mesh(roundBox(0.13, 0.42, 0.04, 0.015), M.shirt, 0, 0.29, -0.11, chest); }
    if (d.tie) { const t = mesh(roundBox(0.045, 0.32, 0.02, 0.008), M.tie, 0, 0.3, -0.135, chest); mesh(roundBox(0.05, 0.04, 0.025, 0.01), M.tie, 0, 0.47, -0.135, chest); t.rotation.x = 0.03; }
    if (d.jacketOpen && !d.tie) mesh(roundBox(0.15, 0.06, 0.06, 0.02), M.shirt, 0, 0.5, -0.06, chest);
    if (d.vest) { mesh(roundBox(0.45, 0.38, 0.29, 0.07), M.vest, 0, 0.27, 0, chest); for (let k = 0; k < 3; k++) mesh(roundBox(0.09, 0.12, 0.05, 0.02), M.vest, -0.12 + k * 0.12, 0.17, -0.155, chest); }
    // الرقبة والرأس
    mesh(cached('neck', () => new THREE.CylinderGeometry(0.052, 0.058, 0.12, 12)), M.skin, 0, 0.55, 0, chest);
    const head = this.head = new THREE.Group(); head.position.y = 0.625; chest.add(head);
    mesh(headGeo(), M.face, 0, 0.05, 0, head).name = 'headMesh';
    for (const s of [-1, 1]) { const e = mesh(cached('ear', () => new THREE.SphereGeometry(0.028, 10, 8)), M.skin, s * 0.104, 0.05, 0.01, head); e.scale.set(0.45, 1, 0.8); }
    if (d.face !== 'photo') { const nose = mesh(cached('nose', () => new THREE.ConeGeometry(0.018, 0.045, 8)), M.skin, 0, 0.045, -0.113, head); nose.rotation.x = -Math.PI / 2 - 0.25; nose.scale.set(1, 1, 0.8); }
    this.buildHair(d, M, head, mesh);
    if (d.glasses) { for (const s of [-1, 1]) mesh(roundBox(0.046, 0.028, 0.01, 0.006), M.glass, s * 0.036, 0.075, -0.112, head); mesh(roundBox(0.03, 0.006, 0.006, 0.002), M.glass, 0, 0.082, -0.114, head); }
    // الذراعان
    this.arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.25, 0.45, 0); chest.add(sh);
      const dl = mesh(cached('delt', () => new THREE.SphereGeometry(0.074, 12, 10)), M.jacket, 0, 0.0, 0, sh); dl.scale.set(1.05, 0.9, 1.1);
      const upper = new THREE.Group(); sh.add(upper);
      mesh(capsule(0.058, 0.2), M.jacket, 0, -0.14, 0, upper);
      if (s < 0) { const band = mesh(cached('band', () => new THREE.CylinderGeometry(0.064, 0.064, 0.05, 12)), teamMats[team], 0, -0.1, 0, upper); band.castShadow = false; this.band = band; }
      const fore = new THREE.Group(); fore.position.y = -0.29; upper.add(fore);
      mesh(capsule(0.05, 0.18), M.jacket, 0, -0.12, 0, fore);
      if (d.bracers) { mesh(capsule(0.056, 0.09), M.leather, 0, -0.2, 0, fore); mesh(cached('bstrap', () => new THREE.CylinderGeometry(0.06, 0.06, 0.014, 12)), M.gold, 0, -0.17, 0, fore); }
      const hand = mesh(roundBox(0.07, 0.095, 0.04, 0.018), M.glove, 0, -0.29, 0, fore);
      this.arms.push({ sh, upper, fore, hand, side: s });
    }
    // شارة الفريق على الكتف
    const pad = mesh(roundBox(0.1, 0.03, 0.12, 0.012), teamMats[team], 0.24, 0.505, 0, chest); pad.castShadow = false; this.pad = pad;
    mergeChildren(root);
    this.gun = null; this.gunId = null; this.phase = 0; this.deadT = -1; this.fallDir = 1;
    root.traverse(o => { o.userData.charRoot = this; });
  }
  buildHair(d, M, head, mesh) {
    const st = d.hairStyle;
    if (st === 'quiff') {
      const cap = mesh(cached('cap', () => new THREE.SphereGeometry(0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), M.hair, 0, 0.095, 0.014, head); cap.scale.set(0.97, 0.92, 1.04); cap.rotation.x = 0.56;
      const back = mesh(cached('capb', () => new THREE.SphereGeometry(0.121, 16, 10, 0, Math.PI, 0, Math.PI * 0.6)), M.hair, 0, 0.07, 0.014, head); back.rotation.y = Math.PI; back.scale.set(0.96, 1.02, 1.0);
      const q = mesh(roundBox(0.15, 0.05, 0.1, 0.024), M.hair, 0, 0.185, -0.035, head); q.rotation.x = -0.3;
    } else if (st === 'curly') {
      for (let i = 0; i < 46; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * 1.15, r = 0.118; const x = Math.sin(b) * Math.cos(a) * r * 0.95, z = Math.sin(b) * Math.sin(a) * r, y = Math.cos(b) * r * 1.1 + 0.07; if (z < -0.06 && y < 0.14) continue; mesh(cached('curl', () => new THREE.IcosahedronGeometry(0.03, 0)), M.hair, x, y, z + 0.005, head); }
    } else if (st === 'buzz') {
      const cap = mesh(cached('buzz', () => new THREE.SphereGeometry(0.119, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5)), M.hair, 0, 0.08, 0.006, head); cap.scale.set(0.97, 0.95, 1.03); cap.rotation.x = 0.4;
      const back = mesh(cached('buzzb', () => new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI, 0, Math.PI * 0.6)), M.hair, 0, 0.055, 0.006, head); back.rotation.y = Math.PI; back.scale.set(0.93, 1.05, 1.0);
    } else if (st === 'shemagh') {
      const wrap = mesh(cached('shem', () => new THREE.SphereGeometry(0.13, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6)), M.shemagh, 0, 0.07, 0.01, head); wrap.scale.set(1.0, 1.0, 1.06);
      const egal = mesh(cached('egal', () => new THREE.TorusGeometry(0.115, 0.012, 6, 24)), M.black, 0, 0.13, 0.01, head); egal.rotation.x = Math.PI / 2; egal.scale.set(0.95, 1.05, 1);
      const drape = mesh(cached('drape', () => new THREE.CylinderGeometry(0.12, 0.16, 0.26, 16, 1, true, Math.PI * 0.15, Math.PI * 1.7)), M.shemagh, 0, -0.06, 0.02, head); drape.rotation.y = Math.PI * 0.5 + Math.PI;
    }
  }
  setWeapon(id, scope) {
    if (this.gunId === id + (scope || '')) return;
    if (this.gun) this.chest.remove(this.gun.group);
    this.gun = id ? buildGun(id, scope) : null; this.gunId = id + (scope || '');
    if (this.gun) { this.gun.group.scale.setScalar(1); this.chest.add(this.gun.group); }
  }
  // st: { yaw, pitch, speed, vx, vz, crouch, onGround, alive, reloading, fireT, ads }
  update(st, dt) {
    const root = this.root;
    this.t = (this.t || 0) + dt;
    if (!st.alive) {
      // سقوط على مرحلتين: انهيار الركبتين ثم السقوط مع التفاف بسيط وارتداد خفيف
      if (this.deadT < 0) { this.deadT = 0; this.fallDir = Math.random() < 0.6 ? 1 : -1; this.twist = (Math.random() - 0.5) * 0.9; }
      this.deadT += dt;
      const k1 = Math.min(1, this.deadT / 0.22), e1 = 1 - Math.pow(1 - k1, 2);
      const t = Math.min(1, Math.max(0, (this.deadT - 0.12) / 0.6)), e = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
      const bounce = t >= 1 ? Math.max(0, Math.sin(Math.min(1, (this.deadT - 0.72) / 0.25) * Math.PI)) * 0.04 : 0;
      root.rotation.set(this.fallDir * e * Math.PI / 2 * 0.96, st.yaw + this.twist * e, this.twist * 0.4 * e, 'YXZ');
      this.hips.position.y = 0.96 - e1 * 0.32 - e * 0.28 + bounce;
      for (const a of this.arms) { a.upper.quaternion.setFromEuler(new THREE.Euler(-0.5 * e - 0.6 * e1 * (1 - e), 0, a.side * (0.25 + 1.1 * e))); a.fore.rotation.set(-0.5 * e, 0, 0); }
      for (const l of this.legs) { l.thigh.rotation.x = 1.1 * e1 * (1 - e) + 0.25 * e; l.shin.rotation.x = -1.6 * e1 * (1 - e) - 0.3 * e; }
      for (const T of this.tails) T.g.rotation.set(T.kind === 'back' ? -0.3 * e : 0.2 * e, 0, 0);
      this.torso.rotation.set(0.3 * e1 * (1 - e), 0, 0);
      if (this.gun) this.gun.group.visible = this.deadT < 0.15;
      return;
    }
    if (this.deadT >= 0) { this.deadT = -1; if (this.gun) this.gun.group.visible = true; }
    root.rotation.set(0, st.yaw, 0, 'YXZ');
    const c = st.crouch || 0, speed = st.speed || 0, k = Math.min(1, speed / 5.6);
    // اتجاه الحركة بالنسبة للجسد (للمشي إلى الخلف)
    const fwd = -Math.sin(st.yaw) * st.vx * -1 + 0; // غير مستخدم إلا للإشارة
    const back = (st.vx * -Math.sin(st.yaw) + st.vz * -Math.cos(st.yaw)) < -0.3 ? -1 : 1;
    this.phase += dt * speed * 2.1 * back;
    const ph = this.phase, air = !st.onGround;
    // الساقان
    for (let i = 0; i < 2; i++) {
      const L = this.legs[i], p = ph + (i ? Math.PI : 0);
      let th = Math.sin(p) * 0.62 * k, sh = -Math.max(0, Math.sin(p + 1.4)) * 0.85 * k - 0.08 * k;
      th += c * 1.25; sh -= c * 2.0;
      if (air) { th = 0.55 + c * 0.6; sh = -0.95; }
      L.thigh.rotation.x = th; L.shin.rotation.x = sh; L.foot.rotation.x = -(th + sh) * 0.6;
    }
    this.hips.position.y = 0.96 - c * 0.4 + (air ? 0 : Math.abs(Math.sin(ph)) * 0.03 * k);
    // الجذع يتبع زاوية التصويب + تنفّس + ميل جانبي + ارتداد عند الإصابة
    const pitch = st.pitch || 0, lean = st.lean || 0, hurt = st.hurt ?? 9, fl = hurt < 0.3 ? (0.3 - hurt) / 0.3 : 0;
    this.torso.rotation.x = pitch * 0.55 + c * 0.25 + k * 0.08 - fl * 0.28;
    this.torso.rotation.z = -lean * 0.32;
    this.hips.position.x = lean * 0.06;
    this.head.rotation.x = pitch * 0.45 - c * 0.15 + fl * 0.15;
    this.head.rotation.z = lean * 0.12;
    this.torso.rotation.y = Math.sin(ph) * 0.06 * k;
    this.chest.scale.set(1, 1 + Math.sin(this.t * 1.7) * 0.008 * (1 - k), 1 + Math.sin(this.t * 1.7) * 0.012 * (1 - k));
    // أذيال المعطف: تتبع الساقين وتتطاير خلفه عند الجري وترفرف بلطف
    for (const T of this.tails) {
      const fl2 = Math.sin(this.t * 9 + T.side * 1.7) * 0.05 * k + Math.sin(this.t * 2.1 + T.side) * 0.015;
      if (T.kind === 'front') { const leg = this.legs[T.side < 0 ? 0 : 1].thigh.rotation.x; T.g.rotation.set(Math.max(-0.1, leg * 0.92) - k * 0.12 + fl2, 0, T.side * (0.04 + c * 0.25)); }
      else if (T.kind === 'back') T.g.rotation.set(-(0.06 + k * 0.55 + (air ? 0.4 : 0) + c * 0.5) + fl2, 0, 0);
      else T.g.rotation.set(-k * 0.3 + fl2, 0, T.side * (0.06 + k * 0.12 + c * 0.3));
    }
    // السلاح واليدان
    const P = this.gun ? this.gun.P : null, g = this.gun ? this.gun.group : null;
    let grip, fore;
    if (g) {
      const pistol = P.pistol, knife = P.knife, nade = P.nade;
      const recoil = Math.max(0, st.fireT || 0);
      const base = knife ? V(0.2, 0.28, -0.3) : nade ? V(0.18, 0.42, -0.25) : pistol ? V(0.06, 0.44, -0.42) : V(0.11, 0.36, -0.2);
      if (st.reloading) base.add(V(-0.03, -0.06, 0.04));
      g.position.copy(base).add(V(0, recoil * 0.01, recoil * 0.06));
      g.rotation.set(st.reloading ? -0.35 : recoil * 0.12, 0, st.reloading ? 0.3 : 0);
      g.updateMatrix();
      grip = V(...P.grip).applyMatrix4(g.matrix); fore = V(...P.fore).applyMatrix4(g.matrix);
      if (st.reloading) fore = V(0.04, 0.22, -0.2);
      if (pistol) fore = grip.clone().add(V(-0.03, -0.01, 0.01));
      if (knife || nade) fore = V(-0.2, 0.18, -0.12);
    } else { grip = V(0.2, 0.05, -0.05); fore = V(-0.2, 0.05, -0.05); }
    const R = this.arms[1], L = this.arms[0];
    solveArm(R.upper, R.fore, R.sh.position, grip, V(0.6, -1, 0.3), 0.29, 0.29);
    solveArm(L.upper, L.fore, L.sh.position, fore, V(-0.7, -1, 0.1), 0.29, 0.29);
  }
  dispose() { this.root.traverse(o => { if (o.isMesh && o.geometry && !geoCache.has(o.geometry)) { } }); }
}

// صورة مصغّرة للشخصية (لشاشة الاختيار)
export function prewarmChars() { for (const id of Object.keys(CHARS)) charMats(id); }
