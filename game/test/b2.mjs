// الدفعة 2: الرسوميات، الطقس، مهام التصفية، المضيف (المجلس/المحاضرة/الصلاة)
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/adhan|ERR_FILE/.test(m.text())) errs.push('c ' + m.text().slice(0, 200)); });
await p.addInitScript(() => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 30, quality: 'medium', name: 'خالد', fx: true })); });
await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForTimeout(3000);
await p.evaluate(() => document.querySelector('#btnLobby').click()); await p.waitForTimeout(5000);
const sleep = ms => p.waitForTimeout(ms);
console.log('fx', await p.evaluate(() => { const P = window.__R.game.post; return JSON.stringify({ en: P.enabled, fx: !!P.mFx, rt2: !!P.rt2 }); }));
console.log('weather', await p.evaluate(() => { const W = window.__R.weather; return JSON.stringify({ id: W.id, cycle: W.cycle, plan: (W.plan || []).map(x => x[0] + ':' + x[1]).join(' ') }); }));
await p.screenshot({ path: 'test/shots/b2_fx.png' });
// مهمة تصفية
console.log('hit', await p.evaluate(async () => { const g = window.__R.game, Q = g.quests; const { } = {}; const q = window.__QUESTS.find(x => x.id === 'hitBlackmail'); Q.accept(q); const me = g.mp; me.pos[0] = 78; me.pos[2] = 12; for (let i = 0; i < 30; i++) Q.update(0.1); const w = Q.targets && Q.targets[0]; if (!w) return 'no targets'; const o = [me.pos[0], 1.6, me.pos[2]], dx = w.n.x - o[0], dy = 1.1 - o[1], dz = w.n.z - o[2], L = Math.hypot(dx, dy, dz); Q.onShot(o, [dx / L, dy / L, dz / L]); Q.update(0.1); return JSON.stringify({ alive: w.c.alive, step: Q.act && Q.act.i, saved: JSON.parse(localStorage.getItem('rafidain.quests.v1')).cur }); }));
// المضيف: الجالسين، الجلوس، التخطّي، الحفظ
console.log('majlis', await p.evaluate(async () => { const g = window.__R.game, M = g.mudhif; const n = M.men.length; M.sit(); for (let i = 0; i < 40; i++) { M.update(0.1); } const t1 = document.querySelector('#cine .ctext').textContent; M.skip(); for (let i = 0; i < 20; i++) M.update(0.1); const t2 = document.querySelector('#cine .ctext').textContent; const S = { ...M.S }; M.endSession(); return JSON.stringify({ men: n, t1, t2, line: S.line, topic: S.topic, cine: g.cine }); }));
// محاضرة
console.log('lecture', await p.evaluate(async () => { const g = window.__R.game, M = g.mudhif; M.S.nextLect = 0; M.update(0.1); const had = !!M.lect; M.sit(); for (let i = 0; i < 600; i++) M.update(0.1); return JSON.stringify({ had, lect: M.S.lect, lectNow: !!M.lect, cine: g.cine }); }));
// الصلاة
console.log('pray', await p.evaluate(async () => { const g = window.__R.game, M = g.mudhif, me = g.mp; me.pos[0] = -57; me.pos[2] = -12; M.S.nextPray = 0; M.update(0.1); const P = M.pray; const join = M.interact(me); join && join.fn(); P.gather = 3; for (let i = 0; i < 60; i++) M.update(0.1); const poses = new Set(); for (let i = 0; i < 1500 && M.pray; i++) { M.update(0.1); if (M.pray && M.pray.me) poses.add(M.pray.me.pose); } return JSON.stringify({ started: !!P, join: join && join.label, poses: [...poses], done: !M.pray, nextPray: M.S.nextPray }); }));
console.log('errs', errs.slice(0, 6));
await b.close();
