// ===================== الكائنات: المفاتيح، الأبواب، البوابات المنطقية، الليزر، اللاعب =====================
class Obj {
  constructor(L, tx, ty, spec) {
    this.L = L; this.tx = tx; this.ty = ty; this.x = (tx + 0.5) * T; this.y = (ty + 0.5) * T;
    this.spec = spec; this.type = spec.t; this.layer = 'floor'; this.val = false;
  }
  isSolid() { return false; }
  blocksSight() { return false; }
  update(dt, g) { }
  draw(ctx, t, g) { }
  emit(ctx, t, g, glow) { }
  canInteract(g) { return false; }
  label(g) { return ''; }
  interact(g) { }
}
const txtLabel = (ctx, s, x, y, c, size = 10) => {
  ctx.fillStyle = c; ctx.font = 'bold ' + size + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
};

class Lamp {
  constructor(L, tx, ty, spec) {
    this.L = L; this.x = (tx + 0.5) * T; this.y = (ty + 0.5) * T;
    this.r = (spec.r || 6) * T; this.color = spec.color || PAL.lampWarm; this.intensity = spec.i ?? 0.95;
    this.flicker = spec.flicker || 0; this.inputs = spec.in ? [spec.in] : []; this.on = true;
    this.poly = null; this.polyN = 0; this.ver = -1; this.ph = Math.random() * 100;
  }
  update(dt, g) {
    const on = !this.inputs.length || this.L.nodeVal(this.inputs[0]);
    if (on !== this.on) { this.on = on; this.L.litDirty = true; }
  }
  light(t, mult = 1) {
    if (!this.on) return;
    let a = this.intensity * mult;
    if (this.flicker) { const f = Math.sin(t * 0.013 + this.ph) + Math.sin(t * 0.031 + this.ph * 2); a *= f > 1.55 * (1 - this.flicker * 0.4) ? 0.35 : 1; }
    if (R.q.shadows) {
      const n = R.q.lampRays;
      if (this.ver !== this.L.navVersion || this.polyN !== n) {
        if (!this.poly || this.poly.length < n * 2) this.poly = new Float32Array(n * 2);
        this.L.castPoly(this.x, this.y, this.r, 0, TAU, n, this.poly, true);
        this.polyN = n; this.ver = this.L.navVersion;
      }
      R.lightPoly(this.poly, this.polyN, this.x, this.y, this.r, this.color, a);
    } else R.lightSprite(this.x, this.y, this.r, this.color, a);
  }
}

class Switch extends Obj {
  constructor(L, tx, ty, spec) {
    super(L, tx, ty, spec);
    this.nodeId = spec.id; this.name = spec.label || spec.id; this.val = !!spec.on; this.anim = this.val ? 1 : 0;
  }
  update(dt) { this.anim = damp(this.anim, this.val ? 1 : 0, 14, dt); }
  canInteract() { return true; }
  label() { return 'بدّل المفتاح ' + this.name + (this.val ? ' (يعمل)' : ' (مطفأ)'); }
  interact(g) {
    this.val = !this.val;
    Sound.at('switch', this.x, this.y);
    g.noise(this.x, this.y, 2.5 * T, 'switch');
    FX.burst(this.x, this.y, 6, this.val ? PAL.mint : PAL.red, 80, 0.3, 1.5);
    g.event('switch', this);
  }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#14181d'; rrect(ctx, x - 12, y - 12, 24, 24, 5); ctx.fill();
    ctx.strokeStyle = '#3e4652'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#07090b'; rrect(ctx, x - 8, y + 1, 16, 5, 2.5); ctx.fill();
    const lx = x + lerp(-5.5, 5.5, this.anim);
    ctx.strokeStyle = '#8b96a3'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y + 3.5); ctx.lineTo(lx, y - 1); ctx.stroke();
    ctx.fillStyle = '#d5dde5'; ctx.beginPath(); ctx.arc(lx, y - 1.5, 4, 0, TAU); ctx.fill();
  }
  emit(ctx, t, g, glow) {
    const c = this.val ? PAL.mint : PAL.red;
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(this.x + 8, this.y - 8, 2.3, 0, TAU); ctx.fill();
    if (!glow) txtLabel(ctx, this.name, this.x - 6, this.y - 7.5, col(c, 0.95), 9);
  }
}

class Plate extends Obj {
  constructor(L, tx, ty, spec) {
    super(L, tx, ty, spec);
    this.nodeId = spec.id; this.name = spec.label || spec.id; this.press = 0;
  }
  update(dt, g) {
    const L = this.L, i = L.idx(this.tx, this.ty);
    let p = false;
    const s = L.solidAt[i];
    if (s && s.type === 'box') p = true;
    if (!p && g.player && g.player.alive && g.player.onTile(this.tx, this.ty)) p = true;
    if (!p && g.echo && g.echo.holding === this) p = true;
    if (!p) for (const e of g.enemies) if (e.pressesPlates && e.alive && Math.floor(e.x / T) === this.tx && Math.floor(e.y / T) === this.ty) { p = true; break; }
    if (p !== this.val) { this.val = p; Sound.at('switch', this.x, this.y); g.event('plate', this); }
    this.press = damp(this.press, p ? 1 : 0, 16, dt);
  }
  draw(ctx) {
    const x = this.x, y = this.y, s = 12.5 - this.press * 1.8;
    ctx.fillStyle = '#121519'; ctx.fillRect(x - 14.5, y - 14.5, 29, 29);
    ctx.fillStyle = this.val ? '#2b5c54' : '#3b434e'; rrect(ctx, x - s, y - s, s * 2, s * 2, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - s + 3, y - s + 1); ctx.lineTo(x + s - 3, y - s + 1); ctx.stroke();
  }
  emit(ctx, t, g, glow) {
    const c = this.val ? PAL.mint : '#6f7c8a';
    ctx.strokeStyle = col(c, this.val ? 0.9 : 0.35); ctx.lineWidth = 1.4; rrect(ctx, this.x - 13, this.y - 13, 26, 26, 3); ctx.stroke();
    if (!glow) txtLabel(ctx, this.name, this.x, this.y, col(this.val ? '#dffff7' : '#9aa6b2', 0.9), 9);
  }
}

