const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto(url); await page.waitForTimeout(800);
  await page.evaluate(() => { const N = window.__nabd; N.UI.openBrief(0); N.UI.startPlay(); N.game.player.x = 36.5*32; N.game.player.y = 7*32; });
  for (const cfg of [['high','native'],['low','native'],['high','p360'],['insane','native'],['medium','native']]) {
    const r = await page.evaluate(async (cfg) => {
      const N = window.__nabd; N.UI.setSetting('quality', cfg[0]); N.UI.setSetting('res', cfg[1]);
      await new Promise(r => setTimeout(r, 2500));
      // time JS-only parts
      const g = N.game; let t0 = performance.now(); for (let i = 0; i < 50; i++) g.step(1/240); const upd = (performance.now() - t0) / 50;
      t0 = performance.now(); for (let i = 0; i < 20; i++) g.render(); const ren = (performance.now() - t0) / 20;
      return { cfg: cfg.join('/'), res: N.R.W + 'x' + N.R.H, fps: N.Loop.fps.toFixed(1), cpu: N.Loop.cpu.toFixed(2), updMs: upd.toFixed(3), renderCallMs: ren.toFixed(2) };
    }, cfg);
    console.log(JSON.stringify(r));
  }
  await browser.close();
})();
