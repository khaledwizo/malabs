// مدير المهام باللوبي: عرض مهمة وحدة (نقطة خضراء)، حوارات سينمائية قصيرة، خطوات بعلامات طريق، عدّاد وقت، ومكافأة بالدينار
import * as THREE from 'three';
import { QUESTS, FISHER_MEET, FISHER, NURSERY, FLOWER_THANKS, FLOWER_PRICE, FIGHTERS } from './questdata.js';
import { CAST } from './introdata.js';
import { CharModel } from './chars.js';
import { Economy, fmtIQD, r250 } from './economy.js';
import { Settings } from '../core/settings.js';
import { Audio } from '../core/audio.js';
import { Voices, voiceId } from '../core/voices.js';
import { lite } from '../core/voicekey.js';
import { Input } from '../core/input.js';
import { MiniGame } from './minigame.js';
import { BAKER } from './questdata.js';
import { makeItem, ITEM_ICON } from './items.js';

const KEY = 'rafidain.quests.v1';
const load = () => { try { return Object.assign({ done: {}, met: {} }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { done: {}, met: {} }; } };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const FIGHTERS_AT = [1.6, 21.2]; // باب السوق الجنوبي يمّ الشريعة

export class Quests {
  constructor(game) {
    this.g = game; this.S = load(); this.on = false; this.offer = null; this.act = null; this.cine = null; this.cd = {}; this.offerT = 4; this.flower = 0; this.t = 0;
    this.giverMark = this.mkGiverMark();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.S)); } catch (e) { } }
  mkGiverMark() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#39e26a'; x.strokeStyle = '#0b3a18'; x.lineWidth = 8; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.fill(); x.stroke();
    x.fillStyle = '#fff'; x.font = '900 80px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, fog: false })); s.scale.set(0.55, 0.55, 1); s.renderOrder = 9; s.visible = false; this.g.scene.add(s); return s;
  }
  start() {
    this.buildGraves(); this.on = true; this.offer = null; this.act = null; this.cine = null; this.offerT = 3; this.fighters = null; this.lastId = this.S.lastId; this.lastPos = this.S.lastPos;
    // رجعت للوبي: تكمّل المهمة اللي طلعت وهي بالنص من نفس الخطوة
    const C = this.S.cur; const q0 = C && QUESTS.find(q => q.id === C.id);
    if (q0) { const q = q0.vars ? { ...this.expandVi(q0, C.vi) } : q0; this.act = { q, i: Math.min(C.i, q.steps.length - 1), left: Math.max(60, C.left), item: C.item || null, extra: C.extra || 0 }; if (q.spawn === 'fighters') setTimeout(() => this.spawnFighters(), 500); const pv = q.steps[this.act.i - 1]; if (pv && pv.carry && q.steps[this.act.i].give) this.startCarry(pv.carry, true); setTimeout(() => this.g.ui && this.g.ui.toast2 && this.g.ui.toast2('تابِع مهمّتك: ' + q.title), 1500); }
    this.updateHud();
  }
  // نحفظ المهمة الجارية حتى ترجع تكمّلها
  saveCur() { const A = this.act; this.S.cur = A ? { id: A.q.id, vi: A.q.vi, i: A.i, left: Math.round(A.left), item: A.item, extra: A.extra } : null; this.S.lastId = this.lastId; this.S.lastPos = this.lastPos; this.save(); }
  expandVi(q, vi) { const save = this.varK; this.varK = (vi ?? 0) - (this.S.done[q.id] || 0) - 1; const r = this.expand(q); this.varK = save; return r; }
  stop() { this.saveCur(); this.dropTargets(); this.dropHits(); this.kc = null; this.stab = 0; this.endCine(true); if (this.mg) { this.mg.close(); this.mg = this.g.mg = null; } this.dropCarry(); if (this.findMesh) this.findMesh.visible = false; this.on = false; this.offer = null; this.act = null; this.giverMark.visible = false; this.g.wps && this.g.wps.clearQuest(); this.dropFighters(); this.updateHud(); }
  // ---------- من هو؟ ----------
  civ(who, q) {
    q = q || (this.act && this.act.q) || this.offer;
    if (who === 'g') who = q && q.giver;
    if (who === 't') return this.hitCur ? this.hitCur.c : null; // المطلوب بالاغتيال
    if (typeof who === 'string' && who[0] === 'f') { const F = this.fighters; return F ? F[+who[1]].c : null; }
    if (who === 'n') { const st = this.act && this.act.q === q && this.act.q.steps[this.act.i]; who = st ? (st.to === 'g' ? q.giver : st.to === 'fighters' ? 'f2' : st.to) : q && q.giver; if (typeof who === 'string' && who[0] === 'f') return this.civ(who, q); }
    return typeof who === 'number' ? this.g.civs[who] : null;
  }
  persona(who, q) {
    if (who === 'me') { const ch = (this.g.mp && this.g.mp.char) || Settings.char; return CAST[ch] || CAST.khaled; }
    if (typeof who === 'string' && who[0] === 'f') return FIGHTERS[+who[1]];
    if (who === 't') return (this.hitCur && this.hitCur.tg.per) || { name: '', v: 'b', p: 0, r: 0 };
    const c = this.civ(who, q); return c && c.per ? c.per : { name: c ? c.name : '', v: 'b', p: 0, r: 0 };
  }
  posOf(to, q) {
    if (to === 'g') to = q.giver;
    if (to === 'fighters' || (typeof to === 'string' && to[0] === 'f')) { const F = this.fighters; if (!F) return null; const w = F[2] || F[0]; return [w.n.x, w.n.z]; }
    if (typeof to === 'number') { const c = this.g.civs[to]; return c ? [c.n.x, c.n.z] : null; }
    return to ? [to.x, to.z] : null;
  }
  // ---------- اختيار المهمة المتاحة ----------
  available(q) {
    if (this.cd[q.id] > this.t) return false;
    if (q.cool && this.coolUntil && this.coolUntil[q.id] > this.t) return false;
    if (!q.repeat && this.S.done[q.id]) return false;
    if (q.req && !this.S.done[q.req]) return false;
    if (typeof q.giver === 'number') { const c = this.g.civs[q.giver]; if (!c || !c.here) return false; }
    return true;
  }
  // مهمة الخبّاز: كل مرّة طلب مختلف ومن زبون مختلف
  expand(q) {
    if (!q.vars) return q;
    const vi = ((this.S.done[q.id] || 0) + (this.varK = (this.varK || 0) + 1)) % q.vars.length, v = q.vars[vi];
    return { ...q, vi, giver: v.giver, title: 'طلبية: ' + v.item, reward: v.price, intro: v.intro,
      steps: [{ to: BAKER, label: 'أحضِر ' + v.item + ' من أبي رسول', say: v.say, pay: v.price, mg: { type: 'scoop', title: v.item, n: 3, color: v.color, bag: 0xe8dcc8, tip: 'ضَع ' + v.item + ' في الكيس' }, item: v.item },
        { to: 'g', label: 'أوصِل ' + v.item, say: v.back }],
      outro: [['g', 'هذا ثمنُه وهذهِ مكافأتُك، حفظَكَ الله.']] };
  }
  // مكان صاحب المهمة (للتباعد)
  giverPos(q) { if (typeof q.giver === 'number') { const c = this.g.civs[q.giver]; return c ? [c.n.x, c.n.z] : null; } return null; }
  pickOffer() {
    const L = QUESTS.filter(q => this.available(q)); if (!L.length) return null;
    // تباعد: لا نفس الشخص ولا نفس المكان (أقل من 18م) ورا بعض، والمكرّرة (الخبّاز) قليلة
    const lp = this.lastPos, far = q => { const p = this.giverPos(q); return !lp || !p || Math.hypot(p[0] - lp[0], p[1] - lp[1]) > 18; };
    let P = L.filter(q => q.id !== this.lastId && far(q));
    const fresh = P.filter(q => !q.repeat);
    if (fresh.length) P = fresh; else if (!P.length) P = L.filter(q => q.id !== this.lastId);
    if (!P.length) return null;
    // غير المكرّرة بالترتيب (القصّة)، أو عشوائي
    return this.expand(fresh.length ? P[0] : P[Math.floor(Math.random() * P.length)]);
  }
  setOffer(q) {
    this.offer = q; if (!q) return;
    if (q.spawn === 'fighters') this.spawnFighters();
    Audio.play('questNew'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2('مهمّة جديدة: ' + q.title + ' — النقطة الخضراء على الخريطة');
  }
  spawnFighters() {
    if (this.fighters) return; const A = this.g.ambient; if (!A || !A.on) return;
    this.fighters = FIGHTERS.map((f, i) => { const w = A.spawn(f.look, FIGHTERS_AT[0] + (i % 3) * 0.9 - 0.9, FIGHTERS_AT[1] + Math.floor(i / 3) * 1.0, { name: f.name, sp: 1.6, seed: 400 + i * 17 }); w.face(0, 0); w.fi = i; w.c.per = f; return w; });
  }
  dropFighters() { if (this.fighters) { for (const w of this.fighters) w.remove(); this.fighters = null; } }
  // ---------- كل إطار ----------
  update(dt) {
    this.tickHand(dt); this.tickKnife(dt);
    if (!this.on) return;
    this.t += dt; const g = this.g, me = g.mp;
    if (this.cine) this.tickCine(dt);
    if (this.mg) { this.mg.update(dt); if (this.mg.closed) this.mg = null; g.mg = this.mg; }
    // أبو حيدر الصيّاد: إذا وگفت يمّه شوية، هو يفتح السالفة بنفسه
    { const fc = g.civs[FISHER]; if (fc && fc.here && !this.S.met.fisher && !this.cine && !this.mg && me && Math.hypot(fc.n.x - me.pos[0], fc.n.z - me.pos[2]) < 3.4) { this.fisherT = (this.fisherT || 0) + dt; if (this.fisherT > 2.5) { this.fisherT = 0; this.meetFisher(); } } else this.fisherT = 0; }
    // عرض مهمة جديدة بعد شوية
    if (!this.offer && !this.act && !this.cine && !this.mg && (this.offerT -= dt) <= 0) { this.offerT = 6; this.setOffer(this.pickOffer()); }
    if (this.act && (this.saveT = (this.saveT || 0) - dt) <= 0) { this.saveT = 5; this.saveCur(); }
    if (this.offer && typeof this.offer.giver === 'number' && !this.civ('g', this.offer).here) this.offer = null;
    // علامة «!» الخضراء فوق صاحب المهمة
    const gp = this.offer && !this.cine && !this.mg ? this.posOf('g', this.offer) : null, gc = this.offer ? this.civ('g', this.offer) : null;
    this.giverMark.visible = !!gp; if (gp) this.giverMark.position.set(gp[0], (gc && gc.sit ? 1.75 : 2.3) + Math.sin(this.t * 3) * 0.08, gp[1]);
    // المهمة الجارية: الوقت، علامة الخطوة، والوصول
    const A = this.act;
    if (A && A.q.steps[A.i]) {
      A.left -= this.cine || this.mg ? 0 : dt;
      if (A.left <= 0) { this.fail('انتهى الوقت!'); }
      else {
        const st = A.q.steps[A.i], p = this.posOf(st.to, A.q);
        const tp = st.kill ? this.targetPos() : (st.hit || st.confront) ? this.hitPos(st) : null, pp = tp || p;
        if (pp) g.wps.setQuestPos ? g.wps.setQuestPos(pp[0], pp[1], st.label) : (g.wps.quest = { x: pp[0], z: pp[1], label: st.label });
        // الجماعة تمشي وراك
        if (this.fighters && st.escort && me) this.fighters.forEach((w, i) => { const d = Math.hypot(w.n.x - me.pos[0], w.n.z - me.pos[2]); if (d > 3.2 + i * 0.5 && (!w.path || (w.reT = (w.reT || 0) - dt) <= 0)) { w.reT = 0.8; const a = i / 5 * Math.PI * 2; w.goTo(me.pos[0] + Math.cos(a) * 1.6, me.pos[2] + Math.sin(a) * 1.6); } });
        // غرض مخفي: توصل للمنطقة وتدوّره بعينك (يلمع شوية)
        if (st.hit || st.confront) this.updateHit(st, dt, me);
        else if (st.kill) this.updateTargets(st, dt, p);
        else if (st.find && me && !A.picked) { this.findObj(st.find); this.findMesh.visible = true; this.findMesh.rotation.y += dt; const near = Math.hypot(st.find.x - me.pos[0], st.find.z - me.pos[2]); if (p && Math.hypot(p[0] - me.pos[0], p[1] - me.pos[2]) < 7) g.wps.quest = null; this.findNear = near < 1.9; }
        else if (me && p && !this.cine && !this.mg && Math.hypot(p[0] - me.pos[0], p[1] - me.pos[2]) < (typeof st.to === 'object' ? 2.0 : 2.6)) this.runStep();
      }
    }
    this.updateHud();
  }
  // ---------- زر «استعمال/تكلّم» ----------
  // يرجع { label, fn } لأقرب شي تگدر تسوّيه وياه (أو null)
  interact() {
    if (!this.on || this.cine || this.mg) return null;
    const g = this.g, me = g.mp; if (!me || !me.alive) return null;
    const near = (p, r) => p && Math.hypot(p[0] - me.pos[0], p[1] - me.pos[2]) < r;
    if (this.offer && !this.act && near(this.posOf('g', this.offer), 3.0)) return { label: 'تحدَّث', fn: () => this.openOffer() };
    if (this.act && this.act.q.steps[this.act.i].find && this.findNear) return { label: (ITEM_ICON[this.act.q.steps[this.act.i].find.kind || 'bag'] || '👜') + ' ' + this.act.q.steps[this.act.i].find.label, fn: () => { const A = this.act, st = A.q.steps[A.i]; this.findMesh.visible = false; A.picked = true; this.findNear = false; if (st.carry) { this.startCarry(st.carry, true); Audio.play('ui'); } this.runStep(); } };
    // اغتيال: أول ما تقترب من المطلوب (بدون سلاح — كاتسين بالسكين)
    if (this.hitNear && this.hitNear.c.alive && !this.kc) { const w = this.hitNear; return { label: '🗡 اغتيال ' + w.tg.name, fn: () => this.startHit(w) }; }
    // أبو حيدر: أول لقاء
    const fc = g.civs[FISHER]; if (fc && fc.here && !this.S.met.fisher && !(this.offer && this.offer.giver === FISHER) && near([fc.n.x, fc.n.z], 3)) return { label: 'تحدَّث', fn: () => this.meetFisher() };
    // المشتل: شراء وردة
    const nc = g.civs[NURSERY]; if (nc && nc.here && near([nc.n.x, nc.n.z], 2.8) && !(this.offer && this.offer.giver === NURSERY && !this.act)) return { label: '🌹 وردة', fn: () => this.nurseryMenu() };
    // إهداء الوردة لأقرب شخص
    if (this.flower > 0) { let b = null, bd = 2.6; g.civs.forEach((c, i) => { if (!c.here || i === NURSERY || c.n.pose === 'pray') return; const d = Math.hypot(c.n.x - me.pos[0], c.n.z - me.pos[2]); if (d < bd) { bd = d; b = c; } }); if (b) return { label: '🌹 أهدِ وردة', fn: () => this.giveFlower(b) }; }
    return null;
  }
  // ---------- الحوار السينمائي ----------
  // lines: [[who, text]...] ؛ opt: { q, choices:[{label, fn}], act, quiz, after }
  play(lines, opt = {}) {
    const g = this.g; this.endCine(true);
    const C = this.cine = { lines: lines.slice(), i: -1, t: 0, dur: 0, opt, q: opt.q || (this.act && this.act.q) || this.offer, stage: 'lines' };
    g.cine = true; Input.reset(); Input.exitLock && Input.exitLock();
    const el = $('cine'); el.classList.add('on'); el.querySelector('.cbox').onclick = () => this.skipLine();
    // نموذج اللاعب يظهر بالمشهد
    const me = g.mp; if (me) { if (!this.meModel || this.meModel.id !== me.char) { if (this.meModel) g.scene.remove(this.meModel.root); this.meModel = new CharModel(me.char || 'khaled', me.team); this.meModel.setWeapon(null); g.scene.add(this.meModel.root); } this.meModel.root.visible = true; this.meModel.root.position.set(me.pos[0], me.pos[1], me.pos[2]); }
    this.camP = null; this.next();
  }
  skipLine() { const C = this.cine; if (!C || C.stage !== 'lines') return; if (C.t > 0.7) { if (C.el) try { C.el.pause(); } catch (e) { } this.next(); } }
  next() {
    const C = this.cine; if (!C) return;
    C.i++;
    if (C.i >= C.lines.length) { this.afterLines(); return; }
    const [who, text] = C.lines[C.i], per = this.persona(who, C.q), c = who === 'me' ? null : this.civ(who, C.q);
    C.who = who; C.c = c; C.t = 0;
    const stage = text[0] === '(', id = voiceId(per, text, false), rec = !stage && Voices.has(id);
    // وقت القراءة: حتى لو الصوت أقصر، الترجمة تبقى وقت كافي تنقرى
    const readT = stage ? 1.6 : Math.max(2.2, 0.9 + text.length * 0.075);
    C.readT = readT; C.voiceDone = false; C.failed = false;
    C.dur = rec ? Math.max(Voices.dur(id) + 0.4, readT * 0.75) : readT;
    const babble = () => { const p = c ? [c.n.x, c.n.y + 1.5, c.n.z] : null; Audio.babble(p || [this.g.camera.position.x, this.g.camera.position.y, this.g.camera.position.z], Math.max(0.8, readT - 0.6), 1 + (per.p || 0) / 100, Math.min(1, (Settings.talk ?? 0.9) * 1.1)); };
    const line = C.i;
    // إذا الملف الصوتي فشل بسرعة: نرجع لوقت القراءة والهمهمة (حتى ما يطفر السطر)
    C.el = rec ? Voices.play(id, Math.min(1, Math.max(0.6, Settings.volume) * (Settings.talk ?? 0.9) * 1.25), () => { if (this.cine !== C || C.i !== line) return; if (C.t < 0.4) { C.failed = true; C.dur = readT; babble(); } else { C.voiceDone = true; C.vEnd = C.t; } }) : null;
    if (!rec && !stage) babble();
    const me = this.g.mp;
    if (c) { c.say(C.dur); if (me) c.focus(me.pos[0], me.pos[2], C.dur + 1); }
    const el = $('cine'); el.querySelector('.cname').textContent = per.name || ''; el.querySelector('.ctext').textContent = lite(text); el.querySelector('.cname').classList.toggle('me', who === 'me');
    el.querySelector('.copts').innerHTML = ''; el.querySelector('.cact').classList.remove('on');
    const im = el.querySelector('.cimg'); if (C.opt.img) { im.src = C.opt.img; im.classList.add('on'); } else im.classList.remove('on');
  }
  afterLines() {
    const C = this.cine, o = C.opt;
    if (C.resumeQuiz) { C.resumeQuiz = false; C.stage = 'quiz'; this.showQuiz(); return; }
    if (o.act && C.stage === 'lines') { C.stage = 'act'; C.t = 0; const el = $('cine').querySelector('.cact'); el.classList.add('on'); el.querySelector('i').textContent = o.act.icon || '⏳'; el.querySelector('b').textContent = o.act.label; $('cine').querySelector('.ctext').textContent = o.act.label + '…'; $('cine').querySelector('.cname').textContent = ''; return; }
    if (o.quiz && C.stage !== 'quiz') { C.stage = 'quiz'; C.qi = 0; C.score = 0; this.showQuiz(); return; }
    if (o.choices && C.stage !== 'choose') { C.stage = 'choose'; this.showChoices(o.prompt || '', o.choices); return; }
    if (o.after && o.after.length && C.stage !== 'after') { C.stage = 'lines'; C.lines = o.after; C.i = -1; o.after = null; o.act = null; this.next(); return; }
    const cb = o.done; this.endCine(); cb && cb(C);
  }
  showChoices(prompt, ch) {
    const el = $('cine'); if (prompt) { el.querySelector('.ctext').textContent = prompt; el.querySelector('.cname').textContent = ''; }
    const box = el.querySelector('.copts'); box.innerHTML = ch.map((c, i) => `<button class="btn ${i ? '' : 'primary'}" data-i="${i}">${esc(c.label)}</button>`).join('');
    box.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); Audio.play('ui'); const c = ch[+b.dataset.i]; box.innerHTML = ''; c.fn && c.fn(); });
  }
  showQuiz() {
    const C = this.cine, Q = C.opt.quiz[C.qi]; if (!Q) { this.cine.stage = 'quizDone'; C.opt.quizScore = C.score; C.opt.quiz = null; this.afterLines(); return; }
    const per = this.persona('g', C.q), el = $('cine'); el.querySelector('.cname').textContent = per.name; el.querySelector('.ctext').textContent = lite(Q.q.replace(/^[^:]+:\s*/, ''));
    this.showChoices('', Q.opts.map((t, i) => ({ label: t, fn: () => { const ok = i === Q.a; if (ok) C.score++; C.qi++; C.stage = 'lines'; C.lines = [['me', t], ['g', ok ? Q.ok : Q.no]]; C.i = -1; C.resumeQuiz = true; this.next(); } })));
  }
  tickCine(dt) {
    const C = this.cine; C.t += dt;
    if (C.stage === 'lines') {
      const voiced = C.el && !C.failed;
      if (voiced ? (C.voiceDone ? C.t > Math.max(C.vEnd + 0.35, C.readT * 0.75) : C.t > C.dur + 3) : C.t > C.dur) {
        this.next();
      }
    } else if (C.stage === 'act') {
      const A = C.opt.act, k = Math.min(1, C.t / A.t); $('cine').querySelector('.cact em').style.setProperty('--p', (k * 100).toFixed(1) + '%');
      const c = A.me ? null : this.civ('n', C.q); if (c && Math.random() < dt * 2) c.say(0.8);
      if (k >= 1) { C.stage = 'actDone'; Audio.play('ui'); $('cine').querySelector('.cact').classList.remove('on'); this.afterLines(); }
    }
  }
  endCine(silent) {
    const C = this.cine; if (!C) return;
    if (C.el) try { C.el.pause(); } catch (e) { }
    this.cine = null; this.g.cine = false; $('cine').classList.remove('on');
    if (this.meModel) this.meModel.root.visible = false;
    if (!silent && !Input.isTouch) Input.requestLock && Input.requestLock();
  }
  // الكاميرا السينمائية: لقطة فوق الكتف نحو المتكلّم، أو لقطة جانبية للاثنين
  camera(dt) {
    if (this.kc && this.g.mp) return this.knifeCam();
    const C = this.cine, g = this.g, me = g.mp; if (!C || !me) return false;
    const cam = g.camera, W = g.world;
    const st = this.act && this.act.q === C.q ? C.q.steps[this.act.i] : null;
    const other = C.c || (st && typeof st.to === 'object' ? null : this.civ('n', C.q));
    const mx = me.pos[0], mz = me.pos[2];
    const gy = me.pos[1] || 0, ox = other ? other.n.x : mx - Math.sin(g.yaw) * 2, oz = other ? other.n.z : mz - Math.cos(g.yaw) * 2, oy = (other ? (other.n.y || 0) + (other.sit ? 1.15 : 1.6) : gy + 1.6); // الارتفاع: سطح، طابق ثاني…
    // نموذج اللاعب يواجه المتكلّم
    const M = this.meModel; if (M) { const yaw = Math.atan2(-(ox - mx), -(oz - mz)); M.root.position.set(mx, me.pos[1], mz); const crouch = C.stage === 'act' && C.opt.act && C.opt.act.me ? 1 : 0; M.update({ yaw, pitch: crouch ? -0.5 : 0, speed: 0, vx: 0, vz: 0, crouch, lean: 0, hurt: 9, onGround: true, alive: true, ads: 0, prot: false, reloading: false, fireT: 0 }, dt); }
    let dx = ox - mx, dz = oz - mz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const rx = -dz, rz = dx, meSpeak = C.who === 'me';
    // فوق الكتف: خلف اللي يسمع، ينظر للي يحچي
    const [ax, az, ay, bx, bz, by] = meSpeak ? [ox, oz, oy, mx, mz, gy + 1.62] : [mx, mz, gy + 1.62, ox, oz, oy];
    const fx = meSpeak ? -dx : dx, fz = meSpeak ? -dz : dz;
    const sd = meSpeak ? -1 : 1, cx0 = (mx + ox) / 2, cz0 = (mz + oz) / 2;
    // مرشّحات اللقطة بالترتيب: فوق الكتف، فوق الكتف الثاني، جانبية يمين/يسار، ومن عين اللاعب
    const cands = [[ax - fx * 1.35 + rx * 0.62 * sd, ay + 0.2, az - fz * 1.35 + rz * 0.62 * sd], [ax - fx * 1.35 - rx * 0.62 * sd, ay + 0.2, az - fz * 1.35 - rz * 0.62 * sd], [cx0 + rx * 2.4, gy + 1.7, cz0 + rz * 2.4], [cx0 - rx * 2.4, gy + 1.7, cz0 - rz * 2.4], [mx - dx * 0.5, gy + 1.85, mz - dz * 0.5]];
    const okCam = ([x, y, z]) => !W.overlap(x, y - 0.25, z, 0.22, 0.5) && W.los(bx, by, bz, x + (x - bx) * 0.15, y, z + (z - bz) * 0.15) && W.los(cx0, gy + 1.5, cz0, x, y, z);
    let [px, py, pz] = cands.find(okCam) || cands[cands.length - 1];
    // أثناء الفعل (تعبئة، عجن، دفن…): الكاميرا تدور ببطء حول المشهد
    if (C.stage === 'act') { C.orb = (C.orb ?? Math.atan2(pz - cz0, px - cx0)) + dt * 0.3; const R0 = 2.3; const ox2 = cx0 + Math.cos(C.orb) * R0, oz2 = cz0 + Math.sin(C.orb) * R0; if (okCam([ox2, gy + 1.55, oz2])) { px = ox2; py = gy + 1.55; pz = oz2; } }
    if (cands.indexOf([px, py, pz]) < 0 && px === cands[4][0]) { /* من عين اللاعب */ }
    const tgt = C.stage === 'act' ? new THREE.Vector3(cx0, gy + 1.0, cz0) : new THREE.Vector3(bx, by, bz);
    if (!this.camP) { this.camP = new THREE.Vector3(px, py, pz); this.camL = tgt.clone(); }
    const k = Math.min(1, dt * 3.2); this.camP.lerp(new THREE.Vector3(px, py, pz), k); this.camL.lerp(tgt, k);
    cam.position.copy(this.camP); cam.lookAt(this.camL);
    return true;
  }
  // ---------- عرض المهمة ----------
  openOffer() {
    const q = this.offer; if (!q) return;
    const lines = (q.meet && !this.S.met.fisher && q.giver === FISHER) ? [...FISHER_MEET.map(([w, t]) => [w === 'n' ? 'g' : w, t]), ...q.intro] : q.intro;
    if (q.giver === FISHER) { this.S.met.fisher = 1; this.save(); }
    this.play(lines, { q, choices: [
      { label: 'أقبل المهمّة ✔', fn: () => { this.endCine(); this.accept(q); } },
      { label: 'ليس الآن', fn: () => { this.endCine(); this.ignore(q); } },
    ], prompt: `${q.title} · الوقت ${Math.round(q.time / 60)} دقائق · المكافأة ${fmtIQD(r250((q.reward || 0) + (q.tip || 0)))}` });
  }
  meetFisher() { this.S.met.fisher = 1; this.save(); this.play(FISHER_MEET, { q: { giver: FISHER } }); }
  accept(q) {
    this.offer = null; this.lastId = q.id; this.giverMark.visible = false;
    this.act = { q, i: 0, left: q.time, item: null, extra: 0 }; this.saveCur();
    Audio.play('questNew'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2('بدأت المهمّة: ' + q.title);
  }
  ignore(q) { this.cd[q.id] = this.t + 180; this.offer = null; this.offerT = 6; this.lastId = q.id; this.lastPos = this.giverPos(q) || this.lastPos; if (q.spawn === 'fighters') this.dropFighters(); }
  fail(why) {
    const q = this.act.q; this.act = null; this.saveCur(); this.dropTargets(); this.dropHits(); this.kc = null; this.stab = 0; this.dropCarry(); if (this.mg) { this.mg.close(); this.mg = this.g.mg = null; } if (this.findMesh) this.findMesh.visible = false; this.lastPos = this.giverPos(q) || this.lastPos; this.g.wps.clearQuest(); this.cd[q.id] = this.t + 90; this.offerT = 6; this.endCine(true);
    if (q.spawn === 'fighters') this.dropFighters();
    Audio.play('questFail'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2(`فشلت المهمّة «${q.title}» — ${why} ستُعرَض عليك لاحقاً.`);
  }
  runStep() {
    const A = this.act, q = A.q, st = q.steps[A.i];
    // التسلسل: حوار الوصول ← اللعبة اللي تسوّيها بإيدك ← حوار بعدها ← الخطوة الجاية
    const afterMg = res => {
      if (st.grave) this.addGrave(st.grave);
      if (st.after && st.after.length) this.play(st.after.slice(), { q, img: res && res.photo, done: C => this.stepDone(C) }); else this.stepDone();
    };
    const startMg = () => {
      if (this.carry) this.dropCarry();
      const def = { ...st.mg }; if (def.type === 'photo') { const c = this.civ('g', q); def.target = { x: c.n.x, y: 1.55, z: c.n.z }; def.bg = { x: 30, y: 20, z: 104 }; c.focus(this.g.mp.pos[0], this.g.mp.pos[2], 60); }
      this.mg = this.g.mg = new MiniGame(this.g, def, afterMg);
    };
    const opt = { q, act: st.act, after: st.mg ? null : (st.after ? st.after.slice() : null), quiz: st.quiz, done: C => { if (st.mg) startMg(); else this.stepDone(C); } };
    let lines = (st.say || []).slice();
    if (st.pay) { if (Economy.spend(st.pay)) lines.push(['me', `(دفعتَ ${fmtIQD(st.pay)})`]); else lines.push([typeof st.to === 'number' ? 'n' : 'me', typeof st.to === 'number' ? 'ليسَ معكَ مالٌ الآن؟ خُذْ وادفَعْ لاحقاً، نحنُ أهل.' : '(ليسَ معي مال... سأدفعُ للوكيلِ لاحقاً)']); }
    if (!lines.length) lines.push(['me', '(...)']);
    if (st.give) this.handOver(st.give, this.civ('g', q));
    if (st.choose) { opt.prompt = st.choose.prompt; opt.choices = st.choose.opts.map(o => ({ label: `${o.label} — ${fmtIQD(o.price)}`, fn: () => { A.choice = o; A.extra = r250(25000 - o.price); A.item = o.item; this.cine.opt.choices = null; this.cine.lines = [['me', 'هذا ' + o.label + '.'], ['n', 'اختيارٌ موفَّق! تفضَّل.']]; this.cine.i = -1; this.cine.stage = 'lines'; this.next(); } })); }
    this.play(lines, opt);
  }
  stepDone(C) {
    const A = this.act; if (!A) return; const q = A.q, st = q.steps[A.i];
    if (st.item) A.item = st.item; if (C && C.opt && C.opt.quizScore !== undefined) A.quiz = C.opt.quizScore;
    if (st.carry) this.startCarry(st.carry, this.carry === st.carry);
    A.picked = false; A.i++; this.g.wps.clearQuest(); this.dropTargets(true); this.saveCur();
    if (A.i >= q.steps.length) this.finish();
    else Audio.play('ui');
  }
  finish() {
    const A = this.act, q = A.q; this.dropCarry(); this.lastPos = this.giverPos(q) || this.lastPos; if (q.cool) { this.coolUntil = this.coolUntil || {}; this.coolUntil[q.id] = this.t + q.cool; } let amt = (q.reward || 0) + (q.tip || 0) + (A.extra || 0);
    if (q.id === 'tourist' && A.quiz !== undefined) amt = A.quiz >= 2 ? amt : A.quiz === 1 ? r250(amt * 0.6) : r250(amt * 0.35);
    this.play(q.outro, { q, done: () => {
      const got = Economy.earn(amt); this.S.done[q.id] = (this.S.done[q.id] || 0) + 1; this.save();
      this.act = null; this.saveCur(); this.offerT = 6; if (q.spawn === 'fighters') { const F = this.fighters; this.fighters = null; if (F) F.forEach((w, i) => { w.stroll = true; w.wait = 3 + i; setTimeout(() => w.remove(), 60000); }); }
      Audio.play('questDone'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2(`✔ ${q.title} — استلمتَ ${fmtIQD(got)}`);
    } });
  }
  // ---------- المواجهة على السطح: حوار، وإذا ما تراجع تصفية بالسكين ----------
  // ---------- الاغتيال السينمائي (ماكو سلاح باللوبي: كل تصفية تصير كاتسين بالسكين) ----------
  // st.hit = { targets:[{ name, look, x, z, y, yaw, patrol, per, style:'front'|'behind'|'slash', lines }], guards:[...] }
  hitDef(st) { if (st.hit) return st.hit; if (st.confront) return st.hitConv || (st.hitConv = { targets: [{ ...st.confront, name: st.confront.per.name, style: 'front' }] }); return null; }
  hitPos(st) { const H = this.hitDef(st), T = this.hits && this.hits.find(w => !w.tg.guard && w.c.alive); if (T) return [T.n.x, T.n.z]; const t = H && H.targets.find((o, i) => !(this.hitDead || []).includes(i)); return t ? [t.x, t.z] : null; }
  updateHit(st, dt, me) {
    const H = this.hitDef(st), A = this.g.ambient; if (!H) return;
    if (!this.hits) {
      if (!A || !A.on || !me || !H.targets.some(o => Math.hypot(o.x - me.pos[0], o.z - me.pos[2]) < 70)) return;
      const dead = this.hitDead || [];
      const mk = (o, guard, k) => { const w = A.spawn(o.look, o.x, o.z, { name: o.name, sp: 1.1, seed: 700 + k * 31 + Math.round(o.x * 7 + o.z), keep: !!o.y }); w.n.y = o.y || 0; w.c.root.position.y = w.n.y; w.n.yaw = o.yaw || 0; w.c.root.rotation.y = w.n.yaw; w.c.name = o.name; if (o.per) w.c.per = o.per; w.tg = { ...o, guard, k, home: [o.x, o.z], back: false, t: 3 + Math.random() * 4 }; return w; };
      this.hits = [...H.targets.map((o, k) => dead.includes(k) ? null : mk(o, false, k)).filter(Boolean), ...(H.guards || []).map((o, k) => mk(o, true, 100 + k))];
    }
    // يتمشّون طبيعي بين نقطتين (بالطرق، ويفتحون الأبواب) — الحرس يلحگون صاحبهم
    for (const w of this.hits) {
      if (!w.c.alive || w.tg.frozen || w.tg.fled) continue;
      if (w.tg.guard) { const boss = this.hits.find(b => !b.tg.guard && b.c.alive); if (boss && !w.path && Math.hypot(boss.n.x - w.n.x, boss.n.z - w.n.z) > 3.2 && (w.tg.t -= dt) <= 0) { w.tg.t = 1.5; const a = w.tg.k * 2.1; w.goTo(boss.n.x + Math.cos(a) * 1.6, boss.n.z + Math.sin(a) * 1.6); } continue; }
      if (!w.tg.patrol || w.path) continue; if ((w.tg.t -= dt) > 0) continue; w.tg.t = 6 + Math.random() * 5; w.tg.back = !w.tg.back; const [x, z] = w.tg.back ? w.tg.patrol : w.tg.home; w.goTo(x, z);
    }
    this.hitNear = null; if (!me || this.cine || this.kc) return;
    let bd = 9; for (const w of this.hits) { if (w.tg.guard || !w.c.alive || Math.abs(me.pos[1] - (w.n.y || 0)) > 1.3) continue; const d = Math.hypot(w.n.x - me.pos[0], w.n.z - me.pos[2]); if (d < bd) { bd = d; this.hitNear = w; } }
    const w = this.hitNear; if (!w) return;
    // المواجهة بالكلام تبدأ وحدها أول ما توصله (إذا عنده حچي)
    if (w.tg.lines && w.tg.lines.length && !w.tg.talked && bd < 3.2) this.startHit(w);
    else if (bd > 2.6) this.hitNear = null;
  }
  startHit(w) {
    const me = this.g.mp; this.hitCur = w; w.tg.frozen = true; w.stop(); this.hitNear = null;
    if (w.tg.lines && w.tg.lines.length && !w.tg.talked) { w.tg.talked = true; w.face(me.pos[0], me.pos[2]); w.c.focus(me.pos[0], me.pos[2], 60); this.play(w.tg.lines.slice(), { q: this.act.q, done: () => this.knifeKill(w) }); }
    else this.knifeKill(w);
  }
  knifeKill(w) {
    const g = this.g, me = g.mp, style = w.tg.style || 'front'; g.cine = true; this.hitCur = w; w.tg.frozen = true; w.stop();
    this.kc = { t: 0, w, hit: false, style, sx: me.pos[0], sz: me.pos[2] }; g.queued.slot = 3; Audio.play('knife');
    let dx = w.n.x - me.pos[0], dz = w.n.z - me.pos[2], L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (style === 'behind') {
      // من الخلف: هو يدير ظهره (ما حاس بيك)، وإنت تتسلّل وراه
      w.n.yaw = Math.atan2(-dx, -dz); w.c.root.rotation.y = w.n.yaw; this.kc.f = [dx, dz]; this.kc.dest = [w.n.x - dx * 0.62, w.n.z - dz * 0.62];
    }
    // نختار أوسع لقطة (جنب، جنب ثاني، قطري، من فوق) حتى الكاميرا ما تدخل بالحيطان والأغراض
    const mx = (me.pos[0] + w.n.x) / 2, mz = (me.pos[2] + w.n.z) / 2, y0 = w.n.y || 0, px = -dz, pz = dx;
    const dirs = [[px, 0.12, pz], [-px, 0.12, -pz], [px * 0.7 + dx * 0.7, 0.15, pz * 0.7 + dz * 0.7], [-px * 0.7 + dx * 0.7, 0.15, -pz * 0.7 + dz * 0.7], [px * 0.7 - dx * 0.7, 0.15, pz * 0.7 - dz * 0.7], [-px * 0.7 - dx * 0.7, 0.15, -pz * 0.7 - dz * 0.7], [px * 0.5, 0.85, pz * 0.5]];
    let best = dirs[0], bf = -1; for (const v of dirs) { const L2 = Math.hypot(...v); const u = v.map(c => c / L2); const f = Math.min(this.free(mx, y0 + 1.2, mz, u, 3.2), this.free(mx, y0 + 0.6, mz, u, 3.2)); if (f > bf + 0.25) { bf = f; best = u; } }
    this.kc.v = best; this.kc.cd = Math.max(0.9, Math.min(2.9, bf - 0.3)); this.kc.dur = style === 'slash' ? 4.2 : 3.4;
    if (style === 'behind') { const u = [-dx * 0.94 + px * 0.34, 0.06, -dz * 0.94 + pz * 0.34]; this.kc.preOk = this.free(me.pos[0], y0 + 1.6, me.pos[2], u, 1.6) > 1.1; }
    document.getElementById('cine').classList.add('on', 'kc');
  }
  tickKnife(dt) {
    const K = this.kc; if (!K) return; const w = K.w, me = this.g.mp, g = this.g, sty = K.style;
    // تبطيء خفيف لحظة الضربة بالكاتسين الثالث
    K.t += sty === 'slash' && K.t > 0.85 && K.t < 1.7 ? dt * 0.45 : dt;
    const ddx = w.n.x - me.pos[0], ddz = w.n.z - me.pos[2], dd = Math.hypot(ddx, ddz) || 1;
    const hitT = sty === 'behind' ? 1.15 : 1.05;
    // التقدّم بس إذا المكان فاضي (ما ندخّله بالبسطات والحيطان)
    const W = g.world, moveTo = (x, z) => { if (!W.overlap(x, me.pos[1] + 0.06, z, 0.35, 1.85) && W.los(me.pos[0], me.pos[1] + 0.5, me.pos[2], x, me.pos[1] + 0.5, z)) { me.pos[0] = x; me.pos[2] = z; } };
    if (sty === 'behind') { const k = Math.min(1, K.t / 0.95); moveTo(K.sx + (K.dest[0] - K.sx) * k, K.sz + (K.dest[1] - K.sz) * k); if (!K.hit) g.yaw = Math.atan2(-K.f[0], -K.f[1]); }
    else {
      if (K.t < 0.85 && dd > 0.8) { const st = Math.min(dd - 0.8, dt * 2.4); moveTo(me.pos[0] + ddx / dd * st, me.pos[2] + ddz / dd * st); }
      if (!K.hit) { g.yaw = Math.atan2(-ddx, -ddz); if (sty === 'front' || K.t > 0.3) { w.n.yaw = Math.atan2(ddx, ddz); w.c.root.rotation.y = w.n.yaw; } } // وجهاً لوجه، حتى يطيح لورا
    }
    // إذا ما گدرنا نوصله (بسطة، عتبة واطية): هو يتراجع لحدّنا
    if (!K.hit && K.t > 0.6 && dd > 0.75) { const st = Math.min(dd - 0.72, dt * 2.2); w.n.x -= ddx / dd * st; w.n.z -= ddz / dd * st; w.c.root.position.x = w.n.x; w.c.root.position.z = w.n.z; }
    this.stab = K.t < hitT - 0.3 ? 0 : K.t < hitT ? (K.t - hitT + 0.3) / 0.3 : K.t < hitT + 0.35 ? 1 : Math.max(0, 1 - (K.t - hitT - 0.35) / 0.4);
    if (!K.hit && K.t > hitT) {
      K.hit = true; Audio.play('knifeHit'); const dir = sty === 'behind' ? [K.f[0], 0, K.f[1]] : [ddx / dd, 0, ddz / dd]; w.c.die(dir); if (w.c.fall) { w.c.fall.tw = 0.12; w.c.fall.s = 0; }
      const fl = document.createElement('div'); fl.className = 'kflash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 500);
      // الحرس ينهزمون
      (this.hits || []).forEach((h, i) => { if (!h.tg.guard || !h.c.alive || h.tg.fled) return; h.tg.fled = true; h.sp = 3.2; const a = Math.atan2(h.n.z - w.n.z, h.n.x - w.n.x); h.goTo(h.n.x + Math.cos(a) * 30, h.n.z + Math.sin(a) * 30, () => h.hidden = true); setTimeout(() => { h.hidden = true; }, 15000); });
    }
    if (K.t > K.dur) {
      this.kc = null; this.stab = 0; g.cine = false; document.getElementById('cine').classList.remove('on', 'kc');
      const A = this.act, st = A && A.q.steps[A.i]; (this.hitDead = this.hitDead || []).push(w.tg.k); this.hitCur = null;
      setTimeout(() => w.remove(), 30000);
      const left = (this.hits || []).filter(h => !h.tg.guard && h.c.alive);
      if (left.length) { this.g.ui && this.g.ui.toast2 && this.g.ui.toast2(`✔ انتهى ${w.tg.name} — باقٍ ${left.map(h => h.tg.name).join('، ')}`); return; }
      const H = this.hits; this.hits = null; this.hitDead = null; if (H) H.forEach(h => { if (h !== w) setTimeout(() => h.remove(), h.c.alive ? 16000 : 30000); });
      Audio.play('questDone'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2('✔ تمّت التصفية — ارجع إلى صاحب المهمّة'); this.stepDone();
    }
  }
  dropHits() { const H = this.hits; this.hits = null; this.hitDead = null; this.hitCur = null; this.hitNear = null; if (H) H.forEach(h => h.remove()); }
  // لقطات الاغتيال: جانبية (مواجهة)، فوق الكتف ثم جانبية (من الخلف)، ودوران بطيء (الضربة الخاطفة)
  free(x, y, z, u, max) { const r = this.g.world.ray(x, y, z, u[0], u[1], u[2], max, 0, this.rayO || (this.rayO = { t: 0 })); return r && r.t < max ? r.t : max; }
  knifeCam() {
    const K = this.kc, me = this.g.mp, w = K.w, y0 = w.n.y || 0, mx = (me.pos[0] + w.n.x) / 2, mz = (me.pos[2] + w.n.z) / 2;
    let dx = w.n.x - me.pos[0], dz = w.n.z - me.pos[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const px = -dz, pz = dx, sh = K.hit && K.t < 1.5 ? (Math.random() - 0.5) * 0.06 : 0, cam = this.g.camera;
    // الكاميرا ما تدخل بالحيطان: إذا شي يحجب بين المشهد والكاميرا نقرّبها
    const put = (fx, fy, fz, u, D, lx, ly, lz) => { const t = Math.max(0.7, Math.min(D, this.free(fx, fy, fz, u, D + 0.3) - 0.3)); cam.position.set(fx + u[0] * t + sh, fy + u[1] * t, fz + u[2] * t); cam.lookAt(lx, ly, lz); return true; };
    if (K.style === 'behind' && K.t < 1.05 && K.preOk) { const u = [-dx * 0.94 + px * 0.34, 0.06, -dz * 0.94 + pz * 0.34]; return put(me.pos[0], y0 + 1.65, me.pos[2], u, 1.5, w.n.x, y0 + 1.35, w.n.z); }
    const v = K.v || [px, 0.12, pz], k = Math.min(1, K.t / 3);
    if (K.style === 'slash') { const a = Math.atan2(v[2], v[0]) + (K.t - 1) * 0.5, c = Math.hypot(v[0], v[2]), u = [Math.cos(a) * c, v[1], Math.sin(a) * c]; return put(mx, y0 + 1.15, mz, u, K.cd, mx, y0 + 1.0, mz); }
    return put(mx, y0 + 1.2, mz, v, K.cd - k * 0.25, mx, y0 + 1.1 - k * 0.25, mz);
  }


  // ---------- مهام التصفية ----------
  spawnTargets(st) {
    const A = this.g.ambient; if (this.targets || !A || !A.on) return;
    const mk = (o, guard) => { const w = A.spawn(o.look, o.x, o.z, { name: o.name, sp: 1.1, seed: 700 + Math.round(o.x * 7 + o.z) }); w.face(o.x + Math.sin(o.yaw || 0), o.z + Math.cos(o.yaw || 0)); w.tg = { ...o, guard, home: [o.x, o.z], back: false, t: Math.random() * 4 }; w.c.name = o.name; return w; };
    this.targets = [...st.kill.map(o => mk(o, false)), ...(st.guards || []).map(o => mk(o, true))];
  }
  dropTargets(keepDead) { if (!this.targets) return; const T = this.targets; this.targets = null; for (const w of T) { if (keepDead && !w.c.alive) setTimeout(() => w.remove(), 20000); else w.remove(); } }
  targetPos() { const w = this.targets && this.targets.find(w => !w.tg.guard && w.c.alive); return w ? [w.n.x, w.n.z] : null; }
  updateTargets(st, dt, p) {
    if (!this.targets) { const me = this.g.mp; if (me && p && Math.hypot(p[0] - me.pos[0], p[1] - me.pos[2]) < 70) this.spawnTargets(st); return; }
    // دورية خفيفة: يتمشّى بين نقطتين
    for (const w of this.targets) { if (!w.c.alive || !w.tg.patrol || w.path) continue; if ((w.tg.t -= dt) > 0) continue; w.tg.t = 5 + Math.random() * 4; w.tg.back = !w.tg.back; const [x, z] = w.tg.back ? w.tg.patrol : w.tg.home; w.goTo(x, z); }
    if (this.targets.filter(w => !w.tg.guard).every(w => !w.c.alive)) { Audio.play('questDone'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2('✔ تمّت التصفية — ارجع إلى صاحب المهمّة'); this.stepDone(); }
  }
  // طلقتي باللوبي: هل أصابت أحد المطلوبين؟ (o: فوهة/عين، d: الاتجاه)
  onShot(o, d) {
    if (!this.targets) return;
    const W = this.g.world, s = 0.3, wall = W.ray(o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s, d[0], d[1], d[2], 200, undefined, {}), maxT = wall ? wall.t + s : 200;
    let best = null, bt = maxT;
    for (const w of this.targets) {
      if (!w.c.alive || w.hidden) continue;
      const tx = w.n.x - o[0], tz = w.n.z - o[2], t = tx * d[0] + (1.0 - o[1]) * d[1] + tz * d[2]; if (t <= 0 || t >= bt) continue;
      const px = o[0] + d[0] * t, py = o[1] + d[1] * t, pz = o[2] + d[2] * t;
      if (Math.hypot(px - w.n.x, pz - w.n.z) < 0.34 && py > 0.15 && py < 1.85) { best = w; bt = t; }
    }
    if (best) { best.c.die(d); best.stop(); Audio.play('hitmark'); if (!best.tg.guard) this.g.ui && this.g.ui.toast2 && this.g.ui.toast2('أسقطت ' + best.tg.name); }
  }
  // ---------- الوردة ----------
  nurseryMenu() {
    this.play([['n', this.flower ? 'أهلاً بكَ مرّةً أخرى! أتريدُ وردةً أخرى؟' : 'أهلاً بالمجاهد، أتريدُ وردةً جوريّةً تُهديها لأحد؟']], { q: { giver: NURSERY, steps: [] }, choices: [
      { label: `🌹 اشترِ وردة — ${fmtIQD(FLOWER_PRICE)}`, fn: () => {
        const C = this.cine; this.flower++;
        if (Economy.spend(FLOWER_PRICE)) { Audio.play('buy'); C.lines = [['n', 'تفضَّل، أجملُ وردةٍ في المشتل. أهدِها لمَن تُحِبّ.']]; } else C.lines = [['n', 'مالُكَ لا يكفي يا عزيزي... خُذْها هديّةً منّي!']];
        C.i = -1; C.stage = 'lines'; C.opt.choices = null; this.next();
      } },
      { label: 'لاحقاً', fn: () => this.endCine() },
    ] });
  }
  giveFlower(c) {
    this.flower--; const t = FLOWER_THANKS[Math.floor(Math.random() * FLOWER_THANKS.length)];
    const i = this.g.civs.indexOf(c);
    this.play([['me', 'تفضَّل، هذه وردةٌ لك.'], [i, t]], { q: { giver: i, steps: [] } });
  }
  // ---------- غرض مخفي ----------
  findObj(f) {
    const kind = f.kind || 'bag';
    if (this.findMesh && this.findMesh.kind !== kind) { this.g.scene.remove(this.findMesh); this.findMesh = null; }
    if (!this.findMesh && kind !== 'bag') { const g = this.findMesh = new THREE.Group(); g.kind = kind; const it = makeItem(kind); it.scale.setScalar(kind === 'ring' ? 3 : 1.6); g.add(it); const glow = new THREE.PointLight(0xffd080, 1.6, 3, 2); glow.position.y = 0.4; g.add(glow); this.g.scene.add(g); }
    if (!this.findMesh) {
      const g = this.findMesh = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x5a3018, roughness: 0.6, emissive: 0x3a1a08, emissiveIntensity: 0.6 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.14), m); b.position.y = 0.14; g.add(b);
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 14, Math.PI), m); h.position.y = 0.28; g.add(h);
      const glow = new THREE.PointLight(0xffd080, 1.4, 3, 2); glow.position.y = 0.5; g.add(glow); this.g.scene.add(g); g.kind = 'bag';
    }
    this.findMesh.position.set(f.x, 0, f.z);
  }
  // ---------- الشيل (قنينة الغاز): تمشي بطيء وبإيدك الغرض ----------
  startCarry(kind, quiet) { this.carry = kind; this.g.carry = kind; if (!quiet) this.g.ui.toast2(kind === 'gas' ? 'ثقيلة! امشِ على مهلك' : 'صار الغرض في يدك — سلِّمه لصاحبه يداً بيد'); }
  // التسليم يد بيد: الغرض ينتقل من إيدك لإيده
  handOver(kind, c) {
    this.dropCarry(); if (!c) return;
    const g = this.g, me = g.mp, m = makeItem(kind); if (kind === 'ring' || kind === 'keys' || kind === 'beads') m.scale.setScalar(1.6);
    const dx = me.pos[0] - c.n.x, dz = me.pos[2] - c.n.z, L = Math.hypot(dx, dz) || 1;
    const from = new THREE.Vector3(me.pos[0] - dx / L * 0.3, 1.0, me.pos[2] - dz / L * 0.3), to = new THREE.Vector3(c.n.x + dx / L * 0.32, 1.02, c.n.z + dz / L * 0.32);
    m.position.copy(from); g.scene.add(m); if (this.hand) g.scene.remove(this.hand.m); this.hand = { m, from, to, t: 0 };
  }
  tickHand(dt) {
    const h = this.hand; if (!h) return; h.t += dt; const k = Math.min(1, Math.max(0, (h.t - 0.6) / 1.2)), e = k * k * (3 - 2 * k);
    h.m.position.lerpVectors(h.from, h.to, e); h.m.position.y += Math.sin(e * Math.PI) * 0.12; h.m.rotation.y += dt * (1 - e) * 2;
    if (h.t > 7) { this.g.scene.remove(h.m); this.hand = null; }
  }
  dropCarry() { this.carry = null; this.g.carry = null; }
  // ---------- قبور الشهداء اللي دفنتهم ----------
  addGrave(p) { this.S.graves = this.S.graves || []; if (!this.S.graves.some(q => Math.hypot(q[0] - p.x, q[1] - p.z) < 0.5)) this.S.graves.push([p.x, p.z]); this.save(); this.buildGraves(); }
  buildGraves() {
    const G = this.S.graves || []; if (!this.graveG) { this.graveG = new THREE.Group(); this.g.scene.add(this.graveG); }
    while (this.graveG.children.length) this.graveG.remove(this.graveG.children[0]);
    const soil = new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 }), st = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.8 }), gr = new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.7 });
    for (const [x, z] of G) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), soil); m.scale.set(1.9, 0.35, 0.9); m.position.set(x, 0, z); this.graveG.add(m);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.32), st); s2.position.set(x - 0.95, 0.27, z); this.graveG.add(s2);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.3), gr); fl.position.set(x - 0.9, 0.5, z); this.graveG.add(fl); // راية خضراء صغيرة
    }
  }
  // ---------- الواجهة ----------
  updateHud() {
    const el = $('qTrack'); if (!el) return;
    const A = this.act, g = this.g;
    el.classList.toggle('on', !!(this.on && (A || this.offer || this.flower)));
    if (!this.on) return;
    let h = '';
    if (A && A.q.steps[A.i]) {
      const st = A.q.steps[A.i], m = Math.max(0, Math.ceil(A.left)), mm = Math.floor(m / 60), ss = String(m % 60).padStart(2, '0');
      const d = g.wps && g.wps.dist ? Math.round(g.wps.dist) : null;
      h = `<b>${esc(A.q.title)}</b><span class="qt ${m < 30 ? 'low' : ''}">${mm}:${ss}</span><div class="qs">● ${esc(st ? st.label : '')}${d ? ` <small>${d} م</small>` : ''}</div>${A.item ? `<div class="qi">معك: ${esc(A.item)}</div>` : ''}`;
    } else if (this.offer) h = `<b class="g">مهمّة متاحة</b><div class="qs">${esc(this.offer.title)} — اذهب إلى النقطة الخضراء</div>`;
    if (this.flower) h += `<div class="qi">🌹 وردة ×${this.flower}</div>`;
    if (el._h !== h) { el._h = h; el.innerHTML = h; }
  }
}