const GATE_INFO = {
  AND: 'AND', OR: 'OR', NOT: 'NOT', XOR: 'XOR', NAND: 'NAND', NOR: 'NOR', XNOR: 'XNOR', TIMER: 'مؤقّت', CLOCK: 'ساعة', LATCH: 'ذاكرة',
};
class Gate extends Obj {
  constructor(L, tx, ty, spec) {
    super(L, tx, ty, spec);
    this.nodeId = spec.id; this.op = spec.op; this.inputs = (spec.in || []).slice();
    this.t = 0; this.prev = false; this.dur = spec.dur || 5; this.period = spec.period || 4; this.duty = spec.duty ?? 0.5;
  }
  static apply(op, v, self) {
    switch (op) {
      case 'AND': return v.length > 0 && v.every(Boolean);
      case 'OR': return v.some(Boolean);
      case 'NOT': return !v[0];
      case 'XOR': return v.reduce((a, b) => a !== b, false);
      case 'NAND': return !(v.length > 0 && v.every(Boolean));
      case 'NOR': return !v.some(Boolean);
      case 'XNOR': return !v.reduce((a, b) => a !== b, false);
      case 'TIMER': return !!v[0] || (self ? self.val : false);
      case 'CLOCK': return true;
      case 'LATCH': return !!v[0] || (self ? self.val && !v[1] : false);
    }
    return false;
  }
  compute(L, dt) {
    const ins = this.inputs;
    switch (this.op) {
      case 'TIMER': {
        const a = L.nodeVal(ins[0]);
        if (a && !this.prev) this.t = this.dur;
        this.prev = a;
        if (this.t > 0) this.t -= dt;
        this.val = this.t > 0;
        break;
      }
      case 'CLOCK': {
        this.t += dt;
        const en = ins.length ? L.nodeVal(ins[0]) : true;
        this.val = en && (this.t % this.period) < this.period * this.duty;
        break;
      }
      case 'LATCH':
        if (L.nodeVal(ins[0])) this.val = true;
        if (ins[1] && L.nodeVal(ins[1])) this.val = false;
        break;
      default: {
        const v = []; for (const id of ins) v.push(L.nodeVal(id));
        this.val = Gate.apply(this.op, v, this);
      }
    }
  }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#0f1317'; rrect(ctx, x - 14, y - 10, 28, 20, 4); ctx.fill();
    ctx.strokeStyle = '#3a4350'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#56606c';
    for (let i = -1; i <= 1; i++) { ctx.fillRect(x - 17, y + i * 5 - 1, 3, 2); ctx.fillRect(x + 14, y + i * 5 - 1, 3, 2); }
  }
  emit(ctx, t, g, glow) {
    const c = this.val ? PAL.mint : PAL.red;
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(this.x + 10, this.y - 6, 1.9, 0, TAU); ctx.fill();
    if (!glow) {
      txtLabel(ctx, GATE_INFO[this.op] || this.op, this.x - 1, this.y + 1, this.val ? '#c9fff2' : '#c7ced6', this.op.length > 3 ? 7.5 : 8.5);
      if (this.op === 'TIMER' && this.t > 0) txtLabel(ctx, Math.ceil(this.t) + '', this.x, this.y - 15, PAL.yellow, 9);
    }
  }
}

class Door extends Obj {
  constructor(L, tx, ty, spec) {
    super(L, tx, ty, spec);
    this.layer = 'solid'; this.inputs = spec.in ? [spec.in] : []; this.inv = !!spec.inv;
    this.open = 0; this.target = false; this.horiz = null; this.forceOpen = false;
  }
  orient() {
    const L = this.L;
    const blk = (x, y) => !L.inb(x, y) || L.tile[L.idx(x, y)] === 1 || (L.solidAt[L.idx(x, y)] && L.solidAt[L.idx(x, y)].type === 'door');
    this.horiz = blk(this.tx - 1, this.ty) || blk(this.tx + 1, this.ty);
    if (blk(this.tx, this.ty - 1) && blk(this.tx, this.ty + 1) && !(blk(this.tx - 1, this.ty) && blk(this.tx + 1, this.ty))) this.horiz = false;
  }
  isSolid() { return this.open < 0.75; }
  blocksSight() { return this.open < 0.5; }
  wanted() {
    let want = this.inputs.length ? this.L.nodeVal(this.inputs[0]) : false;
    if (this.inv) want = !want;
    return want || this.forceOpen;
  }
  update(dt, g) {
    if (this.horiz === null) this.orient();
    let want = this.wanted();
    if (!want && this.open > 0.15 && g.somethingOnTile(this.tx, this.ty)) want = true;
    if (want !== this.target) {
      this.target = want;
      Sound.at('door', this.x, this.y);
      if (want) g.event('doorOpen', this);
    }
    const ps = this.isSolid(), pb = this.blocksSight();
    this.open = clamp(this.open + (want ? 1 : -1) * dt * 3.2, 0, 1);
    if (ps !== this.isSolid() || pb !== this.blocksSight()) this.L.cellChanged(this.tx, this.ty);
  }
  draw(ctx) {
    const x = this.x, y = this.y, o = easeOut(this.open), h = T / 2;
    ctx.fillStyle = '#15181d'; ctx.fillRect(x - h, y - h, T, T);
    ctx.save(); ctx.translate(x, y); if (!this.horiz) ctx.rotate(Math.PI / 2);
    const pw = h * (1 - o);
    ctx.fillStyle = '#5c6572';
    ctx.fillRect(-h, -7, pw, 14); ctx.fillRect(h - pw, -7, pw, 14);
    ctx.fillStyle = '#7a8492';
    ctx.fillRect(-h, -7, pw, 2.5); ctx.fillRect(h - pw, -7, pw, 2.5);
    ctx.fillStyle = '#2d333b';
    for (let k = 0; k < 3; k++) { const sx = -h + 4 + k * 4; if (sx < -h + pw - 2) ctx.fillRect(sx, -4, 2, 9); const ex = h - 6 - k * 4; if (ex > h - pw + 1) ctx.fillRect(ex, -4, 2, 9); }
    ctx.fillStyle = '#2a2f37'; ctx.fillRect(-h, -9, 3, 18); ctx.fillRect(h - 3, -9, 3, 18);
    ctx.restore();
  }
  emit(ctx, t) {
    const c = this.target ? PAL.mint : PAL.red;
    ctx.save(); ctx.translate(this.x, this.y); if (!this.horiz) ctx.rotate(Math.PI / 2);
    const pw = T / 2 * (1 - easeOut(this.open));
    ctx.fillStyle = col(c, 0.9);
    if (pw > 2) { ctx.fillRect(-T / 2 + pw - 2, -6, 2, 12); ctx.fillRect(T / 2 - pw, -6, 2, 12); }
    ctx.fillRect(-T / 2, -10, 3, 2); ctx.fillRect(T / 2 - 3, -10, 3, 2);
    ctx.restore();
  }
}

