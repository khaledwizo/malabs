NABD (نبض) — PROGRESS / نقطة الاستئناف
=====================================
Artifact: https://claude.ai/artifact/E9r58cH7JhYFmA9fvKt8fS  (slug 6a82fe74-09b9-4db4-aac8-2b356b339269, capabilities db+user for per-player saves)
APK: GitHub repo khaledwizo/malabs, branch `nabd-game` (Android WebView wrapper in app/, built by .github/workflows/nabd-apk.yml,
     APK committed back to apk/nabd.apk). Package com.nabd.bells. Source of the game lives in game/ there (durable copy for future sessions).
     No signing key is committed (public repo) → each CI build has a new key; players move saves with Settings → «نقل التقدّم» code.
Project: 2D stealth-puzzle game, single-file HTML (canvas 2D), Arabic UI (RTL). v3 = "مملكة الأجراس الصامتة" (original world in the spirit of
         metroidvania classics: names/ideas are ORIGINAL — never use another game's real names/characters).
Source: /home/claude/nabd/src  ->  build: `node tools/build.js`  ->  dist/index.html
Maps:   `python3 tools/mkmaps.py` regenerates src/js/12a_maps.js (rooms/coords -> ASCII maps)
Tests:  test/hk.js (v3 systems, 30+ checks), test/run.js (desktop|levels|mobile), test/logic.js, test/l456.js (boss full run),
        test/director.js, test/portrait.js  (Playwright + /usr/bin/google-chrome headless; screenshots in test/shots)
If this file is missing (new session), the same notes live in an HTML comment at the top of the artifact's <body>.

Architecture (src/js, concatenated in order):
00_util  01_config(res/fps/quality options, settings incl. whispers all|few|off, haptics)  02_save(local + artifact db; merge: best progress,
  charms/journal/met union, notches max, newer updatedAt wins for rnn/equipped/shade)
03_audio  04_input  05_loop(unlimited via MessageChannel / vsync / caps)  06_render(lightmap, shadows, bloom, particles)  07_level(grid, A*, flow, logic, lasers)
08_entities(... checkpoint = «مرسى» dock: interact to rest/save/heal, again to open charms; Tablet «لوح منقوش/لوح ذاكرة»; Npc فانوس; shard/charm pickups)
09_ai(Drone, Turret, Nest+Swarm, Hunter adaptive, Echo, Planner, Director «الراوي» + «مِحَن»)  09b_boss(«المُراقِب/العين»)
10_gadgets(بصيرة الصدى، صرخة الجرس، قرين الظل، عباءة السكون)  11_missions  12a_maps  12b_data(LEVELS x6 with tablets[], MEMORIES, RIDDLES)
12c_lore(CHARMS x10 + icons, SHOP, JOURNAL x8, NPC_LINES)  13_ui(whispers, area cards, item card, charms, journal, talk/shop, back key)  14_game  15_main

v3 systems (all tested):
- Whispers replace the old dialog box: translucent one/two-line text under the perf pill, no typewriter, queue<=2, priority low/mid/high
  (default "few" hides chatter; hints/Echo commands/warnings are high). Intro whisper waits for the area title card.
- Area title cards (calligraphic Aref Ruqaa) at level start + boss card on first sight. Toasts moved to the bottom.
- Currency رنين ◈ (bells +15, shards +5, strikes, riddles, hacks, missions, stars). Death leaves «طيفك» holding all rnn; touch it to recover.
- Focus: hold interact with no target while hurt → +1 string for 33 pulse (patience charm: faster/cheaper). Silent strike: tap interact near an
  unaware drone → 12s stun (+8 rnn once per drone); swarm dies; hunter 2.5s.
- Charms (10, cost 1–2 notches; start 3 notches, 4 after L2, 5 after L4, shop up to 7). Found in L1..L5 or bought from فانوس (L2, L4).
- Journal of creatures (8) unlocks on sight. Item card pauses on new ability/charm. Lore tablets teach mechanics (no tutorial popups).
- Android: window.NabdAndroid.vibrate(ms) haptics; window.__nabdBack() handles back (returns false on title → app exits on double back).

IDEAS / TODO (next sessions, if the user asks):
- More areas / optional boss rematch; charm combos; map stations; balance pass after real-device feedback
- Bundle fonts offline in the APK (CI downloads Google Fonts into assets when available)
