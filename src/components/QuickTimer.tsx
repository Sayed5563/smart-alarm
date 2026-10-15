import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { formatAlarmTime, pad2 } from '@/utils/time';
import { audioService } from '@/services';

export function QuickSet() {
  const t = useT();
  const quickSet = useStore((s) => s.quickSet);
  const hour24 = useStore((s) => s.settings.hour24);
  const toast = useStore((s) => s.toast);

  const add = (mins: number) => {
    const a = quickSet(mins);
    toast(t('quick.created', { time: formatAlarmTime(a.hour, a.minute, hour24) }));
  };

  return (
    <div className="grid grid-cols-3 gap-2.5" role="group" aria-label={t('home.quickSet')}>
      {[5, 10, 15].map((m) => (
        <button
          key={m}
          onClick={() => add(m)}
          className="glass flex h-[3.75rem] flex-col items-center justify-center rounded-2xl transition duration-150 hover:bg-surface-2 active:scale-[0.97]"
        >
          <span className="text-lg font-semibold">+{m}</span>
          <span className="text-[11px] text-muted">min</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Timer — a one-shot countdown that reuses the ringing infrastructure. It is
 * deliberately kept separate from recurring alarms: a transient alarm object is
 * created only in memory and handed straight to `beginRing` when it elapses.
 */
export function Timer() {
  const t = useT();
  // The countdown itself lives in the store and rings from App (web) or as a
  // native alarm; this is only its display.
  const target = useStore((s) => s.timerEndsAt);
  const startTimer = useStore((s) => s.startTimer);
  const cancelTimer = useStore((s) => s.cancelTimer);
  const ringing = useStore((s) => s.ringing);

  const [remaining, setRemaining] = useState(0);
  const [customMin, setCustomMin] = useState(3);

  useEffect(() => {
    if (target == null) return;
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [target]);

  const start = (mins: number) => {
    if (!audioService.isUnlocked()) void audioService.unlock();
    startTimer(mins);
  };

  const running = target != null && target > Date.now() && !ringing;
  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted">{t('timer.title')}</span>
        {running && (
          <span className="tnum text-sm font-semibold text-accent">
            {pad2(mm)}:{pad2(ss)}
          </span>
        )}
      </div>
      {running ? (
        <button
          onClick={cancelTimer}
          className="glass h-12 w-full rounded-2xl text-sm font-medium text-muted transition hover:text-fg"
        >
          {t('timer.cancel')}
        </button>
      ) : (
        <div className="flex gap-2.5">
          {([5, 10, 30] as const).map((m) => (
            <button
              key={m}
              onClick={() => start(m)}
              className="glass h-12 flex-1 rounded-2xl text-sm font-semibold transition duration-150 hover:bg-surface-2 active:scale-[0.97]"
            >
              {t(`timer.${m}` as 'timer.5')}
            </button>
          ))}
          <label className="glass flex h-12 items-center gap-1 rounded-2xl px-2.5">
            <input
              type="number"
              min={1}
              max={180}
              value={customMin}
              onChange={(e) => setCustomMin(Math.max(1, Math.min(180, +e.target.value || 1)))}
              aria-label={t('timer.custom')}
              className="tnum w-9 bg-transparent text-center text-sm font-semibold outline-none"
            />
            <button
              onClick={() => start(customMin)}
              aria-label={t('timer.start')}
              className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-contrast"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </label>
        </div>
      )}
    </div>
  );
}
