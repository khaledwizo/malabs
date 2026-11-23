// مضيف الشيخ فاتح الرفاعي باللوبي:
// - ناس جالسين أغلب الوقت يتذاكرون 9 مواضيع فقهية (تجلس يمّهم وتسمع، تتخطّى المتكلّم، ويكمّل من وين وصلت)
// - محاضرات الشيخ عبد العزيز الرفاعي الخمس بأوقات مختلفة (بلا مقابل، فصحى، وتختم بالترحّم)
// - الأذان وصلاة جماعة سرّية (4 ركعات) كل ساعتين لعب فعلية باللوبي، وتگدر تلتحق وتسوّي الحركات وياهم
import * as THREE from 'three';
import { MAJLIS_MEN, MAJLIS, SHEIKH_A, IMAM, IMAM_CALLS, LECTURES } from './mudhifdata.js';
import { Voices, voiceId } from '../core/voices.js';
import { Audio } from '../core/audio.js';
import { Settings } from '../core/settings.js';
import { Input } from '../core/input.js';

const KEY = 'rafidain.mudhif.v1';
const $ = id => document.getElementById(id);
// داخل المضيف: الجدار الغربي x=-66، الشرقي (الباب) x=-52، الشمالي z=-18، الجنوبي z=-6
const ROOM = [-65.4, -17.4, -52.6, -6.6], DOOR = [-50.8, -12], INSIDE = [-54.2, -12];
const SEAT_Y = -0.24, FACE_E = -Math.PI / 2;           // جالس على الفرشة مواجه الباب
const MEN_AT = [[-64.95, -14.2], [-64.95, -12.9], [-64.95, -11.1], [-64.95, -9.8]], SHEIKH_AT = [-64.95, -12];
const ME_SEAT = [-64.7, -15.7];
// القبلة من العراق: جنوب مايل للغرب (−z شمال)
const QIBLA = Math.PI - 0.35, QF = [-Math.sin(QIBLA), -Math.cos(QIBLA)], QR = [Math.cos(QIBLA), -Math.sin(QIBLA)];
const IMAM_AT = [-58.4 + QF[0] * 2.4, -12 + QF[1] * 2.4];
const rowSlot = i => { const k = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2); return [-58.4 + QR[0] * k * 0.9, -12 + QR[1] * k * 0.9]; };
const FIRST_PRAY = 480, PRAY_EVERY = 7200, FIRST_LECT = 240, LECT_EVERY = 720;

