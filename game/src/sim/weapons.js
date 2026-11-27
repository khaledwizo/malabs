// بيانات الأسلحة والمناظير والملحقات والقنابل وأوضاع اللعب (أسماء مبتكرة)
// dmg: ضرر الطلقة في الجسد · head: مضاعف الرأس · rpm: طلقات/دقيقة · mag/reserve · reload: ثوانٍ
// spread: انتشار عند التصويب من الكتف (راديان) · hip: انتشار إضافي بلا تصويب · moveSpread/airSpread
// recoil: [صعود عمودي لكل طلقة، انحراف أفقي] · climb: تزايد الصعود مع طول الرشقة · recover: سرعة الرجوع
// range: تخامد الضرر لكل 10م · pen: قدرة اختراق الجدران · speed: مضاعف سرعة الحركة · ads: زمن التصويب
export const WEAPONS = {
  // ---------- بنادق هجومية ----------
  rafid: { name: 'AKM', cls: 'rifle', slot: 1, dmg: 36, head: 2.3, rpm: 600, mag: 30, reserve: 150, reload: 2.6, spread: 0.0022, hip: 0.034, moveSpread: 0.05, airSpread: 0.14, recoil: [0.0115, 0.0042], climb: 1.35, recover: 6, range: 0.985, pen: 2, speed: 0.92, auto: true, ads: 0.24, armorPen: 0.35, att: ['muzzle', 'mag'], scopes: ['iron', 'dot', 'holo', 'x2', 'x3', 'x4', 'x6'], snd: 'rifleHeavy', model: 'ak', desc: 'رشاش AKM الأسطوري: ضربة قوية وارتداد عنيف يصعد بسرعة. يكافئ اليد الثابتة.' },
  saif556: { name: 'M416', cls: 'rifle', slot: 1, dmg: 31, head: 2.3, rpm: 700, mag: 30, reserve: 150, reload: 2.3, spread: 0.0018, hip: 0.03, moveSpread: 0.045, airSpread: 0.13, recoil: [0.0082, 0.003], climb: 1.15, recover: 7.5, range: 0.98, pen: 1.8, speed: 0.95, auto: true, ads: 0.22, armorPen: 0.3, att: ['muzzle', 'grip', 'mag'], scopes: ['iron', 'dot', 'holo', 'x2', 'x3', 'x4', 'x6'], snd: 'rifle', model: 'm4', desc: 'الأكثر توازناً: دقيق وسهل الترويض بالملحقات.' },
  battar: { name: 'SCAR-L', cls: 'rifle', slot: 1, dmg: 33, head: 2.3, rpm: 630, mag: 30, reserve: 150, reload: 2.5, spread: 0.0018, hip: 0.032, moveSpread: 0.048, airSpread: 0.13, recoil: [0.0092, 0.0036], climb: 1.2, recover: 7, range: 0.985, pen: 1.9, speed: 0.94, auto: true, ads: 0.24, armorPen: 0.35, att: ['muzzle', 'grip', 'mag'], scopes: ['iron', 'dot', 'holo', 'x2', 'x3', 'x4', 'x6'], snd: 'rifle', model: 'scar', desc: 'بندقية عسكرية ثابتة عند الرشق الطويل.' },
  shihab: { name: 'Groza', cls: 'rifle', slot: 1, dmg: 36, head: 2.3, rpm: 760, mag: 30, reserve: 150, reload: 2.9, spread: 0.0024, hip: 0.032, moveSpread: 0.05, airSpread: 0.14, recoil: [0.0118, 0.0052], climb: 1.4, recover: 6, range: 0.98, pen: 2, speed: 0.93, auto: true, ads: 0.26, armorPen: 0.35, att: ['muzzle', 'mag'], scopes: ['iron', 'dot', 'holo', 'x2', 'x3', 'x4'], snd: 'rifleHeavy', model: 'bullpup', desc: 'بندقية قصيرة سريعة القتل، لكنها جامحة. للأبطال فقط.' },
  // ---------- رشاشات خفيفة ----------
  zawba: { name: 'Vector', cls: 'smg', slot: 1, dmg: 24, head: 1.9, rpm: 1000, mag: 33, reserve: 165, reload: 2.1, spread: 0.0032, hip: 0.02, moveSpread: 0.018, airSpread: 0.07, recoil: [0.0062, 0.0042], climb: 1.1, recover: 10, range: 0.86, pen: 0.9, speed: 1.0, auto: true, ads: 0.17, armorPen: 0.25, att: ['muzzle', 'grip', 'mag'], scopes: ['iron', 'dot', 'holo', 'x2'], snd: 'smg', model: 'vector', desc: 'أسرع سلاح في السوق، يذيب الخصم في الأزقة الضيقة.' },
  asifa: { name: 'UMP45', cls: 'smg', slot: 1, dmg: 31, head: 1.9, rpm: 670, mag: 30, reserve: 150, reload: 2.2, spread: 0.0028, hip: 0.02, moveSpread: 0.018, airSpread: 0.07, recoil: [0.0068, 0.0028], climb: 1.05, recover: 9.5, range: 0.88, pen: 1, speed: 1.0, auto: true, ads: 0.18, armorPen: 0.25, att: ['muzzle', 'grip', 'mag'], scopes: ['iron', 'dot', 'holo', 'x2'], snd: 'smgHeavy', model: 'ump', desc: 'رشاش ثقيل الطلقة مستقر جداً، صديق المبتدئين.' },
  // ---------- بنادق صيد ----------
  raad: { name: 'S1897', cls: 'shotgun', slot: 1, dmg: 24, head: 1.5, pellets: 9, rpm: 66, mag: 6, reserve: 36, reload: 0.52, perShell: true, spread: 0.05, hip: 0.0, moveSpread: 0.015, airSpread: 0.04, recoil: [0.05, 0.012], climb: 1, recover: 5, range: 0.66, pen: 0.5, speed: 0.95, auto: false, pump: true, ads: 0.22, armorPen: 0.3, att: [], scopes: ['iron', 'dot'], snd: 'shotgun', model: 'pump', desc: 'مضخية مدمّرة عن قرب: طلقة واحدة تحسم الزقاق.' },
  iasar: { name: 'S12K', cls: 'shotgun', slot: 1, dmg: 20, head: 1.5, pellets: 9, rpm: 230, mag: 5, reserve: 35, reload: 2.9, spread: 0.06, hip: 0.0, moveSpread: 0.02, airSpread: 0.05, recoil: [0.035, 0.014], climb: 1.1, recover: 6, range: 0.62, pen: 0.5, speed: 0.93, auto: false, ads: 0.24, armorPen: 0.3, att: ['mag'], scopes: ['iron', 'dot', 'holo'], snd: 'shotgun', model: 'autoshot', desc: 'بندقية صيد نصف آلية بمخزن، تمطر الطلقات بسرعة.' },
  // ---------- رشاش ثقيل ----------
  tufan: { name: 'M249', cls: 'lmg', slot: 1, dmg: 32, head: 2.2, rpm: 780, mag: 100, reserve: 200, reload: 5.2, spread: 0.0026, hip: 0.045, moveSpread: 0.07, airSpread: 0.18, recoil: [0.0078, 0.0046], climb: 1.05, recover: 5.5, range: 0.98, pen: 2, speed: 0.82, auto: true, ads: 0.34, armorPen: 0.35, att: ['muzzle'], scopes: ['iron', 'dot', 'holo', 'x2', 'x3', 'x4'], snd: 'rifleHeavy', model: 'lmg', desc: 'مئة طلقة بلا توقف لقمع الممرات.' },
  // ---------- بنادق رماية دقيقة ----------
  mirsad: { name: 'SKS', cls: 'dmr', slot: 1, dmg: 56, head: 2.35, rpm: 260, mag: 10, reserve: 50, reload: 2.9, spread: 0.0008, hip: 0.05, moveSpread: 0.06, airSpread: 0.2, recoil: [0.03, 0.008], climb: 1, recover: 5, range: 0.992, pen: 2.2, speed: 0.9, auto: false, ads: 0.28, armorPen: 0.5, att: ['muzzle', 'mag'], scopes: ['iron', 'dot', 'x2', 'x3', 'x4', 'x6', 'x8'], snd: 'sniperSemi', model: 'dmr', desc: 'نصف آلية دقيقة: طلقتان في الجسد أو واحدة في الرأس.' },
  nadhur: { name: 'Mini 14', cls: 'dmr', slot: 1, dmg: 46, head: 2.35, rpm: 330, mag: 20, reserve: 80, reload: 2.6, spread: 0.0009, hip: 0.045, moveSpread: 0.05, airSpread: 0.18, recoil: [0.021, 0.006], climb: 1, recover: 6, range: 0.99, pen: 1.8, speed: 0.93, auto: false, ads: 0.25, armorPen: 0.45, att: ['muzzle', 'mag'], scopes: ['iron', 'dot', 'x2', 'x3', 'x4', 'x6'], snd: 'sniperSemi', model: 'mini', desc: 'خفيفة وسريعة الطلقات، ارتدادها ناعم.' },
  // ---------- قنّاصات ----------
  saqr: { name: 'AWM', cls: 'sniper', slot: 1, dmg: 150, head: 2.5, rpm: 40, mag: 5, reserve: 25, reload: 3.6, spread: 0.0003, hip: 0.08, moveSpread: 0.1, airSpread: 0.3, recoil: [0.07, 0.01], climb: 1, recover: 3, range: 0.997, pen: 2.6, speed: 0.86, auto: false, bolt: true, ads: 0.36, armorPen: 0.8, att: ['muzzle', 'mag'], scopes: ['x6', 'x4', 'x8'], snd: 'sniper', model: 'awm', desc: 'ملك القنّاصات: طلقة واحدة في الجسد تُسقط أي خصم تقريباً.' },
  uqab: { name: 'Kar98k', cls: 'sniper', slot: 1, dmg: 105, head: 2.5, rpm: 48, mag: 5, reserve: 30, reload: 2.9, spread: 0.0005, hip: 0.06, moveSpread: 0.04, airSpread: 0.08, recoil: [0.055, 0.01], climb: 1, recover: 4, range: 0.995, pen: 2.1, speed: 0.95, auto: false, bolt: true, ads: 0.3, armorPen: 0.6, att: ['muzzle'], scopes: ['x6', 'iron', 'x2', 'x4', 'x8'], snd: 'sniper', model: 'kar', desc: 'قنّاصة كلاسيكية خشبية: الرأس بطلقة، والجسد باثنتين.' },
  tabuk: { name: 'تبوك', cls: 'sniper', slot: 1, dmg: 92, head: 2.45, rpm: 150, mag: 10, reserve: 30, reload: 3.1, spread: 0.0005, hip: 0.07, moveSpread: 0.07, airSpread: 0.22, recoil: [0.05, 0.012], climb: 1, recover: 4.5, range: 0.995, pen: 2.3, speed: 0.9, auto: false, ads: 0.32, armorPen: 0.65, att: ['muzzle'], scopes: ['x6', 'x4', 'x8'], snd: 'sniperSemi', model: 'dmr', desc: 'قنّاصة تبوك العراقية نصف الآلية: عشر طلقات سريعة بمنظار ×6.' },
  // ---------- مسدسات ----------
  dijla: { name: 'Glock 17', cls: 'pistol', slot: 2, dmg: 26, head: 2.1, rpm: 420, mag: 15, reserve: 75, reload: 1.7, spread: 0.0035, hip: 0.012, moveSpread: 0.025, airSpread: 0.07, recoil: [0.022, 0.006], climb: 1, recover: 9, range: 0.9, pen: 1, speed: 1.02, auto: false, ads: 0.14, armorPen: 0.2, att: [], scopes: ['iron', 'dot'], snd: 'pistol', model: 'glock', desc: 'مسدس موثوق بمخزن كبير.' },
  nisr: { name: 'Desert Eagle', cls: 'pistol', slot: 2, dmg: 55, head: 2.1, rpm: 220, mag: 7, reserve: 35, reload: 2.1, spread: 0.0035, hip: 0.02, moveSpread: 0.05, airSpread: 0.11, recoil: [0.06, 0.012], climb: 1, recover: 5, range: 0.93, pen: 1.8, speed: 1.0, auto: false, ads: 0.17, armorPen: 0.4, att: [], scopes: ['iron', 'dot'], snd: 'pistolHeavy', model: 'deagle', desc: 'مسدس ثقيل: طلقة رأس قاتلة.' },
  zaeem: { name: 'Glock 18C', cls: 'pistol', slot: 2, dmg: 21, head: 2.0, rpm: 900, mag: 18, reserve: 90, reload: 1.9, spread: 0.006, hip: 0.014, moveSpread: 0.025, airSpread: 0.07, recoil: [0.012, 0.008], climb: 1, recover: 9, range: 0.86, pen: 0.8, speed: 1.02, auto: true, ads: 0.14, armorPen: 0.2, att: [], scopes: ['iron'], snd: 'pistol', model: 'auto', desc: 'مسدس آلي سريع للمواجهات القريبة.' },
  furat: { name: 'R1895', cls: 'pistol', slot: 2, dmg: 48, head: 2.1, rpm: 170, mag: 6, reserve: 36, reload: 2.5, spread: 0.003, hip: 0.018, moveSpread: 0.04, airSpread: 0.1, recoil: [0.05, 0.01], climb: 1, recover: 6, range: 0.94, pen: 1.4, speed: 1.0, auto: false, ads: 0.16, armorPen: 0.35, att: [], scopes: ['iron'], snd: 'revolver', model: 'revolver', desc: 'مسدس دوّار عتيق دقيق وقوي.' },
  // ---------- سلاح أبيض ----------
  khanjar: { name: 'خنجر', cls: 'knife', slot: 3, dmg: 45, backDmg: 120, rpm: 110, mag: 0, reserve: 0, range: 1.8, speed: 1.1, auto: true, ads: 0.1, att: [], scopes: [], snd: 'knife', model: 'knife' },
};

