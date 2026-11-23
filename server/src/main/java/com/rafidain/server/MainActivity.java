package com.rafidain.server;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/** تطبيق السيرفر: يشغّل محاكاة المباراة (assets/server.html) ويبقى مستيقظاً. */
public class MainActivity extends Activity {
    private WebView web;
    private LanHub lan;
    private long lastBack = 0;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(11, 13, 16));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }
        });
        lan = new LanHub(this, code -> runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }));
        web.addJavascriptInterface(new Bridge(), "RafidainServer");
        setContentView(web);
        web.loadUrl("file:///android_asset/server.html");
        KeepAlive.start(this, "");
    }

    // لا نوقف الصفحة عند الخروج للخلفية: السيرفر يجب أن يستمر
    @Override
    protected void onPause() { super.onPause(); }

    @Override
    protected void onResume() { super.onResume(); if (web != null) web.resumeTimers(); }

    @Override
    protected void onDestroy() {
        try { if (lan != null) lan.stop(); } catch (Exception e) { }
        KeepAlive.stop(this);
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        long now = System.currentTimeMillis();
        if (now - lastBack < 2000) { KeepAlive.stop(this); finish(); return; }
        lastBack = now;
        Toast.makeText(this, "اضغط رجوع مرة أخرى لإيقاف السيرفر — أو اضغط زر الشاشة الرئيسية ليبقى يعمل", Toast.LENGTH_LONG).show();
    }

    private class Bridge {
        // ---------- لعب على نفس الشبكة (LanHub) ----------
        @JavascriptInterface public String lanStart(String room, String name, String info) { return lan.start(room, name, info); }
        @JavascriptInterface public void lanInfo(String info) { lan.setInfo(info); }
        @JavascriptInterface public void lanStop() { lan.stop(); }
        @JavascriptInterface public void lanSend(int id, String text) { lan.send(id, text); }
        @JavascriptInterface public void lanBroadcast(String text) { lan.broadcast(text); }
        @JavascriptInterface public void lanKick(int id) { lan.kick(id); }
        @JavascriptInterface public void lanScan(boolean on) { lan.scan(on); }
        @JavascriptInterface public String lanFound() { return lan.found(); }
        @JavascriptInterface public String lanIp() { return LanHub.localIp(); }

        @JavascriptInterface
        public void room(final String code) { runOnUiThread(() -> KeepAlive.start(MainActivity.this, code)); }

        @JavascriptInterface
        public void copy(final String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("room", text));
                Toast.makeText(MainActivity.this, "نُسخ رمز الغرفة", Toast.LENGTH_SHORT).show();
            });
        }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(i, "مشاركة رمز الغرفة"));
                } catch (Exception e) { }
            });
        }

        @JavascriptInterface
        public boolean batteryFree() {
            if (Build.VERSION.SDK_INT < 23) return true;
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
        }

        @JavascriptInterface
        @SuppressLint("BatteryLife")
        public void askBattery() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < 23) return;
                try {
                    startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
                } catch (Exception e) {
                    try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception x) { }
                }
            });
        }
    }
}
