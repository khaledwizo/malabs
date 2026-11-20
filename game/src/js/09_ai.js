// ===================== الذكاء الاصطناعي =====================
// زمن الاعتراض للتصويب التنبّئي: |d + v t| = s t
function interceptTime(dx, dy, vx, vy, s) {
  const a = vx * vx + vy * vy - s * s, b = 2 * (dx * vx + dy * vy), c = dx * dx + dy * dy;
  if (Math.abs(a) < 1e-6) return b !== 0 ? clamp(-c / b, 0, 2) : 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 0;
  const sq = Math.sqrt(disc), t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
  const lo = Math.min(t1, t2), hi = Math.max(t1, t2);
  const t = lo > 0 ? lo : hi;
  return t > 0 ? Math.min(t, 2) : 0;
}

// إحساس بصري مشترك (مخروط رؤية + خط نظر + عوامل الضوء والحركة)
function senseCone(a, g, view, fov, rateMul, thermal) {
  const p = g.player;
  a.canSee = false;
  if (!p.alive || g.demo) return;
  const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
  if (d > view + p.r) return;
  let vis = false;
  if (d < T * 0.95) vis = g.L.los(a.x, a.y, p.x, p.y);
  else {
    const off = Math.abs(angDiff(a.face, Math.atan2(dy, dx)));
    if (off < fov / 2 + Math.atan2(p.r, d)) vis = g.L.los(a.x, a.y, p.x, p.y);
  }
  if (vis && p.cloak > 0 && !(thermal && d < thermal)) vis = d < T * 0.7;
  if (!vis) return;
  a.canSee = true;
  const near = clamp(1 - d / view, 0, 1);
  const lit = clamp(g.L.litAt(p.x, p.y), 0, 1.2);
  const light = 0.72 + lit * 0.6;
  const mv = p.dashT > 0 ? 1.35 : p.sneak ? 0.78 : p.moving ? 1.15 : 0.55;
  let rate = (0.42 + 2.7 * near * near) * light * mv * g.diff.detect * rateMul;
  if (d < T * 1.5) rate = 12;
  a.sus = Math.min(1, a.sus + rate * g.dt);
  a.lastX = p.x; a.lastY = p.y; a.lastVX = p.vx; a.lastVY = p.vy; a.seenT = 0;
}

function solidMarker(L, tx, ty, type) {
  const m = { type, layer: 'solid', x: (tx + 0.5) * T, y: (ty + 0.5) * T, tx, ty, isSolid() { return true; }, blocksSight() { return false; }, canInteract() { return false; } };
  if (L.inb(tx, ty) && !L.solidAt[L.idx(tx, ty)]) { L.solidAt[L.idx(tx, ty)] = m; L.cellUpdate(L.idx(tx, ty)); }
}

// ---------------- قاعدة مشتركة لمن يتحرك بمسار ----------------
class Agent {
  constructor(g, x, y, r) {
    this.g = g; this.x = x; this.y = y; this.sx = x; this.sy = y; this.r = r; this.vx = 0; this.vy = 0; this.face = 0;
    this.path = null; this.pi = 0; this.repath = 0; this.goalX = 0; this.goalY = 0; this.navV = 0;
    this.alive = true; this.hittable = true; this.pressesPlates = false; this.canSee = false; this.sus = 0; this.seenT = 99;
    this.lastX = x; this.lastY = y; this.lastVX = 0; this.lastVY = 0; this.stunT = 0; this.state = 'idle'; this.stateT = 0;
    this.icon = ''; this.iconT = 0; this.hearMult = 1; this.grid = 'move';
  }
  faceTo(a, dt, rate) { this.face += angDiff(this.face, a) * Math.min(1, dt * rate); }
  moveTo(x, y, speedTiles, dt, avoidLaser = true) {
    const g = this.g, L = g.L, grid = L[this.grid];
    if (!this.path || this.repath <= 0 || dist2(x, y, this.goalX, this.goalY) > (T * 0.75) ** 2 || this.navV !== L.navVersion) {
      this.path = L.findPath(this.x, this.y, x, y, grid, avoidLaser);
      this.pi = 0; this.goalX = x; this.goalY = y; this.repath = 0.45 + Math.random() * 0.2; this.navV = L.navVersion;
    }
    const P = this.path;
    if (!P) { this.vx = this.vy = 0; return dist2(this.x, this.y, x, y) < (T * 0.6) ** 2; }
    if (this.pi * 2 >= P.length) { this.vx = this.vy = 0; return true; }
    const px = P[this.pi * 2], py = P[this.pi * 2 + 1];
    const dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy);
    if (d < 4) { this.pi++; return this.pi * 2 >= P.length; }
    const sp = speedTiles * T, step = Math.min(d, sp * dt);
    this.vx = dx / d * sp; this.vy = dy / d * sp;
    this.x += dx / d * step; this.y += dy / d * step;
    g.collide(this, this.r * 0.85, grid);
    this.faceTo(Math.atan2(dy, dx), dt, 6);
    return false;
  }
  reset() { this.x = this.sx; this.y = this.sy; this.path = null; this.sus = 0; this.stunT = 0; this.seenT = 99; }
}

