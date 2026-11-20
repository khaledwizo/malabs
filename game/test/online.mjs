// اختبار اللعب الشبكي محلياً: وسيط مصغّر + صفحة السيرفر + لاعبان
// node test/online.mjs [تأخير_ms] [ضياع]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import path from 'path';
const delay = process.argv[2] || '0', loss = process.argv[3] || '0';
const broker = spawn('node', ['test/broker.mjs', '8883', delay, loss], { stdio: ['ignore', 'pipe', 'inherit'] });
broker.stdout.on('data', d => process.stdout.write('  [' + d.toString().trim() + ']\n'));
await new Promise(r => setTimeout(r, 600));
const BR = '?broker=ws://localhost:8883/mqtt' + (process.argv.includes('nortc') ? '&nortc' : '');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const mk = async (name, settings) => {
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  const p = await ctx.newPage();
  if (settings) await p.addInitScript(s => localStorage.setItem('rafidain.settings.v1', JSON.stringify(s)), settings);
  p.on('pageerror', e => errs.push(name + ': ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(name + ' console: ' + m.text()); });
  return p;
};
const S = await mk('server');
await S.goto('file://' + path.resolve('dist/server.html') + BR);
await S.waitForFunction(() => window.__srv && window.__srv() && window.__srv().link && window.__srv().link.mqs.length > 0, null, { timeout: 15000 });
const room = await S.evaluate(() => window.__srv().room);
console.log('room', room, await S.evaluate(() => document.querySelector('#stat').textContent));

const join = async (name, team) => {
  const p = await mk(name, { fps: 0, quality: 'low', res: 0.5, name, char: team ? 'saif' : 'khaled' });
  await p.goto('file://' + path.resolve('dist/index.html') + BR);
  await p.waitForTimeout(1200);
  await p.evaluate(([room, team]) => { const U = window.__R.UI; U.open('online'); U.onTeam = team; document.querySelector('#roomIn').value = room; U.joinOnline(); }, [room, team]);
  await p.waitForFunction(() => window.__R.game.sim && window.__R.game.sim.online && window.__R.game.sim.state === 'joined', null, { timeout: 20000 });
  return p;
};
const A = await join('خالد', 0), B2 = await join('سيف', 1);
console.log('both joined');
await A.waitForTimeout(1500);
const info = () => S.evaluate(() => { const s = window.__srv(), I = s.info(); return { phase: I.phase, round: I.round, tick: I.tick, players: I.players.map(p => `${p.name}${p.bot ? '(bot)' : ''} t${p.team} ${p.rtt}ms ${p.via}`) }; });
console.log('server', JSON.stringify(await info()));
// انتظار انتهاء وقت التجهيز
await S.evaluate(() => { window.__srv().sim.phaseT = 0.5; });
await A.waitForTimeout(1500);
// A يتحرك للأمام 2 ثانية
await A.keyboard.down('KeyW'); await A.waitForTimeout(2000); await A.keyboard.up('KeyW'); await A.waitForTimeout(800);
const cmp = async () => {
  const sa = await S.evaluate(() => { const s = window.__srv(); const o = {}; for (const p of s.sim.players.values()) o[p.name] = p.pos.map(v => +v.toFixed(2)); return o; });
  const pa = await A.evaluate(() => { const g = window.__R.game, s = g.sim; const o = { me: s.pp.pos.map(v => +v.toFixed(2)), ping: Math.round(s.ping * 1000), via: s.via, phase: s.phase, n: s.players.size, hist: s.hist.length }; for (const p of s.players.values()) o[p.name] = p.pos.map(v => +v.toFixed(2)); return o; });
  const pb = await B2.evaluate(() => { const s = window.__R.game.sim; const o = { ping: Math.round(s.ping * 1000) }; for (const p of s.players.values()) o[p.name] = p.pos.map(v => +v.toFixed(2)); return o; });
  return { server: sa, A: pa, B: pb };
};
console.log(JSON.stringify(await cmp(), null, 0));
// إطلاق نار: A يصوّب نحو سيف (كما يراه) ويطلق
const aim = () => A.evaluate(() => {
  const g = window.__R.game, s = g.sim, me = s.pp; const t = [...s.players.values()].find(p => p.name === 'سيف');
  const e = s.eye(me), dx = t.pos[0] - e[0], dz = t.pos[2] - e[2], dy = t.pos[1] + 1.2 - e[1];
  g.yaw = Math.atan2(-dx, -dz); g.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return { d: Math.hypot(dx, dz).toFixed(1), los: !g.world.ray(e[0], e[1], e[2], dx, dy, dz, 1, 1, {}) };
});
// نضع سيف أمام خالد على الخط المفتوح للاختبار
await S.evaluate(() => { const s = window.__srv().sim; const a = [...s.players.values()].find(p => p.name === 'خالد'), b = [...s.players.values()].find(p => p.name === 'سيف'); for (const p of s.players.values()) if (p.bot) { p.alive = false; } b.pos = [a.pos[0], a.pos[1], a.pos[2] - 8]; b.hp = 100; b.armor = 0; });
await A.waitForTimeout(700);
console.log('aim', JSON.stringify(await aim()));
const hp0 = await S.evaluate(() => [...window.__srv().sim.players.values()].find(p => p.name === 'سيف').hp);
await A.evaluate(() => window.__R.Input.down.add('fire'));
for (let i = 0; i < 6; i++) { await aim(); await A.waitForTimeout(100); }
await A.evaluate(() => window.__R.Input.down.delete('fire'));
await A.waitForTimeout(800);
const hp1 = await S.evaluate(() => { const b = [...window.__srv().sim.players.values()].find(p => p.name === 'سيف'); return b.alive ? b.hp : 'dead'; });
const evA = await A.evaluate(() => window.__evlog || null);
console.log('سيف hp', hp0, '→', hp1);
// سيف يتحرك جانبياً وخالد يطلق (تعويض التأخير)
await S.evaluate(() => { const s = window.__srv().sim; s.phase = 'live'; s.phaseT = 99; s.endRound = () => { }; window.__hits = []; window.__shots = 0; const F = s.fire.bind(s); s.fire = (p, w, wd) => { if (p.name === 'خالد') window.__shots++; return F(p, w, wd); }; const D = s.damage.bind(s); s.damage = (q, att, dmg, ...r) => { if (att && att.name === 'خالد') window.__hits.push([q.name, Math.round(dmg), +att.lag.toFixed(3)]); return D(q, att, 0.01, ...r); }; const a = [...s.players.values()].find(p => p.name === 'خالد'), b = [...s.players.values()].find(p => p.name === 'سيف'); for (const p of s.players.values()) if (p.bot) p.alive = false; a.pos = [-12, 0.05, 31]; b.alive = true; b.hp = 100; b.pos = [12, 0.05, 28]; });
await B2.evaluate(() => { window.__R.game.yaw = 0; });
await A.waitForTimeout(1000);
await A.evaluate(() => { const s = window.__R.game.sim; s.stat = { n: 0, sum: 0, max: 0, big: 0 }; });
await B2.keyboard.down('KeyW');
const los = [];
for (let i = 0; i < 10; i++) { const r = await aim(); los.push(r.los ? 1 : 0); await A.evaluate(() => window.__R.Input.down.add('fire')); await A.waitForTimeout(60); await A.evaluate(() => window.__R.Input.down.delete('fire')); await A.waitForTimeout(260); if (i === 4) { await B2.keyboard.up('KeyW'); await B2.keyboard.down('KeyS'); } }
await B2.keyboard.up('KeyS');
await A.waitForTimeout(800);
console.log('los', los.join(''));
console.log('moving target hits', JSON.stringify(await S.evaluate(() => window.__hits)), 'shots', await S.evaluate(() => window.__shots), 'seif', await S.evaluate(() => [...window.__srv().sim.players.values()].find(p => p.name === 'سيف').pos.map(v => +v.toFixed(1))));
await A.keyboard.down('KeyW'); await A.keyboard.down('KeyA'); await A.waitForTimeout(1500); await A.keyboard.up('KeyA'); await A.keyboard.down('Space'); await A.waitForTimeout(300); await A.keyboard.up('Space'); await A.keyboard.down('KeyD'); await A.waitForTimeout(1200); await A.keyboard.up('KeyD'); await A.keyboard.up('KeyW'); await A.waitForTimeout(600);
console.log('prediction', JSON.stringify(await A.evaluate(() => { const s = window.__R.game.sim.stat; return { n: s.n, avg: +(s.sum / Math.max(1, s.n)).toFixed(4), max: +s.max.toFixed(3), big: s.big }; })));
console.log(JSON.stringify(await cmp(), null, 0));
await A.screenshot({ path: 'test/shots/online_A.png' }); await B2.screenshot({ path: 'test/shots/online_B.png' }); await S.screenshot({ path: 'test/shots/online_S.png', fullPage: true });
console.log('server', JSON.stringify(await info()));
const fA = await A.evaluate(() => document.querySelector('#fps').textContent + ' | ' + document.querySelector('#net').textContent);
console.log('A hud', fA);
// خروج لاعب
await B2.evaluate(() => { window.__R.game.quit(); });
await A.waitForTimeout(1500);
console.log('after leave', JSON.stringify(await info()));
console.log('errors', errs.length, errs.slice(0, 6).join('\n'));
await b.close(); broker.kill();
