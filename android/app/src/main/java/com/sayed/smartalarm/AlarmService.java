package com.sayed.smartalarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

/**
 * Foreground service that runs while an alarm is ringing:
 *  - plays R.raw.alarm on the ALARM stream (bypasses ringer/DND), looping
 *  - vibrates
 *  - opens AlarmActivity, the native full-screen ringing screen, and posts a
 *    full-screen-intent notification pointing at it
 *  - auto-stops after a hard safety cap
 * Stopped by AlarmActivity's or the notification's Stop / Snooze, or by the
 * web app (via the plugin) once a wake-up task is solved.
 */
public class AlarmService extends Service {

  static final String CHANNEL_ID = "alarm_ringing";
  /** Same notification once the alarm screen is up: in the shade, no heads-up over it. */
  private static final String QUIET_CHANNEL_ID = "alarm_ringing_quiet";
  private static final int NOTIF_ID = 424242;
  private static final long SAFETY_CAP_MS = 15 * 60 * 1000L;

  public static final String ACTION_STOP = "com.sayed.smartalarm.STOP";
  public static final String ACTION_SNOOZE = "com.sayed.smartalarm.SNOOZE";
  /** Ends the after-stop sound early (only offered when it's "stoppable"). */
  public static final String ACTION_STOP_AFTER = "com.sayed.smartalarm.STOP_AFTER";
  /** Same cap as the web ring screen's AFTER_SOUND_MAX_MS. */
  private static final long AFTER_SOUND_CAP_MS = 3 * 60 * 1000L;
  /** Set when the running web UI asked us to stop, so we don't queue it twice. */
  private static final String EXTRA_FROM_APP = "sa_fromApp";

  private MediaPlayer player;
  private Vibrator vibrator;
  private PowerManager.WakeLock wakeLock;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable safety = this::stopEverything;


  /** Set while ringing so the plugin knows there's something to stop. */
  static volatile boolean isRinging = false;
  static volatile String currentAlarmId = null;
  static volatile String currentKind = null;

  private static AlarmService instance;
  private String notifTitle;
  private boolean notifPre;
  private Intent notifSrc;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent != null ? intent.getAction() : null;
    if (ACTION_STOP_AFTER.equals(action)) {
      stopEverything();
      return START_NOT_STICKY;
    }
    if (ACTION_STOP.equals(action) || ACTION_SNOOZE.equals(action)) {
      boolean snooze = ACTION_SNOOZE.equals(action);
      // When the request came from the web UI the app is already running and
      // has updated its own state — recording it again would double the
      // history entry.
      boolean fromApp = intent != null && intent.getBooleanExtra(EXTRA_FROM_APP, false);
      if (!fromApp) {
        // Queue it for whenever the app is next opened, and re-arm a snooze
        // ourselves. We deliberately do NOT start MainActivity: bringing the
        // app to the foreground purely to hand over a string is what made it
        // flash open the moment you pressed Stop.
        AlarmStore.Entry p = pendingAction(intent, snooze ? "snooze" : "stop");
        // Record the time we actually armed, so the app doesn't recompute the
        // snooze from whenever it happens to open and push it further out.
        if (snooze) p.snoozeUntil = scheduleSnooze(intent);
        AlarmStore.addPending(this, p);
      }
      // A web-UI stop (wake-up task) plays its own after-stop sound.
      if (!snooze && !fromApp && startAfterSound(intent)) return START_NOT_STICKY;
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

    startForegroundWithNotification(title, pre, intent);

    PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
    wakeLock = pm.newWakeLock(
        PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP
            | PowerManager.ON_AFTER_RELEASE,
        "smartalarm:ringing");
    wakeLock.acquire(SAFETY_CAP_MS + 5000);

    startSound(pre);
    if (!pre) startVibration();

    // One screen, locked or unlocked. Over a locked keyguard the full-screen
    // intent would launch it anyway; with the phone in use only this direct
    // start does, which Android allows because the app may "Appear on top".
    startActivity(alarmScreenIntent(intent));

    handler.postDelayed(safety, pre ? 3 * 60 * 1000L : SAFETY_CAP_MS);
    return START_STICKY;
  }

