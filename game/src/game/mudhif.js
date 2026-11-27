// مضيف الشيخ فاتح الرفاعي باللوبي:
// - ناس جالسين أغلب الوقت يتذاكرون 9 مواضيع فقهية (تجلس يمّهم وتسمع، تتخطّى المتكلّم، ويكمّل من وين وصلت)
// - محاضرات الشيخ عبد العزيز الرفاعي: تبقى قائمة لحد ما تحضرها، والجاية بعد 10 ثم 15 دقيقة
// - الأذان كل 15 دقيقة لعب باللوبي، والصلاة بعد ما يخلص الأذان كاملاً (ركعتين ← 3 ← 4)، تتابع الإمام بحركاتك
// - بعدها الإمام والشيخ يزورون مرقد الشيخ فاتح ويقرون الفاتحة، والناس يطلعون من الباب لبيوتهم
import * as THREE from 'three';
import { MAJLIS_MEN, MAJLIS, SHEIKH_A, IMAM, IMAM_CALLS, LECTURES, DIGGER, PILGRIM, SHRINE_TALK } from './mudhifdata.js';
import { Voices, voiceId } from '../core/voices.js';
import { lite } from '../core/voicekey.js';
import { Audio } from '../core/audio.js';
import { Settings } from '../core/settings.js';
import { Input } from '../core/input.js';

const KEY = 'rafidain.mudhif.v2';
const $ = id => document.getElementById(id);
// المضيف: الجدار الغربي x=-66، الشرقي (الباب) x=-52، الشمالي z=-18، الجنوبي z=-6
const ROOM = [-65.4, -17.4, -52.6, -6.6], DOOR_IN = [-53.4, -12], DOOR_OUT = [-50.6, -12];
const SEAT_Y = -0.24;
const MEN_AT = [[-64.95, -14.2], [-64.95, -12.9], [-64.95, -11.1], [-64.95, -9.8]], SHEIKH_AT = [-64.95, -12];
const ME_SEAT = [-64.7, -15.7];
// مرقد الشيخ فاتح: الباب الشرقي وقدّام الشبّاك
const SHRINE_OUT = [-73.6, -4], SHRINE_IN = [-76.5, -4], TOMB = [-79, -4];
// القبلة من العراق: جنوب مايل للغرب (−z شمال)
const QIBLA = Math.PI - 0.35, QF = [-Math.sin(QIBLA), -Math.cos(QIBLA)], QR = [Math.cos(QIBLA), -Math.sin(QIBLA)];
const IMAM_AT = [-58.4 + QF[0] * 2.4, -12 + QF[1] * 2.4];
const rowSlot = i => { const k = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2); return [-58.4 + QR[0] * k * 0.9, -12 + QR[1] * k * 0.9]; };
const ADHAN_EVERY = 900, LECT_GAPS = [600, 900], FIRST_LECT = 240, RAKAT = [2, 3, 4];
const FOLLOW = { ruku: '🙇 اركع', sujud: '🧎 اسجد', sit: '🪑 اجلس', stand: '🧍 قم', salamR: '↪ سلّم يميناً', salamL: '↩ سلّم يساراً', raise: '🤲 كبّر' };

