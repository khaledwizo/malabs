// صوت الكلام: محرّك النطق في أندرويد (عبر الجسر) أو المتصفح، وإلا «همهمة» مركّبة بنبرة بشرية مع فقاعات النص
import { Audio } from './audio.js';
import { Settings } from './settings.js';

let seq = 0;
const pending = new Map();
window.__ttsDone = id => { const f = pending.get(String(id)); if (f) { pending.delete(String(id)); f(); } };

export const Speech = {
  mode: null, voices: 1, webVoices: [],
  init() {
    const A = window.RafidainAndroid;
    if (A && A.ttsStatus) { this.mode = 'android'; return; }
    if (window.speechSynthesis) {
      const pick = () => { this.webVoices = speechSynthesis.getVoices().filter(v => /^ar/i.test(v.lang)); this.mode = this.webVoices.length ? 'web' : 'babble'; };
      pick(); try { speechSynthesis.onvoiceschanged = pick; } catch (e) { }
      if (!this.mode) this.mode = 'babble';
      return;
    }
    this.mode = 'babble';
  },
  // هل يتوفّر نطق حقيقي الآن؟ (محرّك أندرويد قد يتأخّر بالتهيئة أو لا يملك صوتاً عربياً)
  real() {
    if (this.mode === 'android') { try { const s = window.RafidainAndroid.ttsStatus(); if (s > 0 && !this.vc) this.vc = Math.max(1, window.RafidainAndroid.voiceCount ? window.RafidainAndroid.voiceCount() : 1); return s > 0; } catch (e) { return false; } }
    return this.mode === 'web';
  },
  // o: { text, tts, pitch, rate, voice, pos, listener:[x,y,z,fx,fz], dur } — onEnd يُستدعى عند الانتهاء
  speak(o, onEnd) {
    const vol = Math.max(0, Math.min(1, Settings.volume * (Settings.talk ?? 0.9)));
    if (vol <= 0.01) { setTimeout(onEnd, o.dur * 1000); return 'mute'; }
    // التوهين حسب المسافة والاتجاه (يمين/يسار)
    let dv = 1, pan = 0;
    if (o.pos && o.listener) {
      const [lx, , lz, fx, fz] = o.listener, dx = o.pos[0] - lx, dz = o.pos[2] - lz, d = Math.hypot(dx, dz);
      dv = Math.max(0.12, Math.min(1, 1.25 - d / 13)); const rx = -fz, rz = fx; pan = d > 0.5 ? Math.max(-0.8, Math.min(0.8, (dx * rx + dz * rz) / d)) : 0;
    }
    if (this.real()) {
      const id = 's' + (++seq);
      let done = false; const fin = () => { if (done) return; done = true; onEnd(); };
      pending.set(id, fin); setTimeout(() => { pending.delete(id); fin(); }, (o.dur * 2.2 + 2) * 1000);
      if (this.mode === 'android') {
        try { window.RafidainAndroid.speak(id, o.tts, o.pitch, o.rate, vol * dv, pan, (o.voice | 0) % (this.vc || 1)); } catch (e) { pending.delete(id); this.babble(o, vol * dv, onEnd); }
      } else {
        try {
          const u = new SpeechSynthesisUtterance(o.tts); const V = this.webVoices; if (V.length) u.voice = V[(o.voice | 0) % V.length];
          u.lang = 'ar'; u.pitch = o.pitch; u.rate = o.rate; u.volume = vol * dv; u.onend = u.onerror = () => window.__ttsDone(id);
          speechSynthesis.cancel(); speechSynthesis.speak(u);
        } catch (e) { pending.delete(id); this.babble(o, vol * dv, onEnd); }
      }
      return id;
    }
    this.babble(o, vol, onEnd);
    return 'babble';
  },
  babble(o, vol, onEnd) { Audio.babble(o.pos, o.dur, o.pitch, vol); setTimeout(onEnd, o.dur * 1000); },
  stop() {
    try { if (this.mode === 'android') window.RafidainAndroid.stopSpeak(); else if (this.mode === 'web') speechSynthesis.cancel(); } catch (e) { }
    Audio.stopBabble && Audio.stopBabble();
    for (const f of [...pending.values()]) f(); pending.clear();
  },
};
