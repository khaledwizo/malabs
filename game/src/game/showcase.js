// معاينة ثلاثية الأبعاد للأسلحة والعتاد بالمساحة الفاضية جنب اللوحة: تظهر كاملة دائماً وتدوّرها بإصبعك 360°
import * as THREE from 'three';
import { buildGun } from './gunmodels.js';

const S = o => new THREE.MeshStandardMaterial(o);
const cyl = (g, m, r, h, x, y, z, rx = 0, rz = 0, seg = 16, r2) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r, r, h, seg), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); g.add(o); return o; };
const box = (g, m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };

// نماذج الصحة والمعدّات والعتاد (الأسلحة والقنابل من gunmodels)
function buildItem(id) {
  const g = new THREE.Group();
  if (id === 'bandage') {
    const w = S({ color: 0xf2efe6, roughness: 0.95 }); cyl(g, w, 0.045, 0.07, 0, 0, 0, Math.PI / 2); cyl(g, S({ color: 0xc9c2b2, roughness: 1 }), 0.016, 0.072, 0, 0, 0, Math.PI / 2);
    const tail = box(g, w, 0.07, 0.003, 0.12, 0, -0.044, 0.06); tail.rotation.x = 0.15;
    box(g, S({ color: 0xc8202a, roughness: 0.6 }), 0.02, 0.004, 0.02, 0, 0.046, 0);
  } else if (id === 'syringe') {
    const gl = S({ color: 0xd8f0ff, roughness: 0.05, transparent: true, opacity: 0.45 }), liq = S({ color: 0xffa21a, emissive: 0x552200, roughness: 0.3 });
    cyl(g, gl, 0.016, 0.14, 0, 0, 0); cyl(g, liq, 0.012, 0.09, 0, -0.02, 0); cyl(g, S({ color: 0x2a2a2a }), 0.0025, 0.05, 0, -0.095, 0); cyl(g, S({ color: 0xeeeeee }), 0.004, 0.08, 0, 0.1, 0); box(g, S({ color: 0xeeeeee }), 0.05, 0.006, 0.02, 0, 0.07, 0); box(g, S({ color: 0xeeeeee }), 0.03, 0.006, 0.03, 0, 0.142, 0);
  } else if (id === 'nvg') {
    const b = S({ color: 0x2a3026, roughness: 0.6, metalness: 0.2 }), lens = S({ color: 0x1a4a1a, emissive: 0x2aff4a, emissiveIntensity: 0.6, roughness: 0.1 });
    box(g, b, 0.12, 0.05, 0.06, 0, 0, 0); for (const s of [-1, 1]) { cyl(g, b, 0.024, 0.08, s * 0.035, 0, -0.06, Math.PI / 2); cyl(g, lens, 0.02, 0.005, s * 0.035, 0, -0.101, Math.PI / 2); }
    box(g, S({ color: 0x151515, roughness: 0.9 }), 0.18, 0.02, 0.02, 0, 0.02, 0.05); cyl(g, b, 0.008, 0.06, 0, 0.05, 0.01);
  } else if (id.startsWith('ammo:')) {
    const k = id.slice(5), brass = S({ color: 0xc99a42, roughness: 0.28, metalness: 1 }), tip = S({ color: 0x8a5a32, roughness: 0.4, metalness: 0.9 });
    if (k === 'shot') { for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.03; cyl(g, S({ color: 0xa8201a, roughness: 0.6 }), 0.012, 0.06, x, 0.01, 0); cyl(g, brass, 0.0125, 0.016, x, -0.027, 0); } }
    else {
      const L = k === 'snip' ? 0.085 : k === 'dmr' ? 0.072 : k === 'pist' ? 0.03 : 0.056, R = k === 'pist' ? 0.0055 : k === 'snip' ? 0.0068 : 0.0055;
      for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.022; cyl(g, brass, R, L, x, 0, 0); const t = cyl(g, tip, R * 0.1, L * 0.35, x, L / 2 + L * 0.17, 0, 0, 0, 12, R); }
      box(g, S({ color: 0x3a3f34, roughness: 0.8 }), 0.14, 0.006, 0.05, 0, -L / 2 - 0.003, 0);
    }
  }
  return g;
}

