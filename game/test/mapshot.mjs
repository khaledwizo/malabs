// لقطات حرّة لمناطق الخريطة: node test/mapshot.mjs "name:x,y,z,yaw,pitch;..." [quality] [weather]
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import path from 'path';
const url = 'file://' + path.resolve('dist/index.html');
const views = (process.argv[2] || '').split(';').filter(Boolean);
const q = process.argv[3] || 'medium', wx = process.argv[4] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
await p.addInitScript(([q]) => { try { localStorage.setItem('rafidain.settings.v2', JSON.stringify({ quality: q, fps: 0 })); } catch (e) { } }, [q]);
const logs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', e => logs.push('PAGEERROR ' + e.message + '\n' + e.stack));
await p.goto(url); await p.waitForTimeout(2500);
await p.evaluate(() => { document.querySelectorAll('.screen,#home,#ui,#hud').forEach(e => e.style.display = 'none'); });
if (wx) await p.evaluate(w => { const g = window.__R.game; if (g.weather) g.weather.set(w); }, wx);
for (const v of views) {
  const [name, rest] = v.split(':'); const [x, y, z, yaw, pitch, fov] = rest.split(',').map(Number);
  await p.evaluate(c => { window.__R.game.freeCam = c; }, { x, y, z, yaw, pitch, fov: fov || 70 });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `test/shots/m_${name}.png` });
}
const st = await p.evaluate(() => ({ calls: window.__R.renderer.info.render.calls, tris: window.__R.renderer.info.render.triangles, fps: window.__R.Loop.fps.toFixed(1) }));
console.log('stats', JSON.stringify(st)); console.log(logs.slice(0, 10).join('\n'));
await b.close();
