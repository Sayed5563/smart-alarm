import { describe, it, expect, vi, afterEach } from 'vitest';
import { AlarmScheduler, type DueEvent } from '@/services/alarmScheduler';
import { DEFAULT_SETTINGS, makeAlarm } from '@/data/defaults';
import type { AppSettings } from '@/types';

const settings: AppSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

afterEach(() => {
  vi.useRealTimers();
});

function makeScheduler(alarms: ReturnType<typeof makeAlarm>[]) {
  const fired: DueEvent[] = [];
  const sch = new AlarmScheduler();
  sch.configure(
    () => ({ alarms, settings, activeAlarmIds: null }),
    (e) => fired.push(e),
  );
  return { sch, fired };
}

describe('AlarmScheduler (integration)', () => {
  it('fires an occurrence even when the timer runs a little late', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 6, 59, 50));
    const alarm = makeAlarm(settings, { hour: 7, minute: 0, repeat: 'daily' });
    const { sch, fired } = makeScheduler([alarm]);

    sch.start(); // arms a timeout for ~10s from now

    // Jump to just *after* 07:00 (timers always fire a hair late) and run it.
    vi.setSystemTime(new Date(2026, 5, 1, 7, 0, 0, 40));
    vi.advanceTimersByTime(11_000);

    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ alarmId: alarm.id, kind: 'alarm' });
    sch.stop();
  });

  it('does not double-fire the same occurrence on the follow-up sync', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 6, 59, 55));
    const alarm = makeAlarm(settings, { hour: 7, minute: 0, repeat: 'daily' });
    const { sch, fired } = makeScheduler([alarm]);
    sch.start();

    vi.setSystemTime(new Date(2026, 5, 1, 7, 0, 1));
    vi.advanceTimersByTime(6_000); // armed timeout -> fire + schedules a 500ms resync
    vi.advanceTimersByTime(2_000); // the resync runs, still inside the grace window
    vi.setSystemTime(new Date(2026, 5, 1, 7, 0, 30));
    vi.advanceTimersByTime(1_000);

    expect(fired).toHaveLength(1);
    sch.stop();
  });

  it('recovers a missed alarm after the tab was suspended past the fire time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 6, 59, 30));
    const alarm = makeAlarm(settings, { hour: 7, minute: 0, repeat: 'daily' });
    const { sch, fired } = makeScheduler([alarm]);
    sch.start();

    // Simulate the device sleeping: jump 40s past the alarm without running the
    // armed timer, then deliver a visibility/heartbeat resync.
    vi.setSystemTime(new Date(2026, 5, 1, 7, 0, 40));
    sch.sync();

    expect(fired).toHaveLength(1);
    sch.stop();
  });

  it('a "once" alarm whose minute passed long ago does not fire', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 9, 0, 0));
    const alarm = makeAlarm(settings, { hour: 7, minute: 0, repeat: 'once' });
    const { sch, fired } = makeScheduler([alarm]);
    sch.start();
    vi.advanceTimersByTime(35_000);
    expect(fired).toHaveLength(0);
    sch.stop();
  });

  it('peek() reports the next event without arming anything', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 6, 0, 0));
    const alarm = makeAlarm(settings, { hour: 7, minute: 0, repeat: 'daily' });
    const { sch, fired } = makeScheduler([alarm]);
    const ev = sch.peek();
    expect(ev?.at).toBe(new Date(2026, 5, 1, 7, 0, 0).getTime());
    expect(fired).toHaveLength(0);
  });
});
