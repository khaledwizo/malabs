// اللعبة: تربط المحاكاة بالرسوم والصوت والواجهة، مع كاميرا الشخص الأول، الاستراق، المناظير، والإحياء
import * as THREE from 'three';
import { Settings } from '../core/settings.js';
import { Input } from '../core/input.js';
import { Audio } from '../core/audio.js';
import { Sim, TEAMS, teamName, dirFrom, LEAN } from '../sim/sim.js';
import { WEAPONS, SCOPES, MODES, defaultLoadout } from '../sim/weapons.js';
import { eyeHeight, PH } from '../sim/move.js';
import { CharModel } from './chars.js';
import { ViewModel } from './viewmodel.js';
import { buildGun } from './gunmodels.js';
import { CHAR_ORDER } from './chardefs.js';
import { FX } from '../gfx/fx.js';
import { UI } from '../ui/ui.js';
import { HUD } from '../ui/hud.js';
import { MapView } from '../ui/maps.js';
import { F } from '../world/collide.js';
import { NetSim } from '../net/client.js';
import { GameServer, MAX_TEAM } from '../net/server.js';
import { Central } from '../net/central.js';
import { encPlayer } from '../net/proto.js';
import { Social } from '../net/social.js';
import { Civilian } from './civilians.js';
import { TalkManager } from './talk.js';
import { Economy, fmtIQD } from './economy.js';
import { DoorVis } from './doors.js';
import { Showcase } from './showcase.js';
import { Drone } from './drone.js';
import { Waypoints } from './waypoint.js';
import { Quests } from './quests.js';
import { Ambient } from './ambient.js';
import { Mudhif } from './mudhif.js';
import { HouseDoors } from './housedoors.js';
import { makeItem, ITEM_VIEW } from './items.js';
import { findPath } from './route.js';

