// الأبواب الخشبية: ألواح بمفصلات تدور بسلاسة حسب حالة المحاكاة (محلية أو من السيرفر)
import * as THREE from 'three';
import * as TX from '../gfx/tex.js';
import { Audio } from '../core/audio.js';

const MATS = new Map();
function doorMat(kind) {
  if (MATS.has(kind)) return MATS.get(kind);
  const base = kind === 'woodGreen' ? [40, 92, 62] : kind === 'woodBlue' ? [48, 88, 120] : [74, 50, 32];
  let m;
  try { const t = TX.wood(256, { base, seed: 33, planks: 4 }); m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.75 }); }
  catch (e) { m = new THREE.MeshStandardMaterial({ color: new THREE.Color(`rgb(${base.join(',')})`), roughness: 0.75 }); }
  MATS.set(kind, m); return m;
}
const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 0.85 });

export class DoorVis {
  constructor(game) {
    this.g = game; this.list = [];
    for (const d of game.world.doors || []) {
      const grp = new THREE.Group(); grp.position.set(d.x, d.y, d.z); if (d.axis === 'z') grp.rotation.y = Math.PI / 2;
      const leaves = [], n = d.leaves || 1, lw = d.w / n, th = 0.09, m = doorMat(d.mat);
      for (let k = 0; k < n; k++) {
        // المفصلة على حافة اللوح؛ اللوحان يفتحان كلٌّ لجهته
        const side = n === 1 ? -1 : (k === 0 ? -1 : 1);
        const hinge = new THREE.Group(); hinge.position.x = side * d.w / 2; grp.add(hinge);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw - 0.02, d.h - 0.02, th), m); leaf.position.set(-side * lw / 2, d.h / 2, 0); leaf.castShadow = true; leaf.receiveShadow = true; hinge.add(leaf);
        // حشوات بارزة ومقبض نحاسي
        for (const yy of [0.28, 0.72]) { const p = new THREE.Mesh(new THREE.BoxGeometry(lw * 0.7, d.h * 0.32, th + 0.03), m); p.position.set(-side * lw / 2, d.h * yy, 0); hinge.add(p); }
        for (const zz of [-1, 1]) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), brass); kn.position.set(-side * (lw - 0.12), d.h * 0.48, zz * 0.07); hinge.add(kn); }
        for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), brass); s.position.set(-side * lw * (0.3 + c * 0.4), d.h * (0.12 + r * 0.25), 0.06); hinge.add(s); }
        leaves.push({ hinge, side });
      }
      game.scene.add(grp);
      this.list.push({ d, grp, leaves, a: 0, open: false });
    }
  }
  stateOf(i) { const s = this.g.sim; if (!s) return false; if (s.doors) return !!(s.doors[i] && s.doors[i].open); return (s.doorsOpen || []).includes(i); }
  reset() { for (const D of this.list) { D.open = false; D.a = 0; this.apply(D); } }
  apply(D) { for (const L of D.leaves) L.hinge.rotation.y = L.side * D.a * (D.d.swing || 1) * -1.45; }
  update(dt) {
    const W = this.g.world, online = !!(this.g.sim && this.g.sim.online);
    this.list.forEach((D, i) => {
      const o = this.stateOf(i);
      if (o !== D.open) {
        D.open = o; Audio.play(o ? 'doorOpen' : 'doorClose', [D.d.x, 1.2, D.d.z]);
      }
      // أونلاين: نطابق التصادم المحلي (للتنبّؤ بالحركة) مع السيرفر
      if (online) { if (o) W.disable(D.d.box); else W.restore(D.d.box); }
      const tgt = o ? 1 : 0; if (D.a !== tgt) { D.a += Math.sign(tgt - D.a) * Math.min(Math.abs(tgt - D.a), dt * 2.2); this.apply(D); }
    });
  }
  // أقرب باب ضمن مدى «استعمال» (للزر)
  near(p, r = 2.3) { let b = null, bd = r; for (const D of this.list) { const d = Math.hypot(D.d.x - p[0], D.d.z - p[2]); if (d < bd) { bd = d; b = D; } } return b; }
}
