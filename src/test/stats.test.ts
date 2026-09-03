import { describe, it, expect } from 'vitest';
import { computeStats } from '@/utils/stats';
import type { AlarmHistoryEntry } from '@/types';

const DAY = 86_400_000;
const NOW = new Date(2026, 5, 10, 9, 0, 0).getTime();

function entry(over: Partial<AlarmHistoryEntry>): AlarmHistoryEntry {
  return {
    id: Math.random().toString(),
    alarmId: 'a1',
    alarmLabel: 'Work',
    category: 'work',
    triggeredAt: NOW,
    snoozeCount: 0,
    wakeTaskRequired: false,
    wakeTaskFailures: 0,
    outcome: 'completed',
    wasTest: false,
    wasTimer: false,
    ...over,
  };
}

describe('computeStats', () => {
  it('empty history is all zeros', () => {
    const s = computeStats([], NOW);
    expect(s.wakeStreakDays).toBe(0);
    expect(s.totalRings).toBe(0);
    expect(s.mostUsedAlarmLabel).toBeNull();
  });

  it('ignores test and timer entries', () => {
    const s = computeStats(
      [entry({ wasTest: true }), entry({ wasTimer: true }), entry({})],
      NOW,
    );
    expect(s.totalRings).toBe(1);
  });

  it('counts a 3-day wake streak ending today', () => {
    const s = computeStats(
      [
        entry({ triggeredAt: NOW }),
        entry({ triggeredAt: NOW - DAY }),
        entry({ triggeredAt: NOW - 2 * DAY }),
        entry({ triggeredAt: NOW - 4 * DAY }), // gap breaks it
      ],
      NOW,
    );
    expect(s.wakeStreakDays).toBe(3);
  });

  it('streak still counts when today has no alarm yet but yesterday does', () => {
    const s = computeStats([entry({ triggeredAt: NOW - DAY }), entry({ triggeredAt: NOW - 2 * DAY })], NOW);
    expect(s.wakeStreakDays).toBe(2);
  });

  it('sums snoozes for today only', () => {
    const s = computeStats(
      [entry({ snoozeCount: 2, triggeredAt: NOW }), entry({ snoozeCount: 5, triggeredAt: NOW - DAY })],
      NOW,
    );
    expect(s.snoozesToday).toBe(2);
  });

  it('average snooze count across all real rings', () => {
    const s = computeStats([entry({ snoozeCount: 1 }), entry({ snoozeCount: 2 }), entry({ snoozeCount: 0 })], NOW);
    expect(s.averageSnoozes).toBe(1);
  });

  it('task completion rate only over task-required rings', () => {
    const s = computeStats(
      [
        entry({ wakeTaskRequired: true, wakeTaskCompleted: true }),
        entry({ wakeTaskRequired: true, wakeTaskCompleted: false }),
        entry({ wakeTaskRequired: false }),
      ],
      NOW,
    );
    expect(s.taskCompletionRate).toBeCloseTo(0.5);
  });

  it('most used alarm label', () => {
    const s = computeStats(
      [entry({ alarmLabel: 'Gym' }), entry({ alarmLabel: 'Work' }), entry({ alarmLabel: 'Work' })],
      NOW,
    );
    expect(s.mostUsedAlarmLabel).toBe('Work');
  });
});
