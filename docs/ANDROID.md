# Turning Smart Alarm into an Android app

The web app cannot guarantee alarms when the browser is killed. Wrapping it with
[Capacitor](https://capacitorjs.com/) and delegating **scheduling** and
**notifications** to native APIs fixes that. The UI, store and all other
services stay exactly as they are.

## What already isolates the browser‑specific parts

| Service | Browser today | Native replacement |
|---|---|---|
| `AlarmScheduler` | one capped `setTimeout` + heartbeat | `@capacitor/local-notifications` schedule, or a small plugin over `AlarmManager` (`setExactAndAllowWhileIdle`) + a foreground service |
| `NotificationService` | Web Notifications via SW registration | native channels (Alarm importance, bypass DND for "Important") |
| `AudioService` | Web Audio | keep as‑is inside the WebView, **or** a native looping player + `AudioAttributes.USAGE_ALARM` |
| `VibrationService` | Vibration API | `@capacitor/haptics` or `Vibrator` with `AudioAttributes.USAGE_ALARM` |
| `StorageService` | IndexedDB / localStorage | keep as‑is (WebView storage is durable in a packaged app) or `@capacitor/preferences` + Filesystem |

No component imports `window.setTimeout` for alarms or `Notification` directly —
they all go through the services above, so only those files change.

## Step by step

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/local-notifications @capacitor/haptics
npx cap init "Smart Alarm" com.example.smartalarm --web-dir=dist
npm run build
npx cap add android
npx cap sync
```

### `capacitor.config.ts` (sample)

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.smartalarm',
  appName: 'Smart Alarm',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_alarm',
      iconColor: '#3b82f6',
    },
  },
};

export default config;
```

### Native scheduler adapter (sketch)

Create `src/services/alarmScheduler.native.ts` implementing the same shape as
`AlarmScheduler` and select it at build time:

```ts
import { LocalNotifications } from '@capacitor/local-notifications';
import { nextEvent } from '@/utils/schedule';

export class NativeAlarmScheduler {
  configure(getState, onDue) { this.getState = getState; this.onDue = onDue; }

  async sync() {
    const { alarms, settings, activeAlarmIds } = this.getState();
    await LocalNotifications.cancel({ notifications: await pending() });

    // Schedule the next occurrence of every active alarm as an exact alarm.
    const toSchedule = alarms
      .filter(a => a.enabled && (!activeAlarmIds || activeAlarmIds.includes(a.id)))
      .map(a => {
        const ev = nextEvent([a], settings, activeAlarmIds, Date.now());
        return ev && {
          id: hash(a.id),
          title: a.label || 'Alarm',
          schedule: { at: new Date(ev.at), allowWhileIdle: true },
          channelId: a.importance === 'important' ? 'alarm_important' : 'alarm',
          extra: { alarmId: a.id, kind: ev.kind },
        };
      })
      .filter(Boolean);

    await LocalNotifications.schedule({ notifications: toSchedule });
  }

  start() {
    LocalNotifications.addListener('localNotificationActionPerformed', e => {
      const { alarmId, kind } = e.notification.extra;
      this.onDue({ alarmId, kind, at: Date.now(), firedKey: `${alarmId}:${kind}` });
    });
    this.sync();
  }

  stop() { /* remove listeners */ }
  peek(now = Date.now()) {
    const s = this.getState();
    return nextEvent(s.alarms, s.settings, s.activeAlarmIds, now);
  }
}
```

Because `utils/schedule.ts` is pure and already unit‑tested, the "when should
this alarm ring" logic is shared between the web and native schedulers.

### Android manifest additions

```xml
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```

Create notification channels with `IMPORTANCE_HIGH`, set the "Important" channel
to `setBypassDnd(true)`, and re‑schedule on `BOOT_COMPLETED`.

### Camera (QR task)

The web build already gates the camera behind an explicit "Open camera" button.
For native, add `@capacitor/camera` or `@capacitor-community/barcode-scanner`
and swap only the `QrTask` component's `start()` implementation.

## What does NOT change

- Every page and component.
- The Zustand store and all reducers/actions.
- `utils/*`, `data/*`, `i18n/*`, `hooks/*`.
- `AudioService` (Web Audio works inside the WebView).
- The test suite.
