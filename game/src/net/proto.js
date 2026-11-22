// ترميز الرسائل بين اللاعب والسيرفر (مضغوط ليوفّر الإنترنت)
import { withAtt } from '../sim/weapons.js';
export const PROTO = 3;
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;

// ---------- الأوامر ----------
export function encCmd(c) {
  const b = (c.jump ? 1 : 0) | (c.crouch ? 2 : 0) | (c.walk ? 4 : 0) | (c.fire ? 8 : 0) | (c.ads ? 16 : 0) | (c.reload ? 32 : 0) | (c.swap ? 64 : 0);
  return [c.seq, Math.round(c.mx * 100), Math.round(c.mz * 100), r3(c.yaw), r3(c.pitch), b, c.slot || 0, r3(c.vt || 0), Math.round(c.lean || 0), c.heal || 0];
}
export function decCmd(a) {
  const b = a[5] | 0;
  return { seq: a[0] | 0, mx: clamp((a[1] | 0) / 100, -1, 1), mz: clamp((a[2] | 0) / 100, -1, 1), yaw: +a[3] || 0, pitch: clamp(+a[4] || 0, -1.5, 1.5), jump: !!(b & 1), crouch: !!(b & 2), walk: !!(b & 4), fire: !!(b & 8), ads: !!(b & 16), reload: !!(b & 32), swap: !!(b & 64), slot: clamp(a[6] | 0, 0, 4), vt: +a[7] || 0, lean: clamp(a[8] | 0, -1, 1), heal: clamp(a[9] | 0, 0, 2) };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- حالة اللاعب ----------
const inv = w => w ? [w.id, w.mag, w.reserve, w.att ? JSON.stringify(w.att) : 0] : 0;
const WD = new Map(); // تخزين مؤقت لخصائص السلاح مع الإضافات
const wdOf = (id, a) => { const k = id + '|' + (a || ''); let w = WD.get(k); if (!w) { w = withAtt(id, a ? JSON.parse(a) : null); WD.set(k, w); } return w; };
export function encPlayer(p, t) {
  const fl = (p.alive ? 1 : 0) | (p.onGround ? 2 : 0) | (p.ads ? 4 : 0) | (p.fireLatch ? 8 : 0) | (p.jumpReady ? 16 : 0) | (p.airDucked ? 32 : 0);
  return [p.id, r2(p.pos[0]), r2(p.pos[1]), r2(p.pos[2]), r2(p.vel[0]), r2(p.vel[1]), r2(p.vel[2]), r3(p.yaw), r3(p.pitch), r2(p.crouch), fl,
    Math.ceil(p.hp), Math.ceil(p.armor), p.slot, p.prevSlot, inv(p.inv[1]), inv(p.inv[2]), (p.inv[4] || []).join(','), p.scope || 0,
    r2(p.adsT), r2(Math.max(0, p.reloadT)), r2(p.switchT), r2(p.shots), r3(p.punch[0]), r3(p.punch[1]), r2(Math.max(0, p.nextFire - t)), r2(Math.min(9, t - p.lastHurt)),
    r2(p.flash), r2(p.throwT || 0), p.kills, p.deaths, p.assists, Math.round(p.dmgDone), p.hs, p.team, p.char, r3(p.spawnYaw ?? p.yaw), r2(p.landed || 0),
    r2(p.lean || 0), Math.ceil(p.helmet || 0), r2(p.spawnProt || 0), r2(Math.max(0, p.respawnT || 0)), p.streak || 0, r2(Math.max(0, p.healT || 0)), p.healK || 0, p.meds ? p.meds.b : 0, p.meds ? p.meds.s : 0];
}
// يطبّق المصفوفة على كائن لاعب موجود (يحافظ على المرجع)
export function decPlayer(a, p, t) {
  p.id = a[0]; p.pos = [a[1], a[2], a[3]]; p.vel = [a[4], a[5], a[6]]; p.yaw = a[7]; p.pitch = a[8]; p.crouch = a[9];
  const fl = a[10]; p.alive = !!(fl & 1); p.onGround = !!(fl & 2); p.ads = !!(fl & 4); p.fireLatch = !!(fl & 8); p.jumpReady = !!(fl & 16); p.airDucked = !!(fl & 32);
  p.hp = a[11]; p.armor = a[12]; p.slot = a[13]; p.prevSlot = a[14];
  const mk = x => x ? { id: x[0], mag: x[1], reserve: x[2], att: x[3] ? JSON.parse(x[3]) : null, wd: wdOf(x[0], x[3]) } : null;
  p.inv = { 1: mk(a[15]), 2: mk(a[16]), 3: { id: 'khanjar', mag: 0, reserve: 0 }, 4: a[17] ? a[17].split(',') : [] };
  p.scope = a[18] || null; p.adsT = a[19]; p.reloadT = a[20]; p.switchT = a[21]; p.shots = a[22]; p.punch = [a[23], a[24]];
  p.nextFire = t + a[25]; p.lastHurt = t - a[26]; p.flash = a[27]; p.throwT = a[28];
  p.kills = a[29]; p.deaths = a[30]; p.assists = a[31]; p.dmgDone = a[32]; p.hs = a[33]; p.team = a[34]; p.char = a[35]; p.spawnYaw = a[36]; p.landed = a[37];
  p.lean = a[38] || 0; p.helmet = a[39] || 0; p.spawnProt = a[40] || 0; p.respawnT = a[41] || 0; p.streak = a[42] || 0;
  p.healT = a[43] || 0; p.healK = a[44] || 0; p.meds = { b: a[45] || 0, s: a[46] || 0 }; p.maxHp = 150;
  return p;
}

// ---------- لقطة العالم ----------
export function encSnap(sim, acks, events) {
  return {
    k: 's', t: r3(sim.t), ph: sim.phase, pt: r2(sim.phaseT), r: sim.round, sc: sim.score, mo: sim.mode, rw: sim.roundsToWin, ov: sim.matchOver ? 1 : 0, ac: acks,
    p: [...sim.players.values()].map(p => encPlayer(p, sim.t)),
    n: sim.nades.map(n => [n.id, n.kind, r2(n.pos[0]), r2(n.pos[1]), r2(n.pos[2])]),
    cp: (sim.cps || []).map(c => [r2(c.x), r2(c.y), r2(c.z), c.r, c.owner, r2(c.prog), c.name, c.contest ? 1 : 0]),
    sm: sim.smokes.map(s => [r2(s.x), r2(s.y), r2(s.z), s.r, r2(s.t), s.life]),
    f: sim.fires.map(f => [r2(f.x), r2(f.y), r2(f.z), f.r, r2(f.t), f.life, f.owner]),
    e: events,
  };
}
export function encRoster(sim, humans) {
  const br = [], nd = []; (sim.props || []).forEach((s, i) => { if (!s.alive) br.push(i); }); (sim.npcs || []).forEach((s, i) => { if (!s.alive) nd.push(i); });
  return { k: 'ro', p: [...sim.players.values()].map(p => [p.id, p.name, p.bot ? 1 : 0, p.team, p.char, humans && humans.has(p.id) ? humans.get(p.id) : 0]), br, nd };
}

// تقليم الأحداث قبل الإرسال
export function slimEvent(e) {
  if (e.t === 'shot') return { t: 'shot', id: e.id, w: e.w, o: e.o.map(r2), hits: e.hits.map(h => h.map(r2)), hk: e.hk, n: e.n.map(v => v.map(r2)), m: e.m, q: e.q };
  if (e.t === 'impact') return { t: 'impact', id: e.id, p: e.p.map(r2), n: e.n.map(r2), mat: e.mat };
  if (e.t === 'bounce') return { t: 'bounce', p: e.p.map(r2) };
  if (e.t === 'kill') return { t: 'kill', v: e.v, k: e.k, w: e.w, hs: e.hs, wall: e.wall, d: e.d ? e.d.map(r2) : null, pos: e.pos ? e.pos.map(r2) : null, streak: e.streak };
  if (e.t === 'boom') return { t: 'boom', kind: e.kind, p: e.p.map(r2), nid: e.nid };
  return e;
}
