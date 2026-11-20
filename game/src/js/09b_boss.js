// ===================== الزعيم: قلب المُراقِب (ذكاء «المنفعة» + تكيّف مع أسلوبك) =====================
const BOSS_EXPR = [
  [
    { t: 'A', f: (a, b, c) => a }, { t: 'B', f: (a, b, c) => b }, { t: 'C', f: (a, b, c) => c },
    { t: 'NOT A', f: (a, b, c) => !a }, { t: 'NOT B', f: (a, b, c) => !b }, { t: 'NOT C', f: (a, b, c) => !c },
    { t: 'A AND B', f: (a, b, c) => a && b }, { t: 'B OR C', f: (a, b, c) => b || c }, { t: 'A AND C', f: (a, b, c) => a && c },
  ],
  [
    { t: 'A XOR B', f: (a, b, c) => a !== b }, { t: 'B XOR C', f: (a, b, c) => b !== c }, { t: 'A XOR C', f: (a, b, c) => a !== c },
    { t: 'A AND NOT C', f: (a, b, c) => a && !c }, { t: 'NOT (A OR B)', f: (a, b, c) => !(a || b) }, { t: 'B AND C', f: (a, b, c) => b && c },
    { t: 'C AND NOT B', f: (a, b, c) => c && !b }, { t: 'A NAND B', f: (a, b, c) => !(a && b) }, { t: 'NOT (B AND C)', f: (a, b, c) => !(b && c) },
  ],
  [
    { t: 'A XOR B XOR C', f: (a, b, c) => (a !== b) !== c }, { t: 'A AND B AND C', f: (a, b, c) => a && b && c },
    { t: '(A OR B) AND NOT C', f: (a, b, c) => (a || b) && !c }, { t: 'A XNOR C', f: (a, b, c) => a === c },
    { t: 'NOT B AND (A XOR C)', f: (a, b, c) => !b && a !== c }, { t: 'NOT (A OR B OR C)', f: (a, b, c) => !(a || b || c) },
    { t: '(A AND B) XOR C', f: (a, b, c) => (a && b) !== c }, { t: 'B AND (A XNOR C)', f: (a, b, c) => b && a === c },
  ],
];
const BOSS_ATTACK_NAMES = { sweep: 'مسح ليزري', ring: 'حلقة طلقات', swarm: 'استدعاء السرب', drones: 'استدعاء حراس', mines: 'ألغام باحثة' };

