// مسار على شبكة الملاحة (A*) لخط الطريق على الخريطة — مثل GTA سان أندرياس
export function nearestNode(w, x, y, z, needLos = true) {
  const N = w.nav.nodes; let best = -1, bd = 1e9;
  for (let i = 0; i < N.length; i++) {
    const n = N[i]; if (Math.abs(n[1] - y) > 2.6) continue;
    const d = Math.hypot(n[0] - x, n[2] - z); if (d >= bd) continue;
    if (needLos && d > 0.8 && !w.los(x, y + 0.9, z, n[0], n[1] + 0.9, n[2])) continue;
    bd = d; best = i;
  }
  if (best < 0 && needLos) return nearestNode(w, x, y, z, false);
  return best;
}

export function findPath(w, from, to, strict) {
  const nav = w.nav; if (!nav || !nav.nodes.length) return [[from[0], from[2]], [to[0], to[2]]];
  const a = nearestNode(w, from[0], from[1] || 0, from[2]), b = nearestNode(w, to[0], to[1] || 0, to[2]);
  if (a < 0 || b < 0) return [[from[0], from[2]], [to[0], to[2]]];
  const N = nav.nodes, g = new Float64Array(N.length).fill(Infinity), came = new Int32Array(N.length).fill(-1), done = new Uint8Array(N.length);
  const h = i => Math.hypot(N[i][0] - N[b][0], N[i][2] - N[b][2]);
  const open = [a]; g[a] = 0;
  while (open.length) {
    let bi = 0, bf = Infinity;
    for (let k = 0; k < open.length; k++) { const f = g[open[k]] + h(open[k]); if (f < bf) { bf = f; bi = k; } }
    const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (cur === b) break; if (done[cur]) continue; done[cur] = 1;
    for (const nb of nav.adj[cur]) {
      if (done[nb]) continue;
      const c = g[cur] + Math.hypot(N[cur][0] - N[nb][0], N[cur][1] - N[nb][1], N[cur][2] - N[nb][2]);
      if (c < g[nb]) { g[nb] = c; came[nb] = cur; open.push(nb); }
    }
  }
  const pts = [];
  if (b === a || came[b] >= 0) { for (let i = b; i >= 0; i = came[i]) { pts.push([N[i][0], N[i][2]]); if (i === a) break; } pts.reverse(); }
  // ماكو طريق: الماشي (strict) يبقى بمكانه بدل ما يخترق الحيطان
  else if (strict && !clear(w, from[0], from[2], to[0], to[2], from[1] || 0)) return [[from[0], from[2]], [from[0], from[2]]];
  // نختصر العقد الأولى/الأخيرة إذا كان الطريق المباشر مكشوفاً
  const out = [[from[0], from[2]]];
  for (const p of pts) out.push(p);
  // الهدف جوّا حايط/بسطة؟ نوقف عند آخر عقدة بالطريق
  if (!(strict && pts.length && !clear(w, pts[pts.length - 1][0], pts[pts.length - 1][1], to[0], to[2], from[1] || 0))) out.push([to[0], to[2]]);
  return simplify(w, out, from[1] || 0, strict);
}

// ممر "عريض": ثلاث خطوط (الوسط والكتفين) على ارتفاعين، حتى الجسم ما يحتك بزوايا الحيطان والصناديق
export function clear(w, ax, az, bx, bz, y0 = 0) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, px = -dz / L * 0.32, pz = dx / L * 0.32;
  for (const h of [0.45, 1.3]) for (const s of [0, 1, -1]) if (!w.los(ax + px * s, y0 + h, az + pz * s, bx + px * s, y0 + h, bz + pz * s)) return false;
  return true;
}

function simplify(w, P, y0, fat) {
  if (P.length < 3) return P;
  const ok = fat ? (a, b) => clear(w, a[0], a[1], b[0], b[1], y0) : (a, b) => w.los(a[0], y0 + 0.9, a[1], b[0], y0 + 0.9, b[1]);
  const out = [P[0]]; let i = 0;
  while (i < P.length - 1) {
    let j = Math.min(P.length - 1, i + 6);
    while (j > i + 1 && !ok(P[i], P[j])) j--;
    out.push(P[j]); i = j;
  }
  return out;
}

export const pathLen = P => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
