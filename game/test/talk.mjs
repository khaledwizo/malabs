// اختبار كلام أهل السوق: ندخل مباراة، نقف قرب «شاي الشريعة»، ونرصد الترحيب والسوالف وفقاعات النص، ثم رمياً قريباً
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const W = 844, H = 390;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.addInitScript(() => localStorage.setItem('rafidain.intro.v1', '1'));
await page.addInitScript(() => localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 0, quality: 'low', res: '0.5', weather: 'day', teamSize: 1, difficulty: 'easy', mode: 'tdm' })));
await page.goto('file://' + path.resolve('dist/index.html')); await page.waitForTimeout(2500);
const sb = await page.evaluate(() => { const r = document.querySelector('#btnStart').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await page.touchscreen.tap(sb[0], sb[1]); await page.waitForTimeout(1500);
// أبعد البوتات واجعل اللاعب قرب كشك الچاي ينظر شمالاً
const place = (x, z, yaw) => page.evaluate(([x, z, yaw]) => { const g = window.__R.game, s = g.sim; if (s.phase === 'buy') s.phaseT = Math.min(s.phaseT, 0.2); for (const p of s.players.values()) if (p.bot) { p.pos = [-80, 0, -27]; p.brain && (p.brain.think = () => ({ mx: 0, mz: 0, yaw: 0, pitch: 0 })); } const me = g.mp; me.pos = [x, 0, z]; me.vel = [0, 0, 0]; g.yaw = yaw; g.pitch = -0.05; }, [x, z, yaw]);
await place(78, 27.2, 0);
console.log('units', await page.evaluate(() => window.__R.game.talk.units.map(u => u.m.map(c => c.name).join('+')).join(' | ')));
const seen = [];
const all = [];
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(700);
  const b2 = await page.evaluate(() => [...document.querySelectorAll('#talk .tb2')].map(e => +e.style.opacity > 0.05 ? e.textContent : null).filter(Boolean));
  for (const t of b2) if (!seen.includes(t)) { seen.push(t); all.push(t); console.log('  💬', (i * 0.7).toFixed(1), t); }
  if (i === 8) await page.screenshot({ path: 'test/shots/talk_tea.png' });
}
console.log('dupes', all.length - new Set(all).size);
// رمي قريب: يفزعون
await page.evaluate(() => { const g = window.__R.game; g.talk.onShot([79, 0, 27]); });
await page.waitForTimeout(1500);
const cow = await page.evaluate(() => window.__R.game.civs.filter(c => c.cower > 0).length);
console.log('cowering after shot', cow);
await page.screenshot({ path: 'test/shots/talk_cower.png' });
const b3 = await page.evaluate(() => [...document.querySelectorAll('#talk .tb2')].map(e => e.textContent)); console.log('reaction', b3.join(' / '));
// السوق: باعة ينادون
await place(0, 0, 0); await page.waitForTimeout(9000);
const b4 = await page.evaluate(() => [...document.querySelectorAll('#talk .tb2')].map(e => e.textContent)); console.log('souq', b4.join(' / '));
// زر الخريطة بلمسة واحدة ثم الإيقاف بلمسة واحدة
const cdp = await ctx.newCDPSession(page);
const tapAt = async sel => { const c = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1], id: 3 }] }); await page.waitForTimeout(70); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(500); };
for (let k = 0; k < 3; k++) { await tapAt('#mini'); const o = await page.evaluate(() => window.__R.UI ? window.__R.UI.mapOpen : document.querySelector('#s-map').classList.contains('on')); console.log('map tap', k, 'open', o); await page.evaluate(() => document.querySelector('#mapClose').click()); await page.waitForTimeout(400); }
await page.evaluate(() => { window.__log = []; const g = window.__R.game; const op = g.pause.bind(g); g.pause = () => { window.__log.push('pause() paused=' + g.paused + ' screen=' + window.__R.UI?.screen); op(); }; const rs = g.resume.bind(g); g.resume = () => { window.__log.push('resume() ' + new Error().stack.split('\n').slice(2, 4).join(' | ')); rs(); }; document.addEventListener('pointerdown', e => window.__log.push('pd ' + e.target.id), true); });
for (let k = 0; k < 2; k++) { await tapAt('#hPause'); console.log(await page.evaluate(() => window.__log.splice(0).join(' ; '))); const o = await page.evaluate(() => window.__R.game.paused); console.log('pause tap', k, 'paused', o); await page.evaluate(() => window.__R.game.resume()); await page.waitForTimeout(400); }
console.log('errors', errs.length, errs.slice(0, 5).join('\n'));
await b.close();
