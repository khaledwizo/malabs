// كاشف الوميض (z-fighting): أوجه صناديق مرئية متطابقة المستوى ومتداخلة وبنفس الاتجاه
import { Builder, NULL_GFX } from '../src/world/builder.js';
import { buildSouq } from '../src/world/maps/souq.js';
const B = new Builder(NULL_GFX); const L = [];
const orig = B.box.bind(B);
B.box = function (x0, y0, z0, x1, y1, z1, mat, o = {}) {
  if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
  if (mat && o.vis !== false) L.push({ b: [x0, y0, z0, x1, y1, z1], f: o.faces || 'pxnxpynypznz', mat, st: new Error().stack.split('\n')[2].trim().replace(/.*\//, '') });
  return orig(x0, y0, z0, x1, y1, z1, mat, o);
};
buildSouq(B);
const E = 0.004, out = [];
const axes = [['x', 0, 3, 1, 2, 4, 5], ['y', 1, 4, 0, 2, 3, 5], ['z', 2, 5, 0, 1, 3, 4]];
const faces = [];
for (const [i, r] of L.entries()) for (const [ax, lo, hi, a0, b0, a1, b1] of axes) for (const [sgn, k] of [['p', hi], ['n', lo]]) {
  if (!r.f.includes(sgn + ax)) continue; const b = r.b; if (b[hi] - b[lo] < 1e-6) { }
  faces.push({ i, ax, sgn, c: b[k], a0: b[a0], b0: b[b0], a1: b[a1], b1: b[b1] });
}
const by = {}; for (const f of faces) { const key = f.ax + f.sgn + Math.round(f.c / 0.02); (by[key] = by[key] || []).push(f); }
for (const list of Object.values(by)) for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
  const A = list[p], C = list[q]; if (A.i === C.i || Math.abs(A.c - C.c) > E) continue;
  const ox = Math.min(A.a1, C.a1) - Math.max(A.a0, C.a0), oy = Math.min(A.b1, C.b1) - Math.max(A.b0, C.b0);
  if (ox > 0.02 && oy > 0.02 && ox * oy > 0.01) out.push({ ax: A.sgn + A.ax, c: +A.c.toFixed(3), area: +(ox * oy).toFixed(2), m: L[A.i].mat + '/' + L[C.i].mat, at: L[A.i].st + ' || ' + L[C.i].st, p: [+(Math.max(A.a0, C.a0)).toFixed(1), +(Math.max(A.b0, C.b0)).toFixed(1)] });
}
out.sort((a, b) => b.area - a.area);
console.log('boxes', L.length, 'zfight pairs', out.length);
const agg = {}; for (const o of out) { const k = o.at; (agg[k] = agg[k] || { n: 0, area: 0, ex: o }).n++; agg[k].area += o.area; }
Object.entries(agg).sort((a, b) => b[1].area - a[1].area).slice(0, 40).forEach(([k, v]) => console.log(v.n, v.area.toFixed(1), v.ex.ax, v.ex.c, v.ex.m, v.ex.p, k));
const mp = {}; for (const o of out) { if (o.ax === 'ny' && o.c < 0.05) continue; const k = o.m.split('/').sort().join('/'); mp[k] = (mp[k] || 0) + o.area; }
console.log('--- by material pair'); Object.entries(mp).sort((a, b) => b[1] - a[1]).slice(0, 45).forEach(([k, v]) => console.log(v.toFixed(1), k));
