import { useEffect, useLayoutEffect, useRef } from 'react';
import { pad2 } from '@/utils/time';
import { cx } from './ui';

const ITEM_H = 44;
const VISIBLE = 5; // odd, so one row is dead-centre

/**
 * A scrollable "reel" time picker — flick to spin, tap a number to snap to it,
 * or arrow-key when focused. Replaces the fiddly native <input type="time">,
 * which is the single most-used control in the app.
 */
export function TimePicker({
  hour,
  minute,
  hour24,
  onChange,
}: {
  hour: number;
  minute: number;
  hour24: boolean;
  onChange: (hour: number, minute: number) => void;
}) {
  const isPM = hour >= 12;
  const h12 = hour % 12 || 12;

  const hourValues = hour24
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 12 }, (_, i) => i + 1);
  const hourIndex = hour24 ? hour : h12 - 1;

  const to24 = (h12v: number, pm: boolean) => (h12v % 12) + (pm ? 12 : 0);

  const setHourIndex = (i: number) => {
    const next = hour24 ? i : to24(hourValues[i], isPM);
    onChange(next, minute);
  };
  const setMinuteIndex = (i: number) => onChange(hour, i);
  const setMeridiem = (pm: boolean) => onChange(to24(h12, pm), minute);

  return (
    <div className="flex items-stretch justify-center gap-1">
      <div
        className="reel-mask relative flex overflow-hidden rounded-2xl bg-black/[0.14] px-1"
        style={{ height: ITEM_H * VISIBLE }}
      >
        {/* centre highlight band */}
        <div
          className="pointer-events-none absolute inset-x-1 rounded-xl bg-fg/[0.08]"
          style={{ top: ITEM_H * 2, height: ITEM_H }}
          aria-hidden="true"
        />
        <Reel
          values={hourValues}
          index={hourIndex}
          onIndex={setHourIndex}
          label="Hour"
          format={(v) => (hour24 ? pad2(v) : String(v))}
        />
        <div
          className="tnum flex w-3 items-center justify-center text-3xl text-muted"
          aria-hidden="true"
        >
          :
        </div>
        <Reel
          values={Array.from({ length: 60 }, (_, i) => i)}
          index={minute}
          onIndex={setMinuteIndex}
          label="Minute"
          format={pad2}
        />
      </div>

      {!hour24 && (
        <div className="flex flex-col justify-center gap-1.5 pl-1">
          {(['AM', 'PM'] as const).map((m) => {
            const active = (m === 'PM') === isPM;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setMeridiem(m === 'PM')}
                className={cx(
                  'h-11 w-14 rounded-xl text-sm font-semibold transition',
                  active ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted hover:text-fg',
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Reel({
  values,
  index,
  onIndex,
  label,
  format,
}: {
  values: number[];
  index: number;
  onIndex: (i: number) => void;
  label: string;
  format: (v: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef(0);
  const lastEmitted = useRef(index);
  const programmatic = useRef(false);

  // Jump to the incoming index unless we're the one who just changed it
  // (otherwise the parent re-render would fight the user's flick).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (index === lastEmitted.current) return;
    lastEmitted.current = index;
    programmatic.current = true;
    el.scrollTo({ top: index * ITEM_H });
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => (programmatic.current = false), 80);
  }, [index]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // initial position, once — layout effect so there's no visible jump
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Explicit move (tap / keyboard): animate to the row and emit.
  const goto = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(values.length - 1, i));
    lastEmitted.current = clamped;
    programmatic.current = true;
    el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => (programmatic.current = false), 380);
    if (clamped !== index) onIndex(clamped);
  };

  // After a flick, CSS scroll-snap has already landed us on a row — just read
  // it and report. No scrollTo here, so there's no settle/scroll feedback loop.
  const settle = () => {
    const el = ref.current;
    if (!el || programmatic.current) return;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
    if (i !== index) {
      lastEmitted.current = i;
      onIndex(i);
    }
  };

  const onScroll = () => {
    if (programmatic.current) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 120);
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={values[index]}
      aria-valuetext={format(values[index])}
      aria-valuemin={values[0]}
      aria-valuemax={values[values.length - 1]}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const dir = e.key === 'ArrowDown' ? 1 : -1;
          goto((index + dir + values.length) % values.length);
        }
        if (e.key === 'Home') {
          e.preventDefault();
          goto(0);
        }
        if (e.key === 'End') {
          e.preventDefault();
          goto(values.length - 1);
        }
      }}
      className="no-scrollbar h-full w-14 snap-y snap-mandatory overflow-y-scroll overscroll-contain"
    >
      <div style={{ height: ITEM_H * 2 }} aria-hidden="true" />
      {values.map((v, i) => (
        <div
          key={v}
          aria-hidden="true"
          onClick={() => goto(i)}
          className={cx(
            'tnum flex w-full cursor-pointer snap-center select-none items-center justify-center text-3xl transition-colors',
            i === index ? 'font-semibold text-fg' : 'text-muted/45',
          )}
          style={{ height: ITEM_H }}
        >
          {format(v)}
        </div>
      ))}
      <div style={{ height: ITEM_H * 2 }} aria-hidden="true" />
    </div>
  );
}
