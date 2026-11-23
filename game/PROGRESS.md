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

STAGE 4.3 (Nov 2026) — new cutscene story + real Iraqi voices live
- introdata.js rewritten (fictional): a week after the city elections, a reconciliation dinner at sheikh Ibrahim al-Hashimi's
  mudhif. Mohammed/Khaled (Tikritis outside «التجمّع») blame the gathering (Ibrahim/Saif) for allying with العصائب, who have a
  dark history in the city. The sheikh calms them; as hands meet, a masked stranger (look 'masked', one of العصائب) opens the
  door, pulls the pin, throws and flees; sheikh falls; gathering members, blind to the stranger, accuse the other Tikritis and
  draw weapons (Khaled: "الرمّانة إجت من الباب!"); shots in black; closing cards say the thrower was from العصائب to ignite
  sedition, the gathering misunderstood, and war broke out among the people of Tikrit.
- intro.js: door/door2/doorHand/grenade shots, strangerLight, held grenade on the stranger's hand + arc, exposure system
  (expo/expoT/expoRate: blinding boom → black → slow dusty fade-in), aftermath standing/aiming actors, scorch/debris, fire light
  with flame cones. civilians.js: looks 'sheikh' and 'masked', hold/raise/throw animations.
- Voices: Azure key fixed (84-char key), generation working — 348/348 lines (316 souq + 28 intro, voice ar-IQ-BasselNeural).
  gen_voices.py removes .ogg files no longer in lines.json. Workflow: brings voice files from the branch head before
  generating (runs check out their event SHA), and commits by resetting onto the branch head + merging voices/APKs instead of
  rebase (binary conflicts). APK build #14: 348 ogg in assets/voice, cert dce687429cdb64f87ae6b1e5.

STAGE 4.4 (Nov 2026) — user feedback round
- Character select: camera framed a point behind the right-side panel (selected char hidden, previous one shown). Now
  charFrameNdc() finds the visible part beside the panel and the camera rotates so the selected char sits there; others hidden.
- Clothing: shirt/tie panels were coplanar with the jacket front (z-fight stripes) → pushed forward; vest wider than torso;
  Ibrahim's cape was rotated onto his chest → now on shoulders/back.
- Breakables: setProp keyed saved ranges by prop+mesh, so a 2nd part with the same material (tombstone cap, crate top band)
  was skipped and floated → key includes range start; builder merges contiguous ranges.
- Civilians faced -z but x-rotations were applied as if +z were front (arms/elbows behind, chest/head bends inverted) →
  sign flipped at apply time; fall direction now with the bullet.
- Souq talk: one audible "turn" at a time (u.hold, FLOOR_R 22m, gap 1.6–3s, nearest unit first); greetings/calls/reactions
  need the turn too; global call gap; only one unit reacts to gunfire.
- Tea: chaychi holds a porcelain qouri (right) + tray of estikans (left), both kept level (levelHeld); counter has charcoal
  stove + kettle + qouri + 7 estikans; café tables get estikans on saucers (half/empty); tea customers hold beads.
- Shadows: whole-map 1024 shadow (≈24cm texels) made stairs/floors look broken → shadow frustum follows the camera
  (±40/55/70m by quality) snapped to texels, uses the weather sun direction.
- Audio: removed synthetic bird chirp from menu/day ambience (the repeating "two dots"); softer hearth crackle in intro;
  music silent during intro (Audio.introOn) and restarts from the top when it ends; new rain loop (rainSamples: shaped
  noise hiss with slow breathing, filtered-noise drop impacts, rising-pitch puddle plops, light wash), quieter level.
- Rain: wetness accumulates gradually (wetNow → target, ~3 min to full, dries slower); puddle texture now encodes shape in
  colour so a threshold (pTh) grows puddles from small spots.
- Night (weather night>0.5, in matches): shopkeepers, tea seller and his customers go home (setAway, sim npc.away skipped
  by bullets/nades, collision box disabled). Rain: other civilians hold umbrellas (left hand, kept upright).
- Lanterns: every hanging lantern has a soft flame-flicker light (fl=2) and is a 'lamp' prop (hp 1, glass, THIN|NOPLAYER);
  street lamps too. Breaking: light off (lampAt), glow sprite size 0, lantern model glass emissive off per instance
  (lampOn instanced attribute), glass shards + sparks + breakGlass sound; restored each round. Duplicate lights deduped.

