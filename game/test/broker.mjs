// وسيط MQTT مصغّر للاختبار المحلي (WebSocket) — يدعم CONNECT/SUBSCRIBE/PUBLISH QoS0/PING
// الاستعمال: node test/broker.mjs 8883 [تأخير_ms] [نسبة_ضياع]
import { WebSocketServer } from '/opt/npm-tools/node_modules/ws/wrapper.mjs';
const port = +process.argv[2] || 8883, delay = +process.argv[3] || 0, loss = +process.argv[4] || 0;
const subs = new Map(); // topic → Set(ws)
let msgs = 0, bytes = 0;
const wss = new WebSocketServer({ port, handleProtocols: p => p.has('mqtt') ? 'mqtt' : false });
function varLen(n) { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; o.push(b); } while (n > 0); return o; }
function pkt(type, flags, body) { return Buffer.concat([Buffer.from([(type << 4) | flags, ...varLen(body.length)]), Buffer.from(body)]); }
wss.on('connection', ws => {
  let buf = Buffer.alloc(0); ws.topics = new Set();
  ws.on('message', data => {
    buf = Buffer.concat([buf, data]);
    while (buf.length >= 2) {
      let mul = 1, len = 0, i = 1, byte;
      do { if (i >= buf.length) return; byte = buf[i++]; len += (byte & 127) * mul; mul *= 128; } while (byte & 128);
      if (buf.length < i + len) return;
      const type = buf[0] >> 4, body = buf.subarray(i, i + len); buf = buf.subarray(i + len);
      if (type === 1) ws.send(pkt(2, 0, [0, 0]));
      else if (type === 8) { const id = [body[0], body[1]]; let o = 2; while (o < body.length) { const tl = (body[o] << 8) | body[o + 1]; const t = body.subarray(o + 2, o + 2 + tl).toString(); o += 2 + tl + 1; if (!subs.has(t)) subs.set(t, new Set()); subs.get(t).add(ws); ws.topics.add(t); } ws.send(pkt(9, 0, [...id, 0])); }
      else if (type === 3) {
        const tl = (body[0] << 8) | body[1], t = body.subarray(2, 2 + tl).toString();
        const out = pkt(3, 0, body); msgs++; bytes += out.length;
        const S = subs.get(t); if (!S) continue;
        for (const c of S) { if (loss && Math.random() < loss) continue; if (delay) setTimeout(() => c.readyState === 1 && c.send(out), delay * (0.7 + Math.random() * 0.6)); else c.send(out); }
      }
      else if (type === 12) ws.send(Buffer.from([0xD0, 0]));
      else if (type === 14) ws.close();
    }
  });
  ws.on('close', () => { for (const t of ws.topics) { const S = subs.get(t); if (S) S.delete(ws); } });
});
setInterval(() => { if (msgs) console.log(`broker: ${msgs} msg/5s, ${(bytes / 5 / 1024).toFixed(1)} KB/s`); msgs = 0; bytes = 0; }, 5000);
console.log('mini broker on ws://localhost:' + port, delay ? `delay ${delay}ms` : '', loss ? `loss ${loss}` : '');
