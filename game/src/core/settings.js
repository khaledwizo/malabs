// الإعدادات: تُحفظ محلياً، وكل تغيير يُبث لمن يستمع
const KEY = 'rafidain.settings.v1';

export const RES_OPTIONS = [
  { id: 'auto', label: 'تلقائي' },
  { id: '0.5', label: '50%' }, { id: '0.67', label: '67%' }, { id: '0.75', label: '75%' },
  { id: '1', label: 'أصلية 100%' }, { id: '1.5', label: '150% (تنعيم)' }, { id: '2', label: '200% (فائق)' },
  { id: '480', label: '480p' }, { id: '720', label: '720p' }, { id: '1080', label: '1080p' }, { id: '1440', label: '1440p' }, { id: '2160', label: '4K' },
];
export const FPS_OPTIONS = [
  { id: 30, label: '30' }, { id: 60, label: '60' }, { id: 90, label: '90' }, { id: 120, label: '120' },
  { id: 144, label: '144' }, { id: 240, label: '240' }, { id: 0, label: 'تزامن الشاشة' }, { id: -1, label: 'غير محدود' },
];
export const QUALITY = {
  low: { label: 'منخفضة', shadow: 0, tex: 256, aniso: 1, particles: 0.4, draw: 70, decals: 40, aa: false, details: 0 },
  medium: { label: 'متوسطة', shadow: 1024, tex: 512, aniso: 2, particles: 0.7, draw: 110, decals: 80, aa: false, details: 1 },
  high: { label: 'عالية', shadow: 2048, tex: 1024, aniso: 4, particles: 1, draw: 160, decals: 140, aa: true, details: 2 },
  ultra: { label: 'فائقة', shadow: 4096, tex: 1024, aniso: 8, particles: 1.3, draw: 220, decals: 220, aa: true, details: 3 },
};

export const DEFAULTS = {
  res: 'auto', fps: 0, showFps: true, quality: 'auto', fov: 78, sens: 1, adsSens: 0.7, invertY: false,
  volume: 0.8, music: 0.4, touchSize: 1, autoFire: false, crosshair: 'cross', crossColor: '#5dffb0',
  difficulty: 'normal', name: 'لاعب', char: 'khaled', haptics: true, mode: 'epic', rounds: 9, bots: true,
  team: 0, gyro: false,
};

const listeners = new Set();
export const Settings = { ...DEFAULTS };
try { Object.assign(Settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { }

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
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return cores >= 8 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}
export function quality() { return QUALITY[qualityId()]; }
