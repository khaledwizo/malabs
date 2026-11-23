// باني الخرائط: يسجّل صناديق التصادم دائماً، ويبني الرسوميات فقط عند توفّر المواد (في السيرفر لا رسوميات)
import { World, MAT, F } from './collide.js';

const MATCOL = {
  brick: MAT.brick, brickRed: MAT.brick, brickPale: MAT.brick, plaster: MAT.plaster, plasterOchre: MAT.plaster, plasterBlue: MAT.plaster, plasterWhite: MAT.plaster,
  stone: MAT.stone, marble: MAT.stone, paving: MAT.brick, sand: MAT.sand, mud: MAT.sand, roof: MAT.plaster, wood: MAT.wood, woodDark: MAT.wood, woodBlue: MAT.wood, woodGreen: MAT.wood,
  beam: MAT.wood, lattice: MAT.wood, latticeBlue: MAT.wood, tileTurq: MAT.tile, tileBlue: MAT.tile, tileGold: MAT.tile, carpet: MAT.cloth, carpet2: MAT.cloth, metal: MAT.metal, iron: MAT.metal,
  copper: MAT.metal, brass: MAT.metal, gold: MAT.metal, palm: MAT.wood, clothRed: MAT.cloth, clothCream: MAT.cloth, clothGreen: MAT.cloth, sack: MAT.cloth, glass: MAT.glass,
  brickBurnt: MAT.brick, plasterBurnt: MAT.plaster, charred: MAT.wood, rust: MAT.metal, tomb: MAT.stone, graveDirt: MAT.sand, grass: MAT.sand, tileGreen: MAT.tile,
  paintRed: MAT.metal, paintOrange: MAT.metal, gunmetal: MAT.metal, ammo: MAT.wood, olive: MAT.cloth, tan: MAT.cloth, clay: MAT.brick, deadwood: MAT.wood, bone: MAT.stone,
  leafGreen: MAT.cloth, leafDark: MAT.cloth, concrete: MAT.stone, rubber: MAT.cloth, chrome: MAT.metal, glassDark: MAT.glass, paintWhite: MAT.metal,
};

// رسوميات وهمية: السيرفر يبني الخريطة بنفس مسار اللعبة تماماً (نفس العشوائية ونفس الأجسام والأشخاص) دون رسم أي شيء
class NullBatch { get count() { return 0; } addGeo() { } vert() { return 0; } quad() { } }
export const NULL_GFX = { mats: {}, Batch: NullBatch, boxInto() { }, nul: true };

