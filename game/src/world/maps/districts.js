// المناطق الموسّعة لخريطة «سوق المجاهدين»
// غرباً «الحارة المهجورة»: بيوت محترقة وأزقّة ضيقة وسيارة محروقة، ثم «المقبرة القديمة» بقبّتها الخضراء وأشجارها اليابسة وسور بغداد القديم
// شرقاً «ساحة الساعة»: برج الساعة، القشلة بأروقتها، الباص الأحمر، نقطة تفتيش بأكياس الرمل وبسطات السلاح
// جنوباً: امتداد كورنيش الشريعة على طول الخريطة
import * as THREE from 'three';

export function buildDistricts(B, H) {
  const { T, R, pick, vis, block, frame, facade, lantern, crate, sack, pot, vase, barrel, palm, column, archWall, wallX, wallZ, floor, signs, gunProp, n, MAT, F, bench, table, fbox, palmFar, door, streetLamp } = H;
  const PI = Math.PI;
  const graffiti = (text, x, y, z, ry, w = 2.4, o = {}) => { if (vis) signs.push({ text, x, y, z, ry, w, h: o.h || w * 0.375, rx: o.rx || 0, opt: { graffiti: true, ...(o.opt || {}) } }); };
  const sign = (text, x, y, z, ry, w, opt) => { if (vis) signs.push({ text, x, y, z, ry, w, opt: opt || {} }); };
  // تحويل إحداثيات محلية لجسم مدار حول y
  const loc = (x, z, ry, lx, lz) => [x + Math.cos(ry) * lx + Math.sin(ry) * lz, z - Math.sin(ry) * lx + Math.cos(ry) * lz];
  const post = (x, z, h = 3.4, col = 0xffb060, it = 2.6, dist = 10, fl = 0) => streetLamp(x, z, col, it, dist, fl);

  // ---------------- أدوات الخراب ----------------
  // جدار متكسّر الحافة العليا. holes: [{u, w, type: 'door'|'win'}] (u من بداية الجدار)
  const jagWall = (axis, a0, a1, c, t, Hh, mat, holes = [], jag = 1.6) => {
    const L = a1 - a0;
    const bx = (u0, u1, y0, y1, m, o) => { if (u1 - u0 < 0.03 || y1 - y0 < 0.03) return; if (axis === 'x') B.box(a0 + u0, y0, c - t / 2, a0 + u1, y1, c + t / 2, m, o); else B.box(c - t / 2, y0, a0 + u0, c + t / 2, y1, a0 + u1, m, o); };
    const solid = (s0, s1) => { let s = s0; while (s < s1 - 0.02) { let w = Math.min(s1 - s, 0.6 + R() * 1.2); if (s1 - s - w < 0.3) w = s1 - s; const h = Math.max(1.95, Hh - R() * jag * (R() < 0.25 ? 2.2 : 1)); bx(s, s + w, 0, h, R() < 0.2 ? 'charred' : mat); s += w; } };
    let cur = 0;
    for (const hl of [...holes].sort((p, q) => p.u - q.u)) {
      const h0 = hl.u - hl.w / 2, h1 = hl.u + hl.w / 2;
      solid(cur, h0);
      if (hl.type === 'door') { bx(h0, h1, 2.3, Math.max(2.75, Hh - R() * jag), mat); if (vis) bx(h0 - 0.06, h1 + 0.06, 2.2, 2.34, 'charred', { col: false }); }
      else { bx(h0, h1, 0, 1.0, mat); bx(h0, h1, 2.0, Math.max(2.4, Hh - R() * jag), mat); }
      cur = h1;
    }
    solid(cur, L);
  };
  const rubble = (x, z, r = 1, h = 0.55, mat = 'brickBurnt') => {
    B.box(x - r * 0.65, 0, z - r * 0.65, x + r * 0.65, h, z + r * 0.65, null, { vis: false, cm: MAT.brick });
    if (!vis) return;
    for (let k = 0; k < 8; k++) { const a = R() * 6.28, d = R() * r * 0.75, s = 0.22 + R() * 0.42; B.geo(() => new THREE.IcosahedronGeometry(s, 0), T(x + Math.cos(a) * d, s * 0.3, z + Math.sin(a) * d, R() * 3, 1, 0.55 + R() * 0.5, 1, R(), R()), k % 3 ? mat : 'stone'); }
    for (let k = 0; k < 6; k++) B.geo(() => new THREE.BoxGeometry(0.24, 0.07, 0.11), T(x + (R() - 0.5) * r * 2.2, 0.04, z + (R() - 0.5) * r * 2.2, R() * 3, 1, 1, 1, R() * 0.3, R() * 0.3), 'brick');
  };
  // جسر خشبي متفحّم مائل (شكل فقط)
  const fallenBeam = (x0, y0, z0, x1, y1, z1, r = 0.12) => {
    if (!vis) return;
    const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), L = d.length(); d.normalize();
    const m = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), new THREE.Vector3(1, 1, 1));
    B.geo(() => new THREE.BoxGeometry(r * 2, L, r * 2), m, 'charred');
  };
  // بيت مهدّم يمكن دخوله: جدران متكسّرة، سقف منهار جزئياً، أنقاض وجسور ساقطة
  const ruinHouse = (x0, z0, x1, z1, o = {}) => {
    const t = 0.45, Hh = o.h || 5, mat = o.mat || 'brickBurnt';
    jagWall('x', x0, x1, z0 + t / 2, t, Hh, mat, o.n || []);
    jagWall('x', x0, x1, z1 - t / 2, t, Hh, mat, o.s || []);
    jagWall('z', z0 + t, z1 - t, x0 + t / 2, t, Hh, mat, (o.w || []).map(h => ({ ...h, u: h.u - t })));
    jagWall('z', z0 + t, z1 - t, x1 - t / 2, t, Hh, mat, (o.e || []).map(h => ({ ...h, u: h.u - t })));
    floor(x0 + t, z0 + t, x1 - t, z1 - t, 'mud');
    if (o.roof) { const [a, b, c, d] = o.roof; B.box(a, 3.0, b, c, 3.32, d, 'charred'); if (vis) for (let x = a + 0.5; x < c; x += 1.1) B.box(x, 2.82, b, x + 0.16, 3.0, d, 'beam', { col: false }); }
    if (o.part) for (const p of o.part) jagWall(p.axis, p.a0, p.a1, p.c, 0.3, p.h || 3.0, mat, p.holes || [], 0.6);
    if (vis && o.beams) for (const bm of o.beams) fallenBeam(...bm);
  };
  // سيارة (ry=0 بطولها على z)
  // سيارة بهيكل منحوت (مقطع جانبي مبثوق بحواف مشطوفة، أقواس عجلات، زجاج، مصابيح، صدّامات كروم)
  const car = (x, z, ry, body = 'rust', cabin = 'charred', o = {}) => {
    const L = 4.4, W = 1.74, al = Math.abs(Math.sin(ry)) > 0.5;
    const sx = al ? L : W, sz = al ? W : L;
    B.box(x - sx / 2, 0, z - sz / 2, x + sx / 2, 1.0, z + sz / 2, null, { vis: false, cm: MAT.metal });
    B.box(x - sx / 2 * (al ? 0.55 : 1), 1.0, z - sz / 2 * (al ? 1 : 0.55), x + sx / 2 * (al ? 0.55 : 1), 1.45, z + sz / 2 * (al ? 1 : 0.55), null, { vis: false, cm: MAT.metal });
    if (!vis) return;
    const burnt = !!o.burnt, paint = body, M = (m) => burnt && m !== 'rubber' ? (m === 'chrome' ? 'rust' : 'charred') : m;
    const g = () => { const eg = new THREE.ExtrudeGeometry((() => { const sh = new THREE.Shape(); sh.moveTo(-2.2, 0.3); sh.lineTo(-2.2, 0.8); sh.quadraticCurveTo(-2.18, 0.93, -2.0, 0.95); sh.lineTo(-1.38, 0.98); sh.lineTo(-0.98, 1.4); sh.quadraticCurveTo(-0.86, 1.47, -0.7, 1.47); sh.lineTo(0.42, 1.47); sh.quadraticCurveTo(0.58, 1.46, 0.68, 1.39); sh.lineTo(1.25, 0.99); sh.lineTo(2.05, 0.9); sh.quadraticCurveTo(2.22, 0.86, 2.22, 0.7); sh.lineTo(2.22, 0.3); sh.lineTo(1.74, 0.3); sh.absarc(1.36, 0.3, 0.38, 0, Math.PI, false); sh.lineTo(-0.98, 0.3); sh.absarc(-1.36, 0.3, 0.38, 0, Math.PI, false); sh.lineTo(-2.2, 0.3); return sh; })(), { depth: W - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 });
      eg.translate(0, 0, -(W - 0.12) / 2); eg.rotateY(-PI / 2); return eg; };
    B.geo(g, T(x, 0, z, ry), burnt ? 'rust' : paint, { uvs: 0.3 });
    // تكسي بغداد: برتقالي بسقف أبيض
    if (o.top === 'paintOrange' && !burnt) { const p = loc(x, z, ry, 0, -0.14); B.geo(() => new THREE.BoxGeometry(W - 0.14, 0.03, 1.08), T(p[0], 1.485, p[1], ry), 'paintWhite'); }
    // الزجاج: جانبيّ بنافذتين، أمامي وخلفي مائل
    const glass = burnt ? 'dark' : 'glassDark';
    for (const s2 of [-1, 1]) { for (const [a0, a1] of [[-0.95, -0.15], [-0.08, 0.62]]) { const p = loc(x, z, ry, s2 * (W / 2 + 0.002), (a0 + a1) / 2); B.geo(() => new THREE.BoxGeometry(0.02, 0.38, a1 - a0), T(p[0], 1.2, p[1], ry), glass); } }
    { const p = loc(x, z, ry, 0, -1.17); B.geo(() => new THREE.BoxGeometry(W - 0.2, 0.56, 0.02), T(p[0], 1.19, p[1], ry, 1, 1, 1, 0.76), glass); }
    { const p = loc(x, z, ry, 0, 0.97); B.geo(() => new THREE.BoxGeometry(W - 0.22, 0.66, 0.02), T(p[0], 1.19, p[1], ry, 1, 1, 1, -0.96), glass); }
    // صدّامات ومصابيح ومرايا
    for (const e of [-1, 1]) { const p = loc(x, z, ry, 0, e * 2.29); B.geo(() => new THREE.BoxGeometry(W + 0.04, 0.14, 0.1), T(p[0], 0.4, p[1], ry), M('chrome')); }
    for (const s2 of [-1, 1]) { const f = loc(x, z, ry, s2 * 0.62, -2.265); B.geo(() => new THREE.BoxGeometry(0.32, 0.13, 0.04), T(f[0], 0.66, f[1], ry), burnt ? 'dark' : 'lampWhite'); const r2 = loc(x, z, ry, s2 * 0.65, 2.285); B.geo(() => new THREE.BoxGeometry(0.28, 0.14, 0.04), T(r2[0], 0.72, r2[1], ry), burnt ? 'dark' : 'lampRed'); const m = loc(x, z, ry, s2 * (W / 2 + 0.1), -0.6); B.geo(() => new THREE.BoxGeometry(0.12, 0.08, 0.06), T(m[0], 1.02, m[1], ry), M(paint)); }
    { const p = loc(x, z, ry, 0, -2.27); B.geo(() => new THREE.BoxGeometry(0.9, 0.16, 0.03), T(p[0], 0.56, p[1], ry), M('chrome')); }
    // العجلات: إطار ومركز
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (o.missing && R() < 0.35) continue;
      const p = loc(x, z, ry, lx * (W / 2 - 0.12), lz * 1.36);
      B.geo(() => new THREE.CylinderGeometry(0.33, 0.33, 0.22, 16), T(p[0], 0.33, p[1], ry, 1, 1, 1, 0, PI / 2), 'rubber');
      if (!burnt) { const h = loc(x, z, ry, lx * (W / 2 - 0.005), lz * 1.36); B.geo(() => new THREE.CylinderGeometry(0.17, 0.17, 0.02, 12), T(h[0], 0.33, h[1], ry, 1, 1, 1, 0, PI / 2), 'chrome'); }
    }
    if (o.top && o.top !== 'paintOrange') { const p = loc(x, z, ry, 0, -0.14); B.geo(() => new THREE.BoxGeometry(0.55, 0.16, 0.22), T(p[0], 1.56, p[1], ry), o.top); }
    if (o.top === 'paintOrange' && !burnt) { const p = loc(x, z, ry, 0, -0.14); B.geo(() => new THREE.BoxGeometry(0.6, 0.16, 0.2), T(p[0], 1.57, p[1], ry), 'lampWhite'); }
  };
  // صبّة كونكريتية (جدار حماية بغدادي) — ساتر لا يُخترق
  const twall = (x, z, along = 'x', h = 3.2) => {
    const [sx, sz] = along === 'x' ? [1.5, 0.32] : [0.32, 1.5];
    B.box(x - sx / 2, 0, z - sz / 2, x + sx / 2, h, z + sz / 2, 'concrete');
    if (vis) { const [bx, bz] = along === 'x' ? [1.5, 1.1] : [1.1, 1.5]; B.box(x - bx / 2, 0, z - bz / 2, x + bx / 2, 0.42, z + bz / 2, 'concrete'); }
    else B.box(x - (along === 'x' ? 0.75 : 0.55), 0, z - (along === 'x' ? 0.55 : 0.75), x + (along === 'x' ? 0.75 : 0.55), 0.42, z + (along === 'x' ? 0.55 : 0.75), null, { vis: false });
  };
  // حاجز خشبي مؤقت قابل للكسر
  const woodBar = (x, z, along = 'x', len = 2.4) => {
    B.prop('crate', 220);
    const [sx, sz] = along === 'x' ? [len, 0.22] : [0.22, len];
    B.box(x - sx / 2, 0, z - sz / 2, x + sx / 2, 1.15, z + sz / 2, null, { vis: false, cm: MAT.wood, flags: F.THIN });
    if (vis) { for (const yy of [0.25, 0.62, 0.98]) B.box(x - sx / 2, yy, z - sz / 2 * 0.5, x + sx / 2, yy + 0.16, z + sz / 2 * 0.5, R() < 0.5 ? 'wood' : 'woodDark', { col: false }); for (const e of [-1, 1]) { const px = along === 'x' ? x + e * (len / 2 - 0.15) : x, pz = along === 'x' ? z : z + e * (len / 2 - 0.15); B.box(px - 0.06, 0, pz - 0.06, px + 0.06, 1.2, pz + 0.06, 'woodDark', { col: false }); } }
    B.end();
  };
  const deadTree = (x, z, h = 5.2) => {
    B.col(x - 0.25, 0, z - 0.25, x + 0.25, h * 0.75, z + 0.25, MAT.wood);
    if (!vis) return;
    B.geo(() => new THREE.CylinderGeometry(0.15, 0.32, h * 0.78, 7), T(x, h * 0.39, z, R() * 3, 1, 1, 1, 0.05, 0.04), 'deadwood');
    const br = (x0, y0, z0, len, a, el, r) => {
      const d = new THREE.Vector3(Math.cos(el) * Math.cos(a), Math.sin(el), Math.cos(el) * Math.sin(a));
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x0 + d.x * len / 2, y0 + d.y * len / 2, z0 + d.z * len / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), new THREE.Vector3(1, 1, 1));
      B.geo(() => new THREE.CylinderGeometry(r * 0.45, r, len, 5), m, 'deadwood');
      return [x0 + d.x * len, y0 + d.y * len, z0 + d.z * len];
    };
    for (let k = 0; k < 5; k++) { const a = R() * 6.28, e = br(x, h * (0.42 + R() * 0.34), z, 1.2 + R() * 1.5, a, 0.3 + R() * 0.65, 0.1); for (let j = 0; j < 2; j++) { const e2 = br(e[0], e[1], e[2], 0.6 + R() * 0.9, a + (R() - 0.5) * 1.6, 0.15 + R() * 0.95, 0.05); if (R() < 0.4) br(e2[0], e2[1], e2[2], 0.4 + R() * 0.5, a + (R() - 0.5) * 2, R() * 0.9, 0.025); } }
  };
  // قبر: قاعدة واطئة وشاهد عند الرأس وشاهد صغير عند القدم (بطوله على x)
  const tomb = (x, z, kind = 'std') => {
    if (kind === 'big') {
      B.box(x - 1.1, 0, z - 0.62, x + 1.1, 1.05, z + 0.62, 'tomb');
      if (vis) { B.box(x - 1.16, 0.95, z - 0.68, x + 1.16, 1.06, z + 0.68, 'tomb', { col: false }); B.geo(() => new THREE.CylinderGeometry(0.5, 0.5, 2.05, 12), T(x, 1.06, z, 0, 1, 0.62, 1, 0, PI / 2), 'tomb'); }
      return;
    }
    B.box(x - 0.85, 0, z - 0.36, x + 0.85, 0.22, z + 0.36, 'tomb');
    const broken = R() < 0.16, tilt = !broken && R() < 0.14, hh = broken ? 0.32 + R() * 0.18 : 0.72 + R() * 0.28;
    B.prop('tomb', 140); // الشاهد يتحطم بالرصاص
    if (tilt) { B.col(x - 0.88, 0.22, z - 0.24, x - 0.7, 0.85, z + 0.24, MAT.stone); if (vis) B.geo(() => new THREE.BoxGeometry(0.12, hh, 0.5), T(x - 0.78, 0.22 + hh * 0.48, z, 0, 1, 1, 1, (R() - 0.5) * 0.25, (R() < 0.5 ? -1 : 1) * (0.18 + R() * 0.2)), 'tomb'); }
    else { B.box(x - 0.85, 0.22, z - 0.25, x - 0.72, 0.22 + hh, z + 0.25, 'tomb'); if (vis && !broken) B.geo(() => new THREE.CylinderGeometry(0.25, 0.25, 0.13, 12), T(x - 0.785, 0.22 + hh, z, 0, 1, 1, 1, 0, PI / 2), 'tomb'); }
    B.end();
    if (broken && vis) B.geo(() => new THREE.BoxGeometry(0.12, 0.42, 0.5), T(x - 0.25, 0.28, z + 0.12, R(), 1, 1, 1, PI / 2 - 0.12, 0.3), 'tomb');
    B.prop('tomb', 80); B.box(x + 0.74, 0.22, z - 0.16, x + 0.85, 0.6, z + 0.16, 'tomb'); B.end();
    if (vis && R() < 0.12) B.geo(() => new THREE.PlaneGeometry(1.45, 0.6), T(x, 0.235, z, 0, 1, 1, 1, -PI / 2), 'clothGreen');
    if (vis && R() < 0.1) for (let k = 0; k < 3; k++) B.geo(() => new THREE.SphereGeometry(0.05, 6, 4), T(x + (R() - 0.5) * 1.2, 0.26, z + (R() - 0.5) * 0.4), pick(['flowerRed', 'flowerWhite']));
  };
  // أكياس رمل (جدار بطول المحور الأطول)
  const sandbags = (x0, z0, x1, z1, h = 1.1) => {
    B.box(x0, 0, z0, x1, h, z1, null, { vis: false, cm: MAT.sand });
    if (!vis) return;
    const alongX = x1 - x0 >= z1 - z0, L = alongX ? x1 - x0 : z1 - z0, D = alongX ? z1 - z0 : x1 - x0;
    for (let r = 0, y = 0; y < h - 0.05; r++, y += 0.21) for (let u = (r % 2) * -0.3; u < L - 0.05; u += 0.6) {
      const a = Math.max(0, u), b = Math.min(L, u + 0.58); if (b - a < 0.15) continue; const m = (a + b) / 2;
      const cx = alongX ? x0 + m : (x0 + x1) / 2, cz = alongX ? (z0 + z1) / 2 : z0 + m;
      B.geo(() => new THREE.BoxGeometry(alongX ? b - a : D, 0.2, alongX ? D : b - a), T(cx, y + 0.1, cz, (R() - 0.5) * 0.06, 1, 1, 1, 0, 0), R() < 0.3 ? 'olive' : 'sack', { uvs: 1 });
    }
  };
  const bed = (x0, z0, x1, z1) => {
    B.box(x0, 0, z0, x1, 0.5, z1, 'brickPale', { faces: 'pxnxpznz' });
    if (vis) { B.box(x0 + 0.22, 0.5, z0 + 0.22, x1 - 0.22, 0.52, z1 - 0.22, 'grass', { col: false, faces: 'py' }); for (const [a0, b0, a1, b1] of [[x0 - 0.05, z0 - 0.05, x1 + 0.05, z0 + 0.22], [x0 - 0.05, z1 - 0.22, x1 + 0.05, z1 + 0.05], [x0 - 0.05, z0 + 0.22, x0 + 0.22, z1 - 0.22], [x1 - 0.22, z0 + 0.22, x1 + 0.05, z1 - 0.22]]) B.box(a0, 0.5, b0, a1, 0.58, b1, 'stone', { col: false });
      for (let k = 0; k < 8; k++) { const bx = x0 + 0.6 + R() * (x1 - x0 - 1.2), bz = z0 + 0.6 + R() * (z1 - z0 - 1.2); B.geo(() => new THREE.IcosahedronGeometry(0.3 + R() * 0.2, 1), T(bx, 0.62, bz, R() * 3, 1, 0.75, 1), pick(['leafGreen', 'leafDark'])); if (R() < 0.6) for (let f = 0; f < 3; f++) B.geo(() => new THREE.SphereGeometry(0.06, 6, 4), T(bx + (R() - 0.5) * 0.5, 0.82 + R() * 0.15, bz + (R() - 0.5) * 0.5), pick(['flowerRed', 'flowerYellow', 'flowerPink', 'flowerWhite'])); }
    }
    palm((x0 + x1) / 2, (z0 + z1) / 2, 7 + R() * 2, 0.08 + R() * 0.08, R() * 6);
  };
  // بسطة سلاح تحت مظلة
  const stall = (x, z, ry = 0) => {
    const al = Math.abs(Math.sin(ry)) > 0.5, sx = al ? 0.9 : 2.2, sz = al ? 2.2 : 0.9;
    B.boxB(x, 0, z, sx, 0.88, sz, 'woodDark', {});
    if (!vis) return;
    B.boxB(x, 0.88, z, sx + 0.1, 0.05, sz + 0.1, 'carpet', { col: false });
    for (let k = 0; k < 3; k++) { const p = loc(x, z, ry, 0, -0.25 + k * 0.25); gunProp(p[0], 0.935, p[1], 'flat', R() < 0.5 ? 1 : -1, pick(['ak', 'rifle', 'pistol', 'sniper', 'ak']), 0.9); }
    for (const [lx, lz] of [[-1.25, -0.6], [1.25, -0.6], [-1.25, 0.6], [1.25, 0.6]]) { const p = loc(x, z, ry, lx, lz); B.boxB(p[0], 0, p[1], 0.07, lz < 0 ? 2.5 : 2.2, 0.07, 'beam', { col: false }); }
    B.geo(() => new THREE.PlaneGeometry(2.8, 1.5), T(x, 2.36, z, ry, 1, 1, 1, -PI / 2 + 0.2), pick(['clothRed', 'clothCream', 'clothGreen', 'olive']), { uvs: 0.5 });
    if (R() < 0.6) crate(...loc(x, z, ry, 0.6, -1.1), 0.6);
  };

  // ================= الحارة المهجورة (غرب الشارع الغربي) =================
  floor(-52, -30, -46, 18, 'paving');                  // الزقاق الطولي
  floor(-66, -22, -52, -18, 'paving'); floor(-66, -6, -52, -2, 'paving'); floor(-66, 8, -52, 12, 'paving');
  block(-66, -36, -46, -30, ['s'], { hMin: 5, hMax: 7, ruin: true });
  if (vis) facade(frame('w', -46, -30, -14, -24), 6.5, 3.4, { ruin: true });
  // البيت المحترق (يُدخل من الزقاق ومن الدرب الشمالي)
  ruinHouse(-66, -30, -52, -22, {
    h: 5.2, e: [{ u: 4, w: 1.4, type: 'door' }], s: [{ u: 6, w: 1.3, type: 'door' }, { u: 11, w: 1.2, type: 'win' }], w: [{ u: 4, w: 1.2, type: 'win' }], n: [{ u: 3, w: 1.1, type: 'win' }],
    part: [{ axis: 'z', a0: -29.55, a1: -22.45, c: -59, h: 3.0, holes: [{ u: 2.05, w: 1.2, type: 'door' }] }], roof: [-65.55, -29.55, -59.15, -22.45],
    beams: [[-58.5, 0.1, -28.6, -54, 3.4, -27.2], [-57.6, 0.05, -24.2, -53.2, 2.6, -25.6, 0.1]],
  });
  rubble(-56.2, -24.3, 1.0, 0.5); rubble(-62.8, -28.6, 0.8, 0.45);
  if (vis) { B.boxB(-63.5, 0, -24, 1.8, 0.45, 0.8, 'charred', { col: false }); B.boxB(-63.5, 0.45, -23.75, 1.8, 0.45, 0.25, 'charred', { col: false }); }
  B.col(-64.4, 0, -24.4, -62.6, 0.9, -23.6, MAT.wood, F.THIN);
  graffiti('ارحلوا', -58.5, 1.5, -29.53, 0, 2.2);
  B.light(-62.2, 2.5, -26.2, 0xff9a50, 1.3, 7, 1); B.glow(-62.2, 2.5, -26.2, 0.5, 0xff9a50, 1);
  // كتلة محترقة صمّاء
  block(-66, -18, -52, -6, ['n', 's', 'e', 'w'], { hMin: 5, hMax: 7.5, ruin: true });
  graffiti('لا تلتفت', -51.97, 2.3, -12.5, PI / 2, 2.8);
  graffiti('', -51.97, 1.4, -8.2, PI / 2, 1.6, { opt: { hands: true } });
  // البيت المسكون: غرفتان بباب داخلي، مرآة ودمية وكرسي هزّاز
  ruinHouse(-66, -2, -52, 8, {
    h: 5.4, n: [{ u: 10, w: 1.3, type: 'door' }, { u: 4, w: 1.2, type: 'win' }], e: [{ u: 5, w: 1.3, type: 'door' }], s: [{ u: 4, w: 1.3, type: 'door' }, { u: 10, w: 1.2, type: 'win' }], w: [{ u: 5, w: 1.2, type: 'win' }],
    part: [{ axis: 'z', a0: -1.55, a1: 7.55, c: -59, h: 3.0, holes: [{ u: 2.55, w: 1.15, type: 'door' }, { u: 7.55, w: 1.1, type: 'door' }] }], roof: [-65.55, -1.55, -59.15, 7.55],
    beams: [[-57.8, 0.1, 6.8, -53.2, 3.6, 5.2], [-56, 0.1, -1.2, -55.2, 2.9, 3.2, 0.1]],
  });
  rubble(-54.3, 0.4, 0.9, 0.5); rubble(-64.4, 6.1, 0.7, 0.4);
  if (vis) {
    // مرآة مكسورة وكرسي هزّاز ودمية على الأرض
    B.box(-65.53, 1.0, 1.0, -65.48, 2.3, 2.0, 'glass', { col: false }); B.box(-65.55, 0.94, 0.94, -65.5, 2.36, 2.06, 'woodDark', { col: false });
    B.boxB(-63.4, 0.35, 4.6, 0.55, 0.06, 0.55, 'woodDark', { col: false }); B.boxB(-63.4, 0.41, 4.35, 0.55, 0.7, 0.05, 'woodDark', { col: false });
    for (const s of [-1, 1]) B.geo(() => new THREE.TorusGeometry(0.45, 0.03, 4, 12, PI * 0.6), T(-63.4 + s * 0.27, 0.42, 4.6, PI / 2, 1, 1, 1, 0, PI * 0.7), 'woodDark');
    B.geo(() => new THREE.SphereGeometry(0.09, 8, 6), T(-61.6, 0.31, 6.2), 'bone'); B.geo(() => new THREE.CylinderGeometry(0.07, 0.1, 0.24, 6), T(-61.6, 0.12, 6.2), 'clothCream');
    for (const s of [-1, 1]) B.geo(() => new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5), T(-61.6 + s * 0.06, 0.04, 6.32, 0, 1, 1, 1, PI / 2), 'clothCream');
  }
  graffiti('هنا كانوا', -59.17, 1.4, 4.8, -PI / 2, 2.2);
  graffiti('', -55, 0.02, -3.2, 0, 2.2, { rx: -PI / 2, h: 0.8, opt: { hands: true } });
  B.light(-62.6, 2.6, 1.2, 0xff6a3a, 1.5, 7, 1); B.glow(-62.6, 2.6, 1.2, 0.45, 0xff6a3a, 1);
  block(-66, 12, -52, 18, ['n', 's', 'e', 'w'], { hMin: 3.6, hMax: 4.8, ruin: true });
  // السيارة المحروقة وأنقاض الزقاق وأسلاك الخِرَق
  car(-49.3, -12.5, 0.08, 'rust', 'charred', { missing: true, burnt: true });
  rubble(-47.6, -20.6, 0.8, 0.45); rubble(-50.4, 5.4, 0.9, 0.5); rubble(-58.2, -3.2, 0.7, 0.4);
  graffiti('', -49.3, 0.02, -9.2, 0.3, 2.6, { rx: -PI / 2, h: 1.0 });
  if (vis) for (const [z, y] of [[-17, 5.2], [-7, 5.0], [6, 5.4]]) { B.box(-52, y, z - 0.01, -46, y + 0.02, z + 0.01, 'iron', { col: false }); for (let x = -51.6; x < -46.4; x += 0.8) if (R() < 0.55) B.box(x, y - 0.5 - R() * 0.4, z - 0.01, x + 0.35, y, z + 0.01, pick(['charred', 'clothCream', 'clothRed']), { col: false }); }
  for (const [x, z] of [[-49, -3.2]]) { B.boxB(x - 2.6, 0, z, 0.18, 3.4, 0.18, 'iron', {}); lantern(x - 2.6, 3.4, z); B.light(x - 2.6, 3.3, z, 0xffc080, 1.8, 9, 1); }
  B.light(-47, 3.2, 12.6, 0xffb070, 1.4, 8, 1); if (vis) B.box(-46.62, 3.32, 12.58, -46, 3.36, 12.62, 'iron', { col: false }); lantern(-46.6, 3.0, 12.6);

  // ================= المقبرة القديمة =================
  floor(-90, -30, -66, 18, 'graveDirt');
  // سور بغداد القديم غرباً مع برج حراسة، وسور شمالي
  B.box(-92, 0, -36, -90, 7.5, 33.6, 'brickPale', { faces: 'pxpy' });
  B.box(-90, 0, -36, -66, 6.5, -30, 'brickPale', { faces: 'pzpypx' });
  if (vis) {
    for (let z = -35.4; z < 33.2; z += 1.4) B.box(-90.6, 7.5, z, -90, 8.3, z + 0.7, 'brickPale', { col: false });
    for (let x = -89.6; x < -66.4; x += 1.4) B.box(x, 6.5, -30.6, x + 0.7, 7.3, -30, 'brickPale', { col: false });
    for (let z = -32; z < 30; z += 6) B.box(-90.02, 4.8, z, -89.98, 5.9, z + 0.25, 'dark', { col: false });
  }
  B.col(-93.5, 0, -14.6, -88.4, 12.5, -9.4, MAT.brick);
  if (vis) {
    B.geo(() => new THREE.CylinderGeometry(2.45, 2.7, 11, 16), T(-91, 5.5, -12), 'brickPale', { uvs: 0.5 });
    B.geo(() => new THREE.CylinderGeometry(2.75, 2.55, 0.5, 16), T(-91, 11.2, -12), 'brick');
    for (let k = 0; k < 10; k++) { const a = k / 10 * PI * 2; B.boxB(-91 + Math.cos(a) * 2.5, 11.45, -12 + Math.sin(a) * 2.5, 0.6, 0.8, 0.6, 'brickPale', { col: false }); }
    for (const y of [4, 7.5]) B.box(-88.5, y, -12.2, -88.3, y + 1, -11.8, 'dark', { col: false });
  }
  // البوابات من الحارة (x=-66) وجنوباً إلى الشريعة
  const gate = (x, z, axis, w, label) => {
    const hw = w / 2;
    if (axis === 'z') { B.boxB(x, 0, z - hw - 0.25, 0.6, 3.1, 0.5, 'brickPale', {}); B.boxB(x, 0, z + hw + 0.25, 0.6, 3.1, 0.5, 'brickPale', {}); if (vis) { B.box(x - 0.3, 3.1, z - hw - 0.5, x + 0.3, 3.45, z + hw + 0.5, 'brickPale', { col: false }); for (let k = 0; k < 7; k++) B.box(x - 0.02 - 0.9 * (1 - k / 7), 0, z + hw - 0.05 - k * 0.13, x + 0.02 - 0.9 * (1 - k / 7), 2.3, z + hw - k * 0.13, 'iron', { col: false }); } }
    else { B.boxB(x - hw - 0.25, 0, z, 0.5, 3.1, 0.6, 'brickPale', {}); B.boxB(x + hw + 0.25, 0, z, 0.5, 3.1, 0.6, 'brickPale', {}); if (vis) B.box(x - hw - 0.5, 3.1, z - 0.3, x + hw + 0.5, 3.45, z + 0.3, 'brickPale', { col: false }); }
    if (label) sign(label, x + (axis === 'z' ? 0.32 : 0), 3.75, z + (axis === 'z' ? 0 : -0.32), axis === 'z' ? PI / 2 : PI, 2.6, { bg: '#20262a', border: '#8a9aa0', fg: '#d8e4e6' });
  };
  gate(-66, -20, 'z', 3, null); gate(-66, -4, 'z', 3, 'المقبرة القديمة'); gate(-66, 10, 'z', 3, null);
  wallX(-90, -81, 18.25, 0, 1.9, 0.5, 'brickPale'); wallX(-77, -66, 18.25, 0, 1.9, 0.5, 'brickPale'); gate(-79, 18.25, 'x', 3, null);
  // الضريح ذو القبة الخضراء (أبواب شرقاً وغرباً على الدرب الرئيسي)
  {
    const cx = -79, cz = -4, s = 4, Hh = 5.6, t = 0.7;
    archWall('x', cx - s, cx + s, cz - s + t / 2, 0, Hh, t, [{ u: s, w: 1.3, h: 1.4, rise: 0.6, y: 1.1 }], 'brickPale', { trim: 'tileGreen' });
    archWall('x', cx - s, cx + s, cz + s - t / 2, 0, Hh, t, [{ u: s, w: 1.3, h: 1.4, rise: 0.6, y: 1.1 }], 'brickPale', { trim: 'tileGreen' });
    archWall('z', cz - s + t, cz + s - t, cx - s + t / 2, 0, Hh, t, [{ u: s - t, w: 2.0, h: 2.4, rise: 1.0 }], 'brickPale', { trim: 'tileGreen' });
    archWall('z', cz - s + t, cz + s - t, cx + s - t / 2, 0, Hh, t, [{ u: s - t, w: 2.0, h: 2.4, rise: 1.0 }], 'brickPale', { trim: 'tileGreen' });
    B.box(cx - s - 0.15, Hh, cz - s - 0.15, cx + s + 0.15, Hh + 0.4, cz + s + 0.15, 'brickPale');
    if (vis) B.box(cx - s + t, 0, cz - s + t, cx + s - t, 0.03, cz + s - t, 'carpet', { col: false, faces: 'py' });
    // الشبّاك والقبر في الوسط
    B.box(cx - 1.4, 0, cz - 0.8, cx + 1.4, 1.6, cz + 0.8, null, { vis: false, cm: MAT.metal });
    if (vis) {
      B.boxB(cx, 0, cz, 2.2, 0.9, 1.0, 'woodDark', { col: false }); B.boxB(cx, 0.9, cz, 2.3, 0.12, 1.1, 'clothGreen', { col: false });
      for (let k = 0; k <= 12; k++) { const x = cx - 1.38 + k * 0.23; for (const zz of [cz - 0.78, cz + 0.78]) B.box(x - 0.015, 0, zz - 0.015, x + 0.015, 1.6, zz + 0.015, 'brass', { col: false }); }
      for (let k = 0; k <= 6; k++) { const z = cz - 0.78 + k * 0.26; for (const xx of [cx - 1.38, cx + 1.38]) B.box(xx - 0.015, 0, z - 0.015, xx + 0.015, 1.6, z + 0.015, 'brass', { col: false }); }
      B.box(cx - 1.42, 1.6, cz - 0.82, cx + 1.42, 1.68, cz + 0.82, 'brass', { col: false });
      B.geo(() => new THREE.CylinderGeometry(3.3, 3.3, 1.5, 8), T(cx, Hh + 1.15, cz, PI / 8), 'tileGreen', { uvs: 2 });
      B.geo(() => new THREE.SphereGeometry(3.35, 24, 12, 0, PI * 2, 0, PI / 2), T(cx, Hh + 1.9, cz, 0, 1, 1.15, 1), 'tileGreen', { uvs: 3 });
      B.geo(() => new THREE.CylinderGeometry(0.06, 0.2, 1.4, 8), T(cx, Hh + 6.2, cz), 'gold'); B.geo(() => new THREE.SphereGeometry(0.28, 10, 8), T(cx, Hh + 5.8, cz), 'gold');
      for (const [x, z] of [[cx - s, cz - s], [cx + s, cz - s], [cx - s, cz + s], [cx + s, cz + s]]) { B.geo(() => new THREE.CylinderGeometry(0.35, 0.35, 1.2, 8), T(x, Hh + 0.9, z), 'brickPale'); B.geo(() => new THREE.ConeGeometry(0.42, 0.7, 8), T(x, Hh + 1.85, z), 'tileGreen'); }
      for (let k = 0; k < 5; k++) { const a = k / 5 * PI * 2; B.glow(cx + Math.cos(a) * 1.9, 0.35, cz + Math.sin(a) * 1.9, 0.22, 0xffd090, 1); B.geo(() => new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), T(cx + Math.cos(a) * 1.9, 0.15, cz + Math.sin(a) * 1.9), 'flowerWhite'); }
    }
    B.light(cx, 3.2, cz, 0x9effb8, 1.6, 8, 1);
  }
  // القبور: صفوف بين الدروب (درب طولي عند x=-79 ودروب عرضية عند z=-20,-4,10)
  const trees = [[-86.6, -25.4, 5.4], [-71.4, -14.6, 6], [-87.1, 5.6, 5], [-70.4, 14.6, 5.6], [-84.6, -13.2, 4.6], [-72.6, -23.7, 5.2], [-74.8, 6.4, 4.8]];
  const keepOut = trees.map(t => [t[0], t[1], 1.5]).concat([[-86, 13.5, 1.7]]);
  for (let x = -88.4; x <= -67.6; x += 2.6) for (let z = -28.2; z <= 16.2; z += 3.0) {
    if (Math.abs(x + 79) < 2.1 || Math.abs(z + 20) < 2.0 || Math.abs(z + 4) < 2.0 || Math.abs(z - 10) < 2.0) continue;
    if (Math.abs(x + 79) < 6.4 && Math.abs(z + 4) < 6.4) continue;
    if (keepOut.some(([kx, kz, r]) => Math.abs(kx - x) < r + 0.85 && Math.abs(kz - z) < r * 0.6 + 0.4)) continue;
    const jx = (R() - 0.5) * 0.4, jz = (R() - 0.5) * 0.4; if (R() < 0.12) continue;
    tomb(x + jx, z + jz, R() < 0.09 ? 'big' : 'std');
  }
  for (const [x, z, h] of trees) deadTree(x, z, h);
  for (const [x, z] of [[-77.6, -21.6], [-80.4, 8.4], [-68.2, -5.6], [-88.6, -2.4], [-80.4, -26.6]]) post(x, z, 3.2, 0xbfe0ff, 1.5, 9, 1);
  // قبر محفور حديثاً ومجرفة
  if (vis) { B.box(-86.9, 0.005, 13.2, -85.1, 0.012, 14.0, 'dark', { col: false }); B.geo(() => new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), T(-84.6, 0.6, 12.8, 0, 1, 1, 1, 0.25, 0.1), 'deadwood'); B.geo(() => new THREE.BoxGeometry(0.22, 0.3, 0.03), T(-84.75, 0.05, 12.65, 0, 1, 1, 1, 0.25, 0.1), 'iron'); }
  rubble(-85.8, 12.4, 0.8, 0.35, 'graveDirt');

  // ================= الشريعة الغربية =================
  for (const [x, z, h] of [[-46, 30.6, 8], [-54.5, 29.6, 7.4], [-63, 31.2, 8.8], [-71.5, 30.2, 7.2], [-86.4, 30.6, 8.4]]) palm(x, z, h, 0.1 + R() * 0.1, R() * 6);
  // كوخ الصيّاد بشباك معلّقة
  B.box(-62, 0, 20, -57, 2.6, 23.4, 'mud');
  if (vis) {
    B.box(-62.4, 2.6, 19.4, -56.6, 2.8, 24.0, 'palm', { col: false });
    for (const x of [-62.2, -56.8]) B.boxB(x, 0, 24.6, 0.1, 2.6, 0.1, 'beam', { col: false });
    B.geo(() => new THREE.PlaneGeometry(5.8, 1.4), T(-59.5, 2.35, 24.4, 0, 1, 1, 1, -1.2), 'sack', { uvs: 0.5 });
    door(frame('s', -62, 20, -57, 23.4), 1.8, 1.1, 2.1, 'woodBlue');
    for (let k = 0; k < 3; k++) B.geo(() => new THREE.PlaneGeometry(1.2, 1.6), T(-56.94, 1.4, 20.7 + k * 0.9, PI / 2, 1, 1, 1), 'lattice', { uvs: 0.5 });
  }
  // زورق متروك على الضفة
  B.col(-79.2, 0, 22.3, -73.6, 0.75, 23.9, MAT.wood);
  if (vis) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(Math.sin(t * PI) * 0.75 + 0.05, (t - 0.5) * 5.5)); } const g = new THREE.LatheGeometry(pts, 10, PI, PI); g.rotateZ(PI / 2); B.geo(g, T(-76.4, 0.02, 23.1, 0, 1, 0.8, 1, 0.06, PI), 'woodDark', { uvs: 0.6 }); }
  crate(-68, 21, 1.0); crate(-67.2, 21.9, 0.8); crate(-51, 25, 1.1); sack(-52.2, 25.6, 'spice2'); crate(-84, 23.5, 1.1); crate(-83, 24.2, 0.7, 0, 0.4);
  if (vis) for (let x = -89; x < -44; x += 1.1 + R() * 1.4) for (let k = 0; k < 4; k++) B.geo(() => new THREE.ConeGeometry(0.04, 1.1 + R() * 0.8, 4), T(x + (R() - 0.5) * 0.6, 0.6, 32.6 + R() * 0.35, 0, 1, 1, 1, (R() - 0.5) * 0.3, (R() - 0.5) * 0.3), R() < 0.5 ? 'leafDark' : 'palm');
  post(-52, 31.6, 3.6, 0xffb060, 2.4, 10); post(-80, 27, 3.4, 0xffb060, 2.2, 10, 1);

  // ================= ساحة الساعة (شرق) =================
  floor(46, -30, 86, 8, 'paving');
  // بوّابتا الممر من ساحة البئر
  for (const [x0, x1, label, ry, sx] of [[38.4, 39.2, 'ساحة الساعة', -PI / 2, 38.37], [45.2, 46, 'سوق المجاهدين', PI / 2, 46.03]]) {
    B.box(x0, 3.9, -2.5, x1, 5.6, 2.5, 'brickPale');
    if (vis) { B.box(x0 - 0.05, 3.75, -2.55, x1 + 0.05, 3.9, 2.55, 'tileBlue', { col: false }); B.box(x0 - 0.05, 5.6, -2.6, x1 + 0.05, 5.8, 2.6, 'tileGold', { col: false }); }
    sign(label, sx, 4.75, 0, ry, 3.4, { bg: '#1e3a5c', border: '#e6c36a' });
  }
  if (vis) { facade(frame('e', 14, -30, 46, -24), 6.5, 3.4, {}); }
  // القشلة: رواق أرضي بأقواس وطابق علوي بشبابيك خشبية
  {
    const zf = -30.4, low = [], up = [];
    for (let k = 0; k < 10; k++) { low.push({ u: 2 + k * 4, w: 2.8, h: 2.9, rise: 1.3 }); up.push({ u: 2 + k * 4, w: 2.1, h: 1.9, rise: 1.0, y: 0.4 }); }
    archWall('x', 46, 86, zf, 0, 5.0, 0.8, low, 'brickPale', { trim: 'tileBlue' });
    archWall('x', 46, 86, zf, 5.0, 4.5, 0.8, up, 'brickPale', {});
    floor(46, -34, 86, -30.8, 'stone');
    B.box(46, 4.5, -34.1, 86, 5.0, -30.8, 'woodDark', { faces: 'ny' });
    B.box(46, 5.0, -34, 86, 9.5, -30.84, null, { vis: false, cm: MAT.brick });
    B.box(46, 0, -36, 86, 9.5, -34, 'brickPale', { faces: 'pzpy' });
    if (vis) {
      B.box(46, 5.0, -30.86, 86, 9.5, -30.82, 'woodBlue', { col: false });
      for (let x = 46.4; x < 86; x += 1.3) B.box(x, 4.32, -34, x + 0.16, 4.5, -30.8, 'beam', { col: false });
      const f = frame('s', 46, -36, 86, -34);
      for (let k = 0; k < 10; k++) { if (k % 3 === 1) door(f, 1.4 + k * 4, 1.2, 2.4, pick(['woodDark', 'woodBlue'])); else fbox(f, 1.6 + k * 4, 2.4 + k * 4, 1.4, 2.4, 0, 0.05, 'lattice', { col: false }); }
      for (let x = 46.4; x < 86; x += 1.2) B.box(x, 9.5, -30.9, x + 0.6, 10.2, -30.0, 'brickPale', { col: false });
      B.box(46, 9.3, -30.95, 86, 9.5, -29.95, 'tileBlue', { col: false });
      for (let k = 0; k < 5; k++) lantern(50 + k * 8, 3.4, -32.4, 0.7);
    }
    B.light(58, 3.4, -32.4, 0xffb060, 2.6, 10); B.light(74, 3.4, -32.4, 0xffb060, 2.6, 10);
    sign('القشلة', 66, 8.85, -29.97, 0, 3.4, { bg: '#183d7a', border: '#f3d98a' });
  }
  B.box(86, 0, -36, 92, 10, -30, 'brickPale', { faces: 'nxpy' });
  block(86, -30, 92, 8, ['w'], { hMin: 8, hMax: 11 });
  block(46, 8, 56, 18, ['n', 's', 'e']); floor(56, 8, 60, 18, 'paving');
  block(60, 8, 74, 18, ['n', 's', 'e', 'w'], { hMin: 7, hMax: 9 }); floor(74, 8, 78, 18, 'paving');
  block(78, 8, 92, 18, ['n', 's', 'w']);
  // برج الساعة على منصّة رخامية
  {
    const cx = 66, cz = -11;
    B.box(cx - 5, 0, cz - 5, cx + 5, 0.3, cz + 5, 'marble');
    B.box(cx - 2.2, 0.3, cz - 2.2, cx + 2.2, 12.6, cz + 2.2, 'brickPale');
    B.col(cx - 2.4, 12.6, cz - 2.4, cx + 2.4, 24, cz + 2.4, MAT.brick);
    if (vis) {
      B.box(cx - 2.55, 0.3, cz - 2.55, cx + 2.55, 1.3, cz + 2.55, 'stone', { col: false });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(cx + sx * 2.2 - 0.3, 1.3, cz + sz * 2.2 - 0.3, cx + sx * 2.2 + 0.3, 12.6, cz + sz * 2.2 + 0.3, 'brick', { col: false });
      for (const y of [4.6, 8.6]) B.box(cx - 2.32, y, cz - 2.32, cx + 2.32, y + 0.25, cz + 2.32, 'tileBlue', { col: false });
      for (const s of [-1, 1]) { B.box(cx - 0.4, 5.4, cz + s * 2.21 - 0.02, cx + 0.4, 7.6, cz + s * 2.21 + 0.02, 'dark', { col: false }); B.box(cx + s * 2.21 - 0.02, 5.4, cz - 0.4, cx + s * 2.21 + 0.02, 7.6, cz + 0.4, 'dark', { col: false }); }
      B.box(cx - 2.5, 12.6, cz - 2.5, cx + 2.5, 13.2, cz + 2.5, 'tileBlue', { col: false });
      B.box(cx - 2.4, 13.2, cz - 2.4, cx + 2.4, 17.4, cz + 2.4, 'plasterWhite', { col: false });
      B.box(cx - 2.75, 17.4, cz - 2.75, cx + 2.75, 17.8, cz + 2.75, 'stone', { col: false });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) column(cx + sx * 2.1, cz + sz * 2.1, 17.8, 2.6, 0.22, 'brickPale', 'stone');
      B.box(cx - 2.6, 20.4, cz - 2.6, cx + 2.6, 20.75, cz + 2.6, 'tileGold', { col: false });
      const bell = []; for (let i = 0; i <= 8; i++) { const t = i / 8; bell.push(new THREE.Vector2(0.15 + t * t * 0.55, 1 - t)); }
      B.geo(() => new THREE.LatheGeometry(bell, 12), T(cx, 18.6, cz), 'copper');
      B.geo(() => new THREE.SphereGeometry(2.35, 20, 10, 0, PI * 2, 0, PI / 2), T(cx, 20.75, cz, 0, 1, 1.15, 1), 'tileTurq', { uvs: 2 });
      B.geo(() => new THREE.CylinderGeometry(0.05, 0.16, 1.6, 8), T(cx, 24.2, cz), 'gold'); B.geo(() => new THREE.SphereGeometry(0.24, 10, 8), T(cx, 23.6, cz), 'gold');
    }
    for (const [x, z, ry] of [[cx, cz - 2.43, PI], [cx, cz + 2.43, 0], [cx - 2.43, cz, -PI / 2], [cx + 2.43, cz, PI / 2]]) if (vis) signs.push({ text: 'clock', x, y: 15.3, z, ry, w: 2.9, h: 2.9, opt: { clock: true } });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) post(cx + sx * 4.4, cz + sz * 4.4, 3.6, 0xffc070, 2.4, 11);
  }
  bed(51, -26, 58, -20); bed(74, -26, 81, -20); bed(51, -2, 58, 4); bed(74, -2, 81, 4);
  for (const [x, z, a] of [[54.5, -18.8, 'x'], [77.5, -18.8, 'x'], [54.5, -3.2, 'x'], [77.5, -3.2, 'x']]) bench(x, z, 3, a);
  // الباص الأحمر المحترق جزئياً
  {
    const cx = 82.2, cz = -12.5, L = 10.4, W = 2.5;
    B.col(cx - W / 2, 0, cz - L / 2, cx + W / 2, 4.45, cz + L / 2, MAT.metal);
    if (vis) {
      B.box(cx - W / 2, 0.42, cz - L / 2, cx + W / 2, 2.3, cz + L / 2, 'paintRed', { col: false });
      B.box(cx - W / 2 - 0.01, 2.3, cz - L / 2 - 0.01, cx + W / 2 + 0.01, 2.46, cz + L / 2 + 0.01, 'plasterWhite', { col: false });
      B.box(cx - W / 2, 2.46, cz - L / 2, cx + W / 2, 4.3, cz + L / 2, 'paintRed', { col: false });
      B.box(cx - W / 2 + 0.05, 4.3, cz - L / 2 + 0.08, cx + W / 2 - 0.05, 4.42, cz + L / 2 - 0.08, 'iron', { col: false });
      for (const s of [-1, 1]) { const xf = cx + s * (W / 2 + 0.005);
        for (let k = 0; k < 6; k++) { const z0 = cz - L / 2 + 1.0 + k * 1.5; B.box(xf - 0.01, 1.35, z0, xf + 0.01, 2.1, z0 + 1.25, R() < 0.3 ? 'glass' : 'dark', { col: false }); B.box(xf - 0.01, 3.0, z0, xf + 0.01, 3.95, z0 + 1.25, R() < 0.4 ? 'glass' : 'dark', { col: false }); }
        for (const lz of [-1, 1]) B.geo(() => new THREE.CylinderGeometry(0.5, 0.5, 0.32, 14), T(cx + s * (W / 2 - 0.12), 0.5, cz + lz * L * 0.33, 0, 1, 1, 1, 0, PI / 2), 'dark');
      }
      for (const s of [-1, 1]) { const zf = cz + s * (L / 2 + 0.005); B.box(cx - 1.05, 1.3, zf - 0.01, cx + 1.05, 2.15, zf + 0.01, 'dark', { col: false }); B.box(cx - 1.05, 3.0, zf - 0.01, cx + 1.05, 3.95, zf + 0.01, 'dark', { col: false }); }
      B.box(cx - W / 2 - 0.03, 2.6, cz + 1.0, cx - W / 2 - 0.018, 4.2, cz + 4.6, 'charred', { col: false });
      B.box(cx - W / 2 - 0.03, 0.5, cz - 4.8, cx - W / 2 - 0.018, 1.3, cz - 2.2, 'charred', { col: false });
    }
  }
  // نقطة تفتيش بأكياس الرمل قرب مدخل الساحة ورشّاش على حامل
  sandbags(53.6, -10.2, 54.4, -3.6, 1.1); sandbags(50.4, -10.2, 53.6, -9.4, 1.1); sandbags(50.4, -4.4, 53.6, -3.6, 1.1);
  if (vis) { for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [0, 0.35]]) B.geo(() => new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), T(54 + dx * 0.4, 1.35, -6.9 + dz * 0.4, 0, 1, 1, 1, dz * 0.6, dx * 0.6), 'iron'); gunProp(54.05, 1.7, -6.9, 'x', 1, 'rifle', 1.45); }
  B.box(48.2, 0, -16.6, 50.4, 2.5, -14.4, 'plasterWhite');
  if (vis) { B.box(48.1, 2.5, -16.7, 50.5, 2.65, -14.3, 'iron', { col: false }); B.box(50.41, 1.2, -16.1, 50.43, 2.0, -14.9, 'glass', { col: false }); }
  // بسطات السلاح جنوب الساحة وتكسي بغداد البرتقالي
  stall(61.5, 5.4, 0); stall(66, 5.4, 0); stall(70.5, 5.4, 0);
  car(49.4, -24.6, 0, 'paintOrange', 'plasterWhite', { top: 'paintOrange' });
  car(48.8, 6.2, PI / 2 + 0.12, 'rust', 'charred', { missing: true, burnt: true });
  crate(84.4, -26.6, 1.1); crate(84.6, -25.4, 0.8); crate(47.6, -28.6, 1); crate(62.5, -26.8, 1.1); crate(69.6, -26.4, 0.9); sack(70.6, -27.1, 'spice1');
  for (const [x, z] of [[46.7, -19.2], [84.2, -1.5], [60, 7.2], [72, 7.2]]) post(x, z, 3.6, 0xffb060, 2.4, 10);

  // ================= الشريعة الشرقية =================
  for (const [x, z, h] of [[47.5, 30.6, 8.2], [55.5, 29.6, 7.4], [66.5, 31.3, 9], [76.5, 30.1, 7.6], [86.6, 30.8, 8.5]]) palm(x, z, h, 0.1 + R() * 0.1, R() * 6);
  for (const x of [51, 61, 71, 81]) bench(x, 26.2, 2.6, 'x');
  B.box(76, 0, 20, 80, 2.7, 23, 'plasterWhite');
  if (vis) { B.box(75.6, 2.7, 19.6, 80.4, 2.9, 23.6, 'woodBlue', { col: false }); B.box(76.6, 1.0, 23.0, 79.4, 1.9, 23.03, 'dark', { col: false }); B.box(76.4, 0.95, 23.0, 79.6, 1.05, 23.4, 'woodDark', { col: false }); for (let k = 0; k < 4; k++) pot(76.9 + k * 0.7, 1.05, 23.2, 0.06, 'glass'); B.geo(() => new THREE.PlaneGeometry(4.6, 1.3), T(78, 2.5, 23.7, 0, 1, 1, 1, -1.1), 'clothCream', { uvs: 0.5 }); }
  sign('شاي الشريعة', 78, 2.38, 23.04, 0, 2.6, { bg: '#7a1a1f', border: '#f3d98a' });
  table(74.6, 24.8); table(81.2, 24.6);
  // مرسى العبّارة
  B.box(62, -0.1, 33.6, 66, 0.15, 40, 'wood', { cm: MAT.wood });
  B.col(61.9, 0.15, 39.9, 66.1, 1, 40.1); B.col(61.9, 0.15, 33.6, 62, 1, 40); B.col(66, 0.15, 33.6, 66.1, 1, 40);
  if (vis) {
    B.geo(() => new THREE.BoxGeometry(11, 1.4, 3.6), T(64, -0.3, 43, 0.03), 'woodBlue');
    B.geo(() => new THREE.BoxGeometry(5, 1.6, 2.8), T(65, 1.2, 43, 0.03), 'plasterWhite');
    B.geo(() => new THREE.BoxGeometry(5.4, 0.12, 3.2), T(65, 2.05, 43, 0.03), 'clothRed');
    for (let k = 0; k < 4; k++) B.geo(() => new THREE.BoxGeometry(0.8, 0.5, 0.04), T(63.2 + k * 1.2, 1.3, 41.58, 0.03), 'dark');
  }
  post(52, 31.6, 3.6, 0xffb060, 2.4, 10); post(70, 31.6, 3.6, 0xffb060, 2.4, 10); post(88, 31.6, 3.6, 0xffb060, 2.2, 10);
  crate(52.6, 23.8, 1.1); crate(53.7, 24.3, 0.8); crate(86.5, 24, 1.2); sack(85.4, 24.6, 'spice3');
  B.box(90, 0, 18, 92, 7, 33.6, 'brickPale', { faces: 'nxpy' });
  if (vis) { for (let z = 18.3; z < 33.2; z += 1.4) B.box(90, 7, z, 90.6, 7.8, z + 0.7, 'brickPale', { col: false }); B.box(90, -3, 33.6, 92, 7, 46, 'brickPale', { col: false }); B.box(-92, -3, 33.6, -90, 7.5, 46, 'brickPale', { col: false }); }

  // ================= أهل المدينة =================
  // باعة البسطات واقفون خلفها، بائع الشاي وزبائنه، شيوخ على المصاطب، صيّاد على الكورنيش
  for (const x of [61.5, 66, 70.5]) B.npc({ x: x + (R() - 0.5) * 0.6, z: 6.4, yaw: 0, pose: 'stand', look: 'vendor' });
  B.npc({ x: 78, z: 23.85, yaw: PI, pose: 'stand', look: 'tea' });
  B.npc({ x: 74.6, z: 25.6, yaw: 0, pose: 'sit', look: 'tea' });
  B.npc({ x: 81.95, z: 24.6, yaw: PI / 2, pose: 'sit', look: 'tea' });
  B.npc({ x: 53.9, y: 0.09, z: -18.85, yaw: PI, pose: 'sit', look: 'elder', stool: false });
  B.npc({ x: 55.3, y: 0.09, z: -18.85, yaw: PI, pose: 'sit', look: 'elder', stool: false });
  B.npc({ x: 77.0, y: 0.09, z: -3.15, yaw: 0, pose: 'sit', look: 'elder', stool: false });
  B.npc({ x: 60.4, y: 0.09, z: 26.15, yaw: PI, pose: 'sit', look: 'elder', stool: false });
  B.npc({ x: -70, z: 31.9, yaw: PI, pose: 'stand', look: 'vendor' });
  // صيد اليوم: طبق خشبي عليه أسماك بنّي (نموذج مرخّص CC0)
  B.box(-69.3, 0, 31.0, -67.9, 0.36, 31.8, 'woodDark', { cm: MAT.wood, flags: F.THIN });
  for (const [dx, dz, r] of [[-0.38, -0.1, 0.15], [0.05, 0.12, -0.2], [0.42, -0.08, 0.35]]) B.put('fish', -68.6 + dx, 0.36, 31.4 + dz, PI / 2 + r, 1.25);
  // زوّار الضريح يقرؤون الفاتحة رافعين أكفّهم (لا يُصابون احتراماً للمكان)
  for (const [x, z, yaw] of [[-80.2, -5.55, PI], [-77.8, -5.55, PI + 0.2], [-78.2, -2.4, 0], [-80.6, -2.5, 0.3]]) B.npc({ x, z, yaw, pose: 'pray', look: 'pilgrim', kill: false });

  // ================= سواتر الطرقات =================
  // صبّات كونكريتية وأكياس رمل وحواجز خشبية قابلة للكسر — تُترك الممرات الرئيسة مفتوحة
  twall(60.5, -24.4, 'x'); twall(62, -24.4, 'x');
  woodBar(70.5, -20.6, 'x', 2.4);
  sandbags(58.8, 20.4, 61.8, 21.2, 1.05);
  twall(-56, 25.2, 'x'); twall(-54.5, 25.2, 'x');
  twall(-34, 25.4, 'x'); twall(23.5, 25.2, 'x'); twall(25, 25.2, 'x');
  sandbags(-40, -12.8, -38.3, -12, 1.05); sandbags(-35.7, 3.6, -34, 4.4, 1.05);
  woodBar(-39, 13.6, 'x', 2.0);
  sandbags(30, -15.5, 31.2, -14.7, 1.05);
  sandbags(22.6, -24, 23.4, -22.9, 1.0);
  woodBar(-51, -18, 'x', 2.0);
  sandbags(-47.3, 0.4, -46.1, 1.8, 1.0);
  if (vis) { graffiti('قف', 60.5, 1.8, -24.22, 0, 1.2); graffiti('', 24.25, 1.6, 25.38, 0, 2.2); }
  // جرار وبراميل إضافية (قابلة للكسر)
  for (const [x, z, h] of [[-46.6, -27.6, 0.8], [-51.4, 14.8, 0.95], [85.2, 1.2, 0.9], [-89.2, 22.6, 0.8], [55.4, 18.8, 0.8], [-34.6, 18.8, 0.85], [33.6, -19.4, 0.8], [-15.4, 24, 0.9], [90 - 0.5, 20.5, 0.9]]) vase(x, z, h, R() < 0.3 ? 'copper' : 'clay');
  for (const [x, z] of [[85.3, -0.2], [-47, -26.6], [-33.8, 19.2], [56.2, 23.4], [-61, 24.3], [-38.6, -21]]) barrel(x, z);

  // ================= الملوية على الضفة البعيدة =================
  // مئذنة حلزونية من الآجر بمنحدر يلتفّ خمس دورات، وسور الجامع الكبير بأبراجه نصف الدائرية
  if (vis) {
    const mx = 30, mz = 104, base = 2.6, H = 30, R0 = 8.2, R1 = 2.9, turns = 5, ledge = 1.7, pitch = H / turns;
    B.box(mx - 11, -1, mz - 11, mx + 11, base, mz + 11, 'brickPale', { col: false, ao: null });
    B.geo(() => new THREE.CylinderGeometry(R1, R0, H + pitch * 0.6, 40, 1), T(mx, base + (H + pitch * 0.6) / 2, mz), 'brickPale', { uvs: 0.25 });
    B.geo(() => {
      const P = [], N = [], U = [], I = [], seg = turns * 72;
      for (let i = 0; i <= seg; i++) {
        const t = i / seg, a = t * turns * PI * 2, rc = R0 - (R0 - R1) * t, y = base + t * H, ro = rc + ledge * (1 - t * 0.35);
        const c = Math.cos(a), s2 = Math.sin(a), arc = a * (rc + ro) / 2;
        P.push(rc * c, y, rc * s2, ro * c, y, ro * s2); N.push(0, 1, 0, 0, 1, 0); U.push(arc / 3, 0, arc / 3, ledge / 3);
        P.push(ro * c, y, ro * s2, ro * c, Math.max(base, y - pitch), ro * s2); N.push(c, 0, s2, c, 0, s2); U.push(arc / 3, y / 3, arc / 3, (y - pitch) / 3);
        if (i < seg) { const b = i * 4; I.push(b, b + 4, b + 5, b, b + 5, b + 1, b + 2, b + 3, b + 7, b + 2, b + 7, b + 6); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
      return g;
    }, T(mx, 0, mz), 'brickPale', { uvs: 1 });
    // الجوسق في القمّة: أسطوانة بأقواس ثم قبّة صغيرة
    const top = base + H + pitch * 0.6;
    B.geo(() => new THREE.CylinderGeometry(2.4, 2.6, 4.2, 20, 1), T(mx, top + 2.1, mz), 'brickPale', { uvs: 0.4 });
    for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; B.geo(() => new THREE.BoxGeometry(0.7, 1.8, 0.2), T(mx + Math.cos(a) * 2.52, top + 2.0, mz + Math.sin(a) * 2.52, -a + PI / 2), 'dark'); }
    B.geo(() => new THREE.CylinderGeometry(1.7, 2.5, 1.0, 20, 1), T(mx, top + 4.7, mz), 'brickPale', { uvs: 0.4 });
    // سور الجامع الكبير بأبراج نصف دائرية
    for (const [x0, x1, z] of [[-14, 74, 122]]) {
      B.box(x0, -1, z, x1, 10, z + 2.5, 'brickPale', { col: false, ao: null });
      for (let x = x0 + 3; x < x1; x += 7.3) B.geo(() => new THREE.CylinderGeometry(1.6, 1.8, 11, 14, 1, false, PI, PI), T(x, 4.5, z, 0), 'brickPale', { uvs: 0.4 });
    }
    for (const [x, z0, z1] of [[-14, 96, 122], [74, 96, 122]]) { B.box(x - 1.25, -1, z0, x + 1.25, 10, z1, 'brickPale', { col: false, ao: null }); for (let z = z0 + 3; z < z1; z += 7.3) B.geo(() => new THREE.CylinderGeometry(1.6, 1.8, 11, 14, 1, false, x < 0 ? -PI / 2 : PI / 2, PI), T(x, 4.5, z), 'brickPale', { uvs: 0.4 }); }
    // ضوء دافئ ليلاً عند القاعدة والقمّة
    B.glow(mx, top + 2.4, mz, 1.6, 0xffc070, 0); B.glow(mx - 9, base + 1.2, mz - 11.2, 1.2, 0xffc070, 0); B.glow(mx + 9, base + 1.2, mz - 11.2, 1.2, 0xffc070, 0);
  }

  // ================= تفاصيل الأرضيات =================
  // تشقّقات وبقع زيت وأوراق يابسة ومناهل وأظرفة رصاص وبرك مطر تظهر حين تبتلّ الأرض
  const deco = (x0, z0, x1, z1, k, tiles, s0 = 0.8, s1 = 2.2) => { for (let i = 0; i < k; i++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0), s = s0 + R() * (s1 - s0), t = tiles[Math.floor(R() * tiles.length)], r = R() * PI * 2; B.decal(x, z, s, s * (0.7 + R() * 0.5), r, t); } };
  const puddles = (x0, z0, x1, z1, k) => { for (let i = 0; i < k; i++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0), w = 1.4 + R() * 2.6; B.decal(x, z, w, w * (0.45 + R() * 0.4), R() * PI, -1, 0.014, 'puddle'); } };
  const ST = [0, 1, 2, 4, 13, 14, 15, 15, 3];
  deco(46.5, -29.5, 85.5, 7.5, 70, ST.concat([9, 3, 5])); deco(46.5, -29.5, 85.5, 7.5, 6, [8, 7], 0.9, 1.0); puddles(46.5, -29.5, 85.5, 7.5, 12);
  deco(-51.8, -29.8, -46.2, 17.8, 34, [0, 1, 2, 4, 5, 15, 11, 14]); puddles(-51.5, -29, -46.5, 17, 6);
  deco(-65.6, -21.8, -52.2, -18.2, 8, [1, 5, 15]); deco(-65.6, -5.8, -52.2, -2.2, 8, [1, 5, 15]); deco(-65.6, 8.2, -52.2, 11.8, 8, [1, 5, 15]);
  deco(-89.5, -29.5, -66.5, 17.5, 40, [5, 5, 12, 12, 6, 2]);
  deco(-91.5, 18.4, 91.5, 33, 120, [0, 2, 4, 5, 6, 12, 14, 15]); puddles(-91, 18.6, 91, 32.6, 22);
  deco(-39.8, -23.8, -34.2, 17.8, 34, ST); deco(-39.8, -23.8, -34.2, 17.8, 3, [8, 7], 0.9, 1.0); puddles(-39.6, -23.4, -34.4, 17.4, 6);
  deco(-2.8, -19.8, 2.8, 17.8, 30, [0, 2, 4, 13, 14, 15, 15]); puddles(-2.6, -19, 2.6, 17, 5);
  deco(-39.8, -23.8, -14.2, -20.2, 16, ST); deco(14.2, -23.8, 33.8, -20.2, 14, ST); deco(30.2, -19.8, 33.8, -6.2, 10, ST);
  deco(22.2, -5.8, 35.8, 5.8, 20, [0, 1, 2, 4, 14, 15]); puddles(22.4, -5.4, 35.6, 5.4, 4);
  deco(-31.8, -10.8, -18.2, 6.8, 18, [2, 4, 14, 15]); deco(-13.8, -33.8, 13.8, -20.2, 16, [14, 15, 2]);
  deco(-15.8, -1.8, -3.2, 1.8, 8, ST); deco(3.2, -1.8, 21.8, 1.8, 10, ST); deco(38.2, -2.3, 45.8, 2.3, 4, ST);
  deco(51, -10, 55, -3.4, 12, [10, 10, 10, 2], 0.5, 1.0); // أظرفة رصاص عند نقطة التفتيش
  deco(-58, -27, -54, -23, 3, [11, 2], 0.8, 1.4);

  // ================= نقاط الإحياء المتفرّقة (وضع الإحياء) =================
  B.w.spawnsTdm = [
    [-79, -27], [-87, -20], [-71, 10], [-87, 10], [-79, 15], [-49, -27], [-49, 15], [-60, -20], [-60, 10],
    [49.6, -28.5], [82, -27], [52.6, 6], [83, 5], [66, -1.5], [60, -32.4], [76, -32.4],
    [-82, 28], [-60, 30], [-46, 22], [58, 28], [84, 30], [46, 22], [-30, 22], [30, 22], [-37, -12], [32.8, -12.2],
  ].map(([x, z]) => [x, 0, z, null]);
  // بداية مباراة الإحياء: الفريق الأول على الكورنيش جنوباً، والثاني في الشمال
  B.w.tdmStart = [
    [[-82, 27], [-60, 27], [-30, 27.5], [-4, 29.6], [8, 29.6], [30, 27.5], [58, 28], [84, 27]].map(([x, z]) => [x, 0, z, 0]),
    [[-79, -27], [-49, -27], [-25, -22], [-3, -27.5], [3, -27.5], [22, -22], [60, -32.4], [76, -32.4]].map(([x, z]) => [x, 0, z, PI]),
  ];

  // ================= عقد الملاحة =================
  for (let z = -28; z <= 16; z += 4) n(-49, z);
  n(-49, -26); n(-49, 3);
  for (const x of [-63, -59, -55]) { n(x, -20); n(x, -4); n(x, 10); }
  n(-63, -26); n(-56.5, -26); n(-53.6, -26); n(-60, -23.6); n(-61, -27.4); n(-57, -27.4);
  n(-56, -0.4); n(-53.6, 3); n(-62, 6.4); n(-61, 1); n(-57, 1); n(-61, 6); n(-57, 6); n(-63.5, 3.5);
  for (const z of [-20, -4, 10]) { n(-67.6, z); n(-64.6, z); }
  for (const z of [-28, -24, -20, -16, -12, 4, 8, 12, 16]) n(-79, z);
  n(-85.2, -10.6); n(-85.2, 2.6); n(-72.8, -10.6); n(-72.8, 2.6); n(-84.8, -4); n(-73.2, -4); n(-82.65, -4); n(-75.35, -4); n(-81.3, -4); n(-76.7, -4); n(-79, -6.4); n(-79, -1.5); n(-81.4, -6.2); n(-76.6, -6.2); n(-81.4, -1.8); n(-76.6, -1.8);
  for (let x = -89; x <= -68; x += 4) { n(x, -20); n(x, -4); n(x, 10); }
  for (const z of [-26.7, -14.7, -8.7, 3.3, 15.3]) for (let x = -88; x <= -70; x += 6) n(x, z);
  n(-79, 16.6); n(-79, 20);
  for (let x = -88; x <= -44; x += 8) { n(x, 22); n(x, 28.5); }
  for (let x = 48; x <= 88; x += 8) { n(x, 22); n(x, 28.5); }
  n(49, 0); n(48, -6); n(48, 6);
  for (let x = 48; x <= 84; x += 4) n(x, -32.4);
  const inBed = (x, z) => (x > 50.6 && x < 58.4 || x > 73.6 && x < 81.4) && (z > -26.4 && z < -19.6 || z > -2.4 && z < 4.4);
  for (let x = 48; x <= 84; x += 5) for (let z = -28; z <= 6; z += 5) { if (Math.abs(x - 66) < 5.6 && Math.abs(z + 11) < 5.6 || inBed(x, z) || (x > 80 && x < 84.6 && z > -18.8 && z < -6.4) || (Math.abs(z + 3) < 0.6 && (Math.abs(x - 77.5) < 2.4 || Math.abs(x - 54.5) < 2.4))) continue; n(x, z); }
  for (let x = 48; x <= 84; x += 4) n(x, -28.6);
  for (const [x, z] of [[62.4, -14.6], [66, -14.6], [69.6, -14.6], [62.4, -7.4], [66, -7.4], [69.6, -7.4], [62.4, -11], [69.6, -11]]) n(x, z, 0.3);
  n(84.8, -18.4); n(84.8, -6.4); n(79.8, -18.6); n(79.8, -6.2);
  for (const x of [58, 76]) { n(x, 10); n(x, 14); n(x, 17.2); }
}