  // ---------------------------------------------------------------- after-stop sound

  /**
   * Swap the alarm for its after-stop sound: same foreground service and wake
   * lock, the alarm screen switches to "after-stop sound is playing". Returns
   * false when there's nothing to play, so the caller just stops.
   */
  private boolean startAfterSound(Intent src) {
    if (src == null || "pre-alarm".equals(src.getStringExtra(AlarmScheduling.EXTRA_KIND))) return false;
    String key = src.getStringExtra(AlarmScheduling.EXTRA_AFTER_SOUND);
    if (key == null || key.isEmpty()) return false;
    java.io.File f = AlarmClockPlugin.afterSoundFile(this, key);
    if (!f.exists()) return false;
    float volume = src.getIntExtra(AlarmScheduling.EXTRA_AFTER_VOLUME, 60) / 100f;
    boolean mustFinish = src.getBooleanExtra(AlarmScheduling.EXTRA_AFTER_MUST_FINISH, false);

    stopRingingSound();
    MediaPlayer p = new MediaPlayer();
    try {
      p.setAudioAttributes(new AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build());
      p.setDataSource(f.getPath());
      p.setVolume(volume, volume);
      p.setOnCompletionListener(mp -> stopEverything());
      p.prepare();
      p.start();
    } catch (Exception e) {
      p.release();
      return false;
    }
    player = p;
    // The alarm itself is over; only the after-sound is left.
    isRinging = false;
    handler.removeCallbacks(safety);
    handler.postDelayed(safety, AFTER_SOUND_CAP_MS);

    NotificationCompat.Builder b = new NotificationCompat.Builder(this, QUIET_CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_alarm)
        .setContentTitle(notifTitle != null ? notifTitle : "Alarm")
        .setContentText("After-stop sound is playing")
        .setOngoing(true);
    if (!mustFinish) {
      b.addAction(0, "Stop", PendingIntent.getService(this, 4,
          new Intent(this, AlarmService.class).setAction(ACTION_STOP_AFTER), piFlags()));
    }
    ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(NOTIF_ID, b.build());

    AlarmActivity.showAfterStop(mustFinish);
    return true;
  }

  private void stopRingingSound() {
    if (player != null) {
      try { player.stop(); } catch (Exception ignored) {}
      player.release();
      player = null;
    }
    if (vibrator != null) {
      vibrator.cancel();
      vibrator = null;
    }
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

  // ---------------------------------------------------------------- notification

  /** Called by AlarmActivity once it's on screen. */
  static void quietNotification() {
    AlarmService s = instance;
    if (s == null || !isRinging) return;
    NotificationManager nm = (NotificationManager) s.getSystemService(Context.NOTIFICATION_SERVICE);
    nm.notify(NOTIF_ID, s.buildNotification(true));
  }

  private void startForegroundWithNotification(String title, boolean pre, Intent src) {
    instance = this;
    notifTitle = title;
    notifPre = pre;
    notifSrc = src;
    Notification n = buildNotification(false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIF_ID, n);
    }
  }

  private Notification buildNotification(boolean quiet) {
    String title = notifTitle;
    boolean pre = notifPre;
    Intent src = notifSrc;
    createChannels();
    PendingIntent full = PendingIntent.getActivity(this, 1, alarmScreenIntent(src),
        piFlags());
    PendingIntent stop = PendingIntent.getService(this, 2,
        serviceAction(ACTION_STOP, src), piFlags());
    PendingIntent snooze = PendingIntent.getService(this, 3,
        serviceAction(ACTION_SNOOZE, src), piFlags());

    NotificationCompat.Builder b = new NotificationCompat.Builder(this, quiet ? QUIET_CHANNEL_ID : CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_stat_alarm)
        .setContentTitle(pre ? "Soon: " + title : title)
        .setContentText(pre ? "Your alarm is coming up" : "Alarm")
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setOngoing(true)
        .setAutoCancel(false)
        .setOnlyAlertOnce(true)
        .setContentIntent(full);
    if (!quiet) b.setFullScreenIntent(full, true);

    if (!pre) {
      b.addAction(0, "Stop", stop).addAction(0, "Snooze", snooze);
    } else {
      b.addAction(0, "Dismiss", stop);
    }

    return b.build();
  }

