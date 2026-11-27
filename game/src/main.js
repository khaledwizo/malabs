// نقطة البداية: المحرك، العالم، الطقس، الواجهة، والحلقة
import * as THREE from 'three';
import { Save } from './core/save.js';
import { Settings, onSetting, quality, qualityId, fpsCap } from './core/settings.js';
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Builder } from './world/builder.js';
import { buildSouq } from './world/maps/souq.js';
import { Zones } from './world/zones.js';
import { buildPois } from './game/pois.js';
import { gfxKit, makeSky, buildWorldMeshes, setupLights } from './gfx/scene.js';
import { Weather } from './gfx/weather.js';
import { Post } from './gfx/post.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { HUD } from './ui/hud.js';
import { Social } from './net/social.js';
import { Central } from './net/central.js';
import { buildGun } from './game/gunmodels.js';
import { Intro, introSeen } from './game/intro.js';

Save.boot(); // الحفظ الموحّد: يرجّع التقدّم إذا انمسحت بيانات المتصفح (ويعيد التحميل مرّة وحدة)
Social.load();
Central.init();
Social.start(() => ({ name: Settings.name, char: Settings.char }));
const canvas = document.getElementById('gl');
const Q = quality();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = Q.shadow > 0; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, Math.max(260, Q.view * 1.6 + 60));
const kit = gfxKit(Q);
const B = new Builder(kit);
const info = buildSouq(B);
const world = B.finish();
const meshes = buildWorldMeshes(B, kit, info);
info.pois = buildPois(B.signs, world.doors); // أيقونات المحلات على الخريطة + الـGPS
scene.add(meshes);
const L = setupLights(scene, info, Q, info.bounds);
Zones.init(scene); Zones.add({ id: 'souq', name: 'مدينة السوق', rect: info.mapRect || info.bounds, keep: true, obj: meshes });
const sky = makeSky(info, info.sun.dir); scene.add(sky);
scene.fog = new THREE.FogExp2(info.sky.fog, info.sky.fogDensity);

// الدقة: نسبة من دقة الجهاز أو ارتفاع ثابت
let zoneT = 0, resText = '', dynK = 1, dynT = 0, dynGood = 0;
function applyRes() {
  const dpr = devicePixelRatio || 1, r = String(Settings.res);
  let ratio;
  // تلقائية: نسبة مستوى الجودة (60/80/100%) × الدقة المتكيّفة
  if (r === 'auto') ratio = Math.min(dpr, Q.dprCap || 1.5) * (Q.res || 1) * dynK;
  else if (+r <= 4) ratio = dpr * +r;
  else ratio = +r / innerHeight;
  // ما نرسم بأكثر من دقة الشاشة الأصلية على الموبايل (الزيادة ما تبين وتثقّل وتسبّب لاگ)، وبالحاسبة حد أقصى 2×
  ratio = Math.max(0.25, Math.min(ratio, Math.max(dpr, 2), 3));
  renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new THREE.Vector2()); resText = `${s.x}×${s.y}`;
  if (game && game.post) game.post.resize();
}
let game = null;
addEventListener('resize', applyRes);
onSetting((k, v) => { if (k === 'res') applyRes(); if (k === 'music') Audio.setMusic(v); if (/^fx/.test(k) && game) mkPost(); });

