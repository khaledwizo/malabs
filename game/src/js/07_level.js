// ===================== المستوى: الشبكة، الرؤية، البحث عن المسار، المنطق، الليزر =====================
const DEFAULT_LEGEND = {
  '@': { t: 'start' }, 'X': { t: 'exit' }, '$': { t: 'core' }, '%': { t: 'energy' }, '+': { t: 'health' },
  '^': { t: 'checkpoint' }, '=': { t: 'box' }, '~': { t: 'hazard' }, '!': { t: 'chip' }, '?': { t: 'memory' },
  '*': { t: 'lamp' }, '&': { t: 'captive' }, ':': { t: 'spawn' },
  '§': { t: 'tablet' }, ',': { t: 'shard' }, '¥': { t: 'npc', id: 'fanous' },
};

class Wire {
  constructor(src, dst, L, k) {
    this.src = src; this.dst = dst;
    const off = ((k % 3) - 1) * 3;
    const sx = src.x + off, sy = src.y + off, tx = dst.x + off, ty = dst.y + off;
    // نختار شكل L الذي يعبر جدراناً أقل
    const cost = (ax, ay, bx, by) => {
      let c = 0; const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (T * 0.5));
      for (let i = 0; i <= n; i++) { const x = lerp(ax, bx, i / n), y = lerp(ay, by, i / n); const tx2 = Math.floor(x / T), ty2 = Math.floor(y / T); if (!L.inb(tx2, ty2) || L.tile[L.idx(tx2, ty2)] !== 0) c++; }
      return c;
    };
    const cH = cost(sx, sy, tx, sy) + cost(tx, sy, tx, ty);
    const cV = cost(sx, sy, sx, ty) + cost(sx, ty, tx, ty);
    this.pts = cH <= cV ? [sx, sy, tx, sy, tx, ty] : [sx, sy, sx, ty, tx, ty];
    this.len = Math.abs(this.pts[2] - this.pts[0]) + Math.abs(this.pts[3] - this.pts[1]) + Math.abs(this.pts[4] - this.pts[2]) + Math.abs(this.pts[5] - this.pts[3]);
  }
  get on() { return !!this.src.val; }
}

