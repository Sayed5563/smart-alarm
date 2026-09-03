import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import { AlarmCard } from '@/components/AlarmCard';
import { AlarmEditor } from '@/components/AlarmEditor';
import { Button, ConfirmDialog } from '@/components/ui';
import { nextOccurrence } from '@/utils/time';

export function Alarms() {
  const t = useT();
  const alarms = useStore((s) => s.alarms);
  const addAlarm = useStore((s) => s.addAlarm);
  const deleteAlarm = useStore((s) => s.deleteAlarm);
  const activeIdsFn = useStore((s) => s.activeAlarmIds);
  const activeIds = activeIdsFn();

  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const now = new Date();
    return [...alarms].sort((a, b) => {
      const na = nextOccurrence(a, now) ?? Infinity;
      const nb = nextOccurrence(b, now) ?? Infinity;
      if (na !== nb) return na - nb;
      return a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
    });
  }, [alarms]);

  const editingAlarm = editing ? alarms.find((a) => a.id === editing.id) : undefined;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-6">
        <h1 className="text-[1.7rem] font-semibold tracking-tight">{t('alarms.title')}</h1>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            const a = addAlarm();
            setEditing({ id: a.id, isNew: true });
          }}
        >
          + {t('alarms.add')}
        </Button>
      </header>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-accent-soft text-accent">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l3 2M5 3 2 6M19 3l3 3" />
            </svg>
          </div>
          <div>
            <p className="text-base font-medium">{t('alarms.empty')}</p>
            <p className="mt-1 text-sm text-muted">{t('alarms.emptyHint')}</p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              const a = addAlarm();
              setEditing({ id: a.id, isNew: true });
            }}
          >
            {t('alarms.add')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((a) => (
            <AlarmCard
              key={a.id}
              alarm={a}
              dormant={activeIds != null && !activeIds.includes(a.id)}
              onEdit={() => setEditing({ id: a.id, isNew: false })}
              onDelete={() => setConfirmDelete(a.id)}
            />
          ))}
        </div>
      )}

      {editing && editingAlarm && (
        <AlarmEditor
          alarm={editingAlarm}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('alarms.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteAlarm(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
