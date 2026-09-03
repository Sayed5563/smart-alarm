import { describe, it, expect } from 'vitest';
import {
  formatClock,
  formatAlarmTime,
  nextOccurrence,
  formatCountdown,
  repeatDays,
} from '@/utils/time';
import type { Alarm } from '@/types';

const base: Pick<Alarm, 'hour' | 'minute' | 'repeat' | 'customDays'> = {
  hour: 7,
  minute: 0,
  repeat: 'once',
  customDays: [],
};

describe('formatClock', () => {
  it('formats 24h with seconds', () => {
    const d = new Date(2026, 0, 1, 20, 30, 42);
    expect(formatClock(d, { hour24: true, showSeconds: true })).toEqual({ main: '20:30:42', suffix: '' });
  });
  it('formats 12h without seconds', () => {
    const d = new Date(2026, 0, 1, 20, 30, 42);
    expect(formatClock(d, { hour24: false, showSeconds: false })).toEqual({ main: '8:30', suffix: 'PM' });
  });
  it('midnight is 12 AM in 12h', () => {
    const d = new Date(2026, 0, 1, 0, 5, 0);
    expect(formatClock(d, { hour24: false, showSeconds: false })).toEqual({ main: '12:05', suffix: 'AM' });
  });
});

describe('formatAlarmTime', () => {
  it('pads 24h', () => expect(formatAlarmTime(7, 5, true)).toBe('07:05'));
  it('12h suffix', () => expect(formatAlarmTime(0, 0, false)).toBe('12:00 AM'));
  it('noon', () => expect(formatAlarmTime(12, 0, false)).toBe('12:00 PM'));
});

describe('repeatDays', () => {
  it('weekdays', () => expect(repeatDays({ repeat: 'weekdays', customDays: [] })).toEqual([1, 2, 3, 4, 5]));
  it('weekends', () => expect(repeatDays({ repeat: 'weekends', customDays: [] })).toEqual([0, 6]));
  it('once is empty', () => expect(repeatDays({ repeat: 'once', customDays: [] })).toEqual([]));
  it('custom sorted', () =>
    expect(repeatDays({ repeat: 'custom', customDays: [5, 1, 3] })).toEqual([1, 3, 5]));
});

describe('nextOccurrence', () => {
  it('once: later today', () => {
    const from = new Date(2026, 5, 1, 6, 0, 0); // 06:00
    const at = nextOccurrence(base, from)!;
    expect(new Date(at).getHours()).toBe(7);
    expect(new Date(at).getDate()).toBe(1);
  });

  it('once: rolls to tomorrow when time passed', () => {
    const from = new Date(2026, 5, 1, 8, 0, 0); // 08:00, alarm 07:00
    const at = nextOccurrence(base, from)!;
    expect(new Date(at).getDate()).toBe(2);
    expect(new Date(at).getHours()).toBe(7);
  });

  it('handles 23:59 -> 00:00 crossing midnight', () => {
    const alarm = { ...base, hour: 0, minute: 0, repeat: 'daily' as const };
    const from = new Date(2026, 5, 1, 23, 59, 30);
    const at = nextOccurrence(alarm, from)!;
    const d = new Date(at);
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('weekly custom day finds the right day', () => {
    // 2026-06-01 is a Monday. Alarm only on Wednesday (3).
    const alarm = { ...base, repeat: 'custom' as const, customDays: [3 as const] };
    const from = new Date(2026, 5, 1, 9, 0, 0);
    const at = nextOccurrence(alarm, from)!;
    expect(new Date(at).getDay()).toBe(3);
    expect(new Date(at).getDate()).toBe(3);
  });

  it('same weekday next week when today already passed', () => {
    // Monday 2026-06-01, alarm Mondays at 07:00, now 08:00 -> next Monday
    const alarm = { ...base, repeat: 'custom' as const, customDays: [1 as const] };
    const from = new Date(2026, 5, 1, 8, 0, 0);
    const at = nextOccurrence(alarm, from)!;
    expect(new Date(at).getDay()).toBe(1);
    expect(new Date(at).getDate()).toBe(8);
  });

  it('returns null for custom repeat with no days', () => {
    const alarm = { ...base, repeat: 'custom' as const, customDays: [] };
    expect(nextOccurrence(alarm, new Date(2026, 5, 1))).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('hours and minutes', () => expect(formatCountdown(6 * 3600_000 + 32 * 60_000)).toBe('6h 32m'));
  it('minutes only', () => expect(formatCountdown(58 * 60_000)).toBe('58m'));
  it('days', () => expect(formatCountdown(2 * 86_400_000 + 3 * 3600_000)).toBe('2d 3h'));
  it('past', () => expect(formatCountdown(-1000)).toBe('now'));
});
