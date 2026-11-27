// الحفظ الموحّد (القسم 1): كل تقدّم اللعبة (الفلوس، المهام، المضيف، العتاد، الأصدقاء، الإعدادات، التختيم…) بملف حفظ واحد
// - النسخة السريعة: localStorage (كل الوحدات تقرأ منها مباشرة عند التشغيل)
// - النسخة الدائمة: IndexedDB «rafidain» ← سجل main + سجل bak (النسخة اللي قبلها) + نسخة بالتطبيق (RafidainAndroid.saveKV)
// - إذا انمسحت بيانات المتصفح (كاش WebView) والحفظ موجود بـ IndexedDB أو بالتطبيق: نرجّعه ونعيد التحميل مرّة وحدة
// - أي localStorage.setItem لمفتاح يبدي بـ rafidain. يعلّم الحفظ «متغيّر»، ونكتبه كل 4 ثواني وعند الخروج
const PREFIX = 'rafidain.', STAMP = 'rafidain.save.t', DB = 'rafidain', ST = 'save', SKIP = /^rafidain\.(save\.t|hub)/;
let dirty = false, timer = 0, db = null, lastJson = '';
const native = () => { try { return window.RafidainAndroid && window.RafidainAndroid.saveKV ? window.RafidainAndroid : null; } catch (e) { return null; } };
function snapshot() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && !SKIP.test(k)) data[k] = localStorage.getItem(k); }
  return { v: 1, t: Date.now(), data };
}
function openDB() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no idb'));
    const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const idbGet = k => new Promise(res => { try { const q = db.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } });
const idbPut = (k, v) => new Promise(res => { try { const tx = db.transaction(ST, 'readwrite'); tx.objectStore(ST).put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); } catch (e) { res(false); } });
function restore(s) { if (!s || !s.data) return false; for (const [k, v] of Object.entries(s.data)) localStorage.setItem(k, v); localStorage.setItem(STAMP, String(s.t)); return true; }

export const Save = {
  ready: false, last: 0,
  // يشتغل قبل أي شي: يرجّع الحفظ إذا انمسح، ويراقب التغييرات
  async boot() {
    const set = Storage.prototype.setItem, rem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) { set.call(this, k, v); if (this === localStorage && typeof k === 'string' && k.startsWith(PREFIX) && !SKIP.test(k)) Save.mark(); };
    Storage.prototype.removeItem = function (k) { rem.call(this, k); if (this === localStorage && typeof k === 'string' && k.startsWith(PREFIX)) Save.mark(); };
    try { db = await openDB(); } catch (e) { db = null; }
    const local = +localStorage.getItem(STAMP) || 0;
    let best = db ? await idbGet('main') : null;
    if (!best || !best.data) { const b = db ? await idbGet('bak') : null; if (b && b.data) best = b; }
    if ((!best || !best.data) && native()) { try { const a = native().loadKV('save'); if (a) best = JSON.parse(a); } catch (e) { } }
    // البيانات المحلية انمسحت (ما بيها ختم الحفظ) وعدنا حفظ أحدث: نرجّعه ونعيد التحميل
    if (best && best.data && !local && Object.keys(best.data).length && !sessionStorage.getItem('rafidain.restored')) {
      restore(best); sessionStorage.setItem('rafidain.restored', '1'); location.reload(); return false;
    }
    this.ready = true; this.mark();
    addEventListener('pagehide', () => this.flush()); document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(); });
    return true;
  },
  mark() { dirty = true; if (!timer) timer = setTimeout(() => { timer = 0; this.flush(); }, 4000); },
  async flush() {
    if (!dirty || !this.ready) return; dirty = false;
    // البيانات المحلية انمسحت (ما بيها ختم) وعدنا حفظ سابق: ما نكتب فوقه بنسخة فارغة — boot يرجّعه
    if (!localStorage.getItem(STAMP) && db) { const prev = await idbGet('main'); if (prev && prev.data && Object.keys(prev.data).length > 2) return; }
    const s = snapshot(), json = JSON.stringify(s.data); if (json === lastJson) return; lastJson = json;
    try { localStorage.setItem(STAMP, String(s.t)); } catch (e) { }
    if (db) { const prev = await idbGet('main'); if (prev && prev.data) await idbPut('bak', prev); await idbPut('main', s); }
    try { const n = native(); if (n) n.saveKV('save', JSON.stringify(s)); } catch (e) { }
    this.last = s.t;
  },
  // كود نسخ احتياطي (للنقل بين الأجهزة أو قبل التجربة) واسترجاعه
  exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(snapshot())))); },
  importCode(code) {
    const s = JSON.parse(decodeURIComponent(escape(atob(String(code).trim())))); if (!s || !s.data) throw new Error('bad');
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && !SKIP.test(k)) localStorage.removeItem(k); }
    restore(s); dirty = true; return this.flush();
  },
  // يمسح تقدّم القصة بس (الإعدادات والأصدقاء والمعرّف يبقون)
  async resetStory() {
    for (const k of ['rafidain.wallet.v1', 'rafidain.quests.v1', 'rafidain.mudhif.v2', 'rafidain.street.v1', 'rafidain.progress.v1', 'rafidain.loadout.v2']) localStorage.removeItem(k);
    dirty = true; await this.flush();
  },
};
