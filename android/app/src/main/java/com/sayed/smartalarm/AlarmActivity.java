package com.sayed.smartalarm;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.Button;
import android.widget.TextView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * The ringing screen. Native and in its own task, so it never loads the web
 * app: launching MainActivity for this painted whatever the app last showed
 * (usually Home) before the ring screen, and finishing it had to background
 * the whole app — the long-running "app flashes open" bug. Finishing this just
 * drops back to the lock screen or whatever was in use.
 *
 * Covers the whole display, status bar included, locked or unlocked. Only an
 * alarm with a wake-up task opens the app, and only once Stop is pressed.
 */
public class AlarmActivity extends Activity {

  static final String EXTRA_HAS_TASK = "sa_hasTask";

  /** The one on screen, so the service can close it (safety cap, notification Stop). */
  private static AlarmActivity current;

  static void close() {
    if (current != null) current.finishAndRemoveTask();
  }

  /** The service swapped the alarm for its after-stop sound. */
  static void showAfterStop(boolean mustFinish) {
    if (current != null) current.afterStopUi(mustFinish);
  }

  private void afterStopUi(boolean mustFinish) {
    ((TextView) findViewById(R.id.alarm_label)).setText("After-stop sound is playing");
    findViewById(R.id.alarm_snooze).setVisibility(View.GONE);
    Button stop = findViewById(R.id.alarm_stop);
    // "Must play to the end": nothing to press; the screen closes when it ends.
    stop.setVisibility(mustFinish ? View.GONE : View.VISIBLE);
    stop.setText("Stop after-sound");
    stop.setOnClickListener(v -> {
      startService(new Intent(this, AlarmService.class).setAction(AlarmService.ACTION_STOP_AFTER));
      finishAndRemoveTask();
    });
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // A tap that arrives after the ring already ended (a stale notification) has nothing to show.
    if (!AlarmService.isRinging) {
      finishAndRemoveTask();
      return;
    }
    current = this;
    showOverLockScreen();
    setContentView(R.layout.alarm_screen);
    goFullScreen();
    bind(getIntent());
    rise();
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    bind(intent);
  }

  @Override
  protected void onResume() {
    super.onResume();
    AlarmService.quietNotification();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    // The bars come back after the system's "Viewing full screen" hint or a swipe.
    if (hasFocus) goFullScreen();
  }

  @Override
  protected void onDestroy() {
    if (current == this) current = null;
    super.onDestroy();
  }

  @Override
  public void onBackPressed() {
    // An alarm isn't dismissed by Back; Stop or Snooze it.
  }

  private void bind(Intent intent) {
    String kind = intent.getStringExtra(AlarmScheduling.EXTRA_KIND);
    String title = intent.getStringExtra(AlarmScheduling.EXTRA_TITLE);
    boolean pre = "pre-alarm".equals(kind);
    boolean hasTask = intent.getBooleanExtra(EXTRA_HAS_TASK, false);
    if (title == null || title.isEmpty()) title = "Alarm";

    ((TextView) findViewById(R.id.alarm_label)).setText(pre ? "Soon: " + title : title);

    Button stop = findViewById(R.id.alarm_stop);
    Button snooze = findViewById(R.id.alarm_snooze);
    stop.setText(pre ? "Dismiss" : hasTask ? "Stop · solve task" : "Stop");
    stop.setOnClickListener(v -> {
      if (hasTask && !pre) openTask(intent);
      else act(AlarmService.ACTION_STOP, intent);
    });
    snooze.setVisibility(pre ? View.GONE : View.VISIBLE);
    snooze.setOnClickListener(v -> act(AlarmService.ACTION_SNOOZE, intent));
  }

  private void act(String action, Intent src) {
    Intent i = new Intent(this, AlarmService.class);
    i.setAction(action);
    i.putExtras(src);
    startService(i);
    // With an after-stop sound the service keeps this screen up (showAfterStop)
    // and closes it when the sound ends; it also closes it if there's none to play.
    String after = src.getStringExtra(AlarmScheduling.EXTRA_AFTER_SOUND);
    boolean mayPlayAfter = AlarmService.ACTION_STOP.equals(action) && after != null && !after.isEmpty();
    if (!mayPlayAfter) finishAndRemoveTask();
  }

  /** Keep ringing and hand over to the app's task screen. */
  private void openTask(Intent src) {
    Intent i = new Intent(this, MainActivity.class);
    i.setAction("com.sayed.smartalarm.ALARM_task");
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    i.putExtras(src);
    i.putExtra("sa_launchedByAlarm", true);
    i.putExtra("sa_action", "task");
    startActivity(i);
    finishAndRemoveTask();
    overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
  }

  private void showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    } else {
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
          | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    }
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  }

  /** Hide the status and navigation bars; draw under the camera cut-out too. */
  private void goFullScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      getWindow().getAttributes().layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
    }
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat c =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.hide(WindowInsetsCompat.Type.systemBars());
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  }

  /** The sunrise glow climbs over 14s, matching the web ring screen. */
  private void rise() {
    View sun = findViewById(R.id.alarm_sunrise);
    sun.post(() -> {
      sun.setTranslationY(sun.getHeight() * 0.6f);
      sun.setAlpha(0.4f);
      sun.animate().translationY(0).alpha(1f).setDuration(14_000)
          .setInterpolator(new DecelerateInterpolator()).start();
    });
    View content = findViewById(R.id.alarm_content);
    content.setAlpha(0f);
    content.animate().alpha(1f).setDuration(350).start();
  }
}