// المناظير: mag التكبير (مجال الرؤية = 2·atan(tan(الأساس/2)/mag)) · sens مضاعف الحساسية · overlay عدسة كاملة
export const SCOPES = {
  iron: { name: 'تصويب حديدي', short: 'حديدي', mag: 1.15, overlay: false },
  dot: { name: 'نقطة حمراء', short: 'نقطة', mag: 1.25, overlay: false, reticle: 'dot' },
  holo: { name: 'هولوغرافي', short: 'هولو', mag: 1.25, overlay: false, reticle: 'holo' },
  x2: { name: 'مكبّر ×2', short: '×2', mag: 2, overlay: false, reticle: 'x2' },
  x3: { name: 'منظار ×3', short: '×3', mag: 3, overlay: true, reticle: 'chevron' },
  x4: { name: 'منظار ×4', short: '×4', mag: 4, overlay: true, reticle: 'acog' },
  x6: { name: 'منظار ×6 (3–6 متغيّر)', short: '×6', mag: 6, overlay: true, reticle: 'mil', zoom: [3, 6] },
  x8: { name: 'منظار ×8 (4–8 متغيّر)', short: '×8', mag: 8, overlay: true, reticle: 'sniper', zoom: [4, 8] },
};

// الملحقات: تأثيرها على الارتداد والصوت والمخزن
export const ATTACH = {
  muzzle: {
    none: { name: 'بلا', v: 1, h: 1 },
    comp: { name: 'معوِّض', v: 0.78, h: 0.85, desc: 'يخفّض صعود السلاح' },
    flash: { name: 'مخفي اللهب', v: 0.88, h: 0.9, noFlash: true, desc: 'يخفي وميض الفوهة' },
    supp: { name: 'كاتم صوت', v: 0.95, h: 0.95, quiet: true, desc: 'لا تظهر على رادار العدو' },
  },
  grip: {
    none: { name: 'بلا', v: 1, h: 1 },
    vert: { name: 'مقبض عمودي', v: 0.82, h: 0.95, desc: 'ثبات عمودي' },
    angled: { name: 'مقبض مائل', v: 0.95, h: 0.82, ads: 0.85, desc: 'تصويب أسرع' },
    half: { name: 'نصف مقبض', v: 0.9, h: 0.9, rec: 1.15, desc: 'رجوع أسرع' },
  },
  mag: {
    std: { name: 'عادي', mul: 1 },
    ext: { name: 'مخزن موسّع', mul: 1.4, reload: 1.06, desc: 'طلقات أكثر' },
  },
};