export class Showcase {
  constructor(renderer) {
    this.r = renderer; this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xfff4e0, 0x30261c, 1.2));
    const k = new THREE.DirectionalLight(0xffffff, 2.6); k.position.set(1.5, 2.5, 2); s.add(k);
    const rim = new THREE.DirectionalLight(0xffc880, 1.6); rim.position.set(-2, 1, -2); s.add(rim);
    this.pivot = new THREE.Group(); s.add(this.pivot);
    this.yaw = 0.6; this.pitch = 0.15; this.vy = 0; this.drag = null; this.idle = 0; this.key = ''; this.el = null; this.R = 1;
  }
  // kind: 'gun' | 'nade' | 'item'
  set(kind, id, scope, att) {
    const key = [kind, id, scope, att && JSON.stringify(att)].join('|'); if (key === this.key) return; this.key = key;
    while (this.pivot.children.length) this.pivot.remove(this.pivot.children[0]);
    if (!id) { this.obj = null; return; }
    let o;
    try { o = kind === 'item' ? buildItem(id) : buildGun(id, scope, att).group; } catch (e) { o = buildItem('ammo:auto'); }
    // نوسّط النموذج ونحسب نصف قطر يحيط به حتى يظهر كامل بأي زاوية
    const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    o.position.sub(c); const holder = new THREE.Group(); holder.add(o);
    // نوجّه أطول محور للنموذج على طول المساحة (عمودي إذا المساحة طويلة)
    this.long = sz.z >= sz.x && sz.z >= sz.y ? 'z' : sz.y >= sz.x ? 'y' : 'x'; this.holder = holder;
    this.R = Math.max(0.03, Math.hypot(sz.x, sz.y, sz.z) / 2);
    this.pivot.add(holder); this.obj = o; this.yaw = 0.5; this.pitch = 0.12;
  }
  attach(el) {
    if (this.el === el) return; this.el = el; if (!el || el._sc) return; el._sc = 1;
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); this.drag = { x: e.clientX, y: e.clientY, t: performance.now() }; this.vy = 0; });
    el.addEventListener('pointermove', e => { const d = this.drag; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; this.yaw += dx * 0.012; this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + dy * 0.01)); const now = performance.now(); this.vy = dx * 0.012 / Math.max(0.008, (now - d.t) / 1000); d.t = now; this.idle = 0; });
    const up = () => { this.drag = null; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); this.yaw += e.deltaY * 0.004; }, { passive: false });
  }
  render(dt, rect) {
    if (!this.obj || !rect || rect.width < 40 || rect.height < 40) return;
    const r = this.r, H = innerHeight;
    // دوران تلقائي هادئ إذا ما تلمسه، وزخم بعد السحب
    if (!this.drag) { this.idle += dt; if (Math.abs(this.vy) > 0.05) { this.yaw += this.vy * dt; this.vy *= Math.pow(0.04, dt); } else if (this.idle > 1.2) this.yaw += dt * 0.45; }
    const tall = rect.height > rect.width * 1.1;
    const h = this.holder; h.rotation.set(0, 0, 0);
    if (this.long === 'z') { if (tall) h.rotation.x = -Math.PI / 2; else h.rotation.y = Math.PI / 2; } // السبطانة للأعلى أو بالعرض
    else if (this.long === 'x' && tall) h.rotation.z = Math.PI / 2;
    this.pivot.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const asp = rect.width / rect.height; this.cam.aspect = asp;
    const vf = THREE.MathUtils.degToRad(this.cam.fov) / 2, hf = Math.atan(Math.tan(vf) * asp), f = Math.min(vf, hf);
    const dist = this.R / Math.sin(f) * 1.06; this.cam.position.set(0, 0, dist); this.cam.lookAt(0, 0, 0); this.cam.near = Math.max(0.005, dist - this.R * 1.5); this.cam.far = dist + this.R * 2; this.cam.updateProjectionMatrix();
    const x = rect.left, y = H - rect.bottom;
    r.setScissorTest(true); r.setScissor(x, y, rect.width, rect.height); r.setViewport(x, y, rect.width, rect.height);
    r.autoClear = false; r.clearDepth(); r.render(this.scene, this.cam);
    r.setScissorTest(false); r.setViewport(0, 0, innerWidth, innerHeight); r.autoClear = true;
  }
}
