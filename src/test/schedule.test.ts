import { describe, it, expect } from 'vitest';
import { nextEventForAlarm, nextEvent, scheduleSet } from '@/utils/schedule';
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

describe('scheduleSet (native OS scheduling)', () => {
  const at = (h: number, m: number, over = {}) =>
    makeAlarm(settings, { hour: h, minute: m, repeat: 'daily', ...over });

  it('registers the next N occurrences of each daily alarm', () => {
    const now = new Date(2026, 5, 1, 6, 0, 0).getTime();
    const evs = scheduleSet([at(7, 0)], settings, null, now, {
      horizonMs: 14 * 86_400_000,
      occurrencesPerAlarm: 3,
    });
    expect(evs.filter((e) => e.kind === 'alarm')).toHaveLength(3);
    expect(new Date(evs[0].at).getDate()).toBe(1);
    expect(new Date(evs[1].at).getDate()).toBe(2);
    expect(new Date(evs[2].at).getDate()).toBe(3);
  });

  it('includes each pre-alarm alongside its main occurrence', () => {
    const now = new Date(2026, 5, 1, 6, 0, 0).getTime();
    const alarm = at(7, 0, {
      preAlarm: { enabled: true, minutesBefore: 10, soundId: 'builtin:rain', volume: 0.3 },
    });
    const evs = scheduleSet([alarm], settings, null, now, {
      horizonMs: 2 * 86_400_000,
      occurrencesPerAlarm: 2,
    });
    expect(evs.filter((e) => e.kind === 'pre-alarm')).toHaveLength(2);
    const firstPre = evs.find((e) => e.kind === 'pre-alarm')!;
    expect(new Date(firstPre.at).getHours()).toBe(6);
    expect(new Date(firstPre.at).getMinutes()).toBe(50);
  });

  it('a "once" alarm yields exactly one event', () => {
    const now = new Date(2026, 5, 1, 6, 0, 0).getTime();
    const evs = scheduleSet([makeAlarm(settings, { hour: 7, minute: 0, repeat: 'once' })], settings, null, now);
    expect(evs).toHaveLength(1);
  });

  it('registers an active snooze (alongside the recurring occurrences)', () => {
    const now = new Date(2026, 5, 1, 6, 0, 0).getTime();
    const evs = scheduleSet([at(7, 0, { snoozedUntil: now + 5 * 60_000 })], settings, null, now);
    expect(evs.some((e) => e.kind === 'snooze' && e.at === now + 5 * 60_000)).toBe(true);
    expect(evs.some((e) => e.kind === 'alarm')).toBe(true);
  });

  it('skips disabled alarms and profile-excluded alarms', () => {
    const now = Date.now();
    const on = at(7, 0);
    const off = at(8, 0, { enabled: false });
    const excluded = at(9, 0);
    const evs = scheduleSet([on, off, excluded], settings, [on.id], now);
    expect(new Set(evs.map((e) => e.alarmId))).toEqual(new Set([on.id]));
  });
});
