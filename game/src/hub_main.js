// «سيرفر الرافدين» — المحرك المركزي + لوحة الإدارة
// كل معركة بعامل (Worker) مستقل، والمطابقة عبر موضوع مركزي على وسطاء MQTT، والإحصائيات محفوظة بقاعدة IndexedDB
import { Mqtt, brokerList, utf8 } from './net/mqtt.js';
import { PROTO } from './net/proto.js';
import { MODES } from './sim/weapons.js';

// ---------- مؤقّتات تشتغل والشاشة مطفأة ----------
// النظام يخنق مؤقّتات الصفحة المخفية؛ خدمة أندرويد تنادي __pump() كل 100ms فتنفّذ المتأخر وتضخّ حلقات المعارك
const T = new Map(); let tid = 1;
const nST = window.setTimeout.bind(window), nCT = window.clearTimeout.bind(window), pnow = () => performance.now();
function fire(id) {
  const o = T.get(id); if (!o) return; nCT(o.h);
  if (o.iv) { o.due = Math.max(o.due + o.iv, pnow()); o.h = nST(() => fire(id), Math.max(0, o.due - pnow())); } else T.delete(id);
  try { o.fn(...o.a); } catch (e) { console.error(e); }
}
window.setTimeout = (fn, ms = 0, ...a) => { const id = tid++, o = { fn, a, due: pnow() + ms, iv: 0 }; T.set(id, o); o.h = nST(() => fire(id), ms); return id; };
window.setInterval = (fn, ms = 0, ...a) => { ms = Math.max(1, ms); const id = tid++, o = { fn, a, due: pnow() + ms, iv: ms }; T.set(id, o); o.h = nST(() => fire(id), ms); return id; };
window.clearTimeout = window.clearInterval = id => { const o = T.get(id); if (o) { nCT(o.h); T.delete(id); } };
let pumps = 0;
window.__pump = () => { pumps++; const t = pnow(); for (const [id, o] of [...T]) if (o.due <= t) fire(id); for (const M of matches.values()) if (!M.dead) M.w.postMessage({ t: 'pump' }); };

