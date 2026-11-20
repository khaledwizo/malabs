const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message + ' ' + (e.stack||'').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.text()); });
  await page.goto(url); await page.waitForTimeout(800);
  const wait = ms => page.waitForTimeout(ms);
  const ev = (f, a) => page.evaluate(f, a);
  // ---- Level 1 full run ----
  await ev(() => { const N = window.__nabd; N.UI.openBrief(0); N.UI.startPlay(); });
  await wait(300);
  // Echo plate test
  let r = await ev(async () => {
    const g = window.__nabd.game, T = 32, p = g.player;
    p.x = 35.5*T; p.y = 15.5*T; g.echo.x = p.x - T; g.echo.y = p.y;
    await new Promise(r => setTimeout(r, 200));
    g.echo.command(g);
    const task = g.echo.task && g.echo.task.kind + ':' + (g.echo.task.obj.nodeId);
    await new Promise(r => setTimeout(r, 2500));
    const plate = g.L.nodes.get('P').val, door = g.L.doors.find(d => d.inputs[0] === 'P');
    return { task, echoState: g.echo.state, plate, doorOpen: door.open.toFixed(2) };
  });
  console.log('ECHO PLATE:', JSON.stringify(r));
  // collect cores by teleport
  r = await ev(async () => {
    const g = window.__nabd.game, p = g.player;
    const cores = g.L.pickups.filter(o => o.kind === 'core');
    for (const c of cores) { p.x = c.x; p.y = c.y; await new Promise(r => setTimeout(r, 120)); }
    return { cores: g.missions.c.core, prim: g.missions.primary.map(m => m.type + ':' + m.done).join(',') };
  });
  console.log('CORES:', JSON.stringify(r));
  // hack via UI: open and solve programmatically
  r = await ev(async () => {
    const g = window.__nabd.game, U = window.__nabd.UI, t = g.L.terminals[0];
    g.player.x = t.x + 32; g.player.y = t.y; g.openHack(t);
    await new Promise(r => setTimeout(r, 200));
    // brute-force solve: try rotating each tile until win using search
    const h = U.hk; const n = h.n;
    // DFS over rotations is huge; instead use the known spanning tree: rotate each tile to match base pre-scramble by trying 4 rotations greedily with BFS powered check
    const rot = m => ((m << 1) & 15) | (m >> 3);
    // solve by backtracking with constraint propagation (small n)
    const N = n*n, opts = [];
    for (let i = 0; i < N; i++) { const s = new Set(); let m = h.mask[i]; for (let k = 0; k < 4; k++) { s.add(m); m = rot(m); } opts.push([...s]); }
    // simple randomized hill-climb: rotate tiles until powered win
    let tries = 0;
    while (!window.__hackWin && tries < 20000) {
      const i = Math.floor(Math.random()*N); const btn = document.querySelectorAll('#hkGrid .hk')[i];
      U.hackTap(i, btn); tries++;
      if (!U.hk || U.hk.done) break;
    }
    await new Promise(r => setTimeout(r, 700));
    return { hacked: t.val, tries, state: g.state };
  });
  console.log('HACK:', JSON.stringify(r));
  r = await ev(async () => {
    const g = window.__nabd.game, p = g.player;
    await new Promise(r => setTimeout(r, 400));
    const ready = g.missions.exitReady();
    p.x = g.L.exit.x; p.y = g.L.exit.y;
    await new Promise(r => setTimeout(r, 500));
    return { ready, state: g.state, unlocked: window.__nabd.Save.data.unlocked, stars: JSON.stringify(window.__nabd.Save.data.stars), results: document.querySelector('#scrResults').classList.contains('on') };
  });
  console.log('EXIT:', JSON.stringify(r));
  await page.screenshot({ path: path.join(__dirname, 'shots', '40_results.png') });
  // ---- death & respawn ----
  r = await ev(async () => {
    const N = window.__nabd, g = N.game; N.UI.hideAll(); N.UI.restartLevel();
    await new Promise(r => setTimeout(r, 200));
    for (let i = 0; i < 4; i++) { g.player.inv = 0; g.damagePlayer(1, 'shot'); }
    await new Promise(r => setTimeout(r, 1800));
    const dead = document.querySelector('#scrDead').classList.contains('on');
    document.querySelector('#dRespawn').click();
    await new Promise(r => setTimeout(r, 300));
    return { dead, state: g.state, hp: g.player.hp, alive: g.player.alive, diff: g.diff.detect.toFixed(2) };
  });
  console.log('DEATH:', JSON.stringify(r));
  // ---- L3 riddle ----
  r = await ev(async () => {
    const N = window.__nabd, g = N.game; N.UI.openBrief(2); N.UI.startPlay();
    await new Promise(r => setTimeout(r, 300));
    const z = g.L.riddles[0]; g.player.x = z.x + 32; g.player.y = z.y; g.openRiddle(z);
    await new Promise(r => setTimeout(r, 200));
    const q = document.querySelector('#rdQ').textContent;
    return { q };
  });
  console.log('RIDDLE Q:', r.q);
  await page.screenshot({ path: path.join(__dirname, 'shots', '41_riddle.png') });
  r = await ev(async (q) => {
    const N = window.__nabd, g = N.game;
    const rd = window.__RIDDLES || null;
    // find correct answer by matching question in game data via button text: we exposed nothing, so pick by trying first-option list
    return null;
  }, r.q);
  // pick answer: evaluate correct by reading RIDDLES through a debug hook
  const ok = await ev(async () => {
    const btns = [...document.querySelectorAll('#rdOpts .btn')];
    const ans = window.__nabd.riddleAnswer();
    const b = btns.find(x => x.textContent === ans); b.click();
    await new Promise(r => setTimeout(r, 1200));
    const g = window.__nabd.game; await new Promise(r => setTimeout(r, 800));
    return { solved: g.L.riddles[0].val, open: g.L.riddles[0].open.toFixed(2), state: g.state };
  });
  console.log('RIDDLE:', JSON.stringify(ok));
  // ---- L3 mirror puzzle ----
  r = await ev(async () => {
    const g = window.__nabd.game, L = g.L;
    const q = L.mirrors.find(m => m.tx === 27 && m.ty === 19), w = L.mirrors.find(m => m.tx === 27 && m.ty === 24);
    q.interact(g); w.interact(g);
    await new Promise(r => setTimeout(r, 400));
    const r1 = L.nodes.get('R1').val;
    const v = L.mirrors.find(m => m.tx === 40 && m.ty === 19), y = L.mirrors.find(m => m.tx === 40 && m.ty === 24);
    v.interact(g); y.interact(g);
    await new Promise(r => setTimeout(r, 400));
    return { R1: r1, R2: L.nodes.get('R2').val, door6: L.doors.filter(d => d.inputs[0] === 'R2').map(d => d.open.toFixed(2)).join(',') };
  });
  console.log('MIRRORS:', JSON.stringify(r));
  await page.evaluate(() => { const g = window.__nabd.game; g.player.x = 36*32; g.player.y = 22*32; });
  await wait(900);
  await page.screenshot({ path: path.join(__dirname, 'shots', '42_lasers.png') });
  console.log('ERRORS', errs.length, errs.slice(0, 10).join('\n'));
  await browser.close();
})();
