// المؤثرات: جسيمات (غبار، شرر، دخان، نار، دم)، خطوط الرصاص، ثقوب الجدران، ومضات الفوهة، انفجارات
import * as THREE from 'three';

function canvasTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const softTex = () => canvasTex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
const puffTex = () => canvasTex(128, (x, s) => {
  for (let i = 0; i < 26; i++) { const r = s * (0.12 + Math.random() * 0.18), px = s / 2 + (Math.random() - 0.5) * s * 0.45, py = s / 2 + (Math.random() - 0.5) * s * 0.45; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }
});
const holeTex = () => canvasTex(64, (x, s) => {
  x.clearRect(0, 0, s, s);
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(10,8,6,1)'); g.addColorStop(0.18, 'rgba(20,16,12,0.95)'); g.addColorStop(0.35, 'rgba(60,50,40,0.5)'); g.addColorStop(1, 'rgba(60,50,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  x.strokeStyle = 'rgba(25,20,15,0.6)'; x.lineWidth = 1.2; for (let k = 0; k < 6; k++) { const a = Math.random() * Math.PI * 2; x.beginPath(); x.moveTo(s / 2, s / 2); x.lineTo(s / 2 + Math.cos(a) * s * 0.35, s / 2 + Math.sin(a) * s * 0.35); x.stroke(); }
});
const flashTex = () => canvasTex(128, (x, s) => {
  x.translate(s / 2, s / 2);
  for (let k = 0; k < 7; k++) { x.rotate(Math.PI * 2 / 7 + Math.random() * 0.3); const g = x.createLinearGradient(0, 0, s * 0.48, 0); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(1, 'rgba(255,150,40,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, -s * 0.05); x.lineTo(s * 0.48, 0); x.lineTo(0, s * 0.05); x.fill(); }
  const g = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.25); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = g; x.fillRect(-s / 2, -s / 2, s, s);
});

class Particles {
  constructor(cap, tex, additive) {
    this.cap = cap; this.n = 0;
    this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap);
    this.s0 = new Float32Array(cap); this.s1 = new Float32Array(cap); this.col = new Float32Array(cap * 4); this.a0 = new Float32Array(cap); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    this.posA = new THREE.BufferAttribute(new Float32Array(cap * 3), 3); this.sizeA = new THREE.BufferAttribute(new Float32Array(cap), 1); this.colA = new THREE.BufferAttribute(new Float32Array(cap * 4), 4);
    this.posA.setUsage(THREE.DynamicDrawUsage); this.sizeA.setUsage(THREE.DynamicDrawUsage); this.colA.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posA); g.setAttribute('size', this.sizeA); g.setAttribute('rgba', this.colA);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !additive,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: tex }, scale: { value: 700 } }]),
      vertexShader: `attribute float size; attribute vec4 rgba; varying vec4 vC; uniform float scale;
        #include <fog_pars_vertex>
        void main(){ vC = rgba; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / max(0.1, -mvPosition.z); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC;
        #include <fog_pars_fragment>
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.rgb, vC.a * t.a); if (gl_FragColor.a < 0.004) discard;
        #include <fog_fragment>
        }`,
    });
    this.mat.uniforms.map.value = tex;
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = additive ? 5 : 4;
    g.setDrawRange(0, 0);
  }
  add(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0) {
    let i = this.n < this.cap ? this.n++ : Math.floor(Math.random() * this.cap);
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = 0; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.a0[i] = a; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    let w = 0; const P = this.posA.array, S = this.sizeA.array, C = this.colA.array;
    for (let i = 0; i < this.n; i++) {
      this.life[i] += dt; if (this.life[i] >= this.max[i]) continue;
      if (w !== i) { // ضغط المصفوفة
        for (let k = 0; k < 3; k++) { this.p[w * 3 + k] = this.p[i * 3 + k]; this.v[w * 3 + k] = this.v[i * 3 + k]; }
        for (let k = 0; k < 4; k++) this.col[w * 4 + k] = this.col[i * 4 + k];
        this.life[w] = this.life[i]; this.max[w] = this.max[i]; this.s0[w] = this.s0[i]; this.s1[w] = this.s1[i]; this.a0[w] = this.a0[i]; this.grav[w] = this.grav[i]; this.drag[w] = this.drag[i];
      }
      const d = Math.exp(-this.drag[w] * dt);
      this.v[w * 3] *= d; this.v[w * 3 + 1] = this.v[w * 3 + 1] * d - this.grav[w] * dt; this.v[w * 3 + 2] *= d;
      for (let k = 0; k < 3; k++) { this.p[w * 3 + k] += this.v[w * 3 + k] * dt; P[w * 3 + k] = this.p[w * 3 + k]; }
      const t = this.life[w] / this.max[w];
      S[w] = this.s0[w] + (this.s1[w] - this.s0[w]) * t;
      C[w * 4] = this.col[w * 4]; C[w * 4 + 1] = this.col[w * 4 + 1]; C[w * 4 + 2] = this.col[w * 4 + 2];
      C[w * 4 + 3] = this.a0[w] * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      w++;
    }
    this.n = w;
    this.points.geometry.setDrawRange(0, w);
    this.posA.needsUpdate = true; this.sizeA.needsUpdate = true; this.colA.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, Q) {
    this.scene = scene; this.Q = Q; this.k = Q.particles;
    const soft = softTex(), puff = puffTex();
    this.add = new Particles(1200, soft, true); this.alpha = new Particles(1600, puff, false); this.smokeP = new Particles(900, puff, false);
    scene.add(this.add.points, this.alpha.points, this.smokeP.points);
    // خطوط الرصاص
    this.tracers = []; const tc = 64;
    const tg = new THREE.BufferGeometry(); this.tPos = new Float32Array(tc * 12); this.tUv = new Float32Array(tc * 8);
    const idx = []; for (let i = 0; i < tc; i++) { idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); this.tUv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); }
    tg.setIndex(idx); tg.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute('uv', new THREE.BufferAttribute(this.tUv, 2));
    this.tMesh = new THREE.Mesh(tg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: `varying vec2 vU; void main(){ float a = (1.0 - abs(vU.y*2.0-1.0)) * smoothstep(0.0,0.6,vU.x); gl_FragColor = vec4(1.0,0.85,0.5, a*0.9); }` }));
    this.tMesh.frustumCulled = false; this.tCap = tc; scene.add(this.tMesh);
    // ثقوب
    const dc = Q.decals;
    this.dMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshBasicMaterial({ map: holeTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), dc);
    this.dMesh.count = 0; this.dCap = dc; this.dIdx = 0; this.dMesh.frustumCulled = false; scene.add(this.dMesh);
    // ومضة الانفجار
    this.flashTex = flashTex();
    this.flashes = [];
    this.light = new THREE.PointLight(0xffaa55, 0, 9, 2); scene.add(this.light); this.lightT = 0;
    this.boomLight = new THREE.PointLight(0xff8a3a, 0, 30, 1.6); scene.add(this.boomLight); this.boomT = 0;
    this.smokes = new Map(); this.fires = new Map();
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3();
  }
  // ثقب رصاصة موجّه حسب العمودي
  decal(p, n) {
    const i = this.dIdx++ % this.dCap; if (this.dMesh.count < this.dCap) this.dMesh.count++;
    const q = this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this._v.set(n[0], n[1], n[2]));
    const s = 0.7 + Math.random() * 0.6;
    this._m.compose(new THREE.Vector3(p[0] + n[0] * 0.005, p[1] + n[1] * 0.005, p[2] + n[2] * 0.005), q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28)), new THREE.Vector3(s, s, s));
    this.dMesh.setMatrixAt(i, this._m); this.dMesh.instanceMatrix.needsUpdate = true;
  }
  impact(p, n, mat) {
    const k = this.k, A = this.alpha, S = this.add;
    const col = mat === 2 ? [0.45, 0.32, 0.2] : mat === 5 ? [0.75, 0.65, 0.5] : mat === 3 ? [0.6, 0.6, 0.6] : [0.78, 0.68, 0.55];
    for (let i = 0; i < 6 * k; i++) A.add(p[0], p[1], p[2], n[0] * (1 + Math.random() * 2) + (Math.random() - 0.5) * 1.6, n[1] * 2 + Math.random() * 1.5, n[2] * (1 + Math.random() * 2) + (Math.random() - 0.5) * 1.6, 0.5 + Math.random() * 0.6, 0.06, 0.35, col[0], col[1], col[2], 0.55, 2, 3);
    if (mat === 3 || mat === 1 || mat === 0 || mat === 7) for (let i = 0; i < 5 * k; i++) S.add(p[0], p[1], p[2], n[0] * 4 + (Math.random() - 0.5) * 6, n[1] * 4 + Math.random() * 4, n[2] * 4 + (Math.random() - 0.5) * 6, 0.12 + Math.random() * 0.15, 0.04, 0.01, 1, 0.75, 0.4, 1, 9, 1);
    if (mat === 2) for (let i = 0; i < 4 * k; i++) A.add(p[0], p[1], p[2], n[0] * 3 + (Math.random() - 0.5) * 3, Math.random() * 3, n[2] * 3 + (Math.random() - 0.5) * 3, 0.6, 0.03, 0.03, 0.35, 0.22, 0.12, 1, 12, 1);
    this.decal(p, n);
  }
  blood(p, dir) {
    for (let i = 0; i < 7 * this.k; i++) this.alpha.add(p[0], p[1], p[2], dir[0] * 2 + (Math.random() - 0.5) * 1.5, (Math.random()) * 1.2, dir[2] * 2 + (Math.random() - 0.5) * 1.5, 0.35 + Math.random() * 0.3, 0.05, 0.22, 0.45, 0.04, 0.03, 0.75, 5, 4);
  }
  tracer(a, b, speed = 400) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (L < 2) return;
    this.tracers.push({ a, b, L, t: 0, speed, len: Math.min(6, L * 0.4) });
    if (this.tracers.length > this.tCap) this.tracers.shift();
  }
  muzzle(p, dir, big = 1) {
    for (let i = 0; i < 4; i++) this.add.add(p[0], p[1], p[2], dir[0] * (2 + i * 2) + (Math.random() - 0.5), dir[1] * (2 + i * 2) + (Math.random() - 0.5), dir[2] * (2 + i * 2) + (Math.random() - 0.5), 0.06, 0.25 * big, 0.05, 1, 0.7, 0.3, 0.8);
    for (let i = 0; i < 2 * this.k; i++) this.alpha.add(p[0], p[1], p[2], dir[0] * 1.5 + (Math.random() - 0.5) * 0.4, dir[1] * 1.5 + 0.3, dir[2] * 1.5 + (Math.random() - 0.5) * 0.4, 0.6, 0.08, 0.5, 0.7, 0.7, 0.7, 0.18, -0.3, 2);
  }
  lightFlash(p, color = 0xffaa55, i = 3) { if (this.Q.details < 1) return; this.light.position.set(p[0], p[1], p[2]); this.light.color.setHex(color); this.light.intensity = i; this.lightT = 0.05; }
  explosion(p, kind) {
    const k = this.k, A = this.alpha, S = this.add;
    if (kind === 'frag') {
      for (let i = 0; i < 40 * k; i++) { const a = Math.random() * 6.28, b = Math.random() * 1.5, sp = 3 + Math.random() * 9; S.add(p[0], p[1] + 0.2, p[2], Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp, Math.sin(a) * Math.cos(b) * sp, 0.25 + Math.random() * 0.3, 0.5, 0.1, 1, 0.6 + Math.random() * 0.3, 0.2, 1, 6, 2); }
      for (let i = 0; i < 30 * k; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 4; A.add(p[0], p[1] + 0.3, p[2], Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp, 1.5 + Math.random() * 1.5, 0.5, 3.5, 0.32, 0.29, 0.26, 0.75, -0.4, 1.5); }
      for (let i = 0; i < 18 * k; i++) A.add(p[0], p[1] + 0.2, p[2], (Math.random() - 0.5) * 12, 3 + Math.random() * 8, (Math.random() - 0.5) * 12, 1.2, 0.06, 0.06, 0.2, 0.17, 0.14, 1, 14, 0.5);
      this.boomLight.position.set(p[0], p[1] + 1, p[2]); this.boomLight.intensity = 60; this.boomT = 0.35;
    } else if (kind === 'flash') {
      for (let i = 0; i < 20; i++) S.add(p[0], p[1], p[2], (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.25, 2, 0.5, 1, 1, 1, 1, 0, 2);
      this.boomLight.position.set(p[0], p[1] + 0.5, p[2]); this.boomLight.color.setHex(0xffffff); this.boomLight.intensity = 120; this.boomT = 0.2;
    } else if (kind === 'molotov') {
      for (let i = 0; i < 20 * k; i++) S.add(p[0], p[1] + 0.2, p[2], (Math.random() - 0.5) * 5, 1 + Math.random() * 4, (Math.random() - 0.5) * 5, 0.5, 0.6, 0.2, 1, 0.5, 0.1, 1, 3, 1);
    }
  }
  // دخان القنابل الدخانية (يُدار حسب حالة المحاكاة)
  syncSmokes(list, dt) {
    for (const s of list) {
      const key = s.x.toFixed(2) + ',' + s.z.toFixed(2);
      let st = this.smokes.get(key); if (!st) { st = { acc: 0 }; this.smokes.set(key, st); }
      st.seen = true;
      const r = s.r * Math.min(1, s.t / 2), left = s.life - s.t;
      st.acc += dt * (left > 2 ? 26 : 0) * this.k;
      while (st.acc > 1) { st.acc--; const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r, h = Math.random() * 3.2; const g = 0.62 + Math.random() * 0.12; this.smokeP.add(s.x + Math.cos(a) * rr, s.y + 0.3 + h, s.z + Math.sin(a) * rr, (Math.random() - 0.5) * 0.3, 0.05, (Math.random() - 0.5) * 0.3, Math.min(left, 4 + Math.random() * 2), 2.4, 3.6, g, g, g * 1.02, 0.6, -0.01, 0.2); }
    }
    for (const [k, st] of this.smokes) { if (!st.seen) this.smokes.delete(k); st.seen = false; }
  }
  syncFires(list, dt, t) {
    for (const f of list) {
      for (let i = 0; i < 40 * dt * this.k * 10; i++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * f.r; this.add.add(f.x + Math.cos(a) * rr, f.y + 0.05, f.z + Math.sin(a) * rr, 0, 1 + Math.random() * 1.5, 0, 0.4 + Math.random() * 0.4, 0.5 + Math.random() * 0.4, 0.1, 1, 0.45 + Math.random() * 0.2, 0.1, 0.9, -1.5, 1); }
      if (Math.random() < dt * 8) { const a = Math.random() * 6.28; this.alpha.add(f.x + Math.cos(a) * f.r * 0.5, f.y + 1, f.z + Math.sin(a) * f.r * 0.5, 0, 1.4, 0, 2.5, 0.6, 2.5, 0.12, 0.1, 0.09, 0.5, -0.3, 0.6); }
      this.light.position.set(f.x, f.y + 1, f.z); this.light.color.setHex(0xff7a2a); this.light.intensity = 6 + Math.sin(t * 30) * 2; this.lightT = 0.06;
    }
  }
  update(dt, cam) {
    this.add.update(dt); this.alpha.update(dt); this.smokeP.update(dt);
    // تحديث خطوط الرصاص (أشرطة تواجه الكاميرا)
    const P = this.tPos; let n = 0; const cp = cam.position;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]; tr.t += dt * tr.speed;
      if (tr.t - tr.len > tr.L) { this.tracers.splice(i, 1); continue; }
      const h = Math.min(tr.t, tr.L), tl = Math.max(0, tr.t - tr.len);
      const dx = (tr.b[0] - tr.a[0]) / tr.L, dy = (tr.b[1] - tr.a[1]) / tr.L, dz = (tr.b[2] - tr.a[2]) / tr.L;
      const ax = tr.a[0] + dx * tl, ay = tr.a[1] + dy * tl, az = tr.a[2] + dz * tl, bx = tr.a[0] + dx * h, by = tr.a[1] + dy * h, bz = tr.a[2] + dz * h;
      const vx = (ax + bx) / 2 - cp.x, vy = (ay + by) / 2 - cp.y, vz = (az + bz) / 2 - cp.z;
      let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx; const sl = Math.hypot(sx, sy, sz) || 1, w = 0.012 * Math.max(1, Math.hypot(vx, vy, vz) * 0.05);
      sx *= w / sl; sy *= w / sl; sz *= w / sl;
      P.set([ax - sx, ay - sy, az - sz, bx - sx, by - sy, bz - sz, bx + sx, by + sy, bz + sz, ax + sx, ay + sy, az + sz], n * 12); n++;
      if (n >= this.tCap) break;
    }
    this.tMesh.geometry.setDrawRange(0, n * 6); this.tMesh.geometry.attributes.position.needsUpdate = true;
    if (this.lightT > 0) { this.lightT -= dt; if (this.lightT <= 0) this.light.intensity = 0; }
    if (this.boomT > 0) { this.boomT -= dt; this.boomLight.intensity *= Math.exp(-dt * 12); if (this.boomT <= 0) { this.boomLight.intensity = 0; this.boomLight.color.setHex(0xff8a3a); } }
  }
}
