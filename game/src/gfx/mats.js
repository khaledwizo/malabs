// مكتبة المواد: قوام إجرائي + خشونة/معدنية. tile = كم متراً يغطي القوام الواحد
import * as THREE from 'three';
import * as TX from './tex.js';

export function makeMaterials(Q) {
  const S = Q.tex, lowQ = Q.shadow === 0;
  TX.setAniso(Q.aniso);
  const M = {};
  const mk = (id, tex, tile, o = {}) => {
    const P = { vertexColors: o.vc !== false, color: o.color || 0xffffff };
    if (tex) { P.map = tex.map; if (tex.normalMap && !lowQ) { P.normalMap = tex.normalMap; P.normalScale = new THREE.Vector2(o.ns || 1, o.ns || 1); } }
    let m;
    if (lowQ || o.lambert) m = new THREE.MeshLambertMaterial(P);
    else m = new THREE.MeshStandardMaterial(Object.assign(P, { roughness: o.rough ?? 0.9, metalness: o.metal ?? 0 }));
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; if (o.emap) m.emissiveMap = tex.map; }
    if (o.side) m.side = o.side;
    if (o.alphaTest) { m.alphaTest = o.alphaTest; m.transparent = false; }
    if (o.transparent) { m.transparent = true; m.opacity = o.opacity ?? 1; m.depthWrite = o.depthWrite ?? true; }
    M[id] = { mat: m, tile };
    return m;
  };
  const half = Math.max(128, S / 2);
  mk('brick', TX.brick(S), 1.25, { rough: 0.92 });
  mk('brickRed', TX.brick(S, { base: [176, 118, 82], seed: 21 }), 1.25, { rough: 0.92 });
  mk('brickPale', TX.brick(S, { base: [214, 186, 140], seed: 31, rows: 14 }), 1.25, { rough: 0.92 });
  mk('plaster', TX.plaster(S), 2.6, { rough: 0.96 });
  mk('plasterOchre', TX.plaster(S, { base: [214, 174, 120], seed: 8 }), 2.6, { rough: 0.96 });
  mk('plasterBlue', TX.plaster(S, { base: [150, 182, 192], seed: 18, cracks: 3 }), 2.6, { rough: 0.96 });
  mk('plasterWhite', TX.plaster(S, { base: [236, 228, 212], seed: 28, cracks: 2 }), 2.6, { rough: 0.95 });
  mk('stone', TX.stoneFloor(S), 2.4, { rough: 0.85 });
  mk('marble', TX.stoneFloor(S, { base: [222, 214, 200], tiles: 2, seed: 17 }), 2.0, { rough: 0.45 });
  mk('paving', TX.brickPaving(S), 2.2, { rough: 0.9 });
  mk('sand', TX.sand(S), 5, { rough: 1 });
  mk('mud', TX.sand(half, { base: [150, 124, 92], seed: 4 }), 4, { rough: 1 });
  mk('roof', TX.plaster(half, { base: [150, 136, 118], seed: 41, cracks: 8 }), 3, { rough: 1 });
  mk('wood', TX.wood(half), 1.6, { rough: 0.75 });
  mk('woodDark', TX.wood(half, { base: [78, 46, 26], seed: 5, planks: 3 }), 1.6, { rough: 0.7 });
  mk('woodBlue', TX.wood(half, { base: [56, 98, 128], seed: 9, planks: 6 }), 1.6, { rough: 0.7 });
  mk('woodGreen', TX.wood(half, { base: [52, 102, 74], seed: 19, planks: 6 }), 1.6, { rough: 0.7 });
  mk('beam', TX.wood(half, { base: [96, 66, 40], seed: 14, planks: 0 }), 2, { rough: 0.8 });
  mk('lattice', TX.lattice(half), 0.7, { rough: 0.7 });
  mk('latticeBlue', TX.lattice(half, { base: [44, 88, 118] }), 0.7, { rough: 0.7 });
  mk('tileTurq', TX.tile(S), 1.3, { rough: 0.35 });
  mk('tileBlue', TX.tile(half, { bg: '#183d7a', acc: '#2a9fb0', line: '#f3d98a', white: '#f4f0e6', n: 2 }), 0.9, { rough: 0.35 });
  mk('tileGold', TX.tile(half, { bg: '#c7922f', acc: '#1e5d7a', line: '#f8e7b0', white: '#2a8f98', n: 1 }), 0.9, { rough: 0.3, metal: 0.2 });
  mk('carpet', TX.carpet(half), 1.8, { rough: 1 });
  mk('carpet2', TX.carpet(half, { red: '#1c3d5a', navy: '#7a1a1f' }), 1.8, { rough: 1 });
  mk('metal', TX.metal(half), 1, { rough: 0.5, metal: 0.8 });
  mk('iron', TX.metal(half, { base: [40, 38, 36], seed: 6 }), 1, { rough: 0.7, metal: 0.6 });
  mk('copper', TX.metal(half, { base: [184, 104, 58], seed: 2 }), 1, { rough: 0.35, metal: 1 });
  mk('brass', TX.metal(half, { base: [200, 160, 70], seed: 3 }), 1, { rough: 0.3, metal: 1 });
  mk('gold', null, 1, { color: 0xe8b84a, rough: 0.25, metal: 1 });
  mk('palm', TX.palmTrunk(half), 1.5, { rough: 0.95 });
  mk('leaf', TX.palmLeaf(S), 1, { rough: 0.8, alphaTest: 0.5, side: THREE.DoubleSide, vc: false });
  mk('clothRed', TX.fabric(half, { base: [150, 40, 38], stripe: 'rgba(240,220,180,0.6)' }), 2, { rough: 1, side: THREE.DoubleSide });
  mk('clothCream', TX.fabric(half, { base: [222, 206, 170], stripe: 'rgba(160,60,40,0.5)' }), 2, { rough: 1, side: THREE.DoubleSide });
  mk('clothGreen', TX.fabric(half, { base: [44, 96, 70] }), 2, { rough: 1, side: THREE.DoubleSide });
  mk('sack', TX.fabric(half, { base: [180, 150, 104] }), 1, { rough: 1 });
  mk('glow', null, 1, { color: 0xffc66b, emissive: 0xffb04a, ei: 2.2, vc: false, lambert: true });
  // تفاصيل الأرض وبرك المطر
  { const m = mk('decal', { map: TX.decalAtlas(512) }, 1, { transparent: true, depthWrite: false, rough: 0.95, vc: false }); m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  { const m = mk('puddle', null, 1, { color: 0x2a2a2c, rough: 0.04, metal: 0.1, transparent: true, opacity: 0, depthWrite: false, vc: false }); m.alphaMap = TX.puddleTex(128); m.userData.th = { value: 1 }; m.onBeforeCompile = sh => { sh.uniforms.pTh = m.userData.th; sh.fragmentShader = 'uniform float pTh;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', 'diffuseColor.a *= smoothstep(pTh, pTh + 0.18, texture2D(alphaMap, vAlphaMapUv).g);'); }; m.polygonOffset = true; m.polygonOffsetFactor = -3; m.polygonOffsetUnits = -3; if (m.isMeshStandardMaterial) m.envMapIntensity = 1.3; }
  mk('rubber', null, 1, { color: 0x161616, rough: 0.85, vc: false });
  mk('chrome', null, 1, { color: 0xd8d8dc, rough: 0.18, metal: 0.95, vc: false });
  mk('glassDark', null, 1, { color: 0x10161c, rough: 0.06, metal: 0.4, vc: false });
  mk('lampRed', null, 1, { color: 0xc01010, emissive: 0x700000, ei: 1, rough: 0.3, vc: false });
  mk('lampWhite', null, 1, { color: 0xfff4d8, emissive: 0x6a6050, ei: 1, rough: 0.2, vc: false });
  mk('concrete', TX.plaster(256, { base: [150, 146, 138], seed: 61, cracks: 5 }), 2.5, { rough: 0.95 });
  mk('paintWhite', null, 1, { color: 0xe8e6e0, rough: 0.45, metal: 0.2 });
  mk('glass', null, 1, { color: 0x88aabb, rough: 0.1, metal: 0.3, transparent: true, opacity: 0.35, depthWrite: false, vc: false });
  mk('tea', null, 1, { color: 0x6a1a06, rough: 0.1, vc: false }); // چاي داخل الاستكان
  mk('porcelain', null, 1, { color: 0xf3f0ea, rough: 0.25, vc: false }); mk('porcBlue', null, 1, { color: 0x2d5ba6, rough: 0.3, vc: false });
  mk('dark', null, 1, { color: 0x15110d, rough: 1 });
  mk('spice1', null, 1, { color: 0xc4561e, rough: 1 }); mk('spice2', null, 1, { color: 0xd8a72c, rough: 1 }); mk('spice3', null, 1, { color: 0x6d7a2a, rough: 1 });
  mk('dates', null, 1, { color: 0x5a2a14, rough: 0.6 });
  mk('fruit', null, 1, { color: 0xe08a2c, rough: 0.6 });
  // سوق السلاح والمشتل والرعب
  mk('olive', TX.fabric(half, { base: [74, 84, 54] }), 1.2, { rough: 0.85 });
  mk('tan', null, 1, { color: 0xa58c64, rough: 0.75 });
  mk('gunmetal', null, 1, { color: 0x2b2d31, rough: 0.38, metal: 0.8 });
  mk('ammo', TX.wood(half, { base: [62, 76, 44], seed: 33, planks: 2 }), 1, { rough: 0.8 });
  mk('leafGreen', null, 1, { color: 0x3e8a3a, rough: 0.8 }); mk('leafDark', null, 1, { color: 0x24582c, rough: 0.85 });
  mk('flowerRed', null, 1, { color: 0xd8283a, rough: 0.6 }); mk('flowerYellow', null, 1, { color: 0xf2c230, rough: 0.6 }); mk('flowerPink', null, 1, { color: 0xf07aa8, rough: 0.6 }); mk('flowerWhite', null, 1, { color: 0xf4f1e8, rough: 0.6 });
  mk('clay', TX.plaster(half, { base: [170, 96, 60], seed: 44, cracks: 1 }), 1, { rough: 0.9 });
  mk('charred', TX.wood(half, { base: [32, 26, 22], seed: 51, planks: 4 }), 1.6, { rough: 0.95 });
  mk('bone', null, 1, { color: 0xd9d2bd, rough: 0.7 });
  mk('rust', TX.metal(half, { base: [118, 62, 36], seed: 61 }), 1.5, { rough: 0.85, metal: 0.4 });
  mk('deadwood', TX.wood(half, { base: [58, 50, 44], seed: 71, planks: 0 }), 1.5, { rough: 0.95 });
  mk('tomb', TX.stoneFloor(half, { base: [146, 140, 128], tiles: 1, seed: 81 }), 1.2, { rough: 0.9 });
  mk('brickBurnt', TX.brick(S, { base: [92, 72, 60], seed: 91 }), 1.25, { rough: 0.95 });
  mk('plasterBurnt', TX.plaster(S, { base: [118, 104, 92], seed: 93, cracks: 9 }), 2.6, { rough: 0.97 });
  mk('graveDirt', TX.sand(half, { base: [104, 90, 74], seed: 23 }), 4, { rough: 1 });
  mk('grass', TX.sand(half, { base: [78, 108, 56], seed: 12 }), 3, { rough: 1 });
  mk('tileGreen', TX.tile(half, { bg: '#1d6a3c', acc: '#d8b44a', line: '#f2e6b4', white: '#e6efe0', n: 2 }), 0.9, { rough: 0.35 });
  mk('paintRed', null, 1, { color: 0xa3221e, rough: 0.5, metal: 0.35 });
  mk('paintOrange', null, 1, { color: 0xe0802a, rough: 0.45, metal: 0.3 });
  return M;
}

// لافتة بخط عربي كمادة مستقلة
const signCache = new Map();
export function signMat(text, opt = {}) {
  const k = text + JSON.stringify(opt); if (signCache.has(k)) return signCache.get(k);
  const t = opt.clock ? TX.clockFace(opt.S || 256) : opt.graffiti ? TX.graffiti(text, opt) : TX.sign(text, opt);
  const m = new THREE.MeshStandardMaterial({ map: t.map, roughness: 0.8 });
  if (opt.clock) m.alphaTest = 0.5;
  if (opt.graffiti) { m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  if (opt.glow) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = t.map; m.emissiveIntensity = opt.glow; }
  signCache.set(k, m); return m;
}
