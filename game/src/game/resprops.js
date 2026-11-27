// أغراض من مجلد الموارد (CC0) تنحط بالعالم إذا كانت موجودة بالـAPK — أول استعمال لأنبوب الموارد (القسم 1)
// إذا المورد ما موجود (مثلاً بالمتصفح بدون مجلد res) ما يصير شي
import * as THREE from 'three';
import { Assets } from '../core/assets.js';
// [المورد، x، y، z، دوران، حجم]
const PLACE = [
  // قناني ماي على كاونتر «شاي الشريعة»
  ['waterbottle', 79.05, 1.05, 23.18, 0.3, 0.62], ['waterbottle', 79.28, 1.05, 23.22, 1.4, 0.62], ['waterbottle', 79.16, 1.05, 23.3, 2.2, 0.62],
];
export async function placeResProps(scene, Q) {
  await Assets.ready();
  const ids = [...new Set(PLACE.map(p => p[0]))].filter(id => Assets.has(id)); if (!ids.length) return 0;
  let n = 0;
  for (const [id, x, y, z, ry, s] of PLACE) {
    if (!Assets.has(id)) continue;
    try {
      const o = await Assets.model(id); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s);
      // نخلّي القاعدة على السطح بالضبط
      o.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(o); o.position.y += y - box.min.y;
      o.traverse(m => { if (m.isMesh) { m.castShadow = Q.shadow > 0; m.receiveShadow = Q.shadow > 0; } });
      scene.add(o); n++;
    } catch (e) { console.warn('resprop', id, e.message); }
  }
  return n;
}
