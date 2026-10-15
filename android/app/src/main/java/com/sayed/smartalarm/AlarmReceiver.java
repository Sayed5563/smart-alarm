package com.sayed.smartalarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.content.ContextCompat;

/** Fired by AlarmManager at the alarm time — hands off to the foreground service. */
public class AlarmReceiver extends BroadcastReceiver {

  @Override
  public void onReceive(Context context, Intent intent) {
    int id = intent.getIntExtra(AlarmScheduling.EXTRA_ID, 0);
    String kind = intent.getStringExtra(AlarmScheduling.EXTRA_KIND);
    if (kind == null) kind = "alarm";

    // Short wake lock so the service reliably starts even from deep idle.
    PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
    PowerManager.WakeLock wl = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK, "smartalarm:receiver");
    wl.acquire(20_000);

    try {
      AlarmStore.Entry fired = AlarmStore.get(context, id);
      AlarmStore.remove(context, id);
      // Keep a repeating alarm going with the app closed: its next weekly slot.
      if (fired != null && fired.repeating) AlarmScheduling.set(context, AlarmScheduling.nextWeek(fired));

      Intent svc = new Intent(context, AlarmService.class);
      svc.putExtras(intent);
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ContextCompat.startForegroundService(context, svc);
      } else {
        context.startService(svc);
      }
    } finally {
      if (wl.isHeld()) wl.release();
    }
  }
}