const ZH = {}; const zfE = (mat, k) => { let h = ZH[mat]; if (h === undefined) { h = 0; for (let i = 0; i < mat.length; i++) h = (h * 31 + mat.charCodeAt(i)) >>> 0; h = ZH[mat] = h % 5; } return 0.0014 * (1 + h) + 0.0011 * (k % 3); };
export class Builder {
  constructor(gfx) {
    this.w = new World();
    this.gfx = gfx || null; // { THREE, mats, Batch, boxInto, ... }
    this.batches = new Map(); this.meshes = []; this.inst = new Map(); this.lights = []; this.glows = []; this.water = []; this.anim = [];
    this.navN = []; this.navL = []; this.zones = []; this.cur = null; this.dyn = new Map();
    this.w.props = []; this.w.npcs = []; this.w.doors = []; this.w.usables = []; this.w.noFire = [];
  }
  // جسم قابل للكسر: كل ما يُبنى بعده (تصادم ورسم) يتبعه حتى end()
  prop(kind, hp) { const p = { id: this.w.props.length, kind, hp, boxes: [], c: null }; this.w.props.push(p); this.cur = p; return p.id; }
  end() { this.cur = null; }
  // باب يُفتح ويُغلق (axis: اتجاه لوح الباب x أو z، hinge: -1/1 جهة المفصلة، swing: جهة الفتح)
  door(o) {
    const t = 0.14, y = o.y || 0, d = { id: this.w.doors.length, x: o.x, y, z: o.z, axis: o.axis, w: o.w, h: o.h || 2.3, leaves: o.leaves || 1, swing: o.swing || 1, mat: o.mat || 'woodDark', name: o.name || '' };
    const [x0, z0, x1, z1] = o.axis === 'x' ? [o.x - o.w / 2, o.z - t / 2, o.x + o.w / 2, o.z + t / 2] : [o.x - t / 2, o.z - o.w / 2, o.x + t / 2, o.z + o.w / 2];
    d.box = this.w.add(x0, y, z0, x1, y + d.h, z1, MAT.wood, 0); d.bb = [x0, z0, x1, z1];
    this.w.doors.push(d); return d.id;
  }
  // مكان يُستعمل بزر «استعمال»: أكل اللبلبي وشرب الچاي بالمعركة
  usable(kind, x, z, r = 2.4) { this.w.usables.push({ id: this.w.usables.length, kind, x, z, r }); }
  // منطقة يُمنع فيها إطلاق النار ورمي القنابل (المرقد)
  noFire(x0, z0, x1, z1) { this.w.noFire.push([x0, z0, x1, z1]); }
  // شخص من أهل السوق: pose = sit | stand | pray ؛ kill: يمكن إصابته
  npc(o) { const n = { id: this.w.npcs.length, x: o.x, y: o.y || 0, z: o.z, yaw: o.yaw || 0, pose: o.pose || 'stand', kill: o.kill !== false, look: o.look || 'vendor', stool: o.stool !== false, seed: this.w.npcs.length * 7 + (o.seed || 3) }; const r = n.pose === 'sit' ? 0.3 : 0.24; n.box = this.w.add(n.x - r, n.y, n.z - r, n.x + r, n.y + (n.pose === 'sit' ? 1.25 : 1.75), n.z + r, 6, F.NOBULLET); this.w.npcs.push(n); return n.id; }
  get vis() { return !!this.gfx; }
  // شعاع أثناء البناء (قبل بناء شبكة التسريع): مسح خطّي لكل الصناديق المضافة حتى الآن — يعيد مسافة أول اصطدام
  rayBuild(ox, oy, oz, dx, dy, dz, maxT) {
    const b = this.w.b, n = this.w.mat.length; let best = maxT;
    for (let i = 0; i < n; i++) {
      if (this.w.flags[i] & (F.NOBULLET | F.NOPLAYER)) continue;
      const o = i * 6; let tmin = 0, tmax = best, ok = true;
      for (let a = 0; a < 3 && ok; a++) { const p = a === 0 ? ox : a === 1 ? oy : oz, d = a === 0 ? dx : a === 1 ? dy : dz; if (Math.abs(d) < 1e-9) { if (p < b[o + a] || p > b[o + 3 + a]) ok = false; continue; } let t1 = (b[o + a] - p) / d, t2 = (b[o + 3 + a] - p) / d; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) ok = false; }
      if (ok && tmin < best) best = tmin;
    }
    return best;
  }
  batch(mat) {
    const key = this.cur ? mat + '#d' : mat;
    let b = this.batches.get(key);
    if (!b) { b = new this.gfx.Batch(); this.batches.set(key, b); }
    return b;
  }
  // يسجّل مدى رؤوس الجسم القابل للكسر داخل دفعته (لإخفائه عند تحطمه)
  track(mat, fn) {
    if (!this.cur) { fn(); return; }
    const key = mat + '#d', bt = this.batch(mat), s0 = bt.count; fn();
    let L = this.dyn.get(key); if (!L) { L = []; this.dyn.set(key, L); }
    const last = L[L.length - 1];
    if (last && last[0] === this.cur.id && last[2] === s0) last[2] = bt.count; else L.push([this.cur.id, s0, bt.count]); // دمج الأجزاء المتتالية
  }
  tile(mat) { const m = this.gfx.mats[mat]; return m ? m.tile : 1; }
  // صندوق بإحداثيات الزوايا
  box(x0, y0, z0, x1, y1, z1, mat, o = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
    if (o.col !== false) { const i = this.w.add(x0, y0, z0, x1, y1, z1, o.cm ?? MATCOL[mat] ?? 0, o.flags || 0); if (this.cur && i >= 0) this.cur.boxes.push(i); }
    // ضد الوميض (z-fighting): نكبّر الصندوق المرئي بملّيمترات تختلف حسب المادّة وترتيب الصندوق،
    // حتى ما يتطابق وجهان على نفس المستوى (التصادم ما يتأثر)
    if (this.vis && o.vis !== false && mat && !o.exact) { const e = zfE(mat, this.zc = (this.zc || 0) + 1); x0 -= e; z0 -= e; x1 += e; z1 += e; y1 += e; if (y0 > 0.01) y0 -= e; }
    if (this.vis && o.vis !== false && mat) this.track(mat, () => this.gfx.boxInto(this.batch(mat), x0, y0, z0, x1, y1, z1, o.tile || this.tile(mat), o.faces || 'pxnxpynypznz', o.ao === undefined ? (y0 < 0.2 ? y0 : null) : o.ao, o.uo || 0, o.vo || 0));
    return this;
  }
  // صندوق بمركز أفقي وقاعدة سفلية
  boxB(cx, y0, cz, sx, sy, sz, mat, o) { return this.box(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2, mat, o); }
  col(x0, y0, z0, x1, y1, z1, cm = MAT.stone, flags = 0) { const i = this.w.add(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), cm, flags); if (this.cur && i >= 0) this.cur.boxes.push(i); return this; }
  // هندسة three مع مصفوفة (بلا تصادم إلا إذا طُلب)
  geo(geoFn, matrix, mat, o = {}) {
    if (!this.vis || this.gfx.nul) return this;
    const g = typeof geoFn === 'function' ? geoFn() : geoFn;
    this.track(mat, () => this.batch(mat).addGeo(g, matrix, o.uvs ?? (1 / this.tile(mat)), o.ao ?? 1));
    return this;
  }
  // مجسّم مكرّر (InstancedMesh) — protos تُعرّف في gfx
  // ملصق أرضي من أطلس التفاصيل (tile -1 = كامل القوام، مثل البرك)
  decal(x, z, w, h, rot = 0, tile = 0, y = 0.012, mat = 'decal') {
    if (!this.vis || this.gfx.nul) return this;
    const bt = this.batches.get(mat) || (this.batches.set(mat, new this.gfx.Batch()), this.batches.get(mat));
    const c = Math.cos(rot), s = Math.sin(rot), full = tile < 0, tu = full ? 0 : (tile % 4) / 4, tv = full ? 0 : 1 - (Math.floor(tile / 4) + 1) / 4, k = full ? 1 : 0.25;
    const ids = [[-w / 2, -h / 2, 0, 0], [w / 2, -h / 2, 1, 0], [w / 2, h / 2, 1, 1], [-w / 2, h / 2, 0, 1]].map(([a, b, u, v]) => bt.vert(x + a * c - b * s, y, z + a * s + b * c, 0, 1, 0, tu + u * k, tv + v * k, 1));
    bt.quad(ids[0], ids[3], ids[2], ids[1]);
    return this;
  }
  put(proto, x, y, z, ry = 0, s = 1, sy) {
    if (!this.vis) return this;
    let L = this.inst.get(proto); if (!L) { L = []; this.inst.set(proto, L); }
    L.push([x, y, z, ry, s, sy ?? s]);
    return this;
  }
  // fl: وميض (0 ثابت، 1 يرتجف كمصباح معطوب)
  light(x, y, z, color = 0xffb35a, intensity = 1, dist = 8, fl = 0) { if (this.vis) this.lights.push({ x, y, z, color, intensity, dist, fl }); return this; }
  glow(x, y, z, size = 0.6, color = 0xffb04a, fl = 0) { if (this.vis) this.glows.push({ x, y, z, size, color, fl }); return this; }
  spawn(team, x, y, z, yaw) { this.w.spawns[team].push([x, y, z, yaw]); return this; }
  // عقد الملاحة للبوتات
  node(x, y, z, tag) { this.navN.push([x, y, z, tag || '']); return this.navN.length - 1; }
  link(a, b) { this.navL.push([a, b]); return this; }
  chain(...pts) { let prev = -1; const ids = []; for (const p of pts) { const id = typeof p === 'number' ? p : this.node(p[0], p[1], p[2], p[3]); if (prev >= 0) this.link(prev, id); prev = id; ids.push(id); } return ids; }
  finish() {
    this.w.finalize();
    // فهرس سريع: أي صندوق تصادم يتبع أي جسم قابل للكسر + مركز كل جسم
    const pof = this.w.propOf = new Int32Array(this.w.mat.length).fill(-1);
    for (const p of this.w.props) {
      let x = 0, y = 0, z = 0;
      for (const i of p.boxes) { pof[i] = p.id; const o = i * 6, b = this.w.b; x += (b[o] + b[o + 3]) / 2; y += (b[o + 1] + b[o + 4]) / 2; z += (b[o + 2] + b[o + 5]) / 2; }
      const n = Math.max(1, p.boxes.length); p.c = [x / n, y / n, z / n];
    }
    // الأبواب تُحسب مفتوحة عند بناء الملاحة (البوت يفتحها إذا وصلها)
    for (const d of this.w.doors) this.w.disable(d.box);
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
      // ثلاثة خطوط متوازية بعرض الجسد كي لا يعلق البوت بحافة صندوق أو عمود
      const ox = -(b[2] - a[2]) / Math.max(d, 1e-3) * 0.34, oz = (b[0] - a[0]) / Math.max(d, 1e-3) * 0.34;
      let ok = true;
      for (const k of [0, -1, 1]) { for (const hh of [1.0, 0.7, 0.35]) if (!this.w.los(a[0] + ox * k, a[1] + hh, a[2] + oz * k, b[0] + ox * k, b[1] + hh, b[2] + oz * k)) { ok = false; break; } if (!ok) break; }
      // روابط الأسطح والطوابق: يجب أن تكون تحتها أرض متصلة (لا فجوات درج أو فراغ)
      if (ok && (a[1] > 0.5 || b[1] > 0.5)) for (let t = 0.1; t < 0.95 && ok; t += 0.5 / Math.max(d, 0.5)) { const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t; const h = this.w.ray(x, y + 0.45, z, 0, -1, 0, 1.2, F.NOPLAYER, {}); if (!h) ok = false; }
      // لا روابط تمرّ عبر أجساد أهل السوق
      if (ok) for (const q of this.w.npcs) { const ux = b[0] - a[0], uz = b[2] - a[2], t = Math.max(0, Math.min(1, ((q.x - a[0]) * ux + (q.z - a[2]) * uz) / (d * d))); if (Math.hypot(a[0] + ux * t - q.x, a[2] + uz * t - q.z) < 0.62) { ok = false; break; } }
      if (ok) { adj[i].add(j); adj[j].add(i); }
    }
    this.w.nav = { nodes: N, adj: adj.map(s => [...s]) };
    for (const d of this.w.doors) this.w.restore(d.box);
    return this.w;
  }
}
export { MAT, F };
