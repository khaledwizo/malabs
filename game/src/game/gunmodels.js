// نماذج الأسلحة: تُبنى من قطع (هيكل، سبطانة، مخزن، أخمص، مقبض، مناظير)
// المحاور: السبطانة نحو -z، الأعلى +y، الأصل عند قبضة اليد اليمنى
import * as THREE from 'three';
import * as TX from '../gfx/tex.js';
import { mergeChildren } from '../gfx/geo.js';

let M = null;
function mats() {
  if (M) return M;
  const met = TX.metal(256, { base: [46, 48, 52] }), poly = TX.metal(256, { base: [28, 29, 31], seed: 4 }), wd = TX.wood(256, { base: [128, 66, 34], planks: 0, seed: 22 });
  const tan = TX.metal(256, { base: [150, 128, 92], seed: 9 }), grn = TX.metal(256, { base: [72, 84, 60], seed: 11 }), chrome = TX.metal(256, { base: [170, 172, 176], seed: 13 });
  const S = (t, o) => new THREE.MeshStandardMaterial(Object.assign({ map: t.map, normalMap: t.normalMap, roughness: 0.5, metalness: 0.6 }, o || {}));
  M = {
    metal: S(met, { roughness: 0.42, metalness: 0.75 }), poly: S(poly, { roughness: 0.7, metalness: 0.15 }), wood: S(wd, { roughness: 0.55, metalness: 0 }),
    tan: S(tan, { roughness: 0.65, metalness: 0.1 }), green: S(grn, { roughness: 0.6, metalness: 0.15 }), chrome: S(chrome, { roughness: 0.22, metalness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc89b45, roughness: 0.3, metalness: 1 }), glass: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.05, metalness: 0.4, emissive: 0x0a1420, emissiveIntensity: 0.5 }),
    red: new THREE.MeshBasicMaterial({ color: 0xff2a2a }), blade: new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.18, metalness: 1 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xd8c6a0, roughness: 1 }), bottle: new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x4a5536, roughness: 0.7 }), grey: new THREE.MeshStandardMaterial({ color: 0x8a8f93, roughness: 0.5, metalness: 0.3 }),
  };
  return M;
}
const G = new Map();
function geo(key, fn) { if (!G.has(key)) G.set(key, fn()); return G.get(key); }
function B(g, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo('b' + w + ',' + h + ',' + d, () => new THREE.BoxGeometry(w, h, d)), m);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh;
}
function C(g, r1, r2, len, m, x, y, z, seg = 12, rx = Math.PI / 2) {
  const mesh = new THREE.Mesh(geo('c' + r1 + ',' + r2 + ',' + len + ',' + seg, () => new THREE.CylinderGeometry(r1, r2, len, seg)), m);
  mesh.position.set(x, y, z); mesh.rotation.x = rx; g.add(mesh); return mesh;
}
// مخزن مقوّس من عدة قطع
function curvedMag(g, m, x, y, z, w, d, len, curve) {
  const n = 5; for (let i = 0; i < n; i++) { const t = i / n; B(g, w, len / n + 0.004, d, m, x, y - t * len, z - curve * t * t * len, -curve * t * 1.3); }
}