class Mine {
  constructor(g, x, y) { this.g = g; this.kind = 'mine'; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.r = T * 0.22; this.life = 7; this.alive = true; this.hittable = true; this.minion = true; this.ph = Math.random() * 6; this.stunT = 0; this.state = 'seek'; }
  hear() { } alert() { }
  reset() { this.alive = false; }
  stun() { this.fizzle(); }
  hit(g) { this.fizzle(); }
  fizzle() { if (!this.alive) return; this.alive = false; FX.burst(this.x, this.y, 10, PAL.cyan, 90, 0.35, 1.4); }
  explode(g) {
    if (!this.alive) return;
    this.alive = false; Sound.at('explode', this.x, this.y); R.addTrauma(0.3);
    FX.burst(this.x, this.y, 26, PAL.red, 200, 0.5, 1.8); FX.ring(this.x, this.y, 4, T * 1.5, 0.4, PAL.red, 4); FX.smoke(this.x, this.y, 5);
    const p = g.player;
    if (p.alive && dist2(p.x, p.y, this.x, this.y) < (T * 1.5) ** 2) g.damagePlayer(1, 'boss', this.x, this.y);
  }
  update(dt, g) {
    if (!this.alive) return;
    this.life -= dt; this.ph += dt * (this.life < 2 ? 14 : 6);
    const p = g.player;
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1, sp = 2.5 * T;
    this.vx = damp(this.vx, dx / d * sp, 2.5, dt); this.vy = damp(this.vy, dy / d * sp, 2.5, dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    g.collide(this, this.r, g.L.fly);
    if ((p.alive && d < p.r + this.r + T * 0.15) || this.life <= 0) this.explode(g);
  }
  draw() { }
  emit(ctx, t, g, glow) {
    if (!this.alive) return;
    const a = 0.6 + 0.4 * Math.sin(this.ph);
    ctx.fillStyle = col(PAL.red, a); ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = col('#ffb0b0', a * 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 4 + Math.sin(this.ph) * 2, 0, TAU); ctx.stroke();
  }
}

class Boss {
  constructor(g, spec, tx, ty) {
    this.g = g; this.kind = 'boss'; this.tx = tx; this.ty = ty; this.x = (tx + 0.5) * T; this.y = (ty + 0.5) * T; this.r = T * 1.45;
    this.alive = true; this.defeated = false; this.hittable = false; this.pressesPlates = false; this.state = 'fight'; this.stunT = 0; this.sus = 0;
    this.phase = 1; this.maxPhase = 3; this.shield = true; this.shieldT = 0; this.atk = null; this.cd = 3.5; this.lastAtk = null; this.lastUsed = {};
    this.scores = {}; this.prof = { near: 0, cover: 0 }; this.profT = 0; this.said = new Set(); this.iris = 0; this.pulse = 0; this.dieT = 0; this.flashT = 0;
    this.ringBonus = 0; this.field = new Int16Array(g.L.N);
    const L = g.L;
    this.markers = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = tx + dx, Y = ty + dy, i = L.idx(X, Y);
      const mk = {
        type: 'boss', layer: 'solid', tx: X, ty: Y, x: (X + 0.5) * T, y: (Y + 0.5) * T, prog: 0, hold: true,
        isSolid() { return true; }, blocksSight() { return true; },
        canInteract: () => !this.defeated && !this.shield,
        label: () => 'اطعن قلب العين! (اضغط مطوّلاً)',
        free: (gg) => this.overload(gg),
      };
      L.solidAt[i] = mk; L.cellUpdate(i); this.markers.push(mk);
    }
    L.changed();
    L.flow(this.x, this.y + T * 2, L.fly, 60, this.field);
    this.setupPhase(true);
  }
  hear() { } alert() { } hit() { } stun() { }
  reset() {
    const g = this.g;
    for (const e of g.enemies) if (e.minion) e.alive = false;
    this.atk = null; this.cd = 3; this.shield = true; this.shieldT = 0;
    for (const py of g.L.pylons) { py.val = false; py.charge = 0; }
  }
  setupPhase(first) {
    const pool = BOSS_EXPR[Math.min(this.phase, 3) - 1];
    let pickN = null;
    for (let tries = 0; tries < 30; tries++) {
      const cand = shuffle(pool.slice()).slice(0, 4);
      let allAtOnce = false;
      for (let m = 0; m < 8 && !allAtOnce; m++) { const a = !!(m & 1), b = !!(m & 2), c = !!(m & 4); if (cand.every(e => e.f(a, b, c))) allAtOnce = true; }
      pickN = cand;
      if (!allAtOnce) break;
    }
    const L = this.g.L, pys = L.pylons;
    pys.forEach((py, i) => { py.need = pickN[i % pickN.length]; py.val = false; py.charge = 0; py.locked = false; });
    // أسلاك مرئية من المفاتيح إلى الأبراج حسب شرط كل برج
    L.wires = []; let k = 0;
    for (const py of pys) for (const id of ['A', 'B', 'C']) if (new RegExp('\\b' + id + '\\b').test(py.need.t)) { const sw = L.nodes.get(id); if (sw) L.wires.push(new Wire(sw, py, L, k++)); }
    this.shield = true;
    if (!first) this.cd = 2.5;
  }
  shieldDown() { return !this.defeated && !this.shield; }
  overload(g) {
    if (this.shield || this.defeated) return;
    for (const m of this.markers) m.prog = 0;
    R.addTrauma(0.9); g.flash = 1; Sound.play('explode'); Sound.play('boss');
    FX.burst(this.x, this.y, 80, '#ffffff', 320, 0.9, 2.2); FX.ring(this.x, this.y, 10, T * 8, 0.8, PAL.cyan, 8); FX.debris(this.x, this.y, 20, '#8a95a3');
    for (const e of g.enemies) if (e.minion && e.alive) { if (e.kind === 'swarm') e.die(g, true); else e.alive = false; }
    this.phase++; g.score += 500;
    if (this.phase > this.maxPhase) {
      this.defeated = true; this.dieT = 3; g.bossDefeated = true;
      const n = g.L.nodes.get('BOSS'); if (n) n.val = true;
      g.say('over', 'مستحيل… جرس صغير… أسقط… العين…', 5, 'high');
      const L0 = g.L; setTimeout(() => { if (g.L === L0 && g.state === 'playing') g.say('echo', 'فعلتها يا نبض! الباب الشمالي انفتح. لنصعد إلى النور!', 5, 'high'); }, 5200);
      g.addRnn(200, this.x, this.y);
      g.event('bossDown', this);
      return;
    }
    const lines = { 2: 'أصبتني؟ مؤقتاً فقط. سأعيد ترتيب منطق الأعمدة… حاول أن تفهمه الآن.', 3: 'كفى! كل أسلحتي مستيقظة. لن تخرج من هنا.' };
    g.say('over', lines[this.phase], 0, 'high'); g.addRnn(60, this.x, this.y);
    this.setupPhase(false);
    g.toast('الطور ' + this.phase + ' من 3 — شروط الأعمدة تغيّرت');
  }
  onEmp(g, x, y, R0) {
    if (!this.defeated && this.atk && this.atk.k === 'sweep' && dist(x, y, this.x, this.y) < R0 + T * 3) {
      this.atk = null; this.cd = 2.2; g.toast('شوّشتَ المسح الأحمر بصرخة الجرس!'); FX.burst(this.x, this.y, 20, PAL.cyan, 160, 0.5, 1.6);
    }
  }
  taunt(key, text) { if (this.said.has(key)) return; this.said.add(key); this.g.say('over', text, 0, 'mid'); }
  profile(dt, g) {
    this.profT -= dt; if (this.profT > 0) return; this.profT = 0.5;
    const p = g.player, L = g.L, d = dist(p.x, p.y, this.x, this.y) / T;
    let cover = false;
    for (let k = 0; k < 8 && !cover; k++) { const nx = p.tx + DX8[k], ny = p.ty + DY8[k]; if (L.inb(nx, ny) && L.tile[L.idx(nx, ny)] === 1 && nx > 3 && nx < L.w - 4 && ny > 6 && ny < 22) cover = true; }
    this.prof.near = lerp(this.prof.near, d < 6.5 ? 1 : 0, 0.06);
    this.prof.cover = lerp(this.prof.cover, cover ? 1 : 0, 0.06);
    if (this.prof.cover > 0.45) this.taunt('cover', 'تختبئ خلف الحجارة؟ حلّلتُ نمطك… ' + (this.phase >= 3 ? 'بذور الشرر ستجدك.' : 'سأغيّر زاوية المسح.'));
    if (this.prof.near > 0.6) { this.ringBonus = 6; this.taunt('near', 'تحب الاقتراب مني؟ سأكثّف حلقات الطلقات.'); }
  }
  choose(g) {
    const p = g.player, d = dist(p.x, p.y, this.x, this.y) / T, now = g.time;
    let sw = 0, dr = 0; for (const e of g.enemies) if (e.alive && e.minion) { if (e.kind === 'swarm') sw++; else if (e.kind === 'drone') dr++; }
    const since = k => now - (this.lastUsed[k] ?? -99);
    const S = {
      sweep: 1.0 + (d > 6 ? 0.5 : 0) + Math.min(1, since('sweep') / 12) - this.prof.cover * 0.5,
      ring: 0.9 + (d < 7 ? 0.6 : 0) + Math.min(1, since('ring') / 10) + this.prof.near * 0.3,
      swarm: 0.7 + (sw < 3 ? 0.6 : -1.5) + Math.min(0.6, since('swarm') / 20),
      drones: this.phase >= 2 ? 0.6 + (dr < 2 ? 0.6 : -3) + Math.min(0.5, since('drones') / 25) : -9,
      mines: this.phase >= 3 ? 0.8 + this.prof.cover * 0.9 + Math.min(0.6, since('mines') / 15) : -9,
    };
    if (this.lastAtk) S[this.lastAtk] -= 0.8;
    let best = 'ring', bv = -Infinity;
    for (const k in S) { const v = S[k] + Math.random() * 0.35; if (v > bv) { bv = v; best = k; } }
    this.scores = S;
    return best;
  }
  start(k, g) {
    const p = g.player;
    this.lastAtk = k; this.lastUsed[k] = g.time;
    switch (k) {
      case 'sweep': {
        const a0 = Math.atan2(p.y - this.y, p.x - this.x) - (this.prof.cover > 0.45 ? 0.4 : 1.3);
        this.atk = { k, t: 0, charge: 0.9, a: a0, dir: chance(0.5) ? 1 : -1, sp: 1.1 + 0.32 * this.phase, left: TAU * 0.85 };
        Sound.play('charge');
        break;
      }
      case 'ring': this.atk = { k, t: 0, shots: this.phase >= 3 ? 2 : 1, next: 0 }; break;
      case 'swarm': {
        const n = 3 + this.phase;
        for (let i = 0; i < n; i++) {
          const sp = pick(g.L.spawns) || { x: this.x, y: this.y + T * 2 };
          const b = new SwarmBot(g, this, sp.x + rand(-8, 8), sp.y + rand(-8, 8)); b.state = 'hunt'; b.minion = true; g.enemies.push(b);
          FX.burst(sp.x, sp.y, 8, PAL.magenta, 90, 0.4, 1.4);
        }
        Sound.play('swarm'); this.atk = { k, t: 0, dur: 0.8 };
        break;
      }
      case 'drones': {
        const n = this.phase >= 3 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const sp = pick(g.L.spawns); if (!sp) break;
          const d = new Drone(g, { route: 'abcd', view: 7 }, Math.floor(sp.x / T), Math.floor(sp.y / T)); d.minion = true; d.investigate(p.x, p.y);
          g.enemies.push(d); FX.ring(sp.x, sp.y, 4, 40, 0.6, PAL.amber, 3);
        }
        this.atk = { k, t: 0, dur: 0.8 };
        break;
      }
      case 'mines': {
        for (let i = 0; i < 3; i++) { const a = Math.atan2(p.y - this.y, p.x - this.x) + (i - 1) * 0.7; g.enemies.push(new Mine(g, this.x + Math.cos(a) * T * 2.3, this.y + Math.sin(a) * T * 2.3)); }
        Sound.play('charge'); this.atk = { k, t: 0, dur: 0.8 };
        break;
      }
    }
  }
  fireRing(g) {
    const n = 16 + 4 * this.phase + this.ringBonus, gap = randInt(0, n - 1), sp = (3.8 + 0.6 * this.phase) * T, off = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      if (Math.abs(i - gap) <= 1 || Math.abs(i - gap) >= n - 1) continue;
      const a = off + i / n * TAU;
      g.bullets.push(new Bullet(this.x + Math.cos(a) * T * 1.9, this.y + Math.sin(a) * T * 1.9, Math.cos(a) * sp, Math.sin(a) * sp, 'enemy', 1, '#ff7a3a'));
    }
    Sound.play('shot'); FX.ring(this.x, this.y, T * 1.5, T * 2.6, 0.3, '#ff7a3a', 3);
  }
  update(dt, g) {
    const L = g.L, p = g.player;
    this.pulse += dt; this.flashT = Math.max(0, this.flashT - dt);
    for (const m of this.markers) if (m !== g.interactTarget && m.prog > 0) m.prog = Math.max(0, m.prog - dt);
    if (this.defeated) {
      if (this.dieT > 0) { this.dieT -= dt; if (Math.random() < dt * 12) { FX.burst(this.x + rand(-T, T), this.y + rand(-T, T), 14, pick([PAL.red, '#ffffff', PAL.amber]), 180, 0.5, 1.8); Sound.at('explode', this.x, this.y); } }
      return;
    }
    this.iris += angDiff(this.iris, Math.atan2(p.y - this.y, p.x - this.x)) * Math.min(1, dt * 4);
    this.profile(dt, g);
    // الأبراج المنطقية
    const A = L.nodeVal('A'), B = L.nodeVal('B'), C = L.nodeVal('C');
    let active = 0;
    for (const py of L.pylons) {
      if (py.val) { active++; continue; }
      const ok = !!(py.need && py.need.f(A, B, C)); py.locked = !ok;
      const near = p.alive && dist2(p.x, p.y, py.x, py.y) < (T * 0.9) ** 2;
      if (ok && near && this.shield) {
        py.charge = Math.min(1, py.charge + dt / 1.6);
        if (Math.random() < dt * 14) FX.add(1, py.x + rand(-12, 12), py.y + rand(-12, 12), 0, -30, 0.5, 2, PAL.mint);
        if (py.charge >= 1) { py.val = true; active++; Sound.play('hackOk'); FX.ring(py.x, py.y, 4, 46, 0.6, PAL.mint, 4); g.toast('عمود الرنين ' + py.name + ' يرنّ (' + active + '/4)'); }
      } else py.charge = Math.max(0, py.charge - dt * 0.5);
    }
    if (this.shield && active >= L.pylons.length && L.pylons.length) {
      this.shield = false; this.shieldT = 9; this.atk = null; this.cd = 9;
      Sound.play('boss'); R.addTrauma(0.6); FX.ring(this.x, this.y, T, T * 6, 0.7, PAL.cyan, 6);
      g.say('over', 'لا! الدرع… ينهار!', 3, 'high'); g.toast('الدرع سقط! أسرع إلى قلب العين واضغط «تفاعل» مطوّلاً');
    }
    if (!this.shield) {
      this.shieldT -= dt;
      if (this.shieldT <= 0) {
        this.shield = true; this.cd = 1.5;
        const on = L.pylons.filter(py => py.val); shuffle(on).slice(0, 2).forEach(py => { py.val = false; py.charge = 0; });
        g.say('over', 'تأخرت! عاد الدرع.', 3, 'mid'); Sound.play('hackFail');
      }
      return;
    }
    // الهجمات
    if (!p.alive || g.state !== 'playing') return;
    if (!this.atk) {
      this.cd -= dt;
      if (this.cd <= 0) this.start(this.choose(g), g);
      return;
    }
    const a = this.atk; a.t += dt;
    if (a.k === 'sweep') {
      if (a.t < a.charge) return;
      const st = a.sp * dt; a.a += a.dir * st; a.left -= st;
      const ox = this.x + Math.cos(a.a) * T * 2.25, oy = this.y + Math.sin(a.a) * T * 2.25;
      const len = L.ray(ox, oy, Math.cos(a.a), Math.sin(a.a), 30 * T);
      a.x1 = ox + Math.cos(a.a) * len; a.y1 = oy + Math.sin(a.a) * len; a.x0 = ox; a.y0 = oy;
      if (p.alive && segDist2(p.x, p.y, ox, oy, a.x1, a.y1) < (p.r * 0.9) ** 2) { g.damagePlayer(1, 'boss', a.x1 * 0.5 + ox * 0.5, a.y1 * 0.5 + oy * 0.5); Sound.play('laser'); }
      if (Math.random() < dt * 30) FX.add(0, a.x1, a.y1, rand(-90, 90), rand(-90, 90), 0.25, 1.4, '#ff8aa0');
      if (a.left <= 0) this.end();
    } else if (a.k === 'ring') {
      a.next -= dt;
      if (a.next <= 0 && a.shots > 0) { this.fireRing(g); a.shots--; a.next = 0.65; }
      if (a.shots <= 0 && a.next <= 0) this.end();
    } else if (a.t >= (a.dur || 1)) this.end();
  }
  end() { this.atk = null; this.cd = Math.max(0.9, 2.8 - this.phase * 0.5) + Math.random() * 0.8; }
  light(g) {
    const c = this.defeated ? '#ffb070' : this.shield ? PAL.red : '#ffffff';
    R.lightSprite(this.x, this.y, 6.5 * T, c, this.defeated ? 0.35 : 0.75);
    const a = this.atk;
    if (a && a.k === 'sweep' && a.x1 != null) { const n = 8; for (let k = 0; k <= n; k++) R.lightSprite(lerp(a.x0, a.x1, k / n), lerp(a.y0, a.y1, k / n), 1.6 * T, PAL.laser, 0.45); }
    for (const py of g.L.pylons) R.lightSprite(py.x, py.y, 2 * T, py.val ? PAL.mint : py.locked ? PAL.red : PAL.amber, 0.45);
  }
  draw(ctx, t) {
    const x = this.x, y = this.y, r = this.r;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.5, r * 1.15, r * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1d24'; ctx.beginPath(); ctx.arc(x, y, r * 1.02, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2f39'; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3d4450'; ctx.lineWidth = 3;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + this.pulse * 0.1; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); ctx.lineTo(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98); ctx.stroke(); }
    if (this.phase > 1 || this.defeated) {
      ctx.strokeStyle = '#0c0d10'; ctx.lineWidth = 2; ctx.beginPath();
      const n = this.defeated ? 4 : this.phase - 1;
      for (let k = 0; k < n; k++) { const a = k * 2.1 + 0.4; ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); ctx.lineTo(x + Math.cos(a + 0.3) * r * 0.62, y + Math.sin(a + 0.3) * r * 0.62); ctx.lineTo(x + Math.cos(a - 0.1) * r * 0.9, y + Math.sin(a - 0.1) * r * 0.9); }
      ctx.stroke();
    }
  }
  emit(ctx, t, g, glow) {
    const x = this.x, y = this.y, r = this.r;
    const alive = !this.defeated;
    const core = alive ? (this.shield ? PAL.red : '#ffffff') : '#5a3a30';
    const pl = 0.7 + 0.3 * Math.sin(this.pulse * (this.shield ? 3 : 9));
    ctx.fillStyle = col(core, pl); ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fill();
    if (alive) {
      const ix = x + Math.cos(this.iris) * r * 0.16, iy = y + Math.sin(this.iris) * r * 0.16;
      ctx.fillStyle = '#16060a'; ctx.beginPath(); ctx.arc(ix, iy, r * 0.17, 0, TAU); ctx.fill();
      ctx.fillStyle = col('#ffd0d0', 0.9); ctx.beginPath(); ctx.arc(ix + r * 0.05, iy - r * 0.05, r * 0.05, 0, TAU); ctx.fill();
      if (this.shield) {
        ctx.lineWidth = 4;
        for (let k = 0; k < 6; k++) {
          const a = this.pulse * 0.8 + k * TAU / 6;
          ctx.strokeStyle = col(PAL.cyan, 0.55 + 0.2 * Math.sin(this.pulse * 2 + k));
          ctx.beginPath(); ctx.arc(x, y, r * 1.12, a, a + TAU / 6 - 0.18); ctx.stroke();
        }
      } else {
        ctx.strokeStyle = col('#ffffff', 0.4 + 0.3 * Math.sin(this.pulse * 12)); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r * (1.1 + 0.08 * Math.sin(this.pulse * 6)), 0, TAU); ctx.stroke();
      }
    }
    const a = this.atk;
    if (a && a.k === 'sweep') {
      if (a.t < a.charge) {
        const ox = x + Math.cos(a.a) * T * 2.25, oy = y + Math.sin(a.a) * T * 2.25, len = g.L.ray(ox, oy, Math.cos(a.a), Math.sin(a.a), 30 * T);
        ctx.strokeStyle = col(PAL.laser, 0.25 + 0.5 * (a.t / a.charge)); ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a.a) * len, oy + Math.sin(a.a) * len); ctx.stroke(); ctx.setLineDash([]);
      } else if (a.x1 != null) {
        ctx.lineCap = 'round';
        ctx.strokeStyle = col(PAL.laser, 0.4); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(a.x0, a.y0); ctx.lineTo(a.x1, a.y1); ctx.stroke();
        ctx.strokeStyle = '#ffe0e6'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(a.x0, a.y0); ctx.lineTo(a.x1, a.y1); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }
    if (!glow && alive && Settings.aiDebug) {
      let s = 'المرحلة ' + this.phase + (this.atk ? ' · ' + (BOSS_ATTACK_NAMES[this.atk.k] || '') : '');
      txtLabel(ctx, s, x, y - r - 22, '#ffffff', 9);
      const ks = Object.keys(this.scores);
      ks.forEach((k, i) => txtLabel(ctx, (BOSS_ATTACK_NAMES[k] || k) + ' ' + this.scores[k].toFixed(2), x, y + r + 14 + i * 11, k === this.lastAtk ? PAL.yellow : '#b9c4ce', 8));
      txtLabel(ctx, 'قرب ' + Math.round(this.prof.near * 100) + '% · احتماء ' + Math.round(this.prof.cover * 100) + '%', x, y - r - 10, PAL.cyan, 8);
    }
  }
}
