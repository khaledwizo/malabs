// اختبار آلي: يشغّل اللعبة في Chrome بلا واجهة، يلتقط صوراً ويجمع الأخطاء
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const shots = path.join(__dirname, 'shots');
fs.mkdirSync(shots, { recursive: true });
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
const which = process.argv[2] || 'all';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  const mk = async (opts) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type().toUpperCase() + ': ' + m.text()); });
    await page.goto(url);
    await page.waitForTimeout(1500);
    return page;
  };
  const snap = async (page, name) => { await page.screenshot({ path: path.join(shots, name + '.png') }); };

  if (which === 'all' || which === 'desktop') {
    const page = await mk({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await snap(page, '01_title');
    const perf = await page.evaluate(() => ({ fps: window.__nabd.Loop.fps, res: window.__nabd.R.W + 'x' + window.__nabd.R.H, txt: document.querySelector('#perf').textContent }));
    console.log('PERF title:', JSON.stringify(perf));
    await page.click('#btnPlay');
    await page.waitForTimeout(600);
    await snap(page, '02_brief');
    await page.click('#brGo');
    await page.waitForTimeout(1500);
    await snap(page, '03_play_start');
    // حركة بالكيبورد
    await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD');
    await page.keyboard.down('KeyS'); await page.waitForTimeout(500); await page.keyboard.up('KeyS');
    await page.waitForTimeout(300);
    await snap(page, '04_moved');
    const st = await page.evaluate(() => { const g = window.__nabd.game; return { state: g.state, px: g.player.x | 0, py: g.player.y | 0, it: g.interactTarget && g.interactTarget.type, fps: Math.round(window.__nabd.Loop.fps), perf: document.querySelector('#perf').textContent }; });
    console.log('STATE after move:', JSON.stringify(st));
    // اذهب للمفتاح A وتفاعل
    await page.evaluate(() => { const g = window.__nabd.game; g.player.x = 6.5 * 32; g.player.y = 5.5 * 32; g.player.face = 0; });
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(800);
    const d1 = await page.evaluate(() => { const g = window.__nabd.game; return { A: g.L.nodeVal('A'), door: g.L.doors[0].open.toFixed(2), it: g.interactTarget && g.interactTarget.type }; });
    console.log('after switch A:', JSON.stringify(d1));
    await snap(page, '05_switchA');
    // تلميح
    await page.keyboard.press('KeyH');
    await page.waitForTimeout(900);
    await snap(page, '06_hint');
    const hint = await page.evaluate(() => window.__nabd.game.hint && window.__nabd.game.hint.text);
    console.log('HINT:', hint);
    // القاعة مع الحارس
    await page.evaluate(() => { const g = window.__nabd.game; g.player.x = 31.5 * 32; g.player.y = 6.5 * 32; });
    await page.waitForTimeout(2500);
    await snap(page, '07_hall');
    const dr = await page.evaluate(() => window.__nabd.game.enemies.map(e => e.kind + ':' + e.state + ':' + e.sus.toFixed(2)));
    console.log('ENEMIES:', dr.join(' '));
    // الماسح
    await page.evaluate(() => { const g = window.__nabd.game; g.player.x = 36.5 * 32; g.player.y = 7.5 * 32; });
    await page.waitForTimeout(500);
    await snap(page, '08a_item');
    console.log('ITEM screen on:', await page.isVisible('#itOk'));
    if (await page.isVisible('#itOk')) await page.click('#itOk');
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(700);
    await snap(page, '08_scan');
    // اختراق
    await page.evaluate(() => { const g = window.__nabd.game; g.player.x = 21.5 * 32; g.player.y = 15.5 * 32; g.player.face = Math.PI; });
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
    await snap(page, '09_hack');
    await page.click('#hkQuit');
    await page.waitForTimeout(500);
    // إعدادات
    await page.evaluate(() => window.__nabd.game.pause());
    await page.waitForTimeout(300);
    await snap(page, '10_pause');
    await page.click('#psSettings');
    await page.waitForTimeout(400);
    await snap(page, '11_settings');
    // غيّر الدقة إلى 720p و FPS إلى 60
    await page.selectOption('select[data-k="res"]', 'p720');
    await page.selectOption('select[data-k="fps"]', 'f60');
    await page.waitForTimeout(1500);
    const p2 = await page.evaluate(() => ({ res: window.__nabd.R.W + 'x' + window.__nabd.R.H, fps: window.__nabd.Loop.fps.toFixed(1), txt: document.querySelector('#perf').textContent }));
    console.log('PERF 720p/60:', JSON.stringify(p2));
    await page.selectOption('select[data-k="res"]', 'native');
    await page.selectOption('select[data-k="fps"]', 'unl');
    await page.waitForTimeout(1500);
    const p3 = await page.evaluate(() => ({ res: window.__nabd.R.W + 'x' + window.__nabd.R.H, fps: window.__nabd.Loop.fps.toFixed(1), txt: document.querySelector('#perf').textContent }));
    console.log('PERF native/unl:', JSON.stringify(p3));
    await page.close();
  }

  if (which === 'all' || which === 'levels') {
    const page = await mk({ viewport: { width: 1280, height: 720 } });
    for (let i = 0; i < 6; i++) {
      const r = await page.evaluate(async (i) => {
        const N = window.__nabd, g = N.game;
        N.UI.openBrief(i); N.UI.startPlay();
        await new Promise(r => setTimeout(r, 1200));
        const out = { level: i, w: g.L.w, h: g.L.h, enemies: g.enemies.map(e => e.kind).join(','), state: g.state, doors: g.L.doors.length, wires: g.L.wires.length };
        const h = window.__nabd.game; h.showHint(); out.hint = h.hint.text;
        return out;
      }, i);
      console.log('LEVEL', JSON.stringify(r));
      await page.waitForTimeout(600);
      await snap(page, '20_level' + (i + 1));
    }
    await page.close();
  }

  if (which === 'all' || which === 'mobile') {
    const page = await mk({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await snap(page, '30_m_title');
    await page.tap('#btnPlay');
    await page.waitForTimeout(500);
    await page.tap('#brGo');
    await page.waitForTimeout(1500);
    await snap(page, '31_m_play');
    const p = await page.evaluate(() => ({ res: window.__nabd.R.W + 'x' + window.__nabd.R.H, fps: Math.round(window.__nabd.Loop.fps), touch: document.querySelector('#hud').className }));
    console.log('MOBILE:', JSON.stringify(p));
    await page.close();
  }

  await browser.close();
  console.log('\nERRORS (' + errors.length + '):');
  for (const e of [...new Set(errors)].slice(0, 40)) console.log(' - ' + e);
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
