// ===================== الأدوات =====================
const ICONS = {
  scan: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".7"/><path d="M12 12 L19 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="15" r="1.6" fill="currentColor"/></svg>',
  emp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.4"/><path d="M13.5 3.5 L7 13 h4.5 L10 20.5 L17 10.5 h-4.6 z" fill="currentColor"/></svg>',
  decoy: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20 C6 15 18 15 19 20" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 9 h2 M19 9 h2 M12 1.5 v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".7"/></svg>',
  cloak: '<svg viewBox="0 0 24 24"><path d="M2 12 C5 6.5 19 6.5 22 12 C19 17.5 5 17.5 2 12 Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M4 20 L20 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  dash: '<svg viewBox="0 0 24 24"><path d="M4 6 l6 6 -6 6 M11 6 l6 6 -6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M8 13 V5.5 a1.5 1.5 0 0 1 3 0 V11 V4 a1.5 1.5 0 0 1 3 0 v7 V5.5 a1.5 1.5 0 0 1 3 0 V14 c0 4 -2.5 7 -6.5 7 c-3 0 -4.5 -1.5 -6 -4 l-2 -3.5 a1.4 1.4 0 0 1 2.4 -1.4 z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  echo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="currentColor"/><ellipse cx="12" cy="12" rx="9.5" ry="4" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(-20 12 12)"/></svg>',
  hint: '<svg viewBox="0 0 24 24"><path d="M9 18 h6 M10 21 h4 M12 3 a6 6 0 0 1 3.6 10.8 c-.8 .6 -1.1 1.4 -1.1 2.2 h-5 c0 -.8 -.3 -1.6 -1.1 -2.2 A6 6 0 0 1 12 3 z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  cycle: '<svg viewBox="0 0 24 24"><path d="M4 9 h13 l-3.5 -3.5 M20 15 H7 l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.5 l2.9 6.2 6.6 .7 -5 4.5 1.4 6.6 L12 17.2 6.1 20.5 7.5 13.9 2.5 9.4 l6.6 -.7 z" fill="currentColor"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5 V7.5 a4 4 0 0 1 8 0 v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};

const GADGETS = {
  scan: { name: 'بصيرة الصدى', short: 'بصيرة', cost: 20, cd: 7, desc: 'موجة تكشف الأعداء ودروب دورياتهم وما يهمّك عبر الجدران لست ثوانٍ.' },
  emp: { name: 'صرخة الجرس', short: 'صرخة', cost: 45, cd: 12, desc: 'صرخة تُسكت الرقباء والعيون القريبة 5 ثوانٍ، تبدّد ذبّان النحاس، وتطفئ الأشعة لحظات.' },
  decoy: { name: 'قرين الظل', short: 'قرين', cost: 30, cd: 9, desc: 'ظلٌّ يشبهك يُرمى أمامك ويصدر صوتاً متكرراً يجذب الأعداء بعيداً عنك.' },
  cloak: { name: 'عباءة السكون', short: 'عباءة', cost: 50, cd: 16, desc: 'تختفي عن الأنظار 5 ثوانٍ. لكن صوت ركضك ما زال يُسمع!' },
};
const GADGET_ORDER = ['scan', 'emp', 'decoy', 'cloak'];

function useGadget(g, id) {
  const G = GADGETS[id], p = g.player;
  if (!G || !g.hasGadget(id) || !p.alive) return false;
  if ((g.gadgetCd[id] || 0) > 0) { g.toast(G.name + ': تعود بعد ' + Math.ceil(g.gadgetCd[id]) + ' ث'); Sound.play('uiBack'); return false; }
  if (p.energy < G.cost) { g.toast('النبض لا يكفي لـ' + G.name); Sound.play('uiBack'); return false; }
  p.energy -= G.cost; g.gadgetCd[id] = G.cd; g.gadgetUses[id] = (g.gadgetUses[id] || 0) + 1;
  switch (id) {
    case 'scan':
      g.scanT = g.perk('owl') ? 11 : 6; g.scanStart = g.t;
      Sound.play('scan'); FX.ring(p.x, p.y, 6, 14 * T, 1.2, PAL.cyan, 3);
      break;
    case 'emp': {
      const R0 = 4.2 * T * (g.perk('bell') ? 1.4 : 1), extra = g.perk('bell') ? 1 : 0; let drones = 0;
      for (const e of g.enemies) {
        if (!e.alive || dist2(e.x, e.y, p.x, p.y) > R0 * R0) continue;
        if (e.kind === 'swarm') e.die(g);
        else if (e.kind !== 'nest') { e.stun((e.kind === 'turret' ? 6 : 5) + extra); if (e.kind === 'drone') drones++; g.event('empStun', e); }
      }
      for (const em of g.L.emitters) if (dist2(em.x, em.y, p.x, p.y) < R0 * R0) em.empT = 3;
      if (g.boss) g.boss.onEmp(g, p.x, p.y, R0);
      g.noise(p.x, p.y, 9 * T, 'emp');
      Sound.play('emp'); R.addTrauma(0.35); g.flash = 0.7; UI.buzz(50);
      FX.ring(p.x, p.y, 4, R0, 0.55, PAL.cyan, 7); FX.ring(p.x, p.y, 4, R0 * 0.7, 0.4, '#ffffff', 3);
      FX.burst(p.x, p.y, 40, PAL.cyan, 260, 0.5, 1.6);
      g.event('empHit', drones);
      break;
    }
    case 'decoy': {
      const dx = Math.cos(p.face), dy = Math.sin(p.face);
      const d = Math.max(0, g.L.ray(p.x, p.y, dx, dy, 4 * T, g.L.move) - T * 0.4);
      const x = p.x + dx * d, y = p.y + dy * d;
      g.decoys.length = 0; const dc = new Decoy(x, y); if (g.perk('dusk')) dc.life = 12; g.decoys.push(dc);
      Sound.play('decoy'); FX.burst(x, y, 14, PAL.cyan, 100, 0.4, 1.6, 1);
      break;
    }
    case 'cloak':
      p.cloak = g.perk('dusk') ? 8 : 5; Sound.play('cloak'); FX.burst(p.x, p.y, 18, '#9fdcff', 110, 0.5, 1.6, 1);
      for (const e of g.enemies) if (e.alive && e.canSee) e.sus = Math.min(e.sus, 0.5);
      break;
  }
  for (const e of g.enemies) if (e.kind === 'hunter' && e.alive) e.learnFrom(id, g);
  g.event('gadget', id);
  return true;
}
