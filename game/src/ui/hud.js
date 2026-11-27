// واجهة اللعب (HUD) على طريقة ببجي: بوصلة ونتيجة في الأعلى، خريطة مصغّرة يميناً، حياة وأسلحة في الأسفل،
// وأزرار لمس كبيرة: إطلاق يميني ويساري، تصويب، قفز، انحناء، تلقيم، قنبلة، استراق يمين/يسار
import { Input } from '../core/input.js';
import { Settings } from '../core/settings.js';
import { WEAPONS, SCOPES, NADES } from '../sim/weapons.js';
import { Economy, fmtIQD } from '../game/economy.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const I = {
  fire: '<svg viewBox="0 0 48 48"><path d="M8 30h22l4-6h6v-6h-8l-2-4H8l-2 4v8z" fill="currentColor"/><path d="M12 30v8h6v-8" fill="currentColor"/></svg>',
  ads: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><circle cx="24" cy="24" r="13"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10"/><circle cx="24" cy="24" r="2.5" fill="currentColor"/></svg>',
  jump: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 26l12-12 12 12"/><path d="M12 36l12-12 12 12" opacity=".55"/></svg>',
  crouch: '<svg viewBox="0 0 48 48" fill="currentColor"><circle cx="22" cy="11" r="5"/><path d="M15 20h12l6 8-4 3-4-5v6l6 8h-6l-6-7-5 7H8l6-10z"/></svg>',
  reload: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M36 18a13 13 0 1 0 1 10"/><path d="M37 8v10H27" stroke-linejoin="round"/></svg>',
  nade: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M20 8h8v5h-8z"/><path d="M28 10l8-4 2 3-8 4z"/><ellipse cx="24" cy="29" rx="11" ry="13"/></svg>',
  leanL: '<svg viewBox="0 0 48 48" fill="currentColor"><circle cx="18" cy="12" r="5"/><path d="M20 19l-8 18h6l4-8 4 9h6l-7-17z" transform="rotate(-14 24 28)"/><path d="M8 22l-4 4 4 4" stroke="currentColor" stroke-width="3" fill="none"/></svg>',
  leanR: '<svg viewBox="0 0 48 48" fill="currentColor"><circle cx="30" cy="12" r="5"/><path d="M28 19l8 18h-6l-4-8-4 9h-6l7-17z" transform="rotate(14 24 28)"/><path d="M40 22l4 4-4 4" stroke="currentColor" stroke-width="3" fill="none"/></svg>',
  pause: '<svg viewBox="0 0 48 48" fill="currentColor"><rect x="13" y="11" width="7" height="26" rx="2"/><rect x="28" y="11" width="7" height="26" rx="2"/></svg>',
  score: '<svg viewBox="0 0 48 48" fill="currentColor"><rect x="8" y="11" width="32" height="5" rx="2"/><rect x="8" y="21" width="32" height="5" rx="2"/><rect x="8" y="31" width="32" height="5" rx="2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/></svg>',
  helmet: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 15a9 9 0 0 1 18 0v2H3z"/><rect x="2" y="17" width="20" height="3" rx="1"/></svg>',
  kit: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M10 16h28l2 22H8z"/><path d="M18 16v-5h12v5" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
  band: '<svg viewBox="0 0 48 48"><rect x="6" y="17" width="36" height="14" rx="7" transform="rotate(-35 24 24)" fill="#f1e2c6"/><rect x="17" y="18.5" width="14" height="11" rx="2" transform="rotate(-35 24 24)" fill="#d9b58a"/><g fill="#b08f66" transform="rotate(-35 24 24)"><circle cx="21" cy="22" r="1"/><circle cx="27" cy="22" r="1"/><circle cx="21" cy="26" r="1"/><circle cx="27" cy="26" r="1"/></g></svg>',
  syr: '<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round"><g transform="rotate(45 24 24)"><rect x="18" y="10" width="12" height="22" rx="2" fill="#bfe8ff" stroke="#e8f6ff" stroke-width="2"/><rect x="18" y="20" width="12" height="12" fill="#ff5a6a"/><path d="M24 32v10" stroke="#e8f6ff" stroke-width="2.5"/><path d="M15 9h18M24 4v6" stroke="#e8f6ff" stroke-width="3"/></g></svg>',
};

