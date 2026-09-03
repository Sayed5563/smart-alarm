import { useMemo } from 'react';
import type { AppSettings } from '@/types';
import { useNow } from '@/hooks/useNow';
import { formatClock, pad2 } from '@/utils/time';
import { cx } from './ui';

const FONT_CLASS: Record<AppSettings['clockFont'], string> = {
  classic: 'clock-classic',
  digital: 'clock-digital',
  minimal: 'clock-minimal',
};

export function Clock({ settings, compact = false }: { settings: AppSettings; compact?: boolean }) {
  const now = useNow(settings.showSeconds ? 'second' : 'minute');
  if (settings.clockType === 'analog' && !compact) {
    return <AnalogClock date={now} showSeconds={settings.showSeconds} hour24={settings.hour24} />;
  }
  return <DigitalClock date={now} settings={settings} compact={compact} />;
}

export function DigitalClock({
  date,
  settings,
  compact = false,
}: {
  date: Date;
  settings: AppSettings;
  compact?: boolean;
}) {
  const { main, suffix } = formatClock(date, {
    hour24: settings.hour24,
    showSeconds: settings.showSeconds,
  });
  return (
    <div
      className={cx(
        'clock-face tnum flex items-baseline justify-center gap-2 whitespace-nowrap',
        FONT_CLASS[settings.clockFont],
      )}
      role="timer"
      aria-live="off"
    >
      <span
        className={
          compact
            ? 'text-2xl'
            : cx(
                'leading-none',
                settings.showSeconds
                  ? 'text-[clamp(2.25rem,12vw,4.5rem)]'
                  : 'text-[clamp(3rem,17vw,6rem)]',
              )
        }
      >
        {main}
      </span>
      {suffix && (
        <span className={compact ? 'text-xs text-muted' : 'text-xl md:text-2xl text-muted'}>
          {suffix}
        </span>
      )}
      <span className="sr-only">
        {`The time is ${main}${suffix ? ' ' + suffix : ''}`}
      </span>
    </div>
  );
}

export function AnalogClock({
  date,
  showSeconds,
  hour24,
}: {
  date: Date;
  showSeconds: boolean;
  hour24: boolean;
}) {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const minuteAngle = m * 6 + s * 0.1;
  const hourAngle = (h % 12) * 30 + m * 0.5;
  const secondAngle = s * 6;

  const ticks = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const major = i % 5 === 0;
        const a = (i * 6 * Math.PI) / 180;
        const r1 = major ? 86 : 90;
        const r2 = 96;
        return {
          x1: 100 + r1 * Math.sin(a),
          y1: 100 - r1 * Math.cos(a),
          x2: 100 + r2 * Math.sin(a),
          y2: 100 - r2 * Math.cos(a),
          major,
        };
      }),
    [],
  );

  const readable = hour24
    ? `${pad2(h)}:${pad2(m)}`
    : `${((h % 12) || 12)}:${pad2(m)} ${h >= 12 ? 'PM' : 'AM'}`;

  return (
    <div
      className="mx-auto aspect-square w-[min(72vw,20rem)]"
      role="timer"
      aria-label={`Analog clock showing ${readable}`}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <circle cx="100" cy="100" r="98" className="fill-surface stroke-border" strokeWidth="1" />
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="currentColor"
            className={t.major ? 'text-fg' : 'text-muted'}
            strokeWidth={t.major ? 2.4 : 1}
            strokeLinecap="round"
          />
        ))}
        {/* hour hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="46"
          stroke="currentColor"
          className="text-fg"
          strokeWidth="6"
          strokeLinecap="round"
          transform={`rotate(${hourAngle} 100 100)`}
        />
        {/* minute hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="26"
          stroke="currentColor"
          className="text-fg"
          strokeWidth="4"
          strokeLinecap="round"
          transform={`rotate(${minuteAngle} 100 100)`}
        />
        {showSeconds && (
          <line
            x1="100"
            y1="112"
            x2="100"
            y2="22"
            stroke="currentColor"
            className="text-accent"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${secondAngle} 100 100)`}
          />
        )}
        <circle cx="100" cy="100" r="4.5" className="fill-accent" />
      </svg>
      <span className="sr-only">{`The time is ${readable}`}</span>
    </div>
  );
}
