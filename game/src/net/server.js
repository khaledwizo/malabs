// سيرفر المباراة: يدير المحاكاة المرجعية (الحركة، الإطلاق، الإصابات، البوتات، الجولات) ويرسل الحالة للاعبين
// يعمل في تطبيق «سيرفر الرافدين» على الهاتف الوسيط، أو في أي متصفح
import { Sim } from '../sim/sim.js';
import { defaultLoadout, MODES } from '../sim/weapons.js';
import { CHAR_ORDER } from '../game/chardefs.js';
import { HostLink } from './link.js';
import { Lan } from './lan.js';
import { PROTO, decCmd, encSnap, encRoster, slimEvent, decPlayer } from './proto.js';

const STEP = 1 / 60, SNAP_EVERY = 3, EV_REPEAT = 3, TIMEOUT = 10;
// حد ثابت بكل الأوضاع: 10 لاعبين بالمعركة (5 ضد 5) — البوتات محسوبة ضمن العشرة
export const MAX_TEAM = 5, MAX_PLAYERS = 10;
export const NS_O = 'rafidain/v2/o/', NS_C = 'rafidain/v2/c/';
const BOT_NAMES = ['يوسف', 'حيدر', 'زيد', 'عمر', 'مصطفى', 'ليث', 'أنمار', 'كرار', 'بلال', 'طارق', 'سجّاد', 'مرتضى', 'حسين', 'رعد', 'وسام'];
const now = () => performance.now() / 1000;
const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'لاعب';

