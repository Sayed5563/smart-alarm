import type { Alarm, Weekday } from '@/types';
import { useT } from '@/i18n';
import { repeatDays } from '@/utils/time';

/** "Mon–Fri", "Every day", "Sun, Wed" … built from the alarm's repeat config. */
export function useRepeatSummary(): (alarm: Pick<Alarm, 'repeat' | 'customDays'>) => string {
  const t = useT();
  return (alarm) => {
    if (alarm.repeat === 'once') return t('repeat.summary.once');
    if (alarm.repeat === 'daily') return t('repeat.summary.daily');
    if (alarm.repeat === 'weekdays') return t('repeat.summary.weekdays');
    if (alarm.repeat === 'weekends') return t('repeat.summary.weekends');
    const days = repeatDays(alarm);
    if (days.length === 0) return t('repeat.summary.once');
    if (days.length === 7) return t('repeat.summary.daily');
    const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
    return order
      .filter((d) => days.includes(d))
      .map((d) => t(`day.${d}` as 'day.0'))
      .join(', ');
  };
}
