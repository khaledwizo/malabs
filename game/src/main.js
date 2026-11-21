// نقطة البداية: المحرك، العالم، الطقس، الواجهة، والحلقة
import * as THREE from 'three';
import { Settings, onSetting, quality, qualityId } from './core/settings.js';
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Builder } from './world/builder.js';
import { buildSouq } from './world/maps/souq.js';
import { gfxKit, makeSky, buildWorldMeshes, setupLights } from './gfx/scene.js';
import { Weather } from './gfx/weather.js';
import { Post } from './gfx/post.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { HUD } from './ui/hud.js';
import { Social } from './net/social.js';
import { buildGun } from './game/gunmodels.js';
import { Intro, introSeen } from './game/intro.js';

Social.load();
Social.start(() => ({ name: Settings.name, char: Settings.char }));
const canvas = document.getElementById('gl');
const Q = quality();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = Q.shadow > 0; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 1200);
const kit = gfxKit(Q);
const B = new Builder(kit);
const info = buildSouq(B);
const world = B.finish();
const meshes = buildWorldMeshes(B, kit, info);
scene.add(meshes);
const L = setupLights(scene, info, Q, info.bounds);
const sky = makeSky(info, info.sun.dir); scene.add(sky);
scene.fog = new THREE.FogExp2(info.sky.fog, info.sky.fogDensity);

// الدقة: نسبة من دقة الجهاز أو ارتفاع ثابت
let resText = '';
function applyRes() {
  const dpr = devicePixelRatio || 1, r = String(Settings.res);
  let ratio;
  if (r === 'auto') ratio = Math.min(dpr, Q.dprCap || 1.5) * (qualityId() === 'low' ? 0.85 : 1);
  else if (+r <= 4) ratio = dpr * +r;
  else ratio = +r / innerHeight;
  ratio = Math.max(0.25, Math.min(ratio, 4));
  renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new THREE.Vector2()); resText = `${s.x}×${s.y}`;
  if (game && game.post) game.post.resize();
}
let game = null;
addEventListener('resize', applyRes);
onSetting((k, v) => { if (k === 'res') applyRes(); if (k === 'music') Audio.setMusic(v); });

Input.init(canvas);
const weather = new Weather({ renderer, scene, camera, info, Q, L, sky, meshes, world, kit });
game = new Game({ renderer, scene, camera, world, info, Q, sunDir: weather.sunDir, sky, meshes, lights: L, weather });
game.post = new Post(renderer, Q);
weather.set('menu');
applyRes();
game.onAnim = (dt, t) => {
  sky.material.uniforms.t.value = t; meshes.userData.waterMat.uniforms.t.value = t; sky.position.copy(camera.position);
  weather.update(dt, t); L.follow && L.follow(camera, weather.sunDir); // ظل حادّ حول اللاعب
  if (game.post.enabled) game.post.grade = weather.grade;
};
UI.init(game);
const wake = () => Audio.init();
document.addEventListener('pointerdown', wake); document.addEventListener('touchstart', wake, { passive: true }); document.addEventListener('keydown', wake);
document.addEventListener('visibilitychange', () => { if (document.hidden && game.sim && !game.paused && !game.sim.online) game.pause(); });
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
let fpsT = 0;
Loop.start((dt, now) => {
  if (intro && intro.active) { intro.frame(dt); return; }
  game.frame(dt, now);
  fpsT -= dt; if (fpsT <= 0) { fpsT = 0.5; HUD.fps(`FPS ${Math.round(Loop.fps)} · ${Loop.ms.toFixed(1)}ms · ${resText}`); }
});
window.__R = { playIntro, renderer, scene, camera, world, game, UI, HUD, Loop, Input, Settings, Social, THREE, buildGun, weather, stats: () => renderer.info.render };
