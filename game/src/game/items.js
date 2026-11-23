// أغراض المهام اللي تنحمل باليد وتنسلّم لأصحابها (القاعدة عند الأرض، القياس بالمتر)
import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0, emissive: o.e || 0x000000, emissiveIntensity: o.ei || 0 });
const box = (g, w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
const ball = (g, r, m, x = 0, y = 0, z = 0, s) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), m); b.position.set(x, y, z); if (s) b.scale.set(...s); g.add(b); return b; };

export const ITEM_ICON = { gas: '🛢', bag: '👜', wallet: '👛', toy: '🧸', beads: '📿', keys: '🔑', glasses: '👓', ring: '💍', honey: '🍯', meds: '💊' };
// مكان الغرض بالمنظور الأول (pos) وتكبيره
export const ITEM_VIEW = { honey: { p: [0.13, -0.24, -0.4], s: 1.2 }, meds: { p: [0.12, -0.2, -0.36], s: 1.4 }, gas: { p: [0.18, -0.42, -0.55], s: 1 }, bag: { p: [0.16, -0.34, -0.5], s: 1 }, wallet: { p: [0.12, -0.2, -0.36], s: 1.4 }, toy: { p: [0.14, -0.26, -0.42], s: 1.2 }, beads: { p: [0.12, -0.2, -0.36], s: 1.4 }, keys: { p: [0.12, -0.2, -0.36], s: 1.5 }, glasses: { p: [0.1, -0.19, -0.34], s: 1.4 }, ring: { p: [0.1, -0.17, -0.3], s: 2.6 } };

export function makeItem(kind) {
  const g = new THREE.Group();
  if (kind === 'gas') {
    const m = M(0x2a7a3a, { m: 0.3, r: 0.5 }); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.38, 18), m); c.position.y = 0.19; g.add(c);
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); t.position.y = 0.38; g.add(t);
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.05, 10), M(0xc9a24a, { m: 0.9, r: 0.3 })); v.position.y = 0.52; g.add(v);
  } else if (kind === 'bag') {
    const m = M(0x5a3018, { r: 0.7 }); box(g, 0.42, 0.28, 0.14, m, 0, 0.14);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 14, Math.PI), m); h.position.y = 0.28; g.add(h); box(g, 0.05, 0.03, 0.02, M(0xc9a24a, { m: 0.9, r: 0.3 }), 0, 0.22, 0.075);
  } else if (kind === 'wallet') {
    const m = M(0x3a2414, { r: 0.75 }); box(g, 0.11, 0.022, 0.09, m, 0, 0.011); box(g, 0.112, 0.006, 0.03, M(0x2a1a0e), 0, 0.024, 0.02);
  } else if (kind === 'toy') {
    const fur = M(0xb07a44, { r: 1 }), dark = M(0x1a1410); ball(g, 0.075, fur, 0, 0.08, 0, [1, 1.1, 0.85]); ball(g, 0.055, fur, 0, 0.19, 0);
    for (const s of [-1, 1]) { ball(g, 0.022, fur, s * 0.045, 0.235, 0); ball(g, 0.026, fur, s * 0.07, 0.1, 0.01); ball(g, 0.028, fur, s * 0.04, 0.02, 0.02); ball(g, 0.007, dark, s * 0.018, 0.2, 0.05); }
    ball(g, 0.014, dark, 0, 0.18, 0.055); box(g, 0.1, 0.018, 0.02, M(0xb02a2a), 0, 0.145, 0.045);
  } else if (kind === 'beads') {
    const m = M(0x2f7a52, { r: 0.35, m: 0.1 }); for (let i = 0; i < 33; i++) { const a = i / 33 * Math.PI * 2; ball(g, 0.009, m, Math.cos(a) * 0.055, 0.01, Math.sin(a) * 0.075); }
    ball(g, 0.014, M(0xc9a24a, { m: 0.8, r: 0.3 }), 0, 0.012, -0.088); box(g, 0.006, 0.006, 0.04, M(0xc9a24a, { m: 0.8 }), 0, 0.01, -0.115);
  } else if (kind === 'keys') {
    const met = M(0xc8c8c0, { m: 0.9, r: 0.3 }), br = M(0xc9a24a, { m: 0.9, r: 0.3 });
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 16), met); r.rotation.x = Math.PI / 2; r.position.y = 0.004; g.add(r);
    box(g, 0.012, 0.004, 0.06, met, 0.012, 0.004, 0.045); box(g, 0.012, 0.004, 0.055, br, -0.014, 0.004, 0.042); box(g, 0.02, 0.004, 0.018, br, -0.014, 0.004, 0.02);
  } else if (kind === 'glasses') {
    const fr = M(0x111111, { r: 0.4 }), gl = new THREE.MeshStandardMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 });
    for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 6, 18), fr); t.position.set(s * 0.032, 0.026, 0); g.add(t); const l = new THREE.Mesh(new THREE.CircleGeometry(0.023, 16), gl); l.position.set(s * 0.032, 0.026, 0.001); g.add(l); box(g, 0.004, 0.004, 0.12, fr, s * 0.057, 0.03, -0.06); }
    box(g, 0.02, 0.004, 0.004, fr, 0, 0.034, 0);
  } else if (kind === 'honey') {
    // مرطبان عسل: زجاج كهرماني + غطا قماش مربوط
    const gl = new THREE.MeshStandardMaterial({ color: 0xd89020, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.05, emissive: 0x5a2c00, emissiveIntensity: 0.25 });
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 16), gl); j.position.y = 0.05; g.add(j);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.02, 16), M(0xc23a2a, { r: 0.9 })); lid.position.y = 0.108; g.add(lid);
    const st = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.003, 4, 18), M(0xe8d8a0)); st.rotation.x = Math.PI / 2; st.position.y = 0.098; g.add(st);
    box(g, 0.05, 0.035, 0.002, M(0xf4ead0), 0, 0.05, 0.047);
  } else if (kind === 'meds') {
    // علبة دوا كارتون + شريط حبوب فوگها
    box(g, 0.09, 0.03, 0.05, M(0xf2f2f2, { r: 0.7 }), 0, 0.015); box(g, 0.092, 0.012, 0.052, M(0x2a6ac8, { r: 0.6 }), 0, 0.024);
    box(g, 0.02, 0.002, 0.03, M(0xd02a2a), -0.03, 0.031, 0); box(g, 0.002, 0.002, 0.03, M(0xd02a2a), -0.03, 0.032, 0); box(g, 0.02, 0.002, 0.004, M(0xd02a2a), -0.03, 0.032, 0);
    const bl = M(0xcfd4da, { m: 0.7, r: 0.3 }); box(g, 0.06, 0.004, 0.03, bl, 0.012, 0.036, 0); for (let i = 0; i < 4; i++) ball(g, 0.005, M(0xffffff), -0.006 + i * 0.012, 0.039, 0, [1, 0.5, 1]);
  } else if (kind === 'ring') {
    const gold = M(0xe0b14a, { m: 1, r: 0.2 }); const r = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0025, 8, 20), gold); r.position.y = 0.011; g.add(r);
    ball(g, 0.004, M(0xdff4ff, { m: 0.2, r: 0.05, e: 0x88bbff, ei: 0.5 }), 0, 0.024, 0);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