export const HUD_HTML = `
<div id="hud">
  <div id="flashov"></div><div id="hurtov"></div><div id="bloodov"></div><div id="protov"></div>
  <div id="scopeov"><canvas id="reticle"></canvas></div>
  <div id="cross"><i></i><i></i><i></i><i></i><b></b></div>
  <div id="hitm"><i></i><i></i><i></i><i></i></div>
  <div id="dmgdirs"></div>
  <div id="nadeWarn"><i></i><b>!</b><span>قنبلة قريبة</span></div>
  <div id="nvgov"></div>
  <div id="topbar">
    <div class="tscore"><span class="t0"><em id="tn0">الفريق</em><b id="sc0">0</b></span><span id="timer">0:00</span><span class="t1"><b id="sc1">0</b><em id="tn1">الفريق</em></span></div>
    <div id="phase"></div>
    <div id="domBar"></div>
    <div id="compass"><div id="compassStrip"></div><i class="needle"></i><span id="bearing">0</span></div>
  </div>
  <div id="tl"><div class="hb" id="hPause">${I.pause}</div><div class="hb" id="hScore">${I.score}</div><div class="hb" id="hNvg">NV</div><div class="hb" id="hDrone">🛸<i id="hDroneCd"></i></div></div><div id="perf"><div id="fps"></div><div id="net"></div></div>
  <div id="feed"></div>
  <div id="qTrack"></div>
  <div id="lobbyBar" title="ثروتك"><i>💰</i><b id="lobbyMoney"></b></div>
  <div id="mg"><div class="vf"><i></i><i></i><i></i><i></i><b>●REC</b></div><div class="mgbox"><b class="mgt"></b><p class="mgi"></p><div class="mgp"><i></i></div><div class="mgw"><span>0</span><em></em><i></i><b>0 غم</b></div><div class="mgb"></div></div><div class="mgm"></div><div class="fl"></div></div>
  <div id="droneHud"><div class="dvf"><i></i><i></i><i></i><i></i></div><b class="rec">● REC · درون استطلاع</b><div class="dinfo"><span id="dT">30</span><span id="dAlt">0م</span><span id="dDist">0م</span></div><small>العصا للحركة · اسحب للالتفات · القفز يصعد · الانحناء ينزل</small><button class="btn" id="dBack">↩ أعِد الدرون</button><button class="btn" id="dBomb">💣 أسقِط الرمّانة</button></div>
  <div id="useHint"><kbd>F</kbd><span id="useHintL"></span></div>
  <div id="cine"><i class="lb t"></i><i class="lb b"></i><div class="cbox"><img class="cimg" alt=""><b class="cname"></b><p class="ctext"></p><div class="copts"></div><div class="cact"><i></i><em></em><b></b></div><small class="ctap">اضغط للمتابعة</small></div></div>
  <div id="mini"><canvas id="minimap" width="256" height="256"></canvas><span class="mlab">الخريطة</span></div>
  <div id="banner"><b></b><small></small></div>
  <div id="toast"></div>
  <div id="streak"></div>
  <div id="respawn"><b>ستعود بعد <span id="rsT">4</span></b><small id="rsBy"></small><div class="hint">بدّل عتادك الآن — يُطبّق عند عودتك</div><button id="rsLoad" class="btn sm">العتاد</button></div>
  <div id="warm"><b id="warmT">5</b><small>استعدّ… المعركة تبدأ</small><button id="warmLoad" class="btn sm">العتاد</button></div>
  <div id="spec"></div>
  <div id="healov"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" class="bg"/><circle cx="32" cy="32" r="27" class="fg" id="healArc"/></svg><b id="healTx">ضمادة</b></div>
  <div id="bottom">
    <div id="ammo"><b id="magV">30</b><span id="resV">90</span><small id="wName"></small></div>
    <div id="slots"></div>
    <div id="vitals"><i class="ic" id="arI">${I.shield}</i><i class="ic" id="hlI">${I.helmet}</i><div class="bar"><div id="hpBar"></div><div id="hpGhost"></div></div><b id="hpV">100</b></div>
  </div>
  <div id="board" class="hidden"></div>
  <div id="touch">
    <div id="stick"><div id="knob"></div></div><div id="stickHint"></div>
    <div class="tb fire" id="bFire">${I.fire}</div>
    <div class="tb fire l" id="bFireL">${I.fire}</div>
    <div class="tb" id="bAds">${I.ads}</div>
    <div class="tb" id="bJump">${I.jump}</div>
    <div class="tb" id="bCrouch">${I.crouch}</div>
    <div class="tb" id="bReload">${I.reload}</div>
    <div class="tb sm" id="bNade">${I.nade}<span id="nadeN"></span></div>
    <div class="tb sm" id="bLeanL">${I.leanL}</div>
    <div class="tb sm" id="bLeanR">${I.leanR}</div>
    <div class="tb med" id="bBand">${I.band}<span id="bandN">5</span></div>
    <div class="tb med" id="bSyr">${I.syr}<span id="syrN">2</span></div>
    <div class="tb use" id="bUse"><span id="useL">استعمال</span></div>
    <div class="tb zm" id="bZoomIn">＋</div>
    <div class="tb zm" id="bZoomOut">－<small id="zoomV"></small></div>
  </div>
</div>`;

