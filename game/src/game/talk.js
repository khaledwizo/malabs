// حكي أهل السوق: كل شخص بصوته وطريقته. حين تدخل دائرتهم يبدؤون السالفة ويكمّلونها للآخر بلا مقاطعة،
// ويرحّبون بك كمجاهد بعد ما يخلّصون. الصوت يخفت كلما ابتعدت. لا تتكرّر أي جملة داخل المباراة الواحدة.
// الصوت: جمل مسجّلة بأصوات عراقية (voice/) إن وُجدت، وإلا همهمة بشرية مع فقاعة النص.
import * as THREE from 'three';
import { Settings } from '../core/settings.js';
import { Audio } from '../core/audio.js';
import { Voices, voiceId } from '../core/voices.js';
import { lite } from '../core/voicekey.js';
import { PERSONAS, GROUPS } from './talkdata.js';

const START_R = 14, STORY_R = 7, GREET_R = 4.6, CALL_R = 13, HEAR_R = 26, FLOOR_R = 22;
const V = new THREE.Vector3();
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class TalkManager {
  constructor(game, civs) {
    this.g = game; this.civs = civs; this.t = 0; this.bubbles = []; this.used = new Set();
    Voices.load();
    civs.forEach((c, i) => {
      const P = PERSONAS[i];
      c.per = P && P.look === c.n.look ? P : null;
      c.name = c.per ? c.per.name : (c.n.pose === 'pray' ? 'زائر' : 'رجل من السوق');
      c.idx = i;
    });
    // وحدات الكلام: مجموعات تتسولف، وأفراد يحچون قصصهم وينادون على بضاعتهم
    this.units = [];
    for (const G of GROUPS) {
      const m = G.ids.map(i => civs[i]); if (m.some(c => !c || !c.per)) continue;
      const u = { m, convos: G.convos, cx: m.reduce((s, c) => s + c.n.x, 0) / m.length, cz: m.reduce((s, c) => s + c.n.z, 0) / m.length };
      for (const c of m) c.unit = u; this.units.push(u);
    }
    for (const c of civs) if (c.per && !c.unit) { const u = { m: [c], solo: true, cx: c.n.x, cz: c.n.z }; c.unit = u; this.units.push(u); }
    this.reset();
  }
  get on() { return (Settings.talk ?? 0.9) > 0.01; }
  // بداية كل مباراة: صفحة جديدة، ولا جملة مكرّرة بعدها
  reset() {
    this.stopAll(); this.used.clear();
    for (const u of this.units) {
      u.q = []; u.cur = null; u.gap = 0; u.cd = 1 + Math.random() * 4; u.scare = 0; u.reacted = false; u.pendingGreet = null; u.dwell = 0;
      u.convoLeft = shuffle(u.convos ? u.convos.map((_, i) => i) : []);
      u.storyLeft = shuffle(u.solo && u.m[0].per.story ? u.m[0].per.story.map((_, i) => i) : []);
    }
    for (const c of this.civs) { c.greetCD = 0; c.greets = 0; c.callCD = 4 + Math.random() * 10; c.cower = 0; c.talkT = 0; }
    for (const u of this.units) u.hold = false; this.floorGap = 1.5; this.callGap = 6;
  }
  // «الدور»: حوار واحد (أو نداء أو ترحيب) مسموع بنفس الوقت — يخلص ويبدأ غيره بعد سكتة قصيرة.
  // الحوار البعيد اللي ما يوصلك صوته ما يمنع اللي يمّك
  free(u) { if (u.hold) return true; if (this.floorGap > 0) return false; for (const o of this.units) if (o !== u && o.hold && o.dd < FLOOR_R) return false; return true; }
  take(u) { u.hold = true; }
  // جملة لم تُقل بعد من قائمة الشخص (أو null)
  fresh(c, list) {
    if (!list) return null;
    const ok = list.filter(t => !this.used.has(c.idx + '|' + t)); if (!ok.length) return null;
    const t = ok[Math.floor(Math.random() * ok.length)]; this.used.add(c.idx + '|' + t); return t;
  }
  enqueue(u, c, text, kind) { this.used.add(c.idx + '|' + text); u.q.push({ c, text, kind }); }
  vol(c) {
    const cam = this.g.camera.position, d = Math.hypot(c.n.x - cam.x, c.n.z - cam.z);
    const k = Math.max(0, Math.min(1, 1 - (d - 2.5) / (HEAR_R - 2.5)));
    return Math.pow(k, 1.4) * Settings.volume * (Settings.talk ?? 0.9);
  }
  // ينطق السطر: صوت مسجّل أو همهمة، فقاعة، إيماءات، والسامعون يلتفتون
  speak(u, L) {
    this.take(u);
    const c = L.c, per = c.per, id = voiceId(per, L.text, false), rec = Voices.has(id);
    const dur = rec ? Voices.dur(id) : Math.max(1.3, 0.45 + L.text.length * 0.067 * (1 - per.r / 100));
    const cur = u.cur = { c, L, t: 0, dur, el: null, done: false };
    if (rec) cur.el = Voices.play(id, this.vol(c), () => { cur.done = true; });
    else if (this.vol(c) > 0.02) Audio.babble([c.n.x, c.n.y + 1.5, c.n.z], dur, 1 + per.p / 100, Math.min(1, (Settings.talk ?? 0.9) * 1.1));
    c.say(dur);
    const cam = this.g.camera.position;
    if (L.kind === 'convo') { const o = u.m.find(q => q !== c && q.here); if (o) c.focus(o.n.x, o.n.z, dur); }
    else c.focus(cam.x, cam.z, dur + 0.5);
    for (const q of u.m) if (q !== c && q.here) q.focus(c.n.x, c.n.z, dur + 0.8);
    if (L.kind === 'greet') { c.wave = 2.2; c.waved = true; }
    this.bubble(c, L.text, dur);
  }
  stopUnit(u) { if (u.cur && u.cur.el) { try { u.cur.el.pause(); } catch (e) { } } if (u.cur) u.cur.c.talkT = 0; u.cur = null; }
  stopAll() { for (const u of this.units || []) this.stopUnit(u); }
  // رمي قريب: يفزعون وينحنون، وبعد ما يخلص السطر الحالي أحدهم يصيح، وبعد الهدوء يحمدون الله ويكمّلون
  onShot(pos) {
    if (!this.g.sim) return;
    for (const c of this.civs) {
      if (!c.here || c.n.pose === 'pray') continue;
      const d = Math.hypot(c.n.x - pos[0], c.n.z - pos[2]); if (d > 24) continue;
      if (!(c.cower > 0.4)) c.scare(2.2 + Math.random() * 2.2 + (d < 8 ? 1.5 : 0));
      if (c.unit) c.unit.scare = 5;
    }
  }
  update(dt) {
    this.t += dt;
    // الحچي باللوبي بس — بالمعركة أهل السوق ساكتين. وبالمشهد السينمائي محّد يقاطع
    const g = this.g, live = !!g.sim && g.lobby && !g.cine && !g.paused && g.sim.phase !== 'over';
    if (!live || !this.on) { this.stopAll(); for (const u of this.units) u.q.length = 0; this.renderBubbles(); return; }
    const cam = g.camera.position, me = g.mp, alive = !!(me && me.alive);
    for (const c of this.civs) { c.greetCD -= dt; c.callCD -= dt; }
    // «التحديق»: الشخص يحچي بس لمّا توقف وتباوع عليه (مركز الشاشة قريب من راسه) — مو كل ما تمشي يمّه
    { const f = V; g.camera.getWorldDirection(f); const moving = me && Math.hypot(me.vel ? me.vel[0] : 0, me.vel ? me.vel[2] : 0) > 2.6;
      for (const c of this.civs) {
        const dx = c.n.x - cam.x, dy = c.n.y + (c.sit ? 1.1 : 1.55) - cam.y, dz = c.n.z - cam.z, d = Math.hypot(dx, dy, dz);
        const look = d < 7 && c.here && (dx * f.x + dy * f.y + dz * f.z) / d > Math.cos(d < 2.5 ? 0.32 : 0.17);
        c.stare = look && !moving ? (c.stare || 0) + dt : Math.max(0, (c.stare || 0) - dt * 2);
      } }
    this.floorGap -= dt; this.callGap -= dt;
    for (const u of this.units) if (u.hold && !u.m.some(c => c.here)) u.hold = false;
    // الأقرب أولاً: هو اللي ياخذ الدور إذا صار السوق ساكت
    for (const u of this.units) u.dd = Math.hypot(u.cx - cam.x, u.cz - cam.z);
    const order = this.units.slice().sort((a, b) => (b.hold ? 1 : 0) - (a.hold ? 1 : 0) || a.dd - b.dd);
    for (const u of order) this.step(u, dt, cam, alive);
    // زوّار الضريح: فقاعة هادئة بلا صوت حين تقترب
    if ((this.prayT = (this.prayT || 0) - dt) <= 0) { this.prayT = 1; for (const c of this.civs) if (c.here && c.n.pose === 'pray' && (c.prayCD = (c.prayCD || 0) - 1) <= 0 && Math.hypot(c.n.x - cam.x, c.n.z - cam.z) < 4.5) { c.prayCD = 30; this.bubble(c, '(يقرأ سورة الفاتحة بخشوع)', 3.5); break; } }
    this.renderBubbles();
  }
  step(u, dt, cam, alive) {
    const live = u.m.filter(c => c.here);
    if (!live.length) { this.stopUnit(u); u.q.length = 0; return; }
    const d = Math.hypot(u.cx - cam.x, u.cz - cam.z);
    if (u.scare > 0) u.scare -= dt;
    // السطر الجاري: لا يُقطع أبداً (إلا بموت المتكلّم)
    if (u.cur) {
      const C = u.cur; C.t += dt;
      if (!C.c.here) { this.stopUnit(u); u.q = u.q.filter(L => L.kind !== 'convo' && L.c !== C.c); return; }
      if (C.el) C.el.volume = Math.max(0, Math.min(1, this.vol(C.c)));
      if (C.done || C.t > C.dur + (C.el ? 2.5 : 0.25)) {
        u.cur = null; u.gap = u.q.length ? (C.L.kind === 'story' ? 0.55 : 0.35) + Math.random() * 0.4 : 0.6;
        if (!u.q.length && (C.L.kind === 'convo' || C.L.kind === 'story')) u.cd = 9 + Math.random() * 10;
      } else {
        // اقتربت وهم يحچون: يرحّب بك بعد ما يخلّصون
        if (alive && !u.pendingGreet) for (const c of live) if (c.greetCD <= 0 && c.greets < 2 && (c.stare || 0) > 1.0) { u.pendingGreet = c; break; }
        return;
      }
    }
    if (u.gap > 0) { u.gap -= dt; return; }
    // الفزع: صيحة بعد السطر، ثم صمت حتى يهدأ الرمي، ثم حمد وسلامة
    if (u.scare > 0) {
      // واحد بس يصيح (الأقرب)، والباقون ينحنون ساكتين
      if (!u.reacted) { u.reacted = this.free(u) && d < HEAR_R ? 1 : 2; if (u.reacted === 1) { const c = this.nearest(live, cam), t = this.fresh(c, c.per.react); if (t) this.speak(u, { c, text: t, kind: 'react' }); else u.reacted = 2; } }
      this.release(u); return;
    }
    if (u.reacted) { const r = u.reacted; u.reacted = 0; if (r === 1 && d < HEAR_R && this.free(u)) { const c = this.nearest(live, cam), t = this.fresh(c, c.per.calm); if (t) { this.speak(u, { c, text: t, kind: 'calm' }); return; } } }
    // تكملة السالفة أو القصة
    if (u.q.length) { const L = u.q.shift(); if (L.c.here) this.speak(u, L); return; }
    this.release(u);
    if (!this.free(u)) {
      if (u.cd > 0) u.cd -= dt;
      // غيرهم يحچي: إذا مرّيت يمّهم يرحّبون بيك بعد ما يخلص
      if (alive && !u.pendingGreet) for (const c of live) if (c.greetCD <= 0 && c.greets < 2 && (c.stare || 0) > 1.0) { u.pendingGreet = c; break; }
      return;
    }
    // ترحيب مؤجّل: بعد ما خلّصوا حچيهم
    if (u.pendingGreet) {
      const c = u.pendingGreet; u.pendingGreet = null;
      if (alive && c.here && Math.hypot(c.n.x - cam.x, c.n.z - cam.z) < 8) { c.greetCD = 60; c.greets++; const t = this.fresh(c, c.per.greet); if (t) { this.speak(u, { c, text: t, kind: 'greet' }); return; } }
    }
    // ترحيب عند الاقتراب
    if (alive) for (const c of live) {
      if (c.greetCD > 0 || c.greets >= 2 || c.cower > 0) continue;
      if ((c.stare || 0) > 1.0 && this.visible(c)) { c.greetCD = 60; c.greets++; const t = this.fresh(c, c.per.greet); if (t) { this.speak(u, { c, text: t, kind: 'greet' }); u.cd = Math.max(u.cd, 2.5); return; } }
    }
    if (u.cd > 0) { u.cd -= dt; return; }
    // مجموعة: سالفة جديدة حين تدخل دائرتهم
    if (!u.solo) {
      if (d < START_R && u.convoLeft.length && live.length === u.m.length && live.some(c => (c.stare || 0) > 1.4)) { const ci = u.convoLeft.shift(); for (const [r, t] of u.convos[ci]) this.enqueue(u, u.m[r], t, 'convo'); this.take(u); }
      return;
    }
    // فرد: قصّة لمن يقف يمّه، أو نداء على البضاعة
    const c = u.m[0], dc = Math.hypot(c.n.x - cam.x, c.n.z - cam.z);
    if (dc < STORY_R && alive && (c.stare || 0) > 0.6) u.dwell += dt; else u.dwell = 0;
    if (u.dwell > 1.2 && u.storyLeft.length) { const si = u.storyLeft.shift(); for (const t of c.per.story[si]) this.enqueue(u, c, t, 'story'); this.take(u); u.dwell = 0; return; }
    if (c.per.call && c.callCD <= 0 && this.callGap <= 0 && dc < CALL_R && dc > 5.2) { c.callCD = 60 + Math.random() * 40; this.callGap = 25 + Math.random() * 15; const t = this.fresh(c, c.per.call); if (t) { this.speak(u, { c, text: t, kind: 'call' }); u.cd = 3; } }
  }
  release(u) { if (u.hold && !u.cur && !u.q.length && !(u.gap > 0)) { u.hold = false; if (u.dd < FLOOR_R) this.floorGap = 1.6 + Math.random() * 1.4; } }
  busyNear(u, cam) { for (const o of this.units) if (o !== u && (o.q.length || (o.cur && o.cur.L.kind !== 'call')) && Math.hypot(o.cx - cam.x, o.cz - cam.z) < START_R) return true; return false; }
  nearest(list, cam) { let b = list[0], bd = 1e9; for (const c of list) { const d = Math.hypot(c.n.x - cam.x, c.n.z - cam.z); if (d < bd) { bd = d; b = c; } } return b; }
  visible(c) { const cam = this.g.camera.position; return this.g.world.los(cam.x, cam.y, cam.z, c.n.x, c.n.y + 1.4, c.n.z); }
  // ---------- الفقاعات ----------
  get layerEl() {
    if (this.layer && this.layer.isConnected) return this.layer;
    const host = document.getElementById('hud'); if (!host) return null;
    this.layer = document.createElement('div'); this.layer.id = 'talk'; host.insertBefore(this.layer, host.querySelector('#touch')); return this.layer;
  }
  bubble(c, text, dur) {
    for (const b of this.bubbles) if (b.c === c) b.until = Math.min(b.until, this.t);
    const L = this.layerEl; if (!L) return;
    const el = document.createElement('div'); el.className = 'tb2'; el.innerHTML = `<small>${c.name}</small>${lite(text)}`;
    L.appendChild(el); this.bubbles.push({ c, el, until: this.t + dur + 0.6, born: this.t, vis: true, chk: 0 });
  }
  renderBubbles() {
    const cam = this.g.camera, W = innerWidth, H = innerHeight, t = this.t;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i], c = b.c;
      if (t > b.until + 0.35 || !this.g.sim || !c.here) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
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
  clear() { this.stopAll(); for (const u of this.units) u.q.length = 0; for (const b of this.bubbles) b.el.remove(); this.bubbles.length = 0; }
}
