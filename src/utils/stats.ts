import type { AlarmHistoryEntry } from '@/types';

const DAY_MS = 86_400_000;

function dayStamp(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface Stats {
  wakeStreakDays: number;
  snoozesToday: number;
  averageSnoozes: number;
  mostUsedAlarmLabel: string | null;
  taskCompletionRate: number | null;
  totalRings: number;
  onTimeRate: number | null;
}

/** All figures are derived from stored history only — nothing is fabricated. */
export function computeStats(history: AlarmHistoryEntry[], now = Date.now()): Stats {
  const real = history.filter((h) => !h.wasTest && !h.wasTimer);
  const todayStart = dayStamp(now);

  const snoozesToday = real
    .filter((h) => h.triggeredAt >= todayStart)
    .reduce((sum, h) => sum + h.snoozeCount, 0);

  const averageSnoozes = real.length
    ? real.reduce((s, h) => s + h.snoozeCount, 0) / real.length
    : 0;

  // Wake streak: consecutive days (ending today or yesterday) that had at least
  // one alarm resolved as completed / dismissed.
  const okDays = new Set(
    real
      .filter((h) => h.outcome === 'completed' || h.outcome === 'dismissed-no-task')
      .map((h) => dayStamp(h.triggeredAt)),
  );
  let streak = 0;
  let cursor = okDays.has(todayStart) ? todayStart : todayStart - DAY_MS;
  while (okDays.has(cursor)) {
    streak++;
    cursor -= DAY_MS;
  }

  const counts = new Map<string, number>();
  for (const h of real) counts.set(h.alarmLabel || 'Alarm', (counts.get(h.alarmLabel || 'Alarm') ?? 0) + 1);
  let mostUsedAlarmLabel: string | null = null;
  let best = 0;
  for (const [label, c] of counts) if (c > best) ((best = c), (mostUsedAlarmLabel = label));

  const withTask = real.filter((h) => h.wakeTaskRequired);
  const taskCompletionRate = withTask.length
    ? withTask.filter((h) => h.wakeTaskCompleted).length / withTask.length
    : null;

  const onTime = real.filter((h) => h.outcome !== 'missed' && h.outcome !== 'auto-stopped');
  const onTimeRate = real.length ? onTime.length / real.length : null;

  return {
    wakeStreakDays: streak,
    snoozesToday,
    averageSnoozes: Math.round(averageSnoozes * 10) / 10,
    mostUsedAlarmLabel,
    taskCompletionRate,
    totalRings: real.length,
    onTimeRate,
  };
}