export const HUD = {
  game: null, ui: null, t: 0, feedN: 0,
  init(game, ui) {
    this.game = game; this.ui = ui;
    const C = (id, o) => ({ id, el: $(id), round: true, ...o });
    const slotsEl = $('slots');
    const slotAt = (x, y) => { const b = [...slotsEl.querySelectorAll('[data-slot]')].find(b => { const r = b.getBoundingClientRect(); return x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 8 && y <= r.bottom + 8; }); if (b) game.queueSlot(+b.dataset.slot); };
    const controls = [
      C('hPause', { round: false, tapUp: true, pad: 12, tap: () => game.pause() }),
      C('hNvg', { round: false, tapUp: true, pad: 10, tap: () => game.toggleNvg() }),
      C('hDrone', { round: false, tapUp: true, pad: 10, tap: () => game.toggleDrone() }),
      C('hScore', { round: false, tapUp: true, pad: 12, tap: () => { this.showScore(!this.scoreOn); } }),
      C('mini', { round: false, tapUp: true, tap: () => ui.openMap() }),
      C('rsLoad', { round: false, tapUp: true, tap: () => ui.open('loadout') }),
      C('warmLoad', { round: false, tapUp: true, tap: () => ui.open('loadout') }),
      { id: 'slots', el: slotsEl, round: false, pad: 4, tap: slotAt },
      C('bFire', { action: 'fire', look: true, pad: 14 }),
      C('bFireL', { action: 'fire', look: true, pad: 10 }),
      C('bAds', { action: 'ads', look: true }),
      C('bJump', { action: 'jump' }),
      C('bCrouch', { action: 'crouch', toggle: true }),
      C('bReload', { action: 'reload' }),
      C('bNade', { action: 'grenade' }),
      C('bLeanL', { action: 'leanL', toggle: true, excl: 'leanR' }),
      C('bLeanR', { action: 'leanR', toggle: true, excl: 'leanL' }),
      C('bBand', { action: 'heal1' }),
      C('bSyr', { action: 'heal2' }),
      C('bUse', { round: false, tapUp: true, pad: 8, tap: () => game.useAction() }),
      C('bZoomIn', { round: true, tap: () => game.zoomStep(1) }),
      C('bZoomOut', { round: true, tap: () => game.zoomStep(-1) }),
    ];
    this.controls = controls;
    Input.bindTouch($('touch'), controls, $('stick'), $('knob'));
    // الفأرة على سطح المكتب
    $('dBack').addEventListener('click', e => { e.stopPropagation(); game.toggleDrone(); });
    $('dBomb').addEventListener('click', e => { e.stopPropagation(); if (game.drone.drop()) HUD.toast('رُمِيَت قنبلة!'); });
    $('dBomb').addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
    for (const id of ['hPause', 'hNvg', 'hDrone', 'hScore', 'mini', 'rsLoad', 'warmLoad']) $(id).addEventListener('click', e => { if (Input.isTouch) return; e.stopPropagation(); controls.find(c => c.id === id).tap(); });
    slotsEl.addEventListener('click', e => { if (Input.isTouch) return; const b = e.target.closest('[data-slot]'); if (b) game.queueSlot(+b.dataset.slot); });
    this.layout();
    addEventListener('resize', () => this.layout());
    this.buildCompass();
  },
  layout() {
    const d = document.documentElement;
    d.classList.toggle('touch', Input.isTouch);
    // حجم الأزرار يتناسب مع الشاشة (هواتف صغيرة حتى الأجهزة اللوحية) × اختيار اللاعب
    const W = innerWidth, H = innerHeight, k = Math.max(0.78, Math.min(1.65, Math.min(H / 400, W / 820)));
    d.style.setProperty('--ts', (Settings.touchSize || 1) * k);
    d.style.setProperty('--hs', k);
    d.style.setProperty('--ha', Settings.hudAlpha ?? 0.9);
    $('bFireL').style.display = Settings.leftFire ? '' : 'none';
  },
  show(on) { $('hud').classList.toggle('on', on); if (!on) { Input.reset(); this.showScore(false); } },
  // ---------- البوصلة ----------
  buildCompass() {
    const s = $('compassStrip'), L = { 0: 'ش', 45: 'شق', 90: 'ق', 135: 'جق', 180: 'ج', 225: 'جغ', 270: 'غ', 315: 'شغ' };
    let h = '';
    for (let k = -1; k <= 1; k++) for (let a = 0; a < 360; a += 15) { const deg = a + k * 360; h += `<i style="left:${deg * 3}px" class="${a % 45 === 0 ? 'm' : ''}">${a % 45 === 0 ? (L[a] || '') : a % 30 === 0 ? a : ''}</i>`; }
    s.innerHTML = h;
  },
  compass(yaw) {
    // شمال الخريطة = -z ؛ الدوران: yaw=0 ينظر نحو -z
    let deg = (-yaw * 180 / Math.PI) % 360; if (deg < 0) deg += 360;
    $('compassStrip').style.transform = `translateX(${-deg * 3}px)`;
    $('bearing').textContent = Math.round(deg);
  },
  // ---------- التحديث كل إطار ----------
  update(dt, g) {
    this.t += dt;
    const sim = g.sim, me = g.mp; if (!sim || !me) return;
    // زر الاستعمال واللوبي
    const U = g.useInfo, ul = U ? U.label : '';
    if (this.useL !== ul) { this.useL = ul; $('bUse').classList.toggle('show', !!U); $('useHint').classList.toggle('on', !!U && !Input.isTouch); if (U) { $('useL').textContent = ul; $('useHintL').textContent = ul; } }
    { const D = g.drone; if (D) { const el = $('hDrone'); el.classList.toggle('act', D.on); el.classList.toggle('cd', !D.ready && !D.on); $('hDroneCd').textContent = !D.ready && !D.on ? Math.ceil(D.cdLeft) : ''; if (D.on) { $('dT').textContent = '⏱ ' + Math.max(0, Math.ceil(30 - D.t)); $('dAlt').textContent = '↑ ' + Math.round(D.pos.y) + 'م'; $('dDist').textContent = '↔ ' + Math.round(Math.hypot(D.pos.x - D.home[0], D.pos.z - D.home[2])) + 'م'; } } }
    document.body.classList.toggle('cine', !!g.cine); const mgOn = !!(g.mg && !g.mg.closed); document.body.classList.toggle('mg', mgOn); document.body.classList.toggle('mglook', mgOn && g.mg.allowLook);
    if (g.lobby) { const m = Economy.money; if (this.lm !== m) { this.lm = m; $('lobbyMoney').textContent = fmtIQD(m); } }
    // الوقت والنتيجة
    const t = Math.max(0, Math.ceil(sim.phaseT));
    const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('timer').textContent = sim.phase === 'live' ? fmt(t) : sim.phase === 'buy' ? fmt(t) : sim.phase === 'end' || sim.phase === 'over' ? 'انتهى' : '—';
    $('timer').classList.toggle('low', sim.phase === 'live' && t <= 30);
    if (this.tnFor !== me.team) { this.tnFor = me.team; $('tn0').textContent = me.team === 0 ? 'نحن' : 'الأعداء'; $('tn1').textContent = me.team === 1 ? 'نحن' : 'الأعداء'; }
    if (this.sc0 !== sim.score[0]) { this.sc0 = sim.score[0]; $('sc0').textContent = sim.score[0]; this.pop('sc0'); }
    if (this.sc1 !== sim.score[1]) { this.sc1 = sim.score[1]; $('sc1').textContent = sim.score[1]; this.pop('sc1'); }
    const tdm = sim.rules ? sim.rules !== 'rounds' : sim.tdm, dom = sim.rules === 'dom' || sim.dom;
    $('phase').textContent = sim.phase === 'live' ? (dom ? 'سيطِر على النقاط — كل ثانية نقطة' : tdm ? 'الأكثر قتلاً يفوز عند انتهاء الوقت' : 'الجولة ' + sim.round) : '';
    this.domHud(sim, me); this.nadeWarn(sim, me, g.yaw);
    const nv = !!(g.nvgAvail && g.nvgAvail()); $('hNvg').classList.toggle('on', nv); $('hNvg').classList.toggle('act', !!g.nvgOn);
    this.compass(g.yaw);
    // الإحماء / الإحياء
    const warm = sim.phase === 'buy';
    $('warm').classList.toggle('on', warm && me.alive); if (warm) $('warmT').textContent = t;
    const rs = tdm && !me.alive && sim.phase === 'live' && me.respawnT > 0;
    $('respawn').classList.toggle('on', rs);
    if (rs) $('rsT').textContent = Math.max(1, Math.ceil(me.respawnT));
    $('protov').classList.toggle('on', me.alive && me.spawnProt > 0);
    // الحياة والدروع
    const hp = Math.max(0, Math.ceil(me.hp)), mx = me.maxHp || 150, pc = hp / mx * 100;
    $('hpV').textContent = hp; $('hpBar').style.width = pc + '%';
    this.ghost = Math.max(pc, (this.ghost ?? 100) - dt * 30); $('hpGhost').style.width = this.ghost + '%';
    $('vitals').className = pc <= 25 ? 'crit' : pc <= 55 ? 'mid' : '';
    // العلاج
    const md = me.meds || { b: 0, s: 0 };
    $('bandN').textContent = md.b; $('syrN').textContent = md.s;
    $('bBand').classList.toggle('dis', !md.b || hp >= mx); $('bSyr').classList.toggle('dis', !md.s || hp >= mx);
    const healing = me.alive && me.healT > 0;
    $('healov').classList.toggle('on', healing);
    if (healing) { const tot = me.healK === 2 ? 4 : me.healK === 3 ? 6 : me.healK === 4 ? 3 : 2.4, k = 1 - me.healT / tot; $('healArc').style.strokeDashoffset = (170 * (1 - k)).toFixed(1); $('healTx').textContent = (me.healK === 2 ? 'إبرة' : me.healK === 3 ? 'لبلبي' : me.healK === 4 ? 'شاي' : 'ضمادة') + ' ' + me.healT.toFixed(1); }
    // تكبير المنظار المتغيّر
    const zs = me.slot === 1 && me.scope && SCOPES[me.scope] && SCOPES[me.scope].zoom && g.scoped;
    $('bZoomIn').classList.toggle('show', !!zs); $('bZoomOut').classList.toggle('show', !!zs);
    if (zs) $('zoomV').textContent = '×' + g.magOf(me);
    $('arI').style.opacity = me.armor > 0 ? 0.35 + me.armor / 160 : 0.12; $('hlI').style.opacity = me.helmet > 0 ? 0.35 + me.helmet / 160 : 0.12;
    // السلاح والذخيرة
    const w = me.slot <= 3 ? me.inv[me.slot] : null, wd = w ? (w.wd || WEAPONS[w.id]) : null;
    if (me.slot === 4) { $('wName').textContent = NADES[me.inv[4][0]] ? NADES[me.inv[4][0]].name : ''; $('magV').textContent = me.inv[4].length; $('resV').textContent = ''; }
    else if (wd) {
      $('wName').textContent = wd.name + (me.slot === 1 && me.scope && me.scope !== 'iron' ? ' · ' + SCOPES[me.scope].short : '');
      $('magV').textContent = wd.mag ? w.mag : '∞'; $('resV').textContent = wd.mag ? w.reserve : '';
      $('ammo').classList.toggle('low', !!wd.mag && w.mag <= Math.ceil(wd.mag * 0.25)); $('ammo').classList.toggle('rel', me.reloadT > 0);
    }
    const sig = [me.slot, me.inv[1] && me.inv[1].id, me.inv[2] && me.inv[2].id, me.inv[4].length].join();
    if (this.slotSig !== sig) {
      this.slotSig = sig;
      const name = s => s === 4 ? (NADES[me.inv[4][0]] || { name: '' }).name : WEAPONS[me.inv[s].id].name;
      $('slots').innerHTML = [1, 2, 3, 4].filter(s => s === 4 ? me.inv[4].length : me.inv[s]).map(s => `<button data-slot="${s}" class="${me.slot === s ? 'on' : ''} s${s}"><small>${s === 4 ? '● ' + me.inv[4].length : s}</small>${esc(name(s))}</button>`).join('');
      $('nadeN').textContent = me.inv[4].length || '';
    }
    // مؤشر التصويب
    const cr = $('cross'), sp = Math.hypot(me.vel[0], me.vel[2]);
    const hipK = 1 - me.adsT;
    const gap = 4 + ((wd && wd.hip ? wd.hip * 520 : 10) * hipK + Math.min(22, sp * 2 + (me.onGround ? 0 : 12) + me.shots * 1.2)) * (me.crouch > 0.5 ? 0.8 : 1);
    cr.style.setProperty('--g', gap.toFixed(1) + 'px'); cr.style.setProperty('--c', Settings.crossColor);
    const scoped = g.scoped;
    cr.classList.toggle('hide', scoped || !me.alive || (me.adsT > 0.55 && me.slot <= 2) || (wd && wd.cls === 'knife' && false));
    $('scopeov').classList.toggle('on', !!scoped);
    // الوميض والألم
    g.flashA = Math.max(0, g.flashA - dt * 0.45); g.hurtA = Math.max(0, g.hurtA - dt * 1.2);
    $('flashov').style.opacity = g.flashA.toFixed(3);
    const low = me.alive && me.hp < (me.maxHp || 150) * 0.25 ? 0.3 + Math.sin(this.t * 5) * 0.12 : 0;
    $('hurtov').style.opacity = Math.max(g.hurtA, low).toFixed(3);
    $('bloodov').style.opacity = Math.max(0, (g.bloodA = Math.max(0, (g.bloodA || 0) - dt * 0.25))).toFixed(3);
    // أزرار حسب الحالة
    $('bNade').classList.toggle('dis', !me.inv[4].length);
    $('bAds').classList.toggle('on', Input.ads && me.slot <= 2);
    // اللوحة إن كانت مفتوحة
    if (this.scoreOn && (this.boardT = (this.boardT || 0) - dt) <= 0) { this.boardT = 0.5; this.ui.renderScore($('board'), sim, me); }
  },
  // نقاط السيطرة أعلى الشاشة
  domHud(sim, me) {
    const el = $('domBar'), C = sim.cps || [];
    if (!C.length) { if (this.domKey) { el.innerHTML = ''; this.domKey = ''; } return; }
    const key = C.map(c => c.owner + ':' + Math.round(c.prog * 20) + ':' + (c.contest ? 1 : 0)).join('|') + ':' + me.team;
    if (key === this.domKey) return; this.domKey = key;
    el.innerHTML = C.map(c => { const mine = c.owner === me.team, foe = c.owner >= 0 && !mine, toMe = me.team === 0 ? c.prog < 0 : c.prog > 0; return `<i class="cp ${mine ? 'mine' : foe ? 'foe' : ''} ${c.contest ? 'cont' : ''}" style="--p:${Math.abs(c.prog).toFixed(2)}" data-to="${toMe ? 'me' : 'foe'}"><b>${c.name}</b></i>`; }).join('');
  },
  // تحذير قنبلة قريبة (مثل ببجي): سهم باتجاهها ويرجف أكثر كلما قربت
  nadeWarn(sim, me, yaw) {
    let best = null, bd = 7.5;
    if (me.alive) for (const n of sim.nades || []) { if (n.kind !== 'frag' && n.kind !== 'molotov') continue; const d = Math.hypot(n.pos[0] - me.pos[0], n.pos[2] - me.pos[2]); if (d < bd && Math.abs(n.pos[1] - me.pos[1]) < 4) { bd = d; best = n; } }
    const el = $('nadeWarn'); el.classList.toggle('on', !!best);
    if (!best) return;
    const a = Math.atan2(-(best.pos[0] - me.pos[0]), -(best.pos[2] - me.pos[2])) - yaw;
    el.style.setProperty('--a', (-a) + 'rad'); el.classList.toggle('near', bd < 3.5);
  },
  pop(id) { const e = $(id); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); },
  showScore(on) { this.scoreOn = on; $('board').classList.toggle('hidden', !on); if (on && this.game.sim) { this.boardT = 0; this.ui.renderScore($('board'), this.game.sim, this.game.mp); } },
  // ---------- الإشعارات ----------
  feed(k, v, w, hs, wall, mine) {
    const el = $('feed'), row = document.createElement('div');
    const wn = w === 'fall' ? 'سقوط' : w === 'gas' ? 'قنينة غاز' : w === 'frag' ? 'رمّانة' : w === 'molotov' ? 'نار' : WEAPONS[w] ? WEAPONS[w].name : '';
    const kt = k ? `<b class="t${k.team}">${esc(k.name)}</b>` : '';
    row.className = 'kf' + (mine ? ' mine' : '');
    row.innerHTML = `${kt}<span class="w">${esc(wn)}${hs ? ' <i class="hs">◎</i>' : ''}${wall ? ' <i>⟂</i>' : ''}</span><b class="t${v.team}">${esc(v.name)}</b>`;
    el.prepend(row); while (el.children.length > 5) el.lastChild.remove();
    setTimeout(() => row.classList.add('out'), 5200); setTimeout(() => row.remove(), 5800);
  },
  banner(t, sub = '', cls = '', dur = 2.5) {
    const b = $('banner'); b.className = 'on ' + cls; b.querySelector('b').textContent = t; b.querySelector('small').textContent = sub;
    clearTimeout(this.bT); this.bT = setTimeout(() => b.className = '', dur * 1000);
  },
  toast(t, dur = 1.8) { const e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(this.tT); this.tT = setTimeout(() => e.classList.remove('on'), dur * 1000); },
  streak(n, hs) {
    const names = { 2: 'إسقاط مزدوج', 3: 'ثلاثي!', 4: 'رباعي!!', 5: 'لا يُوقَف', 7: 'أسطورة السوق' };
    const e = $('streak'); const txt = names[n] || (n > 7 ? 'أسطورة السوق ×' + n : hs ? 'طلقة رأس' : '');
    if (!txt) return; e.textContent = txt; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
  },
  hitMarker(hs, kill) { const h = $('hitm'); h.className = 'on' + (hs ? ' hs' : '') + (kill ? ' kill' : ''); clearTimeout(this.hT); this.hT = setTimeout(() => h.className = '', kill ? 380 : 200); },
  damageDir(a) {
    const el = $('dmgdirs'), d = document.createElement('i');
    d.style.transform = `rotate(${a}rad)`; el.appendChild(d); setTimeout(() => d.remove(), 1100);
  },
  spec(text) { const e = $('spec'); e.textContent = text || ''; e.classList.toggle('on', !!text); },
  fps(s) { const e = $('fps'); if (e) { e.textContent = s; e.style.display = Settings.showFps ? '' : 'none'; document.body.classList.toggle('showfps', !!Settings.showFps); } },
  respawnBy(name) { $('rsBy').textContent = name ? 'أسقطك ' + name : ''; },
};
