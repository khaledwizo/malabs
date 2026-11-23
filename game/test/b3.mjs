// إصلاحات الجولة 3: أبواب البيوت، الأذان والصلاة التفاعلية، الأغراض الضايعة والتسليم، هروب المدنيين للمضيف، تصوير السائح
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 30, quality: 'low', name: 'خالد' })); });
await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForTimeout(3000);
await p.evaluate(() => document.querySelector('#btnLobby').click()); await p.waitForTimeout(5000);
console.log('doors', await p.evaluate(() => window.__R.game.houseDoors.list.length));
// أماكن الأغراض الضايعة: قريبة من شبكة المشي وتنشاف
console.log('lostspots', await p.evaluate(() => { const g = window.__R.game, W = g.world, N = W.nav.nodes; return window.__QUESTS.filter(q => q.lost || q.id === 'bag').map(q => { const f = q.steps[0].find; let bd = 1e9; for (const n of N) { if (Math.abs(n[1]) > 0.4) continue; const d = Math.hypot(n[0] - f.x, n[2] - f.z); if (d < bd && W.los(n[0], 0.5, n[2], f.x, 0.3, f.z)) bd = d; } const civ = g.civs[q.giver]; return q.id + ':' + bd.toFixed(1) + (civ ? '' : ' NO-GIVER'); }).join(' '); }));
// مهمة غرض ضايع كاملة
console.log('lost', await p.evaluate(async () => { const g = window.__R.game, Q = g.quests, me = g.mp; const q = window.__QUESTS.find(x => x.id === 'lostWallet'); Q.accept(q); const f = q.steps[0].find; me.pos[0] = f.x + 0.5; me.pos[2] = f.z; for (let i = 0; i < 5; i++) Q.update(0.1); const u = Q.interact(); const lbl = u && u.label; u && u.fn(); for (let i = 0; i < 400 && Q.cine; i++) { Q.update(0.1); if (Q.cine) Q.skip && Q.skip(); } for (let i = 0; i < 200 && Q.cine; i++) Q.update(0.1); const carry = g.carry; const c = g.civs[q.giver]; me.pos[0] = c.n.x + 1.2; me.pos[2] = c.n.z; for (let i = 0; i < 20; i++) Q.update(0.1); const hand = !!Q.hand; for (let i = 0; i < 600 && (Q.cine || Q.act); i++) Q.update(0.1); return JSON.stringify({ lbl, carry, hand, carryAfter: g.carry, done: !!(Q.S.done || {}).lostWallet }); }));
// الأذان والصلاة
console.log('pray', await p.evaluate(async () => { const g = window.__R.game, M = g.mudhif, me = g.mp; g.quests.stop(); g.quests.start(); me.pos[0] = -57; me.pos[2] = -12; M.S.nextAdhan = 0; M.update(0.1); const P = M.pray; const muted = window.__R.Audio.musMute; P.adhanEnd = 3; const j = M.interact(me); j && j.fn(); let follow = false; for (let i = 0; i < 1600 && M.pray && M.pray.stage !== 'done'; i++) { M.update(0.1); if (document.getElementById('mfollow')) follow = true; } const st = M.pray && M.pray.stage; for (let i = 0; i < 100; i++) { M.update(0.1); g.ambient.update(0.1, g.camera.position); } return JSON.stringify({ rak: P.rak, muted, follow, st, imamPath: !!P.imam.path, nextAdhan: Math.round(M.S.nextAdhan - M.S.playT) }); }));
await p.waitForTimeout(500);
console.log('errs', errs.slice(0, 6));
await b.close();
