// الواجهة: القوائم، اختيار الشخصية والعتاد، الإعدادات، وواجهة اللعب (HUD)
import { Settings, setSetting, RES_OPTIONS, FPS_OPTIONS, QUALITY } from '../core/settings.js';
import { WEAPONS, SCOPES, NADES, MODES, SECONDARIES, validLoadout } from '../sim/weapons.js';
import { CHARS, CHAR_ORDER } from '../game/chardefs.js';
import { TEAMS } from '../sim/sim.js';
import { Audio } from '../core/audio.js';

const $ = s => document.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LKEY = 'rafidain.loadout.v1';

export const UI = {
  game: null, screen: null, stack: [],
  loadout: (() => { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (e) { return {}; } })(),
  init(game) {
    this.game = game;
    const ui = $('#ui');
    ui.innerHTML = TEMPLATE;
    ui.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { Audio.init(); Audio.play('ui'); this.open(b.dataset.go); }));
    ui.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { Audio.play('uiBack'); this.back(); }));
    $('#btnPlay').addEventListener('click', () => { Audio.init(); Audio.play('ui'); this.open('setup'); });
    $('#btnStart').addEventListener('click', () => { Audio.init(); this.startMatch(); });
    $('#pResume').addEventListener('click', () => this.game.resume());
    $('#pLoadout').addEventListener('click', () => this.open('loadout'));
    $('#pSettings').addEventListener('click', () => this.open('settings'));
    $('#pQuit').addEventListener('click', () => { this.game.quit(); this.showMenu(); });
    $('#eAgain').addEventListener('click', () => { if (this.game.sim && this.game.sim.online) { this.closeScreens(); this.hud(true); this.toast('المباراة التالية تبدأ بعد لحظات'); return; } this.startMatch(); });
    $('#btnJoin').addEventListener('click', () => { Audio.init(); this.joinOnline(); });
    $('#roomIn').value = (() => { try { return localStorage.getItem('rafidain.room') || ''; } catch (e) { return ''; } })();
    $('#roomIn').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
    $('#roomIn').addEventListener('keydown', e => { if (e.key === 'Enter') this.joinOnline(); });
    $('#eMenu').addEventListener('click', () => { this.game.quit(); this.showMenu(); });
    $('#buyOpen').addEventListener('click', () => { if (this.game.sim) this.open('loadout'); });
    $('#nameIn').value = Settings.name; $('#nameIn').addEventListener('change', e => setSetting('name', e.target.value.trim().slice(0, 16) || 'لاعب'));
    $('#tbPause').addEventListener('click', () => this.game.pause());
    $('#tbScore').addEventListener('touchstart', e => { e.preventDefault(); this.showScore(true); }, { passive: false });
    $('#tbScore').addEventListener('touchend', () => this.showScore(false));
    document.getElementById('weapBar').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if (b) this.game.queueSlot(+b.dataset.slot); });
    this.buildSetup(); this.buildChars(); this.buildSettings(); this.buildOnline();
    this.applyTouch();
    window.addEventListener('resize', () => this.applyTouch());
    this.showMenu();
  },
  applyTouch() {
    const touch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
    document.documentElement.classList.toggle('touch', touch);
    document.documentElement.style.setProperty('--ts', Settings.touchSize);
  },
  // ---------- التنقل بين الشاشات ----------
  hideAll() { document.querySelectorAll('.scr').forEach(s => s.classList.remove('on')); },
  open(id) {
    if (this.screen && this.screen !== id) this.stack.push(this.screen);
    this.hideAll(); const el = $('#s-' + id); if (el) el.classList.add('on'); this.screen = id;
    if (id === 'loadout') this.buildLoadout();
    if (id === 'chars') this.game.menuView('chars', Settings.char);
    if (id === 'menu') this.game.menuView('menu');
    if (id === 'setup') this.game.menuView('menu');
    if (id === 'settings') this.buildSettings();
  },
  back() {
    const prev = this.stack.pop();
    if (this.game.sim && !this.game.sim.matchOver && (!prev || prev === 'pause')) { this.hideAll(); this.screen = null; if (this.game.paused) this.open('pause'); else this.game.resume(); return; }
    if (prev) { this.hideAll(); $('#s-' + prev).classList.add('on'); this.screen = prev; if (prev === 'menu' || prev === 'setup') this.game.menuView('menu'); if (prev === 'chars') this.game.menuView('chars', Settings.char); }
    else this.showMenu();
  },
  showMenu() { this.stack = []; this.hideAll(); $('#s-menu').classList.add('on'); this.screen = 'menu'; this.hud(false); this.game.menuView('menu'); },
  closeScreens() { this.hideAll(); this.screen = null; this.stack = []; },
  hud(on) { $('#hud').classList.toggle('on', on); },
  // ---------- إعداد المباراة ----------
  setup: { mode: Settings.mode || 'epic', rounds: Settings.rounds || 5, diff: Settings.difficulty || 'normal', size: 2, team: Settings.team || 0 },
  buildSetup() {
    const S = this.setup;
    const seg = (id, items, key) => { const el = $(id); el.innerHTML = items.map(([v, l, sub]) => `<button class="opt ${S[key] == v ? 'sel' : ''}" data-v="${v}"><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</button>`).join(''); el.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); S[key] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; this.buildSetup(); })); };
    seg('#setMode', Object.entries(MODES).map(([k, m]) => [k, m.name, m.desc]), 'mode');
    seg('#setRounds', [[3, 'قصيرة', 'أول من يفوز بـ 3'], [5, 'عادية', 'أول من يفوز بـ 5'], [7, 'طويلة', 'أول من يفوز بـ 7']], 'rounds');
    seg('#setSize', [[1, '1 ضد 1'], [2, '2 ضد 2'], [3, '3 ضد 3'], [5, '5 ضد 5']], 'size');
    seg('#setDiff', [['easy', 'سهل'], ['normal', 'عادي'], ['hard', 'صعب']], 'diff');
    seg('#setTeam', [[0, TEAMS[0].name, 'من الشريعة'], [1, TEAMS[1].name, 'من صحن الجامع']], 'team');
  },
  startMatch() {
    const S = this.setup; setSetting('mode', S.mode); setSetting('rounds', S.rounds); setSetting('difficulty', S.diff); setSetting('team', S.team);
    this.closeScreens(); this.hud(true);
    this.game.startMatch({ mode: S.mode, roundsToWin: S.rounds, difficulty: S.diff, size: S.size, team: S.team, char: Settings.char, name: Settings.name, loadout: this.getLoadout(S.mode) });
  },
  getLoadout(mode) { return validLoadout(this.loadout[mode] || {}, mode); },
  // ---------- اللعب أونلاين ----------
  onTeam: -1,
  buildOnline() {
    const el = $('#onTeam');
    el.innerHTML = [[-1, 'تلقائي', 'يوزّعنا السيرفر بالتساوي'], [0, TEAMS[0].name, 'من الشريعة'], [1, TEAMS[1].name, 'من صحن الجامع']].map(([v, l, sub]) => `<button class="opt ${this.onTeam === v ? 'sel' : ''}" data-v="${v}"><b>${l}</b><small>${sub}</small></button>`).join('');
    el.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); this.onTeam = +b.dataset.v; this.buildOnline(); }));
  },
  onlineStatus(t, cls = '') { const e = $('#onStatus'); e.textContent = t; e.className = 'status ' + cls; },
  async joinOnline() {
    if (this.joining) return;
    const room = $('#roomIn').value.trim().toUpperCase();
    if (room.length < 4) { this.onlineStatus('اكتب رمز الغرفة الظاهر في تطبيق السيرفر', 'bad'); return; }
    try { localStorage.setItem('rafidain.room', room); } catch (e) { }
    this.joining = true; $('#btnJoin').disabled = true;
    this.onlineStatus('جارٍ الاتصال…');
    try {
      const ns = await this.game.joinOnline({ room, name: Settings.name, char: Settings.char, team: this.onTeam, loadout: this.getLoadout(Settings.mode || 'epic'), onStatus: s => this.onlineStatus(s) });
      ns.setLoadout(ns.me, this.getLoadout(ns.mode));
      ns.onlost = why => {
        this.banner('انقطع الاتصال', why, 'lose', 3);
        setTimeout(() => { if (this.game.sim === ns) { this.game.quit(); this.showMenu(); this.open('online'); this.onlineStatus(why, 'bad'); } }, 2500);
      };
      this.onlineStatus('تم الاتصال ✓', 'ok');
      this.closeScreens(); this.hud(true);
      this.game.startOnline(ns);
    } catch (e) { this.onlineStatus(e.message || 'تعذّر الاتصال', 'bad'); }
    this.joining = false; $('#btnJoin').disabled = false;
  },
  // ---------- الشخصيات ----------
  buildChars() {
    const el = $('#charList');
    el.innerHTML = CHAR_ORDER.map(id => { const c = CHARS[id]; return `<button class="char ${Settings.char === id ? 'sel' : ''}" data-id="${id}"><b>${esc(c.full)}</b><small>${esc(c.tag)}</small></button>`; }).join('');
    const info = () => { const c = CHARS[Settings.char]; $('#charInfo').innerHTML = `<h3>${esc(c.full)}</h3><div class="tagline">${esc(c.tag)}</div><p>${esc(c.desc)}</p>`; };
    el.querySelectorAll('.char').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); setSetting('char', b.dataset.id); this.buildChars(); this.game.menuView('chars', b.dataset.id); if (this.game.sim) this.game.setMyChar(b.dataset.id); }));
    info();
  },
  // ---------- العتاد ----------
  buildLoadout() {
    const mode = this.game.sim ? this.game.sim.mode : this.setup.mode, L = this.getLoadout(mode);
    const save = () => { this.loadout[mode] = L; try { localStorage.setItem(LKEY, JSON.stringify(this.loadout)); } catch (e) { } this.game.setMyLoadout(L); this.buildLoadout(); };
    $('#loMode').textContent = 'وضع: ' + MODES[mode].name;
    const stat = (w) => { const d = WEAPONS[w]; const dps = d.dmg * (d.pellets || 1) * d.rpm / 60; return [['الضرر', Math.min(1, d.dmg * (d.pellets || 1) / 120)], ['سرعة الإطلاق', Math.min(1, d.rpm / 900)], ['الدقة', Math.max(0.05, 1 - (d.spread + d.moveSpread * 0.3) * 18)], ['الحركة', (d.speed - 0.7) / 0.35], ['القتل/ث', Math.min(1, dps / 400)]]; };
    const card = (w, sel, kind) => { const d = WEAPONS[w]; return `<button class="wpn ${sel ? 'sel' : ''}" data-w="${w}" data-k="${kind}"><b>${esc(d.name)}</b><small>${clsName(d.cls)} · ${d.mag || '∞'} طلقة</small></button>`; };
    const P = MODES[mode].primaries;
    $('#loPrim').innerHTML = P.length ? P.map(w => card(w, L.primary === w, 'p')).join('') : '<div class="note">هذا الوضع بلا أسلحة رئيسية</div>';
    $('#loSec').innerHTML = SECONDARIES.map(w => card(w, L.secondary === w, 's')).join('');
    const sc = L.primary ? WEAPONS[L.primary].scopes : [];
    $('#loScope').innerHTML = sc.map(s => `<button class="opt ${L.scope === s ? 'sel' : ''}" data-s="${s}"><b>${SCOPES[s].name}</b><small>تكبير ×${SCOPES[s].zoom}</small></button>`).join('') || '<div class="note">—</div>';
    for (let i = 0; i < 2; i++) $('#loNade' + i).innerHTML = Object.entries(NADES).map(([k, n]) => `<button class="opt ${L.nades[i] === k ? 'sel' : ''}" data-n="${k}" data-i="${i}"><b>${n.name}</b><small>${n.desc}</small></button>`).join('') + `<button class="opt ${!L.nades[i] ? 'sel' : ''}" data-n="" data-i="${i}"><b>لا شيء</b></button>`;
    const show = w => { if (!w) { $('#loStats').innerHTML = ''; return; } const d = WEAPONS[w]; $('#loStats').innerHTML = `<h3>${esc(d.name)}</h3><p>${esc(d.desc || '')}</p>` + stat(w).map(([l, v]) => `<div class="bar"><span>${l}</span><i style="--v:${Math.max(0.04, Math.min(1, v))}"></i></div>`).join(''); this.game.menuWeapon(w, w === L.primary ? L.scope : null); };
    show(L.primary || L.secondary);
    document.querySelectorAll('#s-loadout .wpn').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); if (b.dataset.k === 'p') { L.primary = b.dataset.w; L.scope = WEAPONS[L.primary].scopes[0]; } else L.secondary = b.dataset.w; save(); show(b.dataset.w); }));
    document.querySelectorAll('#loScope .opt').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); L.scope = b.dataset.s; save(); }));
    document.querySelectorAll('#s-loadout [data-n]').forEach(b => b.addEventListener('click', () => { Audio.play('ui'); const i = +b.dataset.i; const arr = [L.nades[0], L.nades[1]]; arr[i] = b.dataset.n || undefined; L.nades = arr.filter(Boolean); save(); }));
  },
  // ---------- الإعدادات ----------
  buildSettings() {
    const el = $('#setBody'); if (!el) return;
    const row = (label, ctrl, sub) => `<div class="row"><div><label>${label}</label>${sub ? `<small>${sub}</small>` : ''}</div><div class="ctl">${ctrl}</div></div>`;
    const sel = (k, opts) => `<select data-k="${k}">${opts.map(o => `<option value="${o.id}" ${String(Settings[k]) === String(o.id) ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
    const tog = k => `<button class="tog ${Settings[k] ? 'on' : ''}" data-t="${k}"></button>`;
    const rng = (k, a, b, s) => `<input type="range" data-k="${k}" min="${a}" max="${b}" step="${s}" value="${Settings[k]}"><output>${Settings[k]}</output>`;
    el.innerHTML =
      '<div class="sec">الشاشة والأداء</div>' +
      row('الدقة', sel('res', RES_OPTIONS), 'نسبة من دقة الجهاز أو دقة ثابتة. الأعلى أجمل والأقل أسرع.') +
      row('حدّ الفريمات', sel('fps', FPS_OPTIONS), '«غير محدود» يستغل كل قدرة الجهاز.') +
      row('عرض الفريمات أعلى اليسار', tog('showFps')) +
      row('الجودة', sel('quality', [{ id: 'auto', label: 'تلقائية' }].concat(Object.entries(QUALITY).map(([k, q]) => ({ id: k, label: q.label })))), 'الظلال والقوام والجسيمات. تُطبّق بعد إعادة التشغيل.') +
      row('مجال الرؤية', rng('fov', 70, 120, 1)) +
      '<div class="sec">التحكم</div>' +
      row('الحساسية', rng('sens', 0.2, 3, 0.05)) + row('حساسية التصويب', rng('adsSens', 0.2, 1.5, 0.05)) + row('عكس المحور العمودي', tog('invertY')) +
      row('حجم أزرار اللمس', rng('touchSize', 0.75, 1.4, 0.05)) + row('لون مؤشر التصويب', sel('crossColor', [{ id: '#5dffb0', label: 'نعناعي' }, { id: '#ffffff', label: 'أبيض' }, { id: '#ffe14a', label: 'أصفر' }, { id: '#ff4a6a', label: 'أحمر' }, { id: '#4ad8ff', label: 'سماوي' }])) +
      row('الاهتزاز', tog('haptics')) +
      '<div class="sec">الصوت</div>' + row('الصوت العام', rng('volume', 0, 1, 0.05)) + row('الأجواء', rng('music', 0, 1, 0.05));
    el.querySelectorAll('select').forEach(s => s.addEventListener('change', () => { const v = s.value; setSetting(s.dataset.k, isNaN(+v) ? v : +v); }));
    el.querySelectorAll('.tog').forEach(b => b.addEventListener('click', () => { setSetting(b.dataset.t, !Settings[b.dataset.t]); b.classList.toggle('on', Settings[b.dataset.t]); }));
    el.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => { setSetting(r.dataset.k, +r.value); r.nextElementSibling.textContent = r.value; if (r.dataset.k === 'volume') Audio.setVolume(+r.value); if (r.dataset.k === 'touchSize') this.applyTouch(); }));
  },
  // ---------- واجهة اللعب ----------
  fps(text) { const e = $('#fps'); e.style.display = Settings.showFps ? '' : 'none'; e.textContent = text; },
  showScore(on) { $('#score').classList.toggle('on', on); if (on) this.renderScore(); },
  renderScore() {
    const sim = this.game.sim; if (!sim) return;
    const rows = t => [...sim.players.values()].filter(p => p.team === t).sort((a, b) => b.kills - a.kills).map(p => `<tr class="${p.alive ? '' : 'dead'} ${p.id === this.game.me ? 'me' : ''}"><td>${esc(p.name)}${p.bot ? ' <i>بوت</i>' : ''}${sim.online && !p.bot && sim.roster.get(p.id) && sim.roster.get(p.id).rtt ? ` <i>${sim.roster.get(p.id).rtt}ms</i>` : ''}</td><td>${CHARS[p.char].name}</td><td>${p.kills}</td><td>${p.assists}</td><td>${p.deaths}</td><td>${Math.round(p.dmgDone)}</td></tr>`).join('');
    $('#scoreBody').innerHTML = [0, 1].map(t => `<div class="team t${t}"><h4>${TEAMS[t].name} <b>${sim.score[t]}</b></h4><table><tr><th>اللاعب</th><th>الشخصية</th><th>ق</th><th>م</th><th>س</th><th>الضرر</th></tr>${rows(t)}</table></div>`).join('');
  },
  feed(k, v, w, hs, wall, mine) {
    const f = $('#feed'), e = h('div', 'kf' + (mine ? ' mine' : ''));
    const wn = WEAPONS[w] ? WEAPONS[w].name : NADES[w] ? NADES[w].name : w === 'fall' ? 'سقوط' : w;
    e.innerHTML = (k ? `<b class="t${k.team}">${esc(k.name)}</b>` : '') + `<span class="w">${esc(wn)}${hs ? ' <i class="hs">◎</i>' : ''}${wall ? ' <i>⟂</i>' : ''}</span><b class="t${v.team}">${esc(v.name)}</b>`;
    f.prepend(e); while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => e.classList.add('fade'), 5000); setTimeout(() => e.remove(), 5800);
  },
  banner(big, small, cls = '', dur = 2.6) {
    const b = $('#banner'); b.className = 'on ' + cls; $('#bBig').textContent = big; $('#bSmall').textContent = small || '';
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), dur * 1000);
  },
  toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => e.classList.remove('on'), 2200); },
  hitMarker(hs, kill) { const e = $('#hitm'); e.className = 'on' + (hs ? ' hs' : '') + (kill ? ' kill' : ''); clearTimeout(this._ht); this._ht = setTimeout(() => e.className = '', kill ? 380 : 160); },
  damageDir(angle) {
    const el = h('div', 'dd'); el.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`; $('#dmgdir').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  },
  endScreen(sim, me) {
    const won = sim.score[me.team] > sim.score[1 - me.team];
    $('#eTitle').textContent = won ? 'انتصار!' : 'هزيمة';
    $('#eTitle').className = won ? 'win' : 'lose';
    $('#eScore').textContent = `${TEAMS[me.team].name} ${sim.score[me.team]} — ${sim.score[1 - me.team]} ${TEAMS[1 - me.team].name}`;
    const best = [...sim.players.values()].sort((a, b) => b.kills * 100 + b.dmgDone / 10 - (a.kills * 100 + a.dmgDone / 10))[0];
    $('#eStats').innerHTML = `<div><b>${me.kills}</b><small>قتل</small></div><div><b>${me.deaths}</b><small>سقوط</small></div><div><b>${me.assists}</b><small>مساعدة</small></div><div><b>${me.hs}</b><small>طلقات رأس</small></div><div><b>${Math.round(me.dmgDone)}</b><small>الضرر</small></div>` + `<p class="mvp">نجم المباراة: <b>${esc(best.name)}</b> (${CHARS[best.char].full})</p>`;
    this.hideAll(); $('#s-end').classList.add('on'); this.screen = 'end'; this.hud(false);
  },
};
function clsName(c) { return { rifle: 'بندقية', smg: 'رشاش خفيف', shotgun: 'مضخية', lmg: 'رشاش ثقيل', sniper: 'قنّاصة', pistol: 'مسدس', knife: 'سلاح أبيض' }[c] || c; }

const TEMPLATE = `
<div id="hud">
  <div id="fps"></div>
  <div id="net"></div>
  <canvas id="radar" width="160" height="160"></canvas>
  <div id="topbar"><div class="sc t0"><b id="sc0">0</b><span id="al0"></span></div><div id="timer">1:55</div><div class="sc t1"><span id="al1"></span><b id="sc1">0</b></div></div>
  <div id="phase"></div>
  <div id="feed"></div>
  <div id="cross"><i class="l"></i><i class="r"></i><i class="u"></i><i class="d"></i><b></b></div>
  <div id="hitm"><i></i><i></i><i></i><i></i></div>
  <div id="dmgdir"></div>
  <div id="vitals"><div class="hp"><span>✚</span><b id="hpV">100</b><i id="hpBar"></i></div><div class="ar"><span>⛨</span><b id="arV">100</b></div></div>
  <div id="ammo"><div id="wName"></div><div class="mag"><b id="magV">30</b><span>/</span><small id="resV">90</small></div><div id="weapBar"></div></div>
  <div id="buy"><b>وقت التجهيز</b><span id="buyT">9</span><button id="buyOpen" class="btn sm">تغيير العتاد (B)</button></div>
  <div id="spec"></div>
  <div id="banner"><b id="bBig"></b><small id="bSmall"></small></div>
  <div id="toast"></div>
  <div id="scopeov"><div class="lens"></div><i class="h"></i><i class="v"></i><b></b></div>
  <div id="flashov"></div>
  <div id="hurtov"></div>
  <div id="score"><div id="scoreBody"></div></div>
  <div id="touch">
    <div id="stick"><div id="knob"></div></div>
    <button class="tb big" data-a="fire" id="tbFire">✹<small>إطلاق</small></button>
    <button class="tb" data-a="fire2" id="tbFire2">✹</button>
    <button class="tb" data-a="ads" id="tbAds">◎<small>تصويب</small></button>
    <button class="tb" data-a="jump" id="tbJump">⤒<small>قفز</small></button>
    <button class="tb" data-a="crouch" id="tbCrouch">⤓<small>انحناء</small></button>
    <button class="tb" data-a="reload" id="tbReload">↻<small>تلقيم</small></button>
    <button class="tb" data-a="grenade" id="tbNade">●<small>قنبلة</small></button>
    <button class="tb" data-a="swap" id="tbSwap">⇄<small>تبديل</small></button>
  </div>
  <button id="tbPause" class="tb mini">❚❚</button>
  <button id="tbScore" class="tb mini">☰</button>
</div>

<section class="scr" id="s-menu">
  <div class="title"><h1>جبهة الرافدين</h1><div class="sub">معارك تكتيكية في أزقّة بغداد القديمة</div></div>
  <div class="menu">
    <button class="btn primary" id="btnPlay">ابدأ القتال</button>
    <button class="btn" data-go="online">اللعب أونلاين <small>2 ضد 2</small></button>
    <button class="btn" data-go="chars">الشخصيات</button>
    <button class="btn" data-go="loadout">العتاد والأسلحة</button>
    <button class="btn" data-go="settings">الإعدادات</button>
    <label class="name">اسمك <input id="nameIn" maxlength="16"></label>
  </div>
</section>

<section class="scr" id="s-setup">
  <div class="panel wide">
    <div class="head"><h2>إعداد المعركة</h2><button class="x" data-back>✕</button></div>
    <div class="grid2">
      <div><h5>النمط</h5><div class="opts" id="setMode"></div></div>
      <div><h5>طول المباراة</h5><div class="opts" id="setRounds"></div></div>
      <div><h5>حجم الفريقين</h5><div class="opts" id="setSize"></div><small class="note">البوتات تكمل الأماكن الفارغة</small></div>
      <div><h5>مستوى البوتات</h5><div class="opts" id="setDiff"></div></div>
      <div><h5>فريقك</h5><div class="opts" id="setTeam"></div></div>
      <div class="go"><button class="btn sm" data-go="chars">الشخصية</button><button class="btn sm" data-go="loadout">العتاد</button><button class="btn primary" id="btnStart">انطلق ⟵</button></div>
    </div>
  </div>
</section>

<section class="scr" id="s-chars">
  <div class="panel side">
    <div class="head"><h2>اختر شخصيتك</h2><button class="x" data-back>✕</button></div>
    <div id="charList"></div>
    <div id="charInfo"></div>
  </div>
</section>

<section class="scr" id="s-loadout">
  <div class="panel side lo">
    <div class="head"><h2>العتاد <small id="loMode"></small></h2><button class="x" data-back>✕</button></div>
    <h5>السلاح الرئيسي</h5><div class="wlist" id="loPrim"></div>
    <h5>المنظار</h5><div class="opts small" id="loScope"></div>
    <h5>المسدس</h5><div class="wlist" id="loSec"></div>
    <h5>القنبلة الأولى</h5><div class="opts small" id="loNade0"></div>
    <h5>القنبلة الثانية</h5><div class="opts small" id="loNade1"></div>
  </div>
  <div id="loStats" class="panel stats"></div>
</section>

<section class="scr" id="s-settings">
  <div class="panel wide"><div class="head"><h2>الإعدادات</h2><button class="x" data-back>✕</button></div><div id="setBody"></div></div>
</section>

<section class="scr" id="s-online">
  <div class="panel online"><div class="head"><h2>اللعب أونلاين</h2><button class="x" data-back>✕</button></div>
  <p class="note">شغّل تطبيق «سيرفر الرافدين» على الهاتف الوسيط واتركه يعمل، ثم اكتب رمز الغرفة الظاهر فيه. كل اللاعبين يكتبون الرمز نفسه.</p>
  <label class="room">رمز الغرفة<input id="roomIn" maxlength="5" dir="ltr" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="•••••"></label>
  <h5>الفريق المفضّل</h5><div class="opts" id="onTeam"></div>
  <div id="onStatus" class="status"></div>
  <div class="menu row"><button class="btn sm" data-go="chars">الشخصية</button><button class="btn sm" data-go="loadout">العتاد</button><button class="btn primary" id="btnJoin">اتصال ⟵</button></div></div>
</section>

<section class="scr" id="s-pause">
  <div class="panel"><div class="head"><h2>استراحة</h2></div>
  <div class="menu"><button class="btn primary" id="pResume">متابعة</button><button class="btn" id="pLoadout">العتاد</button><button class="btn" data-go="chars">الشخصية</button><button class="btn" id="pSettings">الإعدادات</button><button class="btn" id="pQuit">مغادرة المباراة</button></div></div>
</section>

<section class="scr" id="s-end">
  <div class="panel center"><h2 id="eTitle"></h2><div id="eScore"></div><div id="eStats"></div>
  <div class="menu row"><button class="btn primary" id="eAgain">مباراة جديدة</button><button class="btn" id="eMenu">القائمة</button></div></div>
</section>
`;
