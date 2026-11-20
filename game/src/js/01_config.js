// ===================== الإعدادات الثابتة =====================
const T = 32; // حجم البلاطة بوحدات العالم
const DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
const DIR_OF = { N: 0, E: 1, S: 2, W: 3 };
const DX8 = [1, -1, 0, 0, 1, 1, -1, -1];
const DY8 = [0, 0, 1, -1, 1, -1, 1, -1];

// خيارات الدقة: kind=scale نسبة من الدقة الأصلية للجهاز، kind=p عدد البكسلات على الضلع الأقصر
const RES_OPTIONS = [
  { id: 'native', label: 'أصلية للجهاز', kind: 'scale', v: 1 },
  { id: 'ss150', label: 'فائقة ×1.5 (تنعيم فائق)', kind: 'scale', v: 1.5 },
  { id: 'ss200', label: 'فائقة ×2 (تنعيم فائق)', kind: 'scale', v: 2 },
  { id: 'p2160', label: '4K — 2160p', kind: 'p', v: 2160 },
  { id: 'p1440', label: '2K — 1440p', kind: 'p', v: 1440 },
  { id: 'p1080', label: 'Full HD — 1080p', kind: 'p', v: 1080 },
  { id: 'p900', label: '900p', kind: 'p', v: 900 },
  { id: 'p720', label: 'HD — 720p', kind: 'p', v: 720 },
  { id: 'p540', label: '540p', kind: 'p', v: 540 },
  { id: 'p480', label: '480p', kind: 'p', v: 480 },
  { id: 'p360', label: '360p', kind: 'p', v: 360 },
  { id: 'p240', label: '240p (ريترو)', kind: 'p', v: 240 },
  { id: 'half', label: 'نصف الأصلية ×0.5', kind: 'scale', v: 0.5 },
];

// 0 = غير محدود، -1 = مزامنة مع الشاشة
const FPS_OPTIONS = [
  { id: 'unl', label: 'غير محدود ∞', v: 0 },
  { id: 'vsync', label: 'مزامنة الشاشة (VSync)', v: -1 },
  { id: 'f30', label: '30', v: 30 }, { id: 'f60', label: '60', v: 60 }, { id: 'f90', label: '90', v: 90 },
  { id: 'f120', label: '120', v: 120 }, { id: 'f144', label: '144', v: 144 }, { id: 'f165', label: '165', v: 165 },
  { id: 'f240', label: '240', v: 240 }, { id: 'f360', label: '360', v: 360 }, { id: 'f500', label: '500', v: 500 },
  { id: 'f1000', label: '1000', v: 1000 },
];

const QUALITY = {
  low: { label: 'منخفضة', lightScale: 0.25, glowScale: 0.2, shadows: false, playerRays: 0, lampRays: 0, coneRays: 12, bloom: 0, particles: 0.35, dust: 0, substeps: 1, decor: false },
  medium: { label: 'متوسطة', lightScale: 0.4, glowScale: 0.25, shadows: true, playerRays: 120, lampRays: 96, coneRays: 20, bloom: 1, particles: 0.7, dust: 24, substeps: 1, decor: true },
  high: { label: 'عالية', lightScale: 0.5, glowScale: 0.25, shadows: true, playerRays: 240, lampRays: 180, coneRays: 32, bloom: 2, particles: 1, dust: 60, substeps: 2, decor: true },
  ultra: { label: 'فائقة', lightScale: 0.75, glowScale: 0.33, shadows: true, playerRays: 480, lampRays: 300, coneRays: 56, bloom: 3, particles: 1.7, dust: 120, substeps: 2, decor: true },
  insane: { label: 'جنونية (أقصى طاقة)', lightScale: 1, glowScale: 0.5, shadows: true, playerRays: 900, lampRays: 540, coneRays: 96, bloom: 3, particles: 3, dust: 240, substeps: 4, decor: true },
};
const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra', 'insane'];

const ZOOMS = [
  { id: 'near', label: 'قريب', tiles: 10 },
  { id: 'mid', label: 'متوسط', tiles: 13 },
  { id: 'far', label: 'بعيد', tiles: 17 },
];

const DEFAULT_SETTINGS = {
  res: 'native', fps: 'unl', quality: 'high', zoom: 'mid', smooth: true, shake: true,
  stats: true, statsExt: false, music: 0.45, sfx: 0.8, touch: 'auto', touchSize: 1,
  minimap: true, aiDebug: false, lowLatency: false, autoTuned: false,
  whispers: 'few', haptics: true,
};

const PAL = {
  void: '#06080c', floor: '#23272e', floor2: '#272b33', seam: '#1a1d22', panel: '#2b3039',
  wallTop: '#3b414b', wallTop2: '#444b56', wallFront: '#1d2026', wallEdge: '#66707f', wallDark: '#101215',
  mint: '#4ff0d0', gold: '#ffd166', red: '#ff4545', amber: '#ffb347', yellow: '#ffe27a', violet: '#a77bff',
  magenta: '#ff3fa4', cyan: '#36e0ff', white: '#ffffff', laser: '#ff2d55', wireOff: '#1c3842', wireOn: '#36e0ff',
  lampWarm: '#ffc27a', lampCool: '#9fd8ff', lampRed: '#ff6a5a', ink: '#e9f1f4',
};
