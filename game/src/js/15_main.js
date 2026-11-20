// ===================== الإقلاع =====================
const game = new Game();
function frame(dt) {
  Input.poll();
  game.update(dt);
  game.render();
  UI.tick(dt);
  Input.flush();
}
function applyAllSettings() {
  R.makeContext(); R.resize();
  Loop.setCap(fpsCap());
  Sound.setVolumes(Settings.music, Settings.sfx);
  UI.applyPerf(); UI.applyTouch(); UI.applyHudToggles(); UI.updateSaveInfo();
}
function boot() {
  Save.load();
  Settings = Save.data.settings;
  Sound.vol.music = Settings.music; Sound.vol.sfx = Settings.sfx;
  R.init(); Input.init(); UI.init();
  Loop.init(frame); Loop.setCap(fpsCap());
  game.loadLevel(0, true); game.state = 'menu';
  UI.show('scrTitle');
  Loop.start();
  const unlock = () => Sound.init();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  Save.initCloud(() => { Settings = Save.data.settings; applyAllSettings(); });
  // ضبط تلقائي لمرة واحدة إن كان الجهاز يعاني (فقط إن لم يغيّر اللاعب الإعدادات قط)
  const tune = (step) => {
    if (Save.data.settingsAt || Settings.autoTuned || document.hidden) return;
    const f = Loop.fps;
    if (f > 0 && f < 30) {
      if (step === 0 && Settings.quality !== 'low') { Settings.quality = 'medium'; R.resize(); setTimeout(() => tune(1), 4000); return; }
      if (f < 24) { Settings.res = 'p720'; Settings.quality = 'low'; R.resize(); }
      Settings.autoTuned = true; Save.persist();
    } else if (step === 1) { Settings.autoTuned = true; Save.persist(); }
  };
  setTimeout(() => tune(0), 6000);
  window.__nabd = { game, R, Loop, Save, UI, Input, Planner, useGadget, get Settings() { return Settings; }, riddleAnswer() { const q = $('#rdQ').textContent; const r = RIDDLES.find(x => x.q === q); return r ? r.o[0] : null; } };
}
boot();
