import type { RepeatMode, Weekday } from '@/types';

/** The day circles' selection, as the stored repeat rule. */
export function daysToRepeat(days: Weekday[]): { repeat: RepeatMode; customDays: Weekday[] } {
  const d = [...new Set(days)].sort((a, b) => a - b);
  const key = d.join(',');
  if (d.length === 0) return { repeat: 'once', customDays: [] };
  if (d.length === 7) return { repeat: 'daily', customDays: [] };
  if (key === '1,2,3,4,5') return { repeat: 'weekdays', customDays: [] };
  if (key === '0,6') return { repeat: 'weekends', customDays: [] };
  return { repeat: 'custom', customDays: d };
}
