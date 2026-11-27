// تشغيل الجمل المسجّلة بأصوات عراقية (تُولَّد مسبقاً وتُشحن داخل التطبيق في مجلد voice/)
// الملفات تُشغَّل بعنصر صوت عادي (يعمل من ملفات التطبيق بلا قيود)، والحجم يتبع المسافة
import { voiceId } from './voicekey.js';
import { Audio } from './audio.js';
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
  // امتداد الملفات: ogg (أندرويد) أو m4a (آيفون — يضعه غلاف iOS)
  get ext() { return window.RAFIDAIN_VOICE_EXT || 'ogg'; },
  play(id, vol, onEnd) {
    if (window.RAFIDAIN_IOS && Audio.ctx) return this.playWA(id, vol, onEnd);
    const a = Audio.track(new window.Audio(this.base + id + '.' + this.ext)); let done = false;
    const fin = () => { if (done) return; done = true; onEnd && onEnd(); };
    a.volume = Math.max(0, Math.min(1, vol)); a.onended = fin; a.onerror = fin;
    const p = a.play(); if (p && p.catch) p.catch(fin);
    return a;
  },
  // آيفون: حجم عنصر الصوت ثابت (لا يُغيَّر)، فنشغّل عبر Web Audio مع عقدة حجم كي يخفت الصوت بالابتعاد
  playWA(id, vol, onEnd) {
    const ctx = Audio.ctx; let done = false;
    const fin = () => { if (done) return; done = true; onEnd && onEnd(); };
    const g = ctx.createGain(); g.gain.value = Math.max(0, Math.min(1, vol)); g.connect(ctx.destination);
    const h = { src: null, stopped: false, set volume(v) { g.gain.value = Math.max(0, Math.min(1, v)); }, get volume() { return g.gain.value; }, pause() { this.stopped = true; try { this.src && this.src.stop(); } catch (e) { } } };
    const start = buf => { if (h.stopped) return; const s = h.src = ctx.createBufferSource(); s.buffer = buf; s.connect(g); s.onended = fin; s.start(); };
    const x = new XMLHttpRequest(); x.open('GET', this.base + id + '.' + this.ext); x.responseType = 'arraybuffer';
    x.onload = () => { if (!x.response || !x.response.byteLength) return fin(); ctx.decodeAudioData(x.response, start, fin); }; // بلا تخزين: الجمل ما تتكرّر والذاكرة محدودة
    x.onerror = fin; x.send();
    return h;
  },
};
