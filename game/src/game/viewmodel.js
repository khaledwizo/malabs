// منظور الشخص الأول: الذراعان (أكمام وقفازات حسب الشخصية) والسلاح في مشهد مستقل لا يخترق الجدران
// تمايل وتنفس وارتداد وتلقيم بإسقاط المخزن، ترباس ومضخة متحركان، ومحاذاة دقيقة لخط النظر عند التصويب
import * as THREE from 'three';
import { buildGun } from './gunmodels.js';
import { roundBox } from './chars.js';
import { CHARS } from './chardefs.js';
import * as TX from '../gfx/tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DOWN = V(0, -1, 0);
function solve(upper, fore, S, T, pole, a, b) {
  const dir = T.clone().sub(S); let d = Math.min(Math.max(dir.length(), 0.05), (a + b) * 0.999); dir.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const pp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a * cosA)).add(pp.multiplyScalar(a * sinA));
  upper.position.copy(S); upper.quaternion.setFromUnitVectors(DOWN, E.clone().sub(S).normalize());
  fore.position.copy(E); fore.quaternion.setFromUnitVectors(DOWN, S.clone().add(dir.multiplyScalar(d)).sub(E).normalize());
}
const CLS_SCALE = { pistol: 0.92, knife: 1.35, nade: 1.2 };

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0xffe2c0, 0x5a4636, 1.0); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffd2a0, 2.2); this.key.position.set(-1, 1.2, 0.4); this.scene.add(this.key);
    this.fill = new THREE.DirectionalLight(0x9ab8ff, 0.45); this.fill.position.set(1, 0.2, 1); this.scene.add(this.fill);
    this.rim = new THREE.DirectionalLight(0xffffff, 0.6); this.rim.position.set(0.3, 0.6, -1); this.scene.add(this.rim);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.gunHolder = new THREE.Group(); this.root.add(this.gunHolder);
    this.gun = null; this.key_ = ''; this.arms = null; this.charId = null;
    this.t = 0; this.bob = 0; this.swayX = 0; this.swayY = 0; this.kick = 0; this.kickR = 0; this.drawT = 1; this.reloadT = -1; this.reloadDur = 1; this.boltT = -1; this.slashT = -1; this.throwT = -1; this.inspectT = -1; this.spin = 0;
    const fc = document.createElement('canvas'); fc.width = fc.height = 128; const x = fc.getContext('2d'); x.translate(64, 64);
    for (let k = 0; k < 6; k++) { x.rotate(Math.PI / 3 + Math.random() * 0.2); const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(255,245,210,1)'); g.addColorStop(1, 'rgba(255,140,30,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -6); x.lineTo(60, 0); x.lineTo(0, 6); x.fill(); }
    const gg = x.createRadialGradient(0, 0, 0, 0, 0, 30); gg.addColorStop(0, 'rgba(255,255,230,1)'); gg.addColorStop(1, 'rgba(255,160,50,0)'); x.fillStyle = gg; x.fillRect(-64, -64, 128, 128);
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: ft, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.32), this.flash.material); this.flash2.rotation.y = Math.PI / 2;
    this.flash.visible = this.flash2.visible = false; this.flashT = 0;
    this.flashLight = new THREE.PointLight(0xffb060, 0, 1.5, 2); this.scene.add(this.flashLight);
  }
  setChar(id) {
    if (this.charId === id) return; this.charId = id;
    if (this.arms) for (const a of this.arms) { this.root.remove(a.upper); this.root.remove(a.fore); }
    const d = CHARS[id] || CHARS.khaled, jt = TX.fabric(256, Object.assign({}, d.jacket));
    const sleeve = new THREE.MeshStandardMaterial({ map: jt.map, normalMap: jt.normalMap, roughness: 0.88 });
    const glove = new THREE.MeshStandardMaterial({ color: d.glove || '#1d1b19', roughness: 0.75, metalness: 0.05 });
    const skin = new THREE.MeshStandardMaterial({ color: d.skin, roughness: 0.6 });
    const cuff = new THREE.MeshStandardMaterial({ color: d.cuff || d.shirt, roughness: 0.85 });
    const hand = d.gloves === false ? skin : glove;
    this.arms = [-1, 1].map(s => {
      const upper = new THREE.Group(), fore = new THREE.Group();
      const u = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.3, 4, 12), sleeve); u.position.y = -0.19; u.scale.set(1, 1, 0.92); upper.add(u);
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.047, 0.26, 4, 12), sleeve); f.position.y = -0.16; fore.add(f);
      for (let k = 0; k < 3; k++) { const fold = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.006, 5, 14), sleeve); fold.rotation.x = Math.PI / 2; fold.position.y = -0.06 - k * 0.07; fore.add(fold); }
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.044, 0.035, 14), cuff); c.position.y = -0.32; fore.add(c);
      // كف وأصابع ملتفة حول المقبض
      const palm = new THREE.Mesh(roundBox(0.064, 0.085, 0.036, 0.014), hand); palm.position.y = -0.385; fore.add(palm);
      for (let k = 0; k < 4; k++) { const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.032, 3, 8), hand); fg.position.set(s * (-0.022 + k * 0.0145), -0.432, -0.014); fg.rotation.x = -1.2; fore.add(fg); }
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.036, 3, 8), hand); th.position.set(s * -0.034, -0.395, -0.02); th.rotation.set(-0.6, 0, s * 0.7); fore.add(th);
      if (d.watch && s > 0) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.016, 16), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.6 })); w.position.y = -0.3; fore.add(w); }
      this.root.add(upper, fore);
      return { upper, fore, s };
    });
  }
  setWeapon(id, scope, att) {
    const k = id + '|' + (scope || '') + '|' + (att ? [att.muzzle, att.grip, att.mag].join(',') : '');
    if (k === this.key_) return; this.key_ = k;
    if (this.gun) this.gunHolder.remove(this.gun.group);
    this.gun = buildGun(id, scope, att);
    this.gun.group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.gunHolder.add(this.gun.group);
    this.gun.P.muzzleObj.add(this.flash, this.flash2);
    this.drawT = 0; this.reloadT = -1; this.boltT = -1; this.inspectT = -1;
    this.id = id; this.scope = scope;
  }
  fire(big) {
    this.kick = Math.min(1.4, this.kick + (big ? 1.2 : 0.5)); this.kickR = (Math.random() - 0.5) * 0.5; this.flashT = 0.045;
    this.flash.rotation.z = Math.random() * 6.28; this.flash.scale.setScalar(big ? 1.5 : 1); this.spin += Math.PI / 3;
  }
  reload(dur) { this.reloadT = 0; this.reloadDur = dur; this.inspectT = -1; }
  bolt(pump) { this.boltT = 0; this.boltPump = !!pump; }
  slash() { this.slashT = 0; }
  throwNade() { this.throwT = 0; }
  inspect() { if (this.reloadT < 0) this.inspectT = 0; }
  // st: { dt, speed, onGround, ads (0..1), scoped, crouch, lean }
  update(st) {
    const dt = st.dt; this.t += dt;
    if (!this.gun) return;
    const P = this.gun.P, pistol = P.pistol, knife = P.knife, nade = P.nade;
    this.drawT = Math.min(1, this.drawT + dt / 0.45);
    if (this.reloadT >= 0) { this.reloadT += dt / this.reloadDur; if (this.reloadT >= 1) this.reloadT = -1; }
    if (this.boltT >= 0) { this.boltT += dt / 0.75; if (this.boltT >= 1) this.boltT = -1; }
    if (this.slashT >= 0) { this.slashT += dt / 0.35; if (this.slashT >= 1) this.slashT = -1; }
    if (this.throwT >= 0) { this.throwT += dt / 0.4; if (this.throwT >= 1) this.throwT = -1; }
    if (this.inspectT >= 0) { this.inspectT += dt / 3; if (this.inspectT >= 1) this.inspectT = -1; }
    this.kick *= Math.exp(-dt * 14); this.kickR *= Math.exp(-dt * 10);
    const k = Math.min(1, st.speed / 5.6) * (st.onGround ? 1 : 0.2), ads = st.ads || 0;
    this.bob += dt * st.speed * 1.9;
    const sx = 0, sy = 0;
    const sc = knife ? CLS_SCALE.knife : nade ? CLS_SCALE.nade : pistol ? CLS_SCALE.pistol : 0.82; this.gunHolder.scale.setScalar(sc);
    const hip = knife ? V(0.16, -0.15, -0.33) : nade ? V(0.15, -0.16, -0.33) : pistol ? V(0.11, -0.115, -0.33) : V(0.115, -0.112, -0.3);
    // التصويب: خط النظر في مركز الشاشة والعين خلف المنظار بمسافة مريحة
    const relief = P.scope ? (P.scope.big ? 0.075 : this.scope === 'x2' ? 0.11 : 0.15) : pistol ? 0.27 : 0.1;
    const adsPos = V(0, -P.sightY * sc, -relief - P.rearZ * sc);
    const pos = hip.clone().lerp(adsPos, ads);
    const amp = 1 - ads * 0.9;
    // تنفس خفيف حتى أثناء التصويب (أوضح في المناظير)
    const br = (0.0018 + ads * 0.0006) * (P.scope && P.scope.big ? 1.6 : 1);
    pos.x += Math.sin(this.bob) * 0.013 * k * amp + Math.sin(this.t * 0.9) * br; pos.y += -Math.abs(Math.cos(this.bob)) * 0.013 * k * amp + Math.sin(this.t * 1.5) * br * 1.3;
    pos.z += this.kick * (ads ? 0.022 : 0.05);
    if (st.crouch) pos.y -= 0.012 * amp;
    let rx = this.kick * (ads ? 0.025 : 0.09), ry = this.kickR * 0.05, rz = Math.sin(this.bob) * 0.02 * k * amp + (st.lean || 0) * -0.12 * amp;
    const dr = 1 - Math.pow(1 - this.drawT, 3); pos.y -= (1 - dr) * 0.3; rx -= (1 - dr) * 0.7;
    // التلقيم: إمالة، اليسار تنزع المخزن ثم تعيده
    let leftOff = V(0, 0, 0), magDrop = 0;
    if (this.reloadT >= 0) {
      const r = this.reloadT, e = Math.sin(Math.min(1, r * 1.15) * Math.PI);
      rz += e * 0.5; rx += e * 0.22; pos.y -= e * 0.06; pos.x -= e * 0.025;
      const ph = r < 0.3 ? r / 0.3 : r < 0.62 ? 1 : 1 - (r - 0.62) / 0.38; leftOff = V(-0.03, -0.14 * ph, 0.06 * ph);
      magDrop = r < 0.3 ? r / 0.3 : r < 0.62 ? 1 : 1 - (r - 0.62) / 0.38;
    }
    // الترباس / المضخة
    if (this.boltT >= 0) {
      const e = Math.sin(this.boltT * Math.PI);
      if (P.boltObj) { P.boltObj.position.z = e * 0.06; P.boltObj.rotation.z = e * 0.9; }
      if (P.pumpObj) P.pumpObj.position.z = e * 0.09;
      rz += e * (P.pumpObj ? 0.08 : 0.2); pos.y -= e * 0.02;
      if (P.pumpObj) leftOff.z += e * 0.09;
    } else { if (P.boltObj) { P.boltObj.position.z = 0; P.boltObj.rotation.z = 0; } if (P.pumpObj) P.pumpObj.position.z = 0; }
    if (P.cylObj) P.cylObj.rotation.z += (this.spin - P.cylObj.rotation.z) * Math.min(1, dt * 18);
    if (this.slashT >= 0) { const e = Math.sin(this.slashT * Math.PI); ry += e * 1.2; rx -= e * 0.4; pos.x -= e * 0.12; pos.z -= e * 0.08; }
    if (this.throwT >= 0) { const e = Math.sin(this.throwT * Math.PI); pos.z -= e * 0.25; pos.y += e * 0.1; rx += e * 0.8; }
    if (this.inspectT >= 0) { const e = Math.sin(this.inspectT * Math.PI); ry += e * 0.9; rz += e * 0.4; pos.x -= e * 0.06; pos.y += e * 0.03; }
    const g = this.gunHolder; g.position.copy(pos); g.rotation.set(rx, ry, rz, 'YXZ');
    this.root.visible = !st.scoped;
    // اليدان
    g.updateMatrix(); this.root.updateMatrixWorld(true);
    const m = g.matrix;
    let grip = V(...P.grip).applyMatrix4(m), fore = V(...P.fore).applyMatrix4(m).add(leftOff);
    if (pistol) fore = grip.clone().add(V(-0.03, -0.012, 0.018));
    if (knife || nade) fore = V(-0.22, -0.32, -0.25);
    if (magDrop > 0 && !pistol && !knife && !nade) fore = fore.lerp(V(-0.05, -0.32, -0.3), magDrop * 0.6);
    if (this.arms) {
      const [L, R] = this.arms;
      solve(R.upper, R.fore, V(0.22, -0.34, 0.08), grip, V(0.8, -1, 0.3), 0.37, 0.39);
      solve(L.upper, L.fore, V(-0.25, -0.36, 0.04), fore, V(-0.8, -1, 0.2), 0.37, 0.39);
    }
    if (this.flashT > 0) { this.flashT -= dt; this.flash.visible = this.flash2.visible = true; this.flashLight.intensity = 3; this.flashLight.position.copy(V(...P.muzzle).applyMatrix4(m)); }
    else { this.flash.visible = this.flash2.visible = false; this.flashLight.intensity = 0; }
  }
  // الإضاءة تتبع ظل المكان والطقس
  setLight(sunVis, w) {
    const sun = w ? w.sun : 2.3, amb = w ? w.amb : 1.0;
    this.key.intensity += ((sunVis ? sun : sun * 0.15) - this.key.intensity) * 0.1;
    this.hemi.intensity += ((sunVis ? amb : amb * 0.85) - this.hemi.intensity) * 0.1;
    if (w && w.flash) { this.hemi.intensity = amb + w.flash * 3; }
    if (w) { this.key.color.setHex(w.sunCol); this.hemi.color.setHex(w.skyCol); }
  }
}
