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

  /** After Stop / Snooze: if the app only came up for the alarm, send it back. */
  @PluginMethod
  public void closeAlarmScreen(PluginCall call) {
    final Activity a = getActivity();
    if (a instanceof MainActivity) {
      a.runOnUiThread(() -> ((MainActivity) a).dismissAlarmScreen());
    }
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

  private static String orDefault(String v, String d) {
    return v == null || v.isEmpty() ? d : v;
  }
}