const STEP = 1 / 60;
// أسعار الأكل بالمعركة (باللوبي مجاني)
const FOOD_PRICE = { lablabi: 1000, tea: 500 };
const BOT_NAMES = ['يوسف', 'حيدر', 'زيد', 'عمر', 'مصطفى', 'ليث', 'أنمار', 'كرار', 'بلال', 'طارق', 'سجّاد', 'مرتضى', 'حسين', 'رعد', 'وسام', 'ياسر', 'نوفل', 'عمّار', 'قاسم', 'سلمان'];
const ease = t => t * t * (3 - 2 * t);
const angTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// مركز الجزء الظاهر من الشاشة أفقياً (‎-1..1‎) بجانب لوحة اختيار الشخصية
function charFrameNdc() {
  if (typeof document === 'undefined') return 0;
  const el = document.querySelector('#s-chars.on .panel'), W = innerWidth || 1;
  if (!el) return -0.45;
  const r = el.getBoundingClientRect();
  if (r.width > W * 0.8) return 0;
  const cx = r.left > W * 0.25 ? r.left / 2 : (r.right + W) / 2;
  return Math.max(-0.8, Math.min(0.8, cx / W * 2 - 1));
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // renderer, scene, camera, world, info, Q, sunDir, weather
    this.fx = new FX(this.scene, this.Q);
    this.vm = new ViewModel();
    this.models = new Map(); this.prev = new Map(); this.sim = null; this.me = -1; this.paused = false;
    this.yaw = 0; this.pitch = 0; this.acc = 0; this.queued = {}; this.shake = 0; this.t = 0;
    this.spec = null; this.flashA = 0; this.hurtA = 0; this.bloodA = 0; this.stepAcc = new Map(); this.nadeMeshes = new Map(); this.shotAt = new Map();
    this.menuMode = 'menu'; this.menuChar = 'khaled'; this.menuT = 0; this.lineup = []; this.lastSlot = 0; this.scoped = false; this.roll = 0;
    this.mapView = new MapView(this.world, this.info);
    this.buildLineup();
    // أهل السوق
    this.civs = (this.world.npcs || []).map(n => { const c = new Civilian(n); this.scene.add(c.root); return c; });
    this.talk = new TalkManager(this, this.civs);
    // المرحلة 2: الأبواب، التأشير، المهام، وحياة السوق
    this.ui = UI; this.lobby = false; this.cine = false;
    this.drone = new Drone(this);
    this.doorsVis = new DoorVis(this); this.wps = new Waypoints(this); this.ambient = new Ambient(this); this.quests = new Quests(this); this.mudhif = new Mudhif(this); this.houseDoors = new HouseDoors(this);
  }
  // اللوبي الخاص: تجوّل بالسوق بلا قتال — المهام والحچي ويّا الناس هنا بس
  startLobby(o) {
    this.startMatch({ ...o, mode: 'lobby', size: 0, team: 0, timeLimit: 1e9, buyTime: 0.05, lobby: true, weather: 'random' }); // اللوبي دائماً بالطقس المتغيّر
  }
  // زر «استعمال»: أقرب شي يتسوّى (مهمة، وردة، باب، لبلبي، شاي)
  computeUse(me) {
    if (!me || !me.alive || this.cine || this.paused) return null;
    const q = this.lobby && this.quests.interact(); if (q) return q;
    const mu = this.lobby && this.mudhif.interact(me); if (mu) return mu;
    const D = this.doorsVis.near(me.pos);
    if (D) { const i = this.doorsVis.list.indexOf(D), o = this.doorsVis.stateOf(i); return { label: o ? 'غلق الباب' : 'فتح الباب', fn: () => { this.queued.use = true; } }; }
    for (const u of this.world.usables || []) if (Math.hypot(u.x - me.pos[0], u.z - me.pos[2]) < u.r) {
      const f = me.food, left = f && !this.lobby ? (u.kind === 'lablabi' ? f.e : f.t) : null, price = this.lobby ? 0 : FOOD_PRICE[u.kind];
      if (price && !Economy.can(price)) return { label: `ما عندك ${fmtIQD(price)}`, fn: () => UI.toast('ما عندك فلوس كافية — اربح من المعارك والمهام') };
      return { label: (u.kind === 'lablabi' ? '🥣 كُل لبلبي' : '🫖 اشرب شاي') + (price ? ` · ${fmtIQD(price)}` : ' · مجاني') + (left != null ? ` (${left})` : ''), fn: () => { this.queued.use = true; } };
    }
    return null;
  }
  // الغرض المشيول (قنينة الغاز) بأسفل الشاشة
  // الغرض اللي بإيدك: بالمنظور الأول قدّام الكاميرا، وبالثالث بإيد شخصيتك
  drawCarry() {
    const kind = this.carry;
    if (!this.carryV) {
      const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.01, 5); s.add(new THREE.HemisphereLight(0xfff2dc, 0x3a2c20, 1.3)); const k = new THREE.DirectionalLight(0xffffff, 2); k.position.set(0.5, 1, 0.6); s.add(k);
      this.carryV = { s, cam, items: {} };
    }
    const V = this.carryV;
    for (const [k, g] of Object.entries(V.items)) g.visible = k === kind;
    let g = V.items[kind]; if (!g) { g = V.items[kind] = makeItem(kind); const cf = ITEM_VIEW[kind] || ITEM_VIEW.bag; g.scale.setScalar(cf.s); g.rotation.y = 0.5; V.s.add(g); }
    const cf = ITEM_VIEW[kind] || ITEM_VIEW.bag, me = this.mp, sp = me ? Math.hypot(me.vel[0], me.vel[2]) : 0;
    g.position.set(cf.p[0], cf.p[1] + Math.abs(Math.sin(this.t * 6)) * 0.02 * Math.min(1, sp), cf.p[2]); g.rotation.z = Math.sin(this.t * 3) * 0.04 * Math.min(1, sp);
    V.cam.aspect = innerWidth / innerHeight; V.cam.updateProjectionMatrix(); const r = this.renderer; r.autoClear = false; r.clearDepth(); r.render(V.s, V.cam); r.autoClear = true;
  }
  carryTPP() {
    const want = this.carry && !this.fpNow && !this.cine ? this.carry : null, m = this.models.get(this.me);
    if (this.carryW && (this.carryW.kind !== want || !m || this.carryW.p !== m.root)) { this.carryW.p.remove(this.carryW.g); this.carryW = null; }
    if (want && m && !this.carryW) { const g = makeItem(want); g.position.set(0.16, want === 'gas' ? 0.7 : 0.98, -0.34); m.root.add(g); this.carryW = { g, kind: want, p: m.root }; }
  }

  toggleDrone() { if (this.lobby || !this.sim) return; if (this.drone.on) { this.drone.stop(); return; } if (!this.drone.ready) { UI.toast('الدرون انستعمل بهذا القيم — مرة وحدة بكل قيم'); return; } if (this.drone.start()) UI.toast('درون: 30 ثانية ويشيل رمانة — زر الرمي يسقطها على اللي تحته'); }
  useAction() { const U = this.useInfo; if (U) { Audio.play('ui'); U.fn(); } }
  // ---------- القوائم: كاميرا سينمائية وعرض الشخصيات ----------
  buildLineup() {
    const L = this.info.lineup || { x: -2.4, z: 23.6, dx: 1.6 };
    CHAR_ORDER.forEach((id, i) => { const m = new CharModel(id, i % 2); m.root.position.set(L.x + i * L.dx, 0, L.z); m.setWeapon(['rafid', 'saqr', 'zawba', 'nisr'][i], i === 1 ? 'x8' : null); this.scene.add(m.root); this.lineup.push(m); });
  }
  menuView(mode, ch) { if (mode === 'chars' && this.menuMode !== 'chars') this.menuSnap = true; this.menuMode = mode; if (ch) this.menuChar = ch; this.menuFrameT = 0; }
  menuWeapon(id, scope, att) { this.menuWeaponId = id; this.menuShow('gun', id, scope, att); }
  // المعاينة: سلاح، قنبلة، أو غرض (ضماد، إبرة، نظّارة، عتاد)
  menuShow(kind, id, scope, att) { this.show = id ? { kind, id, scope, att } : null; if (!this.showcase) this.showcase = new Showcase(this.renderer); if (id) this.showcase.set(kind, id, scope, att); }
  renderShowcase(dt) {
    const scr = UI.screen, el = scr === 'loadout' ? document.getElementById('loStage') : scr === 'shop' ? document.getElementById('shopStage') : null;
    if (!el || !this.show || !this.showcase) return;
    this.showcase.attach(el); this.showcase.render(dt, el.getBoundingClientRect());
  }
  updateMenu(dt) {
    this.menuT += dt;
    const cam = this.camera, L = this.info.lineup || { x: -2.4, z: 23.6, dx: 1.6 };
    if (this.freeCam) { const f = this.freeCam; cam.position.set(f.x, f.y, f.z); cam.rotation.set(f.pitch || 0, f.yaw || 0, 0, 'YXZ'); if (cam.fov !== (f.fov || 70)) { cam.fov = f.fov || 70; cam.updateProjectionMatrix(); } this.lineup.forEach(m => { m.root.visible = false; }); return; }
    if (this.menuMode === 'chars') {
      // نضع الشخصية المختارة في منتصف الجزء الظاهر من الشاشة (اللوحة الجانبية تغطّي جهة)
      if (!(this.menuFrameT > 0)) { this.menuFrameT = 0.4; this.menuNdc = charFrameNdc(); } this.menuFrameT -= dt;
      // الكاميرا أمام الشخصية تقريباً (الشارع ضيّق) وتدور بزاوية كي تقع الشخصية في الجزء الظاهر
      const i = Math.max(0, CHAR_ORDER.indexOf(this.menuChar)), tx = L.x + i * L.dx, d = 2.6, c0 = -0.35 * Math.sign(this.menuNdc || -1);
      const want = new THREE.Vector3(tx + c0, 1.2, L.z + d);
      if (this.menuSnap) { cam.position.copy(want); this.menuSnap = false; } else cam.position.lerp(want, Math.min(1, dt * 4));
      const T = Math.tan(THREE.MathUtils.degToRad(31)) * cam.aspect, beta = Math.atan2(tx - cam.position.x, cam.position.z - L.z) - Math.atan(this.menuNdc * T);
      cam.lookAt(cam.position.x + Math.sin(beta) * 5, 1.0, cam.position.z - Math.cos(beta) * 5);
    } else {
      const P = this.info.menuCam || { x: 6, y: 5.2, z: 32.6, lx: -4, ly: 4.5, lz: 10 };
      const a = this.menuT * 0.05;
      cam.position.lerp(new THREE.Vector3(Math.sin(a) * 10 + P.x, P.y + Math.sin(a * 0.7) * 0.8, P.z), Math.min(1, dt * 1.5));
      cam.lookAt(new THREE.Vector3(Math.sin(a) * 6 + P.lx, P.ly, P.lz));
    }
    if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); }
    this.lineup.forEach((m, i) => { const sel = this.menuMode === 'chars' && CHAR_ORDER[i] === this.menuChar; m.update({ yaw: Math.PI + (sel ? Math.sin(this.menuT * 0.8) * 0.5 : 0.15 * (i - 1.5)), pitch: sel ? -0.05 : 0, speed: 0, vx: 0, vz: 0, crouch: 0, onGround: true, alive: true }, dt); m.root.visible = this.menuMode === 'chars' && sel; });
  }
  // ---------- بدء المباراة ----------
  startMatch(o) {
    this.quit(true); this.wxSeed = 0; this.civNight = undefined;
    Social.presence('game');
    const sim = this.sim = new Sim(this.world, { mode: o.mode, roundsToWin: o.roundsToWin, timeLimit: o.timeLimit, roundTime: o.roundTime, difficulty: o.difficulty, seed: Date.now() & 0xffff, buyTime: o.buyTime });
    this.lobby = !!o.lobby; document.body.classList.toggle('lobby', this.lobby);
    const me = sim.addPlayer({ name: o.name, team: o.team, char: o.char, loadout: o.loadout });
    this.me = me.id;
    let ni = Math.floor(Math.random() * BOT_NAMES.length);
    for (let t = 0; t < 2; t++) for (let k = (t === o.team ? 1 : 0); k < o.size; k++) sim.addPlayer({ name: BOT_NAMES[ni++ % BOT_NAMES.length], team: t, bot: true, char: CHAR_ORDER[Math.floor(Math.random() * 4)], loadout: defaultLoadout(o.mode) });
    sim.start();
    this.begin(me, o.weather);
    const M = MODES[sim.mode];
    if (this.lobby) { this.houseDoors.build(); this.ambient.start(); this.quests.start(); this.mudhif.start(); UI.banner('سوق المجاهدين', 'تجوّل، احچِ ويّا الناس، وساعدهم بمهامهم', '', 3.2); return; }
    UI.banner(M.name, sim.dom ? `سيطروا على ${sim.cps && sim.cps.length > 1 ? 'النقاط' : 'النقطة'} · ${Math.round(sim.timeLimit / 60)} دقائق` : sim.tdm ? `الأكثر قتلات بعد ${Math.round(sim.timeLimit / 60)} دقائق يفوز` : `أول من يفوز بـ ${sim.roundsToWin} جولات`, '', 3);
  }
  begin(me, weather) {
    this.yaw = me ? (me.spawnYaw ?? me.yaw) : 0; this.pitch = 0; this.acc = 0; this.paused = false; this.spec = null; this.shotAt.clear();
    for (const m of this.lineup) m.root.visible = false;
    this.vm.setChar(me ? me.char : Settings.char);
    Input.enabled = true; Input.clearToggles(); if (!Input.isTouch) Input.requestLock();
    if (this.weather) { this.weather.set(weather || Settings.weather); this.weather.schedule(this.wxSeed || (Date.now() & 0xffff)); }
    this.matchT = 0;
    this.syncWorld(true); this.talk && this.talk.reset(); this.doorsVis.reset(); this.wps.reset();
    Audio.musicMode('game');
    Audio.play('roundStart');
  }
  // ---------- اللعب أونلاين ----------
  async joinOnline(o) { const ns = new NetSim(this.world, o); await ns.connect(); return ns; }
  // المضيف: يشغّل سيرفر المباراة على هاتفه (يعمل بجانب اللعبة) ويرسل للأصدقاء ليدخلوا تلقائياً
  async hostParty(o) {
    const P = Social.party; if (!P || P.host !== Social.id) return;
    const wx = this.weather ? this.weather.pick(o.weather) : o.weather;
    // حد ثابت: 5 بكل فريق (10 بالمعركة). فرقة أكبر من 5 تنقسم فريقين تلقائياً
    const split = P.vs || P.members.length > MAX_TEAM, teams = {}; P.members.forEach((m, i) => { teams[m.id] = split ? i % 2 : 0; });
    const size = Math.min(MAX_TEAM, Math.max(o.size, split ? Math.ceil(P.members.length / 2) : P.members.length));
    const room = 'p' + Social.id + Math.random().toString(36).slice(2, 6);
    if (this.hostSrv) { this.hostSrv.stop(); this.hostSrv = null; }
    const srv = new GameServer(this.world, { room, cfg: { mode: o.mode, size, rounds: o.roundsToWin, time: o.timeLimit, roundTime: o.roundTime, difficulty: o.difficulty, fill: true, pref: true } });
    await srv.start();
    this.hostSrv = srv; this.hostInfo = { room, teams, mode: o.mode, weather: wx };
    const ns = await this.joinOnline({ local: srv, room, name: o.name, char: o.char, loadout: o.loadout, team: 0 });
    Social.partyStart(room, this.hostInfo);
    Social.inMatch = () => !!this.hostSrv;
    Social.lateJoin = id => { const h = this.hostInfo; if (!h) return; if (h.teams[id] === undefined) { const n0 = Object.values(h.teams).filter(t => t === 0).length; h.teams[id] = (Social.party && Social.party.vs) || n0 >= MAX_TEAM ? (n0 >= MAX_TEAM ? 1 : Object.keys(h.teams).length % 2) : 0; } Social.send(id, { k: 'start', room: h.room, team: h.teams[id], mode: h.mode, weather: h.weather }); };
    this.startOnline(ns, wx);
  }
  // «معركة أونلاين»: السيرفر المركزي إن كان شغّال، وإلا (أو إذا امتلأ) غرفة مفتوحة على هاتف لاعب، وإلا نفتح معركة على هاتفنا
  async onlineMatch(o, say = () => { }) {
    const mode = o.mode, wx = this.weather ? this.weather.pick(o.weather) : o.weather;
    const base = { name: o.name, char: o.char, loadout: o.loadout, team: 0, onStatus: say };
    if (Central.isOnline()) {
      say('السيرفر المركزي شغّال — نطلب معركة…');
      const r = await Central.request(mode, o.name);
      if (r && r.k === 'host') return this.hostOpen(o, wx, base, 'ما في لاعبين بعد — المعركة على هاتفك ويّا البوتات، وأول ما يدخل لاعب حقيقي تنتقل للسيرفر…', say);
      if (r && r.room) {
        say('لگينا معركة — ندخل…');
        try { const ns = await this.joinOnline({ ...base, room: r.room }); ns.central = true; this.startOnline(ns, wx); return 'central'; }
        catch (e) { say('تعذّر دخول معركة السيرفر — ننتقل لوضع المضيف'); }
      } else say(r && r.why ? 'السيرفر ممتلئ (' + r.why + ') — ننتقل لوضع المضيف' : 'السيرفر ما ردّ — ننتقل لوضع المضيف');
    }
    say('ندوّر على معركة مفتوحة…');
    for (const a of await Central.findOpen(mode)) {
      try { const ns = await this.joinOnline({ ...base, room: a.room }); ns.open = true; this.startOnline(ns, wx); return 'open'; } catch (e) { }
    }
    return this.hostOpen(o, wx, base, 'ما في معارك مفتوحة — نفتح معركة على هاتفك وتكمّلها البوتات…', say);
  }
  async hostOpen(o, wx, base, msg, say) {
    const mode = o.mode; say(msg);
    const A = 'abcdefghjkmnpqrstuvwxyz23456789'; let room = 'h'; for (let i = 0; i < 6; i++) room += A[Math.floor(Math.random() * A.length)];
    if (this.hostSrv) { this.hostSrv.stop(); this.hostSrv = null; }
    const srv = new GameServer(this.world, { room, name: o.name, adv: true, reportLive: true, hostId: Social.id, cfg: { mode, size: Math.min(MAX_TEAM, Math.max(1, o.size || MAX_TEAM)), rounds: o.roundsToWin, time: o.timeLimit, roundTime: o.roundTime, difficulty: o.difficulty, fill: true } });
    await srv.start();
    this.hostSrv = srv; this.hostInfo = { room, teams: {}, mode, weather: wx };
    const ns = await this.joinOnline({ ...base, local: srv, room }); ns.open = true;
    this.startOnline(ns, wx);
    return 'host';
  }
  // حالة المعركة الكاملة من سيرفر هاتفي (للنقل للسيرفر المركزي)
  resumeFromServer(srv) {
    const s = srv.sim, R = { mid: srv.mid, score: s.score.slice(), round: s.round, phase: s.phase, phaseT: s.phaseT, cps: (s.cps || []).map(c => [c.owner, c.prog]), pl: {}, bots: [] };
    for (const p of s.players.values()) { const a = encPlayer(p, s.t); if (p.bot) R.bots.push({ name: p.name, team: p.team, char: p.char, a }); else R.pl[p.name] = { a }; }
    return R;
  }
  // دخل لاعب حقيقي ثاني: السيرفر المركزي يستلم معركتي بنفس حالتها، وأنا أنتقل لها
  async moveToServer(b) {
    const srv = this.hostSrv; if (!srv || srv.room !== b.src || this.migrating || !this.sim || !this.sim.online) return;
    const ns = this.sim, mode = ns.mode, team = this.mp ? this.mp.team : 0;
    Central.sendMove(b.room, b.src, this.resumeFromServer(srv));
    this.endSession();
    this.migrating = true; UI.toast2('دخل لاعب حقيقي — المعركة تنتقل للسيرفر المركزي بنفس حالتها…');
    this.quit(true, true); if (this.hostSrv) { this.hostSrv.stop(); this.hostSrv = null; this.hostInfo = null; }
    const base = { room: b.room, name: Settings.name, char: Settings.char, loadout: UI.matchLoadout(mode), team };
    let n2 = null; for (let k = 0; k < 4 && !n2; k++) { try { n2 = await this.joinOnline(base); } catch (e) { await new Promise(r => setTimeout(r, 1500)); } }
    this.migrating = false;
    if (n2) { n2.central = true; this.startOnline(n2); } else { this.quit(); UI.showMenu(); UI.toast2('تعذّر الانتقال للسيرفر'); }
  }
  // استضافة على نفس الشبكة (واي فاي أو نقطة اتصال) — تشتغل حتى بلا إنترنت
  async hostLan(o) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let room = ''; for (let i = 0; i < 5; i++) room += A[Math.floor(Math.random() * A.length)];
    const wx = this.weather ? this.weather.pick(o.weather) : o.weather;
    if (this.hostSrv) { this.hostSrv.stop(); this.hostSrv = null; }
    const srv = new GameServer(this.world, { room, name: o.name, cfg: { mode: o.mode, size: Math.min(MAX_TEAM, Math.max(2, o.size || 2)), rounds: o.roundsToWin, time: o.timeLimit, roundTime: o.roundTime, difficulty: o.difficulty, fill: true } });
    await srv.start();
    this.hostSrv = srv; this.hostInfo = { room, teams: {}, mode: o.mode, weather: wx };
    const ns = await this.joinOnline({ local: srv, room, name: o.name, char: o.char, loadout: o.loadout, team: 0 });
    this.startOnline(ns, wx);
    return room;
  }
  // نقل الاستضافة: إذا طلع المضيف، أول لاعب بالترتيب يصير سيرفر بنفس رمز الغرفة ويكمّل بالنتيجة، والباقين يرجعون يدخلون
  async migrate(ns, why) {
    const fail = msg => { this.quit(); UI.showMenu(); UI.toast2(msg || why || 'انقطع الاتصال بالمعركة'); };
    if (this.hostSrv || this.migrating || ns.matchOver) return fail();
    const room = ns.room, mode = ns.mode, hp = ns.hostPid, cfg = ns.hostCfg || {}, score = (ns.score || [0, 0]).slice(), myTeam = this.mp ? this.mp.team : 0;
    const humans = [...ns.roster.entries()].filter(([id, r]) => !r.bot && id !== hp && ns.players.has(id)).map(([id]) => id).sort((a, b) => a - b);
    if (!room || !humans.includes(ns.me)) return fail();
    this.migrating = true;
    const base = { room, name: Settings.name, char: Settings.char, loadout: UI.matchLoadout(mode), team: myTeam };
    // الحالة الكاملة من آخر لقطة: الصحة والعتاد والمواقع والأسلحة والنقاط والوقت والنتيجة
    const R = { mid: ns.hostMid, score, round: ns.round, phase: ns.phase, phaseT: ns.phaseT, cps: (ns.cps || []).map(c => [c.owner, c.prog]), pl: {}, bots: [] };
    try { for (const p of ns.players.values()) { const r = ns.roster.get(p.id); if (!r) continue; const a = encPlayer(p, ns.t); if (r.bot) R.bots.push({ name: r.name, team: p.team, char: p.char, a }); else R.pl[r.name] = { a }; } } catch (e) { }
    const open = !!(ns.central || ns.open);
    if (this.sess && this.sess.central) this.sess = { room, t: Date.now(), mo: mode, central: false }; // بعد الانتقال صارت المعركة على هاتف لاعب: جلسة تُسجَّل للمزامنة
    try {
      if (humans[0] === ns.me) {
        UI.toast2('المضيف طلع — صرت إنت المضيف، نكمّل المعركة…');
        this.quit(true, true);
        const srv = new GameServer(this.world, { room, name: Settings.name, adv: open, reportLive: true, mid: ns.hostMid, cfg: { mode, size: Math.min(MAX_TEAM, cfg.size || 2), rounds: cfg.rounds || ns.roundsToWin, time: cfg.time || ns.timeLimit, roundTime: cfg.roundTime, difficulty: cfg.difficulty || Settings.difficulty, fill: true, pref: true } });
        srv.resume = R; await srv.start(); this.hostSrv = srv; this.hostInfo = { room, teams: {}, mode };
        const n2 = await this.joinOnline({ ...base, local: srv }); n2.open = open; this.migrating = false; this.startOnline(n2);
      } else {
        UI.toast2('المضيف طلع — ننقل الاستضافة لـ ' + ((ns.roster.get(humans[0]) || {}).name || 'لاعب') + '…');
        this.quit(true, true);
        let n2 = null;
        for (let k = 0; k < 4 && !n2; k++) { await new Promise(r => setTimeout(r, 2500)); try { n2 = await this.joinOnline(base); } catch (e) { } }
        this.migrating = false;
        if (n2) { n2.open = open; this.startOnline(n2); } else fail('ما گدرنا ننقل الاستضافة — انقطعت المعركة');
      }
    } catch (e) { this.migrating = false; fail('تعذّر نقل الاستضافة'); }
  }
  startOnline(ns, weather) {
    this.quit(true, true);
    this.wxSeed = [...String(ns.room || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 7);
    Social.presence('game');
    ns.onlost = why => this.migrate(ns, why);
    // جلسة اللاعب (تُسجَّل للسيرفر المركزي إذا كانت المعركة على هاتف لاعب) — نقل الاستضافة يكمّل نفس الجلسة
    if (!this.sess || this.sess.room !== ns.room) this.sess = { room: ns.room, t: Date.now(), mo: ns.mode, central: !!ns.central };
    this.sim = ns; this.me = ns.me;
    this.begin(this.mp, weather || ns.weather);
    UI.banner(MODES[ns.mode] ? MODES[ns.mode].name : 'معركة', 'فريقك: نحن المجاهدين', '', 2.6);
  }
  endSession() {
    const S = this.sess, sim = this.sim; this.sess = null; if (!S) return;
    const me = sim.players && sim.players.get(this.me), du = Math.round((Date.now() - S.t) / 1000);
    if (S.central || du < 20) return; // معارك السيرفر يسجّلها السيرفر بنفسه
    Central.record({ ty: 'ses', on: Central.isOnline() ? 1 : 0, t: S.t, du, mo: S.mo, room: S.room, mid: sim.hostMid || '', host: this.hostSrv ? 1 : 0, n: Settings.name, k: me ? me.kills : 0, d: me ? me.deaths : 0, win: this.sessRes ?? null, hum: [...(sim.roster || new Map()).values()].filter(r => !r.bot).length });
    this.sessRes = null;
  }
  quit(keep, keepSrv) {
    for (const c of this.civs || []) if (c.fl) this.civHome(c);
    if (this.drone) { this.drone.stop(); this.drone.seen.clear(); this.drone.cdUntil = -1; if (!this.migrating) this.drone.used = false; }
    // خروج قبل نهاية القيم: نخصم المصروف من المخزون (بلا مكافأة)
    if (this.sim && this.sim.online && this.sess && !this.migrating) this.endSession();
    if (this.sim && !this.sim.matchOver && Economy.start && !Economy.settled && !this.migrating) {
      const me = this.sim.players && this.sim.players.get(this.me);
      if (me && me.sup && this.sim.stash) { this.sim.stash(me, me.alive); Economy.abandon(me.sup); } else Economy.abandon(null);
    }
    this.setNvg(false);
    if (this.talk) this.talk.clear();
    if (this.lobby) { this.mudhif.stop(); this.quests.stop(); this.ambient.stop(); this.houseDoors.clear(); } this.lobby = false; this.cine = false; document.body.classList.remove('lobby'); this.wps && this.wps.reset();
    if (this.sim && this.sim.online) { try { this.sim.onlost = null; this.sim.close(); } catch (e) { } }
    if (this.hostSrv && !keepSrv) { const s = this.hostSrv; this.hostSrv = null; this.hostInfo = null; setTimeout(() => s.stop(), 200); }
    if (!keep) Social.presence('on');
    if (this.sim) { for (const m of this.models.values()) this.scene.remove(m.root); this.models.clear(); for (const n of this.nadeMeshes.values()) this.scene.remove(n); this.nadeMeshes.clear(); this.fx.clear && this.fx.clear(); }
    this.sim = null; this.me = -1; this.paused = false; Input.exitLock(); Input.reset();
    UI.mapOpen = false;
    if (!keep) for (const m of this.lineup) m.root.visible = true;
    if (this.weather && !keep) this.weather.set('menu');
    if (!keep) Audio.musicMode('menu');
  }
  // النظارة الليلية: تشتغل بالليل فقط ولمن اشتراها
  nvgAvail() { const W = this.weather; return !!(Economy.W.nvg && this.sim && W && W.cur && W.cur.night > 0.4); }
  toggleNvg() { this.setNvg(!this.nvgOn && this.nvgAvail()); Audio.play('ui'); }
  setNvg(on) { this.nvgOn = !!on; document.body.classList.toggle('nvg', this.nvgOn); }
  pause() { if (!this.sim || this.paused) return; this.paused = true; { const L = this.lobby, $ = id => document.getElementById(id); $('pResume').textContent = L ? 'متابعة التجوّل' : 'متابعة القتال'; $('pQuit').textContent = L ? 'مغادرة السوق' : 'مغادرة المعركة'; $('pLoadout').style.display = L ? 'none' : ''; } Input.exitLock(); Input.reset(); UI.open('pause'); }
  resume() { this.paused = false; UI.closeScreens(); UI.hud(true); if (!Input.isTouch) Input.requestLock(); }
  queueSlot(s) { this.queued.slot = s; }
  queueHeal(k) { this.queued.heal = k; }
  // تكبير المنظار المتغيّر (×6: 3–6، ×8: 4–8) — يُحفظ لكل منظار
  zoomStep(d) { const me = this.mp; if (!me || me.slot !== 1) return; const sc = me.scope, Z = SCOPES[sc] && SCOPES[sc].zoom; if (!Z) return; this.varZoom = this.varZoom || {}; const cur = this.varZoom[sc] ?? Z[1]; this.varZoom[sc] = Math.max(Z[0], Math.min(Z[1], cur + d)); Audio.play('ui'); }
  setMyLoadout(L) { if (this.sim) this.sim.setLoadout(this.me, L); }
  setMyChar(c) { if (this.sim) { this.sim.setChar(this.me, c); this.vm.setChar(c); } }
  get mp() { return this.sim && this.sim.players.get(this.me); }
  // ---------- الإطار ----------
  frame(dt, now) {
    this.t += dt;
    Input.update();
    if (!this.sim) { this.updateMenu(dt); this.renderMenu(dt); Input.endFrame(); return; }
    if (this.sim.online) this.me = this.sim.me; // قد يتغير رقمنا إن أعيد تشغيل السيرفر
    const sim = this.sim, me = this.mp;
    const mg = this.mg && !this.mg.closed ? this.mg : null;
    const blocked = this.paused || !!UI.screen || !!this.cine || (mg && !mg.allowLook);
    this.useInfo = this.computeUse(me);
    if (Input.take('use') && !blocked) this.useAction();
    if (Input.take('pause') && !this.paused) { if (UI.mapOpen) UI.closeMap(); else this.pause(); }
    if (Input.take('map') && !this.paused) { if (UI.mapOpen) UI.closeMap(); else UI.openMap(); }
    if (Input.take('loadout') && !blocked) UI.open('loadout');
    if (!Input.isTouch) HUD.showScore(Input.held('score') && !blocked);
    // تبديل السلاح يلغي التصويب
    if (me && me.slot !== this.lastSlot) { this.lastSlot = me.slot; Input.setAds(false); }
    if (me && (me.reloadT > 0 || !me.alive)) Input.setAds(false);
    // النظر: الحساسية تُقسّم على قوة المنظار
    const [lx, ly] = Input.takeLook();
    // الدرون: الجويستك والسحب يحرّكونه، واللاعب يگعد بمكانه
    if (Input.take('drone') && !blocked) this.toggleDrone();
    const droneOn = this.drone.on;
    if (droneOn && !blocked && (Input.take('grenade') || Input.take('fire'))) { if (this.drone.drop()) UI.toast('انرمت الرمانة!'); }
    if (droneOn) this.drone.control(dt, Input.mx, Input.mz, Input.held('jump'), Input.held('crouch') || Input.on('crouch'), blocked ? 0 : lx * Settings.sens, blocked ? 0 : ly * Settings.sens);
    if (!blocked && me && me.alive && !droneOn) {
      const mag = this.magOf(me), a = ease(me.adsT);
      let f = 1;
      if (mag >= 2.9) f = Settings.scopeSens * 1.5 / mag;
      else if (mag > 1.01) f = Settings.adsSens * (mag >= 1.9 ? 0.6 : 0.82);
      const k = Settings.sens * (1 + (f - 1) * a) * this.assist(me, dt, lx, ly);
      this.yaw -= lx * k; this.pitch -= ly * k * (Settings.invertY ? -1 : 1);
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }
    if (!this.paused || sim.online) {
      const idle = blocked || (!!mg && !mg.allowLook) || droneOn;
      const lean = (Input.held('leanL') || Input.on('leanL')) ? -1 : (Input.held('leanR') || Input.on('leanR')) ? 1 : 0;
      const cmd = idle ? { mx: 0, mz: 0, yaw: this.yaw, pitch: this.pitch, jump: false, crouch: !!(me && me.crouch > 0.5 && Input.on('crouch')), walk: false, fire: false, ads: false, reload: false, slot: 0, swap: false, lean: 0 } : {
        mx: Input.mx, mz: Input.mz, yaw: this.yaw, pitch: this.pitch, jump: Input.held('jump'), crouch: Input.held('crouch') || Input.on('crouch'), walk: Input.held('walk'),
        fire: Input.held('fire') || this.autoFire(me), ads: Input.ads, reload: Input.take('reload'), slot: 0, swap: Input.take('swap') || Input.wheel !== 0, lean,
      };
      if (!idle && this.aimFix) { cmd.yaw = this.yaw + this.aimFix[0]; cmd.pitch = this.pitch + this.aimFix[1]; }
      if (mg && !idle) { cmd.fire = false; cmd.ads = false; cmd.jump = false; cmd.reload = false; } // ماسك الكاميرا: تمشي وتلتفت بس
      if (this.carry && !idle) { if (this.carry === 'gas') cmd.walk = true; cmd.jump = false; cmd.fire = false; } // شايل غرض (الغاز ثگيل)
      if (!idle) for (let s = 1; s <= 4; s++) if (Input.take('slot' + s)) cmd.slot = s;
      if (!idle && Input.take('grenade')) cmd.slot = me && me.slot === 4 ? (me.prevSlot || 1) : 4;
      if (this.queued.slot) { cmd.slot = this.queued.slot === (me && me.slot) && me.slot === 4 ? me.prevSlot : this.queued.slot; }
      if (!idle && Input.take('heal1')) this.queued.heal = 1;
      if (!idle && Input.take('heal2')) this.queued.heal = 2;
      cmd.heal = this.queued.heal || 0; if (this.queued.use) cmd.heal = 3;
      if (Input.take('inspect')) this.vm.inspect();
      this.queued = {};
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 5) {
        for (const p of sim.players.values()) this.prev.set(p.id, [p.pos[0], p.pos[1], p.pos[2], p.crouch, p.lean || 0]);
        if (me) sim.input(this.me, cmd);
        sim.step(STEP); this.handleEvents();
        cmd.reload = false; cmd.swap = false; cmd.slot = 0; cmd.heal = 0;
        this.acc -= STEP; steps++;
      }
      if (steps >= 5) this.acc = 0;
    }
    if (this.weather && sim.phase !== 'wait') { this.matchT = (this.matchT || 0) + dt; this.weather.tick(this.matchT); }
    this.render(dt);
    Input.endFrame();
  }
  magOf(me) {
    if (!me || !me.alive || me.slot > 2) return 1;
    const sc = me.slot === 1 ? (me.scope || 'iron') : 'iron';
    if (this.varZoom && this.varZoom[sc] !== undefined) return this.varZoom[sc];
    return SCOPES[sc] ? SCOPES[sc].mag : 1.15;
  }
  zoomNow() { const me = this.mp; return 1 + (this.magOf(me) - 1) * (me ? ease(me.adsT) : 0); }
  // مساعدة التصويب على اللمس: إبطاء قرب العدو وجذب خفيف أثناء الإطلاق
  assist(me, dt, lx, ly) {
    this.assistTgt = null;
    if (!Settings.aimAssist || !Input.isTouch) return 1;
    if ((this.assistT = (this.assistT || 0) - dt) <= 0) {
      this.assistT = 0.08; this.assistCand = null;
      const e = this.sim.eye(me), f = dirFrom(this.yaw + me.punch[1], this.pitch + me.punch[0]);
      let best = 0.11 / Math.sqrt(this.magOf(me)), bq = null; // مخروط الجذب (مثل ببجي)
      for (const q of this.sim.players.values()) {
        if (!q.alive || q.team === me.team) continue;
        const tx = q.pos[0], ty = q.pos[1] + eyeHeight(q) - 0.35, tz = q.pos[2];
        const dx = tx - e[0], dy = ty - e[1], dz = tz - e[2], L = Math.hypot(dx, dy, dz); if (L > 90) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, (dx * f[0] + dy * f[1] + dz * f[2]) / L)));
        if (ang < best && this.world.los(e[0], e[1], e[2], tx, ty, tz)) { best = ang; bq = q; }
      }
      this.assistCand = bq;
    }
    const q = this.assistCand; if (!q || !q.alive) return 1;
    this.assistTgt = q;
    // جذب لطيف عند الإطلاق أو التصويب
    if (Input.held('fire') || me.adsT > 0.5) {
      const e = this.sim.eye(me), ty = q.pos[1] + eyeHeight(q) - 0.35;
      const wy = Math.atan2(-(q.pos[0] - e[0]), -(q.pos[2] - e[2])), wp = Math.atan2(ty - e[1], Math.hypot(q.pos[0] - e[0], q.pos[2] - e[2]));
      const pull = Math.min(1, dt * 3.2);
      this.yaw += angTo(this.yaw + me.punch[1], wy) * pull * 0.75; this.pitch += (wp - this.pitch - me.punch[0]) * pull * 0.45;
    }
    return 0.62;
  }
  autoFire(me) {
    if (!Settings.autoFire || !Input.isTouch || !me || !me.alive || me.slot > 2) return false;
    const q = this.assistCand; if (!q || !q.alive) { this.afT = 0; return false; }
    this.afT = (this.afT || 0) + 1 / 60; return this.afT > 0.15;
  }
  // ---------- أحداث المحاكاة ----------
  handleEvents() {
    const sim = this.sim, me = this.mp, ev = sim.events;
    for (const e of ev) {
      switch (e.t) {
        case 'shot': {
          const p = sim.players.get(e.id), wd = WEAPONS[e.w]; if (!p || !wd) break;
          this.shotAt.set(e.id, { t: this.t, q: e.q });
          if (this.talk && !(wd.cls === 'knife')) this.talk.onShot(p.pos);
          if (wd.cls !== 'knife' && !e.q) this.civFlee(p.pos);
          const mine = e.id === this.me && (!sim.online || e.loc);
          let mz;
          if (mine) { this.vm.fire(wd.cls === 'sniper' || wd.cls === 'shotgun' || wd.cls === 'dmr'); const mm = this.models.get(e.id); mz = this.fpNow || !(mm && mm.gun) ? this.vmMuzzleWorld() : mm.gun.P.muzzleObj.getWorldPosition(new THREE.Vector3()).toArray(); this.shake += wd.cls === 'sniper' ? 0.6 : wd.cls === 'shotgun' ? 0.5 : 0.14; if (wd.bolt || wd.pump) setTimeout(() => { if (this.sim) { this.vm.bolt(wd.pump); Audio.play(wd.pump ? 'pump' : 'bolt'); } }, 260); if (Settings.haptics && (wd.cls === 'sniper' || wd.cls === 'shotgun')) this.buzz(25); }
          else { const m = this.models.get(e.id); mz = m && m.gun ? m.gun.P.muzzleObj.getWorldPosition(new THREE.Vector3()).toArray() : e.o; }
          const d = dirFrom(p.yaw, p.pitch);
          if (mine && this.lobby && e.o) this.quests.onShot(e.o, d);
          if (!mine && !e.q) this.fx.muzzle(mz, d, wd.cls === 'sniper' ? 1.8 : 1);
          if (!e.q) this.fx.lightFlash(mz, 0xffb060, mine ? 2.5 : 4);
          Audio.play(e.q ? 'suppressed' : wd.snd, mine ? null : [e.o[0], e.o[1], e.o[2]]);
          e.hits.forEach((end, i) => {
            if (i === 0 || Math.random() < 0.35) this.fx.tracer(mz, end, wd.cls === 'sniper' ? 700 : 450);
            if (e.hk[i] === 'wall') { this.fx.impact(end, e.n[i], e.m[i]); if (i % 3 === 0) Audio.play('impact', end, { mat: e.m[i] }); }
            // صفير الرصاص قرب الأذن
            if (!mine && me && me.alive) { const c = this.camera.position, o = e.o, L = Math.hypot(end[0] - o[0], end[1] - o[1], end[2] - o[2]); const t = ((c.x - o[0]) * (end[0] - o[0]) + (c.y - o[1]) * (end[1] - o[1]) + (c.z - o[2]) * (end[2] - o[2])) / (L * L); if (t > 0 && t < 1) { const px = o[0] + (end[0] - o[0]) * t, py = o[1] + (end[1] - o[1]) * t, pz = o[2] + (end[2] - o[2]) * t; if (Math.hypot(px - c.x, py - c.y, pz - c.z) < 1.4) Audio.play('whizz', [px, py, pz]); } }
          });
          break;
        }
        case 'impact': this.fx.impact(e.p, e.n, e.mat); break;
        case 'hit': {
          const v = sim.players.get(e.v);
          if (v) {
            const c = [v.pos[0], v.pos[1] + (e.part === 'head' ? eyeHeight(v) : e.part === 'legs' ? 0.55 : 1.15), v.pos[2]];
            const d = e.d || (e.from ? [c[0] - e.from[0], 0, c[2] - e.from[1]] : [0, 0, 0]);
            if (e.v !== this.me) this.fx.blood(c, d, e.dmg, e.part === 'head', this.world);
            Audio.play(e.part === 'head' ? 'headshot' : 'flesh', e.v === this.me ? null : c);
          }
          if (e.a === this.me && e.v !== this.me) { UI.hitMarker(e.hs, v && !v.alive); Audio.play(e.hs ? 'headshot' : 'hitmark'); if (Settings.haptics) this.buzz(12); }
          if (e.v === this.me && me) {
            this.hurtA = Math.min(1, this.hurtA + e.dmg / 40); this.bloodA = Math.min(0.9, this.bloodA + e.dmg / 70); this.shake += e.dmg / 40; Audio.play('hurt'); if (Settings.haptics) this.buzz(40);
            if (e.from) { const dx = e.from[0] - me.pos[0], dz = e.from[1] - me.pos[2], fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); UI.damageDir(Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz)); }
          }
          break;
        }
        case 'kill': {
          const k = sim.players.get(e.k), v = sim.players.get(e.v);
          if (v) { UI.feed(k, v, e.w, e.hs, e.wall, e.k === this.me || e.v === this.me); const m = this.models.get(e.v); if (m && m.die) m.die(e.d, e.hs); this.fx.bloodPool && this.fx.bloodPool(v.pos, this.world); }
          if (e.k === this.me && e.v !== this.me) { Audio.play('kill'); UI.toast((e.hs ? 'طلقة رأس! ' : '') + 'أسقطت ' + (v ? v.name : '')); if (e.streak >= 2 || e.hs) HUD.streak(e.streak, e.hs); }
          if (e.v === this.me) {
            this.spec = { id: e.k >= 0 && e.k !== this.me ? e.k : -1, t: 0, pos: me ? me.pos.slice() : [0, 0, 0], killer: true };
            HUD.respawnBy(k && k !== me ? k.name : '');
            if (!sim.tdm) UI.banner('سقطت', k && k !== me ? 'على يد ' + k.name : '', 'lose', 2.2);
            Input.clearToggles();
          }
          break;
        }
        case 'respawn': if (e.id === this.me && me) { this.yaw = me.spawnYaw ?? me.yaw; this.pitch = 0; this.spec = null; this.bloodA = 0; this.hurtA = 0; Input.clearToggles(); Audio.play('respawn'); } { const m = this.models.get(e.id); if (m && m.revive) m.revive(); } break;
        case 'reload': if (e.id === this.me) { const wd = me ? sim.curWD ? sim.curWD(me) : WEAPONS[e.w] : WEAPONS[e.w]; this.vm.reload(wd.reload); } Audio.play('reload', e.id === this.me ? null : this.posOf(e.id)); break;
        case 'draw': if (e.id === this.me) Audio.play('draw'); break;
        case 'dry': if (e.id === this.me) Audio.play('dry'); break;
        case 'knife': if (e.id === this.me) this.vm.slash(); Audio.play(e.hit ? 'knifeHit' : 'knife', e.id === this.me ? null : this.posOf(e.id)); break;
        case 'throw': if (e.id === this.me) this.vm.throwNade(); Audio.play('pin', e.id === this.me ? null : this.posOf(e.id)); break;
        case 'bounce': Audio.play('bounce', e.p); break;
        case 'break': {
          const set = this.meshes && this.meshes.userData.setProp; if (set) set(e.id, false);
          const P = this.world.props[e.id]; if (!P) break;
          if (P.kind === 'lamp' && this.meshes.userData.lampAt) this.meshes.userData.lampAt(P.c, false); // ينطفئ الفانوس المكسور
          if (e.silent) break;
          const at = P.c || e.p, kind = P.kind; this.fx.debris(at, kind);
          Audio.play(kind === 'vase' ? 'breakClay' : kind === 'tomb' ? 'breakStone' : kind === 'sack' ? 'flesh' : kind === 'lamp' ? 'breakGlass' : 'breakWood', at);
          break;
        }
        case 'reset': this.resetWorldVis(); break;
        case 'npcHit': { const c = this.civs && this.civs[e.id]; if (c && e.p && !c.away) { const d = me ? [e.p[0] - me.pos[0], 0, e.p[2] - me.pos[2]] : [0, 0, 1]; this.fx.blood(e.p, d, 25, false, this.world); Audio.play('flesh', e.p); } break; }
        case 'npcDie': { const c = this.civs && this.civs[e.id]; if (!c) break; c.die(e.d); if (!e.silent) { setTimeout(() => { this.fx.bloodPool([c.n.x, c.n.y, c.n.z], this.world, 0.55 + Math.random() * 0.25); Audio.play('bodyFall', [c.n.x, 0.3, c.n.z]); }, 650); if (e.k === this.me) UI.toast('قتلت أحد أهل السوق!'); } break; }
        case 'heal': if (e.k >= 3) { if (e.id === this.me && !this.lobby) { const pr = FOOD_PRICE[e.k === 3 ? 'lablabi' : 'tea']; Economy.spend(pr); } if (e.id === this.me) { const pr = this.lobby ? 'مجاناً' : `${fmtIQD(FOOD_PRICE[e.k === 3 ? 'lablabi' : 'tea'])} · باقي ${e.left ?? '?'}`; UI.toast(e.k === 3 ? `تاكل لبلبي حار… (${pr})` : `تشرب استكان شاي… (${pr})`); } Audio.play('ui'); break; } if (e.id === this.me) this.vm.healT = e.k === 2 ? 4 : 2.4; Audio.play(e.k === 2 ? 'syringe' : 'bandage', e.id === this.me ? null : this.posOf(e.id)); break;
        case 'foodOut': if (e.id === this.me) UI.toast(e.k === 'lablabi' ? 'خلصت حصّتك من اللبلبي بهالمعركة' : 'خلصت حصّتك من الشاي بهالمعركة'); break;
        case 'foodFull': if (e.id === this.me) UI.toast('صحّتك كاملة، ما تحتاج'); break;
        case 'mark': this.wps.onMark(e, this.mp); break;
        case 'healed': if (e.id === this.me) { Audio.play('healed'); this.vm.healT = 0; } break;
        case 'boom': {
          this.civFlee(e.p); this.fx.explosion(e.p, e.kind); if (this.talk && (e.kind === 'frag' || e.kind === 'flash' || e.kind === 'molotov')) this.talk.onShot(e.p);
          if (e.kind === 'frag') { Audio.play('boom', e.p); const d = me ? Math.hypot(me.pos[0] - e.p[0], me.pos[2] - e.p[2]) : 99; this.shake += Math.max(0, 1.6 - d / 12); if (d < 14 && Settings.haptics) this.buzz(60); }
          else if (e.kind === 'flash') Audio.play('flashbang', e.p);
          else if (e.kind === 'smoke') Audio.play('smokeHiss', e.p);
          else if (e.kind === 'molotov') Audio.play('fire', e.p);
          const m = this.nadeMeshes.get(e.nid); if (m) { this.scene.remove(m); this.nadeMeshes.delete(e.nid); }
          break;
        }
        case 'round':
          if (e.phase === 'buy') {
            if (sim.online && UI.screen === 'end') { UI.closeScreens(); UI.hud(true); if (!Input.isTouch) Input.requestLock(); }
            if (!sim.tdm) UI.banner('الجولة ' + e.n, 'جهّز عتادك', '', 2.2);
            Audio.play('roundStart'); this.spec = null; if (me) { this.yaw = me.spawnYaw ?? me.yaw; this.pitch = 0; } Input.clearToggles();
            for (const m of this.models.values()) if (m.revive) m.revive();
          }
          else if (!this.lobby) { UI.banner(sim.tdm ? 'إلى القتال!' : 'انطلق!', '', '', 1.2); Audio.play('go'); }
          break;
        case 'roundEnd': {
          const win = me && e.winner === me.team;
          if (sim.tdm) UI.banner(e.winner < 0 ? 'تعادل!' : win ? 'النصر لنا!' : 'خسرنا المعركة', 'انتهى الوقت — ' + e.score[0] + ' : ' + e.score[1], win ? 'win' : 'lose', 5);
          else UI.banner(e.winner < 0 ? 'تعادل' : (win ? 'فزنا بالجولة' : 'خسرنا الجولة'), (e.winner >= 0 ? teamName(e.winner, me ? me.team : -1) + ' · ' : '') + e.why + ' — ' + e.score[0] + ' : ' + e.score[1], win ? 'win' : 'lose', 4);
          Audio.play(win ? 'roundWin' : 'roundLose');
          break;
        }
        case 'supply': if (e.id === this.me) { if (e.res != null) this.sessRes = e.res; const r = Economy.settle(e); if (r) UI.showReward && UI.showReward(r); if (this.sim && this.sim.online) setTimeout(() => { if (this.sim && this.sim.online && this.sim.setLoadout) { const L = UI.matchLoadout(this.sim.mode); this.sim.setLoadout(this.me, L); } }, 1500); } break; // القيم الجاي بنفس الجلسة: مخزون جديد
        case 'matchOver': setTimeout(() => { if (this.sim) { Input.exitLock(); UI.endScreen(this.sim, this.mp); } }, 400); break;
      }
    }
    if (me && me.flash > 0) { this.flashA = Math.max(this.flashA, Math.min(1, me.flash / 2)); if (!this.ringing) { this.ringing = true; Audio.play('ring', null, { dur: me.flash }); setTimeout(() => this.ringing = false, me.flash * 1000); } }
    ev.length = 0;
  }
  posOf(id) { const p = this.sim && this.sim.players.get(id); return p ? p.pos : null; }
  buzz(ms) { try { if (window.RafidainAndroid) window.RafidainAndroid.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }
  vmMuzzleWorld() {
    const c = this.camera, q = c.quaternion;
    const off = new THREE.Vector3(0.12, -0.1, -0.7).applyQuaternion(q);
    return [c.position.x + off.x, c.position.y + off.y, c.position.z + off.z];
  }
  // ---------- العرض ----------
  render(dt) {
    const sim = this.sim, me = this.mp, alpha = this.acc / STEP, cam = this.camera;
    // منظور الشخص الثالث (افتراضي مثل ببجي): الكاميرا ورا الكتف، والتصويب يحوّل لمنظور الشخص الأول
    this.tpp = Settings.view !== 'fpp' && !this.cine && !(this.mg && !this.mg.closed);
    this.fpNow = !this.tpp || !!(me && (me.adsT || 0) > 0.55);
    if (this.quests && this.quests.kc) this.fpNow = false; // مشهد التصفية: نشوف الشخصيتين
    // النماذج
    const seen = new Set();
    for (const p of sim.players.values()) {
      seen.add(p.id);
      let m = this.models.get(p.id);
      if (!m || m.id !== p.char || m.team !== p.team) { if (m) this.scene.remove(m.root); m = new CharModel(p.char, p.team); this.models.set(p.id, m); this.scene.add(m.root); }
      const pv = this.prev.get(p.id) || [p.pos[0], p.pos[1], p.pos[2], p.crouch, p.lean || 0];
      m.root.position.set(pv[0] + (p.pos[0] - pv[0]) * alpha, pv[1] + (p.pos[1] - pv[1]) * alpha, pv[2] + (p.pos[2] - pv[2]) * alpha);
      const firstPerson = p.id === this.me && p.alive && !this.drone.on && this.fpNow;
      m.root.visible = !firstPerson && (p.alive || m.dead !== undefined);
      if (!firstPerson) {
        const wid = sim.curId(p); m.setWeapon(wid, p.slot === 1 ? p.scope : null);
        const sp = Math.hypot(p.vel[0], p.vel[2]);
        const wdd = WEAPONS[wid];
        m.update({ yaw: p.yaw, pitch: p.pitch, speed: sp, vx: p.vel[0], vz: p.vel[2], crouch: p.crouch, lean: p.lean || 0, hurt: sim.t - (p.lastHurt ?? -9), stab: p.id === this.me && this.quests ? this.quests.stab || 0 : 0, onGround: p.onGround, alive: p.alive, ads: p.adsT || 0, prot: p.spawnProt > 0, reloading: p.reloadT > 0, fireT: Math.max(0, 1 - (sim.t - (p.nextFire - 60 / (wdd ? wdd.rpm || 600 : 600))) * 12) * (p.shots > 0 ? 1 : 0) }, dt);
        // خطوات الآخرين: الركض مسموع والانحناء صامت
        if (p.alive && p.onGround && sp > 2.9 && p.crouch < 0.5) { const a = (this.stepAcc.get(p.id) || 0) + sp * dt; if (a > 2.1) { Audio.step(p.pos, sp > 4.6, this.surfaceAt(p.pos)); this.stepAcc.set(p.id, 0); } else this.stepAcc.set(p.id, a); }
      }
    }
    for (const [id, m] of this.models) if (!seen.has(id)) { this.scene.remove(m.root); this.models.delete(id); }
    this.nameTags(sim, me, cam);
    // القنابل الطائرة
    const nseen = new Set();
    for (const n of sim.nades) {
      if (n.kind === 'gas') continue;
      nseen.add(n.id); let mesh = this.nadeMeshes.get(n.id);
      if (!mesh) { mesh = buildGun(n.kind).group; mesh.scale.setScalar(1.2); this.scene.add(mesh); this.nadeMeshes.set(n.id, mesh); }
      mesh.position.set(n.pos[0], n.pos[1], n.pos[2]); mesh.rotation.x += dt * 8; mesh.rotation.z += dt * 5;
    }
    for (const [id, m] of this.nadeMeshes) if (!nseen.has(id)) { this.scene.remove(m); this.nadeMeshes.delete(id); }
    this.fx.syncSmokes(sim.smokes, dt); this.fx.syncFires(sim.fires, dt, this.t);
    // الكاميرا
    let zoom = 1; this.scoped = false;
    if (me && me.alive) {
      const pv = this.prev.get(me.id) || [me.pos[0], me.pos[1], me.pos[2], me.crouch, me.lean || 0];
      const x = pv[0] + (me.pos[0] - pv[0]) * alpha, y = pv[1] + (me.pos[1] - pv[1]) * alpha, z = pv[2] + (me.pos[2] - pv[2]) * alpha, cr = pv[3] + (me.crouch - pv[3]) * alpha, ln = pv[4] + ((me.lean || 0) - pv[4]) * alpha;
      const eh = PH.eyeStand + (PH.eyeCrouch - PH.eyeStand) * cr - Math.abs(ln) * 0.06, L = ln * LEAN;
      const ex = x + Math.cos(this.yaw) * L, ey = y + eh, ez = z - Math.sin(this.yaw) * L;
      cam.position.set(ex, ey, ez);
      this.aimFix = null;
      if (this.tpp) {
        // ورا الكتف اليمين؛ الكاميرا ما تخترق الجدران
        const cy = Math.cos(this.pitch), fx = -Math.sin(this.yaw) * cy, fy = Math.sin(this.pitch), fz = -Math.cos(this.yaw) * cy, rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        const k = 1 - ease(Math.min(1, (me.adsT || 0) / 0.55)), back = 2.6 * k, side = 0.72 * k, up = 0.26 * k;
        const px = ex + rx * side, py = ey + up, pz = ez + rz * side;
        let tx = px - fx * back, ty = py - fy * back + 0.15 * k, tz = pz - fz * back;
        const seg = (ax, ay, az, bx, by, bz) => { const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 1e-4) return 1; const h = this.world.ray(ax, ay, az, dx / d, dy / d, dz / d, d + 0.25, F.NOBULLET, {}); return h ? Math.max(0, (h.t - 0.25) / d) : 1; };
        const s1 = seg(ex, ey, ez, px, py, pz), qx = ex + (px - ex) * s1, qy = ey + (py - ey) * s1, qz = ez + (pz - ez) * s1;
        const s2 = seg(qx, qy, qz, tx, ty, tz); tx = qx + (tx - qx) * s2; ty = qy + (ty - qy) * s2; tz = qz + (tz - qz) * s2;
        cam.position.set(tx, ty, tz);
        // التصويب نحو ما تحت المؤشر: الطلقة من رأس اللاعب باتجاه النقطة اللي تشوفها الكاميرا
        if (k > 0.05) {
          const h = this.world.ray(tx, ty, tz, fx, fy, fz, 300, F.NOBULLET, {}), D = h ? h.t : 300;
          const Tx = tx + fx * D, Ty = ty + fy * D, Tz = tz + fz * D, ddx = Tx - ex, ddy = Ty - ey, ddz = Tz - ez, hd = Math.hypot(ddx, ddz);
          if (Math.hypot(ddx, ddy, ddz) > 3) { const ay = Math.atan2(-ddx, -ddz), ap = Math.atan2(ddy, hd); const dy = angTo(this.yaw, ay), dp = ap - this.pitch; if (Math.abs(dy) < 0.1 && Math.abs(dp) < 0.1) this.aimFix = [dy, dp]; }
        }
      }
      this.shake = Math.max(0, this.shake - dt * 3);
      const sh = this.shake * 0.01;
      this.roll += (-ln * 0.2 - this.roll) * Math.min(1, dt * 12);
      cam.rotation.set(this.pitch + me.punch[0] + (Math.random() - 0.5) * sh, this.yaw + me.punch[1] + (Math.random() - 0.5) * sh, this.roll, 'YXZ');
      zoom = this.zoomNow();
      const sc = me.slot === 1 ? me.scope : null;
      this.scoped = !!(sc && SCOPES[sc] && SCOPES[sc].overlay && me.adsT > 0.88);
      if (this.scoped) this.drawReticle(sc);
      const wid = sim.curId(me);
      this.vm.setChar(me.char); this.vm.setWeapon(wid, me.slot === 1 ? me.scope : null, me.slot === 1 && me.inv[1] ? me.inv[1].att : null);
      if (me.switchT > 0.35 && this.vm.drawT > 0.9) this.vm.drawT = 0;
      this.vm.update({ dt, speed: Math.hypot(me.vel[0], me.vel[2]), onGround: me.onGround, ads: ease(me.adsT), scoped: this.scoped, crouch: me.crouch > 0.5, lean: ln });
      if ((this.lightCheckT = (this.lightCheckT || 0) - dt) <= 0) { this.lightCheckT = 0.2; const s = this.sunDir; this.inSun = !this.world.ray(cam.position.x, cam.position.y, cam.position.z, s.x, s.y, s.z, 80, F.NOBULLET, {}); }
      this.vm.setLight(this.inSun, this.weather ? this.weather.vmLight() : null);
      // خطواتي
      const sp = Math.hypot(me.vel[0], me.vel[2]);
      if (me.onGround && sp > 2.2) { this.myStep = (this.myStep || 0) + sp * dt; if (this.myStep > (sp > 4.6 ? 2.3 : 1.9)) { this.myStep = 0; Audio.step(null, sp > 4.6, this.surfaceAt(me.pos), me.crouch > 0.5); } }
      if (me.landed > 4) Audio.play('land');
      HUD.spec('');
    } else this.spectate(dt);
    if (this.cine && (this.quests.camera(dt) || this.mudhif.camera(dt))) { zoom = 1; this.scoped = false; }
    if (this.drone.on) { this.drone.applyCamera(cam); zoom = 1; this.scoped = false; }
    // مجال الرؤية: الإعداد أفقي ثم يُحوّل إلى عمودي، والمنظار يقسّمه
    const aspect = innerWidth / innerHeight, hf = Settings.fov * Math.PI / 180;
    let vf = 2 * Math.atan(Math.tan(hf / 2) / aspect); vf = Math.max(vf, 0.9);
    const fovNow = 2 * Math.atan(Math.tan(vf / 2) / zoom) * 180 / Math.PI;
    if (Math.abs(cam.fov - fovNow) > 0.01) { cam.fov = fovNow; cam.updateProjectionMatrix(); }
    this.vm.cam.aspect = aspect; this.vm.cam.fov = 54 - (zoom > 1.01 && !this.scoped ? 10 * Math.min(1, zoom - 1) : 0); this.vm.cam.updateProjectionMatrix();
    // الصوت
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    Audio.setListener(cam.position.x, cam.position.y, cam.position.z, f.x, f.y, f.z);
    this.fx.update(dt, cam);
    this.updateWorldAnim(dt);
    if (this.talk) this.talk.update(dt);
    // الرسم: العالم ثم السلاح
    this.draw(me && me.alive && !this.scoped && !this.lobby && !this.cine && !this.drone.on && this.fpNow);
    if (this.mg && !this.mg.closed) this.mg.render(this.renderer);
    this.carryTPP();
    if (this.carry && this.fpNow && !this.cine) this.drawCarry();
    if (this.wantSnap) { const f = this.wantSnap; this.wantSnap = null; let img = null; try { img = this.renderer.domElement.toDataURL('image/jpeg', 0.72); } catch (e) { } f(img); }
    HUD.update(dt, this);
    // الخرائط
    if ((this.miniT = (this.miniT || 0) - dt) <= 0) { this.miniT = 1 / 15; this.mapView.drawMini(document.getElementById('minimap'), this); }
    if (UI.mapOpen) { const c = document.getElementById('bigmap'); const W = Math.round(innerWidth * Math.min(2, devicePixelRatio || 1)), H = Math.round(innerHeight * Math.min(2, devicePixelRatio || 1)); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } this.mapView.drawFull(c, this); }
    // حالة الشبكة
    if ((this.netT = (this.netT || 0) - dt) <= 0) {
      this.netT = 0.5; const el = document.getElementById('net');
      if (sim.online) { const ms = Math.round(sim.ping * 1000); el.className = 'on' + (ms > 220 ? ' bad' : ms > 120 ? ' mid' : ''); el.textContent = `◉ ${ms || '…'}ms · ${sim.via === 'p2p' ? 'مباشر' : 'وسيط'}`; }
      else el.className = '';
    }
  }
  draw(withVM) {
    const r = this.renderer;
    if (this.post && this.post.enabled) { this.post.render(this.scene, this.camera, withVM ? this.vm : null); if (UI.screen === 'loadout' || UI.screen === 'shop') this.renderShowcase(1 / 60); return; }
    r.autoClear = true; r.render(this.scene, this.camera);
    if (withVM) { r.autoClear = false; r.clearDepth(); r.render(this.vm.scene, this.vm.cam); r.autoClear = true; }
    if (UI.screen === 'loadout' || UI.screen === 'shop') this.renderShowcase(1 / 60);
  }
  // اسم صغير فوق كل واحد من جماعتي (مثل ببجي)
  nameTags(sim, me, cam) {
    const T = this.tags || (this.tags = new Map()), on = new Set();
    if (me && Settings.nameTags !== false && !this.lobby) for (const p of sim.players.values()) {
      if (p.id === this.me || !p.alive || p.team !== me.team) continue;
      const m = this.models.get(p.id); if (!m) continue;
      let t = T.get(p.id);
      if (!t || t.name !== p.name) {
        if (t) this.scene.remove(t.s);
        const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
        x.font = "800 30px 'Cairo', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText(p.name, 128, 32); x.fillStyle = p.bot ? '#cfe9ff' : '#7dfcff'; x.fillText(p.name, 128, 32);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, fog: false })); s.renderOrder = 9; this.scene.add(s);
        t = { s, name: p.name }; T.set(p.id, t);
      }
      const r = m.root.position, d = Math.hypot(r.x - cam.position.x, r.z - cam.position.z), k = Math.max(0.55, Math.min(2.6, d * 0.045));
      t.s.position.set(r.x, r.y + 2.05 + k * 0.08, r.z); t.s.scale.set(k, k / 4, 1); t.s.visible = true; on.add(p.id);
    }
    for (const [id, t] of T) if (!on.has(id)) { if (!sim.players.has(id)) { this.scene.remove(t.s); T.delete(id); } else t.s.visible = false; }
  }
  surfaceAt(pos) {
    const h = this.world.ray(pos[0], pos[1] + 0.3, pos[2], 0, -1, 0, 0.8, F.NOBULLET, {});
    const wet = this.weather && this.weather.wet > 0.4;
    return h ? (wet && h.mat !== 2 ? 'wet' : h.mat) : (wet ? 'wet' : 5);
  }
  // شبكية المنظار المكبّر تُرسم على لوحة بملء الشاشة
  drawReticle(sc) {
    const cv = document.getElementById('reticle'), W = innerWidth, H = innerHeight, k = Math.min(2, devicePixelRatio || 1);
    const key = sc + W + 'x' + H; if (this.retKey === key) return; this.retKey = key;
    cv.width = W * k; cv.height = H * k; const x = cv.getContext('2d'); x.scale(k, k);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.47;
    x.fillStyle = '#000'; x.beginPath(); x.rect(0, 0, W, H); x.arc(cx, cy, R, 0, Math.PI * 2, true); x.fill();
    const g = x.createRadialGradient(cx, cy, R * 0.75, cx, cy, R); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
    const type = SCOPES[sc].reticle;
    x.strokeStyle = '#0a0a0a'; x.fillStyle = '#0a0a0a'; x.lineWidth = 1.6;
    const line = (a, b, c, d, w = 1.6) => { x.lineWidth = w; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
    if (type === 'sniper' || type === 'mil') {
      line(cx - R, cy, cx - R * 0.12, cy, 3.2); line(cx + R * 0.12, cy, cx + R, cy, 3.2); line(cx, cy + R * 0.12, cx, cy + R, 3.2); line(cx, cy - R, cx, cy - R * 0.12, 1.6);
      line(cx - R * 0.12, cy, cx + R * 0.12, cy, 1); line(cx, cy - R * 0.12, cx, cy + R * 0.12, 1);
      for (let i = 1; i <= 5; i++) { const o = R * 0.022 * i * 2; x.beginPath(); x.arc(cx + o, cy, 1.6, 0, 7); x.arc(cx - o, cy, 1.6, 0, 7); x.fill(); x.beginPath(); x.arc(cx, cy + o, 1.6, 0, 7); x.fill(); }
      if (type === 'mil') { x.fillStyle = '#ff2a2a'; x.beginPath(); x.arc(cx, cy, 2.2, 0, 7); x.fill(); }
    } else if (type === 'acog') {
      x.strokeStyle = '#ff3a2a'; x.fillStyle = '#ff3a2a';
      x.beginPath(); x.moveTo(cx, cy - 2); x.lineTo(cx - 9, cy + 13); x.moveTo(cx, cy - 2); x.lineTo(cx + 9, cy + 13); x.lineWidth = 2.4; x.stroke();
      x.strokeStyle = '#111'; line(cx, cy + 18, cx, cy + R * 0.5, 1.6); for (let i = 1; i <= 4; i++) line(cx - 10 + i * 1.5, cy + 18 + i * R * 0.09, cx + 10 - i * 1.5, cy + 18 + i * R * 0.09, 1.4);
      line(cx - R, cy, cx - R * 0.3, cy, 2.4); line(cx + R * 0.3, cy, cx + R, cy, 2.4);
    } else {
      x.strokeStyle = '#ff3a2a'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(cx - 11, cy + 9); x.lineTo(cx, cy - 2); x.lineTo(cx + 11, cy + 9); x.stroke();
      x.strokeStyle = '#111'; line(cx - R, cy, cx - R * 0.45, cy, 2); line(cx + R * 0.45, cy, cx + R, cy, 2); line(cx, cy + R * 0.4, cx, cy + R, 2);
    }
    // لمعة العدسة
    const sh = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R); sh.addColorStop(0, 'rgba(120,180,255,0.07)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = sh; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
  }
  renderMenu(dt) {
    this.fx.update(dt, this.camera); this.updateWorldAnim(dt); if (this.talk) this.talk.update(dt);
    const r = this.renderer;
    if (this.post && this.post.enabled) this.post.render(this.scene, this.camera, null);
    else { r.autoClear = true; r.render(this.scene, this.camera); }
    this.renderShowcase(dt);
  }
  updateWorldAnim(dt) { if (this.onAnim) this.onAnim(dt, this.t); this.updateCivs(dt); this.updateCps(dt); if (this.sim) this.drone.update(dt); this.doorsVis.update(dt); this.wps.update(dt); this.ambient.update(dt); this.quests.update(dt); this.mudhif.update(dt); this.houseDoors.update(dt); }
  // علامات نقاط السيطرة بالعالم: حلقة على الأرض بلون المسيطر وعمود ضوء خفيف وحرف فوقها
  updateCps(dt) {
    const C = (this.sim && this.sim.cps) || [], me = this.mp;
    if (!this.cpG) { this.cpG = new THREE.Group(); this.scene.add(this.cpG); this.cpM = []; }
    while (this.cpM.length > C.length) { const m = this.cpM.pop(); this.cpG.remove(m.g); }
    C.forEach((c, i) => {
      let m = this.cpM[i];
      if (!m) {
        const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), mat); ring.rotation.x = -Math.PI / 2; g.add(ring);
        const fill = new THREE.Mesh(new THREE.CircleGeometry(0.93, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false })); fill.rotation.x = -Math.PI / 2; g.add(fill);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })); col.position.y = 0.5; g.add(col);
        const cv = document.createElement('canvas'); cv.width = cv.height = 64; const tx = new THREE.CanvasTexture(cv);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); spr.scale.set(0.9, 0.9, 1); g.add(spr);
        this.cpG.add(g); m = this.cpM[i] = { g, ring, fill, col, spr, cv, tx, key: '' };
      }
      m.g.position.set(c.x, c.y + 0.04, c.z); m.ring.scale.setScalar(c.r); m.fill.scale.setScalar(c.r);
      m.col.scale.set(1, 6, 1); m.col.position.y = 3; m.spr.position.y = 6.6;
      const mine = me && c.owner === me.team, hex = c.owner < 0 ? 0xf2f2f2 : mine ? 0x50beff : 0xff5050;
      m.ring.material.color.setHex(hex); m.fill.material.color.setHex(hex); m.col.material.color.setHex(hex);
      m.ring.material.opacity = c.contest ? 0.35 + 0.4 * Math.abs(Math.sin(this.t * 6)) : 0.6;
      const key = c.name + hex;
      if (m.key !== key) { m.key = key; const x = m.cv.getContext('2d'); x.clearRect(0, 0, 64, 64); x.fillStyle = '#' + hex.toString(16).padStart(6, '0'); x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = '900 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(c.name, 32, 34); m.tx.needsUpdate = true; }
    });
  }
  // أهل السوق: تحريك القريبين فقط، وإخفاء البعيدين، وظلال للقريبين جداً
  // المدنيون الواقفون يهربون من الرمي القريب:
  // باللوبي يركضون لباب بيت ويدخلون ويسكّرون وراهم، وبالمعارك يلتجئون لمضيف الشيخ (يمنع فيه الرمي) ويگعدون هناك
  civFlee(pos) {
    if (this.cine) return;
    const t = this.t;
    if (this.lobby && this.ambient) this.ambient.flee(pos);
    (this.civs || []).forEach((c, i) => {
      if (!c.alive || c.away || c.fl || c.sit || c.n.pose === 'pray' || c.n.pose === 'sit' || c.n.quest) return;
      if (Math.hypot(c.n.x - pos[0], c.n.z - pos[2]) > 22) return;
      let F = null;
      if (this.lobby) {
        const d = this.houseDoors && this.houseDoors.pick(c.n.x, c.n.z);
        if (d) { d.busy++; F = { mode: 'house', door: d, path: findPath(this.world, [c.n.x, 0, c.n.z], [d.fx, 0, d.fz]), back: t + 45 + Math.random() * 30 }; }
      } else {
        const seat = this.refugeSeat();
        if (seat) F = { mode: 'mudhif', seat, path: [...findPath(this.world, [c.n.x, 0, c.n.z], [-50.4, 0, -12]), [-53.6, -12], seat], back: t + 90 + Math.random() * 60 };
      }
      if (!F) { const h = this.hideSpot(c, pos); if (!h) return; F = { mode: 'hide', path: findPath(this.world, [c.n.x, 0, c.n.z], [h.x, 0, h.z]), back: t + 45 + Math.random() * 30 }; }
      F.pi = 1; F.stage = 'run'; F.i = i; F.sp = 4.6;
      c.fl = F; c.cower = 0;
      const st = this.sim && this.sim.npcs && this.sim.npcs[i], wn = this.world.npcs[i]; if (st) st.away = true; if (wn && wn.box >= 0) this.world.disable(wn.box);
    });
  }
  refugeSeat() {
    const used = new Set((this.civs || []).filter(c => c.fl && c.fl.seat).map(c => c.fl.seat.join()));
    for (let k = 0; k < 16; k++) { const s = [-63.4 + (k >> 1) * 1.25, k % 2 ? -16.9 : -7.1]; if (!used.has(s.join())) return s; }
    return null;
  }
  // مخبأ: نقطة بالأزقة بعيدة عن الرامي وما يشوفها
  hideSpot(c, pos) {
    const N = (this.world.nav && this.world.nav.nodes) || [], W = this.world; let best = null, bs = 1e9;
    const ax = c.n.x - pos[0], az = c.n.z - pos[2], al = Math.hypot(ax, az) || 1;
    for (const n of N) {
      const dx = n[0] - c.n.x, dz = n[2] - c.n.z, d = Math.hypot(dx, dz);
      if (d < 7 || d > 26 || Math.abs(n[1]) > 0.6) continue;
      const away = (dx * ax + dz * az) / (d * al); if (away < 0.1) continue;
      const score = d - away * 6;
      if (score >= bs) continue;
      if (W.los(pos[0], (pos[1] || 0) + 1.5, pos[2], n[0], 1.2, n[2])) continue;
      bs = score; best = { x: n[0], z: n[2] };
    }
    return best;
  }
  civHome(c) {
    const F = c.fl, r = c.root; c.fl = null; c.prayP = null; c.setAway(false); r.position.set(c.n.x, c.n.y, c.n.z); r.rotation.y = c.n.yaw; c.walkSp = 0;
    if (F && F.door) F.door.busy = Math.max(0, F.door.busy - 1);
    const st = this.sim && this.sim.npcs && this.sim.npcs[F.i], wn = this.world.npcs[F.i]; if (st) st.away = false; if (wn && wn.box >= 0 && (!st || st.alive !== false)) this.world.restore(wn.box);
  }
  updateFlee(c, dt) {
    const F = c.fl, r = c.root;
    if (F.stage === 'hid') { if (this.t >= F.back) this.civHome(c); return true; }
    if (F.stage === 'sit') {
      if (this.t < F.back) return false;
      // هدأ الوضع: يطلع من المضيف ويرجع لمكانه مشياً
      c.prayP = null; F.stage = 'ret'; F.sp = 1.3; F.pi = 1;
      F.path = [[r.position.x, r.position.z], [-55.5, F.seat[1] * 0.4 - 7.2], [-53.6, -12], [-50.4, -12], ...findPath(this.world, [-50.4, 0, -12], [c.n.x, 0, c.n.z]).slice(1), [c.n.x, c.n.z]];
      return false;
    }
    const p = F.path[F.pi];
    if (!p) {
      if (F.stage === 'ret') { this.civHome(c); return false; }
      if (F.mode === 'mudhif' && F.stage === 'run') { F.stage = 'sit'; c.walkSp = 0; c.prayP = 'sit'; r.rotation.y = Math.atan2(-(-58.4 - r.position.x), -(-12 - r.position.z)); return false; }
      if (F.mode === 'house' && F.stage === 'run') {
        const d = F.door; d.want = 1; F.stage = 'enter'; F.sp = 1.4; F.wait = 0.5; F.path = [[r.position.x, r.position.z], [d.x - d.nx * 0.2, d.z - d.nz * 0.2]]; F.pi = 1;
        r.rotation.y = Math.atan2(d.nx, d.nz) + Math.PI; return false;
      }
      F.stage = 'hid'; c.setAway(true); if (F.door) setTimeout(() => { F.door.want = 0; }, 600); return true;
    }
    if (F.wait > 0) { F.wait -= dt; c.walkSp = 0; return false; }
    const dx = p[0] - r.position.x, dz = p[1] - r.position.z, d = Math.hypot(dx, dz);
    if (d < 0.3) { F.pi++; return false; }
    const st = Math.min(d, F.sp * dt); r.position.x += dx / d * st; r.position.z += dz / d * st;
    let a = Math.atan2(-dx, -dz) - r.rotation.y; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; r.rotation.y += a * Math.min(1, dt * 8);
    c.walkSp = F.sp > 2 ? 3.4 : 1.1;
    return false;
  }
  updateCivs(dt) {
    const cam = this.camera.position, W = this.weather;
    // الليل: أصحاب المحال وبيّاع الشاي وزبائنه راحوا لبيوتهم. المطر: الباقون بمظلّات
    const night = !!(this.sim && W && W.cur && W.cur.night > 0.5), rain = !!(W && (W.rainNow || 0) > 0.15);
    if (this.civNight !== night) {
      this.civNight = night;
      (this.civs || []).forEach((c, i) => { const away = night && c.shop && !this.lobby; c.setAway(away); const st = this.sim && this.sim.npcs && this.sim.npcs[i]; if (st) st.away = away; const wn = this.world.npcs[i]; if (wn && wn.box >= 0) { if (away) this.world.disable(wn.box); else if (!st || st.alive !== false) this.world.restore(wn.box); } });
    }
    for (const c of this.civs || []) {
      if (c.fl && c.alive && this.updateFlee(c, dt)) continue;
      if (c.away) continue;
      if (c.umbOK) c.setUmbrella(rain && c.alive);
      const d = Math.hypot(c.n.x - cam.x, c.n.z - cam.z), vis = d < 48;
      if (c.root.visible !== vis) c.root.visible = vis;
      if (!vis) continue;
      const sh = d < 16; if (c.sh !== sh) { c.sh = sh; c.root.traverse(o => { if (o.isMesh) o.castShadow = sh; }); }
      if (d < 30 || !c.alive) c.update(dt, cam);
    }
  }
  // مطابقة الأجسام المكسورة وأهل السوق مع حالة المحاكاة (بداية مباراة أو دخول متأخر)
  syncWorld(instant) {
    const sim = this.sim, set = this.meshes && this.meshes.userData.setProp; if (!sim) return;
    const P = sim.props || [], N = sim.npcs || [];
    (this.world.props || []).forEach((p, i) => { const on = !P[i] || P[i].alive !== false; if (set) set(i, on); if (p.kind === 'lamp' && this.meshes.userData.lampAt) this.meshes.userData.lampAt(p.c, on); });
    (this.civs || []).forEach((c, i) => { const alive = !N[i] || N[i].alive !== false; if (alive && !c.alive) c.revive(); else if (!alive && c.alive) { c.die(null); if (instant) { c.dead = 0.999; c.update(0.01, this.camera.position); } } });
  }
  resetWorldVis() { const set = this.meshes && this.meshes.userData.setProp, la = this.meshes && this.meshes.userData.lampAt; (this.world.props || []).forEach((p, i) => { set && set(i, true); if (la && p.kind === 'lamp') la(p.c, true); }); for (const c of this.civs || []) if (!c.alive) c.revive(); }
  spectate(dt) {
    const sim = this.sim, cam = this.camera, me = this.mp;
    const sp = this.spec || (this.spec = { id: -1, t: 0, pos: me ? me.pos.slice() : [0, 0, 0] });
    sp.t += dt;
    let target = sp.id >= 0 ? sim.players.get(sp.id) : null;
    const tdmWait = sim.tdm && me && !me.alive;
    // في وضع الإحياء نشاهد قاتلنا حتى نعود
    if (!tdmWait && (!target || !target.alive || sp.t > 3.5) && me) {
      const mates = [...sim.players.values()].filter(p => p.alive && p.team === me.team);
      if (mates.length) { if (!target || target.team !== me.team || !target.alive) { target = mates[0]; sp.id = target.id; } }
      else if (target && !target.alive) target = null;
    }
    if (tdmWait && target && !target.alive) target = null;
    if (!tdmWait && Input.take('fire') && me) { const mates = [...sim.players.values()].filter(p => p.alive && p.team === me.team); if (mates.length) { const i = (mates.findIndex(p => p.id === sp.id) + 1) % mates.length; sp.id = mates[i].id; target = mates[i]; } }
    if (target) {
      const e = [target.pos[0], target.pos[1] + eyeHeight(target), target.pos[2]], d = dirFrom(target.yaw, target.pitch * 0.5);
      const back = new THREE.Vector3(e[0] - d[0] * 2.8, e[1] + 0.7, e[2] - d[2] * 2.8);
      const dx = back.x - e[0], dy = back.y - e[1], dz = back.z - e[2], L = Math.hypot(dx, dy, dz);
      const h = this.world.ray(e[0], e[1], e[2], dx / L, dy / L, dz / L, L, F.NOBULLET, {});
      if (h) back.set(e[0] + dx / L * (h.t - 0.25), e[1] + dy / L * (h.t - 0.25), e[2] + dz / L * (h.t - 0.25));
      cam.position.lerp(back, Math.min(1, dt * 8)); cam.lookAt(e[0] + d[0] * 6, e[1] + d[1] * 6, e[2] + d[2] * 6);
      HUD.spec(tdmWait ? (target.team !== (me ? me.team : 0) ? 'قاتلك: ' + target.name : '') : 'تشاهد: ' + target.name + (Input.isTouch ? '' : ' — انقر للتبديل'));
    } else {
      const p = sp.pos; cam.position.lerp(new THREE.Vector3(p[0] + 4, p[1] + 5, p[2] + 4), Math.min(1, dt * 2)); cam.lookAt(p[0], p[1], p[2]);
      HUD.spec(tdmWait ? '' : 'في انتظار الجولة التالية');
    }
  }
}
