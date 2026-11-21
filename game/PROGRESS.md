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

STAGE 4 (DONE, Nov 2026) — «النقلة النوعية» after user play-test feedback
- Interactive world: Builder.prop(kind,hp)…end() → breakable crates/barrels (120–210hp), clay vases (45), floor pots «سنادين» (70),
  sacks, tomb headstones (80–140), wooden road barricades (220). Geometry kept in mat+'#d' batches; scene setProp folds verts to y=-60.
  sim.props/npcs state, events break/reset/npcHit/npcDie; client mini-sim mirrors them; game.js debris FX + break sounds.
- People (game/civilians.js, Builder.npc): seated/standing vendors in every shop, stall sellers, tea seller + customers, elders on
  benches (stool:false, y=0.09), fisherman, shrine visitors reading Al-Fatiha (pose 'pray', kill:false — out of respect).
  Killable vendors fall and stay dead with a small blood pool until match end (resetWorld only at sim.start).
- Landmarks: spiral Malwiya + Great-Mosque wall on the far bank (custom helix BufferGeometry), concrete T-walls, sandbags, barricades.
- Sculpted cars (extruded side profile, wheel arches, glass, chrome bumpers, lights; Baghdad orange taxi; burnt variant).
- LICENSED MODELS: tools/convert_models.py packs glTF (Khronos glTF-Sample-Assets) into src/gfx/modeldata.js (Int16 pos, Int8 normals,
  small JPEG textures). Used: Lantern (CC0, wooden street lamp, InstancedMesh via B.put + streetLamp() arm auto-faces open space,
  emissive follows weather lamps) and BarramundiFish (CC0). Credits note in settings › sound tab. Heavier assets (teacup 28k tris,
  traffic cone 17k) rejected for mobile.
- Floor detail: 4×4 decal atlas (cracks, stains, oil, litter, leaves, manholes, grates, tire marks, casings, blood) + puddles that
  appear when wet. Weather blends & changes during a match (schedule(seed)/tick(matchT)); horror night brightened.
- Audio: soft realistic footsteps, procedural rain loop (muffled under roofs), original procedural Arabic/Abbasid music (Bayati/Hijaz,
  oud pluck, ney, darbuka, riq) — no copyrighted recordings. Heal/break/body-fall sounds.
- Gameplay: MAX_HP 150, meds (5 bandages +30 / 2 syringes +75, cancel on fire/jump/swap), regen to 50%; real weapon names
  (AKM rifle, M416, SCAR-L, Groza, Vector, UMP45, S1897, S12K, M249, SKS, Mini 14, AWM, Kar98k, Glock 17, Desert Eagle, Glock 18C,
  R1895); snipers ship with x6 (zoom 3–6 adjustable, x8 4–8). Bots weaker/smarter (react delay, aim wobble, heal, cover, no early
  swarm: first kills ~25s). TDM start: teams spawn at opposite ends (w.tdmStart); respawns far from enemies.
- Nav/glitch sweep: nav links need 3 parallel body-width rays (±0.34) at 0.35/0.7/1.0 m, ground under elevated links, and must not
  cross NPCs; bots re-plan on unreachable goals, walk straight to visible goal, side-step when snagged. test/navwalk.mjs walks every
  link with the real player mover (1/1822 fail, cemetery tomb edge); test/botstuck.mjs reports idle bots.
- UI: PUBG-like HUD v4 (scaled for all screens), meds buttons, zoom ± for variable scopes; big map opens/closes with animation and
  supports drag, pinch zoom, double-tap and mouse wheel.
- Server/test builds use NULL_GFX so layout & RNG match the client exactly.

STAGE 4.1 (Nov 2026) — talking townsfolk + tap fix
- FIX: HUD buttons that open a screen (map, pause, score, loadout) sometimes needed two taps: Input.reset() cleared owners but
  left control.busy=true. Now reset clears busy, those controls fire on finger-up (tapUp) and a 380ms click shield swallows the
  browser's ghost click on the newly opened screen.
- game/talk.js TalkManager + game/talkdata.js (Baghdadi dialect): greetings when you come within ~4.6m (wave + look at you),
  vendor/tea/nursery/fisher calls, 18 multi-speaker gossip scenarios for clusters (<4.3m) incl. tea-kiosk scripts with
  «أبو سلام الچايچي», gunfire reactions (civilians cower, nearest shouts) and a calm-down line. One voice at a time (nearest),
  RTL speech bubbles with the speaker's name projected above heads (hidden when occluded/off-screen/>18m).
- core/speech.js: Android TextToSpeech via bridge (speak/stopSpeak/ttsStatus/voiceCount, per-speaker voice/pitch/rate,
  volume+pan by distance, __ttsDone callback; manifest <queries> TTS_SERVICE), web speechSynthesis if Arabic voice exists,
  else Audio.babble() formant murmur. ttsText() maps چ→تش، گ→ق and laughter. Settings: «أصوات أهل السوق» volume (talk).
- civilians.js: target-pose blending; work loops (vendor arranges goods, tea seller pours from a teapot, nursery waters with a
  can, seated men count prayer beads / sip tea, fisherman hands behind back shading eyes), talk gestures + nods, listeners face
  the speaker, weight shift, cower pose. test/talk.mjs covers bubbles, reactions and single-tap map/pause.

STAGE 4.2 (Nov 2026) — authored Iraqi voices + first-launch cutscene
- talkdata.js rewritten: 25 PERSONAS (index-matched to world.npcs, look-checked) each with own voice prosody (p/r %) and
  speech tics; greet (as مجاهد), call, react, calm, solo stories; GROUPS with authored multi-line convos (tea kiosk trio,
  bench elders, stall trio, 3 souq vendor pairs across the street).
- talk.js: units (groups/solos) run sequences that start when you enter their radius (14m groups, 7m+1.2s dwell stories) and
  are never interrupted (only a speaker's death stops a line); greetings queue until they finish; gunfire → cower, a react line
  after the current line, then a calm line and the story resumes; one nearby sequence at a time (busyNear); every line at most
  once per match (used set reset in game begin); volume fades with distance (HTMLAudio volume) — babble fallback if no file.
- Voices: tools/voice_lines.mjs → game/voice/lines.json (id = FNV-1a of voice|pitch|rate|loud|text, core/voicekey.js shared
  with runtime). CI step runs tools/gen_voices.py with secrets AZURE_SPEECH_KEY/AZURE_SPEECH_REGION (Azure ar-IQ-BasselNeural,
  ogg-24khz opus, incremental, ~3.2s pacing for free tier, writes voice/manifest.js with durations) and commits game/voice;
  APK assets/voice/ loaded via <script src=voice/manifest.js> + new Audio('voice/<id>.ogg').
- intro.js (+introdata.js): first-launch cinematic in a Tikrit mudhif (4 main chars sit on the floor around a سفرة, sheikh
  Ibrahim al-Hashimi enters, reconciliation fails, a hidden hand throws a grenade, flash, cards, title). Tap card unlocks audio,
  skip button, Android back skips, letterbox + subtitles, key light on speaker, lookAt previous speaker. localStorage
  rafidain.intro.v1; replay from settings › sound. All names/groups fictional per user. Tests set the key (comma expr).
