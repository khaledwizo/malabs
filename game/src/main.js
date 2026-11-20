// نقطة البداية: المحرك، العالم، الواجهة، والحلقة
import * as THREE from 'three';
import { Settings, onSetting, quality, qualityId } from './core/settings.js';
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Builder } from './world/builder.js';
import { buildSouq } from './world/maps/souq.js';
import { gfxKit, makeSky, buildWorldMeshes, setupLights } from './gfx/scene.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';

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
  if (r === 'auto') ratio = { low: Math.min(dpr, 1) * 0.85, medium: Math.min(dpr, 1.5), high: Math.min(dpr, 2), ultra: dpr }[qualityId()] || 1;
  else if (+r <= 4) ratio = dpr * +r;
  else ratio = +r / innerHeight;
  ratio = Math.max(0.25, Math.min(ratio, 4));
  renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new THREE.Vector2()); resText = `${s.x}×${s.y}`;
}
addEventListener('resize', applyRes); applyRes();
onSetting(k => { if (k === 'res') applyRes(); });

Input.init(canvas);
const game = new Game({ renderer, scene, camera, world, info, Q, sunDir: L.sunDir, sky, meshes });
game.onAnim = (dt, t) => { sky.material.uniforms.t.value = t; meshes.userData.waterMat.uniforms.t.value = t; sky.position.copy(camera.position); };
UI.init(game);
document.addEventListener('pointerdown', () => Audio.init(), { once: false });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.sim && !game.paused) game.pause(); });
window.__rafidainBack = () => { if (game.sim && !game.paused) { game.pause(); return true; } if (UI.screen && UI.screen !== 'menu') { UI.back(); return true; } return false; };
window.__rafidainPause = () => { if (game.sim && !game.paused) game.pause(); };

let fpsT = 0;
Loop.start((dt, now) => {
  game.frame(dt, now);
  fpsT -= dt; if (fpsT <= 0) { fpsT = 0.5; UI.fps(`FPS ${Math.round(Loop.fps)} · ${Loop.ms.toFixed(1)}ms · ${resText}`); }
});
window.__R = { renderer, scene, camera, world, game, UI, Loop, Input, Settings, THREE, stats: () => renderer.info.render };