class Box extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.layer = 'solid'; this.rx = this.x; this.ry = this.y; this.fx = this.x; this.fy = this.y; this.mt = 1; }
  isSolid() { return true; }
  blocksSight() { return true; }
  get moving() { return this.mt < 1; }
  startMove(nx, ny) { this.fx = this.rx; this.fy = this.ry; this.tx = nx; this.ty = ny; this.x = (nx + 0.5) * T; this.y = (ny + 0.5) * T; this.mt = 0; }
  update(dt) {
    if (this.mt < 1) { this.mt = Math.min(1, this.mt + dt / 0.16); const e = smoothstep(this.mt); this.rx = lerp(this.fx, this.x, e); this.ry = lerp(this.fy, this.y, e); }
  }
  draw(ctx) {
    const x = this.rx, y = this.ry, s = T * 0.44;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - s + 3, y - s + 5, s * 2, s * 2);
    ctx.fillStyle = '#3f4650'; rrect(ctx, x - s, y - s, s * 2, s * 2, 3); ctx.fill();
    ctx.fillStyle = '#4f5763'; rrect(ctx, x - s + 3, y - s + 3, s * 2 - 6, s * 2 - 9, 2); ctx.fill();
    ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - s + 4, y - s + 4); ctx.lineTo(x + s - 4, y + s - 7); ctx.moveTo(x + s - 4, y - s + 4); ctx.lineTo(x - s + 4, y + s - 7); ctx.stroke();
    ctx.fillStyle = '#d99a2b'; ctx.fillRect(x - s, y + s - 6, s * 2, 6);
    ctx.fillStyle = '#1b1d21'; for (let k = 0; k < 4; k++) ctx.fillRect(x - s + 2 + k * 7, y + s - 6, 3, 6);
  }
}

class Terminal extends Obj {
  constructor(L, tx, ty, spec) {
    super(L, tx, ty, spec);
    this.layer = 'solid'; this.nodeId = spec.id; this.name = spec.label || spec.id;
    this.size = spec.size || 4; this.time = spec.time || 35; this.secure = !!spec.secure; this.val = false; this.cd = 0; this.echoProg = 0;
  }
  isSolid() { return true; }
  blocksSight() { return false; }
  update(dt) { this.cd = Math.max(0, this.cd - dt); }
  canInteract() { return !this.val && this.cd <= 0; }
  label() { return this.cd > 0 ? 'لوحة الشيفرة تستعيد رنينها…' : 'افتح لوحة الشيفرة ' + this.name; }
  interact(g) { g.openHack(this); }
  setHacked(g, byEcho) {
    if (this.val) return;
    this.val = true; Sound.at('hackOk', this.x, this.y); FX.burst(this.x, this.y, 18, PAL.mint, 140, 0.6, 1.6);
    if (this.spec.reveal) { g.L.explored.fill(1); g.scanT = 8; g.say('echo', 'وصلتَ أوتار المراقبة! الخريطة كاملة الآن، وأرى الحراس للحظات.', 0, 'mid'); }
    g.event('hack', { t: this, byEcho });
  }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 13, y - 9, 28, 24);
    ctx.fillStyle = '#2b313a'; rrect(ctx, x - 14, y - 12, 28, 24, 4); ctx.fill();
    ctx.fillStyle = '#3c444f'; rrect(ctx, x - 14, y - 12, 28, 6, 3); ctx.fill();
    ctx.fillStyle = '#0b0f14'; rrect(ctx, x - 10, y - 6, 20, 12, 2); ctx.fill();
    ctx.fillStyle = '#4a5360'; for (let k = 0; k < 5; k++) ctx.fillRect(x - 10 + k * 4.4, y + 8, 3, 2);
  }
  emit(ctx, t, g, glow) {
    const x = this.x, y = this.y;
    if (this.val) { ctx.fillStyle = col(PAL.mint, 0.85); ctx.fillRect(x - 9, y - 5, 18, 10); if (!glow) txtLabel(ctx, '✓', x, y, '#03261f', 10); }
    else {
      const blink = (t * 0.004 | 0) % 2;
      ctx.fillStyle = col(this.cd > 0 ? PAL.red : PAL.cyan, 0.75); ctx.fillRect(x - 9, y - 5, 18, 10);
      if (!glow) { txtLabel(ctx, blink ? '>_' : '>', x, y, '#021018', 8); txtLabel(ctx, this.name, x, y - 17, col(PAL.cyan, 0.95), 9); }
      if (this.echoProg > 0) { ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + TAU * this.echoProg); ctx.stroke(); }
    }
  }
}

class RiddleGate extends Obj {
  constructor(L, tx, ty, spec) {
    super(L, tx, ty, spec);
    this.layer = 'solid'; this.nodeId = spec.id || null; this.open = 0; this.lockT = 0; this.horiz = null;
  }
  isSolid() { return this.open < 0.75; }
  blocksSight() { return this.open < 0.5; }
  canInteract() { return !this.val && this.lockT <= 0; }
  label() { return this.lockT > 0 ? 'البوابة مقفلة مؤقتاً…' : 'أجب عن لغز المُراقِب'; }
  interact(g) { g.openRiddle(this); }
  update(dt, g) {
    if (this.horiz === null) { const L = this.L, b = (x, y) => !L.inb(x, y) || L.tile[L.idx(x, y)] === 1; this.horiz = b(this.tx - 1, this.ty) || b(this.tx + 1, this.ty); }
    this.lockT = Math.max(0, this.lockT - dt);
    const ps = this.isSolid(), pb = this.blocksSight();
    this.open = clamp(this.open + (this.val ? 1 : -1) * dt * 2, 0, 1);
    if (ps !== this.isSolid() || pb !== this.blocksSight()) this.L.cellChanged(this.tx, this.ty);
  }
  draw(ctx) {
    const x = this.x, y = this.y, o = easeOut(this.open);
    ctx.fillStyle = '#16131d'; ctx.fillRect(x - T / 2, y - T / 2, T, T);
    ctx.save(); ctx.translate(x, y); if (!this.horiz) ctx.rotate(Math.PI / 2);
    const pw = T / 2 * (1 - o);
    ctx.fillStyle = '#4b3f66'; ctx.fillRect(-T / 2, -8, pw, 16); ctx.fillRect(T / 2 - pw, -8, pw, 16);
    ctx.restore();
  }
  emit(ctx, t, g, glow) {
    if (this.open > 0.6) return;
    const a = 0.6 + 0.4 * Math.sin(t * 0.004);
    ctx.fillStyle = col(this.lockT > 0 ? PAL.red : PAL.violet, a);
    ctx.beginPath(); ctx.arc(this.x, this.y, 7, 0, TAU); ctx.fill();
    if (!glow) txtLabel(ctx, '؟', this.x, this.y + 1, '#160c26', 11);
  }
}

