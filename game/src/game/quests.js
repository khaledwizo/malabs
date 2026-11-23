// مدير المهام باللوبي: عرض مهمة وحدة (نقطة خضراء)، حوارات سينمائية قصيرة، خطوات بعلامات طريق، عدّاد وقت، ومكافأة بالدينار
import * as THREE from 'three';
import { QUESTS, FISHER_MEET, FISHER, NURSERY, FLOWER_THANKS, FLOWER_PRICE, FIGHTERS } from './questdata.js';
import { CAST } from './introdata.js';
import { CharModel } from './chars.js';
import { Economy, fmtIQD, r250 } from './economy.js';
import { Settings } from '../core/settings.js';
import { Audio } from '../core/audio.js';
import { Voices, voiceId } from '../core/voices.js';
import { Input } from '../core/input.js';
import { MiniGame } from './minigame.js';
import { BAKER } from './questdata.js';

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
  start() { this.buildGraves(); this.on = true; this.offer = null; this.act = null; this.cine = null; this.offerT = 3; this.fighters = null; this.updateHud(); }
  stop() { this.endCine(true); if (this.mg) { this.mg.close(); this.mg = this.g.mg = null; } this.dropCarry(); if (this.findMesh) this.findMesh.visible = false; this.on = false; this.offer = null; this.act = null; this.giverMark.visible = false; this.g.wps && this.g.wps.clearQuest(); this.dropFighters(); this.updateHud(); }
  // ---------- من هو؟ ----------
  civ(who, q) {
    q = q || (this.act && this.act.q) || this.offer;
    if (who === 'g') who = q && q.giver;
    if (typeof who === 'string' && who[0] === 'f') { const F = this.fighters; return F ? F[+who[1]].c : null; }
    if (who === 'n') { const st = this.act && this.act.q === q && this.act.q.steps[this.act.i]; who = st ? (st.to === 'g' ? q.giver : st.to === 'fighters' ? 'f2' : st.to) : q && q.giver; if (typeof who === 'string' && who[0] === 'f') return this.civ(who, q); }
    return typeof who === 'number' ? this.g.civs[who] : null;
  }
  persona(who, q) {
    if (who === 'me') { const ch = (this.g.mp && this.g.mp.char) || Settings.char; return CAST[ch] || CAST.khaled; }
    if (typeof who === 'string' && who[0] === 'f') return FIGHTERS[+who[1]];
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
      steps: [{ to: BAKER, label: 'جيب ' + v.item + ' من أبو رسول', say: v.say, pay: v.price, mg: { type: 'scoop', title: v.item, n: 3, color: v.color, bag: 0xe8dcc8, tip: 'حطّ ' + v.item + ' بالكيس' }, item: v.item },
        { to: 'g', label: 'وصّل ' + v.item, say: v.back }],
      outro: [['g', 'هاي حقّه وهاي حلاوتك، الله يحفظك.']] };
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
    Audio.play('questNew'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2('مهمة جديدة: ' + q.title + ' — النقطة الخضراء بالخريطة');
  }
  spawnFighters() {
    if (this.fighters) return; const A = this.g.ambient; if (!A || !A.on) return;
    this.fighters = FIGHTERS.map((f, i) => { const w = A.spawn(f.look, FIGHTERS_AT[0] + (i % 3) * 0.9 - 0.9, FIGHTERS_AT[1] + Math.floor(i / 3) * 1.0, { name: f.name, sp: 1.6, seed: 400 + i * 17 }); w.face(0, 0); w.fi = i; w.c.per = f; return w; });
  }
  dropFighters() { if (this.fighters) { for (const w of this.fighters) w.remove(); this.fighters = null; } }
  // ---------- كل إطار ----------
  update(dt) {
    if (!this.on) return;
    this.t += dt; const g = this.g, me = g.mp;
    if (this.cine) this.tickCine(dt);
    if (this.mg) { this.mg.update(dt); if (this.mg.closed) this.mg = null; g.mg = this.mg; }
    // أبو حيدر الصيّاد: إذا وگفت يمّه شوية، هو يفتح السالفة بنفسه
    { const fc = g.civs[FISHER]; if (fc && fc.here && !this.S.met.fisher && !this.cine && !this.mg && me && Math.hypot(fc.n.x - me.pos[0], fc.n.z - me.pos[2]) < 3.4) { this.fisherT = (this.fisherT || 0) + dt; if (this.fisherT > 2.5) { this.fisherT = 0; this.meetFisher(); } } else this.fisherT = 0; }
    // عرض مهمة جديدة بعد شوية
    if (!this.offer && !this.act && !this.cine && !this.mg && (this.offerT -= dt) <= 0) { this.offerT = 8; this.setOffer(this.pickOffer()); }
    if (this.offer && typeof this.offer.giver === 'number' && !this.civ('g', this.offer).here) this.offer = null;
    // علامة «!» الخضراء فوق صاحب المهمة
    const gp = this.offer && !this.cine && !this.mg ? this.posOf('g', this.offer) : null, gc = this.offer ? this.civ('g', this.offer) : null;
    this.giverMark.visible = !!gp; if (gp) this.giverMark.position.set(gp[0], (gc && gc.sit ? 1.75 : 2.3) + Math.sin(this.t * 3) * 0.08, gp[1]);
    // المهمة الجارية: الوقت، علامة الخطوة، والوصول
    const A = this.act;
    if (A) {
      A.left -= this.cine || this.mg ? 0 : dt;
      if (A.left <= 0) { this.fail('خلص الوقت!'); }
      else {
        const st = A.q.steps[A.i], p = this.posOf(st.to, A.q);
        if (p) g.wps.setQuestPos ? g.wps.setQuestPos(p[0], p[1], st.label) : (g.wps.quest = { x: p[0], z: p[1], label: st.label });
        // الجماعة تمشي وراك
        if (this.fighters && st.escort && me) this.fighters.forEach((w, i) => { const d = Math.hypot(w.n.x - me.pos[0], w.n.z - me.pos[2]); if (d > 3.2 + i * 0.5 && (!w.path || (w.reT = (w.reT || 0) - dt) <= 0)) { w.reT = 0.8; const a = i / 5 * Math.PI * 2; w.goTo(me.pos[0] + Math.cos(a) * 1.6, me.pos[2] + Math.sin(a) * 1.6); } });
        // غرض مخفي: توصل للمنطقة وتدوّره بعينك (يلمع شوية)
        if (st.find && me) { this.findObj(st.find); this.findMesh.visible = true; this.findMesh.rotation.y += dt; const near = Math.hypot(st.find.x - me.pos[0], st.find.z - me.pos[2]); if (p && Math.hypot(p[0] - me.pos[0], p[1] - me.pos[2]) < 7) g.wps.quest = null; this.findNear = near < 1.9; }
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
    if (this.offer && !this.act && near(this.posOf('g', this.offer), 3.0)) return { label: 'تكلّم', fn: () => this.openOffer() };
    if (this.act && this.act.q.steps[this.act.i].find && this.findNear) return { label: '👜 ' + this.act.q.steps[this.act.i].find.label, fn: () => { this.findMesh.visible = false; this.runStep(); } };
    // أبو حيدر: أول لقاء
    const fc = g.civs[FISHER]; if (fc && fc.here && !this.S.met.fisher && !(this.offer && this.offer.giver === FISHER) && near([fc.n.x, fc.n.z], 3)) return { label: 'تكلّم', fn: () => this.meetFisher() };
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
    const el = $('cine'); el.querySelector('.cname').textContent = per.name || ''; el.querySelector('.ctext').textContent = text; el.querySelector('.cname').classList.toggle('me', who === 'me');
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
    const per = this.persona('g', C.q), el = $('cine'); el.querySelector('.cname').textContent = per.name; el.querySelector('.ctext').textContent = Q.q.replace(/^[^:]+:\s*/, '');
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
    const C = this.cine, g = this.g, me = g.mp; if (!C || !me) return false;
    const cam = g.camera, W = g.world;
    const st = this.act && this.act.q === C.q ? C.q.steps[this.act.i] : null;
    const other = C.c || (st && typeof st.to === 'object' ? null : this.civ('n', C.q));
    const mx = me.pos[0], mz = me.pos[2];
    const ox = other ? other.n.x : mx - Math.sin(g.yaw) * 2, oz = other ? other.n.z : mz - Math.cos(g.yaw) * 2, oy = other ? (other.sit ? 1.15 : 1.6) : 1.6;
    // نموذج اللاعب يواجه المتكلّم
    const M = this.meModel; if (M) { const yaw = Math.atan2(-(ox - mx), -(oz - mz)); M.root.position.set(mx, me.pos[1], mz); const crouch = C.stage === 'act' && C.opt.act && C.opt.act.me ? 1 : 0; M.update({ yaw, pitch: crouch ? -0.5 : 0, speed: 0, vx: 0, vz: 0, crouch, lean: 0, hurt: 9, onGround: true, alive: true, ads: 0, prot: false, reloading: false, fireT: 0 }, dt); }
    let dx = ox - mx, dz = oz - mz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const rx = -dz, rz = dx, meSpeak = C.who === 'me';
    // فوق الكتف: خلف اللي يسمع، ينظر للي يحچي
    const [ax, az, ay, bx, bz, by] = meSpeak ? [ox, oz, oy, mx, mz, 1.62] : [mx, mz, 1.62, ox, oz, oy];
    const fx = meSpeak ? -dx : dx, fz = meSpeak ? -dz : dz;
    const sd = meSpeak ? -1 : 1, cx0 = (mx + ox) / 2, cz0 = (mz + oz) / 2;
    // مرشّحات اللقطة بالترتيب: فوق الكتف، فوق الكتف الثاني، جانبية يمين/يسار، ومن عين اللاعب
    const cands = [[ax - fx * 1.35 + rx * 0.62 * sd, ay + 0.2, az - fz * 1.35 + rz * 0.62 * sd], [ax - fx * 1.35 - rx * 0.62 * sd, ay + 0.2, az - fz * 1.35 - rz * 0.62 * sd], [cx0 + rx * 2.4, 1.7, cz0 + rz * 2.4], [cx0 - rx * 2.4, 1.7, cz0 - rz * 2.4], [mx - dx * 0.5, 1.85, mz - dz * 0.5]];
    const okCam = ([x, y, z]) => !W.overlap(x, y - 0.25, z, 0.22, 0.5) && W.los(bx, by, bz, x + (x - bx) * 0.15, y, z + (z - bz) * 0.15) && W.los(cx0, 1.5, cz0, x, y, z);
    let [px, py, pz] = cands.find(okCam) || cands[cands.length - 1];
    // أثناء الفعل (تعبئة، عجن، دفن…): الكاميرا تدور ببطء حول المشهد
    if (C.stage === 'act') { C.orb = (C.orb ?? Math.atan2(pz - cz0, px - cx0)) + dt * 0.3; const R0 = 2.3; const ox2 = cx0 + Math.cos(C.orb) * R0, oz2 = cz0 + Math.sin(C.orb) * R0; if (okCam([ox2, 1.55, oz2])) { px = ox2; py = 1.55; pz = oz2; } }
    if (cands.indexOf([px, py, pz]) < 0 && px === cands[4][0]) { /* من عين اللاعب */ }
    const tgt = C.stage === 'act' ? new THREE.Vector3(cx0, 1.0, cz0) : new THREE.Vector3(bx, by, bz);
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
      { label: 'أقبل المهمة ✔', fn: () => { this.endCine(); this.accept(q); } },
      { label: 'مو هسّه', fn: () => { this.endCine(); this.ignore(q); } },
    ], prompt: `${q.title} · الوقت ${Math.round(q.time / 60)} دقائق · المكافأة ${fmtIQD(r250((q.reward || 0) + (q.tip || 0)))}` });
  }
  meetFisher() { this.S.met.fisher = 1; this.save(); this.play(FISHER_MEET, { q: { giver: FISHER } }); }
  accept(q) {
    this.offer = null; this.lastId = q.id; this.giverMark.visible = false;
    this.act = { q, i: 0, left: q.time, item: null, extra: 0 };
    Audio.play('questNew'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2('بدأت المهمة: ' + q.title);
  }
  ignore(q) { this.cd[q.id] = this.t + 180; this.offer = null; this.offerT = 16; this.lastId = q.id; this.lastPos = this.giverPos(q) || this.lastPos; if (q.spawn === 'fighters') this.dropFighters(); }
  fail(why) {
    const q = this.act.q; this.act = null; this.dropCarry(); if (this.mg) { this.mg.close(); this.mg = this.g.mg = null; } if (this.findMesh) this.findMesh.visible = false; this.lastPos = this.giverPos(q) || this.lastPos; this.g.wps.clearQuest(); this.cd[q.id] = this.t + 90; this.offerT = 12; this.endCine(true);
    if (q.spawn === 'fighters') this.dropFighters();
    Audio.play('questFail'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2(`فشلت المهمة «${q.title}» — ${why} ترجع تنعرض بعدين.`);
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
    if (st.pay) { if (Economy.spend(st.pay)) lines.push(['me', `(دفعت ${fmtIQD(st.pay)})`]); else lines.push([typeof st.to === 'number' ? 'n' : 'me', typeof st.to === 'number' ? 'ما عندك فلوس هسّه؟ خذ وادفع بعدين، إحنا أهل.' : '(ما عندي فلوس... أدفع للوكيل بعدين)']); }
    if (!lines.length) lines.push(['me', '(...)']);
    if (st.choose) { opt.prompt = st.choose.prompt; opt.choices = st.choose.opts.map(o => ({ label: `${o.label} — ${fmtIQD(o.price)}`, fn: () => { A.choice = o; A.extra = r250(25000 - o.price); A.item = o.item; this.cine.opt.choices = null; this.cine.lines = [['me', 'هذا ' + o.label + '.'], ['n', 'اختيار زين! تفضّل.']]; this.cine.i = -1; this.cine.stage = 'lines'; this.next(); } })); }
    this.play(lines, opt);
  }
  stepDone(C) {
    const A = this.act; if (!A) return; const q = A.q, st = q.steps[A.i];
    if (st.item) A.item = st.item; if (C && C.opt && C.opt.quizScore !== undefined) A.quiz = C.opt.quizScore;
    if (st.carry) this.startCarry(st.carry);
    A.i++; this.g.wps.clearQuest();
    if (A.i >= q.steps.length) this.finish();
    else Audio.play('ui');
  }
  finish() {
    const A = this.act, q = A.q; this.dropCarry(); this.lastPos = this.giverPos(q) || this.lastPos; if (q.cool) { this.coolUntil = this.coolUntil || {}; this.coolUntil[q.id] = this.t + q.cool; } let amt = (q.reward || 0) + (q.tip || 0) + (A.extra || 0);
    if (q.id === 'tourist' && A.quiz !== undefined) amt = A.quiz >= 2 ? amt : A.quiz === 1 ? r250(amt * 0.6) : r250(amt * 0.35);
    this.play(q.outro, { q, done: () => {
      const got = Economy.earn(amt); this.S.done[q.id] = (this.S.done[q.id] || 0) + 1; this.save();
      this.act = null; this.offerT = 22 + Math.random() * 15; if (q.spawn === 'fighters') { const F = this.fighters; this.fighters = null; if (F) F.forEach((w, i) => { w.stroll = true; w.wait = 3 + i; setTimeout(() => w.remove(), 60000); }); }
      Audio.play('questDone'); this.g.ui && this.g.ui.toast2 && this.g.ui.toast2(`✔ ${q.title} — استلمت ${fmtIQD(got)}`);
    } });
  }
  // ---------- الوردة ----------
  nurseryMenu() {
    this.play([['n', this.flower ? 'هلا بيك مرة ثانية! تريد وردة بعد؟' : 'هلا بالمجاهد، تريد وردة جوري تهديها لأحد؟']], { q: { giver: NURSERY, steps: [] }, choices: [
      { label: `🌹 اشتري وردة — ${fmtIQD(FLOWER_PRICE)}`, fn: () => {
        const C = this.cine; this.flower++;
        if (Economy.spend(FLOWER_PRICE)) { Audio.play('buy'); C.lines = [['n', 'تفضّل، أحلى وردة بالمشتل. أهديها لمن تحب.']]; } else C.lines = [['n', 'فلوسك ما تكفي عيني... خذها هدية منّي!']];
        C.i = -1; C.stage = 'lines'; C.opt.choices = null; this.next();
      } },
      { label: 'بعدين', fn: () => this.endCine() },
    ] });
  }
  giveFlower(c) {
    this.flower--; const t = FLOWER_THANKS[Math.floor(Math.random() * FLOWER_THANKS.length)];
    const i = this.g.civs.indexOf(c);
    this.play([['me', 'تفضّل، هاي وردة إلك.'], [i, t]], { q: { giver: i, steps: [] } });
  }
  // ---------- غرض مخفي ----------
  findObj(f) {
    if (!this.findMesh) {
      const g = this.findMesh = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x5a3018, roughness: 0.6, emissive: 0x3a1a08, emissiveIntensity: 0.6 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.14), m); b.position.y = 0.14; g.add(b);
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 14, Math.PI), m); h.position.y = 0.28; g.add(h);
      const glow = new THREE.PointLight(0xffd080, 1.4, 3, 2); glow.position.y = 0.5; g.add(glow); this.g.scene.add(g);
    }
    this.findMesh.position.set(f.x, 0, f.z);
  }
  // ---------- الشيل (قنينة الغاز): تمشي بطيء وبإيدك الغرض ----------
  startCarry(kind) { this.carry = kind; this.g.carry = kind; this.g.ui.toast2('ثگيلة! تمشي على مهلك'); }
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
    if (A) {
      const st = A.q.steps[A.i], m = Math.max(0, Math.ceil(A.left)), mm = Math.floor(m / 60), ss = String(m % 60).padStart(2, '0');
      const d = g.wps && g.wps.dist ? Math.round(g.wps.dist) : null;
      h = `<b>${esc(A.q.title)}</b><span class="qt ${m < 30 ? 'low' : ''}">${mm}:${ss}</span><div class="qs">● ${esc(st ? st.label : '')}${d ? ` <small>${d} م</small>` : ''}</div>${A.item ? `<div class="qi">معك: ${esc(A.item)}</div>` : ''}`;
    } else if (this.offer) h = `<b class="g">مهمة متاحة</b><div class="qs">${esc(this.offer.title)} — روح للنقطة الخضراء</div>`;
    if (this.flower) h += `<div class="qi">🌹 وردة ×${this.flower}</div>`;
    if (el._h !== h) { el._h = h; el.innerHTML = h; }
  }
}
