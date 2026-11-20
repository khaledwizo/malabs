// عالم التصادم: صناديق محاذية للمحاور + شبكة تسريع، تتبّع الأشعة، وتحريك الأجسام مع صعود الدرج
// (رياضيات خالصة بلا رسوميات — يعمل في المتصفح وفي تطبيق السيرفر)

export const MAT = { stone: 0, brick: 1, wood: 2, metal: 3, plaster: 4, sand: 5, cloth: 6, tile: 7, water: 8, glass: 9 };
export const F = { THIN: 1, NOBULLET: 2, NOPLAYER: 4, LADDER: 8 };

export class World {
  constructor() {
    this.b = []; // [minx,miny,minz,maxx,maxy,maxz]
    this.mat = []; this.flags = [];
    this.cell = 4; this.grid = null; this.stamp = null; this.st = 1;
    this.bounds = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    this.spawns = [[], []]; this.nav = null; this.name = '';
  }
  add(minx, miny, minz, maxx, maxy, maxz, mat = 0, flags = 0) {
    if (maxx - minx < 1e-4 || maxy - miny < 1e-4 || maxz - minz < 1e-4) return -1;
    this.b.push(minx, miny, minz, maxx, maxy, maxz); this.mat.push(mat); this.flags.push(flags);
    const B = this.bounds;
    B[0] = Math.min(B[0], minx); B[1] = Math.min(B[1], miny); B[2] = Math.min(B[2], minz);
    B[3] = Math.max(B[3], maxx); B[4] = Math.max(B[4], maxy); B[5] = Math.max(B[5], maxz);
    return this.mat.length - 1;
  }
  finalize() {
    const B = this.bounds, c = this.cell;
    this.ox = Math.floor(B[0] / c) - 1; this.oz = Math.floor(B[2] / c) - 1;
    this.gw = Math.ceil(B[3] / c) - this.ox + 2; this.gh = Math.ceil(B[5] / c) - this.oz + 2;
    const g = this.grid = new Array(this.gw * this.gh);
    for (let i = 0; i < g.length; i++) g[i] = [];
    const n = this.mat.length;
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      const x0 = Math.floor(this.b[o] / c) - this.ox, x1 = Math.floor(this.b[o + 3] / c) - this.ox;
      const z0 = Math.floor(this.b[o + 2] / c) - this.oz, z1 = Math.floor(this.b[o + 5] / c) - this.oz;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z * this.gw + x].push(i);
    }
    this.stamp = new Uint32Array(n);
    this.bf = new Float32Array(this.b);
  }
  // يمرّ على الصناديق المتقاطعة مع مستطيل XZ
  query(minx, minz, maxx, maxz, fn) {
    const c = this.cell, st = ++this.st;
    const x0 = Math.max(0, Math.floor(minx / c) - this.ox), x1 = Math.min(this.gw - 1, Math.floor(maxx / c) - this.ox);
    const z0 = Math.max(0, Math.floor(minz / c) - this.oz), z1 = Math.min(this.gh - 1, Math.floor(maxz / c) - this.oz);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const L = this.grid[z * this.gw + x];
      for (let k = 0; k < L.length; k++) { const i = L[k]; if (this.stamp[i] === st) continue; this.stamp[i] = st; if (fn(i) === true) return true; }
    }
    return false;
  }
  // هل يتقاطع صندوق الجسم مع العالم؟
  overlap(px, py, pz, r, h, ignoreFlags = F.NOPLAYER) {
    const b = this.bf, e = 1e-4;
    return this.query(px - r, pz - r, px + r, pz + r, i => {
      if (this.flags[i] & ignoreFlags) return false;
      const o = i * 6;
      return b[o] < px + r - e && b[o + 3] > px - r + e && b[o + 1] < py + h - e && b[o + 4] > py + e && b[o + 2] < pz + r - e && b[o + 5] > pz - r + e;
    });
  }
  // تحريك جسم (قدماه عند pos) بسرعة vel خلال dt، مع انزلاق على الجدران وصعود درجات حتى stepH
  move(pos, vel, dt, r, h, stepH, onGround) {
    const res = { ground: false, hitX: false, hitZ: false, ceil: false, stepped: 0 };
    const b = this.bf, e = 1e-3;
    for (const ax of [0, 2]) {
      let d = vel[ax] * dt; if (Math.abs(d) < 1e-7) continue;
      // خطوات صغيرة كي لا يخترق الجدران الرقيقة عند السرعات العالية
      const steps = Math.ceil(Math.abs(d) / (r * 0.9));
      d /= steps;
      for (let s = 0; s < steps; s++) {
        pos[ax] += d;
        let blocked = false, stepTo = -1;
        const px = pos[0], py = pos[1], pz = pos[2];
        this.query(px - r, pz - r, px + r, pz + r, i => {
          if (this.flags[i] & F.NOPLAYER) return false;
          const o = i * 6;
          if (!(b[o] < px + r - e && b[o + 3] > px - r + e && b[o + 1] < py + h - e && b[o + 4] > py + e && b[o + 2] < pz + r - e && b[o + 5] > pz - r + e)) return false;
          const top = b[o + 4];
          if (onGround && top - py <= stepH && top > py) { stepTo = Math.max(stepTo, top); return false; }
          blocked = true;
          if (d > 0) pos[ax] = Math.min(pos[ax], b[o + ax] - r - e); else pos[ax] = Math.max(pos[ax], b[o + 3 + ax] + r + e);
          return false;
        });
        if (!blocked && stepTo > 0) {
          if (!this.overlap(pos[0], stepTo + e, pos[2], r, h)) { res.stepped += stepTo + e - pos[1]; pos[1] = stepTo + e; }
          else { pos[ax] -= d; blocked = true; }
        }
        if (blocked) { vel[ax] = 0; if (ax === 0) res.hitX = true; else res.hitZ = true; break; }
      }
    }
    // المحور الرأسي
    let dy = vel[1] * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(dy) / 0.3)); dy /= steps;
    for (let s = 0; s < steps; s++) {
      pos[1] += dy;
      const px = pos[0], py = pos[1], pz = pos[2];
      let hit = false;
      this.query(px - r, pz - r, px + r, pz + r, i => {
        if (this.flags[i] & F.NOPLAYER) return false;
        const o = i * 6;
        if (!(b[o] < px + r - e && b[o + 3] > px - r + e && b[o + 1] < py + h - e && b[o + 4] > py + e && b[o + 2] < pz + r - e && b[o + 5] > pz - r + e)) return false;
        hit = true;
        if (dy <= 0) { pos[1] = Math.max(pos[1], b[o + 4] + e); res.ground = true; }
        else { pos[1] = Math.min(pos[1], b[o + 1] - h - e); res.ceil = true; }
        return false;
      });
      if (hit) { vel[1] = 0; break; }
    }
    // التصاق بالأرض (للنزول على الدرج دون قفزات)
    if (!res.ground && onGround && vel[1] <= 0) {
      const snap = this.groundBelow(pos[0], pos[1], pos[2], r, stepH + 0.05);
      if (snap !== null) { pos[1] = snap + e; res.ground = true; vel[1] = 0; }
    }
    if (!res.ground && vel[1] <= 0 && this.groundBelow(pos[0], pos[1], pos[2], r, 0.01) !== null) res.ground = true;
    return res;
  }
  // أعلى سطح تحت القدمين ضمن مسافة maxD
  groundBelow(px, py, pz, r, maxD) {
    const b = this.bf; let best = null; const e = 1e-3;
    this.query(px - r, pz - r, px + r, pz + r, i => {
      if (this.flags[i] & F.NOPLAYER) return false;
      const o = i * 6;
      if (!(b[o] < px + r - e && b[o + 3] > px - r + e && b[o + 2] < pz + r - e && b[o + 5] > pz - r + e)) return false;
      const top = b[o + 4];
      if (top <= py + e * 2 && top >= py - maxD && (best === null || top > best)) best = top;
      return false;
    });
    return best;
  }
  // تتبّع شعاع: يعيد أقرب اصطدام {t, nx, ny, nz, i}
  ray(ox, oy, oz, dx, dy, dz, maxT, skipFlags = F.NOBULLET, out = {}) {
    const c = this.cell, b = this.bf, st = ++this.st;
    let best = maxT, bi = -1, bn = 0;
    const idx = 1 / (dx || 1e-12), idy = 1 / (dy || 1e-12), idz = 1 / (dz || 1e-12);
    const test = i => {
      if (this.stamp[i] === st) return; this.stamp[i] = st;
      if (this.flags[i] & skipFlags) return;
      const o = i * 6;
      let t1 = (b[o] - ox) * idx, t2 = (b[o + 3] - ox) * idx, tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
      t1 = (b[o + 1] - oy) * idy; t2 = (b[o + 4] - oy) * idy; let a = Math.min(t1, t2), bb = Math.max(t1, t2);
      if (a > tmin) { tmin = a; ax = 1; } if (bb < tmax) tmax = bb;
      t1 = (b[o + 2] - oz) * idz; t2 = (b[o + 5] - oz) * idz; a = Math.min(t1, t2); bb = Math.max(t1, t2);
      if (a > tmin) { tmin = a; ax = 2; } if (bb < tmax) tmax = bb;
      if (tmax < Math.max(tmin, 0) || tmin > best) return;
      if (tmin < 0) return; // البداية داخل الصندوق
      best = tmin; bi = i; bn = ax;
    };
    // DDA على شبكة XZ
    let cx = Math.floor(ox / c) - this.ox, cz = Math.floor(oz / c) - this.oz;
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(c * idx), tdz = Math.abs(c * idz);
    let tmx = dx !== 0 ? ((Math.floor(ox / c) + (dx > 0 ? 1 : 0)) * c - ox) * idx : 1e12;
    let tmz = dz !== 0 ? ((Math.floor(oz / c) + (dz > 0 ? 1 : 0)) * c - oz) * idz : 1e12;
    let t = 0;
    for (let k = 0; k < 400 && t <= best; k++) {
      if (cx >= 0 && cz >= 0 && cx < this.gw && cz < this.gh) { const L = this.grid[cz * this.gw + cx]; for (let j = 0; j < L.length; j++) test(L[j]); }
      else if ((cx < 0 && sx < 0) || (cz < 0 && sz < 0) || (cx >= this.gw && sx > 0) || (cz >= this.gh && sz > 0)) break;
      if (tmx < tmz) { t = tmx; tmx += tdx; cx += sx; } else { t = tmz; tmz += tdz; cz += sz; }
    }
    if (bi < 0) return null;
    out.t = best; out.i = bi; out.mat = this.mat[bi]; out.flags = this.flags[bi];
    out.nx = bn === 0 ? -Math.sign(dx) : 0; out.ny = bn === 1 ? -Math.sign(dy) : 0; out.nz = bn === 2 ? -Math.sign(dz) : 0;
    out.x = ox + dx * best; out.y = oy + dy * best; out.z = oz + dz * best;
    return out;
  }
  // سماكة الصندوق على امتداد الشعاع (للاختراق)
  thickness(i, x, y, z, dx, dy, dz) {
    const o = i * 6, b = this.bf; let tmax = 1e9;
    for (let a = 0; a < 3; a++) { const d = a === 0 ? dx : a === 1 ? dy : dz, p = a === 0 ? x : a === 1 ? y : z; if (Math.abs(d) < 1e-9) continue; const t = ((d > 0 ? b[o + 3 + a] : b[o + a]) - p) / d; if (t < tmax) tmax = t; }
    return Math.max(0, tmax);
  }
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz);
    if (L < 1e-6) return true;
    return !this.ray(ax, ay, az, dx / L, dy / L, dz / L, L - 0.05, F.NOBULLET);
  }
}

// تقاطع شعاع مع كرة/صندوق (لصناديق الإصابة عند اللاعبين)
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz, tc = lx * dx + ly * dy + lz * dz;
  if (tc < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc; if (d2 > r * r) return -1;
  return tc - Math.sqrt(r * r - d2);
}
export function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = -1e9, tmax = 1e9;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) return -1; continue; }
    let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a]; if (t1 > t2) { const k = t1; t1 = t2; t2 = k; }
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1;
  }
  return tmax < 0 ? -1 : Math.max(0, tmin);
}
