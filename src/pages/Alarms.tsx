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
        <h1 className="text-2xl font-semibold">{t('alarms.title')}</h1>
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
        <div className="glass rounded-card p-8 text-center">
          <p className="text-lg font-medium">{t('alarms.empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('alarms.emptyHint')}</p>
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
