import { useCallback, useEffect, useRef, useState } from 'react';
import type { HistoryOutcome } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { useNow } from '@/hooks/useNow';
import { formatClock, formatAlarmTime } from '@/utils/time';
import { categoryIcon } from '@/data/categories';
import {
  audioService,
  vibrationService,
  notificationService,
  isNativeApp,
  stopNativeAlarm,
  type PlayHandle,
} from '@/services';
import { Button } from './ui';
import { WakeUpTaskRunner } from './WakeUpTask';

/** Absolute ceiling: no alarm may ring longer than this even if a bug leaves it
 *  running. Strong Alert can shorten it but never exceed it. */
const GLOBAL_MAX_MS = 15 * 60_000;
const PRE_ALARM_MAX_MS = 3 * 60_000;
const AFTER_SOUND_MAX_MS = 3 * 60_000;

export function AlarmRinging() {
  const ringing = useStore((s) => s.ringing);
  const addSnooze = useStore((s) => s.addSnooze);
  const endRing = useStore((s) => s.endRing);
  const setRingPhase = useStore((s) => s.setRingPhase);
  const recordTaskFailure = useStore((s) => s.recordTaskFailure);
  const t = useT();
  const settings = useStore((s) => s.settings);
  const now = useNow('second');

  const mainHandle = useRef<PlayHandle | null>(null);
  const afterHandle = useRef<PlayHandle | null>(null);
  const safetyTimer = useRef<number>(0);
  const [showTask, setShowTask] = useState(false);
  const [needsSoundTap, setNeedsSoundTap] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);

  const alarm = ringing?.alarm;
  const kind = ringing?.kind;
  const phase = ringing?.phase ?? 'ringing';

  const cleanupAudioVibration = useCallback(() => {
    mainHandle.current?.stop(150);
    mainHandle.current = null;
    vibrationService.stop();
    void stopNativeAlarm();
  }, []);

  const finish = useCallback(
    (outcome: HistoryOutcome, taskCompleted?: boolean) => {
      window.clearTimeout(safetyTimer.current);
      cleanupAudioVibration();
      afterHandle.current?.stop(150);
      afterHandle.current = null;
      const r = useStore.getState().ringing;
      if (r) void notificationService.clear(`alarm-${r.alarmId}`);
      endRing(outcome, taskCompleted);
    },
    [cleanupAudioVibration, endRing],
  );

  // ---- start audio + vibration + safety timer when a session begins
  useEffect(() => {
    if (!ringing || !alarm) return;
    setShowTask(false);
    setAutoStopped(false);
    setNeedsSoundTap(false);

    let cancelled = false;
    const isPre = kind === 'pre-alarm';
    // On the native build a real alarm is already being played by the foreground
    // AlarmService (ALARM stream, bypasses DND) — don't double it up here.
    const nativeOwnsSound = isNativeApp && kind === 'alarm';
    const soundId = isPre ? alarm.preAlarm.soundId : alarm.soundId;
    const volume = isPre ? alarm.preAlarm.volume : alarm.volume;
    const fade = isPre ? 0 : alarm.fadeInSeconds;

    if (!nativeOwnsSound) {
      (async () => {
        if (!audioService.isUnlocked()) {
          const ok = await audioService.unlock();
          if (!ok && !cancelled) setNeedsSoundTap(true);
        }
        const h = await audioService.play(soundId, { volume, fadeInSeconds: fade, loop: true });
        if (cancelled) {
          h.stop(0);
          return;
        }
        mainHandle.current = h;
        if (h.id === -1) setNeedsSoundTap(true);
      })();

      if (!isPre && alarm.vibration !== 'off') {
        vibrationService.startRepeating(alarm.vibration, alarm.strongAlert.enabled ? 4000 : 8000);
      }
    }

    const cap = isPre
      ? PRE_ALARM_MAX_MS
      : Math.min(
          GLOBAL_MAX_MS,
          alarm.strongAlert.enabled ? alarm.strongAlert.maxDurationMinutes * 60_000 : GLOBAL_MAX_MS,
        );
    safetyTimer.current = window.setTimeout(() => {
      setAutoStopped(true);
      finish(isPre ? 'completed' : 'auto-stopped');
    }, cap);

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer.current);
      mainHandle.current?.stop(0);
      mainHandle.current = null;
      afterHandle.current?.stop(0);
      afterHandle.current = null;
      vibrationService.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringing?.id]);

  if (!ringing || !alarm) return null;

  const enableSound = async () => {
    await audioService.unlock();
    setNeedsSoundTap(false);
    const isPre = kind === 'pre-alarm';
    mainHandle.current?.stop(0);
    mainHandle.current = await audioService.play(isPre ? alarm.preAlarm.soundId : alarm.soundId, {
      volume: isPre ? alarm.preAlarm.volume : alarm.volume,
      fadeInSeconds: 0,
      loop: true,
    });
  };

  const doStop = async (taskCompleted: boolean) => {
    const outcome: HistoryOutcome = alarm.wakeUpTask.type !== 'none'
      ? taskCompleted
        ? 'completed'
        : 'dismissed-no-task'
      : 'dismissed-no-task';

    cleanupAudioVibration();
    window.clearTimeout(safetyTimer.current);

    if (alarm.afterStop.enabled && kind !== 'pre-alarm') {
      setRingPhase('after-stop');
      const h = await audioService.play(alarm.afterStop.soundId, {
        volume: alarm.afterStop.volume,
        loop: false,
      });
      afterHandle.current = h;
      const done = () => finish(outcome, taskCompleted);
      const safety = window.setTimeout(done, AFTER_SOUND_MAX_MS);
      void h.ended.then(() => {
        window.clearTimeout(safety);
        done();
      });
      if (alarm.afterStop.behavior === 'must-finish') {
        // no manual control — wait for `ended`
      }
      return;
    }
    finish(outcome, taskCompleted);
  };

  const onStopPressed = () => {
    if (kind === 'pre-alarm') {
      finish('completed');
      return;
    }
    if (alarm.wakeUpTask.type !== 'none') {
      setShowTask(true);
      return;
    }
    void doStop(false);
  };

  const greeting = getGreeting(now, t);
  const timeStr = formatClock(now, { hour24: settings.hour24, showSeconds: false });
  const mainTime = formatAlarmTime(alarm.hour, alarm.minute, settings.hour24);
  const isPre = kind === 'pre-alarm';

  const heading = isPre
    ? t('ringing.preAlarm')
    : kind === 'test'
      ? t('ringing.test')
      : kind === 'timer'
        ? t('timer.title')
        : greeting;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={t('ringing.stop')}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-y-auto bg-[#07070c] px-6 py-[max(2.25rem,env(safe-area-inset-top))] text-white"
      style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      {/* sunrise — the one orchestrated moment */}
      <div
        aria-hidden="true"
        className="sunrise pointer-events-none absolute inset-x-0 bottom-0 h-[85%]"
        style={{
          background: isPre
            ? 'radial-gradient(130% 95% at 50% 100%, #4a79ad 0%, #24406b 40%, transparent 76%)'
            : 'radial-gradient(130% 95% at 50% 100%, #ffb347 0%, #f0673f 26%, #c4344f 52%, transparent 78%)',
        }}
      />

      {/* header */}
      <div className="relative w-full max-w-md pt-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white/95 sm:text-[1.7rem]">
          {heading}
        </h1>
        {isPre ? (
          <p className="mt-2 text-sm text-white/70">
            {t('ringing.preAlarmBody', { time: mainTime })}
          </p>
        ) : (
          alarm.strongAlert.enabled && (
            <p className="mt-3 inline-block rounded-pill bg-white/12 px-3 py-1 text-xs font-semibold text-amber-200">
              {t('ringing.strongActive')}
            </p>
          )
        )}
      </div>

      {/* clock + label */}
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="tnum flex items-baseline justify-center text-[clamp(4.5rem,26vw,8rem)] font-extralight leading-none tracking-tight">
          {timeStr.main}
          {timeStr.suffix && (
            <span className="ml-2.5 text-lg font-semibold tracking-wide text-white/55">
              {timeStr.suffix}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-lg text-white/85">
          <span aria-hidden="true">{categoryIcon(alarm.category)}</span>
          <span className="font-medium">
            {alarm.label || t(`category.${alarm.category}` as 'category.other')}
          </span>
        </div>
        {needsSoundTap && (
          <button
            onClick={enableSound}
            className="rounded-pill border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur"
          >
            {t('home.enableSound')}
          </button>
        )}
        {autoStopped && <p className="text-sm text-white/60">{t('ringing.autoStopped')}</p>}
      </div>

      {/* controls */}
      <div className="relative w-full max-w-md">
        {phase === 'after-stop' ? (
          <div className="rounded-[1.75rem] bg-black/25 p-5 text-center backdrop-blur">
            <p className="mb-4 text-white/80">
              {alarm.afterStop.behavior === 'must-finish'
                ? t('ringing.afterSoundMustFinish')
                : t('ringing.afterSoundPlaying')}
            </p>
            {alarm.afterStop.behavior === 'stoppable' && (
              <Button
                variant="secondary"
                size="lg"
                full
                className="!border-white/25 !bg-white/10 !text-white"
                onClick={() => {
                  afterHandle.current?.stop(150);
                  finish(alarm.wakeUpTask.type !== 'none' ? 'completed' : 'dismissed-no-task');
                }}
              >
                {t('ringing.stopAfterSound')}
              </Button>
            )}
          </div>
        ) : showTask ? (
          <div className="rounded-[1.75rem] bg-black/30 p-5 backdrop-blur">
            <p className="mb-4 text-center text-sm text-white/75">{t('ringing.taskRequired')}</p>
            <WakeUpTaskRunner
              config={alarm.wakeUpTask}
              onFail={recordTaskFailure}
              onSolved={() => void doStop(true)}
            />
            <button
              onClick={() => setShowTask(false)}
              className="mt-4 block w-full text-center text-sm text-white/55 hover:text-white/80"
            >
              {t('common.back')}
            </button>
          </div>
        ) : isPre ? (
          <button
            onClick={onStopPressed}
            className="h-[4.5rem] w-full rounded-[1.75rem] bg-white text-xl font-semibold text-black transition active:scale-[0.97]"
          >
            {t('ringing.dismissPre')}
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => {
                cleanupAudioVibration();
                window.clearTimeout(safetyTimer.current);
                addSnooze();
              }}
              className="h-14 w-full rounded-[1.5rem] border border-white/25 text-base font-medium text-white/90 transition hover:bg-white/10 active:scale-[0.98]"
            >
              {t('ringing.snooze')} · {alarm.snoozeMinutes}m
            </button>
            <button
              onClick={onStopPressed}
              className="h-[4.75rem] w-full rounded-[1.75rem] bg-white text-2xl font-semibold text-black shadow-[0_16px_50px_-12px_rgba(255,255,255,0.5)] transition active:scale-[0.97]"
            >
              {t('ringing.stop')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting(now: Date, t: ReturnType<typeof useT>): string {
  const h = now.getHours();
  if (h < 12) return t('ringing.goodMorning');
  if (h < 18) return t('ringing.goodAfternoon');
  return t('ringing.goodEvening');
}