// ---------------- الحارس الطائر ----------------
class Drone extends Agent {
  constructor(g, spec, tx, ty) {
    super(g, (tx + 0.5) * T, (ty + 0.5) * T, T * 0.32);
    this.kind = 'drone';
    this.face = this.face0 = (spec.face || 0) * Math.PI / 180;
    this.route = (spec.route || '').split('').map(ch => g.L.waypoints[ch]).filter(Boolean);
    if (!this.route.length) this.route = [{ x: this.x, y: this.y }];
    this.wp = 0; this.view = (spec.view || 6.5) * T; this.fov = (spec.fov || 70) * Math.PI / 180; this.spd = spec.speed || 1;
    this.state = 'patrol'; this.wait = 0; this.shootCd = 1; this.alertCd = 0; this.strafe = chance(0.5) ? 1 : -1;
    this.tgtX = 0; this.tgtY = 0; this.hover = Math.random() * 10; this.poly = new Float32Array(2 * 140); this.polyN = 0;
    this.ignoreDecoy = 0;
  }
  setState(s) {
    const g = this.g, prev = this.state;
    this.state = s; this.stateT = 0; this.path = null;
    if (s === 'chase' && prev !== 'chase') { this.icon = '!'; this.iconT = 1.6; Sound.at('alarm', this.x, this.y); g.onDetected(this); }
    else if (s === 'suspicious' && prev !== 'suspicious') { this.icon = '?'; this.iconT = 1.2; Sound.at('sus', this.x, this.y); }
    else if (s === 'investigate') { this.icon = '?'; this.iconT = 1; }
    else if (s === 'search') this.strafe = chance(0.5) ? 1 : -1;
    else if (s === 'return') {
      let best = 0, bd = Infinity;
      this.route.forEach((w, i) => { const d = dist2(w.x, w.y, this.x, this.y); if (d < bd) { bd = d; best = i; } });
      this.wp = best;
    }
  }
  investigate(x, y) { this.tgtX = x; this.tgtY = y; this.setState('investigate'); }
  hear(x, y, kind) {
    if (!this.alive || this.stunT > 0 || this.state === 'chase') return;
    if (kind === 'decoy' && this.ignoreDecoy && Math.random() < this.ignoreDecoy) return;
    this.investigate(x, y);
  }
  alert(x, y, k) {
    if (!this.alive || this.stunT > 0 || this.state === 'chase') return;
    const a = k * 2.1 + Math.random();
    let tx = x + Math.cos(a) * T * 1.8, ty = y + Math.sin(a) * T * 1.8;
    if (this.g.L.solidAtW(tx, ty)) { tx = x; ty = y; }
    this.investigate(tx, ty); this.sus = Math.max(this.sus, 0.55); this.icon = '!'; this.iconT = 1;
  }
  stun(sec) {
    if (!this.alive) return;
    this.stunT = Math.max(this.stunT, sec); this.sus = 0; this.canSee = false; this.path = null;
    Sound.at('stun', this.x, this.y); FX.burst(this.x, this.y, 12, PAL.cyan, 120, 0.4, 1.4);
  }
  hit(g, dmg, src) { this.stun(src === 'laser' ? 3 : 2.5); }
  reset() { super.reset(); this.state = 'patrol'; this.wp = 0; this.wait = 0; this.face = this.face0; }
  update(dt, g) {
    if (!this.alive) return;
    this.hover += dt; this.repath -= dt; this.shootCd -= dt; this.stateT += dt; this.iconT -= dt; this.alertCd -= dt;
    if (this.stunT > 0) {
      this.stunT -= dt; this.canSee = false;
      if (Math.random() < dt * 10) FX.add(0, this.x + rand(-8, 8), this.y + rand(-8, 8), rand(-90, 90), rand(-90, 90), 0.3, 1.2, PAL.cyan);
      if (this.stunT <= 0) this.setState('search');
      return;
    }
    senseCone(this, g, this.view * g.diff.view, this.fov, 1, 0);
    if (!this.canSee) { this.seenT += dt; if (this.state !== 'chase') this.sus = Math.max(0, this.sus - dt * 0.22); }
    switch (this.state) {
      case 'patrol': this.patrol(dt); if (this.canSee) this.setState('suspicious'); break;
      case 'suspicious':
        this.faceTo(Math.atan2(this.lastY - this.y, this.lastX - this.x), dt, 5);
        if (this.sus >= 1) this.setState('chase');
        else if (!this.canSee && this.seenT > 0.5) this.investigate(this.lastX, this.lastY);
        else if (this.canSee && this.stateT > 0.6) this.moveTo(this.lastX, this.lastY, 0.7 * this.spd, dt);
        break;
      case 'investigate':
        if (this.canSee) {
          if (this.sus >= 1) { this.setState('chase'); break; }
          this.faceTo(Math.atan2(this.lastY - this.y, this.lastX - this.x), dt, 5);
          this.tgtX = this.lastX; this.tgtY = this.lastY;
        }
        if (this.moveTo(this.tgtX, this.tgtY, 2.5 * this.spd, dt) || this.stateT > 12) this.setState('search');
        break;
      case 'search':
        this.face += dt * 1.7 * this.strafe;
        if (((this.stateT * 0.8) | 0) % 2 === 1) this.face -= dt * 3.4 * this.strafe;
        if (this.canSee && this.sus > 0.3) this.setState('suspicious');
        if (this.sus >= 1) this.setState('chase');
        if (this.stateT > 4.2) this.setState('return');
        break;
      case 'return': {
        if (this.canSee) { this.setState('suspicious'); break; }
        const w = this.route[this.wp];
        if (this.moveTo(w.x, w.y, 1.9 * this.spd, dt)) this.setState('patrol');
        break;
      }
      case 'chase': this.chase(dt, g); break;
    }
  }
  patrol(dt) {
    const w = this.route[this.wp];
    if (this.route.length === 1) {
      if (dist2(this.x, this.y, w.x, w.y) > 9) this.moveTo(w.x, w.y, 1.6 * this.spd, dt);
      else this.faceTo(this.face0 + Math.sin(this.stateT * 0.55) * 1.0, dt, 3);
      return;
    }
    if (this.wait > 0) { this.wait -= dt; this.face += Math.sin(this.stateT * 2.2) * dt * 1.3; return; }
    if (this.moveTo(w.x, w.y, 1.7 * this.spd, dt)) { this.wp = (this.wp + 1) % this.route.length; this.wait = 1.1; }
  }
  chase(dt, g) {
    const p = g.player;
    if (!p.alive) { this.setState('return'); return; }
    if (this.canSee) {
      this.sus = 1;
      const d = dist(this.x, this.y, p.x, p.y), ang = Math.atan2(p.y - this.y, p.x - this.x);
      this.faceTo(ang, dt, 9);
      if (d > 3.2 * T) this.moveTo(p.x, p.y, 3.4 * this.spd, dt, false);
      else {
        const sa = ang + Math.PI / 2 * this.strafe, sp = 1.5 * T * dt;
        const nx = this.x + Math.cos(sa) * sp, ny = this.y + Math.sin(sa) * sp;
        if (g.L.solidAtW(nx + Math.cos(sa) * this.r, ny + Math.sin(sa) * this.r)) this.strafe *= -1;
        else { this.x = nx; this.y = ny; g.collide(this, this.r * 0.85, g.L.move); }
      }
      if (this.shootCd <= 0 && d < 8 * T) { this.shoot(g); this.shootCd = 1.15 / g.diff.fire; }
      if (this.alertCd <= 0) { this.alertCd = 1.5; g.alertNearby(this, p.x, p.y); }
    } else {
      const px = this.lastX + this.lastVX * 0.6, py = this.lastY + this.lastVY * 0.6;
      if (this.moveTo(px, py, 3.3 * this.spd, dt, false) || this.seenT > 3.2) { this.sus = 0.6; this.setState('search'); }
    }
  }
  shoot(g) {
    const p = g.player, spd = 8.5 * T;
    const dx = p.x - this.x, dy = p.y - this.y, t = interceptTime(dx, dy, p.vx, p.vy, spd);
    const a = Math.atan2(dy + p.vy * t, dx + p.vx * t) + rand(-0.07, 0.07) * g.diff.spread;
    const sx = this.x + Math.cos(a) * this.r, sy = this.y + Math.sin(a) * this.r;
    g.bullets.push(new Bullet(sx, sy, Math.cos(a) * spd, Math.sin(a) * spd, 'enemy', 1, PAL.red));
    Sound.at('shot', this.x, this.y); FX.burst(sx, sy, 4, PAL.amber, 80, 0.2, 1.2);
  }
  coneColor() { return this.state === 'chase' ? PAL.red : (this.state === 'patrol' || this.state === 'return') ? '#ffcf6b' : PAL.yellow; }
  prepare(g) {
    if (!this.alive || this.stunT > 0) { this.polyN = 0; return; }
    const n = Math.min(R.q.coneRays, 138), v = this.view * g.diff.view;
    this.poly[0] = this.x; this.poly[1] = this.y;
    const tmp = this.poly.subarray(2);
    g.L.castPoly(this.x, this.y, v, this.face - this.fov / 2, this.face + this.fov / 2, n, tmp, false);
    this.polyN = n + 1;
  }
  draw(ctx, t) {
    if (!this.alive) return;
    const x = this.x, y = this.y + Math.sin(this.hover * 3) * 1.5, r = this.r;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + r * 1.1, r * 0.9, r * 0.38, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(this.face);
    ctx.fillStyle = '#2a2f37';
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.36, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(180,190,200,0.35)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, ra = this.hover * 40 + k; const cx = Math.cos(a) * r * 0.95, cy = Math.sin(a) * r * 0.95; ctx.beginPath(); ctx.moveTo(cx + Math.cos(ra) * r * 0.33, cy + Math.sin(ra) * r * 0.33); ctx.lineTo(cx - Math.cos(ra) * r * 0.33, cy - Math.sin(ra) * r * 0.33); ctx.stroke(); }
    ctx.fillStyle = this.stunT > 0 ? '#3a4a5a' : '#3b424d'; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.fill();
    ctx.fillStyle = '#545d6a'; ctx.beginPath(); ctx.arc(-r * 0.12, -r * 0.12, r * 0.45, 0, TAU); ctx.fill();
    ctx.fillStyle = '#14171b'; ctx.beginPath(); ctx.arc(r * 0.42, 0, r * 0.26, 0, TAU); ctx.fill();
    ctx.restore();
  }
  emit(ctx, t, g, glow) {
    if (!this.alive) return;
    const y = this.y + Math.sin(this.hover * 3) * 1.5;
    if (!glow && this.polyN > 2) {
      const c = this.coneColor(), a = this.state === 'chase' ? 0.17 : this.state === 'patrol' || this.state === 'return' ? 0.09 : 0.13;
      const P = this.poly;
      ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.moveTo(P[0], P[1]);
      for (let i = 1; i < this.polyN; i++) ctx.lineTo(P[i * 2], P[i * 2 + 1]);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = col(c, a * 2.2); ctx.lineWidth = 1; ctx.stroke();
    }
    const ex = this.x + Math.cos(this.face) * this.r * 0.42, ey = y + Math.sin(this.face) * this.r * 0.42;
    const ec = this.stunT > 0 ? (Math.random() < 0.5 ? PAL.cyan : '#223') : this.state === 'chase' ? PAL.red : this.state === 'patrol' || this.state === 'return' ? PAL.amber : PAL.yellow;
    ctx.fillStyle = ec; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, TAU); ctx.fill();
    if (glow) return;
    if (this.sus > 0.02 && this.state !== 'chase') {
      ctx.strokeStyle = col(PAL.yellow, 0.9); ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(this.x, y - this.r - 9, 5.5, -Math.PI / 2, -Math.PI / 2 + TAU * this.sus); ctx.stroke();
    }
    if (this.iconT > 0 && this.icon) txtLabel(ctx, this.icon, this.x, y - this.r - 9, this.icon === '!' ? PAL.red : PAL.yellow, 13);
    else if (this.stunT > 0) txtLabel(ctx, 'z', this.x + 8, y - this.r - 6 - (t * 0.01) % 6, PAL.cyan, 10);
    if (Settings.aiDebug) aiDebugDraw(ctx, this, y);
  }
}

function aiDebugDraw(ctx, a, y) {
  const names = { patrol: 'دورية', suspicious: 'شك', investigate: 'تحقّق', search: 'بحث', return: 'عودة', chase: 'مطاردة', scan: 'مسح', track: 'تتبّع', fire: 'إطلاق', prowl: 'تجوّل', hunt: 'صيد', idle: 'سرب', recoil: 'تراجع', lost: 'فقد الأثر' };
  txtLabel(ctx, (names[a.state] || a.state) + (a.sus ? ' ' + Math.round(a.sus * 100) + '%' : ''), a.x, y + a.r + 10, '#ffffff', 8);
  const P = a.path;
  if (P && P.length >= 2) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(a.x, a.y);
    for (let i = a.pi * 2; i < P.length; i += 2) ctx.lineTo(P[i], P[i + 1]);
    ctx.stroke(); ctx.setLineDash([]);
  }
}

