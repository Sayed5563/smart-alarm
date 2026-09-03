import { describe, it, expect } from 'vitest';
import { isWithinDnd, isAlarmSuppressedByDnd } from '@/utils/dnd';
import type { DndConfig } from '@/types';

const wrap: DndConfig = {
  enabled: true,
  startHour: 22,
  startMinute: 0,
  endHour: 7,
  endMinute: 0,
  behavior: 'allow-important',
};

describe('isWithinDnd (window crossing midnight)', () => {
  it('23:30 is inside', () => expect(isWithinDnd(new Date(2026, 0, 1, 23, 30), wrap)).toBe(true));
  it('03:00 is inside', () => expect(isWithinDnd(new Date(2026, 0, 1, 3, 0), wrap)).toBe(true));
  it('07:00 is the boundary and excluded', () =>
    expect(isWithinDnd(new Date(2026, 0, 1, 7, 0), wrap)).toBe(false));
  it('12:00 is outside', () => expect(isWithinDnd(new Date(2026, 0, 1, 12, 0), wrap)).toBe(false));
  it('disabled always false', () =>
    expect(isWithinDnd(new Date(2026, 0, 1, 23, 30), { ...wrap, enabled: false })).toBe(false));
});

describe('isWithinDnd (same-day window)', () => {
  const day: DndConfig = { ...wrap, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 };
  it('12:00 inside', () => expect(isWithinDnd(new Date(2026, 0, 1, 12, 0), day)).toBe(true));
  it('08:00 outside', () => expect(isWithinDnd(new Date(2026, 0, 1, 8, 0), day)).toBe(false));
  it('20:00 outside', () => expect(isWithinDnd(new Date(2026, 0, 1, 20, 0), day)).toBe(false));
});

describe('isAlarmSuppressedByDnd', () => {
  const at = new Date(2026, 0, 1, 3, 0); // inside the wrap window

  it('mute mode suppresses everything', () => {
    const cfg: DndConfig = { ...wrap, behavior: 'mute' };
    expect(isAlarmSuppressedByDnd({ importance: 'important', dndOverride: true }, at, cfg)).toBe(true);
  });

  it('allow-important lets important through', () => {
    expect(isAlarmSuppressedByDnd({ importance: 'important', dndOverride: false }, at, wrap)).toBe(false);
  });

  it('allow-important suppresses normal alarms', () => {
    expect(isAlarmSuppressedByDnd({ importance: 'normal', dndOverride: false }, at, wrap)).toBe(true);
  });

  it('dndOverride lets a normal alarm through', () => {
    expect(isAlarmSuppressedByDnd({ importance: 'normal', dndOverride: true }, at, wrap)).toBe(false);
  });

  it('outside the window nothing is suppressed', () => {
    const noon = new Date(2026, 0, 1, 12, 0);
    expect(isAlarmSuppressedByDnd({ importance: 'normal', dndOverride: false }, noon, wrap)).toBe(false);
  });
});