  private void createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm.getNotificationChannel(QUIET_CHANNEL_ID) == null) {
      NotificationChannel q = new NotificationChannel(
          QUIET_CHANNEL_ID, "Ringing alarm (screen open)", NotificationManager.IMPORTANCE_LOW);
      q.setSound(null, null);
      q.enableVibration(false);
      q.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
      nm.createNotificationChannel(q);
    }
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

  private Intent alarmScreenIntent(Intent src) {
    Intent i = new Intent(this, AlarmActivity.class);
    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
    if (src != null) i.putExtras(src);
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

  /** Snapshot of the occurrence the user just acted on, for the web layer. */
  private AlarmStore.Entry pendingAction(Intent src, String action) {
    AlarmStore.Entry e = new AlarmStore.Entry();
    e.action = action;
    e.alarmId = src != null ? src.getStringExtra(AlarmScheduling.EXTRA_ALARM_ID) : null;
    e.kind = src != null ? src.getStringExtra(AlarmScheduling.EXTRA_KIND) : "alarm";
    e.title = src != null ? src.getStringExtra(AlarmScheduling.EXTRA_TITLE) : null;
    e.firedKey = src != null ? src.getStringExtra(AlarmScheduling.EXTRA_FIRED_KEY) : null;
    e.at = src != null ? src.getLongExtra(AlarmScheduling.EXTRA_AT, System.currentTimeMillis())
                       : System.currentTimeMillis();
    e.snoozeMinutes = src != null ? src.getIntExtra(AlarmScheduling.EXTRA_SNOOZE_MIN, 0) : 0;
    return e;
  }

  /**
   * Re-arm a snoozed alarm here rather than relying on the web layer, which
   * may not run again for hours. When the app does next open it recomputes the
   * schedule from its own state and replaces this with an equivalent alarm.
   */
  private long scheduleSnooze(Intent src) {
    if (src == null) return 0L;
    String alarmId = src.getStringExtra(AlarmScheduling.EXTRA_ALARM_ID);
    if (alarmId == null || alarmId.isEmpty()) return 0L;

    int mins = src.getIntExtra(AlarmScheduling.EXTRA_SNOOZE_MIN, 0);
    if (mins <= 0) mins = 5; // matches the app's default when we weren't told

    AlarmStore.Entry e = new AlarmStore.Entry();
    e.at = System.currentTimeMillis() + mins * 60_000L;
    e.alarmId = alarmId;
    e.kind = "snooze";
    e.title = orDefault(src.getStringExtra(AlarmScheduling.EXTRA_TITLE), "Alarm");
    e.snoozeMinutes = mins;
    e.hasTask = src.getBooleanExtra(AlarmActivity.EXTRA_HAS_TASK, false);
    e.afterSound = src.getStringExtra(AlarmScheduling.EXTRA_AFTER_SOUND);
    e.afterVolume = src.getIntExtra(AlarmScheduling.EXTRA_AFTER_VOLUME, 60);
    e.afterMustFinish = src.getBooleanExtra(AlarmScheduling.EXTRA_AFTER_MUST_FINISH, false);
    e.firedKey = alarmId + ":snooze:" + AlarmScheduling.minuteKey(e.at);
    e.id = AlarmScheduling.numericId(e.firedKey);
    AlarmScheduling.set(this, e);
    return e.at;
  }

  private static String orDefault(String v, String d) {
    return v == null || v.isEmpty() ? d : v;
  }

  // ---------------------------------------------------------------- lifecycle

  /** Called from the plugin when the user stops/snoozes inside the web UI. */
  static void stop(Context ctx) {
    if (!isRinging) return;
    Intent i = new Intent(ctx, AlarmService.class);
    i.setAction(ACTION_STOP);
    i.putExtra(EXTRA_FROM_APP, true);
    ctx.startService(i);
  }

  private void stopEverything() {
    handler.removeCallbacks(safety);
    isRinging = false;
    currentAlarmId = null;
    currentKind = null;
    AlarmActivity.close();
    instance = null;
    stopRingingSound();
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
