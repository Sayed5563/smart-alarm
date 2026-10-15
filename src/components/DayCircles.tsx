import type { RepeatMode, Weekday } from '@/types';
import { useT } from '@/i18n';
import { repeatDays } from '@/utils/time';
import { daysToRepeat } from '@/utils/repeat';
import { cx } from './ui';

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** M T W T F S S — tap to toggle. None selected means once. */
export function DayCircles({
  repeat,
  customDays,
  onChange,
}: {
  repeat: RepeatMode;
  customDays: Weekday[];
  onChange: (repeat: RepeatMode, customDays: Weekday[]) => void;
}) {
  const t = useT();
  const on = repeatDays({ repeat, customDays });
  const toggle = (d: Weekday) => {
    const next = on.includes(d) ? on.filter((x) => x !== d) : [...on, d];
    const r = daysToRepeat(next);
    onChange(r.repeat, r.customDays);
  };
  return (
    <div className="flex justify-between gap-1" role="group" aria-label={t('editor.section.repeat')}>
      {WEEK_ORDER.map((d) => {
        const active = on.includes(d);
        const name = t(`day.${d}` as 'day.0');
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            aria-label={name}
            onClick={() => toggle(d)}
            className={cx(
              'grid h-11 w-11 place-items-center rounded-full text-sm font-semibold transition active:scale-95',
              active ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted hover:text-fg',
            )}
          >
            {name.charAt(0)}
          </button>
        );
      })}
    </div>
  );
}
