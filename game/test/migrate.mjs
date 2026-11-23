// نقل الاستضافة: الصفحة A مضيف، B تدخل، نسدّ A → B تصير مضيف وتكمّل بنفس النتيجة
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
import { spawn } from 'child_process';
const broker = spawn('node', ['test/broker.mjs', '8885', '0', '0'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const url = 'file://' + path.resolve('dist/index.html') + '?broker=ws://localhost:8885/mqtt&nortc';
const mk = async name => { const ctx = await b.newContext({ viewport: { width: 640, height: 320 } }); const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); await p.addInitScript(n => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 30, quality: 'low', res: '0.4', teamSize: 2, mode: 'tdm', name: n })); }, name); await p.goto(url); await p.waitForTimeout(2500); return p; };
const A = await mk('أحمد'), B = await mk('بكر');
await A.evaluate(async () => { const { Social, UI, game } = window.__R; Social.party = { host: Social.id, members: [{ id: Social.id }], vs: false }; Social.partyStart = () => { }; await game.hostParty(UI.matchOpts()); UI.closeScreens(); UI.hud(true); });
const room = await A.evaluate(() => window.__R.game.hostInfo.room); console.log('room', room);
await B.evaluate(async room => { const { UI, game } = window.__R; const ns = await game.joinOnline({ room, name: 'بكر', char: 'saif', loadout: UI.matchLoadout('tdm'), team: 0 }); UI.closeScreens(); UI.hud(true); game.startOnline(ns); }, room);
await B.waitForTimeout(4000);
await A.evaluate(() => { window.__R.game.hostSrv.sim.score = [3, 1]; }); await B.waitForTimeout(3000);
console.log('B before', await B.evaluate(() => { const s = window.__R.game.sim; return { online: s.online, score: s.score, hp: s.hostPid, me: s.me, roster: [...s.roster.entries()].map(([i, r]) => i + (r.bot ? 'b' : 'h')).join(',') }; }));
await A.close();
for (let i = 0; i < 12; i++) { await B.waitForTimeout(2000); const st = await B.evaluate(() => { const g = window.__R.game, s = g.sim; return { host: !!g.hostSrv, online: s && s.online, state: s && s.state, score: s && s.score, migrating: !!g.migrating, srvScore: g.hostSrv && g.hostSrv.sim.score }; }); console.log('B', i, JSON.stringify(st)); if (st.host && st.state === 'joined' && i > 2) break; }
console.log('errs', A.errs.concat(B.errs).slice(0, 5));
await b.close(); broker.kill();
