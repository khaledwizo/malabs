// المقدّمة الجديدة (المرحلة 3): نمشي على كل المشاهد بالتسريع ونصوّر لقطات مختارة
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.addInitScript(() => localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 0, quality: 'medium' })));
await page.goto('file://' + path.resolve('dist/index.html')); await page.waitForTimeout(3000);
console.log('intro active', await page.evaluate(() => !!(window.__intro && window.__intro.active)));
await page.evaluate(() => { window.__R.Loop && (window.__R.Loop.paused = true); document.querySelector('#intro .itap').click(); });
const n = await page.evaluate(() => window.__intro.constructor && 1) && await page.evaluate(() => { const I = window.__intro; I.waiting = false; return true; });
const shots = (process.argv[2] || '3,10,12,13,16,18,23,25,26,27,28,32,35,37,38,40,42,43').split(',').map(Number);
const total = await page.evaluate(() => { let i = 0; try { while (true) { window.__intro.constructor; i++; if (i > 200) break; } } catch (e) { } return 0; });
for (let i = 0; i < 46; i++) {
  const ok = await page.evaluate(i => { const I = window.__intro; if (!I || !I.active) return false; I.beat(i); return true; }, i); if (!ok) break;
  // نحاكي زمن المشهد بدون رسم (إلا آخر إطار)
  const isShot = shots.includes(i);
  await page.evaluate(([isShot]) => { const I = window.__intro, D = Math.min(I.bdur, isShot ? 1.3 : I.bdur); for (let t = 0; t < D; t += 0.05) { I.t += 0.05; I.bt += 0.05; I.updateScene(0.05); I.shotT = (I.shotT || 0) + 0.05; } I.renderShot(0.001); }, [isShot]);
  if (isShot) { await page.waitForTimeout(150); await page.screenshot({ path: `test/shots/i2_${String(i).padStart(2, '0')}.png` }); console.log('beat', i, await page.evaluate(() => document.querySelector('#intro .is span').textContent || document.querySelector('#intro .ic').textContent)); }
}
console.log('errors', errs.length, errs.slice(0, 4).join('\n'));
await b.close();
