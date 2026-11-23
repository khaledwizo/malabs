// اختبار الأصدقاء والفرقة: لاعبان (أ وب) — طلب صداقة ← قبول ← دعوة ← قبول ← المضيف يبدأ (سيرفر على هاتفه) ← ب يدخل تلقائياً
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const url = 'file:///home/claude/rafidain/dist/index.html?broker=ws://localhost:8883/mqtt&nortc';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const mk = async (name, q) => { const ctx = await b.newContext({ viewport: { width: 800, height: 450 } }); const p = await ctx.newPage(); const logs = []; p.on('console', m => { if (m.type() === 'error') logs.push(name + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push(name + ' PAGEERROR ' + e.message)); await p.addInitScript(([n, q]) => { localStorage.setItem('rafidain.intro.v2', '1'), localStorage.setItem('rafidain.settings.v2', JSON.stringify({ quality: q, fps: 0, name: n, mode: 'tdm', teamSize: 3, tdmTime: 300 })); }, [name, q]); await p.goto(url); p.logs = logs; return p; };
const A = await mk('حيدر', 'low'), B = await mk('سيف', 'low');
await A.waitForTimeout(3500);
const st = p => p.evaluate(() => { const S = window.__R.Social; return { id: S.id, online: S.online, friends: S.friends.map(f => f.name + ':' + f.status), req: S.requests.length, party: S.party ? S.party.members.map(m => m.name).join('+') + (S.party.host === S.id ? ' (host)' : '') : '-', sim: window.__R.game.sim ? (window.__R.game.sim.online ? 'online:' + window.__R.game.sim.state : 'local') : '-' }; });
const a0 = await st(A), b0 = await st(B); console.log('A', JSON.stringify(a0)); console.log('B', JSON.stringify(b0));
await A.evaluate(id => window.__R.Social.request(id), b0.id); await B.waitForTimeout(1500);
console.log('B after request', JSON.stringify(await st(B)));
await B.evaluate(id => window.__R.Social.accept(id), a0.id); await A.waitForTimeout(1500);
console.log('A after accept', JSON.stringify(await st(A)));
await A.evaluate(id => window.__R.Social.invite(id, 'tdm'), b0.id); await B.waitForTimeout(1200);
const inv = await B.evaluate(() => { const el = document.querySelector('#invite'); return el && el.classList.contains('on') ? el.textContent.trim().slice(0, 60) : null; }); console.log('B invite popup:', inv);
await B.evaluate(() => document.querySelector('#invAcc').click()); await A.waitForTimeout(1500);
console.log('A party', JSON.stringify(await st(A))); console.log('B party', JSON.stringify(await st(B)));
await A.evaluate(() => document.querySelector('#btnStart').click());
await A.waitForTimeout(9000);
const fin = async p => p.evaluate(() => { const g = window.__R.game, s = g.sim; return s ? { age: +(performance.now() / 1000 - s.lastSnap).toFixed(2), st: s.t ? +s.t.toFixed(1) : 0, phT: +s.phaseT.toFixed(1), fps: +window.__R.Loop.fps.toFixed(1), state: s.state, via: s.via, me: s.me, players: [...s.players.values()].map(p => p.name + (p.bot ? '*' : '') + '/t' + p.team + (p.alive ? '' : '✝')).join(' '), phase: s.phase, host: !!g.hostSrv } : null; });
console.log('A game', JSON.stringify(await fin(A))); console.log('B game', JSON.stringify(await fin(B)));
// B يتحرك قليلاً
await B.evaluate(() => { const I = window.__R.Input; I.keys && I.keys.add && I.keys.add('KeyW'); });
await B.waitForTimeout(3000);
console.log('A after', JSON.stringify(await fin(A))); console.log('B after', JSON.stringify(await fin(B)));
await A.screenshot({ path: 'test/shots/party_A.png' }); await B.screenshot({ path: 'test/shots/party_B.png' });
console.log([...A.logs, ...B.logs].slice(0, 10).join('\n'));
await b.close();
