# Android app (Capacitor)

The browser PWA can't fire an alarm when it's fully closed. The Android build
can: it's the same web app wrapped with [Capacitor](https://capacitorjs.com/),
with a small native alarm layer.

## What it does

- **Exact scheduling** — `AlarmClock` plugin (`android/app/.../AlarmClockPlugin.java`)
  arms every upcoming main alarm / snooze with `AlarmManager.setAlarmClock()`
  (exact, survives Doze). Persisted in `SharedPreferences` and re-armed on boot
  (`BootReceiver`).
- **Ringing** — when an alarm fires, `AlarmReceiver` starts `AlarmService`, a
  foreground service that:
  - plays `res/raw/alarm.wav` on the **ALARM audio stream** (bypasses the ringer
    and, on its own channel, Do-Not-Disturb), looping, near-max volume
  - vibrates
  - posts a **full-screen-intent** notification that launches the app **over the
    lock screen** (`MainActivity` sets `showWhenLocked` / `turnScreenOn`)
  - auto-stops after a 15-minute safety cap
- **The ring UI is the same web screen** — `MainActivity` forwards the alarm to
  the plugin, which emits `alarmFired`; `nativeAlarmScheduler` calls `beginRing`.
  Stop / Snooze in the web UI (or on the notification) call back into the plugin
  to stop the service; snooze reschedules through the normal web store → sync.
- **Pre-alarms** stay a gentle `@capacitor/local-notifications` heads-up.
- If exact-alarm permission is missing (Android 12–13), scheduling falls back to
  an inexact alarm — Settings shows an **"Allow exact alarms"** button.

## Prerequisites

- Node 18+ · **JDK 17** · Android SDK (easiest via Android Studio). Both are on
  this machine; the first Gradle build auto-installs Build-Tools 34 + Platform 34.

## Build & run

```bash
npm install
npm run android:open      # build web → cap sync → open Android Studio
```

In Android Studio pick a device / emulator (Android 8+), **Run**. First launch
asks for **Notifications**; on Android 12+ also grant **"Alarms & reminders"** if
prompted (or use the Settings button in the app).

Build an APK from the CLI:

```bash
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk  (~5 MB)
```

| script | does |
|---|---|
| `npm run android:sync` | rebuild web + copy into `android/` |
| `npm run android:run`  | sync + build + install on a connected device |
| `npm run gen:sound`    | regenerate `res/raw/alarm.wav` |

## Test the "closed app" case

1. Alarm ~2 minutes out → Save.
2. **Swipe the app away** from recents. Lock the phone. Optionally enable DND.
3. At the time: screen turns on, full-screen alarm over the lock screen, loud
   sound + vibration. Stop / Snooze work from the screen or the notification.

If it doesn't fire: Settings → Apps → Smart Alarm → **Notifications** and
**Alarms & reminders** allowed; battery optimisation **not** "Restricted"
(some OEMs — Xiaomi, Samsung, Oppo — need the app whitelisted / "Autostart" on).

## The web ↔ native seam

| file | role |
|---|---|
| `src/utils/schedule.ts` · `scheduleSet()` | pure — every occurrence to register (both schedulers use it) |
| `src/services/platform.ts` · `isNativeApp` | `Capacitor.isNativePlatform()` |
| `src/services/scheduler.ts` · `scheduler` | native on device, web timer in a browser — same `configure/start/stop/sync/peek` |
| `src/services/nativeAlarmScheduler.ts` | `AlarmClock.schedule` for main/snooze, `LocalNotifications` for pre-alarm; listens for `alarmFired` |
| `src/services/nativeAlarm.ts` | typed `AlarmClock` plugin proxy + `stopNativeAlarm()` |
| `android/app/src/main/java/com/sayed/smartalarm/*.java` | the plugin, scheduler, receiver, service, boot receiver, store |

## Not covered

- iOS (no `@capacitor/ios` yet — the seam is ready for it).
- Custom per-alarm sounds on the *native* ringtone — the closed-app alarm always
  plays the bundled `alarm.wav`; the in-app ring screen still uses the Web Audio
  engine with the alarm's chosen sound once the app is open.
- Not yet run on a physical device by the author — expect one round of
  OEM-specific tweaks (battery/autostart).
