// ذكاء البوتات: ملاحة A* على شبكة العقد، رؤية وسمع، تصويب بشري بأخطاء تتناقص، تسديد قنابل، تموضع للقنّاصين
import { WEAPONS } from './weapons.js';
import { eyeHeight, PH } from './move.js';

const DIFF = {
  // أضعف من قبل: ردّ فعل أبطأ، أخطاء أكبر، مدى رؤية أقصر، ونادراً ما يصيب الرأس
  easy: { react: 0.95, turn: 2.6, err: 0.14, errDecay: 1.1, head: 0.05, fov: 0.6, burst: 3, nade: 0.1, strafe: 0.35, sight: 45 },
  normal: { react: 0.62, turn: 4, err: 0.095, errDecay: 1.7, head: 0.14, fov: 0.52, burst: 4, nade: 0.22, strafe: 0.6, sight: 65 },
  hard: { react: 0.36, turn: 6.5, err: 0.05, errDecay: 3, head: 0.35, fov: 0.42, burst: 6, nade: 0.4, strafe: 0.85, sight: 95 },
};
const angTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export class Bot {
  constructor(sim, p, diff = 'normal') { this.s = sim; this.p = p; this.D = DIFF[diff] || DIFF.normal; this.reset(); }
  reset() {
    this.spawnT = this.s.t;
    this.path = []; this.goal = null; this.target = null; this.seenT = 0; this.lastSeen = null; this.lastSeenT = -99; this.react = 0;
    this.errX = 0; this.errY = 0; this.strafeT = 0; this.strafeDir = 1; this.senseT = Math.random() * 0.2; this.stuckT = 0; this.lastPos = this.p.pos.slice();
    this.plan = null; this.holdT = 0; this.flashed = 0; this.nadeCd = 3 + Math.random() * 6; this.crouchT = 0; this.wantAds = false; this.burstN = 0; this.pauseT = 0;
    this.heard = null; this.yaw = this.p.yaw; this.pitch = 0; this.thinkPlanT = 0;
    const L = this.p.loadout; this.sniper = !!(L.primary && WEAPONS[L.primary].cls === 'sniper');
  }
  onHurt(att) { if (!this.target || !this.target.alive) { this.heard = att.pos.slice(); this.heardT = this.s.t; } this.err(1.3); }
  onFlash(d) { this.flashed = Math.max(this.flashed, d * 0.9); }
  err(k = 1) { const e = this.D.err * k; this.errX = (Math.random() - 0.5) * e * 2; this.errY = (Math.random() - 0.5) * e * 1.4; }
  // ---------- الملاحة ----------
  nearestNode(pos) {
    const N = this.s.w.nav.nodes; let best = -1, bd = 1e9;
    for (let i = 0; i < N.length; i++) { const n = N[i], d = Math.hypot(n[0] - pos[0], (n[1] - pos[1]) * 2.5, n[2] - pos[2]); if (d < bd && (d < 3 || this.s.w.los(pos[0], pos[1] + 1, pos[2], n[0], n[1] + 1, n[2]))) { bd = d; best = i; } }
    return best;
  }
  route(toPos) {
    const nav = this.s.w.nav, a = this.nearestNode(this.p.pos), b = this.nearestNode(toPos);
    if (a < 0 || b < 0) return [];
    const N = nav.nodes, open = [a], g = new Map([[a, 0]]), came = new Map(), f = new Map([[a, 0]]);
    const h = i => Math.hypot(N[i][0] - N[b][0], N[i][2] - N[b][2]);
    const closed = new Set();
    let it = 0;
    while (open.length && it++ < 2000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if ((f.get(open[k]) ?? 1e9) < (f.get(open[bi]) ?? 1e9)) bi = k;
      const cur = open.splice(bi, 1)[0];
      if (cur === b) { const out = [b]; let c = b; while (came.has(c)) { c = came.get(c); out.unshift(c); } return out.map(i => N[i]); }
      closed.add(cur);
      for (const nb of nav.adj[cur]) {
        if (closed.has(nb)) continue;
        // قليل من العشوائية كي لا تسلك كل البوتات المسار نفسه
        const cost = (g.get(cur) || 0) + Math.hypot(N[cur][0] - N[nb][0], N[cur][1] - N[nb][1], N[cur][2] - N[nb][2]) * (1 + this.pathBias(nb));
        if (cost < (g.get(nb) ?? 1e9)) { came.set(nb, cur); g.set(nb, cost); f.set(nb, cost + h(nb)); if (!open.includes(nb)) open.push(nb); }
      }
    }
    return [];
  }
  pathBias(i) { if (!this.biasSeed) this.biasSeed = Math.random() * 1000; const x = Math.sin(i * 12.9898 + this.biasSeed) * 43758.5; return (x - Math.floor(x)) * 0.6; }
  pickPlan() {
    const s = this.s, p = this.p, enemyTeam = 1 - p.team;
    const enemySpawn = s.w.spawns[enemyTeam][0];
    const r = Math.random();
    if (this.sniper && r < 0.65) {
      // موقع قنص مرتفع قريب من فريقنا
      const N = s.w.nav.nodes.filter(n => n[1] > 3);
      const mine = s.w.spawns[p.team][0];
      N.sort((a, b) => Math.hypot(a[0] - mine[0], a[2] - mine[2]) - Math.hypot(b[0] - mine[0], b[2] - mine[2]));
      const spot = N[Math.floor(Math.random() * Math.min(3, N.length))];
      if (spot) return { kind: 'hold', pos: [spot[0], spot[1], spot[2]], until: s.t + 25 + Math.random() * 25 };
    }
    // اختيار مسار: غرب/وسط/شرق عبر نقطة وسيطة (تشمل المقبرة والحارة المهجورة وساحة الساعة)
    const lanes = [[-37, 0, -2], [0, 0, -2], [29, 0, 0], [-25, 0, -2], [0, 0, 10], [24, 0, 12], [-49, 0, -4], [-79, 0, -20], [-72, 0, 10], [66, 0, -2], [60, 0, -22], [66, 0, -32.4], [-70, 0, 26], [70, 0, 26]];
    const via = lanes[Math.floor(Math.random() * lanes.length)];
    if (s.tdm) {
      // وضع الإحياء: صيد في أرجاء الخريطة — أحياناً نحو أقرب عدو (كأنه سمع صوته)
      let near = null, nd = 1e9; for (const q of s.players.values()) if (q.alive && q.team !== p.team) { const d = Math.hypot(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]); if (d < nd) { nd = d; near = q; } }
      if (near && r < 0.3 && s.phase === 'live' && s.phaseT < s.timeLimit - 25) return { kind: 'push', via: near.pos.slice(), pos: near.pos.slice(), stage: 1 };
      if (r < 0.62) return { kind: 'hold', pos: via.slice(), until: s.t + 6 + Math.random() * 8 };
      const to = lanes[Math.floor(Math.random() * lanes.length)];
      return { kind: 'push', via: via.slice(), pos: to.slice(), stage: 0 };
    }
    if (r < 0.25) return { kind: 'hold', pos: via.slice(), until: s.t + 10 + Math.random() * 15 };
    return { kind: 'push', via: via.slice(), pos: [enemySpawn[0], enemySpawn[1], enemySpawn[2]], stage: 0 };
  }
  // ---------- الإدراك ----------
  sense() {
    const s = this.s, p = this.p, e = s.eye(p);
    const fyaw = p.yaw;
    let best = null, bd = 1e9;
    for (const q of s.players.values()) {
      if (!q.alive || q.team === p.team) continue;
      const qh = [q.pos[0], q.pos[1] + eyeHeight(q) - 0.25, q.pos[2]];
      const dx = qh[0] - e[0], dy = qh[1] - e[1], dz = qh[2] - e[2], d = Math.hypot(dx, dy, dz);
      if (d > (this.sniper ? this.D.sight * 1.7 : this.D.sight)) continue;
      const fx = -Math.sin(fyaw), fz = -Math.cos(fyaw), dot = (fx * dx + fz * dz) / Math.max(0.01, Math.hypot(dx, dz));
      const inFov = dot > this.D.fov - (q === this.target ? 0.6 : 0);
      const heard = d < 7 && Math.hypot(q.vel[0], q.vel[2]) > 3.5;
      // سماع إطلاق النار (الكاتم يقلّل المسافة كثيراً)
      if (s.t - (q.lastShot ?? -9) < 0.5 && d < (q.lastShotQuiet ? 14 : 48) && !this.target) { this.heard = q.pos.slice(); this.heardT = s.t; }
      if (!inFov && !heard) continue;
      if (!s.w.los(e[0], e[1], e[2], qh[0], qh[1], qh[2]) && !s.w.los(e[0], e[1], e[2], q.pos[0], q.pos[1] + 0.9, q.pos[2])) continue;
      if (s.smokeBetween(e, qh)) continue;
      if (d < bd) { bd = d; best = q; }
    }
    if (best) {
      if (best !== this.target) { this.target = best; this.react = this.D.react * (0.7 + Math.random() * 0.6) * (bd > 40 ? 1.35 : 1) + (s.t - (this.spawnT ?? -9) < 3 ? 0.6 : 0); this.err(bd > 30 ? 1.8 : 1.2); this.burstN = 0; }
      this.lastSeen = best.pos.slice(); this.lastSeenT = s.t;
    } else if (this.target && s.t - this.lastSeenT > 0.4) this.target = null;
  }
  // ---------- القرار ----------
  think(dt) {
    const s = this.s, p = this.p, D = this.D;
    const cmd = { mx: 0, mz: 0, yaw: this.yaw, pitch: this.pitch, jump: false, crouch: false, walk: false, fire: false, ads: false, reload: false, slot: 0, swap: false };
    if (s.phase === 'buy') { this.plan = null; this.path = []; return cmd; }
    this.flashed = Math.max(0, this.flashed - dt);
    this.senseT -= dt;
    if (this.senseT <= 0) { this.senseT = 0.1 + Math.random() * 0.06; if (this.flashed <= 0) this.sense(); }
    if (this.flashed > 0) { this.target = null; }
    const w = s.curW(p), wd = w ? WEAPONS[w.id] : null;
    // اختيار السلاح
    if (p.slot !== 1 && p.inv[1] && (p.inv[1].mag > 0 || p.inv[1].reserve > 0) && !this.nading) cmd.slot = 1;
    else if (p.slot === 1 && p.inv[1] && p.inv[1].mag === 0 && p.inv[1].reserve === 0) cmd.slot = 2;
    if (this.target && this.target.alive) {
      const q = this.target, e = s.eye(p);
      const aimHead = Math.random() < 0.02 ? (this.aimHead = Math.random() < D.head) : this.aimHead;
      const tz = aimHead ? eyeHeight(q) + 0.03 : eyeHeight(q) - 0.42;
      const tx = q.pos[0] + q.vel[0] * 0.05, ty = q.pos[1] + tz, tzz = q.pos[2] + q.vel[2] * 0.05;
      const dx = tx - e[0], dy = ty - e[1], dz = tzz - e[2], hd = Math.hypot(dx, dz), dist = Math.hypot(hd, dy);
      const far = 1 + Math.max(0, dist - 15) / 30, mv = Math.min(1, Math.hypot(q.vel[0], q.vel[2]) / 5);
      const wobble = Math.sin(s.t * 3.1 + p.id) * D.err * 0.25 * far * (0.5 + mv);
      const wantYaw = Math.atan2(-dx, -dz) + this.errX * far + wobble, wantPitch = Math.atan2(dy, hd) + this.errY * far;
      // تدوير سلس محدود السرعة
      const turn = D.turn * dt * (1 + Math.min(1.5, Math.abs(angTo(this.yaw, wantYaw)) * 0.8));
      const dyaw = angTo(this.yaw, wantYaw); this.yaw += Math.max(-turn, Math.min(turn, dyaw));
      const dp = wantPitch - this.pitch; this.pitch += Math.max(-turn, Math.min(turn, dp));
      // الخطأ يتناقص مع الزمن (وكأنه يضبط تصويبه)
      const k = Math.exp(-D.errDecay * dt); this.errX *= k; this.errY *= k;
      // يعوّض الارتداد جزئياً
      this.pitch -= p.punch[0] * dt * 6 * (D === DIFF.hard ? 1 : 0.5);
      this.react -= dt;
      const tol = Math.atan2(0.22, dist) + 0.01;
      const onTarget = Math.abs(angTo(this.yaw, wantYaw - this.errX)) < tol * 2.2 && Math.abs(this.pitch - (wantPitch - this.errY)) < tol * 2.2;
      if (wd) {
        if (wd.cls === 'sniper' || (dist > 25 && wd.cls === 'rifle' && p.scope && p.scope.startsWith('x'))) cmd.ads = true;
        const scopedOk = wd.cls !== 'sniper' || p.adsT > 0.85;
        const blocked = this.mateInLine(e, [tx, ty, tzz], dist);
        if (this.react <= 0 && onTarget && scopedOk && this.pauseT <= 0 && !blocked) {
          cmd.fire = true;
          if (!wd.auto) { if (this.fireToggle) cmd.fire = false; this.fireToggle = !this.fireToggle; }
          this.burstN += dt * (wd.rpm / 60);
          if (dist > 20 && wd.auto && this.burstN > D.burst) { this.burstN = 0; this.pauseT = 0.25 + Math.random() * 0.3; }
        }
        this.pauseT -= dt;
        if (w.mag === 0) cmd.reload = true;
      }
      // حركة قتالية: تمايل جانبي، انحناء عند البعد
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = 0.35 + Math.random() * 0.8; this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.crouchNow = dist > 18 && Math.random() < 0.35 && wd && wd.cls !== 'sniper'; }
      const standStill = wd && (wd.cls === 'sniper' || (dist > 22 && cmd.fire));
      if (!standStill && Math.random() < D.strafe) cmd.mx = this.strafeDir;
      cmd.crouch = !!this.crouchNow;
      if (dist < 4 && wd && wd.cls !== 'shotgun') cmd.mz = -0.6;
      // جريح: يتراجع إلى ساتر ليستعيد صحته (وضع الإحياء) بدل الموت المجاني
      if (s.tdm && p.hp < 38 && dist > 7 && !this.retreat && Math.random() < dt * 2.5) { const c = this.findCover(q); if (c) { this.retreat = { pos: c, until: s.t + 6 }; this.plan = { kind: 'hold', pos: c, until: s.t + 6 }; this.path = this.route(c); this.target = null; } }
      // قنبلة على عدو قريب خلف غطاء جزئي
    } else {
      this.aimHead = Math.random() < D.head;
      // لا هدف: اتبع الخطة
      if (this.retreat && s.t > this.retreat.until) this.retreat = null;
      // يعالج نفسه حين يكون بأمان
      if (p.healT > 0) { cmd.yaw = this.yaw; cmd.pitch = this.pitch; cmd.crouch = true; return cmd; }
      if (p.hp < p.maxHp * 0.62 && p.meds && (p.meds.b > 0 || p.meds.s > 0) && s.t - p.lastHurt > 2.5 && (!this.lastSeen || s.t - this.lastSeenT > 3)) { cmd.heal = p.hp < p.maxHp * 0.35 && p.meds.s > 0 ? 2 : (p.meds.b > 0 ? 1 : 2); cmd.crouch = true; return cmd; }
      if (!this.plan || this.planDone()) { this.plan = this.pickPlan(); this.path = []; }
      let goalPos = null;
      const recent = this.lastSeen && s.t - this.lastSeenT < 6;
      if (this.heard && s.t - this.heardT < 4) goalPos = this.heard;
      else if (recent) goalPos = this.lastSeen;
      else if (this.plan.kind === 'push') goalPos = this.plan.stage === 0 ? this.plan.via : this.plan.pos;
      else goalPos = this.plan.pos;
      // قنابل تجاه آخر موقع رآه
      this.nadeCd -= dt;
      if (recent && this.nadeCd <= 0 && p.inv[4] && p.inv[4].length && Math.random() < D.nade) {
        const d = Math.hypot(this.lastSeen[0] - p.pos[0], this.lastSeen[2] - p.pos[2]);
        if (d > 9 && d < 26 && this.safeThrow(this.lastSeen)) this.startNade(this.lastSeen);
        this.nadeCd = 6 + Math.random() * 8;
      }
      if (this.nading) return this.doNade(cmd, dt);
      // إعادة تلقيم في الأمان
      if (w && wd && wd.mag && w.mag < wd.mag * 0.5 && !recent) cmd.reload = true;
      // ملاحة
      const newGoal = !this.goal || Math.hypot(this.goal[0] - goalPos[0], this.goal[2] - goalPos[2]) > 2;
      if (newGoal || (!this.path.length && s.t > (this.rtT || 0) && Math.hypot(goalPos[0] - p.pos[0], goalPos[2] - p.pos[2]) > 2.2)) {
        this.goal = goalPos.slice(); this.path = this.route(goalPos); this.rtT = s.t + 0.6;
        // هدف لا يمكن بلوغه: خطة جديدة بدل الوقوف بلا حراك
        if (!this.path.length && !this.retreat && Math.hypot(goalPos[0] - p.pos[0], goalPos[2] - p.pos[2]) > 4) { this.plan = null; this.goal = null; }
      }
      let nxt = this.path[0];
      // آخر عقدة بُلغت والهدف قريب ومرئي: نمشي إليه مباشرة
      if (!nxt && Math.hypot(goalPos[0] - p.pos[0], goalPos[2] - p.pos[2]) > 1.2) {
        if (Math.hypot(goalPos[0] - p.pos[0], goalPos[2] - p.pos[2]) < 9 && s.w.los(p.pos[0], p.pos[1] + 1, p.pos[2], goalPos[0], goalPos[1] + 1, goalPos[2]) && s.w.los(p.pos[0], p.pos[1] + 0.35, p.pos[2], goalPos[0], goalPos[1] + 0.35, goalPos[2])) nxt = goalPos;
        else if (s.t > (this.rtT || 0) - 0.05 && !this.retreat && this.plan && !recent && !(this.heard && s.t - this.heardT < 4)) { this.plan = null; this.goal = null; }
      }
      if (nxt) {
        const dx = nxt[0] - p.pos[0], dz = nxt[2] - p.pos[2], d = Math.hypot(dx, dz);
        if (d < 0.9 && Math.abs(nxt[1] - p.pos[1]) < 1.2) { if (nxt !== goalPos) this.path.shift(); }
        else {
          const wantYaw = Math.atan2(-dx, -dz), turn = 6 * dt;
          this.yaw += Math.max(-turn, Math.min(turn, angTo(this.yaw, wantYaw)));
          this.pitch += (0 - this.pitch) * Math.min(1, dt * 4);
          // تحويل اتجاه الحركة إلى محاور محلية
          const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
          cmd.mz = (dx * fx + dz * fz) / d; cmd.mx = (dx * rx + dz * rz) / d;
          if (recent) cmd.walk = Math.random() < 0.5;
        }
      } else if (this.plan && this.plan.kind === 'hold') {
        // مراقبة: التفات بطيء نحو جهة العدو
        const es = s.w.spawns[1 - p.team][0], wantYaw = Math.atan2(-(es[0] - p.pos[0]), -(es[2] - p.pos[2])) + Math.sin(s.t * 0.4 + p.id) * 0.6;
        this.yaw += angTo(this.yaw, wantYaw) * Math.min(1, dt * 1.5);
        if (this.sniper) cmd.ads = Math.sin(s.t * 0.3 + p.id) > -0.2;
        cmd.crouch = this.sniper && Math.sin(s.t * 0.2 + p.id) > 0.6;
      }
      if (this.plan && this.plan.kind === 'push' && this.plan.stage === 0 && Math.hypot(p.pos[0] - this.plan.via[0], p.pos[2] - this.plan.via[2]) < 3) { this.plan.stage = 1; this.path = []; }
      // كشف التعلّق
      this.stuckT += dt;
      if (this.stuckT > 1.2) {
        const moved = Math.hypot(p.pos[0] - this.lastPos[0], p.pos[2] - this.lastPos[2]);
        if (moved < 0.5 && (cmd.mz || cmd.mx)) { cmd.jump = true; this.path = []; this.unstick = { t: 0.55, dir: Math.random() < 0.5 ? -1 : 1 }; if (Math.random() < 0.4) this.plan = null; }
        this.stuckT = 0; this.lastPos = p.pos.slice();
      }
    }
    // خطوة جانبية قصيرة لفكّ التعلّق بحافة صندوق أو عمود
    if (this.unstick && this.unstick.t > 0) { this.unstick.t -= dt; cmd.mx = this.unstick.dir; cmd.mz = -0.35; }
    if (this.flashed > 0) { cmd.mz = -0.5; cmd.fire = Math.random() < 0.05; }
    cmd.yaw = this.yaw; cmd.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
    return cmd;
  }
  planDone() {
    const s = this.s, p = this.p, P = this.plan;
    if (P.kind === 'hold') return s.t > P.until;
    if (P.kind === 'push') return P.stage === 1 && Math.hypot(p.pos[0] - P.pos[0], p.pos[2] - P.pos[2]) < 4;
    return true;
  }
  startNade(at) {
    const p = this.p, kinds = p.inv[4];
    const pref = kinds.includes('frag') ? 'frag' : kinds.includes('molotov') ? 'molotov' : kinds[0];
    while (kinds[0] !== pref && kinds.length > 1) kinds.push(kinds.shift());
    this.nading = { at: at.slice(), t: 0 };
  }
  doNade(cmd, dt) {
    const s = this.s, p = this.p, N = this.nading; N.t += dt;
    cmd.slot = 4;
    const dx = N.at[0] - p.pos[0], dz = N.at[2] - p.pos[2], d = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz);
    // زاوية رمي تقريبية لقذيفة بسرعة 17م/ث
    const v = 17, g = 15, ang = 0.5 * Math.asin(Math.min(1, g * d / (v * v)));
    this.yaw += angTo(this.yaw, yaw) * Math.min(1, dt * 8); this.pitch += (ang - 0.08 - this.pitch) * Math.min(1, dt * 8);
    cmd.yaw = this.yaw; cmd.pitch = this.pitch;
    if (p.slot === 4 && p.switchT <= 0) cmd.fire = N.t < 0.9 && this.safeThrow(N.at);
    if (N.t > 0.6 && !this.safeThrow(N.at)) { this.nading = null; cmd.slot = 1; cmd.fire = false; return cmd; }
    if (N.t > 1.2 || !p.inv[4].length) { this.nading = null; cmd.slot = 1; }
    return cmd;
  }
  // هل يقف زميل في خط النار؟
  mateInLine(e, t, dist) {
    const dx = (t[0] - e[0]) / dist, dy = (t[1] - e[1]) / dist, dz = (t[2] - e[2]) / dist;
    for (const m of this.s.players.values()) {
      if (m === this.p || !m.alive || m.team !== this.p.team) continue;
      const vx = m.pos[0] - e[0], vy = m.pos[1] + 1.1 - e[1], vz = m.pos[2] - e[2], k = vx * dx + vy * dy + vz * dz;
      if (k < 0 || k > dist) continue;
      if (Math.hypot(vx - dx * k, vy - dy * k, vz - dz * k) < 0.7) return true;
    }
    return false;
  }
  // رمي آمن: لا جدار قريب أمام اليد، والهدف بعيد عن الزملاء
  safeThrow(at) {
    const s = this.s, p = this.p, e = s.eye(p), dx = at[0] - p.pos[0], dz = at[2] - p.pos[2], d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;
    if (!s.w.los(e[0], e[1], e[2], e[0] + ux * 5, e[1] + 1.2, e[2] + uz * 5)) return false;
    if (!s.w.los(e[0], e[1], e[2], e[0] + ux * 3, e[1] + 0.3, e[2] + uz * 3)) return false;
    for (const m of s.players.values()) if (m.alive && m.team === p.team && m !== p && Math.hypot(m.pos[0] - at[0], m.pos[2] - at[2]) < 6) return false;
    return true;
  }
  // أقرب ساتر لا يراه العدو
  findCover(q) {
    const s = this.s, p = this.p, N = s.w.nav.nodes, qe = s.eye(q), out = [];
    for (const n of N) { if (n[3] === 'dead') continue; const d = Math.hypot(n[0] - p.pos[0], n[2] - p.pos[2]); if (d > 4 && d < 18) out.push([d, n]); }
    out.sort((a, b) => a[0] - b[0]);
    for (const [, n] of out.slice(0, 36)) {
      const dq = Math.hypot(n[0] - q.pos[0], n[2] - q.pos[2]), dp = Math.hypot(p.pos[0] - q.pos[0], p.pos[2] - q.pos[2]);
      if (dq < dp) continue; // لا نتراجع نحو العدو
      if (!s.w.los(qe[0], qe[1], qe[2], n[0], n[1] + 1.2, n[2])) return [n[0], n[1], n[2]];
    }
    return null;
  }
}
