// المرحلة 2: الأبواب، مناطق منع النار، اللبلبي والچاي، وأهل السوق الجدد
import { Builder, NULL_GFX } from '../src/world/builder.js';
import { buildSouq } from '../src/world/maps/souq.js';
import { Sim } from '../src/sim/sim.js';
const B = new Builder(NULL_GFX); buildSouq(B); const W = B.finish();
console.log('npcs', W.npcs.length, W.npcs.slice(29).map(n => n.look + '@' + n.x.toFixed(1) + ',' + n.z.toFixed(1)).join(' '));
console.log('looks 4,6,12', W.npcs[4].look, W.npcs[6].look, W.npcs[12].look);
console.log('doors', W.doors.map(d => d.name + '@' + d.x.toFixed(1) + ',' + d.z.toFixed(1)).join(' | '), 'usables', JSON.stringify(W.usables), 'noFire', JSON.stringify(W.noFire));
console.log('nav nodes', W.nav.nodes.length);
// هل يتداخل أهل السوق الجدد مع جدران؟
for (const n of W.npcs.slice(29)) { W.disable(n.box); const hit = W.overlap(n.x, 0.35, n.z, 0.22, 1.3); W.restore(n.box); if (hit) console.log('npc overlap', n.look); }
// وقوف اللاعب يمّ المسلّة والعربانة
console.log('stele solid', W.overlap(63.5, 0.3, -6.8, 0.2, 1.4), 'cart solid', W.overlap(71.6, 0.3, 21.4, 0.2, 0.5));
// الأقرب من عقد الملاحة لكل NPC جديد (للمهام)
for (const n of W.npcs.slice(29)) { let best = 1e9; for (const q of W.nav.nodes) best = Math.min(best, Math.hypot(q[0] - n.x, q[2] - n.z)); console.log('  nearest nav', n.look, best.toFixed(2)); }
const S = new Sim(W, { mode: 'tdm', difficulty: 'normal', timeLimit: 300, seed: 3 });
const me = S.addPlayer({ name: 'me', team: 0, bot: false, loadout: { primary: 'rafid', secondary: 'dijla', nades: ['frag'] } });
S.start(); S.step(1 / 60);
// باب المرقد الشرقي
const d0 = W.doors[0]; me.pos[0] = d0.x + 1.2; me.pos[2] = d0.z; me.pos[1] = 0; me.hp = 50;
let evs = [];
const run = (n, cmd) => { for (let i = 0; i < n; i++) { if (cmd) S.cmd ? S.cmd(me.id, cmd) : (me.cmd = cmd); S.step(1 / 60); evs.push(...S.events); S.events.length = 0; } };
console.log('use fn', typeof S.use, 'setDoor', typeof S.setDoor);
S.use(me); run(2); console.log('door0 open', S.doors[0].open, evs.filter(e => e.t === 'door').length);
run(60 * 11); console.log('after 11s door0 open', S.doors[0].open);
me.pos[0] = -79; me.pos[2] = -4; console.log('inNoFire shrine', S.inNoFire(me));
me.pos[0] = 71.6; me.pos[2] = 22.2; me.hp = 40; S.use(me); run(60 * 7); console.log('lablabi hp', me.hp, 'food', JSON.stringify(me.food), evs.filter(e => e.t === 'heal' || e.t === 'foodOut').map(e => e.t + (e.left ?? '')).join(','));
me.pos[0] = 78; me.pos[2] = 24.6; S.use(me); run(60 * 4); console.log('tea hp', me.hp, 'food', JSON.stringify(me.food));
