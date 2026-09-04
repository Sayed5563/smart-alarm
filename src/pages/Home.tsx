import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { useNow } from '@/hooks/useNow';
import { Clock } from '@/components/Clock';
import { QuickSet, Timer } from '@/components/QuickTimer';
import { Button, Card } from '@/components/ui';
import { nextEvent } from '@/utils/schedule';
import { formatAlarmTime, formatCountdown } from '@/utils/time';
import { categoryIcon } from '@/data/categories';
import { audioService, isNativeApp } from '@/services';

export function Home({ onAddAlarm, onTest }: { onAddAlarm: () => void; onTest: () => void }) {
  const t = useT();
  const now = useNow('minute');
  const alarms = useStore((s) => s.alarms);
  const settings = useStore((s) => s.settings);
  const history = useStore((s) => s.history);
  const activeIdsFn = useStore((s) => s.activeAlarmIds);
  const setAudioUnlocked = useStore((s) => s.setAudioUnlocked);

  const activeIds = activeIdsFn();

  const next = useMemo(
    () => nextEvent(alarms, settings, activeIds, now.getTime()),
    [alarms, settings, activeIds, now],
  );
  const nextAlarm = next ? alarms.find((a) => a.id === next.alarmId) : undefined;
  const recent = history.filter((h) => !h.wasTest && !h.wasTimer).slice(0, 2);
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const enableSound = async () => {
    const ok = await audioService.unlock();
    setAudioUnlocked(ok);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center pb-2 pt-10">
        <Clock settings={settings} />
        <p className="mt-4 text-sm text-muted">{dateLabel}</p>
      </header>

      {!isNativeApp && !settings.audioUnlocked && !audioService.isUnlocked() && (
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t('home.enableSound')}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t('home.enableSoundBody')}</p>
            </div>
            <Button size="sm" variant="primary" onClick={enableSound}>
              {t('common.enable')}
            </Button>
          </div>
        </Card>
      )}

      {nextAlarm && next ? (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted">{t('home.nextAlarm')}</p>
              <p className="tnum mt-1 text-2xl font-light">
                {formatAlarmTime(
                  new Date(next.at).getHours(),
                  new Date(next.at).getMinutes(),
                  settings.hour24,
                )}
              </p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm">
                <span aria-hidden="true">{categoryIcon(nextAlarm.category)}</span>
                <span className="font-medium">
                  {nextAlarm.label || t(`category.${nextAlarm.category}` as 'category.other')}
                </span>
                {next.kind === 'pre-alarm' && (
                  <span className="text-xs text-muted">· {t('ringing.preAlarm')}</span>
                )}
                {next.kind === 'snooze' && (
                  <span className="text-xs text-muted">· {t('ringing.snooze')}</span>
                )}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum text-3xl font-semibold text-accent">
                {formatCountdown(next.at - now.getTime())}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="text-center">
          <p className="text-base font-medium">{t('home.noAlarms')}</p>
          <p className="mt-1 text-sm text-muted">{t('home.noAlarmsHint')}</p>
        </Card>
      )}

      <QuickSet />

      <Timer />

      <div className="grid grid-cols-2 gap-3">
        <Button variant="primary" size="lg" onClick={onAddAlarm}>
          {t('home.addAlarm')}
        </Button>
        <Button variant="secondary" size="lg" onClick={onTest}>
          {t('home.testAlarm')}
        </Button>
      </div>

      {recent.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-xs font-medium text-muted">{t('home.recent')}</p>
          <div className="glass overflow-hidden rounded-card">
            {recent.map((h) => (
              <div
                key={h.id}
                className="row flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="truncate font-medium">
                  <span aria-hidden="true">{categoryIcon(h.category)}</span> {h.alarmLabel}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {h.snoozeCount > 0 && `${t('history.snoozedTimes', { n: h.snoozeCount })} · `}
                  {h.outcome === 'completed' || h.outcome === 'dismissed-no-task'
                    ? t('history.completed')
                    : h.outcome === 'auto-stopped'
                      ? t('history.autoStopped')
                      : t('history.missed')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
