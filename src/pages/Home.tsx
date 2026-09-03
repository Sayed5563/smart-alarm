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
import { audioService } from '@/services';

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

  const recent = history.filter((h) => !h.wasTest).slice(0, 3);

  const enableSound = async () => {
    const ok = await audioService.unlock();
    setAudioUnlocked(ok);
  };

  return (
    <div className="space-y-5">
      <header className="pt-6 pb-2 text-center">
        <Clock settings={settings} />
      </header>

      {!settings.audioUnlocked && !audioService.isUnlocked() && (
        <Card className="border-accent/40">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold">{t('home.enableSound')}</div>
              <p className="mt-1 text-xs text-muted">{t('home.enableSoundBody')}</p>
            </div>
            <Button size="sm" variant="primary" onClick={enableSound}>
              {t('common.enable')}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('home.nextAlarm')}
        </div>
        {nextAlarm && next ? (
          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className="tnum text-3xl font-light">
                {formatAlarmTime(
                  new Date(next.at).getHours(),
                  new Date(next.at).getMinutes(),
                  settings.hour24,
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm">
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
              </div>
            </div>
            <div className="text-right text-sm text-muted">
              {t('home.in', { time: formatCountdown(next.at - now.getTime()) })}
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <div className="text-lg font-medium">{t('home.noAlarms')}</div>
            <p className="text-sm text-muted">{t('home.noAlarmsHint')}</p>
          </div>
        )}
      </Card>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          {t('home.quickSet')}
        </div>
        <QuickSet />
      </div>

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
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {t('home.recent')}
          </div>
          <div className="space-y-2">
            {recent.map((h) => (
              <Card key={h.id} className="!p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {categoryIcon(h.category)} {h.alarmLabel}
                  </span>
                  <span className="text-xs text-muted">
                    {h.snoozeCount > 0 && `${t('history.snoozedTimes', { n: h.snoozeCount })} · `}
                    {h.outcome === 'completed' || h.outcome === 'dismissed-no-task'
                      ? t('history.completed')
                      : h.outcome === 'auto-stopped'
                        ? t('history.autoStopped')
                        : t('history.missed')}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