// ---------------- البرج الثابت ----------------
class Turret extends Agent {
  constructor(g, spec, tx, ty) {
    super(g, (tx + 0.5) * T, (ty + 0.5) * T, T * 0.36);
    this.kind = 'turret'; this.base = (spec.face || 0) * Math.PI / 180; this.face = this.base; this.sweep = (spec.sweep ?? 100) * Math.PI / 180;
    this.view = (spec.view || 7.5) * T; this.fov = (spec.fov || 44) * Math.PI / 180; this.offNode = spec.off || null; this.friendNode = spec.friend || null;
    this.state = 'scan'; this.cd = 0; this.burst = 0; this.burstT = 0; this.hittable = false; this.off = false; this.friendly = false;
    this.poly = new Float32Array(2 * 140); this.polyN = 0; this.ph = Math.random() * 10; this.target = null;
    solidMarker(g.L, tx, ty, 'turret');
  }
  stun(sec) { this.stunT = Math.max(this.stunT, sec); this.sus = 0; Sound.at('stun', this.x, this.y); FX.burst(this.x, this.y, 10, PAL.cyan, 110, 0.4, 1.4); }
  hear() { }
  alert(x, y) { if (this.state === 'scan' && !this.off) { this.face = Math.atan2(y - this.y, x - this.x); } }
  hit() { }
  reset() { this.sus = 0; this.state = 'scan'; this.stunT = 0; this.face = this.base; }
  setState(s) {
    const prev = this.state; this.state = s; this.stateT = 0;
    if (s === 'fire' && prev !== 'fire') { this.icon = '!'; this.iconT = 1.4; Sound.at('alarm', this.x, this.y); this.g.onDetected(this); }
    if (s === 'track' && prev === 'scan') { this.icon = '?'; this.iconT = 1; Sound.at('sus', this.x, this.y); }
  }
  update(dt, g) {
    this.cd -= dt; this.stateT += dt; this.iconT -= dt; this.ph += dt;
    this.off = !!(this.offNode && g.L.nodeVal(this.offNode));
    this.friendly = !!(this.friendNode && g.L.nodeVal(this.friendNode));
    if (this.off) { this.canSee = false; this.sus = 0; return; }
    if (this.stunT > 0) { this.stunT -= dt; this.canSee = false; if (Math.random() < dt * 8) FX.add(0, this.x, this.y, rand(-80, 80), rand(-80, 80), 0.3, 1.2, PAL.cyan); return; }
    if (this.friendly) { this.friendlyUpdate(dt, g); return; }
    senseCone(this, g, this.view * g.diff.view, this.fov, 1.1, 0);
    if (!this.canSee) { this.seenT += dt; this.sus = Math.max(0, this.sus - dt * 0.3); }
    switch (this.state) {
      case 'scan':
        this.face = this.base + Math.sin(this.ph * 0.7) * this.sweep / 2;
        if (this.canSee) this.setState('track');
        break;
      case 'track':
        if (this.canSee) this.faceTo(Math.atan2(this.lastY - this.y, this.lastX - this.x), dt, 3);
        if (this.sus >= 1) this.setState('fire');
        else if (this.seenT > 1.2) this.setState('scan');
        break;
      case 'fire': {
        const p = g.player;
        if (this.canSee) {
          const spd = 10 * T, dx = p.x - this.x, dy = p.y - this.y, t = interceptTime(dx, dy, p.vx, p.vy, spd);
          this.faceTo(Math.atan2(dy + p.vy * t, dx + p.vx * t), dt, 7);
          if (this.cd <= 0) {
            if (this.burst <= 0) this.burst = 3;
            const a = this.face + rand(-0.05, 0.05) * g.diff.spread;
            g.bullets.push(new Bullet(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, Math.cos(a) * spd, Math.sin(a) * spd, 'enemy', 1, PAL.red));
            Sound.at('tshot', this.x, this.y);
            this.burst--; this.cd = this.burst > 0 ? 0.13 : 1.1 / g.diff.fire;
          }
          if (this.stateT > 1 && this.iconT < 0) g.alertNearby(this, p.x, p.y);
        }
        if (this.seenT > 1.6) { this.sus = 0.5; this.setState('scan'); }
        break;
      }
    }
  }
  friendlyUpdate(dt, g) {
    this.state = 'friendly';
    let best = null, bd = this.view * this.view;
    for (const e of g.enemies) {
      if (!e.alive || !e.hittable || e === this || (e.stunT > 0 && e.kind !== 'swarm')) continue;
      const d = dist2(e.x, e.y, this.x, this.y);
      if (d < bd && g.L.los(this.x, this.y, e.x, e.y)) { bd = d; best = e; }
    }
    if (!best) { this.face = this.base + Math.sin(this.ph * 0.7) * this.sweep / 2; return; }
    const a = Math.atan2(best.y - this.y, best.x - this.x);
    this.faceTo(a, dt, 8);
    if (this.cd <= 0 && Math.abs(angDiff(this.face, a)) < 0.15) {
      const spd = 11 * T;
      g.bullets.push(new Bullet(this.x + Math.cos(this.face) * this.r, this.y + Math.sin(this.face) * this.r, Math.cos(this.face) * spd, Math.sin(this.face) * spd, 'friendly', 1, PAL.mint));
      Sound.at('tshot', this.x, this.y); this.cd = 0.45;
    }
  }
  prepare(g) {
    if (this.off || this.stunT > 0) { this.polyN = 0; return; }
    const n = Math.min(R.q.coneRays, 138), v = this.view * g.diff.view;
    this.poly[0] = this.x; this.poly[1] = this.y;
    g.L.castPoly(this.x, this.y, v, this.face - this.fov / 2, this.face + this.fov / 2, n, this.poly.subarray(2), false);
    this.polyN = n + 1;
  }
  draw(ctx) {
    const x = this.x, y = this.y, r = this.r;
    ctx.fillStyle = '#1e2329'; rrect(ctx, x - 14, y - 14, 28, 28, 5); ctx.fill();
    ctx.strokeStyle = '#3c444f'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(this.face);
    ctx.fillStyle = this.friendly ? '#2c4a45' : '#3a414c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20252b'; ctx.fillRect(r * 0.3, -2.5, r * 1.1, 5);
    ctx.restore();
  }
  emit(ctx, t, g, glow) {
    if (!glow && this.polyN > 2) {
      const c = this.friendly ? PAL.mint : this.state === 'fire' ? PAL.red : this.state === 'track' ? PAL.yellow : '#ffcf6b';
      const a = this.state === 'fire' ? 0.16 : 0.1, P = this.poly;
      ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.moveTo(P[0], P[1]);
      for (let i = 1; i < this.polyN; i++) ctx.lineTo(P[i * 2], P[i * 2 + 1]);
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = col(c, a * 2); ctx.lineWidth = 1; ctx.stroke();
    }
    const c = this.off ? '#334' : this.friendly ? PAL.mint : this.stunT > 0 ? PAL.cyan : this.state === 'fire' ? PAL.red : PAL.amber;
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, TAU); ctx.fill();
    if (!glow) {
      if (this.iconT > 0 && this.icon) txtLabel(ctx, this.icon, this.x, this.y - 22, this.icon === '!' ? PAL.red : PAL.yellow, 13);
      if (this.sus > 0.02 && this.state === 'track') { ctx.strokeStyle = PAL.yellow; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y - 22, 5.5, -Math.PI / 2, -Math.PI / 2 + TAU * this.sus); ctx.stroke(); }
      if (this.off) txtLabel(ctx, 'معطّل', this.x, this.y - 20, '#8b98a6', 8);
      if (Settings.aiDebug) aiDebugDraw(ctx, this, this.y);
    }
  }
}

// ---------------- السرب: عشّ + آليات بسلوك الطيور (Boids) ----------------
class Nest extends Agent {
  constructor(g, spec, tx, ty) {
    super(g, (tx + 0.5) * T, (ty + 0.5) * T, T * 0.45);
    this.kind = 'nest'; this.max = spec.max || 6; this.rate = spec.rate || 3.5; this.t = 1.5; this.offNode = spec.off || null; this.off = false;
    this.hittable = false; this.pulse = 0; this.field = new Int16Array(g.L.N);
    solidMarker(g.L, tx, ty, 'nest');
    g.L.flow(this.x, this.y, g.L.fly, 60, this.field);
  }
  hear() { } alert() { } stun() { } hit() { }
  reset() { this.t = 2; }
  update(dt, g) {
    this.pulse += dt;
    const was = this.off;
    this.off = !!(this.offNode && g.L.nodeVal(this.offNode));
    if (this.off && !was) { FX.burst(this.x, this.y, 30, PAL.magenta, 160, 0.8, 2); FX.smoke(this.x, this.y, 8); Sound.at('explode', this.x, this.y); g.event('nestOff', this); }
    if (this.off) return;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = this.rate;
      let n = 0; for (const e of g.enemies) if (e.kind === 'swarm' && e.nest === this && e.alive) n++;
      if (n < this.max) {
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * TAU, x = this.x + Math.cos(a) * T * 0.9, y = this.y + Math.sin(a) * T * 0.9;
          if (!g.L.solidAtW(x, y)) { g.enemies.push(new SwarmBot(g, this, x, y)); FX.burst(x, y, 6, PAL.magenta, 70, 0.3, 1.2); break; }
        }
      }
    }
  }
  draw(ctx, t) {
    const x = this.x, y = this.y;
    ctx.fillStyle = '#24161f'; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#4a2a3c'; ctx.lineWidth = 2; ctx.stroke();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + this.pulse * 0.3; ctx.fillStyle = '#3a2232'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 3.5, 0, TAU); ctx.fill(); }
  }
  emit(ctx, t, g, glow) {
    const a = this.off ? 0.15 : 0.55 + 0.4 * Math.sin(this.pulse * 3);
    ctx.fillStyle = col(this.off ? '#553344' : PAL.magenta, a); ctx.beginPath(); ctx.arc(this.x, this.y, 5.5, 0, TAU); ctx.fill();
    if (!glow && this.off) txtLabel(ctx, 'معطّل', this.x, this.y - 22, '#b07090', 8);
  }
}

