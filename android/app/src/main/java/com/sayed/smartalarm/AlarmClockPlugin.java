package com.sayed.smartalarm;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * App-local Capacitor plugin: the web `nativeAlarmScheduler` talks to this to
 * schedule exact alarms, stop the ringing service, and learn when the app was
 * opened by an alarm.
 */
@CapacitorPlugin(name = "AlarmClock")
public class AlarmClockPlugin extends Plugin {

  private static AlarmClockPlugin instance;

  @Override
  public void load() {
    instance = this;
    consumeAlarmIntent(getActivity().getIntent());
  }

  @Override
  protected void handleOnNewIntent(Intent intent) {
    super.handleOnNewIntent(intent);
    consumeAlarmIntent(intent);
  }

  /** If this Intent came from an alarm, tell the web layer (retained until read). */
  private void consumeAlarmIntent(Intent intent) {
    if (intent == null || !intent.getBooleanExtra("sa_launchedByAlarm", false)) return;
    JSObject data = new JSObject();
    data.put("alarmId", intent.getStringExtra(AlarmScheduling.EXTRA_ALARM_ID));
    data.put("kind", orDefault(intent.getStringExtra(AlarmScheduling.EXTRA_KIND), "alarm"));
    data.put("at", intent.getLongExtra(AlarmScheduling.EXTRA_AT, System.currentTimeMillis()));
    data.put("firedKey", orDefault(intent.getStringExtra(AlarmScheduling.EXTRA_FIRED_KEY), ""));
    String action = intent.getStringExtra("sa_action");
    if (action != null) data.put("action", action);
    notifyListeners("alarmFired", data, true);
    // Clear so a config change / relaunch doesn't replay it.
    intent.removeExtra("sa_launchedByAlarm");
  }

  @PluginMethod
  public void schedule(PluginCall call) {
    AlarmStore.Entry e = new AlarmStore.Entry();
    e.id = call.getInt("id", 0);
    e.at = call.getLong("at", 0L);
    e.title = call.getString("title", "Alarm");
    e.kind = call.getString("kind", "alarm");
    e.alarmId = call.getString("alarmId", "");
    e.firedKey = call.getString("firedKey", "");
    e.snoozeMinutes = call.getInt("snoozeMinutes", 0);
    e.hasTask = call.getBoolean("hasTask", false);
    e.afterSound = call.getString("afterSound", "");
    e.afterVolume = call.getInt("afterVolume", 60);
    e.afterMustFinish = call.getBoolean("afterMustFinish", false);
    if (e.id == 0 || e.at <= 0) {
      call.reject("id and at are required");
      return;
    }
    AlarmScheduling.set(getContext(), e);
    call.resolve();
  }

  @PluginMethod
  public void cancel(PluginCall call) {
    Integer id = call.getInt("id");
    if (id == null) {
      call.reject("id required");
      return;
    }
    AlarmScheduling.cancel(getContext(), id);
    call.resolve();
  }

  @PluginMethod
  public void cancelAll(PluginCall call) {
    AlarmScheduling.cancelAll(getContext());
    call.resolve();
  }

  /**
   * Drain the Stop/Snooze actions the user took while the web layer wasn't
   * running. These used to arrive by launching MainActivity — which is what
   * made the app flash open after Stop — so now they simply queue up natively
   * and the app collects them whenever it next runs.
   */
  @PluginMethod
  public void consumePendingActions(PluginCall call) {
    com.getcapacitor.JSArray actions = new com.getcapacitor.JSArray();
    for (AlarmStore.Entry e : AlarmStore.takePending(getContext())) {
      JSObject o = new JSObject();
      o.put("alarmId", orDefault(e.alarmId, ""));
      o.put("kind", orDefault(e.kind, "alarm"));
      o.put("at", e.at);
      o.put("firedKey", orDefault(e.firedKey, ""));
      o.put("action", orDefault(e.action, "stop"));
      o.put("snoozeUntil", e.snoozeUntil);
      // Flags this as history, not a live tap: the app must do the bookkeeping
      // without touching a screen or a ring session that belongs to now.
      o.put("replay", true);
      actions.put(o);
    }
    JSObject ret = new JSObject();
    ret.put("actions", actions);
    call.resolve(ret);
  }

  @PluginMethod
  public void listScheduled(PluginCall call) {
    JSObject ret = new JSObject();
    com.getcapacitor.JSArray ids = new com.getcapacitor.JSArray();
    for (AlarmStore.Entry e : AlarmStore.all(getContext())) ids.put(e.id);
    ret.put("ids", ids);
    call.resolve(ret);
  }

