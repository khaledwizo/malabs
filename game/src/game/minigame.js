// الألعاب الصغيرة بالمهام: تسوّيها إنت بإيدك (منظور الشخص الأول) — صبّ الماي والعجن، الغرف، الوزن، تعبئة الجلكان،
// الحفر والدفن، لفّ الضماد، ربط منظّم الغاز، وتصوير السائح. كل لعبة: مشهد ثلاثي الأبعاد أمام الكاميرا + أزرار وتعليمات.
import * as THREE from 'three';
import { Audio } from '../core/audio.js';

const $ = id => document.getElementById(id);
const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = k => k * k * (3 - 2 * k);

// إيد بسيطة: كف وأصابع (لون البشرة) مع كمّ
function hand(skin = 0xc69272, sleeve = 0x5a5246) {
  const g = new THREE.Group(), sk = S(skin, { roughness: 0.7 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.03, 0.1), sk); g.add(palm);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.045, 3, 6), sk); f.rotation.x = Math.PI / 2; f.position.set(-0.03 + i * 0.02, 0, -0.075); g.add(f); }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.035, 3, 6), sk); th.rotation.set(Math.PI / 2, 0, 0.9); th.position.set(0.05, 0, -0.02); g.add(th);
  const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.22, 12), S(sleeve, { roughness: 0.95 })); sl.rotation.x = Math.PI / 2; sl.position.z = 0.16; g.add(sl);
  return g;
}

