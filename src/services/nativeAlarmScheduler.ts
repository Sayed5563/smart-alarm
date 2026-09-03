import { App } from '@capacitor/app';
import {
  LocalNotifications,
  type ActionPerformed,
  type LocalNotificationSchema,
} from '@capacitor/local-notifications';
import { scheduleSet } from '@/utils/schedule';
import { minuteKey } from '@/utils/time';
import type { DueEvent, SchedulerLike, SchedulerState } from './alarmScheduler';

/**
 * Native scheduler — hands every upcoming alarm occurrence to Android's
 * `AlarmManager` via `@capacitor/local-notifications` (`allowWhileIdle`), so an
 * alarm fires as an OS notification even when the app is fully closed. When the
 * user taps it the app opens and the shared ring screen takes over.
 *
 * Same `configure / start / stop / sync / peek` contract as the web
 * `AlarmScheduler`, so `App` doesn't know which one it's using.
 */
const CHANNEL_ID = 'alarm';
const ACTION_TYPE = 'ALARM_ACTIONS';

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
  private handledActions = new Set<number>();

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
        id: CHANNEL_ID,
        name: 'Alarms',
        description: 'Alarm and pre-alarm notifications',
        importance: 5,
        visibility: 1,
        sound: 'alarm.wav',
        vibration: true,
        lights: true,
      });
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: ACTION_TYPE,
            actions: [
              { id: 'stop', title: 'Stop', destructive: true },
              { id: 'snooze', title: 'Snooze' },
            ],
          },
        ],
      });
    } catch {
      /* permission / channel setup best-effort */
    }

    LocalNotifications.addListener('localNotificationReceived', (n) => {
      // Fired while the app is in the foreground — surface the ring screen and
      // clear the OS notification so there aren't two alarms going.
      this.dispatch(n);
      void LocalNotifications.removeDeliveredNotifications({
        notifications: [{ id: n.id } as LocalNotificationSchema],
      });
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (e: ActionPerformed) => {
      if (this.handledActions.has(e.notification.id)) return;
      this.handledActions.add(e.notification.id);
      this.dispatch(e.notification, e.actionId);
    });

    App.addListener('resume', () => this.sync());
    App.addListener('appStateChange', (s) => {
      if (s.isActive) this.sync();
    });

    this.sync();
  }

  stop(): void {
    this.started = false;
    void LocalNotifications.removeAllListeners();
    void App.removeAllListeners();
  }

  /** Debounced — the store fires this on every change. */
  sync(): void {
    window.clearTimeout(this.syncTimer);
    this.syncTimer = window.setTimeout(() => void this.reschedule(), 400);
  }

  peek(now = Date.now()): DueEvent | null {
    if (!this.getState) return null;
    const s = this.getState();
    const [first] = scheduleSet(s.alarms, s.settings, s.activeAlarmIds, now);
    return first ? { ...first, firedKey: `${first.alarmId}:${first.kind}:${minuteKey(first.at)}` } : null;
  }

  // ---------------------------------------------------------------- internals

  private dispatch(
    n: { id: number; extra?: Record<string, unknown> | null },
    actionId?: string,
  ): void {
    const extra = (n.extra ?? {}) as { alarmId?: string; kind?: DueEvent['kind']; at?: number };
    if (!extra.alarmId || !extra.kind) return;
    const at = extra.at ?? Date.now();
    this.onDue?.({
      alarmId: extra.alarmId,
      kind: extra.kind,
      at,
      firedKey: `${extra.alarmId}:${extra.kind}:${minuteKey(at)}`,
      // The App handler reads this to decide snooze-vs-open when it came from a
      // notification action button rather than a plain tap.
      action: actionId && actionId !== 'tap' ? actionId : undefined,
    });
  }

  private async reschedule(): Promise<void> {
    if (!this.getState) return;
    const { alarms, settings, activeAlarmIds } = this.getState();
    const events = scheduleSet(alarms, settings, activeAlarmIds, Date.now());

    const want = new Map<number, LocalNotificationSchema>();
    const keys = new Set<string>();
    for (const ev of events) {
      const key = `${ev.alarmId}:${ev.kind}:${minuteKey(ev.at)}`;
      keys.add(key);
      const alarm = alarms.find((a) => a.id === ev.alarmId);
      if (!alarm) continue;
      const label = alarm.label || 'Alarm';
      want.set(numericId(key), {
        id: numericId(key),
        title: ev.kind === 'pre-alarm' ? `Soon: ${label}` : label,
        body:
          ev.kind === 'pre-alarm'
            ? 'Pre-alarm — your alarm is coming up'
            : 'Tap to open Smart Alarm',
        schedule: { at: new Date(ev.at), allowWhileIdle: true },
        channelId: CHANNEL_ID,
        actionTypeId: ACTION_TYPE,
        smallIcon: 'ic_stat_alarm',
        ongoing: false,
        autoCancel: true,
        extra: { alarmId: ev.alarmId, kind: ev.kind, at: ev.at, firedKey: key },
      });
    }

    // Only touch the OS if the set actually changed.
    if (setsEqual(keys, this.lastKeys)) return;
    this.lastKeys = keys;

    try {
      const pending = await LocalNotifications.getPending();
      const ourPending = pending.notifications.filter((n) => !want.has(n.id));
      if (ourPending.length) {
        await LocalNotifications.cancel({ notifications: ourPending.map((n) => ({ id: n.id })) });
      }
      const toSchedule = [...want.values()];
      if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule });
    } catch {
      /* scheduling best-effort */
    }
  }
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export const nativeAlarmScheduler = new NativeAlarmScheduler();