export const NADES = {
  frag: { name: 'رمّانة', fuse: 4, radius: 4.6, dmg: 150, desc: 'تنفجر بعد 4 ثوانٍ تقريباً — مداها قصير ويمكنك الهرب منها.' },
  smoke: { name: 'دخانية', fuse: 2, radius: 4.8, life: 18, desc: 'تحجب الرؤية 18 ثانية.' },
  flash: { name: 'صاعقة', fuse: 2.5, radius: 16, desc: 'تعمي من يراها.' },
  molotov: { name: 'مولوتوف', fuse: 2.2, radius: 2.6, life: 8, dps: 22, desc: 'تشعل الأرض 8 ثوانٍ.' },
};

const PRIM_ALL = ['saif556', 'rafid', 'battar', 'shihab', 'zawba', 'asifa', 'raad', 'iasar', 'tufan', 'mirsad', 'nadhur', 'tabuk', 'saqr', 'uqab'];
export const SECONDARIES = ['dijla', 'nisr', 'zaeem', 'furat'];
// أوضاع اللعب: كلها على خريطة سوق المجاهدين
// rules: tdm = إحياء بعد السقوط والفائز الأقل موتاً عند انتهاء الوقت · rounds = جولات بلا إحياء
export const MODES = {
  tdm: { name: 'اشتباك الفرق', sub: 'إحياء فوري · الأكثر قتلاً يفوز', desc: 'تعود إلى الحياة بعد سقوطك. عند انتهاء الوقت يفوز الفريق الذي أسقط أعداءً أكثر.', rules: 'tdm', time: 600, primaries: PRIM_ALL, icon: 'tdm' },
  dom: { name: 'السيطرة', sub: 'إحياء · نقاط سيطرة', desc: 'ثلاث نقاط على الخريطة تتغيّر في كل جولة (نقطة واحدة إذا كان 2 ضد 2 أو أقل). قف في الدائرة حتى تسيطر عليها؛ كل ثانية سيطرة نقطة، والأكثر نقاطاً يفوز.', rules: 'dom', time: 600, primaries: PRIM_ALL, icon: 'tdm' },
  lobby: { name: 'اللوبي', sub: 'تجوّل ومهامّ', desc: 'تجوّل في السوق، وتحدّث مع الناس، واعمل في مهامّهم.', rules: 'lobby', time: 1e9, primaries: [], icon: 'tdm', hidden: true },
  rounds: { name: 'الجولات التكتيكية', sub: 'بلا إحياء · جولات', desc: 'حياة واحدة في كل جولة. خطّط مع فريقك واستعمل القنابل بذكاء.', rules: 'rounds', primaries: PRIM_ALL, icon: 'rounds' },
};
export const MODE_ORDER = ['tdm', 'dom', 'rounds'];