  @PluginMethod
  public void stopRinging(PluginCall call) {
    AlarmService.stop(getContext());
    call.resolve();
  }

  /** Ask to unlock — only used when a wake-up task needs the keyboard/camera. */
  @PluginMethod
  public void dismissKeyguard(PluginCall call) {
    final Activity a = getActivity();
    if (a instanceof MainActivity) {
      a.runOnUiThread(() -> ((MainActivity) a).requestKeyguardDismiss());
    }
    call.resolve();
  }

  /** After Stop / Snooze: if the app only came up for the alarm, send it back. */
  @PluginMethod
  public void closeAlarmScreen(PluginCall call) {
    final Activity a = getActivity();
    if (!(a instanceof MainActivity)) {
      call.resolve(backgrounded(false));
      return;
    }
    // Resolve only after moveTaskToBack has run, and say whether it did: the
    // app must not repaint until its window is actually going away.
    a.runOnUiThread(() -> call.resolve(backgrounded(((MainActivity) a).dismissAlarmScreen())));
  }

  private static JSObject backgrounded(boolean value) {
    JSObject ret = new JSObject();
    ret.put("backgrounded", value);
    return ret;
  }

  /** Where an after-stop sound lives. The web app renders it ahead of time (saveSound). */
  static java.io.File afterSoundFile(android.content.Context ctx, String key) {
    return new java.io.File(new java.io.File(ctx.getFilesDir(), "after-sounds"), key);
  }

  private static boolean validKey(String key) {
    return key != null && key.matches("[A-Za-z0-9_-]{1,120}");
  }

  @PluginMethod
  public void hasSound(PluginCall call) {
    String key = call.getString("key");
    JSObject ret = new JSObject();
    ret.put("exists", validKey(key) && afterSoundFile(getContext(), key).exists());
    call.resolve(ret);
  }

  /** Store an after-stop sound (base64 audio file) so the service can play it with the app closed. */
  @PluginMethod
  public void saveSound(PluginCall call) {
    String key = call.getString("key");
    String data = call.getString("data");
    if (!validKey(key) || data == null) {
      call.reject("key and data are required");
      return;
    }
    java.io.File f = afterSoundFile(getContext(), key);
    java.io.File tmp = new java.io.File(f.getPath() + ".tmp");
    try {
      f.getParentFile().mkdirs();
      try (java.io.FileOutputStream out = new java.io.FileOutputStream(tmp)) {
        out.write(android.util.Base64.decode(data, android.util.Base64.DEFAULT));
      }
      if (!tmp.renameTo(f)) throw new java.io.IOException("rename failed");
      call.resolve();
    } catch (Exception e) {
      tmp.delete();
      call.reject("could not save sound", e);
    }
  }

  /** The web app has painted its first frame: let the splash go. */
  @PluginMethod
  public void appReady(PluginCall call) {
    MainActivity.webReady = true;
    call.resolve();
  }

  @PluginMethod
  public void canScheduleExactAlarms(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("granted", AlarmScheduling.canScheduleExact(getContext()));
    call.resolve(ret);
  }

  @PluginMethod
  public void openExactAlarmSettings(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:" + getContext().getPackageName()));
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(i);
    }
    call.resolve();
  }

  /**
   * Android 14+ can withhold USE_FULL_SCREEN_INTENT from side-loaded apps.
   * Without it the alarm still rings, but the wake screen can't appear over the
   * lock screen — only a notification does.
   */
  @PluginMethod
  public void canUseFullScreenIntent(PluginCall call) {
    JSObject ret = new JSObject();
    boolean ok = true;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      NotificationManager nm =
          (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
      ok = nm != null && nm.canUseFullScreenIntent();
    }
    ret.put("granted", ok);
    call.resolve(ret);
  }

  @PluginMethod
  public void openFullScreenIntentSettings(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:" + getContext().getPackageName()));
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(i);
    }
    call.resolve();
  }

  /**
   * The full-screen intent above only auto-launches over a *locked* keyguard —
   * with the screen already on, Android just shows a notification. "Display
   * over other apps" lets the service draw its own full-screen alarm to cover
   * that gap.
   */
  @PluginMethod
  public void canDrawOverlays(PluginCall call) {
    JSObject ret = new JSObject();
    boolean ok = Build.VERSION.SDK_INT < Build.VERSION_CODES.M
        || Settings.canDrawOverlays(getContext());
    ret.put("granted", ok);
    call.resolve(ret);
  }

  @PluginMethod
  public void openOverlaySettings(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + getContext().getPackageName()));
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(i);
    }
    call.resolve();
  }

  private static String orDefault(String v, String d) {
    return v == null || v.isEmpty() ? d : v;
  }
}
