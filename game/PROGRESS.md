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

- net/ (stage 2, DONE): mqtt.js (tiny MQTT 3.1.1 over WSS, public brokers emqx/hivemq/mosquitto; ?broker=ws://.. override for tests),
  link.js (HostLink connects to ALL brokers at once, replies via the broker each client came from; ClientLink tries brokers in order;
  WebRTC DataChannel upgrade (non-trickle ICE, STUN), ?nortc to force relay), proto.js (compact cmd/player/snapshot encoding, PROTO=1),
  server.js (GameServer: authoritative Sim @60Hz, snapshots @20Hz with events repeated 3x + client dedupe, per-client cmd queue,
  netWait = never guess missing cmds, catch-up of backlog, lag compensation via cmd.vt (client render time) -> p.lag -> Sim.posAt history,
  auto team balance + bot fill, auto start on first human / auto restart 11s after match over, 10s timeout),
  client.js (NetSim mimics Sim for Game: own player predicted in a private mini Sim (same stepPlayer incl. weapons, damage disabled,
  remote players inserted for local tracer hits), reconcile = restore server state at ack seq + replay unacked cmds, smooth corr offset;
  others interpolated 120ms behind; local events shown instantly, server echoes of own shot/reload/etc dropped).
- server_main.js + server.html: dashboard (room code persisted, share/copy, settings mode/size/rounds/bots/fill, players w/ ping & p2p/relay, log),
  Android bridge window.RafidainServer {room, copy, share, batteryFree, askBattery}.
- Build makes dist/index.html (game) + dist/server.html (server). Android: app/ (game, com.rafidain.front) + server/ (com.rafidain.server,
  WebView + foreground service KeepAlive with wake/wifi locks). CI caches the debug keystore so updates install over each other.
- Tests: test/broker.mjs (mini MQTT broker, delay/loss args), test/online.mjs [delayMs] [loss] [nortc] = server page + 2 clients,
  checks prediction error (~1mm), lag-compensated hits on moving target, leave/bot refill.

IDEAS NEXT: more maps, voice/chat quick messages, bomb/defuse mode, ranked stats, in-game host (no 3rd phone) option.
