// المرحلة 2: اللوبي — دخول، مهمة الچاي كاملة (عرض/قبول/خطوات/حوار/مكافأة)، الأبواب، الوردة، التأشير، الخرفان والمارّة
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const W = 844, H = 390;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.addInitScript(() => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.removeItem('rafidain.quests.v1'); });
await page.addInitScript(() => localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 0, quality: 'low', res: '0.5', weather: 'day', teamSize: 1, difficulty: 'easy', mode: 'tdm' })));
await page.goto('file://' + path.resolve('dist/index.html')); await page.waitForTimeout(3000);
await page.screenshot({ path: 'test/shots/p2_home.png' });
const tap = async sel => { const c = await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel); await page.touchscreen.tap(c[0], c[1]); };
await tap('#btnLobby'); await page.waitForTimeout(2000);
const st = () => page.evaluate(() => { const g = window.__R.game, Q = g.quests; return { lobby: g.lobby, mode: g.sim && g.sim.mode, phase: g.sim && g.sim.phase, offer: Q.offer && Q.offer.id, act: Q.act && { id: Q.act.q.id, i: Q.act.i, left: Math.round(Q.act.left) }, cine: !!Q.cine, money: window.__Economy.money, use: g.useInfo && g.useInfo.label, walkers: g.ambient.walkers.length, sheep: g.ambient.sheep.length, wp: g.wps.quest && [Math.round(g.wps.quest.x), Math.round(g.wps.quest.z)], path: g.wps.path && g.wps.path.length, dist: Math.round(g.wps.dist || 0) }; });
console.log('enter', JSON.stringify(await st()));
const place = (x, z, yaw = 0) => page.evaluate(([x, z, yaw]) => { const g = window.__R.game, me = g.mp; me.pos = [x, 0, z]; me.vel = [0, 0, 0]; g.yaw = yaw; g.pitch = -0.05; }, [x, z, yaw]);
await page.waitForTimeout(4500);
console.log('offer', JSON.stringify(await st()));
// نروح لأبو سلام (17) ونضغط تكلّم
await place(78, 25.3, 0); await page.waitForTimeout(600);
console.log('near giver', JSON.stringify(await st()));
await page.screenshot({ path: 'test/shots/p2_giver.png' });
await tap('#bUse'); await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/shots/p2_cine.png' });
// نسرّع الحوار بالنقر
for (let k = 0; k < 12; k++) { const opts = await page.evaluate(() => document.querySelectorAll('#cine .copts button').length); if (opts) break; await page.evaluate(() => { const C = window.__R.game.quests.cine; if (C) C.t = 99; }); await page.waitForTimeout(250); }
await page.screenshot({ path: 'test/shots/p2_offer.png' });
await page.evaluate(() => document.querySelector('#cine .copts button').click()); await page.waitForTimeout(800);
console.log('accepted', JSON.stringify(await st()));
await page.screenshot({ path: 'test/shots/p2_track.png' });
// افتح الخريطة الكبيرة
await page.evaluate(() => window.__R.UI.openMap()); await page.waitForTimeout(600); await page.screenshot({ path: 'test/shots/p2_map.png' }); await page.evaluate(() => window.__R.UI.closeMap()); await page.waitForTimeout(300);
const skipCine = async () => { for (let k = 0; k < 40; k++) { const c = await page.evaluate(() => { const Q = window.__R.game.quests, C = Q.cine; if (!C) return 0; if (C.stage === 'lines') C.t = 99; if (C.stage === 'act') C.t = 99; return 1; }); if (!c) return; await page.waitForTimeout(220); } };
// خطوة 1: العطّار (6)
const spice = await page.evaluate(() => { const c = window.__R.game.civs[6]; return [c.n.x, c.n.z]; });
await place(spice[0] - 1.5, spice[1], Math.PI / 2); await page.waitForTimeout(900);
console.log('at spice', JSON.stringify(await st()));
await page.waitForTimeout(700); await page.screenshot({ path: 'test/shots/p2_spice.png' });
await page.evaluate(() => { const C = window.__R.game.quests.cine; if (C) C.t = 99; }); await page.waitForTimeout(300);
for (let k = 0; k < 8; k++) { const s2 = await page.evaluate(() => window.__R.game.quests.cine && window.__R.game.quests.cine.stage); if (s2 === 'act') { await page.screenshot({ path: 'test/shots/p2_act.png' }); break; } await page.evaluate(() => { const C = window.__R.game.quests.cine; if (C && C.stage === 'lines') C.t = 99; }); await page.waitForTimeout(250); }
await skipCine();
console.log('after spice', JSON.stringify(await st()));
await place(78, 25.3, 0); await page.waitForTimeout(900); await skipCine(); await page.waitForTimeout(400); await skipCine();
console.log('done tea', JSON.stringify(await st()), 'S', await page.evaluate(() => JSON.stringify(window.__R.game.quests.S)));
// الأبواب: باب المرقد
await place(-74.2, -4, Math.PI / 2); await page.waitForTimeout(500);
console.log('door use', JSON.stringify(await st()));
await tap('#bUse'); await page.waitForTimeout(1500);
console.log('door state', await page.evaluate(() => JSON.stringify(window.__R.game.sim.doors)));
await page.screenshot({ path: 'test/shots/p2_door.png' });
// المضيف
await place(-50.2, -12, -Math.PI / 2); await page.waitForTimeout(400); await tap('#bUse'); await page.waitForTimeout(1800); await place(-53.5, -12, -Math.PI / 2); await page.waitForTimeout(800);
await page.screenshot({ path: 'test/shots/p2_mudhif.png' });
await place(-60, -12, -Math.PI / 2); await page.evaluate(() => { window.__R.game.pitch = 0.1; }); await page.waitForTimeout(800); await page.screenshot({ path: 'test/shots/p2_plaque.png' });
// الوردة
const nur = await page.evaluate(() => { const c = window.__R.game.civs[4]; return [c.n.x, c.n.z]; });
await place(nur[0] + 1.6, nur[1], -Math.PI / 2); await page.waitForTimeout(500);
console.log('nursery', JSON.stringify(await st()));
await tap('#bUse'); await page.waitForTimeout(600); await page.evaluate(() => { const C = window.__R.game.quests.cine; if (C) C.t = 99; }); await page.waitForTimeout(400);
await page.evaluate(() => { const b = document.querySelector('#cine .copts button'); b && b.click(); }); await skipCine();
console.log('flower', await page.evaluate(() => window.__R.game.quests.flower));
await place(spice[0] - 1.5, spice[1], Math.PI / 2); await page.waitForTimeout(500); console.log('give?', JSON.stringify(await st()));
// التأشير اليدوي
await page.evaluate(() => window.__R.game.wps.setMine(60, -10, true)); await page.waitForTimeout(1200);
console.log('mine', await page.evaluate(() => JSON.stringify({ m: window.__R.game.wps.mine, path: window.__R.game.wps.path && window.__R.game.wps.path.length })));
// الخرفان والأصحاب
await place(40, 26, Math.PI); await page.waitForTimeout(1500); await page.screenshot({ path: 'test/shots/p2_sheep.png' });
await place(72, 20.5, Math.PI * 0.75); await page.waitForTimeout(800); await page.screenshot({ path: 'test/shots/p2_lablabi.png' });
await place(63.5, -4.8, 0); await page.waitForTimeout(800); await page.screenshot({ path: 'test/shots/p2_stele.png' });
await place(56.4, 3.4, Math.PI); await page.waitForTimeout(800); await page.screenshot({ path: 'test/shots/p2_bakery.png' });
console.log('errors', errs.length, errs.slice(0, 6).join('\n---\n'));
await b.close();
