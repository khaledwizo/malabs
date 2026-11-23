// طبقة الاتصال: ترحيل عبر وسيط MQTT عام (يعمل خلف أي شبكة) + ترقية تلقائية إلى اتصال مباشر WebRTC عند الإمكان
import { connectAny, brokerList, Mqtt, utf8 } from './mqtt.js';
import { Lan } from './lan.js';

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const NS = 'rafidain/v2/';
const NO_RTC = (() => { try { return /[?&]nortc/.test(location.search); } catch (e) { return false; } })();
export const newId = () => Math.random().toString(36).slice(2, 10);
export function roomCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }

function waitIce(pc, ms = 2500) {
  return new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, ms); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
}

// ---------- جهة السيرفر ----------
// السيرفر يتصل بكل الوسطاء معاً: أي لاعب يصل عبر أي وسيط متاح عنده، ونردّ عليه من الوسيط نفسه
export class HostLink {
  constructor(room, opt = {}) { this.room = room; this.mqs = []; this.peers = new Map(); this.onmsg = null; this.onstatus = opt.onStatus || (() => { }); this.useRtc = opt.rtc !== false && !NO_RTC && typeof RTCPeerConnection !== 'undefined'; this.urls = opt.brokers || brokerList(); this.closed = false; }
  async open() {
    this.onstatus('الاتصال بالوسطاء…');
    this.openLan();
    const res = await Promise.allSettled(this.urls.map(u => this.connectOne(u)));
    if (!res.some(r => r.status === 'fulfilled') && !this.lanIp) throw new Error('لا يوجد اتصال بالإنترنت أو الوسطاء محجوبة');
    this.report();
    return this;
  }
  // نفس الشبكة (واي فاي أو نقطة اتصال) بلا إنترنت: سيرفر WebSocket داخل التطبيق + إعلان للأجهزة القريبة
  openLan() {
    if (!Lan.ok) return;
    this.lanIp = Lan.host(this.room, this.lanName || 'سيرفر الرافدين', this.lanInfo || {});
    if (!this.lanIp) return;
    const byConn = new Map();
    window.__lan = {
      open: () => { },
      msg: (id, t) => { let x; try { x = JSON.parse(t); } catch (e) { return; } if (!x || !x.from) return; byConn.set(id, x.from); const p = this.peers.get(x.from) || { dc: null, via: 'lan', mq: null }; p.lan = id; p.via = 'lan'; this.peers.set(x.from, p); this.handle(x.from, x, 'lan'); },
      close: id => { const cid = byConn.get(id); byConn.delete(id); if (cid && this.peers.get(cid) && this.peers.get(cid).lan === id && this.onmsg) this.onmsg(cid, { k: 'bye', from: cid }, 'lan'); },
    };
  }
  async connectOne(url) {
    const m = new Mqtt(url); await m.connect();
    if (this.closed) { m.close(); return; }
    m.subscribe(NS + this.room + '/up');
    m.onmessage = (topic, payload) => { let x; try { x = JSON.parse(utf8.dec(payload)); } catch (e) { return; } if (!x || !x.from) return; this.handle(x.from, x, 'mqtt', m); };
    m.onclose = () => { this.mqs = this.mqs.filter(q => q !== m); this.report(); if (!this.closed) setTimeout(() => this.retry(url), 2000); };
    this.mqs.push(m);
    return m;
  }
  async retry(url) { if (this.closed) return; try { await this.connectOne(url); this.report(); } catch (e) { setTimeout(() => this.retry(url), 5000); } }
  report() { const n = this.mqs.length, lan = this.lanIp ? ` · على الشبكة المحلية ${this.lanIp}` : ''; this.onstatus(n ? `متصل بالإنترنت عبر ${n} ${n > 1 ? 'وسطاء' : 'وسيط'}${lan} · بانتظار اللاعبين` : this.lanIp ? `بلا إنترنت — يعمل على الشبكة المحلية ${this.lanIp} · بانتظار اللاعبين` : 'انقطع الإنترنت — إعادة المحاولة…'); }
  // لاعب على نفس الهاتف (المضيف): الرسائل تمرّ مباشرة بلا إنترنت
  addLocal(cid, fn) { this.peers.set(cid, { local: fn, via: 'local' }); }
  handle(from, m, via, mq) {
    const p = this.peers.get(from) || { dc: null, via: 'relay', mq: null }; this.peers.set(from, p);
    if (mq) p.mq = mq;
    if (m.k === 'rtc-offer') { if (this.useRtc) this.acceptRtc(from, m.sdp); return; }
    if (this.onmsg) this.onmsg(from, m, via);
  }
  async acceptRtc(from, sdp) {
    try {
      const p = this.peers.get(from); if (p.pc) p.pc.close();
      const pc = new RTCPeerConnection({ iceServers: ICE }); p.pc = pc;
      pc.ondatachannel = ev => { const dc = ev.channel; dc.onopen = () => { p.dc = dc; p.via = 'p2p'; }; dc.onclose = () => { if (p.dc === dc) { p.dc = null; p.via = 'relay'; } }; dc.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.handle(from, m, 'p2p'); }; };
      await pc.setRemoteDescription({ type: 'offer', sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce(pc);
      this.sendTo(from, { k: 'rtc-answer', sdp: pc.localDescription.sdp }, true);
    } catch (e) { }
  }
  mqFor(p) { return p && p.mq && this.mqs.includes(p.mq) ? [p.mq] : this.mqs; }
  sendTo(cid, m, forceRelay) {
    const p = this.peers.get(cid), s = JSON.stringify(m);
    if (p && p.local) { queueMicrotask(() => p.local(JSON.parse(s))); return; }
    if (p && p.lan) { Lan.send(p.lan, s); return; }
    if (!forceRelay && p && p.dc && p.dc.readyState === 'open') { try { p.dc.send(s); return; } catch (e) { } }
    for (const q of this.mqFor(p)) q.publish(NS + this.room + '/to/' + cid, s);
  }
  // بث للجميع: مباشر لمن يملك قناة، وعبر كل وسيط فيه لاعبون بلا قناة (مرة واحدة لكل وسيط)
  broadcast(m) {
    const s = JSON.stringify(m), via = new Set();
    for (const p of this.peers.values()) {
      if (p.local) { queueMicrotask(() => p.local(JSON.parse(s))); continue; }
      if (p.lan) { Lan.send(p.lan, s); continue; }
      if (p.dc && p.dc.readyState === 'open') { try { p.dc.send(s); continue; } catch (e) { } }
      for (const q of this.mqFor(p)) via.add(q);
    }
    for (const q of via) q.publish(NS + this.room + '/dn', s);
  }
  drop(cid) { const p = this.peers.get(cid); if (p && p.pc) p.pc.close(); this.peers.delete(cid); }
  via(cid) { const p = this.peers.get(cid); return p ? p.via : 'relay'; }
  get remotes() { let n = 0; for (const p of this.peers.values()) if (!p.local) n++; return n; }
  close() { this.closed = true; if (this.lanIp) { Lan.stop(); this.lanIp = ''; } for (const p of this.peers.values()) if (p.pc) p.pc.close(); this.peers.clear(); for (const q of this.mqs) { q.onclose = null; q.close(); } this.mqs = []; }
}

// ---------- جهة اللاعب ----------
export class ClientLink {
  constructor(room, opt = {}) { this.room = room; this.cid = opt.cid || newId(); this.mq = null; this.pc = null; this.dc = null; this.onmsg = null; this.onstatus = opt.onStatus || (() => { }); this.via = 'relay'; this.useRtc = opt.rtc !== false && !NO_RTC && typeof RTCPeerConnection !== 'undefined'; this.brokers = opt.brokers; this.closed = false; this.tries = 0; }
  async open() {
    const mq = this.mq = await connectAny(this.brokers, this.onstatus);
    this.url = mq.url;
    mq.subscribe(NS + this.room + '/dn'); mq.subscribe(NS + this.room + '/to/' + this.cid);
    mq.onmessage = (topic, payload) => {
      let m; try { m = JSON.parse(utf8.dec(payload)); } catch (e) { return; }
      if (m.k === 'rtc-answer') { this.gotAnswer(m.sdp); return; }
      if (this.dc && this.dc.readyState === 'open' && topic.endsWith('/dn')) return; // لدينا قناة مباشرة
      this.onmsg && this.onmsg(m);
    };
    mq.onclose = () => { if (this.closed) return; this.onstatus('انقطع الوسيط — إعادة الاتصال…'); this.reopen(); };
    this.tries = 0;
    return this;
  }
  async reopen() {
    if (this.closed) return;
    if (++this.tries > 4) { this.onclosed && this.onclosed(); return; }
    await new Promise(r => setTimeout(r, 800 * this.tries));
    try { this.brokers = [this.url]; await this.open(); this.onstatus('عاد الاتصال ✓'); this.onreopen && this.onreopen(); } catch (e) { this.reopen(); }
  }
  async tryRtc() {
    if (!this.useRtc || this.closed) return;
    try {
      if (this.pc) this.pc.close();
      const pc = this.pc = new RTCPeerConnection({ iceServers: ICE });
      const dc = pc.createDataChannel('g', { ordered: false, maxRetransmits: 0 });
      dc.onopen = () => { this.dc = dc; this.via = 'p2p'; this.onstatus('اتصال مباشر ✓'); };
      dc.onclose = () => { if (this.dc === dc) { this.dc = null; this.via = 'relay'; } };
      dc.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.k === 'rtc-answer') return; this.onmsg && this.onmsg(m); };
      await pc.setLocalDescription(await pc.createOffer());
      await waitIce(pc);
      this.send({ k: 'rtc-offer', sdp: pc.localDescription.sdp }, true);
    } catch (e) { }
  }
  async gotAnswer(sdp) { try { if (this.pc && !this.pc.currentRemoteDescription) await this.pc.setRemoteDescription({ type: 'answer', sdp }); } catch (e) { } }
  send(m, relay) {
    m.from = this.cid; const s = JSON.stringify(m);
    if (!relay && this.dc && this.dc.readyState === 'open') { try { this.dc.send(s); return; } catch (e) { } }
    this.mq && this.mq.publish(NS + this.room + '/up', s);
  }
  close() { if (this.closed) return; try { this.send({ k: 'bye' }, true); } catch (e) { } this.closed = true; if (this.pc) this.pc.close(); if (this.mq) { this.mq.onclose = null; setTimeout(() => this.mq.close(), 150); } }
}

// ---------- لاعب محلي على هاتف المضيف (بلا شبكة) ----------
export class LocalLink {
  constructor(server, opt = {}) { this.srv = server; this.cid = opt.cid || newId(); this.onmsg = null; this.onstatus = opt.onStatus || (() => { }); this.via = 'local'; this.closed = false; this.url = 'local'; }
  async open() { this.srv.link.addLocal(this.cid, m => { if (!this.closed && this.onmsg) this.onmsg(m); }); return this; }
  tryRtc() { }
  send(m) { if (this.closed) return; m.from = this.cid; const s = JSON.stringify(m); queueMicrotask(() => { try { this.srv.link.handle(this.cid, JSON.parse(s), 'local'); } catch (e) { } }); }
  close() { if (this.closed) return; this.send({ k: 'bye' }); this.closed = true; }
}
