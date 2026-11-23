// محاكاة اللعبة المرجعية (السيرفر): الأوضاع، الإطلاق، الإصابات، القنابل، الإحياء، النقاط
// لا رسوميات هنا — نفس الكود يعمل على هاتف المضيف (في الخلفية) وفي اللعب المحلي ضد البوتات
import { CLS_AMMO, cleanSupply } from './weapons.js';
import { WEAPONS, NADES, MODES, validLoadout, defaultLoadout, withAtt } from './weapons.js';
import { PH, stepMove, eyeHeight } from './move.js';
import { raySphere, rayBox, F, MAT } from '../world/collide.js';
import { Bot } from './bot.js';

export const TEAMS = [{ id: 0, name: 'الفريق الأول', color: '#f0b04a' }, { id: 1, name: 'الفريق الثاني', color: '#4ad8f0' }];
// كل لاعب يرى فريقه «نحن المجاهدين» والآخر «هم الأعداء»
export const teamName = (t, my) => my == null || my < 0 ? TEAMS[t].name : t === my ? 'نحن المجاهدين' : 'هم الأعداء';
const PEN_COST = { [MAT.wood]: 0.9, [MAT.cloth]: 0.25, [MAT.plaster]: 1.6, [MAT.glass]: 0.2, [MAT.metal]: 3, [MAT.brick]: 3.5, [MAT.stone]: 5, [MAT.tile]: 3 };
export const LEAN = 0.4;
export const MAX_HP = 150;
// العلاج المتاح بعد كل إحياء: 5 ضمادات (+30 خلال 2.4ث) وإبرتان (+75 خلال 4ث)
export const MEDS = { b: { n: 5, hp: 30, t: 2.4, name: 'ضمادة' }, s: { n: 2, hp: 75, t: 4, name: 'إبرة' } };

export class Sim {
  constructor(world, opt = {}) {
    this.w = world;
    this.mode = MODES[opt.mode] ? opt.mode : 'tdm';
    const M = MODES[this.mode];
    this.rules = M.rules;
    this.timeLimit = opt.timeLimit || M.time || 600;
    this.roundsToWin = opt.roundsToWin || 5;
    this.roundTime = opt.roundTime || 115;
    this.buyTime = opt.buyTime ?? (this.rules !== 'rounds' ? 5 : 9);
    this.respawnDelay = opt.respawnDelay ?? 4;
    this.difficulty = opt.difficulty || 'normal';
    this.players = new Map(); this.nades = []; this.smokes = []; this.fires = [];
    this.events = []; this.t = 0; this.tick = 0; this.nid = 1;
    this.round = 0; this.score = [0, 0]; this.phase = 'wait'; this.phaseT = 0; this.winner = -1; this.matchOver = false;
    this.rng = mulberry(opt.seed || 12345);
    this.history = []; // لتعويض التأخير عبر الشبكة
    // أجسام قابلة للكسر وأهل السوق: حالة كل مباراة (العالم مشترك فنعيده لحالته السليمة)
    this.props = (world.props || []).map(p => ({ hp: p.hp, alive: true }));
    this.npcs = (world.npcs || []).map(n => ({ hp: 70, alive: true }));
    this.doors = (world.doors || []).map(() => ({ open: false, t: 0 }));
    this.resetWorld(false);
  }
  resetWorld(ev = true) {
    const W = this.w;
    (this.doors || []).forEach((st, i) => { st.open = false; st.t = 0; const d = W.doors[i]; if (d) W.restore(d.box); });
    (W.props || []).forEach((p, i) => { const st = this.props[i]; st.hp = p.hp; st.alive = true; for (const b of p.boxes) W.restore(b); });
    this.npcs.forEach((n, i) => { n.alive = true; n.hp = 70; const w = (W.npcs || [])[i]; if (w && w.box >= 0 && !n.away) W.restore(w.box); });
    if (ev) this.events.push({ t: 'reset' });
  }
  hitProp(pid, dmg, at) {
    const st = this.props[pid]; if (!st || !st.alive) return;
    st.hp -= dmg;
    if (st.hp <= 0) { st.alive = false; for (const b of this.w.props[pid].boxes) this.w.disable(b); this.events.push({ t: 'break', id: pid, k: this.w.props[pid].kind, p: at || this.w.props[pid].c }); }
  }
  // صناديق إصابة شخص من أهل السوق (جالس أو واقف)
  hitNpc(n, ox, oy, oz, d, maxT) {
    const sit = n.pose === 'sit', top = sit ? 1.12 : 1.5, hy = sit ? 1.27 : 1.64;
    if (raySphere(ox, oy, oz, d[0], d[1], d[2], n.x, n.y + 0.9, n.z, 1.2) < 0) return null;
    let best = null; const test = (t, part) => { if (t >= 0 && t < maxT && (!best || t < best.t)) best = { t, part }; };
    test(raySphere(ox, oy, oz, d[0], d[1], d[2], n.x, n.y + hy, n.z, 0.14), 'head');
    test(rayBox(ox, oy, oz, d[0], d[1], d[2], n.x - 0.25, n.y + (sit ? 0.35 : 0), n.z - 0.25, n.x + 0.25, n.y + top, n.z + 0.25), 'chest');
    return best;
  }
  damageNpc(i, att, dmg, dir, at) {
    const st = this.npcs[i]; if (!st || !st.alive) return;
    st.hp -= dmg; this.events.push({ t: 'npcHit', id: i, p: at });
    if (st.hp <= 0) { st.alive = false; const w = this.w.npcs[i]; if (w && w.box >= 0) this.w.disable(w.box); this.events.push({ t: 'npcDie', id: i, k: att ? att.id : -1, d: dir ? [dir[0], dir[1], dir[2]] : null }); }
  }
  get tdm() { return this.rules !== 'rounds'; } // إحياء (اشتباك + سيطرة)
  get dom() { return this.rules === 'dom'; }
  // ---------- اللاعبون ----------
  addPlayer(o) {
    const id = o.id ?? this.nid++;
    const p = {
      id, name: o.name || ('لاعب ' + id), team: o.team ?? 0, char: o.char || 'khaled', bot: !!o.bot,
      pos: [0, 0, 0], vel: [0, 0, 0], yaw: 0, pitch: 0, crouch: 0, lean: 0, onGround: true, jumpReady: true, height: PH.hStand,
      hp: MAX_HP, maxHp: MAX_HP, armor: 100, helmet: 100, alive: false, meds: { b: 0, s: 0 }, healT: 0, healK: 0, loadout: validLoadout(o.loadout || defaultLoadout(this.mode, this.rng), this.mode),
      inv: {}, slot: 1, prevSlot: 2, switchT: 0, nextFire: 0, reloadT: 0, fireLatch: false, shots: 0, punch: [0, 0], ads: false, adsT: 0,
      kills: 0, deaths: 0, assists: 0, dmgDone: 0, hs: 0, streak: 0, flash: 0, lastAtt: -1, dmgBy: new Map(), cmd: blankCmd(), seq: 0, ping: 0,
      throwT: 0, spawnProt: 0, respawnT: 0, lastHurt: -9, lastShot: -9, lastShotQuiet: false,
    };
    // مخزون اللاعب لهذا القيم (للبوتات لا حدود)
    const sup = !p.bot && o.loadout && o.loadout.supply ? cleanSupply(o.loadout.supply) : null;
    if (sup) { p.sup = sup; p.meds = sup.meds; p.supSrc = o.loadout.supply; }
    this.players.set(id, p);
    if (p.bot) p.brain = new Bot(this, p, this.difficulty);
    if (this.phase === 'buy' || this.phase === 'wait') this.spawn(p);
    else if (this.tdm && this.phase === 'live') p.respawnT = 1.5; // ينضم ويُحيا بعد لحظة
    return p;
  }
  removePlayer(id) { this.players.delete(id); }
  setLoadout(id, l) { const p = this.players.get(id); if (!p) return; p.loadout = validLoadout(l, this.mode); if ((this.phase === 'buy' || (this.tdm && p.spawnProt > 0 && p.shots === 0)) && p.alive) this.equip(p); }
  setChar(id, c) { const p = this.players.get(id); if (p) p.char = c; }
  input(id, cmd) { const p = this.players.get(id); if (!p) return; p.cmd = cmd; p.seq = cmd.seq || p.seq; }

