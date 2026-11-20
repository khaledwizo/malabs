// مشاهدة البوتات تتقاتل (كاميرا الشخص الثالث) + فحص الأداء
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const mobile = process.argv.includes('mobile');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext(mobile ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 960, height: 540 } })).newPage();
await p.addInitScript(() => { localStorage.setItem('rafidain.settings.v1', JSON.stringify({ fps: 0, quality: 'medium' })); });
const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForTimeout(1500);
await p.evaluate(() => { const U = window.__R.UI; U.setup.size = 3; U.startMatch(); });
await p.waitForTimeout(400);
const pre = mobile ? 'm_' : '';
await p.screenshot({ path: `test/shots/${pre}sp_0.png` });
await p.evaluate(() => { const g = window.__R.game, s = g.sim; s.phaseT = 0; for (let i = 0; i < 60 * 8; i++) { s.step(1 / 60); g.handleEvents(); } const me = g.mp; me.hp = 0; me.alive = false; g.spec = { id: -1, t: 0, pos: me.pos.slice() }; });
for (let i = 1; i <= 4; i++) {
  await p.evaluate(() => { const g = window.__R.game, s = g.sim; for (let k = 0; k < 60 * 3; k++) { for (const q of s.players.values()) g.prev.set(q.id, [q.pos[0], q.pos[1], q.pos[2], q.crouch]); s.step(1 / 60); g.handleEvents(); } });
  await p.waitForTimeout(500);
  await p.screenshot({ path: `test/shots/${pre}sp_${i}.png` });
}
const st = await p.evaluate(() => { const g = window.__R.game, s = g.sim; g.renderer.info.autoReset = false; g.renderer.info.reset(); g.renderer.render(g.scene, g.camera); const r = { ...g.renderer.info.render }; g.renderer.info.autoReset = true; return { r, score: s.score, round: s.round, alive: [...s.players.values()].map(p => p.name + ':' + (p.alive ? Math.round(p.hp) : 'x') + ':' + p.kills) }; });
console.log(JSON.stringify(st));
console.log('errors', errs.length, errs.slice(0, 3).join('\n'));
await b.close();
