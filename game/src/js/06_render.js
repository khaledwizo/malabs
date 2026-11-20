// ===================== الرسم: الدقة، الكاميرا، الإضاءة، التوهج، الجسيمات =====================
const Sprites = {
  cache: new Map(),
  glow(hex) {
    let c = this.cache.get('g' + hex);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const [r, g, b] = hexRgb(hex);
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.18, `rgba(${r},${g},${b},0.8)`);
    gr.addColorStop(0.45, `rgba(${r},${g},${b},0.3)`); gr.addColorStop(0.75, `rgba(${r},${g},${b},0.08)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.cache.set('g' + hex, c); return c;
  },
  light(hex) {
    let c = this.cache.get('l' + hex);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const [r, g, b] = hexRgb(hex);
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.3, `rgba(${r},${g},${b},0.62)`);
    gr.addColorStop(0.62, `rgba(${r},${g},${b},0.22)`); gr.addColorStop(0.86, `rgba(${r},${g},${b},0.05)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    this.cache.set('l' + hex, c); return c;
  },
};

// جسيمات: 0 شرارة، 1 نقطة متوهجة، 2 دخان، 3 حطام، 4 حلقة، 5 نص
const FX = {
  list: [], pool: [], max: 900,
  add(k, x, y, vx, vy, life, s, c, drag = 2.2, s2 = 0, rot = 0, vr = 0, txt = '') {
    if (this.list.length >= this.max) return null;
    const p = this.pool.pop() || {};
    p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.s = s; p.c = c;
    p.drag = drag; p.s2 = s2; p.rot = rot; p.vr = vr; p.txt = txt;
    this.list.push(p); return p;
  },
  burst(x, y, n, c, speed = 120, life = 0.5, size = 2, k = 0) {
    n = Math.max(1, Math.round(n * (R.q ? R.q.particles : 1)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (0.25 + Math.random());
      this.add(k, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.7), size * (0.6 + Math.random() * 0.8), c);
    }
  },
  smoke(x, y, n, c = '#2a2e35') {
    n = Math.max(1, Math.round(n * (R.q ? R.q.particles : 1)));
    for (let i = 0; i < n; i++) this.add(2, x + rand(-6, 6), y + rand(-6, 6), rand(-20, 20), rand(-20, 20), rand(0.6, 1.3), rand(10, 18), c, 1.5, rand(3, 6));
  },
  debris(x, y, n, c = '#5a606b') {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rand(60, 200); this.add(3, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 1.1), rand(1.5, 3.5), c, 3, 0, rand(0, TAU), rand(-12, 12)); }
  },
  ring(x, y, r0, r1, life, c, width = 3) { this.add(4, x, y, 0, 0, life, r0, c, 0, r1, width); },
  text(x, y, txt, c) { this.add(5, x, y, 0, -30, 1.2, 12, c, 1, 0, 0, 0, txt); },
  clear() { while (this.list.length) this.pool.push(this.list.pop()); },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life -= dt;
      if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); this.pool.push(p); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
  },
  draw(ctx, emissive, glowPass) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i], t = p.life / p.max;
      switch (p.k) {
        case 0:
          if (!emissive) break;
          ctx.globalAlpha = t; ctx.strokeStyle = p.c; ctx.lineWidth = p.s;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
          break;
        case 1: {
          if (!emissive) break;
          const s = p.s * (0.6 + 0.4 * t) * 3;
          ctx.globalAlpha = t; ctx.drawImage(Sprites.glow(p.c), p.x - s, p.y - s, s * 2, s * 2);
          break;
        }
        case 2:
          if (emissive) break;
          ctx.globalAlpha = t * 0.32; ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, lerp(p.s, p.s2, t), 0, TAU); ctx.fill();
          break;
        case 3: {
          if (emissive) break;
          ctx.globalAlpha = Math.min(1, t * 2); ctx.fillStyle = p.c;
          const c = Math.cos(p.rot) * p.s, s = Math.sin(p.rot) * p.s;
          ctx.beginPath(); ctx.moveTo(p.x - c, p.y - s); ctx.lineTo(p.x + c * 0.4 - s * 0.6, p.y + s * 0.4 + c * 0.6); ctx.lineTo(p.x + c, p.y + s); ctx.fill();
          break;
        }
        case 4: {
          if (!emissive) break;
          const r = p.s + (p.s2 - p.s) * easeOut(1 - t);
          ctx.globalAlpha = t; ctx.strokeStyle = p.c; ctx.lineWidth = p.rot * t + 0.6;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
          break;
        }
        case 5:
          if (!emissive || glowPass) break;
          ctx.globalAlpha = Math.min(1, t * 2.5); ctx.fillStyle = p.c; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(p.txt, p.x, p.y);
          break;
      }
    }
    ctx.globalAlpha = 1;
  },
};

