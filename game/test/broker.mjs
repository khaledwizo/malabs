// وسيط MQTT مصغّر للاختبار المحلي (WebSocket) — CONNECT (مع الوصية)/SUBSCRIBE (مع + و #)/PUBLISH QoS0 (مع الحفظ retain)/PING
// الاستعمال: node test/broker.mjs 8883 [تأخير_ms] [نسبة_ضياع]
import { WebSocketServer } from '/opt/npm-tools/node_modules/ws/wrapper.mjs';
const port = +process.argv[2] || 8883, delay = +process.argv[3] || 0, loss = +process.argv[4] || 0;
const clients = new Set(), retained = new Map();
let msgs = 0, bytes = 0;
const wss = new WebSocketServer({ port, handleProtocols: p => p.has('mqtt') ? 'mqtt' : false });
function varLen(n) { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; o.push(b); } while (n > 0); return o; }
function pkt(type, flags, body) { return Buffer.concat([Buffer.from([(type << 4) | flags, ...varLen(body.length)]), Buffer.from(body)]); }
const match = (pat, t) => { const a = pat.split('/'), b = t.split('/'); for (let i = 0; i < a.length; i++) { if (a[i] === '#') return true; if (i >= b.length) return false; if (a[i] !== '+' && a[i] !== b[i]) return false; } return a.length === b.length; };
const pubBody = (t, payload) => { const tb = Buffer.from(t); return Buffer.concat([Buffer.from([tb.length >> 8, tb.length & 255]), tb, payload]); };
function route(t, payload, retain) {
  if (retain) { if (payload.length) retained.set(t, payload); else retained.delete(t); }
  const out = pkt(3, 0, pubBody(t, payload)); msgs++; bytes += out.length;
  for (const c of clients) { if (![...c.topics].some(p => match(p, t))) continue; if (loss && Math.random() < loss) continue; if (delay) setTimeout(() => c.readyState === 1 && c.send(out), delay * (0.7 + Math.random() * 0.6)); else c.send(out); }
}
wss.on('connection', ws => {
  let buf = Buffer.alloc(0); ws.topics = new Set(); ws.will = null; clients.add(ws);
  ws.on('message', data => {
    buf = Buffer.concat([buf, data]);
    while (buf.length >= 2) {
      let mul = 1, len = 0, i = 1, byte;
      do { if (i >= buf.length) return; byte = buf[i++]; len += (byte & 127) * mul; mul *= 128; } while (byte & 128);
      if (buf.length < i + len) return;
      const type = buf[0] >> 4, hf = buf[0] & 15, body = buf.subarray(i, i + len); buf = buf.subarray(i + len);
      if (type === 1) {
        let o = 2 + ((body[0] << 8) | body[1]); const flags = body[o + 1]; o += 4;
        const idl = (body[o] << 8) | body[o + 1]; o += 2 + idl;
        if (flags & 4) { const tl = (body[o] << 8) | body[o + 1]; const wt = body.subarray(o + 2, o + 2 + tl).toString(); o += 2 + tl; const ml = (body[o] << 8) | body[o + 1]; ws.will = { t: wt, p: Buffer.from(body.subarray(o + 2, o + 2 + ml)), r: !!(flags & 32) }; }
        ws.send(pkt(2, 0, [0, 0]));
      }
      else if (type === 8) { const id = [body[0], body[1]]; let o = 2; const added = []; while (o < body.length) { const tl = (body[o] << 8) | body[o + 1]; const t = body.subarray(o + 2, o + 2 + tl).toString(); o += 2 + tl + 1; ws.topics.add(t); added.push(t); } ws.send(pkt(9, 0, [...id, 0]));
        for (const [t, p] of retained) if (added.some(a => match(a, t))) ws.send(pkt(3, 1, pubBody(t, p))); }
      else if (type === 10) { let o = 2; while (o < body.length) { const tl = (body[o] << 8) | body[o + 1]; ws.topics.delete(body.subarray(o + 2, o + 2 + tl).toString()); o += 2 + tl; } }
      else if (type === 3) { const tl = (body[0] << 8) | body[1], t = body.subarray(2, 2 + tl).toString(); route(t, Buffer.from(body.subarray(2 + tl)), !!(hf & 1)); }
      else if (type === 12) ws.send(Buffer.from([0xD0, 0]));
      else if (type === 14) { ws.will = null; ws.close(); }
    }
  });
  ws.on('close', () => { clients.delete(ws); if (ws.will) route(ws.will.t, ws.will.p, ws.will.r); });
});
setInterval(() => { if (msgs) console.log(`broker: ${msgs} msg/5s, ${(bytes / 5 / 1024).toFixed(1)} KB/s`); msgs = 0; bytes = 0; }, 5000);
console.log('mini broker on ws://localhost:' + port, delay ? `delay ${delay}ms` : '', loss ? `loss ${loss}` : '');
