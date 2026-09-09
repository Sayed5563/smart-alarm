package com.sayed.smartalarm;

import android.app.KeyguardManager;
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
    startedByAlarm = isAlarmIntent(getIntent());
    super.onCreate(savedInstanceState);
    if (startedByAlarm) applyAlarmWindowFlags();
  }

  @Override
  protected void onNewIntent(Intent intent) {
    if (isAlarmIntent(intent)) startedByAlarm = true;
    super.onNewIntent(intent);
    setIntent(intent);
    if (startedByAlarm) applyAlarmWindowFlags();
  }

  private static boolean isAlarmIntent(Intent i) {
    return i != null && i.getBooleanExtra("sa_launchedByAlarm", false);
  }

  /**
   * Ask to unlock — only for a wake-up task, which needs the keyboard or the
   * camera. The alarm itself never calls this: being told to authenticate the
   * moment an alarm appears is the thing we're fixing.
   */
  void requestKeyguardDismiss() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return;
    KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
    if (km != null && km.isKeyguardLocked()) km.requestDismissKeyguard(this, null);
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

  /**
   * When launched by an alarm, show over the lock screen and wake the display.
   *
   * Deliberately does NOT ask to dismiss the keyguard. On a phone with a secure
   * lock, requestDismissKeyguard() / FLAG_DISMISS_KEYGUARD pops the PIN or
   * biometric prompt the instant the alarm appears — the user is told to unlock
   * their phone just to reach Stop. showWhenLocked alone already draws over the
   * keyguard *and* accepts touch, which is how the stock clock lets you stop an
   * alarm without unlocking. The phone stays locked the whole time.
   */
  private void applyAlarmWindowFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    } else {
      getWindow().addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
              | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
              | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
  }
}