STAGE 4.5 (Nov 2026) — iOS build + Khaled's face
- Khaled no longer uses the user's photo: src/assets/khaled_face.jpg deleted (still present in old git history of this
  public repo). He gets a generated face (TX.face) with a full trimmed beard (new beardTex option: hair strokes).
- iOS: ios/App.swift (UIKit + WKWebView, scene-based, landscape, status bar hidden, AVAudioSession .playback),
  ios/Info.plist, ios/Assets.xcassets (single 1024 icon via actool; ios/icons legacy fallback), ios/build_ipa.sh
  (swiftc without an Xcode project → Payload/Rafidain.app/www → ad-hoc codesign → apk/rafidain-ios.ipa).
  Workflow: build job prepares iosweb (index.html with bundled fonts + voices converted to AAC m4a) as artifact
  'ios-www'; job 'ios' (macos-latest, needs build) builds and commits apk/rafidain-ios.ipa (reset-onto-head).
  The IPA is unsigned for distribution: install with Sideloadly/AltStore using an Apple ID (free ID = 7-day re-sign).
- JS for iOS: wrapper injects RAFIDAIN_IOS / RAFIDAIN_VOICE_EXT='m4a' and a RafidainAndroid-compatible bridge
  (copy/share/vibrate). Voices on iOS play through Web Audio (XHR + decodeAudioData + gain) because
  HTMLMediaElement.volume is read-only on iOS. Audio.init resumes 'interrupted' contexts; window.__R.Audio exposed.

PHASE 1 of the big plan (Nov 2026) — economy, shop, ammo, grenades, aim, modes
- src/game/economy.js: wallet in IQD (all amounts multiples of 250), owned weapons, 5 ammo types (auto/shot/pist/dmr/snip),
  items (nades, bandage, syringe, NVG). Start kit: AKM+2000, Glock17+500, S1897+40, 5 frag, 3 molotov. Per match free:
  ammo by type (80 auto…), 4 bandages + 2 syringes (never stored). Rewards: player kill 2500, bot kill 1750 (70%),
  assist 500, win 10000, draw 5000, loss 3000. Saved in localStorage + RafidainAndroid.saveKV backup if present.
- Sim: loadout.supply → p.sup per match (cleanSupply); weapons' reserve IS the pool (stash() on death/re-equip/end);
  nades thrown consume sup.nades; meds shared object; 'supply' event per human at matchOver {sup, kh, kb, as, res};
  client Economy.settle: new stock = min(stock, remaining) (free used first). Quit mid-match → abandon (deduct, no reward).
- Modes: tdm (most kills wins), dom (capture points: 1 if ≤4 players else 3, picked from open nav nodes each match,
  r 5.5m, ~5s capture, +1/s per held point; bots head to points), rounds (+ selectable round time). Host picks time.
  Removed snipers/pistols modes. Team names per viewer: «نحن المجاهدين / هم الأعداء».
- Weapons: Tabuk sniper (semi, x6). DMR default x4. Frag fuse 4s radius 4.6; flash 2.5s r16; molotov r2.6.
- HUD: capture pills, PUBG-like grenade warning (arrow+badge), NVG button (night only, CSS filter + vignette),
  world ring/column/letter markers for points, points on minimap/map. Aim assist stronger (cone 0.11, pull 0.75/0.45).
- UI: wallet chip, shop screen (weapons/ammo/nades/meds/gear), loadout shows owned weapons + stock, end-screen reward.
- iOS job paused (if: false) while user wants APK only.

