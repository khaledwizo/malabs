// لقطات للخريطة من زوايا متعددة
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const url = 'file://' + path.resolve('dist/index.html');
const views = (process.argv[2] || '').split(';').filter(Boolean);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await p.goto(url + (process.argv[3] || ''));
await p.waitForTimeout(2500);
console.log(logs.join('\n'));
let i = 0;
for (const v of views) {
  const [x, y, z, yaw, pitch] = v.split(',').map(Number);
  await p.evaluate(([x, y, z, yaw, pitch]) => Object.assign(window.__R.cam, { x, y, z, yaw, pitch }), [x, y, z, yaw, pitch]);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `test/shots/map_${i++}.png` });
}
const st = await p.evaluate(() => window.__R && window.__R.stats());
console.log('render stats', JSON.stringify(st));
await b.close();