export class Mudhif {
  constructor(game) {
    this.g = game; this.on = false; this.men = []; this.vis = []; this.sess = null; this.pray = null; this.lect = null; this.t = 0; this.shot = null;
    const def = { topic: 0, line: 0, lect: 0, lectN: 0, playT: 0, nextAdhan: ADHAN_EVERY, nextLect: FIRST_LECT, prayN: 0 };
    try { this.S = Object.assign(def, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { this.S = def; }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.S)); } catch (e) { } }
  get A() { return this.g.ambient; }
  get doors() { return this.g.houseDoors; }
  start() {
    if (!this.A || this.on) return; this.on = true;
    this.men = MAJLIS_MEN.map((m, i) => this.seat(this.A.spawn(m.look, MEN_AT[i][0], MEN_AT[i][1], { name: m.name, pose: 'sit', stool: false, seed: m.seed }), m));
    // زوّار يجون ويروحون
    this.vis = [0, 1].map(k => { const w = this.A.spawn(k ? 'citizen' : 'pilgrim', -40 - k * 6, -10 + k * 4, { name: 'زائر المضيف', sp: 1.1, seed: 870 + k * 11 }); w.vt = 4 + k * 20; w.vin = false; return w; });
    // الشيخ عبد العزيز گاعد بصدر المضيف (شخص واحد: يحاضر، ويصلّي بالناس، ويزور المرقد ويرجع)
    this.sheikh = this.seat(this.A.spawn(SHEIKH_A.look, SHEIKH_AT[0], SHEIKH_AT[1], { name: SHEIKH_A.name, pose: 'sit', stool: false, seed: SHEIKH_A.seed }), SHEIKH_A);
    if (this.S.lectOpen && this.S.lect < LECTURES.length) this.openLecture(true); // محاضرة ما حضرتها: تبقى قائمة
  }
  seat(w, per) { w.n.y = SEAT_Y; w.c.root.position.y = SEAT_Y; w.face(w.n.x + 1, w.n.z); w.c.per = per; w.c.name = per.name; return w; }
  stop() {
    this.endSession(true); this.endPrayer(true);
    for (const w of [...this.men, ...this.vis]) w.remove(); this.men = []; this.vis = [];
    if (this.sheikh) { this.sheikh.remove(); this.sheikh = null; } if (this.out) { this.out.remove(); this.out = null; }
    this.lect = null; this.on = false; this.save(); this.notice(null); Audio.musicMute(false);
  }
  get inside() { const me = this.g.mp; if (!me) return false; const [x0, z0, x1, z1] = ROOM; return me.pos[0] > x0 && me.pos[0] < x1 + 1.4 && me.pos[2] > z0 && me.pos[2] < z1; }
  openDoor(x, z) { const g = this.g, D = g.world.doors || []; const i = D.findIndex(d => Math.hypot(d.x - x, d.z - z) < 3); if (i >= 0 && g.sim && g.sim.setDoor) try { g.sim.setDoor(i, true); } catch (e) { } }
  // طريق بنقاط مباشرة (داخل الغرف) ثم الملاحة برّا
  route(w, pts, cb) { w.path = [[w.n.x, w.n.z], ...pts]; w.pi = 1; w.onArrive = cb || null; }
  leaveMudhif(w, then) { this.openDoor(-52.2, -12); this.route(w, [[DOOR_IN[0] - 1.2, w.n.z * 0.3 + DOOR_IN[1] * 0.7], DOOR_IN, DOOR_OUT], then); }
  goHome(w) { const d = this.doors && this.doors.pick(w.n.x, w.n.z, 6); if (d) this.doors.enter(w, d, () => w.remove()); else w.goTo(-30 + Math.random() * 20, -8 + Math.random() * 16, () => w.remove()); }
  // حچي يُسمع بس إذا اللاعب گريب (والفقاعة فوگ راس المتكلّم)
  near(x, z, r = 20) { const me = this.g.mp; return me && Math.hypot(me.pos[0] - x, me.pos[2] - z) < r; }
  talkNear(per, text, w, c) {
    const x = w ? w.n.x : c.root.position.x, z = w ? w.n.z : c.root.position.z;
    if (!this.near(x, z)) return 2.6;
    const sp = this.speak(per, text, w); try { this.g.talk && this.g.talk.bubble(w ? w.c : c, text, sp.dur); } catch (e) { }
    if (c) c.talkT = sp.dur; return sp.dur;
  }
  // الشيخ بعد الصلاة: يسلّم على الدفّان، يدخل المرقد ويسلّم على الزوّار، يقرأ الفاتحة، ثم يرجع يگعد بالمضيف
  visitShrine(w) {
    this.out = w;
    const T = (s, f) => setTimeout(() => { if (!w.dead && this.out === w) f(); }, s * 1000);
    this.leaveMudhif(w, () => w.goTo(SHRINE_OUT[0], SHRINE_OUT[1], () => {
      const dig = (this.g.civs || []).find(c => c.n.look === 'gravedigger' && c.alive && !c.away && !c.fl);
      const enter = () => {
        this.openDoor(-75.3, -4);
        this.route(w, [SHRINE_IN], () => {
          w.face(TOMB[0], TOMB[1]);
          const f = this.g.folk && this.g.folk.list.find(F => F.st === 'home' && F.c.alive);
          const d1 = this.talkNear(SHEIKH_A, SHRINE_TALK.greetPeople, w);
          T(d1 + 0.3, () => {
            const d2 = f ? this.talkNear(PILGRIM, SHRINE_TALK.people, null, f.c) : 0;
            T(d2 + 0.5, () => {
              w.c.prayP = 'dua'; // يقرأ الفاتحة (سرّاً) رافع إيديه
              T(26, () => { w.c.prayP = null; this.openDoor(-75.3, -4); this.route(w, [SHRINE_OUT], () => this.backToSeat(w)); });
            });
          });
        });
      };
      if (dig && Math.hypot(dig.n.x - w.n.x, dig.n.z - w.n.z) < 7) {
        w.face(dig.n.x, dig.n.z); dig.focus && dig.focus(w.n.x, w.n.z, 8);
        const d1 = this.talkNear(SHEIKH_A, SHRINE_TALK.greetDigger, w);
        T(d1 + 0.3, () => { const d2 = this.talkNear(DIGGER, SHRINE_TALK.digger, null, dig); T(d2 + 0.6, enter); });
      } else enter();
    }));
  }
  // يرجع للمضيف ويگعد بمكانه (نفس الشخص، ما يتكرر)
  backToSeat(w) {
    this.openDoor(-52.2, -12);
    w.goTo(DOOR_OUT[0], DOOR_OUT[1], () => this.route(w, [DOOR_IN, [-58, -12], [SHEIKH_AT[0] + 1.1, SHEIKH_AT[1]]], () => { w.remove(); if (this.out === w) this.out = null; if (this.sheikh) this.sheikh.hidden = false; }));
  }
  // ---------- تنبيه صغير أنيق ----------
  notice(o, ms = 4200) {
    let el = $('mnotice'); if (!el) { el = document.createElement('div'); el.id = 'mnotice'; document.body.appendChild(el); }
    clearTimeout(this.nT); if (!o) { el.classList.remove('on'); return; }
    el.innerHTML = `<i>${o.icon}</i><div><b>${o.title}</b><small>${o.sub}</small></div>`; el.classList.add('on');
    this.nT = setTimeout(() => el.classList.remove('on'), ms);
  }
  // ---------- كل إطار ----------
  update(dt) {
    if (!this.on) return;
    const g = this.g; this.t += dt; this.S.playT += dt;
    if ((this.saveT = (this.saveT || 0) - dt) <= 0) { this.saveT = 10; this.save(); }
    for (const w of this.vis) {
      if (w.path || this.pray || w.hidden) continue; if ((w.vt -= dt) > 0) continue; w.vin = !w.vin;
      if (w.vin) { this.openDoor(-52.2, -12); w.goTo(DOOR_OUT[0], DOOR_OUT[1], () => this.route(w, [DOOR_IN, [DOOR_IN[0] - 1.5 - Math.random() * 2, DOOR_IN[1] + (Math.random() - 0.5) * 3]], () => { w.face(MEN_AT[1][0], MEN_AT[1][1]); w.c.wave = 2.2; })); w.vt = 35 + Math.random() * 30; }
      else { this.leaveMudhif(w, () => w.goTo(-30 + Math.random() * 20, -8 + Math.random() * 16)); w.vt = 25 + Math.random() * 25; }
    }
    if (!this.lect && !this.pray && !this.out && this.S.lect < LECTURES.length && this.S.playT >= this.S.nextLect) this.openLecture(); // المحاضرات ما تتكرر
    if (!this.pray && this.S.playT >= this.S.nextAdhan && !this.sess && !g.cine) this.startAdhan();
    if (this.pray) this.tickPrayer(dt);
    if (this.sess) this.tickSession(dt);
    // الموسيقى تنطفئ مع الأذان (وترجع بعده بثانيتين) وداخل المضيف والمرقد
    const me = g.mp, P = this.pray, inShrine = me && me.pos[0] > -83.5 && me.pos[0] < -74.5 && me.pos[2] > -8.5 && me.pos[2] < 0.5;
    Audio.musicMute((P && P.t < P.adhanEnd + 2) || this.inside || inShrine || !!this.sess);
  }
  interact(me) {
    if (!this.on || this.sess || !me) return null;
    const near = (p, r) => Math.hypot(p[0] - me.pos[0], p[1] - me.pos[2]) < r;
    const P = this.pray;
    // صلاة اللاعب ملغاة (ROADMAP القسم 1): المصلّون يصلّون ويطلعون، ويبقى أهل المجلس بمكانهم
    if (P) return null;
    const lec = this.lect && !this.out, more = this.S.topic < MAJLIS.length;
    if ((lec || more) && (near(ME_SEAT, 2.6) || near([-63.6, -12], 2.4))) return { label: lec ? '📖 احضر محاضرة الشيخ' : '🪑 اجلس مع المجلس', fn: () => this.sit() };
    return null;
  }
  speak(per, text, civ) {
    const id = voiceId(per, text, false), rec = Voices.has(id), readT = Math.max(2.2, 0.9 + text.length * 0.07);
    const dur = rec ? Math.max(Voices.dur(id) + 0.3, readT * 0.7) : readT;
    let el = null;
    if (rec) el = Voices.play(id, Math.min(1, Math.max(0.6, Settings.volume) * (Settings.talk ?? 0.9) * 1.25), () => { });
    else Audio.babble([civ ? civ.n.x : this.g.camera.position.x, 1.2, civ ? civ.n.z : this.g.camera.position.z], Math.max(0.8, readT - 0.6), 1 + (per.p || 0) / 100, Math.min(1, (Settings.talk ?? 0.9) * 1.1));
    if (civ) civ.c.say ? civ.c.say(dur) : (civ.c.talkT = dur);
    return { el, dur };
  }
  // ---------- واجهة المشهد ----------
  cineOn(name, text, buttons) {
    const g = this.g; g.cine = true; Input.reset(); Input.exitLock && Input.exitLock();
    const el = $('cine'); el.classList.add('on', 'mud'); el.querySelector('.cimg').classList.remove('on'); el.querySelector('.cact').classList.remove('on');
    el.querySelector('.cbox').onclick = null;
    el.querySelector('.cname').textContent = name; el.querySelector('.ctext').textContent = lite(text);
    el.querySelector('.copts').innerHTML = buttons || '';
    return el;
  }
  cineOff() { this.g.cine = false; const el = $('cine'); el.classList.remove('on', 'mud'); el.querySelector('.copts').innerHTML = ''; for (const id of ['mfollow', 'mclose']) { const x = $(id); if (x) x.remove(); } if (!Input.isTouch) Input.requestLock && Input.requestLock(); }
  closeBtn(fn) { const b = document.createElement('button'); b.id = 'mclose'; b.textContent = '✕'; b.onclick = e => { e.stopPropagation(); Audio.play('ui'); fn(); }; $('cine').appendChild(b); }
  // ---------- الجلوس بالمجلس / المحاضرة ----------
  sit() {
    if (this.sess) return;
    const lec = !!this.lect && !this.out && !this.pray;
    if (!lec && this.S.topic >= MAJLIS.length) { this.notice({ icon: '🤍', title: 'انتهت أحاديث المجلس', sub: 'سمعتَ كلَّ أحاديث المجلس — الشيخ يُلقي محاضرةً بين حينٍ وآخر' }); return; }
    this.sess = { t: 0, wait: 1.4, cur: null, lecture: lec }; if (lec) this.lect.on = true;
    const el = this.cineOn(this.sess.lecture ? SHEIKH_A.name : 'مجلس المضيف', this.sess.lecture ? 'الحاضرون يُنصِتون…' : 'جلستَ مع الجماعة…', `<button class="btn" data-a="skip">⏭ تخطّي</button>`);
    el.querySelector('.cbox').onclick = () => this.skip();
    el.querySelector('[data-a="skip"]').onclick = e => { e.stopPropagation(); Audio.play('ui'); this.skip(); };
    this.closeBtn(() => this.endSession());
    this.shot = { t: 0, dur: 99, kind: 'wide' }; // لقطة افتتاحية عريضة
  }
  skip() { const s = this.sess; if (!s || !s.cur) return; if (s.cur.el) try { s.cur.el.pause(); } catch (e) { } s.cur = null; s.wait = 0.3; }
  endSession() {
    const s = this.sess; if (!s) return; if (s.cur && s.cur.el) try { s.cur.el.pause(); } catch (e) { }
    this.sess = null; this.cineOff(); if (this.lect) this.lect.on = false;
    this.save();
  }
  tickSession(dt) {
    const s = this.sess; s.t += dt;
    if (s.cur) { s.cur.left -= dt; if (s.cur.left > 0) return; s.cur = null; s.wait = s.gap; }
    if ((s.wait -= dt) > 0) return;
    const el = $('cine');
    if (s.lecture) {
      const L = LECTURES[this.S.lect], i = this.lect.line;
      if (!L) { this.endSession(); return; }
      if (i >= L.lines.length) { this.endSession(); this.closeLecture(true); return; }
      const sp = this.speak(SHEIKH_A, L.lines[i], this.sheikh); this.lect.line++;
      s.cur = { el: sp.el, left: sp.dur, who: this.sheikh }; s.gap = 1.1;
      el.querySelector('.cname').textContent = SHEIKH_A.name; el.querySelector('.ctext').textContent = lite(L.lines[i]);
      this.cut(this.sheikh);
      return;
    }
    const T = MAJLIS[this.S.topic];
    if (!T) { this.endSession(); this.notice({ icon: '🤍', title: 'انتهت أحاديث المجلس', sub: 'سمعتَ كلَّ أحاديث المجلس — لا تتكرّر' }); return; }
    if (this.S.line >= T.lines.length) {
      this.S.topic++; this.S.line = 0; this.save();
      if (this.S.topic >= MAJLIS.length) { this.endSession(); this.notice({ icon: '🤍', title: 'انتهت أحاديث المجلس', sub: 'سمعتَ كلَّ أحاديث المجلس — لن تتكرّر' }); return; }
      el.querySelector('.cname').textContent = ''; el.querySelector('.ctext').textContent = 'سكتوا قليلاً… والموضوع القادم «' + MAJLIS[this.S.topic].title + '»';
      s.wait = 6; this.shot = { t: 0, dur: 99, kind: 'wide' }; return;
    }
    const [k, text] = T.lines[this.S.line], per = MAJLIS_MEN[k], w = this.men[k];
    this.S.line++; this.save();
    const sp = this.speak(per, text, w);
    s.cur = { el: sp.el, left: sp.dur, who: w }; s.gap = this.S.line >= T.lines.length ? 1.5 : 1.0;
    el.querySelector('.cname').textContent = per.name; el.querySelector('.ctext').textContent = lite(text);
    for (const o of this.men) if (o !== w) o.c.focus(w.n.x, w.n.z, sp.dur + 0.5);
    this.cut(w);
  }
  // لقطة سينمائية جديدة على المتكلّم: قريبة، فوق الكتف، جانبية، أو عريضة
  cut(w) {
    const kinds = ['close', 'over', 'side', 'close', 'wide'], kind = kinds[(this.cutN = (this.cutN || 0) + 1) % kinds.length];
    this.shot = { t: 0, dur: 99, kind, who: w, side: Math.random() < 0.5 ? -1 : 1 };
  }
  // ---------- محاضرات الشيخ عبد العزيز ----------
  openLecture(quiet) {
    const L = LECTURES[this.S.lect]; if (!L) return;
    this.lect = { line: 0, on: false }; this.g.folk && this.g.folk.onLecture(); this.S.lectOpen = 1; this.save();
    for (const w of this.men) w.c.focus(SHEIKH_AT[0], SHEIKH_AT[1], 9999);
    if (!quiet) { Audio.play('questNew'); this.notice({ icon: '📜', title: 'مجلس علم في مضيف الشيخ فاتح الرفاعي', sub: `الشيخ عبد العزيز الرفاعي يتحدّث عن «${L.title}» — المجلس قائم حتى تحضره` }, 5000); }
  }
  closeLecture(done) {
    if (!done || !this.lect) return;
    const L = LECTURES[this.S.lect];
    this.S.lect++; this.S.lectOpen = 0; this.g.folk && this.g.folk.onLectureEnd();
    this.S.nextLect = this.S.playT + LECT_GAPS[this.S.lectN++ % 2]; this.save();
    Audio.play('questDone'); this.notice({ icon: '✨', title: 'تقبّل الله حضورك', sub: `ختم الشيخ مجلس «${L.title}» بالترحّم على أخيه الشيخ فاتح` });
    this.lect = null; for (const w of this.men) w.c.focusT = 0;
  }
  // ---------- الأذان وصلاة الجماعة ----------
  startAdhan() {
    this.S.nextAdhan = this.S.playT + ADHAN_EVERY; const rak = RAKAT[this.S.prayN++ % RAKAT.length]; this.save();
    const P = this.pray = { stage: 'adhan', t: 0, rak, seq: null, i: -1, st: 0, me: null, ws: [], adhanEnd: 75 };
    const AD = window.__ADHAN;
    if (AD && AD.file) { try { const a = this.adhan = Audio.track(new window.Audio(AD.file)); a.volume = Math.min(1, 0.55 * Math.max(0.4, Settings.volume)); a.onloadedmetadata = () => { if (isFinite(a.duration)) P.adhanEnd = a.duration + 2; }; a.onended = () => { P.adhanEnd = Math.min(P.adhanEnd, P.t + 2); }; a.onerror = () => { P.adhanEnd = Math.min(P.adhanEnd, 30); }; a.play().catch(() => { P.adhanEnd = Math.min(P.adhanEnd, 30); }); } catch (e) { P.adhanEnd = 30; } }
    else P.adhanEnd = 30;
    this.g.folk && this.g.folk.onAdhan();
    this.notice({ icon: '🕌', title: 'حيّ على الصلاة', sub: 'المصلّون يجتمعون في مضيف الشيخ فاتح الرفاعي ثم يتفرّقون' }, 3000);
    // الجالسين يقومون، وناس يجون من السوق، والإمام يتقدّم
    for (const w of this.men) w.hidden = true;
    if (this.sheikh) this.sheikh.hidden = true;
    this.openDoor(-52.2, -12);
    if (this.out) { this.out.remove(); this.out = null; } // إذا بعده بالمرقد: يرجع للصلاة (ما يصير شيخين)
    P.imam = this.A.spawn(SHEIKH_A.look, SHEIKH_AT[0] + 0.9, SHEIKH_AT[1], { name: SHEIKH_A.name, sp: 0.95, seed: SHEIKH_A.seed });
    this.route(P.imam, [[-60, -12], IMAM_AT], () => P.imam.face(IMAM_AT[0] + QF[0], IMAM_AT[1] + QF[1]));
    const looks = [...MAJLIS_MEN.map(m => m.look), 'citizen', 'pilgrim', 'youth'];
    P.ws = looks.map((lk, i) => {
      const mine = i < 4, s = rowSlot(i + 1);
      const w = this.A.spawn(lk, mine ? MEN_AT[i][0] + 0.8 : -36 + i * 2, mine ? MEN_AT[i][1] : -6 + i, { name: mine ? MAJLIS_MEN[i].name : 'مصلٍّ', sp: 1.1, seed: mine ? MAJLIS_MEN[i].seed : 960 + i });
      w.slot = s; w.reg = mine; w.idx = i;
      const toSlot = () => this.route(w, [[s[0] - QF[0] * 0.8, s[1] - QF[1] * 0.8], s], () => w.face(s[0] + QF[0], s[1] + QF[1]));
      if (mine) toSlot(); else w.goTo(DOOR_OUT[0], DOOR_OUT[1], () => this.route(w, [DOOR_IN], toSlot));
      return w;
    });
  }
  joinPrayer() {
    const P = this.pray; if (!P || P.me) return;
    P.me = { slot: rowSlot(0), pose: 'stand', want: null, wantT: 0 };
    this.cineOn('صلاة الجماعة', P.stage === 'pray' ? 'التحقت بالصف — تابع الإمام' : 'وقفت بالصف خلف الإمام… ينتظرون انتهاء الأذان');
    this.closeBtn(() => this.leavePrayer());
    this.shot = { t: 0, dur: 4.5, kind: 'row' }; // لقطة جانبية للصف قبل منظورك
  }
  leavePrayer() { const P = this.pray; if (!P || !P.me) return; P.me = null; this.cineOff(); }
  // يظهر زر الحركة: تابع الإمام بنفسك (ولو ما ضغطت تتبعه تلقائياً بعد لحظات)
  follow(pose) {
    const P = this.pray; if (!P || !P.me || P.me.pose === pose) return;
    P.me.want = pose; P.me.wantT = 2.6;
    let b = $('mfollow'); if (!b) { b = document.createElement('button'); b.id = 'mfollow'; $('cine').appendChild(b); }
    b.textContent = FOLLOW[pose] || 'تابع'; b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
    b.onclick = e => { e.stopPropagation(); this.doFollow(); };
  }
  doFollow() { const P = this.pray; if (!P || !P.me || !P.me.want) return; P.me.pose = P.me.want; P.me.want = null; Audio.play('ui'); const b = $('mfollow'); if (b) b.remove(); }
  buildSeq(rak) {
    const S = [], T = IMAM_CALLS.takbir;
    S.push(['stand', 15, IMAM_CALLS.iqama]); // الإقامة
    S.push(['raise', 1.8, T]);
    for (let r = 1; r <= rak; r++) {
      if (r > 1) S.push(['stand', 1.2, T]);
      S.push(['stand', r <= 2 ? 12 : 7]);
      S.push(['ruku', 4.5, T]); S.push(['stand', 3, IMAM_CALLS.rise]);
      S.push(['sujud', 4, T]); S.push(['sit', 2.6, T]); S.push(['sujud', 4, T]);
      if (r === 2 && rak > 2) S.push(['sit', 9, T]);
      if (r === rak) S.push(['sit', 13, T]);
    }
    S.push(['salamR', 2.4, IMAM_CALLS.salam]); S.push(['salamL', 2.4, IMAM_CALLS.salam]); S.push(['sit', 3]);
    return S;
  }
  tickPrayer(dt) {
    const P = this.pray; P.t += dt;
    if (P.me && P.me.want && (P.me.wantT -= dt) <= 0) this.doFollow();
    if (P.stage === 'adhan') {
      for (const w of [P.imam, ...P.ws]) if (!w.path) w.c.prayP = 'stand';
      // الصلاة تبدأ بعد ما يخلص الأذان كاملاً
      if (P.t >= P.adhanEnd) {
        P.stage = 'pray'; P.seq = this.buildSeq(P.rak); P.i = -1; P.st = 0;
        for (const w of [P.imam, ...P.ws]) if (w.path) { const s = w.slot || IMAM_AT; w.path = null; w.n.x = s[0]; w.n.z = s[1]; w.face(s[0] + QF[0], s[1] + QF[1]); w.c.prayP = 'stand'; }
        if (P.me) $('cine').querySelector('.ctext').textContent = 'أُقيمت الصلاة — تابع الإمام';
        this.g.folk && this.g.folk.onPrayStart();
      }
      return;
    }
    if (P.stage === 'pray') {
      if (P.lagT > 0 && (P.lagT -= dt) <= 0) { P.ws.forEach(w => { w.c.prayP = P.cur; }); this.g.folk && this.g.folk.setPose(P.cur); if (P.me) { if (P.i <= 1) P.me.pose = P.cur; else this.follow(P.cur); } }
      if ((P.st -= dt) > 0) return;
      P.i++;
      if (P.i >= P.seq.length) { P.stage = 'done'; P.t = 0; for (const w of [P.imam, ...P.ws]) w.c.prayP = null; if (P.me) this.leavePrayer(); this.notice({ icon: '🤍', title: 'تقبّل الله صلاتكم', sub: 'سلّم المصلّون وتفرّقوا إلى بيوتهم' }, 3500); this.disperse(); return; }
      const [pose, dur, call] = P.seq[P.i]; P.st = dur;
      // صوت الإقامة والصلاة يُسمع داخل المضيف بس
      if (call) { if (this.inside || P.me) this.speak(IMAM, call, P.imam); else P.imam.c.say && P.imam.c.say(1.2); }
      P.imam.c.prayP = pose; P.cur = pose; P.lagT = 0.5;
      if (P.me) $('cine').querySelector('.ctext').textContent = call ? `الإمام: ${call}` : (POSE_TXT[pose] || '');
      return;
    }
    if (P.stage === 'done' && P.t > 4) this.pray = null;
  }
  // بعد السلام: أهل المجلس يرجعون لأماكنهم، والباقين يطلعون من الباب لبيوتهم، والإمام يزور المرقد
  disperse() {
    const P = this.pray;
    this.g.folk && this.g.folk.onSalam(); // زوّار المرقد يسبقون الشيخ
    P.ws.forEach((w, k) => setTimeout(() => {
      if (w.dead) return;
      if (w.reg) this.route(w, [[MEN_AT[w.idx][0] + 0.8, MEN_AT[w.idx][1]]], () => { w.remove(); if (this.men[w.idx]) this.men[w.idx].hidden = false; });
      else this.leaveMudhif(w, () => this.goHome(w));
    }, 1500 + k * 900));
    setTimeout(() => { if (!P.imam.dead) this.visitShrine(P.imam); }, 2500);
  }
  endPrayer() {
    const P = this.pray; if (!P) return; if (P.me) this.leavePrayer();
    if (this.adhan) { try { this.adhan.pause(); } catch (e) { } this.adhan = null; }
    for (const w of [P.imam, ...P.ws]) { w.c.prayP = null; w.remove(); }
    for (const w of this.men) w.hidden = false; if (this.sheikh) this.sheikh.hidden = false;
    this.pray = null;
  }
  // ---------- الكاميرا السينمائية ----------
  camera(dt) {
    const cam = this.g.camera, sh = this.shot;
    if (sh) sh.t += dt;
    if (this.sess) {
      const s = this.sess, w = (sh && sh.who) || (s.cur && s.cur.who) || this.men[1];
      if (!w) return false;
      const hx = w.n.x, hz = w.n.z, look = new THREE.Vector3(hx, 0.82, hz), k = Math.min(1, (sh ? sh.t : 0) / 7), kind = sh ? sh.kind : 'seat';
      let pos;
      if (kind === 'wide') { pos = new THREE.Vector3(-57.6 - k * 1.0, 1.95 - k * 0.2, -12 + Math.sin(this.t * 0.12) * 0.5); look.set(-64.6, 0.72, -12); }
      else if (kind === 'close') pos = new THREE.Vector3(hx + 1.75 - k * 0.3, 0.95, hz + sh.side * 0.55); // دفع بطيء نحو الوجه
      else if (kind === 'over') pos = new THREE.Vector3(ME_SEAT[0] + 0.45, 1.05, ME_SEAT[1] + 0.15 + k * 0.3);
      else if (kind === 'side') pos = new THREE.Vector3(hx + 0.95, 0.9 + k * 0.05, hz + sh.side * 1.9);
      else pos = new THREE.Vector3(ME_SEAT[0], 0.98, ME_SEAT[1]);
      if (!this.cp || !sh || sh.t < 0.03) { this.cp = pos.clone(); this.cl = look.clone(); } // قطع مباشر بين اللقطات
      else { this.cp.lerp(pos, Math.min(1, dt * 3)); this.cl.lerp(look, Math.min(1, dt * 3)); }
      cam.position.copy(this.cp); cam.lookAt(this.cl); return true;
    }
    const P = this.pray;
    if (P && P.me) {
      if (sh && sh.kind === 'row' && sh.t < sh.dur) {
        const k = sh.t / sh.dur, c = rowSlot(0);
        cam.position.set(c[0] + QR[0] * (4.2 - k * 1.2) - QF[0] * 1.2, 1.7 - k * 0.2, c[1] + QR[1] * (4.2 - k * 1.2) - QF[1] * 1.2);
        cam.lookAt(IMAM_AT[0] - QR[0] * 0.5, 0.9, IMAM_AT[1] - QR[1] * 0.5); return true;
      }
      const [x, z] = P.me.slot, Q = CAM[P.me.pose] || CAM.stand, k = Math.min(1, dt * 3.5);
      this.pc = this.pc || { y: 1.6, p: -0.3, yaw: 0, f: 0 };
      this.pc.y += (Q.y - this.pc.y) * k; this.pc.p += (Q.p - this.pc.p) * k; this.pc.yaw += ((Q.yaw || 0) - this.pc.yaw) * k; this.pc.f += ((Q.f || 0) - this.pc.f) * k;
      cam.position.set(x + QF[0] * this.pc.f, this.pc.y, z + QF[1] * this.pc.f); cam.rotation.set(this.pc.p, QIBLA + this.pc.yaw, 0, 'YXZ'); return true;
    }
    return false;
  }
}
const CAM = { stand: { y: 1.6, p: -0.3 }, raise: { y: 1.6, p: -0.15 }, ruku: { y: 1.15, p: -1.15, f: 0.25 }, sujud: { y: 0.36, p: -1.3, f: 0.55 }, sit: { y: 0.92, p: -0.35 }, salamR: { y: 0.92, p: -0.15, yaw: -1.2 }, salamL: { y: 0.92, p: -0.15, yaw: 1.2 } };
const POSE_TXT = { stand: 'قيام — قراءة سرّية', sit: 'جلوس — التشهّد', sujud: 'سجود', ruku: 'ركوع' };
