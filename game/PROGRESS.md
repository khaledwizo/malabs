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

STAGE 3 (DONE, Nov 2026) — overhaul requested by the user
- Map renamed «سوق المجاهدين» (weapons-market look only): souq shops are weapon shops (rifles/pistols/ammo/armor/blades/heavy via gunProp
  box silhouettes, 'flat' lying on tables) + one green shop «مشتل ريحانة» (plants, visual only, forced at left shop z -10..-7.6).
  Map extended to x -92..92 (mapRect [-94,-38,94,36]): maps/districts.js = west «الحارة المهجورة» (enterable ruinHouse with jagWall,
  burnt car, graffiti signs opt.graffiti, flicker lights fl=1) + «المقبرة القديمة» (tombs grid, dead trees, green-dome shrine, city wall,
  watchtower) ; east «ساحة الساعة» (clock tower w/ clock signs opt.clock, القشلة arcade split into 2 archWalls, red bus, sandbag
  checkpoint, weapon stalls, orange taxi) ; shore extended. Nav graph fully connected (369 nodes). w.spawnsTdm for respawns.
  FIXED old bug: archWall 'z' visuals were mirrored vs collision (now T(c+t/2,y0,a0,-PI/2)).
- gfx/weather.js: presets day/sunset/storm/horror (+random), GPU rain (instanced, roof-occlusion DataTexture from colliders, uses
  camera-right uniform — cameraPosition-based cross gave zero quads), splashes, lightning bolts+flash+Audio.thunder, mist sprites,
  ghost apparitions in info.haunt (cosmetic), wet materials + PMREM env reflections, shadow camera follows player (texel snapped),
  light pool in scene.js (nearest N PointLights, flicker). gfx/post.js: HDR bloom + grade + vignette on high/ultra (Q.bloom).
- Modes tdm (respawn, fewer deaths wins after timeLimit) / rounds / snipers / pistols ; PUBG-like scopes & aiming ; 18 weapons.
- Social (net/social.js): 10-digit Luhn IDs, friend requests via RETAINED MQTT msgs (rafidain/v2/u/{id}/rq|ac|rm/{from}), presence
  retained /st with Last Will, inbox /in for invite/join/party/start/disband. Party host runs GameServer IN THE GAME PAGE
  (game.hostParty) + LocalLink loopback for host player; members auto-join room 'p'+hostId+rand. No codes needed.
  Private dedicated server still supported (friends screen → «سيرفر خاص» code). PROTO=2 (lean, helmet, spawnProt, respawnT, att).
  Brokers: emqx + mosquitto (HiveMQ dropped: its public broker terms forbid production use).
- Bots: safe grenade throws (no self-kills), hear gunshots, retreat to cover when hurt (tdm), map-wide hunting, no friendly fire.
- Characters: coat tails (sway with legs/run), hood/cape variants, broad shoulders, bracers, gloves, breathing, lean, hit flinch,
  2-stage death. Tests: test/party.mjs (2 players friend→invite→host start), test/dedicated.mjs, test/mapshot.mjs (free cam).
