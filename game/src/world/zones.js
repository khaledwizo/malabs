// مدير المناطق (القسم 1): كل مدينة/منطقة كبيرة = Zone تنحمّل لمّا يقرب اللاعب منها وتنفرّغ لمّا يبتعد (مثل ببجي وGTA)
// - داخل المنطقة المحمّلة: الخلايا (gfx/scene.js splitCells) ترسم القريب بس حسب مستوى الجودة، والتفاصيل تختفي أبكر.
// - المناطق الجاية (المدينة المطفأة، الطريق السريع، البحيرة، جبهة الشمال) تنضاف بـ Zones.add({ id, name, rect, load, unload })
//   load() غير متزامن يرجّع كائن three (مبني من موارد glb/ktx2 بمجلد الموارد)، وunload() يحرّر الذاكرة.
export const Zones = {
  list: [], scene: null, busy: false, cur: null,
  init(scene) { this.scene = scene; },
  // rect = [x0, z0, x1, z1] ؛ keep = تبقى محمّلة دائماً (المدينة الحالية)
  add(z) { this.list.push(Object.assign({ state: z.keep ? 'on' : 'off', obj: null, margin: 120 }, z)); return z; },
  dist(z, x, y) { const r = z.rect, dx = Math.max(r[0] - x, 0, x - r[2]), dz = Math.max(r[1] - y, 0, y - r[3]); return Math.hypot(dx, dz); },
  at(x, z) { return this.list.find(o => this.dist(o, x, z) === 0) || null; },
  // يُستدعى كل ثانية تقريباً بمكان الكاميرا
  async update(x, z) {
    this.cur = this.at(x, z);
    if (this.busy) return; this.busy = true;
    try {
      for (const o of this.list) {
        if (o.keep) continue; const d = this.dist(o, x, z);
        if (o.state === 'off' && d < o.margin) { o.state = 'loading'; try { o.obj = await o.load(); if (o.obj && this.scene) this.scene.add(o.obj); o.state = 'on'; } catch (e) { console.warn('zone load', o.id, e); o.state = 'off'; } }
        else if (o.state === 'on' && d > o.margin * 1.5) { if (o.obj && this.scene) this.scene.remove(o.obj); try { o.unload && o.unload(o.obj); } catch (e) { } o.obj = null; o.state = 'off'; }
      }
    } finally { this.busy = false; }
  },
};
