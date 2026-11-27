// الإعدادات: تُحفظ محلياً، وكل تغيير يُبث لمن يستمع
const KEY = 'rafidain.settings.v2';

export const RES_OPTIONS = [
  { id: 'auto', label: 'تلقائي' },
  { id: '0.5', label: '50%' }, { id: '0.67', label: '67%' }, { id: '0.75', label: '75%' },
  { id: '1', label: 'أصلية 100%' }, { id: '1.5', label: '150% (تنعيم)' }, { id: '2', label: 'فائقة' },
  { id: '480', label: '480p' }, { id: '720', label: '720p' }, { id: '1080', label: '1080p' }, { id: '1440', label: '1440p' },
];
export const FPS_OPTIONS = [
  { id: 'q', label: 'حسب الجودة' }, { id: 30, label: '30' }, { id: 45, label: '45' }, { id: 60, label: '60' }, { id: 90, label: '90' }, { id: 120, label: '120' },
  { id: 0, label: 'تزامن الشاشة' }, { id: -1, label: 'أقصى ما تدعمه الشاشة' },
];
// مستويات الرسوم الثلاثة (ROADMAP القسم 1): الدقة، الفريمات، الظلال، مسافة الرؤية، كثافة الناس — تُكتشف تلقائياً وتتعدّل يدوياً
// res: نسبة من دقة الشاشة · fps: حدّ الفريمات · shadow: حجم خريطة الظل (0 = بدون) · shExt: نصف مدى الظل (قريبة/كاملة)
// view: مسافة رسم المباني (م) · detail: مسافة رسم التفاصيل الصغيرة · npc: مسافة رسم الناس · dens: كثافة المارّة والحيوانات
export const QUALITY = {
  low: { label: 'واطئة', res: 0.6, fps: 30, shadow: 0, shExt: 0, view: 75, detail: 32, npc: 26, dens: 0.35, tex: 256, aniso: 1, particles: 0.45, decals: 50, aa: false, details: 0, rain: 2500, bloom: false, env: 64, dprCap: 1.4, cloth: false },
  medium: { label: 'متوسطة', res: 0.8, fps: 45, shadow: 1024, shExt: 30, view: 120, detail: 55, npc: 36, dens: 0.7, tex: 512, aniso: 2, particles: 0.75, decals: 100, aa: false, details: 1, rain: 5000, bloom: false, env: 128, dprCap: 1.8, cloth: true },
  high: { label: 'عالية', res: 1, fps: 60, shadow: 2048, shExt: 55, view: 190, detail: 90, npc: 60, dens: 1, tex: 1024, aniso: 4, particles: 1, decals: 160, aa: true, details: 2, rain: 9000, bloom: true, env: 256, dprCap: 2, cloth: true },
};
export const QUALITY_ROWS = [['res', 'الدقة', v => Math.round(v * 100) + '%'], ['fps', 'الفريمات', v => v], ['shadow', 'الظلال', (v, q) => !v ? 'بدون' : q.shExt < 40 ? 'قريبة' : 'كاملة'], ['view', 'مسافة الرؤية', v => v < 90 ? 'قصيرة' : v < 150 ? 'متوسطة' : 'بعيدة'], ['dens', 'الكثافة', v => v < 0.5 ? 'قليلة' : v < 0.9 ? 'متوسطة' : 'كاملة']];
export const WEATHER_OPTIONS = [
  { id: 'random', label: 'متغيّر', sub: 'عجاج ← مطر ← نهار ← غروب ← ليل' }, { id: 'day', label: 'نهار', sub: 'شمس الظهيرة' }, { id: 'sunset', label: 'غروب', sub: 'ذهبي دافئ' },
  { id: 'storm', label: 'عاصفة', sub: 'مطر وبرق' }, { id: 'horror', label: 'ليلة مرعبة', sub: 'ضباب وظلال' }, { id: 'dust', label: 'عجاج', sub: 'غبار وريح ترابية' },
];

export const DEFAULTS = {
  res: 'auto', fps: 'q', showFps: true, quality: 'auto', dynRes: true, fov: 82,
  // التصويب (على طريقة ببجي): الكاميرا، التصويب القريب، المناظير البعيدة
  sens: 1, adsSens: 1, scopeSens: 1, invertY: false, adsMode: 'mixed', aimAssist: true, autoFire: false, leftFire: true, gyro: 'off', gyroSens: 1, gyroInvX: false, gyroInvY: false, view: 'tpp', nameTags: true, fx: false, fxSSR: true, fxAO: true, fxRays: true, fxGrade: true,
  touchSize: 1, hudAlpha: 0.9, crosshair: 'cross', crossColor: '#5dffb0',
  volume: 0.85, music: 0.4, talk: 0.9, haptics: true,
  name: 'لاعب', char: 'khaled', mode: 'tdm', teamSize: 4, difficulty: 'normal', rounds: 5, tdmTime: 600, roundTime: 120, weather: 'random', team: 0,
};

const listeners = new Set();
export const Settings = { ...DEFAULTS };
try {
  const old = JSON.parse(localStorage.getItem('rafidain.settings.v1') || '{}');
  for (const k of ['res', 'fps', 'showFps', 'quality', 'name', 'char', 'volume', 'haptics', 'crossColor']) if (k in old) Settings[k] = old[k];
  Object.assign(Settings, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch (e) { }

export function setSetting(k, v) {
  Settings[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(Settings)); } catch (e) { }
  for (const f of listeners) f(k, v);
}
export function onSetting(f) { listeners.add(f); return () => listeners.delete(f); }

// الجودة التلقائية: نوع المعالج الرسومي + عدد الأنوية + الذاكرة (وبعدها الدقة تتكيّف أثناء اللعب — main.js)
let gpuName = null;
export function gpu() {
  if (gpuName !== null) return gpuName; gpuName = '';
  try { const gl = document.createElement('canvas').getContext('webgl'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); gpuName = e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) { }
  return gpuName;
}
export function autoQuality() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4, g = gpu();
  if (!mobile) return cores >= 8 ? 'high' : 'medium';
  // معالجات رسومية ضعيفة معروفة → واطئة ؛ القوية الحديثة → عالية
  if (/Mali-(4|T[67]|G31|G51|G52|G57)|Adreno \(TM\) (3|4|5[0-3])|PowerVR|SGX/i.test(g) || mem <= 3 || cores <= 4) return 'low';
  if (/Adreno \(TM\) (7[3-9]|8)|Mali-G7[1-9]\d|Immortalis|Xclipse/i.test(g) && mem >= 8) return 'high';
  return 'medium';
}
export function qualityId() {
  const q = Settings.quality === 'ultra' ? 'high' : Settings.quality; // «فائقة» القديمة صارت «عالية»
  return QUALITY[q] ? q : autoQuality();
}
export function quality() { return QUALITY[qualityId()]; }
// حدّ الفريمات الفعلي: «حسب الجودة» = فريمات المستوى
export function fpsCap() { const f = Settings.fps; return f === 'q' || f == null ? quality().fps : +f; }
