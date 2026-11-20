// ===================== الإدخال: لوحة مفاتيح + لمس + يد تحكم =====================
const KEYMAP = {
  KeyE: 'interact', Enter: 'interact', KeyQ: 'gadget', KeyF: 'gadget', Space: 'dash', Tab: 'cycle', KeyR: 'cycle',
  KeyC: 'echo', KeyH: 'hint', Escape: 'pause', KeyP: 'pause', KeyM: 'map', Digit1: 'g1', Digit2: 'g2', Digit3: 'g3', Digit4: 'g4',
};
const Input = {
  keys: new Set(), pressed: new Set(), mx: 0, my: 0, mag: 0,
  holdInteract: false, holdKey: false, holdTouch: false, holdPad: false,
  joy: { id: null, cx: 0, cy: 0, dx: 0, dy: 0, r: 56 },
  padX: 0, padY: 0, padMag: 0, padPrev: {}, lastDevice: 'keyboard',
  isTouch: false,
  init() {
    this.isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
    if (this.isTouch) this.lastDevice = 'touch';
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.holdKey = false; this.resetJoy(); });
    const zone = $('#joyZone');
    zone.addEventListener('pointerdown', e => this.joyDown(e));
    window.addEventListener('pointermove', e => this.joyMove(e), { passive: false });
    window.addEventListener('pointerup', e => this.joyUp(e));
    window.addEventListener('pointercancel', e => this.joyUp(e));
    $$('.tbtn').forEach(b => {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        this.press(a); b.classList.add('held');
        if (a === 'interact') this.holdTouch = true;
        this.lastDevice = 'touch'; Sound.init();
      });
      const up = () => { b.classList.remove('held'); if (a === 'interact') this.holdTouch = false; };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault());
  },
  onKey(e, down) {
    const code = e.code, tg = e.target && e.target.tagName;
    if (down && (tg === 'TEXTAREA' || tg === 'INPUT')) return; // الكتابة في مربع النص لا تحرّك اللعبة
    if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'Space' || code === 'Tab') e.preventDefault();
    if (down) {
      if (!this.keys.has(code)) {
        const a = KEYMAP[code];
        if (a && !e.repeat) this.press(a);
      }
      this.keys.add(code);
      if (code === 'KeyE' || code === 'Enter') this.holdKey = true;
      this.lastDevice = 'keyboard';
    } else {
      this.keys.delete(code);
      if (code === 'KeyE' || code === 'Enter') this.holdKey = false;
    }
  },
  press(a) { this.pressed.add(a); },
  take(a) { if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; },
  flush() { this.pressed.clear(); },
  joyDown(e) {
    if (this.joy.id !== null) return;
    e.preventDefault();
    const j = this.joy;
    j.id = e.pointerId; j.cx = e.clientX; j.cy = e.clientY; j.dx = j.dy = 0; j.r = 56 * (Settings.touchSize || 1);
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { }
    this.lastDevice = 'touch'; Sound.init();
    this.joyVisual();
  },
  joyMove(e) {
    const j = this.joy;
    if (e.pointerId !== j.id) return;
    e.preventDefault();
    let dx = e.clientX - j.cx, dy = e.clientY - j.cy;
    const l = Math.hypot(dx, dy);
    if (l > j.r) { // عصا عائمة: القاعدة تتبع الإصبع
      const ex = l - j.r; j.cx += dx / l * ex; j.cy += dy / l * ex;
      dx = e.clientX - j.cx; dy = e.clientY - j.cy;
    }
    j.dx = dx; j.dy = dy;
    this.joyVisual();
  },
  joyUp(e) { if (e.pointerId !== this.joy.id) return; this.resetJoy(); },
  resetJoy() { this.joy.id = null; this.joy.dx = this.joy.dy = 0; this.joyVisual(); },
  joyVisual() {
    const base = $('#joyBase'), knob = $('#joyKnob');
    if (!base) return;
    const j = this.joy;
    if (j.id === null) { base.classList.remove('on'); base.style.left = ''; base.style.top = ''; knob.style.transform = 'translate(-50%,-50%)'; return; }
    base.classList.add('on');
    base.style.left = j.cx + 'px'; base.style.top = j.cy + 'px';
    knob.style.transform = 'translate(calc(-50% + ' + j.dx.toFixed(1) + 'px), calc(-50% + ' + j.dy.toFixed(1) + 'px))';
  },
  pollPad() {
    this.padMag = 0; this.holdPad = false;
    const gps = navigator.getGamepads ? navigator.getGamepads() : null;
    if (!gps) return;
    let gp = null;
    for (let i = 0; i < gps.length; i++) if (gps[i] && gps[i].connected) { gp = gps[i]; break; }
    if (!gp) return;
    let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const B = gp.buttons;
    if (B[12] && B[12].pressed) ay = -1; if (B[13] && B[13].pressed) ay = 1;
    if (B[14] && B[14].pressed) ax = -1; if (B[15] && B[15].pressed) ax = 1;
    const l = Math.hypot(ax, ay);
    if (l > 0.2) { this.padX = ax / l; this.padY = ay / l; this.padMag = clamp((l - 0.2) / 0.75, 0, 1); this.lastDevice = 'pad'; }
    const map = { 0: 'interact', 1: 'dash', 2: 'gadget', 3: 'echo', 4: 'cycle', 5: 'cycle', 8: 'hint', 9: 'pause' };
    for (const b in map) {
      const p = !!(B[b] && B[b].pressed);
      if (p && !this.padPrev[b]) { this.press(map[b]); this.lastDevice = 'pad'; }
      this.padPrev[b] = p;
    }
    this.holdPad = !!(B[0] && B[0].pressed);
  },
  poll() {
    let x = 0, y = 0, mag = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; mag = (k.has('ShiftLeft') || k.has('ShiftRight')) ? 0.45 : 1; }
    const j = this.joy;
    if (j.id !== null) {
      const jl = Math.hypot(j.dx, j.dy);
      if (jl > 5) { const m = clamp(jl / j.r, 0, 1); if (m > mag) { x = j.dx / jl; y = j.dy / jl; mag = m; } }
    }
    this.pollPad();
    if (this.padMag > mag) { x = this.padX; y = this.padY; mag = this.padMag; }
    this.mx = x; this.my = y; this.mag = mag;
    this.holdInteract = this.holdKey || this.holdTouch || this.holdPad;
  },
};
