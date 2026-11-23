// الواجهة: الشاشة الرئيسية المبنية على أوضاع اللعب، الأصدقاء والفريق، الشخصيات، العتاد، الإعدادات، الإيقاف، النتائج، الخريطة
import { Settings, setSetting, RES_OPTIONS, FPS_OPTIONS, QUALITY, WEATHER_OPTIONS } from '../core/settings.js';
import { WEAPONS, SCOPES, NADES, MODES, MODE_ORDER, SECONDARIES, ATTACH, CLASS_NAME, validLoadout, withAtt } from '../sim/weapons.js';
import { CHARS, CHAR_ORDER } from '../game/chardefs.js';
import { TEAMS, teamName } from '../sim/sim.js';
import { Economy, WPRICE, AMMO, AMMO_ORDER, ITEMS, FREE_MEDS, ammoOf, fmtIQD } from '../game/economy.js';
import { Audio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { HUD, HUD_HTML } from './hud.js';
import { Lan } from '../net/lan.js';
import { Social, fmtId, validId } from '../net/social.js';
import { Central } from '../net/central.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LKEY = 'rafidain.loadout.v2';
const ICON = {
  tdm: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 12l28 28M40 40l-5 8 13-13-8 5M52 12L24 40M24 40l5 8-13-13 8 5"/><path d="M8 8l6 2-4 4zM56 8l-6 2 4 4z" fill="currentColor"/></svg>',
  rounds: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M32 6l20 7v15c0 13-9 24-20 29C21 52 12 41 12 28V13z"/><path d="M24 31l6 6 11-13" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sniper: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="3" fill="currentColor"/><path d="M32 4v14M32 46v14M4 32h14M46 32h14"/></svg>',
  pistol: '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M8 20h40l4-4h4v10h-6l-2 4H30l-3 3h-6l-3 13H8l5-17H8z"/><path d="M27 33h6l-2 6h-6z" opacity=".6"/></svg>',
  friends: '<svg viewBox="0 0 48 48" fill="currentColor"><circle cx="17" cy="16" r="7"/><path d="M4 38c1-8 6-12 13-12s12 4 13 12z"/><circle cx="34" cy="18" r="5.5" opacity=".75"/><path d="M30 27c6-1 13 2 14 10H33c-.5-4-1.6-7-3-10z" opacity=".75"/></svg>',
  char: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 4c-7 0-12 5-12 12v4c0 7 5 13 12 13s12-6 12-13v-4c0-7-5-12-12-12zm-7 16c3-1 5-4 7-7 2 3 4 6 7 7v1c0 5-3 9-7 9s-7-4-7-9z"/><path d="M8 46c1-7 7-11 16-11s15 4 16 11z"/></svg>',
  shop: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M6 8h6l5 22h20l5-15H15l-1-4h32l-7 23H14L8 12H6z"/><circle cx="19" cy="39" r="3.5"/><circle cx="35" cy="39" r="3.5"/></svg>',
  gun: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M4 18h30l3-3h3v3h4v6h-6l-2 3H22l-2 3h-5l-2 9H6l3-12H4z"/></svg>',
  gear: '<svg viewBox="0 0 48 48" fill="currentColor"><path d="M20 4h8l1 6 4 2 5-4 6 6-4 5 2 4 6 1v8l-6 1-2 4 4 5-6 6-5-4-4 2-1 6h-8l-1-6-4-2-5 4-6-6 4-5-2-4-6-1v-8l6-1 2-4-4-5 6-6 5 4 4-2zm4 13a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};

const TEMPLATE = HUD_HTML + `
<section class="scr" id="s-home">
  <div class="home">
    <div class="hleft">
      <div class="logo"><h1>جبهة الرافدين</h1><small>معركة سوق المجاهدين</small></div>
      <div class="pcard">
        <div class="av" id="pcAv"></div>
        <div class="pinfo"><input id="nameIn" maxlength="16" spellcheck="false" autocomplete="off"><div class="pid" id="pcId"></div></div>
      </div>
      <nav class="hnav">
        <button data-go="friends">${ICON.friends}<span>الأصدقاء</span><i class="badge" id="frBadge"></i></button>
        <button data-go="chars">${ICON.char}<span>الشخصية</span></button>
        <button data-go="shop">${ICON.shop}<span>المتجر</span></button>
        <button data-go="loadout">${ICON.gun}<span>العتاد</span></button>
      </nav>
    </div>
    <div class="hright">
      <div class="modes" id="modes"></div>
      <div class="mdesc" id="mdesc"></div>
      <div class="mopts" id="mopts"></div>
      <div class="hbot"><div class="party" id="party"></div><button class="btn big lobbyBtn" id="btnLobby" title="لوبي خاص: تجوّل بالسوق ومهام">${ICON.shop}<span>السوق والمهام</span></button><button class="btn big onlineBtn" id="btnOnline" title="أصدقاؤك المتصلون الآن — ادعهم للعب"><span class="odot"></span><span>الأصدقاء</span></button><button class="btn primary big" id="btnStart">ابدأ المعركة</button></div>
    </div>
  </div>
</section>

<section class="scr" id="s-friends">
  <div class="panel wide"><div class="head"><h2>الأصدقاء</h2><button class="x" data-back>✕</button></div>
    <div class="myid"><div><small>معرّفك — أعطه لأصدقائك</small><b id="frMyId"></b></div><button class="btn sm" id="frCopy">${ICON.copy} نسخ</button><button class="btn sm" id="frShare">مشاركة</button></div>
    <div class="addf"><input id="frIn" inputmode="numeric" maxlength="14" placeholder="اكتب معرّف صديقك (10 أرقام)" dir="ltr" autocomplete="off"><button class="btn primary" id="frAdd">${ICON.plus} إرسال طلب صداقة</button></div>
    <div id="frMsg" class="status"></div>
    <div class="tabs" id="frTabs"><button data-t="list" class="on">أصدقائي</button><button data-t="req">الطلبات <i class="badge" id="frReqN"></i></button></div>
    <div id="frBody" class="flist"></div>
    <p class="note" id="frNet"></p>
    <div class="lanbox"><h5>🛜 على نفس الشبكة — بلا إنترنت</h5><div id="lanList" class="flist"></div><div class="menu row"><button class="btn primary sm" id="lanHost">استضف معركة على الشبكة</button></div><small id="lanNote" class="note"></small></div>
    <details class="srvjoin"><summary>سيرفر خاص (تطبيق «سيرفر الرافدين» على هاتف آخر)</summary><div class="addf"><input id="srvCode" maxlength="8" placeholder="رمز الغرفة" dir="ltr" autocomplete="off" style="text-transform:uppercase"><button class="btn" id="srvGo">دخول</button></div></details>
  </div>
</section>

<section class="scr" id="s-chars">
  <div class="panel side"><div class="head"><h2>اختر شخصيتك</h2><button class="x" data-back>✕</button></div>
    <div class="charList" id="charList"></div><div id="charInfo" class="charInfo"></div></div>
</section>

<section class="scr" id="s-loadout">
  <div class="panel side lo"><div class="head"><h2>العتاد</h2><span class="wallet" id="wallet"></span><span class="mtag" id="loMode"></span><button class="x" data-back>✕</button></div>
    <div class="lobody">
      <div class="locol">
        <h5>السلاح الرئيسي</h5><div class="wgrid" id="loPrim"></div>
        <h5>المسدس</h5><div class="wgrid sm" id="loSec"></div>
      </div>
      <div class="locol">
        <div id="loStats"></div>
        <h5>المنظار</h5><div class="chips" id="loScope"></div>
        <div id="loAtt"></div>
        <h5>القنابل (اثنتان)</h5><div class="chips" id="loNade0"></div><div class="chips" id="loNade1"></div>
      </div>
    </div></div>
  <div class="stage" id="loStage"><small>☝ اسحب لتدوير السلاح</small></div>
</section>

<section class="scr" id="s-shop">
  <div class="panel side shop"><div class="head"><h2>المتجر</h2><span class="wallet" id="shopMoney"></span><button class="x" data-back>✕</button></div>
    <div class="tabs" id="shopTabs"><button data-t="wpn" class="on">الأسلحة</button><button data-t="ammo">العتاد</button><button data-t="nade">القنابل</button><button data-t="med">الصحة</button><button data-t="gear">المعدّات</button></div>
    <div id="shopBody" class="shopgrid"></div></div>
  <div class="stage" id="shopStage"><b id="shopPvName"></b><small>☝ اسحب للتدوير · اضغط أي غرض لمعاينته</small></div>
</section>

<section class="scr" id="s-settings">
  <div class="panel wide"><div class="head"><h2>الإعدادات</h2><button class="x" data-back>✕</button></div>
    <div class="tabs" id="setTabs"><button data-t="aim" class="on">التحكم والتصويب</button><button data-t="gfx">الرسوم والأداء</button><button data-t="snd">الصوت</button></div>
    <div id="setBody" class="setbody"></div></div>
</section>

<section class="scr" id="s-pause">
  <div class="panel narrow"><div class="head"><h2>استراحة</h2></div>
    <div class="menu col">
      <button class="btn primary" id="pResume">متابعة القتال</button>
      <button class="btn" id="pLoadout">تغيير العتاد</button>
      <button class="btn" id="pSettings">الإعدادات</button>
      <button class="btn danger" id="pQuit">مغادرة المعركة</button>
    </div></div>
</section>

<section class="scr" id="s-end">
  <div class="panel wide end"><div class="endhead" id="endHead"></div><div id="endBody"></div>
    <div class="menu row"><button class="btn primary" id="eAgain">معركة جديدة</button><button class="btn" id="eMenu">الشاشة الرئيسية</button></div></div>
</section>

<section class="scr" id="s-map">
  <div class="mapwrap"><canvas id="bigmap"></canvas><button class="x big" id="mapClose">✕</button><button class="x big zoom" id="mapZoom">＋</button><div class="maplegend"><i class="me"></i>أنت <i class="mate"></i>فريقك <i class="foe"></i>عدو مكشوف <i class="wpm"></i>علامتك — اضغط على الخريطة للتأشير</div><div id="mapPop"></div></div>
</section>

<div id="invite"></div>
<div id="toast2"></div>
`;

export const UI = {
  game: null, screen: null, stack: [],
  loadout: (() => { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (e) { return {}; } })(),
  init(game) {
    this.game = game;
    const ui = $('#ui');
    ui.innerHTML = TEMPLATE;
    HUD.init(game, this);
    ui.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Audio.init(); Audio.play('ui'); this.open(b.dataset.go); }));
    ui.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { Audio.play('uiBack'); this.back(); }));
    $('#btnStart').addEventListener('click', () => { Audio.init(); Audio.play('ui'); this.start(); });
    $('#btnOnline').addEventListener('click', () => { Audio.init(); Audio.play('ui'); this.open('friends'); });
    // عدد الأصدقاء المتصلين الآن
    const fr = () => { const b = $('#btnOnline'); if (!b) return; const n = Social.friends.filter(f => f.status === 'on' || f.status === 'game').length; b.querySelector('.odot').className = 'odot' + (n ? ' on' : ''); b.querySelector('span:last-child').textContent = n ? `${n} صديق أونلاين` : 'الأصدقاء'; };
    setInterval(fr, 3000); Social.on(ev => { if (ev === 'friends') fr(); });
    $('#btnLobby').addEventListener('click', () => { Audio.init(); Audio.play('ui'); this.startLobby(); });
    $('#pResume').addEventListener('click', () => this.game.resume());
    $('#pLoadout').addEventListener('click', () => this.open('loadout'));
    $('#pSettings').addEventListener('click', () => this.open('settings'));
    $('#pQuit').addEventListener('click', () => { this.game.quit(); this.showMenu(); });
    $('#eAgain').addEventListener('click', () => { Audio.play('ui'); if (this.game.sim && this.game.sim.online) { this.closeScreens(); this.hud(true); this.toast('المعركة التالية تبدأ بعد لحظات'); return; } this.start(); });
    $('#eMenu').addEventListener('click', () => { this.game.quit(); this.showMenu(); });
    $('#mapClose').addEventListener('click', () => this.closeMap());
    $('#mapZoom').addEventListener('click', () => { const mv = this.game.mapView; mv.zoom = (mv.zoom || 1) > 1 ? 1 : 2.4; mv.follow = true; $('#mapZoom').textContent = mv.zoom > 1 ? '－' : '＋'; });
    // الخريطة الكبيرة: سحب بإصبع، تكبير بإصبعين (قرص)، نقرتان للتكبير، وعجلة الفأرة
    {
      const cv = $('#bigmap'), pts = new Map(); let pinch = null, lastTap = 0;
      const mv = () => this.game.mapView, k = () => cv.width / Math.max(1, cv.clientWidth);
      const setZoom = (z, fx, fy) => { const M = mv(), V = M.view; if (!V) return; const nz = Math.max(1, Math.min(4.5, z)); const mx = (fx - V.ox) / V.s, my = (fy - V.oy) / V.s; if (nz > 1.001) { const s2 = V.s / (M.zs || 1) * nz; M.cx = mx + (V.W / 2 - fx) / s2; M.cy = my + (V.H / 2 - fy) / s2; M.follow = false; } else M.follow = true; M.zoom = nz; M.zs = nz; $('#mapZoom').textContent = nz > 1 ? '－' : '＋'; };
      let downAt = null, popT = 0;
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); clearTimeout(popT); this.mapPop(null); downAt = pts.size === 0 ? { x: e.clientX, y: e.clientY, t: performance.now(), dbl: performance.now() - lastTap < 280 } : null; pts.set(e.pointerId, [e.clientX * k(), e.clientY * k()]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: mv().zoom || 1 }; } const now = performance.now(); if (pts.size === 1 && now - lastTap < 280) { const p = pts.get(e.pointerId); setZoom((mv().zoom || 1) > 1.4 ? 1 : 2.6, p[0], p[1]); } lastTap = now; });
      cv.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return; const p0 = pts.get(e.pointerId), p = [e.clientX * k(), e.clientY * k()]; pts.set(e.pointerId, p);
        const M = mv(), V = M.view; if (!V) return;
        if (pts.size >= 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); setZoom(pinch.z * d / Math.max(10, pinch.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
        else if (pts.size === 1 && (M.zoom || 1) > 1.001) { if (M.follow !== false) { M.cx = (V.W / 2 - V.ox) / V.s; M.cy = (V.H / 2 - V.oy) / V.s; M.follow = false; } M.cx -= (p[0] - p0[0]) / V.s; M.cy -= (p[1] - p0[1]) / V.s; M.cx = Math.max(0, Math.min(M.SW, M.cx)); M.cy = Math.max(0, Math.min(M.SD, M.cy)); }
      });
      const up = e => {
        pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
        // نقرة وحدة بلا سحب: نافذة التأشير (مسار / نقطة / شيل)
        if (e.type === 'pointerup' && downAt && !downAt.dbl && pts.size === 0 && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 9 && performance.now() - downAt.t < 450) {
          const cx = e.clientX, cy = e.clientY; popT = setTimeout(() => this.mapPop([cx, cy]), 290);
        }
        downAt = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', e => { e.preventDefault(); setZoom((mv().zoom || 1) * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX * k(), e.clientY * k()); }, { passive: false });
    }
    $('#nameIn').value = Settings.name;
    $('#nameIn').addEventListener('change', e => { setSetting('name', e.target.value.trim().slice(0, 16) || 'لاعب'); e.target.value = Settings.name; Social.emit && Social.emit('profile'); });
    // الأصدقاء
    $('#frAdd').addEventListener('click', () => this.addFriend());
    $('#frIn').addEventListener('keydown', e => { if (e.key === 'Enter') this.addFriend(); });
    $('#frIn').addEventListener('input', e => { const d = e.target.value.replace(/\D/g, '').slice(0, 10); e.target.value = d.replace(/(\d{4})(\d{0,4})(\d{0,2})/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' ')); });
    $('#frCopy').addEventListener('click', () => this.copy(Social.id));
    $('#lanHost').addEventListener('click', async () => {
      Audio.play('ui'); this.frMsg('نشغّل سيرفر على هاتفك…');
      try { await this.game.hostLan(this.matchOpts()); this.closeScreens(); this.hud(true); this.toast2('السيرفر شغّال على الشبكة — أصدقاؤك يدخلون من «الأصدقاء» ← نفس الشبكة'); }
      catch (e) { this.frMsg(e.message || 'تعذّر تشغيل السيرفر', 'bad'); }
    });
    $('#srvGo').addEventListener('click', async () => {
      const code = $('#srvCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length < 4) { this.frMsg('اكتب رمز الغرفة كما يظهر في تطبيق السيرفر', 'bad'); return; }
      this.frMsg('جارٍ الاتصال بالسيرفر…');
      try { const ns = await this.game.joinOnline({ room: code, name: Settings.name, char: Settings.char, loadout: this.matchLoadout(Settings.mode), team: Settings.team || 0, onStatus: t => this.frMsg(t) }); this.closeScreens(); this.hud(true); this.game.startOnline(ns); }
      catch (e) { this.frMsg(e.message || 'تعذّر الاتصال', 'bad'); }
    });
    $('#frShare').addEventListener('click', () => this.shareId());
    $('#frTabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; this.frTab = b.dataset.t; this.buildFriends(); });
    $('#shopTabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; Audio.play('ui'); this.shopTab = b.dataset.t; this.buildShop(); });
    $('#setTabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; this.setTab = b.dataset.t; this.buildSettings(); });
    Social.on((ev, d) => this.onSocial(ev, d));
    this.buildHome(); this.buildChars();
    this.showMenu();
  },
  // ---------- التنقل ----------
  hideAll() { document.querySelectorAll('.scr').forEach(s => s.classList.remove('on')); },
  open(id) {
    if (this.screen && this.screen !== id) this.stack.push(this.screen);
    this.hideAll(); const el = $('#s-' + id); if (el) el.classList.add('on'); this.screen = id;
    if (this.game.sim) Input.reset();
    if (id === 'loadout') { this.buildLoadout(); this.buildWallet(); }
    if (id === 'shop') this.buildShop();
    if (id === 'chars') { this.game.menuView('chars', Settings.char); this.buildChars(); }
    if (id === 'home') { this.game.menuView('menu'); this.buildHome(); }
    if (id === 'settings') this.buildSettings();
    if (id === 'friends') { this.buildFriends(); this.lanWatch(); }
    if (id !== 'loadout') this.game.menuWeaponId = null;
  },
  back() {
    const prev = this.stack.pop();
    if (this.screen === 'map') { this.closeMap(); return; }
    if (this.game.sim && !this.game.sim.matchOver && (!prev || prev === 'pause')) { this.hideAll(); this.screen = null; if (this.game.paused) this.open('pause'); else this.game.resume(); return; }
    if (prev) { this.hideAll(); $('#s-' + prev).classList.add('on'); this.screen = prev; if (prev === 'home') { this.game.menuView('menu'); this.buildHome(); } if (prev === 'chars') this.game.menuView('chars', Settings.char); this.game.menuWeaponId = null; }
    else this.showMenu();
  },
  showMenu() { this.stack = []; this.hideAll(); $('#s-home').classList.add('on'); this.screen = 'home'; this.hud(false); this.game.menuView('menu'); this.buildHome(); },
  closeScreens() { this.hideAll(); this.screen = null; this.stack = []; this.game.menuWeaponId = null; },
  hud(on) { HUD.show(on); },
  // نافذة التأشير على الخريطة الكبيرة
  mapPop(at) {
    const el = $('#mapPop'); if (!el) return;
    if (!at) { el.classList.remove('on'); return; }
    const g = this.game, M = g.mapView, V = M.view, cv = $('#bigmap'); if (!V || !g.wps) return;
    const r = cv.getBoundingClientRect(), k = cv.width / Math.max(1, cv.clientWidth), fx = (at[0] - r.left) * k, fy = (at[1] - r.top) * k;
    const wx = (fx - V.ox) / V.s / M.k + M.ox, wz = (fy - V.oy) / V.s / M.k + M.oz;
    if (wx < M.B[0] || wx > M.B[3] || wz < M.B[2] || wz > M.B[5]) return;
    const mine = g.wps.mine;
    el.innerHTML = `<button data-a="route">📍 مسار</button><button data-a="point">📌 نقطة</button>${mine ? '<button data-a="del">✖ شيل علامتي</button>' : ''}`;
    el.style.left = Math.min(innerWidth - 170, Math.max(8, at[0] - 80 - r.left + r.left)) + 'px'; el.style.top = Math.min(innerHeight - 140, Math.max(8, at[1] + 12)) + 'px';
    el.classList.add('on');
    el.querySelectorAll('button').forEach(b => b.onclick = ev => { ev.stopPropagation(); Audio.play('ui'); const a = b.dataset.a; if (a === 'del') g.wps.clearMine(); else g.wps.setMine(wx, wz, a === 'route'); el.classList.remove('on'); });
  },
  openMap() { if (!this.game.sim) return; this.mapOpen = true; this.hideAll(); clearTimeout(this.mapCloseT); const el = $('#s-map'); el.classList.remove('closing'); el.classList.add('on'); this.screen = 'map'; Input.reset(); },
  closeMap() { this.mapOpen = false; const el = $('#s-map'); el.classList.add('closing'); clearTimeout(this.mapCloseT); this.mapCloseT = setTimeout(() => { el.classList.remove('on', 'closing'); }, 170); this.screen = null; this.stack = []; },
  // ---------- الرئيسية: أوضاع اللعب ----------
  buildHome() {
    const S = Settings;
    this.buildWallet();
    $('#pcId').innerHTML = `المعرّف: <b dir="ltr">${fmtId(Social.id)}</b>`;
    $('#pcAv').textContent = (CHARS[S.char] || CHARS.khaled).name[0];
    $('#pcAv').className = 'av c-' + S.char;
    $('#modes').innerHTML = MODE_ORDER.map(k => { const m = MODES[k]; return `<button class="mode m-${k} ${S.mode === k ? 'sel' : ''}" data-m="${k}"><i>${ICON[m.icon]}</i><b>${m.name}</b><small>${m.sub}</small></button>`; }).join('') + `<button class="setbtn" id="homeSet" title="الإعدادات">${ICON.gear}</button>`;
    $('#homeSet').onclick = () => { Audio.init(); Audio.play('ui'); this.open('settings'); };
    $('#modes').querySelectorAll('.mode[data-m]').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); setSetting('mode', b.dataset.m); this.buildHome(); }));
    const M = MODES[S.mode] || MODES.tdm;
    $('#mdesc').textContent = M.desc;
    // خيارات مضغوطة: كل خيار بسهمين للتبديل
    const opts = [['teamSize', 'الفريق', [[1, '1 ضد 1'], [2, '2 ضد 2'], [3, '3 ضد 3'], [4, '4 ضد 4'], [5, '5 ضد 5']]]];
    if (M.rules !== 'rounds') opts.push(['tdmTime', 'مدة القيم', [[180, '3 دقائق'], [300, '5 دقائق'], [600, '10 دقائق'], [900, '15 دقيقة'], [1200, '20 دقيقة']]]);
    else { opts.push(['rounds', 'الفوز بـ', [[3, '3 جولات'], [5, '5 جولات'], [7, '7 جولات']]]); opts.push(['roundTime', 'وقت الجولة', [[60, 'دقيقة'], [90, 'دقيقة ونص'], [120, 'دقيقتين'], [180, '3 دقائق']]]); }
    opts.push(['difficulty', 'البوتات', [['easy', 'سهلة'], ['normal', 'عادية'], ['hard', 'شرسة']]]);
    opts.push(['weather', 'الطقس', WEATHER_OPTIONS.map(o => [o.id, o.label])]);
    $('#mopts').innerHTML = opts.map(([k, l, items]) => { const i = Math.max(0, items.findIndex(x => String(x[0]) === String(S[k]))); return `<div class="stp" data-k="${k}"><label>${l}</label><div><button data-d="1">‹</button><b>${items[i][1]}</b><button data-d="-1">›</button></div></div>`; }).join('');
    $('#mopts').querySelectorAll('.stp').forEach(el => el.addEventListener('click', e => {
      const b = e.target.closest('button'); const k = el.dataset.k, items = opts.find(o => o[0] === k)[2];
      const i = Math.max(0, items.findIndex(x => String(x[0]) === String(S[k]))), d = b ? +b.dataset.d : 1;
      Audio.play('ui'); setSetting(k, items[(i + d + items.length) % items.length][0]); this.buildHome();
    }));
    this.buildParty();
    this.updateBadges();
  },
  buildParty() {
    const P = Social.party, el = $('#party');
    const me = { id: Social.id, name: Settings.name, char: Settings.char };
    const mem = P ? P.members : [me];
    let h = mem.map(m => `<div class="pm ${m.id === Social.id ? 'me' : ''}"><i class="av c-${esc(m.char)}">${esc((CHARS[m.char] || CHARS.khaled).name[0])}</i><span>${esc(m.name)}</span>${P && m.id === P.host ? '<em>المضيف</em>' : ''}</div>`).join('');
    if (!P || P.host === Social.id) h += `<button class="pm add" id="pInvite">${ICON.plus}<span>ادعُ صديقاً</span></button>`;
    if (P && P.members.length > 1) h += `<button class="pm vs" id="pVs" ${P.host === Social.id ? '' : 'disabled'}>${P.vs ? '⚔' : '🤝'}<span>${P.vs ? 'أصدقائي ضدّي' : 'أصدقائي ويّاي'}</span></button>`;
    if (P) h += `<button class="pm leave" id="pLeave">✕<span>${P.host === Social.id ? 'حلّ الفرقة' : 'مغادرة'}</span></button>`;
    el.innerHTML = h;
    const inv = $('#pInvite'); if (inv) inv.addEventListener('click', () => { Audio.play('ui'); this.frTab = 'list'; this.open('friends'); });
    const lv = $('#pLeave'); if (lv) lv.addEventListener('click', () => { Social.leaveParty && Social.leaveParty(); this.buildHome(); });
    const vs = $('#pVs'); if (vs) vs.addEventListener('click', () => { Audio.play('ui'); Social.setPartyVs(!Social.party.vs); this.buildParty(); });
    const btn = $('#btnStart');
    const guest = P && P.host !== Social.id;
    btn.disabled = !!guest; btn.textContent = guest ? 'بانتظار المضيف…' : P && P.members.length > 1 ? 'ابدأ مع الفريق' : 'ابدأ المعركة';
  },
  updateBadges() {
    const n = Social.requests.length, el = $('#frBadge'); if (el) { el.textContent = n || ''; el.classList.toggle('on', n > 0); }
    const r = $('#frReqN'); if (r) { r.textContent = n || ''; r.classList.toggle('on', n > 0); }
  },
  matchOpts() { const S = Settings, mode = S.mode; return { mode, roundsToWin: S.rounds, timeLimit: S.tdmTime, roundTime: S.roundTime || 120, difficulty: S.difficulty, size: S.teamSize, team: S.team || 0, char: S.char, name: S.name, loadout: this.matchLoadout(mode), weather: S.weather }; },
  // اللوبي الخاص: تجوّل ومهام بلا قتال
  startLobby() {
    const S = Settings;
    this.closeScreens(); this.hud(true);
    this.game.startLobby({ char: S.char, name: S.name, difficulty: S.difficulty, loadout: this.getLoadout('tdm'), weather: S.weather });
  },
  // معركة أونلاين: السيرفر المركزي ← غرفة مفتوحة ← نفتح غرفة على هاتفي
  async goOnline() {
    const b = $('#btnOnline'); if (b.disabled) return;
    const lbl = b.querySelector('span:last-child'), say = t => { lbl.textContent = t.length > 26 ? t.slice(0, 25) + '…' : t; this.toast2(t); };
    b.disabled = true;
    try { await this.game.onlineMatch(this.matchOpts(), say); this.closeScreens(); this.hud(true); }
    catch (e) { this.toast2('تعذّر دخول معركة أونلاين: ' + (e.message || e)); }
    finally { b.disabled = false; lbl.textContent = 'أونلاين'; }
  },
  async start() {
    if (Social.party && Social.party.members.length > 1) {
      if (Social.party.host !== Social.id) return;
      const b = $('#btnStart'); b.disabled = true; b.textContent = 'تجهيز السيرفر على هاتفك…';
      try { await this.game.hostParty(this.matchOpts()); this.closeScreens(); this.hud(true); }
      catch (e) { this.toast2('تعذّر بدء المعركة: ' + (e.message || e)); }
      finally { b.disabled = false; this.buildParty(); }
      return;
    }
    // «ابدأ المعركة»: إذا في لاعبين أونلاين تدخل وياهم (أو هم يدخلون وياك)، وإذا ماكو إنترنت معركة ويّا البوتات
    if (Social.online) { const b = $('#btnStart'); if (b.disabled) return; b.disabled = true; const say = t => this.toast2(t);
      try { await this.game.onlineMatch(this.matchOpts(), say); this.closeScreens(); this.hud(true); return; } catch (e) { } finally { b.disabled = false; } }
    this.closeScreens(); this.hud(true);
    this.game.startMatch(this.matchOpts());
  },
  // عضو في الفرقة: المضيف بدأ — ندخل معركته مباشرة
  async joinParty(d) {
    if (this.game.sim) return;
    this.toast2('المضيف بدأ المعركة — جارٍ الدخول…');
    try {
      const ns = await this.game.joinOnline({ room: d.room, name: Settings.name, char: Settings.char, loadout: this.matchLoadout(d.mode || Settings.mode), team: d.team || 0 });
      this.closeScreens(); this.hud(true); this.game.startOnline(ns, d.weather);
    } catch (e) { this.toast2('تعذّر الدخول: ' + (e.message || e)); }
  },
  // العتاد المختار مع التأكد من الملكية (الأسلحة المقفولة تُستبدل بالمجانية)
  getLoadout(mode) {
    const L = validLoadout(this.loadout[mode] || {}, mode);
    if (L.primary && !Economy.owns(L.primary)) { L.primary = 'rafid'; L.scope = null; L.att = {}; Object.assign(L, validLoadout(L, mode)); }
    if (!Economy.owns(L.secondary)) L.secondary = 'dijla';
    return L;
  },
  matchLoadout(mode) { return { ...this.getLoadout(mode), supply: Economy.matchSupply() }; },
  // ---------- المتجر ----------
  shopTab: 'wpn',
  buildShop() {
    const W = Economy.W, tab = this.shopTab;
    $('#shopMoney').textContent = fmtIQD(W.money);
    $('#shopTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    let h = '';
    const item = (title, sub, price, act, owned, extra = '', pv = '') => `<div class="sitem ${owned ? 'own' : 'locked'}" data-pv="${pv}"><b>${title}</b><small>${sub}</small>${extra}${owned === true ? '<span class="own">✔ مملوك</span>' : `<span class="pr">${fmtIQD(price)}</span><button class="btn sm primary" data-buy="${act}" ${Economy.can(price) ? '' : 'disabled'}>شراء</button>`}</div>`;
    if (tab === 'wpn') {
      const ids = Object.keys(WPRICE).sort((a, b) => WPRICE[a] - WPRICE[b]);
      h = ids.map(id => { const d = WEAPONS[id], t = ammoOf(id); return item(esc(d.name), `${CLASS_NAME[d.cls]} · عتاد ${AMMO[t].short}`, WPRICE[id], 'w:' + id, Economy.owns(id) || undefined, '', 'gun:' + id); }).join('');
    } else if (tab === 'ammo') {
      h = AMMO_ORDER.map(t => { const A = AMMO[t]; return `<div class="sitem" data-pv="item:ammo:${t}"><b>${A.name}</b><small>مخزونك: ${W.ammo[t] || 0} طلقة · مجاني بكل قيم: ${A.free}</small><span class="pr">${A.pack} طلقة = ${fmtIQD(A.price)}</span><div class="menu row"><button class="btn sm primary" data-buy="a:${t}:1" ${Economy.can(A.price) ? '' : 'disabled'}>+${A.pack}</button><button class="btn sm" data-buy="a:${t}:5" ${Economy.can(A.price * 5) ? '' : 'disabled'}>+${A.pack * 5}</button></div></div>`; }).join('');
    } else if (tab === 'nade' || tab === 'med') {
      h = Object.entries(ITEMS).filter(([k, I]) => I.kind === tab).map(([k, I]) => `<div class="sitem" data-pv="${tab === 'nade' ? 'nade' : 'item'}:${k}"><b>${I.name}</b><small>عندك: ${W.items[k] || 0}${tab === 'med' ? ` · مجاني بكل قيم: ${k === 'bandage' ? FREE_MEDS.b : FREE_MEDS.s}` : ''}</small><span class="pr">${fmtIQD(I.price)}</span><div class="menu row"><button class="btn sm primary" data-buy="i:${k}:1" ${Economy.can(I.price) ? '' : 'disabled'}>+1</button><button class="btn sm" data-buy="i:${k}:5" ${Economy.can(I.price * 5) ? '' : 'disabled'}>+5</button></div></div>`).join('');
    } else {
      h = Object.entries(ITEMS).filter(([k, I]) => I.kind === 'gear').map(([k, I]) => item(I.name, I.desc || '', I.price, 'i:' + k + ':1', W[k] || undefined, '', 'item:' + k)).join('');
    }
    $('#shopBody').innerHTML = h;
    // المعاينة: أول غرض بالتبويب، أو اللي تضغطه
    const pv = el => { if (!el) return; const v = el.dataset.pv; if (!v) return; const i = v.indexOf(':'), kind = v.slice(0, i), id = v.slice(i + 1); this.game.menuShow(kind, id); $('#shopBody').querySelectorAll('.sitem').forEach(x => x.classList.toggle('pv', x === el)); $('#shopPvName').textContent = el.querySelector('b').textContent; this.shopPv = v; };
    const items = [...$('#shopBody').querySelectorAll('.sitem[data-pv]')];
    pv(items.find(x => x.dataset.pv === this.shopPv) || items[0]);
    items.forEach(el => el.addEventListener('click', e => { if (e.target.closest('button')) return; Audio.play('ui'); pv(el); }));
    $('#shopBody').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const [k, a, n] = b.dataset.buy.split(':'); let ok = false;
      if (k === 'w') ok = Economy.buyWeapon(a); else if (k === 'a') ok = Economy.buyAmmo(a, +n || 1); else ok = Economy.buyItem(a, +n || 1);
      Audio.play(ok ? 'buy' : 'ui'); if (!ok) this.toast2('ما عندك فلوس كافية'); this.buildShop(); this.buildWallet();
    });
  },
  buildWallet() { const e = $('#wallet'); if (e) e.textContent = '💵 ' + fmtIQD(Economy.money); },
  showReward(r) {
    const el = $('#endReward') || (() => { const d = document.createElement('div'); d.id = 'endReward'; d.className = 'endreward'; const h = $('#endHead'); h && h.after(d); return d; })();
    el.innerHTML = r.lines.map(([l, v]) => `<div class="${v < 0 ? 'neg' : ''}"><span>${l}</span><b>${v < 0 ? '−' + fmtIQD(-v) : '+' + fmtIQD(v)}</b></div>`).join('') + `<div class="tot"><span>المكافأة</span><b>+${fmtIQD(r.total)}</b></div>`;
    this.buildWallet();
  },
  // ---------- نفس الشبكة ----------
  lanWatch() {
    clearInterval(this.lanIv);
    const draw = () => {
      if (this.screen !== 'friends') { clearInterval(this.lanIv); Lan.scan(false); return; }
      const el = $('#lanList'), note = $('#lanNote'); if (!el) return;
      if (!Lan.ok) { el.innerHTML = '<div class="empty">اللعب على الشبكة المحلية بتطبيق أندرويد فقط.</div>'; $('#lanHost').disabled = true; return; }
      Lan.scan(true); const L = Lan.found().filter(h => h.room);
      const MN = { tdm: 'قتل', dom: 'سيطرة', rounds: 'جولات' };
      el.innerHTML = L.length ? L.map(h => `<div class="fr"><i class="av">🛜</i><div class="fi"><b>${esc(h.name || 'سيرفر')}</b><small>${h.info && MN[h.info.mode] ? MN[h.info.mode] + ' · ' : ''}${h.info ? (h.info.humans || 0) + ' لاعب' : ''} · <span dir="ltr">${esc(h.ip)}</span></small></div><button class="btn sm primary" data-lan="${esc(h.room)}">دخول</button></div>`).join('') : '<div class="empty">ندوّر على ألعاب بنفس الواي فاي… (خلّي صاحبك يضغط «استضف»)</div>';
      note.textContent = 'عنوانك على الشبكة: ' + (Lan.ip() || '—') + ' · الكل لازم يكونون على نفس الواي فاي أو نقطة الاتصال';
      el.querySelectorAll('[data-lan]').forEach(b => b.onclick = async () => {
        const h = L.find(x => x.room === b.dataset.lan); this.frMsg('جارٍ الدخول على سيرفر الشبكة…');
        try { const ns = await this.game.joinOnline({ room: h.room, lanHost: h, name: Settings.name, char: Settings.char, loadout: this.matchLoadout(h.info && h.info.mode || Settings.mode), team: Settings.team || 0, onStatus: t => this.frMsg(t) }); this.closeScreens(); this.hud(true); this.game.startOnline(ns); }
        catch (e) { this.frMsg(e.message || 'تعذّر الاتصال', 'bad'); }
      });
    };
    draw(); this.lanIv = setInterval(draw, 1200);
  },
  // ---------- الأصدقاء ----------
  frTab: 'list',
  buildFriends() {
    $('#frMyId').textContent = fmtId(Social.id);
    $('#frTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === this.frTab));
    const st = f => f.status === 'game' ? '<i class="st game"></i>في معركة' : f.status === 'on' ? '<i class="st on"></i>متصل' : '<i class="st"></i>غير متصل';
    let h = '';
    if (this.frTab === 'list') {
      const sent = Social.sent.filter(id => !Social.friend(id));
      h = Social.friends.length ? Social.friends.slice().sort((a, b) => (b.status === 'on') - (a.status === 'on')).map(f => `<div class="fr"><i class="av c-${esc(f.char)}">${esc(((CHARS[f.char] || CHARS.khaled).name || '?')[0])}</i><div class="fi"><b>${esc(f.name || 'صديق')}</b><small>${st(f)} · <span dir="ltr">${fmtId(f.id)}</span></small></div><button class="btn sm primary" data-inv="${f.id}" ${f.status === 'on' ? '' : 'disabled'}>دعوة للعب</button><button class="btn sm ghost" data-rm="${f.id}">✕</button></div>`).join('') : '<div class="empty">لا أصدقاء بعد. أرسل معرّفك لصديقك أو اكتب معرّفه في الأعلى.</div>';
      if (sent.length) h += `<div class="sec">طلبات أرسلتها</div>` + sent.map(id => `<div class="fr dim"><div class="fi"><b dir="ltr">${fmtId(id)}</b><small>بانتظار القبول</small></div><button class="btn sm ghost" data-cancel="${id}">إلغاء</button></div>`).join('');
    } else {
      h = Social.requests.length ? Social.requests.map(r => `<div class="fr"><i class="av c-${esc(r.char)}">${esc(((CHARS[r.char] || CHARS.khaled).name)[0])}</i><div class="fi"><b>${esc(r.name)}</b><small dir="ltr">${fmtId(r.id)}</small></div><button class="btn sm primary" data-acc="${r.id}">قبول</button><button class="btn sm ghost" data-dec="${r.id}">رفض</button></div>`).join('') : '<div class="empty">لا طلبات جديدة.</div>';
    }
    const body = $('#frBody'); body.innerHTML = h;
    body.querySelectorAll('[data-inv]').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); Social.invite && Social.invite(b.dataset.inv); this.frMsg('أُرسلت الدعوة ✓', 'ok'); }));
    body.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { if (b.dataset.arm) { Social.removeFriend && Social.removeFriend(b.dataset.rm); this.buildFriends(); } else { b.dataset.arm = 1; b.textContent = 'تأكيد الحذف'; } }));
    body.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => { Social.cancelRequest && Social.cancelRequest(b.dataset.cancel); this.buildFriends(); }));
    body.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); Social.accept && Social.accept(b.dataset.acc); this.buildFriends(); }));
    body.querySelectorAll('[data-dec]').forEach(b => b.addEventListener('click', () => { Social.decline && Social.decline(b.dataset.dec); this.buildFriends(); }));
    $('#frNet').textContent = Social.online ? 'متصل بشبكة الأصدقاء ✓' : 'جارٍ الاتصال بشبكة الأصدقاء…';
    this.updateBadges();
  },
  frMsg(t, cls = '') { const e = $('#frMsg'); e.textContent = t; e.className = 'status ' + cls; clearTimeout(this.frT); this.frT = setTimeout(() => { e.textContent = ''; }, 3500); },
  addFriend() {
    const id = validId($('#frIn').value);
    if (!id) { this.frMsg('المعرّف غير صحيح — 10 أرقام كما يظهر عند صديقك', 'bad'); return; }
    if (id === Social.id) { this.frMsg('هذا معرّفك أنت 🙂', 'bad'); return; }
    if (Social.friend(id)) { this.frMsg('هو في قائمة أصدقائك بالفعل', 'ok'); return; }
    Social.request && Social.request(id); $('#frIn').value = '';
    this.frMsg('أُرسل طلب الصداقة ✓ سيظهر عنده فوراً', 'ok'); this.buildFriends();
  },
  copy(text) { try { if (window.RafidainAndroid && window.RafidainAndroid.copy) window.RafidainAndroid.copy(text); else navigator.clipboard.writeText(text); this.frMsg('نُسخ ✓', 'ok'); } catch (e) { } },
  shareId() {
    const t = `أضفني في «جبهة الرافدين» 🎯\nمعرّفي: ${fmtId(Social.id)}`;
    try { if (window.RafidainAndroid && window.RafidainAndroid.share) window.RafidainAndroid.share(t); else if (navigator.share) navigator.share({ text: t }); else this.copy(t); } catch (e) { }
  },
  onSocial(ev, d) {
    if (ev === 'request') { this.toast2(`${d.name} يريد إضافتك صديقاً`, () => { this.frTab = 'req'; this.open('friends'); }); Audio.play('ui'); }
    if (ev === 'accepted') this.toast2(`${d.name} قبل طلب صداقتك ✓`);
    if (ev === 'invite') this.showInvite(d);
    if (ev === 'party') { if (this.screen === 'home') this.buildParty(); }
    if (ev === 'start') { this.joinParty(d); return; }
    if (ev === 'note') this.toast2(d.text);
    if (this.screen === 'friends') this.buildFriends();
    this.updateBadges();
  },
  showInvite(inv) {
    const el = $('#invite');
    el.innerHTML = `<div class="inv"><i class="av c-${esc(inv.char)}">${esc(((CHARS[inv.char] || CHARS.khaled).name)[0])}</i><div><b>${esc(inv.name)}</b><small>يدعوك للعب معه — ${esc((MODES[inv.mode] || MODES.tdm).name)}</small></div><button class="btn primary sm" id="invAcc">قبول</button><button class="btn sm ghost" id="invDec">رفض</button></div>`;
    el.classList.add('on'); Audio.play('invite');
    const close = () => { el.classList.remove('on'); clearTimeout(this.invT); };
    $('#invAcc').onclick = () => { close(); Social.acceptInvite && Social.acceptInvite(inv); };
    $('#invDec').onclick = () => { close(); Social.declineInvite && Social.declineInvite(inv); };
    clearTimeout(this.invT); this.invT = setTimeout(close, 30000);
  },
  toast2(t, onClick) { const e = $('#toast2'); e.textContent = t; e.classList.add('on'); e.onclick = onClick ? () => { e.classList.remove('on'); onClick(); } : null; clearTimeout(this.t2); this.t2 = setTimeout(() => e.classList.remove('on'), 4500); },
  // ---------- الشخصيات ----------
  buildChars() {
    const el = $('#charList');
    el.innerHTML = CHAR_ORDER.map(id => { const c = CHARS[id]; return `<button class="char ${Settings.char === id ? 'sel' : ''}" data-id="${id}"><i class="av c-${id}">${esc(c.name[0])}</i><span><b>${esc(c.full)}</b><small>${esc(c.tag)}</small></span></button>`; }).join('');
    const c = CHARS[Settings.char] || CHARS.khaled; $('#charInfo').innerHTML = `<h3>${esc(c.full)}</h3><div class="tagline">${esc(c.tag)}</div><p>${esc(c.desc)}</p>`;
    el.querySelectorAll('.char').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); setSetting('char', b.dataset.id); this.buildChars(); this.game.menuView('chars', b.dataset.id); if (this.game.sim) this.game.setMyChar(b.dataset.id); Social.emit && Social.emit('profile'); }));
  },
  // ---------- العتاد ----------
  buildLoadout() {
    const mode = this.game.sim ? this.game.sim.mode : Settings.mode, L = this.getLoadout(mode);
    const save = () => { this.loadout[mode] = L; try { localStorage.setItem(LKEY, JSON.stringify(this.loadout)); } catch (e) { } this.game.setMyLoadout(L); this.buildLoadout(); };
    $('#loMode').textContent = MODES[mode].name + (this.game.sim && this.game.sim.tdm ? ' · يُطبّق عند عودتك للحياة' : '');
    const P = MODES[mode].primaries;
    const card = (w, sel, kind) => { const d = WEAPONS[w], t = ammoOf(w); return `<button class="wpn ${sel ? 'sel' : ''}" data-w="${w}" data-k="${kind}"><b>${esc(d.name)}</b><small>${CLASS_NAME[d.cls]} · ${Economy.W.ammo[t] || 0}+${AMMO[t].free}</small></button>`; };
    const PO = P.filter(w => Economy.owns(w));
    $('#loPrim').innerHTML = PO.length ? PO.map(w => card(w, L.primary === w, 'p')).join('') : '<div class="note">هذا الوضع بلا أسلحة رئيسية — مسدس وخنجر فقط</div>';
    $('#loSec').innerHTML = SECONDARIES.filter(w => Economy.owns(w)).map(w => card(w, L.secondary === w, 's')).join('') + `<button class="wpn" data-goshop="1"><b>🛒 المتجر</b><small>أسلحة أكثر</small></button>`;
    // النقر على سلاح يعرضه فقط، وزر «اعتماد» يجهّزه (مع منظاره وقطعه المختارة)
    const owned = w => (P.includes(w) || SECONDARIES.includes(w)) && Economy.owns(w);
    const focus = this.loFocus && owned(this.loFocus) ? this.loFocus : (L.primary || L.secondary);
    const isPrim = P.includes(focus), equipped = focus === L.primary || focus === L.secondary;
    this.loPend = this.loPend || {};
    const pend = isPrim ? (equipped ? { scope: L.scope, att: L.att } : (this.loPend[focus] = this.loPend[focus] || { scope: (WEAPONS[focus].scopes || [])[0] || null, att: {} })) : { scope: null, att: null };
    const wd = withAtt(focus, isPrim ? pend.att : null), base = WEAPONS[focus];
    const bars = [['الضرر', Math.min(1, wd.dmg * (wd.pellets || 1) / 160)], ['سرعة الإطلاق', Math.min(1, wd.rpm / 1000)], ['الدقة', Math.max(0.05, 1 - (wd.spread * 90 + wd.moveSpread * 4))], ['الثبات', Math.max(0.05, 1 - wd.recoil[0] * 22 - wd.recoil[1] * 30)], ['المدى', Math.max(0.05, (wd.range - 0.6) / 0.4)], ['الحركة', (wd.speed - 0.78) / 0.32]];
    $('#loStats').innerHTML = `<div class="wtitle"><h3>${esc(base.name)}</h3><span>${CLASS_NAME[base.cls]} · ${wd.mag || '∞'} طلقة</span></div><p>${esc(base.desc || '')}</p>` + bars.map(([l, v]) => `<div class="bar"><span>${l}</span><i style="--v:${Math.max(0.04, Math.min(1, v)).toFixed(3)}"></i></div>`).join('') + `<button class="btn ${equipped ? 'ghost' : 'primary'} equipBtn" id="loEquip" ${equipped ? 'disabled' : ''}>${equipped ? '✓ مُجهَّز معك' : (isPrim ? 'اعتماد كسلاح رئيسي' : 'اعتماد كمسدس')}</button>`;
    const sc = isPrim ? base.scopes : [];
    $('#loScope').innerHTML = isPrim && sc.length ? sc.map(s => `<button class="chip ${pend.scope === s ? 'sel' : ''}" data-s="${s}">${SCOPES[s].short}</button>`).join('') : '<div class="note">—</div>';
    const ATTN = { muzzle: 'الفوهة', grip: 'المقبض', mag: 'المخزن' };
    $('#loAtt').innerHTML = isPrim ? base.att.map(k => `<h5>${ATTN[k]}</h5><div class="chips">${Object.entries(ATTACH[k]).map(([v, a]) => `<button class="chip ${(pend.att || {})[k] === v ? 'sel' : ''}" data-a="${k}" data-v="${v}" title="${esc(a.desc || '')}">${a.name}</button>`).join('')}</div>`).join('') : '';
    for (let i = 0; i < 2; i++) $('#loNade' + i).innerHTML = Object.entries(NADES).map(([k, n]) => `<button class="chip ${L.nades[i] === k ? 'sel' : ''}" data-n="${k}" data-i="${i}">${n.name} ×${Economy.W.items[k] || 0}</button>`).join('') + `<button class="chip ${!L.nades[i] ? 'sel' : ''}" data-n="" data-i="${i}">لا شيء</button>`;
    this.game.menuWeapon(focus, isPrim ? pend.scope : null, isPrim ? pend.att : null);
    const root = $('#s-loadout');
    root.querySelectorAll('[data-goshop]').forEach(b => b.onclick = () => { Audio.play('ui'); this.shopTab = 'wpn'; this.open('shop'); });
    root.querySelectorAll('.wpn[data-w]').forEach(b => b.onclick = () => { Audio.play('ui'); this.loFocus = b.dataset.w; this.buildLoadout(); });
    const eq = $('#loEquip'); if (eq) eq.onclick = () => { Audio.play('ui'); if (isPrim) { L.primary = focus; L.scope = pend.scope; L.att = { ...(pend.att || {}) }; } else L.secondary = focus; Object.assign(L, validLoadout(L, mode)); this.toast2(`جهّزت ${base.name}` + (this.game.sim && this.game.sim.tdm ? ' — يصير بيدك أول ما ترجع للحياة' : '')); save(); };
    root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { Audio.play('ui'); pend.scope = b.dataset.s; if (equipped) { L.scope = pend.scope; save(); } else this.buildLoadout(); });
    root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { Audio.play('ui'); pend.att = { ...(pend.att || {}), [b.dataset.a]: b.dataset.v }; if (equipped) { L.att = pend.att; save(); } else this.buildLoadout(); });
    root.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { Audio.play('ui'); if (b.dataset.n) { this.game.menuShow('nade', b.dataset.n); this.loNadePv = 1; } const i = +b.dataset.i; const arr = [L.nades[0], L.nades[1]]; arr[i] = b.dataset.n || undefined; L.nades = arr.filter(Boolean); save(); });
  },
  // ---------- الإعدادات ----------
  setTab: 'aim',
  buildSettings() {
    const el = $('#setBody'); if (!el) return;
    $('#setTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === this.setTab));
    const row = (label, ctrl, sub) => `<div class="row"><div><label>${label}</label>${sub ? `<small>${sub}</small>` : ''}</div><div class="ctl">${ctrl}</div></div>`;
    const chips = (k, opts) => `<div class="chips" data-k="${k}">${opts.map(o => `<button class="chip ${String(Settings[k]) === String(o.id) ? 'sel' : ''}" data-v="${o.id}">${o.label}</button>`).join('')}</div>`;
    const sel = (k, opts) => `<select data-k="${k}">${opts.map(o => `<option value="${o.id}" ${String(Settings[k]) === String(o.id) ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
    const tog = k => `<button class="tog ${Settings[k] ? 'on' : ''}" data-t="${k}"></button>`;
    const rng = (k, a, b, s, pct) => `<input type="range" data-k="${k}" min="${a}" max="${b}" step="${s}" value="${Settings[k]}" ${pct ? 'data-pct="1"' : ''}><output>${pct ? Math.round(Settings[k] * 100) + '%' : Settings[k]}</output>`;
    let h = '';
    if (this.setTab === 'aim') h =
      row('حساسية الكاميرا', rng('sens', 0.3, 3, 0.05, 1), 'سرعة الالتفات بالسحب على الشاشة') +
      row('حساسية التصويب القريب', rng('adsSens', 0.3, 2.5, 0.05, 1), 'النقطة الحمراء والهولو و×2') +
      row('حساسية المناظير', rng('scopeSens', 0.3, 2.5, 0.05, 1), '×3 وما فوق — تُقسَّم تلقائياً على قوة التكبير') +
      row('المنظور', chips('view', [{ id: 'tpp', label: 'الشخص الثالث' }, { id: 'fpp', label: 'الشخص الأول' }]), 'الثالث: الكاميرا ورا كتفك مثل ببجي، والتصويب بالمنظار يحوّل للأول') +
      row('زر التصويب', chips('adsMode', [{ id: 'mixed', label: 'مختلط' }, { id: 'tap', label: 'نقرة' }, { id: 'hold', label: 'ضغط مستمر' }]), 'المختلط: نقرة تثبّت، وضغطة طويلة تصوّب ما دام إصبعك موضوعاً') +
      row('مساعدة التصويب', tog('aimAssist'), 'إبطاء خفيف عند مرور المؤشر على العدو (للمس فقط)') +
      row('زر إطلاق يساري', tog('leftFire')) +
      row('الجيروسكوب', chips('gyro', [{ id: 'off', label: 'مغلق' }, { id: 'scope', label: 'عند التصويب' }, { id: 'always', label: 'دائماً' }])) +
      row('حساسية الجيروسكوب', rng('gyroSens', 0.3, 3, 0.05, 1)) +
      row('عكس الجيروسكوب الأفقي', tog('gyroInvX'), 'إذا لفّت الكاميرا عكس يدك') + row('عكس الجيروسكوب العمودي', tog('gyroInvY')) +
      row('عكس المحور العمودي', tog('invertY')) +
      row('حجم أزرار اللمس', rng('touchSize', 0.8, 1.35, 0.05, 1)) + row('شفافية الواجهة', rng('hudAlpha', 0.4, 1, 0.05, 1)) +
      row('لون مؤشر التصويب', chips('crossColor', [{ id: '#5dffb0', label: 'نعناعي' }, { id: '#ffffff', label: 'أبيض' }, { id: '#ffe14a', label: 'أصفر' }, { id: '#ff4a6a', label: 'أحمر' }, { id: '#4ad8ff', label: 'سماوي' }])) +
      row('الاهتزاز', tog('haptics'));
    else if (this.setTab === 'gfx') h =
      row('الجودة', chips('quality', [{ id: 'auto', label: 'تلقائية' }].concat(Object.entries(QUALITY).map(([k, q]) => ({ id: k, label: q.label })))), 'الظلال والتوهج والمطر والانعكاسات. تُطبّق بعد إعادة التشغيل.') +
      row('الدقة', sel('res', RES_OPTIONS), 'الأعلى أجمل والأقل أسرع') +
      row('حدّ الفريمات', chips('fps', FPS_OPTIONS)) +
      row('عرض الفريمات أعلى اليسار', tog('showFps')) +
      row('حزمة الرسوميات المتقدّمة (NEXT-GEN FX)', tog('fx'), 'انعكاسات واقعية على الأرض (مرايا بالمطر)، ظلال التلاصق، أشعة الشمس بين الأبنية، تدرّج سينمائي. ⚠️ ثقيلة — تثقّل الهواتف المتوسطة والضعيفة') +
      (Settings.fx ? row('· الانعكاسات', tog('fxSSR')) + row('· ظلال التلاصق', tog('fxAO')) + row('· أشعة الشمس', tog('fxRays')) + row('· التدرّج السينمائي', tog('fxGrade')) : '') +
      row('مجال الرؤية', rng('fov', 70, 110, 1)) +
      row('الطقس الافتراضي', chips('weather', WEATHER_OPTIONS.map(o => ({ id: o.id, label: o.label }))));
    else h = row('الصوت العام', rng('volume', 0, 1, 0.05, 1)) + row('الموسيقى التراثية', rng('music', 0, 1, 0.05, 1)) + row('أصوات أهل السوق', rng('talk', 0, 1, 0.05, 1), 'يرحّبون بك ويتسولفون بالبغدادي حين تقترب — صفر لإسكاتهم')
      + `<div class="note credits">الموسيقى التراثية مؤلّفة آلياً داخل اللعبة (مقامات بيات وحجاز بالعود والناي والإيقاع). نماذج «فانوس الشارع الخشبي» و«السمكة» من مستودع Khronos glTF-Sample-Assets برخصة CC0 (الملك العام). أصوات أهل السوق والمقدّمة بصوت عراقي عصبي (Azure ar-IQ)، ومحاضرات الشيخ ونداءات الإمام بصوت فصيح (Azure ar-SA).${window.__ADHAN ? ` تسجيل الأذان: ${esc(window.__ADHAN.title.replace(/^File:/, ''))} — ${esc(window.__ADHAN.artist || '')} · ${esc(window.__ADHAN.license || '')} (ويكيميديا كومنز).` : ''}</div>`
      + `<div style="margin-top:10px"><button class="btn" onclick="window.__R && window.__R.playIntro()">🎬 شاهد المقدّمة من جديد</button></div>`;
    el.innerHTML = h;
    el.querySelectorAll('.chips').forEach(c => c.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; const v = b.dataset.v; setSetting(c.dataset.k, isNaN(+v) || v === '' ? v : +v); this.buildSettings(); HUD.layout(); }));
    el.querySelectorAll('select').forEach(s => s.addEventListener('change', () => { const v = s.value; setSetting(s.dataset.k, isNaN(+v) ? v : +v); }));
    el.querySelectorAll('.tog').forEach(b => b.addEventListener('click', () => { setSetting(b.dataset.t, !Settings[b.dataset.t]); b.classList.toggle('on', Settings[b.dataset.t]); HUD.layout(); if (b.dataset.t === 'fx') this.buildSettings(); }));
    el.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => { setSetting(r.dataset.k, +r.value); r.nextElementSibling.textContent = r.dataset.pct ? Math.round(+r.value * 100) + '%' : r.value; if (r.dataset.k === 'volume') Audio.setVolume(+r.value); HUD.layout(); }));
  },
  // ---------- اللوحة والنهاية ----------
  renderScore(el, sim, me) {
    const rows = t => [...sim.players.values()].filter(p => p.team === t).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).map(p => {
      const ping = sim.online && !p.bot && sim.roster && sim.roster.get(p.id) && sim.roster.get(p.id).rtt ? `<i>${sim.roster.get(p.id).rtt}ms</i>` : '';
      return `<tr class="${p.alive ? '' : 'dead'} ${me && p.id === me.id ? 'me' : ''}"><td><b>${esc(p.name)}</b>${p.bot ? ' <i>بوت</i>' : ''} ${ping}</td><td>${p.kills}</td><td>${p.assists}</td><td>${p.deaths}</td><td>${Math.round(p.dmgDone)}</td></tr>`;
    }).join('');
    const tdm = sim.rules ? sim.rules !== 'rounds' : sim.tdm, dom = sim.rules === 'dom';
    el.innerHTML = `<div class="bh">${dom ? 'النقاط = ثواني السيطرة على النقاط' : tdm ? 'النقاط = عدد إسقاط الأعداء · الأكثر يفوز' : 'الجولات'}</div>` + [0, 1].map(t => `<div class="team t${t}"><h4>${teamName(t, me ? me.team : -1)} <b>${sim.score[t]}</b></h4><table><tr><th>اللاعب</th><th>إسقاط</th><th>مساعدة</th><th>سقوط</th><th>ضرر</th></tr>${rows(t)}</table></div>`).join('');
  },
  endScreen(sim, me) {
    this.hud(false); Input.reset();
    const w = sim.winner ?? (sim.score[0] === sim.score[1] ? -1 : sim.score[0] > sim.score[1] ? 0 : 1);
    const win = me && w === me.team, draw = w < 0;
    const all = [...sim.players.values()]; const mvp = all.slice().sort((a, b) => (b.kills * 2 + b.assists - b.deaths * 0.5 + b.dmgDone / 100) - (a.kills * 2 + a.assists - a.deaths * 0.5 + a.dmgDone / 100))[0];
    $('#endHead').innerHTML = `<h1 class="${draw ? 'draw' : win ? 'win' : 'lose'}">${draw ? 'تعادل' : win ? 'النصر لنا' : 'هُزمنا هذه المرة'}</h1><div class="escore"><span class="t0">${teamName(0, me ? me.team : -1)} <b>${sim.score[0]}</b></span><span class="t1"><b>${sim.score[1]}</b> ${teamName(1, me ? me.team : -1)}</span></div>` + (mvp ? `<div class="mvp">نجم المعركة: <b>${esc(mvp.name)}</b> · ${mvp.kills} إسقاط · ${Math.round(mvp.dmgDone)} ضرر</div>` : '');
    const tmp = document.createElement('div'); this.renderScore(tmp, sim, me); $('#endBody').innerHTML = tmp.innerHTML;
    $('#eAgain').textContent = sim.online ? 'متابعة' : 'معركة جديدة';
    this.open('end'); Audio.play(draw ? 'roundLose' : win ? 'roundWin' : 'roundLose');
  },
  // ---------- اختصارات واجهة اللعب ----------
  banner(...a) { HUD.banner(...a); }, toast(...a) { HUD.toast(...a); }, feed(...a) { HUD.feed(...a); },
  hitMarker(...a) { HUD.hitMarker(...a); }, damageDir(a) { HUD.damageDir(a); }, fps(s) { HUD.fps(s); },
};
