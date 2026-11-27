// محمّل الموارد (القسم 1): glb مضغوط (meshopt) بتكستشرات ktx2/webp من مجلد الموارد داخل APK
// بالتطبيق: https://res.rafidain/<ملف> (يخدمها MainActivity من assets/res) — بالمتصفح: res/<ملف> بجنب الصفحة
// الفهرس window.__RES يجي من res/manifest.js (يكتبه tools/assets.mjs بالـCI)
import { GLTFLoader } from '../../vendor/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from '../../vendor/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from '../../vendor/jsm/libs/meshopt_decoder.module.js';

export const RES_BASE = window.RafidainAndroid ? 'https://res.rafidain/' : 'res/';
let gltf = null; const cache = new Map();
export const Assets = {
  get index() { return window.__RES || {}; },
  has(id) { return !!this.index[id]; },
  // يحمّل فهرس الموارد (res/manifest.js) بوسم script — يشتغل حتى من file://
  ready() {
    if (this._r) return this._r;
    return this._r = new Promise(res => { if (window.__RES) return res(true); const s = document.createElement('script'); s.src = 'res/manifest.js'; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
  },
  init(renderer) {
    if (gltf) return; gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
    try { const k = new KTX2Loader().setTranscoderPath(RES_BASE + 'basis/').detectSupport(renderer); gltf.setKTX2Loader(k); } catch (e) { console.warn('ktx2', e); }
  },
  // يرجّع مشهد glb (نسخة لكل استعمال)؛ يرمي خطأ إذا المورد ما موجود
  async model(id) {
    const e = this.index[id]; if (!e) throw new Error('no asset ' + id);
    let p = cache.get(id); if (!p) { p = gltf.loadAsync(RES_BASE + e.file); cache.set(id, p); }
    const g = await p; return g.scene.clone(true);
  },
};