const AND = window.RafidainServer || null;
const C = 'rafidain/v2/c/';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nowS = () => Date.now() / 1000, sleep = ms => new Promise(r => setTimeout(r, ms));
const BROKERS = brokerList();
const NO_RTC = /[?&]nortc/.test(location.search) || typeof RTCPeerConnection === 'undefined';
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const MAXP = 10, MAXT = 5;
const WURL = URL.createObjectURL(new Blob([document.getElementById('wk').textContent], { type: 'text/javascript' }));
const rand = n => { const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const fmtDur = s => { s = Math.max(0, Math.floor(s)); const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60; return d ? `${d}ي ${h}س` : h ? `${h}س ${m}د` : `${m}د ${s % 60}ث`; };
const fmtAgo = t => { const s = nowS() - t; return s < 60 ? 'الآن' : s < 3600 ? `قبل ${Math.floor(s / 60)} د` : s < 86400 ? `قبل ${Math.floor(s / 3600)} س` : `قبل ${Math.floor(s / 86400)} يوم`; };
const fmtB = b => b == null ? '—' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB';
const tstr = t => { const d = new Date(t * 1000); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// ---------- قاعدة البيانات (تبقى بعد إعادة التشغيل) ----------
const DB = {
  d: null, dirty: false, eids: new Set(), mids: new Set(), idb: null,
  fresh() { return { v: 1, players: {}, matches: [], tot: { matches: 0, sessions: 0, offMatches: 0, offSessions: 0, dup: 0, refused: 0 }, eids: [], mids: [], downs: [], hb: 0, key: null, cfg: { run: false }, cap: {}, bans: [], log: [], lastSync: 0, syncs: 0 }; },
  async open() {
    let got = null;
    try {
      this.idb = await new Promise((res, rej) => { const r = indexedDB.open('rafidain-hub', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      got = await new Promise(res => { const q = this.idb.transaction('kv').objectStore('kv').get('main'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
    } catch (e) { try { got = JSON.parse(localStorage.getItem('rafidain.hub') || 'null'); } catch (x) { } }
    const f = this.fresh(); this.d = Object.assign(f, got || {}); this.d.tot = Object.assign(f.tot, (got && got.tot) || {});
    this.eids = new Set(this.d.eids); this.mids = new Set(this.d.mids);
  },
  mark() { this.dirty = true; },
  async save() {
    if (!this.d) return; this.dirty = false;
    const d = this.d; d.eids = [...this.eids].slice(-30000); d.mids = [...this.mids].slice(-5000); d.log = d.log.slice(0, 200); d.matches = d.matches.slice(0, 300);
    try { if (this.idb) await new Promise((res, rej) => { const tx = this.idb.transaction('kv', 'readwrite'); tx.objectStore('kv').put(d, 'main'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); else localStorage.setItem('rafidain.hub', JSON.stringify(d)); }
    catch (e) { this.dirty = true; }
  },
};
let D = null;
function log(s, quiet) { const t = new Date(), line = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}  ${s}`; D.log.unshift(line); if (D.log.length > 220) D.log.length = 200; DB.mark(); if (!quiet) renderLog(); }
function player(u, n) {
  const t = nowS(); let p = D.players[u];
  if (!p) { p = D.players[u] = { n: n || 'لاعب', f: t, l: t, s: 0, m: 0, k: 0, d: 0, w: 0, lo: 0, pt: 0, off: 0, th: '' }; }
  if (n) p.n = String(n).slice(0, 16); p.l = Math.max(p.l, t); DB.mark(); return p;
}
// ضد انتحال اللاعبين: كل لاعب عنده رمز سري بجهازه، نحفظ بصمته أول مرة ونرفض أي رمز ثاني لنفس المعرّف
async function sha(s) { try { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('').slice(0, 32); } catch (e) { return 'p' + s.length + s.slice(0, 6); } }
async function tokOk(u, tk, n) {
  if (!u || !/^\d{10}$/.test(String(u)) || !tk) return false;
  const h = await sha(String(tk)), p = D.players[u];
  if (p && p.th && p.th !== h) return false;
  player(u, n).th = h; return true;
}

// ---------- التوقيع (ضد انتحال السيرفر) ----------
let signKey = null, pubXY = null, fp = '—';
async function keys() {
  const S = crypto.subtle; if (!S) return;
  try {
    if (!D.key) { const kp = await S.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); D.key = { priv: await S.exportKey('jwk', kp.privateKey), pub: await S.exportKey('jwk', kp.publicKey) }; DB.mark(); await DB.save(); }
    signKey = await S.importKey('jwk', D.key.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    pubXY = { x: D.key.pub.x, y: D.key.pub.y }; fp = (await sha(pubXY.x + pubXY.y)).slice(0, 12).replace(/(....)/g, '$1 ').trim();
  } catch (e) { signKey = null; }
}
async function sign(obj) {
  const b = JSON.stringify(obj); if (!signKey) return JSON.stringify({ b });
  const s = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, new TextEncoder().encode(b)));
  return JSON.stringify({ b, s: btoa(String.fromCharCode(...s)), k: pubXY });
}

// ---------- الشبكة المركزية ----------
const Net = {
  mqs: [], seen: new Map(), on: false, will: '',
  async start() { this.on = true; this.will = await sign({ on: 0, t: Math.floor(nowS()) }); for (const u of BROKERS) this.conn(u); },
  async conn(url, tries = 0) {
    if (!this.on || this.mqs.some(m => m.url === url)) return;
    const m = new Mqtt(url);
    try { await m.connect(8000, { will: { topic: C + 'state', payload: this.will, retain: true } }); }
    catch (e) { if (this.on) setTimeout(() => this.conn(url, tries + 1), Math.min(30000, 3000 * (tries + 1))); return; }
    if (!this.on) { m.close(); return; }
    this.mqs.push(m);
    m.onmessage = (t, p) => this.recv(t, utf8.dec(p));
    m.onclose = () => { this.mqs = this.mqs.filter(q => q !== m); if (this.on) { log('انقطع الوسيط ' + url.split('/')[2] + ' — إعادة الاتصال'); setTimeout(() => this.conn(url), 3000); } };
    for (const k of ['req', 'sync', 'live', 'mv']) m.subscribe(C + k);
    log('متصل بالوسيط ' + url.split('/')[2].split(':')[0]);
    pubState();
  },
  pub(topic, s, retain) { for (const m of this.mqs) m.publish(topic, s, retain); },
  stop() { this.on = false; for (const m of this.mqs) { m.onclose = null; m.close(); } this.mqs = []; },
  recv(topic, raw) {
    const k = topic + '|' + raw, t = nowS(); if (this.seen.has(k) && t - this.seen.get(k) < 30) return; this.seen.set(k, t);
    if (this.seen.size > 500) for (const [kk, tt] of this.seen) if (t - tt > 60) this.seen.delete(kk);
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d) return;
    if (topic === C + 'req') onReq(d); else if (topic === C + 'sync') onSync(d); else if (topic === C + 'live') onLive(d); else if (topic === C + 'mv') onMove(d);
  },
};
async function pubState(off) {
  if (!Net.mqs.length) return;
  const cap = capNow || {};
  Net.pub(C + 'state', await sign(off ? { on: 0, t: Math.floor(nowS()) } : { on: 1, t: Math.floor(nowS()), m: liveMatches().length, p: stats.players, cap: cap.safe || 0 }), true);
}

// ---------- المعارك ----------
const matches = new Map(); // room → M
let running = false, stopping = false, startedAt = 0, stressing = false;
const liveMatches = () => [...matches.values()].filter(M => !M.bench && !M.dead);
function createMatch(mo, bench) {
  const room = (bench ? 'b' : 'c') + rand(6), w = new Worker(WURL);
  const M = { room, mo, w, bench: !!bench, st: nowS(), I: null, at: 0, pend: new Map(), dead: false, pcs: new Map(), ended: new Map(), up: false, errs: 0 };
  w.onmessage = e => { try { onWorker(M, e.data); } catch (x) { console.error(x); } };
  w.onerror = e => { M.errs++; if (M.errs < 4) log(`خطأ داخل المعركة ${room}: ${e.message || e}`); if (e.preventDefault) e.preventDefault(); };
  w.postMessage({ t: 'start', room, bench: !!bench, brokers: BROKERS, rtc: !NO_RTC && !bench, cfg: { mode: mo, size: MAXT, rounds: 5, time: 600, roundTime: 120, difficulty: 'normal', fill: true } });
  matches.set(room, M);
  if (!bench) log(`معركة جديدة ${room} · ${MODES[mo] ? MODES[mo].name : mo}`);
  return M;
}
function killMatch(M, why) {
  if (M.dead) return; M.dead = true;
  try { M.w.terminate(); } catch (e) { }
  for (const x of M.pcs.values()) try { x.pc.close(); } catch (e) { }
  matches.delete(M.room);
  if (why) log(why);
}
function stopMatch(M) { if (M.dead) return; try { M.w.postMessage({ t: 'stop' }); } catch (e) { } setTimeout(() => killMatch(M), 2500); }
const humansOf = M => M.I ? M.I.hum.length : 0;
const pendOf = M => { const t = nowS(); let n = 0; for (const [u, at] of M.pend) { if (t - at > 25 || (M.I && M.I.hum.some(h => h.u === u))) M.pend.delete(u); else n++; } return n; };
function onWorker(M, m) {
  switch (m.t) {
    case 'up': M.up = true; break;
    case 'info': M.I = m.I; M.at = nowS(); break;
    case 'log': if (!M.bench && /انتهت|نقل/.test(m.s)) log(M.room + ': ' + m.s, true); break;
    case 'fail': log(`فشل بالمعركة ${M.room}: ${m.s}`); if (!M.up) killMatch(M); break;
    case 'stopped': M.dead = true; break;
    case 'join': { const d = m.d; M.pend.delete(d.u); tokOk(d.u, d.tk, d.n).then(ok => { if (!ok) { M.w.postMessage({ t: 'kick', u: d.u, msg: 'هوية غير صحيحة' }); return; } if (D.bans.includes(d.u)) { M.w.postMessage({ t: 'kick', u: d.u, msg: 'محظور من السيرفر' }); return; } const p = player(d.u, d.n); p.s++; D.tot.sessions++; log(`دخل ${p.n} ← ${M.room}`, true); }); break; }
    case 'leave': { const d = m.d, p = D.players[d.u]; if (!p || !p.th) break; p.pt += d.dur || 0; if (!(M.I && M.ended.get(d.u) === M.I.mid)) { p.k += d.k || 0; p.d += d.d || 0; } p.l = nowS(); DB.mark(); break; }
    case 'end': {
      const d = m.d; if (DB.mids.has(d.mid)) break; DB.mids.add(d.mid);
      D.tot.matches++; D.matches.unshift({ mid: d.mid, room: M.room, mo: d.mode, src: 'c', st: M.mst || M.st, en: nowS(), sc: d.score, n: d.res.length });
      for (const r of d.res) { const p = D.players[r.u]; if (!p || !p.th) continue; p.m++; p.k += r.k; p.d += r.d; if (r.win > 0) p.w++; else if (r.win < 0) p.lo++; M.ended.set(r.u, d.mid); }
      M.mst = nowS(); DB.mark(); break;
    }
    case 'rtc': rtcOffer(M, m.from, m.sdp); break;
    case 'dc': for (const cid of m.to) { const x = M.pcs.get(cid); if (x && x.dc && x.dc.readyState === 'open') try { x.dc.send(m.s); } catch (e) { } } break;
    case 'dcDrop': { const x = M.pcs.get(m.cid); if (x) { try { x.pc.close(); } catch (e) { } M.pcs.delete(m.cid); } break; }
  }
}
// القنوات المباشرة (WebRTC) تُفتح هنا وتُمرَّر رسائلها للعامل
function waitIce(pc, ms = 2500) { return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, ms); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); }
async function rtcOffer(M, from, sdp) {
  try {
    const old = M.pcs.get(from); if (old) try { old.pc.close(); } catch (e) { }
    const pc = new RTCPeerConnection({ iceServers: ICE }), x = { pc, dc: null }; M.pcs.set(from, x);
    pc.ondatachannel = ev => {
      const dc = ev.channel;
      dc.onopen = () => { x.dc = dc; M.w.postMessage({ t: 'rtcEv', e: 'open', from }); };
      dc.onclose = () => { if (x.dc === dc) { x.dc = null; if (!M.dead) M.w.postMessage({ t: 'rtcEv', e: 'close', from }); } };
      dc.onmessage = e => { if (!M.dead) M.w.postMessage({ t: 'rtcEv', e: 'msg', from, x: e.data }); };
    };
    await pc.setRemoteDescription({ type: 'offer', sdp }); await pc.setLocalDescription(await pc.createAnswer()); await waitIce(pc);
    if (!M.dead) M.w.postMessage({ t: 'rtcEv', e: 'ans', from, x: pc.localDescription.sdp });
  } catch (e) { }
}

// ---------- المطابقة ----------
async function onReq(d) {
  if (!running || stopping || !d.from || !d.re) return;
  const reply = async b => Net.pub(C + 'to/' + d.from, await sign({ re: d.re, ...b }));
  if (d.v !== PROTO) return reply({ k: 'full', why: 'نسخة اللعبة تختلف عن السيرفر' });
  if (D.bans.includes(d.u)) return reply({ k: 'full', why: 'محظور من السيرفر' });
  if (!(await tokOk(d.u, d.tk, d.n))) return reply({ k: 'full', why: 'هوية غير صحيحة' });
  const mo = MODES[d.mo] ? d.mo : 'tdm';
  // 1) معركة على السيرفر بيها لاعبين حقيقيين ومكان فاضي
  let M = null, best = -1;
  for (const X of liveMatches()) { if (X.mo !== mo || (X.I && X.I.phase === 'over')) continue; const n = humansOf(X) + pendOf(X); if (n < MAXP && n > best) { best = n; M = X; } }
  if (M) { M.pend.set(d.u, nowS()); return reply({ k: 'mm', room: M.room, mo }); }
  // 2) لاعب وحيد يلعب ويّا البوتات على هاتفه: صار عندنا لاعبين حقيقيين ← ننقل معركته للسيرفر ونجمعهم
  const t = nowS(); let P = null;
  for (const p of phones.values()) if (p.w && p.mo === mo && p.hid && p.hid !== d.from && t - p.at < 40 && !p.moved) { P = p; break; }
  if (P) {
    const why = admit();
    if (why) { D.tot.refused++; log(`السيرفر ممتلئ (${why}) — انضمّ اللاعب إلى معركة على هاتف لاعب`, true); P.w = 0; return reply({ k: 'mm', room: P.room, mo, phone: 1 }); }
    P.moved = true; M = createMatch(mo); M.from = P.room; M.pend.set(d.u, t);
    Net.pub(C + 'to/' + P.hid, await sign({ k: 'move', room: M.room, src: P.room }));
    log(`دخل لاعب ثانٍ — معركة ${P.room} تنتقل من الهاتف إلى السيرفر (${M.room})`);
    return reply({ k: 'mm', room: M.room, mo });
  }
  // 3) ما في أحد: اللاعب يبدأ على هاتفه ويّا البوتات (السيرفر يشغّل بس معارك بيها أكثر من لاعب حقيقي)
  reply({ k: 'host' });
}
// هل نتحمّل معركة جديدة؟ (السبب يرجع للاعب)
function admit() {
  const c = capNow || {}, n = liveMatches().length, s = stats.sys || {};
  if (stressing) return 'اختبار تحمّل جارٍ على السيرفر';
  if (c.safe && n >= c.safe) return `وصل السيرفر إلى حدّه الآمن (${c.safe} معارك)`;
  if (stats.cpu > 85) return 'المعالج مشغول';
  if (s.memAvail && s.memTotal && s.memAvail < s.memTotal * 0.12) return 'ذاكرة الهاتف قليلة';
  if (s.thermal >= 3) return 'الهاتف حار جداً';
  if (s.batt != null && s.batt < 8 && !s.charging) return 'بطارية السيرفر ضعيفة';
  return '';
}

// ---------- مزامنة ما جرى بغياب السيرفر ----------
async function onSync(d) {
  if (!running || !d.from || !d.re || !Array.isArray(d.ev)) return;
  if (!(await tokOk(d.u, d.tk))) return;
  const ids = [];
  for (const e of d.ev.slice(0, 60)) {
    if (!e || typeof e.id !== 'string' || !e.id.startsWith(d.u + '-')) continue; // كل لاعب يبلّغ عن جلساته فقط
    ids.push(e.id);
    if (DB.eids.has(e.id)) { D.tot.dup++; continue; }
    DB.eids.add(e.id);
    if (e.ty === 'ses') {
      const p = player(d.u, e.n); if (e.on) { p.s++; D.tot.sessions++; } else p.off++; p.pt += Math.min(+e.du || 0, 6 * 3600); p.k += +e.k || 0; p.d += +e.d || 0; if (e.win > 0) p.w++; else if (e.win < 0) p.lo++;
      p.l = Math.max(p.l, (+e.t || 0) / 1000 + (+e.du || 0));
      if (!e.on) D.tot.offSessions++;
      const mid = e.mid || e.room; if (mid && !DB.mids.has('o' + mid)) { DB.mids.add('o' + mid); if (e.on) D.tot.matches++; else D.tot.offMatches++; D.matches.unshift({ mid, room: e.room, mo: e.mo, src: 'p', st: (+e.t || 0) / 1000, en: (+e.t || 0) / 1000 + (+e.du || 0), sc: null, n: e.hum || 0 }); }
    }
  }
  D.lastSync = nowS(); D.syncs++; DB.mark();
  if (ids.length) log(`مزامنة من ${(D.players[d.u] || {}).n || d.u}: ${ids.length} حدث`, true);
  Net.pub(C + 'to/' + d.from, await sign({ re: d.re, k: 'ack', ids }));
}
// المضيف يرسل حالة معركته المنقولة للسيرفر
async function onMove(d) {
  if (!running || !d.room || !d.R || !(await tokOk(d.u, d.tk))) return;
  const M = matches.get(d.room); if (!M || M.from !== d.src || M.dead) return;
  M.w.postMessage({ t: 'resume', R: d.R }); log(`استلمنا حالة المعركة ${d.src} ← ${d.room}`, true);
}
// معارك شغّالة على هواتف اللاعبين (وضع المضيف) تبلّغ عن نفسها
const phones = new Map();
function onLive(d) { if (!d.room || typeof d.room !== 'string') return; const o = phones.get(d.room); phones.set(d.room, { ...d, at: nowS(), moved: o && o.moved }); }

// ---------- القياسات ----------
const stats = { players: 0, bots: 0, cpu: 0, app: 0, sys: null, lat: 0, up: null, dn: null };
let prevSys = null, capNow = null;
function readSys() {
  let s = null; if (AND && AND.sys) try { s = JSON.parse(AND.sys()); } catch (e) { }
  if (!s) s = { cores: navigator.hardwareConcurrency || 4 };
  s.cores = s.cores || navigator.hardwareConcurrency || 4; s.at = pnow();
  return s;
}
function sample() {
  const s = readSys(), L = [...matches.values()].filter(M => !M.dead && M.I);
  let busy = 0, pl = 0, bots = 0, rs = 0, rn = 0;
  for (const M of L) { busy += M.I.busy || 0; if (M.bench) continue; pl += M.I.hum.length; bots += M.I.bots; for (const h of M.I.hum) if (h.rtt) { rs += h.rtt; rn++; } }
  stats.players = pl; stats.bots = bots; stats.lat = rn ? Math.round(rs / rn) : 0;
  stats.cpu = busy / (s.cores * 10) * 1.15; // +15% للشبكة والترميز خارج حلقة المحاكاة
  if (prevSys && s.cpuMs != null && prevSys.cpuMs != null) { const dt = (s.at - prevSys.at) / 1000; stats.app = dt > 0 ? (s.cpuMs - prevSys.cpuMs) / (dt * 10 * s.cores) : 0; if (s.rx != null) { stats.dn = (s.rx - prevSys.rx) / dt; stats.up = (s.tx - prevSys.tx) / dt; } }
  prevSys = s; stats.sys = s;
  for (const [r, p] of phones) if (nowS() - p.at > 45) phones.delete(r);
  capNow = capacity(s);
}
function capacity(s) {
  const L = liveMatches().filter(M => M.I && M.I.tick > 0 && M.I.busy > 0);
  const c = D.cap;
  if (L.length) { const avg = L.reduce((a, M) => a + M.I.busy, 0) / L.length; c.per = c.per ? c.per * 0.95 + avg * 0.05 : avg; }
  const per = (c.per || 8) * 1.15, mb = c.mb || 45, cores = s.cores || 4;
  const cpuT = Math.floor(cores * 1000 / per), cpuS = Math.floor(cores * 1000 * 0.55 / per);
  let memT = Infinity, memS = Infinity;
  if (s.memAvail && s.memTotal) { const n = liveMatches().length; memT = Math.floor(s.memAvail / 1048576 / mb) + n; memS = Math.max(0, Math.floor((s.memAvail - s.memTotal * 0.2) / 1048576 / mb)) + n; }
  const theory = Math.max(1, Math.min(cpuT, memT)), safe = Math.max(1, Math.min(cpuS, memS, theory));
  return { per: c.per || 0, mb, theory, safe, est: !c.stress, cpuLimited: cpuS <= memS };
}
// اختبار التحمّل الحقيقي: نزيد معارك البوتات تدريجياً لحد ما يبين التعب (تأخر المحاكاة أو الذاكرة أو الحرارة)
async function stress() {
  if (stressing) return; stressing = true; render();
  const msg = t => { $('#stressMsg').textContent = t; };
  const s0 = readSys(), B = [], steps = []; let best = 0, per = 0, mb = 0;
  try {
    const lim = +(new URLSearchParams(location.search).get('maxStress') || 64);
    for (const n of [1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64].filter(x => x <= lim)) {
      while (B.length < n) B.push(createMatch('tdm', true));
      msg(`نجرّب ${n} معارك بوتات (${n * 10} لاعب)…`);
      await sleep(7000);
      const I = B.map(M => M.I).filter(Boolean), s = readSys();
      if (I.length < n) { steps.push({ n, ok: false }); break; }
      const minTick = Math.min(...I.map(x => x.tick)), busy = I.reduce((a, x) => a + x.busy, 0);
      const used = s0.memAvail && s.memAvail ? s0.memAvail - s.memAvail : 0;
      const ok = minTick >= 55 && !(s.memAvail && s.memTotal && s.memAvail < s.memTotal * 0.15) && !(s.thermal >= 3);
      steps.push({ n, minTick, busy: Math.round(busy), mem: Math.round(used / 1048576) });
      if (!ok) break;
      best = n; per = busy / n; if (used > 0) mb = used / 1048576 / n;
    }
  } finally {
    for (const M of B) killMatch(M);
    D.cap.stress = { best, at: nowS(), steps };
    if (per) D.cap.per = per; if (mb > 8) D.cap.mb = Math.round(mb);
    DB.mark(); stressing = false;
    log(`اختبار التحمّل: تحمّل ${best} معارك بوتات (${best * 10} لاعب) بلا تأخير · كلفة المعركة ${per.toFixed(1)}ms/ث`);
    msg(`النتيجة: ${best} معارك (${best * 10} لاعب) بثبات — ${steps.map(x => x.n + (x.minTick ? '→' + x.minTick + 'Hz' : '')).join(' · ')}`);
    render();
  }
}
// قياس سريع أول مرة (معركة بوتات وحدة 5 ثوانٍ) حتى يكون التقدير مبني على هذا الهاتف
async function quickBench() {
  if (D.cap.per) return;
  const M = createMatch('tdm', true); await sleep(5500);
  if (M.I && M.I.busy > 0) { D.cap.per = M.I.busy; DB.mark(); }
  killMatch(M);
}

// ---------- التشغيل والإيقاف ----------
async function startServer() {
  if (running) return;
  running = true; stopping = false; startedAt = nowS(); D.cfg.run = true;
  if (D.hb && nowS() - D.hb > 90) { D.downs.unshift({ from: D.hb, to: nowS() }); D.downs.length = Math.min(D.downs.length, 30); }
  D.hb = nowS(); DB.mark(); await DB.save();
  if (AND) try { AND.setRunning(true); } catch (e) { }
  log('تشغيل السيرفر المركزي');
  await Net.start(); render();
}
// إيقاف تدريجي: نعلن الغياب، ونسكّر كل معركة برسالة «باي» فيتحوّل اللاعبين لوضع المضيف بنفس حالة المعركة
async function stopServer() {
  if (!running || stopping) return;
  stopping = true; render();
  log('إيقاف تدريجي — تنتقل المعارك إلى هواتف اللاعبين بحالتها نفسها');
  await pubState(true);
  for (const M of liveMatches()) stopMatch(M);
  await sleep(2600);
  for (const M of [...matches.values()]) killMatch(M);
  Net.stop(); running = false; stopping = false; D.cfg.run = false; D.hb = nowS(); DB.mark(); await DB.save();
  if (AND) try { AND.setRunning(false); } catch (e) { }
  log('السيرفر متوقف'); render();
}

// ---------- الواجهة ----------
let openRoom = null, pSort = 'l', lastLog = 0;
const MN = k => MODES[k] ? MODES[k].name : k || '—';
const PH = { wait: 'انتظار', buy: 'تجهيز', live: 'قتال', end: 'نهاية جولة', over: 'انتهت' };
function bar(id, pct, txt) { const el = $(id); el.style.width = Math.max(0, Math.min(100, pct)) + '%'; el.className = pct > 80 ? 'hi' : pct > 55 ? 'mid' : ''; }
function render() {
  if (!D) return;
  const s = stats.sys || {}, c = capNow || {}, L = liveMatches(), net = Net.mqs.length;
  const st = $('#stat'), dot = $('#dot'), pw = $('#power');
  if (stopping) { st.textContent = 'جارٍ الإيقاف…'; dot.className = 'dot warn'; }
  else if (running) { st.textContent = net ? 'السيرفر يعمل' : 'يعمل — بلا إنترنت'; dot.className = 'dot ' + (net ? 'ok' : 'warn'); }
  else { st.textContent = 'متوقف'; dot.className = 'dot'; }
  $('#sub').textContent = running ? (net ? `يستقبل اللاعبين · ${L.length} معركة · ${stats.players} لاعب` : 'ننتظر الإنترنت…') + (AND ? ' · يبقى يعمل والشاشة مطفأة' : '') : 'في غيابه: تعمل اللعبة بنظام المضيف ونقل السلطة، وتُرسِل إحصاءاتها عندما يعود';
  pw.textContent = running ? 'إيقاف السيرفر' : 'تشغيل السيرفر'; pw.className = running ? 'stop' : 'primary'; pw.disabled = stopping || stressing;
  $('#upt').textContent = running ? 'مدة التشغيل ' + fmtDur(nowS() - startedAt) : '—';
  $('#sPl').textContent = stats.players; $('#sMa').textContent = L.length; $('#sBo').textContent = stats.bots;
  $('#sFree').textContent = running ? Math.max(0, (c.safe || 0) - L.length) : 0;
  $('#sNet').textContent = net ? `${net}/${BROKERS.length} ✓` : running ? '✗' : '—';
  $('#sLat').textContent = stats.lat ? stats.lat + 'ms' : '—';
  let ph = 0, php = 0; for (const p of phones.values()) { ph++; php += p.h || 0; } $('#sPh').textContent = ph ? `${ph} (${php})` : '0';
  $('#sTot').textContent = Object.keys(D.players).length;
  // الاستهلاك
  $('#dev').textContent = s.model ? s.model + (s.sdk ? ' · أندرويد ' + s.sdk : '') : 'المتصفح';
  bar('#bCpu', stats.cpu); $('#vCpu').textContent = stats.cpu.toFixed(1) + '%';
  bar('#bApp', stats.app || 0); $('#vApp').textContent = s.cpuMs != null ? (stats.app || 0).toFixed(1) + '%' : '—';
  if (s.memTotal) { const used = s.memTotal - s.memAvail; bar('#bRam', used / s.memTotal * 100); $('#vRam').textContent = `${(used / 1073741824).toFixed(1)}/${(s.memTotal / 1073741824).toFixed(1)} GB`; } else $('#vRam').textContent = '—';
  if (s.batt != null) { bar('#bBat', 100 - s.batt); $('#bBat').style.width = s.batt + '%'; $('#bBat').className = s.batt < 20 ? 'hi' : s.batt < 40 ? 'mid' : ''; $('#vBat').textContent = s.batt + '%' + (s.charging ? ' ⚡' : ''); } else $('#vBat').textContent = '—';
  $('#kUp').textContent = stats.up != null ? fmtB(stats.up) + '/ث' : '—'; $('#kDn').textContent = stats.dn != null ? fmtB(stats.dn) + '/ث' : '—';
  $('#kTmp').textContent = s.temp != null ? s.temp.toFixed(1) + '°' : '—';
  $('#kHeap').textContent = performance.memory ? fmtB(performance.memory.usedJSHeapSize) : '—';
  $('#kCores').textContent = s.cores || '—';
  $('#kTh').textContent = s.thermal == null ? '—' : ['طبيعية', 'خفيفة', 'متوسطة', 'شديدة', 'حرجة', 'طارئة', 'إطفاء'][s.thermal] || s.thermal;
  // القدرة
  $('#cSafe').textContent = c.safe ?? '—'; $('#cSafeP').textContent = c.safe ? c.safe * 10 : '—';
  $('#cTh').textContent = c.theory ?? '—'; $('#cThP').textContent = c.theory ? c.theory * 10 : '—';
  $('#cPer').textContent = c.per ? c.per.toFixed(1) + 'ms/ث' : '—'; $('#cMb').textContent = (D.cap.mb ? '' : '~') + (c.mb || 45) + ' MB';
  $('#capSrc').textContent = D.cap.stress ? 'من اختبار التحمّل' + (c.cpuLimited ? ' · المعالج هو الحد' : ' · الذاكرة هي الحد') : D.cap.per ? 'من قياس سريع — شغّل اختبار التحمّل لرقم أدقّ' : 'تقديري';
  $('#cAt').textContent = D.cap.stress ? `${tstr(D.cap.stress.at)} · ${D.cap.stress.best} معارك` : 'لا يوجد';
  $('#stress').disabled = stressing || stopping;
  // المعارك
  const rows = [];
  for (const M of L) {
    const I = M.I || { hum: [], bots: 0, score: [0, 0], phase: 'wait', busy: 0, tick: 0 };
    rows.push(`<tr class="click" data-r="${M.room}"><td class="mono">${M.room}</td><td>${esc(MN(M.mo))}</td><td><b>${I.hum.length}</b> + ${I.bots} بوت</td><td>${I.score[0]} : ${I.score[1]}</td><td class="hidem">${PH[I.phase] || I.phase}</td><td>${(I.busy || 0).toFixed(1)}ms</td><td class="hidem">${I.tick || 0}Hz</td></tr>`);
    if (openRoom === M.room) rows.push(`<tr class="det"><td colspan="7">${I.hum.length ? I.hum.map(h => `<div class="row" style="justify-content:space-between;margin:3px 0"><span><i class="tm t${h.tm}"></i>${esc(h.n)} <span class="v ${h.via === 'p2p' ? 'p2p' : ''}">${h.via === 'p2p' ? 'مباشر' : 'وسيط'}</span> · ${h.k}/${h.d} · ${h.rtt ? h.rtt + 'ms' : '…'}</span><span><button class="sm" data-kick="${M.room}|${h.u}">طرد</button> <button class="sm" data-ban="${h.u}">حظر</button></span></div>`).join('') : '<span class="note">لا لاعبين بعد</span>'}</td></tr>`);
  }
  $('#mList').innerHTML = rows.join('') || `<tr><td colspan="7" class="empty">${running ? 'لا معارك — تُفتَح تلقائياً عندما يضغط اللاعب «أونلاين»' : 'السيرفر متوقف'}</td></tr>`;
  // غياب السيرفر
  const offP = Object.values(D.players).filter(p => p.off > 0).length;
  $('#oPl').textContent = offP; $('#oSe').textContent = D.tot.offSessions; $('#oMa').textContent = D.tot.offMatches; $('#oDup').textContent = D.tot.dup;
  $('#offSync').textContent = D.lastSync ? 'آخر مزامنة ' + fmtAgo(D.lastSync) : 'لم تصل مزامنة بعد';
  $('#offDown').textContent = D.downs.length ? 'فترات الغياب: ' + D.downs.slice(0, 3).map(x => `${tstr(x.from)} ← ${tstr(x.to)}`).join(' · ') : 'تسجّل اللعبة كل معركة تجري على هواتف اللاعبين بمعرّف فريد وترسلها عندما يعود السيرفر — المكرّر يُحسَب مرّة واحدة.';
  renderPlayers(); $('#fp').textContent = fp;
}
function renderPlayers() {
  const q = $('#pSearch').value.trim(), on = new Set(); for (const M of liveMatches()) if (M.I) for (const h of M.I.hum) on.add(h.u);
  let L = Object.entries(D.players); const total = L.length;
  if (q) L = L.filter(([u, p]) => u.includes(q.replace(/\s/g, '')) || p.n.includes(q));
  L.sort((a, b) => (on.has(b[0]) - on.has(a[0])) || (b[1][pSort] || 0) - (a[1][pSort] || 0));
  $('#pCount').textContent = `${total} لاعب · ${on.size} متصل`;
  $('#pList').innerHTML = L.slice(0, 60).map(([u, p]) => `<tr><td>${on.has(u) ? '<b class="on">●</b> ' : ''}${esc(p.n)}${D.bans.includes(u) ? ' <em>محظور</em>' : ''}</td><td class="hidem mono">${u.slice(0, 4)} ${u.slice(4, 8)} ${u.slice(8)}</td><td>${p.s + p.off}${p.off ? ` <em>${p.off} في غيابه</em>` : ''}</td><td>${p.m}${p.w ? ` <em>${p.w} فوز</em>` : ''}</td><td>${p.k}/${p.d}</td><td class="hidem">${fmtDur(p.pt)}</td><td>${fmtAgo(p.l)}</td><td>${D.bans.includes(u) ? `<button class="sm" data-unban="${u}">فك</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">لا لاعبين مسجّلين بعد</td></tr>';
}
function renderLog() { const el = $('#log'); if (el && D) el.innerHTML = D.log.slice(0, 80).map(l => `<div>${esc(l)}</div>`).join(''); }

$('#power').onclick = () => running ? stopServer() : startServer();
$('#stress').onclick = () => stress();
$('#pSearch').oninput = () => renderPlayers();
$('#pSort').onclick = e => { const b = e.target.closest('button'); if (!b) return; pSort = b.dataset.s; for (const x of $('#pSort').children) x.classList.toggle('sel', x === b); renderPlayers(); };
document.body.addEventListener('click', e => {
  const r = e.target.closest('tr.click'); if (r) { openRoom = openRoom === r.dataset.r ? null : r.dataset.r; render(); return; }
  const k = e.target.closest('[data-kick]'); if (k) { const [room, u] = k.dataset.kick.split('|'), M = matches.get(room); if (M) M.w.postMessage({ t: 'kick', u }); log('طرد لاعب من ' + room); return; }
  const b = e.target.closest('[data-ban]'); if (b) { const u = b.dataset.ban; if (!D.bans.includes(u)) D.bans.push(u); for (const M of liveMatches()) M.w.postMessage({ t: 'kick', u, msg: 'محظور من السيرفر' }); log('حظر ' + ((D.players[u] || {}).n || u)); DB.mark(); render(); return; }
  const ub = e.target.closest('[data-unban]'); if (ub) { D.bans = D.bans.filter(x => x !== ub.dataset.unban); DB.mark(); render(); }
});
$('#backup').onclick = async () => { await DB.save(); const s = JSON.stringify(D); let where = ''; try { where = AND && AND.saveBackup ? AND.saveBackup(s) : (localStorage.setItem('rafidain.hub.bak', s), 'ذاكرة المتصفح'); } catch (e) { where = ''; } log(where ? 'نسخة احتياطية: ' + where : 'تعذّرت النسخة الاحتياطية'); };
$('#restore').onclick = async () => {
  const b = $('#restore'); if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'تأكيد الاستعادة؟'; setTimeout(() => { delete b.dataset.arm; b.textContent = 'استعادة'; }, 3000); return; }
  let s = null; try { s = AND && AND.loadBackup ? AND.loadBackup() : localStorage.getItem('rafidain.hub.bak'); } catch (e) { }
  if (!s) { log('لم نجد نسخة احتياطية'); return; }
  try { const d = JSON.parse(s); const run = D.cfg.run; DB.d = D = Object.assign(DB.fresh(), d); D.cfg.run = run; DB.eids = new Set(D.eids); DB.mids = new Set(D.mids); await keys(); DB.mark(); await DB.save(); log('تمّت الاستعادة'); render(); } catch (e) { log('النسخة الاحتياطية تالفة'); }
};
function battery() { const el = $('#batt'); if (!AND || !AND.batteryFree) return; let free = true; try { free = AND.batteryFree(); } catch (e) { } el.classList.toggle('hide', free); }
$('#battBtn').onclick = () => { try { AND.askBattery(); } catch (e) { } setTimeout(battery, 4000); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) { battery(); render(); } });

// ---------- الحلقة العامة ----------
let tick = 0, lastNotif = '';
function housekeep() {
  tick++;
  sample();
  const t = nowS();
  // مراقبة المعارك: معركة متوقفة (ما تبلّغ 12 ثانية) تُنهى — لاعبيها ينتقلون لوضع المضيف بنفس الحالة. وفارغة دقيقة ونص تُغلق لتوفير الموارد
  for (const M of [...matches.values()]) {
    if (M.dead || M.bench) continue;
    if (M.up && M.at && t - M.at > 12) { killMatch(M, `المعركة ${M.room} توقّفت عن الاستجابة — أُنهِيَت وانتقل لاعبوها إلى وضع المضيف`); continue; }
    if (!M.up && t - M.st > 25) { killMatch(M, `المعركة ${M.room} لم تعمل — أُلغِيَت`); continue; }
    if (M.I && !M.I.hum.length && !pendOf(M) && t - M.st > 90 && (!M.lastHum || t - M.lastHum > 60)) { stopMatch(M); continue; }
    if (M.I && M.I.hum.length) M.lastHum = t;
  }
  if (running) {
    if (tick % 10 === 0) pubState();
    if (tick % 30 === 0) { D.hb = t; DB.mark(); }
    const note = `${liveMatches().length} معركة · ${stats.players} لاعب · ${Net.mqs.length ? 'متصل' : 'بلا إنترنت'}`;
    if (AND && AND.status && note !== lastNotif && tick % 5 === 0) { lastNotif = note; try { AND.status(note); } catch (e) { } }
  }
  if (DB.dirty && tick % 5 === 0) DB.save();
  if (!document.hidden) render();
}

(async function boot() {
  await DB.open(); D = DB.d;
  await keys();
  battery(); renderLog(); sample(); render();
  setInterval(housekeep, 1000);
  if (D.cfg.run) { log('رجوع تلقائي بعد إعادة التشغيل'); await startServer(); }
  setTimeout(quickBench, running ? 4000 : 800);
  window.__hub = { matches, stats, D: () => D, start: startServer, stop: stopServer, stress, cap: () => capNow, phones, pumps: () => pumps };
})();
