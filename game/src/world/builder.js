// باني الخرائط: يسجّل صناديق التصادم دائماً، ويبني الرسوميات فقط عند توفّر المواد (في السيرفر لا رسوميات)
import { World, MAT, F } from './collide.js';

const MATCOL = {
  brick: MAT.brick, brickRed: MAT.brick, brickPale: MAT.brick, plaster: MAT.plaster, plasterOchre: MAT.plaster, plasterBlue: MAT.plaster, plasterWhite: MAT.plaster,
  stone: MAT.stone, marble: MAT.stone, paving: MAT.brick, sand: MAT.sand, mud: MAT.sand, roof: MAT.plaster, wood: MAT.wood, woodDark: MAT.wood, woodBlue: MAT.wood, woodGreen: MAT.wood,
  beam: MAT.wood, lattice: MAT.wood, latticeBlue: MAT.wood, tileTurq: MAT.tile, tileBlue: MAT.tile, tileGold: MAT.tile, carpet: MAT.cloth, carpet2: MAT.cloth, metal: MAT.metal, iron: MAT.metal,
  copper: MAT.metal, brass: MAT.metal, gold: MAT.metal, palm: MAT.wood, clothRed: MAT.cloth, clothCream: MAT.cloth, clothGreen: MAT.cloth, sack: MAT.cloth, glass: MAT.glass,
};

export class Builder {
  constructor(gfx) {
    this.w = new World();
    this.gfx = gfx || null; // { THREE, mats, Batch, boxInto, ... }
    this.batches = new Map(); this.meshes = []; this.inst = new Map(); this.lights = []; this.glows = []; this.water = []; this.anim = [];
    this.navN = []; this.navL = []; this.zones = [];
  }
  get vis() { return !!this.gfx; }
  batch(mat) {
    let b = this.batches.get(mat);
    if (!b) { b = new this.gfx.Batch(); this.batches.set(mat, b); }
    return b;
  }
  tile(mat) { const m = this.gfx.mats[mat]; return m ? m.tile : 1; }
  // صندوق بإحداثيات الزوايا
  box(x0, y0, z0, x1, y1, z1, mat, o = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
    if (o.col !== false) this.w.add(x0, y0, z0, x1, y1, z1, o.cm ?? MATCOL[mat] ?? 0, o.flags || 0);
    if (this.vis && o.vis !== false && mat) this.gfx.boxInto(this.batch(mat), x0, y0, z0, x1, y1, z1, o.tile || this.tile(mat), o.faces || 'pxnxpynypznz', o.ao === undefined ? (y0 < 0.2 ? y0 : null) : o.ao, o.uo || 0, o.vo || 0);
    return this;
  }
  // صندوق بمركز أفقي وقاعدة سفلية
  boxB(cx, y0, cz, sx, sy, sz, mat, o) { return this.box(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2, mat, o); }
  col(x0, y0, z0, x1, y1, z1, cm = MAT.stone, flags = 0) { this.w.add(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), cm, flags); return this; }
  // هندسة three مع مصفوفة (بلا تصادم إلا إذا طُلب)
  geo(geoFn, matrix, mat, o = {}) {
    if (!this.vis) return this;
    const g = typeof geoFn === 'function' ? geoFn() : geoFn;
    this.batch(mat).addGeo(g, matrix, o.uvs ?? (1 / this.tile(mat)), o.ao ?? 1);
    return this;
  }
  // مجسّم مكرّر (InstancedMesh) — protos تُعرّف في gfx
  put(proto, x, y, z, ry = 0, s = 1, sy) {
    if (!this.vis) return this;
    let L = this.inst.get(proto); if (!L) { L = []; this.inst.set(proto, L); }
    L.push([x, y, z, ry, s, sy ?? s]);
    return this;
  }
  light(x, y, z, color = 0xffb35a, intensity = 1, dist = 8) { if (this.vis) this.lights.push({ x, y, z, color, intensity, dist }); return this; }
  glow(x, y, z, size = 0.6, color = 0xffb04a) { if (this.vis) this.glows.push({ x, y, z, size, color }); return this; }
  spawn(team, x, y, z, yaw) { this.w.spawns[team].push([x, y, z, yaw]); return this; }
  // عقد الملاحة للبوتات
  node(x, y, z, tag) { this.navN.push([x, y, z, tag || '']); return this.navN.length - 1; }
  link(a, b) { this.navL.push([a, b]); return this; }
  chain(...pts) { let prev = -1; const ids = []; for (const p of pts) { const id = typeof p === 'number' ? p : this.node(p[0], p[1], p[2], p[3]); if (prev >= 0) this.link(prev, id); prev = id; ids.push(id); } return ids; }
  finish() {
    this.w.finalize();
    // إزاحة العقد الواقعة داخل الأجسام الصلبة
    for (const n of this.navN) {
      if (!this.w.overlap(n[0], n[1] + 0.05, n[2], 0.3, 1.2)) continue;
      let ok = false;
      for (const r of [0.6, 1.2, 1.8]) { for (let k = 0; k < 8 && !ok; k++) { const a = k / 8 * Math.PI * 2, x = n[0] + Math.cos(a) * r, z = n[2] + Math.sin(a) * r; if (!this.w.overlap(x, n[1] + 0.05, z, 0.3, 1.2)) { n[0] = x; n[2] = z; ok = true; } } if (ok) break; }
      if (!ok) n[3] = 'dead';
    }
    // ربط تلقائي لعقد الملاحة القريبة ذات خط الرؤية (يكمل الروابط اليدوية)
    const N = this.navN, adj = N.map(() => new Set());
    for (const [a, b] of this.navL) { adj[a].add(b); adj[b].add(a); }
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const a = N[i], b = N[j], d = Math.hypot(a[0] - b[0], a[2] - b[2]);
      if (d > 9 || Math.abs(a[1] - b[1]) > 0.6 || a[3] === 'dead' || b[3] === 'dead') continue;
      if (adj[i].has(j)) continue;
      // خط رؤية على ارتفاع الصدر والركبة
      if (this.w.los(a[0], a[1] + 1.0, a[2], b[0], b[1] + 1.0, b[2]) && this.w.los(a[0], a[1] + 0.35, a[2], b[0], b[1] + 0.35, b[2])) { adj[i].add(j); adj[j].add(i); }
    }
    this.w.nav = { nodes: N, adj: adj.map(s => [...s]) };
    return this.w;
  }
}
export { MAT, F };