class Emitter extends Obj {
  constructor(L, tx, ty, spec) {
    super(L, tx, ty, spec);
    this.layer = 'solid'; this.dir = DIR_OF[spec.dir || 'E']; this.dx = DIR4[this.dir][0]; this.dy = DIR4[this.dir][1];
    this.inputs = spec.in ? [spec.in] : []; this.inv = !!spec.inv; this.segs = []; this.active = true; this.empT = 0;
  }
  isSolid() { return true; }
  blocksSight() { return true; }
  enabled(L) {
    if (this.empT > 0) return false;
    if (!this.inputs.length) return true;
    const v = L.nodeVal(this.inputs[0]);
    return this.inv ? !v : v;
  }
  update(dt) { this.empT = Math.max(0, this.empT - dt); }
  trace(L) {
    const s = this.segs; s.length = 0;
    this.active = this.enabled(L);
    if (!this.active) return;
    let tx = this.tx, ty = this.ty, dx = this.dx, dy = this.dy;
    let sx = this.x + dx * T * 0.4, sy = this.y + dy * T * 0.4;
    for (let step = 0; step < 260; step++) {
      tx += dx; ty += dy;
      const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
      if (!L.inb(tx, ty)) { s.push(sx, sy, cx - dx * T * 0.5, cy - dy * T * 0.5); return; }
      const i = L.idx(tx, ty);
      if (L.tile[i] !== 0) { s.push(sx, sy, cx - dx * T * 0.5, cy - dy * T * 0.5); return; }
      const o = L.solidAt[i];
      if (o) {
        if (o.type === 'mirror') {
          s.push(sx, sy, cx, cy); L.lgrid[i] = 1;
          const ndx = o.m === '/' ? -dy : dy, ndy = o.m === '/' ? -dx : dx;
          dx = ndx; dy = ndy; sx = cx; sy = cy; o.glow = 1;
          continue;
        }
        if (o.type === 'receiver') { o.hitNow = true; s.push(sx, sy, cx - dx * T * 0.28, cy - dy * T * 0.28); return; }
        if (o.isSolid()) { s.push(sx, sy, cx - dx * T * 0.45, cy - dy * T * 0.45); return; }
      }
      L.lgrid[i] = 1;
    }
    s.push(sx, sy, (tx + 0.5) * T, (ty + 0.5) * T);
  }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#2a2328'; rrect(ctx, x - 13, y - 13, 26, 26, 5); ctx.fill();
    ctx.strokeStyle = '#4a3c44'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#120c0f'; ctx.beginPath(); ctx.arc(x + this.dx * 7, y + this.dy * 7, 5.5, 0, TAU); ctx.fill();
  }
  emit(ctx, t, g, glow) {
    const lx = this.x + this.dx * 7, ly = this.y + this.dy * 7;
    ctx.fillStyle = this.active ? PAL.laser : '#5a2030'; ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, TAU); ctx.fill();
    if (!this.active) return;
    const s = this.segs, wob = 0.75 + 0.25 * Math.sin(t * 0.05 + this.tx);
    ctx.lineCap = 'round';
    ctx.strokeStyle = col(PAL.laser, 0.35); ctx.lineWidth = 6 * wob; ctx.beginPath();
    for (let i = 0; i < s.length; i += 4) { ctx.moveTo(s[i], s[i + 1]); ctx.lineTo(s[i + 2], s[i + 3]); }
    ctx.stroke();
    ctx.strokeStyle = '#ffd0da'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < s.length; i += 4) { ctx.moveTo(s[i], s[i + 1]); ctx.lineTo(s[i + 2], s[i + 3]); }
    ctx.stroke(); ctx.lineCap = 'butt';
    if (!glow && s.length && Math.random() < 0.3) { const n = s.length; FX.add(0, s[n - 2], s[n - 1], rand(-90, 90), rand(-90, 90), 0.25, 1.2, '#ff8aa0'); }
  }
}

class Mirror extends Obj {
  constructor(L, tx, ty, spec) {
    super(L, tx, ty, spec);
    this.layer = 'solid'; this.m = spec.m || '/'; this.fixed = !!spec.fixed; this.ang = this.m === '/' ? -Math.PI / 4 : Math.PI / 4; this.glow = 0;
  }
  isSolid() { return true; }
  blocksSight() { return false; }
  canInteract() { return !this.fixed; }
  label() { return 'أدِر المرآة'; }
  interact(g) { this.m = this.m === '/' ? '\\' : '/'; Sound.at('rotate', this.x, this.y); g.event('mirror', this); }
  update(dt) { const target = this.m === '/' ? -Math.PI / 4 : Math.PI / 4; this.ang = damp(this.ang, target, 14, dt); this.glow = Math.max(0, this.glow - dt * 4); }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#1b2026'; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
    ctx.strokeStyle = this.fixed ? '#3b3f45' : '#5d6b78'; ctx.lineWidth = 2; ctx.stroke();
    if (!this.fixed) { ctx.fillStyle = '#7d8b99'; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; ctx.fillRect(x + Math.cos(a) * 12 - 1, y + Math.sin(a) * 12 - 1, 2, 2); } }
    ctx.save(); ctx.translate(x, y); ctx.rotate(this.ang);
    ctx.fillStyle = '#9fb3c4'; ctx.fillRect(-14, -2.5, 28, 5);
    ctx.fillStyle = '#e8f4ff'; ctx.fillRect(-14, -2.5, 28, 1.6);
    ctx.restore();
  }
  emit(ctx) {
    if (this.glow <= 0) return;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.ang);
    ctx.fillStyle = col('#ffd0da', this.glow * 0.8); ctx.fillRect(-13, -1.5, 26, 3);
    ctx.restore();
  }
}

class Receiver extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.layer = 'solid'; this.nodeId = spec.id; this.name = spec.label || spec.id; this.hitNow = false; this.charge = 0; }
  isSolid() { return true; }
  blocksSight() { return true; }
  update(dt, g) {
    const was = this.val; this.val = this.hitNow;
    if (this.val !== was) { Sound.at(this.val ? 'pickup' : 'uiBack', this.x, this.y); g.event('receiver', this); }
    this.charge = damp(this.charge, this.val ? 1 : 0, 6, dt);
  }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#23262c'; rrect(ctx, x - 13, y - 13, 26, 26, 6); ctx.fill();
    ctx.strokeStyle = '#454c56'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#0d0f12'; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
  }
  emit(ctx, t, g, glow) {
    const c = this.val ? PAL.mint : '#7b2a3a';
    ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(this.x, this.y, 7, 0, TAU); ctx.stroke();
    if (this.charge > 0.05) { ctx.fillStyle = col(PAL.mint, this.charge); ctx.beginPath(); ctx.arc(this.x, this.y, 4.5 * this.charge, 0, TAU); ctx.fill(); }
    if (!glow) txtLabel(ctx, this.name, this.x, this.y - 18, col(c, 0.95), 9);
  }
}

class Hazard extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.inputs = spec.off ? [spec.off] : []; this.inv = !!spec.inv; this.active = true; this.ph = Math.random() * 10; if (spec.nw) this.noWire = true; }
  update(dt, g) {
    let off = this.inputs.length ? this.L.nodeVal(this.inputs[0]) : false;
    if (this.inv) off = !off;
    this.active = !off;
  }
  draw(ctx) {
    const x = this.x - T / 2, y = this.y - T / 2;
    ctx.fillStyle = '#16191d'; ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = this.active ? '#2c3e57' : '#2a2e33'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 4; k < T; k += 6) { ctx.moveTo(x + k, y + 2); ctx.lineTo(x + k, y + T - 2); }
    ctx.stroke();
  }
  emit(ctx, t, g, glow) {
    if (!this.active) return;
    const x = this.x - T / 2, y = this.y - T / 2, ph = this.ph;
    ctx.strokeStyle = col('#9fd8ff', 0.55 + 0.45 * Math.sin(t * 0.02 + ph)); ctx.lineWidth = 1.3; ctx.beginPath();
    for (let k = 0; k < 2; k++) {
      let px = x + 2, py = y + T * (0.3 + k * 0.4);
      ctx.moveTo(px, py);
      for (let s = 1; s <= 6; s++) { px = x + 2 + s * (T - 4) / 6; py = y + T * (0.3 + k * 0.4) + Math.sin(t * 0.04 + s * 2.1 + ph + k) * 4; ctx.lineTo(px, py); }
    }
    ctx.stroke();
  }
}

