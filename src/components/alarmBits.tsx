import type { Alarm, RepeatMode, Weekday } from '@/types';
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
    if (days.length === 0) return t('repeat.summary.once');
    if (days.length === 7) return t('repeat.summary.daily');
    const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
    return order
      .filter((d) => days.includes(d))
      .map((d) => t(`day.${d}` as 'day.0'))
      .join(', ');
  };
}

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = new Set<Weekday>([1, 2, 3, 4, 5]);
const WEEKENDS = new Set<Weekday>([0, 6]);

function sameSet(days: Weekday[], target: Set<Weekday>): boolean {
  return days.length === target.size && days.every((d) => target.has(d));
}

/**
 * The whole repeat control in one place: quick presets + a live day row.
 * Tapping any day drops you into a custom set; clearing every day is "Once".
 */
export function RepeatPicker({
  repeat,
  customDays,
  onChange,
}: {
  repeat: RepeatMode;
  customDays: Weekday[];
  onChange: (repeat: RepeatMode, customDays: Weekday[]) => void;
}) {
  const t = useT();
  const effective = repeatDays({ repeat, customDays });

  const preset: 'once' | 'weekdays' | 'weekends' | 'daily' | null =
    repeat === 'once' || (repeat === 'custom' && effective.length === 0)
      ? 'once'
      : effective.length === 7
        ? 'daily'
        : sameSet(effective, WEEKDAYS)
          ? 'weekdays'
          : sameSet(effective, WEEKENDS)
            ? 'weekends'
            : null;

  const toggleDay = (d: Weekday) => {
    const set = new Set(effective);
    if (set.has(d)) set.delete(d);
    else set.add(d);
    const next = [...set].sort((a, b) => a - b);
    onChange(next.length === 0 ? 'once' : 'custom', next);
  };

  const presets: { key: 'once' | 'weekdays' | 'weekends' | 'daily'; label: string }[] = [
    { key: 'once', label: t('repeat.once') },
    { key: 'weekdays', label: t('repeat.weekdays') },
    { key: 'weekends', label: t('repeat.weekends') },
    { key: 'daily', label: t('repeat.daily') },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            onClick={() => onChange(p.key, [])}
            className={cx(
              'rounded-pill px-3.5 py-1.5 text-sm font-medium transition',
              preset === p.key
                ? 'bg-accent text-accent-contrast'
                : 'bg-surface-2 text-muted hover:text-fg',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5" role="group" aria-label={t('editor.section.repeat')}>
        {WEEK_ORDER.map((d) => {
          const on = effective.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={t(`day.${d}` as 'day.0')}
              onClick={() => toggleDay(d)}
              className={cx(
                'h-11 flex-1 rounded-xl text-xs font-semibold transition',
                on ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted hover:text-fg',
              )}
            >
              {t(`day.${d}` as 'day.0').slice(0, 2)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
