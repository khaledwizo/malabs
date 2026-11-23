// السيرفر المركزي: مطابقة، معارك متوازية، عزل الأعطال، إيقاف تدريجي ← نقل الاستضافة بالحالة، مزامنة الغياب، اختبار التحمّل
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
import { spawn } from 'child_process';
const PORT = 8891, Q = `?broker=ws://localhost:${PORT}/mqtt&nortc`;
const broker = spawn('node', ['test/broker.mjs', String(PORT), '0', '0'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
const H = await (await b.newContext()).newPage(); H.on('pageerror', e => errs.push('hub ' + e.message)); H.on('console', m => { if (m.type() === 'error') errs.push('hubc ' + m.text()); });
await H.goto('file://' + path.resolve('dist/server.html') + Q + '&maxStress=' + (process.env.MAXS || 4));
await H.waitForFunction(() => window.__hub, null, { timeout: 15000 });
await H.click('#power');
await H.waitForFunction(() => document.querySelector('#sNet').textContent.includes('✓'), null, { timeout: 15000 });
await sleep(6500);
console.log('bench per', await H.evaluate(() => JSON.stringify({ cap: window.__hub.cap(), per: window.__hub.D().cap.per })));
const mk = async (name, mode) => { const ctx = await b.newContext({ viewport: { width: 640, height: 320 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ' ' + e.message)); await p.addInitScript(([n, m]) => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 10, quality: 'low', res: '0.3', teamSize: 2, mode: m, name: n })); }, [name, mode]); await p.goto('file://' + path.resolve('dist/index.html') + Q, { timeout: 120000, waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__R && window.__R.Central.isOnline(), null, { timeout: 90000 }); return p; };
const go = p => p.evaluate(async () => { const { UI, game } = window.__R; const r = await game.onlineMatch(UI.matchOpts(), () => { }); UI.closeScreens(); UI.hud(true); return r; });
const cst = p => p.evaluate(() => { const g = window.__R.game, s = g.sim; return s ? { how: s.central ? 'central' : s.open ? 'open' : '?', room: s.room, state: s.state, mode: s.mode, score: s.score, round: s.round, host: !!g.hostSrv, n: s.players.size } : null; });
const A = await mk('أحمد', 'tdm'); console.log('A ->', await go(A));
const B = await mk('بكر', 'tdm'); console.log('B ->', await go(B));
const Cc = await mk('جاسم', 'dom'); console.log('C ->', await go(Cc));
await sleep(5000);
console.log('A', JSON.stringify(await cst(A))); console.log('B', JSON.stringify(await cst(B))); console.log('C', JSON.stringify(await cst(Cc)));
const hubInfo = () => H.evaluate(() => [...window.__hub.matches.values()].filter(M => !M.bench).map(M => ({ room: M.room, mo: M.mo, tick: M.I && M.I.tick, busy: M.I && M.I.busy, hum: M.I && M.I.hum.map(h => h.n).join(','), bots: M.I && M.I.bots, sc: M.I && M.I.score })));
console.log('hub', JSON.stringify(await hubInfo()), 'players', await H.evaluate(() => window.__hub.stats.players));
// عزل الأعطال: نقتل عامل معركة C — معركة A/B تكمل، وC تنتقل لوضع المضيف
const cRoom = (await cst(Cc)).room;
await H.evaluate(r => window.__hub.matches.get(r).w.terminate(), cRoom);
await sleep(16000);
console.log('after crash hub', JSON.stringify(await hubInfo()));
console.log('C after crash', JSON.stringify(await cst(Cc)));
// إيقاف تدريجي: نثبّت حالة معروفة قبلها
await A.evaluate(() => { const g = window.__R.game; window.__pre = { score: g.sim.score.slice(), round: g.sim.round, me: [...g.sim.players.values()].filter(p => !p.bot).map(p => ({ n: p.name, hp: p.hp, pos: p.pos.map(v => +v.toFixed(1)), k: p.kills })) }; });
const pre = await A.evaluate(() => window.__pre); console.log('pre-stop', JSON.stringify(pre));
await H.click('#power');
await sleep(16000);
console.log('A after stop', JSON.stringify(await cst(A))); console.log('B after stop', JSON.stringify(await cst(B)));
const post = await (await A.evaluate(() => !!window.__R.game.hostSrv) ? A : B).evaluate(() => { const g = window.__R.game, s = g.hostSrv.sim; return { score: s.score, round: s.round, phase: s.phase, pl: [...s.players.values()].map(p => ({ n: p.name, bot: p.bot, hp: Math.round(p.hp), pos: p.pos.map(v => +v.toFixed(1)), k: p.kills })) }; });
console.log('new host state', JSON.stringify(post));
console.log('hub state', await H.evaluate(() => document.querySelector('#stat').textContent));
// لاعب يكمل 25 ثانية بغياب السيرفر ثم يطلع → حدث بالطابور
await sleep(22000);
await B.evaluate(() => { window.__R.game.quit(); window.__R.UI.showMenu && window.__R.UI.showMenu(); });
await A.evaluate(() => { window.__R.game.quit(); });
await Cc.evaluate(() => { window.__R.game.quit(); });
await sleep(1000);
console.log('queues', JSON.stringify(await Promise.all([A, B, Cc].map(p => p.evaluate(() => window.__R.Central.q.map(e => e.ty + ':' + e.du + 's')))))); 
// رجوع السيرفر → مزامنة + ACK
await H.click('#power');
await sleep(22000);
console.log('queues after', JSON.stringify(await Promise.all([A, B, Cc].map(p => p.evaluate(() => window.__R.Central.q.length)))));
console.log('offline panel', await H.evaluate(() => ['#oPl', '#oSe', '#oMa', '#oDup', '#offDown'].map(s => document.querySelector(s).textContent).join(' | ')));
// اختبار التحمّل
await H.click('#power'); await sleep(4000);
await H.click('#stress');
await H.waitForFunction(() => document.querySelector('#stressMsg').textContent.startsWith('النتيجة'), null, { timeout: 120000 });
console.log('stress', await H.evaluate(() => document.querySelector('#stressMsg').textContent), JSON.stringify(await H.evaluate(() => window.__hub.cap())));
await H.screenshot({ path: 'test/shots/hub.png', fullPage: true });
console.log('errs', errs.slice(0, 12));
await b.close(); broker.kill();
