// الهوية والأصدقاء والدعوات (مثل ببجي): لكل لاعب معرّف من 10 أرقام، طلب صداقة ← قبول، ثم «دعوة للعب» فتتشكّل فرقة يبدأها المضيف
// الاتصال عبر وسطاء MQTT عامّين: رسائل «محفوظة» للطلبات والحالة (تصل ولو كان الصديق غير متصل وقتها) ورسائل فورية للدعوات
import { Mqtt, brokerList, utf8 } from './mqtt.js';

const KEY = 'rafidain.social.v1', NS = 'rafidain/v2/u/';
function luhn(d) { let s = 0, alt = true; for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return (10 - s % 10) % 10; }
export function newPlayerId() { let d = String(1 + Math.floor(Math.random() * 9)); for (let i = 0; i < 8; i++) d += Math.floor(Math.random() * 10); return d + luhn(d); }
export function validId(s) { s = String(s || '').replace(/\D/g, ''); return s.length === 10 && luhn(s.slice(0, 9)) === +s[9] ? s : null; }
export function fmtId(s) { return s ? s.slice(0, 4) + ' ' + s.slice(4, 8) + ' ' + s.slice(8) : ''; }
const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'لاعب';
const nowS = () => Date.now() / 1000;

export const Social = {
  id: null, friends: [], requests: [], sent: [], party: null, online: false, listeners: new Set(), mqs: [], seen: new Map(), state: 'on', prof: () => ({ name: 'لاعب', char: 'khaled' }),
  load() {
    let d = {}; try { d = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
    // نسخة احتياطية من تطبيق أندرويد إن مُسحت بيانات الصفحة
    try { if (!d.id && window.RafidainAndroid && window.RafidainAndroid.loadId) { const a = window.RafidainAndroid.loadId(); if (a) d = JSON.parse(a); } } catch (e) { }
    this.id = validId(d.id) || newPlayerId();
    this.friends = (d.friends || []).filter(f => validId(f.id)).map(f => ({ ...f, status: 'off' })); this.sent = (d.sent || []).filter(validId);
    this.save();
  },
  save() {
    const s = JSON.stringify({ id: this.id, friends: this.friends.map(f => ({ id: f.id, name: f.name, char: f.char })), sent: this.sent });
    try { localStorage.setItem(KEY, s); } catch (e) { }
    try { if (window.RafidainAndroid && window.RafidainAndroid.saveId) window.RafidainAndroid.saveId(s); } catch (e) { }
  },
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
  emit(ev, d) { if (ev === 'profile') this.presence(); for (const f of this.listeners) try { f(ev, d); } catch (e) { console.warn(e); } },
  friend(id) { return this.friends.find(f => f.id === id); },
  // ---------- الاتصال ----------
  start(profile) {
    if (profile) this.prof = profile;
    for (const url of brokerList()) this.connectOne(url);
    setInterval(() => { if (this.mqs.length) this.presence(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { for (const url of brokerList()) if (!this.mqs.some(m => m.url === url)) this.connectOne(url); this.presence(); } });
  },
  async connectOne(url, tries = 0) {
    if (this.mqs.some(m => m.url === url)) return;
    const m = new Mqtt(url);
    try { await m.connect(8000, { will: { topic: NS + this.id + '/st', payload: JSON.stringify({ on: 0, t: nowS() }), retain: true } }); }
    catch (e) { setTimeout(() => this.connectOne(url, tries + 1), Math.min(30000, 3000 * (tries + 1))); return; }
    this.mqs.push(m);
    m.onmessage = (topic, payload, retained) => { let d = null; const raw = utf8.dec(payload); if (raw) { try { d = JSON.parse(raw); } catch (e) { return; } } this.recv(topic, d, retained, raw); };
    m.onclose = () => { this.mqs = this.mqs.filter(q => q !== m); this.setOnline(); setTimeout(() => this.connectOne(url), 3000); };
    const me = NS + this.id;
    for (const t of ['/rq/+', '/ac/+', '/rm/+', '/in']) m.subscribe(me + t);
    if (this.onConn) try { this.onConn(m); } catch (e) { }
    for (const f of this.friends) m.subscribe(NS + f.id + '/st');
    this.setOnline(); this.presence();
  },
  setOnline() { const was = this.online; this.online = this.mqs.length > 0; if (was !== this.online) this.emit('net'); },
  pub(topic, obj, retain) { const s = obj === null ? '' : JSON.stringify(obj); let ok = false; for (const m of this.mqs) ok = m.publish(topic, s, retain) || ok; return ok; },
  sub(topic) { for (const m of this.mqs) m.subscribe(topic); },
  presence(st) { if (st) this.state = st; const P = this.prof(); this.pub(NS + this.id + '/st', { on: 1, st: this.state, name: clean(P.name), char: P.char, t: nowS() }, true); },
  me() { const P = this.prof(); return { from: this.id, name: clean(P.name), char: P.char }; },
  // ---------- الرسائل الواردة ----------
  recv(topic, d, retained, raw) {
    if (this.ext && this.ext(topic, d, retained)) return; // السيرفر المركزي والغرف المفتوحة
    // الرسالة نفسها قد تصل من وسيطين: نتجاهل المكرّر
    const k = topic + '|' + raw, t = nowS(); if (this.seen.has(k) && t - this.seen.get(k) < 20) return; this.seen.set(k, t);
    if (this.seen.size > 300) for (const [kk, tt] of this.seen) if (t - tt > 60) this.seen.delete(kk);
    const parts = topic.split('/'); // rafidain/v2/u/{id}/{kind}/{from}
    const owner = parts[3], kind = parts[4], from = parts[5];
    if (kind === 'st') { const f = this.friend(owner); if (!f || !d) return; const fresh = t - (d.t || 0) < 150; f.status = d.on && fresh ? (d.st === 'game' ? 'game' : 'on') : 'off'; if (d.name) f.name = clean(d.name); if (d.char) f.char = d.char; this.emit('friends'); return; }
    if (owner !== this.id) return;
    if (kind === 'rq') {
      if (!d || !validId(from)) return;
      if (this.friend(from)) { this.pub(NS + from + '/ac/' + this.id, this.me(), true); this.pub(topic, null, true); return; } // صديق أصلاً (أعاد تثبيت اللعبة)
      if (this.sent.includes(from)) { this.addFriend(from, d); this.pub(NS + from + '/ac/' + this.id, this.me(), true); this.pub(topic, null, true); this.emit('accepted', { name: clean(d.name) }); return; } // طلبان متقابلان
      if (!this.requests.some(r => r.id === from)) { this.requests.push({ id: from, name: clean(d.name), char: d.char || 'khaled' }); this.emit('request', { name: clean(d.name) }); }
      return;
    }
    if (kind === 'ac') { if (!d || !validId(from)) return; const isNew = !this.friend(from); this.addFriend(from, d); this.pub(topic, null, true); if (isNew) this.emit('accepted', { name: clean(d.name) }); return; }
    if (kind === 'rm') { if (!validId(from)) return; this.pub(topic, null, true); if (this.friend(from)) { this.friends = this.friends.filter(f => f.id !== from); this.save(); this.emit('friends'); } return; }
    if (kind === 'in' && d && validId(d.from) && !retained) this.onInbox(d);
  },
  addFriend(id, d) {
    let f = this.friend(id); if (!f) { f = { id, name: clean(d.name), char: d.char || 'khaled', status: 'on' }; this.friends.push(f); } else { f.name = clean(d.name); f.char = d.char || f.char; }
    this.sent = this.sent.filter(x => x !== id); this.requests = this.requests.filter(r => r.id !== id);
    this.sub(NS + id + '/st'); this.save(); this.emit('friends');
  },
  // ---------- طلبات الصداقة ----------
  request(id) { if (!validId(id) || id === this.id) return; if (!this.sent.includes(id)) this.sent.push(id); this.save(); this.pub(NS + id + '/rq/' + this.id, { ...this.me(), t: nowS() }, true); },
  accept(id) { const r = this.requests.find(x => x.id === id); if (!r) return; this.addFriend(id, r); this.pub(NS + id + '/ac/' + this.id, { ...this.me(), t: nowS() }, true); this.pub(NS + this.id + '/rq/' + id, null, true); },
  decline(id) { this.requests = this.requests.filter(r => r.id !== id); this.pub(NS + this.id + '/rq/' + id, null, true); this.emit('friends'); },
  cancelRequest(id) { this.sent = this.sent.filter(x => x !== id); this.save(); this.pub(NS + id + '/rq/' + this.id, null, true); },
  removeFriend(id) { this.friends = this.friends.filter(f => f.id !== id); this.save(); this.pub(NS + id + '/rm/' + this.id, { t: nowS() }, true); this.emit('friends'); },
  // ---------- الفرقة والدعوات ----------
  send(id, msg) { return this.pub(NS + id + '/in', { ...this.me(), ...msg, t: nowS() }); },
  ensureParty() { if (!this.party) { const P = this.prof(); this.party = { host: this.id, members: [{ id: this.id, name: clean(P.name), char: P.char }], vs: false }; } return this.party; },
  invite(id, mode) { const P = this.ensureParty(); if (P.host !== this.id) return; this.send(id, { k: 'inv', mode: mode || 'tdm' }); this.emit('party'); },
  acceptInvite(inv) {
    if (this.party && this.party.host !== inv.from) this.leaveParty();
    this.party = { host: inv.from, members: [{ id: inv.from, name: clean(inv.name), char: inv.char }, { ...this.me(), id: this.id }], vs: false, pending: true };
    this.send(inv.from, { k: 'join' }); this.emit('party');
    clearTimeout(this.joinT); this.joinT = setTimeout(() => { if (this.party && this.party.pending) { this.party = null; this.emit('party'); this.emit('note', { text: 'لم يردّ المضيف — ربما بدأ المعركة أو غادر' }); } }, 9000);
  },
  declineInvite(inv) { this.send(inv.from, { k: 'dec' }); },
  leaveParty() {
    const P = this.party; if (!P) return;
    if (P.host === this.id) for (const m of P.members) { if (m.id !== this.id) this.send(m.id, { k: 'disband' }); }
    else this.send(P.host, { k: 'leave' });
    this.party = null; this.emit('party');
  },
  setPartyVs(vs) { const P = this.party; if (!P || P.host !== this.id) return; P.vs = !!vs; this.syncParty(); },
  syncParty() { const P = this.party; if (!P || P.host !== this.id) return; for (const m of P.members) if (m.id !== this.id) this.send(m.id, { k: 'party', host: P.host, members: P.members, vs: P.vs }); this.emit('party'); },
  // المضيف يبدأ: يرسل للأعضاء رمز غرفة سيرفره (يُنشأ تلقائياً — لا حاجة لأي رمز)
  partyStart(room, info) { const P = this.party; if (!P || P.host !== this.id) return; for (const m of P.members) if (m.id !== this.id) this.send(m.id, { k: 'start', room, team: info.teams[m.id] ?? 0, mode: info.mode, weather: info.weather }); },
  onInbox(d) {
    const P = this.party;
    switch (d.k) {
      case 'inv': if (!this.friend(d.from)) return; this.emit('invite', { from: d.from, name: clean(d.name), char: d.char, mode: d.mode }); break;
      case 'join': {
        if (!this.friend(d.from)) return;
        const Q = this.ensureParty(); if (Q.host !== this.id) { this.send(d.from, { k: 'disband' }); return; }
        if (Q.members.length >= 8) { this.send(d.from, { k: 'full' }); return; }
        if (!Q.members.some(m => m.id === d.from)) Q.members.push({ id: d.from, name: clean(d.name), char: d.char });
        this.syncParty(); this.emit('note', { text: clean(d.name) + ' انضمّ لفرقتك ✓' });
        if (this.inMatch && this.inMatch()) this.lateJoin && this.lateJoin(d.from);
        break;
      }
      case 'dec': this.emit('note', { text: clean(d.name) + ' رفض الدعوة' }); break;
      case 'leave': if (P && P.host === this.id) { P.members = P.members.filter(m => m.id !== d.from); this.syncParty(); this.emit('note', { text: clean(d.name) + ' غادر الفرقة' }); } break;
      case 'party': if (P && P.host === d.from) { clearTimeout(this.joinT); this.party = { host: d.host, members: d.members, vs: !!d.vs }; this.emit('party'); } break;
      case 'disband': if (P && P.host === d.from) { this.party = null; this.emit('party'); this.emit('note', { text: 'حلّ المضيف الفرقة' }); } break;
      case 'full': if (P && P.host === d.from) { this.party = null; this.emit('party'); this.emit('note', { text: 'الفرقة ممتلئة' }); } break;
      case 'start': if (P && P.host === d.from) this.emit('start', d); break;
    }
  },
};