class Level {
  constructor(def, index) {
    this.def = def; this.index = index;
    const rows = def.map;
    this.h = rows.length; this.w = 0;
    for (const r of rows) this.w = Math.max(this.w, r.length);
    const N = this.N = this.w * this.h;
    this.tile = new Uint8Array(N);
    this.solidAt = new Array(N).fill(null);
    this.floorAt = new Array(N).fill(null);
    this.sight = new Uint8Array(N); this.move = new Uint8Array(N); this.fly = new Uint8Array(N);
    this.lgrid = new Uint8Array(N); this.lit = new Float32Array(N); this.explored = new Uint8Array(N);
    this.decor = new Uint8Array(N); this.heat = new Float32Array(N);
    this.objects = []; this.nodes = new Map(); this.gates = []; this.order = [];
    this.waypoints = {}; this.lamps = []; this.doors = []; this.boxes = []; this.switches = []; this.plates = [];
    this.terminals = []; this.riddles = []; this.emitters = []; this.mirrors = []; this.receivers = []; this.hazards = [];
    this.pickups = []; this.captives = []; this.checkpoints = []; this.spawns = []; this.pylons = []; this.wires = [];
    this.enemySpecs = []; this.start = { x: T * 1.5, y: T * 1.5 }; this.exit = null;
    this.navVersion = 1; this.lampsDirty = true; this.litDirty = true; this.litTimer = 0;
    this.ambient = def.ambient || '#1b2030';
    this.g = new Float32Array(N); this.par = new Int32Array(N); this.seen = new Uint32Array(N); this.closed = new Uint32Array(N);
    this.stamp = 0; this.heap = new MinHeap(512); this.q = new Int32Array(N);
    this.parse();
  }
  idx(tx, ty) { return ty * this.w + tx; }
  inb(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  tileOf(x) { return Math.floor(x / T); }
  parse() {
    const legend = Object.assign({}, DEFAULT_LEGEND, this.def.legend || {});
    const rnd = mulberry32(1234 + this.index * 977);
    for (let y = 0; y < this.h; y++) {
      const row = this.def.map[y];
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] || ' ';
        const i = this.idx(x, y);
        this.decor[i] = (rnd() * 256) | 0;
        if (ch === '#') { this.tile[i] = 1; continue; }
        if (ch === ' ') { this.tile[i] = 2; continue; }
        this.tile[i] = 0;
        if (ch === '.') continue;
        let spec = legend[ch];
        if (!spec && ch >= 'a' && ch <= 'z') spec = { t: 'wp' };
        if (!spec) { console.warn('رمز غير معروف في الخريطة', ch, x, y); continue; }
        this.spawnObject(spec, x, y, ch);
      }
    }
    for (const c of (this.def.consts || [])) this.nodes.set(c.id, { id: c.id, val: !!c.v, type: 'const', x: 0, y: 0, noWireOut: true });
    for (const o of this.objects) if (o.inputs) for (const id of o.inputs) if (!this.nodes.has(id)) console.warn('عقدة غير موجودة', id, 'في', o.type);
    this.groupDoors();
    this.buildWires();
    this.topo();
    this.rebuild();
  }
  spawnObject(spec, x, y, ch) {
    const i = this.idx(x, y);
    let o = null;
    switch (spec.t) {
      case 'start': this.start = { x: (x + 0.5) * T, y: (y + 0.5) * T }; return;
      case 'wp': this.waypoints[ch] = { x: (x + 0.5) * T, y: (y + 0.5) * T }; return;
      case 'spawn': this.spawns.push({ x: (x + 0.5) * T, y: (y + 0.5) * T }); return;
      case 'lamp': this.lamps.push(new Lamp(this, x, y, spec)); return;
      case 'drone': case 'turret': case 'nest': case 'hunter': case 'boss': this.enemySpecs.push({ spec, x, y }); return;
      case 'exit': o = this.exit = new Exit(this, x, y, spec); break;
      case 'core': case 'energy': case 'health': case 'chip': case 'memory': case 'shard': case 'charm': o = new Pickup(this, x, y, spec); this.pickups.push(o); break;
      case 'tablet': o = new Tablet(this, x, y, spec); break;
      case 'npc': o = new Npc(this, x, y, spec); break;
      case 'checkpoint': o = new Checkpoint(this, x, y, spec); this.checkpoints.push(o); break;
      case 'box': o = new Box(this, x, y, spec); this.boxes.push(o); break;
      case 'hazard': o = new Hazard(this, x, y, spec); this.hazards.push(o); break;
      case 'captive': o = new Captive(this, x, y, spec); this.captives.push(o); break;
      case 'switch': o = new Switch(this, x, y, spec); this.switches.push(o); break;
      case 'plate': o = new Plate(this, x, y, spec); this.plates.push(o); break;
      case 'gate': o = new Gate(this, x, y, spec); this.gates.push(o); break;
      case 'door': o = new Door(this, x, y, spec); this.doors.push(o); break;
      case 'terminal': o = new Terminal(this, x, y, spec); this.terminals.push(o); break;
      case 'riddle': o = new RiddleGate(this, x, y, spec); this.riddles.push(o); break;
      case 'emitter': o = new Emitter(this, x, y, spec); this.emitters.push(o); break;
      case 'mirror': o = new Mirror(this, x, y, spec); this.mirrors.push(o); break;
      case 'receiver': o = new Receiver(this, x, y, spec); this.receivers.push(o); break;
      case 'pylon': o = new Pylon(this, x, y, spec); this.pylons.push(o); break;
      default: console.warn('نوع غير معروف', spec.t); return;
    }
    this.objects.push(o);
    if (o.layer === 'solid') this.solidAt[i] = o; else this.floorAt[i] = o;
    if (o.nodeId) this.nodes.set(o.nodeId, o);
  }
  // الأبواب المتجاورة ذات المدخل نفسه تُرسم بسلك واحد
  groupDoors() {
    const byKey = new Map();
    for (const d of this.doors) { const k = (d.inputs || []).join(',') + (d.inv ? '!' : ''); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(d); }
    for (const list of byKey.values()) {
      const seen = new Set();
      for (const d of list) {
        if (seen.has(d)) continue;
        const group = [d]; seen.add(d);
        for (let gi = 0; gi < group.length; gi++) {
          const a = group[gi];
          for (const b of list) if (!seen.has(b) && Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty) === 1) { seen.add(b); group.push(b); }
        }
        for (let gi = 1; gi < group.length; gi++) group[gi].noWire = true;
      }
    }
  }
  buildWires() {
    this.wires = []; let k = 0;
    for (const c of this.objects) {
      if (!c.inputs || c.noWire) continue;
      for (const id of c.inputs) {
        const s = this.nodes.get(id);
        if (!s || s.noWireOut) continue;
        this.wires.push(new Wire(s, c, this, k++));
      }
    }
  }
  topo() {
    const gates = this.gates, indeg = new Map(), adj = new Map();
    for (const g of gates) { indeg.set(g, 0); adj.set(g, []); }
    for (const g of gates) for (const id of g.inputs) {
      const n = this.nodes.get(id);
      if (n && n.type === 'gate') { indeg.set(g, indeg.get(g) + 1); adj.get(n).push(g); }
    }
    const q = gates.filter(g => indeg.get(g) === 0), order = [];
    while (q.length) {
      const g = q.shift(); order.push(g);
      for (const m of adj.get(g)) { indeg.set(m, indeg.get(m) - 1); if (indeg.get(m) === 0) q.push(m); }
    }
    for (const g of gates) if (!order.includes(g)) { console.warn('حلقة منطقية'); order.push(g); }
    this.order = order;
  }
  nodeVal(id) { const n = this.nodes.get(id); return n ? !!n.val : false; }
  evalLogic(dt) { for (let i = 0; i < this.order.length; i++) this.order[i].compute(this, dt); }
  // ---------- الشبكات ----------
  cellUpdate(i) {
    if (this.tile[i] !== 0) { this.sight[i] = 1; this.move[i] = 1; this.fly[i] = 1; return; }
    const o = this.solidAt[i];
    if (!o) { this.sight[i] = 0; this.move[i] = 0; this.fly[i] = 0; return; }
    const s = o.isSolid();
    this.move[i] = s ? 1 : 0;
    this.fly[i] = s && o.type !== 'box' ? 1 : 0;
    this.sight[i] = o.blocksSight() ? 1 : 0;
  }
  rebuild() { for (let i = 0; i < this.N; i++) this.cellUpdate(i); this.changed(); }
  changed() { this.navVersion++; this.lampsDirty = true; this.litDirty = true; }
  cellChanged(tx, ty) { this.cellUpdate(this.idx(tx, ty)); this.changed(); }
  solidAtW(x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); return !this.inb(tx, ty) || this.move[this.idx(tx, ty)] === 1; }
  // ---------- الأشعة (DDA) ----------
  ray(ox, oy, dx, dy, maxD, grid = this.sight) {
    const w = this.w, h = this.h;
    const x = ox / T, y = oy / T;
    let mx = Math.floor(x), my = Math.floor(y);
    const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx), ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
    let sx, sy, tx, ty;
    if (dx < 0) { sx = -1; tx = (x - mx) * ddx; } else { sx = 1; tx = (mx + 1 - x) * ddx; }
    if (dy < 0) { sy = -1; ty = (y - my) * ddy; } else { sy = 1; ty = (my + 1 - y) * ddy; }
    const md = maxD / T;
    let d = 0;
    for (let n = 0; n < 600; n++) {
      if (tx < ty) { d = tx; tx += ddx; mx += sx; } else { d = ty; ty += ddy; my += sy; }
      if (d >= md) return maxD;
      if (mx < 0 || my < 0 || mx >= w || my >= h) return d * T;
      if (grid[my * w + mx]) return d * T;
    }
    return maxD;
  }
  los(x0, y0, x1, y1, grid = this.sight) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < 1) return true;
    return this.ray(x0, y0, (x1 - x0) / d, (y1 - y0) / d, d, grid) >= d - 0.5;
  }
  // مضلع رؤية من نقطة (out: Float32Array بطول 2n على الأقل)
  castPoly(ox, oy, radius, a0, a1, n, out, full) {
    const step = full ? (a1 - a0) / n : (a1 - a0) / (n - 1);
    for (let i = 0; i < n; i++) {
      const a = a0 + step * i, dx = Math.cos(a), dy = Math.sin(a);
      const d = this.ray(ox, oy, dx, dy, radius);
      out[i * 2] = ox + dx * d; out[i * 2 + 1] = oy + dy * d;
    }
    return n;
  }
  // ---------- البحث عن المسار A* ----------
  nearestFree(i, grid) {
    if (!grid[i]) return i;
    const w = this.w, cx = i % w, cy = (i / w) | 0;
    for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (this.inb(x, y) && !grid[y * w + x]) return y * w + x;
    }
    return -1;
  }
  findPath(sxw, syw, txw, tyw, grid = this.move, avoidLaser = true, maxExpand = 6000) {
    const w = this.w, h = this.h;
    let s = this.idx(clamp(Math.floor(sxw / T), 0, w - 1), clamp(Math.floor(syw / T), 0, h - 1));
    let t = this.idx(clamp(Math.floor(txw / T), 0, w - 1), clamp(Math.floor(tyw / T), 0, h - 1));
    const tFree = !grid[t];
    if (!tFree) { t = this.nearestFree(t, grid); if (t < 0) return null; }
    if (grid[s]) { const s2 = this.nearestFree(s, grid); if (s2 >= 0) s = s2; }
    if (s === t) return [tFree ? txw : (t % w + 0.5) * T, tFree ? tyw : (((t / w) | 0) + 0.5) * T];
    const g = this.g, par = this.par, seen = this.seen, closed = this.closed, heap = this.heap;
    const stamp = ++this.stamp;
    const tx = t % w, ty = (t / w) | 0;
    const H = i => { const dx = Math.abs(i % w - tx), dy = Math.abs(((i / w) | 0) - ty); return dx + dy - 0.5858 * Math.min(dx, dy); };
    heap.clear(); g[s] = 0; seen[s] = stamp; par[s] = -1; heap.push(s, H(s));
    let found = false, expanded = 0;
    while (heap.n) {
      const cur = heap.pop();
      if (cur === t) { found = true; break; }
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      if (++expanded > maxExpand) break;
      const cx = cur % w, cy = (cur / w) | 0, gc = g[cur];
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX8[k], ny = cy + DY8[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (grid[ni] || closed[ni] === stamp) continue;
        if (k >= 4 && (grid[cy * w + nx] || grid[ny * w + cx])) continue;
        let cost = k >= 4 ? 1.4142 : 1;
        if (avoidLaser && this.lgrid[ni]) cost += 40;
        const ng = gc + cost;
        if (seen[ni] !== stamp || ng < g[ni]) { seen[ni] = stamp; g[ni] = ng; par[ni] = cur; heap.push(ni, ng + H(ni)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = t; c !== -1; c = par[c]) cells.push(c);
    cells.reverse();
    // تنعيم المسار (سحب الخيط)
    const pts = [];
    let ax = sxw, ay = syw, i = 1;
    const cxOf = c => (c % w + 0.5) * T, cyOf = c => (((c / w) | 0) + 0.5) * T;
    while (i < cells.length) {
      let j = cells.length - 1;
      for (; j > i; j--) if (this.walkLine(ax, ay, cxOf(cells[j]), cyOf(cells[j]), grid, T * 0.32)) break;
      const c = cells[j];
      ax = cxOf(c); ay = cyOf(c);
      pts.push(ax, ay);
      i = j + 1;
    }
    if (tFree && pts.length) { pts[pts.length - 2] = txw; pts[pts.length - 1] = tyw; }
    return pts;
  }
  walkLine(ax, ay, bx, by, grid, r) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    if (L < 1) return true;
    const nx = -dy / L * r, ny = dx / L * r, n = Math.ceil(L / (T * 0.25)), w = this.w;
    for (let i = 0; i <= n; i++) {
      const x = ax + dx * i / n, y = ay + dy * i / n;
      for (let s = -1; s <= 1; s++) {
        const tx = Math.floor((x + nx * s) / T), ty = Math.floor((y + ny * s) / T);
        if (tx < 0 || ty < 0 || tx >= w || ty >= this.h || grid[ty * w + tx]) return false;
      }
    }
    return true;
  }
  // حقل تدفّق (BFS) يستخدمه السرب
  flow(txw, tyw, grid, maxSteps, out) {
    out.fill(-1);
    const w = this.w, h = this.h;
    let s = this.idx(clamp(Math.floor(txw / T), 0, w - 1), clamp(Math.floor(tyw / T), 0, h - 1));
    if (grid[s]) { s = this.nearestFree(s, grid); if (s < 0) return; }
    const q = this.q; let head = 0, tail = 0;
    q[tail++] = s; out[s] = 0;
    while (head < tail) {
      const c = q[head++], d = out[c];
      if (d >= maxSteps) continue;
      const cx = c % w, cy = (c / w) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX8[k], ny = cy + DY8[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (grid[ni] || out[ni] >= 0) continue;
        if (k >= 4 && (grid[cy * w + nx] || grid[ny * w + cx])) continue;
        out[ni] = d + 1; q[tail++] = ni;
      }
    }
  }
  // منطقة يمكن للاعب بلوغها الآن (BFS على شبكة الحركة)
  reach(fromX, fromY, out) {
    out.fill(0);
    const w = this.w, h = this.h, grid = this.move;
    let s = this.idx(clamp(Math.floor(fromX / T), 0, w - 1), clamp(Math.floor(fromY / T), 0, h - 1));
    const q = this.q; let head = 0, tail = 0; q[tail++] = s; out[s] = 1;
    while (head < tail) {
      const c = q[head++], cx = c % w, cy = (c / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX8[k], ny = cy + DY8[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (out[ni] || grid[ni]) continue;
        out[ni] = 1; q[tail++] = ni;
      }
    }
  }
  // ---------- الصناديق ----------
  tryPushBox(box, dx, dy, game) {
    const nx = box.tx + dx, ny = box.ty + dy;
    if (!this.inb(nx, ny)) return false;
    const ni = this.idx(nx, ny);
    if (this.tile[ni] !== 0 || this.solidAt[ni]) return false;
    const f = this.floorAt[ni];
    if (f && f.type !== 'plate' && f.type !== 'hazard') return false;
    if (game.agentOnTile(nx, ny)) return false;
    const oi = this.idx(box.tx, box.ty);
    this.solidAt[oi] = null; this.solidAt[ni] = box;
    box.startMove(nx, ny);
    this.cellUpdate(oi); this.cellUpdate(ni); this.changed();
    return true;
  }
  // ---------- الليزر ----------
  traceLasers() {
    this.lgrid.fill(0);
    for (const r of this.receivers) r.hitNow = false;
    for (const e of this.emitters) e.trace(this);
  }
  // ---------- الإضاءة الثابتة ----------
  computeLit() {
    this.lit.fill(0);
    for (const l of this.lamps) {
      if (!l.on) continue;
      const r = l.r;
      const x0 = Math.max(0, Math.floor((l.x - r) / T)), x1 = Math.min(this.w - 1, Math.floor((l.x + r) / T));
      const y0 = Math.max(0, Math.floor((l.y - r) / T)), y1 = Math.min(this.h - 1, Math.floor((l.y + r) / T));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * this.w + x;
        if (this.tile[i]) continue;
        const cx = (x + 0.5) * T, cy = (y + 0.5) * T, d = dist(l.x, l.y, cx, cy);
        if (d > r) continue;
        if (!this.los(l.x, l.y, cx, cy)) continue;
        this.lit[i] += (1 - d / r) * l.intensity;
      }
    }
    this.litDirty = false;
  }
  litAt(x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); return this.inb(tx, ty) ? this.lit[this.idx(tx, ty)] : 0; }
  // ---------- الرسم ----------
  range(v) {
    return [Math.max(0, Math.floor(v.x0 / T)), Math.max(0, Math.floor(v.y0 / T)), Math.min(this.w - 1, Math.floor(v.x1 / T)), Math.min(this.h - 1, Math.floor(v.y1 / T))];
  }
  drawFloor(ctx, v) {
    const [x0, y0, x1, y1] = this.range(v), w = this.w, tile = this.tile, dec = this.decor;
    ctx.fillStyle = PAL.floor; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (tile[y * w + x] === 0) ctx.rect(x * T, y * T, T, T);
    ctx.fill();
    ctx.fillStyle = PAL.floor2; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (tile[i] === 0 && ((x + y) & 1)) ctx.rect(x * T + 1, y * T + 1, T - 2, T - 2); }
    ctx.fill();
    ctx.strokeStyle = PAL.seam; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (tile[y * w + x] !== 0) continue;
      ctx.moveTo(x * T, y * T); ctx.lineTo(x * T + T, y * T);
      ctx.moveTo(x * T, y * T); ctx.lineTo(x * T, y * T + T);
    }
    ctx.stroke();
    if (!R.q.decor) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x; if (tile[i] !== 0) continue;
      const d = dec[i];
      if (d < 40) { ctx.rect(x * T + 5, y * T + 5, T - 10, T - 10); }
      else if (d < 58) { for (let k = 0; k < 4; k++) { ctx.moveTo(x * T + 8, y * T + 9 + k * 5); ctx.lineTo(x * T + T - 8, y * T + 9 + k * 5); } }
      else if (d < 66) { ctx.moveTo(x * T + 6, y * T + 20); ctx.lineTo(x * T + 14, y * T + 15); ctx.lineTo(x * T + 22, y * T + 24); }
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x; if (tile[i] !== 0) continue;
      const d = dec[i];
      if (d >= 66 && d < 72) { ctx.moveTo(x * T + T / 2 + 5, y * T + T / 2); ctx.arc(x * T + T / 2, y * T + T / 2, 5, 0, TAU); }
      // ظلال قرب الجدران (انسداد محيطي بسيط)
      if (y > 0 && tile[i - w] === 1) ctx.rect(x * T, y * T, T, 6);
      if (x > 0 && tile[i - 1] === 1) ctx.rect(x * T, y * T, 4, T);
      if (x < w - 1 && tile[i + 1] === 1) ctx.rect(x * T + T - 4, y * T, 4, T);
    }
    ctx.fill();
  }
  drawWalls(ctx, v) {
    const [x0, y0, x1, y1] = this.range(v), w = this.w, h = this.h, tile = this.tile;
    const FH = 0.62;
    const isW = (x, y) => x < 0 || y < 0 || x >= w || y >= h || tile[y * w + x] !== 0;
    ctx.fillStyle = PAL.wallTop; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (tile[y * w + x] !== 1) continue;
      const front = !isW(x, y + 1);
      ctx.rect(x * T, y * T, T, front ? T * FH : T);
    }
    ctx.fill();
    ctx.fillStyle = PAL.wallFront; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (tile[y * w + x] !== 1 || isW(x, y + 1)) continue;
      ctx.rect(x * T, y * T + T * FH, T, T * (1 - FH));
    }
    ctx.fill();
    // حواف علوية فاتحة
    ctx.strokeStyle = PAL.wallEdge; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (tile[y * w + x] !== 1) continue;
      if (!isW(x, y - 1)) { ctx.moveTo(x * T, y * T + 0.75); ctx.lineTo(x * T + T, y * T + 0.75); }
      if (!isW(x - 1, y)) { ctx.moveTo(x * T + 0.75, y * T); ctx.lineTo(x * T + 0.75, y * T + (isW(x, y + 1) ? T : T * FH)); }
      if (!isW(x + 1, y)) { ctx.moveTo(x * T + T - 0.75, y * T); ctx.lineTo(x * T + T - 0.75, y * T + (isW(x, y + 1) ? T : T * FH)); }
    }
    ctx.stroke();
    // خط الواجهة السفلي وتفاصيل الألواح
    ctx.strokeStyle = PAL.wallDark; ctx.lineWidth = 2; ctx.beginPath();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (tile[y * w + x] !== 1 || isW(x, y + 1)) continue;
      ctx.moveTo(x * T, y * T + T * FH); ctx.lineTo(x * T + T, y * T + T * FH);
      ctx.moveTo(x * T, y * T + T - 1); ctx.lineTo(x * T + T, y * T + T - 1);
      if (R.q.decor && (this.decor[y * w + x] & 3) === 0) { ctx.moveTo(x * T + T / 2, y * T + T * FH + 2); ctx.lineTo(x * T + T / 2, y * T + T - 2); }
    }
    ctx.stroke();
    if (R.q.decor) {
      ctx.fillStyle = PAL.wallTop2; ctx.beginPath();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (tile[i] !== 1) continue;
        const d = this.decor[i];
        if (d < 28 && isW(x, y + 1) && isW(x, y - 1)) ctx.rect(x * T + 6, y * T + 6, T - 12, T - 12);
      }
      ctx.fill();
    }
  }
  drawWallLights(ctx, v, t) {
    if (!R.q.decor) return;
    const [x0, y0, x1, y1] = this.range(v), w = this.w, h = this.h, tile = this.tile;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (tile[i] !== 1 || y + 1 >= h || tile[i + w] !== 0) continue;
      const d = this.decor[i];
      if (d > 30 && d < 52) {
        const c = d & 1 ? PAL.cyan : PAL.amber;
        const a = 0.55 + 0.35 * Math.sin(t * 0.002 + d);
        ctx.fillStyle = col(c, a); ctx.fillRect(x * T + 9, y * T + T * 0.75, T - 18, 2.5);
      }
    }
  }
  drawWires(ctx, t, emissive) {
    const v = R.vb;
    for (const wr of this.wires) {
      const p = wr.pts;
      const minX = Math.min(p[0], p[2], p[4]), maxX = Math.max(p[0], p[2], p[4]), minY = Math.min(p[1], p[3], p[5]), maxY = Math.max(p[1], p[3], p[5]);
      if (maxX < v.x0 || minX > v.x1 || maxY < v.y0 || minY > v.y1) continue;
      if (!emissive) {
        ctx.strokeStyle = '#11181d'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.stroke();
        ctx.strokeStyle = wr.on ? '#2a6f80' : PAL.wireOff; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.stroke();
      } else if (wr.on) {
        ctx.strokeStyle = col(PAL.wireOn, 0.85); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.stroke();
        ctx.setLineDash([5, 17]); ctx.lineDashOffset = -t * 0.06;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}
