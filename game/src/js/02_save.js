// ===================== الحفظ: محلي + سحابي (قاعدة بيانات الصفحة) =====================
const Save = {
  KEY: 'nabd_save_v1',
  data: null,
  cloud: { ref: null, ready: false, busy: false, again: false, last: '', timer: 0, disabled: false },
  defaults() {
    return {
      v: 1, unlocked: 1, stars: {}, best: {}, gadgets: [], memories: [],
      settings: Object.assign({}, DEFAULT_SETTINGS), settingsAt: 0,
      stats: { deaths: 0, detections: 0, play: 0, cores: 0, hacks: 0, riddles: 0, focus: 0 },
      finished: false, updatedAt: 0,
      rnn: 0, charms: [], equipped: [], notches: 3, journal: {}, shade: null, met: {},
    };
  },
  load() {
    this.data = this.defaults();
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.merge(JSON.parse(raw), true);
    } catch (e) { /* التخزين غير متاح */ }
  },
  // دمج آمن: نأخذ أفضل تقدّم من النسختين
  merge(o, takeSettings) {
    if (!o || typeof o !== 'object') return false;
    const d = this.data; let ch = false;
    const maxLv = LEVELS.length;
    if (Number.isFinite(o.unlocked)) {
      const u = clamp(Math.floor(o.unlocked), 1, maxLv);
      if (u > d.unlocked) { d.unlocked = u; ch = true; }
    }
    if (o.stars && typeof o.stars === 'object') for (const k in o.stars) {
      const v = clamp(+o.stars[k] || 0, 0, 3);
      if (v > (d.stars[k] || 0)) { d.stars[k] = v; ch = true; }
    }
    if (o.best && typeof o.best === 'object') for (const k in o.best) {
      const v = +o.best[k];
      if (v > 0 && (!d.best[k] || v < d.best[k])) { d.best[k] = v; ch = true; }
    }
    for (const key of ['gadgets', 'memories']) if (Array.isArray(o[key])) for (const g of o[key]) {
      if (typeof g === 'string' && g.length < 40 && !d[key].includes(g)) { d[key].push(g); ch = true; }
    }
    if (o.stats && typeof o.stats === 'object') for (const k in d.stats) {
      const v = +o.stats[k] || 0;
      if (v > d.stats[k]) { d.stats[k] = v; ch = true; }
    }
    if (o.finished && !d.finished) { d.finished = true; ch = true; }
    if (Array.isArray(o.charms)) for (const c of o.charms) if (CHARMS[c] && !d.charms.includes(c)) { d.charms.push(c); ch = true; }
    if (Number.isFinite(+o.notches)) { const n = clamp(Math.floor(+o.notches), 3, 7); if (n > d.notches) { d.notches = n; ch = true; } }
    for (const key of ['journal', 'met']) if (o[key] && typeof o[key] === 'object') for (const k in o[key]) if (!d[key][k] && k.length < 30) { d[key][k] = 1; ch = true; }
    // ما يتغيّر صعوداً وهبوطاً (الرنين، التمائم المحمولة، الطيف): تفوز النسخة الأحدث
    if ((+o.updatedAt || 0) > (d.updatedAt || 0)) {
      if (Number.isFinite(+o.rnn)) d.rnn = clamp(Math.floor(+o.rnn), 0, 999999);
      if (Array.isArray(o.equipped)) d.equipped = o.equipped.filter(c => CHARMS[c]);
      const s = o.shade;
      d.shade = s && typeof s === 'object' && Number.isFinite(+s.lv) && Number.isFinite(+s.x) && Number.isFinite(+s.y) && +s.amt > 0 ? { lv: +s.lv | 0, x: +s.x, y: +s.y, amt: Math.floor(+s.amt) } : null;
      d.updatedAt = +o.updatedAt; ch = true;
    }
    // التمائم المحمولة يجب أن تكون مملوكة وضمن الخانات
    let used = 0;
    d.equipped = d.equipped.filter((c, i, a) => { if (!d.charms.includes(c) || a.indexOf(c) !== i || used + CHARMS[c].cost > d.notches) return false; used += CHARMS[c].cost; return true; });
    if (o.settings && typeof o.settings === 'object' && (takeSettings || (+o.settingsAt || 0) > d.settingsAt)) {
      for (const k in DEFAULT_SETTINGS) {
        if (k in o.settings && typeof o.settings[k] === typeof DEFAULT_SETTINGS[k]) d.settings[k] = o.settings[k];
      }
      d.settingsAt = Math.max(d.settingsAt, +o.settingsAt || 0);
      ch = true;
    }
    return ch;
  },
  persist() {
    this.data.updatedAt = Date.now();
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { }
    this.scheduleCloud();
  },
  settingsChanged() { this.data.settingsAt = Date.now(); this.persist(); },
  scheduleCloud(delay = 2500) {
    const c = this.cloud;
    if (!c.ready || c.disabled) return;
    clearTimeout(c.timer);
    c.timer = setTimeout(() => this.flushCloud(), delay);
  },
  async flushCloud() {
    const c = this.cloud;
    if (!c.ready || c.disabled || !c.ref) return;
    if (c.busy) { c.again = true; return; }
    const json = JSON.stringify(this.data);
    if (json === c.last) return;
    c.busy = true;
    try {
      await c.ref.set(JSON.parse(json));
      c.last = json;
    } catch (e) {
      const code = e && e.code;
      if (code === 'invalid_argument' || code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed' || code === 'quota_exceeded') c.disabled = true;
      else c.again = true; // خطأ عابر: نعيد المحاولة لاحقاً
    }
    c.busy = false;
    if (c.again && !c.disabled) { c.again = false; this.scheduleCloud(4000); }
  },
  async initCloud(onMerged) {
    try {
      const C = window.claude;
      if (!C || typeof C.use !== 'function') return;
      const [db, user] = await Promise.all([C.use('db'), C.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      const ref = db.doc('data/users/' + uid + '/save');
      const snap = await withTimeout(ref.get(), 10000);
      this.cloud.ref = ref; this.cloud.ready = true;
      if (snap && snap.exists) {
        const body = snap.data();
        this.cloud.last = JSON.stringify(body);
        if (this.merge(body, false)) {
          try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { }
          if (onMerged) onMerged();
        }
      }
      this.scheduleCloud(1500);
    } catch (e) { /* السحابة غير متاحة: نكتفي بالحفظ المحلي */ }
  },
};
let Settings = DEFAULT_SETTINGS; // يُستبدل بإعدادات الحفظ عند الإقلاع
