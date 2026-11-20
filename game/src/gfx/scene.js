// المشهد: سماء الغروب، الشمس والظلال، الماء، توهّج الفوانيس، ولافتات الخط العربي
import * as THREE from 'three';
import { Batch, boxInto } from './geo.js';
import { makeMaterials, signMat } from './mats.js';

export function gfxKit(Q) {
  const mats = makeMaterials(Q);
  return { THREE, mats, Batch, boxInto, Q };
}

// قبة سماء بتدرّج لوني وقرص شمس وغيوم خفيفة
export function makeSky(info, sunDir) {
  const g = new THREE.SphereGeometry(900, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(info.sky.top) }, mid: { value: new THREE.Color(info.sky.mid) }, bot: { value: new THREE.Color(info.sky.bottom) }, sun: { value: new THREE.Vector3(...sunDir).normalize() }, t: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top, mid, bot, sun; uniform float t; varying vec3 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float y = vP.y;
        vec3 c = y > 0.0 ? mix(mid, top, pow(clamp(y*1.6,0.,1.), 0.7)) : mix(mid, bot, clamp(-y*4.0,0.,1.));
        float sd = max(dot(vP, sun), 0.0);
        c += vec3(1.0,0.75,0.45) * pow(sd, 12.0) * 0.55 + vec3(1.0,0.9,0.7) * pow(sd, 900.0) * 6.0;
        // غيوم ناعمة
        if (y > 0.02) { vec2 uv = vP.xz / (y + 0.25) * 2.0 + vec2(t*0.004, 0.); float cl = n(uv) * 0.6 + n(uv*2.3)*0.3 + n(uv*5.1)*0.1; cl = smoothstep(0.55, 0.85, cl) * smoothstep(0.02, 0.3, y);
          vec3 ccol = mix(vec3(1.0,0.72,0.55), vec3(0.95,0.6,0.55), y) + vec3(1.0,0.6,0.3)*pow(sd,4.0)*0.6; c = mix(c, ccol, cl*0.55); }
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
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, sky: { value: new THREE.Color(info.sky.mid) }, top: { value: new THREE.Color(info.sky.top) }, deep: { value: new THREE.Color(0x16302e) }, sun: { value: new THREE.Vector3(...info.sun.dir).normalize() } }]),
    vertexShader: `varying vec3 vW; varying vec3 vN; uniform float t;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float t; uniform vec3 sky, top, deep, sun; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vW.xz;
        float w1 = sin(p.x*1.3 + t*1.1) * cos(p.y*1.1 - t*0.8), w2 = sin(p.x*3.1 - t*1.7 + p.y*2.3) * 0.5, w3 = sin(p.y*5.7 + t*2.3) * 0.25;
        vec3 n = normalize(vec3((w1 + w2) * 0.08, 1.0, (w2 + w3) * 0.08));
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 r = reflect(-v, n);
        vec3 refl = mix(sky, top, clamp(r.y * 2.2, 0.0, 1.0));
        vec3 c = mix(deep, refl, 0.12 + fr * 0.7);
        float gl = pow(max(dot(r, sun), 0.0), 60.0);
        c += vec3(1.0,0.78,0.45) * (gl * 2.2 + pow(max(dot(r, sun), 0.0), 8.0) * 0.25);
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
  for (const [mat, bt] of B.batches) {
    if (!bt.count) continue;
    const m = kit.mats[mat]; if (!m) { console.warn('no mat', mat); continue; }
    const mesh = new THREE.Mesh(bt.build(), m.mat);
    mesh.castShadow = Q.shadow > 0 && mat !== 'glow' && mat !== 'glass';
    mesh.receiveShadow = Q.shadow > 0;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    group.add(mesh);
  }
  // الماء
  const wm = waterMaterial(info), waters = [];
  for (const w of B.water) {
    const g = w.round ? new THREE.CircleGeometry(w.r, 20) : new THREE.PlaneGeometry(w.w, w.d, 1, 1);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, wm); mesh.position.set(w.x, w.y, w.z); mesh.receiveShadow = false; group.add(mesh); waters.push(mesh);
  }
  // اللافتات
  for (const s of (B.signs || [])) {
    const g = new THREE.PlaneGeometry(s.w, s.w / 4);
    const mesh = new THREE.Mesh(g, signMat(s.text)); mesh.position.set(s.x, s.y, s.z); mesh.rotation.y = s.ry; mesh.receiveShadow = Q.shadow > 0; group.add(mesh);
  }
  // توهّج الفوانيس
  if (B.glows.length) {
    const pos = new Float32Array(B.glows.length * 3), sizes = new Float32Array(B.glows.length);
    B.glows.forEach((g, i) => { pos[i * 3] = g.x; pos[i * 3 + 1] = g.y; pos[i * 3 + 2] = g.z; sizes[i] = g.size; });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { map: { value: glowTexture() }, scale: { value: 600 } },
      vertexShader: `attribute float size; uniform float scale; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb * 1.2, c.a * 0.85); }`,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; group.add(pts); group.userData.glowMat = mat;
  }
  // أضواء نقطية حقيقية (محدودة العدد حسب الجودة)
  const maxL = [0, 3, 6, 10][Q.details] || 0;
  const lights = B.lights.slice().sort((a, b) => b.intensity - a.intensity).slice(0, maxL);
  for (const l of lights) { const pl = new THREE.PointLight(l.color, l.intensity, l.dist, 1.6); pl.position.set(l.x, l.y, l.z); group.add(pl); }
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
