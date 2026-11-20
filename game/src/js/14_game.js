// ===================== اللعبة: إدارة الحالة والتحديث والرسم =====================
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t - px, y = ay + dy * t - py;
  return x * x + y * y;
}
const DEATH_TEXT = {
  laser: 'أحرقك شعاع أحمر.', shot: 'أصابتك طلقات الرقباء.', swarm: 'انقضّ عليك ذبّان النحاس.', hunter: 'أدركك الصيّاد الذي لا ينسى.',
  hazard: 'صعقتك الأرضية المكهربة.', boss: 'أسكتتك العين.',
};
// «طيفك»: ما يتبقّى منك عند السقوط، يحرس رنينك
class Shade {
  constructor(x, y, amt) { this.x = x; this.y = y; this.amt = amt; this.ph = Math.random() * 6; this.ping = 2.5; }
  update(dt, g) {
    this.ph += dt; this.ping -= dt;
    if (this.ping <= 0) { this.ping = 3.4; g.noise(this.x, this.y, 6 * T, 'shade'); FX.ring(this.x, this.y, 4, 44, 0.9, '#8a6cff', 2); }
    const p = g.player;
    if (p.alive && dist2(p.x, p.y, this.x, this.y) < (T * 0.85) ** 2) g.recoverShade();
    if (p.alive && dist2(p.x, p.y, this.x, this.y) < (8 * T) ** 2 && g.L.los(p.x, p.y, this.x, this.y)) g.unlockJournal('shade');
  }
  draw(ctx) { ctx.fillStyle = 'rgba(10,6,20,0.5)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 10, 9, 4, 0, 0, TAU); ctx.fill(); }
  emit(ctx, t, glow) {
    const x = this.x, y = this.y - 4 + Math.sin(this.ph * 2) * 3;
    ctx.globalAlpha = 0.45; ctx.drawImage(Sprites.glow('#6a4cff'), x - 22, y - 22, 44, 44); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(16,10,30,0.92)'; ctx.beginPath(); ctx.arc(x, y, 9, Math.PI, 0);
    for (let k = 0; k <= 4; k++) ctx.lineTo(x + 9 - k * 4.5, y + 9 + (k % 2 ? -3 : 2) + Math.sin(this.ph * 5 + k) * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9b8ff'; ctx.beginPath(); ctx.arc(x - 3, y - 1, 1.8, 0, TAU); ctx.arc(x + 3, y - 1, 1.8, 0, TAU); ctx.fill();
    if (!glow) txtLabel(ctx, '◈ ' + this.amt, x, y - 17, col('#c9b8ff', 0.85), 8.5);
  }
}

class Game {
  constructor() {
    this.state = 'menu'; this.L = null; this.def = null; this.levelIndex = 0; this.demo = false;
    this.player = null; this.echo = null; this.enemies = []; this.bullets = []; this.decoys = []; this.boss = null;
    this.missions = null; this.director = null; this.time = 0; this.t = 0; this.dt = 0;
    this.gadgetCd = {}; this.gadgetUses = {}; this.curGadget = 0; this.score = 0; this.dynDone = 0; this.deathsHere = 0;
    this.diff = { view: 1, detect: 1, fire: 1, spread: 1, speed: 1 };
    this.checkpoint = null; this.completed = false; this.bossDefeated = false;
    this.pflow = null; this.pflowTile = -1; this.pflowT = 0; this.flowOut = [0, 0];
    this.interactTarget = null; this.heatT = 0; this.litT = 0; this.scanT = 0; this.scanStart = 0; this.flash = 0; this.hurtFlash = 0;
    this.hint = null; this.alarm = 0; this.dieT = 0; this.deathKind = ''; this.usedRiddles = new Set(); this.saidOnce = new Set();
    this.triggers = []; this.lineQ = []; this.demoT = 0; this.alertOnce = false; this.detectedTotal = 0;
    this.shade = null; this.focusT = 0; this.strikeTarget = null; this.strikeCd = 0; this.journalT = 0; this.dust = []; this.bossCard = false;
  }
  perk(id) { return !this.demo && Save.data.equipped.includes(id); }
  applyPerks() {
    const p = this.player; if (!p) return;
    const max = 4 + (this.perk('heart') ? 1 : 0);
    if (p.maxHp !== max) { const d = max - p.maxHp; p.maxHp = max; p.hp = clamp(p.hp + Math.max(0, d), 1, max); }
  }
  addRnn(n, x, y) {
    if (this.demo || !(n > 0)) return;
    n = Math.round(n); Save.data.rnn += n;
    if (x != null) FX.text(x, y - 18, '+' + n + ' ◈', '#cfe3ff');
  }
  unlockJournal(kind) {
    if (this.demo || !JOURNAL[kind] || Save.data.journal[kind]) return;
    Save.data.journal[kind] = 1; Save.persist();
    UI.toast('سُجّل في سجلّ الكائنات: ' + JOURNAL[kind].name);
  }
  rest(dock) {
    for (const c of this.L.checkpoints) { c.active = false; c.rested = false; }
    dock.active = true; dock.rested = true; this.checkpoint = { x: dock.x, y: dock.y };
    const p = this.player; p.hp = p.maxHp; p.energy = p.maxEnergy;
    Sound.play('check'); FX.ring(dock.x, dock.y, 4, 46, 0.8, PAL.mint, 3); FX.burst(dock.x, dock.y, 16, PAL.mint, 90, 0.6, 1.6, 1);
    UI.toast('استرحتَ في المرسى — حُفظ تقدّمك. اضغط مجدداً لتبديل التمائم'); Save.persist(); this.event('rest', dock);
  }
  readTablet(tb) {
    const m = tb.mem ? MEMORIES[tb.mem] : null;
    if (!tb.read) {
      tb.read = true;
      if (tb.mem) { if (!Save.data.memories.includes(tb.mem)) { Save.data.memories.push(tb.mem); Save.persist(); } this.event('collect', { kind: 'memory' }); }
    }
    Sound.play('riddle');
    UI.showMemory({ title: m ? m.title : 'لوح منقوش', text: m ? m.text : tb.text }, !!m);
  }
  talkTo(npc) {
    const L = NPC_LINES[npc.id]; if (!L) return;
    const met = Save.data.met || (Save.data.met = {});
    const lines = met[npc.id] ? [pick(L.again)] : L.first;
    met[npc.id] = 1; Save.persist();
    this.state = 'talk'; Sound.play('blip');
    UI.openTalk(npc.id, lines);
  }
  recoverShade() {
    const s = this.shade; if (!s) return;
    this.shade = null; Save.data.shade = null;
    this.addRnn(s.amt, s.x, s.y); Sound.play('chip'); FX.burst(s.x, s.y, 30, '#8a6cff', 160, 0.7, 1.8, 1);
    UI.toast('استعدتَ رنينك من طيفك'); Save.persist();
  }
  findStrike() {
    const p = this.player; let best = null, bd = (T * 1.3) ** 2;
    for (const e of this.enemies) {
      if (!e.alive || !(e.kind === 'drone' || e.kind === 'hunter' || e.kind === 'swarm')) continue;
      if (e.kind !== 'swarm' && e.canSee && (e.state === 'chase' || e.state === 'hunt')) continue;
      if (e.stunT > 4) continue;
      const d2 = dist2(p.x, p.y, e.x, e.y); if (d2 > bd) continue;
      if (Math.abs(angDiff(p.face, Math.atan2(e.y - p.y, e.x - p.x))) > 1.9) continue;
      if (!this.L.los(p.x, p.y, e.x, e.y)) continue;
      bd = d2; best = e;
    }
    return best;
  }
  strike() {
    const e = this.strikeTarget, p = this.player;
    if (!e || this.strikeCd > 0) return;
    this.strikeCd = 1.1;
    const a = Math.atan2(e.y - p.y, e.x - p.x); p.vx += Math.cos(a) * 160; p.vy += Math.sin(a) * 160; p.face = a;
    Sound.play('switch'); Sound.play('stun'); UI.buzz(25); R.addTrauma(0.15);
    FX.burst(e.x, e.y, 18, '#ffffff', 170, 0.3, 1.4); FX.ring(e.x, e.y, 3, 26, 0.3, '#ffffff', 2);
    if (e.kind === 'swarm') { e.die(this); }
    else if (e.kind === 'drone') {
      e.stun(12); if (!e.struck) { e.struck = true; this.addRnn(8, e.x, e.y); }
      if (!this.saidOnce.has('strike')) { this.saidOnce.add('strike'); this.toast('أطفأتَ رقيباً بالنقرة الصامتة'); }
      this.event('strike', e);
    }
    else { e.stun(2.5); this.noise(p.x, p.y, 5 * T, 'strike'); }
    this.noise(p.x, p.y, 2 * T, 'strike');
  }
  hasGadget(id) { return this.demo || Save.data.gadgets.includes(id); }
  gadgets() { return GADGET_ORDER.filter(id => this.hasGadget(id)); }
  computeDiff() {
    const d = Math.min(this.deathsHere, 4);
    return { view: 1 - 0.06 * d, detect: 1 - 0.09 * d, fire: 1 - 0.08 * d, spread: 1 + 0.3 * d, speed: 1 - 0.03 * d };
  }
  loadLevel(i, demo = false) {
    const def = demo ? DEMO_LEVEL : LEVELS[i];
    this.def = def; this.levelIndex = i; this.demo = demo;
    FX.clear();
    const L = this.L = new Level(def, demo ? 99 : i);
    this.player = new Player(this, L.start.x, L.start.y);
    this.player.face = (def.startFace || 0) * Math.PI / 180;
    this.echo = def.noEcho ? null : new Echo(this, L.start.x - T, L.start.y + T * 0.3);
    this.enemies = []; this.bullets = []; this.decoys = []; this.boss = null;
    for (const s of L.enemySpecs) this.spawnEnemy(s);
    this.time = 0; this.score = 0; this.dynDone = 0; this.completed = false; this.bossDefeated = false;
    if (!demo && this.lastLevel !== i) this.deathsHere = 0;
    this.lastLevel = demo ? this.lastLevel : i;
    this.diff = this.computeDiff();
    this.checkpoint = { x: L.start.x, y: L.start.y };
    this.gadgetCd = {}; this.gadgetUses = {}; this.hint = null; this.scanT = 0; this.alarm = 0; this.flash = 0; this.hurtFlash = 0;
    this.pflow = new Int16Array(L.N); this.pflowTile = -1;
    this.saidOnce = new Set(); this.lineQ = []; this.alertOnce = false; this.huntTriggered = false;
    this.triggers = (def.triggers || []).map(tr => Object.assign({ done: false }, tr));
    this.missions = new Missions(this, def);
    this.director = new Director(this);
    for (const o of L.objects) if (o.type === 'tablet' && !o.mem) { const e = (def.tablets || []).find(t => t.x === o.tx && t.y === o.ty); o.text = e ? e.text : '…'; }
    for (const o of L.pickups) if (o.kind === 'charm' && Save.data.charms.includes(o.charm)) o.taken = true;
    const sh = Save.data.shade;
    this.shade = (!demo && sh && sh.lv === i) ? new Shade(sh.x, sh.y, sh.amt) : null;
    this.focusT = 0; this.strikeTarget = null; this.strikeCd = 0; this.bossCard = false; this.dust = [];
    this.applyPerks(); this.player.hp = this.player.maxHp;
    // تسوية المنطق والأبواب في حالتها الأولية
    for (let k = 0; k < 4; k++) {
      L.traceLasers();
      for (const o of L.objects) if (o.type === 'receiver' || o.type === 'plate') o.update(0, this);
      L.evalLogic(0);
    }
    for (const d of L.doors) { d.orient(); d.target = d.wanted(); d.open = d.target ? 1 : 0; }
    L.rebuild(); L.computeLit();
    R.camX = this.player.x; R.camY = this.player.y;
    if (demo) { this.player.cloak = 1e9; this.demoT = 0; }
    this.curGadget = clamp(this.curGadget, 0, Math.max(0, this.gadgets().length - 1));
  }
  spawnEnemy(s) {
    const t = s.spec.t;
    if (t === 'drone') this.enemies.push(new Drone(this, s.spec, s.x, s.y));
    else if (t === 'turret') this.enemies.push(new Turret(this, s.spec, s.x, s.y));
    else if (t === 'nest') this.enemies.push(new Nest(this, s.spec, s.x, s.y));
    else if (t === 'hunter') this.enemies.push(new Hunter(this, s.spec, s.x, s.y));
    else if (t === 'boss' && typeof Boss !== 'undefined') { this.boss = new Boss(this, s.spec, s.x, s.y); this.enemies.push(this.boss); }
  }
  // ---------- الأحداث ----------
  event(name, d) {
    if (this.demo) return;
    if (this.missions) this.missions.onEvent(name, d);
    if (this.director) this.director.onEvent(name, d);
    this.lines(name, d);
    if (name === 'swarmKill') this.addRnn(2);
    if (name === 'collect' && d.kind === 'core' && this.def.huntOnCores && !this.huntTriggered) {
      const left = this.L.pickups.filter(o => o.kind === 'core' && !o.taken).length;
      if (left === 0) { this.huntTriggered = true; for (const e of this.enemies) if (e.kind === 'hunter') e.forceHunt = this.def.huntOnCores; this.say('over', 'أخذتَ آخر جرس… الصيّاد شمّ أثرك الآن. اركض!', 0, 'high'); Sound.play('alarm'); this.alarm = 1; }
    }
  }
  lines(name, d) {
    if (this.boss && name !== 'damage') return;
    const once = (key, who, text) => { if (this.saidOnce.has(key)) return; this.saidOnce.add(key); this.say(who, text); };
    const lv = this.def.lines || {};
    if (lv[name] && !this.saidOnce.has('lv:' + name)) { this.saidOnce.add('lv:' + name); const l = lv[name]; this.say(l[0], l[1]); return; }
    switch (name) {
      case 'detected': once('det', 'echo', 'رآك! اكسر خط الرؤية — اختبئ خلف الجدران أو الصناديق.'); break;
      case 'damage': if (this.player.hp === 1) once('low', 'echo', 'وتر واحد بقي! ركّز (اضغط «تفاعل» مطوّلاً) أو استرح في مرسى.', 0); break;
      case 'collect': if (d.kind === 'core') { const m = this.missions.primary.find(x => x.type === 'collect'); if (m && m.done) once('allcores', 'echo', 'رنّت كل الأجراس المطلوبة!'); } break;
      case 'doorOpen': once('door1', 'echo', 'انفتح باب! تابع المسار.'); break;
      case 'exitOpen': once('exit', 'echo', 'مِصعد الأجراس يعمل الآن. هيا نصعد!'); break;
      case 'swarmKill': if (this.missions.c.swarmKill === 1) once('sw', 'echo', 'الذبّان هشّ: صرخة جرس أو شعاع أو نقرة تكفي.'); break;
      case 'laserStun': once('ls', 'echo', 'ذكي! أوقعتَ الرقيب في الشعاع.'); break;
    }
  }
  say(who, text, dur, prio) { if (this.demo) return; UI.say(who, text, dur, prio || 'low'); }
  toast(msg) { if (this.demo) return; UI.toast(msg); }
  // ---------- الضجيج والإنذار ----------
  noise(x, y, radius, kind, src) {
    if (this.demo) return;
    for (const e of this.enemies) {
      if (!e.alive || !e.hear) continue;
      const r = radius * (e.hearMult || 1), d2 = dist2(e.x, e.y, x, y);
      if (d2 > r * r) continue;
      if (!this.L.los(e.x, e.y, x, y) && d2 > (r * 0.55) ** 2) continue;
      e.hear(x, y, kind, src);
    }
    if (Settings.aiDebug && kind !== 'step') FX.ring(x, y, 2, radius, 0.6, '#ffffff', 1);
    else if (Settings.aiDebug) FX.ring(x, y, 2, radius, 0.3, '#888888', 0.8);
  }
  alertNearby(src, x, y) {
    let k = 0;
    for (const e of this.enemies) {
      if (e === src || !e.alive || !e.alert) continue;
      if (dist2(e.x, e.y, src.x, src.y) > (9.5 * T) ** 2) continue;
      e.alert(x, y, k++);
    }
  }
  onDetected(e) {
    if (this.demo) return;
    this.detectedTotal++; Save.data.stats.detections++;
    this.alarm = 1;
    this.event('detected', e);
  }
  damagePlayer(n, kind, fx, fy) {
    const p = this.player;
    if (!p.alive || p.inv > 0 || this.demo || this.godMode || this.state !== 'playing' && this.state !== 'hack') return;
    p.hp -= n; p.inv = 1; p.hurtT = 0.5; this.hurtFlash = 1; R.addTrauma(0.45); Sound.play('hurt'); UI.buzz(40);
    this.focusT = 0; p.focusing = false;
    if (fx != null) { const dx = p.x - fx, dy = p.y - fy, d = Math.hypot(dx, dy) || 1; p.vx += dx / d * 280; p.vy += dy / d * 280; }
    FX.burst(p.x, p.y, 14, PAL.red, 150, 0.4, 1.6);
    if (this.state === 'hack') UI.abortHack();
    this.event('damage', { n, kind });
    if (p.hp <= 0) this.playerDie(kind);
  }
  playerDie(kind) {
    const p = this.player;
    p.alive = false; p.hp = 0; this.deathsHere++; Save.data.stats.deaths++; this.deathKind = kind; UI.buzz(180); p.focusing = false;
    if (Save.data.rnn > 0) { Save.data.shade = { lv: this.levelIndex, x: Math.round(p.x), y: Math.round(p.y), amt: Save.data.rnn }; this.shade = new Shade(p.x, p.y, Save.data.rnn); Save.data.rnn = 0; }
    Save.persist();
    FX.burst(p.x, p.y, 40, PAL.mint, 220, 0.8, 2); FX.debris(p.x, p.y, 14, '#c9d3db'); FX.smoke(p.x, p.y, 10);
    Sound.play('explode'); Sound.play('lose'); R.addTrauma(0.8);
    this.state = 'dying'; this.dieT = 1.3;
    if (this.echo) this.echo.recall && (this.echo.state = 'follow');
  }
  respawn() {
    const p = this.player, c = this.checkpoint;
    p.x = c.x; p.y = c.y; p.vx = p.vy = 0; p.alive = true; p.hp = p.maxHp; p.energy = Math.max(p.energy, 60); p.inv = 2; p.cloak = 0; p.busy = false; p.dashT = 0;
    for (const e of this.enemies) e.reset();
    this.enemies = this.enemies.filter(e => e.alive);
    this.bullets.length = 0; this.decoys.length = 0;
    if (this.echo) this.echo.reset(p.x, p.y);
    this.diff = this.computeDiff(); this.alarm = 0;
    if (this.director.dyn) this.director.finish(false);
    R.camX = p.x; R.camY = p.y;
    this.state = 'playing';
    if (this.deathsHere >= 1 && this.deathsHere <= 4) this.say('echo', 'الراوي خفّف يقظة الحراس قليلاً بعد سقوطك.' + (this.shade ? ' وطيفك ينتظرك حيث سقطت.' : ''), 0, 'mid');
  }
  collect(o) {
    o.taken = true;
    const p = this.player;
    switch (o.kind) {
      case 'core': this.score += 100; Save.data.stats.cores++; Sound.play('core'); FX.burst(o.x, o.y, 20, PAL.cyan, 150, 0.6, 1.6, 1); FX.text(o.x, o.y - 14, 'جرس ذاكرة', PAL.cyan); this.addRnn(15); break;
      case 'shard': { Sound.play('energy'); this.addRnn(5 * (this.perk('magnet') ? 1.25 : 1), o.x, o.y); FX.burst(o.x, o.y, 6, '#cfe3ff', 70, 0.3, 1.2, 1); break; }
      case 'charm': {
        if (o.charm && !Save.data.charms.includes(o.charm)) {
          Save.data.charms.push(o.charm);
          const used = Save.data.equipped.reduce((s, id) => s + (CHARMS[id] ? CHARMS[id].cost : 0), 0);
          const auto = used + CHARMS[o.charm].cost <= Save.data.notches;
          if (auto) Save.data.equipped.push(o.charm);
          Save.persist(); this.applyPerks();
          Sound.play('chip'); FX.burst(o.x, o.y, 30, '#e6b8ff', 170, 0.8, 1.8, 1);
          UI.showItem('charm', o.charm, auto ? 'حُملت تلقائياً في خانة فارغة. بدّل تمائمك من أي مرسى.' : 'خاناتك ممتلئة — استرح في مرسى لتحملها بدل أخرى.');
        }
        break;
      }
      case 'energy': { const big = o.bonus; p.energy = Math.min(p.maxEnergy, p.energy + (big ? 100 : 45)); Sound.play('energy'); FX.burst(o.x, o.y, 14, PAL.yellow, 120, 0.5, 1.4, 1); FX.text(o.x, o.y - 14, big ? 'نبض كامل!' : '+نبض', PAL.yellow); break; }
      case 'health': p.hp = Math.min(p.maxHp, p.hp + 1); Sound.play('health'); FX.text(o.x, o.y - 14, '+وتر', '#ff8fa3'); break;
      case 'chip': {
        const id = o.gadget;
        if (id && !Save.data.gadgets.includes(id)) {
          Save.data.gadgets.push(id); Save.persist();
          this.curGadget = this.gadgets().indexOf(id);
          Sound.play('chip'); FX.burst(o.x, o.y, 30, PAL.gold, 180, 0.8, 1.8, 1);
          UI.gadgetUnlocked(id);
        } else { p.energy = p.maxEnergy; Sound.play('energy'); FX.text(o.x, o.y - 14, 'نبض كامل', PAL.yellow); }
        break;
      }
      case 'memory': {
        Sound.play('chip'); FX.burst(o.x, o.y, 24, PAL.violet, 150, 0.7, 1.6, 1);
        if (o.mem && !Save.data.memories.includes(o.mem)) { Save.data.memories.push(o.mem); Save.persist(); }
        const m = MEMORIES[o.mem]; if (m) UI.showMemory(m);
        break;
      }
    }
    this.event('collect', o);
  }
  spawnBonus(x, y, kind, bonus) {
    const L = this.L, tx = Math.floor(x / T), ty = Math.floor(y / T);
    const o = new Pickup(L, tx, ty, { t: kind }); o.bonus = !!bonus;
    L.objects.push(o); L.pickups.push(o); L.floorAt[L.idx(tx, ty)] = o;
    FX.ring(o.x, o.y, 4, 30, 0.8, PICKUP_COL[kind], 3);
    return o;
  }
  explore(x, y, r) {
    const L = this.L, tx = Math.floor(x / T), ty = Math.floor(y / T);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = tx + dx, Y = ty + dy;
      if (!L.inb(X, Y) || dx * dx + dy * dy > r * r) continue;
      const i = L.idx(X, Y);
      if (L.explored[i] || L.tile[i] !== 0) continue;
      if (L.los(x, y, (X + 0.5) * T, (Y + 0.5) * T)) {
        L.explored[i] = 1;
        for (let k = 0; k < 8; k++) { const nx = X + DX8[k], ny = Y + DY8[k]; if (L.inb(nx, ny) && L.tile[L.idx(nx, ny)] !== 0) L.explored[L.idx(nx, ny)] = 1; }
      }
    }
  }
  agentOnTile(tx, ty) {
    const inT = e => Math.floor(e.x / T) === tx && Math.floor(e.y / T) === ty;
    const p = this.player;
    if (p.alive) { const cx = clamp(p.x, tx * T, tx * T + T), cy = clamp(p.y, ty * T, ty * T + T); if (dist2(p.x, p.y, cx, cy) < (p.r * 0.9) ** 2) return true; }
    for (const e of this.enemies) if (e.alive && e.kind !== 'swarm' && inT(e)) return true;
    return false;
  }
  somethingOnTile(tx, ty) { return this.agentOnTile(tx, ty); }
  collide(e, r, grid) {
    const L = this.L, w = L.w, h = L.h;
    for (let pass = 0; pass < 2; pass++) {
      const tx0 = Math.floor((e.x - r) / T), tx1 = Math.floor((e.x + r) / T), ty0 = Math.floor((e.y - r) / T), ty1 = Math.floor((e.y + r) / T);
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (tx >= 0 && ty >= 0 && tx < w && ty < h && !grid[ty * w + tx]) continue;
        const rx = tx * T, ry = ty * T, cx = clamp(e.x, rx, rx + T), cy = clamp(e.y, ry, ry + T);
        const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; e.x += dx * k; e.y += dy * k; }
        else {
          const l = e.x - rx, rr = rx + T - e.x, t = e.y - ry, b = ry + T - e.y, m = Math.min(l, rr, t, b);
          if (m === l) e.x = rx - r; else if (m === rr) e.x = rx + T + r; else if (m === t) e.y = ry - r; else e.y = ry + T + r;
        }
      }
    }
  }
  flowDir(x, y) {
    const L = this.L, f = this.pflow, tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (!L.inb(tx, ty)) return null;
    const here = f[L.idx(tx, ty)];
    let best = -1, bv = here >= 0 ? here : 1e9;
    for (let k = 0; k < 8; k++) {
      const nx = tx + DX8[k], ny = ty + DY8[k];
      if (!L.inb(nx, ny)) continue;
      const v = f[L.idx(nx, ny)];
      if (v >= 0 && v < bv) { if (k >= 4 && (L.fly[L.idx(nx, ty)] || L.fly[L.idx(tx, ny)])) continue; bv = v; best = k; }
    }
    if (best < 0) return null;
    this.flowOut[0] = (tx + DX8[best] + 0.5) * T - x; this.flowOut[1] = (ty + DY8[best] + 0.5) * T - y;
    return this.flowOut;
  }
  // ---------- التفاعل ----------
  findInteract() {
    const p = this.player, L = this.L;
    if (!p.alive) return null;
    let best = null, bs = Infinity;
    const tx = p.tx, ty = p.ty;
    const test = o => {
      if (!o || !o.canInteract || !o.canInteract(this)) return;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d > T * 1.4) return;
      const fa = Math.abs(angDiff(p.face, Math.atan2(o.y - p.y, o.x - p.x)));
      const sc = d + fa * 7;
      if (sc < bs) { bs = sc; best = o; }
    };
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tx + dx, y = ty + dy;
      if (!L.inb(x, y)) continue;
      const i = L.idx(x, y);
      test(L.solidAt[i]); test(L.floorAt[i]);
    }
    return best;
  }
  openHack(term) {
    this.state = 'hack'; this.player.busy = true;
    UI.openHack(term, ok => {
      this.player.busy = false;
      if (this.state === 'hack') this.state = 'playing';
      if (ok) { term.setHacked(this, false); Save.data.stats.hacks++; this.score += 120; this.addRnn(10, term.x, term.y); }
      else {
        term.cd = 6; Sound.play('hackFail'); Sound.play('alarm');
        this.say('over', 'انقطع الوصل… أرسلتُ حراسي ليروا من يعبث بأوتاري.', 0, 'mid');
        this.noise(term.x, term.y, 14 * T, 'alarm');
        for (const e of this.enemies) if (e.alive && e.alert && dist2(e.x, e.y, term.x, term.y) < (16 * T) ** 2) e.alert(term.x, term.y, 0);
      }
    });
  }
  openRiddle(gate) {
    const pool = RIDDLES.filter((r, i) => !this.usedRiddles.has(i));
    if (!pool.length) this.usedRiddles.clear();
    const list = RIDDLES.map((r, i) => i).filter(i => !this.usedRiddles.has(i));
    const idx = pick(list); this.usedRiddles.add(idx);
    this.state = 'riddle'; Sound.play('riddle');
    UI.openRiddle(RIDDLES[idx], ok => {
      this.state = 'playing';
      if (ok) { gate.val = true; Sound.play('hackOk'); this.score += 150; Save.data.stats.riddles++; this.event('riddle', gate); this.addRnn(20, gate.x, gate.y); this.say('over', pick(['صحيح… هذه المرة فقط.', 'جواب مقبول. لكن البوابة التالية أصعب.', 'همم… لم أتوقع أن تعرف ذلك.']), 0, 'mid'); }
      else {
        gate.lockT = 9; Sound.play('alarm');
        this.say('over', 'خطأ! أيقظتُ الحراس حول البوابة.', 0, 'mid');
        this.noise(gate.x, gate.y, 15 * T, 'alarm');
        for (const e of this.enemies) if (e.alive && e.alert && dist2(e.x, e.y, gate.x, gate.y) < (16 * T) ** 2) e.alert(gate.x, gate.y, 0);
      }
    });
  }
  showHint() {
    const r = Planner.analyze(this);
    this.hint = { text: r.text, objs: r.objs || [], path: r.path || null, t: 8 };
    this.say('echo', r.text, 8, 'high');
    this.event('hint', r);
  }
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; UI.show('scrPause'); Sound.play('ui'); }
  resume() { if (this.state === 'paused') { this.state = 'playing'; UI.hide('scrPause'); } }
  levelComplete() {
    if (this.completed) return;
    this.completed = true; this.missions.refresh();
    const stars = this.missions.stars(), i = this.levelIndex, key = 'L' + (i + 1), d = Save.data;
    const first = d.unlocked < i + 2;
    d.unlocked = Math.max(d.unlocked, Math.min(LEVELS.length, i + 2));
    d.stars[key] = Math.max(d.stars[key] || 0, stars);
    if (!d.best[key] || this.time < d.best[key]) d.best[key] = Math.round(this.time * 10) / 10;
    if (i === LEVELS.length - 1) d.finished = true;
    if (i === 1) d.notches = Math.max(d.notches, 4);
    if (i === 3) d.notches = Math.max(d.notches, 5);
    this.addRnn(stars * 20);
    d.stats.play += Math.round(this.time);
    Save.persist();
    this.score += stars * 300;
    this.state = 'results'; Sound.play('win');
    UI.showResults({ stars, time: this.time, score: this.score, missions: this.missions, first, index: i, deaths: this.deathsHere, detections: this.missions.c.detected, dyn: this.dynDone });
  }
  // ---------- التحديث ----------
  update(dt) {
    this.t += dt * 1000;
    if (this.state === 'menu' && this.demo) this.step(dt);
    else if (this.state === 'playing') this.step(dt);
    else if (this.state === 'hack') this.step(dt * 0.12);
    else if (this.state === 'dying') { this.dieT -= dt; this.step(dt * 0.35); if (this.dieT <= 0) { this.state = 'dead'; UI.showDead(DEATH_TEXT[this.deathKind] || 'تم تعطيلك.'); } }
    else { FX.update(dt * 0.2); }
    this.updateCamera(dt);
  }
  step(dt) {
    const L = this.L, p = this.player;
    this.dt = dt;
    if (this.state === 'playing' && !this.demo) { this.time += dt; this.handleInput(); }
    if (this.demo) this.demoStep(dt);
    else p.update(dt, this);
    if (this.echo) this.echo.update(dt, this);
    L.traceLasers();
    for (let i = 0; i < L.objects.length; i++) L.objects[i].update(dt, this);
    for (const l of L.lamps) l.update(dt, this);
    L.evalLogic(dt);
    this.pflowT -= dt;
    if (this.pflowT <= 0) {
      const pt = L.idx(clamp(p.tx, 0, L.w - 1), clamp(p.ty, 0, L.h - 1));
      if (pt !== this.pflowTile) { this.pflowTile = pt; L.flow(p.x, p.y, L.fly, 40, this.pflow); }
      this.pflowT = 0.15;
    }
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].update(dt, this);
    this.laserHits();
    for (const b of this.bullets) b.update(dt, this);
    for (const d of this.decoys) d.update(dt, this);
    if (this.bullets.some(b => !b.alive)) this.bullets = this.bullets.filter(b => b.alive);
    if (this.decoys.some(d => !d.alive)) this.decoys = this.decoys.filter(d => d.alive);
    if (this.enemies.some(e => !e.alive && e.kind === 'swarm')) this.enemies = this.enemies.filter(e => e.alive || e.kind !== 'swarm');
    if (!this.demo) this.director.update(dt);
    if (this.shade && !this.demo) this.shade.update(dt, this);
    if (!this.demo) this.tickHK(dt);
    this.updateDust(dt);
    // خريطة الحرارة (يتعلّم منها الصيّاد)
    this.heatT -= dt;
    if (this.heatT <= 0 && p.alive && !this.demo) {
      this.heatT = 0.25;
      const ti = L.idx(clamp(p.tx, 0, L.w - 1), clamp(p.ty, 0, L.h - 1));
      L.heat[ti] += 1;
      for (let k = 0; k < 8; k++) { const nx = p.tx + DX8[k], ny = p.ty + DY8[k]; if (L.inb(nx, ny)) L.heat[L.idx(nx, ny)] += 0.35; }
      if (((this.t / 250) | 0) % 8 === 0) for (let i = 0; i < L.N; i++) L.heat[i] *= 0.985;
    }
    this.litT -= dt;
    if (L.litDirty && this.litT <= 0) { L.computeLit(); this.litT = 0.4; }
    for (const k in this.gadgetCd) if (this.gadgetCd[k] > 0) this.gadgetCd[k] = Math.max(0, this.gadgetCd[k] - dt);
    this.scanT = Math.max(0, this.scanT - dt);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    this.alarm = Math.max(this.director && this.director.alarmed && !this.demo ? 0.55 : 0, this.alarm - dt * 0.8);
    if (this.hint) { this.hint.t -= dt; if (this.hint.t <= 0) this.hint = null; }
    FX.update(dt);
    if (!this.demo) {
      this.interactTarget = this.findInteract();
      const it = this.interactTarget;
      for (const c of L.captives) if (c !== it && c.prog > 0) c.prog = Math.max(0, c.prog - dt);
      if (it && it.hold && Input.holdInteract && this.state === 'playing') { it.prog += dt / 1.2; if (it.prog >= 1) { it.prog = 0; it.free(this); } }
      for (const tr of this.triggers) {
        if (tr.done) continue;
        if (dist2(p.x, p.y, (tr.x + 0.5) * T, (tr.y + 0.5) * T) < (tr.r * T) ** 2) { tr.done = true; this.say(tr.who || 'echo', tr.say, tr.dur, 'mid'); }
      }
      if (this.missions) { this.missionTick = (this.missionTick || 0) - dt; if (this.missionTick <= 0) { this.missionTick = 0.25; this.missions.refresh(); } }
    }
  }
  focusCost() { return this.perk('patience') ? 22 : 33; }
  focusDur() { return this.perk('patience') ? 0.6 : 1.1; }
  tickHK(dt) {
    const p = this.player;
    this.strikeCd = Math.max(0, this.strikeCd - dt);
    // سجلّ الكائنات: يُدوَّن كل كائن تراه بعينك
    this.journalT -= dt;
    if (this.journalT <= 0 && p.alive) {
      this.journalT = 0.5;
      for (const e of this.enemies) {
        if (!e.alive || e.defeated || !JOURNAL[e.kind] || Save.data.journal[e.kind]) continue;
        if (dist2(e.x, e.y, p.x, p.y) < (9 * T) ** 2 && this.L.los(p.x, p.y, e.x, e.y)) this.unlockJournal(e.kind);
      }
      const B = this.boss;
      if (B && !B.defeated && !this.bossCard && dist2(B.x, B.y, p.x, p.y) < (12 * T) ** 2 && this.L.los(p.x, p.y, B.x, B.y)) { this.bossCard = true; UI.areaCard('العين التي لا تنام', 'المُراقِب', '', true); }
    }
    // التركيز: اضغط «تفاعل» مطوّلاً دون هدف لترميم وتر واحد مقابل النبض
    const cost = this.focusCost(), dur = this.focusDur();
    const can = this.state === 'playing' && p.alive && !this.interactTarget && !this.strikeTarget && p.hp < p.maxHp && Input.holdInteract && (this.focusT > 0 || p.energy >= cost);
    if (can) {
      p.focusing = true; this.focusT += dt; p.energy = Math.max(0, p.energy - cost * dt / dur);
      if (Math.random() < dt * 40) { const a = Math.random() * TAU, r = rand(14, 28); FX.add(1, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, -Math.cos(a) * r * 2.6, -Math.sin(a) * r * 2.6, 0.32, 1.7, '#fff3cf', 3); }
      if (this.focusT >= dur) {
        this.focusT = 0; p.hp = Math.min(p.maxHp, p.hp + 1); Save.data.stats.focus = (Save.data.stats.focus || 0) + 1;
        Sound.play('health'); UI.buzz(30); FX.ring(p.x, p.y, 4, 32, 0.5, '#fff3cf', 2.5); FX.text(p.x, p.y - 18, '+وتر', '#ff8fa3');
      }
    } else { p.focusing = false; this.focusT = 0; }
    this.strikeTarget = this.state === 'playing' && p.alive && !this.interactTarget && !p.focusing ? this.findStrike() : null;
  }
  updateDust(dt) {
    const n = R.q.dust | 0, v = R.vb, w = v.x1 - v.x0, h = v.y1 - v.y0, D = this.dust;
    if (!n || w <= 0 || h <= 0) { D.length = 0; return; }
    while (D.length < n) D.push({ x: v.x0 + Math.random() * w, y: v.y0 + Math.random() * h, vx: rand(-5, 5), vy: rand(-9, -2), ph: Math.random() * TAU, s: rand(0.7, 1.7) });
    if (D.length > n) D.length = n;
    for (let i = 0; i < D.length; i++) {
      const d = D[i];
      d.ph += dt; d.x += (d.vx + Math.sin(d.ph * 0.7) * 5) * dt; d.y += d.vy * dt;
      if (d.x < v.x0) d.x += w; else if (d.x > v.x1) d.x -= w;
      if (d.y < v.y0) d.y += h; else if (d.y > v.y1) d.y -= h;
    }
  }
  drawDust(ctx) {
    const D = this.dust; if (!D.length) return;
    ctx.fillStyle = '#e4ecff';
    for (let i = 0; i < D.length; i++) { const d = D[i]; ctx.globalAlpha = 0.08 + 0.13 * (0.5 + 0.5 * Math.sin(d.ph * 1.7)); ctx.fillRect(d.x, d.y, d.s, d.s); }
    ctx.globalAlpha = 1;
  }
  handleInput() {
    const p = this.player;
    if (Input.take('pause')) { this.pause(); return; }
    if (!p.alive) return;
    if (Input.take('interact')) { const o = this.interactTarget; if (o && !o.hold) o.interact(this); else if (!o && this.strikeTarget) this.strike(); }
    const gl = this.gadgets();
    if (Input.take('gadget')) { const id = gl[this.curGadget]; if (id) useGadget(this, id); else this.toast('لا تملك أدوات بعد — ابحث عن الأختام الذهبية'); }
    if (Input.take('cycle')) { if (gl.length > 1) { this.curGadget = (this.curGadget + 1) % gl.length; Sound.play('ui'); this.toast('الأداة: ' + GADGETS[gl[this.curGadget]].name); } }
    for (let k = 1; k <= 4; k++) if (Input.take('g' + k) && k <= gl.length) { this.curGadget = k - 1; Sound.play('ui'); }
    if (Input.take('dash')) p.dash();
    if (Input.take('echo') && this.echo) this.echo.command(this);
    if (Input.take('hint')) this.showHint();
    if (Input.take('map')) { Settings.minimap = !Settings.minimap; Save.settingsChanged(); UI.applyHudToggles(); }
  }
  demoStep(dt) {
    this.demoT += dt;
    const L = this.L, p = this.player, a = this.demoT * 0.06;
    const cx = L.w * T / 2, cy = L.h * T / 2;
    p.x = cx + Math.sin(a) * (L.w * T * 0.32); p.y = cy + Math.sin(a * 1.7 + 1) * (L.h * T * 0.28);
    p.alive = true; p.face = a * 3;
    if (this.echo) { this.echo.x = damp(this.echo.x, p.x + Math.cos(this.demoT) * 40, 2, dt); this.echo.y = damp(this.echo.y, p.y + Math.sin(this.demoT * 1.3) * 30, 2, dt); this.echo.bob += dt; this.echo.ring += dt * 2; }
  }
  laserHits() {
    const L = this.L, p = this.player;
    for (const em of L.emitters) {
      const s = em.segs;
      for (let i = 0; i < s.length; i += 4) {
        if (p.alive && !this.demo && segDist2(p.x, p.y, s[i], s[i + 1], s[i + 2], s[i + 3]) < (p.r * 0.8) ** 2) {
          const dx = s[i + 2] - s[i], dy = s[i + 3] - s[i + 1], l = Math.hypot(dx, dy) || 1;
          const side = ((p.x - s[i]) * -dy + (p.y - s[i + 1]) * dx) > 0 ? 1 : -1;
          this.damagePlayer(1, 'laser', p.x - (-dy / l) * side * 10, p.y - (dx / l) * side * 10);
          Sound.play('laser');
        }
        for (const e of this.enemies) {
          if (!e.alive || !e.hittable || e.kind === 'turret' || e.kind === 'nest' || e.kind === 'boss') continue;
          if (segDist2(e.x, e.y, s[i], s[i + 1], s[i + 2], s[i + 3]) < (e.r * 0.8) ** 2) {
            if (e.kind === 'swarm') e.die(this);
            else if (e.stunT <= 0) { e.hit(this, 1, 'laser'); this.event('laserStun', e); }
          }
        }
      }
    }
  }
  updateCamera(dt) {
    const p = this.player, L = this.L;
    if (!p || !L) return;
    let tx = p.x + p.vx * 0.2, ty = p.y + p.vy * 0.2;
    if (this.demo) { tx = p.x; ty = p.y; }
    const k = this.demo ? 1.5 : 6;
    R.camX = damp(R.camX, tx, k, dt); R.camY = damp(R.camY, ty, k, dt);
    const hw = R.W * 0.5 / R.zoom, hh = R.H * 0.5 / R.zoom, Wd = L.w * T, Hd = L.h * T, m = T * 1.5;
    if (Wd + 2 * m < hw * 2) R.camX = Wd / 2; else R.camX = clamp(R.camX, hw - m, Wd - hw + m);
    if (Hd + 2 * m < hh * 2) R.camY = Hd / 2; else R.camY = clamp(R.camY, hh - m, Hd - hh + m);
    R.updateShake(dt, this.t);
    Sound.listener.x = R.camX; Sound.listener.y = R.camY;
  }
  // ---------- الرسم ----------
  render() {
    const L = this.L, p = this.player, ctx = R.ctx, t = this.t;
    if (!L) { R.clear(PAL.void); return; }
    R.clear(PAL.void);
    const v = R.view();
    for (const e of this.enemies) if (e.alive && e.prepare && R.inView(e.x, e.y, (e.view || 0) + T)) e.prepare(this); else if (e.polyN) e.polyN = 0;
    R.cam(ctx);
    L.drawFloor(ctx, v);
    L.drawWires(ctx, t, false);
    const objs = L.objects;
    for (let i = 0; i < objs.length; i++) { const o = objs[i]; if (o.layer === 'floor' && R.inView(o.x, o.y, T)) o.draw(ctx, t, this); }
    L.drawWalls(ctx, v);
    for (let i = 0; i < objs.length; i++) { const o = objs[i]; if (o.layer === 'solid' && R.inView(o.x, o.y, T)) o.draw(ctx, t, this); }
    for (const e of this.enemies) if (e.alive && R.inView(e.x, e.y, T * 2)) e.draw(ctx, t, this);
    if (this.shade && !this.demo && R.inView(this.shade.x, this.shade.y, T)) this.shade.draw(ctx);
    if (this.echo) this.echo.draw(ctx, t);
    if (!this.demo) p.draw(ctx, t);
    FX.draw(ctx, false, false);
    // ---- الإضاءة ----
    R.lightBegin(L.ambient);
    for (const l of L.lamps) l.light(t);
    if (!this.demo && p.alive) {
      const pr = 5.2 * T, pa = p.cloak > 0 ? 0.45 : 0.85;
      if (R.q.shadows && R.q.playerRays) {
        const n = R.q.playerRays;
        L.castPoly(p.x, p.y, pr, 0, TAU, n, p.poly, true);
        R.lightPoly(p.poly, n, p.x, p.y, pr, '#cfe9ff', pa);
      } else R.lightSprite(p.x, p.y, pr, '#cfe9ff', pa * 0.8);
      R.lightSprite(p.x, p.y, 1.7 * T, '#ffffff', 0.5);
    }
    if (this.echo) R.lightSprite(this.echo.x, this.echo.y, 2.6 * T, PAL.gold, 0.55);
    for (const e of this.enemies) {
      if (!e.alive || !R.inView(e.x, e.y, 2 * T)) continue;
      const c = e.kind === 'swarm' ? PAL.magenta : e.kind === 'hunter' ? PAL.violet : (e.state === 'chase' || e.state === 'fire') ? PAL.red : PAL.amber;
      R.lightSprite(e.x, e.y, (e.kind === 'swarm' ? 1.3 : 2.2) * T, c, e.stunT > 0 ? 0.2 : 0.45);
    }
    for (const em of L.emitters) {
      const s = em.segs;
      for (let i = 0; i < s.length; i += 4) {
        const len = Math.hypot(s[i + 2] - s[i], s[i + 3] - s[i + 1]), n = Math.max(1, Math.ceil(len / (1.4 * T)));
        for (let k = 0; k <= n; k++) R.lightSprite(lerp(s[i], s[i + 2], k / n), lerp(s[i + 1], s[i + 3], k / n), 1.5 * T, PAL.laser, 0.4);
      }
    }
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      if (!R.inView(o.x, o.y, 3 * T)) continue;
      if (o.type === 'core' || o.type === 'energy' || o.type === 'health' || o.type === 'chip' || o.type === 'memory' || o.type === 'charm') { if (!o.taken) R.lightSprite(o.x, o.y, 1.8 * T, PICKUP_COL[o.kind], 0.5); }
      else if (o.type === 'shard') { if (!o.taken) R.lightSprite(o.x, o.y, 1.1 * T, PICKUP_COL.shard, 0.35); }
      else if (o.type === 'tablet') R.lightSprite(o.x, o.y, 1.7 * T, o.read ? '#8fa3b8' : '#cfe3ff', o.read ? 0.22 : 0.4);
      else if (o.type === 'npc') R.lightSprite(o.x, o.y - 6, 3.4 * T, PAL.lampWarm, 0.65);
      else if (o.type === 'checkpoint') R.lightSprite(o.x, o.y, 2.3 * T, PAL.mint, o.active ? 0.5 : 0.28);
      else if (o.type === 'exit') R.lightSprite(o.x, o.y, 2.8 * T, o.open ? PAL.mint : PAL.red, 0.55);
      else if (o.type === 'terminal') R.lightSprite(o.x, o.y, 1.7 * T, o.val ? PAL.mint : PAL.cyan, 0.4);
      else if (o.type === 'hazard' && o.active) R.lightSprite(o.x, o.y, 1.2 * T, '#9fd8ff', 0.25);
      else if (o.type === 'riddle' && !o.val) R.lightSprite(o.x, o.y, 1.8 * T, PAL.violet, 0.4);
    }
    for (const b of this.bullets) R.lightSprite(b.x, b.y, 1.1 * T, b.color, 0.6);
    for (const d of this.decoys) R.lightSprite(d.x, d.y, 1.8 * T, PAL.cyan, 0.4);
    if (this.shade && !this.demo) R.lightSprite(this.shade.x, this.shade.y, 2.2 * T, '#6a4cff', 0.5);
    if (this.boss) this.boss.light(this);
    R.lightEnd();
    // ---- الطبقة المتوهجة ----
    R.cam(ctx);
    this.drawEmissive(ctx, false);
    R.bloom(gc => this.drawEmissive(gc, true));
    const blue = !this.demo && p.cloak > 0 ? 0.5 : 0;
    R.post(this.alarm * (0.6 + 0.4 * Math.sin(t * 0.008)), this.hurtFlash, blue, this.flash);
  }
  drawEmissive(ctx, glow) {
    const L = this.L, t = this.t, objs = L.objects;
    L.drawWires(ctx, t, true);
    L.drawWallLights(ctx, R.vb, t);
    for (let i = 0; i < objs.length; i++) { const o = objs[i]; if (o.type === 'emitter' || R.inView(o.x, o.y, T * 2)) o.emit(ctx, t, this, glow); }
    for (const e of this.enemies) if (e.alive && R.inView(e.x, e.y, (e.view || 0) + T * 2)) e.emit(ctx, t, this, glow);
    for (const b of this.bullets) b.emit(ctx);
    for (const d of this.decoys) d.emit(ctx, t, glow);
    if (this.shade && !this.demo && R.inView(this.shade.x, this.shade.y, T * 2)) this.shade.emit(ctx, t, glow);
    if (this.echo) this.echo.emit(ctx, t, glow);
    if (!this.demo) this.player.emit(ctx, t, glow);
    FX.draw(ctx, true, glow);
    if (glow) return;
    this.drawDust(ctx);
    this.drawScan(ctx, t);
    this.drawHint(ctx, t);
    const it = this.interactTarget;
    if (it && this.state === 'playing') {
      const a = 0.55 + 0.35 * Math.sin(t * 0.008);
      ctx.strokeStyle = col(PAL.mint, a); ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -t * 0.02;
      ctx.beginPath(); ctx.arc(it.x, it.y, T * 0.62, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    const st = this.strikeTarget;
    if (st && !it && this.state === 'playing') {
      const a = 0.5 + 0.4 * Math.sin(t * 0.012), r = st.r + 7;
      ctx.strokeStyle = col('#ffffff', a); ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) { const an = k * Math.PI / 2 + t * 0.002; ctx.beginPath(); ctx.arc(st.x, st.y, r, an, an + 0.7); ctx.stroke(); }
    }
    if (this.player && this.player.focusing) {
      const p = this.player, f = this.focusT / this.focusDur();
      ctx.strokeStyle = col('#fff3cf', 0.85); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 17, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.stroke();
    }
  }
  drawScan(ctx, t) {
    if (this.scanT <= 0) return;
    const p = this.player, a = Math.min(1, this.scanT / 1.2);
    ctx.lineWidth = 1.5;
    for (const e of this.enemies) {
      if (!e.alive || dist2(e.x, e.y, p.x, p.y) > (16 * T) ** 2) continue;
      ctx.strokeStyle = col(e.kind === 'swarm' ? PAL.magenta : e.kind === 'hunter' ? PAL.violet : PAL.red, a * 0.9);
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6 + Math.sin(t * 0.01) * 2, 0, TAU); ctx.stroke();
      if (e.route && e.route.length > 1) {
        ctx.strokeStyle = col(PAL.amber, a * 0.5); ctx.setLineDash([6, 6]); ctx.beginPath();
        e.route.forEach((w, i) => { if (i) ctx.lineTo(w.x, w.y); else ctx.moveTo(w.x, w.y); });
        ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (const o of this.L.objects) {
      if (dist2(o.x, o.y, p.x, p.y) > (16 * T) ** 2) continue;
      if ((o.type === 'core' && !o.taken) || (o.type === 'terminal' && !o.val) || (o.type === 'captive' && !o.freed) || (o.type === 'chip' && !o.taken) || (o.type === 'memory' && !o.taken)) {
        ctx.strokeStyle = col(PAL.cyan, a * 0.8); ctx.beginPath(); ctx.arc(o.x, o.y, T * 0.55, 0, TAU); ctx.stroke();
      }
    }
  }
  drawHint(ctx, t) {
    const h = this.hint; if (!h) return;
    const a = Math.min(1, h.t / 1.5);
    if (h.path && h.path.length >= 4) {
      ctx.strokeStyle = col(PAL.gold, 0.7 * a); ctx.lineWidth = 2.5; ctx.setLineDash([2, 9]); ctx.lineDashOffset = -t * 0.03; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(h.path[0], h.path[1]);
      for (let i = 2; i < h.path.length; i += 2) ctx.lineTo(h.path[i], h.path[i + 1]);
      ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
    }
    for (const o of h.objs) {
      if (!o || o.x == null) continue;
      const r = T * 0.7 + Math.sin(t * 0.008) * 3;
      ctx.strokeStyle = col(PAL.gold, a); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(o.x, o.y - r - 10); ctx.lineTo(o.x - 5, o.y - r - 17); ctx.lineTo(o.x + 5, o.y - r - 17); ctx.closePath(); ctx.fillStyle = col(PAL.gold, a); ctx.fill();
    }
  }
}