export class MiniGame {
  // def: { type, title, ...خيارات } ؛ onDone(result)
  constructor(game, def, onDone) {
    this.g = game; this.def = def; this.onDone = onDone; this.t = 0; this.k = 0; this.stage = 0; this.done = false; this.hold = {}; this.msgT = 0;
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a2c20, 1.25)); const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(0.6, 1.5, 0.8); this.scene.add(k);
    this.root = new THREE.Group(); this.root.position.set(0, -0.36, -0.78); this.scene.add(this.root);
    this.allowLook = def.type === 'photo'; this.noProps = def.type === 'photo';
    const fn = this['build_' + def.type]; if (fn) fn.call(this, def);
    // الكاميرا تباوع لتحت على الغرض، وتخلّيه بالنص الفوقاني (لوحة الأزرار تحت)
    const rp = this.root.position; this.cam.position.set(0, 0, 0); this.cam.lookAt(rp.x, rp.y - Math.abs(rp.z) * 0.16, rp.z);
    this.ui();
  }
  // ---------- الواجهة ----------
  ui() {
    const el = $('mg'); el.classList.add('on'); el.classList.toggle('photo', this.def.type === 'photo');
    el.querySelector('.mgt').textContent = this.def.title || '';
    this.setTip(this.tips ? this.tips[0] : ''); this.setBtns(this.btns ? this.btns[0] : []); this.prog(0);
  }
  setTip(t) { $('mg').querySelector('.mgi').textContent = t; }
  say(t, d = 2.2) { const m = $('mg').querySelector('.mgm'); m.textContent = t; m.classList.add('on'); this.msgT = d; }
  prog(k) { $('mg').querySelector('.mgp i').style.width = (Math.max(0, Math.min(1, k)) * 100).toFixed(1) + '%'; }
  // أزرار: [{id, label, hold}] — الضغط المستمر للـhold، والنقر للباقي
  setBtns(list) {
    const box = $('mg').querySelector('.mgb'); box.innerHTML = '';
    for (const b of list) {
      const e = document.createElement('button'); e.className = 'btn ' + (b.primary === false ? '' : 'primary'); e.textContent = b.label; box.appendChild(e);
      if (b.hold) {
        const on = ev => { ev.preventDefault(); this.hold[b.id] = true; e.classList.add('down'); }, off = () => { this.hold[b.id] = false; e.classList.remove('down'); };
        e.addEventListener('pointerdown', on); e.addEventListener('pointerup', off); e.addEventListener('pointercancel', off); e.addEventListener('pointerleave', off);
      } else e.addEventListener('pointerdown', ev => { ev.preventDefault(); if (!this.done) this.tap(b.id); });
    }
  }
  tap(id) { const fn = this['tap_' + this.def.type]; if (fn) fn.call(this, id); }
  key(code) { // لوحة المفاتيح: مسافة = الزر الأول
    const b = $('mg').querySelector('.mgb button'); if (!b) return;
    if (code === 'down') b.dispatchEvent(new PointerEvent('pointerdown')); else b.dispatchEvent(new PointerEvent('pointerup'));
  }
  finish(res = {}) { if (this.done) return; this.done = true; Audio.play('questDone'); this.say('أحسنت! ✔', 1.2); setTimeout(() => { this.close(); this.onDone && this.onDone(res); }, 900); }
  close() { const el = $('mg'); el.classList.remove('on', 'photo'); el.querySelector('.mgm').classList.remove('on'); this.closed = true; }
  update(dt) {
    if (this.closed) return; this.t += dt;
    if (this.msgT > 0 && (this.msgT -= dt) <= 0) $('mg').querySelector('.mgm').classList.remove('on');
    const fn = this['tick_' + this.def.type]; if (fn && !this.done) fn.call(this, dt);
    this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix();
  }
  render(r) { if (this.noProps || this.closed) return; r.autoClear = false; r.clearDepth(); r.render(this.scene, this.cam); r.autoClear = true; }

  // ================= صبّ الماي والعجن =================
  build_knead() {
    const R = this.root, wood = S(0x7a4a28, { roughness: 0.6 });
    const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10; pts.push(new THREE.Vector2(0.06 + Math.sin(a * Math.PI / 2) * 0.13, a * 0.09)); }
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ color: 0xb8b8bc, metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide })); R.add(bowl);
    this.flour = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), S(0xf2ecdc, { roughness: 1 })); this.flour.scale.set(1, 0.45, 1); this.flour.position.y = 0.03; R.add(this.flour);
    this.water = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), S(0xa8c8e0, { roughness: 0.05, transparent: true, opacity: 0 })); this.water.rotation.x = -Math.PI / 2; this.water.position.y = 0.035; R.add(this.water);
    const jug = this.jug = new THREE.Group(); jug.position.set(0.2, 0.18, -0.02); R.add(jug);
    const jb = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.13, 16), S(0xc06a38, { roughness: 0.5 })); jug.add(jb);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), S(0xc06a38)); sp.rotation.z = Math.PI / 2; sp.position.set(-0.05, 0.05, 0); jug.add(sp);
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.16, 6), S(0x9cc8e8, { transparent: true, opacity: 0.8 })); this.stream.position.set(0.12, 0.12, -0.02); this.stream.visible = false; R.add(this.stream);
    this.hL = hand(); this.hR = hand(); this.hL.position.set(-0.2, 0.16, 0.06); this.hR.position.set(0.2, 0.16, 0.06); this.hL.rotation.x = this.hR.rotation.x = 0.5; this.hL.scale.setScalar(0.8); this.hR.scale.setScalar(0.8); R.add(this.hL, this.hR); R.scale.setScalar(1.25);
    this.tips = ['اضغط مطوّل على «اسكب الماي» وصبّ شوية شوية — لا تكثّر!', 'هسّه اعجن: اضغط «يسار» و«يمين» بالتناوب'];
    this.btns = [[{ id: 'pour', label: '💧 اسكب الماي', hold: true }], [{ id: 'L', label: '✋ يسار' }, { id: 'R', label: 'يمين 🤚' }]];
    this.wl = 0; this.kn = 0; this.last = '';
  }
  tick_knead(dt) {
    if (this.stage === 0) {
      const p = !!this.hold.pour; this.jug.rotation.z += ((p ? 1.1 : 0) - this.jug.rotation.z) * Math.min(1, dt * 8); this.stream.visible = p && this.jug.rotation.z > 0.7;
      if (this.stream.visible) { this.wl += dt / 3.2; if ((this.pt = (this.pt || 0) - dt) <= 0) { this.pt = 0.5; Audio.play('pour'); } }
      this.water.material.opacity = Math.min(0.75, this.wl * 0.9); this.flour.material.color.setHex(this.wl > 0.5 ? 0xe8dcc0 : 0xf2ecdc);
      this.prog(this.wl);
      if (this.wl > 1.25) { this.wl = 0.85; this.say('كثّرت الماي! أبو حيدر ضاف طحين... كمّل بهدوء'); }
      if (!p && this.wl >= 1 && this.wl <= 1.25) { this.stage = 1; this.setTip(this.tips[1]); this.setBtns(this.btns[1]); this.prog(0); this.water.visible = false; this.flour.material.color.setHex(0xe9d9b5); this.say('زين! الماي مضبوط'); }
    } else {
      for (const [h, side] of [[this.hL, 'L'], [this.hR, 'R']]) { const k = h.userData.p || 0; h.userData.p = Math.max(0, k - dt * 4); const e = ease(h.userData.p); h.position.y = 0.16 - e * 0.1; h.position.x = (side === 'L' ? -0.2 : 0.2) * (1 - e * 0.7); h.rotation.x = 0.5 + e * 0.5; }
      const sq = 0.45 - Math.min(0.2, (this.hL.userData.p || 0) * 0.12 + (this.hR.userData.p || 0) * 0.12); this.flour.scale.set(1 + (0.45 - sq), sq, 1 - (0.45 - sq) * 0.5);
    }
  }
  tap_knead(id) {
    if (this.stage !== 1) return;
    if (id === this.last) { this.say('بالتناوب: يسار ثم يمين'); return; }
    this.last = id; (id === 'L' ? this.hL : this.hR).userData.p = 1; this.kn++; Audio.play('bandage');
    this.prog(this.kn / 16); this.flour.material.color.lerp(new THREE.Color(0xf6e8c6), 0.08);
    if (this.kn >= 16) this.finish();
  }

  // ================= الغرف (شاي، حمّص، سماد، طحين، خبز) =================
  build_scoop(d) {
    const R = this.root, c = new THREE.Color(d.color || 0x3a2416);
    const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.24, 14, 1, true), S(0xc8b48a, { side: THREE.DoubleSide, roughness: 1 })); sack.position.set(-0.17, 0, -0.05); R.add(sack);
    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), S(c, { roughness: 1 })); heap.scale.y = 0.4; heap.position.set(-0.17, 0.1, -0.05); R.add(heap);
    const bag = this.bag = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.2, 14, 1, true), S(d.bag || 0xe8e0d0, { side: THREE.DoubleSide, roughness: 1 })); bag.position.set(0.17, -0.02, 0); R.add(bag);
    this.fill = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.072, 0.01, 14), S(c, { roughness: 1 })); this.fill.position.set(0.17, -0.11, 0); R.add(this.fill);
    const sc = this.scp = new THREE.Group(); R.add(sc);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: d.tool === 'shovel' ? 0x6a6660 : 0xc9a24a, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide })); sc.add(cup);
    if (d.tool === 'shovel') cup.scale.set(1.6, 0.6, 2);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.16, 6), S(0x5a3a20)); hd.rotation.z = 1.2; hd.position.set(0.08, 0.03, 0); sc.add(hd);
    this.inCup = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), S(c, { roughness: 1 })); this.inCup.scale.y = 0.5; sc.add(this.inCup);
    this.hR = hand(); sc.add(this.hR); this.hR.position.set(0.16, 0.06, 0.05); this.hR.rotation.set(0.2, -0.5, 0);
    this.n = d.n || 5; this.got = 0; this.anim = -1; this.grams = 0;
    this.tips = [d.tip || 'اضغط «اغرف» حتى تعبّي الكيس', 'اضغط «كفى» لمّا الميزان يوصل المنطقة الخضراء'];
    this.btns = [d.weigh ? [{ id: 'go', label: '🥄 اغرف' }, { id: 'stop', label: '⚖️ كفى', primary: false }] : [{ id: 'go', label: d.tool === 'shovel' ? '🪣 اشلع بالمسحاة' : '🥄 اغرف' }]];
    if (d.weigh) { const sc2 = $('mg').querySelector('.mgw'); sc2.classList.add('on'); }
  }
  tick_scoop(dt) {
    const sc = this.scp;
    if (this.anim >= 0) {
      this.anim += dt / 0.8; const a = Math.min(1, this.anim), up = Math.sin(a * Math.PI);
      sc.position.set(-0.17 + 0.34 * ease(a), 0.12 + up * 0.12, -0.05 + 0.05 * a); sc.rotation.z = a > 0.75 ? (a - 0.75) * 4 * 1.6 : 0; this.inCup.visible = a < 0.85;
      if (a >= 1) { this.anim = -1; this.got++; const k = Math.min(1, this.got / this.n); this.fill.position.y = -0.11 + k * 0.17; this.fill.scale.setScalar(1 + k * 0.08);
        if (this.def.weigh) { this.grams += 140 + Math.floor(Math.random() * 110); this.showW(); if (this.grams > 1150) { this.grams -= 300; this.say('زاد كثير! رجّعت حفنة'); this.showW(); } }
        else { this.prog(k); if (this.got >= this.n) this.finish(); } }
    } else { sc.position.set(-0.17, 0.14 + Math.sin(this.t * 2) * 0.01, -0.05); sc.rotation.z = 0; this.inCup.visible = false; }
  }
  showW() { const w = this.grams, el = $('mg').querySelector('.mgw'); el.querySelector('b').textContent = w + ' غم'; el.querySelector('i').style.left = Math.min(100, w / 12) + '%'; this.prog(w / 1000); }
  tap_scoop(id) {
    if (id === 'stop') { if (this.grams >= 900 && this.grams <= 1100) { $('mg').querySelector('.mgw').classList.remove('on'); this.finish({ grams: this.grams }); } else this.say(this.grams < 900 ? 'بعده ناقص — الكيلو 1000 غم' : 'زايد — شيل شوية'); return; }
    if (this.anim >= 0) return; this.anim = 0; Audio.play('scoop');
  }

  // ================= تعبئة الجلكان من النهر (ابتعد عن بقعة النفط) =================
  build_water() {
    const R = this.root;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), S(0x3a6a7a, { roughness: 0.08, metalness: 0.2 })); w.rotation.x = -Math.PI / 2; w.position.y = -0.06; R.add(w);
    const oil = this.oil = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.88 })); oil.rotation.x = -Math.PI / 2; oil.position.y = -0.055; oil.scale.set(1.6, 1, 1); R.add(oil);
    const can = this.can = new THREE.Group(); R.add(can);
    can.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.07), S(0x2a5a2a, { roughness: 0.6 })));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10), S(0x2a2a2a)); cap.position.set(-0.04, 0.09, 0); can.add(cap);
    this.lvl = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.001, 0.071), S(0x9cd0ff, { emissive: 0x2a5a8a })); this.lvl.position.set(0.062, -0.075, 0); can.add(this.lvl);
    this.hR = hand(); this.hR.position.set(0.02, 0.12, 0.06); this.hR.rotation.set(0.9, 0, 0); can.add(this.hR);
    this.x = 0; this.wl = 0; this.dirty = 0;
    this.tips = ['حرّك الجلكان بعيد عن البقعة السودة، واضغط مطوّل «املأ»'];
    this.btns = [[{ id: 'L', label: '◀', hold: true, primary: false }, { id: 'fill', label: '💧 املأ', hold: true }, { id: 'R', label: '▶', hold: true, primary: false }]];
  }
  tick_water(dt) {
    this.x += ((this.hold.R ? 1 : 0) - (this.hold.L ? 1 : 0)) * dt * 0.5; this.x = Math.max(-0.4, Math.min(0.4, this.x));
    const ox = Math.sin(this.t * 0.9) * 0.3 + Math.sin(this.t * 2.1) * 0.06; this.oil.position.x = ox;
    const f = !!this.hold.fill; this.can.position.set(this.x, f ? -0.05 : 0.04, 0); this.can.rotation.z = f ? -0.5 : 0;
    if (f) { const inOil = Math.abs(this.x - ox) < 0.2; if (inOil) { this.dirty += dt; if (this.dirty > 0.35) { this.wl = Math.max(0, this.wl - 0.35); this.dirty = 0; this.say('دخل نفط! كبّيت شوية — ابتعد عن البقعة'); } } else this.wl += dt / 4.5; }
    this.lvl.scale.y = 1 + this.wl * 150; this.lvl.position.y = -0.075 + this.wl * 0.075; this.prog(this.wl);
    if (this.wl >= 1) this.finish();
  }

  // ================= الحفر والدفن =================
  build_dig() {
    const R = this.root; this.root.position.set(0, -0.7, -1.05);
    const soil = S(0x6a5236, { roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), soil); ground.rotation.x = -Math.PI / 2; R.add(ground);
    this.hole = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.01, 0.28), S(0x2a1e14, { roughness: 1 })); this.hole.position.y = 0.004; R.add(this.hole);
    this.mound = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), soil); this.mound.position.set(0.45, 0, -0.05); this.mound.scale.set(1, 0.01, 0.8); R.add(this.mound);
    const body = this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.38, 4, 10), S(0xf4f2ea, { roughness: 1 })); body.rotation.z = Math.PI / 2; body.position.set(0, 0.25, 0.2); body.visible = false; R.add(body);
    this.cover = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.01, 0.3), soil); this.cover.position.y = 0.005; this.cover.visible = false; R.add(this.cover);
    this.stone = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.12), S(0x9a9488, { roughness: 0.8 })); this.stone.position.set(-0.3, 0.09, 0); this.stone.visible = false; R.add(this.stone);
    const sv = this.shovel = new THREE.Group(); R.add(sv);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.7, 6), S(0x5a3a20)); hd.position.y = 0.35; sv.add(hd);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.012), new THREE.MeshStandardMaterial({ color: 0x777370, metalness: 0.7, roughness: 0.4 })); sv.add(bl);
    const h1 = hand(); h1.position.set(0, 0.55, 0.03); h1.rotation.set(1.4, 0, 0); sv.add(h1); const h2 = hand(); h2.position.set(0, 0.3, 0.03); h2.rotation.set(1.4, 0, 0); sv.add(h2);
    this.dug = 0; this.filled = 0; this.anim = -1; this.lower = 0;
    this.tips = ['احفر القبر: اضغط «احفر» مرّة ورا مرّة', 'أنزل الشهيد بهدوء: اضغط مطوّل «أنزل»', 'اهِل التراب على القبر', 'ضع الشاهد على راس القبر'];
    this.btns = [[{ id: 'go', label: '⛏️ احفر' }], [{ id: 'lower', label: '🤍 أنزل الشهيد', hold: true }], [{ id: 'go', label: '🪣 اهِل التراب' }], [{ id: 'stone', label: '🪦 ضع الشاهد' }]];
  }
  tick_dig(dt) {
    const sv = this.shovel;
    if (this.anim >= 0) {
      this.anim += dt / 0.55; const a = Math.min(1, this.anim);
      const fill = this.stage === 2;
      sv.position.set(fill ? 0.42 - 0.4 * a : 0.05 + 0.35 * a, 0.02 + Math.sin(a * Math.PI) * 0.25, 0.05); sv.rotation.set(-0.6 + Math.sin(a * Math.PI) * 0.4, 0, fill ? 0.3 : -0.3);
      if (a >= 1) { this.anim = -1; if (this.stage === 0) { this.dug++; const k = this.dug / 12; this.hole.scale.y = 1 + k * 40; this.hole.position.y = -k * 0.2 + 0.004; this.hole.material.color.setHex(0x1a120a); this.mound.scale.y = 0.05 + k * 0.6; this.prog(k); if (this.dug >= 12) this.next(1); }
        else if (this.stage === 2) { this.filled++; const k = this.filled / 10; this.cover.visible = true; this.cover.position.y = -0.18 + k * 0.2; this.cover.scale.set(1, 1 + k * 8, 1); this.mound.scale.y = Math.max(0.02, 0.65 - k * 0.6); this.prog(k); if (this.filled >= 10) this.next(3); } }
    } else if (this.stage === 1) {
      sv.visible = false; this.body.visible = true; if (this.hold.lower) this.lower = Math.min(1, this.lower + dt / 3); this.body.position.y = 0.25 - this.lower * 0.4; this.body.position.z = 0.2 * (1 - this.lower); this.prog(this.lower);
      if (this.lower >= 1) { Audio.play('bandage'); this.next(2); sv.visible = true; }
    } else { sv.position.set(0.05, 0.02 + Math.sin(this.t * 2) * 0.01, 0.05); sv.rotation.set(-0.6, 0, -0.3); }
  }
  next(st) { this.stage = st; this.setTip(this.tips[st]); this.setBtns(this.btns[st]); this.prog(0); }
  tap_dig(id) {
    if (id === 'stone') { this.stone.visible = true; Audio.play('bandage'); this.finish(); return; }
    if (this.anim >= 0 || (this.stage !== 0 && this.stage !== 2)) return; this.anim = 0; Audio.play('dig');
  }

  // ================= لفّ الضماد =================
  build_bandage() {
    const R = this.root;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 4, 12), S(0xb88664, { roughness: 0.7 })); arm.rotation.z = Math.PI / 2; R.add(arm);
    const cut = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.02), S(0x8a1a14)); cut.position.set(0.02, 0.046, 0); cut.rotation.x = -Math.PI / 2; R.add(cut);
    this.wraps = []; for (let i = 0; i < 10; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.008, 6, 20), S(0xf4f2ea, { roughness: 1 })); w.rotation.y = Math.PI / 2; w.rotation.z = 0.2; w.position.x = -0.09 + i * 0.022; w.visible = false; R.add(w); this.wraps.push(w); }
    this.roll = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 14), S(0xf4f2ea, { roughness: 1 })); this.roll.rotation.z = Math.PI / 2; R.add(this.roll);
    this.n = 0; this.ang = 0;
    this.tips = ['اضغط «لفّ» حتى تغطّي الجرح كامل'];
    this.btns = [[{ id: 'go', label: '🩹 لفّ' }]];
  }
  tick_bandage(dt) { this.ang += dt * 1.5; const x = -0.09 + Math.min(9, this.n) * 0.022; this.roll.position.set(x, Math.sin(this.ang * 4) * 0.07, Math.cos(this.ang * 4) * 0.07); }
  tap_bandage() { if (this.n >= 10) return; this.wraps[this.n].visible = true; this.n++; this.ang += 0.4; Audio.play('bandage'); this.prog(this.n / 10); if (this.n >= 10) this.finish(); }

  // ================= ربط منظّم الغاز =================
  build_gas() {
    const R = this.root;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 20), S(0x2a7a3a, { roughness: 0.5, metalness: 0.3 })); cyl.position.y = -0.15; R.add(cyl);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), cyl.material); top.position.y = 0.05; R.add(top);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.9, roughness: 0.3 })); valve.position.y = 0.2; R.add(valve);
    const reg = this.reg = new THREE.Group(); R.add(reg);
    const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 6), S(0xb8b8bc, { metalness: 0.8, roughness: 0.3 })); reg.add(rb);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 20, Math.PI), S(0xd06020)); hose.position.set(0.12, 0, 0); reg.add(hose);
    this.hR = hand(); this.hR.position.set(0.02, 0.06, 0.05); this.hR.rotation.set(1.2, 0, 0); reg.add(this.hR);
    this.turn = 0; this.y = 0.34;
    this.tips = ['ركّب المنظّم ولفّه ↻ حتى يشدّ زين', 'افتح الصمّام'];
    this.btns = [[{ id: 'go', label: '↻ لفّ المنظّم' }], [{ id: 'open', label: '🔥 افتح الصمّام' }]];
  }
  tick_gas(dt) { const tg = 0.34 - Math.min(1, this.turn / 6) * 0.11; this.y += (tg - this.y) * Math.min(1, dt * 8); this.reg.position.y = this.y; }
  tap_gas(id) { if (this.stage === 0) { this.turn++; this.reg.rotation.y -= 0.9; Audio.play('ui'); this.prog(this.turn / 6); if (this.turn >= 6) this.next(1); } else if (id === 'open') { Audio.play('fire'); this.finish(); } }

  // ================= تصوير السائح والملوية وراه =================
  build_photo(d) {
    this.tips = ['وجّه الكاميرا: السائح بالنص والملوية بالخلفية، واضغط «صوّر»'];
    this.btns = [[{ id: 'shot', label: '📸 صوّر' }]];
    this.target = d.target; this.bg = d.bg; this.tries = 0;
  }
  tick_photo() {
    const ok = this.check(); $('mg').classList.toggle('good', ok.ok);
  }
  check() {
    const cam = this.g.camera, P = V3(this.target.x, this.target.y, this.target.z).project(cam), Q = V3(this.bg.x, this.bg.y, this.bg.z).project(cam);
    const d = cam.position.distanceTo(V3(this.target.x, this.target.y, this.target.z));
    const inT = Math.abs(P.x) < 0.45 && Math.abs(P.y) < 0.6 && P.z < 1, inB = Math.abs(Q.x) < 0.85 && Math.abs(Q.y) < 0.85 && Q.z < 1;
    const vis = this.g.world.los(cam.position.x, cam.position.y, cam.position.z, this.target.x, this.target.y, this.target.z);
    return { ok: inT && inB && vis && d > 2.2 && d < 11, inT, inB, d };
  }
  tap_photo() {
    const c = this.check(); Audio.play('ui');
    Audio.play('shutter'); $('mg').classList.add('flash'); setTimeout(() => $('mg').classList.remove('flash'), 220);
    if (!c.ok) { this.tries++; this.say(!c.inT ? 'جون ما طلع بالصورة! خلّيه بالنص' : !c.inB ? 'الملوية ما طلعت! خلّيها وراه بالخلفية' : c.d <= 2.2 ? 'قريب كلش، ارجع شوية' : 'بعيد، قرّب شوية'); return; }
    this.g.wantSnap = img => { this.photo = img; this.finish({ photo: img }); };
  }
}
