// المدخلات: لوحة مفاتيح وفأرة (قفل المؤشر)، يد تحكم، جيروسكوب، ولمس متعدد الأصابع
// اللمس: طبقة واحدة بملء الشاشة (touch-action:none) وموزّع يربط كل إصبع (pointerId) بعنصر تحكم واحد لحظة لمسه:
// زر، أو العصا العائمة يساراً، أو منطقة النظر يميناً. زر الإطلاق يحرّك النظر أيضاً كما في ببجي.
import { Settings } from './settings.js';

const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ControlLeft: 'crouch', KeyC: 'crouch', ShiftLeft: 'walk', KeyR: 'reload', KeyG: 'grenade', KeyQ: 'leanL', KeyE: 'leanR',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', KeyX: 'swap', Tab: 'score', Escape: 'pause', KeyF: 'use', KeyI: 'inspect', KeyV: 'drone', KeyB: 'loadout', KeyM: 'map',
};
const TOUCH_K = 0.0046, MOUSE_K = 0.0021; // راديان لكل بكسل قبل الحساسية

export const Input = {
  down: new Set(), pressed: new Set(), toggles: new Set(),
  lookX: 0, lookY: 0, mx: 0, mz: 0, wheel: 0,
  locked: false, isTouch: false, enabled: true, el: null,
  ads: false, adsDownT: 0, adsWasOn: false, lastTouchLook: 0,
  // اللمس
  layer: null, controls: [], owners: new Map(),
  stick: { pid: -1, ox: 0, oy: 0, x: 0, y: 0, base: null, knob: null },
  init(el) {
    this.el = el;
    this.isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    window.addEventListener('keydown', e => {
      const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
      const a = KEYMAP[e.code];
      if (a) { if (a !== 'pause') e.preventDefault(); if (!this.down.has(a)) this.press(a); this.down.add(a); }
    });
    window.addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) this.release(a); });
    window.addEventListener('blur', () => this.reset());
    el.addEventListener('mousedown', e => {
      if (e.button === 0 && !this.locked && this.enabled && !this.isTouch) { this.requestLock(); return; }
      if (!this.locked) return;
      if (e.button === 0) { this.down.add('fire'); this.press('fire'); }
      if (e.button === 2) this.adsPress();
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.release('fire'); if (e.button === 2) this.adsRelease(); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; if (!this.locked) { this.release('fire'); } });
    window.addEventListener('mousemove', e => { if (!this.locked) return; this.lookX += e.movementX * MOUSE_K; this.lookY += e.movementY * MOUSE_K; });
    // جيروسكوب: معدل الدوران بالدرجات/ث
    window.addEventListener('devicemotion', e => {
      const g = Settings.gyro; if (g === 'off' || !this.enabled || !e.rotationRate) return;
      if (g === 'scope' && !this.ads) return;
      const r = e.rotationRate, dt = (e.interval > 1 ? e.interval / 1000 : e.interval) || 0.016;
      const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 90, s = ang === 270 || ang === -90 ? -1 : 1;
      const k = Math.PI / 180 * dt * Settings.gyroSens * 1.6;
      this.gyroX = (this.gyroX || 0) - (r.beta || 0) * k * s;
      this.gyroY = (this.gyroY || 0) - (r.gamma || 0) * k * s;
    });
  },
  press(a) { this.pressed.add(a); this.down.add(a); if (a === 'ads') this.adsPress(); },
  release(a) { this.down.delete(a); },
  reset() { this.down.clear(); this.owners.clear(); this.stickEnd(); for (const c of this.controls || []) { c.busy = false; if (c.el) c.el.classList.remove('on'); } },
  requestLock() { try { const p = this.el.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } },
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); },
  // ---------- التصويب: نقرة = تبديل، ضغط مطوّل = طالما الإصبع موضوع (النمط المختلط) ----------
  adsPress(ts) {
    const m = Settings.adsMode;
    this.adsDownT = ts || performance.now(); this.adsWasOn = this.ads;
    if (m === 'hold') this.ads = true;
    else if (m === 'tap') this.ads = !this.ads;
    else this.ads = true;
  },
  adsRelease(ts) {
    const m = Settings.adsMode, held = (ts || performance.now()) - this.adsDownT;
    if (m === 'hold') this.ads = false;
    else if (m === 'mixed') { if (held > 330) this.ads = false; else if (this.adsWasOn) this.ads = false; }
  },
  setAds(v) { this.ads = v; },
  // ---------- اللمس ----------
  // controls: [{ id, el, action, look, toggle, round, pad }] بترتيب الأولوية
  bindTouch(layer, controls, stickBase, stickKnob) {
    this.layer = layer; this.controls = controls; this.stick.base = stickBase; this.stick.knob = stickKnob;
    const P = !!window.PointerEvent;
    if (P) {
      layer.addEventListener('pointerdown', e => this.tDown(e.pointerId, e.clientX, e.clientY, e), { passive: false });
      layer.addEventListener('pointermove', e => this.tMove(e.pointerId, e.clientX, e.clientY, e), { passive: false });
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) layer.addEventListener(t, e => this.tUp(e.pointerId, e.timeStamp), { passive: false });
    } else {
      const each = (e, f) => { e.preventDefault(); for (const t of e.changedTouches) f(t.identifier, t.clientX, t.clientY, null); };
      layer.addEventListener('touchstart', e => each(e, (i, x, y) => this.tDown(i, x, y, null)), { passive: false });
      layer.addEventListener('touchmove', e => each(e, (i, x, y) => this.tMove(i, x, y, null)), { passive: false });
      layer.addEventListener('touchend', e => each(e, i => this.tUp(i, e.timeStamp)), { passive: false });
      layer.addEventListener('touchcancel', e => each(e, i => this.tUp(i, e.timeStamp)), { passive: false });
    }
    layer.addEventListener('contextmenu', e => e.preventDefault());
  },
  hit(c, x, y) {
    if (!c.el || c.hidden || c.el.offsetParent === null) return false;
    const r = c.el.getBoundingClientRect(); if (!r.width) return false;
    const pad = c.pad ?? 8;
    if (c.round) { const cx = r.left + r.width / 2, cy = r.top + r.height / 2; return Math.hypot(x - cx, y - cy) <= r.width / 2 + pad; }
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  },
  tDown(id, x, y, e) {
    if (e) { if (e.pointerType === 'mouse' && !this.isTouch) return; e.preventDefault(); try { this.layer.setPointerCapture(id); } catch (x) { } }
    this.isTouch = true;
    if (!this.enabled) return;
    const c = this.controls.find(c => this.hit(c, x, y));
    if (c) {
      if (c.busy) return;
      c.busy = true; if (c.el) c.el.classList.add('on');
      this.owners.set(id, { type: 'btn', c, lx: x, ly: y });
      if (c.tap) { if (!c.tapUp) c.tap(x, y); return; }
      if (c.action === 'ads') this.adsPress(e ? e.timeStamp : 0);
      else if (c.toggle) { if (this.toggles.has(c.action)) this.toggles.delete(c.action); else { this.toggles.add(c.action); if (c.excl) this.setToggle(c.excl, false); } this.pressed.add(c.action); }
      else this.press(c.action);
      return;
    }
    const W = innerWidth, H = innerHeight;
    if (x < W * 0.42 && y > H * 0.28 && this.stick.pid < 0) {
      const s = this.stick, R = this.stickR();
      s.pid = id; s.ox = Math.max(R + 6, Math.min(W * 0.42 - R, x)); s.oy = Math.max(H * 0.28 + R * 0.5, Math.min(H - R - 6, y)); s.x = 0; s.y = 0;
      this.owners.set(id, { type: 'stick' });
      this.stickDraw(x - s.ox, y - s.oy, true);
      this.tMove(id, x, y, null);
      return;
    }
    this.owners.set(id, { type: 'look', lx: x, ly: y });
  },
  tMove(id, x, y, e) {
    const o = this.owners.get(id); if (!o) return;
    if (e) e.preventDefault();
    if (o.type === 'stick') {
      const s = this.stick, R = this.stickR();
      let dx = x - s.ox, dy = y - s.oy; const d = Math.hypot(dx, dy);
      if (d > R * 1.25) { const k = 1 - R * 1.25 / d; s.ox += dx * k; s.oy += dy * k; dx = x - s.ox; dy = y - s.oy; } // العصا تتبع الإصبع
      const L = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
      const v = L < 0.12 ? 0 : (L - 0.12) / 0.88;
      s.x = Math.cos(a) * v; s.y = Math.sin(a) * v;
      this.stickDraw(Math.cos(a) * Math.min(R, Math.hypot(dx, dy)), Math.sin(a) * Math.min(R, Math.hypot(dx, dy)), true);
      return;
    }
    if (o.type === 'btn') { o.mx = x; o.my = y; }
    if (o.type === 'look' || (o.type === 'btn' && o.c.look)) {
      const dx = x - o.lx, dy = y - o.ly; o.lx = x; o.ly = y;
      // تسارع خفيف يجعل الالتفاف السريع أسهل مع بقاء الدقة في الحركات الصغيرة
      const m = Math.hypot(dx, dy), acc = 1 + 0.35 * Math.min(m / 40, 1);
      this.lookX += dx * TOUCH_K * acc; this.lookY += dy * TOUCH_K * acc; this.lastTouchLook = performance.now();
    }
  },
  tUp(id, ts) {
    const o = this.owners.get(id); if (!o) return;
    this.owners.delete(id);
    if (o.type === 'stick') { this.stickEnd(); return; }
    if (o.type === 'btn') {
      const c = o.c; c.busy = false;
      if (c.el && !(c.toggle && this.toggles.has(c.action))) c.el.classList.remove('on');
      // أزرار تفتح شاشة (الخريطة، الإيقاف...): تُنفَّذ عند رفع الإصبع كي لا تسقط اللمسة على الشاشة المفتوحة
      if (c.tap) { if (c.tapUp && Math.hypot((o.mx ?? o.lx) - o.lx, (o.my ?? o.ly) - o.ly) < 40) { this.shield(); c.tap(o.lx, o.ly); } return; }
      if (c.action === 'ads') this.adsRelease(ts);
      else if (!c.toggle) this.release(c.action);
    }
  },
  stickR() { return 58 * (Settings.touchSize || 1); },
  stickDraw(dx, dy, on) {
    const s = this.stick; if (!s.base) return;
    if (on) { s.base.style.left = s.ox + 'px'; s.base.style.top = s.oy + 'px'; s.base.classList.add('on'); }
    s.knob.style.transform = `translate(${dx}px,${dy}px)`;
  },
  stickEnd() {
    const s = this.stick; s.pid = -1; s.x = 0; s.y = 0;
    for (const [k, o] of this.owners) if (o.type === 'stick') this.owners.delete(k);
    if (s.base) { s.base.classList.remove('on'); s.base.style.left = ''; s.base.style.top = ''; s.knob.style.transform = ''; }
  },
  setToggle(a, v) { if (v) this.toggles.add(a); else this.toggles.delete(a); const c = this.controls.find(c => c.action === a); if (c && c.el) c.el.classList.toggle('on', !!v); },
  clearToggles() { for (const a of [...this.toggles]) this.setToggle(a, false); this.ads = false; },
  // ---------- يد التحكم ----------
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(x => x && x.connected);
    if (!p) return null;
    const dz = v => Math.abs(v) < 0.15 ? 0 : v;
    this.lookX += dz(p.axes[2] || 0) * 0.05; this.lookY += dz(p.axes[3] || 0) * 0.05;
    const map = [['jump', 0], ['crouch', 1], ['reload', 2], ['swap', 3], ['leanL', 4], ['leanR', 5], ['ads', 6], ['fire', 7], ['score', 8], ['pause', 9], ['map', 16]];
    for (const [a, i] of map) {
      const v = p.buttons[i] && p.buttons[i].pressed, was = this.down.has(a + 'P');
      if (v && !was) { this.pressed.add(a); if (a === 'ads') this.adsPress(); }
      if (!v && was && a === 'ads') this.adsRelease();
      if (v) this.down.add(a + 'P'); else this.down.delete(a + 'P');
    }
    return { x: dz(p.axes[0] || 0), y: dz(p.axes[1] || 0) };
  },
  // يُستدعى كل إطار: يحسب محاور الحركة
  update() {
    const pad = this.pollPad();
    let x = 0, z = 0;
    if (this.down.has('left')) x -= 1; if (this.down.has('right')) x += 1;
    if (this.down.has('fwd')) z += 1; if (this.down.has('back')) z -= 1;
    if (this.stick.pid >= 0) { x = this.stick.x; z = -this.stick.y; }
    if (pad && (pad.x || pad.y)) { x = pad.x; z = -pad.y; }
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    this.mx = x; this.mz = z;
    if (this.gyroX || this.gyroY) { this.lookX += this.gyroX || 0; this.lookY += this.gyroY || 0; this.gyroX = this.gyroY = 0; }
  },
  held(a) { return this.down.has(a) || this.down.has(a + 'P'); },
  on(a) { return this.toggles.has(a); },
  // درع نقرات قصير: يمنع «النقرة الشبحية» التي يولّدها المتصفح بعد اللمس من الضغط على عناصر الشاشة التي فُتحت للتو
  shield(ms = 380) {
    this.shieldUntil = performance.now() + ms;
    if (!this.shieldOn) { this.shieldOn = true; document.addEventListener('click', e => { if (performance.now() < this.shieldUntil) { e.stopPropagation(); e.preventDefault(); } }, true); }
  },
  take(a) { if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; },
  takeLook() { const r = [this.lookX, this.lookY]; this.lookX = 0; this.lookY = 0; return r; },
  endFrame() { this.pressed.clear(); this.wheel = 0; },
};
