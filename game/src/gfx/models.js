// نماذج ثلاثية الأبعاد مرخّصة (CC0) مدمجة: فانوس الشارع الخشبي وسمكة البنّي
// تُفكّ من صيغة مضغوطة (مواضع Int16 مكمّمة، عموديات Int8، UV Int16) وقوام صغير مدمج
import * as THREE from 'three';
import { MODEL_DATA } from './modeldata.js';

const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const loader = new THREE.TextureLoader(), cache = new Map();
export const emissiveMats = [];
function tex(uri, srgb, aniso) { const t = loader.load(uri); t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso || 1; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
// أجزاء النموذج: [{geo, mat}] — تحويل إضافي اختياري يطبّق على الهندسة
export function modelParts(name, aniso = 4) {
  if (cache.has(name)) return cache.get(name);
  const parts = (MODEL_DATA[name] || []).map(P => {
    const pb = b64(P.p), nb = b64(P.n), ub = b64(P.u), ib = b64(P.i);
    const pv = new Int16Array(pb.buffer), nv = new Int8Array(nb.buffer), uv = new Int16Array(ub.buffer), n = pv.length / 3;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { pos[i * 3 + k] = P.lo[k] + (pv[i * 3 + k] + 32768) / 65535 * (P.hi[k] - P.lo[k]); nrm[i * 3 + k] = nv[i * 3 + k] / 127; }
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) uvs[i * 2 + k] = P.ulo[k] + (uv[i * 2 + k] + 32768) / 65535 * (P.uhi[k] - P.ulo[k]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(new THREE.BufferAttribute(P.i32 ? new Uint32Array(ib.buffer) : new Uint16Array(ib.buffer), 1));
    if (name === 'fish') { g.rotateZ(Math.PI / 2); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); } // السمكة مستلقية على جنبها
    g.computeBoundingSphere();
    const M = P.mat, c = M.color || [1, 1, 1, 1];
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(c[0], c[1], c[2]), roughness: M.rough ?? 1, metalness: M.metal ?? 0, side: M.double ? THREE.DoubleSide : THREE.FrontSide });
    if (M.map) mat.map = tex(M.map, true, aniso);
    if (M.orm) { const t = tex(M.orm, false, aniso); mat.roughnessMap = t; mat.metalnessMap = t; }
    if (M.normalMap) mat.normalMap = tex(M.normalMap, false, aniso);
    if (M.emissiveMap) { mat.emissiveMap = tex(M.emissiveMap, true, aniso); mat.emissive = new THREE.Color(1, 0.85, 0.6); mat.emissiveIntensity = 1; emissiveMats.push(mat); }
    if (name === 'fish') { mat.roughness = 0.35; mat.envMapIntensity = 1.2; }
    return { geo: g, mat };
  });
  cache.set(name, parts);
  return parts;
}
export function hasModel(name) { return !!MODEL_DATA[name]; }
