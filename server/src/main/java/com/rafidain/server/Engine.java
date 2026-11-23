package com.rafidain.server;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.MutableContextWrapper;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.TrafficStats;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

/**
 * محرك السيرفر: صفحة واحدة (assets/server.html) تدير كل المعارك بعمّال منفصلين، وتعرض لوحة الإدارة.
 * الصفحة تعيش ما دامت الخدمة الأمامية شغّالة، حتى لو انسدّت الواجهة أو انطفأت الشاشة.
 * النظام يخنق مؤقّتات الصفحات المخفية، فنضخّها من هنا كل 100ms.
 */
public final class Engine {
    @SuppressLint("StaticFieldLeak") private static Engine I;
    final Context app;
    private final MutableContextWrapper ctx;
    private final Handler ui = new Handler(Looper.getMainLooper());
    WebView web;
    Activity host;
    volatile boolean running;

    private final Runnable pump = new Runnable() {
        @Override public void run() {
            if (web != null) try { web.evaluateJavascript("window.__pump&&__pump()", null); } catch (Exception e) { }
            ui.postDelayed(this, 100);
        }
    };

    static Engine get(Context c) {
        if (I == null) I = new Engine(c.getApplicationContext());
        return I;
    }
    static Engine peek() { return I; }

    private Engine(Context app) {
        this.app = app;
        ctx = new MutableContextWrapper(app);
        running = prefs(app).getBoolean("run", false);
        create();
        ui.postDelayed(pump, 100);
    }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("server", Context.MODE_PRIVATE); }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void create() {
        web = new WebView(ctx);
        web.setBackgroundColor(Color.rgb(11, 13, 16));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { app.startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception e) { }
                return true;
            }
            // انهيار محرك الصفحة: نبنيه من جديد، والصفحة ترجع تشتغل تلقائياً إذا كان السيرفر شغّال
            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) { ui.post(Engine.this::recover); return true; }
        });
        web.addJavascriptInterface(new Bridge(), "RafidainServer");
        web.loadUrl("file:///android_asset/server.html");
    }

    private void recover() {
        ViewGroup p = web != null ? (ViewGroup) web.getParent() : null;
        if (p != null) p.removeView(web);
        try { if (web != null) web.destroy(); } catch (Exception e) { }
        create();
        if (host != null) host.setContentView(web);
    }

    void attach(Activity a) { host = a; ctx.setBaseContext(a); unparent(); }
    void detach(Activity a) { if (host == a) host = null; unparent(); ctx.setBaseContext(app); }
    private void unparent() { if (web != null && web.getParent() instanceof ViewGroup) ((ViewGroup) web.getParent()).removeView(web); }

    /** بلا واجهة وبلا سيرفر شغّال: نحرّر الذاكرة. */
    void releaseIfIdle() {
        if (running || host != null) return;
        ui.removeCallbacks(pump);
        unparent();
        try { if (web != null) web.destroy(); } catch (Exception e) { }
        web = null; I = null;
    }

    private class Bridge {
        @JavascriptInterface
        public void setRunning(boolean on) {
            running = on;
            prefs(app).edit().putBoolean("run", on).apply();
            ui.post(() -> { if (on) ServerService.start(app); else ServerService.stop(app); });
        }

        @JavascriptInterface
        public void status(String text) { ui.post(() -> ServerService.update(app, text)); }

        /** قياسات الجهاز للوحة: الذاكرة، معالج التطبيق، الشبكة، البطارية والحرارة. */
        @JavascriptInterface
        public String sys() {
            StringBuilder b = new StringBuilder("{");
            b.append("\"cores\":").append(Runtime.getRuntime().availableProcessors());
            try {
                ActivityManager am = (ActivityManager) app.getSystemService(Context.ACTIVITY_SERVICE);
                ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
                am.getMemoryInfo(mi);
                b.append(",\"memTotal\":").append(mi.totalMem).append(",\"memAvail\":").append(mi.availMem).append(",\"lowMem\":").append(mi.lowMemory);
            } catch (Exception e) { }
            b.append(",\"cpuMs\":").append(Process.getElapsedCpuTime());
            try {
                long rx = TrafficStats.getUidRxBytes(Process.myUid()), tx = TrafficStats.getUidTxBytes(Process.myUid());
                if (rx != TrafficStats.UNSUPPORTED) b.append(",\"rx\":").append(rx).append(",\"tx\":").append(tx);
            } catch (Exception e) { }
            try {
                IntentFilter bf = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent bi = Build.VERSION.SDK_INT >= 33 ? app.registerReceiver(null, bf, Context.RECEIVER_NOT_EXPORTED) : app.registerReceiver(null, bf);
                if (bi != null) {
                    int lvl = bi.getIntExtra(BatteryManager.EXTRA_LEVEL, -1), sc = bi.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                    int st = bi.getIntExtra(BatteryManager.EXTRA_STATUS, -1), t = bi.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
                    if (lvl >= 0) b.append(",\"batt\":").append(Math.round(lvl * 100f / sc));
                    b.append(",\"charging\":").append(st == BatteryManager.BATTERY_STATUS_CHARGING || st == BatteryManager.BATTERY_STATUS_FULL);
                    if (t != Integer.MIN_VALUE) b.append(",\"temp\":").append(t / 10.0);
                }
            } catch (Exception e) { }
            try {
                PowerManager pm = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
                if (Build.VERSION.SDK_INT >= 29) b.append(",\"thermal\":").append(pm.getCurrentThermalStatus());
                b.append(",\"screenOn\":").append(pm.isInteractive());
            } catch (Exception e) { }
            b.append(",\"sdk\":").append(Build.VERSION.SDK_INT);
            b.append(",\"model\":\"").append((Build.MANUFACTURER + " " + Build.MODEL).replace("\"", "")).append("\"");
            b.append(",\"svc\":").append(ServerService.alive);
            return b.append("}").toString();
        }

        @JavascriptInterface
        public boolean batteryFree() {
            if (Build.VERSION.SDK_INT < 23) return true;
            PowerManager pm = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(app.getPackageName());
        }

        @JavascriptInterface
        @SuppressLint("BatteryLife")
        public void askBattery() {
            ui.post(() -> {
                if (Build.VERSION.SDK_INT < 23) return;
                Context c = host != null ? host : app;
                try {
                    c.startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + app.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception e) {
                    try { c.startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception x) { }
                }
            });
        }

        // نسخ احتياطية بمجلد التطبيق (نحتفظ بآخر 5)
        private File dir() { File d = new File(app.getExternalFilesDir(null) != null ? app.getExternalFilesDir(null) : app.getFilesDir(), "backups"); d.mkdirs(); return d; }

        @JavascriptInterface
        public String saveBackup(String json) {
            try {
                File d = dir(), f = new File(d, "rafidain-server-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date()) + ".json");
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
                File[] all = d.listFiles(); if (all != null && all.length > 5) { Arrays.sort(all); for (int i = 0; i < all.length - 5; i++) all[i].delete(); }
                return f.getAbsolutePath();
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface
        public String loadBackup() {
            try {
                File[] all = dir().listFiles(); if (all == null || all.length == 0) return null;
                Arrays.sort(all); File f = all[all.length - 1];
                byte[] buf = new byte[(int) f.length()];
                try (FileInputStream in = new FileInputStream(f)) { int n = 0; while (n < buf.length) { int r = in.read(buf, n, buf.length - n); if (r < 0) break; n += r; } }
                return new String(buf, StandardCharsets.UTF_8);
            } catch (Exception e) { return null; }
        }
    }
}
