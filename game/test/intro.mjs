// اختبار المقدّمة: تظهر عند أول فتح، لقطات مختارة، التخطّي، ثم القائمة
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.addInitScript(() => localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 0, quality: 'medium' })));
await page.goto('file://' + path.resolve('dist/index.html')); await page.waitForTimeout(3000);
await page.screenshot({ path: 'test/shots/i_tap.png' });
console.log('intro active', await page.evaluate(() => !!(window.__intro && window.__intro.active)));
await page.evaluate(() => document.querySelector('#intro .itap').click()); await page.waitForTimeout(600);
const want = (process.argv[2] || '3,4,6,8,13,15,16,25,26,27,28,30').split(',').map(Number);
for (const i of want) {
  await page.evaluate(i => { const I = window.__intro; I.beat(i); }, i);
  await page.waitForTimeout(+(process.argv[3] || 1800));
  await page.screenshot({ path: `test/shots/i_${String(i).padStart(2, '0')}.png` });
  console.log('beat', i, await page.evaluate(() => document.querySelector('#intro .is span').textContent || document.querySelector('#intro .ic').textContent));
}
await page.evaluate(() => document.querySelector('#intro .iskip').click()); await page.waitForTimeout(900);
console.log('after skip: intro', await page.evaluate(() => !!document.querySelector('#intro')), 'seen', await page.evaluate(() => localStorage.getItem('rafidain.intro.v2')), 'home visible', await page.evaluate(() => getComputedStyle(document.querySelector('.scr.on') || document.body).visibility));
await page.screenshot({ path: 'test/shots/i_after.png' });
console.log('errors', errs.length, errs.slice(0, 4).join('\n'));
await b.close();
