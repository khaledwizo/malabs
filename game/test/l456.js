const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 640 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message + ' | ' + (e.stack||'').split('\n').slice(1,3).join(' ')));
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.text()); });
  await page.goto(url); await page.waitForTimeout(800);
  const ev = (f, a) => page.evaluate(f, a);
  for (const i of [3, 4]) {
    const r = await ev(async (i) => {
      const N = window.__nabd, g = N.game; N.UI.openBrief(i); N.UI.startPlay();
      await new Promise(r => setTimeout(r, 2500));
      g.showHint();
      return { lv: i + 1, w: g.L.w, h: g.L.h, enemies: g.enemies.map(e => e.kind + ':' + e.state).join(','), wires: g.L.wires.length, hazards: g.L.hazards.length, hint: g.hint.text };
    }, i);
    console.log('LEVEL', JSON.stringify(r));
    await page.screenshot({ path: path.join(__dirname, 'shots', '50_level' + (i + 1) + '.png') });
  }
  // L4: walk the player into the hall near nest N1 and let swarm hunt
  let r = await ev(async () => {
    const g = window.__nabd.game, T = 32; g.player.x = 13.5*T; g.player.y = 15.5*T;
    await new Promise(r => setTimeout(r, 3000));
    const sw = g.enemies.filter(e => e.kind === 'swarm');
    return { swarm: sw.length, hunting: sw.filter(e => e.state === 'hunt').length, hp: g.player.hp, alive: g.player.alive };
  });
  console.log('L4 SWARM', JSON.stringify(r));
  await page.screenshot({ path: path.join(__dirname, 'shots', '51_swarm.png') });
  r = await ev(async () => {
    const g = window.__nabd.game; g.player.hp = 4; g.player.inv = 3; g.player.energy = 100;
    window.__nabd.Save.data.gadgets = ['scan','emp','decoy','cloak'];
    const before = g.enemies.filter(e => e.kind === 'swarm' && e.alive).length;
    g.curGadget = 1; const ok = useGadgetDebug(g);
    function useGadgetDebug(g) { return window.__nabd.useGadget(g, 'emp'); }
    await new Promise(r => setTimeout(r, 300));
    return { ok, before, after: g.enemies.filter(e => e.kind === 'swarm' && e.alive).length, kills: g.missions.c.swarmKill };
  });
  console.log('L4 EMP', JSON.stringify(r));
  await page.screenshot({ path: path.join(__dirname, 'shots', '52_emp.png') });
  // L5 hunter learning
  r = await ev(async () => {
    const N = window.__nabd, g = N.game; N.UI.openBrief(4); N.UI.startPlay();
    await new Promise(r => setTimeout(r, 400));
    const h = g.enemies.find(e => e.kind === 'hunter');
    g.player.energy = 100; N.useGadget(g, 'decoy'); g.gadgetCd.decoy = 0; g.player.energy = 100; N.useGadget(g, 'decoy');
    g.gadgetCd.emp = 0; g.player.energy = 100; N.useGadget(g, 'emp'); g.gadgetCd.emp = 0; g.player.energy = 100; N.useGadget(g, 'emp');
    // teleport near hunter to get hunted
    g.player.x = h.x - 32 * 2.5; g.player.y = h.y; h.face = Math.PI;
    await new Promise(r => setTimeout(r, 1500));
    return { learn: JSON.stringify(h.learn), ignoreDecoy: h.ignoreDecoy, empRes: h.empRes, state: h.state, hp: g.player.hp };
  });
  console.log('L5 HUNTER', JSON.stringify(r));
  await page.screenshot({ path: path.join(__dirname, 'shots', '53_hunter.png') });
  // L6 boss full run
  r = await ev(async () => {
    const N = window.__nabd, g = N.game; N.UI.openBrief(5); N.UI.startPlay();
    await new Promise(r => setTimeout(r, 1500));
    const b = g.boss, L = g.L, log = [];
    g.godMode = true;
    for (let phase = 1; phase <= 3; phase++) {
      for (const py of L.pylons) {
        // find assignment
        let v = null; for (let m = 0; m < 8; m++) { const a = !!(m&1), bb = !!(m&2), c = !!(m&4); if (py.need.f(a, bb, c)) { v = [a, bb, c]; break; } }
        ['A','B','C'].forEach((id, k) => { const sw = L.nodes.get(id); sw.val = v[k]; });
        g.player.x = py.x; g.player.y = py.y; g.player.hp = 4; g.player.inv = 5;
        await new Promise(r => setTimeout(r, 1900));
        log.push(py.name + '=' + py.need.t + ':' + py.val);
      }
      log.push('shield:' + b.shield);
      // go to core marker and hold interact
      const mk = b.markers[1]; g.player.x = mk.x; g.player.y = mk.y - 32; g.player.face = Math.PI / 2; g.player.inv = 5;
      await new Promise(r => setTimeout(r, 200));
      log.push('target:' + (g.interactTarget && g.interactTarget.type));
      window.__holdE = true;
      return { log, phase: b.phase };
    }
  });
  console.log('BOSS P1', JSON.stringify(r));
  await page.keyboard.down('KeyE'); await page.waitForTimeout(1600); await page.keyboard.up('KeyE');
  await page.waitForTimeout(300);
  r = await ev(() => { const b = window.__nabd.game.boss; return { phase: b.phase, shield: b.shield, defeated: b.defeated, atk: b.atk && b.atk.k, scores: JSON.stringify(Object.fromEntries(Object.entries(b.scores).map(([k,v])=>[k,+v.toFixed(2)]))) }; });
  console.log('BOSS after overload', JSON.stringify(r));
  await page.screenshot({ path: path.join(__dirname, 'shots', '54_boss.png') });
  // finish phases 2,3 quickly
  for (let ph = 0; ph < 2; ph++) {
    await ev(async () => {
      const g = window.__nabd.game, b = g.boss, L = g.L;
      for (const py of L.pylons) {
        let v = null; for (let m = 0; m < 8; m++) { const a = !!(m&1), bb = !!(m&2), c = !!(m&4); if (py.need.f(a, bb, c)) { v = [a, bb, c]; break; } }
        ['A','B','C'].forEach((id, k) => { L.nodes.get(id).val = v[k]; });
        g.player.x = py.x; g.player.y = py.y; g.player.hp = 4; g.player.inv = 5;
        await new Promise(r => setTimeout(r, 1900));
      }
      const mk = b.markers[1]; g.player.x = mk.x; g.player.y = mk.y - 32; g.player.face = Math.PI / 2; g.player.inv = 5;
      await new Promise(r => setTimeout(r, 200));
    });
    await page.keyboard.down('KeyE'); await page.waitForTimeout(1600); await page.keyboard.up('KeyE');
    await page.waitForTimeout(300);
  }
  r = await ev(async () => { const g = window.__nabd.game, b = g.boss; await new Promise(r => setTimeout(r, 1200)); return { phase: b.phase, defeated: b.defeated, bossDefeated: g.bossDefeated, exitReady: g.missions.exitReady(), exitDoor: g.L.doors.map(d => d.open.toFixed(1)).join(',') }; });
  console.log('BOSS END', JSON.stringify(r));
  await page.screenshot({ path: path.join(__dirname, 'shots', '55_boss_end.png') });
  r = await ev(async () => { const g = window.__nabd.game; g.player.x = g.L.exit.x; g.player.y = g.L.exit.y; await new Promise(r => setTimeout(r, 600)); return { state: g.state, finished: window.__nabd.Save.data.finished }; });
  console.log('FINAL', JSON.stringify(r));
  console.log('ERRORS', errs.length); console.log([...new Set(errs)].slice(0, 12).join('\n'));
  await browser.close();
})();