Input.init(canvas);
const weather = new Weather({ renderer, scene, camera, info, Q, L, sky, meshes, world, kit });
game = new Game({ renderer, scene, camera, world, info, Q, sunDir: weather.sunDir, sky, meshes, lights: L, weather });
Central.onMove = b => game.moveToServer(b); // دخل لاعب ثاني لمعركتي: تنتقل للسيرفر المركزي
const fxOpt = () => Settings.fx ? { ao: Settings.fxAO !== false, ssr: Settings.fxSSR !== false, rays: Settings.fxRays !== false, grade: Settings.fxGrade !== false } : null;
const mkPost = () => { game.post = new Post(renderer, Q, fxOpt()); game.post.sunDir = weather.sunDir; game.post.resize(); };
mkPost();
weather.set('menu');
applyRes();
game.onAnim = (dt, t) => {
  sky.material.uniforms.t.value = t; meshes.userData.waterMat.uniforms.t.value = t; sky.position.copy(camera.position);
  weather.update(dt, t); L.follow && L.follow(camera, weather.sunDir); // ظل حادّ حول اللاعب
  meshes.userData.stream(camera.position.x, camera.position.z, dt, game.viewMul || 1); // تحميل المناطق حسب المسافة
  if ((zoneT -= dt) <= 0) { zoneT = 1; Zones.update(camera.position.x, camera.position.z); }
  // الدقة المتكيّفة: إذا نزلت الفريمات عن هدف المستوى تنخفض الدقة خطوة خطوة (لحد 60% من دقة المستوى)، وترجع لمّا يخف الحمل
  if (Settings.dynRes !== false && String(Settings.res) === 'auto' && game.sim && !game.paused && (dynT += dt) > 2) {
    dynT = 0; const want = fpsCap() || 60, f = Loop.fps;
    if (f && f < want * 0.82 && dynK > 0.6) { dynK = Math.max(0.6, dynK - 0.1); dynGood = 0; applyRes(); }
    else if (f >= want * 0.96 && dynK < 1 && ++dynGood >= 3) { dynK = Math.min(1, dynK + 0.05); dynGood = 0; applyRes(); }
  }
  if (game.post.enabled) { const P = game.post; P.grade = weather.grade; P.wet = weather.wet || 0; P.rayK = weather.cur ? Math.max(0, 1 - (weather.cur.night || 0)) * (1 + (weather.dustNow || 0)) : 1; }
};
UI.init(game);
const wake = () => Audio.init();
document.addEventListener('pointerdown', wake); document.addEventListener('touchstart', wake, { passive: true }); document.addEventListener('keydown', wake);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.sim && !game.paused && !game.sim.online) game.pause();
  // طلعت من اللعبة (رجعت للشاشة الرئيسية أو قفلت الشاشة): الموسيقى وكل الأصوات تسكت، وترجع وياك
  Audio.background(document.hidden);
});
window.addEventListener('pagehide', () => Audio.background(true));
window.addEventListener('pageshow', () => { if (!document.hidden) Audio.background(false); });
window.__rafidainBack = () => { if (intro && intro.active) { intro.finish(); return true; } if (UI.mapOpen) { UI.closeMap(); return true; } if (game.sim && !game.paused) { game.pause(); return true; } if (UI.screen && UI.screen !== 'home') { UI.back(); return true; } return false; };
window.__rafidainPause = () => { if (game.sim && !game.paused && !game.sim.online) game.pause(); };

// المقدّمة السينمائية عند أول فتح (ويمكن إعادتها من الإعدادات)
let intro = null;
function playIntro() {
  if (intro && intro.active) return;
  document.body.classList.add('introOn');
  intro = new Intro({ renderer, kit, onDone: () => { document.body.classList.remove('introOn'); intro = null; } });
  intro.start(); window.__intro = intro;
}
if (!introSeen() && !/[?&]nointro/.test(location.search)) playIntro();
let fpsT = 0, bootF = 0;
// نخفي شاشة التحميل بعد أول إطارات مرسومة
const bootOut = () => { const b = document.getElementById('boot'); if (b && !b.classList.contains('out')) { b.classList.add('out'); setTimeout(() => b.remove(), 700); } };
setTimeout(bootOut, 12000);
Loop.start((dt, now) => {
  if (++bootF === 4) bootOut();
  if (intro && intro.active) { intro.frame(dt); return; }
  game.frame(dt, now);
  fpsT -= dt; if (fpsT <= 0) { fpsT = 0.5; HUD.fps(`FPS ${Math.round(Loop.fps)} · ${Loop.ms.toFixed(1)}ms · ${resText}`); }
});
window.__R = { Save, Zones, meshes, Q, playIntro, Central, Audio, renderer, scene, camera, world, game, UI, HUD, Loop, Input, Settings, Social, THREE, buildGun, weather, stats: () => renderer.info.render };