const PICKUP_COL = { core: PAL.cyan, energy: PAL.yellow, health: '#ff8fa3', chip: PAL.gold, memory: PAL.violet, shard: '#cfe3ff', charm: '#e6b8ff' };
class Pickup extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.kind = spec.t; this.taken = false; this.bob = Math.random() * TAU; this.gadget = spec.gadget || null; this.mem = spec.mem || null; this.charm = spec.charm || null; }
  update(dt, g) {
    if (this.taken) return;
    this.bob += dt * 3;
    const p = g.player;
    if (!p || !p.alive) return;
    if (this.kind === 'shard' && g.perk && g.perk('magnet')) {
      const d2 = dist2(p.x, p.y, this.x, this.y);
      if (d2 < (4.2 * T) ** 2 && d2 > 1) { const d = Math.sqrt(d2), k = Math.min(d, 7 * T * dt); this.x += (p.x - this.x) / d * k; this.y += (p.y - this.y) / d * k; }
    }
    if (dist2(p.x, p.y, this.x, this.y) < (T * 0.58) ** 2) g.collect(this);
  }
  draw(ctx) {
    if (this.taken) return;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 9, 8, 3.5, 0, 0, TAU); ctx.fill();
  }
  emit(ctx, t, g, glow) {
    if (this.taken) return;
    const x = this.x, y = this.y - 3 + Math.sin(this.bob) * 2.5, c = PICKUP_COL[this.kind];
    ctx.globalAlpha = 0.35; ctx.drawImage(Sprites.glow(c), x - 18, y - 18, 36, 36); ctx.globalAlpha = 1;
    switch (this.kind) {
      case 'core': {
        const sw = Math.sin(t * 0.004 + this.bob) * 0.25;
        ctx.save(); ctx.translate(x, y - 2); ctx.rotate(sw);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-7, 5); ctx.quadraticCurveTo(-7, -8, 0, -8); ctx.quadraticCurveTo(7, -8, 7, 5); ctx.lineTo(9, 7); ctx.lineTo(-9, 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e9fdff'; ctx.beginPath(); ctx.arc(0, 9, 2.3, 0, TAU); ctx.fill(); ctx.fillRect(-1, -11, 2, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-4, -4, 2, 6);
        ctx.restore();
        break;
      }
      case 'shard': {
        const s = 4 + Math.sin(t * 0.008 + this.bob) * 0.8;
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s * 1.4); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.8, y - s, 1.6, s * 1.2);
        break;
      }
      case 'charm': {
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8.5, 0, TAU); ctx.stroke();
        ctx.fillStyle = c; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = t * 0.0012 + k * Math.PI / 2; ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5); } ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill();
        break;
      }
      case 'energy':
        ctx.fillStyle = c; rrect(ctx, x - 4.5, y - 7, 9, 14, 2); ctx.fill();
        ctx.fillStyle = '#433a10'; ctx.fillRect(x - 1, y - 4, 2, 8);
        ctx.fillStyle = c; ctx.fillRect(x - 2, y - 9, 4, 2.5);
        break;
      case 'health':
        ctx.fillStyle = c; ctx.fillRect(x - 6, y - 2, 12, 4); ctx.fillRect(x - 2, y - 6, 4, 12);
        break;
      case 'chip':
        ctx.fillStyle = c; rrect(ctx, x - 7, y - 7, 14, 14, 2); ctx.fill();
        ctx.fillStyle = '#3d2c00'; ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
        ctx.fillStyle = c; for (let k = -1; k <= 1; k++) { ctx.fillRect(x + k * 4 - 0.8, y - 10, 1.6, 3); ctx.fillRect(x + k * 4 - 0.8, y + 7, 1.6, 3); }
        break;
      case 'memory':
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#efe6ff'; ctx.fillRect(x - 1, y - 4, 2, 8);
        break;
    }
  }
}

class Captive extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.layer = 'solid'; this.prog = 0; this.freed = false; this.bob = Math.random() * 5; }
  isSolid() { return !this.freed; }
  blocksSight() { return false; }
  canInteract() { return !this.freed; }
  label() { return 'حرّر الآلية السجينة (اضغط مطوّلاً)'; }
  hold() { return true; }
  update(dt) { this.bob += dt * 2; }
  free(g) {
    if (this.freed) return;
    this.freed = true; this.L.cellChanged(this.tx, this.ty);
    Sound.at('pickup', this.x, this.y); FX.burst(this.x, this.y, 20, PAL.gold, 140, 0.7, 1.8); FX.text(this.x, this.y - 16, 'شكراً لك!', PAL.gold);
    g.event('rescue', this);
  }
  draw(ctx, t) {
    if (this.freed) return;
    const x = this.x, y = this.y;
    ctx.fillStyle = '#1d232a'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b9c2cc'; ctx.beginPath(); ctx.arc(x, y + Math.sin(this.bob) * 1.2, 6.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4c5866'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.stroke();
    ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(x + k * 5, y - 12); ctx.lineTo(x + k * 5, y + 12); } ctx.stroke();
  }
  emit(ctx, t, g, glow) {
    if (this.freed) return;
    ctx.fillStyle = col(PAL.gold, 0.6 + 0.4 * Math.sin(t * 0.005)); ctx.beginPath(); ctx.arc(this.x + 2, this.y - 1, 1.6, 0, TAU); ctx.fill();
    if (this.prog > 0) { ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(this.x, this.y, 17, -Math.PI / 2, -Math.PI / 2 + TAU * this.prog); ctx.stroke(); }
  }
}

// «المرسى»: نقطة استراحة — حفظ + ترميم كامل + تبديل التمائم (يلزم التفاعل)
class Checkpoint extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.active = false; this.rested = false; this.ph = Math.random() * 6; }
  canInteract() { return true; }
  label() { return this.rested ? 'افتح التمائم' : 'استرح في المرسى (حفظ وترميم)'; }
  interact(g) { if (this.rested) UI.openCharms(true); else g.rest(this); }
  update(dt, g) {
    this.ph += dt;
    const p = g.player;
    if (this.rested && p && dist2(p.x, p.y, this.x, this.y) > (2.3 * T) ** 2) this.rested = false;
  }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#14181d'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a4450'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#56616e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 2, 10, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.fillStyle = '#2a313a'; ctx.fillRect(x - 11, y + 4, 22, 4);
  }
  emit(ctx, t, g, glow) {
    const c = this.active ? PAL.mint : '#8fa3b5', a = this.active ? 0.6 + 0.3 * Math.sin(this.ph * 2.5) : 0.35 + 0.15 * Math.sin(this.ph * 1.5);
    ctx.strokeStyle = col(c, a); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, 7, 0, TAU); ctx.stroke();
    ctx.fillStyle = col(c, Math.min(1, a + 0.2)); ctx.beginPath(); ctx.arc(this.x, this.y, 2.6, 0, TAU); ctx.fill();
    if (!glow && this.active) txtLabel(ctx, 'مرسى', this.x, this.y - 21, col(PAL.mint, 0.8), 8);
  }
}

