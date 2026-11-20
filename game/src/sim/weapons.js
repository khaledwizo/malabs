// بيانات الأسلحة والمناظير والقنابل (أسماء مبتكرة)
// dmg: ضرر الطلقة · rpm: طلقات/دقيقة · mag/reserve · spread: انتشار أساسي (راديان) · moveSpread · recoil: [عمودي، أفقي] لكل طلقة
// range: معامل تخامد الضرر لكل 10م · pen: قدرة الاختراق · speed: مضاعف سرعة الجري · auto: آلي
export const WEAPONS = {
  // ---------- بنادق هجومية ----------
  rafid: { name: 'رافد-47', cls: 'rifle', slot: 1, dmg: 36, rpm: 600, mag: 30, reserve: 90, reload: 2.5, spread: 0.0035, moveSpread: 0.07, airSpread: 0.15, recoil: [0.026, 0.011], recover: 7, range: 0.98, pen: 2, speed: 0.86, auto: true, armorPen: 0.78, scopes: ['iron', 'dot', 'holo', 'x2', 'x4'], kill: 'أسقط', snd: 'rifleHeavy', desc: 'ضربة قوية وارتداد عنيف. طلقة رأس واحدة تكفي.' },
  saif556: { name: 'سيف-556', cls: 'rifle', slot: 1, dmg: 31, rpm: 690, mag: 30, reserve: 90, reload: 2.2, spread: 0.003, moveSpread: 0.06, airSpread: 0.14, recoil: [0.021, 0.008], recover: 8, range: 0.97, pen: 1.8, speed: 0.9, auto: true, armorPen: 0.7, scopes: ['iron', 'dot', 'holo', 'x2', 'x4'], snd: 'rifle', desc: 'متوازن ودقيق، ارتداده سهل الترويض.' },
  battar: { name: 'بتّار', cls: 'rifle', slot: 1, dmg: 32, rpm: 600, mag: 30, reserve: 90, reload: 2.6, spread: 0.0025, moveSpread: 0.065, airSpread: 0.14, recoil: [0.022, 0.009], recover: 7.5, range: 0.98, pen: 1.9, speed: 0.87, auto: true, armorPen: 0.8, scopes: ['x2', 'x4', 'dot'], snd: 'rifle', desc: 'بندقية بمنظار مدمج للمسافات المتوسطة.' },
  zawba: { name: 'زوبعة', cls: 'smg', slot: 1, dmg: 25, rpm: 850, mag: 32, reserve: 128, reload: 2.0, spread: 0.006, moveSpread: 0.025, airSpread: 0.08, recoil: [0.014, 0.01], recover: 10, range: 0.86, pen: 1, speed: 0.98, auto: true, armorPen: 0.6, scopes: ['iron', 'dot', 'holo'], snd: 'smg', desc: 'سريعة الإطلاق وخفيفة، قاتلة في الأزقة الضيقة.' },
  raad: { name: 'رعد', cls: 'shotgun', slot: 1, dmg: 21, pellets: 9, rpm: 70, mag: 7, reserve: 28, reload: 0.5, perShell: true, spread: 0.045, moveSpread: 0.02, airSpread: 0.05, recoil: [0.09, 0.02], recover: 5, range: 0.7, pen: 0.5, speed: 0.92, auto: false, armorPen: 0.75, scopes: ['iron', 'dot'], snd: 'shotgun', desc: 'مضخية مدمّرة عن قرب.' },
  tufan: { name: 'طوفان', cls: 'lmg', slot: 1, dmg: 33, rpm: 760, mag: 100, reserve: 200, reload: 4.6, spread: 0.006, moveSpread: 0.1, airSpread: 0.2, recoil: [0.019, 0.016], recover: 6, range: 0.97, pen: 2, speed: 0.78, auto: true, armorPen: 0.75, scopes: ['iron', 'dot', 'holo', 'x2'], snd: 'rifleHeavy', desc: 'رشاش ثقيل بمخزن 100 طلقة لقمع الممرات.' },
  // ---------- قنّاصات ----------
  saqr: { name: 'صقر الصحراء', cls: 'sniper', slot: 1, dmg: 115, rpm: 41, mag: 5, reserve: 20, reload: 3.4, spread: 0.0004, noScope: 0.09, moveSpread: 0.12, airSpread: 0.3, recoil: [0.08, 0.01], recover: 3, range: 0.995, pen: 2.5, speed: 0.8, auto: false, bolt: true, armorPen: 0.97, scopes: ['x4', 'x8', 'x12'], snd: 'sniper', desc: 'طلقة واحدة في الجسد تُسقط الخصم. بطيئة لكنها لا ترحم.' },
  mirsad: { name: 'المِرصاد', cls: 'sniper', slot: 1, dmg: 78, rpm: 240, mag: 10, reserve: 30, reload: 3.0, spread: 0.0008, noScope: 0.07, moveSpread: 0.09, airSpread: 0.25, recoil: [0.05, 0.012], recover: 4, range: 0.99, pen: 2.2, speed: 0.83, auto: false, armorPen: 0.85, scopes: ['x4', 'x8'], snd: 'sniperSemi', desc: 'قنّاصة نصف آلية: طلقتان سريعتان تكفيان.' },
  uqab: { name: 'عُقاب', cls: 'sniper', slot: 1, dmg: 88, rpm: 48, mag: 10, reserve: 30, reload: 2.8, spread: 0.0006, noScope: 0.05, moveSpread: 0.03, airSpread: 0.04, recoil: [0.06, 0.01], recover: 4, range: 0.99, pen: 2, speed: 0.96, auto: false, bolt: true, armorPen: 0.85, scopes: ['x4', 'x8'], snd: 'sniper', desc: 'خفيفة وسريعة الحركة، دقيقة حتى أثناء القفز.' },
  // ---------- مسدسات ----------
  dijla: { name: 'دجلة-9', cls: 'pistol', slot: 2, dmg: 27, rpm: 400, mag: 15, reserve: 60, reload: 1.7, spread: 0.005, moveSpread: 0.03, airSpread: 0.08, recoil: [0.03, 0.01], recover: 9, range: 0.9, pen: 1, speed: 1, auto: false, armorPen: 0.55, scopes: ['iron'], snd: 'pistol', desc: 'مسدس موثوق بمخزن كبير.' },
  nisr: { name: 'النسر .50', cls: 'pistol', slot: 2, dmg: 54, rpm: 230, mag: 7, reserve: 35, reload: 2.1, spread: 0.004, moveSpread: 0.06, airSpread: 0.12, recoil: [0.07, 0.015], recover: 5, range: 0.92, pen: 1.8, speed: 0.97, auto: false, armorPen: 0.9, scopes: ['iron', 'dot'], snd: 'pistolHeavy', desc: 'مسدس ثقيل: طلقة رأس قاتلة.' },
  zaeem: { name: 'زعيم-18', cls: 'pistol', slot: 2, dmg: 21, rpm: 900, mag: 18, reserve: 72, reload: 1.9, spread: 0.008, moveSpread: 0.03, airSpread: 0.08, recoil: [0.022, 0.014], recover: 9, range: 0.85, pen: 0.8, speed: 1, auto: true, armorPen: 0.5, scopes: ['iron'], snd: 'pistol', desc: 'مسدس آلي سريع للمواجهات القريبة.' },
  // ---------- سلاح أبيض ----------
  khanjar: { name: 'خنجر', cls: 'knife', slot: 3, dmg: 40, backDmg: 120, rpm: 120, mag: 0, reserve: 0, range: 1.8, speed: 1.08, auto: true, scopes: [], snd: 'knife' },
};

