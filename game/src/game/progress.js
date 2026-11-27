// نسبة التختيم (القسم 1): قصة + جانبية + أملاك + مقتنيات + وظائف، بمكافآت عند 25/50/75/100%
// الأعداد الكلّية من خطة ROADMAP (56 مهمة قصة، 22 جانبية جديدة…) وتتحدّث كلّما انضاف محتوى
import { Economy } from './economy.js';
import { QUESTS } from './questdata.js';
const KEY = 'rafidain.progress.v1';
// المهام الحالية بطور القصة (غير المتكرّرة) تنحسب جانبية، فوگ الـ22 الجاية بالأقسام 8 و11 و13
const SIDE_NOW = QUESTS.filter(q => !q.repeat).map(q => q.id);
export const PARTS = {
  story: { label: 'القصة', icon: '📜', w: 40, total: 56 },
  side: { label: 'المهام الجانبية', icon: '🤝', w: 25, total: SIDE_NOW.length + 22 },
  props: { label: 'الأملاك', icon: '🏠', w: 10, total: 12 },
  coll: { label: 'المقتنيات', icon: '💎', w: 10, total: 40 },
  jobs: { label: 'الوظائف', icon: '🧰', w: 15, total: 4 },
};
// المكافآت: فلوس (مضاعفات 250) + لقب
export const MILESTONES = [
  { at: 25, money: 250000, title: 'ابن السوق' }, { at: 50, money: 1000000, title: 'حامي الحارات' },
  { at: 75, money: 3000000, title: 'سند المدينة' }, { at: 100, money: 10000000, title: 'أسطورة الرافدين' },
];
function load() { try { return Object.assign({ done: {}, got: [] }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { done: {}, got: [] }; } }
export const Progress = {
  S: load(), onMilestone: null,
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.S)); } catch (e) { } },
  // تسجيل شي انكمل: part = story|side|props|coll|jobs ، id فريد
  mark(part, id) { const d = this.S.done[part] = this.S.done[part] || {}; if (d[id]) return false; d[id] = 1; this.save(); this.check(); return true; },
  // يقرأ المهام المنجزة من حفظ المهام (rafidain.quests.v1)
  syncQuests() {
    let Q = {}; try { Q = (JSON.parse(localStorage.getItem('rafidain.quests.v1') || '{}').done) || {}; } catch (e) { }
    const d = this.S.done.side = this.S.done.side || {}; let ch = false;
    for (const id of SIDE_NOW) if (Q[id] && !d[id]) { d[id] = 1; ch = true; }
    if (ch) { this.save(); this.check(); }
  },
  count(part) { return Math.min(PARTS[part].total, Object.keys(this.S.done[part] || {}).length); },
  pct() { let p = 0; for (const [k, P] of Object.entries(PARTS)) p += P.w * this.count(k) / P.total; return Math.min(100, Math.floor(p * 10) / 10); },
  title() { let t = ''; for (const m of MILESTONES) if (this.S.got.includes(m.at)) t = m.title; return t; },
  check() {
    const p = this.pct();
    for (const m of MILESTONES) if (p >= m.at && !this.S.got.includes(m.at)) { this.S.got.push(m.at); Economy.earn(m.money); this.save(); if (this.onMilestone) this.onMilestone(m); }
  },
  rows() { return Object.entries(PARTS).map(([k, P]) => ({ k, ...P, n: this.count(k) })); },
};