export class GameServer {
  constructor(world, opt = {}) {
    this.world = world; this.room = opt.room;
    this.cfg = { mode: 'tdm', size: 4, rounds: 5, time: 600, difficulty: 'normal', fill: true, pref: false, ...(opt.cfg || {}) };
    if (!MODES[this.cfg.mode]) this.cfg.mode = 'tdm';
    this.cfg.size = Math.max(1, Math.min(MAX_TEAM, this.cfg.size | 0 || 4));
    this.hooks = opt.hooks || {}; this.adv = !!opt.adv; this.reportLive = !!opt.reportLive; this.bench = !!opt.bench; this.busy = 0; this.busyMs = 0; this.mid = opt.mid || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    this.clients = new Map(); // cid → عميل
    this.pid = 100; this.botN = 0; this.eid = 0; this.evq = [];
    this.status = 'جارٍ الاتصال بالوسيط…'; this.onchange = opt.onChange || (() => { }); this.log = opt.log || (() => { });
    this.lanName = opt.name || 'سيرفر الرافدين';
    this.ticks = 0; this.tickRate = 0; this.started = now(); this.overT = 0; this.rosterT = 0; this.brokers = opt.brokers;
    this.newSim();
  }
  async start() {
    const L = this.link = new HostLink(this.room, { brokers: this.brokers, rtc: this.rtc, onStatus: s => { this.status = s; this.onchange(); }, will: this.adv ? { topic: this.advTopic(), payload: '', retain: true } : null });
    L.lanName = this.lanName; L.lanInfo = this.lanInfo();
    this.lanIv = setInterval(() => { if (this.link && this.link.lanIp) Lan.info(this.lanInfo()); }, 2000);
    L.onmsg = (cid, m, via) => { try { this.onMsg(cid, m, via); } catch (e) { this.log('خطأ: ' + e.message); } };
    await L.open();
    this.run();
    return this;
  }
  advTopic() { return NS_O + this.cfg.mode + '/' + this.room; }
  // إعلان الغرفة المفتوحة (وضع المضيف) + تبليغ السيرفر المركزي بالمعارك اللي على هواتف اللاعبين
  announce() {
    if (!this.link || !this.link.mqs) return;
    const h = this.humans(), info = { room: this.room, mo: this.cfg.mode, h, h0: this.humans(0), h1: this.humans(1), t: Math.floor(Date.now() / 1000), mid: this.mid };
    for (const q of this.link.mqs) { if (this.adv) q.publish(this.advTopic(), h && h < MAX_PLAYERS ? JSON.stringify(info) : '', true); if (this.reportLive && h) q.publish(NS_C + 'live', JSON.stringify(info)); }
  }
  lanInfo() { return { mode: this.cfg.mode, size: this.cfg.size, humans: this.humans() }; }
  stop() { clearInterval(this.iv); clearInterval(this.lanIv); this.iv = null; for (const cl of this.clients.values()) this.leaveHook(cl, 'stop'); if (this.link) { if (this.adv && this.link.mqs) for (const q of this.link.mqs) q.publish(this.advTopic(), '', true); for (const cid of this.clients.keys()) this.link.sendTo(cid, { k: 'bye' }, true); this.link.close(); } }
  // ---------- المحاكاة ----------
  newSim() {
    const c = this.cfg;
    const sim = this.sim = new Sim(this.world, { mode: c.mode, roundsToWin: c.rounds, timeLimit: c.time, roundTime: c.roundTime, difficulty: c.difficulty, seed: (Date.now() & 0xffff) + 1 });
    sim.beforeStep = () => this.feed();
    sim.onStep = () => this.afterStep();
    this.evq.length = 0; this.overT = 0;
    for (const cl of this.clients.values()) { this.addHuman(cl); cl.queue.length = 0; }
    this.botN = 0; this.fillBots();
    if (this.humans() > 0) sim.start();
  }
  configure(cfg) { Object.assign(this.cfg, cfg); this.cfg.size = Math.max(1, Math.min(MAX_TEAM, this.cfg.size | 0 || 4)); this.newSim(); for (const [cid, cl] of this.clients) this.welcome(cid, cl); this.sendRoster(); this.onchange(); }
  humans(team) { let n = 0; for (const cl of this.clients.values()) if (team === undefined || cl.team === team) n++; return n; }
  addHuman(cl) { const p = this.sim.addPlayer({ id: cl.pid, name: cl.name, team: cl.team, char: cl.char, loadout: cl.loadout }); if (this.resumed) this.restoreOne(p); return p; }
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
        const have = new Set([...sim.players.values()].map(p => p.name)), rb = this.resume && this.resume.bots ? this.resume.bots.find(b => b.team === t && !have.has(b.name)) : null;
        if (rb) { sim.addPlayer({ id, name: rb.name, team: t, bot: true, char: rb.char, loadout: defaultLoadout(sim.mode) }); continue; }
        const used = new Set([...sim.players.values()].map(p => p.name)); let nm = BOT_NAMES[(this.botN++ + t * 5) % BOT_NAMES.length]; for (let g = 0; g < BOT_NAMES.length && used.has(nm); g++) nm = BOT_NAMES[(this.botN++ + t * 5) % BOT_NAMES.length];
        sim.addPlayer({ id, name: nm, team: t, bot: true, char: CHAR_ORDER[Math.floor(Math.random() * CHAR_ORDER.length)], loadout: defaultLoadout(sim.mode) });
      }
    }
  }
  // حلقة المحاكاة: مؤقّت كل 4ms، ويمكن «ضخّها» من الخارج (الخدمة بأندرويد) إذا خنق النظام المؤقّتات والشاشة مطفأة
  run() {
    this.L = { last: now(), acc: 0, cnt: 0, rt: now(), busy: 0 };
    this.iv = setInterval(() => this.loopOnce(), 4);
  }
  loopOnce() {
    const L = this.L; if (!L) return;
    const t = now(); let dt = t - L.last; if (dt < 0.002) return; L.last = t; if (dt > 0.25) dt = 0.25;
    L.acc += dt;
    while (L.acc >= STEP) { L.acc -= STEP; const a = performance.now(); this.tick(); L.busy += performance.now() - a; L.cnt++; }
    if (t - L.rt >= 1) { const span = t - L.rt; this.tickRate = Math.round(L.cnt / span); this.busyMs = L.busy / span; L.cnt = 0; L.busy = 0; L.rt = t; this.housekeep(); this.onchange(); }
  }
  tick() {
    const sim = this.sim;
    if (!this.humans() && !this.bench) return;
    if (sim.phase === 'wait') sim.start();
    if (this.resume && !this.resumed && this.ticks > 2) this.applyResume(); // نقل الاستضافة: نكمّل نفس المعركة بنفس الحالة
    sim.step(STEP);
    this.ticks++;
    if (sim.matchOver && !this.endSent) { this.endSent = true; this.endHook(); }
    if (!sim.matchOver) this.endSent = false;
    if (sim.phase === 'over') {
      this.overT += STEP;
      if (this.overT > 11) { this.overT = 0; this.mid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); for (const p of sim.players.values()) { p.kills = p.deaths = p.assists = p.dmgDone = p.hs = 0; } sim.start(); this.log('مباراة جديدة'); }
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
    if ((this.advT = (this.advT || 0) - 1) <= 0) { this.advT = 15; this.announce(); }
  }
  sendRoster() {
    if (!this.link) return;
    this.link.broadcast(encRoster(this.sim, new Map([...this.clients.values()].map(c => [c.pid, c.rtt || 0]))));
    // مين المضيف؟ (لاعب على نفس هاتف السيرفر) — حتى اللاعبين يعرفون منو يستلم إذا طلع
    let hp = -1; for (const [cid, cl] of this.clients) { const pe = this.link.peers.get(cid); if (pe && pe.local) hp = cl.pid; }
    this.link.broadcast({ k: 'hp', pid: hp, mid: this.mid, cfg: { size: this.cfg.size, rounds: this.cfg.rounds, time: this.cfg.time, roundTime: this.cfg.roundTime, difficulty: this.cfg.difficulty } });
  }
  // ---------- الرسائل ----------
  onMsg(cid, m, via) {
    let cl = this.clients.get(cid);
    if (m.k === 'hi') {
      if (m.v !== PROTO) { this.link.sendTo(cid, { k: 'err', msg: 'نسخة اللعبة مختلفة عن السيرفر — حدّث التطبيقين' }, true); return; }
      if (!cl) {
        const h0 = this.humans(0), h1 = this.humans(1);
        if (this.clients.size >= MAX_PLAYERS || (h0 >= MAX_TEAM && h1 >= MAX_TEAM)) { this.link.sendTo(cid, { k: 'err', msg: 'المعركة ممتلئة (10 لاعبين كحد أقصى)' }, true); return; }
        // في فريق الأصدقاء يقرّر المضيف الفرق مسبقاً — بشرط ما يتجاوز الفريق 5
        let team = this.cfg.pref && (m.tm === 0 || m.tm === 1) ? m.tm : h0 === h1 ? (m.tm === 1 ? 1 : 0) : h0 < h1 ? 0 : 1;
        if ((team ? h1 : h0) >= MAX_TEAM) team = 1 - team;
        cl = { cid, u: String(m.u || '').slice(0, 24), tk: String(m.tk || '').slice(0, 40), pid: ++this.pid, name: clean(m.n), char: CHAR_ORDER.includes(m.ch) ? m.ch : 'khaled', loadout: m.lo || {}, team, queue: [], lastCmd: null, ack: 0, top: 0, last: now(), rtt: 0, joined: now() };
        this.clients.set(cid, cl);
        const first = this.humans() === 1;
        if (first) this.newSim(); else { this.addHuman(cl); this.fillBots(); }
        this.log('انضمّ: ' + cl.name + ' ← فريق ' + (team ? 'الحُرّاس' : 'الصقور'));
        if (this.hooks.onJoin) try { this.hooks.onJoin({ u: cl.u, tk: cl.tk, n: cl.name, tm: team }); } catch (e) { }
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
      case 'lo': cl.loadout = { ...(m.l || {}), supply: (m.l && m.l.supply) || (cl.loadout && cl.loadout.supply) }; this.sim.setLoadout(cl.pid, cl.loadout); break; // المخزون يبقى
      case 'ch': if (CHAR_ORDER.includes(m.c)) { cl.char = m.c; this.sim.setChar(cl.pid, m.c); this.sendRoster(); } break;
      case 'pi': this.link.sendTo(cid, { k: 'po', c: m.c }); cl.rtt = +m.r || 0; break;
      case 'mk': this.sim.setMark(cl.pid, m.p); break;
      case 'bye': this.log('غادر: ' + cl.name); this.remove(cid); break;
    }
  }
  welcome(cid, cl) { this.link.sendTo(cid, { k: 'wl', pid: cl.pid, tm: cl.team, mo: this.sim.mode, rw: this.sim.roundsToWin, tl: this.sim.timeLimit, room: this.room }, true); }
  remove(cid) {
    const cl = this.clients.get(cid); if (!cl) return;
    this.leaveHook(cl, 'left');
    this.clients.delete(cid); this.sim.removePlayer(cl.pid); this.link.drop(cid);
    if (!this.humans()) { this.newSim(); } else this.fillBots();
    this.sendRoster(); this.onchange();
  }
  leaveHook(cl, why) { if (this.hooks.onLeave) try { const p = this.sim.players.get(cl.pid); this.hooks.onLeave({ u: cl.u, n: cl.name, dur: Math.round(now() - cl.joined), k: p ? p.kills : 0, d: p ? p.deaths : 0, why }); } catch (e) { } }
  endHook() {
    const sim = this.sim, res = [];
    for (const cl of this.clients.values()) { const p = sim.players.get(cl.pid); if (!p) continue; res.push({ u: cl.u, n: cl.name, tm: p.team, k: p.kills, d: p.deaths, a: p.assists, win: sim.winner < 0 ? 0 : sim.winner === p.team ? 1 : -1 }); }
    this.log('انتهت المعركة ' + sim.score[0] + ' : ' + sim.score[1]);
    if (this.hooks.onEnd) try { this.hooks.onEnd({ mid: this.mid, mode: sim.mode, score: sim.score.slice(), res }); } catch (e) { }
  }
  // ---------- نقل الاستضافة بالحالة الكاملة ----------
  // resume = { mid, score, round, phase, phaseT, cps:[[owner,prog]], pl:{اسم:حالة اللاعب}, bots:[{name,team,char,a}] } — يبنيه اللاعب الوارث من آخر لقطة وصلته
  applyResume() {
    const R = this.resume, sim = this.sim; this.resumed = true; this.resumeT = now();
    if (R.mid) this.mid = R.mid;
    if (R.score) sim.score = R.score.slice();
    if (R.round) sim.round = R.round;
    if (R.phase && R.phase !== 'wait' && R.phase !== 'over') { sim.phase = R.phase; sim.phaseT = Math.max(1, +R.phaseT || 1); }
    if (R.cps && sim.cps) R.cps.forEach((c, i) => { const cp = sim.cps[i]; if (cp && c) { cp.owner = c[0]; cp.prog = c[1]; } });
    for (const p of sim.players.values()) this.restoreOne(p);
    this.log('نقل الاستضافة: كمّلنا نفس المعركة · الجولة ' + sim.round + ' · ' + sim.score.join(':'));
  }
  restoreOne(p) {
    const R = this.resume; if (!R || now() - (this.resumeT || 0) > 40) return;
    let a = null;
    if (p.bot) { const b = (R.bots || []).find(x => x.name === p.name && !x.done); if (b) { b.done = true; a = b.a; } }
    else if (R.pl && R.pl[p.name] && !R.pl[p.name].done) { a = R.pl[p.name].a; R.pl[p.name].done = true; }
    if (!a) return;
    const id = p.id, team = p.team, old = p.inv || {};
    decPlayer(a, p, this.sim.t);
    p.id = id; p.team = team; p.dmgBy = p.dmgBy || new Map();
    for (const k of [1, 2]) { const w = p.inv[k], o = old[k]; if (w && o && o.id === w.id && o.at) w.at = o.at; }
  }
  info() {
    const s = this.sim;
    return {
      room: this.room, status: this.status, tick: this.tickRate, busy: Math.round(this.busyMs * 10) / 10, mid: this.mid, up: Math.floor(now() - this.started), phase: s.phase, round: s.round, score: s.score, mode: s.mode,
      players: [...s.players.values()].map(p => { const cl = [...this.clients.values()].find(c => c.pid === p.id); return { u: cl ? cl.u : '', name: p.name, team: p.team, bot: p.bot, alive: p.alive, k: p.kills, d: p.deaths, rtt: cl ? cl.rtt : 0, via: cl ? this.link.via(cl.cid) : '', char: p.char }; }),
    };
  }
}
