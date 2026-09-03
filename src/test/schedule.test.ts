import { describe, it, expect } from 'vitest';
import { nextEventForAlarm, nextEvent } from '@/utils/schedule';
import { DEFAULT_SETTINGS, makeAlarm } from '@/data/defaults';
import type { AppSettings } from '@/types';

const settings: AppSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

function alarmAt(h: number, m: number, over: Partial<ReturnType<typeof makeAlarm>> = {}) {
  return makeAlarm(settings, { hour: h, minute: m, repeat: 'daily', ...over });
}

describe('nextEventForAlarm', () => {
  it('disabled alarms produce nothing', () => {
    const a = alarmAt(7, 0, { enabled: false });
    expect(nextEventForAlarm(a, settings, Date.now())).toBeNull();
  });

  it('an active snooze wins over the scheduled time', () => {
    const now = new Date(2026, 5, 1, 6, 0, 0).getTime();
    const a = alarmAt(7, 0, { snoozedUntil: now + 5 * 60_000 });
    const ev = nextEventForAlarm(a, settings, now)!;
    expect(ev.kind).toBe('snooze');
    expect(ev.at).toBe(now + 5 * 60_000);
  });

  it('a stale snooze in the past is ignored', () => {
    const now = new Date(2026, 5, 1, 6, 0, 0).getTime();
    const a = alarmAt(7, 0, { snoozedUntil: now - 60_000 });
    const ev = nextEventForAlarm(a, settings, now)!;
    expect(ev.kind).toBe('alarm');
  });

  it('pre-alarm fires before the main alarm', () => {
    const now = new Date(2026, 5, 1, 6, 0, 0).getTime();
    const a = alarmAt(7, 0, {
      preAlarm: { enabled: true, minutesBefore: 10, soundId: 'builtin:rain', volume: 0.3 },
    });
    const ev = nextEventForAlarm(a, settings, now)!;
    expect(ev.kind).toBe('pre-alarm');
    expect(new Date(ev.at).getHours()).toBe(6);
    expect(new Date(ev.at).getMinutes()).toBe(50);
  });

  it('quiet hours mute a normal alarm (mute mode) and it moves to the next allowed day', () => {
    const s: AppSettings = {
      ...settings,
      dnd: { enabled: true, startHour: 22, startMinute: 0, endHour: 8, endMinute: 0, behavior: 'mute' },
    };
    const now = new Date(2026, 5, 1, 21, 0, 0).getTime();
    const a = alarmAt(7, 0); // 07:00 is always inside the 22:00-08:00 window
    const ev = nextEventForAlarm(a, s, now);
    expect(ev).toBeNull();
  });

  it('important alarms ring during quiet hours when behavior allows it', () => {
    const s: AppSettings = {
      ...settings,
      dnd: {
        enabled: true,
        startHour: 22,
        startMinute: 0,
        endHour: 8,
        endMinute: 0,
        behavior: 'allow-important',
      },
    };
    const now = new Date(2026, 5, 1, 6, 0, 0).getTime();
    const a = alarmAt(7, 0, { importance: 'important' });
    const ev = nextEventForAlarm(a, s, now)!;
    expect(ev.kind).toBe('alarm');
  });
});

describe('nextEvent (multiple alarms)', () => {
  it('picks the soonest across independent alarms 06:59 / 07:00 / 07:01', () => {
    const now = new Date(2026, 5, 1, 6, 30, 0).getTime();
    const alarms = [alarmAt(7, 1), alarmAt(6, 59), alarmAt(7, 0)];
    const ev = nextEvent(alarms, settings, null, now)!;
    expect(new Date(ev.at).getHours()).toBe(6);
    expect(new Date(ev.at).getMinutes()).toBe(59);
  });

  it('respects an active profile filter', () => {
    const now = new Date(2026, 5, 1, 6, 30, 0).getTime();
    const early = alarmAt(6, 45);
    const late = alarmAt(9, 0);
    const ev = nextEvent([early, late], settings, [late.id], now)!;
    expect(new Date(ev.at).getHours()).toBe(9);
  });

  it('returns null when nothing is active', () => {
    expect(nextEvent([], settings, null, Date.now())).toBeNull();
  });
});
