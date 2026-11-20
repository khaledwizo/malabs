// تجميع الهندسة: كل المادة الواحدة تُدمج في شبكة واحدة (قليل من نداءات الرسم)
import * as THREE from 'three';

export class Batch {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
  vert(x, y, z, nx, ny, nz, u, v, ao = 1) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(ao, ao, ao); return this.count - 1; }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  // يضيف هندسة three جاهزة بمصفوفة تحويل (UV تبقى كما هي مضروبة في uvs)
  addGeo(geo, m, uvs = 1, ao = 1) {
    const g = geo.index ? geo : geo; const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), nv = new THREE.Vector3();
    const base = this.count;
    for (let k = 0; k < P.count; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(m);
      if (N) nv.fromBufferAttribute(N, k).applyMatrix3(nm).normalize(); else nv.set(0, 1, 0);
      const uu = U ? U.getX(k) * uvs : 0, vv = U ? U.getY(k) * uvs : 0;
      this.vert(v.x, v.y, v.z, nv.x, nv.y, nv.z, uu, vv, typeof ao === 'function' ? ao(v) : ao);
    }
    if (g.index) { const I = g.index.array; for (let k = 0; k < I.length; k++) this.i.push(base + I[k]); }
    else for (let k = 0; k < P.count; k++) this.i.push(base + k);
  }
}

// صندوق بإحداثيات UV بالمتر (تتكرر القوام بانتظام على كل الجدران)
// faces: سلسلة من px nx py ny pz nz لتحديد الأوجه المرسومة. ao(y): تعتيم قرب الأرض
export function boxInto(bt, x0, y0, z0, x1, y1, z1, s = 1, faces = 'pxnxpynypznz', aoY = null, uo = 0, vo = 0) {
  const has = f => faces.includes(f);
  const A = y => aoY === null ? 1 : Math.min(1, 0.55 + 0.45 * Math.min(1, (y - aoY) / 0.9));
  const splitY = aoY !== null && y1 - y0 > 1.2 ? Math.max(y0, aoY + 0.9) : null;
  const side = (pts, nx, ny, nz, uv) => {
    // pts: 4 رؤوس [x,y,z], uv: دالة تعطي [u,v]
    const ids = pts.map(p => { const t = uv(p); return bt.vert(p[0], p[1], p[2], nx, ny, nz, t[0] / s + uo, t[1] / s + vo, ny === 0 ? A(p[1]) : (ny > 0 ? 1 : 0.6)); });
    bt.quad(ids[0], ids[1], ids[2], ids[3]);
  };
  const vside = (ax0, az0, ax1, az1, nx, nz, uf) => {
    const ys = splitY && splitY < y1 && splitY > y0 ? [y0, splitY, y1] : [y0, y1];
    for (let k = 0; k < ys.length - 1; k++) side([[ax0, ys[k], az0], [ax1, ys[k], az1], [ax1, ys[k + 1], az1], [ax0, ys[k + 1], az0]], nx, 0, nz, uf);
  };
  if (has('pz')) vside(x0, z1, x1, z1, 0, 1, p => [p[0], p[1]]);
  if (has('nz')) vside(x1, z0, x0, z0, 0, -1, p => [-p[0], p[1]]);
  if (has('px')) vside(x1, z1, x1, z0, 1, 0, p => [-p[2], p[1]]);
  if (has('nx')) vside(x0, z0, x0, z1, -1, 0, p => [p[2], p[1]]);
  if (has('py')) side([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], 0, 1, 0, p => [p[0], -p[2]]);
  if (has('ny')) side([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 0, -1, 0, p => [p[0], p[2]]);
}

// شكل فتحة قوس (يُستخدم كثقب في جدار)
export function archHole(cx, y0, w, h, rise, segs = 12) {
  const p = new THREE.Path(), r = w / 2;
  if (rise <= 0.001) { p.moveTo(cx - r, y0); p.lineTo(cx + r, y0); p.lineTo(cx + r, y0 + h); p.lineTo(cx - r, y0 + h); p.closePath(); return p; }
  const R = (r * r + rise * rise) / (2 * r); // نصف قطر قوسي القوس المدبب
  const cL = cx + r - R, cR = cx - r + R; // القوس الأيسر مركزه يمين
  p.moveTo(cx - r, y0); p.lineTo(cx + r, y0); p.lineTo(cx + r, y0 + h);
  // من الكتف الأيمن إلى القمة: دائرة مركزها cL
  for (let i = 1; i <= segs; i++) { const t = i / segs, x = cx + r - t * r, dx = x - cL, y = y0 + h + Math.sqrt(Math.max(0, R * R - dx * dx)); p.lineTo(x, Math.min(y, y0 + h + rise)); }
  for (let i = 1; i <= segs; i++) { const t = i / segs, x = cx - t * r, dx = x - cR, y = y0 + h + Math.sqrt(Math.max(0, R * R - dx * dx)); p.lineTo(x, Math.min(y, y0 + h + rise)); }
  p.closePath();
  return p;
}
// جدار مستطيل بفتحات أقواس، مبثوق بسماكة t (محلياً: x عرض، y ارتفاع، z سماكة)
export function archWallGeo(W, H, t, holes) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(W, 0); s.lineTo(W, H); s.lineTo(0, H); s.closePath();
  for (const h of holes) s.holes.push(archHole(h.x, h.y || 0, h.w, h.h, h.rise ?? h.w * 0.55));
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 8 });
  return g;
}

// دمج الشبكات الأبناء المباشرين لمجموعة حسب المادة (يقلّل نداءات الرسم للشخصيات والأسلحة)
export function mergeChildren(group, recurse = true) {
  const byMat = new Map(), kill = [];
  for (const c of group.children) {
    if (c.isMesh && !c.userData.keep && !c.isInstancedMesh) {
      c.updateMatrix();
      let L = byMat.get(c.material); if (!L) { L = []; byMat.set(c.material, L); }
      L.push(c); kill.push(c);
    } else if (recurse && c.children && c.children.length) mergeChildren(c, true);
  }
  for (const [mat, L] of byMat) {
    if (L.length < 2) { const i = kill.indexOf(L[0]); if (i >= 0) kill.splice(i, 1); continue; }
    const bt = new Batch();
    for (const m of L) bt.addGeo(m.geometry, m.matrix, 1, 1);
    const g = bt.build(); g.deleteAttribute('color');
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = L[0].castShadow; mesh.receiveShadow = L[0].receiveShadow; mesh.userData.merged = true;
    group.add(mesh);
  }
  for (const k of kill) group.remove(k);
  return group;
}
