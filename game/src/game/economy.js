// اقتصاد اللاعب: المحفظة بالدينار العراقي، الأسلحة المملوكة، مخزون العتاد بأنواعه الخمسة، القنابل والمواد الصحية
// كل المبالغ من مضاعفات 250 دينار (أصغر ورقة نقدية)
import { WEAPONS, NADES } from '../sim/weapons.js';

const KEY = 'rafidain.wallet.v1';
export const r250 = v => Math.max(0, Math.round(v / 250) * 250);
export const fmtIQD = v => (v || 0).toLocaleString('en-US') + ' د.ع';

// أنواع العتاد: الرشاشات كلها نوع واحد، بنادق الصيد، المسدسات، الرماية المفردة، القنص
export const AMMO = {
  auto: { name: 'رصاص الرشاشات', short: 'رشاش', pack: 30, price: 750, free: 80 },
  shot: { name: 'خرطوش بنادق الصيد', short: 'صيد', pack: 10, price: 500, free: 16 },
  pist: { name: 'رصاص المسدسات', short: 'مسدس', pack: 15, price: 250, free: 45 },
  dmr: { name: 'رصاص الرمي المفرد', short: 'مفرد', pack: 10, price: 750, free: 30 },
  snip: { name: 'رصاص القنص', short: 'قنص', pack: 5, price: 1000, free: 10 },
};
export const AMMO_ORDER = ['auto', 'pist', 'shot', 'dmr', 'snip'];
const CLS_AMMO = { rifle: 'auto', smg: 'auto', lmg: 'auto', shotgun: 'shot', pistol: 'pist', dmr: 'dmr', sniper: 'snip' };
export const ammoOf = id => { const w = WEAPONS[id]; return w ? CLS_AMMO[w.cls] || null : null; };

// أسعار الأسلحة بالتدرّج حسب الندرة والأفضلية (0 = مفتوح مجاناً)
export const WPRICE = {
  rafid: 0, raad: 0, dijla: 0,
  furat: 20000, zaeem: 30000, nisr: 35000,
  asifa: 40000, mirsad: 45000, iasar: 50000, zawba: 55000, nadhur: 60000,
  saif556: 70000, battar: 85000, uqab: 120000, shihab: 150000, tufan: 160000, tabuk: 600000, saqr: 785000,
};
// القنابل والصحة والمعدّات
export const ITEMS = {
  frag: { name: 'رمّانة', price: 2000, kind: 'nade' },
  molotov: { name: 'مولوتوف', price: 1500, kind: 'nade' },
  smoke: { name: 'دخانية', price: 1000, kind: 'nade' },
  flash: { name: 'صاعقة', price: 1000, kind: 'nade' },
  bandage: { name: 'ضِماد', price: 500, kind: 'med' },
  syringe: { name: 'إبرة علاج', price: 2500, kind: 'med' },
  nvg: { name: 'نظارة رؤية ليلية', price: 200000, kind: 'gear', once: true, desc: 'في الليل تجعل الرؤية واضحة كالنهار. زرٌّ في المعركة لتشغيلها.' },
};
// المجاني بكل قيم (ما يتراكم ولا يُسترد)
export const FREE_MEDS = { b: 4, s: 2 };
// المكافآت (70% من قتل اللاعب للبوت، مقرّبة لأقرب 250)
// قتل لاعب حقيقي 500، بوت 250، مساعدة 100، فوز +1000، والخسارة تخصم 1000 من أرباح القتلات بنفس القيم (ما تنزل تحت الصفر)
export const REWARD = { kill: 500, botKill: 250, assist: 100, win: 1000, draw: 0, loss: -1000 };

const fresh = () => ({
  money: 0,
  owned: { rafid: 1, raad: 1, dijla: 1 },
  ammo: { auto: 2000, pist: 500, shot: 40, dmr: 0, snip: 0 },
  items: { frag: 5, molotov: 3, smoke: 0, flash: 0, bandage: 0, syringe: 0 },
  nvg: false,
  earned: 0,
});

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  try { if (!d && window.RafidainAndroid && window.RafidainAndroid.loadKV) { const a = window.RafidainAndroid.loadKV('wallet'); if (a) d = JSON.parse(a); } } catch (e) { }
  const f = fresh();
  if (!d || typeof d !== 'object') return f;
  return { ...f, ...d, owned: { ...f.owned, ...(d.owned || {}) }, ammo: { ...f.ammo, ...(d.ammo || {}) }, items: { ...f.items, ...(d.items || {}) } };
}

