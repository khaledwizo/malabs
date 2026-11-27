// أيقونات المحلات والأماكن على الخريطة + قائمة الـGPS (القسم 1)
// المصدر: لافتات العالم (B.signs) — كل لافتة اسمها بالقائمة تصير نقطة على الخريطة بمكانها
export const POI_KINDS = {
  gun: { icon: '🔫', col: '#b53a2e', label: 'سلاح' }, ammo: { icon: '🎯', col: '#a5602a', label: 'ذخيرة' }, armor: { icon: '🛡️', col: '#55606e', label: 'دروع' },
  blade: { icon: '🗡️', col: '#6e5a3a', label: 'خناجر' }, spice: { icon: '🧂', col: '#a8742a', label: 'عطارة' }, med: { icon: '💊', col: '#2e8b57', label: 'صيدلية' },
  tea: { icon: '☕', col: '#7a3a1a', label: 'مقهى' }, food: { icon: '🥣', col: '#c0662a', label: 'أكل' }, bread: { icon: '🍞', col: '#b8862e', label: 'مخبز' },
  phone: { icon: '📱', col: '#2a5d8a', label: 'هواتف' }, gas: { icon: '🔥', col: '#b02a2a', label: 'غاز' }, plant: { icon: '🌿', col: '#2f7d32', label: 'مشتل' },
  mudhif: { icon: '🕌', col: '#1d5a34', label: 'مضيف' }, shrine: { icon: '🟢', col: '#1e7a4a', label: 'مرقد' }, land: { icon: '🏛️', col: '#6a5a44', label: 'معلم' },
};
const CAT = [[/^بنادق|^رشاشات|^مسدسات/, 'gun'], [/^ذخيرة/, 'ammo'], [/^دروع/, 'armor'], [/^خناجر/, 'blade'], [/^عطارة/, 'spice'], [/^صيدلية/, 'med'],
  [/^مقهى|^شاي/, 'tea'], [/^لبلبي/, 'food'], [/^خبز/, 'bread'], [/^تصليح/, 'phone'], [/^وكيل غاز/, 'gas'], [/^مشتل/, 'plant'],
  [/^مضيف الشيخ فاتح الرفاعي$/, 'mudhif'], [/^باب المرقد/, 'shrine'], [/^مسلّة|^القشلة/, 'land']];
const NAME = { 'باب المرقد': 'مرقد الشيخ فاتح الرفاعي' };
export function buildPois(signs, doors) {
  const out = [];
  // المرقد: منتصف بابيه
  const sd = (doors || []).filter(d => d.name === 'باب المرقد'); if (sd.length) out.push({ name: 'مرقد الشيخ فاتح الرفاعي', kind: 'shrine', x: sd.reduce((a, d) => a + d.x, 0) / sd.length, z: sd.reduce((a, d) => a + d.z, 0) / sd.length });
  for (const s of signs || []) {
    if (!s || typeof s.text !== 'string') continue; const t = s.text.trim(), c = CAT.find(([r]) => r.test(t)); if (!c) continue;
    const name = NAME[t] || t; if (out.some(p => p.name === name && Math.hypot(p.x - s.x, p.z - s.z) < 25)) continue;
    out.push({ name, kind: c[1], x: s.x, z: s.z });
  }
  return out;
}
