// تشغيل الجمل المسجّلة بأصوات عراقية (تُولَّد مسبقاً وتُشحن داخل التطبيق في مجلد voice/)
// الملفات تُشغَّل بعنصر صوت عادي (يعمل من ملفات التطبيق بلا قيود)، والحجم يتبع المسافة
import { voiceId } from './voicekey.js';
export { voiceId };

export const Voices = {
  map: null, base: 'voice/',
  load() {
    if (this.loading) return; this.loading = true;
    const s = document.createElement('script'); s.src = this.base + 'manifest.js';
    s.onload = () => { this.map = window.RAFIDAIN_VOICES || {}; };
    s.onerror = () => { this.map = {}; };
    document.head.appendChild(s);
  },
  get ready() { return !!this.map; },
  get count() { return this.map ? Object.keys(this.map).length : 0; },
  has(id) { return !!(this.map && this.map[id]); },
  dur(id) { return (this.map && this.map[id]) || 0; },
  // يعيد عنصر الصوت؛ onEnd عند الانتهاء أو الفشل
  play(id, vol, onEnd) {
    const a = new Audio(this.base + id + '.ogg'); let done = false;
    const fin = () => { if (done) return; done = true; onEnd && onEnd(); };
    a.volume = Math.max(0, Math.min(1, vol)); a.onended = fin; a.onerror = fin;
    const p = a.play(); if (p && p.catch) p.catch(fin);
    return a;
  },
};
