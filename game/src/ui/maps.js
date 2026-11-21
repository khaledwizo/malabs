// الخرائط: المصغّرة (يمين الأعلى، الشمال للأعلى) والكبيرة التي تُفتح وتُغلق كما في ببجي
import { MAT } from '../world/collide.js';
import { TEAMS } from '../sim/sim.js';

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
    if (d < 24 && sp > 2.8 && p.crouch < 0.5) return true;
    const s = shotAt.get(p.id); if (s && !s.q && now - s.t < 3) return true;
    return false;
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
    // اللاعبون
    const now = g.t;
    for (const p of g.sim.players.values()) {
      if (p.id === g.me || !p.alive) continue;
      if (!this.revealed(p, me, g.shotAt, now)) continue;
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
    const s = Math.min(W / this.SW, H / this.SD) * (this.zoom || 1);
    let ox = (W - this.SW * s) / 2, oy = (H - this.SD * s) / 2;
    if ((this.zoom || 1) > 1 && me) { ox = W / 2 - this.px(me.pos[0]) * s; oy = H / 2 - this.pz(me.pos[2]) * s; ox = Math.min(0, Math.max(W - this.SW * s, ox)); oy = Math.min(0, Math.max(H - this.SD * s, oy)); }
    x.fillStyle = '#1a1612'; x.fillRect(0, 0, W, H);
    x.save(); x.translate(ox, oy); x.scale(s, s); x.drawImage(this.bg, 0, 0);
    // أسماء المناطق
    const info = this.info || {};
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const a of info.areas || []) {
      x.font = `700 ${a.big ? 30 : 22}px 'Reem Kufi', 'Cairo', sans-serif`; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.55)';
      x.strokeText(a.name, this.px(a.x), this.pz(a.z)); x.fillStyle = a.col || '#fff3d6'; x.fillText(a.name, this.px(a.x), this.pz(a.z));
    }
    if (me) {
      const now = g.t;
      for (const p of g.sim.players.values()) {
        if (!p.alive || p.id === g.me) continue;
        if (!this.revealed(p, me, g.shotAt, now)) continue;
        if (p.team === me.team) this.arrow(x, this.px(p.pos[0]), this.pz(p.pos[2]), p.yaw, TEAMS[p.team].color, 13);
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