export const SCOPES = {
  iron: { name: 'تصويب حديدي', zoom: 1.18, overlay: false },
  dot: { name: 'نقطة حمراء', zoom: 1.28, overlay: false, reticle: 'dot' },
  holo: { name: 'هولوغرافي', zoom: 1.32, overlay: false, reticle: 'holo' },
  x2: { name: 'مكبّر ×2', zoom: 2, overlay: false, reticle: 'x2' },
  x4: { name: 'منظار ×4', zoom: 4, overlay: true },
  x8: { name: 'منظار ×8', zoom: 8, overlay: true },
  x12: { name: 'منظار ×12', zoom: 12, overlay: true },
};

export const NADES = {
  frag: { name: 'رمّانة', fuse: 2.0, radius: 7, dmg: 105, desc: 'تنفجر بعد ثانيتين.' },
  smoke: { name: 'دخانية', fuse: 1.6, radius: 4.6, life: 16, desc: 'تحجب الرؤية 16 ثانية.' },
  flash: { name: 'صاعقة', fuse: 1.5, radius: 26, desc: 'تعمي من يراها.' },
  molotov: { name: 'مولوتوف', fuse: 2.2, radius: 3.2, life: 7, dps: 32, desc: 'تشعل الأرض 7 ثوانٍ.' },
};

export const MODES = {
  epic: { name: 'ملحمة', desc: 'كل الأسلحة متاحة', primaries: ['rafid', 'saif556', 'battar', 'zawba', 'raad', 'tufan', 'saqr', 'mirsad', 'uqab'] },
  sniper: { name: 'قنّاصة', desc: 'قنّاصات ومسدسات فقط', primaries: ['saqr', 'mirsad', 'uqab'] },
  pistols: { name: 'مسدسات', desc: 'جولات المسدس والخنجر', primaries: [] },
};
export const SECONDARIES = ['dijla', 'nisr', 'zaeem'];

export function defaultLoadout(mode, rng = Math.random) {
  const P = MODES[mode].primaries;
  const primary = P.length ? P[Math.floor(rng() * P.length)] : null;
  const sc = primary ? WEAPONS[primary].scopes : [];
  return { primary, scope: sc.length ? sc[Math.min(sc.length - 1, Math.floor(rng() * sc.length))] : null, secondary: SECONDARIES[Math.floor(rng() * 3)], nades: [['frag', 'smoke', 'flash', 'molotov'][Math.floor(rng() * 4)], ['frag', 'smoke', 'flash', 'molotov'][Math.floor(rng() * 4)]] };
}
export function validLoadout(l, mode) {
  const P = MODES[mode].primaries;
  const out = { primary: P.includes(l && l.primary) ? l.primary : (P[0] || null), secondary: SECONDARIES.includes(l && l.secondary) ? l.secondary : 'dijla', nades: [] };
  const sc = out.primary ? WEAPONS[out.primary].scopes : [];
  out.scope = sc.includes(l && l.scope) ? l.scope : (sc[0] || null);
  for (const n of ((l && l.nades) || []).slice(0, 2)) if (NADES[n]) out.nades.push(n);
  return out;
}
