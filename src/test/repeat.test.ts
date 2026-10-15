import { describe, expect, it } from 'vitest';
import { daysToRepeat } from '@/utils/repeat';

describe('daysToRepeat', () => {
  it('no days is a one-off', () => {
    expect(daysToRepeat([])).toEqual({ repeat: 'once', customDays: [] });
  });
  it('maps the familiar sets onto their presets', () => {
    expect(daysToRepeat([0, 1, 2, 3, 4, 5, 6])).toEqual({ repeat: 'daily', customDays: [] });
    expect(daysToRepeat([5, 1, 3, 2, 4])).toEqual({ repeat: 'weekdays', customDays: [] });
    expect(daysToRepeat([6, 0])).toEqual({ repeat: 'weekends', customDays: [] });
  });
  it('anything else is custom, sorted and de-duplicated', () => {
    expect(daysToRepeat([5, 1, 3, 1])).toEqual({ repeat: 'custom', customDays: [1, 3, 5] });
  });
});
