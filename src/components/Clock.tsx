import { useMemo } from 'react';
import type { AppSettings } from '@/types';
import { useNow } from '@/hooks/useNow';
import { pad2 } from '@/utils/time';
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

function parts(date: Date, hour24: boolean) {
  let h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  let suffix = '';
  if (!hour24) {
    suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
  }
  return { hm: `${hour24 ? pad2(h) : h}:${pad2(m)}`, ss: pad2(s), suffix };
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
  const { hm, ss, suffix } = parts(date, settings.hour24);
  const spoken = `The time is ${hm}${settings.showSeconds ? ` and ${ss} seconds` : ''}${suffix ? ' ' + suffix : ''}`;

  if (compact) {
    return (
      <span className={cx('clock-face tnum text-2xl', FONT_CLASS[settings.clockFont])}>
        {hm}
        {suffix && <span className="ml-1 text-xs text-muted">{suffix}</span>}
        <span className="sr-only">{spoken}</span>
      </span>
    );
  }

  return (
    <div
      className={cx(
        'clock-face flex items-baseline justify-center whitespace-nowrap',
        FONT_CLASS[settings.clockFont],
      )}
      role="timer"
      aria-live="off"
    >
      <span className="tnum text-[clamp(4rem,23vw,7.5rem)]">{hm}</span>
      {settings.showSeconds && (
        <span className="tnum ml-1.5 text-[clamp(1.1rem,5vw,1.6rem)] font-normal text-muted">
          {ss}
        </span>
      )}
      {suffix && (
        <span className="ml-2 text-sm font-semibold tracking-wide text-muted">{suffix}</span>
      )}
      <span className="sr-only">{spoken}</span>
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
        const r1 = major ? 84 : 89;
        const r2 = 95;
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
    : `${(h % 12) || 12}:${pad2(m)} ${h >= 12 ? 'PM' : 'AM'}`;

  return (
    <div
      className="mx-auto aspect-square w-[min(74vw,21rem)]"
      role="timer"
      aria-label={`Analog clock showing ${readable}`}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <circle
          cx="100"
          cy="100"
          r="97"
          className="fill-surface stroke-border"
          strokeWidth="1"
        />
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="currentColor"
            className={t.major ? 'text-fg' : 'text-muted/60'}
            strokeWidth={t.major ? 2.6 : 1}
            strokeLinecap="round"
          />
        ))}
        <line
          x1="100"
          y1="108"
          x2="100"
          y2="48"
          stroke="currentColor"
          className="text-fg"
          strokeWidth="6.5"
          strokeLinecap="round"
          transform={`rotate(${hourAngle} 100 100)`}
        />
        <line
          x1="100"
          y1="112"
          x2="100"
          y2="28"
          stroke="currentColor"
          className="text-fg"
          strokeWidth="4"
          strokeLinecap="round"
          transform={`rotate(${minuteAngle} 100 100)`}
        />
        {showSeconds && (
          <line
            x1="100"
            y1="116"
            x2="100"
            y2="22"
            stroke="currentColor"
            className="text-accent"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${secondAngle} 100 100)`}
          />
        )}
        <circle cx="100" cy="100" r="5.5" className="fill-accent" />
        <circle cx="100" cy="100" r="2" className="fill-surface" />
      </svg>
      <span className="sr-only">{`The time is ${readable}`}</span>
    </div>
  );
}
