import { Builder, NULL_GFX } from '../src/world/builder.js';
import { buildSouq } from '../src/world/maps/souq.js';
import { Sim } from '../src/sim/sim.js';
const B = new Builder(NULL_GFX); buildSouq(B); const W = B.finish();
console.log('props', W.props.length, 'npcs', W.npcs.length, 'tdmStart', W.tdmStart?.map(a => a.length));
// نقاط البداية داخل صناديق؟
const inBox = (x, y, z) => { for (let i = 0; i < W.mat.length; i++) { const b = W.box ? null : null; } return false; };
const S = new Sim(W, { mode: process.argv[2] || 'tdm', difficulty: 'normal', roundsToWin: 3, timeLimit: 240, seed: +(process.argv[3] || 11) });
for (let i = 0; i < 10; i++) S.addPlayer({ name: 'b' + i, team: i % 2, bot: true, char: 'khaled' });
S.start();
const hist = new Map(); const info = new Map(); const stuck = new Map(); let kills = 0, firstKill = null, npcD = 0, propB = 0;
for (let k = 0; k < 60 * 240 && S.phase !== 'over'; k++) {
  S.step(1 / 60);
  for (const e of S.events) { if (e.t === 'kill') { kills++; if (firstKill === null) firstKill = S.t; } if (e.t === 'npcDie') npcD++; if (e.t === 'break') propB++; }
  S.events.length = 0;
  if (k % 60 === 0) for (const p of S.players.values()) {
    if (!p.alive) { hist.delete(p.id); continue; }
    const h = hist.get(p.id) || []; h.push([S.t, p.pos[0], p.pos[2]]); if (h.length > 9) h.shift(); hist.set(p.id, h);
    if (h.length === 9) { const xs = h.map(q => q[1]), zs = h.map(q => q[2]); const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)); if (span < 0.8) { const key = p.pos[0].toFixed(0) + ',' + p.pos[2].toFixed(0); stuck.set(key, (stuck.get(key) || 0) + 1); const b = p.brain; if (!info.has(key)) info.set(key, []); if (info.get(key).length < 4) info.get(key).push([b.plan?.kind, b.plan?.pos?.map(v => +v.toFixed(1)).join(' '), 'path', b.path?.length, b.target ? 'TGT' : '-', b.sniper ? 'SN' : '', 'until', b.plan?.until?.toFixed(0), 'goal', b.goal?.map(v=>+v.toFixed(1)).join(' '), 'nn', b.nearestNode(p.pos), 'rt', b.route(b.goal || p.pos).length, 'y', p.pos[1].toFixed(2), 'rtT', (b.rtT||0).toFixed(1), 'ground', p.onGround, 't', S.t.toFixed(0), 'hp', p.hp|0, b.retreat ? 'RET' : '', b.nading ? 'NADE' : '', p.healT > 0 ? 'HEAL' : ''].join(' ')); } }
  }
}
console.log('t', S.t.toFixed(0), 'kills', kills, 'firstKill', firstKill?.toFixed(1), 'npcDie', npcD, 'propBreak', propB);
console.log('stuck spots', [...stuck.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));

for (const [k, v] of info) console.log(k, '\n   ' + v.join('\n   '));
