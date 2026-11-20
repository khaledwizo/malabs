// لقطات للسلاح في اليد: ورك وتصويب لعدة أسلحة
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
await p.addInitScript(() => { localStorage.setItem('rafidain.settings.v1', JSON.stringify({ fps: 0, quality: 'low' })); });
const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForTimeout(1500);
await p.evaluate(() => { const U = window.__R.UI; U.setup.size = 1; U.startMatch(); });
await p.waitForTimeout(500);
const cases = (process.argv[2] || 'saif556:dot,saqr:x8,rafid:iron,nisr:iron,khanjar:').split(',');
let i = 0;
for (const c of cases) {
  const [w, sc] = c.split(':');
  await p.evaluate(([w, sc]) => { const g = window.__R.game, s = g.sim, me = g.mp; s.phase = 'live'; s.phaseT = 99; for (const q of s.players.values()) if (q !== me) { q.alive = false; } me.pos = [0, 0.05, 10]; me.yaw = 0; g.yaw = 0; g.pitch = 0.02;
    if (w === 'khanjar') { me.slot = 3; } else if (['dijla', 'nisr', 'zaeem'].includes(w)) { me.inv[2] = { id: w, mag: 7, reserve: 30 }; me.slot = 2; } else { me.inv[1] = { id: w, mag: 30, reserve: 90 }; me.scope = sc; me.slot = 1; }
    me.switchT = 0; g.vm.drawT = 1; }, [w, sc]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `test/shots/vm_${i}_hip.png` });
  await p.evaluate(() => window.__R.Input.down.add('ads'));
  await p.waitForTimeout(900);
  await p.screenshot({ path: `test/shots/vm_${i}_ads.png` });
  await p.evaluate(() => window.__R.Input.down.delete('ads'));
  i++;
}
console.log('errors', errs.length, errs.slice(0, 3).join('\n'));
await b.close();
