import { useCallback, useEffect, useRef, useState } from 'react';
import type { HistoryOutcome } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { useNow } from '@/hooks/useNow';
import { formatClock, formatAlarmTime } from '@/utils/time';
import { categoryIcon } from '@/data/categories';
import { audioService, vibrationService, notificationService, type PlayHandle } from '@/services';
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
  }, []);

  const finish = useCallback(
    (outcome: HistoryOutcome, taskCompleted?: boolean) => {
      window.clearTimeout(safetyTimer.current);
      cleanupAudioVibration();
      afterHandle.current?.stop(150);
      afterHandle.current = null;
      if (ringing) void notificationService.clear(`alarm-${ringing.alarmId}`);
      endRing(outcome, taskCompleted);
    },
    [cleanupAudioVibration, endRing, ringing],
  );

  // ---- start audio + vibration + safety timer when a session begins
  useEffect(() => {
    if (!ringing || !alarm) return;
    setShowTask(false);
    setAutoStopped(false);
    setNeedsSoundTap(false);

    let cancelled = false;
    const isPre = kind === 'pre-alarm';
    const soundId = isPre ? alarm.preAlarm.soundId : alarm.soundId;
    const volume = isPre ? alarm.preAlarm.volume : alarm.volume;
    const fade = isPre ? 0 : alarm.fadeInSeconds;

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

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={t('ringing.stop')}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-y-auto bg-[#05070d] px-6 py-[max(2rem,env(safe-area-inset-top))] text-white safe-b"
    >
      {/* header */}
      <div className="w-full max-w-md pt-4 text-center">
        {kind === 'pre-alarm' ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
              {t('ringing.preAlarm')}
            </p>
            <p className="mt-2 text-white/70">{t('ringing.preAlarmBody', { time: mainTime })}</p>
          </>
        ) : (
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">
            {kind === 'test'
              ? t('ringing.test')
              : kind === 'timer'
                ? t('timer.title')
                : greeting}
          </p>
        )}
      </div>

      {/* clock + label */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="tnum text-6xl font-light sm:text-7xl">{timeStr.main}</div>
        <div className="flex items-center gap-2 text-lg">
          <span aria-hidden="true">{categoryIcon(alarm.category)}</span>
          <span className="font-medium">
            {alarm.label || t(`category.${alarm.category}` as 'category.other')}
          </span>
        </div>
        {alarm.strongAlert.enabled && kind !== 'pre-alarm' && (
          <p className="rounded-pill bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
            {t('ringing.strongActive')}
          </p>
        )}
        {needsSoundTap && (
          <button
            onClick={enableSound}
            className="rounded-pill bg-white/15 px-4 py-2 text-sm font-medium"
          >
            {t('home.enableSound')}
          </button>
        )}
        {autoStopped && <p className="text-sm text-white/60">{t('ringing.autoStopped')}</p>}
      </div>

      {/* controls */}
      <div className="w-full max-w-md space-y-3 pb-2">
        {phase === 'after-stop' ? (
          <div className="text-center">
            <p className="mb-3 text-white/70">
              {alarm.afterStop.behavior === 'must-finish'
                ? t('ringing.afterSoundMustFinish')
                : t('ringing.afterSoundPlaying')}
            </p>
            {alarm.afterStop.behavior === 'stoppable' && (
              <Button
                variant="secondary"
                size="lg"
                full
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
          <div className="rounded-3xl bg-white/5 p-5">
            <p className="mb-4 text-center text-sm text-white/70">{t('ringing.taskRequired')}</p>
            <WakeUpTaskRunner
              config={alarm.wakeUpTask}
              onFail={recordTaskFailure}
              onSolved={() => void doStop(true)}
            />
            <button
              onClick={() => setShowTask(false)}
              className="mt-4 block w-full text-center text-sm text-white/50"
            >
              {t('common.back')}
            </button>
          </div>
        ) : kind === 'pre-alarm' ? (
          <Button variant="primary" size="xl" full onClick={onStopPressed}>
            {t('ringing.dismissPre')}
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size="xl"
              full
              className="!bg-white/10 !text-white"
              onClick={() => {
                cleanupAudioVibration();
                window.clearTimeout(safetyTimer.current);
                addSnooze();
              }}
            >
              {t('ringing.snooze')} · {alarm.snoozeMinutes}m
            </Button>
            <Button
              variant="primary"
              size="xl"
              full
              onClick={onStopPressed}
              className="!bg-white !text-black"
            >
              {t('ringing.stop')}
            </Button>
          </>
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
