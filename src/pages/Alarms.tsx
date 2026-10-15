import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { useNow } from '@/hooks/useNow';
import { AlarmEditor } from '@/components/AlarmEditor';
import { AlarmRow } from '@/components/AlarmRow';
import { SwipeRow } from '@/components/SwipeRow';
import { QuickSet } from '@/components/QuickTimer';
import { Button } from '@/components/ui';
import { nextEvent } from '@/utils/schedule';
import { formatAlarmTime, formatCountdown } from '@/utils/time';
import { sortByTimeOfDay } from '@/utils/alarmList';
import { audioService, isNativeApp } from '@/services';

export function Alarms() {
  const t = useT();
  const now = useNow('minute');
  const alarms = useStore((s) => s.alarms);
  const settings = useStore((s) => s.settings);
  const addAlarm = useStore((s) => s.addAlarm);
  const deleteAlarm = useStore((s) => s.deleteAlarm);
  const undoDelete = useStore((s) => s.undoDelete);
  const toast = useStore((s) => s.toast);
  const setAudioUnlocked = useStore((s) => s.setAudioUnlocked);
  const activeIds = useStore((s) => s.activeAlarmIds)();

  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);

  const sorted = useMemo(() => sortByTimeOfDay(alarms), [alarms]);
  const next = useMemo(
    () => nextEvent(alarms, settings, activeIds, now.getTime()),
    [alarms, settings, activeIds, now],
  );
  const editingAlarm = editing ? alarms.find((a) => a.id === editing.id) : undefined;

  const add = () => {
    const a = addAlarm();
    setEditing({ id: a.id, isNew: true });
  };
  const remove = (id: string) => {
    deleteAlarm(id, { undoable: true });
    toast(t('alarms.deleted'), { label: t('common.undo'), run: () => undoDelete(id) });
  };

  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="space-y-5 pb-24">
      <header className="pt-6">
        <p className="tnum text-sm text-muted">
          {dateLabel} · {formatAlarmTime(now.getHours(), now.getMinutes(), settings.hour24)}
        </p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight">{t('alarms.title')}</h1>
        <p className="mt-0.5 text-sm font-medium text-accent">
          {next
            ? t('alarms.nextIn', { time: formatCountdown(next.at - now.getTime()) })
            : t('alarms.noneOn')}
        </p>
      </header>

      {!isNativeApp && !settings.audioUnlocked && !audioService.isUnlocked() && (
        <button
          type="button"
          onClick={async () => setAudioUnlocked(await audioService.unlock())}
          className="w-full rounded-xl bg-accent-soft px-4 py-2.5 text-left text-sm font-medium text-accent"
        >
          {t('home.enableSound')} →
        </button>
      )}

      <QuickSet />

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="text-4xl" aria-hidden="true">
            🌙
          </span>
          <p className="text-base font-medium">{t('alarms.empty')}</p>
          <p className="text-sm text-muted">{t('alarms.emptyHint')}</p>
          <Button variant="primary" size="lg" onClick={add}>
            {t('alarms.add')}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => (
            <li key={a.id}>
              <SwipeRow onDelete={() => remove(a.id)} deleteLabel={t('alarms.delete')}>
                <AlarmRow
                  alarm={a}
                  dormant={activeIds != null && !activeIds.includes(a.id)}
                  onOpen={() => setEditing({ id: a.id, isNew: false })}
                />
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={add}
        aria-label={t('alarms.add')}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-[max(1.25rem,calc(50vw-14rem+1.25rem))] z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-contrast shadow-lg shadow-black/40 transition active:scale-95"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {editing && editingAlarm && (
        <AlarmEditor alarm={editingAlarm} isNew={editing.isNew} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
