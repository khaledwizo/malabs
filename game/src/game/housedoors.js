// أبواب بيوت السوق (مغلقة باللوبي — ما تنفتح للاعب): أهل السوق يرجعون لبيوتهم منها
// يوصل للباب، الباب ينفتح، يدخل، والباب يتسكّر وراه.
import * as THREE from 'three';
import { F } from '../world/collide.js';

const W = 1.0, H = 2.15;
export class HouseDoors {
  constructor(g) { this.g = g; this.list = null; this.grp = null; }
  build() {
    if (this.list) return;
    const w = this.g.world, N = (w.nav && w.nav.nodes) || [], out = [];
    const avoid = [[-67, -19, -50, -5], [-84, -9, -74, 1]]; // المضيف والمرقد
    const bad = (x, z) => avoid.some(([a, b, c, d]) => x > a && x < c && z > b && z < d) || (w.doors || []).some(d => Math.hypot(d.x - x, d.z - z) < 4) || (w.noFire || []).some(([a, b, c, d]) => x > a - 1 && x < c + 1 && z > b - 1 && z < d + 1);
    const hit = (x, y, z, dx, dz, L) => { const h = w.ray(x, y, z, dx, 0, dz, L, F.NOBULLET, {}); return h ? h.t : -1; };
    for (const n of N) {
      if (Math.abs(n[1]) > 0.3) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const t = hit(n[0], 1.0, n[2], dx, dz, 2.6); if (t < 0.7) continue;
        // جدار مستوي وعالي وعريض كفاية لباب
        const lx = -dz, lz = dx; let ok = true;
        for (const [o, y] of [[0, 0.3], [0, 2.2], [0, 2.9], [0.6, 1.0], [-0.6, 1.0], [0.6, 2.1], [-0.6, 2.1]]) { const tt = hit(n[0] + lx * o, y, n[2] + lz * o, dx, dz, 2.6); if (tt < 0 || Math.abs(tt - t) > 0.04) { ok = false; break; } }
        if (!ok) continue;
        const px = n[0] + dx * t, pz = n[2] + dz * t; if (bad(px, pz)) continue;
        if (out.some(d => Math.hypot(d.x - px, d.z - pz) < 8)) continue;
        out.push({ x: px - dx * 0.035, z: pz - dz * 0.035, nx: -dx, nz: -dz, fx: px - dx * 0.9, fz: pz - dz * 0.9 });
        break;
      }
      if (out.length >= 24) break;
    }
    const wood = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.75 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.8 }), brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.35 });
    const grp = this.grp = new THREE.Group(); this.g.scene.add(grp);
    for (const d of out) {
      const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = Math.atan2(d.nx, d.nz); grp.add(g);
      // إطار + درفة تدور على مفصّلها
      for (const [x, y, sw, sh] of [[-W / 2 - 0.05, H / 2, 0.1, H], [W / 2 + 0.05, H / 2, 0.1, H], [0, H + 0.05, W + 0.2, 0.1]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 0.08), dark); m.position.set(x, y, 0.02); g.add(m); }
      const inside = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x120c08 })); inside.position.set(0, H / 2, -0.015); g.add(inside); // عتمة البيت ورا الباب
      const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, 0.0); g.add(hinge);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, H - 0.02, 0.05), wood); leaf.position.set(W / 2, H / 2, 0); leaf.castShadow = true; hinge.add(leaf);
      for (const yy of [0.55, 1.55]) { const p = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.5, 0.012), dark); p.position.set(W / 2, yy, 0.03); hinge.add(p); }
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), brass); knob.position.set(W - 0.12, 1.05, 0.05); hinge.add(knob);
      d.hinge = hinge; d.open = 0; d.want = 0; d.busy = 0;
    }
    this.list = out;
  }
  clear() { if (this.grp) this.g.scene.remove(this.grp); this.grp = null; this.list = null; }
  // أقرب باب فاضي (بعيد عن نقطة معيّنة إذا لزم)
  pick(x, z, far = 0) {
    if (!this.list || !this.list.length) return null;
    const L = this.list.filter(d => !d.busy && Math.hypot(d.fx - x, d.fz - z) > far).sort((a, b) => Math.hypot(a.fx - x, a.fz - z) - Math.hypot(b.fx - x, b.fz - z));
    return L.length ? L[Math.floor(Math.random() * Math.min(3, L.length))] : null;
  }
  // يمشي للباب، يفتحه، يدخل ويختفي، والباب يتسكّر
  enter(w, d, cb) {
    if (!d) { cb && cb(); return; }
    d.busy++;
    w.goTo(d.fx, d.fz, () => {
      w.face(d.x, d.z); d.want = 1;
      setTimeout(() => { w.path = [[w.n.x, w.n.z], [d.x - d.nx * 0.2, d.z - d.nz * 0.2]]; w.pi = 1; w.onArrive = () => { w.hidden = true; setTimeout(() => { d.want = 0; d.busy = Math.max(0, d.busy - 1); cb && cb(); }, 700); }; }, 550);
    });
  }
  update(dt) { if (!this.list) return; for (const d of this.list) { if (Math.abs(d.open - d.want) < 0.001) continue; d.open += Math.sign(d.want - d.open) * Math.min(Math.abs(d.want - d.open), dt * 2.6); d.hinge.rotation.y = d.open * 1.45; } }
}
