package com.sayed.smartalarm;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  /** True while this activity instance is only on screen because an alarm launched it. */
  boolean startedByAlarm = false;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(AlarmClockPlugin.class);
    Intent intent = getIntent();
    startedByAlarm = isAlarmIntent(intent);
    boolean handoff = isHandoff(intent);
    super.onCreate(savedInstanceState);
    if (handoff) {
      // Stop / Snooze from the notification or the native overlay: we only came
      // up to hand the result to the JS store (history, once-alarm bookkeeping).
      // Never actually show — background immediately, before the first frame.
      moveTaskToBack(true);
    } else if (startedByAlarm) {
      applyAlarmWindowFlags();
    }
  }

  @Override
  protected void onNewIntent(Intent intent) {
    boolean handoff = isHandoff(intent);
    if (isAlarmIntent(intent)) startedByAlarm = true;
    super.onNewIntent(intent);
    setIntent(intent);
    if (handoff) {
      moveTaskToBack(true);
    } else if (startedByAlarm) {
      applyAlarmWindowFlags();
    }
  }

  private static boolean isAlarmIntent(Intent i) {
    return i != null && i.getBooleanExtra("sa_launchedByAlarm", false);
  }

  /** A Stop/Snooze relay (see AlarmService#handoffToApp), not a real alarm screen. */
  private static boolean isHandoff(Intent i) {
    return i != null && i.getStringExtra("sa_action") != null;
  }

  /**
   * Called from the plugin when the user hits Stop / Snooze on the alarm screen.
   * If we only came up for the alarm, drop back to wherever the user was (lock
   * screen / previous app) instead of leaving the app open.
   */
  void dismissAlarmScreen() {
    if (!startedByAlarm) return;
    startedByAlarm = false;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(false);
      setTurnScreenOn(false);
    }
    moveTaskToBack(true);
  }

  /** When launched by an alarm, show over the lock screen and wake the display. */
  private void applyAlarmWindowFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
      KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
      if (km != null) km.requestDismissKeyguard(this, null);
    } else {
      getWindow().addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
              | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
              | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
              | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
  }
}
