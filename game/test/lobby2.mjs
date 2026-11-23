// المرحلة 2 (ب): بقية المهام بالتسريع — لقاء الصيّاد، السائح (أسئلة)، ياسر (اختيار)، الفلوجة (مرافقة)، الدفن (نقطة)، وصور
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.addInitScript(() => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.removeItem('rafidain.quests.v1'); });
await page.addInitScript(() => localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 0, quality: 'low', res: '0.5', weather: 'day', teamSize: 1, difficulty: 'easy', mode: 'tdm' })));
await page.goto('file://' + path.resolve('dist/index.html')); await page.waitForTimeout(3000);
await page.evaluate(() => window.__R.UI.startLobby()); await page.waitForTimeout(1500);
const place = (x, z, yaw = 0) => page.evaluate(([x, z, yaw]) => { const g = window.__R.game, me = g.mp; me.pos = [x, 0, z]; me.vel = [0, 0, 0]; g.yaw = yaw; g.pitch = -0.05; }, [x, z, yaw]);
const st = () => page.evaluate(() => { const g = window.__R.game, Q = g.quests; return { offer: Q.offer && Q.offer.id, act: Q.act && { id: Q.act.q.id, i: Q.act.i, item: Q.act.item }, cine: Q.cine && Q.cine.stage, money: window.__Economy.money, use: g.useInfo && g.useInfo.label, done: Object.keys(Q.S.done).join(',') }; });
// نشغّل الحوار تلقائياً: نسرّع السطور ونختار أول خيار (أو الخيار i)
const drive = async (pick = 0, shot) => { for (let k = 0; k < 80; k++) { const r = await page.evaluate(([pick]) => { const Q = window.__R.game.quests, C = Q.cine; if (!C) return 'none'; if (C.stage === 'lines' || C.stage === 'act') C.t = 99; const bs = document.querySelectorAll('#cine .copts button'); if (bs.length) { (bs[Math.min(pick, bs.length - 1)]).click(); return 'click'; } return C.stage; }, [pick]); if (r === 'none') return; if (shot && k === 2) await page.screenshot({ path: shot }); await page.waitForTimeout(200); } };
const offerQ = id => page.evaluate(id => { const Q = window.__R.game.quests; Q.endCine(true); Q.act = null; Q.offer = null; const q = window.__QUESTS.find(q => q.id === id); Q.setOffer(q); return !!q; }, id);
const goGiver = async () => { const p = await page.evaluate(() => { const Q = window.__R.game.quests; return Q.posOf('g', Q.offer); }); await place(p[0] + 1.2, p[1] + 1.2, Math.atan2(1.2, 1.2)); await page.waitForTimeout(400); await page.evaluate(() => window.__R.game.useAction()); await page.waitForTimeout(300); };
const goStep = async () => { const p = await page.evaluate(() => { const Q = window.__R.game.quests, A = Q.act; if (!A) return null; return Q.posOf(A.q.steps[A.i].to, A.q); }); if (!p) return false; await place(p[0] + 1.0, p[1] + 0.8); await page.waitForTimeout(500); return true; };
const runQuest = async (id, pick = 0, shot) => {
  console.log('offer', id, await offerQ(id));
  await goGiver(); await drive(0, shot);
  for (let s = 0; s < 6; s++) { const a = await page.evaluate(() => !!window.__R.game.quests.act); if (!a) break; if (!(await goStep())) break; await drive(pick); }
  console.log('  ->', JSON.stringify(await st()));
};
// نعرض بيانات المهام للاختبار
await page.evaluate(async () => { });
const ok = await page.evaluate(() => !!window.__QUESTS); if (!ok) console.log('no __QUESTS');
await runQuest('flour', 0, 'test/shots/p2_fisher.png');
await runQuest('dough');
await runQuest('tourist', 0, 'test/shots/p2_tourist.png');
await runQuest('recruit', 1);
await runQuest('fallujah', 0, 'test/shots/p2_fallujah.png');
await runQuest('burial');
await runQuest('phone');
await runQuest('gas');
await runQuest('bag');
await runQuest('water');
await runQuest('manure');
await runQuest('chickpea');
await runQuest('kahi');
// المضيف: اللوحة الكوفية
await place(-57, -12, Math.PI / 2); await page.evaluate(() => { window.__R.game.pitch = 0.12; }); await page.waitForTimeout(900); await page.screenshot({ path: 'test/shots/p2_plaque.png' });
await place(73.2, 22.6, Math.PI * 0.25); await page.waitForTimeout(900); await page.screenshot({ path: 'test/shots/p2_lablabi.png' });
await place(-73, -4, Math.PI / 2); await page.waitForTimeout(900); await page.screenshot({ path: 'test/shots/p2_shrine.png' });
await place(-7.5, -6, -Math.PI / 2); await page.waitForTimeout(900); await page.screenshot({ path: 'test/shots/p2_spiceshop.png' });
console.log('errors', errs.length, errs.slice(0, 6).join('\n---\n'));
await b.close();
