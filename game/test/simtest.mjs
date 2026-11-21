// اختبار المحاكاة بلا رسوميات: 4 بوتات تتقاتل
import { Builder, NULL_GFX } from '../src/world/builder.js';
import { buildSouq } from '../src/world/maps/souq.js';
import { Sim } from '../src/sim/sim.js';
const B = new Builder(NULL_GFX); buildSouq(B); const W = B.finish();
console.log('boxes', W.mat.length, 'nav', W.nav.nodes.length, 'links', W.nav.adj.reduce((a, b) => a + b.length, 0) / 2, 'spawns', W.spawns.map(s => s.length));
// عقد معزولة
const iso = W.nav.adj.map((a, i) => a.length === 0 ? i : -1).filter(i => i >= 0);
console.log('isolated nodes', iso.length, iso.slice(0, 10).map(i => W.nav.nodes[i].slice(0, 3).map(v => +v.toFixed(1))));
// اتصال الرسم البياني
const seen = new Set([0]), st = [0]; while (st.length) { const c = st.pop(); for (const n of W.nav.adj[c]) if (!seen.has(n)) { seen.add(n); st.push(n); } }
console.log('connected from node0:', seen.size, '/', W.nav.nodes.length);
const S = new Sim(W, { mode: process.argv[2] || 'tdm', difficulty: process.argv[4] || 'normal', roundsToWin: 3, timeLimit: +(process.argv[3] || 120), seed: 7 });
const NB = +(process.argv[5] || 8);
for (let i = 0; i < NB; i++) S.addPlayer({ name: 'بوت' + i, team: i % 2, bot: true, char: ['khaled', 'ibrahim', 'mohammed', 'saif'][i % 4] });
S.start();
const t0 = Date.now(); let kills = 0, shots = 0, nades = 0, resp = 0; const log = [];
for (let k = 0; k < 60 * 400 && S.phase !== 'over'; k++) {
  S.step(1 / 60);
  for (const e of S.events) { if (e.t === 'kill') { kills++; log.push(`${S.t.toFixed(1)}s R${S.round} kill ${S.players.get(e.k)?.name} -> ${S.players.get(e.v)?.name} [${e.w}${e.hs ? ' HS' : ''}${e.wall ? ' wall' : ''}]`); } if (e.t === 'shot') shots++; if (e.t === 'throw') nades++; if (e.t === 'roundEnd') log.push(`== round end winner ${e.winner} (${e.why}) score ${e.score}`); if (e.t === 'respawn') resp++; }
  S.events.length = 0;
}
console.log(log.slice(-12).join('\n'));
console.log('sim time', S.t.toFixed(1), 's · real', Date.now() - t0, 'ms · kills', kills, 'shots', shots, 'nades', nades, 'respawns', resp, 'phase', S.phase, 'score', S.score);
for (const p of S.players.values()) console.log(p.name, 'team', p.team, 'K/D', p.kills, p.deaths, 'pos', p.pos.map(v => v.toFixed(1)).join(','), p.loadout.primary, p.loadout.scope);