PHASE 2 (لوبي + مهام + تأشير) — DONE locally, see tests test/lobby.mjs, lobby2.mjs, p2world.mjs, p2online.mjs
- UI: home = gear icon left of «الجولات التكتيكية», wallet inside العتاد, boot/loading screen with logo (#boot in template.html),
  new home button «السوق والمهام» → UI.startLobby() → Game.startLobby() = local Sim mode 'lobby' (no bots, no firing, buyTime 0.05).
- Map: shrine doors E/W (B.door, auto-close 10s, bots open) + noFire zone in shrine (no guns/nades, dom points avoid it);
  mudhif of Sheikh فاتح الرفاعي replacing ruin block (-66,-18,-52,-6) with Kufic plaque (tex.kufiPlaque, glow) + door;
  spice shop «عطارة أبو ستّار» (npc 6), pharmacy «صيدلية الشفاء» (npc 12); lablabi cart + usables (lablabi eat 6s +40 ×3, tea 3s +10 ×8 per match);
  new NPCs 29..37: lablabi, shepherd(+grass), tourist, phone repair, old man door, bag owner, youth, gravedigger, baker(+stall);
  gas depot (-30,22); Hammurabi stele cover (63.5,-6.8); 3rd chaychi table for ambient friends. talkdata PERSONAS has null at 25..28.
- Sim: doors (setDoor/use/tickDoors, snapshot dr), cmd.heal 3 = use, food per match, setMark → 'mark' event (team waypoints), PROTO=4,
  client mini-sim pred=true (never opens doors). Server msg 'mk'.
- Client: game/doors.js (door meshes/animation, online collision sync), waypoint.js (GTA-style beacons: quest gold, mine magenta,
  team cyan; route via route.js A* on nav), maps.js pins + route line, big-map tap → «مسار / نقطة / شيل».
  game/quests.js + questdata.js (15 quests incl. repeatables, fisher first meeting, flower from nursery, Fallujah escort,
  tourist quiz, recruit weapon choice; cinematic OTS camera + letterbox + subtitles; rewards via Economy.earn; saved 'rafidain.quests.v1').
  ambient.js (lobby only: strollers, sheep, friends meeting at chaychi). Talk (NPC chatter) runs in lobby only — silent in battle.
  Key F = use (inspect moved to I). tools/voice_lines.mjs exports quest lines (player lines for all 4 chars).

PHASE 3 (المقدّمة الجديدة + كاتسينات المهام + الأصوات) — pushed
- introdata.js rewritten (fictional): Baghdad night, 3 Baghdadis + Ibrahim the Tikriti; invaders near Tikrit/Baghdad;
  Sheikh فاتح الرفاعي (civilians look 'sheikhF': big white turban, long white beard) issues «رد الصائل واجب شرعاً» + وصية;
  Kufic plaque in intro mudhif; they eat; masked infiltrator with rifle fires 3 shots (sheikh falls on 2nd); aftermath; dying words;
  dawn burial set (intro.buildBurial at x=40): empty old shrine, turban placed on tomb, vow; «بعد أشهر» fence+tiles+green dome build.
  INTRO_KEY bumped to rafidain.intro.v2 (tests set v2). Replay from settings button unchanged. test/intro2.mjs walks all beats.
- Lobby world: white turban on the shrine tomb. Quest acts: camera orbits during act, player model crouches for own actions.
- voice/lines.json regenerated (intro + quests; player lines for all 4 chars) → CI Azure makes the missing ogg.

FIX ROUND after P3 (user feedback) + PHASE 4
- Loadout/shop: 3D showcase (game/showcase.js) in free stage area (#loStage/#shopStage), auto-fit, drag-rotate 360°, items/nades/ammo models.
- Anti z-fighting: builder.box expands visual boxes by mm per material/order (opts.exact to skip); world camera near 0.1.
- Loop: always rAF ("unlimited" = display max), frame-skip caps; render ratio capped (≤ max(dpr,2), ≤3).
- Lablabi 1000 / tea 500 IQD in battle (client charges on heal event), free & unlimited in lobby.
- Weather 'random' = cycle: day→rain 30s→day→dust+tornado 15s→sunset→night→day (weather.cyclePlan, startTornado). Compass letters unclipped.
- NPC chatter only when you stare (talk.js c.stare). Quest engine: robust line timing (voice fail fallback, read time), markers hidden in cine/mg,
  spacing (no same giver/place consecutively), fisher auto-opens talk, bakery single varied quest with cooldown.
- Hands-on minigames (game/minigame.js): scoop/weigh, knead, river water vs oil slick, dig+bury (persistent graves), bandage, gas regulator,
  photo of tourist with Malwiya (snapshot shown as polaroid). Carry gas cylinder (forced walk). Hidden bag search.
- Phase 4: drone (game/drone.js, V key / 🛸 button, 30s, 60s cooldown, spots enemies); minimap shows enemies only when they fire or drone-spotted;
  bots call out targets to teammates + switch to pistol when empty; LAN play without internet (LanHub.java in app+server: WS 47800 + UDP beacon 47801,
  net/lan.js, HostLink.openLan, NetSim tries LAN first; friends screen «على نفس الشبكة» list + «استضف معركة على الشبكة»);
  host migration (server broadcasts {k:'hp'}; on loss lowest human pid hosts same room with score resume; test/migrate.mjs);
  online consecutive matches now settle (client re-sends supply after 'supply' event; sim.start refreshes p.sup).
