// ===================== الواجهة =====================
const TIPS = [
  'أمِل العصا قليلاً (أو اضغط Shift) لتمشي بصمت — الركض يُسمَع حتى خلف الجدران.',
  'المخروط الأصفر يعني شكّاً: ابتعد عن مجال الرؤية قبل أن يتحوّل للأحمر.',
  'وأنت جريح، اضغط «تفاعل» مطوّلاً حيث لا شيء أمامك لتركّز وترمّم وتراً مقابل شيء من نبضك.',
  'اقترب من رقيب لا يراك واضغط «تفاعل»: النقرة الصامتة تطفئه طويلاً.',
  'حين تسقط يبقى طيفك حيث سقطت حاملاً رنينك — عُد إليه والمسه لتستعيده.',
  'المراسي تحفظ تقدّمك وترمّمك، وفيها تبدّل التمائم.',
  'قرين الظل يجذب الرقباء والذبّان بعيداً عنك.',
  'استدرج الرقباء إلى الأشعة الحمراء لتعطيلهم مؤقتاً.',
  'الأماكن المضاءة تكشفك أسرع بكثير من الظلام.',
  'صدى يستطيع تثبيت لوحات الضغط بدلاً منك: اضغط زر صدى.',
  'الوثبة تحميك لحظياً من الأرضيات المكهربة.',
  'صرخة الجرس تبدّد ذبّان النحاس وتُسكت الرقباء والعيون الثابتة.',
  'فانوس يبيع التمائم مقابل الرنين — اجمع الشظايا المتلألئة.',
];
const JOURNAL_ICONS = {
  drone: '<svg viewBox="0 0 24 24"><path d="M12 12 L23 6 V18 Z" fill="#ffb347" opacity=".25"/><circle cx="11" cy="12" r="7" fill="#3b424d" stroke="#ffb347" stroke-width="1.4"/><circle cx="14" cy="12" r="2.3" fill="#ffb347"/></svg>',
  turret: '<svg viewBox="0 0 24 24"><rect x="5" y="9" width="12" height="10" rx="2" fill="#3b424d" stroke="#ff6a5a" stroke-width="1.4"/><path d="M15 12 H22" stroke="#ff6a5a" stroke-width="2.4" stroke-linecap="round"/><circle cx="11" cy="14" r="2" fill="#ff6a5a"/></svg>',
  swarm: '<svg viewBox="0 0 24 24"><g fill="#ff3fa4"><circle cx="7" cy="8" r="2.2"/><circle cx="15" cy="6" r="1.8"/><circle cx="12" cy="13" r="2.4"/><circle cx="18" cy="15" r="1.7"/><circle cx="7" cy="17" r="1.9"/></g></svg>',
  nest: '<svg viewBox="0 0 24 24"><path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z" fill="#2c2433" stroke="#ff3fa4" stroke-width="1.4"/><circle cx="12" cy="12" r="3" fill="#ff3fa4"/></svg>',
  hunter: '<svg viewBox="0 0 24 24"><path d="M12 3 L20 12 L12 21 L4 12 Z" fill="#2a2340" stroke="#a77bff" stroke-width="1.4"/><circle cx="9.5" cy="11" r="1.5" fill="#e6d6ff"/><circle cx="14.5" cy="11" r="1.5" fill="#e6d6ff"/></svg>',
  mine: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#3a2020" stroke="#ff7b5a" stroke-width="1.4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="#ff7b5a" stroke-width="1.5" stroke-linecap="round"/></svg>',
  boss: '<svg viewBox="0 0 24 24"><path d="M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z" fill="#2a1418" stroke="#ff4d5e" stroke-width="1.4"/><circle cx="12" cy="12" r="4" fill="#ff4d5e"/><circle cx="12" cy="12" r="1.6" fill="#120608"/></svg>',
  shade: '<svg viewBox="0 0 24 24"><path d="M5 20 V11 a7 7 0 0 1 14 0 V20 l-2.3 -1.6 -2.3 1.6 -2.4 -1.6 -2.3 1.6 -2.4 -1.6 Z" fill="#160e26" stroke="#8a6cff" stroke-width="1.4"/><circle cx="9.5" cy="11.5" r="1.4" fill="#c9b8ff"/><circle cx="14.5" cy="11.5" r="1.4" fill="#c9b8ff"/></svg>',
};
const pips = n => '<i></i>'.repeat(n);
// عزل المقاطع اللاتينية (K AND J) كي لا تنقلب داخل النص العربي
const iso = s => esc(s).replace(/[A-Za-z][A-Za-z0-9]*(?: +[A-Za-z0-9]+)*/g, m => '\u2066' + m + '\u2069');
function genHack(n) {
  const N = n * n, mask = new Uint8Array(N), vis = new Uint8Array(N);
  const st = [randInt(0, N - 1)]; vis[st[0]] = 1;
  while (st.length) {
    const c = st[st.length - 1], cx = c % n, cy = (c / n) | 0, nb = [];
    for (let d = 0; d < 4; d++) { const nx = cx + DIR4[d][0], ny = cy + DIR4[d][1]; if (nx >= 0 && ny >= 0 && nx < n && ny < n && !vis[ny * n + nx]) nb.push(d); }
    if (!nb.length) { st.pop(); continue; }
    const d = pick(nb), ni = (cy + DIR4[d][1]) * n + cx + DIR4[d][0];
    mask[c] |= 1 << d; mask[ni] |= 1 << ((d + 2) % 4); vis[ni] = 1; st.push(ni);
  }
  const sy = randInt(0, n - 1), ty = randInt(0, n - 1);
  mask[sy * n] |= 8; mask[ty * n + n - 1] |= 2;
  const rot = m => ((m << 1) & 15) | (m >> 3);
  const base = Uint8Array.from(mask);
  for (let i = 0; i < N; i++) { const r = randInt(0, 3); for (let k = 0; k < r; k++) mask[i] = rot(mask[i]); }
  const h = { n, mask, base: Uint8Array.from(mask), r: new Uint16Array(N), sy, ty, rot };
  let guard = 0;
  while (hackPowered(h).win && guard++ < 20) { const i = randInt(0, N - 1); h.mask[i] = rot(h.mask[i]); h.base[i] = h.mask[i]; }
  return h;
}
function hackPowered(h) {
  const { n, mask, sy, ty } = h, pw = new Uint8Array(n * n), s = sy * n;
  if (!(mask[s] & 8)) return { pw, win: false };
  const q = [s]; pw[s] = 1;
  while (q.length) {
    const c = q.pop(), cx = c % n, cy = (c / n) | 0;
    for (let d = 0; d < 4; d++) {
      if (!(mask[c] & (1 << d))) continue;
      const nx = cx + DIR4[d][0], ny = cy + DIR4[d][1];
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const ni = ny * n + nx;
      if (pw[ni] || !(mask[ni] & (1 << ((d + 2) % 4)))) continue;
      pw[ni] = 1; q.push(ni);
    }
  }
  const t = ty * n + n - 1;
  return { pw, win: !!(pw[t] && (mask[t] & 2)) };
}
function tileSvg(m) {
  const seg = [[50, 0], [100, 50], [50, 100], [0, 50]];
  let p = '';
  for (let d = 0; d < 4; d++) if (m & (1 << d)) p += 'M50 50 L' + seg[d][0] + ' ' + seg[d][1] + ' ';
  const bits = (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
  return '<svg viewBox="0 0 100 100"><path d="' + p + '" stroke="currentColor" stroke-width="17" stroke-linecap="round" fill="none"/>' +
    (bits === 1 ? '<circle cx="50" cy="50" r="15" fill="currentColor"/>' : '<circle cx="50" cy="50" r="9.5" fill="currentColor"/>') + '</svg>';
}

const UI = {
  toastT: 0, wQ: [], wCur: null, wT: 0, wGap: 0, wDelay: 0, hudT: 0, perfT: 0, mapT: 0, from: {}, hk: null, hkCb: null, rdCb: null, hudSig: '', gpu: null, lastHp: -1, lastRnn: -1,
  tk: null, chEquip: false, chFrom: null, chSel: null, chMsg: '', jFrom: null, jSel: null,
  init() {
    $$('[data-icon]').forEach(e => { e.innerHTML = ICONS[e.dataset.icon] || ''; });
    $$('[data-close]').forEach(b => b.addEventListener('click', () => { Sound.play('uiBack'); this.back(b.dataset.close); }));
    const on = (id, fn) => $(id).addEventListener('click', e => { Sound.init(); Sound.play('ui'); fn(e); });
    on('#btnPlay', () => this.openBrief(Math.min(Save.data.unlocked, LEVELS.length) - 1));
    on('#btnLevels', () => { this.buildLevels(); this.open('scrLevels', 'scrTitle'); });
    on('#btnSettings', () => { this.buildSettings(); this.open('scrSettings', 'scrTitle'); });
    on('#btnHelp', () => { this.buildHelp(); this.open('scrHelp', 'scrTitle'); });
    on('#brGo', () => this.startPlay());
    on('#brBack', () => this.toMenu());
    on('#psResume', () => game.resume());
    on('#psRestart', () => { this.hide('scrPause'); this.restartLevel(); });
    on('#psSettings', () => { this.buildSettings(); this.open('scrSettings', 'scrPause'); });
    on('#psQuit', () => this.toMenu());
    on('#dRespawn', () => { this.hide('scrDead'); game.respawn(); });
    on('#dRestart', () => { this.hide('scrDead'); this.restartLevel(); });
    on('#dQuit', () => this.toMenu());
    on('#rsNext', () => { this.hide('scrResults'); const n = game.levelIndex + 1; if (n < LEVELS.length) this.openBrief(n); else this.showEnd(); });
    on('#rsRetry', () => { this.hide('scrResults'); this.restartLevel(); });
    on('#rsMenu', () => this.toMenu());
    on('#memOk', () => { this.hide('scrMemory'); if (game.state === 'memory') game.state = 'playing'; });
    on('#itOk', () => { this.hide('scrItem'); if (game.state === 'memory') game.state = 'playing'; });
    on('#btnCharms', () => this.openCharms(false));
    on('#btnJournal', () => this.openJournal());
    on('#psCharms', () => this.openCharms(false));
    on('#psJournal', () => this.openJournal());
    on('#chClose', () => this.closeCharms());
    on('#jClose', () => this.closeJournal());
    on('#tkShop', () => this.openShop());
    on('#tkBye', () => this.closeTalk());
    on('#shClose', () => this.closeTalk());
    $('#tkBox').addEventListener('click', e => { if (e.target.closest('button')) return; this.talkNext(); });
    on('#endOk', () => this.toMenu());
    const full = () => {
      const d = document, el = d.documentElement;
      try {
        if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) { this.toast('ملء الشاشة غير متاح هنا'); return; }
        const pr = req.call(el, { navigationUI: 'hide' });
        const lock = () => { try { const o = screen.orientation; if (o && o.lock && Input.isTouch) o.lock('landscape').catch(() => { }); } catch (e) { } };
        if (pr && pr.then) pr.then(lock).catch(() => this.toast('المتصفح رفض ملء الشاشة')); else lock();
      } catch (e) { this.toast('ملء الشاشة غير متاح هنا'); }
    };
    on('#btnFull', full); on('#psFull', full);
    const fsChange = () => { const f = !!(document.fullscreenElement || document.webkitFullscreenElement); $('#btnFull').textContent = f ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'; $('#psFull').textContent = $('#btnFull').textContent; setTimeout(() => R.resize(), 120); };
    document.addEventListener('fullscreenchange', fsChange); document.addEventListener('webkitfullscreenchange', fsChange);
    $('#hkQuit').addEventListener('click', () => this.endHack(false));
    $('#btnPause').addEventListener('pointerdown', e => { e.preventDefault(); Sound.init(); game.pause(); });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') { if (game.state !== 'playing') this.backKey(); return; }
      if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') && this.isOn('scrTalk')) { e.preventDefault(); this.talkNext(); }
    });
    // زر الرجوع في أندرويد: يعيد true إن عالجته اللعبة، وfalse للخروج من التطبيق
    window.__nabdBack = () => { try { return this.backKey(); } catch (e) { return false; } };
    window.__nabdPause = () => { try { if (game.state === 'playing') game.pause(); } catch (e) { } };
    if (window.NabdAndroid) { document.documentElement.classList.add('apk'); $('#btnFull').classList.add('hidden'); $('#psFull').classList.add('hidden'); }
    this.applyPerf(); this.applyTouch(); this.applyHudToggles();
    this.updateSaveInfo();
  },
  isOn(id) { return $('#' + id).classList.contains('on'); },
  backKey() {
    Sound.init();
    const on = id => this.isOn(id);
    if (on('scrSettings')) { this.back('scrSettings'); return true; }
    if (on('scrLevels')) { this.back('scrLevels'); return true; }
    if (on('scrHelp')) { this.back('scrHelp'); return true; }
    if (on('scrCharms')) { this.closeCharms(); return true; }
    if (on('scrJournal')) { this.closeJournal(); return true; }
    if (on('scrShop') || on('scrTalk')) { this.closeTalk(); return true; }
    if (on('scrItem')) { $('#itOk').click(); return true; }
    if (on('scrMemory')) { $('#memOk').click(); return true; }
    if (on('scrHack')) { this.endHack(false); return true; }
    if (on('scrRiddle')) return true;
    if (on('scrPause')) { game.resume(); return true; }
    if (on('scrBrief')) { this.toMenu(); return true; }
    if (on('scrDead') || on('scrResults') || on('scrEnd')) { this.toMenu(); return true; }
    if (game.state === 'playing') { game.pause(); return true; }
    return false;
  },
  show(id) { $('#' + id).classList.add('on'); },
  hide(id) { $('#' + id).classList.remove('on'); },
  open(id, from) { if (from) { this.hide(from); this.from[id] = from; } this.show(id); },
  back(id) { this.hide(id); const f = this.from[id]; if (f) this.show(f); },
  hideAll() { $$('.screen').forEach(s => s.classList.remove('on')); },
  hud(on) { $('#hud').classList.toggle('on', on); },
  toMenu() {
    this.hideAll(); this.hud(false); this.clearDialog(); this.tk = null;
    if (this.hk) { this.hk.done = true; this.hk = null; }
    game.loadLevel(0, true); game.state = 'menu';
    this.show('scrTitle'); this.updateSaveInfo();
  },
  updateSaveInfo() {
    const d = Save.data, total = Object.values(d.stars).reduce((a, b) => a + b, 0);
    $('#saveInfo').textContent = 'المرحلة ' + Math.min(d.unlocked, LEVELS.length) + ' من ' + LEVELS.length + ' · النجوم ' + total + '/' + (LEVELS.length * 3) + ' · ◈ ' + d.rnn + ' · التمائم ' + d.charms.length + '/' + CHARM_ORDER.length + (Save.cloud.ready ? ' · محفوظ في حسابك' : '');
    $('#btnPlay').textContent = d.unlocked > 1 || d.stars.L1 ? 'متابعة' : 'ابدأ';
  },
  clearDialog() { this.wQ = []; this.wCur = null; this.wT = 0; this.wGap = 0; this.wDelay = 0; $('#whisper').classList.remove('on'); $('#areaCard').classList.remove('show'); },
  openBrief(i) {
    i = clamp(i, 0, LEVELS.length - 1);
    const def = LEVELS[i];
    this.hideAll(); this.hud(false); this.clearDialog();
    game.loadLevel(i, false); game.state = 'brief';
    $('#brNum').textContent = 'المرحلة ' + (i + 1) + ' من ' + LEVELS.length + (def.subtitle ? ' · ' + def.subtitle : '');
    $('#brName').textContent = def.name;
    $('#brStory').textContent = def.story;
    $('#brMissions').innerHTML = game.missions.primary.map(m => '<li>' + iso(m.text) + '</li>').join('');
    $('#brSide').innerHTML = game.missions.side.map(m => '<li>' + iso(m.text) + '</li>').join('') || '<li>لا يوجد</li>';
    const g = game.gadgets();
    let gh = g.map(id => '<span class="gchip"><span>' + ICONS[id] + '</span>' + GADGETS[id].name + '</span>').join('');
    if (def.newGadget && !g.includes(def.newGadget)) gh += '<span class="gchip off"><span>' + ICONS[def.newGadget] + '</span>قدرة جديدة مخبّأة هنا</span>';
    const ch = Object.values(def.legend || {}).find(v => v.t === 'charm');
    if (ch && !Save.data.charms.includes(ch.charm)) gh += '<span class="gchip off violet"><span>' + CHARM_ICONS.notch + '</span>تميمة مفقودة في هذه المرحلة</span>';
    $('#brGadgets').innerHTML = gh;
    this.show('scrBrief');
  },
  startPlay() {
    this.hideAll(); this.hud(true);
    game.state = 'playing'; Sound.init();
    this.clearDialog();
    const def = game.def;
    this.areaCard('المرحلة ' + ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'][game.levelIndex], def.name, def.subtitle);
    this.wDelay = 3.3;
    (def.intro || []).forEach(l => game.say(l[0], l[1], l[2], 'mid'));
  },
  restartLevel() {
    const i = game.levelIndex;
    this.clearDialog();
    game.loadLevel(i, false); this.hideAll(); this.hud(true); game.state = 'playing';
  },
  showDead(why) {
    $('#deadWhy').textContent = why; $('#deadTip').textContent = 'نصيحة: ' + pick(TIPS);
    $('#dRespawn').textContent = game.checkpoint && (game.checkpoint.x !== game.L.start.x || game.checkpoint.y !== game.L.start.y) ? 'النهوض من المرسى' : 'المحاولة مجدداً';
    $('#deadShade').textContent = game.shade ? 'بقي طيفك هناك يحرس ◈ ' + game.shade.amt + ' من الرنين. عُد إليه لتستعيده.' : '';
    this.show('scrDead');
  },
  showResults(r) {
    const star = on => '<span class="' + (on ? 'on' : '') + '">' + ICONS.star + '</span>';
    $('#rsNum').textContent = 'المرحلة ' + (r.index + 1) + ' — ' + LEVELS[r.index].name;
    $('#rsStars').innerHTML = star(r.stars >= 1) + star(r.stars >= 2) + star(r.stars >= 3);
    const M = r.missions;
    $('#rsList').innerHTML = M.primary.map(m => '<li class="ok">' + iso(m.text) + '</li>').join('') +
      M.side.map(s => '<li class="' + (s.done && !s.failed ? 'ok' : 'no') + '">' + iso(s.text) + '</li>').join('');
    $('#rsStats').innerHTML = [['الوقت', fmtTime(r.time)], ['النقاط', r.score], ['مرات الرصد', r.detections], ['السقوط', r.deaths], ['المِحَن', r.dyn], ['الرنين', '◈ ' + Save.data.rnn]]
      .map(s => '<div>' + s[0] + '<b>' + s[1] + '</b></div>').join('');
    $('#rsNext').textContent = r.index + 1 < LEVELS.length ? 'المرحلة التالية' : 'النهاية';
    this.hud(false); this.show('scrResults'); this.updateSaveInfo();
  },
  showEnd() {
    $('#endText').textContent = ENDING_TEXT;
    this.hideAll(); this.hud(false); this.show('scrEnd');
  },
  fill(text) {
    const touch = $('#hud').classList.contains('touch');
    return String(text).replace(/\{move\}/g, touch ? 'حرّك العصا على اليسار للمشي، وأمِلها قليلاً لتتسلّل بصمت.' : 'تحرّك بـ WASD أو الأسهم، واضغط Shift لتتسلّل بصمت.')
      .replace(/\{use\}/g, touch ? 'زر «تفاعل»' : 'زر E');
  },
  showMemory(m, isMem) {
    $('#memWho').textContent = isMem === false ? 'لوح منقوش' : 'لوح ذاكرة';
    $('#memWho').className = 'who ' + (isMem === false ? 'mint' : 'violet');
    $('#memTitle').textContent = m.title; $('#memText').textContent = this.fill(m.text);
    if (game.state === 'playing') game.state = 'memory';
    this.show('scrMemory');
  },
  showItem(kind, id, note) {
    const isCharm = kind === 'charm', C = isCharm ? CHARMS[id] : GADGETS[id];
    $('#itKind').textContent = isCharm ? 'تميمة جديدة' : 'قدرة جديدة';
    $('#itIcon').innerHTML = isCharm ? CHARM_ICONS[id] : ICONS[id];
    $('#itIcon').className = 'itic ' + (isCharm ? 'charm' : 'gadget');
    $('#itName').textContent = C.name;
    $('#itDesc').textContent = C.desc;
    $('#itCost').innerHTML = isCharm ? 'تشغل <span class="pips">' + pips(C.cost) + '</span> ' + (C.cost > 1 ? 'خانتين' : 'خانة واحدة') : 'تكلّف ' + C.cost + ' من النبض';
    $('#itNote').textContent = note || '';
    if (game.state === 'playing') game.state = 'memory';
    this.show('scrItem'); this.buzz(35);
  },
  gadgetUnlocked(id) {
    this.showItem('gadget', id, Input.isTouch || $('#hud').classList.contains('touch') ? 'استخدمها بزرّها أسفل اليمين.' : 'استخدمها بزر Q، وبدّل القدرات بـ R.');
  },
  areaCard(top, name, sub, boss) {
    const el = $('#areaCard');
    $('#acTop').textContent = top || ''; $('#acName').textContent = name || ''; $('#acSub').textContent = sub || '';
    el.classList.toggle('boss', !!boss);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    if (boss) { Sound.play('over'); this.wDelay = Math.max(this.wDelay, 2.6); }
  },
  buzz(ms) {
    if (!Settings.haptics) return;
    try { if (window.NabdAndroid && window.NabdAndroid.vibrate) window.NabdAndroid.vibrate(ms | 0); else if (navigator.vibrate) navigator.vibrate(ms | 0); } catch (e) { }
  },
  // ---------- الرسائل ----------
  toast(msg) {
    if (!$('#hud').classList.contains('on')) { const s = $('#saveInfo'); s.textContent = msg; clearTimeout(this.noteT); this.noteT = setTimeout(() => this.updateSaveInfo(), 3500); return; }
    const t = $('#toast'); t.textContent = msg; t.classList.add('on'); this.toastT = 2.6;
  },
  // همسات: سطر قصير شفاف أعلى الشاشة لا يحجب اللعب. الأولوية: low ثرثرة، mid مفيدة، high ضرورية
  say(who, text, dur, prio) {
    prio = prio || 'low';
    const lvl = Settings.whispers || 'few';
    if (prio === 'low' && lvl !== 'all') return;
    if (prio === 'mid' && lvl === 'off') return;
    text = this.fill(text);
    if ((this.wCur && this.wCur.text === text) || this.wQ.some(w => w.text === text)) return;
    const w = { who, text, prio, dur: dur ? Math.min(dur, 8) : clamp(2 + text.length * 0.04, 2.6, 7) };
    if (prio === 'high') {
      this.wQ = this.wQ.filter(x => x.prio === 'high'); this.wQ.unshift(w);
      if (this.wCur && this.wCur.prio !== 'high') this.wT = Math.min(this.wT, 0.2);
    } else { this.wQ.push(w); if (this.wQ.length > 2) this.wQ.splice(0, this.wQ.length - 2); }
  },
  tickWhisper(dt) {
    if (this.wDelay > 0) { this.wDelay -= dt; return; }
    const el = $('#whisper');
    if (this.wCur) { this.wT -= dt; if (this.wT <= 0) { this.wCur = null; el.classList.remove('on'); this.wGap = 0.4; } return; }
    if (this.wGap > 0) { this.wGap -= dt; return; }
    const w = this.wQ.shift(); if (!w) return;
    this.wCur = w; this.wT = w.dur;
    el.className = 'on ' + w.who;
    $('#wWho').textContent = { echo: 'صدى', over: 'المُراقِب', sys: '' }[w.who] ?? w.who;
    $('#wTxt').textContent = w.text;
    Sound.play(w.who === 'over' ? 'over' : 'blip');
  },
  // ---------- التحديث الدوري ----------
  tick(dt) {
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('#toast').classList.remove('on'); }
    if ($('#hud').classList.contains('on')) this.tickWhisper(dt);
    if (this.hk && !this.hk.done) this.hackTick(dt);
    this.perfT -= dt;
    if (this.perfT <= 0) { this.perfT = 0.25; this.updatePerf(); }
    if (!$('#hud').classList.contains('on')) return;
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.updateHud(); }
    this.mapT -= dt;
    if (this.mapT <= 0 && Settings.minimap) { this.mapT = 0.25; this.drawMinimap(); }
  },
  applyPerf() {
    const p = $('#perf');
    p.classList.toggle('off', !Settings.stats);
    p.classList.toggle('ext', !!Settings.statsExt);
  },
  applyTouch() {
    const on = Settings.touch === 'on' || (Settings.touch === 'auto' && Input.isTouch);
    $('#hud').classList.toggle('touch', on);
    document.documentElement.style.setProperty('--ts', String(Settings.touchSize || 1));
  },
  applyHudToggles() { $('#hud').classList.toggle('nomap', !Settings.minimap); },
  updatePerf() {
    if (!Settings.stats) return;
    const f = Loop.fps, c = f >= 59 ? 'g' : f >= 30 ? 'y' : 'r';
    $('#pfFps').innerHTML = 'FPS <b class="' + c + '">' + (f >= 100 ? Math.round(f) : f.toFixed(1)) + '</b>';
    $('#pfMs').textContent = Loop.ms.toFixed(Loop.ms < 10 ? 2 : 1) + ' ms';
    $('#pfRes').textContent = R.W + '×' + R.H;
    if (Settings.statsExt) {
      const capO = FPS_OPTIONS.find(o => o.id === Settings.fps), q = QUALITY[Settings.quality];
      const ents = game.enemies ? game.enemies.length : 0;
      $('#pfExt').textContent = ' | CPU ' + Loop.cpu.toFixed(2) + 'ms | أدنى ' + Math.round(Loop.low) + ' | ' + (capO ? capO.label.replace(/ .*/, '') : '') + ' | ' + q.label.replace(/ .*/, '') + ' | كيانات ' + ents + ' | جسيمات ' + FX.list.length + (Loop.hz ? ' | شاشة ' + Loop.hz + 'Hz' : '');
    }
  },
  updateHud() {
    const g = game, p = g.player; if (!p || !g.L) return;
    if (p.hp !== this.lastHp || p.maxHp !== this.lastMax) {
      this.lastHp = p.hp; this.lastMax = p.maxHp;
      let h = ''; for (let i = 0; i < p.maxHp; i++) h += '<i class="' + (i < p.hp ? '' : 'off') + '"></i>';
      $('#hp').innerHTML = h;
    }
    $('#enFill').style.width = (p.energy / p.maxEnergy * 100).toFixed(1) + '%';
    $('#en').classList.toggle('canfocus', p.hp < p.maxHp && p.energy >= g.focusCost());
    const rn = Save.data.rnn;
    if (rn !== this.lastRnn) { const up = rn > this.lastRnn && this.lastRnn >= 0; this.lastRnn = rn; $('#rnnV').textContent = rn; if (up) { const e = $('#rnn'); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); } }
    const gl = g.gadgets(), gid = gl[g.curGadget];
    const gb = $('#tbGadget');
    if (gid) {
      const G = GADGETS[gid], cd = g.gadgetCd[gid] || 0;
      $('#gadgetLbl').textContent = '\u2067' + G.name + '\u2069 · ' + G.cost + ' نبض' + (cd > 0 ? ' · ' + Math.ceil(cd) + 'ث' : '');
      if (gb.dataset.g !== gid) { gb.dataset.g = gid; $('#tbGIcon').innerHTML = ICONS[gid]; $('#tbGName').textContent = G.short || G.name; }
      gb.style.setProperty('--cd', (cd / G.cd).toFixed(3));
      gb.classList.toggle('dim', p.energy < G.cost);
    } else { $('#gadgetLbl').textContent = ''; if (gb.dataset.g !== '') { gb.dataset.g = ''; $('#tbGIcon').innerHTML = ICONS.lock; $('#tbGName').textContent = 'لا قدرة'; } gb.classList.add('dim'); }
    $('#tbCycle').classList.toggle('hidden', gl.length < 2);
    $('#tbDash').style.setProperty('--cd', (p.dashCd / 0.85).toFixed(3));
    $('#tbDash').classList.toggle('dim', p.energy < 12);
    $('#tbEcho').classList.toggle('hidden', !g.echo);
    const it = g.interactTarget, pr = $('#prompt');
    let ptxt = '', pcls = '';
    if (g.state === 'playing' && p.alive) {
      const key = Input.lastDevice === 'keyboard' ? 'E: ' : Input.lastDevice === 'pad' ? 'A: ' : '';
      if (it) ptxt = key + it.label(g) + (it.prog > 0 ? ' ' + Math.round(it.prog * 100) + '%' : '');
      else if (g.strikeTarget) { ptxt = key + 'نقرة صامتة'; pcls = 'strike'; }
      else if (p.focusing) { ptxt = 'تركيز… ' + Math.round(g.focusT / g.focusDur() * 100) + '%'; pcls = 'focus'; }
      else if (p.hp < p.maxHp && p.energy >= g.focusCost() && (Save.data.stats.focus || 0) < 3) { ptxt = (key ? key.replace(':', ' مطوّلاً:') : 'تفاعل مطوّلاً: ') + 'تركيز يرمّم وتراً'; pcls = 'focus'; }
    }
    if (ptxt) { pr.textContent = ptxt; pr.className = 'on ' + pcls; } else pr.className = '';
    const M = g.missions;
    if (M) {
      const parts = [];
      for (const m of M.primary) { if (m.type === 'exit' && !M.exitReady()) continue; parts.push('<div class="' + (m.done ? 'done' : '') + '">' + iso(m.text) + M.progText(m) + '</div>'); }
      for (const s of M.side) parts.push('<div class="side ' + (s.failed ? 'fail' : '') + '">★ ' + iso(s.text) + M.progText(s) + '</div>');
      const sig = parts.join('');
      if (sig !== this.hudSig) { this.hudSig = sig; $('#mtrack').innerHTML = sig; }
    }
    const B = g.boss, bb = $('#bossBar');
    $('#hud').classList.toggle('boss', !!(B && !B.defeated));
    if (B && !B.defeated) {
      bb.classList.add('on');
      const left = B.maxPhase - B.phase + 1;
      let h = ''; for (let i = 0; i < B.maxPhase; i++) h += '<i class="' + (i < left ? '' : 'off') + '"></i>';
      if (bb.dataset.h !== h) { bb.dataset.h = h; $('#bossPips').innerHTML = h; }
      const on = g.L.pylons.filter(p => p.val).length, sh = $('#bossSh');
      sh.textContent = B.shield ? 'الدرع: الأعمدة ' + on + '/' + g.L.pylons.length : 'الدرع ساقط! ' + Math.ceil(B.shieldT) + 'ث';
      sh.classList.toggle('down', !B.shield);
    } else bb.classList.remove('on');
    const D = g.director;
    if (D) {
      $('#thFill').style.width = (D.intensity * 100).toFixed(0) + '%';
      const dy = $('#dyn');
      if (D.dyn) { dy.classList.add('on'); $('#dynTxt').textContent = D.dyn.text; $('#dynBar').style.width = (D.dyn.t / D.dyn.max * 100).toFixed(1) + '%'; }
      else dy.classList.remove('on');
    }
  },
  drawMinimap() {
    const g = game, L = g.L; if (!L) return;
    const c = $('#minimap'), dpr = Math.min(2, window.devicePixelRatio || 1), W = 150, H = 100;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    const s = Math.min((W - 8) / L.w, (H - 8) / L.h), ox = (W - L.w * s) / 2, oy = (H - L.h * s) / 2;
    x.fillStyle = '#2a333d'; x.beginPath();
    for (let i = 0; i < L.N; i++) if (L.explored[i] && L.tile[i] === 0) x.rect(ox + (i % L.w) * s, oy + ((i / L.w) | 0) * s, s + 0.3, s + 0.3);
    x.fill();
    x.fillStyle = '#65717f'; x.beginPath();
    for (let i = 0; i < L.N; i++) if (L.explored[i] && L.tile[i] === 1) x.rect(ox + (i % L.w) * s, oy + ((i / L.w) | 0) * s, s + 0.3, s + 0.3);
    x.fill();
    const dot = (wx, wy, c2, r) => { x.fillStyle = c2; x.beginPath(); x.arc(ox + wx / T * s, oy + wy / T * s, r, 0, TAU); x.fill(); };
    const ex = (o) => L.explored[L.idx(o.tx, o.ty)];
    for (const d of L.doors) if (ex(d)) { x.fillStyle = d.target ? '#4ff0d0' : '#ff5a5a'; x.fillRect(ox + d.tx * s, oy + d.ty * s, s, s); }
    for (const o of L.pickups) if (!o.taken && ex(o)) dot(o.x, o.y, PICKUP_COL[o.kind], 1.6);
    for (const o of L.terminals) if (ex(o)) dot(o.x, o.y, o.val ? '#4ff0d0' : '#36e0ff', 1.8);
    if (L.exit && ex(L.exit)) { x.fillStyle = L.exit.open ? '#4ff0d0' : '#ff6a5a'; x.fillRect(ox + L.exit.tx * s - 1, oy + L.exit.ty * s - 1, s + 2, s + 2); }
    const owl = g.perk('owl') && g.player;
    if (g.scanT > 0 || owl) for (const e of g.enemies) if (e.alive && !e.defeated && (g.scanT > 0 || dist2(e.x, e.y, g.player.x, g.player.y) < (9 * T) ** 2)) dot(e.x, e.y, e.kind === 'swarm' ? '#ff3fa4' : '#ff4545', e.kind === 'swarm' ? 1 : 2);
    if (g.shade && ex({ tx: Math.floor(g.shade.x / T), ty: Math.floor(g.shade.y / T) })) dot(g.shade.x, g.shade.y, '#8a6cff', 2.4);
    for (const c of L.checkpoints) if (ex(c)) dot(c.x, c.y, c.active ? '#4ff0d0' : '#5f8f88', 2);
    if (g.echo) dot(g.echo.x, g.echo.y, '#ffd166', 1.8);
    if (g.player) dot(g.player.x, g.player.y, '#4ff0d0', 2.6);
  },
  // ---------- الإعدادات ----------
  buildSettings() {
    const S = Settings;
    const sel = (key, opts) => '<select data-k="' + key + '">' + opts.map(o => '<option value="' + o.id + '"' + (S[key] === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>';
    const seg = (key, opts) => '<div class="seg" data-k="' + key + '">' + opts.map(o => '<button data-v="' + o.id + '" class="' + (S[key] === o.id ? 'on' : '') + '">' + esc(o.label) + '</button>').join('') + '</div>';
    const tog = key => '<button class="tog ' + (S[key] ? 'on' : '') + '" data-k="' + key + '" role="switch" aria-checked="' + (!!S[key]) + '"></button>';
    const rng = (key, min, max, step) => '<input type="range" data-k="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + S[key] + '">';
    const row = (label, small, ctl) => '<div class="row"><div><label>' + label + '</label>' + (small ? '<small>' + small + '</small>' : '') + '</div>' + ctl + '</div>';
    const qopts = QUALITY_ORDER.map(id => ({ id, label: QUALITY[id].label.replace(/ \(.*/, '') }));
    $('#settingsBody').innerHTML =
      '<div class="sec">الأداء والرسوميات</div>' +
      (S.autoTuned ? '<div class="note">خُفّضت الجودة تلقائياً عند أول تشغيل لأن الإطارات كانت أقل من 30. ارفعها هنا متى شئت.</div>' : '') +
      row('الدقة', 'الدقة الداخلية للرسم. الحالية: <b id="curRes" dir="ltr">' + R.W + '×' + R.H + '</b>', sel('res', RES_OPTIONS)) +
      row('حدّ الفريمات', '«غير محدود» يرسم أسرع ما يستطيع جهازك ويستهلك البطارية أكثر.', sel('fps', FPS_OPTIONS)) +
      row('جودة الرسوميات', 'الظلال الحية وعدد الأشعة والتوهج والجسيمات. «جنونية» تستنزف أقصى طاقة الجهاز.', seg('quality', qopts)) +
      row('مدى الكاميرا', '', seg('zoom', ZOOMS)) +
      row('تنعيم التكبير', 'أطفئه للحصول على بكسلات حادة في الدقات المنخفضة.', tog('smooth')) +
      row('عرض منخفض التأخير', 'يرسم مباشرة على الشاشة متجاوزاً المُركّب (متصفحات Chromium). إن ظهر وميض فأطفئه.', tog('lowLatency')) +
      '<div class="sec">الشاشة</div>' +
      row('عرض الفريمات والدقة', 'العدّاد الصغير أعلى الشاشة.', tog('stats')) +
      row('إحصاءات موسّعة', 'زمن المعالج، أدنى فريمات، عدد الكيانات والجسيمات.', tog('statsExt')) +
      row('الخريطة الصغيرة', '', tog('minimap')) +
      row('عرض تفكير الذكاء الاصطناعي', 'يُظهر حالة كل عدو ومساره وموجات الضجيج.', tog('aiDebug')) +
      row('اهتزاز الشاشة', '', tog('shake')) +
      row('همسات صدى', 'سطر شفاف قصير أعلى الشاشة. «المهمة» تُخفي الثرثرة، و«الضرورية» لا تُبقي إلا التلميحات والتحذيرات.', seg('whispers', [{ id: 'all', label: 'كلها' }, { id: 'few', label: 'المهمة' }, { id: 'off', label: 'الضرورية' }])) +
      '<div class="sec">الصوت والتحكم</div>' +
      row('الموسيقى', '', rng('music', 0, 1, 0.05)) +
      row('المؤثرات', '', rng('sfx', 0, 1, 0.05)) +
      row('أزرار اللمس', '', seg('touch', [{ id: 'auto', label: 'تلقائي' }, { id: 'on', label: 'تشغيل' }, { id: 'off', label: 'إخفاء' }])) +
      row('حجم أزرار اللمس', '', rng('touchSize', 0.75, 1.4, 0.05)) +
      row('اهتزاز الهاتف', 'نبضة خفيفة عند الضرر والضربات والتقاط القدرات.', tog('haptics')) +
      '<div class="sec">نقل التقدّم</div>' +
      '<div class="row"><div><label>رمز التقدّم</label><small>انسخه واحفظه قبل حذف اللعبة أو تثبيت نسخة جديدة، أو لنقل تقدّمك إلى جهاز آخر. ثم الصقه هنا واضغط «استيراد».</small></div><button class="btn" id="btnExport">نسخ الرمز</button></div>' +
      '<textarea id="saveCode" class="code" rows="3" dir="ltr" spellcheck="false" placeholder="NABD1:…"></textarea>' +
      '<div class="row"><div class="note hidden" id="xferMsg"></div><button class="btn" id="btnImport">استيراد</button></div>' +
      '<div class="sec">جهازك</div><div class="dev" id="devInfo"></div>' +
      '<div class="row"><div><label>مسح التقدّم</label><small>يحذف المراحل والنجوم والقدرات والتمائم والرنين.</small></div><button class="btn warn" id="btnReset">مسح</button></div>';
    const body = $('#settingsBody');
    body.querySelectorAll('select').forEach(s => s.addEventListener('change', () => this.setSetting(s.dataset.k, s.value)));
    body.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); this.setSetting(sg.dataset.k, b.dataset.v);
    })));
    body.querySelectorAll('.tog').forEach(t => t.addEventListener('click', () => {
      const v = !Settings[t.dataset.k]; t.classList.toggle('on', v); t.setAttribute('aria-checked', String(v)); this.setSetting(t.dataset.k, v);
    }));
    body.querySelectorAll('input[type=range]').forEach(r => r.addEventListener('input', () => this.setSetting(r.dataset.k, parseFloat(r.value))));
    $('#btnExport').addEventListener('click', () => { Sound.play('ui'); this.exportSave(); });
    $('#btnImport').addEventListener('click', () => { Sound.play('ui'); this.importSave(); });
    const rb = $('#btnReset');
    rb.addEventListener('click', () => {
      if (rb.dataset.armed !== '1') { rb.dataset.armed = '1'; rb.textContent = 'اضغط مجدداً للتأكيد'; setTimeout(() => { rb.dataset.armed = ''; rb.textContent = 'مسح'; }, 3000); return; }
      const keep = Object.assign({}, Settings);
      Save.data = Save.defaults(); Save.data.settings = keep; Settings = keep; Save.persist();
      rb.textContent = 'تم المسح'; this.updateSaveInfo(); game.shade = null; game.applyPerks();
    });
    this.devInfo();
  },
  xferMsg(t) { const m = $('#xferMsg'); if (!m) return; m.textContent = t; m.classList.remove('hidden'); },
  exportSave() {
    const d = Object.assign({}, Save.data); delete d.settings; delete d.settingsAt;
    const code = 'NABD1:' + btoa(unescape(encodeURIComponent(JSON.stringify(d))));
    const ta = $('#saveCode'); ta.value = code;
    let done = false;
    try { if (window.NabdAndroid && window.NabdAndroid.share) { window.NabdAndroid.copy(code); window.NabdAndroid.share(code); done = true; } } catch (e) { }
    if (!done) {
      try { ta.focus(); ta.select(); done = document.execCommand('copy'); } catch (e) { }
      try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(code).catch(() => { }); done = true; } } catch (e) { }
    }
    this.xferMsg(done ? 'نُسخ رمز تقدّمك — احفظه في الملاحظات أو أرسله لنفسك.' : 'انسخ الرمز الظاهر في المربع واحفظه.');
  },
  importSave() {
    const raw = ($('#saveCode').value || '').replace(/\s+/g, '');
    const m = raw.match(/NABD1:([A-Za-z0-9+/=]+)/);
    if (!m) { this.xferMsg('هذا ليس رمز تقدّم صحيحاً.'); return; }
    let o; try { o = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { this.xferMsg('تعذّرت قراءة الرمز — تأكد أنك نسخته كاملاً.'); return; }
    if (!o || typeof o !== 'object') { this.xferMsg('هذا ليس رمز تقدّم صحيحاً.'); return; }
    o.updatedAt = Date.now() + 1; // الاستيراد الصريح يغلب الرنين والتمائم المحمولة الحالية
    Save.merge(o, false); Save.persist(); this.updateSaveInfo(); game.applyPerks();
    this.xferMsg('استُعيد تقدّمك! المراحل المفتوحة: ' + Save.data.unlocked + ' · ◈ ' + Save.data.rnn);
  },
  setSetting(k, v) {
    Settings[k] = v;
    switch (k) {
      case 'res': case 'zoom': case 'smooth': case 'quality': R.resize(); break;
      case 'fps': Loop.setCap(fpsCap()); break;
      case 'stats': case 'statsExt': this.applyPerf(); break;
      case 'music': case 'sfx': Sound.setVolumes(Settings.music, Settings.sfx); break;
      case 'touch': case 'touchSize': this.applyTouch(); break;
      case 'minimap': this.applyHudToggles(); break;
      case 'haptics': if (v) this.buzz(30); break;
      case 'whispers': if (v === 'off' && this.wCur && this.wCur.prio !== 'high') this.wT = 0; break;
      case 'lowLatency': R.makeContext(); break;
    }
    const cr = $('#curRes'); if (cr) cr.textContent = R.W + '×' + R.H;
    this.devInfo();
    Save.settingsChanged();
  },
  devInfo() {
    const el = $('#devInfo'); if (!el) return;
    if (this.gpu === null) {
      this.gpu = 'غير معروف';
      try {
        const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
        if (gl) { const ext = gl.getExtension('WEBGL_debug_renderer_info'); this.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
      } catch (e) { }
    }
    const nat = Math.round(R.cssW * R.dpr) + '×' + Math.round(R.cssH * R.dpr);
    const rows = [
      ['دقة الرسم الحالية', R.W + '×' + R.H + ' (' + (R.W * R.H / 1e6).toFixed(2) + ' ميغابكسل)'],
      ['دقة الشاشة الأصلية', nat + ' @' + R.dpr.toFixed(2) + 'x'],
      ['تردد الشاشة', Loop.hz ? '~' + Loop.hz + ' Hz' : 'جارٍ القياس'],
      ['أنوية المعالج', String(navigator.hardwareConcurrency || '?')],
      ['الذاكرة', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'غير متاح'],
      ['المعالج الرسومي', this.gpu],
      ['الفريمات الآن', Math.round(Loop.fps) + ' FPS'],
    ];
    el.innerHTML = rows.map(r => '<span>' + r[0] + '</span><b>' + esc(r[1]) + '</b>').join('');
  },
  buildLevels() {
    const d = Save.data, star = on => '<span class="' + (on ? 'on' : '') + '">' + ICONS.star + '</span>';
    $('#levelGrid').innerHTML = LEVELS.map((L, i) => {
      const locked = i + 1 > d.unlocked, st = d.stars['L' + (i + 1)] || 0, best = d.best['L' + (i + 1)];
      return '<button class="lv ' + (locked ? 'locked' : '') + '" data-i="' + i + '"' + (locked ? ' disabled' : '') + '>' +
        (locked ? '<span class="lk">' + ICONS.lock + '</span>' : best ? '<span class="best">' + fmtTime(best) + '</span>' : '') +
        '<span class="n">المرحلة ' + (i + 1) + '</span><h3>' + esc(L.name) + '</h3><span class="d">' + esc(L.short) + '</span>' +
        '<span class="st">' + star(st >= 1) + star(st >= 2) + star(st >= 3) + '</span></button>';
    }).join('');
    $$('#levelGrid .lv').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; Sound.play('ui'); this.openBrief(+b.dataset.i); }));
    $('#gadgetsOwned').innerHTML = GADGET_ORDER.map(id => '<span class="gchip ' + (d.gadgets.includes(id) ? '' : 'off') + '"><span>' + ICONS[id] + '</span>' + GADGETS[id].name + '</span>').join('') +
      '<span class="gchip violet"><span>' + CHARM_ICONS.notch + '</span>التمائم ' + d.charms.length + '/' + CHARM_ORDER.length + '</span><span class="gchip mint">◈ ' + d.rnn + '</span>';
  },
  buildHelp() {
    const k = s => '<span class="kbd">' + s + '</span>';
    $('#helpBody').innerHTML =
      '<div><h3>الحكاية</h3><ul><li>أنت «نبض»، آخر جرس صغير ما زال يرنّ في مملكة أسكتتها «العين». رفيقك صدى، وطريقك صاعد عبر ستّ مناطق نحو العرش.</li><li>أكمل مهام كل منطقة (أعلى اليمين) ثم اصعد إلى مِصعد الأجراس. المهام الذهبية ★ تمنحك النجوم.</li><li>«الراوي» يراقب توتّرك وقد يطلق محناً قصيرة بمكافآت.</li></ul></div>' +
      '<div><h3>التحكم</h3><ul><li>اللمس: العصا يساراً للحركة (إمالة خفيفة = مشي صامت)، والأزرار يميناً.</li><li>لوحة المفاتيح: ' + k('WASD') + ' أو الأسهم للحركة، ' + k('Shift') + ' تسلّل، ' + k('E') + ' تفاعل/نقرة (مطوّلاً: تركيز)، ' + k('Space') + ' وثبة، ' + k('Q') + ' قدرة، ' + k('R') + ' تبديل، ' + k('C') + ' صدى، ' + k('H') + ' تلميح، ' + k('M') + ' الخريطة، ' + k('Esc') + ' إيقاف.</li><li>يد التحكم مدعومة: A تفاعل، B وثبة، X قدرة، Y صدى.</li></ul></div>' +
      '<div><h3>الأوتار والنبض والرنين</h3><ul><li>الأوتار (يمين الأعلى) هي حياتك. النبض (الشريط الذهبي) يتجدّد وحده وتصرفه على القدرات والوثبة.</li><li>التركيز: وأنت جريح، اضغط «تفاعل» مطوّلاً حيث لا شيء أمامك فترمّم وتراً مقابل ثلث نبضك تقريباً. لا تتحرك أثناءه.</li><li>الرنين ◈ عملة المملكة: من الأجراس والشظايا المتلألئة والمهام. حين تسقط يبقى «طيفك» حيث سقطت حاملاً رنينك كله — عُد إليه والمسه لتستعيده، وإن سقطت مجدداً قبل ذلك ضاع.</li></ul></div>' +
      '<div><h3>المراسي والتمائم</h3><ul><li>المرسى (الدائرة النعناعية) يحفظ تقدّمك ويرمّمك ويصير نقطة نهوضك. اضغط عليه مرتين لتبديل التمائم.</li><li>التمائم تمنح قدرات صغيرة، ولكل واحدة كلفة من الخانات. تبدأ بثلاث خانات وتزيد مع تقدّمك، ويبيع فانوس خانة إضافية.</li><li>فانوس، بائع التمائم العجوز، ينتظر في بعض المناطق.</li></ul></div>' +
      '<div><h3>التسلّل والنقرة الصامتة</h3><ul><li>مخروط برتقالي = دورية، أصفر = شكّ، أحمر = مطاردة. الضوء يكشفك أسرع والظلام يحميك، والركض يُسمَع.</li><li>اقترب من رقيب لا يطاردك واضغط «تفاعل»: النقرة الصامتة تطفئه 12 ثانية. تكفي لذبابة نحاس، وتربك الصيّاد لحظة.</li><li>الرقباء يتنادون: من يراك ينادي من حوله ليحاصروك.</li></ul></div>' +
      '<div><h3>البوابات المنطقية</h3><ul><li>' + k('AND') + ' يعمل إذا كانت كل المداخل 1 · ' + k('OR') + ' يكفي مدخل واحد · ' + k('NOT') + ' يعكس الإشارة · ' + k('XOR') + ' يعمل إذا اختلف المدخلان.</li><li>تتبّع الأسلاك المضيئة من المفاتيح واللوحات إلى البوابات ثم إلى الأبواب.</li><li>بوابات الحكمة البنفسجية تطرح عليك لغزاً — الخطأ يوقظ الحراس.</li></ul></div>' +
      '<div><h3>القدرات</h3><ul>' + GADGET_ORDER.map(id => '<li><b>' + GADGETS[id].name + ':</b> ' + GADGETS[id].desc + '</li>').join('') + '<li><b>الوثبة:</b> قفزة سريعة تستهلك قليلاً من النبض وتصدر صوتاً.</li></ul></div>' +
      '<div><h3>صدى</h3><ul><li>زر «صدى»: يختار بنفسه مهمة مفيدة — يثبّت لوحة ضغط أو يفتح لوحة شيفرة عادية عن بُعد. اضغطه مجدداً ليعود.</li><li>زر «تلميح»: يحلّ صدى الدائرة التي تعترضك ويرسم لك الطريق (يُفقدك نجمة «دون تلميحات»).</li><li>همساته قصيرة وشفافة أعلى الشاشة، ويمكنك تقليلها من الإعدادات.</li></ul></div>' +
      '<div><h3>الأداء</h3><ul><li>من الإعدادات اختر الدقة (حتى 4K أو تنعيم فائق ×2) وحدّ الفريمات (حتى غير محدود).</li><li>العدّاد أعلى الشاشة يعرض الفريمات وزمن الإطار والدقة الحالية.</li></ul></div>';
  },
  // ---------- التمائم ----------
  usedNotches() { return Save.data.equipped.reduce((s, id) => s + (CHARMS[id] ? CHARMS[id].cost : 0), 0); },
  screenFrom() { for (const id of ['scrPause', 'scrTitle']) if (this.isOn(id)) { this.hide(id); return id; } return null; },
  openCharms(canEquip) {
    this.chEquip = !!canEquip; this.chMsg = ''; this.chSel = null;
    this.chFrom = this.screenFrom();
    if (!this.chFrom && game.state === 'playing') game.state = 'charms';
    this.buildCharms(); this.show('scrCharms');
  },
  closeCharms() {
    this.hide('scrCharms'); game.applyPerks();
    if (this.chFrom) this.show(this.chFrom); else if (game.state === 'charms') game.state = 'playing';
    this.chFrom = null; this.updateSaveInfo();
  },
  buildCharms() {
    const d = Save.data, used = this.usedNotches();
    let nh = ''; for (let i = 0; i < d.notches; i++) nh += '<i class="' + (i < used ? 'on' : '') + '"></i>';
    $('#chNotch').innerHTML = nh;
    $('#chNotchTxt').textContent = used + ' / ' + d.notches;
    $('#chRnn').textContent = d.rnn;
    $('#chMode').textContent = this.chEquip ? 'أنت في مرسى: اختر تميمة ثم احملها أو انزعها.' : 'لتبديل التمائم استرح في مرسى ثم اضغط عليه مجدداً.';
    $('#chGrid').innerHTML = CHARM_ORDER.map(id => {
      const own = d.charms.includes(id), eq = d.equipped.includes(id);
      return '<button class="charm' + (own ? '' : ' unk') + (eq ? ' eq' : '') + (this.chSel === id ? ' sel' : '') + '" data-id="' + id + '" aria-label="' + (own ? esc(CHARMS[id].name) : 'تميمة مجهولة') + '">' +
        '<span class="ic">' + (own ? CHARM_ICONS[id] : '؟') + '</span><span class="pips">' + pips(CHARMS[id].cost) + '</span></button>';
    }).join('');
    $$('#chGrid .charm').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id; Sound.play('ui');
      if (!d.charms.includes(id)) { this.chSel = null; this.chMsg = 'تميمة لم تجدها بعد — بعضها مخبّأ في المناطق، وبعضها عند فانوس.'; this.buildCharms(); return; }
      this.chMsg = ''; this.chSel = this.chSel === id ? null : id; this.buildCharms();
    }));
    const box = $('#chInfo'), id = this.chSel;
    if (id) {
      const C = CHARMS[id], eq = d.equipped.includes(id);
      box.innerHTML = '<div class="ci"><span class="ic">' + CHARM_ICONS[id] + '</span><div><b>' + esc(C.name) + '</b><span class="pips">' + pips(C.cost) + '</span></div></div><p>' + esc(C.desc) + '</p>' +
        (this.chEquip ? '<button class="btn ' + (eq ? '' : 'primary') + '" id="chToggle">' + (eq ? 'انزعها' : 'احملها') + '</button>' : '<p class="sub">' + (eq ? 'محمولة الآن.' : 'غير محمولة.') + '</p>');
      const tb = $('#chToggle'); if (tb) tb.addEventListener('click', () => this.toggleCharm(id));
    } else box.innerHTML = '<p class="sub">' + (d.charms.length ? 'اختر تميمة لترى أثرها.' : 'لم تجد أي تميمة بعد. ابحث عن الوهج البنفسجي في المناطق.') + '</p>';
    if (this.chMsg) box.insertAdjacentHTML('beforeend', '<p class="warnmsg">' + esc(this.chMsg) + '</p>');
  },
  toggleCharm(id) {
    const d = Save.data; if (!this.chEquip || !d.charms.includes(id)) return;
    const i = d.equipped.indexOf(id); this.chMsg = '';
    if (i >= 0) { d.equipped.splice(i, 1); Sound.play('uiBack'); }
    else if (this.usedNotches() + CHARMS[id].cost > d.notches) { this.chMsg = 'لا خانات كافية — انزع تميمة أخرى أولاً.'; Sound.play('hackFail'); }
    else { d.equipped.push(id); Sound.play('chip'); this.buzz(20); }
    Save.persist(); game.applyPerks(); this.buildCharms();
  },
  // ---------- سجلّ الكائنات ----------
  openJournal() {
    this.jFrom = this.screenFrom(); this.jSel = null;
    if (!this.jFrom && game.state === 'playing') game.state = 'charms';
    this.buildJournal(); this.show('scrJournal');
  },
  closeJournal() {
    this.hide('scrJournal');
    if (this.jFrom) this.show(this.jFrom); else if (game.state === 'charms') game.state = 'playing';
    this.jFrom = null;
  },
  buildJournal() {
    const J = Save.data.journal, n = JOURNAL_ORDER.filter(k => J[k]).length;
    $('#jCount').textContent = n + ' / ' + JOURNAL_ORDER.length;
    $('#jList').innerHTML = JOURNAL_ORDER.map(k => {
      const e = JOURNAL[k];
      if (!J[k]) return '<div class="jent unk"><span class="ic">؟</span><div><b>؟؟؟</b><small>لم تلتقِ به بعد.</small></div></div>';
      return '<div class="jent"><span class="ic">' + (JOURNAL_ICONS[k] || '') + '</span><div><b>' + esc(e.name) + '</b><small class="epi">' + esc(e.epi) + '</small><p>' + esc(e.desc) + '</p><p class="tip">' + esc(e.tip) + '</p></div></div>';
    }).join('');
  },
  // ---------- فانوس: الحديث والمتجر ----------
  openTalk(id, lines) {
    const N = NPC_LINES[id];
    this.tk = { id, lines: lines.slice(), i: 0 };
    $('#tkName').textContent = N.name; $('#tkEpi').textContent = N.epi;
    this.showTalkLine(); this.show('scrTalk');
  },
  showTalkLine() {
    const k = this.tk, last = k.i >= k.lines.length - 1;
    $('#tkText').textContent = this.fill(k.lines[k.i]);
    $('#tkMore').classList.toggle('hidden', last);
    $('#tkOpts').classList.toggle('hidden', !last);
  },
  talkNext() {
    const k = this.tk; if (!k || !this.isOn('scrTalk')) return;
    if (k.i < k.lines.length - 1) { k.i++; Sound.play('blip'); this.showTalkLine(); }
  },
  closeTalk() {
    this.hide('scrTalk'); this.hide('scrShop'); this.tk = null;
    if (game.state === 'talk') game.state = 'playing';
  },
  openShop() { this.hide('scrTalk'); this.buildShop(''); this.show('scrShop'); },
  buildShop(msg) {
    const d = Save.data;
    $('#shRnn').textContent = d.rnn;
    $('#shList').innerHTML = SHOP.map((it, i) => {
      const notch = it.id === 'notch', C = notch ? it : CHARMS[it.id];
      const sold = notch ? d.notches >= 7 : d.charms.includes(it.id);
      return '<div class="shi' + (sold ? ' sold' : '') + '"><span class="ic">' + (notch ? CHARM_ICONS.notch : CHARM_ICONS[it.id]) + '</span><div class="shd"><b>' + esc(C.name) +
        (notch ? '' : ' <span class="pips">' + pips(C.cost) + '</span>') + '</b><small>' + esc(C.desc) + '</small></div>' +
        (sold ? '<span class="tagsold">مُقتنى</span>' : '<button class="btn buy' + (d.rnn < it.price ? ' poor' : '') + '" data-i="' + i + '">◈ ' + it.price + '</button>') + '</div>';
    }).join('');
    $('#shMsg').textContent = msg || 'اختر ما يعجبك يا صغيري.';
    $$('#shList .buy').forEach(b => b.addEventListener('click', () => this.buy(+b.dataset.i)));
  },
  buy(i) {
    const it = SHOP[i], d = Save.data, N = NPC_LINES.fanous;
    if (!it) return;
    if (d.rnn < it.price) { Sound.play('hackFail'); this.buildShop(N.poor); return; }
    d.rnn -= it.price;
    if (it.id === 'notch') d.notches = Math.min(7, d.notches + 1);
    else if (!d.charms.includes(it.id)) d.charms.push(it.id);
    Save.persist(); Sound.play('chip'); this.buzz(25);
    this.buildShop(N.bought + (it.id === 'notch' ? ' (خاناتك الآن ' + d.notches + ')' : ' احملها من أي مرسى.'));
  },
  // ---------- لعبة الاختراق ----------
  openHack(term, cb) {
    const n = clamp(term.size, 3, 6), h = genHack(n);
    h.left = h.time = term.time; h.done = false; this.hk = h; this.hkCb = cb;
    $('#hkName').textContent = term.name;
    const grid = $('#hkGrid'); grid.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
    let html = '';
    for (let i = 0; i < n * n; i++) html += '<button class="hk" data-i="' + i + '" aria-label="قطعة">' + tileSvg(h.base[i]) + '</button>';
    grid.innerHTML = html;
    $('#hkSrc').innerHTML = '<i style="top:' + ((h.sy + 0.5) / n * 100) + '%">▶</i>';
    $('#hkDst').innerHTML = '<i style="top:' + ((h.ty + 0.5) / n * 100) + '%">▶</i>';
    grid.querySelectorAll('.hk').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); this.hackTap(+b.dataset.i, b); }));
    $('.card.hack').classList.remove('win', 'fail');
    this.hackRefresh();
    this.show('scrHack');
  },
  hackTap(i, b) {
    const h = this.hk; if (!h || h.done) return;
    h.r[i]++; h.mask[i] = h.rot(h.mask[i]);
    b.firstChild.style.transform = 'rotate(' + (h.r[i] * 90) + 'deg)';
    Sound.play('rotate');
    if (this.hackRefresh()) {
      h.done = true; $('.card.hack').classList.add('win'); Sound.play('hackOk');
      setTimeout(() => this.finishHack(true), 420);
    }
  },
  hackRefresh() {
    const h = this.hk, r = hackPowered(h);
    $$('#hkGrid .hk').forEach((b, i) => { b.classList.toggle('pw', !!r.pw[i]); b.style.color = r.pw[i] ? '#4ff0d0' : '#56656f'; });
    return r.win;
  },
  hackTick(dt) {
    const h = this.hk;
    h.left -= dt;
    $('#hkBar').style.width = clamp(h.left / h.time * 100, 0, 100).toFixed(1) + '%';
    if (h.left <= 0) this.endHack(false);
  },
  endHack(ok) {
    const h = this.hk; if (!h || h.done) return;
    h.done = true;
    if (!ok) $('.card.hack').classList.add('fail');
    this.finishHack(ok);
  },
  finishHack(ok) { this.hide('scrHack'); this.hk = null; const cb = this.hkCb; this.hkCb = null; if (cb) cb(ok); },
  abortHack() { if (this.hk && !this.hk.done) this.endHack(false); },
  // ---------- الألغاز ----------
  openRiddle(r, cb) {
    this.rdCb = cb;
    $('#rdQ').textContent = r.q;
    const opts = shuffle(r.o.map((t, i) => ({ t, ok: i === 0 })));
    const box = $('#rdOpts');
    box.innerHTML = opts.map((o, i) => '<button class="btn" data-i="' + i + '">' + esc(o.t) + '</button>').join('');
    $('#rdMsg').textContent = 'إجابة خاطئة تُطلق الإنذار.';
    box.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => {
      const o = opts[+b.dataset.i];
      box.querySelectorAll('.btn').forEach(x => { x.disabled = true; if (opts[+x.dataset.i].ok) x.classList.add('right'); });
      if (!o.ok) b.classList.add('wrong');
      $('#rdMsg').textContent = o.ok ? 'صحيح! البوابة تُفتح…' : 'خطأ! الإنذار ينطلق…';
      Sound.play(o.ok ? 'hackOk' : 'hackFail');
      setTimeout(() => { this.hide('scrRiddle'); const cb2 = this.rdCb; this.rdCb = null; if (cb2) cb2(o.ok); }, o.ok ? 850 : 1300);
    }));
    this.show('scrRiddle');
  },
};
function fpsCap() { return (FPS_OPTIONS.find(o => o.id === Settings.fps) || FPS_OPTIONS[0]).v; }
