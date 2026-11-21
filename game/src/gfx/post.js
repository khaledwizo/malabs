// معالجة لاحقة خفيفة (للجودة العالية): توهّج (Bloom) للفوانيس والوميض والبرق + تدرّج لوني وتظليل الأطراف
// المشهد يُرسم في هدف HDR ثم يُدمج مع طبقات التوهّج ويُطبّق عليه تحويل الألوان النهائي
import * as THREE from 'three';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Post {
  constructor(renderer, Q) {
    this.r = renderer; this.enabled = false; this.grade = [1, 1, 1, 1]; this.strength = 0.65;
    if (!Q.bloom) return;
    const ext = renderer.extensions;
    if (!(ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float'))) return;
    const hf = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true, samples: Q.aa ? 4 : 0 });
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
    const s = this.r.getDrawingBufferSize(this.v2); this.rt.setSize(s.x, s.y);
    let w = s.x, h = s.y; for (const [a, b] of this.lv) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); a.setSize(w, h); b.setSize(w, h); }
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  render(scene, camera, vm) {
    const r = this.r;
    if (this.rt.width < 8) this.resize();
    r.setRenderTarget(this.rt); r.autoClear = true; r.render(scene, camera);
    if (vm) { r.autoClear = false; r.clearDepth(); r.render(vm.scene, vm.cam); r.autoClear = true; }
    // سطوع ← أربع مستويات مموّهة
    this.mBright.uniforms.src.value = this.rt.texture; this.mBright.uniforms.px.value.set(0.5 / this.rt.width, 0.5 / this.rt.height);
    this.pass(this.mBright, this.lv[0][0]);
    for (let i = 0; i < this.lv.length; i++) {
      const [a, b] = this.lv[i];
      if (i > 0) { this.mCopy.uniforms.src.value = this.lv[i - 1][0].texture; this.pass(this.mCopy, a); }
      this.mBlur.uniforms.src.value = a.texture; this.mBlur.uniforms.dir.value.set(1 / a.width, 0); this.pass(this.mBlur, b);
      this.mBlur.uniforms.src.value = b.texture; this.mBlur.uniforms.dir.value.set(0, 1 / a.height); this.pass(this.mBlur, a);
    }
    const u = this.mOut.uniforms;
    u.scene.value = this.rt.texture; u.b0.value = this.lv[0][0].texture; u.b1.value = this.lv[1][0].texture; u.b2.value = this.lv[2][0].texture; u.b3.value = this.lv[3][0].texture;
    u.str.value = this.strength; u.grade.value.set(...this.grade);
    this.pass(this.mOut, null);
  }
}
