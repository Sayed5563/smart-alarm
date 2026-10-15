import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { Button, Sheet } from '@/components/ui';
import { TimePicker } from '@/components/TimePicker';
import { timerView } from '@/utils/timer';
import { formatAlarmTime } from '@/utils/time';
import { audioService } from '@/services';

const PRESETS = [1, 5, 10, 15, 30, 60];
const R = 108; // ring radius
const C = 2 * Math.PI * R;

/** Presets and a custom length when idle; a countdown ring while running. */
export function TimerPage() {
  const t = useT();
  const endsAt = useStore((s) => s.timerEndsAt);
  const duration = useStore((s) => s.timerDurationMs);
  const hour24 = useStore((s) => s.settings.hour24);
  const startTimer = useStore((s) => s.startTimer);
  const cancelTimer = useStore((s) => s.cancelTimer);
  const ringing = useStore((s) => s.ringing);
  const [now, setNow] = useState(Date.now());
  const [custom, setCustom] = useState<{ h: number; m: number } | null>(null);

  const running = endsAt != null && endsAt > now && !ringing;
  useEffect(() => {
    if (endsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const start = (ms: number) => {
    if (!audioService.isUnlocked()) void audioService.unlock();
    setNow(Date.now());
    startTimer(ms);
  };

  const view = running ? timerView(endsAt, duration, now) : null;
  const end = endsAt != null ? new Date(endsAt) : null;

  return (
    <div className="space-y-6 pb-24">
      <h1 className="pt-6 text-[1.75rem] font-semibold tracking-tight">{t('timer.title')}</h1>

      {view && end ? (
        <div className="flex flex-col items-center gap-6 pt-4">
          <div className="relative grid h-64 w-64 place-items-center">
            <svg viewBox="0 0 240 240" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="120" cy="120" r={R} fill="none" strokeWidth="8" className="stroke-surface-2" />
              <circle
                cx="120"
                cy="120"
                r={R}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-accent"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - view.progress)}
                style={{ transition: 'stroke-dashoffset 0.25s linear' }}
              />
            </svg>
            <span className="tnum text-5xl font-light" role="timer" aria-live="off">
              {view.label}
            </span>
          </div>
          <p className="text-sm text-muted">
            {t('timer.ringsAt', { time: formatAlarmTime(end.getHours(), end.getMinutes(), hour24) })}
          </p>
          <Button variant="secondary" size="lg" onClick={cancelTimer}>
            {t('timer.cancel')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => start(m * 60_000)}
              className="glass flex h-20 items-center justify-center rounded-2xl text-lg font-semibold transition active:scale-[0.97]"
            >
              {m === 60 ? t('timer.hour') : t('timer.minutesShort', { n: m })}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustom({ h: 0, m: 20 })}
            className="col-span-3 h-14 rounded-2xl bg-accent-soft text-base font-semibold text-accent"
          >
            {t('timer.custom')}
          </button>
        </div>
      )}

      {custom && (
        <Sheet
          open
          onClose={() => setCustom(null)}
          title={t('timer.customTitle')}
          footer={
            <Button
              variant="primary"
              full
              disabled={custom.h === 0 && custom.m === 0}
              onClick={() => {
                start((custom.h * 60 + custom.m) * 60_000);
                setCustom(null);
              }}
            >
              {t('timer.start')} · {t('timer.hm', { h: custom.h, m: custom.m })}
            </Button>
          }
        >
          <TimePicker hour={custom.h} minute={custom.m} hour24 onChange={(h, m) => setCustom({ h, m })} />
        </Sheet>
      )}
    </div>
  );
}