// «لوح منقوش»: نصوص اختيارية تُقرأ بالتفاعل (بديل الرسائل المزعجة)
class Tablet extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.mem = spec.mem || null; this.text = spec.text || ''; this.read = false; this.ph = Math.random() * 6; }
  canInteract() { return true; }
  label() { return this.mem ? 'اقرأ لوح الذاكرة' : 'اقرأ اللوح المنقوش'; }
  interact(g) { g.readTablet(this); }
  update(dt) { this.ph += dt; }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 10, y - 6, 22, 16);
    ctx.fillStyle = this.mem ? '#2a2433' : '#20252c'; rrect(ctx, x - 11, y - 9, 22, 18, 3); ctx.fill();
    ctx.strokeStyle = this.mem ? '#4d3f63' : '#38424e'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  emit(ctx, t, g, glow) {
    const c = this.mem ? PAL.gold : '#7fe0d0', a = this.read ? 0.3 : 0.55 + 0.35 * Math.sin(this.ph * 2.2);
    ctx.strokeStyle = col(c, a); ctx.lineWidth = 1.3; ctx.beginPath();
    ctx.moveTo(this.x - 6, this.y - 4); ctx.lineTo(this.x + 6, this.y - 4);
    ctx.moveTo(this.x - 6, this.y); ctx.lineTo(this.x + 3, this.y);
    ctx.moveTo(this.x - 6, this.y + 4); ctx.lineTo(this.x + 5, this.y + 4);
    ctx.stroke();
    if (!this.read) { ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.arc(this.x + 7, this.y - 7, 1.8, 0, TAU); ctx.fill(); }
  }
}

// «فانوس»: بائع التمائم العجوز
class Npc extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.layer = 'solid'; this.id = spec.id || 'fanous'; this.ph = Math.random() * 6; this.face = Math.PI / 2; }
  isSolid() { return true; }
  blocksSight() { return false; }
  canInteract() { return true; }
  label() { return 'تحدّث إلى ' + ((NPC_LINES[this.id] || {}).name || 'الغريب'); }
  interact(g) { g.talkTo(this); }
  update(dt, g) {
    this.ph += dt;
    const p = g.player;
    if (p && dist2(p.x, p.y, this.x, this.y) < (5 * T) ** 2) this.face += angDiff(this.face, Math.atan2(p.y - this.y, p.x - this.x)) * Math.min(1, dt * 3);
  }
  draw(ctx) {
    const x = this.x, y = this.y + Math.sin(this.ph * 1.3) * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 12, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3b3530'; ctx.beginPath(); ctx.moveTo(x - 12, y + 10); ctx.quadraticCurveTo(x - 10, y - 6, x, y - 7); ctx.quadraticCurveTo(x + 10, y - 6, x + 12, y + 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5a5047'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 7, y + 9); ctx.lineTo(x - 5, y - 2); ctx.moveTo(x + 7, y + 9); ctx.lineTo(x + 5, y - 2); ctx.stroke();
    ctx.fillStyle = '#2a2622'; rrect(ctx, x - 5.5, y - 17, 11, 12, 3); ctx.fill();
    ctx.strokeStyle = '#6b5f52'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5.5, y - 13); ctx.lineTo(x + 5.5, y - 13); ctx.moveTo(x, y - 17); ctx.lineTo(x, y - 5); ctx.stroke();
    ctx.strokeStyle = '#7a6d5e'; ctx.beginPath(); ctx.arc(x, y - 19, 3, Math.PI, 0); ctx.stroke();
  }
  emit(ctx, t, g, glow) {
    const fl = 0.75 + 0.25 * Math.sin(this.ph * 7) * Math.sin(this.ph * 3.1);
    ctx.globalAlpha = 0.55 * fl; ctx.drawImage(Sprites.glow('#ffc070'), this.x - 14, this.y - 25, 28, 28); ctx.globalAlpha = 1;
    ctx.fillStyle = col('#ffd890', fl); ctx.beginPath(); ctx.arc(this.x, this.y - 11 + Math.sin(this.ph * 1.3) * 0.8, 3, 0, TAU); ctx.fill();
    if (!glow) txtLabel(ctx, (NPC_LINES[this.id] || {}).name || '', this.x, this.y - 28, col('#ffd890', 0.85), 8.5);
  }
}

class Exit extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.open = false; this.anim = 0; }
  update(dt, g) {
    const was = this.open;
    this.open = g.missions ? g.missions.exitReady() : false;
    if (this.open && !was) { Sound.play('exit'); g.toast('مِصعد الأجراس يعمل! اصعد إليه'); g.event('exitOpen', this); }
    this.anim += dt;
    if (this.open && g.player && g.player.alive && g.player.onTile(this.tx, this.ty)) g.levelComplete();
    if (this.open && Math.random() < dt * 8) FX.add(1, this.x + rand(-11, 11), this.y + rand(-11, 11), 0, -40, 0.8, 2, PAL.mint, 0.5);
  }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#101418'; ctx.fillRect(x - 15, y - 15, 30, 30);
    ctx.strokeStyle = '#3a4450'; ctx.lineWidth = 2; ctx.strokeRect(x - 13, y - 13, 26, 26);
    ctx.fillStyle = '#d99a2b'; for (let k = 0; k < 4; k++) ctx.fillRect(x - 13 + k * 7, y - 15, 3.5, 2);
  }
  emit(ctx, t) {
    const c = this.open ? PAL.mint : PAL.red, p = 0.5 + 0.5 * Math.sin(t * 0.004);
    ctx.strokeStyle = col(c, 0.5 + p * 0.4); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(this.x, this.y, 9 + p * 2, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.x, this.y - 5); ctx.lineTo(this.x + 4, this.y + 1); ctx.lineTo(this.x - 4, this.y + 1); ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
  }
}

