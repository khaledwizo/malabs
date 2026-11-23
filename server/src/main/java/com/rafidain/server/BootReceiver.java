package com.rafidain.server;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** بعد إعادة تشغيل الهاتف: إذا كان السيرفر شغّال قبلها، يرجع يشتغل لوحده. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        String a = i != null ? i.getAction() : null;
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !"android.intent.action.MY_PACKAGE_REPLACED".equals(a)) return;
        if (Engine.prefs(c).getBoolean("run", false)) ServerService.start(c.getApplicationContext());
    }
}
