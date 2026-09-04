package com.sayed.smartalarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that runs while an alarm is ringing:
 *  - plays R.raw.alarm on the ALARM stream (bypasses ringer/DND), looping
 *  - vibrates
 *  - posts a full-screen-intent notification that launches MainActivity over
 *    the lock screen
 *  - if the screen is already on (so the OS won't auto-launch the full-screen
 *    intent — that only happens over a locked keyguard), draws its own
 *    full-screen overlay so the alarm isn't just a notification
 *  - auto-stops after a hard safety cap
 * Stopped by MainActivity (via the plugin) when the user hits Stop / Snooze,
 * or by the notification's / overlay's own actions.
 */
public class AlarmService extends Service {

  static final String CHANNEL_ID = "alarm_ringing";
  private static final int NOTIF_ID = 424242;
  private static final long SAFETY_CAP_MS = 15 * 60 * 1000L;

  public static final String ACTION_STOP = "com.sayed.smartalarm.STOP";
  public static final String ACTION_SNOOZE = "com.sayed.smartalarm.SNOOZE";

  private MediaPlayer player;
  private Vibrator vibrator;
  private PowerManager.WakeLock wakeLock;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable safety = this::stopEverything;

  private WindowManager windowManager;
  private View overlayView;
  private Bundle currentExtras;

  /** Set while ringing so the plugin knows there's something to stop. */
  static volatile boolean isRinging = false;
  static volatile String currentAlarmId = null;
  static volatile String currentKind = null;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent != null ? intent.getAction() : null;
    if (ACTION_STOP.equals(action) || ACTION_SNOOZE.equals(action)) {
      // The web layer / notification / overlay asked us to stop.
      removeOverlay();
      handoffToApp(intent, ACTION_SNOOZE.equals(action) ? "snooze" : "stop");
      stopEverything();
      return START_NOT_STICKY;
    }

    String alarmId = intent != null ? intent.getStringExtra(AlarmScheduling.EXTRA_ALARM_ID) : null;
    String kind = intent != null ? intent.getStringExtra(AlarmScheduling.EXTRA_KIND) : "alarm";
    String title = intent != null ? intent.getStringExtra(AlarmScheduling.EXTRA_TITLE) : null;
    if (title == null || title.isEmpty()) title = "Alarm";
    boolean pre = "pre-alarm".equals(kind);

    isRinging = true;
    currentAlarmId = alarmId;
    currentKind = kind;
    currentExtras = intent != null ? intent.getExtras() : null;

