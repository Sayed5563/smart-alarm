import { useMemo, useState } from 'react';
import type { AlarmHistoryEntry } from '@/types';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { Segmented, Card, Button, ConfirmDialog } from '@/components/ui';
import { categoryIcon } from '@/data/categories';
import { computeStats } from '@/utils/stats';
import { pad2 } from '@/utils/time';

export function History() {
  const t = useT();
  const [tab, setTab] = useState<'log' | 'stats'>('log');
  const history = useStore((s) => s.history);
  const clearHistory = useStore((s) => s.clearHistory);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-4">
      <header className="pt-6">
        <h1 className="text-[1.7rem] font-semibold tracking-tight">{t('history.title')}</h1>
      </header>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'log', label: t('history.title') },
          { value: 'stats', label: t('stats.title') },
        ]}
      />

      {tab === 'log' ? (
        <>
          {history.length === 0 ? (
            <div className="glass rounded-card p-8 text-center text-muted">{t('history.empty')}</div>
          ) : (
            <>
              <HistoryLog entries={history} />
              <Button variant="ghost" size="sm" full onClick={() => setConfirmClear(true)}>
                {t('history.clear')}
              </Button>
            </>
          )}
        </>
      ) : (
        <StatsView entries={history} />
      )}

      <ConfirmDialog
        open={confirmClear}
        title={t('history.clearConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearHistory();
          setConfirmClear(false);
        }}
      />
    </div>
  );
}

function dayLabel(ms: number, t: ReturnType<typeof useT>): string {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return t('history.today');
  if (diff === 1) return t('history.yesterday');
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function HistoryLog({ entries }: { entries: AlarmHistoryEntry[] }) {
  const t = useT();
  const groups = useMemo(() => {
    const map = new Map<string, AlarmHistoryEntry[]>();
    for (const e of entries) {
      const d = new Date(e.triggeredAt);
      d.setHours(0, 0, 0, 0);
      const key = String(d.getTime());
      let bucket = map.get(key);
      if (!bucket) {
        bucket = [];
        map.set(key, bucket);
      }
      bucket.push(e);
    }
    return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [entries]);

  return (
    <div className="space-y-4">
      {groups.map(([key, list]) => (
        <div key={key}>
          <div className="mb-2 text-xs font-medium text-muted">
            {dayLabel(Number(key), t)}
          </div>
          <div className="space-y-2">
            {list.map((e) => (
              <Card key={e.id} className="!p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {categoryIcon(e.category)} {e.alarmLabel}
                      {e.wasTest && <Badge>{t('history.test')}</Badge>}
                      {e.wasTimer && <Badge>{t('history.timer')}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted">
                      <span className="tnum">
                        {pad2(new Date(e.triggeredAt).getHours())}:
                        {pad2(new Date(e.triggeredAt).getMinutes())}
                      </span>
                      {e.snoozeCount > 0 && <span>{t('history.snoozedTimes', { n: e.snoozeCount })}</span>}
                      {e.wakeTaskRequired && (
                        <span>
                          {e.wakeTaskCompleted
                            ? t('history.taskDone')
                            : t('history.taskFailed', { n: e.wakeTaskFailures })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Outcome entry={e} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Outcome({ entry }: { entry: AlarmHistoryEntry }) {
  const t = useT();
  const map = {
    completed: { text: t('history.completed'), cls: 'text-success' },
    'dismissed-no-task': { text: t('history.dismissed'), cls: 'text-success' },
    'auto-stopped': { text: t('history.autoStopped'), cls: 'text-amber-500' },
    missed: { text: t('history.missed'), cls: 'text-danger' },
  } as const;
  const o = map[entry.outcome];
  return (
    <span className={`shrink-0 text-xs font-semibold ${o.cls}`}>
      <span aria-hidden="true">
        {entry.outcome === 'completed' || entry.outcome === 'dismissed-no-task' ? '✓ ' : ''}
      </span>
      {o.text}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
      {children}
    </span>
  );
}

function StatsView({ entries }: { entries: AlarmHistoryEntry[] }) {
  const t = useT();
  const s = useMemo(() => computeStats(entries), [entries]);

  if (entries.filter((e) => !e.wasTest && !e.wasTimer).length === 0) {
    return <div className="glass rounded-card p-8 text-center text-muted">{t('stats.none')}</div>;
  }

  const rows: { label: string; big?: boolean }[] = [
    {
      label: s.wakeStreakDays > 0 ? t('stats.streak', { n: s.wakeStreakDays }) : t('stats.streakZero'),
      big: true,
    },
    { label: t('stats.snoozesToday', { n: s.snoozesToday }) },
    { label: t('stats.avgSnooze', { n: s.averageSnoozes }) },
    ...(s.mostUsedAlarmLabel ? [{ label: t('stats.mostUsed', { label: s.mostUsedAlarmLabel }) }] : []),
    ...(s.taskCompletionRate != null
      ? [{ label: t('stats.taskRate', { n: Math.round(s.taskCompletionRate * 100) }) }]
      : []),
    { label: t('stats.totalRings', { n: s.totalRings }) },
    ...(s.onTimeRate != null
      ? [{ label: t('stats.onTime', { n: Math.round(s.onTimeRate * 100) }) }]
      : []),
  ];

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <Card key={i} className={r.big ? '!py-5 text-center' : '!py-3'}>
          <span className={r.big ? 'text-xl font-semibold' : 'text-sm'}>{r.label}</span>
        </Card>
      ))}
    </div>
  );
}
