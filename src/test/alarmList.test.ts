import { describe, expect, it } from 'vitest';
import { makeAlarm, DEFAULT_SETTINGS } from '@/data/defaults';
import { isSpent, sortByTimeOfDay } from '@/utils/alarmList';

const at = (hour: number, minute: number, createdAt = 0) =>
  makeAlarm(DEFAULT_SETTINGS, { hour, minute, createdAt });

describe('sortByTimeOfDay', () => {
  it('orders by clock time, not by next ring, and is stable on ties', () => {
    const list = [at(14, 15), at(5, 30), at(6, 45, 2), at(6, 45, 1)];
    expect(sortByTimeOfDay(list).map((a) => [a.hour, a.minute, a.createdAt])).toEqual([
      [5, 30, 0], [6, 45, 1], [6, 45, 2], [14, 15, 0],
    ]);
  });
  it('does not mutate its input', () => {
    const list = [at(9, 0), at(1, 0)];
    sortByTimeOfDay(list);
    expect(list[0].hour).toBe(9);
  });
});

describe('isSpent', () => {
  it('is true only for a once-alarm that already rang', () => {
    expect(isSpent({ repeat: 'once', lastFiredKey: 'k' })).toBe(true);
    expect(isSpent({ repeat: 'once', lastFiredKey: undefined })).toBe(false);
    expect(isSpent({ repeat: 'daily', lastFiredKey: 'k' })).toBe(false);
  });
  it('a snoozed once-alarm is not spent: it still rings', () => {
    const now = 1_000_000;
    expect(isSpent({ repeat: 'once', lastFiredKey: 'k', snoozedUntil: now + 60_000 }, now)).toBe(false);
    expect(isSpent({ repeat: 'once', lastFiredKey: 'k', snoozedUntil: now - 1 }, now)).toBe(true);
  });
});