export const Economy = {
  W: load(),
  listeners: new Set(),
  save() {
    const s = JSON.stringify(this.W);
    try { localStorage.setItem(KEY, s); } catch (e) { }
    try { if (window.RafidainAndroid && window.RafidainAndroid.saveKV) window.RafidainAndroid.saveKV('wallet', s); } catch (e) { } // نسخة احتياطية خارج بيانات الصفحة
    for (const f of this.listeners) try { f(this.W); } catch (e) { }
  },
  get money() { return this.W.money; },
  owns(id) { return !!this.W.owned[id] || WPRICE[id] === 0; },
  can(price) { return this.W.money >= price; },
  earn(v) { const a = r250(v); if (a > 0) { this.W.money += a; this.save(); } return a; },
  spend(price) { const ok = this.pay(price); if (ok) this.save(); return ok; },
  pay(price) { if (!this.can(price)) return false; this.W.money -= price; return true; },
  buyWeapon(id) { const p = WPRICE[id]; if (p == null || this.owns(id) || !this.pay(p)) return false; this.W.owned[id] = 1; this.save(); return true; },
  buyAmmo(t, packs = 1) { const A = AMMO[t]; if (!A || !this.pay(A.price * packs)) return false; this.W.ammo[t] = (this.W.ammo[t] || 0) + A.pack * packs; this.save(); return true; },
  buyItem(k, n = 1) {
    const I = ITEMS[k]; if (!I) return false;
    if (I.once) { if (this.W[k] || !this.pay(I.price)) return false; this.W[k] = true; this.save(); return true; }
    if (!this.pay(I.price * n)) return false; this.W.items[k] = (this.W.items[k] || 0) + n; this.save(); return true;
  },
  // ما يُرسل للسيرفر مع العتاد عند دخول القيم: الحصّة المجانية + المخزون
  matchSupply(loadout) {
    const W = this.W, ammo = {}, nades = {};
    for (const t of AMMO_ORDER) ammo[t] = AMMO[t].free + (W.ammo[t] || 0);
    for (const k of Object.keys(NADES)) nades[k] = W.items[k] || 0;
    const sup = { ammo, nades, meds: { b: FREE_MEDS.b + (W.items.bandage || 0), s: FREE_MEDS.s + (W.items.syringe || 0) } };
    this.start = JSON.parse(JSON.stringify(sup)); this.settled = false;
    return sup;
  },
  // نهاية القيم: المجاني يُصرف أولاً، والباقي من المخزون. المخزون الجديد = أقل(المخزون، المتبقّي)
  settle(e) {
    if (this.settled || !this.start) return null;
    this.settled = true;
    const W = this.W, R = e.sup || {};
    if (R.ammo) for (const t of AMMO_ORDER) if (R.ammo[t] != null) W.ammo[t] = Math.max(0, Math.min(W.ammo[t] || 0, Math.floor(R.ammo[t])));
    if (R.nades) for (const k of Object.keys(NADES)) if (R.nades[k] != null) W.items[k] = Math.max(0, Math.min(W.items[k] || 0, Math.floor(R.nades[k])));
    if (R.meds) { W.items.bandage = Math.max(0, Math.min(W.items.bandage || 0, Math.floor(R.meds.b ?? 0))); W.items.syringe = Math.max(0, Math.min(W.items.syringe || 0, Math.floor(R.meds.s ?? 0))); }
    const lines = [];
    if (e.kh) lines.push([`إسقاط لاعبين ×${e.kh}`, e.kh * REWARD.kill]);
    if (e.kb) lines.push([`إسقاط بوتات ×${e.kb}`, e.kb * REWARD.botKill]);
    if (e.as) lines.push([`مساعدات ×${e.as}`, e.as * REWARD.assist]);
    if (e.res != null) lines.push([e.res > 0 ? 'الفوز' : e.res < 0 ? 'المشاركة' : 'التعادل', e.res > 0 ? REWARD.win : e.res < 0 ? REWARD.loss : REWARD.draw]);
    if (e.res < 0) { const earned = lines.filter(l => l[1] > 0).reduce((s, l) => s + l[1], 0), ln = lines.find(l => l[0] === 'المشاركة'); if (ln) { ln[0] = 'الخسارة'; ln[1] = -Math.min(1000, earned); } }
    const total = Math.max(0, lines.reduce((s, l) => s + l[1], 0));
    W.money += total; W.earned = (W.earned || 0) + total;
    this.save();
    this.last = { lines, total };
    return this.last;
  },
  // خروج قبل النهاية: نخصم المصروف من المخزون بلا مكافأة
  abandon(sup) { if (!sup) { this.settled = true; return; } this.settle({ sup }); this.last = null; },
  onChange(f) { this.listeners.add(f); },
  reset() { this.W = fresh(); this.save(); },
};
if (typeof window !== 'undefined') window.__Economy = Economy;
