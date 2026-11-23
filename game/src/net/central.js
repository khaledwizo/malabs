// الربط بتطبيق «سيرفر الرافدين» المركزي (إن كان شغّال على هاتف):
// - حالة السيرفر: رسالة محفوظة موقّعة على c/state (مفتاح السيرفر يُثبَّت أول مرة — ضد انتحال السيرفر)
// - طلب معركة: c/req ← ردّ على c/to/<معرّفي> برمز الغرفة أو «ممتلئ»
// - غياب السيرفر: كل معركة على هواتف اللاعبين تُسجَّل محلياً بمعرّف فريد، وتُرسل عند رجوعه (ACK + إعادة المحاولة)
// - وضع المضيف: الغرف المفتوحة تعلن نفسها على o/<الوضع>/<الغرفة>
import { Social } from './social.js';

const C = 'rafidain/v2/c/', O = 'rafidain/v2/o/';
const QK = 'rafidain.central.q', PK = 'rafidain.central.pin', TK = 'rafidain.tk';
const nowS = () => Date.now() / 1000;
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export const Central = {
  st: null, verified: false, q: [], waiters: new Map(), ads: null, adTopic: '', syncing: false, lastSync: 0, keyCache: null,
  init() {
    try { this.q = JSON.parse(localStorage.getItem(QK) || '[]'); } catch (e) { this.q = []; }
    Social.onConn = m => { m.subscribe(C + 'state'); m.subscribe(C + 'to/' + Social.id); };
    Social.ext = (topic, d, retained) => this.recv(topic, d, retained);
    setInterval(() => this.trySync(), 15000);
  },
  ident() { let tk = null; try { tk = localStorage.getItem(TK); if (!tk) { tk = Array.from(crypto.getRandomValues(new Uint8Array(15)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(TK, tk); } } catch (e) { tk = 'x'; } return { u: Social.id, tk }; },
  // السيرفر شغّال؟ (آخر حالة وصلت خلال 40 ثانية)
  isOnline() { return !!(this.st && this.st.on && nowS() - this.st.t < 40); },
  recv(topic, d, retained) {
    if (topic.startsWith(O)) { if (this.ads && topic.startsWith(this.adTopic)) { const room = topic.slice(this.adTopic.length); if (d && d.room === room) this.ads.set(room, d); else this.ads.delete(room); } return true; }
    if (!topic.startsWith(C)) return false;
    if (topic === C + 'state') { if (d) this.verify(d).then(b => { if (b) { this.st = b; if (b.on) this.trySync(); } }); return true; }
    if (topic === C + 'to/' + Social.id && d) this.verify(d).then(b => { if (!b) return; const w = this.waiters.get(b.re); if (w) { this.waiters.delete(b.re); w(b); } }); return true;
  },
  // التوقيع: { b: نص الرسالة, s: توقيع ECDSA, k: المفتاح العام } — نثبّت أول مفتاح ونرفض غيره (يتجدّد التثبيت إذا غاب السيرفر 3 أيام)
  async verify(d) {
    let body; try { body = JSON.parse(d.b); } catch (e) { return null; }
    const S = crypto && crypto.subtle; if (!S || !d.s || !d.k) { this.verified = false; return body; }
    let pin = null; try { pin = JSON.parse(localStorage.getItem(PK) || 'null'); } catch (e) { }
    const kid = d.k.x + d.k.y;
    if (pin && pin.id !== kid && nowS() - (pin.seen || 0) < 3 * 86400) return null; // سيرفر منتحل
    try {
      if (!this.keyCache || this.keyCache.id !== kid) this.keyCache = { id: kid, key: await S.importKey('jwk', { kty: 'EC', crv: 'P-256', x: d.k.x, y: d.k.y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']) };
      const ok = await S.verify({ name: 'ECDSA', hash: 'SHA-256' }, this.keyCache.key, b64d(d.s), new TextEncoder().encode(d.b));
      if (!ok) return null;
    } catch (e) { return null; }
    try { localStorage.setItem(PK, JSON.stringify({ id: kid, seen: nowS() })); } catch (e) { }
    this.verified = true; return body;
  },
  pub(topic, obj) { return Social.pub(topic, obj); },
  // طلب معركة من السيرفر المركزي
  request(mode, name, ms = 7000) {
    return new Promise(res => {
      const re = Math.random().toString(36).slice(2, 10), I = this.ident();
      const t = setTimeout(() => { this.waiters.delete(re); res(null); }, ms);
      this.waiters.set(re, b => { clearTimeout(t); res(b); });
      if (!this.pub(C + 'req', { from: Social.id, re, ...I, n: name, mo: mode, v: 4 })) { clearTimeout(t); this.waiters.delete(re); res(null); }
    });
  },
  // الغرف المفتوحة على هواتف اللاعبين (وضع المضيف)
  async findOpen(mode, ms = 1800) {
    this.ads = new Map(); this.adTopic = O + mode + '/';
    for (const m of Social.mqs) m.subscribe(this.adTopic + '+');
    await new Promise(r => setTimeout(r, ms));
    for (const m of Social.mqs) m.unsubscribe(this.adTopic + '+');
    const t = nowS(), L = [...this.ads.values()].filter(a => a.h > 0 && a.h < 10 && t - a.t < 60).sort((a, b) => b.h - a.h);
    this.ads = null; return L;
  },
  // ---------- طابور الأحداث (بغياب السيرفر) ----------
  record(ev) {
    ev.id = ev.id || (Social.id + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    this.q.push(ev); if (this.q.length > 500) this.q.splice(0, this.q.length - 500);
    this.save(); setTimeout(() => this.trySync(), 500);
  },
  save() { try { localStorage.setItem(QK, JSON.stringify(this.q)); } catch (e) { } },
  async trySync() {
    if (this.syncing || !this.q.length || !this.isOnline() || !Social.mqs.length) return;
    this.syncing = true;
    try {
      const batch = this.q.slice(0, 40), re = Math.random().toString(36).slice(2, 10), I = this.ident();
      const ack = await new Promise(res => { const t = setTimeout(() => { this.waiters.delete(re); res(null); }, 8000); this.waiters.set(re, b => { clearTimeout(t); res(b); }); this.pub(C + 'sync', { from: Social.id, re, ...I, ev: batch }); });
      if (ack && Array.isArray(ack.ids)) { const ok = new Set(ack.ids); this.q = this.q.filter(e => !ok.has(e.id)); this.save(); this.lastSync = Date.now(); if (this.q.length) setTimeout(() => { this.syncing = false; this.trySync(); }, 300); }
    } finally { this.syncing = false; }
  },
};
