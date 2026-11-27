// معرّف ثابت لكل جملة مسجّلة: بصمة FNV-1a لـ(الصوت|الطبقة|السرعة|الصياح|النص) — نفسها في المولّد وفي اللعبة
export function fnv(str) {
  const b = new TextEncoder().encode(str); let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export const VOICE_NAMES = { b: 'ar-IQ-BasselNeural', r: 'ar-IQ-RanaNeural', h: 'ar-SA-HamedNeural' }; // h: صوت فصيح لمحاضرات الشيخ وإمام الجماعة
export const voiceKey = (per, loud) => `${per.v}|${per.p}|${per.r}|${loud ? 1 : 0}`;
// الجمل اللي بيها اسم الجلالة انولّدت من جديد بتشكيل صحيح (g2)
// الترجمة على الشاشة بتشكيل خفيف: نشيل الحركات ونبقي الشدّة بس (نص الصوت يبقى مشكّلاً كاملاً)
export const lite = t => String(t).replace(/[\u064B-\u0650\u0652\u0670]/g, '');
export const voiceId = (per, text, loud) => fnv(voiceKey(per, loud) + '|' + text + (/الله|لله/.test(text) ? '|g2' : ''));
