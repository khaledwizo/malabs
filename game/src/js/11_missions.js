// ===================== المهام =====================
class Missions {
  constructor(g, def) {
    this.g = g;
    this.primary = (def.missions || []).map(m => Object.assign({ done: false, prog: 0, need: 0 }, m));
    if (!this.primary.some(m => m.type === 'exit') && g.L.exit) this.primary.push({ type: 'exit', text: 'اصعد إلى مِصعد الأجراس', done: false });
    this.side = (def.side || []).map(m => Object.assign({ done: false, failed: false, prog: 0, need: 0 }, m));
    this.c = { core: 0, rescue: 0, swarmKill: 0, empStun: 0, hints: 0, detected: 0, damage: 0, memory: 0, laserStun: 0, hunterHits: 0 };
    this.refresh();
  }
  onEvent(name, d) {
    const c = this.c;
    switch (name) {
      case 'collect': if (d.kind === 'core') c.core++; else if (d.kind === 'memory') c.memory++; break;
      case 'rescue': c.rescue++; break;
      case 'swarmKill': c.swarmKill++; break;
      case 'empStun': c.empStun++; break;
      case 'laserStun': c.laserStun++; break;
      case 'hint': c.hints++; break;
      case 'detected': c.detected++; break;
      case 'damage': c.damage += d.n; if (d.kind === 'hunter') c.hunterHits++; break;
    }
    this.refresh();
  }
  refresh() {
    const g = this.g, L = g.L, c = this.c;
    for (const m of this.primary) {
      switch (m.type) {
        case 'collect': m.prog = c.core; m.need = m.count; m.done = c.core >= m.count; break;
        case 'hack': { const t = L.nodes.get(m.id); m.done = !!(t && t.val); break; }
        case 'node': { const n = L.nodes.get(m.id); if (n && n.val) m.done = true; break; }
        case 'nests': { let k = 0; for (const id of m.ids) if (L.nodeVal(id)) k++; m.prog = k; m.need = m.ids.length; m.done = k >= m.ids.length; break; }
        case 'rescue': m.prog = c.rescue; m.need = m.count; m.done = c.rescue >= m.count; break;
        case 'boss': m.done = !!g.bossDefeated; break;
        case 'exit': m.done = !!g.completed; break;
      }
    }
    for (const s of this.side) {
      switch (s.type) {
        case 'undetected': s.failed = c.detected > 0; s.done = !s.failed; break;
        case 'nodamage': s.failed = c.damage > 0; s.done = !s.failed; break;
        case 'nohint': s.failed = c.hints > 0; s.done = !s.failed; break;
        case 'time': s.failed = g.time > s.limit; s.done = !s.failed; break;
        case 'rescue': s.need = s.count || L.captives.length; s.prog = c.rescue; s.done = c.rescue >= s.need; break;
        case 'swarm': s.need = s.count; s.prog = c.swarmKill; s.done = c.swarmKill >= s.count; break;
        case 'emp': s.need = s.count; s.prog = c.empStun; s.done = c.empStun >= s.count; break;
        case 'laser': s.need = s.count; s.prog = c.laserStun; s.done = c.laserStun >= s.count; break;
        case 'memory': s.need = 1; s.prog = c.memory; s.done = c.memory >= 1; break;
        case 'nohunter': s.failed = c.hunterHits > 0; s.done = !s.failed; break;
      }
    }
  }
  exitReady() { for (const m of this.primary) if (m.type !== 'exit' && !m.done) return false; return true; }
  stars() { let s = 1; for (const x of this.side) if (x.done && !x.failed) s++; return Math.min(3, s); }
  // نص التقدّم لكل مهمة
  progText(m) {
    if (m.need) return ' (' + Math.min(m.prog, m.need) + '/' + m.need + ')';
    if (m.type === 'time') { const left = m.limit - this.g.time; return left >= 0 ? ' (' + fmtTime(left) + ')' : ''; }
    return '';
  }
}
