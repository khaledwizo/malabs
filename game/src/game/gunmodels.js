// نماذج الأسلحة: مقاطع جانبية مبثوقة بحواف مشطوفة (هياكل، أخامص، مقابض، مخازن) + أنابيب وسكك ومناظير وملحقات
// المحاور: السبطانة نحو -z، الأعلى +y، الأصل عند أعلى مقبض اليد اليمنى. الوحدة: متر
import * as THREE from 'three';
import * as TX from '../gfx/tex.js';
import { mergeChildren } from '../gfx/geo.js';
import { WEAPONS } from '../sim/weapons.js';

let M = null;
function mats() {
  if (M) return M;
  const wd = TX.wood(256, { base: [118, 62, 32], planks: 0, seed: 22 }); wd.map.wrapS = wd.map.wrapT = THREE.RepeatWrapping; wd.map.repeat.set(5, 5);
  const wd2 = TX.wood(256, { base: [84, 44, 24], planks: 0, seed: 7 }); wd2.map.wrapS = wd2.map.wrapT = THREE.RepeatWrapping; wd2.map.repeat.set(5, 5);
  const S = o => new THREE.MeshStandardMaterial(o);
  M = {
    metal: S({ color: 0x2c2e33, roughness: 0.36, metalness: 0.85 }),
    blued: S({ color: 0x1d2026, roughness: 0.28, metalness: 0.9 }),
    steel: S({ color: 0x8b9097, roughness: 0.3, metalness: 0.95 }),
    poly: S({ color: 0x1b1c1e, roughness: 0.72, metalness: 0.06 }),
    poly2: S({ color: 0x2a2b2e, roughness: 0.6, metalness: 0.1 }),
    tan: S({ color: 0xa38a62, roughness: 0.7, metalness: 0.08 }),
    olive: S({ color: 0x4d5a3a, roughness: 0.66, metalness: 0.1 }),
    wood: S({ map: wd.map, normalMap: wd.normalMap, roughness: 0.5, metalness: 0 }),
    woodDark: S({ map: wd2.map, normalMap: wd2.normalMap, roughness: 0.42, metalness: 0 }),
    chrome: S({ color: 0xd3d7dc, roughness: 0.14, metalness: 1 }),
    brass: S({ color: 0xc99a42, roughness: 0.28, metalness: 1 }),
    rubber: S({ color: 0x121212, roughness: 0.92, metalness: 0 }),
    glass: S({ color: 0x5a8cb0, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.18, depthWrite: false }),
    lensGlow: new THREE.MeshBasicMaterial({ color: 0x3a6a8a, transparent: true, opacity: 0.25 }),
    red: new THREE.MeshBasicMaterial({ color: 0xff2a2a }), green: new THREE.MeshBasicMaterial({ color: 0x7dff6a }),
    blade: S({ color: 0xd8dde2, roughness: 0.12, metalness: 1 }),
    gold: S({ color: 0xd8ad55, roughness: 0.22, metalness: 1 }),
    cloth: S({ color: 0xd8c6a0, roughness: 1 }), bottle: S({ color: 0x3f6b3a, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82 }),
    nade: S({ color: 0x4a5536, roughness: 0.7 }), grey: S({ color: 0x8a8f93, roughness: 0.5, metalness: 0.3 }),
  };
  M.polyDS = M.poly.clone(); M.polyDS.side = THREE.DoubleSide; M.bluedDS = M.blued.clone(); M.bluedDS.side = THREE.DoubleSide;
  return M;
}
const GC = new Map();
const cache = (k, f) => { let g = GC.get(k); if (!g) { g = f(); GC.set(k, g); } return g; };
// مقطع جانبي (z,y) مبثوق بسماكة th على محور x
function prof(g, m, key, pts, th, x = 0, bev = 0.0022, holes) {
  const geo = cache('p:' + key, () => {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
    if (holes) for (const h of holes) { const p = new THREE.Path(); p.moveTo(h[0][0], h[0][1]); for (let i = 1; i < h.length; i++) p.lineTo(h[i][0], h[i][1]); p.closePath(); s.holes.push(p); }
    const e = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, th - bev * 2), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 6 });
    e.translate(0, 0, -(th - bev * 2) / 2); e.rotateY(-Math.PI / 2); return e;
  });
  const mesh = new THREE.Mesh(geo, m); mesh.position.x = x; g.add(mesh); return mesh;
}
// أنبوب على محور z: من zBack نحو الأمام بطول len
function tube(g, m, rB, rF, len, zBack, y, x = 0, seg = 16) {
  const geo = cache(`t${rB},${rF},${len},${seg}`, () => { const c = new THREE.CylinderGeometry(rB, rF, len, seg); c.rotateX(Math.PI / 2); return c; });
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, zBack - len / 2); g.add(mesh); return mesh;
}
// أنبوب مفتوح الطرفين (لنرى من خلاله)
function otube(g, m, rB, rF, len, zBack, y, x = 0, seg = 20) {
  const geo = cache(`o${rB},${rF},${len},${seg}`, () => { const c = new THREE.CylinderGeometry(rB, rF, len, seg, 1, true); c.rotateX(Math.PI / 2); return c; });
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, zBack - len / 2); g.add(mesh); return mesh;
}
function box(g, m, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const geo = cache(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh;
}
function cyl(g, m, r, h, x, y, z, rx = 0, rz = 0, seg = 12) {
  const geo = cache(`c${r},${h},${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg));
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, 0, rz); g.add(mesh); return mesh;
}
// سكة بيكاتيني بأسنان
function rail(g, m, zB, zF, y, x = 0, w = 0.021) {
  const L = zB - zF; box(g, m, w, 0.005, L, x, y + 0.0025, zB - L / 2);
  for (let z = zB - 0.004; z > zF + 0.003; z -= 0.01) box(g, m, w + 0.002, 0.0035, 0.005, x, y + 0.0062, z);
}

// ---------- المناظير: تُركّب على السكة وتعيد ارتفاع خط النظر ----------
export function addScope(g, kind, railY, railZ) {
  const m = mats();
  if (!kind || kind === 'iron') return null;
  const s = new THREE.Group(); s.position.set(0, railY, railZ); g.add(s);
  const mount = (zA, zB, h) => { for (const z of [zA, zB]) { box(s, m.metal, 0.028, h, 0.018, 0, h / 2, z); box(s, m.metal, 0.034, 0.006, 0.02, 0, 0.003, z); } };
  if (kind === 'dot') {
    box(s, m.metal, 0.03, 0.01, 0.05, 0, 0.005, 0);
    otube(s, m.polyDS, 0.017, 0.017, 0.045, 0.022, 0.032);
    otube(s, m.polyDS, 0.0195, 0.0195, 0.006, 0.026, 0.032); otube(s, m.polyDS, 0.0195, 0.0195, 0.006, -0.017, 0.032);
    box(s, m.metal, 0.012, 0.01, 0.012, 0.02, 0.032, 0.002); box(s, m.metal, 0.01, 0.012, 0.012, 0, 0.053, 0.002);
    box(s, m.metal, 0.012, 0.012, 0.012, 0, 0.014, 0.0);
    tube(s, m.glass, 0.0165, 0.0165, 0.002, -0.018, 0.032, 0, 18);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 8, 6), m.red); dot.position.set(0, 0.032, -0.02); dot.userData.keep = true; s.add(dot);
    return { y: railY + 0.032, z: railZ, reticle: dot, adsZ: -0.2, len: 0.045 };
  }
  if (kind === 'holo') {
    box(s, m.poly, 0.036, 0.016, 0.075, 0, 0.008, 0.005);
    box(s, m.poly, 0.005, 0.044, 0.05, -0.0195, 0.036, -0.008); box(s, m.poly, 0.005, 0.044, 0.05, 0.0195, 0.036, -0.008);
    box(s, m.poly, 0.044, 0.006, 0.05, 0, 0.06, -0.008);
    box(s, m.glass, 0.034, 0.038, 0.002, 0, 0.036, -0.028);
    box(s, m.poly, 0.012, 0.008, 0.02, 0.02, 0.012, 0.024);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0006, 4, 20), m.red); ring.position.set(0, 0.036, -0.03); ring.userData.keep = true; s.add(ring);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0007, 6, 4), m.red); dot.position.set(0, 0.036, -0.03); dot.userData.keep = true; s.add(dot);
    return { y: railY + 0.036, z: railZ, reticle: ring, adsZ: -0.21, len: 0.06 };
  }
  // مناظير أنبوبية: ×2 قصير، ×3، ×4 (بألياف)، ×6، ×8 طويل بأبراج
  const D = { x2: [0.1, 0.017, 0.02, 0.019], x3: [0.13, 0.018, 0.022, 0.023], x4: [0.15, 0.019, 0.023, 0.024], x6: [0.22, 0.019, 0.025, 0.027], x8: [0.3, 0.02, 0.028, 0.031] }[kind] || [0.15, 0.019, 0.023, 0.024];
  const [len, r, eye, obj] = D, h = kind === 'x2' ? 0.026 : 0.036;
  mount(len * 0.22, -len * 0.22, h - 0.012);
  if (kind === 'x4') { // جسم مضلّع بأسلوب «آكوغ»
    prof(s, m.poly2, 'acog', [[0.07, h - 0.02], [0.07, h + 0.02], [0.05, h + 0.026], [-0.06, h + 0.026], [-0.08, h + 0.02], [-0.08, h - 0.02], [-0.06, h - 0.026], [0.05, h - 0.026]], 0.044, 0, 0.004);
    box(s, m.green, 0.006, 0.004, 0.08, 0, h + 0.03, -0.005);
    tube(s, m.glass, 0.019, 0.019, 0.002, -0.081, h, 0, 18); tube(s, m.glass, 0.017, 0.017, 0.002, 0.072, h, 0, 18);
    return { y: railY + h, z: railZ, big: true, adsZ: -0.13, len };
  }
  otube(s, m.bluedDS, r, r, len * 0.56, len * 0.28, h);
  otube(s, m.bluedDS, eye, r, len * 0.22, len * 0.5, h);       // عدسة العين
  otube(s, m.bluedDS, r, obj, len * 0.24, -len * 0.26, h);     // جرس العدسة الأمامية
  otube(s, m.polyDS, eye + 0.0015, eye + 0.0015, 0.012, len * 0.5, h);
  tube(s, m.glass, obj - 0.002, obj - 0.002, 0.002, -len * 0.5 + 0.002, h, 0, 18);
  tube(s, m.glass, eye - 0.003, eye - 0.003, 0.002, len * 0.5 - 0.001, h, 0, 18);
  if (kind !== 'x2') { cyl(s, m.blued, 0.009, 0.022, 0, h + r + 0.008, 0); cyl(s, m.blued, 0.009, 0.022, r + 0.008, h, 0, 0, Math.PI / 2); if (kind === 'x8') cyl(s, m.blued, 0.011, 0.016, -r - 0.006, h, len * 0.12, 0, Math.PI / 2); }
  else { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 8, 6), m.red); dot.position.set(0, h, -len * 0.3); dot.userData.keep = true; s.add(dot); }
  return { y: railY + h, z: railZ, big: kind !== 'x2', adsZ: kind === 'x2' ? -0.16 : -0.12 - len * 0.2, len };
}

// ---------- الملحقات ----------
function muzzleDev(g, m, kind, z, y, r, def) {
  kind = kind || def || 'none';
  if (kind === 'comp') { tube(g, m.metal, r + 0.004, r + 0.005, 0.05, z, y); for (let k = 0; k < 3; k++) box(g, m.poly, 0.004, 0.006, 0.008, 0, y + r + 0.004, z - 0.012 - k * 0.012); return z - 0.05; }
  if (kind === 'flash') { tube(g, m.metal, r + 0.003, r + 0.003, 0.012, z, y); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; box(g, m.metal, 0.004, 0.004, 0.035, Math.cos(a) * (r + 0.002), y + Math.sin(a) * (r + 0.002), z - 0.028); } return z - 0.046; }
  if (kind === 'supp') { tube(g, m.poly2, r + 0.009, r + 0.009, 0.16, z, y, 0, 18); tube(g, m.metal, r + 0.01, r + 0.01, 0.01, z, y, 0, 18); tube(g, m.metal, r + 0.009, r + 0.006, 0.01, z - 0.155, y, 0, 18); return z - 0.165; }
  if (kind === 'brake') { tube(g, m.metal, r + 0.008, r + 0.008, 0.06, z, y); for (let k = 0; k < 3; k++) { box(g, m.poly, 0.05, 0.008, 0.007, 0, y, z - 0.012 - k * 0.016); } return z - 0.06; }
  if (kind === 'bird') { tube(g, m.metal, r + 0.003, r + 0.003, 0.045, z, y); for (let k = 0; k < 3; k++) box(g, m.poly, 0.003, 0.01, 0.025, Math.cos(k * 2.1) * (r + 0.003), y + Math.sin(k * 2.1) * (r + 0.003), z - 0.02); return z - 0.045; }
  if (kind === 'slant') { tube(g, m.metal, r + 0.004, r + 0.004, 0.04, z, y); return z - 0.04; }
  return z;
}
function gripAtt(g, m, kind, z, y) {
  if (kind === 'vert') { prof(g, m.poly, 'gVert', [[0.012, 0], [-0.012, 0], [-0.016, -0.075], [0.012, -0.078]], 0.026, 0).position.set(0, y, z); return [0, y - 0.04, z]; }
  if (kind === 'angled') { prof(g, m.poly, 'gAng', [[0.03, 0], [-0.03, 0], [-0.035, -0.012], [0.01, -0.04], [0.03, -0.036]], 0.026, 0).position.set(0, y, z); return [0, y - 0.025, z - 0.01]; }
  if (kind === 'half') { prof(g, m.poly, 'gHalf', [[0.03, 0], [-0.025, 0], [-0.03, -0.028], [0.012, -0.03]], 0.026, 0).position.set(0, y, z); return [0, y - 0.02, z]; }
  return null;
}
// مخزن من مقطع، يطول مع المخزن الموسّع (تمدد عمودي حول أعلاه)
function mag(g, m, key, pts, th, ext) {
  const ymax = Math.max(...pts.map(p => p[1])), top = pts.filter(p => p[1] >= ymax - 1e-6), zc = top.reduce((a, p) => a + p[0], 0) / top.length;
  const mesh = prof(g, m, key + 'r', pts.map(p => [p[0] - zc, p[1] - ymax]), th);
  mesh.position.set(0, ymax, zc); if (ext) mesh.scale.set(1, 1.36, 1);
  return mesh;
}
// ---------- الأسلحة ----------
export function buildGun(id, scope, att) {
  const m = mats(), g = new THREE.Group(), A = att || {};
  const model = (WEAPONS[id] && WEAPONS[id].model) || id;
  let P = { grip: [0, -0.045, 0.02], fore: [0, 0.01, -0.3], muzzle: [0, 0.045, -0.62], sightY: 0.1, railY: 0.08, railZ: -0.05, iron: [], adsZ: -0.24 };
  const ext = A.mag === 'ext';
  const irons = (rearZ, frontZ, y, base) => { // تصويب حديدي: حلقة خلفية وعمود أمامي على خط النظر y
    const r = new THREE.Group(), f = new THREE.Group(); g.add(r, f);
    box(r, m.poly, 0.022, 0.012, 0.016, 0, base + 0.006, rearZ);
    box(r, m.poly, 0.005, y - base + 0.004, 0.01, -0.0125, base + (y - base) / 2 + 0.004, rearZ); box(r, m.poly, 0.005, y - base + 0.004, 0.01, 0.0125, base + (y - base) / 2 + 0.004, rearZ);
    const ring = new THREE.Mesh(cache('ironRing', () => new THREE.TorusGeometry(0.0095, 0.0032, 6, 18)), m.poly); ring.position.set(0, y, rearZ); r.add(ring);
    box(f, m.poly, 0.018, 0.01, 0.014, 0, base + 0.005, frontZ);
    box(f, m.poly, 0.004, y - base + 0.006, 0.006, -0.009, base + (y - base) / 2 + 0.005, frontZ); box(f, m.poly, 0.004, y - base + 0.006, 0.006, 0.009, base + (y - base) / 2 + 0.005, frontZ);
    box(f, m.metal, 0.0024, y - base - 0.002, 0.003, 0, base + (y - base) / 2 - 0.001, frontZ);
    P.iron = [r, f]; P.rearZ = rearZ;
  };
  switch (model) {
    case 'm4': { // سيف-556
      prof(g, m.poly, 'm4Low', [[0.075, 0.022], [0.075, -0.004], [0.03, -0.012], [-0.012, -0.012], [-0.012, -0.03], [-0.058, -0.03], [-0.062, -0.012], [-0.066, -0.058], [-0.122, -0.058], [-0.126, -0.012], [-0.156, -0.006], [-0.156, 0.022]], 0.028);
      prof(g, m.metal, 'm4Up', [[0.078, 0.02], [0.078, 0.07], [-0.158, 0.07], [-0.158, 0.02]], 0.027);
      box(g, m.blued, 0.003, 0.016, 0.05, 0.0145, 0.04, -0.045); cyl(g, m.metal, 0.007, 0.012, 0.016, 0.05, 0.03, 0, Math.PI / 2);
      box(g, m.metal, 0.03, 0.01, 0.012, 0, 0.066, 0.08); rail(g, m.metal, 0.076, -0.156, 0.07);
      prof(g, m.poly, 'm4Grip', [[0.022, -0.004], [-0.012, -0.004], [0.006, -0.098], [0.042, -0.106], [0.046, -0.09]], 0.026);
      box(g, m.metal, 0.004, 0.018, 0.004, 0, -0.022, -0.03, 0.3); prof(g, m.poly, 'm4Guard', [[0.0, -0.012], [-0.06, -0.012], [-0.06, -0.034], [0.0, -0.034]], 0.014, 0, 0.001, [[[-0.004, -0.016], [-0.056, -0.016], [-0.056, -0.03], [-0.004, -0.03]]]);
      mag(g, m.poly2, 'm4Mag', [[-0.067, -0.05], [-0.121, -0.05], [-0.137, -0.205], [-0.083, -0.21]], 0.024, ext);
      // واقي اليد بسكك
      tube(g, m.poly2, 0.031, 0.031, 0.28, -0.158, 0.045, 0, 8).rotation.z = Math.PI / 8;
      rail(g, m.metal, -0.158, -0.44, 0.074); rail(g, m.metal, -0.2, -0.43, 0.012, 0, 0.018);
      for (let k = 0; k < 6; k++) box(g, m.blued, 0.064, 0.008, 0.018, 0, 0.045, -0.2 - k * 0.042);
      tube(g, m.blued, 0.0085, 0.0085, 0.17, -0.438, 0.045); box(g, m.metal, 0.022, 0.026, 0.02, 0, 0.042, -0.452);
      tube(g, m.metal, 0.014, 0.014, 0.19, 0.268, 0.035); prof(g, m.poly, 'm4Stock', [[0.14, 0.058], [0.29, 0.058], [0.302, 0.05], [0.302, -0.046], [0.274, -0.05], [0.2, -0.004], [0.14, 0.014]], 0.034);
      prof(g, m.rubber, 'm4Pad', [[0.302, 0.054], [0.312, 0.054], [0.312, -0.05], [0.302, -0.05]], 0.036);
      const mz = muzzleDev(g, m, A.muzzle, -0.606, 0.045, 0.0085, 'bird');
      P = { ...P, muzzle: [0, 0.045, mz - 0.005], fore: [0, 0.008, -0.33], sightY: 0.104, railY: 0.074, railZ: -0.05 };
      if (!scope || scope === 'iron') irons(0.058, -0.425, 0.104, 0.074);
      const gp = gripAtt(g, m, A.grip, -0.3, 0.012); if (gp) P.fore = gp;
      break;
    }
    case 'ak': { // رافد-47
      prof(g, m.metal, 'akRec', [[0.07, 0.058], [0.07, -0.004], [0.04, -0.01], [-0.012, -0.01], [-0.06, -0.01], [-0.066, -0.006], [-0.21, -0.006], [-0.22, 0.03], [-0.21, 0.058]], 0.03);
      tube(g, m.metal, 0.016, 0.016, 0.27, 0.07, 0.052, 0, 14).scale.x = 0.95; // غطاء الغبار
      for (let k = 0; k < 6; k++) box(g, m.blued, 0.032, 0.003, 0.006, 0, 0.067, 0.05 - k * 0.012);
      box(g, m.metal, 0.012, 0.012, 0.03, 0.016, 0.034, -0.05); box(g, m.steel, 0.016, 0.006, 0.012, 0.024, 0.036, -0.1);
      prof(g, m.woodDark, 'akGrip', [[0.025, -0.006], [-0.012, -0.006], [0.004, -0.1], [0.04, -0.108], [0.046, -0.092]], 0.026);
      prof(g, m.metal, 'akGuard', [[0.002, -0.01], [-0.07, -0.01], [-0.075, -0.034], [0.0, -0.034]], 0.012, 0, 0.001, [[[-0.004, -0.014], [-0.068, -0.014], [-0.07, -0.03], [-0.004, -0.03]]]);
      mag(g, m.poly2, 'akMag', [[-0.072, -0.004], [-0.118, -0.004], [-0.148, -0.09], [-0.205, -0.19], [-0.16, -0.205], [-0.11, -0.1]], 0.028, ext);
      for (let k = 0; k < 3; k++) box(g, m.poly, 0.03, 0.004, 0.01, 0, -0.05 - k * 0.04, -0.1 - k * 0.022, 0.4 + k * 0.1);
      prof(g, m.wood, 'akHG', [[-0.22, 0.012], [-0.22, 0.05], [-0.39, 0.048], [-0.4, 0.02], [-0.39, 0.012]], 0.04, 0, 0.004);
      tube(g, m.wood, 0.014, 0.014, 0.17, -0.225, 0.068, 0, 12); tube(g, m.metal, 0.009, 0.009, 0.03, -0.39, 0.068);
      tube(g, m.blued, 0.0082, 0.0082, 0.19, -0.39, 0.04); box(g, m.metal, 0.022, 0.03, 0.03, 0, 0.055, -0.41);
      box(g, m.metal, 0.018, 0.032, 0.02, 0, 0.056, -0.53); box(g, m.metal, 0.0025, 0.028, 0.003, 0, 0.082, -0.535);
      box(g, m.metal, 0.024, 0.018, 0.05, 0, 0.068, -0.205); box(g, m.metal, 0.009, 0.01, 0.006, -0.0075, 0.082, -0.205); box(g, m.metal, 0.009, 0.01, 0.006, 0.0075, 0.082, -0.205);
      prof(g, m.wood, 'akStock', [[0.065, 0.05], [0.31, 0.024], [0.316, 0.016], [0.316, -0.074], [0.28, -0.07], [0.065, -0.002]], 0.036, 0, 0.004);
      prof(g, m.metal, 'akPlate', [[0.316, 0.026], [0.322, 0.026], [0.322, -0.076], [0.316, -0.076]], 0.04);
      const mz = muzzleDev(g, m, A.muzzle, -0.58, 0.04, 0.0082, 'slant');
      P = { ...P, muzzle: [0, 0.04, mz - 0.005], fore: [0, 0.012, -0.31], sightY: 0.083, railY: 0.07, railZ: -0.02 };
      if (scope && scope !== 'iron') { rail(g, m.metal, 0.04, -0.1, 0.066, 0, 0.022); box(g, m.metal, 0.026, 0.02, 0.06, 0.018, 0.05, -0.03); P.railY = 0.071; }
      const gp = gripAtt(g, m, A.grip, -0.3, 0.012); if (gp) P.fore = gp;
      break;
    }
    case 'scar': { // بتّار
      prof(g, m.tan, 'scUp', [[0.08, 0.022], [0.08, 0.082], [-0.4, 0.082], [-0.41, 0.066], [-0.4, 0.024], [-0.16, 0.022]], 0.036, 0, 0.003);
      rail(g, m.metal, 0.078, -0.4, 0.082, 0, 0.022); box(g, m.metal, 0.004, 0.016, 0.2, 0.02, 0.05, -0.28);
      prof(g, m.poly, 'scLow', [[0.07, 0.024], [0.07, -0.006], [0.03, -0.012], [-0.012, -0.012], [-0.012, -0.03], [-0.058, -0.03], [-0.062, -0.012], [-0.066, -0.056], [-0.124, -0.056], [-0.128, -0.012], [-0.15, 0.0], [-0.15, 0.024]], 0.03);
      prof(g, m.poly, 'scGrip', [[0.022, -0.004], [-0.012, -0.004], [0.006, -0.1], [0.044, -0.108], [0.046, -0.09]], 0.027);
      mag(g, m.poly2, 'scMag', [[-0.068, -0.05], [-0.122, -0.05], [-0.132, -0.2], [-0.078, -0.203]], 0.026, ext);
      box(g, m.metal, 0.014, 0.014, 0.03, -0.022, 0.06, -0.02);
      tube(g, m.blued, 0.009, 0.009, 0.14, -0.405, 0.048);
      prof(g, m.tan, 'scStock', [[0.08, 0.07], [0.27, 0.066], [0.29, 0.058], [0.29, -0.05], [0.26, -0.052], [0.2, -0.012], [0.12, 0.0], [0.08, 0.02]], 0.036, 0, 0.003, [[[0.13, 0.05], [0.24, 0.048], [0.22, 0.012], [0.14, 0.018]]]);
      prof(g, m.rubber, 'scPad', [[0.29, 0.06], [0.3, 0.06], [0.3, -0.052], [0.29, -0.052]], 0.038);
      const mz = muzzleDev(g, m, A.muzzle, -0.545, 0.048, 0.009, 'flash');
      P = { ...P, muzzle: [0, 0.048, mz - 0.005], fore: [0, 0.018, -0.3], sightY: 0.112, railY: 0.086, railZ: -0.06 };
      if (!scope || scope === 'iron') irons(0.06, -0.38, 0.112, 0.086);
      const gp = gripAtt(g, m, A.grip, -0.3, 0.022); if (gp) P.fore = gp;
      break;
    }
    case 'bullpup': { // شهاب: المخزن خلف المقبض
      prof(g, m.poly, 'bpBody', [[0.27, 0.06], [0.27, -0.05], [0.2, -0.06], [0.1, -0.02], [0.06, -0.012], [-0.012, -0.012], [-0.04, -0.01], [-0.2, -0.005], [-0.22, 0.02], [-0.22, 0.06]], 0.036, 0, 0.003);
      prof(g, m.olive, 'bpTop', [[0.25, 0.06], [0.25, 0.075], [-0.2, 0.075], [-0.21, 0.06]], 0.032);
      rail(g, m.metal, 0.12, -0.12, 0.075);
      prof(g, m.poly, 'bpGrip', [[0.022, -0.008], [-0.012, -0.008], [0.004, -0.1], [0.04, -0.108], [0.046, -0.09]], 0.027);
      prof(g, m.poly, 'bpGuard', [[0.03, -0.012], [-0.05, -0.012], [-0.05, -0.034], [0.03, -0.034]], 0.012, 0, 0.001, [[[0.026, -0.016], [-0.046, -0.016], [-0.046, -0.03], [0.026, -0.03]]]);
      mag(g, m.poly2, 'bpMag', [[0.13, -0.02], [0.085, -0.02], [0.09, -0.12], [0.11, -0.19], [0.15, -0.18], [0.14, -0.1]], 0.026, ext);
      tube(g, m.blued, 0.011, 0.011, 0.14, -0.21, 0.035); tube(g, m.metal, 0.018, 0.018, 0.04, -0.2, 0.035);
      prof(g, m.rubber, 'bpPad', [[0.27, 0.062], [0.28, 0.062], [0.28, -0.05], [0.27, -0.05]], 0.038);
      const mz = muzzleDev(g, m, A.muzzle, -0.35, 0.035, 0.011, 'comp');
      P = { ...P, muzzle: [0, 0.035, mz - 0.005], fore: [0, 0.0, -0.13], sightY: 0.1, railY: 0.078, railZ: 0.0 };
      if (!scope || scope === 'iron') irons(0.1, -0.11, 0.1, 0.078);
      break;
    }
    case 'vector': { // زوبعة
      prof(g, m.poly, 'vcBody', [[0.07, 0.07], [0.07, -0.012], [-0.012, -0.012], [-0.03, -0.012], [-0.05, -0.06], [-0.1, -0.08], [-0.17, -0.08], [-0.2, -0.04], [-0.22, 0.0], [-0.24, 0.03], [-0.24, 0.07]], 0.04, 0, 0.003);
      prof(g, m.poly2, 'vcFace', [[-0.12, -0.07], [-0.12, 0.0], [-0.2, 0.0], [-0.2, -0.04], [-0.17, -0.07]], 0.042);
      rail(g, m.metal, 0.068, -0.235, 0.07, 0, 0.022);
      prof(g, m.poly, 'vcGrip', [[0.022, -0.008], [-0.012, -0.008], [0.006, -0.1], [0.044, -0.106], [0.046, -0.088]], 0.026);
      mag(g, m.poly2, 'vcMag', [[-0.034, -0.03], [-0.07, -0.05], [-0.07, -0.2], [-0.03, -0.2]], 0.022, ext);
      tube(g, m.blued, 0.009, 0.009, 0.1, -0.235, 0.04); tube(g, m.poly, 0.016, 0.016, 0.06, -0.23, 0.04, 0, 6);
      prof(g, m.poly, 'vcStock', [[0.07, 0.06], [0.25, 0.055], [0.26, 0.045], [0.26, -0.05], [0.24, -0.05], [0.18, 0.02], [0.07, 0.03]], 0.02, 0, 0.002, [[[0.11, 0.045], [0.2, 0.042], [0.2, 0.03], [0.11, 0.032]]]);
      const mz = muzzleDev(g, m, A.muzzle, -0.335, 0.04, 0.009, 'none');
      P = { ...P, muzzle: [0, 0.04, mz - 0.005], fore: [0, -0.02, -0.15], sightY: 0.098, railY: 0.074, railZ: -0.06 };
      if (!scope || scope === 'iron') irons(0.055, -0.22, 0.098, 0.074);
      const gp = gripAtt(g, m, A.grip, -0.19, -0.075); if (gp) P.fore = gp;
      break;
    }
    case 'ump': { // عاصفة
      prof(g, m.poly, 'umpBody', [[0.07, 0.068], [0.07, -0.01], [-0.012, -0.012], [-0.012, -0.03], [-0.05, -0.03], [-0.05, -0.012], [-0.06, -0.01], [-0.28, -0.01], [-0.29, 0.03], [-0.28, 0.068]], 0.042, 0, 0.003);
      for (let k = 0; k < 5; k++) box(g, m.poly2, 0.046, 0.004, 0.02, 0, 0.0, -0.17 - k * 0.022);
      rail(g, m.metal, 0.065, -0.2, 0.068); rail(g, m.metal, -0.15, -0.27, -0.01, 0, 0.018);
      prof(g, m.poly, 'umpGrip', [[0.024, -0.01], [-0.012, -0.01], [0.008, -0.1], [0.044, -0.106], [0.048, -0.09]], 0.027);
      mag(g, m.poly2, 'umpMag', [[-0.064, -0.01], [-0.11, -0.01], [-0.114, -0.2], [-0.068, -0.2]], 0.024, ext);
      tube(g, m.blued, 0.009, 0.009, 0.08, -0.29, 0.038);
      prof(g, m.poly, 'umpStock', [[0.07, 0.06], [0.24, 0.054], [0.25, 0.04], [0.25, -0.06], [0.235, -0.06], [0.2, 0.0], [0.07, 0.02]], 0.022, 0, 0.002, [[[0.1, 0.048], [0.22, 0.044], [0.2, 0.02], [0.1, 0.028]]]);
      const mz = muzzleDev(g, m, A.muzzle, -0.37, 0.038, 0.009, 'none');
      P = { ...P, muzzle: [0, 0.038, mz - 0.005], fore: [0, -0.005, -0.21], sightY: 0.096, railY: 0.072, railZ: -0.05 };
      if (!scope || scope === 'iron') irons(0.052, -0.19, 0.096, 0.072);
      const gp = gripAtt(g, m, A.grip, -0.2, -0.012); if (gp) P.fore = gp;
      break;
    }
    case 'pump': { // رعد
      prof(g, m.metal, 'pmRec', [[0.07, 0.065], [0.07, -0.005], [0.03, -0.012], [-0.12, -0.012], [-0.13, 0.02], [-0.12, 0.065]], 0.034, 0, 0.003);
      box(g, m.blued, 0.003, 0.02, 0.06, 0.0175, 0.035, -0.04);
      prof(g, m.wood, 'pmGrip', [[0.03, -0.008], [-0.012, -0.008], [0.004, -0.1], [0.04, -0.108], [0.05, -0.09]], 0.028, 0, 0.003);
      prof(g, m.metal, 'pmGuard', [[0.0, -0.012], [-0.06, -0.012], [-0.06, -0.034], [0.0, -0.034]], 0.012, 0, 0.001, [[[-0.004, -0.016], [-0.056, -0.016], [-0.056, -0.03], [-0.004, -0.03]]]);
      tube(g, m.blued, 0.012, 0.012, 0.52, -0.12, 0.046); tube(g, m.blued, 0.011, 0.011, 0.4, -0.12, 0.018);
      const pump = new THREE.Group(); g.add(pump); P.pumpObj = pump;
      prof(pump, m.wood, 'pmSlide', [[-0.2, 0.002], [-0.2, 0.036], [-0.37, 0.036], [-0.37, 0.002]], 0.04, 0, 0.005);
      for (let k = 0; k < 7; k++) box(pump, m.woodDark, 0.042, 0.003, 0.004, 0, 0.0, -0.215 - k * 0.022);
      box(g, m.steel, 0.006, 0.008, 0.006, 0, 0.063, -0.63);
      prof(g, m.wood, 'pmStock', [[0.065, 0.055], [0.3, 0.035], [0.31, 0.026], [0.31, -0.07], [0.27, -0.066], [0.15, -0.03], [0.065, -0.006]], 0.038, 0, 0.004);
      prof(g, m.rubber, 'pmPad', [[0.31, 0.03], [0.322, 0.03], [0.322, -0.072], [0.31, -0.072]], 0.04);
      P = { ...P, muzzle: [0, 0.046, -0.645], fore: [0, 0.0, -0.29], sightY: 0.07, railY: 0.066, railZ: -0.03 };
      if (scope && scope !== 'iron') rail(g, m.metal, 0.05, -0.1, 0.064);
      break;
    }
    case 'autoshot': { // إعصار
      prof(g, m.poly, 'asRec', [[0.07, 0.058], [0.07, -0.004], [0.04, -0.01], [-0.21, -0.006], [-0.22, 0.03], [-0.21, 0.058]], 0.034, 0, 0.003);
      rail(g, m.metal, 0.06, -0.2, 0.058, 0, 0.024);
      prof(g, m.poly, 'asGrip', [[0.025, -0.006], [-0.012, -0.006], [0.004, -0.1], [0.04, -0.108], [0.046, -0.092]], 0.027);
      prof(g, m.metal, 'asGuard', [[0.002, -0.01], [-0.06, -0.01], [-0.06, -0.034], [0.0, -0.034]], 0.012, 0, 0.001, [[[-0.004, -0.014], [-0.056, -0.014], [-0.056, -0.03], [-0.004, -0.03]]]);
      mag(g, m.poly2, 'asMag', [[-0.07, -0.006], [-0.135, -0.006], [-0.15, -0.12], [-0.085, -0.125]], 0.044, ext);
      prof(g, m.poly, 'asHG', [[-0.22, 0.008], [-0.22, 0.058], [-0.38, 0.056], [-0.38, 0.008]], 0.046, 0, 0.004);
      tube(g, m.blued, 0.013, 0.013, 0.22, -0.38, 0.036);
      prof(g, m.poly, 'asStock', [[0.065, 0.05], [0.3, 0.03], [0.31, -0.07], [0.27, -0.066], [0.065, -0.002]], 0.036, 0, 0.004, [[[0.12, 0.034], [0.25, 0.022], [0.24, -0.03], [0.13, 0.0]]]);
      const mz = muzzleDev(g, m, A.muzzle, -0.6, 0.036, 0.013, 'slant');
      P = { ...P, muzzle: [0, 0.036, mz - 0.005], fore: [0, 0.008, -0.3], sightY: 0.075, railY: 0.062, railZ: -0.05 };
      break;
    }
    case 'lmg': { // طوفان
      prof(g, m.metal, 'lgRec', [[0.1, 0.07], [0.1, -0.004], [0.04, -0.01], [-0.012, -0.012], [-0.25, -0.006], [-0.26, 0.03], [-0.25, 0.07]], 0.044, 0, 0.003);
      prof(g, m.poly2, 'lgCover', [[0.07, 0.07], [0.07, 0.09], [-0.15, 0.088], [-0.18, 0.07]], 0.048);
      rail(g, m.metal, 0.06, -0.14, 0.09);
      prof(g, m.poly, 'lgGrip', [[0.025, -0.006], [-0.012, -0.006], [0.006, -0.1], [0.044, -0.108], [0.048, -0.09]], 0.028);
      box(g, m.olive, 0.075, 0.1, 0.12, -0.03, -0.055, -0.12); box(g, m.poly2, 0.08, 0.012, 0.125, -0.03, -0.004, -0.12);
      tube(g, m.blued, 0.011, 0.011, 0.38, -0.26, 0.038); tube(g, m.metal, 0.02, 0.02, 0.2, -0.26, 0.038, 0, 8);
      for (let k = 0; k < 6; k++) box(g, m.poly, 0.044, 0.044, 0.006, 0, 0.038, -0.28 - k * 0.03);
      box(g, m.metal, 0.01, 0.06, 0.012, 0.018, -0.02, -0.5, -1.2); box(g, m.metal, 0.01, 0.06, 0.012, -0.018, -0.02, -0.5, -1.2);
      prof(g, m.metal, 'lgHandle', [[-0.06, 0.07], [-0.06, 0.12], [-0.17, 0.12], [-0.17, 0.11], [-0.07, 0.11], [-0.07, 0.07]], 0.016);
      prof(g, m.poly, 'lgStock', [[0.1, 0.06], [0.33, 0.05], [0.34, -0.06], [0.3, -0.06], [0.1, 0.0]], 0.044, 0, 0.004);
      const mz = muzzleDev(g, m, A.muzzle, -0.64, 0.038, 0.011, 'flash');
      P = { ...P, muzzle: [0, 0.038, mz - 0.005], fore: [0, 0.01, -0.33], sightY: 0.116, railY: 0.094, railZ: -0.04 };
      if (!scope || scope === 'iron') irons(0.05, -0.6, 0.116, 0.094);
      break;
    }
    case 'dmr': { // المِرصاد
      prof(g, m.metal, 'dmRec', [[0.08, 0.07], [0.08, -0.004], [0.04, -0.01], [-0.012, -0.012], [-0.012, -0.03], [-0.06, -0.03], [-0.065, -0.01], [-0.25, -0.004], [-0.26, 0.03], [-0.25, 0.07]], 0.034, 0, 0.003);
      rail(g, m.metal, 0.075, -0.24, 0.07);
      prof(g, m.poly, 'dmGrip', [[0.025, -0.006], [-0.012, -0.006], [0.006, -0.1], [0.044, -0.108], [0.048, -0.09]], 0.027);
      mag(g, m.poly2, 'dmMag', [[-0.07, -0.01], [-0.125, -0.01], [-0.13, -0.13], [-0.075, -0.133]], 0.03, ext);
      prof(g, m.poly, 'dmHG', [[-0.26, 0.006], [-0.26, 0.066], [-0.46, 0.06], [-0.47, 0.012]], 0.046, 0, 0.004);
      for (let k = 0; k < 5; k++) box(g, m.poly2, 0.05, 0.016, 0.01, 0, 0.04, -0.29 - k * 0.032);
      tube(g, m.blued, 0.01, 0.01, 0.23, -0.47, 0.042);
      prof(g, m.poly, 'dmStock', [[0.08, 0.062], [0.33, 0.05], [0.34, -0.07], [0.3, -0.07], [0.15, -0.03], [0.08, 0.0]], 0.04, 0, 0.004);
      prof(g, m.poly2, 'dmCheek', [[0.16, 0.06], [0.3, 0.055], [0.3, 0.075], [0.18, 0.08]], 0.03);
      const mz = muzzleDev(g, m, A.muzzle, -0.7, 0.042, 0.01, 'flash');
      P = { ...P, muzzle: [0, 0.042, mz - 0.005], fore: [0, 0.01, -0.36], sightY: 0.104, railY: 0.074, railZ: -0.06 };
      if (!scope || scope === 'iron') irons(0.06, -0.23, 0.104, 0.074);
      break;
    }
    case 'mini': { // الناظور: أخمص خشبي كامل
      prof(g, m.wood, 'mnStock', [[0.34, 0.03], [0.35, -0.075], [0.3, -0.07], [0.08, -0.03], [0.04, -0.075], [0.0, -0.075], [-0.03, -0.02], [-0.42, 0.0], [-0.43, 0.035], [-0.04, 0.042], [0.06, 0.05]], 0.038, 0, 0.004);
      prof(g, m.steel, 'mnRec', [[0.06, 0.07], [0.06, 0.035], [-0.16, 0.035], [-0.17, 0.07]], 0.03);
      rail(g, m.metal, 0.04, -0.12, 0.07);
      mag(g, m.poly2, 'mnMag', [[-0.05, -0.02], [-0.09, -0.02], [-0.095, -0.1], [-0.055, -0.102]], 0.024, ext);
      prof(g, m.metal, 'mnGuard', [[0.03, -0.03], [-0.03, -0.03], [-0.03, -0.05], [0.03, -0.05]], 0.012, 0, 0.001, [[[0.026, -0.034], [-0.026, -0.034], [-0.026, -0.046], [0.026, -0.046]]]);
      tube(g, m.blued, 0.009, 0.009, 0.28, -0.42, 0.048); tube(g, m.steel, 0.006, 0.006, 0.22, -0.2, 0.028);
      const mz = muzzleDev(g, m, A.muzzle, -0.7, 0.048, 0.009, 'none');
      P = { ...P, grip: [0, -0.05, 0.04], muzzle: [0, 0.048, mz - 0.005], fore: [0, 0.01, -0.3], sightY: 0.1, railY: 0.074, railZ: -0.04 };
      if (!scope || scope === 'iron') irons(0.03, -0.66, 0.1, 0.074);
      break;
    }
    case 'awm': { // صقر الصحراء
      prof(g, m.olive, 'awChassis', [[0.12, 0.06], [0.12, -0.004], [0.04, -0.012], [-0.012, -0.012], [-0.012, -0.03], [-0.06, -0.03], [-0.065, -0.012], [-0.3, -0.006], [-0.31, 0.02], [-0.3, 0.062]], 0.05, 0, 0.004);
      prof(g, m.metal, 'awAct', [[0.09, 0.09], [0.09, 0.05], [-0.14, 0.05], [-0.14, 0.09]], 0.034);
      rail(g, m.metal, 0.08, -0.13, 0.09, 0, 0.022);
      const bolt = new THREE.Group(); g.add(bolt); P.boltObj = bolt;
      cyl(bolt, m.steel, 0.006, 0.05, 0.035, 0.07, 0.04, 0, Math.PI / 2 - 0.3); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), m.poly); knob.position.set(0.06, 0.063, 0.04); bolt.add(knob);
      prof(g, m.poly, 'awGrip', [[0.025, -0.006], [-0.012, -0.006], [0.01, -0.1], [0.046, -0.106], [0.05, -0.088]], 0.028);
      mag(g, m.poly2, 'awMag', [[-0.07, -0.008], [-0.13, -0.008], [-0.13, -0.07], [-0.07, -0.07]], 0.034, ext);
      tube(g, m.blued, 0.014, 0.012, 0.48, -0.3, 0.048);
      box(g, m.metal, 0.01, 0.07, 0.012, 0.02, -0.025, -0.27, -1.3); box(g, m.metal, 0.01, 0.07, 0.012, -0.02, -0.025, -0.27, -1.3);
      prof(g, m.olive, 'awStock', [[0.12, 0.06], [0.36, 0.06], [0.37, 0.05], [0.37, -0.075], [0.35, -0.078], [0.3, -0.04], [0.2, -0.03], [0.12, 0.0]], 0.044, 0, 0.004, [[[0.15, 0.04], [0.31, 0.04], [0.3, -0.02], [0.2, -0.012], [0.16, 0.012]]]);
      prof(g, m.poly, 'awCheek', [[0.18, 0.06], [0.33, 0.06], [0.33, 0.085], [0.2, 0.088]], 0.036);
      prof(g, m.rubber, 'awPad', [[0.37, 0.054], [0.384, 0.054], [0.384, -0.08], [0.37, -0.08]], 0.046);
      const mz = muzzleDev(g, m, A.muzzle, -0.78, 0.048, 0.012, 'brake');
      P = { ...P, muzzle: [0, 0.048, mz - 0.005], fore: [0, 0.012, -0.26], sightY: 0.12, railY: 0.094, railZ: -0.02 };
      break;
    }
    case 'kar': { // عُقاب: قنّاصة خشبية كلاسيكية
      prof(g, m.wood, 'krStock', [[0.36, 0.03], [0.37, -0.08], [0.33, -0.08], [0.1, -0.04], [0.05, -0.08], [0.0, -0.08], [-0.03, -0.02], [-0.5, 0.004], [-0.5, 0.04], [-0.04, 0.045], [0.08, 0.05]], 0.04, 0, 0.004);
      prof(g, m.blued, 'krRec', [[0.07, 0.075], [0.07, 0.04], [-0.12, 0.04], [-0.12, 0.075]], 0.028);
      tube(g, m.blued, 0.0095, 0.008, 0.28, -0.5, 0.055); box(g, m.blued, 0.014, 0.012, 0.03, 0, 0.068, -0.76);
      box(g, m.blued, 0.003, 0.018, 0.003, 0, 0.08, -0.765); box(g, m.blued, 0.03, 0.006, 0.05, 0, 0.078, -0.1);
      const bolt = new THREE.Group(); g.add(bolt); P.boltObj = bolt;
      cyl(bolt, m.steel, 0.005, 0.05, 0.03, 0.055, 0.045, 0, Math.PI / 2 + 0.5); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), m.steel); knob.position.set(0.05, 0.04, 0.045); bolt.add(knob);
      prof(g, m.blued, 'krGuard', [[0.03, -0.03], [-0.03, -0.03], [-0.03, -0.05], [0.03, -0.05]], 0.012, 0, 0.001, [[[0.026, -0.034], [-0.026, -0.034], [-0.026, -0.046], [0.026, -0.046]]]);
      tube(g, m.blued, 0.012, 0.012, 0.012, -0.32, 0.03); tube(g, m.blued, 0.012, 0.012, 0.012, -0.46, 0.035);
      const mz = muzzleDev(g, m, A.muzzle, -0.78, 0.055, 0.008, 'none');
      P = { ...P, grip: [0, -0.055, 0.05], muzzle: [0, 0.055, mz - 0.005], fore: [0, 0.012, -0.3], sightY: 0.088, railY: 0.08, railZ: -0.03 };
      if (scope && scope !== 'iron') rail(g, m.metal, 0.05, -0.1, 0.076);
      break;
    }
    case 'glock': case 'auto': { // دجلة-9 / زعيم-18
      prof(g, m.poly, 'glSlide', [[0.04, 0.056], [0.04, 0.022], [-0.15, 0.022], [-0.152, 0.05], [-0.145, 0.056]], 0.024, 0, 0.002);
      for (let k = 0; k < 6; k++) box(g, m.poly2, 0.026, 0.026, 0.002, 0, 0.04, 0.03 - k * 0.006);
      prof(g, m.poly2, 'glFrame', [[0.03, 0.022], [0.03, 0.006], [0.0, 0.0], [-0.04, 0.0], [-0.04, -0.016], [-0.08, -0.016], [-0.085, 0.004], [-0.15, 0.008], [-0.15, 0.022]], 0.022);
      prof(g, m.poly2, 'glGrip', [[0.03, 0.006], [-0.005, 0.0], [0.004, -0.1], [0.04, -0.104], [0.046, -0.002]], 0.026, 0, 0.003);
      box(g, m.metal, 0.003, 0.018, 0.004, 0, -0.006, -0.03, 0.2);
      box(g, m.metal, 0.012, 0.006, 0.004, 0, 0.059, 0.034); box(g, m.metal, 0.003, 0.006, 0.004, 0, 0.059, -0.14);
      tube(g, m.metal, 0.005, 0.005, 0.006, -0.15, 0.04);
      if (model === 'auto') { mag(g, m.poly2, 'glExt', [[0.03, -0.09], [0.002, -0.09], [0.004, -0.18], [0.03, -0.18]], 0.022); tube(g, m.metal, 0.012, 0.012, 0.03, -0.152, 0.04); box(g, m.steel, 0.006, 0.006, 0.012, 0.012, 0.045, 0.0); }
      P = { grip: [0, -0.04, 0.025], fore: [0, -0.05, 0.0], muzzle: [0, 0.04, model === 'auto' ? -0.19 : -0.16], sightY: 0.062, railY: 0.056, railZ: -0.06, pistol: true, iron: [], adsZ: -0.36 };
      if (scope === 'dot') { box(g, m.metal, 0.02, 0.006, 0.02, 0, 0.059, -0.02); }
      break;
    }
    case 'deagle': { // النسر .50
      prof(g, m.chrome, 'dgSlide', [[0.05, 0.068], [0.05, 0.024], [-0.19, 0.024], [-0.195, 0.05], [-0.19, 0.068]], 0.028, 0, 0.002);
      prof(g, m.chrome, 'dgTop', [[0.02, 0.068], [0.02, 0.078], [-0.18, 0.074], [-0.19, 0.068]], 0.014);
      for (let k = 0; k < 5; k++) box(g, m.steel, 0.03, 0.03, 0.003, 0, 0.046, 0.04 - k * 0.007);
      prof(g, m.chrome, 'dgFrame', [[0.04, 0.024], [0.04, 0.004], [0.0, 0.0], [-0.04, 0.0], [-0.04, -0.018], [-0.085, -0.018], [-0.09, 0.006], [-0.12, 0.024]], 0.026);
      prof(g, m.rubber, 'dgGrip', [[0.038, 0.004], [-0.006, 0.0], [0.004, -0.104], [0.046, -0.11], [0.052, -0.004]], 0.03, 0, 0.003);
      box(g, m.steel, 0.012, 0.012, 0.008, 0, 0.07, 0.05);
      box(g, m.metal, 0.003, 0.018, 0.004, 0, -0.006, -0.03, 0.2);
      P = { grip: [0, -0.04, 0.03], fore: [0, -0.05, 0.0], muzzle: [0, 0.046, -0.2], sightY: 0.083, railY: 0.078, railZ: -0.07, pistol: true, iron: [], adsZ: -0.38 };
      if (scope === 'dot') box(g, m.metal, 0.022, 0.006, 0.024, 0, 0.079, -0.03);
      break;
    }
    case 'revolver': { // فرات
      prof(g, m.blued, 'rvFrame', [[0.03, 0.055], [0.03, 0.006], [0.0, 0.0], [-0.04, 0.0], [-0.04, -0.016], [-0.08, -0.016], [-0.08, 0.012], [-0.08, 0.055]], 0.026, 0, 0.002, [[[-0.002, 0.012], [-0.075, 0.012], [-0.075, 0.05], [-0.002, 0.05]]]);
      const cylG = new THREE.Group(); cylG.position.set(0, 0.032, -0.038); g.add(cylG); P.cylObj = cylG;
      tube(cylG, m.blued, 0.021, 0.021, 0.05, 0.025, 0, 0, 12); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; box(cylG, m.steel, 0.004, 0.004, 0.051, Math.cos(a) * 0.021, Math.sin(a) * 0.021, 0); }
      tube(g, m.blued, 0.0075, 0.0075, 0.14, -0.08, 0.045); box(g, m.blued, 0.008, 0.008, 0.13, 0, 0.054, -0.145); box(g, m.blued, 0.004, 0.01, 0.006, 0, 0.062, -0.21);
      box(g, m.steel, 0.008, 0.02, 0.012, 0, 0.06, 0.035, -0.4);
      prof(g, m.wood, 'rvGrip', [[0.03, 0.006], [-0.002, 0.0], [0.008, -0.1], [0.046, -0.104], [0.05, -0.002]], 0.03, 0, 0.004);
      cyl(g, m.gold, 0.007, 0.032, 0, -0.05, 0.022, 0, Math.PI / 2, 16);
      box(g, m.metal, 0.003, 0.016, 0.004, 0, -0.008, -0.03, 0.2);
      P = { grip: [0, -0.04, 0.025], fore: [0, -0.05, 0.0], muzzle: [0, 0.045, -0.225], sightY: 0.066, railY: 0.06, railZ: -0.07, pistol: true, iron: [], adsZ: -0.38 };
      break;
    }
    case 'knife': { // خنجر عربي مقوّس
      prof(g, m.blade, 'knBlade', [[0.0, 0.006], [-0.06, 0.012], [-0.12, 0.022], [-0.17, 0.05], [-0.15, 0.03], [-0.1, 0.002], [-0.05, -0.008], [0.0, -0.01]], 0.006, 0, 0.0015);
      box(g, m.gold, 0.03, 0.03, 0.01, 0, -0.002, 0.004);
      prof(g, m.woodDark, 'knHandle', [[0.0, 0.01], [0.09, 0.016], [0.1, 0.0], [0.09, -0.016], [0.0, -0.012]], 0.022, 0, 0.004);
      cyl(g, m.gold, 0.012, 0.024, 0, 0.0, 0.096, 0, Math.PI / 2, 12);
      for (let k = 0; k < 3; k++) cyl(g, m.gold, 0.0125, 0.004, 0, 0.002, 0.025 + k * 0.022, 0, Math.PI / 2, 12);
      P = { grip: [0, 0, 0.04], fore: [0, 0, 0], muzzle: [0, 0.02, -0.17], sightY: 0.04, knife: true, iron: [], adsZ: -0.3 };
      break;
    }
    case 'frag': { const s = new THREE.Mesh(cache('frag', () => new THREE.SphereGeometry(0.035, 14, 10)), m.nade); s.scale.y = 1.2; g.add(s); cyl(g, m.metal, 0.012, 0.02, 0, 0.045, 0); box(g, m.metal, 0.01, 0.06, 0.012, 0.02, 0.02, 0, 0, 0, -0.3); P = { grip: [0, 0, 0], fore: [0, 0, 0], muzzle: [0, 0, 0], sightY: 0.04, nade: true, iron: [] }; break; }
    case 'smoke': { cyl(g, m.grey, 0.03, 0.11, 0, 0, 0); cyl(g, m.metal, 0.031, 0.02, 0, 0.05, 0); P = { grip: [0, 0, 0], fore: [0, 0, 0], muzzle: [0, 0, 0], sightY: 0.04, nade: true, iron: [] }; break; }
    case 'flash': { cyl(g, m.metal, 0.028, 0.1, 0, 0, 0); for (let k = 0; k < 6; k++) box(g, m.poly, 0.004, 0.02, 0.004, Math.cos(k) * 0.028, 0, Math.sin(k) * 0.028); P = { grip: [0, 0, 0], fore: [0, 0, 0], muzzle: [0, 0, 0], sightY: 0.04, nade: true, iron: [] }; break; }
    case 'molotov': { cyl(g, m.bottle, 0.036, 0.13, 0, 0, 0); cyl(g, m.bottle, 0.014, 0.06, 0, 0.09, 0); cyl(g, m.cloth, 0.01, 0.06, 0, 0.14, 0, 0, 0, 6); P = { grip: [0, 0, 0], fore: [0, 0, 0], muzzle: [0, 0, 0], sightY: 0.04, nade: true, iron: [] }; break; }
    default: { box(g, m.metal, 0.03, 0.05, 0.5, 0, 0.04, -0.2); P.muzzle = [0, 0.04, -0.46]; }
  }
  const sc = scope && scope !== 'iron' && !P.knife && !P.nade ? addScope(g, scope, P.railY, P.railZ) : null;
  if (sc) { P.sightY = sc.y; P.scope = sc; P.adsZ = sc.adsZ; P.rearZ = sc.z + (sc.len ? sc.len * 0.5 : 0.03); }
  if (P.rearZ === undefined) P.rearZ = P.pistol ? 0.034 : model === 'ak' || model === 'autoshot' ? -0.2 : model === 'kar' ? -0.1 : model === 'mini' ? 0.03 : 0.05;
  const mz = new THREE.Object3D(); mz.position.set(...P.muzzle); g.add(mz); P.muzzleObj = mz;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  // الأجزاء المتحركة (الترباس، المضخة، الأسطوانة) لا تُدمج
  for (const k of ['boltObj', 'pumpObj', 'cylObj']) if (P[k]) P[k].traverse(o => { if (o.isMesh) o.userData.keep = true; });
  for (const r of P.iron) r.traverse(o => { if (o.isMesh) o.userData.keep = true; });
  mergeChildren(g);
  return { group: g, P };
}