  equip(p) {
    const L = p.loadout, inv = {}, S = p.sup;
    if (S) this.stash(p, p.alive && p.shots === 0);
    const mk = (id, att) => {
      if (!id) return null; const wd = withAtt(id, att);
      if (!S || !wd.mag) return { id, att: att || null, wd, mag: wd.mag, reserve: WEAPONS[id].reserve };
      // العتاد من مخزون القيم: المخزن يُملأ منه والباقي احتياط
      const t = CLS_AMMO[wd.cls], have = S.ammo[t] || 0, m = Math.min(wd.mag, have);
      return { id, att: att || null, wd, mag: m, reserve: have - m, at: t };
    };
    inv[1] = mk(L.primary, L.att); inv[2] = mk(L.secondary); inv[3] = mk('khanjar');
    if (S) { inv[4] = []; for (const k of L.nades) if ((S.nades[k] || 0) > inv[4].filter(x => x === k).length) inv[4].push(k); }
    else inv[4] = L.nades.slice();
    p.inv = inv; p.slot = inv[1] ? 1 : 2; p.prevSlot = inv[1] ? 2 : 3; p.switchT = 0.4; p.reloadT = 0; p.ads = false; p.adsT = 0; p.shots = 0; p.punch = [0, 0];
    p.scope = L.scope;
  }
  // نرجّع عتاد الأسلحة الحالية للمخزون (المخزن يضيع عند الموت)
  stash(p, keepMag) {
    const S = p.sup; if (!S || !p.inv) return;
    for (const k of [1, 2]) { const w = p.inv[k]; if (w && w.at) { S.ammo[w.at] = w.reserve + (keepMag ? w.mag : 0); w.at = null; } }
  }
  spawn(p, respawn) {
    let sp;
    if (respawn && this.tdm) sp = this.tdmSpawn(p);
    else if (this.tdm && (this.w.tdmStart || [])[p.team] && this.w.tdmStart[p.team].length) {
      // بداية مباراة الإحياء: كل فريق ينتشر في نصفه من الخريطة بعيداً عن الآخر
      const S = this.w.tdmStart[p.team], used = [...this.players.values()].filter(q => q.team === p.team && q !== p && q.alive).length;
      sp = S[(used * 3 + (p.id % S.length)) % S.length];
    } else {
      const S = this.w.spawns[p.team]; const used = [...this.players.values()].filter(q => q.team === p.team && q !== p && q.alive).length;
      sp = S[(used + (p.id % S.length)) % S.length] || [0, 0, 0, 0];
    }
    p.pos = [sp[0] + (this.rng() - 0.5) * 0.6, sp[1] + 0.05, sp[2] + (this.rng() - 0.5) * 0.6]; p.vel = [0, 0, 0];
    p.yaw = sp[3]; p.spawnYaw = sp[3]; p.pitch = 0; p.crouch = 0; p.lean = 0; p.hp = p.maxHp = MAX_HP; p.armor = 100; p.helmet = 100; p.alive = true;
    if (p.sup) p.meds = p.sup.meds; else p.meds = { b: MEDS.b.n, s: MEDS.s.n }; p.healT = 0; p.healK = 0; p.flash = 0; p.onGround = true; p.dmgBy.clear();
    p.spawnProt = this.tdm ? 3 : 0; p.respawnT = 0; p.streak = 0; p.lastHurt = -9; this.equip(p);
    if (p.brain) p.brain.reset();
  }
  // نقطة إحياء آمنة: بعيدة عن الأعداء ولا يراها أحدهم
  tdmSpawn(p) {
    const W = this.w, C = [];
    for (const s of W.spawns[p.team]) C.push([s[0], s[1], s[2], s[3], 6]);
    for (const s of (W.spawnsTdm || [])) C.push([s[0], s[1], s[2], s[3], 0]);
    const N = W.nav.nodes;
    for (let i = 0; i < N.length; i += 2) if (N[i][1] < 0.6 && !N[i][3]) C.push([N[i][0], N[i][1], N[i][2], null, -4]);
    const foes = [...this.players.values()].filter(q => q.alive && q.team !== p.team);
    const mates = [...this.players.values()].filter(q => q.alive && q.team === p.team && q !== p);
    let best = null, bs = -1e9;
    for (const c of C) {
      if (W.overlap(c[0], c[1] + 0.05, c[2], PH.r, PH.hStand)) continue;
      let dmin = 120, seen = false;
      for (const q of foes) {
        const d = Math.hypot(q.pos[0] - c[0], q.pos[2] - c[2]); dmin = Math.min(dmin, d);
        if (d < 80 && W.los(q.pos[0], q.pos[1] + 1.6, q.pos[2], c[0], c[1] + 1.4, c[2])) seen = true;
      }
      let mate = 0; for (const q of mates) { const d = Math.hypot(q.pos[0] - c[0], q.pos[2] - c[2]); if (d < 30) mate += 1; }
      // بعيد عن الأعداء (يفضّل 45م فأكثر) وغير مكشوف لهم، وقرب الزملاء قليلاً
      const sc = Math.min(dmin, 75) * 1.4 + (seen ? -120 : 0) + c[4] + Math.min(mate, 2) * 4 + this.rng() * 8 - (dmin < 30 ? 80 : 0);
      if (sc > bs) { bs = sc; best = c; }
    }
    if (!best) { const S = W.spawns[p.team][0]; return S; }
    // الاتجاه: نحو أقرب عدو أو نحو وسط الخريطة
    let yaw = best[3];
    if (yaw === null) { const b = W.bounds, cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2; yaw = Math.atan2(-(cx - best[0]), -(cz - best[2])); }
    return [best[0], best[1], best[2], yaw];
  }
  // ---------- الجولات والوقت ----------
  // علامة على الخريطة يشوفها الفريق (p = [x, z, مسار؟] أو null)
  setMark(id, p) {
    const q = this.players.get(id); if (!q) return;
    const v = Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]) ? [Math.max(-200, Math.min(200, +p[0])), Math.max(-200, Math.min(200, +p[1])), p[2] ? 1 : 0] : null;
    q.mark = v; this.events.push({ t: 'mark', id, team: q.team, p: v, name: q.name });
  }
  // ---------- الأبواب والأكل والمرقد ----------
  inNoFire(p) { for (const z of this.w.noFire || []) if (p.pos[0] > z[0] && p.pos[0] < z[2] && p.pos[2] > z[1] && p.pos[2] < z[3]) return true; return false; }
  doorBusy(d) { const [x0, z0, x1, z1] = d.bb; for (const q of this.players.values()) if (q.alive && q.pos[0] > x0 - 0.45 && q.pos[0] < x1 + 0.45 && q.pos[2] > z0 - 0.45 && q.pos[2] < z1 + 0.45 && q.pos[1] < d.y + d.h) return true; return false; }
  setDoor(i, open, by) {
    const d = this.w.doors[i], st = this.doors[i]; if (!d || st.open === open) return false;
    if (!open && this.doorBusy(d)) return false;
    st.open = open; st.t = open ? 10 : 0;
    if (open) this.w.disable(d.box); else this.w.restore(d.box);
    this.events.push({ t: 'door', i, open, by: by ?? -1 });
    return true;
  }
  // زر «استعمال»: أقرب باب، وإلا بسطة لبلبي أو چاي
  use(p) {
    let bd = 2.3, bi = -1;
    (this.w.doors || []).forEach((d, i) => { const dd = Math.hypot(d.x - p.pos[0], d.z - p.pos[2]); if (dd < bd && Math.abs(p.pos[1] - d.y) < 2) { bd = dd; bi = i; } });
    if (bi >= 0) { this.setDoor(bi, !this.doors[bi].open, p.id); return; }
    for (const u of this.w.usables || []) {
      if (Math.hypot(u.x - p.pos[0], u.z - p.pos[2]) > u.r) continue;
      const eat = u.kind === 'lablabi', f = p.food || (p.food = { e: 3, t: 8 });
      // باللوبي: مجاني وبلا حد. بالمعركة: حدّ لكل قيم (والفلوس تنحسب عند اللاعب)
      const free = this.rules === 'lobby';
      if (!free && (eat ? f.e <= 0 : f.t <= 0)) { this.events.push({ t: 'foodOut', id: p.id, k: u.kind }); return; }
      if (!free && p.hp >= p.maxHp - 1) { this.events.push({ t: 'foodFull', id: p.id, k: u.kind }); return; }
      if (!free) { if (eat) f.e--; else f.t--; }
      p.healT = eat ? 6 : 3; p.healK = eat ? 3 : 4; p.ads = false; p.reloadT = 0;
      this.events.push({ t: 'heal', id: p.id, k: p.healK, left: eat ? f.e : f.t }); return;
    }
  }
  tickDoors(dt) {
    if (this.pred) return;
    (this.w.doors || []).forEach((d, i) => {
      const st = this.doors[i];
      if (st.open) { st.t -= dt; if (st.t <= 0 && !this.setDoor(i, false)) st.t = 1; } // يتسكّر بعد 10 ثوانٍ (إذا ماكو أحد بالباب)
      else for (const q of this.players.values()) if (q.bot && q.alive && Math.hypot(d.x - q.pos[0], d.z - q.pos[2]) < 1.4) { this.setDoor(i, true, q.id); break; }
    });
  }
  // ---------- وضع السيطرة: نقاط تتغيّر كل قيم ----------
  initDom() {
    this.cps = []; if (!this.dom) return;
    const nav = this.w.nav; if (!nav) return;
    const n = this.players.size <= 4 ? 1 : 3, ST = this.w.tdmStart || [[], []];
    const cen = t => { const S = ST[t] || []; if (!S.length) return null; let x = 0, z = 0; for (const a of S) { x += a[0]; z += a[2]; } return [x / S.length, z / S.length]; };
    const c0 = cen(0), c1 = cen(1);
    // مرشّحون: أرض مفتوحة (روابط كثيرة) على مستوى الشارع
    const C = []; nav.nodes.forEach((a, i) => { if (a[1] < 0.3 && a[3] !== 'dead' && nav.adj[i].length >= 5 && !(this.w.noFire || []).some(z => a[0] > z[0] - 4 && a[0] < z[2] + 4 && a[2] > z[1] - 4 && a[2] < z[3] + 4)) C.push(a); });
    if (!C.length) return;
    const bal = a => c0 && c1 ? Math.hypot(a[0] - c0[0], a[2] - c0[1]) - Math.hypot(a[0] - c1[0], a[2] - c1[1]) : 0; // سالب = أقرب للفريق الأول
    const pickFrom = (L) => L[Math.floor(this.rng() * L.length)];
    const mid = C.filter(a => Math.abs(bal(a)) < 10); const P = [pickFrom(mid.length ? mid : C)];
    if (n === 3) {
      // نقطة بجهة كل فريق، قريبة من الوسطى (نوسّع البحث تدريجياً إذا ما لقينا)
      for (const sg of [-1, 1]) for (const R of [45, 65, 90, 400]) {
        const L = C.filter(a => sg * bal(a) > 6 && P.every(b => Math.hypot(a[0] - b[0], a[2] - b[2]) > 20) && Math.hypot(a[0] - P[0][0], a[2] - P[0][2]) < R);
        if (L.length) { P.push(pickFrom(L)); break; }
      }
    }
    const NAMES = ['أ', 'ب', 'ج'];
    // ترتيب من جهة الفريق الأول للثاني
    P.sort((a, b) => bal(a) - bal(b));
    this.cps = P.map((a, i) => ({ x: a[0], y: a[1], z: a[2], r: 5.5, owner: -1, prog: 0, name: NAMES[i] }));
    this.domAcc = 0;
  }
  tickDom(dt) {
    if (!this.cps || !this.cps.length) return;
    for (const c of this.cps) {
      let a = 0, b = 0;
      for (const p of this.players.values()) if (p.alive && Math.abs(p.pos[1] - c.y) < 3 && Math.hypot(p.pos[0] - c.x, p.pos[2] - c.z) < c.r) { if (p.team === 0) a++; else b++; }
      if (a && b) { c.contest = 1; continue; } c.contest = 0;
      if (!a && !b) continue;
      const t = a ? 0 : 1, k = Math.min(2, a || b), sgn = t === 0 ? -1 : 1, before = c.owner;
      // تحييد نقطة الخصم ثم السيطرة: ~5 ثوانٍ للاعب واحد
      c.prog = Math.max(-1, Math.min(1, c.prog + sgn * dt * 0.2 * (1 + 0.5 * (k - 1))));
      if (c.prog <= -1) c.owner = 0; else if (c.prog >= 1) c.owner = 1; else if ((c.owner === 0 && c.prog > 0) || (c.owner === 1 && c.prog < 0)) c.owner = -1;
      if (c.owner !== before) this.events.push({ t: 'cap', cp: c.name, owner: c.owner });
    }
    this.domAcc += dt;
    while (this.domAcc >= 1) { this.domAcc -= 1; for (const c of this.cps) if (c.owner >= 0) this.score[c.owner]++; }
  }
  start() {
    this.round = 0; this.score = [0, 0]; this.matchOver = false; this.winner = -1;
    this.resetWorld(true);
    for (const p of this.players.values()) {
      p.kills = p.deaths = p.assists = p.dmgDone = p.hs = p.kh = p.kb = 0; p.food = { e: 3, t: 8 };
      // قيم جديد بنفس الجلسة (أونلاين): مخزون جديد إذا اللاعب بعث واحد
      const S = !p.bot && p.loadout && p.loadout.supply; if (S && S !== p.supSrc) { p.sup = cleanSupply(S); p.meds = p.sup.meds; p.supSrc = S; }
    }
    this.initDom();
    this.newRound();
  }
  newRound() {
    this.round++; this.phase = 'buy'; this.phaseT = this.buyTime; this.winner = -1;
    this.nades.length = 0; this.smokes.length = 0; this.fires.length = 0;
    for (const p of this.players.values()) this.spawn(p);
    this.events.push({ t: 'round', n: this.round, phase: 'buy' });
  }
  alive(team) { let n = 0; for (const p of this.players.values()) if (p.alive && p.team === team) n++; return n; }
  hpSum(team) { let n = 0; for (const p of this.players.values()) if (p.alive && p.team === team) n += p.hp; return n; }
  endRound(winner, why) {
    if (this.phase !== 'live') return;
    this.phase = 'end'; this.phaseT = 5; this.winner = winner;
    if (this.tdm) { this.matchOver = true; this.phaseT = 6; }
    else {
      if (winner >= 0) this.score[winner]++;
      if (winner >= 0 && this.score[winner] >= this.roundsToWin) { this.matchOver = true; this.phaseT = 8; }
    }
    this.events.push({ t: 'roundEnd', winner, why, score: this.score.slice(), over: this.matchOver });
  }
  // ---------- الخطوة الرئيسية ----------
  step(dt) {
    if (this.beforeStep) this.beforeStep(dt);
    this.t += dt; this.tick++;
    this.tickDoors(dt);
    this.phaseT -= dt;
    if (this.phase === 'buy' && this.phaseT <= 0) { this.phase = 'live'; this.phaseT = this.tdm ? this.timeLimit : this.roundTime; this.events.push({ t: 'round', n: this.round, phase: 'live' }); }
    else if (this.phase === 'live') {
      if (this.tdm) {
        if (this.dom) this.tickDom(dt);
        for (const p of this.players.values()) if (!p.alive && p.respawnT > 0) { p.respawnT -= dt; if (p.respawnT <= 0) { this.spawn(p, true); this.events.push({ t: 'respawn', id: p.id }); } }
        if (this.phaseT <= 0) { const [a, b] = this.score; this.endRound(a === b ? -1 : a > b ? 0 : 1, 'انتهى الوقت'); }
      } else {
        const teams = new Set([...this.players.values()].map(p => p.team));
        if (teams.size >= 2) {
          const a = this.alive(0), b = this.alive(1);
          if (a === 0 && b === 0) this.endRound(-1, 'تعادل');
          else if (a === 0) this.endRound(1, 'أُسقط كل أفراد الفريق');
          else if (b === 0) this.endRound(0, 'أُسقط كل أفراد الفريق');
        }
        if (this.phaseT <= 0) { const ha = this.hpSum(0), hb = this.hpSum(1); this.endRound(ha === hb ? -1 : ha > hb ? 0 : 1, 'انتهى الوقت'); }
      }
    } else if (this.phase === 'end' && this.phaseT <= 0) {
      if (this.matchOver) {
        this.phase = 'over';
        // حساب كل لاعب: المتبقّي من مخزونه وقتلاته (لاعبين/بوتات) ونتيجته — اللعبة تحسب الفلوس منها
        for (const q of this.players.values()) if (q.sup) { this.stash(q, q.alive); this.events.push({ t: 'supply', id: q.id, sup: q.sup, kh: q.kh || 0, kb: q.kb || 0, as: q.assists || 0, res: this.winner < 0 ? 0 : this.winner === q.team ? 1 : -1 }); }
        this.events.push({ t: 'matchOver', score: this.score.slice(), winner: this.winner });
      }
      else this.newRound();
    }
    for (const p of this.players.values()) {
      if (p.brain && p.alive) p.cmd = p.brain.think(dt);
      this.stepPlayer(p, dt);
    }
    this.stepNades(dt);
    // سجلّ المواضع لتعويض التأخير (لاعبو الشبكة يرون الآخرين في الماضي القريب)
    const snap = new Map(); for (const p of this.players.values()) snap.set(p.id, [p.pos[0], p.pos[1], p.pos[2], p.crouch, p.lean, p.yaw]);
    this.history.push({ t: this.t, m: snap }); if (this.history.length > 90) this.history.shift();
    if (this.onStep) this.onStep(dt);
  }
  posAt(q, back) {
    const H = this.history, tq = this.t - back;
    if (!H.length || back <= 0) return null;
    for (let i = H.length - 1; i > 0; i--) {
      const a = H[i - 1], b = H[i];
      if (a.t <= tq && b.t >= tq) { const pa = a.m.get(q.id), pb = b.m.get(q.id); if (!pa || !pb) return null; const k = (tq - a.t) / Math.max(1e-6, b.t - a.t); return pa.map((v, j) => j === 5 ? pb[5] : v + (pb[j] - v) * k); }
    }
    const f = H[0].m.get(q.id); return f ? f.slice() : null;
  }
  curW(p) { return p.slot <= 3 ? p.inv[p.slot] : null; }
  curWD(p) { const w = this.curW(p); if (!w) return WEAPONS.khanjar; return w.wd || (w.wd = withAtt(w.id, w.att)); }
  curId(p) { return p.slot === 4 ? (p.inv[4][0] || 'frag') : (p.inv[p.slot] ? p.inv[p.slot].id : 'khanjar'); }
  // موضع العين مع الميل الجانبي
  eye(p) { const L = (p.lean || 0) * LEAN; return [p.pos[0] + Math.cos(p.yaw) * L, p.pos[1] + eyeHeight(p) - Math.abs(p.lean || 0) * 0.06, p.pos[2] - Math.sin(p.yaw) * L]; }
  stepPlayer(p, dt) {
    if (!p.alive) return;
    if (p.netWait) { p.netWait = false; return; } // لاعب شبكي لم يصل أمره بعد: ينتظر بدل أن نخمّن حركته
    const c = p.cmd;
    // اللوبي بلا قتال، والمرقد يُمنع فيه إطلاق النار ورمي القنابل
    if (this.rules === 'lobby' || this.inNoFire(p)) { c.fire = false; c.ads = false; if (p.slot === 4) c.slot = p.prevSlot || 2; }
    p.yaw = c.yaw; p.pitch = Math.max(-1.5, Math.min(1.5, c.pitch));
    const frozen = this.phase === 'buy' || this.phase === 'over' || (this.phase === 'end' && this.matchOver);
    const wd = this.curWD(p);
    const scoped = p.ads && (wd.cls === 'sniper' || wd.cls === 'dmr');
    // الميل الجانبي (استراق النظر) مع منعه من اختراق الجدران
    const wantLean = frozen ? 0 : Math.max(-1, Math.min(1, c.lean || 0));
    p.lean += Math.max(-dt * 7, Math.min(dt * 7, wantLean - p.lean));
    if (Math.abs(p.lean) > 0.01) {
      const s = Math.sign(p.lean), eh = eyeHeight(p), rx = Math.cos(p.yaw) * s, rz = -Math.sin(p.yaw) * s;
      const h = this.w.ray(p.pos[0], p.pos[1] + eh, p.pos[2], rx, 0, rz, LEAN + 0.2, F.NOPLAYER, {});
      if (h) { const lim = Math.max(0, (h.t - 0.2) / LEAN); if (Math.abs(p.lean) > lim) p.lean = s * lim; }
    }
    // العلاج: ضمادة أو إبرة — يُلغى بالإطلاق أو القفز أو تبديل السلاح
    if (!frozen && c.heal === 3 && p.healT <= 0 && !p.useLatch) { p.useLatch = true; if (!this.pred) this.use(p); }
    if (c.heal !== 3) p.useLatch = false;
    if (!frozen && c.heal && c.heal < 3 && p.healT <= 0) { const k = c.heal === 2 ? 's' : 'b', M = MEDS[k]; if (p.meds[k] > 0 && p.hp < p.maxHp - 1) { p.healT = M.t; p.healK = c.heal; p.ads = false; p.reloadT = 0; this.events.push({ t: 'heal', id: p.id, k: c.heal }); } }
    if (p.healT > 0) {
      if (c.fire || c.jump || (c.slot && c.slot !== p.slot) || c.reload) { p.healT = 0; p.healK = 0; }
      else if (p.healK >= 3) { p.healT -= dt; if (p.healT <= 0) { const eat = p.healK === 3; p.hp = Math.min(p.maxHp, p.hp + (eat ? 40 : 10)); p.healT = 0; p.healK = 0; this.events.push({ t: 'healed', id: p.id, k: eat ? 'eat' : 'tea' }); } }
      else { p.healT -= dt; if (p.healT <= 0) { const k = p.healK === 2 ? 's' : 'b'; p.meds[k]--; p.hp = Math.min(p.maxHp, p.hp + MEDS[k].hp); p.healT = 0; p.healK = 0; this.events.push({ t: 'healed', id: p.id, k }); } }
    }
    const healing = p.healT > 0;
    const speedMul = wd.speed * (scoped ? 0.55 : p.ads ? 0.75 : 1) * (1 - Math.abs(p.lean) * 0.3) * (healing ? 0.5 : 1);
    stepMove(p, frozen ? { ...c, mx: 0, mz: 0, jump: false } : c, dt, this.w, speedMul);
    if (p.landed > 11) this.damage(p, null, Math.round((p.landed - 11) * 9), 'fall', false);
    if (p.pos[1] < -8) this.damage(p, null, 999, 'fall', false);
    // الوميض والحماية والتعافي
    p.flash = Math.max(0, p.flash - dt);
    if (p.spawnProt > 0) p.spawnProt = Math.max(0, p.spawnProt - dt);
    // تعافٍ ذاتي بطيء حتى النصف فقط — الباقي بالضمادات والإبر
    if (this.tdm && p.hp < p.maxHp * 0.5 && this.t - p.lastHurt > 8 && this.phase === 'live') p.hp = Math.min(p.maxHp * 0.5, p.hp + 3 * dt);
    for (const f of this.fires) if (Math.hypot(p.pos[0] - f.x, p.pos[2] - f.z) < f.r && Math.abs(p.pos[1] - f.y) < 1.5) { this.damage(p, this.players.get(f.owner), NADES.molotov.dps * dt, 'molotov', false, true); }
    if (!p.alive) return;
    // ارتداد: لا يرجع كثيراً أثناء الرشق، ثم يعود بسرعة عند التوقف
    const firing = this.t - p.lastShot < 0.13;
    const rec = Math.exp(-(wd.recover || 6) * (firing ? 0.12 : 1) * dt);
    p.punch[0] *= rec; p.punch[1] *= rec;
    if (!c.fire) p.shots = Math.max(0, p.shots - dt * 12);
    // تبديل السلاح
    let want = c.slot || p.slot;
    if (c.swap) want = p.prevSlot;
    if (want !== p.slot && (want === 4 ? p.inv[4].length : p.inv[want])) { p.prevSlot = p.slot; p.slot = want; p.switchT = want === 1 && wd.cls === 'sniper' ? 0.8 : 0.55; p.reloadT = 0; p.ads = false; p.throwT = 0; this.events.push({ t: 'draw', id: p.id, w: this.curId(p) }); }
    p.switchT = Math.max(0, p.switchT - dt);
    const wd2 = this.curWD(p);
    p.ads = !!c.ads && p.slot <= 2 && p.reloadT <= 0 && p.switchT <= 0 && !frozen && p.healT <= 0 && !(wd2.bolt && this.t - (p.boltT ?? -9) < 0.8);
    p.adsT = Math.max(0, Math.min(1, p.adsT + (p.ads ? dt / (wd2.ads || 0.22) : -dt * 6)));
    if (frozen || healing) return;
    // قنبلة
    if (p.slot === 4) { this.handleNade(p, c, dt); return; }
    const w = this.curW(p); if (!w) return;
    // إعادة التلقيم
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (wd2.perShell) { if (p.reloadT <= 0 && w.mag < wd2.mag && w.reserve > 0) { w.mag++; w.reserve--; if (w.mag < wd2.mag && w.reserve > 0 && !c.fire) p.reloadT = wd2.reload; else p.reloadT = 0; } if (c.fire && w.mag > 0) p.reloadT = 0; }
      else if (p.reloadT <= 0) { const need = wd2.mag - w.mag, take = Math.min(need, w.reserve); w.mag += take; w.reserve -= take; this.events.push({ t: 'reloaded', id: p.id }); }
      if (p.reloadT > 0) return;
    }
    if ((c.reload || (w.mag === 0 && wd2.mag > 0)) && w.mag < wd2.mag && w.reserve > 0 && p.reloadT <= 0 && p.switchT <= 0 && this.t >= p.nextFire - 0.05) {
      p.reloadT = wd2.reload; p.ads = false; this.events.push({ t: 'reload', id: p.id, w: w.id }); return;
    }
    // الإطلاق
    if (!c.fire && !c.hold) p.fireLatch = false;
    if (c.fire && p.switchT <= 0 && this.t >= p.nextFire && (wd2.auto || !p.fireLatch)) {
      if (wd2.cls === 'knife') { this.knife(p, wd2); p.nextFire = this.t + 60 / wd2.rpm; p.fireLatch = true; p.spawnProt = 0; }
      else if (w.mag > 0) { this.fire(p, w, wd2); }
      else { p.fireLatch = true; this.events.push({ t: 'dry', id: p.id }); p.nextFire = this.t + 0.25; }
    }
  }
  fire(p, w, wd) {
    w.mag--; p.nextFire = this.t + 60 / wd.rpm; p.fireLatch = true; p.spawnProt = 0;
    const speed = Math.hypot(p.vel[0], p.vel[2]), a = p.adsT;
    let spread = wd.spread + (wd.hip || 0) * (1 - a) + wd.moveSpread * Math.min(1, speed / PH.run) + (p.onGround ? 0 : wd.airSpread);
    if (p.crouch > 0.5) spread *= 0.8;
    spread += Math.min(p.shots, 15) * (wd.cls === 'shotgun' ? 0 : a > 0.5 ? 0.00022 : 0.0011);
    const [ex, ey, ez] = this.eye(p);
    // الطلقة تذهب حيث يشير مركز الشاشة (المنظر = التصويب)
    const yaw = p.yaw + p.punch[1], pitch = p.pitch + p.punch[0];
    const pellets = wd.pellets || 1;
    const hits = [];
    for (let k = 0; k < pellets; k++) {
      const ang = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * spread;
      const d = dirFrom(yaw + Math.cos(ang) * r, pitch + Math.sin(ang) * r);
      hits.push(this.trace(p, ex, ey, ez, d, wd, w.id, p.lag || 0));
    }
    // ارتداد متصاعد بنمط ثابت + انحراف أفقي
    const sh = p.shots;
    const climbK = 1 + Math.min(sh, 20) * (wd.climb - 1) * 0.1;
    const v = wd.recoil[0] * climbK * (0.88 + this.rng() * 0.24) * (p.crouch > 0.5 ? 0.82 : 1) * (a > 0.5 ? 1 : 1.2);
    const hz = wd.recoil[1] * (Math.sin(sh * 0.75 + p.id * 1.7) * 0.85 + (this.rng() - 0.5) * 1.1);
    p.punch[0] = Math.min(p.punch[0] + v, 0.34); p.punch[1] = Math.max(-0.14, Math.min(0.14, p.punch[1] + hz));
    p.shots++; p.lastShot = this.t; p.lastShotQuiet = !!wd.quiet;
    if (wd.bolt) { p.ads = false; p.boltT = this.t; }
    this.events.push({ t: 'shot', id: p.id, w: w.id, o: [ex, ey, ez], q: wd.quiet ? 1 : 0, hits: hits.map(h => h.end), hk: hits.map(h => h.kind), n: hits.map(h => h.n), m: hits.map(h => h.mat) });
  }
  // تتبع طلقة: تخترق الأجسام الرقيقة، وتصيب صناديق إصابة اللاعبين
  trace(p, ox, oy, oz, d, wd, wid, back = 0) {
    let power = wd.pen, dmgMul = 1, x = ox, y = oy, z = oz, travelled = 0, wall = false;
    const maxD = 260;
    for (let seg = 0; seg < 5; seg++) {
      const wh = this.w.ray(x, y, z, d[0], d[1], d[2], maxD - travelled, F.NOBULLET, {});
      const wt = wh ? wh.t : maxD - travelled;
      // اللاعبون
      let best = null;
      for (const q of this.players.values()) {
        if (q === p || !q.alive) continue;
        const h = this.hitPlayer(q, x, y, z, d, wt, back);
        if (h && (!best || h.t < best.t)) best = h, best.q = q;
      }
      // أهل السوق
      const NP = this.w.npcs;
      if (NP) for (let i = 0; i < NP.length; i++) {
        const n = NP[i]; if (!n.kill || !this.npcs[i].alive || this.npcs[i].away) continue;
        const h = this.hitNpc(n, x, y, z, d, best ? best.t : wt);
        if (h) { best = h; best.npc = i; best.q = null; }
      }
      if (best && best.npc !== undefined) {
        const at = [x + d[0] * best.t, y + d[1] * best.t, z + d[2] * best.t];
        this.damageNpc(best.npc, p, wd.dmg * (best.part === 'head' ? 2.5 : 1) * dmgMul, d, at);
        return { end: at, kind: 'flesh', n: [0, 0, 0], mat: -1 };
      }
      if (best) {
        const dist = travelled + best.t;
        const mul = best.part === 'head' ? (wd.head || 2.3) : best.part === 'stomach' ? 1.1 : best.part === 'legs' ? 0.8 : 1;
        const dmg = wd.dmg * Math.pow(wd.range, dist / 10) * dmgMul * mul;
        this.damage(best.q, p, dmg, wid, best.part === 'head', false, wall, wd.armorPen, best.part, d);
        return { end: [x + d[0] * best.t, y + d[1] * best.t, z + d[2] * best.t], kind: 'flesh', n: [0, 0, 0], mat: -1 };
      }
      if (!wh) return { end: [x + d[0] * wt, y + d[1] * wt, z + d[2] * wt], kind: 'none', n: [0, 0, 0], mat: -1 };
      // جسم قابل للكسر (صندوق، جرّة، شاهد قبر…): يتلقى الضرر
      const pid = this.w.propOf ? this.w.propOf[wh.i] : -1;
      if (pid >= 0) this.hitProp(pid, wd.dmg * dmgMul * (wd.pellets ? 1 : 1), [wh.x, wh.y, wh.z]);
      const cost = PEN_COST[wh.mat] ?? 4;
      const th = this.w.thickness(wh.i, wh.x, wh.y, wh.z, d[0], d[1], d[2]);
      const need = (wh.flags & F.THIN ? cost * 0.5 : cost) * Math.min(th, 2);
      if (power <= 0 || need > power || th > 1.6) return { end: [wh.x, wh.y, wh.z], kind: 'wall', n: [wh.nx, wh.ny, wh.nz], mat: wh.mat };
      power -= need; dmgMul *= 0.6; wall = true;
      this.events.push({ t: 'impact', id: p.id, p: [wh.x, wh.y, wh.z], n: [wh.nx, wh.ny, wh.nz], mat: wh.mat });
      travelled += wh.t + th + 0.01; x = wh.x + d[0] * (th + 0.01); y = wh.y + d[1] * (th + 0.01); z = wh.z + d[2] * (th + 0.01);
    }
    return { end: [x, y, z], kind: 'none', n: [0, 0, 0], mat: -1 };
  }
  hitPlayer(q, ox, oy, oz, d, maxT, back = 0) {
    const rw = back > 0 ? this.posAt(q, back) : null;
    const crouch = rw ? rw[3] : q.crouch, lean = rw ? rw[4] : (q.lean || 0), yaw = rw ? rw[5] : q.yaw;
    const eh = eyeHeight({ crouch }), px = rw ? rw[0] : q.pos[0], py = rw ? rw[1] : q.pos[1], pz = rw ? rw[2] : q.pos[2];
    // فحص سريع بكرة محيطة
    if (raySphere(ox, oy, oz, d[0], d[1], d[2], px, py + 0.95, pz, 1.4) < 0) return null;
    const L = lean * LEAN, lx = Math.cos(yaw) * L, lz = -Math.sin(yaw) * L;
    const fx = -Math.sin(yaw) * 0.04, fz = -Math.cos(yaw) * 0.04;
    let best = null;
    const test = (t, part) => { if (t >= 0 && t < maxT && (!best || t < best.t)) best = { t, part }; };
    test(raySphere(ox, oy, oz, d[0], d[1], d[2], px + fx + lx, py + eh + 0.04 - Math.abs(lean) * 0.06, pz + fz + lz, 0.15), 'head');
    const chestY = py + eh - 0.3, cx = px + lx * 0.55, cz = pz + lz * 0.55;
    test(rayBox(ox, oy, oz, d[0], d[1], d[2], cx - 0.24, chestY - 0.34, cz - 0.24, cx + 0.24, chestY + 0.16, cz + 0.24), 'chest');
    test(rayBox(ox, oy, oz, d[0], d[1], d[2], px - 0.22 + lx * 0.25, chestY - 0.62, pz - 0.22 + lz * 0.25, px + 0.22 + lx * 0.25, chestY - 0.34, pz + 0.22 + lz * 0.25), 'stomach');
    test(rayBox(ox, oy, oz, d[0], d[1], d[2], px - 0.2, py, pz - 0.2, px + 0.2, chestY - 0.62, pz + 0.2), 'legs');
    return best;
  }
  knife(p, wd) {
    const [ex, ey, ez] = this.eye(p), d = dirFrom(p.yaw, p.pitch);
    let best = null;
    for (const q of this.players.values()) { if (q === p || !q.alive) continue; const h = this.hitPlayer(q, ex, ey, ez, d, wd.range); if (h && (!best || h.t < best.t)) { best = h; best.q = q; } }
    this.events.push({ t: 'knife', id: p.id, hit: !!best });
    if (!best) return;
    // طعنة من الخلف
    const back = Math.cos(best.q.yaw - p.yaw) > 0.5;
    this.damage(best.q, p, back ? wd.backDmg : wd.dmg, 'khanjar', false, false, false, 1, best.part, d);
  }
  // الدرع يمتص 30% من ضرر الجذع والخوذة 30% من ضرر الرأس حتى تتلف
  damage(q, att, dmg, weapon, hs, dot = false, wall = false, armorPen = 0.3, part = 'chest', dir = null) {
    if (!q.alive || this.phase === 'buy' || this.phase === 'over' || (this.phase === 'end' && this.matchOver)) return;
    if (att && att !== q && att.team === q.team) return; // لا نيران صديقة
    if (q.spawnProt > 0 && att && att !== q) return;
    let hd = dmg;
    if (!dot && weapon !== 'fall' && weapon !== 'khanjar') {
      const red = 0.3 * (1 - (armorPen || 0) * 0.5);
      if (part === 'head') { if (q.helmet > 0) { hd = dmg * (1 - red); q.helmet = Math.max(0, q.helmet - dmg * red * 1.3); } }
      else if (part !== 'legs' && q.armor > 0) { hd = dmg * (1 - red); q.armor = Math.max(0, q.armor - dmg * red * 1.6); }
    }
    hd = Math.max(dot ? 0 : 1, hd);
    q.hp -= hd; q.lastHurt = this.t;
    if (att) { att.dmgDone += hd; q.dmgBy.set(att.id, (q.dmgBy.get(att.id) || 0) + hd); q.lastAtt = att.id; }
    if (!dot || this.rng() < 0.1) this.events.push({ t: 'hit', v: q.id, a: att ? att.id : -1, dmg: Math.round(hd), hs, part, from: att ? [att.pos[0], att.pos[2]] : null, d: dir ? [dir[0], dir[1], dir[2]] : null });
    if (q.brain && att) q.brain.onHurt(att);
    if (q.hp <= 0) {
      q.hp = 0; q.alive = false; q.deaths++; q.streak = 0; this.stash(q, false);
      const killer = att && att !== q ? att : (q.lastAtt >= 0 ? this.players.get(q.lastAtt) : null);
      if (killer && killer.team !== q.team) { if (q.bot) killer.kb = (killer.kb || 0) + 1; else killer.kh = (killer.kh || 0) + 1; killer.kills++; killer.streak = (killer.streak || 0) + 1; if (hs) killer.hs++; }
      for (const [aid, d] of q.dmgBy) if (killer && aid !== killer.id && d >= 40) { const a = this.players.get(aid); if (a && a.team !== q.team) a.assists++; }
      if (this.tdm && this.phase === 'live') { if (!this.dom) this.score[1 - q.team]++; q.respawnT = this.respawnDelay; }
      this.events.push({ t: 'kill', v: q.id, k: killer ? killer.id : -1, w: weapon, hs, wall, pos: q.pos.slice(), d: dir ? [dir[0], dir[1], dir[2]] : null, streak: killer ? killer.streak : 0 });
    }
  }
  // ---------- القنابل ----------
  handleNade(p, c, dt) {
    const kind = p.inv[4][0];
    if (!kind) { p.slot = p.prevSlot || 2; return; }
    if (p.switchT > 0) return;
    if (c.fire && !p.throwT) p.throwT = 0.0001;
    if (p.throwT) {
      p.throwT += dt;
      if (!c.fire && !c.hold && p.throwT > 0.12) {
        const [ex, ey, ez] = this.eye(p), d = dirFrom(p.yaw, p.pitch + 0.08), sp = c.walk ? 9 : 17;
        const n = { id: this.nid++, kind, owner: p.id, team: p.team, pos: [ex + d[0] * 0.4, ey + d[1] * 0.4 - 0.1, ez + d[2] * 0.4], vel: [d[0] * sp + p.vel[0] * 0.6, d[1] * sp + 2 + p.vel[1] * 0.3, d[2] * sp + p.vel[2] * 0.6], t: 0, fuse: NADES[kind].fuse, rest: 0 };
        this.nades.push(n); p.inv[4].shift(); p.throwT = 0; p.spawnProt = 0; if (p.sup) p.sup.nades[kind] = Math.max(0, (p.sup.nades[kind] || 0) - 1);
        this.events.push({ t: 'throw', id: p.id, kind, nid: n.id });
        p.slot = p.inv[4].length ? 4 : (p.prevSlot && p.inv[p.prevSlot] ? p.prevSlot : 2); p.switchT = 0.45;
      }
    }
  }
  stepNades(dt) {
    const W = this.w;
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i]; n.t += dt;
      n.vel[1] -= 15 * dt;
      for (let s = 0; s < 3; s++) {
        const sdt = dt / 3, sp = Math.hypot(n.vel[0], n.vel[1], n.vel[2]);
        if (sp < 1e-4) break;
        const d = [n.vel[0] / sp, n.vel[1] / sp, n.vel[2] / sp], L = sp * sdt;
        const h = W.ray(n.pos[0], n.pos[1], n.pos[2], d[0], d[1], d[2], L + 0.06, F.NOBULLET, {});
        if (h) {
          n.pos = [h.x + h.nx * 0.07, h.y + h.ny * 0.07, h.z + h.nz * 0.07];
          const vn = n.vel[0] * h.nx + n.vel[1] * h.ny + n.vel[2] * h.nz;
          n.vel = [(n.vel[0] - 2 * vn * h.nx) * 0.5, (n.vel[1] - 2 * vn * h.ny) * 0.42, (n.vel[2] - 2 * vn * h.nz) * 0.5];
          if (h.ny > 0.5) { n.vel[0] *= 0.7; n.vel[2] *= 0.7; if (Math.abs(n.vel[1]) < 1.2) { n.vel[1] = 0; n.rest += sdt; } }
          if (sp > 3) this.events.push({ t: 'bounce', p: n.pos.slice(), nid: n.id });
          if (n.kind === 'molotov' && h.ny > 0.5) { n.t = 99; }
        } else { n.pos[0] += n.vel[0] * sdt; n.pos[1] += n.vel[1] * sdt; n.pos[2] += n.vel[2] * sdt; }
      }
      if (n.t >= n.fuse || (n.kind === 'smoke' && n.rest > 0.6)) { this.explode(n); this.nades.splice(i, 1); }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) { const s = this.smokes[i]; s.t += dt; if (s.t > s.life) this.smokes.splice(i, 1); }
    for (let i = this.fires.length - 1; i >= 0; i--) { const f = this.fires[i]; f.t += dt; if (f.t > f.life || this.smokes.some(s => Math.hypot(s.x - f.x, s.z - f.z) < s.r)) this.fires.splice(i, 1); }
  }
  explode(n) {
    const o = this.players.get(n.owner), [x, y, z] = n.pos, N = NADES[n.kind];
    this.events.push({ t: 'boom', kind: n.kind, p: [x, y, z], nid: n.id });
    if (n.kind === 'frag') {
      for (const q of this.players.values()) {
        if (!q.alive) continue;
        const c = [q.pos[0], q.pos[1] + 1, q.pos[2]], d = Math.hypot(c[0] - x, c[1] - y, c[2] - z);
        if (d > N.radius) continue;
        if (!this.w.los(x, y + 0.2, z, c[0], c[1], c[2])) continue;
        const dmg = N.dmg * Math.pow(1 - d / N.radius, 1.3);
        if (o && q.team === o.team && q !== o) continue;
        this.damage(q, o, dmg, 'frag', false, false, false, 0.6, 'chest', [(c[0] - x) / (d || 1), 0.4, (c[2] - z) / (d || 1)]);
      }
      (this.w.props || []).forEach((pr, i) => { if (!this.props[i].alive) return; const dd = Math.hypot(pr.c[0] - x, pr.c[1] - y, pr.c[2] - z); if (dd < N.radius * 0.8) this.hitProp(i, N.dmg * 1.5 * (1 - dd / N.radius), pr.c); });
      (this.w.npcs || []).forEach((nn, i) => { if (!nn.kill || !this.npcs[i].alive || this.npcs[i].away) return; const dd = Math.hypot(nn.x - x, nn.z - z); if (dd < N.radius && this.w.los(x, y + 0.2, z, nn.x, nn.y + 1, nn.z)) this.damageNpc(i, o, N.dmg * (1 - dd / N.radius), [(nn.x - x) / (dd || 1), 0.3, (nn.z - z) / (dd || 1)], [nn.x, nn.y + 1, nn.z]); });
    } else if (n.kind === 'smoke') this.smokes.push({ x, y, z, r: N.radius, t: 0, life: N.life });
    else if (n.kind === 'molotov') {
      const g = this.w.ray(x, y + 0.2, z, 0, -1, 0, 4, F.NOBULLET, {});
      const fy = g ? g.y : y;
      if (!this.smokes.some(s => Math.hypot(s.x - x, s.z - z) < s.r)) this.fires.push({ x, y: fy, z, r: N.radius, t: 0, life: N.life, owner: n.owner });
    } else if (n.kind === 'flash') {
      for (const q of this.players.values()) {
        if (!q.alive) continue;
        const e = this.eye(q), d = Math.hypot(e[0] - x, e[1] - y, e[2] - z);
        if (d > N.radius || !this.w.los(x, y, z, e[0], e[1], e[2])) continue;
        const f = dirFrom(q.yaw, q.pitch), to = [(x - e[0]) / d, (y - e[1]) / d, (z - e[2]) / d];
        const facing = f[0] * to[0] + f[1] * to[1] + f[2] * to[2];
        const dur = (facing > 0.5 ? 4.2 : facing > -0.2 ? 2.2 : 0.8) * (1 - d / N.radius * 0.6);
        q.flash = Math.max(q.flash, dur);
        if (q.brain) q.brain.onFlash(dur);
      }
    }
  }
  // هل يحجب الدخان خط الرؤية؟
  smokeBetween(a, b) {
    for (const s of this.smokes) {
      if (s.t < 1.0) continue;
      const r = s.r * Math.min(1, s.t / 2) * (s.t > s.life - 2 ? (s.life - s.t) / 2 : 1);
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1;
      const t = Math.max(0, Math.min(L, ((s.x - a[0]) * dx + (s.y + 1.5 - a[1]) * dy + (s.z - a[2]) * dz) / L));
      const px = a[0] + dx / L * t, py = a[1] + dy / L * t, pz = a[2] + dz / L * t;
      if (Math.hypot(px - s.x, (py - s.y - 1.5) * 1.4, pz - s.z) < r) return true;
    }
    return false;
  }
}

export function dirFrom(yaw, pitch) { const cp = Math.cos(pitch); return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp]; }
export function blankCmd() { return { mx: 0, mz: 0, yaw: 0, pitch: 0, jump: false, crouch: false, walk: false, fire: false, ads: false, reload: false, slot: 0, swap: false, lean: 0, heal: 0, seq: 0 }; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
