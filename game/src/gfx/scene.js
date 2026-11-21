// المشهد: سماء الغروب، الشمس والظلال، الماء، توهّج الفوانيس، ولافتات الخط العربي
import * as THREE from 'three';
import { modelParts, emissiveMats } from './models.js';
import { Batch, boxInto } from './geo.js';
import { makeMaterials, signMat } from './mats.js';

export function gfxKit(Q) {
  const mats = makeMaterials(Q);
  return { THREE, mats, Batch, boxInto, Q };
}

// قبة سماء بتدرّج لوني وقرص شمس/قمر وغيوم ونجوم وومضات برق
export function makeSky(info, sunDir) {
  const g = new THREE.SphereGeometry(900, 32, 16);
  const C = c => new THREE.Color(c);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: C(info.sky.top) }, mid: { value: C(info.sky.mid) }, bot: { value: C(info.sky.bottom) }, sun: { value: new THREE.Vector3(...sunDir).normalize() }, t: { value: 0 },
      night: { value: 0 }, flash: { value: 0 }, cloud: { value: 0.45 }, cloudCol: { value: C(0xffb894) }, sunVis: { value: 1 }, moon: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top, mid, bot, sun, cloudCol; uniform float t, night, flash, cloud, sunVis, moon; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float y = vP.y;
        vec3 c = y > 0.0 ? mix(mid, top, pow(clamp(y*1.6,0.,1.), 0.7)) : mix(mid, bot, clamp(-y*4.0,0.,1.));
        float sd = max(dot(vP, sun), 0.0);
        c += (vec3(1.0,0.75,0.45) * pow(sd, 12.0) * 0.55 + vec3(1.0,0.9,0.7) * pow(sd, 900.0) * 6.0) * sunVis;
        // القمر وهالته
        c += moon * (vec3(0.85,0.9,1.0) * smoothstep(0.9993, 0.99955, sd) * 2.2 + vec3(0.25,0.3,0.42) * pow(sd, 60.0) * 0.6);
        float cl = 0.0;
        if (y > 0.02) {
          vec2 uv = vP.xz / (y + 0.25) * 2.0 + vec2(t*0.004 + flash*0.0, t*0.0015);
          cl = n(uv) * 0.6 + n(uv*2.3)*0.3 + n(uv*5.1)*0.1;
          cl = smoothstep(0.62 - cloud * 0.5, 0.9 - cloud * 0.25, cl) * smoothstep(0.02, 0.3, y);
          vec3 cc = cloudCol * (0.8 + 0.4 * n(uv * 3.7)) + vec3(1.0,0.6,0.3)*pow(sd,4.0)*0.5*sunVis;
          c = mix(c, cc, cl * (0.5 + cloud * 0.45));
        }
        // نجوم الليل
        if (night > 0.01 && y > 0.04) { vec2 sp = vP.xz / (y + 0.3) * 70.0; vec2 ip = floor(sp); float hh = h(ip); float st = step(0.982, hh) * smoothstep(0.45, 0.0, length(fract(sp) - 0.5)); c += vec3(0.85,0.9,1.0) * st * night * (0.55 + 0.45*sin(t*2.3 + hh*60.0)) * (1.0 - cl) * smoothstep(0.04, 0.3, y); }
        c += flash * (vec3(0.55,0.6,0.75) * (0.35 + cl * 1.6));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = -10;
  return mesh;
}

