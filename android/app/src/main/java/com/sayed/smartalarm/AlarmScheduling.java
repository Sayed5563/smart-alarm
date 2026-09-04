package com.sayed.smartalarm;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.List;

/** AlarmManager wrapper — exact, Doze-proof scheduling via setAlarmClock(). */
final class AlarmScheduling {

  static final String EXTRA_ID = "sa_id";
  static final String EXTRA_ALARM_ID = "sa_alarmId";
  static final String EXTRA_KIND = "sa_kind";
  static final String EXTRA_TITLE = "sa_title";
  static final String EXTRA_FIRED_KEY = "sa_firedKey";
  static final String EXTRA_AT = "sa_at";

  private static AlarmManager am(Context ctx) {
    return (AlarmManager) ctx.getApplicationContext().getSystemService(Context.ALARM_SERVICE);
  }

  private static PendingIntent operation(Context ctx, AlarmStore.Entry e) {
    Intent i = new Intent(ctx, AlarmReceiver.class);
    i.setAction("com.sayed.smartalarm.FIRE." + e.id);
    i.putExtra(EXTRA_ID, e.id);
    i.putExtra(EXTRA_ALARM_ID, e.alarmId);
    i.putExtra(EXTRA_KIND, e.kind);
    i.putExtra(EXTRA_TITLE, e.title);
    i.putExtra(EXTRA_FIRED_KEY, e.firedKey);
    i.putExtra(EXTRA_AT, e.at);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getBroadcast(ctx, e.id, i, flags);
  }

  private static PendingIntent showIntent(Context ctx) {
    Intent i = new Intent(ctx, MainActivity.class);
    i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
    return PendingIntent.getActivity(ctx, 0, i, flags);
  }

  static void set(Context ctx, AlarmStore.Entry e) {
    AlarmStore.put(ctx, e);
    AlarmManager mgr = am(ctx);
    PendingIntent op = operation(ctx, e);
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        mgr.setAlarmClock(new AlarmManager.AlarmClockInfo(e.at, showIntent(ctx)), op);
      } else {
        mgr.setExact(AlarmManager.RTC_WAKEUP, e.at, op);
      }
    } catch (SecurityException se) {
      // No exact-alarm permission (Android 12+). Fall back to an inexact alarm
      // and let the UI prompt the user to grant it.
      mgr.set(AlarmManager.RTC_WAKEUP, e.at, op);
    }
  }

  static void cancel(Context ctx, int id) {
    AlarmStore.Entry e = AlarmStore.get(ctx, id);
    AlarmStore.Entry stub = e != null ? e : blank(id);
    am(ctx).cancel(operation(ctx, stub));
    AlarmStore.remove(ctx, id);
  }

  static void cancelAll(Context ctx) {
    for (AlarmStore.Entry e : AlarmStore.all(ctx)) am(ctx).cancel(operation(ctx, e));
    AlarmStore.clear(ctx);
  }

  /** Re-arm every still-future alarm (called from BootReceiver). */
  static void rescheduleAll(Context ctx) {
    long now = System.currentTimeMillis();
    List<AlarmStore.Entry> entries = AlarmStore.all(ctx);
    for (AlarmStore.Entry e : entries) {
      if (e.at > now) {
        set(ctx, e);
      } else {
        AlarmStore.remove(ctx, e.id);
      }
    }
  }

  static boolean canScheduleExact(Context ctx) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
    return am(ctx).canScheduleExactAlarms();
  }

  private static AlarmStore.Entry blank(int id) {
    AlarmStore.Entry e = new AlarmStore.Entry();
    e.id = id;
    e.kind = "alarm";
    return e;
  }
}
