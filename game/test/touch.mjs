// اختبار التحكم باللمس المتعدد على شاشة هاتف أفقية (CDP)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const W = 844, H = 390;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.addInitScript(() => localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 0, quality: 'low', res: '0.5', weather: 'day', teamSize: 2, difficulty: 'easy', adsMode: 'tap' })));
await page.goto('file://' + path.resolve('dist/index.html'));
await page.waitForTimeout(2500);
await page.screenshot({ path: 'test/shots/t_home.png' });
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(p => ({ x: p[0], y: p[1], id: p[2], radiusX: 8, radiusY: 8, force: 1 })) });
const center = async sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
// ابدأ بلمسة
const sb = await center('#btnStart');
await page.touchscreen.tap(sb[0], sb[1]);
await page.waitForTimeout(1500);
const st = () => page.evaluate(() => { const g = window.__R.game, s = g.sim, me = g.mp; return s && me ? { phase: s.phase, pos: me.pos.map(v => +v.toFixed(2)), yaw: +g.yaw.toFixed(3), pitch: +g.pitch.toFixed(3), mag: me.inv[me.slot] ? me.inv[me.slot].mag : null, ads: +me.adsT.toFixed(2), crouch: +me.crouch.toFixed(2), lean: +(me.lean || 0).toFixed(2), slot: me.slot, alive: me.alive, touch: document.documentElement.classList.contains('touch'), hud: document.getElementById('hud').classList.contains('on') } : null; });
console.log('after start', JSON.stringify(await st()));
await page.evaluate(() => { const s = window.__R.game.sim; s.phaseT = 0.2; for (const p of s.players.values()) if (p.bot) p.alive = false; s.endRound = () => { }; });
await page.waitForTimeout(600);
const s0 = await st(); console.log('live', JSON.stringify(s0));
// إصبعان معاً: العصا يساراً للأمام + سحب النظر يميناً
await touch('touchStart', [[160, 300, 1]]);
await page.waitForTimeout(60);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [[160, 300 - i * 9, 1]]); await page.waitForTimeout(30); }
await touch('touchStart', [[160, 228, 1], [560, 200, 2]]);
for (let i = 1; i <= 12; i++) { await touch('touchMove', [[160, 228, 1], [560 + i * 8, 200, 2]]); await page.waitForTimeout(40); }
await page.waitForTimeout(1200);
await touch('touchEnd', [[160, 228, 1]]);
await touch('touchEnd', []);
await page.waitForTimeout(300);
const s1 = await st(); console.log('moved', JSON.stringify(s1), 'dist', Math.hypot(s1.pos[0] - s0.pos[0], s1.pos[2] - s0.pos[2]).toFixed(2), 'dyaw', (s1.yaw - s0.yaw).toFixed(3));
// الإطلاق بزر الإطلاق (مع سحب)
const fb = await center('#bFire');
await touch('touchStart', [[fb[0], fb[1], 3]]);
for (let i = 1; i <= 10; i++) { await touch('touchMove', [[fb[0] - i * 3, fb[1], 3]]); await page.waitForTimeout(50); }
await touch('touchEnd', []);
await page.waitForTimeout(300);
const s2 = await st(); console.log('fired', JSON.stringify(s2), 'shots', s1.mag - s2.mag, 'dyaw(fire-drag)', (s2.yaw - s1.yaw).toFixed(3));
// التصويب (نقرة) ثم الانحناء ثم الاستراق
const ab = await center('#bAds'); await touch('touchStart', [[ab[0], ab[1], 4]]); await page.waitForTimeout(80); await touch('touchEnd', []);
await page.waitForTimeout(500);
const cb = await center('#bCrouch'); await touch('touchStart', [[cb[0], cb[1], 5]]); await page.waitForTimeout(60); await touch('touchEnd', []);
const lb = await center('#bLeanR'); await touch('touchStart', [[lb[0], lb[1], 6]]); await page.waitForTimeout(60); await touch('touchEnd', []);
await page.waitForTimeout(600);
const s3 = await st(); console.log('ads/crouch/lean', JSON.stringify(s3));
await page.screenshot({ path: 'test/shots/t_game.png' });
// تبديل السلاح من الخانات
const sl = await page.evaluate(() => { const b = document.querySelector('#slots [data-slot="2"]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
if (sl) { await touch('touchStart', [[sl[0], sl[1], 7]]); await page.waitForTimeout(60); await touch('touchEnd', []); await page.waitForTimeout(700); console.log('slot after tap', JSON.stringify((await st()).slot)); }
// فتح الخريطة الكبيرة ثم إغلاقها
const mb = await center('#mini'); await touch('touchStart', [[mb[0], mb[1], 8]]); await page.waitForTimeout(60); await touch('touchEnd', []);
await page.waitForTimeout(500);
await page.screenshot({ path: 'test/shots/t_map.png' });
console.log('map open', await page.evaluate(() => window.__R.UI.mapOpen));
await page.evaluate(() => document.getElementById('mapClose').click());
await page.waitForTimeout(300);
console.log('map open after close', await page.evaluate(() => window.__R.UI.mapOpen));
// الإيقاف
const pb = await center('#hPause'); await touch('touchStart', [[pb[0], pb[1], 9]]); await page.waitForTimeout(60); await touch('touchEnd', []);
await page.waitForTimeout(400);
console.log('paused', await page.evaluate(() => window.__R.game.paused), 'screen', await page.evaluate(() => window.__R.UI.screen));
await page.screenshot({ path: 'test/shots/t_pause.png' });
console.log('errors', errs.length, errs.slice(0, 5).join('\n'));
await b.close();
