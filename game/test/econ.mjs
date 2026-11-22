// اختبار المرحلة 1: وضع السيطرة + مخزون لاعب محدود + حدث supply بالنهاية
import { Builder, NULL_GFX } from '../src/world/builder.js';
import { buildSouq } from '../src/world/maps/souq.js';
import { Sim } from '../src/sim/sim.js';
const B = new Builder(NULL_GFX); buildSouq(B); const W = B.finish();
for (const [mode, n] of [['dom', 2], ['dom', 6], ['tdm', 6], ['rounds', 4]]) {
  const S = new Sim(W, { mode, difficulty: 'normal', roundsToWin: 2, timeLimit: 150, roundTime: 60, seed: 9 });
  // «اللاعب» بوت بعقل لكن بمخزون محدود (نحذف علامة البوت بعد الإضافة حتى يُحسب كإنسان)
  const sup = { ammo: { auto: 120, shot: 16, pist: 45, dmr: 30, snip: 10 }, nades: { frag: 2, molotov: 1, smoke: 0, flash: 0 }, meds: { b: 4, s: 2 } };
  const me = S.addPlayer({ name: 'me', team: 0, bot: true, loadout: { primary: 'rafid', secondary: 'dijla', nades: ['frag', 'molotov'], supply: sup } });
  me.sup = JSON.parse(JSON.stringify(sup)); me.meds = me.sup.meds;
  for (let i = 1; i < n; i++) S.addPlayer({ name: 'b' + i, team: i % 2, bot: true });
  S.start();
  let caps = 0, sup2 = null, over = false, throws = 0;
  for (let k = 0; k < 60 * 400 && !over; k++) {
    S.step(1 / 60);
    for (const e of S.events) { if (e.t === 'cap') caps++; if (e.t === 'supply') sup2 = e; if (e.t === 'matchOver') over = true; if (e.t === 'throw' && e.id === me.id) throws++; }
    S.events.length = 0;
  }
  console.log(mode, n, 'cps', (S.cps || []).map(c => `${c.name}(${c.x.toFixed(0)},${c.z.toFixed(0)}) o${c.owner}`).join(' '), 'caps', caps, 'score', S.score.join(':'), 'over', over);
  console.log('   me kills', me.kills, 'kh', me.kh || 0, 'kb', me.kb || 0, 'throws', throws, 'supply', sup2 ? JSON.stringify(sup2.sup.ammo) + ' nades ' + JSON.stringify(sup2.sup.nades) + ' meds ' + JSON.stringify(sup2.sup.meds) + ' res ' + sup2.res : 'NONE (me is bot → expected none)');
}
