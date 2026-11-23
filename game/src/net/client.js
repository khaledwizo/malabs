// اللاعب المتصل: نسخة «ظلّ» من المحاكاة تتصرف كأنها Sim أمام اللعبة
// - حركتي وسلاحي يُتنبّأ بهما فوراً محلياً ثم تُصحَّح بلطف عند وصول حالة السيرفر
// - بقية اللاعبين يُعرضون بالاستيفاء بين لقطتين (قبل 120ms) لحركة ناعمة
import { Sim, LEAN } from '../sim/sim.js';
import { MODES } from '../sim/weapons.js';
import { eyeHeight } from '../sim/move.js';
import { ClientLink, LocalLink, newId } from './link.js';
import { brokerList } from './mqtt.js';
import { PROTO, encCmd, decPlayer } from './proto.js';

const STEP = 1 / 60, INTERP = 0.12, now = () => performance.now() / 1000;
const LOCAL_EV = new Set(['shot', 'impact', 'draw', 'reload', 'reloaded', 'dry', 'knife', 'throw', 'heal', 'healed']);
const lerpA = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

export class NetSim {
  constructor(world, opt) {
    this.online = true; this.w = world; this.room = opt.room; this.opt = opt;
    this.players = new Map(); this.nades = []; this.smokes = []; this.fires = []; this.events = [];
    this.t = 0; this.phase = 'wait'; this.phaseT = 0; this.round = 0; this.score = [0, 0]; this.mode = opt.mode || 'tdm'; this.roundsToWin = 5; this.matchOver = false; this.timeLimit = 600; this.respawnDelay = 4;
    this.me = -1; this.state = 'idle'; this.status = ''; this.ping = 0; this.lastSnap = 0; this.lastSnapT = -1;
    this.snaps = []; this.seen = new Map(); this.maxEid = 0; this.roster = new Map(); this.offset = null;
    this.mini = null; this.pp = null; this.seq = 0; this.hist = []; this.recent = []; this.cmd = null; this.corr = [0, 0, 0]; this.sendN = 0;
    this.onlost = null; this.onjoin = null; this.stat = { n: 0, sum: 0, max: 0, big: 0 };
  }
  get via() { return this.link ? this.link.via : 'relay'; }
  get rules() { return (MODES[this.mode] || MODES.tdm).rules; }
  get props() { return this.mini ? this.mini.props : []; }
  get npcs() { return this.mini ? this.mini.npcs : []; }
  // تطبيق حالة العالم القادمة من السيرفر (تحطّم الأجسام وموت أهل السوق) على نسختنا المحلية
  worldEvent(e) {
    const mini = this.mini; if (!mini) return;
    if (e.t === 'break') { const st = mini.props[e.id]; if (st && st.alive) { st.alive = false; st.hp = 0; for (const b of this.w.props[e.id].boxes) this.w.disable(b); } }
    else if (e.t === 'npcDie') { const st = mini.npcs[e.id]; if (st && st.alive) { st.alive = false; const w = this.w.npcs[e.id]; if (w && w.box >= 0) this.w.disable(w.box); } }
    else if (e.t === 'reset') mini.resetWorld(false);
  }
  get tdm() { return this.rules !== 'rounds'; }
  get dom() { return this.rules === 'dom'; }
  // ---------- الاتصال ----------
  // نجرّب الوسطاء بالترتيب حتى يردّ السيرفر (السيرفر يستمع على كل الوسطاء معاً)
  async connect() {
    const list = this.opt.brokers || brokerList(), cid = newId();
    const say = s => { this.status = s; this.opt.onStatus && this.opt.onStatus(s); };
    // المضيف نفسه: يتصل بالسيرفر الذي يعمل على هاتفه مباشرة
    if (this.opt.local) {
      const L = this.link = new LocalLink(this.opt.local, { cid, onStatus: say });
      L.onmsg = m => { try { this.onMsg(m); } catch (e) { console.warn(e); } };
      await L.open(); this.state = 'joining';
      const ok = await new Promise(res => { this._join = res; this.sayHi(); setTimeout(() => res(false), 5000); });
      this._join = null;
      if (ok !== true) { this.state = 'closed'; throw new Error('تعذّر تشغيل السيرفر على هذا الهاتف'); }
      this.pingIv = setInterval(() => { if (this.link) this.link.send({ k: 'pi', c: now(), r: 0 }); }, 1000);
      return this;
    }
    let err = 'تعذّر الوصول إلى الإنترنت';
    for (const url of list) {
      if (this.state === 'closed') break;
      const L = this.link = new ClientLink(this.room, { cid, brokers: [url], onStatus: say });
      L.onmsg = m => { try { this.onMsg(m); } catch (e) { console.warn(e); } };
      L.onclosed = () => this.lost('انقطع الاتصال بالوسيط');
      try { await L.open(); } catch (e) { continue; }
      say('متصل · ننتظر ردّ السيرفر…');
      this.state = 'joining';
      const ok = await new Promise(res => { this._join = res; this.sayHi(); setTimeout(() => res(false), 6000); });
      this._join = null;
      if (ok === true) {
        this.pingIv = setInterval(() => { if (this.link) this.link.send({ k: 'pi', c: now(), r: Math.round(this.ping * 1000) }); if (this.state === 'joined' && now() - this.lastSnap > 8) this.lost('توقف السيرفر عن الرد'); }, 1000);
        return this;
      }
      clearTimeout(this.hiT); L.onclosed = null; L.close();
      if (this.state === 'error') throw new Error(this.status);
      err = 'لم يردّ السيرفر — تأكد من رمز الغرفة وأن تطبيق السيرفر يعمل ومتصل';
    }
    this.state = 'closed';
    throw new Error(err);
  }
  sayHi() {
    this.state = this.state === 'joined' ? 'rejoin' : 'joining';
    const o = this.opt;
    const hi = () => { if (this.state !== 'joining' && this.state !== 'rejoin') return; this.link.send({ k: 'hi', v: PROTO, n: o.name, ch: o.char, lo: o.loadout, tm: o.team }, true); this.hiT = setTimeout(hi, 1500); };
    clearTimeout(this.hiT); hi();
  }
  lost(why) {
    if (this.state === 'lost' || this.state === 'closed' || this.state === 'error') return;
    if (this._join) { this.state = 'error'; this.status = why; this._join(false); return; }
    this.state = 'lost'; this.status = why;
    if (this.onlost) this.onlost(why);
  }
  close() { this.state = 'closed'; clearInterval(this.pingIv); clearTimeout(this.hiT); if (this.link) this.link.close(); this.link = null; }
  // ---------- الرسائل ----------
  onMsg(m) {
    switch (m.k) {
      case 'wl': this.welcome(m); break;
      case 'who': if (this.state === 'joined') this.sayHi(); break;
      case 'po': { const r = now() - m.c; if (r >= 0 && r < 10) this.ping = this.ping ? this.ping * 0.75 + r * 0.25 : r; break; }
      case 'ro': for (const [id, name, bot, team, ch, rtt] of m.p) { this.roster.set(id, { name, bot: !!bot, team, char: ch, rtt }); const p = this.players.get(id); if (p) { p.name = name; p.bot = !!bot; } }
        if (this.mini && m.br) { for (const i of m.br) if (this.mini.props[i] && this.mini.props[i].alive) { this.worldEvent({ t: 'break', id: i }); this.events.push({ t: 'break', id: i, silent: 1 }); } }
        if (this.mini && m.nd) { for (const i of m.nd) if (this.mini.npcs[i] && this.mini.npcs[i].alive) { this.worldEvent({ t: 'npcDie', id: i }); this.events.push({ t: 'npcDie', id: i, silent: 1 }); } }
        break;
      case 's': if (this.state === 'joined') this.onSnap(m); break;
      case 'err': this.lost(m.msg || 'رفض السيرفر الاتصال'); break;
      case 'bye': this.lost('أُغلق السيرفر'); break;
    }
  }
  welcome(m) {
    clearTimeout(this.hiT);
    const fresh = m.pid !== this.me || !this.mini;
    this.me = m.pid; this.mode = m.mo; this.roundsToWin = m.rw; if (m.tl) this.timeLimit = m.tl;
    if (fresh) {
      const mini = this.mini = new Sim(this.w, { mode: m.mo, timeLimit: m.tl }); mini.pred = true; // تنبّؤ فقط: ما يفتح أبواب
      mini.damage = () => { }; mini.hitProp = () => { }; mini.damageNpc = () => { }; // الضرر يقرّره السيرفر وحده
      this.pp = mini.addPlayer({ id: m.pid, name: this.opt.name, team: m.tm, char: this.opt.char, loadout: this.opt.loadout });
      this.hist.length = 0; this.recent.length = 0; this.seq = 0; this.snaps.length = 0; this.offset = null; this.lastSnapT = -1;
      this.players.clear(); this.players.set(m.pid, this.view = { ...this.pp });
    } else { this.mini.mode = m.mo; }
    this.pp.team = m.tm;
    const first = this.state === 'joining';
    this.state = 'joined'; this.lastSnap = now();
    if (this._join) this._join(true);
    if (first) setTimeout(() => this.link && this.link.tryRtc(), 400);
  }
  onSnap(m) {
    const tl = now();
    // سيرفر أعيد تشغيله أو مباراة جديدة بزمن جديد
    if (this.lastSnapT >= 0 && m.t < this.lastSnapT - 2) { this.snaps.length = 0; this.offset = null; this.lastSnapT = -1; this.seen.clear(); this.maxEid = 0; }
    const newest = m.t > this.lastSnapT;
    if (newest) {
      this.lastSnap = tl; this.lastSnapT = m.t;
      const sample = m.t - tl;
      if (this.offset === null || Math.abs(sample - this.offset) > 1.5) this.offset = sample;
      else this.offset += (sample - this.offset) * (sample > this.offset ? 0.25 : 0.03);
      this.phase = m.ph; this.phaseT = m.pt; this.round = m.r; this.score = m.sc; this.doorsOpen = m.dr || []; this.cps = (m.cp || []).map(c => ({ x: c[0], y: c[1], z: c[2], r: c[3], owner: c[4], prog: c[5], name: c[6], contest: c[7] })); this.matchOver = !!m.ov; this.roundsToWin = m.rw;
      if (m.mo !== this.mode) { this.mode = m.mo; this.mini.mode = m.mo; }
      const P = new Map(); for (const a of m.p) P.set(a[0], a);
      const N = new Map(); for (const n of m.n) N.set(n[0], n);
      this.snaps.push({ t: m.t, P, N }); while (this.snaps.length > 24) this.snaps.shift();
      // اللاعبون
      for (const a of m.p) {
        const id = a[0];
        if (id === this.me) { this.reconcile(a, m.ac ? m.ac[id] : 0); continue; }
        let p = this.players.get(id);
        if (!p) { const r = this.roster.get(id); p = { id, name: r ? r.name : '…', bot: r ? r.bot : false, dmgBy: new Map(), cmd: {} }; this.players.set(id, p); this.mini.players.set(id, p); }
        const keep = p.pos && Math.hypot(p.pos[0] - a[1], p.pos[2] - a[3]) < 3 ? [p.pos, p.yaw, p.pitch, p.crouch] : null;
        decPlayer(a, p, m.t);
        if (keep) { p.pos = keep[0]; p.yaw = keep[1]; p.pitch = keep[2]; p.crouch = keep[3]; } // الاستيفاء يتكفّل بالموضع
      }
      for (const id of [...this.players.keys()]) if (id !== this.me && !P.has(id)) { this.players.delete(id); this.mini.players.delete(id); }
      this.smokes = m.sm.map(s => ({ x: s[0], y: s[1], z: s[2], r: s[3], t: s[4], life: s[5] }));
      this.fires = m.f.map(f => ({ x: f[0], y: f[1], z: f[2], r: f[3], t: f[4], life: f[5], owner: f[6] }));
    }
    // الأحداث (مكرّرة في عدة لقطات لتعويض الضياع — نأخذ كل حدث مرة واحدة)
    if (m.e) for (const [eid, e] of m.e) {
      if (eid <= this.maxEid - 400 || this.seen.has(eid)) continue;
      this.seen.set(eid, 1); if (eid > this.maxEid) this.maxEid = eid;
      if (e.id === this.me && LOCAL_EV.has(e.t)) continue; // سبق أن عرضناها محلياً
      if (e.t === 'break' || e.t === 'npcDie' || e.t === 'reset') this.worldEvent(e);
      this.events.push(e);
    }
    if (this.events.length > 160) this.events.splice(0, this.events.length - 160);
    if (this.seen.size > 600) for (const k of this.seen.keys()) { if (k < this.maxEid - 400) this.seen.delete(k); }
  }
  // تصحيح التنبؤ: نعود لحالة السيرفر ثم نعيد تطبيق أوامرنا التي لم يعالجها بعد
  reconcile(a, ack) {
    const pp = this.pp, mini = this.mini; if (!pp) return;
    const old = pp.pos.slice(), wasAlive = pp.alive;
    let i = this.hist.findIndex(h => h.seq === ack);
    const tAck = i >= 0 ? this.hist[i].t : mini.t;
    if (i >= 0) this.hist.splice(0, i + 1); else if (ack > 0) this.hist = this.hist.filter(h => h.seq > ack);
    const tSave = mini.t;
    mini.t = tAck; decPlayer(a, pp, mini.t); mini.phase = this.phase;
    for (const h of this.hist) { mini.t += STEP; pp.cmd = h.c; mini.stepPlayer(pp, STEP); h.t = mini.t; }
    mini.t = Math.max(mini.t, tSave);
    mini.events.length = 0; mini.nades.length = 0;
    const d = [old[0] - pp.pos[0], old[1] - pp.pos[1], old[2] - pp.pos[2]];
    const err = Math.hypot(d[0], d[1], d[2]); this.stat.n++; this.stat.sum += err; this.stat.max = Math.max(this.stat.max, err); if (err > 0.05) this.stat.big++;
    if (wasAlive && pp.alive && err < 2) { for (let k = 0; k < 3; k++) this.corr[k] += d[k]; }
    else this.corr = [0, 0, 0];
    this.refreshView();
  }
  // ---------- واجهة Sim التي تستعملها اللعبة ----------
  input(id, cmd) { this.cmd = { ...cmd }; }
  setLoadout(id, L) { if (this.mini) this.mini.setLoadout(this.me, L); this.opt.loadout = L; this.link && this.link.send({ k: 'lo', l: L }, true); }
  setMark(id, p) { this.link && this.link.send({ k: 'mk', p }, true); }
  setChar(id, c) { if (this.pp) this.pp.char = c; this.opt.char = c; this.link && this.link.send({ k: 'ch', c }, true); }
  curW(p) { return p.slot <= 3 ? p.inv[p.slot] : null; }
  curId(p) { return p.slot === 4 ? (p.inv[4][0] || 'frag') : (p.inv[p.slot] ? p.inv[p.slot].id : 'khanjar'); }
  eye(p) { const L = (p.lean || 0) * LEAN; return [p.pos[0] + Math.cos(p.yaw) * L, p.pos[1] + eyeHeight(p) - Math.abs(p.lean || 0) * 0.06, p.pos[2] - Math.sin(p.yaw) * L]; }
  step(dt) {
    const tl = now();
    if (this.offset !== null) this.t = tl + this.offset - INTERP;
    this.phaseT = Math.max(0, this.phaseT - dt);
    // تنبؤ محلي بحركتي وسلاحي
    if (this.pp && this.cmd && this.state === 'joined') {
      const mini = this.mini, c = { ...this.cmd, seq: ++this.seq, vt: this.t };
      mini.phase = this.phase; mini.t += dt; this.pp.cmd = c;
      mini.stepPlayer(this.pp, dt);
      this.hist.push({ seq: c.seq, c, t: mini.t }); if (this.hist.length > 150) this.hist.shift();
      for (const e of mini.events) { e.loc = 1; this.events.push(e); }
      mini.events.length = 0; mini.nades.length = 0;
      this.recent.push(encCmd(c)); if (this.recent.length > 4) this.recent.shift();
      if (++this.sendN % 2 === 0) this.link.send({ k: 'c', c: this.recent });
    }
    this.interp();
    for (const s of this.smokes) s.t += dt;
    for (const f of this.fires) f.t += dt;
    const k = Math.exp(-dt * 10); for (let i = 0; i < 3; i++) { this.corr[i] *= k; if (Math.abs(this.corr[i]) < 1e-4) this.corr[i] = 0; }
    this.refreshView();
  }
  refreshView() {
    const v = this.view, pp = this.pp; if (!v || !pp) return;
    Object.assign(v, pp);
    v.pos = [pp.pos[0] + this.corr[0], pp.pos[1] + this.corr[1], pp.pos[2] + this.corr[2]];
    const r = this.roster.get(this.me); v.name = r ? r.name : this.opt.name; v.bot = false;
  }
  // استيفاء بقية اللاعبين والقنابل عند زمن العرض
  interp() {
    const S = this.snaps; if (!S.length) return;
    const rt = this.t;
    let a = S[0], b = null;
    for (let i = S.length - 1; i >= 0; i--) if (S[i].t <= rt) { a = S[i]; b = S[i + 1] || null; break; }
    const k = b ? (rt - a.t) / Math.max(1e-4, b.t - a.t) : 0;
    const ext = b ? 0 : Math.max(0, Math.min(0.15, rt - a.t));
    for (const [id, p] of this.players) {
      if (id === this.me) continue;
      const A = a.P.get(id), B = b ? b.P.get(id) : null;
      if (!A && !B) continue;
      if (A && B && Math.hypot(A[1] - B[1], A[3] - B[3]) < 3) {
        p.pos = [A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k, A[3] + (B[3] - A[3]) * k];
        p.yaw = lerpA(A[7], B[7], k); p.pitch = A[8] + (B[8] - A[8]) * k; p.crouch = A[9] + (B[9] - A[9]) * k;
      } else {
        const X = B || A, e = B ? 0 : ext;
        p.pos = [X[1] + X[4] * e, X[2] + (X[10] & 2 ? 0 : X[5] * e), X[3] + X[6] * e]; p.yaw = X[7]; p.pitch = X[8]; p.crouch = X[9];
      }
    }
    // القنابل
    const list = [], src = b || a;
    for (const [id, n] of src.N) { const na = a.N.get(id); const x = b && na ? [na[2] + (n[2] - na[2]) * k, na[3] + (n[3] - na[3]) * k, na[4] + (n[4] - na[4]) * k] : [n[2], n[3], n[4]]; list.push({ id, kind: n[1], pos: x }); }
    this.nades = list;
  }
}
