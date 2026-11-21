// سيرفر المباراة: يدير المحاكاة المرجعية (الحركة، الإطلاق، الإصابات، البوتات، الجولات) ويرسل الحالة للاعبين
// يعمل في تطبيق «سيرفر الرافدين» على الهاتف الوسيط، أو في أي متصفح
import { Sim } from '../sim/sim.js';
import { defaultLoadout, MODES } from '../sim/weapons.js';
import { CHAR_ORDER } from '../game/chardefs.js';
import { HostLink } from './link.js';
import { PROTO, decCmd, encSnap, encRoster, slimEvent } from './proto.js';

const STEP = 1 / 60, SNAP_EVERY = 3, EV_REPEAT = 3, TIMEOUT = 10, MAX_HUMANS = 10;
const BOT_NAMES = ['يوسف', 'حيدر', 'زيد', 'عمر', 'مصطفى', 'ليث', 'أنمار', 'كرار', 'بلال', 'طارق', 'سجّاد', 'مرتضى', 'حسين', 'رعد', 'وسام'];
const now = () => performance.now() / 1000;
const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'لاعب';

export class GameServer {
  constructor(world, opt = {}) {
    this.world = world; this.room = opt.room;
    this.cfg = { mode: 'tdm', size: 4, rounds: 5, time: 600, difficulty: 'normal', fill: true, pref: false, ...(opt.cfg || {}) };
    if (!MODES[this.cfg.mode]) this.cfg.mode = 'tdm';
    this.clients = new Map(); // cid → عميل
    this.pid = 100; this.botN = 0; this.eid = 0; this.evq = [];
    this.status = 'جارٍ الاتصال بالوسيط…'; this.onchange = opt.onChange || (() => { }); this.log = opt.log || (() => { });
    this.ticks = 0; this.tickRate = 0; this.started = now(); this.overT = 0; this.rosterT = 0; this.brokers = opt.brokers;
    this.newSim();
  }
  async start() {
    const L = this.link = new HostLink(this.room, { brokers: this.brokers, onStatus: s => { this.status = s; this.onchange(); } });
    L.onmsg = (cid, m, via) => { try { this.onMsg(cid, m, via); } catch (e) { this.log('خطأ: ' + e.message); } };
    await L.open();
    this.run();
    return this;
  }
  stop() { clearInterval(this.iv); this.iv = null; if (this.link) { for (const cid of this.clients.keys()) this.link.sendTo(cid, { k: 'bye' }, true); this.link.close(); } }
  // ---------- المحاكاة ----------
  newSim() {
    const c = this.cfg;
    const sim = this.sim = new Sim(this.world, { mode: c.mode, roundsToWin: c.rounds, timeLimit: c.time, difficulty: c.difficulty, seed: (Date.now() & 0xffff) + 1 });
    sim.beforeStep = () => this.feed();
    sim.onStep = () => this.afterStep();
    this.evq.length = 0; this.overT = 0;
    for (const cl of this.clients.values()) { this.addHuman(cl); cl.queue.length = 0; }
    this.botN = 0; this.fillBots();
    if (this.humans() > 0) sim.start();
  }
  configure(cfg) { Object.assign(this.cfg, cfg); this.newSim(); for (const [cid, cl] of this.clients) this.welcome(cid, cl); this.sendRoster(); this.onchange(); }
  humans(team) { let n = 0; for (const cl of this.clients.values()) if (team === undefined || cl.team === team) n++; return n; }
  addHuman(cl) { const p = this.sim.addPlayer({ id: cl.pid, name: cl.name, team: cl.team, char: cl.char, loadout: cl.loadout }); return p; }
  fillBots() {
    const sim = this.sim;
    for (const t of [0, 1]) {
      const want = this.cfg.fill ? Math.max(0, this.cfg.size - this.humans(t)) : 0;
      const bots = [...sim.players.values()].filter(p => p.bot && p.team === t);
      // نزيل البوتات الزائدة (الموتى أولاً)
      bots.sort((a, b) => a.alive - b.alive);
      while (bots.length > want) sim.removePlayer(bots.shift().id);
      for (let k = bots.length; k < want; k++) {
        const id = ++this.pid;
        const used = new Set([...sim.players.values()].map(p => p.name)); let nm = BOT_NAMES[(this.botN++ + t * 5) % BOT_NAMES.length]; for (let g = 0; g < BOT_NAMES.length && used.has(nm); g++) nm = BOT_NAMES[(this.botN++ + t * 5) % BOT_NAMES.length];
        sim.addPlayer({ id, name: nm, team: t, bot: true, char: CHAR_ORDER[Math.floor(Math.random() * CHAR_ORDER.length)], loadout: defaultLoadout(sim.mode) });
      }
    }
  }
  run() {
    let last = now(), acc = 0, cnt = 0, rt = now();
    this.iv = setInterval(() => {
      const t = now(); let dt = t - last; last = t; if (dt > 0.25) dt = 0.25;
      acc += dt;
      while (acc >= STEP) { acc -= STEP; this.tick(); cnt++; }
      if (t - rt >= 1) { this.tickRate = Math.round(cnt / (t - rt)); cnt = 0; rt = t; this.housekeep(); this.onchange(); }
    }, 4);
  }
  tick() {
    const sim = this.sim;
    if (!this.humans()) return;
    if (sim.phase === 'wait') sim.start();
    sim.step(STEP);
    this.ticks++;
    if (sim.phase === 'over') {
      this.overT += STEP;
      if (this.overT > 11) { this.overT = 0; for (const p of sim.players.values()) { p.kills = p.deaths = p.assists = p.dmgDone = p.hs = 0; } sim.start(); this.log('مباراة جديدة'); }
    }
  }
  // يوزّع أوامر اللاعبين قبل كل خطوة (أمر واحد لكل خطوة، مع تعويض التأخر)
  feed() {
    const sim = this.sim;
    for (const cl of this.clients.values()) {
      const p = sim.players.get(cl.pid); if (!p) continue;
      if (!cl.queue.length) { p.netWait = true; continue; } // لا نخمّن: ننتظر أمره القادم
      // لحاق: إن تراكمت الأوامر (تأخر الشبكة) ننفّذ الزائد فوراً كي لا يتأخر اللاعب
      let extra = 0;
      while (cl.queue.length > 2 && extra++ < 3) { this.use(cl, p, cl.queue.shift()); sim.stepPlayer(p, STEP); }
      this.use(cl, p, cl.queue.shift());
    }
  }
  use(cl, p, c) {
    cl.lastCmd = c; cl.ack = c.seq;
    p.lag = c.vt > 0 ? Math.max(0, Math.min(0.6, this.sim.t - c.vt)) : 0;
    this.sim.input(cl.pid, c);
  }
  afterStep() {
    const sim = this.sim;
    for (const e of sim.events) this.evq.push({ id: ++this.eid, e: slimEvent(e), n: 0 });
    sim.events.length = 0;
    if (this.ticks % SNAP_EVERY) return;
    const ev = [];
    for (const q of this.evq) { ev.push([q.id, q.e]); q.n++; }
    this.evq = this.evq.filter(q => q.n < EV_REPEAT);
    const acks = {}; for (const cl of this.clients.values()) acks[cl.pid] = cl.ack || 0;
    this.link && this.link.broadcast(encSnap(sim, acks, ev));
  }
  housekeep() {
    const t = now();
    for (const [cid, cl] of this.clients) if (t - cl.last > TIMEOUT) { this.log('انقطع: ' + cl.name); this.remove(cid); }
    if ((this.rosterT -= 1) <= 0) { this.rosterT = 2; this.sendRoster(); }
  }
  sendRoster() { if (this.link) this.link.broadcast(encRoster(this.sim, new Map([...this.clients.values()].map(c => [c.pid, c.rtt || 0])))); }
  // ---------- الرسائل ----------
  onMsg(cid, m, via) {
    let cl = this.clients.get(cid);
    if (m.k === 'hi') {
      if (m.v !== PROTO) { this.link.sendTo(cid, { k: 'err', msg: 'نسخة اللعبة مختلفة عن السيرفر — حدّث التطبيقين' }, true); return; }
      if (!cl) {
        if (this.clients.size >= MAX_HUMANS) { this.link.sendTo(cid, { k: 'err', msg: 'السيرفر ممتلئ' }, true); return; }
        const h0 = this.humans(0), h1 = this.humans(1);
        // في فريق الأصدقاء يقرّر المضيف الفرق مسبقاً
        const team = this.cfg.pref && (m.tm === 0 || m.tm === 1) ? m.tm : h0 === h1 ? (m.tm === 1 ? 1 : 0) : h0 < h1 ? 0 : 1;
        cl = { cid, pid: ++this.pid, name: clean(m.n), char: CHAR_ORDER.includes(m.ch) ? m.ch : 'khaled', loadout: m.lo || {}, team, queue: [], lastCmd: null, ack: 0, top: 0, last: now(), rtt: 0, joined: now() };
        this.clients.set(cid, cl);
        const first = this.humans() === 1;
        if (first) this.newSim(); else { this.addHuman(cl); this.fillBots(); }
        this.log('انضمّ: ' + cl.name + ' ← فريق ' + (team ? 'الحُرّاس' : 'الصقور'));
        this.sendRoster(); this.onchange();
      }
      cl.last = now();
      this.welcome(cid, cl);
      return;
    }
    if (!cl) { if (m.k !== 'bye') this.link.sendTo(cid, { k: 'who' }, true); return; }
    cl.last = now();
    switch (m.k) {
      case 'c': {
        if (!Array.isArray(m.c)) break;
        for (const a of m.c) { if (!Array.isArray(a) || a[0] <= cl.top) continue; cl.top = a[0]; cl.queue.push(decCmd(a)); }
        if (cl.queue.length > 12) cl.queue.splice(0, cl.queue.length - 6);
        break;
      }
      case 'lo': cl.loadout = m.l || {}; this.sim.setLoadout(cl.pid, cl.loadout); break;
      case 'ch': if (CHAR_ORDER.includes(m.c)) { cl.char = m.c; this.sim.setChar(cl.pid, m.c); this.sendRoster(); } break;
      case 'pi': this.link.sendTo(cid, { k: 'po', c: m.c }); cl.rtt = +m.r || 0; break;
      case 'bye': this.log('غادر: ' + cl.name); this.remove(cid); break;
    }
  }
  welcome(cid, cl) { this.link.sendTo(cid, { k: 'wl', pid: cl.pid, tm: cl.team, mo: this.sim.mode, rw: this.sim.roundsToWin, tl: this.sim.timeLimit, room: this.room }, true); }
  remove(cid) {
    const cl = this.clients.get(cid); if (!cl) return;
    this.clients.delete(cid); this.sim.removePlayer(cl.pid); this.link.drop(cid);
    if (!this.humans()) { this.newSim(); } else this.fillBots();
    this.sendRoster(); this.onchange();
  }
  info() {
    const s = this.sim;
    return {
      room: this.room, status: this.status, tick: this.tickRate, up: Math.floor(now() - this.started), phase: s.phase, round: s.round, score: s.score, mode: s.mode,
      players: [...s.players.values()].map(p => { const cl = [...this.clients.values()].find(c => c.pid === p.id); return { name: p.name, team: p.team, bot: p.bot, alive: p.alive, k: p.kills, d: p.deaths, rtt: cl ? cl.rtt : 0, via: cl ? this.link.via(cl.cid) : '', char: p.char }; }),
    };
  }
}
