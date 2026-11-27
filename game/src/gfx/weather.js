// الطقس والأجواء: نهار، غروب، عاصفة (مطر وبرق ورعد)، ليلة مرعبة (ضباب وقمر وأشباح)
// المطر على كرت الشاشة مع حجبه تحت الأسقف، رذاذ على الأرض، برق ورعد، ضباب أرضي، أضواء تومض، ظل يتبع اللاعب، وانعكاسات البيئة
import * as THREE from 'three';
import { Audio } from '../core/audio.js';

const C = h => new THREE.Color(h);
const PRESETS = {
  day: { sunDir: [-0.36, 0.86, 0.34], sunCol: 0xfff1de, sunI: 3.2, hemiSky: 0x9cc4ec, hemiGround: 0x8a7a62, hemiI: 0.95, ambCol: 0xfff2e2, ambI: 0.22,
    sky: [0x2f6fd0, 0xa6cdee, 0xe6e0d0], fog: 0xc6d2da, fogD: 0.0052, exp: 1.0, cloud: 0.22, cloudCol: 0xffffff, night: 0, sunVis: 1, moon: 0, rain: 0, wet: 0, lamps: 0.15, glow: 0.25, amb: 'day', bolt: 0, ghosts: 0, mist: 0, deep: 0x1d4b4a, grade: [1, 1, 1, 1.02] },
  sunset: { sunDir: null, sunCol: null, sunI: null, hemiSky: null, hemiGround: 0x8a6a4a, hemiI: 0.9, ambCol: 0xffe2c4, ambI: 0.25,
    sky: null, fog: null, fogD: null, exp: 1.08, cloud: 0.45, cloudCol: 0xffb894, night: 0, sunVis: 1, moon: 0, rain: 0, wet: 0, lamps: 1, glow: 1, amb: 'sunset', bolt: 0, ghosts: 0, mist: 0, deep: 0x16302e, grade: [1.03, 1, 0.97, 1.04] },
  storm: { sunDir: [-0.45, 0.72, 0.3], sunCol: 0xa0aabb, sunI: 0.55, hemiSky: 0x75818f, hemiGround: 0x3b3b3b, hemiI: 0.78, ambCol: 0xb8c4d4, ambI: 0.22,
    sky: [0x1b2129, 0x3f4853, 0x4d5661], fog: 0x4a535e, fogD: 0.0145, exp: 1.18, cloud: 0.96, cloudCol: 0x2d333b, night: 0, sunVis: 0, moon: 0, rain: 1, wet: 1, lamps: 1.25, glow: 1.1, amb: 'storm', bolt: 1, ghosts: 0.2, mist: 0.45, deep: 0x1a2426, grade: [0.96, 1, 1.05, 0.86] },
  horror: { sunDir: [0.34, 0.6, -0.58], sunCol: 0x9fb6e6, sunI: 1.0, hemiSky: 0x3a4a6c, hemiGround: 0x1c1c22, hemiI: 0.9, ambCol: 0x7888b8, ambI: 0.32,
    sky: [0x04070e, 0x111a2c, 0x1e2838], fog: 0x18202c, fogD: 0.016, exp: 1.6, cloud: 0.6, cloudCol: 0x1f2633, night: 1, sunVis: 0, moon: 1, rain: 0.3, wet: 0.55, lamps: 2.6, glow: 2.0, amb: 'horror', bolt: 0.4, ghosts: 1, mist: 1, deep: 0x0a1214, grade: [0.94, 1, 1.08, 0.72] },
};

