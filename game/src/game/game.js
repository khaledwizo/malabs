// اللعبة: تربط المحاكاة بالرسوم والصوت والواجهة، مع كاميرا الشخص الأول والمشاهدة بعد السقوط
import * as THREE from 'three';
import { Settings } from '../core/settings.js';
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { Sim, TEAMS, dirFrom } from '../sim/sim.js';
import { WEAPONS, SCOPES, NADES, validLoadout, defaultLoadout } from '../sim/weapons.js';
import { eyeHeight, PH } from '../sim/move.js';
import { CharModel } from './chars.js';
import { ViewModel } from './viewmodel.js';
import { buildGun } from './gunmodels.js';
import { CHAR_ORDER } from './chardefs.js';
import { FX } from '../gfx/fx.js';
import { UI } from '../ui/ui.js';
import { F } from '../world/collide.js';

const STEP = 1 / 60;
const BOT_NAMES = ['يوسف', 'حيدر', 'زيد', 'عمر', 'مصطفى', 'ليث', 'أنمار', 'كرار', 'بلال', 'طارق', 'سجّاد', 'مرتضى', 'حسين', 'رعد', 'وسام'];

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // renderer, scene, camera, world, info, Q, sunDir
    this.fx = new FX(this.scene, this.Q);
    this.vm = new ViewModel();
    this.models = new Map(); this.prev = new Map(); this.sim = null; this.me = -1; this.paused = false;
    this.yaw = 0; this.pitch = 0; this.acc = 0; this.queued = {}; this.punchV = [0, 0]; this.shake = 0; this.t = 0;
    this.spec = null; this.specT = 0; this.flashA = 0; this.hurtA = 0; this.stepAcc = new Map(); this.nadeMeshes = new Map();
    this.menuMode = 'menu'; this.menuChar = 'khaled'; this.menuT = 0; this.lineup = [];
    this.raycaster = new THREE.Raycaster();
    this.buildLineup();
    this.buildRadarBg();
  }
  // ---------- القوائم: كاميرا سينمائية وعرض الشخصيات ----------
  buildLineup() {
    const ids = CHAR_ORDER, guns = ['rafid', 'saqr', 'zawba', 'nisr'];
    ids.forEach((id, i) => { const m = new CharModel(id, i % 2); m.root.position.set(-2.4 + i * 1.6, 0, 23.6); m.setWeapon(guns[i], i === 1 ? 'x8' : null); this.scene.add(m.root); this.lineup.push(m); });
  }
  menuView(mode, ch) { this.menuMode = mode; if (ch) this.menuChar = ch; this.menuWeaponId = null; }
  menuWeapon(id, scope) { this.menuWeaponId = id; this.vm.setChar(Settings.char); this.vm.setWeapon(id, scope); this.vm.inspectT = 0.3; }
  updateMenu(dt) {
    this.menuT += dt;
    const cam = this.camera;
    if (this.menuMode === 'chars') {
      const i = CHAR_ORDER.indexOf(this.menuChar), tx = -2.4 + i * 1.6;
      const target = new THREE.Vector3(tx - 0.9, 1.45, 26.0);
      cam.position.lerp(target, Math.min(1, dt * 3));
      const look = new THREE.Vector3(tx - 0.5, 1.25, 23.6);
      cam.lookAt(look);
    } else {
      // دوران بطيء فوق الشريعة باتجاه السوق
      const a = this.menuT * 0.05;
      const target = new THREE.Vector3(Math.sin(a) * 10 + 6, 5.2 + Math.sin(a * 0.7) * 0.8, 32.6);
      cam.position.lerp(target, Math.min(1, dt * 1.5));
      cam.lookAt(new THREE.Vector3(Math.sin(a) * 6 - 4, 4.5, 10));
    }
    this.lineup.forEach((m, i) => { const sel = this.menuMode === 'chars' && CHAR_ORDER[i] === this.menuChar; m.update({ yaw: Math.PI + (sel ? Math.sin(this.menuT * 0.8) * 0.5 : 0.15 * (i - 1.5)), pitch: sel ? -0.05 : 0, speed: 0, vx: 0, vz: 0, crouch: 0, onGround: true, alive: true }, dt); m.root.visible = this.menuMode === 'chars'; });
  }
  // ---------- بدء المباراة ----------
  startMatch(o) {
    this.quit(true);
    const sim = this.sim = new Sim(this.world, { mode: o.mode, roundsToWin: o.roundsToWin, difficulty: o.difficulty, seed: Date.now() & 0xffff });
    const me = sim.addPlayer({ name: o.name, team: o.team, char: o.char, loadout: o.loadout });
    this.me = me.id;
    let ni = Math.floor(Math.random() * BOT_NAMES.length);
    for (let t = 0; t < 2; t++) for (let k = (t === o.team ? 1 : 0); k < o.size; k++) sim.addPlayer({ name: BOT_NAMES[ni++ % BOT_NAMES.length], team: t, bot: true, char: CHAR_ORDER[Math.floor(Math.random() * 4)], loadout: defaultLoadout(o.mode) });
    sim.start();
    this.yaw = me.yaw; this.pitch = 0; this.acc = 0; this.paused = false; this.spec = null;
    for (const m of this.lineup) m.root.visible = false;
    this.vm.setChar(o.char);
    Input.enabled = true; if (!Input.isTouch) Input.requestLock();
    UI.banner('الجولة 1', 'استعد — ' + TEAMS[me.team].name, '', 2.4);
    Audio.play('roundStart');
  }
  quit(keep) {
    if (this.sim) { for (const m of this.models.values()) this.scene.remove(m.root); this.models.clear(); for (const n of this.nadeMeshes.values()) this.scene.remove(n); this.nadeMeshes.clear(); }
    this.sim = null; this.me = -1; this.paused = false; Input.exitLock();
    if (!keep) for (const m of this.lineup) m.root.visible = true;
  }
  pause() { if (!this.sim || this.paused) return; this.paused = true; Input.exitLock(); UI.open('pause'); }
  resume() { this.paused = false; UI.closeScreens(); UI.hud(true); if (!Input.isTouch) Input.requestLock(); }
  queueSlot(s) { this.queued.slot = s; }
  setMyLoadout(L) { if (this.sim) this.sim.setLoadout(this.me, L); }
  setMyChar(c) { if (this.sim) { this.sim.setChar(this.me, c); this.vm.setChar(c); } }
  get mp() { return this.sim && this.sim.players.get(this.me); }
  // ---------- الإطار ----------
  frame(dt, now) {
    this.t += dt;
    Input.update();
    if (!this.sim) { this.updateMenu(dt); this.renderMenu(dt); Input.endFrame(); return; }
    const sim = this.sim, me = this.mp;
    if (Input.take('pause') && !this.paused) { this.pause(); }
    if (Input.take('buy') && sim.phase === 'buy') UI.open('loadout');
    UI.showScore(Input.held('score') && !this.paused);
    // النظر
    const [lx, ly] = Input.takeLook();
    const zoom = this.zoomNow();
    const ss = Settings.sens * (zoom > 1.05 ? Settings.adsSens / Math.pow(zoom, 0.85) : 1);
    if (!this.paused && me && me.alive) { this.yaw -= lx * ss; this.pitch -= ly * ss * (Settings.invertY ? -1 : 1); this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch)); }
    if (!this.paused) {
      // الأوامر
      const cmd = {
        mx: Input.mx, mz: Input.mz, yaw: this.yaw, pitch: this.pitch, jump: Input.held('jump'), crouch: Input.held('crouch'), walk: Input.held('walk'),
        fire: (Input.held('fire') || Input.held('fire2')) && !UI.screen, ads: Input.held('ads'), reload: Input.take('reload') || this.queued.reload, slot: 0, swap: Input.take('swap') || Input.wheel !== 0,
      };
      for (let s = 1; s <= 4; s++) if (Input.take('slot' + s)) cmd.slot = s;
      if (Input.take('grenade')) cmd.slot = me && me.slot === 4 ? me.prevSlot : 4;
      if (this.queued.slot) cmd.slot = this.queued.slot;
      if (Input.take('inspect')) this.vm.inspect();
      this.queued = {};
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        for (const p of sim.players.values()) this.prev.set(p.id, [p.pos[0], p.pos[1], p.pos[2], p.crouch]);
        if (me) sim.input(this.me, cmd);
        sim.step(STEP); this.handleEvents();
        cmd.reload = false; cmd.swap = false; cmd.slot = 0;
        this.acc -= STEP; steps++;
      }
      if (steps >= 5) this.acc = 0;
    }
    this.render(dt);
    Input.endFrame();
  }
  zoomNow() {
    const me = this.mp; if (!me || !me.alive || me.slot > 2) return 1;
    const w = me.inv[me.slot]; if (!w) return 1;
    const sc = me.slot === 1 ? me.scope : 'iron'; const z = SCOPES[sc || 'iron'] ? SCOPES[sc || 'iron'].zoom : 1.15;
    return 1 + (z - 1) * this.adsEase(me);
  }
  adsEase(me) { const t = me.adsT; return t * t * (3 - 2 * t); }
  // ---------- أحداث المحاكاة ----------
  handleEvents() {
    const sim = this.sim, me = this.mp, ev = sim.events;
    for (const e of ev) {
      switch (e.t) {
        case 'shot': {
          const p = sim.players.get(e.id), wd = WEAPONS[e.w]; if (!p) break;
          const mine = e.id === this.me;
          let mz;
          if (mine) { this.vm.fire(wd.cls === 'sniper' || wd.cls === 'shotgun'); mz = this.vmMuzzleWorld(); this.shake += wd.cls === 'sniper' ? 0.6 : 0.15; if (wd.bolt) setTimeout(() => { if (this.sim) { this.vm.bolt(); Audio.play('bolt'); } }, 280); }
          else { const m = this.models.get(e.id); mz = m && m.gun ? m.gun.P.muzzleObj.getWorldPosition(new THREE.Vector3()).toArray() : e.o; }
          const d = dirFrom(p.yaw, p.pitch);
          if (!mine) this.fx.muzzle(mz, d, wd.cls === 'sniper' ? 1.8 : 1);
          this.fx.lightFlash(mz, 0xffb060, mine ? 2.5 : 4);
          Audio.play(wd.snd, mine ? null : [e.o[0], e.o[1], e.o[2]]);
          e.hits.forEach((end, i) => {
            if (i === 0 || Math.random() < 0.35) this.fx.tracer(mz, end, wd.cls === 'sniper' ? 700 : 450);
            if (e.hk[i] === 'wall') { this.fx.impact(end, e.n[i], e.m[i]); if (i % 3 === 0) Audio.play('impact', end, { mat: e.m[i] }); }
            // صفير الرصاص قرب الأذن
            if (!mine && me && me.alive) { const c = this.camera.position, o = e.o, L = Math.hypot(end[0] - o[0], end[1] - o[1], end[2] - o[2]); const t = ((c.x - o[0]) * (end[0] - o[0]) + (c.y - o[1]) * (end[1] - o[1]) + (c.z - o[2]) * (end[2] - o[2])) / (L * L); if (t > 0 && t < 1) { const px = o[0] + (end[0] - o[0]) * t, py = o[1] + (end[1] - o[1]) * t, pz = o[2] + (end[2] - o[2]) * t; if (Math.hypot(px - c.x, py - c.y, pz - c.z) < 1.2) Audio.play('whizz', [px, py, pz]); } }
          });
          break;
        }
        case 'impact': this.fx.impact(e.p, e.n, e.mat); break;
        case 'hit': {
          const v = sim.players.get(e.v);
          if (v) { const c = [v.pos[0], v.pos[1] + (e.part === 'head' ? eyeHeight(v) : e.part === 'legs' ? 0.5 : 1.15), v.pos[2]]; if (e.v !== this.me) this.fx.blood(c, e.from ? [c[0] - e.from[0], 0, c[2] - e.from[1]].map(x => x * 0.1) : [0, 0, 0]); Audio.play(e.part === 'head' ? 'headshot' : 'flesh', e.v === this.me ? null : c); }
          if (e.a === this.me && e.v !== this.me) { UI.hitMarker(e.hs, v && !v.alive); Audio.play(e.hs ? 'headshot' : 'hitmark'); if (Settings.haptics) this.buzz(15); }
          if (e.v === this.me) {
            this.hurtA = Math.min(1, this.hurtA + e.dmg / 45); this.shake += e.dmg / 40; Audio.play('hurt'); if (Settings.haptics) this.buzz(40);
            if (e.from) { const dx = e.from[0] - me.pos[0], dz = e.from[1] - me.pos[2], fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); UI.damageDir(Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)); }
          }
          break;
        }
        case 'kill': {
          const k = sim.players.get(e.k), v = sim.players.get(e.v);
          if (v) UI.feed(k, v, e.w, e.hs, e.wall, e.k === this.me || e.v === this.me);
          if (e.k === this.me && e.v !== this.me) { Audio.play('kill'); UI.toast((e.hs ? 'طلقة رأس! ' : '') + 'أسقطت ' + v.name); }
          if (e.v === this.me) { this.spec = { id: e.k >= 0 && e.k !== this.me ? e.k : -1, t: 0, pos: me.pos.slice() }; UI.banner('سقطت', k && k !== me ? 'على يد ' + k.name : '', 'lose', 2.2); }
          break;
        }
        case 'reload': if (e.id === this.me) { const wd = WEAPONS[e.w]; this.vm.reload(wd.reload); } Audio.play('reload', e.id === this.me ? null : sim.players.get(e.id).pos); break;
        case 'draw': if (e.id === this.me) Audio.play('draw'); break;
        case 'dry': if (e.id === this.me) Audio.play('dry'); break;
        case 'knife': if (e.id === this.me) this.vm.slash(); Audio.play(e.hit ? 'knifeHit' : 'knife', e.id === this.me ? null : sim.players.get(e.id).pos); break;
        case 'throw': if (e.id === this.me) this.vm.throwNade(); Audio.play('pin', e.id === this.me ? null : sim.players.get(e.id).pos); break;
        case 'bounce': Audio.play('bounce', e.p); break;
        case 'boom': {
          this.fx.explosion(e.p, e.kind);
          if (e.kind === 'frag') { Audio.play('boom', e.p); const d = me ? Math.hypot(me.pos[0] - e.p[0], me.pos[2] - e.p[2]) : 99; this.shake += Math.max(0, 1.5 - d / 12); }
          else if (e.kind === 'flash') Audio.play('flashbang', e.p);
          else if (e.kind === 'smoke') Audio.play('smokeHiss', e.p);
          else if (e.kind === 'molotov') Audio.play('fire', e.p);
          const m = this.nadeMeshes.get(e.nid); if (m) { this.scene.remove(m); this.nadeMeshes.delete(e.nid); }
          break;
        }
        case 'round':
          if (e.phase === 'buy') { UI.banner('الجولة ' + e.n, 'جهّز عتادك', '', 2.2); Audio.play('roundStart'); this.spec = null; if (me) { this.yaw = me.yaw; this.pitch = 0; } Input.clearToggles(); }
          else UI.banner('انطلق!', '', '', 1.2);
          break;
        case 'roundEnd': {
          const win = me && e.winner === me.team;
          UI.banner(e.winner < 0 ? 'تعادل' : (win ? 'فزنا بالجولة' : 'خسرنا الجولة'), (e.winner >= 0 ? TEAMS[e.winner].name + ' · ' : '') + e.why + ' — ' + e.score[0] + ' : ' + e.score[1], win ? 'win' : 'lose', 4);
          Audio.play(win ? 'roundWin' : 'roundLose');
          break;
        }
        case 'matchOver': setTimeout(() => { if (this.sim) { Input.exitLock(); UI.endScreen(this.sim, this.mp); } }, 300); break;
      }
    }
    // وميض الصاعقة
    if (me && me.flash > 0) { this.flashA = Math.max(this.flashA, Math.min(1, me.flash / 2)); if (!this.ringing) { this.ringing = true; Audio.play('ring', null, { dur: me.flash }); setTimeout(() => this.ringing = false, me.flash * 1000); } }
    ev.length = 0;
  }
  buzz(ms) { try { if (window.RafidainAndroid) window.RafidainAndroid.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }
  vmMuzzleWorld() {
    // نقطة الفوهة من منظور الشخص الأول محوّلة إلى العالم تقريبياً
    const c = this.camera, q = c.quaternion;
    const off = new THREE.Vector3(0.12, -0.1, -0.7).applyQuaternion(q);
    return [c.position.x + off.x, c.position.y + off.y, c.position.z + off.z];
  }
  // ---------- العرض ----------
  render(dt) {
    const sim = this.sim, me = this.mp, alpha = this.acc / STEP, cam = this.camera;
    // النماذج
    const seen = new Set();
    for (const p of sim.players.values()) {
      seen.add(p.id);
      let m = this.models.get(p.id);
      if (!m || m.id !== p.char) { if (m) this.scene.remove(m.root); m = new CharModel(p.char, p.team); this.models.set(p.id, m); this.scene.add(m.root); }
      const pv = this.prev.get(p.id) || [p.pos[0], p.pos[1], p.pos[2], p.crouch];
      m.root.position.set(pv[0] + (p.pos[0] - pv[0]) * alpha, pv[1] + (p.pos[1] - pv[1]) * alpha, pv[2] + (p.pos[2] - pv[2]) * alpha);
      const firstPerson = p.id === this.me && p.alive;
      m.root.visible = !firstPerson;
      if (!firstPerson) {
        const wid = sim.curId(p); m.setWeapon(wid, p.slot === 1 ? p.scope : null);
        const sp = Math.hypot(p.vel[0], p.vel[2]);
        m.update({ yaw: p.yaw, pitch: p.pitch, speed: sp, vx: p.vel[0], vz: p.vel[2], crouch: p.crouch, onGround: p.onGround, alive: p.alive, reloading: p.reloadT > 0, fireT: Math.max(0, 1 - (sim.t - (p.nextFire - 60 / (WEAPONS[wid] ? WEAPONS[wid].rpm || 600 : 600))) * 12) * (p.shots > 0 ? 1 : 0) }, dt);
        // خطوات
        if (p.alive && p.onGround && sp > 3.2) { const a = (this.stepAcc.get(p.id) || 0) + sp * dt; if (a > 2.3) { Audio.play('step', [p.pos[0], p.pos[1], p.pos[2]], { vol: 0.5 }); this.stepAcc.set(p.id, 0); } else this.stepAcc.set(p.id, a); }
      }
    }
    for (const [id, m] of this.models) if (!seen.has(id)) { this.scene.remove(m.root); this.models.delete(id); }
    // القنابل الطائرة
    const nseen = new Set();
    for (const n of sim.nades) {
      nseen.add(n.id); let mesh = this.nadeMeshes.get(n.id);
      if (!mesh) { mesh = buildGun(n.kind).group; mesh.scale.setScalar(1.2); this.scene.add(mesh); this.nadeMeshes.set(n.id, mesh); }
      mesh.position.set(n.pos[0], n.pos[1], n.pos[2]); mesh.rotation.x += dt * 8; mesh.rotation.z += dt * 5;
    }
    for (const [id, m] of this.nadeMeshes) if (!nseen.has(id)) { this.scene.remove(m); this.nadeMeshes.delete(id); }
    this.fx.syncSmokes(sim.smokes, dt); this.fx.syncFires(sim.fires, dt, this.t);
    // الكاميرا
    let zoom = 1, scoped = false;
    if (me && me.alive) {
      const pv = this.prev.get(me.id) || [me.pos[0], me.pos[1], me.pos[2], me.crouch];
      const x = pv[0] + (me.pos[0] - pv[0]) * alpha, y = pv[1] + (me.pos[1] - pv[1]) * alpha, z = pv[2] + (me.pos[2] - pv[2]) * alpha, cr = pv[3] + (me.crouch - pv[3]) * alpha;
      const eh = PH.eyeStand + (PH.eyeCrouch - PH.eyeStand) * cr;
      cam.position.set(x, y + eh, z);
      this.shake = Math.max(0, this.shake - dt * 3);
      const sh = this.shake * 0.01;
      cam.rotation.set(this.pitch + me.punch[0] * 1 + (Math.random() - 0.5) * sh, this.yaw + me.punch[1] * 1 + (Math.random() - 0.5) * sh, 0, 'YXZ');
      zoom = this.zoomNow();
      const wd = me.slot <= 2 && me.inv[me.slot] ? WEAPONS[me.inv[me.slot].id] : null;
      const sc = me.slot === 1 ? me.scope : null;
      scoped = !!(sc && SCOPES[sc] && SCOPES[sc].overlay && me.adsT > 0.85);
      // السلاح في اليد
      const wid = sim.curId(me);
      this.vm.setChar(me.char); this.vm.setWeapon(wid, me.slot === 1 ? me.scope : null);
      if (me.switchT > 0.35 && this.vm.drawT > 0.9) this.vm.drawT = 0;
      this.vm.update({ dt, speed: Math.hypot(me.vel[0], me.vel[2]), onGround: me.onGround, ads: this.adsEase(me), lookDX: 0, lookDY: 0, scoped, crouch: me.crouch > 0.5 });
      // ضوء الشمس على السلاح: هل نحن في الظل؟
      if ((this.lightCheckT = (this.lightCheckT || 0) - dt) <= 0) { this.lightCheckT = 0.2; const s = this.sunDir; this.inSun = !this.world.ray(cam.position.x, cam.position.y, cam.position.z, s.x, s.y, s.z, 80, F.NOBULLET, {}); }
      this.vm.setLight(this.inSun);
      // خطواتي
      const sp = Math.hypot(me.vel[0], me.vel[2]);
      if (me.onGround && sp > 3.2) { this.myStep = (this.myStep || 0) + sp * dt; if (this.myStep > 2.4) { this.myStep = 0; Audio.play('step', null, { vol: 0.25 }); } }
      if (me.landed > 4) Audio.play('land');
      UI.hud(true);
      document.getElementById('spec').classList.remove('on');
    } else this.spectate(dt);
    // مجال الرؤية (أفقي حسب الإعداد)
    const aspect = innerWidth / innerHeight, hf = Settings.fov * Math.PI / 180;
    let vf = 2 * Math.atan(Math.tan(hf / 2) / aspect);
    vf = Math.max(vf, 0.9);
    const fovNow = 2 * Math.atan(Math.tan(vf / 2) / zoom) * 180 / Math.PI;
    if (Math.abs(cam.fov - fovNow) > 0.01) { cam.fov = fovNow; cam.updateProjectionMatrix(); }
    this.vm.cam.aspect = aspect; this.vm.cam.fov = 56 - (zoom > 1.01 && !scoped ? 8 * Math.min(1, (zoom - 1)) : 0); this.vm.cam.updateProjectionMatrix();
    // الصوت
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    Audio.setListener(cam.position.x, cam.position.y, cam.position.z, f.x, f.y, f.z);
    this.fx.update(dt, cam);
    this.updateWorldAnim(dt);
    // الرسم: العالم ثم السلاح
    const r = this.renderer; r.autoClear = true; r.render(this.scene, cam);
    if (me && me.alive && !scoped) { r.autoClear = false; r.clearDepth(); r.render(this.vm.scene, this.vm.cam); r.autoClear = true; }
    this.updateHud(dt, scoped);
  }
  renderMenu(dt) {
    this.fx.update(dt, this.camera); this.updateWorldAnim(dt);
    const r = this.renderer; r.autoClear = true; r.render(this.scene, this.camera);
    if (UI.screen === 'loadout' && this.menuWeaponId) {
      r.autoClear = false; r.clearDepth();
      const vm = this.vm; vm.cam.aspect = innerWidth / innerHeight; vm.cam.fov = 50; vm.cam.updateProjectionMatrix();
      vm.inspectT = -1; vm.update({ dt, speed: 0, onGround: true, ads: 0, scoped: false });
      vm.gunHolder.position.set(-0.3, 0.02, -1.05); vm.gunHolder.scale.setScalar(1); vm.gunHolder.rotation.set(0.12, Math.PI / 2 + Math.sin(this.t * 0.6) * 0.45, 0);
      if (vm.arms) for (const a of vm.arms) { a.upper.visible = a.fore.visible = false; }
      r.render(vm.scene, vm.cam);
      if (vm.arms) for (const a of vm.arms) { a.upper.visible = a.fore.visible = true; }
      r.autoClear = true;
    }
  }
  updateWorldAnim(dt) { if (this.onAnim) this.onAnim(dt, this.t); }
  spectate(dt) {
    const sim = this.sim, cam = this.camera, me = this.mp;
    const sp = this.spec || (this.spec = { id: -1, t: 0, pos: me ? me.pos.slice() : [0, 0, 0] });
    sp.t += dt;
    let target = sp.id >= 0 ? sim.players.get(sp.id) : null;
    if ((!target || !target.alive || sp.t > 3.5) && me) {
      const mates = [...sim.players.values()].filter(p => p.alive && p.team === me.team);
      if (mates.length) { if (!target || target.team !== me.team || !target.alive) { target = mates[0]; sp.id = target.id; } }
      else if (target && !target.alive) target = null;
    }
    if (Input.take('fire') && me) { const mates = [...sim.players.values()].filter(p => p.alive && p.team === me.team); if (mates.length) { const i = (mates.findIndex(p => p.id === sp.id) + 1) % mates.length; sp.id = mates[i].id; target = mates[i]; } }
    const el = document.getElementById('spec');
    if (target) {
      const e = [target.pos[0], target.pos[1] + eyeHeight(target), target.pos[2]], d = dirFrom(target.yaw, target.pitch * 0.5);
      const back = new THREE.Vector3(e[0] - d[0] * 2.8, e[1] + 0.7, e[2] - d[2] * 2.8);
      // لا نخترق الجدران
      const dx = back.x - e[0], dy = back.y - e[1], dz = back.z - e[2], L = Math.hypot(dx, dy, dz);
      const h = this.world.ray(e[0], e[1], e[2], dx / L, dy / L, dz / L, L, F.NOBULLET, {});
      if (h) back.set(e[0] + dx / L * (h.t - 0.25), e[1] + dy / L * (h.t - 0.25), e[2] + dz / L * (h.t - 0.25));
      cam.position.lerp(back, Math.min(1, dt * 8)); cam.lookAt(e[0] + d[0] * 6, e[1] + d[1] * 6, e[2] + d[2] * 6);
      el.textContent = 'تشاهد: ' + target.name + (target.team === (me ? me.team : 0) ? '' : ' (خصم)') + (Input.isTouch ? '' : ' — انقر للتبديل');
    } else {
      const p = sp.pos; cam.position.lerp(new THREE.Vector3(p[0] + 4, p[1] + 5, p[2] + 4), Math.min(1, dt * 2)); cam.lookAt(p[0], p[1], p[2]);
      el.textContent = 'في انتظار الجولة التالية';
    }
    el.classList.add('on');
  }
  // ---------- واجهة اللعب ----------
  buildRadarBg() {
    const W = this.world, B = W.bounds, S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const sx = S / (B[3] - B[0]), sz = S / (B[5] - B[2]), s = Math.min(sx, sz);
    this.radarS = s; this.radarO = [B[0], B[2]];
    x.fillStyle = 'rgba(40,46,52,0.85)'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < W.mat.length; i++) { const o = i * 6, b = W.b; if (b[o + 4] < 1.2 || b[o + 1] > 2 || b[o + 4] - b[o + 1] > 30) continue; const h = Math.min(1, (b[o + 4]) / 9); x.fillStyle = `rgba(${150 + h * 60},${130 + h * 50},${100 + h * 40},0.95)`; x.fillRect((b[o] - B[0]) * s, (b[o + 2] - B[2]) * s, (b[o + 3] - b[o]) * s, (b[o + 5] - b[o + 2]) * s); }
    this.radarBg = c;
  }
  updateHud(dt, scoped) {
    const sim = this.sim, me = this.mp; if (!me) return;
    const $ = id => document.getElementById(id);
    // المؤقت والنتيجة
    const t = Math.max(0, Math.ceil(sim.phaseT)), tm = sim.phase === 'live' ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : sim.phase === 'buy' ? '0:' + String(t).padStart(2, '0') : '—';
    $('timer').textContent = tm; $('timer').classList.toggle('low', sim.phase === 'live' && t <= 15);
    $('sc0').textContent = sim.score[0]; $('sc1').textContent = sim.score[1];
    for (const tt of [0, 1]) { const ps = [...sim.players.values()].filter(p => p.team === tt); $('al' + tt).innerHTML = ps.map(p => `<i class="${p.alive ? '' : 'd'}"></i>`).join(''); }
    $('phase').textContent = sim.phase === 'buy' ? 'وقت التجهيز' : sim.phase === 'live' ? 'الجولة ' + sim.round + ' · ' + (me.team === 0 ? 'تقدّم نحو صحن الجامع' : 'دافع عن الصحن أو تقدّم نحو الشريعة') : '';
    $('buy').classList.toggle('on', sim.phase === 'buy'); $('buyT').textContent = t;
    // الحياة والذخيرة
    $('hpV').textContent = Math.ceil(me.hp); $('hpBar').style.width = me.hp + '%'; $('hpBar').style.background = me.hp > 50 ? '#5dffb0' : me.hp > 25 ? '#ffd34a' : '#ff5a5a';
    $('arV').textContent = Math.ceil(me.armor);
    const w = me.slot <= 3 ? me.inv[me.slot] : null, wd = w ? WEAPONS[w.id] : null;
    if (me.slot === 4) { $('wName').textContent = NADES[me.inv[4][0]] ? NADES[me.inv[4][0]].name : ''; $('magV').textContent = me.inv[4].length; $('resV').textContent = ''; }
    else if (wd) { $('wName').textContent = wd.name + (me.slot === 1 && me.scope && me.scope !== 'iron' ? ' · ' + SCOPES[me.scope].name : ''); $('magV').textContent = wd.mag ? w.mag : '—'; $('resV').textContent = wd.mag ? w.reserve : ''; $('magV').parentElement.classList.toggle('low', wd.mag && w.mag <= wd.mag * 0.25); }
    const bar = $('weapBar'), sig = [me.slot, !!me.inv[1], me.inv[4].length].join();
    if (bar.dataset.sig !== sig) { bar.dataset.sig = sig; bar.innerHTML = [1, 2, 3, 4].filter(s => s === 4 ? me.inv[4].length : me.inv[s]).map(s => `<button data-slot="${s}" class="${me.slot === s ? 'on' : ''}">${s === 4 ? '● ' + me.inv[4].length : WEAPONS[me.inv[s].id].name}</button>`).join(''); }
    // مؤشر التصويب الديناميكي
    const cr = $('cross'); const sp = Math.hypot(me.vel[0], me.vel[2]);
    const gap = 5 + Math.min(26, sp * 2.2 + (me.onGround ? 0 : 14) + me.shots * 1.6 + (wd && wd.cls === 'sniper' && me.adsT < 0.8 ? 18 : 0)) * (me.crouch > 0.5 ? 0.75 : 1);
    cr.style.setProperty('--g', gap.toFixed(1) + 'px'); cr.style.setProperty('--c', Settings.crossColor);
    cr.classList.toggle('hide', scoped || !me.alive || (me.adsT > 0.6 && me.slot <= 2 && !(wd && wd.cls === 'sniper')));
    $('scopeov').classList.toggle('on', scoped);
    // الوميض والألم
    this.flashA = Math.max(0, this.flashA - dt * 0.45); this.hurtA = Math.max(0, this.hurtA - dt * 1.4);
    $('flashov').style.opacity = this.flashA.toFixed(3); $('hurtov').style.opacity = Math.max(this.hurtA, me.alive && me.hp < 30 ? 0.35 + Math.sin(this.t * 6) * 0.1 : 0).toFixed(3);
    // الرادار
    this.drawRadar(me);
  }
  drawRadar(me) {
    const c = document.getElementById('radar'), x = c.getContext('2d'), S = c.width, s = this.radarS, R = 10; // متر لكل … مقياس
    x.clearRect(0, 0, S, S); x.save(); x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.clip();
    const scale = 3.2; // بكسل/متر
    x.translate(S / 2, S / 2); x.rotate(this.yaw); x.scale(scale / s, scale / s);
    x.translate(-(me.pos[0] - this.radarO[0]) * s, -(me.pos[2] - this.radarO[1]) * s);
    x.globalAlpha = 0.85; x.drawImage(this.radarBg, 0, 0); x.globalAlpha = 1;
    x.restore();
    // النقاط
    x.save(); x.translate(S / 2, S / 2); x.rotate(this.yaw);
    for (const p of this.sim.players.values()) {
      if (!p.alive) continue;
      const vis = p.team === me.team || (this.sim.t - p.lastHurt < 0.1) || (p.nextFire > this.sim.t - 0.4 && p.shots > 0);
      if (!vis || p.id === this.me) continue;
      const dx = (p.pos[0] - me.pos[0]) * scale, dz = (p.pos[2] - me.pos[2]) * scale;
      x.fillStyle = p.team === me.team ? (p.team ? '#6ae0ff' : '#ffc56a') : '#ff4a4a';
      x.beginPath(); x.arc(dx, dz, 3.5, 0, Math.PI * 2); x.fill();
    }
    x.restore();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(S / 2, S / 2 - 7); x.lineTo(S / 2 + 5, S / 2 + 5); x.lineTo(S / 2 - 5, S / 2 + 5); x.closePath(); x.fill();
  }
}
