package com.rafidain.front;

import android.content.Context;
import android.net.wifi.WifiManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * لعب على نفس الشبكة بلا إنترنت: سيرفر WebSocket صغير (منفذ 47800) + إعلان UDP (منفذ 47801)
 * حتى تلگى الأجهزة اللي على نفس الواي فاي (أو نقطة الاتصال) اللعبة وتدخلها مباشرة.
 */
public class LanHub {
    public interface Sink { void js(String code); }
    public static final int PORT = 47800, DISC = 47801;
    private final Context ctx; private final Sink sink;
    private ServerSocket ss; private volatile boolean hosting = false, scanning = false;
    private String room = "", name = "", info = "{}";
    private final Map<Integer, Conn> conns = new ConcurrentHashMap<>();
    private int nextId = 1;
    private final Map<String, JSONObject> found = new ConcurrentHashMap<>();
    private DatagramSocket scanSock; private WifiManager.MulticastLock lock;

    public LanHub(Context c, Sink s) { ctx = c.getApplicationContext(); sink = s; }

    // ---------- عناوين الجهاز ----------
    public static String localIp() {
        try {
            String best = "";
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    InetAddress a = ia.getAddress();
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) { String n = ni.getName(); if (n.startsWith("wlan") || n.startsWith("ap") || n.startsWith("swlan")) return a.getHostAddress(); if (best.isEmpty()) best = a.getHostAddress(); }
                }
            }
            return best;
        } catch (Exception e) { return ""; }
    }
    private static List<InetAddress> broadcasts() {
        List<InetAddress> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) if (ia.getBroadcast() != null) out.add(ia.getBroadcast());
            }
            out.add(InetAddress.getByName("255.255.255.255"));
        } catch (Exception e) { }
        return out;
    }
    private void multicast(boolean on) {
        try {
            if (on && lock == null) { WifiManager w = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE); if (w != null) { lock = w.createMulticastLock("rafidain"); lock.setReferenceCounted(false); lock.acquire(); } }
            else if (!on && lock != null && !hosting && !scanning) { lock.release(); lock = null; }
        } catch (Exception e) { }
    }

    // ---------- المضيف ----------
    public synchronized String start(String room, String name, String info) {
        this.room = room; this.name = name; this.info = info == null ? "{}" : info;
        if (hosting) { String ip = localIp(); return ip.isEmpty() ? "local" : ip; }
        try { ss = new ServerSocket(); ss.setReuseAddress(true); ss.bind(new InetSocketAddress(PORT)); } catch (Exception e) { return ""; }
        hosting = true; multicast(true);
        new Thread(this::acceptLoop, "lan-accept").start();
        new Thread(this::beaconLoop, "lan-beacon").start();
        String ip = localIp(); return ip.isEmpty() ? "local" : ip;
    }
    public synchronized void setInfo(String info) { this.info = info; }
    public synchronized void stop() {
        hosting = false;
        try { if (ss != null) ss.close(); } catch (Exception e) { }
        for (Conn c : conns.values()) c.close(); conns.clear();
        multicast(false);
    }
    private void beaconLoop() {
        try (DatagramSocket s = new DatagramSocket()) {
            s.setBroadcast(true);
            while (hosting) {
                JSONObject j = new JSONObject();
                j.put("app", "rafidain"); j.put("room", room); j.put("name", name); j.put("port", PORT); j.put("ip", localIp()); j.put("n", conns.size());
                try { j.put("info", new JSONObject(info)); } catch (Exception e) { }
                byte[] b = j.toString().getBytes("UTF-8");
                for (InetAddress a : broadcasts()) { try { s.send(new DatagramPacket(b, b.length, a, DISC)); } catch (Exception e) { } }
                Thread.sleep(900);
            }
        } catch (Exception e) { }
    }
    private void acceptLoop() {
        while (hosting) {
            try {
                Socket s = ss.accept(); s.setTcpNoDelay(true);
                int id; synchronized (this) { id = nextId++; }
                Conn c = new Conn(id, s); new Thread(c::run, "lan-" + id).start();
            } catch (Exception e) { if (!hosting) return; }
        }
    }
    public void send(int id, String text) { Conn c = conns.get(id); if (c != null) c.send(text); }
    public void broadcast(String text) { for (Conn c : conns.values()) c.send(text); }
    public void kick(int id) { Conn c = conns.get(id); if (c != null) c.close(); }

    private class Conn {
        final int id; final Socket s; OutputStream out; volatile boolean open = true;
        Conn(int id, Socket s) { this.id = id; this.s = s; }
        void run() {
            try {
                InputStream in = new BufferedInputStream(s.getInputStream()); out = new BufferedOutputStream(s.getOutputStream());
                // المصافحة
                String key = null; StringBuilder line = new StringBuilder(); int ch, prev = 0; List<String> lines = new ArrayList<>();
                while ((ch = in.read()) != -1) { if (ch == '\n') { String l = line.toString().trim(); if (l.isEmpty()) break; lines.add(l); line.setLength(0); } else line.append((char) ch); prev = ch; }
                for (String l : lines) { int i = l.indexOf(':'); if (i > 0 && l.substring(0, i).trim().equalsIgnoreCase("Sec-WebSocket-Key")) key = l.substring(i + 1).trim(); }
                if (key == null) { s.close(); return; }
                MessageDigest md = MessageDigest.getInstance("SHA-1");
                String acc = android.util.Base64.encodeToString(md.digest((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes("UTF-8")), android.util.Base64.NO_WRAP);
                out.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acc + "\r\n\r\n").getBytes("UTF-8")); out.flush();
                conns.put(id, this); sink.js("window.__lan&&window.__lan.open(" + id + ")");
                ByteArrayOutputStream msg = new ByteArrayOutputStream();
                while (open) {
                    int b0 = in.read(); if (b0 < 0) break; int b1 = in.read(); if (b1 < 0) break;
                    boolean fin = (b0 & 0x80) != 0; int op = b0 & 0x0f; long len = b1 & 0x7f;
                    if (len == 126) len = (in.read() << 8) | in.read();
                    else if (len == 127) { len = 0; for (int i = 0; i < 8; i++) len = (len << 8) | in.read(); }
                    if (len > 4_000_000) break;
                    byte[] mask = new byte[4]; if ((b1 & 0x80) != 0) readFully(in, mask, 4);
                    byte[] p = new byte[(int) len]; readFully(in, p, (int) len);
                    if ((b1 & 0x80) != 0) for (int i = 0; i < p.length; i++) p[i] ^= mask[i & 3];
                    if (op == 8) break;
                    if (op == 9) { frame(10, p); continue; }
                    if (op == 10) continue;
                    msg.write(p);
                    if (fin) { String t = new String(msg.toByteArray(), "UTF-8"); msg.reset(); sink.js("window.__lan&&window.__lan.msg(" + id + "," + JSONObject.quote(t) + ")"); }
                }
            } catch (Exception e) { }
            close();
        }
        private void readFully(InputStream in, byte[] b, int n) throws IOException { int o = 0; while (o < n) { int r = in.read(b, o, n - o); if (r < 0) throw new EOFException(); o += r; } }
        synchronized void frame(int op, byte[] p) throws IOException {
            out.write(0x80 | op);
            if (p.length < 126) out.write(p.length);
            else if (p.length < 65536) { out.write(126); out.write(p.length >> 8); out.write(p.length & 0xff); }
            else { out.write(127); for (int i = 7; i >= 0; i--) out.write((int) ((long) p.length >> (8 * i)) & 0xff); }
            out.write(p); out.flush();
        }
        void send(String t) { if (!open) return; try { frame(1, t.getBytes("UTF-8")); } catch (Exception e) { close(); } }
        void close() { if (!open) return; open = false; conns.remove(id); try { s.close(); } catch (Exception e) { } sink.js("window.__lan&&window.__lan.close(" + id + ")"); }
    }

    // ---------- البحث عن ألعاب على نفس الشبكة ----------
    public synchronized void scan(boolean on) {
        if (on == scanning) return; scanning = on;
        if (!on) { try { if (scanSock != null) scanSock.close(); } catch (Exception e) { } scanSock = null; multicast(false); return; }
        multicast(true);
        new Thread(() -> {
            try {
                DatagramSocket s = new DatagramSocket(null); s.setReuseAddress(true); s.setBroadcast(true); s.bind(new InetSocketAddress(DISC)); scanSock = s;
                byte[] buf = new byte[4096];
                while (scanning) {
                    DatagramPacket pk = new DatagramPacket(buf, buf.length); s.receive(pk);
                    try { JSONObject j = new JSONObject(new String(pk.getData(), 0, pk.getLength(), "UTF-8")); if (!"rafidain".equals(j.optString("app"))) continue; j.put("ip", pk.getAddress().getHostAddress()); j.put("t", System.currentTimeMillis()); found.put(j.optString("room"), j); } catch (Exception e) { }
                }
            } catch (Exception e) { }
        }, "lan-scan").start();
    }
    public String found() {
        JSONArray a = new JSONArray(); long now = System.currentTimeMillis();
        for (JSONObject j : found.values()) if (now - j.optLong("t") < 4000) a.put(j);
        return a.toString();
    }
}
