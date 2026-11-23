// مهام اللوبي بالألعاب الصغيرة: نشغّل كل مهمة ونلعب ألعابها آلياً ونصوّر
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.addInitScript(() => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.removeItem('rafidain.quests.v1'); localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 0, quality: 'low', res: '0.5', weather: 'day', teamSize: 1 })); });
await page.goto('file://' + path.resolve('dist/index.html')); await page.waitForTimeout(3000);
await page.evaluate(() => { window.__Economy.W.money = 50000; window.__R.UI.startLobby(); }); await page.waitForTimeout(1500);
const place = (x, z, yaw = 0) => page.evaluate(([x, z, yaw]) => { const g = window.__R.game, me = g.mp; me.pos = [x, 0, z]; me.vel = [0, 0, 0]; g.yaw = yaw; g.pitch = -0.05; }, [x, z, yaw]);
const st = () => page.evaluate(() => { const g = window.__R.game, Q = g.quests; return { offer: Q.offer && Q.offer.id, act: Q.act && { id: Q.act.q.id, i: Q.act.i, item: Q.act.item }, cine: Q.cine && Q.cine.stage, mg: Q.mg && Q.mg.def.type + ':' + Q.mg.stage, money: window.__Economy.money, done: Object.keys(Q.S.done).join(',') }; });
// نلعب اللعبة الصغيرة آلياً
const playMg = async (shot) => {
  for (let k = 0; k < 400; k++) {
    const r = await page.evaluate(() => {
      const g = window.__R.game, M = g.quests.mg; if (!M) return 'none'; if (M.done) return 'wait';
      const T = M.def.type;
      if (T === 'knead') { if (M.stage === 0) { M.hold.pour = M.wl < 1.05; } else M.tap(M.last === 'L' ? 'R' : 'L'); }
      else if (T === 'scoop') { if (M.def.weigh && M.grams >= 900 && M.grams <= 1100) M.tap('stop'); else M.tap('go'); }
      else if (T === 'water') { const ox = M.oil.position.x; M.hold.fill = Math.abs(M.x - ox) > 0.3; M.hold.R = M.x < ox && ox < 0.1 ? false : M.x < 0.35 && ox < 0; M.hold.L = !M.hold.R && M.x > -0.35 && ox >= 0; }
      else if (T === 'dig') { if (M.stage === 1) M.hold.lower = true; else if (M.stage === 3) M.tap('stone'); else M.tap('go'); }
      else if (T === 'bandage') M.tap('go');
      else if (T === 'gas') M.tap(M.stage === 0 ? 'go' : 'open');
      else if (T === 'photo') { const me = g.mp, t = M.target; me.pos = [t.x - 1, 0, t.z - 5.5]; me.vel = [0, 0, 0]; const ax = (t.x + 30) / 2 - me.pos[0] - 6, az = ((t.z + 104) / 2) - me.pos[2]; g.yaw = Math.atan2(-(t.x + 0.6 - me.pos[0]), -(t.z - me.pos[2])); g.pitch = 0.05; window.__ck = M.check(); if (M.t > 1.2 && !M.shot) { M.shot = 1; M.tap('shot'); } else if (M.t > 3) { M.shot = 0; M.t = 1.0; } }
      return T + ':' + M.stage;
    });
    if (r === 'none') return; if (shot && k === 25) { await page.screenshot({ path: shot }); console.log('   ck', await page.evaluate(() => JSON.stringify(window.__ck || null))); }
    await page.waitForTimeout(r.startsWith('photo') ? 250 : 90);
  }
};
const drive = async (pick = 0) => { for (let k = 0; k < 120; k++) { const r = await page.evaluate(([pick]) => { const Q = window.__R.game.quests, C = Q.cine; if (Q.mg) return 'mg'; if (!C) return 'none'; if (C.stage === 'lines') C.t = 99; const bs = document.querySelectorAll('#cine .copts button'); if (bs.length) { bs[Math.min(pick, bs.length - 1)].click(); return 'click'; } return C.stage; }, [pick]); if (r === 'none' || r === 'mg') return r; await page.waitForTimeout(150); } };
const offerQ = id => page.evaluate(id => { const Q = window.__R.game.quests; Q.endCine(true); Q.act = null; Q.offer = null; const q = window.__QUESTS.find(q => q.id === id); Q.setOffer(Q.expand(q)); return !!q; }, id);
const goGiver = async () => { const p = await page.evaluate(() => { const Q = window.__R.game.quests; return Q.posOf('g', Q.offer); }); await place(p[0] + 1.2, p[1] - 1.2, 0); await page.waitForTimeout(300); await page.evaluate(() => window.__R.game.useAction()); await page.waitForTimeout(300); };
const goStep = async () => { const p = await page.evaluate(() => { const Q = window.__R.game.quests, A = Q.act; if (!A) return null; const st = A.q.steps[A.i]; if (st.find) return [st.find.x, st.find.z, 1]; return Q.posOf(st.to, A.q); }); if (!p) return false; await place(p[0] + (p[2] ? 0.6 : 1.0), p[1] - (p[2] ? 0 : 0.8)); await page.waitForTimeout(500); if (p[2]) { await page.evaluate(() => window.__R.game.useAction()); await page.waitForTimeout(300); } return true; };
const runQuest = async (id, pick = 0, shot) => {
  console.log('offer', id, await offerQ(id));
  await goGiver(); await drive(0);
  for (let s = 0; s < 6; s++) { const a = await page.evaluate(() => !!window.__R.game.quests.act); if (!a) break; if (!(await goStep())) break; for (let r = 0; r < 4; r++) { const d = await drive(pick); if (d === 'mg') await playMg(shot); else break; } }
  console.log('  ->', JSON.stringify(await st()));
};
const LIST = [['tea', 'test/shots/q_scoop.png'], ['flour'], ['dough', 'test/shots/q_knead.png'], ['chickpea', 'test/shots/q_weigh.png'], ['water', 'test/shots/q_water.png'], ['manure'], ['bag'], ['phone'], ['recruit'], ['tourist', 'test/shots/q_photo.png'], ['gas', 'test/shots/q_gas.png'], ['burial', 'test/shots/q_dig.png'], ['fallujah', 'test/shots/q_band.png'], ['bakery']].filter(([id]) => !process.argv[2] || process.argv[2].split(',').includes(id));
for (const [id, shot] of LIST) await runQuest(id, 0, shot);
await page.screenshot({ path: 'test/shots/q_end.png' });
console.log('graves', await page.evaluate(() => JSON.stringify(window.__R.game.quests.S.graves)));
console.log('errors', errs.length, errs.slice(0, 6).join('\n---\n'));
await b.close();
