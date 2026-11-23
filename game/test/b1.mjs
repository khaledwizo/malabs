// الدفعة 1: منظور ثالث، درون برمانة، قناني غاز، هروب المدنيين، اعتماد السلاح، المكافآت
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { localStorage.setItem('rafidain.intro.v2', '1'); localStorage.setItem('rafidain.settings.v2', JSON.stringify({ fps: 30, quality: 'medium', mode: 'tdm', teamSize: 3, name: 'خالد' })); });
await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForTimeout(3000);
await p.evaluate(() => { const { UI } = window.__R; UI.start(); });
await p.waitForTimeout(6500);
console.log('tpp', JSON.stringify(await p.evaluate(() => { const g = window.__R.game, me = g.mp, c = g.camera.position; return { tpp: g.tpp, fp: g.fpNow, camD: Math.hypot(c.x - me.pos[0], c.z - me.pos[2]).toFixed(2), camY: (c.y - me.pos[1]).toFixed(2), fix: g.aimFix, vis: g.models.get(g.me).root.visible, tags: g.tags ? [...g.tags.values()].filter(t => t.s.visible).length : 0 }; })));
await p.screenshot({ path: 'test/shots/b1_tpp.png' });
// التصويب يحوّل لمنظور أول
await p.evaluate(() => { window.__R.game.mp.adsT = 1; }); await p.waitForTimeout(100);
console.log('ads fp', await p.evaluate(() => window.__R.game.fpNow));
// الدرون
console.log('drone', JSON.stringify(await p.evaluate(async () => { const g = window.__R.game; g.toggleDrone(); const on = g.drone.on; g.drone.pos.y += 8; const n0 = g.sim.nades.length; const ok = g.drone.drop(); const n1 = g.sim.nades.length; const again = g.drone.drop(); g.toggleDrone(); const ready = g.drone.ready; return { on, ok, again, nades: n1 - n0, readyAfter: ready }; })));
// قناني الغاز
console.log('gas', JSON.stringify(await p.evaluate(() => { const g = window.__R.game, s = g.sim, W = g.world; const ids = W.props.map((q, i) => q.kind === 'gas' ? i : -1).filter(i => i >= 0); const booms = []; const orig = s.explode.bind(s); s.explode = n => { booms.push(n.kind); orig(n); }; s.hitProp(ids[0], 99, null, g.me); for (let i = 0; i < 60; i++) s.step(1 / 60); return { gas: ids.length, broken: ids.filter(i => !s.props[i].alive).length, booms }; })));
// هروب المدنيين
console.log('flee', JSON.stringify(await p.evaluate(() => { const g = window.__R.game, c = g.civs.find(c => !c.sit && c.n.pose !== 'pray' && c.alive && !c.away); g.civFlee([c.n.x + 3, 0, c.n.z]); const st = !!c.fl; for (let i = 0; i < 600; i++) g.updateCivs(1 / 30); return { started: st, hidden: !!(c.fl && c.fl.hid), away: c.away }; })));
// اعتماد السلاح
console.log('equip', JSON.stringify(await p.evaluate(() => { const { UI, game } = window.__R; game.quit(); UI.showMenu && UI.showMenu(); UI.open('loadout'); const cards = [...document.querySelectorAll('#loPrim .wpn')]; const before = UI.getLoadout('tdm').primary; const other = cards.find(c => c.dataset.w !== before); if (!other) return { only: before }; other.click(); const mid = UI.getLoadout('tdm').primary; const btn = document.querySelector('#loEquip'); const txt = btn.textContent; btn.click(); return { before, afterClick: mid, btn: txt, after: UI.getLoadout('tdm').primary }; })));
// المكافآت
console.log('reward', JSON.stringify(await p.evaluate(() => { const E = window.__R.game.constructor && null; return null; })));
console.log('errs', errs.slice(0, 5));
await b.close();