class SwarmBot extends Agent {
  constructor(g, nest, x, y) {
    super(g, x, y, T * 0.15);
    this.kind = 'swarm'; this.nest = nest; this.state = 'idle'; this.lostT = 0; this.orbit = Math.random() * TAU; this.dir = chance(0.5) ? 1 : -1;
    const a = Math.random() * TAU; this.vx = Math.cos(a) * 40; this.vy = Math.sin(a) * 40; this.hearMult = 0.8; this.grid = 'fly';
  }
  die(g, quiet) {
    if (!this.alive) return;
    this.alive = false;
    FX.burst(this.x, this.y, 10, PAL.magenta, 140, 0.4, 1.4); FX.add(1, this.x, this.y, 0, 0, 0.3, 6, PAL.magenta);
    if (!quiet) Sound.at('swarm', this.x, this.y);
    g.event('swarmKill', this);
  }
  hit(g) { this.die(g); }
  stun() { this.die(this.g); }
  hear(x, y, kind) { if (this.state === 'idle' && dist2(x, y, this.x, this.y) < (6 * T) ** 2) { this.state = 'hunt'; this.lostT = 2.5; } }
  alert() { }
  reset() { this.alive = false; }
  update(dt, g) {
    if (!this.alive) return;
    const p = g.player, L = g.L;
    let dX = 0, dY = 0, sp = 2.4 * T;
    if (this.state !== 'hunt' && p.alive && p.cloak <= 0 && !g.demo) {
      const d2p = dist2(p.x, p.y, this.x, this.y);
      if (d2p < (5.5 * T) ** 2 && L.los(this.x, this.y, p.x, p.y)) {
        this.state = 'hunt'; this.lostT = 0; Sound.at('swarm', this.x, this.y);
        for (const o of g.enemies) if (o.kind === 'swarm' && o.alive && o.state !== 'hunt' && dist2(o.x, o.y, this.x, this.y) < (3 * T) ** 2) { o.state = 'hunt'; o.lostT = 0; }
      }
    }
    if (this.state === 'idle') {
      this.orbit += dt * 1.3 * this.dir;
      const tx = this.nest.x + Math.cos(this.orbit) * T * 2.2, ty = this.nest.y + Math.sin(this.orbit) * T * 2.2;
      dX = tx - this.x; dY = ty - this.y;
    } else if (this.state === 'hunt') {
      sp = 4.7 * T;
      let tx = p.x, ty = p.y;
      const dc = g.decoys.length ? g.decoys[0] : null;
      if (dc && dist2(dc.x, dc.y, this.x, this.y) < dist2(p.x, p.y, this.x, this.y) * 1.2) { tx = dc.x; ty = dc.y; }
      const fd = (tx === p.x) ? g.flowDir(this.x, this.y) : null;
      if (fd && !L.los(this.x, this.y, tx, ty, L.fly)) { dX = fd[0]; dY = fd[1]; }
      else { dX = tx - this.x; dY = ty - this.y; }
      const seen = p.alive && p.cloak <= 0 && L.los(this.x, this.y, p.x, p.y);
      this.lostT = seen ? 0 : this.lostT + dt;
      if (this.lostT > 5) this.state = 'return';
      if (p.alive && dist2(p.x, p.y, this.x, this.y) < (p.r + this.r) ** 2) { g.damagePlayer(1, 'swarm', this.x, this.y); this.die(g); return; }
    } else {
      const f = this.nest.field, w = L.w, tx0 = Math.floor(this.x / T), ty0 = Math.floor(this.y / T);
      let best = -1, bv = 1e9;
      for (let k = 0; k < 8; k++) { const nx = tx0 + DX8[k], ny = ty0 + DY8[k]; if (!L.inb(nx, ny)) continue; const v = f[ny * w + nx]; if (v >= 0 && v < bv) { bv = v; best = k; } }
      if (best >= 0) { dX = (tx0 + DX8[best] + 0.5) * T - this.x; dY = (ty0 + DY8[best] + 0.5) * T - this.y; } else { dX = this.nest.x - this.x; dY = this.nest.y - this.y; }
      if (dist2(this.x, this.y, this.nest.x, this.nest.y) < (2.5 * T) ** 2) this.state = 'idle';
    }
    const dl = Math.hypot(dX, dY) || 1;
    let ax = dX / dl * sp - this.vx, ay = dY / dl * sp - this.vy;
    ax *= 4; ay *= 4;
    // فصل + محاذاة + تماسك
    let cx = 0, cy = 0, avx = 0, avy = 0, n = 0;
    for (const o of g.enemies) {
      if (o === this || o.kind !== 'swarm' || !o.alive) continue;
      const ox = o.x - this.x, oy = o.y - this.y, d2 = ox * ox + oy * oy;
      if (d2 > (1.6 * T) ** 2 || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      if (d < 0.65 * T) { const k = (0.65 * T - d) * 26; ax -= ox / d * k; ay -= oy / d * k; }
      cx += o.x; cy += o.y; avx += o.vx; avy += o.vy; n++;
    }
    if (n) { ax += (cx / n - this.x) * 1.2 + (avx / n - this.vx) * 0.8; ay += (cy / n - this.y) * 1.2 + (avy / n - this.vy) * 0.8; }
    ax += rand(-60, 60); ay += rand(-60, 60);
    this.vx += ax * dt; this.vy += ay * dt;
    const v = Math.hypot(this.vx, this.vy), vmax = sp * 1.15;
    if (v > vmax) { this.vx *= vmax / v; this.vy *= vmax / v; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    g.collide(this, this.r, L.fly);
    this.face = Math.atan2(this.vy, this.vx);
  }
  draw() { }
  emit(ctx, t, g, glow) {
    if (!this.alive) return;
    const x = this.x, y = this.y, f = this.face, r = this.r * 1.4;
    ctx.fillStyle = this.state === 'hunt' ? PAL.magenta : '#c0508a';
    ctx.beginPath(); ctx.moveTo(x + Math.cos(f) * r, y + Math.sin(f) * r);
    ctx.lineTo(x + Math.cos(f + 2.4) * r * 0.8, y + Math.sin(f + 2.4) * r * 0.8);
    ctx.lineTo(x + Math.cos(f - 2.4) * r * 0.8, y + Math.sin(f - 2.4) * r * 0.8); ctx.closePath(); ctx.fill();
    if (!glow) { ctx.strokeStyle = col(PAL.magenta, 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - this.vx * 0.05, y - this.vy * 0.05); ctx.stroke(); }
  }
}

// ---------------- الصيّاد: يتعلّم من أسلوب لعبك ----------------
class Hunter extends Agent {
  constructor(g, spec, tx, ty) {
    super(g, (tx + 0.5) * T, (ty + 0.5) * T, T * 0.4);
    this.kind = 'hunter'; this.state = 'prowl'; this.view = (spec.view || 5.5) * T; this.fov = 115 * Math.PI / 180;
    this.pressesPlates = true; this.hearMult = 1.5; this.legs = 0; this.tgtX = this.x; this.tgtY = this.y;
    this.learn = { decoy: 0, emp: 0, cloak: 0 }; this.ignoreDecoy = 0; this.empRes = 1; this.thermal = 0;
    this.hot = []; this.hotT = 0; this.recoilT = 0; this.saidHeat = false; this.poly = new Float32Array(2 * 140); this.polyN = 0;
  }
  setState(s) {
    const prev = this.state; this.state = s; this.stateT = 0; this.path = null;
    if (s === 'hunt' && prev !== 'hunt') { this.icon = '!'; this.iconT = 1.5; Sound.at('alarm', this.x, this.y); this.g.onDetected(this); }
  }
  hear(x, y, kind) {
    if (this.stunT > 0 || this.state === 'hunt' || this.state === 'recoil') return;
    if (kind === 'decoy' && Math.random() < this.ignoreDecoy) { if (this.iconT <= 0) { this.icon = '×'; this.iconT = 1.2; } return; }
    this.tgtX = x; this.tgtY = y; this.setState('investigate'); this.icon = '?'; this.iconT = 1;
  }
  alert(x, y) { if (this.state === 'prowl') { this.tgtX = x; this.tgtY = y; this.setState('investigate'); } }
  stun(sec) {
    const s = sec * this.empRes;
    this.stunT = Math.max(this.stunT, s); this.sus = 0; this.path = null;
    Sound.at('stun', this.x, this.y); FX.burst(this.x, this.y, 14, PAL.violet, 120, 0.4, 1.5);
  }
  hit(g, dmg, src) { this.stun(src === 'laser' ? 1.5 : 1.2); }
  reset() { super.reset(); this.state = 'prowl'; }
  learnFrom(kind, g) {
    if (!(kind in this.learn)) return;
    const n = ++this.learn[kind];
    if (kind === 'decoy') { this.ignoreDecoy = clamp((n - 1) * 0.3, 0, 0.85); if (n === 2) g.say('over', 'الصيّاد عرف قرين الظل… لن ينخدع به كثيراً بعد الآن.', 0, 'mid'); }
    if (kind === 'emp') { this.empRes = clamp(1 - (n - 1) * 0.25, 0.3, 1); if (n === 2) g.say('over', 'الصيّاد اعتاد صرخة الجرس. سيُسكَت أقلّ من قبل.', 0, 'mid'); }
    if (kind === 'cloak') { this.thermal = n >= 2 ? 2.6 * T : 0; if (n === 2) g.say('over', 'الصيّاد صار يشمّ دفء نبضك… العباءة لم تعد آمنة قربه.', 0, 'mid'); }
  }
  pickTarget(g) {
    const L = g.L;
    if (this.hotT <= 0) {
      this.hotT = 3; const list = [];
      for (let i = 0; i < L.N; i++) if (L.heat[i] > 1.5) list.push(i);
      list.sort((a, b) => L.heat[b] - L.heat[a]);
      this.hot = list.slice(0, 40);
    }
    if (this.hot.length && Math.random() < 0.75) {
      let tot = 0; for (const i of this.hot) tot += L.heat[i];
      let r = Math.random() * tot;
      for (const i of this.hot) { r -= L.heat[i]; if (r <= 0) { const x = (i % L.w + 0.5) * T, y = (((i / L.w) | 0) + 0.5) * T; if (dist2(x, y, this.x, this.y) > (4 * T) ** 2) { this.tgtX = x; this.tgtY = y; return; } } }
    }
    for (let k = 0; k < 30; k++) {
      const tx = randInt(1, L.w - 2), ty = randInt(1, L.h - 2), i = L.idx(tx, ty);
      if (!L.move[i]) { this.tgtX = (tx + 0.5) * T; this.tgtY = (ty + 0.5) * T; return; }
    }
  }
  update(dt, g) {
    if (!this.alive) return;
    this.repath -= dt; this.stateT += dt; this.iconT -= dt; this.hotT -= dt;
    const moving = Math.hypot(this.vx, this.vy) > 5;
    this.legs += dt * (moving ? 10 : 2);
    if (this.stunT > 0) { this.stunT -= dt; this.canSee = false; this.vx = this.vy = 0; if (Math.random() < dt * 8) FX.add(0, this.x, this.y, rand(-90, 90), rand(-90, 90), 0.3, 1.2, PAL.violet); return; }
    senseCone(this, g, this.view * g.diff.view, this.fov, 1.6, this.thermal);
    if (!this.canSee) { this.seenT += dt; this.sus = Math.max(0, this.sus - dt * 0.2); }
    const p = g.player, L = g.L;
    if (this.forceHunt > 0 && p.alive) {
      this.forceHunt -= dt; this.lastX = p.x; this.lastY = p.y; this.lastVX = p.vx; this.lastVY = p.vy; this.seenT = 0; this.sus = 1;
      if (this.state !== 'hunt' && this.state !== 'recoil') this.setState('hunt');
    }
    const heat = L.heat[L.idx(clamp(Math.floor(this.x / T), 0, L.w - 1), clamp(Math.floor(this.y / T), 0, L.h - 1))];
    const boost = heat > 6 ? 1.16 : 1;
    if (boost > 1 && !this.saidHeat && this.state === 'hunt') { this.saidHeat = true; g.say('over', 'الصيّاد يعرف دروبك المفضّلة… يجري فيها أسرع.', 0, 'mid'); }
    switch (this.state) {
      case 'prowl':
        if (this.canSee && this.sus >= 1) { this.setState('hunt'); break; }
        if (this.canSee) this.faceTo(Math.atan2(this.lastY - this.y, this.lastX - this.x), dt, 4);
        if (this.stateT > 7 || this.moveTo(this.tgtX, this.tgtY, 2.5, dt)) { this.pickTarget(g); this.stateT = 0; this.path = null; }
        break;
      case 'investigate':
        if (this.canSee && this.sus >= 1) { this.setState('hunt'); break; }
        if (this.moveTo(this.tgtX, this.tgtY, 3.4, dt) || this.stateT > 9) { this.setState('prowl'); this.pickTarget(g); }
        break;
      case 'hunt': {
        if (!p.alive) { this.setState('prowl'); break; }
        let tx = this.lastX + this.lastVX * 0.35, ty = this.lastY + this.lastVY * 0.35;
        if (!this.canSee) { tx = this.lastX + this.lastVX * 0.8; ty = this.lastY + this.lastVY * 0.8; }
        const arrived = this.moveTo(tx, ty, 4.0 * boost * (g.diff.speed || 1), dt, false);
        if (!this.canSee && (arrived || this.seenT > 3.5)) { this.sus = 0.5; this.setState('prowl'); this.tgtX = tx; this.tgtY = ty; }
        if (dist2(p.x, p.y, this.x, this.y) < (p.r + this.r * 0.9) ** 2) {
          g.damagePlayer(2, 'hunter', this.x, this.y); this.setState('recoil'); R.addTrauma(0.5);
        }
        break;
      }
      case 'recoil': {
        const a = Math.atan2(this.y - p.y, this.x - p.x);
        const nx = this.x + Math.cos(a) * T * 2.2 * dt, ny = this.y + Math.sin(a) * T * 2.2 * dt;
        this.x = nx; this.y = ny; g.collide(this, this.r * 0.85, L.move);
        if (this.stateT > 1.3) this.setState('hunt');
        break;
      }
    }
  }
  prepare(g) {
    if (this.stunT > 0) { this.polyN = 0; return; }
    const n = Math.min(R.q.coneRays, 138);
    this.poly[0] = this.x; this.poly[1] = this.y;
    g.L.castPoly(this.x, this.y, this.view * g.diff.view, this.face - this.fov / 2, this.face + this.fov / 2, n, this.poly.subarray(2), false);
    this.polyN = n + 1;
  }
  draw(ctx, t) {
    const x = this.x, y = this.y, r = this.r, f = this.face;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.5, r * 1.3, r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2c2638'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const side = k < 3 ? 1 : -1, j = k % 3, base = f + side * (0.9 + j * 0.55);
      const sw = Math.sin(this.legs + k * 1.7) * 0.25;
      const kx = x + Math.cos(base + sw) * r * 1.1, ky = y + Math.sin(base + sw) * r * 1.1;
      const fx = x + Math.cos(base + sw * 1.6 + side * 0.25) * r * 1.75, fy = y + Math.sin(base + sw * 1.6 + side * 0.25) * r * 1.75;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.save(); ctx.translate(x, y); ctx.rotate(f);
    ctx.fillStyle = '#3a3150'; ctx.beginPath(); ctx.moveTo(r * 1.05, 0); ctx.lineTo(r * 0.2, -r * 0.8); ctx.lineTo(-r * 0.9, -r * 0.55); ctx.lineTo(-r * 0.9, r * 0.55); ctx.lineTo(r * 0.2, r * 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4c4168'; ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.lineTo(0, -r * 0.45); ctx.lineTo(-r * 0.55, 0); ctx.lineTo(0, r * 0.45); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  emit(ctx, t, g, glow) {
    if (!glow && this.polyN > 2) {
      const c = this.state === 'hunt' ? PAL.red : PAL.violet, a = this.state === 'hunt' ? 0.15 : 0.08, P = this.poly;
      ctx.fillStyle = col(c, a); ctx.beginPath(); ctx.moveTo(P[0], P[1]);
      for (let i = 1; i < this.polyN; i++) ctx.lineTo(P[i * 2], P[i * 2 + 1]);
      ctx.closePath(); ctx.fill();
    }
    const f = this.face, c = this.stunT > 0 ? PAL.cyan : this.state === 'hunt' ? PAL.red : PAL.violet;
    ctx.fillStyle = c;
    for (let k = -1; k <= 1; k++) { const a = f + k * 0.35; ctx.beginPath(); ctx.arc(this.x + Math.cos(a) * this.r * 0.7, this.y + Math.sin(a) * this.r * 0.7, k ? 1.8 : 2.6, 0, TAU); ctx.fill(); }
    if (!glow) {
      if (this.iconT > 0 && this.icon) txtLabel(ctx, this.icon, this.x, this.y - this.r - 12, this.icon === '!' ? PAL.red : PAL.violet, 13);
      if (this.sus > 0.02 && this.state !== 'hunt') { ctx.strokeStyle = PAL.violet; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y - this.r - 12, 5.5, -Math.PI / 2, -Math.PI / 2 + TAU * this.sus); ctx.stroke(); }
      if (Settings.aiDebug) aiDebugDraw(ctx, this, this.y);
    }
  }
}

// ---------------- «صدى»: الرفيق الذكي ----------------
class Echo {
  constructor(g, x, y) {
    this.g = g; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.r = T * 0.17; this.state = 'follow';
    this.task = null; this.holding = null; this.path = null; this.pi = 0; this.repath = 0; this.navV = 0; this.goalX = 0; this.goalY = 0;
    this.bob = 0; this.ring = 0; this.hackT = 0; this.face = 0;
  }
  moveAlong(tx, ty, sp, dt) {
    const L = this.g.L;
    if (!this.path || this.repath <= 0 || this.navV !== L.navVersion || dist2(tx, ty, this.goalX, this.goalY) > (T * 0.8) ** 2) {
      this.path = L.findPath(this.x, this.y, tx, ty, L.fly, false); this.pi = 0; this.repath = 0.6; this.navV = L.navVersion; this.goalX = tx; this.goalY = ty;
    }
    const P = this.path;
    if (!P) return dist2(this.x, this.y, tx, ty) < (T * 0.5) ** 2;
    if (this.pi * 2 >= P.length) return true;
    const px = P[this.pi * 2], py = P[this.pi * 2 + 1], dx = px - this.x, dy = py - this.y, d = Math.hypot(dx, dy);
    if (d < 4) { this.pi++; return this.pi * 2 >= P.length; }
    const st = Math.min(d, sp * T * dt);
    this.x += dx / d * st; this.y += dy / d * st; this.face = Math.atan2(dy, dx);
    return false;
  }
  update(dt, g) {
    const p = g.player; this.bob += dt; this.ring += dt * 2.2; this.repath -= dt;
    if (!p) return;
    switch (this.state) {
      case 'follow': {
        const d = dist(this.x, this.y, p.x, p.y);
        if (d > 18 * T) { this.x = p.x - T * 0.8; this.y = p.y - T * 0.6; this.path = null; break; }
        if (d > 4.5 * T || !g.L.los(this.x, this.y, p.x, p.y, g.L.fly)) { this.moveAlong(p.x, p.y, g.perk('echohand') ? 7.8 : 6.2, dt); break; }
        this.path = null;
        const back = p.face + Math.PI + 0.6;
        const tx = p.x + Math.cos(back) * T * 0.95, ty = p.y + Math.sin(back) * T * 0.95;
        this.vx = damp(this.vx, clamp((tx - this.x) * 5, -6 * T, 6 * T), 8, dt);
        this.vy = damp(this.vy, clamp((ty - this.y) * 5, -6 * T, 6 * T), 8, dt);
        this.x += this.vx * dt; this.y += this.vy * dt;
        g.collide(this, this.r, g.L.fly);
        this.face += angDiff(this.face, Math.atan2(p.y - this.y, p.x - this.x)) * Math.min(1, dt * 5);
        break;
      }
      case 'goto': {
        const tk = this.task;
        if (!tk) { this.state = 'follow'; break; }
        if (this.moveAlong(tk.x, tk.y, g.perk('echohand') ? 7.8 : 6, dt)) {
          if (tk.kind === 'plate') { this.state = 'hold'; this.holding = tk.obj; g.say('echo', 'ثبّتُ نفسي على اللوحة ' + tk.obj.name + '. اضغط زر صدى لأعود.', 0, 'high'); }
          else if (tk.kind === 'hack') { this.state = 'hack'; this.hackT = 0; }
        }
        if (this.state === 'goto' && dist2(this.x, this.y, p.x, p.y) > (30 * T) ** 2) this.recall(g);
        break;
      }
      case 'hold': {
        const o = this.holding; if (!o) { this.state = 'follow'; break; }
        this.x = damp(this.x, o.x, 10, dt); this.y = damp(this.y, o.y, 10, dt);
        break;
      }
      case 'hack': {
        const t = this.task && this.task.obj;
        if (!t || t.val) { this.state = 'follow'; this.task = null; break; }
        const dur = g.perk('echohand') ? 2.8 : 5.5;
        this.hackT += dt; t.echoProg = clamp(this.hackT / dur, 0, 1);
        if (Math.random() < dt * 10) FX.add(0, this.x, this.y, rand(-60, 60), rand(-60, 60), 0.3, 1, PAL.gold);
        if (this.hackT >= dur) { t.echoProg = 0; t.setHacked(g, true); g.say('echo', 'تمّ! وصلتُ أوتار ' + t.name + ' عن بُعد.', 0, 'mid'); this.state = 'follow'; this.task = null; }
        break;
      }
    }
  }
  command(g) {
    if (this.state !== 'follow') { this.recall(g); return; }
    const plan = Planner.echoTask(g);
    if (!plan) { g.say('echo', 'لا أرى ما أساعدك فيه هنا. أستطيع تثبيت لوحات الضغط ووصل لوحات الشيفرة غير المحميّة.', 0, 'high'); return; }
    this.task = plan; this.state = 'goto'; this.path = null;
    g.say('echo', plan.say, 0, 'high'); Sound.play('blip');
  }
  recall(g) {
    if (this.task && this.task.obj && this.task.kind === 'hack') this.task.obj.echoProg = 0;
    this.holding = null; this.task = null; this.state = 'follow'; this.path = null;
    g.say('echo', 'عائد إليك!', 2, 'high');
  }
  reset(x, y) { this.x = x - T; this.y = y; this.state = 'follow'; this.holding = null; this.task = null; this.path = null; }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 13, 6, 2.5, 0, 0, TAU); ctx.fill();
  }
  emit(ctx, t, glow) {
    const x = this.x, y = this.y - 4 + Math.sin(this.bob * 3) * 2.5, r = this.r;
    ctx.globalAlpha = 0.45; ctx.drawImage(Sprites.glow(PAL.gold), x - 16, y - 16, 32, 32); ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff1c9'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y, r * 1.9, r * 0.7, this.ring, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#5a3d00'; ctx.beginPath(); ctx.arc(x + Math.cos(this.face) * r * 0.45, y + Math.sin(this.face) * r * 0.45, r * 0.32, 0, TAU); ctx.fill();
    if (!glow && this.state === 'hold') txtLabel(ctx, 'تثبيت', x, y - 14, PAL.gold, 8);
  }
}

