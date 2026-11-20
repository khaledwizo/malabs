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

/** خدمة أمامية تبقي السيرفر حياً: تمنع النظام من إيقاف التطبيق وتبقي المعالج والواي فاي مستيقظين. */
public class KeepAlive extends Service {
    private static final String CH = "rafidain_server";
    private PowerManager.WakeLock cpu;
    private WifiManager.WifiLock wifi;

    static void start(Context c, String room) {
        Intent i = new Intent(c, KeepAlive.class).putExtra("room", room);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
        } catch (Exception e) { /* قد يرفض النظام في الخلفية */ }
    }

    static void stop(Context c) { c.stopService(new Intent(c, KeepAlive.class)); }

    @Override
    @SuppressWarnings("deprecation")
    public int onStartCommand(Intent intent, int flags, int startId) {
        String room = intent != null ? intent.getStringExtra("room") : null;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null && nm.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, "السيرفر", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("يبقى ظاهراً ما دام السيرفر يعمل");
            nm.createNotificationChannel(ch);
        }
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle("سيرفر الرافدين يعمل")
                .setContentText(room != null && !room.isEmpty() ? "رمز الغرفة: " + room + " — اترك التطبيق مفتوحاً" : "اترك التطبيق مفتوحاً أثناء اللعب")
                .setOngoing(true)
                .setContentIntent(open);
        Notification n = b.build();
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(1, n);
        } catch (Exception e) { /* بلا خدمة أمامية */ }

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
        } catch (Exception e) { /* بلا أقفال */ }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        try { if (cpu != null && cpu.isHeld()) cpu.release(); } catch (Exception e) { }
        try { if (wifi != null && wifi.isHeld()) wifi.release(); } catch (Exception e) { }
        cpu = null; wifi = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent i) { return null; }
}