export class Weather {
  constructor(o) {
    Object.assign(this, o); // renderer, scene, camera, info, Q, L (sun/hemi/amb), sky, meshes, world, kit
    this.id = ''; this.t = 0; this.flash = 0; this.wet = 0; this.boltT = 8; this.ghostT = 30; this.flashSeq = [];
    const I = this.info;
    PRESETS.sunset.sunDir = I.sun.dir; PRESETS.sunset.sunCol = I.sun.color; PRESETS.sunset.sunI = I.sun.intensity; PRESETS.sunset.hemiSky = I.sky.top;
    PRESETS.sunset.sky = [I.sky.top, I.sky.mid, I.sky.bottom]; PRESETS.sunset.fog = I.sky.fog; PRESETS.sunset.fogD = I.sky.fogDensity;
    this.sunDir = new THREE.Vector3(...I.sun.dir).normalize();
    // طقس متغيّر: مطر قصير، غبار الإعصار، وليل هادئ
    PRESETS.rain = { ...PRESETS.storm, sunI: 1.0, hemiI: 0.85, fogD: 0.011, rain: 0.85, wet: 0.7, bolt: 0.35, exp: 1.12, cloud: 0.88, mist: 0.25 };
    PRESETS.dust = { ...PRESETS.day, sunCol: 0xffc890, sunI: 1.5, hemiSky: 0xc8a070, hemiI: 0.8, sky: [0x8a6a48, 0xc49a6a, 0xd8b88a], fog: 0xc29a6a, fogD: 0.032, cloud: 0.8, cloudCol: 0xb08a5a, amb: 'dustwind', grade: [1.06, 0.98, 0.88, 0.95], mist: 0.2, sand: 1 };
    PRESETS.night = { ...PRESETS.horror, ghosts: 0, rain: 0, wet: 0, bolt: 0, mist: 0.12, fogD: 0.011, exp: 1.5, amb: 'night', lamps: 2.9, glow: 1.9 };
    this.cur = null;
    this.buildRoofMap();
    this.buildRain(); this.buildSplash(); this.buildMist(); this.buildGhost();
    this.bolts = [];
    // مواد العالم: نحفظ القيم الأصلية لنبلّلها
    this.matBase = [];
    for (const k in this.kit.mats) { const m = this.kit.mats[k].mat; if (m.isMeshStandardMaterial) this.matBase.push([m, m.roughness, m.color.clone(), k]); }
    this.pmrem = (this.Q.env && this.Q.shadow > 0) ? new THREE.PMREMGenerator(this.renderer) : null;
    this.envScene = null;
    const s = this.L.sun;
    if (s.castShadow) { this.shExt = this.Q.shExt ? Math.max(26, this.Q.shExt * 0.8) : 38; const c = s.shadow.camera; c.left = -this.shExt; c.right = this.shExt; c.top = this.shExt; c.bottom = -this.shExt; c.near = 1; c.far = 320; c.updateProjectionMatrix(); }
  }
  // خريطة ارتفاع الأسقف (من صناديق التصادم) لحجب المطر داخل السوق المسقوف والأروقة والبيوت
  buildRoofMap() {
    const r = this.info.mapRect || [-60, -50, 60, 40], res = 0.5;
    const W = Math.ceil((r[2] - r[0]) / res), H = Math.ceil((r[3] - r[1]) / res), d = new Uint8Array(W * H);
    const b = this.world.b, fl = this.world.flags;
    for (let i = 0; i < fl.length; i++) {
      if (fl[i] & 2) continue; const o = i * 6, top = b[o + 4]; if (top > 30 || top < 0.05) continue;
      const x0 = Math.max(0, Math.floor((b[o] - r[0]) / res)), x1 = Math.min(W - 1, Math.floor((b[o + 3] - r[0]) / res));
      const z0 = Math.max(0, Math.floor((b[o + 2] - r[1]) / res)), z1 = Math.min(H - 1, Math.floor((b[o + 5] - r[1]) / res));
      const v = Math.min(255, Math.ceil(top / 32 * 255));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const k = z * W + x; if (d[k] < v) d[k] = v; }
    }
    const tex = new THREE.DataTexture(d, W, H, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
    this.roof = { tex, rect: new THREE.Vector4(r[0], r[1], r[2] - r[0], r[3] - r[1]) };
  }
  buildRain() {
    const n = Math.round(this.Q.rain || 4000);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    const a = new Float32Array(n * 4); for (let i = 0; i < a.length; i++) a[i] = Math.random();
    g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.rainU = { t: { value: 0 }, cam: { value: new THREE.Vector3() }, rgt: { value: new THREE.Vector3(1, 0, 0) }, box: { value: new THREE.Vector3(34, 20, 34) }, speed: { value: 15 }, wind: { value: new THREE.Vector2(1.6, 0.6) }, alpha: { value: 0 }, roof: { value: this.roof.tex }, rect: { value: this.roof.rect }, col: { value: C(0xaebccc) } };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: this.rainU,
      vertexShader: `attribute vec4 aRnd; uniform float t, speed; uniform vec3 cam, box, rgt; uniform vec2 wind; uniform sampler2D roof; uniform vec4 rect; varying float vA; varying vec2 vU;
        void main(){
          float sp = speed * (0.8 + aRnd.w * 0.4), fall = t * sp;
          vec3 o = cam - box * 0.5;
          vec3 p;
          p.y = o.y + mod(aRnd.y * box.y - o.y - fall, box.y);
          float dropT = (o.y + box.y - p.y) / sp;
          p.x = o.x + mod(aRnd.x * box.x - o.x + wind.x * dropT, box.x);
          p.z = o.z + mod(aRnd.z * box.z - o.z + wind.y * dropT, box.z);
          vec2 uv = (p.xz - rect.xy) / rect.zw;
          float rh = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture2D(roof, uv).r * 32.0 : 0.0;
          vec3 dir = normalize(vec3(wind.x, sp, wind.y));
          vec3 toC = p - cam; float dist = length(toC);
          float len = 0.42 + aRnd.w * 0.25;
          vec3 w = p + rgt * (position.x * (0.006 + dist * 0.0042)) + dir * (position.y * len);
          vA = (p.y > rh + 0.02 ? 1.0 : 0.0) * smoothstep(0.7, 2.2, dist) * (1.0 - smoothstep(box.x * 0.35, box.x * 0.5, dist));
          vU = position.xy + vec2(0.5, 0.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: `uniform float alpha; uniform vec3 col; varying float vA; varying vec2 vU;
        void main(){ float a = vA * alpha * (1.0 - abs(vU.x * 2.0 - 1.0)) * smoothstep(0.0, 0.35, vU.y) * (1.0 - smoothstep(0.7, 1.0, vU.y)); if (a < 0.003) discard; gl_FragColor = vec4(col, a); }`,
    });
    this.rain = new THREE.Mesh(g, m); this.rain.frustumCulled = false; this.rain.renderOrder = 5; this.rain.visible = false; this.scene.add(this.rain);
  }
  // رذاذ القطرات على الأرض والأسطح (حلقات مسطّحة تتّسع وتختفي)
  buildSplash() {
    const n = Math.round((this.Q.rain || 4000) / 14);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5], 3));
    const a = new Float32Array(n * 4); for (let i = 0; i < a.length; i++) a[i] = Math.random();
    g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(a, 4)); g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.splU = { t: { value: 0 }, cam: { value: new THREE.Vector3() }, alpha: { value: 0 }, roof: { value: this.roof.tex }, rect: { value: this.roof.rect }, col: { value: C(0xc8d4e0) } };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: this.splU,
      vertexShader: `attribute vec4 aRnd; uniform float t; uniform vec3 cam; uniform sampler2D roof; uniform vec4 rect; varying vec2 vU; varying float vP;
        float hh(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
          float rate = 1.6 + aRnd.w * 1.4, cyc = t * rate + aRnd.x * 10.0, k = floor(cyc); vP = fract(cyc);
          vec2 xz = cam.xz + (vec2(hh(k * 12.9 + aRnd.y * 91.0), hh(k * 7.7 + aRnd.z * 53.0)) - 0.5) * 26.0;
          vec2 uv = (xz - rect.xy) / rect.zw;
          float y = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture2D(roof, uv).r * 32.0 : 0.0;
          float s = 0.05 + vP * 0.22;
          vU = position.xz * 2.0;
          gl_Position = projectionMatrix * viewMatrix * vec4(xz.x + position.x * s, y + 0.025, xz.y + position.z * s, 1.0);
        }`,
      fragmentShader: `uniform float alpha; uniform vec3 col; varying vec2 vU; varying float vP;
        void main(){ float r = length(vU); float ring = smoothstep(0.62, 0.85, r) * (1.0 - smoothstep(0.86, 1.0, r)); float a = ring * (1.0 - vP) * alpha * 0.55; if (a < 0.004) discard; gl_FragColor = vec4(col, a); }`,
    });
    this.splash = new THREE.Mesh(g, m); this.splash.frustumCulled = false; this.splash.visible = false; this.scene.add(this.splash);
  }
  // ضباب أرضي يتحرك ببطء في المقبرة والحارة المهجورة
  buildMist() {
    const Z = this.info.mist || []; if (!Z.length) return;
    const n = Math.round(70 * Math.min(1.3, this.Q.particles || 1)), pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { const z = Z[i % Z.length]; pos[i * 3] = z[0] + Math.random() * (z[2] - z[0]); pos[i * 3 + 1] = 0.3 + Math.random() * 1.4; pos[i * 3 + 2] = z[1] + Math.random() * (z[3] - z[1]); sz[i] = 5 + Math.random() * 6; ph[i] = Math.random() * 6.28; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(sz, 1)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.mistU = { t: { value: 0 }, alpha: { value: 0 }, col: { value: C(0x8090a0) }, map: { value: tex }, scale: { value: 500 } };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: this.mistU,
      vertexShader: `attribute float size, ph; uniform float t, scale; varying float vD; void main(){ vec3 p = position + vec3(sin(t * 0.07 + ph) * 2.5, sin(t * 0.3 + ph) * 0.15, cos(t * 0.05 + ph * 1.3) * 2.5); vec4 mv = modelViewMatrix * vec4(p, 1.0); vD = -mv.z; gl_PointSize = size * scale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform float alpha; uniform vec3 col; varying float vD; void main(){ vec4 c = texture2D(map, gl_PointCoord); float a = c.a * alpha * smoothstep(1.5, 6.0, vD) * (1.0 - smoothstep(45.0, 70.0, vD)); if (a < 0.003) discard; gl_FragColor = vec4(col, a); }`,
    });
    this.mist = new THREE.Points(g, m); this.mist.frustumCulled = false; this.mist.visible = false; this.mist.renderOrder = 4; this.scene.add(this.mist);
  }
  // شبح شاحب يظهر لحظات في المقبرة والحارة المهجورة (زينة فقط، لا يؤثر على اللعب)
  buildGhost() {
    const grp = new THREE.Group();
    this.ghostU = { op: { value: 0 }, t: { value: 0 } };
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: this.ghostU, fog: false,
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; uniform float t; void main(){ vec3 p = position; p.x += sin(p.y * 3.0 + t * 2.0) * 0.04 * (1.6 - p.y); vec4 w = modelMatrix * vec4(p, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vY = p.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float op, t; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float fr = pow(1.0 - abs(dot(normalize(vN), vV)), 1.6); float a = (0.18 + fr * 0.8) * op * smoothstep(0.0, 0.7, vY) * (0.85 + 0.15 * sin(t * 13.0)); gl_FragColor = vec4(vec3(0.72, 0.86, 0.95) * a, a); }`,
    });
    const pts = []; for (let i = 0; i <= 12; i++) { const y = i / 12 * 1.75; const r = 0.42 * (1 - i / 12) ** 0.6 + 0.12 + (i > 9 ? -0.05 : 0); pts.push(new THREE.Vector2(r, y)); }
    const robe = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), m); grp.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), m); head.position.y = 1.72; head.scale.set(1, 1.15, 1); grp.add(head);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), m); hood.position.y = 1.74; grp.add(hood);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, fog: false });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeM); e.position.set(s * 0.055, 1.74, 0.145); grp.add(e); }
    this.eyeM = eyeM;
    grp.visible = false; this.ghost = grp; this.scene.add(grp);
    this.ghostState = null;
  }
  pick(id) {
    this.cycle = !id || id === 'random'; // المتغيّر: يبدأ نهار ويمشي بالدورة (شوف schedule)
    if (this.cycle) id = 'dust';
    if (id === 'menu') id = 'sunset';
    return PRESETS[id] ? id : 'sunset';
  }
  // حالة رقمية للطقس (لنمزج بين حالتين تدريجياً داخل المباراة)
  stateOf(id) {
    const P = PRESETS[id], c = h => new THREE.Color(h);
    return { id, P, sunDir: new THREE.Vector3(...P.sunDir).normalize(), sunCol: c(P.sunCol), sunI: P.sunI, hemiSky: c(P.hemiSky), hemiGround: c(P.hemiGround), hemiI: P.hemiI, ambCol: c(P.ambCol), ambI: P.ambI,
      sky: P.sky.map(c), fog: c(P.fog), fogD: P.fogD, exp: P.exp, cloud: P.cloud, cloudCol: c(P.cloudCol), night: P.night, sunVis: P.sunVis, moon: P.moon, rain: P.rain, sand: P.sand || 0, wet: P.wet, lamps: P.lamps, glow: P.glow, mist: P.mist, deep: c(P.deep), grade: P.grade.slice(), bolt: P.bolt, ghosts: P.ghosts, amb: P.amb, mistCol: c(id.startsWith('horror') ? 0x55626f : 0x9aa6b2) };
  }
  mix(A, B, k) {
    const lc = (a, b) => a.clone().lerp(b, k), ln = (a, b) => a + (b - a) * k;
    return { id: k < 0.5 ? A.id : B.id, P: k < 0.5 ? A.P : B.P, sunDir: A.sunDir.clone().lerp(B.sunDir, k).normalize(), sunCol: lc(A.sunCol, B.sunCol), sunI: ln(A.sunI, B.sunI), hemiSky: lc(A.hemiSky, B.hemiSky), hemiGround: lc(A.hemiGround, B.hemiGround), hemiI: ln(A.hemiI, B.hemiI), ambCol: lc(A.ambCol, B.ambCol), ambI: ln(A.ambI, B.ambI),
      sky: A.sky.map((x, i) => lc(x, B.sky[i])), fog: lc(A.fog, B.fog), fogD: ln(A.fogD, B.fogD), exp: ln(A.exp, B.exp), cloud: ln(A.cloud, B.cloud), cloudCol: lc(A.cloudCol, B.cloudCol), night: ln(A.night, B.night), sunVis: ln(A.sunVis, B.sunVis), moon: ln(A.moon, B.moon), rain: ln(A.rain, B.rain), sand: ln(A.sand || 0, B.sand || 0), wet: ln(A.wet, B.wet), lamps: ln(A.lamps, B.lamps), glow: ln(A.glow, B.glow), mist: ln(A.mist, B.mist), deep: lc(A.deep, B.deep), grade: A.grade.map((x, i) => ln(x, B.grade[i])), bolt: k < 0.6 ? A.bolt : B.bolt, ghosts: k < 0.5 ? A.ghosts : B.ghosts, amb: k < 0.5 ? A.amb : B.amb, mistCol: lc(A.mistCol, B.mistCol) };
  }
  apply(S) {
    this.S = S; const L = this.L, sky = this.sky.material.uniforms;
    this.cur = { ...S.P, sunI: S.sunI, hemiI: S.hemiI, ambI: S.ambI, sunCol: S.sunCol.getHex(), hemiSky: S.hemiSky.getHex(), grade: S.grade, bolt: S.bolt, ghosts: S.ghosts, lamps: S.lamps, rain: S.rain };
    this.sunDir.copy(S.sunDir);
    L.sun.color.copy(S.sunCol); L.sun.intensity = S.sunI;
    L.hemi.color.copy(S.hemiSky); L.hemi.groundColor.copy(S.hemiGround); L.hemi.intensity = S.hemiI; this.hemiI = S.hemiI;
    L.amb.color.copy(S.ambCol); L.amb.intensity = S.ambI; this.ambI = S.ambI;
    sky.top.value.copy(S.sky[0]); sky.mid.value.copy(S.sky[1]); sky.bot.value.copy(S.sky[2]); sky.sun.value.copy(this.sunDir);
    sky.night.value = S.night; sky.cloud.value = S.cloud; sky.cloudCol.value.copy(S.cloudCol); sky.sunVis.value = S.sunVis; sky.moon.value = S.moon;
    this.scene.fog.color.copy(S.fog); this.scene.fog.density = S.fogD; this.fogD = S.fogD;
    this.renderer.toneMappingExposure = S.exp;
    const wm = this.meshes.userData.waterMat; if (wm) { const u = wm.uniforms; u.sky.value.copy(S.sky[1]); u.top.value.copy(S.sky[0]); u.deep.value.copy(S.deep); u.sun.value.copy(this.sunDir); u.glint.value = S.sunVis + S.moon * 0.35; u.rain.value = S.rain; }
    const gm = this.meshes.userData.glowMat; if (gm) gm.uniforms.gain.value = S.glow;
    // البلل يتجمّع تدريجياً (update): هنا نحفظ الهدف فقط
    this.wetTarget = S.wet; this.rainNow = S.rain; if (this.wetNow === undefined) this.wetNow = S.wet * 0.3;
    // نفس جزيئات المطر تصير غبار بالعجاج: خيوط ترابية أفقية بطيئة
    const sand = S.rain > 0.02 ? 0 : (S.sand || 0), R = this.rainU;
    this.rain.visible = S.rain > 0.02 || sand > 0.02;
    if (sand > 0.02) { R.alpha.value = 0.6 * sand; R.speed.value = 1.6; R.wind.value.set(11, 4); R.col.value.setHex(0xc9a06a); }
    else { R.alpha.value = 0.5 * S.rain + (S.rain > 0.02 ? 0.12 : 0) * Math.min(1, S.rain * 4); R.speed.value = 15; R.wind.value.set(1.6, 0.6); R.col.value.setHex(0xaebccc); }
    this.splash.visible = S.rain > 0.02; this.splU.alpha.value = S.rain;
    if (this.mist) { this.mist.visible = S.mist > 0.02; this.mistU.alpha.value = 0.2 * S.mist; this.mistU.col.value.copy(S.mistCol); }
    if (this.ambKind !== S.amb) { this.ambKind = S.amb; Audio.setAmbience(S.amb); }
    Audio.setRainLevel && Audio.setRainLevel(S.amb === 'storm' ? 0.3 * Math.min(1, S.rain + 0.1) : S.amb === 'horror' ? 0.22 * S.rain / 0.3 : 0); // صوت المطر أخف
  }
  // الأرض تبتلّ شوي شوي: لمعان وغمقان خفيف، والبرك تبدأ نقاط صغيرة وتتوسّع ببطء
  applyWet(w) {
    if (Math.abs((this.wetApplied ?? -1) - w) < 0.008) return;
    this.wetApplied = w; this.wet = w;
    for (const [m, r0, c0, k] of this.matBase) {
      const floorish = /stone|marble|paving|brick|tile|wood|metal|iron|mud|graveDirt|roof|plaster/.test(k);
      m.roughness = Math.max(0.06, r0 * (1 - (floorish ? 0.62 : 0.35) * w)); m.color.copy(c0).multiplyScalar(1 - 0.22 * w);
      m.envMapIntensity = (m.metalness > 0.3 ? 0.9 : 0.04) + w * (floorish ? 0.5 : 0.22);
    }
    const pm = this.kit.mats.puddle; if (pm) { const p = Math.max(0, w - 0.12) / 0.88; pm.mat.opacity = Math.min(0.8, p * 1.1); if (pm.mat.userData.th) pm.mat.userData.th.value = 0.95 - 0.7 * p; }
  }
  set(want) {
    const id = this.pick(want); this.id = id; this.blend = null; this.plan = null;
    this.ambKind = null; this.apply(this.stateOf(id)); this.wetNow = this.wetTarget * 0.3; this.applyWet(this.wetNow); // بداية المطر: الأرض رطبة شوي بس
    this.ghost.visible = false; this.ghostState = null; this.ghostT = 20 + Math.random() * 25;
    this.boltT = 3 + Math.random() * 6; this.flash = 0;
    this.updateEnv();
  }
  // انتقال تدريجي إلى طقس آخر (مثلاً غروب صافٍ ← عاصفة ممطرة)
  blendTo(id, dur = 25) { if (!PRESETS[id] || !this.S) return; this.blend = { from: this.S, to: this.stateOf(id), t: 0, dur }; this.id = id; }
  // جدول تغيّر الطقس خلال المباراة (نفسه عند كل اللاعبين لأنه مبني على البذرة)
  schedule(seed) {
    // المتغيّر: نهار ← مطر 30 ثانية ← صحو ← إعصار 15 ثانية ← غروب ← ليل ← فجر... ويتكرّر (نفسه عند الكل)
    if (this.cycle) { this.plan = this.cyclePlan(0); return; }
    let a = (seed | 0) || 1; const r = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const base = this.id, plan = [];
    const other = base === 'dust' ? 'day' : base === 'storm' ? (r() < 0.5 ? 'sunset' : 'day') : base === 'horror' ? 'horrorRain' : 'storm';
    let t = 140 + r() * 120; plan.push([t, other]); t += 150 + r() * 120; plan.push([t, base]); t += 150 + r() * 100; plan.push([t, other]);
    this.plan = plan; this.planBase = base;
  }
  cyclePlan(T) {
    // عجاج 40ث ← مطر 35ث ← نهار 3د ← غروب ينزل تدريجياً ← ليل ~3د ← ويعيد (نفسه باللوبي وبالمعارك)
    return [[T + 40, 'rain', 15], [T + 75, 'day', 25], [T + 255, 'sunset', 70], [T + 330, 'night', 110], [T + 520, 'dust', 30], [T + 520, 'again']]; // الليل ينزل تدريجياً (غروب دقيقة وربع، ليل دقيقتين)
  }
  tick(matchT) {
    if (!this.plan) return;
    while (this.plan.length && matchT >= this.plan[0][0]) {
      const [t0, id, dur] = this.plan.shift();
      if (id === 'again') { this.plan = this.cyclePlan(t0); continue; }
      if (id === 'tornado') { this.startTornado(15); continue; }
      if (dur) { this.blendTo(id, dur); continue; }
      if (id === 'horrorRain') { PRESETS.horrorRain = PRESETS.horrorRain || { ...PRESETS.horror, rain: 0.9, wet: 0.9, bolt: 1, fogD: 0.019 }; this.blendTo('horrorRain', 20); }
      else this.blendTo(id, 28);
    }
  }
  // الإعصار: قمع غبار يدور ويعبر الخريطة 15 ثانية بعيد عن اللاعب، وبعدين يختفي
  startTornado(dur) {
    if (!this.tor) {
      const u = this.torU = { t: { value: 0 }, op: { value: 0 }, col: { value: new THREE.Color(0xb48e60) } };
      const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec2 vUv; varying float vY; uniform float t; void main(){ vUv=uv; vec3 p=position; float h=uv.y; p.x+=sin(h*6.0+t*1.7)*1.6*h; p.z+=cos(h*5.0+t*1.3)*1.4*h; vY=h; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
        fragmentShader: 'varying vec2 vUv; varying float vY; uniform float t,op; uniform vec3 col; float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.0),f.x),f.y);} void main(){ vec2 q=vec2(vUv.x*8.0+t*2.6-vUv.y*3.0, vUv.y*6.0-t*1.2); float d=n(q)*0.6+n(q*2.3)*0.4; float a=smoothstep(0.25,0.85,d)*(0.35+0.65*smoothstep(0.0,0.15,vY))*smoothstep(1.0,0.75,vY); gl_FragColor=vec4(col*(0.7+0.5*d),a*op*0.85); }' });
      const g = new THREE.CylinderGeometry(9, 1.2, 38, 32, 24, true); g.translate(0, 19, 0);
      this.tor = new THREE.Mesh(g, m); this.tor.renderOrder = 3; this.scene.add(this.tor);
      const dg = new THREE.CylinderGeometry(4.5, 5.5, 3, 24, 4, true); dg.translate(0, 1.5, 0); this.torDust = new THREE.Mesh(dg, m); this.tor.add(this.torDust);
    }
    const cam = this.camera.position, side = cam.z > 0 ? -1 : 1, z = Math.max(-30, Math.min(26, cam.z + side * (28 + Math.random() * 10)));
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.torS = { t: 0, dur, x0: -dir * 95, x1: dir * 95, z }; this.tor.visible = true; Audio.setAmbience('tornado');
  }
  updateTornado(dt) {
    const S = this.torS; if (!S || !this.tor) return;
    S.t += dt; const k = S.t / S.dur; this.torU.t.value += dt;
    this.tor.position.set(S.x0 + (S.x1 - S.x0) * k, 0, S.z + Math.sin(S.t * 0.7) * 4);
    this.tor.rotation.y += dt * 2.2; this.torU.op.value = Math.min(1, S.t / 2, (S.dur - S.t) / 2);
    this.shakeK = Math.max(0, 1 - Math.hypot(this.tor.position.x - this.camera.position.x, this.tor.position.z - this.camera.position.z) / 60);
    if (k >= 1) { this.tor.visible = false; this.torS = null; this.ambKind = null; this.shakeK = 0; }
  }
  // خريطة بيئة من السماء للانعكاسات (تُحدّث عند تغيّر الطقس)
  updateEnv() {
    if (!this.pmrem) return;
    if (!this.envScene) { this.envScene = new THREE.Scene(); this.envSky = new THREE.Mesh(this.sky.geometry, this.sky.material); this.envScene.add(this.envSky); }
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 1000, { size: this.Q.env || 128 });
    this.scene.environment = this.envRT.texture;
  }
  vmLight() {
    const P = this.cur || PRESETS.sunset;
    return { sun: P.sunI * 0.75, amb: P.hemiI * 1.05 + P.ambI, flash: this.flash, sunCol: P.sunCol, skyCol: P.hemiSky };
  }
  strike(cam) {
    const a = Math.random() * Math.PI * 2, d = 160 + Math.random() * 260;
    const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
    // ومضة مزدوجة أو ثلاثية
    const t = this.t; this.flashSeq = [[t, 1], [t + 0.09, 0.25], [t + 0.16, 0.85]]; if (Math.random() < 0.5) this.flashSeq.push([t + 0.32, 0.6]);
    // خيط البرق في السماء
    const pts = []; let px = x, py = 170 + Math.random() * 40, pz = z; pts.push([px, py, pz]);
    while (py > 2) { py -= 10 + Math.random() * 16; px += (Math.random() - 0.5) * 22; pz += (Math.random() - 0.5) * 22; pts.push([px, Math.max(0, py), pz]); }
    const toCam = new THREE.Vector3(cam.x - x, 0, cam.z - z).normalize(), right = new THREE.Vector3(-toCam.z, 0, toCam.x);
    const strip = (P, w) => { const v = []; for (let i = 0; i < P.length - 1; i++) { const [a1, b1, c1] = P[i], [a2, b2, c2] = P[i + 1], ww = w * (1 - i / P.length * 0.6); v.push(a1 - right.x * ww, b1, c1 - right.z * ww, a1 + right.x * ww, b1, c1 + right.z * ww, a2 + right.x * ww, b2, c2 + right.z * ww, a1 - right.x * ww, b1, c1 - right.z * ww, a2 + right.x * ww, b2, c2 + right.z * ww, a2 - right.x * ww, b2, c2 - right.z * ww); } return v; };
    let verts = strip(pts, 1.6);
    for (let k = 0; k < 3; k++) { const s = 1 + Math.floor(Math.random() * (pts.length - 3)); const br = [pts[s]]; let [bx, by, bz] = pts[s]; for (let j = 0; j < 4; j++) { by -= 8 + Math.random() * 10; bx += (Math.random() - 0.5) * 26; bz += (Math.random() - 0.5) * 26; br.push([bx, by, bz]); } verts = verts.concat(strip(br, 0.8)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const m = new THREE.MeshBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; this.scene.add(mesh); this.bolts.push({ mesh, t0: t });
    Audio.thunder(d);
    if (this.ghostState) this.ghostState.end = Math.min(this.ghostState.end, this.t + 0.12);
    else if (this.cur.ghosts > 0 && Math.random() < 0.35 * this.cur.ghosts) this.spawnGhost(cam, true);
  }
  spawnGhost(cam, lightning) {
    const Z = this.info.haunt || []; if (!Z.length) return false;
    const f = new THREE.Vector3(); this.camera.getWorldDirection(f);
    for (let k = 0; k < 24; k++) {
      const z = Z[Math.floor(Math.random() * Z.length)];
      const x = z[0] + Math.random() * (z[2] - z[0]), y = 0, zz = z[1] + Math.random() * (z[3] - z[1]);
      const dx = x - cam.x, dz = zz - cam.z, d = Math.hypot(dx, dz); if (d < 13 || d > 42) continue;
      if ((dx * f.x + dz * f.z) / d < 0.8) continue;
      if (this.world.overlap(x, 0.05, zz, 0.35, 1.7)) continue;
      if (!this.world.los(cam.x, cam.y, cam.z, x, 1.4, zz)) continue;
      this.ghost.position.set(x, y, zz); this.ghost.rotation.y = Math.atan2(cam.x - x, cam.z - zz);
      this.ghostState = { t0: this.t, end: this.t + (lightning ? 0.5 : 0.9 + Math.random() * 1.2), lightning, drift: (Math.random() - 0.5) * 0.6 };
      this.ghost.visible = true;
      if (!lightning) Audio.play('whisper', [x, 1.6, zz]);
      if (Math.random() < 0.55) Audio.play('stinger');
      return true;
    }
    return false;
  }
  inHaunt(cam, pad = 12) { for (const z of this.info.haunt || []) if (cam.x > z[0] - pad && cam.x < z[2] + pad && cam.z > z[1] - pad && cam.z < z[3] + pad) return true; return false; }
  update(dt, t) {
    this.t = t; this.updateTornado(dt);
    if (this.blend) { const B = this.blend; B.t += dt; const k = Math.min(1, B.t / B.dur), e = k * k * (3 - 2 * k); this.apply(this.mix(B.from, B.to, e)); if (k >= 1) { this.blend = null; this.updateEnv(); } }
    // تجمّع الماء: يرتفع مع المطر (~3 دقائق للبلل الكامل) وينشف أبطأ بعد ما يوقف
    if (this.wetTarget !== undefined) { const tg = this.wetTarget, w = this.wetNow ?? 0; this.wetNow = tg > w ? Math.min(tg, w + dt / 180 * (0.4 + (this.rainNow || 0))) : Math.max(tg, w - dt / 260); this.applyWet(this.wetNow); }
    const P = this.cur; if (!P) return;
    const cam = this.camera.position, L = this.L;
    // صوت المطر مكتوم تحت الأسقف
    if (P.rain > 0.02 && (this.coverT = (this.coverT || 0) - dt) <= 0) { this.coverT = 0.3; const r = this.roof, u = (cam.x - r.rect.x) / r.rect.z, v = (cam.z - r.rect.y) / r.rect.w; let h = 0; if (u > 0 && u < 1 && v > 0 && v < 1) { const im = r.tex.image; h = im.data[Math.floor(v * im.height) * im.width + Math.floor(u * im.width)] / 255 * 32; } Audio.setRainCover(h > cam.y + 0.3 ? 1 : 0); }
    // المطر
    if (this.rain.visible) { this.rainU.t.value = t; this.rainU.cam.value.copy(cam); this.rainU.rgt.value.setFromMatrixColumn(this.camera.matrixWorld, 0); this.splU.t.value = t; this.splU.cam.value.copy(cam); }
    if (this.mist && this.mist.visible) this.mistU.t.value = t;
    // البرق
    if (P.bolt > 0 && (this.boltT -= dt) <= 0) { this.boltT = (6 + Math.random() * 12) / P.bolt; this.strike(cam); }
    let fl = 0; for (const [ts, v] of this.flashSeq) { const k = t - ts; if (k >= 0 && k < 0.18) fl = Math.max(fl, v * (1 - k / 0.18)); }
    if (this.flashSeq.length && t - this.flashSeq[this.flashSeq.length - 1][0] > 0.3) this.flashSeq = [];
    this.flash = fl;
    for (let i = this.bolts.length - 1; i >= 0; i--) { const b = this.bolts[i], k = t - b.t0; b.mesh.material.opacity = k < 0.45 ? (fl > 0.05 ? 1 : 0.15) : 0; if (k > 0.5) { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); this.bolts.splice(i, 1); } }
    L.hemi.intensity = this.hemiI + fl * 2.6; L.amb.intensity = this.ambI + fl * 0.9;
    this.sky.material.uniforms.flash.value = fl;
    const wm = this.meshes.userData.waterMat; if (wm) wm.uniforms.flash.value = fl;
    // الأشباح
    if (P.ghosts > 0) {
      if (this.ghostState) {
        const g = this.ghostState, k = t - g.t0, rem = g.end - t;
        const op = g.lightning ? (fl > 0.05 ? 0.9 : 0) : Math.min(1, k / 0.35) * Math.min(1, Math.max(0, rem) / 0.45);
        this.ghostU.op.value = op; this.ghostU.t.value = t; this.eyeM.opacity = op * 0.9;
        this.ghost.position.y = Math.sin(t * 1.3) * 0.05 + 0.04; this.ghost.translateZ(g.drift * dt);
        if (rem <= 0) { this.ghost.visible = false; this.ghostState = null; }
      } else if ((this.ghostT -= dt) <= 0) {
        this.ghostT = (28 + Math.random() * 45) / P.ghosts;
        if (this.inHaunt(cam) && Math.random() < 0.85) this.spawnGhost(cam, false);
      }
    }
    // الأضواء القريبة والوميض
    const glm = this.meshes.userData.glowMat; if (glm) glm.uniforms.t.value = t;
    if (this.meshes.userData.updateLights) this.meshes.userData.updateLights(cam.x, cam.y, cam.z, t, dt, P.lamps);
    if (this.meshes.userData.setLampGlow && this.lampK !== P.lamps) { this.lampK = P.lamps; this.meshes.userData.setLampGlow(P.lamps); }
    // الظل يتبع الكاميرا (مع تثبيت على شبكة بكسلات الظل لمنع الارتعاش)
    const s = L.sun;
    if (s.castShadow) {
      const f = new THREE.Vector3(); this.camera.getWorldDirection(f);
      const cx = cam.x + f.x * this.shExt * 0.35, cz = cam.z + f.z * this.shExt * 0.35;
      const d = this.sunDir, up = Math.abs(d.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const u = new THREE.Vector3().crossVectors(up, d).normalize(), v = new THREE.Vector3().crossVectors(d, u);
      const tx = 2 * this.shExt / s.shadow.mapSize.x, c = new THREE.Vector3(cx, 0, cz);
      const cu = Math.round(c.dot(u) / tx) * tx, cv = Math.round(c.dot(v) / tx) * tx, cw = c.dot(d);
      c.copy(u).multiplyScalar(cu).addScaledVector(v, cv).addScaledVector(d, cw);
      s.target.position.copy(c); s.position.copy(c).addScaledVector(d, 160); s.target.updateMatrixWorld();
    } else { s.position.copy(this.sunDir).multiplyScalar(160); s.target.position.set(0, 0, 0); s.target.updateMatrixWorld(); }
  }
  get grade() { return (this.cur || PRESETS.sunset).grade; }
}
