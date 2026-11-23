// المرحلة 2 أونلاين (سيرفر محلي داخل الصفحة): باب يتفتح من السيرفر ويتطابق التصادم، علامة الفريق، أكل اللبلبي
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
import { spawn } from 'child_process';
const broker = spawn('node', ['test/broker.mjs', '8884', '0', '0'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 600));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message + (e.stack || '').split('\n').slice(0, 3).join('|')));
await page.addInitScript(() => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 0, quality: 'low', res: '0.5', weather: 'day', teamSize: 2, difficulty: 'easy', mode: 'tdm' })); });
await page.goto('file://' + path.resolve('dist/index.html') + '?broker=ws://localhost:8884/mqtt&nortc'); await page.waitForTimeout(2500);
await page.evaluate(async () => { const { Social, UI, game } = window.__R; Social.party = { host: Social.id, members: [{ id: Social.id, name: 'me' }], vs: false }; Social.partyStart = () => { }; await game.hostParty(UI.matchOpts()); UI.closeScreens(); UI.hud(true); });
await page.waitForTimeout(3000);
console.log('online', await page.evaluate(() => { const s = window.__R.game.sim; return { online: s.online, state: s.state, phase: s.phase, doorsOpen: s.doorsOpen }; }));
// ننتظر نهاية التجهيز
await page.evaluate(() => { const srv = window.__R.game.hostSrv; srv.sim.phaseT = 0.05; }); await page.waitForTimeout(1500);
// نضع اللاعب يمّ باب المرقد بالسيرفر ونستعمل
await page.evaluate(() => { const g = window.__R.game, srv = g.hostSrv, sp = [...srv.sim.players.values()].find(p => !p.bot); sp.pos = [-74.2, 0, -4]; sp.vel = [0, 0, 0]; const me = g.mp; me.pos = [-74.2, 0, -4]; });
await page.waitForTimeout(700);
console.log('use label', await page.evaluate(() => window.__R.game.useInfo && window.__R.game.useInfo.label));
await page.evaluate(() => window.__R.game.useAction()); await page.waitForTimeout(1500);
console.log('after use', await page.evaluate(() => { const g = window.__R.game, s = g.sim, srv = g.hostSrv, d = g.world.doors[1]; return { client: s.doorsOpen, server: srv.sim.doors.map(d => d.open), vis: g.doorsVis.list.map(D => D.open), colDisabled: g.world.bf[d.box * 6 + 1] < -100 }; }));
// علامة الفريق: بوت زميل (نحاكي لاعب ثاني بإرسال setMark من السيرفر)
await page.evaluate(() => { const g = window.__R.game, srv = g.hostSrv, mate = [...srv.sim.players.values()].find(p => p.bot && p.team === g.mp.team); srv.sim.setMark(mate.id, [40, 10, 1]); });
await page.waitForTimeout(1200);
console.log('team marks', await page.evaluate(() => JSON.stringify([...window.__R.game.wps.team.values()])));
await page.evaluate(() => window.__R.game.wps.setMine(20, -5, false)); await page.waitForTimeout(800);
console.log('server mark me', await page.evaluate(() => { const g = window.__R.game, srv = g.hostSrv, sp = [...srv.sim.players.values()].find(p => !p.bot); return JSON.stringify(sp.mark); }));
console.log('errs', errs);
await b.close(); broker.kill();