class Pylon extends Obj {
  constructor(L, tx, ty, spec) { super(L, tx, ty, spec); this.nodeId = spec.id; this.name = spec.label || spec.id; this.charge = 0; this.need = null; this.locked = false; }
  update(dt, g) { }
  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#141a20'; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3d4855'; ctx.lineWidth = 2; ctx.stroke();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.fillStyle = '#56616e'; ctx.fillRect(x + Math.cos(a) * 11 - 1.5, y + Math.sin(a) * 11 - 1.5, 3, 3); }
  }
  emit(ctx, t, g, glow) {
    const c = this.val ? PAL.mint : this.locked ? PAL.red : PAL.amber;
    ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(this.x, this.y, 8, 0, TAU); ctx.stroke();
    if (this.charge > 0 && !this.val) { ctx.strokeStyle = PAL.mint; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, 19, -Math.PI / 2, -Math.PI / 2 + TAU * this.charge); ctx.stroke(); }
    if (this.val) { ctx.fillStyle = col(PAL.mint, 0.7); ctx.beginPath(); ctx.arc(this.x, this.y, 5, 0, TAU); ctx.fill(); }
    if (!glow && this.need) txtLabel(ctx, this.val ? '✓ ' + this.name : this.need.t, this.x, this.y - 23, col(this.val ? PAL.mint : this.locked ? PAL.red : PAL.amber, 0.95), 9);
  }
}

// ---------------- اللاعب «نبض» ----------------
class Player {
  constructor(g, x, y) {
    this.g = g; this.x = x; this.y = y; this.r = T * 0.3; this.vx = 0; this.vy = 0; this.face = 0;
    this.hp = 4; this.maxHp = 4; this.energy = 100; this.maxEnergy = 100;
    this.inv = 0; this.dashT = 0; this.dashCd = 0; this.dashDX = 1; this.dashDY = 0; this.cloak = 0;
    this.alive = true; this.moving = false; this.sneak = false; this.stepT = 0; this.pushT = 0; this.hurtT = 0;
    this.speed = 0; this.busy = false; this.poly = new Float32Array(2048); this.polyN = 0; this.blink = 0; this.expT = 0;
    this.wasHit = false; this.focusing = false;
  }
  onTile(tx, ty) { return Math.floor(this.x / T) === tx && Math.floor(this.y / T) === ty; }
  get tx() { return Math.floor(this.x / T); }
  get ty() { return Math.floor(this.y / T); }
  dash() {
    if (this.dashCd > 0 || this.energy < 12 || this.busy) return false;
    let dx = Input.mx, dy = Input.my;
    if (Input.mag < 0.12) { dx = Math.cos(this.face); dy = Math.sin(this.face); }
    const l = Math.hypot(dx, dy) || 1;
    this.dashDX = dx / l; this.dashDY = dy / l; this.dashT = 0.17; this.dashCd = this.g.perk('leap') ? 0.45 : 0.85; this.energy -= 12;
    if (this.g.perk('leap')) this.inv = Math.max(this.inv, 0.22);
    Sound.play('dash'); this.g.noise(this.x, this.y, 5 * T, 'dash');
    for (let i = 0; i < 10; i++) FX.add(1, this.x + rand(-5, 5), this.y + rand(-5, 5), -this.dashDX * rand(60, 160), -this.dashDY * rand(60, 160), 0.35, 2, PAL.mint, 4);
    return true;
  }
  update(dt, g) {
    if (!this.alive) return;
    const L = g.L;
    this.inv = Math.max(0, this.inv - dt); this.dashCd = Math.max(0, this.dashCd - dt); this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.cloak > 0) { this.cloak -= dt; if (this.cloak <= 0) { this.cloak = 0; Sound.play('uncloak'); } }
    this.energy = Math.min(this.maxEnergy, this.energy + dt * 6.5 * (g.perk('pulse') ? 1.7 : 1));
    let ix = 0, iy = 0, mag = 0;
    if (!this.busy && !this.focusing) { ix = Input.mx; iy = Input.my; mag = Input.mag; }
    if (mag < 0.12) { ix = iy = 0; mag = 0; }
    this.sneak = mag > 0 && mag < 0.6;
    const spd = (mag === 0 ? 0 : this.sneak ? (g.perk('feather') ? 2.75 : 2.1) : 4.3) * T;
    let tvx = ix * spd, tvy = iy * spd;
    if (this.dashT > 0) { this.dashT -= dt; tvx = this.dashDX * 13 * T; tvy = this.dashDY * 13 * T; }
    const acc = this.dashT > 0 ? 40 : 16;
    this.vx = damp(this.vx, tvx, acc, dt); this.vy = damp(this.vy, tvy, acc, dt);
    const sp = Math.hypot(this.vx, this.vy); this.speed = sp;
    const steps = Math.max(1, Math.ceil(sp * dt / (this.r * 0.5)));
    for (let s = 0; s < steps; s++) { this.x += this.vx * dt / steps; this.y += this.vy * dt / steps; g.collide(this, this.r, L.move); }
    if (mag > 0) this.face += angDiff(this.face, Math.atan2(iy, ix)) * Math.min(1, dt * 16);
    this.moving = sp > 18;
    if (this.moving && !this.sneak) {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.36; g.noise(this.x, this.y, 3.3 * T * (g.perk('feather') ? 0.6 : 1), 'step'); Sound.play('step', 0.7); }
    } else this.stepT = Math.min(this.stepT, 0.1);
    // دفع الصناديق
    let pdx = 0, pdy = 0;
    if (mag > 0 && this.dashT <= 0) {
      const ax = Math.abs(ix), ay = Math.abs(iy);
      if (ax > 0.7 && ay < 0.55) pdx = Math.sign(ix); else if (ay > 0.7 && ax < 0.55) pdy = Math.sign(iy);
    }
    if (pdx || pdy) {
      const bx = this.tx + pdx, by = this.ty + pdy;
      const o = L.inb(bx, by) ? L.solidAt[L.idx(bx, by)] : null;
      if (o && o.type === 'box' && !o.moving) {
        const gap = pdx > 0 ? bx * T - (this.x + this.r) : pdx < 0 ? this.x - this.r - (bx + 1) * T : pdy > 0 ? by * T - (this.y + this.r) : this.y - this.r - (by + 1) * T;
        const lat = pdx ? Math.abs(this.y - (by + 0.5) * T) : Math.abs(this.x - (bx + 0.5) * T);
        if (gap < 3 && lat < T * 0.42) {
          this.pushT += dt;
          if (pdx) this.y = damp(this.y, (by + 0.5) * T, 10, dt); else this.x = damp(this.x, (bx + 0.5) * T, 10, dt);
          if (this.pushT > 0.14) {
            if (L.tryPushBox(o, pdx, pdy, g)) { Sound.at('push', o.x, o.y); g.noise(o.x, o.y, 2.4 * T, 'push'); g.event('push', o); }
            this.pushT = 0;
          }
        } else this.pushT = 0;
      } else this.pushT = 0;
    } else this.pushT = 0;
    // الأرضيات المكهربة
    const f = L.inb(this.tx, this.ty) ? L.floorAt[L.idx(this.tx, this.ty)] : null;
    if (f && f.type === 'hazard' && f.active && this.dashT <= 0) g.damagePlayer(1, 'hazard', this.x - this.vx * 0.1, this.y - this.vy * 0.1);
    // الاستكشاف (للخريطة الصغيرة)
    this.expT -= dt;
    if (this.expT <= 0) { this.expT = 0.15; g.explore(this.x, this.y, 6); }
    this.blink -= dt; if (this.blink < -3.2) this.blink = 0.12;
  }
  draw(ctx, t) {
    if (!this.alive) return;
    const x = this.x, y = this.y, r = this.r, f = this.face;
    const cl = this.cloak > 0;
    ctx.globalAlpha = cl ? 0.22 + 0.08 * Math.sin(t * 0.02) : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.6, r * 1.05, r * 0.5, 0, 0, TAU); ctx.fill();
    const bob = this.moving ? Math.sin(t * 0.026) * 1.1 : Math.sin(t * 0.004) * 0.6;
    const c = Math.cos(f), s = Math.sin(f);
    ctx.save(); ctx.translate(x, y + bob * 0.3); ctx.rotate(f);
    ctx.fillStyle = '#252a31';
    rrect(ctx, -r * 0.95, -r * 1.08, r * 1.9, r * 0.46, 3); ctx.fill();
    rrect(ctx, -r * 0.95, r * 0.62, r * 1.9, r * 0.46, 3); ctx.fill();
    ctx.fillStyle = '#3b424c';
    const tread = (t * 0.02 * (this.moving ? 1 : 0)) % 4;
    for (let k = -2; k <= 2; k++) { ctx.fillRect(k * 4 - tread, -r * 1.05, 1.5, r * 0.4); ctx.fillRect(k * 4 - tread, r * 0.65, 1.5, r * 0.4); }
    ctx.restore();
    ctx.fillStyle = this.hurtT > 0 && ((t * 0.03) | 0) % 2 ? '#ffb0b0' : '#e8eff3';
    ctx.beginPath(); ctx.arc(x, y + bob, r * 0.9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c3ced6'; ctx.beginPath(); ctx.arc(x, y + bob, r * 0.9, 0.2 * Math.PI, 0.95 * Math.PI); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - r * 0.3, y + bob - r * 0.35, r * 0.2, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y + bob); ctx.rotate(f);
    ctx.fillStyle = '#16212b'; rrect(ctx, r * 0.12, -r * 0.55, r * 0.66, r * 1.1, r * 0.32); ctx.fill();
    ctx.restore();
    const ax = x - c * r * 0.55, ay = y + bob - s * r * 0.55;
    ctx.strokeStyle = '#97a4b0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - c * 3, ay - 8); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  emit(ctx, t, glow) {
    if (!this.alive) return;
    const cl = this.cloak > 0;
    const bob = this.moving ? Math.sin(t * 0.026) * 1.1 : Math.sin(t * 0.004) * 0.6;
    const c = Math.cos(this.face), s = Math.sin(this.face);
    const ex = this.x + c * this.r * 0.5, ey = this.y + bob + s * this.r * 0.5;
    ctx.globalAlpha = cl ? 0.35 : 1;
    const ec = this.hurtT > 0 ? PAL.red : PAL.mint;
    ctx.fillStyle = ec;
    if (this.blink > 0) { ctx.fillRect(ex - 3, ey - 0.8, 6, 1.6); }
    else { ctx.beginPath(); ctx.arc(ex, ey, 2.8, 0, TAU); ctx.fill(); }
    const ax = this.x - c * this.r * 0.55 - c * 3, ay = this.y + bob - s * this.r * 0.55 - 8;
    ctx.fillStyle = col(PAL.mint, 0.6 + 0.4 * Math.sin(t * 0.006)); ctx.beginPath(); ctx.arc(ax, ay, 1.8, 0, TAU); ctx.fill();
    if (cl && !glow) { ctx.strokeStyle = col('#9fdcff', 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.2 + Math.sin(t * 0.01) * 1.5, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

class Bullet {
  constructor(x, y, vx, vy, owner, dmg = 1, color = PAL.red) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.owner = owner; this.dmg = dmg; this.color = color;
    this.life = 2.6; this.r = 3.2; this.alive = true;
  }
  update(dt, g) {
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }
    const L = g.L, sp = Math.hypot(this.vx, this.vy), n = Math.max(1, Math.ceil(sp * dt / 6));
    for (let i = 0; i < n; i++) {
      this.x += this.vx * dt / n; this.y += this.vy * dt / n;
      if (L.solidAtW(this.x, this.y)) {
        this.alive = false; FX.burst(this.x, this.y, 5, this.color, 90, 0.25, 1.4); return;
      }
      if (this.owner === 'enemy') {
        const p = g.player;
        if (p.alive && dist2(p.x, p.y, this.x, this.y) < (p.r + this.r) ** 2) {
          this.alive = false; g.damagePlayer(this.dmg, 'shot', this.x - this.vx * 0.05, this.y - this.vy * 0.05); return;
        }
      } else {
        for (const e of g.enemies) {
          if (!e.alive || !e.hittable) continue;
          if (dist2(e.x, e.y, this.x, this.y) < (e.r + this.r) ** 2) { this.alive = false; e.hit(g, this.dmg, 'friendly'); FX.burst(this.x, this.y, 6, this.color, 90, 0.25, 1.4); return; }
        }
      }
    }
  }
  emit(ctx) {
    ctx.strokeStyle = col(this.color, 0.55); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, TAU); ctx.fill(); ctx.lineCap = 'butt';
  }
}

