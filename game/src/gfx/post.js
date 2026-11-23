// معالجة لاحقة خفيفة (للجودة العالية): توهّج (Bloom) للفوانيس والوميض والبرق + تدرّج لوني وتظليل الأطراف
// المشهد يُرسم في هدف HDR ثم يُدمج مع طبقات التوهّج ويُطبّق عليه تحويل الألوان النهائي
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Post {
  // fx: حزمة «الرسوميات المتقدّمة» (انعكاسات الشاشة، ظلال التلاصق، أشعة الشمس، تدرّج سينمائي) — مطفأة افتراضياً
  constructor(renderer, Q, fx) {
    this.r = renderer; this.enabled = false; this.grade = [1, 1, 1, 1]; this.strength = 0.65; this.fx = fx || null; this.wet = 0; this.rayK = 1; this.sunDir = null;
    if (!Q.bloom && !fx) return;
    const ext = renderer.extensions;
    if (!(ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float'))) return;
    const hf = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, samples: Q.aa && !fx ? 4 : 0 });
    if (fx) {
      this.rt.depthTexture = new THREE.DepthTexture(4, 4); this.rt.depthTexture.type = THREE.UnsignedIntType;
      this.rt2 = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
      this.mFx = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, depthWrite: false,
        uniforms: { scene: { value: null }, dep: { value: null }, invProj: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, camRot: { value: new THREE.Matrix3() }, res: { value: new THREE.Vector2() }, sun: { value: new THREE.Vector3() }, wet: { value: 0 }, rayK: { value: 1 }, on: { value: new THREE.Vector4(1, 1, 1, 1) }, seed: { value: 0 } },
        fragmentShader: `uniform sampler2D scene, dep; uniform mat4 invProj, proj; uniform mat3 camRot; uniform vec2 res; uniform vec3 sun; uniform float wet, rayK, seed; uniform vec4 on; varying vec2 vUv;
          vec3 vpos(vec2 uv){ float d = texture2D(dep, uv).x; vec4 c = invProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return c.xyz / c.w; }
          float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
          void main(){
            vec3 col = texture2D(scene, vUv).rgb; float d = texture2D(dep, vUv).x;
            if (d < 0.99999) {
              vec3 P = vpos(vUv); vec3 N = normalize(cross(dFdx(P), dFdy(P))); if (dot(N, P) > 0.0) N = -N;
              vec3 Nw = camRot * N;
              if (on.x > 0.5) {
                float ao = 0.0, rad = clamp(0.55 / max(0.5, -P.z), 0.003, 0.07), h = hash(vUv * res);
                for (int i = 0; i < 10; i++) { float a = float(i) * 2.39996 + h * 6.283, r = rad * (float(i) + 1.0) / 10.0; vec2 o = vec2(cos(a), sin(a)) * r * vec2(res.y / res.x, 1.0); vec3 v = vpos(vUv + o) - P; float L = length(v); ao += max(0.0, dot(N, v / max(L, 1e-4)) - 0.08) / (1.0 + L * L * 1.5); }
                col *= clamp(1.0 - ao / 10.0 * 1.7, 0.35, 1.0);
              }
              if (on.y > 0.5 && Nw.y > 0.75) {
                vec3 V = normalize(P), R = normalize(reflect(V, N)); float fres = pow(1.0 - max(dot(-V, N), 0.0), 4.0), k = (0.06 + wet * 0.5) * (0.3 + 0.7 * fres);
                vec3 Q = P; float st = 0.25 + (-P.z) * 0.02; vec3 hit = vec3(-1.0);
                for (int i = 0; i < 24; i++) { Q += R * st; st *= 1.12; vec4 c = proj * vec4(Q, 1.0); vec2 u = c.xy / c.w * 0.5 + 0.5; if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0 || c.w < 0.0) break; float sz = vpos(u).z; if (sz > Q.z && sz - Q.z < st * 2.5 + 0.3) { hit = vec3(u, 1.0); break; } }
                if (hit.z > 0.0) { vec2 e = smoothstep(0.0, 0.12, hit.xy) * smoothstep(1.0, 0.88, hit.xy); col = mix(col, texture2D(scene, hit.xy).rgb, k * e.x * e.y); }
              }
            }
            if (on.z > 0.5 && sun.z > 0.0 && rayK > 0.01) {
              vec2 dl = (sun.xy - vUv) / 22.0; vec2 u = vUv + dl * hash(vUv * res); float w = 1.0, acc = 0.0;
              for (int i = 0; i < 22; i++) { u += dl; if (texture2D(dep, u).x >= 0.99999) { vec3 s = texture2D(scene, u).rgb; acc += w * min(dot(s, vec3(0.3, 0.59, 0.11)), 3.0); } w *= 0.94; }
              float fall = 1.0 - smoothstep(0.0, 0.9, length((vUv - sun.xy) * vec2(res.x / res.y, 1.0)));
              col += vec3(1.0, 0.86, 0.62) * acc / 22.0 * 0.55 * rayK * sun.z * fall;
            }
            if (on.w > 0.5) { float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, 1.12); col = mix(col * vec3(0.94, 0.98, 1.06), col * vec3(1.04, 1.0, 0.94), smoothstep(0.05, 0.6, l)); col = pow(max(col, 0.0), vec3(1.05)); }
            gl_FragColor = vec4(col, 1.0);
          }
` });
    }
    this.lv = [0, 1, 2, 3].map(() => [new THREE.WebGLRenderTarget(4, 4, hf), new THREE.WebGLRenderTarget(4, 4, hf)]);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    this.mBright = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, depthWrite: false, uniforms: { src: { value: null }, th: { value: 1.0 }, px: { value: new THREE.Vector2() } },
      fragmentShader: `uniform sampler2D src; uniform float th; uniform vec2 px; varying vec2 vUv;
        void main(){ vec3 c = (texture2D(src, vUv + px * vec2(-1.0,-1.0)).rgb + texture2D(src, vUv + px * vec2(1.0,-1.0)).rgb + texture2D(src, vUv + px * vec2(-1.0,1.0)).rgb + texture2D(src, vUv + px * vec2(1.0,1.0)).rgb) * 0.25;
          float l = max(c.r, max(c.g, c.b)); float k = max(0.0, l - th) / max(l, 1e-4); gl_FragColor = vec4(min(c * k, vec3(24.0)), 1.0); }` });
    this.mBlur = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, depthWrite: false, uniforms: { src: { value: null }, dir: { value: new THREE.Vector2() } },
      fragmentShader: `uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
        void main(){ vec3 c = texture2D(src, vUv).rgb * 0.2270; c += (texture2D(src, vUv + dir * 1.3846).rgb + texture2D(src, vUv - dir * 1.3846).rgb) * 0.3162; c += (texture2D(src, vUv + dir * 3.2308).rgb + texture2D(src, vUv - dir * 3.2308).rgb) * 0.0703; gl_FragColor = vec4(c, 1.0); }` });
    this.mCopy = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, depthWrite: false, uniforms: { src: { value: null } }, fragmentShader: `uniform sampler2D src; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(src, vUv).rgb, 1.0); }` });
    this.mOut = new THREE.ShaderMaterial({ vertexShader: VS, depthTest: false, depthWrite: false, toneMapped: true,
      uniforms: { scene: { value: null }, b0: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null }, str: { value: 0.65 }, grade: { value: new THREE.Vector4(1, 1, 1, 1) }, vig: { value: 0.28 } },
      fragmentShader: `uniform sampler2D scene, b0, b1, b2, b3; uniform float str, vig; uniform vec4 grade; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(scene, vUv).rgb;
          vec3 b = texture2D(b0, vUv).rgb * 0.45 + texture2D(b1, vUv).rgb * 0.3 + texture2D(b2, vUv).rgb * 0.2 + texture2D(b3, vUv).rgb * 0.15;
          c += b * str;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, grade.w) * grade.rgb;
          vec2 q = vUv - 0.5; c *= 1.0 - vig * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    this.enabled = true; this.v2 = new THREE.Vector2();
  }
  resize() {
    if (!this.enabled) return;
    const s = this.r.getDrawingBufferSize(this.v2); this.rt.setSize(s.x, s.y); if (this.rt2) this.rt2.setSize(s.x, s.y);
    let w = s.x, h = s.y; for (const [a, b] of this.lv) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); a.setSize(w, h); b.setSize(w, h); }
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  render(scene, camera, vm) {
    const r = this.r;
    if (this.rt.width < 8) this.resize();
    r.setRenderTarget(this.rt); r.autoClear = true; r.render(scene, camera);
    let src = this.rt;
    if (this.mFx) {
      const u = this.mFx.uniforms, F = this.fx;
      u.scene.value = this.rt.texture; u.dep.value = this.rt.depthTexture; u.proj.value.copy(camera.projectionMatrix); u.invProj.value.copy(camera.projectionMatrixInverse); u.camRot.value.setFromMatrix4(camera.matrixWorld);
      u.res.value.set(this.rt.width, this.rt.height); u.wet.value = this.wet; u.rayK.value = this.rayK; u.seed.value = (u.seed.value + 0.618) % 7;
      u.on.value.set(F.ao ? 1 : 0, F.ssr ? 1 : 0, F.rays ? 1 : 0, F.grade ? 1 : 0);
      u.sun.value.set(0, 0, 0);
      if (this.sunDir) { const sp = this._sp || (this._sp = new THREE.Vector3()), fw = this._fw || (this._fw = new THREE.Vector3()); camera.getWorldDirection(fw); const facing = fw.dot(this.sunDir); if (facing > 0.05) { sp.copy(camera.position).addScaledVector(this.sunDir, 800).project(camera); u.sun.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5, Math.min(1, facing * 1.6)); } }
      this.pass(this.mFx, this.rt2); src = this.rt2;
    }
    if (vm) { r.setRenderTarget(src); r.autoClear = false; r.clearDepth(); r.render(vm.scene, vm.cam); r.autoClear = true; }
    // سطوع ← أربع مستويات مموّهة
    this.mBright.uniforms.src.value = src.texture; this.mBright.uniforms.px.value.set(0.5 / src.width, 0.5 / src.height);
    this.pass(this.mBright, this.lv[0][0]);
    for (let i = 0; i < this.lv.length; i++) {
      const [a, b] = this.lv[i];
      if (i > 0) { this.mCopy.uniforms.src.value = this.lv[i - 1][0].texture; this.pass(this.mCopy, a); }
      this.mBlur.uniforms.src.value = a.texture; this.mBlur.uniforms.dir.value.set(1 / a.width, 0); this.pass(this.mBlur, b);
      this.mBlur.uniforms.src.value = b.texture; this.mBlur.uniforms.dir.value.set(0, 1 / a.height); this.pass(this.mBlur, a);
    }
    const u = this.mOut.uniforms;
    u.scene.value = src.texture; u.b0.value = this.lv[0][0].texture; u.b1.value = this.lv[1][0].texture; u.b2.value = this.lv[2][0].texture; u.b3.value = this.lv[3][0].texture;
    u.str.value = this.strength; u.grade.value.set(...this.grade);
    this.pass(this.mOut, null);
  }
}
