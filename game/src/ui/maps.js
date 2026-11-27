import { WP_COL } from '../game/waypoint.js';
// الخرائط: المصغّرة (يمين الأعلى، الشمال للأعلى) والكبيرة التي تُفتح وتُغلق كما في ببجي
import { MAT } from '../world/collide.js';
import { TEAMS } from '../sim/sim.js';
import { POI_KINDS } from '../game/pois.js';

const COL = {
  [MAT.stone]: [150, 141, 126], [MAT.brick]: [168, 112, 78], [MAT.wood]: [128, 92, 58], [MAT.metal]: [96, 104, 112], [MAT.plaster]: [206, 188, 156],
  [MAT.sand]: [196, 170, 120], [MAT.cloth]: [168, 58, 52], [MAT.tile]: [58, 150, 146], [MAT.water]: [40, 96, 120], [MAT.glass]: [140, 190, 200],
};

export class MapView {
  constructor(world, info) {
    this.w = world; this.info = info;
    const r = info && info.mapRect, B = r ? [r[0], 0, r[1], r[2], 0, r[3]] : world.bounds; this.B = B;
    const W = B[3] - B[0], D = B[5] - B[2];
    // لوحة مستطيلة بنسبة الخريطة (أوضح على شاشات الهاتف العريضة)
    this.SW = 1600; this.k = this.SW / W; this.SD = Math.round(D * this.k); this.S = Math.max(this.SW, this.SD);
    this.ox = B[0]; this.oz = B[2];
    this.bg = this.paint();
  }
  px(x) { return (x - this.ox) * this.k; }
  pz(z) { return (z - this.oz) * this.k; }
  paint() {
    const c = document.createElement('canvas'); c.width = this.SW; c.height = this.SD; const x = c.getContext('2d'), w = this.w, b = w.b, k = this.k;
    // أرضية رملية مع ملمس خفيف
    const g = x.createLinearGradient(0, 0, this.SW, this.SD); g.addColorStop(0, '#b9a37a'); g.addColorStop(1, '#a8916a'); x.fillStyle = g; x.fillRect(0, 0, this.SW, this.SD);
    for (let i = 0; i < 3200; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,210' : '70,55,35'},${Math.random() * 0.06})`; x.fillRect(Math.random() * this.SW, Math.random() * this.SD, 2 + Math.random() * 3, 2 + Math.random() * 3); }
    // الماء
    const info = this.info || {};
    if (info.water) for (const r of info.water) { x.fillStyle = '#2f6f86'; x.fillRect(this.px(r[0]), this.pz(r[1]), (r[2] - r[0]) * k, (r[3] - r[1]) * k); x.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 40; i++) x.fillRect(this.px(r[0]) + Math.random() * (r[2] - r[0]) * k, this.pz(r[1]) + Math.random() * (r[3] - r[1]) * k, 14, 1.5); }
    // المباني من صناديق التصادم: الأعلى يُرسم أخيراً
    const idx = []; for (let i = 0; i < w.mat.length; i++) { const o = i * 6; const h = b[o + 4]; if (h < 0.35 || b[o + 4] - b[o + 1] > 40) continue; if ((b[o + 3] - b[o]) * (b[o + 5] - b[o + 2]) > 3000) continue; idx.push(i); }
    idx.sort((i, j) => b[i * 6 + 4] - b[j * 6 + 4]);
    for (const i of idx) {
      const o = i * 6, h = b[o + 4], c0 = COL[w.mat[i]] || [160, 150, 130], L = 0.78 + Math.min(1, h / 12) * 0.35;
      const X = this.px(b[o]), Z = this.pz(b[o + 2]), Wd = Math.max(1, (b[o + 3] - b[o]) * k), Dd = Math.max(1, (b[o + 5] - b[o + 2]) * k);
      x.fillStyle = `rgba(0,0,0,${Math.min(0.35, h * 0.03)})`; x.fillRect(X + Math.min(6, h * 0.5), Z + Math.min(6, h * 0.5), Wd, Dd);
      x.fillStyle = `rgb(${c0[0] * L | 0},${c0[1] * L | 0},${c0[2] * L | 0})`; x.fillRect(X, Z, Wd, Dd);
    }
    // شبكة إحداثيات خفيفة
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1;
    for (let m = Math.ceil(this.ox / 25) * 25; m < this.ox + this.SW / k; m += 25) { x.beginPath(); x.moveTo(this.px(m), 0); x.lineTo(this.px(m), this.SD); x.stroke(); }
    for (let m = Math.ceil(this.oz / 25) * 25; m < this.oz + this.SD / k; m += 25) { x.beginPath(); x.moveTo(0, this.pz(m)); x.lineTo(this.SW, this.pz(m)); x.stroke(); }
    return c;
  }
  // هل يظهر العدو على الخريطة؟ قريب ويتحرك بصوت، أو أطلق بلا كاتم مؤخراً
  revealed(p, me, shotAt, now) {
    if (p.team === me.team) return true;
    const d = Math.hypot(p.pos[0] - me.pos[0], p.pos[2] - me.pos[2]);
    const sp = Math.hypot(p.vel[0], p.vel[2]);
    // العدو يبين بس لمّا يرمي (بلا كاتم)، أو إذا كشفه الدرون
    const s = shotAt.get(p.id); if (s && !s.q && now - s.t < 3) return true;
    const dr = this.g && this.g.drone && this.g.drone.seen.get(p.id); if (dr !== undefined && this.g.t - dr < 8) return true;
    return false;
  }
  cpMark(x, X, Z, r, c, my, fs) {
    const col = c.owner < 0 ? 'rgba(240,240,240,' : c.owner === my ? 'rgba(80,190,255,' : 'rgba(255,80,80,';
    x.fillStyle = col + '0.28)'; x.strokeStyle = col + '0.95)'; x.lineWidth = Math.max(2, fs / 6);
    x.beginPath(); x.arc(X, Z, r, 0, Math.PI * 2); x.fill(); x.stroke();
    x.font = `900 ${fs}px 'Cairo', sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText(c.name, X, Z); x.fillStyle = '#fff'; x.fillText(c.name, X, Z);
  }
  // علامات التأشير والمهام: دبّوس على شكل قطرة بحافة بيضاء، وخط الطريق بلون الهدف
  marks(g) {
    const L = [], W = g.wps, Q = g.quests;
    if (Q && Q.on && Q.offer && !Q.act) { const p = Q.posOf('g', Q.offer); if (p) L.push({ x: p[0], z: p[1], col: WP_COL.giver, glyph: '!', dot: true }); }
    if (W) {
      for (const m of W.team.values()) L.push({ x: m.x, z: m.z, col: WP_COL.team, glyph: '' });
      if (W.mine) L.push({ x: W.mine.x, z: W.mine.z, col: WP_COL.mine, glyph: W.mine.route ? '' : '•' });
      if (W.quest) L.push({ x: W.quest.x, z: W.quest.z, col: WP_COL.quest, glyph: '★' });
    }
    return L;
  }
  pin(x, X, Y, col, s, glyph, dot) {
    x.save(); x.lineWidth = Math.max(2, s * 0.22); x.strokeStyle = '#fff'; x.fillStyle = col;
    if (dot) { x.beginPath(); x.arc(X, Y, s * 0.75, 0, 7); x.fill(); x.stroke(); }
    else { x.beginPath(); x.moveTo(X, Y); x.bezierCurveTo(X - s * 1.1, Y - s * 1.2, X - s * 0.9, Y - s * 2.4, X, Y - s * 2.4); x.bezierCurveTo(X + s * 0.9, Y - s * 2.4, X + s * 1.1, Y - s * 1.2, X, Y); x.closePath(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = s * 0.6; x.fill(); x.shadowBlur = 0; x.stroke(); }
    if (glyph) { x.fillStyle = dot ? '#fff' : '#1a1206'; x.font = `900 ${Math.round(s * (dot ? 1.1 : 1.05))}px 'Cairo', sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(glyph, X, dot ? Y + s * 0.05 : Y - s * 1.45); }
    x.restore();
  }
  // أيقونة محل/مكان: دائرة ملوّنة بإيموجي، واسمه تحتها إذا الخريطة مكبّرة
  poi(x, X, Y, p, s, label) {
    const K = POI_KINDS[p.kind] || POI_KINDS.land;
    x.save(); x.beginPath(); x.arc(X, Y, s, 0, 7); x.fillStyle = K.col; x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = s * 0.5; x.fill(); x.shadowBlur = 0;
    x.lineWidth = Math.max(1.5, s * 0.16); x.strokeStyle = '#fff'; x.stroke();
    x.font = `${Math.round(s * 1.15)}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(K.icon, X, Y + s * 0.06);
    if (label) { x.font = `800 ${Math.round(s * 0.82)}px 'Cairo', sans-serif`; x.textBaseline = 'top'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText(p.name, X, Y + s * 1.15); x.fillStyle = '#fff'; x.fillText(p.name, X, Y + s * 1.15); }
    x.restore();
  }
  route(x, P, T, col, w) {
    if (!P || P.length < 2) return;
    x.save(); x.lineJoin = 'round'; x.lineCap = 'round';
    x.beginPath(); P.forEach((p, i) => { const [X, Y] = T(p[0], p[1]); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); });
    x.strokeStyle = 'rgba(20,8,24,.65)'; x.lineWidth = w + 4; x.stroke(); x.strokeStyle = col; x.lineWidth = w; x.stroke();
    x.restore();
  }
  arrow(x, cx, cy, yaw, col, s) {
    x.save(); x.translate(cx, cy); x.rotate(-yaw); x.fillStyle = col; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -s * 1.3); x.lineTo(s * 0.85, s * 0.8); x.lineTo(0, s * 0.35); x.lineTo(-s * 0.85, s * 0.8); x.closePath(); x.stroke(); x.fill(); x.restore();
  }
  drawMini(cv, g, R = 42) {
    const x = cv.getContext('2d'), S = cv.width, me = g.mp; if (!me) return;
    const sc = S / (R * 2); // بكسل/متر
    x.save(); x.clearRect(0, 0, S, S);
    x.beginPath(); x.rect(0, 0, S, S); x.clip();
    x.translate(S / 2, S / 2); x.scale(sc / this.k, sc / this.k); x.translate(-this.px(me.pos[0]), -this.pz(me.pos[2]));
    x.drawImage(this.bg, 0, 0);
    x.restore();
    // خط الطريق والعلامات
    { const T = (wx, wz) => [(wx - me.pos[0]) * sc + S / 2, (wz - me.pos[2]) * sc + S / 2], W = g.wps, tg = W && W.target;
      for (const p of (this.info && this.info.pois) || []) { const [X, Y] = T(p.x, p.z); if (X > 8 && Y > 8 && X < S - 8 && Y < S - 8) this.poi(x, X, Y, p, 8); }
      if (tg && W.path) this.route(x, W.path, T, W.quest ? WP_COL.quest : WP_COL.mine, 5);
      for (const m of this.marks(g)) { const [X, Y] = T(m.x, m.z), cl = (v) => Math.max(10, Math.min(S - 10, v)); this.pin(x, cl(X), m.dot ? cl(Y) : Math.max(24, Math.min(S - 4, Y)), m.col, 9, m.glyph, m.dot); } }
    // نقاط السيطرة
    for (const c of g.sim.cps || []) { const X = (c.x - me.pos[0]) * sc + S / 2, Z = (c.z - me.pos[2]) * sc + S / 2; this.cpMark(x, Math.max(9, Math.min(S - 9, X)), Math.max(9, Math.min(S - 9, Z)), Math.max(7, c.r * sc), c, me.team, 11); }
    // اللاعبون
    const now = g.t;
    for (const p of g.sim.players.values()) {
      if (p.id === g.me || !p.alive) continue;
      this.g = g; if (!this.revealed(p, me, g.shotAt, now)) continue;
      const dx = (p.pos[0] - me.pos[0]) * sc + S / 2, dz = (p.pos[2] - me.pos[2]) * sc + S / 2;
      const edge = dx < 6 || dz < 6 || dx > S - 6 || dz > S - 6;
      const X = Math.max(6, Math.min(S - 6, dx)), Z = Math.max(6, Math.min(S - 6, dz));
      if (p.team === me.team) this.arrow(x, X, Z, p.yaw, TEAMS[p.team].color, 7);
      else { x.fillStyle = '#ff3b3b'; x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 2; x.beginPath(); x.arc(X, Z, edge ? 5 : 7, 0, Math.PI * 2); x.stroke(); x.fill(); }
    }
    // مخروط الرؤية والسهم
    x.save(); x.translate(S / 2, S / 2); x.rotate(-g.yaw);
    const gr = x.createRadialGradient(0, 0, 4, 0, 0, S * 0.5); gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, S * 0.5, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); x.closePath(); x.fill(); x.restore();
    this.arrow(x, S / 2, S / 2, g.yaw, '#ffffff', 9);
  }
  drawFull(cv, g) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height, me = g.mp;
    // تكبير سلس (بالقرص أو الزر) وسحب حرّ؛ يتبع اللاعب ما لم يُسحب يدوياً
    const z = this.zoom || 1; this.zs = (this.zs || z) + (z - (this.zs || z)) * 0.3; if (Math.abs(this.zs - z) < 0.002) this.zs = z;
    const s = Math.min(W / this.SW, H / this.SD) * this.zs;
    let ox = (W - this.SW * s) / 2, oy = (H - this.SD * s) / 2;
    if (this.zs > 1.001) {
      const cx = this.follow !== false && me ? this.px(me.pos[0]) : (this.cx ?? this.SW / 2), cy = this.follow !== false && me ? this.pz(me.pos[2]) : (this.cy ?? this.SD / 2);
      ox = W / 2 - cx * s; oy = H / 2 - cy * s;
      ox = this.SW * s > W ? Math.min(0, Math.max(W - this.SW * s, ox)) : (W - this.SW * s) / 2; oy = this.SD * s > H ? Math.min(0, Math.max(H - this.SD * s, oy)) : (H - this.SD * s) / 2;
    }
    this.view = { s, ox, oy, W, H };
    x.fillStyle = '#1a1612'; x.fillRect(0, 0, W, H);
    x.save(); x.translate(ox, oy); x.scale(s, s); x.drawImage(this.bg, 0, 0);
    // أسماء المناطق
    const info = this.info || {};
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const a of info.areas || []) {
      x.font = `700 ${a.big ? 30 : 22}px 'Reem Kufi', 'Cairo', sans-serif`; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.55)';
      x.strokeText(a.name, this.px(a.x), this.pz(a.z)); x.fillStyle = a.col || '#fff3d6'; x.fillText(a.name, this.px(a.x), this.pz(a.z));
    }
    for (const p of info.pois || []) this.poi(x, this.px(p.x), this.pz(p.z), p, 15 / Math.sqrt(this.zs), this.zs > 1.6);
    { const W = g.wps, tg = W && W.target; if (tg && W.path) this.route(x, W.path, (a, b) => [this.px(a), this.pz(b)], W.quest ? WP_COL.quest : WP_COL.mine, 9); for (const m of this.marks(g)) this.pin(x, this.px(m.x), this.pz(m.z), m.col, 17, m.glyph, m.dot); }
    if (me) for (const c of g.sim.cps || []) this.cpMark(x, this.px(c.x), this.pz(c.z), Math.max(14, this.px(c.x + c.r) - this.px(c.x)), c, me.team, 22);
    if (me) {
      const now = g.t;
      for (const p of g.sim.players.values()) {
        if (!p.alive || p.id === g.me) continue;
        this.g = g; if (!this.revealed(p, me, g.shotAt, now)) continue;
        if (p.team === me.team) { const X = this.px(p.pos[0]), Z = this.pz(p.pos[2]); this.arrow(x, X, Z, p.yaw, TEAMS[p.team].color, 13); if (!p.bot && p.name) { x.font = "800 17px 'Cairo', sans-serif"; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.75)'; x.strokeText(p.name, X, Z - 15); x.fillStyle = '#e8fbff'; x.fillText(p.name, X, Z - 15); } }
        else { x.fillStyle = '#ff3b3b'; x.beginPath(); x.arc(this.px(p.pos[0]), this.pz(p.pos[2]), 10, 0, Math.PI * 2); x.fill(); }
      }
      this.arrow(x, this.px(me.pos[0]), this.pz(me.pos[2]), g.yaw, '#ffffff', 16);
      x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 3; x.beginPath(); x.arc(this.px(me.pos[0]), this.pz(me.pos[2]), 30, 0, Math.PI * 2); x.stroke();
    }
    x.restore();
    // البوصلة
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = "800 22px 'Cairo'"; x.textAlign = 'center'; x.fillText('ش ▲', W / 2, Math.max(24, oy + 24));
  }
}