const R = {
  cv: null, ctx: null, W: 0, H: 0, cssW: 1, cssH: 1, dpr: 1,
  lcv: null, lctx: null, lW: 0, lH: 0, ls: 0.5,
  gcv: null, gctx: null, gW: 0, gH: 0, gs: 0.25,
  b1: null, b1c: null, b2: null, b2c: null, b3: null, b3c: null,
  zoom: 1, camX: 0, camY: 0, shx: 0, shy: 0, trauma: 0,
  q: QUALITY.high, vig: null, vigRed: null, vigBlue: null, lowLatency: null, vb: { x0: 0, y0: 0, x1: 0, y1: 0 },
  init() {
    const mk = () => document.createElement('canvas');
    this.lcv = mk(); this.lctx = this.lcv.getContext('2d');
    this.gcv = mk(); this.gctx = this.gcv.getContext('2d');
    this.b1 = mk(); this.b1c = this.b1.getContext('2d');
    this.b2 = mk(); this.b2c = this.b2.getContext('2d');
    this.b3 = mk(); this.b3c = this.b3.getContext('2d');
    this.cv = $('#cv');
    this.makeContext();
    const onR = () => this.resize();
    window.addEventListener('resize', onR);
    window.addEventListener('orientationchange', () => setTimeout(onR, 150));
    if (window.visualViewport) visualViewport.addEventListener('resize', onR);
  },
  makeContext() {
    const ll = !!Settings.lowLatency;
    if (this.ctx && ll === this.lowLatency) return;
    if (this.ctx) {
      const n = document.createElement('canvas'); n.id = 'cv';
      this.cv.replaceWith(n); this.cv = n; this.W = this.H = 0;
    }
    this.lowLatency = ll;
    this.ctx = this.cv.getContext('2d', { alpha: false, desynchronized: ll }) || this.cv.getContext('2d');
    this.resize();
  },
  resize() {
    const cssW = Math.max(1, window.innerWidth | 0), cssH = Math.max(1, window.innerHeight | 0);
    const dpr = Math.max(0.5, window.devicePixelRatio || 1);
    const opt = RES_OPTIONS.find(o => o.id === Settings.res) || RES_OPTIONS[0];
    let w, h;
    if (opt.kind === 'scale') { w = cssW * dpr * opt.v; h = cssH * dpr * opt.v; }
    else { const s = opt.v / Math.min(cssW, cssH); w = cssW * s; h = cssH * s; }
    const MAXA = 16.7e6, MAXD = 8192;
    let k = 1;
    if (w * h > MAXA) k = Math.sqrt(MAXA / (w * h));
    k = Math.min(k, MAXD / w, MAXD / h);
    const W = Math.max(64, Math.round(w * k)), H = Math.max(64, Math.round(h * k));
    if (W !== this.W || H !== this.H) { this.cv.width = W; this.cv.height = H; this.W = W; this.H = H; }
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    this.cv.style.imageRendering = Settings.smooth ? 'auto' : 'pixelated';
    this.applyQuality();
    const zt = (ZOOMS.find(z => z.id === Settings.zoom) || ZOOMS[1]).tiles;
    this.zoom = Math.min(W, H) / (zt * T);
    this.makeVignette();
  },
  applyQuality() {
    this.q = QUALITY[Settings.quality] || QUALITY.high;
    this.ls = this.q.lightScale;
    const lW = Math.max(16, Math.ceil(this.W * this.ls)), lH = Math.max(16, Math.ceil(this.H * this.ls));
    if (lW !== this.lW || lH !== this.lH) { this.lcv.width = lW; this.lcv.height = lH; this.lW = lW; this.lH = lH; this.makeLightVignette(); }
    this.gs = this.q.glowScale;
    const gW = Math.max(16, Math.ceil(this.W * this.gs)), gH = Math.max(16, Math.ceil(this.H * this.gs));
    if (gW !== this.gW || gH !== this.gH) {
      this.gcv.width = gW; this.gcv.height = gH; this.gW = gW; this.gH = gH;
      this.b1.width = Math.max(8, gW >> 1); this.b1.height = Math.max(8, gH >> 1);
      this.b2.width = Math.max(4, gW >> 2); this.b2.height = Math.max(4, gH >> 2);
      this.b3.width = Math.max(2, gW >> 3); this.b3.height = Math.max(2, gH >> 3);
    }
    FX.max = Math.round(900 * this.q.particles);
  },
  makeVignette() {
    const c = this.ctx, W = this.W, H = this.H;
    const mk = (hex, a0, a1) => {
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, col(hex, a0)); g.addColorStop(1, col(hex, a1)); return g;
    };
    this.vig = mk('#000000', 0, 0.62);
    this.makeLightVignette();
    this.vigRed = mk('#ff1020', 0, 0.55);
    this.vigBlue = mk('#30a0ff', 0, 0.45);
  },
  makeLightVignette() {
    const l = this.lctx, W = this.lW, H = this.lH;
    const g = l.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#5c5c5c');
    this.vigL = g;
  },
  cam(ctx, s = 1) {
    const z = this.zoom * s;
    ctx.setTransform(z, 0, 0, z, (this.W * 0.5 + this.shx) * s - this.camX * z, (this.H * 0.5 + this.shy) * s - this.camY * z);
  },
  view() {
    const hw = this.W * 0.5 / this.zoom + T, hh = this.H * 0.5 / this.zoom + T, v = this.vb;
    v.x0 = this.camX - hw; v.y0 = this.camY - hh; v.x1 = this.camX + hw; v.y1 = this.camY + hh;
    return v;
  },
  inView(x, y, m = 0) { const v = this.vb; return x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m; },
  addTrauma(a) { if (Settings.shake) this.trauma = Math.min(1, this.trauma + a); },
  updateShake(dt, t) {
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const s = this.trauma * this.trauma * Math.min(this.W, this.H) * 0.02;
    this.shx = s * (Math.sin(t * 0.091) + Math.sin(t * 0.057) * 0.6) / 1.6;
    this.shy = s * (Math.sin(t * 0.083 + 1) + Math.sin(t * 0.049 + 2) * 0.6) / 1.6;
  },
  clear(hex) { const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = hex; c.fillRect(0, 0, this.W, this.H); },
  // --------- الإضاءة ---------
  lightBegin(ambient) {
    const l = this.lctx;
    l.setTransform(1, 0, 0, 1, 0, 0); l.globalAlpha = 1; l.globalCompositeOperation = 'source-over';
    l.fillStyle = ambient; l.fillRect(0, 0, this.lW, this.lH);
    l.globalCompositeOperation = 'lighter';
    this.cam(l, this.ls);
  },
  lightSprite(x, y, r, hex, a) {
    if (a <= 0.01 || !this.inView(x, y, r)) return;
    const l = this.lctx; l.globalAlpha = Math.min(1, a);
    l.drawImage(Sprites.light(hex), x - r, y - r, r * 2, r * 2);
  },
  lightPoly(poly, n, x, y, r, hex, a) {
    if (a <= 0.01 || !this.inView(x, y, r)) return;
    const l = this.lctx;
    l.save(); l.beginPath(); l.moveTo(poly[0], poly[1]);
    for (let i = 1; i < n; i++) l.lineTo(poly[i * 2], poly[i * 2 + 1]);
    l.closePath(); l.clip();
    l.globalAlpha = Math.min(1, a); l.drawImage(Sprites.light(hex), x - r, y - r, r * 2, r * 2);
    l.restore();
  },
  lightEnd() {
    const l = this.lctx, c = this.ctx;
    l.globalAlpha = 1;
    if (this.vigL) { l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'multiply'; l.fillStyle = this.vigL; l.fillRect(0, 0, this.lW, this.lH); }
    l.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'multiply';
    c.drawImage(this.lcv, 0, 0, this.lW, this.lH, 0, 0, this.lW / this.ls, this.lH / this.ls);
    c.globalCompositeOperation = 'source-over';
  },
  // --------- التوهج (Bloom) ---------
  bloom(drawFn) {
    const q = this.q; if (!q.bloom) return;
    const g = this.gctx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.gW, this.gH);
    this.cam(g, this.gs);
    drawFn(g);
    g.globalAlpha = 1;
    const b1 = this.b1c, b2 = this.b2c, b3 = this.b3c;
    b1.setTransform(1, 0, 0, 1, 0, 0); b1.clearRect(0, 0, this.b1.width, this.b1.height); b1.drawImage(this.gcv, 0, 0, this.b1.width, this.b1.height);
    b2.setTransform(1, 0, 0, 1, 0, 0); b2.clearRect(0, 0, this.b2.width, this.b2.height); b2.drawImage(this.b1, 0, 0, this.b2.width, this.b2.height);
    if (q.bloom >= 3) { b3.setTransform(1, 0, 0, 1, 0, 0); b3.clearRect(0, 0, this.b3.width, this.b3.height); b3.drawImage(this.b2, 0, 0, this.b3.width, this.b3.height); }
    const c = this.ctx, Wd = this.gW / this.gs, Hd = this.gH / this.gs;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter';
    if (q.bloom === 1) { c.globalAlpha = 0.9; c.drawImage(this.b1, 0, 0, Wd, Hd); }
    else { c.globalAlpha = 0.8; c.drawImage(this.b1, 0, 0, Wd, Hd); c.globalAlpha = 0.85; c.drawImage(q.bloom >= 3 ? this.b3 : this.b2, 0, 0, Wd, Hd); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
  post(alarm, hurt, blue, flash) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    if (alarm > 0.01) { c.globalAlpha = alarm; c.fillStyle = this.vigRed; c.fillRect(0, 0, this.W, this.H); }
    if (blue > 0.01) { c.globalAlpha = blue; c.fillStyle = this.vigBlue; c.fillRect(0, 0, this.W, this.H); }
    if (hurt > 0.01) { c.globalAlpha = hurt * 0.3; c.fillStyle = '#ff2030'; c.fillRect(0, 0, this.W, this.H); }
    if (flash > 0.01) { c.globalAlpha = flash * 0.5; c.fillStyle = '#e8fbff'; c.fillRect(0, 0, this.W, this.H); }
    c.globalAlpha = 1;
  },
};
