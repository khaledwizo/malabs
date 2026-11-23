// اختبار اللعب: القائمة ← إعداد المعركة ← اللعب ضد البوتات
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const url = 'file://' + path.resolve('dist/index.html');
const mobile = process.argv.includes('mobile');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(mobile ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
await p.addInitScript(() => { try { localStorage.setItem('rafidain.intro.v2', '1'), localStorage.setItem('rafidain.settings.v1', JSON.stringify({ fps: 0, quality: 'medium' })); } catch (e) { } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n'))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('ERR ' + m.text()); });
await p.goto(url); await p.waitForTimeout(3000);
const pre = mobile ? 'm_' : '';
const T0 = Date.now(); const log = m => console.log(((Date.now() - T0) / 1000).toFixed(1) + 's', m);
const fps = async () => p.evaluate(() => window.__R.Loop.fps.toFixed(1));
await p.screenshot({ path: `test/shots/${pre}g0_menu.png` }); log('g0_menu fps ' + await fps());
await p.click('#btnPlay'); await p.waitForTimeout(400);
await p.screenshot({ path: `test/shots/${pre}g1_setup.png` }); log('g1_setup fps ' + await fps());
await p.click('#s-setup [data-go="chars"]'); await p.waitForTimeout(1500);
await p.screenshot({ path: `test/shots/${pre}g2_chars.png` }); log('g2_chars fps ' + await fps());
await p.click('#s-chars [data-back]'); await p.waitForTimeout(300);
await p.click('#s-setup [data-go="loadout"]'); await p.waitForTimeout(800);
await p.screenshot({ path: `test/shots/${pre}g3_loadout.png` }); log('g3_loadout fps ' + await fps());
await p.click('#s-loadout [data-back]'); await p.waitForTimeout(300);
await p.click('#btnStart'); await p.waitForTimeout(2500);
await p.screenshot({ path: `test/shots/${pre}g4_spawn.png` }); log('g4_spawn fps ' + await fps());
// انتظر انتهاء وقت التجهيز ثم تحرك وأطلق
await p.evaluate(() => { const g = window.__R.game; g.sim.phaseT = 0.1; });
await p.waitForTimeout(800);
await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW');
await p.evaluate(() => { const I = window.__R.Input; I.down.add('fire'); });
await p.waitForTimeout(600);
await p.screenshot({ path: `test/shots/${pre}g5_fire.png` }); log('g5_fire fps ' + await fps());
await p.evaluate(() => { const I = window.__R.Input; I.down.delete('fire'); I.down.add('ads'); });
await p.waitForTimeout(900);
await p.screenshot({ path: `test/shots/${pre}g6_ads.png` }); log('g6_ads fps ' + await fps());
await p.evaluate(() => { const I = window.__R.Input; I.down.delete('ads'); });
// اترك البوتات تتقاتل قليلاً
for (let i = 0; i < 6; i++) { await p.waitForTimeout(2000); }
const st = await p.evaluate(() => { const g = window.__R.game, s = g.sim; return { phase: s.phase, round: s.round, score: s.score, t: s.t.toFixed(1), players: [...s.players.values()].map(p => [p.name, p.team, p.alive, Math.round(p.hp), p.kills, p.pos.map(v => +v.toFixed(1))]), fps: window.__R.Loop.fps.toFixed(1), calls: window.__R.renderer.info.render.calls, tris: window.__R.renderer.info.render.triangles }; });
console.log(JSON.stringify(st));
await p.screenshot({ path: `test/shots/${pre}g7_later.png` }); log('g7_later fps ' + await fps());
console.log('ERRORS', errs.length); errs.slice(0, 8).forEach(e => console.log(e));
await b.close();
