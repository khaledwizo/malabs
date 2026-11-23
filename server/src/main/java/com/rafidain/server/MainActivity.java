package com.rafidain.server;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;

/** واجهة الإدارة: تعرض صفحة المحرك نفسها. سدّ الواجهة ما يوقف السيرفر — الإيقاف من زرّه فقط. */
public class MainActivity extends Activity {
    private Engine eng;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
        eng = Engine.get(this);
        eng.attach(this);
        setContentView(eng.web);
    }

    @Override
    protected void onDestroy() {
        if (eng != null) { eng.detach(this); eng.releaseIfIdle(); }
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { moveTaskToBack(true); }
}
