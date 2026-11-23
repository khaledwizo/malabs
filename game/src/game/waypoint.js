// التأشير على طريقة GTA سان أندرياس: علامة بالخريطة + خط طريق على الشوارع + عمود ضوء بالعالم
// - «مسار»: يُرسم الطريق ويُمسح وحده عند الوصول
// - «نقطة»: علامة فقط تبقى حتى تشيلها
// - المهام تضع علامتها بنفسها (ذهبي)، وعلامات الفريق تتشارك بالمعركة (سماوي)
import * as THREE from 'three';
import { findPath, pathLen } from './route.js';

export const WP_COL = { quest: '#ffc83a', mine: '#ff3fb4', team: '#38d6ff', giver: '#39e26a' };

function beamTex() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 8, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let BT = null;

class Beacon {
  constructor(scene, col) {
    BT = BT || beamTex();
    const g = this.g = new THREE.Group(); g.renderOrder = 5;
    const c = new THREE.Color(col);
    const bm = new THREE.MeshBasicMaterial({ map: BT, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 26, 16, 1, true), bm); beam.position.y = 13; g.add(beam);
    const rm = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 32), rm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const ring2 = this.ring2 = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), rm); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.06; g.add(ring2);
    const dm = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
    const dia = this.dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), dm); dia.scale.y = 1.5; dia.position.y = 2.7; g.add(dia);
    this.beam = beam; g.visible = false; scene.add(g);
  }
  set(x, y, z) { this.g.position.set(x, y, z); this.g.visible = true; }
  hide() { this.g.visible = false; }
  update(t, d) {
    if (!this.g.visible) return;
    this.dia.rotation.y = t * 2.2; this.dia.position.y = 2.6 + Math.sin(t * 3) * 0.15;
    const s = 1 + 0.25 * Math.sin(t * 4); this.ring.scale.set(s, s, s);
    // يكبر مع البعد حتى يبان من بعيد، ويخفت لما توصل
    const k = Math.max(1, d / 18); this.beam.scale.set(k, 1, k); this.dia.scale.set(Math.max(1, d / 25), Math.max(1.5, d / 16), Math.max(1, d / 25));
    this.beam.material.opacity = d < 4 ? 0.35 : 0.9;
  }
}

export class Waypoints {
  constructor(game) {
    this.g = game; this.mine = null; this.quest = null; this.team = new Map(); this.path = null; this.pathT = 0; this.t = 0;
    this.b = { mine: new Beacon(game.scene, WP_COL.mine), quest: new Beacon(game.scene, WP_COL.quest) };
    this.tb = new Map();
  }
  reset() { this.mine = null; this.quest = null; this.team.clear(); this.path = null; for (const b of Object.values(this.b)) b.hide(); for (const b of this.tb.values()) b.hide(); }
  groundY(x, z) { const w = this.g.world, h = w.ray(x, 30, z, 0, -1, 0, 40, 0, {}); return h ? 30 - h.t : 0; }
  setMine(x, z, route) {
    this.mine = { x, z, y: 0, route: !!route }; this.path = null; this.pathT = 0;
    const s = this.g.sim; if (s && s.setMark) s.setMark(this.g.me, [Math.round(x * 10) / 10, Math.round(z * 10) / 10, route ? 1 : 0]);
  }
  clearMine() { this.mine = null; this.path = null; const s = this.g.sim; if (s && s.setMark) s.setMark(this.g.me, null); }
  setQuest(x, z, label) { this.quest = { x, z, label: label || '' }; this.path = null; this.pathT = 0; }
  clearQuest() { this.quest = null; this.path = null; }
  onMark(e, me) {
    if (!me || e.id === this.g.me) return;
    if (!e.p) { this.team.delete(e.id); return; }
    if (e.team !== me.team) return;
    this.team.set(e.id, { x: e.p[0], z: e.p[1], route: !!e.p[2], name: e.name || '' });
  }
  // الهدف اللي ينرسم طريقه: المهمة أولاً، وإلا مساري
  get target() { return this.quest || (this.mine && this.mine.route ? this.mine : null); }
  update(dt) {
    this.t += dt;
    const g = this.g, me = g.mp, cam = g.camera.position;
    const put = (b, m) => { if (!m) { b.hide(); return; } b.set(m.x, m.y ?? 0, m.z); b.update(this.t, Math.hypot(m.x - cam.x, m.z - cam.z)); };
    put(this.b.mine, this.mine); put(this.b.quest, this.quest);
    const seen = new Set();
    for (const [id, m] of this.team) { seen.add(id); let b = this.tb.get(id); if (!b) { b = new Beacon(g.scene, WP_COL.team); this.tb.set(id, b); } put(b, m); }
    for (const [id, b] of this.tb) if (!seen.has(id)) b.hide();
    if (!me || !me.alive) return;
    // الوصول: المسار يُمسح وحده
    if (this.mine && this.mine.route && Math.hypot(this.mine.x - me.pos[0], this.mine.z - me.pos[2]) < 3) { this.clearMine(); g.ui && g.ui.toast && g.ui.toast('وصلت للعلامة'); }
    const T = this.target;
    if (!T) { this.path = null; return; }
    if ((this.pathT -= dt) <= 0) { this.pathT = 0.6; this.path = findPath(g.world, me.pos, [T.x, 0, T.z]); this.dist = pathLen(this.path); }
    else if (this.path) { this.path[0] = [me.pos[0], me.pos[2]]; }
  }
}
