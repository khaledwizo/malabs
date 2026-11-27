// لعب على نفس الشبكة بلا إنترنت: جسر أندرويد (LanHub.java) — سيرفر WebSocket وإعلان UDP
// المضيف (هاتف اللعبة أو تطبيق السيرفر) يعلن عن الغرفة؛ اللاعبون يلگونها ويدخلون بـ ws://IP:47800
const AB = () => (typeof window !== 'undefined') && (window.RafidainAndroid && window.RafidainAndroid.lanStart ? window.RafidainAndroid : window.RafidainServer && window.RafidainServer.lanStart ? window.RafidainServer : null);
export const Lan = {
  get ok() { return !!AB(); },
  host(room, name, info) { const A = AB(); if (!A) return ''; try { return A.lanStart(room, name || '', JSON.stringify(info || {})) || ''; } catch (e) { return ''; } },
  info(info) { const A = AB(); if (A) try { A.lanInfo(JSON.stringify(info || {})); } catch (e) { } },
  stop() { const A = AB(); if (A) try { A.lanStop(); } catch (e) { } },
  send(id, s) { const A = AB(); if (A) A.lanSend(id, s); },
  scan(on) { const A = AB(); if (A) try { A.lanScan(!!on); } catch (e) { } },
  found() { const A = AB(); if (!A) return []; try { return JSON.parse(A.lanFound() || '[]'); } catch (e) { return []; } },
  ip() { const A = AB(); try { return A ? A.lanIp() : ''; } catch (e) { return ''; } },
  // ننتظر شوية حتى نسمع إعلان الغرفة (إذا موجودة على نفس الشبكة)
  async find(room, ms = 1600) {
    if (!this.ok) return null; this.scan(true);
    const t0 = Date.now(); while (Date.now() - t0 < ms) { const f = this.found().find(g => g.room === room); if (f) return f; await new Promise(r => setTimeout(r, 200)); }
    return null;
  },
};

// اللاعب: WebSocket مباشر لسيرفر الشبكة المحلية
export class LanClientLink {
  constructor(host, opt = {}) { this.h = host; this.cid = opt.cid; this.onmsg = null; this.onstatus = opt.onStatus || (() => { }); this.via = 'lan'; this.closed = false; this.url = 'lan://' + host.ip; }
  open() {
    return new Promise((res, rej) => {
      let ws; try { ws = this.ws = new WebSocket(`ws://${this.h.ip}:${this.h.port || 47800}`); } catch (e) { rej(e); return; }
      const to = setTimeout(() => { try { ws.close(); } catch (e) { } rej(new Error('تعذّر الوصول إلى سيرفر الشبكة')); }, 4000);
      ws.onopen = () => { clearTimeout(to); this.onstatus('متّصل على الشبكة نفسها ✓'); res(this); };
      ws.onerror = () => { clearTimeout(to); rej(new Error('تعذّر الوصول إلى سيرفر الشبكة')); };
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.onmsg && this.onmsg(m); };
      ws.onclose = () => { if (!this.closed) this.onclosed && this.onclosed(); };
    });
  }
  tryRtc() { }
  send(m) { if (this.closed || !this.ws || this.ws.readyState !== 1) return; m.from = this.cid; this.ws.send(JSON.stringify(m)); }
  close() { if (this.closed) return; try { this.send({ k: 'bye' }); } catch (e) { } this.closed = true; setTimeout(() => { try { this.ws.close(); } catch (e) { } }, 120); }
}