// ---------------- المُخطِّط: محلّل ألغاز يستخدمه صدى للتلميحات ----------------
function evalWith(L, id, ov, memo) {
  if (ov.has(id)) return ov.get(id);
  if (memo.has(id)) return memo.get(id);
  const n = L.nodes.get(id);
  let v = false;
  if (n) {
    if (n.type !== 'gate') v = !!n.val;
    else v = Gate.apply(n.op, n.inputs.map(i => evalWith(L, i, ov, memo)), n);
  }
  memo.set(id, v); return v;
}
function exprOf(L, id, depth = 0) {
  const n = L.nodes.get(id);
  if (!n) return '?';
  if (n.type !== 'gate') return n.name || n.id || id;
  if (depth > 4) return '…';
  const a = n.inputs.map(i => exprOf(L, i, depth + 1));
  if (n.op === 'NOT') return 'NOT ' + a[0];
  if (n.op === 'TIMER') return 'مؤقّت(' + a[0] + ')';
  if (n.op === 'CLOCK') return 'نبض';
  if (n.op === 'LATCH') return 'ذاكرة(' + a.join('، ') + ')';
  const s = a.join(' ' + n.op + ' ');
  return depth ? '(' + s + ')' : s;
}
const Planner = {
  reach: null,
  goal(g) {
    const L = g.L, p = g.player, M = g.missions;
    for (const ms of M.primary) {
      if (ms.done) continue;
      if (ms.type === 'collect') {
        let best = null, bd = Infinity;
        for (const o of L.pickups) if (!o.taken && o.kind === (ms.kind || 'core')) { const d = dist2(o.x, o.y, p.x, p.y); if (d < bd) { bd = d; best = o; } }
        if (best) return { obj: best, text: 'الهدف التالي: ' + ms.text };
      } else if (ms.type === 'hack') {
        const t = L.nodes.get(ms.id); if (t && !t.val) return { obj: t, text: 'الهدف التالي: ' + ms.text };
      } else if (ms.type === 'rescue') {
        let best = null, bd = Infinity;
        for (const o of L.captives) if (!o.freed) { const d = dist2(o.x, o.y, p.x, p.y); if (d < bd) { bd = d; best = o; } }
        if (best) return { obj: best, text: 'الهدف التالي: ' + ms.text };
      } else if (ms.type === 'node' || ms.type === 'nests') {
        const ids = ms.ids || [ms.id];
        for (const id of ids) { const n = L.nodes.get(id); if (n && !n.val) return { obj: n, text: 'الهدف التالي: ' + ms.text }; }
      } else if (ms.type === 'boss') {
        return null;
      }
    }
    return L.exit ? { obj: L.exit, text: 'اذهب إلى مِصعد الأجراس' } : null;
  },
  // A* بتكاليف: الأبواب المغلقة والعوائق قابلة للعبور بكلفة لنعرف «ما الذي يعترض الطريق»
  pathCells(g, sx, sy, tx, ty) {
    const L = g.L, w = L.w, h = L.h;
    const s = L.idx(clamp(Math.floor(sx / T), 0, w - 1), clamp(Math.floor(sy / T), 0, h - 1));
    const t = L.idx(clamp(Math.floor(tx / T), 0, w - 1), clamp(Math.floor(ty / T), 0, h - 1));
    const cost = i => {
      if (i === t) return 1;
      if (L.tile[i] !== 0) return -1;
      const o = L.solidAt[i];
      let c = 1;
      if (o) {
        if (o.type === 'door' || o.type === 'riddle') c = o.isSolid() ? 30 : 1;
        else if (o.type === 'box') c = 12;
        else if (o.isSolid()) return -1;
      }
      const f = L.floorAt[i];
      if (f && f.type === 'hazard' && f.active) c += 20;
      if (L.lgrid[i]) c += 20;
      return c;
    };
    const G = L.g, par = L.par, seen = L.seen, closed = L.closed, heap = L.heap, stamp = ++L.stamp;
    const ttx = t % w, tty = (t / w) | 0;
    heap.clear(); G[s] = 0; seen[s] = stamp; par[s] = -1; heap.push(s, 0);
    let found = false, ex = 0;
    while (heap.n) {
      const cur = heap.pop();
      if (cur === t) { found = true; break; }
      if (closed[cur] === stamp) continue;
      closed[cur] = stamp;
      if (++ex > 12000) break;
      const cx = cur % w, cy = (cur / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX8[k], ny = cy + DY8[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (closed[ni] === stamp) continue;
        const c = cost(ni); if (c < 0) continue;
        const ng = G[cur] + c;
        if (seen[ni] !== stamp || ng < G[ni]) { seen[ni] = stamp; G[ni] = ng; par[ni] = cur; heap.push(ni, ng + Math.abs(nx - ttx) + Math.abs(ny - tty)); }
      }
    }
    if (!found) return null;
    const cells = []; for (let c = t; c !== -1; c = par[c]) cells.push(c);
    return cells.reverse();
  },
  solveNode(g, id, need) {
    const L = g.L, p = g.player;
    if (!this.reach || this.reach.length !== L.N) this.reach = new Uint8Array(L.N);
    L.reach(p.x, p.y, this.reach);
    const leaves = new Set();
    const visit = nid => { const n = L.nodes.get(nid); if (!n) return; if (n.type === 'gate') n.inputs.forEach(visit); else leaves.add(n); };
    visit(id);
    const near = o => {
      for (let k = 0; k < 5; k++) { const x = o.tx + (k ? DX8[k - 1] : 0), y = o.ty + (k ? DY8[k - 1] : 0); if (L.inb(x, y) && this.reach[L.idx(x, y)]) return true; }
      return false;
    };
    const ctrl = [...leaves].filter(n => (n.type === 'switch' || n.type === 'plate') && near(n)).slice(0, 12);
    let best = null;
    for (let mask = 0; mask < (1 << ctrl.length); mask++) {
      const ov = new Map(); let ch = 0;
      ctrl.forEach((c, i) => { const v = !!(mask & (1 << i)); ov.set(c.nodeId, v); if (v !== !!c.val) ch++; });
      if (evalWith(L, id, ov, new Map()) === need && (!best || ch < best.ch)) best = { ov, ch };
    }
    return { leaves: [...leaves], ctrl, best };
  },
  analyze(g) {
    const L = g.L, p = g.player;
    if (g.boss && !g.boss.defeated) return this.bossHint(g);
    const goal = this.goal(g);
    if (!goal) return { text: 'لا أجد هدفاً واضحاً الآن — استكشف.', objs: [] };
    const cells = this.pathCells(g, p.x, p.y, goal.obj.x, goal.obj.y);
    if (!cells) return { text: goal.text + ' — لا أجد طريقاً بعد، استكشف المنطقة.', objs: [goal.obj] };
    const pts = [];
    for (const c of cells) pts.push((c % L.w + 0.5) * T, (((c / L.w) | 0) + 0.5) * T);
    for (let k = 1; k < cells.length - 1; k++) {
      const i = cells[k], o = L.solidAt[i], f = L.floorAt[i];
      if (o && o.type === 'riddle' && o.isSolid()) return { text: 'بوابة حكمة تعترض الطريق. اقترب منها وأجب عن سؤالها.', objs: [o], path: pts.slice(0, k * 2 + 2) };
      if (o && o.type === 'door' && o.isSolid()) return this.doorHint(g, o, pts.slice(0, k * 2 + 2));
      if (o && o.type === 'box') return { text: 'صندوق يسدّ الممر. ادفعه بالسير نحوه باتجاه مستقيم.', objs: [o], path: pts.slice(0, k * 2 + 2) };
      if (f && f.type === 'hazard' && f.active) {
        const src = f.inputs.length ? L.nodes.get(f.inputs[0]) : null;
        if (src && src.op === 'CLOCK') return { text: 'الأرضية مكهربة على إيقاع ساعة: انتظر حتى ينطفئ الصف الذي أمامك ثم تقدّم صفاً صفاً — أو اثبُ فوقه بالوثبة.', objs: [src, f], path: pts.slice(0, k * 2 + 2) };
        if (f.inputs.length) { const r = this.solveNode(g, f.inputs[0], !f.inv); if (r.best) { const tg = r.ctrl.filter(c => r.best.ov.get(c.nodeId) !== !!c.val); if (tg.length) return { text: 'الأرضية مكهربة. لتعطيلها: ' + this.toggleText(tg, r.best.ov), objs: tg, path: pts.slice(0, k * 2 + 2) }; } }
        return { text: 'أرضية مكهربة! ابحث عن مفتاح يعطّلها، أو ثِب فوقها (الوثبة تحميك).', objs: [f], path: pts.slice(0, k * 2 + 2) };
      }
      if (L.lgrid[i]) return { text: 'شعاع أحمر يقطع الطريق. احجبه بصندوق أو غيّر اتجاهه بالمرايا.', objs: [], path: pts.slice(0, k * 2 + 2) };
    }
    return { text: goal.text + ' — الطريق مفتوح، اتبع الخط المضيء.', objs: [goal.obj], path: pts };
  },
  bossHint(g) {
    const L = g.L, b = g.boss, p = g.player;
    if (!b.shield) return { text: 'الدرع ساقط! أسرع إلى قلب العين واضغط «تفاعل» مطوّلاً قبل أن يعود.', objs: [b.markers[4]] };
    const cur = ['A', 'B', 'C'].map(id => L.nodeVal(id));
    let best = null;
    for (const py of L.pylons) {
      if (py.val || !py.need) continue;
      for (let m = 0; m < 8; m++) {
        const v = [!!(m & 1), !!(m & 2), !!(m & 4)];
        if (!py.need.f(v[0], v[1], v[2])) continue;
        const ch = v.filter((x, i) => x !== cur[i]).length, sc = ch * 10 + dist(p.x, p.y, py.x, py.y) / T;
        if (!best || sc < best.sc) best = { py, v, sc };
      }
    }
    if (!best) return { text: 'كل الأعمدة ترنّ — الدرع سيسقط!', objs: [] };
    const names = ['A', 'B', 'C'], tg = names.filter((n, i) => best.v[i] !== cur[i]);
    return { text: 'العمود ' + best.py.name + ' يحتاج: ' + best.py.need.t + '. ' + (tg.length ? 'بدّل ' + tg.join(' و') + ' ثم قف على العمود حتى يمتلئ.' : 'الشرط متحقق الآن — قف على العمود حتى يمتلئ.'), objs: tg.map(n => L.nodes.get(n)).concat([best.py]) };
  },
  toggleText(tg, ov) {
    return tg.map(c => c.type === 'switch' ? 'بدّل ' + c.name : (ov.get(c.nodeId) ? 'ضع صندوقاً (أو أرسلني) على اللوحة ' + c.name : 'أفرغ اللوحة ' + c.name)).join('، ثم ');
  },
  doorHint(g, door, path) {
    const L = g.L;
    if (!door.inputs.length) return { text: 'هذا الباب لا يُفتح من هنا.', objs: [door], path };
    const id = door.inputs[0], need = !door.inv;
    const expr = exprOf(L, id), cond = (door.inv ? 'NOT (' + expr + ')' : expr);
    const r = this.solveNode(g, id, need);
    if (r.best) {
      const tg = r.ctrl.filter(c => r.best.ov.get(c.nodeId) !== !!c.val);
      if (tg.length) return { text: 'الباب يُفتح عندما: ' + cond + ' = 1. الحل: ' + this.toggleText(tg, r.best.ov) + '.', objs: tg.concat([door]), path };
      return { text: 'الشرط ' + cond + ' تحقق، لكن هناك مؤقّتاً أو نبضاً — جرّب مجدداً وأسرع.', objs: [door], path };
    }
    const term = r.leaves.find(n => n.type === 'terminal' && !n.val);
    if (term) return { text: 'الباب مربوط بلوحة الشيفرة ' + term.name + '. صِلْ أوتارها، أو أرسلني إن لم تكن محميّة.', objs: [term, door], path };
    const rec = r.leaves.find(n => n.type === 'receiver');
    if (rec) return { text: 'الباب يحتاج شعاعاً في المستقبِل ' + rec.name + '. أدِر المرايا لتوجيهه إليه.', objs: [rec, door], path };
    const rid = r.leaves.find(n => n.type === 'riddle' && !n.val);
    if (rid) return { text: 'أجب عن سؤال بوابة الحكمة المرتبطة بهذا الباب.', objs: [rid], path };
    return { text: 'الشرط: ' + cond + '. بعض المفاتيح خلف منطقة أخرى — استكشف طريقاً بديلاً.', objs: r.leaves.filter(n => n.x).concat([door]), path };
  },
  echoTask(g) {
    const L = g.L, p = g.player, e = g.echo;
    const goal = this.goal(g);
    if (goal) {
      const cells = this.pathCells(g, p.x, p.y, goal.obj.x, goal.obj.y);
      if (cells) for (let k = 1; k < cells.length - 1; k++) {
        const o = L.solidAt[cells[k]];
        if (o && o.type === 'door' && o.isSolid() && o.inputs.length) {
          const r = this.solveNode(g, o.inputs[0], !o.inv);
          if (r.best) {
            const plate = r.ctrl.find(c => c.type === 'plate' && r.best.ov.get(c.nodeId) && !c.val);
            if (plate && L.findPath(e.x, e.y, plate.x, plate.y, L.fly, false)) return { kind: 'plate', obj: plate, x: plate.x, y: plate.y, say: 'سأثبّت اللوحة ' + plate.name + ' لتفتح الباب.' };
          }
          const term = r.leaves.find(n => n.type === 'terminal' && !n.val && !n.secure);
          if (term) { const s = this.standNear(g, term); if (s) return { kind: 'hack', obj: term, x: s[0], y: s[1], say: 'سأصل أوتار ' + term.name + ' عن بُعد — احمني!' }; }
          break;
        }
      }
    }
    let best = null, bd = (9 * T) ** 2;
    for (const pl of L.plates) { if (pl.val) continue; const d = dist2(pl.x, pl.y, p.x, p.y); if (d < bd && L.findPath(e.x, e.y, pl.x, pl.y, L.fly, false)) { bd = d; best = { kind: 'plate', obj: pl, x: pl.x, y: pl.y, say: 'سأثبّت اللوحة ' + pl.name + '.' }; } }
    if (best) return best;
    bd = (11 * T) ** 2;
    for (const t of L.terminals) { if (t.val || t.secure) continue; const d = dist2(t.x, t.y, p.x, p.y); const s = d < bd ? this.standNear(g, t) : null; if (s) { bd = d; best = { kind: 'hack', obj: t, x: s[0], y: s[1], say: 'سأصل أوتار ' + t.name + ' عن بُعد.' }; } }
    return best;
  },
  standNear(g, o) {
    const L = g.L;
    for (let k = 0; k < 4; k++) { const x = o.tx + DX8[k], y = o.ty + DY8[k]; if (L.inb(x, y) && !L.fly[L.idx(x, y)]) return [(x + 0.5) * T, (y + 0.5) * T]; }
    return null;
  },
};

// ---------------- المُخرِج الذكي: يدير التوتر والمهام الطارئة ----------------
class Director {
  constructor(g) { this.g = g; this.intensity = 0; this.calmT = 0; this.dyn = null; this.dynCd = 30; this.reliefCd = 0; this.chasing = false; this.chaseT = 0; }
  update(dt) {
    const g = this.g;
    let chasing = false;
    for (const e of g.enemies) if (e.alive && (e.state === 'chase' || e.state === 'hunt' || e.state === 'fire')) { chasing = true; break; }
    this.alarmed = chasing;
    if (g.boss && !g.boss.defeated) chasing = true;
    this.chasing = chasing;
    this.chaseT = chasing ? this.chaseT + dt : 0;
    if (chasing) this.intensity = Math.min(1, this.intensity + dt * 0.12);
    else this.intensity = Math.max(0, this.intensity - dt * 0.04);
    this.calmT = this.intensity < 0.15 ? this.calmT + dt : 0;
    this.dynCd -= dt; this.reliefCd -= dt;
    if (!this.dyn && this.dynCd <= 0 && this.calmT > 16 && !g.def.noDynamic) this.start(chance(0.5) || !g.hasGadget('emp') ? 'surge' : 'emp2');
    if (this.dyn) this.tick(dt);
    if (this.intensity > 0.7 && this.reliefCd <= 0 && g.player.hp <= 1 && g.player.alive) {
      this.reliefCd = 45;
      const pos = this.findSpot(3, 7);
      if (pos) { g.spawnBonus(pos[0], pos[1], 'health'); g.say('echo', 'الراوي أسقط وتراً جديداً قريباً منك — التقطه!', 0, 'mid'); }
    }
    Sound.tensionTarget = chasing ? 1 : this.intensity * 0.4;
  }
  onEvent(name, d) {
    const g = this.g;
    if (name === 'detected') { this.intensity = Math.min(1, this.intensity + 0.3); if (!this.dyn && !g.def.noDynamic && this.dynCd < 20) this.start('hide'); }
    if (name === 'damage') this.intensity = Math.min(1, this.intensity + 0.2);
    if (this.dyn && this.dyn.kind === 'emp2' && name === 'empHit' && d >= 2) this.finish(true);
    if (this.dyn && this.dyn.kind === 'surge' && name === 'collect' && d.bonus) this.finish(true);
  }
  findSpot(minS, maxS) {
    const g = this.g, L = g.L;
    if (!this.field || this.field.length !== L.N) this.field = new Int16Array(L.N);
    L.flow(g.player.x, g.player.y, L.move, maxS + 2, this.field);
    const c = [];
    for (let i = 0; i < L.N; i++) { const v = this.field[i]; if (v >= minS && v <= maxS && !L.floorAt[i] && !L.solidAt[i] && !L.lgrid[i]) c.push(i); }
    if (!c.length) return null;
    const i = pick(c);
    return [(i % L.w + 0.5) * T, (((i / L.w) | 0) + 0.5) * T];
  }
  start(kind) {
    const g = this.g;
    if (kind === 'surge') {
      const pos = this.findSpot(7, 15) || this.findSpot(3, 15);
      if (!pos) { this.dynCd = 20; return; }
      const pk = g.spawnBonus(pos[0], pos[1], 'energy', true);
      this.dyn = { kind, t: 25, max: 25, text: 'التقط النبضة النادرة قبل أن تخبو', obj: pk };
    } else if (kind === 'hide') {
      this.dyn = { kind, t: 30, max: 30, text: 'اختبئ عن الأنظار 8 ثوانٍ', hidden: 0 };
    } else if (kind === 'emp2') {
      let n = 0; for (const e of g.enemies) if (e.alive && e.kind === 'drone') n++;
      if (n < 2) { this.dynCd = 20; return; }
      this.dyn = { kind, t: 45, max: 45, text: 'أسكِت رقيبين بصرخة جرس واحدة' };
    }
    if (this.dyn) { Sound.play('chip'); g.event('dynStart', this.dyn); }
  }
  tick(dt) {
    const d = this.dyn, g = this.g;
    d.t -= dt;
    if (d.kind === 'hide') {
      let seen = false;
      for (const e of g.enemies) if (e.alive && e.canSee && (e.state === 'chase' || e.state === 'hunt' || e.state === 'fire')) { seen = true; break; }
      d.hidden = seen ? 0 : d.hidden + dt;
      d.text = 'اختبئ عن الأنظار: ' + Math.min(8, Math.floor(d.hidden)) + ' / 8 ث';
      if (d.hidden >= 8) { this.finish(true); return; }
    }
    if (d.kind === 'surge' && d.obj && d.obj.taken) { this.finish(true); return; }
    if (d.t <= 0) this.finish(false);
  }
  finish(ok) {
    const g = this.g, d = this.dyn; if (!d) return;
    this.dyn = null; this.dynCd = 35 + Math.random() * 20;
    if (d.kind === 'surge' && d.obj && !d.obj.taken) { d.obj.taken = true; }
    if (ok) {
      g.score += 150; g.dynDone++; g.addRnn(40, g.player.x, g.player.y);
      Sound.play('win');
      if (d.kind === 'hide') {
        for (const e of g.enemies) if (e.alive && (e.state === 'chase' || e.state === 'hunt')) { e.sus = 0.4; if (e.setState) e.setState(e.kind === 'hunter' ? 'prowl' : 'search'); }
        g.player.energy = g.player.maxEnergy;
        g.toast('نجحتَ في المحنة! فقدوا أثرك وامتلأ نبضك (+40 رنين)');
      } else if (d.kind === 'emp2') { g.player.energy = g.player.maxEnergy; g.gadgetCd.emp = 0; g.toast('نجحتَ في المحنة! نبض كامل وصرخة جاهزة (+40 رنين)'); }
      else { g.player.energy = g.player.maxEnergy; g.toast('نجحتَ في المحنة! نبض كامل (+40 رنين)'); }
    } else g.toast('انقضت المحنة');
    g.event('dynEnd', { ok });
  }
}
