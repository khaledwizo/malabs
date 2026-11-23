// الإعدادات: تُحفظ محلياً، وكل تغيير يُبث لمن يستمع
const KEY = 'rafidain.settings.v2';

export const RES_OPTIONS = [
  { id: 'auto', label: 'تلقائي' },
  { id: '0.5', label: '50%' }, { id: '0.67', label: '67%' }, { id: '0.75', label: '75%' },
  { id: '1', label: 'أصلية 100%' }, { id: '1.5', label: '150% (تنعيم)' }, { id: '2', label: 'فائقة' },
  { id: '480', label: '480p' }, { id: '720', label: '720p' }, { id: '1080', label: '1080p' }, { id: '1440', label: '1440p' },
];
export const FPS_OPTIONS = [
  { id: 30, label: '30' }, { id: 40, label: '40' }, { id: 60, label: '60' }, { id: 90, label: '90' }, { id: 120, label: '120' },
  { id: 0, label: 'تزامن الشاشة' }, { id: -1, label: 'أقصى ما تدعمه الشاشة' },
];
// مستويات الرسوم: الظلال، الدقة، الجسيمات، المطر، التوهج، الانعكاسات
export const QUALITY = {
  low: { label: 'منخفضة', shadow: 0, tex: 256, aniso: 1, particles: 0.45, decals: 50, aa: false, details: 0, rain: 2500, bloom: false, env: 64, dprCap: 1, cloth: false },
  medium: { label: 'متوسطة', shadow: 1024, tex: 512, aniso: 2, particles: 0.75, decals: 100, aa: false, details: 1, rain: 5000, bloom: false, env: 128, dprCap: 1.5, cloth: true },
  high: { label: 'عالية', shadow: 2048, tex: 1024, aniso: 4, particles: 1, decals: 160, aa: true, details: 2, rain: 9000, bloom: true, env: 256, dprCap: 2, cloth: true },
  ultra: { label: 'فائقة', shadow: 4096, tex: 1024, aniso: 8, particles: 1.3, decals: 240, aa: true, details: 3, rain: 14000, bloom: true, env: 256, dprCap: 3, cloth: true },
};
export const WEATHER_OPTIONS = [
  { id: 'random', label: 'متغيّر', sub: 'عجاج ← مطر ← نهار ← غروب ← ليل' }, { id: 'day', label: 'نهار', sub: 'شمس الظهيرة' }, { id: 'sunset', label: 'غروب', sub: 'ذهبي دافئ' },
  { id: 'storm', label: 'عاصفة', sub: 'مطر وبرق' }, { id: 'horror', label: 'ليلة مرعبة', sub: 'ضباب وظلال' }, { id: 'dust', label: 'عجاج', sub: 'غبار وريح ترابية' },
];

export const DEFAULTS = {
  res: 'auto', fps: 0, showFps: true, quality: 'auto', fov: 82,
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

// الجودة التلقائية حسب الجهاز
export function qualityId() {
  if (Settings.quality !== 'auto') return Settings.quality;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (mobile) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}
export function quality() { return QUALITY[qualityId()]; }
