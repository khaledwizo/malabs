package com.rafidain.front;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.os.Vibrator;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/** غلاف بسيط: يعرض اللعبة (assets/index.html) في WebView بملء الشاشة. */
public class MainActivity extends Activity {
    private WebView web;
    private LanHub lan;
    private long lastBack = 0;
    // نطق كلام أهل السوق: 0 قيد التهيئة، 1 جاهز بصوت عربي، -1 غير متاح (تبقى الهمهمة والفقاعات)
    private TextToSpeech tts;
    private volatile int ttsState = 0;
    private final List<Voice> arVoices = new ArrayList<>();

    private void initTts() {
        try {
            tts = new TextToSpeech(this, st -> {
                if (st != TextToSpeech.SUCCESS || tts == null) { ttsState = -1; return; }
                try {
                    int r = tts.setLanguage(new Locale("ar"));
                    if (r < TextToSpeech.LANG_AVAILABLE) { ttsState = -1; return; }
                    if (Build.VERSION.SDK_INT >= 21 && tts.getVoices() != null) {
                        for (Voice v : tts.getVoices()) {
                            if (v.getLocale() != null && "ar".equals(v.getLocale().getLanguage()) && !v.isNetworkConnectionRequired() && (v.getFeatures() == null || !v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))) arVoices.add(v);
                        }
                        Collections.sort(arVoices, (a, b) -> a.getName().compareTo(b.getName()));
                    }
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String id) { }
                        @Override public void onDone(String id) { done(id); }
                        @Override @SuppressWarnings("deprecation") public void onError(String id) { done(id); }
                        @Override public void onError(String id, int code) { done(id); }
                        @Override public void onStop(String id, boolean interrupted) { done(id); }
                    });
                    ttsState = 1;
                } catch (Exception e) { ttsState = -1; }
            });
        } catch (Exception e) { ttsState = -1; }
    }

    private void done(final String id) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript("window.__ttsDone&&window.__ttsDone('" + id.replace("'", "") + "')", null); });
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* لا متصفح */ }
                return true;
            }
        });
        lan = new LanHub(this, code -> runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }));
        web.addJavascriptInterface(new Bridge(), "RafidainAndroid");
        setContentView(web);
        // منع إيماءة الرجوع من حافتي الشاشة كي لا تسرق لمسات عصا الحركة والتصويب
        if (Build.VERSION.SDK_INT >= 29) web.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> {
            int ex = (int) (200 * getResources().getDisplayMetrics().density), w2 = r - l, h2 = b - t;
            List<Rect> rects = new ArrayList<>();
            rects.add(new Rect(0, Math.max(0, h2 - ex * 2), Math.min(ex / 2, w2), h2));
            rects.add(new Rect(Math.max(0, w2 - ex / 2), Math.max(0, h2 - ex * 2), w2, h2));
            v.setSystemGestureExclusionRects(rects);
        });
        hideBars();
        if (state != null) web.restoreState(state);
        if (web.getUrl() == null) web.loadUrl("file:///android_asset/index.html");
        initTts();
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.evaluateJavascript("window.__rafidainPause && window.__rafidainPause()", null);
            try { if (tts != null) tts.stop(); } catch (Exception e) { }
            web.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        hideBars();
    }

    @Override
    protected void onDestroy() {
        try { if (lan != null) lan.stop(); } catch (Exception e) { }
        if (tts != null) { try { tts.shutdown(); } catch (Exception e) { } tts = null; }
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(window.__rafidainBack && window.__rafidainBack()) ? 1 : 0", v -> {
            if ("1".equals(v)) return;
            long now = System.currentTimeMillis();
            if (now - lastBack < 2000) finish();
            else {
                lastBack = now;
                Toast.makeText(MainActivity.this, "اضغط رجوع مرة أخرى للخروج", Toast.LENGTH_SHORT).show();
            }
        });
    }

    /** ما تستدعيه اللعبة من JavaScript: window.NabdAndroid */
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
        @SuppressWarnings("deprecation")
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                int d = Math.max(1, Math.min(ms, 400));
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
                else v.vibrate(d);
            } catch (Exception e) { /* بلا اهتزاز */ }
        }

        @JavascriptInterface
        public int ttsStatus() { return ttsState; }

        @JavascriptInterface
        public int voiceCount() { return Math.max(1, arVoices.size()); }

        /** يقرأ جملة بصوت عربي: النبرة والسرعة والصوت لكل شخص، والحجم والاتجاه حسب بعده عنك */
        @JavascriptInterface
        public void speak(String id, String text, float pitch, float rate, float vol, float pan, int voice) {
            if (tts == null || ttsState != 1) { done(id); return; }
            try {
                if (!arVoices.isEmpty()) tts.setVoice(arVoices.get(Math.abs(voice) % arVoices.size()));
                tts.setPitch(Math.max(0.5f, Math.min(2f, pitch)));
                tts.setSpeechRate(Math.max(0.5f, Math.min(2f, rate)));
                Bundle p = new Bundle();
                p.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(1f, vol)));
                p.putFloat(TextToSpeech.Engine.KEY_PARAM_PAN, Math.max(-1f, Math.min(1f, pan)));
                if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, p, id) != TextToSpeech.SUCCESS) done(id);
            } catch (Exception e) { done(id); }
        }

        @JavascriptInterface
        public void stopSpeak() { try { if (tts != null) tts.stop(); } catch (Exception e) { } }

        @JavascriptInterface
        public void copy(final String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("rafidain", text));
                Toast.makeText(MainActivity.this, "نُسخ", Toast.LENGTH_SHORT).show();
            });
        }

        /** نسخة احتياطية من معرّف اللاعب وقائمة أصدقائه (تبقى حتى لو مُسحت بيانات الصفحة) */
        @JavascriptInterface
        public String loadId() { return getSharedPreferences("rafidain", MODE_PRIVATE).getString("social", ""); }

        @JavascriptInterface
        public void saveId(String data) { getSharedPreferences("rafidain", MODE_PRIVATE).edit().putString("social", data).apply(); }

        // نسخة احتياطية لبيانات اللعبة (المحفظة والمخزون) خارج تخزين الصفحة
        @JavascriptInterface
        public String loadKV(String key) { return getSharedPreferences("rafidain", MODE_PRIVATE).getString("kv_" + key, ""); }

        @JavascriptInterface
        public void saveKV(String key, String data) { getSharedPreferences("rafidain", MODE_PRIVATE).edit().putString("kv_" + key, data).apply(); }

        @JavascriptInterface
        public void share(final String text) {
            runOnUiThread(() -> {
                try {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(i, "مشاركة"));
                } catch (Exception e) { /* لا تطبيقات مشاركة */ }
            });
        }
    }
}
