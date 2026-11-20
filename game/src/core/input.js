// المدخلات: لوحة مفاتيح + فأرة (قفل المؤشر) + لمس (عصا وسحب للنظر وأزرار) + يد تحكم
import { Settings } from './settings.js';

const KEYMAP = {
  KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'jump', ControlLeft: 'crouch', KeyC: 'crouch', ShiftLeft: 'walk', KeyR: 'reload', KeyE: 'use', KeyG: 'grenade',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', KeyQ: 'swap', Tab: 'score', Escape: 'pause', KeyF: 'inspect', KeyB: 'buy',
};

export const Input = {
  down: new Set(), pressed: new Set(), lookX: 0, lookY: 0, mx: 0, mz: 0, wheel: 0,
  locked: false, isTouch: false, enabled: true, el: null,
  stick: { id: -1, ox: 0, oy: 0, x: 0, y: 0 }, looks: new Map(), btnTouches: new Map(),
  init(el) {
    this.el = el;
    this.isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
    window.addEventListener('keydown', e => {
      const tg = e.target && e.target.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA') return;
      const a = KEYMAP[e.code];
      if (a) { if (a !== 'pause') e.preventDefault(); if (!this.down.has(a)) this.pressed.add(a); this.down.add(a); }
    });
    window.addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) this.down.delete(a); });
    window.addEventListener('blur', () => { this.down.clear(); this.stick.id = -1; this.looks.clear(); });
    el.addEventListener('mousedown', e => {
      if (this.isTouch) return;
      if (!this.locked && this.enabled) { this.requestLock(); return; }
      if (e.button === 0) { this.down.add('fire'); this.pressed.add('fire'); }
      if (e.button === 2) { this.down.add('ads'); this.pressed.add('ads'); }
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.down.delete('fire'); if (e.button === 2) this.down.delete('ads'); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === el; if (!this.locked) this.down.clear(); });
    window.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.lookX += e.movementX * 0.0022; this.lookY += e.movementY * 0.0022;
    });
    this.initTouch();
  },
  requestLock() { try { const p = this.el.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } },
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); },
  initTouch() {
    const root = document.getElementById('touch');
    if (!root) return;
    const stickEl = document.getElementById('stick'), knob = document.getElementById('knob');
    const scale = () => 0.0055 * Settings.sens;
    const onStart = e => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        const b = t.target.closest && t.target.closest('[data-a]');
        if (b) {
          const a = b.dataset.a;
          this.btnTouches.set(t.identifier, { a, el: b, x: t.clientX, y: t.clientY });
          b.classList.add('on');
          if (a === 'ads' || a === 'crouch') { if (this.down.has(a + 'T')) this.down.delete(a + 'T'); else this.down.add(a + 'T'); this.pressed.add(a); }
          else { this.down.add(a); this.pressed.add(a); }
          if (a === 'fire' || a === 'fire2') this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
          continue;
        }
        if (t.clientX < innerWidth * 0.42 && this.stick.id < 0) {
          const s = this.stick; s.id = t.identifier; s.ox = t.clientX; s.oy = t.clientY; s.x = 0; s.y = 0;
          stickEl.style.left = (t.clientX - 60) + 'px'; stickEl.style.top = (t.clientY - 60) + 'px'; stickEl.classList.add('on');
        } else this.looks.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      e.preventDefault();
    };
    const onMove = e => {
      for (const t of e.changedTouches) {
        const s = this.stick;
        if (t.identifier === s.id) {
          let dx = t.clientX - s.ox, dy = t.clientY - s.oy; const r = 52 * Settings.touchSize, d = Math.hypot(dx, dy);
          if (d > r) { s.ox += dx * (1 - r / d); s.oy += dy * (1 - r / d); dx = t.clientX - s.ox; dy = t.clientY - s.oy; stickEl.style.left = (s.ox - 60) + 'px'; stickEl.style.top = (s.oy - 60) + 'px'; }
          s.x = dx / r; s.y = dy / r; knob.style.transform = `translate(${dx}px,${dy}px)`;
          continue;
        }
        const l = this.looks.get(t.identifier);
        if (l) { this.lookX += (t.clientX - l.x) * scale(); this.lookY += (t.clientY - l.y) * scale(); l.x = t.clientX; l.y = t.clientY; }
      }
      e.preventDefault();
    };
    const onEnd = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) { this.stick.id = -1; this.stick.x = this.stick.y = 0; knob.style.transform = ''; stickEl.classList.remove('on'); }
        this.looks.delete(t.identifier);
        const b = this.btnTouches.get(t.identifier);
        if (b) { this.btnTouches.delete(t.identifier); b.el.classList.remove('on'); if (b.a !== 'ads' && b.a !== 'crouch') this.down.delete(b.a); }
      }
    };
    root.addEventListener('touchstart', onStart, { passive: false });
    root.addEventListener('touchmove', onMove, { passive: false });
    root.addEventListener('touchend', onEnd); root.addEventListener('touchcancel', onEnd);
  },
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(x => x && x.connected);
    if (!p) return null;
    const dz = v => Math.abs(v) < 0.15 ? 0 : v;
    this.lookX += dz(p.axes[2] || 0) * 0.05 * Settings.sens; this.lookY += dz(p.axes[3] || 0) * 0.05 * Settings.sens;
    const map = [['jump', 0], ['crouch', 1], ['reload', 2], ['swap', 3], ['grenade', 4], ['use', 5], ['ads', 6], ['fire', 7], ['score', 8], ['pause', 9]];
    for (const [a, i] of map) { const v = p.buttons[i] && p.buttons[i].pressed; if (v && !this.down.has(a + 'P')) { this.pressed.add(a); } if (v) this.down.add(a + 'P'); else this.down.delete(a + 'P'); }
    return { x: dz(p.axes[0] || 0), y: dz(p.axes[1] || 0) };
  },
  // يُستدعى كل إطار: يحسب محاور الحركة
  update() {
    const pad = this.pollPad();
    let x = 0, z = 0;
    if (this.down.has('left')) x -= 1; if (this.down.has('right')) x += 1;
    if (this.down.has('fwd')) z += 1; if (this.down.has('back')) z -= 1;
    if (this.stick.id >= 0) { x = this.stick.x; z = -this.stick.y; }
    if (pad && (pad.x || pad.y)) { x = pad.x; z = -pad.y; }
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    this.mx = x; this.mz = z;
  },
  held(a) { return this.down.has(a) || this.down.has(a + 'P') || this.down.has(a + 'T'); },
  take(a) { if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; },
  takeLook() { const r = [this.lookX, this.lookY]; this.lookX = 0; this.lookY = 0; return r; },
  endFrame() { this.pressed.clear(); this.wheel = 0; },
  clearToggles() { this.down.delete('adsT'); this.down.delete('crouchT'); },
};
