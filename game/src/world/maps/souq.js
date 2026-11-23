// خريطة «سوق المجاهدين» — سوق السلاح في بغداد القديمة
// جنوباً: شريعة دجلة (الفريق أ) · شمالاً: صحن الجامع بالقبة الفيروزية (الفريق ب)
// الوسط: السوق المسقوف بدكاكين السلاح ومشتل ريحانة · غرباً: الخان ثم الحارة المهجورة والمقبرة القديمة · شرقاً: ساحة البئر ثم ساحة الساعة
import * as THREE from 'three';
import { archWallGeo } from '../../gfx/geo.js';
import { MAT, F } from '../collide.js';
import { buildDistricts } from './districts.js';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), EU = new THREE.Euler();
const T = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { EU.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(EU); return new THREE.Matrix4().compose(V.set(x, y, z), Q, SC.set(sx, sy, sz)); };
let seedV = 7; const R = () => { seedV = (seedV * 16807) % 2147483647; return seedV / 2147483647; };
const pick = a => a[Math.floor(R() * a.length)];

export const SOUQ_INFO = {
  id: 'mujahideen', name: 'سوق المجاهدين', sub: 'سوق السلاح · بغداد القديمة',
  sun: { dir: [-0.62, 0.42, 0.38], color: 0xffc58a, intensity: 3.1 },
  sky: { top: 0x3a5a9a, mid: 0xe7a06a, bottom: 0xf3c99a, fog: 0xd9a77c, fogDensity: 0.0085 },
  bounds: [-96, -40, 96, 36],
  mapRect: [-94, -38, 94, 36],
  water: [[-110, 33.6, 110, 70]],
  areas: [
    { name: 'سوق المجاهدين', x: 0, z: -2, big: true }, { name: 'صحن الجامع', x: 0, z: -29 }, { name: 'خان المرجان', x: -25, z: -6 },
    { name: 'ساحة البئر', x: 30, z: -3 }, { name: 'الشريعة', x: 0, z: 27 }, { name: 'الحارة المهجورة', x: -58, z: 3, col: '#ffb3a8' }, { name: 'مضيف الشيخ فاتح', x: -59, z: -12, col: '#bff5c8' },
    { name: 'المقبرة القديمة', x: -77, z: -6, col: '#ff8f8f', big: true }, { name: 'ساحة الساعة', x: 66, z: -9, big: true }, { name: 'مشتل ريحانة', x: -6.5, z: -8.8, col: '#a6ff9a' },
  ],
  lineup: { x: -2.4, z: 23.6, dx: 1.6 },
  mist: [[-90, -30, -66, 18], [-66, -30, -46, 18]],
  haunt: [[-90, -30, -68, 16], [-66, -30, -47, 18]],
};

