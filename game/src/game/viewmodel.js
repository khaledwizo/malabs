// منظور الشخص الأول: الذراعان والسلاح في مشهد مستقل (لا يخترقان الجدران) مع تمايل، ارتداد، تلقيم، وتصويب بالمنظار
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

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0xffe2c0, 0x5a4636, 1.1); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffd2a0, 2.2); this.key.position.set(-1, 1.2, 0.4); this.scene.add(this.key);
    this.fill = new THREE.DirectionalLight(0x9ab8ff, 0.4); this.fill.position.set(1, 0.2, 1); this.scene.add(this.fill);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.gunHolder = new THREE.Group(); this.root.add(this.gunHolder);
    this.gun = null; this.key_ = ''; this.arms = null; this.charId = null;
    this.t = 0; this.bob = 0; this.swayX = 0; this.swayY = 0; this.kick = 0; this.kickR = 0; this.drawT = 1; this.reloadT = -1; this.reloadDur = 1; this.boltT = -1; this.slashT = -1; this.throwT = -1; this.inspectT = -1;
    // ومضة الفوهة
    const fc = document.createElement('canvas'); fc.width = fc.height = 128; const x = fc.getContext('2d'); x.translate(64, 64);
    for (let k = 0; k < 6; k++) { x.rotate(Math.PI / 3 + Math.random() * 0.2); const g = x.createLinearGradient(0, 0, 60, 0); g.addColorStop(0, 'rgba(255,245,210,1)'); g.addColorStop(1, 'rgba(255,140,30,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -6); x.lineTo(60, 0); x.lineTo(0, 6); x.fill(); }
    const gg = x.createRadialGradient(0, 0, 0, 0, 0, 30); gg.addColorStop(0, 'rgba(255,255,230,1)'); gg.addColorStop(1, 'rgba(255,160,50,0)'); x.fillStyle = gg; x.fillRect(-64, -64, 128, 128);
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: ft, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.32), this.flash.material); this.flash2.rotation.y = Math.PI / 2;
    this.flash.visible = this.flash2.visible = false; this.flashT = 0;
  }
  setChar(id) {
    if (this.charId === id) return; this.charId = id;
    if (this.arms) for (const a of this.arms) { this.root.remove(a.upper); this.root.remove(a.fore); }
    const d = CHARS[id], jt = TX.fabric(256, Object.assign({}, d.jacket));
    const sleeve = new THREE.MeshStandardMaterial({ map: jt.map, normalMap: jt.normalMap, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: d.skin, roughness: 0.6 });
    const cuff = new THREE.MeshStandardMaterial({ color: d.shirt, roughness: 0.8 });
    this.arms = [-1, 1].map(s => {
      const upper = new THREE.Group(), fore = new THREE.Group();
      const u = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 10), sleeve); u.position.y = -0.19; upper.add(u);
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, 0.27, 4, 10), sleeve); f.position.y = -0.17; fore.add(f);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.03, 12), cuff); c.position.y = -0.33; fore.add(c);
      const h = new THREE.Mesh(roundBox(0.062, 0.09, 0.034, 0.016), skin); h.position.y = -0.395; fore.add(h);
      const th = new THREE.Mesh(roundBox(0.02, 0.05, 0.02, 0.008), skin); th.position.set(s * -0.03, -0.38, -0.02); th.rotation.z = s * 0.5; fore.add(th);
      this.root.add(upper, fore);
      return { upper, fore, s };
    });
  }
  setWeapon(id, scope) {
    const k = id + '|' + (scope || '');
    if (k === this.key_) return; this.key_ = k;
    if (this.gun) this.gunHolder.remove(this.gun.group);
    this.gun = buildGun(id, scope);
    this.gun.group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
    this.gunHolder.add(this.gun.group);
    this.gun.P.muzzleObj.add(this.flash, this.flash2);
    this.drawT = 0; this.reloadT = -1; this.boltT = -1; this.inspectT = -1;
    this.id = id; this.scope = scope;
  }
  fire(big) { this.kick = Math.min(1.4, this.kick + (big ? 1.2 : 0.55)); this.kickR = (Math.random() - 0.5) * 0.5; this.flashT = 0.045; this.flash.rotation.z = Math.random() * 6.28; this.flash.scale.setScalar(big ? 1.5 : 1); }
  reload(dur) { this.reloadT = 0; this.reloadDur = dur; this.inspectT = -1; }
  bolt() { this.boltT = 0; }
  slash() { this.slashT = 0; }
  throwNade() { this.throwT = 0; }
  inspect() { if (this.reloadT < 0) this.inspectT = 0; }
  // st: { dt, speed, onGround, ads (0..1), lookDX, lookDY, scoped, crouch }
  update(st) {
    const dt = st.dt; this.t += dt;
    if (!this.gun) return;
    const P = this.gun.P, pistol = P.pistol, knife = P.knife, nade = P.nade;
    this.drawT = Math.min(1, this.drawT + dt / 0.45);
    if (this.reloadT >= 0) { this.reloadT += dt / this.reloadDur; if (this.reloadT >= 1) this.reloadT = -1; }
    if (this.boltT >= 0) { this.boltT += dt / 0.9; if (this.boltT >= 1) this.boltT = -1; }
    if (this.slashT >= 0) { this.slashT += dt / 0.35; if (this.slashT >= 1) this.slashT = -1; }
    if (this.throwT >= 0) { this.throwT += dt / 0.4; if (this.throwT >= 1) this.throwT = -1; }
    if (this.inspectT >= 0) { this.inspectT += dt / 3; if (this.inspectT >= 1) this.inspectT = -1; }
    this.kick *= Math.exp(-dt * 14); this.kickR *= Math.exp(-dt * 10);
    const k = Math.min(1, st.speed / 5.6) * (st.onGround ? 1 : 0.2), ads = st.ads;
    this.bob += dt * st.speed * 1.9;
    this.swayX += ((st.lookDX || 0) * -0.6 - this.swayX) * Math.min(1, dt * 10); this.swayY += ((st.lookDY || 0) * 0.6 - this.swayY) * Math.min(1, dt * 10);
    const sx = Math.max(-0.04, Math.min(0.04, this.swayX)), sy = Math.max(-0.04, Math.min(0.04, this.swayY));
    // موضع الورك ← موضع التصويب
    const sc = knife ? 1.5 : nade ? 1.2 : pistol ? 0.85 : 0.68; this.gunHolder.scale.setScalar(sc);
    const hip = knife ? V(0.17, -0.16, -0.34) : nade ? V(0.16, -0.18, -0.34) : pistol ? V(0.13, -0.15, -0.36) : V(0.14, -0.15, -0.3);
    const adsPos = V(0, -P.sightY * sc, P.scope && P.scope.big ? -0.1 : pistol ? -0.33 : -0.2);
    const pos = hip.clone().lerp(adsPos, ads);
    const amp = 1 - ads * 0.85;
    pos.x += Math.sin(this.bob) * 0.012 * k * amp + sx * amp; pos.y += -Math.abs(Math.cos(this.bob)) * 0.012 * k * amp + sy * amp + Math.sin(this.t * 1.6) * 0.002 * amp;
    pos.z += this.kick * (ads ? 0.025 : 0.05);
    if (st.crouch) pos.y -= 0.01 * amp;
    let rx = this.kick * (ads ? 0.03 : 0.09), ry = this.kickR * 0.05 + sx * 1.2, rz = sx * -0.8 + Math.sin(this.bob) * 0.02 * k * amp;
    // حركة السحب
    const dr = 1 - Math.pow(1 - this.drawT, 3); pos.y -= (1 - dr) * 0.3; rx -= (1 - dr) * 0.7;
    // التلقيم: إمالة وانخفاض
    let leftOff = V(0, 0, 0);
    if (this.reloadT >= 0) {
      const r = this.reloadT, e = Math.sin(Math.min(1, r * 1.15) * Math.PI);
      rz += e * 0.55; rx += e * 0.25; pos.y -= e * 0.07; pos.x -= e * 0.03;
      const ph = r < 0.35 ? r / 0.35 : r < 0.7 ? 1 : 1 - (r - 0.7) / 0.3; leftOff = V(-0.02, -0.12 * ph, 0.05 * ph);
    }
    if (this.boltT >= 0) { const e = Math.sin(this.boltT * Math.PI); rz += e * 0.25; pos.y -= e * 0.03; }
    if (this.slashT >= 0) { const e = Math.sin(this.slashT * Math.PI); ry += e * 1.2; rx -= e * 0.4; pos.x -= e * 0.12; pos.z -= e * 0.08; }
    if (this.throwT >= 0) { const e = Math.sin(this.throwT * Math.PI); pos.z -= e * 0.25; pos.y += e * 0.1; rx += e * 0.8; }
    if (this.inspectT >= 0) { const e = Math.sin(this.inspectT * Math.PI); ry += e * 0.9; rz += e * 0.4; pos.x -= e * 0.06; pos.y += e * 0.03; }
    const g = this.gunHolder; g.position.copy(pos); g.rotation.set(rx, ry, rz, 'YXZ');
    // إخفاء السلاح مع المنظار المكبّر
    this.root.visible = !st.scoped;
    // اليدان
    g.updateMatrix(); this.root.updateMatrixWorld(true);
    const m = g.matrix;
    let grip = V(...P.grip).applyMatrix4(m), fore = V(...P.fore).applyMatrix4(m).add(leftOff);
    if (pistol) fore = grip.clone().add(V(-0.035, -0.015, 0.02));
    if (knife || nade) fore = V(-0.22, -0.32, -0.25);
    if (this.arms) {
      const [L, R] = this.arms;
      solve(R.upper, R.fore, V(0.24, -0.36, 0.08), grip, V(0.8, -1, 0.3), 0.36, 0.4);
      solve(L.upper, L.fore, V(-0.26, -0.38, 0.06), fore, V(-0.8, -1, 0.2), 0.36, 0.4);
    }
    // ومضة
    if (this.flashT > 0) { this.flashT -= dt; this.flash.visible = this.flash2.visible = true; } else this.flash.visible = this.flash2.visible = false;
  }
  // الإضاءة تتبع ظل المكان الذي يقف فيه اللاعب
  setLight(sunVis, tint) {
    this.key.intensity += ((sunVis ? 2.3 : 0.35) - this.key.intensity) * 0.1;
    this.hemi.intensity = sunVis ? 1.0 : 0.85;
  }
}
