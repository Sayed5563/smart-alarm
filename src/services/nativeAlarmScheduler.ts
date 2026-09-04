import { App } from '@capacitor/app';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { scheduleSet } from '@/utils/schedule';
import { minuteKey } from '@/utils/time';
import { AlarmClock, type AlarmFiredEvent } from './nativeAlarm';
import type { DueEvent, SchedulerLike, SchedulerState } from './alarmScheduler';

/**
 * Native scheduler.
 *
 * - Main alarms + snoozes → the app-local `AlarmClock` plugin: exact
 *   `AlarmManager.setAlarmClock()` + a foreground service that plays on the
 *   ALARM stream, vibrates, and shows a full-screen alarm over the lock screen —
 *   works with the app fully closed and the device idle.
 * - Pre-alarms → a gentle `@capacitor/local-notifications` heads-up.
 *
 * Same `configure / start / stop / sync / peek` contract as the web scheduler.
 */
const PRE_CHANNEL_ID = 'pre-alarm';

function numericId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

class NativeAlarmScheduler implements SchedulerLike {
  private getState: (() => SchedulerState) | null = null;
  private onDue: ((e: DueEvent) => void) | null = null;
  private started = false;
  private syncTimer = 0;
  private lastKeys = new Set<string>();
  private handled = new Set<string>();

  configure(getState: () => SchedulerState, onDue: (e: DueEvent) => void): void {
    this.getState = getState;
    this.onDue = onDue;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      await LocalNotifications.requestPermissions();
      await LocalNotifications.createChannel({
        id: PRE_CHANNEL_ID,
        name: 'Pre-alarm',
        description: 'A softer heads-up before the main alarm',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    } catch {
      /* best effort */
    }

    void AlarmClock.addListener('alarmFired', (e: AlarmFiredEvent) => this.fired(e));
    LocalNotifications.addListener('localNotificationReceived', (n) => this.fired(fromNotif(n)));
    LocalNotifications.addListener('localNotificationActionPerformed', (e) =>
      this.fired(fromNotif(e.notification)),
    );

    App.addListener('resume', () => this.sync());

    void this.warnIfInexact();
    this.sync();
  }

  stop(): void {
    this.started = false;
    void LocalNotifications.removeAllListeners();
    void App.removeAllListeners();
  }

  sync(): void {
    window.clearTimeout(this.syncTimer);
    this.syncTimer = window.setTimeout(() => void this.reschedule(), 400);
  }

  peek(now = Date.now()): DueEvent | null {
    if (!this.getState) return null;
    const s = this.getState();
    const [first] = scheduleSet(s.alarms, s.settings, s.activeAlarmIds, now);
    return first
      ? { ...first, firedKey: `${first.alarmId}:${first.kind}:${minuteKey(first.at)}` }
      : null;
  }

  async requestExactAlarmPermission(): Promise<void> {
    try {
      await AlarmClock.openExactAlarmSettings();
    } catch {
      /* not supported */
    }
  }

  // ---------------------------------------------------------------- internals

  private fired(e: AlarmFiredEvent | null): void {
    if (!e || !e.alarmId) return;
    const key = `${e.firedKey}:${e.action ?? 'ring'}`;
    if (this.handled.has(key)) return;
    this.handled.add(key);
    if (this.handled.size > 100) this.handled.clear();

    this.onDue?.({
      alarmId: e.alarmId,
      kind: e.kind,
      at: e.at,
      firedKey: e.firedKey || `${e.alarmId}:${e.kind}:${minuteKey(e.at)}`,
      action: e.action,
    });
  }

  private async warnIfInexact(): Promise<void> {
    try {
      const { granted } = await AlarmClock.canScheduleExactAlarms();
      if (!granted) {
        // App surfaces a "Allow exact alarms" nudge; here we just note it.
        (window as unknown as { __saExactAlarm?: boolean }).__saExactAlarm = false;
      }
    } catch {
      /* not native / plugin missing */
    }
  }

  private async reschedule(): Promise<void> {
    if (!this.getState) return;
    const { alarms, settings, activeAlarmIds } = this.getState();
    const events = scheduleSet(alarms, settings, activeAlarmIds, Date.now());

    const keys = new Set(events.map((e) => `${e.alarmId}:${e.kind}:${minuteKey(e.at)}`));
    if (setsEqual(keys, this.lastKeys)) return;
    this.lastKeys = keys;

    const label = (id: string) => alarms.find((a) => a.id === id)?.label || 'Alarm';

    // ---- main alarms + snoozes → the native alarm plugin
    const main = events.filter((e) => e.kind !== 'pre-alarm');
    try {
      await AlarmClock.cancelAll();
      for (const e of main) {
        const key = `${e.alarmId}:${e.kind}:${minuteKey(e.at)}`;
        await AlarmClock.schedule({
          id: numericId(key),
          at: e.at,
          title: label(e.alarmId),
          kind: e.kind,
          alarmId: e.alarmId,
          firedKey: key,
        });
      }
    } catch {
      // Plugin unavailable — fall back to notification-only for main alarms too.
      await this.fallbackSchedule(main, label);
    }

    // ---- pre-alarms → local notification
    const pre = events.filter((e) => e.kind === 'pre-alarm');
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
      if (pre.length) {
        await LocalNotifications.schedule({
          notifications: pre.map<LocalNotificationSchema>((e) => {
            const key = `${e.alarmId}:${e.kind}:${minuteKey(e.at)}`;
            return {
              id: numericId(key),
              title: `Soon: ${label(e.alarmId)}`,
              body: 'Your alarm is coming up',
              schedule: { at: new Date(e.at), allowWhileIdle: true },
              channelId: PRE_CHANNEL_ID,
              smallIcon: 'ic_stat_alarm',
              extra: { alarmId: e.alarmId, kind: 'pre-alarm', at: e.at, firedKey: key },
            };
          }),
        });
      }
    } catch {
      /* best effort */
    }
  }

  private async fallbackSchedule(
    events: { alarmId: string; kind: string; at: number }[],
    label: (id: string) => string,
  ): Promise<void> {
    try {
      await LocalNotifications.schedule({
        notifications: events.map<LocalNotificationSchema>((e) => {
          const key = `${e.alarmId}:${e.kind}:${minuteKey(e.at)}`;
          return {
            id: numericId(key),
            title: label(e.alarmId),
            body: 'Tap to open Smart Alarm',
            schedule: { at: new Date(e.at), allowWhileIdle: true },
            channelId: PRE_CHANNEL_ID,
            smallIcon: 'ic_stat_alarm',
            extra: { alarmId: e.alarmId, kind: e.kind, at: e.at, firedKey: key },
          };
        }),
      });
    } catch {
      /* best effort */
    }
  }
}

function fromNotif(n: {
  extra?: Record<string, unknown> | null;
}): AlarmFiredEvent | null {
  const x = (n.extra ?? {}) as Partial<AlarmFiredEvent>;
  if (!x.alarmId || !x.kind) return null;
  return {
    alarmId: x.alarmId,
    kind: x.kind,
    at: x.at ?? Date.now(),
    firedKey: x.firedKey ?? '',
  };
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export const nativeAlarmScheduler = new NativeAlarmScheduler();