export function buildSouq(B) {
  seedV = 7;
  const vis = B.vis;
  // ---------------- مساعدات ----------------
  // إطار واجهة: side = 'e'|'w'|'n'|'s' لخط على حافة الكتلة
  const frame = (side, x0, z0, x1, z1) => {
    if (side === 'e') return { L: z1 - z0, at: (u, n) => [x1 + n, z0 + u], ry: Math.PI / 2 };
    if (side === 'w') return { L: z1 - z0, at: (u, n) => [x0 - n, z1 - u], ry: -Math.PI / 2 };
    if (side === 's') return { L: x1 - x0, at: (u, n) => [x0 + u, z1 + n], ry: 0 };
    return { L: x1 - x0, at: (u, n) => [x1 - u, z0 - n], ry: Math.PI };
  };
  const fbox = (f, u0, u1, y0, y1, n0, n1, mat, o) => { const a = f.at(u0, n0), b = f.at(u1, n1); B.box(a[0], y0, a[1], b[0], y1, b[1], mat, o); };
  const fgeo = (f, u, y, n, geo, mat, o, extraRy = 0, s = [1, 1, 1]) => { if (!vis) return; const p = f.at(u, n); B.geo(geo, T(p[0], y, p[1], f.ry + extraRy, s[0], s[1], s[2]), mat, o); };

  // كتلة مبانٍ صلبة (لا تُدخل) مع واجهات مزخرفة على الجهات المطلوبة
  const block = (x0, z0, x1, z1, sides, o = {}) => {
    const hMin = o.hMin ?? 6.5, hMax = o.hMax ?? 9.5;
    // نقسّم الكتلة إلى بيوت بعرض 5–8م على امتداد أطول ضلع لنحصل على خط سماء متنوّع
    const alongX = (x1 - x0) >= (z1 - z0);
    const L = alongX ? x1 - x0 : z1 - z0; let u = 0; const houses = [];
    while (u < L - 0.01) { let w = Math.min(L - u, 5 + R() * 3); if (L - u - w < 3) w = L - u; houses.push([u, u + w, hMin + R() * (hMax - hMin)]); u += w; }
    for (const [a, b, h] of houses) {
      const hx0 = alongX ? x0 + a : x0, hx1 = alongX ? x0 + b : x1, hz0 = alongX ? z0 : z0 + a, hz1 = alongX ? z1 : z0 + b;
      const style = pick(['brick', 'brick', 'mix', 'plaster', 'mix']);
      let lower = style === 'plaster' ? pick(['plasterOchre', 'plaster', 'plasterBlue']) : pick(['brick', 'brick', 'brickPale', 'brickRed']);
      let upper = style === 'brick' ? lower : pick(['plaster', 'plasterOchre', 'plasterWhite', 'plasterBlue']);
      if (o.ruin) { lower = pick(['brickBurnt', 'brickBurnt', 'brick', 'brickPale']); upper = pick(['plasterBurnt', 'brickBurnt', 'plaster', lower]); }
      const split = 3.4;
      B.box(hx0, 0, hz0, hx1, split, hz1, lower);
      B.box(hx0, split, hz0, hx1, h, hz1, upper, { col: true });
      // حزام طابوق داكن بين الطابقين + سقف وشرفة سطح
      if (vis) {
        B.box(hx0 - 0.06, split - 0.12, hz0 - 0.06, hx1 + 0.06, split + 0.18, hz1 + 0.06, 'brickRed', { col: false, faces: 'pxnxpzz nz' });
        B.box(hx0 - 0.1, h, hz0 - 0.1, hx1 + 0.1, h + 0.16, hz1 + 0.1, 'brickPale', { col: false });
        parapet(hx0, hz0, hx1, hz1, h + 0.16, lower);
      }
      const first = a < 0.01, last = b > L - 0.01;
      for (const s of sides) {
        const ends = alongX ? (s === 'w' ? first : s === 'e' ? last : true) : (s === 'n' ? first : s === 's' ? last : true);
        if (!ends) continue;
        facade(frame(s, hx0, hz0, hx1, hz1), h, split, o);
      }
    }
  };
  // سور السطح بفتحات طابوق مزخرفة
  const parapet = (x0, z0, x1, z1, y, mat) => {
    const t = 0.25, ph = 0.7;
    B.box(x0, y, z0, x1, y + ph, z0 + t, mat, { col: false }); B.box(x0, y, z1 - t, x1, y + ph, z1, mat, { col: false });
    B.box(x0, y, z0, x0 + t, y + ph, z1, mat, { col: false }); B.box(x1 - t, y, z0, x1, y + ph, z1, mat, { col: false });
    if (R() < 0.5) { const cx = x0 + (x1 - x0) * (0.3 + R() * 0.4), cz = z0 + (z1 - z0) * (0.3 + R() * 0.4); B.box(cx - 0.6, y, cz - 0.6, cx + 0.6, y + 1.1, cz + 0.6, 'iron', { col: false }); }
  };
  // تفاصيل الواجهة: أبواب، نوافذ، شناشيل، جسور خشبية، فوانيس، لافتات
  const facade = (f, h, split, o) => {
    if (!vis || f.L < 2) return;
    // باب في الطابق الأرضي
    const ruin = o && o.ruin;
    if (f.L > 3.2 && R() < 0.85) {
      const w = 1.2 + R() * 0.4, u = 0.8 + R() * (f.L - w - 1.6), dh = 2.3 + R() * 0.3;
      door(f, u, w, dh, ruin ? pick(['charred', 'woodDark', 'charred']) : pick(['wood', 'woodDark', 'woodBlue', 'woodGreen']));
      if (ruin) { fbox(f, u - 0.3, u + w + 0.3, dh + 0.3, Math.min(h - 0.4, dh + 2.2), 0, 0.025, 'charred', { col: false }); for (let k = 0; k < 2; k++) fbox(f, u - 0.1, u + w + 0.1, 0.7 + k * 0.9, 0.86 + k * 0.9, 0.16, 0.2, 'wood', { col: false }); }
    }
    // نوافذ صغيرة بقضبان
    for (let u = 0.9; u < f.L - 1.2; u += 2.6 + R() * 1.5) if (R() < 0.45) {
      fbox(f, u, u + 0.8, 1.6, 2.5, -0.02, 0.06, 'dark', { col: false });
      if (ruin) { for (const yy of [1.75, 2.2]) fbox(f, u - 0.08, u + 0.88, yy, yy + 0.13, 0.07, 0.11, 'wood', { col: false }); fbox(f, u - 0.2, u + 1.0, 2.5, 3.3, 0, 0.025, 'charred', { col: false }); }
      else for (let k = 1; k < 4; k++) fbox(f, u + k * 0.2 - 0.02, u + k * 0.2 + 0.02, 1.6, 2.5, 0.06, 0.1, 'iron', { col: false });
      fbox(f, u - 0.1, u + 0.9, 1.5, 1.6, 0, 0.14, 'brickPale', { col: false });
    }
    // شناشيل في الطابق العلوي
    if (h > split + 2.6 && f.L >= 3.4 && R() < 0.8) {
      const w = Math.min(f.L - 0.8, 2.6 + R() * 2.4), u = (f.L - w) * (0.2 + R() * 0.6);
      shanasheel(f, u, w, split + 0.35, Math.min(h - split - 0.6, 2.9), 0.85 + R() * 0.25, R() < 0.3 ? 'latticeBlue' : 'lattice', ruin);
    } else if (h > split + 2) {
      for (let u = 1; u < f.L - 1.2; u += 2.2 + R()) { fbox(f, u, u + 0.9, split + 0.8, split + 2.1, -0.02, 0.05, R() < 0.5 ? 'lattice' : 'dark', { col: false }); fbox(f, u - 0.08, u + 0.98, split + 2.1, split + 2.25, 0, 0.12, 'woodDark', { col: false }); }
    }
    // رؤوس جسور خشبية بارزة (حطب السقف)
    for (let u = 0.4; u < f.L - 0.3; u += 0.7) fbox(f, u, u + 0.12, h - 0.45, h - 0.33, 0, 0.22, 'beam', { col: false });
    // مزراب
    if (R() < 0.5) { const u = 0.5 + R() * (f.L - 1); fbox(f, u, u + 0.12, h - 0.25, h - 0.13, 0, 0.6, 'iron', { col: false }); }
    if (R() < 0.35) lanternWall(f, 0.6 + R() * (f.L - 1.2), split - 0.6);
  };
  const door = (f, u, w, h, mat) => {
    // قوس حجري فوق الباب + الباب الخشبي بمسامير
    fbox(f, u - 0.18, u + w + 0.18, 0, h + 0.35, 0, 0.12, 'brickPale', { col: false, faces: 'pxnxpzpynz' });
    fbox(f, u, u + w, 0, h, 0.02, 0.14, mat, { col: false });
    fbox(f, u + w / 2 - 0.02, u + w / 2 + 0.02, 0, h, 0.14, 0.16, 'woodDark', { col: false });
    for (let k = 0; k < 3; k++) fbox(f, u + 0.1, u + w - 0.1, 0.4 + k * 0.7, 0.46 + k * 0.7, 0.14, 0.17, 'iron', { col: false });
    fbox(f, u + w * 0.7, u + w * 0.7 + 0.08, 1.05, 1.15, 0.16, 0.22, 'brass', { col: false });
    fbox(f, u - 0.25, u + w + 0.25, 0, 0.18, 0, 0.35, 'stone', { col: false }); // عتبة
  };
  // الشنشول: بروز خشبي فوق الزقاق بمشبكات وقاعدة مزخرفة
  const shanasheel = (f, u, w, y0, h, d, lat, ruin) => {
    const frameM = ruin ? 'charred' : lat === 'latticeBlue' ? 'woodBlue' : 'woodDark';
    fbox(f, u, u + w, y0 + 0.35, y0 + h, 0, d, null, { vis: false, cm: MAT.wood, flags: F.THIN }); // تصادم واحد للجسم
    fbox(f, u, u + w, y0, y0 + 0.35, 0, d, frameM, { col: false });
    // كوابيل خشبية تحت القاعدة
    for (let k = 0; k <= Math.floor(w / 0.9); k++) { const uu = u + 0.1 + k * (w - 0.3) / Math.max(1, Math.floor(w / 0.9)); fbox(f, uu, uu + 0.12, y0 - 0.45, y0, 0, d * 0.8, frameM, { col: false }); }
    // ألواح المشبك على الوجه الأمامي والجانبين
    const panels = Math.max(2, Math.round(w / 0.75)), pw = w / panels;
    for (let k = 0; k < panels; k++) {
      const a = u + k * pw;
      if (!ruin || R() < 0.55) fbox(f, a + 0.05, a + pw - 0.05, y0 + 0.5, y0 + h - 0.55, d - 0.06, d - 0.02, ruin && R() < 0.5 ? 'charred' : lat, { col: false });
      else fbox(f, a + 0.05, a + pw - 0.05, y0 + 0.5, y0 + h - 0.55, 0.02, 0.06, 'dark', { col: false });
      fbox(f, a, a + 0.06, y0 + 0.35, y0 + h - 0.35, d - 0.08, d, frameM, { col: false });
      fbox(f, a + 0.05, a + pw - 0.05, y0 + 0.36, y0 + 0.5, d - 0.06, d - 0.02, 'woodBlue', { col: false });
    }
    fbox(f, u + w - 0.06, u + w, y0 + 0.35, y0 + h - 0.35, d - 0.08, d, frameM, { col: false });
    for (const side of [u, u + w - 0.04]) fbox(f, side, side + 0.04, y0 + 0.5, y0 + h - 0.55, 0.05, d - 0.06, lat, { col: false });
    fbox(f, u - 0.08, u + w + 0.08, y0 + h - 0.35, y0 + h - 0.2, -0.02, d + 0.08, frameM, { col: false });
    fbox(f, u - 0.12, u + w + 0.12, y0 + h - 0.2, y0 + h - 0.08, -0.02, d + 0.16, 'woodDark', { col: false });
  };
  const lanternWall = (f, u, y) => {
    fbox(f, u - 0.02, u + 0.02, y + 0.3, y + 0.34, 0, 0.45, 'iron', { col: false });
    const p = f.at(u, 0.42); lantern(p[0], y, p[1]);
  };
  // فانوس معلّق: يضيء بالليل (ضوء خافت يرتجف كاللهب) وينكسر زجاجه بطلقة واحدة
  const lantern = (x, y, z, hang = 0) => {
    if (vis) {
      if (hang > 0) B.box(x - 0.01, y + 0.35, z - 0.01, x + 0.01, y + 0.35 + hang, z + 0.01, 'iron', { col: false });
      B.box(x - 0.12, y, z - 0.12, x + 0.12, y + 0.06, z + 0.12, 'brass', { col: false });
      B.geo(() => new THREE.ConeGeometry(0.16, 0.14, 6), T(x, y + 0.37, z), 'brass');
    }
    B.prop('lamp', 1); B.col(x - 0.13, y, z - 0.13, x + 0.13, y + 0.32, z + 0.13, MAT.glass, F.THIN | F.NOPLAYER);
    if (vis) B.box(x - 0.09, y + 0.06, z - 0.09, x + 0.09, y + 0.3, z + 0.09, 'glow', { col: false });
    B.end();
    B.glow(x, y + 0.18, z, 0.9); B.light(x, y + 0.1, z, 0xffa04a, 1.1, 6.5, 2);
  };
  // عمود إنارة خشبي بذراع وفانوس معلّق (نموذج مرخّص CC0) — الذراع تتجه نحو أوسع فراغ
  const streetLamp = (x, z, col = 0xffb060, it = 2.6, dist = 10, fl = 0, ry) => {
    if (ry === undefined) {
      let best = -1; ry = 0;
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const dx = Math.cos(a), dz = -Math.sin(a), free = B.rayBuild(x + dx * 0.2, 2.9, z + dz * 0.2, dx, 0, dz, 4); if (free > best + 0.05) { best = free; ry = a; } }
    }
    B.col(x - 0.36, 0, z - 0.36, x + 0.36, 0.45, z + 0.36, MAT.stone); B.col(x - 0.13, 0.45, z - 0.13, x + 0.13, 3.8, z + 0.13, MAT.wood);
    B.put('lantern', x, 0, z, ry, 1);
    const lx = x + Math.cos(ry) * 1.53, lz = z - Math.sin(ry) * 1.53;
    B.light(lx, 2.7, lz, col, it, dist, fl); B.glow(lx, 2.78, lz, 0.6, col, fl);
    B.prop('lamp', 1); B.col(lx - 0.2, 2.35, lz - 0.2, lx + 0.2, 3.1, lz + 0.2, MAT.glass, F.THIN | F.NOPLAYER); B.end(); // زجاج الفانوس ينكسر بطلقة
  };
  // جدار مستقيم بمحاذاة المحاور
  const wallX = (x0, x1, z, y0, y1, t, mat, o) => B.box(x0, y0, z - t / 2, x1, y1, z + t / 2, mat, o);
  const wallZ = (z0, z1, x, y0, y1, t, mat, o) => B.box(x - t / 2, y0, z0, x + t / 2, y1, z1, mat, o);
  // جدار بأقواس: axis 'x' (يمتد على x عند z ثابت) أو 'z'. holes: [{u,w,h,rise}] بالإحداثيات المحلية
  const archWall = (axis, a0, a1, c, y0, H, t, holes, mat, o = {}) => {
    const L = a1 - a0;
    // التصادم: أجزاء صلبة بين الفتحات + فوقها
    const sorted = [...holes].sort((p, q) => p.u - q.u); let cur = 0;
    const colBox = (u0, u1, yy0, yy1) => { if (u1 - u0 < 0.01 || yy1 - yy0 < 0.01) return; if (axis === 'x') B.col(a0 + u0, y0 + yy0, c - t / 2, a0 + u1, y0 + yy1, c + t / 2, o.cm ?? MAT.brick); else B.col(c - t / 2, y0 + yy0, a0 + u0, c + t / 2, y0 + yy1, a0 + u1, o.cm ?? MAT.brick); };
    for (const hl of sorted) { colBox(cur, hl.u - hl.w / 2, 0, H); colBox(hl.u - hl.w / 2, hl.u + hl.w / 2, (hl.y || 0) + hl.h + (hl.rise ?? hl.w * 0.55) * 0.75, H); if (hl.y) colBox(hl.u - hl.w / 2, hl.u + hl.w / 2, 0, hl.y); cur = hl.u + hl.w / 2; }
    colBox(cur, L, 0, H);
    if (!vis) return;
    const g = archWallGeo(L, H, t, holes.map(hl => ({ x: hl.u, y: hl.y || 0, w: hl.w, h: hl.h, rise: hl.rise ?? hl.w * 0.55 })));
    // الشكل في XY مبثوق على +Z؛ ننقله ليتمركز على السماكة
    if (axis === 'x') B.geo(g, T(a0, y0, c - t / 2), mat, { ao: v => Math.min(1, 0.6 + 0.4 * Math.min(1, (v.y - y0) / 0.9)) });
    else B.geo(g, T(c + t / 2, y0, a0, -Math.PI / 2), mat, { ao: v => Math.min(1, 0.6 + 0.4 * Math.min(1, (v.y - y0) / 0.9)) }); // يطابق فتحات التصادم (a0 + u)
    if (o.trim) { // إطار كاشي حول الأقواس
      for (const hl of holes) {
        const rise = hl.rise ?? hl.w * 0.55, top = (hl.y || 0) + hl.h + rise;
        if (axis === 'x') { for (const s of [-1, 1]) B.box(a0 + hl.u - hl.w / 2 - 0.3, y0 + top + 0.15, c + s * t / 2, a0 + hl.u + hl.w / 2 + 0.3, y0 + top + 0.4, c + s * (t / 2 + 0.04), o.trim, { col: false }); }
        else { for (const s of [-1, 1]) B.box(c + s * t / 2, y0 + top + 0.15, a0 + hl.u - hl.w / 2 - 0.3, c + s * (t / 2 + 0.04), y0 + top + 0.4, a0 + hl.u + hl.w / 2 + 0.3, o.trim, { col: false }); }
      }
    }
  };
  const column = (x, z, y0, h, r, mat, capMat) => {
    B.box(x - r, y0, z - r, x + r, y0 + h, z + r, null, { vis: false, cm: MAT.stone });
    if (!vis) return;
    B.geo(() => new THREE.CylinderGeometry(r * 0.85, r, h, 12, 1), T(x, y0 + h / 2, z), mat);
    B.box(x - r * 1.25, y0, z - r * 1.25, x + r * 1.25, y0 + 0.3, z + r * 1.25, capMat || 'stone', { col: false });
    B.box(x - r * 1.3, y0 + h - 0.3, z - r * 1.3, x + r * 1.3, y0 + h, z + r * 1.3, capMat || 'stone', { col: false });
  };
  // صندوق خشبي قابل للكسر بعد عدة طلقات
  const crate = (x, z, s = 1, y = 0, ry = 0) => {
    B.prop('crate', 120 + s * 90); // يحتاج ضرباً كثيراً قبل أن يتحطّم
    B.box(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, null, { vis: false, cm: MAT.wood, flags: F.THIN });
    if (vis) {
      B.geo(() => new THREE.BoxGeometry(s, s, s), T(x, y + s / 2, z, ry), 'wood', { uvs: 1 });
      for (const yy of [0.12, s - 0.12]) B.geo(() => new THREE.BoxGeometry(s + 0.02, 0.08, s + 0.02), T(x, y + yy, z, ry), 'woodDark', { uvs: 1 });
    }
    B.end();
  };
  // جرّة/مزهرية فخارية قابلة للكسر
  const vase = (x, z, h = 0.9, mat = 'clay', y = 0) => {
    B.prop('vase', 45);
    B.col(x - h * 0.22, y, z - h * 0.22, x + h * 0.22, y + h, z + h * 0.22, MAT.brick, F.THIN);
    if (vis) { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(h * (0.1 + Math.sin(t * Math.PI * 0.95) * 0.2 + (t > 0.88 ? 0.05 : 0)), t * h)); } B.geo(() => new THREE.LatheGeometry(pts, 14), T(x, y, z, R() * 3), mat); }
    B.end();
  };
  // برميل خشبي قابل للكسر
  const barrel = (x, z, y = 0) => {
    B.prop('crate', 160);
    B.col(x - 0.32, y, z - 0.32, x + 0.32, y + 0.95, z + 0.32, MAT.wood, F.THIN);
    if (vis) { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.27 + Math.sin(t * Math.PI) * 0.06, t * 0.95)); } B.geo(() => new THREE.LatheGeometry(pts, 14), T(x, y, z), 'woodDark'); for (const yy of [0.12, 0.83]) B.geo(() => new THREE.TorusGeometry(0.31, 0.015, 4, 16), T(x, y + yy, z, 0, 1, 1, 1, Math.PI / 2), 'iron'); }
    B.end();
  };
  const sack = (x, z, col = 'spice1', y = 0) => {
    B.prop('sack', 70);
    B.col(x - 0.32, y, z - 0.32, x + 0.32, y + 0.7, z + 0.32, MAT.cloth, F.THIN);
    if (vis) {
      B.geo(() => new THREE.CylinderGeometry(0.28, 0.33, 0.6, 10), T(x, y + 0.3, z), 'sack');
      B.geo(() => new THREE.ConeGeometry(0.26, 0.22, 10), T(x, y + 0.7, z), col);
      B.geo(() => new THREE.TorusGeometry(0.28, 0.04, 6, 12), T(x, y + 0.6, z, 0, 1, 1, 1, Math.PI / 2), 'sack');
    }
    B.end();
  };
  // أصيص/قدر: على الأرض يصبح «سندانة» قابلة للكسر
  // استكان چاي عراقي (خصر ضيّق) على صحن، fill: نسبة الچاي (0 فارغ)
  const estR = t => t < 0.38 ? 0.0185 + 0.003 * ((0.38 - t) / 0.38) ** 2 : 0.0185 + 0.008 * ((t - 0.38) / 0.62) ** 1.6;
  const estikan = (x, y, z, fill = 0.85, ry = 0) => {
    if (!vis) return;
    const h = 0.085;
    B.geo(() => new THREE.CylinderGeometry(0.043, 0.035, 0.008, 16), T(x, y + 0.004, z), 'porcelain');
    B.geo(() => new THREE.TorusGeometry(0.036, 0.0025, 4, 16), T(x, y + 0.0085, z, 0, 1, 1, 1, Math.PI / 2), 'porcBlue');
    B.geo(() => { const P = [new THREE.Vector2(0.001, 0)]; for (let i = 0; i <= 8; i++) P.push(new THREE.Vector2(estR(i / 8), i / 8 * h)); return new THREE.LatheGeometry(P, 12); }, T(x, y + 0.008, z), 'glass');
    if (fill > 0.04) B.geo(() => { const P = [new THREE.Vector2(0.001, 0.004)]; for (let i = 0; i <= 6; i++) { const t = i / 6 * fill; P.push(new THREE.Vector2(estR(t) * 0.86, 0.004 + t * h * 0.92)); } P.push(new THREE.Vector2(0.001, 0.004 + fill * h * 0.92)); return new THREE.LatheGeometry(P, 12); }, T(x, y + 0.008, z), 'tea');
    B.geo(() => new THREE.BoxGeometry(0.005, 0.003, 0.055), T(x + Math.cos(ry) * 0.026, y + 0.011, z + Math.sin(ry) * 0.026, ry + 0.4), 'chrome'); // خاشوگة
  };
  // قوري چاي فرفوري بحزام أزرق
  const qouri = (x, y, z, ry = 0, sc = 1) => {
    if (!vis) return;
    const m = (lx, ly, lz, rx = 0, rz = 0, s = 1, yo = 0) => T(x + (Math.cos(ry) * lx + Math.sin(ry) * lz) * sc, y + ly * sc, z + (-Math.sin(ry) * lx + Math.cos(ry) * lz) * sc, ry + yo, s * sc, s * sc, s * sc, rx, rz);
    B.geo(() => { const P = []; for (let i = 0; i <= 10; i++) { const t = i / 10; P.push(new THREE.Vector2(0.035 + Math.sin(t * Math.PI) * 0.03 - t * 0.012, t * 0.1)); } return new THREE.LatheGeometry(P, 16); }, m(0, 0, 0), 'porcelain');
    B.geo(() => new THREE.TorusGeometry(0.06, 0.004, 4, 18), m(0, 0.05, 0, Math.PI / 2), 'porcBlue');
    B.geo(() => new THREE.SphereGeometry(0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m(0, 0.098, 0), 'porcelain');
    B.geo(() => new THREE.SphereGeometry(0.009, 6, 5), m(0, 0.13, 0), 'porcBlue');
    B.geo(() => new THREE.CylinderGeometry(0.006, 0.012, 0.08, 8), m(0, 0.065, -0.075, -0.75), 'porcelain');
    B.geo(() => new THREE.TorusGeometry(0.032, 0.006, 5, 10, Math.PI), m(0, 0.055, 0.06, 0, Math.PI / 2, 1, Math.PI / 2), 'porcelain');
  };
  // كتلي ماي على منقلة فحم، والقوري فوقه
  const teaStove = (x, y, z, ry = 0) => {
    if (!vis) return;
    B.geo(() => new THREE.CylinderGeometry(0.13, 0.11, 0.1, 12), T(x, y + 0.05, z), 'iron');
    B.geo(() => new THREE.CylinderGeometry(0.11, 0.11, 0.01, 12), T(x, y + 0.101, z), 'charred');
    B.geo(() => { const P = []; for (let i = 0; i <= 10; i++) { const t = i / 10; P.push(new THREE.Vector2(0.06 + Math.sin(t * Math.PI * 0.9) * 0.06 - t * 0.02, t * 0.15)); } return new THREE.LatheGeometry(P, 16); }, T(x, y + 0.105, z), 'chrome');
    B.geo(() => new THREE.CylinderGeometry(0.008, 0.016, 0.12, 8), T(x - Math.sin(ry) * 0.1, y + 0.18, z - Math.cos(ry) * 0.1, ry, 1, 1, 1, -0.8), 'chrome');
    qouri(x, y + 0.255, z, ry, 0.85);
  };
  const pot = (x, y, z, r = 0.25, mat = 'copper', solid) => {
    const brk = (solid ?? (y < 0.05 && r >= 0.12)) && !B.cur;
    if (brk) { B.prop('vase', 70); B.col(x - r * 0.8, y, z - r * 0.8, x + r * 0.8, y + r * 2.2, z + r * 0.8, MAT.brick, F.THIN); }
    if (vis) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r * (0.5 + Math.sin(t * Math.PI) * 0.6 + (t > 0.85 ? 0.2 : 0)), t * r * 2.2)); } B.geo(() => new THREE.LatheGeometry(pts, 14), T(x, y, z), mat); }
    if (brk) B.end();
  };
  const palm = (x, z, h = 7, lean = 0.15, ry = 0) => {
    B.col(x - 0.22, 0, z - 0.22, x + 0.22, h, z + 0.22, MAT.wood);
    if (!vis) return;
    const segs = 6, lx = Math.cos(ry) * lean, lz = Math.sin(ry) * lean;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs, x0 = x + lx * h * t0 * t0, z0 = z + lz * h * t0 * t0, x1 = x + lx * h * t1 * t1, z1 = z + lz * h * t1 * t1;
      const seg = new THREE.Vector3(x1 - x0, h / segs, z1 - z0), len = seg.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), seg.clone().normalize());
      const m = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, h * (t0 + t1) / 2, (z0 + z1) / 2), q, new THREE.Vector3(1, 1, 1));
      B.geo(() => new THREE.CylinderGeometry(0.2 - t1 * 0.06, 0.24 - t0 * 0.06, len, 8, 1, true), m, 'palm');
    }
    const tx = x + lx * h, tz = z + lz * h;
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * Math.PI * 2 + R() * 0.3, droop = 0.25 + R() * 0.5, L = 2.8 + R() * 1.2;
      const g = new THREE.PlaneGeometry(L, L / 2, 4, 1); g.translate(L / 2, 0, 0);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i); p.setY(i, p.getY(i) - (px / L) * (px / L) * L * 0.45); }
      g.rotateX(-Math.PI / 2 + 0.2); g.computeVertexNormals();
      B.geo(g, T(tx, h, tz, a, 1, 1, 1, 0, droop * -0.6), 'leaf', { uvs: 1, ao: 1 });
    }
    B.geo(() => new THREE.SphereGeometry(0.32, 8, 6), T(tx, h - 0.1, tz), 'dates');
  };
  const bench = (x, z, len, axis = 'x') => {
    const [sx, sz] = axis === 'x' ? [len, 0.5] : [0.5, len];
    B.boxB(x, 0, z, sx, 0.45, sz, 'woodDark', {});
    if (vis) B.boxB(x, 0.45, z, sx + 0.04, 0.06, sz + 0.04, 'carpet2', { col: false });
  };
  const table = (x, z) => {
    B.col(x - 0.4, 0, z - 0.4, x + 0.4, 0.75, z + 0.4, MAT.wood, F.THIN);
    if (!vis) return;
    B.geo(() => new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16), T(x, 0.74, z), 'woodDark');
    B.geo(() => new THREE.CylinderGeometry(0.05, 0.08, 0.72, 8), T(x, 0.36, z), 'iron');
    // استكانات الزبائن: واحد بيه نص چاي وواحد خالص (ينتظرون الجولة الجاية)
    estikan(x + 0.14, 0.765, z + 0.08, 0.5, R() * 6); estikan(x - 0.16, 0.765, z + 0.12, 0, R() * 6); if (R() < 0.6) estikan(x - 0.02, 0.765, z - 0.18, 0.3, R() * 6);
  };
  // مجسّم سلاح مبسّط للعرض (يُبنى من صناديق محاذية للمحاور): o='h' أفقي (السبطانة نحو ±z) أو 'v' عمودي
  const gunProp = (x, y, z, o = 'h', dir = 1, kind = 'rifle', s = 1) => {
    if (!vis) return;
    const P = kind === 'pistol' ? [[-0.08, 0.1, -0.03, 0.012, 'gunmetal'], [-0.08, -0.035, 0.012, 0.1, 'gunmetal']]
      : kind === 'sniper' ? [[-0.62, -0.3, -0.03, 0.1, 'woodDark'], [-0.3, 0.12, -0.04, 0.03, 'gunmetal'], [0.12, 0.62, -0.012, 0.012, 'gunmetal'], [-0.22, 0.02, -0.11, -0.05, 'gunmetal'], [-0.25, -0.2, 0.03, 0.12, 'gunmetal'], [-0.1, -0.03, 0.03, 0.08, 'gunmetal']]
      : kind === 'launcher' ? [[-0.55, 0.55, -0.06, 0.06, 'olive'], [-0.1, -0.05, 0.06, 0.18, 'gunmetal'], [0.1, 0.15, 0.06, 0.15, 'gunmetal']]
      : [[-0.46, -0.18, -0.02, 0.09, kind === 'ak' ? 'woodDark' : 'gunmetal'], [-0.18, 0.12, -0.045, 0.03, 'gunmetal'], [0.12, 0.3, -0.03, 0.03, kind === 'ak' ? 'woodDark' : 'gunmetal'], [0.3, 0.5, -0.011, 0.011, 'gunmetal'], [-0.02, 0.06, 0.03, 0.18, 'gunmetal'], [-0.13, -0.08, 0.03, 0.12, 'gunmetal']];
    const th = (kind === 'pistol' ? 0.03 : 0.05) * s;
    for (const [u0, u1, v0, v1, m] of P) {
      if (o === 'h') { const za = z + u0 * dir * s, zb = z + u1 * dir * s; B.box(x - th / 2, y - v1 * s, Math.min(za, zb), x + th / 2, y - v0 * s, Math.max(za, zb), m, { col: false }); }
      else if (o === 'v') B.box(x - th / 2, y + u0 * s, z + v0 * s * dir, x + th / 2, y + u1 * s, z + v1 * s * dir, m, { col: false });
      else if (o === 'flat') B.box(x + u0 * dir * s, y, z + v0 * s, x + u1 * dir * s, y + th, z + v1 * s, m, { col: false }); // ممدّد على طاولة: السبطانة نحو ±x
      else { const xa = x + u0 * dir * s, xb = x + u1 * dir * s; B.box(Math.min(xa, xb), y - v1 * s, z - th / 2, Math.max(xa, xb), y - v0 * s, z + th / 2, m, { col: false }); } // 'x': قائم والسبطانة نحو ±x
    }
  };
  // دكّان سلاح في السوق (side: 1 يمين/-1 يسار من شارع السوق). kind 'nursery' = مشتل ريحانة
  const SHOP_SIGN = { rifles: 'بنادق ومناظير', pistols: 'مسدسات الرافدين', ammo: 'ذخيرة وعتاد', armor: 'دروع وخوذ', blades: 'خناجر وسيوف', heavy: 'رشاشات وقاذفات' };
  const shop = (xFace, z0, z1, side, forceKind) => {
    const d = 2.2, x0 = side > 0 ? xFace : xFace - d, x1 = side > 0 ? xFace + d : xFace;
    const inner = side > 0 ? x1 : x0;
    B.box(x0, 0, z0, x1, 0.25, z1, 'woodDark');
    B.box(side > 0 ? inner - 0.3 : inner, 0.25, z0, side > 0 ? inner : inner + 0.3, 4.6, z1, 'plaster');
    if (!vis) { B.col(x0, 0.25, z0, x1, 1.0, z1, MAT.wood, F.THIN); return; }
    B.box(x0, 3.2, z0, x1, 3.35, z1, 'beam', { col: false });
    B.box(x0, 3.35, z0, x1, 4.6, z1, 'brick', { faces: side > 0 ? 'nxny' : 'pxny' });
    const kind = forceKind || pick(['rifles', 'rifles', 'pistols', 'ammo', 'armor', 'blades', 'heavy']);
    const mid = (z0 + z1) / 2, cx = (x0 + x1) / 2, wallX = inner - side * 0.32, back = inner - side * 0.55;
    B.col(x0, 0.25, z0, x1, 1.0, z1, MAT.wood, F.THIN);
    const counter = (mat = 'woodDark') => { B.box(Math.min(xFace + side * 0.15, xFace + side * 0.75), 0.25, z0 + 0.25, Math.max(xFace + side * 0.15, xFace + side * 0.75), 1.05, z1 - 0.25, mat, { col: false }); B.box(Math.min(xFace + side * 0.1, xFace + side * 0.8), 1.05, z0 + 0.2, Math.max(xFace + side * 0.1, xFace + side * 0.8), 1.1, z1 - 0.2, 'beam', { col: false }); };
    if (kind === 'nursery') {
      // مشتل ريحانة: أصص ونباتات وزهور ونخلة صغيرة وسلال معلّقة
      B.box(x0, 0.25, z0, x1, 0.27, z1, 'mud', { col: false });
      for (let k = 0; k < 3; k++) B.box(Math.min(back - side * 0.25, back + side * 0.25), 0.9 + k * 0.65, z0 + 0.15, Math.max(back - side * 0.25, back + side * 0.25), 0.95 + k * 0.65, z1 - 0.15, 'wood', { col: false });
      const plant = (x, y, z, sz) => { const own = y < 0.05 && !B.cur; if (own) { B.prop('vase', 70); B.col(x - sz * 0.45, y, z - sz * 0.45, x + sz * 0.45, y + sz * 1.3, z + sz * 0.45, MAT.brick, F.THIN); } pot(x, y, z, sz * 0.55, 'clay', false); B.geo(() => new THREE.IcosahedronGeometry(sz, 1), T(x, y + sz * 1.6, z, R() * 3, 1, 0.85, 1), pick(['leafGreen', 'leafDark'])); if (R() < 0.6) for (let f = 0; f < 4; f++) B.geo(() => new THREE.SphereGeometry(sz * 0.18, 6, 4), T(x + (R() - 0.5) * sz * 1.3, y + sz * (1.6 + R() * 0.7), z + (R() - 0.5) * sz * 1.3), pick(['flowerRed', 'flowerYellow', 'flowerPink', 'flowerWhite'])); if (own) B.end(); };
      for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) plant(back, 0.95 + k * 0.65, z0 + 0.4 + j * (z1 - z0 - 0.8) / 3, 0.13 + R() * 0.05);
      for (let j = 0; j < 3; j++) plant(cx + side * 0.2, 0.27, z0 + 0.5 + j * (z1 - z0 - 1) / 2, 0.24 + R() * 0.08);
      // نخلة صغيرة في أصيص كبير على باب المشتل وأصص خارج الدكان
      pot(xFace - side * 0.55, 0, z0 - 0.15, 0.3, 'clay'); for (let k = 0; k < 7; k++) { const g = new THREE.PlaneGeometry(1.1, 0.5); g.translate(0.55, 0, 0); g.rotateX(-Math.PI / 2 + 0.3); B.geo(g, T(xFace - side * 0.55, 0.75, z0 - 0.15, k / 7 * Math.PI * 2, 1, 1, 1, 0, -0.4), 'leaf', { uvs: 1 }); }
      plant(xFace - side * 0.5, 0, z1 + 0.15, 0.26); plant(xFace - side * 0.9, 0, z1 - 0.3, 0.2);
      for (let j = 0; j < 3; j++) { const z = z0 + 0.5 + j * (z1 - z0 - 1) / 2; B.box(cx - 0.01, 2.5, z - 0.01, cx + 0.01, 3.2, z + 0.01, 'iron', { col: false }); B.geo(() => new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), T(cx, 2.5, z), 'clay'); B.geo(() => new THREE.IcosahedronGeometry(0.24, 1), T(cx, 2.42, z, 0, 1, 1.3, 1), 'leafGreen'); }
      B.light(cx, 2.8, mid, 0xd8ffb0, 2.2, 7);
      signs.push({ text: 'مشتل ريحانة', x: xFace - side * 0.03, y: 3.98, z: mid, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, w: Math.min(2.6, z1 - z0 - 0.3), opt: { bg: '#1f5a2e', border: '#c8f5a0', fg: '#f4ffe8' } });
      B.npc({ x: xFace + side * 1.05, y: 0.25, z: mid + 0.35, yaw: side * Math.PI / 2, pose: 'stand', look: 'nursery' });
      return;
    }
    if (kind === 'spice') {
      // عطارة أبو ستّار: أكياس طحين وحمص، صحون بهارات مكوّمة، علب چاي، فلفل مجفّف معلّق، ميزان نحاسي
      for (let k = 0; k < 3; k++) B.box(Math.min(back - side * 0.25, back + side * 0.25), 1.0 + k * 0.62, z0 + 0.15, Math.max(back - side * 0.25, back + side * 0.25), 1.05 + k * 0.62, z1 - 0.15, 'wood', { col: false });
      const SP = ['flowerRed', 'flowerYellow', 'clay', 'tan', 'leafDark', 'brickBurnt'];
      for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) { const z = z0 + 0.35 + j * (z1 - z0 - 0.7) / 4, y = 1.05 + k * 0.62; if (k === 1) { B.boxB(back, y, z, 0.26, 0.3, 0.2, j % 2 ? 'paintRed' : 'tileGreen', { col: false }); } else { B.geo(() => new THREE.CylinderGeometry(0.11, 0.1, 0.14, 10), T(back, y, z), 'porcelain'); B.geo(() => new THREE.ConeGeometry(0.1, 0.12, 10), T(back, y + 0.2, z), SP[(j + k) % SP.length]); } }
      for (let j = 0; j < 3; j++) sackVis(cx + side * 0.15, z0 + 0.45 + j * (z1 - z0 - 0.9) / 2, j === 1 ? 'tan' : 'flowerWhite', 0.25);
      counter('wood');
      for (let j = 0; j < 4; j++) { const z = z0 + 0.45 + j * (z1 - z0 - 0.9) / 3; B.geo(() => new THREE.CylinderGeometry(0.16, 0.12, 0.08, 12), T(xFace + side * 0.45, 1.1, z), 'copper'); B.geo(() => new THREE.ConeGeometry(0.14, 0.13, 12), T(xFace + side * 0.45, 1.2, z), SP[j]); }
      for (let j = 0; j < 3; j++) { const z = z0 + 0.5 + j * (z1 - z0 - 1) / 2; for (let k = 0; k < 6; k++) B.geo(() => new THREE.ConeGeometry(0.035, 0.12, 6), T(xFace + side * 0.3, 2.9 - k * 0.11, z, 0, 1, 1, 1, Math.PI), 'paintRed'); }
      B.geo(() => new THREE.CylinderGeometry(0.13, 0.13, 0.02, 12), T(xFace + side * 0.5, 1.4, mid - 0.25), 'brass'); B.box(xFace + side * 0.5 - 0.01, 1.1, mid - 0.26, xFace + side * 0.5 + 0.01, 1.4, mid - 0.24, 'brass', { col: false });
      lantern(cx, 2.6, mid, 0.5);
      B.npc({ x: xFace + side * 1.12, y: 0.25, z: mid + 0.2, yaw: side * Math.PI / 2, pose: 'stand', look: 'spice' });
      signs.push({ text: 'عطارة أبو ستّار', x: xFace - side * 0.03, y: 3.98, z: mid, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, w: Math.min(2.6, z1 - z0 - 0.3), opt: { bg: '#5a2a10', border: '#ffcf7a', fg: '#fff2d8' } });
      return;
    }
    if (kind === 'pharmacy') {
      // صيدلية الشفاء: رفوف علب بيضاء وخضراء، كاونتر زجاجي، صليب أخضر مضيء
      B.box(Math.min(wallX, wallX + side * 0.04), 0.9, z0 + 0.2, Math.max(wallX, wallX + side * 0.04), 3.0, z1 - 0.2, 'porcelain', { col: false });
      for (let k = 0; k < 4; k++) { const y = 1.0 + k * 0.5; B.box(Math.min(back - side * 0.22, back + side * 0.22), y, z0 + 0.15, Math.max(back - side * 0.22, back + side * 0.22), y + 0.04, z1 - 0.15, 'porcelain', { col: false }); for (let j = 0; j < 7; j++) if (R() < 0.85) B.boxB(back, y + 0.04, z0 + 0.3 + j * (z1 - z0 - 0.6) / 6, 0.2, 0.14 + R() * 0.12, 0.16, R() < 0.5 ? 'porcelain' : R() < 0.5 ? 'tileGreen' : 'paintRed', { col: false }); }
      counter('porcelain'); B.box(Math.min(xFace + side * 0.15, xFace + side * 0.75), 1.1, z0 + 0.25, Math.max(xFace + side * 0.15, xFace + side * 0.75), 1.3, z1 - 0.25, 'glass', { col: false });
      for (const [a, b2, c] of [[0.5, 0.14, 0.14], [0.14, 0.5, 0.14]]) B.boxB(xFace - side * 0.08, 3.3 - b2 / 2 + 0.03, z1 + 0.05, c, b2, a, 'tileGreen', { col: false });
      B.glow(xFace - side * 0.1, 3.33, z1 + 0.05, 0.6, 0x5aff8a, 0);
      B.light(cx, 2.8, mid, 0xe8fff2, 2.0, 7);
      B.npc({ x: xFace + side * 1.12, y: 0.25, z: mid, yaw: side * Math.PI / 2, pose: 'stand', look: 'pharmacist' });
      signs.push({ text: 'صيدلية الشفاء', x: xFace - side * 0.03, y: 3.98, z: mid, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, w: Math.min(2.6, z1 - z0 - 0.3), opt: { bg: '#0f5a3a', border: '#e8fff2', fg: '#ffffff' } });
      return;
    }
    // لوح عرض خشبي على الجدار الخلفي
    B.box(Math.min(wallX, wallX + side * 0.04), 1.0, z0 + 0.2, Math.max(wallX, wallX + side * 0.04), 3.0, z1 - 0.2, kind === 'blades' ? 'carpet' : kind === 'armor' ? 'woodDark' : 'clothCream', { col: false });
    const gx = wallX - side * 0.04;
    if (kind === 'rifles' || kind === 'heavy') {
      const n = Math.max(2, Math.floor((z1 - z0 - 0.4) / 0.36));
      for (let j = 0; j < n; j++) gunProp(gx, 1.6, z0 + 0.38 + j * (z1 - z0 - 0.76) / (n - 1), 'v', side, R() < 0.4 ? 'ak' : 'rifle', 0.95);
      gunProp(gx, 2.72, mid, 'h', R() < 0.5 ? 1 : -1, kind === 'heavy' ? 'launcher' : 'sniper', 1);
      counter(); gunProp(xFace + side * 0.45, 1.1, mid, 'flat', -side, 'pistol', 1.2);
      if (kind === 'heavy') for (let j = 0; j < 2; j++) B.boxB(cx, 0.25, z0 + 0.5 + j * 0.6, 0.5, 0.3, 0.3, 'ammo', { col: false });
    } else if (kind === 'pistols') {
      counter(); B.box(Math.min(xFace + side * 0.15, xFace + side * 0.75), 1.1, z0 + 0.25, Math.max(xFace + side * 0.15, xFace + side * 0.75), 1.3, z1 - 0.25, 'glass', { col: false });
      for (let j = 0; j < 4; j++) gunProp(xFace + side * 0.45, 1.1, z0 + 0.45 + j * (z1 - z0 - 0.9) / 3, 'flat', -side, 'pistol', 1.1);
      for (let r = 0; r < 3; r++) for (let j = 0; j < 4; j++) gunProp(gx, 1.35 + r * 0.55, z0 + 0.5 + j * (z1 - z0 - 1) / 3, 'h', 1, 'pistol', 1.4);
    } else if (kind === 'ammo') {
      for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) if (R() < 0.85) { const bz = z0 + 0.35 + j * (z1 - z0 - 0.7) / 2; B.boxB(back + side * 0.05, 0.25 + k * 0.32, bz, 0.42, 0.3, 0.6, 'ammo', { col: false }); B.boxB(back + side * 0.05, 0.25 + k * 0.32 + 0.12, bz, 0.43, 0.05, 0.61, 'gold', { col: false }); }
      for (let j = 0; j < 5; j++) B.geo(() => new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), T(cx + (R() - 0.5) * 0.5, 0.31, z0 + 0.4 + R() * (z1 - z0 - 0.8), 0, 1, 1, 1, Math.PI / 2, R() * 3), 'brass');
      B.boxB(cx, 0.25, mid, 0.7, 0.4, 0.9, 'sack', { col: false }); B.boxB(cx, 0.65, mid, 0.66, 0.35, 0.86, 'sack', { col: false });
      gunProp(gx, 2.4, mid, 'h', -1, 'rifle', 1);
    } else if (kind === 'armor') {
      for (let k = 0; k < 2; k++) for (let j = 0; j < 4; j++) { const z = z0 + 0.45 + j * (z1 - z0 - 0.9) / 3, y = 1.5 + k * 0.8; B.box(Math.min(back - side * 0.2, back + side * 0.2), y - 0.05, z - 0.2, Math.max(back - side * 0.2, back + side * 0.2), y, z + 0.2, 'wood', { col: false }); B.geo(() => new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), T(back, y, z, 0, 1, 0.9, 1.1), R() < 0.5 ? 'olive' : 'tan'); }
      for (let j = 0; j < 2; j++) { const z = z0 + 0.6 + j * (z1 - z0 - 1.2); B.boxB(gx, 0.4, z, 0.14, 0.62, 0.5, R() < 0.5 ? 'olive' : 'tan', { col: false }); B.boxB(gx - side * 0.04, 0.55, z, 0.1, 0.16, 0.46, 'iron', { col: false }); }
    } else if (kind === 'blades') {
      for (let j = 0; j < 4; j++) { const z = z0 + 0.45 + j * (z1 - z0 - 0.9) / 3; B.box(gx - 0.01, 1.15, z - 0.03, gx + 0.01, 2.5, z + 0.03, 'metal', { col: false }); B.box(gx - 0.02, 1.35, z - 0.14, gx + 0.02, 1.4, z + 0.14, 'gold', { col: false }); B.box(gx - 0.025, 1.12, z - 0.03, gx + 0.025, 1.35, z + 0.03, 'woodDark', { col: false }); }
      counter(); for (let j = 0; j < 3; j++) B.box(xFace + side * 0.4 - 0.15, 1.1, z0 + 0.5 + j * 0.6 - 0.02, xFace + side * 0.4 + 0.15, 1.13, z0 + 0.5 + j * 0.6 + 0.02, 'metal', { col: false });
    }
    lantern(cx, 2.6, mid, 0.5);
    // البائع جالس خلف بسطته
    B.npc({ x: xFace + side * 1.12, y: 0.25, z: mid + (R() - 0.5) * 0.5, yaw: side * Math.PI / 2, pose: R() < 0.72 ? 'sit' : 'stand', look: 'vendor' });
    signs.push({ text: SHOP_SIGN[kind], x: xFace - side * 0.03, y: 3.98, z: mid, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, w: Math.min(2.6, z1 - z0 - 0.3), opt: { bg: '#2a2320', border: '#d9b56a' } });
  };
  const sackVis = (x, z, col, y) => { if (!vis) return; B.geo(() => new THREE.CylinderGeometry(0.28, 0.33, 0.6, 10), T(x, y + 0.3, z), 'sack'); B.geo(() => new THREE.ConeGeometry(0.26, 0.22, 10), T(x, y + 0.7, z), col); };
  const signs = [];

  // ================= الأرض والحدود =================
  B.col(-100, -1, -50, 100, 0, 34, MAT.stone); // أرضية التصادم
  const floor = (x0, z0, x1, z1, mat) => { if (vis) B.box(x0, -0.2, z0, x1, 0, z1, mat, { col: false, faces: 'py' }); };
  floor(-14, -34, 14, -20, 'marble');           // صحن الجامع
  floor(-3, -20, 3, 18, 'stone');               // السوق
  floor(-92, 18, 92, 33.5, 'stone');            // الشريعة
  floor(-40, -24, -34, 18, 'paving');           // الشارع الغربي
  floor(-40, -24, -14, -20, 'paving');          // الزقاق الشمالي الغربي
  floor(-16, -2, -3, 2, 'paving');              // ممرّ السوق-الخان
  floor(3, -2, 22, 2, 'paving');                // ممرّ السوق-الساحة
  floor(14, -24, 34, -20, 'paving');            // الزقاق الشمالي الشرقي
  floor(30, -20, 34, -6, 'paving');             // زقاق الشناشيل 1
  floor(22, -6, 36, 6, 'stone');                // ساحة البئر
  floor(36, -6, 38, 6, 'stone'); floor(38, -2.5, 46, 2.5, 'paving'); // باب الساعة
  floor(-46, -6, -40, -2, 'paving'); floor(-46, 8, -40, 12, 'paving'); // ممرّا الحارة المهجورة
  floor(22, 6, 26, 18, 'paving');               // زقاق الشناشيل 2
  floor(-32, -11, -18, 7, 'stone');             // الخان
  // جدران حدودية غير مرئية عالية
  B.col(-110, 0, -50, -92, 40, 40); B.col(92, 0, -50, 110, 40, 40); B.col(-110, 0, -50, 110, 40, -36);
  B.col(-110, -3, 33.6, 110, 6, 40, MAT.water, F.NOBULLET); // حافة النهر
  // ================= كتل البيوت =================
  block(-46, -36, -14, -24, ['s', 'e']);           // شمال غرب
  block(-46, -24, -40, -6, ['e', 'w']);            // غرب الشارع الغربي (ممرّان نحو الحارة المهجورة)
  block(-46, -2, -40, 8, ['e', 'w']);
  block(-46, 12, -40, 18, ['e', 'w']);
  block(-34, -20, -14, -14, ['w', 'n', 's']);      // بين الشارع والخان شمالاً
  block(-34, 10, -16, 18, ['w', 's', 'n'], { hMin: 6, hMax: 8 }); // جنوب الخان
  block(-16, -20, -5.2, -2, ['s', 'n'], { hMin: 7, hMax: 9 }); // بين الخان والسوق شمالاً
  block(-16, 2, -5.2, 18, ['n', 's'], { hMin: 6.5, hMax: 8.5 });  // بين الخان والسوق جنوباً
  block(5.2, -20, 22, -2, ['s', 'n'], { hMin: 7, hMax: 9.5 });     // شرق السوق شمالاً
  block(5.2, 2, 22, 18, ['n', 's', 'e'], { hMin: 6.5, hMax: 8.5 }); // شرق السوق جنوباً
  block(14, -36, 46, -24, ['s', 'w']);             // شمال شرق
  block(22, -20, 30, -6, ['e', 'n', 's', 'w']);    // بين الزقاقين
  block(34, -24, 46, -6, ['w', 'n', 's', 'e']);    // شرق الزقاق
  block(38, -6, 46, -2.5, ['w', 's', 'e']);        // شرق الساحة: باب الساعة بينهما
  block(38, 2.5, 46, 6, ['w', 'n', 'e']);
  block(26, 6, 46, 18, ['w', 'n', 's', 'e'], { hMin: 6, hMax: 8 }); // جنوب شرق

  // ================= صحن الجامع (شمال) =================
  // الحرم شمالاً بإيوان كبير وقبة فيروزية ومنارة
  const hallZ = -34;
  B.box(-14, 0, -44, 14, 9, hallZ, 'brickPale', { col: true });
  archWall('x', -14, 14, hallZ - 0.01, 0, 11, 0.9, [{ u: 14, w: 7, h: 5.5, rise: 3.2 }], 'brickPale', { trim: 'tileBlue' });
  // تجويف الإيوان (عمق 3م) مكسو بالكاشي
  B.box(-3.5, 0, hallZ - 3, 3.5, 8.6, hallZ - 2.8, 'tileTurq');
  B.box(-3.6, 0, hallZ - 3, -3.4, 8.6, hallZ, 'tileTurq', { col: false }); B.box(3.4, 0, hallZ - 3, 3.6, 8.6, hallZ, 'tileTurq', { col: false });
  B.box(-3.5, 8.6, hallZ - 3, 3.5, 8.8, hallZ, 'tileGold', { col: false });
  if (vis) {
    B.box(-1.2, 0, hallZ - 2.78, 1.2, 3.2, hallZ - 2.7, 'woodDark', { col: false }); // باب الحرم
    // إطار علوي وحزام كاشي
    B.box(-14, 9, -44, 14, 9.4, hallZ, 'tileBlue', { col: false, faces: 'pznzpxnx' });
    B.box(-8, 10.6, -0.4 + hallZ, 8, 11.3, hallZ + 0.05, 'tileGold', { col: false, faces: 'pz' });
    // القبة على رقبة مثمنة
    const dx = 0, dz = -39.5;
    B.geo(() => new THREE.CylinderGeometry(5.2, 5.2, 2.2, 16), T(dx, 10.1, dz), 'tileBlue');
    B.geo(() => new THREE.SphereGeometry(5.3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), T(dx, 11.2, dz, 0, 1, 1.25, 1), 'tileTurq', { uvs: 4 });
    B.geo(() => new THREE.CylinderGeometry(0.08, 0.25, 1.6, 8), T(dx, 18.4, dz), 'gold');
    B.geo(() => new THREE.SphereGeometry(0.32, 12, 8), T(dx, 17.9, dz), 'gold');
    B.geo(() => new THREE.TorusGeometry(0.35, 0.06, 6, 14), T(dx, 19.3, dz, 0, 1, 1, 1, 0), 'gold');
    // قبتان صغيرتان
    for (const sx of [-9, 9]) { B.geo(() => new THREE.CylinderGeometry(2, 2, 1, 12), T(sx, 9.5, -40), 'brickPale'); B.geo(() => new THREE.SphereGeometry(2.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), T(sx, 10, -40), 'tileTurq', { uvs: 2 }); }
  }
  // المنارة (زخرفية، لا تُصعد)
  {
    const mx = 11.5, mz = -38.5;
    B.col(mx - 1.6, 0, mz - 1.6, mx + 1.6, 30, mz + 1.6, MAT.brick);
    if (vis) {
      B.geo(() => new THREE.CylinderGeometry(1.6, 1.8, 12, 16), T(mx, 6, mz), 'brickPale');
      B.geo(() => new THREE.CylinderGeometry(1.7, 1.6, 1.2, 16), T(mx, 12.6, mz), 'tileBlue');
      B.geo(() => new THREE.CylinderGeometry(2.3, 1.7, 0.6, 16), T(mx, 13.5, mz), 'woodDark');
      B.geo(() => new THREE.CylinderGeometry(2.35, 2.35, 0.7, 16, 1, true), T(mx, 14.15, mz), 'lattice', { uvs: 2 });
      B.geo(() => new THREE.CylinderGeometry(1.25, 1.4, 5.5, 16), T(mx, 17.2, mz), 'tileTurq', { uvs: 1.5 });
      B.geo(() => new THREE.CylinderGeometry(1.6, 1.3, 0.5, 16), T(mx, 20.1, mz), 'tileGold');
      B.geo(() => new THREE.SphereGeometry(1.35, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), T(mx, 20.35, mz, 0, 1, 1.4, 1), 'tileTurq');
      B.geo(() => new THREE.CylinderGeometry(0.05, 0.15, 1.4, 6), T(mx, 22.8, mz), 'gold');
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; B.box(mx + Math.cos(a) * 1.82 - 0.06, 3, mz + Math.sin(a) * 1.82 - 0.06, mx + Math.cos(a) * 1.82 + 0.06, 11.5, mz + Math.sin(a) * 1.82 + 0.06, 'brickRed', { col: false }); }
      lantern(mx + 2.4, 13.3, mz + 0.2, 0);
    }
  }
  // الأروقة الشرقية والغربية حول الصحن (سقف يمكن الصعود إليه بالدرج)
  for (const s of [-1, 1]) {
    const xo = s * 14, xi = s * 10.5;
    // الجدار الخارجي (مع بوابة جانبية عند z∈[-24,-20])
    wallZ(-34, -24, xo, 0, 5, 0.6, 'brickPale');
    B.box(Math.min(xo, xo + s * 0.3) - 0.3, 3.6, -24, Math.max(xo, xo + s * 0.3) + 0.3, 5, -20, 'brickPale'); // عتبة البوابة العلوية
    // صف الأقواس المطل على الصحن
    archWall('z', -34, -22, xi, 0, 4.4, 0.55, [-31.5, -28.5, -25.5].map(z => ({ u: z + 34, w: 2.2, h: 2.2, rise: 1.2 })).concat([{ u: 12 - 0.9, w: 1.4, h: 2.3, rise: 0.6 }]), 'brickPale', { trim: 'tileBlue' });
    // سقف الرواق (يمشى عليه) مع فتحة فوق الدرج (شريط بعرض 1.2م قرب الجدار الخارجي)
    const sA = xo - s * 0.4, sBx = xo - s * 1.6;
    B.box(Math.min(sBx, xi), 4.4, -34, Math.max(sBx, xi), 4.7, -22, 'roof');
    B.box(Math.min(sA, sBx), 4.4, -34, Math.max(sA, sBx), 4.7, -30.1, 'roof');
    B.box(Math.min(xo, sA) - 0.3 * (s < 0 ? 1 : 0), 4.4, -34, Math.max(xo, sA) + 0.3 * (s > 0 ? 1 : 0), 4.7, -22, 'roof');
    // سور سطح الرواق
    B.box(xi - 0.15 * s - 0.15, 4.7, -34, xi - 0.15 * s + 0.15, 5.6, -22, 'brickPale');
    B.box(Math.min(xo, xi), 4.7, -22.3, Math.max(xo, xi), 5.6, -22, 'brickPale');
    // درج داخل الرواق إلى السطح (عند الطرف الشمالي)
    const sx0 = Math.min(xo - s * 0.4, xo - s * 1.6), sx1 = Math.max(xo - s * 0.4, xo - s * 1.6);
    for (let k = 0; k < 16; k++) B.box(sx0, 0, -23.2 - (k + 1) * 0.42, sx1, 0.29 * (k + 1), -23.2 - k * 0.42, 'stone', { ao: 0 });
    // فتحة في السقف فوق الدرج
    // (السقف يغطي، لذا نجعل الدرج ينتهي عند حافة الرواق الداخلي)
    // أرضية الرواق
    floor(Math.min(xo, xi), -34, Math.max(xo, xi), -22, 'stone');
    lantern(s * 12.2, 3.3, -30, 0.6); lantern(s * 12.2, 3.3, -26, 0.6);
    B.light(s * 12.2, 3.2, -28, 0xffb060, 3, 9);
  }
  // الجدار الجنوبي للصحن مع البوابة الكبرى إلى السوق
  archWall('x', -14, 14, -20, 0, 6.5, 0.8, [{ u: 14, w: 6, h: 3.6, rise: 2.4 }], 'brickPale', { trim: 'tileTurq' });
  // النافورة المثمنة
  {
    const fx = 0, fz = -27.5;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2 + Math.PI / 8, a2 = (k + 1) / 8 * Math.PI * 2 + Math.PI / 8, r = 2.4;
      if (vis) { const mx = Math.cos((a + a2) / 2) * r * 0.924, mz = Math.sin((a + a2) / 2) * r * 0.924; B.geo(() => new THREE.BoxGeometry(1.84, 0.6, 0.25), T(fx + mx, 0.3, fz + mz, -(a + a2) / 2 + Math.PI / 2), 'marble', { uvs: 0.5 }); }
    }
    B.col(fx - 2.3, 0, fz - 2.3, fx + 2.3, 0.6, fz + 2.3, MAT.stone);
    if (vis) {
      B.water.push({ x: fx, y: 0.48, z: fz, r: 2.2, round: true });
      B.geo(() => new THREE.CylinderGeometry(0.35, 0.5, 1.2, 12), T(fx, 0.6, fz), 'marble');
      B.geo(() => new THREE.CylinderGeometry(0.9, 0.2, 0.25, 16), T(fx, 1.3, fz), 'marble');
    }
    B.col(fx - 0.5, 0.6, fz - 0.5, fx + 0.5, 1.4, fz + 0.5);
  }
  // أشجار نخيل وفوانيس في الصحن
  palm(-7.5, -31, 8.5, 0.12, 0.8); palm(7.5, -31, 8, 0.1, 2.2); palm(-7.5, -23.5, 7.5, 0.14, -0.6); palm(7.5, -23.5, 8.2, 0.12, 3.5);
  for (const [x, z] of [[-4, -22.5], [4, -22.5]]) streetLamp(x, z, 0xffb060, 2.5, 9);
  // صناديق وأكياس كغطاء
  crate(-11, -21.4, 1.1); crate(-9.8, -21.5, 0.9); crate(11.2, -32.6, 1.1); sack(9.8, -33, 'spice2');
  for (let k = 0; k < 4; k++) B.spawn(1, -4.5 + k * 3, 0, -30.5, Math.PI);

  // ================= السوق المسقوف (وسط) =================
  {
    const zA = -20, zB = 18, vz0 = -16, vz1 = 14;
    // صفوف الدكاكين على الجانبين (جدار الكتل عند x=±3)
    const shopsAt = [[-15.6, -13.2], [-12.8, -10.4], [-10, -7.6], [-7.2, -4.8], [5.2, 7.6], [8, 10.4], [10.8, 13.2]];
    for (const [z0, z1] of shopsAt) { shop(-3, z0, z1, -1, z0 === -10 ? 'nursery' : z0 === -7.2 ? 'spice' : z0 === 10.8 ? 'pharmacy' : null); shop(3, z0, z1, 1); }
    // دعامات بين الدكاكين + جدار علوي حتى القبو
    const piers = [[-20, -15.6], [-13.2, -12.8], [-10.4, -10], [-7.6, -7.2], [-4.8, -2], [2, 5.2], [7.6, 8], [10.4, 10.8], [13.2, 18]];
    for (const [z0, z1] of piers) { B.box(-5.2, 0, z0, -3, 4.6, z1, 'brick'); B.box(3, 0, z0, 5.2, 4.6, z1, 'brick'); }
    for (const sgn of [-1, 1]) B.box(sgn * 3.45, 4.6, -20, sgn * 5.2, 5.6, 18, 'brick');
    // الأقبية: أقواس مدبّبة كل 3م مع فتحات ضوء بين المقاطع
    if (vis) {
      for (let z = vz0; z <= vz1; z += 3) {
        const sh = new THREE.Shape(); const r = 3.2, rise = 2.6, h = 4.6;
        // حلقة القوس (خارج - داخل)
        const outer = (rr, rs) => { const p = []; const RR = (rr * rr + rs * rs) / (2 * rr); for (let i = 0; i <= 12; i++) { const x = rr - i / 12 * rr, dx = x - (rr - RR); p.push([x, h + Math.sqrt(Math.max(0, RR * RR - dx * dx))]); } return p; };
        const o = outer(r + 0.25, rise + 0.25), inn = outer(r, rise);
        sh.moveTo(r + 0.25, h); o.forEach(p => sh.lineTo(p[0], Math.min(p[1], h + rise + 0.25))); [...o].reverse().forEach(p => sh.lineTo(-p[0], Math.min(p[1], h + rise + 0.25)));
        sh.lineTo(-r, h); inn.forEach(p => sh.lineTo(-p[0], Math.min(p[1], h + rise))); inn.slice().reverse().forEach(p => sh.lineTo(p[0], Math.min(p[1], h + rise))); sh.closePath();
        const isRib = true;
        const g = new THREE.ExtrudeGeometry(sh, { depth: z === vz1 ? 0.5 : 2.2, bevelEnabled: false, curveSegments: 6 });
        B.geo(g, T(0, 0, z), isRib ? 'brick' : 'brickPale', { ao: 1 });
        // ضلع زخرفي
        const rib = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false });
        B.geo(rib, T(0, -0.02, z - 0.1, 0, 1.02, 1.0, 1), 'brickPale', { ao: 1 });
        // فانوس معلّق في كل مقطع
        if (z < vz1) { lantern(0, 3.6, z + 1.1, 2.4); if (((z - vz0) / 3) % 2 === 0) B.light(0, 3.7, z + 1.1, 0xffa955, 3.5, 10); }
      }
      // كوابيل ومظلات قماشية عند مدخلي السوق
      for (const z of [vz0 - 0.2, vz1 + 0.6]) B.box(-3.3, 4.6, z - 0.2, 3.3, 4.9, z + 0.2, 'beam', { col: false });
    }
    // سقف السوق كتصادم (يمنع القفز إلى السطح)
    B.col(-3.5, 4.6, vz0 - 0.5, 3.5, 8, vz1 + 0.5, MAT.brick);
    // جدران علوية فوق الدكاكين حتى القبو
    // بسطات وسط السوق (غطاء)
    crate(-1.4, -9, 0.9); crate(1.3, -3.5, 1.0); sack(-1.6, 6.5, 'spice1'); sack(-1.1, 7.1, 'spice2'); crate(1.4, 10.5, 1.0); crate(1.2, 11.3, 0.7, 1.0);
    // عربة خشبية
    B.boxB(-0.8, 0.5, -14, 1.2, 0.5, 2, 'wood', {});
    if (vis) { for (const zz of [-14.6, -13.4]) B.geo(() => new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12), T(-0.8 - 0.65, 0.45, zz, 0, 1, 1, 1, 0, Math.PI / 2), 'woodDark'); pot(-0.6, 1.0, -14.2, 0.2); pot(-1, 1.0, -13.6, 0.16, 'brass'); }
    // بوابة السوق الجنوبية على الشريعة
    archWall('x', -6, 6, 18, 0, 7, 0.9, [{ u: 6, w: 5, h: 3.4, rise: 2 }], 'brick', { trim: 'tileBlue' });
    signs.push({ text: 'سوق المجاهدين', x: 0, y: 6.1, z: 18.48, ry: 0, w: 3.8, opt: { bg: '#3b1d14', border: '#e0b45a' } });
    signs.push({ text: 'سوق المجاهدين', x: 0, y: 6.1, z: -20.45, ry: Math.PI, w: 3.8, opt: { bg: '#3b1d14', border: '#e0b45a' } });
  }

  // ================= الخان (غرب) =================
  {
    const x0 = -34, x1 = -16, z0 = -14, z1 = 10, ci0 = -29, ci1 = -21, cz0 = -8, cz1 = 4, H = 8, up = 4;
    // الجدران الخارجية مع بوابتين (غرباً وشرقاً) عند z∈[-3,1]
    archWall('z', z0, z1, x0 + 0.4, 0, H, 0.8, [{ u: 0 - z0, w: 3.6, h: 3, rise: 1.6 }, { u: -9 - z0, w: 1, h: 1.2, rise: 0.4, y: 5 }, { u: 6 - z0, w: 1, h: 1.2, rise: 0.4, y: 5 }], 'brick', { trim: 'tileBlue' });
    archWall('z', z0, z1, x1 - 0.4, 0, H, 0.8, [{ u: 0 - z0, w: 3.6, h: 3, rise: 1.6 }], 'brick', { trim: 'tileBlue' });
    wallX(x0, x1, z0 + 0.4, 0, H, 0.8, 'brick'); wallX(x0, x1, z1 - 0.4, 0, H, 0.8, 'brick');
    // الغرف المحيطة (صلبة) بين الجدار الخارجي ورواق الفناء: نتركها بعمق 2م خلف الأروقة
    // الرواق الأرضي: أعمدة حول الفناء وسقف علوي هو أرضية الطابق الثاني
    const gal = 3; // عمق الرواق
    // أرضية الطابق الثاني (حلقة)
    B.box(ci0 - gal, up - 0.3, cz0 - gal, ci1 + gal, up, cz0, 'woodDark', { ao: null });
    B.box(ci0 - gal, up - 0.3, cz1, ci1 + gal, up, cz1 + gal, 'woodDark', { ao: null });
    // الضلعان الغربي والشرقي مع فتحتين فوق الدرجين
    B.box(ci0 - gal + 1.5, up - 0.3, cz0, ci0, up, cz1, 'woodDark', { ao: null }); B.box(ci0 - gal, up - 0.3, cz0 + 6.6, ci0 - gal + 1.5, up, cz1, 'woodDark', { ao: null });
    B.box(ci1, up - 0.3, cz0, ci1 + gal - 1.5, up, cz1, 'woodDark', { ao: null }); B.box(ci1 + gal - 1.5, up - 0.3, cz0, ci1 + gal, up, cz1 - 6.6, 'woodDark', { ao: null });
    // أعمدة الرواق
    for (let x = ci0; x <= ci1 + 0.01; x += 4) for (const z of [cz0, cz1]) column(x, z, 0, up - 0.3, 0.25, 'brickPale');
    for (let z = cz0 + 4; z < cz1 - 0.01; z += 4) for (const x of [ci0, ci1]) column(x, z, 0, up - 0.3, 0.25, 'brickPale');
    // درابزين خشبي للطابق الثاني حول الفناء
    for (const [a0, a1, c, ax] of [[ci0, ci1, cz0, 'x'], [ci0, ci1, cz1, 'x'], [cz0, cz1, ci0, 'z'], [cz0, cz1, ci1, 'z']]) {
      if (ax === 'x') { B.box(a0, up, c - 0.06, a1, up + 1.0, c + 0.06, null, { vis: false, cm: MAT.wood, flags: F.THIN }); if (vis) { B.box(a0, up + 0.9, c - 0.08, a1, up + 1.0, c + 0.08, 'woodDark', { col: false }); for (let x = a0; x <= a1; x += 0.45) B.box(x - 0.03, up, c - 0.03, x + 0.03, up + 0.9, c + 0.03, 'woodDark', { col: false }); } }
      else { B.box(c - 0.06, up, a0, c + 0.06, up + 1.0, a1, null, { vis: false, cm: MAT.wood, flags: F.THIN }); if (vis) { B.box(c - 0.08, up + 0.9, a0, c + 0.08, up + 1.0, a1, 'woodDark', { col: false }); for (let z = a0; z <= a1; z += 0.45) B.box(c - 0.03, up, z - 0.03, c + 0.03, up + 0.9, z + 0.03, 'woodDark', { col: false }); } }
    }
    // أعمدة الطابق الثاني والسقف العلوي
    for (let x = ci0; x <= ci1 + 0.01; x += 4) for (const z of [cz0, cz1]) column(x, z, up, H - up - 0.6, 0.2, 'beam', 'beam');
    B.box(ci0 - gal, H - 0.6, cz0 - gal, ci1 + gal, H - 0.3, cz0, 'beam', { ao: null }); B.box(ci0 - gal, H - 0.6, cz1, ci1 + gal, H - 0.3, cz1 + gal, 'beam', { ao: null });
    B.box(ci0 - gal, H - 0.6, cz0, ci0, H - 0.3, cz1, 'beam', { ao: null }); B.box(ci1, H - 0.6, cz0, ci1 + gal, H - 0.3, cz1, 'beam', { ao: null });
    // الغرف الخلفية في الطابقين: جدران بأبواب مقوّسة (غير نافذة)
    for (const z of [cz0 - gal, cz1 + gal]) for (const y of [0, up]) { if (vis) for (let x = ci0 - 1; x < ci1 + 1; x += 2.6) { B.box(x, y + 0.02, z - 0.05, x + 1.1, y + 2.4, z + 0.05, 'woodDark', { col: false }); B.box(x - 0.15, y + 2.4, z - 0.07, x + 1.25, y + 2.6, z + 0.07, 'brickPale', { col: false }); } }
    // الحشوات بين الجدار الخارجي ودائرة الرواق (غرف صلبة)
    B.box(x0 + 0.8, 0, z0 + 0.8, x1 - 0.8, H, cz0 - gal, 'brick', { faces: 'pz' });
    B.box(x0 + 0.8, 0, cz1 + gal, x1 - 0.8, H, z1 - 0.8, 'brick', { faces: 'nz' });
    B.box(x0 + 0.8, 0, cz0 - gal, ci0 - gal, H, -2, 'brick', { faces: 'pxpz' }); B.box(x0 + 0.8, 0, 2, ci0 - gal, H, cz1 + gal, 'brick', { faces: 'pxnz' });
    B.box(ci1 + gal, 0, cz0 - gal, x1 - 0.8, H, -2, 'brick', { faces: 'nxpz' }); B.box(ci1 + gal, 0, 2, x1 - 0.8, H, cz1 + gal, 'brick', { faces: 'nxnz' });
    // ممرا البوابتين عبر الحشوة
    floor(x0, -2, ci0 - gal, 2, 'stone'); floor(ci1 + gal, -2, x1, 2, 'stone');
    B.box(x0 + 0.8, 3.0, -2, ci0 - gal, H, 2, 'brick', { faces: 'ny' }); B.box(ci1 + gal, 3.0, -2, x1 - 0.8, H, 2, 'brick', { faces: 'ny' });
    // درجان إلى الطابق الثاني (في الزاويتين الشمالية الغربية والجنوبية الشرقية)
    for (let k = 0; k < 14; k++) B.box(ci0 - gal + 0.1, 0, cz0 + 0.6 + k * 0.42, ci0 - gal + 1.4, 0.29 * (k + 1), cz0 + 1.02 + k * 0.42, 'stone', { ao: 0 });
    for (let k = 0; k < 14; k++) B.box(ci1 + gal - 1.4, 0, cz1 - 0.6 - (k + 1) * 0.42, ci1 + gal - 0.1, 0.29 * (k + 1), cz1 - 0.6 - k * 0.42, 'stone', { ao: 0 });
    // فتحتان في أرضية الطابق الثاني فوق الدرجين: نعيد بناء الحلقة بدونهما (التصادم الأعلى يمنع الرأس)
    // بئر وفناء: حوض ماء، صناديق، عربة، أكياس
    B.col(-25.8, 0, -2.8, -24.2, 0.8, -1.2, MAT.stone);
    if (vis) { B.geo(() => new THREE.CylinderGeometry(0.8, 0.85, 0.8, 14), T(-25, 0.4, -2), 'brickPale'); B.water.push({ x: -25, y: 0.7, z: -2, r: 0.7, round: true }); B.boxB(-25, 0.8, -2.75, 0.1, 1.6, 0.1, 'beam', { col: false }); B.boxB(-25, 0.8, -1.25, 0.1, 1.6, 0.1, 'beam', { col: false }); B.boxB(-25, 2.35, -2, 0.08, 0.08, 1.6, 'beam', { col: false }); }
    crate(-27.5, 1.8, 1.1); crate(-27.4, 2.9, 0.9); crate(-22.6, -6.2, 1.2); crate(-22.4, -5, 0.8); sack(-22.3, 2.6, 'spice3'); sack(-23, 3.1, 'spice1');
    crate(-30.5, -9.5, 1); crate(-19.5, 5.5, 1.1);
    for (let x = ci0 - 1.5; x <= ci1 + 1.5; x += 5) { lantern(x, 3.0, cz0 - 1.2, 0.5); lantern(x, 3.0, cz1 + 1.2, 0.5); }
    B.light(-25, 3, -9, 0xffa955, 3, 10); B.light(-25, 3, 5, 0xffa955, 3, 10);
    signs.push({ text: 'خان المرجان', x: x0 - 0.02, y: 5.0, z: -1, ry: -Math.PI / 2, w: 3.2 });
    signs.push({ text: 'خان المرجان', x: x1 + 0.02, y: 5.0, z: -1, ry: Math.PI / 2, w: 3.2 });
  }

  // ================= الساحة والبئر والممرات الشرقية =================
  {
    // البئر في وسط الساحة
    B.col(28.2, 0, -0.8, 29.8, 0.9, 0.8, MAT.stone);
    if (vis) { B.geo(() => new THREE.CylinderGeometry(0.85, 0.9, 0.9, 16), T(29, 0.45, 0), 'brick'); B.water.push({ x: 29, y: 0.75, z: 0, r: 0.72, round: true }); for (const s of [-1, 1]) B.boxB(29 + s * 0.75, 0.9, 0, 0.12, 1.7, 0.12, 'beam', { col: false }); B.boxB(29, 2.6, 0, 1.7, 0.12, 0.12, 'beam', { col: false }); B.geo(() => new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10), T(29, 2.3, 0, 0, 1, 1, 1, 0, Math.PI / 2), 'woodDark'); }
    // شجرة سدر كبيرة
    B.col(24.6, 0, 3.6, 25.4, 4, 4.4, MAT.wood);
    if (vis) {
      B.geo(() => new THREE.CylinderGeometry(0.28, 0.45, 3.6, 9), T(25, 1.8, 4, 0, 1, 1, 1, 0.08, 0.05), 'palm');
      for (let k = 0; k < 9; k++) B.geo(() => new THREE.IcosahedronGeometry(1.3 + R() * 0.7, 1), T(25 + (R() - 0.5) * 3, 4.3 + R() * 1.6, 4 + (R() - 0.5) * 3), 'clothGreen');
      B.geo(() => new THREE.CylinderGeometry(1.6, 1.6, 0.45, 16), T(25, 0.22, 4), 'brickPale');
    }
    B.col(23.4, 0, 2.4, 26.6, 0.45, 5.6);
    // مقهى صغير على الساحة: مقاعد وطاولات
    bench(33, -4.6, 3, 'x'); bench(35.3, 0, 3, 'z'); table(33, -3.4); table(34, 2.5);
    crate(23, -5, 1); crate(23.4, -4, 0.8); sack(35.2, 5, 'spice2');
    for (const [x, z] of [[27, -5.5], [31, 5.5]]) streetLamp(x, z, 0xffb060, 2.8, 10);
    // ساباط: غرفة معلّقة تعبر ممر السوق-الساحة
    B.box(10, 3.6, -2.2, 14, 7.5, 2.2, 'plasterOchre');
    if (vis) for (const s of [-1, 1]) { const f = frame(s > 0 ? 's' : 'n', 10, -2.2, 14, 2.2); shanasheel(f, 0.6, 2.8, 3.9, 2.8, 0.7, 'lattice'); }
    B.box(10, 3.3, -2.2, 14, 3.6, 2.2, 'beam');
    // حبال غسيل وأعلام قماشية بين الشناشيل
    if (vis) {
      const cloths = [];
      for (let z = -18; z < -7; z += 3) cloths.push([30.2, 33.8, z, 5.2]);
      for (let z = 7; z < 17; z += 3) cloths.push([22.2, 25.8, z, 5.0]);
      for (let z = -16; z < 16; z += 4) cloths.push([-39.8, -34.2, z, 5.6]);
      for (const [xa, xb, z, y] of cloths) {
        B.box(xa, y, z - 0.01, xb, y + 0.02, z + 0.01, 'iron', { col: false });
        for (let x = xa + 0.4; x < xb - 0.4; x += 0.9) if (R() < 0.6) B.box(x, y - 0.7 - R() * 0.3, z - 0.01, x + 0.55, y, z + 0.01, pick(['clothRed', 'clothCream', 'clothGreen', 'carpet2']), { col: false });
      }
    }
    // نوافذ وأغطية في الأزقة: صناديق وبراميل غطاء
    crate(31, -15, 1); crate(33, -10.5, 0.9); sack(31.2, -18.8, 'spice3'); crate(25.35, 12, 1); crate(22.65, 15.5, 0.8); sack(25, 9.2, 'spice1');
    crate(17, -23.4, 1); crate(18.4, -20.5, 0.8); crate(-20, -23.35, 1.1); sack(-24, -21, 'spice2');
    crate(-38, -6, 1); crate(-36, 7, 1.1); crate(-38.6, 12, 0.9); sack(-35, -14, 'spice1');
    crate(-8, -0.8, 0.9); crate(18, 0.9, 1);
  }

  // ================= الشريعة (جنوب) =================
  {
    // حافة النهر: سور حجري واطئ + أعمدة ربط
    B.box(-92, 0, 33, 92, 0.55, 33.6, 'stone');
    if (vis) for (let x = -90; x <= 90; x += 4) B.geo(() => new THREE.CylinderGeometry(0.14, 0.18, 0.8, 8), T(x, 0.4, 33.3), 'iron');
    // مرسى خشبي وزوارق (بلم)
    B.box(-20, -0.1, 33.6, -16, 0.15, 39, 'wood', { cm: MAT.wood });
    B.col(-20.1, 0.15, 38.9, -15.9, 1, 39.1);
    B.col(-20.1, 0.15, 33.6, -20, 1, 39); B.col(-16, 0.15, 33.6, -15.9, 1, 39);
    if (vis) {
      for (const [bx, bz, ry] of [[-23, 37, 0.15], [-13, 36.5, -0.2], [8, 37.5, 0.4], [20, 36, -0.1]]) boat(bx, bz, ry);
      B.water.push({ x: 0, y: -0.9, z: 58, w: 340, d: 50 });
      // الضفة البعيدة: نخيل وبيوت واطئة كخلفية
      for (let x = -140; x <= 140; x += 7 + R() * 6) { const h = 4 + R() * 5; B.box(x, -1, 84, x + 5 + R() * 4, h, 90, pick(['brickPale', 'plaster', 'plasterOchre']), { col: false, ao: null }); }
      for (let x = -145; x <= 145; x += 5 + R() * 5) palmFar(x, 82 - R() * 4, 7 + R() * 5);
    }
    // مقهى الشريعة: مبنى بطابقين وسطح يصعد إليه بدرج خارجي (موقع قنّاص)
    const cx0 = -14, cx1 = -6, cz0 = 19, cz1 = 24;
    B.box(cx0, 0, cz0, cx1, 4, cz1 - 0.5, 'plasterWhite');
    archWall('x', cx0, cx1, cz1 - 0.2, 0, 4, 0.4, [{ u: 2, w: 2.2, h: 2.2, rise: 0.9 }, { u: 6, w: 2.2, h: 2.2, rise: 0.9 }], 'plasterWhite', { trim: 'woodBlue' });
    if (vis) for (const u of [2, 6]) B.box(cx0 + u - 1.1, 0, cz1 - 0.52, cx0 + u + 1.1, 3.1, cz1 - 0.46, 'woodBlue', { col: false });
    // داخل المقهى صلب (مخزن) ما عدا الواجهة — نكتفي بالواجهة الزخرفية
    B.box(cx0 - 0.1, 4, cz0 - 0.1, cx1 + 0.1, 4.15, cz1 + 0.1, 'brickPale');
    B.box(cx0, 4.15, cz0, cx1, 5.0, cz0 + 0.2, 'plasterWhite'); B.box(cx0, 4.15, cz1 - 0.2, cx1, 5.0, cz1, 'plasterWhite');
    B.box(cx0, 4.15, cz0, cx0 + 0.2, 5.0, cz1, 'plasterWhite'); B.box(cx1 - 0.2, 4.15, cz0, cx1, 5.0, cz1 - 1.4, 'plasterWhite');
    // درج خارجي على الجانب الشرقي يصعد إلى السطح
    for (let k = 0; k < 14; k++) B.box(cx1, 0, cz0 + 0.2 + k * 0.33, cx1 + 1.3, 0.29 * (k + 1), cz0 + 0.2 + (k + 1) * 0.33, 'brickPale', { ao: 0 });
    // مظلة قماشية ومقاعد أمام المقهى
    if (vis) { B.geo(() => new THREE.PlaneGeometry(8, 2.6), T(-10, 3.3, 25.2, 0, 1, 1, 1, -1.1), 'clothRed', { uvs: 0.5 }); for (const x of [-13.8, -6.2]) B.boxB(x, 0, 26.3, 0.1, 2.9, 0.1, 'beam', { col: false }); }
    table(-12, 27.2); table(-8, 27.4); bench(-10, 28.6, 4, 'x');
    signs.push({ text: 'مقهى الشريعة', x: -10, y: 3.4, z: 24.02, ry: 0, w: 3.2 });
    // نخيل الكورنيش
    for (const [x, z, h] of [[-38, 30, 8], [-30, 31, 9], [-22, 29.5, 7.5], [-2, 31, 8.5], [6, 30, 7.8], [14, 31.5, 9.2], [30, 30.5, 8], [38, 29.5, 8.8]]) palm(x, z, h, 0.1 + R() * 0.1, R() * 6);
    // صناديق التجار على الرصيف (غطاء)
    crate(-2.5, 22, 1.1); crate(-1.6, 22.8, 0.8); crate(3.5, 25.5, 1.2); sack(4.8, 26, 'spice3'); sack(5.3, 25.2, 'spice1');
    crate(18, 22, 1.1); crate(19.2, 22.4, 0.9); crate(30, 25, 1.2); crate(-30, 24, 1.2); crate(-31, 25.1, 0.8); crate(-24, 21, 1);
    B.boxB(12, 0, 26, 2.4, 1.1, 1, 'woodDark', {}); // عربة باعة
    if (vis) { for (let k = 0; k < 5; k++) pot(11 + k * 0.5, 1.1, 26, 0.12, k % 2 ? 'copper' : 'brass'); }
    for (const [x, z] of [[-26, 27], [-6, 31.6], [10, 31.6], [26, 27]]) streetLamp(x, z, 0xffb060, 2.6, 10);
    for (let k = 0; k < 4; k++) B.spawn(0, -4.5 + k * 3, 0, 28.5, 0);
  }

  // ================= اللافتات =================
  if (vis) B.signs = signs;

  // ================= عقد الملاحة للبوتات =================
  const n = (x, z, y = 0, tag) => B.node(x, y, z, tag);
  // نقاط الشريعة والصحن
  for (let x = -40; x <= 40; x += 8) { if (x !== -8) n(x, 22); n(x, 28.5); n(x, 31.2); }
  for (let x = -12; x <= 12; x += 6) { n(x, -31); n(x, -25); n(x, -21.5); }
  n(-12.2, -28); n(12.2, -28); n(-12.2, -23); n(12.2, -23);
  // السوق
  for (let z = -18; z <= 16; z += 4) n(0, z);
  // الممرات العرضية
  for (let x = -14; x <= -4; x += 4) n(x, 0); for (let x = 5; x <= 21; x += 4) n(x, 0);
  // الخان
  for (let x = -31; x <= -19; x += 4) for (let z = -10; z <= 6; z += 4) n(x, z);
  n(-33, -1); n(-17, -1);
  // الخان العلوي + الدرجان
  for (let x = -31; x <= -19; x += 4) { n(x, -9.5, 4); n(x, 5.5, 4); }
  for (let z = -7; z <= 3; z += 5) { n(-29.8, z, 4); n(-20.2, z, 4); }
  B.chain([-31.2, 0, -7.6], [-31.2, 2.0, -4.8], [-31.2, 4.06, -1.2], [-29.8, 4, -0.5]);
  B.chain([-18.8, 0, 3.6], [-18.8, 2.0, 0.8], [-18.8, 4.06, -2.6], [-20.2, 4, -3.2]);
  // الشارع الغربي والزقاق الشمالي الغربي
  for (let z = -22; z <= 16; z += 4) n(-37, z); for (let x = -33; x <= -16; x += 5) n(x, -22);
  // الشرق
  for (let x = 16; x <= 32; x += 4) n(x, -22); for (let z = -18; z <= -8; z += 4) n(32, z);
  for (let x = 24; x <= 34; x += 5) for (let z = -4; z <= 4; z += 4) n(x, z);
  for (let z = 8; z <= 16; z += 4) n(24, z);
  // أسطح الأروقة والمقهى
  for (const s of [-1, 1]) { n(s * 11.5, -24, 4.7); n(s * 11.5, -32.5, 4.7); B.chain([s * 13, 0, -22.6], [s * 13, 2.3, -26.6], [s * 13, 4.64, -29.7], [s * 11.5, 4.7, -29.7]); }
  n(-10, 21.5, 4.15); n(-12, 22.2, 4.15); B.chain([-2.5, 0, 19.8], [-5.35, 0, 18.85], [-5.35, 2.0, 21.2], [-5.35, 4.06, 23.6], [-6.8, 4.15, 23.3]);
  // ممرّات الحارة المهجورة وباب الساعة
  n(-43, -4); n(-43, 10); n(-49, -4); n(-49, 10); n(40, 0); n(45, 0);
  // المناطق الجديدة: الحارة المهجورة والمقبرة غرباً، ساحة الساعة شرقاً، امتداد الشريعة
  buildDistricts(B, { estikan, qouri, teaStove, T, R, pick, vis, block, frame, facade, lantern, lanternWall, crate, sack, pot, vase, barrel, palm, column, archWall, wallX, wallZ, floor, signs, gunProp, boat, n, MAT, F, bench, table, fbox, palmFar, door, shanasheel, streetLamp });
  return SOUQ_INFO;

  function boat(x, z, ry) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.75 + 0.05, (t - 0.5) * 5.5)); }
    const g = new THREE.LatheGeometry(pts, 10, Math.PI, Math.PI); g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2);
    B.geo(g, T(x, -0.55, z, ry, 1, 0.7, 1), 'woodDark', { uvs: 0.6 });
    B.geo(() => new THREE.BoxGeometry(1.2, 0.06, 0.3), T(x, -0.5, z, ry), 'wood');
  }
  function palmFar(x, z, h) {
    B.geo(() => new THREE.CylinderGeometry(0.14, 0.2, h, 5, 1, true), T(x, h / 2 - 1, z), 'palm');
    for (let k = 0; k < 7; k++) { const g = new THREE.PlaneGeometry(2.6, 1.3); g.translate(1.3, 0, 0); g.rotateX(-Math.PI / 2 + 0.2); B.geo(g, T(x, h - 1, z, k / 7 * Math.PI * 2, 1, 1, 1, 0, -0.35), 'leaf', { uvs: 1 }); }
  }
}
