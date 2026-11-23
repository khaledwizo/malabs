// عامل معركة واحدة داخل السيرفر المركزي: كل معركة بخيط مستقل (تعطّل وحدة ما يوقف الباقي، وتتوزع على أنوية المعالج)
import { Builder, NULL_GFX } from './world/builder.js';
import { buildSouq } from './world/maps/souq.js';
import { GameServer } from './net/server.js';

let srv = null, world = null, rep = null;
const post = m => postMessage(m);
// WebRTC ما يشتغل داخل العامل: الخيط الرئيسي يفتح القنوات المباشرة ويمرّر الرسائل
const rtc = { proxy: true, offer: (from, sdp) => post({ t: 'rtc', from, sdp }), send: (to, s) => post({ t: 'dc', to, s }), drop: cid => post({ t: 'dcDrop', cid }) };

function report() {
  if (!srv) return;
  const I = srv.info(), hum = I.players.filter(p => !p.bot);
  post({ t: 'info', I: { status: I.status, tick: I.tick, busy: I.busy, phase: I.phase, round: I.round, score: I.score, mode: I.mode, mid: I.mid, bots: I.players.length - hum.length, hum: hum.map(p => ({ u: p.u, n: p.name, tm: p.team, k: p.k, d: p.d, rtt: p.rtt, via: p.via, al: p.alive })) } });
}

onmessage = async ev => {
  const m = ev.data;
  try {
    if (m.t === 'start') {
      if (!world) { const B = new Builder(NULL_GFX); buildSouq(B); world = B.finish(); }
      srv = new GameServer(world, {
        room: m.room, cfg: m.cfg, brokers: m.brokers, bench: m.bench, mid: m.mid, name: 'سيرفر الرافدين',
        log: s => post({ t: 'log', s }),
        hooks: { onJoin: d => post({ t: 'join', d }), onLeave: d => post({ t: 'leave', d }), onEnd: d => post({ t: 'end', d }) },
      });
      if (m.rtc) srv.rtc = rtc;
      if (m.bench) {
        // اختبار التحمّل: معركة 10 بوتات بلا شبكة، مع كلفة ترميز اللقطات كأنها مرسلة
        srv.link = { peers: new Map(), mqs: [], broadcast: x => JSON.stringify(x), sendTo() { }, via: () => '', drop() { }, close() { } };
        srv.sim.buyTime = 0.2; // نقيس كلفة القتال الفعلي مباشرة
        srv.run();
      } else await srv.start();
      post({ t: 'up' });
      rep = setInterval(report, 1000);
    } else if (!srv) return;
    else if (m.t === 'pump') srv.loopOnce();
    else if (m.t === 'rtcEv') srv.link && srv.link.proxyEvent && srv.link.proxyEvent(m.e, m.from, m.x);
    else if (m.t === 'kick') { for (const [cid, cl] of srv.clients) if (cl.u === m.u) { srv.link.sendTo(cid, { k: 'err', msg: m.msg || 'أخرجك مدير السيرفر' }, true); srv.remove(cid); } }
    else if (m.t === 'stop') { clearInterval(rep); srv.stop(); srv = null; post({ t: 'stopped' }); setTimeout(() => close(), 300); }
  } catch (e) { post({ t: 'fail', s: String(e && e.message || e) }); }
};