// المناظير — تُركّب على السكة: تعيد ارتفاع خط النظر
export function addScope(g, kind, railY, railZ) {
  const m = mats();
  if (!kind || kind === 'iron') return null;
  const s = new THREE.Group(); s.position.set(0, railY, railZ); g.add(s);
  if (kind === 'dot') { B(s, 0.03, 0.012, 0.05, m.poly, 0, 0.006, 0); C(s, 0.019, 0.019, 0.045, m.poly, 0, 0.03, 0, 14); const lens = C(s, 0.016, 0.016, 0.003, m.glass, 0, 0.03, -0.02, 14); const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 6, 4), m.red); dot.position.set(0, 0.03, -0.024); s.add(dot); return { y: railY + 0.03, z: railZ, reticle: dot }; }
  if (kind === 'holo') { B(s, 0.04, 0.012, 0.07, m.poly, 0, 0.006, 0); B(s, 0.006, 0.04, 0.05, m.poly, -0.019, 0.032, -0.005); B(s, 0.006, 0.04, 0.05, m.poly, 0.019, 0.032, -0.005); B(s, 0.044, 0.006, 0.05, m.poly, 0, 0.054, -0.005); B(s, 0.032, 0.03, 0.002, m.glass, 0, 0.033, -0.025); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0007, 4, 16), m.red); ring.position.set(0, 0.033, -0.027); s.add(ring); return { y: railY + 0.033, z: railZ, reticle: ring }; }
  if (kind === 'x2') { B(s, 0.03, 0.012, 0.06, m.poly, 0, 0.006, 0); C(s, 0.021, 0.024, 0.09, m.poly, 0, 0.034, 0, 14); C(s, 0.019, 0.019, 0.002, m.glass, 0, 0.034, -0.046, 14); return { y: railY + 0.034, z: railZ }; }
  const len = kind === 'x4' ? 0.17 : kind === 'x8' ? 0.3 : 0.36, r = kind === 'x4' ? 0.022 : 0.024, bell = kind === 'x4' ? 0.026 : 0.034;
  B(s, 0.03, 0.02, 0.05, m.metal, 0, 0.01, -len * 0.25); B(s, 0.03, 0.02, 0.05, m.metal, 0, 0.01, len * 0.25);
  C(s, r, r, len * 0.6, m.poly, 0, 0.045, 0, 16); C(s, bell, r, len * 0.2, m.poly, 0, 0.045, -len * 0.4, 16); C(s, r * 1.15, r, len * 0.16, m.poly, 0, 0.045, len * 0.38, 16);
  C(s, 0.008, 0.008, 0.025, m.metal, 0, 0.07, 0, 8, 0); C(s, 0.008, 0.008, 0.025, m.metal, 0.028, 0.045, 0, 8, 0).rotation.z = Math.PI / 2;
  C(s, bell - 0.002, bell - 0.002, 0.002, m.glass, 0, 0.045, -len * 0.5, 16);
  return { y: railY + 0.045, z: railZ, big: true };
}

