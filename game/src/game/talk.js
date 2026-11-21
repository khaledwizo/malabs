// حكي أهل السوق: يرحّبون بك حين تقترب، الباعة ينادون على بضاعتهم، والجالسون معاً يتسولفون باللهجة البغدادية،
// ويفزعون إذا اشتدّ الرمي. صوت واحد في كل لحظة (كما في الواقع تسمع الأقرب)، مع فقاعة نصّ فوق رأس المتكلّم.
import * as THREE from 'three';
import { Speech } from '../core/speech.js';
import { Settings } from '../core/settings.js';
import { NAMES, GREET, CALLS, REACT, CALM, CONVOS, ttsText } from './talkdata.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const V = new THREE.Vector3();

export class TalkManager {
  constructor(game, civs) {
    this.g = game; this.civs = civs; this.cur = null; this.gap = 1.5; this.reactCD = 0; this.greetGap = 0; this.queue = []; this.calmT = 0;
    Speech.init();
    // أسماء وأصوات ثابتة لكل شخص
    let ni = 0; const used = new Set();
    for (const c of civs) {
      const n = c.n;
      c.name = n.look === 'tea' && n.pose === 'stand' ? 'أبو سلام الچايچي' : n.look === 'fisher' ? 'أبو حيدر الصيّاد' : n.look === 'nursery' ? 'أبو ريحانة' : (() => { let nm; do nm = NAMES[(n.seed * 7 + ni++) % NAMES.length]; while (used.has(nm) && used.size < NAMES.length); used.add(nm); return nm; })();
      c.voice = n.seed % 5; c.pitch = n.look === 'elder' ? 0.82 + (n.seed % 3) * 0.04 : 0.9 + (n.seed % 4) * 0.06; c.rate = n.look === 'elder' ? 0.86 : 0.95 + (n.seed % 3) * 0.04;
      c.greetCD = 3 + Math.random() * 4; c.callCD = 4 + Math.random() * 10;
    }
    // مجموعات السوالف: كل من يجلس أو يقف قرب غيره (عدا زوّار الضريح)
    const free = civs.filter(c => c.n.pose !== 'pray'), seen = new Set(); this.groups = [];
    for (const c of free) {
      if (seen.has(c)) continue; const G = [c]; seen.add(c);
      for (let i = 0; i < G.length; i++) for (const d of free) if (!seen.has(d) && Math.hypot(d.n.x - G[i].n.x, d.n.z - G[i].n.z) < 4.3) { seen.add(d); G.push(d); }
      if (G.length < 2) { c.solo = true; continue; }
      // صاحب الچاي أولاً إن وُجد
      G.sort((a, b) => (b.n.look === 'tea' && b.n.pose === 'stand') - (a.n.look === 'tea' && a.n.pose === 'stand'));
      const cx = G.reduce((s, q) => s + q.n.x, 0) / G.length, cz = G.reduce((s, q) => s + q.n.z, 0) / G.length;
      const grp = { m: G, cx, cz, cd: 2 + Math.random() * 8, script: null, i: 0, tea: G[0].n.look === 'tea' && G[0].n.pose === 'stand' };
      for (const q of G) q.group = grp; this.groups.push(grp);
    }
    this.bubbles = [];
  }
  // طبقة الفقاعات داخل الواجهة (تحت أزرار اللمس)
  get layerEl() {
    if (this.layer && this.layer.isConnected) return this.layer;
    const host = document.getElementById('hud'); if (!host) return null;
    this.layer = document.createElement('div'); this.layer.id = 'talk'; host.insertBefore(this.layer, host.querySelector('#touch')); return this.layer;
  }
  get on() { return (Settings.talk ?? 0.9) > 0.01; }
  listener() { const c = this.g.camera, f = V.set(0, 0, -1).applyQuaternion(c.quaternion); return [c.position.x, c.position.y, c.position.z, f.x, f.z]; }
  // يتكلّم شخص: صوت + فقاعة + إيماءات، والسامعون يلتفتون إليه
  say(c, text, kind, after) {
    const dur = Math.max(1.4, 0.45 + text.length * 0.068 / c.rate), tok = {};
    this.cur = { c, tok, kind, t: 0, dur, after };
    c.say(dur);
    if (kind === 'convo' && c.group) { const o = c.group.m.find(q => q !== c && q.alive); if (o) c.focus(o.n.x, o.n.z, dur); }
    if (c.group) for (const q of c.group.m) if (q !== c && q.alive) q.focus(c.n.x, c.n.z, dur + 0.8);
    this.bubble(c, text, dur);
    Speech.speak({ text, tts: ttsText(text), pitch: c.pitch, rate: c.rate, voice: c.voice, pos: [c.n.x, c.n.y + 1.5, c.n.z], listener: this.listener(), dur }, () => { if (this.cur && this.cur.tok === tok) this.cur.done = true; });
  }
  interrupt() { if (!this.cur) return; const c = this.cur.c; this.cur = null; c.talkT = 0; Speech.stop(); for (const b of this.bubbles) if (b.c === c) b.until = Math.min(b.until, this.t + 0.3); }
  // رمي قريب: من حوله يفزعون، وأقربهم إلى اللاعب يصرخ
  onShot(pos, mine) {
    if (!this.g.sim) return;
    let near = null, nd = 1e9; const cam = this.g.camera.position;
    for (const c of this.civs) {
      if (!c.alive || c.n.pose === 'pray') continue;
      const d = Math.hypot(c.n.x - pos[0], c.n.z - pos[2]); if (d > 24) continue;
      if (!(c.cower > 0.4)) c.scare(2.2 + Math.random() * 2.2 + (d < 8 ? 1.5 : 0));
      const dc = Math.hypot(c.n.x - cam.x, c.n.z - cam.z); if (dc < 22 && dc < nd) { nd = dc; near = c; }
    }
    if (near) {
      this.calmT = 6; this.calmC = near;
      if (this.reactCD <= 0) { this.reactCD = 9 + Math.random() * 6; if (this.cur && this.cur.kind !== 'react') this.interrupt(); if (!this.cur) { this.say(near, pick(REACT), 'react'); this.gap = 0.8; } }
      for (const g of this.groups) if (g.m.includes(near) || Math.hypot(g.cx - pos[0], g.cz - pos[2]) < 24) { g.script = null; g.cd = Math.max(g.cd, 8); }
    }
  }
  reset() { this.interrupt(); this.queue.length = 0; for (const g of this.groups) { g.script = null; g.cd = 2 + Math.random() * 8; } for (const c of this.civs) { c.greetCD = 3 + Math.random() * 4; c.cower = 0; c.talkT = 0; } this.gap = 1.5; }
  update(dt) {
    this.t = (this.t || 0) + dt;
    const g = this.g, live = !!g.sim && !g.paused && !(g.sim && g.sim.phase === 'over');
    if (!live || !this.on) { if (this.cur) this.interrupt(); this.renderBubbles(); return; }
    const cam = g.camera.position, me = g.mp, alive = me && me.alive;
    this.reactCD -= dt; this.greetGap -= dt;
    for (const c of this.civs) { c.greetCD -= dt; c.callCD -= dt; }
    for (const gr of this.groups) gr.cd -= dt;
    // انتهاء الجملة الحالية
    if (this.cur) {
      const C = this.cur; C.t += dt;
      if (!C.c.alive) this.interrupt();
      else if (C.done || C.t > C.dur * 2.2 + 2) { this.cur = null; this.gap = 0.35 + Math.random() * 0.5; if (C.after) C.after(); }
    }
    if (!this.cur) this.gap -= dt;
    // بعد هدوء الرمي: أحدهم يحمد الله
    if (this.calmT > 0) { this.calmT -= dt; if (this.calmT <= 0 && this.calmC && this.calmC.alive && !this.cur && Math.random() < 0.6 && Math.hypot(this.calmC.n.x - cam.x, this.calmC.n.z - cam.z) < 20) this.say(this.calmC, pick(CALM), 'react'); }
    if (!this.cur && this.gap <= 0) this.next(cam, alive);
    // زوّار الضريح: فقاعة هادئة بلا صوت حين تقترب
    if ((this.prayT = (this.prayT || 0) - dt) <= 0) { this.prayT = 1; for (const c of this.civs) if (c.alive && c.n.pose === 'pray' && (c.prayCD = (c.prayCD || 0) - 1) <= 0 && Math.hypot(c.n.x - cam.x, c.n.z - cam.z) < 4.5) { c.prayCD = 25; this.bubble(c, '(يقرأ سورة الفاتحة بخشوع)', 3.5); break; } }
    this.renderBubbles();
  }
  next(cam, alive) {
    const dist = c => Math.hypot(c.n.x - cam.x, c.n.z - cam.z), ok = c => c.alive && c.n.pose !== 'pray' && !(c.cower > 0);
    // 1) الترحيب بمن يقترب
    if (alive && this.greetGap <= 0) {
      let best = null, bd = 4.6;
      for (const c of this.civs) { if (!ok(c) || c.greetCD > 0) continue; const d = dist(c); if (d < bd && this.visible(c)) { bd = d; best = c; } }
      if (best) {
        const L = GREET[best.n.look] && Math.random() < 0.75 ? GREET[best.n.look] : GREET.any;
        best.greetCD = 50 + Math.random() * 30; this.greetGap = 3; best.wave = 2.2; best.waved = true; best.focus(cam.x, cam.z, 4);
        if (best.group) for (const q of best.group.m) q.greetCD = Math.max(q.greetCD, 12); // لا يرحّب الكل بنفس اللحظة
        this.say(best, pick(L), 'greet'); return;
      }
    }
    // 2) سالفة جارية أو جديدة في أقرب مجموعة
    let G = null, gd = 17;
    for (const gr of this.groups) { const d = Math.hypot(gr.cx - cam.x, gr.cz - cam.z); if (d < gd && (gr.script || gr.cd <= 0) && gr.m.filter(ok).length >= 2) { gd = d; G = gr; } }
    if (G) {
      const M = G.m.filter(ok);
      if (!G.script) { const pool = CONVOS.filter(s => s.n <= M.length && (!s.tea || G.tea) && s !== G.last); G.script = pick(pool); G.last = G.script; G.i = 0; G.cast = M.slice().sort(() => G.tea ? 0 : Math.random() - 0.5); }
      const [r, text] = G.script.l[G.i], c = G.cast[r];
      if (!c || !ok(c)) { G.script = null; G.cd = 6; return; }
      G.i++; if (G.i >= G.script.l.length) { G.script = null; G.cd = 9 + Math.random() * 14; }
      this.say(c, text, 'convo'); this.gap = 0.25; return;
    }
    // 3) نداء بائع على بضاعته
    let S = null, sd = 12;
    for (const c of this.civs) { if (!ok(c) || c.callCD > 0 || !CALLS[c.n.look]) continue; const d = dist(c); if (d < sd && d > 5.2) { sd = d; S = c; } }
    if (S) { S.callCD = 14 + Math.random() * 14; this.say(S, pick(CALLS[S.n.look]), 'call'); return; }
    this.gap = 0.6;
  }
  visible(c) { const cam = this.g.camera.position; return this.g.world.los(cam.x, cam.y, cam.z, c.n.x, c.n.y + 1.4, c.n.z); }
  // ---------- الفقاعات ----------
  bubble(c, text, dur) {
    for (const b of this.bubbles) if (b.c === c) b.until = Math.min(b.until, this.t);
    const el = document.createElement('div'); el.className = 'tb2'; el.innerHTML = `<small>${c.name}</small>${text}`;
    const L = this.layerEl; if (!L) return; L.appendChild(el); this.bubbles.push({ c, el, until: (this.t || 0) + dur + 0.6, born: this.t || 0, vis: true, chk: 0 });
  }
  renderBubbles() {
    const cam = this.g.camera, W = innerWidth, H = innerHeight, t = this.t || 0;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i], c = b.c;
      if (t > b.until + 0.35 || !this.g.sim) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      const top = c.n.y + (c.sit ? 1.5 : 2.02);
      V.set(c.n.x, top, c.n.z).project(cam);
      const d = Math.hypot(c.n.x - cam.position.x, c.n.z - cam.position.z);
      if ((b.chk -= 1) <= 0) { b.chk = 12; b.vis = this.g.world.los(cam.position.x, cam.position.y, cam.position.z, c.n.x, top - 0.4, c.n.z); }
      const show = V.z < 1 && V.z > -1 && d < 18 && b.vis && Math.abs(V.x) < 1.15 && Math.abs(V.y) < 1.15;
      if (!show) { b.el.style.opacity = 0; continue; }
      const a = Math.min(1, (t - b.born) * 5, (b.until + 0.35 - t) * 3), s = Math.max(0.62, Math.min(1.05, 1.25 - d / 16));
      b.el.style.opacity = a.toFixed(2);
      b.el.style.transform = `translate(${((V.x + 1) / 2 * W).toFixed(1)}px, ${((1 - V.y) / 2 * H).toFixed(1)}px) translate(-50%, -100%) scale(${s.toFixed(2)})`;
    }
  }
  clear() { this.interrupt(); for (const b of this.bubbles) b.el.remove(); this.bubbles.length = 0; }
}
