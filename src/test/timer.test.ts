import { describe, expect, it } from 'vitest';
import { timerView } from '@/utils/timer';

describe('timerView', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(timerView(1_000 + 299_000, 300_000, 1_000).label).toBe('4:59');
    expect(timerView(3_723_000, 4_000_000, 0).label).toBe('1:02:03');
  });
  it('never goes negative', () => {
    expect(timerView(1_000, 60_000, 5_000)).toEqual({ label: '0:00', progress: 0 });
  });
  it('a timer from an older version (no duration) shows a full ring, not NaN', () => {
    expect(timerView(60_000, null, 0).progress).toBe(1);
  });
  it('progress runs from 1 to 0', () => {
    expect(timerView(100_000, 100_000, 50_000).progress).toBeCloseTo(0.5);
  });
});
