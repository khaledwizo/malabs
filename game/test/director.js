const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(url); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const N = window.__nabd, g = N.game; N.UI.openBrief(1); N.UI.startPlay();
    await new Promise(r => setTimeout(r, 300));
    g.player.x = 20 * 32; g.player.y = 13 * 32; await new Promise(r => setTimeout(r, 200));
    const D = g.director, out = {};
    D.start('surge'); out.surge = D.dyn && D.dyn.kind; const pk = D.dyn && D.dyn.obj;
    await new Promise(r => setTimeout(r, 300));
    out.banner = document.querySelector('#dyn').classList.contains('on');
    g.player.x = pk.x; g.player.y = pk.y; await new Promise(r => setTimeout(r, 300));
    out.afterCollect = D.dyn ? 'active' : 'done'; out.dynDone = g.dynDone;
    // hide mission via detection
    D.dynCd = 0; const dr = g.enemies.find(e => e.kind === 'drone'); g.player.x = dr.x + 40; g.player.y = dr.y; dr.face = 0;
    await new Promise(r => setTimeout(r, 1500));
    out.detected = g.missions.c.detected; out.dyn2 = D.dyn && D.dyn.kind;
    // boss wires
    N.UI.openBrief(5); N.UI.startPlay(); await new Promise(r => setTimeout(r, 300));
    out.bossWires = g.L.wires.length;
    return out;
  });
  console.log(JSON.stringify(r)); console.log('ERRS', errs);
  await page.evaluate(() => { const g = window.__nabd.game; g.player.x = 10 * 32; g.player.y = 12 * 32; window.__nabd.UI.setSetting('zoom', 'far'); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, 'shots', '70_boss_far.png') });
  await browser.close();
})();