const NADE_KINDS = ['frag', 'smoke', 'flash', 'molotov'];
const pick = (a, rng) => a[Math.floor(rng() * a.length)];
export function defaultLoadout(mode, rng = Math.random) {
  const M = MODES[mode] || MODES.tdm, P = M.primaries;
  const primary = P.length ? pick(P, rng) : null;
  const wd = primary && WEAPONS[primary];
  const sc = wd ? wd.scopes : [];
  // البوتات تفضّل المناظير المتوسطة
  const scope = sc.length ? (wd.cls === 'sniper' ? 'x6' : pick(sc.filter(s => s !== 'iron').length ? sc.filter(s => s !== 'iron' && s !== 'x6' && s !== 'x8') : sc, rng)) : null;
  const att = {};
  if (wd) for (const k of wd.att) att[k] = pick(Object.keys(ATTACH[k]), rng);
  return { primary, scope: scope || (sc[0] || null), att, secondary: pick(SECONDARIES, rng), nades: [pick(NADE_KINDS, rng), pick(NADE_KINDS, rng)] };
}
export function validLoadout(l, mode) {
  const M = MODES[mode] || MODES.tdm, P = M.primaries;
  l = l || {};
  const out = { primary: P.includes(l.primary) ? l.primary : (P[0] || null), secondary: SECONDARIES.includes(l.secondary) ? l.secondary : 'dijla', nades: [], att: {} };
  const wd = out.primary ? WEAPONS[out.primary] : null;
  const sc = wd ? wd.scopes : [];
  out.scope = sc.includes(l.scope) ? l.scope : wd && wd.cls === 'sniper' ? 'x6' : wd && wd.cls === 'dmr' ? 'x4' : (sc.includes('dot') ? 'dot' : sc[0] || null);
  if (wd) for (const k of wd.att) { const v = l.att && l.att[k]; out.att[k] = ATTACH[k][v] ? v : Object.keys(ATTACH[k])[0]; }
  for (const n of (l.nades || []).slice(0, 2)) if (NADES[n]) out.nades.push(n);
  if (l.supply) out.supply = cleanSupply(l.supply);
  return out;
}
// مخزون القيم المرسل من اللاعب (عتاد بأنواعه، قنابل، مواد صحية)
const AMMO_T = ['auto', 'shot', 'pist', 'dmr', 'snip'];
export function cleanSupply(s) {
  const n = v => Math.max(0, Math.min(99999, Math.floor(+v || 0)));
  const o = { ammo: {}, nades: {}, meds: { b: n(s.meds && s.meds.b), s: n(s.meds && s.meds.s) } };
  for (const t of AMMO_T) o.ammo[t] = n(s.ammo && s.ammo[t]);
  for (const k of Object.keys(NADES)) o.nades[k] = n(s.nades && s.nades[k]);
  return o;
}
export const CLS_AMMO = { rifle: 'auto', smg: 'auto', lmg: 'auto', shotgun: 'shot', pistol: 'pist', dmr: 'dmr', sniper: 'snip' };
// خصائص السلاح بعد الملحقات
export function withAtt(id, att) {
  const wd = WEAPONS[id]; if (!wd || !att) return wd;
  const mz = ATTACH.muzzle[att.muzzle] || ATTACH.muzzle.none, gr = ATTACH.grip[att.grip] || ATTACH.grip.none, mg = ATTACH.mag[att.mag] || ATTACH.mag.std;
  return {
    ...wd,
    recoil: [wd.recoil[0] * mz.v * gr.v, wd.recoil[1] * mz.h * gr.h],
    recover: wd.recover * (gr.rec || 1),
    ads: wd.ads * (gr.ads || 1),
    mag: wd.mag ? Math.round(wd.mag * mg.mul) : 0,
    reload: wd.reload * (mg.reload || 1),
    quiet: !!mz.quiet, noFlash: !!mz.noFlash,
  };
}
export const CLASS_NAME = { rifle: 'رشاش هجومي', smg: 'رشاش قصير', shotgun: 'بندقية صيد', lmg: 'رشاش ثقيل', dmr: 'رماية دقيقة', sniper: 'قنّاصة', pistol: 'مسدس', knife: 'سلاح أبيض' };
