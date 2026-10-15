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
  static final String EXTRA_SNOOZE_MIN = "sa_snoozeMin";
  static final String EXTRA_AFTER_SOUND = "sa_afterSound";
  static final String EXTRA_RING_SOUND = "sa_ringSound";
  static final String EXTRA_RING_VOLUME = "sa_ringVolume";
  static final String EXTRA_FADE_IN = "sa_fadeIn";
  static final String EXTRA_VIBRATION = "sa_vibration";
  static final String EXTRA_AFTER_VOLUME = "sa_afterVolume";
  static final String EXTRA_AFTER_MUST_FINISH = "sa_afterMustFinish";

  /** Mirrors the web layer's `minuteKey` — note Calendar.MONTH is 0-based, as
   *  JavaScript's getMonth() is, so the two produce identical strings. */
  static String minuteKey(long ms) {
    java.util.Calendar c = java.util.Calendar.getInstance();
    c.setTimeInMillis(ms);
    return c.get(java.util.Calendar.YEAR)
        + "-" + c.get(java.util.Calendar.MONTH)
        + "-" + c.get(java.util.Calendar.DAY_OF_MONTH)
        + "-" + c.get(java.util.Calendar.HOUR_OF_DAY)
        + "-" + c.get(java.util.Calendar.MINUTE);
  }

  /**
   * The same alarm one week later, at the same wall-clock time (Calendar keeps
   * it right across a daylight-saving change), keyed exactly as the web layer
   * would key it so the app's next sync replaces rather than duplicates it.
   */
  static AlarmStore.Entry nextWeek(AlarmStore.Entry e) {
    java.util.Calendar c = java.util.Calendar.getInstance();
    c.setTimeInMillis(e.at);
    c.add(java.util.Calendar.DAY_OF_MONTH, 7);
    AlarmStore.Entry n = AlarmStore.Entry.fromJson(toJsonQuietly(e));
    n.at = c.getTimeInMillis();
    n.firedKey = e.alarmId + ":" + e.kind + ":" + minuteKey(n.at);
    n.id = numericId(n.firedKey);
    return n;
  }

  private static org.json.JSONObject toJsonQuietly(AlarmStore.Entry e) {
    try {
      return e.toJson();
    } catch (org.json.JSONException ex) {
      return new org.json.JSONObject();
    }
  }

  /** Mirrors the web layer's `numericId` (31-hash, 32-bit wrap, mod 2e9). */
  static int numericId(String key) {
    int h = 0;
    for (int i = 0; i < key.length(); i++) h = h * 31 + key.charAt(i);
    return Math.abs(h) % 2_000_000_000;
  }

  private static AlarmManager am(Context ctx) {
    return (AlarmManager) ctx.getApplicationContext().getSystemService(Context.ALARM_SERVICE);
  }

  /** Everything the receiver and service read about one ring. */
  static void putExtras(Intent i, AlarmStore.Entry e) {
    i.putExtra(EXTRA_ID, e.id);
    i.putExtra(EXTRA_ALARM_ID, e.alarmId);
    i.putExtra(EXTRA_KIND, e.kind);
    i.putExtra(EXTRA_TITLE, e.title);
    i.putExtra(EXTRA_FIRED_KEY, e.firedKey);
    i.putExtra(EXTRA_AT, e.at);
    i.putExtra(EXTRA_SNOOZE_MIN, e.snoozeMinutes);
    i.putExtra(AlarmActivity.EXTRA_HAS_TASK, e.hasTask);
    i.putExtra(EXTRA_AFTER_SOUND, e.afterSound);
    i.putExtra(EXTRA_RING_SOUND, e.ringSound);
    i.putExtra(EXTRA_RING_VOLUME, e.ringVolume);
    i.putExtra(EXTRA_FADE_IN, e.fadeIn);
    i.putExtra(EXTRA_VIBRATION, e.vibration);
    i.putExtra(EXTRA_AFTER_VOLUME, e.afterVolume);
    i.putExtra(EXTRA_AFTER_MUST_FINISH, e.afterMustFinish);
  }

  private static PendingIntent operation(Context ctx, AlarmStore.Entry e) {
    Intent i = new Intent(ctx, AlarmReceiver.class);
    i.setAction("com.sayed.smartalarm.FIRE." + e.id);
    putExtras(i, e);
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