class Decoy {
  constructor(x, y) { this.x = x; this.y = y; this.life = 8; this.ping = 0; this.alive = true; this.face = Math.random() * TAU; }
  update(dt, g) {
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; FX.burst(this.x, this.y, 12, PAL.cyan, 80, 0.4, 1.5, 1); return; }
    this.ping -= dt;
    if (this.ping <= 0) { this.ping = 1.1; g.noise(this.x, this.y, 7.5 * T, 'decoy', this); Sound.at('decoyPing', this.x, this.y); FX.ring(this.x, this.y, 4, 46, 0.8, PAL.cyan, 2); }
    this.face += dt * 1.5;
  }
  emit(ctx, t, glow) {
    const fl = 0.45 + 0.25 * Math.sin(t * 0.03) + (Math.random() < 0.05 ? -0.3 : 0);
    ctx.globalAlpha = clamp(fl, 0.1, 1) * Math.min(1, this.life);
    ctx.strokeStyle = PAL.cyan; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(this.x, this.y, T * 0.27, 0, TAU); ctx.stroke();
    ctx.fillStyle = col(PAL.cyan, 0.25); ctx.fill();
    ctx.fillStyle = PAL.cyan; ctx.beginPath(); ctx.arc(this.x + Math.cos(this.face) * 4, this.y + Math.sin(this.face) * 4, 2.2, 0, TAU); ctx.fill();
    if (!glow) { ctx.strokeStyle = col(PAL.cyan, 0.3); ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(this.x - 9, this.y + k * 3.5); ctx.lineTo(this.x + 9, this.y + k * 3.5); } ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}
