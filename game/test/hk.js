// اختبار أنظمة «مملكة الأجراس»: الهمسات، المراسي، الألواح، التمائم، التركيز، النقرة، الطيف، السجلّ، فانوس، زر الرجوع
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const shots = path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!c) fails++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('ERROR: ' + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(1200);
  const snap = n => page.screenshot({ path: path.join(shots, n + '.png') });
  // مساعدات داخل الصفحة
  await page.evaluate(() => {
    const N = window.__nabd;
    window.T_ = {
      find: type => N.game.L.objects.filter(o => o.type === type),
      // ضع اللاعب بجانب كائن ووجّهه نحوه
      near(o) {
        const g = N.game, L = g.L, T = 32;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
          const X = o.tx + dx, Y = o.ty + dy;
          if (!L.inb(X, Y) || L.move[L.idx(X, Y)]) continue;
          g.player.x = (X + 0.5) * T; g.player.y = (Y + 0.5) * T; g.player.vx = g.player.vy = 0;
          g.player.face = Math.atan2(o.y - g.player.y, o.x - g.player.x); return true;
        }
        return false;
      },
      on: id => document.getElementById(id).classList.contains('on'),
    };
  });
  const press = async (k, ms = 250) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };

  // ---------- 1) المرحلة الأولى + الهمسات ----------
  await page.evaluate(() => { const N = window.__nabd; N.Save.data = N.Save.defaults(); N.UI.openBrief(0); N.UI.startPlay(); });
  await page.waitForTimeout(600);
  await snap('h01_areacard');
  const w0 = await page.evaluate(() => { const U = window.__nabd.UI; return { q: U.wQ.length, delay: U.wDelay > 0, card: document.getElementById('areaCard').classList.contains('show') }; });
  ok(w0.card && w0.delay && w0.q === 1, 'area card shows and intro whisper waits for it', w0);
  await page.evaluate(() => { const g = window.__nabd.game; g.say('echo', 'ثرثرة منخفضة'); });
  const w1 = await page.evaluate(() => window.__nabd.UI.wQ.map(w => w.text));
  ok(!w1.includes('ثرثرة منخفضة'), 'low-priority whisper filtered with setting "few"', w1);
  await page.waitForTimeout(3600);
  const w2 = await page.evaluate(() => ({ on: document.getElementById('whisper').classList.contains('on'), txt: document.getElementById('wTxt').textContent.slice(0, 30) }));
  ok(w2.on, 'intro whisper visible after card', w2);
  await snap('h02_whisper');

  // ---------- 2) لوح منقوش ----------
  const tb = await page.evaluate(() => { const t = T_.find('tablet').find(o => !o.mem && o.tx === 4 && o.ty === 4); return t ? T_.near(t) : false; });
  ok(tb, 'placed near first tablet');
  await page.waitForTimeout(150);
  await press('KeyE', 400);
  const t1 = await page.evaluate(() => ({ on: T_.on('scrMemory'), txt: document.getElementById('memText').textContent, who: document.getElementById('memWho').textContent, st: window.__nabd.game.state }));
  ok(t1.on && t1.st === 'memory' && !/\{move\}|\{use\}/.test(t1.txt), 'tablet opens with filled text', t1);
  await snap('h03_tablet');
  await page.click('#memOk'); await page.waitForTimeout(200);

  // ---------- 3) التميمة ----------
  await page.evaluate(() => { const c = T_.find('charm')[0]; const g = window.__nabd.game; g.player.x = c.x; g.player.y = c.y; });
  await page.waitForTimeout(400);
  const c1 = await page.evaluate(() => { const d = window.__nabd.Save.data; return { item: T_.on('scrItem'), charms: d.charms.slice(), eq: d.equipped.slice() }; });
  ok(c1.item && c1.charms.includes('feather') && c1.eq.includes('feather'), 'charm picked + auto-equipped + item card', c1);
  await snap('h04_charm_item');
  await page.click('#itOk'); await page.waitForTimeout(200);

  // ---------- 4) المرسى ----------
  const dk = await page.evaluate(() => { const d = T_.find('checkpoint')[0]; return T_.near(d); });
  ok(dk, 'placed near dock');
  await page.evaluate(() => { const g = window.__nabd.game; g.player.hp = 2; });
  await page.waitForTimeout(150);
  await press('KeyE', 400);
  const r1 = await page.evaluate(() => { const g = window.__nabd.game, d = T_.find('checkpoint')[0]; return { hp: g.player.hp, max: g.player.maxHp, cp: g.checkpoint.x === d.x && g.checkpoint.y === d.y, rested: d.rested }; });
  ok(r1.hp === r1.max && r1.cp && r1.rested, 'rest at dock heals and sets respawn', r1);
  await press('KeyE', 400);
  const r2 = await page.evaluate(() => ({ on: T_.on('scrCharms'), st: window.__nabd.game.state, n: document.querySelectorAll('#chGrid .charm').length, mode: document.getElementById('chMode').textContent }));
  ok(r2.on && r2.st === 'charms' && r2.n === 10, 'second press opens charms (equip mode)', r2);
  await page.click('#chGrid .charm[data-id="feather"]'); await page.waitForTimeout(150);
  await snap('h05_charms');
  await page.click('#chToggle'); await page.waitForTimeout(150);
  const r3 = await page.evaluate(() => window.__nabd.Save.data.equipped.slice());
  ok(!r3.includes('feather'), 'unequip works', r3);
  await page.click('#chToggle'); await page.waitForTimeout(150);
  await page.click('#chClose'); await page.waitForTimeout(150);
  const r4 = await page.evaluate(() => ({ st: window.__nabd.game.state, eq: window.__nabd.Save.data.equipped.slice() }));
  ok(r4.st === 'playing' && r4.eq.includes('feather'), 'close charms resumes play', r4);

  // ---------- 5) التركيز ----------
  await page.evaluate(() => { const g = window.__nabd.game, L = g.L; g.player.x = 4.5 * 32; g.player.y = 2.5 * 32; g.player.hp = 2; g.player.energy = 100; g.player.face = Math.PI / 2; });
  await page.waitForTimeout(250);
  const f0 = await page.evaluate(() => ({ it: !!window.__nabd.game.interactTarget, prompt: document.getElementById('prompt').textContent }));
  await page.keyboard.down('KeyE'); await page.waitForTimeout(600);
  await snap('h06_focus');
  await page.waitForTimeout(900); await page.keyboard.up('KeyE');
  const f1 = await page.evaluate(() => { const g = window.__nabd.game; return { hp: g.player.hp, en: Math.round(g.player.energy) }; });
  ok(!f0.it && f1.hp === 3 && f1.en < 90, 'focus heals one string for energy', { f0, f1 });

  // ---------- 6) النقرة الصامتة ----------
  const s1 = await page.evaluate(async () => {
    const g = window.__nabd.game, d = g.enemies.find(e => e.kind === 'drone');
    d.stunT = 0; d.setState && d.setState('patrol');
    // خلفه مباشرة
    const bx = d.x - Math.cos(d.face) * 30, by = d.y - Math.sin(d.face) * 30;
    g.player.x = bx; g.player.y = by; g.player.face = d.face; g.player.cloak = 1;
    await new Promise(r => setTimeout(r, 120));
    return { tgt: g.strikeTarget === d, prompt: document.getElementById('prompt').textContent, rnn: window.__nabd.Save.data.rnn };
  });
  ok(s1.tgt && /نقرة/.test(s1.prompt), 'strike target acquired from behind', s1);
  await snap('h07_strike');
  await page.evaluate(async () => {
    const g = window.__nabd.game, d = g.enemies.find(e => e.kind === 'drone');
    g.player.x = d.x - Math.cos(d.face) * 30; g.player.y = d.y - Math.sin(d.face) * 30; g.player.face = d.face;
    await new Promise(r => setTimeout(r, 60));
  });
  await press('KeyE', 250);
  const s2 = await page.evaluate(() => { const g = window.__nabd.game, d = g.enemies.find(e => e.kind === 'drone'); return { stun: +d.stunT.toFixed(1), rnn: window.__nabd.Save.data.rnn, j: !!window.__nabd.Save.data.journal.drone }; });
  ok(s2.stun > 10 && s2.rnn >= s1.rnn + 8, 'strike stuns drone and grants rnn', s2);
  ok(s2.j, 'journal recorded the drone');

  // ---------- 7) السقوط والطيف ----------
  await page.evaluate(() => { const N = window.__nabd; N.Save.data.rnn = 57; N.game.player.cloak = 0; N.game.player.x = 12.5 * 32; N.game.player.y = 3.5 * 32; N.game.playerDie('laser'); });
  await page.waitForTimeout(1700);
  const d1 = await page.evaluate(() => { const g = window.__nabd.game, d = window.__nabd.Save.data; return { st: g.state, shade: g.shade && g.shade.amt, saved: d.shade && d.shade.amt, rnn: d.rnn, txt: document.getElementById('deadShade').textContent }; });
  ok(d1.st === 'dead' && d1.shade === 57 && d1.saved === 57 && d1.rnn === 0 && /57/.test(d1.txt), 'death leaves shade with rnn', d1);
  await snap('h08_dead');
  await page.click('#dRespawn'); await page.waitForTimeout(300);
  await page.evaluate(() => { const g = window.__nabd.game; g.player.x = g.shade.x + 40; g.player.y = g.shade.y; });
  await page.waitForTimeout(300);
  await snap('h09_shade');
  await page.evaluate(() => { const g = window.__nabd.game; g.player.x = g.shade.x; g.player.y = g.shade.y; });
  await page.waitForTimeout(300);
  const d2 = await page.evaluate(() => { const g = window.__nabd.game, d = window.__nabd.Save.data; return { shade: !!g.shade, saved: d.shade, rnn: d.rnn, j: !!d.journal.shade }; });
  ok(!d2.shade && !d2.saved && d2.rnn === 57 && d2.j, 'touching shade recovers rnn', d2);

  // ---------- 8) فانوس والمتجر ----------
  await page.evaluate(() => { const N = window.__nabd; N.UI.openBrief(1); N.UI.startPlay(); });
  await page.waitForTimeout(300);
  const n0 = await page.evaluate(() => { const n = T_.find('npc')[0]; return n ? T_.near(n) : false; });
  ok(n0, 'placed near Fanous');
  await page.waitForTimeout(200);
  await press('KeyE', 300);
  const n1 = await page.evaluate(() => ({ on: T_.on('scrTalk'), st: window.__nabd.game.state, name: document.getElementById('tkName').textContent, more: !document.getElementById('tkMore').classList.contains('hidden') }));
  ok(n1.on && n1.st === 'talk' && n1.name === 'فانوس' && n1.more, 'talk opens with first lines', n1);
  await snap('h10_talk');
  await page.click('#tkBox'); await page.waitForTimeout(200);
  const n2 = await page.evaluate(() => !document.getElementById('tkOpts').classList.contains('hidden'));
  ok(n2, 'options shown at last line');
  await page.evaluate(() => { window.__nabd.Save.data.rnn = 500; });
  await page.click('#tkShop'); await page.waitForTimeout(200);
  await snap('h11_shop');
  await page.click('#shList .buy[data-i="0"]'); await page.waitForTimeout(200);
  const n3 = await page.evaluate(() => { const d = window.__nabd.Save.data; return { rnn: d.rnn, heart: d.charms.includes('heart'), msg: document.getElementById('shMsg').textContent }; });
  ok(n3.heart && n3.rnn === 320, 'bought heart charm', n3);
  await page.click('#shList .buy[data-i="5"]'); await page.waitForTimeout(200);
  const n4 = await page.evaluate(() => ({ notches: window.__nabd.Save.data.notches, rnn: window.__nabd.Save.data.rnn }));
  ok(n4.notches === 4 && n4.rnn === 80, 'bought a notch', n4);
  await page.click('#shList .buy[data-i="1"]'); await page.waitForTimeout(200);
  const n5 = await page.evaluate(() => ({ rnn: window.__nabd.Save.data.rnn, pulse: window.__nabd.Save.data.charms.includes('pulse'), msg: document.getElementById('shMsg').textContent }));
  ok(!n5.pulse && n5.rnn === 80, 'cannot buy when poor', n5);
  await page.click('#shClose'); await page.waitForTimeout(200);
  ok(await page.evaluate(() => window.__nabd.game.state === 'playing'), 'shop close resumes play');
  // تكلّم مجدداً: سطر واحد
  await press('KeyE', 300);
  const n6 = await page.evaluate(() => ({ on: T_.on('scrTalk'), opts: !document.getElementById('tkOpts').classList.contains('hidden') }));
  ok(n6.on && n6.opts, 'second talk is a single line with options', n6);
  await page.click('#tkBye'); await page.waitForTimeout(150);

  // ---------- 9) حمل القلب: وتر إضافي ----------
  await page.evaluate(() => { const N = window.__nabd; N.UI.openCharms(true); });
  await page.click('#chGrid .charm[data-id="heart"]'); await page.waitForTimeout(100);
  await page.click('#chToggle'); await page.waitForTimeout(100);
  await page.click('#chClose'); await page.waitForTimeout(150);
  const h1 = await page.evaluate(() => ({ max: window.__nabd.game.player.maxHp, eq: window.__nabd.Save.data.equipped.slice(), pips: document.querySelectorAll('#hp i').length }));
  ok(h1.max === 5 && h1.eq.includes('heart'), 'heart charm gives 5 strings', h1);

  // ---------- 10) زر الرجوع ----------
  const b1 = await page.evaluate(() => { const r = window.__nabdBack(); return { r, st: window.__nabd.game.state }; });
  ok(b1.r && b1.st === 'paused', 'back pauses while playing', b1);
  await page.click('#psJournal'); await page.waitForTimeout(200);
  await snap('h12_journal');
  const b2 = await page.evaluate(() => { const r = window.__nabdBack(); return { r, pause: T_.on('scrPause'), j: T_.on('scrJournal') }; });
  ok(b2.r && b2.pause && !b2.j, 'back closes journal to pause', b2);
  await page.evaluate(() => window.__nabdBack());
  ok(await page.evaluate(() => window.__nabd.game.state === 'playing'), 'back from pause resumes');
  await page.evaluate(() => window.__nabd.UI.toMenu());
  await page.waitForTimeout(300);
  const b3 = await page.evaluate(() => window.__nabdBack());
  ok(b3 === false, 'back on title lets Android exit', b3);
  await snap('h13_title');

  // ---------- 11) الحفظ والدمج ----------
  const m1 = await page.evaluate(() => {
    const S = window.__nabd.Save, keep = JSON.parse(JSON.stringify(S.data));
    S.data = S.defaults();
    S.merge(keep, true);
    const a = { rnn: S.data.rnn, charms: S.data.charms.length, eq: S.data.equipped.slice(), notches: S.data.notches, j: Object.keys(S.data.journal).length };
    // نسخة سحابية أقدم لا تغلب الرنين المحلي
    S.merge({ rnn: 9999, updatedAt: 1, equipped: ['bell'] }, false);
    return { a, rnn2: S.data.rnn, eq2: S.data.equipped.slice() };
  });
  ok(m1.a.charms >= 2 && m1.a.notches === 4 && m1.rnn2 === m1.a.rnn && m1.eq2.join() === m1.a.eq.join(), 'save merge keeps new fields; older cloud loses', m1);

  // ---------- 12) الإعدادات ----------
  await page.evaluate(() => { window.__nabd.UI.buildSettings(); window.__nabd.UI.open('scrSettings', 'scrTitle'); });
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ wh: !!document.querySelector('.seg[data-k="whispers"]'), hp: !!document.querySelector('.tog[data-k="haptics"]') }));
  ok(st.wh && st.hp, 'settings have whispers + haptics', st);
  await page.click('.seg[data-k="whispers"] button[data-v="off"]');
  const st2 = await page.evaluate(() => { const g = window.__nabd.game; window.__nabd.UI.wQ = []; window.__nabd.UI.say('echo', 'متوسطة', 0, 'mid'); window.__nabd.UI.say('echo', 'ضرورية', 0, 'high'); return window.__nabd.UI.wQ.map(w => w.text); });
  ok(st2.length === 1 && st2[0] === 'ضرورية', 'whispers "off" keeps only high', st2);
  await page.click('.seg[data-k="whispers"] button[data-v="few"]');
  await snap('h14_settings');

  console.log('\nERRORS (' + errors.length + '):'); errors.forEach(e => console.log(' - ' + e));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})().catch(e => { console.error('TEST CRASH', e); process.exit(2); });
