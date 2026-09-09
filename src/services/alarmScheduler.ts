import type { Alarm, AppSettings } from '@/types';
import { nextEvent, upcomingEvents, type ScheduledEvent } from '@/utils/schedule';
import { minuteKey } from '@/utils/time';

/** How far back a due occurrence is still considered fireable. Covers late
 *  timers, the 20s heartbeat gap, and short background throttling. */
const GRACE_MS = 75_000;

/** How long a fired occurrence stays de-duped. Must comfortably exceed
 *  GRACE_MS, or an occurrence still inside the look-back window could be
 *  fired a second time after its key was forgotten. */
const FIRED_TTL_MS = 10 * 60_000;

export interface SchedulerState {
  alarms: Alarm[];
  settings: AppSettings;
  /** null = no profile gating (all enabled alarms active). */
  activeAlarmIds: string[] | null;
}

export interface DueEvent extends ScheduledEvent {
  /** The minute-key that was fired, so the store can set lastFiredKey. */
  firedKey: string;
  /** Native only: the notification action the user chose ('snooze' | 'stop'),
   *  absent for a plain tap or a web-timer fire. */
  action?: string;
}

/** Shared shape so `App` can hold either the web timer scheduler or the native
 *  AlarmManager-backed one without caring which. */
export interface SchedulerLike {
  configure(getState: () => SchedulerState, onDue: (e: DueEvent) => void): void;
  start(): void;
  stop(): void;
  sync(): void;
  peek(now?: number): ScheduledEvent | null;
}

/**
 * AlarmScheduler — one timer, not one-per-alarm.
 *
 * Strategy:
 * - Compute the single soonest event across all active alarms (pure, in
 *   utils/schedule).
 * - Arm ONE setTimeout, capped at 30s, then recompute. Short caps keep us
 *   correct across background throttling, device sleep, and system-clock
 *   changes without thousands of intervals.
 * - A heartbeat + visibility/focus/online listeners force a resync so a
 *   throttled timer can't make us miss an alarm for long.
 * - De-dupe with a per-minute key so a resync storm can't double-fire.
 *
 * This class is the seam for a future native implementation: a Capacitor build
 * would replace the timer internals with AlarmManager / local notifications and
 * keep `configure` / `sync` / `onDue` identical.
 */
export class AlarmScheduler {
  private getState: (() => SchedulerState) | null = null;
  private onDue: ((e: DueEvent) => void) | null = null;
  private timer: number | null = null;
  private heartbeat: number | null = null;
  private running = false;
  private boundResync = () => this.sync();
  /** occurrence key → when it fired. Pruned by age, never wholesale. */
  private firedKeys = new Map<string, number>();

  configure(getState: () => SchedulerState, onDue: (e: DueEvent) => void): void {
    this.getState = getState;
    this.onDue = onDue;
  }

  start(): void {
    if (this.running || !this.getState) return;
    this.running = true;
    this.heartbeat = window.setInterval(this.boundResync, 20_000);
    document.addEventListener('visibilitychange', this.boundResync);
    window.addEventListener('focus', this.boundResync);
    window.addEventListener('online', this.boundResync);
    this.sync();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) clearTimeout(this.timer);
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.timer = this.heartbeat = null;
    document.removeEventListener('visibilitychange', this.boundResync);
    window.removeEventListener('focus', this.boundResync);
    window.removeEventListener('online', this.boundResync);
  }

  /** Recompute the next event and re-arm the timer. Call after any alarm/
   *  settings/profile change. Idempotent and cheap. */
  sync(): void {
    if (!this.running || !this.getState || !this.onDue) return;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const now = Date.now();
    this.pruneFiredKeys();

    const state = this.getState();

    // Firing check: look back GRACE_MS so an occurrence that came due while a
    // timer was throttled (or just a few ms ago — timers always fire late) is
    // still caught instead of being skipped to tomorrow. De-dupe handles the
    // overlap where the same occurrence stays "recent" for the grace window.
    // Collect *every* occurrence that's due, not just the soonest: two alarms
    // set to the same minute must both ring. Taking only the single next event
    // meant the runner-up stayed "soonest" behind the already-de-duped winner
    // on each resync until it aged out of the grace window — and never fired.
    const due = upcomingEvents(
      state.alarms,
      state.settings,
      state.activeAlarmIds,
      now - GRACE_MS,
      GRACE_MS + 250,
    );
    if (due.length) {
      for (const ev of due) this.fire(ev);
      this.timer = window.setTimeout(this.boundResync, 500);
      return;
    }

    // Scheduling: use the real clock so the armed delay and any UI agree.
    const ev = nextEvent(state.alarms, state.settings, state.activeAlarmIds, now);
    if (!ev) return;

    const delay = Math.max(0, Math.min(ev.at - now, 30_000));
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.sync();
    }, delay);
  }

  /** For tests / native shims: what would fire next, without arming anything. */
  peek(now = Date.now()): ScheduledEvent | null {
    if (!this.getState) return null;
    const s = this.getState();
    return nextEvent(s.alarms, s.settings, s.activeAlarmIds, now);
  }

  private fire(ev: ScheduledEvent): void {
    const key = `${ev.alarmId}:${ev.kind}:${minuteKey(ev.at)}`;
    if (this.firedKeys.has(key)) return;
    this.firedKeys.set(key, Date.now());
    this.onDue?.({ ...ev, firedKey: key });
  }

  private pruneFiredKeys(): void {
    // Drop only keys older than the de-dupe window. The previous size-capped
    // `clear()` could wipe the key of an occurrence that had just fired while
    // it was still inside the GRACE_MS look-back — and then fire it again.
    const cutoff = Date.now() - FIRED_TTL_MS;
    for (const [k, t] of this.firedKeys) {
      if (t < cutoff) this.firedKeys.delete(k);
    }
  }
}

export const alarmScheduler = new AlarmScheduler();
