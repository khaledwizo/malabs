RAFIDAIN FRONT (جبهة الرافدين) — PROGRESS / نقطة الاستئناف
=========================================================
3D tactical FPS (Counter-Strike-like) in Arabic, three.js r187 bundled by esbuild into one HTML file.
Source: GitHub khaledwizo/malabs branch `rafidain-game` (folder game/), local /home/claude/rafidain.
Build: node tools/build.mjs  (esbuild from /opt/npm-tools; alias three -> vendor/three.module.js) -> dist/index.html (~1 MB)
Tests: test/simtest.mjs (headless sim, node), test/play.mjs, test/vm.mjs, test/spec.mjs (Playwright + swiftshader).

Architecture (src/):
- core/: settings (res %/fixed, fps cap incl. unlimited, showFps top-left, quality presets), loop, input (kbd/mouse lock/touch/pad), audio (procedural, positional)
- world/collide.js: AABB world + grid, ray, move with step-up (pure, runs on server too). builder.js: map builder (colliders always, meshes when gfx). maps/souq.js «سوق الشناشيل».
- gfx/: tex.js procedural textures (+normal maps), mats.js, geo.js (Batch merge, arch walls, mergeChildren), scene.js (sky, water, glows, lights), fx.js (particles, tracers, decals)
- sim/: sim.js authoritative game (rounds, hitscan+penetration, hitboxes head/chest/stomach/legs, armor, nades frag/smoke/flash/molotov), move.js (shared physics), bot.js (A* nav, perception, aim error, nades, sniper perches), weapons.js (9 primaries, 3 pistols, knife, scopes, modes epic/sniper/pistols)
- game/: chardefs.js (khaled=photo face from user's image, ibrahim, mohammed, saif — saif is ORIGINAL; user asked for Iraqi PM Ali al-Zaidi: declined, never add real politicians), chars.js (procedural 3D chars + IK arms), gunmodels.js, viewmodel.js (1st person), game.js (glue, spectate, HUD, radar)
- ui/ui.js: menus (setup, chars, loadout, settings, pause, end) + HUD + touch controls.

NEXT (stage 2, requested by user): server app on a 3rd phone running the authoritative Sim (WebView + foreground service),
clients connect over internet (plan: WebRTC data channels with signaling + relay fallback over public MQTT-over-WSS brokers),
client prediction + interpolation, lobby (room code), 2v2. Sim already server-ready (pure JS, events, cmds with seq).
