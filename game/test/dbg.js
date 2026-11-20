const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 560 } })).newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto(url); await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const N = window.__nabd, g = N.game; N.UI.openBrief(3); N.UI.startPlay();
    const evs = []; const orig = g.event.bind(g); g.event = (n, d) => { if (n !== 'plate' && n !== 'switch') evs.push(n + (d && d.kind ? ':' + d.kind : '')); return orig(n, d); };
    await new Promise(r => setTimeout(r, 2500));
    const T = 32; g.player.x = 13.5*T; g.player.y = 15.5*T;
    const log = [];
    for (let i = 0; i < 15; i++) { await new Promise(r => setTimeout(r, 200)); log.push(g.enemies.filter(e => e.kind === 'swarm').map(e => e.state[0] + (e.alive ? '' : 'X')).join('') + '|hp' + g.player.hp); }
    return { log, evs: evs.join(','), kills: g.missions.c.swarmKill, side: JSON.stringify(g.missions.side.map(s => [s.type, s.prog, s.need])) };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