    startForegroundWithNotification(title, pre, intent);

    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    wakeLock = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP
            | PowerManager.ON_AFTER_RELEASE,
        "smartalarm:ringing");
    wakeLock.acquire(SAFETY_CAP_MS + 5000);

    startSound(pre);
    if (!pre) startVibration();

    // The OS only auto-launches a full-screen intent over a *locked* keyguard —
    // with the screen already on it just shows as a notification. Pick exactly
    // one way to show the alarm, never both:
    boolean interactive = pm != null && pm.isInteractive();
    if (interactive) {
      // Screen's already on: draw our own overlay. Do NOT also open the app —
      // the overlay is the whole alarm screen; nothing needs the WebView.
      showOverlay(title, pre);
    } else {
      // Screen off / locked: nudge the activity directly in case the full-screen
      // intent doesn't fire on its own; it shows over the lock screen.
      startActivity(activityIntent(intent, "fire"));
    }

    handler.postDelayed(safety, pre ? 3 * 60 * 1000L : SAFETY_CAP_MS);
    return START_STICKY;
  }

  // ---------------------------------------------------------------- sound

  private void startSound(boolean quiet) {
    try {
      AudioManager audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
      if (audio != null && !quiet) {
        int max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM);
        audio.setStreamVolume(AudioManager.STREAM_ALARM, Math.max(1, (int) (max * 0.9)), 0);
      }
      player = new MediaPlayer();
      player.setAudioAttributes(new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build());
      player.setDataSource(this,
          android.net.Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.alarm));
      player.setLooping(true);
      if (quiet) player.setVolume(0.35f, 0.35f);
      player.prepare();
      player.start();
    } catch (Exception e) {
      // sound is best-effort; the vibration + UI still fire
    }
  }

  private void startVibration() {
    vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    if (vibrator == null || !vibrator.hasVibrator()) return;
    long[] pattern = {0, 600, 400, 600, 400, 600, 1200};
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
    } else {
      vibrator.vibrate(pattern, 0);
    }
  }

  // ---------------------------------------------------------------- overlay

  /** True if we're allowed to draw over other apps (Settings → "Show over other apps"). */
  private boolean canDrawOverlay() {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this);
  }

  private void showOverlay(String title, boolean pre) {
    if (overlayView != null || !canDrawOverlay()) return;
    try {
      windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
      View v = LayoutInflater.from(this).inflate(R.layout.alarm_overlay, null);

      ((TextView) v.findViewById(R.id.overlay_label)).setText(pre ? "Soon: " + title : title);
      ((TextView) v.findViewById(R.id.overlay_time)).setText(
          new java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault())
              .format(new java.util.Date()));

      Button stop = v.findViewById(R.id.overlay_stop);
      Button snooze = v.findViewById(R.id.overlay_snooze);
      stop.setText(pre ? "Dismiss" : "Stop");
      stop.setOnClickListener(view -> triggerAction(ACTION_STOP));
      if (pre) {
        snooze.setVisibility(View.GONE);
      } else {
        snooze.setOnClickListener(view -> triggerAction(ACTION_SNOOZE));
      }

      int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
          ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
          : WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
      WindowManager.LayoutParams params = new WindowManager.LayoutParams(
          WindowManager.LayoutParams.MATCH_PARENT,
          WindowManager.LayoutParams.MATCH_PARENT,
          type,
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
              | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
          PixelFormat.TRANSLUCENT);
      params.gravity = Gravity.CENTER;

      windowManager.addView(v, params);
      overlayView = v;
    } catch (Exception e) {
      overlayView = null;
    }
  }

  private void removeOverlay() {
    if (overlayView == null) return;
    try {
      windowManager.removeView(overlayView);
    } catch (Exception ignored) {
      /* already gone */
    }
    overlayView = null;
  }

  private void triggerAction(String action) {
    Intent i = new Intent(this, AlarmService.class);
    i.setAction(action);
    if (currentExtras != null) i.putExtras(currentExtras);
    startService(i);
  }

  // ---------------------------------------------------------------- notification

  private void startForegroundWithNotification(String title, boolean pre, Intent src) {
    createChannel();
    PendingIntent full = PendingIntent.getActivity(this, 1, activityIntent(src, "fire"),
        piFlags());
    PendingIntent stop = PendingIntent.getService(this, 2,
        serviceAction(ACTION_STOP, src), piFlags());
    PendingIntent snooze = PendingIntent.getService(this, 3,
        serviceAction(ACTION_SNOOZE, src), piFlags());

    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_alarm)
        .setContentTitle(pre ? "Soon: " + title : title)
        .setContentText(pre ? "Your alarm is coming up" : "Alarm")
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setOngoing(true)
        .setAutoCancel(false)
        .setContentIntent(full)
        .setFullScreenIntent(full, true);

    if (!pre) {
      b.addAction(0, "Stop", stop).addAction(0, "Snooze", snooze);
    } else {
      b.addAction(0, "Dismiss", stop);
    }

    Notification n = b.build();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIF_ID, n);
    }
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
    NotificationChannel ch = new NotificationChannel(
        CHANNEL_ID, "Ringing alarm", NotificationManager.IMPORTANCE_HIGH);
    ch.setDescription("Shown while an alarm is going off");
    ch.setSound(null, null); // the service owns the sound
    ch.enableVibration(false);
    ch.setBypassDnd(true);
    ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(ch);
  }

  // ---------------------------------------------------------------- intents

  private Intent activityIntent(Intent src, String reason) {
    Intent i = new Intent(this, MainActivity.class);
    i.setAction("com.sayed.smartalarm.ALARM_" + reason);
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP
        | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
    if (src != null) i.putExtras(src);
    i.putExtra("sa_launchedByAlarm", true);
    return i;
  }

  private Intent serviceAction(String action, Intent src) {
    Intent i = new Intent(this, AlarmService.class);
    i.setAction(action);
    if (src != null) i.putExtras(src);
    return i;
  }

  private int piFlags() {
    int f = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) f |= PendingIntent.FLAG_IMMUTABLE;
    return f;
  }

  private void handoffToApp(Intent src, String action) {
    Intent i = activityIntent(src, action);
    i.putExtra("sa_action", action);
    try {
      startActivity(i);
    } catch (Exception ignored) {}
  }

  // ---------------------------------------------------------------- lifecycle

  /** Called from the plugin when the user stops/snoozes inside the web UI. */
  static void stop(Context ctx) {
    if (!isRinging) return;
    Intent i = new Intent(ctx, AlarmService.class);
    i.setAction(ACTION_STOP);
    ctx.startService(i);
  }

  private void stopEverything() {
    handler.removeCallbacks(safety);
    isRinging = false;
    currentAlarmId = null;
    currentKind = null;
    currentExtras = null;
    removeOverlay();
    if (player != null) {
      try { player.stop(); } catch (Exception ignored) {}
      player.release();
      player = null;
    }
    if (vibrator != null) {
      vibrator.cancel();
      vibrator = null;
    }
    if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE);
    } else {
      stopForeground(true);
    }
    stopSelf();
  }

  @Override
  public void onDestroy() {
    stopEverything();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
