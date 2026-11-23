package com.rafidain.server;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * خدمة أمامية تبقي السيرفر شغّال والشاشة مطفأة: إشعار دائم + قفل المعالج + قفل الواي فاي.
 * START_STICKY: إذا قتل النظام التطبيق يرجّعه، والصفحة ترجع تشغّل السيرفر لوحدها.
 * ملاحظة صادقة: إطفاء الهاتف بالكامل أو نفاد البطارية أو «إيقاف إجباري» يوقف السيرفر — وقتها اللعبة تشتغل بنظام المضيف.
 */
public class ServerService extends Service {
    private static final String CH = "rafidain_server";
    static volatile boolean alive = false;
    private static String last = "يدير المعارك";
    private PowerManager.WakeLock cpu;
    private WifiManager.WifiLock wifi;

    static void start(Context c) {
        if (alive) return;
        Intent i = new Intent(c, ServerService.class);
        try { if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); } catch (Exception e) { }
    }

    static void stop(Context c) { c.stopService(new Intent(c, ServerService.class)); }

    static void update(Context c, String text) {
        last = text;
        if (!alive) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) try { nm.notify(1, build(c, text)); } catch (Exception e) { }
    }

    @SuppressWarnings("deprecation")
    private static Notification build(Context c, String text) {
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, "السيرفر", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("يبقى ظاهراً ما دام السيرفر يعمل");
            nm.createNotificationChannel(ch);
        }
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        return b.setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle("سيرفر الرافدين يعمل")
                .setContentText(text)
                .setOngoing(true)
                .setContentIntent(open)
                .build();
    }

    @Override
    @SuppressWarnings("deprecation")
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = build(this, last);
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(1, n);
        } catch (Exception e) { }
        alive = true;
        try {
            if (cpu == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                cpu = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "rafidain:server");
                cpu.setReferenceCounted(false);
                cpu.acquire();
            }
            if (wifi == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wm != null) {
                    wifi = wm.createWifiLock(Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF, "rafidain:server");
                    wifi.setReferenceCounted(false);
                    wifi.acquire();
                }
            }
        } catch (Exception e) { }
        // بعد إعادة تشغيل التطبيق من النظام: المحرك يُبنى هنا ويرجع يشغّل السيرفر
        Engine.get(this);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        alive = false;
        try { if (cpu != null && cpu.isHeld()) cpu.release(); } catch (Exception e) { }
        try { if (wifi != null && wifi.isHeld()) wifi.release(); } catch (Exception e) { }
        cpu = null; wifi = null;
        Engine e = Engine.peek(); if (e != null) e.releaseIfIdle();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent i) { return null; }
}