// ماء متموّج بسيط (يعكس لون السماء ويتحرك)
function waterMaterial(info) {
  return new THREE.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, sky: { value: new THREE.Color(info.sky.mid) }, top: { value: new THREE.Color(info.sky.top) }, deep: { value: new THREE.Color(0x16302e) }, sun: { value: new THREE.Vector3(...info.sun.dir).normalize() }, glint: { value: 1 }, rain: { value: 0 }, flash: { value: 0 } }]),
    vertexShader: `varying vec3 vW; varying vec3 vN; uniform float t;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float t, glint, rain, flash; uniform vec3 sky, top, deep, sun; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vW.xz;
        float w1 = sin(p.x*1.3 + t*1.1) * cos(p.y*1.1 - t*0.8), w2 = sin(p.x*3.1 - t*1.7 + p.y*2.3) * 0.5, w3 = sin(p.y*5.7 + t*2.3) * 0.25;
        float rr = rain * (sin(length(fract(p * 0.7) - 0.5) * 60.0 - t * 14.0) * 0.5 + sin(p.x * 9.1 + p.y * 7.3 + t * 9.0) * 0.5);
        vec3 n = normalize(vec3((w1 + w2) * 0.08 + rr * 0.05, 1.0, (w2 + w3) * 0.08 + rr * 0.05));
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 r = reflect(-v, n);
        vec3 refl = mix(sky, top, clamp(r.y * 2.2, 0.0, 1.0));
        vec3 c = mix(deep, refl, 0.12 + fr * 0.7);
        float gl = pow(max(dot(r, sun), 0.0), 60.0);
        c += vec3(1.0,0.78,0.45) * (gl * 2.2 + pow(max(dot(r, sun), 0.0), 8.0) * 0.25) * glint + flash * fr * vec3(0.6,0.65,0.8);
        gl_FragColor = vec4(c, 0.92);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// توهّج ناعم (sprite) للفوانيس
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,220,160,1)'); g.addColorStop(0.25, 'rgba(255,170,80,0.5)'); g.addColorStop(1, 'rgba(255,140,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace; return glowTex;
}

// يحوّل نتائج الباني إلى شبكات three
export function buildWorldMeshes(B, kit, info) {
  const group = new THREE.Group(), Q = kit.Q;
  const props = new Map(); // id → [[mesh, s, e]]
  for (const [key, bt] of B.batches) {
    if (!bt.count) continue;
    const mat = key.split('#')[0];
    const m = kit.mats[mat]; if (!m) { console.warn('no mat', mat); continue; }
    const mesh = new THREE.Mesh(bt.build(), m.mat);
    mesh.castShadow = Q.shadow > 0 && mat !== 'glow' && mat !== 'glass';
    mesh.receiveShadow = Q.shadow > 0;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    group.add(mesh);
    for (const [id, s0, e0] of (B.dyn.get(key) || [])) { let L = props.get(id); if (!L) { L = []; props.set(id, L); } L.push([mesh, s0, e0]); }
  }
  // إخفاء/إعادة جسم متحطّم: نطوي رؤوسه داخل الأرض ونحفظ الأصل لإعادته
  const saved = new Map();
  group.userData.setProp = (id, on) => {
    for (const [mesh, s0, e0] of (props.get(id) || [])) {
      const P = mesh.geometry.attributes.position, A = P.array, k = id + ':' + mesh.id;
      if (!on) { if (saved.has(k)) continue; saved.set(k, A.slice(s0 * 3, e0 * 3)); for (let i = s0; i < e0; i++) { A[i * 3 + 1] = -60; } }
      else { const S = saved.get(k); if (!S) continue; A.set(S, s0 * 3); saved.delete(k); }
      P.addUpdateRange(s0 * 3, (e0 - s0) * 3); P.needsUpdate = true;
    }
  };
  // النماذج المرخّصة المكرّرة (فوانيس خشبية، أسماك...) كـ InstancedMesh
  const dummy = new THREE.Object3D();
  for (const [proto, L] of B.inst) {
    for (const { geo, mat } of modelParts(proto, kit.Q.aniso || 4)) {
      const im = new THREE.InstancedMesh(geo, mat, L.length);
      L.forEach(([x, y, z, ry, s, sy], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(s, sy, s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      im.castShadow = Q.shadow > 0; im.receiveShadow = Q.shadow > 0; im.computeBoundingSphere(); group.add(im);
    }
  }
  // توهّج زجاج الفوانيس يتبع شدّة إنارة الشوارع (خافت نهاراً، ساطع ليلاً)
  group.userData.setLampGlow = k => { for (const m of emissiveMats) m.emissiveIntensity = 0.25 + Math.min(2.2, k) * 0.9; };
  // الماء
  const wm = waterMaterial(info), waters = [];
  for (const w of B.water) {
    const g = w.round ? new THREE.CircleGeometry(w.r, 20) : new THREE.PlaneGeometry(w.w, w.d, 1, 1);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, wm); mesh.position.set(w.x, w.y, w.z); mesh.receiveShadow = false; group.add(mesh); waters.push(mesh);
  }
  // اللافتات
  for (const s of (B.signs || [])) {
    const g = new THREE.PlaneGeometry(s.w, s.h || s.w / 4);
    const mesh = new THREE.Mesh(g, signMat(s.text, s.opt || {})); mesh.position.set(s.x, s.y, s.z); mesh.rotation.order = 'YXZ'; mesh.rotation.y = s.ry; if (s.rx) mesh.rotation.x = s.rx; mesh.receiveShadow = Q.shadow > 0; group.add(mesh);
  }
  // توهّج الفوانيس
  if (B.glows.length) {
    const pos = new Float32Array(B.glows.length * 3), sizes = new Float32Array(B.glows.length), fl = new Float32Array(B.glows.length);
    B.glows.forEach((g, i) => { pos[i * 3] = g.x; pos[i * 3 + 1] = g.y; pos[i * 3 + 2] = g.z; sizes[i] = g.size; fl[i] = g.fl || 0; });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1)); geo.setAttribute('fl', new THREE.BufferAttribute(fl, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { map: { value: glowTexture() }, scale: { value: 600 }, gain: { value: 1 }, t: { value: 0 } },
      vertexShader: `attribute float size; attribute float fl; uniform float scale, t; varying float vF; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
        float k = position.x * 3.7 + position.z * 1.3; float f = 0.78 + 0.22 * (sin(t * 23.0 + k) * 0.5 + sin(t * 7.3 + k * 2.0) * 0.3 + sin(t * 51.0 + k) * 0.2); if (sin(t * 1.7 + k * 5.0) > 0.93) f *= 0.15;
        vF = mix(1.0, f, fl); gl_PointSize = size * scale / -mv.z * (0.7 + 0.3 * vF); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform float gain; varying float vF; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb * 1.2 * gain * vF, c.a * 0.85); }`,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; group.add(pts); group.userData.glowMat = mat;
  }
  // أضواء نقطية حقيقية (محدودة العدد حسب الجودة)
  // مجمّع أضواء نقطية حقيقية: تُسند لأقرب الفوانيس إلى الكاميرا (عدد ثابت حسب الجودة لتفادي إعادة ترجمة الظلال)
  const maxL = [0, 4, 6, 10][Q.details] || 0, pool = [], all = B.lights;
  for (let i = 0; i < maxL; i++) { const pl = new THREE.PointLight(0xffb060, 0, 8, 1.6); pl.userData.idx = -1; group.add(pl); pool.push(pl); }
  const flick = (t, i) => { let f = 0.74 + 0.26 * (Math.sin(t * 23 + i * 7.1) * 0.5 + Math.sin(t * 7.3 + i * 3.7) * 0.3 + Math.sin(t * 51 + i) * 0.2); if (Math.sin(t * 1.7 + i * 5) > 0.93) f *= 0.12; return f; };
  let pickT = 0; const d2 = new Float32Array(all.length);
  group.userData.updateLights = (cx, cy, cz, t, dt, mul) => {
    if (!maxL) return;
    if ((pickT -= dt) <= 0) {
      pickT = 0.25;
      for (let i = 0; i < all.length; i++) { const l = all[i]; d2[i] = ((l.x - cx) ** 2 + (l.y - cy) ** 2 + (l.z - cz) ** 2) / (l.intensity * l.intensity + 0.5); }
      const order = [...all.keys()].sort((a, b) => d2[a] - d2[b]).slice(0, maxL), want = new Set(order);
      const free = pool.filter(p => !want.has(p.userData.idx));
      for (const i of order) { if (pool.some(p => p.userData.idx === i)) continue; const p = free.shift(); if (!p) break; const l = all[i]; p.userData.idx = i; p.position.set(l.x, l.y, l.z); p.color.setHex(l.color); p.distance = l.dist * (mul > 1.2 ? 1.25 : 1); p.userData.fade = 0; }
    }
    for (const p of pool) { const i = p.userData.idx; if (i < 0) { p.intensity = 0; continue; } const l = all[i]; p.userData.fade = Math.min(1, (p.userData.fade ?? 1) + dt * 3); p.intensity = l.intensity * mul * p.userData.fade * (l.fl ? flick(t, i) : 1); }
  };
  group.userData.waters = waters; group.userData.waterMat = wm;
  return group;
}

export function setupLights(scene, info, Q, bounds) {
  const sunDir = new THREE.Vector3(...info.sun.dir).normalize();
  const hemi = new THREE.HemisphereLight(info.sky.top, 0x8a6a4a, 0.9); scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffe2c4, 0.25); scene.add(amb);
  const sun = new THREE.DirectionalLight(info.sun.color, info.sun.intensity);
  const cx = (bounds[0] + bounds[2]) / 2, cz = (bounds[1] + bounds[3]) / 2, ext = Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) * 0.62;
  sun.position.set(cx + sunDir.x * 120, sunDir.y * 120, cz + sunDir.z * 120); sun.target.position.set(cx, 0, cz);
  scene.add(sun); scene.add(sun.target);
  if (Q.shadow > 0) {
    sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    const c = sun.shadow.camera; c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 10; c.far = 300;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035; sun.shadow.radius = 2;
  }
  return { sun, hemi, amb, sunDir };
}
