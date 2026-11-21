import { Builder, NULL_GFX } from '../src/world/builder.js';
import { buildSouq } from '../src/world/maps/souq.js';
import { stepMove } from '../src/sim/move.js';
const B = new Builder(NULL_GFX); buildSouq(B); const W = B.finish();
const N = W.nav.nodes, A = W.nav.adj; let tested = 0, fails = [];
for (let i = 0; i < N.length; i++) for (const j of A[i]) {
  if (j < i) continue; const a = N[i], b = N[j];
  for (const [s, e] of [[a, b], [b, a]]) {
    const p = { pos: [s[0], s[1] + 0.02, s[2]], vel: [0, 0, 0], crouch: 0, onGround: true, jumpReady: true };
    const d0 = Math.hypot(e[0] - s[0], e[2] - s[2]), T = d0 / 5 * 2.5 + 1.5; let ok = false;
    for (let t = 0; t < T; t += 1 / 60) {
      const dx = e[0] - p.pos[0], dz = e[2] - p.pos[2], d = Math.hypot(dx, dz);
      if (d < 0.6 && Math.abs(e[1] - p.pos[1]) < 1.0) { ok = true; break; }
      stepMove(p, { mx: 0, mz: 1, yaw: Math.atan2(-dx, -dz), jump: false, crouch: false, walk: false }, 1 / 60, W);
    }
    tested++; if (!ok) fails.push([s.slice(0, 3).map(v => +v.toFixed(1)), e.slice(0, 3).map(v => +v.toFixed(1)), p.pos.map(v => +v.toFixed(2))]);
  }
}
console.log('tested', tested, 'fails', fails.length);
for (const f of fails.slice(0, 40)) console.log(JSON.stringify(f));
