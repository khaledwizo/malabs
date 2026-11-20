// عميل MQTT 3.1.1 مصغّر فوق WebSocket (لا يحتاج مكتبات): اتصال، اشتراك، نشر QoS0، نبض
const enc = new TextEncoder(), dec = new TextDecoder();
function varLen(n) { const out = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; out.push(b); } while (n > 0); return out; }
function str(s) { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
function packet(type, flags, body) { const head = [(type << 4) | flags, ...varLen(body.length)]; const u = new Uint8Array(head.length + body.length); u.set(head, 0); u.set(body, head.length); return u; }

export const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];

export class Mqtt {
  constructor(url) { this.url = url; this.ws = null; this.subs = new Map(); this.pid = 1; this.connected = false; this.onmessage = null; this.onclose = null; this.buf = new Uint8Array(0); this.ping = null; }
  connect(timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = e => { if (done) return; done = true; try { this.ws && this.ws.close(); } catch (x) { } reject(e); };
      const to = setTimeout(() => fail(new Error('timeout')), timeoutMs);
      let ws; try { ws = new WebSocket(this.url, ['mqtt']); } catch (e) { clearTimeout(to); return fail(e); }
      this.ws = ws; ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        const id = 'rf' + Math.random().toString(36).slice(2, 12);
        const body = [...str('MQTT'), 4, 0x02, 0, 40, ...str(id)]; // clean session، keepalive 40ث
        ws.send(packet(1, 0, body));
      };
      ws.onerror = () => fail(new Error('ws error'));
      ws.onclose = () => { this.connected = false; clearInterval(this.ping); if (!done) fail(new Error('closed')); else if (this.onclose) this.onclose(); };
      ws.onmessage = ev => {
        const chunk = new Uint8Array(ev.data), b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
        while (true) {
          if (this.buf.length < 2) break;
          let mul = 1, len = 0, i = 1, byte;
          do { if (i >= this.buf.length) return; byte = this.buf[i++]; len += (byte & 127) * mul; mul *= 128; } while (byte & 128);
          if (this.buf.length < i + len) break;
          const type = this.buf[0] >> 4, body = this.buf.subarray(i, i + len);
          this.buf = this.buf.slice(i + len);
          if (type === 2) { // CONNACK
            if (body[1] !== 0) return fail(new Error('connack ' + body[1]));
            clearTimeout(to); done = true; this.connected = true;
            this.ping = setInterval(() => { try { ws.send(new Uint8Array([0xC0, 0])); } catch (e) { } }, 25000);
            resolve(this);
          } else if (type === 3) { // PUBLISH
            const tl = (body[0] << 8) | body[1], topic = dec.decode(body.subarray(2, 2 + tl));
            const qos = (this.buf && 0) || 0; const payload = body.subarray(2 + tl);
            if (this.onmessage) this.onmessage(topic, payload);
          }
        }
      };
    });
  }
  subscribe(topic) { const id = this.pid++ & 0xffff || 1; this.ws.send(packet(8, 2, [id >> 8, id & 255, ...str(topic), 0])); }
  publish(topic, data) {
    if (!this.connected || this.ws.readyState !== 1) return false;
    const t = str(topic), p = typeof data === 'string' ? enc.encode(data) : data;
    const body = new Uint8Array(t.length + p.length); body.set(t, 0); body.set(p, t.length);
    this.ws.send(packet(3, 0, body)); return true;
  }
  close() { try { this.ws.send(new Uint8Array([0xE0, 0])); this.ws.close(); } catch (e) { } this.connected = false; clearInterval(this.ping); }
}

// قائمة الوسطاء (يمكن تغييرها للاختبار: ?broker=ws://host:port/mqtt)
export function brokerList() { try { const q = new URLSearchParams(location.search).get('broker'); if (q) return q.split(','); } catch (e) { } return BROKERS; }
// يتصل بأول وسيط متاح من القائمة
export async function connectAny(list = brokerList(), onStatus) {
  let last;
  for (const url of list) {
    try { onStatus && onStatus('الاتصال بـ ' + url.split('/')[2].split(':')[0] + '…'); const m = new Mqtt(url); await m.connect(); return m; }
    catch (e) { last = e; }
  }
  throw last || new Error('no broker');
}
export const utf8 = { enc: s => enc.encode(s), dec: b => dec.decode(b) };
