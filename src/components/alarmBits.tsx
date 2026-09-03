import type { Alarm, Weekday } from '@/types';
import { useT } from '@/i18n';
import { repeatDays } from '@/utils/time';
import { cx } from './ui';

/** "Mon–Fri", "Every day", "Sun, Wed" … built from the alarm's repeat config. */
export function useRepeatSummary(): (alarm: Pick<Alarm, 'repeat' | 'customDays'>) => string {
  const t = useT();
  return (alarm) => {
    if (alarm.repeat === 'once') return t('repeat.summary.once');
    if (alarm.repeat === 'daily') return t('repeat.summary.daily');
    if (alarm.repeat === 'weekdays') return t('repeat.summary.weekdays');
    if (alarm.repeat === 'weekends') return t('repeat.summary.weekends');
    const days = repeatDays(alarm);
    if (days.length === 0) return t('repeat.custom');
    if (days.length === 7) return t('repeat.summary.daily');
    // Preserve week order starting Monday for readability.
    const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
    return order
      .filter((d) => days.includes(d))
      .map((d) => t(`day.${d}` as 'day.0'))
      .join(', ');
  };
}

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function DayPicker({
  value,
  onChange,
}: {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
}) {
  const t = useT();
  const toggle = (d: Weekday) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <div className="flex gap-1.5" role="group" aria-label={t('editor.section.repeat')}>
      {WEEK_ORDER.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(d)}
            className={cx(
              'h-11 flex-1 rounded-xl text-xs font-semibold transition',
              on ? 'bg-accent text-accent-contrast' : 'glass text-muted hover:text-fg',
            )}
          >
            {t(`day.${d}` as 'day.0').slice(0, 2)}
          </button>
        );
      })}
    </div>
  );
}