// يبني السلاح ويعيد نقاط اليدين وفوهته وخط النظر
export function buildGun(id, scope) {
  const m = mats(), g = new THREE.Group(); let P = { grip: [0, -0.02, 0.02], fore: [0, -0.02, -0.25], muzzle: [0, 0.03, -0.6], sightY: 0.07, railY: 0.06, railZ: -0.05, iron: true };
  switch (id) {
    case 'rafid': {
      B(g, 0.05, 0.075, 0.42, m.metal, 0, 0.03, -0.08); B(g, 0.046, 0.025, 0.36, m.metal, 0, 0.078, -0.06);
      B(g, 0.06, 0.065, 0.22, m.wood, 0, 0.03, -0.39); B(g, 0.05, 0.03, 0.2, m.wood, 0, 0.078, -0.38);
      C(g, 0.012, 0.012, 0.28, m.metal, 0, 0.045, -0.6); B(g, 0.012, 0.04, 0.012, m.metal, 0, 0.075, -0.68); C(g, 0.017, 0.017, 0.06, m.metal, 0, 0.045, -0.75);
      curvedMag(g, m.metal, 0, -0.015, -0.13, 0.03, 0.06, 0.24, 0.45);
      B(g, 0.035, 0.11, 0.045, m.wood, 0, -0.05, 0.05, -0.3); B(g, 0.04, 0.075, 0.28, m.wood, 0, 0.01, 0.26, 0.08); B(g, 0.042, 0.11, 0.06, m.wood, 0, -0.01, 0.39);
      B(g, 0.008, 0.026, 0.01, m.metal, -0.009, 0.098, 0.08); B(g, 0.008, 0.026, 0.01, m.metal, 0.009, 0.098, 0.08);
      P = { grip: [0, -0.04, 0.05], fore: [0, -0.005, -0.38], muzzle: [0, 0.045, -0.79], sightY: 0.097, railY: 0.09, railZ: -0.02, iron: true };
      break;
    }
    case 'saif556': case 'mirsad': {
      const long = id === 'mirsad';
      B(g, 0.05, 0.06, 0.3, m.poly, 0, 0.0, -0.05); B(g, 0.052, 0.055, 0.3, m.metal, 0, 0.055, -0.07); B(g, 0.03, 0.012, 0.3, m.metal, 0, 0.088, -0.07);
      for (let i = 0; i < 10; i++) B(g, 0.032, 0.006, 0.012, m.metal, 0, 0.097, -0.2 + i * 0.026);
      B(g, 0.062, 0.062, long ? 0.36 : 0.3, m.poly, 0, 0.05, long ? -0.4 : -0.36);
      C(g, 0.011, 0.011, long ? 0.3 : 0.2, m.metal, 0, 0.05, long ? -0.74 : -0.6); C(g, 0.016, 0.016, 0.07, m.metal, 0, 0.05, long ? -0.92 : -0.73);
      if (!long) { B(g, 0.014, 0.05, 0.014, m.metal, 0, 0.09, -0.5); }
      curvedMag(g, m.metal, 0, -0.01, -0.11, 0.028, 0.065, long ? 0.16 : 0.22, long ? 0.1 : 0.2);
      B(g, 0.034, 0.1, 0.04, m.poly, 0, -0.05, 0.05, -0.35);
      C(g, 0.016, 0.016, 0.22, m.metal, 0, 0.04, 0.2); B(g, 0.04, 0.09, 0.14, m.poly, 0, 0.025, 0.3, 0.05); B(g, 0.042, 0.12, 0.03, m.poly, 0, 0.015, 0.38);
      B(g, 0.02, 0.012, 0.03, m.metal, 0, 0.085, 0.1);
      P = { grip: [0, -0.045, 0.05], fore: [0, 0.015, -0.36], muzzle: [0, 0.05, long ? -0.96 : -0.77], sightY: 0.113, railY: 0.094, railZ: -0.05, iron: !long };
      if (!long) { B(g, 0.03, 0.012, 0.02, m.metal, 0, 0.1, 0.02); B(g, 0.008, 0.016, 0.01, m.metal, -0.01, 0.112, 0.02); B(g, 0.008, 0.016, 0.01, m.metal, 0.01, 0.112, 0.02); }
      break;
    }
    case 'battar': {
      B(g, 0.06, 0.1, 0.62, m.green, 0, 0.02, -0.06); B(g, 0.064, 0.05, 0.14, m.green, 0, 0.03, 0.22);
      B(g, 0.03, 0.09, 0.04, m.green, 0, -0.07, -0.25, 0.15); C(g, 0.012, 0.012, 0.3, m.metal, 0, 0.04, -0.5); C(g, 0.017, 0.017, 0.05, m.metal, 0, 0.04, -0.66);
      B(g, 0.028, 0.15, 0.06, m.poly, 0, -0.1, 0.12, 0.2); B(g, 0.034, 0.1, 0.04, m.green, 0, -0.06, 0.0, -0.2);
      B(g, 0.03, 0.035, 0.24, m.green, 0, 0.09, -0.08);
      P = { grip: [0, -0.06, 0.0], fore: [0, -0.1, -0.25], muzzle: [0, 0.04, -0.69], sightY: 0.15, railY: 0.105, railZ: -0.08, iron: false };
      break;
    }
    case 'zawba': {
      B(g, 0.05, 0.08, 0.32, m.poly, 0, 0.02, -0.08); B(g, 0.03, 0.012, 0.22, m.metal, 0, 0.066, -0.08);
      C(g, 0.022, 0.022, 0.18, m.poly, 0, 0.03, -0.33); C(g, 0.011, 0.011, 0.06, m.metal, 0, 0.03, -0.45);
      B(g, 0.026, 0.2, 0.05, m.metal, 0, -0.1, -0.12, 0.08); B(g, 0.034, 0.1, 0.04, m.poly, 0, -0.05, 0.04, -0.3); B(g, 0.03, 0.08, 0.035, m.poly, 0, -0.04, -0.24, 0.1);
      B(g, 0.012, 0.05, 0.2, m.metal, 0, 0.0, 0.17); B(g, 0.04, 0.09, 0.025, m.poly, 0, -0.01, 0.27);
      P = { grip: [0, -0.045, 0.04], fore: [0, -0.06, -0.24], muzzle: [0, 0.03, -0.48], sightY: 0.09, railY: 0.072, railZ: -0.08, iron: true };
      break;
    }
    case 'raad': {
      B(g, 0.05, 0.08, 0.26, m.metal, 0, 0.03, -0.04); C(g, 0.016, 0.016, 0.5, m.metal, 0, 0.055, -0.42); C(g, 0.014, 0.014, 0.42, m.metal, 0, 0.018, -0.38);
      B(g, 0.05, 0.05, 0.16, m.wood, 0, 0.015, -0.32); B(g, 0.035, 0.1, 0.045, m.wood, 0, -0.04, 0.08, -0.35); B(g, 0.045, 0.08, 0.3, m.wood, 0, 0.0, 0.28, 0.08); B(g, 0.048, 0.12, 0.04, m.poly, 0, -0.01, 0.43);
      B(g, 0.006, 0.012, 0.006, m.brass, 0, 0.078, -0.66);
      P = { grip: [0, -0.04, 0.07], fore: [0, -0.02, -0.32], muzzle: [0, 0.055, -0.68], sightY: 0.085, railY: 0.072, railZ: -0.04, iron: true };
      break;
    }
    case 'tufan': {
      B(g, 0.07, 0.1, 0.42, m.metal, 0, 0.03, -0.05); B(g, 0.075, 0.03, 0.3, m.metal, 0, 0.095, -0.05);
      C(g, 0.03, 0.03, 0.34, m.metal, 0, 0.04, -0.45, 10); C(g, 0.013, 0.013, 0.18, m.metal, 0, 0.04, -0.68); C(g, 0.02, 0.02, 0.05, m.metal, 0, 0.04, -0.79);
      B(g, 0.1, 0.12, 0.14, m.olive, 0, -0.07, -0.12); B(g, 0.03, 0.04, 0.2, m.metal, 0, 0.14, -0.14);
      B(g, 0.036, 0.11, 0.045, m.poly, 0, -0.05, 0.08, -0.3); B(g, 0.05, 0.1, 0.24, m.poly, 0, 0.02, 0.3); B(g, 0.012, 0.012, 0.18, m.metal, 0.02, -0.02, -0.55, 0.3); B(g, 0.012, 0.012, 0.18, m.metal, -0.02, -0.02, -0.55, 0.3);
      P = { grip: [0, -0.045, 0.08], fore: [0, -0.0, -0.4], muzzle: [0, 0.04, -0.82], sightY: 0.13, railY: 0.11, railZ: -0.05, iron: true };
      break;
    }
    case 'saqr': case 'uqab': {
      const big = id === 'saqr', mm = big ? m.green : m.grey;
      B(g, 0.055, 0.075, 0.36, m.metal, 0, 0.04, -0.05); C(g, big ? 0.017 : 0.013, big ? 0.015 : 0.012, big ? 0.62 : 0.52, m.metal, 0, 0.05, big ? -0.53 : -0.48); if (big) C(g, 0.022, 0.022, 0.07, m.metal, 0, 0.05, -0.87);
      B(g, 0.07, 0.07, big ? 0.42 : 0.36, mm, 0, 0.0, -0.32); B(g, 0.06, 0.12, 0.05, mm, 0, -0.05, 0.03, -0.25); B(g, 0.065, 0.1, 0.3, mm, 0, 0.0, 0.25, 0.05); B(g, 0.068, 0.16, 0.05, mm, 0, -0.02, 0.4);
      B(g, 0.04, 0.12, 0.05, m.poly, 0, -0.07, -0.08);
      const bolt = C(g, 0.006, 0.006, 0.06, m.metal, 0.04, 0.06, 0.06, 8, 0); bolt.rotation.z = Math.PI / 2; const knob = new THREE.Mesh(geo('knob', () => new THREE.SphereGeometry(0.011, 8, 6)), m.metal); knob.position.set(0.07, 0.06, 0.06); g.add(knob);
      P = { grip: [0, -0.06, 0.05], fore: [0, -0.04, -0.34], muzzle: [0, 0.05, big ? -0.91 : -0.75], sightY: 0.1, railY: 0.08, railZ: -0.06, iron: false };
      break;
    }
    case 'dijla': case 'zaeem': case 'nisr': {
      const big = id === 'nisr', mm = big ? m.chrome : m.poly;
      B(g, big ? 0.034 : 0.03, 0.035, big ? 0.24 : 0.19, mm, 0, 0.045, -0.06); B(g, 0.028, 0.025, big ? 0.2 : 0.17, m.poly, 0, 0.018, -0.05);
      C(g, 0.009, 0.009, 0.02, m.metal, 0, 0.045, big ? -0.185 : -0.16);
      B(g, 0.028, 0.11, 0.045, m.poly, 0, -0.04, 0.02, -0.25);
      if (id === 'zaeem') B(g, 0.022, 0.08, 0.035, m.metal, 0, -0.12, 0.04, -0.25);
      B(g, 0.004, 0.008, 0.006, m.metal, 0, 0.066, big ? -0.17 : -0.14); B(g, 0.016, 0.008, 0.006, m.metal, 0, 0.066, 0.025);
      P = { grip: [0, -0.04, 0.03], fore: [0, -0.06, 0.04], muzzle: [0, 0.045, big ? -0.2 : -0.175], sightY: 0.068, railY: 0.064, railZ: -0.06, iron: true, pistol: true };
      break;
    }
    case 'khanjar': {
      // خنجر عربي مقوّس بمقبض نحاسي
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.012, -0.12, -0.04, -0.22); sh.quadraticCurveTo(-0.01, -0.13, -0.018, 0); sh.closePath();
      const bl = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), m.blade);
      bl.rotation.set(Math.PI / 2, 0, Math.PI); bl.position.set(0.0, 0.02, -0.03); bl.rotation.x = -Math.PI / 2; g.add(bl);
      B(g, 0.06, 0.012, 0.02, m.brass, 0, 0.02, -0.02); C(g, 0.014, 0.016, 0.1, m.brass, 0, 0.02, 0.04, 10);
      const pom = new THREE.Mesh(geo('pom', () => new THREE.SphereGeometry(0.02, 10, 8)), m.brass); pom.position.set(0, 0.02, 0.1); g.add(pom);
      P = { grip: [0, 0.0, 0.04], fore: [0, 0, 0.04], muzzle: [0, 0.02, -0.2], sightY: 0.05, railY: 0, railZ: 0, iron: true, knife: true };
      break;
    }
    case 'frag': { const s = new THREE.Mesh(geo('frag', () => new THREE.SphereGeometry(0.035, 12, 10)), m.olive); s.scale.y = 1.2; g.add(s); C(g, 0.012, 0.012, 0.02, m.metal, 0, 0.045, 0, 8, 0); B(g, 0.01, 0.06, 0.012, m.metal, 0.02, 0.02, 0, 0, 0, -0.3); P = { grip: [0, 0, 0], fore: [0, 0, 0], muzzle: [0, 0, 0], sightY: 0.04, nade: true }; break; }
    case 'smoke': { C(g, 0.03, 0.03, 0.11, m.grey, 0, 0, 0, 12, 0); C(g, 0.031, 0.031, 0.02, m.metal, 0, 0.05, 0, 12, 0); P = { grip: [0, 0, 0], fore: [0, 0, 0], muzzle: [0, 0, 0], sightY: 0.04, nade: true }; break; }
    case 'flash': { C(g, 0.028, 0.028, 0.1, m.metal, 0, 0, 0, 12, 0); for (let k = 0; k < 6; k++) B(g, 0.004, 0.02, 0.004, m.poly, Math.cos(k) * 0.028, 0, Math.sin(k) * 0.028); P = { grip: [0, 0, 0], fore: [0, 0, 0], muzzle: [0, 0, 0], sightY: 0.04, nade: true }; break; }
    case 'molotov': { C(g, 0.035, 0.038, 0.13, m.bottle, 0, 0, 0, 12, 0); C(g, 0.012, 0.03, 0.06, m.bottle, 0, 0.09, 0, 10, 0); C(g, 0.01, 0.01, 0.06, m.cloth, 0, 0.14, 0, 6, 0); P = { grip: [0, 0, 0], fore: [0, 0, 0], muzzle: [0, 0, 0], sightY: 0.04, nade: true }; break; }
  }
  const sc = scope ? addScope(g, scope, P.railY, P.railZ) : null;
  if (sc) P.sightY = sc.y, P.scope = sc;
  // بوتقة للومضة عند الفوهة
  const mz = new THREE.Object3D(); mz.position.set(...P.muzzle); g.add(mz); P.muzzleObj = mz;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  mergeChildren(g);
  return { group: g, P };
}
