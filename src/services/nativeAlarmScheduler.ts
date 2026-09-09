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

/** How long a fired occurrence stays de-duped. Comfortably longer than the
 *  service's 15-minute ring cap, so a retained event can't be replayed twice. */
const HANDLED_TTL_MS = 20 * 60_000;

type PlannedEvent = { alarmId: string; kind: string; at: number };

function numericId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

function keyOf(e: PlannedEvent): string {
  return `${e.alarmId}:${e.kind}:${minuteKey(e.at)}`;
}

class NativeAlarmScheduler implements SchedulerLike {
  private getState: (() => SchedulerState) | null = null;
  private onDue: ((e: DueEvent) => void) | null = null;
  private started = false;
  private syncTimer = 0;
  private lastKeys = new Set<string>();
  /** firedKey:action → when we handled it. Pruned by age, never wholesale. */
  private handled = new Map<string, number>();
  private listeners: { remove: () => Promise<void> }[] = [];

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

    // Keep every handle. Without them `stop()` can't detach, and a second
    // start() (a remount, a re-configure) stacks a duplicate alarmFired
    // listener on top of the first one.
    try {
      this.listeners.push(
        await AlarmClock.addListener('alarmFired', (e: AlarmFiredEvent) => this.fired(e)),
        await LocalNotifications.addListener('localNotificationReceived', (n) =>
          this.fired(fromNotif(n)),
        ),
        await LocalNotifications.addListener('localNotificationActionPerformed', (e) =>
          this.fired(fromNotif(e.notification)),
        ),
        await App.addListener('resume', () => {
          void this.drainPending();
          this.sync();
        }),
      );
    } catch {
      /* a missing listener must not stop the scheduler from arming alarms */
    }

    void this.warnIfInexact();
    void this.drainPending();
    this.sync();
  }

  /**
   * Collect the Stop/Snooze actions the user took while the web layer wasn't
   * running. The service records them rather than launching the app to hand
   * them over — that launch is what made the app flash open after Stop — so
   * this is where history and the once-alarm bookkeeping catch up.
   */
  private async drainPending(): Promise<void> {
    try {
      const { actions } = await AlarmClock.consumePendingActions();
      for (const a of actions) this.fired(a);
    } catch {
      /* not native / plugin missing */
    }
  }

  stop(): void {
    this.started = false;
    window.clearTimeout(this.syncTimer);
    for (const l of this.listeners) void l.remove();
    this.listeners = [];
  }

  sync(): void {
    window.clearTimeout(this.syncTimer);
    this.syncTimer = window.setTimeout(() => void this.reschedule(), 400);
  }

  peek(now = Date.now()): DueEvent | null {
    if (!this.getState) return null;
    const s = this.getState();
    const [first] = scheduleSet(s.alarms, s.settings, s.activeAlarmIds, now);
    return first ? { ...first, firedKey: keyOf(first) } : null;
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
    const now = Date.now();

    // Prune by age. Clearing the whole set on a size cap (as we used to) could
    // drop the key of an alarm that had *just* fired, so a redelivered event
    // would ring it a second time.
    for (const [k, t] of this.handled) {
      if (now - t > HANDLED_TTL_MS) this.handled.delete(k);
    }
    if (this.handled.has(key)) return;
    this.handled.set(key, now);

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

    const keys = new Set(events.map(keyOf));
    if (setsEqual(keys, this.lastKeys)) return;

    const label = (id: string) => alarms.find((a) => a.id === id)?.label || 'Alarm';
    const snoozeMins = (id: string) => alarms.find((a) => a.id === id)?.snoozeMinutes ?? 5;
    const main = events.filter((e) => e.kind !== 'pre-alarm');
    const pre = events.filter((e) => e.kind === 'pre-alarm');

    // ---- main alarms + snoozes → the native alarm plugin
    let nativeOk = true;
    try {
      await AlarmClock.cancelAll();
      for (const e of main) {
        const key = keyOf(e);
        await AlarmClock.schedule({
          id: numericId(key),
          at: e.at,
          title: label(e.alarmId),
          kind: e.kind,
          alarmId: e.alarmId,
          firedKey: key,
          snoozeMinutes: snoozeMins(e.alarmId),
        });
      }
    } catch {
      nativeOk = false;
    }

    // ---- notifications, in one pass: clear what's pending, then post the
    // pre-alarms plus — only when the native path failed — a notification-only
    // stand-in for the main alarms. Cancelling *after* writing those fallbacks
    // (which is what the old order did) deleted the very notifications it had
    // just scheduled, so a failed native schedule left no alarm at all.
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
      const notifications = [
        ...pre.map((e) => this.notification(e, `Soon: ${label(e.alarmId)}`, 'Your alarm is coming up')),
        ...(nativeOk ? [] : main.map((e) => this.notification(e, label(e.alarmId), 'Alarm'))),
      ];
      if (notifications.length) await LocalNotifications.schedule({ notifications });
    } catch {
      /* best effort */
    }

    // Only remember a set we actually armed. Recording it up front meant a
    // failed schedule was never retried — the next sync saw "nothing changed"
    // and returned early, so that alarm silently never existed.
    this.lastKeys = nativeOk ? keys : new Set();
  }

  private notification(e: PlannedEvent, title: string, body: string): LocalNotificationSchema {
    const key = keyOf(e);
    return {
      id: numericId(key),
      title,
      body,
      schedule: { at: new Date(e.at), allowWhileIdle: true },
      channelId: PRE_CHANNEL_ID,
      smallIcon: 'ic_stat_alarm',
      extra: { alarmId: e.alarmId, kind: e.kind, at: e.at, firedKey: key },
    };
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