export class Mudhif {
  constructor(game) {
    this.g = game; this.on = false; this.men = []; this.vis = []; this.sess = null; this.pray = null; this.lect = null; this.t = 0;
    try { this.S = Object.assign({ topic: 0, line: 0, lect: 0, playT: 0, nextPray: FIRST_PRAY, nextLect: FIRST_LECT, heard: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { this.S = { topic: 0, line: 0, lect: 0, playT: 0, nextPray: FIRST_PRAY, nextLect: FIRST_LECT, heard: 0 }; }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.S)); } catch (e) { } }
  start() {
    const A = this.g.ambient; if (!A || this.on) return; this.on = true;
    // الجالسين بالمضيف
    this.men = MAJLIS_MEN.map((m, i) => this.seat(A.spawn(m.look, MEN_AT[i][0], MEN_AT[i][1], { name: m.name, pose: 'sit', stool: false, seed: m.seed }), m));
    // زوّار يجون ويروحون (يسلّمون ويوقفون شوية ويطلعون)
    this.vis = [0, 1].map(k => { const w = A.spawn(k ? 'citizen' : 'pilgrim', -40 - k * 6, -10 + k * 4, { name: 'زائر المضيف', sp: 1.1, seed: 870 + k * 11 }); w.vt = 4 + k * 20; w.vin = false; return w; });
  }
  seat(w, per) { w.n.y = SEAT_Y; w.c.root.position.y = SEAT_Y; w.face(w.n.x + 1, w.n.z); w.c.per = per; w.c.name = per.name; return w; }
  stop() {
    this.endSession(true); this.endPrayer(true);
    for (const w of [...this.men, ...this.vis]) w.remove(); this.men = []; this.vis = [];
    if (this.sheikh) { this.sheikh.remove(); this.sheikh = null; }
    this.on = false; this.save();
  }
  get inside() { const me = this.g.mp; if (!me) return false; const [x0, z0, x1, z1] = ROOM; return me.pos[0] > x0 && me.pos[0] < x1 + 1.4 && me.pos[2] > z0 && me.pos[2] < z1; }
  // ---------- كل إطار ----------
  update(dt) {
    if (!this.on) return;
    const g = this.g; this.t += dt; this.S.playT += dt;
    if ((this.saveT = (this.saveT || 0) - dt) <= 0) { this.saveT = 10; this.save(); }
    // الزوّار
    for (const w of this.vis) { if (w.path || this.pray) continue; if ((w.vt -= dt) > 0) continue; w.vin = !w.vin; if (w.vin) { w.goTo(INSIDE[0] - Math.random() * 3, INSIDE[1] + (Math.random() - 0.5) * 4, () => { w.face(MEN_AT[1][0], MEN_AT[1][1]); w.c.wave = 2.2; }); w.vt = 35 + Math.random() * 30; } else { w.goTo(-30 + Math.random() * 20, -8 + Math.random() * 16); w.vt = 25 + Math.random() * 25; } }
    // محاضرة الشيخ: تبدأ بوقتها وتنتظرك 6 دقايق
    if (!this.lect && !this.pray && this.S.playT >= this.S.nextLect) this.openLecture();
    if (this.lect && !this.lect.on && this.t > this.lect.until) this.closeLecture(false);
    // الأذان والصلاة: كل ساعتين لعب
    if (!this.pray && this.S.playT >= this.S.nextPray && !g.cine) this.startPrayer();
    if (this.pray) this.tickPrayer(dt);
    if (this.sess) this.tickSession(dt);
  }
  // ---------- زر «استعمال» ----------
  interact(me) {
    if (!this.on || this.sess || !me) return null;
    const near = (p, r) => Math.hypot(p[0] - me.pos[0], p[1] - me.pos[2]) < r;
    const P = this.pray;
    if (P && !P.me && P.stage !== 'done' && this.inside) return { label: '🕌 التحق بالصلاة', fn: () => this.joinPrayer() };
    if (P) return null;
    if (near(ME_SEAT, 2.6) || near([-63.6, -12], 2.4)) return { label: this.lect ? '📖 احضر محاضرة الشيخ' : '🪑 اجلس مع المجلس', fn: () => this.sit() };
    return null;
  }
  // ---------- الكلام المسموع ----------
  speak(per, text, civ, onEnd) {
    const id = voiceId(per, text, false), rec = Voices.has(id), readT = Math.max(2.4, 0.9 + text.length * 0.072);
    const dur = rec ? Math.max(Voices.dur(id) + 0.3, readT * 0.7) : readT;
    let el = null;
    if (rec) el = Voices.play(id, Math.min(1, Math.max(0.6, Settings.volume) * (Settings.talk ?? 0.9) * 1.25), () => { });
    else Audio.babble([civ ? civ.n.x : this.g.camera.position.x, 1.2, civ ? civ.n.z : this.g.camera.position.z], Math.max(0.8, readT - 0.6), 1 + (per.p || 0) / 100, Math.min(1, (Settings.talk ?? 0.9) * 1.1));
    if (civ) civ.c.say ? civ.c.say(dur) : (civ.c.talkT = dur);
    return { el, dur };
  }
  // ---------- الجلوس بالمجلس / المحاضرة ----------
  sit() {
    const g = this.g; if (this.sess) return;
    this.sess = { t: 0, wait: 0.8, cur: null, lecture: !!this.lect }; if (this.lect) this.lect.on = true;
    g.cine = true; Input.reset(); Input.exitLock && Input.exitLock();
    const el = $('cine'); el.classList.add('on'); el.querySelector('.cimg').classList.remove('on'); el.querySelector('.cact').classList.remove('on');
    el.querySelector('.cbox').onclick = () => this.skip();
    el.querySelector('.cname').textContent = this.sess.lecture ? SHEIKH_A.name : 'مجلس المضيف'; el.querySelector('.ctext').textContent = this.sess.lecture ? '(الحاضرون ينصتون للشيخ…)' : '(جلست ويّا الجماعة…)';
    this.buttons();
  }
  buttons() {
    const box = $('cine').querySelector('.copts');
    box.innerHTML = `<button class="btn" data-a="skip">⏭ تخطّي</button><button class="btn" data-a="up">قوم من المجلس</button>`;
    box.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); Audio.play('ui'); if (b.dataset.a === 'skip') this.skip(); else this.endSession(); });
  }
  skip() { const s = this.sess; if (!s || !s.cur) return; if (s.cur.el) try { s.cur.el.pause(); } catch (e) { } s.cur = null; s.wait = 0.3; } // ينتقل للمتكلّم اللي بعده
  endSession(silent) {
    const s = this.sess; if (!s) return; if (s.cur && s.cur.el) try { s.cur.el.pause(); } catch (e) { }
    this.sess = null; this.g.cine = false; $('cine').classList.remove('on'); $('cine').querySelector('.copts').innerHTML = '';
    if (this.lect && this.lect.on && !silent) { this.lect.on = false; this.lect.until = this.t + 240; } // طلعت قبل ما تخلص: تبقى المحاضرة 4 دقايق ترجعلها
    this.save();
    if (!silent && !Input.isTouch) Input.requestLock && Input.requestLock();
  }
  tickSession(dt) {
    const s = this.sess; s.t += dt;
    if (s.cur) { s.cur.left -= dt; if (s.cur.left > 0) return; s.cur = null; s.wait = s.gap; }
    if ((s.wait -= dt) > 0) return;
    const el = $('cine');
    if (s.lecture) {
      const L = LECTURES[this.S.lect % LECTURES.length], i = this.lect.line;
      if (i >= L.lines.length) { this.closeLecture(true); this.endSession(true); return; }
      const sp = this.speak(SHEIKH_A, L.lines[i], this.sheikh); this.lect.line++;
      s.cur = { el: sp.el, left: sp.dur, who: this.sheikh }; s.gap = 1.2;
      el.querySelector('.cname').textContent = SHEIKH_A.name + ` · مجلس «${L.title}»`; el.querySelector('.ctext').textContent = L.lines[i];
      return;
    }
    const T = MAJLIS[this.S.topic % MAJLIS.length];
    if (this.S.line >= T.lines.length) {
      // خلص الموضوع: 6 ثواني مهلة تطلع إذا تريد، وبعدها موضوع جديد
      this.S.topic = (this.S.topic + 1) % MAJLIS.length; this.S.line = 0; this.save();
      el.querySelector('.cname').textContent = ''; el.querySelector('.ctext').textContent = '(سكتوا شوية… الموضوع الجاي: «' + MAJLIS[this.S.topic].title + '» — تگدر تقوم إذا تريد)';
      s.wait = 6; return;
    }
    const [k, text] = T.lines[this.S.line], per = MAJLIS_MEN[k], w = this.men[k];
    this.S.line++; this.save(); // يكمّل من المتكلّم اللي بعده إذا طلعت ورجعت
    const sp = this.speak(per, text, w);
    s.cur = { el: sp.el, left: sp.dur, who: w }; s.gap = this.S.line >= T.lines.length ? 1.5 : 1.0;
    el.querySelector('.cname').textContent = per.name + ` · «${T.title}»`; el.querySelector('.ctext').textContent = text;
    for (const o of this.men) if (o !== w) o.c.focus(w.n.x, w.n.z, sp.dur + 0.5);
  }
  // ---------- محاضرات الشيخ عبد العزيز ----------
  openLecture() {
    const A = this.g.ambient, L = LECTURES[this.S.lect % LECTURES.length];
    this.lect = { line: 0, on: false, until: this.t + 360 };
    if (!this.sheikh) this.sheikh = this.seat(A.spawn(SHEIKH_A.look, SHEIKH_AT[0], SHEIKH_AT[1], { name: SHEIKH_A.name, pose: 'sit', stool: false, seed: SHEIKH_A.seed }), SHEIKH_A);
    this.sheikh.hidden = false;
    for (const w of this.men) w.c.focus(SHEIKH_AT[0], SHEIKH_AT[1], 9999);
    const n = (this.S.lect % LECTURES.length) + 1;
    Audio.play('questNew'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2(`📖 مجلس علم بمضيف الشيخ فاتح الرفاعي: الشيخ عبد العزيز الرفاعي يحاضر عن «${L.title}» (${n}/${LECTURES.length}) — تعال اجلس واستمع`);
  }
  closeLecture(done) {
    const L = LECTURES[this.S.lect % LECTURES.length];
    if (done) { this.S.lect++; this.S.heard++; Audio.play('questDone'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2(`✔ حضرت محاضرة «${L.title}» — بلا مقابل، والأجر على الله`); }
    this.S.nextLect = this.S.playT + (done ? LECT_EVERY : 300); this.save();
    this.lect = null; if (this.sheikh) { this.sheikh.remove(); this.sheikh = null; }
    for (const w of this.men) w.c.focusT = 0;
  }
  // ---------- الأذان وصلاة الجماعة ----------
  startPrayer() {
    const g = this.g, A = g.ambient; if (this.sess) this.endSession(true);
    if (this.lect && !this.lect.on) this.closeLecture(false);
    this.S.nextPray = this.S.playT + PRAY_EVERY; this.save();
    // الأذان من منارة الجامع (تسجيل حقيقي إن وُجد بملفات التطبيق)
    const AD = window.__ADHAN; if (AD && AD.file) { try { const a = this.adhan = new window.Audio(AD.file); a.volume = Math.min(1, 0.5 * Math.max(0.4, Settings.volume)); a.play().catch(() => { }); } catch (e) { } }
    const T = g.ui && g.ui.toast2; if (T) { g.ui.toast2('🕌 المصلّون يجتمعون بمضيف الشيخ فاتح الرفاعي — تگدر تلتحق بالصلاة'); setTimeout(() => { const e = $('toast2'); if (e) e.classList.remove('on'); }, 3000); }
    // المصلّين: الجالسين يقومون، وناس يجون من السوق، والإمام يتقدّم
    for (const w of this.men) w.hidden = true;
    if (this.sheikh) { this.sheikh.remove(); this.sheikh = null; }
    const P = this.pray = { stage: 'gather', t: 0, gather: Math.min(200, Math.max(70, (AD && AD.dur || 0) + 20)), seq: null, i: -1, st: 0, me: null, ws: [] };
    P.imam = A.spawn(IMAM.look, INSIDE[0], INSIDE[1] + 1, { name: IMAM.name, sp: 1.0, seed: IMAM.seed }); P.imam.goTo(IMAM_AT[0], IMAM_AT[1], () => P.imam.face(IMAM_AT[0] + QF[0], IMAM_AT[1] + QF[1]));
    const looks = [...MAJLIS_MEN.map(m => m.look), 'citizen', 'pilgrim', 'youth'], from = [INSIDE, INSIDE, INSIDE, INSIDE, [-30, -6], [-36, 2], [-26, -14]];
    P.ws = looks.map((lk, i) => { const f = from[i], w = A.spawn(lk, f[0] - (i < 4 ? 1.5 : 0), f[1] + (i < 4 ? (i - 1.5) * 1.2 : 0), { name: i < 4 ? MAJLIS_MEN[i].name : 'مصلٍّ', sp: 1.15, seed: (i < 4 ? MAJLIS_MEN[i].seed : 960 + i) }); const s = rowSlot(i + 1); w.slot = s; w.goTo(s[0], s[1], () => w.face(s[0] + QF[0], s[1] + QF[1])); return w; });
  }
  joinPrayer() {
    const P = this.pray; if (!P || P.me) return;
    const s = rowSlot(0); P.me = { slot: s, pose: 'stand' }; // ورا الإمام مباشرة (الصف يتوزّع يمين ويسار)
    const g = this.g; g.cine = true; Input.reset(); Input.exitLock && Input.exitLock();
    const el = $('cine'); el.classList.add('on'); el.querySelector('.cimg').classList.remove('on'); el.querySelector('.cact').classList.remove('on'); el.querySelector('.cbox').onclick = null;
    el.querySelector('.cname').textContent = 'صلاة الجماعة'; el.querySelector('.ctext').textContent = P.stage === 'gather' ? '(وقفت بالصف… ننتظر الإمام يكبّر)' : '(التحقت بالصف — تابع الإمام)';
    const box = el.querySelector('.copts'); box.innerHTML = `<button class="btn" data-a="out">اخرج من الصلاة</button>`;
    box.querySelector('button').onclick = e => { e.stopPropagation(); this.leavePrayer(); };
  }
  leavePrayer() { const P = this.pray; if (!P || !P.me) return; P.me = null; this.g.cine = false; $('cine').classList.remove('on'); $('cine').querySelector('.copts').innerHTML = ''; if (!Input.isTouch) Input.requestLock && Input.requestLock(); }
  // تسلسل 4 ركعات سرّية: [الوضعية، المدّة، نداء الإمام]
  buildSeq() {
    const S = [], T = IMAM_CALLS.takbir;
    S.push(['raise', 1.8, T]);
    for (let r = 1; r <= 4; r++) {
      if (r > 1) S.push(['stand', 1.2, T]);
      S.push(['stand', r <= 2 ? 13 : 7]);
      S.push(['ruku', 4.5, T]); S.push(['stand', 3, IMAM_CALLS.rise]);
      S.push(['sujud', 4, T]); S.push(['sit', 2.6, T]); S.push(['sujud', 4, T]);
      if (r === 2) S.push(['sit', 9, T]);
      if (r === 4) S.push(['sit', 13, T]);
    }
    S.push(['salamR', 2.4, IMAM_CALLS.salam]); S.push(['salamL', 2.4, IMAM_CALLS.salam]); S.push(['sit', 3]);
    return S;
  }
  tickPrayer(dt) {
    const P = this.pray, g = this.g; P.t += dt;
    if (P.stage === 'gather') {
      // يوقفون بالصف مواجهين القبلة
      for (const w of [P.imam, ...P.ws]) if (!w.path) w.c.prayP = 'stand';
      if (P.t >= P.gather || [P.imam, ...P.ws].every(w => !w.path) && P.t > 45) { P.stage = 'pray'; P.seq = this.buildSeq(); P.i = -1; P.st = 0; }
      return;
    }
    if (P.stage === 'pray') {
      // المأمومون (وإنت) يتابعون الإمام بعد ما يكبّر بلحظة
      if (P.lagT > 0 && (P.lagT -= dt) <= 0) { P.ws.forEach(w => { w.c.prayP = P.cur; }); if (P.me) P.me.pose = P.cur; }
      if ((P.st -= dt) > 0) return;
      P.i++;
      if (P.i >= P.seq.length) { P.stage = 'done'; P.t = 0; for (const w of [P.imam, ...P.ws]) w.c.prayP = null; if (P.me) this.leavePrayer(); Audio.play('questDone'); g.ui && g.ui.toast2 && g.ui.toast2('تقبّل الله صلاتكم'); return; }
      const [pose, dur, call] = P.seq[P.i]; P.st = dur;
      if (call) this.speak(IMAM, call, P.imam);
      P.imam.c.prayP = pose;
      P.cur = pose; P.lagT = 0.5;
      if (P.me) { const el = $('cine'); el.querySelector('.ctext').textContent = call ? `الإمام: ${call}` : POSE_TXT[pose] || ''; }
      return;
    }
    if (P.stage === 'done' && P.t > 6) this.endPrayer();
  }
  endPrayer(silent) {
    const P = this.pray; if (!P) return; if (P.me) this.leavePrayer();
    if (this.adhan) { try { this.adhan.pause(); } catch (e) { } this.adhan = null; }
    for (const w of [P.imam, ...P.ws]) { w.c.prayP = null; if (silent) w.remove(); else { w.goTo(-30 + Math.random() * 16, -12 + Math.random() * 20, () => w.remove()); setTimeout(() => w.remove(), 60000); } }
    for (const w of this.men) w.hidden = false;
    this.pray = null;
  }
  // ---------- الكاميرا (جالس بالمجلس أو بالصف) ----------
  camera(dt) {
    const g = this.g, cam = g.camera;
    if (this.sess) {
      const s = this.sess, w = s.cur && s.cur.who, tx = w ? w.n.x : MEN_AT[1][0], tz = w ? w.n.z : (MEN_AT[1][1] + MEN_AT[2][1]) / 2;
      const want = new THREE.Vector3(tx, 0.82, tz);
      this.look = this.look ? this.look.lerp(want, Math.min(1, dt * 2.5)) : want.clone();
      cam.position.set(ME_SEAT[0], 0.98, ME_SEAT[1]); cam.lookAt(this.look); return true;
    }
    const P = this.pray;
    if (P && P.me) {
      const [x, z] = P.me.slot, Q = CAM[P.me.pose] || CAM.stand, k = Math.min(1, dt * 4);
      this.pc = this.pc || { y: 1.6, p: -0.15, yaw: 0 };
      this.pc.y += (Q.y - this.pc.y) * k; this.pc.p += (Q.p - this.pc.p) * k; this.pc.yaw += ((Q.yaw || 0) - this.pc.yaw) * k;
      cam.position.set(x, this.pc.y, z); cam.rotation.set(this.pc.p, QIBLA + this.pc.yaw, 0, 'YXZ'); return true;
    }
    return false;
  }
}
const CAM = { stand: { y: 1.6, p: -0.32 }, raise: { y: 1.6, p: -0.2 }, ruku: { y: 1.12, p: -1.2 }, sujud: { y: 0.34, p: -1.35 }, sit: { y: 0.92, p: -0.4 }, salamR: { y: 0.92, p: -0.2, yaw: -1.15 }, salamL: { y: 0.92, p: -0.2, yaw: 1.15 } };
const POSE_TXT = { stand: '(قيام — قراءة سرّية)', sit: '(جلوس — التشهّد)', sujud: '(سجود)', ruku: '(ركوع)' };
